// Fictional incident data and deterministic game rules. No production data or network calls.
export const CASES = [
  {
    id: 'double-charge', title: 'The double charge', severity: 'SEV 1', service: 'checkout → payments',
    brief: 'Support reports customers charged twice after checkout timed out. The payment provider reports healthy availability. Find the cause and stop new duplicate charges.',
    signal: '15 duplicate charges · 09:42 UTC',
    evidence: [
      { id: 'retry', type: 'logs', title: 'A request returns', text: '09:41:03 checkout order=O-184 attempt=1 request=R-71\n09:41:05 checkout order=O-184 error=deadline_exceeded\n09:41:06 checkout order=O-184 attempt=2 request=R-72\n09:41:07 payments order=O-184 status=captured charge=CH-902', note: 'One order appears under two request IDs after a timeout.' },
      { id: 'capture', type: 'logs', title: 'Provider audit trail', text: '09:41:04 provider order=O-184 charge=CH-901 captured\n09:41:07 provider order=O-184 charge=CH-902 captured\nBoth requests: idempotency_key=<absent>\nProvider status: no outage; no repeated callbacks.', note: 'Two distinct charges were accepted without an idempotency key.' },
      { id: 'timeout', type: 'traces', title: 'Trace R-71 / attempt 1', text: 'checkout                0ms ━━━━━━━━━━ 2000ms TIMEOUT\n└ payments              8ms ━━━━━━━━━━━━━ 2410ms\n  └ provider.capture   20ms ━━━━━ 1380ms COMMITTED\nResponse to caller was lost after the provider committed.', note: 'A caller timeout did not cancel or roll back the payment.' },
      { id: 'second', type: 'traces', title: 'Trace R-72 / retry', text: 'checkout order=O-184     NEW REQUEST\n└ payments              NEW EXECUTION\n  └ provider.capture    NEW CHARGE CH-902\nNo lookup of the previous order operation.', note: 'The retry executed the side effect again.' },
      { id: 'rate', type: 'metrics', title: 'Orders versus captures', text: 'Window             Before     Incident\nUnique orders       1,240       1,240\nSuccessful captures 1,240       1,255\nDuplicate charges       0          15', note: 'More captures than unique orders indicate repeated side effects, not missing payments.' },
      { id: 'health', type: 'metrics', title: 'Dependency health', text: 'Provider success rate    99.99%\nPayment CPU                 31%\nPayment DB utilization      38%\nCheckout timeout rate      8.2% (baseline 0.1%)', note: 'Saturation is absent. Timeouts overlap with duplicate payments.' },
    ],
    hypotheses: [
      { id: 'provider', label: 'The provider duplicated one payment internally', feedback: 'The provider recorded two different incoming requests and two charge IDs. Follow the retry across the service boundary.' },
      { id: 'idempotency', label: 'A timeout triggered a retry without end-to-end idempotency', correct: true },
      { id: 'database', label: 'Database saturation created duplicate order rows', feedback: 'Database utilization is normal, and the unique order count did not increase. The duplicated object is the charge.' },
    ],
    fixes: [
      { id: 'timeout', label: 'Increase the timeout to 30 seconds', feedback: 'Longer timeouts may reduce retries, but a lost response can still trigger a second charge. The side effect remains unprotected.' },
      { id: 'dedupe', label: 'Reuse an order operation key, reserve it atomically, and forward it to the provider', correct: true },
      { id: 'memory', label: 'Keep processed orders in a worker-local set', feedback: 'The retry reached another worker. A local set also disappears on restart and cannot coordinate concurrent requests.' },
    ],
    before: ['15 duplicate charges', '8.2% checkout timeouts', '1,255 captures / 1,240 orders'],
    after: ['0 new duplicate charges', '1 provider capture per order', 'Concurrent retries return the same result'],
    checks: ['Drop the response after capture, then retry: original charge returned.', 'Send concurrent retries to two workers: one atomic operation reservation.', 'Restart a worker and retry: durable state prevents another capture.'],
    lesson: 'A timeout is an unknown outcome, not proof of failure. Persist an operation key with atomic coordination and use the same key at the external side-effect boundary. Reconcile and refund existing duplicate charges separately; preventing new ones does not undo old ones.',
  },
  {
    id: 'cache-stampede', title: 'The midnight avalanche', severity: 'SEV 2', service: 'catalog → cache → database',
    brief: 'Catalog latency spikes every five minutes. Database CPU briefly hits 98%, then recovers. Traffic volume is steady. Work out what makes the service overload itself.',
    signal: 'p99 latency 4,800ms · recurring every 300s',
    evidence: [
      { id: 'misses', type: 'logs', title: 'Expiry window', text: '00:05:00.001 cache key=homepage expired\n00:05:00.004 worker=1 cache_miss → rebuild\n00:05:00.005 worker=2 cache_miss → rebuild\n00:05:00.006 worker=3 cache_miss → rebuild\n… 800 concurrent rebuilds for the same key', note: 'Many workers rebuild the same expired value simultaneously.' },
      { id: 'ttl', type: 'logs', title: 'Cache configuration', text: 'TTL=300 seconds\nStale response serving: disabled\nRefresh coordination: none\nExpiry jitter: 0 seconds', note: 'The value expires on a fixed schedule without refresh coordination.' },
      { id: 'fanout', type: 'traces', title: 'One refresh, many queries', text: 'GET /catalog       4,800ms\n└ cache.get        MISS\n└ rebuild          4,750ms\n  └ db.query       waiting for connection\nSame span tree on hundreds of simultaneous requests.', note: 'Concurrent cache rebuilds amplify downstream database work.' },
      { id: 'cached', type: 'traces', title: 'Between incidents', text: 'GET /catalog        24ms\n└ cache.get         HIT  2ms\nDatabase spans:     none\nIncoming traffic:   unchanged', note: 'The fast path works; the stampede happens at expiry.' },
      { id: 'waves', type: 'metrics', title: 'Repeated peaks', text: 'Time        DB CPU    Cache hit rate   p99\n00:04        26%           99%          42ms\n00:05        98%            3%        4800ms\n00:06        27%           99%          43ms\n00:10        98%            3%        4790ms', note: 'The repeating overload lines up with the five-minute TTL.' },
      { id: 'traffic', type: 'metrics', title: 'Traffic and capacity', text: 'Incoming requests       800/s (steady)\nCache memory             42%\nCache evictions            0\nDB queries at expiry    800/s (baseline 8/s)', note: 'No traffic burst or cache eviction explains the database surge.' },
    ],
    hypotheses: [
      { id: 'attack', label: 'A periodic traffic attack overloads the catalog', feedback: 'Incoming request volume stays at 800/s. Compare cache expiry with database query volume.' },
      { id: 'memory', label: 'The cache is evicting values because it is full', feedback: 'Cache memory is 42% and evictions are zero. The expiry is intentional.' },
      { id: 'stampede', label: 'Synchronized expiry triggers uncoordinated concurrent rebuilds', correct: true },
    ],
    fixes: [
      { id: 'ttl', label: 'Change the fixed TTL from five to ten minutes', feedback: 'The next avalanche now happens at ten minutes. Rebuild concurrency is still unbounded.' },
      { id: 'refresh', label: 'Serve bounded stale data while one coordinated refresher rebuilds the key', correct: true },
      { id: 'retries', label: 'Retry database queries immediately until they succeed', feedback: 'Immediate retries amplify load while the pool is already exhausted.' },
    ],
    before: ['4,800ms p99 latency', '800 concurrent rebuilds', '98% database CPU'],
    after: ['48ms p99 latency', '1 coordinated rebuild', '29% database CPU'],
    checks: ['Expire the hot key under 800 requests/s: one refresh owner.', 'During refresh: bounded stale responses keep serving.', 'Fail the refresher: its lease expires and another worker takes over.'],
    lesson: 'Protect the miss path, not just the hit path. Coordinate refresh across workers, bound stale age, and give refresh ownership a lease. TTL jitter helps spread unrelated expirations but cannot alone protect one hot key.',
  },
  {
    id: 'connection-leak', title: 'The vanishing connections', severity: 'SEV 1', service: 'report API → connection pool',
    brief: 'The report API gets slower after every deploy. Restarting workers briefly helps, but the problem returns. The database has spare capacity. Find what is consuming the connection pool.',
    signal: 'Pool 20/20 in use · request queue growing',
    evidence: [
      { id: 'pool', type: 'logs', title: 'Worker lifecycle', text: '12:00 worker started pool_max=20\n12:04 request canceled while reading result rows\n12:08 request canceled while reading result rows\n12:20 pool_acquire timeout in_use=20 idle=0', note: 'Pool exhaustion follows canceled report requests.' },
      { id: 'diff', type: 'logs', title: 'Release diff', text: 'rows, err := db.Query(query)\nif err != nil { return err }\nfor rows.Next() {\n  if ctx.Err() != nil { return ctx.Err() }\n  // decode a report row\n}\n// rows.Close is not scheduled after a successful query', note: 'The early return can leave rows holding a pooled connection.' },
      { id: 'wait', type: 'traces', title: 'Slow request breakdown', text: 'GET /report          10,020ms\n└ pool.acquire       10,000ms TIMEOUT\nDatabase query span: not started\nDatabase execution:  no query received', note: 'Latency is spent waiting for a connection, not executing a slow query.' },
      { id: 'cancel', type: 'traces', title: 'Canceled request path', text: 'GET /report          CANCELED\n└ rows.open          connection=17\n└ decode             early return\n  rows.close         absent from cleanup instrumentation\n  pool.release       absent after cancellation', note: 'Cleanup instrumentation shows a connection was not returned on the cancellation path.' },
      { id: 'growth', type: 'metrics', title: 'After a restart', text: 'Minutes since start     0     5    10    20\nConnections in use      1     6    12    20\nConnections idle       19    14     8     0\nCanceled reports        0     5    11    19', note: 'Occupied connections grow with cancellations and never recover.' },
      { id: 'db', type: 'metrics', title: 'Database health', text: 'Database CPU          18%\nQuery p99             21ms\nActive DB queries        1\nPool waiter count      186', note: 'The database is healthy. The application pool is the bottleneck.' },
    ],
    hypotheses: [
      { id: 'leak', label: 'An early return leaks result rows and their pooled connections', correct: true },
      { id: 'query', label: 'A slow query saturates database CPU', feedback: 'Database CPU is 18% and query p99 is 21ms. The failing request never gets a connection to execute its query.' },
      { id: 'traffic', label: 'A traffic spike permanently exceeds pool capacity', feedback: 'A restart temporarily restores service at the same traffic level. Inspect what fails to return connections afterward.' },
    ],
    fixes: [
      { id: 'restart', label: 'Restart the workers every ten minutes', feedback: 'A restart clears the symptom, but the cancellation path leaks connections again.' },
      { id: 'pool', label: 'Raise the pool maximum from 20 to 200', feedback: 'A larger pool delays exhaustion. It does not release connections on early returns.' },
      { id: 'cleanup', label: 'Defer rows.Close after a successful query and test every exit path', correct: true },
    ],
    before: ['20/20 connections occupied', '10,020ms request latency', '186 waiting requests'],
    after: ['2/20 connections occupied', '35ms request latency', '0 waiting requests'],
    checks: ['Cancel during iteration: rows closed and connection released.', 'Fail decoding a row: cleanup still executes.', 'Repeat 100 cancellations: pool usage returns to baseline.'],
    lesson: 'Every acquired resource needs a reliable release path. Schedule cleanup immediately after successful acquisition, check iteration errors, and test cancellation and error exits. Instrument pool wait separately from database execution.',
  },
];

export function newCase(index = 0) {
  return { index, seen: [], diagnosis: null, resolved: false, mistakes: 0, hints: 0, feedback: '', outcome: null };
}
export function inspect(state, id) {
  if (!CASES[state.index].evidence.some(e => e.id === id) || state.seen.includes(id)) return state;
  return { ...state, seen: [...state.seen, id] };
}
export function canDiagnose(state) {
  const types = CASES[state.index].evidence.filter(e => state.seen.includes(e.id)).map(e => e.type);
  return new Set(types).size === 3;
}
export function diagnose(state, id) {
  if (state.resolved || state.diagnosis) return state;
  if (!canDiagnose(state)) return { ...state, feedback: 'Inspect at least one log, one trace, and one metric before submitting a diagnosis.' };
  const choice = CASES[state.index].hypotheses.find(h => h.id === id);
  if (!choice) return state;
  return choice.correct
    ? { ...state, diagnosis: id, feedback: 'Diagnosis supported. Choose a remediation and replay the failure conditions.' }
    : { ...state, mistakes: state.mistakes + 1, feedback: choice.feedback };
}
export function replay(state, id) {
  if (!state.diagnosis || state.resolved) return state;
  const choice = CASES[state.index].fixes.find(f => f.id === id);
  if (!choice) return state;
  return choice.correct
    ? { ...state, resolved: true, outcome: 'pass', appliedFix: id, feedback: 'Replay passed. All three regression checks are green.' }
    : { ...state, mistakes: state.mistakes + 1, outcome: 'fail', appliedFix: id, feedback: choice.feedback };
}
export function score(state) {
  return Math.max(0, Math.min(100, (state.resolved ? 70 : 0) + state.seen.length * 5 - state.mistakes * 10 - state.hints * 5));
}

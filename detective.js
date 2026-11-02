import { CASES, newCase, inspect, canDiagnose, diagnose, replay, score } from './detective-engine.mjs';

const root = document.querySelector('[data-detective]');
let state = newCase();
let activeType = 'logs';
let activeEvidence = null;
const solved = new Set();
const progress = new Map();
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe = escapeHtml;

function render() {
  const incident = CASES[state.index];
  const evidence = incident.evidence.filter(e => e.type === activeType);
  const selected = incident.evidence.find(e => e.id === activeEvidence);
  root.innerHTML = `
    <div class="pd-heading"><div><span class="pd-kicker">ON CALL / INTERACTIVE INCIDENT LAB</span><h2>Production Detective</h2><p>Read the signals. Follow the request. Find the failure.</p></div><span class="pd-label">Fictional systems · local simulation</span></div>
    <div class="pd-case-picker" aria-label="Incident cases">${CASES.map((c,i)=>`<button type="button" data-case="${i}" aria-pressed="${i===state.index}"><small>CASE 0${i+1}${solved.has(i)?' / SOLVED':''}</small>${safe(c.title)}</button>`).join('')}</div>
    <div class="pd-brief"><span class="pd-severity">${incident.severity}</span><div><h3>${safe(incident.title)}</h3><p>${safe(incident.brief)}</p><span class="pd-service">${safe(incident.service)} · ${safe(incident.signal)}</span></div></div>
    <ol class="pd-steps" aria-label="Investigation progress"><li class="${!state.diagnosis?'current':'done'}">01 Investigate</li><li class="${state.diagnosis&&!state.resolved?'current':''}">02 Diagnose &amp; fix</li><li class="${state.resolved?'done':''}">03 Verify recovery</li></ol>
    <div class="pd-workspace"><section class="pd-evidence"><div class="pd-section-heading"><h3>Evidence desk</h3><span>${state.seen.length}/6 inspected</span></div>
      <div class="pd-tabs" aria-label="Evidence categories">${['logs','traces','metrics'].map(type=>`<button type="button" data-evidence-type="${type}" aria-pressed="${activeType===type}">${type}</button>`).join('')}</div>
      <div class="pd-evidence-list">${evidence.map(e=>`<button type="button" data-evidence="${e.id}" aria-pressed="${e.id===activeEvidence}"><span>${state.seen.includes(e.id)?'✓':'○'} ${safe(e.title)}</span><small>${state.seen.includes(e.id)?'INSPECTED':'OPEN EVIDENCE'}</small></button>`).join('')}</div>
      <div class="pd-evidence-detail">${selected?`<h4>${safe(selected.title)}</h4><pre tabindex="0">${safe(selected.text)}</pre><p class="pd-observation"><strong>Observation:</strong> ${safe(selected.note)}</p>`:'<div class="pd-empty"><span aria-hidden="true">⌕</span><p>Select an evidence item to inspect it.</p><small>Correlate logs, traces, and metrics before deciding.</small></div>'}</div>
    </section><section class="pd-decisions"><div class="pd-section-heading"><h3>${state.diagnosis?'Remediation plan':'Working hypothesis'}</h3><span>${state.diagnosis?'DIAGNOSED':canDiagnose(state)?'READY':'GATHER SIGNALS'}</span></div>
      ${!state.diagnosis?`<p>Inspect at least one item in each category, then choose the cause supported by the evidence.</p><form data-diagnosis-form><fieldset><legend>What caused the incident?</legend>${incident.hypotheses.map(h=>`<label><input type="radio" name="hypothesis" value="${h.id}" required><span>${safe(h.label)}</span></label>`).join('')}</fieldset><button class="pd-action" type="submit" ${!canDiagnose(state)?'disabled':''}>Submit diagnosis</button></form>`:`<p class="pd-confirmed">✓ ${safe(incident.hypotheses.find(h=>h.id===state.diagnosis).label)}</p><form data-fix-form><fieldset ${state.resolved?'disabled':''}><legend>What would you change?</legend>${incident.fixes.map(f=>`<label><input type="radio" name="fix" value="${f.id}" ${state.appliedFix===f.id?'checked':''} required><span>${safe(f.label)}</span></label>`).join('')}</fieldset><button class="pd-action" type="submit" ${state.resolved?'disabled':''}>${state.resolved?'Recovery verified':'Apply fix & replay incident'}</button></form>`}
      <div class="pd-feedback ${state.outcome==='fail'?'pd-failed':''}" role="status" aria-live="polite">${safe(state.feedback||'No diagnosis submitted. Inspect the evidence to begin.')}</div>
      <div class="pd-utilities"><button type="button" data-hint>Request a hint (−5)</button><button type="button" data-restart>Restart case</button></div>
    </section></div>
    <section class="pd-recovery ${state.resolved?'is-resolved':''}" aria-label="Incident replay results"><div class="pd-section-heading"><h3>${state.resolved?'Recovery verified':state.outcome==='fail'?'Replay: incident persists':'Incident baseline'}</h3><span>${state.resolved?`${score(state)}/100 investigation score`:'REPLAY REQUIRED'}</span></div><div class="pd-metrics">${(state.resolved?incident.after:incident.before).map(v=>`<div><span>${state.resolved?'AFTER FIX':'BEFORE FIX'}</span><strong>${safe(v)}</strong></div>`).join('')}</div>
      ${state.resolved?`<ol class="pd-checks">${incident.checks.map(c=>`<li>PASS · ${safe(c)}</li>`).join('')}</ol><div class="pd-postmortem"><h3>Incident notes</h3><p>${safe(incident.lesson)}</p><p>Evidence: ${state.seen.length}/6 · Incorrect attempts: ${state.mistakes} · Hints: ${state.hints}. Scores reward complete evidence collection and correct decisions.</p><button type="button" class="pd-action" data-next>${solved.size===CASES.length?'All cases solved — revisit another case':'Investigate the next case'}</button></div>`:'<p class="pd-replay-note">Replay uses fixed failure scenarios and synthetic telemetry. A successful fix must address the cause, not only hide its symptoms.</p>'}
    </section>`;
}
function refreshFocus(selector) {
  const position = root.closest('.window-content').scrollTop;
  render();
  root.closest('.window-content').scrollTop = position;
  if (selector) root.querySelector(selector)?.focus({preventScroll:true});
}
root.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-case')) {
    progress.set(state.index,state); state = progress.get(Number(button.dataset.case)) || newCase(Number(button.dataset.case)); activeType='logs'; activeEvidence=null; refreshFocus(`[data-case="${state.index}"]`);
  } else if (button.dataset.evidenceType) {
    activeType=button.dataset.evidenceType; activeEvidence=null; refreshFocus(`[data-evidence-type="${activeType}"]`);
  } else if (button.dataset.evidence) {
    activeEvidence=button.dataset.evidence; state=inspect(state,activeEvidence); refreshFocus(`[data-evidence="${activeEvidence}"]`);
  } else if (button.hasAttribute('data-hint')) {
    const unseen=CASES[state.index].evidence.find(e=>!state.seen.includes(e.id));
    if (!state.resolved) state={...state,hints:state.hints+1,feedback:unseen?`Look at ${unseen.type}: “${unseen.title}”. Compare it with the other signals.`:'Compare the timing of the failure with the side effects and resource lifecycles. A symptom is not always a cause.'};
    refreshFocus('[data-hint]');
  } else if (button.hasAttribute('data-restart')) {
    state=newCase(state.index); progress.delete(state.index); solved.delete(state.index); activeType='logs'; activeEvidence=null; refreshFocus('[data-restart]');
  } else if (button.hasAttribute('data-next')) {
    progress.set(state.index,state); const next=CASES.findIndex((_,i)=>!solved.has(i)); const index=next<0?(state.index+1)%CASES.length:next; state=progress.get(index)||newCase(index); activeType='logs'; activeEvidence=null; render(); root.closest('.window-content').scrollTop=0;
  }
});
root.addEventListener('submit', event => {
  event.preventDefault();
  const form=event.target;
  if (form.matches('[data-diagnosis-form]')) {
    state=diagnose(state,new FormData(form).get('hypothesis')); refreshFocus(state.diagnosis?'[name="fix"]':'.pd-feedback');
  } else if (form.matches('[data-fix-form]')) {
    state=replay(state,new FormData(form).get('fix'));
    if (state.resolved) solved.add(state.index);
    refreshFocus(state.resolved?'[data-next]':'[name="fix"]');
  }
});
render();

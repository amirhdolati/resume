import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, newCase, inspect, canDiagnose, diagnose, replay, score } from '../detective-engine.mjs';
for (const [index,incident] of CASES.entries()) {
  test(`${incident.id}: evidence gate, wrong choices, fix, and replay`,()=>{
    let s=newCase(index);
    const correct=incident.hypotheses.find(h=>h.correct).id;
    assert.equal(diagnose(s,correct).diagnosis,null);
    assert.equal(replay(s,incident.fixes.find(f=>f.correct).id),s);
    s=inspect(s,incident.evidence[0].id);
    assert.equal(inspect(s,incident.evidence[0].id),s);
    assert.equal(canDiagnose(s),false);
    for(const e of incident.evidence) s=inspect(s,e.id);
    assert.equal(canDiagnose(s),true);
    const wrong=diagnose(s,incident.hypotheses.find(h=>!h.correct).id);
    assert.equal(wrong.diagnosis,null);
    assert.equal(wrong.mistakes,1);
    s=diagnose(wrong,correct);
    assert.equal(s.diagnosis,correct);
    const failed=replay(s,incident.fixes.find(f=>!f.correct).id);
    assert.equal(failed.resolved,false);
    assert.equal(failed.outcome,'fail');
    const passed=replay(failed,incident.fixes.find(f=>f.correct).id);
    assert.equal(passed.resolved,true);
    assert.equal(passed.outcome,'pass');
    assert.equal(score(passed),80);
    assert.equal(replay(passed,incident.fixes[0].id),passed);
    assert.deepEqual(newCase(index).seen,[]);
  });
  test(`${incident.id}: perfect evidence-based solution scores 100`,()=>{
    let s=newCase(index);
    for(const e of incident.evidence) s=inspect(s,e.id);
    s=diagnose(s,incident.hypotheses.find(h=>h.correct).id);
    s=replay(s,incident.fixes.find(f=>f.correct).id);
    assert.equal(score(s),100);
  });
}
test('Scoring is bounded and hints reduce the result',()=>{
 assert.equal(score({...newCase(),resolved:true,seen:['a','b','c','d','e','f'],hints:2}),90);
 assert.equal(score({...newCase(),mistakes:999}),0);
});

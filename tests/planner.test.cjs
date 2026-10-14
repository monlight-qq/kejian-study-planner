const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../app.js');
const record = overrides => ({id:'one',kind:'exam',subject:'数学',title:'期中考试',date:'2026-10-15T09:00',done:false,priority:'normal',notes:'',chapters:[{title:'函数',done:true},{title:'集合',done:false}],...overrides});
test('rejects dates that roll into the next month or contain an invalid time',()=>{
  assert.equal(core.validDate('2026-02-30T09:00'),false);
  assert.equal(core.validDate('2026-10-15T25:00'),false);
  assert.equal(core.validDate('2028-02-29T09:00'),true);
});
test('uses calendar days rather than rounding elapsed hours',()=>{
  assert.equal(core.daysUntil('2026-10-10T00:10',new Date('2026-10-09T23:50')),1);
  assert.equal(core.daysUntil('2026-10-09T23:00',new Date('2026-10-09T08:00')),0);
});
test('backup validation preserves progress and rejects duplicates and malformed records',()=>{
  const entries=core.normalizeBackup({version:1,entries:[record()]});
  assert.equal(core.progress(entries[0]),50);
  assert.throws(()=>core.normalizeBackup({version:1,entries:[record(),record()]}));
  assert.throws(()=>core.normalizeBackup({version:1,entries:[record({date:'2026-02-30T09:00'})]}));
  assert.throws(()=>core.normalizeBackup({version:1,entries:[record({chapters:[{title:'函数',done:'yes'}]})]}));
  assert.throws(()=>core.normalizeBackup({version:2,entries:[]}));
});
test('ordering puts earlier deadlines first without mutating source data',()=>{
  const source=[record({id:'late',date:'2026-10-20T09:00'}),record({id:'early'})];
  assert.equal(core.sortEntries(source)[0].id,'early');
  assert.equal(source[0].id,'late');
});
test('renders imported text as text rather than active HTML',()=>{
  assert.equal(core.escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('old records migrate without inventing start dates and preserve previous data',()=>{
  const entry=core.normalizeBackup({version:1,entries:[record()]})[0];
  assert.equal(entry.startDate,'');assert.equal(entry.reminder,true);assert.equal(entry.title,'期中考试');assert.equal(core.progress(entry),50);
});
test('validates start dates and reminder flags during import',()=>{
  assert.equal(core.validStartDate('2026-02-30'),false);
  assert.equal(core.validStartDate('2026-10-09'),true);
  const entry=core.normalizeBackup({version:1,entries:[record({startDate:'2026-10-09',reminder:false})]})[0];
  assert.equal(entry.startDate,'2026-10-09');assert.equal(entry.reminder,false);
  assert.throws(()=>core.normalizeBackup({version:1,entries:[record({startDate:'2026-10-16'})]}));
  assert.throws(()=>core.normalizeBackup({version:1,entries:[record({reminder:'true'})]}));
});
test('computes two reminder instants exactly six and three hours before the deadline',()=>{
  for(const date of ['2026-11-20T18:00','2026-11-20T04:30','2027-01-01T02:15']){
    assert.deepEqual(core.reminderTimes(date),[6,3].map(hours=>new Date(date).getTime()-hours*3600000));
    assert.equal(core.reminderTime(date),core.reminderTimes(date)[0]);
    assert.equal(core.reminderTime(date,3),core.reminderTimes(date)[1]);
  }
  assert.deepEqual(core.reminderTimes('2027-01-01T02:15').map(time=>core.localDateTime(new Date(time))),['2026-12-31T20:15','2026-12-31T23:15']);
});
test('hour offsets remain elapsed hours across spring and autumn daylight-saving changes',()=>{
  const {execFileSync}=require('node:child_process'),source=require.resolve('../app.js');
  const output=execFileSync(process.execPath,['-e',`const core=require(${JSON.stringify(source)}); console.log(JSON.stringify(['2026-03-08T07:30','2026-11-01T06:30'].map(date=>({date,offsets:core.reminderTimes(date).map(time=>(new Date(date)-time)/3600000),local:core.reminderTimes(date).map(time=>core.localDateTime(new Date(time)))}))));`],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8',windowsHide:true});
  const records=JSON.parse(output);assert.deepEqual(records.map(record=>record.offsets),[[6,3],[6,3]]);
  assert.deepEqual(records[0].local,['2026-03-08T00:30','2026-03-08T04:30']);
  assert.deepEqual(records[1].local,['2026-11-01T01:30','2026-11-01T03:30']);
});

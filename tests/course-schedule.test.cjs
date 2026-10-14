const test=require('node:test'),assert=require('node:assert/strict'),schedule=require('../course-schedule.js'),{normalizeCourses}=require('../timetable.js');
const start='2026-09-07',course=values=>({id:'one',title:'高等数学',weekday:1,repeat:'all',startTime:'08:00',endTime:'09:40',location:'A302',notes:'',...values});
test('old courses migrate to twenty weeks and new ranges are strictly validated',()=>{
  const normalized=normalizeCourses([course()])[0];assert.equal(normalized.weeks.length,20);assert.deepEqual(normalized.adjustments,[]);
  for(const weeks of [[],[0],[21],[1,1],['1']])assert.throws(()=>normalizeCourses([course({weeks})]));
  assert.throws(()=>normalizeCourses([course({weeks:[2,4],repeat:'odd'})]));
  assert.deepEqual(schedule.normalizeWeeks([3,1]),[1,3]);
});
test('early completion intersects explicit weeks and parity and never passes week twenty',()=>{
  const one=course({weeks:Array.from({length:12},(_,i)=>i+1),repeat:'odd'});
  assert.equal(schedule.baseOnDate(one,'2026-11-16',start),true); // week 11
  assert.equal(schedule.baseOnDate(one,'2026-11-23',start),false); // week 12 even
  assert.equal(schedule.baseOnDate(one,'2026-11-30',start),false); // week 13 ended
  assert.equal(schedule.baseOnDate(course(),'2027-01-18',start),true);assert.equal(schedule.baseOnDate(course(),'2027-01-25',start),false);
});
test('cancel, move, and extra use exact dates and effective times and locations',()=>{
  const one=course({weeks:[5,6],adjustments:[{id:'move',action:'move',date:'2026-10-05',toDate:'2026-10-10',startTime:'10:00',endTime:'11:00',location:'B201'},{id:'extra',action:'extra',date:'2026-10-10',startTime:'15:00',endTime:'16:00',location:''},{id:'cancel',action:'cancel',date:'2026-10-12'}]});
  assert.equal(schedule.occurrencesOnDate(one,'2026-10-05',start).length,0);assert.equal(schedule.occurrencesOnDate(one,'2026-10-12',start).length,0);
  const moved=schedule.occurrencesOnDate(one,'2026-10-10',start);assert.equal(moved.length,2);assert.equal(moved[0].location,'B201');assert.equal(moved[1].location,'A302');assert.equal(moved[0]._adjustment,'调课');
  assert.equal(schedule.occurrencesOnDate({...one,weeks:[6]},'2026-10-10',start).length,1); // removed source week disables its move
  assert.equal(schedule.occurrencesOnDate({...one,adjustments:[{id:'late',action:'extra',date:'2027-01-25',startTime:'10:00',endTime:'11:00'}]},'2027-01-25',start).length,0);
});
test('adjustments reject malformed dates, duplicate sources, and backwards times',()=>{
  const move={id:'move',action:'move',date:'2026-10-05',toDate:'2026-10-10',startTime:'10:00',endTime:'11:00',location:''};
  assert.throws(()=>schedule.normalizeAdjustments([{...move,toDate:'2026-02-30'}]));assert.throws(()=>schedule.normalizeAdjustments([{...move,endTime:'09:00'}]));
  assert.throws(()=>schedule.normalizeAdjustments([move,{id:'cancel',action:'cancel',date:'2026-10-05'}]));
  assert.deepEqual(normalizeCourses([course({adjustments:[move]})])[0].adjustments,[move]);
});
test('conflict detection respects separate weeks and moved-day conflicts',()=>{
  assert.equal(schedule.overlaps(course({weeks:[1,2]}),course({weeks:[3,4]})),false);
  const moved=course({adjustments:[{id:'move',action:'move',date:'2026-10-05',toDate:'2026-10-10',startTime:'10:00',endTime:'11:00',location:''}]});
  assert.equal(schedule.schedulesOverlap(moved,course({weekday:6,startTime:'10:30',endTime:'11:30'}),start),true);
});
test('global lists sort by start time before weekday, and OCR extracts discontinuous week ranges',()=>{
  const rows=[course({id:'afternoon',startTime:'14:00',endTime:'15:00',weekday:1}),course({id:'early',startTime:'07:00',endTime:'08:00',weekday:4})];assert.equal([...rows].sort(schedule.compareCourses)[0].id,'early');assert.equal(rows[0].id,'afternoon');
  assert.deepEqual(schedule.weeksFromText('1-3,5,8-10周(单)'),[1,2,3,5,8,9,10]);assert.equal(schedule.weeksFromText('1-21周'),null);assert.equal(schedule.summary([1,2,3,5]),'第 1–3、5 周');
});

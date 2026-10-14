const test=require('node:test'),assert=require('node:assert/strict'),schedule=require('../course-schedule.js'),{normalizeCourses}=require('../timetable.js');
const start='2026-09-07',make=(id,values={})=>normalizeCourses([{id,title:id,weekday:1,repeat:'all',startTime:'08:00',endTime:'09:00',location:'A302',notes:'',...values}])[0],on=(courses,date)=>courses.flatMap(course=>schedule.occurrencesOnDate(course,date,start));
test('whole-day move reads effective week/parity, preserves time/place, sorts, and changes only selected dates',()=>{
  const courses=[make('late',{startTime:'14:00',endTime:'15:00'}),make('early'),make('odd',{repeat:'odd',startTime:'10:00',endTime:'11:00'}),make('even',{repeat:'even'}),make('ended',{weeks:[1,2,3,4]})],before=JSON.stringify(courses),value=schedule.planDayTransfer(courses,start,'2026-10-05','2026-10-10');
  assert.deepEqual(value.source.map(item=>item.id),['early','odd','late']);assert.deepEqual(value.result.map(item=>item.startTime),['08:00','10:00','14:00']);assert.equal(on(value.courses,'2026-10-05').length,0);assert.equal(on(value.courses,'2026-10-12').length,3);assert.equal(on(value.courses,'2026-10-19').length,3);assert.equal(value.result[0].location,'A302');assert.equal(JSON.stringify(courses),before);assert.doesNotThrow(()=>normalizeCourses(value.courses));
});
test('copy retains the source and repeated imports do not duplicate any sessions',()=>{
  const courses=[make('one')],first=schedule.planDayTransfer(courses,start,'2026-10-05','2026-10-10',{mode:'copy'}),second=schedule.planDayTransfer(first.courses,start,'2026-10-05','2026-10-10',{mode:'copy'});
  assert.equal(on(first.courses,'2026-10-05').length,1);assert.equal(first.result.length,1);assert.equal(second.result.length,1);assert.equal(second.changed,0);assert.equal(second.skipped,1);
});
test('moving already adjusted and extra sessions keeps their actual time/place without restoring the original day',()=>{
  const courses=[make('one',{weekday:4,adjustments:[{id:'prior',action:'move',date:'2026-10-01',toDate:'2026-10-05',startTime:'11:00',endTime:'12:00',location:'B201'},{id:'extra',action:'extra',date:'2026-10-05',startTime:'16:00',endTime:'17:00',location:'C303'}]})],value=schedule.planDayTransfer(courses,start,'2026-10-05','2026-10-10');
  assert.equal(on(value.courses,'2026-10-01').length,0);assert.equal(on(value.courses,'2026-10-05').length,0);assert.deepEqual(value.result.map(item=>[item.startTime,item.location]),[['11:00','B201'],['16:00','C303']]);assert.equal(value.courses[0].adjustments.length,2);
});
test('target is preserved by default, overlap is reported, optional target cancellation never revives earlier moved courses',()=>{
  const courses=[make('one'),make('target',{weekday:4,adjustments:[{id:'prior',action:'move',date:'2026-10-01',toDate:'2026-10-10',startTime:'08:30',endTime:'09:30',location:'B201'},{id:'extra',action:'extra',date:'2026-10-10',startTime:'10:00',endTime:'11:00',location:''}]})];
  const keep=schedule.planDayTransfer(courses,start,'2026-10-05','2026-10-10');assert.equal(keep.result.length,3);assert.equal(keep.conflicts.length,1);
  const replace=schedule.planDayTransfer(courses,start,'2026-10-05','2026-10-10',{replaceTarget:true});assert.equal(replace.result.length,1);assert.equal(on(replace.courses,'2026-10-01').length,0);
  assert.equal(on(replace.courses,'2026-10-01').some(item=>item.id==='target'),false);
});
test('invalid/no-course dates and adjustment overflow leave the original schedule unchanged',()=>{
  const courses=[make('one')],before=JSON.stringify(courses);for(const [from,to] of [['2026-02-30','2026-10-10'],['2026-10-05','2026-10-05'],['2026-10-06','2026-10-10'],['2026-10-05','2027-01-25']])assert.throws(()=>schedule.planDayTransfer(courses,start,from,to));assert.equal(JSON.stringify(courses),before);
  const filled=[make('full',{adjustments:Array.from({length:40},(_,i)=>({id:'extra-'+i,action:'extra',date:'2026-10-06',startTime:'11:00',endTime:'12:00',location:''}))})],saved=JSON.stringify(filled);assert.throws(()=>schedule.planDayTransfer(filled,start,'2026-10-05','2026-10-10'),/40/);assert.equal(JSON.stringify(filled),saved);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const courses=require('../timetable.js'),planner=require('../app.js');
const course=values=>({id:'one',title:'高等数学',weekday:1,startTime:'08:00',endTime:'09:40',location:'A302',notes:'',...values});
test('course normalization migrates old weekly courses and rejects malformed schedules',()=>{
  assert.equal(courses.normalizeCourses([course()])[0].repeat,'all');
  assert.throws(()=>courses.normalizeCourses([course({startTime:'25:00'})]));
  assert.throws(()=>courses.normalizeCourses([course({endTime:'07:00'})]));
  assert.throws(()=>courses.normalizeCourses([course(),course()]));
  assert.throws(()=>courses.normalizeCourses([course({repeat:'unknown'})]));
});
test('single/double weeks follow the configured semester rather than calendar year parity',()=>{
  const start='2026-09-07';
  assert.equal(courses.weekNumber('2026-09-13',start),1);
  assert.equal(courses.weekNumber('2026-09-14',start),2);
  assert.equal(courses.onDate(course({repeat:'odd'}),'2026-09-07',start),true);
  assert.equal(courses.onDate(course({repeat:'odd'}),'2026-09-14',start),false);
  assert.equal(courses.onDate(course({repeat:'even'}),'2026-09-14',start),true);
  assert.equal(courses.onDate(course({repeat:'all'}),'2026-09-01',start),false);
  assert.equal(courses.weekNumber('2027-01-04',start),18);
});
test('courses in opposite week types do not conflict',()=>{
  assert.equal(courses.overlaps(course({repeat:'odd'}),course({repeat:'even'})),false);
  assert.equal(courses.overlaps(course({repeat:'odd'}),course({repeat:'all'})),true);
  assert.equal(courses.overlaps(course({endTime:'09:00'}),course({startTime:'09:00',endTime:'10:00'})),false);
});
test('calendar includes every day of a range across month/year boundaries',()=>{
  const plan={startDate:'2026-12-30',date:'2027-01-03T18:00'};
  for(const day of ['2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'])assert.equal(planner.planOnDate(plan,day),true);
  assert.equal(planner.planOnDate(plan,'2026-12-29'),false);
  assert.equal(planner.planOnDate(plan,'2027-01-04'),false);
  assert.equal(planner.planOnDate({date:'2027-01-03T18:00',startDate:''},'2027-01-02'),false);
});

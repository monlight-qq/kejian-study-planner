const test=require('node:test'),assert=require('node:assert/strict');
const {candidate,parseOCR,mergeCourses,applyPeriods,timeRange,ocrLayout,gridCells}=require('../course-import.js');
test('extracts explicit course times, weekday, location and parity without inventing missing values',()=>{
  const row=candidate('周一 08:00-09:40 高等数学 地点 A302 单周');
  assert.equal(row.title,'高等数学');assert.equal(row.weekday,1);assert.equal(row.location,'A302');assert.equal(row.repeat,'odd');assert.equal(row.startTime,'08:00');assert.equal(row.endTime,'09:40');
  const missing=candidate('大学英语\n1-2节\n双周');assert.equal(missing.weekday,0);assert.equal(missing.startTime,'');assert.equal(missing.location,'');assert.equal(missing.periodEnd,2);assert.equal(missing.repeat,'even');
});

test('wrapped classroom digits and sports venues remain locations, while title continuations join only inside a cell',()=>{
  for(const [text,title,location] of [
    ['人工智能\n导论..\n宏智楼2\n15','人工智能导论…','宏智楼215'],
    ['数据库原\n理及..\n信 智 楼 B\n411 室','数据库原理及…','信智楼B411室'],
    ['大学体育\nIII\n室外 羽毛\n球场 1','大学体育III','室外羽毛球场1'],
    ['面向对象\n程序..\n宏智楼2\n02','面向对象程序…','宏智楼202']
  ]){const item=candidate(text,3,90,{joinTitle:true});assert.equal(item.title,title);assert.equal(item.location,location);}
  assert.deepEqual(timeRange('08:30-10\n00'),{startTime:'08:30',endTime:'10:00'});assert.deepEqual(timeRange('10:20-11:5\n0'),{startTime:'10:20',endTime:'11:50'});assert.equal(timeRange('08:30-24:00'),null);
});

test('the supplied five-period timetable parses 15 separate cells with all wrapped names, rooms and times',()=>{
  const expected=require('./fixtures/user-timetable.expected.json'),lines=[];
  const line=(text,x,y,width=110)=>{const bbox={x0:x,y0:y,x1:x+width,y1:y+30};lines.push({text,bbox,confidence:90,words:[{text,bbox,confidence:90}]});};
  ['周一','星期','周三','星期匹','周五','周六','星期'].forEach((text,i)=>line(text,250+i*150,20,60));
  const starts=['08:30-10','10:20-11:5','14:00-15','15:50-18:1','19:00-21'],ends=['00','0','30','0','20'],periods=['01,02','03,04','05,06','07,08,09','10,11,12'];
  for(let i=0;i<5;i++){const top=110+i*260;line('第'+['一','二','三','四','五'][i]+'大节',30,top,140);line('('+periods[i]+'小',30,top+45,140);line('节)',30,top+80,140);line(starts[i],30,top+145,150);line(ends[i],30,top+190,30);}
  for(const row of expected){const x=240+(row.weekday-1)*150,top=120+(row.period-1)*260;[...row.titleLines,...row.placeLines].forEach((text,i)=>line(text,x,top+i*45));}
  const data={blocks:[{paragraphs:[{lines}]}],text:''},rows=parseOCR(data);assert.equal(rows.length,15);
  assert.deepEqual(rows.map(({weekday,title,startTime,endTime,location})=>({weekday,title,startTime,endTime,location})),expected.map(({weekday,title,startTime,endTime,location})=>({weekday,title,startTime,endTime,location})));
  const cells=gridCells(ocrLayout(data),1350,1450);assert.equal(cells.length,15);assert.ok(cells.every(({rectangle:r})=>r.left>=0&&r.top>=0&&r.left+r.width<=1350&&r.top+r.height<=1450));
});
test('assigns courses to screenshot weekday columns using word geometry',()=>{
  const lines=[];const line=(text,x,y)=>{const bbox={x0:x,y0:y,x1:x+text.length*18,y1:y+20};lines.push({text,bbox,confidence:90,words:[{text,bbox,confidence:90}]});};
  ['周一','周二','周三','周四','周五','周六','周日'].forEach((text,index)=>line(text,100+index*140,30));
  line('高等数学',90,110);line('08:00-09:40',70,140);line('A302',100,170);line('单周',100,200);
  line('大学物理',230,330);line('13:00-14:30',210,360);line('B201',240,390);line('双周',240,420);
  line('第1-2节',0,110);
  const result=parseOCR({blocks:[{paragraphs:[{lines}]}],text:''});assert.equal(result.length,2);assert.equal(result[0].weekday,1);assert.equal(result[1].weekday,2);assert.equal(result[1].repeat,'even');assert.equal(result[0].periodStart,1);assert.equal(result[0].periodEnd,2);
});
test('fills only blank times from school periods and skips exact duplicate imports',()=>{
  const row=candidate('高等数学\n第1-2节');applyPeriods(row,{1:{startTime:'08:10',endTime:'08:55'},2:{startTime:'09:05',endTime:'09:50'}});assert.equal(row.startTime,'08:10');assert.equal(row.endTime,'09:50');
  row.startTime='08:20';applyPeriods(row,{1:{startTime:'08:10'}});assert.equal(row.startTime,'08:20');
  const base={id:'one',title:'数学',weekday:1,repeat:'odd',startTime:'08:00',endTime:'09:00',location:'A302',notes:''};
  const merged=mergeCourses([base],[{...base,id:'two'},{...base,id:'three',repeat:'even'}]);assert.equal(merged.added,1);assert.equal(merged.skipped,1);assert.equal(merged.courses.length,2);
});
test('list screenshots retain the day when time is on the next line',()=>{
  const result=parseOCR({text:'周一\n08:00-09:40\n高等数学\nA302\n单周\n周二\n13:00-14:30\n大学物理\nB201\n双周'});
  assert.equal(result.length,2);assert.equal(result[0].weekday,1);assert.equal(result[0].title,'高等数学');assert.equal(result[1].weekday,2);
});

test('Chinese course and building lines stay separate even without Latin room codes',()=>{
  for(const [text,title,location] of [
    ['高等数学\n教学楼302\n08:00-09:40\n单周','高等数学','教学楼302'],
    ['大学英语\n上课地点：博学楼205\n第1-16周','大学英语','博学楼205'],
    ['大学物理\n实验楼\nB201\n周三 10:00-11:40','大学物理','实验楼 B201'],
    ['艺术鉴赏\n东校区\n逸夫楼\n305\n第3-4节','艺术鉴赏','东校区 逸夫楼 305']
  ]){
    const item=candidate(text);assert.ok(item,`Course disappeared: ${text}`);assert.equal(item.title,title);assert.equal(item.location,location);
  }
});

test('inline locations are removed precisely while course names and schedule fields are kept',()=>{
  for(const [text,title,location] of [
    ['周一 08:00-09:40 高等数学 教学楼A302 单周','高等数学','教学楼A302'],
    ['大学物理 实验楼 B201\n周三 10:00-11:40\n双周','大学物理','实验楼 B201'],
    ['高等数学 博学楼302\n第1-2节\n1-16周','高等数学','博学楼302'],
    ['A302 高等数学\n08:00-09:40','高等数学','A302'],
    ['计算机基础（综合楼D202）\n12:00-13:40','计算机基础','综合楼D202'],
    ['计算机基础 2号楼305\n12:00-13:40','计算机基础','2号楼305'],
    ['大学英语 二教308\n周二 08:00-09:40','大学英语','二教308'],
    ['课程名称：大学英语；上课地点：明德楼205；教师：李老师\n周二 08:00-09:40','大学英语','明德楼205'],
    ['地点：B201；课程名称：大学物理\n周三 10:00-11:40','大学物理','B201'],
    ['高 等 数 学\n教 学 楼 A302\n1-16周','高等数学','教学楼 A302'],
    ['课 程 名 称：大学英语；上 课 地 点：明德楼205；教 师：李老师\n周 二 08:00-09:40','大学英语','明德楼205']
  ]){
    const item=candidate(text);assert.ok(item,`Course disappeared: ${text}`);assert.equal(item.title,title);assert.equal(item.location,location);
  }
});

test('grid OCR keeps inline title/room and Chinese building rows in their own fields',()=>{
  const lines=[];const line=(text,x,y,width=100)=>{const bbox={x0:x,y0:y,x1:x+width,y1:y+20};lines.push({text,bbox,confidence:90,words:[{text,bbox,confidence:90}]});};
  ['周一','周二','周三','周四','周五','周六','周日'].forEach((text,i)=>line(text,100+i*180,30,50));
  line('高等数学 教学楼A302',75,110,145);line('08:00-09:40',80,140,120);line('1-16周(单)',80,170,110);
  line('大学物理',450,110);line('实验楼',450,140);line('B201',455,170);line('10:00-11:40',440,200,120);
  const rows=parseOCR({blocks:[{paragraphs:[{lines}]}],text:''});assert.equal(rows.length,2);
  assert.deepEqual(rows.map(row=>[row.title,row.location,row.weekday]),[['高等数学','教学楼A302',1],['大学物理','实验楼 B201',3]]);assert.equal(rows[0].repeat,'odd');assert.equal(rows[0].weeks.length,16);
});

test('missing locations stay blank and course wording is not mistaken for a building',()=>{
  for(const title of ['教学楼建筑设计','体育馆设计','计算机基础A1','大学英语2026','至善教育','Advanced Mathematics II']){
    const item=candidate(title+'\n第1-2节\n第1-16周\n教师：张老师');assert.equal(item.title,title);assert.equal(item.location,'');
  }
  const item=candidate('大学英语\n地点：\n博学楼205\n周二 08:00-09:40');assert.equal(item.title,'大学英语');assert.equal(item.location,'博学楼205');
  assert.equal(candidate('高等数学\n教学楼A302\n单 周').repeat,'odd');assert.equal(candidate('大学物理\n实验楼B201\n双 周').repeat,'even');
});

const test=require('node:test'),assert=require('node:assert/strict');
const {candidate,parseOCR,mergeCourses,applyPeriods,timeRange,ocrLayout,gridCells,numericBands,coloredCells,selectPacked}=require('../course-import.js');
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

test('compact portal cards separate section codes, wrapped buildings and old campus aliases',()=>{
  for(const [text,title,location,code] of [
    ['概率与\n数理统\n计(23)\n集贤楼\n(原西\n教2号','概率与数理统计','集贤楼(原西教2号','23'],
    ['马克思\n主义基\n本原理\n(28)抒\n望楼\n(原西','马克思主义基本原理','抒望楼(原西','28'],
    ['面向对\n象技术\n(01)观\n成楼\n(原西\n教1号','面向对象技术','观成楼(原西教1号','01'],
    ['大学英\n语B3(7\n0)抒望\n楼（原\n西教4号\n楼）20','大学英语B3','抒望楼（原西教4号楼）20','70'],
    ['体育3(8\n0)彭家\n坪田径\n场','体育3','彭家坪田径场','80']
  ]){const item=candidate(text,4,90,{packed:true});assert.equal(item.title,title);assert.equal(item.location,location);assert.match(item.notes,new RegExp('原图编号：'+code));assert.equal(item.startTime,'');assert.equal(item.periodStart,0);}
});

test('numeric period axes recover faint missing marks while rejecting sparse or inconsistent marks',()=>{
  const mark=(text,y)=>({text,bbox:{x0:20,x1:35,y0:y-10,y1:y+10}}),rows=[2,3,4,6,7,8,9,10,11,12].map(n=>mark(String(n),70+(n-1)*100));rows.push(mark('7',350));
  const bands=numericBands(rows,1300);assert.equal(bands.length,12);assert.equal(bands[0].top,20);assert.equal(bands[5].bottom,620);assert.equal(bands[1].periodStart,2);assert.equal(bands[1].startTime,undefined);
  assert.deepEqual(numericBands([mark('9',900),mark('7',1200)],1300),[]);assert.deepEqual(numericBands([1,2,3,4].map(n=>mark(String(n),n*100)),1300),[]);
});

test('colored cards spanning multiple periods remain single courses and blank weekend columns stay empty',()=>{
  const width=790,height=700,data=new Uint8ClampedArray(width*height*4);for(let i=0;i<data.length;i+=4){data[i]=249;data[i+1]=250;data[i+2]=252;data[i+3]=255;}
  const fill=(x0,x1,y0,y1,rgb)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*width+x)*4;data.set([...rgb,255],i);}};
  fill(45,135,60,250,[240,244,250]);fill(45,135,265,455,[238,244,250]);fill(145,235,60,250,[245,246,235]);
  const bands=Array.from({length:12},(_,i)=>({top:60+i*100,bottom:160+i*100,periodStart:i+1,periodEnd:i+1})),cells=coloredCells({firstX:90,spacing:100,top:55,bands},{width,height,data});
  assert.equal(cells.length,3);assert.deepEqual(cells.map(cell=>[cell.weekday,cell.band.periodStart,cell.band.periodEnd]),[[1,1,2],[1,3,4],[2,1,2]]);assert.ok(cells.every(cell=>cell.packed));
  assert.deepEqual(coloredCells(null,{width,height,data}),[]);
});

test('disagreeing local OCR passes visibly require review without joining the location into the name',()=>{
  const item=selectPacked([{text:'算法与\n数据结\n构(01)\n蔚云楼\n(原西教6号',confidence:90},{text:'算法与\n效据结\n构(01)\n前云楼\n(原西教6号',confidence:70}],2);
  assert.equal(item.title,'算法与数据结构');assert.equal(item.location,'蔚云楼(原西教6号');assert.equal(item.confidence,74);assert.match(item.notes,/重点核对/);assert.deepEqual(selectPacked([],1),null);
});

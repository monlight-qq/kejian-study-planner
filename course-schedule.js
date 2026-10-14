(function(){
  'use strict';
  const ALL_WEEKS=Array.from({length:20},(_,i)=>i+1);
  const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00Z'))&&new Date(value+'T12:00Z').toISOString().slice(0,10)===value;
  const weekNumber=(value,start)=>Math.floor((Date.parse(value+'T00:00Z')-Date.parse(start+'T00:00Z'))/604800000)+1;
  const matchesRepeat=(week,repeat)=>!repeat||repeat==='all'||(repeat==='odd' ? week%2===1 : week%2===0);
  function normalizeWeeks(value=ALL_WEEKS){if(!Array.isArray(value)||!value.length||value.length>20||value.some(week=>!Number.isInteger(week)||week<1||week>20)||new Set(value).size!==value.length)throw new Error('请选择第 1–20 周内的上课周次，至少选择一周');return [...value].sort((a,b)=>a-b);}
  function normalizeAdjustments(value=[]){
    if(!Array.isArray(value)||value.length>40)throw new Error('每门课程最多保存 40 项临时调整');const ids=new Set(),sources=new Set();
    return value.map(item=>{
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id)||!['cancel','move','extra'].includes(item.action)||!validDay(item.date))throw new Error('课程调整的日期或编号不正确');ids.add(item.id);
      if(item.action!=='extra'){if(sources.has(item.date))throw new Error('同一原上课日期只能设置一次停课或调课');sources.add(item.date);}
      const toDate=item.toDate||'',startTime=item.startTime||'',endTime=item.endTime||'',location=item.location||'';
      if(item.action==='move'&&!validDay(toDate)||item.action!=='cancel'&&(!validTime(startTime)||!validTime(endTime)||startTime>=endTime)||typeof location!=='string'||location.length>120)throw new Error('课程调整的时间或地点不正确');
      return {id:item.id,action:item.action,date:item.date,toDate:item.action==='move' ? toDate : '',startTime:item.action==='cancel' ? '' : startTime,endTime:item.action==='cancel' ? '' : endTime,location:item.action==='cancel' ? '' : location.trim()};
    });
  }
  function baseOnDate(course,value,start){const week=start ? weekNumber(value,start) : 1;return week>=1&&week<=20&&(course.weeks||ALL_WEEKS).includes(week)&&matchesRepeat(week,course.repeat)&&course.weekday===(new Date(value+'T12:00Z').getUTCDay()||7);}
  function occurrencesOnDate(course,value,start){
    const week=start ? weekNumber(value,start) : 1;if(week<1||week>20)return [];
    const adjustments=course.adjustments||[],occurrences=[];
    if(baseOnDate(course,value,start)&&!adjustments.some(item=>item.action!=='extra'&&item.date===value))occurrences.push({...course,_occurrenceDate:value});
    for(const item of adjustments){if(item.action==='extra'&&item.date===value||item.action==='move'&&item.toDate===value&&baseOnDate(course,item.date,start))occurrences.push({...course,startTime:item.startTime,endTime:item.endTime,location:item.location||course.location,_occurrenceDate:value,_sourceDate:item.date,_adjustment:item.action==='move' ? '调课' : '加课',_adjustmentId:item.id});}
    return occurrences;
  }
  const compareCourses=(a,b)=>a.startTime.localeCompare(b.startTime)||a.endTime.localeCompare(b.endTime)||a.weekday-b.weekday||a.title.localeCompare(b.title)||a.id.localeCompare(b.id);
  function overlaps(a,b){return a.weekday===b.weekday&&(a.weeks||ALL_WEEKS).some(week=>(b.weeks||ALL_WEEKS).includes(week)&&matchesRepeat(week,a.repeat)&&matchesRepeat(week,b.repeat))&&a.startTime<b.endTime&&b.startTime<a.endTime;}
  function schedulesOverlap(a,b,start){
    if(!(a.adjustments?.length||b.adjustments?.length))return overlaps(a,b);
    const first=Date.parse(start+'T12:00Z');for(let day=0;day<140;day++){const date=new Date(first+day*86400000).toISOString().slice(0,10),one=occurrencesOnDate(a,date,start),two=occurrencesOnDate(b,date,start);if(one.some(x=>two.some(y=>x.startTime<y.endTime&&y.startTime<x.endTime)))return true;}return false;
  }
  function summary(weeks=ALL_WEEKS){const sorted=[...weeks].sort((a,b)=>a-b),ranges=[];let start=sorted[0],end=start;for(let i=1;i<=sorted.length;i++){if(sorted[i]===end+1){end=sorted[i];continue;}if(start!==undefined)ranges.push(start===end ? String(start) : `${start}–${end}`);start=sorted[i];end=start;}return sorted.length ? `第 ${ranges.join('、')} 周` : '未选周次';}
  function weeksFromText(value){const result=new Set();for(const match of value.matchAll(/(?:第\s*)?(\d{1,2}(?:\s*[-–—至~～,，、]\s*\d{1,2})*)\s*周/g)){for(const part of match[1].split(/[,，、]/)){const range=part.split(/[-–—至~～]/).map(Number),from=range[0],to=range[1]??from;if(from<1||to>20||from>to)return null;for(let week=from;week<=to;week++)result.add(week);}}return result.size ? [...result].sort((a,b)=>a-b) : null;}
  function planDayTransfer(courses,start,from,to,{mode='move',replaceTarget=false}={}){
    if(!validDay(start)||!validDay(from)||!validDay(to))throw new Error('请选择有效的调休前和调休后日期');
    if(from===to)throw new Error('调休前和调休后不能是同一天');
    if(!['move','copy'].includes(mode))throw new Error('请选择整体调课或复制补课');
    for(const date of [from,to]){const week=weekNumber(date,start);if(week<1||week>20)throw new Error('请在学期第 1–20 周内选择调休日期');}
    const source=courses.flatMap(course=>occurrencesOnDate(course,from,start)).sort(compareCourses),target=courses.flatMap(course=>occurrencesOnDate(course,to,start)).sort(compareCourses);
    if(!source.length)throw new Error('调休前当天没有课程，请选择有课的日期');
    const next=courses.map(course=>({...course,adjustments:(course.adjustments||[]).map(item=>({...item}))})),byId=new Map(next.map(course=>[course.id,course])),changes=new Set();let skipped=0;
    const newId=()=>globalThis.crypto?.randomUUID?.()||'adjustment-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    function cancelOccurrence(item){const course=byId.get(item.id);changes.add(item.id);if(item._adjustmentId){const index=course.adjustments.findIndex(value=>value.id===item._adjustmentId),old=course.adjustments[index];if(old.action==='extra')course.adjustments.splice(index,1);else course.adjustments[index]={id:old.id,action:'cancel',date:old.date};}else course.adjustments.push({id:newId(),action:'cancel',date:from===item._occurrenceDate ? from : to});}
    if(replaceTarget)target.forEach(cancelOccurrence);
    const signature=item=>[item.id,item.startTime,item.endTime,item.location].join('|'),existing=new Set((replaceTarget ? [] : target).map(signature));
    for(const item of source){
      const course=byId.get(item.id);if(existing.has(signature(item))){skipped++;if(mode==='move')cancelOccurrence(item);continue;}existing.add(signature(item));changes.add(item.id);
      const times={startTime:item.startTime,endTime:item.endTime,location:item.location};
      if(mode==='copy')course.adjustments.push({id:newId(),action:'extra',date:to,...times});
      else if(item._adjustmentId){const old=course.adjustments.find(value=>value.id===item._adjustmentId);Object.assign(old,old.action==='extra' ? {date:to,...times} : {toDate:to,...times});}
      else course.adjustments.push({id:newId(),action:'move',date:from,toDate:to,...times});
    }
    for(const course of next)if(changes.has(course.id))course.adjustments=normalizeAdjustments(course.adjustments);
    const result=next.flatMap(course=>occurrencesOnDate(course,to,start)).sort(compareCourses),conflicts=[];
    for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)if(result[i].startTime<result[j].endTime&&result[j].startTime<result[i].endTime)conflicts.push([result[i],result[j]]);
    return {courses:next,source,target,result,conflicts,skipped,moved:mode==='move' ? source.length : source.length-skipped,changed:changes.size};
  }
  const api={ALL_WEEKS,validDay,validTime,weekNumber,matchesRepeat,normalizeWeeks,normalizeAdjustments,baseOnDate,occurrencesOnDate,compareCourses,overlaps,schedulesOverlap,summary,weeksFromText,planDayTransfer};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof document==='undefined')return;
  function readPicker(container){try{return JSON.parse(container.closest('form').elements[container.dataset.weekInput].value);}catch{return [...ALL_WEEKS];}}
  function renderPicker(container,weeks=ALL_WEEKS,repeat='all'){
    const selected=[...weeks].sort((a,b)=>a-b),form=container.closest('form');form.elements[container.dataset.weekInput].value=JSON.stringify(selected);container.dataset.repeat=repeat;
    const count=selected.filter(week=>matchesRepeat(week,repeat)).length;
    container.innerHTML=`<div class="week-picker-top"><span>${count ? `实际安排 ${count} 周` : '至少选择一个有效上课周'}</span><div><button type="button" class="text-button" data-week-all>全选</button><button type="button" class="text-button" data-week-clear>清空</button></div></div><div class="teaching-weeks">${ALL_WEEKS.map(week=>`<button type="button" data-week-toggle="${week}" class="${selected.includes(week) ? 'selected' : ''}" aria-pressed="${selected.includes(week)}" aria-label="第 ${week} 周${!matchesRepeat(week,repeat) ? '，不符合当前单双周设置' : ''}" ${!matchesRepeat(week,repeat) ? 'disabled' : ''}>${week}</button>`).join('')}</div><div class="week-range-controls"><select data-week-from aria-label="起始周">${ALL_WEEKS.map(week=>`<option value="${week}" ${week===(selected[0]||1) ? 'selected' : ''}>第 ${week} 周</option>`).join('')}</select><span>至</span><select data-week-to aria-label="结束周">${ALL_WEEKS.map(week=>`<option value="${week}" ${week===(selected.at(-1)||20) ? 'selected' : ''}>第 ${week} 周</option>`).join('')}</select><button type="button" class="secondary" data-week-range>选范围</button></div>`;
  }
  document.addEventListener('click',event=>{const button=event.target.closest('button'),container=button?.closest('.week-picker');if(!container)return;let weeks=readPicker(container),repeat=container.dataset.repeat||'all';if(button.dataset.weekToggle){const week=Number(button.dataset.weekToggle);weeks=weeks.includes(week) ? weeks.filter(item=>item!==week) : [...weeks,week];}else if(button.hasAttribute('data-week-all'))weeks=[...ALL_WEEKS];else if(button.hasAttribute('data-week-clear'))weeks=[];else if(button.hasAttribute('data-week-range')){const from=Number(container.querySelector('[data-week-from]').value),to=Number(container.querySelector('[data-week-to]').value);if(from>to){container.querySelector('[data-week-from]').focus();return;}weeks=ALL_WEEKS.filter(week=>week>=from&&week<=to);}else return;renderPicker(container,weeks,repeat);container.dispatchEvent(new CustomEvent('course-weeks-change',{bubbles:true}));});
  window.KejianSchedule={...api,readPicker,renderPicker};
})();

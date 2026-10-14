(function () {
  'use strict';
  const schedule=typeof module!=='undefined'&&module.exports ? require('./course-schedule.js') : window.KejianSchedule;
  const validTime=value=>typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function normalizeCourses(value=[]) {
    if(!Array.isArray(value)||value.length>1000)throw new Error('课程表格式不正确，最多 1000 门课程');
    const ids=new Set();
    return value.map(course=>{
      if(!course || typeof course.id!=='string' || !course.id || course.id.length>100 || ids.has(course.id) || !Number.isInteger(course.weekday)||course.weekday<1||course.weekday>7||!validTime(course.startTime)||!validTime(course.endTime)||course.startTime>=course.endTime)throw new Error('课程时间或编号不正确');
      ids.add(course.id);
      const repeat=course.repeat===undefined ? 'all' : course.repeat;if(!['all','odd','even'].includes(repeat))throw new Error('课程单双周设置不正确');
      for(const [field,max] of [['title',80],['location',120],['notes',500]])if(typeof course[field]!=='string'||course[field].length>max||(field!=='notes'&&!course[field].trim()))throw new Error('课程名称或地点不正确');
      const weeks=schedule.normalizeWeeks(course.weeks),adjustments=schedule.normalizeAdjustments(course.adjustments);if(!weeks.some(week=>schedule.matchesRepeat(week,repeat)))throw new Error('所选周次没有符合单双周规则的上课周');
      return {id:course.id,title:course.title.trim(),weekday:course.weekday,repeat,startTime:course.startTime,endTime:course.endTime,location:course.location.trim(),notes:course.notes.trim(),weeks,adjustments};
    });
  }
  const weekNumber=schedule.weekNumber,onDate=(course,value,start)=>schedule.occurrencesOnDate(course,value,start).length>0,overlaps=schedule.overlaps;
  if(typeof module!=='undefined'&&module.exports)module.exports={normalizeCourses,validTime,onDate,overlaps,weekNumber};
  if(typeof document==='undefined')return;
  const $=selector=>document.querySelector(selector),weekdays=['一','二','三','四','五','六','日'],pad=n=>String(n).padStart(2,'0');
  const key=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  let api,selected=key(new Date()),allMode=false,editingAdjustments=[];
  const coursesOnDate=value=>api.getCourses().flatMap(course=>schedule.occurrencesOnDate(course,value,api.getSemesterStart())).sort(schedule.compareCourses);
  function card(course,date=selected,compact=false,next=false) {
    const now=new Date(),time=`${pad(now.getHours())}:${pad(now.getMinutes())}`,today=date===key(now),active=today&&course._occurrenceDate===date&&time>=course.startTime&&time<course.endTime;
    const badge=active ? '<i></i>正在上课' : next ? '下一节课' : course._adjustment ? `${course._adjustment} · 周${weekdays[(new Date(date+'T12:00').getDay()+6)%7]}` : compact ? '课程' : '周'+weekdays[course.weekday-1];
    return `<article class="course-card ${active ? 'live' : next ? 'next-class' : ''}"><div class="course-time"><strong>${course.startTime}</strong><span>${course.endTime}</span></div><button type="button" class="course-body" data-course-edit="${api.escape(course.id)}"><div class="course-badge">${badge} · ${{all:'每周',odd:'单周',even:'双周'}[course.repeat||'all']}</div><h3>${api.escape(course.title)}</h3><p>${api.icon('pin')}${api.escape(course.location)}</p><div class="course-schedule-meta">${schedule.summary(course.weeks)}${course._adjustment ? ' · '+course._adjustment : ''}</div>${course.notes&&!compact ? `<small>${api.escape(course.notes)}</small>` : ''}</button><button class="icon-button course-edit" data-course-edit="${api.escape(course.id)}" aria-label="编辑${api.escape(course.title)}">${api.icon('right')}</button></article>`;
  }
  function render() {
    const date=new Date(selected+'T12:00'),monday=new Date(date);monday.setDate(date.getDate()-((date.getDay()+6)%7));
    let days='';
    for(let i=0;i<7;i++){const day=new Date(monday);day.setDate(monday.getDate()+i);const value=key(day);days+=`<button type="button" data-course-day="${value}" class="week-day ${selected===value ? 'selected' : ''} ${value===key(new Date()) ? 'today' : ''}" aria-pressed="${selected===value}" aria-label="${day.getMonth()+1}月${day.getDate()}日，周${weekdays[i]}"><span>${weekdays[i]}</span><strong>${day.getDate()}</strong><i class="${coursesOnDate(value).length ? 'has-course' : ''}"></i></button>`;}
    const classes=allMode ? [...api.getCourses()].sort(schedule.compareCourses) : coursesOnDate(selected),total=api.getCourses().length,week=weekNumber(selected,api.getSemesterStart());
    $('#main').innerHTML=`${api.heading('我的课程','每周的节奏，一目了然。')}<section class="timetable-panel"><div class="month-heading"><div><p class="eyebrow">WEEKLY ROUTINE</p><h2>${monday.getFullYear()} 年 ${monday.getMonth()+1} 月</h2></div><div class="month-actions"><button class="text-button" data-course-today>本周</button><button class="icon-button" data-course-week="-1" aria-label="上一周">${api.icon('left')}</button><button class="icon-button" data-course-week="1" aria-label="下一周">${api.icon('right')}</button></div></div><div class="week-strip">${days}</div><div class="timetable-summary"><span>每周 ${total} 门课程</span><span>今天 ${coursesOnDate(key(new Date())).length} 门</span></div></section><div class="section-heading"><div class="section-title"><span class="dot"></span><h3>${selected===key(new Date()) ? '今天' : `${date.getMonth()+1} 月 ${date.getDate()} 日`}的课程</h3><span class="count">${classes.length}</span></div><button class="text-button" data-course-add>+ 添加课程</button></div><div class="course-list">${classes.length ? classes.map(course=>card(course)).join('') : `<div class="empty-state"><div class="empty-icon">${api.icon('grid')}</div><h3>这一天，给自己留一点空闲</h3><p>记录课程、上课时间和教室，安排会在每周同一天重复。</p><button class="primary" data-course-add>${api.icon('plus')}添加课程</button></div>`}</div><p class="footer-note">带上书，也带上一点好心情。</p>`;
    $('.page-heading .date-badge').outerHTML=`<button class="primary plus-button" data-course-add aria-label="添加课程">${api.icon('plus')}</button>`;
    $('.timetable-summary').innerHTML=`<button class="text-button semester-link" data-semester-settings>${week>0 ? `第 ${week} 周 · ${week%2 ? '单周' : '双周'}` : '开学前'} ${api.icon('right')}</button><button class="text-button" data-course-all>${allMode ? '按日期查看' : `全部课程 · ${total}`}</button>`;
    $('.timetable-panel').insertAdjacentHTML('afterend',`<button class="semester-caption" data-semester-settings>第 1 周起始于 ${api.getSemesterStart().replaceAll('-',' / ')} · 点击修改</button>`);
    $('.timetable-panel').insertAdjacentHTML('beforebegin',`<button type="button" class="screenshot-import-banner" data-course-import><span class="import-banner-icon">${api.icon('upload')}</span><span><strong>从截图导入课表</strong><small>本地识别 · 校对后保存</small></span>${api.icon('right')}</button>`);
    $('.screenshot-import-banner').insertAdjacentHTML('afterend',`<button type="button" class="day-transfer-banner" data-day-transfer><span class="transfer-banner-icon">${api.icon('calendar')}</span><span><strong>批量调休</strong><small>选两个日期，整天课程一起调整</small></span>${api.icon('right')}</button>`);
    if(allMode)$('.section-heading h3').textContent='全部课程';
    $('.course-list').insertAdjacentHTML('beforebegin','<p class="course-sort-note">按开始时间从早到晚排列</p>');
  }
  function repeatButtons(){const form=$('#course-form'),value=form.elements.repeat.value,buttons=[...document.querySelectorAll('[data-course-repeat]')];buttons.forEach(button=>{const active=button.dataset.courseRepeat===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});$('#course-repeat').style.setProperty('--segment-count',3);$('#course-repeat').style.setProperty('--active-index',buttons.findIndex(button=>button.dataset.courseRepeat===value));}
  function renderAdjustments(){
    $('#course-adjustment-list').innerHTML=editingAdjustments.length ? editingAdjustments.map(item=>`<div class="adjustment-row"><button type="button" class="adjustment-row-body" data-adjustment-edit="${api.escape(item.id)}"><strong>${{cancel:'停课',move:'调课',extra:'加课'}[item.action]} · ${item.date.replaceAll('-',' / ')}${item.action==='move' ? ' → '+item.toDate.replaceAll('-',' / ') : ''}</strong>${item.action!=='cancel' ? `<small>${item.startTime}–${item.endTime} · ${api.escape(item.location||'沿用课程地点')}</small>` : '<small>这一天不显示这门课程</small>'}</button><button type="button" class="icon-button" data-adjustment-remove="${api.escape(item.id)}" aria-label="移除课程调整">${api.icon('close')}</button></div>`).join('') : '<p class="form-hint">法定节假日或学校调休时，可指定停课日期、调到其他日期，或临时加课。</p>';
  }
  function adjustmentAction(action){const form=$('#course-adjustment-form');form.elements.action.value=action;$('#adjustment-from-label').textContent=action==='extra' ? '加课日期' : '原上课日期';$('#adjustment-to-wrap').hidden=action!=='move';$('#adjustment-time-wrap').hidden=action==='cancel';for(const name of ['startTime','endTime','location'])form.elements[name].disabled=action==='cancel';$('#adjustment-description').textContent={cancel:'取消原本安排的这一次课程，其他周照常上课。',move:'将原日期的一次课程移到新日期，可同时修改时间和地点。',extra:'在学期第 1–20 周内添加一次课程，不受原上课日和单双周限制。'}[action];const buttons=[...document.querySelectorAll('[data-adjustment-kind]')];buttons.forEach(button=>{button.classList.toggle('active',button.dataset.adjustmentKind===action);button.setAttribute('aria-pressed',String(button.dataset.adjustmentKind===action));});$('.adjustment-type').style.setProperty('--segment-count',3);$('.adjustment-type').style.setProperty('--active-index',buttons.findIndex(button=>button.dataset.adjustmentKind===action));}
  function openAdjustment(item=null,action='cancel'){
    const form=$('#course-adjustment-form'),parent=$('#course-form'),candidate={weekday:Number(parent.elements.weekday.value),repeat:parent.elements.repeat.value,weeks:schedule.readPicker($('#course-weeks'))},first=Date.parse(api.getSemesterStart()+'T12:00Z'),baseDates=Array.from({length:140},(_,day)=>new Date(first+day*86400000).toISOString().slice(0,10)).filter(value=>schedule.baseOnDate(candidate,value,api.getSemesterStart())),date=baseDates.find(value=>value>=selected)||baseDates[0]||selected;
    form.reset();form.elements.id.value=item?.id||'';form.elements.fromDate.value=item?.date||date;form.elements.toDate.value=item?.toDate||date;form.elements.startTime.value=item?.startTime||parent.elements.startTime.value;form.elements.endTime.value=item?.endTime||parent.elements.endTime.value;form.elements.location.value=item?.location||'';adjustmentAction(item?.action||action);window.KejianDatePicker.refresh(form);window.KejianMotion.open($('#course-adjustment-dialog'));
  }
  function weekdayButtons() {const selectedDay=Number($('#course-form').elements.weekday.value);$('#course-weekdays').innerHTML=weekdays.map((day,index)=>`<button type="button" data-course-weekday="${index+1}" class="${selectedDay===index+1 ? 'active' : ''}" aria-pressed="${selectedDay===index+1}">${day}</button>`).join('');}
  function open(course=null,date=selected) {
    const form=$('#course-form');form.reset();form.elements.id.value=course?.id||'';form.elements.weekday.value=course?.weekday||(new Date(date+'T12:00').getDay()||7);
    if(course)for(const field of ['title','startTime','endTime','location','notes'])form.elements[field].value=course[field];form.elements.repeat.value=course?.repeat||'all';
    editingAdjustments=structuredClone(course?.adjustments||[]);schedule.renderPicker($('#course-weeks'),course?.weeks||schedule.ALL_WEEKS,form.elements.repeat.value);renderAdjustments();
    $('#course-form-title').textContent=course ? '编辑课程' : '添加课程';$('#course-delete').hidden=!course;weekdayButtons();repeatButtons();updateConflict();window.KejianMotion.open($('#course-dialog'));
  }
  function updateConflict() {
    if(!api)return;const form=$('#course-form'),candidate={weekday:Number(form.elements.weekday.value),repeat:form.elements.repeat.value,startTime:form.elements.startTime.value,endTime:form.elements.endTime.value,weeks:schedule.readPicker($('#course-weeks')),adjustments:editingAdjustments};
    const other=api.getCourses().find(course=>course.id!==form.elements.id.value&&schedule.schedulesOverlap(course,candidate,api.getSemesterStart()));$('#course-conflict').textContent=other ? `与“${other.title}”的时段重叠，请确认安排。` : '按所选周次、单双周与临时调整显示在首页和日历中。';$('#course-conflict').classList.toggle('conflict',Boolean(other));
  }
  document.addEventListener('click',event=>{
    if(!api)return;const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-course-add'))open();
    if(button.dataset.courseEdit){const course=api.getCourses().find(item=>item.id===button.dataset.courseEdit);if(course)open(course);}
    if(button.dataset.courseDay){selected=button.dataset.courseDay;allMode=false;api.render(true);}
    if(button.dataset.courseWeek){const date=new Date(selected+'T12:00');date.setDate(date.getDate()+Number(button.dataset.courseWeek)*7);selected=key(date);allMode=false;api.render(true);}
    if(button.hasAttribute('data-course-today')){selected=key(new Date());allMode=false;api.render(true);}
    if(button.hasAttribute('data-course-all')){allMode=!allMode;api.render(true);}
    if(button.hasAttribute('data-semester-settings')){$('#semester-form').elements.semesterStart.value=api.getSemesterStart();window.KejianDatePicker.refresh($('#semester-form'));window.KejianMotion.open($('#semester-dialog'));}
    if(button.dataset.courseWeekday){$('#course-form').elements.weekday.value=button.dataset.courseWeekday;weekdayButtons();updateConflict();}
    if(button.dataset.courseRepeat){$('#course-form').elements.repeat.value=button.dataset.courseRepeat;schedule.renderPicker($('#course-weeks'),schedule.readPicker($('#course-weeks')),button.dataset.courseRepeat);repeatButtons();updateConflict();}
    if(button.dataset.adjustmentAdd)openAdjustment(null,button.dataset.adjustmentAdd);
    if(button.dataset.adjustmentEdit)openAdjustment(editingAdjustments.find(item=>item.id===button.dataset.adjustmentEdit));
    if(button.dataset.adjustmentRemove){editingAdjustments=editingAdjustments.filter(item=>item.id!==button.dataset.adjustmentRemove);renderAdjustments();updateConflict();}
    if(button.dataset.adjustmentKind)adjustmentAction(button.dataset.adjustmentKind);
  });
  $('#course-form').addEventListener('input',updateConflict);
  $('#course-form').addEventListener('course-weeks-change',updateConflict);
  $('#course-adjustment-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.currentTarget,parent=$('#course-form'),action=form.elements.action.value,date=form.elements.fromDate.value,id=form.elements.id.value||(crypto.randomUUID?.()||'adjustment-'+Date.now()+'-'+Math.random().toString(36).slice(2)),item={id,action,date,toDate:action==='move' ? form.elements.toDate.value : '',startTime:action==='cancel' ? '' : form.elements.startTime.value,endTime:action==='cancel' ? '' : form.elements.endTime.value,location:action==='cancel' ? '' : form.elements.location.value};
    const candidate={weekday:Number(parent.elements.weekday.value),repeat:parent.elements.repeat.value,weeks:schedule.readPicker($('#course-weeks'))},target=action==='move' ? item.toDate : date,week=weekNumber(target,api.getSemesterStart());
    if(action!=='extra'&&!schedule.baseOnDate(candidate,date,api.getSemesterStart())){api.toast('原日期不在这门课程的上课日与所选周次内');return;}if(!Number.isFinite(week)||week<1||week>20){api.toast('请在学期第 1–20 周内安排课程');return;}
    try{editingAdjustments=schedule.normalizeAdjustments([...editingAdjustments.filter(value=>value.id!==id),item]);}catch(error){api.toast(error.message);return;}
    window.KejianMotion.close($('#course-adjustment-dialog'));renderAdjustments();updateConflict();api.toast('调整已加入，保存课程后生效');
  });
  $('#course-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.currentTarget,id=form.elements.id.value;let course={id:id||(crypto.randomUUID?.()||`course-${Date.now()}-${Math.random().toString(36).slice(2)}`),title:form.elements.title.value.trim(),weekday:Number(form.elements.weekday.value),repeat:form.elements.repeat.value,startTime:form.elements.startTime.value,endTime:form.elements.endTime.value,location:form.elements.location.value.trim(),notes:form.elements.notes.value.trim(),weeks:schedule.readPicker($('#course-weeks')),adjustments:editingAdjustments};
    try{course=normalizeCourses([course])[0];}catch(error){api.toast(error.message);return;}
    const courses=api.getCourses();if(!id&&courses.length>=1000){api.toast('最多保存 1000 门课程');return;}
    const success=api.setCourses(id ? courses.map(item=>item.id===id ? course : item) : [...courses,course]);if(success===false)return;const first=Date.parse(api.getSemesterStart()+'T12:00Z'),dates=Array.from({length:140},(_,day)=>new Date(first+day*86400000).toISOString().slice(0,10)).filter(value=>onDate(course,value,api.getSemesterStart()));const anchor=new Date(selected+'T12:00');anchor.setDate(anchor.getDate()-((anchor.getDay()+6)%7));selected=dates.find(value=>value>=key(anchor))||dates.at(-1)||selected;allMode=!dates.length;window.KejianMotion.close($('#course-dialog'));api.render();api.toast(id ? '课程已更新' : '已加入课程表');
  });
  $('#course-delete').addEventListener('click',()=>{const id=$('#course-form').elements.id.value;api.confirm('删除这门课程？','这门课程将从每周课程表与日历中移除。',()=>{if(api.setCourses(api.getCourses().filter(course=>course.id!==id))===false)return;window.KejianMotion.close($('#course-dialog'));api.render();api.toast('课程已删除');});});
  $('#semester-form').addEventListener('submit',event=>{event.preventDefault();if(api.setSemesterStart(event.currentTarget.elements.semesterStart.value)===false)return;window.KejianMotion.close($('#semester-dialog'));api.render();api.toast('学期周次已更新');});
  window.KejianTimetable={init(options){api=options;},render,coursesOnDate,card,normalizeCourses};
})();

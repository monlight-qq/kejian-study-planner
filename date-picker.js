(function () {
  'use strict';
  const $=selector=>document.querySelector(selector), pad=value=>String(value).padStart(2,'0');
  const key=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const weekdays=['周日','周一','周二','周三','周四','周五','周六'];
  const label=value=>{const date=new Date(value+'T12:00');return `${date.getFullYear()} / ${pad(date.getMonth()+1)} / ${pad(date.getDate())}`;};
  let target='startDate',picked=key(new Date()),month=new Date(),origin,activeForm;
  function refresh(form=$('#entry-form')) {
    if(!form)return;
    for(const name of ['startDate','date','semesterStart','fromDate','toDate']) {
      if(!form.elements[name])continue;
      const value=form.elements[name].value.slice(0,10),display=form.querySelector(`[data-date-display="${name}"]`),day=form.querySelector(`[data-date-weekday="${name}"]`);
      if(!display)continue;
      display.textContent=value ? label(value) : '选择日期';day.textContent=value ? weekdays[new Date(value+'T12:00').getDay()] : '轻触打开月历';
    }
    if(form.elements.date?.value && form.elements.endTime)form.elements.endTime.value=form.elements.date.value.slice(11,16);
  }
  function render(focusDay=false) {
    const first=new Date(month.getFullYear(),month.getMonth(),1),start=new Date(first),offset=(first.getDay()+6)%7;start.setDate(1-offset);
    const selected=new Date(picked+'T12:00'),today=key(new Date());
    let cells='';
    for(let i=0;i<42;i++) {const date=new Date(start);date.setDate(start.getDate()+i);const value=key(date);cells+=`<button type="button" data-picker-day="${value}" class="picker-day ${date.getMonth()!==month.getMonth() ? 'other' : ''} ${value===picked ? 'selected' : ''} ${value===today ? 'today' : ''}" aria-label="${label(value)} ${weekdays[date.getDay()]}" aria-pressed="${value===picked}" tabindex="${value===picked ? 0 : -1}">${date.getDate()}</button>`;}
    const years=new Set([selected.getFullYear(),month.getFullYear()]);for(let year=new Date().getFullYear()-20;year<=new Date().getFullYear()+30;year++)years.add(year);
    $('#date-picker-content').innerHTML=`<div class="picker-selection"><span>已选择</span><strong>${label(picked)}</strong><small>${weekdays[selected.getDay()]}</small></div><div class="picker-month-controls"><button type="button" class="icon-button" data-picker-month="-1" aria-label="上一个月">‹</button><div><select id="picker-year" aria-label="年份">${[...years].sort((a,b)=>a-b).map(year=>`<option value="${year}" ${year===month.getFullYear() ? 'selected' : ''}>${year} 年</option>`).join('')}</select><select id="picker-month" aria-label="月份">${Array.from({length:12},(_,i)=>`<option value="${i}" ${i===month.getMonth() ? 'selected' : ''}>${i+1} 月</option>`).join('')}</select></div><button type="button" class="icon-button" data-picker-month="1" aria-label="下一个月">›</button></div><div class="weekdays">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="picker-grid" role="group" aria-label="选择日期">${cells}</div>`;
    if(focusDay)$(`[data-picker-day="${picked}"]`)?.focus();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.dateTarget){origin=button;activeForm=button.closest('form');target=button.dataset.dateTarget;picked=activeForm.elements[target].value.slice(0,10)||key(new Date());const date=new Date(picked+'T12:00');month=new Date(date.getFullYear(),date.getMonth(),1);$('#date-picker-title').textContent=activeForm.id==='day-transfer-form' ? (target==='fromDate' ? '选择调休前日期' : '选择调休后日期') : activeForm.elements.kind?.value==='activity' ? '选择活动日期' : target==='semesterStart' ? '学期第 1 周' : target==='startDate' ? '选择开始日期' : target==='fromDate'||target==='toDate' ? '选择上课日期' : '选择结束日期';render();window.KejianMotion.open($('#date-picker-dialog'));}
    if(button.dataset.pickerDay){picked=button.dataset.pickerDay;const date=new Date(picked+'T12:00');month=new Date(date.getFullYear(),date.getMonth(),1);render(true);}
    if(button.dataset.pickerMonth){const next=new Date(month.getFullYear(),month.getMonth()+Number(button.dataset.pickerMonth),1);if(next.getFullYear()<100 || next.getFullYear()>9999)return;month=next;render();}
  });
  $('#date-picker-content').addEventListener('change',event=>{if(['picker-year','picker-month'].includes(event.target.id)){month=new Date(Number($('#picker-year').value),Number($('#picker-month').value),1);render();}});
  $('#date-picker-content').addEventListener('keydown',event=>{
    if(!event.target.dataset.pickerDay)return;
    const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if(event.key in steps){event.preventDefault();const date=new Date(event.target.dataset.pickerDay+'T12:00');date.setDate(date.getDate()+steps[event.key]);picked=key(date);month=new Date(date.getFullYear(),date.getMonth(),1);render(true);}
  });
  $('#picker-today').addEventListener('click',()=>{picked=key(new Date());const date=new Date();month=new Date(date.getFullYear(),date.getMonth(),1);render(true);});
  $('#picker-confirm').addEventListener('click',()=>{
    const form=activeForm,time=form.elements.endTime?.value||'18:00';
    if(target==='fromDate'||target==='toDate')form.elements[target].value=picked;
    else if(target==='semesterStart'){const date=new Date(picked+'T12:00');date.setDate(date.getDate()-((date.getDay()+6)%7));form.elements.semesterStart.value=key(date);}
    else if(target==='startDate'){form.elements.startDate.value=picked;if(picked>form.elements.date.value.slice(0,10))form.elements.date.value=picked+'T'+time;}
    else {form.elements.date.value=picked+'T'+time;if(picked<form.elements.startDate.value)form.elements.startDate.value=picked;}
    refresh(form);form.dispatchEvent(new CustomEvent('kejian-dates-change'));window.KejianMotion.close($('#date-picker-dialog'));origin?.focus();
  });
  $('#entry-form').addEventListener('input',event=>{if(event.target.name==='endTime' && event.target.value){const form=event.currentTarget;form.elements.date.value=(form.elements.date.value.slice(0,10)||key(new Date()))+'T'+event.target.value;refresh(form);}});
  $('#entry-form').addEventListener('change',event=>{if(['date','startDate'].includes(event.target.name))refresh(event.currentTarget);});
  window.KejianDatePicker={refresh};
})();

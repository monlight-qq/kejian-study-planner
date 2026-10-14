(function () {
  'use strict';
  const KEY = 'kejian-planner-v1';
  const pad = n => String(n).padStart(2, '0');
  const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const localDateTime = date => `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const daysUntil = (value, now = new Date()) => dayNumber(new Date(value)) - dayNumber(now);
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime()) && localDateTime(new Date(value)) === value;
  }
  function validStartDate(value) {return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(`${value}T12:00`);}
  function reminderTime(value,hours=6) {return new Date(value).getTime()-hours*3600000;}
  function reminderTimes(value) {return [6,3].map(hours=>reminderTime(value,hours));}
  const planOnDate=(entry,value)=>entry.kind==='activity' ? value===entry.date.slice(0,10) : entry.startDate ? value>=entry.startDate && value<=entry.date.slice(0,10) : value===entry.date.slice(0,10);
  function mondayKey(value=dateKey(new Date())) {const date=new Date(value+'T12:00');date.setDate(date.getDate()-((date.getDay()+6)%7));return dateKey(date);}
  function normalizeSemester(value) {if(value===undefined)return undefined;if(!validStartDate(value)||mondayKey(value)!==value)throw new Error('学期第一周必须从有效的周一开始');return value;}
  function normalizeCourses(value) {return typeof module!=='undefined' && module.exports ? require('./timetable.js').normalizeCourses(value) : window.KejianTimetable.normalizeCourses(value);}
  function normalizeBackup(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 5000) throw new Error('备份格式不正确，或超过 5000 条记录');
    const ids = new Set();
    return data.entries.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !entry.id || entry.id.length > 100 || ids.has(entry.id) || !['homework','exam','activity'].includes(entry.kind) || !validDate(entry.date) || typeof entry.done !== 'boolean') throw new Error('备份中有无效记录');
      ids.add(entry.id);
      const startDate = entry.startDate === undefined ? '' : entry.startDate;
      if(typeof startDate !== 'string' || startDate && (!validStartDate(startDate) || startDate > entry.date.slice(0,10)))throw new Error('开始日期无效或晚于截止 / 考试日期');
      const reminder = entry.reminder === undefined ? !entry.id.startsWith('demo-') : entry.reminder;
      if(typeof reminder !== 'boolean')throw new Error('提醒设置格式不正确');
      for (const [key, limit] of [['subject',40],['title',120],['notes',1000]]) if (typeof entry[key] !== 'string' || entry[key].length > limit || (key !== 'notes' && !entry[key].trim())) throw new Error('备份文字内容不正确');
      if (!['low','normal','high'].includes(entry.priority) || !Array.isArray(entry.chapters) || entry.chapters.length > 100) throw new Error('备份计划内容不正确');
      let total = 0;
      const chapters = entry.chapters.map(chapter => {
        if (!chapter || typeof chapter.title !== 'string' || !chapter.title.trim() || chapter.title.length > 3000 || typeof chapter.done !== 'boolean') throw new Error('复习项目格式不正确');
        total += chapter.title.length;
        return {title:chapter.title,done:chapter.done};
      });
      if (total + Math.max(0, chapters.length - 1) > 3000) throw new Error('复习范围过长');
      return {id:entry.id,kind:entry.kind,subject:entry.subject.trim(),title:entry.title.trim(),date:entry.date,startDate:entry.kind==='activity' ? entry.date.slice(0,10) : startDate,reminder,done:entry.done,priority:entry.priority,notes:entry.notes,chapters};
    });
  }
  const sortEntries = entries => [...entries].sort((a,b) => new Date(a.date) - new Date(b.date) || ({high:0,normal:1,low:2}[a.priority] - {high:0,normal:1,low:2}[b.priority]) || a.title.localeCompare(b.title));
  const progress = entry => entry.chapters.length ? Math.round(entry.chapters.filter(item => item.done).length / entry.chapters.length * 100) : 0;
  if (typeof module !== 'undefined' && module.exports) module.exports = {validDate,validStartDate,reminderTime,reminderTimes,normalizeBackup,normalizeCourses,planOnDate,daysUntil,dateKey,localDateTime,sortEntries,progress,escapeHTML};
  if (typeof document === 'undefined') return;

  const $ = selector => document.querySelector(selector);
  const icons = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15"/><path d="M6 8h3m6 0h3M6 12h3m6 0h3"/>',
    spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4zM20 2v4m-2-2h4"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
    settings:'<path d="m9 3-1 3-3 1-1 3 2 2-1 3 2 2 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-2-2-3 1-2-2z"/><circle cx="12" cy="11" r="3"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    left:'<path d="m14 6-6 6 6 6"/>',
    right:'<path d="m10 6 6 6-6 6"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/>',
    edit:'<path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15z"/>',
    trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    moon:'<path d="M20.5 13A9 9 0 0 1 11 3.5a9 9 0 1 0 9.5 9.5z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    flag:'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
  const hydrateIcons = (scope = document) => scope.querySelectorAll('[data-icon]').forEach(element => {element.innerHTML = icon(element.dataset.icon);});
  let entries = [], courses = [], semesterStart=mondayKey(), storageOK = true, corruptBackup = false, installPrompt = null;
  let page = 'home', filter = 'pending', examFilter = 'upcoming', activityFilter='pending', query = '', selectedDate = dateKey(new Date()), month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let toastTimer, confirmCallback;
  const pageOrder=['home','homework','review','timetable','calendar'],scrollPositions={};
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) { try {const data=JSON.parse(stored);entries = normalizeBackup(data);courses=normalizeCourses(data.courses);semesterStart=normalizeSemester(data.semesterStart)||semesterStart;} catch {corruptBackup = true;storageOK = false;} }
  } catch {storageOK = false;}
  function save() {
    if (corruptBackup) { toast('旧数据无法读取，请先导出原始备份，再清空恢复'); return false; }
    try {localStorage.setItem(KEY, JSON.stringify({version:1,entries,courses,semesterStart})); storageOK = true;} catch {storageOK = false;}
    $('#storage-warning').hidden = storageOK;
    if(storageOK)syncReminders();
    return storageOK;
  }
  function toast(message) { clearTimeout(toastTimer); const element = $('#toast'); element.textContent = message; if(element.showPopover && !element.matches(':popover-open'))element.showPopover();element.classList.add('visible'); toastTimer = setTimeout(() => {element.classList.remove('visible');if(element.hidePopover && element.matches(':popover-open'))element.hidePopover();}, 3200); }
  function notifySave(message) {toast(save() ? message : '已在本次会话更新，请导出备份保存');}
  function openDialog(id) {window.KejianMotion.open(document.getElementById(id));updateSegmentIndicators();}
  function updateSegmentIndicators(previous=[]) {const targets=[...document.querySelectorAll('.segmented')].map((element,index)=>{const buttons=[...element.querySelectorAll('button')],active=Math.max(0,buttons.findIndex(button=>button.classList.contains('active')));element.style.setProperty('--segment-count',buttons.length);element.style.setProperty('--active-index',previous[index]??active);return {element,active};});if(previous.length)document.body.offsetWidth;targets.forEach(({element,active})=>element.style.setProperty('--active-index',active));}
  function confirmAction(title, description, callback) {
    $('#confirm-title').textContent = title; $('#confirm-description').textContent = description; confirmCallback = callback; openDialog('confirm-dialog');
  }
  function subjectBadge(entry) {let hash = 0;for (const character of entry.subject) hash += character.charCodeAt(0);return `<span class="subject" data-color="${hash % 5}">${escapeHTML(entry.subject)}</span>`;}
  function dateLabel(value, withYear = false) {const date = new Date(value);return `${withYear ? date.getFullYear() + ' 年 ' : ''}${date.getMonth()+1} 月 ${date.getDate()} 日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;}
  function startLabel(entry) {return entry.startDate ? dateLabel(`${entry.startDate}T12:00`,true).replace(' 12:00','') : '未设置';}
  function reminderDescription(entry) {return entry.reminder===false ? '已关闭提前提醒' : entry.done ? `${entry.kind==='activity' ? '活动已结束' : '已完成'}，提醒已取消` : reminderTimes(entry.date).map((time,index)=>`提前 ${index===0 ? 6 : 3} 小时 · ${dateLabel(new Date(time),true)}`).join('<br>');}
  function decorateStartDates(scope=$('#main')) {
    scope.querySelectorAll('[data-detail]').forEach(button=>{const entry=entries.find(item=>item.id===button.dataset.detail),title=button.querySelector('.task-title');if(entry?.startDate && title && !button.querySelector('.start-meta'))title.insertAdjacentHTML('afterend',`<div class="task-meta start-meta">${icon('calendar')}${entry.kind==='exam' ? '开始复习' : '开始'} · ${startLabel(entry)}</div>`);});
  }
  const eventsOnDate = value => entries.filter(entry=>planOnDate(entry,value));
  function refreshReminderStatus() {
    if(!window.KejianNative?.reminderStatus)return;
    try {const status=JSON.parse(window.KejianNative.reminderStatus());$('#native-reminder-actions').hidden=false;$('#notification-permission-button').textContent=status.notifications ? '通知设置' : '开启通知';$('#exact-alarm-button').hidden=status.exact;$('#reminder-status').textContent=status.notifications ? `${status.count} 项待提醒 · ${status.exact ? '准时提醒已开启' : '系统可能延后提醒，可开启准时提醒'}${status.next ? `。下一次：${dateLabel(new Date(status.next),true)}` : '。'}` : '通知尚未开启。允许手机通知后，才能在应用关闭时收到提醒。';}catch{toast('无法读取手机提醒状态');}
  }
  function syncReminders() {
    if(!window.KejianNative?.syncReminders || corruptBackup)return;
    try {window.KejianNative.syncReminders(JSON.stringify({version:1,entries}));refreshReminderStatus();}catch{toast('提醒同步失败，请重新打开应用');}
  }
  window.kejianRefreshReminderStatus=refreshReminderStatus;
  function deadline(entry) {
    if(entry.done)return {label:entry.kind === 'exam' ? '已结束' : '已完成',style:'finished'};
    const now = new Date(), date = new Date(entry.date), days = daysUntil(entry.date, now);
    if(date <= now) return {label:entry.kind === 'exam' ? '已到考期' : '已逾期',style:'overdue'};
    if(days === 0)return {label:'今天',style:'urgent'};
    if(days === 1)return {label:'明天',style:'urgent'};
    return {label:days === 2 ? '后天' : `${days} 天后`,style:days < 3 ? 'urgent' : ''};
  }
  function homeworkCard(entry) {
    const status = deadline(entry);
    return `<article class="task-card ${entry.done ? 'done' : ''}"><button class="check-button ${entry.done ? 'checked' : ''}" data-toggle="${escapeHTML(entry.id)}" aria-label="${entry.done ? '恢复待完成' : '标记已完成'}：${escapeHTML(entry.title)}" aria-pressed="${entry.done}">${entry.done ? icon('check') : ''}</button><button class="task-body" data-detail="${escapeHTML(entry.id)}"><div class="task-top">${subjectBadge(entry)}${entry.priority === 'high' ? '<span class="priority-dot">· 优先完成</span>' : ''}</div><div class="task-title">${escapeHTML(entry.title)}</div><div class="task-meta">${icon('clock')}${dateLabel(entry.date, new Date(entry.date).getFullYear() !== new Date().getFullYear())}</div></button><span class="deadline-tag ${status.style}">${status.label}</span></article>`;
  }
  function examCard(entry) {
    const days = daysUntil(entry.date), future = new Date(entry.date) > new Date() && !entry.done;
    return `<article class="exam-card"><button class="card-click-area" data-detail="${escapeHTML(entry.id)}" aria-label="查看${escapeHTML(entry.subject)}复习计划"><div class="exam-card-header"><span class="exam-symbol">${icon('spark')}</span><span class="exam-countdown ${future ? '' : 'past'}">${future ? '距离考试' : '考试安排'}<strong>${future ? `${days}<small> 天</small>` : entry.done ? '已结束' : '已到考期'}</strong></span></div><div class="task-top" style="margin-top:13px">${subjectBadge(entry)}</div><h3 class="task-title">${escapeHTML(entry.title)}</h3><p class="task-meta">${icon('calendar')}${dateLabel(entry.date, new Date(entry.date).getFullYear() !== new Date().getFullYear())}</p><div class="progress-header"><span>复习进度 · ${entry.chapters.filter(chapter => chapter.done).length} / ${entry.chapters.length} 项</span><span>${progress(entry)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress(entry)}%"></div></div><div class="exam-footer"><span>${entry.chapters.length ? '一点点进步，都算数' : '添加复习范围，开始准备'}</span>${icon('arrow')}</div></button></article>`;
  }
  function activityCard(entry){const date=new Date(entry.date),past=date<=new Date(),today=entry.date.slice(0,10)===dateKey(new Date());return `<article class="activity-card ${entry.done ? 'done' : ''}"><span class="activity-date-mark"><strong>${date.getDate()}</strong><small>${date.getMonth()+1} 月</small></span><button type="button" class="activity-body" data-detail="${escapeHTML(entry.id)}"><div class="activity-label">活动 · ${entry.done ? '已结束' : today ? '今天' : past ? '已到时间' : daysUntil(entry.date)+' 天后'}</div><h3>${escapeHTML(entry.title)}</h3><p>${icon('clock')}${pad(date.getHours())}:${pad(date.getMinutes())}${date.getFullYear()!==new Date().getFullYear() ? ' · '+date.getFullYear()+' 年' : ''}</p></button><button type="button" class="icon-button" data-detail="${escapeHTML(entry.id)}" aria-label="查看活动${escapeHTML(entry.title)}">${icon('right')}</button></article>`;}
  function activitiesSection(){const matching=sortEntries(entries.filter(entry=>entry.kind==='activity'&&(activityFilter==='all'||entry.done===(activityFilter==='done'))));return `<section class="activities-section"><div class="section-heading"><div class="section-title"><span class="dot"></span><h3>活动安排</h3><span class="count">${matching.length}</span></div><button type="button" class="text-button" data-add="activity">+ 添加活动</button></div>${entries.some(entry=>entry.kind==='activity') ? `<div class="segmented activity-filter"><button type="button" data-activity-filter="pending" class="${activityFilter==='pending' ? 'active' : ''}">待参加</button><button type="button" data-activity-filter="done" class="${activityFilter==='done' ? 'active' : ''}">已结束</button><button type="button" data-activity-filter="all" class="${activityFilter==='all' ? 'active' : ''}">全部</button></div>` : ''}<div class="activity-list">${matching.length ? matching.map(activityCard).join('') : `<button type="button" class="activity-empty" data-add="activity"><span>${icon('calendar')}</span><span><strong>${activityFilter==='done' ? '还没有已结束的活动' : '给生活，也留一点安排'}</strong><small>记录讲座、社团、比赛与其他活动</small></span>${icon('plus')}</button>`}</div></section>`;}
  function empty(title, description, kind) {return `<div class="empty-state"><div class="empty-icon">${icon(kind === 'exam' ? 'spark' : 'book')}</div><h3>${title}</h3><p>${description}</p>${kind ? `<button class="text-button" data-add="${kind}">+ ${kind === 'exam' ? '添加复习 / 考试' : '记一项作业'}</button>` : ''}</div>`;}
  function heading(title, subtitle, kind) {return `<div class="page-heading"><div><p class="eyebrow">课间 · 学习手账</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${kind ? `<button class="primary plus-button" data-add="${kind}" aria-label="${kind === 'exam' ? '添加复习 / 考试' : '添加作业'}">${icon('plus')}</button>` : `<span class="date-badge">${new Date().getMonth()+1} 月 ${new Date().getDate()} 日</span>`}</div>`;}
  function renderHome() {
    const unfinished = sortEntries(entries.filter(entry => entry.kind === 'homework' && !entry.done));
    const exams = sortEntries(entries.filter(entry => entry.kind === 'exam' && !entry.done && new Date(entry.date) > new Date()));
    const weekCount = exams.filter(entry => daysUntil(entry.date) <= 7).length;
    const completed = entries.filter(entry => entry.kind === 'homework' && entry.done).length;
    const overdue = unfinished.filter(entry => new Date(entry.date) <= new Date()).length;
    const hour = new Date().getHours();
    $('#main').innerHTML = `${heading(hour < 12 ? '早上好，同学' : hour < 18 ? '下午好，同学' : '晚上好，同学','新的一天，按自己的节奏来。')}<section class="hero"><div class="hero-content"><p class="eyebrow">留一点时间，给重要的事</p><h2>把计划写下来，<br>让学习慢慢来。</h2><p>${overdue ? `有 ${overdue} 项作业已逾期，先安排最紧急的。` : unfinished.length ? `还有 ${unfinished.length} 项作业，一件件完成就好。` : '从一份作业、一次复习开始。'}</p><button class="hero-action" data-add="homework">记下新作业 ${icon('arrow')}</button></div><div class="hero-art" aria-hidden="true"><div class="art-star">✦</div><div class="art-paper"><div class="art-line"></div><div class="art-line"></div><div class="art-line"></div><span class="art-tick">${icon('check')}</span></div><div class="art-pencil"></div></div></section><div class="stats"><a class="stat" href="#homework"><span class="stat-top">${icon('book')}待完成作业</span><span class="stat-value">${unfinished.length}<small>项</small></span></a><a class="stat" href="#review"><span class="stat-top">${icon('calendar')}未来七天考试</span><span class="stat-value">${weekCount}<small>场</small></span></a><a class="stat" href="#homework" data-show-completed><span class="stat-top">${icon('check')}累计已完成</span><span class="stat-value">${completed}<small>项</small></span></a></div><div class="section-heading"><div class="section-title"><span class="dot"></span><h3>接下来要做</h3><span class="count">${unfinished.length}</span></div><a class="text-button" href="#homework">全部作业 →</a></div><div class="task-list">${unfinished.length ? unfinished.slice(0,3).map(homeworkCard).join('') : empty('今天的空间，留给你','还没有待完成的作业。记下截止时间，就不用总惦记着。','homework')}</div><div class="section-heading"><div class="section-title"><span class="dot" style="background:#a8bdad"></span><h3>下一场考试</h3></div><a class="text-button" href="#review">复习计划 →</a></div>${exams.length ? examCard(exams[0]) : empty('提前一点，安心一点','记录考试时间，把复习拆成小小的步骤。','exam')}<button class="add-banner" data-add="exam"><span><strong>给下一次考试，留一点准备时间</strong><small>添加科目与复习计划</small></span>${icon('plus')}</button><p class="footer-note">慢慢来，每一步都在向前。</p>`;
  }
  function renderHomework() {
    const matching = entries.filter(entry => entry.kind === 'homework' && (filter === 'all' || entry.done === (filter === 'done')) && `${entry.subject} ${entry.title} ${entry.notes}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    $('#main').innerHTML = `${heading('作业清单','记好截止时间，给每件事留出空间。','homework')}<div class="segmented"><button class="${filter === 'pending' ? 'active' : ''}" data-filter="pending">待完成</button><button class="${filter === 'done' ? 'active' : ''}" data-filter="done">已完成</button><button class="${filter === 'all' ? 'active' : ''}" data-filter="all">全部</button></div><div class="search-field">${icon('search')}<input id="search-input" type="search" placeholder="搜索科目或作业…" aria-label="搜索科目或作业" value="${escapeHTML(query)}"></div><div class="list-note"><span>按截止时间排序</span><span id="result-count">${matching.length} 项作业</span></div><div id="homework-results" class="task-list">${renderHomeworkResults(matching)}</div><p class="footer-note">完成一件，就轻松一点。</p>`;
  }
  function renderHomeworkResults(matching) {return matching.length ? sortEntries(matching).map(homeworkCard).join('') : query ? empty('没有找到这项作业','换个关键词再试试。') : filter === 'done' ? empty('你的每一次完成，都会留在这里','勾选作业前的方框，把努力记下来。') : empty('清单还是空的','先记下第一份作业，截止时间也一起。','homework');}
  function updateSearch() {
    const matching = entries.filter(entry => entry.kind === 'homework' && (filter === 'all' || entry.done === (filter === 'done')) && `${entry.subject} ${entry.title} ${entry.notes}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    $('#homework-results').innerHTML = renderHomeworkResults(matching); $('#result-count').textContent = `${matching.length} 项作业`;decorateStartDates();
  }
  function renderReview() {
    const matching = entries.filter(entry => entry.kind === 'exam' && (examFilter === 'all' || (examFilter === 'done' ? entry.done : !entry.done)));
    $('#main').innerHTML = `${heading('复习计划','把大目标，拆成每天的小进步。','exam')}<div class="segmented"><button data-exam-filter="upcoming" class="${examFilter === 'upcoming' ? 'active' : ''}">准备中</button><button data-exam-filter="done" class="${examFilter === 'done' ? 'active' : ''}">已结束</button><button data-exam-filter="all" class="${examFilter === 'all' ? 'active' : ''}">全部</button></div><div class="list-note"><span>按考试时间排序</span><span>${matching.length} 个计划</span></div><div class="result-list">${matching.length ? sortEntries(matching).map(examCard).join('') : empty(examFilter === 'done' ? '每一场考试，都是一次成长' : '下次考试，从这里开始',examFilter === 'done' ? '在考试详情中标记结束，保存这段努力。' : '记下考试时间和复习范围，进度会随着你的勾选更新。',examFilter === 'done' ? null : 'exam')}</div><p class="footer-note">日积月累的努力，会有答案。</p>`;
  }
  function renderCalendar() {
    const first = new Date(month.getFullYear(),month.getMonth(),1), offset = (first.getDay()+6)%7;
    const start = new Date(first); start.setDate(1-offset);
    let cells = '';
    for(let i=0;i<42;i++) {
      const date = new Date(start);date.setDate(start.getDate()+i); const key = dateKey(date), events = eventsOnDate(key),classesOnDay=window.KejianTimetable.coursesOnDate(key);
      const classes = [date.getMonth() !== month.getMonth() ? 'other' : '',key === dateKey(new Date()) ? 'today' : '',key === selectedDate ? 'selected' : '',events.some(entry=>!entry.done) ? 'in-range' : ''].join(' ');
      cells += `<button class="calendar-day ${classes}" data-date="${key}" aria-label="${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日，${events.length}项计划与活动，${classesOnDay.length}门课" aria-pressed="${key === selectedDate}"><span>${date.getDate()}</span><div class="day-dots">${events.some(entry=>entry.kind!=='activity'&&entry.date.slice(0,10)===key) ? '<i class="day-dot exam"></i>' : ''}${events.some(entry=>entry.kind!=='activity'&&entry.startDate===key) ? '<i class="day-dot start"></i>' : ''}${events.some(entry=>entry.kind!=='activity'&&entry.startDate && entry.startDate<key && entry.date.slice(0,10)>key) ? '<i class="day-dot ongoing"></i>' : ''}${classesOnDay.length ? '<i class="day-dot course"></i>' : ''}${events.some(entry=>entry.kind==='activity') ? '<i class="day-dot activity"></i>' : ''}</div></button>`;
    }
    const matching = sortEntries(eventsOnDate(selectedDate)),selected = new Date(`${selectedDate}T12:00`),classesOnDay=window.KejianTimetable.coursesOnDate(selectedDate);
    const stage=entry=>entry.kind==='activity' ? (entry.done ? '活动已结束' : '活动安排') : entry.done ? '已完成' : entry.date.slice(0,10)===selectedDate ? (entry.kind==='exam' ? '考试日' : '截止日') : entry.startDate===selectedDate ? '开始日' : entry.kind==='exam' ? '复习中' : '进行中';
    $('#main').innerHTML = `${heading('学习日历','从开始到完成，每一天都有安排。')}<section class="calendar-panel"><div class="month-heading"><h2>${month.getFullYear()} 年 ${month.getMonth()+1} 月</h2><div class="month-actions"><button class="text-button" data-today>今天</button><button class="icon-button" data-month="-1" aria-label="上一个月">${icon('left')}</button><button class="icon-button" data-month="1" aria-label="下一个月">${icon('right')}</button></div></div><div class="weekdays">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells}</div><div class="calendar-legend"><span><i class="day-dot ongoing"></i>学习计划</span><span><i class="day-dot exam"></i>截止 / 考试</span><span><i class="day-dot course"></i>课程</span></div></section><div class="section-heading"><h3>${selected.getMonth()+1} 月 ${selected.getDate()} 日的安排</h3><button class="text-button" data-add="homework" data-on-date="${selectedDate}">+ 添加</button></div>${classesOnDay.length ? `<div class="course-list calendar-courses">${classesOnDay.map(course=>window.KejianTimetable.card(course,selectedDate,true)).join('')}</div>` : ''}<div class="result-list">${matching.length ? matching.map(entry=>`<div class="calendar-plan"><span class="plan-stage">${stage(entry)}</span>${entry.kind==='activity' ? activityCard(entry) : entry.kind==='homework' ? homeworkCard(entry) : examCard(entry)}</div>`).join('') : classesOnDay.length ? '' : empty('这一天，还没有安排','留一点时间给复习，也留一点时间给自己。')}</div>`;
  }
  function render(animate = false) {
    window.KejianMotion.renderPage(updatePage,animate);
  }
  function updatePage() {
    const previousPage=page,previousSegments=[...document.querySelectorAll('#main .segmented')].map(element=>Number(element.style.getPropertyValue('--active-index')));
    page = pageOrder.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    if(previousPage!==page)scrollPositions[previousPage]=window.scrollY;
    ({home:renderHome,homework:renderHomework,review:renderReview,timetable:window.KejianTimetable.render,calendar:renderCalendar})[page]();
    if(page==='home'){const todayCourses=window.KejianTimetable.coursesOnDate(dateKey(new Date())),time=`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,next=todayCourses.find(course=>course.startTime>time);$('.hero').insertAdjacentHTML('beforebegin',`<section class="today-courses"><div class="section-heading"><div><p class="eyebrow">今日安排</p><h3>今天的课程 <span class="count">${todayCourses.length}</span></h3></div><a class="text-button" href="#timetable">课程表 ${icon('right')}</a></div>${todayCourses.length ? `<div class="course-list">${todayCourses.map(course=>window.KejianTimetable.card(course,dateKey(new Date()),true,course.id===next?.id)).join('')}</div>` : `<a class="today-empty" href="#timetable"><span class="today-empty-icon">${icon('grid')}</span><span><strong>${courses.length ? '今天没有课，按自己的节奏来' : '让今天的课程，一目了然'}</strong><small>${courses.length ? '留一点时间给作业、复习和休息' : '添加课程，或从课表截图导入'}</small></span>${icon('right')}</a>`}</section>`);}
    decorateStartDates();
    if(page==='home')$('.hero').insertAdjacentHTML('beforebegin',activitiesSection());
    if(page==='calendar')$('#main .calendar-legend').insertAdjacentHTML('beforeend','<span><i class="day-dot activity"></i>活动</span>');
    updateSegmentIndicators(previousPage===page ? previousSegments : []);
    document.querySelectorAll('.bottom-nav a').forEach(link => {const active = link.dataset.page === page;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    $('.bottom-nav').style.setProperty('--nav-index',pageOrder.indexOf(page));
    if(previousPage!==page)window.scrollTo({top:scrollPositions[page]||0,behavior:'instant'});
  }
  function switchKind(kind) {
    const form = $('#entry-form'),previousKind=form.elements.kind.value; form.elements.kind.value = kind;
    document.querySelectorAll('[data-kind]').forEach(button=>button.classList.toggle('active',button.dataset.kind === kind));
    const exam = kind === 'exam',activity=kind==='activity', editing = Boolean(form.elements.id.value);
    $('#form-title').textContent = `${editing ? '编辑' : '新建'}${activity ? '活动' : exam ? '复习 / 考试' : '作业'}`;
    $('#title-label').textContent = activity ? '活动名称' : exam ? '考试名称' : '作业内容'; $('#date-label').textContent = activity ? '活动日期' : exam ? '考试日期' : '截止日期';$('#end-time-label').textContent=activity ? '活动时间' : exam ? '考试时间' : '截止时间';
    $('#start-label').textContent=exam ? '复习开始日期' : '开始日期';
    form.elements.title.placeholder = activity ? '例如：社团见面会、校园讲座' : exam ? '例如：期中考试' : '例如：完成第二章练习';
    $('#homework-fields').hidden = exam||activity; $('#exam-fields').hidden = !exam;$('#subject-field').hidden=activity;form.elements.subject.required=!activity;if(activity)form.elements.subject.value='活动';else if(previousKind==='activity'&&form.elements.subject.value==='活动')form.elements.subject.value='';
    $('.date-range-fields').classList.toggle('activity-date-field',activity);$('#entry-reminder-label').textContent=`${activity ? '活动' : kind==='exam' ? '考试' : '截止'}前 6 小时和 3 小时提醒我`;form.elements.notes.placeholder=activity ? '活动地点、携带物品或其他事项…' : '记下页码、考试地点或要注意的事…';
    updateSegmentIndicators();
  }
  function openForm(kind, entry = null, onDate = null) {
    const form = $('#entry-form'); form.reset(); form.elements.id.value = entry ? entry.id : '';
    $('#form-type').hidden = Boolean(entry); $('#save-label').textContent = entry ? '保存修改' : '加入计划';
    switchKind(kind);
    if(entry){for(const key of ['subject','title','date','priority','notes'])form.elements[key].value = entry[key];form.elements.chapters.value = entry.chapters.map(chapter=>chapter.title).join('\n');}
    else {const date = onDate ? new Date(`${onDate}T18:00`) : new Date();if(!onDate){date.setDate(date.getDate()+(kind === 'exam' ? 7 : 1));date.setHours(kind === 'exam' ? 9 : 18,0,0,0);}form.elements.date.value = localDateTime(date);}
    form.elements.startDate.value=kind==='activity' ? form.elements.date.value.slice(0,10) : entry?.startDate || [dateKey(new Date()),form.elements.date.value.slice(0,10)].sort()[0];
    form.elements.reminder.checked=entry ? entry.reminder!==false : true;
    window.KejianDatePicker.refresh(form);
    openDialog('entry-dialog');
  }
  function showDetail(id) {
    const entry = entries.find(item=>item.id === id);if(!entry)return;
    if(entry.kind==='activity'){$('#detail-content').innerHTML=`<div class="sheet-head"><p class="eyebrow">学习之外，也有精彩</p><button type="button" class="icon-button" data-close="detail-dialog" aria-label="关闭">${icon('close')}</button></div><div class="detail-badge">${subjectBadge(entry)}</div><h2 class="detail-title">${escapeHTML(entry.title)}</h2><div class="detail-time">${icon('calendar')}<span>活动 · ${dateLabel(entry.date,true)}</span></div>${entry.notes ? `<p class="detail-notes">${escapeHTML(entry.notes)}</p>` : ''}<p class="subtitle">${reminderDescription(entry)}</p><button class="primary full-width" data-toggle="${escapeHTML(entry.id)}">${icon('check')}${entry.done ? '恢复待参加' : '标记活动已结束'}</button><div class="detail-actions"><button class="secondary" data-edit="${escapeHTML(entry.id)}">${icon('edit')}编辑活动</button><button class="text-button danger" data-delete="${escapeHTML(entry.id)}">删除活动</button></div>`;openDialog('detail-dialog');return;}
    $('#detail-content').innerHTML = `<div class="sheet-head"><p class="eyebrow">${entry.kind === 'exam' ? '一点点准备，多一点把握' : '做好眼前的这一件事'}</p><button class="icon-button" data-close="detail-dialog" aria-label="关闭">${icon('close')}</button></div><div class="detail-badge">${subjectBadge(entry)}</div><h2 class="detail-title">${escapeHTML(entry.title)}</h2><div class="detail-time">${icon('calendar')}<span>${entry.kind === 'exam' ? '考试' : '截止'} · ${dateLabel(entry.date,true)}</span></div>${entry.kind === 'exam' ? `<div class="progress-header"><span>复习进度</span><span>${progress(entry)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress(entry)}%"></div></div><div class="chapter-list">${entry.chapters.length ? entry.chapters.map((chapter,index)=>`<label class="chapter-item"><input type="checkbox" data-chapter="${index}" data-entry="${escapeHTML(entry.id)}" ${chapter.done ? 'checked' : ''}><span>${escapeHTML(chapter.title)}</span></label>`).join('') : '<p class="subtitle">还没有复习项目。点击编辑，按行添加复习范围。</p>'}</div>` : `<p class="subtitle">优先级：${({low:'有空再做',normal:'正常安排',high:'优先完成'})[entry.priority]}</p>`}${entry.notes ? `<h3 style="font-size:12px;margin-top:20px">备注</h3><p class="detail-notes">${escapeHTML(entry.notes)}</p>` : ''}<button class="primary full-width" data-toggle="${escapeHTML(entry.id)}">${icon('check')}${entry.done ? (entry.kind === 'exam' ? '恢复准备中' : '恢复待完成') : entry.kind === 'exam' ? '标记考试已结束' : '标记作业已完成'}</button><div class="detail-actions"><button class="secondary" data-edit="${escapeHTML(entry.id)}">${icon('edit')}编辑计划</button><button class="text-button danger" data-delete="${escapeHTML(entry.id)}">删除</button></div>`;
    $('#detail-content .detail-time').insertAdjacentHTML('beforebegin',`<p class="subtitle">${entry.kind==='exam' ? '开始复习' : '开始日期'} · ${startLabel(entry)}</p>`);
    $('#detail-content .detail-actions').insertAdjacentHTML('beforebegin',`<p class="subtitle">${reminderDescription(entry)}</p>`);
    openDialog('detail-dialog');
  }
  window.kejianOpenEntry=showDetail;
  function downloadData(value, filename) {
    if(window.KejianNative?.exportBackup){window.KejianNative.exportBackup(value,filename);return;}
    const url = URL.createObjectURL(new Blob([value],{type:'application/json'})), anchor = document.createElement('a');anchor.href = url;anchor.download = filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button, a');if(!button)return;
    if(button.dataset.close){window.KejianMotion.close(document.getElementById(button.dataset.close));return;}
    if(button.hasAttribute('data-show-completed'))filter = 'done';
    if(button.dataset.add)openForm(button.dataset.add,null,button.dataset.onDate);
    if(button.dataset.kind)switchKind(button.dataset.kind);
    if(button.dataset.themeChoice)window.KejianTheme.set(button.dataset.themeChoice,button);
    if(button.dataset.filter){filter = button.dataset.filter;render(true);}
    if(button.dataset.examFilter){examFilter = button.dataset.examFilter;render(true);}
    if(button.dataset.activityFilter){activityFilter=button.dataset.activityFilter;render(true);}
    if(button.dataset.detail)showDetail(button.dataset.detail);
    if(button.dataset.toggle){const entry = entries.find(item=>item.id === button.dataset.toggle);if(entry){entry.done = !entry.done;notifySave(entry.done ? '完成啦，给自己一点鼓励！' : '已恢复到待完成');render();if($('#detail-dialog').open)showDetail(entry.id);}}
    if(button.dataset.edit){const entry = entries.find(item=>item.id === button.dataset.edit);if(entry){window.KejianMotion.close($('#detail-dialog'));openForm(entry.kind,entry);}}
    if(button.dataset.delete){const id = button.dataset.delete;confirmAction('删除这项计划？','这条记录与复习进度会被删除。删除后无法撤销。',()=>{entries = entries.filter(entry=>entry.id !== id);window.KejianMotion.close($('#detail-dialog'));notifySave('计划已删除');render();});}
    if(button.dataset.date){selectedDate = button.dataset.date;const date = new Date(`${selectedDate}T12:00`);month = new Date(date.getFullYear(),date.getMonth(),1);render();}
    if(button.dataset.month){month = new Date(month.getFullYear(),month.getMonth()+Number(button.dataset.month),1);render();}
    if(button.hasAttribute('data-today')){selectedDate=dateKey(new Date());month=new Date(new Date().getFullYear(),new Date().getMonth(),1);render();}
  });
  $('#main').addEventListener('input', event=>{if(event.target.id === 'search-input'){query=event.target.value;updateSearch();}});
  $('#detail-dialog').addEventListener('change',event=>{
    if(!event.target.hasAttribute('data-chapter'))return;
    const entry=entries.find(item=>item.id===event.target.dataset.entry);if(!entry)return;
    entry.chapters[Number(event.target.dataset.chapter)].done=event.target.checked;save();render();
    const detail=$('#detail-content'), value=progress(entry);detail.querySelector('.progress-header span:last-child').textContent=`${value}%`;detail.querySelector('.progress-fill').style.width=`${value}%`;
  });
  $('#entry-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.target,data=new FormData(form),id=data.get('id'),old=entries.find(entry=>entry.id===id);
    const kind=data.get('kind'),subject=kind==='activity' ? '活动' : data.get('subject').trim(), title=data.get('title').trim(), date=data.get('date');
    if(!subject || !title){toast('请填写科目和内容');return;}
    if(!validDate(date)){toast('请填写有效的日期与时间');return;}
    const startDate=kind==='activity' ? date.slice(0,10) : data.get('startDate');
    if(!validStartDate(startDate) || startDate>date.slice(0,10)){toast('开始日期不能晚于截止 / 考试日期');return;}
    const titles=kind==='exam' ? data.get('chapters').split('\n').map(item=>item.trim()).filter(Boolean) : [];
    if(titles.length>100){toast('复习项目最多 100 项');return;}
    if(!old && entries.length>=5000){toast('最多保存 5000 条，请先整理并备份');return;}
    const chapterPool=old ? old.chapters.map(chapter=>({...chapter})) : [];
    const chapters=titles.map(chapterTitle=>{const index=chapterPool.findIndex(chapter=>chapter.title===chapterTitle);return {title:chapterTitle,done:index<0 ? false : chapterPool.splice(index,1)[0].done};});
    const entry={id:old ? old.id : crypto.randomUUID ? crypto.randomUUID() : `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,kind,subject,title,date,startDate,reminder:form.elements.reminder.checked,priority:data.get('priority'),notes:data.get('notes').trim(),done:old ? old.done : false,chapters};
    if(old)entries=entries.map(item=>item.id===old.id ? entry : item);else entries.push(entry);
    notifySave(kind==='activity' ? (old ? '活动已更新' : '已加入活动安排') : old ? '计划已更新' : '已加入你的学习计划');window.KejianMotion.close($('#entry-dialog'));render();
  });
  $('#settings-button').addEventListener('click',()=>{refreshReminderStatus();openDialog('settings-dialog');});
  $('#notification-permission-button').addEventListener('click',()=>window.KejianNative?.requestNotificationPermission?.());
  $('#exact-alarm-button').addEventListener('click',()=>window.KejianNative?.requestExactAlarmPermission?.());
  $('#test-reminder-button').addEventListener('click',()=>{if(window.KejianNative?.testReminder){window.KejianNative.testReminder();toast('已请求测试提醒，请留意手机通知');}});
  $('#confirm-cancel').addEventListener('click',()=>{window.KejianMotion.close($('#confirm-dialog'));confirmCallback=null;});
  $('#confirm-ok').addEventListener('click',()=>{const callback=confirmCallback;confirmCallback=null;window.KejianMotion.close($('#confirm-dialog'));if(callback)callback();});
  $('#confirm-dialog').addEventListener('cancel',()=>{confirmCallback=null;});
  $('#export-button').addEventListener('click',()=>{
    if(corruptBackup){let raw;try{raw=localStorage.getItem(KEY);}catch{toast('无法读取旧数据');return;}downloadData(raw||'{}',`课间-原始数据-${dateKey(new Date())}.json`);toast(window.KejianNative ? '请选择保存原始备份的位置' : '已导出原始数据，请妥善保存');}
    else {downloadData(JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries,courses,semesterStart},null,2),`课间-备份-${dateKey(new Date())}.json`);toast(window.KejianNative ? '请选择保存备份的位置' : '备份已导出');}
  });
  $('#import-button').addEventListener('click',()=>{if(window.KejianNative?.importBackup)window.KejianNative.importBackup();else $('#import-file').click();});
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(file.size>10*1024*1024){toast('备份文件不能超过 10 MB');return;}
    try {importBackupText(await file.text());}catch{toast('无法读取备份文件，请重新选择');}
  });
  function importBackupText(text) {
    if(corruptBackup){toast('请先导出原始备份，再清空恢复');return;}
    try {
      if(typeof text!=='string' || text.length>10*1024*1024)throw new Error('备份文件不能超过 10 MB');
      const data=JSON.parse(text),incoming=normalizeBackup(data),incomingCourses=normalizeCourses(data.courses),incomingSemester=normalizeSemester(data.semesterStart);
      if(!incoming.length&&!incomingCourses.length&&!incomingSemester){toast('备份中没有记录');return;}
      const merged=new Map(entries.map(entry=>[entry.id,entry]));incoming.forEach(entry=>merged.set(entry.id,entry));
      if(merged.size>5000)throw new Error('合并后超过 5000 条，请先整理记录');
      const mergedCourses=new Map(courses.map(course=>[course.id,course]));incomingCourses.forEach(course=>mergedCourses.set(course.id,course));if(mergedCourses.size>1000)throw new Error('合并后超过 1000 门课程');
      const duplicate=incoming.filter(entry=>entries.some(item=>item.id===entry.id)).length;
      confirmAction('导入这份备份？',`作业 / 考试 / 活动 ${incoming.length} 条（新增 ${incoming.length-duplicate}，更新 ${duplicate}），课程 ${incomingCourses.length} 门。同编号会更新。${incomingSemester ? `学期第 1 周将从 ${incomingSemester} 开始。` : ''}`,()=>{const latest=new Map(entries.map(entry=>[entry.id,entry])),latestCourses=new Map(courses.map(course=>[course.id,course]));incoming.forEach(entry=>latest.set(entry.id,entry));incomingCourses.forEach(course=>latestCourses.set(course.id,course));if(latest.size>5000||latestCourses.size>1000){toast('合并后的记录超过上限');return;}entries=[...latest.values()];courses=[...latestCourses.values()];if(incomingSemester)semesterStart=incomingSemester;notifySave('备份已合并');render();});
    }catch(error){toast(error instanceof SyntaxError ? '文件不是有效的 JSON 备份' : error.message);}
  }
  window.kejianImportBackup = importBackupText;
  window.kejianNativeMessage = toast;
  $('#clear-button').addEventListener('click',()=>confirmAction('清空所有记录？','作业、考试、活动、复习进度和课程表都会删除。建议先导出备份，此操作无法撤销。',()=>{entries=[];courses=[];semesterStart=mondayKey();corruptBackup=false;notifySave('记录已清空');render();}));
  $('#demo-button').addEventListener('click',()=>{
    if(corruptBackup){toast('请先导出原始备份，再清空恢复');return;}
    if(entries.some(entry=>entry.id.startsWith('demo-'))){toast('示例已经添加，可在详情中删除');return;}
    if(entries.length>4996){toast('记录空间不足，请先整理');return;}
    const when=(days,hour)=>{const date=new Date();date.setDate(date.getDate()+days);date.setHours(hour,0,0,0);return localDateTime(date);};
    entries.push(
      {id:'demo-math',kind:'homework',subject:'数学',title:'【示例】完成函数章节练习',date:when(1,18),priority:'high',notes:'教材 P42–45，标记不理解的题目。',done:false,chapters:[]},
      {id:'demo-english',kind:'homework',subject:'英语',title:'【示例】阅读理解与单词整理',date:when(2,20),priority:'normal',notes:'阅读两篇短文，整理新词。',done:false,chapters:[]},
      {id:'demo-chinese',kind:'homework',subject:'语文',title:'【示例】整理古诗文笔记',date:when(3,18),priority:'normal',notes:'',done:false,chapters:[]},
      {id:'demo-exam',kind:'exam',subject:'数学',title:'【示例】期中考试',date:when(6,9),priority:'normal',notes:'考前准备文具。',done:false,chapters:[{title:'集合与逻辑',done:true},{title:'函数的性质',done:false},{title:'指数与对数',done:false},{title:'错题整理',done:false}]}
    );entries=entries.map(entry=>entry.id.startsWith('demo-') ? {...entry,startDate:dateKey(new Date()),reminder:false} : entry);notifySave('已添加 4 条示例记录');window.KejianMotion.close($('#settings-dialog'));render();
  });
  window.addEventListener('hashchange',()=>render(true));
  window.addEventListener('storage',event=>{if(event.key!==KEY)return;try{const data=event.newValue ? JSON.parse(event.newValue) : {version:1,entries:[]},next=normalizeBackup(data),nextCourses=normalizeCourses(data.courses),nextSemester=normalizeSemester(data.semesterStart)||mondayKey();entries=next;courses=nextCourses;semesterStart=nextSemester;corruptBackup=false;storageOK=true;$('#storage-warning').hidden=true;syncReminders();render();if($('#detail-dialog').open)window.KejianMotion.close($('#detail-dialog'));toast('已同步此浏览器另一页面的修改');}catch{toast('另一页面的数据格式异常，已保留当前记录');}});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-button').hidden=false;});
  $('#install-button').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install-button').hidden=true;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;$('#install-button').hidden=true;toast('课间已添加到主屏幕');});
  function updateThemeControls() {
    const dark=window.KejianTheme.getResolved()==='dark',button=$('#theme-toggle');
    button.innerHTML=icon(dark ? 'sun' : 'moon');button.setAttribute('aria-label',dark ? '切换到亮色主题' : '切换到暗色主题');
    document.querySelectorAll('[data-theme-choice]').forEach(option=>{const active=option.dataset.themeChoice===window.KejianTheme.getPreference();option.classList.toggle('active',active);option.setAttribute('aria-pressed',String(active));});
    updateSegmentIndicators();
  }
  window.addEventListener('kejian-theme-change',updateThemeControls);
  $('#theme-toggle').addEventListener('click',event=>{const saved=window.KejianTheme.set(window.KejianTheme.getResolved()==='dark' ? 'light' : 'dark',event.currentTarget);if(!saved)toast('主题已切换，当前浏览器无法保存偏好');});
  window.KejianTimetable.init({getCourses:()=>courses,getSemesterStart:()=>semesterStart,setSemesterStart:value=>{if(corruptBackup){toast('请先导出原始备份并恢复数据');return false;}semesterStart=normalizeSemester(value);return save();},setCourses:value=>{if(corruptBackup){toast('请先导出原始备份并恢复数据');return false;}courses=value;const stored=save();if(!stored)toast('当前无法保存课程，请导出备份');return stored;},render,toast,confirm:confirmAction,escape:escapeHTML,icon,heading});
  window.KejianCourseImport.init({getCourses:()=>courses,setCourses:value=>{if(corruptBackup){toast('请先导出原始备份并恢复数据');return false;}courses=value;const stored=save();if(!stored)toast('当前无法保存课程，请导出备份');return stored;},render,toast,escape:escapeHTML,icon});
  window.KejianDayTransfer.init({getCourses:()=>courses,getSemesterStart:()=>semesterStart,setCourses:value=>{if(corruptBackup){toast('请先导出原始备份并恢复数据');return false;}const old=courses;courses=value;if(!save()){courses=old;toast('当前无法保存调休，请导出备份');return false;}return true;},render,toast,escape:escapeHTML,icon});
  hydrateIcons();updateThemeControls();render();$('#storage-warning').hidden=storageOK;
  if(!corruptBackup)syncReminders();
  if(window.KejianNative){$('#install-description').textContent='你正在使用 Android 应用，页面已内置，断网也能打开。备份使用手机文件选择器保存和读取。';}
  if(corruptBackup)$('#storage-warning').textContent='旧数据无法读取，已保留原文件。请在设置中导出原始备份后清空恢复。';
  setInterval(()=>{if(!document.hidden && !document.querySelector('dialog[open]') && document.activeElement?.id!=='search-input')render();},60000);
  if(!window.KejianNative && 'serviceWorker' in navigator && (location.protocol==='https:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname))) navigator.serviceWorker.register('./sw.js').catch(()=>{toast('离线缓存暂不可用，联网使用不受影响');});
})();

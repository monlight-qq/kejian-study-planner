// Optional integration check: node tests/browser.cjs <playwright module path>
const {chromium}=require(process.argv[2] || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {setDateField}=require('./date-field.cjs');
const root=path.join(__dirname,'..');
const server=spawn(process.execPath,[path.join(root,'server.cjs')],{env:{...process.env,PORT:'4174'},windowsHide:true,stdio:['ignore','pipe','pipe']});
const output=path.join(root,'.test-output');
(async()=>{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:4174');
    await page.locator('h1').waitFor();
    await page.screenshot({path:path.join(output,'empty-mobile.png'),animations:'disabled'});
    await page.locator('.hero-action').click();
    await page.locator('#entry-form [name=subject]').fill('物理');await page.locator('#entry-form [name=title]').fill('完成电学练习');await setDateField(page,'date','2026-11-20T18:00');await page.locator('#entry-form [name=notes]').fill('<img src=x onerror="alert(1)">');
    await page.locator('#entry-form [type=submit]').click();
    assert.equal(await page.locator('.task-title').first().textContent(),'完成电学练习');
    await page.reload();assert.equal(await page.locator('.task-title').first().textContent(),'完成电学练习');
    await page.locator('[data-detail]').first().click();assert.equal(await page.locator('.detail-notes').textContent(),'<img src=x onerror="alert(1)">');assert.equal(await page.locator('.detail-notes img').count(),0);
    await page.locator('[data-edit]').click();await page.locator('#entry-form [name=title]').fill('完成电学练习 · 已修改');await page.locator('#entry-form [type=submit]').click();
    await page.locator('.check-button').click();
    await page.locator('.bottom-nav [data-page=homework]').click();await page.locator('[data-filter=done]').click();assert.equal(await page.locator('.task-card.done').count(),1);
    await page.locator('.check-button').click();await page.locator('[data-filter=pending]').click();assert.equal(await page.locator('.task-card').count(),1);
    await page.locator('#search-input').fill('不存在');assert.equal(await page.locator('.task-card').count(),0);await page.locator('#search-input').fill('物理');assert.equal(await page.locator('.task-card').count(),1);
    await page.locator('.bottom-nav [data-page=review]').click();await page.locator('.plus-button').click();
    await page.locator('#entry-form [name=subject]').fill('数学');await page.locator('#entry-form [name=title]').fill('期中考试');await setDateField(page,'date','2026-11-22T09:00');await page.locator('#entry-form [name=chapters]').fill('集合\n函数\n错题整理');await page.locator('#entry-form [type=submit]').click();
    await page.locator('.exam-card [data-detail]').click();await page.locator('[data-chapter="0"]').check();assert.equal(await page.locator('#detail-content .progress-header span').last().textContent(),'33%');
    await page.locator('[data-edit]').click();await page.locator('#entry-form [name=chapters]').fill('集合\n函数\n错题整理\n模拟题');await page.locator('#entry-form [type=submit]').click();
    await page.locator('.exam-card [data-detail]').click();assert.equal(await page.locator('[data-chapter="0"]').isChecked(),true);assert.equal(await page.locator('#detail-content .progress-header span').last().textContent(),'25%');
    await page.locator('[data-close=detail-dialog]').click();
    await page.locator('#settings-button').click();await page.locator('#demo-button').click();
    await page.locator('.bottom-nav [data-page=home]').click();await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:path.join(output,'home-mobile.png'),animations:'disabled'});
    for(const width of [320,390,768]){await page.setViewportSize({width,height:844});for(const route of ['home','homework','review','calendar']){await page.locator(`.bottom-nav [data-page=${route}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,`Overflow: ${route} at ${width}`);}}
    await page.setViewportSize({width:390,height:844});await page.locator('.bottom-nav [data-page=calendar]').click();await page.locator('[data-month="1"]').click();await page.locator('[data-date="2026-11-20"]').click();assert.equal(await page.locator('.task-card').count(),1);
    await page.screenshot({path:path.join(output,'calendar-mobile.png'),animations:'disabled'});
    await page.locator('#settings-button').click();const downloadPromise=page.waitForEvent('download');await page.locator('#export-button').click();const download=await downloadPromise;await download.saveAs(path.join(output,'backup.json'));const backup=JSON.parse(await fs.readFile(path.join(output,'backup.json'),'utf8'));assert.equal(backup.entries.length,6);
    await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"entries":[{}]}')});await page.waitForTimeout(150);assert.equal(await page.locator('#confirm-dialog').getAttribute('open'),null);
    await page.locator('#clear-button').click();await page.locator('#confirm-cancel').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kejian-planner-v1')).entries.length),6);
    await page.locator('#clear-button').click();await page.locator('#confirm-ok').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kejian-planner-v1')).entries.length),0);
    await page.locator('#import-file').setInputFiles(path.join(output,'backup.json'));await page.locator('#confirm-ok').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kejian-planner-v1')).entries.length),6);
    await page.locator('[data-close=settings-dialog]').click();
    await page.locator('.bottom-nav [data-page=homework]').click();await page.locator('#search-input').fill('电学');await page.locator('[data-detail]').first().click();await page.locator('[data-delete]').click();await page.locator('#confirm-ok').click();assert.equal(await page.locator('.task-card').count(),0);
    await page.locator('.bottom-nav [data-page=home]').click();
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise(resolve=>{if(navigator.serviceWorker.controller)resolve();else navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});});});
    await context.setOffline(true);await page.reload();await page.locator('h1').waitFor();assert.equal(await page.locator('.task-card').count(),3);
    assert.deepEqual(errors,[]);console.log('PASS: CRUD, persistence, completion, search, revision progress, calendar, backup import/export, delete confirmation, 320/390/768px layouts and offline reload.');
    console.log(`Screenshots: ${output}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.kill());

const {chromium}=require(process.argv[2] || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const root=path.join(__dirname,'..'),output=path.join(root,'.test-output');
const server=spawn(process.execPath,[path.join(root,'server.cjs')],{env:{...process.env,PORT:'4175'},windowsHide:true,stdio:['ignore','pipe','pipe']});
(async()=>{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'light'});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:4175');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('#theme-toggle').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('#settings-button').click();await page.locator('[data-theme-choice=dark]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await page.locator('[data-theme-choice=dark]').getAttribute('aria-pressed'),'true');
    await page.emulateMedia({colorScheme:'light'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('[data-theme-choice=system]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('#demo-button').click();await page.locator('#toast').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(output,'home-dark-mobile.png'),animations:'disabled'});
    for(const route of ['home','homework','review','calendar']){await page.locator(`.bottom-nav [data-page=${route}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('.app-shell').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(25, 23, 31)');}
    await page.locator('.bottom-nav [data-page=homework]').click();await page.locator('.plus-button').click();assert.equal(await page.locator('#entry-dialog').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(36, 32, 45)');await page.screenshot({path:path.join(output,'form-dark-mobile.png'),animations:'disabled'});await page.locator('[data-close=entry-dialog]').click();
    await page.locator('#settings-button').click();await page.screenshot({path:path.join(output,'settings-dark-mobile.png'),animations:'disabled'});await page.locator('[data-close=settings-dialog]').click();
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise(resolve=>{if(navigator.serviceWorker.controller)resolve();else navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});});});
    await context.setOffline(true);await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await context.close();

    const native=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});
    await native.addInitScript(()=>{window.nativeTest={themes:[],imports:0,exported:null,systemDark:true};window.KejianNative={isSystemDark:()=>window.nativeTest.systemDark,setTheme:value=>window.nativeTest.themes.push(value),exportBackup:(text,name)=>window.nativeTest.exported={text,name},importBackup:()=>window.nativeTest.imports++};});
    const nativePage=await native.newPage();nativePage.on('pageerror',error=>errors.push(error.message));await nativePage.goto('http://localhost:4175');assert.equal(await nativePage.locator('html').getAttribute('data-theme'),'dark');
    await nativePage.evaluate(()=>{window.nativeTest.systemDark=false;window.kejianSystemThemeChanged();});assert.equal(await nativePage.locator('html').getAttribute('data-theme'),'light');
    await nativePage.locator('#settings-button').click();await nativePage.locator('[data-theme-choice=dark]').click();await nativePage.waitForFunction(()=>window.nativeTest.themes.at(-1)==='dark');assert.equal(await nativePage.evaluate(()=>window.nativeTest.themes.at(-1)),'dark');
    await nativePage.locator('#demo-button').click();await nativePage.locator('#settings-button').click();await nativePage.locator('#export-button').click();
    const exported=await nativePage.evaluate(()=>window.nativeTest.exported);assert.equal(JSON.parse(exported.text).entries.length,4);assert.equal(exported.name.endsWith('.json'),true);
    await nativePage.locator('#import-button').click();assert.equal(await nativePage.evaluate(()=>window.nativeTest.imports),1);
    const backup=JSON.parse(exported.text);backup.entries[0].id='native-import';backup.entries=[backup.entries[0]];await nativePage.evaluate(text=>window.kejianImportBackup(text),JSON.stringify(backup));await nativePage.locator('#confirm-ok').click();assert.equal(await nativePage.evaluate(()=>JSON.parse(localStorage.getItem('kejian-planner-v1')).entries.length),5);
    await native.close();assert.deepEqual(errors,[]);
    console.log('PASS: manual themes, persistence, system changes, dark dialogs/calendar, offline theme assets and Android bridge callbacks.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.kill());

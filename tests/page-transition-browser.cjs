const {chromium}=require(process.argv[2]||'playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),{spawn}=require('node:child_process');
const {PNG}=require(path.join(path.dirname(process.argv[2]||require.resolve('playwright')),'pngjs'));
const root=path.join(__dirname,'..'),output=path.join(root,'.test-output'),server=spawn(process.execPath,[path.join(root,'server.cjs')],{env:{...process.env,PORT:'4183'},windowsHide:true,stdio:['ignore','pipe','pipe']});
function difference(first,second){const a=PNG.sync.read(first),b=PNG.sync.read(second);assert.equal(a.width,b.width);assert.equal(a.height,b.height);let total=0;for(let i=0;i<a.data.length;i+=4)for(let c=0;c<3;c++)total+=Math.abs(a.data[i+c]-b.data[i+c]);return total/(a.width*a.height*3*255);}
(async()=>{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Server exited '+code)));});await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   const start=document.startViewTransition.bind(document);
   document.startViewTransition=update=>{window.capturedHeading=document.querySelector('h1')?.textContent;const transition=start(update);window.testTransition=transition;transition.ready.then(()=>{
    if(!document.documentElement.dataset.motionPage)return;
    window.pageAnimations=document.getAnimations().filter(animation=>animation.effect?.pseudoElement?.includes('view-transition'));
    window.pageAnimations.forEach(animation=>{animation.pause();animation.currentTime=0;});window.pageSnapshotReady=true;
   }).catch(()=>{});return transition;};
  });
  await page.goto('http://localhost:4183');
  const settle=()=>page.waitForFunction(()=>!document.documentElement.dataset.motionPage&&!document.documentElement.dataset.motionTheme);
  const finish=async()=>{await page.evaluate(()=>window.testTransition?.skipTransition());await settle();};
  const jump=async route=>{await page.emulateMedia({reducedMotion:'reduce'});await page.locator(`.bottom-nav [data-page=${route}]`).click();await page.waitForFunction(route=>location.hash==='#'+route,route);await settle();await page.emulateMedia({reducedMotion:'no-preference'});};
  for(const theme of ['light','dark'])for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});await jump('home');await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(theme=>window.KejianTheme.set(theme),theme);await page.emulateMedia({reducedMotion:'no-preference'});
   for(const scroll of [0,150]){
    await jump('home');await page.evaluate(scroll=>window.scrollTo({top:scroll,behavior:'instant'}),scroll);
    await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState==='finished'));
    const heading=await page.locator('h1').textContent(),header=await page.locator('.app-header').boundingBox(),nav=await page.locator('.bottom-nav').boundingBox(),clip={x:Math.ceil(nav.x),y:Math.ceil(header.y+header.height),width:Math.floor(nav.width),height:Math.floor(nav.y-header.y-header.height)},baseline=await page.screenshot({clip});
    await page.evaluate(()=>window.pageSnapshotReady=false);await page.locator('.bottom-nav [data-page=calendar]').click();await page.waitForFunction(()=>window.pageSnapshotReady);
    const first=await page.screenshot({clip});await fs.writeFile(path.join(output,`page-first-${theme}-${width}-${scroll}.png`),first);
    assert.equal(await page.evaluate(()=>window.capturedHeading),heading,'Snapshot must capture the outgoing page before replacing its DOM');
    const changed=difference(baseline,first);assert.ok(changed<.025,`Outgoing ${theme} page jumps before fading at ${width}px / scroll ${scroll}: ${(changed*100).toFixed(2)}% pixel difference`);
    const transforms=await page.evaluate(()=>window.pageAnimations.filter(animation=>animation.effect.pseudoElement.includes('group')).flatMap(animation=>animation.effect.getKeyframes()));assert.equal(transforms.length,0,'Page size and position must not animate');
    await page.evaluate(()=>window.pageAnimations.forEach(animation=>animation.currentTime=280));const last=await page.screenshot({clip});await finish();assert.equal(await page.locator('h1').textContent(),'学习日历');const completed=await page.screenshot({clip});assert.ok(difference(last,completed)<.025,'The final frame must match the live incoming page');
   }
   // Identical pages must remain identical throughout the fade: no black gap,
   // opacity dip, vertical shift or size interpolation at the midpoint.
   await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState==='finished'));const baseline=await page.screenshot();
   await page.evaluate(()=>{window.pageSnapshotReady=false;window.KejianMotion.renderPage(()=>{},true);});await page.waitForFunction(()=>window.pageSnapshotReady);
   for(const time of [0,70,140,210,280]){
    await page.evaluate(time=>window.pageAnimations.forEach(animation=>animation.currentTime=time),time);
    const during=await page.screenshot(),changed=difference(baseline,during);await fs.writeFile(path.join(output,`page-steady-${theme}-${width}-${time}.png`),during);await fs.writeFile(path.join(output,`page-steady-${theme}-${width}-baseline.png`),baseline);assert.ok(changed<.01,`Same page dims or shifts at ${time}ms (${theme}, ${width}px, ${(changed*100).toFixed(2)}%)`);
   }
   await finish();
  }
  await page.setViewportSize({width:390,height:844});await jump('home');
  await page.evaluate(()=>{window.pageSnapshotReady=false;location.hash='#calendar';});await page.waitForFunction(()=>window.pageSnapshotReady);
  const target=await page.locator('.bottom-nav [data-page=homework]').boundingBox();await page.touchscreen.tap(target.x+target.width/2,target.y+target.height/2);await page.waitForFunction(()=>document.querySelector('h1').textContent==='作业清单');await finish();
  await page.evaluate(()=>{for(const route of ['review','timetable','homework','calendar','home']){location.hash='#'+route;dispatchEvent(new HashChangeEvent('hashchange'));}});await page.waitForFunction(()=>document.querySelector('h1').textContent.includes('同学'));await finish();
  await page.evaluate(()=>{location.hash='#review';dispatchEvent(new HashChangeEvent('hashchange'));document.querySelector('#settings-button').click();});await page.locator('#settings-dialog').waitFor({state:'visible'});assert.equal(await page.locator('h1').textContent(),'复习计划','Opening a dialog must commit the pending route');await page.locator('[data-close=settings-dialog]').click();await page.locator('#settings-dialog').waitFor({state:'hidden'});await finish();
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.bottom-nav [data-page=review]').click();await settle();assert.equal(await page.locator('h1').textContent(),'复习计划');
  await page.evaluate(()=>{document.startViewTransition=undefined;});await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.bottom-nav [data-page=timetable]').click();await settle();assert.equal(await page.locator('h1').textContent(),'我的课程');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS: outgoing frame continuity, constant brightness at every fade phase, fixed snapshot geometry, light/dark 320/390/768px, restored scroll, rapid touch navigation, modal interruption, reduced motion and older WebView fallback.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.kill());

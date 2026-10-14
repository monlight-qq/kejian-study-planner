const {chromium}=require(process.argv[2]||'playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),{spawn}=require('node:child_process');
const {PNG}=require(path.join(path.dirname(process.argv[2]||require.resolve('playwright')),'pngjs'));
const root=path.join(__dirname,'..'),output=path.join(root,'.test-output'),server=spawn(process.execPath,[path.join(root,'server.cjs')],{env:{...process.env,PORT:'4182'},windowsHide:true,stdio:['ignore','pipe','pipe']});
function difference(first,second){const a=PNG.sync.read(first),b=PNG.sync.read(second);assert.equal(a.width,b.width);assert.equal(a.height,b.height);let total=0;for(let i=0;i<a.data.length;i+=4)for(let c=0;c<3;c++)total+=Math.abs(a.data[i+c]-b.data[i+c]);return total/(a.width*a.height*3*255);}
(async()=>{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Server exited '+code)));});await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   const start=document.startViewTransition.bind(document);
   document.startViewTransition=update=>{const transition=start(update);window.testTransition=transition;transition.ready.then(()=>{
    if(!document.documentElement.dataset.motionPage)return;
    const animations=document.getAnimations().filter(animation=>animation.effect?.pseudoElement?.includes('view-transition'));
    animations.forEach(animation=>{animation.pause();animation.currentTime=200;});window.navigationSnapshotReady=true;
   }).catch(()=>{});return transition;};
  });
  await page.goto('http://localhost:4182');await page.locator('#settings-button').click();await page.locator('#demo-button').click();await page.locator('#settings-dialog').waitFor({state:'hidden'});
  for(const theme of ['light','dark']){
   await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(theme=>window.KejianTheme.set(theme),theme);await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState==='finished'));
   for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    const bounds=await page.locator('.bottom-nav').boundingBox(),clip={x:Math.ceil(bounds.x),y:Math.ceil(bounds.y),width:Math.floor(bounds.width),height:Math.floor(bounds.height)-1},baseline=await page.screenshot({clip});
    await page.evaluate(()=>{window.navigationSnapshotReady=false;window.KejianMotion.renderPage(()=>{},true);});await page.waitForFunction(()=>window.navigationSnapshotReady);
    const during=await page.screenshot({clip});await fs.writeFile(path.join(output,`navigation-${theme}-${width}-during.png`),during);const changed=difference(baseline,during);assert.ok(changed<.025,`Bottom navigation is covered during ${theme} page transition at ${width}px (${(changed*100).toFixed(2)}% visual difference)`);
    const next=await page.locator('.bottom-nav [data-page=homework]').boundingBox();await page.touchscreen.tap(next.x+next.width/2,next.y+next.height/2);await page.waitForFunction(()=>location.hash==='#homework');
    await page.evaluate(()=>{window.testTransition?.skipTransition();window.KejianMotion.cancelPage();});await page.waitForFunction(()=>!document.documentElement.dataset.motionPage);await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.bottom-nav [data-page=home]').click();await page.emulateMedia({reducedMotion:'no-preference'});
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS: bottom navigation stays visually above page snapshots and responds to real touch input during light/dark transitions at 320/390/768px.');await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.kill());

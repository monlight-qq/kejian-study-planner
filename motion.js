(function(){
  'use strict';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)',root=document.documentElement;
  let pageToken=0,pageTransition,pageUpdate,themeTransition,themeToken=0;
  const closingDialogs=new WeakMap();
  // Modal/theme/resize interruptions commit a pending route; a newer render
  // replaces it instead, preventing skipped native callbacks from going stale.
  function cancelPage(commit=true){pageTransition?.skipTransition();if(commit)pageUpdate?.();pageUpdate=null;pageToken++;pageTransition=null;delete root.dataset.motionPage;}
  function renderPage(update,animate=false){
    cancelPage(false);if(animate)themeTransition?.skipTransition();
    // Capture the outgoing page before updating the DOM or restoring scroll.
    // A skipped transition still calls its update, so guard against stale renders.
    const token=pageToken;let applied=false;
    const apply=()=>{if(token!==pageToken||applied)return;applied=true;update();};
    // A modal's native inert layer must be released before taking page snapshots.
    const modalVisible=[...document.querySelectorAll('dialog')].some(dialog=>getComputedStyle(dialog).display!=='none');
    if(!animate||reduce.matches||document.hidden||modalVisible||!document.startViewTransition){apply();return;}
    const header=document.querySelector('.app-header'),nav=document.querySelector('.bottom-nav'),main=document.getElementById('main'),oldBounds=main.getBoundingClientRect();
    root.style.setProperty('--motion-page-left',`${oldBounds.left}px`);root.style.setProperty('--motion-page-width',`${oldBounds.width}px`);
    root.style.setProperty('--motion-page-background',getComputedStyle(main.parentElement).backgroundColor);
    function placeSnapshot(stage,bounds){root.style.setProperty(`--motion-page-${stage}-top`,`${bounds.top}px`);root.style.setProperty(`--motion-page-${stage}-height`,`${bounds.height}px`);}
    placeSnapshot('old',oldBounds);
    const top=Math.max(0,header?.getBoundingClientRect().bottom||0);
    function clipContent(){
      root.style.setProperty('--motion-page-top',`${Math.max(top,header?.getBoundingClientRect().bottom||0)}px`);
      root.style.setProperty('--motion-page-bottom',`${nav ? Math.max(0,innerHeight-nav.getBoundingClientRect().top) : 0}px`);
    }
    clipContent();root.dataset.motionPage='true';pageUpdate=apply;
    try{
      const transition=document.startViewTransition(()=>{apply();if(token===pageToken){placeSnapshot('new',main.getBoundingClientRect());clipContent();}});pageTransition=transition;
      transition.ready.catch(()=>{});
      transition.finished.catch(()=>{}).finally(()=>{if(token===pageToken){delete root.dataset.motionPage;pageTransition=null;pageUpdate=null;}});
    }catch{if(token===pageToken){delete root.dataset.motionPage;apply();pageUpdate=null;}}
  }
  function open(dialog){
    cancelPage();const closing=closingDialogs.get(dialog);if(closing){closingDialogs.delete(dialog);closing.cancel();delete dialog.dataset.closing;}
    if(!dialog.open)dialog.showModal();
  }
  function close(dialog){
    if(!dialog.open||closingDialogs.has(dialog))return;
    cancelPage();if(reduce.matches){dialog.close();return;}
    dialog.dataset.closing='true';
    const animation=dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(18px) scale(.985)'}],{duration:180,easing:'ease-in',fill:'forwards'});closingDialogs.set(dialog,animation);
    animation.finished.then(()=>{if(closingDialogs.get(dialog)!==animation)return;dialog.close();closingDialogs.delete(dialog);animation.cancel();delete dialog.dataset.closing;}).catch(()=>{});
  }
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{if(!reduce.matches){event.preventDefault();close(dialog);}}));
  function fallbackTheme(apply,origin){apply();if(reduce.matches)return;origin?.animate?.([{transform:'rotate(0) scale(1)'},{transform:'rotate(150deg) scale(.82)',offset:.45},{transform:'rotate(360deg) scale(1)'}],{duration:500,easing:ease});}
  function changeTheme(apply,origin){
    themeTransition?.skipTransition();cancelPage();const token=++themeToken;
    if(reduce.matches||!document.startViewTransition){delete root.dataset.motionTheme;fallbackTheme(apply,origin);return;}
    const bounds=origin?.getBoundingClientRect(),x=bounds ? bounds.left+bounds.width/2 : innerWidth/2,y=bounds ? bounds.top+bounds.height/2 : 80,radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));let applied=false;
    root.dataset.motionTheme='true';
    try{
      const transition=document.startViewTransition(()=>{apply();applied=true;});themeTransition=transition;
      transition.ready.then(()=>{
        root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},{duration:560,easing:ease,pseudoElement:'::view-transition-new(root)',fill:'both'});
        origin?.animate?.([{transform:'rotate(0) scale(1)'},{transform:'rotate(180deg) scale(.84)',offset:.45},{transform:'rotate(360deg) scale(1)'}],{duration:550,easing:ease});
      }).catch(()=>{if(!applied){apply();applied=true;}});
      transition.finished.catch(()=>{}).finally(()=>{if(token===themeToken){delete root.dataset.motionTheme;themeTransition=null;}});
    }catch{delete root.dataset.motionTheme;if(!applied)fallbackTheme(apply,origin);}
  }
  reduce.addEventListener?.('change',()=>{if(reduce.matches){cancelPage();themeTransition?.skipTransition();}});
  window.addEventListener('resize',()=>cancelPage());
  window.KejianMotion={renderPage,changeTheme,cancelPage,open,close};
})();

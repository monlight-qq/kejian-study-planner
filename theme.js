(function () {
  'use strict';
  const KEY = 'kejian-theme-v1', system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const saved = localStorage.getItem(KEY); if(['light','dark','system'].includes(saved)) preference = saved; } catch {}
  function apply() {
    const systemDark = window.KejianNative?.isSystemDark ? window.KejianNative.isSystemDark() : system.matches;
    const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#19171f' : '#f6f5f9';
    if(window.KejianNative?.setTheme)window.KejianNative.setTheme(preference);
    window.dispatchEvent(new CustomEvent('kejian-theme-change',{detail:{theme,preference}}));
  }
  window.KejianTheme = {
    getPreference: () => preference,
    getResolved: () => document.documentElement.dataset.theme,
    set(value,origin) { if(!['light','dark','system'].includes(value))return;const oldTheme=this.getResolved();preference=value;let saved=true;try{localStorage.setItem(KEY,value);}catch{saved=false;}const nextTheme=value==='system' ? ((window.KejianNative?.isSystemDark ? window.KejianNative.isSystemDark() : system.matches) ? 'dark' : 'light') : value;if(oldTheme!==nextTheme&&window.KejianMotion)window.KejianMotion.changeTheme(apply,origin);else apply();return saved; }
  };
  window.kejianSystemThemeChanged = () => {if(preference==='system')apply();};
  if(system.addEventListener)system.addEventListener('change',()=>{if(preference==='system')apply();});
  else system.addListener(()=>{if(preference==='system')apply();});
  window.addEventListener('storage',event=>{if(event.key===KEY){preference=['light','dark','system'].includes(event.newValue) ? event.newValue : 'system';apply();}});
  apply();
})();

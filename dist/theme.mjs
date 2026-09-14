const options = ['dark','standard','auto'];
let preference = 'standard';
try { const saved = localStorage.getItem('arena-theme-v1'); if(options.includes(saved))preference=saved; }catch{}
const system = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const getTheme = () => preference;
export const isDark = () => preference === 'dark' || preference === 'auto' && !!system?.matches;
export function applyTheme() {
  document.documentElement.dataset.theme = isDark() ? 'dark' : 'light';
  document.documentElement.style.colorScheme = isDark() ? 'dark' : 'light';
  window.dispatchEvent(new CustomEvent('arena-theme-change'));
}
export function setTheme(value) {
  if(!options.includes(value))return;
  preference = value;
  try { localStorage.setItem('arena-theme-v1',value); }catch{}
  applyTheme();
}
system?.addEventListener('change',()=>{ if(preference==='auto')applyTheme(); });

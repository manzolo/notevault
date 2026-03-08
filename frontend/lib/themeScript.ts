// Blocking inline script to prevent flash of wrong theme.
// Imported by the root layout (server component) only.
export const themeScript = `(function(){
  try {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
})();`;

function initThemeToggle() {
  const body = document.body;
  const navbar = document.getElementById('siteNavbar');
  const saved = lsGet('webfund-theme');
  const theme = saved === 'light' ? 'light' : 'dark';

  body.setAttribute('data-bs-theme', theme);
  if (navbar) {
    navbar.classList.toggle('navbar-dark', theme === 'dark');
    navbar.classList.toggle('navbar-light', theme === 'light');
  }
}

function lsGet(key) { try { return window.localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { window.localStorage.setItem(key, val); } catch {} }
function lsRemove(key) { try { window.localStorage.removeItem(key); } catch {} }

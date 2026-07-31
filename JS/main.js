const db = firebase.firestore();
let cachedProjects = [];
let currentUserRole = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initProjectFeed();
  initAuthUI();
  loadProjects();

  firebase.auth().onAuthStateChanged(() => {
    initAuthUI();
    loadProjects();
  });
});

function initAuthUI() {
  const authBtns = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');
  const userDropdown = document.getElementById('userDropdown');
  const createBtn = document.getElementById('createProjectBtn');
  const myProjectsLink = document.getElementById('myProjectsLink');
  const portfolioLink = document.getElementById('portfolioLink');
  const adminLink = document.getElementById('adminLink');
  const logoutBtn = document.getElementById('logoutBtn');
  const user = firebase.auth().currentUser;

  if (user) {
    authBtns.style.display = 'none';
    userMenu.style.display = 'block';
    userDropdown.textContent = user.displayName || 'User';
    createBtn.style.display = 'inline-block';
    createBtn.href = 'post-project.html';

    document.getElementById('heroProjectBtn').href = 'post-project.html';
    document.getElementById('ctaProjectBtn').href = 'post-project.html';

    db.collection('users').doc(user.uid).get().then(doc => {
      currentUserRole = doc.exists ? doc.data().role : null;
      if (currentUserRole === 'investor') {
        createBtn.style.display = 'none';
        if (myProjectsLink) myProjectsLink.style.display = 'none';
        if (portfolioLink) portfolioLink.style.display = 'block';
      } else {
        if (myProjectsLink) myProjectsLink.style.display = 'block';
        if (portfolioLink) portfolioLink.style.display = 'none';
      }
      if (adminLink) adminLink.style.display = currentUserRole === 'admin' ? 'block' : 'none';
    }).catch(() => {});
  } else {
    authBtns.style.display = 'flex';
    userMenu.style.display = 'none';
    createBtn.style.display = 'none';
    currentUserRole = null;
    if (myProjectsLink) myProjectsLink.style.display = 'none';
    if (portfolioLink) portfolioLink.style.display = 'none';
    if (adminLink) adminLink.style.display = 'none';

    document.getElementById('heroProjectBtn').href = 'auth.html';
    document.getElementById('ctaProjectBtn').href = 'auth.html';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      firebase.auth().signOut();
    });
  }
}

function loadProjects() {
  return db.collection('projects').orderBy('createdAt', 'desc').get()
    .then(snapshot => {
      cachedProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render();
      updateHeroStats();
    })
    .catch(() => {
      cachedProjects = [];
      render();
      updateHeroStats();
    });
}

function updateHeroStats() {
  const el1 = document.getElementById('projectCount');
  const el2 = document.getElementById('investorCount');
  const el3 = document.getElementById('todaySuccess');
  const done = cachedProjects.filter(p => p.raised >= p.goal).length;
  if (el1) el1.textContent = cachedProjects.length;
  if (el3) el3.textContent = done;
  if (el2) {
    db.collection('users').get().then(snapshot => {
      el2.textContent = snapshot.size;
    }).catch(() => {
      el2.textContent = '0';
    });
  }
}

const state = { category: 'all', stage: 'all', sort: 'trending' };

function initProjectFeed() {
  const grid = document.getElementById('projectGrid');
  if (!grid) return;
  const emptyState = document.getElementById('emptyState');
  const categoryFilter = document.getElementById('categoryFilter');
  const stageFilter = document.getElementById('stageFilter');
  const sortGroup = document.getElementById('sortGroup');

  categoryFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    categoryFilter.querySelectorAll('.btn').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.category = btn.dataset.category;
    render();
  });

  stageFilter.addEventListener('change', (e) => {
    state.stage = e.target.value;
    render();
  });

  sortGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    sortGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.sort = btn.dataset.sort;
    render();
  });

  window.render = function() {
    let list = cachedProjects.filter(p => {
      const matchCategory = state.category === 'all' || p.category === state.category;
      const matchStage = state.stage === 'all' || p.stage === state.stage;
      return matchCategory && matchStage;
    });
    if (state.sort === 'trending') list.sort((a, b) => (b.raised / b.goal) - (a.raised / a.goal));
    else if (state.sort === 'ending') list.sort((a, b) => a.daysLeft - b.daysLeft);
    else if (state.sort === 'newest') list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    grid.innerHTML = list.map(renderCard).join('');
    emptyState.hidden = list.length !== 0;
  };

  render();
}

function renderCard(p) {
  const pct = Math.min(Math.round((p.raised / p.goal) * 100), 100);
  const stageLabel = { idea: 'Idea', mvp: 'MVP', growth: 'Growth', scale: 'Scale' }[p.stage];
  const stageClass = { idea: 'bg-warning text-dark', mvp: 'bg-primary text-white', growth: 'bg-info text-dark', scale: 'bg-info text-dark' }[p.stage];
  const daysText = p.raised >= p.goal ? 'Đã đủ vốn' : `Còn ${p.daysLeft} ngày`;

  return `
    <div class="col-md-6 col-lg-4">
      <div class="card border shadow-sm h-100 project-card" onclick="window.location.href='project.html?id=${p.id}'" style="cursor:pointer">
        ${p.coverImage ? `<img src="${p.coverImage}" class="card-img-top" alt="${p.name}">` : ''}
        <div class="card-body d-flex flex-column gap-2">
          <div class="d-flex align-items-center gap-1 mb-1 flex-wrap">
            <span class="badge ${stageClass}">${stageLabel}</span>
            ${p.tags.filter(t => t !== stageLabel).slice(0, 3).map(t => `<span class="badge bg-light text-secondary border">${t}</span>`).join('')}
          </div>
          <h5 class="card-title mb-0">${p.name}</h5>
          <p class="card-text text-muted small flex-grow-1">${p.desc}</p>
          <div class="progress" style="height:6px">
            <div class="progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="d-flex justify-content-between small">
            <span class="fw-semibold">${pct}% · ${formatCurrency(p.raised)}</span>
            <span class="text-muted">${daysText}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatNumber(n) { return n.toLocaleString('vi-VN'); }
function formatCurrency(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ đ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr đ';
  return formatNumber(n) + ' đ';
}

function showErr(el, msg) {
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => el.hidden = true, 4000);
}

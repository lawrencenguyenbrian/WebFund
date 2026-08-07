const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();
});

function initAuthUI() {
  const userMenu = document.getElementById('userMenu');
  const userDropdown = document.getElementById('userDropdown');
  const myProjectsLink = document.getElementById('myProjectsLink');
  const portfolioLink = document.getElementById('portfolioLink');
  const adminLink = document.getElementById('adminLink');
  const logoutBtn = document.getElementById('logoutBtn');

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      userMenu.style.display = 'block';
      userDropdown.textContent = user.displayName || user.email || 'User';
      loadPortfolio(user.uid);

      db.collection('users').doc(user.uid).get().then(doc => {
        const role = doc.exists ? doc.data().role : null;
        if (role === 'investor') {
          if (myProjectsLink) myProjectsLink.style.display = 'none';
          if (portfolioLink) portfolioLink.style.display = 'block';
        } else {
          if (myProjectsLink) myProjectsLink.style.display = 'block';
          if (portfolioLink) portfolioLink.style.display = 'none';
        }
        if (adminLink) adminLink.style.display = role === 'admin' ? 'block' : 'none';
      }).catch(() => {});
    } else {
      window.location.href = 'auth.html';
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => firebase.auth().signOut());
  }
}

function loadPortfolio(uid) {
  db.collection('pledges').where('userId', '==', uid).get()
    .then(snapshot => {
      document.getElementById('loadingState').hidden = true;
      if (snapshot.empty) {
        document.getElementById('emptyState').hidden = false;
        return;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderStats(list);
      renderPledgeList(list);
    })
    .catch(() => {
      document.getElementById('loadingState').hidden = true;
      document.getElementById('emptyState').hidden = false;
    });
}

function renderStats(pledges) {
  document.getElementById('portfolioStats').hidden = false;
  document.getElementById('statTotalPledges').textContent = pledges.length;

  const totalAmount = pledges.reduce((sum, p) => sum + (p.amount || 0), 0);
  document.getElementById('statTotalAmount').textContent = formatCurrency(totalAmount);

  const confirmed = pledges.filter(p => p.status === 'confirmed').length;
  document.getElementById('statConfirmed').textContent = confirmed;
}

function renderPledgeList(pledges) {
  const container = document.getElementById('pledgeList');
  container.hidden = false;

  const statusMap = {
    pending: { label: 'Chờ xác nhận', class: 'bg-warning text-dark' },
    confirmed: { label: 'Đã xác nhận', class: 'bg-success text-white' },
    rejected: { label: 'Từ chối', class: 'bg-danger text-white' }
  };

  const methodMap = {
    bank_transfer: 'Chuyển khoản',
    skill: 'Góp kỹ năng'
  };

  container.innerHTML = pledges.map(p => {
    const st = statusMap[p.status] || statusMap.pending;
    const created = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('vi-VN') : '';

    let perkBadge = '';
    if (p.status === 'confirmed' && p.wantsPerk && p.perkTier) {
      let text = p.perkTier.title;
      if (p.perkGrantedUntil) {
        const until = p.perkGrantedUntil.toDate ? p.perkGrantedUntil.toDate() : new Date(p.perkGrantedUntil);
        text += until.getTime() > Date.now()
          ? ` · còn hạn đến ${formatDate(until)}`
          : ' · đã hết hạn';
      }
      perkBadge = `<span class="badge bg-info text-dark">${text}</span>`;
    }

    return `
      <div class="pledge-row">
        <div class="pledge-row-body">
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="badge ${st.class}">${st.label}</span>
            <span class="small text-muted">${methodMap[p.method] || p.method}</span>
            ${perkBadge}
            <span class="small text-muted">${created}</span>
          </div>
          <h6 class="mb-1">
            <a href="project.html?id=${p.projectId}" class="text-decoration-none pledge-project-link">${p.projectName}</a>
          </h6>
          ${p.skill ? `<div class="small text-muted mb-1"><i class="bi bi-laptop"></i> Kỹ năng: ${p.skill}</div>` : ''}
          ${p.note ? `<div class="small text-muted">${p.note}</div>` : ''}
        </div>
        <div class="pledge-row-amount">
          ${p.amount ? formatCurrency(p.amount) : '<span class="text-muted">Kỹ năng</span>'}
        </div>
      </div>
    `;
  }).join('');
}

function formatCurrency(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ ₫';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr ₫';
  return (n || 0).toLocaleString('vi-VN') + ' ₫';
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

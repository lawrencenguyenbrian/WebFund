const db = firebase.firestore();
let allPledges = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();
  initFilters();
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
      checkAdmin(user.uid);

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

function checkAdmin(uid) {
  db.collection('users').doc(uid).get()
    .then(doc => {
      if (doc.exists && doc.data().role === 'admin') {
        document.getElementById('loadingState').hidden = true;
        document.getElementById('adminContent').hidden = false;
        loadPledges();
      } else {
        document.getElementById('loadingState').hidden = true;
        document.getElementById('notAdminState').hidden = false;
      }
    })
    .catch(() => {
      document.getElementById('loadingState').hidden = true;
      document.getElementById('notAdminState').hidden = false;
    });
}

function loadPledges() {
  db.collection('pledges').get()
    .then(snapshot => {
      if (snapshot.empty) {
        document.getElementById('emptyPledges').hidden = false;
        return;
      }
      allPledges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      allPledges.sort((a, b) => (b.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      renderPledges();
    })
    .catch(() => {
      document.getElementById('emptyPledges').hidden = false;
    });
}

function initFilters() {
  document.getElementById('filterAll').addEventListener('click', (e) => {
    currentFilter = 'all';
    updateFilterBtns(e.target);
    renderPledges();
  });
  document.getElementById('filterPending').addEventListener('click', (e) => {
    currentFilter = 'pending';
    updateFilterBtns(e.target);
    renderPledges();
  });
  document.getElementById('filterConfirmed').addEventListener('click', (e) => {
    currentFilter = 'confirmed';
    updateFilterBtns(e.target);
    renderPledges();
  });
}

function updateFilterBtns(active) {
  document.querySelectorAll('.admin-hero .btn').forEach(b => b.classList.remove('is-active'));
  active.classList.add('is-active');
}

function renderPledges() {
  let list = allPledges;
  if (currentFilter !== 'all') {
    list = list.filter(p => p.status === currentFilter);
  }

  if (!list.length) {
    document.getElementById('pledgeTable').hidden = true;
    document.getElementById('emptyPledges').hidden = false;
    return;
  }

  document.getElementById('emptyPledges').hidden = true;
  document.getElementById('pledgeTable').hidden = false;

  const statusMap = {
    pending: { label: 'Chờ xác nhận', class: 'bg-warning text-dark' },
    confirmed: { label: 'Đã xác nhận', class: 'bg-success text-white' },
    rejected: { label: 'Từ chối', class: 'bg-danger text-white' }
  };

  const methodMap = { bank_transfer: 'Chuyển khoản', skill: 'Góp kỹ năng' };

  document.getElementById('pledgeTableBody').innerHTML = list.map(p => {
    const st = statusMap[p.status] || statusMap.pending;
    const created = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('vi-VN') : '';

    return `
      <tr>
        <td>
          <div class="fw-semibold">${p.userName || 'N/A'}</div>
          <div class="small text-muted">${p.userEmail || ''}</div>
        </td>
        <td>
          <a href="project.html?id=${p.projectId}" class="text-decoration-none fw-semibold">${p.projectName}</a>
        </td>
        <td class="fw-semibold">${p.amount ? formatCurrency(p.amount) : '<span class="text-muted">Kỹ năng</span>'}</td>
        <td>${methodMap[p.method] || p.method}</td>
        <td><span class="badge ${st.class}">${st.label}</span></td>
        <td>
          ${p.status === 'pending' ? `
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-success" onclick="confirmPledge('${p.id}')" title="Xác nhận">
                <i class="bi bi-check-lg"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="rejectPledge('${p.id}')" title="Từ chối">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          ` : `<span class="small text-muted">${created}</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

async function confirmPledge(id) {
  const pledge = allPledges.find(p => p.id === id);
  if (!pledge) return;

  try {
    await db.collection('pledges').doc(id).update({ status: 'confirmed' });

    if (pledge.amount && pledge.projectId) {
      const projRef = db.collection('projects').doc(pledge.projectId);
      await projRef.update({
        raised: firebase.firestore.FieldValue.increment(pledge.amount)
      });
    }

    pledge.status = 'confirmed';
    renderPledges();
    showToast('Đã xác nhận pledge');
  } catch (e) {
    showToast('Lỗi: ' + e.message);
  }
}

async function rejectPledge(id) {
  try {
    await db.collection('pledges').doc(id).update({ status: 'rejected' });
    const pledge = allPledges.find(p => p.id === id);
    if (pledge) pledge.status = 'rejected';
    renderPledges();
    showToast('Đã từ chối pledge');
  } catch (e) {
    showToast('Lỗi: ' + e.message);
  }
}

function formatCurrency(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ ₫';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr ₫';
  return (n || 0).toLocaleString('vi-VN') + ' ₫';
}

function showToast(msg) {
  const toast = document.getElementById('errorToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

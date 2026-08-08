const db = firebase.firestore();
let allPledges = [];
let allPendingProjects = [];
let allVerificationRequests = [];
let verificationProfiles = {};
let verifiedUserIds = new Set();
let currentFilter = 'all';

const PLATFORM_FEE_PCT = 0.05;
const FEATURED_DAYS = 7;

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
        loadPendingProjects();
        loadVerificationRequests();
        loadDeleteRequests();
        loadDeletedProjects();
        loadPayoutRequests();
        loadFeaturedRequests();
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
      loadVerifiedUsers();
      renderPledges();
    })
    .catch(() => {
      document.getElementById('emptyPledges').hidden = false;
    });
}

function loadVerifiedUsers() {
  verifiedUserIds = new Set();
  const uids = [...new Set(allPledges.map(p => p.userId).filter(Boolean))];
  if (!uids.length) return;
  Promise.all(uids.map(uid => db.collection('users').doc(uid).get()))
    .then(docs => {
      docs.forEach(doc => {
        if (doc.exists && doc.data().verified) verifiedUserIds.add(doc.id);
      });
      renderPledges();
    })
    .catch(() => {});
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
          <div class="fw-semibold">${p.userName || 'N/A'}${verifiedUserIds.has(p.userId) ? ' <i class="bi bi-patch-check-fill text-primary" title="Đã xác minh"></i>' : ''}</div>
          <div class="small text-muted">${p.userEmail || ''}</div>
        </td>
        <td>
          <a href="project.html?id=${p.projectId}" class="text-decoration-none fw-semibold">${p.projectName}</a>
        </td>
        <td class="fw-semibold">${p.amount ? formatCurrency(p.amount) : '<span class="text-muted">Kỹ năng</span>'}</td>
        <td>${methodMap[p.method] || p.method}</td>
        <td>
          <span class="badge ${st.class}">${st.label}</span>
          ${p.wantsPerk && p.perkTier ? `<span class="badge bg-info text-dark d-block mt-1">${p.perkTier.title}</span>` : ''}
        </td>
        <td>
          ${p.status === 'pending' ? `
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-success" onclick="confirmPledge('${p.id}', this)" title="Xác nhận">
                <i class="bi bi-check-lg"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="rejectPledge('${p.id}', this)" title="Từ chối">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          ` : `<span class="small text-muted">${created}</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

async function confirmPledge(id, btn) {
  if (btn) btn.disabled = true;
  const pledge = allPledges.find(p => p.id === id);
  if (!pledge) return;

  try {
    await db.runTransaction(async (tx) => {
      const pledgeRef = db.collection('pledges').doc(id);
      const pledgeSnap = await tx.get(pledgeRef);
      if (!pledgeSnap.exists) throw new Error('Pledge không tồn tại');

      const data = pledgeSnap.data();
      if (data.status !== 'pending') throw new Error('Pledge đã được xử lý trước đó');

      const updateData = { status: 'confirmed' };
      if (data.wantsPerk && data.perkTier && data.perkTier.durationMonths) {
        updateData.perkGrantedUntil = new Date(Date.now() + data.perkTier.durationMonths * 30 * 24 * 60 * 60 * 1000);
      }
      tx.update(pledgeRef, updateData);

      if (data.amount && data.projectId) {
        tx.update(db.collection('projects').doc(data.projectId), {
          raised: firebase.firestore.FieldValue.increment(data.amount)
        });
      }
    });

    pledge.status = 'confirmed';
    renderPledges();
    showToast('Đã xác nhận pledge');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

async function rejectPledge(id, btn) {
  if (btn) btn.disabled = true;
  try {
    await db.collection('pledges').doc(id).update({ status: 'rejected' });
    const pledge = allPledges.find(p => p.id === id);
    if (pledge) pledge.status = 'rejected';
    renderPledges();
    showToast('Đã từ chối pledge');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

function formatCurrency(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ ₫';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr ₫';
  return (n || 0).toLocaleString('vi-VN') + ' ₫';
}

function loadVerificationRequests() {
  db.collection('verificationRequests').where('status', '==', 'pending').get()
    .then(snapshot => {
      if (snapshot.empty) {
        document.getElementById('emptyVerification').hidden = false;
        return;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      return Promise.all(list.map(r =>
        db.collection('users').doc(r.userId).get()
          .then(doc => { verificationProfiles[r.userId] = doc.exists ? doc.data() : null; })
          .catch(() => { verificationProfiles[r.userId] = null; })
      )).then(() => renderVerificationRequests(list));
    })
    .catch(() => {
      document.getElementById('emptyVerification').hidden = false;
    });
}

function renderVerificationRequests(list) {
  allVerificationRequests = list;
  document.getElementById('emptyVerification').hidden = true;
  document.getElementById('verificationTable').hidden = false;

  document.getElementById('verificationTableBody').innerHTML = list.map(r => {
    const submitted = r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleString('vi-VN') : '';
    const profile = verificationProfiles[r.userId] || {};
    const roleLabel = profile.role === 'investor' ? 'Nhà đầu tư' : profile.role === 'admin' ? 'Admin' : 'Founder';
    return `
      <tr>
        <td>
          <div class="fw-semibold">${r.userName || 'N/A'}${profile.verified ? ' <i class="bi bi-patch-check-fill text-primary" title="Đã xác minh"></i>' : ''}</div>
          <div class="small text-muted">${r.userEmail || ''}</div>
          <span class="badge ${profile.role === 'admin' ? 'bg-danger' : 'bg-primary-subtle text-primary'}">${roleLabel}</span>
        </td>
        <td>
          ${r.idPhotoUrl
            ? `<img src="${r.idPhotoUrl}" alt="Ảnh xác minh" class="verification-thumb" onclick="viewVerificationPhoto('${r.userId}')">`
            : '<span class="small text-muted">—</span>'}
        </td>
        <td class="small text-muted">${submitted}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-primary" onclick="viewVerificationProfile('${r.userId}')" title="Xem hồ sơ">
              <i class="bi bi-person"></i>
            </button>
            <button class="btn btn-sm btn-success" onclick="approveVerification('${r.userId}', this)" title="Duyệt">
              <i class="bi bi-check-lg"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="rejectVerification('${r.userId}', this)" title="Từ chối">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function viewVerificationProfile(uid) {
  const p = verificationProfiles[uid] || {};
  const req = allVerificationRequests.find(r => r.id === uid) || {};

  const avatarEl = document.getElementById('vpAvatar');
  if (p.avatarUrl) {
    avatarEl.innerHTML = `<img src="${p.avatarUrl}" alt="Ảnh đại diện">`;
  } else {
    avatarEl.textContent = (p.name || req.userName || 'U')[0].toUpperCase();
  }

  document.getElementById('vpName').innerHTML = (p.name || req.userName || '—')
    + (p.verified ? ' <i class="bi bi-patch-check-fill text-primary" title="Đã xác minh"></i>' : '');
  document.getElementById('vpEmail').textContent = p.email || req.userEmail || '—';

  const roleMap = {
    founder: { label: 'Founder', cls: 'bg-primary' },
    investor: { label: 'Nhà đầu tư', cls: 'bg-primary' },
    admin: { label: 'Admin', cls: 'bg-danger' }
  };
  const role = roleMap[p.role] || { label: '—', cls: 'bg-secondary' };
  document.getElementById('vpRole').textContent = role.label;
  document.getElementById('vpRole').className = 'badge ' + role.cls;

  document.getElementById('vpBio').textContent = p.bio || '—';
  document.getElementById('vpLocation').textContent = p.location || '—';
  document.getElementById('vpWebsite').innerHTML = p.website
    ? `<a href="${p.website}" target="_blank" rel="noopener" class="text-decoration-none">${p.website}</a>`
    : '—';

  const social = p.socialLinks || {};
  const socialParts = [];
  if (social.facebook) socialParts.push(`<a href="${social.facebook}" target="_blank" rel="noopener" class="text-decoration-none"><i class="bi bi-facebook"></i> Facebook</a>`);
  if (social.linkedin) socialParts.push(`<a href="${social.linkedin}" target="_blank" rel="noopener" class="text-decoration-none"><i class="bi bi-linkedin"></i> LinkedIn</a>`);
  document.getElementById('vpSocial').innerHTML = socialParts.length ? socialParts.join(' · ') : '—';

  const createdAt = p.createdAt;
  document.getElementById('vpJoined').textContent = createdAt
    ? (createdAt.toDate ? createdAt.toDate() : new Date(createdAt)).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  document.getElementById('vpUid').textContent = uid;

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('verificationProfileModal'));
  modal.show();
}

function viewVerificationPhoto(uid) {
  const req = allVerificationRequests.find(r => r.id === uid);
  if (!req?.idPhotoUrl) return;
  document.getElementById('verificationPhotoFull').src = req.idPhotoUrl;
  const modalEl = document.getElementById('verificationPhotoModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function approveVerification(uid, btn) {
  if (btn) btn.disabled = true;
  try {
    await db.runTransaction(async (tx) => {
      const reqRef = db.collection('verificationRequests').doc(uid);
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) throw new Error('Yêu cầu không tồn tại');
      if (reqSnap.data().status !== 'pending') throw new Error('Yêu cầu đã được xử lý');

      tx.update(db.collection('users').doc(uid), { verified: true });
      tx.update(reqRef, {
        status: 'approved',
        idPhotoUrl: firebase.firestore.FieldValue.delete()
      });
    });
    loadVerificationRequests();
    loadVerifiedUsers();
    showToast('Đã xác minh người dùng');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

async function rejectVerification(uid, btn) {
  if (btn) btn.disabled = true;
  try {
    await db.runTransaction(async (tx) => {
      const reqRef = db.collection('verificationRequests').doc(uid);
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) throw new Error('Yêu cầu không tồn tại');
      if (reqSnap.data().status !== 'pending') throw new Error('Yêu cầu đã được xử lý');

      tx.update(reqRef, {
        status: 'rejected',
        idPhotoUrl: firebase.firestore.FieldValue.delete()
      });
    });
    loadVerificationRequests();
    showToast('Đã từ chối yêu cầu xác minh');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

function loadPendingProjects() {
  db.collection('projects').where('status', '==', 'pending').get()
    .then(snapshot => {
      if (snapshot.empty) {
        document.getElementById('emptyProjects').hidden = false;
        return;
      }
      allPendingProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      allPendingProjects.sort((a, b) => (b.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      renderPendingProjects();
    })
    .catch(() => {
      document.getElementById('emptyProjects').hidden = false;
    });
}

function renderPendingProjects() {
  if (!allPendingProjects.length) {
    document.getElementById('projectTable').hidden = true;
    document.getElementById('emptyProjects').hidden = false;
    return;
  }

  document.getElementById('emptyProjects').hidden = true;
  document.getElementById('projectTable').hidden = false;

  document.getElementById('projectTableBody').innerHTML = allPendingProjects.map(p => {
    const created = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('vi-VN') : '';

    return `
      <tr>
        <td>
          <div class="fw-semibold">
            <a href="project.html?id=${p.id}" class="text-decoration-none">${p.name}</a>
          </div>
          <div class="small text-muted">${p.tagline || ''}</div>
        </td>
        <td>${p.userName || 'N/A'}</td>
        <td class="fw-semibold">${formatCurrency(p.goal)}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-success" onclick="approveProject('${p.id}', this)" title="Duyệt">
              <i class="bi bi-check-lg"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="rejectProject('${p.id}', this)" title="Từ chối">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <span class="small text-muted ms-1">${created}</span>
        </td>
      </tr>
    `;
  }).join('');
}

async function approveProject(id, btn) {
  if (btn) btn.disabled = true;
  try {
    await db.collection('projects').doc(id).update({ status: 'approved' });
    allPendingProjects = allPendingProjects.filter(p => p.id !== id);
    renderPendingProjects();
    showToast('Đã duyệt dự án');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

async function rejectProject(id, btn) {
  if (btn) btn.disabled = true;
  try {
    await db.collection('projects').doc(id).update({ status: 'rejected' });
    allPendingProjects = allPendingProjects.filter(p => p.id !== id);
    renderPendingProjects();
    showToast('Đã từ chối dự án');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

function loadDeleteRequests() {
  db.collection('projects').where('deleteRequested', '!=', null).get()
    .then(snapshot => {
      if (snapshot.empty) {
        document.getElementById('emptyDeleteRequests').hidden = false;
        return;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.deleteRequested?.seconds || 0) - (a.deleteRequested?.seconds || 0));
      renderDeleteRequests(list);
    })
    .catch(() => {
      document.getElementById('emptyDeleteRequests').hidden = false;
    });
}

function renderDeleteRequests(list) {
  document.getElementById('emptyDeleteRequests').hidden = true;
  document.getElementById('deleteRequestTable').hidden = false;

  document.getElementById('deleteRequestTableBody').innerHTML = list.map(p => {
    const requested = p.deleteRequested?.toDate ? p.deleteRequested.toDate().toLocaleString('vi-VN') : '';

    return `
      <tr>
        <td>
          <div class="fw-semibold">
            <a href="project.html?id=${p.id}" class="text-decoration-none">${p.name}</a>
          </div>
          <div class="small text-muted">${p.tagline || ''}</div>
        </td>
        <td>${p.userName || 'N/A'}</td>
        <td class="fw-semibold">${formatCurrency(p.goal)}</td>
        <td class="small text-muted">${requested}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-danger" onclick="approveDelete('${p.id}', this)" title="Duyệt xóa">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-secondary" onclick="rejectDelete('${p.id}', this)" title="Từ chối yêu cầu">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function approveDelete(id, btn) {
  if (btn) btn.disabled = true;
  const user = firebase.auth().currentUser;
  try {
    const snap = await db.collection('projects').doc(id).get();
    if (!snap.exists) throw new Error('Dự án không tồn tại');

    const data = snap.data();

    await db.collection('deletedProjects').doc(id).set({
      ...data,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deletedBy: user.uid,
      deletedByEmail: user.email || ''
    });

    await db.collection('projects').doc(id).delete();
    loadDeleteRequests();
    showToast('Đã xóa dự án (đã lưu nhật ký)');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

async function rejectDelete(id, btn) {
  if (btn) btn.disabled = true;
  try {
    await db.collection('projects').doc(id).update({
      deleteRequested: firebase.firestore.FieldValue.delete(),
      deleteRequestedBy: firebase.firestore.FieldValue.delete()
    });
    loadDeleteRequests();
    showToast('Đã từ chối yêu cầu xóa');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

function loadPayoutRequests() {
  db.collection('projects').where('payoutRequestedAt', '!=', null).get()
    .then(snapshot => {
      if (snapshot.empty) {
        document.getElementById('emptyPayoutRequests').hidden = false;
        return;
      }
      let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list = list.filter(p => p.payoutStatus !== 'paid');
      if (!list.length) {
        document.getElementById('emptyPayoutRequests').hidden = false;
        return;
      }
      list.sort((a, b) => (b.payoutRequestedAt?.seconds || 0) - (a.payoutRequestedAt?.seconds || 0));
      renderPayoutRequests(list);
    })
    .catch(() => {
      document.getElementById('emptyPayoutRequests').hidden = false;
    });
}

function renderPayoutRequests(list) {
  document.getElementById('emptyPayoutRequests').hidden = true;
  document.getElementById('payoutTable').hidden = false;

  document.getElementById('payoutTableBody').innerHTML = list.map(p => {
    const requested = p.payoutRequestedAt?.toDate ? p.payoutRequestedAt.toDate().toLocaleString('vi-VN') : '';
    const feeAmount = Math.round(p.raised * PLATFORM_FEE_PCT);

    return `
      <tr>
        <td>
          <div class="fw-semibold">
            <a href="project.html?id=${p.id}" class="text-decoration-none">${p.name}</a>
          </div>
          <div class="small text-muted">${p.tagline || ''}</div>
        </td>
        <td>${p.userName || 'N/A'}</td>
        <td class="fw-semibold">${formatCurrency(p.raised)}</td>
        <td class="fw-semibold">${formatCurrency(feeAmount)}</td>
        <td class="small text-muted">${requested}</td>
        <td>
          <button class="btn btn-sm btn-success" onclick="confirmPayout('${p.id}', this)" title="Xác nhận đã nhận phí">
            <i class="bi bi-check-lg"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function confirmPayout(id, btn) {
  if (btn) btn.disabled = true;
  try {
    const snap = await db.collection('projects').doc(id).get();
    if (!snap.exists) throw new Error('Dự án không tồn tại');
    const data = snap.data();
    const feeAmount = Math.round(data.raised * PLATFORM_FEE_PCT);

    await db.collection('projects').doc(id).update({
      payoutStatus: 'paid',
      payoutConfirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
      feeAmount
    });
    loadPayoutRequests();
    showToast('Đã xác nhận phí, dự án được rút vốn');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

function loadFeaturedRequests() {
  db.collection('projects').where('featuredRequested', '!=', null).get()
    .then(snapshot => {
      if (snapshot.empty) {
        document.getElementById('emptyFeaturedRequests').hidden = false;
        return;
      }
      let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list = list.filter(p => !p.featured);
      if (!list.length) {
        document.getElementById('emptyFeaturedRequests').hidden = false;
        return;
      }
      list.sort((a, b) => (b.featuredRequested?.seconds || 0) - (a.featuredRequested?.seconds || 0));
      renderFeaturedRequests(list);
    })
    .catch(() => {
      document.getElementById('emptyFeaturedRequests').hidden = false;
    });
}

function renderFeaturedRequests(list) {
  document.getElementById('emptyFeaturedRequests').hidden = true;
  document.getElementById('featuredRequestTable').hidden = false;

  document.getElementById('featuredRequestTableBody').innerHTML = list.map(p => {
    const requested = p.featuredRequested?.toDate ? p.featuredRequested.toDate().toLocaleString('vi-VN') : '';

    return `
      <tr>
        <td>
          <div class="fw-semibold">
            <a href="project.html?id=${p.id}" class="text-decoration-none">${p.name}</a>
          </div>
          <div class="small text-muted">${p.tagline || ''}</div>
        </td>
        <td>${p.userName || 'N/A'}</td>
        <td class="small text-muted">${requested}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-success" onclick="approveFeature('${p.id}', this)" title="Duyệt nổi bật">
              <i class="bi bi-check-lg"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="rejectFeature('${p.id}', this)" title="Từ chối yêu cầu">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function approveFeature(id, btn) {
  if (btn) btn.disabled = true;
  try {
    const until = new Date(Date.now() + FEATURED_DAYS * 24 * 60 * 60 * 1000);
    await db.collection('projects').doc(id).update({
      featured: true,
      featuredUntil: until,
      featuredRequested: firebase.firestore.FieldValue.delete()
    });
    loadFeaturedRequests();
    showToast('Đã duyệt dự án nổi bật');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

async function rejectFeature(id, btn) {
  if (btn) btn.disabled = true;
  try {
    await db.collection('projects').doc(id).update({
      featuredRequested: firebase.firestore.FieldValue.delete()
    });
    loadFeaturedRequests();
    showToast('Đã từ chối yêu cầu nổi bật');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

function loadDeletedProjects() {
  db.collection('deletedProjects').get()
    .then(snapshot => {
      if (snapshot.empty) {
        document.getElementById('emptyDeleted').hidden = false;
        return;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0));
      renderDeletedProjects(list);
    })
    .catch(() => {
      document.getElementById('emptyDeleted').hidden = false;
    });
}

function renderDeletedProjects(list) {
  document.getElementById('emptyDeleted').hidden = true;
  document.getElementById('deletedTable').hidden = false;

  document.getElementById('deletedTableBody').innerHTML = list.map(p => {
    const deletedAt = p.deletedAt?.toDate ? p.deletedAt.toDate().toLocaleString('vi-VN') : '';
    const restored = !!p.restoredAt;

    return `
      <tr>
        <td>
          <div class="fw-semibold">${p.name || 'N/A'}</div>
          <div class="small text-muted">${p.tagline || ''}</div>
        </td>
        <td>${p.userName || 'N/A'}</td>
        <td class="fw-semibold">${formatCurrency(p.goal)}</td>
        <td class="small text-muted">${deletedAt}</td>
        <td class="small text-muted">${p.deletedByEmail || 'N/A'}</td>
        <td>
          ${restored
            ? '<span class="badge bg-success text-white">Đã khôi phục</span>'
            : `<button class="btn btn-sm btn-outline-success" onclick="restoreProject('${p.id}', this)" title="Khôi phục dự án"><i class="bi bi-arrow-counterclockwise"></i></button>`}
        </td>
      </tr>
    `;
  }).join('');
}

async function restoreProject(id, btn) {
  if (btn) btn.disabled = true;
  const user = firebase.auth().currentUser;
  try {
    const snap = await db.collection('deletedProjects').doc(id).get();
    if (!snap.exists) throw new Error('Không tìm thấy dự án đã xóa');

    const data = snap.data();
    if (data.restoredAt) throw new Error('Dự án này đã được khôi phục');

    const { deletedAt, deletedBy, deletedByEmail, ...rest } = data;

    await db.collection('projects').doc(id).set({
      ...rest,
      deleteRequested: firebase.firestore.FieldValue.delete(),
      deleteRequestedBy: firebase.firestore.FieldValue.delete(),
      restoredAt: firebase.firestore.FieldValue.serverTimestamp(),
      restoredBy: user.uid,
      restoredByEmail: user.email || ''
    }, { merge: true });

    await db.collection('deletedProjects').doc(id).update({
      restoredAt: firebase.firestore.FieldValue.serverTimestamp(),
      restoredBy: user.uid,
      restoredByEmail: user.email || ''
    });

    loadDeletedProjects();
    showToast('Đã khôi phục dự án');
  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Lỗi: ' + e.message);
  }
}

function showToast(msg) {
  const toast = document.getElementById('errorToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

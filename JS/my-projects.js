const db = firebase.firestore();

const PLATFORM_FEE_PCT = 0.05;
const FEATURED_PRICE = 200000;
const FEATURED_DAYS = 7;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();

  const submitBtn = document.getElementById('submitUpdateBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const projectId = document.getElementById('updateProjectId').value;
      const title = document.getElementById('updateTitle').value.trim();
      const content = document.getElementById('updateContent').value.trim();
      const errEl = document.getElementById('updateError');

      if (!title || !content) {
        errEl.textContent = 'Vui lòng nhập đầy đủ tiêu đề và nội dung.';
        errEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang đăng...';

      try {
        const updateRef = db.collection('projects').doc(projectId).collection('updates').doc();
        await updateRef.set({
          title,
          content,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('projects').doc(projectId).update({
          lastUpdate: { title, content, createdAt: firebase.firestore.FieldValue.serverTimestamp() }
        });

        bootstrap.Modal.getInstance(document.getElementById('updateModal')).hide();
        showToast('Đăng cập nhật thành công!');
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng cập nhật';
      }
    });
  }
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
      loadMyProjects(user.uid);

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

function loadMyProjects(uid) {
  db.collection('projects').where('userId', '==', uid).get()
    .then(snapshot => {
      document.getElementById('loadingState').hidden = true;
      if (snapshot.empty) {
        document.getElementById('emptyState').hidden = false;
        return;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderProjectList(list);
    })
    .catch(() => {
      document.getElementById('loadingState').hidden = true;
      document.getElementById('emptyState').hidden = false;
    });
}

function renderProjectList(projects) {
  const container = document.getElementById('projectList');
  container.hidden = false;

  container.innerHTML = projects.map(p => {
    const pct = Math.min(Math.round((p.raised / p.goal) * 100), 100);
    const stageMap = { idea: 'Idea', mvp: 'MVP', growth: 'Growth', scale: 'Scale' };
    const stageClass = { idea: 'bg-warning text-dark', mvp: 'bg-primary text-white', growth: 'bg-info text-dark', scale: 'bg-success text-white' };
    const statusMap = {
      pending: { label: 'Chờ duyệt', class: 'bg-warning text-dark' },
      approved: { label: 'Đã duyệt', class: 'bg-success text-white' },
      rejected: { label: 'Từ chối', class: 'bg-danger text-white' }
    };
    const daysText = p.raised >= p.goal ? 'Đã đủ vốn' : `Còn ${getDaysLeft(p)} ngày`;
    const created = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('vi-VN') : '';
    const lastUpdate = p.lastUpdate;
    const deleting = !!p.deleteRequested;

    const payoutBadge = p.payoutStatus === 'paid'
      ? '<span class="badge bg-success text-white">Đã rút vốn</span>'
      : p.payoutRequestedAt
        ? '<span class="badge bg-warning text-dark" title="Đang chờ quản trị viên xác nhận phí"><i class="bi bi-hourglass-split"></i> Chờ thanh toán phí</span>'
        : '';
    const featuredBadge = (p.featured && p.featuredUntil?.toDate() > new Date())
      ? '<span class="badge bg-info text-dark"><i class="bi bi-star-fill"></i> Nổi bật</span>'
      : p.featuredRequested
        ? '<span class="badge bg-info text-dark">Chờ nổi bật</span>'
        : '';
    const canRequestPayout = p.raised >= p.goal && !p.payoutRequestedAt && p.payoutStatus !== 'paid';
    const canRequestFeature = p.status === 'approved' && !p.featuredRequested && !(p.featured && p.featuredUntil?.toDate() > new Date());

    let updateHtml = '';
    if (lastUpdate) {
      const date = lastUpdate.createdAt?.toDate ? lastUpdate.createdAt.toDate().toLocaleDateString('vi-VN') : '';
      updateHtml = `
        <div class="project-row-update mt-2 p-2 rounded">
          <div class="d-flex align-items-center gap-1 small mb-1">
            <i class="bi bi-megaphone text-primary"></i>
            <strong>${lastUpdate.title}</strong>
            <span class="text-muted ms-auto">${date}</span>
          </div>
          <p class="small text-muted mb-0">${lastUpdate.content}</p>
        </div>
      `;
    }

    return `
      <div class="project-row">
        <img src="${p.coverImage || ''}" alt="${p.name}" class="project-row-cover">
        <div class="project-row-body">
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="badge ${stageClass[p.stage] || 'bg-secondary'}">${stageMap[p.stage] || p.stage}</span>
            ${statusMap[p.status] ? `<span class="badge ${statusMap[p.status].class}">${statusMap[p.status].label}</span>` : ''}
            ${payoutBadge}
            ${featuredBadge}
            ${deleting ? '<span class="badge bg-warning text-dark" title="Đang chờ quản trị viên duyệt"><i class="bi bi-hourglass-split"></i> Chờ xóa</span>' : ''}
            <span class="small text-muted">${daysText}</span>
          </div>
          <h5 class="mb-1"><a href="project.html?id=${p.id}" class="text-decoration-none project-row-title">${p.name}</a></h5>
          <p class="text-muted small mb-2">${p.tagline || ''}</p>
          <div class="progress mb-1" style="height:5px">
            <div class="progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="d-flex justify-content-between small">
            <span class="fw-semibold">${pct}% · ${formatCurrency(p.raised)}</span>
            <span class="text-muted">mục tiêu ${formatCurrency(p.goal)}</span>
          </div>
          ${updateHtml}
        </div>
        <div class="project-row-actions">
          <a href="project.html?id=${p.id}" class="btn btn-sm btn-outline-primary">Xem</a>
          <a href="post-project.html?edit=${p.id}" class="btn btn-sm btn-outline-secondary" title="Chỉnh sửa"><i class="bi bi-pencil"></i></a>
          <button class="btn btn-sm btn-outline-secondary open-update-btn" data-id="${p.id}" data-name="${p.name}">
            <i class="bi bi-megaphone"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary backers-btn" data-id="${p.id}" data-name="${p.name}" title="Người ủng hộ">
            <i class="bi bi-people"></i>
          </button>
          ${canRequestPayout ? `<button class="btn btn-sm btn-outline-success request-payout-btn" data-id="${p.id}" data-name="${p.name}" data-email="${p.email || ''}" title="Yêu cầu rút vốn"><i class="bi bi-cash-coin"></i></button>` : ''}
          ${canRequestFeature ? `<button class="btn btn-sm btn-outline-info request-feature-btn" data-id="${p.id}" data-name="${p.name}" data-email="${p.email || ''}" title="Làm nổi bật dự án"><i class="bi bi-star"></i></button>` : ''}
          ${deleting
            ? `<button class="btn btn-sm btn-outline-secondary cancel-delete-btn" data-id="${p.id}" title="Hủy yêu cầu xóa"><i class="bi bi-x-lg"></i></button>`
            : `<button class="btn btn-sm btn-outline-danger delete-btn" data-id="${p.id}" data-name="${p.name}" title="Yêu cầu xóa"><i class="bi bi-trash"></i></button>`}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.open-update-btn').forEach(btn => {
    btn.addEventListener('click', () => openUpdateModal(btn.dataset.id));
  });

  container.querySelectorAll('.backers-btn').forEach(btn => {
    btn.addEventListener('click', () => openBackersModal(btn.dataset.id, btn.dataset.name));
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => requestDelete(btn.dataset.id, btn.dataset.name, btn));
  });

  container.querySelectorAll('.cancel-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => cancelDelete(btn.dataset.id, btn));
  });

  container.querySelectorAll('.request-payout-btn').forEach(btn => {
    btn.addEventListener('click', () => requestPayout(btn.dataset.id, btn.dataset.name, btn.dataset.email, btn));
  });

  container.querySelectorAll('.request-feature-btn').forEach(btn => {
    btn.addEventListener('click', () => requestFeature(btn.dataset.id, btn.dataset.name, btn.dataset.email, btn));
  });
}

async function requestDelete(projectId, projectName, btn) {
  if (!confirm(`Bạn có chắc muốn yêu cầu xóa "${projectName}"?\nYêu cầu sẽ phải được quản trị viên duyệt trước khi dự án bị xóa.`)) return;
  btn.disabled = true;
  try {
    await db.collection('projects').doc(projectId).update({
      deleteRequested: firebase.firestore.FieldValue.serverTimestamp(),
      deleteRequestedBy: firebase.auth().currentUser.uid
    });
    showToast('Đã gửi yêu cầu xóa, chờ quản trị viên duyệt');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    btn.disabled = false;
    showToast(err.message);
  }
}

async function cancelDelete(projectId, btn) {
  if (!confirm('Hủy yêu cầu xóa dự án này?')) return;
  btn.disabled = true;
  try {
    await db.collection('projects').doc(projectId).update({
      deleteRequested: firebase.firestore.FieldValue.delete(),
      deleteRequestedBy: firebase.firestore.FieldValue.delete()
    });
    showToast('Đã hủy yêu cầu xóa');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    btn.disabled = false;
    showToast(err.message);
  }
}

function openUpdateModal(projectId) {
  document.getElementById('updateProjectId').value = projectId;
  document.getElementById('updateTitle').value = '';
  document.getElementById('updateContent').value = '';
  document.getElementById('updateError').hidden = true;
  new bootstrap.Modal(document.getElementById('updateModal')).show();
}

async function openBackersModal(projectId, projectName) {
  const body = document.getElementById('backersModalBody');
  document.getElementById('backersModalTitle').textContent = `Người ủng hộ — ${projectName}`;
  body.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
  new bootstrap.Modal(document.getElementById('backersModal')).show();

  try {
    const snap = await db.collection('pledges')
      .where('projectId', '==', projectId)
      .where('status', '==', 'confirmed')
      .get();
    const backers = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => p.perkTier);

    if (!backers.length) {
      body.innerHTML = '<p class="text-muted text-center mb-0">Chưa có nhà đầu tư nào nhận đặc quyền.</p>';
      return;
    }

    body.innerHTML = backers.map(b => `
      <div class="d-flex align-items-center justify-content-between gap-2 py-2 border-bottom">
        <div>
          <div class="fw-semibold small">${b.userName || 'Ẩn danh'}</div>
          ${b.amount ? `<div class="small text-muted">${formatCurrency(b.amount)}</div>` : ''}
        </div>
        <span class="badge bg-info text-dark">${b.perkTier.title}</span>
      </div>
    `).join('');
  } catch (err) {
    body.innerHTML = `<p class="text-danger text-center mb-0">Lỗi: ${err.message}</p>`;
  }
}

async function requestPayout(projectId, projectName, email, btn) {
  if (!confirm(`Bạn có chắc muốn yêu cầu rút vốn cho "${projectName}"?\nPhí nền tảng (${PLATFORM_FEE_PCT * 100}%) sẽ được thanh toán trước khi rút vốn.`)) return;
  btn.disabled = true;
  try {
    const snap = await db.collection('projects').doc(projectId).get();
    if (!snap.exists) throw new Error('Dự án không tồn tại');
    const p = snap.data();
    if (p.raised < p.goal || p.payoutRequestedAt || p.payoutStatus === 'paid') {
      throw new Error('Dự án chưa đủ điều kiện rút vốn');
    }
    const feeAmount = Math.round(p.raised * PLATFORM_FEE_PCT);
    await db.collection('projects').doc(projectId).update({
      payoutRequestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    openPaymentModal('Yêu cầu rút vốn', feeAmount, bankTransferContent(projectId, email));
    showToast('Đã gửi yêu cầu rút vốn, chờ quản trị viên xác nhận phí');
  } catch (err) {
    btn.disabled = false;
    showToast(err.message);
  }
}

async function requestFeature(projectId, projectName, email, btn) {
  if (!confirm(`Bạn có chắc muốn làm nổi bật "${projectName}"?\nPhí ${formatCurrency(FEATURED_PRICE)} giúp dự án xuất hiện nổi bật trong ${FEATURED_DAYS} ngày.`)) return;
  btn.disabled = true;
  try {
    await db.collection('projects').doc(projectId).update({
      featuredRequested: firebase.firestore.FieldValue.serverTimestamp()
    });
    openPaymentModal('Làm nổi bật dự án', FEATURED_PRICE, bankTransferContent(projectId, email));
    showToast('Đã gửi yêu cầu nổi bật, chờ quản trị viên duyệt');
  } catch (err) {
    btn.disabled = false;
    showToast(err.message);
  }
}

function openPaymentModal(title, amount, content) {
  document.getElementById('paymentModalTitle').textContent = title;
  document.getElementById('paymentModalAmount').textContent = formatCurrency(amount);
  document.getElementById('paymentModalContent').textContent = content;
  new bootstrap.Modal(document.getElementById('paymentModal')).show();
}

function bankTransferContent(projectId, email) {
  const user = firebase.auth().currentUser;
  return `WEBFUND ${projectId.slice(0, 8).toUpperCase()} ${email || (user ? user.email : '')}`;
}

function showToast(msg) {
  const toastEl = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
}

function formatCurrency(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ ₫';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr ₫';
  return (n || 0).toLocaleString('vi-VN') + ' ₫';
}

function getDaysLeft(p) {
  const now = Date.now();
  if (p.deadline) {
    const deadline = p.deadline.toDate ? p.deadline.toDate() : new Date(p.deadline);
    return Math.max(0, Math.ceil((deadline.getTime() - now) / (24 * 60 * 60 * 1000)));
  }
  return Math.max(0, p.daysLeft || 0);
}

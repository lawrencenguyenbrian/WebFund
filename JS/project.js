const db = firebase.firestore();
let currentProject = null;
let currentUser = null;
let currentUserRole = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();

  const deleteBtn = document.getElementById('deleteProjectBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      requestProjectDeletion();
    });
  }
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

  firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
      authBtns.style.display = 'none';
      userMenu.style.display = 'block';
      userDropdown.textContent = user.displayName || user.email || 'User';
      createBtn.style.display = 'inline-block';
      createBtn.href = 'post-project.html';
      checkOwner(user.uid);

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
        loadProject();
      }).catch(() => {
        currentUserRole = null;
        loadProject();
      });
    } else {
      currentUserRole = null;
      authBtns.style.display = 'flex';
      userMenu.style.display = 'none';
      createBtn.style.display = 'none';
      loadProject();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => firebase.auth().signOut());
  }
}

function loadProject() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    showNotFound();
    return;
  }

  db.collection('projects').doc(id).get()
    .then(doc => {
      if (!doc.exists) {
        showNotFound();
        return;
      }
      currentProject = { id: doc.id, ...doc.data() };
      renderProject(currentProject);
    })
    .catch(() => showNotFound());
}

function showNotFound() {
  document.getElementById('loadingState').hidden = true;
  document.getElementById('notFoundState').hidden = false;
}

function renderProject(p) {
  const isOwner = currentUser && p.userId === currentUser.uid;
  const isAdmin = currentUserRole === 'admin';
  if (p.status !== 'approved' && !isOwner && !isAdmin) {
    showNotFound();
    return;
  }

  document.getElementById('loadingState').hidden = true;
  document.getElementById('projectContent').hidden = false;

  document.title = `${p.name} — WebFund`;

  document.getElementById('projectCover').src = p.coverImage || '';
  document.getElementById('projectCover').alt = p.name;
  document.getElementById('projectName').textContent = p.name;
  document.getElementById('projectTagline').textContent = p.tagline || '';

  const stageMap = { idea: 'Idea', mvp: 'MVP', growth: 'Growth', scale: 'Scale' };
  const stageClass = { idea: 'bg-warning text-dark', mvp: 'bg-primary text-white', growth: 'bg-info text-dark', scale: 'bg-success text-white' };
  const stageBadge = document.getElementById('projectStageBadge');
  stageBadge.textContent = stageMap[p.stage] || p.stage;
  stageBadge.className = `badge ${stageClass[p.stage] || 'bg-secondary'}`;

  const catMap = { ecommerce: 'E-commerce', edtech: 'EdTech', fintech: 'FinTech', ai: 'AI', saas: 'SaaS', content: 'Blog / Nội dung', healthtech: 'HealthTech', proptech: 'PropTech', traveltech: 'TravelTech', other: 'Khác' };
  document.getElementById('projectCategoryBadge').textContent = catMap[p.category] || p.category;

  // Tags
  const tagsEl = document.getElementById('projectTags');
  if (p.tags && p.tags.length) {
    tagsEl.innerHTML = p.tags.map(t => `<span class="badge bg-light text-secondary border">${t}</span>`).join('');
  }

  // Description
  document.getElementById('projectDesc').innerHTML = (p.desc || '').replace(/\n/g, '<br>');

  // Gallery
  if (p.gallery && p.gallery.length) {
    document.getElementById('gallerySection').hidden = false;
    document.getElementById('projectGallery').innerHTML = p.gallery.map(url =>
      `<img src="${url}" alt="Gallery" class="gallery-img">`
    ).join('');
  }

  // Milestones
  if (p.milestones && p.milestones.length) {
    document.getElementById('milestonesSection').hidden = false;
    document.getElementById('projectMilestones').innerHTML = p.milestones.map((m, i) => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="small fw-semibold">${m.title}</div>
          ${m.date ? `<div class="small text-muted">${formatDate(m.date)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Investor perk tiers
  if (p.perkTiers && p.perkTiers.length) {
    document.getElementById('perkTiersSection').hidden = false;
    document.getElementById('projectPerkTiers').innerHTML = p.perkTiers.map(t => `
      <div class="perk-tier-item p-2 rounded border">
        <div class="d-flex justify-content-between align-items-baseline gap-2">
          <div class="small fw-semibold">${t.title}</div>
          <span class="small fw-semibold text-primary">${formatCurrency(t.minAmount)}</span>
        </div>
        ${t.description ? `<div class="small text-muted">${t.description}</div>` : ''}
        ${t.durationMonths ? `<div class="small text-muted">Thời hạn: ${t.durationMonths} tháng</div>` : ''}
      </div>
    `).join('');
  }

  // Team
  if (p.team) {
    document.getElementById('teamSection').hidden = false;
    document.getElementById('projectTeam').textContent = p.team;
  }

  // Use of funds
  if (p.useOfFunds) {
    document.getElementById('fundsSection').hidden = false;
    document.getElementById('projectUseOfFunds').textContent = p.useOfFunds;
  }

  // Latest update
  if (p.lastUpdate) {
    document.getElementById('updateSection').hidden = false;
    const date = p.lastUpdate.createdAt?.toDate ? p.lastUpdate.createdAt.toDate().toLocaleDateString('vi-VN') : '';
    document.getElementById('projectUpdate').innerHTML = `
      <div class="p-3 rounded border">
        <div class="d-flex align-items-center gap-2 mb-1">
          <strong>${p.lastUpdate.title}</strong>
          <span class="text-muted small ms-auto">${date}</span>
        </div>
        <p class="mb-0">${p.lastUpdate.content}</p>
      </div>
    `;
  }

  // Funding progress
  const pct = Math.min(Math.round((p.raised / p.goal) * 100), 100);
  document.getElementById('projectRaised').textContent = formatCurrency(p.raised);
  document.getElementById('projectGoal').textContent = `mục tiêu ${formatCurrency(p.goal)}`;
  document.getElementById('projectProgressBar').style.width = pct + '%';
  document.getElementById('projectPct').textContent = pct + '%';
  document.getElementById('projectDaysLeft').textContent = p.daysLeft === 0 ? 'Đã đủ vốn' : `Còn ${p.daysLeft} ngày`;
  document.getElementById('payoutPaidNote').hidden = !(p.payoutStatus === 'paid');

  // Creator
  document.getElementById('creatorName').textContent = p.userName || 'Ẩn danh';
  document.getElementById('creatorAvatar').textContent = (p.userName || 'A')[0].toUpperCase();

  // Contact
  if (p.email) {
    document.getElementById('projectEmail').innerHTML = `<i class="bi bi-envelope"></i> <a href="mailto:${p.email}" class="text-decoration-none">${p.email}</a>`;
  }
  if (p.url) {
    document.getElementById('projectUrl').innerHTML = `<i class="bi bi-link-45deg"></i> <a href="${p.url}" target="_blank" class="text-decoration-none">Website dự án</a>`;
  }

  // Social links
  if (p.socialLinks) {
    const socialSection = document.getElementById('socialSection');
    socialSection.hidden = false;
    const socialEl = document.getElementById('projectSocial');
    const icons = { facebook: 'bi-facebook', linkedin: 'bi-linkedin', twitter: 'bi-twitter-x', github: 'bi-github' };
    socialEl.innerHTML = Object.entries(p.socialLinks).map(([key, url]) =>
      `<a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary" title="${key}"><i class="bi ${icons[key] || 'bi-link-45deg'}"></i> ${key}</a>`
    ).join('');
  }

  // Strategies
  if (p.strategies && p.strategies.length) {
    document.getElementById('strategiesSection').hidden = false;
    const stratLabels = { crowdfund: 'Góp vốn cộng đồng', angel: 'Nhà đầu tư thiên thần', skill: 'Đổi kỹ năng lấy cổ phần' };
    document.getElementById('projectStrategies').innerHTML = p.strategies.map(s =>
      `<span class="badge bg-primary bg-opacity-10 text-primary">${stratLabels[s] || s}</span>`
    ).join('');
  }

  // Pledge button
  document.getElementById('pledgeBtn').href = `pledge.html?id=${p.id}`;

  if (currentUser) checkOwner(currentUser.uid);
}

function checkOwner(uid) {
  if (!currentProject || currentProject.userId !== uid) return;
  document.getElementById('ownerActions').hidden = false;
  document.getElementById('editProjectBtn').href = `post-project.html?edit=${currentProject.id}`;
  document.getElementById('manageProjectBtn').href = 'my-projects.html';

  const deleteBtn = document.getElementById('deleteProjectBtn');
  if (deleteBtn) {
    if (currentProject.deleteRequested) {
      deleteBtn.textContent = 'Đã yêu cầu xóa';
      deleteBtn.classList.remove('btn-outline-danger');
      deleteBtn.classList.add('btn-outline-secondary');
      deleteBtn.style.pointerEvents = 'none';
      deleteBtn.style.opacity = '.6';
    }
  }
}

async function requestProjectDeletion() {
  if (!currentProject || currentProject.deleteRequested) return;
  if (!confirm(`Bạn có chắc muốn yêu cầu xóa "${currentProject.name}"?\nYêu cầu sẽ phải được quản trị viên duyệt trước khi dự án bị xóa.`)) return;

  try {
    await db.collection('projects').doc(currentProject.id).update({
      deleteRequested: firebase.firestore.FieldValue.serverTimestamp(),
      deleteRequestedBy: firebase.auth().currentUser.uid
    });
    alert('Đã gửi yêu cầu xóa, chờ quản trị viên duyệt.');
    location.reload();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

function formatCurrency(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ ₫';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr ₫';
  return (n || 0).toLocaleString('vi-VN') + ' ₫';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

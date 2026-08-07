const db = firebase.firestore();
let currentProject = null;
let wantsPerk = false;
let selectedPerkTier = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();
  loadProject();
  initMethodToggle();
  initFormSubmit();
  initPerkUI();
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

function loadProject() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('loadingState').hidden = true;
    document.getElementById('notFoundState').hidden = false;
    return;
  }

  db.collection('projects').doc(id).get()
    .then(doc => {
      if (!doc.exists) {
        document.getElementById('loadingState').hidden = true;
        document.getElementById('notFoundState').hidden = false;
        return;
      }
      currentProject = { id: doc.id, ...doc.data() };
      renderProjectInfo(currentProject);
    })
    .catch(() => {
      document.getElementById('loadingState').hidden = true;
      document.getElementById('notFoundState').hidden = false;
    });
}

function renderProjectInfo(p) {
  document.getElementById('loadingState').hidden = true;
  document.getElementById('pledgeContent').hidden = false;

  document.title = `Cam kết — ${p.name} — WebFund`;

  document.getElementById('pledgeProjectName').textContent = p.name;
  document.getElementById('pledgeProjectTitle').textContent = p.name;
  document.getElementById('pledgeProjectTagline').textContent = p.tagline || '';
  document.getElementById('pledgeProjectCover').src = p.coverImage || '';
  document.getElementById('pledgeProjectCover').alt = p.name;
  document.getElementById('backToProject').href = `project.html?id=${p.id}`;
  document.getElementById('viewProjectBtn').href = `project.html?id=${p.id}`;

  const pct = Math.min(Math.round((p.raised / p.goal) * 100), 100);
  document.getElementById('pledgeProjectProgressBar').style.width = pct + '%';
  document.getElementById('pledgeProjectPct').textContent = `${pct}% · ${formatCurrency(p.raised)} / ${formatCurrency(p.goal)}`;

  renderPerkUI(p);
}

/* ── Perk Tiers ── */
function getPerkTier(amount) {
  const tiers = currentProject.perkTiers || [];
  return tiers.filter(t => amount >= t.minAmount).sort((a, b) => b.minAmount - a.minAmount)[0] || null;
}

function getNextPerkTier(amount) {
  const tiers = currentProject.perkTiers || [];
  return tiers.filter(t => amount < t.minAmount).sort((a, b) => a.minAmount - b.minAmount)[0] || null;
}

function initPerkUI() {
  const perkSection = document.getElementById('perkSection');
  if (!perkSection) return;

  document.querySelectorAll('input[name="perkChoice"]').forEach(input => {
    input.addEventListener('change', () => {
      wantsPerk = input.value === 'claim';
      updatePerkPreview();
    });
  });

  const amountInput = document.getElementById('pledgeAmount');
  if (amountInput) {
    amountInput.addEventListener('input', updatePerkPreview);
  }
}

function renderPerkUI(p) {
  const perkSection = document.getElementById('perkSection');
  if (!perkSection) return;

  const tiers = p.perkTiers || [];
  if (!tiers.length) {
    perkSection.hidden = true;
    wantsPerk = false;
    selectedPerkTier = null;
    return;
  }

  perkSection.hidden = false;
  wantsPerk = true;
  selectedPerkTier = null;
  const claimInput = document.querySelector('input[name="perkChoice"][value="claim"]');
  if (claimInput) claimInput.checked = true;
  updatePerkPreview();
}

function updatePerkPreview() {
  const matched = document.getElementById('perkPreviewMatched');
  const empty = document.getElementById('perkPreviewEmpty');
  if (!matched || !empty) return;

  matched.hidden = true;
  empty.hidden = true;

  const amountInput = document.getElementById('pledgeAmount');
  const amount = parseInt(amountInput.value);

  if (!wantsPerk) return;

  const tier = getPerkTier(amount);
  if (tier) {
    selectedPerkTier = tier;
    matched.hidden = false;
    const duration = tier.durationMonths
      ? `<div class="small text-muted">Thời hạn: ${tier.durationMonths} tháng</div>`
      : '';
    matched.innerHTML = `
      <div class="fw-semibold">${tier.title}</div>
      ${tier.description ? `<div class="small text-muted">${tier.description}</div>` : ''}
      ${duration}
    `;
  } else {
    selectedPerkTier = null;
    const next = getNextPerkTier(amount || 0);
    if (next) {
      empty.hidden = false;
      empty.textContent = `Ủng hộ thêm ${formatCurrency(next.minAmount - (amount || 0))} để nhận '${next.title}'`;
    }
  }
}

function initMethodToggle() {
  document.querySelectorAll('.method-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.method-card').forEach(c => c.style.opacity = '0.5');
      card.style.opacity = '1';
      const isSkill = card.querySelector('input').value === 'skill';
      document.getElementById('skillInputWrapper').hidden = !isSkill;
    });
  });
  document.getElementById('methodBank').style.opacity = '1';
}

function initFormSubmit() {
  document.getElementById('pledgeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('pledgeError');
    err.hidden = true;

    const user = firebase.auth().currentUser;
    if (!user) { showErr(err, 'Vui lòng đăng nhập'); return; }

    const amount = parseInt(document.getElementById('pledgeAmount').value);
    const methodRadio = document.querySelector('input[name="pledgeMethod"]:checked');
    const method = methodRadio ? methodRadio.value : 'bank_transfer';
    const note = document.getElementById('pledgeNote').value.trim();
    const skill = document.getElementById('pledgeSkill').value.trim();

    if (!amount || amount < 100000) {
      showErr(err, 'Số tiền cam kết phải lớn hơn 100.000đ');
      return;
    }

    if (method === 'skill' && !skill) {
      showErr(err, 'Vui lòng nhập kỹ năng bạn muốn đóng góp');
      return;
    }

    const submitBtn = document.getElementById('pledgeSubmitBtn');
    const submitText = document.getElementById('pledgeSubmitText');
    const submitSpinner = document.getElementById('pledgeSubmitSpinner');
    submitBtn.disabled = true;
    submitText.textContent = 'Đang xử lý...';
    submitSpinner.style.display = 'inline-block';

    const pledge = {
      projectId: currentProject.id,
      projectName: currentProject.name,
      userId: user.uid,
      userName: user.displayName || user.email,
      userEmail: user.email,
      amount: method === 'bank_transfer' ? amount : 0,
      method,
      skill: method === 'skill' ? skill : null,
      wantsPerk,
      perkTier: selectedPerkTier,
      note,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('pledges').add(pledge);

      // Show success
      document.getElementById('pledgeContent').hidden = true;
      document.getElementById('pledgeSuccess').hidden = false;

      document.getElementById('bankTransferContent').textContent = `WEBFUND ${currentProject.id.slice(0, 8).toUpperCase()} ${user.email}`;
      document.getElementById('bankTransferAmount').textContent = formatCurrency(amount);

      document.title = `Cam kết thành công — WebFund`;
    } catch (e) {
      showErr(err, 'Không thể xử lý cam kết, vui lòng thử lại');
      submitBtn.disabled = false;
      submitText.textContent = 'Xác nhận cam kết';
      submitSpinner.style.display = 'none';
    }
  });
}

function formatCurrency(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ ₫';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr ₫';
  return (n || 0).toLocaleString('vi-VN') + ' ₫';
}

function showErr(el, msg) {
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => el.hidden = true, 4000);
}

function showToast(msg) {
  const toast = document.getElementById('errorToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

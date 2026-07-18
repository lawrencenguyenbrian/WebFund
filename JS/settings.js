const db = firebase.firestore();
let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();
  initThemeOptions();
  initAccountActions();
});

/* ── Auth ── */
function initAuthUI() {
  const userMenu = document.getElementById('userMenu');
  const userDropdown = document.getElementById('userDropdown');
  const myProjectsLink = document.getElementById('myProjectsLink');
  const portfolioLink = document.getElementById('portfolioLink');
  const adminLink = document.getElementById('adminLink');
  const logoutBtn = document.getElementById('logoutBtn');

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      userMenu.style.display = 'block';
      userDropdown.textContent = user.displayName || user.email || 'User';
      loadUserData(user.uid);

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

/* ── Load User Data ── */
function loadUserData(uid) {
  db.collection('users').doc(uid).get()
    .then(doc => {
      document.getElementById('loadingState').hidden = true;
      document.getElementById('settingsContent').hidden = false;

      if (doc.exists) {
        userData = doc.data();
        renderAccountInfo();
      }
    })
    .catch(() => {
      document.getElementById('loadingState').hidden = true;
      document.getElementById('settingsContent').hidden = false;
    });
}

function renderAccountInfo() {
  if (!currentUser || !userData) return;

  document.getElementById('currentName').textContent = userData.name || currentUser.displayName || '—';
  document.getElementById('displayName').textContent = userData.name || currentUser.displayName || '—';
  document.getElementById('userEmail').textContent = currentUser.email || '—';

  const roleMap = {
    founder: { label: 'Founder', icon: 'bi-rocket-takeoff', desc: 'Đăng dự án, gọi vốn, quản lý tiến độ' },
    investor: { label: 'Nhà đầu tư', icon: 'bi-cash-coin', desc: 'Cam kết góp vốn, theo dõi danh mục' },
    admin: { label: 'Admin', icon: 'bi-shield-lock', desc: 'Quản trị viên hệ thống' }
  };
  const role = roleMap[userData.role] || roleMap.founder;
  document.getElementById('userRole').textContent = role.label;
  document.getElementById('userRole').className = `badge ${userData.role === 'admin' ? 'bg-danger' : 'bg-primary'}`;
  document.getElementById('roleDesc').textContent = role.desc;

  initThemeOptions();
}

/* ── Account Actions ── */
function initAccountActions() {
  // Edit name
  document.getElementById('editNameBtn').addEventListener('click', () => {
    document.getElementById('editNameForm').hidden = false;
    document.getElementById('newNameInput').value = userData?.name || currentUser?.displayName || '';
    document.getElementById('newNameInput').focus();
  });

  document.getElementById('cancelNameBtn').addEventListener('click', () => {
    document.getElementById('editNameForm').hidden = true;
    document.getElementById('nameError').hidden = true;
  });

  document.getElementById('saveNameBtn').addEventListener('click', async () => {
    const newName = document.getElementById('newNameInput').value.trim();
    const errEl = document.getElementById('nameError');

    if (!newName) {
      errEl.textContent = 'Tên không được để trống.';
      errEl.hidden = false;
      return;
    }

    try {
      await currentUser.updateProfile({ displayName: newName });
      await db.collection('users').doc(currentUser.uid).update({ name: newName });
      userData.name = newName;
      renderAccountInfo();
      document.getElementById('editNameForm').hidden = true;
      errEl.hidden = true;
      showToast('Cập nhật tên thành công!');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

  // Edit role
  document.getElementById('editRoleBtn').addEventListener('click', () => {
    document.getElementById('editRoleForm').hidden = false;
    document.getElementById('roleError').hidden = true;
    const currentRole = userData?.role || 'founder';
    const radio = document.querySelector(`input[name="settingsRole"][value="${currentRole}"]`);
    if (radio) radio.checked = true;
  });

  document.getElementById('cancelRoleBtn').addEventListener('click', () => {
    document.getElementById('editRoleForm').hidden = true;
    document.getElementById('roleError').hidden = true;
  });

  document.getElementById('saveRoleBtn').addEventListener('click', async () => {
    const selected = document.querySelector('input[name="settingsRole"]:checked');
    const errEl = document.getElementById('roleError');

    if (!selected) {
      errEl.textContent = 'Vui lòng chọn vai trò.';
      errEl.hidden = false;
      return;
    }

    const newRole = selected.value;
    if (newRole === userData?.role) {
      document.getElementById('editRoleForm').hidden = true;
      return;
    }

    try {
      await db.collection('users').doc(currentUser.uid).update({ role: newRole });
      userData.role = newRole;
      renderAccountInfo();
      document.getElementById('editRoleForm').hidden = true;
      errEl.hidden = true;
      showToast('Cập nhật vai trò thành công!');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

  // Change password
  document.getElementById('changePasswordBtn').addEventListener('click', () => {
    const form = document.getElementById('changePasswordForm');
    form.hidden = !form.hidden;
    document.getElementById('passwordError').hidden = true;
    document.getElementById('passwordSuccess').hidden = true;
  });

  document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
    document.getElementById('changePasswordForm').hidden = true;
    document.getElementById('passwordError').hidden = true;
    document.getElementById('passwordSuccess').hidden = true;
  });

  document.getElementById('savePasswordBtn').addEventListener('click', async () => {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const errEl = document.getElementById('passwordError');
    const successEl = document.getElementById('passwordSuccess');

    errEl.hidden = true;
    successEl.hidden = true;

    if (!current || !newPass || !confirm) {
      errEl.textContent = 'Vui lòng nhập đầy đủ thông tin.';
      errEl.hidden = false;
      return;
    }
    if (newPass.length < 6) {
      errEl.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
      errEl.hidden = false;
      return;
    }
    if (newPass !== confirm) {
      errEl.textContent = 'Mật khẩu xác nhận không khớp.';
      errEl.hidden = false;
      return;
    }

    try {
      const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, current);
      await currentUser.reauthenticateWithCredential(credential);
      await currentUser.updatePassword(newPass);
      successEl.textContent = 'Đổi mật khẩu thành công!';
      successEl.hidden = false;
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      setTimeout(() => { successEl.hidden = true; }, 3000);
    } catch (err) {
      const map = {
        'auth/wrong-password': 'Mật khẩu hiện tại không đúng.',
        'auth/weak-password': 'Mật khẩu mới quá yếu.',
        'auth/requires-recent-login': 'Vui lòng đăng nhập lại và thử lại.'
      };
      errEl.textContent = map[err.code] || err.message;
      errEl.hidden = false;
    }
  });

  // Delete account
  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    document.getElementById('deleteConfirmForm').hidden = false;
  });

  document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    document.getElementById('deleteConfirmForm').hidden = true;
    document.getElementById('deleteError').hidden = true;
  });

  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    const password = document.getElementById('deletePassword').value;
    const errEl = document.getElementById('deleteError');

    if (!password) {
      errEl.textContent = 'Vui lòng nhập mật khẩu.';
      errEl.hidden = false;
      return;
    }

    try {
      const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
      await currentUser.reauthenticateWithCredential(credential);

      // Delete user data from Firestore
      await db.collection('users').doc(currentUser.uid).delete();

      // Delete user auth
      await currentUser.delete();
      window.location.href = 'auth.html';
    } catch (err) {
      const map = {
        'auth/wrong-password': 'Mật khẩu không đúng.',
        'auth/requires-recent-login': 'Vui lòng đăng nhập lại và thử lại.'
      };
      errEl.textContent = map[err.code] || err.message;
      errEl.hidden = false;
    }
  });
}

/* ── Theme Options ── */
function initThemeOptions() {
  const current = lsGet('webfund-theme') || 'dark';
  updateThemeButtons(current);

  document.getElementById('themeDark').addEventListener('click', () => applyTheme('dark'));
  document.getElementById('themeLight').addEventListener('click', () => applyTheme('light'));
}

function applyTheme(theme) {
  document.body.setAttribute('data-bs-theme', theme);
  lsSet('webfund-theme', theme);

  // Sync with navbar toggle
  const checkbox = document.getElementById('themeSwitch');
  if (checkbox) checkbox.checked = theme === 'dark';

  const navbar = document.getElementById('siteNavbar');
  if (navbar) {
    navbar.classList.toggle('navbar-dark', theme === 'dark');
    navbar.classList.toggle('navbar-light', theme === 'light');
  }

  updateThemeButtons(theme);
}

function updateThemeButtons(theme) {
  document.getElementById('themeDark').classList.toggle('active', theme === 'dark');
  document.getElementById('themeLight').classList.toggle('active', theme === 'light');
  document.getElementById('currentThemeLabel').textContent = theme === 'dark' ? 'Tối' : 'Sáng';
}

/* ── Toast ── */
function showToast(msg) {
  const toastEl = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
}

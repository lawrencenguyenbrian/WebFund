const db = firebase.firestore();

const CLOUDINARY_CONFIG = {
  cloudName: 'dfdom0zpb',
  uploadPreset: 'WebFund'
};
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

let currentUser = null;
let userData = null;
let verificationRequest = null;
let selectedVerificationFile = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();
  initThemeOptions();
  initAccountActions();
  initProfileEdit();
  initAvatarUpload();
  initVerification();
});

/* ── Auth ── */
function initAuthUI() {
  const userMenu = document.getElementById('userMenu');
  const userDropdown = document.getElementById('userDropdown');
  const createProjectLink = document.getElementById('createProjectLink');
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
        if (role === 'admin') {
          if (createProjectLink) createProjectLink.style.display = 'none';
          if (myProjectsLink) myProjectsLink.style.display = 'none';
          if (portfolioLink) portfolioLink.style.display = 'none';
        } else if (role === 'investor') {
          if (createProjectLink) createProjectLink.style.display = 'none';
          if (myProjectsLink) myProjectsLink.style.display = 'none';
          if (portfolioLink) portfolioLink.style.display = 'block';
        } else {
          if (createProjectLink) createProjectLink.style.display = 'block';
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
        loadVerificationStatus();
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

  renderProfileAvatar();

  document.getElementById('publicBio').textContent = userData.bio || '—';
  document.getElementById('publicLocation').textContent = userData.location || '—';
  document.getElementById('publicWebsite').innerHTML = userData.website
    ? `<a href="${userData.website}" target="_blank" rel="noopener" class="text-decoration-none">${userData.website}</a>`
    : '—';

  const social = userData.socialLinks || {};
  const socialParts = [];
  if (social.facebook) socialParts.push(`<a href="${social.facebook}" target="_blank" rel="noopener" class="text-decoration-none"><i class="bi bi-facebook"></i> Facebook</a>`);
  if (social.linkedin) socialParts.push(`<a href="${social.linkedin}" target="_blank" rel="noopener" class="text-decoration-none"><i class="bi bi-linkedin"></i> LinkedIn</a>`);
  document.getElementById('publicSocial').innerHTML = socialParts.length ? socialParts.join(' · ') : '—';

  const createdAt = userData.createdAt;
  document.getElementById('memberSinceValue').textContent = createdAt
    ? (createdAt.toDate ? createdAt.toDate() : new Date(createdAt)).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  initThemeOptions();
}

/* ── Public Profile ── */
function renderProfileAvatar() {
  const el = document.getElementById('profileAvatar');
  if (!el) return;
  const url = userData?.avatarUrl;
  if (url) {
    el.innerHTML = `<img src="${url}" alt="Ảnh đại diện">`;
  } else {
    el.textContent = (userData?.name || currentUser?.displayName || 'U')[0].toUpperCase();
  }
}

function initProfileEdit() {
  const form = document.getElementById('editProfileForm');
  const errEl = document.getElementById('profileError');

  document.getElementById('editProfileBtn').addEventListener('click', () => {
    form.hidden = false;
    errEl.hidden = true;
    document.getElementById('profileBioInput').value = userData?.bio || '';
    document.getElementById('profileLocationInput').value = userData?.location || '';
    document.getElementById('profileWebsiteInput').value = userData?.website || '';
    const social = userData?.socialLinks || {};
    document.getElementById('profileFacebookInput').value = social.facebook || '';
    document.getElementById('profileLinkedinInput').value = social.linkedin || '';
    document.getElementById('profileBioInput').focus();
  });

  document.getElementById('cancelProfileBtn').addEventListener('click', () => {
    form.hidden = true;
    errEl.hidden = true;
  });

  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const bio = document.getElementById('profileBioInput').value.trim();
    const location = document.getElementById('profileLocationInput').value.trim();
    const website = normalizeUrl(document.getElementById('profileWebsiteInput').value);
    const facebook = normalizeUrl(document.getElementById('profileFacebookInput').value);
    const linkedin = normalizeUrl(document.getElementById('profileLinkedinInput').value);

    if (bio.length > 300) {
      errEl.textContent = 'Giới thiệu bản thân tối đa 300 ký tự.';
      errEl.hidden = false;
      return;
    }
    if (website && !isValidUrl(website)) {
      errEl.textContent = 'Website không hợp lệ.';
      errEl.hidden = false;
      return;
    }
    if (facebook && !isValidUrl(facebook)) {
      errEl.textContent = 'Link Facebook không hợp lệ.';
      errEl.hidden = false;
      return;
    }
    if (linkedin && !isValidUrl(linkedin)) {
      errEl.textContent = 'Link LinkedIn không hợp lệ.';
      errEl.hidden = false;
      return;
    }

    const socialLinks = {};
    if (facebook) socialLinks.facebook = facebook;
    if (linkedin) socialLinks.linkedin = linkedin;

    try {
      await db.collection('users').doc(currentUser.uid).update({ bio, location, website, socialLinks });
      userData.bio = bio;
      userData.location = location;
      userData.website = website;
      userData.socialLinks = socialLinks;
      renderAccountInfo();
      form.hidden = true;
      errEl.hidden = true;
      showToast('Cập nhật hồ sơ công khai thành công!');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

function normalizeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) return 'https://' + v;
  return v;
}

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ── Avatar Upload ── */
function initAvatarUpload() {
  const input = document.getElementById('avatarInput');
  const btn = document.getElementById('changeAvatarBtn');
  if (!input || !btn) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    if (input.files[0]) handleAvatarFile(input.files[0]);
    input.value = '';
  });
}

async function handleAvatarFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ảnh đại diện không được vượt quá 5MB');
    return;
  }

  const progressWrap = document.getElementById('avatarProgressWrap');
  const progressBar = document.getElementById('avatarProgress');
  progressWrap.style.display = 'block';
  progressBar.style.width = '0%';

  try {
    const result = await uploadToCloudinary(file, (pct) => {
      progressBar.style.width = pct + '%';
    });
    await db.collection('users').doc(currentUser.uid).update({ avatarUrl: result.url });
    userData.avatarUrl = result.url;
    renderProfileAvatar();
    showToast('Cập nhật ảnh đại diện thành công!');
    setTimeout(() => {
      progressWrap.style.display = 'none';
      progressBar.style.width = '0%';
    }, 800);
  } catch (err) {
    progressWrap.style.display = 'none';
    showToast(err.message || 'Lỗi tải ảnh lên');
  }
}

/* ── Identity Verification ── */
function initVerification() {
  const btn = document.getElementById('verificationBtn');
  if (!btn) return;

  btn.addEventListener('click', openVerificationModal);

  document.getElementById('verificationPhotoBtn').addEventListener('click', () => {
    document.getElementById('verificationPhotoInput').click();
  });

  document.getElementById('verificationPhotoInput').addEventListener('change', () => {
    const file = document.getElementById('verificationPhotoInput').files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showVerificationError('Ảnh xác minh không được vượt quá 5MB');
      document.getElementById('verificationPhotoInput').value = '';
      return;
    }
    selectedVerificationFile = file;
    document.getElementById('verificationError').hidden = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('verificationPhotoPreviewImg').src = e.target.result;
      document.getElementById('verificationPhotoPreview').hidden = false;
      document.getElementById('verificationSubmitBtn').disabled = false;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('verificationSubmitBtn').addEventListener('click', submitVerification);
}

function loadVerificationStatus() {
  if (!currentUser) return;
  db.collection('verificationRequests').doc(currentUser.uid).get()
    .then(doc => {
      verificationRequest = doc.exists ? { id: doc.id, ...doc.data() } : null;
      renderVerificationStatus();
    })
    .catch(() => {
      verificationRequest = null;
      renderVerificationStatus();
    });
}

function renderVerificationStatus() {
  const badge = document.getElementById('verificationStatusBadge');
  const btn = document.getElementById('verificationBtn');
  if (!badge || !btn) return;

  if (userData?.verified) {
    badge.textContent = 'Đã xác minh';
    badge.className = 'badge bg-success';
    btn.hidden = true;
    return;
  }
  if (verificationRequest?.status === 'pending') {
    badge.textContent = 'Chờ duyệt';
    badge.className = 'badge bg-warning text-dark';
    btn.hidden = true;
    return;
  }
  if (verificationRequest?.status === 'rejected') {
    badge.textContent = 'Từ chối';
    badge.className = 'badge bg-danger';
    btn.hidden = false;
    return;
  }

  badge.textContent = 'Chưa xác minh';
  badge.className = 'badge bg-secondary';
  btn.hidden = false;
}

function openVerificationModal() {
  selectedVerificationFile = null;
  document.getElementById('verificationPhotoInput').value = '';
  document.getElementById('verificationPhotoPreview').hidden = true;
  document.getElementById('verificationPhotoPreviewImg').src = '';
  document.getElementById('verificationError').hidden = true;
  document.getElementById('verificationProgressWrap').style.display = 'none';
  document.getElementById('verificationProgress').style.width = '0%';
  document.getElementById('verificationSubmitBtn').disabled = true;
  document.getElementById('verificationSubmitText').textContent = 'Gửi yêu cầu';
  document.getElementById('verificationSubmitSpinner').style.display = 'none';
  new bootstrap.Modal(document.getElementById('verificationModal')).show();
}

async function submitVerification() {
  if (!selectedVerificationFile) {
    showVerificationError('Vui lòng chọn ảnh xác minh.');
    return;
  }

  const btn = document.getElementById('verificationSubmitBtn');
  const text = document.getElementById('verificationSubmitText');
  const spinner = document.getElementById('verificationSubmitSpinner');
  const progressWrap = document.getElementById('verificationProgressWrap');
  const progressBar = document.getElementById('verificationProgress');

  btn.disabled = true;
  text.textContent = 'Đang gửi...';
  spinner.style.display = 'inline-block';
  progressWrap.style.display = 'block';
  progressBar.style.width = '0%';

  try {
    const result = await uploadToCloudinary(selectedVerificationFile, (pct) => {
      progressBar.style.width = pct + '%';
    }, 'webfund/verification');

    await db.collection('verificationRequests').doc(currentUser.uid).set({
      userId: currentUser.uid,
      userName: userData.name || currentUser.displayName || '',
      userEmail: currentUser.email || '',
      idPhotoUrl: result.url,
      status: 'pending',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    verificationRequest = { id: currentUser.uid, status: 'pending' };
    renderVerificationStatus();
    bootstrap.Modal.getInstance(document.getElementById('verificationModal')).hide();
    showToast('Đã gửi yêu cầu xác minh!');
  } catch (err) {
    btn.disabled = false;
    text.textContent = 'Gửi yêu cầu';
    spinner.style.display = 'none';
    progressWrap.style.display = 'none';
    showVerificationError(err.message || 'Lỗi tải ảnh lên');
  }
}

function showVerificationError(msg) {
  const errEl = document.getElementById('verificationError');
  errEl.textContent = msg;
  errEl.hidden = false;
}

/* ── Cloudinary Upload Helper ── */
function uploadToCloudinary(file, onProgress, folder) {
  return new Promise((resolve, reject) => {
    if (!CLOUDINARY_CONFIG.cloudName || CLOUDINARY_CONFIG.cloudName === 'YOUR_CLOUD_NAME') {
      reject(new Error('Chưa cấu hình Cloudinary.'));
      return;
    }
    if (!CLOUDINARY_CONFIG.uploadPreset || CLOUDINARY_CONFIG.uploadPreset === 'YOUR_UPLOAD_PRESET') {
      reject(new Error('Chưa cấu hình Upload Preset.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', folder || 'webfund/avatars');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', CLOUDINARY_URL, true);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url, publicId: data.public_id });
      } else {
        let msg = 'Lỗi tải ảnh lên';
        try { msg = JSON.parse(xhr.responseText).error.message; } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Lỗi tải ảnh lên')));
    xhr.send(formData);
  });
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

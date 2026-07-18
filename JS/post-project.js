/*
 * ============================================================
 *  Cloudinary Configuration
 * ============================================================
 *  Để tích hợp Cloudinary, bạn cần:
 *
 *  1. Tạo tài khoản miễn phí tại https://cloudinary.com
 *  2. Lấy "Cloud Name" từ Dashboard (VD: "dxyz123abc")
 *  3. Tạo Upload Preset:
 *     - Vào Settings → Upload → Upload presets
 *     - Click "Add upload preset"
 *     - Signing Mode: Chọn "Unsigned" (cho frontend)
 *     - Lưu lại tên preset (VD: "webfund_uploads")
 *  4. Điền thông tin vào bên dưới:
 * ============================================================
 */
const CLOUDINARY_CONFIG = {
  cloudName: 'dfdom0zpb',
  uploadPreset: 'WebFund'
};
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
const MAX_GALLERY_IMAGES = 6;

const db = firebase.firestore();
let currentStep = 1;
let coverImageUrl = '';
let galleryUrls = [];

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initAuthUI();
  initStepNav();
  initCharCounters();
  initCoverUpload();
  initGalleryUpload();
  initTags();
  initMilestones();
  initFormSubmit();
  initPostAnother();
});

/* ── Auth UI ── */
function initAuthUI() {
  const authBtns = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');
  const userDropdown = document.getElementById('userDropdown');
  const myProjectsLink = document.getElementById('myProjectsLink');
  const portfolioLink = document.getElementById('portfolioLink');
  const adminLink = document.getElementById('adminLink');
  const logoutBtn = document.getElementById('logoutBtn');

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      authBtns.style.display = 'none';
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
      authBtns.style.display = 'flex';
      userMenu.style.display = 'none';
      window.location.href = 'auth.html';
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      firebase.auth().signOut();
    });
  }
}

/* ── Step Navigation ── */
function initStepNav() {
  const pills = document.querySelectorAll('.step-pill');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const target = parseInt(pill.dataset.step);
      if (target > currentStep && !validateStep(currentStep)) return;
      goToStep(target);
    });
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  nextBtn.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) goToStep(currentStep + 1);
    }
  });
}

function goToStep(step) {
  currentStep = step;
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.querySelector(`.form-section[data-step="${step}"]`).classList.add('active');

  document.querySelectorAll('.step-pill').forEach(p => {
    const s = parseInt(p.dataset.step);
    p.classList.toggle('active', s === step);
    if (s < step) {
      p.classList.add('completed');
    } else {
      p.classList.remove('completed');
    }
  });

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');
  const navButtons = document.getElementById('navButtons');

  prevBtn.style.display = step > 1 ? 'inline-block' : 'none';
  nextBtn.style.display = step < 4 ? 'inline-block' : 'none';
  submitBtn.style.display = step === 4 ? 'inline-block' : 'none';
  navButtons.style.display = step === 5 ? 'none' : 'flex';
}

function validateStep(step) {
  const err = document.getElementById('projectError');
  err.hidden = true;

  if (step === 1) {
    const name = document.getElementById('pName').value.trim();
    const tagline = document.getElementById('pTagline').value.trim();
    const desc = document.getElementById('pDesc').value.trim();
    if (!name) { showErr(err, 'Vui lòng nhập tên dự án'); return false; }
    if (!tagline) { showErr(err, 'Vui lòng nhập mô tả ngắn'); return false; }
    if (!desc) { showErr(err, 'Vui lòng nhập mô tả chi tiết'); return false; }
  }

  if (step === 2) {
    if (!coverImageUrl) { showErr(err, 'Vui lòng tải lên ảnh bìa'); return false; }
  }

  if (step === 3) {
    const goal = parseInt(document.getElementById('pGoal').value);
    if (!goal || goal < 1000000) { showErr(err, 'Mục tiêu gọi vốn phải lớn hơn 1.000.000đ'); return false; }
  }

  if (step === 4) {
    const email = document.getElementById('pEmail').value.trim();
    if (!email || !email.includes('@')) { showErr(err, 'Vui lòng nhập email liên hệ hợp lệ'); return false; }
  }

  return true;
}

/* ── Character Counters ── */
function initCharCounters() {
  const pairs = [
    ['pName', 'nameCount', 100],
    ['pTagline', 'taglineCount', 150],
    ['pDesc', 'descCount', 2000],
    ['pUseOfFunds', 'fundsCount', 500],
    ['pTeam', 'teamCount', 500]
  ];
  pairs.forEach(([inputId, countId, max]) => {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(countId);
    if (!input || !counter) return;
    input.addEventListener('input', () => {
      const len = input.value.length;
      counter.textContent = len;
      const parent = counter.parentElement;
      parent.classList.remove('warning', 'danger');
      if (len > max * 0.9) parent.classList.add('danger');
      else if (len > max * 0.7) parent.classList.add('warning');
    });
  });
}

/* ── Cloudinary Upload Helper ── */
function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!CLOUDINARY_CONFIG.cloudName || CLOUDINARY_CONFIG.cloudName === 'YOUR_CLOUD_NAME') {
      reject(new Error('Chưa cấu hình Cloudinary. Vui lòng điền CLOUDINARY_CONFIG ở đầu file post-project.js'));
      return;
    }
    if (!CLOUDINARY_CONFIG.uploadPreset || CLOUDINARY_CONFIG.uploadPreset === 'YOUR_UPLOAD_PRESET') {
      reject(new Error('Chưa cấu hình Upload Preset. Vui lòng điền CLOUDINARY_CONFIG ở đầu file post-project.js'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', 'webfund/projects');

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
        resolve({
          url: data.secure_url,
          thumbnail: data.secure_url.replace('/upload/', '/upload/w_400,h_300,c_fill/'),
          publicId: data.public_id
        });
      } else {
        let msg = 'Lỗi tải ảnh lên';
        try { msg = JSON.parse(xhr.responseText).error.message; } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Lỗi kết nối, vui lòng thử lại')));
    xhr.send(formData);
  });
}

/* ── Cover Image Upload ── */
function initCoverUpload() {
  const zone = document.getElementById('coverUploadZone');
  const input = document.getElementById('coverInput');
  const progress = document.getElementById('coverProgress');
  const progressBar = progress.querySelector('.progress-bar');
  const progressText = progress.querySelector('.upload-progress-text');
  const hiddenInput = document.getElementById('pCoverUrl');

  // Drag & drop
  ['dragenter', 'dragover'].forEach(evt => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); });
  });
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleCoverFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleCoverFile(input.files[0]);
  });

  async function handleCoverFile(file) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ảnh bìa không được vượt quá 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      zone.innerHTML = `<img src="${e.target.result}" alt="Cover preview"><input type="file" id="coverInput" accept="image/*">`;
      zone.classList.add('has-image');
      // Re-bind input after replacing innerHTML
      const newInput = zone.querySelector('input[type="file"]');
      newInput.addEventListener('change', () => {
        if (newInput.files[0]) handleCoverFile(newInput.files[0]);
      });
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    progress.classList.add('active');
    progressBar.style.width = '0%';
    progressText.textContent = 'Đang tải ảnh bìa lên...';

    try {
      const result = await uploadToCloudinary(file, (pct) => {
        progressBar.style.width = pct + '%';
        progressText.textContent = `Đang tải lên... ${pct}%`;
      });
      coverImageUrl = result.url;
      hiddenInput.value = result.url;
      progressBar.style.width = '100%';
      progressText.textContent = 'Tải lên thành công!';
      setTimeout(() => progress.classList.remove('active'), 1500);
    } catch (err) {
      progress.classList.remove('active');
      showToast(err.message);
      // Reset zone
      zone.innerHTML = `
        <input type="file" id="coverInput" accept="image/*">
        <div class="upload-icon"><i class="bi bi-image"></i></div>
        <div class="upload-text">Kéo thả ảnh bìa vào đây hoặc nhấn để chọn</div>
        <div class="upload-hint">PNG, JPG, WebP · Tối đa 5MB · 1200x630px khuyến nghị</div>`;
      zone.classList.remove('has-image');
      const newInput = zone.querySelector('input[type="file"]');
      newInput.addEventListener('change', () => {
        if (newInput.files[0]) handleCoverFile(newInput.files[0]);
      });
    }
  }
}

/* ── Gallery Upload ── */
function initGalleryUpload() {
  const grid = document.getElementById('galleryGrid');
  const input = document.getElementById('galleryInput');
  const progress = document.getElementById('galleryProgress');
  const progressBar = progress.querySelector('.progress-bar');
  const progressText = progress.querySelector('.upload-progress-text');
  const addBtn = document.getElementById('galleryAddBtn');
  const hiddenInput = document.getElementById('pGalleryUrls');

  input.addEventListener('change', () => {
    const files = Array.from(input.files);
    const remaining = MAX_GALLERY_IMAGES - galleryUrls.length;
    const toUpload = files.slice(0, remaining);

    if (files.length > remaining) {
      showToast(`Chỉ còn chỗ cho ${remaining} ảnh nữa`);
    }
    if (toUpload.length === 0) return;

    uploadGalleryFiles(toUpload, 0, () => {
      hiddenInput.value = galleryUrls.join(',');
      updateGalleryGrid();
    });
    input.value = '';
  });

  async function uploadGalleryFiles(files, index, done) {
    if (index >= files.length) { done(); return; }
    const file = files[index];
    if (file.size > 5 * 1024 * 1024) {
      showToast(`"${file.name}" vượt quá 5MB, bỏ qua`);
      uploadGalleryFiles(files, index + 1, done);
      return;
    }

    progress.classList.add('active');
    progressBar.style.width = '0%';
    progressText.textContent = `Đang tải "${file.name}" (${index + 1}/${files.length})...`;

    try {
      const result = await uploadToCloudinary(file, (pct) => {
        progressBar.style.width = pct + '%';
        progressText.textContent = `Tải "${file.name}"... ${pct}%`;
      });
      galleryUrls.push(result.url);
      progressBar.style.width = '100%';
      progressText.textContent = `"${file.name}" tải lên thành công!`;
      uploadGalleryFiles(files, index + 1, done);
    } catch (err) {
      showToast(err.message);
      uploadGalleryFiles(files, index + 1, done);
    }
  }
}

function updateGalleryGrid() {
  const grid = document.getElementById('galleryGrid');
  const addBtnLabel = document.getElementById('galleryAddBtn');

  // Remove existing items (keep add button)
  grid.querySelectorAll('.gallery-item').forEach(el => el.remove());

  galleryUrls.forEach((url, i) => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
      <img src="${url}" alt="Gallery ${i + 1}">
      <button type="button" class="remove-btn" data-index="${i}" title="Xóa"><i class="bi bi-x-lg"></i></button>`;
    div.querySelector('.remove-btn').addEventListener('click', () => {
      galleryUrls.splice(i, 1);
      document.getElementById('pGalleryUrls').value = galleryUrls.join(',');
      updateGalleryGrid();
    });
    grid.insertBefore(div, addBtnLabel);
  });

  // Hide add button if max reached
  addBtnLabel.style.display = galleryUrls.length >= MAX_GALLERY_IMAGES ? 'none' : 'flex';
}

/* ── Tags Input ── */
function initTags() {
  const container = document.getElementById('tagContainer');
  const input = document.getElementById('tagInput');
  const tags = [];

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
    if (e.key === 'Backspace' && !input.value && tags.length) {
      removeTag(tags.length - 1);
    }
  });

  input.addEventListener('blur', addTag);

  container.addEventListener('click', () => input.focus());

  function addTag() {
    const val = input.value.trim().replace(/,/g, '');
    if (!val || tags.includes(val) || tags.length >= 10) return;
    tags.push(val);
    input.value = '';
    renderTags();
  }

  function removeTag(i) {
    tags.splice(i, 1);
    renderTags();
  }

  function renderTags() {
    container.querySelectorAll('.tag-item').forEach(el => el.remove());
    tags.forEach((tag, i) => {
      const span = document.createElement('span');
      span.className = 'tag-item';
      span.innerHTML = `${tag} <button type="button">&times;</button>`;
      span.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTag(i);
      });
      container.insertBefore(span, input);
    });
  }

  // Expose tags for form submission
  window.getProjectTags = () => [...tags];
}

/* ── Milestones ── */
function initMilestones() {
  const container = document.getElementById('milestones');
  const addBtn = document.getElementById('addMilestoneBtn');

  addBtn.addEventListener('click', () => {
    const count = container.querySelectorAll('.milestone-row').length;
    if (count >= 5) { showToast('Tối đa 5 cột mốc'); return; }

    const row = document.createElement('div');
    row.className = 'd-flex gap-2 mb-2 align-items-center milestone-row';
    row.innerHTML = `
      <input type="text" class="form-control form-control-sm" placeholder="Mô tả cột mốc" style="flex:2">
      <input type="date" class="form-control form-control-sm" style="flex:1">
      <button type="button" class="btn btn-sm btn-outline-danger border-0 milestone-remove" title="Xóa"><i class="bi bi-x-lg"></i></button>`;
    row.querySelector('.milestone-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
  });

  container.querySelectorAll('.milestone-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (container.querySelectorAll('.milestone-row').length > 1) {
        btn.closest('.milestone-row').remove();
      }
    });
  });
}

function getMilestones() {
  const rows = document.querySelectorAll('#milestones .milestone-row');
  const milestones = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const title = inputs[0].value.trim();
    const date = inputs[1].value;
    if (title) milestones.push({ title, date: date || null });
  });
  return milestones;
}

/* ── Form Submit ── */
function initFormSubmit() {
  const form = document.getElementById('projectForm');
  const err = document.getElementById('projectError');
  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitText');
  const submitSpinner = document.getElementById('submitSpinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    const user = firebase.auth().currentUser;
    if (!user) { showErr(err, 'Vui lòng đăng nhập'); return; }

    // Disable submit button
    submitBtn.disabled = true;
    submitText.textContent = 'Đang đăng...';
    submitSpinner.style.display = 'inline-block';

    const name = document.getElementById('pName').value.trim();
    const tagline = document.getElementById('pTagline').value.trim();
    const desc = document.getElementById('pDesc').value.trim();
    const category = document.getElementById('pCategory').value;
    const stage = document.getElementById('pStage').value;
    const goal = parseInt(document.getElementById('pGoal').value);
    const daysLeft = parseInt(document.getElementById('pDaysLeft').value) || 30;
    const url = document.getElementById('pUrl').value.trim();
    const email = document.getElementById('pEmail').value.trim();
    const team = document.getElementById('pTeam').value.trim();
    const useOfFunds = document.getElementById('pUseOfFunds').value.trim();

    const tags = getProjectTags();
    const categoryLabel = document.getElementById('pCategory').selectedOptions[0].text;
    const stageLabel = document.getElementById('pStage').selectedOptions[0].text;
    tags.push(categoryLabel);
    tags.push(stageLabel);

    const strategies = [];
    if (document.getElementById('stratCrowdfund').checked) strategies.push('crowdfund');
    if (document.getElementById('stratAngel').checked) strategies.push('angel');
    if (document.getElementById('stratSkill').checked) strategies.push('skill');

    const socialLinks = {};
    const fb = document.getElementById('pFacebook').value.trim();
    const li = document.getElementById('pLinkedin').value.trim();
    const tw = document.getElementById('pTwitter').value.trim();
    const gh = document.getElementById('pGithub').value.trim();
    if (fb) socialLinks.facebook = fb;
    if (li) socialLinks.linkedin = li;
    if (tw) socialLinks.twitter = tw;
    if (gh) socialLinks.github = gh;

    const project = {
      name, tagline, desc, category, stage, tags,
      goal, raised: 0, daysLeft,
      coverImage: coverImageUrl,
      gallery: galleryUrls,
      url, email, team, useOfFunds,
      strategies,
      socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
      milestones: getMilestones(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      userId: user.uid,
      userName: user.displayName || user.email
    };

    try {
      await db.collection('projects').add(project);

      // Show success state
      document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
      document.querySelector('.form-section[data-step="5"]').classList.add('active');
      document.getElementById('successState').hidden = false;
      document.getElementById('stepNav').style.display = 'none';
      document.getElementById('navButtons').style.display = 'none';
    } catch (e) {
      showErr(err, 'Không thể đăng dự án, vui lòng thử lại');
      submitBtn.disabled = false;
      submitText.textContent = 'Đăng dự án';
      submitSpinner.style.display = 'none';
    }
  });
}

/* ── Post Another ── */
function initPostAnother() {
  const btn = document.getElementById('postAnotherBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.getElementById('projectForm').reset();
    coverImageUrl = '';
    galleryUrls = [];
    document.getElementById('pCoverUrl').value = '';
    document.getElementById('pGalleryUrls').value = '';

    // Reset cover zone
    const zone = document.getElementById('coverUploadZone');
    zone.innerHTML = `
      <input type="file" id="coverInput" accept="image/*">
      <div class="upload-icon"><i class="bi bi-image"></i></div>
      <div class="upload-text">Kéo thả ảnh bìa vào đây hoặc nhấn để chọn</div>
      <div class="upload-hint">PNG, JPG, WebP · Tối đa 5MB · 1200x630px khuyến nghị</div>`;
    zone.classList.remove('has-image');
    zone.querySelector('input[type="file"]').addEventListener('change', function () {
      if (this.files[0]) initCoverUpload();
    });

    // Reset gallery
    updateGalleryGrid();
    document.getElementById('successState').hidden = true;
    document.getElementById('stepNav').style.display = 'flex';
    document.getElementById('navButtons').style.display = 'flex';
    goToStep(1);

    // Reset character counters
    document.querySelectorAll('.char-counter span').forEach(s => s.textContent = '0');

    // Re-init cover upload
    initCoverUpload();
  });
}

/* ── Helpers ── */
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

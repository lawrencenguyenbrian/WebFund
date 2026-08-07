/*
 * ============================================================
 *  Cloudinary Configuration
 * ============================================================
 */
const CLOUDINARY_CONFIG = {
  cloudName: 'dfdom0zpb',
  uploadPreset: 'WebFund'
};
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
const MAX_GALLERY_IMAGES = 6;

// Gemini API configuration (AI Pitch Helper) is defined in JS/config.local.js
// (gitignored; copy from JS/config.local.example.js). Must be loaded first.

const db = firebase.firestore();
let currentStep = 1;
let coverImageUrl = '';
let galleryUrls = [];
let currentUserRole = null;
let editingProjectId = null;
let editingProject = null;
let handleCoverFile = null;

const CHAR_LIMITS = [
  ['pName', 'nameCount', 100],
  ['pTagline', 'taglineCount', 150],
  ['pDesc', 'descCount', 2000],
  ['pUseOfFunds', 'fundsCount', 500],
  ['pTeam', 'teamCount', 500]
];

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
  initAiHelper();
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
        currentUserRole = role;
        if (role === 'investor') {
          if (myProjectsLink) myProjectsLink.style.display = 'none';
          if (portfolioLink) portfolioLink.style.display = 'block';
        } else {
          if (myProjectsLink) myProjectsLink.style.display = 'block';
          if (portfolioLink) portfolioLink.style.display = 'none';
        }
        if (adminLink) adminLink.style.display = role === 'admin' ? 'block' : 'none';
        loadEditMode(user);
      }).catch(() => {
        currentUserRole = null;
        loadEditMode(user);
      });
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
  CHAR_LIMITS.forEach(([inputId, countId, max]) => {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(countId);
    if (!input || !counter) return;
    input.addEventListener('input', () => updateCharCount(input, counter, max));
    updateCharCount(input, counter, max);
  });
}

function updateCharCount(input, counter, max) {
  const len = input.value.length;
  counter.textContent = len;
  const parent = counter.parentElement;
  parent.classList.remove('warning', 'danger');
  if (len > max * 0.9) parent.classList.add('danger');
  else if (len > max * 0.7) parent.classList.add('warning');
}

function updateCharCounters() {
  CHAR_LIMITS.forEach(([inputId, countId, max]) => {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(countId);
    if (input && counter) updateCharCount(input, counter, max);
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

  handleCoverFile = async function (file) {
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

function setCoverPreview(url) {
  const zone = document.getElementById('coverUploadZone');
  zone.innerHTML = `<img src="${url}" alt="Cover preview"><input type="file" id="coverInput" accept="image/*">`;
  zone.classList.add('has-image');
  const input = zone.querySelector('input[type="file"]');
  input.addEventListener('change', () => {
    if (input.files[0]) handleCoverFile(input.files[0]);
  });
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
  window.setProjectTags = (list) => {
    tags.length = 0;
    (list || []).forEach(t => {
      if (t && !tags.includes(t)) tags.push(t);
    });
    renderTags();
  };
}

/* ── Milestones ── */
function initMilestones() {
  const container = document.getElementById('milestones');
  const addBtn = document.getElementById('addMilestoneBtn');

  function addMilestoneRow(title, date) {
    const row = document.createElement('div');
    row.className = 'd-flex gap-2 mb-2 align-items-center milestone-row';
    row.innerHTML = `
      <input type="text" class="form-control form-control-sm" placeholder="Mô tả cột mốc" style="flex:2" value="${escapeAttr(title || '')}">
      <input type="date" class="form-control form-control-sm" style="flex:1" value="${date || ''}">
      <button type="button" class="btn btn-sm btn-outline-danger border-0 milestone-remove" title="Xóa"><i class="bi bi-x-lg"></i></button>`;
    row.querySelector('.milestone-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  addBtn.addEventListener('click', () => {
    const count = container.querySelectorAll('.milestone-row').length;
    if (count >= 5) { showToast('Tối đa 5 cột mốc'); return; }
    addMilestoneRow('', '');
  });

  container.querySelectorAll('.milestone-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (container.querySelectorAll('.milestone-row').length > 1) {
        btn.closest('.milestone-row').remove();
      }
    });
  });

  window.setProjectMilestones = (list) => {
    container.querySelectorAll('.milestone-row').forEach(el => el.remove());
    (list || []).forEach(m => addMilestoneRow(m.title, m.date));
    if (!container.querySelector('.milestone-row')) addMilestoneRow('', '');
  };
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

/* ── Edit Mode ── */
function loadEditMode(user) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('edit');
  if (!id) return;
  editingProjectId = id;

  db.collection('projects').doc(id).get()
    .then(doc => {
      if (!doc.exists) {
        window.location.href = 'my-projects.html';
        return;
      }
      const p = { id: doc.id, ...doc.data() };
      if (p.userId !== user.uid && currentUserRole !== 'admin') {
        window.location.href = 'my-projects.html';
        return;
      }
      editingProject = p;
      fillForm(p);
    })
    .catch(() => window.location.href = 'my-projects.html');
}

function fillForm(p) {
  const titleEl = document.querySelector('.post-hero h2');
  const subEl = document.querySelector('.post-hero p');
  if (titleEl) titleEl.textContent = 'Chỉnh sửa dự án';
  if (subEl) subEl.textContent = 'Cập nhật thông tin dự án của bạn.';
  document.getElementById('submitText').textContent = 'Lưu thay đổi';

  // Step 1
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pTagline').value = p.tagline || '';
  document.getElementById('pDesc').value = p.desc || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pStage').value = p.stage || '';

  const catLabel = document.getElementById('pCategory').selectedOptions[0]?.text || '';
  const stageLabel = document.getElementById('pStage').selectedOptions[0]?.text || '';
  const initialTags = (p.tags || []).filter(t => t && t !== catLabel && t !== stageLabel);
  setProjectTags(initialTags);

  // Step 2
  if (p.coverImage) setCoverPreview(p.coverImage);
  galleryUrls = p.gallery || [];
  document.getElementById('pCoverUrl').value = p.coverImage || '';
  document.getElementById('pGalleryUrls').value = galleryUrls.join(',');
  updateGalleryGrid();

  // Step 3
  document.getElementById('pGoal').value = p.goal || '';
  document.getElementById('pDaysLeft').value = p.daysLeft || 30;
  document.getElementById('pUseOfFunds').value = p.useOfFunds || '';
  setProjectMilestones(p.milestones || []);
  setProjectStrategies(p.strategies || []);

  // Step 4
  document.getElementById('pUrl').value = p.url || '';
  document.getElementById('pEmail').value = p.email || '';
  document.getElementById('pTeam').value = p.team || '';
  const social = p.socialLinks || {};
  document.getElementById('pFacebook').value = social.facebook || '';
  document.getElementById('pLinkedin').value = social.linkedin || '';
  document.getElementById('pTwitter').value = social.twitter || '';
  document.getElementById('pGithub').value = social.github || '';

  updateCharCounters();
  goToStep(1);
}

function setProjectStrategies(list) {
  const map = { crowdfund: 'stratCrowdfund', angel: 'stratAngel', skill: 'stratSkill' };
  for (const key in map) {
    const el = document.getElementById(map[key]);
    if (el) el.checked = (list || []).includes(key);
  }
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ── AI Pitch Helper ── */
let aiSuggestion = null;
const AI_FIELD_LIMITS = { pName: 100, pTagline: 150, pDesc: 2000 };
const AI_FIELD_KEYS = { pName: 'name', pTagline: 'tagline', pDesc: 'desc' };

function initAiHelper() {
  const btn = document.getElementById('aiSuggestBtn');
  if (!btn) return;
  const textarea = document.getElementById('pIdeaRough');
  const icon = btn.querySelector('.ai-btn-icon');

  btn.addEventListener('click', async () => {
    const rough = textarea.value.trim();
    if (!rough) {
      showToast('Vui lòng nhập ý tưởng sơ bộ trước khi dùng AI');
      return;
    }

    btn.disabled = true;
    if (icon) {
      icon.classList.remove('bi-stars');
      icon.classList.add('spinner-border', 'spinner-border-sm');
    }

    try {
      aiSuggestion = await generatePitchSuggestion(rough);
      renderAiSuggestions(aiSuggestion);
    } catch (err) {
      showToast(err.message || 'Không thể kết nối AI, vui lòng thử lại');
    } finally {
      btn.disabled = false;
      if (icon) {
        icon.classList.add('bi-stars');
        icon.classList.remove('spinner-border', 'spinner-border-sm');
      }
    }
  });

  const card = document.getElementById('aiSuggestionCard');
  if (card) {
    card.querySelectorAll('.ai-apply-btn').forEach(applyBtn => {
      applyBtn.addEventListener('click', () => {
        const field = applyBtn.dataset.target;
        const key = AI_FIELD_KEYS[field];
        const input = document.getElementById(field);
        if (!input || !aiSuggestion || !aiSuggestion[key]) return;
        input.value = aiSuggestion[key].slice(0, AI_FIELD_LIMITS[field]);
        updateCharCounters();
        showToast('Đã áp dụng gợi ý');
      });
    });
  }
}

async function generatePitchSuggestion(roughIdea) {
  const apiKey = GEMINI_CONFIG.apiKey;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey === 'YOUR_KEY_HERE') {
    throw new Error('Chưa cấu hình Gemini API key. Vui lòng copy JS/config.local.example.js thành JS/config.local.js và điền key của bạn.');
  }

  const prompt = `Bạn là chuyên gia pitch startup gọi vốn. Dựa trên ý tưởng của nhà sáng lập dưới đây, hãy tạo một bài pitch tiếng Việt hoàn chỉnh gồm 3 trường:
- name: tên dự án ngắn gọn, ấn tượng (tối đa 100 ký tự)
- tagline: mô tả ngắn hấp dẫn (tối đa 150 ký tự)
- desc: bài giới thiệu pitch chi tiết, giọng điệu startup (tối đa 2000 ký tự)

Trả về DUY NHẤT một object JSON hợp lệ với đúng 3 trường name, tagline, desc.
Không dùng markdown, không bọc trong \`\`\`json, không thêm lời mở đầu hay giải thích. Chỉ trả về JSON thuần.

Ý tưởng của nhà sáng lập:
"${roughIdea}"`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  if (!response.ok) {
    let msg = `Lỗi API Gemini (${response.status})`;
    try {
      const errData = await response.json();
      msg = errData.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini không trả về nội dung');

  let parsed;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    throw new Error('Không thể đọc phản hồi của AI');
  }

  return {
    name: String(parsed.name || '').trim(),
    tagline: String(parsed.tagline || '').trim(),
    desc: String(parsed.desc || '').trim()
  };
}

function stripJsonFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
}

function renderAiSuggestions(suggestion) {
  document.getElementById('aiName').textContent = suggestion.name || '—';
  document.getElementById('aiTagline').textContent = suggestion.tagline || '—';
  document.getElementById('aiDesc').textContent = suggestion.desc || '—';
  const card = document.getElementById('aiSuggestionCard');
  card.hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    submitText.textContent = editingProjectId ? 'Đang lưu...' : 'Đang đăng...';
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

    const baseProject = {
      name, tagline, desc, category, stage, tags,
      goal, daysLeft,
      coverImage: coverImageUrl,
      gallery: galleryUrls,
      url, email, team, useOfFunds,
      strategies,
      socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
      milestones: getMilestones()
    };

    try {
      if (editingProjectId && editingProject) {
        await db.collection('projects').doc(editingProjectId).set({
          ...baseProject,
          status: editingProject.status || 'pending',
          raised: editingProject.raised || 0
        }, { merge: true });
      } else {
        await db.collection('projects').add({
          ...baseProject,
          status: 'pending',
          raised: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email
        });
      }

      // Show success state
      if (editingProjectId && editingProject) {
        document.getElementById('successTitle').textContent = 'Lưu thay đổi thành công!';
        document.getElementById('successDesc').textContent = 'Thông tin dự án của bạn đã được cập nhật.';
        document.getElementById('viewProjectBtn').textContent = 'Xem dự án';
        document.getElementById('viewProjectBtn').href = `project.html?id=${editingProjectId}`;
        document.getElementById('postAnotherBtn').style.display = 'none';
      }

      document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
      document.querySelector('.form-section[data-step="5"]').classList.add('active');
      document.getElementById('successState').hidden = false;
      document.getElementById('stepNav').style.display = 'none';
      document.getElementById('navButtons').style.display = 'none';
    } catch (e) {
      console.error('Lưu dự án thất bại:', e);
      showErr(err, 'Không thể đăng dự án, vui lòng thử lại');
      submitBtn.disabled = false;
      submitText.textContent = editingProjectId ? 'Lưu thay đổi' : 'Đăng dự án';
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

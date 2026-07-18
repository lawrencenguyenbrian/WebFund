const db = firebase.firestore();
let authInited = false;

document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      checkUserRedirect(user);
      return;
    }
    if (authInited) return;
    authInited = true;
    initThemeToggle();
    initAuth();
  });
});

async function checkUserRedirect(user) {
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().role) {
      window.location.href = 'main.html';
    } else {
      const pendingRole = lsGet('webfund-pending-role');
      if (pendingRole) {
        await db.collection('users').doc(user.uid).set({
          name: user.displayName || user.email || '',
          email: user.email || '',
          role: pendingRole,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        lsRemove('webfund-pending-role');
        window.location.href = 'main.html';
      } else {
        window.location.href = 'select-role.html';
      }
    }
  } catch (e) {
    window.location.href = 'main.html';
  }
}

async function saveUser(user) {
  try {
    await db.collection('users').doc(user.uid).set({
      name: user.displayName || '',
      email: user.email || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {}
}

function initAuth() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginErr = document.getElementById('loginError');
  const registerErr = document.getElementById('registerError');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      window.location.href = 'main.html';
    } catch (err) {
      showErr(loginErr, mapAuthError(err.code));
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const roleRadio = document.querySelector('input[name="registerRole"]:checked');
    const role = roleRadio ? roleRadio.value : 'founder';
    if (!name || !email || !password) {
      showErr(registerErr, 'Vui lòng điền đầy đủ thông tin');
      return;
    }
    try {
      lsSet('webfund-pending-role', role);
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      await db.collection('users').doc(cred.user.uid).set({
        name, email, role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      lsRemove('webfund-pending-role');
      window.location.href = 'main.html';
    } catch (err) {
      showErr(registerErr, mapAuthError(err.code));
    }
  });

  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const googleRegisterBtn = document.getElementById('googleRegisterBtn');
  const provider = new firebase.auth.GoogleAuthProvider();

  async function signInGoogle(errEl) {
    try {
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      const doc = await db.collection('users').doc(user.uid).get();
      if (doc.exists && doc.data().role) {
        window.location.href = 'main.html';
      } else {
        window.location.href = 'select-role.html';
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showErr(errEl, mapAuthError(err.code));
      }
    }
  }

  googleLoginBtn.addEventListener('click', () => signInGoogle(loginErr));
  googleRegisterBtn.addEventListener('click', () => signInGoogle(registerErr));
}

function mapAuthError(code) {
  const map = {
    'auth/user-not-found': 'Email chưa được đăng ký',
    'auth/wrong-password': 'Sai mật khẩu',
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng',
    'auth/email-already-in-use': 'Email đã được sử dụng',
    'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự',
    'auth/invalid-email': 'Email không hợp lệ',
    'auth/too-many-requests': 'Tạm thời bị khóa do nhập sai quá nhiều lần, thử lại sau'
  };
  return map[code] || 'Đã có lỗi xảy ra, vui lòng thử lại';
}

function showErr(el, msg) {
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => el.hidden = true, 3500);
}

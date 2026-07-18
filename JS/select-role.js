const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }
    initRoleSelection(user);
  });
});

function initRoleSelection(user) {
  const err = document.getElementById('roleError');

  document.querySelectorAll('.role-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const role = btn.dataset.role;
      btn.classList.add('selected');
      btn.disabled = true;

      document.querySelectorAll('.role-option').forEach(b => {
        if (b !== btn) b.style.opacity = '0.4';
      });

      try {
        await db.collection('users').doc(user.uid).set({
          role: role,
          name: user.displayName || '',
          email: user.email || '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        window.location.href = 'main.html';
      } catch (e) {
        err.textContent = 'Không thể lưu vai trò, vui lòng thử lại';
        err.hidden = false;
        setTimeout(() => err.hidden = true, 3500);
        btn.disabled = false;
        btn.classList.remove('selected');
        document.querySelectorAll('.role-option').forEach(b => b.style.opacity = '1');
      }
    });
  });
}



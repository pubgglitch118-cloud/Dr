// ============================================================
// Dr. Ruhm Badr - Firebase Configuration (Realtime Database)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCrv63Gpb6eRCjuNUSAZjcSgUWFpHDjVcc",
  authDomain: "clinic-52f6e.firebaseapp.com",
  databaseURL: "https://clinic-52f6e-default-rtdb.firebaseio.com",
  projectId: "clinic-52f6e",
  storageBucket: "clinic-52f6e.firebasestorage.app",
  messagingSenderId: "631576216692",
  appId: "1:631576216692:web:4008c207acf6cd4c223d21",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Connection status badge only in dashboard
if (window.location.pathname.includes('/dashboard/')) {
  function initStatusBadge() {
    var badge = document.createElement('div');
    badge.id = 'dbStatus';
    badge.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:6px 14px;border-radius:20px;font-size:0.72rem;font-weight:600;font-family:inherit;direction:ltr;display:flex;align-items:center;gap:6px;box-shadow:0 2px 12px rgba(0,0,0,0.1);transition:all 0.3s;background:#fef3c7;color:#92400e;';
    badge.textContent = '⏳ جاري الاتصال...';
    document.body.appendChild(badge);

    db.ref('.info/connected').on('value', function(snap) {
      if (snap.val() === true) {
        badge.textContent = '✅ متصل';
        badge.style.background = '#f0fdf4';
        badge.style.color = '#166534';
        setTimeout(function() { badge.style.opacity = '0'; badge.style.pointerEvents = 'none'; }, 4000);
      } else {
        badge.textContent = '❌ غير متصل';
        badge.style.background = '#fef2f2';
        badge.style.color = '#991b1b';
        badge.style.opacity = '1';
        badge.style.pointerEvents = 'auto';
      }
    });
  }

  if (document.body) {
    initStatusBadge();
  } else {
    document.addEventListener('DOMContentLoaded', initStatusBadge);
  }
}

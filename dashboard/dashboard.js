// ============================================================
// Dr. Ruhm Badr - Dashboard Logic
// ============================================================

const STYLE = document.createElement('style');
STYLE.textContent = `.action-btn { padding:6px 14px;border:none;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit; }
.action-btn:hover { transform:translateY(-1px); }`;
document.head.appendChild(STYLE);

let allBookings = [];
let rejectBookingId = null;
let chatBookingId = null;
let chatUnsubFn = null;
let bookingsUnsub = null;

// Show dashboard directly (no auth)
document.getElementById('dashView').style.display = 'block';
loadSettings();
subscribeToBookings();

// ── View Switching ──
function switchView(view, el) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
  if (view === 'bookings') renderTable(allBookings);
}

// ── Real-time Bookings ──
function subscribeToBookings() {
  if (bookingsUnsub) bookingsUnsub();

  bookingsUnsub = db.collection('bookings')
    .orderBy('created_at', 'desc')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = { id: change.doc.id, ...change.doc.data() };

        if (change.type === 'added') {
          allBookings.unshift(data);
          if (data.status === 'pending') {
            playNotif();
            showToast(`🔔 حجز جديد #${data.booking_number} — ${data.patient_name}`);
          }
        } else if (change.type === 'modified') {
          const idx = allBookings.findIndex(b => b.id === data.id);
          if (idx !== -1) allBookings[idx] = data;
        } else if (change.type === 'removed') {
          allBookings = allBookings.filter(b => b.id !== data.id);
        }
      });

      renderTable(allBookings);
      updateStats();
    }, (error) => {
      console.error('Bookings subscription error:', error);
    });
}

function updateStats() {
  document.getElementById('statTotal').textContent = allBookings.length;
  document.getElementById('statPending').textContent = allBookings.filter(b => b.status === 'pending').length;
  document.getElementById('statAccepted').textContent = allBookings.filter(b => b.status === 'accepted').length;
  document.getElementById('statRejected').textContent = allBookings.filter(b => b.status === 'rejected').length;
}

function renderTable(bookings) {
  const tbody = document.getElementById('bookingsBody');

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:40px;">لا توجد حجوزات</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const statusClass = `badge-${b.status}`;
    const statusText = { pending: 'قيد الانتظار', accepted: 'تم القبول', rejected: 'مرفوض' }[b.status] || b.status;
    const date = b.created_at
      ? new Date(b.created_at.seconds * 1000).toLocaleDateString('ar-EG')
      : '-';
    const price = window.cachedPrices && window.cachedPrices[b.service] ? `${window.cachedPrices[b.service]} ر.س` : '-';

    return `<tr>
      <td><strong>#${b.booking_number}</strong></td>
      <td>${escHtml(b.patient_name)}</td>
      <td dir="ltr">${escHtml(b.phone)}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(b.service)}">
        ${escHtml(b.service)}
      </td>
      <td style="font-weight:600;color:var(--gold);">${price}</td>
      <td>${date}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        ${b.status === 'pending' ? `
          <button class="action-btn" style="background:#16a34a;color:white;" onclick="acceptBooking('${b.id}')">✓ قبول</button>
          <button class="action-btn" style="background:#dc2626;color:white;" onclick="openRejectModal('${b.id}')">✕ رفض</button>
        ` : ''}
        <button class="action-btn" style="background:var(--text-primary);color:white;" onclick="openDoctorChat('${b.id}','${escHtml(b.patient_name)}')">💬</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Accept ──
async function acceptBooking(id) {
  try {
    await db.collection('bookings').doc(id).update({ status: 'accepted' });
    showToast('✅ تم قبول الحجز');
  } catch (e) {
    showToast('❌ خطأ في قبول الحجز');
  }
}

// ── Reject ──
function openRejectModal(id) {
  rejectBookingId = id;
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectModal').classList.add('active');
}

function closeRejectModal() {
  rejectBookingId = null;
  document.getElementById('rejectModal').classList.remove('active');
}

async function confirmReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) {
    alert('الرجاء كتابة سبب الرفض');
    return;
  }
  try {
    await db.collection('bookings').doc(rejectBookingId).update({
      status: 'rejected',
      rejection_reason: reason,
    });
    showToast('✅ تم رفض الحجز');
    closeRejectModal();
  } catch (e) {
    showToast('❌ خطأ في رفض الحجز');
  }
}

document.getElementById('rejectModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('rejectModal')) closeRejectModal();
});

// ── Search ──
function searchBookings(query) {
  if (!query.trim()) { renderTable(allBookings); return; }
  const q = query.toLowerCase();
  const filtered = allBookings.filter(b =>
    (b.patient_name || '').toLowerCase().includes(q) ||
    (b.phone || '').includes(q) ||
    String(b.booking_number || '').includes(q)
  );
  renderTable(filtered);
}

// ── Settings ──
async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc('settings').get();
    if (!doc.exists) {
      await db.collection('settings').doc('settings').set({
        work_days: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed'],
        work_start: '09:00:00',
        work_end: '17:00:00',
        max_patients_per_day: 20,
        slot_duration_minutes: 30,
        service_prices: {
          'تبيض الأسنان': 500,
          'تنظيف وتلميع': 300,
          'فينير أو لومينير': 800,
          'حشوات تجميلية': 400,
          'كشف شامل': 200,
        },
      });
      return;
    }
    const s = doc.data();
    document.querySelectorAll('#daysGrid input[type="checkbox"]').forEach(cb => {
      cb.checked = s.work_days && s.work_days.includes(cb.value);
    });
    if (s.work_start) document.getElementById('workStart').value = s.work_start.slice(0, 5);
    if (s.work_end) document.getElementById('workEnd').value = s.work_end.slice(0, 5);
    if (s.max_patients_per_day) document.getElementById('maxPatients').value = s.max_patients_per_day;
    if (s.service_prices) {
      window.cachedPrices = s.service_prices;
      for (const [name, price] of Object.entries(s.service_prices)) {
        const el = document.getElementById(`sprice-${name}`);
        if (el) el.value = price;
      }
    }
  } catch (e) {
    console.error('Load settings error:', e);
  }
}

async function saveSettings() {
  const days = Array.from(document.querySelectorAll('#daysGrid input:checked')).map(cb => cb.value);
  const workStart = document.getElementById('workStart').value;
  const workEnd = document.getElementById('workEnd').value;
  const maxP = parseInt(document.getElementById('maxPatients').value) || 20;

  const prices = {};
  document.querySelectorAll('.service-price-input').forEach(el => {
    const name = el.id.replace('sprice-', '');
    prices[name] = parseInt(el.value) || 0;
  });

  try {
    await db.collection('settings').doc('settings').update({
      work_days: days,
      work_start: workStart + ':00',
      work_end: workEnd + ':00',
      max_patients_per_day: maxP,
      service_prices: prices,
    });
    const msg = document.getElementById('settingsMsg');
    msg.textContent = '✅ تم حفظ الإعدادات بنجاح';
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
  } catch (e) {
    alert('خطأ في حفظ الإعدادات');
  }
}

// ── Chat ──
function openDoctorChat(bookingId, patientName) {
  if (chatUnsubFn) { chatUnsubFn(); chatUnsubFn = null; }

  chatBookingId = bookingId;
  document.getElementById('chatPatientName').textContent = patientName;
  document.getElementById('chatPanel').classList.add('open');
  document.getElementById('chatMsgs').innerHTML = '';

  db.collection('chat_messages')
    .where('booking_id', '==', bookingId)
    .orderBy('created_at', 'asc')
    .get()
    .then((snapshot) => {
      if (!snapshot.empty) document.getElementById('chatMsgs').innerHTML = '';
      snapshot.forEach((doc) => appendDashMsg(doc.data(), doc.id));
    });

  chatUnsubFn = db.collection('chat_messages')
    .where('booking_id', '==', bookingId)
    .orderBy('created_at', 'asc')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const existing = document.querySelector(`[data-cid="${change.doc.id}"]`);
          if (!existing) appendDashMsg(change.doc.data(), change.doc.id);
        }
      });
    });
}

function appendDashMsg(msg, docId) {
  const container = document.getElementById('chatMsgs');
  const emptyP = container.querySelector('p');
  if (emptyP) emptyP.remove();

  const div = document.createElement('div');
  div.className = `msg ${msg.sender}`;
  if (docId) div.dataset.cid = docId;
  div.textContent = msg.message || '';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendDoctorMsg() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !chatBookingId) return;
  input.value = '';

  try {
    await db.collection('chat_messages').add({
      booking_id: chatBookingId,
      sender: 'doctor',
      message: text,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Send error:', e);
  }
}

function closeChatPanel() {
  document.getElementById('chatPanel').classList.remove('open');
  if (chatUnsubFn) { chatUnsubFn(); chatUnsubFn = null; }
  chatBookingId = null;
}

// Enter to send in chat
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement === document.getElementById('chatInput')) {
    sendDoctorMsg();
  }
});

// ── Toast ──
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

// ── Utils ──
function escHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function playNotif() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) { /* silent */ }
}

console.log('✅ Dr. Ruhm Badr Dashboard loaded');

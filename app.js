// ============================================================
// Dr. Ruhm Badr - Main Site Logic
// ============================================================

let currentBookingId = null;
let currentBookingNumber = null;

// ── Service Selection ──
function selectService(card) {
  document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');

  const service = card.dataset.service || '';
  document.getElementById('selectedService').value = service;
}

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const el = document.querySelector(a.getAttribute('href'));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── Booking Form ──
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = bookingForm.querySelector('button[type="submit"]');
    const errEl = document.getElementById('formError');

    const service = document.getElementById('selectedService').value;

    if (!service) {
      errEl.textContent = 'الرجاء اختيار خدمة من القائمة';
      errEl.classList.add('show');
      return;
    }

    const formData = {
      patient_name: document.getElementById('patientName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      service: service,
    };

    btn.disabled = true;
    btn.textContent = 'جاري تأكيد الحجز...';
    errEl.classList.remove('show');

    try {
      const { success, booking_number, booking_id, error } = await createBooking(formData);

      if (success && booking_number && booking_id) {
        currentBookingNumber = booking_number;
        currentBookingId = booking_id;
        showSuccess(booking_number);
        initChat(booking_id, booking_number);
      } else {
        errEl.textContent = error || 'فشل الحجز. حاول مرة أخرى.';
        errEl.classList.add('show');
      }
    } catch (err) {
      errEl.textContent = 'خطأ غير متوقع. حاول مرة أخرى.';
      errEl.classList.add('show');
    }

    btn.disabled = false;
    btn.textContent = 'احجز موعدك الآن';
  });
}

function showSuccess(number) {
  document.getElementById('bookingFormView').style.display = 'none';
  document.getElementById('successView').style.display = 'block';
  document.getElementById('bookingNumber').textContent = `#${number}`;
  document.getElementById('successView').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Create Booking ──
async function createBooking(data) {
  const settingsDoc = await db.collection('settings').doc('settings').get();
  const settings = settingsDoc.data();
  if (!settings) {
    return { success: false, error: 'خطأ في إعدادات النظام' };
  }

  const today = new Date().toISOString().split('T')[0];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[new Date().getDay()];

  if (!settings.work_days || !settings.work_days.includes(dayName)) {
    const days = (settings.work_days || []).join(', ');
    return { success: false, error: `العيادة مغلقة اليوم. الأيام المتاحة: ${days}` };
  }

  const todaySnapshot = await db.collection('bookings')
    .where('preferred_date', '==', today)
    .get();
  const todayCount = todaySnapshot.size;

  if (todayCount >= settings.max_patients_per_day) {
    return { success: false, error: `الحد الأقصى للحجوزات اليوم (${settings.max_patients_per_day}) قد اكتمل. حاول غداً.` };
  }

  // Get next booking number using transaction
  let bookingNumber;
  try {
    const counterRef = db.collection('counters').doc('booking_counter');
    bookingNumber = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let nextNum;
      if (!counterDoc.exists) {
        nextNum = 1001;
        transaction.set(counterRef, { current: nextNum });
      } else {
        nextNum = counterDoc.data().current + 1;
        transaction.update(counterRef, { current: nextNum });
      }
      return nextNum;
    });
  } catch (e) {
    const maxDoc = await db.collection('bookings')
      .orderBy('booking_number', 'desc')
      .limit(1)
      .get();
    bookingNumber = maxDoc.empty ? 1001 : maxDoc.docs[0].data().booking_number + 1;
  }

  const bookingData = {
    booking_number: bookingNumber,
    patient_name: data.patient_name,
    phone: data.phone,
    service: data.service,
    preferred_date: today,
    status: 'pending',
    rejection_reason: null,
    created_at: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('bookings').add(bookingData);
  return { success: true, booking_number: bookingNumber, booking_id: docRef.id };
}

// ── Chat ──
let chatUnsub = null;

function initChat(bookingId, bookingNumber) {
  document.getElementById('chatWidget').style.display = 'block';
  document.getElementById('chatToggle').onclick = () => toggleChat(bookingId, bookingNumber);
}

function toggleChat(bookingId, bookingNumber) {
  const panel = document.getElementById('chatPanel');
  const isOpen = panel.classList.contains('open');

  if (!isOpen) {
    panel.classList.add('open');
    loadChat(bookingId);
  } else {
    closeChat();
  }
}

function closeChat() {
  document.getElementById('chatPanel').classList.remove('open');
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
}

function loadChat(bookingId) {
  if (chatUnsub) chatUnsub();
  document.getElementById('chatMsgs').innerHTML = '';

  db.collection('chat_messages')
    .where('booking_id', '==', bookingId)
    .orderBy('created_at', 'asc')
    .get()
    .then((snapshot) => {
      if (!snapshot.empty) {
        document.getElementById('chatMsgs').innerHTML = '';
      }
      snapshot.forEach((doc) => appendChatMsg(doc.data(), doc.id));
    });

  chatUnsub = db.collection('chat_messages')
    .where('booking_id', '==', bookingId)
    .orderBy('created_at', 'asc')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const existing = document.querySelector(`[data-msg-id="${change.doc.id}"]`);
          if (!existing) appendChatMsg(change.doc.data(), change.doc.id);
        }
      });
    });
}

function appendChatMsg(msg, docId) {
  const container = document.getElementById('chatMsgs');
  const empty = container.querySelector('p');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `msg ${msg.sender}`;
  if (docId) div.dataset.msgId = docId;
  div.textContent = msg.message || '';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMsg() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !currentBookingId) return;
  input.value = '';

  await db.collection('chat_messages').add({
    booking_id: currentBookingId,
    sender: 'patient',
    message: text,
    created_at: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Enter to send in chat
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement === document.getElementById('chatInput')) {
    sendChatMsg();
  }
});

// ── Status Page ──
const statusForm = document.getElementById('statusForm');
if (statusForm) {
  statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const num = parseInt(document.getElementById('statusNumber').value);
    const resultDiv = document.getElementById('statusResult');

    const snapshot = await db.collection('bookings')
      .where('booking_number', '==', num)
      .get();

    if (snapshot.empty) {
      resultDiv.innerHTML = '<div class="msg-error show" style="display:block;">رقم الحجز غير موجود</div>';
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const statusText = { pending: 'قيد الانتظار', accepted: 'تم القبول', rejected: 'مرفوض' };
    const badgeClass = `badge-${data.status}`;
    let servicePrice = '';
    const priceEl = document.getElementById(`price-${data.service}`);
    if (priceEl) servicePrice = `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);"><span style="color:var(--text-muted);font-size:0.85rem;">السعر</span><span style="font-weight:700;color:var(--gold);">${priceEl.textContent} ر.س</span></div>`;

    resultDiv.innerHTML = `
      <div style="background:var(--surface);border-radius:var(--radius-md);padding:32px;margin-top:20px;border:1px solid var(--border-light);animation:fade-up 0.5s ease-out;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:3rem;font-weight:900;color:var(--text-primary);line-height:1;" class="gold-text-glow">
            #${data.booking_number}
          </div>
        </div>
        <div style="display:grid;gap:12px;">
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);">
            <span style="color:var(--text-muted);font-size:0.85rem;">الاسم</span>
            <span style="font-weight:600;">${escapeHtml(data.patient_name)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);">
            <span style="color:var(--text-muted);font-size:0.85rem;">الهاتف</span>
            <span style="font-weight:600;direction:ltr;">${escapeHtml(data.phone)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);">
            <span style="color:var(--text-muted);font-size:0.85rem;">الخدمة</span>
            <span style="font-weight:600;">${escapeHtml(data.service)}</span>
          </div>
          ${servicePrice}
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);">
            <span style="color:var(--text-muted);font-size:0.85rem;">التاريخ</span>
            <span style="font-weight:600;">${data.created_at ? new Date(data.created_at.seconds * 1000).toLocaleDateString('ar-EG') : '-'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;">
            <span style="color:var(--text-muted);font-size:0.85rem;">الحالة</span>
            <span class="badge ${badgeClass}">${statusText[data.status] || data.status}</span>
          </div>
          ${data.status === 'rejected' && data.rejection_reason ? `
            <div style="margin-top:8px;padding:16px;background:#fef2f2;border-radius:var(--radius-sm);border:1px solid #fecaca;">
              <p style="font-weight:600;color:#991b1b;margin-bottom:4px;font-size:0.85rem;">سبب الرفض:</p>
              <p style="color:#b91c1c;font-size:0.9rem;">${escapeHtml(data.rejection_reason)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });
}

// ── Toast ──
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

// ── Load Prices from Firebase ──
async function loadServicePrices() {
  try {
    const settingsDoc = await db.collection('settings').doc('settings').get();
    if (settingsDoc.exists && settingsDoc.data().service_prices) {
      const prices = settingsDoc.data().service_prices;
      for (const [name, price] of Object.entries(prices)) {
        const el = document.getElementById(`price-${name}`);
        if (el) {
          el.textContent = price;
          const card = el.closest('.service-card');
          if (card) card.dataset.price = price;
        }
      }
    }
  } catch (e) {
    // use default prices from HTML
  }
}
loadServicePrices();

// ── Utilities ──
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

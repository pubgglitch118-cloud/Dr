// ============================================================
// Dr. Ruhm Badr - Main Site Logic (RTDB)
// ============================================================
console.log('app.js RTDB loaded');

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
      const { success, booking_number, booking_id, preferred_date, error } = await createBooking(formData);

      if (success && booking_number && booking_id) {
        currentBookingNumber = booking_number;
        currentBookingId = booking_id;
        showSuccess(booking_number, preferred_date);
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

function showSuccess(number, preferredDate) {
  document.getElementById('bookingFormView').style.display = 'none';
  document.getElementById('successView').style.display = 'block';
  document.getElementById('bookingNumber').textContent = '#' + number;
  if (preferredDate) {
    var d = new Date(preferredDate + 'T12:00:00');
    var dateStr = d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('successDate').textContent = '📅 موعدك: ' + dateStr;
  }
  // Save to localStorage for status page auto-fill
  try { localStorage.setItem('drLastBooking', String(number)); } catch (e) { /* ignore */ }
  document.getElementById('successView').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Create Booking ──
async function createBooking(data) {
  console.log('createBooking called', data);
  let settings = null;
  try {
    const settingsSnap = await db.ref('settings/settings').once('value');
    if (settingsSnap.exists()) {
      settings = settingsSnap.val();
    }
  } catch (e) {
    console.error('settings read error:', e.message);
  }
  if (!settings) {
    console.log('using default settings');
    settings = {
      work_days: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed'],
      work_start: '09:00:00',
      work_end: '17:00:00',
      max_patients_per_day: 20,
      service_prices: {
        'تبيض الأسنان': 500,
        'تنظيف وتلميع': 300,
        'فينير أو لومينير': 800,
        'حشوات تجميلية': 400,
        'كشف شامل': 200,
      },
    };
    try {
      await db.ref('settings/settings').set(settings);
      console.log('default settings saved');
    } catch (e) { console.error('save defaults error:', e.message); }
  }

  // Check for active booking from same phone number
  const phoneSnap = await db.ref('bookings').orderByChild('phone').equalTo(data.phone).once('value');
  let hasActive = false;
  if (phoneSnap.exists()) {
    phoneSnap.forEach(function(child) {
      var st = child.val().status;
      if (st === 'accepted') hasActive = true;
    });
  }
  if (hasActive) {
    return { success: false, error: 'لديك حجز نشط بالفعل. لا يمكن حجز أكثر من حجز في نفس الوقت.' };
  }

  // Find next available work day with capacity (auto-cycle)
  const workDays = settings.work_days;
  const maxPerDay = settings.max_patients_per_day;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let preferredDate = null;

  for (let i = 0; i <= 30; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];
    const dayName = dayNames[checkDate.getDay()];
    if (!workDays.includes(dayName)) continue;

    const daySnap = await db.ref('bookings').orderByChild('preferred_date').equalTo(dateStr).once('value');
    let activeCount = 0;
    if (daySnap.exists()) {
      daySnap.forEach(function(child) {
        var st = child.val().status;
        if (st === 'accepted' || st === 'arrived') activeCount++;
      });
    }

    if (activeCount < maxPerDay) {
      preferredDate = dateStr;
      break;
    }
  }

  if (!preferredDate) {
    return { success: false, error: 'جميع أيام العمل ممتلئة في الشهر القادم. تواصل مع العيادة.' };
  }

  // Count accepted on this date to assign queue position
  var daySnap = await db.ref('bookings').orderByChild('preferred_date').equalTo(preferredDate).once('value');
  var acceptedCount = 0;
  if (daySnap.exists()) {
    daySnap.forEach(function(child) {
      if (child.val().status === 'accepted' || child.val().status === 'arrived') acceptedCount++;
    });
  }
  var queuePos = acceptedCount + 1;

  // Generate unique booking number (max 11 digits: YYMMDD + 5 random)
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand5 = String(Math.floor(Math.random() * 90000) + 10000);
  const bookingNumber = parseInt(y + mm + dd + rand5);

  const bookingData = {
    booking_number: bookingNumber,
    patient_name: data.patient_name,
    phone: data.phone,
    service: data.service,
    preferred_date: preferredDate,
    status: 'accepted',
    queue_position: queuePos,
    created_at: firebase.database.ServerValue.TIMESTAMP,
  };

  const pushRef = await db.ref('bookings').push(bookingData);
  return { success: true, booking_number: bookingNumber, booking_id: pushRef.key, preferred_date: preferredDate };
}

// ── Get Next Work Day ──
function getNextWorkDay(workDays) {
  if (!workDays || workDays.length === 0) return new Date().toISOString().split('T')[0];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  for (let i = 1; i <= 8; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (workDays.includes(dayNames[d.getDay()])) {
      return d.toISOString().split('T')[0];
    }
  }
  return today.toISOString().split('T')[0];
}

// ── Status Page ──
var statusForm = document.getElementById('statusForm');
if (statusForm) {
  statusForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var num = parseInt(document.getElementById('statusNumber').value);
    var resultDiv = document.getElementById('statusResult');

    var snap = await db.ref('bookings').orderByChild('booking_number').equalTo(num).once('value');

    if (!snap.exists()) {
      resultDiv.innerHTML = '<div class="msg-error show" style="display:block;">رقم الحجز غير موجود</div>';
      return;
    }

    var data = null;
    snap.forEach(function(child) { data = { id: child.key, ...child.val() }; });

    var statusText = { pending: 'قيد الانتظار', accepted: 'تم القبول', arrived: 'حضر', rejected: 'مرفوض', cancelled: 'ملغي' };
    var badgeClass = 'badge-' + data.status;

    var dateStr = data.preferred_date ? new Date(data.preferred_date + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';
    var showQueue = data.status === 'accepted' && data.queue_position;
    var queueStr = showQueue ? '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);"><span style="color:var(--text-muted);font-size:0.85rem;">ترتيبك في الطابور</span><span style="font-weight:700;color:var(--gold);font-size:1.1rem;">#' + data.queue_position + '</span></div>' : '';

    resultDiv.innerHTML = '<div style="background:var(--surface);border-radius:var(--radius-md);padding:32px;margin-top:20px;border:1px solid var(--border-light);animation:fade-up 0.5s ease-out;">' +
      '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:3rem;font-weight:900;color:var(--text-primary);line-height:1;" class="gold-text-glow">#' + data.booking_number + '</div></div>' +
      '<div style="display:grid;gap:12px;">' +
      '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);"><span style="color:var(--text-muted);font-size:0.85rem;">الاسم</span><span style="font-weight:600;">' + escapeHtml(data.patient_name) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);"><span style="color:var(--text-muted);font-size:0.85rem;">الهاتف</span><span style="font-weight:600;direction:ltr;">' + escapeHtml(data.phone) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);"><span style="color:var(--text-muted);font-size:0.85rem;">الخدمة</span><span style="font-weight:600;">' + escapeHtml(data.service) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);"><span style="color:var(--text-muted);font-size:0.85rem;">موعدك</span><span style="font-weight:600;color:var(--gold);">' + dateStr + '</span></div>' +
      queueStr +
      '<div style="display:flex;justify-content:space-between;padding:10px 0;"><span style="color:var(--text-muted);font-size:0.85rem;">الحالة</span><span class="badge ' + badgeClass + '">' + (statusText[data.status] || data.status) + '</span></div>' +
      ((data.status === 'rejected' || data.status === 'cancelled') && data.rejection_reason ? '<div style="margin-top:8px;padding:16px;background:#fef2f2;border-radius:var(--radius-sm);border:1px solid #fecaca;"><p style="font-weight:600;color:#991b1b;margin-bottom:4px;font-size:0.85rem;">السبب:</p><p style="color:#b91c1c;font-size:0.9rem;">' + escapeHtml(data.rejection_reason) + '</p></div>' : '') +
      '</div></div>';
  });
}

// ── Load Work Info & Display ──
async function loadWorkInfo() {
  try {
    const snap = await db.ref('settings/settings').once('value');
    console.log('loadWorkInfo: exists =', snap.exists(), 'data =', snap.val());
    if (snap.exists()) {
      const s = snap.val();
      const dayMap = { 'Sat': 'السبت', 'Sun': 'الأحد', 'Mon': 'الإثنين', 'Tue': 'الثلاثاء', 'Wed': 'الأربعاء', 'Thu': 'الخميس', 'Fri': 'الجمعة' };
      const daysStr = (s.work_days || []).map(d => dayMap[d] || d).join('، ');
      const nextDate = getNextWorkDay(s.work_days);
      const infoEl = document.getElementById('workInfo');
      if (infoEl && daysStr) {
        const nextDateObj = new Date(nextDate + 'T12:00:00');
        const dateStr = nextDateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        infoEl.innerHTML = `
          <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.8;">
            <span style="font-weight:600;color:var(--gold);">أيام العمل:</span> ${daysStr}
            <br>
            <span style="font-weight:600;color:var(--gold);">ساعات العمل:</span> ${s.work_start ? s.work_start.slice(0, 5) : '09:00'} — ${s.work_end ? s.work_end.slice(0, 5) : '17:00'}
            <br>
            <span style="font-weight:600;color:var(--gold);">الحد الأقصى:</span> ${s.max_patients_per_day || 20} مريض في اليوم
            <br>
            <span style="font-weight:600;color:var(--gold);">أقرب موعد متاح:</span> ${dateStr}
          </div>`;
      }
      window.workSettings = s;
    }
  } catch (e) { /* use defaults */ }
}

// ── Load Prices from Firebase ──
async function loadServicePrices() {
  try {
    const snap = await db.ref('settings/settings').once('value');
    console.log('loadServicePrices: exists =', snap.exists(), 'data =', snap.val() ? Object.keys(snap.val()) : null);
    if (snap.exists() && snap.val().service_prices) {
      const prices = snap.val().service_prices;
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
loadWorkInfo();
loadServicePrices();

// ── Utilities ──
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Copy Booking Number ──
function copyBookingNumber() {
  var num = document.getElementById('bookingNumber');
  if (!num) return;
  var text = num.textContent.replace('#', '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('✅ تم نسخ رقم الحجز');
    }).catch(function() {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('✅ تم نسخ رقم الحجز'); } catch (e) { showToast('❌ فشل النسخ'); }
  document.body.removeChild(ta);
}

function showToast(msg) {
  var el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f2937;color:white;padding:12px 24px;border-radius:12px;font-size:0.9rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.2);direction:rtl;max-width:90vw;text-align:center;font-family:sans-serif;';
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 2500);
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

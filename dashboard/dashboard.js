// ============================================================
// Dr. Ruhm Badr - Dashboard Logic (RTDB)
// ============================================================

const DASH_PASSWORD = '1357910';

let allBookings = [];
let rejectBookingId = null;
let bookingsUnsub = null;

// ── Password Lock ──
function unlockDashboard() {
  const pass = document.getElementById('dashPass').value;
  const errEl = document.getElementById('lockError');
  if (pass === DASH_PASSWORD) {
    document.getElementById('lockView').style.display = 'none';
    document.getElementById('dashView').style.display = 'block';
    loadSettings();
    subscribeToBookings();
  } else {
    errEl.textContent = '❌ كلمة المرور غير صحيحة';
    errEl.classList.add('show');
    document.getElementById('dashPass').value = '';
    document.getElementById('dashPass').focus();
  }
}

document.getElementById('dashPass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlockDashboard();
});

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

  // First do a one-time get to verify DB access
  db.ref('bookings').limitToFirst(1).once('value').then(snap => {
    const count = snap.numChildren();
    console.log('✅ RTDB connected. Total bookings:', count);
    if (count === 0) {
      document.getElementById('bookingsBody').innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد حجوزات بعد — قم بإنشاء حجز تجريبي أولاً من الصفحة الرئيسية</td></tr>';
    }
  }).catch(err => {
    console.error('RTDB get error:', err);
    document.getElementById('bookingsBody').innerHTML =
      `<tr><td colspan="8" style="text-align:center;padding:40px;">
        <div style="color:#b91c1c;font-size:0.9rem;margin-bottom:8px;">❌ خطأ في الاتصال بقاعدة البيانات</div>
        <div style="color:var(--text-muted);font-size:0.8rem;direction:ltr;word-break:break-all;">${escHtml(err.message)}</div>
        <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:12px;">
          تأكد من:<br>
          1. تفعيل Realtime Database في <a href="https://console.firebase.google.com/project/clinic-52f6e/database" target="_blank" style="color:var(--gold);">Firebase Console</a><br>
          2. تطبيق قواعد الأمان من <code>firebase/rules.realtimedb</code>
        </div>
      </td></tr>`;
  });

  bookingsUnsub = db.ref('bookings')
    .orderByChild('created_at')
    .limitToLast(100)
    .on('value', (snapshot) => {
      const data = snapshot.val();
      allBookings = [];

      if (data) {
        // Convert object to array, newest first (limitToLast gives ascending, we reverse)
        const entries = [];
        snapshot.forEach(child => {
          entries.push({ id: child.key, ...child.val() });
        });
        entries.reverse();
        allBookings = entries;
      }

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
  document.getElementById('statArrived').textContent = allBookings.filter(b => b.status === 'arrived').length;
  document.getElementById('statCancelled').textContent = allBookings.filter(b => b.status === 'cancelled').length;
}

var selectedIds = {};

function renderTable(bookings) {
  const tbody = document.getElementById('bookingsBody');

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد حجوزات</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const statusClass = `badge-${b.status}`;
    const statusText = { pending: 'قيد الانتظار', accepted: 'تم القبول', arrived: 'حضر', rejected: 'مرفوض', cancelled: 'ملغي' }[b.status] || b.status;
    const price = window.cachedPrices && window.cachedPrices[b.service] ? `${window.cachedPrices[b.service]} ر.س` : '-';
    const date = b.preferred_date ? new Date(b.preferred_date + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';

    var queueDisplay = b.status === 'accepted' && b.queue_position ? ' — #' + b.queue_position : '';
    var checked = selectedIds[b.id] ? 'checked' : '';

    return `<tr>
      <td style="text-align:center;"><input type="checkbox" class="booking-check" value="${b.id}" ${checked} onchange="toggleCheck('${b.id}', this.checked)"></td>
      <td style="white-space:nowrap;">
        <strong>#${b.booking_number}</strong>
        <button onclick="copyBookingNum('${b.booking_number}')" title="نسخ رقم الحجز" style="background:none;border:none;cursor:pointer;font-size:0.75rem;padding:2px 4px;margin-right:4px;opacity:0.5;transition:opacity 0.15s;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5">📋</button>
      </td>
      <td>${escHtml(b.patient_name)}</td>
      <td dir="ltr">${escHtml(b.phone)}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(b.service)}">
        ${escHtml(b.service)}
      </td>
      <td style="font-weight:600;color:var(--gold);">${price}</td>
      <td style="font-size:0.78rem;white-space:nowrap;">${date}</td>
      <td><span class="badge ${statusClass}">${statusText}${queueDisplay}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        ${b.status === 'accepted' ? `
          <button class="action-btn" style="background:#2563eb;color:white;" onclick="markArrived('${b.id}')">✓ حضر</button>
          <button class="action-btn" style="background:#d97706;color:white;" onclick="openChangeDate('${b.id}')">📅 تغيير</button>
          <button class="action-btn" style="background:#dc2626;color:white;" onclick="cancelBooking('${b.id}')">✕ إلغاء</button>
          <button class="action-btn" style="background:#6b7280;color:white;" onclick="deleteBooking('${b.id}')">🗑️ حذف</button>
        ` : ''}
        ${b.status === 'arrived' || b.status === 'rejected' || b.status === 'cancelled' ? `
          <button class="action-btn" style="background:#6b7280;color:white;" onclick="deleteBooking('${b.id}')">🗑️ حذف</button>
        ` : ''}
      </td>
    </tr>`;
  }).join('');
}

function toggleCheck(id, checked) {
  if (checked) selectedIds[id] = true;
  else delete selectedIds[id];
  updateBatchBar();
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.booking-check').forEach(function(cb) {
    cb.checked = checked;
    toggleCheck(cb.value, checked);
  });
}

function updateBatchBar() {
  var ids = Object.keys(selectedIds);
  var bar = document.getElementById('batchBar');
  var count = document.getElementById('selectedCount');
  if (ids.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  count.textContent = 'تم تحديد ' + ids.length + ' حجز';
  document.getElementById('selectAll').checked = document.querySelectorAll('.booking-check').length === ids.length;
}

function clearSelection() {
  selectedIds = {};
  document.querySelectorAll('.booking-check').forEach(function(cb) { cb.checked = false; });
  document.getElementById('selectAll').checked = false;
  updateBatchBar();
}

function copyBookingNum(num) {
  var text = String(num);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ تم نسخ رقم الحجز'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('✅ تم نسخ رقم الحجز'); } catch (e) { showToast('❌ فشل النسخ'); }
    document.body.removeChild(ta);
  }
}

async function markArrived(id) {
  try {
    // Get booking to find its date
    var snap = await db.ref('bookings/' + id).once('value');
    var booking = snap.val();
    if (!booking) { showToast('❌ الحجز غير موجود'); return; }
    var dateStr = booking.preferred_date;

    // Mark as arrived
    await db.ref('bookings/' + id).update({ status: 'arrived' });

    // Recalculate queue for remaining accepted bookings on same day
    var daySnap = await db.ref('bookings').orderByChild('preferred_date').equalTo(dateStr).once('value');
    var accepted = [];
    if (daySnap.exists()) {
      daySnap.forEach(function(child) {
        var v = child.val();
        if (v.status === 'accepted' && child.key !== id) {
          accepted.push({ id: child.key, queue: v.queue_position || 999 });
        }
      });
    }

    accepted.sort(function(a, b) { return a.queue - b.queue; });

    var updates = {};
    accepted.forEach(function(item, index) {
      updates['bookings/' + item.id + '/queue_position'] = index + 1;
    });

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    showToast('✅ تم تأكيد الحضور — تم تحديث الطابور');
  } catch (e) {
    console.error('markArrived error:', e);
    showToast('❌ خطأ في تأكيد الحضور');
  }
}

// ── Cancel ──
async function cancelBooking(id) {
  var reason = prompt('سبب الإلغاء:');
  if (reason === null) return;
  try {
    await db.ref('bookings/' + id).update({
      status: 'cancelled',
      rejection_reason: reason.trim() || 'ملغي بواسطة الإدارة',
    });
    showToast('✅ تم إلغاء الحجز');
  } catch (e) {
    showToast('❌ خطأ في إلغاء الحجز');
  }
}

// ── Change Date ──
var changeDateId = null;

function openChangeDate(id) {
  changeDateId = id;
  document.getElementById('changeDateBookingId').value = id;
  document.getElementById('changeDatePicker').value = '';
  document.getElementById('changeDateError').classList.remove('show');
  document.getElementById('changeDateModal').classList.add('active');
}

function closeChangeDateModal() {
  changeDateId = null;
  document.getElementById('changeDateModal').classList.remove('active');
}

document.getElementById('changeDateModal').addEventListener('click', function(e) {
  if (e.target === document.getElementById('changeDateModal')) closeChangeDateModal();
});

async function confirmChangeDate() {
  var newDate = document.getElementById('changeDatePicker').value;
  if (!newDate) { showToast('❌ اختر تاريخاً'); return; }
  var id = document.getElementById('changeDateBookingId').value;
  if (!id) return;

  try {
    var snap = await db.ref('bookings/' + id).once('value');
    var booking = snap.val();
    if (!booking) { showToast('❌ الحجز غير موجود'); return; }
    var oldDate = booking.preferred_date;

    var newDaySnap = await db.ref('bookings').orderByChild('preferred_date').equalTo(newDate).once('value');
    var newCount = 0;
    if (newDaySnap.exists()) {
      newDaySnap.forEach(function(child) {
        var v = child.val();
        if (v.status === 'accepted' || v.status === 'arrived') newCount++;
      });
    }

    await db.ref('bookings/' + id).update({
      preferred_date: newDate,
      queue_position: newCount + 1,
    });

    if (oldDate !== newDate) {
      var oldDaySnap = await db.ref('bookings').orderByChild('preferred_date').equalTo(oldDate).once('value');
      var accepted = [];
      if (oldDaySnap.exists()) {
        oldDaySnap.forEach(function(child) {
          var v = child.val();
          if (v.status === 'accepted' && child.key !== id) {
            accepted.push({ id: child.key, queue: v.queue_position || 999 });
          }
        });
      }
      accepted.sort(function(a, b) { return a.queue - b.queue; });
      var updates = {};
      accepted.forEach(function(item, index) {
        updates['bookings/' + item.id + '/queue_position'] = index + 1;
      });
      if (Object.keys(updates).length > 0) await db.ref().update(updates);
    }

    showToast('✅ تم تغيير الموعد إلى ' + newDate);
    closeChangeDateModal();
  } catch (e) {
    console.error('changeDate error:', e);
    showToast('❌ خطأ في تغيير الموعد');
  }
}

// ── Hard Delete ──
async function deleteBooking(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الحجز نهائياً؟')) return;
  try {
    var snap = await db.ref('bookings/' + id).once('value');
    var booking = snap.val();
    var dateStr = booking ? booking.preferred_date : null;

    await db.ref('bookings/' + id).remove();

    if (dateStr) {
      var daySnap = await db.ref('bookings').orderByChild('preferred_date').equalTo(dateStr).once('value');
      var accepted = [];
      if (daySnap.exists()) {
        daySnap.forEach(function(child) {
          var v = child.val();
          if (v.status === 'accepted') {
            accepted.push({ id: child.key, queue: v.queue_position || 999 });
          }
        });
      }
      accepted.sort(function(a, b) { return a.queue - b.queue; });
      var updates = {};
      accepted.forEach(function(item, index) {
        updates['bookings/' + item.id + '/queue_position'] = index + 1;
      });
      if (Object.keys(updates).length > 0) await db.ref().update(updates);
    }

    showToast('✅ تم حذف الحجز');
  } catch (e) {
    console.error('deleteBooking error:', e);
    showToast('❌ خطأ في حذف الحجز');
  }
}

async function deleteSelected() {
  var ids = Object.keys(selectedIds);
  if (ids.length === 0) return;
  if (!confirm('هل أنت متأكد من حذف ' + ids.length + ' حجز نهائياً؟')) return;

  try {
    var updates = {};
    ids.forEach(function(id) { updates['bookings/' + id] = null; });
    await db.ref().update(updates);
    clearSelection();
    showToast('✅ تم حذف ' + ids.length + ' حجز');
  } catch (e) {
    console.error('deleteSelected error:', e);
    showToast('❌ خطأ في حذف الحجوزات');
  }
}

function toMinutes(str) {
  var parts = str.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
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
    await db.ref('bookings/' + rejectBookingId).update({
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
    const snap = await db.ref('settings/settings').once('value');
    if (!snap.exists()) {
      await db.ref('settings/settings').set({
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
    const s = snap.val();
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
    await db.ref('settings/settings').update({
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

console.log('✅ Dr. Ruhm Badr Dashboard (RTDB) loaded');

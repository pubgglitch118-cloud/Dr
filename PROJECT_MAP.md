# PROJECT MAP — Dr. Ruhm Badr Booking System (v3)

## [TECH_STACK]

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | HTML5 + CSS3 + Vanilla JS | No build tools, zero config |
| Styling | Custom CSS with CSS variables | Premium Apple-inspired design |
| Design Theme | Coffee-white + Warm Gold Neon | Harmonious gold glow (#C9A84C) |
| Animations | CSS @keyframes | Gold pulse, fade-up, scale-in, float |
| Backend / DB | Firebase Firestore | NoSQL, real-time listeners |
| Auth | Firebase Authentication | Email/Password for dashboard |
| Realtime | Firestore `onSnapshot` | Live bookings + chat sync |
| Hosting | Netlify / Vercel / any static host | Drag & drop deploy |
| Fonts | Google Fonts — Cairo | Professional Arabic typography |
| Icons | Unicode / Emoji | No icon library dependency |

## [COLOR PALETTE]

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | #F5F0EB | Page background |
| `--surface` | #FFFFFF | Card backgrounds |
| `--border` | #E8E0D6 | Subtle borders |
| `--text-primary` | #2C1810 | Main text (deep warm brown) |
| `--text-secondary` | #6B5A4E | Secondary text |
| `--text-muted` | #A89888 | Muted / placeholder text |
| `--gold` | #C9A84C | Primary accent — warm gold |
| `--gold-light` | #E8D5A3 | Light gold gradient |
| `--gold-dark` | #A88930 | Dark gold hover |
| `--gold-glow` | rgba(201,168,76,0.25) | Neon glow shadow |

Neon is **warm gold** — harmonious with coffee/cream palette, not harsh green/blue.

## [SYSTEM_FLOW]

```
المريض                                      الدكتورة
   |                                           |
   |-- يزور index.html ----------------------->|
   |-- يختار خدمة من 6 بطاقات احترافية          |
   |   (تبيض - تنظيف - فينير - حشوات -          |
   |    كشف - خدمة أخرى نص حر)                  |
   |-- يملأ الاسم + الهاتف                      |
   |-- يضغط "احجز موعدك الآن"                   |
   |                                            |
   |<-- يظهر رقم الحجب (#1042) مع أنيميشن -----|
   |-- يمكنه متابعة الحالة عبر status.html       |
   |-- يمكنه الدردشة المباشرة مع العيادة         |
   |                                            |
   |                     Firestore onSnapshot
   |                     🔔 إشعار فوري للداشبورد
   |                                            |
   |                         لوحة التحكم (dashboard/)
   |                           |-- تسجيل دخول (Firebase Auth)
   |                           |-- طاولة حجوزات مباشرة
   |                           |-- قبول ✅ / رفض ❌ (مع سبب)
   |                           |-- إعدادات (أيام/ساعات/حد أقصى)
   |                           |-- بحث (اسم/رقم/هاتف)
   |                           |-- دردشة مباشرة مع المريض
   |                                           |
   |<-- تحديث الحالة عبر Firestore -------------|
```

## [ARCHITECTURE]

```
┌───────────────────────┐   ┌──────────────────────────┐
│  الموقع العام          │   │  لوحة التحكم              │
│  (مجلد الجذر)          │   │  (dashboard/)             │
│                        │   │                           │
│  index.html            │   │  index.html               │
│  status.html           │   │  dashboard.js             │
│  app.js                │   │                           │
│  style.css             │   │                           │
└───────────┬───────────┘   └─────────────┬─────────────┘
            │                             │
            └──────────────┬──────────────┘
                           │
                  ┌────────▼────────┐
                  │    Firebase     │
                  │  ┌──────────┐   │
                  │  │ Firestore │   │
                  │  │ bookings  │   │
                  │  │ settings  │   │
                  │  │ chats     │   │
                  │  │ counters  │   │
                  │  └──────────┘   │
                  │  Auth (Email)   │
                  └─────────────────┘
```

## [DATABASE SCHEMA]

### Firestore Collections:

**bookings/`{autoId}`**
- `booking_number` (number) — auto-increment from 1001
- `patient_name` (string)
- `phone` (string)
- `service` (string) — selected card OR custom text
- `preferred_date` (string) — YYYY-MM-DD
- `status` (string) — "pending" | "accepted" | "rejected"
- `rejection_reason` (string | null)
- `created_at` (Timestamp)

**settings/`settings`** (single doc)
- `work_days` (array) — ["Sat","Sun","Mon","Tue","Wed"]
- `work_start` (string) — "09:00:00"
- `work_end` (string) — "17:00:00"
- `max_patients_per_day` (number)
- `slot_duration_minutes` (number)

**chat_messages/`{autoId}`**
- `booking_id` (string) — references booking doc
- `sender` (string) — "patient" | "doctor"
- `message` (string)
- `created_at` (Timestamp)

**counters/`booking_counter`**
- `current` (number) — auto-increment sequence

## [DESIGN SYSTEM]

- **Apple-like nav bar**: fixed top, frosted glass blur, underline hover
- **Service cards**: 6-card grid, gold top-border on hover, checkmark, icon
- **Neon glow**: warm gold (`box-shadow: 0 0 8px var(--gold-glow)`) — not electric green
- **Glass cards**: `backdrop-filter: blur(20px)` with subtle border
- **Typography**: Cairo font, 800 weight headings, comfortable line-height
- **Animations**: fade-up for scroll, scale-in for success, gold-pulse for CTA
- **Spacing**: generous whitespace, 48px section margins, 40px card padding

## [FEATURES STATUS]

| Feature | Status | File(s) |
|---------|--------|---------|
| 6 service cards (selectable) | ✅ Done | `index.html`, `app.js` |
| Custom service text option | ✅ Done | `index.html` (خدمة أخرى) |
| Booking form (name + phone) | ✅ Done | `index.html`, `app.js` |
| Booking number auto-increment | ✅ Done | `app.js` (Firestore transaction) |
| Work day validation | ✅ Done | `app.js` (createBooking) |
| Max patients per day check | ✅ Done | `app.js` |
| Success view with booking number | ✅ Done | `index.html`, `app.js` |
| Status lookup page | ✅ Done | `status.html`, `app.js` |
| Real-time dashboard (onSnapshot) | ✅ Done | `dashboard/dashboard.js` |
| Accept / Reject with reason modal | ✅ Done | `dashboard/dashboard.js` |
| Settings (days, hours, max) | ✅ Done | `dashboard/index.html` |
| Dashboard search | ✅ Done | `dashboard/dashboard.js` |
| Live Chat (patient ↔ doctor) | ✅ Done | `app.js` + `dashboard/dashboard.js` |
| Warm gold neon theme | ✅ Done | `style.css` (gold-pulse, gold-glow) |
| Apple-inspired navigation | ✅ Done | `style.css` (.nav-bar) |
| Dashboard login (Firebase Auth) | ✅ Done | `dashboard/dashboard.js` |
| Firestore security rules | ✅ Done | `firebase/rules.firestore` |
| Setup documentation | ✅ Done | `setup.html` |

## [ORPHANS & PENDING]

| Item | Priority | Action Required |
|------|----------|-----------------|
| Create Firebase project | HIGH | User creates in Firebase Console |
| Enable Firestore Database | HIGH | Firebase Console > Firestore |
| Enable Email/Password auth | HIGH | Firebase Console > Authentication |
| Update firebase/config.js | HIGH | Replace placeholder values |
| Create doctor user | HIGH | Firebase Console > Authentication > Users |
| Apply Firestore rules | HIGH | Copy rules.firestore into console |
| Deploy to Netlify | MEDIUM | Drag & drop entire folder |
| Custom domain | LOW | Optional |

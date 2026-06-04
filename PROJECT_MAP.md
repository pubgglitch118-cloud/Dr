# PROJECT MAP — Dr. Ruhm Badr Booking System (v3)

## [TECH_STACK]

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | HTML5 + CSS3 + Vanilla JS | No build tools, zero config |
| Styling | Custom CSS with CSS variables | Premium Apple-inspired design |
| Design Theme | Coffee-white + Warm Gold Neon | Harmonious gold glow (#C9A84C) |
| Animations | CSS @keyframes | Gold pulse, fade-up, scale-in, float |
| Backend / DB | Firebase Realtime Database | NoSQL JSON tree, real-time listeners |
| Auth | Hardcoded password `1357910` | Dashboard only, no Firebase Auth |
| Realtime | RTDB `.on('value')` | Live bookings sync |
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
    |-- يختار خدمة من 5 بطاقات (تبيض - تنظيف -   |
    |   فينير - حشوات - كشف)                     |
    |-- يملأ الاسم + الهاتف                      |
    |-- يضغط "احجز موعدك الآن"                   |
    |                                            |
    |<-- يظهر رقم الحجز (#...) مع أنيميشن -------|
    |-- يمكنه متابعة الحالة عبر status.html       |
    |                                            |
    |                     RTDB on('value')
    |                     🔔 إشعار فوري للداشبورد
    |                                            |
    |                         لوحة التحكم (dashboard/)
    |                           |-- إدخال كلمة المرور (1357910)
    |                           |-- طاولة حجوزات مباشرة
    |                           |-- قبول ✅ / رفض ❌ (مع سبب)
    |                           |-- إعدادات (أيام/ساعات/أسعار)
    |                           |-- بحث (اسم/رقم/هاتف)
    |                                           |
    |<-- تحديث الحالة عبر RTDB -----------------|
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
                  │  │ RT Database│  │
                  │  │ bookings  │   │
                  │  │ settings  │   │
                  │  └──────────┘   │
                  │  (no auth)      │
                  └─────────────────┘
```

## [DATABASE SCHEMA]

### Realtime Database Paths:

**`/bookings/{pushId}`**
- `booking_number` (number) — timestamp-based (YYMMDDHHMM + rand)
- `patient_name` (string)
- `phone` (string)
- `service` (string) — selected from 5 cards
- `preferred_date` (string) — YYYY-MM-DD
- `status` (string) — "pending" | "accepted" | "rejected"
- `rejection_reason` (string | null)
- `created_at` (number) — server timestamp (milliseconds)

**`/settings/settings`** (single path)
- `work_days` (array) — ["Sat","Sun","Mon","Tue","Wed"]
- `work_start` (string) — "09:00:00"
- `work_end` (string) — "17:00:00"
- `max_patients_per_day` (number)
- `slot_duration_minutes` (number)
- `service_prices` (object) — service name → price

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
| 5 service cards (selectable) | ✅ Done | `index.html`, `app.js` |
| Booking form (name + phone) | ✅ Done | `index.html`, `app.js` |
| Timestamp-based booking number | ✅ Done | `app.js` (YYMMDDHHMM + rand) |
| Work day validation | ✅ Done | `app.js` (createBooking) |
| Max patients per day check | ✅ Done | `app.js` |
| Success view with booking number | ✅ Done | `index.html`, `app.js` |
| Status lookup page | ✅ Done | `status.html`, `app.js` |
| Real-time dashboard (RTDB on('value')) | ✅ Done | `dashboard/dashboard.js` |
| Accept / Reject with reason modal | ✅ Done | `dashboard/dashboard.js` |
| Settings (days, hours, prices) | ✅ Done | `dashboard/index.html` |
| Dashboard search | ✅ Done | `dashboard/dashboard.js` |
| Dashboard password gate (1357910) | ✅ Done | `dashboard/dashboard.js` |
| Warm gold neon theme | ✅ Done | `style.css` (gold-pulse, gold-glow) |
| Apple-inspired navigation | ✅ Done | `style.css` (.nav-bar) |
| Realtime Database security rules | ✅ Done | `firebase/rules.realtimedb` |
| Setup documentation | ✅ Done | `setup.html` |
| Phone badge (01007610339) | ✅ Done | Header + footer |
| Copy booking number button | ✅ Done | `app.js` (clipboard API) |
| Offline persistence | ✅ Done | `firebase/config.js` |

## [ORPHANS & PENDING]

| Item | Priority | Action Required |
|------|----------|-----------------|
| Enable Realtime Database | HIGH | Firebase Console > Realtime Database > Create Database |
| Apply RTDB rules | HIGH | Copy `firebase/rules.realtimedb` into console |
| Deploy to Netlify | MEDIUM | Drag & drop entire folder |
| Custom domain | LOW | Optional |

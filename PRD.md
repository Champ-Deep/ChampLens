# Product Requirements Document
## QR-to-Video Intelligence Platform
### Champions Group — Immersive AR Business Card Experience

**Version:** 1.0
**Date:** 2026-05-14
**Design Reference:** ragerstudios.com

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Core User Flow](#4-core-user-flow)
5. [Feature Breakdown](#5-feature-breakdown)
6. [AR Implementation](#6-ar-implementation)
7. [Backend API](#7-backend-api)
8. [Data Storage — MongoDB](#8-data-storage--mongodb)
9. [Processing Pipeline](#9-processing-pipeline)
10. [AI Integration](#10-ai-integration)
11. [Tech Stack](#11-tech-stack)
12. [Design System](#12-design-system)
13. [MVP Scope](#13-mvp-scope)
14. [Security](#14-security)
15. [Success Metrics](#15-success-metrics)
16. [Open Questions](#16-open-questions)

---

## 1. Product Overview

A web platform where individuals and businesses upload a short intro video and their personal or brand details. The platform generates a **unique, print-ready QR code** — branded with the Champions Group logo — tied to that video.

When anyone scans the QR code with a phone camera, the browser opens instantly. The camera stays active. The creator's video **plays directly on top of the printed QR code in augmented reality** — tracking the QR's position, tilt, and rotation in real time so the video appears to live inside the card.

**The same QR is both the scan trigger (URL) and the AR tracking marker (image target).** No app download. No separate card image needed. Just print and hand out.

**The experience in one sentence:** A recruiter scans a QR on a business card, and the cardholder's face appears — playing a video intro right on the card, following every movement of the card as if the video is printed on it.

---

## 2. Problem Statement

Business cards are static and forgettable. Existing digital alternatives (LinkedIn QR, HiHello, Blinq) just open a profile page — they don't create a memorable moment. There is no product today that delivers a cinematic, AR-anchored video experience directly from a physical card, in the browser, with zero friction for the recipient.

This platform fills that gap for professionals, creators, and brands who want to make a lasting impression at the moment of the handshake.

---

## 3. Target Users

| User Type | Primary Use Case |
|---|---|
| Professionals / Executives | Personal intro video that plays when card is scanned |
| Real Estate Agents | Property walkthrough or agent intro on card |
| Creators / Influencers | Showreel or personality video on card |
| Brands / Startups | Product demo or brand story on card |
| Event Speakers | Talk teaser or bio video on badge/lanyard |
| Sales Teams | Pitch video attached to leave-behind material |

---

## 4. Core User Flow

```
CREATOR SIDE
────────────
1. Signs up / logs in on the web platform
2. Fills in details: Name, Title, Company, Website, Social links
3. Uploads intro video (MP4/MOV/WebM, ≤60s, ≤200MB)
4. Platform processes in background:
     → Transcodes video (H.264, 720p, web-optimised)
     → Generates unique QR (Champions Group logo centered)
     → Compiles QR image into MindAR .mind tracking target
     → Assembles print-ready ZIP package
5. Creator downloads print-ready ZIP
6. Prints QR on business card / sticker sheet / flyer

RECIPIENT SIDE
──────────────
7. Receives physical card with QR printed on it
8. Opens native camera app → points at QR → taps notification to open link
9. Browser opens at https://app.domain.com/v/{slug}
10. Page requests camera permission → camera stays on
11. Creator's video loads and plays OVER the QR in AR
12. Recipient moves / tilts / rotates card → video follows perfectly
13. Tap to toggle sound · tap outside to dismiss
```

---

## 5. Feature Breakdown

### 5.1 Creator Dashboard (React Web App)

#### Authentication
- Email + password sign-up / login
- Google OAuth (Phase 2)
- JWT stored in httpOnly cookie
- Password reset via email link

#### Profile & Video Upload
- Profile form: Name, Job Title, Company, Website URL, LinkedIn, Instagram, Twitter
- Video upload via drag-and-drop or file picker
  - Accepted formats: MP4, MOV, WebM
  - Max duration: 60 seconds
  - Max file size: 200 MB
  - Client-side validation before upload
- Upload progress bar with real-time percentage
- Processing status indicator: `Uploading → Transcoding → Generating QR → Compiling AR Target → Ready`

#### QR Generation & Print-Ready Package
- QR auto-generated on video upload — no manual step
- QR encodes the unique viewer URL: `https://app.domain.com/v/{slug}`
- QR spec:
  - Size: 1000×1000px internal canvas
  - Error correction: **Level H (30%)** — survives damage and accommodates center logo
  - Colors: black modules on white background
  - Center logo: **Champions Group logo** composited at ~15% of QR area (asset provided by client)
- The exact generated QR PNG (with logo) is saved as the permanent AR marker — never changes after compile
- **Print-Ready ZIP download contains:**
  - `qr-300dpi.png` — 1000×1000px PNG, 300 DPI metadata embedded, print-shop ready
  - `qr-vector.svg` — pure SVG with embedded logo, infinitely scalable
  - `qr-card-mockup.png` — rendered preview of QR placed on a standard 3.5×2" business card
  - `qr-sticker-sheet.pdf` — A4/Letter PDF, 20× QR stickers at 1×1" each, ready to print and stick on existing cards
  - `README.txt` — print instructions: minimum print size 0.8×0.8", preserve white quiet zone, do not stretch or distort
- QR regeneration available (invalidates old slug + old `.mind` file, generates a completely fresh set)

#### Dashboard Home
- Grid of all created cards showing: thumbnail, name, status badge, scan count, date created
- Paginated (10 per page)
- Click card → detail view with analytics, QR download, edit, delete
- "Create New Card" CTA always visible

#### Analytics per Card
- Total scan count (all time)
- Unique scans (by hashed IP)
- Scans over time (last 7 / 30 / 90 days line chart)
- Device breakdown: Mobile / Tablet / Desktop (pie chart)
- Country breakdown (top 5 countries)

#### Card Management
- Edit: update Name, Title, Company, Website, Social links (does not regenerate QR)
- Replace video: upload new video — retranscodes but keeps same QR and slug
- Delete card: removes video from storage, deactivates QR (viewer shows "this card is no longer active")
- Shareable non-AR preview link: `https://app.domain.com/preview/{slug}` — shows video in standard player for desktop sharing

---

### 5.2 AR Video Viewer — The Core Experience

The page that opens when the QR is scanned. Runs entirely in the mobile browser. **Zero app install.**

#### Page Load Sequence
1. URL `https://app.domain.com/v/{slug}` opens in browser
2. API call: fetch card metadata (video URL, `.mind` target URL, owner details)
3. Show loading screen with creator's name and thumbnail while assets download
4. Camera permission prompt displayed with clear explanation ("Point your camera at the QR code to watch the video")
5. On permission granted:
   - Rear camera activated via `getUserMedia({ video: { facingMode: 'environment' } })`
   - Camera feed rendered as full-screen background `<video>` element
   - MindAR initialised with the card's `.mind` target file
6. "Point camera at the QR code on the card" instruction overlay shown
7. When QR detected: instruction overlay fades, video begins playing over QR

#### AR Video Overlay Behaviour
- Video plane rendered at the exact dimensions of the detected QR
- Perspective-correct 3D transform (`matrix3d`) updated every frame from MindAR pose matrix
- Video covers the QR completely — QR is not visible during playback
- Video plays looped, **muted by default** (browser autoplay policy requires this)
- Subtle glow/shadow on video plane edges for depth realism
- Tap anywhere on the video → toggle sound on/off (icon indicator)
- Tap outside the video / swipe down → dismiss AR, return to camera-only view
- Video loops until dismissed or page closed

#### UI Overlays (minimal, non-intrusive)
- Bottom-left: creator's name + title (small text, fades after 3s)
- Bottom-right: sound icon (muted/unmuted state)
- Top-right: close (×) button
- All overlays semi-transparent, disappear on full-screen tap

#### Fallback States
| Condition | Behaviour |
|---|---|
| Camera permission denied | Show video in standard player with message: "Enable camera access to see the AR experience" |
| Browser does not support WebRTC | Show video in standard player |
| Card not found / inactive | Show "This card is no longer active" screen |
| QR not detected after 10s | Show "Having trouble? Make sure the QR is well-lit and fully visible" hint |
| Video fails to load | Show error with retry button |

#### Browser Support
- Chrome Android 88+
- Safari iOS 14.3+
- Samsung Internet 14+
- Firefox Android (standard player fallback only — no WebRTC getUserMedia in FF)

---

## 6. AR Implementation

### Core Concept

The platform-generated QR code is both the **URL trigger** (native camera scans it and opens the browser) and the **AR image marker** (MindAR tracks its position in 3D space). This means no separate card image upload is ever needed from the creator.

### Why QR Codes Are Ideal AR Markers

- **High contrast:** Black modules on white background — optimal for computer vision feature extraction
- **Dense feature points:** A typical QR code yields 400–600 ORB keypoints — far more than most natural images
- **Uniqueness:** No two QR codes encode the same data, so each card's marker is globally unique — zero false-positive tracking matches
- **Print determinism:** The PNG saved server-side is bit-for-bit identical to what gets printed — the compiled marker matches the physical card perfectly

### Tracking Library: `mind-ar.js` (Image Tracking Mode)

MindAR uses a FAST + BRIEF feature detector compiled to WebAssembly, running at 30fps in the browser. It outputs a 4×4 homogeneous transformation matrix per frame representing the detected image's position and orientation relative to the camera.

**Tracking pipeline:**
```
Camera frame (30fps)
    → FAST corner detection on grayscale
    → BRIEF descriptor extraction
    → BF-matcher against compiled .mind descriptors
    → Homography estimation (RANSAC)
    → Pose matrix (4×4) output
    → CSS matrix3d() applied to video plane <div>
```

**Fallback: `jsQR`**
Used only during initial detection (before MindAR locks on). `jsQR` decodes the QR's four corner points and computes a rough homography for an immediate approximate overlay, which MindAR then takes over and stabilises.

### Server-Side Marker Compilation

When a card is created, the backend runs:
```bash
# MindAR CLI compiler (Node.js child_process)
mindar-image-compiler --input qr-1000px.png --output qr.mind
```

The `.mind` file (~50–200KB) contains the pre-computed feature descriptors. It is stored alongside the video and served to the AR viewer on demand. Compilation takes 5–15 seconds and runs in a BullMQ background job.

### Video Plane Geometry

The video overlay `<div>` is:
- **Width/height:** 1:1 (square, matching QR aspect ratio)
- **Position:** Centred on the detected QR anchor point
- **Transform:** `transform: matrix3d(m00, m01, ..., m33)` — updated every animation frame
- **z-index:** Above camera feed, below UI overlays
- The video `<video>` element fills the div 100%×100% with `object-fit: cover`

### Edge Cases & Handling

| Scenario | Handling |
|---|---|
| Low light | MindAR confidence score drops → show "improve lighting" hint after 3s of no lock |
| Fast motion blur | MindAR's Kalman filter interpolates between frames — acceptable up to ~60°/s rotation |
| QR partially occluded | Level H error correction keeps QR scannable; MindAR tracks remaining visible features |
| Multiple QR codes in frame | Track only the first locked target — ignore subsequent detections |
| Portrait vs landscape phone | Video plane inherits device orientation via screen.orientation API |
| Tracking lost mid-playback | Video pauses and freezes in last known position; resumes when QR re-detected |

### Performance Targets

| Metric | Target |
|---|---|
| AR tracking frame rate | ≥ 25 fps on iPhone 12+ and mid-range Android (Snapdragon 778+) |
| Time from QR scan to video playing | < 3 seconds on 4G |
| MindAR `.mind` file size | < 200 KB |
| Total viewer page JS bundle | < 1.5 MB gzipped |
| Video buffering start | < 1 second (H.264 faststart, 720p) |

---

## 7. Backend API

**Runtime:** Node.js 20 | **Framework:** Fastify

### Endpoints

```
AUTH
────
POST   /api/auth/register          — create account
POST   /api/auth/login             — returns JWT in httpOnly cookie
POST   /api/auth/logout            — clears cookie
GET    /api/auth/me                — returns current user profile

CARDS
─────
POST   /api/cards                  — create card + upload video (multipart)
GET    /api/cards                  — list authenticated user's cards (paginated)
GET    /api/cards/:slug            — public fetch for AR viewer (no auth)
PATCH  /api/cards/:id              — update card profile fields
DELETE /api/cards/:id              — delete card + all associated files

QR & PRINT
──────────
GET    /api/cards/:id/qr           — download QR PNG (300 DPI, with logo)
GET    /api/cards/:id/qr/svg       — download QR SVG (with logo)
GET    /api/cards/:id/qr/print-pack — download full print-ready ZIP

ANALYTICS
─────────
POST   /api/analytics/scan         — log a scan event (called by viewer on load)
GET    /api/analytics/:cardId      — get analytics for a card (auth required)
```

### Request / Response Contracts

#### `POST /api/cards` (multipart/form-data)
```
Fields:
  ownerName     string  required
  ownerTitle    string  required
  company       string  optional
  website       string  optional
  linkedin      string  optional
  instagram     string  optional
  twitter       string  optional
  video         file    required (MP4/MOV/WebM, max 200MB)

Response 202:
  { cardId, slug, status: "processing" }
```

#### `GET /api/cards/:slug` (public)
```
Response 200:
  {
    slug, ownerName, ownerTitle, company,
    videoUrl, thumbnailUrl, targetFileUrl,
    status, isActive
  }
```

#### `POST /api/analytics/scan`
```
Body: { slug }
Headers: User-Agent (auto)
Server extracts: IP (hashed), device type, country via MaxMind GeoLite2
Response 204: no content
```

---

## 8. Data Storage — MongoDB

### `users` Collection
```json
{
  "_id":          "ObjectId",
  "email":        "string — unique, indexed",
  "passwordHash": "string — bcrypt",
  "name":         "string",
  "plan":         "free | pro | business",
  "createdAt":    "Date",
  "updatedAt":    "Date"
}
```

### `cards` Collection
```json
{
  "_id":          "ObjectId",
  "userId":       "ObjectId — ref users, indexed",
  "slug":         "string — unique, 8-char nanoid, indexed",

  "ownerName":    "string",
  "ownerTitle":   "string",
  "company":      "string",
  "website":      "string",
  "socialLinks": {
    "linkedin":   "string",
    "instagram":  "string",
    "twitter":    "string"
  },

  "videoStorageId": "ObjectId (GridFS fileId) or string (R2 key)",
  "videoUrl":       "string — public URL for browser playback",
  "thumbnailUrl":   "string — frame 0 JPEG",

  "qrImageUrl":     "string — the exact PNG used as AR marker (permanent once compiled)",
  "targetFileUrl":  "string — MindAR .mind file URL",
  "printPackUrl":   "string — ZIP download URL",

  "status":     "processing | ready | error",
  "errorMsg":   "string — null unless status=error",
  "isActive":   "boolean — false = QR deactivated",

  "createdAt":  "Date",
  "updatedAt":  "Date"
}
```

### `scans` Collection
```json
{
  "_id":        "ObjectId",
  "cardId":     "ObjectId — ref cards, indexed",
  "slug":       "string — denormalised for fast lookup",
  "timestamp":  "Date — indexed",
  "userAgent":  "string",
  "deviceType": "mobile | tablet | desktop",
  "country":    "string — ISO 3166-1 alpha-2",
  "city":       "string",
  "ipHash":     "string — SHA-256 of IP for privacy-safe uniqueness"
}
```

### Video Storage Strategy

| Option | Description | When to use |
|---|---|---|
| **MongoDB GridFS** | Video chunks stored in MongoDB as binary GridFS documents. Zero extra infra. | MVP — simple, no additional services |
| **Cloudflare R2** | Object storage + CDN edge delivery. Fast globally, low egress cost. | Production, when storage > 5 GB or global users |

**Decision:** Start with GridFS for MVP. Migrate to R2 when storage exceeds 5 GB. The `videoUrl` field is a CDN URL in both cases — the viewer never changes.

---

## 9. Processing Pipeline

Every card creation triggers a BullMQ job queue sequence. All steps run server-side in background workers.

```
STEP 1 — Video Storage
  Raw upload saved to GridFS (or R2 staging)

STEP 2 — FFmpeg Transcode
  Input:  original file (any format)
  Output: H.264 MP4, 720p max, CRF 23, AAC audio, -movflags faststart
  Also:   extract JPEG thumbnail at t=0s and t=2s → save to storage

STEP 3 — QR Generation
  Library: `qrcode` npm (Node Canvas backend)
  Size:    1000×1000px
  EC:      Level H
  Style:   Black modules, white background
  Logo:    Champions Group PNG composited at centre (15% of canvas)
           — logo is resized to 150×150px, placed at (425, 425)
           — white square padding behind logo to prevent module collision
  Output:  PNG + SVG → saved to storage → card.qrImageUrl set

STEP 4 — Print Package Assembly
  Generate card mockup PNG (QR placed on 3.5×2" card template at 300 DPI)
  Generate sticker sheet PDF (20× QR at 1×1" on A4 via PDFKit)
  Write README.txt
  Bundle all into ZIP → card.printPackUrl set

STEP 5 — MindAR Target Compilation
  Input:  qrImageUrl PNG
  Output: .mind binary file (~50–200 KB)
  Method: mindar-image-compiler (Node child_process, ~5–15s)
  Result: card.targetFileUrl set

STEP 6 — Status Update
  card.status = "ready"
  Emit WebSocket event to dashboard: { type: "card:ready", cardId }
  Creator sees real-time status change in dashboard
```

**Error handling:** If any step fails, `card.status = "error"` and `card.errorMsg` is set. Dashboard shows a retry button that re-queues the failed step.

---

## 10. AI Integration

AI features are **Phase 2** (post-MVP) but the architecture is defined now so the pipeline can accommodate them without refactoring.

### Use Cases

| Feature | Trigger | Model | Purpose |
|---|---|---|---|
| Video analysis | After transcode completes | Gemini 1.5 Pro Vision via OpenRouter | Watch the uploaded video, auto-fill `ownerName`, `ownerTitle`, `company`, generate a 2-sentence bio |
| Script coach | Pre-upload screen | Claude Haiku via Anthropic API | "Tell us your role and we'll suggest what to say in your 30-second intro" |

### Why Gemini 1.5 Pro Vision

- Only model with native video file understanding (not just frames)
- Can process up to 1 hour of video in a single API call
- Via OpenRouter: no direct Google API key management needed
- OpenRouter model ID: `google/gemini-pro-1.5`

### OpenRouter Integration (server-side only)

```javascript
// Called after Step 2 (transcode) completes, video URL is public
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'google/gemini-pro-1.5',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Watch this video introduction. Extract and return JSON:
                 { "name": "", "title": "", "company": "", "bio": "" }
                 Bio should be 1–2 sentences, professional tone.`
        },
        {
          type: 'video_url',
          video_url: { url: card.videoUrl }
        }
      ]
    }]
  })
})
```

**Security:** `OPENROUTER_API_KEY` is server-side only. Never sent to the frontend. Never logged.

---

## 11. Tech Stack

### Frontend

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + Vite | Fast HMR, modern build |
| Routing | React Router v6 | Standard, file-based optional |
| Global state | Zustand | Lightweight, no boilerplate |
| UI components | Tailwind CSS + shadcn/ui | Matches dark aesthetic, accessible |
| Animations | Framer Motion | Smooth transitions, no spring physics |
| AR | mind-ar.js (Image Tracking) | Best browser-native marker tracking |
| QR preview | `qrcode` npm | Client-side live preview before upload confirms |
| Video player | Native HTML5 `<video>` | No overhead, full autoplay control |
| Upload UX | React Dropzone | Drag-and-drop + file picker |
| HTTP client | Axios | Interceptors for JWT refresh |
| Real-time | Socket.io client | Processing status updates from backend |

### Backend

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Ecosystem, stability |
| Framework | Fastify 4 | ~2× faster than Express, native async |
| ODM | Mongoose 8 | Schema validation, GridFS support |
| Video processing | fluent-ffmpeg + ffmpeg-static | Transcode, thumbnail, no system FFmpeg dep |
| Job queue | BullMQ + Redis | Reliable async pipeline, retries, priority |
| QR generation | `qrcode` + `canvas` | Server-side PNG + SVG generation |
| PDF generation | PDFKit | Sticker sheet PDF |
| Image compositing | `sharp` | Logo overlay onto QR PNG, fast |
| MindAR compilation | `mind-ar` CLI (child_process) | Official compiler |
| ZIP assembly | `archiver` | Stream ZIP to storage |
| Auth | bcrypt + jsonwebtoken | Standard, well-audited |
| File upload | `@fastify/multipart` | Streaming, memory-safe |
| WebSocket | `@fastify/websocket` | Processing status push |
| Geo IP | `maxmind` + GeoLite2 | Country/city from IP, local lookup (no API call) |

### Infrastructure

| Layer | Service | Notes |
|---|---|---|
| Database | MongoDB Atlas M0 → M10 | Free tier for MVP |
| Video/file storage | MongoDB GridFS (MVP) → Cloudflare R2 | Migrate at 5 GB |
| Frontend hosting | Vercel | Auto-deploy from git, edge CDN |
| Backend hosting | Railway | Easy Node.js deploy, persistent workers |
| Redis | Upstash | Serverless Redis, BullMQ compatible |
| CDN | Cloudflare | Automatic with R2; manual proxy for GridFS |
| Email (auth) | Resend | Password reset emails |

---

## 12. Design System

Inspired by Rager Studios' visual identity — dark, cinematic, high-contrast.

### Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#000000` | Page backgrounds |
| `color-bg-surface` | `#0a0a0a` | App shell, full-bleed sections |
| `color-bg-panel` | `#111111` | Cards, modals, panels |
| `color-border` | `#222222` | Panel borders, dividers |
| `color-accent` | `#E8003D` | CTAs, active states, highlights |
| `color-accent-dim` | `rgba(232,0,61,0.15)` | Glow effects |
| `color-text-primary` | `#FFFFFF` | Headings, body |
| `color-text-secondary` | `#A0A0A0` | Labels, captions, placeholders |
| `color-text-disabled` | `#444444` | Disabled inputs |
| `color-success` | `#22C55E` | Status: ready |
| `color-warning` | `#F59E0B` | Status: processing |
| `color-error` | `#EF4444` | Status: error, validation |

### Typography

| Role | Spec |
|---|---|
| Display / Hero | Inter 700, 48–64px |
| Section heading | Inter 600, 24–32px |
| Body | Inter 400, 14–16px |
| Caption / label | Inter 400, 12px, `color-text-secondary` |
| Monospace (slugs, codes) | JetBrains Mono 400 |

### Component Specs

| Component | Spec |
|---|---|
| Panel / card | `bg: #111111`, `border: 1px solid #222222`, `border-radius: 8px` |
| Input field | `bg: #0a0a0a`, `border: 1px solid #333333`, `border-radius: 4px`, `focus: border #E8003D` |
| Primary button | `bg: #E8003D`, `text: #fff`, `border-radius: 4px`, `hover: bg #C0002F` |
| Ghost button | `bg: transparent`, `border: 1px solid #333`, `hover: border #E8003D` |
| Glow accent | `box-shadow: 0 0 40px rgba(232, 0, 61, 0.15)` |
| Badge (ready) | `bg: rgba(34,197,94,0.1)`, `text: #22C55E`, `border-radius: 99px` |

### Motion

- Library: Framer Motion
- Page transitions: `opacity 0→1, y +12→0, duration 0.2s ease-out`
- Card hover: `scale 1.01, duration 0.15s`
- No spring physics, no bounce — editorial, not playful
- Reduced motion: respect `prefers-reduced-motion`, fade only

---

## 13. MVP Scope

### Phase 1 — MVP (In Scope)

- [ ] Email/password auth with JWT
- [ ] Video upload with client-side validation
- [ ] FFmpeg transcode (H.264 720p, faststart, thumbnail)
- [ ] QR generation with Champions Group center logo
- [ ] Print-ready ZIP (PNG 300dpi, SVG, card mockup, sticker sheet PDF)
- [ ] MindAR `.mind` target compilation per card
- [ ] AR viewer: camera feed, QR tracking, video overlay
- [ ] Muted autoplay + tap-to-unmute
- [ ] Video tracks card movement in real time
- [ ] Processing status push (WebSocket) to dashboard
- [ ] Dashboard: card list, status, download QR ZIP
- [ ] Scan count analytics (basic)
- [ ] Non-AR preview link (standard video player fallback)
- [ ] MongoDB GridFS for all file storage

### Phase 2 (Post-MVP)

- [ ] Google OAuth
- [ ] AI video analysis — auto-fill profile fields via Gemini 1.5 Pro Vision
- [ ] AI script coach — suggest intro script before recording
- [ ] Replace video on existing card (keep same QR/slug)
- [ ] Analytics: device breakdown, country chart, scans over time graph
- [ ] Card designer: drag-and-drop business card builder with QR placement
- [ ] Custom QR colours (foreground/background picker)
- [ ] NFC tag support: same slug, tap-to-open variant
- [ ] Team/organisation accounts
- [ ] Stripe payments and plan tiers (Free / Pro / Business)
- [ ] White-label: custom domain for QR URL
- [ ] Video trimmer in browser (before upload)
- [ ] Cloudflare R2 migration from GridFS

---

## 14. Security

| Concern | Mitigation |
|---|---|
| Video URL exposure | GridFS: auth-gated stream endpoint. R2: pre-signed URLs with 1-hour expiry |
| QR slug enumeration | 8-char nanoid from 64-char alphabet = 64^8 ≈ 281 trillion combinations |
| Scan endpoint abuse | Rate limit: max 10 scan events per hashed IP per card per hour via Redis sliding window |
| File upload abuse | MIME type check + magic bytes validation (reject non-video at byte level). 200MB hard limit at multipart layer |
| XSS | React's JSX escaping + strict CSP header: `default-src 'self'; media-src blob: https:` |
| CORS | API restricted to known frontend origin via Fastify CORS plugin |
| Secrets | OpenRouter key, MongoDB URI, JWT secret — environment variables only, never in code or logs |
| Auth brute force | Bcrypt cost factor 12; login rate-limited to 10 attempts per IP per 15 minutes |
| IP privacy | IPs never stored raw — SHA-256 hashed before write |

---

## 15. Success Metrics

| Metric | MVP Target |
|---|---|
| AR tracking frame rate | ≥ 25 fps on iPhone 12+ and Snapdragon 778+ Android |
| Time from QR scan to video playing | < 3 seconds on 4G |
| AR viewer success rate | > 90% on supported browsers (Chrome Android, Safari iOS) |
| Upload-to-QR-ready time | < 60 seconds end-to-end |
| Print package download success | 100% (ZIP always available when `status = ready`) |
| Monthly active creators (3-month target) | 100 |
| Avg scans per card (first month) | ≥ 5 |

---

## 16. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | **Video storage:** GridFS (simpler) vs Cloudflare R2 from day one (better global latency)? | Recommended: GridFS for MVP, R2 at 5 GB |
| 2 | **Video length limit:** 60 seconds proposed — sufficient for intros, prevents storage abuse. Adjust? | Pending client confirmation |
| 3 | **Champions Group logo asset:** PNG provided by client. Needs transparent background, min 300×300px. | Asset pending — client to supply |
| 4 | **Sticker sheet size:** 1×1" QR stickers on A4 proposed. Offer multiple sizes (0.75", 1.25")? | Pending client confirmation |
| 5 | **Offline/PWA:** Should the AR viewer work offline after first load? Requires service worker + video caching. | Phase 2 unless specified |
| 6 | **Sound UX:** Muted autoplay + tap-to-unmute is the only approach browsers permit. Confirmed. | Decided ✓ |

---

*Document version: 1.0 — 2026-05-14*
*Product: QR-to-Video Intelligence Platform — Champions Group*
*Stack: React 18 + Vite · Fastify · MongoDB · mind-ar.js · OpenRouter (Gemini 1.5 Pro Vision)*

# ChampLens

QR-to-Video AR business card platform by Champions Group. A printed card carries a QR code; scanning it opens an immersive AR experience built from video, imagery and product detail, with campaign analytics tracking every scan.

A Champions Group product.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## Stack

TypeScript · Node 20 · Fastify · BullMQ · MongoDB · Redis · Docker Compose · MindAR (AR).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    docker-compose                        │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐│
│  │ frontend │   │ backend  │   │       worker         ││
│  │  nginx   │──▶│ Fastify  │   │  BullMQ processor    ││
│  │  :80     │   │  :3001   │   │  (transcoder/QR/AR)  ││
│  └──────────┘   └────┬─────┘   └──────────┬───────────┘│
│        │             │                    │             │
│        │        ┌────┴────────────────────┤             │
│        │        ▼                         ▼             │
│  ┌─────┴──┐ ┌──────────┐           ┌──────────┐        │
│  │uploads │ │ mongodb  │           │  redis   │        │
│  │volume  │ │  :27017  │           │  :6379   │        │
│  └────────┘ └──────────┘           └──────────┘        │
└─────────────────────────────────────────────────────────┘
```

The scan itself is served from the phone, so the heavy lifting is already done before the camera opens: the worker transcode, QR generation and AR compilation happen once, server-side, and the browser only plays the result.

---

## How it works

1. **Upload** a card design and a video.
2. **Compile AR** — a worker builds the MindAR target and compiles the tracking data.
3. **Generate QR** — the QR is bound to the card and its campaign.
4. **Transcode** — video is normalised for mobile playback.
5. **Print pack** — a downloadable pack with the print-ready card and QR.
6. **Scan** — the consumer's phone opens the AR experience.
7. **Measure** — every scan lands in the campaign analytics endpoint.

---

## Local development

**Requirements:** Docker and Docker Compose.

```bash
git clone git@github.com:Champ-Deep/ChampLens.git
cd ChampLens
cp backend/.env.example backend/.env   # fill in Mongo URI, Redis URL
docker compose -f docker-compose.dev.yml up
```

Frontend on `http://localhost:80`, API on `http://localhost:3001`.

See [SETUP.md](./SETUP.md) for the full environment reference.

---

## Project layout

| Path | What lives there |
|---|---|
| `backend/src/routes/` | API surface: `cards`, `campaigns`, `scans`, `analytics`, `auth`, `admin`, `files` |
| `backend/src/models/` | Mongoose models: `Card`, `Campaign`, `Scan`, `CampaignScan`, `User` |
| `backend/src/workers/` | BullMQ processors: `generateQR`, `compileMindAR`, `transcode`, `buildPrintPack`, `campaignWorker` |
| `backend/src/lib/` | `auth`, `storage`, `wsEmitter` |
| `frontend/` | The consumer-facing AR scan experience |

---

## Documentation

- [PRD.md](./PRD.md) — product requirements, feature breakdown, MVP scope
- [SETUP.md](./SETUP.md) — setup guide and environment reference

---

## Status

Pre-MVP. The pipeline is implemented end to end; campaign analytics and the AR
experience are the pieces still being hardened.

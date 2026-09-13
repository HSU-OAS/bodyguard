# Bodyguard

Real-time sitting posture coaching and measurement report service powered by open-source pose estimation AI.

> **Team UHI** · Open Source AI·SW Convergence Project, Hansung University (2026-2)

---

## Problem

According to the Korea National Health and Nutrition Examination Survey (KNHANES), daily sedentary time among Korean adults aged 19+ rose from **8.3 hours in 2018 to 9.0 hours in 2023**. A study of 244 Korean university students reported an average sitting time of **7.96 hours per day** (8.40 hours on weekdays) — roughly twice that of U.S. students. Health Insurance Review and Assessment Service (HIRA) data shows that **61% of forward head posture patients are in their teens to thirties**.

People already know that stretching helps. It still does not happen, for three reasons:

1. While concentrating, they simply **forget** to stretch.
2. Even when following a video, they **cannot verify whether their own posture is correct** — you cannot see your own posture.
3. **No record is kept** of how posture changes over time, so they cannot describe their condition with evidence.

**Core problem — people who work seated cannot check or correct their own posture, and have no way to keep a record of how it changes.**

---

## What Bodyguard does

| | Feature |
|---|---|
| 🎥 | **Real-time posture tracking** from a webcam — 33 body landmarks, processed in the browser |
| 🧍 | **3D avatar guide** showing the correct posture, with deviating body parts highlighted in red |
| 🧘 | **Stretching coach** — 6–8 routines (neck, shoulder, back, waist) with hold-time verification |
| 📊 | **Posture dashboard** — three metrics accumulated over time |
| 📄 | **Measurement report (PDF)** — an objective record to bring to a clinician |
| 🔔 | **Change detection** — flags shifts in the posture-metric time series |

### Measured metrics

- Craniovertebral angle (forward head posture)
- Shoulder lateral tilt
- Trunk forward flexion

> **Bodyguard does not perform medical diagnosis.** It provides camera-based posture measurement records only. Clinical judgement belongs to a medical professional.

---

## Privacy by design

Video never leaves the browser.

```
webcam ──► MediaPipe (on-device, in browser) ──► joint coordinates only ──► server
                        │
                   frames discarded
```

Only landmark coordinates and derived angle values are transmitted and stored. No image or video frame is saved or sent anywhere.

---

## Tech stack

| Layer | Technology | License |
|---|---|---|
| Pose estimation | [MediaPipe](https://github.com/google-ai-edge/mediapipe) | Apache-2.0 |
| 3D rendering | [Three.js](https://github.com/mrdoob/three.js) | MIT |
| Change detection | [PyOD](https://github.com/yzhao062/pyod) | BSD-2-Clause |
| Frontend | [React](https://github.com/facebook/react) | MIT |
| Backend | [FastAPI](https://github.com/fastapi/fastapi) | MIT |

Candidates evaluated and **not** adopted, with reasons, are documented in [`docs/02_oss_research.md`](docs/02_oss_research.md).

---

## Repository structure

```
bodyguard/
├── docs/                  # Project documents
│   ├── 01_project_charter.md
│   ├── 02_oss_research.md
│   ├── 03_prd.md
│   └── 04_license_checklist.md
├── README.md
└── LICENSE
```

---

## Getting started

> Setup instructions will be added once the development environment is configured (Week 6).

---

## Team

| Role | Member |
|---|---|
| PM / Frontend · 3D | Seongsu Lee |
| OSS · AI / Backend · Data | Yoon Heo |

---

## License

Released under the [MIT License](LICENSE).

This project builds on open-source software. Each dependency retains its own license; see [`docs/04_license_checklist.md`](docs/04_license_checklist.md) for the full list.

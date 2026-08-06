---
version: 1
slug: "miniprogram-app-wxss"
primary_target: "miniprogram/app.wxss"
related_targets: ["miniprogram/pages/home/home.wxml","miniprogram/pages/booking/booking.wxml","miniprogram/pages/health/health.wxml","miniprogram/pages/profile/profile.wxml"]
---

## Scope and mode

Customer-facing WeChat mini-program surfaces, operated one-handed in short visits. PC admin styling is out of scope.

## Audience and job

Visitors choose a clinic service, practitioner, and slot; returning members review appointments, health records, messages, and membership information.

## Content and proof

Use the existing stores, services, practitioners, appointment slots, health records, articles, messages, and member data. Do not invent claims, prices, or credentials.

## Chosen direction

Approved palette direction B — Service Orange: cool gray #F4F5F6 canvas, charcoal #2D3035 text, mandarin orange #E76F3C for the primary action and active states, pale orange #FFF0E7 for selected surfaces, white cards, and neutral borders #DEE1E4. The approved reference board is `.impeccable/mocks/home-reference-palettes.png` (B: Service Orange).

## Memorable moment

The first viewport makes the next booking step obvious: one primary appointment action, then the service → practitioner → time path.

## Constraints and unresolved decisions

Keep WeChat tab navigation, safe-area behavior, existing API/data flows, and real content. Avoid gradients, glass effects, decorative emoji, oversized rounded cards, and color-only status. Copy, icon assets, and data fallbacks remain implementation responsibilities.

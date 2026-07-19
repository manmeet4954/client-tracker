# 17 — Catalogue PDF Export

Status: BUILDING (2026-07-19). Asked by Manmeet for Sonia's catalogue.

## The ask, in her words

Sonia already shares single catalogue photos on WhatsApp. Manmeet wants her to
be able to select photos from anywhere in the catalogue (across categories),
turn the selection into one PDF, and share that PDF on WhatsApp. No friction:
select, make PDF, share. Nothing else.

## Decisions (locked with Manmeet, 2026-07-19)

- PDF layout: **one photo per page** (her pick over grid layouts).
- Zero-step flow: the share sheet opens by itself the moment the PDF is ready.
  On a phone that means: tap WhatsApp, pick the chat, send. Done.

## How it works

1. A **Select** button appears in the catalogue (both on the category screen
   and inside a category). Tapping it starts selection mode.
2. In selection mode, tapping a photo ticks it. Tapping again unticks. She can
   go back to the category list and into another category — **the selection
   survives navigation**. Category cards show how many are picked inside.
3. A bar sits at the bottom: "N photos selected", one **Make PDF** button, and
   a cancel X.
4. Make PDF builds the file on the device: each photo becomes one full-bleed
   PDF page sized to the photo itself. Photos are recompressed (max 1400 px,
   JPEG) so the file stays WhatsApp-friendly even with many photos.
5. When ready, the phone's share sheet opens with the PDF attached
   (`navigator.share` with a file — same mechanism as the existing per-photo
   share). On desktop or old browsers, the PDF downloads instead.

Filename: `<Client name> Catalogue <date>.pdf`.

## What this deliberately is NOT

- No captions, prices, or names in the PDF — the catalogue has photos only.
- No saved "collections". The selection is throwaway; nothing is written to
  AppState, so there is no save-race exposure and no access-rule change.
- No server work. The PDF is made in the browser. Catalogue images live in
  Supabase public storage, which allows the browser to read them for this.

## Touches

- `components/CatalogueView.tsx` — selection mode, bottom bar, PDF build+share.
- `package.json` — one new dependency: `jspdf` (client-side PDF writer).

## Who sees it

Everyone who can see the Catalogue tab (owner and Sonia's login). Pure UI on
data already visible to that role; `lib/access.ts` untouched.

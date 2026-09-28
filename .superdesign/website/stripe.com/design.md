---
version: "superdesign-alpha"
name: "Violet Spectrum Rail"
description: "White-dominant enterprise system carrying one rationed multi-hue radial spectrum through hero and section transitions, set on a strict sohne-var type scale with a violet action color and near-black ink."
colors:
  background: "#FFFFFF"
  surface: "#F8FAFD"
  surface-alt: "#E5EDF5"
  text-primary: "#000000"
  text-secondary: "#50617A"
  text-tertiary: "#64748D"
  ink-navy: "#122054"
  accent: "#533AFD"
  accent-hover: "#4032C8"
  accent-border: "#B9B9F9"
  success-green: "#00D66F"
  ruby-icon: "#EA2261"
typography:
  display-lg:
    fontFamily: "sohne-var"
    fontSize: "48px"
    fontWeight: 300
    lineHeight: "1.15"
    letterSpacing: "-1px"
  headline-md:
    fontFamily: "sohne-var"
    fontSize: "32px"
    fontWeight: 300
    lineHeight: "1.1"
    letterSpacing: "-0.6px"
  body-md:
    fontFamily: "sohne-var"
    fontSize: "32px"
    fontWeight: 300
    lineHeight: "1.1"
  label-md:
    fontFamily: "sohne-var"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.4"
  body-lg:
    fontFamily: "sohne-var"
    fontSize: "32px"
    fontWeight: 300
    lineHeight: "1.1"
  label-mono:
    fontFamily: "SourceCodePro"
    fontWeight: 400
    fontStyle: "normal"
spacing:
  base: "8px"
  micro: "4px"
  tight: "2px"
  gap: "16px"
  gap-lg: "24px"
  max-width: "40px"
rounded:
  control: "4px"
  control-alt: "6px"
  card-sm: "5px"
  card: "8px"
  card-lg: "16px"
  pill: "9999px"
  square: "4px"
components:
  button-primary:
    background: "#533AFD"
    text-color: "#FFFFFF"
    radius: "4px"
    height: "48px"
    padding: "15.5px 24px 16.5px"
    hover-background: "#4032C8"
  button-nav-cta:
    background: "#533AFD"
    text-color: "#FFFFFF"
    radius: "4px"
    height: "40px"
    padding: "11.5px 20px 12.5px"
    hover-background: "#4032C8"
  button-ghost-outline:
    background: "#FFFFFF"
    text-color: "#FD6252"
    border: "1px solid #E5EDF5"
    radius: "4px"
    height: "40px"
  button-tag-green:
    background: "#00D66F"
    text-color: "#000000"
    radius: "4px"
    height: "24px"
  button-tag-dark:
    background: "#000000"
    text-color: "#FFFFFF"
    radius: "4px"
    height: "24px"
  card-feature-media:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-white-panel:
    background: "#FFFFFF"
    radius: "0px"
    padding: "0px 16px"
    border: "1px solid #E5EDF5"
  card-stat:
    background: "transparent"
    radius: "8px"
    padding: "40px 0px"
  navbar:
    background: "transparent"
    radius: "0px"
    height: "76px"
    width: "100%"
---
# Violet Spectrum Rail
Source: https://stripe.com

## Overview
This is a light-mode-default enterprise design language: an editorial white canvas built on a disciplined sohne-var type scale, punctuated by a single saturated identity move — a large multi-hue radial gradient that erupts from the bottom edge of key sections. The aesthetic sits between Swiss/International rationalism (ruled dividers, restrained ink, strict grid) and a soft aurora-gradient signature borrowed from contemporary AI/fintech marketing. Structure carries the credibility; color is reserved for a handful of "hero moments." Iconography and copy are monochrome and quiet; the spectrum gradient is the entire visual voice.

## Composition
The first screen is left-weighted: an eyebrow metric line, a four-line headline that shifts from solid black ink to a lighter violet-blue tint mid-sentence, two buttons, then a logo strip — all pinned to the left half, while a diagonal multi-hue ribbon gradient sweeps in from the right edge and dominates the right half of the viewport, bleeding past the frame. This is a deliberate asymmetric split (content-left, color-right) rather than a centered hero — it lets the gradient read as an environmental backdrop rather than competing with type for center-stage attention. Below the fold, rhythm alternates: a dense feature-card grid (mixed one-wide and two-wide panels) → a full-bleed dark editorial banner with a photographic scene and its own gradient wash → a pale-lavender stat band with a radial burst canvas → a alternating text/photo enterprise-proof section → a dense multi-column footer. Density increases in the mid-page card grid, then relaxes into generous whitespace for the stat band and enterprise section.

## Colors
Background is white (#FFFFFF, ~64% of declared area and the dominant pixel value at ~58%), with a pale blue-lavender secondary surface (#E5EDF5, #F8FAFD) used for the stat band and footer to create a one-step elevation shift without leaving the light system. Ink is pure black (#000000) for primary headline runs and body copy; a muted slate-blue (#50617A, #64748D) carries secondary/supporting text. Violet (#533AFD) is the single accent — used only for the primary CTA fill, nav CTA fill, and select in-headline word tints — appearing at roughly 0.2% of declared area, confirming it is rationed to buttons and short accent clauses, never backgrounds. Deep navy (#122054, #061B31) appears in dark section surfaces (the editorial video banner). A green (#00D66F) and near-black tag chip appear only as small inline labels mid-page. Borders are hairline pale blue-violet (#E5EDF5, #B9B9F9). The multi-hue radial gradients (blues, oranges, pinks, purples) are the only saturated color in the system and are confined to specific bleed zones — never full-section fills.

## Typography
A single variable sans, sohne-var, carries every role, differentiated by weight (300 light for display/headline, 400 regular for body/labels) and size rather than family switching. Display headline is 48px/1.15, tracked tight at -1px; a mid headline register runs 32px/1.1 at -0.6px tracking, reused at body scale for oversized editorial statements (e.g. section intros). Labels and body settle at 16px/1.4–1.5, weight 400. A monospace accent family, SourceCodePro, is reserved for code/technical labels — the signature accent face for developer-facing captions. Headlines use selective color-weight shifts (solid black runs into lighter violet-tinted runs) as the hierarchy device inside a single sentence, rather than italics or size jumps.

## Layout
Content is capped at a 1266px max-width, centered, with an 8px base spacing unit and a 16px standard gap. The mid-page feature grid runs 12 columns with 16px gaps; one measured row places four cards at 23/23/23/23% width (a tight uniform quartet), while another zone runs a two-item row at 41/49% (near-even split, slightly asymmetric). Card radii in this system are flat — 0px on nearly every content card — with visual separation coming from padding, hairline borders, and background value shifts rather than rounded containers; only buttons and a few utility surfaces use the 4–8px radius tokens. The footer is a four-to-five column link matrix (87 links total) on the pale surface, edge-ruled with a top hairline divider.

## Components
- **Navbar**: edge-to-edge square bar, 76px tall, full viewport width (0px inset either side), 0px corner radii on all four corners (flat rectangle, not inset/capsule), transparent background sitting directly on the hero. Carries 15 items: wordmark left, 5 dropdown/text nav items, then right-aligned a bordered outline "Sign in" button and a solid violet CTA (#533AFD fill, #FFFFFF text, 4px radius, 40px height, 11.5px/20px padding, hover → #4032C8).
- **Hero primary button**: an observed near-white/solid violet-filled pill-rectangle sitting directly under the headline — solid #533AFD fill, white text, ~4px corners (slightly-rounded, not pill), 48px height, 15.5px/24px/16.5px padding; hover darkens to #4032C8. This is the single most emphasized control on the first screen.
- **Hero secondary button**: a white-filled outline button beside the primary, bordered in pale #E5EDF5, colored icon-and-text (an observed multi-color glyph beside black/violet text), same ~4px corner family, lower visual weight than the primary — a utility alternative, not a competing CTA.
- **Logo strip**: one row directly beneath the hero, 6–7 monochrome/brand-colored wordmarks evenly spaced, no card container, sits on plain white — a trust-signal band, not a component with its own surface.
- **Feature card grid (media cards)**: mid-page, arranged in rows of [2] then [3] then [3] — the two-up row places a phone-mockup payment-flow illustration beside a dashboard/usage-meter illustration on a warm gradient surface; the following two three-up rows carry chat-interface, card-issuing, and globe-network illustrations. Surface is transparent/flat (0px radius, 0px padding at the card level), each with a heading line, expand/zoom affordance icon top-right, and a device-mockup or UI-screenshot illustration filling 60–70% of the card height beneath the heading. Card widths measured at 23% each in the quartet zone and 41/49% in the paired zone.
- **Full-width white feature panels**: a stack of four 100%-width rows (white #FFFFFF fill, 0px radius, 0px/16px padding), each containing a top media strip, a heading, an expandable disclosure affordance, body text, and two inset tiles — a taller, denser feature-explainer format distinct from the media cards above.
- **Editorial banner card**: single full-bleed card mid-page, dark navy/black background with a photographic stage scene and a diagonal orange-violet gradient wash across the right two-thirds; contains a light headline (white text), a white-filled small CTA button (rounded ~4-6px, dark violet text), and a small wordmark lockup bottom-right. One per section, not repeated.
- **Stat/numeral row**: one row of 4 oversized numeral figures (grid: 12 columns, 16px gap, each ~23% width) beneath a two-line headline; numerals set large and light-weight, each paired with a small two-line caption in muted slate (#50617A) beneath. Sits on the pale #F8FAFD surface band. A live particle/line-burst canvas (radial spectrum lines fanning from a point) renders beneath the stat row as an animated centerpiece — use a static radial-gradient burst image as a stand-in.
- **Alternating proof section**: text-left/logo-badge row (small brand glyph tile + one-line proof statement + right-aligned link) followed by a full-bleed aerial photograph card (0px radius on the outer frame, hairline border) — one instance, sits between the stat band and footer.
- **Footer**: pale surface (#F8FAFD), four-to-five column link matrix, 87 total links, hairline top divider, small language-selector control bottom-left and a dark angular glyph mark bottom-right, copyright line beneath.

## Graphics & Effects
Five distinct large radial gradients are measured, each covering roughly 6.4% of total page area — they are NOT full-screen washes but localized bleed treatments anchored to the bottom edge of specific sections (hero ribbon, mid-page card surfaces, banner corners): e.g. `radial-gradient(1653px 1092px at 50% calc(100% + 28px), rgb(72, 111, 253) 0px, rgb(127, 129, 243) 9.84%, rgb(196, 137, 255) 20.83%, rgb(218, 192, 255) 34.13%, rgb(234, 220, 255) 44.86%, rgb(249, 246, 255) 58.59%, rgb(248, 250, 253) 100%)` and its warm counterpart `radial-gradient(1653px 1055px at 50% 104.6%, rgb(203, 131, 255) 0px, rgb(255, 144, 185) 15.77%, rgb(255, 201, 119) 30.62%, rgb(255, 215, 155) 38.04%, rgb(255, 241, 220) 50.11%, rgb(255, 255, 255) 63.1%, rgb(252, 253, 254) 77.95%, rgb(248, 250, 253) 98.81%)`. Each washes out to near-white/pale-surface at its outer edge, which is how the system keeps a light-dominant page while still delivering one saturated color moment per section. Five live canvas elements render animated equivalents (a particle/line burst, flowing ribbon) — approximate each with a static radial-gradient or streak image matching the palette above. Card and banner shadows use layered soft drops: `rgba(50, 50, 93, 0.25) 0px 30px 45px -30px, rgba(0, 0, 0, 0.1) 0px 18px 36px -18px` for elevated cards and `rgba(3, 3, 39, 0.25) 0px 14.088px 21.132px -14.088px, rgba(0, 0, 0, 0.1) 0px 8.453px 16.906px -8.453px` for the dark editorial banner. A chat-widget popover uses `backdrop-filter: blur(12px)` for a glass surface over the page.

## Motion
Interaction transitions are uniformly fast and smooth: `fill 0.3s cubic-bezier(0.25, 1, 0.5, 1)`, `color 0.3s cubic-bezier(0.25, 1, 0.5, 1)`, `stroke 0.3s cubic-bezier(0.25, 1, 0.5, 1)`, `transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)` — a single 300ms custom-eased curve applied consistently across button fills, icon strokes, and link colors, producing a controlled, non-bouncy hover response rather than spring/overshoot. The radial-burst and ribbon canvases imply continuous idle animation (particles/lines in motion) rather than scroll-triggered reveals.

## Guardrails
- Never fill a full section background with one of the five measured gradients — each is a bottom-anchored bleed on one region only, always resolving to near-white/pale at its edge.
- Do not round the content/media cards — they are flat 0px-radius panels; reserve the 4–8px radii for buttons and small utility surfaces only.
- Keep the navbar a flat, edge-to-edge, square-cornered, transparent bar — never convert it to an inset, capsule, or shadowed floating bar.
- The primary hero CTA is the solid violet 4px-radius rectangle under the headline — never substitute the outline/ghost button or a nav-measured glass control for this role.
- Reserve violet (#533AFD) strictly for CTAs and short in-headline accent words; do not tint large surfaces or backgrounds with it.
- Keep type to the single sohne-var family across all weights/sizes; use SourceCodePro only for code/technical label accents, never for headlines.
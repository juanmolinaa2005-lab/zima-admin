---
version: "superdesign-alpha"
name: "Etched-plate aurora"
description: "A near-white editorial system punctuated by one deep-sky-to-mint hero band carrying an engraved illustration, with pill controls throughout and hairline card grids on a pale gradient canvas."
colors:
  background: "#F7FAFF"
  surface: "#FFFFFF"
  hero-deep: "#0D0D3F"
  hero-accent: "#02294B"
  text-primary: "#111111"
  text-secondary: "#02294B"
  accent-violet: "#7646EC"
  accent-teal: "#5BEFBD"
  accent-blue: "#0A85EA"
  footer-bg: "#00172E"
typography:
  display-lg:
    fontFamily: "Plaid Sans"
    fontSize: "76px"
    fontWeight: 500
    lineHeight: "1.12"
    letterSpacing: "-3.4px"
  headline-md:
    fontFamily: "Plaid Sans"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "1.1"
    letterSpacing: "-0.4px"
  body-md:
    fontFamily: "Plaid Sans"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: "1.4"
  label-md:
    fontFamily: "Plaid Sans"
    fontSize: "29px"
    fontWeight: 500
    lineHeight: "1.4"
    letterSpacing: "-0.5px"
  body-copy:
    fontFamily: "Cern"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.5"
  accent-serif:
    fontFamily: "Times New Roman"
    fontSize: "76px"
    fontWeight: 500
    style: "italic accent on select headline words"
  label-mono:
    fontFamily: "Inconsolata"
    fontSize: "13px"
    fontWeight: 400
spacing:
  base: "8px"
  gap: "24px"
  section-padding: "164px"
rounded:
  control: "8px"
  pill: "9999px"
  card: "2px"
  panel: "20px"
components:
  button-hero-primary:
    background: "observed near-black solid fill with a thin gold-to-violet gradient rim light"
    text-color: "#FFFFFF"
    radius: "9999px"
    height: "56px"
    padding: "0px 32px"
    hover-shadow: "rgb(94, 94, 217) 0px 0px 14px 0px"
  button-hero-secondary:
    background: "#F0F0FF"
    text-color: "#0A54C4"
    radius: "9999px"
    height: "54px"
    padding: "17px"
    border: "2px solid rgba(0, 0, 0, 0)"
  button-glass-nav:
    background: "transparent"
    text-color: "#232424"
    radius: "999px"
    height: "48px"
    padding: "12px 16px"
  button-gradient-lilac:
    background: "linear-gradient(to left bottom, rgb(230, 230, 255) 0%, rgb(229, 239, 254) 50%, rgb(204, 248, 255) 100%), linear-gradient(to right, rgb(131, 88, 239) 0%, rgb(21, 110, 245) 100%)"
    text-color: "#0A54C4"
    radius: "100%"
    height: "54px"
    padding: "17px"
    border: "2px solid rgba(0, 0, 0, 0)"
  button-gradient-teal:
    background: "linear-gradient(132deg, rgb(66, 240, 205) 0%, rgb(13, 173, 242) 82.97%)"
    text-color: "#00172E"
    radius: "46px"
    height: "46px"
    padding: "8px 30px"
    shadow: "rgba(0, 0, 0, 0.15) 0px 1px 5px 0px"
  card-hero-panel:
    background: "transparent"
    radius: "0px"
    padding: "0px 40px"
  card-band-panel:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-nav-flyout:
    background: "#FFFFFF"
    radius: "8px"
    padding: "24px 24px 5px"
---
# Etched-plate aurora
Source: https://plaid.com

## Overview
This is a light-mode-default editorial system built on a near-white aurora gradient canvas, broken by one saturated deep-blue-to-teal hero band carrying an etched, halftone-style illustration. It reads as a fusion of Swiss-grid restraint (tight negative tracking on an oversized display face, disciplined multi-column bands) and a soft SaaS-glass finish (pill buttons, translucent nav bar, gradient-rim CTAs). The palette is otherwise almost achromatic — white, off-white, ink-navy text — with color reserved for a rationed set of gradient accents that mark only the most important actions and one full-bleed hero/CTA band each.

## Composition
The first screen opens on the one saturated moment in the whole page: a deep navy-to-teal hero band holding an engraved illustration, a tight display headline in mixed white/mint-gradient type, two pill CTAs, a logo strip, and a floating dark glass assistant panel pinned to the lower-right corner. Immediately below, the page drops to its true dominant register — a pale, almost-white gradient field — and stays there through a long sequence of alternating content bands: a bento-style feature grid, a two-column stat/illustration split, a horizontal card rail, before returning to a second saturated band (a mirrored deep-blue-to-teal aurora) that hosts the closing form and a dark footer. This is a deliberate rhythm of "color only at the bookends" — the alternative (color threaded through every section) is explicitly rejected in favor of letting the light gradient canvas carry the bulk of the page while blue/teal saturation signals only "start" and "convert" moments.

## Colors
The dominant field, matching the pixel read, is a near-white aurora wash — `linear-gradient(to left bottom, rgb(245, 245, 255) 0%, rgb(247, 250, 255) 50%, rgb(229, 252, 255) 100%)` — covering roughly 78% of the page and serving as `background`. Deep navy (`#0D0D3F`, `#02294B`) and a blue-to-teal gradient together cover about 20% and are rationed to exactly two full-bleed bands: the opening hero and the closing form/CTA band. Ink text (`#111111`) is the primary reading color on light surfaces; a deep-navy secondary tone (`#02294B`) carries subheads and metadata. Accent color appears only inside interactive elements: a violet-to-blue gradient (`#8358EF` → `#156EF5`) on prominent mid-page buttons, and a teal-to-blue gradient (`#42F0CD` → `#0DADF2`) on a late-page CTA. Oversized statistic numerals use a flat violet/purple, the only place saturated color sits directly on body copy. Everything structural — borders, dividers, card frames — is left uncolored, rendered as pure white or transparent with no visible stroke.

## Typography
Plaid Sans is the display and UI workhorse: a 76px/500 display face at 1.12 line-height and −3.4px tracking drives hero headlines, tightened almost to a wordmark; a 20px/600 headline size with −0.4px tracking labels card titles; a 29px/500 label size handles mid-weight callouts; 24px/400 covers larger intro paragraphs. Body reading copy switches to Cern at 16px/400 in `#111111`, with `#02294B` used for secondary/meta lines — this sans-pair (geometric display face over a humanist text face) is the core hierarchy logic. An italic serif accent (Times New Roman) interrupts select words within headlines at full display size, never more than a couple of words per headline, functioning as the signature emphasis device rather than a separate scale. A monospace family (Inconsolata) appears only at small label sizes for incidental tags.

## Layout
Content is capped at a 1730px max-width with 164px vertical section padding and tight 8px inter-element gaps within bands, giving a spacious macro-rhythm but a dense micro-rhythm inside each block. The signature mid-page feature area is an asymmetric bento composition: a wide two-up row (two roughly equal ~90%-width panels stacked, each holding a bleed illustration) followed by a three-up row of narrower cards — reconciling to rows of [2][3] rather than a uniform grid. A separate stat/story section runs as a strict 5-column card rail (gap 24px, 8 items across two visual rows of 5+3) for logo/testimonial-style content. A two-column 22/78 split pairs a floating notification-card illustration against a stat-and-copy block. Card radii throughout these full-bleed panels are 0px — flush, edge-to-edge rectangles — while the pill radius (9999px/100px) is reserved entirely for buttons and rounded panel accents like the closing form's 20px-radius glass panel.

## Components
- **Navbar**: edge-to-edge square bar, 95px tall, spans the full 1920px viewport (0px inset either side), all four corners 0px radius, sticky, background transparent (floats over the hero illustration). Holds a logo mark plus ~4 primary nav items (dropdown-enabled), a "Log in" outline pill button, and a solid dark "Contact sales" pill CTA with a thin gold-violet gradient ring; nav utility buttons measured at 48px height, 999px radius, transparent fill, `#232424` text.
- **Hero primary CTA**: an observed solid near-black pill button ("Start building"-style), ~9999px radius, sitting directly under the headline — the single most emphasized control on the first screen, ringed with a faint gold-to-violet gradient border and white text; hover produces a soft violet glow (`rgb(94, 94, 217) 0px 0px 14px 0px`).
- **Hero secondary button**: a pale lilac/ice pill fill (`#F0F0FF`-toned) with `#0A54C4` text, 54px height, 9999px radius, sitting beside the primary — a lower-contrast companion, not the focal action.
- **Floating assistant panel**: a dark glass card pinned bottom-right of the hero, opaque near-black fill, rounded corners, containing a heading, two lines of body copy, and a vertical stack of four full-width pill sub-buttons plus a fine-print consent line — this is a persistent utility overlay, not a content card.
- **Feature bento grid** (mid-page): two-row composition of [2 wide panels] then [3 narrower panels], all radius 0px, padding 0/40px horizontal, transparent fill; anatomy top-to-bottom is icon-linked heading (with trailing circular arrow glyph) over a large illustrative product-screenshot bleed filling most of the card — bank-flow mockups, circular score gauges, dashboard fragments.
- **Gradient CTA buttons (mid-page, ×2)**: pill buttons carrying the verbatim violet-blue tri-stop gradient fill, `#0A54C4` text, 54px height, used as inline promotional actions within content bands, not the hero.
- **Gradient CTA button (late-page, ×1)**: pill button with the verbatim teal-blue gradient fill, `#00172E` text, 46px height/radius, resting shadow `rgba(0, 0, 0, 0.15) 0px 1px 5px 0px` — a secondary conversion action near the page end.
- **Stat/numeral row**: two-column set of oversized violet numerals paired with short navy caption lines, arranged in a 2×2 cluster beside a floating notification-illustration column; numerals are set in the display serif/mixed weight at a scale dwarfing the caption text beneath.
- **Story/testimonial card rail**: 5-column horizontal grid, 24px gap, 8 items across two visual rows ([5][3]), each card a flush-edge (0px radius) photographic thumbnail with a scrim, an overlaid logo mark, a two-line headline in navy, and a small arrow-icon link label beneath — includes prev/next circular nav-arrow controls above the rail.
- **Closing form panel**: a white rounded card (20px radius) floating on the closing gradient band, drop shadow `rgba(125,125,125,0.1) 0px 3.585px 7.887px 0px` (and its accompanying soft multi-layer stack), containing a heading, a 2-column field grid (name, email, company, country, phone), consent microcopy, and a solid gradient pill submit button.
- **Trust banner strip**: a full-width pale-lilac pill/capsule band directly beneath the form, containing a line of body copy and an inline violet text link with a lock icon — flush pill shape distinct from the card system above it.
- **Footer**: solid `#00172E` fill, 0px radius, no card framing — a flat multi-column link field (68 links total) under a small logo mark, with social icons and legal microcopy along the bottom edge.

## Graphics & Effects
The dominant background gradient — `linear-gradient(to left bottom, rgb(245, 245, 255) 0%, rgb(247, 250, 255) 50%, rgb(229, 252, 255) 100%)` — covers the majority of the page as the base canvas behind all mid-page content bands. Two saturated gradients are each confined to one full-bleed band only: `linear-gradient(-210deg, rgb(7, 87, 140) 27.07%, rgb(14, 148, 216) 59.71%, rgb(66, 240, 205) 92.45%)` washes the hero's illustration zone, while `linear-gradient(95deg, rgb(1, 23, 46) 27.81%, rgb(1, 46, 55) 76.6%)` sits as a scrim over the hero's engraved-portrait media, darkening it for text legibility. A small radial gradient (`radial-gradient(circle at 0% 0%, rgb(134, 239, 90) 0.86%, rgb(16, 208, 183) 38.09%, rgb(255, 255, 255) 69.81%)`) appears only inside a compact score/gauge illustration, covering under 1% of the page — never treat it as a page background. The hero and card illustrations read as fine-line engraved/halftone artwork (a portrait rendered in stippled linework) rather than photography; the story rail uses real photographic thumbnails with a diagonal navy-to-teal scrim for text contrast. Live canvas elements drive the flowing wireframe line patterns visible behind hero and footer text — treat as animated vector fields; a static frozen frame of concentric wavy lines is the correct stand-in. Card and panel elevation is minimal — most cards are flush (0px radius, no shadow); the one true elevated surface is the closing form panel, using a soft five-layer shadow stack for a gentle lift. A `blur(15px)` backdrop-filter is applied to the glass navbar and floating assistant panel, giving both a frosted, semi-translucent read against whatever illustration sits behind them.

## Motion
Interactions are quick and utilitarian: color transitions run at `color 0.1s ease-in-out` for text/link state changes, while composite opacity+shadow states use `opacity, box-shadow 0.3s, 0.3s ease-in-out, ease-in-out`. A slower `transform, opacity 1.5s, 1.5s ease, ease` transition governs larger entrance/reveal moments (illustration or card fade/settle). Spin keyframes recur across six separate elements, driving small circular loaders or rotating iconography rather than large decorative motion. Scroll-driven CSS animations are present, most likely tying the flowing line-field canvases and card reveals to scroll position rather than time. Overall the motion character is subtle and functional — short, snappy state transitions on controls, one long deliberate reveal timing for hero/section entrances, no springy overshoot.

## Guardrails
- Never let the saturated blue-teal gradient bleed across the whole page — it is rationed to exactly two full-bleed bands (hero, closing CTA); everything between is the pale near-white aurora field.
- Do not give mid-page utility/nav buttons the hero primary's solid dark-pill treatment, and do not give the hero primary a measured glass button's rgba fill — keep the hero CTA an observed solid near-black pill with a gradient rim light.
- Keep all bento/content-band cards at 0px radius and flush edges; do not round them to match the pill buttons or the 20px form panel.
- Preserve the navbar as an edge-to-edge, square-cornered, transparent sticky bar — never convert it to a centered, bounded, or capsule-shaped nav.
- Reserve the italic serif accent for one or two words per headline at full display scale — never apply it as a running body or paragraph face.
- Keep gradient fills (button and scrim) verbatim as multi-stop CSS strings; do not simplify any of them to a flat two-color swatch.
---
version: alpha
name: Coinbase
description: Design system for coinbase.com, a light-mode financial product site with a premium, trustworthy, and highly restrained visual language.
colors:
  background: "#ffffff"
  text: "#0a0b0d"
  accent: "#0052ff"
  primary: "#0052ff"
  secondary: "#ffffff"
  tertiary: "#5b616e"
  neutral: "#e5e7eb"
  surface: "#ffffff"
  on-surface: "#0a0b0d"
  error: "#ef4444"
typography:
  fontFamily: CoinbaseSans
  headline-display:
    fontFamily: CoinbaseDisplay
    fontSize: 64px
    lineHeight: 64px
    letterSpacing: 0px
    fontWeight: 400
  headline-lg:
    fontFamily: CoinbaseDisplay
    fontSize: 44px
    lineHeight: 44px
    letterSpacing: 0px
    fontWeight: 400
  headline-md:
    fontFamily: CoinbaseSans
    fontSize: 20px
    lineHeight: 28px
    letterSpacing: 0px
    fontWeight: 400
  body-lg:
    fontFamily: CoinbaseText
    fontSize: 18px
    lineHeight: 28px
    letterSpacing: 0px
    fontWeight: 400
  body-md:
    fontFamily: CoinbaseText
    fontSize: 16px
    lineHeight: 28px
    letterSpacing: 0px
    fontWeight: 400
  body-sm:
    fontFamily: CoinbaseSans
    fontSize: 13px
    lineHeight: 20px
    letterSpacing: 0px
    fontWeight: 400
  label-lg:
    fontFamily: CoinbaseSans
    fontSize: 18px
    lineHeight: 22px
    letterSpacing: 0px
    fontWeight: 600
  label-md:
    fontFamily: CoinbaseSans
    fontSize: 16px
    lineHeight: 24px
    letterSpacing: 0px
    fontWeight: 600
  label-sm:
    fontFamily: CoinbaseSans
    fontSize: 13px
    lineHeight: 20px
    letterSpacing: 0px
    fontWeight: 400
rounded:
  none: 0px
  sm: 8px
  md: 16px
  lg: 28px
  xl: 56px
  full: 9999px
spacing:
  xs: 2px
  sm: 10px
  md: 24px
  lg: 28px
  xl: 64px
components:
  button:
    primary:
      backgroundColor: "#0052ff"
      color: "#ffffff"
      borderColor: "#0052ff"
      borderWidth: 1px
      borderStyle: solid
      borderRadius: 56px
      padding: 16px 32px
      minHeight: 56px
      minWidth: 100px
      fontFamily: CoinbaseSans
      fontSize: 18px
      fontWeight: 600
      textDecoration: none
      boxShadow: none
    secondary:
      backgroundColor: "#ffffff"
      color: "#0a0b0d"
      borderColor: "#ffffff"
      borderWidth: 1px
      borderStyle: solid
      borderRadius: 56px
      padding: 16px 32px
      minHeight: 56px
      minWidth: 100px
      fontFamily: CoinbaseSans
      fontSize: 18px
      fontWeight: 600
      textDecoration: none
      boxShadow: none
    link:
      backgroundColor: transparent
      color: "#5b616e"
      borderColor: transparent
      borderWidth: 0px
      borderStyle: none
      borderRadius: 0px
      padding: 0px
      minHeight: 0px
      minWidth: 0px
      fontFamily: CoinbaseSans
      fontSize: 13px
      fontWeight: 400
      textDecoration: underline
      boxShadow: none
  card:
    backgroundColor: "#ffffff"
    color: "#0a0b0d"
    borderColor: "#e5e7eb"
    borderWidth: 1px
    borderStyle: solid
    borderRadius: 8px
    padding: 16px
    boxShadow: none
---

# Overview

Coinbase uses a minimal, high-trust visual system optimized for conversion and clarity. The experience is predominantly white, with a single saturated blue accent used for primary actions, brand moments, and emphasis. Typography is clean and editorial, with a large display face for headlines and a neutral sans for supporting UI.

Use this system to create pages that feel restrained, confident, and financially credible. Reserve visual complexity for product charts, trading data, and app imagery.

# Colors

Core palette:

- Background: `#ffffff`
- Text: `#0a0b0d`
- Accent / primary action: `#0052ff`
- Secondary text: `#5b616e`
- Divider / neutral border: `#e5e7eb`

Guidance:
- Use white surfaces by default.
- Use the blue accent for one primary action per view when possible.
- Keep body copy dark and highly readable.
- Treat error color as sparing, functional feedback only.

# Typography

Coinbase typography is intentionally simple and premium.

## Display and headings
- `headline-display`: `CoinbaseDisplay`, 64/64, regular
- `headline-lg`: `CoinbaseDisplay`, 44/44, regular
- `headline-md`: `CoinbaseSans`, 20/28, regular

## Body and labels
- `body-lg`: `CoinbaseText`, 18/28, regular
- `body-md`: `CoinbaseText`, 16/28, regular
- `body-sm`: `CoinbaseSans`, 13/20, regular
- `label-lg`: `CoinbaseSans`, 18/22, semibold
- `label-md`: `CoinbaseSans`, 16/24, semibold
- `label-sm`: `CoinbaseSans`, 13/20, regular

Guidance:
- Use Coinbase Display for hero headlines and large marketing statements.
- Use Coinbase Text for main explanatory copy where available.
- Keep letter spacing neutral.
- Avoid heavy weights in large display type; the system relies on scale, not boldness.

# Layout

The homepage is a wide, airy two-column composition with generous negative space.

Observed layout patterns:
- Top utility banner spanning full width.
- Main navigation in a single horizontal row.
- Hero section with large product illustration on the left and headline plus signup form on the right.
- Supporting legal copy placed in small type beneath the hero.
- Cookie consent panel floats fixed at the bottom-right.

Guidance:
- Prefer wide gutters and clear separation between content blocks.
- Keep primary conversion content above the fold.
- Use asymmetry in the hero: large image or product mockup balanced by concise copy.
- Align forms and buttons on a single baseline when possible.
- Use dense legal text only in low-emphasis areas and smaller type.

# Elevation & Depth

Depth is minimal.

- Cards and panels generally use flat surfaces with subtle 1px borders.
- Shadows are effectively absent across most components.
- Floating UI such as cookie banners may use soft separation through border radius and white fill rather than strong shadow.

Guidance:
- Do not rely on shadow hierarchy to define structure.
- Use spacing, borders, and typography for separation first.
- Reserve elevated treatment for transient overlays only, and keep them soft.

# Shapes

Shape language is rounded and friendly, but not playful.

- `sm`: 8px for cards and standard surfaces
- `md`: 16px for larger UI containers, where needed
- `lg`: 28px for prominent panels
- `xl`: 56px for pill buttons and hero framing
- `full`: fully rounded control geometry

Guidance:
- Buttons should be pill-shaped.
- Cards should use small-radius corners.
- Large promotional containers may use visibly rounded corners, especially in hero imagery.
- Avoid sharp corners on interactive primary controls.

# Components

## Button
Primary and secondary buttons share the same pill geometry and sizing.

- Height: 56px
- Padding: 16px 32px
- Font: Coinbase Sans, 18px, semibold
- Radius: 56px
- No shadow

Use primary buttons for the main conversion action only. Use secondary buttons for low-emphasis actions that still need affordance. Use link buttons for tertiary navigation and legal utilities.

## Card
Cards are neutral containers with a 1px border and no shadow.

- Background: white
- Border: `#e5e7eb`
- Radius: 8px
- Padding: 16px

Use cards for contained informational modules, pricing, and compact content blocks.

## Navigation
The global nav is minimal:
- Logo at far left
- High-level categories centered or left-aligned in a single row
- Search and utility icons near the right
- Sign in / Sign up actions at the far right

Keep nav items short and readable. Make the strongest CTA visually dominant.

## Hero
The homepage hero typically combines:
- Large display headline
- One short supporting sentence
- A second promotional sentence
- Email field plus signup button
- Large product visual

Guidance:
- Keep the headline to 1–2 lines.
- Keep supporting copy short and direct.
- Place the email field before the CTA button in desktop layouts when space allows.
- Use blue for the CTA and reserve other accents for product visuals.

## Form fields
Inputs are light, neutral, and unobtrusive.

Guidance:
- Use white backgrounds and subtle borders.
- Prefer large, easy-to-scan entry targets.
- Keep placeholder text informative but not instructional-heavy.
- Pair with adjacent pill CTA buttons.

## Cookie consent banner
A fixed consent panel appears in the lower-right with:
- White surface
- Rounded corners
- Short explanatory text
- Two actions: Reject and Accept

Guidance:
- Keep consent copy concise.
- Use clear, equally visible choices.
- Do not block the primary page narrative more than necessary.

# Do's and Don'ts

## Do
- Do use `#0052ff` for the main CTA in a view.
- Do keep headlines large, confident, and sparse.
- Do use white space to create trust and reduce visual noise.
- Do keep charts and product visuals crisp and data-centric.
- Do use small, neutral borders instead of shadows for containers.
- Do keep legal and compliance text present but low-emphasis.
- Do use pill buttons for prominent actions.

## Don't
- Don't introduce additional brand colors as dominant UI accents.
- Don't use dense multi-color gradients in standard layouts.
- Don't rely on drop shadows to indicate hierarchy.
- Don't make body copy bold by default.
- Don't over-round cards; reserve full pill rounding for actions.
- Don't add decorative borders, patterns, or textures.
- Don't place more than one primary CTA at the same visual weight in a single hero.
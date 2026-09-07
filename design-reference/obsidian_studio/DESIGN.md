---
name: Obsidian Studio
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#2fd9f4'
  on-tertiary: '#00363e'
  tertiary-container: '#00b7cf'
  on-tertiary-container: '#00434d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#a2eeff'
  tertiary-fixed-dim: '#2fd9f4'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  sidebar-width: 18rem
  inspector-width: 22rem
  gutter: 1rem
  margin-screen: 1.5rem
---

## Brand & Style

This design system embodies the focused, cinematic energy of a state-of-the-art production control suite. Tailored for creators, investigative video essayists, and automated documentary directors, the atmosphere is calibrated for deep focus and high-precision orchestration.

The aesthetic fuses **Modern Glassmorphism** with **Futuristic SaaS Precision**:
- **Atmospheric & Submerged:** Deep void backgrounds eliminate visual fatigue while framing complex timelines, node graphs, and narrative pipelines with cinematic gravitas.
- **Luminescent Energy:** Neon cyan and electric violet micro-glows serve functional and navigational roles, highlighting active nodes, rendering phases, and primary generation triggers.
- **Engineered Finesse:** Hairline borders, precise grid geometry, and glassy translucent layers replicate high-end non-linear editing (NLE) workstations and high-throughput creative consoles.

## Colors

The palette establishes hierarchical depth through deep obsidian values punctuated by controlled radiant accents:

- **Base Surfaces:**
  - Canvas / Background: `#0B0F17` (Deep Obsidian Void)
  - Surface Low: `#111827` (Container Foundations, Collapsed Sidebars)
  - Surface Medium / Glass: `rgba(22, 31, 48, 0.72)` (Panels, Inspector Windows)
  - Surface Elevated: `rgba(30, 41, 59, 0.85)` (Flyouts, Popovers, Active Nodes)
- **Structural Accents:**
  - Borders & Dividers: `#2E3B52` (Hairline boundary control at 1px)
  - Border Glow Hover: `rgba(6, 182, 212, 0.45)`
- **Accents & Illuminations:**
  - Primary (Cyan Dynamic): `#06B6D4` with secondary highlight `#22D3EE` for timeline progress, primary CTAs, and active audio tracks.
  - Secondary (Electric Violet): `#8B5CF6` with highlight `#A855F7` for script generation, AI narrative nodes, and voice synthesis modules.
  - Interactive Dual Glow: Radial/linear gradient combinations shifting from `#06B6D4` through `#8B5CF6`.
- **Text & Foreground:**
  - Primary Text: `#F8FAFC`
  - Secondary Text: `#94A3B8`
  - Muted / Metadata: `#64748B`

## Typography

The typography strategy reflects high-precision editing and storytelling balance:

- **Display & Headings (Space Grotesk):** Provides structured, geometric, and technical authority. It signals technological innovation across section banners, documentary title cards, and modal headers.
- **Content & UI Text (Geist):** Delivers clean readability across dense property inspectors, script dialogue blocks, and asset management trees.
- **Telemetry & Technical Indicators (JetBrains Mono):** Dedicated to SMPTE timecodes, frame counters, bitrate values, prompt token counts, and layer keys, maintaining rigid columnar alignment.

## Layout & Spacing

The workspace uses a dense, ergonomic workstation grid tailored to multi-pane content assembly:

- **Layout Structure:**
  - **Docked Canvas Architecture:** Multi-column workspace featuring a collapsible navigation rail, multi-track timeline baseboard, modular viewport canvas, and contextual inspector sidebar.
  - **Grid System:** Strict 8px modular cadence (`0.5rem` stepping) with micro-adjustments at 4px (`0.25rem`) for toolbar clusters and icon grouping.
- **Form Factor Adaptations:**
  - **Desktop (≥ 1280px):** 3-column split view (Media Assets / Sequencer & Canvas / Inspector). Fixed panels with dynamic scroll containers.
  - **Tablet (768px - 1279px):** Inspector transforms into a sliding off-canvas sheet; timeline collapses into condensed chapter markers.
  - **Mobile (< 768px):** Single-column stacked mode focusing strictly on telemetry review, script revisions, and render status tracking.

## Elevation & Depth

Visual depth is achieved through layered translucency, frosted diffusion, and luminescent backlights rather than muddy drop shadows:

- **Base Plane (Z-0):** Unlit background canvas (`#0B0F17`) textured with an optional faint sub-pixel grid line overlay (`rgba(46, 59, 82, 0.15)`).
- **Glassmorphism Panels (Z-10):** Background `rgba(22, 31, 48, 0.72)` paired with `backdrop-filter: blur(16px)` and a crisp `1px solid #2E3B52` perimeter border.
- **Overlay Sheets & Drawers (Z-20):** Background `rgba(30, 41, 59, 0.9)` paired with `backdrop-filter: blur(24px)` and box shadow `0 20px 40px -15px rgba(0, 0, 0, 0.8)`.
- **Glow Signifiers:** Active elements project outer ambient glows:
  - Cyan Radiance: `0 0 24px -4px rgba(6, 182, 212, 0.35)`
  - Violet Radiance: `0 0 24px -4px rgba(139, 92, 246, 0.35)`
  - Dual Active Glow: Combined gradient halo used exclusively for primary render triggers and highlighted narrative nodes.

## Shapes

The design system maintains a **Soft (1)** shape language (`0.25rem` / 4px base radius) to evoke the surgical precision of enterprise production hardware:

- **Tooling, Inputs, and Timeline Clips:** 4px radius (`0.25rem`). Sharp enough to preserve data density, soft enough to avoid harsh pixel aliasing.
- **Glass Surface Panels & Modals:** 8px radius (`0.5rem`, `rounded-lg`). Gives structure to floating canvas modules without sacrificing screen real estate.
- **Action Pills & Badges:** Rounded full-pill shapes are strictly reserved for live status indicators (e.g., "Rendering", "Ready", "Syncing").

## Components

### Buttons & Actions
- **Primary Studio CTA:** Gradient fill `linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%)`, text `#F8FAFC` in Space Grotesk 600. Outer dynamic shadow `0 0 16px rgba(6, 182, 212, 0.4)`. Expands on hover with brightness bump (110%).
- **Secondary / Ghost:** Glass surface `rgba(22, 31, 48, 0.6)`, border `1px solid #2E3B52`, text `#94A3B8`. Hover states introduce `#22D3EE` border tinting and pure white text.
- **Icon Utility Actions:** 32x32px square buttons, `border-radius: 4px`, subtle hover background `rgba(46, 59, 82, 0.4)`.

### Inputs & Text Areas
- **Dark Studio Fields:** Background `rgba(17, 24, 39, 0.85)`, border `1px solid #2E3B52`, text `#F8FAFC`. Focus ring transition triggers `1px solid #06B6D4` paired with an inner glow `0 0 8px rgba(6, 182, 212, 0.2)`.
- **Prompt & Narrative Editors:** Monospace annotations, syntax-colored character counters in JetBrains Mono (`#64748B`), and floating toolbars with frosted glass backdrops.

### Cards & Workflow Nodes
- **Documentary Chapter Cards:** Frosted background (`rgba(22, 31, 48, 0.72)`), subtle `1px solid #2E3B52` frame. Features a 16:9 media thumbnail overlay, integrated timecode chip, and an accent bar along the top edge representing the active phase (Script = Violet, Audio = Cyan, B-Roll = Slate).

### Selection & State Controls
- **Checkboxes & Radios:** Custom 16px square/circle boxes with `border: 1px solid #2E3B52`. Checked state fills with cyan `#06B6D4` and casts a subtle cyan glow.
- **Chips & Tags:** Compact height (24px), font JetBrains Mono, border `1px solid #2E3B52`, background `rgba(11, 15, 23, 0.6)`. Active state triggers cyan/violet text highlights.

### Specialized Studio Components
- **Multi-Track Timeline Clip:** Block containers with horizontal drag handles, hairline waveform renderings in `#22D3EE`, and active selection borders glowing in `#8B5CF6`.
- **Render Progress HUD:** Dual-color segmented progress bar filling from `#06B6D4` through `#8B5CF6` with a traveling pulse highlight.
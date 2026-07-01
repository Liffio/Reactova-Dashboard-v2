# Brand Kit — Client-v2 Design System

Extracted directly from `src/styles.css`, `components.json`, and `public/` — reflects the actual shipped design tokens, not a proposal.

---

## Logo & Marks

| Asset | Path | Use |
|---|---|---|
| Primary logo | `public/logo.png` | Default logo, light backgrounds |
| Logo (light variant) | `public/logo-light.png` | For dark backgrounds |
| Colored wordmark | `public/colored.png` | Full-color marketing use |
| Dark artwork | `public/dark.png` | Dark-theme hero/marketing art |
| Light artwork | `public/light.png` | Light-theme hero/marketing art |
| Favicon | `public/favicon.ico` | Browser tab (light) |
| Favicon (dark) | `public/favicon-dark.ico` | Browser tab (dark mode) |
| User avatar placeholder | `public/user.png` | Default user avatar |

---

## Typography

| Role | Font | CSS var | Fallback stack |
|---|---|---|---|
| Body / UI | **Inter** | `--font-sans` | `ui-sans-serif, system-ui, sans-serif` |
| Headings (`h1–h4`, `.font-display`) | **Space Grotesk** | `--font-display` | `ui-sans-serif, system-ui, sans-serif` |
| Code / mono | **JetBrains Mono** | `--font-mono` | `ui-monospace, monospace` |

Headings use `letter-spacing: -0.02em` for a tighter, display-style look.

---

## Color Palette (hex, derived from OKLCH source of truth)

Colors are authored in OKLCH in code (for perceptual consistency across light/dark). Hex values below are the rendered sRGB output — use hex for static assets (Figma, slides, print); use the OKLCH values in code.

### Light mode

| Token | Hex | OKLCH (source) |
|---|---|---|
| Background | `#FBF9F5` | `oklch(0.982 0.005 80)` |
| Foreground (text) | `#160A08` | `oklch(0.16 0.022 30)` |
| Card | `#FFFFFF` | `oklch(1 0 0)` |
| **Primary** (brand) | **`#F5184C`** | `oklch(0.62 0.24 18)` |
| Primary foreground | `#FEFBF8` | `oklch(0.99 0.005 80)` |
| Secondary | `#F5EEE7` | `oklch(0.952 0.012 70)` |
| Secondary foreground | `#1F1210` | `oklch(0.20 0.022 30)` |
| Muted | `#F3EEE8` | `oklch(0.952 0.010 72)` |
| Muted foreground | `#625551` | `oklch(0.46 0.018 35)` |
| Accent (green) | `#D5F1D5` | `oklch(0.93 0.048 145)` |
| Accent foreground | `#012D07` | `oklch(0.26 0.08 145)` |
| Destructive | `#DF1E39` | `oklch(0.58 0.22 22)` |
| Success | `#03A14A` | `oklch(0.62 0.17 150)` |
| Warning | `#E8A200` | `oklch(0.76 0.16 78)` |
| Border / Input | `#E2DDD7` | `oklch(0.90 0.010 70)` |
| Sidebar | `#F8F4ED` | `oklch(0.968 0.010 76)` |

### Dark mode

| Token | Hex | OKLCH (source) |
|---|---|---|
| Background (zinc-950) | `#030406` | `oklch(0.108 0.006 252)` |
| Card (zinc-900) | `#0B0D10` | `oklch(0.158 0.007 252)` |
| Popover (zinc-850) | `#121518` | `oklch(0.192 0.008 252)` |
| Foreground | `#F5F3F0` | `oklch(0.965 0.005 85)` |
| **Primary** (brand, brighter) | **`#FF5F67`** | `oklch(0.735 0.22 22)` |
| Primary foreground | `#030305` | `oklch(0.10 0.006 252)` |
| Secondary | `#181B1F` | `oklch(0.222 0.008 252)` |
| Muted | `#141619` | `oklch(0.200 0.007 252)` |
| Muted foreground | `#6F7379` | `oklch(0.555 0.010 252)` |
| Accent (teal) | `#002828` | `oklch(0.245 0.052 195)` |
| Accent foreground | `#83EAD9` | `oklch(0.87 0.10 182)` |
| Destructive | `#F53A51` | `oklch(0.64 0.22 20)` |
| Success | `#28BC5E` | `oklch(0.70 0.18 150)` |
| Warning | `#FDB600` | `oklch(0.82 0.18 82)` |
| Border | `#23262A` | `oklch(0.268 0.008 252)` |
| Sidebar | `#060709` | `oklch(0.130 0.006 252)` |

### Chart / data-viz palette (mode-independent hue targets, light values shown)

| | Hex | OKLCH |
|---|---|---|
| Chart 1 | `#F5184C` | `oklch(0.62 0.24 18)` |
| Chart 2 | `#EE7A1F` | `oklch(0.70 0.17 52)` |
| Chart 3 | `#AD36A7` | `oklch(0.55 0.20 330)` |
| Chart 4 | `#2EA957` | `oklch(0.65 0.16 150)` |
| Chart 5 | `#0F74C5` | `oklch(0.55 0.15 250)` |

### Brand gradient (fixed — identical in light & dark)

```css
linear-gradient(135deg, #FF7C49 0%, #F5184C 50%, #B20D8F 100%)
/* oklch(0.74 0.18 40) → oklch(0.62 0.24 18) → oklch(0.52 0.22 340) */
```
Used via utilities `bg-brand-gradient` and `text-brand-gradient` (gradient text clip).

> Note: code comments call the primary "orange," but at hue 18/chroma 0.24 the rendered color is a vivid coral-red/pink-red (`#F5184C`), not orange — the gradient sweeps from orange (`#FF7C49`) through this coral-red into magenta (`#B20D8F`). Treat `#F5184C` as the true primary swatch.

---

## Elevation & Shape

- **Border radius scale** — base `--radius: 0.75rem` (12px), derived: `sm` 8px, `md` 10px, `lg` 12px, `xl` 16px, `2xl` 20px, `3xl` 24px.
- **Shadows** (3-tier system, values shift between light/dark for correct contrast):
  - `shadow-soft` — ambient resting shadow
  - `shadow-glow` — primary-color glow ring, used for interactive/hover emphasis
  - `shadow-card` — default card elevation
- **Soft background gradient** (`--gradient-soft`) — subtle diagonal wash behind hero/card sections, distinct per mode.

---

## Design System Base

- Component library: **shadcn/ui**, style = `new-york`, base color = `slate`, icons = `lucide-react`
- Tailwind v4 (CSS-first `@theme inline` config, no `tailwind.config.js`)
- All color tokens defined once as CSS custom properties in `:root` / `.dark` and mapped into Tailwind's theme — changing brand color only requires editing `src/styles.css`.

---

## Quick-reference swatch strip

```
Primary       #F5184C  (dark: #FF5F67)
Destructive   #DF1E39  (dark: #F53A51)
Success       #03A14A  (dark: #28BC5E)
Warning       #E8A200  (dark: #FDB600)
Accent        #D5F1D5 / #012D07  (dark: #002828 / #83EAD9)
Gradient      #FF7C49 → #F5184C → #B20D8F
```

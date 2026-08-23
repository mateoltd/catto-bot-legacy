# Dashboard Design System

Cyberpunk-neon aesthetic with glassmorphism effects. Dark mode only.

## Color Palette

### Primary Colors

| Token      | HSL           | Hex       | Usage                |
| ---------- | ------------- | --------- | -------------------- |
| Background | `220 50% 6%`  | `#0a0f1a` | Main page background |
| Foreground | `225 30% 97%` | `#f0f4ff` | Primary text         |
| Muted      | `215 20% 70%` | `#a0b0d0` | Secondary text       |

### Accent Colors

| Token       | HSL            | Hex       | Usage                  |
| ----------- | -------------- | --------- | ---------------------- |
| Primary     | `210 100% 55%` | `#1a8cff` | Buttons, active states |
| Secondary   | `185 80% 45%`  | `#17b8c2` | Secondary accents      |
| Destructive | `0 85% 55%`    | `#ef4444` | Error states           |
| Success     | `145 80% 45%`  | `#16a34a` | Positive indicators    |
| Warning     | `38 92% 50%`   | `#f59e0b` | Warning states         |

### Surface Colors

| Token  | HSL           | Hex       | Usage             |
| ------ | ------------- | --------- | ----------------- |
| Card   | `222 40% 8%`  | `#111827` | Card backgrounds  |
| Border | `222 30% 18%` | `#2a3548` | Borders           |
| Input  | `222 30% 12%` | `#171f2e` | Input backgrounds |

## Typography

- **Primary Font**: Inter
- **Monospace**: JetBrains Mono

## Component Variants

### Button

| Variant       | Usage                       |
| ------------- | --------------------------- |
| `default`     | Primary actions (neon blue) |
| `secondary`   | Secondary actions           |
| `ghost`       | Subtle actions              |
| `outline`     | Bordered buttons            |
| `neon`        | Emphasized CTAs with glow   |
| `destructive` | Danger actions              |

### Card

| Variant        | Usage                    |
| -------------- | ------------------------ |
| `default`      | Standard card            |
| `glass`        | Glassmorphism with blur  |
| `glass-strong` | More opaque glass effect |
| `neon`         | Glowing border accent    |

### Input

| Variant   | Usage              |
| --------- | ------------------ |
| `default` | Standard input     |
| `pill`    | Rounded pill shape |
| `ghost`   | Minimal styling    |

## CSS Utilities

### Glassmorphism

```css
.glass {
  background: rgba(17, 24, 39, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(42, 53, 72, 0.5);
}
```

### Neon Glow

```css
.glow-blue {
  box-shadow:
    0 0 5px rgba(26, 140, 255, 0.3),
    0 0 20px rgba(26, 140, 255, 0.2),
    0 0 40px rgba(26, 140, 255, 0.1);
}
```

### Animations

- `hover-scale` - Scale up on hover (1.02)
- `animate-float` - Floating background elements
- `animate-fade-in` - Fade in on mount

## Layout Patterns

### Guild Page Layout

- Sticky header with guild info
- Sidebar navigation (280px desktop)
- Main content area
- Active nav item has left border indicator

### Form Sections

- Use `Card variant="glass"` for sections
- Group related fields together
- Use `Switch` for enable/disable toggles
- Primary action button at bottom with `variant="neon"`

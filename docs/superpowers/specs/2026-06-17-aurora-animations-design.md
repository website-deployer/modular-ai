# Aurora Animation System — Design Spec

**Date:** 2026-06-17
**Scope:** 4 visual enhancement zones across the Modular AI app, using a unified "aurora mesh" aesthetic.
**Approach:** Framer Motion for orchestration (mount/unmount transitions, shimmer sequencing) + pure CSS for visual effects (gradient blobs, orb drifts, breathing).

## Visual Language

A single motif reused everywhere:

| Token | Value | Usage |
|---|---|---|
| `--aurora-lime` | `radial-gradient(circle, rgba(196,242,13,.7), transparent 65%)` | Primary blob, shimmer tint |
| `--aurora-violet` | `radial-gradient(circle, rgba(120,119,255,.6), transparent 65%)` | Secondary blob |
| `--aurora-cyan` | `radial-gradient(circle, rgba(34,211,238,.5), transparent 65%)` | Tertiary blob |
| Drift speed | 7–9s `ease-in-out infinite` | Slow, dreamy float |
| Blur radius | 36–40px | Soft, out-of-focus edges |

All aurora blobs are `<div>` elements with these radial-gradient backgrounds, positioned absolutely, with `filter: blur(36px)` and CSS keyframe drift. They never use a canvas or WebGL.

## Accessibility

Every animation is wrapped in a `@media (prefers-reduced-motion: reduce)` block that sets `animation: none` and `transition: none`. The splash still shows the wordmark (no animation), but exits immediately without a fade. Shimmer skeletons become static grey bars.

## New Components

### 1. `<BootSplash />` — `components/BootSplash.tsx`

**Replaces:** `App.tsx:297` — `if (!isLoaded) return null`

**What it renders:**
- Full-screen overlay (`position: fixed; inset: 0; z-index: 9999; background: #09090b`)
- Three aurora blobs (lime, violet, cyan) at ~55% opacity, drifting via CSS keyframes (`aurora-drift-1/2/3`)
- Centered wordmark: `modular.ai` in Space Grotesk 700, 22px. The dot uses `--theme-color`
- Below the wordmark: a progress bar (120×3px, `rgba(255,255,255,.1)` track, lime fill sliding left→right via CSS keyframe `shimmer-slide`, 1.4s loop)

**Exit animation (Framer Motion):**
```
<AnimatePresence>
  {!isLoaded && <BootSplash />}
</AnimatePresence>
```
The component itself uses `motion.div` with `exit={{ opacity: 0, y: -20 }}` and `transition={{ duration: 0.5, ease: "easeInOut" }}`. Once `isLoaded` flips to `true`, AnimatePresence animates it out before unmounting.

**Props:** none (reads nothing from parent; gated by AnimatePresence conditional).

### 2. `<AmbientAurora />` — `components/AmbientAurora.tsx`

**Mounted in:** `App.tsx`, as a direct child of the root `<div>`, rendered unconditionally.

**What it renders:**
- A `position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0` container.
- Three aurora blobs at **reduced opacity** (`opacity: 0.05`) and **slower drift** (12–15s cycles). The existing dotted-grid `.neon-grid` background stays as-is on the root div — AmbientAurora is layered behind it.
- The content views already sit at higher z-index by default (they're flex children, not absolutely positioned).

**No Framer Motion.** This is pure CSS — it mounts once and never unmounts. The low opacity ensures it adds atmosphere without competing with content.

### 3. `<ThinkingOrbs />` — `components/ThinkingOrbs.tsx`

**Replaces:** The 3-dot bouncing block in `ChatInterface.tsx:173–184` and `AnalysisView.tsx:578–589`.

**What it renders:**
- Three 9×9px circles, each a different color (lime, violet, cyan), each with a matching `box-shadow` glow.
- A single CSS keyframe `orb-bob` (`translateY(0)` → `translateY(-7px)`, 1.4s `ease-in-out infinite`) applied to all three with staggered `animation-delay` (0s, 0.18s, 0.36s).
- An optional `label` prop for the "thinking…" text (ChatInterface uses it, AnalysisView doesn't since it has its own icon row).

**Props:**
- `label?: string` — text shown to the right of the orbs (default: none).

**Container:** matches the parent's existing flex layout (`display: flex; align-items: center; gap: 6px`). The component returns just the orbs + label; the avatar/icon wrapper stays in the parent.

### 4. `<Skeleton />` — `components/Skeleton.tsx`

**Two variants** (via props):

**Bar variant** (default): A single line placeholder.
- Props: `width?: string` (default `"60%"`), `className?: string`.
- Renders: `<motion.div>` with `height: 10px`, `border-radius: 6px`, `background: rgba(255,255,255,0.07)`.
- Shimmer: FM `motion.div` child with `position: absolute; inset: 0`, animated via `useAnimation()` — `x` sweeps from `-100%` to `100%` over 1.8s, `repeat: Infinity`, `ease: "easeInOut"`. Background: `linear-gradient(100deg, transparent 20%, rgba(var(--theme-rgb), 0.10) 45%, transparent 70%)`.

**Card variant** (for Library): `variant="card"`.
- Props: `lines?: number` (default 2).
- Renders: A card-shaped container (`border-radius: 12px; padding: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02)`) with N `Skeleton` bars inside. Each line has a random-ish width (first line 60%, others 90%).

**Usage in LibraryView:** Not gated on a loading state (notes render immediately from IndexedDB). Instead, used as a placeholder during the upload/import flow when `uploadStatus` is `'analyzing'` — replacing the current text indicator.

**Usage in EditorView:** Replaces `"Loading PDF..."` text at `EditorView.tsx:376` with two `<Skeleton width="40%" />` bars inside the PDF preview container.

## Files Modified

### `index.css`
Add these keyframe blocks:
```css
/* Aurora blob drift (boot splash) */
@keyframes aurora-drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, -30px) scale(1.1); }
}
@keyframes aurora-drift-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30px, 40px) scale(1.15); }
}
@keyframes aurora-drift-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -40px) scale(0.9); }
}

/* Splash progress bar sweep */
@keyframes shimmer-slide {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}

/* Thinking orbs bob */
@keyframes orb-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

/* Reduced motion: kill all custom animations */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### `App.tsx`
- Add imports: `motion, AnimatePresence` from `framer-motion`, `BootSplash`, `AmbientAurora`.
- Replace line 297 (`if (!isLoaded) return null`) with:
  ```tsx
  return (
    <div className="..." style={...}>
      <AnimatePresence>
        {!isLoaded && <BootSplash />}
      </AnimatePresence>
      <AmbientAurora />
      <Sidebar ... />
      {renderView()}
      ...
    </div>
  );
  ```
- The `position: relative` class should be added to the root div so `AmbientAurora`'s absolute positioning is scoped correctly.

### `components/ChatInterface.tsx`
- Replace lines 173–184 (the `{loading && (...)}` block containing 3 bouncing dots) with:
  ```tsx
  {loading && (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10">
        <span className="material-symbols-outlined text-xs text-[var(--theme-color)]">smart_toy</span>
      </div>
      <ThinkingOrbs label="thinking…" />
    </div>
  )}
  ```

### `views/AnalysisView.tsx`
- Replace lines 578–589 (the `{loading && (...)}` block containing the analytics icon + 3 bouncing dots) with:
  ```tsx
  {loading && (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-base text-[var(--theme-color)] animate-pulse">analytics</span>
      </div>
      <ThinkingOrbs />
    </div>
  )}
  ```

### `views/EditorView.tsx`
- Replace line 376 (`<div className="text-neutral-500">Loading PDF...</div>`) with:
  ```tsx
  <div className="flex flex-col gap-2.5 p-2">
    <Skeleton width="40%" />
    <Skeleton width="80%" />
  </div>
  ```

### `views/LibraryView.tsx`
- Import `Skeleton`.
- In the `uploadStatus === 'analyzing'` block (lines 261–272), add a skeleton card below the existing pulsing ring + "Analyzing Content..." text. Insert after line 270 (`<p className="text-neutral-400 text-sm mt-2">...`) and before the closing `</>`:
  ```tsx
  <div className="mt-4 w-full max-w-sm mx-auto">
    <Skeleton variant="card" lines={2} />
  </div>
  ```
  This gives the user a preview of the note card that will appear when analysis completes, while the existing text indicator explains what's happening.

### `package.json`
- Add `"framer-motion": "^12"` to `dependencies`.

## What's Explicitly Out of Scope

- Card hover tilt / micro-interactions (user explicitly rejected).
- Three.js or any WebGL (user chose "polished 2.5D, no heavy deps" before selecting framer-motion).
- View-to-view transitions (could be a future addition with AnimatePresence, but adds complexity for marginal value right now).
- Modal animations (UpgradeModal, StorageQuotaModal) — existing behavior is fine, not part of this pass.
- Mobile-specific adaptations — the CSS effects are responsive by nature (percentage-based, blurred gradients).

## Bundle Impact

- `framer-motion`: ~50KB gzipped (tree-shaken, only `motion`, `AnimatePresence`, `useAnimation` imported).
- Zero additional CSS libraries.
- CSS keyframes: ~40 lines added to `index.css`.
- 4 new component files, each < 60 lines.

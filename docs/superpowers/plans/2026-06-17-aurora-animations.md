# Aurora Animation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified "aurora mesh" animation system (boot splash, ambient background, AI thinking indicator, content skeletons) across the Modular AI app using framer-motion for orchestration + pure CSS for visuals.

**Architecture:** Four new React components (`BootSplash`, `AmbientAurora`, `ThinkingOrbs`, `Skeleton`), each with a single clear responsibility. CSS keyframes for blob drifts, orb bobs, and shimmer sweeps live in `index.css`. Framer Motion handles mount/unmount transitions (splash exit) and shimmer sequencing. All components respect `prefers-reduced-motion`.

**Tech Stack:** React 18, Vite, Tailwind v4, framer-motion (~50KB gz), pure CSS keyframes

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `framer-motion` dependency |
| `index.css` | Modify | Aurora drift keyframes, orb bob, shimmer slide, reduced-motion override |
| `components/BootSplash.tsx` | Create | Full-screen splash with aurora blobs + wordmark + progress bar |
| `components/AmbientAurora.tsx` | Create | Dim aurora blobs behind the whole app shell |
| `components/ThinkingOrbs.tsx` | Create | Three glowing bobbing orbs for AI thinking states |
| `components/Skeleton.tsx` | Create | Shimmer bar/card skeleton placeholders |
| `App.tsx` | Modify | Mount `<BootSplash>` via AnimatePresence, mount `<AmbientAurora>` |
| `components/ChatInterface.tsx` | Modify | Replace 3-dot bouncing block with `<ThinkingOrbs>` |
| `views/AnalysisView.tsx` | Modify | Replace 3-dot bouncing block with `<ThinkingOrbs>` |
| `views/EditorView.tsx` | Modify | Replace "Loading PDF..." with `<Skeleton>` bars |
| `views/LibraryView.tsx` | Modify | Add `<Skeleton variant="card">` to upload analyzing state |

---

### Task 1: Install framer-motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install framer-motion**

Run:
```bash
npm install framer-motion
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run lint
```
Expected: clean exit (0 errors). The package is installed but unused, which is fine — no imports yet.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion dependency for animation orchestration"
```

---

### Task 2: Add CSS keyframes and reduced-motion override

**Files:**
- Modify: `index.css`

- [ ] **Step 1: Add aurora and orb keyframes to `index.css`**

Append the following **after the existing `.theme-highlight` rule** (after line 61):

```css
/* ---- Aurora Animation System ---- */

/* Aurora blob drift (boot splash — fast) */
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

/* Ambient blob drift (background — slow) */
@keyframes ambient-drift-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(30px, -20px) scale(1.08); }
}
@keyframes ambient-drift-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-20px, 30px) scale(1.12); }
}
@keyframes ambient-drift-3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(15px, -25px) scale(0.92); }
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

/* Kill all custom animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

- [ ] **Step 2: Verify build succeeds**

Run:
```bash
npm run build
```
Expected: clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add index.css
git commit -m "feat: add aurora CSS keyframes + prefers-reduced-motion override"
```

---

### Task 3: Create `<BootSplash />`

**Files:**
- Create: `components/BootSplash.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { motion } from 'framer-motion';

const BootSplash = () => {
    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b]"
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
            {/* Aurora blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[340px] h-[340px] rounded-full"
                    style={{
                        left: '10%',
                        top: '20%',
                        background: 'radial-gradient(circle, rgba(196,242,13,.7), transparent 65%)',
                        filter: 'blur(36px)',
                        opacity: 0.55,
                        animation: 'aurora-drift-1 7s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute w-[300px] h-[300px] rounded-full"
                    style={{
                        right: '5%',
                        top: '10%',
                        background: 'radial-gradient(circle, rgba(120,119,255,.6), transparent 65%)',
                        filter: 'blur(36px)',
                        opacity: 0.55,
                        animation: 'aurora-drift-2 9s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute w-[260px] h-[260px] rounded-full"
                    style={{
                        left: '40%',
                        bottom: 0,
                        background: 'radial-gradient(circle, rgba(34,211,238,.5), transparent 65%)',
                        filter: 'blur(36px)',
                        opacity: 0.55,
                        animation: 'aurora-drift-3 8s ease-in-out infinite',
                    }}
                />
            </div>

            {/* Wordmark + progress bar */}
            <div className="relative z-10 text-center">
                <h1 className="font-display text-[22px] font-bold tracking-tight">
                    modular<span className="text-[var(--theme-color)]">.</span>ai
                </h1>
                <div className="mt-3.5 mx-auto w-[120px] h-[3px] rounded-full bg-white/10 overflow-hidden">
                    <div
                        className="h-full w-[40%] rounded-full bg-[var(--theme-color)]"
                        style={{ animation: 'shimmer-slide 1.4s ease-in-out infinite' }}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default BootSplash;
```

- [ ] **Step 2: Verify typecheck**

Run:
```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/BootSplash.tsx
git commit -m "feat: add BootSplash component (aurora blobs + wordmark + shimmer bar)"
```

---

### Task 4: Create `<AmbientAurora />`

**Files:**
- Create: `components/AmbientAurora.tsx`

- [ ] **Step 1: Create the component**

```tsx
const AmbientAurora = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div
                className="absolute w-[340px] h-[340px] rounded-full"
                style={{
                    left: '10%',
                    top: '20%',
                    background: 'radial-gradient(circle, rgba(196,242,13,.7), transparent 65%)',
                    filter: 'blur(40px)',
                    opacity: 0.05,
                    animation: 'ambient-drift-1 14s ease-in-out infinite',
                }}
            />
            <div
                className="absolute w-[300px] h-[300px] rounded-full"
                style={{
                    right: '5%',
                    top: '10%',
                    background: 'radial-gradient(circle, rgba(120,119,255,.6), transparent 65%)',
                    filter: 'blur(40px)',
                    opacity: 0.05,
                    animation: 'ambient-drift-2 15s ease-in-out infinite',
                }}
            />
            <div
                className="absolute w-[260px] h-[260px] rounded-full"
                style={{
                    left: '40%',
                    bottom: 0,
                    background: 'radial-gradient(circle, rgba(34,211,238,.5), transparent 65%)',
                    filter: 'blur(40px)',
                    opacity: 0.05,
                    animation: 'ambient-drift-3 12s ease-in-out infinite',
                }}
            />
        </div>
    );
};

export default AmbientAurora;
```

- [ ] **Step 2: Commit**

```bash
git add components/AmbientAurora.tsx
git commit -m "feat: add AmbientAurora component (dim aurora blobs behind app shell)"
```

---

### Task 5: Create `<ThinkingOrbs />`

**Files:**
- Create: `components/ThinkingOrbs.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface ThinkingOrbsProps {
    label?: string;
}

const ThinkingOrbs: React.FC<ThinkingOrbsProps> = ({ label }) => {
    return (
        <div className="flex items-center gap-[6px] mt-1.5">
            <span
                className="w-[9px] h-[9px] rounded-full"
                style={{
                    background: '#c4f20d',
                    boxShadow: '0 0 10px rgba(196,242,13,.8)',
                    animation: 'orb-bob 1.4s ease-in-out infinite',
                }}
            />
            <span
                className="w-[9px] h-[9px] rounded-full"
                style={{
                    background: '#7877ff',
                    boxShadow: '0 0 10px rgba(120,119,255,.8)',
                    animation: 'orb-bob 1.4s ease-in-out 0.18s infinite',
                }}
            />
            <span
                className="w-[9px] h-[9px] rounded-full"
                style={{
                    background: '#22d3ee',
                    boxShadow: '0 0 10px rgba(34,211,238,.8)',
                    animation: 'orb-bob 1.4s ease-in-out 0.36s infinite',
                }}
            />
            {label && (
                <span className="ml-2 text-xs text-neutral-400 font-display">{label}</span>
            )}
        </div>
    );
};

export default ThinkingOrbs;
```

- [ ] **Step 2: Commit**

```bash
git add components/ThinkingOrbs.tsx
git commit -m "feat: add ThinkingOrbs component (lime/violet/cyan bobbing orbs)"
```

---

### Task 6: Create `<Skeleton />`

**Files:**
- Create: `components/Skeleton.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';

interface SkeletonProps {
    width?: string;
    className?: string;
    variant?: 'bar' | 'card';
    lines?: number;
}

const SkeletonBar: React.FC<Pick<SkeletonProps, 'width' | 'className'>> = ({ width = '60%', className = '' }) => {
    const shimmer = useAnimation();

    useEffect(() => {
        shimmer.start({
            x: ['-100%', '100%'],
            transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
        });
    }, [shimmer]);

    return (
        <div className={`relative h-[10px] rounded-md bg-white/[.07] ${className}`} style={{ width }}>
            <motion.div
                className="absolute inset-0 rounded-md"
                animate={shimmer}
                style={{
                    background: 'linear-gradient(100deg, transparent 20%, rgba(var(--theme-rgb), 0.10) 45%, transparent 70%)',
                }}
            />
        </div>
    );
};

const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 2 }) => {
    const widths = ['60%', '90%', '80%', '70%'];

    return (
        <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-3.5">
            {Array.from({ length: lines }, (_, i) => (
                <SkeletonBar key={i} width={widths[i % widths.length]} className={i > 0 ? 'mt-2' : ''} />
            ))}
        </div>
    );
};

const Skeleton: React.FC<SkeletonProps> = ({ width, className, variant = 'bar', lines }) => {
    if (variant === 'card') return <SkeletonCard lines={lines} />;
    return <SkeletonBar width={width} className={className} />;
};

export default Skeleton;
```

- [ ] **Step 2: Verify typecheck**

Run:
```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/Skeleton.tsx
git commit -m "feat: add Skeleton component (shimmer bar + card variants)"
```

---

### Task 7: Wire BootSplash + AmbientAurora into `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add imports**

At the top of `App.tsx`, add these imports alongside the existing ones:

```tsx
import { AnimatePresence } from 'framer-motion';
import BootSplash from './components/BootSplash';
import AmbientAurora from './components/AmbientAurora';
```

- [ ] **Step 2: Replace the early return with AnimatePresence**

Replace line 297:
```tsx
if (!isLoaded) return null;
```

With nothing — delete that line entirely. The components will be rendered inline below.

- [ ] **Step 3: Add BootSplash + AmbientAurora to the render tree**

In the return JSX, add `<AnimatePresence>` wrapping `<BootSplash>` and `<AmbientAurora />` as a child of the root div. The root div also needs `relative` positioning for AmbientAurora's absolute children. Find this return:

```tsx
return (
    <div
        className="bg-[#f4f4f5] dark:bg-[#09090b] text-slate-900 dark:text-white font-display overflow-hidden h-screen flex selection:bg-[var(--theme-color)] selection:text-black"
        style={{
            "--theme-color": settings.themeColor,
            "--theme-rgb": hexToRgb(settings.themeColor)
        } as React.CSSProperties}
    >
```

Change the className to add `relative`:
```tsx
        className="relative bg-[#f4f4f5] dark:bg-[#09090b] text-slate-900 dark:text-white font-display overflow-hidden h-screen flex selection:bg-[var(--theme-color)] selection:text-black"
```

Then immediately after that opening `<div>`, add:
```tsx
      <AnimatePresence>
        {!isLoaded && <BootSplash />}
      </AnimatePresence>
      <AmbientAurora />
```

So the full return becomes:
```tsx
  return (
    <div
        className="relative bg-[#f4f4f5] dark:bg-[#09090b] text-slate-900 dark:text-white font-display overflow-hidden h-screen flex selection:bg-[var(--theme-color)] selection:text-black"
        style={{
            "--theme-color": settings.themeColor,
            "--theme-rgb": hexToRgb(settings.themeColor)
        } as React.CSSProperties}
    >
      <AnimatePresence>
        {!isLoaded && <BootSplash />}
      </AnimatePresence>
      <AmbientAurora />
      <Sidebar currentView={currentView} onChangeView={setCurrentView} onUpgrade={() => setShowUpgradeModal(true)} />
      {renderView()}

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      
      <StorageQuotaModal 
        isOpen={showQuotaModal} 
        onClose={() => setShowQuotaModal(false)}
        onClearOldNotes={handleClearOldNotes}
        onClearAllNotes={async () => {
            await handleClearData();
            setShowQuotaModal(false);
        }}
      />

      {/* Global Contextual Text Selector */}
      {selectionData && (currentView === View.EDITOR || currentView === View.ANALYSIS) && (
          <div 
              className="fixed z-[100] animate-in fade-in slide-in-from-bottom-1 duration-150"
              style={{ 
                  left: Math.max(8, Math.min(selectionData.x, window.innerWidth - 260)), 
                  top: Math.max(8, selectionData.y) 
              }}
          >
              <div className="bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-xl rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-2 flex items-center gap-2 max-w-[250px]">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="material-symbols-outlined text-[var(--theme-color)] text-sm shrink-0">format_quote</span>
                      <span className="text-[10px] text-slate-500 dark:text-neutral-400 truncate italic">
                          "{selectionData.text.length > 40 ? selectionData.text.slice(0, 40) + '…' : selectionData.text}"
                      </span>
                  </div>
                  <button
                      onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddToChat();
                      }}
                      className="bg-[var(--theme-color)] text-black px-2.5 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all shrink-0 shadow-md shadow-[var(--theme-color)]/20 whitespace-nowrap"
                  >
                      <span className="material-symbols-outlined text-[12px]">add</span>
                      Add
                  </button>
              </div>
              {/* Arrow pointer */}
              <div className="w-3 h-3 bg-white/90 dark:bg-[#18181b]/90 border-b border-r border-black/10 dark:border-white/10 rotate-45 mx-auto -mt-1.5 relative z-[-1]"></div>
          </div>
      )}
      <Analytics />
    </div>
  );
```

- [ ] **Step 4: Verify typecheck**

Run:
```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 5: Verify visually**

Run:
```bash
npm run dev
```
Expected:
- On page load: full-screen aurora splash with wordmark "modular.ai" + shimmer bar, lasting ~1–2 seconds while IndexedDB initializes, then fades out smoothly.
- After splash exits: very faint aurora blobs visible behind the app shell (squint to see them).
- No blank screen at any point.

- [ ] **Step 6: Commit**

```bash
git add App.tsx
git commit -m "feat: wire BootSplash + AmbientAurora into App shell"
```

---

### Task 8: Replace bouncing dots with `<ThinkingOrbs />` in ChatInterface

**Files:**
- Modify: `components/ChatInterface.tsx`

- [ ] **Step 1: Add import**

Add at the top of `components/ChatInterface.tsx`, after the existing imports:

```tsx
import ThinkingOrbs from './ThinkingOrbs';
```

- [ ] **Step 2: Replace the loading indicator**

Replace the entire block at lines 173–184:

```tsx
                {loading && (
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10">
                            <span className="material-symbols-outlined text-xs text-[var(--theme-color)]">smart_toy</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="w-1 h-1 bg-[var(--theme-color)] rounded-full animate-bounce"></span>
                            <span className="w-1 h-1 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                            <span className="w-1 h-1 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                        </div>
                    </div>
                )}
```

With:

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

- [ ] **Step 3: Commit**

```bash
git add components/ChatInterface.tsx
git commit -m "feat: replace ChatInterface bouncing dots with ThinkingOrbs"
```

---

### Task 9: Replace bouncing dots with `<ThinkingOrbs />` in AnalysisView

**Files:**
- Modify: `views/AnalysisView.tsx`

- [ ] **Step 1: Add import**

Add at the top of `views/AnalysisView.tsx`, after the existing imports:

```tsx
import ThinkingOrbs from '../components/ThinkingOrbs';
```

- [ ] **Step 2: Replace the loading indicator**

Replace the entire block at lines 578–589:

```tsx
                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base text-[var(--theme-color)] animate-pulse">analytics</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-3">
                                <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                                <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                            </div>
                        </div>
                    )}
```

With:

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

- [ ] **Step 3: Commit**

```bash
git add views/AnalysisView.tsx
git commit -m "feat: replace AnalysisView bouncing dots with ThinkingOrbs"
```

---

### Task 10: Replace "Loading PDF..." with Skeleton in EditorView

**Files:**
- Modify: `views/EditorView.tsx`

- [ ] **Step 1: Add import**

Add at the top of `views/EditorView.tsx`, after the existing imports:

```tsx
import Skeleton from '../components/Skeleton';
```

- [ ] **Step 2: Replace the loading text**

Replace line 376:
```tsx
                              <div className="text-neutral-500">Loading PDF...</div>
```

With:
```tsx
                              <div className="flex flex-col gap-2.5 p-2">
                                  <Skeleton width="40%" />
                                  <Skeleton width="80%" />
                              </div>
```

- [ ] **Step 3: Commit**

```bash
git add views/EditorView.tsx
git commit -m "feat: replace EditorView 'Loading PDF...' with Skeleton bars"
```

---

### Task 11: Add Skeleton card to LibraryView upload state

**Files:**
- Modify: `views/LibraryView.tsx`

- [ ] **Step 1: Add import**

Add at the top of `views/LibraryView.tsx`, after the existing imports:

```tsx
import Skeleton from '../components/Skeleton';
```

- [ ] **Step 2: Add skeleton card to analyzing state**

Find the `uploadStatus === 'analyzing'` block (lines 261–272) and add the skeleton after the `<p>` tag. Replace:

```tsx
                        {uploadStatus === 'analyzing' && (
                            <>
                                <div className="relative mb-4">
                                    <div className="w-16 h-16 rounded-full border-4 border-[var(--theme-color)]/30 animate-pulse"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[var(--theme-color)] text-2xl animate-bounce">auto_awesome</span>
                                    </div>
                                </div>
                                <h3 className="text-white font-bold text-lg font-display">Analyzing Content...</h3>
                                <p className="text-neutral-400 text-sm mt-2">Gemini is extracting insights and generating a study guide.</p>
                            </>
                        )}
```

With:

```tsx
                        {uploadStatus === 'analyzing' && (
                            <>
                                <div className="relative mb-4">
                                    <div className="w-16 h-16 rounded-full border-4 border-[var(--theme-color)]/30 animate-pulse"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[var(--theme-color)] text-2xl animate-bounce">auto_awesome</span>
                                    </div>
                                </div>
                                <h3 className="text-white font-bold text-lg font-display">Analyzing Content...</h3>
                                <p className="text-neutral-400 text-sm mt-2">Generating your study guide.</p>
                                <div className="mt-4 w-full max-w-sm mx-auto">
                                    <Skeleton variant="card" lines={2} />
                                </div>
                            </>
                        )}
```

- [ ] **Step 3: Commit**

```bash
git add views/LibraryView.tsx
git commit -m "feat: add Skeleton card to LibraryView upload analyzing state"
```

---

### Task 12: Final build + visual verification

- [ ] **Step 1: Full typecheck**

Run:
```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 2: Production build**

Run:
```bash
npm run build
```
Expected: clean build, no warnings about missing components or CSS.

- [ ] **Step 3: Visual verification checklist**

Run `npm run dev` and verify all four zones:

1. **Boot splash:** Full-screen aurora blobs + "modular.ai" wordmark + shimmer bar → fades out smoothly after ~1s. No blank screen.
2. **Ambient background:** Very faint (squint-level) aurora behind the app shell. Never competes with content.
3. **AI thinking orbs:** Open Analysis view, send a message → three bobbing orbs (lime/violet/cyan) with "thinking…" label. Same in Editor chat.
4. **Skeletons:** Upload a PDF in Library → shimmer skeleton card appears during "Analyzing Content…". In Editor with a slow-loading PDF → shimmer bars instead of "Loading PDF...".

- [ ] **Step 4: Reduced-motion check**

In your OS accessibility settings, enable "Reduce motion". Reload the app. Verify:
- No blob drift, no orb bob, no shimmer sweep.
- Splash still shows wordmark (static) and exits immediately (no fade animation).

- [ ] **Step 5: Commit (if any adjustments were needed)**

```bash
git add -A
git commit -m "feat: aurora animation system — final adjustments"
```

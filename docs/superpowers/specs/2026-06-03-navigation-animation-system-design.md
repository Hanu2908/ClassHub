# Navigation Animation System

> **Goal:** Make ClassHub's navigation feel alive and premium — matching the tactile quality of apps like Telegram — through page transitions and animated navbar indicators.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Animation scope | Navigation feel only (transitions + navbar) | Highest leverage — affects every screen |
| Tab switch animation | Crossfade (opacity) | Matches iOS/Android native tab behavior |
| Push navigation animation | Directional slide from right | Standard drill-down pattern |
| Animation library | Framer Motion (~32KB gzip) | Needed for exit animations, layout animations, spring physics |
| Transition duration | 300ms | Telegram/Material sweet spot — smooth but not sluggish |
| Easing | `cubic-bezier(0.2, 0, 0, 1)` (Material deceleration) | Professional, alive, non-toyish |
| Navbar pill | `layoutId` spring animation | Glides between tabs automatically |
| Navbar icon | Spring pop (1.0 → 1.15 → settle 1.12) | Tactile feedback on tab switch |
| Push view behavior | Full-screen slide, navbar fades out | Clean Telegram-style takeover |

## Architecture

### Two Transition Modes

| Navigation Type | Examples | Animation | Duration |
|---|---|---|---|
| **Tab switch** | Home ↔ Schedule ↔ Notices ↔ Attendance ↔ Profile | Crossfade (opacity 0→1 / 1→0) | 300ms |
| **Push navigation** | Dashboard → Assignments, Schedule → PDF Viewer | Slide from right (enter) / Slide to right (exit) | 300ms |

### Route Classification

**Tab routes (crossfade):**
- `/app/home`
- `/app/schedule`
- `/app/announcements`
- `/app/attendance`
- `/app/profile`
- `/app/cr-command`

**Push routes (slide from right):**
- `/app/assignments`
- `/app/polls`
- `/app/resource-hub`
- `/app/exams`
- `/app/gpa`
- `/app/pdf-viewer`
- `/app/cr/subjects`
- `/app/dev-console`
- `/share-intake`

### New Components

#### 1. `NavigationTransitionContext`

A React context that stores the current transition type (`"crossfade"` | `"slide"`). Updated by:
- `NavBar` — sets `"crossfade"` on tab clicks
- Any `navigate()` call to a push route — sets `"slide"`

Provides a custom `useAnimatedNavigate()` hook that wraps `react-router`'s `navigate()` and auto-sets the transition type based on the target route.

#### 2. `PageTransition` wrapper component

Wraps each route's content. Reads from `NavigationTransitionContext` to select the correct Framer Motion variant:

```tsx
// Crossfade variant
const crossfade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: [0.2, 0, 0, 1] }
};

// Slide variant (forward)
const slideForward = {
  initial: { x: '100%', opacity: 0.5 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '-30%', opacity: 0.5 },
  transition: { duration: 0.3, ease: [0.2, 0, 0, 1] }
};

// Slide variant (back)
const slideBack = {
  initial: { x: '-30%', opacity: 0.5 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '100%', opacity: 0.5 },
  transition: { duration: 0.3, ease: [0.2, 0, 0, 1] }
};
```

#### 3. `AnimatedRoutes` in `App.tsx`

Replaces the raw `<Routes>` with `AnimatePresence` wrapping:

```tsx
<AnimatePresence mode="wait">
  <Routes location={location} key={location.pathname}>
    {/* all routes wrapped in PageTransition */}
  </Routes>
</AnimatePresence>
```

#### 4. Navbar Pill Animation

The `navbar-active-pill` becomes a `motion.div` with `layoutId="nav-pill"`:

```tsx
<motion.div
  className="navbar-active-pill"
  layoutId="nav-pill"
  transition={{ type: "spring", stiffness: 500, damping: 35 }}
/>
```

#### 5. Navbar Icon Pop

Active tab icon wraps in `motion.span`:

```tsx
<motion.span
  className="nav-icon"
  animate={{ scale: isActive ? 1.12 : 1 }}
  transition={{ type: "spring", stiffness: 500, damping: 25 }}
>
  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
</motion.span>
```

## Edge Cases

| Case | Behavior |
|---|---|
| Back navigation on push routes | Slide direction reverses (slide to right) |
| Direct URL entry / page refresh | No transition — page appears instantly (initial render has no exit to animate) |
| Lazy loading (Suspense) | Suspense fallback shows during chunk load, transition plays after mount |
| Rapid tab switching | `mode="wait"` queues transitions; if sluggish during testing, switch to `mode="popLayout"` or add interruption |
| Navbar on push routes | Navbar fades out (opacity 0) when entering a push route, fades back in when returning |

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `package.json` | MODIFY | Add `framer-motion` dependency |
| `src/lib/navigation.tsx` | NEW | `NavigationTransitionContext`, `useAnimatedNavigate`, route classification, `PageTransition` component |
| `src/App.tsx` | MODIFY | Wrap routes in `AnimatePresence`, use `PageTransition`, add context provider |
| `src/components/NavBar.tsx` | MODIFY | Use `motion.div` for pill, `motion.span` for icons, use `useAnimatedNavigate` |
| `src/index.css` | MODIFY | Remove static navbar-active-pill positioning (Framer handles it), add any needed transition utility classes |

## What This Does NOT Include

- Content entrance animations (staggered lists, counter animations) — next phase
- Interaction payoff animations (confetti, ripples) — next phase
- Pull-to-refresh — next phase
- Onboarding/auth flow transitions — could be added later with the same system

## Bundle Impact

- `framer-motion`: ~32KB gzipped (tree-shakeable, we only import `motion`, `AnimatePresence`, `LayoutGroup`)
- No runtime performance concern — Framer Motion uses `transform` and `opacity` (GPU-composited properties only)

# SKIT Exam Portal Integration — Design Specification

## Overview
ClassHub will integrate direct access to the official `https://skitexam.com/` portal, allowing students to access semester results, fill exam forms, and obtain admit cards without leaving the PWA. It avoids storing student credentials or backend scraping (violating security parameters outlined in `AGENTS.md`) by utilizing a full-screen, cross-origin inline frame with network-state fallback guards.

---

## Architectural & UX Flow

### 1. Entry Point
* **Button Location**: Added to the `TOOLS` card in `src/pages/app/ProfilePage.tsx`.
* **Button Label**: `SKIT Exam Portal`
* **Icon**: `<ExternalLink size={18} color="var(--accent-primary)" />`
* **Route Path**: `/app/skitexam`

### 2. Layout Structure (`src/pages/app/SkitExamPage.tsx`)
* **Shell**: Viewport-restricted container (`height: 100dvh`, `overflow: hidden`) to allow the iframe's internal content to scroll natively without double-scrolling the parent app page.
* **Slim Header (48px height)**:
  * **Left Action**: `✕ Exit` button (icon `X`, size 16) returning users to `/app/profile`.
  * **Center**: Portal Title (`SKIT Exam Portal`) using the small, clean `t-subtitle` style.
  * **Right Action**: `↻ Refresh` button (icon `RotateCw`, size 15) to force-recreate the iframe in case of errors.
* **Iframe**: Full-width, full-height standard `<iframe>` targeting `https://skitexam.com/`.

---

## Technical Behavior & State Management

### 1. Lifecycle State Machine
```typescript
const [isOnline, setIsOnline] = useState(navigator.onLine);
const [isLoading, setIsLoading] = useState(true);
const [isTrouble, setIsTrouble] = useState(false);
const [refreshKey, setRefreshKey] = useState(0);
```

### 2. Loading State & Skeleton
* While `isLoading` is true, a high-fidelity web page skeleton layout (with header, sidebar, and body card shapes) is rendered using ClassHub's hardware-accelerated `.skeleton` background shimmer.
* The `<iframe>` is rendered offscreen or hidden (`opacity: 0`) until the `onLoad` handler triggers, at which point `isLoading` transitions to `false` and the frame is faded in.

### 3. Timeout Warning
* A 6-second `setTimeout` is scheduled whenever the page mounts or the `refreshKey` increments.
* If `isLoading` is still `true` when the timer fires, `isTrouble` is set to `true`, displaying a slide-down banner at the top of the iframe area:
  * *"Connection taking longer than usual. Open portal in new window?"*
  * Clicking the button launches `https://skitexam.com/` in a new browser tab (`target="_blank"`).

### 4. Offline State Handling
* Event listeners monitor `window.addEventListener('offline')` and `window.addEventListener('online')`.
* If the student is offline (`isOnline === false`), the iframe and skeletons are hidden, and a centered glassmorphic alert is displayed:
  * **Icon**: `<AlertCircle size={32} color="var(--status-warning)" />`
  * **Message**: *"No connection found. The exam portal requires internet access."*
  * **Button**: *"Retry Connection"* (checks network connectivity and restarts the iframe mount).

---

## Security & Privacy Considerations

* **Zero Credential Storage**: No username, password, or cookies are handled, intercepted, or saved by ClassHub's servers or local state.
* **No Sandboxing Over-Restriction**: To maintain compatibility with the exam portal's dynamic download generation (admit cards/results) and redirects, the iframe is kept standard (no `sandbox` attribute) as the primary option, but isolated within the `/app/skitexam` client-side route.

---

## Verification Plan

### Manual Verification
1. **Desktop / Mobile Frame Sizing**: Inspect layout in mobile view and confirm the iframe takes exactly `calc(100vh - 48px)` height, with no double horizontal or vertical scrollbars on the parent container.
2. **Refresh & Exit Operations**: Confirm clicking `Refresh` forces a reload, and `Exit` successfully redirects back to the Profile page.
3. **Loading & Timeout Test**: Use Chrome DevTools network throttling (e.g. "Slow 3G") to confirm the skeleton shimmer displays, and the "Taking too long?" banner correctly triggers after 6 seconds.
4. **Offline Resilience**: Turn off Wi-Fi/cellular connection (or toggle "Offline" in DevTools Network settings) to verify the custom offline card renders. Turn internet back on and click "Retry Connection" to confirm the portal successfully loads.

# Design Specification: PWA Optimization & Automatic Hybrid Install Prompt

This specification outlines the complete PWA overhaul for ClassHub. It implements robust production-grade offline caching via Workbox and `vite-plugin-pwa`, establishes zero-latency tactile touch interactions by removing webkit click overlays, and builds a smart, premium automatic install prompt banner that functions cross-platform (Android, Chrome, and iOS Safari).

---

## 🎨 Design Goals & Interactive Enhancements

### 1. Zero-Latency Touch Feel (Tactile Feedback)
- **Problem**: Mobile browsers overlay a generic blue selection box when clicking or tapping interactive panels, buttons, or cards, breaking the native app-like experience.
- **Remedy**: Eliminate the tap highlight globally on all elements using standard CSS, while preserving user input selection in text boxes.
- **Long-Press Control**: Prevent iOS Safari from displaying the native long-press text selection/callout menu on custom buttons and tiles.

### 2. Automatic Hybrid Install Banner (Android & iOS)
- **Auto-Prompt Triggers**: Shows as a floating glassmorphic slide-up panel at the bottom center of the screen when the app detects it is not running in installed standalone mode, and installation is supported.
- **Android / Chrome Behavior**: Captures the `beforeinstallprompt` event, saves the event to the state store, and renders an "Install" trigger which calls `.prompt()` on user action.
- **iOS / Safari Behavior**: Detects Apple mobile devices running in non-standalone browser tabs and presents an elegant instruction set guides, illustrating how to press the Share button 📤 and tap "Add to Home Screen" ➕.
- **Anti-Annoyance Snooze**: Clicking the dismiss (`X`) button persists a dismissal timestamp in `localStorage`, snoozing the banner for **7 days** to maintain absolute visual and UX hygiene.
- **Vibrant Aesthetics**: Renders with translucent glassmorphic backdrop filters, custom card borders, and high contrast typography tailored to ClassHub's existing color scheme.

### 3. Production-Grade Pre-Caching & Opening Speed
- **Fast Launches**: Configures the `vite-plugin-pwa` build process to precache all compiled JS chunks, CSS files, custom assets, and structural HTML templates using workbox `injectManifest`.
- **Offline Reliability**: The app loads instantly on weak or disconnected networks (such as classroom basement deadzones) by routing core assets locally from Cache Storage under Workbox management.
- **Retains Push Notifications**: Maintains existing Supabase real-time push and notification click event listeners by hosting the original listener scripts inside the Workbox template.

---

## 🛠️ Proposed Changes

### [Core Stylesheet]
#### [MODIFY] [index.css](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/index.css)
- Revise the global `*` reset rule to completely omit blue touch outlines:
  ```css
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent; /* Removes touch highlight */
    -webkit-touch-callout: none;              /* Prevents iOS callout on long press */
  }

  /* Retain correct text input controls */
  input,
  textarea {
    -webkit-user-select: text;
    user-select: text;
  }
  ```
- Incorporate smooth custom keyframe animations for the banner slide-up transition:
  ```css
  @keyframes slideUp {
    from {
      transform: translate(-50%, 32px);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }

  .install-banner-slide {
    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  ```

### [Vite Builder Config]
#### [MODIFY] [vite.config.ts](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/vite.config.ts)
- Import `VitePWA` and register it inside the active plugins list:
  ```typescript
  import { VitePWA } from 'vite-plugin-pwa';

  export default defineConfig({
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        manifest: false, // Continue referencing public/manifest.json manually
      })
    ],
    // ...
  });
  ```

### [Service Worker Template]
#### [NEW] [sw.js](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/sw.js)
- Build a service worker source template in `src/sw.js` combining Workbox precaching rules and existing push listening logic:
  ```javascript
  import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
  import { registerRoute } from 'workbox-routing';
  import { NetworkFirst, CacheFirst } from 'workbox-strategies';

  cleanupOutdatedCaches();
  precacheAndRoute(self.__WB_MANIFEST || []);

  // API routing: Supabase connections bypass caching, ensuring live interactions
  registerRoute(
    ({ url }) => url.hostname.includes('supabase'),
    new NetworkFirst()
  );

  // Runtime caching for images and dynamic media assets
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'classhub-runtime-images',
    })
  );

  // Existing Push Notification listeners
  self.addEventListener("push", (e) => {
    const data = e.data ? e.data.json() : {};
    const title = data.title || "ClassHub";
    const options = {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/app/home" },
      vibrate: [100, 50, 100],
      tag: data.tag || "classhub-" + Date.now(),
      renotify: true,
    };
    e.waitUntil(self.registration.showNotification(title, options));
  });

  self.addEventListener("notificationclick", (e) => {
    e.notification.close();
    const url = (e.notification.data && e.notification.data.url) || "/app/home";
    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const client of list) {
          if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  });
  ```

### [PWA Cleanups & Registrations]
#### [MODIFY] [index.html](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/index.html)
- Clean up the custom inline service worker script in `index.html` as `vite-plugin-pwa` will generate a highly optimized bootstrap process or let us register it dynamically.
- Keep the localhost unregistration logic intact to prevent localhost developers from caching conflicts.

#### [MODIFY] [main.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/main.tsx)
- Ensure PWA is registered automatically in production:
  ```typescript
  import { registerSW } from 'virtual:pwa-register';

  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
  }
  ```

### [PWA UI Banner Component]
#### [NEW] [InstallPwaBanner.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/InstallPwaBanner.tsx)
- Create a beautiful glassmorphic prompt banner that triggers automatically.
- Key properties:
  - Check if the app is already installed (`window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone`).
  - Retrieve the deferred install prompt from `useAppStore`.
  - Identify iOS system platforms.
  - Implement a 7-day snooze mechanism stored in `localStorage`.
  - Design premium visual step-by-step layout overlay for iOS Safari users showing how to install manually.

#### [MODIFY] [AuthProvider.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/AuthProvider.tsx)
- Add `<InstallPwaBanner />` at the root rendering level so that the banner floats globally on top of all application views for seamless desktop/mobile interaction.

---

## 🧪 Verification Plan

### Automated Verification
- **Production Asset Compilations**: Execute `npm run build` to verify there are no TypeScript compile errors and that Vite generates the service worker cleanly.
- **Service Worker Build Validation**: Check that `dist/sw.js` compiles properly and references the precache manifest file.

### Manual PWA UX Verification
1. **Blue Highlights Test**: Tap multiple buttons, schedule cards, and inputs on a mobile emulator or physical mobile phone. Confirm the blue overlay box is entirely gone.
2. **Snooze Logic Test**: Clear `localStorage` keys, trigger the banner, click the dismissal close button `X`, then refresh. Verify that the banner is immediately suppressed and does not show again.
3. **Android Install Flow**: Simulate the `beforeinstallprompt` event in Chrome DevTools. Verify the custom banner slides up cleanly and tapping "Install" opens the native browser prompt dialog.
4. **iOS Manual Guide Flow**: Toggle your browser device agent to an iPhone. Verify that the prompt presents "Get iOS App", and clicking it opens a premium instruction drawer explaining the Safari Share and Add to Home Screen flow.

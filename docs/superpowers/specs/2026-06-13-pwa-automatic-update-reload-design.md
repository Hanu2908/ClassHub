# Design Specification: PWA Automatic Update Reload

This specification outlines the strategy for handling Service Worker and static asset updates in ClassHub. It implements automatic activation (`skipWaiting` and `clientsClaim`), client-side update detection, a premium glassmorphic reloading transition overlay, and post-update notifications.

---

## 🎨 Design Goals & Interactive UX

1. **Automatic Activation**: Allow new Service Workers to activate instantly when they finish downloading, rather than remaining in the `waiting` state.
2. **Intelligent Page Refresh**: Reload the page to load new bundles only when safe.
   - **Startup Update**: If the update is ready within 6 seconds of opening, reload automatically with a beautiful overlay.
   - **Mid-Session Update**: If the user has been active longer, prompt them with a floating toast action rather than reloading abruptly.
3. **Premium Visual Transition**: Eliminate the jarring browser flash during reload by displaying a smooth 300ms fade-in glassmorphic overlay.
4. **Post-Update Feedback**: Show a reassuring success toast on reload completion to confirm the update succeeded.

---

## 🛠️ Proposed Changes

### [Service Worker template]
#### [MODIFY] [sw.js](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/sw.js)
- Import `clientsClaim` from `workbox-core`.
- Invoke `self.skipWaiting()` and `clientsClaim()` immediately to take control of the browser client.

### [PWA Registration & Transition Overlay]
#### [MODIFY] [main.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/main.tsx)
- Define a page load timestamp.
- Expose a global `triggerPwaUpdateReload` function to handle appending the custom glassmorphic overlay and executing the reload.
- Listen for the `controllerchange` event on the active Service Worker.
- Call `triggerPwaUpdateReload` if the event occurs within 6 seconds of page load.
- Dispatch a custom `classhub-pwa-update-available` event if it occurs later.

### [React Integration & Toast Notifications]
#### [MODIFY] [App.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/App.tsx)
- Check for the `classhub_just_updated` flag in `sessionStorage` on mount. If present, clear it and show a success toast using `sonner`.
- Listen for the `classhub-pwa-update-available` event and show an interactive information toast prompting the user to update.

---

## 🧪 Verification Plan

### Automated Verification
- Run `npm run build` to confirm the code compiles and rolls up the Service Worker script cleanly.

### Manual Verification
1. **Service Worker Activation Test**: Verify that opening the site downloads the new service worker and triggers `controllerchange` immediately.
2. **Startup Update Reload**: Simulate a fresh startup with a waiting update. Verify the smooth update overlay appears and the page refreshes to apply changes.
3. **Mid-Session Update Prompt**: Trigger `controllerchange` after 6 seconds of activity. Verify that no automatic reload occurs, and instead a floating toast with a manual "Update" action button is displayed.
4. **Post-Update Toast**: After the page finishes reloading from an update, verify that a `sonner` success toast confirms the update completed.

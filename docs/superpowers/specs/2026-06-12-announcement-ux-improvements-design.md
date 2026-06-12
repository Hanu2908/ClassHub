# Design Specification: Announcement UX Improvements (Scroll Margin & Multi-Image Carousel)

## 1. Overview
This design spec addresses two key issues in the Announcements interface of ClassHub:
1. **Scroll Margin / Virtualization Bug**: When a user navigates to the Announcements page, the page skeleton mounts first. The effect that measures the container's `offsetTop` returns `0` because the virtualized container is not yet rendered. When the skeleton disappears and the container mounts, the scroll margin is not re-measured, causing the virtualizer to calculate incorrect item offsets, which cuts off bottom elements (making buttons invisible) and unmounts top items prematurely.
2. **Stacked Multiple Images**: When multiple images are attached to a single announcement, they stack vertically, bloating the card height. We will replace this with a premium, swipeable/arrow-navigation image carousel inside the card, and support swipeable multi-image navigation within the full-screen zoom modal.

---

## 2. Scroll Margin Resolution (Announcements & Directory Pages)

### Core Mechanics
* **Observer-based Tracking**: Instead of running a single measurement on mount (or relying on a fixed set of state changes), we will use a `ResizeObserver` on the virtualizer's container element.
* **Layout Dependency**: The `useEffect` will listen to:
  * `isLoading` (skeleton transitions to loaded state)
  * `flatItems.length` (rendering lists changing sizes)
  * Existing filter, query, and layout variables.

### Implementation in `AnnouncementsPage.tsx`
```typescript
useEffect(() => {
  if (!containerRef.current) return;
  
  // Set initial position immediately
  setScrollMargin(containerRef.current.offsetTop);
  
  // ResizeObserver will capture any size or offset changes due to alert banners
  // mounting, images loading, or other dynamic layout calculations
  const observer = new ResizeObserver(() => {
    if (containerRef.current) {
      setScrollMargin(containerRef.current.offsetTop);
    }
  });
  
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, [
  showSearch,
  searchQuery,
  activeTab,
  filter,
  activeFlashPosts.length,
  layoutMode,
  isLoading,
  flatItems.length
]);
```

---

## 3. Premium Image Carousel Component

### Component Structure: `src/components/ImageCarousel.tsx`
* **Props**:
  * `images: Attachment[]`
  * `onImageClick: (index: number) => void`
* **Signed URLs**: Loads signed URLs for all images in parallel and stores them in a local cache (leveraging `signedUrlCache`).
* **Swiping Physics**: Handles touch inputs manually to switch slides on mobile:
  * Track `clientX` in `onTouchStart` and calculate difference in `onTouchEnd`.
  * Trigger slide changes when swipe delta exceeds `50px`.
* **Controls Overlay**:
  * Circular chevron buttons absolute-positioned on left/right edges.
  * Desktop: Hidden by default, fades in on hover.
  * Mobile: Always visible if `images.length > 1` with a sleek backdrop-filter to ensure contrast on any image background.
  * Bottom centered indicator dots (active dot turns into an elongated pill using `var(--accent-primary)`).

---

## 4. Enhanced Multi-Image Zoom Modal

### File: `src/components/ImageZoomModal.tsx`
We will rewrite `ImageZoomModal` to accept an array of images.
* **Props**:
  * `images: Array<{ thumbUrl: string; fullUrl: string }>`
  * `initialIndex: number`
  * `onClose: () => void`
* **Navigation Overlay (Only visible when `scale === 1`)**:
  * Big, blurred edge arrows for navigation.
  * Indicator dots at the bottom.
  * When `scale > 1` (zoomed in):
    * Edge arrows and dots fade out (`opacity: 0`) to keep focus on image details.
    * Touch gestures are locked to panning instead of changing slides.
  * Reset zoom scale to `1` and coordinate offsets to `{ x: 0, y: 0 }` immediately when the active image index changes.

---

## 5. Verification Plan

### Manual Verification
1. **Scrolling Verification**:
   * Navigate from Dashboard page to Announcements page.
   * Verify scrolling works perfectly without needing a page refresh.
   * Verify bottom buttons on the last announcement card are fully visible and clickable.
   * Verify top cards don't disappear prematurely while scrolling down.
2. **Carousel Verification**:
   * Create an announcement with 2+ images.
   * Verify images do not stack vertically. They must display as a single card with horizontal swiping.
   * Verify arrows are visible and functional.
   * Verify indicator dots work properly.
3. **Modal Verification**:
   * Tap an image in the carousel.
   * Verify the zoom modal opens at the correct image index.
   * Swipe or click edge arrows inside the modal to change images.
   * Zoom in on an image, verify arrows fade out and swiping transitions are disabled (panning only).
   * Zoom out, verify arrows return and swiping changes the slide.

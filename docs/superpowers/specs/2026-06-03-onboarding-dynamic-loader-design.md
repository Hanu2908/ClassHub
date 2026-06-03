# Onboarding & Auth Loading UI/UX Polish

Design specification for an immersive, dynamic full-screen loading overlay during onboarding, and replacing the raw initial auth-check circular loader with the standard layout skeleton.

## Goal

1. **Premium Onboarding Loader**: Provide a premium, high-fidelity loading experience during onboarding. Instead of showing a static spinner inside a disabled button, we show a beautiful, full-screen blur overlay containing rotating, animated status messages that communicate the active setup stages.
2. **Initial Auth-Check Page Skeleton**: Replace the raw static circular spinner displayed during the initial session checks on startup in the route guards (`RequireAuth` and `PublicRoute` inside `App.tsx`) with the standard `<PageSkeleton />` layout.

## Visual Design of the Onboarding Overlay

- **Overlay**: Full viewport blur background using `backdrop-filter: blur(16px)` and `rgba(10, 12, 20, 0.85)` matching ClassHub's existing dark theme.
- **Micro-Animations**: Animated orbital spinner or circular progress ring around a centered emblem, coupled with fade-in/out text transitions to prevent abrupt prompt swaps.
- **Aesthetic**: Premium, minimal, and responsive.

## Proposed Changes

### 1. New Component: `OnboardingLoader.tsx`
Create a new component [OnboardingLoader.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/OnboardingLoader.tsx) containing:
- Timing intervals that increment active step state every `600ms`.
- Custom prompt lists for `"join"` and `"create"` flows.
- An instant resolution pathway when the parent indicates that loading has finished.

#### Status Messages
- **Join Flow**:
  1. *“Verifying invite code...”*
  2. *“Joining your classmates...”*
  3. *“Syncing schedule data...”*
  4. *“Preparing dashboard...”*
- **Create Flow**:
  1. *“Generating invite code...”*
  2. *“Registering section database...”*
  3. *“Assigning coordinator permissions...”*
  4. *“Preparing dashboard...”*

### 2. Integration: `JoinHubPage.tsx`
Modify [JoinHubPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/onboarding/JoinHubPage.tsx) to:
- Render `<OnboardingLoader type="join" />` when `loading` is true.

### 3. Integration: `CreateHubPage.tsx`
Modify [CreateHubPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/onboarding/CreateHubPage.tsx) to:
- Render `<OnboardingLoader type="create" />` when `loading` is true.

### 4. Integration: `App.tsx`
Modify [App.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/App.tsx) in `RequireAuth` and `PublicRoute` to replace the raw circle spinner:
```tsx
  // Before
  if (isAuthLoading && !(session && authUser)) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
    </div>
  );

  // After
  if (isAuthLoading && !(session && authUser)) return <PageSkeleton />;
```

## Verification Plan

### Manual Verification
- **Onboarding Loader**:
  - Test joining a hub with invalid/valid codes. Verify that the loading overlay appears immediately and covers the screen.
  - Test creating a hub. Verify that the loader shows the appropriate coordinator setup stages and seamlessly transitions to the invite code screen.
  - Test under simulated slow network conditions (using Chrome DevTools Network throttling) to ensure steps sequence correctly and don't get stuck.
- **Initial Auth-Check**:
  - Clear cookies/localStorage and refresh the app. Verify that instead of a small spinner in the center, the page shows the full layout skeleton (`PageSkeleton`) before redirecting or rendering the home page.


# Pre-filled Invite Links Design

Allows Class Representatives (CRs) to share direct invite URLs that pre-fill the section invite code when students access the sign-up/onboarding pages.

## User Review Required

> [!NOTE]
> The query parameter capturing logic supports both `invite` and `code` parameters. 
> To prevent collision with Google OAuth callback URLs (which contain `?code=...`), we apply strict regex validation ensuring we only capture valid ClassHub invite codes.

## Proposed Changes

### Auth Component Layer

#### [MODIFY] [AuthProvider.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/AuthProvider.tsx)

*   **URL Parameter Capture**:
    Add an effect on mount to parse `window.location.search` for `invite` or `code` parameters. Validate them using the ClassHub invite code pattern: `/^[A-Z0-9]{2}[A-Z]{4}$/i`.
    If valid, store the code in `sessionStorage` under the key `classhub-pending-invite-code`.
*   **OAuth Redirect Configuration**:
    Modify the `signInWithGoogle` function to check if `classhub-pending-invite-code` exists in `sessionStorage`. If present, override the post-OAuth redirect URI target to `/onboarding/join` instead of `/onboarding/choice`.

---

### Onboarding Component Layer

#### [MODIFY] [JoinHubPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/onboarding/JoinHubPage.tsx)

*   **State Prefilling & Storage Clearing**:
    On page load, read the invite code from:
    1.  The URL search query (`invite` or `code` parameters).
    2.  `sessionStorage` key `classhub-pending-invite-code`.
*   **State Updates**:
    If a valid code is found, set it as the initial value of the `hubCode` input state.
*   **Cleanup Action**:
    Immediately remove `classhub-pending-invite-code` from `sessionStorage` and clear the query parameters from the browser address bar using `window.history.replaceState` to maintain a clean URL.

---

### CR Command Component Layer

#### [MODIFY] [CRCommandPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/CRCommandPage.tsx)

*   **Share Message Integration**:
    Refine the `shareCode` function to construct a direct link: `${window.location.origin}/onboarding/join?invite=${inviteCode}`.
    Update the navigator sharing payload to use the requested format:
    `Join your Section's Hub ${section?.name || ''} on ClassHub! Use this direct link to access it : ${inviteUrl} (Invite Code: ${inviteCode})`

## Verification Plan

### Automated/Unit Tests
- Verify that valid 6-character alphanumeric codes matching the regex `/^[A-Z0-9]{2}[A-Z]{4}$/i` are captured, and invalid/longer codes (e.g. Google OAuth tokens) are ignored.

### Manual Verification
1.  **Authenticated Direct Access**:
    Navigate to `/onboarding/join?invite=P2WXYZ` when authenticated without a hub. Verify that `P2WXYZ` is filled in the hub code field and the URL query parameters are cleared immediately.
2.  **Unauthenticated Access**:
    Clear session/cookies. Navigate to `/onboarding/join?invite=P2WXYZ`. Verify redirection to `/` login, then click Sign In. Verify redirection leads directly to `/onboarding/join` with `P2WXYZ` pre-filled.
3.  **Sharing Trigger**:
    Open the CR Command page as a CR, click the Share button on the Section Invite Code card, and check that the resulting share payload matches the designated format.

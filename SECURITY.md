# Security Policy

## Supported versions

ClassHub is actively developed for engineering college sections. Security updates and patches are applied to the active branch.

| Version | Supported |
| :--- | :--- |
| 1.x (Active Dev) | Yes |
| < 1.0 | No |

---

## Reporting a vulnerability

We take the security of student and institutional data seriously. If you discover a security vulnerability, do not open a public issue on GitHub.

### Reporting process

1. Privately contact the project maintainer, [Himanshu Saini](https://github.com/Hanu2908), or report via the repository private vulnerability reporting feature on GitHub.
2. Provide a clear description of the vulnerability including:
   - Type of issue (such as authentication bypass, RLS policy leak, injection, rate limit violation).
   - Step-by-step reproduction instructions or a proof-of-concept payload.
   - Impact assessment on student data or section isolation.
   - Affected files, endpoints, or database tables.

### Response timeline

- **Initial acknowledgment**: Within 48 hours of report receipt.
- **Triage and assessment**: Within 5 business days.
- **Fix and patch deployment**: Priority patches are deployed to production immediately upon verification.

---

## Core security principles

All contributions to ClassHub must uphold our fundamental security requirements:

### 1. Database Row-Level Security (RLS)
- Every table has PostgreSQL Row-Level Security enabled.
- All read, write, and delete policies enforce section-level boundary checks.
- Sensitive stored procedures run with `SECURITY DEFINER` only when strictly required and set explicit `search_path = public`.

### 2. Multi-tenant isolation
- Every query operating on section data must explicitly filter by `section_id`.
- Users cannot read, modify, or infer data belonging to other college sections.

### 3. Institutional domain restriction
- Only `@skit.ac.in` Google Workspace accounts are permitted to access the application.
- Domain checks are verified during authentication callbacks and enforced by PostgreSQL database triggers.

### 4. Zero ERP credentials
- ClassHub never asks for, accepts, stores, or scrapes third-party ERP credentials.
- All attendance analysis uses student-pasted data parsed locally on client devices.

### 5. Cryptographic voter anonymity
- General polls must never store student identifiers in response records.
- Voting relies on one-way salted tokens (`calculate_anonymous_token`) to prevent double voting while preserving ballot privacy.

### 6. API key separation
- Only public client keys (`VITE_SUPABASE_ANON_KEY`) are bundled into frontend assets.
- Administrative service role keys and push notification private keys remain restricted to Supabase Edge Functions.

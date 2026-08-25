# Changelog

All notable changes to ClassHub are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive contribution guide (`CONTRIBUTING.md`), Code of Conduct (`CODE_OF_CONDUCT.md`), and security policy (`SECURITY.md`).
- GitHub issue templates for bug reports, feature requests, good first issues, and pull request template.

---

## [1.4.0] - 2026-08-20

### Added
- Attendance prediction engine projecting recovery dates linked to weekly schedule slot frequency.
- Institutional academic calendar integration accounting for Rajasthan Technical University and SKIT holidays and semester breaks.
- Smart skip advisor evaluating risk levels (safe, warning, critical) and calculating projected attendance percentages before a skipped lecture.
- Multi-format attendance report generation with WhatsApp-formatted plain-text summaries, in-app PDF previews rendered with PDF.js and `pdf-lib`, and CSV exports.
- Class representative direct attendance register with period-by-period toggles and instant WhatsApp share action.
- Shareable pending assignment rosters with automated student list formatting and nudging.
- Exact integer arithmetic formulas for target calculations, eliminating IEEE 754 precision issues.

### Fixed
- Excluded makeup attendance entries from total held classes in class-log parser.
- Corrected bottom sheet touch interception and smooth entrance animations.
- Fixed push subscription fallbacks to prevent silent notification drops.

---

## [1.3.0] - 2026-07-15

### Added
- PWA Web Share Target intake handler (`/share-target`) for receiving forwarded PDFs, images, and text from WhatsApp or other apps.
- IndexedDB local staging inbox (`share-inbox`) allowing offline review before posting.
- Smart text parser extracting subject codes, names, acronyms (DBMS, OS, CN, DSA, TOC), due dates, and urgency levels.
- Client-side WebP compression using `OffscreenCanvas`, reducing 5MB to 10MB mobile uploads to under 250KB.
- In-app PDF viewer with canvas rendering and zoom controls.

### Fixed
- Restored share intake card persistence across browser navigation.
- Fixed attachment metadata batch inserts.

---

## [1.2.0] - 2026-06-20

### Added
- Dedicated Faculty workspace with digital attendance register (present, absent, medical leave toggles).
- Multi-section timetable manager supporting sub-batch assignments (Batch 1 and Batch 2) and room assignments.
- Batch counsellor mentorship console with student remarks logging and automated notifications.
- Section profile tags (`user_tags`) supporting up to 5 custom tags per student for member discovery.
- Developer telemetry console with client error tracking and feedback report triage.

### Security
- Hardened database definer functions and search paths.
- Added counsellor remark notification triggers under section isolation.

---

## [1.1.0] - 2026-05-30

### Added
- Two-tier Class Representative administration model (1 primary CR, up to 2 co-CRs per section) with audited transfer logs.
- Web Push notification delivery via VAPID keys and Supabase Edge Functions.
- Lock-screen interactive action buttons allowing 1-tap announcement acknowledgments from system notification trays.
- Announcement threaded Q&A comments with edit and delete capabilities.
- Announcement emoji reactions and expiration date filtering.
- Multi-select poll support.

### Fixed
- Resolved edge function PostgREST query join errors on notifications.
- Fixed push subscription self-healing mechanism on endpoint expiration.

---

## [1.0.0] - 2026-05-15

### Added
- Initial release of ClassHub academic management portal for engineering college sections.
- Google OAuth authentication restricted strictly to `@skit.ac.in` domain accounts.
- Section onboarding flow with CR-generated invite codes.
- Subject-wise attendance paste-and-parse calculator with 75% target threshold and safe bunks calculations.
- Multi-set assignment management with roll-number range routing.
- High-priority announcements feed with read receipt tracking.
- Salted anonymous polling system using one-way voter tokens (`calculate_anonymous_token`).
- RTU semester credit GPA calculator and relative grading distribution tools.
- PostgreSQL 15 database schema with Row-Level Security on all tables.

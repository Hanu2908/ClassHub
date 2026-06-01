# Android Share Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan task-by-task.

## Goal

Add an Android installed-PWA Web Share Target that stages WhatsApp photos and
PDFs locally, lets CRs choose a composer, and preserves failed attachments for
retry without duplicate posts.

## Tasks

1. Add share-specific file validation and a versioned IndexedDB `share-inbox`
   store with stage, read, update, delete, expiry pruning, and failed-file
   retention helpers.
2. Register the manifest `share_target` and service-worker `POST /share-target`
   handler with validation, local staging, and `303` redirects.
3. Add the guarded `/share-intake` route with preview, caption edit, removal,
   discard, destination choice, login resume, CR gating, and retry behavior.
4. Hydrate announcement and assignment composers from the inbox. Delete staged
   shares after success and redirect partial failures to retry.
5. Add the installed-Android CR dashboard education tip and record ADR-019.
6. Run unit tests, lint, production build, and physical Android acceptance QA.

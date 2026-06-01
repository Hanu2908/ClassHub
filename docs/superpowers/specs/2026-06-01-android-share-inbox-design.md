# Android PWA Share Inbox Design

## Goal

Let a CR share a faculty photo or PDF from WhatsApp directly into an installed
Android ClassHub PWA, review it, choose announcement or assignment, and publish
through the existing attachment pipeline.

## Boundaries

- Android installed PWA only. iPhone and unsupported browsers retain the picker.
- Accept up to five photos or PDFs, each no larger than 10 MB.
- Preserve an optional shared caption but leave the required title blank.
- Keep incoming files local in IndexedDB until the CR explicitly publishes.
- Require CR authentication and section membership before continuing.
- Expire local inbox entries after 24 hours.
- Do not add database tables, migrations, RLS policies, or server ingestion.

## Flow

The manifest registers `/share-target` as a `POST multipart/form-data` share
target. The service worker validates and stages the payload in IndexedDB, then
redirects to `/share-intake?id=...`.

The intake page shows file previews and an editable caption. The CR can discard
the share, remove files, post an announcement, or create an assignment. The
selected composer loads files from IndexedDB and uses the existing
`uploadAttachments()` pipeline.

If a parent post is created but one or more attachments fail, the inbox keeps
only the failed files with the existing parent ID. The intake page offers a
retry action that attaches those files without creating a duplicate post.

## Discovery

An installed Android PWA shows CRs a dismissible one-time dashboard tip:

`From WhatsApp, tap Share -> ClassHub to turn a faculty file into an announcement or assignment.`


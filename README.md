# 🎓 ClassHub

> **Multi-tenant Academic Management PWA** designed for students and classroom representatives.
> 
> *Active Development — V1.0 Closed Beta (Section P2, SKIT Jaipur)*

---

ClassHub is a high-performance Progressive Web App (PWA) tailored specifically for managing class academic workflows. Built using a modern, reactive stack, it empowers student coordinators (CRs) to distribute announcements, organize assignment sets, coordinate student acknowledgments, conduct real-time polls, and track student metrics—all scoped securely to individual class sections.

---

## ✨ Features & Capabilities

### 📢 Announcements Feed
- **Channel Scoping**: Filter announcements by *Active Feed*, *Exams*, *Schedule*, and *Campus* channels.
- **Priority & Deadlines**: Highlight urgent deadlines and critical notifications.
- **Acknowledgments tracking**: Student feedback tracking to ensure messages are read.

### 📝 Assignment & Submission Management
- **Assignment Sets**: Group multiple assignment instructions together under specific subjects.
- **Digital Submissions**: Direct student file uploads (documents, PDFs, source code, images).
- **CR Evaluation Hub**: Centralized view for CRs to monitor submissions.

### 📊 Real-Time Interactive Polls
- **Secured Voting**: Anonymized, unique-vote validation powered by cryptographic hashing (polls and salt checks) preventing duplicate submissions.
- **Live Analytics**: Real-time visual summaries of class preferences.

### ⚡ Premium Image & Media Optimization
- **Dual-Tier WebP Delivery**: Upload-time thumbnail generation reduces images up to 99.5% in size (~30-50KB WebP files) for instant mobile rendering.
- **Option D Fallback**: Hardware-accelerated, decode-time canvas downscaling (`createImageBitmap`) for legacy images, preventing GPU memory spikes on mobile devices.
- **Progressive Zoom Modal**: Instantly displays the cached thumbnail inside the modal, fetches the high-resolution source in the background, and crossfades seamlessly with full zoom/pan control.

### 📈 GPA Calculator & Analytics
- Complete calculation tools and interactive reports to track GPA target completion goals.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend Core** | **React 18**, **Vite**, **TypeScript (Strict Mode)**, **React Router v6** |
| **Styling** | **Tailwind CSS v3** (Utility-first styling with sleek dark-mode glassmorphic aesthetics) |
| **State Management** | **Zustand** (Global client state stores), **TanStack Query v5** (Server state synchronization) |
| **Backend Integration** | **Supabase JS Client v2** (Realtime databases, Auth, Edge Functions) |
| **Database** | **PostgreSQL 15** with Row-Level Security (RLS) mandatory section isolation |
| **PWA Capability** | **Vite PWA Plugin** with custom Service Worker caching & precaching support |

---

## 📁 System Architecture

```mermaid
graph TD
    subgraph PWA Client (React 18 + Vite)
        UI[Tailwind UI Components]
        Store[Zustand Local Store]
        Query[TanStack Query Cache]
        SW[Service Worker Caching]
        Uploader[uploadAttachment Utility]
        Resizer[imageResize.ts OffscreenCanvas]
    end

    subgraph Backend Services (Supabase)
        Auth[Google OAuth / Auth Domain Checks]
        Storage[Storage Buckets: original + .thumb.webp]
        DB[(PostgreSQL 15 Database)]
        Edge[Edge Functions]
    end

    UI --> Store
    UI --> Query
    UI --> Uploader
    Uploader --> Resizer
    Resizer -.->|Option C WebP Thumb| Storage
    Uploader -->|Original File| Storage
    Uploader -->|DB Insertion| DB
    Query -->|Realtime Subscriptions| DB
    Auth -->|restricted to @skit.ac.in| DB
```

---

## 🚀 Local Development

### Prerequisites
- Node.js (v18+ recommended)
- Supabase CLI (optional, for backend migrations)

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/Hanu2908/ClassHub.git
cd ClassHub-1
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory and configure your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Development Server
Run Vite's fast HMR development server:
```bash
npm run dev
```

### 4. Code Quality & Formatting
Ensure typescript schemas compile cleanly and follow ESLint compliance:
```bash
# Run ESLint linter
npm run lint

# Compile and build the production bundle
npm run build
```

---

## 🔒 Security & Data Isolation
ClassHub enforces absolute data isolation through strict database architecture rules:
- **Row-Level Security (RLS)**: Enforced across all 12 tables. Queries must strictly filter records by `section_id` derived from the user's authenticated section.
- **Domain Authorization**: Restricts registrations and logins solely to authorized institutional emails (`*@skit.ac.in`).
- **No Third-Party Credentials**: Student ERP logins and private credentials are **never** requested, scraped, or stored.

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

/* ── Section Block ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2
        className="t-card-title"
        style={{
          color: 'var(--text-primary)',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {title}
      </h2>
      <div
        className="t-body"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Paragraph ── */
function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginBottom: 10 }}>{children}</p>
  );
}

/* ── List ── */
function Ul({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 6, listStyleType: 'disc' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ── Page ── */
export default function LegalPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(10, 12, 20, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-default)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          id="legal-back-btn"
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 0',
            font: '500 14px var(--font-body)',
            cursor: 'pointer',
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
          <span
            className="t-mono-sm"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
          >
            SKIT Jaipur
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          padding: '32px 24px 48px',
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
          flex: 1,
        }}
      >
        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent-primary-glow)',
              border: '1px solid var(--accent-primary-muted)',
              marginBottom: 16,
            }}
          >
            <span
              className="t-badge"
              style={{ color: 'var(--accent-primary)', letterSpacing: '0.08em' }}
            >
              LEGAL
            </span>
          </div>

          <h1
            className="t-feature"
            style={{
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: 8,
            }}
          >
            Terms &amp; Privacy
          </h1>

          <p
            className="t-mono-sm"
            style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}
          >
            Last updated: June 2026 &nbsp;·&nbsp; Effective for ClassHub v1.0 closed beta, Section P2, SKIT Jaipur.
          </p>
        </div>

        {/* ── TERMS OF USE ── */}
        <div
          style={{
            padding: '4px 0 16px',
            marginBottom: 32,
            borderBottom: '1px solid rgba(96, 165, 250, 0.15)',
          }}
        >
          <span
            className="t-mono-sm"
            style={{
              color: 'var(--accent-primary)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Terms of Use
          </span>
        </div>

        <Section title="1. Scope &amp; Eligibility">
          <P>
            ClassHub is an academic management platform exclusively available to enrolled
            students and faculty of Swami Keshvanand Institute of Technology, Management &amp;
            Gramothan (SKIT), Jaipur. Access is restricted to verified{' '}
            <span style={{ color: 'var(--accent-primary)' }}>@skit.ac.in</span> institutional
            Google accounts. Any attempt to access the platform with an unauthorised account
            will be refused and the session will be immediately terminated.
          </P>
          <P>
            By signing in you confirm that you are a current student or authorised staff
            member of SKIT Jaipur and that you will use ClassHub solely for lawful academic
            purposes.
          </P>
        </Section>

        <Section title="2. Acceptable Use">
          <P>You agree not to:</P>
          <Ul
            items={[
              'Share, publish, or redistribute any content posted on ClassHub outside the platform without the consent of the original author.',
              'Impersonate another student, faculty member, or Class Representative (CR).',
              'Attempt to circumvent authentication, access other users\' data, or tamper with any system functionality.',
              'Use the platform to harass, defame, or harm any member of the SKIT community.',
              'Upload or transmit malicious code, spam, or any material that violates applicable law.',
              'Exploit or probe any feature for purposes other than its intended academic use.',
            ]}
          />
        </Section>

        <Section title="3. Class Representative (CR) Responsibilities">
          <P>
            CRs are granted elevated privileges — including posting announcements, managing
            attendance, and administering assignments — on behalf of their section. CRs are
            expected to exercise these privileges responsibly, accurately, and in the interest
            of the entire section.
          </P>
          <P>
            Misuse of CR access (e.g. falsifying attendance, posting unauthorised content)
            may result in immediate revocation of privileges and referral to college
            administration.
          </P>
        </Section>

        <Section title="4. Content &amp; Intellectual Property">
          <P>
            All educational materials, timetables, announcements, and assignment content
            shared on ClassHub remain the intellectual property of their respective creators
            or SKIT Jaipur. ClassHub is granted a limited, non-exclusive licence to store
            and display such content solely for the purpose of providing the service.
          </P>
          <P>
            By submitting content to ClassHub (e.g. assignment submissions, poll responses)
            you grant the platform permission to store and process that content to deliver
            the service.
          </P>
        </Section>

        <Section title="5. Service Availability &amp; Modifications">
          <P>
            ClassHub is provided on an &ldquo;as-is&rdquo; basis during its closed-beta period.
            We make no guarantee of uninterrupted availability. The development team reserves
            the right to modify, suspend, or discontinue any feature at any time, with
            reasonable notice where practicable.
          </P>
        </Section>

        <Section title="6. Limitation of Liability">
          <P>
            To the maximum extent permitted by applicable law, the ClassHub team and SKIT
            Jaipur shall not be liable for any indirect, incidental, or consequential damages
            arising from your use of or inability to use the platform — including but not
            limited to loss of data, academic records, or missed notifications.
          </P>
          <P>
            You acknowledge that ClassHub is a student-built academic tool and that critical
            academic records (attendance, grades) are ultimately maintained by the institution.
          </P>
        </Section>

        <Section title="7. Termination">
          <P>
            We reserve the right to suspend or permanently revoke your access for any
            violation of these Terms, or if you are no longer affiliated with SKIT Jaipur.
            You may request deletion of your account at any time by contacting the development
            team.
          </P>
        </Section>

        {/* ── PRIVACY POLICY ── */}
        <div
          style={{
            padding: '4px 0 16px',
            marginBottom: 32,
            marginTop: 16,
            borderBottom: '1px solid rgba(96, 165, 250, 0.15)',
          }}
        >
          <span
            className="t-mono-sm"
            style={{
              color: 'var(--accent-primary)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Privacy Policy
          </span>
        </div>

        <Section title="8. Data We Collect">
          <P>
            When you sign in via Google OAuth, we receive and store the following
            information from your institutional account:
          </P>
          <Ul
            items={[
              'Full name and profile picture (from your Google account)',
              'Institutional email address (@skit.ac.in)',
              'Roll number, inferred from your email prefix',
              'Section membership, set during onboarding',
            ]}
          />
          <P>During your use of the platform we may also store:</P>
          <Ul
            items={[
              'Attendance records (present / absent per subject per session)',
              'Assignment submission metadata (file references, timestamps)',
              'Poll vote records (anonymous for general polls; section-scoped)',
              'Push-notification subscription tokens (for Web Push delivery)',
              'In-app notification acknowledgement timestamps',
            ]}
          />
        </Section>

        <Section title="9. How We Use Your Data">
          <P>Your data is used exclusively to:</P>
          <Ul
            items={[
              'Authenticate you and maintain your session securely.',
              'Display personalised academic information relevant to your section.',
              'Enable CRs to manage attendance, assignments, and announcements.',
              'Deliver push notifications for new announcements and updates.',
              'Aggregate anonymised analytics to improve platform performance (no personal data is exposed).',
            ]}
          />
          <P>
            We do <strong style={{ color: 'var(--text-primary)' }}>not</strong> sell, rent,
            or share your personal data with third parties for marketing or commercial
            purposes.
          </P>
        </Section>

        <Section title="10. Data Storage &amp; Security">
          <P>
            All data is stored on Supabase-managed PostgreSQL databases hosted on secure
            cloud infrastructure. We implement Row-Level Security (RLS) policies to ensure
            that you can only access data belonging to your own section. Connections are
            encrypted in transit using TLS.
          </P>
          <P>
            Push notification tokens are stored solely to deliver notifications and are
            revoked when you sign out or unsubscribe from notifications.
          </P>
          <P>
            We do <strong style={{ color: 'var(--text-primary)' }}>not</strong> store ERP
            credentials or any sensitive institutional login details.
          </P>
        </Section>

        <Section title="11. Data Retention">
          <P>
            Your account data is retained for as long as you remain an active user of
            ClassHub. Attendance and assignment records may be retained for the duration of
            the academic year for auditing purposes. Upon request, your personal data will
            be deleted within 14 days, subject to legal or institutional retention obligations.
          </P>
        </Section>

        <Section title="12. Cookies &amp; Local Storage">
          <P>
            ClassHub uses browser local storage and IndexedDB to cache session data and
            support offline functionality. No third-party tracking cookies are used. You
            may clear this data at any time through your browser settings.
          </P>
        </Section>

        <Section title="13. Push Notifications">
          <P>
            If you grant notification permission, ClassHub stores a Web Push subscription
            token to deliver announcements and reminders. You can revoke this permission at
            any time via your browser or device settings. Revoking permission does not
            affect your ability to use any other feature of the platform.
          </P>
        </Section>

        <Section title="14. Your Rights">
          <P>You have the right to:</P>
          <Ul
            items={[
              'Access the personal data we hold about you.',
              'Request correction of inaccurate data.',
              'Request deletion of your account and associated personal data.',
              'Object to or restrict processing of your data.',
              'Withdraw consent for push notifications at any time.',
            ]}
          />
          <P>
            To exercise any of these rights, contact the ClassHub development team via your
            section CR or directly through the platform.
          </P>
        </Section>

        <Section title="15. Changes to This Policy">
          <P>
            We may update these Terms &amp; Privacy Policy as the platform evolves. When
            we make material changes, we will notify you via an in-app announcement. Your
            continued use of ClassHub after such notice constitutes acceptance of the
            revised policy.
          </P>
        </Section>

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(96, 165, 250, 0.04)',
            border: '1px solid var(--border-default)',
          }}
        >
          <p
            className="t-mono-sm"
            style={{ color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'center' }}
          >
            Questions? Reach out to the ClassHub team through your section CR
            or the in-app developer console.
            <br />
            <span style={{ color: 'var(--text-tertiary)' }}>
              ClassHub v1.0 · Closed Beta · SKIT Jaipur, Section P2
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { type Announcement } from '../../store/appStore';
import { isPreviewableImage } from '../../lib/utils/attachments';
import { useSection } from '../../hooks/useSectionMembers';

interface OffscreenSharePortalProps {
  announcement: Announcement | null;
  domRef: React.RefObject<HTMLDivElement | null>;
}

function getPortalCategory(title: string, priority: 'critical' | 'general') {
  const t = (title || '').toLowerCase();
  
  if (priority === 'critical' || t.includes('urgent') || t.includes('attention') || t.includes('alert') || t.includes('important')) {
    return { name: 'Immediate Alert', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.5)' };
  }
  if (t.includes('exam') || t.includes('test') || t.includes('quiz') || t.includes('midterm') || t.includes('practical') || t.includes('mst') || t.includes('assessment') || t.includes('viva')) {
    return { name: 'Academic Exam', color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.5)' };
  }
  if (t.includes('schedule') || t.includes('class') || t.includes('timing') || t.includes('timetable') || t.includes('slot') || t.includes('rescheduled') || t.includes('postponed')) {
    return { name: 'Schedule Change', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.5)' };
  }
  return { name: 'General Announcement', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.5)' };
}

function getAbsoluteTimestamp(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${day} ${month} · ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
}

function BentoGridCollage({ images }: { images: any[] }) {
  if (images.length === 0) return null;
  
  if (images.length === 1) {
    return (
      <div style={{
        width: '100%',
        height: '320px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
        background: 'rgba(10, 12, 20, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img
          src={images[0].signedUrl}
          alt={images[0].filename}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        width: '100%',
        height: '240px'
      }}>
        {images.map((img, idx) => (
          <div key={img.id || idx} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default, rgba(255,255,255,0.08))', background: 'rgba(10, 12, 20, 0.4)' }}>
            <img src={img.signedUrl} alt={img.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '8px',
        width: '100%',
        height: '280px'
      }}>
        {/* Left large featured image */}
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default, rgba(255,255,255,0.08))', background: 'rgba(10, 12, 20, 0.4)' }}>
          <img src={images[0].signedUrl} alt={images[0].filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        {/* Right stacked column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
          {images.slice(1, 3).map((img, idx) => (
            <div key={img.id || idx} style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default, rgba(255,255,255,0.08))', background: 'rgba(10, 12, 20, 0.4)', height: '136px' }}>
              <img src={img.signedUrl} alt={img.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4 or more images
  const displayImages = images.slice(0, 4);
  const extraCount = images.length - 4;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '8px',
      width: '100%',
      height: '280px'
    }}>
      {displayImages.map((img, idx) => {
        const isFourth = idx === 3;
        return (
          <div 
            key={img.id || idx} 
            style={{ 
              position: 'relative',
              borderRadius: '12px', 
              overflow: 'hidden', 
              border: '1px solid var(--border-default, rgba(255,255,255,0.08))', 
              background: 'rgba(10, 12, 20, 0.4)' 
            }}
          >
            <img src={img.signedUrl} alt={img.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            
            {isFourth && extraCount > 0 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(10, 12, 20, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(3px)',
              }}>
                <span style={{
                  color: '#ffffff',
                  fontSize: '22px',
                  fontWeight: 700,
                  letterSpacing: '0.05em'
                }}>
                  +{extraCount} more
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OffscreenSharePortal({ announcement, domRef }: OffscreenSharePortalProps) {
  const { data: section } = useSection();

  if (!announcement) return null;

  const category = getPortalCategory(announcement.title, announcement.priority);

  const sectionText = section?.name 
    ? `SECTION ${section.name.toUpperCase()}` 
    : '';
  const institutionText = section?.college 
    ? section.college.toUpperCase() 
    : '';
  const watermarkText = [sectionText, institutionText].filter(Boolean).join(' | ');

  const imageAttachments = (announcement.attachments || []).filter(att => 
    isPreviewableImage(att.fileType, att.filename) && att.signedUrl
  );
  
  const nonImageAttachments = (announcement.attachments || []).filter(att => 
    !isPreviewableImage(att.fileType, att.filename)
  );

  return (
    <div
      ref={domRef}
      style={{
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        width: '600px',
        padding: '28px',
        background: 'var(--bg-elevated, #151622)',
        border: `2px solid ${category.borderColor}`,
        borderRadius: 'var(--radius-lg, 16px)',
        color: 'var(--text-primary, #ffffff)',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. BRAND HEADER WATERMARK */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.08))', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Circular Brand Icon */}
          <div style={{ width: '28px', height: '28px', display: 'block' }}>
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" style={{ width: '100%', height: '100%' }}>
              <path fill="#5198F0" opacity="1.000000" stroke="none"
                d="
            M90.920868,184.898224
              C115.357994,145.825409 150.658157,127.564659 196.025177,129.205994
              C216.402100,129.943192 234.928955,136.562027 249.340179,151.929977
              C256.117126,159.156845 260.359528,167.748917 261.753693,177.602127
              C263.260101,188.248596 256.992981,197.226227 246.612335,199.562637
              C236.834427,201.763382 227.316147,196.515747 224.597931,186.257660
              C220.727112,171.649948 210.533005,165.357117 196.727936,163.799728
              C171.329926,160.934494 151.073151,170.857086 135.508911,190.433182
              C121.533195,208.011322 115.176094,228.375229 115.641212,250.867096
              C116.462082,290.562164 147.125305,306.800201 180.348419,297.256897
              C194.643326,293.150696 206.146423,284.467834 217.519073,275.371857
              C228.947983,266.230896 240.711609,257.507751 252.361374,248.644669
              C253.541367,247.746933 254.863419,246.823410 256.262024,246.459808
              C265.763489,243.989471 269.252686,236.845352 272.183014,228.254471
              C279.004883,208.254761 286.644409,188.532974 294.019958,168.723648
              C296.541321,161.951782 300.835754,156.566147 307.178772,152.935898
              C314.702179,148.630066 324.774963,148.858292 330.294891,153.454880
              C336.084991,158.276367 337.496490,167.064819 334.036346,176.056763
              C327.997955,191.748810 322.003479,207.457809 316.028748,223.174210
              C315.158661,225.463013 314.499207,227.831924 313.616821,230.550201
              C315.225311,230.765503 316.317902,231.037689 317.410858,231.038956
              C331.575836,231.055435 345.741364,230.967834 359.905426,231.077728
              C362.660065,231.099106 363.944672,230.273010 364.908783,227.574081
              C371.796051,208.293808 378.960724,189.112793 385.892365,169.848114
              C390.087341,158.189209 399.890289,149.961685 410.198792,149.821289
              C423.754456,149.636658 431.678253,159.955154 427.326813,172.859222
              C422.116699,188.309677 416.313843,203.560013 410.785278,218.903366
              C395.491730,261.347168 380.183319,303.785645 364.941925,346.248199
              C362.258209,353.724976 358.525635,360.225708 350.646088,363.199524
              C343.133240,366.034943 335.797638,365.927856 329.574738,360.282501
              C323.503326,354.774658 322.266785,347.529541 324.773468,340.089111
              C330.139465,324.161713 336.003693,308.402130 341.661804,292.573090
              C344.894318,283.529816 348.122772,274.485107 351.417999,265.259155
              C321.378204,263.742615 291.732513,261.591736 265.355011,278.005432
              C253.416779,285.434113 242.715652,294.911316 231.743439,303.816681
              C218.206299,314.803864 204.210876,324.908447 187.272125,330.028168
              C151.263367,340.911743 109.137703,331.954193 87.413025,298.381012
              C75.445648,279.886688 71.822258,259.339539 74.048996,237.633636
              C75.959694,219.008469 81.311256,201.459106 90.920868,184.898224
            z"/>
              <path fill="#5196EE" opacity="1.000000" stroke="none"
                d="
            M238.420502,324.476868
              C246.408722,308.045624 260.328979,298.445679 275.299713,290.161377
              C280.892517,287.066528 287.076904,285.040710 294.450348,281.907593
              C293.220734,286.254120 292.557739,289.055573 291.639282,291.770630
              C285.192688,310.828339 278.826569,329.915039 272.154663,348.893982
              C268.831604,358.346710 262.006378,363.983887 251.824203,364.821167
              C238.947952,365.879944 229.610687,355.443268 232.437546,342.825989
              C233.810928,336.696136 236.277374,330.811188 238.420502,324.476868
            z"/>
            </svg>
          </div>
          {/* Subtle brand name */}
          <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.05em', color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>ClassHub</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span style={{ fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: category.color }}>
            {category.name}
          </span>
          {watermarkText && (
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
              {watermarkText}
            </span>
          )}
        </div>
      </div>

      {/* 2. TITLE (Distinguished from brand header) */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0', lineHeight: 1.35, color: '#ffffff', letterSpacing: '-0.02em' }}>
          {announcement.title}
        </h1>
      </div>

      {/* 3. FULL DESCRIPTION */}
      <p style={{ fontSize: '14.5px', lineHeight: 1.625, color: 'var(--text-primary, #fff)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {announcement.body}
      </p>

      {/* 4. ATTACHMENTS (If present) */}
      {(imageAttachments.length > 0 || nonImageAttachments.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {imageAttachments.length > 0 && (
            <BentoGridCollage images={imageAttachments} />
          )}
          {nonImageAttachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {nonImageAttachments.map(att => (
                <div 
                  key={att.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid var(--border-default, rgba(255,255,255,0.08))', 
                    borderRadius: 'var(--radius-sm, 6px)', 
                    padding: '8px 12px', 
                    fontSize: '12px',
                    color: 'var(--text-primary, #fff)'
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{att.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. TIMESTAMP AT THE BOTTOM */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: '1px solid var(--border-default, rgba(255,255,255,0.04))', paddingTop: '12px', marginTop: '4px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {getAbsoluteTimestamp(announcement.postedAt)}
        </span>
      </div>
    </div>
  );
}


import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from '@phosphor-icons/react';

export function ProcessingStatusTooltip({ row }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'top' });
  const triggerRef = useRef(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 240;
    const tooltipHeight = 215;

    // Flip below if too close to top of viewport
    const placeBelow = rect.top < tooltipHeight + 20;
    const top = placeBelow ? rect.bottom + 8 : rect.top - tooltipHeight - 8;

    // Keep horizontally within viewport bounds
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, left));

    setCoords({
      top,
      left,
      placement: placeBelow ? 'bottom' : 'top',
    });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    updatePosition();
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  const totalIn = Number(row?.kg) || 0;
  const processed = Number(row?.kgMoved) || 0;
  const remaining = Math.max(0, totalIn - processed);
  const clean = Number(row?.cleanKg) || 0;
  const rejectSortex = Number(row?.rejectSortexKg) || 0;
  const rejectGravity = Number(row?.rejectGravityKg) || 0;
  const rejectSize = Number(row?.rejectSizeKg) || 0;
  const reject = Number(row?.rejectKg) || (rejectSortex + rejectGravity + rejectSize);
  const waste = Number(row?.wasteKg) || 0;

  const hasRejectBreakdown = rejectSortex > 0 || rejectGravity > 0 || rejectSize > 0;

  return (
    <>
      <span
        ref={triggerRef}
        className="proc-tooltip-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: 6,
          cursor: 'pointer',
          color: open ? 'var(--color-accent)' : 'var(--color-tertiary)',
          transition: 'color 150ms ease',
        }}
        title="View processing breakdown"
      >
        <Info size={17} weight="fill" />
      </span>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 250,
              background: 'var(--color-surface, #ffffff)',
              color: 'var(--color-text, #0f1115)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: 10,
              padding: '12px 14px',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.16)',
              zIndex: 99999,
              fontSize: 12.5,
              lineHeight: 1.5,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                color: 'var(--color-accent)',
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Processing Summary</span>
              <span>{row?.batchNo}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--color-tertiary)' }}>Total Coffee In:</span>
              <strong>{totalIn.toLocaleString()} KG</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--color-tertiary)' }}>Processed:</span>
              <strong>{processed.toLocaleString()} KG</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--color-tertiary)' }}>Remaining:</span>
              <strong>{remaining.toLocaleString()} KG</strong>
            </div>

            <div
              style={{
                height: 1,
                background: 'var(--color-border)',
                margin: '6px 0',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--color-clean)', fontWeight: 600 }}>Clean:</span>
              <strong style={{ color: 'var(--color-clean)' }}>{clean.toLocaleString()} KG</strong>
            </div>

            {hasRejectBreakdown && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-tertiary)', paddingLeft: 6, marginBottom: 2 }}>
                  <span>• Reject (Sortex):</span>
                  <span>{rejectSortex.toLocaleString()} KG</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-tertiary)', paddingLeft: 6, marginBottom: 2 }}>
                  <span>• Reject (Gravity):</span>
                  <span>{rejectGravity.toLocaleString()} KG</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-tertiary)', paddingLeft: 6, marginBottom: 2 }}>
                  <span>• Reject (Size):</span>
                  <span>{rejectSize.toLocaleString()} KG</span>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--color-reject)', fontWeight: 600 }}>Total Reject:</span>
              <strong style={{ color: 'var(--color-reject)' }}>{reject.toLocaleString()} KG</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-waste)', fontWeight: 600 }}>Waste:</span>
              <strong style={{ color: 'var(--color-waste)' }}>{waste.toLocaleString()} KG</strong>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

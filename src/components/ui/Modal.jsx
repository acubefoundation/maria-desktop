import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/*
 * Overlays render into document.body rather than wherever they were declared.
 *
 * A z-index only competes inside the stacking context of its own ancestor, and
 * this app has several: the dashboard root runs an opacity animation with
 * fill-mode "both" (a filled animation keeps the context alive after it
 * finishes), the topbar is sticky with a z-index of its own, and the company
 * card rail sets container-type. Any dialog declared inside one of those is
 * capped at that ancestor's level, so on tablet - where the sidebar is still a
 * full 240px fixed column at z-index 100 rather than the floating bottom bar -
 * the navigation drew straight over the dialog. The dashboard's company modal
 * and the profile menu in the topbar were both caught by this, since each sits
 * inside a trapping ancestor.
 *
 * Portalling to body puts every overlay in the root context, where
 * --z-dialog (300) is genuinely above --z-sidebar (100) and --z-mobile-nav
 * (200), and it keeps holding as new stacking contexts are added to a page.
 */
function OverlayPortal({ children }) {
  return createPortal(children, document.body);
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer, className }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  /*
   * On a phone the app's navigation is a floating bar pinned to the bottom of
   * the viewport: 72px tall, sitting 12px up, at --z-mobile-nav (200). It sits
   * inside that band of the screen, so it covers the footer unless the dialog
   * is held clear, and a dispatch review whose Confirm button is hidden behind
   * the nav cannot be confirmed at all.
   *
   * The extra bottom padding lifts the dialog clear of that bar; the reduced
   * mobile max-height keeps it inside the space that leaves. Both are mobile
   * only: on a wider viewport there is no floating bar, and the original
   * spacing is right there.
   */
  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center p-3 pb-[calc(88px+env(safe-area-inset-bottom))] sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={cn(
            'relative w-full max-h-[76vh] sm:max-h-[92vh] flex flex-col rounded-xl border border-border bg-background p-4 sm:p-6 shadow-xl transition-all duration-200 animate-in zoom-in-95',
            sizeMap[size] || 'max-w-lg',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-border flex-shrink-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <button
              type="button"
              className="rounded-lg p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="py-3 sm:py-4 text-sm text-foreground overflow-y-auto flex-1 min-h-0">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 pt-3 sm:pt-4 border-t border-border flex-shrink-0 flex-wrap">
              {footer}
            </div>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}

const slideSizeMap = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl lg:max-w-2xl',
  xl: 'sm:max-w-2xl lg:max-w-3xl',
};

export function SlideOver({ isOpen, onClose, title, children, footer, size = 'lg', className }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--z-dialog)] overflow-hidden">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in-0"
          onClick={onClose}
        />
        <div className="fixed inset-y-0 right-0 flex max-w-full sm:pl-10">
          <div
            className={cn(
              'w-screen max-w-full bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300',
              slideSizeMap[size] || slideSizeMap.lg,
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Form Drawer'}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">{title}</h2>
              <button
                type="button"
                className="rounded-lg p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 py-4 sm:py-5 overflow-y-auto text-sm text-foreground flex-1 min-h-0">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-2 p-4 sm:p-6 pt-3 sm:pt-4 border-t border-border flex-shrink-0 flex-wrap">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

export default Modal;

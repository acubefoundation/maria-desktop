import React from 'react';
import './AppSplash.css';

/**
 * Branded launch screen shown while the auth session is being restored.
 *
 * This replaces the bare spinning circle that greeted everyone on a cold app
 * open or a first web visit. The previous loader had no brand, no wordmark and
 * no sense of progress, so the first paint of the app looked broken rather
 * than intentional.
 *
 * Deliberately CSS-only: no images to download, no animation library, and it
 * paints on the first frame because the markup is plain DOM rather than a
 * canvas or SVG-animated dependency.
 */
export function AppSplash({ message = 'Preparing your warehouse' }) {
  return (
    <div className="app-splash" role="status" aria-live="polite">
      <span className="app-splash__glow" aria-hidden="true" />
      <span className="app-splash__sheen" aria-hidden="true" />

      <div className="app-splash__inner">
        <div className="app-splash__stage" aria-hidden="true">
          <span className="app-splash__ripple app-splash__ripple--a" />
          <span className="app-splash__ripple app-splash__ripple--b" />

          <span className="app-splash__float">
            <span className="app-splash__stir">
              <svg className="app-splash__bean" viewBox="0 0 48 48" fill="none">
                <g transform="rotate(-32 24 24)">
                  <ellipse cx="24" cy="24" rx="12.5" ry="16.5" fill="currentColor" />
                  <path
                    d="M19.4 36.2C17.6 30 18.4 25.2 24 24c5.6-1.2 6.4-6 4.6-12.2"
                    stroke="#04222e"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
            </span>
          </span>
        </div>

        <div className="app-splash__wordmark">
          <span className="app-splash__name">Maria Private Stock</span>
          <span className="app-splash__rule" aria-hidden="true" />
          <span className="app-splash__tag">Stock Management</span>
        </div>
      </div>

      <div className="app-splash__progress" aria-hidden="true">
        <span className="app-splash__progress-bar" />
      </div>

      <span className="app-splash__message">{message}</span>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Buildings,
  CheckCircle,
  Eye,
  EyeSlash,
  Funnel,
  Hourglass,
  House,
  MagnifyingGlass,
  Package,
  Truck,
  Warning,
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

import { reportsApi, companiesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { sortByName } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { CompanyActivityModal } from '../components/CompanyActivityModal';
import './DashboardPage.css';

// Route for the detailed "today's activity" view — change to match your router.
const TODAY_ACTIVITY_ROUTE = '/activity/today';

// Totals are masked by default (like a wallet balance); the choice is remembered.
const MASK = '******';
const HIDE_TOTALS_KEY = 'dashboard:hide-totals';

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
}

function formatKg(value) {
  const kg = Number(value ?? 0);
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg.toLocaleString()} kg`;
}

function pct(value, total) {
  if (!total) return '0%';
  return `${((Number(value || 0) / total) * 100).toFixed(1)}%`;
}

// Stable per-company tint (0–359) so each card keeps the same color between renders.
function companyHue(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'C';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

function KpiCard({ label, value, foot, icon, tone = 'default', slot }) {
  return (
    <div className={`dashboard__kpi ${slot ? `dashboard__kpi--${slot}` : ''}`}>
      <div className="dashboard__kpi-head">
        <span className="dashboard__kpi-label">{label}</span>
        <span
          className={`dashboard__kpi-icon ${tone !== 'default' ? `dashboard__kpi-icon--${tone}` : ''}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <div className="dashboard__kpi-value">{value}</div>
      <div className="dashboard__kpi-foot">
        <span>{foot?.label}</span>
        <strong>{foot?.value}</strong>
      </div>
    </div>
  );
}

function OutputRow({ color, label, value, kg, extra, pctValue }) {
  return (
    <div className="dashboard__output-item">
      <div className="dashboard__output-name">
        <span className="dashboard__output-dot" style={{ background: color }} />
        {label}
      </div>
      <span className="dashboard__output-value">{value}</span>
      <div className="dashboard__output-sub">
        <span>{formatNumber(kg)} KG</span>
        <span>{extra}</span>
      </div>
      <div className="dashboard__output-track">
        <div className="dashboard__output-fill" style={{ width: pctValue, background: color }} />
      </div>
    </div>
  );
}

/*
 * Rendered twice on purpose:
 *  - "inline": under today's cards, in the overview row (desktop only)
 *  - "rail":   in the right rail (tablet + mobile, unchanged)
 * CSS shows exactly one of them per breakpoint.
 */
function ProcessingOutput({ variant, snap, total, pcts }) {
  return (
    <div className={`dashboard__card dashboard__output dashboard__output--${variant}`}>
      <div className="dashboard__output-head">
        <span className="dashboard__output-title">Processing output</span>
        <span className="dashboard__output-total">{formatNumber(total)} KG total</span>
      </div>

      <div className="dashboard__output-list">
        <OutputRow
          color="var(--color-clean)"
          label="Clean export output"
          value={pcts.clean}
          pctValue={pcts.clean}
          kg={snap.cleanKg}
          extra={`${formatNumber(snap.cleanBags)} bags`}
        />
        <OutputRow
          color="var(--color-error)"
          label="Screen reject"
          value={pcts.reject}
          pctValue={pcts.reject}
          kg={snap.rejectKg}
          extra={`${formatNumber(snap.rejectBags)} bags`}
        />
        <OutputRow
          color="var(--color-waste)"
          label="Husk & milling waste"
          value={pcts.waste}
          pctValue={pcts.waste}
          kg={snap.wasteKg}
          extra="By-product loss"
        />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { canWrite, user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'User';

  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [hideTotals, setHideTotals] = useState(() => {
    try {
      const saved = window.localStorage.getItem(HIDE_TOTALS_KEY);
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  const toggleTotals = () => {
    setHideTotals((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(HIDE_TOTALS_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable — keep the in-memory choice */
      }
      return next;
    });
  };

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => reportsApi.dashboard(),
    refetchInterval: 30000,
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['dashboard-all-companies'],
    queryFn: () => companiesApi.list({ limit: 100 }),
    refetchInterval: 30000,
  });

  const allCompanies = useMemo(
    () => sortByName(companiesData?.data || []),
    [companiesData]
  );

  const maxStockKg = useMemo(
    () => Math.max(0, ...allCompanies.map((c) => Number(c.currentStockKg ?? 0))),
    [allCompanies]
  );

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return allCompanies;

    return allCompanies.filter((company) =>
      [company.name, company.code, company.contactPerson, company.region].some((value) =>
        value?.toLowerCase().includes(query)
      )
    );
  }, [allCompanies, companySearch]);

  const snap = stats?.processingSnapshot || {};

  const totalProcessedKg =
    Number(snap.cleanKg || 0) + Number(snap.rejectKg || 0) + Number(snap.wasteKg || 0);

  const today = stats?.todayActivity || {
    coffeeIn: { kg: 0, bags: 0, count: stats?.todayEntries || 0 },
    coffeeOut: { kg: 0, bags: 0, count: stats?.todayDispatches || 0 },
    processing: { kg: 0, bags: 0, cleanKg: 0, cleanBags: 0, rejectKg: 0, wasteKg: 0, count: 0 },
  };

  const alerts = stats?.alerts?.unprocessedOverdue || [];
  const totalAlerts = alerts.length;

  const pcts = {
    clean: pct(snap.cleanKg, totalProcessedKg),
    reject: pct(snap.rejectKg, totalProcessedKg),
    waste: pct(snap.wasteKg, totalProcessedKg),
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard__header">
        <div>
          <div className="dashboard__eyebrow">
            <span className="dashboard__live-dot" aria-hidden="true" />
            Warehouse overview
          </div>
          <h1 className="dashboard__title">
            {greeting()}, {firstName}
          </h1>
          <p className="dashboard__subtitle">
            Here is the operational picture across your warehouse and clients.
          </p>
        </div>

        <div className="dashboard__header-actions">
          <span className="dashboard__section-caption">Updated automatically every 30 seconds</span>
        </div>
      </header>

      {/* Body: stacked on tablet/mobile, a two-zone control-center grid on desktop */}
      <div className="dashboard__body">
      {/* Hero + today */}
      <section className="dashboard__overview">
        <div className="dashboard__overview-main">
          <div className="dashboard__hero">
            <div className="dashboard__hero-top">
              <div className="dashboard__hero-label-row">
                <span className="dashboard__hero-label">Total warehouse liquidity</span>
                <button
                  type="button"
                  className="dashboard__eye-btn"
                  onClick={toggleTotals}
                  aria-pressed={!hideTotals}
                  aria-label={hideTotals ? 'Show totals' : 'Hide totals'}
                  title={hideTotals ? 'Show totals' : 'Hide totals'}
                >
                  {hideTotals ? <EyeSlash size={15} weight="bold" /> : <Eye size={15} weight="bold" />}
                </button>
              </div>
              <div className="dashboard__hero-icon" aria-hidden="true">
                <House size={19} weight="duotone" />
              </div>
            </div>

            <div
              key={hideTotals ? 'masked' : 'shown'}
              className={`dashboard__hero-value ${hideTotals ? 'is-masked' : ''}`}
            >
              {hideTotals ? MASK : isLoading ? '—' : formatNumber(stats?.totalBagsInWarehouse)}
            </div>
            <div className="dashboard__hero-unit">bags currently in warehouse</div>

            <div className="dashboard__hero-meta">
              <div className="dashboard__hero-meta-item">
                <span key={hideTotals ? 'm' : 'v'} className="dashboard__hero-meta-value">{hideTotals ? MASK : formatKg(stats?.totalKgInWarehouse)}</span>
                <span className="dashboard__hero-meta-label">Net mass</span>
              </div>

              <span className="dashboard__hero-meta-divider" aria-hidden="true" />

              <div className="dashboard__hero-meta-item">
                <span key={hideTotals ? 'm' : 'v'} className="dashboard__hero-meta-value">{hideTotals ? MASK : formatNumber(stats?.activeCleaningBatches)}</span>
                <span className="dashboard__hero-meta-label">Active batches</span>
              </div>

              <span className="dashboard__hero-meta-divider" aria-hidden="true" />

              <div className="dashboard__hero-meta-item">
                <span key={hideTotals ? 'm' : 'v'} className="dashboard__hero-meta-value">{hideTotals ? MASK : formatNumber(allCompanies.length)}</span>
                <span className="dashboard__hero-meta-label">Exporters</span>
              </div>
            </div>
          </div>

          {canWrite && (
            <div className="dashboard__quick-actions">
              <Button asChild variant="secondary">
                <Link to="/entries/new">
                  <Truck size={16} color="var(--color-accent)" />
                  Log Entry
                </Link>
              </Button>

              <Button asChild variant="secondary">
                <Link to="/outings/new">
                  <ArrowUp size={16} />
                  Dispatch
                </Link>
              </Button>

              <Button asChild variant="secondary">
                <Link to="/processing">
                  <Funnel size={16} color="var(--color-accent)" />
                  Processing
                </Link>
              </Button>
            </div>
          )}

          {/* Company selector: 3 × 2 cards visible, extra companies scroll horizontally. */}
          <div className="dashboard__companies-panel">
            <div className="dashboard__companies-panel-header">
              <div className="dashboard__companies-panel-title">
                <span className="dashboard__companies-panel-icon" aria-hidden="true">
                  <Buildings size={14} weight="duotone" />
                </span>
                <div>
                  <h2>Clients</h2>
                  <span>{allCompanies.length} clients · click to view details</span>
                </div>
              </div>

              <label className="dashboard-companies-search dashboard-companies-search--compact">
                <MagnifyingGlass size={12} color="var(--color-tertiary)" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search"
                  aria-label="Search companies"
                  value={companySearch}
                  onChange={(event) => setCompanySearch(event.target.value)}
                />
              </label>
            </div>

            <div className="dashboard-company-scroll">
  {companiesLoading ? (
    <div className="dashboard-company-empty">Loading companies...</div>
  ) : filteredCompanies.length === 0 ? (
    <div className="dashboard-company-empty">No companies found.</div>
  ) : (
    <>
      {/* Desktop table header */}
      <div className="dashboard-company-table-header" aria-hidden="true">
        <span>Company</span>
        <span>Stock</span>
        <span>Bags</span>
        <span>Status</span>
      </div>

      <div className="dashboard-company-grid">
        {filteredCompanies.map((company) => {
          const stockKg = Number(company.currentStockKg ?? 0);
          const stockBags = Number(company.currentStockBags ?? 0);
          const share =
            maxStockKg > 0 ? (stockKg / maxStockKg) * 100 : 0;

          return (
            <button
              type="button"
              key={company.id}
              className={`dashboard-company-card ${
                stockKg <= 0 ? 'dashboard-company-card--empty' : ''
              }`}
              style={{
                '--hue': companyHue(company.name),
                '--share': `${
                  stockKg > 0 ? Math.max(share, 4).toFixed(1) : 0
                }%`,
              }}
              onClick={() => setSelectedCompanyId(company.id)}
              title={`View full warehouse activity for ${company.name}`}
            >
              {/* Mobile card status */}
              <span
                className="dashboard-company-card__status"
                title={stockKg > 0 ? 'In stock' : 'No stock'}
                aria-hidden="true"
              />

              <ArrowUpRight
                className="dashboard-company-card__open"
                size={13}
                weight="bold"
                aria-hidden="true"
              />

              <span
                className="dashboard-company-card__logo"
                aria-hidden="true"
              >
                {initials(company.name)}
              </span>

              <span className="dashboard-company-card__body">
                <span className="dashboard-company-card__name">
                  {company.name}
                </span>

                <span className="dashboard-company-card__stock">
                  <strong>{formatNumber(stockKg)}</strong>
                  <em>KG</em>

                  {stockBags > 0 && (
                    <span className="dashboard-company-card__bags">
                      · {formatNumber(stockBags)} bags
                    </span>
                  )}
                </span>
              </span>

              <span
                className="dashboard-company-card__meter"
                aria-hidden="true"
              >
                <span />
              </span>

              {/* Desktop-only cells */}
              <span className="dashboard-company-table-stock">
                {formatNumber(stockKg)} KG
              </span>

              <span className="dashboard-company-table-bags">
                {formatNumber(stockBags)}
              </span>

              <span
                className={`dashboard-company-table-status ${
                  stockKg > 0
                    ? 'dashboard-company-table-status--active'
                    : 'dashboard-company-table-status--empty'
                }`}
              >
                <span />
                {stockKg > 0 ? 'In stock' : 'No stock'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  )}
</div>
          </div>
        </div>

        {/* Today's activity cards + "More" redirect */}
        <div className="dashboard__today">
          <div className="dashboard__kpi-grid">
            <KpiCard
              slot="intake"
              label="Today's intake"
              value={`${formatNumber(today.coffeeIn.kg)} kg`}
              foot={{ label: 'Batches', value: formatNumber(today.coffeeIn.count) }}
              icon={<ArrowDown size={15} weight="bold" />}
            />

            <KpiCard
              slot="dispatch"
              label="Today's dispatch"
              value={`${formatNumber(today.coffeeOut.kg)} kg`}
              foot={{ label: 'Shipments', value: formatNumber(today.coffeeOut.count) }}
              icon={<ArrowUp size={15} weight="bold" />}
              tone="warning"
            />

            <KpiCard
              slot="processing"
              label="Processing today"
              value={`${formatNumber(today.processing.kg)} kg`}
              foot={{ label: 'Runs', value: formatNumber(today.processing.count) }}
              icon={<Funnel size={15} weight="bold" />}
              tone="success"
            />

            <KpiCard
              slot="attention"
              label="Attention required"
              value={formatNumber(totalAlerts)}
              foot={{
                label: totalAlerts === 1 ? 'Issue needs review' : 'Issues need review',
                value: totalAlerts ? 'Review' : 'Clear',
              }}
              icon={
                totalAlerts ? <Warning size={15} weight="bold" /> : <CheckCircle size={15} weight="bold" />
              }
              tone={totalAlerts ? 'danger' : 'success'}
            />
          </div>

          <Link to={TODAY_ACTIVITY_ROUTE} className="dashboard__more">
            <span className="dashboard__more-text">See today's intake, dispatch and processing in detail</span>
            <span className="dashboard__more-cta">
              More
              <ArrowRight size={14} weight="bold" aria-hidden="true" />
            </span>
          </Link>

          <ProcessingOutput variant="inline" snap={snap} total={totalProcessedKg} pcts={pcts} />
        </div>
      </section>

      {/* Snapshot + right operational rail */}
      <section className="dashboard__content-grid">
        <div className="dashboard__card dashboard__operations-card">
          <div className="dashboard__card-header">
            <div className="dashboard__card-title-wrap">
              <span className="dashboard__card-title-icon" aria-hidden="true">
                <Package size={16} weight="duotone" />
              </span>
              <div>
                <h2 className="dashboard__card-title">Warehouse snapshot</h2>
                <p className="dashboard__card-subtitle">Current operational totals across all clients.</p>
              </div>
            </div>
          </div>

          <div className="dashboard__snapshot-grid">
            <div className="dashboard__snapshot-item">
              <span>Warehouse stock</span>
              <strong>{formatNumber(stats?.totalBagsInWarehouse)} bags</strong>
              <small>{formatKg(stats?.totalKgInWarehouse)}</small>
            </div>
            <div className="dashboard__snapshot-item">
              <span>Today's intake</span>
              <strong>{formatNumber(today.coffeeIn.kg)} KG</strong>
              <small>{formatNumber(today.coffeeIn.count)} batches</small>
            </div>
            <div className="dashboard__snapshot-item">
              <span>Today's dispatch</span>
              <strong>{formatNumber(today.coffeeOut.kg)} KG</strong>
              <small>{formatNumber(today.coffeeOut.count)} shipments</small>
            </div>
            <div className="dashboard__snapshot-item">
              <span>Today's processing</span>
              <strong>{formatNumber(today.processing.kg)} KG</strong>
              <small>{formatNumber(today.processing.count)} runs</small>
            </div>
          </div>
        </div>

        <aside className="dashboard__rail">
          <div className="dashboard__card dashboard__attention">
            <div className="dashboard__attention-header">
              <span className="dashboard__attention-title">
                <Warning size={15} color="var(--color-error)" aria-hidden="true" />
                Attention required
              </span>
              <span className="dashboard__attention-count">
                {totalAlerts} {totalAlerts === 1 ? 'Issue' : 'Issues'}
              </span>
            </div>

            <div className="dashboard__alert-list">
            {totalAlerts === 0 ? (
              <div className="dashboard__alert">
                <div className="dashboard__alert-icon dashboard__alert-icon--ok" aria-hidden="true">
                  <CheckCircle size={15} weight="bold" />
                </div>
                <div className="dashboard__alert-content">
                  <div className="dashboard__alert-title">Everything is clear</div>
                  <div className="dashboard__alert-desc">
                    No overdue unprocessed batches require attention.
                  </div>
                </div>
              </div>
            ) : (
              alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="dashboard__alert">
                  <div className="dashboard__alert-icon" aria-hidden="true">
                    <Hourglass size={15} />
                  </div>

                  <div className="dashboard__alert-content">
                    <div className="dashboard__alert-title-row">
                      <span className="dashboard__alert-title">Aging batch</span>
                      <span className="dashboard__alert-age">Over 7 days</span>
                    </div>

                    <div className="dashboard__alert-desc">
                      <strong>{alert.batchNo}</strong> ({alert.grade}) is still unprocessed.
                    </div>

                    <Link to={`/entries/${alert.id}`} className="dashboard__alert-link">
                      Inspect lot →
                    </Link>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>

          <ProcessingOutput variant="rail" snap={snap} total={totalProcessedKg} pcts={pcts} />
        </aside>
      </section>
      </div>

      <CompanyActivityModal
        companyId={selectedCompanyId}
        isOpen={!!selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
      />
    </div>
  );
}
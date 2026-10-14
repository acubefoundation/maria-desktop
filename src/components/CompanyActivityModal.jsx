import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import {
  Funnel,
  CheckCircle,
  WarningCircle,
  Trash,
  Phone,
  EnvelopeSimple,
  MapPin,
  IdentificationCard,
  ArrowDown,
  ArrowUp,
  List,
  Table,
} from '@phosphor-icons/react';
import { companiesApi } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useNavigate } from 'react-router-dom';
import './CompanyActivityModal.css';

/* -------------------------------------------------------------------------- */
/* 1. Recents Table Component                                                 */
/* -------------------------------------------------------------------------- */
function RecentsTable({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="company-modal__empty">
        <p>No recent warehouse transactions recorded for this company yet.</p>
      </div>
    );
  }

  return (
    <div className="company-modal__table-wrap">
      <table className="company-trans-table">
        <thead>
          <tr>
            <th>Transaction Type</th>
            <th>Date & Time</th>
            <th>Reference / Batch</th>
            <th>Activity Details</th>
            <th style={{ textAlign: 'right' }}>Weight (KG)</th>
            <th>Logistics / Operator</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const isCoffeeIn = t.type === 'COFFEE_IN';
            const isCoffeeOut = t.type === 'COFFEE_OUT';
            const isProcessing = t.type === 'PROCESSING';

            return (
              <tr key={t.id} className="trans-row">
                <td>
                  {isCoffeeIn && (
                    <span className="trans-badge trans-badge--in">
                      <ArrowDown size={12} weight="bold" /> Coffee In
                    </span>
                  )}
                  {isCoffeeOut && (
                    <span className="trans-badge trans-badge--out">
                      <ArrowUp size={12} weight="bold" /> Dispatch
                    </span>
                  )}
                  {isProcessing && (
                    <span className="trans-badge trans-badge--proc">
                      <Funnel size={12} weight="bold" /> Processing
                    </span>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {t.date ? formatEthiopian(new Date(t.date), { includeTime: true }) : '—'}
                </td>
                <td>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--color-accent)' }}>
                    {t.refNo || t.batchNo || '—'}
                  </strong>
                </td>
                <td style={{ fontSize: 12 }}>{t.details || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  {isCoffeeIn && (
                    <span className="trans-weight trans-weight--in">
                      +{Number(t.kg || 0).toLocaleString()} KG
                    </span>
                  )}
                  {isCoffeeOut && (
                    <span className="trans-weight trans-weight--out">
                      -{Number(t.kg || 0).toLocaleString()} KG
                    </span>
                  )}
                  {isProcessing && (
                    <span className="trans-weight trans-weight--proc">
                      {Number(t.cleanKg || 0).toLocaleString()} KG Clean
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--color-tertiary)', whiteSpace: 'nowrap' }}>
                  {t.driverName && t.plateNumber
                    ? `${t.driverName} (${t.plateNumber})`
                    : t.operatorName
                    ? t.operatorName
                    : t.driverName || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Entries Table Component (Entry Status column removed)                  */
/* -------------------------------------------------------------------------- */
function EntriesTable({ entries, onRowClick }) {
  const getStatusBadge = (status) => {
    const statusConfig = {
      PROCESSED: { label: 'Processed', className: 'status-badge--processed' },
      PARTIAL: { label: 'Partial', className: 'status-badge--partial' },
      UNPROCESSED: { label: 'Unprocessed', className: 'status-badge--unprocessed' },
    };
    const config = statusConfig[status] || { label: status || '—', className: '' };
    return <span className={`status-badge ${config.className}`}>{config.label}</span>;
  };

  if (!entries || entries.length === 0) {
    return (
      <div className="company-modal__empty">
        <p>No coffee entries found for this company yet.</p>
      </div>
    );
  }

  return (
    <div className="company-modal__table-wrap">
      <table className="company-entries-table">
        <thead>
          <tr>
            <th>Batch No.</th>
            <th>Date</th>
            <th style={{ textAlign: 'right' }}>Bags</th>
            <th style={{ textAlign: 'right' }}>Total KG</th>
            <th>Grade</th>
            <th>Processing Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              onClick={() => onRowClick(e.id)}
              className="entry-row-clickable"
              title="Click to view batch detail"
            >
              <td>
                <strong style={{ fontFamily: 'monospace', color: 'var(--color-accent)' }}>
                  {e.batchNo || '—'}
                </strong>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {e.entryDate ? formatEthiopian(new Date(e.entryDate)) : '—'}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>
                {e.bags != null ? e.bags.toLocaleString() : '—'}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>
                {e.kg != null ? e.kg.toLocaleString() : '—'}
              </td>
              <td>{e.grade || '—'}</td>
              <td>{getStatusBadge(e.processingStatus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Main Modal Component                                                   */
/* -------------------------------------------------------------------------- */
export function CompanyActivityModal({ companyId, isOpen, onClose }) {
  const navigate = useNavigate();
  // Entries is the default tab: it is the primary view (all registered intake
  // batches) and its data is cached eagerly, so opening the modal lands on it
  // rather than on the secondary "Recents" aggregation.
  const [activeTab, setActiveTab] = useState('entries'); // 'entries' | 'recents'

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['company-detail-activity', companyId],
    queryFn: () => companiesApi.get(companyId),
    enabled: !!companyId && isOpen,
});

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['company-entries', companyId],
    queryFn: () => companiesApi.getEntries(companyId),
    // Entries is the default tab, so fetch it eagerly on open rather than
    // lazily when the tab is selected.
    enabled: !!companyId && isOpen,
  });

  const summary = company?.activitySummary || {
    totalCoffeeInKg: company?.stats?.totalLifetimeIntakeKg || 0,
    totalCoffeeInBags: company?.stats?.totalLifetimeIntakeBags || 0,
    totalDispatchedKg: company?.stats?.totalDispatchedKg || 0,
    totalDispatchedBags: company?.stats?.totalDispatchedBags || 0,
    currentRemainingStockKg: Math.max(
      0,
      (company?.stats?.totalLifetimeIntakeKg || 0) - (company?.stats?.totalDispatchedKg || 0)
    ),
    currentRemainingStockBags: Math.max(
      0,
      (company?.stats?.totalLifetimeIntakeBags || 0) - (company?.stats?.totalDispatchedBags || 0)
    ),
    totalProcessedKg: 0,
    totalCleanKg: 0,
    totalRejectKg: 0,
    totalRejectSortexKg: 0,
    totalRejectGravityKg: 0,
    totalRejectSizeKg: 0,
    totalWasteKg: 0,
    cleanAvailableKg: 0,
    unprocessedRemainingKg: 0,
    activeBatchesCount: 0,
  };

  const transactions = company?.recentTransactions || [];

  const hasRejectBreakdown =
    (summary.totalRejectSortexKg || 0) > 0 ||
    (summary.totalRejectGravityKg || 0) > 0 ||
    (summary.totalRejectSizeKg || 0) > 0;

  const handleRowClick = (entryId) => {
    onClose();
    navigate(`/entries/${entryId}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        company
          ? `Client Overview — ${company.name}`
          : 'Loading Client Overview...'
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
            {company?.code ? `Exporter Code: ${company.code} • ` : ''}
            {activeTab === 'recents'
              ? `Showing ${transactions.length} Most Recent Movements`
              : `Showing ${entries?.length || 0} Coffee Entries`}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Close Overview
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="company-modal__loading">
          <div className="company-modal__spinner" />
          <span>Fetching comprehensive activity data...</span>
        </div>
      ) : error || !company ? (
        <div className="company-modal__empty">
          <p>Failed to load client details. Please try again.</p>
        </div>
      ) : (
        <div className="company-modal__content company-modal__content--fade-in">
          {/* COMMON TOP HEADER: Client Identity */}
          <header className="company-modal__header">
            <div className="company-modal__identity">
              <div className="company-modal__avatar">
                {company.name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div className="company-modal__title-box">
                <div className="company-modal__name-row">
                  <h3 className="company-modal__name">{company.name}</h3>
                  <span className="company-modal__code-badge">{company.code}</span>
                  {company.status && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 100,
                        background:
                          company.status === 'ACTIVE'
                            ? 'hsla(142, 50%, 45%, 0.12)'
                            : 'hsla(0, 50%, 50%, 0.12)',
                        color:
                          company.status === 'ACTIVE'
                            ? 'var(--color-clean)'
                            : 'var(--color-error)',
                      }}
                    >
                      {company.status}
                    </span>
                  )}
                </div>
                <div className="company-modal__meta-row">
                  {company.exportLicense && (
                    <div className="company-modal__meta-item">
                      <IdentificationCard size={14} />
                      <span>Lic: {company.exportLicense}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="company-modal__meta-item">
                      <Phone size={14} />
                      <span>{company.phone}</span>
                    </div>
                  )}
                  {company.email && (
                    <div className="company-modal__meta-item">
                      <EnvelopeSimple size={14} />
                      <span>{company.email}</span>
                    </div>
                  )}
                  {company.address && (
                    <div className="company-modal__meta-item">
                      <MapPin size={14} />
                      <span>{company.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* COMMON TOP KPI SECTION: Current Inventory State */}
          <section className="company-modal__kpi-section" aria-label="Warehouse Activity Summary">
            <div className="company-modal__section-heading">
              <span>Warehouse Activity Summary</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-tertiary)' }}>
                Current Inventory State
              </span>
            </div>

            <div className="company-modal__inventory-grid">
              {/* Unprocessed */}
              <div className="inventory-card inventory-card--unprocessed">
                <div className="inventory-card__icon">
                  <Funnel size={20} weight="bold" />
                </div>
                <div className="inventory-card__content">
                  <span className="inventory-card__label">Unprocessed</span>
                  <span className="inventory-card__value">
                    {Number(summary.unprocessedRemainingKg || 0).toLocaleString()} <small>KG</small>
                  </span>
                  <span className="inventory-card__desc">Raw coffee awaiting processing</span>
                </div>
              </div>

              {/* Clean Available */}
              <div className="inventory-card inventory-card--clean">
                <div className="inventory-card__icon">
                  <CheckCircle size={20} weight="bold" />
                </div>
                <div className="inventory-card__content">
                  <span className="inventory-card__label">Clean Available (Not Dispatched)</span>
                  <span className="inventory-card__value">
                    {Number(summary.cleanAvailableKg || 0).toLocaleString()} <small>KG</small>
                  </span>
                  <span className="inventory-card__desc">Processed clean coffee ready for dispatch</span>
                </div>
              </div>

              {/* Remaining Reject */}
              <div className="inventory-card inventory-card--reject">
                <div className="inventory-card__icon">
                  <WarningCircle size={20} weight="bold" />
                </div>
                <div className="inventory-card__content">
                  <span className="inventory-card__label">Remaining Reject</span>
                  <span className="inventory-card__value" style={{ color: 'var(--color-reject)' }}>
                    {Number(summary.totalRejectKg || 0).toLocaleString()} <small>KG</small>
                  </span>
                  <span className="inventory-card__desc">
                    {hasRejectBreakdown ? (
                      <>
                        Sortex: {Number(summary.totalRejectSortexKg || 0).toLocaleString()} KG
                        {' | '}
                        Gravity: {Number(summary.totalRejectGravityKg || 0).toLocaleString()} KG
                        {' | '}
                        Size: {Number(summary.totalRejectSizeKg || 0).toLocaleString()} KG
                      </>
                    ) : (
                      'Reject coffee in warehouse'
                    )}
                  </span>
                </div>
              </div>

              {/* Remaining Waste */}
              <div className="inventory-card inventory-card--waste">
                <div className="inventory-card__icon">
                  <Trash size={20} weight="bold" />
                </div>
                <div className="inventory-card__content">
                  <span className="inventory-card__label">Remaining Waste</span>
                  <span className="inventory-card__value" style={{ color: 'var(--color-waste)' }}>
                    {Number(summary.totalWasteKg || 0).toLocaleString()} <small>KG</small>
                  </span>
                  <span className="inventory-card__desc">Husk & milling waste in warehouse</span>
                </div>
              </div>
            </div>
          </section>

          {/* TAB CONTROLLED BOTTOM SECTION */}
          <section className="company-modal__tables-section">
            <div className="company-modal__tab-bar">
              <div className="company-modal__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'entries'}
                  className={`company-modal__tab ${activeTab === 'entries' ? 'active' : ''}`}
                  onClick={() => setActiveTab('entries')}
                >
                  <Table size={16} weight="regular" />
                  <span>Entries</span>
                  {entries && (
                    <span className="company-modal__tab-badge">{entries.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'recents'}
                  className={`company-modal__tab ${activeTab === 'recents' ? 'active' : ''}`}
                  onClick={() => setActiveTab('recents')}
                >
                  <List size={16} weight="regular" />
                  <span>Recents</span>
                  <span className="company-modal__tab-badge">{transactions.length}</span>
                </button>
              </div>

              <span className="company-modal__tab-subtext">
                {activeTab === 'entries'
                  ? 'All Registered Coffee Intake Batches'
                  : 'Showing 10 Most Recent Warehouse Movements'}
              </span>
            </div>

            {/* TAB PANELS */}
            <div className="company-modal__tab-panel">
              {activeTab === 'recents' && (
                <RecentsTable transactions={transactions} />
              )}

              {activeTab === 'entries' && (
                entriesLoading ? (
                  <div className="company-modal__loading" style={{ minHeight: '180px' }}>
                    <div className="company-modal__spinner" />
                    <span>Fetching coffee entries...</span>
                  </div>
                ) : (
                  <EntriesTable
                    entries={entries || []}
                    onRowClick={handleRowClick}
                  />
                )
              )}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { ArrowLeft, Plus, Trash } from '@phosphor-icons/react';
import { entriesApi } from '../lib/api';
import { stockForEntry } from '../lib/stockTypes';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import './EntryDetailPage.css';

/**
 * Placeholder shaped like the real page.
 *
 * The previous state was a bare "Loading batch details..." string with no
 * styling of its own, which made the page look empty and then jump. Mirroring
 * the layout keeps the header, cards and tables from shifting once the data
 * arrives. The visible blocks are decorative, so the loading message is
 * exposed to assistive technology instead.
 */
function BatchDetailSkeleton() {
  return (
    <div className="page-container detail-page" aria-busy="true">
      <span className="sr-only">Loading batch details</span>

      <div className="detail-header">
        <div className="header-left">
          <Skeleton className="sk-back" />
          <div>
            <Skeleton className="sk-title" />
            <Skeleton className="sk-subtitle" />
          </div>
        </div>
        <div className="header-actions">
          <Skeleton className="sk-button" />
          <Skeleton className="sk-button" />
          <Skeleton className="sk-button sk-button--icon" />
        </div>
      </div>

      <div className="top-info-grid">
        <Card>
          <CardContent className="info-card-content">
            <Skeleton className="sk-section" />
            {[...Array(5)].map((_, i) => (
              <div className="info-item" key={i}>
                <Skeleton className="sk-label" />
                <Skeleton className="sk-value" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <Skeleton className="sk-section" />
          <div className="stats-row">
            {[...Array(4)].map((_, i) => (
              <div className="stat-big" key={i}>
                <Skeleton className="sk-label" />
                <Skeleton className="sk-stat-value" />
                <Skeleton className="sk-sub" />
              </div>
            ))}
          </div>
          <div className="progress-container">
            <Skeleton className="sk-progress" />
          </div>
        </CardContent>
      </Card>

      <div className="tables-grid">
        {/*
          The breakdown is the first card in the grid, so it has to be first
          here too. Leaving it out pushed everything below it up by its height
          once the data arrived.
        */}
        <Card className="table-card table-card--full">
          <div className="table-card-header">
            <Skeleton className="sk-section" />
          </div>
          {[...Array(5)].map((_, i) => (
            <Skeleton className="sk-row" key={i} />
          ))}
        </Card>

        {['Processing Logs', 'Dispatches'].map((title) => (
          <Card className="table-card" key={title}>
            <div className="table-card-header">
              <Skeleton className="sk-section" />
            </div>
            {[...Array(4)].map((_, i) => (
              <Skeleton className="sk-row" key={i} />
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function EntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, isAdmin, user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.get(id),
  });

  const deleteMut = useMutation({
    mutationFn: () => entriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-stock'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      navigate('/entries');
    },
  });

  if (isLoading) return <BatchDetailSkeleton />;
  if (!entry) return <div className="error-state">Batch not found</div>;

  const totalKg = Number(entry.kg) || 0;
  const dispatchedKg = Number(entry.dispatchedKg) || 0;
  const remainingKg = Math.max(0, Number((totalKg - dispatchedKg).toFixed(2)));
  const cleanKg = Number(entry.cleanKg) || 0;
  const rejectKg = Number(entry.rejectKg) || 0;
  const wasteKg = Number(entry.wasteKg) || 0;
  const totalProcessedKg = Number(entry.kgMoved) || 0;

  /*
   * Deleting a batch is gated on ownership, not on canWrite alone.
   *
   * The header offered Delete to anyone who could write, while the Coffee In
   * table gates the same action on isAdmin || receivedBy.id === user.id, and
   * the API enforces it with assertOwnership on delete. A manager who received
   * the batch elsewhere was therefore shown a button that could only fail.
   * Matching the table means the header offers Delete exactly where the table
   * would have offered it on this row.
   */
  const canDeleteEntry = isAdmin || entry.receivedBy?.id === user?.id;
  // Clean coffee only exists once processing has recorded it. Falling back to
  // the remaining weight while cleanKg is still 0 reported the whole raw batch
  // as clean - and, because this figure gates the Dispatch button, let
  // unprocessed stock be dispatched as though it had been through processing.
  const availableClean = Math.max(0, Number((cleanKg - dispatchedKg).toFixed(2)));

  // Progress bar calculations (in KG)
  const unprocessed = Math.max(0, Number((totalKg - totalProcessedKg).toFixed(2)));
  // "In Cleaning" is the load the warehouse is working on right now, i.e. the
  // most recent processing run. It used to be the leftover of
  // `processed - (clean + reject + waste)`, but the backend rejects a save
  // unless those three balance exactly against the processed weight, so that
  // leftover was always zero and this figure could never show anything.
  const latestRun = entry.processings?.[0] || null;
  const inCleaning = Math.max(0, Number(latestRun?.kgMoved) || 0);

  const pct = (val) => (totalKg > 0 ? Math.min(100, Math.max(0, (val / totalKg) * 100)) : 0);

  /*
   * Per-fraction breakdown, read from the same stockByType the dispatch form
   * uses so the two can never disagree.
   *
   * `stockForEntry` supplies the fallback for a cached response predating that
   * field. Weight totals across the four fractions because they partition the
   * batch. Bags do not: only clean carries a count processing recorded, so
   * summing the other three would add figures that measure different things -
   * unprocessed's is the intake count minus what processing has taken. The
   * totals row therefore uses the batch's own bag count, which is the only
   * figure that describes the batch as a whole.
   */
  const breakdown = stockForEntry(entry);
  const cleanSlice = breakdown.find((s) => s.type === 'CLEAN');
  const cleanKgPerBag = cleanSlice?.kgPerBag ?? null;
  const breakdownTotal = breakdown.reduce(
    (acc, s) => ({
      kg: acc.kg + s.kg,
      dispatchedKg: acc.dispatchedKg + s.dispatchedKg,
      availableKg: acc.availableKg + s.availableKg,
    }),
    { kg: 0, dispatchedKg: 0, availableKg: 0 },
  );
  const totalBags = Number(entry.bags) || 0;
  const kg = (v) => `${(v || 0).toLocaleString()}`;
  const bags = (v) => (v > 0 ? (v || 0).toLocaleString() : '—');

  const stockColumns = [
    {
      key: 'label',
      label: 'Coffee Type',
      render: (v) => v,
    },
    {
      key: 'kg',
      label: 'Produced (KG)',
      align: 'right',
      render: (v) => kg(v),
    },
    {
      key: 'dispatchedKg',
      label: 'Dispatched (KG)',
      align: 'right',
      render: (v) => kg(v),
    },
    {
      key: 'availableKg',
      label: 'Remaining (KG)',
      align: 'right',
      render: (v) => kg(v),
    },
    {
      key: 'bags',
      label: 'Bags',
      align: 'right',
      render: (v) => bags(v || 0),
    },
    {
      key: 'kgPerBag',
      label: 'KG / Bag',
      align: 'right',
      render: (v) => (v ? kg(v) : '—'),
    },
    {
      key: 'looseKg',
      label: 'Loose / Unbagged (KG)',
      align: 'right',
      render: (v, row) => (row.type === 'CLEAN' && v && v > 0 ? kg(v) : '—'),
    },
  ];

  const stockRows = [
    ...breakdown.map((s) => ({ ...s, label: s.label })),
    {
      label: 'Total',
      kg: breakdownTotal.kg,
      dispatchedKg: breakdownTotal.dispatchedKg,
      availableKg: breakdownTotal.availableKg,
      bags: totalBags,
      kgPerBag: cleanKgPerBag,
      looseKg: cleanSlice?.looseKg ?? 0,
      isTotal: true,
    },
  ];

  const procColumns = [
    { key: 'processDate', label: 'Date', render: (v) => formatEthiopian(new Date(v), { includeTime: true }) },
    { key: 'kgMoved', label: 'Processed (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'cleanKg', label: 'Clean (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'rejectKg', label: 'Reject (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'wasteKg', label: 'Waste (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'line', label: 'Line', render: (v) => v || '—' },
    { key: 'operator', label: 'Operator', render: (_, row) => row.operator?.name || '—' },
  ];

  const outColumns = [
    { key: 'dispatchNo', label: 'Dispatch No.', render: (v) => <span className="mono-link">{v}</span> },
    { key: 'dispatchDate', label: 'Date', render: (v) => formatEthiopian(new Date(v)) },
    { key: 'kg', label: 'Weight (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'destination', label: 'Destination' },
    { key: 'purpose', label: 'Purpose', render: (v) => <Badge status={v} /> },
    { key: 'driver', label: 'Driver', render: (_, row) => row.driver?.name || '—' },
  ];

  return (
    <div className="page-container detail-page">
      <div className="detail-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <div>
            <div className="batch-title-row">
              <h1 className="batch-no">{entry.batchNo}</h1>
              <Badge status={entry.status} />
            </div>
            <p className="company-subtitle">{entry.company?.name}</p>
          </div>
        </div>
        {/*
          One actions group holding both sets. Delete is gated on ownership
          rather than canWrite, so it is its own condition, but they share a
          container: two sibling .header-actions would be pushed apart by the
          header's space-between, stranding Delete against the far edge.
        */}
        {(canWrite || canDeleteEntry) && (
          <div className="header-actions">
            {canWrite && (
              <>
                <Button variant="secondary" as={Link} to={`/processing?entryId=${entry.id}`}>
                  Log Processing
                </Button>
                <Button variant="primary" as={Link} to={`/outings/new?entryId=${entry.id}`} disabled={availableClean <= 0}>
                  <Plus size={16} weight="regular" /> New Dispatch
                </Button>
              </>
            )}
            {canWrite && canDeleteEntry && (
              <Button
                variant="danger"
                onClick={() => setDeleteOpen(true)}
                title="Delete Batch"
                aria-label="Delete Batch"
                style={{ padding: '0 12px', minWidth: 38 }}
              >
                <Trash size={18} weight="regular" />
              </Button>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Coffee Batch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteMut.mutate()}>Delete Batch</Button>
          </>
        }
      >
        <p>Are you sure you want to delete batch <strong>{entry.batchNo}</strong> ({entry.company?.name})? This will remove the batch and all associated processing and dispatch logs.</p>
      </Modal>

      <div className="top-info-grid">
        <Card>
          <CardContent className="info-card-content">
            <h3 className="section-title">Batch Information</h3>
            <div className="info-item">
              <label>Entry Date</label>
              <span>{formatEthiopian(new Date(entry.entryDate), { includeTime: true })}</span>
            </div>
            <div className="info-item">
              <label>Grade</label>
              <span>{entry.grade}</span>
            </div>
            <div className="info-item">
              <label>Origin</label>
              <span>{entry.origin?.name || entry.originText || '—'}</span>
            </div>
            <div className="info-item">
              <label>Warehouse Location</label>
              <span>{entry.location?.name ? `${entry.location.name} - ${entry.location.section}` : entry.locationText || '—'}</span>
            </div>
            <div className="info-item">
              <label>Received By</label>
              <span>{entry.receivedBy?.name}</span>
            </div>
            {entry.remarks && (
              <div className="info-item">
                <label>Notes</label>
                <span style={{ whiteSpace: 'pre-wrap' }}>{entry.remarks}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="section-title">Batch Breakdown</h3>
          
          <div className="stats-row">
            <div className="stat-big">
              <span className="stat-label">Total Input</span>
              <span className="stat-val">{totalKg.toLocaleString()} <small>kg</small></span>
              <span className="stat-sub">{(entry.bags || 0).toLocaleString()} bags</span>
            </div>
            <div className="stat-big processed-stat">
              <span className="stat-label">Processed</span>
              <span className="stat-val">{totalProcessedKg.toLocaleString()} <small>kg</small></span>
              <span className="stat-sub">{totalKg > 0 ? `${((totalProcessedKg / totalKg) * 100).toFixed(1)}%` : '0%'} of input</span>
            </div>
            <div className="stat-big clean-stat">
              <span className="stat-label">Available Clean</span>
              <span className="stat-val">{availableClean.toLocaleString()} <small>kg</small></span>
              <span className="stat-sub">Ready to dispatch</span>
            </div>
            <div className="stat-big">
              <span className="stat-label">Dispatched</span>
              <span className="stat-val">{dispatchedKg.toLocaleString()} <small>kg</small></span>
              <span className="stat-sub">{remainingKg.toLocaleString()} kg remaining</span>
            </div>
          </div>

          <div className="progress-container">
            <div className="progress-bar">
              <div className="segment segment--clean" style={{ width: `${pct(cleanKg)}%` }} />
              <div className="segment segment--incleaning" style={{ width: `${pct(inCleaning)}%` }} />
              <div className="segment segment--unprocessed" style={{ width: `${pct(unprocessed)}%` }} />
              <div className="segment segment--reject" style={{ width: `${pct(rejectKg)}%` }} />
              <div className="segment segment--waste" style={{ width: `${pct(wasteKg)}%` }} />
            </div>
            
            <div className="progress-legend">
              <div className="legend-item"><span className="dot dot--clean"></span> Clean: {cleanKg.toLocaleString()} kg</div>
              <div className="legend-item"><span className="dot dot--incleaning"></span> In Cleaning: {inCleaning.toLocaleString()} kg</div>
              <div className="legend-item"><span className="dot dot--unprocessed"></span> Unprocessed: {unprocessed.toLocaleString()} kg</div>
              <div className="legend-item"><span className="dot dot--reject"></span> Reject: {rejectKg.toLocaleString()} kg</div>
              <div className="legend-item"><span className="dot dot--waste"></span> Waste: {wasteKg.toLocaleString()} kg</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="tables-grid">
        <Card className="table-card table-card--full">
          <div className="table-card-header">
            <h3>Stock Breakdown</h3>
          </div>
          <Table
            columns={stockColumns}
            data={stockRows}
            rowClassName={(row) => (row.isTotal ? 'row-total' : undefined)}
            emptyMessage="No stock recorded for this batch yet."
          />
        </Card>

        <Card className="table-card">
          <div className="table-card-header">
            <h3>Processing Logs</h3>
          </div>
          <Table columns={procColumns} data={entry.processings || []} emptyMessage="No processing logged yet." />
        </Card>

        <Card className="table-card">
          <div className="table-card-header">
            <h3>Dispatches</h3>
          </div>
          <Table columns={outColumns} data={entry.outings || []} emptyMessage="No dispatches yet." />
        </Card>
      </div>
    </div>
  );
}

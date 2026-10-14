import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MagnifyingGlass, 
  House, 
  ArrowRight,
  DownloadSimple,
  Timer,
  FileXls,
  FilePdf, Package, Info
} from '@phosphor-icons/react';
import { stockApi } from '../lib/api';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import { useAuth } from '../contexts/AuthContext';
import { COFFEE_GRADES } from '../lib/constants';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { ProcessingStatusTooltip } from '../components/ui/ProcessingStatusTooltip';
import { Select } from '../components/ui/Input';
import './StockPage.css';

export function StockPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    groupBy: 'none',
    page: 1,
    limit: 25,
  });

  const { data: summary } = useQuery({
    queryKey: ['stock-summary'],
    queryFn: () => stockApi.summary(),
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['stock-overview', { ...filters }],
    queryFn: () => stockApi.overview({ ...filters }),
  });

  const setStatus = (status) => setFilters(prev => ({ ...prev, status }));
  const setGroupBy = (groupBy) => setFilters(prev => ({ ...prev, groupBy }));

  const batches = overview?.data || [];
  const priorityBatch = batches.length > 0 ? batches[0] : null;
  const otherBatches = batches.length > 1 ? batches.slice(1) : [];

  const [expandedPriority, setExpandedPriority] = useState(false);

  const exportColumns = [
    { key: 'batchNo', label: 'Batch No.', render: (v) => <span className="mono-link">{v}</span> },
    { key: 'company', label: 'Company', render: (_, row) => row.company?.name || '—', exportValue: (row) => row.company?.name || '' },
    { key: 'origin', label: 'Origin', render: (_, row) => row.origin?.name || row.originText || '—', exportValue: (row) => row.origin?.name || row.originText || '' },
    { key: 'grade', label: 'Grade' },
    { key: 'status', label: 'Status', render: (v, row) => (
        <div style={{display: 'flex', alignItems: 'center'}}>
          <Badge status={v} />
          {(v === 'PARTIALLY_PROCESSED' ||
            v === 'FULLY_PROCESSED' ||
            v === 'PROCESSED' ||
            v === 'IN_CLEANING' ||
            (row.kgMoved || 0) > 0) && <ProcessingStatusTooltip row={row} />}
        </div>
      ), exportValue: (row) => row.status },
    { key: 'kg', label: 'KG (In)', align: 'right', render: (v) => v?.toLocaleString() || 0 },
    { key: 'processedKg', label: 'Processed (KG)', align: 'right', render: (_, row) => {
        const processed = Number(row.cleanKg || 0) + Number(row.rejectKg || 0) + Number(row.wasteKg || 0);
        return processed > 0 ? <span className="stock-processed">{processed.toLocaleString()}</span> : '0';
      }, exportValue: (row) => (Number(row.cleanKg || 0) + Number(row.rejectKg || 0) + Number(row.wasteKg || 0)).toString() },
    { key: 'cleanKg', label: 'Clean (KG)', align: 'right', render: (v) => v > 0 ? <span className="stock-clean">{v?.toLocaleString()}</span> : '0' },
    { key: 'rejectKg', label: 'Reject (KG)', align: 'right', render: (v) => v > 0 ? <span style={{color: 'var(--color-reject)'}}>{v?.toLocaleString()}</span> : '0' },
    { key: 'wasteKg', label: 'Waste (KG)', align: 'right', render: (v) => v > 0 ? <span style={{color: 'var(--color-waste)'}}>{v?.toLocaleString()}</span> : '0' },
    { key: 'dispatchedKg', label: 'Dispatched (KG)', align: 'right', render: (v) => v > 0 ? <span style={{color: 'var(--color-dispatched)'}}>{v?.toLocaleString()}</span> : '0' },
    { 
      key: 'remainingKg', 
      label: 'Remaining (KG)', 
      align: 'right', 
      render: (_, row) => {
        const totalIn = Number(row.kg || 0);
        const totalOut = Number(row.cleanKg || 0) + Number(row.rejectKg || 0) + Number(row.wasteKg || 0) + Number(row.dispatchedKg || 0);
        const remaining = totalIn - totalOut;
        const isNegative = remaining < 0;
        return (
          <span style={{ 
            fontWeight: 700,
            color: isNegative ? 'var(--color-error)' : 'var(--color-clean)'
          }}>
            {remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
      exportValue: (row) => {
        const totalIn = Number(row.kg || 0);
        const totalOut = Number(row.cleanKg || 0) + Number(row.rejectKg || 0) + Number(row.wasteKg || 0) + Number(row.dispatchedKg || 0);
        return (totalIn - totalOut).toFixed(2);
      }
    },
    { key: 'location', label: 'Bin/Location', render: (_, row) => row.location?.name || row.locationText || '—', exportValue: (row) => row.location?.name || row.locationText || '' }
  ];

  return (
    <div className="stock-page">
      <div className="mocca-header">
        <div className="mocca-title-group">
          <span className="mocca-subtitle">WORKSPACE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 className="mocca-title">Stock Ledger</h1>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600, color: 'var(--color-text)'
            }}>
              <Package size={16} weight="duotone" color="var(--color-accent)" />
              {(summary?.totalKg ?? 0).toLocaleString()} KG In Stock
            </div>
          </div>
        </div>
        <div style={{display: 'flex', gap: 12}}>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToExcel(batches, exportColumns, 'Stock_Ledger')}>
            <FileXls size={18} weight="regular" /> Export Excel
          </button>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToPdf(batches, exportColumns, 'Stock_Ledger', 'Stock Ledger')}>
            <FilePdf size={18} weight="regular" /> Export PDF
          </button>
        </div>
      </div>

      <div className="mocca-toolbar">
        <div className="mocca-search">
          <MagnifyingGlass className="mocca-search__icon" size={18} />
          <input 
            type="text" 
            className="mocca-search__input" 
            placeholder="Search batch ID, company, origin..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <div className="toolbar__filters">
          <Select 
            value={filters.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="IN_STOCK_UNPROCESSED">Unprocessed</option>
            <option value="IN_CLEANING">In Cleaning</option>
            <option value="PARTIALLY_PROCESSED">Partially Processed</option>
            <option value="FULLY_PROCESSED">Clean</option>
          </Select>

          <Select 
            value={filters.groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="none">Group By: None</option>
            <option value="location">Group By: Bin</option>
            <option value="grade">Group By: Grade</option>
          </Select>
        </div>
      </div>

      <div className="mocca-table-wrap">
        <Table
          columns={exportColumns}
          data={batches}
          loading={isLoading}
          onRowClick={(row) => navigate(`/entries/${row.id}`)}
        />
        {overview && (
          <Pagination
            page={overview.page || 1}
            totalPages={overview.totalPages || 1}
            onPageChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
            pageSize={filters.limit}
            onPageSizeChange={(size) => setFilters(prev => ({ ...prev, limit: size, page: 1 }))}
            totalItems={overview.total ?? 0}
          />
        )}
      </div>

    </div>
  );
}







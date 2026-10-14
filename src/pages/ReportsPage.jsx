import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { DownloadSimple, FileXls, FilePdf } from '@phosphor-icons/react';
import { reportsApi, companiesApi, settingsApi } from '../lib/api';
import { sortByName } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Select, Input } from '../components/ui/Input';
import { Table, Pagination } from '../components/ui/Table';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { ReportSummarySection } from '../components/ReportSummarySection';
import { EthiopianDatePicker } from '../components/ui/EthiopianDatePicker';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import './ReportsPage.css';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('ledger');

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group"><span className="mocca-subtitle">WORKSPACE</span><h1 className="mocca-title">Reports & Analytics</h1></div>
      </div>

      <div className="tabs">
        {['ledger', 'yield', 'statement'].map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'yield' && <YieldTab />}
        {activeTab === 'statement' && <StatementTab />}
      </div>
    </div>
  );
}

function LedgerTab() {
  const [filters, setFilters] = useState({ page: 1, limit: 10, dateFrom: '', dateTo: '', inStock: false });
  
  const { data, isLoading } = useQuery({ 
    queryKey: ['ledger', filters], 
    queryFn: () => reportsApi.ledger(filters) 
  });
  
const columns = [
    { key: 'type', label: 'Type', render: (v) => <span className={`type-badge type-${v.toLowerCase()}`}>{v}</span>, exportValue: (row) => row.type },
    { key: 'date', label: 'Date', render: (v) => formatEthiopian(new Date(v)), exportValue: (row) => formatEthiopian(new Date(row.date)) },
    { key: 'refNo', label: 'Ref No.', render: (v) => <span className="mono-link">{v}</span> },
    { key: 'company', label: 'Company', render: (_, row) => row.company?.name || '—', exportValue: (row) => row.company?.name || '' },
    { key: 'bags', label: 'Bags', align: 'right', render: (v, row) => (row.type === 'IN' || row.type === 'PROCESSING') ? (v || 0).toLocaleString() : '—', exportValue: (row) => (row.type === 'IN' || row.type === 'PROCESSING') ? (row.bags || 0) : '—' },
    { key: 'kg', label: 'Weight (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'details', label: 'Details', render: (_, row) => row.type === 'IN' ? `From: ${row.origin?.name || '—'}` : row.type === 'OUT' ? `To: ${row.destination || '—'}` : `Clean: ${(row.cleanKg || 0).toLocaleString()} | Reject: ${(row.rejectKg || 0).toLocaleString()} | Waste: ${(row.wasteKg || 0).toLocaleString()} KG`, exportValue: (_, row) => row.type === 'IN' ? `From: ${row.origin?.name || ''}` : row.type === 'OUT' ? `To: ${row.destination || ''}` : `Clean: ${(row.cleanKg || 0).toLocaleString()} | Reject: ${(row.rejectKg || 0).toLocaleString()} | Waste: ${(row.wasteKg || 0).toLocaleString()} KG` },
  ];

  return (
    <div className="report-tab">
      <div className="mocca-toolbar toolbar--compact" style={{ marginBottom: 16 }}>
        <div className="toolbar__filters toolbar__row">
          <EthiopianDatePicker
            value={filters.dateFrom}
            onChange={(v) => setFilters(prev => ({ ...prev, dateFrom: v, page: 1 }))}
            placeholder="Date From"
            showTime={false}
          />
          <EthiopianDatePicker
            value={filters.dateTo}
            onChange={(v) => setFilters(prev => ({ ...prev, dateTo: v, page: 1 }))}
            placeholder="Date To"
            showTime={false}
          />
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle__btn ${!filters.inStock ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setFilters(prev => ({ ...prev, inStock: false, page: 1 }))}
            >
              All
            </button>
            <button
              type="button"
              className={`view-toggle__btn ${filters.inStock ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setFilters(prev => ({ ...prev, inStock: true, page: 1 }))}
            >
              In Stock
            </button>
          </div>
        </div>
        <div className="toolbar__actions">
          <Button variant="secondary" onClick={() => exportToExcel(data?.data || [], columns, 'Stock_Ledger')}>
            <FileXls size={16} /> Excel
          </Button>
          <Button variant="secondary" onClick={() => exportToPdf(data?.data || [], columns, 'Stock_Ledger', 'Stock Ledger Report')}>
            <FilePdf size={16} /> PDF
          </Button>
        </div>
      </div>

      {/* Summary Section at the Top - Split into two tables */}
      <ReportSummarySection
        summary={data?.summary}
        loading={isLoading}
        title="Stock Ledger Summary"
        subtitle="Key figures for filtered ledger records"
        groups={[
          ['coffeeIn', 'processed', 'clean', 'rejectSortex', 'rejectGravity', 'rejectSize', 'reject'],
          ['dispatched', 'waste', 'remainingStock']
        ]}
      />

      <Table columns={columns} data={data?.data || []} loading={isLoading} />
      <Pagination
        page={data?.page || filters.page}
        totalPages={data?.totalPages || 1}
        totalItems={data?.total ?? 0}
        pageSize={filters.limit}
        onPageSizeChange={(newLimit) => setFilters(prev => ({ ...prev, limit: newLimit, page: 1 }))}
        onPageChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
      />
    </div>
  );
}

function YieldTab() {
  const [filters, setFilters] = useState({ companyId: '', originId: '', grade: '', dateFrom: '', dateTo: '', inStock: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: () => companiesApi.list({ limit: 100 }) });
  const { data: origins } = useQuery({ queryKey: ['origins'], queryFn: () => settingsApi.origins() });
  const { data: grades } = useQuery({ queryKey: ['grades'], queryFn: () => settingsApi.grades() });

  const { data, isLoading } = useQuery({ 
    queryKey: ['yield', filters], 
    queryFn: () => reportsApi.yield(filters) 
  });

  const columns = [
    { key: 'grade', label: 'Grade' },
    { key: 'totalInputKg', label: 'Total (Processed + Unprocessed)', align: 'right', render: (_, row) => {
        const totalInput = Number(row.totalInputKg || 0);
        const processed = Number(row.cleanKg || 0) + Number(row.rejectKg || 0) + Number(row.wasteKg || 0);
        const unprocessed = Math.max(0, totalInput - processed);
        return (processed + unprocessed).toLocaleString();
      } },
    { key: 'processedKg', label: 'Processed (KG)', align: 'right', render: (_, row) => {
        const processed = Number(row.cleanKg || 0) + Number(row.rejectKg || 0) + Number(row.wasteKg || 0);
        return processed.toLocaleString();
      } },
    { key: 'unprocessedKg', label: 'Unprocessed (KG)', align: 'right', render: (_, row) => {
        const totalInput = Number(row.totalInputKg || 0);
        const processed = Number(row.cleanKg || 0) + Number(row.rejectKg || 0) + Number(row.wasteKg || 0);
        const unprocessed = Math.max(0, totalInput - processed);
        return unprocessed.toLocaleString();
      } },
    { key: 'cleanKg', label: 'Clean Kg', align: 'right', render: (v) => Number(v || 0).toLocaleString() },
    { key: 'rejectSortexKg', label: 'Reject (Sortex)', align: 'right', render: (v) => Number(v || 0).toLocaleString() },
    { key: 'rejectGravityKg', label: 'Reject (Gravity)', align: 'right', render: (v) => Number(v || 0).toLocaleString() },
    { key: 'rejectSizeKg', label: 'Reject (Size)', align: 'right', render: (v) => Number(v || 0).toLocaleString() },
    { key: 'rejectKg', label: 'Total Reject', align: 'right', render: (v) => <strong style={{ color: 'var(--color-reject)' }}>{Number(v || 0).toLocaleString()}</strong> },
    { key: 'wasteKg', label: 'Waste Kg', align: 'right', render: (v) => Number(v || 0).toLocaleString() },
    { key: 'cleanYieldPct', label: 'Yield %', align: 'right', render: (v) => `${v}%` },
  ];

  const allGrades = data?.byGrade || [];
  const totalItems = allGrades.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedGrades = allGrades.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="report-tab">
      <div className="mocca-toolbar toolbar--compact" style={{ marginBottom: 16 }}>
        <div className="toolbar__filters toolbar__row">
          <Select value={filters.companyId} onChange={(e) => { setFilters(prev => ({ ...prev, companyId: e.target.value })); setPage(1); }}>
<option value="">All Clients</option>
              {sortByName(companies?.data || []).map(c => <option key={c.id} value={c.id}>{c.contactPerson || c.name}</option>)}
          </Select>
          <Select value={filters.originId} onChange={(e) => { setFilters(prev => ({ ...prev, originId: e.target.value })); setPage(1); }}>
            <option value="">All Origins</option>
            {sortByName(origins?.data || origins || []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select value={filters.grade} onChange={(e) => { setFilters(prev => ({ ...prev, grade: e.target.value })); setPage(1); }}>
            <option value="">All Grades</option>
            {sortByName(grades?.data || grades || []).map(g => <option key={g} value={g}>{g}</option>)}
          </Select>
          <EthiopianDatePicker
            value={filters.dateFrom}
            onChange={(v) => { setFilters(prev => ({ ...prev, dateFrom: v })); setPage(1); }}
            placeholder="Date From"
            showTime={false}
          />
          <EthiopianDatePicker
            value={filters.dateTo}
            onChange={(v) => { setFilters(prev => ({ ...prev, dateTo: v })); setPage(1); }}
            placeholder="Date To"
            showTime={false}
          />
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle__btn ${!filters.inStock ? 'view-toggle__btn--active' : ''}`}
              onClick={() => { setFilters(prev => ({ ...prev, inStock: false })); setPage(1); }}
            >
              All
            </button>
            <button
              type="button"
              className={`view-toggle__btn ${filters.inStock ? 'view-toggle__btn--active' : ''}`}
              onClick={() => { setFilters(prev => ({ ...prev, inStock: true })); setPage(1); }}
            >
              In Stock
            </button>
          </div>
        </div>
        <div className="toolbar__actions">
          <Button variant="secondary" onClick={() => exportToExcel(allGrades, columns, 'Yield_Report')}>
            <FileXls size={16} /> Excel
          </Button>
          <Button variant="secondary" onClick={() => exportToPdf(allGrades, columns, 'Yield_Report', 'Yield Analytics Report')}>
            <FilePdf size={16} /> PDF
          </Button>
        </div>
      </div>

      {/* Summary Section at the Top - Split into two tables */}
      <ReportSummarySection
        summary={data?.summary}
        loading={isLoading}
        title="Yield & Processing Summary"
        subtitle="Key figures for filtered yield & processing logs"
        type="yield"
        groups={[
          ['totalInput', 'clean', 'yieldPct'],
          ['rejectSortex', 'rejectGravity', 'rejectSize', 'reject', 'waste']
        ]}
      />

      <Table columns={columns} data={paginatedGrades} loading={isLoading} />
      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
        onPageChange={setPage}
      />
    </div>
  );
}

function StatementTab() {
  const [filters, setFilters] = useState({ companyId: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [inStock, setInStock] = useState(false);

  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: () => companiesApi.list({ limit: 100 }) });

  const { data, isLoading } = useQuery({
    queryKey: ['statement', filters, inStock],
    queryFn: () => reportsApi.companyStatement(filters.companyId, { dateFrom: filters.dateFrom, dateTo: filters.dateTo, inStock }),
    enabled: !!filters.companyId,
  });

  const mergedData = React.useMemo(() => {
    if (!data) return [];
    const entries = (data.entries || []).map(e => ({
      ...e,
      type: 'IN',
      date: e.entryDate,
      refNo: e.batchNo,
      refDetail: e.origin?.name || e.originText || '—',
    }));
    const outings = (data.outings || []).map(o => ({
      ...o,
      type: 'OUT',
      date: o.dispatchDate,
      refNo: o.dispatchNo,
      refDetail: o.destination || '—',
    }));
    const processings = (data.processingLogs || []).map(p => ({
      ...p,
      type: 'PROCESSING',
      date: p.processDate,
      refNo: `PROC-${p.entry?.batchNo || ''}`,
      refDetail: `Clean: ${(p.cleanKg || 0).toLocaleString()} | Reject: ${(p.rejectKg || 0).toLocaleString()} | Waste: ${(p.wasteKg || 0).toLocaleString()} KG`,
    }));
    return [...entries, ...outings, ...processings].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
  }, [data]);

  const columns = [
    { key: 'type', label: 'Type', render: (v) => <span className={`type-badge type-${v.toLowerCase()}`}>{v}</span>, exportValue: (row) => row.type },
    { key: 'date', label: 'Date', render: (v) => formatEthiopian(new Date(v)), exportValue: (row) => formatEthiopian(new Date(row.date)) },
    { key: 'refNo', label: 'Ref No.', render: (v) => <span className="mono-link">{v}</span> },
    { key: 'bags', label: 'Bags', align: 'right', render: (v, row) => (row.type === 'IN' || row.type === 'PROCESSING') ? (v || 0).toLocaleString() : '—', exportValue: (row) => (row.type === 'IN' || row.type === 'PROCESSING') ? (row.bags || 0) : '—' },
    { key: 'kg', label: 'Weight (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'refDetail', label: 'Details' },
  ];

  const totalItems = mergedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedStatement = mergedData.slice((page - 1) * pageSize, page * pageSize);
  const currentCompanyName = data?.company?.name;

  return (
    <div className="report-tab">
      <div className="mocca-toolbar toolbar--compact" style={{ marginBottom: 16 }}>
        <div className="toolbar__filters toolbar__row">
          <Select value={filters.companyId} onChange={(e) => { setFilters(prev => ({ ...prev, companyId: e.target.value })); setPage(1); }} label="Company" required>
            <option value="">Select Company...</option>
            {sortByName(companies?.data || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <EthiopianDatePicker
            value={filters.dateFrom}
            onChange={(v) => { setFilters(prev => ({ ...prev, dateFrom: v })); setPage(1); }}
            placeholder="Date From"
            showTime={false}
          />
          <EthiopianDatePicker
            value={filters.dateTo}
            onChange={(v) => { setFilters(prev => ({ ...prev, dateTo: v })); setPage(1); }}
            placeholder="Date To"
            showTime={false}
          />
        </div>
        {filters.companyId && (
          <div className="toolbar__actions">
            <div className="view-toggle">
              <button
                type="button"
                className={`view-toggle__btn ${!inStock ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setInStock(false)}
              >
                All
              </button>
              <button
                type="button"
                className={`view-toggle__btn ${inStock ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setInStock(true)}
              >
                In Stock
              </button>
            </div>
            <Button variant="secondary" onClick={() => exportToExcel(mergedData, columns, `Statement_${currentCompanyName || 'Company'}`)}>
              <FileXls size={16} /> Excel
            </Button>
            <Button variant="secondary" onClick={() => exportToPdf(mergedData, columns, `Statement_${currentCompanyName || 'Company'}`, `Company Statement: ${currentCompanyName || 'Selected Company'}`)}>
              <FilePdf size={16} /> PDF
            </Button>
          </div>
        )}
      </div>

      {filters.companyId && data?.summary && (
        <ReportSummarySection
          summary={data.summary}
          loading={isLoading}
          title={`Company Statement Summary — ${currentCompanyName || 'Selected Exporter'}`}
          subtitle="Key figures for company ledger & processing activity"
          groups={[
            ['coffeeIn', 'processed', 'clean', 'rejectSortex', 'rejectGravity', 'rejectSize', 'reject'],
            ['dispatched', 'waste', 'remainingStock']
          ]}
        />
      )}

      {filters.companyId ? (
        <>
          <Table columns={columns} data={paginatedStatement} loading={isLoading} />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="empty-state">Select a company to view their statement.</div>
      )}
    </div>
  );
}


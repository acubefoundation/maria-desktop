import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { ArrowDown, ArrowUp, Funnel, DownloadSimple, FileXls, FilePdf } from '@phosphor-icons/react';
import { entriesApi, outingsApi, processingApi, companiesApi } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { Table, Pagination } from '../components/ui/Table';
import { Card, CardContent } from '../components/ui/Card';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import './ActivityTodayPage.css';

export function ActivityTodayPage() {
  const [activeTab, setActiveTab] = useState('intake');
  const [filters, setFilters] = useState({ 
    companyId: '', 
    page: 1,
    limit: 20 
  });

  const { data: companies } = useQuery({ 
    queryKey: ['companies'], 
    queryFn: () => companiesApi.list({ limit: 200 }) 
  });

  const intakeQueryKey = ['activity-intake', filters.companyId, filters.page, filters.limit];
  const { data: intakeData, isLoading: intakeLoading } = useQuery({ 
    queryKey: intakeQueryKey, 
    queryFn: () => entriesApi.list({ 
      companyId: filters.companyId || undefined,
      page: filters.page,
      limit: filters.limit 
    }),
    placeholderData: (prev) => prev
  });

  const dispatchQueryKey = ['activity-dispatch', filters.companyId, filters.page, filters.limit];
  const { data: dispatchData, isLoading: dispatchLoading } = useQuery({ 
    queryKey: dispatchQueryKey, 
    queryFn: () => outingsApi.list({ 
      companyId: filters.companyId || undefined,
      page: filters.page,
      limit: filters.limit 
    }),
    placeholderData: (prev) => prev
  });

  const processingQueryKey = ['activity-processing', filters.companyId, filters.page, filters.limit];
  const { data: processingData, isLoading: processingLoading } = useQuery({ 
    queryKey: processingQueryKey, 
    queryFn: () => processingApi.list({ 
      companyId: filters.companyId || undefined,
      page: filters.page,
      limit: filters.limit 
    }),
    placeholderData: (prev) => prev
  });

  const intakeColumns = [
    { key: 'batchNo', label: 'Batch No.', render: (v) => <span className="mono-link">{v}</span> },
    { key: 'entryDate', label: 'Date & Time', render: (v) => formatEthiopian(new Date(v), { includeTime: true }) },
    { key: 'company', label: 'Company', render: (_, row) => row.company?.name || '—' },
    { key: 'grade', label: 'Grade' },
    { key: 'origin', label: 'Origin', render: (_, row) => row.origin?.name || row.originText || '—' },
    { key: 'bags', label: 'Bags', align: 'right', render: (v) => (v || 0).toLocaleString() },
    { key: 'kg', label: 'Weight (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'driver', label: 'Driver', render: (_, row) => row.driver?.name || '—' },
    { key: 'plateNumber', label: 'Truck Plate' },
  ];

  const dispatchColumns = [
    { key: 'dispatchNo', label: 'Dispatch No.', render: (v) => <span className="mono-link">{v}</span> },
    { key: 'dispatchDate', label: 'Date & Time', render: (v) => formatEthiopian(new Date(v), { includeTime: true }) },
    { key: 'company', label: 'Company', render: (_, row) => row.company?.name || '—' },
    { key: 'destination', label: 'Destination' },
    { key: 'purpose', label: 'Purpose', render: (v) => v },
    { key: 'bags', label: 'Bags', align: 'right', render: (v) => (v || 0).toLocaleString() },
    { key: 'kg', label: 'Weight (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'driver', label: 'Driver', render: (_, row) => row.driver?.name || '—' },
    { key: 'plateNumber', label: 'Truck Plate' },
  ];

  const processingColumns = [
    { key: 'batchNo', label: 'Batch No.', render: (_, row) => <span className="mono-link">{row.entry?.batchNo || row.batchNo}</span> },
    { key: 'processDate', label: 'Date & Time', render: (v) => formatEthiopian(new Date(v), { includeTime: true }) },
    { key: 'company', label: 'Company', render: (_, row) => row.entry?.company?.name || row.company?.name || '—' },
    { key: 'grade', label: 'Grade', render: (_, row) => row.entry?.grade || row.grade || '—' },
    { key: 'kgMoved', label: 'Processed (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'cleanKg', label: 'Clean (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'rejectKg', label: 'Reject (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'wasteKg', label: 'Waste (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'line', label: 'Line' },
    { key: 'operator', label: 'Operator', render: (_, row) => row.operator?.name || '—' },
  ];

  const getCurrentData = () => {
    switch (activeTab) {
      case 'intake': return intakeData;
      case 'dispatch': return dispatchData;
      case 'processing': return processingData;
    }
  };

  const getCurrentLoading = () => {
    switch (activeTab) {
      case 'intake': return intakeLoading;
      case 'dispatch': return dispatchLoading;
      case 'processing': return processingLoading;
    }
  };

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'intake': return intakeColumns;
      case 'dispatch': return dispatchColumns;
      case 'processing': return processingColumns;
    }
  };

  const getTabLabel = (tab) => {
    const labels = { intake: 'Intake (IN)', dispatch: 'Dispatch (OUT)', processing: 'Processing' };
    return labels[tab];
  };

  const currentData = getCurrentData();
  const currentLoading = getCurrentLoading();
  const currentColumns = getCurrentColumns();

  const allData = currentData?.data || [];
  const totalItems = currentData?.total ?? allData.length;
  const totalPages = currentData?.totalPages ?? Math.max(1, Math.ceil(totalItems / filters.limit));
  const paginatedData = allData.slice((filters.page - 1) * filters.limit, filters.page * filters.limit);

  const handleExport = () => {
    exportToExcel(allData, currentColumns, `Activity_${getTabLabel(activeTab)}`);
    exportToPdf(allData, currentColumns, `Activity_${getTabLabel(activeTab)}`, `${getTabLabel(activeTab)} Activity`);
  };

  return (
    <div className="activity-today-page">
      <div className="mocca-header">
        <div className="mocca-title-group">
          <span className="mocca-subtitle">ACTIVITY</span>
          <h1 className="mocca-title">All Activity</h1>
        </div>
      </div>

      <div className="activity-tabs">
        {['intake', 'dispatch', 'processing'].map(tab => (
          <button
            key={tab}
            className={`activity-tab-btn ${activeTab === tab ? 'activity-tab-btn--active' : ''}`}
            onClick={() => { setActiveTab(tab); setFilters(prev => ({ ...prev, page: 1 })); }}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      <div className="mocca-toolbar">
        <div className="toolbar__filters">
          <Select value={filters.companyId} onChange={(e) => setFilters(prev => ({ ...prev, companyId: e.target.value, page: 1 }))}>
            <option value="">All Clients</option>
            {companies?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={handleExport}>
            <FileXls size={16} /> Excel
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <FilePdf size={16} /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <Table columns={currentColumns} data={paginatedData} loading={currentLoading} />
          <Pagination
            page={filters.page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={filters.limit}
            onPageSizeChange={(newLimit) => setFilters(prev => ({ ...prev, limit: newLimit, page: 1 }))}
            onPageChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { auditApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Table, Pagination } from '../components/ui/Table';

export function AuditLogPage() {
  const { isAdmin } = useAuth();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { page, limit }],
    queryFn: () => auditApi.list({ page, limit }),
    enabled: isAdmin,
    placeholderData: (prev) => prev,
  });

  if (!isAdmin) {
    return <div className="mocca-page"><h2>Access Denied</h2></div>;
  }

  const columns = [
    { key: 'createdAt', label: 'Timestamp', render: (v) => formatEthiopian(new Date(v), { includeTime: true }) },
    { key: 'user', label: 'User', render: (_, row) => row.user?.name || 'System' },
    { key: 'action', label: 'Action' },
    { key: 'entity', label: 'Entity Type' },
    { key: 'entityId', label: 'Record ID' },
  ];

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group"><span className="mocca-subtitle">WORKSPACE</span><h1 className="mocca-title">Audit Log</h1></div>
      </div>
      <div className="mocca-table-wrap">
        <Table columns={columns} data={data?.data || []} loading={isLoading} />
        <Pagination
          page={data?.page || 1}
          totalPages={data?.totalPages || 1}
          onPageChange={setPage}
          pageSize={limit}
          onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
          totalItems={data?.total ?? 0}
        />
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowCounterClockwise, Trash, Buildings, Users } from '@phosphor-icons/react';
import { companiesApi, usersApi } from '../lib/api';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import './TrashPage.css';

const TABS = [
  { key: 'companies', label: 'Companies', Icon: Buildings },
  { key: 'users', label: 'Users', Icon: Users },
];

function formatDate(value) {
  if (!value) return '—';
  return formatEthiopian(new Date(value));
}

export function TrashPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('companies');
  const [restoreTarget, setRestoreTarget] = useState(null);

  const companiesQuery = useQuery({
    queryKey: ['companies-trash'],
    queryFn: () => companiesApi.trash(),
    enabled: isAdmin,
  });

  const usersQuery = useQuery({
    queryKey: ['users-trash'],
    queryFn: () => usersApi.trash(),
    enabled: isAdmin,
  });

  const restoreMut = useMutation({
    mutationFn: ({ type, id }) =>
      type === 'companies' ? companiesApi.restore(id) : usersApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies-trash'] });
      queryClient.invalidateQueries({ queryKey: ['users-trash'] });
      // Restore brings the record back into the live lists.
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setRestoreTarget(null);
    },
  });

  if (!isAdmin) {
    return (
      <div className="mocca-page">
        <h2>Access Denied</h2>
        <p>You need Administrator privileges to view this page.</p>
      </div>
    );
  }

  const companies = companiesQuery.data?.data || [];
  const users = usersQuery.data?.data || [];
  const counts = { companies: companies.length, users: users.length };
  const isEmpty = counts[activeTab] === 0;

  const companyColumns = [
    {
      key: 'name',
      label: 'Company',
      render: (_, row) => (
        <div className="user-col">
          <div className="user-info">
            <span>{row.name}</span>
            <span className="user-email">{row.code}</span>
          </div>
        </div>
      ),
    },
    { key: 'contactPerson', label: 'Contact', render: (v) => v || '—' },
    { key: 'phone', label: 'Phone', render: (v) => v || '—' },
    {
      key: 'history',
      label: 'History',
      render: (_, row) =>
        `${row._count?.entries ?? 0} entries · ${row._count?.outings ?? 0} outings`,
    },
    { key: 'status', label: 'Status', render: (v) => <Badge status={v} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (_, row) => (
        <button
          className="action-btn"
          onClick={() => {
            restoreMut.reset();
            setRestoreTarget({ type: 'companies', row });
          }}
          title="Restore company"
        >
          <ArrowCounterClockwise size={18} />
        </button>
      ),
    },
  ];

  const userColumns = [
    {
      key: 'name',
      label: 'User',
      render: (_, row) => (
        <div className="user-col">
          <div className="user-avatar">{row.name.charAt(0)}</div>
          <div className="user-info">
            <span>{row.name}</span>
            <span className="user-email">{row.email}</span>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (v) => <Badge status={v} /> },
    {
      key: 'company',
      label: 'Company',
      render: (_, row) => row.company?.name || '—',
    },
    { key: 'removedAt', label: 'Removed', render: (_, row) => formatDate(row.updatedAt) },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (_, row) => (
        <button
          className="action-btn"
          onClick={() => {
            restoreMut.reset();
            setRestoreTarget({ type: 'users', row });
          }}
          title="Restore user"
        >
          <ArrowCounterClockwise size={18} />
        </button>
      ),
    },
  ];

  const activeQuery = activeTab === 'companies' ? companiesQuery : usersQuery;
  const targetName = restoreTarget?.row?.name || '';

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group">
          <span className="mocca-subtitle">ADMINISTRATION</span>
          <h1 className="mocca-title">Trash</h1>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === key ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab(key)}
            role="tab"
            aria-selected={activeTab === key}
          >
            <Icon size={16} />
            {label}
            <span className="tab-count">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="mocca-table-wrap">
        {isEmpty ? (
          <div className="trash-empty">
            <Trash size={40} className="trash-empty__icon" />
            <span className="trash-empty__title">
              No removed {activeTab === 'companies' ? 'companies' : 'users'}
            </span>
            <span className="trash-empty__hint">
              Items you remove are kept here and can be restored at any time.
            </span>
          </div>
        ) : (
          <Table
            columns={activeTab === 'companies' ? companyColumns : userColumns}
            data={activeTab === 'companies' ? companies : users}
            loading={activeQuery.isLoading}
            emptyMessage="Nothing here."
          />
        )}
      </div>

      <Modal
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        size="sm"
        title="Restore Item"
        footer={
          <>
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                restoreMut.mutate({
                  type: restoreTarget?.type,
                  id: restoreTarget?.row.id,
                })
              }
              disabled={restoreMut.isPending || !restoreTarget}
            >
              {restoreMut.isPending ? 'Restoring...' : 'Restore'}
            </Button>
          </>
        }
      >
        {restoreMut.isError && (
          <div className="form-error" style={{ marginBottom: 12 }}>
            {restoreMut.error?.response?.data?.message || 'An error occurred'}
          </div>
        )}
        <p>
          Restore <strong>{targetName}</strong>?
        </p>
        <p style={{ marginTop: 12, color: 'var(--color-muted)' }}>
          {restoreTarget?.type === 'users'
            ? 'They will be able to log in again and will reappear in the user list.'
            : 'It will reappear in the company list and become selectable for new entries and outgoing stock.'}
        </p>
      </Modal>
    </div>
  );
}

export default TrashPage;

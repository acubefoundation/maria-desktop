import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, PencilSimple, Trash, FileXls, FilePdf } from '@phosphor-icons/react';
import { usersApi } from '../lib/api';
import { sortByName } from '../lib/utils';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import './UsersPage.css';

export function UsersPage() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'VIEWER', password: '' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, limit }],
    queryFn: () => usersApi.list({ page, limit }),
    placeholderData: (prev) => prev,
  });

  const sortedUsers = React.useMemo(() => {
    return sortByName(data?.data || []);
  }, [data]);

  const createMut = useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setIsModalOpen(false);
    }
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setIsModalOpen(false);
    }
  });

  const deactivateMut = useMutation({
    mutationFn: (id) => usersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setUserToRemove(null);
      setRemoveModalOpen(false);
    },
  });

  if (!isAdmin) {
    return <div className="mocca-page"><h2>Access Denied</h2><p>You need Administrator privileges to view this page.</p></div>;
  }

  const openAdd = () => {
    setModalMode('add');
    setFormData({ name: '', email: '', role: 'VIEWER', password: '' });
    setIsModalOpen(true);
  };

  const openEdit = (user) => {
    setModalMode('edit');
    setEditingUserId(user.id);
    setFormData({ name: user.name, email: user.email, role: user.role, password: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (modalMode === 'add') {
      createMut.mutate(formData);
    } else {
      const payload = { ...formData };
      if (!payload.password) delete payload.password; // don't update password if empty
      updateMut.mutate({ id: editingUserId, data: payload });
    }
  };

  const handleRemove = (targetUser) => {
    deactivateMut.reset();
    setUserToRemove(targetUser);
    setRemoveModalOpen(true);
  };

  const columns = [
    { key: 'name', label: 'User', exportValue: (row) => `${row.name} (${row.email})`, render: (_, row) => (
      <div className="user-col">
        <div className="user-avatar">{row.name.charAt(0)}</div>
        <div className="user-info">
          <span>{row.name}</span>
          <span className="user-email">{row.email}</span>
        </div>
      </div>
    )},
    { key: 'role', label: 'Role', render: (v) => <Badge status={v} />, exportValue: (row) => row.role },
    { key: 'isActive', label: 'Status', render: (v) => <Badge status={v ? 'ACTIVE' : 'INACTIVE'} />, exportValue: (row) => row.isActive ? 'ACTIVE' : 'INACTIVE' },
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => openEdit(row)} style={{ padding: 6, color: 'var(--color-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Edit User">
          <PencilSimple size={16} />
        </button>
        <button
          onClick={() => handleRemove(row)}
          disabled={row.id === user?.id}
          title={row.id === user?.id ? 'You cannot remove your own account' : 'Remove User'}
          style={{
            padding: 6,
            color: row.id === user?.id ? 'var(--color-muted)' : 'var(--color-error)',
            background: 'transparent',
            border: 'none',
            cursor: row.id === user?.id ? 'not-allowed' : 'pointer',
            opacity: row.id === user?.id ? 0.5 : 1,
          }}
        >
          <Trash size={16} />
        </button>
      </div>
    )}
  ];

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group"><span className="mocca-subtitle">WORKSPACE</span><h1 className="mocca-title">User Management</h1></div>
        <div style={{display: 'flex', gap: 12}}>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToExcel(sortedUsers, columns, 'Users')}>
            <FileXls size={18} weight="regular" /> Export Excel
          </button>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToPdf(sortedUsers, columns, 'Users', 'Users Directory')}>
            <FilePdf size={18} weight="regular" /> Export PDF
          </button>
          <button className="mocca-header-btn" onClick={openAdd}>
            <Plus size={18} weight="bold" /> Add User
          </button>
        </div>
      </div>
      <div className="mocca-table-wrap">
        <Table columns={columns} data={sortedUsers} loading={isLoading} />
        <Pagination
          page={data?.page || 1}
          totalPages={data?.totalPages || 1}
          onPageChange={setPage}
          pageSize={limit}
          onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
          totalItems={data?.total ?? 0}
        />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        size="lg"
        title={modalMode === 'add' ? 'Add New User' : 'Edit User'}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMut.isPending ||
                updateMut.isPending ||
                !formData.name.trim() ||
                !formData.email.trim() ||
                (modalMode === 'add' && formData.password.length < 6)
              }
            >
              {modalMode === 'add' ? 'Create User' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className="form-section-card">
          {(createMut.isError || updateMut.isError) && (
            <div className="form-error">
              {Array.isArray(createMut.error?.response?.data?.message) 
                ? createMut.error.response.data.message.join(', ')
                : Array.isArray(updateMut.error?.response?.data?.message)
                ? updateMut.error.response.data.message.join(', ')
                : (createMut.error?.response?.data?.message || updateMut.error?.response?.data?.message || 'An error occurred')}
            </div>
          )}
          <div className="form-row">
            <Input
              label="Full Name"
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g.Samuel Tadesse"
            />
            <Input
              label="Email Address"
              required
              type="email"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              placeholder="user@warehouse.com"
            />
          </div>
          <div className="form-row">
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                System Role <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>*</span>
              </label>
              <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer (Read Only)</SelectItem>
                  <SelectItem value="COMPANY_VIEWER">Company Viewer</SelectItem>
                  <SelectItem value="WAREHOUSE_MANAGER">Warehouse Manager</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              label={modalMode === 'add' ? 'Password' : 'New Password (optional)'}
              required={modalMode === 'add'}
              type="password"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              placeholder={modalMode === 'add' ? 'Minimum 6 characters' : 'Leave blank to keep current'}
            />
          </div>
        </div>
      </Modal>

      {/* Remove User Confirmation */}
      <Modal
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        size="sm"
        title="Remove User"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveModalOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deactivateMut.mutate(userToRemove?.id)}
              disabled={deactivateMut.isPending || !userToRemove}
            >
              {deactivateMut.isPending ? 'Removing...' : 'Remove User'}
            </Button>
          </>
        }
      >
        {deactivateMut.isError && (
          <div className="form-error" style={{ marginBottom: 12 }}>
            {deactivateMut.error?.response?.data?.message || 'An error occurred'}
          </div>
        )}
        <p>
          Are you sure you want to remove <strong>{userToRemove?.name}</strong> ({userToRemove?.email})?
        </p>
        <p style={{ marginTop: 12, color: 'var(--color-muted)' }}>
          They will be signed out immediately and will no longer be able to log in. Their past records
          and history are kept for the audit trail, but this user will no longer appear in the user list.
        </p>
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, MagnifyingGlass, PencilSimple, Trash, FileXls, FilePdf } from '@phosphor-icons/react';
import { driversApi } from '../lib/api';
import { sortByName } from '../lib/utils';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Table, Pagination } from '../components/ui/Table';
import { Modal, SlideOver } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import './DriversPage.css';

const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  licenseNo: z.string().optional(),
  idNumber: z.string().optional(),
  plates: z.string().optional(),
});

export function DriversPage() {
  const { canWrite, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  
  const [slideOpen, setSlideOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [selectedDriver, setSelectedDriver] = useState(null);
  
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', { search: debouncedSearch, page, limit }],
    queryFn: () => driversApi.list({ search: debouncedSearch, page, limit }),
  });

  const sortedDrivers = React.useMemo(() => {
    return sortByName(data?.data || []);
  }, [data]);

  const createMut = useMutation({
    mutationFn: driversApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setSlideOpen(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => driversApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setSlideOpen(false);
    },
  });

  const deactivateMut = useMutation({
    mutationFn: driversApi.deactivate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setDeleteModal(false);
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(driverSchema),
  });

  const handleCreateNew = () => {
    reset({ name: '', phone: '', licenseNo: '', idNumber: '', plates: '' });
    setMode('create');
    setSlideOpen(true);
  };

  const handleEdit = (driver) => {
    reset({
      name: driver.name,
      phone: driver.phone,
      licenseNo: driver.licenseNo || '',
      idNumber: driver.idNumber || '',
      plates: driver.plates?.join(', ') || '',
    });
    setSelectedDriver(driver);
    setMode('edit');
    setSlideOpen(true);
  };

  const handleDelete = (driver) => {
    setSelectedDriver(driver);
    setDeleteModal(true);
  };

  const onSubmit = (formData) => {
    const data = { ...formData };
    if (data.plates) {
      data.plates = data.plates.split(',').map(p => p.trim()).filter(Boolean);
    } else {
      data.plates = [];
    }

    if (mode === 'create') {
      createMut.mutate(data);
    } else {
      updateMut.mutate({ id: selectedDriver.id, data });
    }
  };

  const columns = [
    { key: 'name', label: 'Driver Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'licenseNo', label: 'License No.', render: (v) => v || '—' },
    { key: 'plates', label: 'Registered Plates', render: (v) => v?.join(', ') || '—', exportValue: (row) => row.plates?.join(', ') || '' },
    { key: 'totalTrips', label: 'Trips (In/Out)', align: 'right', render: (_, row) => `${row.entryTrips || 0} / ${row.outingTrips || 0}`, exportValue: (row) => `${row.entryTrips || 0} / ${row.outingTrips || 0}` },
    { key: 'isActive', label: 'Status', render: (v) => <Badge status={v ? 'ACTIVE' : 'INACTIVE'} />, exportValue: (row) => row.isActive ? 'ACTIVE' : 'INACTIVE' },
    {
      key: 'actions',
      label: '',
      align: 'right',
      excludeFromExport: true,
      render: (_, row) => (
        <div className="table-actions">
          {canWrite && (
            <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}>
              <PencilSimple size={18} />
            </button>
          )}
          {canWrite && row.isActive && (
            <button className="action-btn action-btn--danger" onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>
              <Trash size={18} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group"><span className="mocca-subtitle">WORKSPACE</span><h1 className="mocca-title">Drivers & Logistics</h1></div>
        <div style={{display: 'flex', gap: 12}}>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToExcel(sortedDrivers, columns, 'Drivers')}>
            <FileXls size={18} weight="regular" /> Export Excel
          </button>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToPdf(sortedDrivers, columns, 'Drivers', 'Drivers Directory')}>
            <FilePdf size={18} weight="regular" /> Export PDF
          </button>
          {canWrite && (
            <button className="mocca-header-btn" onClick={handleCreateNew}><Plus size={18} weight="regular" /> New Driver
            </button>
          )}
        </div>
      </div>

      <div className="mocca-toolbar">
        <div className="mocca-search">
          <MagnifyingGlass size={18} className="mocca-search__icon" />
          <input
            type="text"
            placeholder="Search by name, phone, plate..."
            className="mocca-search__input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mocca-table-wrap">
        <Table
          columns={columns}
          data={sortedDrivers}
          loading={isLoading}
        />
        {data && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
            pageSize={limit}
            onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
            totalItems={data.total ?? 0}
          />
        )}
      </div>

      <SlideOver
        isOpen={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={mode === 'create' ? 'New Driver' : 'Edit Driver'}
      >
        <form className="slide-form" onSubmit={handleSubmit(onSubmit)}>
          {(createMut.isError || updateMut.isError) && (
            <div className="form-error">
              {createMut.error?.response?.data?.message ||
                updateMut.error?.response?.data?.message ||
                'Could not save driver. Please verify required fields.'}
            </div>
          )}

          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">1. Driver Contact Details</h4>
              <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                <strong style={{ color: 'var(--color-error)' }}>*</strong> Required
              </span>
            </div>
            <div className="form-row">
              <Input
                label="Driver Full Name"
                placeholder="e.g. Abebe Kebede"
                required
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Phone Number"
                placeholder="e.g. +251 911 000000"
                required
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>
          </div>

          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">2. License & Registered Truck Plates</h4>
            </div>
            <div className="form-row">
              <Input
                label="Driving License No. (Optional)"
                placeholder="e.g. ETH-48291"
                error={errors.licenseNo?.message}
                {...register('licenseNo')}
              />
              <Input
                label="National ID No. (Optional)"
                placeholder="e.g. ID-102938"
                error={errors.idNumber?.message}
                {...register('idNumber')}
              />
            </div>
            <Input
              label="Registered Truck Plates (comma-separated)"
              placeholder="e.g. AA-3-12345, OR-3-67890"
              hint="Enter one or more truck plate numbers separated by commas"
              error={errors.plates?.message}
              {...register('plates')}
            />
          </div>

          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setSlideOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={createMut.isPending || updateMut.isPending}>
              {mode === 'create' ? 'Save Driver' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </SlideOver>

      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Deactivate Driver"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" loading={deactivateMut.isPending} onClick={() => deactivateMut.mutate(selectedDriver?.id)}>Deactivate</Button>
          </>
        }
      >
        <p>Are you sure you want to deactivate {selectedDriver?.name}? They will no longer appear in driver selection dropdowns.</p>
      </Modal>
    </div>
  );
}

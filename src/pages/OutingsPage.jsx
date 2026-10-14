import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { toLocalNaive, pickerValueToIso } from '../lib/localDate';
import {
  Plus,
  MagnifyingGlass,
  FileXls,
  FilePdf,
  Printer,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { outingsApi, companiesApi, entriesApi, driversApi } from '../lib/api';
import { sortByName } from '../lib/utils';
import { exportToExcel, exportToPdf, exportWaybillPdf } from '../lib/exportUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal, SlideOver } from '../components/ui/Modal';
import { EthiopianDatePicker } from '../components/ui/EthiopianDatePicker';
import './OutingsPage.css';

const editOutingSchema = z.object({
  entryId: z.string().min(1, 'Source batch is required'),
  bags: z.coerce.number().min(0, 'Cannot be negative').default(0),
  kg: z.coerce.number().positive('Weight (KG) must be greater than 0'),
  destination: z.string().optional(),
  purpose: z.enum(['EXPORT', 'INTERNAL_TRANSFER', 'RETURN_TO_SUPPLIER']),
  dispatchDate: z.string().min(1, 'Dispatch date & time is required'),
  plateNumber: z.string().min(1, 'Truck plate number is required'),
  driverId: z.string().min(1, 'Driver is required'),
  approvedBy: z.string().optional(),
});

export function OutingsPage() {
  const { canWrite, isCompanyViewer, isAdmin, user } = useAuth();

  // Managers may only edit dispatches they released themselves; admins may edit any.
  const canModifyOuting = (row) => isAdmin || row?.releasedBy?.id === user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filters, setFilters] = useState({ companyId: '', purpose: '' });

  // Edit & Delete Modal States
  const [editOpen, setEditOpen] = useState(false);
  const [editingOuting, setEditingOuting] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [outingToDelete, setOutingToDelete] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: companiesData } = useQuery({
    queryKey: ['companies', { limit: 200 }],
    queryFn: () => companiesApi.list({ limit: 200 }),
    enabled: !isCompanyViewer,
  });

  const { data: entriesData } = useQuery({
    queryKey: ['entries-stock'],
    queryFn: () => entriesApi.list({ limit: 500 }),
    enabled: editOpen,
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers', { limit: 200 }],
    queryFn: () => driversApi.list({ limit: 200 }),
    enabled: editOpen,
  });

  const sortedCompanies = React.useMemo(
    () => sortByName(companiesData?.data || []),
    [companiesData],
  );
  const sortedDrivers = React.useMemo(
    () => sortByName(driversData?.data || []),
    [driversData],
  );
  const sortedEntries = React.useMemo(() => {
    return [...(entriesData?.data || [])].sort((a, b) => {
      const compCompare = (a.company?.name || '').localeCompare(
        b.company?.name || '',
        undefined,
        { sensitivity: 'base' },
      );
      if (compCompare !== 0) return compCompare;
      return (a.batchNo || '').localeCompare(b.batchNo || '', undefined, {
        numeric: true,
      });
    });
  }, [entriesData]);

  const { data, isLoading } = useQuery({
    queryKey: ['outings', { search: debouncedSearch, ...filters, page, limit }],
    queryFn: () => outingsApi.list({ search: debouncedSearch, ...filters, page, limit }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => outingsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outings'] });
      queryClient.invalidateQueries({ queryKey: ['entries-stock'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setEditOpen(false);
      setEditingOuting(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => outingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outings'] });
      queryClient.invalidateQueries({ queryKey: ['entries-stock'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setDeleteOpen(false);
      setOutingToDelete(null);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editOutingSchema),
  });

  const handleOpenEdit = (e, row) => {
    e.stopPropagation();
    setEditingOuting(row);
    const formattedDate = row.dispatchDate
      ? toLocalNaive(new Date(row.dispatchDate))
      : toLocalNaive(new Date());
    reset({
      entryId: row.entryId || row.entry?.id || '',
      bags: row.bags ?? 0,
      kg: row.kg ?? '',
      destination: row.destination || '',
      purpose: row.purpose || 'EXPORT',
      dispatchDate: formattedDate,
      plateNumber: row.plateNumber || '',
      driverId: row.driverId || row.driver?.id || '',
      approvedBy: row.approvedBy || '',
    });
    setEditOpen(true);
  };

  const handleOpenDelete = (e, row) => {
    e.stopPropagation();
    setOutingToDelete(row);
    setDeleteOpen(true);
  };

  const onEditSubmit = (formData) => {
    if (!editingOuting) return;
    const payload = { ...formData };
    if (!payload.approvedBy) delete payload.approvedBy;
    payload.dispatchDate = pickerValueToIso(payload.dispatchDate);
    updateMut.mutate({ id: editingOuting.id, payload });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const columns = [
    {
      key: 'dispatchNo',
      label: 'Dispatch No.',
      render: (v) => <span className="mono-link">{v}</span>,
    },
    {
      key: 'entry',
      label: 'Batch No.',
      render: (_, row) => (
        <Link
          to={`/entries/${row.entryId}`}
          className="mono-link"
          onClick={(e) => e.stopPropagation()}
        >
          {row.entry?.batchNo}
        </Link>
      ),
      exportValue: (row) => row.entry?.batchNo,
    },
    {
      key: 'company',
      label: 'Company',
      render: (_, row) => row.company?.name || '—',
      exportValue: (row) => row.company?.name || '',
    },
    { key: 'grade', label: 'Grade' },
    { key: 'kg', label: 'Weight (KG)', align: 'right', render: (v) => `${(v || 0).toLocaleString()} KG` },
    { key: 'destination', label: 'Destination', render: (v) => v || '—' },
    {
      key: 'purpose',
      label: 'Purpose',
      render: (v) => <Badge status={v} />,
      exportValue: (row) => row.purpose,
    },
    {
      key: 'dispatchDate',
      label: 'Date',
      render: (v) => formatEthiopian(new Date(v)),
      exportValue: (row) => formatEthiopian(new Date(row.dispatchDate)),
    },
    {
      key: 'driver',
      label: 'Driver',
      render: (_, row) => row.driver?.name || '—',
      exportValue: (row) => row.driver?.name || '',
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      excludeFromExport: true,
      render: (_, row) => (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="action-btn"
            title="Print Waybill"
            aria-label="Print Waybill"
            onClick={(e) => {
              e.stopPropagation();
              exportWaybillPdf(row);
            }}
          >
            <Printer size={17} />
          </button>
          {canWrite && canModifyOuting(row) && (
            <>
              <button
                type="button"
                className="action-btn"
                title="Edit Dispatch"
                aria-label="Edit Dispatch"
                onClick={(e) => handleOpenEdit(e, row)}
              >
                <PencilSimple size={17} />
              </button>
              <button
                type="button"
                className="action-btn action-btn--danger"
                title="Delete Dispatch"
                aria-label="Delete Dispatch"
                onClick={(e) => handleOpenDelete(e, row)}
              >
                <Trash size={17} />
              </button>
            </>
          )}
          {canWrite && !canModifyOuting(row) && (
            <span
              title="You can only edit dispatches you released"
              style={{ fontSize: 11, color: 'var(--color-tertiary)' }}
            >
              View only
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group">
          <span className="mocca-subtitle">WORKSPACE</span>
          <h1 className="mocca-title">Coffee Out (Dispatches)</h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="mocca-header-btn mocca-header-btn--outline"
            onClick={() => exportToExcel(data?.data || [], columns, 'Coffee_Outings')}
          >
            <FileXls size={18} weight="regular" /> Export Excel
          </button>
          <button
            className="mocca-header-btn mocca-header-btn--outline"
            onClick={() =>
              exportToPdf(data?.data || [], columns, 'Coffee_Outings', 'Coffee Out Log')
            }
          >
            <FilePdf size={18} weight="regular" /> Export PDF
          </button>
          {canWrite && (
            <Link to="/outings/new" className="mocca-header-btn" style={{ textDecoration: 'none' }}>
              <Plus size={18} weight="regular" /> New Dispatch
            </Link>
          )}
        </div>
      </div>

      <div className="mocca-toolbar">
        <div className="mocca-search">
          <MagnifyingGlass size={18} className="mocca-search__icon" />
          <input
            type="text"
            placeholder="Search dispatch no, destination, plate..."
            className="mocca-search__input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar__filters">
          {!isCompanyViewer && (
            <Select
              value={filters.companyId}
              onChange={(e) => handleFilterChange('companyId', e.target.value)}
            >
              <option value="">All Clients</option>
              {sortedCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contactPerson || c.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            value={filters.purpose}
            onChange={(e) => handleFilterChange('purpose', e.target.value)}
          >
            <option value="">All Purposes</option>
            <option value="EXPORT">Export</option>
            <option value="INTERNAL_TRANSFER">Internal Transfer</option>
            <option value="RETURN_TO_SUPPLIER">Return to Supplier</option>
          </Select>
        </div>
      </div>

      <div className="mocca-table-wrap">
        <Table
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          onRowClick={(row) => navigate(`/entries/${row.entryId}`)}
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

      {/* EDIT DISPATCH DRAWER */}
      <SlideOver
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        size="lg"
        title={`Edit Coffee Dispatch — ${editingOuting?.dispatchNo || ''}`}
      >
        <form className="slide-form" onSubmit={handleSubmit(onEditSubmit)}>
          {updateMut.isError && (
            <div className="form-error">
              {updateMut.error?.response?.data?.message ||
                'Could not update dispatch. Please verify the required fields.'}
            </div>
          )}

          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">1. Source Batch & Quantity</h4>
              <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                <strong style={{ color: 'var(--color-error)' }}>*</strong> Required
              </span>
            </div>
            <Select
              label="Source Coffee Batch"
              required
              error={errors.entryId?.message}
              {...register('entryId')}
            >
              <option value="">Select source batch...</option>
              {sortedEntries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.batchNo} ({e.company?.name}) — {e.grade}
                </option>
              ))}
            </Select>
            <Input
              label="Dispatch Weight (KG)"
              type="number"
              step="0.01"
              required
              error={errors.kg?.message}
              {...register('kg')}
            />
          </div>

          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">2. Destination, Purpose & Date</h4>
            </div>
            <div className="form-row">
              <Input
                label="Destination (Optional)"
                error={errors.destination?.message}
                {...register('destination')}
              />
              <Select
                label="Dispatch Purpose"
                required
                error={errors.purpose?.message}
                {...register('purpose')}
              >
                <option value="EXPORT">Export</option>
                <option value="INTERNAL_TRANSFER">Internal Transfer</option>
                <option value="RETURN_TO_SUPPLIER">Return to Supplier</option>
              </Select>
            </div>
            <div className="form-row">
              <EthiopianDatePicker
                label="Dispatch Date & Time"
                showTime
                required
                error={errors.dispatchDate?.message}
                {...register('dispatchDate')}
                value={watch('dispatchDate')}
                onChange={(v) =>
                  setValue('dispatchDate', v, { shouldDirty: true, shouldValidate: true })
                }
              />
              <Input
                label="Approved By (Optional)"
                error={errors.approvedBy?.message}
                {...register('approvedBy')}
              />
            </div>
          </div>

          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">3. Driver & Truck Plate</h4>
            </div>
            <div className="form-row">
              <Select
                label="Driver"
                required
                error={errors.driverId?.message}
                {...register('driverId')}
              >
                <option value="">Select driver...</option>
                {sortedDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Truck Plate Number"
                required
                error={errors.plateNumber?.message}
                {...register('plateNumber')}
              />
            </div>
          </div>

          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={updateMut.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </SlideOver>

      {/* DELETE DISPATCH MODAL */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Coffee Dispatch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMut.isPending}
              onClick={() => outingToDelete && deleteMut.mutate(outingToDelete.id)}
            >
              Delete Dispatch
            </Button>
          </>
        }
      >
        <p style={{ lineHeight: 1.5 }}>
          Are you sure you want to delete Dispatch{' '}
          <strong>{outingToDelete?.dispatchNo}</strong> ({(outingToDelete?.kg || 0).toLocaleString()}{' '}
          KG{outingToDelete?.destination ? ` to ${outingToDelete.destination}` : ''})?
        </p>
        <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-tertiary)' }}>
          The dispatched coffee quantity will be automatically restored to batch{' '}
          <strong>{outingToDelete?.entry?.batchNo}</strong>'s available warehouse balance.
        </p>
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  MagnifyingGlass,
  FileXls,
  FilePdf,
  Info,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { entriesApi, companiesApi, driversApi, settingsApi } from '../lib/api';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { toLocalNaive, pickerValueToIso } from '../lib/localDate';
import { sortByName } from '../lib/utils';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { ProcessingStatusTooltip } from '../components/ui/ProcessingStatusTooltip';
import { Modal, SlideOver } from '../components/ui/Modal';
import { EthiopianDatePicker } from '../components/ui/EthiopianDatePicker';
import { COFFEE_GRADES } from '../lib/constants';
import './CoffeeEntriesPage.css';

const editEntrySchema = z.object({
  companyId: z.string().min(1, 'Supplier / Company is required'),
  entryDate: z.string().min(1, 'Entry date is required'),
  batchNo: z.string().min(1, 'Batch code is required'),
  grade: z.string().optional(),
  bags: z.coerce.number().min(1, 'At least 1 bag is required'),
  kg: z.coerce.number().positive('Weight (KG) must be greater than 0'),
  originId: z.string().optional(),
  supplierDispatchNo: z.string().optional(),
  plateNumber: z.string().min(1, 'Truck plate number is required'),
  driverId: z.string().min(1, 'Driver is required'),
  locationId: z.string().optional(),
  remarks: z.string().optional(),
});

export function CoffeeEntriesPage() {
  const { canWrite, isCompanyViewer, isAdmin, user } = useAuth();

  // Managers may only edit entries they received themselves; admins may edit any.
  const canModifyEntry = (row) => isAdmin || row?.receivedBy?.id === user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filters, setFilters] = useState({
    companyId: '',
    grade: '',
    status: '',
  });

  // Edit & Delete Modal States
  const [editOpen, setEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

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

  const { data: driversData } = useQuery({
    queryKey: ['drivers', { limit: 200 }],
    queryFn: () => driversApi.list({ limit: 200 }),
    enabled: editOpen,
  });

  const { data: originsData } = useQuery({
    queryKey: ['origins'],
    queryFn: () => settingsApi.origins(),
    enabled: editOpen,
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => settingsApi.locations(),
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
  const sortedOrigins = React.useMemo(
    () => sortByName(originsData?.data || originsData || []),
    [originsData],
  );
  const sortedLocations = React.useMemo(
    () => sortByName(locationsData?.data || locationsData || []),
    [locationsData],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['entries', { search: debouncedSearch, ...filters, page, limit }],
    queryFn: () => entriesApi.list({ search: debouncedSearch, ...filters, page, limit }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => entriesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-stock'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setEditOpen(false);
      setEditingEntry(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => entriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-stock'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setDeleteOpen(false);
      setEntryToDelete(null);
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
    resolver: zodResolver(editEntrySchema),
  });

  const handleOpenEdit = (e, row) => {
    e.stopPropagation();
    setEditingEntry(row);
    const formattedDate = row.entryDate
      ? toLocalNaive(new Date(row.entryDate))
      : toLocalNaive(new Date());
    reset({
      companyId: row.companyId || row.company?.id || '',
      entryDate: formattedDate,
      batchNo: row.batchNo || '',
      grade: row.grade || '',
      bags: row.bags ?? '',
      kg: row.kg ?? '',
      originId: row.originId || row.origin?.id || '',
      supplierDispatchNo: row.supplierDispatchNo || '',
      plateNumber: row.plateNumber || '',
      driverId: row.driverId || row.driver?.id || '',
      locationId: row.locationId || row.location?.id || '',
      remarks: row.remarks || '',
    });
    setEditOpen(true);
  };

  const handleOpenDelete = (e, row) => {
    e.stopPropagation();
    setEntryToDelete(row);
    setDeleteOpen(true);
  };

  const onEditSubmit = (formData) => {
    if (!editingEntry) return;
    const payload = { ...formData };
    if (!payload.originId) delete payload.originId;
    if (!payload.locationId) delete payload.locationId;
    payload.entryDate = pickerValueToIso(payload.entryDate);
    updateMut.mutate({ id: editingEntry.id, payload });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const wBags = Number(watch('bags')) || 0;
  const wKg = Number(watch('kg')) || 0;
  const avgBagWeight = wBags > 0 && wKg > 0 ? (wKg / wBags).toFixed(2) : null;

  const columns = [
    {
      key: 'batchNo',
      label: 'Batch No.',
      render: (v, row) => (
        <span className="mono-link" style={{ cursor: 'pointer' }} onClick={() => navigate(`/entries/${row.id}`)}>
          {v}
        </span>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      render: (_, row) => row.company?.name || '—',
      exportValue: (row) => row.company?.name || '',
    },
    {
      key: 'entryDate',
      label: 'Date',
      render: (v) => formatEthiopian(new Date(v)),
      exportValue: (row) => formatEthiopian(new Date(row.entryDate)),
    },
    { key: 'grade', label: 'Grade' },
    { key: 'bags', label: 'Bags', align: 'right', render: (v) => (v || 0).toLocaleString() },
    { key: 'kg', label: 'KG', align: 'right', render: (v) => (v || 0).toLocaleString() },
    {
      key: 'origin',
      label: 'Origin',
      render: (_, row) => row.origin?.name || row.originText || '—',
      exportValue: (row) => row.origin?.name || row.originText || '',
    },
    { key: 'plateNumber', label: 'Plate' },
    {
      key: 'status',
      label: 'Status',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Badge status={v} />
          {(v === 'PARTIALLY_PROCESSED' ||
            v === 'FULLY_PROCESSED' ||
            v === 'PROCESSED' ||
            v === 'IN_CLEANING' ||
            (row.kgMoved || 0) > 0) && <ProcessingStatusTooltip row={row} />}
        </div>
      ),
      exportValue: (row) => row.status,
    },
    ...(canWrite
      ? [
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
                {canModifyEntry(row) ? (
                  <>
                    <button
                      type="button"
                      className="action-btn"
                      title="Edit Coffee Entry"
                      aria-label="Edit Coffee Entry"
                      onClick={(e) => handleOpenEdit(e, row)}
                    >
                      <PencilSimple size={17} />
                    </button>
                    <button
                      type="button"
                      className="action-btn action-btn--danger"
                      title="Delete Coffee Entry"
                      aria-label="Delete Coffee Entry"
                      onClick={(e) => handleOpenDelete(e, row)}
                    >
                      <Trash size={17} />
                    </button>
                  </>
                ) : (
                  <span
                    title="You can only edit entries you received"
                    style={{ fontSize: 11, color: 'var(--color-tertiary)' }}
                  >
                    View only
                  </span>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group">
          <span className="mocca-subtitle">WORKSPACE</span>
          <h1 className="mocca-title">Coffee In (Entries)</h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="mocca-header-btn mocca-header-btn--outline"
            onClick={() => exportToExcel(data?.data || [], columns, 'Coffee_Entries')}
          >
            <FileXls size={18} weight="regular" /> Export Excel
          </button>
          <button
            className="mocca-header-btn mocca-header-btn--outline"
            onClick={() =>
              exportToPdf(data?.data || [], columns, 'Coffee_Entries', 'Coffee In Log')
            }
          >
            <FilePdf size={18} weight="regular" /> Export PDF
          </button>
          {canWrite && (
            <Link to="/entries/new" className="mocca-header-btn" style={{ textDecoration: 'none' }}>
              <Plus size={18} weight="regular" /> New Entry
            </Link>
          )}
        </div>
      </div>

      <div className="mocca-toolbar">
        <div className="mocca-search">
          <MagnifyingGlass size={18} className="mocca-search__icon" />
          <input
            type="text"
            placeholder="Search batch, plate, dispatch no..."
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

          <Select value={filters.grade} onChange={(e) => handleFilterChange('grade', e.target.value)}>
            <option value="">All Grades</option>
            {COFFEE_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>

          <Select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="IN_STOCK_UNPROCESSED">Unprocessed</option>
            <option value="IN_CLEANING">In Cleaning</option>
            <option value="PARTIALLY_PROCESSED">Partially Processed</option>
            <option value="FULLY_PROCESSED">Fully Processed</option>
            <option value="DISPATCHED">Dispatched</option>
          </Select>
        </div>
      </div>

      <div className="mocca-table-wrap">
        <Table
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          onRowClick={(row) => navigate(`/entries/${row.id}`)}
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

      {/* EDIT COFFEE ENTRY DRAWER */}
      <SlideOver
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        size="lg"
        title={`Edit Coffee Entry — ${editingEntry?.batchNo || ''}`}
      >
        <form className="slide-form" onSubmit={handleSubmit(onEditSubmit)}>
          {updateMut.isError && (
            <div className="form-error">
              {updateMut.error?.response?.data?.message ||
                'Could not update coffee entry. Please verify the fields.'}
            </div>
          )}

          <div className="form-section-card">
<div className="form-section-header">
              <h4 className="form-section-title">1. Supplier, Origin & Coffee Grade</h4>
              <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                <strong style={{ color: 'var(--color-error)' }}>*</strong> Required
              </span>
            </div>
            <div className="form-row">
              <Select
                label="Client / Supplier"
                required
                error={errors.companyId?.message}
                {...register('companyId')}
              >
                <option value="">Select client / supplier...</option>
                {sortedCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contactPerson || c.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Coffee Grade"
                error={errors.grade?.message}
                {...register('grade')}
              >
                <option value="">Select grade...</option>
                {COFFEE_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
            <div className="form-row">
              <Select label="Coffee Origin" error={errors.originId?.message} {...register('originId')}>
                <option value="">Select origin...</option>
                {sortedOrigins.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
              <EthiopianDatePicker
                label="Reception Date & Time"
                showTime
                required
                error={errors.entryDate?.message}
                {...register('entryDate')}
                value={watch('entryDate')}
                onChange={(v) =>
                  setValue('entryDate', v, { shouldDirty: true, shouldValidate: true })
                }
              />
            </div>

            <div className="form-row">
              <Input
                label="Batch Code"
                required
                error={errors.batchNo?.message}
                {...register('batchNo')}
              />
            </div>
          </div>

          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">2. Batch Quantity & Weight</h4>
              {avgBagWeight && (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-clean)' }}>
                  Avg: {avgBagWeight} KG / bag
                </span>
              )}
            </div>
            <div className="form-row">
              <Input
                label="Total Bags"
                type="number"
                required
                error={errors.bags?.message}
                {...register('bags')}
              />
              <Input
                label="Total Weight (KG)"
                type="number"
                step="0.01"
                required
                error={errors.kg?.message}
                {...register('kg')}
              />
            </div>
          </div>

          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">3. Transport & Warehouse Location</h4>
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
            <div className="form-row">
              <Input
                label="Supplier Dispatch / Waybill No."
                error={errors.supplierDispatchNo?.message}
                {...register('supplierDispatchNo')}
              />
              <Select
                label="Warehouse Location"
                error={errors.locationId?.message}
                {...register('locationId')}
              >
                <option value="">Select location (optional)...</option>
                {sortedLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Notes (Optional)"
              placeholder="Any additional remarks..."
              error={errors.remarks?.message}
              {...register('remarks')}
            />
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

      {/* DELETE COFFEE ENTRY MODAL */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Coffee Entry"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMut.isPending}
              onClick={() => entryToDelete && deleteMut.mutate(entryToDelete.id)}
            >
              Delete Entry
            </Button>
          </>
        }
      >
        <p style={{ lineHeight: 1.5 }}>
          Are you sure you want to permanently delete Coffee Entry{' '}
          <strong>{entryToDelete?.batchNo}</strong> ({entryToDelete?.company?.name} —{' '}
          {(entryToDelete?.kg || 0).toLocaleString()} KG)?
        </p>
        <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-tertiary)' }}>
          This will also remove any processing or dispatch logs linked to this batch and update
          warehouse stock totals.
        </p>
      </Modal>
    </div>
  );
}

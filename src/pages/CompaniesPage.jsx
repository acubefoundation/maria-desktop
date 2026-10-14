import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, MagnifyingGlass, PencilSimple, Trash, Buildings, FileXls, FilePdf, ArrowDown, ArrowUp, Funnel, Hourglass, CheckCircle, WarningCircle, Package, Scales, ArrowRight } from '@phosphor-icons/react';
import { companiesApi, usersApi } from '../lib/api';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { sortByName } from '../lib/utils';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal, SlideOver } from '../components/ui/Modal';
import { useNavigate } from 'react-router-dom';
import './CompaniesPage.css';

const companySchema = z.object({
  name: z.string().optional(),
  contactPerson: z.string().min(1, 'Contact person is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Valid email is required'),
  address: z.string().optional(),
  region: z.string().optional(),
  logo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const accountSchema = z
  .object({
    userName: z.string().min(1, 'Contact name is required'),
    userEmail: z.string().email('A valid login email is required'),
    userPassword: z.string().min(6, 'Minimum 6 characters'),
    userPasswordConfirm: z.string().min(6, 'Minimum 6 characters'),
  })
  .refine((d) => d.userPassword === d.userPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['userPasswordConfirm'],
  });

function fmt(v) {
  return Number(v ?? 0).toLocaleString();
}

function SummaryRow({ icon, label, amount, secondary, tone = 'default', highlight = false }) {
  const classes = `company-summary-row ${tone !== 'default' ? `company-summary-row--${tone}` : ''} ${highlight ? 'company-summary-row--highlight' : ''}`.trim();
  return (
    <tr className={classes}>
      <td className="company-summary-cell">
        <span className={`summary-pill summary-pill--${tone}`}>
          {icon}
        </span>
        {label}
      </td>
      <td className="company-summary-cell-amt">
        <span className="company-summary-amount">{amount}</span>
        {secondary && <span className="company-summary-secondary">{secondary}</span>}
      </td>
    </tr>
  );
}

export function ClientsPage() {
  const { canWrite, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [slideMode, setSlideMode] = useState('detail'); // detail, create, edit
  const [selectedCompany, setSelectedCompany] = useState(null);
  
  const [wizardStep, setWizardStep] = useState(1);
  const [createdCompany, setCreatedCompany] = useState(null);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [companyToDeactivate, setCompanyToDeactivate] = useState(null);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search: debouncedSearch, status: statusFilter, page, limit }],
    queryFn: () => companiesApi.list({ search: debouncedSearch, status: statusFilter, page, limit }),
  });

  const sortedCompanies = React.useMemo(() => {
    return sortByName(data?.data || []);
  }, [data]);

  const detailQuery = useQuery({
    queryKey: ['company', selectedCompany?.id],
    queryFn: () => companiesApi.get(selectedCompany?.id),
    enabled: !!selectedCompany && slideMode === 'detail',
  });

  // Two-step client creation: the company is saved first, then a login
  // account is attached to it. COMPANY_VIEWER accounts must always have a
  // company (the API rejects them without one), so the account cannot be
  // created before the company exists.
  const createMut = useMutation({
    mutationFn: companiesApi.create,
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setCreatedCompany(company);
      setWizardStep(2);
    },
  });

  const createAccountMut = useMutation({
    mutationFn: (payload) => usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetWizard();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => companiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', selectedCompany?.id] });
      setSlideOverOpen(false);
    },
  });

  const deactivateMut = useMutation({
    mutationFn: companiesApi.deactivate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeactivateModalOpen(false);
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(companySchema),
  });

  const {
    register: registerAccount,
    handleSubmit: handleAccountSubmit,
    formState: { errors: accountErrors },
    reset: resetAccount,
  } = useForm({ resolver: zodResolver(accountSchema) });

  const resetWizard = () => {
    setSlideOverOpen(false);
    setWizardStep(1);
    setCreatedCompany(null);
    resetAccount();
    createAccountMut.reset();
  };

  const summary = detailQuery.data?.activitySummary;

  const handleRowClick = (company) => {
    setSelectedCompany(company);
    setSlideMode('detail');
    setSlideOverOpen(true);
  };

  const handleCreateNew = () => {
    reset({
      name: '', contactPerson: '', phone: '', email: '', address: '', region: '', logo: ''
    });
    setSlideMode('create');
    setWizardStep(1);
    setCreatedCompany(null);
    resetAccount();
    setSlideOverOpen(true);
  };

  const handleEdit = (e, company) => {
    e.stopPropagation();
    reset({
      name: company.name,
      contactPerson: company.contactPerson || company.name,
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      region: company.region || '',
      logo: company.logo || '',
      status: company.status,
    });
    setSelectedCompany(company);
    setSlideMode('edit');
    setSlideOverOpen(true);
  };

  const handleDelete = (e, company) => {
    e.stopPropagation();
    deactivateMut.reset();
    setCompanyToDeactivate(company);
    setDeactivateModalOpen(true);
  };

  const onSubmitForm = (data) => {
    // The client identity is the contact person; mirror it into `name`
    // so the record always has a usable name for existing warehouses.
    if (!data.name) data.name = data.contactPerson;
    if (!data.logo) delete data.logo;
    if (slideMode === 'create') {
      createMut.mutate(data);
    } else {
      updateMut.mutate({ id: selectedCompany.id, data });
    }
  };

  const onSubmitAccount = ({ userName, userEmail, userPassword }) => {
    createAccountMut.mutate({
      name: userName,
      email: userEmail,
      password: userPassword,
      role: 'COMPANY_VIEWER',
      companyId: createdCompany?.id,
    });
  };

  const columns = [
    {
      key: 'name',
      label: 'Client',
      exportValue: (row) => `${row.name} (${row.code})`,
      render: (_, row) => (
        <div className="company-col">
          {row.logo ? (
            <img src={row.logo} alt="" className="company-logo" />
          ) : (
            <div className="company-avatar">{row.name.charAt(0).toUpperCase()}</div>
          )}
          <div className="company-info">
            <span className="company-name">{row.name}</span>
            <span className="company-contact-person">{row.contactPerson || '—'}</span>
            <span className="company-code">{row.code}</span>
          </div>
        </div>
      ),
    },
    { key: 'contactPerson', label: 'Contact', render: (v) => v || '—' },
    {
      key: 'phone',
      label: 'Contact Info',
      exportValue: (row) => `${row.phone} | ${row.email}`,
      render: (_, row) => (
        <div className="company-contact">
          <span>{row.phone}</span>
          <span className="company-email">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'stock',
      label: 'Current Stock',
      align: 'right',
      exportValue: (row) => `${row.currentStockBags ?? 0} bags (${row.currentStockKg ?? 0} kg)`,
      render: (_, row) => (
        <div className="company-stock">
          <span className="stock-bags">{row.currentStockBags?.toLocaleString()} bags</span>
          <span className="stock-kg">{(row.currentStockKg ?? 0).toLocaleString()} kg</span>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <Badge status={v} />, exportValue: (row) => row.status },
    {
      key: 'actions',
      label: '',
      align: 'right',
      excludeFromExport: true,
      render: (_, row) => (
        <div className="company-actions">
          {isAdmin && (
            <button className="action-btn" onClick={(e) => handleEdit(e, row)} title="Edit">
              <PencilSimple size={18} />
            </button>
          )}
          {isAdmin && row.status === 'ACTIVE' && (
            <button className="action-btn action-btn--danger" onClick={(e) => handleDelete(e, row)} title="Remove">
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
        <div className="mocca-title-group"><span className="mocca-subtitle">WORKSPACE</span><h1 className="mocca-title">Clients</h1></div>
        <div style={{display: 'flex', gap: 12}}>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToExcel(sortedCompanies, columns, 'Clients')}>
            <FileXls size={18} weight="regular" /> Export Excel
          </button>
          <button className="mocca-header-btn mocca-header-btn--outline" onClick={() => exportToPdf(sortedCompanies, columns, 'Clients', 'Clients Directory')}>
            <FilePdf size={18} weight="regular" /> Export PDF
          </button>
          {canWrite && (
            <button className="mocca-header-btn" onClick={handleCreateNew}><Plus size={18} weight="regular" /> New Client
            </button>
          )}
        </div>
      </div>

      <div className="mocca-toolbar">
        <div className="mocca-search">
          <MagnifyingGlass size={18} className="mocca-search__icon" />
          <input
            type="text"
            placeholder="Search by name, code, contact..."
            className="mocca-search__input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar__filters">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
      </div>

      <div className="mocca-table-wrap">
        <Table
          columns={columns}
          data={sortedCompanies}
          loading={isLoading}
          onRowClick={handleRowClick}
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

      {/* SlideOver */}
      <SlideOver
        isOpen={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        title={slideMode === 'create' ? 'New Client' : slideMode === 'edit' ? 'Edit Client' : selectedCompany?.name}
      >
        {slideMode === 'detail' ? (
          detailQuery.isLoading ? (
            <div className="loading-state">Loading...</div>
          ) : detailQuery.data ? (
            <div className="company-detail">
              <div className="detail-header">
                {detailQuery.data.logo ? (
                  <img src={detailQuery.data.logo} alt="" className="detail-logo" />
                ) : (
                  <div className="detail-avatar">{detailQuery.data.name.charAt(0)}</div>
                )}
                <div>
                  <h3>{detailQuery.data.name}</h3>
                  <Badge status={detailQuery.data.status} />
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <label>Client Code</label>
                  <span>{detailQuery.data.code}</span>
                </div>
                <div className="detail-item">
                  <label>Contact Person</label>
                  <span>{detailQuery.data.contactPerson || '—'}</span>
                </div>
                <div className="detail-item">
                  <label>Phone</label>
                  <span>{detailQuery.data.phone}</span>
                </div>
                <div className="detail-item">
                  <label>Email</label>
                  <span>{detailQuery.data.email}</span>
                </div>
                <div className="detail-item">
                  <label>Address</label>
                  <span>{detailQuery.data.address || '—'}</span>
                </div>
              </div>

              <h4 className="section-title">Company Summary</h4>

              <div className="company-summary-table-wrap">
                <table className="company-summary-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SummaryRow
                      icon={<ArrowDown size={14} weight="bold" />}
                      tone="in"
                      label="Coffee In"
                      amount={`${fmt(summary?.totalCoffeeInKg)} KG`}
                      secondary={`${fmt(summary?.totalCoffeeInBags)} bags`}
                    />
                    <SummaryRow
                      icon={<ArrowUp size={14} weight="bold" />}
                      tone="out"
                      label="Dispatched"
                      amount={`${fmt(summary?.totalDispatchedKg)} KG`}
                      secondary={`${fmt(summary?.totalDispatchedBags)} bags`}
                    />
                    <SummaryRow
                      icon={<Funnel size={14} weight="bold" />}
                      tone="processing"
                      label="Processed"
                      amount={`${fmt(summary?.totalProcessedKg)} KG`}
                    />
                    <SummaryRow
                      icon={<Hourglass size={14} weight="bold" />}
                      tone="unprocessed"
                      label="Unprocessed Remaining"
                      amount={`${fmt(summary?.unprocessedRemainingKg)} KG`}
                    />
                    <SummaryRow
                      icon={<CheckCircle size={14} weight="bold" />}
                      tone="clean"
                      label="Total Clean"
                      amount={`${fmt(summary?.totalCleanKg)} KG`}
                    />
                    <SummaryRow
                      icon={<CheckCircle size={14} weight="bold" />}
                      tone="clean"
                      label="Clean Available (In Stock)"
                      amount={`${fmt(summary?.cleanAvailableKg)} KG`}
                    />
                    <SummaryRow
                      icon={<WarningCircle size={14} weight="bold" />}
                      tone="reject"
                      label="Total Reject"
                      amount={`${fmt(summary?.totalRejectKg)} KG`}
                      secondary={
                        (summary?.totalRejectSortexKg > 0 ||
                          summary?.totalRejectGravityKg > 0 ||
                          summary?.totalRejectSizeKg > 0) &&
                        `Sortex: ${fmt(summary?.totalRejectSortexKg)} | Gravity: ${fmt(summary?.totalRejectGravityKg)} | Size: ${fmt(summary?.totalRejectSizeKg)}`
                      }
                    />
                    <SummaryRow
                      icon={<WarningCircle size={14} weight="bold" />}
                      tone="reject"
                      label="Reject Available (In Stock)"
                      amount={`${fmt(summary?.rejectAvailableKg)} KG`}
                    />
                    <SummaryRow
                      icon={<Trash size={14} weight="bold" />}
                      tone="waste"
                      label="Total Waste"
                      amount={`${fmt(summary?.totalWasteKg)} KG`}
                    />
                    <SummaryRow
                      icon={<Trash size={14} weight="bold" />}
                      tone="waste"
                      label="Waste Available (In Stock)"
                      amount={`${fmt(summary?.wasteAvailableKg)} KG`}
                    />
                    <SummaryRow
                      icon={<Hourglass size={14} weight="bold" />}
                      tone="unprocessed"
                      label="Unprocessed Available (In Stock)"
                      amount={`${fmt(summary?.unprocessedAvailableKg)} KG`}
                    />
                    <SummaryRow
                      icon={<Scales size={14} weight="bold" />}
                      tone="stock"
                      label="Remaining Stock"
                      amount={`${fmt(summary?.currentRemainingStockKg)} KG`}
                      secondary={`${fmt(summary?.currentRemainingStockBags)} bags`}
                      highlight
                    />
                    <SummaryRow
                      icon={<Buildings size={14} weight="bold" />}
                      label="Active Batches"
                      amount={fmt(summary?.activeBatchesCount)}
                      secondary="In warehouse"
                    />
                    <SummaryRow
                      icon={<Package size={14} weight="bold" />}
                      label="Total Batches"
                      amount={fmt(summary?.totalBatchesCount)}
                      secondary="All-time received"
                    />
                    <SummaryRow
                      icon={<ArrowUp size={14} weight="bold" />}
                      tone="out"
                      label="Total Dispatches"
                      amount={fmt(summary?.totalDispatchesCount)}
                      secondary="Shipments"
                    />
                  </tbody>
                </table>
              </div>

              <h4 className="section-title">Recent Transactions</h4>
              {detailQuery.data.recentTransactions.length === 0 ? (
                <p className="empty-text">No transactions found.</p>
              ) : (
                <ul className="txn-list">
                  {detailQuery.data.recentTransactions.slice(0, 10).map((t) => {
                    const isCoffeeIn = t.type === 'COFFEE_IN';
                    const isCoffeeOut = t.type === 'COFFEE_OUT';
                    const isProcessing = t.type === 'PROCESSING';
                    const toneClass = isCoffeeIn ? 'in' : isCoffeeOut ? 'out' : 'proc';
                    const hasBatch = t.refNo || t.batchNo;
                    const batchNo = t.refNo || t.batchNo;

                    return (
                      <li
                        key={t.id}
                        className={`txn-list__item ${hasBatch ? 'txn-list__item--clickable' : ''}`}
                        onClick={hasBatch ? () => navigate(`/entries/${t.entryId || t.id}`) : undefined}
                        style={hasBatch ? { cursor: 'pointer' } : undefined}
                      >
                        <div className="txn-list__left">
                          <span className={`txn-badge txn-badge--${toneClass}`}>
                            {isCoffeeIn && <ArrowDown size={10} weight="bold" />}
                            {isCoffeeOut && <ArrowUp size={10} weight="bold" />}
                            {isProcessing && <Funnel size={10} weight="bold" />}
                            {t.category}
                          </span>
                          <span className="txn-ref">
                            {hasBatch && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {batchNo}
                                <ArrowRight size={12} weight="bold" />
                              </span>
                            )}
                            {!hasBatch && '—'}
                          </span>
                          <span className="txn-date">{formatEthiopian(new Date(t.date))}</span>
                        </div>
                        <div className="txn-list__right">
                          <span className={`txn-amount txn-amount--${toneClass}`}>
                            {isCoffeeIn ? `+${fmt(t.kg)} KG` :
                             isCoffeeOut ? `-${fmt(t.kg)} KG` :
                             `${fmt(t.cleanKg)} KG clean`}
                          </span>
                          <span className="txn-detail" title={t.details || ''}>
                            {t.details || '—'}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="error-state">Failed to load details</div>
          )
        ) : (
          <form id="company-form" className="slide-form" onSubmit={handleSubmit(onSubmitForm)}>
            {(createMut.isError || updateMut.isError) && (
              <div className="form-error">
                {createMut.error?.response?.data?.message ||
                  updateMut.error?.response?.data?.message ||
                  'Could not save company. Please check the required fields.'}
              </div>
            )}

            {slideMode === 'create' && (
              <div className="form-section-card" style={{ marginBottom: 16 }}>
                <div className="form-section-header">
                  <h4 className="form-section-title">
                    Step {wizardStep} of 2 &mdash; {wizardStep === 1 ? 'Client details' : 'Client login account'}
                  </h4>
                </div>
                <div className="form-row">
                  {[
                    { step: 1, label: 'Client details' },
                    { step: 2, label: 'Login account' },
                  ].map(({ step, label }) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <span
                        aria-current={wizardStep === step ? 'step' : undefined}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700,
                          background: wizardStep >= step ? 'var(--color-accent)' : 'var(--color-neutral)',
                          color: wizardStep >= step ? 'var(--color-surface)' : 'var(--color-tertiary)',
                        }}
                      >
                        {step}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: wizardStep === step ? 600 : 400,
                        color: wizardStep === step ? 'var(--color-text)' : 'var(--color-tertiary)',
                      }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!(slideMode === 'create' && wizardStep === 2) && (
            <>
            <div className="form-section-card">
              <div className="form-section-header">
                <h4 className="form-section-title">1. Client Identity</h4>
                <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                  <strong style={{ color: 'var(--color-error)' }}>*</strong> Required
                </span>
              </div>
              <div className="form-row">
                <Input
                  label="Primary Contact Person"
                  placeholder="e.g. Tadesse Bekele"
                  required
                  error={errors.contactPerson?.message}
                  {...register('contactPerson')}
                />
                <Input
                  label="Phone Number"
                  placeholder="e.g. +251 911 234567"
                  required
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>
              <div className="form-row">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="contact@company.com"
                  required
                  error={errors.email?.message}
                  {...register('email')}
                />
                <div />
              </div>
            </div>

            <div className="form-section-card">
              <div className="form-section-header">
                <h4 className="form-section-title">2. Location & Details (Optional)</h4>
              </div>
              <div className="form-row">
                <Input
                  label="Origin Region"
                  placeholder="e.g. Sidama / Guji"
                  error={errors.region?.message}
                  {...register('region')}
                />
                <div />
              </div>
              <div className="form-row">
                <Input
                  label="Office / Warehouse Address"
                  placeholder="e.g. Bole Sub-City, Addis Ababa"
                  error={errors.address?.message}
                  {...register('address')}
                />
                {slideMode === 'edit' && (
                  <Select label="Account Status" error={errors.status?.message} {...register('status')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                )}
              </div>
            </div>

            </>
            )}

            {slideMode === 'create' && wizardStep === 2 && (
              <div className="form-section-card">
                <div className="form-section-header">
                  <h4 className="form-section-title">Client Login Account</h4>
                  <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                    <strong style={{ color: 'var(--color-error)' }}>*</strong> Required
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-tertiary)', margin: '0 0 14px' }}>
                  This account signs in as a <strong>Company Viewer</strong> and can only see
                  information for <strong>{createdCompany?.name}</strong>.
                </p>

                {createAccountMut.isError && (
                  <div className="form-error" style={{ marginBottom: 12 }}>
                    {createAccountMut.error?.response?.data?.message ||
                      'Could not create the login account.'}
                  </div>
                )}

                <div className="form-row">
                  <Input
                    label="Account Holder Name"
                    placeholder="e.g. Tadesse Bekele"
                    required
                    error={accountErrors.userName?.message}
                    {...registerAccount('userName')}
                  />
                  <Input
                    label="Login Email"
                    type="email"
                    placeholder="login@company.com"
                    required
                    error={accountErrors.userEmail?.message}
                    {...registerAccount('userEmail')}
                  />
                </div>
                <div className="form-row">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    required
                    error={accountErrors.userPassword?.message}
                    {...registerAccount('userPassword')}
                  />
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter password"
                    required
                    error={accountErrors.userPasswordConfirm?.message}
                    {...registerAccount('userPasswordConfirm')}
                  />
                </div>
              </div>
            )}

            <div className="form-actions">
              {slideMode === 'create' && wizardStep === 2 ? (
                <Button variant="secondary" type="button" onClick={() => setWizardStep(1)}>
                  Back
                </Button>
              ) : (
                <Button variant="secondary" type="button" onClick={() => setSlideOverOpen(false)}>
                  Cancel
                </Button>
              )}
              {slideMode === 'create' && wizardStep === 2 ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={createAccountMut.isPending}
                  onClick={handleAccountSubmit(onSubmitAccount)}
                >
                  Create Login Account
                </Button>
              ) : (
                <Button type="submit" variant="primary" loading={createMut.isPending || updateMut.isPending}>
                  {slideMode === 'create' ? 'Save Client & Continue' : 'Save Changes'}
                </Button>
              )}
            </div>
          </form>
        )}
      </SlideOver>

      {/* Remove Company Confirmation */}
      <Modal
        isOpen={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        size="sm"
        title="Remove Company"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeactivateModalOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deactivateMut.mutate(companyToDeactivate?.id)}
              disabled={deactivateMut.isPending || !companyToDeactivate}
            >
              {deactivateMut.isPending ? 'Removing...' : 'Remove Company'}
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
          Are you sure you want to remove <strong>{companyToDeactivate?.name}</strong>?
        </p>
        <p style={{ marginTop: 12, color: 'var(--color-muted)' }}>
          It will no longer be selectable for new entries or outgoing stock, and it will be hidden
          from the company list. Existing stock and transaction history are kept for the audit trail.
        </p>
      </Modal>
    </div>
  );
}

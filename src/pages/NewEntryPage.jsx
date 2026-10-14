import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Scales,
  Buildings,
  Truck,
  CheckCircle,
  Plus,
  ArrowLeft,
  Calculator,
} from '@phosphor-icons/react';
import { entriesApi, companiesApi, driversApi, settingsApi } from '../lib/api';
import { toLocalNaive, pickerValueToIso } from '../lib/localDate';
import { sortByName } from '../lib/utils';
import { COFFEE_GRADES } from '../lib/constants';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { EthiopianDatePicker } from '../components/ui/EthiopianDatePicker';
import './NewEntryPage.css';

const entrySchema = z.object({
  companyId: z.string().min(1, 'Please select a supplier / company'),
  entryDate: z.string().min(1, 'Reception date & time is required'),
  batchNo: z.string().min(1, 'Batch code is required'),
  grade: z.string().optional(),
  bags: z.coerce.number().min(1, 'Enter at least 1 bag'),
  kg: z.coerce.number().positive('Enter total batch weight in KG'),
  originId: z.string().optional(),
  supplierDispatchNo: z.string().optional(),
  // Every delivery arrives on a named truck driven by a named driver, so both
  // are required. An unfilled <select> posts an empty string, which fails this
  // the same way as leaving the field out.
  plateNumber: z.string().min(1, 'Truck plate number is required'),
  driverId: z.string().min(1, 'Driver is required'),
  locationId: z.string().optional(),
  remarks: z.string().optional(),
});

export function NewEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesApi.list({ limit: 200 }),
  });
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driversApi.list({ limit: 200 }),
  });
  const { data: origins } = useQuery({
    queryKey: ['origins'],
    queryFn: () => settingsApi.origins(),
  });
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => settingsApi.locations(),
  });

  const sortedCompanies = useMemo(
    () => sortByName(companies?.data || []),
    [companies],
  );
  const sortedOrigins = useMemo(
    () => sortByName(origins?.data || origins || []),
    [origins],
  );
  const sortedDrivers = useMemo(
    () => sortByName(drivers?.data || []),
    [drivers],
  );
  const sortedLocations = useMemo(
    () => sortByName(locations?.data || locations || []),
    [locations],
  );

  const createMut = useMutation({
    mutationFn: entriesApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      navigate(`/entries/${data.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      companyId: '',
      originId: '',
      grade: '',
      entryDate: toLocalNaive(new Date()),
      bags: '',
      kg: '',
      driverId: '',
      plateNumber: '',
      supplierDispatchNo: '',
      locationId: '',
      remarks: '',
    },
  });

  const bags = Number(watch('bags')) || 0;
  const kg = Number(watch('kg')) || 0;
  const driverId = watch('driverId');
  const selectedDriver = useMemo(
    () => drivers?.data?.find((d) => d.id === driverId),
    [drivers, driverId]
  );

  // Automatically select the driver's first registered plate when driver changes
  useEffect(() => {
    if (selectedDriver?.plates?.length > 0) {
      const currentPlate = watch('plateNumber');
      if (!currentPlate || !selectedDriver.plates.includes(currentPlate)) {
        setValue('plateNumber', selectedDriver.plates[0], { shouldValidate: true });
      }
    } else if (driverId && (!selectedDriver?.plates || selectedDriver.plates.length === 0)) {
      const currentPlate = watch('plateNumber');
      if (currentPlate) {
        setValue('plateNumber', '', { shouldValidate: false });
      }
    } else if (!driverId) {
      setValue('plateNumber', '');
    }
  }, [driverId, selectedDriver, setValue, watch]);

  // Quick-add Modal States
  const [addingCompany, setAddingCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyContactPerson, setCompanyContactPerson] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  const [addingOrigin, setAddingOrigin] = useState(false);
  const [originName, setOriginName] = useState('');
  const [originRegion, setOriginRegion] = useState('');

  const [addingLocation, setAddingLocation] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationSection, setLocationSection] = useState('');

  const [addingDriver, setAddingDriver] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverLicenseNo, setDriverLicenseNo] = useState('');
  const [driverPlateInModal, setDriverPlateInModal] = useState('');

  const [addingPlate, setAddingPlate] = useState(false);
  const [newPlate, setNewPlate] = useState('');

  // Quick-add Mutations
  const createCompany = useMutation({
    mutationFn: (payload) => companiesApi.create(payload),
    onSuccess: async (created) => {
      const id = created?.id || created?.data?.id;
      // Wait for the refetch to land. A native <select> cannot display a value
      // that has no matching <option> yet, so selecting before the list
      // updates leaves the field sitting on its placeholder.
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      if (id) setValue('companyId', id, { shouldValidate: true });
      setAddingCompany(false);
      setCompanyName('');
      setCompanyContactPerson('');
      setCompanyPhone('');
      setCompanyEmail('');
    },
  });

  const createOrigin = useMutation({
    mutationFn: settingsApi.createOrigin,
    onSuccess: async (created) => {
      const id = created?.id || created?.data?.id;
      // Wait for the refetch to land. A native <select> cannot display a value
      // that has no matching <option> yet, so selecting before the list
      // updates leaves the field sitting on its placeholder.
      await queryClient.invalidateQueries({ queryKey: ['origins'] });
      if (id) setValue('originId', id, { shouldValidate: true });
      setAddingOrigin(false);
      setOriginName('');
      setOriginRegion('');
    },
  });

  const createLocation = useMutation({
    mutationFn: settingsApi.createLocation,
    onSuccess: async (created) => {
      const id = created?.id || created?.data?.id;
      // Wait for the refetch to land. A native <select> cannot display a value
      // that has no matching <option> yet, so selecting before the list
      // updates leaves the field sitting on its placeholder.
      await queryClient.invalidateQueries({ queryKey: ['locations'] });
      if (id) setValue('locationId', id, { shouldValidate: true });
      setAddingLocation(false);
      setLocationName('');
      setLocationSection('');
    },
  });

  const createDriver = useMutation({
    mutationFn: driversApi.create,
    onSuccess: async (created) => {
      const id = created?.id || created?.data?.id;
      const plates = created?.plates || created?.data?.plates || [];
      // Wait for the refetch to land. A native <select> cannot display a value
      // that has no matching <option> yet, so selecting before the list
      // updates leaves the field sitting on its placeholder.
      await queryClient.invalidateQueries({ queryKey: ['drivers'] });
      if (id) setValue('driverId', id, { shouldValidate: true });
      if (plates.length > 0) {
        setValue('plateNumber', plates[0], { shouldValidate: true });
      }
      setAddingDriver(false);
      setDriverName('');
      setDriverPhone('');
      setDriverLicenseNo('');
      setDriverPlateInModal('');
    },
  });

  const updateDriverMut = useMutation({
    mutationFn: ({ id, data }) => driversApi.update(id, data),
    onSuccess: async () => {
      const trimmed = newPlate.trim();
      // Wait for the refetch to land. A native <select> cannot display a value
      // that has no matching <option> yet, so selecting before the list
      // updates leaves the field sitting on its placeholder.
      await queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setValue('plateNumber', trimmed, { shouldValidate: true });
      setAddingPlate(false);
      setNewPlate('');
    },
  });

  const handleQuickAddPlate = () => {
    if (!newPlate.trim() || !selectedDriver) return;
    const currentPlates = selectedDriver.plates || [];
    updateDriverMut.mutate({
      id: selectedDriver.id,
      data: { plates: [...new Set([...currentPlates, newPlate.trim()])] },
    });
  };

  const handleQuickAddCompany = () => {
    if (!companyName.trim()) return;
    const safeEmail =
      companyEmail.trim() ||
      `${companyName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}@supplier.mocca.com`;
    createCompany.mutate({
      name: companyName.trim(),
      contactPerson: companyContactPerson.trim() || companyName.trim(),
      phone: companyPhone.trim() || '+251-900-000000',
      email: safeEmail,
    });
  };

  const avgKgPerBag = bags > 0 && kg > 0 ? (kg / bags).toFixed(2) : null;

  const onSubmit = async (formData) => {
    const payload = { ...formData };
    // An unfilled <select> and a cleared text input both submit ''. Strip them
    // so the API never receives an empty string for an optional field.
    Object.keys(payload).forEach((key) => {
      if (typeof payload[key] === 'string' && payload[key].trim() === '') delete payload[key];
    });

    // Auto-persist new plate to driver if not already in driver's plates
    if (selectedDriver && payload.plateNumber) {
      const cleanPlate = payload.plateNumber.trim();
      const existingPlates = selectedDriver.plates || [];
      if (cleanPlate && !existingPlates.includes(cleanPlate)) {
        try {
          await driversApi.update(selectedDriver.id, {
            plates: [...existingPlates, cleanPlate],
          });
          queryClient.invalidateQueries({ queryKey: ['drivers'] });
        } catch (e) {
          console.warn('Could not auto-save plate to driver:', e);
        }
      }
    }

    // The picker emits a naive local string; send an offset-bearing instant so
    // the backend cannot resolve it against its own timezone.
    payload.entryDate = pickerValueToIso(payload.entryDate);
    createMut.mutate(payload);
  };

  // Extract user-friendly error for duplicate batch code
  const duplicateBatchError = createMut.isError
    ? createMut.error?.response?.data?.message?.includes('already exists')
      ? createMut.error.response.data.message
      : null
    : null;

  return (
    <div className="inbound-page">
      {/* Page Header */}
      <div className="inbound-header-bar">
        <div className="inbound-header-left">
          <div className="inbound-icon">
            <Scales size={24} weight="regular" />
          </div>
          <div>
            <span className="inbound-eyebrow">COFFEE IN</span>
            <h1 className="inbound-title">New Coffee Entry</h1>
          </div>
        </div>
        <div className="inbound-header-right">
          <span className="inbound-required-legend">
            Fields marked with <strong style={{ color: 'var(--color-error)' }}>*</strong> are
            required
          </span>
          <button
            type="button"
            className="btn-secondary-nav"
            onClick={() => navigate('/entries')}
          >
            <ArrowLeft size={16} /> Back to Entries
          </button>
        </div>
      </div>

      {createMut.isError && (
        <div className="form-error" style={{ marginBottom: 20 }}>
          {createMut.error?.response?.data?.message ||
            'Could not save entry. Please check all required fields and try again.'}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="inbound-form-container">
        {/* SECTION 1: Supplier, Origin & Grade */}
        <section className="inbound-card-section">
          <div className="inbound-card-section__header">
            <div className="inbound-card-section__title">
              <Buildings size={18} weight="regular" />
              <span>1. Supplier & Coffee Details</span>
            </div>
            <span className="inbound-card-section__hint">
              Select existing records or click <strong>+ Quick Add</strong> without leaving this
              page
            </span>
          </div>

          <div className="inbound-form-grid">
            <div className="grid-field">
              <label>
                <span>
                  Client / Supplier <strong className="req-star">*</strong>
                </span>
                <button
                  type="button"
                  className="inbound-add-link"
                  onClick={() => setAddingCompany(true)}
                >
                  + Quick Add
                </button>
              </label>
              <select className="inbound-input" {...register('companyId')} value={watch('companyId') ?? ''}>
                <option value="">Select client / supplier...</option>
                {sortedCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
              {errors.companyId && <span className="error-text">{errors.companyId.message}</span>}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Coffee Origin
                </span>
                <button
                  type="button"
                  className="inbound-add-link"
                  onClick={() => setAddingOrigin(true)}
                >
                  + Quick Add
                </button>
              </label>
              <select className="inbound-input" {...register('originId')} value={watch('originId') ?? ''}>
                <option value="">Select origin...</option>
                {sortedOrigins.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.region ? `— ${o.region}` : ''}
                  </option>
                ))}
              </select>
              {errors.originId && <span className="error-text">{errors.originId.message}</span>}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Coffee Grade
                </span>
              </label>
              <select className="inbound-input" {...register('grade')}>
                <option value="">Select coffee grade...</option>
                {COFFEE_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors.grade && <span className="error-text">{errors.grade.message}</span>}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Batch Code <strong className="req-star">*</strong>
                </span>
              </label>
              <input
                type="text"
                className="inbound-input"
                placeholder="e.g. BATCH-001"
                {...register('batchNo')}
              />
              {errors.batchNo && <span className="error-text">{errors.batchNo.message}</span>}
            </div>
          </div>
        </section>

        {/* SECTION 2: Quantities, Real-Time Calculation & Reception Date */}
        <section className="inbound-card-section">
          <div className="inbound-card-section__header">
            <div className="inbound-card-section__title">
              <Scales size={18} weight="regular" />
              <span>2. Batch Quantity & Reception Date</span>
            </div>
          </div>

          <div className="inbound-form-grid">
            <div className="grid-field">
              <label>
                <span>
                  Total Bags <strong className="req-star">*</strong>
                </span>
              </label>
              <input
                type="number"
                min="1"
                className="inbound-input"
                placeholder="e.g. 100"
                {...register('bags')}
              />
              {errors.bags && <span className="error-text">{errors.bags.message}</span>}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Total Batch Weight (KG) <strong className="req-star">*</strong>
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                className="inbound-input"
                placeholder="e.g. 6000"
                {...register('kg')}
              />
              {errors.kg && <span className="error-text">{errors.kg.message}</span>}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Reception Date & Time <strong className="req-star">*</strong>
                </span>
              </label>
              <EthiopianDatePicker
                showTime
                {...register('entryDate')}
                value={watch('entryDate')}
                onChange={(v) =>
                  setValue('entryDate', v, { shouldDirty: true, shouldValidate: true })
                }
              />
              {errors.entryDate && <span className="error-text">{errors.entryDate.message}</span>}
            </div>
          </div>

          {/* Real-time Calculation Summary Strip */}
          <div className="inbound-calc-strip">
            <div className="inbound-calc-item">
              <span className="inbound-calc-label">Entered Bags</span>
              <strong className="inbound-calc-val">
                {bags > 0 ? `${bags.toLocaleString()} Bags` : '—'}
              </strong>
            </div>
            <div className="inbound-calc-item">
              <span className="inbound-calc-label">Total Coffee In (KG)</span>
              <strong className="inbound-calc-val">
                {kg > 0 ? `${kg.toLocaleString()} KG` : '—'}
              </strong>
            </div>
            <div className="inbound-calc-item">
              <span className="inbound-calc-label">Real-Time Avg Bag Weight</span>
              <strong
                className="inbound-calc-val"
                style={{ color: avgKgPerBag ? 'var(--color-clean)' : undefined }}
              >
                {avgKgPerBag ? `${avgKgPerBag} KG / Bag` : 'Enter Bags & KG'}
              </strong>
            </div>
          </div>
        </section>

        {/* SECTION 3: Transport, Waybill & Storage Location */}
        <section className="inbound-card-section">
          <div className="inbound-card-section__header">
            <div className="inbound-card-section__title">
              <Truck size={18} weight="regular" />
              <span>3. Logistics, Waybill & Storage Location</span>
            </div>
          </div>

          <div className="inbound-form-grid">
            <div className="grid-field">
              <label>
                <span>
                  Driver <strong className="req-star">*</strong>
                </span>
                <button
                  type="button"
                  className="inbound-add-link"
                  onClick={() => setAddingDriver(true)}
                >
                  + Quick Add Driver
                </button>
              </label>
              <select className="inbound-input" {...register('driverId')} value={watch('driverId') ?? ''}>
                <option value="">Select driver...</option>
                {sortedDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.phone ? `(${d.phone})` : ''}
                  </option>
                ))}
              </select>
              {errors.driverId && <span className="error-text">{errors.driverId.message}</span>}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Truck Plate Number <strong className="req-star">*</strong>
                </span>
                {driverId && (
                  <button
                    type="button"
                    className="inbound-add-link"
                    onClick={() => setAddingPlate(true)}
                  >
                    + Add Plate
                  </button>
                )}
              </label>
              {selectedDriver?.plates?.length > 0 ? (
                <select className="inbound-input" {...register('plateNumber')} value={watch('plateNumber') ?? ''}>
                  <option value="">Select plate...</option>
                  {sortByName(selectedDriver.plates).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="inbound-input"
                  placeholder={driverId ? 'Type plate (e.g. AA-12345)' : 'Select a driver first'}
                  {...register('plateNumber')}
                />
              )}
              {errors.plateNumber && (
                <span className="error-text">{errors.plateNumber.message}</span>
              )}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Supplier Dispatch / Waybill No.
                </span>
              </label>
              <input
                type="text"
                className="inbound-input"
                placeholder="e.g. DSP-2026-001"
                {...register('supplierDispatchNo')}
              />
              {errors.supplierDispatchNo && (
                <span className="error-text">{errors.supplierDispatchNo.message}</span>
              )}
            </div>

            <div className="grid-field">
              <label>
                <span>Warehouse Bin / Location</span>
                <button
                  type="button"
                  className="inbound-add-link"
                  onClick={() => setAddingLocation(true)}
                >
                  + Quick Add
                </button>
              </label>
              <select className="inbound-input" {...register('locationId')} value={watch('locationId') ?? ''}>
                <option value="">Select bin / location (optional)...</option>
                {sortedLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.section ? `(${l.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-field" style={{ gridColumn: 'span 2' }}>
              <label>
                <span>Additional Notes (Optional)</span>
              </label>
              <input
                type="text"
                className="inbound-input"
                placeholder="Any remarks on bag condition, moisture, or seal numbers..."
                {...register('remarks')}
              />
            </div>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="inbound-submit-bar">
          <button
            type="button"
            className="btn-draft"
            onClick={() => navigate('/entries')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-confirm"
            disabled={isSubmitting || createMut.isPending}
          >
            <CheckCircle size={20} weight="fill" />
            {isSubmitting || createMut.isPending ? 'Saving Coffee Entry...' : 'Save Coffee Entry'}
          </button>
        </div>
      </form>

      {/* QUICK-ADD MODALS (Never leave the form!) */}
      <Modal
        isOpen={addingCompany}
        onClose={() => setAddingCompany(false)}
        title="Quick Add Supplier / Client"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingCompany(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createCompany.isPending}
              disabled={!companyName.trim()}
              onClick={handleQuickAddCompany}
            >
              Add & Select Supplier
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Client / Supplier Name"
            required
            placeholder="e.g. Sidama Coffee Union"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <Input
            label="Contact Person (Optional)"
            placeholder="e.g. Tadesse Bekele"
            value={companyContactPerson}
            onChange={(e) => setCompanyContactPerson(e.target.value)}
          />
          <div className="form-row">
            <Input
              label="Phone Number"
              placeholder="e.g. +251 911 234567"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
            />
            <Input
              label="Email (Optional)"
              type="email"
              placeholder="contact@supplier.com"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={addingOrigin}
        onClose={() => setAddingOrigin(false)}
        title="Quick Add Coffee Origin"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingOrigin(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createOrigin.isPending}
              disabled={!originName.trim()}
              onClick={() =>
                createOrigin.mutate({
                  name: originName.trim(),
                  region: originRegion.trim() || undefined,
                })
              }
            >
              Add & Select Origin
            </Button>
          </>
        }
      >
        <div className="form-row">
          <Input
            label="Origin Name"
            required
            placeholder="e.g. Yirgacheffe"
            value={originName}
            onChange={(e) => setOriginName(e.target.value)}
          />
          <Input
            label="Region (Optional)"
            placeholder="e.g. Gedeo / SNNPR"
            value={originRegion}
            onChange={(e) => setOriginRegion(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        isOpen={addingLocation}
        onClose={() => setAddingLocation(false)}
        title="Quick Add Warehouse Location"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingLocation(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createLocation.isPending}
              disabled={!locationName.trim()}
              onClick={() =>
                createLocation.mutate({
                  name: locationName.trim(),
                  section: locationSection.trim() || undefined,
                })
              }
            >
              Add & Select Location
            </Button>
          </>
        }
      >
        <div className="form-row">
          <Input
            label="Bin / Location Name"
            required
            placeholder="e.g. Bay A-04"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
          <Input
            label="Warehouse Section (Optional)"
            placeholder="e.g. North Wing"
            value={locationSection}
            onChange={(e) => setLocationSection(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        isOpen={addingDriver}
        onClose={() => setAddingDriver(false)}
        title="Quick Add Driver"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingDriver(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createDriver.isPending}
              disabled={!driverName.trim() || !driverPhone.trim()}
              onClick={() =>
                createDriver.mutate({
                  name: driverName.trim(),
                  phone: driverPhone.trim(),
                  licenseNo: driverLicenseNo.trim() || undefined,
                  plates: driverPlateInModal.trim() ? [driverPlateInModal.trim()] : [],
                })
              }
            >
              Add & Select Driver
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <Input
              label="Driver Full Name"
              required
              placeholder="e.g. Abebe Kebede"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            />
            <Input
              label="Phone Number"
              required
              placeholder="e.g. +251 911 000000"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
            />
          </div>
          <div className="form-row">
            <Input
              label="Truck Plate Number"
              placeholder="e.g. AA-3-45821"
              value={driverPlateInModal}
              onChange={(e) => setDriverPlateInModal(e.target.value)}
            />
            <Input
              label="License No. (Optional)"
              placeholder="e.g. ETH-99412"
              value={driverLicenseNo}
              onChange={(e) => setDriverLicenseNo(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={addingPlate}
        onClose={() => setAddingPlate(false)}
        title={`Add Truck Plate for ${selectedDriver?.name || 'Driver'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingPlate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={updateDriverMut.isPending}
              disabled={!newPlate.trim()}
              onClick={handleQuickAddPlate}
            >
              Add & Select Plate
            </Button>
          </>
        }
      >
        <Input
          label="New Truck Plate Number"
          required
          placeholder="e.g. AA-3-12345"
          value={newPlate}
          onChange={(e) => setNewPlate(e.target.value)}
        />
      </Modal>
    </div>
  );
}

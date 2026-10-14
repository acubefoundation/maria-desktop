import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Package,
  MapPin,
  CheckCircle,
  WarningCircle,
  ArrowLeft,
  Lightning,
  Buildings,
  Checks,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { outingsApi, entriesApi, driversApi, companiesApi } from '../lib/api';
import { toLocalNaive, pickerValueToIso } from '../lib/localDate';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { STOCK_TYPES, stockSlice, stockForEntry, totalAvailableKg, hasAnyStock } from '../lib/stockTypes';
import { bagsFor, bagConsistency, syncDispatchLine } from '../lib/dispatchLine';
import { validateDispatch } from '../lib/dispatchValidation';
import { sortByName } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { EthiopianDatePicker } from '../components/ui/EthiopianDatePicker';
import './NewOutingPage.css';

/** Sentinel for the client select's "list every client's batches" option. */
const ALL_COMPANIES = '__ALL_COMPANIES__';

const outingSchema = z.object({
  destination: z.string().optional(),
  purpose: z.enum(['EXPORT', 'INTERNAL_TRANSFER', 'RETURN_TO_SUPPLIER']),
  dispatchDate: z.string().min(1, 'Dispatch date & time is required'),
  approvedBy: z.string().optional(),
  // Coffee always leaves on a named truck with a named driver, so both are
  // required. An unfilled <select> posts an empty string, which fails this
  // the same way as leaving the field out.
  plateNumber: z.string().min(1, 'Truck plate number is required'),
  driverId: z.string().min(1, 'Driver is required'),
  notes: z.string().optional(),
});

const PURPOSE_LABELS = {
  EXPORT: 'Export',
  INTERNAL_TRANSFER: 'Internal Transfer',
  RETURN_TO_SUPPLIER: 'Return to Supplier',
};

/** Weight this batch contributes to the dispatch, across all its lines. */
function lineTotalKg(lines) {
  return Number(
    (lines || []).reduce((sum, l) => sum + (Number(l.kg) || 0), 0).toFixed(2),
  );
}

function lineTotalBags(lines) {
  return (lines || []).reduce((sum, l) => sum + (Number(l.bags) || 0), 0);
}

export function NewOutingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialEntryId = searchParams.get('entryId') || '';
  const initialCompanyId = searchParams.get('companyId') || '';

  // Company and batch selection state
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  // Each selected batch holds a list of dispatch lines, one per fraction, so a
  // single batch can give up clean, reject and waste in the same dispatch.
  const [linesMap, setLinesMap] = useState({});
  // Snapshot shown for confirmation. Held as its own value rather than read live
  // so the summary cannot shift underneath the reader mid-decision.
  const [review, setReview] = useState(null);
  const [batchSearch, setBatchSearch] = useState('');
  /*
   * Hide batches with nothing left to dispatch. On by default: a client with a
   * long dispatch history spends most of the list on batches that cannot be
   * dispatched, and they push the ones that can down the page. Ticking it off
   * lists them again, dimmed, which is what you want when reconciling.
   */
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  /*
   * Destinations and approvers quick-added in this session.
   *
   * Both dropdowns are built from destinations already used by a dispatch, so
   * the server does not know about a new one until this dispatch is saved. The
   * quick add used to write it straight into the query cache, which looked fine
   * and then lost it: the next refetch replaced the cache with the server list,
   * the <option> the select was pointing at disappeared, and the field fell
   * back to its placeholder - the item had been created, but it read as though
   * nothing was selected. Keeping the additions here, outside the cache, means
   * they stay selectable for the whole form.
   */
  const [addedDestinations, setAddedDestinations] = useState([]);
  const [addedApprovers, setAddedApprovers] = useState([]);

  /*
   * Failures caught before the request is made, so they are reported in the same
   * place as the server's: on the dialog, not on the form behind it.
   */
  const [dispatchError, setDispatchError] = useState('');

  /*
   * Every client, not just the active ones.
   *
   * This asked for the first 200 active clients. Marking one inactive hides it
   * from this list - which reads as "removed, no stock", not "you may still have
   * to dispatch what it left behind". A removed client whose bags were still in
   * the warehouse had become impossible to dispatch from at all. Both statuses
   * are requested, and inactive ones are labelled so the state is visible rather
   * than something to infer.
   */
  const { data: companiesData } = useQuery({
    queryKey: ['companies', { limit: 1000, status: 'ACTIVE,INACTIVE' }],
    queryFn: () => companiesApi.list({ limit: 1000, status: 'ACTIVE,INACTIVE' }),
  });
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driversApi.list({ limit: 200 }),
  });
  const { data: destinations } = useQuery({
    queryKey: ['destinations'],
    queryFn: outingsApi.destinations,
  });
  const { data: approvers } = useQuery({
    queryKey: ['approvers'],
    queryFn: outingsApi.approvers,
  });
  /*
   * Batches for the dispatch list, fetched for the chosen client.
   *
   * This used to be one unscoped fetch of the first 500 batches across every
   * client, filtered to the selected one in the browser. A client's batches
   * sitting past that cap simply were not there to be listed, and batches
   * belonging to other clients spent the cap first. Scoping the request to the
   * client removes both: every one of its batches now arrives.
   *
   * The key still begins `entries-stock`, so the prefix invalidation other pages
   * do after a processing or dispatch still reaches it.
   */
  const { data: entries } = useQuery({
    queryKey: ['entries-stock', selectedCompanyId],
    queryFn: () =>
      entriesApi.list(
        selectedCompanyId === ALL_COMPANIES
          ? { limit: 1000 }
          : { companyId: selectedCompanyId, limit: 1000 },
      ),
    enabled: !!selectedCompanyId,
  });

  /*
   * Arriving with ?entryId= and no client chosen yet. The list above cannot
   * help here, because it is scoped to a client we do not have, so the one batch
   * is fetched directly to learn which client it belongs to.
   */
  const { data: preselectEntry } = useQuery({
    queryKey: ['entries-stock-preselect', initialEntryId],
    queryFn: () => entriesApi.get(initialEntryId),
    enabled: !!initialEntryId && !selectedCompanyId,
  });

  const createMut = useMutation({
    mutationFn: outingsApi.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outings'] });
      queryClient.invalidateQueries({ queryKey: ['entries-stock'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      navigate('/outings');
    },
  });

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(outingSchema),
    defaultValues: {
      dispatchDate: toLocalNaive(new Date()),
      purpose: 'EXPORT',
      destination: '',
      approvedBy: '',
      driverId: '',
      plateNumber: '',
      notes: '',
    },
  });

  const driverId = watch('driverId');

  const sortedCompanies = useMemo(
    () => sortByName(companiesData?.data || []),
    [companiesData]
  );

  const allEntries = useMemo(() => {
    return [...(entries?.data || [])].sort((a, b) => {
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
  }, [entries]);

  // When initialEntryId is provided, auto-set company and select that batch
  useEffect(() => {
    if (initialEntryId && preselectEntry && !selectedCompanyId) {
      const match = preselectEntry.id === initialEntryId ? preselectEntry : null;
      if (match) {
        setSelectedCompanyId(match.companyId);
        setSelectedBatchIds([match.id]);
        // Open on the fraction this batch actually has most of, rather than
        // always Clean: a fully unprocessed batch has no clean coffee at all.
        const firstAvailable = STOCK_TYPES.find(
          (t) => stockSlice(match, t.value).availableKg > 0.01,
        );
        setLinesMap({
          [match.id]: firstAvailable
            ? [makeLine(firstAvailable.value, stockSlice(match, firstAvailable.value))]
            : [],
        });
      }
    }
  }, [initialEntryId, preselectEntry, selectedCompanyId]);

  /*
   * Batches to list: every client's when set to all clients, otherwise the one
   * client's.
   */
  const companyEntries = useMemo(() => {
    if (!selectedCompanyId) return [];
    if (selectedCompanyId === ALL_COMPANIES) return allEntries;
    return allEntries.filter((e) => e.companyId === selectedCompanyId);
  }, [allEntries, selectedCompanyId]);

  const showAllCompanies = selectedCompanyId === ALL_COMPANIES;

  /*
   * Every batch the company still holds.
   *
   * This used to drop any batch with nothing left to dispatch, which meant a
   * batch that had run out simply was not in the list. Someone looking for
   * WH1-2026-000002 could not tell it had been fully dispatched from anything
   * other than its absence, and could not tell it apart from a batch belonging
   * to somebody else. They are all listed now; the ones with nothing in them
   * say so and cannot be picked.
   */
  const availableCompanyEntries = useMemo(() => {
    return companyEntries.filter((e) => e.status !== 'DISPATCHED');
  }, [companyEntries]);

  // Of those, the ones a dispatch can actually draw on.
  const dispatchableCompanyEntries = useMemo(
    () => availableCompanyEntries.filter((e) => hasAnyStock(e)),
    [availableCompanyEntries],
  );

  // Batches present but not dispatchable: what the toggle is withholding.
  const spentCount = availableCompanyEntries.length - dispatchableCompanyEntries.length;

  const filteredCompanyEntries = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    const searched = q
      ? availableCompanyEntries.filter(
          (e) =>
            e.batchNo?.toLowerCase().includes(q) ||
            e.grade?.toLowerCase().includes(q) ||
            e.origin?.name?.toLowerCase().includes(q),
        )
      : availableCompanyEntries;
    return onlyAvailable ? searched.filter((e) => hasAnyStock(e)) : searched;
  }, [availableCompanyEntries, batchSearch, onlyAvailable]);

  const sortedDrivers = useMemo(
    () => sortByName(drivers?.data || []),
    [drivers],
  );
  const sortedDestinations = useMemo(
    () => sortByName([...new Set([...(destinations || []), ...addedDestinations])]),
    [destinations, addedDestinations],
  );
  const sortedApprovers = useMemo(
    () => sortByName([...new Set([...(approvers || []), ...addedApprovers])]),
    [approvers, addedApprovers],
  );

  const selectedCompany = useMemo(() => {
    if (selectedCompanyId === ALL_COMPANIES) {
      // A stand-in, so the headings, the ready banner and the review dialog
      // keep reading a client name instead of special-casing this everywhere.
      return { id: ALL_COMPANIES, name: 'All Clients', code: '' };
    }
    return sortedCompanies.find((c) => c.id === selectedCompanyId);
  }, [sortedCompanies, selectedCompanyId]);

  const selectedDriver = useMemo(
    () => sortedDrivers.find((d) => d.id === driverId),
    [sortedDrivers, driverId]
  );

  // Auto-select first plate when driver changes
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

  // Company change handler
  const handleCompanyChange = (newCompanyId) => {
    setSelectedCompanyId(newCompanyId);
    setSelectedBatchIds([]);
    setLinesMap({});
    setBatchSearch('');
  };

  // Batch selection handlers
  const makeLine = (type, slice) => ({
    type,
    kg: String(slice.availableKg),
    // Seed the bag count from the per-bag figure the database already holds,
    // so a newly added line arrives self-consistent. Reject and waste have no
    // recorded bag count, so bagSize stays blank for the user to fill in.
    bags: slice.bagsTracked ? String(bagsFor(slice.availableKg, slice.kgPerBag)) : '',
    bagSize: slice.bagsTracked ? String(slice.kgPerBag ?? '') : '',
  });

  const toggleBatch = (id) => {
    setSelectedBatchIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      const entry = allEntries.find((e) => e.id === id);
      if (entry && !hasAnyStock(entry)) return prev;
      const first = entry && STOCK_TYPES.find((t) => stockSlice(entry, t.value).availableKg > 0.01);
      setLinesMap((prev) => ({
        ...prev,
        [id]: first ? [makeLine(first.value, stockSlice(entry, first.value))] : [],
      }));
      return [...prev, id];
    });
  };

  const handleSelectAllCompanyBatches = () => {
    const next = {};
    dispatchableCompanyEntries.forEach((e) => {
      const first = STOCK_TYPES.find((t) => stockSlice(e, t.value).availableKg > 0.01);
      next[e.id] = first ? [makeLine(first.value, stockSlice(e, first.value))] : [];
    });
    setSelectedBatchIds(dispatchableCompanyEntries.map((e) => e.id));
    setLinesMap(next);
  };

  const handleDeselectAll = () => {
    setSelectedBatchIds([]);
    setLinesMap({});
  };

  const addLine = (entryId, type) => {
    const entry = allEntries.find((e) => e.id === entryId);
    if (!entry) return;
    // The fraction chips stay clickable on an empty batch, where every one of
    // them is showing zero, so the check cannot live in the checkbox alone.
    if (stockSlice(entry, type).availableKg <= 0.01) return;
    setLinesMap((prev) => {
      const existing = prev[entryId] || [];
      if (existing.some((l) => l.type === type)) return prev;
      return {
        ...prev,
        [entryId]: [...existing, makeLine(type, stockSlice(entry, type))],
      };
    });
  };

  const removeLine = (entryId, type) => {
    setLinesMap((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] || []).filter((l) => l.type !== type),
    }));
  };

  /**
   * Writes one field on a line and derives the other two.
   *
   * The three fields describe one quantity, kg = bags x kg/bag, so two of them
   * determine the third. `changed` says which was edited: editing the bag size
   * moves the bag count, while editing either the weight or the count moves the
   * per-bag figure. Without that distinction a keystroke in any field would
   * fight the others.
   */
  /**
   * Writes one field on a line and lets the shared resolver derive the other
   * two, so kg, bags and KG/bag always describe the same quantity.
   */
  const setLineField = (entryId, type, field, value) => {
    const entry = allEntries.find((e) => e.id === entryId);
    const slice = entry ? stockSlice(entry, type) : null;

    setLinesMap((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] || []).map((l) =>
        l.type === type ? syncDispatchLine(l, field, value, slice?.kgPerBag) : l,
      ),
    }));
  };

  const fillLineMax = (entryId, type) => {
    const entry = allEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const slice = stockSlice(entry, type);
    const line = (linesMap[entryId] || []).find((l) => l.type === type);
    const maxKg = slice.availableKg;
    // Keep a bag size the user typed; otherwise fall back to the recorded ratio,
    // and for a fraction with neither, take the weight as a single bag.
    const perBag = Number(line?.bagSize) || slice.kgPerBag || maxKg || 0;

    const next = {
      kg: String(maxKg),
      // Prefer the tracked maximum. Otherwise the count that the chosen bag
      // size implies, since that is the only bag count that can be derived.
      bags: String(slice.bagsTracked ? slice.availableBags : bagsFor(maxKg, perBag)),
      bagSize: String(perBag),
    };

    setLinesMap((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] || []).map((l) => (l.type === type ? { ...l, ...next } : l)),
    }));
  };

  // Calculations
  const selectedEntries = useMemo(() => {
    return availableCompanyEntries.filter((e) => selectedBatchIds.includes(e.id));
  }, [availableCompanyEntries, selectedBatchIds]);

  const totalCompanyStockAvailableKg = useMemo(() => {
    return Number(
      dispatchableCompanyEntries.reduce((sum, e) => sum + totalAvailableKg(e), 0).toFixed(2),
    );
  }, [dispatchableCompanyEntries]);

  const totalAvailableInSelected = useMemo(() => {
    return Number(
      selectedEntries.reduce((sum, e) => sum + totalAvailableKg(e), 0).toFixed(2),
    );
  }, [selectedEntries]);

  const totalSelectedDispatchKg = useMemo(() => {
    return Number(
      selectedBatchIds
        .reduce((sum, id) => sum + lineTotalKg(linesMap[id]), 0)
        .toFixed(2),
    );
  }, [selectedBatchIds, linesMap]);

  const totalSelectedDispatchBags = useMemo(() => {
    return selectedBatchIds.reduce(
      (sum, id) => sum + lineTotalBags(linesMap[id]),
      0,
    );
  }, [selectedBatchIds, linesMap]);

  /**
   * Two grades of complaint, because they call for different reactions: an
   * error is a line that cannot be recorded as typed, a warning is a line whose
   * bag count runs ahead of the recorded one. Only errors block.
   */
  const { errors: batchErrors, warnings: batchWarnings } = useMemo(
    () =>
      validateDispatch({
        selectedBatchIds,
        linesMap,
        entries: availableCompanyEntries,
      }),
    [selectedBatchIds, linesMap, availableCompanyEntries],
  );

  const hasBatchErrors = batchErrors.length > 0;
  const hasBatchWarnings = batchWarnings.length > 0;

  // Quick-add States
  // Clients have no quick add: a mistyped one becomes a real client that then
  // has to be cleaned up, and a dispatch can be started against it. Add the
  // client on the clients page, then dispatch.
  const [addingDestination, setAddingDestination] = useState(false);
  const [newDestination, setNewDestination] = useState('');

  const [addingApprover, setAddingApprover] = useState(false);
  const [newApprover, setNewApprover] = useState('');

  const [addingDriver, setAddingDriver] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverLicenseNo, setDriverLicenseNo] = useState('');
  const [driverPlateInModal, setDriverPlateInModal] = useState('');

  const [addingPlate, setAddingPlate] = useState(false);
  const [newPlate, setNewPlate] = useState('');

  const handleQuickAddDestination = () => {
    if (!newDestination.trim()) return;
    const dest = newDestination.trim();
    // Recorded first, so the <option> exists by the time the value is set.
    setAddedDestinations((prev) => [...new Set([...prev, dest])]);
    setValue('destination', dest, { shouldValidate: true });
    setAddingDestination(false);
    setNewDestination('');
  };

  const handleQuickAddApprover = () => {
    if (!newApprover.trim()) return;
    const app = newApprover.trim();
    setAddedApprovers((prev) => [...new Set([...prev, app])]);
    setValue('approvedBy', app, { shouldValidate: true });
    setAddingApprover(false);
    setNewApprover('');
  };

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

  /**
   * Freezes everything the dispatch will contain, for the confirmation step.
   *
   * Values are read with getValues() rather than watched, so this runs only when
   * the button is pressed and the summary is a point-in-time record.
   */
  const buildReview = (formData) => {
    const batches = selectedBatchIds
      .map((id) => {
        const entry = allEntries.find((e) => e.id === id);
        if (!entry) return null;
        const lines = (linesMap[id] || []).map((l) => {
          const slice = stockSlice(entry, l.type);
          const meta = STOCK_TYPES.find((t) => t.value === l.type);
          return {
            type: l.type,
            label: meta?.label || l.type,
            kg: Number(l.kg) || 0,
            bags: Number(l.bags) || 0,
            bagSize: Number(l.bagSize) || slice.kgPerBag || 0,
          };
        });
        return {
          id,
          batchNo: entry.batchNo,
          // Carried per batch so a review spanning every client says whose
          // coffee each row is, rather than relying on one client heading.
          companyName: entry.company?.name || '',
          grade: entry.grade || 'Grade 1',
          origin: entry.origin?.name || '',
          location: entry.location?.name || '',
          lines,
          totalKg: lineTotalKg(linesMap[id]),
          totalBags: lineTotalBags(linesMap[id]),
        };
      })
      .filter(Boolean);

    return {
      companyName: selectedCompany?.name || '',
      destination: formData.destination || '',
      purpose: PURPOSE_LABELS[formData.purpose] || formData.purpose || '',
      dispatchDate: formData.dispatchDate || '',
      plateNumber: formData.plateNumber || '',
      driverName: selectedDriver?.name || '',
      approvedBy: formData.approvedBy || '',
      notes: formData.notes || '',
      batches,
      batchCount: batches.length,
      lineCount: batches.reduce((n, b) => n + b.lines.length, 0),
      totalKg: Number(batches.reduce((n, b) => n + b.totalKg, 0).toFixed(2)),
      totalBags: batches.reduce((n, b) => n + b.totalBags, 0),
    };
  };

  /**
   * Validates the form, then shows the summary instead of dispatching.
   *
   * trigger() runs the same zod rules the submit path uses, so nothing gets
   * past here that the server would reject; the batch-level checks are separate
   * and already reflected in the disabled state of the button.
   */
  const openReview = async () => {
    const valid = await trigger();
    if (!valid) return;
    if (hasBatchErrors) return;
    // A previous attempt's failure must not still be on the dialog the user is
    // about to confirm the next dispatch from.
    createMut.reset();
    setDispatchError('');
    setReview(buildReview(getValues()));
  };

  const closeReview = () => setReview(null);

  const onSubmit = async (formData) => {
    if (!selectedCompanyId) return;
    if (selectedBatchIds.length === 0) return;
    if (hasBatchErrors) return;
    if (totalSelectedDispatchKg <= 0) return;

    // Auto-persist new plate to driver if not already in driver's plates
    if (selectedDriver && formData.plateNumber) {
      const cleanPlate = formData.plateNumber.trim();
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

    const entriesPayload = selectedBatchIds.map((id) => ({
      entryId: id,
      kg: lineTotalKg(linesMap[id]),
      bags: lineTotalBags(linesMap[id]),
      lines: (linesMap[id] || []).map((l) => ({
        type: l.type,
        kg: Number(l.kg) || 0,
        bags: Number(l.bags) || 0,
        // Sent so the service can record the figure the user applied; it is
        // optional, and omitted where the database already knows the ratio.
        ...(Number(l.bagSize) > 0 ? { bagSize: Number(l.bagSize) } : {}),
      })),
    }));

    /*
     * Every selected batch's own client, sent when the form is set to all
     * clients. Sending the sentinel instead would be a client id that does not
     * exist, and the service rejects every batch as belonging to nobody.
     */
    const involvedCompanyIds =
      selectedCompanyId === ALL_COMPANIES
        ? [
            ...new Set(
              entriesPayload
                .map((e) => companyEntries.find((c) => c.id === e.entryId)?.companyId)
                .filter(Boolean),
            ),
          ]
        : [selectedCompanyId];

    /*
     * Sending neither, or an empty list, is what the old form did by accident
     * and it produced "companyId must be a string". Caught here so it reads as
     * what it is: the selected batches do not say which client they belong to.
     */
    if (involvedCompanyIds.length === 0) {
      setDispatchError(
        'Could not work out which client these batches belong to. Reopen the batch list and select them again.',
      );
      return;
    }

    createMut.mutate({
      ...(selectedCompanyId === ALL_COMPANIES
        ? { companyIds: involvedCompanyIds }
        : { companyId: selectedCompanyId }),
      entries: entriesPayload,
      destination: formData.destination,
      purpose: formData.purpose,
      dispatchDate: pickerValueToIso(formData.dispatchDate),
      plateNumber: formData.plateNumber,
      driverId: formData.driverId,
      approvedBy: formData.approvedBy || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="outing-page">
      {/* Page Header */}
      <div className="outing-header-bar">
        <div className="outing-header-left">
          <div className="outing-icon">
            <Truck size={24} weight="regular" />
          </div>
          <div>
            <span className="outing-eyebrow">COFFEE OUT</span>
            <h1 className="outing-title">New Coffee Dispatch</h1>
          </div>
        </div>
        <div className="outing-header-right">
          <span className="outing-required-legend">
            Fields marked with <strong style={{ color: 'var(--color-error)' }}>*</strong> are
            required
          </span>
          <button
            type="button"
            className="btn-secondary-nav"
            onClick={() => navigate('/outings')}
          >
            <ArrowLeft size={16} /> Back to Outings
          </button>
        </div>
      </div>

      {createMut.isError && (
        <div className="form-error" style={{ marginBottom: 20 }}>
          {createMut.error?.response?.data?.message ||
            'Could not save dispatch. Please verify available quantities and required fields.'}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="outing-form-container">
        {/* SECTION 1: Company Selection & Available Stock */}
        <section className="outing-card-section">
          <div className="outing-card-section__header">
            <div className="outing-card-section__title">
              <Buildings size={18} weight="regular" />
              <span>1. Select Company & Available Stock</span>
            </div>
            {selectedCompany && (
              <span className="outing-company-badge">
                {selectedCompany.name} ({dispatchableCompanyEntries.length} of {availableCompanyEntries.length} Batches Ready)
              </span>
            )}
          </div>

          <div className="outing-company-select-row">
            <div className="grid-field" style={{ flex: 1 }}>
              <label>
                <span>Select Company / Client <strong className="req-star">*</strong></span>
              </label>
              <select
                className="outing-input outing-input--company"
                value={selectedCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
              >
                <option value="">-- Choose Company to Dispatch From --</option>
                <option value={ALL_COMPANIES}>
                  All Clients (batches from every client)
                </option>
                {sortedCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedCompanyId ? (
            <div className="outing-company-prompt">
              <Buildings size={36} weight="light" />
              <h4>Please select a company above</h4>
              <p>Choose a company to view their available coffee batches in warehouse stock ready for dispatch.</p>
            </div>
          ) : (
            <div className="outing-company-stock-area">
              {/* Actions & Search */}
              <div className="outing-stock-actions-bar">
                <div className="outing-stock-search-wrap">
                  <MagnifyingGlass size={16} className="outing-stock-search-icon" />
                  <input
                    type="text"
                    placeholder={`Filter ${selectedCompany.name}'s batches by batch no, grade...`}
                    className="outing-stock-search-input"
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                  />
                </div>

                <label className="outing-stock-only-available">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                  />
                  <span>
                    Only batches with stock left
                    {spentCount > 0 && (
                      <em className="outing-stock-only-available__count">
                        {spentCount} spent {spentCount === 1 ? 'batch' : 'batches'} hidden
                      </em>
                    )}
                  </span>
                </label>

                <div className="outing-stock-btn-group">
                  <button
                    type="button"
                    className="outing-batch-btn outing-batch-btn--select-all"
                    onClick={handleSelectAllCompanyBatches}
                    disabled={dispatchableCompanyEntries.length === 0}
                  >
                    <Checks size={16} weight="bold" />
                    Select All Batches ({totalCompanyStockAvailableKg.toLocaleString()} KG)
                  </button>
                  {selectedBatchIds.length > 0 && (
                    <button
                      type="button"
                      className="outing-batch-btn outing-batch-btn--clear"
                      onClick={handleDeselectAll}
                    >
                      Deselect All
                    </button>
                  )}
                </div>
              </div>

              {/* One card per batch. A table cannot hold a nested editor per
                  coffee type without becoming unreadable on a phone, and the
                  per-type amounts are the thing being edited here. */}
              <div className="outing-batch-list">
                {filteredCompanyEntries.length === 0 ? (
                  <div className="outing-multi-empty">
                    {availableCompanyEntries.length === 0
                      ? `${selectedCompany.name} has no batches in the warehouse.`
                      : onlyAvailable && dispatchableCompanyEntries.length === 0
                        ? `None of the ${availableCompanyEntries.length} batches for ${selectedCompany.name} has anything left to dispatch.`
                        : spentCount > 0 && !batchSearch.trim()
                          ? `No batches with stock left. ${spentCount} fully dispatched ${spentCount === 1 ? 'batch is' : 'batches are'} hidden - untick the filter to see ${spentCount === 1 ? 'it' : 'them'}.`
                          : 'No batches match your search.'}
                  </div>
                ) : (
                  filteredCompanyEntries.map((entry) => {
                    const slices = stockForEntry(entry);
                    const isSelected = selectedBatchIds.includes(entry.id);
                    const lines = linesMap[entry.id] || [];
                    const activeTypes = lines.map((l) => l.type);
                    const batchTotal = lineTotalKg(lines);
                    const batchBags = lineTotalBags(lines);
                    const entryErrors = batchErrors.filter((er) => er.entryId === entry.id);
                    // Listed but not dispatchable: still here to be found, with
                    // the reason shown, rather than silently missing.
                    const isEmpty = !hasAnyStock(entry);
                    const availKg = totalAvailableKg(entry);

                    return (
                      <article
                        key={entry.id}
                        className={`outing-batch-card ${isSelected ? 'outing-batch-card--on' : ''} ${entryErrors.length ? 'outing-batch-card--err' : ''} ${isEmpty ? 'outing-batch-card--empty' : ''}`}
                      >
                        <div className="outing-batch-card__head">
                          <label className="outing-batch-card__pick">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBatch(entry.id)}
                              disabled={isEmpty}
                              aria-label={
                                isEmpty
                                  ? `Batch ${entry.batchNo}, nothing left to dispatch`
                                  : `Select batch ${entry.batchNo}`
                              }
                            />
                            <span>
                              <strong className="outing-batch-no">{entry.batchNo}</strong>
                              <span className="outing-batch-sub">
                                {showAllCompanies && entry.company?.name
                                  ? `${entry.company.name} · `
                                  : ''}
                                {entry.grade || 'Grade 1'}
                                {entry.origin?.name ? ` · ${entry.origin.name}` : ''}
                                {entry.location?.name ? ` · ${entry.location.name}` : ''}
                              </span>
                            </span>
                          </label>

                          <div className="outing-batch-card__avail">
                            <span className="outing-batch-card__avail-label">Available</span>
                            <strong>{availKg.toLocaleString()} KG</strong>
                            {isEmpty && <em className="outing-batch-card__empty-note">Nothing left to dispatch</em>}
                          </div>
                        </div>

                        {/* Type chips. Each shows what is left of that fraction;
                            clicking adds a line for it. */}
                        <div className="outing-type-chips" role="group" aria-label="Coffee types in this batch">
                          {slices.map((slice) => {
                            const on = activeTypes.includes(slice.value);
                            const none = slice.availableKg <= 0.01;
                            return (
                              <button
                                key={slice.value}
                                type="button"
                                className={`outing-type-chip outing-type-chip--${slice.value.toLowerCase()} ${on ? 'outing-type-chip--on' : ''} ${none ? 'outing-type-chip--empty' : ''}`}
                                onClick={() => (on ? removeLine(entry.id, slice.value) : addLine(entry.id, slice.value))}
                                disabled={!on && none}
                                aria-pressed={on}
                                title={none ? `No ${slice.label} left in this batch` : `${slice.label} — ${slice.availableKg.toLocaleString()} KG available`}
                              >
                                <span className="outing-type-chip__label">{slice.label}</span>
                                <span className="outing-type-chip__kg">{slice.availableKg.toLocaleString()} KG</span>
                              </button>
                            );
                          })}
                        </div>

                        {isSelected && (
                          <div className="outing-lines">
                            {lines.length === 0 && (
                              <p className="outing-lines__empty">
                                Pick at least one coffee type above to dispatch from this batch.
                              </p>
                            )}

                            {lines.map((line) => {
                              const slice = stockSlice(entry, line.type);
                              const meta = STOCK_TYPES.find((t) => t.value === line.type);
                              const kgNum = Number(line.kg) || 0;
                              const overKg = kgNum > slice.availableKg + 0.01;
                              const bagsNum = Number(line.bags) || 0;
                              // Only a fraction with a recorded bag count has a
                              // maximum to exceed; the rest take a typed bag size.
                              const overBags = slice.bagsTracked && bagsNum > slice.availableBags;
                              const mismatch = bagConsistency(line, slice);
                              // Read the line's own value, never the batch record.
                              // The record only seeds the field when the line is
                              // created; binding to it directly would freeze the
                              // field and hide every recalculation.
                              const perBagValue = line.bagSize || '';

                              return (
                                <div key={line.type} className="outing-line">
                                  <div className="outing-line__head">
                                    <span className={`outing-line__dot outing-line__dot--${line.type.toLowerCase()}`} aria-hidden="true" />
                                    <span className="outing-line__label">{meta?.label || line.type}</span>
                                    <span className="outing-line__max">
                                      max {slice.availableKg.toLocaleString()} KG
                                      {slice.availableBags > 0 ? ` · ${slice.availableBags} bags` : ''}
                                    </span>
                                  </div>

                                  <div className="outing-line__inputs">
                                    <label className="outing-line__field">
                                      <span>Weight (KG)</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={slice.availableKg}
                                        value={line.kg}
                                        onChange={(e) => setLineField(entry.id, line.type, 'kg', e.target.value)}
                                        className={overKg ? 'outing-line__input--err' : ''}
                                        aria-label={`${meta?.label} weight in KG for batch ${entry.batchNo}`}
                                      />
                                    </label>

                                    <label className="outing-line__field outing-line__field--narrow">
                                      <span>Bags</span>
                                      <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max={slice.bagsTracked ? slice.availableBags : undefined}
                                        value={line.bags}
                                        onChange={(e) => setLineField(entry.id, line.type, 'bags', e.target.value)}
                                        placeholder={slice.bagsTracked ? String(slice.availableBags) : '0'}
                                        className={overBags ? 'outing-line__input--err' : ''}
                                        aria-label={`${meta?.label} bags for batch ${entry.batchNo}`}
                                      />
                                    </label>

                                    <label className="outing-line__field outing-line__field--narrow">
                                      <span>
                                        KG / Bag
                                        {!slice.bagsTracked && <em className="outing-line__manual">no record</em>}
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={perBagValue}
                                        onChange={(e) => setLineField(entry.id, line.type, 'bagSize', e.target.value)}
                                        placeholder="e.g. 50"
                                        className={slice.bagsTracked ? '' : 'outing-line__input--manual'}
                                        title={
                                          slice.bagsTracked
                                            ? `Seeded from the batch record (${slice.kgPerBag} KG). Edit to re-count the bags.`
                                            : 'No bag count on record for this type — enter the bag size to count bags.'
                                        }
                                        aria-label={`${meta?.label} weight per bag for batch ${entry.batchNo}`}
                                      />
                                    </label>

                                    <div className="outing-line__actions">
                                      <button type="button" onClick={() => fillLineMax(entry.id, line.type)}>Max</button>
                                      <button
                                        type="button"
                                        onClick={() => removeLine(entry.id, line.type)}
                                        aria-label={`Remove ${meta?.label} from batch ${entry.batchNo}`}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>

                                  {mismatch && (
                                    <p className="outing-line__warn">
                                      <WarningCircle size={13} weight="fill" aria-hidden="true" />
                                      <span>
                                        {bagsNum} bags at {mismatch.perBag.toLocaleString()} KG is{' '}
                                        <strong>{mismatch.impliedKg.toLocaleString()} KG</strong>, not the{' '}
                                        {kgNum.toLocaleString()} KG entered. Dispatching anyway.
                                      </span>
                                    </p>
                                  )}
                                </div>
                              );
                            })}

                            {lines.length > 0 && (
                              <div className="outing-lines__total">
                                <span>Batch total</span>
                                <strong>{batchTotal.toLocaleString()} KG</strong>
                                {batchBags > 0 && <span className="outing-lines__bags">{batchBags} bags</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>

              {/* Prominent Total Available & Dispatch Summary Card */}
              <div className="outing-summary-banner">
                <div className="outing-summary-banner-grid">
                  <div className="outing-summary-item">
                    <span className="outing-summary-label">Company Total Stock</span>
                    <div className="outing-summary-val">
                      <strong>{totalCompanyStockAvailableKg.toLocaleString()}</strong>
                      <span className="outing-summary-unit">KG</span>
                    </div>
                  </div>

                  <div className="outing-summary-item">
                    <span className="outing-summary-label">Batches Selected</span>
                    <div className="outing-summary-val">
                      <strong>{selectedBatchIds.length}</strong>
                      <span className="outing-summary-unit">of {availableCompanyEntries.length}</span>
                    </div>
                  </div>

                  <div className="outing-summary-item outing-summary-item--highlight">
                    <span className="outing-summary-label">TOTAL KG TO DISPATCH</span>
                    <div className="outing-summary-val outing-summary-val--hero">
                      <strong>{totalSelectedDispatchKg.toLocaleString()}</strong>
                      <span className="outing-summary-unit">KG</span>
                    </div>
                  </div>
                </div>

                {selectedBatchIds.length === 0 && (
                  <div className="outing-banner-status outing-banner-status--info">
                    <Package size={16} weight="bold" />
                    <span>Select one or multiple batches above, or click <strong>Select All Batches</strong> to dispatch all available coffee for {selectedCompany.name}.</span>
                  </div>
                )}

                {hasBatchErrors && (
                  <div className="outing-banner-status outing-banner-status--err">
                    <WarningCircle size={16} weight="fill" />
                    <span>{batchErrors[0].msg}</span>
                  </div>
                )}

                {hasBatchWarnings && !hasBatchErrors && (
                  <div className="outing-banner-status outing-banner-status--warn">
                    <WarningCircle size={16} weight="fill" />
                    <span>
                      {batchWarnings.length === 1
                        ? batchWarnings[0].msg
                        : `${batchWarnings.length} lines ask for more than the batch records. You can still dispatch.`}
                    </span>
                  </div>
                )}

                {selectedBatchIds.length > 0 && !hasBatchErrors && (
                  <div className="outing-banner-status outing-banner-status--ok">
                    <CheckCircle size={16} weight="fill" />
                    <span>
                      Ready to dispatch <strong>{totalSelectedDispatchKg.toLocaleString()} KG</strong> across{' '}
                      <strong>{selectedBatchIds.length}</strong> {selectedBatchIds.length === 1 ? 'batch' : 'batches'} for <strong>{selectedCompany.name}</strong>.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2: Destination, Purpose & Authorization */}
        <section className="outing-card-section">
          <div className="outing-card-section__header">
            <div className="outing-card-section__title">
              <MapPin size={18} weight="regular" />
              <span>2. Destination, Purpose & Release Authorization</span>
            </div>
          </div>

          <div className="outing-form-grid">
            <div className="grid-field">
              <label>
                <span>
                  Destination <span className="opt-label" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-tertiary)' }}>(Optional)</span>
                </span>
                <button
                  type="button"
                  className="inbound-add-link"
                  onClick={() => setAddingDestination(true)}
                >
                  + Quick Add
                </button>
              </label>
              <select className="outing-input" {...register('destination')}>
                <option value="">Select destination (optional)...</option>
                {sortedDestinations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {errors.destination && (
                <span className="error-text">{errors.destination.message}</span>
              )}
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Dispatch Purpose <strong className="req-star">*</strong>
                </span>
              </label>
              <select className="outing-input" {...register('purpose')}>
                <option value="EXPORT">Export</option>
                <option value="INTERNAL_TRANSFER">Internal Transfer</option>
                <option value="RETURN_TO_SUPPLIER">Return to Supplier</option>
              </select>
            </div>

            <div className="grid-field">
              <label>
                <span>
                  Dispatch Date & Time <strong className="req-star">*</strong>
                </span>
              </label>
              <EthiopianDatePicker
                {...register('dispatchDate')}
                value={watch('dispatchDate')}
                onChange={(v) =>
                  setValue('dispatchDate', v, { shouldDirty: true, shouldValidate: true })
                }
                label=""
                showTime
                placeholder="Select dispatch date & time"
                error={errors.dispatchDate?.message}
                className="outing-date-picker"
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: Driver, Plate & Approval */}
        <section className="outing-card-section">
          <div className="outing-card-section__header">
            <div className="outing-card-section__title">
              <Truck size={18} weight="regular" />
              <span>3. Transport Driver, Truck Plate & Approval</span>
            </div>
          </div>

          <div className="outing-form-grid">
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
              <select className="outing-input" {...register('driverId')} value={watch('driverId') ?? ''}>
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
                <select className="outing-input" {...register('plateNumber')} value={watch('plateNumber') ?? ''}>
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
                  className="outing-input"
                  placeholder={driverId ? 'Type plate (e.g. AA-12345)' : 'Select driver or type plate...'}
                  {...register('plateNumber')}
                />
              )}
              {errors.plateNumber && (
                <span className="error-text">{errors.plateNumber.message}</span>
              )}
            </div>

            <div className="grid-field">
              <label>
                <span>Approved By</span>
                <button
                  type="button"
                  className="inbound-add-link"
                  onClick={() => setAddingApprover(true)}
                >
                  + Quick Add
                </button>
              </label>
              <select className="outing-input" {...register('approvedBy')}>
                <option value="">Select approver (optional)...</option>
                {sortedApprovers.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="outing-submit-bar">
          <button
            type="button"
            className="btn-draft"
            onClick={() => navigate('/outings')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-confirm"
            onClick={openReview}
            disabled={!selectedCompanyId || selectedBatchIds.length === 0 || totalSelectedDispatchKg <= 0 || hasBatchErrors || isSubmitting || createMut.isPending}
          >
            <CheckCircle size={20} weight="fill" />
            {isSubmitting || createMut.isPending
              ? 'Saving Dispatch...'
              : totalSelectedDispatchKg > 0
              ? `Review Dispatch — ${totalSelectedDispatchKg.toLocaleString()} KG (${selectedBatchIds.length} ${selectedBatchIds.length === 1 ? 'Batch' : 'Batches'})`
              : 'Review Dispatch'}
          </button>
        </div>
      </form>

      {/* CONFIRMATION: everything about to be dispatched, before anything is saved */}
      <Modal
        isOpen={!!review}
        onClose={closeReview}
        title="Review Dispatch"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeReview} disabled={createMut.isPending}>
              Back to Edit
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit(onSubmit)}
              loading={createMut.isPending}
            >
              <CheckCircle size={18} weight="fill" />
              {createMut.isPending
                ? 'Saving Dispatch...'
                : `Confirm — Dispatch ${review ? review.totalKg.toLocaleString() : ''} KG`}
            </Button>
          </>
        }
      >
        {/*
         * The failure has to be reported here. This dialog covers the page, and
         * the error banner on the form behind it stayed hidden for the whole
         * time it was open, so a rejected dispatch closed nothing, said nothing
         * and looked like it had done nothing.
         */}
        {(dispatchError || createMut.isError) && (
          <div className="form-error" style={{ marginBottom: 16 }}>
            {dispatchError ||
              (Array.isArray(createMut.error?.response?.data?.message)
                ? createMut.error.response.data.message.join(', ')
                : createMut.error?.response?.data?.message ||
                  'Could not save dispatch. Please verify available quantities and required fields.')}
          </div>
        )}
        {review && (
          <div className="outing-review">
            <div className="outing-review__totals">
              <div>
                <span>Total weight</span>
                <strong>{review.totalKg.toLocaleString()} KG</strong>
              </div>
              <div>
                <span>Total bags</span>
                <strong>{review.totalBags.toLocaleString()}</strong>
              </div>
              <div>
                <span>Batches</span>
                <strong>{review.batchCount}</strong>
              </div>
              <div>
                <span>Lines</span>
                <strong>{review.lineCount}</strong>
              </div>
            </div>

            <dl className="outing-review__meta">
              <div><dt>Company</dt><dd>{review.companyName}</dd></div>
              <div><dt>Purpose</dt><dd>{review.purpose}</dd></div>
              <div><dt>Dispatch date</dt><dd>{formatEthiopian(new Date(review.dispatchDate), { includeTime: true })}</dd></div>
              <div><dt>Truck plate</dt><dd>{review.plateNumber}</dd></div>
              <div><dt>Driver</dt><dd>{review.driverName}</dd></div>
              <div><dt>Destination</dt><dd>{review.destination || '—'}</dd></div>
              <div><dt>Approved by</dt><dd>{review.approvedBy || '—'}</dd></div>
              <div><dt>Notes</dt><dd>{review.notes || '—'}</dd></div>
            </dl>

            <div className="outing-review__batches">
              {review.batches.map((b) => (
                <div key={b.id} className="outing-review__batch">
                  <div className="outing-review__batch-head">
                    <strong>{b.batchNo}</strong>
                    <span>
                      {showAllCompanies && b.companyName ? `${b.companyName} · ` : ''}
                      {b.grade}
                      {b.origin ? ` · ${b.origin}` : ''}
                      {b.location ? ` · ${b.location}` : ''}
                    </span>
                    <span className="outing-review__batch-total">
                      {b.totalKg.toLocaleString()} KG
                      {b.totalBags > 0 ? ` · ${b.totalBags} bags` : ''}
                    </span>
                  </div>

                  <table className="outing-review__lines">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th className="text-right">KG / Bag</th>
                        <th className="text-right">Bags</th>
                        <th className="text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.lines.map((l) => (
                        <tr key={l.type}>
                          <td>
                            <span className={`outing-review__dot outing-review__dot--${l.type.toLowerCase()}`} aria-hidden="true" />
                            {l.label}
                          </td>
                          <td className="text-right font-mono">{l.bagSize ? l.bagSize.toLocaleString() : '—'}</td>
                          <td className="text-right font-mono">{l.bags > 0 ? l.bags.toLocaleString() : '—'}</td>
                          <td className="text-right font-mono">{l.kg.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <p className="outing-review__note">
              This writes a dispatch record per batch and deducts each line from the coffee type it came
              from. It cannot be undone from this page.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={addingDestination}
        onClose={() => setAddingDestination(false)}
        title="Quick Add Destination"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingDestination(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!newDestination.trim()}
              onClick={handleQuickAddDestination}
            >
              Add & Select Destination
            </Button>
          </>
        }
      >
        <Input
          label="Destination Name"
          required
          placeholder="e.g. Djibouti Port Terminal"
          value={newDestination}
          onChange={(e) => setNewDestination(e.target.value)}
        />
      </Modal>

      <Modal
        isOpen={addingApprover}
        onClose={() => setAddingApprover(false)}
        title="Quick Add Approver"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingApprover(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!newApprover.trim()}
              onClick={handleQuickAddApprover}
            >
              Add & Select Approver
            </Button>
          </>
        }
      >
        <Input
          label="Approver Full Name"
          required
          placeholder="e.g. Dawit Tadesse (Warehouse Manager)"
          value={newApprover}
          onChange={(e) => setNewApprover(e.target.value)}
        />
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

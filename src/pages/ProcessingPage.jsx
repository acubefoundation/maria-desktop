import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatEthiopian } from '../lib/ethiopianCalendar';
import { toLocalNaive, pickerValueToIso } from '../lib/localDate';
import {
  Plus,
  MagnifyingGlass,
  Funnel,
  FileXls,
  FilePdf,
  CheckCircle,
  WarningCircle,
  Scales,
  Lightning,
  ArrowsClockwise,
  Checks,
  Package,
  Calculator,
} from '@phosphor-icons/react';
import { processingApi, entriesApi, usersApi, stockApi, companiesApi } from '../lib/api';
import { sortByName } from '../lib/utils';
import { exportToExcel, exportToPdf } from '../lib/exportUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Table, Pagination } from '../components/ui/Table';
import { SlideOver } from '../components/ui/Modal';
import { EthiopianDatePicker } from '../components/ui/EthiopianDatePicker';
import './ProcessingPage.css';

const processingSchema = z.object({
  processDate: z.string().min(1, 'Process date & time is required'),
  cleanKg: z.coerce.number().min(0, 'Cannot be negative'),
  rejectSortexKg: z.coerce.number().min(0, 'Cannot be negative').default(0),
  rejectGravityKg: z.coerce.number().min(0, 'Cannot be negative').default(0),
  rejectSizeKg: z.coerce.number().min(0, 'Cannot be negative').default(0),
  rejectKg: z.coerce.number().min(0, 'Cannot be negative').optional(),
  wasteKg: z.coerce.number().min(0, 'Cannot be negative'),
  line: z.string().optional(),
  notes: z.string().optional(),
  operatorId: z.string().optional(),
});

export function ProcessingPage() {
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [slideOpen, setSlideOpen] = useState(false);

  // Summary scope filter (All Warehouse Batches vs specific batch vs company)
  const [summaryBatchId, setSummaryBatchId] = useState('ALL');
  const [batchFilterQuery, setBatchFilterQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  // Clean Coffee Bag Conversion State - Unified bidirectional calculator
  const [selectedBagSize, setSelectedBagSize] = useState(60); // 50 | 60 | 85 | 86 | 100 | 'custom'
  const [customBagSize, setCustomBagSize] = useState(60);
  const [cleanBagsCount, setCleanBagsCount] = useState(''); // string for input flexibility
  const [looseKg, setLooseKg] = useState(0);
  const [lastEditedField, setLastEditedField] = useState(''); // 'cleanKg' | 'cleanBagsCount' | 'looseKg'

  // Helper to get numeric value of bags
  const getCleanBagsNum = () => parseInt(cleanBagsCount, 10) || 0;

  // Quick Add Operator State
  const [addingOperator, setAddingOperator] = useState(false);
  const [opName, setOpName] = useState('');
  const [opEmail, setOpEmail] = useState('');
  const [opPassword, setOpPassword] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch processing logs
  const { data, isLoading } = useQuery({
    queryKey: ['processing', { search: debouncedSearch }],
    queryFn: () => processingApi.list({ search: debouncedSearch }),
  });

  // Group processing logs by session (multi-batch logs share processDate, operator, line)
  const groupedSessions = useMemo(() => {
    const logs = data?.data || [];
    const sessionMap = new Map();

    for (const log of logs) {
      const isMultiBatch = log.notes?.includes('Multi-batch session');
      let sessionKey;

      if (isMultiBatch) {
        // Group multi-batch logs by processDate + operatorId + line
        sessionKey = `${log.processDate}|${log.operator?.id || 'unknown'}|${log.line || 'no-line'}`;
      } else {
        // Single-batch logs: each is its own session
        sessionKey = `single|${log.id}`;
      }

      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, {
          logs: [],
          processDate: log.processDate,
          operator: log.operator,
          line: log.line,
          isMultiBatch,
        });
      }
      sessionMap.get(sessionKey).logs.push(log);
    }

    // Convert to array and compute aggregates
    return Array.from(sessionMap.values()).map((session) => {
      const logs = session.logs;
      const totalKgMoved = logs.reduce((sum, l) => sum + Number(l.kgMoved || 0), 0);
      const totalCleanKg = logs.reduce((sum, l) => sum + Number(l.cleanKg || 0), 0);
      const totalCleanBags = logs.reduce((sum, l) => sum + Number(l.cleanBags || 0), 0);
      const totalRejectKg = logs.reduce((sum, l) => sum + Number(l.rejectKg || 0), 0);
      const totalRejectSortex = logs.reduce((sum, l) => sum + Number(l.rejectSortexKg || 0), 0);
      const totalRejectGravity = logs.reduce((sum, l) => sum + Number(l.rejectGravityKg || 0), 0);
      const totalRejectSize = logs.reduce((sum, l) => sum + Number(l.rejectSizeKg || 0), 0);
      const totalWasteKg = logs.reduce((sum, l) => sum + Number(l.wasteKg || 0), 0);
      const batchNos = logs.map(l => l.entry?.batchNo).filter(Boolean);
      const companies = [...new Set(logs.map(l => l.entry?.company?.name).filter(Boolean))];

      return {
        ...session,
        totalKgMoved,
        totalCleanKg,
        totalCleanBags,
        totalRejectKg,
        totalRejectSortex,
        totalRejectGravity,
        totalRejectSize,
        totalWasteKg,
        batchNos,
        companies,
        batchCount: logs.length,
        firstLog: logs[0],
      };
    }).sort((a, b) => new Date(b.processDate).getTime() - new Date(a.processDate).getTime());
  }, [data?.data]);

  // Client-side pagination on grouped sessions
  const paginatedSessions = useMemo(() => {
    const start = (page - 1) * limit;
    return groupedSessions.slice(start, start + limit);
  }, [groupedSessions, page, limit]);

  // Fetch all entries immediately so the Top Processing Summary & Form have live data
  const { data: allEntriesData } = useQuery({
    queryKey: ['entries-all-processing'],
    queryFn: () => entriesApi.list({ limit: 1000 }),
  });

  // Also fetch stock summary as fallback
  const { data: stockSummary } = useQuery({
    queryKey: ['stock-summary'],
    queryFn: () => stockApi.summary(),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies', { limit: 200 }],
    queryFn: () => companiesApi.list({ limit: 200 }),
  });

  const sortedCompanies = useMemo(
    () => sortByName(companiesData?.data || []),
    [companiesData],
  );

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({}),
    enabled: slideOpen && canWrite,
  });

  const sortedUsers = useMemo(
    () => sortByName(usersData?.data || []),
    [usersData],
  );

  const allEntries = useMemo(() => {
    return [...(allEntriesData?.data || [])].sort((a, b) => {
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
  }, [allEntriesData]);

  // Processable batches (unprocessed, in cleaning, or partially processed with remaining > 0)
  const processableEntries = useMemo(() => {
    return allEntries.filter((e) => {
      const remKg = (e.kg || 0) - (e.kgMoved || 0);
      const isProcessableStatus = [
        'IN_STOCK_UNPROCESSED',
        'IN_CLEANING',
        'PARTIALLY_PROCESSED',
      ].includes(e.status);
      return isProcessableStatus || remKg > 0.01;
    });
  }, [allEntries]);

  const companyProcessableEntries = useMemo(() => {
    if (!companyFilter) return processableEntries;
    return processableEntries.filter((e) => e.companyId === companyFilter);
  }, [processableEntries, companyFilter]);

  const filteredProcessableEntries = useMemo(() => {
    if (!batchFilterQuery.trim()) return companyProcessableEntries;
    const q = batchFilterQuery.toLowerCase();
    return companyProcessableEntries.filter(
      (e) =>
        e.batchNo?.toLowerCase().includes(q) ||
        e.company?.name?.toLowerCase().includes(q) ||
        e.grade?.toLowerCase().includes(q)
    );
  }, [companyProcessableEntries, batchFilterQuery]);

  const selectedCompanyForProc = useMemo(
    () => sortedCompanies.find((c) => c.id === companyFilter),
    [sortedCompanies, companyFilter],
  );

  const totalFilteredAvailableKg = useMemo(() => {
    return Number(
      filteredProcessableEntries
        .reduce((sum, e) => {
          const avail = Math.max(0, (Number(e.kg) || 0) - (Number(e.kgMoved) || 0));
          return sum + avail;
        }, 0)
        .toFixed(2),
    );
  }, [filteredProcessableEntries]);

  // Compute Top Processing Summary (Requirement 16)
  const summaryStats = useMemo(() => {
    if (summaryBatchId && summaryBatchId.startsWith('COMPANY:')) {
      const compId = summaryBatchId.replace('COMPANY:', '');
      const compBatches = allEntries.filter((e) => e.companyId === compId);
      const compObj = sortedCompanies.find((c) => c.id === compId);
      const compName = compObj?.name || 'Selected Company';
      const totals = compBatches.reduce(
        (acc, e) => {
          const s = Number(e.rejectSortexKg) || 0;
          const g = Number(e.rejectGravityKg) || 0;
          const z = Number(e.rejectSizeKg) || 0;
          const r = Number(e.rejectKg) || (s + g + z);
          acc.totalIn += Number(e.kg) || 0;
          acc.processed += Number(e.kgMoved) || 0;
          acc.clean += Number(e.cleanKg) || 0;
          acc.rejectSortex += s;
          acc.rejectGravity += g;
          acc.rejectSize += z;
          acc.reject += r;
          acc.waste += Number(e.wasteKg) || 0;
          return acc;
        },
        { totalIn: 0, processed: 0, clean: 0, rejectSortex: 0, rejectGravity: 0, rejectSize: 0, reject: 0, waste: 0 },
      );
      return {
        scopeLabel: `All Batches — ${compName}`,
        totalIn: totals.totalIn,
        processed: totals.processed,
        remaining: Math.max(0, totals.totalIn - totals.processed),
        clean: totals.clean,
        rejectSortex: totals.rejectSortex,
        rejectGravity: totals.rejectGravity,
        rejectSize: totals.rejectSize,
        reject: totals.reject,
        waste: totals.waste,
        batch: null,
        companyId: compId,
        companyName: compName,
      };
    }

    if (summaryBatchId !== 'ALL') {
      const target = allEntries.find((e) => e.id === summaryBatchId);
      if (target) {
        const totalIn = Number(target.kg) || 0;
        const processed = Number(target.kgMoved) || 0;
        const remaining = Math.max(0, totalIn - processed);
        const clean = Number(target.cleanKg) || 0;
        const rejectSortex = Number(target.rejectSortexKg) || 0;
        const rejectGravity = Number(target.rejectGravityKg) || 0;
        const rejectSize = Number(target.rejectSizeKg) || 0;
        const reject = Number(target.rejectKg) || (rejectSortex + rejectGravity + rejectSize);
        const waste = Number(target.wasteKg) || 0;
        return {
          scopeLabel: `${target.batchNo} (${target.company?.name || 'Batch'})`,
          totalIn,
          processed,
          remaining,
          clean,
          rejectSortex,
          rejectGravity,
          rejectSize,
          reject,
          waste,
          batch: target,
          companyId: target.companyId,
          companyName: target.company?.name,
        };
      }
    }

    if (allEntries.length > 0) {
      const totals = allEntries.reduce(
        (acc, e) => {
          const s = Number(e.rejectSortexKg) || 0;
          const g = Number(e.rejectGravityKg) || 0;
          const z = Number(e.rejectSizeKg) || 0;
          const r = Number(e.rejectKg) || (s + g + z);
          acc.totalIn += Number(e.kg) || 0;
          acc.processed += Number(e.kgMoved) || 0;
          acc.clean += Number(e.cleanKg) || 0;
          acc.rejectSortex += s;
          acc.rejectGravity += g;
          acc.rejectSize += z;
          acc.reject += r;
          acc.waste += Number(e.wasteKg) || 0;
          return acc;
        },
        { totalIn: 0, processed: 0, clean: 0, rejectSortex: 0, rejectGravity: 0, rejectSize: 0, reject: 0, waste: 0 }
      );
      return {
        scopeLabel: 'All Warehouse Batches',
        totalIn: totals.totalIn,
        processed: totals.processed,
        remaining: Math.max(0, totals.totalIn - totals.processed),
        clean: totals.clean,
        rejectSortex: totals.rejectSortex,
        rejectGravity: totals.rejectGravity,
        rejectSize: totals.rejectSize,
        reject: totals.reject,
        waste: totals.waste,
        batch: null,
        companyId: null,
        companyName: null,
      };
    }

    // Fallback to stockSummary if entries haven't loaded
    const totalIn = Number(stockSummary?.totalKg) || 0;
    const processed = Number(stockSummary?.processedKg) || 0;
    const fallbackSortex = Number(stockSummary?.rejectSortexKg) || 0;
    const fallbackGravity = Number(stockSummary?.rejectGravityKg) || 0;
    const fallbackSize = Number(stockSummary?.rejectSizeKg) || 0;
    const fallbackReject = Number(stockSummary?.rejectKg) || (fallbackSortex + fallbackGravity + fallbackSize);
    return {
      scopeLabel: 'All Warehouse Batches',
      totalIn,
      processed,
      remaining: Math.max(0, totalIn - processed),
      clean: Number(stockSummary?.cleanKg) || 0,
      rejectSortex: fallbackSortex,
      rejectGravity: fallbackGravity,
      rejectSize: fallbackSize,
      reject: fallbackReject,
      waste: Number(stockSummary?.wasteKg) || 0,
      batch: null,
      companyId: null,
      companyName: null,
    };
  }, [allEntries, summaryBatchId, stockSummary, sortedCompanies]);

  const processedPct =
    summaryStats.totalIn > 0
      ? Math.min(100, (summaryStats.processed / summaryStats.totalIn) * 100)
      : 0;
  const cleanYieldPct =
    summaryStats.processed > 0
      ? ((summaryStats.clean / summaryStats.processed) * 100).toFixed(1)
      : '0.0';
  const rejectYieldPct =
    summaryStats.processed > 0
      ? ((summaryStats.reject / summaryStats.processed) * 100).toFixed(1)
      : '0.0';
  const wasteYieldPct =
    summaryStats.processed > 0
      ? ((summaryStats.waste / summaryStats.processed) * 100).toFixed(1)
      : '0.0';

  // Multi-entry selection state
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [batchKgMap, setBatchKgMap] = useState({});

  // Arriving from a batch's "Log Processing" button carries ?entryId=..., which
  // should open the form with that batch already chosen instead of making the
  // user find it again in the list.
  const [searchParams] = useSearchParams();
  const initialEntryId = searchParams.get('entryId') || '';
  const preselectedRef = useRef('');

  useEffect(() => {
    // Guard on the id rather than on "is it selected": closing the form clears
    // selectedBatchIds, and without this the form would reopen itself.
    if (!initialEntryId || preselectedRef.current === initialEntryId) return;
    // Viewers cannot process anything, so don't open a form they can't submit.
    if (!canWrite) return;
    // Wait for the list to arrive, otherwise there is nothing to select.
    if (!allEntries.length) return;

    const match = allEntries.find((e) => e.id === initialEntryId);
    if (!match) return;

    preselectedRef.current = initialEntryId;
    if (match.companyId) setCompanyFilter(match.companyId);
    setSelectedBatchIds([match.id]);
    const avail = Math.max(0, Number(((match.kg || 0) - (match.kgMoved || 0)).toFixed(2)));
    setBatchKgMap({ [match.id]: avail });
    setSlideOpen(true);
  }, [initialEntryId, allEntries, canWrite]);

  const createMut = useMutation({
    mutationFn: processingApi.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing'] });
      queryClient.invalidateQueries({ queryKey: ['entries-stock'] });
      queryClient.invalidateQueries({ queryKey: ['entries-all-processing'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setSlideOpen(false);
    },
  });

  const createOpMut = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (newOp) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setValue('operatorId', newOp.id);
      setAddingOperator(false);
      setOpName('');
      setOpEmail('');
      setOpPassword('');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(processingSchema),
    defaultValues: {
      processDate: toLocalNaive(new Date()),
      cleanKg: '',
      rejectSortexKg: 0,
      rejectGravityKg: 0,
      rejectSizeKg: 0,
      rejectKg: 0,
      wasteKg: 0,
      line: 'Line 1',
      notes: '',
      operatorId: '',
    },
  });

  const effectiveBagSize = useMemo(() => {
    if (selectedBagSize === 'custom') {
      const parsed = parseFloat(customBagSize);
      return parsed > 0 ? parsed : 60;
    }
    return Number(selectedBagSize) || 60;
  }, [selectedBagSize, customBagSize]);

  const calcBagsAndLoose = (kg, bagSize) => {
    const num = Number(kg) || 0;
    const size = Number(bagSize) || 60;
    if (num <= 0 || size <= 0) return { bags: 0, loose: 0 };
    const full = Math.floor(num / size);
    const loose = Number((num - full * size).toFixed(2));
    return { bags: full, loose };
  };

  // Bidirectional calculator - handles all input scenarios
  const recalcFromCleanKg = (cleanKgVal) => {
    const val = Number(cleanKgVal) || 0;
    if (val > 0 && effectiveBagSize > 0) {
      const full = Math.floor(val / effectiveBagSize);
      const rem = Number((val - full * effectiveBagSize).toFixed(2));
      setCleanBagsCount(full > 0 ? String(full) : '');
      setLooseKg(rem);
    } else {
      setCleanBagsCount('');
      setLooseKg(0);
    }
  };

  const recalcFromBags = (bagsVal, looseVal) => {
    const bags = parseInt(bagsVal, 10);
    const validBags = isNaN(bags) || bags < 0 ? 0 : bags;
    const loose = parseFloat(looseVal);
    const validLoose = isNaN(loose) || loose < 0 ? 0 : loose;

    setCleanBagsCount(validBags > 0 ? String(validBags) : '');
    setLooseKg(validLoose);

    const total = Number(((validBags * effectiveBagSize) + validLoose).toFixed(2));
    setValue('cleanKg', total, { shouldValidate: true });
  };

  const handleCleanKgChange = (rawVal) => {
    const val = parseFloat(rawVal) || 0;
    setLastEditedField('cleanKg');
    if (val > 0 && effectiveBagSize > 0) {
      recalcFromCleanKg(val);
    } else {
      setCleanBagsCount('');
      setLooseKg(0);
    }
  };

 

  const handleBagsChange = (bagsVal, looseVal) => {
    // Allow empty string for clearing
    const validBags = bagsVal === '' ? '' : (parseInt(bagsVal, 10) || 0);
    setCleanBagsCount(String(validBags));
    setLastEditedField('cleanBagsCount');
    recalcFromBags(validBags, looseVal);
  };

  const handleLooseChange = (looseVal, bagsVal) => {
    setLastEditedField('looseKg');
    recalcFromBags(bagsVal, looseVal);
  };

  const handleBagSizeSelect = (newSize) => {
    setSelectedBagSize(newSize);
    const newEffectiveSize = newSize === 'custom' ? parseFloat(customBagSize) || 60 : Number(newSize);

    // Recalculate based on what user last edited
    if (lastEditedField === 'cleanKg') {
      const curClean = Number(watch('cleanKg')) || 0;
      if (curClean > 0 && newEffectiveSize > 0) {
        const full = Math.floor(curClean / newEffectiveSize);
        const rem = Number((curClean - full * newEffectiveSize).toFixed(2));
        setCleanBagsCount(full > 0 ? String(full) : '');
        setLooseKg(rem);
      }
    } else {
      const bags = getCleanBagsNum();
      const loose = Number(looseKg) || 0;
      const total = Number(((bags * newEffectiveSize) + loose).toFixed(2));
      setValue('cleanKg', total, { shouldValidate: true });
    }
  };

  const handleCustomBagSizeChange = (val) => {
    setCustomBagSize(val);
    const newEffectiveSize = parseFloat(val) || 0;
    if (newEffectiveSize <= 0) return;

    if (lastEditedField === 'cleanKg') {
      const curClean = Number(watch('cleanKg')) || 0;
      if (curClean > 0) {
        const full = Math.floor(curClean / newEffectiveSize);
        const rem = Number((curClean - full * newEffectiveSize).toFixed(2));
        setCleanBagsCount(full > 0 ? String(full) : '');
        setLooseKg(rem);
      }
    } else {
      const bags = getCleanBagsNum();
      const loose = Number(looseKg) || 0;
      const total = Number(((bags * newEffectiveSize) + loose).toFixed(2));
      setValue('cleanKg', total, { shouldValidate: true });
    }
  };

  const handleCreateNew = (targetModeOrId = '', explicitCompanyId = '') => {
    setBatchFilterQuery('');
    setAddingOperator(false);
    const now = toLocalNaive(new Date());

    if (targetModeOrId === 'COMPANY' || explicitCompanyId) {
      const compId =
        explicitCompanyId ||
        (targetModeOrId.startsWith('COMPANY:') ? targetModeOrId.replace('COMPANY:', '') : '');
      setCompanyFilter(compId);
      const compBatches = processableEntries.filter((e) => e.companyId === compId);
      const initialKgMap = {};
      let totalAvail = 0;
      compBatches.forEach((e) => {
        const avail = Math.max(0, Number(((e.kg || 0) - (e.kgMoved || 0)).toFixed(2)));
        initialKgMap[e.id] = avail;
        totalAvail += avail;
      });
      setSelectedBatchIds(compBatches.map((e) => e.id));
      setBatchKgMap(initialKgMap);
      reset({
        processDate: pickerValueToIso(now),
        cleanKg: Number(totalAvail.toFixed(2)),
        rejectSortexKg: 0,
        rejectGravityKg: 0,
        rejectSizeKg: 0,
        rejectKg: 0,
        wasteKg: 0,
        line: 'Line 1',
        notes: '',
        operatorId: '',
      });
      setBaggingMode('OPTION_A');
      setSelectedBagSize(60);
      setCustomBagSize(60);
      const { bags, loose } = calcBagsAndLoose(totalAvail, 60);
      setCleanBagsCount(bags > 0 ? String(bags) : '');
      setLooseKg(loose);
    } else if (targetModeOrId === 'ALL') {
      setCompanyFilter('');
      const allIds = processableEntries.map((e) => e.id);
      const initialKgMap = {};
      let totalAvail = 0;
      processableEntries.forEach((e) => {
        const avail = Math.max(0, Number(((e.kg || 0) - (e.kgMoved || 0)).toFixed(2)));
        initialKgMap[e.id] = avail;
        totalAvail += avail;
      });
      setSelectedBatchIds(allIds);
      setBatchKgMap(initialKgMap);
      reset({
        processDate: pickerValueToIso(now),
        cleanKg: Number(totalAvail.toFixed(2)),
        rejectSortexKg: 0,
        rejectGravityKg: 0,
        rejectSizeKg: 0,
        rejectKg: 0,
        wasteKg: 0,
        line: 'Line 1',
        notes: '',
        operatorId: '',
      });
      setBaggingMode('OPTION_A');
      setSelectedBagSize(60);
      setCustomBagSize(60);
      const { bags, loose } = calcBagsAndLoose(totalAvail, 60);
      setCleanBagsCount(bags > 0 ? String(bags) : '');
      setLooseKg(loose);
    } else if (targetModeOrId && targetModeOrId !== 'ALL' && !targetModeOrId.startsWith('COMPANY:')) {
      const target = allEntries.find((e) => e.id === targetModeOrId);
      if (target) {
        setCompanyFilter(target.companyId || '');
        const avail = Math.max(0, Number(((target.kg || 0) - (target.kgMoved || 0)).toFixed(2)));
        setSelectedBatchIds([target.id]);
        setBatchKgMap({ [target.id]: avail });
        reset({
          processDate: pickerValueToIso(now),
          cleanKg: avail,
          rejectSortexKg: 0,
          rejectGravityKg: 0,
          rejectSizeKg: 0,
          rejectKg: 0,
          wasteKg: 0,
          line: 'Line 1',
          notes: '',
          operatorId: '',
        });
        setBaggingMode('OPTION_A');
        setSelectedBagSize(60);
        setCustomBagSize(60);
        const { bags, loose } = calcBagsAndLoose(avail, 60);
        setCleanBagsCount(bags > 0 ? String(bags) : '');
        setLooseKg(loose);
      }
    } else {
      if (summaryBatchId.startsWith('COMPANY:')) {
        const compId = summaryBatchId.replace('COMPANY:', '');
        setCompanyFilter(compId);
        setSelectedBatchIds([]);
        setBatchKgMap({});
      } else if (summaryBatchId !== 'ALL') {
        const target = allEntries.find((e) => e.id === summaryBatchId);
        if (target) {
          setCompanyFilter(target.companyId || '');
          const avail = Math.max(0, Number(((target.kg || 0) - (target.kgMoved || 0)).toFixed(2)));
          setSelectedBatchIds([target.id]);
          setBatchKgMap({ [target.id]: avail });
          reset({
            processDate: pickerValueToIso(now),
            cleanKg: avail,
            rejectSortexKg: 0,
            rejectGravityKg: 0,
            rejectSizeKg: 0,
            rejectKg: 0,
            wasteKg: 0,
            line: 'Line 1',
            notes: '',
            operatorId: '',
          });
          setSelectedBagSize(60);
          setCustomBagSize(60);
          const { bags, loose } = calcBagsAndLoose(avail, 60);
          setCleanBagsCount(bags > 0 ? String(bags) : '');
          setLooseKg(loose);
          setSlideOpen(true);
          return;
        }
      } else {
        setCompanyFilter('');
        setSelectedBatchIds([]);
        setBatchKgMap({});
      }
      reset({
        processDate: pickerValueToIso(now),
        cleanKg: '',
        rejectSortexKg: 0,
        rejectGravityKg: 0,
        rejectSizeKg: 0,
        rejectKg: 0,
        wasteKg: 0,
        line: 'Line 1',
        notes: '',
        operatorId: '',
      });
      setSelectedBagSize(60);
      setCustomBagSize(60);
      setCleanBagsCount('');
      setLooseKg(0);
      setLastEditedField('');
    }
    setSlideOpen(true);
  };

  const toggleBatch = (id) => {
    const entry = allEntries.find((e) => e.id === id);
    if (!entry) return;
    const avail = Math.max(0, Number(((entry.kg || 0) - (entry.kgMoved || 0)).toFixed(2)));

    setSelectedBatchIds((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        return prev.filter((item) => item !== id);
      } else {
        setBatchKgMap((km) => ({
          ...km,
          [id]: km[id] !== undefined && km[id] !== '' ? km[id] : avail,
        }));
        return [...prev, id];
      }
    });
  };

  const handleSelectAllBatches = () => {
    const targetEntries = filteredProcessableEntries.length > 0 ? filteredProcessableEntries : processableEntries;
    const targetIds = targetEntries.map((e) => e.id);
    const newKgMap = { ...batchKgMap };
    targetEntries.forEach((e) => {
      const avail = Math.max(0, Number(((e.kg || 0) - (e.kgMoved || 0)).toFixed(2)));
      if (newKgMap[e.id] === undefined || newKgMap[e.id] === '' || Number(newKgMap[e.id]) <= 0) {
        newKgMap[e.id] = avail;
      }
    });
    setSelectedBatchIds((prev) => [...new Set([...prev, ...targetIds])]);
    setBatchKgMap(newKgMap);
  };

  const handleDeselectAllBatches = () => {
    setSelectedBatchIds([]);
  };

  const handleBatchKgChange = (id, value) => {
    setBatchKgMap((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleBatchKgMax = (id) => {
    const entry = allEntries.find((e) => e.id === id);
    if (!entry) return;
    const avail = Math.max(0, Number(((entry.kg || 0) - (entry.kgMoved || 0)).toFixed(2)));
    setBatchKgMap((prev) => ({
      ...prev,
      [id]: avail,
    }));
  };

  const selectedEntries = useMemo(() => {
    return allEntries.filter((e) => selectedBatchIds.includes(e.id));
  }, [allEntries, selectedBatchIds]);

  const totalSelectedKg = useMemo(() => {
    return Number(
      selectedBatchIds
        .reduce((sum, id) => sum + (Number(batchKgMap[id]) || 0), 0)
        .toFixed(2),
    );
  }, [selectedBatchIds, batchKgMap]);

  const totalAvailableInSelected = useMemo(() => {
    return Number(
      selectedEntries
        .reduce((sum, e) => {
          const avail = Math.max(0, (Number(e.kg) || 0) - (Number(e.kgMoved) || 0));
          return sum + avail;
        }, 0)
        .toFixed(2),
    );
  }, [selectedEntries]);

  const totalWarehouseAvailableKg = useMemo(() => {
    return Number(
      processableEntries
        .reduce((sum, e) => {
          const avail = Math.max(0, (Number(e.kg) || 0) - (Number(e.kgMoved) || 0));
          return sum + avail;
        }, 0)
        .toFixed(2),
    );
  }, [processableEntries]);

  // Validation: Check if any selected batch exceeds available KG or has <= 0 KG
  const batchValidationErrors = useMemo(() => {
    const errorsList = [];
    for (const id of selectedBatchIds) {
      const entry = allEntries.find((e) => e.id === id);
      if (!entry) continue;
      const avail = Math.max(0, Number(((entry.kg || 0) - (entry.kgMoved || 0)).toFixed(2)));
      const entered = Number(batchKgMap[id]) || 0;
      if (entered <= 0) {
        errorsList.push({
          entryId: id,
          batchNo: entry.batchNo,
          msg: `Batch ${entry.batchNo}: Processed KG must be greater than 0`,
        });
      } else if (entered > avail + 0.01) {
        errorsList.push({
          entryId: id,
          batchNo: entry.batchNo,
          msg: `Batch ${entry.batchNo}: Requested ${entered.toLocaleString()} KG exceeds available balance (${avail.toLocaleString()} KG)`,
        });
      }
    }
    return errorsList;
  }, [selectedBatchIds, batchKgMap, allEntries]);

  const hasBatchErrors = batchValidationErrors.length > 0;

  // Real-time Outputs Balance Check
  const wClean = Number(watch('cleanKg')) || 0;
  const wSortex = Number(watch('rejectSortexKg')) || 0;
  const wGravity = Number(watch('rejectGravityKg')) || 0;
  const wSize = Number(watch('rejectSizeKg')) || 0;
  const wReject = Number((wSortex + wGravity + wSize).toFixed(2));
  const wWaste = Number(watch('wasteKg')) || 0;
  const totalOutput = Number((wClean + wReject + wWaste).toFixed(2));
  const unallocatedKg = Number((totalSelectedKg - totalOutput).toFixed(2));

  const isImbalanced = totalSelectedKg > 0 && Math.abs(totalOutput - totalSelectedKg) > 0.01;
  const isBalanced =
    totalSelectedKg > 0 &&
    !isImbalanced &&
    !hasBatchErrors &&
    selectedBatchIds.length > 0;

  const allocateRemainderTo = (field) => {
    if (totalSelectedKg <= 0) return;
    const currentOutputs = {
      cleanKg: wClean,
      rejectSortexKg: wSortex,
      rejectGravityKg: wGravity,
      rejectSizeKg: wSize,
      wasteKg: wWaste,
    };
    const otherSum = Object.entries(currentOutputs)
      .filter(([k]) => k !== field)
      .reduce((sum, [, val]) => sum + val, 0);
    const remainder = Math.max(0, Number((totalSelectedKg - otherSum).toFixed(2)));
    setValue(field, remainder, { shouldValidate: true });

    if (field === 'cleanKg') {
      const { bags, loose } = calcBagsAndLoose(remainder, effectiveBagSize);
      setCleanBagsCount(bags > 0 ? String(bags) : '');
      setLooseKg(loose);
    }
  };

  const handleSet100Clean = () => {
    if (totalSelectedKg <= 0) return;
    setValue('cleanKg', totalSelectedKg, { shouldValidate: true });
    setValue('rejectSortexKg', 0, { shouldValidate: true });
    setValue('rejectGravityKg', 0, { shouldValidate: true });
    setValue('rejectSizeKg', 0, { shouldValidate: true });
    setValue('rejectKg', 0, { shouldValidate: true });
    setValue('wasteKg', 0, { shouldValidate: true });

    const { bags, loose } = calcBagsAndLoose(totalSelectedKg, effectiveBagSize);
    setCleanBagsCount(bags > 0 ? String(bags) : '');
    setLooseKg(loose);
  };

  const onSubmit = (formData) => {
    if (selectedBatchIds.length === 0) return;
    if (hasBatchErrors) return;
    if (isImbalanced) return;

    const entries = selectedBatchIds.map((id) => ({
      entryId: id,
      kgMoved: Number(batchKgMap[id]) || 0,
      bagsMoved: 0,
    }));

    const sortex = Number(formData.rejectSortexKg || 0);
    const gravity = Number(formData.rejectGravityKg || 0);
    const size = Number(formData.rejectSizeKg || 0);
    const totalReject = Number((sortex + gravity + size).toFixed(2));

    createMut.mutate({
      entries,
      processDate: pickerValueToIso(formData.processDate),
      cleanKg: Number(formData.cleanKg || 0),
      rejectSortexKg: sortex,
      rejectGravityKg: gravity,
      rejectSizeKg: size,
      rejectKg: totalReject,
      wasteKg: Number(formData.wasteKg || 0),
      cleanBags: getCleanBagsNum(),
      cleanKgPerBag: effectiveBagSize,
      looseKg: Number(looseKg) || 0,
      rejectBags: 0,
      wasteBags: 0,
      line: formData.line,
      notes: formData.notes,
      operatorId: formData.operatorId || undefined,
    });
  };

  const columns = [
    {
      key: 'batches',
      label: 'Batch No.',
      render: (_, row) => (
        <div style={{ cursor: 'pointer' }}>
          {row.batchNos.map((batchNo, i) => (
            <div key={batchNo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono-link">{batchNo}</span>
              {row.companies[i] && (
                <span style={{ fontSize: 11, color: 'var(--color-tertiary)' }}>
                  ({row.companies[i]})
                </span>
              )}
              {i < row.batchNos.length - 1 && <span style={{ color: 'var(--color-tertiary)' }}> · </span>}
            </div>
          ))}
          {row.isMultiBatch && (
            <div style={{ fontSize: 10.5, color: 'var(--color-secondary)', marginTop: 4, fontWeight: 500 }}>
              {row.batchCount} batches in this session
            </div>
          )}
        </div>
      ),
      exportValue: (row) => row.batchNos.join(', '),
    },
    {
      key: 'processDate',
      label: 'Process Date',
      render: (_, row) => formatEthiopian(new Date(row.processDate), { includeTime: true }),
      exportValue: (row) => formatEthiopian(new Date(row.processDate), { includeTime: true }),
    },
    {
      key: 'totalKgMoved',
      label: 'Processed (KG)',
      align: 'right',
      render: (_, row) => <strong>{Number(row.totalKgMoved || 0).toLocaleString()} KG</strong>,
    },
    {
      key: 'totalCleanKg',
      label: 'Clean Coffee',
      align: 'right',
      render: (_, row) => (
        <div>
          <span className="stock-clean"><strong>{Number(row.totalCleanKg || 0).toLocaleString()} KG</strong></span>
          {row.totalCleanBags > 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-tertiary)', marginTop: 2, fontWeight: 500 }}>
              {row.totalCleanBags.toLocaleString()} bags
            </div>
          )}
        </div>
      ),
      exportValue: (row) =>
        `${Number(row.totalCleanKg || 0).toLocaleString()} KG${row.totalCleanBags ? ` (${row.totalCleanBags} bags)` : ''}`,
    },
    {
      key: 'totalRejectKg',
      label: 'Reject (KG)',
      align: 'right',
      render: (_, row) => {
        const total = Number(row.totalRejectKg || 0);
        const sortex = Number(row.totalRejectSortex || 0);
        const gravity = Number(row.totalRejectGravity || 0);
        const size = Number(row.totalRejectSize || 0);
        const hasBreakdown = sortex > 0 || gravity > 0 || size > 0;

        return (
          <div>
            <span style={{ color: 'var(--color-reject)', fontWeight: 600 }}>
              {total.toLocaleString()} KG
            </span>
            {hasBreakdown && (
              <div style={{ fontSize: 10.5, color: 'var(--color-tertiary)', marginTop: 2 }}>
                {sortex > 0 && <span>S: {sortex.toLocaleString()} </span>}
                {gravity > 0 && <span>G: {gravity.toLocaleString()} </span>}
                {size > 0 && <span>Z: {size.toLocaleString()} </span>}
              </div>
            )}
          </div>
        );
      },
      exportValue: (row) => {
        const total = Number(row.totalRejectKg || 0);
        const sortex = Number(row.totalRejectSortex || 0);
        const gravity = Number(row.totalRejectGravity || 0);
        const size = Number(row.totalRejectSize || 0);
        const parts = [];
        if (sortex > 0) parts.push(`Sortex: ${sortex}kg`);
        if (gravity > 0) parts.push(`Gravity: ${gravity}kg`);
        if (size > 0) parts.push(`Size: ${size}kg`);
        return `${total.toLocaleString()} KG${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
      },
    },
    {
      key: 'totalWasteKg',
      label: 'Waste (KG)',
      align: 'right',
      render: (_, row) => (
        <span style={{ color: 'var(--color-waste)', fontWeight: 600 }}>
          {Number(row.totalWasteKg || 0).toLocaleString()} KG
        </span>
      ),
    },
    { key: 'line', label: 'Line', render: (_, row) => row.line || '—' },
    {
      key: 'operator',
      label: 'Operator',
      render: (_, row) => row.operator?.name || '—',
      exportValue: (row) => row.operator?.name || '',
    },
  ];

  return (
    <div className="proc-page">
      {/* Page Header */}
      <div className="proc-header">
        <div className="proc-title-group">
          <span className="proc-subtitle">MILLING & SORTING</span>
          <h1 className="proc-title">Processing Management</h1>
        </div>
        <div className="proc-header-actions">
          <button
            className="proc-header-btn proc-header-btn--outline"
            onClick={() => exportToExcel(groupedSessions, columns, 'Processing')}
          >
            <FileXls size={18} weight="regular" /> Export Excel
          </button>
          <button
            className="proc-header-btn proc-header-btn--outline"
            onClick={() => exportToPdf(groupedSessions, columns, 'Processing', 'Processing Logs')}
          >
            <FilePdf size={18} weight="regular" /> Export PDF
          </button>
          {canWrite && (
            <button className="proc-header-btn" onClick={() => handleCreateNew()}>
              <Plus size={18} weight="regular" /> Log Processing
            </button>
          )}
        </div>
      </div>

      {/* REQUIREMENT 16: Clear Processing Summary at the top of Processing Page */}
      <section className="proc-summary-card" aria-label="Processing Summary">
        <div className="proc-summary-header">
          <div>
            <span className="proc-summary-eyebrow">LIVE WAREHOUSE BALANCE</span>
            <h2 className="proc-summary-heading">Processing Summary</h2>
          </div>
          <div className="proc-summary-controls">
            <label htmlFor="proc-summary-scope" className="proc-summary-scope-label">
              View Scope:
            </label>
            <select
              id="proc-summary-scope"
              className="proc-summary-select"
              value={summaryBatchId}
              onChange={(e) => setSummaryBatchId(e.target.value)}
            >
              <option value="ALL">All Warehouse Batches ({allEntries.length} batches)</option>
              {sortedCompanies.length > 0 && (
                <optgroup label="Filter by Client">
                  {sortedCompanies.map((c) => {
                    const count = allEntries.filter((e) => e.companyId === c.id).length;
                    if (count === 0) return null;
                    return (
                      <option key={c.id} value={`COMPANY:${c.id}`}>
                        {c.contactPerson || c.name} ({count} {count === 1 ? 'batch' : 'batches'})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              <optgroup label="Individual Batches">
                {allEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.batchNo} — {e.company?.name} ({Number(e.kg || 0).toLocaleString()} KG In)
                  </option>
                ))}
              </optgroup>
            </select>
            {canWrite && summaryBatchId === 'ALL' && summaryStats.remaining > 0 && (
              <button
                type="button"
                className="proc-summary-quick-btn proc-summary-quick-btn--all"
                onClick={() => handleCreateNew('ALL')}
              >
                <Lightning size={16} weight="fill" /> Process All Available Stock ({summaryStats.remaining.toLocaleString()} KG)
              </button>
            )}
            {canWrite && summaryBatchId.startsWith('COMPANY:') && summaryStats.remaining > 0 && (
              <button
                type="button"
                className="proc-summary-quick-btn proc-summary-quick-btn--all"
                onClick={() => handleCreateNew('COMPANY', summaryStats.companyId)}
              >
                <Lightning size={16} weight="fill" /> Process {summaryStats.companyName || 'Company'} Stock ({summaryStats.remaining.toLocaleString()} KG)
              </button>
            )}
            {canWrite && summaryBatchId !== 'ALL' && !summaryBatchId.startsWith('COMPANY:') && summaryStats.remaining > 0 && (
              <button
                type="button"
                className="proc-summary-quick-btn"
                onClick={() => handleCreateNew(summaryBatchId)}
              >
                <Lightning size={16} weight="fill" /> Process Batch
              </button>
            )}
          </div>
        </div>

        <div className="proc-summary-body">
          {/* Left Column: Clear Category | KG Summary Table */}
          <div className="proc-summary-table-wrap">
            <table className="proc-summary-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">KG</th>
                </tr>
              </thead>
              <tbody>
                <tr className="proc-summary-row--in">
                  <td>
                    <span className="proc-dot proc-dot--in" />
                    <strong>Total Coffee In</strong>
                  </td>
                  <td className="text-right font-mono font-bold">
                    {summaryStats.totalIn.toLocaleString()}
                  </td>
                </tr>
                <tr className="proc-summary-row--processed">
                  <td>
                    <span className="proc-dot proc-dot--processed" />
                    <strong>Processed</strong>
                  </td>
                  <td className="text-right font-mono font-bold">
                    {summaryStats.processed.toLocaleString()}
                  </td>
                </tr>
                <tr className="proc-summary-row--remaining">
                  <td>
                    <span className="proc-dot proc-dot--remaining" />
                    <strong>Remaining</strong>
                  </td>
                  <td className="text-right font-mono font-bold">
                    {summaryStats.remaining.toLocaleString()}
                  </td>
                </tr>
                <tr className="proc-summary-row--divider">
                  <td colSpan={2}>Output Breakdown (Equals Processed KG)</td>
                </tr>
                <tr className="proc-summary-row--clean">
                  <td>
                    <span className="proc-dot proc-dot--clean" />
                    Clean
                  </td>
                  <td className="text-right font-mono font-semibold proc-val--clean">
                    {summaryStats.clean.toLocaleString()}
                  </td>
                </tr>
                <tr className="proc-summary-row--reject-sub">
                  <td style={{ paddingLeft: 22, color: 'var(--color-secondary)' }}>
                    Reject (Sortex)
                  </td>
                  <td className="text-right font-mono proc-val--reject-sub">
                    {summaryStats.rejectSortex.toLocaleString()}
                  </td>
                </tr>
                <tr className="proc-summary-row--reject-sub">
                  <td style={{ paddingLeft: 22, color: 'var(--color-secondary)' }}>
                    Reject (Gravity)
                  </td>
                  <td className="text-right font-mono proc-val--reject-sub">
                    {summaryStats.rejectGravity.toLocaleString()}
                  </td>
                </tr>
                <tr className="proc-summary-row--reject-sub">
                  <td style={{ paddingLeft: 22, color: 'var(--color-secondary)' }}>
                    Reject (Size)
                  </td>
                  <td className="text-right font-mono proc-val--reject-sub">
                    {summaryStats.rejectSize.toLocaleString()}
                  </td>
                </tr>
                <tr className="proc-summary-row--reject">
                  <td>
                    <span className="proc-dot proc-dot--reject" />
                    <strong>Total Reject</strong>
                  </td>
                  <td className="text-right font-mono font-semibold proc-val--reject">
                    <strong>{summaryStats.reject.toLocaleString()}</strong>
                  </td>
                </tr>
                <tr className="proc-summary-row--waste">
                  <td>
                    <span className="proc-dot proc-dot--waste" />
                    Waste
                  </td>
                  <td className="text-right font-mono font-semibold proc-val--waste">
                    {summaryStats.waste.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Column: Visual KPI Grid & Progress Breakdown */}
          <div className="proc-summary-visuals">
            <div className="proc-kpi-grid">
              <div className="proc-kpi-box">
                <span className="proc-kpi-label">Total Coffee In</span>
                <span className="proc-kpi-value">{summaryStats.totalIn.toLocaleString()} KG</span>
                <span className="proc-kpi-sub">100% Received Stock</span>
              </div>
              <div className="proc-kpi-box proc-kpi-box--accent">
                <span className="proc-kpi-label">Processed</span>
                <span className="proc-kpi-value">{summaryStats.processed.toLocaleString()} KG</span>
                <span className="proc-kpi-sub">{processedPct.toFixed(1)}% of Total Coffee In</span>
              </div>
              <div className="proc-kpi-box proc-kpi-box--remaining">
                <span className="proc-kpi-label">Remaining</span>
                <span className="proc-kpi-value">{summaryStats.remaining.toLocaleString()} KG</span>
                <span className="proc-kpi-sub">Ready to Process</span>
              </div>
              <div className="proc-kpi-box proc-kpi-box--clean">
                <span className="proc-kpi-label">Clean Output</span>
                <span className="proc-kpi-value">{summaryStats.clean.toLocaleString()} KG</span>
                <span className="proc-kpi-sub">{cleanYieldPct}% Yield</span>
              </div>
              <div className="proc-kpi-box proc-kpi-box--reject">
                <span className="proc-kpi-label">Total Reject Output</span>
                <span className="proc-kpi-value">{summaryStats.reject.toLocaleString()} KG</span>
                <span className="proc-kpi-sub">
                  Sortex: {summaryStats.rejectSortex.toLocaleString()} · Grav: {summaryStats.rejectGravity.toLocaleString()} · Size: {summaryStats.rejectSize.toLocaleString()}
                </span>
              </div>
              <div className="proc-kpi-box proc-kpi-box--waste">
                <span className="proc-kpi-label">Waste Output</span>
                <span className="proc-kpi-value">{summaryStats.waste.toLocaleString()} KG</span>
                <span className="proc-kpi-sub">{wasteYieldPct}% of Processed</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="proc-progress-card">
              <div className="proc-progress-labels">
                <span>
                  Milling Progress: <strong>{processedPct.toFixed(1)}% Complete</strong>
                </span>
                <span>
                  <strong>{summaryStats.remaining.toLocaleString()} KG</strong> Remaining
                </span>
              </div>
              <div className="proc-progress-track">
                <div
                  className="proc-progress-Segment proc-progress-Segment--clean"
                  style={{
                    width: `${
                      summaryStats.totalIn > 0
                        ? (summaryStats.clean / summaryStats.totalIn) * 100
                        : 0
                    }%`,
                  }}
                  title={`Clean: ${summaryStats.clean.toLocaleString()} KG`}
                />
                <div
                  className="proc-progress-Segment proc-progress-Segment--reject"
                  style={{
                    width: `${
                      summaryStats.totalIn > 0
                        ? (summaryStats.reject / summaryStats.totalIn) * 100
                        : 0
                    }%`,
                  }}
                  title={`Reject: ${summaryStats.reject.toLocaleString()} KG`}
                />
                <div
                  className="proc-progress-Segment proc-progress-Segment--waste"
                  style={{
                    width: `${
                      summaryStats.totalIn > 0
                        ? (summaryStats.waste / summaryStats.totalIn) * 100
                        : 0
                    }%`,
                  }}
                  title={`Waste: ${summaryStats.waste.toLocaleString()} KG`}
                />
              </div>
              <div className="proc-progress-legend">
                <span>
                  <i className="proc-dot proc-dot--clean" /> Clean (
                  {summaryStats.clean.toLocaleString()} KG)
                </span>
                <span>
                  <i className="proc-dot proc-dot--reject" /> Reject (
                  {summaryStats.reject.toLocaleString()} KG)
                </span>
                <span>
                  <i className="proc-dot proc-dot--waste" /> Waste (
                  {summaryStats.waste.toLocaleString()} KG)
                </span>
                <span>
                  <i className="proc-dot proc-dot--remaining" /> Remaining (
                  {summaryStats.remaining.toLocaleString()} KG)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search Toolbar */}
      <div className="proc-toolbar">
        <div className="proc-search">
          <MagnifyingGlass size={18} className="proc-search__icon" />
          <input
            type="text"
            placeholder="Search processing logs by batch no..."
            className="proc-search__input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Processing Logs Table */}
      <div className="proc-table-wrap">
        <Table columns={columns} data={paginatedSessions} loading={isLoading} />
        {data && (
          <Pagination
            page={page}
            totalPages={Math.ceil(groupedSessions.length / limit) || 1}
            onPageChange={setPage}
            pageSize={limit}
            onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
            totalItems={groupedSessions.length}
          />
        )}
      </div>

      {/* REQUIREMENT 17: Redesigned Multi-Column Processing Form */}
      <SlideOver
        isOpen={slideOpen}
        onClose={() => setSlideOpen(false)}
        size="lg"
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Funnel size={20} weight="regular" /> Log Processing Session
          </span>
        }
      >
        <form className="slide-form processing-form" onSubmit={handleSubmit(onSubmit)}>
          {createMut.isError && (
            <div className="form-error">
              {createMut.error?.response?.data?.message ||
                'Could not save processing log. Please check the quantities and try again.'}
            </div>
          )}

          {/* Section 1: Multi-Entry Batch Selection */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div>
                <h4 className="form-section-title">1. Available Stock & Batch Selection</h4>
                <span className="proc-section-subtitle">
                  Select individual batches, multiple entries, or all warehouse stock for processing
                </span>
              </div>
              <div className="proc-batch-actions-header">
                <button
                  type="button"
                  className="proc-batch-btn proc-batch-btn--select-all"
                  onClick={handleSelectAllBatches}
                >
                  <Checks size={16} weight="bold" />
                  {selectedCompanyForProc
                    ? `Select All ${selectedCompanyForProc.name} Stock (${totalFilteredAvailableKg.toLocaleString()} KG)`
                    : `Select All Available Stock (${totalWarehouseAvailableKg.toLocaleString()} KG)`}
                </button>
                {selectedBatchIds.length > 0 && (
                  <button
                    type="button"
                    className="proc-batch-btn proc-batch-btn--clear"
                    onClick={handleDeselectAllBatches}
                  >
                    Deselect All
                  </button>
                )}
              </div>
            </div>

            {/* Quick search / filter bar */}
            <div className="proc-batch-filter-row">
              <div className="proc-batch-company-wrap">
                <select
                  className="proc-batch-company-select"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  aria-label="Filter batches by company"
                >
                  <option value="">All Clients</option>
                  {sortedCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="proc-batch-search-wrap">
                <MagnifyingGlass size={16} className="proc-batch-search-icon" />
                <input
                  type="text"
                  placeholder="Filter available batches by batch no, company, grade..."
                  value={batchFilterQuery}
                  onChange={(e) => setBatchFilterQuery(e.target.value)}
                  className="proc-batch-search-input"
                />
              </div>
              <span className="proc-batch-counter">
                Showing {filteredProcessableEntries.length} of {companyFilter ? companyProcessableEntries.length : processableEntries.length} available batches
              </span>
            </div>

            {/* Batch Table with individual selection and per-batch KG */}
            <div className="proc-multi-table-wrap">
              <table className="proc-multi-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredProcessableEntries.length > 0 &&
                          filteredProcessableEntries.every((e) => selectedBatchIds.includes(e.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleSelectAllBatches();
                          } else {
                            handleDeselectAllBatches();
                          }
                        }}
                        title="Select/Deselect All Visible"
                      />
                    </th>
                    <th>Batch & Company</th>
                    <th>Grade</th>
                    <th className="text-right">Available Stock</th>
                    <th style={{ width: 190 }} className="text-right">Process This Batch (KG)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcessableEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center proc-multi-empty">
                        No available coffee stock entries match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredProcessableEntries.map((entry) => {
                      const avail = Math.max(
                        0,
                        Number(((entry.kg || 0) - (entry.kgMoved || 0)).toFixed(2)),
                      );
                      const isSelected = selectedBatchIds.includes(entry.id);
                      const enteredVal = batchKgMap[entry.id] !== undefined ? batchKgMap[entry.id] : avail;
                      const numEntered = Number(enteredVal) || 0;
                      const isRowOver = isSelected && numEntered > avail + 0.01;
                      const isRowZero = isSelected && numEntered <= 0;

                      return (
                        <tr
                          key={entry.id}
                          className={`proc-multi-row ${isSelected ? 'proc-multi-row--selected' : ''} ${isRowOver ? 'proc-multi-row--error' : ''}`}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBatch(entry.id)}
                            />
                          </td>
                          <td onClick={() => toggleBatch(entry.id)} style={{ cursor: 'pointer' }}>
                            <div className="proc-multi-batch-no">{entry.batchNo}</div>
                            <div className="proc-multi-company">{entry.company?.name || '—'}</div>
                          </td>
                          <td onClick={() => toggleBatch(entry.id)} style={{ cursor: 'pointer' }}>
                            <span className="proc-multi-grade">{entry.grade || 'Grade 1'}</span>
                          </td>
                          <td className="text-right font-mono" onClick={() => toggleBatch(entry.id)} style={{ cursor: 'pointer' }}>
                            <strong className="proc-multi-avail">{avail.toLocaleString()} KG</strong>
                          </td>
                          <td className="text-right">
                            {isSelected ? (
                              <div className="proc-row-input-group">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  max={avail}
                                  value={enteredVal}
                                  onChange={(e) => handleBatchKgChange(entry.id, e.target.value)}
                                  className={`proc-row-kg-input ${isRowOver ? 'proc-row-kg-input--err' : ''}`}
                                />
                                <button
                                  type="button"
                                  className="proc-row-max-btn"
                                  onClick={() => handleBatchKgMax(entry.id)}
                                  title={`Set to max available (${avail.toLocaleString()} KG)`}
                                >
                                  Max
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="proc-row-select-prompt"
                                onClick={() => toggleBatch(entry.id)}
                              >
                                + Select
                              </button>
                            )}
                            {isRowOver && (
                              <div className="proc-row-err-hint">
                                Max {avail.toLocaleString()} KG
                              </div>
                            )}
                            {isRowZero && (
                              <div className="proc-row-err-hint">
                                Must be &gt; 0 KG
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Prominent Selected Total KG Summary Card */}
            <div className="proc-multi-summary-banner">
              <div className="proc-multi-banner-grid">
                <div className="proc-multi-banner-item">
                  <span className="proc-multi-banner-label">Selected Batches</span>
                  <div className="proc-multi-banner-val">
                    <strong>{selectedBatchIds.length}</strong>
                    <span className="proc-multi-banner-unit">of {processableEntries.length} batches</span>
                  </div>
                </div>

                <div className="proc-multi-banner-item">
                  <span className="proc-multi-banner-label">Total Available in Selected</span>
                  <div className="proc-multi-banner-val">
                    <strong>{totalAvailableInSelected.toLocaleString()}</strong>
                    <span className="proc-multi-banner-unit">KG</span>
                  </div>
                </div>

                <div className="proc-multi-banner-item proc-multi-banner-item--highlight">
                  <span className="proc-multi-banner-label">TOTAL KG TO PROCESS</span>
                  <div className="proc-multi-banner-val proc-multi-banner-val--hero">
                    <strong>{totalSelectedKg.toLocaleString()}</strong>
                    <span className="proc-multi-banner-unit">KG</span>
                  </div>
                </div>
              </div>

              {selectedBatchIds.length === 0 && (
                <div className="proc-banner-status proc-banner-status--info">
                  <Funnel size={16} weight="bold" />
                  <span>Select one or more batches above, or click <strong>Select All Available Stock</strong> to process all available coffee.</span>
                </div>
              )}

              {hasBatchErrors && (
                <div className="proc-banner-status proc-banner-status--err">
                  <WarningCircle size={16} weight="fill" />
                  <span>{batchValidationErrors[0].msg}</span>
                </div>
              )}

              {selectedBatchIds.length > 0 && !hasBatchErrors && (
                <div className="proc-banner-status proc-banner-status--ok">
                  <CheckCircle size={16} weight="fill" />
                  <span>
                    Ready to process <strong>{totalSelectedKg.toLocaleString()} KG</strong> from{' '}
                    <strong>{selectedBatchIds.length}</strong> selected {selectedBatchIds.length === 1 ? 'batch' : 'batches'}.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Quantities & Real-time Balance */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div>
                <h4 className="form-section-title">2. Processing Yield Outputs (KG)</h4>
                <span className="proc-section-subtitle">
                  Outputs must equal the total processed coffee ({totalSelectedKg.toLocaleString()} KG)
                </span>
              </div>
              {totalSelectedKg > 0 && (
                <button
                  type="button"
                  className="proc-inline-action-btn"
                  onClick={handleSet100Clean}
                >
                  Set 100% to Clean ({totalSelectedKg.toLocaleString()} KG)
                </button>
              )}
            </div>

            <div className="form-row">
              <div>
                <label className="proc-field-label" style={{ marginBottom: 6, display: 'block' }}>
                  Total Coffee Processed This Session (KG)
                </label>
                <div className="proc-total-display-box">
                  <Scales size={20} weight="regular" />
                  <span className="proc-total-display-val">
                    {totalSelectedKg.toLocaleString()} KG
                  </span>
                  <span className="proc-total-display-sub">
                    ({selectedBatchIds.length} {selectedBatchIds.length === 1 ? 'batch' : 'batches'} selected)
                  </span>
                </div>
              </div>

              <div className="proc-balance-status-box">
                <span className="proc-balance-status-label">Real-Time Output Balance Check</span>
                {totalSelectedKg <= 0 ? (
                  <span className="proc-balance-status-idle">
                    Select batches above to compute outputs balance
                  </span>
                ) : isBalanced ? (
                  <span className="proc-balance-status-ok">
                    <CheckCircle size={18} weight="fill" /> Balanced: Clean ({wClean.toLocaleString()}
                    ) + Reject ({wReject.toLocaleString()}) + Waste ({wWaste.toLocaleString()}) ={' '}
                    {totalSelectedKg.toLocaleString()} KG
                  </span>
                ) : (
                  <span className="proc-balance-status-err">
                    <WarningCircle size={18} weight="fill" /> Outputs total{' '}
                    <strong>{totalOutput.toLocaleString()} KG</strong> (must equal{' '}
                    <strong>{totalSelectedKg.toLocaleString()} KG</strong>).{' '}
                    {unallocatedKg > 0
                      ? `${unallocatedKg.toLocaleString()} KG left to assign.`
                      : `Over-assigned by ${Math.abs(unallocatedKg).toLocaleString()} KG.`}
                  </span>
                )}
              </div>
            </div>

            {/* Clean Coffee & Bagging Conversion Card - Unified Bidirectional Calculator */}
            <div className="proc-clean-bag-card">
              <div className="proc-clean-bag-header">
                <div className="proc-clean-bag-title">
                  <Package size={18} weight="bold" />
                  <span>Clean Coffee & Bagging Conversion</span>
                </div>
              </div>

              <div className="proc-mode-desc">
                <span>
                  <strong>Bidirectional Calculator:</strong> Enter Clean Coffee (KG) to auto-calculate Bags & Loose, OR enter Bags + Loose KG to auto-calculate total Clean Coffee KG. Both methods work simultaneously.
                </span>
              </div>

              {/* Bag Size Presets & Custom Configuration */}
              <div className="proc-bag-size-section">
                <div className="proc-field-top">
                  <label className="proc-field-label">Bag Size Specification</label>
                  <span className="proc-bag-active-label">
                    Active Size: <strong>{effectiveBagSize} KG / bag</strong>
                  </span>
                </div>
                <div className="proc-bag-chips-row">
                  {[50, 60, 85, 86, 100].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`proc-bag-chip ${selectedBagSize === size ? 'proc-bag-chip--active' : ''}`}
                      onClick={() => handleBagSizeSelect(size)}
                    >
                      {size} KG {size === 60 ? '(Export)' : size === 85 ? '(Domestic)' : ''}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`proc-bag-chip ${selectedBagSize === 'custom' ? 'proc-bag-chip--active' : ''}`}
                    onClick={() => handleBagSizeSelect('custom')}
                  >
                    Other / Custom Size
                  </button>

                  {selectedBagSize === 'custom' && (
                    <div className="proc-custom-bag-field">
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        placeholder="KG"
                        value={customBagSize}
                        onChange={(e) => handleCustomBagSizeChange(e.target.value)}
                        className="proc-custom-bag-input"
                      />
                      <span className="proc-custom-bag-unit">KG/bag</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Unified Input Grid - All fields editable, bidirectional calculation */}
              <div className="proc-bag-inputs-grid proc-unified-grid">
                {/* 1. Clean Coffee (KG) - Primary input */}
                <div className="proc-input-field proc-field--primary">
                  <div className="proc-field-top">
                    <label className="proc-field-label">
                      Clean Coffee (KG) <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    {totalSelectedKg > 0 && unallocatedKg !== 0 && (
                      <button
                        type="button"
                        className="proc-fill-btn"
                        onClick={() => allocateRemainderTo('cleanKg')}
                      >
                        Fill Remainder ({unallocatedKg > 0 ? `+${unallocatedKg.toLocaleString()} KG` : `${unallocatedKg.toLocaleString()} KG`})
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    error={errors.cleanKg?.message}
                    {...register('cleanKg', {
                      onChange: (e) => handleCleanKgChange(e.target.value),
                    })}
                  />
                </div>

                {/* 2. Number of Full Bags */}
                <div className="proc-input-field">
                  <div className="proc-field-top">
                    <label className="proc-field-label">
                      Full Bags ({effectiveBagSize} KG each)
                    </label>
                    <span className="proc-auto-badge">Auto / Manual</span>
                  </div>
                  <div className="proc-bags-display-group">
                    <input
                      type="number"
                      min="0"
                      className="proc-bags-input"
                      value={cleanBagsCount}
                      onChange={(e) => handleBagsChange(e.target.value, looseKg)}
                    />
                    <span className="proc-bags-unit">Bags</span>
                  </div>
                </div>

                {/* 3. Loose / Partial Bag (KG) */}
                <div className="proc-input-field">
                  <div className="proc-field-top">
                    <label className="proc-field-label">Loose / Unbagged Coffee (KG)</label>
                    <span className="proc-loose-optional">Optional</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="proc-bags-input-boxed"
                    value={looseKg}
                    onChange={(e) => handleLooseChange(e.target.value, cleanBagsCount)}
                  />
                </div>

                {/* 4. Left / Remaining to Assign */}
                <div className="proc-input-field proc-field--left">
                  <div className="proc-field-top">
                    <label className="proc-field-label">Left / Unassigned (KG)</label>
                    <span className="proc-left-badge">Remaining</span>
                  </div>
                  <div className="proc-left-display-box">
                    <span className="font-mono">{Math.max(0, Number(unallocatedKg || 0)).toLocaleString()} KG</span>
                  </div>
                </div>
              </div>

              {/* Requirement: Clear Visual Relationship: Bag Size × Number of Bags = Total KG */}
              <div className="proc-bag-relationship-box" aria-label="Conversion Breakdown">
                <div className="proc-relationship-title-row">
                  <div className="proc-relationship-title">
                    <Calculator size={15} weight="bold" />
                    <span>CONVERSION FORMULA BREAKDOWN</span>
                  </div>
                  <span className="proc-relationship-tag">Bag Size × Number of Bags = Total KG</span>
                </div>

                <div className="proc-relationship-equation">
                  <div className="proc-eq-card">
                    <span className="proc-eq-card__label">Bag Size</span>
                    <span className="proc-eq-card__val font-mono">{effectiveBagSize} KG</span>
                    <span className="proc-eq-card__sub">{selectedBagSize === 'custom' ? 'Custom weight' : 'Standard'}</span>
                  </div>

                  <span className="proc-eq-math-op">×</span>

                  <div className="proc-eq-card">
                    <span className="proc-eq-card__label">Number of Bags</span>
                    <span className="proc-eq-card__val font-mono">{getCleanBagsNum().toLocaleString()}</span>
                    <span className="proc-eq-card__sub">Bags packed</span>
                  </div>

                  <span className="proc-eq-math-op">=</span>

                  <div className="proc-eq-card proc-eq-card--bagged">
                    <span className="proc-eq-card__label">Bagged Weight</span>
                    <span className="proc-eq-card__val font-mono">
                      {(getCleanBagsNum() * effectiveBagSize).toLocaleString()} KG
                    </span>
                    <span className="proc-eq-card__sub">{getCleanBagsNum()} × {effectiveBagSize} KG</span>
                  </div>

                  {Number(looseKg) > 0 && (
                    <>
                      <span className="proc-eq-math-op">+</span>

                      <div className="proc-eq-card proc-eq-card--loose">
                        <span className="proc-eq-card__label">Loose Remainder</span>
                        <span className="proc-eq-card__val font-mono">
                          {Number(looseKg).toLocaleString()} KG
                        </span>
                        <span className="proc-eq-card__sub">Unbagged</span>
                      </div>

                      <span className="proc-eq-math-op">=</span>

                      <div className="proc-eq-card proc-eq-card--hero">
                        <span className="proc-eq-card__label">Total Clean Coffee</span>
                        <span className="proc-eq-card__val font-mono">
                          {(Number(wClean) || 0).toLocaleString()} KG
                        </span>
                        <span className="proc-eq-card__sub">Total output</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Reject Classification (Sortex, Gravity, Size) */}
            <div className="proc-reject-section" aria-label="Reject Classification">
              <div className="proc-reject-header">
                <div>
                  <div className="proc-reject-title">
                    <WarningCircle size={16} weight="bold" />
                    <span>Reject Classification (Sortex, Gravity, Size)</span>
                  </div>
                  <span className="proc-reject-subtitle">
                    Enter individual reject weights by machine/grading stage — system calculates Total Reject automatically
                  </span>
                </div>
                <div className="proc-reject-total-badge">
                  <span>Total Reject:</span>
                  <strong>{wReject.toLocaleString()} KG</strong>
                </div>
              </div>

              <div className="proc-reject-grid">
                <div>
                  <div className="proc-field-top">
                    <label className="proc-field-label">Reject (Sortex) (KG)</label>
                    {totalSelectedKg > 0 && unallocatedKg !== 0 && (
                      <button
                        type="button"
                        className="proc-fill-btn"
                        onClick={() => allocateRemainderTo('rejectSortexKg')}
                      >
                        Fill Remainder
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    error={errors.rejectSortexKg?.message}
                    {...register('rejectSortexKg')}
                  />
                </div>

                <div>
                  <div className="proc-field-top">
                    <label className="proc-field-label">Reject (Gravity) (KG)</label>
                    {totalSelectedKg > 0 && unallocatedKg !== 0 && (
                      <button
                        type="button"
                        className="proc-fill-btn"
                        onClick={() => allocateRemainderTo('rejectGravityKg')}
                      >
                        Fill Remainder
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    error={errors.rejectGravityKg?.message}
                    {...register('rejectGravityKg')}
                  />
                </div>

                <div>
                  <div className="proc-field-top">
                    <label className="proc-field-label">Reject (Size) (KG)</label>
                    {totalSelectedKg > 0 && unallocatedKg !== 0 && (
                      <button
                        type="button"
                        className="proc-fill-btn"
                        onClick={() => allocateRemainderTo('rejectSizeKg')}
                      >
                        Fill Remainder
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    error={errors.rejectSizeKg?.message}
                    {...register('rejectSizeKg')}
                  />
                </div>
              </div>

              {/* Requirement: Automatically calculate & clearly display:
                  Total Reject = Reject (Sortex) + Reject (Gravity) + Reject (Size) */}
              <div className="proc-reject-summary-card">
                <div className="proc-reject-formula-row">
                  <span className="proc-reject-formula-item">
                    Reject (Sortex): <strong>{wSortex.toLocaleString()} KG</strong>
                  </span>
                  <span>+</span>
                  <span className="proc-reject-formula-item">
                    Reject (Gravity): <strong>{wGravity.toLocaleString()} KG</strong>
                  </span>
                  <span>+</span>
                  <span className="proc-reject-formula-item">
                    Reject (Size): <strong>{wSize.toLocaleString()} KG</strong>
                  </span>
                  <span>=</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-reject)' }}>
                    Total Reject: <strong>{wReject.toLocaleString()} KG</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Waste Output */}
            <div style={{ marginTop: 14 }}>
              <div className="proc-field-top">
                <label className="proc-field-label">Waste / Dust (KG)</label>
                {totalSelectedKg > 0 && unallocatedKg !== 0 && (
                  <button
                    type="button"
                    className="proc-fill-btn"
                    onClick={() => allocateRemainderTo('wasteKg')}
                  >
                    Fill Remainder
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                error={errors.wasteKg?.message}
                {...register('wasteKg')}
              />
            </div>
          </div>

          {/* Section 3: Line & Operator Details */}
          <div className="form-section-card">
            <div className="form-section-header">
              <h4 className="form-section-title">3. Session Details & Operator</h4>
            </div>

            <div className="form-row">
              <div>
                <EthiopianDatePicker
                  label="Process Date & Time"
                  showTime
                  required
                  error={errors.processDate?.message}
                  {...register('processDate')}
                  value={watch('processDate')}
                  onChange={(v) =>
                    setValue('processDate', v, { shouldDirty: true, shouldValidate: true })
                  }
                />
              </div>
              <div>
                <Input
                  label="Processing Line"
                  placeholder="e.g. Line 1"
                  error={errors.line?.message}
                  {...register('line')}
                />
                <div className="proc-quick-chips">
                  {['Line 1', 'Line 2', 'Color Sorter', 'Gravity Table'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`proc-chip ${watch('line') === preset ? 'proc-chip--active' : ''}`}
                      onClick={() => setValue('line', preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Operator"
                      error={errors.operatorId?.message}
                      {...register('operatorId')}
                    >
                      <option value="">-- Current Logged-in User --</option>
                      {sortedUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddingOperator(!addingOperator)}
                  >
                    {addingOperator ? 'Cancel' : '+ New'}
                  </Button>
                </div>
              </div>
              <div>
                <Input
                  label="Session Notes (Optional)"
                  placeholder="Optional remarks about screen size, moisture, or sorting quality..."
                  error={errors.notes?.message}
                  {...register('notes')}
                />
              </div>
            </div>

            {addingOperator && (
              <div className="proc-quick-add-box">
                <div className="proc-quick-add-title">Quick Add Operator</div>
                <div className="form-row--3">
                  <Input
                    placeholder="Full Name *"
                    value={opName}
                    onChange={(e) => setOpName(e.target.value)}
                  />
                  <Input
                    placeholder="Email Address *"
                    type="email"
                    value={opEmail}
                    onChange={(e) => setOpEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Password (min 6 chars) *"
                    type="password"
                    value={opPassword}
                    onChange={(e) => setOpPassword(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button
                    type="button"
                    loading={createOpMut.isPending}
                    disabled={!opName || !opEmail || opPassword.length < 6}
                    onClick={() =>
                      createOpMut.mutate({
                        name: opName,
                        email: opEmail,
                        password: opPassword,
                        role: 'VIEWER',
                      })
                    }
                  >
                    Save & Select Operator
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setSlideOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={createMut.isPending}
              disabled={selectedBatchIds.length === 0 || totalSelectedKg <= 0 || hasBatchErrors || isImbalanced}
            >
              {totalSelectedKg > 0
                ? `Process ${totalSelectedKg.toLocaleString()} KG (${selectedBatchIds.length} ${selectedBatchIds.length === 1 ? 'Batch' : 'Batches'})`
                : 'Save Processing Log'}
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}

/**
 * The dispatchable fractions of a batch, and how much of each is left.
 *
 * The backend sends `stockByType` on every entry so this file never has to
 * re-derive the arithmetic that the service validates against. The fallback in
 * `stockSlice` exists only so a cached response from before that field existed
 * still renders something sensible rather than crashing.
 */

export const STOCK_TYPES = [
  { value: 'CLEAN', label: 'Clean Coffee', short: 'Clean' },
  { value: 'UNPROCESSED_REJECT', label: 'Unprocessed Reject', short: 'Reject' },
  { value: 'WASTE', label: 'Waste / Dust', short: 'Waste' },
  { value: 'UNPROCESSED', label: 'Unprocessed', short: 'Unprocessed' },
];

export const STOCK_TYPE_VALUES = STOCK_TYPES.map((t) => t.value);

const emptySlice = (type) => ({
  type,
  kg: 0,
  bags: 0,
  dispatchedKg: 0,
  dispatchedBags: 0,
  availableKg: 0,
  availableBags: 0,
  kgPerBag: null,
  bagsTracked: false,
});

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Mirrors backend stockByType() for payloads that predate that field. */
function computeSlice(entry, type) {
  const kg = num(entry.kg);
  const kgMoved = num(entry.kgMoved);
  const base = {
    CLEAN: { kg: num(entry.cleanKg), bags: num(entry.cleanBags), dKg: num(entry.cleanDispatchedKg), dBags: num(entry.cleanDispatchedBags) },
    UNPROCESSED_REJECT: { kg: num(entry.rejectKg), bags: num(entry.rejectBags), dKg: num(entry.rejectDispatchedKg), dBags: num(entry.rejectDispatchedBags) },
    WASTE: { kg: num(entry.wasteKg), bags: num(entry.wasteBags), dKg: num(entry.wasteDispatchedKg), dBags: num(entry.wasteDispatchedBags) },
    UNPROCESSED: { kg: Math.max(0, kg - kgMoved), bags: Math.max(0, num(entry.bags) - num(entry.bagsMoved)), dKg: num(entry.unprocessedDispatchedKg), dBags: num(entry.unprocessedDispatchedBags) },
  }[type];

  if (!base) return emptySlice(type);
  /*
   * Only clean carries a bag count that processing recorded, so only clean
   * derives a ratio or pre-fills a bag figure.
   *
   * This is stated per fraction rather than read off `bags > 0`, which used to
   * mark unprocessed as tracked whenever the leftover was positive. Those bags
   * are the intake count minus what processing has consumed; they are not a
   * count of the unprocessed fraction and they shrink as processing runs, so a
   * ratio taken from them moved on its own. See the backend for the same rule.
   */
  const tracked = type === 'CLEAN' && base.bags > 0;
  return {
    type,
    kg: base.kg,
    bags: base.bags,
    dispatchedKg: base.dKg,
    dispatchedBags: base.dBags,
    availableKg: Math.max(0, Number((base.kg - base.dKg).toFixed(2))),
    availableBags: Math.max(0, base.bags - base.dBags),
    kgPerBag: tracked ? Number((base.kg / base.bags).toFixed(2)) : null,
    bagsTracked: tracked,
  };
}

export function stockSlice(entry, type) {
  const fromApi = entry?.stockByType?.[type];
  return fromApi ? fromApi : entry ? computeSlice(entry, type) : emptySlice(type);
}

export function stockForEntry(entry) {
  return STOCK_TYPES.map((t) => ({ ...t, ...stockSlice(entry, t.value) }));
}

/** Total weight still dispatchable across every fraction of this batch. */
export function totalAvailableKg(entry) {
  return Number(
    STOCK_TYPES.reduce((sum, t) => sum + stockSlice(entry, t.value).availableKg, 0).toFixed(2),
  );
}

export function hasAnyStock(entry) {
  return STOCK_TYPES.some((t) => stockSlice(entry, t.value).availableKg > 0.01);
}
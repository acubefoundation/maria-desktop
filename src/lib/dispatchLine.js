/**
 * The arithmetic behind a dispatch line.
 *
 * A line's three fields describe one quantity: kg = bags x kg/bag. Two of them
 * therefore determine the third, and this module owns that resolution so the
 * component does not have to. Kept free of React and of stock types so it can
 * be reasoned about — and tested — on its own.
 */

/**
 * How many bags `kg` makes at `kgPerBag`, rounded down.
 *
 * Floored rather than rounded: a partial bag is not a bag, and the leftover
 * weight is a loose remainder rather than a mistake.
 */
export function bagsFor(kg, kgPerBag) {
  const weight = Number(kg) || 0;
  const per = Number(kgPerBag) || 0;
  if (weight <= 0 || per <= 0) return 0;
  return Math.floor(weight / per);
}

/**
 * The per-bag figure in force for a line.
 *
 * The line's own value wins whenever it has one, because that is what the
 * editing relation recalculates. The batch record is only a seed: reading it
 * directly would ignore everything the user typed and every derived value.
 */
export function perBagFor(line, derivedPerBag) {
  const own = Number(line?.bagSize) || 0;
  if (own > 0) return own;
  return Number(derivedPerBag) || 0;
}

/**
 * Weight implied by a bag count, or null when there is nothing to compare.
 *
 * A mismatch is reported, never blocked: existing batches legitimately carry
 * different per-bag figures for different fractions.
 */
export function bagConsistency(line, derivedPerBag) {
  const bags = Number(line.bags) || 0;
  const perBag = perBagFor(line, derivedPerBag);
  if (bags <= 0 || perBag <= 0) return null;
  const implied = Number((bags * perBag).toFixed(2));
  const kg = Number(line.kg) || 0;
  if (kg <= 0) return null;
  // A bag count is floored, so up to one bag of loose weight is expected and is
  // not a mistake. Anything beyond that says the three fields disagree.
  if (Math.abs(implied - kg) <= perBag) return null;
  return { impliedKg: implied, perBag };
}

/**
 * Applies an edit to one field and derives the other two.
 *
 * `changed` is 'kg' | 'bags' | 'bagSize' and decides which value gives way:
 * editing the bag size moves the bag count, while editing either the weight or
 * the count moves the per-bag figure. Without that distinction a keystroke in
 * any one field would silently overwrite the other two.
 *
 * `derivedPerBag` is the batch's recorded ratio. It only fills a gap — a figure
 * the user typed is never replaced by it.
 */
export function syncDispatchLine(line, changed, value, derivedPerBag = 0) {
  const edited = { ...line, [changed]: value };

  const kg = Number(edited.kg) || 0;
  const bags = Number(edited.bags) || 0;
  const typed = Number(edited.bagSize) || 0;
  const bagSize =
    changed === 'bagSize' ? Number(value) || 0 : typed || Number(derivedPerBag) || 0;

  if (changed === 'bagSize') {
    if (bagSize > 0) edited.bags = String(bagsFor(kg, bagSize));
    // A zero or cleared bag size cannot re-count, so leave the count alone.
    return edited;
  }

  // Weight or count edited: the per-bag figure follows those two. With no count
  // there is nothing to divide by, so keep whatever was already there.
  if (bags > 0 && kg > 0) edited.bagSize = String(Number((kg / bags).toFixed(2)));
  return edited;
}
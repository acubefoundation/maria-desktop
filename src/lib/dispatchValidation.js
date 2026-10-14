/**
 * Per-line checks for the dispatch form, split by how badly they should be
 * taken.
 *
 * An error is a line that cannot be recorded as typed. A warning is a line that
 * asks for more than the batch has on record, which is allowed: recorded totals
 * drift from what is physically in the warehouse, and a dispatch is frequently
 * the only record that corrects them, so blocking the entry would leave the
 * discrepancy nowhere to go. Anything derived here must stay in step with
 * outings.service.ts, which no longer refuses an overdraw either.
 *
 * The split is by figure, not by severity. Weight over the recorded balance is
 * still an error, because weight is what the counters and every report are
 * measured in and an inflated one corrupts them all. A bag count over the
 * recorded one is only a warning: bags are advisory on reject, waste and
 * unprocessed, absent entirely for those fractions, and typed by hand at
 * dispatch, so
 * they are routinely out of step with the weight they sit beside.
 */

import { STOCK_TYPES, stockSlice } from './stockTypes';

const labelFor = (type) => STOCK_TYPES.find((t) => t.value === type)?.label || type;

/**
 * @param {object} params
 * @param {string[]} params.selectedBatchIds batches currently picked
 * @param {Record<string, Array<{type: string, kg: string|number, bags: string|number}>>} params.linesMap
 * @param {Array<{id: string, batchNo: string}>} params.entries every batch of the chosen company
 * @returns {{errors: Array<object>, warnings: Array<object>}}
 */
export function validateDispatch({ selectedBatchIds, linesMap, entries }) {
  const errors = [];
  const warnings = [];

  for (const entryId of selectedBatchIds) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) continue;
    const lines = linesMap[entryId] || [];

    if (lines.length === 0) {
      errors.push({
        entryId,
        batchNo: entry.batchNo,
        msg: `Batch ${entry.batchNo}: pick at least one coffee type to dispatch`,
      });
      continue;
    }

    for (const line of lines) {
      const slice = stockSlice(entry, line.type);
      const label = labelFor(line.type);
      const kg = Number(line.kg) || 0;

      if (kg <= 0) {
        errors.push({
          entryId,
          batchNo: entry.batchNo,
          msg: `Batch ${entry.batchNo} — ${label}: dispatch weight must be greater than 0 KG`,
        });
      } else if (kg > slice.availableKg + 0.01) {
        errors.push({
          entryId,
          batchNo: entry.batchNo,
          msg: `Batch ${entry.batchNo} — ${label}: requested ${kg.toLocaleString()} KG exceeds the ${slice.availableKg.toLocaleString()} KG available`,
        });
      }

      const bags = Number(line.bags) || 0;
      if (line.bags === '' || line.bags === null || line.bags === undefined) {
        // Number('') is 0, which would otherwise pass every numeric check below
        // and dispatch a line recorded as carrying no bags at all.
        errors.push({
          entryId,
          batchNo: entry.batchNo,
          msg: `Batch ${entry.batchNo} — ${label}: bag count is required`,
        });
      } else if (bags < 0 || !Number.isInteger(bags)) {
        errors.push({
          entryId,
          batchNo: entry.batchNo,
          msg: `Batch ${entry.batchNo} — ${label}: bags must be a whole number`,
        });
      } else if (slice.bagsTracked && bags > slice.availableBags) {
        warnings.push({
          entryId,
          batchNo: entry.batchNo,
          msg: `Batch ${entry.batchNo} — ${label}: requesting ${bags} bags against ${slice.availableBags} on record. You can still dispatch.`,
        });
      }
    }
  }

  return { errors, warnings };
}

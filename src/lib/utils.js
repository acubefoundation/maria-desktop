import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Sorts an array of items alphabetically by name or specified property key.
 * If the items are strings, sorts them directly.
 * Uses case-insensitive locale comparison with numeric awareness.
 */
export function sortByName(items, key = 'name') {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const valA = (typeof a === 'string' ? a : a?.[key] || '')?.toString().trim();
    const valB = (typeof b === 'string' ? b : b?.[key] || '')?.toString().trim();
    return valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
  });
}

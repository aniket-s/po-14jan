import type { FieldRule } from './types';

export interface FieldValidation {
  error?: string;
  warning?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date in YYYY-MM-DD form. */
export const isValidIsoDate = (v: string): boolean => {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Validate a single value against its field rule. Empty + optional = ok. */
export function validateValue(rule: FieldRule, raw: string): FieldValidation {
  const value = (raw ?? '').trim();

  if (value === '') {
    return rule.required ? { error: 'Required' } : {};
  }

  switch (rule.type) {
    case 'integer': {
      if (!/^-?\d+$/.test(value)) return { error: 'Must be a whole number' };
      const n = parseInt(value, 10);
      if (rule.min !== undefined && n < rule.min) return { error: `Must be ≥ ${rule.min}` };
      if (rule.max !== undefined && n > rule.max) return { error: `Must be ≤ ${rule.max.toLocaleString()}` };
      return {};
    }
    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(value)) return { error: 'Must be a number' };
      const n = parseFloat(value);
      if (Number.isNaN(n)) return { error: 'Must be a number' };
      if (rule.decimals !== undefined) {
        const dot = value.indexOf('.');
        if (dot >= 0 && value.length - dot - 1 > rule.decimals) {
          return { error: `Max ${rule.decimals} decimal places` };
        }
      }
      if (rule.min !== undefined && n < rule.min) return { error: `Must be ≥ ${rule.min}` };
      if (rule.max !== undefined && n > rule.max) return { error: `Must be ≤ ${rule.max.toLocaleString()}` };
      if (rule.warn_zero && n === 0) return { warning: 'Price is 0' };
      return {};
    }
    case 'date':
      return isValidIsoDate(value) ? {} : { error: 'Not a valid date' };
    case 'enum':
      return rule.enum && !rule.enum.includes(value)
        ? { error: `Must be one of ${rule.enum.join(', ')}` }
        : {};
    default: // string | text
      if (rule.max_length !== undefined && value.length > rule.max_length) {
        return { error: `Too long (max ${rule.max_length})` };
      }
      return {};
  }
}

/** Per-size cells: optional non-negative whole numbers. */
export function validateSizeValue(raw: string): FieldValidation {
  const v = (raw ?? '').trim();
  if (v === '') return {};
  if (!/^\d+$/.test(v)) return { error: 'Whole number' };
  return {};
}

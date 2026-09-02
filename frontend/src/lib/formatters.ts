/**
 * Institutional Indian Currency & Statistical Number Formatters
 * Adheres strictly to Indian numbering system (e.g. ₹7,420, ₹1.24 lakh)
 * Tabular, unambiguous notation for MoSPI and RBI economists.
 */

export function formatINR(val: number, options?: { compact?: boolean }): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';

  if (options?.compact && Math.abs(val) >= 100000) {
    const inLakhs = val / 100000;
    return '₹' + inLakhs.toFixed(2) + ' L';
  }

  // Exact Indian grouping
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatPercent(val: number, options?: { includeSign?: boolean; decimals?: number }): string {
  if (val === undefined || val === null || isNaN(val)) return '0.00%';
  const decimals = options?.decimals ?? 2;
  const sign = options?.includeSign && val > 0 ? '+' : '';
  return sign + val.toFixed(decimals) + '%';
}

export function formatIndex(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '100.00';
  // Official APIx does not prepend currency symbols
  return val.toFixed(2);
}

export function formatISTDate(isoOrDate: string | Date): string {
  try {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(d) + ' IST';
  } catch {
    return String(isoOrDate);
  }
}

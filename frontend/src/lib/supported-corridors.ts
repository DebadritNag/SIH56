// UI selection list; backend collection policy remains authoritative.
export const SUPPORTED_CORRIDORS = [
  { id: 'DEL-BOM', origin: 'DEL', destination: 'BOM', label: 'DEL → BOM (Delhi - Mumbai)' },
  { id: 'DEL-CCU', origin: 'DEL', destination: 'CCU', label: 'DEL → CCU (Delhi - Kolkata)' },
  { id: 'BOM-BLR', origin: 'BOM', destination: 'BLR', label: 'BOM → BLR (Mumbai - Bengaluru)' },
];
export const DEFAULT_CORRIDOR = 'DEL-BOM';
export function supportedCorridor(value: string | null): string {
  return SUPPORTED_CORRIDORS.some(c => c.id === value) ? value! : DEFAULT_CORRIDOR;
}

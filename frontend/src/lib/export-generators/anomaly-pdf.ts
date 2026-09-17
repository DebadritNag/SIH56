import type { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportJob } from '@/types';

export function safeText(value: unknown, fallback = '-'): string {
  if (value == null || typeof value === 'object') return fallback;
  return String(value).replace(/₹/g, 'INR ').replace(/→/g, '->').replace(/—/g, '-');
}

function finite(value: unknown): number | null {
  if (value == null || value === '' || !['number', 'string'].includes(typeof value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatPdfFare(value: unknown): string {
  const number = finite(value);
  return number == null || number <= 0 ? 'Unavailable' : `INR ${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatPdfPercent(value: unknown): string {
  const number = finite(value);
  return number == null ? '-' : `${number > 0 ? '+' : ''}${number.toFixed(1)}%`;
}

export function renderObservedAnomalies(doc: jsPDF, job: ExportJob): void {
  const rows = Array.isArray(job.parameters?.anomaly_rows) ? job.parameters.anomaly_rows : [];
  if (!rows.length) throw new Error('No anomalies available to export.');
  let stage = 'layout';
  try {
    // All geometry comes from the PDF page, never DOM measurements or row values.
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    if (!Number.isFinite(width) || width <= 28 || !Number.isFinite(height) || height <= 40) {
      throw new Error('Invalid numeric field: page dimensions');
    }
    const body = rows.map(row => [
      safeText(row.severity), safeText(row.code), safeText(row.route), safeText(row.booking_window),
      safeText(row.airline), safeText(row.evidence?.flight_number), formatPdfFare(row.actual_fare),
      formatPdfFare(row.expected_fare), formatPdfPercent(row.deviation_pct),
      formatPdfPercent(row.percentile).replace(/^\+/, ''), safeText(row.status), safeText(row.source),
    ]);
    stage = 'header';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(16, 24, 40);
    doc.text('AirPulse Anomaly Center', 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const mode = typeof job.parameters?.anomaly_data_context === 'string' ? safeText(job.parameters.anomaly_data_context) : job.parameters?.data_mode === 'mock' ? 'DEMO / SYNTHETIC'
      : job.data_origin === 'LIVE' ? 'LIVE' : job.data_origin === 'IMPORTED' ? 'IMPORTED' : 'HYBRID LIVE + IMPORTED';
    doc.text(`Mode: ${mode}`, 14, 23);
    doc.text(`Generated At: ${new Date().toISOString()}`, 14, 29);
    doc.text(`Total anomalies: ${rows.length} | Critical: ${rows.filter(r => r.severity === 'CRITICAL').length} | High: ${rows.filter(r => r.severity === 'HIGH').length}`, 14, 35);
    stage = 'table';
    autoTable(doc, {
      startY: 41, margin: { top: 14, bottom: 18, left: 14, right: 14 },
      tableWidth: width - 28,
      head: [['Severity', 'Incident', 'Route', 'Window', 'Carrier', 'Flight', 'Actual', 'Expected', 'Deviation', 'Percentile', 'Status', 'Source']],
      body, styles: { font: 'helvetica', fontSize: 6, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [16, 24, 40] },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('Anomaly PDF export failed', { stage, rowCount: rows.length, error });
    throw new Error('PDF export failed. Please try again.');
  }
}

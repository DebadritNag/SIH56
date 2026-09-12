'use client';

/**
 * Live Scraping page — unified UI for both Live and Demo modes.
 *
 * LiveCollection handles mode-awareness internally:
 *   - real mode → fires real API calls to /live/runs
 *   - mock/demo mode → same layout, "RUN DEMO (MOCK)" button drives
 *     the animated pipeline via runSimulated() with mock data
 *
 * The previous DemoScrapingTestPage was a ~600-line separate copy of
 * almost the same UI. It has been removed; all demo scraping behaviour
 * is preserved inside LiveCollection's existing runSimulated() path,
 * which shows the same 11-stage pipeline animation and mock fare table.
 */

import LiveCollection from '@/components/LiveCollection';

export default function ScrapingTestPage() {
  return <LiveCollection />;
}

'use client';

import React from 'react';

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#F5F7FA', color: '#101828' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '440px', width: '100%', backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: '8px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEE4E2', color: '#D92D20', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontWeight: 'bold' }}>
              !
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#101828' }}>
              AirPulse encountered a critical application error
            </h1>
            <p style={{ fontSize: '12px', color: '#475467', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              The root application shell encountered an unrecoverable rendering exception. System state has been halted safely.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => reset()}
                style={{ padding: '8px 16px', backgroundColor: '#1570EF', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Reload Application
              </button>
              <a
                href="/"
                style={{ padding: '8px 16px', backgroundColor: '#FFFFFF', color: '#344054', border: '1px solid #D0D5DD', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: '600' }}
              >
                Return to Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

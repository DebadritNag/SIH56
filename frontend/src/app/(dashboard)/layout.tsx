import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { LiveDataGate } from '@/components/data/LiveDataGate';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <AppShell><LiveDataGate>{children}</LiveDataGate></AppShell>
    </RequireAuth>
  );
}

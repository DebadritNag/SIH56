'use client';
import { useDataMode } from '@/lib/providers/DataModeProvider';
import LivePipelineMonitor from '@/components/LivePipelineMonitor';

export default function PipelineMonitorPage() {
  const { mode } = useDataMode();
  return <LivePipelineMonitor key={mode} demo={mode === 'mock'} />;
}

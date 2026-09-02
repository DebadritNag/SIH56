'use client';

import React from 'react';
import { EChartWrapper } from './EChartWrapper';

interface BacktestComparisonChartProps {
  dates?: string[];
  apixSeries?: number[];
  benchmarkSeries?: number[];
  benchmarkName?: string;
  data?: Array<{ month: string; apix: number; cpi_transport: number; dgca_fare?: number }>;
}

export const BacktestComparisonChart: React.FC<BacktestComparisonChartProps> = ({
  dates: initialDates,
  apixSeries: initialApixSeries,
  benchmarkSeries: initialBenchmarkSeries,
  benchmarkName = 'MoSPI Transport Sub-Index',
  data,
}) => {
  const dates = data ? data.map((d) => d.month) : (initialDates || [
    '01 Aug', '05 Aug', '09 Aug', '13 Aug', '17 Aug', '21 Aug', '25 Aug', '29 Aug', '02 Sep'
  ]);

  const apixSeries = data ? data.map((d) => d.apix) : (initialApixSeries || [
    100.0, 101.2, 102.5, 104.1, 103.8, 105.4, 106.8, 107.5, 108.43
  ]);

  const benchmarkSeries = data ? data.map((d) => d.cpi_transport) : (initialBenchmarkSeries || [
    100.0, 100.4, 100.9, 101.4, 101.8, 102.1, 102.5, 102.8, 103.1
  ]);

  // Data-driven dynamic domain calculation with headroom
  const allValues = [...apixSeries, ...benchmarkSeries].filter((v) => typeof v === 'number' && !isNaN(v));
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 95;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 115;
  const range = Math.max(rawMax - rawMin, 5);
  const padding = Math.max(range * 0.12, 2.5);
  const yMin = Math.floor(rawMin - padding);
  const yMax = Math.ceil(rawMax + padding);

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#081426',
      borderColor: '#1E293B',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#F8FAFC', fontSize: 12 },
    },
    legend: {
      data: ['AirPulse High-Frequency APIx', benchmarkName],
      bottom: 0,
      icon: 'roundRect',
      textStyle: { color: '#475467', fontSize: 11 },
    },
    grid: {
      left: 48,
      right: 32,
      top: 36,
      bottom: 48,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      axisLabel: { color: '#667085', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        formatter: (val: number) => val.toFixed(1),
      },
    },
    series: [
      {
        name: 'AirPulse High-Frequency APIx',
        type: 'line',
        data: apixSeries,
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        itemStyle: { color: '#2563EB' },
        lineStyle: { width: 2.5, color: '#2563EB' },
      },
      {
        name: benchmarkName,
        type: 'line',
        data: benchmarkSeries,
        smooth: true,
        showSymbol: true,
        symbolSize: 5,
        itemStyle: { color: '#64748B' },
        lineStyle: { width: 2, type: 'dashed', color: '#64748B' },
      },
    ],
  };

  return (
    <div className="w-full min-w-0 min-h-[360px]">
      <EChartWrapper option={option as any} style={{ height: '360px', width: '100%' }} />
    </div>
  );
};

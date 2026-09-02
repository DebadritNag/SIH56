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
      left: '3%',
      right: '4%',
      top: '8%',
      bottom: '12%',
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
      min: 98,
      max: 110,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: { color: '#667085', fontSize: 11 },
    },
    series: [
      {
        name: 'AirPulse High-Frequency APIx',
        type: 'line',
        data: apixSeries,
        smooth: true,
        itemStyle: { color: '#2563EB' },
        lineStyle: { width: 2.5, color: '#2563EB' },
      },
      {
        name: benchmarkName,
        type: 'line',
        data: benchmarkSeries,
        smooth: true,
        itemStyle: { color: '#64748B' },
        lineStyle: { width: 2, type: 'dashed', color: '#64748B' },
      },
    ],
  };

  return <EChartWrapper option={option as any} style={{ height: '320px', width: '100%' }} />;
};

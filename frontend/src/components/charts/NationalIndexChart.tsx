'use client';

import React from 'react';
import { EChartWrapper } from './EChartWrapper';
import { NationalTrendPoint } from '@/types';

interface NationalIndexChartProps {
  data: NationalTrendPoint[];
  showBenchmark?: boolean;
}

export const NationalIndexChart: React.FC<NationalIndexChartProps> = ({
  data,
  showBenchmark = true,
}) => {
  const dates = data.map((d) => d.date);
  const apixValues = data.map((d) => d.apix);
  const benchmarkValues = data.map((d) => d.benchmark_cpi);

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#081426',
      borderColor: '#1E293B',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color: '#F8FAFC',
        fontSize: 12,
        fontFamily: 'inherit',
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const idx = params[0].dataIndex;
        const item = data[idx];
        const dateStr = item?.date || '';
        const apix = item?.apix.toFixed(2);
        const daily = (item?.daily_pct ?? 0) > 0 ? `+${item?.daily_pct.toFixed(2)}%` : `${item?.daily_pct.toFixed(2)}%`;
        const cov = item?.coverage_pct.toFixed(1);
        const note = item?.annotation ? `<div style="margin-top:6px; color:#FBBF24; font-size:11px;">📌 ${item.annotation}</div>` : '';

        return `
          <div style="font-weight:600; margin-bottom:4px;">${dateStr} • National APIx</div>
          <div style="display:flex; justify-content:space-between; gap:16px; margin:2px 0;">
            <span style="color:#94A3B8;">APIx Value:</span>
            <span style="font-weight:700; color:#38BDF8;">${apix}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:16px; margin:2px 0;">
            <span style="color:#94A3B8;">Daily Movement:</span>
            <span style="color:${(item?.daily_pct ?? 0) >= 0 ? '#4ADE80' : '#F87171'}">${daily}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:16px; margin:2px 0;">
            <span style="color:#94A3B8;">Network Coverage:</span>
            <span>${cov}%</span>
          </div>
          ${note}
        `;
      },
    },
    legend: {
      data: ['AirPulse APIx (Domestic Aviation)', 'MoSPI CPI Transport & Comm Reference'],
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 6,
      textStyle: {
        color: '#475467',
        fontSize: 11,
      },
    },
    grid: {
      left: '2%',
      right: '3%',
      top: '8%',
      bottom: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      axisTick: { alignWithLabel: true },
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        formatter: (val: string) => {
          const parts = val.split('-');
          return `${parts[2]}/${parts[1]}`;
        },
      },
    },
    yAxis: {
      type: 'value',
      min: 98,
      max: 110,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        formatter: '{value}',
      },
    },
    series: [
      {
        name: 'AirPulse APIx (Domestic Aviation)',
        type: 'line',
        data: apixValues,
        smooth: true,
        showSymbol: true,
        symbolSize: 4,
        itemStyle: { color: '#2563EB' },
        lineStyle: { width: 2.5, color: '#2563EB' },
        markPoint: {
          data: [
            { type: 'max', name: 'Peak Index', symbolSize: 32, itemStyle: { color: '#DC2626' } },
          ],
        },
      },
      ...(showBenchmark
        ? [
            {
              name: 'MoSPI CPI Transport & Comm Reference',
              type: 'line',
              data: benchmarkValues,
              smooth: true,
              showSymbol: false,
              itemStyle: { color: '#94A3B8' },
              lineStyle: { width: 1.5, type: 'dashed', color: '#94A3B8' },
            },
          ]
        : []),
    ],
  };

  return <EChartWrapper option={option as any} style={{ height: '340px', width: '100%' }} />;
};

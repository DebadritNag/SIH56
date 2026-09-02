'use client';

import React from 'react';
import { EChartWrapper } from './EChartWrapper';
import { formatINR } from '@/lib/formatters';

interface AdvancePurchasePoint {
  days_prior: number;
  window_label: string;
  today_fare: number;
  median_30d_fare: number;
}

interface RouteAdvancePurchaseChartProps {
  curveData: AdvancePurchasePoint[];
}

export const RouteAdvancePurchaseChart: React.FC<RouteAdvancePurchaseChartProps> = ({
  curveData,
}) => {
  const xLabels = curveData.map((p) => `${p.window_label} (${p.days_prior}d)`);
  const todayFares = curveData.map((p) => p.today_fare);
  const medianFares = curveData.map((p) => p.median_30d_fare);

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#081426',
      borderColor: '#1E293B',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#F8FAFC', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const idx = params[0].dataIndex;
        const item = curveData[idx];
        const diff = item.today_fare - item.median_30d_fare;
        const diffPct = ((diff / item.median_30d_fare) * 100).toFixed(1);
        const sign = diff > 0 ? '+' : '';

        return `
          <div style="font-weight:600; margin-bottom:4px;">Booking Lead Time: ${item.window_label} (${item.days_prior} Days Before Departure)</div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">Observed Median Fare:</span>
            <span style="font-weight:700; color:#38BDF8;">${formatINR(item.today_fare)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">30-Day Historical Baseline:</span>
            <span>${formatINR(item.median_30d_fare)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">Advance Purchase Premium:</span>
            <span style="color:${diff >= 0 ? '#F87171' : '#4ADE80'}">${sign}${formatINR(diff)} (${sign}${diffPct}%)</span>
          </div>
        `;
      },
    },
    legend: {
      data: ["Today's Representative Curve", '30-Day Median Historical Curve'],
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 6,
      textStyle: { color: '#475467', fontSize: 11 },
    },
    grid: {
      left: '2%',
      right: '4%',
      top: '8%',
      bottom: '14%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      axisTick: { alignWithLabel: true },
      axisLabel: { color: '#475467', fontSize: 11, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        formatter: (val: number) => `₹${val / 1000}k`,
      },
    },
    series: [
      {
        name: "Today's Representative Curve",
        type: 'line',
        data: todayFares,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: '#2563EB' },
        lineStyle: { width: 2.5, color: '#2563EB' },
      },
      {
        name: '30-Day Median Historical Curve',
        type: 'line',
        data: medianFares,
        smooth: true,
        symbolSize: 4,
        itemStyle: { color: '#94A3B8' },
        lineStyle: { width: 1.8, type: 'dashed', color: '#94A3B8' },
      },
    ],
  };

  return <EChartWrapper option={option as any} style={{ height: '260px', width: '100%' }} />;
};

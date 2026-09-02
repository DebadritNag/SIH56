'use client';

import React, { useMemo } from 'react';
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
  selectedWindows?: number[];
}

export const RouteAdvancePurchaseChart: React.FC<RouteAdvancePurchaseChartProps> = ({
  curveData,
  selectedWindows = [1, 7, 15, 30, 45],
}) => {
  const option = useMemo(() => {
    // Filter points by active selected windows
    const filteredPoints = curveData.filter((p) =>
      selectedWindows.includes(p.days_prior)
    );

    if (filteredPoints.length === 0) {
      return {
        title: {
          text: 'No advance purchase observations match the selected windows.',
          left: 'center',
          top: 'center',
          textStyle: { color: '#64748B', fontSize: 12, fontWeight: 500 },
        },
      };
    }

    const xLabels = filteredPoints.map((p) => `${p.window_label} (${p.days_prior}d)`);
    const todayFares = filteredPoints.map((p) => p.today_fare);
    const medianFares = filteredPoints.map((p) => p.median_30d_fare);

    const allValues = [...todayFares, ...medianFares].filter(
      (v) => typeof v === 'number' && !isNaN(v)
    );
    const rawMin = allValues.length > 0 ? Math.min(...allValues) : 3000;
    const rawMax = allValues.length > 0 ? Math.max(...allValues) : 15000;
    const range = Math.max(rawMax - rawMin, 1000);
    const padding = Math.max(range * 0.15, 500);
    const yMin = Math.max(0, Math.floor((rawMin - padding) / 500) * 500);
    const yMax = Math.ceil((rawMax + padding) / 500) * 500;

    return {
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
          const item = filteredPoints[idx];
          if (!item) return '';
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
        min: yMin,
        max: yMax,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLabel: {
          color: '#667085',
          fontSize: 11,
          formatter: (val: number) => `₹${(val / 1000).toFixed(1)}k`,
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
  }, [curveData, selectedWindows]);

  return (
    <div className="w-full min-w-0 min-h-[260px]">
      <EChartWrapper option={option as any} notMerge={true} style={{ height: '260px', width: '100%' }} />
    </div>
  );
};

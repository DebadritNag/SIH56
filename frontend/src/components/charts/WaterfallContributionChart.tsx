'use client';

import React from 'react';
import { EChartWrapper } from './EChartWrapper';
import { RouteContributor } from '@/types';

interface WaterfallContributionChartProps {
  contributors: RouteContributor[];
}

export const WaterfallContributionChart: React.FC<WaterfallContributionChartProps> = ({
  contributors,
}) => {
  // Sorted for horizontal display
  const routes = contributors.map((c) => c.route).reverse();
  const contributions = contributors.map((c) => c.apix_contribution).reverse();
  const weights = contributors.map((c) => c.weight_pct).reverse();

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#081426',
      borderColor: '#1E293B',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#F8FAFC', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const idx = params[0].dataIndex;
        const item = contributors[contributors.length - 1 - idx];
        const sign = item.apix_contribution > 0 ? '+' : '';
        return `
          <div style="font-weight:600; margin-bottom:4px;">${item.route} (${item.origin} → ${item.destination})</div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">APIx Contribution:</span>
            <span style="font-weight:700; color:${item.apix_contribution >= 0 ? '#4ADE80' : '#F87171'}">${sign}${item.apix_contribution.toFixed(2)} pts</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">Route Basket Weight:</span>
            <span>${item.weight_pct.toFixed(1)}%</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">Fare Movement:</span>
            <span>${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(1)}%</span>
          </div>
        `;
      },
    },
    grid: {
      left: '3%',
      right: '8%',
      top: '5%',
      bottom: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        formatter: '{value} pts',
      },
    },
    yAxis: {
      type: 'category',
      data: routes,
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#101828',
        fontWeight: 600,
        fontSize: 11,
      },
    },
    series: [
      {
        name: 'APIx Contribution',
        type: 'bar',
        data: contributions.map((val) => ({
          value: val,
          itemStyle: {
            color: val >= 0 ? '#2563EB' : '#DC2626',
            borderRadius: val >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
          },
        })),
        barWidth: 16,
        label: {
          show: true,
          position: 'right',
          color: '#475467',
          fontSize: 11,
          formatter: (params: any) => {
            const v = params.value;
            return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
          },
        },
      },
    ],
  };

  return <EChartWrapper option={option as any} style={{ height: '260px', width: '100%' }} />;
};

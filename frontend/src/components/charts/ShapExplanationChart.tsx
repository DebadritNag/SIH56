'use client';

import React from 'react';
import { EChartWrapper } from './EChartWrapper';
import { formatINR } from '@/lib/formatters';

interface ShapFactor {
  feature: string;
  contribution_inr: number;
  description: string;
}

interface ShapExplanationChartProps {
  factors: ShapFactor[];
  expectedFare: number;
  actualFare: number;
}

export const ShapExplanationChart: React.FC<ShapExplanationChartProps> = ({
  factors,
}) => {
  const sorted = [...factors].reverse();
  const features = sorted.map((f) => f.feature);
  const values = sorted.map((f) => f.contribution_inr);

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
        const factor = sorted[idx];
        const val = factor.contribution_inr;
        const sign = val > 0 ? '+' : '';
        return `
          <div style="font-weight:600; margin-bottom:4px;">${factor.feature}</div>
          <div style="color:#94A3B8; font-size:11px; margin-bottom:4px;">${factor.description}</div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">Model Expectation Impact:</span>
            <span style="font-weight:700; color:#38BDF8;">${sign}${formatINR(val)}</span>
          </div>
        `;
      },
    },
    grid: {
      left: '2%',
      right: '18%',
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
        formatter: '₹{value}',
      },
    },
    yAxis: {
      type: 'category',
      data: features,
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#101828',
        fontSize: 11,
        width: 140,
        overflow: 'truncate',
      },
    },
    series: [
      {
        name: 'SHAP Contribution',
        type: 'bar',
        data: values.map((val) => ({
          value: val,
          itemStyle: {
            color: '#0EA5E9',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 16,
        label: {
          show: true,
          position: 'right',
          color: '#101828',
          fontSize: 11,
          formatter: (params: any) => `+${formatINR(params.value)}`,
        },
      },
    ],
  };

  return <EChartWrapper option={option as any} style={{ height: '220px', width: '100%' }} />;
};

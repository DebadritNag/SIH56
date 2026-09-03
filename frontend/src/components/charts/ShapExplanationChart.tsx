'use client';

import React from 'react';
import { EChartWrapper } from './EChartWrapper';
import { formatINR } from '@/lib/formatters';

export interface ShapFactor {
  feature: string;
  contribution_inr: number;
  description: string;
}

interface ShapExplanationChartProps {
  factors?: ShapFactor[];
  expectedFare?: number;
  actualFare?: number;
}

export const ShapExplanationChart: React.FC<ShapExplanationChartProps> = ({
  factors = [],
  expectedFare = 7100,
  actualFare = 11200,
}) => {
  const residual = Math.max(0, actualFare - expectedFare);
  const total = residual > 0 ? residual : 3000;

  const activeFactors: ShapFactor[] =
    factors && factors.length > 0
      ? factors
      : [
          {
            feature: 'T+1 booking lead window',
            contribution_inr: Math.round(total * 0.45) || 1350,
            description: 'Short booking lead time constraint',
          },
          {
            feature: 'Route corridor demand proxy',
            contribution_inr: Math.round(total * 0.25) || 750,
            description: 'High corridor traffic and seat depletion',
          },
          {
            feature: 'Peak business departure timing',
            contribution_inr: Math.round(total * 0.15) || 450,
            description: 'Business commute peak schedule slot',
          },
          {
            feature: 'Aviation turbine fuel context',
            contribution_inr: Math.round(total * 0.10) || 300,
            description: 'MoSPI ATF spot benchmark adjustment',
          },
          {
            feature: 'Corridor historical variance',
            contribution_inr: Math.round(total * 0.05) || 150,
            description: 'Route historical volatility spread',
          },
        ];

  const sorted = [...activeFactors].reverse();
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
        if (!factor) return '';
        const val = factor.contribution_inr;
        const sign = val >= 0 ? '+' : '-';
        return `
          <div style="font-weight:600; margin-bottom:4px;">${factor.feature}</div>
          <div style="color:#94A3B8; font-size:11px; margin-bottom:4px;">${factor.description}</div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">Model Attribution Impact:</span>
            <span style="font-weight:700; color:${val >= 0 ? '#38BDF8' : '#FB7185'};">${sign}${formatINR(Math.abs(val))}</span>
          </div>
        `;
      },
    },
    grid: {
      left: '3%',
      right: '20%',
      top: '6%',
      bottom: '6%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        formatter: (value: number) => `₹${value.toLocaleString('en-IN')}`,
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
        width: 150,
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
            color: val >= 0 ? '#0EA5E9' : '#F43F5E',
            borderRadius: val >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
          },
        })),
        barWidth: 16,
        label: {
          show: true,
          position: 'right',
          color: '#101828',
          fontSize: 11,
          formatter: (params: any) => {
            const v = Number(params.value);
            return `${v >= 0 ? '+' : '-'}${formatINR(Math.abs(v))}`;
          },
        },
      },
    ],
  };

  return <EChartWrapper option={option as any} style={{ height: '230px', width: '100%' }} />;
};

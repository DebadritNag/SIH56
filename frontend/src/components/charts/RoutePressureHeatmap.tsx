'use client';

import React from 'react';
import { EChartWrapper } from './EChartWrapper';

export const RoutePressureHeatmap: React.FC = () => {
  const routes = ['DEL-BOM', 'DEL-BLR', 'BOM-BLR', 'DEL-CCU', 'HYD-DEL', 'BOM-GOI', 'BLR-PNQ'];
  const windows = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];

  // [routeIdx, windowIdx, changePct]
  const matrixData = [
    [0, 0, 18.2], [0, 1, 11.4], [0, 2, 6.2], [0, 3, 2.1], [0, 4, -0.4],
    [1, 0, 14.8], [1, 1, 8.9],  [1, 2, 4.5], [1, 3, 1.2], [1, 4, -0.8],
    [2, 0, 12.1], [2, 1, 7.2],  [2, 2, 3.8], [2, 3, 0.5], [2, 4, -1.2],
    [3, 0, 9.4],  [3, 1, 6.8],  [3, 2, 2.4], [3, 3, -0.2], [3, 4, -1.5],
    [4, 0, 8.1],  [4, 1, 5.3],  [4, 2, 1.9], [4, 3, 0.2], [4, 4, -0.9],
    [5, 0, -5.2], [5, 1, -8.4], [5, 2, -4.1], [5, 3, -2.8], [5, 4, -3.2],
    [6, 0, 4.1],  [6, 1, -4.3], [6, 2, -1.2], [6, 3, -1.8], [6, 4, -2.5],
  ];

  const option = {
    tooltip: {
      position: 'top',
      backgroundColor: '#081426',
      borderColor: '#1E293B',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#F8FAFC', fontSize: 12 },
      formatter: (params: any) => {
        const item = params.data;
        const rName = routes[item[0]];
        const wName = windows[item[1]];
        const pct = item[2];
        const sign = pct > 0 ? '+' : '';
        return `
          <div style="font-weight:600; margin-bottom:4px;">${rName} • ${wName} Window</div>
          <div style="display:flex; justify-content:space-between; gap:16px;">
            <span style="color:#94A3B8;">7-Day Price Movement:</span>
            <span style="font-weight:700; color:${pct > 5 ? '#F87171' : pct < 0 ? '#4ADE80' : '#38BDF8'};">${sign}${pct.toFixed(1)}%</span>
          </div>
        `;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '6%',
      bottom: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: windows,
      splitArea: { show: true },
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      axisLabel: { color: '#101828', fontWeight: 600, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: routes,
      splitArea: { show: true },
      axisLine: { lineStyle: { color: '#D0D5DD' } },
      axisLabel: { color: '#475467', fontWeight: 500, fontSize: 11 },
    },
    visualMap: {
      min: -10,
      max: 20,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      itemWidth: 12,
      itemHeight: 140,
      inRange: {
        color: ['#16A34A', '#86EFAC', '#F8FAFC', '#FCA5A5', '#DC2626'],
      },
      textStyle: { color: '#667085', fontSize: 10 },
      formatter: (val: number) => `${val > 0 ? '+' : ''}${val}%`,
    },
    series: [
      {
        name: 'Fare Velocity',
        type: 'heatmap',
        data: matrixData,
        label: {
          show: true,
          formatter: (p: any) => `${p.data[2] > 0 ? '+' : ''}${p.data[2]}%`,
          fontSize: 10,
          color: '#101828',
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.4)',
          },
        },
      },
    ],
  };

  return <EChartWrapper option={option as any} style={{ height: '300px', width: '100%' }} />;
};

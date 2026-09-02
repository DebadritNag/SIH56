'use client';

import React, { useMemo } from 'react';
import { EChartWrapper } from './EChartWrapper';

interface RoutePressureHeatmapProps {
  selectedWindows?: number[];
  selectedRoutes?: string[];
}

export const RoutePressureHeatmap: React.FC<RoutePressureHeatmapProps> = ({
  selectedWindows = [1, 7, 15, 30, 45],
  selectedRoutes = [],
}) => {
  const allRoutes = ['DEL-BOM', 'DEL-BLR', 'BOM-BLR', 'DEL-CCU', 'HYD-DEL', 'BOM-GOI', 'BLR-PNQ'];
  const allWindowsMeta = [
    { code: 1, label: 'T+1' },
    { code: 7, label: 'T+7' },
    { code: 15, label: 'T+15' },
    { code: 30, label: 'T+30' },
    { code: 45, label: 'T+45' },
  ];

  // Base raw table data: map [route, windowCode] -> changePct
  const rawData: Record<string, Record<number, number>> = {
    'DEL-BOM': { 1: 18.2, 7: 11.4, 15: 6.2, 30: 2.1, 45: -0.4 },
    'DEL-BLR': { 1: 14.8, 7: 8.9, 15: 4.5, 30: 1.2, 45: -0.8 },
    'BOM-BLR': { 1: 12.1, 7: 7.2, 15: 3.8, 30: 0.5, 45: -1.2 },
    'DEL-CCU': { 1: 9.4, 7: 6.8, 15: 2.4, 30: -0.2, 45: -1.5 },
    'HYD-DEL': { 1: 8.1, 7: 5.3, 15: 1.9, 30: 0.2, 45: -0.9 },
    'BOM-GOI': { 1: -5.2, 7: -8.4, 15: -4.1, 30: -2.8, 45: -3.2 },
    'BLR-PNQ': { 1: 4.1, 7: -4.3, 15: -1.2, 30: -1.8, 45: -2.5 },
  };

  const option = useMemo(() => {
    const activeWindowsMeta = allWindowsMeta.filter((w) =>
      selectedWindows.includes(w.code)
    );

    const activeRoutes =
      selectedRoutes && selectedRoutes.length > 0
        ? allRoutes.filter((r) => selectedRoutes.includes(r))
        : allRoutes;

    if (activeWindowsMeta.length === 0 || activeRoutes.length === 0) {
      return {
        title: {
          text: 'No observations match the selected filters.',
          left: 'center',
          top: 'center',
          textStyle: { color: '#64748B', fontSize: 12, fontWeight: 500 },
        },
      };
    }

    const windowLabels = activeWindowsMeta.map((w) => w.label);

    const matrixData: [number, number, number][] = [];
    activeRoutes.forEach((route, rIdx) => {
      activeWindowsMeta.forEach((win, wIdx) => {
        const val = rawData[route]?.[win.code] ?? 0.0;
        matrixData.push([rIdx, wIdx, val]);
      });
    });

    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#081426',
        borderColor: '#1E293B',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#F8FAFC', fontSize: 12 },
        formatter: (params: any) => {
          const item = params.data;
          const rName = activeRoutes[item[0]];
          const wName = windowLabels[item[1]];
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
        bottom: '14%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: windowLabels,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { color: '#101828', fontWeight: 600, fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: activeRoutes,
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
        itemHeight: 120,
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
  }, [selectedWindows, selectedRoutes]);

  return (
    <div className="w-full min-w-0 min-h-[300px]">
      <EChartWrapper option={option as any} notMerge={true} style={{ height: '300px', width: '100%' }} />
    </div>
  );
};

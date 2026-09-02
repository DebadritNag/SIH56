'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';

interface EChartWrapperProps {
  option: EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  loading?: boolean;
}

export const EChartWrapper: React.FC<EChartWrapperProps> = ({
  option,
  style = { height: '320px', width: '100%' },
  className,
  loading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !chartRef.current) return;

    let isDisposed = false;

    const initChart = async () => {
      const echartsModule = await import('echarts');
      if (isDisposed || !chartRef.current) return;

      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echartsModule.init(chartRef.current, undefined, {
          renderer: 'canvas',
        });
      }

      chartInstanceRef.current.setOption(option, true);

      if (loading) {
        chartInstanceRef.current.showLoading({
          text: 'Computing statistical series...',
          color: '#2563EB',
          textColor: '#475467',
          maskColor: 'rgba(255, 255, 255, 0.7)',
        });
      } else {
        chartInstanceRef.current.hideLoading();
      }

      // ResizeObserver handles window resizing, sidebar collapse/expand, drawer opening, etc.
      if (!resizeObserverRef.current && chartRef.current) {
        resizeObserverRef.current = new ResizeObserver(() => {
          if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
            chartInstanceRef.current.resize();
          }
        });
        resizeObserverRef.current.observe(chartRef.current);
      }
    };

    initChart();

    const handleWindowResize = () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.resize();
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [isClient, option, loading]);

  if (!isClient) {
    return (
      <div
        style={style}
        className="flex items-center justify-center bg-slate-50 border border-[#E4E7EC] rounded text-xs text-[#667085] min-w-0"
      >
        Initializing analytical chart renderer...
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      style={style}
      className={`min-w-0 w-full ${className || ''}`}
    />
  );
};

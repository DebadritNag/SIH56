'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';

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
  const chartInstanceRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !chartRef.current) return;

    let echartsModule: any;

    const initChart = async () => {
      echartsModule = await import('echarts');
      if (!chartRef.current) return;

      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echartsModule.init(chartRef.current);
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
    };

    initChart();

    const handleResize = () => {
      chartInstanceRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, [isClient, option, loading]);

  if (!isClient) {
    return (
      <div
        style={style}
        className="flex items-center justify-center bg-slate-50 border border-[#E4E7EC] rounded text-xs text-[#667085]"
      >
        Initializing analytical chart renderer...
      </div>
    );
  }

 return <div ref={chartRef} style={style} className={className} />;
};

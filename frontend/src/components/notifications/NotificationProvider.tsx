'use client';

import React from 'react';
import { Toaster } from 'sonner';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        expand={false}
        visibleToasts={4}
        closeButton
        richColors={false}
        toastOptions={{
          className:
            'bg-white text-[#101828] border border-[#E4E7EC] shadow-md rounded-lg text-xs font-sans p-3.5',
          style: {
            fontFamily: 'inherit',
          },
        }}
      />
    </>
  );
};

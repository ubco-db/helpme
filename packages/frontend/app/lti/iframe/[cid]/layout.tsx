'use client'

import { ReactNode } from 'react'

export default function IframeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body, #html {
          height: auto !important;
          min-height: 0 !important;
          background: transparent !important;
        }
        body {
          display: block !important;
          flex-grow: 0 !important;
        }
      `}</style>
      {children}
    </>
  )
}

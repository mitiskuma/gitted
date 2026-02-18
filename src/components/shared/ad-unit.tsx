"use client";

import { useEffect, useRef } from "react";

interface AdUnitProps {
  slotId: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

export function AdUnit({ slotId, format = "auto", className }: AdUnitProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded or blocked by ad blocker
    }
  }, []);

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-XXXXXXXX";

  return (
    <div className={className}>
      <ins
        className="adsbygoogle block"
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

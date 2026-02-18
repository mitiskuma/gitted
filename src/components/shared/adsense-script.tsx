import Script from "next/script";

export function AdsenseScript() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-XXXXXXXX";

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}

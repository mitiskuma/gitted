"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cookie-consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
  }, []);

  const respond = (value: string) => {
    localStorage.setItem(STORAGE_KEY, value);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          We use cookies to enhance your experience. By continuing to visit this
          site you agree to our use of cookies.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => respond("declined")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => respond("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

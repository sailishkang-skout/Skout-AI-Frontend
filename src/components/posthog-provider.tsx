"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useState } from "react";
import { isConfiguredSecret } from "@/lib/observability-keys";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const posthogEnabled = isConfiguredSecret(key);

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!posthogEnabled);

  useEffect(() => {
    if (!posthogEnabled || posthog.__loaded) {
      setReady(true);
      return;
    }
    try {
      posthog.init(key!, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
      });
    } catch {
      // Invalid/expired key — app runs without PostHog.
    }
    setReady(true);
  }, []);

  if (!posthogEnabled || !ready) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

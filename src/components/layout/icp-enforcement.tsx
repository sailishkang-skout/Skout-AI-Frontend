"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIcpStatus, ICP_SETUP_PATH } from "@/lib/icp";

const ALLOWED_WITHOUT_ICP = ["/onboarding/icp", "/settings/icp", "/settings/workspace"];

/** Redirect users without ICP to setup (except on allowed paths). */
export function IcpEnforcement() {
  const router = useRouter();
  const pathname = usePathname();
  const { configured, isLoading } = useIcpStatus();

  useEffect(() => {
    if (isLoading || configured) return;
    const allowed = ALLOWED_WITHOUT_ICP.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (allowed) return;
    router.replace(`${ICP_SETUP_PATH}?return=${encodeURIComponent(pathname)}`);
  }, [configured, isLoading, pathname, router]);

  return null;
}

import { Lock } from "lucide-react";

export const CONTACT_EMAIL = "support@skoutai.io";

/** Shown in place of an area of the app that the workspace's plan does not include. */
export function FeatureOff() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold">This isn&apos;t on your plan</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your workspace doesn&apos;t include this part of Skout yet. Get in touch and we&apos;ll help.
      </p>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Contact us
      </a>
    </div>
  );
}

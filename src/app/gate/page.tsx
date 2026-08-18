import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/gate";
import { unlockGate } from "./actions";

export default function GatePage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const next = safeNextPath(searchParams.next);
  const hasError = searchParams.error === "1";

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Early access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Skout isn&apos;t open to the public yet. Enter the access code to continue.
        </p>
        <form action={unlockGate} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input
            type="password"
            name="token"
            autoFocus
            required
            autoComplete="off"
            placeholder="Access code"
            aria-invalid={hasError}
          />
          {hasError && (
            <p role="alert" className="text-sm text-destructive">
              That code isn&apos;t right — try again.
            </p>
          )}
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </div>
    </main>
  );
}

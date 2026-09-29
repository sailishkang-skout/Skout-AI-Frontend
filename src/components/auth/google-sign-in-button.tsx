import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** AUTH-FE-10: hits the BFF's /google/start route (FE-05), which redirects the whole page to
 *  Google — not a fetch() call, so this is a plain link styled like a button, not a mutation. */
export function GoogleSignInButton({ next }: { next?: string }) {
  const href = next ? `/app/api/auth/google/start?next=${encodeURIComponent(next)}` : "/app/api/auth/google/start";
  return (
    <a href={href} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.65z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.74-2.1-6.68-4.92H1.32v3.09C3.29 21.3 7.31 24 12 24z"
        />
        <path fill="#FBBC05" d="M5.32 14.31A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.57.39-2.31V6.6H1.32A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.32 5.4z" />
        <path
          fill="#EA4335"
          d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.29 2.7 1.32 6.6l4 3.09C6.26 6.87 8.89 4.77 12 4.77z"
        />
      </svg>
      Continue with Google
    </a>
  );
}

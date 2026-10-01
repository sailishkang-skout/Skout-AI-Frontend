import { APP_BASE_PATH } from "@/lib/app-url";
import ElectricLogo from "@/components/auth/electric-logo/ElectricLogo";
import { PulsesBackground } from "@/components/auth/pulses-background";

// Plain URLs (not next/image): public/ assets are served under the /app basePath.
const MARK_SRC = `${APP_BASE_PATH}/brand/skout-mark.png`;
const LOGO_SRC = `${APP_BASE_PATH}/brand/skout-logo-dark.png`;

/**
 * Shared frame for every auth page: a full-screen dark scene with live Pulses strands, the Skout
 * logo top-left, the electric Skout mark above a centered glass card. Forced to the dark theme so
 * form tokens (bg-card, border, muted-foreground) render for a dark surface regardless of the app
 * theme. The `auth-scope` class scopes the form restyling in globals.css to these pages only.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark auth-scope relative isolate flex min-h-svh flex-col items-center justify-center overflow-x-hidden bg-[#06050d] px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <PulsesBackground className="absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(6,5,13,0.8)_100%)]" />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset served from public/ under the /app basePath */}
      <img
        src={LOGO_SRC}
        alt="Skout"
        width={1040}
        height={237}
        className="absolute left-5 top-5 h-6 w-auto sm:left-8 sm:top-7 sm:h-7"
      />

      <div className="auth-mark">
        {/* Static mark underneath: gives the logo its body and is the fallback without WebGL2. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img
          src={MARK_SRC}
          alt=""
          width={251}
          height={237}
          className="absolute left-1/2 top-1/2 w-[27%] -translate-x-1/2 -translate-y-1/2 opacity-90"
        />
        <ElectricLogo
          src={MARK_SRC}
          color="#ecc7ff"
          glowColor="#8f6bff"
          scale={0.3}
          thickness={1.1}
          strands={4}
          bend={0.6}
          crackle={1.4}
          arcs={1}
          speed={2.2}
          glow={0.95}
          cursorRadius={90}
          interactive
          className="!overflow-visible"
        />
      </div>

      {children}
    </main>
  );
}

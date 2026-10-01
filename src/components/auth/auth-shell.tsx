import { APP_BASE_PATH } from "@/lib/app-url";
import ElectricLogo from "@/components/auth/electric-logo/ElectricLogo";

// Plain URLs (not next/image / next/link): public/ assets are served under the /app basePath.
const MARK_SRC = `${APP_BASE_PATH}/brand/skout-mark.png`;

/**
 * Shared full-screen backdrop for the sign-in / sign-up pages: a dark brand-purple scene with a
 * faded grid, drifting light orbs, and the Skout mark traced by live electric arcs. Forced to the
 * dark theme so the form card tokens (bg-card, border, muted-foreground) render for a dark surface
 * regardless of the app theme.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[hsl(265_45%_6%)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,hsl(265_80%_35%/0.55),transparent_70%),radial-gradient(ellipse_60%_45%_at_85%_110%,hsl(230_85%_45%/0.4),transparent_70%)]" />
        <div className="auth-grid absolute inset-0" />
        <div className="auth-orb absolute -left-24 top-[12%] h-[26rem] w-[26rem] bg-[#6d4aff]/40" />
        <div className="auth-orb auth-orb-slow absolute -right-20 bottom-[8%] h-[30rem] w-[30rem] bg-[#2f6bff]/30" />
        <div className="auth-orb auth-orb-delay absolute left-[40%] top-[55%] h-[18rem] w-[18rem] bg-[#c04bff]/25" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(265_45%_4%/0.75)_100%)]" />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center gap-2">
        <div className="relative h-40 w-56 sm:h-52 sm:w-72">
          {/* Static mark underneath: gives the logo its body and is the fallback without WebGL2. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, served from public/ under the /app basePath */}
          <img
            src={MARK_SRC}
            alt="Skout"
            width={251}
            height={237}
            className="absolute left-1/2 top-1/2 h-[50%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-90"
          />
          <ElectricLogo
            src={MARK_SRC}
            color="#ecc7ff"
            glowColor="#8f6bff"
            scale={0.5}
            strands={4}
            bend={0.6}
            crackle={1.5}
            arcs={1}
            speed={2.2}
            glow={0.8}
            interactive
            className="!overflow-visible"
          />
        </div>
        {children}
      </div>
    </main>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  loadTourState,
  saveTourState,
  shouldShowWelcome,
  TOUR_STEPS,
  type TourPersisted,
  type TourPhase,
} from "@/lib/product-tour";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { TourTooltip } from "@/components/onboarding/tour-tooltip";

interface ProductTourContextValue {
  phase: TourPhase;
  stepIndex: number;
  startTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  restartTour: () => void;
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

export function useProductTour(): ProductTourContextValue {
  const ctx = useContext(ProductTourContext);
  if (!ctx) {
    throw new Error("useProductTour must be used within ProductTourProvider");
  }
  return ctx;
}

/** Safe for places that may render outside the provider (returns no-ops). */
export function useProductTourOptional(): ProductTourContextValue | null {
  return useContext(ProductTourContext);
}

/** In E2E runs, the welcome modal / tour overlay would cover the app and intercept
 * clicks (fresh browser contexts have empty localStorage, so the welcome modal always
 * appears on first visit). Skip it entirely so page shells render unobstructed. */
const E2E_AUTH_BYPASS = process.env.E2E_AUTH_BYPASS === "true";

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [persisted, setPersisted] = useState<TourPersisted>(() => loadTourState());
  const [phase, setPhase] = useState<TourPhase>("done");
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (E2E_AUTH_BYPASS) {
      setPhase("done");
      setReady(true);
      return;
    }
    const state = loadTourState();
    setPersisted(state);
    if (shouldShowWelcome(state)) setPhase("welcome");
    else setPhase("done");
    setReady(true);
  }, []);

  const persist = useCallback((next: TourPersisted) => {
    setPersisted(next);
    saveTourState(next);
  }, []);

  const skipTour = useCallback(() => {
    persist({ welcomeSeen: true, dismissed: true, completed: false });
    setPhase("done");
  }, [persist]);

  const startTour = useCallback(() => {
    if (E2E_AUTH_BYPASS) return;
    persist({ ...persisted, welcomeSeen: true, dismissed: false });
    setStepIndex(0);
    setPhase("tour");
    const first = TOUR_STEPS[0];
    if (first && pathname !== first.href) router.push(first.href);
  }, [persist, persisted, pathname, router]);

  const restartTour = useCallback(() => {
    if (E2E_AUTH_BYPASS) return;
    persist({ welcomeSeen: true, dismissed: false, completed: false });
    setStepIndex(0);
    setPhase("tour");
    const first = TOUR_STEPS[0];
    if (first) router.push(first.href);
  }, [persist, router]);

  const goToStep = useCallback(
    (index: number) => {
      const step = TOUR_STEPS[index];
      if (!step) return;
      setStepIndex(index);
      if (pathname !== step.href && !pathname.startsWith(`${step.href}/`)) {
        router.push(step.href);
      }
    },
    [pathname, router]
  );

  const nextStep = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      persist({ welcomeSeen: true, dismissed: true, completed: true });
      setPhase("done");
      return;
    }
    goToStep(stepIndex + 1);
  }, [stepIndex, goToStep, persist]);

  const prevStep = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  const value = useMemo(
    () => ({
      phase,
      stepIndex,
      startTour,
      skipTour,
      nextStep,
      prevStep,
      restartTour,
    }),
    [phase, stepIndex, startTour, skipTour, nextStep, prevStep, restartTour]
  );

  const currentStep = TOUR_STEPS[stepIndex];

  return (
    <ProductTourContext.Provider value={value}>
      {children}
      {ready && phase === "welcome" && (
        <WelcomeModal onStart={startTour} onSkip={skipTour} />
      )}
      {ready && phase === "tour" && currentStep && (
        <TourTooltip
          step={currentStep}
          stepIndex={stepIndex}
          total={TOUR_STEPS.length}
          onNext={nextStep}
          onBack={prevStep}
          onSkip={skipTour}
        />
      )}
    </ProductTourContext.Provider>
  );
}

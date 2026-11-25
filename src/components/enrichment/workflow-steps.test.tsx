import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkflowSteps } from "./capture-queue-parts";
import { jobProgress, stepSummary, workflowSteps, type CaptureJob } from "@/lib/capture-queue";

vi.mock("@/lib/api-client", () => ({ useApiFetch: () => vi.fn(), formatQueryError: (e: unknown, f: string) => f }));
vi.mock("@/lib/extension-connect", () => ({ continueCaptureQueueInExtension: vi.fn(), detectExtension: vi.fn() }));

afterEach(cleanup);
type WorkflowJob = Pick<CaptureJob, "step" | "stepDetail" | "state" | "complete" | "peopleFound" | "expectedPeople">;
const job = (overrides: Partial<WorkflowJob>): WorkflowJob => ({ state: "running", complete: false, peopleFound: 0, expectedPeople: null, step: "company", stepDetail: {}, ...overrides });

describe("company workflow steps", () => {
  it("lists the four steps in order, marking the one in progress", () => {
    const steps = workflowSteps(job({ step: "jobs", stepDetail: { company: { status: "done" } } }));
    expect(steps.map((step) => [step.key, step.result.status, step.current])).toEqual([
      ["company", "done", false], ["jobs", "running", true], ["people", "pending", false], ["verify", "pending", false],
    ]);
    expect(workflowSteps({ state: "running" })).toEqual([]);
  });

  it("summarises the step a job is on, and nothing once it is finished", () => {
    expect(stepSummary({ step: "people", state: "running" })).toBe("Step 3 of 4 · Employees");
    expect(stepSummary({ step: "verify", state: "completed" })).toBeNull();
    expect(stepSummary({ step: "verify", state: "partial" })).toBeNull();
    expect(stepSummary({ step: null, state: "running" })).toBeNull();
  });

  it("measures a workflow by its steps, and is 100 only when the job is completed", () => {
    expect(jobProgress(job({ stepDetail: { company: { status: "done" } } }))).toBe(25);
    expect(jobProgress(job({ step: "people", stepDetail: { company: { status: "done" }, jobs: { status: "partial" } }, peopleFound: 500, expectedPeople: 1000 }))).toBe(61);
    expect(jobProgress(job({ step: "verify", stepDetail: { company: { status: "done" }, jobs: { status: "done" }, people: { status: "done" }, verify: { status: "running" } } }))).toBe(75);
    expect(jobProgress(job({ state: "completed", step: "verify" }))).toBe(100);
    // A people-only job is measured as before.
    expect(jobProgress({ state: "running", complete: false, peopleFound: 240, expectedPeople: 960 })).toBe(25);
  });

  it("shows each step's status, counts, errors and notes", () => {
    render(
      <WorkflowSteps job={{ state: "partial", step: "verify", stepDetail: {
        company: { status: "done" },
        jobs: { status: "partial", found: 40, updated: 3, failed: 1, note: "60 remaining; a retry resumes the scan." },
        people: { status: "failed", captured: 250, duplicates: 12, refused: 2, error: "LinkedIn stopped showing results" },
        verify: { status: "done", found: 40, captured: 250 },
      } }} />
    );
    const list = screen.getByRole("list", { name: "Capture workflow steps" });
    expect(within(screen.getByTestId("step-company")).getByText("Done")).toBeTruthy();
    const jobs = screen.getByTestId("step-jobs");
    expect(within(jobs).getByText("Partial")).toBeTruthy();
    expect(within(jobs).getByText("40 found · 3 updated · 1 failed")).toBeTruthy();
    expect(within(jobs).getByText(/a retry resumes the scan/)).toBeTruthy();
    const people = screen.getByTestId("step-people");
    expect(within(people).getByText("Failed")).toBeTruthy();
    expect(within(people).getByText("250 captured · 12 duplicates · 2 refused")).toBeTruthy();
    expect(within(people).getByText("LinkedIn stopped showing results")).toBeTruthy();
    expect(within(screen.getByTestId("step-verify")).getByText("40 roles · 250 people in the workspace")).toBeTruthy();
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders nothing for a people-only job", () => {
    const { container } = render(<WorkflowSteps job={{ state: "running" }} />);
    expect(container.firstChild).toBeNull();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/ai/dexter-chat", () => ({ DexterChat: () => <div>dexter chat</div> }));

import { WorkspaceAiChat } from "./workspace-ai-chat";

function renderChat(features?: Record<string, boolean>) {
  const client = new QueryClient();
  if (features) client.setQueryData(["access"], { status: "active", features, request: null });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceAiChat />
    </QueryClientProvider>
  );
}

describe("WorkspaceAiChat — AI switch", () => {
  afterEach(() => cleanup());

  it("shows Dexter when AI is on", () => {
    renderChat({ ai: true });
    expect(screen.getByText("dexter chat")).toBeTruthy();
  });

  it("hides Dexter when AI isn't on the plan", () => {
    renderChat({ ai: false });
    expect(screen.queryByText("dexter chat")).toBeNull();
  });
});

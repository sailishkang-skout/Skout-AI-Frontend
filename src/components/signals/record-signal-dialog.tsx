"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError } from "@/lib/api-client";
import { ACCOUNT_SIGNALS_QUERY_KEY, useSignalsApi } from "@/lib/signals";

const SIGNAL_TYPE_OPTIONS = [
  { value: "recent_funding", label: "💰 Recent Funding" },
  { value: "recent_hiring", label: "📈 Recent Hiring / Expansion" },
  { value: "leadership_change", label: "👤 Leadership Change" },
  { value: "tech_adopted", label: "🔧 Tech Adopted" },
  { value: "product_launch", label: "🚀 Product Launch" },
  { value: "market_expansion", label: "🌐 Market Expansion" },
  { value: "new_office", label: "🏢 New Office" },
  { value: "acquisition", label: "🤝 Acquisition" },
  { value: "budget_freeze", label: "🧊 Budget Freeze (Risk)" },
  { value: "engagement_decay", label: "⚠️ Engagement Decay (Risk)" },
  { value: "negative_sentiment", label: "⚠️ Negative Sentiment (Risk)" },
];

export function RecordSignalDialog({
  open,
  onClose,
  initialEntityId = "",
}: {
  open: boolean;
  onClose: () => void;
  initialEntityId?: string;
}) {
  const queryClient = useQueryClient();
  const signalsApi = useSignalsApi();

  const [entityId, setEntityId] = useState(initialEntityId);
  const [entityType, setEntityType] = useState<"company" | "prospect">("company");
  const [signalType, setSignalType] = useState("recent_funding");
  const [reason, setReason] = useState("");
  const [confidence, setConfidence] = useState("0.85");
  const [source, setSource] = useState("manual");
  const [activatePath, setActivatePath] = useState(true);
  const [addToListPath, setAddToListPath] = useState(false);
  const [enrollSeqPath, setEnrollSeqPath] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const paths: Array<"activate" | "add_to_list" | "enroll_sequence"> = [];
      if (activatePath) paths.push("activate");
      if (addToListPath) paths.push("add_to_list");
      if (enrollSeqPath) paths.push("enroll_sequence");

      return signalsApi.recordSignal({
        entityId: entityId.trim(),
        entityType,
        signalType,
        reason: reason.trim() || undefined,
        confidence: Number.parseFloat(confidence) || 0.8,
        source: source.trim() || "manual",
        activationPaths: paths,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_SIGNALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      onClose();
      setEntityId("");
      setReason("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Record Custom Intent Signal" description="Log a live buying trigger or risk signal for an account or prospect.">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {mutation.error && (
          <Alert variant="error" title="Could not record signal">
            {formatQueryError(mutation.error, "Failed to submit signal.")}
          </Alert>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Entity Type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="entityType"
                value="company"
                checked={entityType === "company"}
                onChange={() => setEntityType("company")}
                className="text-primary focus:ring-primary"
              />
              Company Account
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="entityType"
                value="prospect"
                checked={entityType === "prospect"}
                onChange={() => setEntityType("prospect")}
                className="text-primary focus:ring-primary"
              />
              Individual Prospect
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="entityId" className="text-xs font-medium text-muted-foreground">
            {entityType === "company" ? "Company ID / Domain / Name" : "Prospect ID / Email"}
          </label>
          <Input
            id="entityId"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder={entityType === "company" ? "e.g. acme.com or company-uuid" : "e.g. john@acme.com"}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signalType" className="text-xs font-medium text-muted-foreground">
            Signal Type
          </label>
          <Select id="signalType" value={signalType} onChange={(e) => setSignalType(e.target.value)}>
            {SIGNAL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reason" className="text-xs font-medium text-muted-foreground">
            Signal Details / Reason
          </label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Closed $15M Series B funding round, expanding sales team"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="confidence" className="text-xs font-medium text-muted-foreground">
              Confidence (0.0 to 1.0)
            </label>
            <Input
              id="confidence"
              type="number"
              step="0.05"
              min="0.1"
              max="1.0"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="source" className="text-xs font-medium text-muted-foreground">
              Signal Source
            </label>
            <Input
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. manual, linkedin, press"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-medium text-muted-foreground">Target Activation Paths</label>
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activatePath}
                onChange={(e) => setActivatePath(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Auto-activate account for outbound push</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addToListPath}
                onChange={(e) => setAddToListPath(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Add to intent target list</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enrollSeqPath}
                onChange={(e) => setEnrollSeqPath(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Trigger sequence enrollment workflow</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || !entityId.trim()}>
            {mutation.isPending ? "Saving..." : "Record Signal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

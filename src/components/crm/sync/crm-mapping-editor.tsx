"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2, Loader2, Plus, Save, TestTube2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import type {
  CrmConflictPolicy,
  CrmFieldMapping,
  CrmFieldTransform,
  CrmNullBehavior,
  CrmObjectMapping,
  CrmSyncDirection,
} from "@/types/api";

const CONFLICT_POLICIES: { value: CrmConflictPolicy; label: string }[] = [
  { value: "most_recent", label: "Most recent" },
  { value: "skout_wins", label: "Skout wins" },
  { value: "external_wins", label: "HubSpot wins" },
  { value: "manual_review", label: "Manual review" },
];

const DIRECTIONS: { value: CrmSyncDirection; label: string }[] = [
  { value: "bidirectional", label: "Both ways" },
  { value: "inbound", label: "HubSpot to Skout" },
  { value: "outbound", label: "Skout to HubSpot" },
];

const TRANSFORMS: { value: CrmFieldTransform; label: string }[] = [
  { value: "none", label: "None" },
  { value: "trim", label: "Trim" },
  { value: "lowercase", label: "Lowercase" },
  { value: "uppercase", label: "Uppercase" },
  { value: "number", label: "Number" },
];

const NULL_BEHAVIORS: { value: CrmNullBehavior; label: string }[] = [
  { value: "ignore", label: "Keep Skout value" },
  { value: "preserve", label: "Keep Skout value (explicit)" },
  { value: "overwrite", label: "Clear Skout value" },
];

/** The Skout fields the CRM sync owns; the API refuses a mapping onto any other field. */
const SYNCABLE_FIELDS: Record<"contact" | "deal", string[]> = {
  contact: ["firstName", "lastName", "email", "phone", "title"],
  deal: ["name", "amount"],
};

/** The API's validation messages for a refused save (422 details), or the error message. */
function errorLines(err: unknown): string[] {
  if (err instanceof ApiError) {
    const details = (err.body as { details?: unknown } | undefined)?.details;
    if (Array.isArray(details) && details.every((d) => typeof d === "string")) return details as string[];
  }
  return [err instanceof Error ? err.message : "Failed saving mapping configuration"];
}

export function CrmMappingEditor({ provider = "hubspot" }: { provider?: string }) {
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();
  const [activeEntity, setActiveEntity] = useState<"contact" | "deal">("contact");
  const [contactMapping, setContactMapping] = useState<CrmObjectMapping | null>(null);
  const [dealMapping, setDealMapping] = useState<CrmObjectMapping | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  // Test state
  const [showTest, setShowTest] = useState(false);
  const [testSampleJson, setTestSampleJson] = useState('{\n  "email": "JOHN.DOE@EXAMPLE.COM ",\n  "firstname": "John",\n  "lastname": "Doe"\n}');
  const [testDirection, setTestDirection] = useState<"inbound" | "outbound">("inbound");
  const [testResult, setTestResult] = useState<{ appliedFields?: string[]; output?: unknown } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const mappingsQuery = useQuery({
    queryKey: ["crm", provider, "mappings"],
    queryFn: () => crmApi.getMappings(provider),
  });

  useEffect(() => {
    if (mappingsQuery.data?.data?.mappings) {
      setContactMapping(mappingsQuery.data.data.mappings.contact);
      setDealMapping(mappingsQuery.data.data.mappings.deal);
    }
  }, [mappingsQuery.data]);

  const currentMapping = activeEntity === "contact" ? contactMapping : dealMapping;

  const saveMutation = useMutation({
    mutationFn: () =>
      crmApi.saveMappings(provider, {
        contact: contactMapping ?? undefined,
        deal: dealMapping ?? undefined,
      }),
    onSuccess: () => {
      setSaveSuccess(true);
      setSaveErrors([]);
      queryClient.invalidateQueries({ queryKey: ["crm", provider, "mappings"] });
      window.setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      setSaveErrors(errorLines(err));
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      let sampleData: Record<string, unknown> = {};
      try {
        sampleData = JSON.parse(testSampleJson);
      } catch {
        throw new Error("Invalid JSON in sample data input");
      }

      return crmApi.testMapping(provider, {
        entityType: activeEntity,
        direction: testDirection,
        sampleData,
        mapping: currentMapping ?? undefined,
      });
    },
    onSuccess: (res) => {
      setTestResult(res.data);
      setTestError(null);
    },
    onError: (err: unknown) => {
      setTestError(errorLines(err).join("\n"));
      setTestResult(null);
    },
  });

  const setCurrent = (updated: CrmObjectMapping) => {
    if (activeEntity === "contact") setContactMapping(updated);
    else setDealMapping(updated);
  };

  const updateField = (index: number, patch: Partial<CrmFieldMapping>) => {
    if (!currentMapping) return;
    const newFields = [...currentMapping.fields];
    newFields[index] = { ...newFields[index], ...patch };
    setCurrent({ ...currentMapping, fields: newFields });
  };

  const removeField = (index: number) => {
    if (!currentMapping) return;
    setCurrent({ ...currentMapping, fields: currentMapping.fields.filter((_, i) => i !== index) });
  };

  const usedFields = new Set(currentMapping?.fields.map((f) => f.internalField) ?? []);
  const freeFields = SYNCABLE_FIELDS[activeEntity].filter((f) => !usedFields.has(f));

  const addField = () => {
    if (!currentMapping || freeFields.length === 0) return;
    const newField: CrmFieldMapping = {
      id: `${activeEntity}_${freeFields[0]}_${Date.now()}`,
      internalField: freeFields[0],
      externalField: "",
      direction: "bidirectional",
      conflictPolicy: "most_recent",
      transform: "none",
      nullBehavior: "ignore",
    };
    setCurrent({ ...currentMapping, fields: [...currentMapping.fields, newField] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Code2 className="h-4 w-4 text-primary" />
              Field mappings
              {currentMapping && <Badge tone="muted">v{currentMapping.version}</Badge>}
            </CardTitle>
            <CardDescription>
              Which HubSpot property each Skout field syncs with, in which direction, and who wins a conflict.
              Saving creates a new version; mappings to HubSpot properties that do not exist are refused.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border bg-muted p-0.5 text-xs">
              {(["contact", "deal"] as const).map((entity) => (
                <button
                  key={entity}
                  type="button"
                  className={`rounded px-2.5 py-1 ${
                    activeEntity === entity
                      ? "bg-background font-medium text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setActiveEntity(entity);
                    setTestResult(null);
                  }}
                >
                  {entity === "contact" ? "Contacts" : "Deals"} (
                  {(entity === "contact" ? contactMapping : dealMapping)?.fields?.length ?? 0})
                </button>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowTest(!showTest)}>
              <TestTube2 className="mr-1.5 h-3.5 w-3.5" />
              {showTest ? "Hide test" : "Test mapping"}
            </Button>

            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !currentMapping}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {saveSuccess && <Alert variant="success">Mappings saved as a new version.</Alert>}
        {saveErrors.length > 0 && (
          <Alert variant="error">
            <p className="font-medium">The mappings were not saved:</p>
            <ul className="mt-1 list-disc pl-5">
              {saveErrors.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Alert>
        )}
        {mappingsQuery.isError && <Alert variant="error">{errorLines(mappingsQuery.error).join(" ")}</Alert>}

        {showTest && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-foreground">
              <span>Test the {activeEntity} mapping</span>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Test direction"
                  value={testDirection}
                  onChange={(e) => setTestDirection(e.target.value as "inbound" | "outbound")}
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="inbound">HubSpot to Skout</option>
                  <option value="outbound">Skout to HubSpot</option>
                </select>
                <Button size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                  Run test
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="crm-mapping-sample" className="mb-1 block font-medium text-muted-foreground">
                  Sample input (JSON)
                </label>
                <textarea
                  id="crm-mapping-sample"
                  value={testSampleJson}
                  onChange={(e) => setTestSampleJson(e.target.value)}
                  className="h-32 w-full rounded border border-border bg-background p-2 font-mono text-xs"
                />
              </div>

              <div>
                <span className="mb-1 block font-medium text-muted-foreground">Mapped output</span>
                {testError ? (
                  <div className="h-32 overflow-auto whitespace-pre-wrap rounded bg-destructive/10 p-2 font-mono text-destructive">
                    {testError}
                  </div>
                ) : testResult ? (
                  <div className="h-32 overflow-auto rounded border border-border bg-background p-2 font-mono text-xs">
                    <div className="mb-1 font-semibold text-green-600">
                      Applied fields: {testResult.appliedFields?.join(", ") || "none"}
                    </div>
                    <pre>{JSON.stringify(testResult.output, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center rounded border border-border p-2 text-muted-foreground">
                    Run the test to see the mapped output
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mappingsQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading mappings…
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted font-medium text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Skout field</th>
                    <th className="p-2.5">HubSpot property</th>
                    <th className="p-2.5">Direction</th>
                    <th className="p-2.5">Conflict policy</th>
                    <th className="p-2.5">Transform</th>
                    <th className="p-2.5">Blank in HubSpot</th>
                    <th className="w-10 p-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {currentMapping?.fields?.map((field, index) => {
                    const isProtected = field.isProtected;
                    const choices = SYNCABLE_FIELDS[activeEntity].filter(
                      (f) => f === field.internalField || !usedFields.has(f)
                    );

                    return (
                      <tr key={field.id || index} className="hover:bg-muted/20">
                        <td className="p-2.5">
                          <select
                            aria-label="Skout field"
                            value={field.internalField}
                            onChange={(e) => updateField(index, { internalField: e.target.value })}
                            disabled={isProtected}
                            className="h-8 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                          >
                            {choices.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5">
                          <Input
                            aria-label="HubSpot property"
                            value={field.externalField}
                            onChange={(e) => updateField(index, { externalField: e.target.value })}
                            placeholder="e.g. jobtitle"
                            className="h-8 font-mono text-xs"
                          />
                        </td>

                        <td className="p-2.5">
                          <select
                            aria-label="Direction"
                            value={field.direction}
                            onChange={(e) => updateField(index, { direction: e.target.value as CrmSyncDirection })}
                            className="h-8 rounded border border-border bg-background px-2 py-1 text-xs"
                          >
                            {DIRECTIONS.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5">
                          <select
                            aria-label="Conflict policy"
                            value={field.conflictPolicy ?? "most_recent"}
                            onChange={(e) => updateField(index, { conflictPolicy: e.target.value as CrmConflictPolicy })}
                            className="h-8 rounded border border-border bg-background px-2 py-1 text-xs"
                          >
                            {CONFLICT_POLICIES.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5">
                          <select
                            aria-label="Transform"
                            value={field.transform ?? "none"}
                            onChange={(e) => updateField(index, { transform: e.target.value as CrmFieldTransform })}
                            className="h-8 rounded border border-border bg-background px-2 py-1 text-xs"
                          >
                            {TRANSFORMS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5">
                          <select
                            aria-label="Blank in HubSpot"
                            value={field.nullBehavior ?? "ignore"}
                            onChange={(e) => updateField(index, { nullBehavior: e.target.value as CrmNullBehavior })}
                            className="h-8 rounded border border-border bg-background px-2 py-1 text-xs"
                          >
                            {NULL_BEHAVIORS.map((n) => (
                              <option key={n.value} value={n.value}>
                                {n.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5 text-center">
                          {!isProtected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Remove ${field.internalField}`}
                              onClick={() => removeField(index)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button size="sm" variant="outline" onClick={addField} disabled={freeFields.length === 0} className="text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add field
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

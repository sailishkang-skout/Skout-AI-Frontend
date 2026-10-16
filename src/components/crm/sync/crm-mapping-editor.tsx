"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Code2, Loader2, Plus, RefreshCw, Save, TestTube2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCrmApi } from "@/lib/crm";
import type {
  CrmConflictPolicy,
  CrmFieldMapping,
  CrmFieldTransform,
  CrmObjectMapping,
} from "@/types/api";

const CONFLICT_POLICIES: { value: CrmConflictPolicy; label: string }[] = [
  { value: "most_recent", label: "Most Recent" },
  { value: "skout_wins", label: "Skout Wins" },
  { value: "external_wins", label: "External Wins" },
  { value: "manual_review", label: "Manual Review Queue" },
];

const DIRECTIONS: { value: CrmFieldMapping["direction"]; label: string }[] = [
  { value: "bi-directional", label: "Bi-directional" },
  { value: "inbound", label: "Inbound Only" },
  { value: "outbound", label: "Outbound Only" },
];

const TRANSFORMS: { value: CrmFieldTransform; label: string }[] = [
  { value: "none", label: "None" },
  { value: "lowercase", label: "Lowercase" },
  { value: "trim", label: "Trim" },
  { value: "cents_to_dollars", label: "Cents -> Dollars" },
  { value: "dollars_to_cents", label: "Dollars -> Cents" },
];

export function CrmMappingEditor({ provider = "hubspot" }: { provider?: string }) {
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();
  const [activeEntity, setActiveEntity] = useState<"contact" | "deal">("contact");
  const [contactMapping, setContactMapping] = useState<CrmObjectMapping | null>(null);
  const [dealMapping, setDealMapping] = useState<CrmObjectMapping | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Test state
  const [showTest, setShowTest] = useState(false);
  const [testSampleJson, setTestSampleJson] = useState('{\n  "email": "JOHN.DOE@EXAMPLE.COM ",\n  "firstname": "John",\n  "lastname": "Doe"\n}');
  const [testDirection, setTestDirection] = useState<"inbound" | "outbound">("inbound");
  const [testResult, setTestResult] = useState<any>(null);
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
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["crm", provider, "mappings"] });
      window.setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => {
      setSaveError(err.message || "Failed saving mapping configuration");
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
    onError: (err: any) => {
      setTestError(err.message || "Failed running transformation test");
      setTestResult(null);
    },
  });

  const updateField = (index: number, patch: Partial<CrmFieldMapping>) => {
    if (!currentMapping) return;
    const newFields = [...currentMapping.fields];
    newFields[index] = { ...newFields[index], ...patch };
    const updated = { ...currentMapping, fields: newFields };
    if (activeEntity === "contact") setContactMapping(updated);
    else setDealMapping(updated);
  };

  const removeField = (index: number) => {
    if (!currentMapping) return;
    const newFields = currentMapping.fields.filter((_, i) => i !== index);
    const updated = { ...currentMapping, fields: newFields };
    if (activeEntity === "contact") setContactMapping(updated);
    else setDealMapping(updated);
  };

  const addField = () => {
    if (!currentMapping) return;
    const newField: CrmFieldMapping = {
      internalField: "",
      externalField: "",
      direction: "bi-directional",
      conflictPolicy: "most_recent",
      transform: "none",
    };
    const updated = { ...currentMapping, fields: [...currentMapping.fields, newField] };
    if (activeEntity === "contact") setContactMapping(updated);
    else setDealMapping(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Code2 className="h-4 w-4 text-primary" />
              Field Mapping & Conflict Policy Engine
            </CardTitle>
            <CardDescription>
              Versioned mappings with transforms, directionality, and per-field conflict policies.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-muted p-0.5 text-xs">
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  activeEntity === "contact"
                    ? "bg-background font-medium text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setActiveEntity("contact");
                  setTestResult(null);
                }}
              >
                Contacts ({contactMapping?.fields?.length ?? 0})
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  activeEntity === "deal"
                    ? "bg-background font-medium text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setActiveEntity("deal");
                  setTestResult(null);
                }}
              >
                Deals ({dealMapping?.fields?.length ?? 0})
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTest(!showTest)}
            >
              <TestTube2 className="mr-1.5 h-3.5 w-3.5" />
              {showTest ? "Hide Test" : "Test Mappings"}
            </Button>

            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {saveSuccess && (
          <Alert variant="success">Mappings saved successfully.</Alert>
        )}
        {saveError && (
          <Alert variant="error">{saveError}</Alert>
        )}

        {/* Test Panel */}
        {showTest && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span>Test Transformation Engine ({activeEntity})</span>
              <div className="flex items-center gap-2">
                <select
                  value={testDirection}
                  onChange={(e) => setTestDirection(e.target.value as any)}
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="inbound">Inbound (External -&gt; Skout)</option>
                  <option value="outbound">Outbound (Skout -&gt; External)</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  Run Test
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-muted-foreground mb-1 block">Sample Input (JSON)</label>
                <textarea
                  value={testSampleJson}
                  onChange={(e) => setTestSampleJson(e.target.value)}
                  className="font-mono text-xs w-full h-32 rounded border border-border bg-background p-2"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground mb-1 block">Transformed Output</label>
                {testError ? (
                  <div className="text-destructive font-mono p-2 bg-destructive/10 rounded h-32 overflow-auto">
                    {testError}
                  </div>
                ) : testResult ? (
                  <div className="font-mono text-xs p-2 bg-background border border-border rounded h-32 overflow-auto">
                    <div className="text-green-600 font-semibold mb-1">
                      Applied fields: {testResult.appliedFields?.join(", ")}
                    </div>
                    <pre>{JSON.stringify(testResult.output, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="text-muted-foreground p-2 border border-border rounded h-32 flex items-center justify-center">
                    Click &quot;Run Test&quot; to see mapped output
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fields Table */}
        {mappingsQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading mappings…
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted font-medium text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2.5">Skout Field</th>
                    <th className="p-2.5">External Field</th>
                    <th className="p-2.5">Direction</th>
                    <th className="p-2.5">Conflict Policy</th>
                    <th className="p-2.5">Transform</th>
                    <th className="p-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {currentMapping?.fields?.map((field, index) => {
                    const isProtected = field.isProtected;

                    return (
                      <tr key={index} className="hover:bg-muted/20">
                        <td className="p-2.5">
                          <Input
                            size="sm"
                            value={field.internalField}
                            onChange={(e) => updateField(index, { internalField: e.target.value })}
                            disabled={isProtected}
                            placeholder="internalField"
                            className="text-xs h-8 font-mono"
                          />
                        </td>

                        <td className="p-2.5">
                          <Input
                            size="sm"
                            value={field.externalField}
                            onChange={(e) => updateField(index, { externalField: e.target.value })}
                            placeholder="externalField"
                            className="text-xs h-8 font-mono"
                          />
                        </td>

                        <td className="p-2.5">
                          <select
                            value={field.direction}
                            onChange={(e) => updateField(index, { direction: e.target.value as any })}
                            className="rounded border border-border bg-background px-2 py-1 text-xs h-8"
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
                            value={field.conflictPolicy ?? "most_recent"}
                            onChange={(e) =>
                              updateField(index, { conflictPolicy: e.target.value as any })
                            }
                            className="rounded border border-border bg-background px-2 py-1 text-xs h-8"
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
                            value={field.transform ?? "none"}
                            onChange={(e) => updateField(index, { transform: e.target.value as any })}
                            className="rounded border border-border bg-background px-2 py-1 text-xs h-8"
                          >
                            {TRANSFORMS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5 text-center">
                          {!isProtected && (
                            <Button
                              variant="ghost"
                              size="sm"
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

            <Button size="sm" variant="outline" onClick={addField} className="text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Field Mapping
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

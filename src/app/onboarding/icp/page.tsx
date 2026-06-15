"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiFetch } from "@/lib/api-client";

const INDUSTRIES = ["Software", "SaaS", "Fintech", "Healthcare", "E-commerce", "Marketing", "Consulting"];
const COUNTRIES = ["US", "CA", "GB", "AU", "DE", "IN", "SG"];
const SENIORITIES = ["c_level", "vp", "director", "manager"];

export default function IcpOnboardingPage() {
  const router = useRouter();
  const api = useApiFetch();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [industries, setIndustries] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [minEmployees, setMinEmployees] = useState("50");
  const [maxEmployees, setMaxEmployees] = useState("5000");

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await api("/api/v1/icp", {
        method: "PUT",
        body: JSON.stringify({
          industries,
          countries,
          seniorities,
          minEmployees: Number(minEmployees),
          maxEmployees: Number(maxEmployees),
        }),
      });
      router.push("/prospects/search");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Set up your ICP</CardTitle>
          <CardDescription>Step {step} of 3 — helps AI score your prospects</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm font-medium">Industries</p>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((i) => (
                  <button
                    key={i}
                    onClick={() => toggle(industries, setIndustries, i)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      industries.includes(i) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(2)}>Next</Button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm font-medium">Target Countries</p>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggle(countries, setCountries, c)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      countries.includes(c) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-sm font-medium pt-2">Seniority</p>
              <div className="flex flex-wrap gap-2">
                {SENIORITIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggle(seniorities, setSeniorities, s)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      seniorities.includes(s) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Next</Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm font-medium">Company Size (employees)</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Min</label>
                  <Input value={minEmployees} onChange={(e) => setMinEmployees(e.target.value)} type="number" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Max</label>
                  <Input value={maxEmployees} onChange={(e) => setMaxEmployees(e.target.value)} type="number" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving…" : "Finish Setup"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

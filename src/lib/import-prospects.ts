import { useApiFetch, useApiFetchBlob, apiFetchBlob } from "./api-client";

export interface ImportedProspectRow {
  fullName: string;
  companyDomain: string;
  email?: string;
  jobTitle?: string;
  companyName?: string;
  phone?: string;
  linkedinUrl?: string;
  country?: string;
  city?: string;
  /** Company-level field (e.g. from a separate "Accounts" sheet), preview-only — not persisted on commit. */
  companyRevenue?: string;
}

/** One parsed sheet/table's header detection — lets the UI show exactly what was found and build a manual mapping. */
export interface DetectedSheet {
  sheetName?: string;
  headers: string[];
  /** Original header text -> resolved target field (or "unmapped"). */
  mappedHeaders: Record<string, string>;
  rowCount: number;
  kind: "contacts" | "accounts" | "unknown";
}

export interface ParseImportResponse {
  data: {
    rows: ImportedProspectRow[];
    total: number;
    source: string;
    warnings: string[];
    sheets: DetectedSheet[];
  };
}

export interface CommitImportResponse {
  data: {
    imported: number;
    listId: string | null;
    listName: string | null;
    prospectIds: string[];
    skipped: number;
  };
}

/** Target fields a column can be mapped to in the manual column-mapping UI. */
export const IMPORT_TARGET_FIELDS: Array<{ value: string; label: string }> = [
  { value: "unmapped", label: "— Not mapped —" },
  { value: "fullName", label: "Full name" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "companyDomain", label: "Company domain / website" },
  { value: "companyName", label: "Company name" },
  { value: "jobTitle", label: "Job title" },
  { value: "phone", label: "Phone" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "companyRevenue", label: "Revenue (preview only)" },
  { value: "ignore", label: "Ignore this column" },
];

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Trigger a browser download for a Blob (used for the sample-template files). */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useImportApi() {
  const fetchApi = useApiFetch();
  const fetchBlob = useApiFetchBlob();

  return {
    parseFile: async (file: File, headerMap?: Record<string, string>) => {
      const base64 = await fileToBase64(file);
      return fetchApi<ParseImportResponse>("/api/v1/import/prospects/parse", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
          headerMap,
        }),
      });
    },

    commit: (input: {
      rows: ImportedProspectRow[];
      listId?: string;
      listName?: string;
      autoEnrich?: boolean;
    }) =>
      fetchApi<CommitImportResponse>("/api/v1/import/prospects", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    downloadSample: async (format: "csv" | "xlsx") => {
      const blob = await fetchBlob(`/api/v1/import/sample?format=${format}`);
      triggerBlobDownload(blob, `skout-import-sample.${format}`);
    },
  };
}

/** Non-hook variant for the admin page, which authenticates with a static bearer token instead of Clerk. */
export function downloadSampleWithToken(format: "csv" | "xlsx", authToken: string): Promise<void> {
  return apiFetchBlob(`/api/v1/import/sample?format=${format}`, { authToken }).then((blob) =>
    triggerBlobDownload(blob, `skout-import-sample.${format}`)
  );
}

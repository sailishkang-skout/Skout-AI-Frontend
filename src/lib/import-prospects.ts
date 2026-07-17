import { useApiFetch } from "./api-client";

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
}

export interface ParseImportResponse {
  data: {
    rows: ImportedProspectRow[];
    total: number;
    source: string;
    warnings: string[];
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

function fileToBase64(file: File): Promise<string> {
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

export function useImportApi() {
  const fetchApi = useApiFetch();

  return {
    parseFile: async (file: File) => {
      const base64 = await fileToBase64(file);
      return fetchApi<ParseImportResponse>("/api/v1/import/prospects/parse", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
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
  };
}

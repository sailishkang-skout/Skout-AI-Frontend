import { ApiError } from "./api-client";
import { useWorkspaceRole } from "./workspace-role";

/** Running columns and pushing to a CRM spend credits or send data out. Owners and admins hold this (WB2-014). */
export const WORKBOOK_RUN_PERMISSION = "enrichment.run";
/** Editing workbooks, cells, formulas and columns. Does not need the run permission. */
export const WORKBOOK_EDIT_PERMISSION = "enrichment:capture";

export const RUN_ACCESS_MESSAGE =
  "You don't have access to run columns or push to a CRM. Workspace owners and admins do; ask one of them.";

/**
 * What the signed-in person may do in Workbooks V2, for showing or hiding actions. Offer Run and CRM push actions
 * only when `canRun`; offer editing when `canEdit`. This is a hint: the API enforces both on every request, so a
 * run or push must still handle a 403 (see `isRunPermissionError`).
 */
export function useWorkbookPermissions() {
  const { hasPermission, permissions, isLoading } = useWorkspaceRole();
  return {
    canEdit: hasPermission(WORKBOOK_EDIT_PERMISSION),
    canRun: hasPermission(WORKBOOK_RUN_PERMISSION),
    /** False while permissions are loading or could not be read, so nothing is claimed about them. */
    known: !isLoading && permissions.size > 0,
  };
}

/** True when the API refused a request because the caller lacks `enrichment.run`, e.g. after a role change. */
export function isRunPermissionError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  const body = error.body as { details?: { requiredPermission?: unknown } | null } | undefined;
  return body?.details?.requiredPermission === WORKBOOK_RUN_PERMISSION;
}

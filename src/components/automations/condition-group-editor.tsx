"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CONDITION_OPS,
  CONDITION_TYPES,
  isConditionGroup,
  type ConditionGroup,
  type ConditionOp,
  type ConditionRule,
  type ConditionValueType,
} from "@/lib/automations";

const OP_LABELS: Record<ConditionOp, string> = {
  equals: "equals",
  not_equals: "does not equal",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  contains: "contains",
  not_contains: "does not contain",
  in: "is one of",
  not_in: "is not one of",
  exists: "has a value",
  not_exists: "is empty",
};
const NO_VALUE: ConditionOp[] = ["exists", "not_exists"];
const ORDERED: ConditionOp[] = ["gt", "gte", "lt", "lte"];

/** Operators that make sense for a type: ordering only for numbers and dates, text matching only for text. */
function opsFor(type: ConditionValueType): ConditionOp[] {
  return CONDITION_OPS.filter((op) => {
    if (ORDERED.includes(op)) return type === "number" || type === "date";
    if (op === "contains" || op === "not_contains") return type === "string";
    return true;
  });
}

const blankRule = (sourceNodeId: string): ConditionRule => ({ sourceNodeId, field: "", op: "equals", value: "", type: "string" });

/**
 * COPS-10: AND/OR condition groups with typed rules (Bible p.68). A rule reads a field (a dot
 * path such as account.tier) from an earlier step; a group can hold rules and nested groups.
 */
export function ConditionGroupEditor({
  group,
  onChange,
  priorNodes,
  depth = 0,
  onRemove,
}: {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  priorNodes: { id: string; label: string }[];
  depth?: number;
  onRemove?: () => void;
}) {
  const setRule = (i: number, next: ConditionRule | ConditionGroup) => onChange({ ...group, rules: group.rules.map((r, j) => (j === i ? next : r)) });
  const removeRule = (i: number) => onChange({ ...group, rules: group.rules.filter((_, j) => j !== i) });
  const firstSource = priorNodes[0]?.id ?? "";

  return (
    <div className={depth ? "space-y-2 rounded-md border border-dashed p-2" : "space-y-2"} data-testid={`condition-group-${depth}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Match</span>
        <Select
          aria-label="Match all or any"
          value={group.match}
          onChange={(e) => onChange({ ...group, match: e.target.value as ConditionGroup["match"] })}
          className="h-8 w-auto"
        >
          <option value="all">all of (AND)</option>
          <option value="any">any of (OR)</option>
        </Select>
        {onRemove && (
          <button type="button" onClick={onRemove} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Remove group">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {group.rules.length === 0 && <p className="text-xs text-muted-foreground">No rules yet: add one, or this condition never matches.</p>}

      {group.rules.map((rule, i) =>
        isConditionGroup(rule) ? (
          <ConditionGroupEditor
            key={i}
            group={rule}
            onChange={(g) => setRule(i, g)}
            priorNodes={priorNodes}
            depth={depth + 1}
            onRemove={() => removeRule(i)}
          />
        ) : (
          <RuleRow key={i} rule={rule} priorNodes={priorNodes} onChange={(r) => setRule(i, r)} onRemove={() => removeRule(i)} />
        )
      )}

      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...group, rules: [...group.rules, blankRule(firstSource)] })}>
          <Plus className="h-3.5 w-3.5" /> Rule
        </Button>
        {depth < 2 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...group, rules: [...group.rules, { match: group.match === "all" ? "any" : "all", rules: [blankRule(firstSource)] }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Group
          </Button>
        )}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  priorNodes,
  onChange,
  onRemove,
}: {
  rule: ConditionRule;
  priorNodes: { id: string; label: string }[];
  onChange: (rule: ConditionRule) => void;
  onRemove: () => void;
}) {
  const type = rule.type ?? "string";
  const ops = opsFor(type);
  const known = priorNodes.some((n) => n.id === rule.sourceNodeId);
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-md bg-muted/30 p-2 text-sm" data-testid="condition-rule">
      <Select aria-label="Step" value={rule.sourceNodeId} onChange={(e) => onChange({ ...rule, sourceNodeId: e.target.value })}>
        <option value="" disabled>
          {priorNodes.length ? "Earlier step" : "Connect an earlier step first"}
        </option>
        {priorNodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label}
          </option>
        ))}
        {rule.sourceNodeId && !known && <option value={rule.sourceNodeId}>{rule.sourceNodeId} (not connected)</option>}
      </Select>
      <Input aria-label="Field" value={rule.field} placeholder="account.tier" onChange={(e) => onChange({ ...rule, field: e.target.value })} />
      <Select
        aria-label="Type"
        value={type}
        onChange={(e) => {
          const nextType = e.target.value as ConditionValueType;
          onChange({ ...rule, type: nextType, op: opsFor(nextType).includes(rule.op) ? rule.op : "equals" });
        }}
      >
        {CONDITION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t === "string" ? "text" : t}
          </option>
        ))}
      </Select>
      <Select aria-label="Operator" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as ConditionOp })}>
        {ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </Select>
      {!NO_VALUE.includes(rule.op) &&
        (type === "boolean" ? (
          <Select aria-label="Value" value={String(rule.value ?? "true")} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        ) : (
          <Input
            aria-label="Value"
            type={type === "date" ? "date" : type === "number" ? "number" : "text"}
            value={String(rule.value ?? "")}
            placeholder={rule.op === "in" || rule.op === "not_in" ? "growth, enterprise" : ""}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
          />
        ))}
      <button type="button" onClick={onRemove} className="justify-self-end text-muted-foreground hover:text-destructive" aria-label="Remove rule">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export type AuditEvent = {
  id: string;
  timestamp: string;
  eventType:
    | "pie_run"
    | "brief_generated"
    | "review_run"
    | "review_decision"
    | "submission"
    | "notification";
  actor: string;
  details: Record<string, unknown>;
};

const AUDIT_KEY = "company_name_portal_audit_log_v1";

export function getAuditEvents(): AuditEvent[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
  const item: AuditEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };
  const current = getAuditEvents();
  current.push(item);
  localStorage.setItem(AUDIT_KEY, JSON.stringify(current));
  return item;
}

export function exportAuditJsonl(filename = "company-name-audit-log.jsonl") {
  const events = getAuditEvents();
  const jsonl = events.map((e) => JSON.stringify(e)).join("\n");
  const blob = new Blob([jsonl], { type: "application/x-ndjson;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

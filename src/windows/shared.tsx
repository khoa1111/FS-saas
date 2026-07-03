import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

export function useList<T extends { id: number }>(resource: string) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const showToast = useStore((s) => s.showToast);

  const reload = useCallback(() => {
    api
      .get<{ items: T[] }>(`/${resource}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [resource]);

  useEffect(reload, [reload]);

  async function create(body: Partial<T>) {
    setBusy(true);
    try {
      await api.post(`/${resource}`, body);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function update(id: number, body: Partial<T>) {
    try {
      await api.put(`/${resource}/${id}`, body);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function remove(id: number) {
    try {
      await api.del(`/${resource}/${id}`);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return { items, reload, create, update, remove, error, busy };
}

/** Push/pull the module's table to the linked Google Sheet. */
export function SheetsSync({ resource, onPulled }: { resource: string; onPulled?: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState<"push" | "pull" | null>(null);

  async function run(dir: "push" | "pull") {
    setBusy(dir);
    try {
      const r = await api.post<{ pushed?: number; updated?: number; inserted?: number }>(
        `/sheets/${resource}/${dir}`
      );
      showToast(
        dir === "push"
          ? `Pushed ${r.pushed} rows to Google Sheets`
          : `Pulled from Sheets — ${r.updated} updated, ${r.inserted} added`
      );
      if (dir === "pull") onPulled?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sheets sync failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="btn ghost sm" disabled={!!busy} onClick={() => run("push")}>
        {busy === "push" ? "Pushing…" : "⇡ Sheets push"}
      </button>
      <button className="btn ghost sm" disabled={!!busy} onClick={() => run("pull")}>
        {busy === "pull" ? "Pulling…" : "⇣ Sheets pull"}
      </button>
    </span>
  );
}

export const money = (n: number) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function StatusPill({ value }: { value: string }) {
  const map: Record<string, string> = {
    active: "green", done: "blue", paused: "amber", archived: "",
    todo: "", doing: "blue", pending: "amber", approved: "green", rejected: "red",
    lead: "amber", customer: "green", churned: "red",
    new: "", proposal: "amber", negotiation: "violet", won: "green", lost: "red",
    income: "green", expense: "orange",
    document: "blue", asset: "violet",
    high: "red", medium: "amber", low: ""
  };
  return <span className={`pill ${map[value] ?? ""}`}>{value}</span>;
}

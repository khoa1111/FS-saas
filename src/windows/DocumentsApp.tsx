import { FormEvent, useState } from "react";
import { useList, SheetsSync, StatusPill } from "./shared";
import { useStore } from "../store";

interface Doc {
  id: number;
  name: string;
  kind: string;
  category: string;
  url: string;
  note: string;
  owner: string;
  updated_at: string;
}

export default function DocumentsApp() {
  const { items, create, remove, update, reload, error } = useList<Doc>("documents");
  const user = useStore((s) => s.user)!;
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", kind: "document", category: "", url: "", note: "" });

  const filtered = items.filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q.toLowerCase()) ||
      d.category.toLowerCase().includes(q.toLowerCase()) ||
      d.note.toLowerCase().includes(q.toLowerCase())
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    await create({ ...form, owner: user.name } as Partial<Doc>);
    setForm({ name: "", kind: "document", category: "", url: "", note: "" });
  }

  return (
    <div>
      <div className="cards">
        <div className="card hi"><span className="mlabel">Vault items</span><div className="big">{items.length}</div></div>
        <div className="card"><span className="mlabel">Documents</span><div className="big">{items.filter((d) => d.kind === "document").length}</div></div>
        <div className="card"><span className="mlabel">Assets</span><div className="big">{items.filter((d) => d.kind === "asset").length}</div></div>
      </div>

      <div className="section">
        <h4>Register item <span className="mlabel"><SheetsSync resource="documents" onPulled={reload} /></span></h4>
        <form className="formrow" onSubmit={submit}>
          <div className="field wide">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Brand guidelines v4.pdf" required />
          </div>
          <div className="field">
            <label>Kind</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="document">document</option>
              <option value="asset">asset</option>
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="brand / legal / equipment" />
          </div>
          <div className="field wide">
            <label>Link (Drive, Figma…)</label>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="field wide">
            <label>Note</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <button className="btn orange">Store</button>
        </form>
      </div>

      <div className="section">
        <h4>
          Vault contents
          <span className="mlabel">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search…"
              style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "4px 9px", fontSize: 12 }}
            />
          </span>
        </h4>
        {error && <div className="err">{error}</div>}
        <table className="grid">
          <thead>
            <tr><th>Name</th><th>Kind</th><th>Category</th><th>Note</th><th>Owner</th><th>Updated</th><th /></tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 700 }}>
                  {d.url ? <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--cobalt)" }}>{d.name} ↗</a> : d.name}
                </td>
                <td><StatusPill value={d.kind} /></td>
                <td>{d.category}</td>
                <td style={{ color: "var(--ink-2)" }}>
                  <input defaultValue={d.note} onBlur={(e) => e.target.value !== d.note && update(d.id, { note: e.target.value } as Partial<Doc>)} />
                </td>
                <td>{d.owner}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{d.updated_at?.slice(0, 10)}</td>
                <td><button className="btn danger sm" onClick={() => remove(d.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

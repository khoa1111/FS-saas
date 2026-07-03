import { FormEvent, useState } from "react";
import { useList, SheetsSync, money, StatusPill } from "./shared";

interface Contact {
  id: number; name: string; company: string; email: string; phone: string; status: string; notes: string;
}
interface Deal {
  id: number; contact_id: number | null; title: string; value: number; stage: string; close_date: string;
}

const DEAL_STAGES = ["new", "proposal", "negotiation", "won", "lost"];

export default function CrmApp() {
  const contacts = useList<Contact>("contacts");
  const deals = useList<Deal>("deals");
  const [cForm, setCForm] = useState({ name: "", company: "", email: "", phone: "" });
  const [dForm, setDForm] = useState({ title: "", value: "", contact_id: "" });

  const pipeline = deals.items.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const wonValue = deals.items.filter((d) => d.stage === "won").reduce((s, d) => s + d.value, 0);
  const pipeValue = pipeline.reduce((s, d) => s + d.value, 0);

  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!cForm.name) return;
    await contacts.create({ ...cForm, status: "lead", notes: "" } as Partial<Contact>);
    setCForm({ name: "", company: "", email: "", phone: "" });
  }

  async function addDeal(e: FormEvent) {
    e.preventDefault();
    if (!dForm.title) return;
    await deals.create({
      title: dForm.title,
      value: parseFloat(dForm.value) || 0,
      contact_id: dForm.contact_id ? Number(dForm.contact_id) : null,
      stage: "new",
      close_date: ""
    } as Partial<Deal>);
    setDForm({ title: "", value: "", contact_id: "" });
  }

  const contactName = (id: number | null) => contacts.items.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="cards">
        <div className="card hi"><span className="mlabel">Pipeline value</span><div className="big">{money(pipeValue)}</div></div>
        <div className="card"><span className="mlabel">Won · all time</span><div className="big" style={{ color: "#0d7a48" }}>{money(wonValue)}</div></div>
        <div className="card"><span className="mlabel">Contacts</span><div className="big">{contacts.items.length}</div></div>
        <div className="card"><span className="mlabel">Leads</span><div className="big">{contacts.items.filter((c) => c.status === "lead").length}</div></div>
      </div>

      <div className="section">
        <h4>Deals <span className="mlabel"><SheetsSync resource="deals" onPulled={deals.reload} /></span></h4>
        <form className="formrow" onSubmit={addDeal}>
          <div className="field wide"><label>Deal</label><input value={dForm.title} onChange={(e) => setDForm({ ...dForm, title: e.target.value })} placeholder="Packaging system — Mori" required /></div>
          <div className="field"><label>Value</label><input type="number" value={dForm.value} onChange={(e) => setDForm({ ...dForm, value: e.target.value })} /></div>
          <div className="field">
            <label>Contact</label>
            <select value={dForm.contact_id} onChange={(e) => setDForm({ ...dForm, contact_id: e.target.value })}>
              <option value="">—</option>
              {contacts.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn orange">Add deal</button>
        </form>
        <table className="grid">
          <thead><tr><th>Deal</th><th>Contact</th><th className="num">Value</th><th>Stage</th><th /></tr></thead>
          <tbody>
            {deals.items.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 700 }}>{d.title}</td>
                <td>{contactName(d.contact_id)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{money(d.value)}</td>
                <td>
                  <select value={d.stage} onChange={(e) => deals.update(d.id, { stage: e.target.value } as Partial<Deal>)} style={{ width: 110 }}>
                    {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><button className="btn danger sm" onClick={() => deals.remove(d.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h4>Contacts <span className="mlabel"><SheetsSync resource="contacts" onPulled={contacts.reload} /></span></h4>
        <form className="formrow" onSubmit={addContact}>
          <div className="field wide"><label>Name</label><input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} required /></div>
          <div className="field"><label>Company</label><input value={cForm.company} onChange={(e) => setCForm({ ...cForm, company: e.target.value })} /></div>
          <div className="field"><label>Email</label><input value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={cForm.phone} onChange={(e) => setCForm({ ...cForm, phone: e.target.value })} /></div>
          <button className="btn">Add contact</button>
        </form>
        <table className="grid">
          <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th><th>Notes</th><th /></tr></thead>
          <tbody>
            {contacts.items.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 700 }}>{c.name}</td>
                <td>{c.company}</td>
                <td style={{ color: "var(--ink-2)" }}>{c.email}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{c.phone}</td>
                <td>
                  <select value={c.status} onChange={(e) => contacts.update(c.id, { status: e.target.value } as Partial<Contact>)} style={{ width: 100 }}>
                    <option value="lead">lead</option>
                    <option value="customer">customer</option>
                    <option value="churned">churned</option>
                  </select>
                </td>
                <td><input defaultValue={c.notes} onBlur={(e) => e.target.value !== c.notes && contacts.update(c.id, { notes: e.target.value } as Partial<Contact>)} /></td>
                <td><button className="btn danger sm" onClick={() => contacts.remove(c.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

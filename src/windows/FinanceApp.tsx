import { FormEvent, useMemo, useState } from "react";
import { useList, SheetsSync, money, StatusPill } from "./shared";
import { useStore } from "../store";

interface Tx {
  id: number;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  created_by: string;
}

// dataviz-validated categorical pair on white: cobalt / orange
const C_IN = "#2447f0";
const C_EX = "#eb6834";

interface Tip {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

function monthKey(date: string) {
  return date.slice(0, 7);
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

export default function FinanceApp() {
  const { items, create, remove, reload, error } = useList<Tx>("transactions");
  const user = useStore((s) => s.user)!;
  const [tip, setTip] = useState<Tip | null>(null);
  const [form, setForm] = useState({ type: "income", category: "", description: "", amount: "" });

  const { months, totals } = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const agg = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]));
    let income = 0;
    let expense = 0;
    for (const t of items) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
      const bucket = agg.get(monthKey(t.date));
      if (bucket) bucket[t.type] += t.amount;
    }
    return { months: keys.map((k) => ({ key: k, ...agg.get(k)! })), totals: { income, expense } };
  }, [items]);

  const maxVal = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || !form.description) return;
    await create({
      date: new Date().toISOString().slice(0, 10),
      type: form.type as Tx["type"],
      category: form.category || "general",
      description: form.description,
      amount,
      created_by: user.name
    } as Partial<Tx>);
    setForm({ ...form, description: "", amount: "" });
  }

  // chart geometry
  const W = 640;
  const H = 200;
  const PAD = { l: 44, r: 10, t: 12, b: 24 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const groupW = plotW / months.length;
  const barW = 16;
  const y = (v: number) => PAD.t + plotH * (1 - v / maxVal);

  return (
    <div className="viz-root">
      <div className="cards">
        <div className="card hi">
          <span className="mlabel">Net balance</span>
          <div className="big">{money(totals.income - totals.expense)}</div>
        </div>
        <div className="card">
          <span className="mlabel">Income · all time</span>
          <div className="big" style={{ color: "#0d7a48" }}>{money(totals.income)}</div>
        </div>
        <div className="card">
          <span className="mlabel">Expenses · all time</span>
          <div className="big" style={{ color: "#cc5210" }}>{money(totals.expense)}</div>
        </div>
        <div className="card">
          <span className="mlabel">Entries</span>
          <div className="big">{items.length}</div>
        </div>
      </div>

      <div className="section">
        <h4>
          Cashflow · last 6 months
          <span className="mlabel"><SheetsSync resource="transactions" onPulled={reload} /></span>
        </h4>
        <div className="legend">
          <span><i style={{ background: C_IN }} /> Income</span>
          <span><i style={{ background: C_EX }} /> Expense</span>
        </div>
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} onMouseLeave={() => setTip(null)}>
            {/* gridlines */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(maxVal * f)} y2={y(maxVal * f)} stroke="var(--grid-hairline)" strokeWidth="1" />
                <text x={PAD.l - 6} y={y(maxVal * f) + 3} textAnchor="end" fontSize="9" fontFamily="var(--mono)" fill="var(--axis-ink)">
                  {maxVal * f >= 1000 ? `${Math.round((maxVal * f) / 100) / 10}k` : Math.round(maxVal * f)}
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--axis-ink)" strokeWidth="1" />

            {months.map((m, i) => {
              const cx = PAD.l + groupW * i + groupW / 2;
              return (
                <g key={m.key}>
                  {/* 2px surface gap between adjacent bars */}
                  <rect
                    x={cx - barW - 1} width={barW} y={y(m.income)} height={Math.max(0, y(0) - y(m.income))}
                    rx="3" fill={C_IN}
                    onMouseMove={(e) => {
                      const r = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                      setTip({ x: e.clientX - r.left, y: e.clientY - r.top, title: monthLabel(m.key), lines: [`Income ${money(m.income)}`] });
                    }}
                  />
                  <rect
                    x={cx + 1} width={barW} y={y(m.expense)} height={Math.max(0, y(0) - y(m.expense))}
                    rx="3" fill={C_EX}
                    onMouseMove={(e) => {
                      const r = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                      setTip({ x: e.clientX - r.left, y: e.clientY - r.top, title: monthLabel(m.key), lines: [`Expense ${money(m.expense)}`] });
                    }}
                  />
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="9.5" fontFamily="var(--mono)" fill="var(--axis-ink)">
                    {monthLabel(m.key).toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
          {tip && (
            <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
              <span className="mlabel">{tip.title}</span>
              {tip.lines.map((l) => <div key={l}>{l}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h4>Add entry</h4>
        <form className="formrow" onSubmit={submit}>
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="income">income</option>
              <option value="expense">expense</option>
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="client work" />
          </div>
          <div className="field wide">
            <label>Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Invoice #12 — Aurora" required />
          </div>
          <div className="field">
            <label>Amount</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <button className="btn orange">Add</button>
        </form>
      </div>

      <div className="section">
        <h4>Ledger <span className="mlabel">{items.length} entries</span></h4>
        {error && <div className="err">{error}</div>}
        <table className="grid">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th className="num">Amount</th><th>By</th><th /></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{t.date}</td>
                <td><StatusPill value={t.type} /></td>
                <td>{t.category}</td>
                <td>{t.description}</td>
                <td className="num" style={{ fontWeight: 700, color: t.type === "income" ? "#0d7a48" : "#cc5210" }}>
                  {t.type === "income" ? "+" : "−"}{money(t.amount)}
                </td>
                <td>{t.created_by}</td>
                <td><button className="btn danger sm" onClick={() => remove(t.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

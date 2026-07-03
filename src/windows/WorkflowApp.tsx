import { FormEvent, useState } from "react";
import { useList, SheetsSync } from "./shared";

interface Workflow {
  id: number; name: string; stages: string;
}
interface Item {
  id: number; workflow_id: number; title: string; stage: string; assignee: string; updated_at: string;
}

export default function WorkflowApp() {
  const flows = useList<Workflow>("workflows");
  const items = useList<Item>("workflow_items");
  const [selected, setSelected] = useState<number | null>(null);
  const [wfName, setWfName] = useState("");
  const [wfStages, setWfStages] = useState("Intake, In Progress, Review, Done");
  const [itemForm, setItemForm] = useState({ title: "", assignee: "" });

  const sel = flows.items.find((f) => f.id === selected) ?? flows.items[0];
  const stages: string[] = sel ? JSON.parse(sel.stages || "[]") : [];
  const selItems = items.items.filter((i) => sel && i.workflow_id === sel.id);

  async function addFlow(e: FormEvent) {
    e.preventDefault();
    if (!wfName) return;
    const stagesArr = wfStages.split(",").map((s) => s.trim()).filter(Boolean);
    await flows.create({ name: wfName, stages: JSON.stringify(stagesArr.length ? stagesArr : ["Intake", "Done"]) } as Partial<Workflow>);
    setWfName("");
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!itemForm.title || !sel) return;
    await items.create({ workflow_id: sel.id, ...itemForm, stage: stages[0] || "Intake" } as Partial<Item>);
    setItemForm({ title: "", assignee: "" });
  }

  function move(item: Item, dir: 1 | -1) {
    const i = stages.indexOf(item.stage);
    const next = stages[i + dir];
    if (next) items.update(item.id, { stage: next } as Partial<Item>);
  }

  return (
    <div>
      <div className="section">
        <h4>Pipelines <span className="mlabel"><SheetsSync resource="workflow_items" onPulled={items.reload} /></span></h4>
        <div className="formrow" style={{ marginBottom: 10 }}>
          {flows.items.map((f) => (
            <button
              key={f.id}
              className={`btn sm ${sel?.id === f.id ? "" : "ghost"}`}
              onClick={() => setSelected(f.id)}
              type="button"
            >
              {f.name}
            </button>
          ))}
        </div>
        <form className="formrow" onSubmit={addFlow}>
          <div className="field wide"><label>New pipeline</label><input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="Print production" /></div>
          <div className="field wide"><label>Stages (comma-separated)</label><input value={wfStages} onChange={(e) => setWfStages(e.target.value)} /></div>
          <button className="btn">Create</button>
          {sel && flows.items.length > 1 && (
            <button type="button" className="btn danger" onClick={() => { flows.remove(sel.id); setSelected(null); }}>
              Delete current
            </button>
          )}
        </form>
      </div>

      {sel && (
        <div className="section">
          <h4>{sel.name} — conveyor <span className="mlabel">{selItems.length} items</span></h4>
          <form className="formrow" onSubmit={addItem}>
            <div className="field wide"><label>Work item</label><input value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} required /></div>
            <div className="field"><label>Assignee</label><input value={itemForm.assignee} onChange={(e) => setItemForm({ ...itemForm, assignee: e.target.value })} /></div>
            <button className="btn orange">Feed the line</button>
          </form>
          <div className="kanban">
            {stages.map((stage, si) => (
              <div className="kcol" key={stage} style={si === stages.length - 1 ? { borderTopColor: "var(--good)" } : undefined}>
                <h5>{stage} <span>{selItems.filter((i) => i.stage === stage).length}</span></h5>
                {selItems.filter((i) => i.stage === stage).map((i) => (
                  <div className="kcard" key={i.id}>
                    {i.title}
                    <div className="who">{i.assignee || "unassigned"}</div>
                    <div className="movers">
                      {si > 0 && <button onClick={() => move(i, -1)}>◀</button>}
                      {si < stages.length - 1 && <button onClick={() => move(i, 1)}>▶</button>}
                      <button onClick={() => items.remove(i.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { FormEvent, useState } from "react";
import { useList, SheetsSync, StatusPill } from "./shared";

interface Project {
  id: number; name: string; status: string; owner: string; deadline: string; progress: number;
}
interface Task {
  id: number; project_id: number; title: string; assignee: string; status: string; priority: string; due: string;
}

const TASK_COLS = ["todo", "doing", "done"] as const;

export default function ProjectsApp() {
  const projects = useList<Project>("projects");
  const tasks = useList<Task>("tasks");
  const [selected, setSelected] = useState<number | null>(null);
  const [pForm, setPForm] = useState({ name: "", owner: "", deadline: "" });
  const [tForm, setTForm] = useState({ title: "", assignee: "", priority: "medium", due: "" });

  const sel = projects.items.find((p) => p.id === selected) ?? projects.items[0];
  const selTasks = tasks.items.filter((t) => sel && t.project_id === sel.id);

  async function addProject(e: FormEvent) {
    e.preventDefault();
    if (!pForm.name) return;
    await projects.create({ ...pForm, status: "active", progress: 0 } as Partial<Project>);
    setPForm({ name: "", owner: "", deadline: "" });
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!tForm.title || !sel) return;
    await tasks.create({ project_id: sel.id, ...tForm, status: "todo" } as Partial<Task>);
    setTForm({ title: "", assignee: "", priority: "medium", due: "" });
  }

  function moveTask(t: Task, dir: 1 | -1) {
    const i = TASK_COLS.indexOf(t.status as (typeof TASK_COLS)[number]);
    const next = TASK_COLS[i + dir];
    if (next) tasks.update(t.id, { status: next } as Partial<Task>);
  }

  return (
    <div>
      <div className="cards">
        <div className="card hi"><span className="mlabel">Active sprints</span><div className="big">{projects.items.filter((p) => p.status === "active").length}</div></div>
        <div className="card"><span className="mlabel">Open tasks</span><div className="big">{tasks.items.filter((t) => t.status !== "done").length}</div></div>
        <div className="card"><span className="mlabel">Done tasks</span><div className="big">{tasks.items.filter((t) => t.status === "done").length}</div></div>
      </div>

      <div className="section">
        <h4>Projects <span className="mlabel"><SheetsSync resource="projects" onPulled={projects.reload} /></span></h4>
        <form className="formrow" onSubmit={addProject}>
          <div className="field wide"><label>Name</label><input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} required /></div>
          <div className="field"><label>Owner</label><input value={pForm.owner} onChange={(e) => setPForm({ ...pForm, owner: e.target.value })} /></div>
          <div className="field"><label>Deadline</label><input type="date" value={pForm.deadline} onChange={(e) => setPForm({ ...pForm, deadline: e.target.value })} /></div>
          <button className="btn orange">Create</button>
        </form>
        <table className="grid">
          <thead><tr><th /><th>Project</th><th>Owner</th><th>Deadline</th><th>Status</th><th style={{ width: 160 }}>Progress</th><th /></tr></thead>
          <tbody>
            {projects.items.map((p) => (
              <tr key={p.id} style={sel?.id === p.id ? { outline: "2px solid var(--cobalt)", outlineOffset: -2 } : undefined}>
                <td><button className="btn ghost sm" onClick={() => setSelected(p.id)}>{sel?.id === p.id ? "●" : "○"}</button></td>
                <td style={{ fontWeight: 700 }}>{p.name}</td>
                <td>{p.owner}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.deadline || "—"}</td>
                <td>
                  <select value={p.status} onChange={(e) => projects.update(p.id, { status: e.target.value } as Partial<Project>)} style={{ width: 90 }}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="done">done</option>
                  </select>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="progress" style={{ flex: 1 }}><i style={{ width: `${p.progress}%` }} /></div>
                    <input
                      type="number" min={0} max={100} defaultValue={p.progress}
                      style={{ width: 52, border: "1px solid var(--line)", borderRadius: 6, padding: "2px 5px" }}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value)));
                        if (v !== p.progress) projects.update(p.id, { progress: v } as Partial<Project>);
                      }}
                    />
                  </div>
                </td>
                <td><button className="btn danger sm" onClick={() => projects.remove(p.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="section">
          <h4>Task board — {sel.name} <span className="mlabel">{selTasks.length} tasks</span></h4>
          <form className="formrow" onSubmit={addTask}>
            <div className="field wide"><label>Task</label><input value={tForm.title} onChange={(e) => setTForm({ ...tForm, title: e.target.value })} required /></div>
            <div className="field"><label>Assignee</label><input value={tForm.assignee} onChange={(e) => setTForm({ ...tForm, assignee: e.target.value })} /></div>
            <div className="field">
              <label>Priority</label>
              <select value={tForm.priority} onChange={(e) => setTForm({ ...tForm, priority: e.target.value })}>
                <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
              </select>
            </div>
            <div className="field"><label>Due</label><input type="date" value={tForm.due} onChange={(e) => setTForm({ ...tForm, due: e.target.value })} /></div>
            <button className="btn">Add task</button>
          </form>
          <div className="kanban">
            {TASK_COLS.map((col) => (
              <div className="kcol" key={col}>
                <h5>{col} <span>{selTasks.filter((t) => t.status === col).length}</span></h5>
                {selTasks.filter((t) => t.status === col).map((t) => (
                  <div className="kcard" key={t.id}>
                    {t.title} <StatusPill value={t.priority} />
                    <div className="who">{t.assignee || "unassigned"}{t.due ? ` · due ${t.due}` : ""}</div>
                    <div className="movers">
                      {col !== "todo" && <button onClick={() => moveTask(t, -1)}>◀</button>}
                      {col !== "done" && <button onClick={() => moveTask(t, 1)}>▶</button>}
                      <button onClick={() => tasks.remove(t.id)}>✕</button>
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

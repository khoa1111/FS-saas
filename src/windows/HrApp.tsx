import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useList, SheetsSync, money, StatusPill } from "./shared";
import { useStore } from "../store";

interface Employee {
  id: number; name: string; role: string; department: string; email: string; salary: number; status: string;
}
interface Leave {
  id: number; employee: string; from_date: string; to_date: string; reason: string; status: string;
}
interface AttRow {
  id: number; user_id: number; name: string; date: string; check_in: string | null; check_out: string | null;
}

export default function HrApp() {
  const emp = useList<Employee>("employees");
  const leave = useList<Leave>("leave_requests");
  const user = useStore((s) => s.user)!;
  const showToast = useStore((s) => s.showToast);

  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [today, setToday] = useState<{ check_in: string | null; check_out: string | null } | null>(null);
  const [empForm, setEmpForm] = useState({ name: "", role: "", department: "", email: "", salary: "" });
  const [leaveForm, setLeaveForm] = useState({ from_date: "", to_date: "", reason: "" });

  const loadAttendance = () => {
    api.get<{ items: AttRow[] }>("/hr/attendance").then((r) => setAttendance(r.items)).catch(() => {});
    api.get<{ today: { check_in: string | null; check_out: string | null } | null }>("/hr/my-attendance")
      .then((r) => setToday(r.today)).catch(() => {});
  };
  useEffect(loadAttendance, []);

  async function punch() {
    try {
      const r = await api.post<{ action: string; time?: string }>("/hr/checkin");
      showToast(
        r.action === "checked_in" ? `Checked in at ${r.time}` :
        r.action === "checked_out" ? `Checked out at ${r.time}` : "Already checked in & out today"
      );
      loadAttendance();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Check-in failed");
    }
  }

  async function addEmployee(e: FormEvent) {
    e.preventDefault();
    if (!empForm.name) return;
    await emp.create({ ...empForm, salary: parseFloat(empForm.salary) || 0 } as unknown as Partial<Employee>);
    setEmpForm({ name: "", role: "", department: "", email: "", salary: "" });
  }

  async function requestLeave(e: FormEvent) {
    e.preventDefault();
    if (!leaveForm.from_date || !leaveForm.to_date) return;
    await leave.create({ employee: user.name, ...leaveForm, status: "pending" } as Partial<Leave>);
    setLeaveForm({ from_date: "", to_date: "", reason: "" });
  }

  const punchLabel = !today?.check_in ? "Check in" : !today?.check_out ? "Check out" : "Done for today";

  return (
    <div>
      <div className="cards">
        <div className="card hi">
          <span className="mlabel">Today · {user.name}</span>
          <div className="big" style={{ fontSize: 16, margin: "8px 0" }}>
            {today?.check_in ? `In ${today.check_in}` : "Not checked in"}
            {today?.check_out ? ` · Out ${today.check_out}` : ""}
          </div>
          <button className="btn orange sm" onClick={punch} disabled={!!today?.check_out}>{punchLabel}</button>
        </div>
        <div className="card"><span className="mlabel">Team members</span><div className="big">{emp.items.length}</div></div>
        <div className="card"><span className="mlabel">Pending leave</span><div className="big">{leave.items.filter((l) => l.status === "pending").length}</div></div>
        <div className="card"><span className="mlabel">Monthly payroll</span><div className="big">{money(emp.items.reduce((s, e) => s + e.salary, 0))}</div></div>
      </div>

      <div className="section">
        <h4>Team <span className="mlabel"><SheetsSync resource="employees" onPulled={emp.reload} /></span></h4>
        <form className="formrow" onSubmit={addEmployee}>
          <div className="field wide"><label>Name</label><input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} required /></div>
          <div className="field"><label>Role</label><input value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })} /></div>
          <div className="field"><label>Department</label><input value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })} /></div>
          <div className="field"><label>Email</label><input value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} /></div>
          <div className="field"><label>Salary</label><input type="number" value={empForm.salary} onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })} /></div>
          <button className="btn orange">Add</button>
        </form>
        <table className="grid">
          <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Email</th><th className="num">Salary</th><th>Status</th><th /></tr></thead>
          <tbody>
            {emp.items.map((e) => (
              <tr key={e.id}>
                <td style={{ fontWeight: 700 }}>{e.name}</td>
                <td>{e.role}</td>
                <td>{e.department}</td>
                <td style={{ color: "var(--ink-2)" }}>{e.email}</td>
                <td className="num">{money(e.salary)}</td>
                <td>
                  <select value={e.status} onChange={(ev) => emp.update(e.id, { status: ev.target.value } as Partial<Employee>)} style={{ width: 90 }}>
                    <option value="active">active</option>
                    <option value="onleave">onleave</option>
                    <option value="left">left</option>
                  </select>
                </td>
                <td><button className="btn danger sm" onClick={() => emp.remove(e.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h4>Leave requests</h4>
        <form className="formrow" onSubmit={requestLeave}>
          <div className="field"><label>From</label><input type="date" value={leaveForm.from_date} onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })} required /></div>
          <div className="field"><label>To</label><input type="date" value={leaveForm.to_date} onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })} required /></div>
          <div className="field wide"><label>Reason</label><input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} /></div>
          <button className="btn">Request</button>
        </form>
        <table className="grid">
          <thead><tr><th>Who</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>
            {leave.items.map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 700 }}>{l.employee}</td>
                <td>{l.from_date}</td>
                <td>{l.to_date}</td>
                <td style={{ color: "var(--ink-2)" }}>{l.reason}</td>
                <td><StatusPill value={l.status} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {l.status === "pending" && (
                    <>
                      <button className="btn sm" onClick={() => leave.update(l.id, { status: "approved" } as Partial<Leave>)}>✓</button>{" "}
                      <button className="btn danger sm" onClick={() => leave.update(l.id, { status: "rejected" } as Partial<Leave>)}>✕</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h4>Attendance log <span className="mlabel">last 100 punches</span></h4>
        <table className="grid">
          <thead><tr><th>Date</th><th>Who</th><th>In</th><th>Out</th></tr></thead>
          <tbody>
            {attendance.map((a) => (
              <tr key={a.id}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{a.date}</td>
                <td style={{ fontWeight: 700 }}>{a.name}</td>
                <td>{a.check_in || "—"}</td>
                <td>{a.check_out || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

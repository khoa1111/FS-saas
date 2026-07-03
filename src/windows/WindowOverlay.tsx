import { useStore, type OpenApp } from "../store";
import { sendWork } from "../ws";
import { ROOM_LABELS } from "../../shared/types";
import FinanceApp from "./FinanceApp";
import DocumentsApp from "./DocumentsApp";
import HrApp from "./HrApp";
import ProjectsApp from "./ProjectsApp";
import WorkflowApp from "./WorkflowApp";
import CrmApp from "./CrmApp";
import GamesApp from "./GamesApp";
import AdminApp from "./AdminApp";

const SUBTITLES: Record<string, string> = {
  finance: "LEDGER · CASHFLOW · MARKET WALL",
  documents: "VAULT · DOCS & ASSET REGISTER",
  hr: "PEOPLE OPS · ATTENDANCE · LEAVE",
  projects: "SPRINTS · TASKS · BOARDS",
  workflow: "PIPELINE · STAGES · CONVEYOR",
  crm: "CONTACTS · DEALS · NOTES",
  games: "ARCADE · PLAY TOGETHER",
  admin: "USERS · ACCESS · INTEGRATIONS"
};

export default function WindowOverlay({ app }: { app: Exclude<OpenApp, null> }) {
  const setOpenApp = useStore((s) => s.setOpenApp);

  function close() {
    setOpenApp(null);
    sendWork(null);
  }

  const title = app === "admin" ? "Admin Console" : ROOM_LABELS[app];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="window">
        <div className="win-head">
          <div className="traffic"><i /><i /><i /></div>
          <span className="title">{title}</span>
          <span className="mlabel">{SUBTITLES[app]}</span>
          <button className="close" onClick={close}>ESC · Close</button>
        </div>
        <div className="win-body">
          {app === "finance" && <FinanceApp />}
          {app === "documents" && <DocumentsApp />}
          {app === "hr" && <HrApp />}
          {app === "projects" && <ProjectsApp />}
          {app === "workflow" && <WorkflowApp />}
          {app === "crm" && <CrmApp />}
          {app === "games" && <GamesApp />}
          {app === "admin" && <AdminApp />}
        </div>
      </div>
    </div>
  );
}

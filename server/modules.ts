// Generic CRUD registry: each business module maps REST resources onto SQLite
// tables with a whitelist of writable columns and the room that guards access.

export interface ResourceDef {
  table: string;
  room: string;
  columns: string[]; // writable columns
  orderBy?: string;
}

export const RESOURCES: Record<string, ResourceDef> = {
  transactions: {
    table: "fin_transactions",
    room: "finance",
    columns: ["date", "type", "category", "description", "amount", "created_by"],
    orderBy: "date DESC, id DESC"
  },
  documents: {
    table: "documents",
    room: "documents",
    columns: ["name", "kind", "category", "url", "note", "owner"],
    orderBy: "updated_at DESC"
  },
  employees: {
    table: "employees",
    room: "hr",
    columns: ["name", "role", "department", "email", "salary", "status"],
    orderBy: "name ASC"
  },
  leave_requests: {
    table: "leave_requests",
    room: "hr",
    columns: ["employee", "from_date", "to_date", "reason", "status"],
    orderBy: "id DESC"
  },
  projects: {
    table: "projects",
    room: "projects",
    columns: ["name", "status", "owner", "deadline", "progress"],
    orderBy: "id DESC"
  },
  tasks: {
    table: "tasks",
    room: "projects",
    columns: ["project_id", "title", "assignee", "status", "priority", "due"],
    orderBy: "id DESC"
  },
  workflows: {
    table: "workflows",
    room: "workflow",
    columns: ["name", "stages"],
    orderBy: "id ASC"
  },
  workflow_items: {
    table: "workflow_items",
    room: "workflow",
    columns: ["workflow_id", "title", "stage", "assignee"],
    orderBy: "id ASC"
  },
  contacts: {
    table: "crm_contacts",
    room: "crm",
    columns: ["name", "company", "email", "phone", "status", "notes"],
    orderBy: "name ASC"
  },
  deals: {
    table: "crm_deals",
    room: "crm",
    columns: ["contact_id", "title", "value", "stage", "close_date"],
    orderBy: "id DESC"
  }
};

const PERMISSION_KEYS = [
  { key: "dashboard", label: "Dashboard", group: "Dashboard" },
  { key: "conversations", label: "Conversations", group: "Inbox" },
  { key: "tasks", label: "Tasks", group: "Inbox" },
  { key: "callWorkflow", label: "Call Workflow", group: "Inbox" },
  { key: "contacts", label: "Contacts", group: "Contacts" },
  { key: "contacts_overview", label: "Overview", group: "Contacts" },
  { key: "my_details", label: "My Details", group: "Contacts" },
  { key: "contacts_all", label: "All Contacts", group: "Contacts" },
  { key: "leads_overview", label: "Overview", group: "Leads" },
  { key: "leads_list", label: "List", group: "Leads" },
  { key: "leads_kanban", label: "Kanban", group: "Leads" },
  { key: "recruit_overview", label: "Overview", group: "Recruit" },
  { key: "recruit_list", label: "List", group: "Recruit" },
  { key: "recruit_kanban", label: "Kanban", group: "Recruit" },
  { key: "recruit_lms", label: "LMS", group: "Recruit" },
  { key: "scheduler", label: "Scheduler", group: "Rosters" },
  { key: "accommodation", label: "Accommodation", group: "Rosters" },
  { key: "clientBudget", label: "Client Budget", group: "Rosters" },
  { key: "time_attendance", label: "Time & Attendance", group: "Rosters" },
  { key: "roster_calculator", label: "Roster Calculator", group: "Rosters" },
  { key: "roc", label: "Roster of Care", group: "Rosters" },
  { key: "course_library", label: "Course Library", group: "Training" },
  { key: "my_training", label: "My Training", group: "Training" },
  { key: "service_agreements", label: "Service Agreements", group: "Agreements" },
  { key: "schedule_of_supports", label: "Schedule of Supports", group: "Agreements" },
  { key: "reports", label: "Reports", group: "Reports" },
  { key: "registers", label: "Registers", group: "Reports" },
  { key: "files", label: "Files", group: "Reports" },
  { key: "auditLog", label: "Audit Log", group: "Reports" },
  { key: "receipts", label: "Receipts", group: "Reports" },
  { key: "ndisReports", label: "NDIS Reports", group: "Reports" },
  { key: "invoice_management", label: "Invoice Management", group: "Invoices" },
  { key: "my_invoices", label: "My Invoices", group: "Invoices" },
  { key: "supportTickets", label: "Support Tickets", group: "Inbox" },
  { key: "incidents", label: "Incident Reports", group: "Reports" },
  { key: "continuousImprovement", label: "Continuous Improvement", group: "Reports" },
  { key: "progressNotes", label: "Progress Notes", group: "Reports" },
  { key: "knowledgeBase", label: "Knowledge Base", group: "Intelligence" },
  { key: "admin", label: "User Management", group: "System" },
];

const SENIOR_ROLES = ["superadmin", "director", "admin", "team_leader", "roster_officer", "manager", "ceo"];

function getDefaultPermissions(role) {
  var p = {};
  if (role === "superadmin") {
    PERMISSION_KEYS.forEach(function (pk) { p[pk.key] = "edit"; });
  } else if (role === "director") {
    PERMISSION_KEYS.forEach(function (pk) { p[pk.key] = pk.key === "admin" ? "none" : "edit"; });
    ["incidentRegister", "continuousImprovement", "progressNotes"].forEach(function (k) { p[k] = "none"; });
    p["knowledgeBase"] = "view";
  } else if (role === "team_leader" || role === "admin") {
    PERMISSION_KEYS.forEach(function (pk) { p[pk.key] = pk.key === "admin" ? "none" : "edit"; });
    ["supportTickets", "incidentRegister", "continuousImprovement", "progressNotes", "aiRoster", "newsletters", "loginActivity", "cancellations", "handover", "payroll", "sleepReport", "reconciliation", "kmReport", "automations", "complianceReports", "shiftcareComparison"].forEach(function (k) { p[k] = "none"; });
    p["knowledgeBase"] = "view";
  } else if (role === "roster_officer") {
    var roEdit = ["dashboard", "scheduler", "accommodation", "clientBudget", "time_attendance", "roster_calculator", "roc", "reports", "registers", "ndisReports", "receipts", "files"];
    var roView = ["contacts", "contacts_all", "my_details", "my_training", "knowledgeBase"];
    PERMISSION_KEYS.forEach(function (pk) {
      if (roEdit.indexOf(pk.key) >= 0) p[pk.key] = "edit";
      else if (roView.indexOf(pk.key) >= 0) p[pk.key] = "view";
      else p[pk.key] = "none";
    });
  } else if (role === "support_worker" || role === "operator") {
    var swEdit = ["my_details", "my_training", "time_attendance", "my_invoices"];
    var swView = ["dashboard", "knowledgeBase"];
    PERMISSION_KEYS.forEach(function (pk) {
      if (swEdit.indexOf(pk.key) >= 0) p[pk.key] = "edit";
      else if (swView.indexOf(pk.key) >= 0) p[pk.key] = "view";
      else p[pk.key] = "none";
    });
  } else {
    PERMISSION_KEYS.forEach(function (pk) { p[pk.key] = "none"; });
  }
  return p;
}

function getUserPermissions(user) {
  if (user.role === "superadmin") {
    var p = {};
    PERMISSION_KEYS.forEach(function (pk) { p[pk.key] = "edit"; });
    p.client_filter = "all";
    return p;
  }
  var defaults = getDefaultPermissions(user.role);
  try {
    var saved = JSON.parse(user.permissions || "{}");
    if (Object.keys(saved).length > 0) {
      PERMISSION_KEYS.forEach(function (pk) {
        if (saved[pk.key] === undefined) {
          saved[pk.key] = defaults[pk.key] || "none";
        }
      });
      if (!saved.client_filter) saved.client_filter = "all";
      return saved;
    }
  } catch (e) {}
  defaults.client_filter = "all";
  return defaults;
}

function isSeniorRole(user) {
  var role = (user.role || "").toLowerCase().replace(/\s+/g, "_");
  return role === "superadmin" || role === "director";
}

function isPhase2Role(user) {
  var role = (user.role || "").toLowerCase().replace(/\s+/g, "_");
  return SENIOR_ROLES.indexOf(role) >= 0;
}

module.exports = {
  PERMISSION_KEYS,
  SENIOR_ROLES,
  getDefaultPermissions,
  getUserPermissions,
  isSeniorRole,
  isPhase2Role,
};

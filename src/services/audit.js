const { db } = require('../db/sqlite');

function logAudit(user, action, entityType, entityId, entityLabel, fieldName, oldValue, newValue) {
  try {
    db.prepare(
      "INSERT INTO audit_log (user_id, user_name, user_email, action, entity_type, entity_id, entity_label, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      user ? user.id : null,
      user ? (user.name || user.email || "") : "System",
      user ? (user.email || "") : "",
      action,
      entityType || "",
      entityId || "",
      entityLabel || "",
      fieldName || "",
      oldValue !== undefined && oldValue !== null ? String(oldValue).substring(0, 2000) : "",
      newValue !== undefined && newValue !== null ? String(newValue).substring(0, 2000) : ""
    );
  } catch (e) {
    console.error("[AUDIT] Error logging:", e.message);
  }
}

function logAuditFields(user, action, entityType, entityId, entityLabel, fieldsObj) {
  var keys = Object.keys(fieldsObj || {});
  for (var i = 0; i < keys.length; i++) {
    logAudit(user, action, entityType, entityId, entityLabel, keys[i], "", fieldsObj[keys[i]]);
  }
}

module.exports = { logAudit, logAuditFields };

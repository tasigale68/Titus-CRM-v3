// ─── Shared helpers for reports module ───────────────────

var TitusDate = {
  parse: function(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    if (typeof dateStr === "number") return new Date(dateStr);
    if (typeof dateStr !== "string") return null;
    if (dateStr.indexOf("T") >= 0 || /^\d{4}-\d{2}-\d{2}/.test(dateStr)) { var d = new Date(dateStr); return isNaN(d.getTime()) ? null : d; }
    var auMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (auMatch) { var year = auMatch[3]; if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year; var d2 = new Date(parseInt(year), parseInt(auMatch[2]) - 1, parseInt(auMatch[1])); return isNaN(d2.getTime()) ? null : d2; }
    var d3 = new Date(dateStr); return isNaN(d3.getTime()) ? null : d3;
  },
  format: function(dateStr) { var d = this.parse(dateStr); if (!d) return ""; return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getFullYear()).slice(-2); },
  formatFull: function(dateStr) { var d = this.parse(dateStr); if (!d) return ""; return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); },
  formatDateTime: function(dateStr) { var d = this.parse(dateStr); if (!d) return ""; var h = d.getHours(); var ampm = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return this.format(dateStr) + " " + h + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ampm; },
  toISO: function(dateStr) { var d = this.parse(dateStr); if (!d) return ""; return d.toISOString().split("T")[0]; },
  formatShort: function(dateStr) { var d = this.parse(dateStr); if (!d) return ""; var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return d.getDate() + " " + months[d.getMonth()]; },
  formatMedium: function(dateStr) { var d = this.parse(dateStr); if (!d) return ""; var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear(); }
};

function findDate(fields) {
  var dateKeys = ["Start Time", "Start Date and Time", "Start Date & Time Formula",
    "Date & Time of Contact", "Date & Time of Incident", "Date & Time of Incident FORMULA",
    "Created", "Date", "Date & Time", "Date of Contact", "Day of Contact"];
  for (var i = 0; i < dateKeys.length; i++) {
    if (fields[dateKeys[i]]) return fields[dateKeys[i]];
  }
  var keys = Object.keys(fields);
  for (var j = 0; j < keys.length; j++) {
    var kn = keys[j].toLowerCase();
    if ((kn.indexOf("start date") >= 0 || kn.indexOf("date") >= 0 || kn.indexOf("created") >= 0)
      && typeof fields[keys[j]] === "string" && fields[keys[j]].match(/^\d{4}-/)) {
      return fields[keys[j]];
    }
  }
  return null;
}

function findField(fields, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    if (fields[candidates[i]]) return fields[candidates[i]];
  }
  return "";
}

function arrayVal(v) { return Array.isArray(v) ? v[0] || "" : v || ""; }

module.exports = { TitusDate, findDate, findField, arrayVal };

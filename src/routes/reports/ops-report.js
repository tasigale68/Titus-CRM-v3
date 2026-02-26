// ─── OPS REPORT — Full data-driven multi-section report ──
var airtable = require('../../services/database');
var env = require('../../config/env');
var { TitusDate, findDate, findField, arrayVal } = require('./helpers');

function opsReportHandler(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var from = req.body.from;
  var to = req.body.to;
  if (!from || !to) return res.status(400).json({ error: "from and to dates required" });

  var fromDate = new Date(from);
  var toDate = new Date(to + "T23:59:59");
  var now = new Date();
  var sixtyDays = new Date(now.getTime() + 60 * 86400000);

  // Build Airtable date filter for Progress Notes
  var fromMinusOne = new Date(fromDate.getTime() - 86400000).toISOString().split("T")[0];
  var toPlusOne = new Date(toDate.getTime() + 86400000).toISOString().split("T")[0];
  var pnDateFilter = "AND(IS_AFTER({Start Time},'" + fromMinusOne + "'),IS_BEFORE({Start Time},'" + toPlusOne + "'))";
  console.log("Progress Notes date filter:", pnDateFilter);

  // Tables that don't need a view
  var simpleTables = [
    { key: "incidents", name: "IR Reports 2025" },
    { key: "scheduleOfSupport", name: "Schedule of Support" },
    { key: "pbsp", name: "PBSP" },
    { key: "handover", name: "Schedule of Support and Handover" }
  ];

  var results = {};
  var promises = simpleTables.map(function(t) {
    return airtable.fetchAllFromTable(t.name).then(function(records) {
      results[t.key] = records || [];
    }).catch(function() { results[t.key] = []; });
  });

  // Progress Notes — date-filtered
  promises.push(
    airtable.fetchAllFromTableView("Progress Notes", "Progress Note by Client", pnDateFilter).then(function(records) {
      results.progressNotes = records || [];
      console.log("Progress Notes fetched (date-filtered):", results.progressNotes.length);
    }).catch(function(e) { console.log("PN fetch error:", e.message); results.progressNotes = []; })
  );

  // Employee Contact History — date-filtered
  var ecDateFilter = "AND(IS_AFTER({Date & Time of Contact},'" + fromMinusOne + "'),IS_BEFORE({Date & Time of Contact},'" + toPlusOne + "'))";
  promises.push(
    airtable.fetchAllFromTableView("Employee Contact History", "Grid view", ecDateFilter).then(function(records) {
      results.employeeContacts = records || [];
      console.log("Employee Contacts fetched:", results.employeeContacts.length);
    }).catch(function(e) {
      console.log("EC date filter failed, trying without:", e.message);
      return airtable.fetchAllFromTable("Employee Contact History").then(function(records) {
        results.employeeContacts = records || [];
      });
    })
  );

  // Client Contact History — date-filtered
  var ccDateFilter = "AND(IS_AFTER({Date & Time of Contact},'" + fromMinusOne + "'),IS_BEFORE({Date & Time of Contact},'" + toPlusOne + "'))";
  promises.push(
    airtable.fetchAllFromTableView("Client Contact History", "Grid view - Latest Date first", ccDateFilter).then(function(records) {
      results.clientContacts = records || [];
      console.log("Client Contacts fetched:", results.clientContacts.length);
    }).catch(function(e) {
      console.log("CC date filter failed, trying without:", e.message);
      return airtable.fetchAllFromTable("Client Contact History").then(function(records) {
        results.clientContacts = records || [];
      });
    })
  );

  // Active Workers
  promises.push(
    airtable.fetchAllFromTableView("All Contacts", "Active Contacts 2026").then(function(records) {
      results.activeContacts = records || [];
    }).catch(function() { results.activeContacts = []; })
  );

  // Clients
  promises.push(
    airtable.fetchAllFromTableView("Clients", "Client Active View").then(function(records) {
      results.clients = records || [];
    }).catch(function() { results.clients = []; })
  );

  // Ready to Work
  promises.push(
    airtable.fetchAllFromTableView("All Contacts", "Ready to Work View").then(function(records) {
      results.readyToWork = records || [];
      console.log("Ready to Work fetched:", results.readyToWork.length);
    }).catch(function() { results.readyToWork = []; })
  );

  // Open Incidents
  promises.push(
    airtable.fetchAllFromTableView("IR Reports 2025", "Open Incidents").then(function(records) {
      results.openIncidents = records || [];
      console.log("Open Incidents fetched:", results.openIncidents.length);
    }).catch(function() { results.openIncidents = []; })
  );

  Promise.all(promises).then(function() {
    console.log("Ops Report data fetched:", Object.keys(results).map(function(k) { return k + ":" + (results[k]||[]).length; }).join(", "));

    function isInRange(record) {
      var d = findDate(record.fields || {});
      if (!d) return false;
      var rd = new Date(d);
      return rd >= fromDate && rd <= toDate;
    }

    // Filter date-sensitive records
    var filtered = {
      progressNotes: results.progressNotes || [],
      incidents: (results.incidents || []).filter(isInRange),
      employeeContacts: results.employeeContacts || [],
      clientContacts: results.clientContacts || [],
      scheduleOfSupport: (results.scheduleOfSupport || []).filter(isInRange),
      handover: (results.handover || []).filter(isInRange)
    };
    console.log("Records — PN:" + filtered.progressNotes.length +
      " Inc:" + filtered.incidents.length + " EmpC:" + filtered.employeeContacts.length +
      " ClientC:" + filtered.clientContacts.length);

    // ── ACTIVE WORKERS ──
    var activeWorkersList = [];
    var activeContractorsList = [];
    (results.activeContacts || []).forEach(function(r) {
      var f = r.fields || {};
      var contactType = f["Type of Contact (Single Select)"] || f["Type of Contact"] || "";
      var name = f["Full Name"] || f["Name"] || "";
      if (Array.isArray(name)) name = name[0] || "";
      if (!name) return;
      var ctLower = contactType.toLowerCase();
      if (ctLower.indexOf("employee") >= 0) activeWorkersList.push({ name: name, type: "Employee" });
      else if (ctLower.indexOf("independ") >= 0 || ctLower.indexOf("contractor") >= 0) activeContractorsList.push({ name: name, type: "Contractor" });
    });

    // ── ACTIVE CLIENTS ──
    var activeClientCount = 0;
    var prospectClientCount = 0;
    var activeSIL = 0; var activeCAS = 0;
    var prospectSIL = 0; var prospectCAS = 0;
    (results.clients || []).forEach(function(r) {
      var f = r.fields || {};
      var at = f["Account Type: Active or Inactive or Propsect"] || f["Account Type: Active or Inactive or Prospect"] || f["Account Type"] || "";
      var atl = at.toLowerCase();
      var silCas = arrayVal(f["SIL or CAS?"] || "").toLowerCase();
      var isSIL = silCas.indexOf("sil") >= 0;
      if (atl.indexOf("active") >= 0) { activeClientCount++; if (isSIL) activeSIL++; else activeCAS++; }
      else if (atl.indexOf("prospect") >= 0) { prospectClientCount++; if (isSIL) prospectSIL++; else prospectCAS++; }
    });

    // ── PROGRESS NOTES ANALYSIS ──
    var pnByWorker = {};
    var pnByClient = {};
    var pnTotalHours = 0;
    var pnTransport = 0;
    var pnTotalKms = 0;
    var sleepByClient = {};
    var sleepCount = 0;
    var riskDetails = [];
    var riskCount = 0;
    var kmsByClient = {};
    var clientNarrative = {};

    filtered.progressNotes.forEach(function(r, idx) {
      var f = r.fields || {};

      if (idx === 0) {
        console.log("Progress Note sample fields:", Object.keys(f).join(", "));
      }

      // Worker
      var worker = arrayVal(findField(f, ["Full Name (from Support Workers Name)",
        "Full Name (from Support Worker Name)", "Full Name (from Employees)",
        "Staff ", "Staff", "Staff Name"]));
      if (!worker) {
        var fn = arrayVal(findField(f, ["First Name (from Support Workers Name)",
          "First Name (from Support Workers Name) 3"]));
        if (fn) worker = fn;
      }
      if (!worker) {
        worker = arrayVal(f["Support Workers Name"] || "");
      }

      // Client
      var client = arrayVal(findField(f, ["Client Name (from Client)",
        "Full Name (from Client)", "Client Name", "Client"]));
      if (!client) {
        var cname = f["Client Name"] || f["Name (from Client)"] || "";
        if (Array.isArray(cname)) client = cname[0] || "";
        else client = cname;
      }

      // Hours
      var hours = 0;
      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if ((fl.indexOf("total hours") >= 0 || fl === "hours") && !hours) hours = parseFloat(f[fk]) || 0;
      });

      // Transport
      var didTransport = false;
      Object.keys(f).forEach(function(fk) {
        if (fk.toLowerCase().indexOf("transport") >= 0 && fk.toLowerCase().indexOf("client") >= 0) {
          var v = (f[fk] || "").toString().toLowerCase();
          if (v.indexOf("yes") >= 0) didTransport = true;
        }
      });

      // KMs
      var kms = 0;
      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if (fl.indexOf("km") >= 0 || fl.indexOf("kilomet") >= 0 || fl.indexOf("distance") >= 0 ||
            fl.indexOf("mileage") >= 0 || fl.indexOf("travel") >= 0) {
          var v = f[fk];
          if (typeof v === "number" && v > 0) kms = v;
          else if (typeof v === "string") {
            var parsed = parseFloat(v.replace(/[^0-9.]/g, ""));
            if (!isNaN(parsed) && parsed > 0) kms = parsed;
          }
        }
      });

      if (worker) pnByWorker[worker] = (pnByWorker[worker] || 0) + 1;
      if (client) pnByClient[client] = (pnByClient[client] || 0) + 1;
      pnTotalHours += hours;
      if (didTransport) pnTransport++;
      pnTotalKms += kms;
      if (client && kms > 0) {
        kmsByClient[client] = (kmsByClient[client] || 0) + kms;
      }

      // Shift date/time
      var shiftDate = findDate(f) || "";
      var shiftTime = "";
      var sdtVal = f["Start Date and Time"] || "";
      if (sdtVal && typeof sdtVal === "string") {
        var sdtMatch = sdtVal.match(/T(\d{2}:\d{2})/);
        if (sdtMatch) shiftTime = sdtMatch[1];
      }
      var endTime = "";
      var edtVal = f["End Date and Time"] || "";
      if (edtVal && typeof edtVal === "string") {
        var edtMatch = edtVal.match(/T(\d{2}:\d{2})/);
        if (edtMatch) endTime = edtMatch[1];
      }
      var shiftLabel = shiftDate ? TitusDate.format(shiftDate) : "";
      if (shiftTime) shiftLabel += " " + shiftTime;
      if (endTime) shiftLabel += "–" + endTime;

      // Per-client narrative content
      if (client) {
        if (!clientNarrative[client]) clientNarrative[client] = { pnContent: [], workers: {}, totalHours: 0 };
        clientNarrative[client].totalHours += hours;
        if (worker) clientNarrative[client].workers[worker] = (clientNarrative[client].workers[worker] || 0) + 1;

        var bestText = "";
        ["Summarise", "Summary", "Progress Note Summary", "Notes", "Shift Summary"].forEach(function(fn2) {
          if (!bestText && f[fn2] && typeof f[fn2] === "string" && f[fn2].trim().length > 15) bestText = f[fn2].trim();
        });
        if (!bestText) {
          Object.keys(f).forEach(function(fk) {
            if (bestText) return;
            if (/^[0-9]/.test(fk) && typeof f[fk] === "string" && f[fk].trim().length > 20) {
              var vl = f[fk].toLowerCase().trim();
              if (vl !== "yes" && vl !== "no" && vl !== "n/a" && vl !== "none" && vl !== "nil") {
                bestText = f[fk].trim();
              }
            }
          });
        }
        if (!bestText) {
          var candidates = [];
          Object.keys(f).forEach(function(fk) {
            var fl = fk.toLowerCase();
            if (fl.indexOf("date") >= 0 || fl.indexOf("time") >= 0 || fl.indexOf("name") >= 0 ||
                fl.indexOf("email") >= 0 || fl.indexOf("id") >= 0 || fl.indexOf("record") >= 0 ||
                fl.indexOf("created") >= 0 || fl.indexOf("modified") >= 0) return;
            var v = f[fk];
            if (typeof v === "string" && v.trim().length > 30) {
              var vl2 = v.toLowerCase().trim();
              if (vl2 !== "yes" && vl2 !== "no" && vl2 !== "n/a") candidates.push(v.trim());
            }
          });
          candidates.sort(function(a, b) { return b.length - a.length; });
          if (candidates.length > 0) bestText = candidates[0];
        }

        if (bestText && clientNarrative[client].pnContent.length < 8) {
          clientNarrative[client].pnContent.push({
            date: shiftLabel,
            worker: worker,
            text: bestText.substring(0, 200)
          });
        }
      }

      // Sleep Disturbances
      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if (fl.indexOf("sleep") >= 0 || fl.indexOf("disturbance") >= 0) {
          var val = f[fk];
          if (val && val !== "" && val !== false && val !== 0) {
            var vs = (typeof val === "string") ? val.toLowerCase() : "";
            if (vs === "no" || vs === "n/a" || vs === "none" || vs === "0" || vs === "nil") return;
            sleepCount++;
            if (client) {
              if (!sleepByClient[client]) sleepByClient[client] = [];
              sleepByClient[client].push({ date: shiftLabel, worker: worker || "", note: typeof val === "string" ? val.substring(0,120) : "" });
            }
          }
        }
      });

      // Risks / Concerns
      var CONCERNS_FIELD = "4. Were there any concerns, incidents, or changes in health or behaviour?";
      var concernVal = f[CONCERNS_FIELD] || "";
      if (Array.isArray(concernVal)) concernVal = concernVal.join(", ");
      if (typeof concernVal === "string" && concernVal.trim()) {
        var cvl = concernVal.trim().toLowerCase();
        if (cvl !== "no" && cvl !== "n/a" && cvl !== "none" && cvl !== "nil" && cvl !== "0" && cvl !== "na" && cvl !== "-" && cvl !== "no concerns") {
          var concernDetails = "";

          var detailFields = [
            "4a. If yes, provide details", "4a. If Yes, Provide Details",
            "4a. If yes provide details", "If yes, provide details",
            "4a. Provide details", "Concerns Details", "Concern Details",
            "Details of concerns", "4a", "4a."
          ];
          detailFields.forEach(function(df) {
            if (!concernDetails && f[df]) {
              var v = Array.isArray(f[df]) ? f[df].join(", ") : String(f[df]);
              if (v.trim() && v.toLowerCase() !== "yes" && v.toLowerCase() !== "no") concernDetails = v;
            }
          });

          if (!concernDetails) {
            Object.keys(f).forEach(function(fk2) {
              if (concernDetails) return;
              var fl2 = fk2.toLowerCase();
              if (fl2.indexOf("4a") >= 0 || fl2.indexOf("if yes") >= 0 ||
                  (fl2.indexOf("provide") >= 0 && fl2.indexOf("detail") >= 0) ||
                  (fl2.indexOf("concern") >= 0 && fl2.indexOf("detail") >= 0) ||
                  fl2.indexOf("explain") >= 0) {
                var v2 = f[fk2];
                if (v2 && typeof v2 === "string" && v2.trim().length > 3 &&
                    v2.toLowerCase() !== "yes" && v2.toLowerCase() !== "no") {
                  concernDetails = v2;
                }
              }
            });
          }

          if (!concernDetails) {
            Object.keys(f).forEach(function(fk3) {
              if (concernDetails) return;
              if (fk3.indexOf("4.") === 0 && fk3 !== CONCERNS_FIELD) {
                var v3 = f[fk3];
                if (v3 && typeof v3 === "string" && v3.trim().length > 3 &&
                    v3.toLowerCase() !== "yes" && v3.toLowerCase() !== "no") {
                  concernDetails = v3;
                }
              }
            });
          }

          if (!concernDetails) {
            Object.keys(f).forEach(function(fk4) {
              if (concernDetails) return;
              if (fk4 === CONCERNS_FIELD) return;
              var fl4 = fk4.toLowerCase();
              if (fl4.indexOf("concern") >= 0 || fl4.indexOf("incident") >= 0 ||
                  fl4.indexOf("health") >= 0 || fl4.indexOf("behaviour") >= 0 || fl4.indexOf("behavior") >= 0) {
                var v4 = f[fk4];
                if (v4 && typeof v4 === "string" && v4.trim().length > 5 &&
                    v4.toLowerCase() !== "yes" && v4.toLowerCase() !== "no") {
                  concernDetails = v4;
                }
              }
            });
          }

          if (!concernDetails && cvl !== "yes" && cvl.length > 10) {
            concernDetails = concernVal;
          }

          riskCount++;
          riskDetails.push({
            client: client || "Unknown",
            summary: (concernDetails || "Concern flagged — Yes").substring(0, 500),
            date: shiftLabel,
            rawDate: shiftDate,
            worker: worker
          });
        }
      }
    });
    console.log("KM SUMMARY — Total KMs:", pnTotalKms, "Transport trips:", pnTransport);
    riskDetails.sort(function(a, b) { return (b.rawDate || "").localeCompare(a.rawDate || ""); });

    var topWorkers = Object.keys(pnByWorker).map(function(k) {
      return { name: k, count: pnByWorker[k] };
    }).sort(function(a, b) { return b.count - a.count; }).slice(0, 10);

    var topClients = Object.keys(pnByClient).map(function(k) {
      return { name: k, count: pnByClient[k] };
    }).sort(function(a, b) { return b.count - a.count; }).slice(0, 10);

    // ── INCIDENT ANALYSIS ──
    var incidentBreakdown = {};
    var reportableCount = 0;
    var incidentsByClient = {};
    var incidentDetails = [];
    filtered.incidents.forEach(function(r) {
      var f = r.fields || {};
      var cats = f["Incident Categories"] || f["Category"] || f["Type of Incident"] || "";
      if (Array.isArray(cats)) cats.forEach(function(c) { incidentBreakdown[c] = (incidentBreakdown[c] || 0) + 1; });
      else if (cats) incidentBreakdown[cats] = (incidentBreakdown[cats] || 0) + 1;

      var reportable = "";
      Object.keys(f).forEach(function(fk) {
        if (fk.toLowerCase().indexOf("reportable") >= 0) reportable = (f[fk] || "").toString().toLowerCase();
      });
      if (reportable.indexOf("yes") >= 0) reportableCount++;

      var riskLevel = "";
      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if (fl.indexOf("risk") >= 0 && fl.indexOf("level") >= 0) riskLevel = (f[fk] || "").toString().toLowerCase();
        if (fl.indexOf("severity") >= 0) riskLevel = riskLevel || (f[fk] || "").toString().toLowerCase();
      });

      var client = arrayVal(f["Client Name (from Client Name)"] || "");
      if (!client) client = arrayVal(f["Full Name (from Client)"] || "");
      if (!client) client = arrayVal(f["Client Name (from Client)"] || "");
      if (!client) {
        Object.keys(f).forEach(function(fk) {
          if (!client && fk.toLowerCase().indexOf("client name") >= 0 && fk.toLowerCase().indexOf("from") >= 0) {
            client = arrayVal(f[fk]);
          }
        });
      }
      if (!client) client = arrayVal(f["Client Name"] || "");
      if (client) incidentsByClient[client] = (incidentsByClient[client] || 0) + 1;

      var desc = "";
      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if ((fl.indexOf("description") >= 0 || fl.indexOf("what happened") >= 0 || fl.indexOf("summary") >= 0 || fl.indexOf("detail") >= 0) && typeof f[fk] === "string" && f[fk].length > desc.length) desc = f[fk];
      });

      var incDateTime = findDate(f) || "";
      var incTime = "";
      if (incDateTime) {
        try {
          var idt = new Date(incDateTime);
          if (!isNaN(idt)) incTime = idt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
        } catch(e) {}
      }

      var incWorker = arrayVal(f["Support Worker Name"] || f["Full Name (from Support Worker Name)"] || f["Staff Name"] || "");
      var incLocation = arrayVal(f["Location"] || f["Location of Incident"] || "");
      var isReportable = reportable.indexOf("yes") >= 0;
      var isHighRisk = riskLevel.indexOf("high") >= 0 || riskLevel.indexOf("extreme") >= 0 || riskLevel.indexOf("critical") >= 0;

      var actionsTaken = "";
      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if ((fl.indexOf("action") >= 0 || fl.indexOf("response") >= 0 || fl.indexOf("follow") >= 0) && typeof f[fk] === "string" && f[fk].length > actionsTaken.length) actionsTaken = f[fk];
      });

      incidentDetails.push({
        date: incDateTime, time: incTime, client: client || "Unknown",
        category: Array.isArray(cats) ? cats.join(", ") : cats,
        reportable: isReportable, highRisk: isHighRisk, riskLevel: riskLevel,
        worker: incWorker, location: incLocation,
        description: isReportable ? desc.substring(0, 500) : desc.substring(0, 250),
        actionsTaken: isReportable ? actionsTaken.substring(0, 300) : ""
      });

      if (client) {
        if (!clientNarrative[client]) clientNarrative[client] = { pnContent: [], workers: {}, totalHours: 0 };
        if (!clientNarrative[client].incidents) clientNarrative[client].incidents = [];
        if (clientNarrative[client].incidents.length < 5) {
          clientNarrative[client].incidents.push({
            date: TitusDate.format(incDateTime),
            category: Array.isArray(cats) ? cats.join(", ") : cats,
            desc: desc.substring(0, 150),
            reportable: isReportable
          });
        }
      }
    });
    incidentDetails.sort(function(a, b) { return b.date.localeCompare(a.date); });

    // Incidents by client + category
    var incidentsByClientCat = {};
    incidentDetails.forEach(function(inc) {
      var c = inc.client || "Unknown";
      if (!incidentsByClientCat[c]) incidentsByClientCat[c] = { total: 0, categories: {}, reportable: 0 };
      incidentsByClientCat[c].total++;
      if (inc.reportable) incidentsByClientCat[c].reportable++;
      var catParts = inc.category ? inc.category.split(", ") : ["Uncategorised"];
      catParts.forEach(function(cat) {
        if (cat) incidentsByClientCat[c].categories[cat] = (incidentsByClientCat[c].categories[cat] || 0) + 1;
      });
    });

    // Open incidents by month
    var openIncByMonth = {};
    var openIncTotal = (results.openIncidents || []).length;
    (results.openIncidents || []).forEach(function(r) {
      var f = r.fields || {};
      var d = findDate(f);
      if (d) {
        var dt = new Date(d);
        if (!isNaN(dt)) {
          var monthKey = TitusDate.format(dt);
          openIncByMonth[monthKey] = (openIncByMonth[monthKey] || 0) + 1;
        }
      }
    });

    // Incidents by month open vs closed
    var openIds = {};
    (results.openIncidents || []).forEach(function(r) { openIds[r.id] = true; });
    var openTotal = Object.keys(openIds).length;
    var closedTotal = 0;
    var incByMonth = {};
    (results.incidents || []).forEach(function(r) {
      var f = r.fields || {};
      var dateStr = findDate(f) || "";
      if (!dateStr) return;
      try {
        var d = new Date(dateStr);
        if (isNaN(d)) return;
        var monthKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        var monthLabel = TitusDate.format(d);
        if (!incByMonth[monthKey]) incByMonth[monthKey] = { label: monthLabel, open: 0, closed: 0 };
        if (openIds[r.id]) { incByMonth[monthKey].open++; }
        else { incByMonth[monthKey].closed++; closedTotal++; }
      } catch(e) {}
    });
    var incMonthsSorted = Object.keys(incByMonth).sort().map(function(k) {
      return { month: incByMonth[k].label, open: incByMonth[k].open, closed: incByMonth[k].closed };
    });

    var incByCatByClient = {};
    incidentDetails.forEach(function(inc) {
      var cat = inc.category || "Uncategorised";
      if (!incByCatByClient[inc.client]) incByCatByClient[inc.client] = {};
      cat.split(",").forEach(function(c2) {
        c2 = c2.trim();
        if (c2) incByCatByClient[inc.client][c2] = (incByCatByClient[inc.client][c2] || 0) + 1;
      });
    });
    var incidentsByCatClient = [];
    Object.keys(incByCatByClient).sort().forEach(function(cl) {
      var cats2 = incByCatByClient[cl];
      Object.keys(cats2).sort().forEach(function(cat2) {
        incidentsByCatClient.push({ client: cl, category: cat2, count: cats2[cat2] });
      });
    });

    // ── CONTACT HISTORY ANALYSIS ──
    var STAFF_FULLNAME_FIELD = "Full Name (from Staff Name - (Internal Office) who actioned this file)";
    var STAFF_EMAIL_FIELD = "Staff Name - (Internal Office) who actioned this file";
    var empContactMethods = {};
    var empContactReasons = {};
    var empContactByUser = {};
    var staffContactReport = {};

    filtered.employeeContacts.forEach(function(r) {
      var f = r.fields || {};
      var methods = f["Method of Contact"] || [];
      if (typeof methods === "string") methods = [methods];
      if (Array.isArray(methods)) methods.forEach(function(m) { empContactMethods[m] = (empContactMethods[m] || 0) + 1; });
      var reasons = f["Reason for Contact"] || [];
      if (typeof reasons === "string") reasons = [reasons];
      if (Array.isArray(reasons)) reasons.forEach(function(r2) { empContactReasons[r2] = (empContactReasons[r2] || 0) + 1; });
      var addedBy = arrayVal(f[STAFF_FULLNAME_FIELD] || "");
      if (!addedBy) addedBy = arrayVal(f[STAFF_EMAIL_FIELD] || "");
      if (!addedBy) {
        Object.keys(f).forEach(function(fk) {
          var fl = fk.toLowerCase();
          if (!addedBy && fl.indexOf("full name") >= 0 && fl.indexOf("staff name") >= 0) addedBy = arrayVal(f[fk]);
        });
      }
      if (addedBy) empContactByUser[addedBy] = (empContactByUser[addedBy] || 0) + 1;

      var empName = arrayVal(f["Employees Full Name"] || f["Full Name (Formula)"] || f["Full Name"] || "");
      if (!empName) {
        Object.keys(f).forEach(function(fk) {
          if (!empName) {
            var fl = fk.toLowerCase();
            if ((fl.indexOf("employee") >= 0 && fl.indexOf("name") >= 0) ||
                (fl.indexOf("full name") >= 0 && fl.indexOf("formula") >= 0)) {
              empName = arrayVal(f[fk] || "");
            }
          }
        });
      }
      if (!empName) empName = "Unknown";

      if (!staffContactReport[empName]) {
        staffContactReport[empName] = { name: empName, entries: 0, reasons: {}, summaries: [], methods: {} };
      }
      staffContactReport[empName].entries++;

      if (Array.isArray(reasons)) {
        reasons.forEach(function(r2) { staffContactReport[empName].reasons[r2] = (staffContactReport[empName].reasons[r2] || 0) + 1; });
      }
      if (Array.isArray(methods)) {
        methods.forEach(function(m) { staffContactReport[empName].methods[m] = (staffContactReport[empName].methods[m] || 0) + 1; });
      }

      var summary = f["Summarise"] || f["Summary"] || "";
      if (Array.isArray(summary)) summary = summary[0] || "";
      if (!summary) {
        Object.keys(f).forEach(function(fk) {
          if (!summary && fk.toLowerCase().indexOf("summar") >= 0 && typeof f[fk] === "string" && f[fk].length > 3) {
            summary = f[fk];
          }
        });
      }
      if (summary && summary.length > 3) {
        var dateStr2 = "";
        var dt2 = f["Date & Time of Contact"] || f["Date & Time of..."] || "";
        if (dt2) {
          try { var dd2 = new Date(dt2); if (!isNaN(dd2)) dateStr2 = TitusDate.format(dd2); } catch(e) {}
        }
        staffContactReport[empName].summaries.push({ date: dateStr2, text: summary.substring(0, 200), by: addedBy || "" });
      }
    });

    // Convert staff contact report to sorted array with ops narratives
    var staffContactList = Object.keys(staffContactReport).sort().map(function(k) {
      var s = staffContactReport[k];
      var rArr = Object.keys(s.reasons).map(function(r3) { return { reason: r3, count: s.reasons[r3] }; }).sort(function(a,b) { return b.count - a.count; });
      var mArr = Object.keys(s.methods).map(function(m2) { return { method: m2, count: s.methods[m2] }; }).sort(function(a,b) { return b.count - a.count; });
      var sums = s.summaries.sort(function(a,b) { return (b.date || "").localeCompare(a.date || ""); }).slice(0, 5);

      var narr = [];
      var channelStr = mArr.map(function(m3) { return m3.count + " " + m3.method; }).join(", ");
      narr.push(s.entries + " contact" + (s.entries > 1 ? "s" : "") + " recorded" + (channelStr ? " via " + channelStr : "") + ".");
      if (rArr.length > 0) {
        var reasonStr = rArr.slice(0, 3).map(function(r4) { return r4.reason + (r4.count > 1 ? " (" + r4.count + "x)" : ""); }).join(", ");
        narr.push("Primary reason" + (rArr.length > 1 ? "s" : "") + ": " + reasonStr + ".");
        var complianceKeywords = ["late", "missing", "overdue", "not submitted", "outstanding", "incomplete"];
        var hrKeywords = ["hr", "warning", "disciplinary", "performance", "conduct", "complaint"];
        var isCompliance = false, isHR = false;
        rArr.forEach(function(r5) {
          var rl = r5.reason.toLowerCase();
          complianceKeywords.forEach(function(kw) { if (rl.indexOf(kw) >= 0) isCompliance = true; });
          hrKeywords.forEach(function(kw) { if (rl.indexOf(kw) >= 0) isHR = true; });
        });
        if (isCompliance && rArr[0].count >= 2) {
          narr.push("Recurring compliance pattern detected — " + rArr[0].count + " entries for " + rArr[0].reason.toLowerCase() + ". Recommend direct follow-up with worker to address documentation timeliness.");
        }
        if (isHR) {
          narr.push("HR-related contact flagged — ensure appropriate documentation and follow-up actions are recorded.");
        }
      }
      if (sums.length > 0) {
        var mentionedClients = [];
        sums.forEach(function(sm) {
          if (sm.text) {
            var clientMatch = sm.text.match(/(?:for\s+\*{0,2})([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g);
            if (clientMatch) {
              clientMatch.forEach(function(m4) {
                var clean = m4.replace(/^for\s+\**/g, "").trim();
                if (clean.length > 3 && mentionedClients.indexOf(clean) < 0) mentionedClients.push(clean);
              });
            }
          }
        });
        if (mentionedClients.length > 0) {
          narr.push("Clients referenced: " + mentionedClients.slice(0, 4).join(", ") + (mentionedClients.length > 4 ? " and others" : "") + ".");
        }
        var actionedBy = {};
        sums.forEach(function(sm2) { if (sm2.by) actionedBy[sm2.by] = (actionedBy[sm2.by] || 0) + 1; });
        var abList = Object.keys(actionedBy);
        if (abList.length > 0) {
          narr.push("Actioned by: " + abList.slice(0, 3).map(function(a) { return a + (actionedBy[a] > 1 ? " (" + actionedBy[a] + ")" : ""); }).join(", ") + ".");
        }
      }

      return { name: s.name, entries: s.entries, reasons: rArr, methods: mArr, summaries: sums, opsNarrative: narr.join(" ") };
    }).sort(function(a, b) { return b.entries - a.entries; });

    // Client contacts analysis
    var clientContactMethods = {};
    var clientContactReasons = {};
    var clientContactByUser = {};
    filtered.clientContacts.forEach(function(r) {
      var f = r.fields || {};
      var methods = f["Method of Contact"] || [];
      if (typeof methods === "string") methods = [methods];
      if (Array.isArray(methods)) methods.forEach(function(m) { clientContactMethods[m] = (clientContactMethods[m] || 0) + 1; });
      var reasons = f["Reason for Contact"] || [];
      if (typeof reasons === "string") reasons = [reasons];
      if (Array.isArray(reasons)) reasons.forEach(function(r2) { clientContactReasons[r2] = (clientContactReasons[r2] || 0) + 1; });
      var addedBy = arrayVal(f[STAFF_FULLNAME_FIELD] || "");
      if (!addedBy) addedBy = arrayVal(f[STAFF_EMAIL_FIELD] || "");
      if (!addedBy) {
        Object.keys(f).forEach(function(fk) {
          var fl = fk.toLowerCase();
          if (!addedBy && fl.indexOf("full name") >= 0 && fl.indexOf("staff name") >= 0) addedBy = arrayVal(f[fk]);
        });
      }
      if (addedBy) clientContactByUser[addedBy] = (clientContactByUser[addedBy] || 0) + 1;

      var ccClient = arrayVal(f["Client Name"] || f["Client Name (from Client)"] || f["Full Name (from Client)"] || "");
      if (!ccClient) {
        Object.keys(f).forEach(function(fk) {
          if (!ccClient && fk.toLowerCase().indexOf("client") >= 0 && fk.toLowerCase().indexOf("name") >= 0) {
            ccClient = arrayVal(f[fk] || "");
          }
        });
      }
      if (ccClient) {
        if (!clientNarrative[ccClient]) clientNarrative[ccClient] = { pnContent: [], workers: {}, totalHours: 0 };
        if (!clientNarrative[ccClient].contacts) clientNarrative[ccClient].contacts = [];
        var ccSummary = f["Summarise"] || f["Summary"] || "";
        if (Array.isArray(ccSummary)) ccSummary = ccSummary[0] || "";
        if (!ccSummary) {
          Object.keys(f).forEach(function(fk2) {
            if (!ccSummary && fk2.toLowerCase().indexOf("summar") >= 0 && typeof f[fk2] === "string") ccSummary = f[fk2];
          });
        }
        var ccDate = f["Date & Time of Contact"] || "";
        var ccDateLabel = "";
        if (ccDate) { ccDateLabel = TitusDate.format(ccDate); }
        var ccReasons = Array.isArray(reasons) ? reasons.join(", ") : "";
        if (clientNarrative[ccClient].contacts.length < 5) {
          clientNarrative[ccClient].contacts.push({
            date: ccDateLabel, reason: ccReasons,
            summary: (ccSummary || "").substring(0, 150), by: addedBy || ""
          });
        }
      }
    });

    // ── EXPIRING AGREEMENTS ──
    var expiringDetails = [];
    var EXPIRY_FIELDS = [
      { field: "NDIS Plan Expiry Date", label: "NDIS Plan" },
      { field: "S/Agreement Expiry", label: "Service Agreement" },
      { field: "NDIS Plan Start Date", label: null }
    ];

    (results.clients || []).forEach(function(r) {
      var f = r.fields || {};
      var name = f["Client Name"] || f["Name"] || f["Full Name"] || "";
      if (Array.isArray(name)) name = name[0] || "";
      if (!name) return;
      var at = (f["Account Type: Active or Inactive or Propsect"] || f["Account Type: Active or Inactive or Prospect"] || "").toLowerCase();
      if (at.indexOf("active") < 0 && at.indexOf("prospect") < 0) return;

      EXPIRY_FIELDS.forEach(function(ef) {
        if (!ef.label) return;
        var val = f[ef.field];
        if (!val || typeof val !== "string") return;
        if (!val.match(/^\d{4}-/)) return;
        var expDate = new Date(val);
        if (isNaN(expDate)) return;
        var daysLeft = Math.ceil((expDate - now) / 86400000);
        if (daysLeft >= -30 && daysLeft <= 90) {
          expiringDetails.push({ client: name, expiryDate: TitusDate.format(expDate), daysLeft: daysLeft, type: ef.label });
        }
      });

      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if (fk === "NDIS Plan Expiry Date" || fk === "S/Agreement Expiry" || fk === "NDIS Plan Start Date") return;
        if ((fl.indexOf("sos") >= 0 && fl.indexOf("expir") >= 0) ||
            (fl.indexOf("expir") >= 0 && fl.indexOf("plan start") < 0 && fl.indexOf("risk") < 0 && fl.indexOf("month") < 0)) {
          var val2 = f[fk];
          if (typeof val2 === "string" && val2.match(/^\d{4}-/)) {
            var d2 = new Date(val2);
            if (!isNaN(d2)) {
              var dl2 = Math.ceil((d2 - now) / 86400000);
              if (dl2 >= -30 && dl2 <= 90) {
                expiringDetails.push({ client: name, expiryDate: TitusDate.format(d2), daysLeft: dl2, type: fk.replace(/expir.*/i, "").replace(/date/i, "").trim() || fk });
              }
            }
          }
        }
      });
    });
    expiringDetails.sort(function(a, b) { return a.daysLeft - b.daysLeft; });

    var expiryByType = {};
    expiringDetails.forEach(function(e) {
      if (!expiryByType[e.type]) expiryByType[e.type] = { expired: 0, expiring: 0 };
      if (e.daysLeft < 0) expiryByType[e.type].expired++;
      else expiryByType[e.type].expiring++;
    });

    var riskAssessExpired = 0;
    var riskAssessExpiring = 0;
    (results.clients || []).forEach(function(r) {
      var f = r.fields || {};
      var raVal = f["Risk Assessment Expiry Month"] || "";
      if (Array.isArray(raVal)) raVal = raVal[0] || "";
      if (!raVal || raVal === "#ERROR!" || raVal === "#ERROR") return;
      try {
        var raDate = new Date(raVal + " 1");
        if (!isNaN(raDate)) {
          var rdl = Math.ceil((raDate - now) / 86400000);
          if (rdl < 0) riskAssessExpired++;
          else if (rdl <= 90) riskAssessExpiring++;
        }
      } catch(e) {}
    });

    // ── PBSP ──
    var pbspExpiring = [];
    (results.pbsp || []).forEach(function(r) {
      var f = r.fields || {};
      var keys = Object.keys(f);
      for (var i = 0; i < keys.length; i++) {
        var kl = keys[i].toLowerCase();
        if ((kl.indexOf("expir") >= 0 || kl.indexOf("review") >= 0 || kl.indexOf("end") >= 0)
          && typeof f[keys[i]] === "string" && f[keys[i]].match(/^\d{4}-/)) {
          var d = new Date(f[keys[i]]);
          if (d <= sixtyDays && d >= new Date(now.getTime() - 30 * 86400000)) {
            var pbClient = arrayVal(findField(f, ["Client Name", "Name", "Client", "Full Name"]));
            pbspExpiring.push({ client: pbClient || "Unknown", date: TitusDate.format(d), daysLeft: Math.ceil((d - now) / 86400000) });
            break;
          }
        }
      }
    });

    // ── DAILY ACTIVITY ──
    var dailyActivity = {};
    ["progressNotes", "incidents", "employeeContacts", "clientContacts"].forEach(function(key) {
      (filtered[key] || []).forEach(function(r) {
        var d = findDate(r.fields || {});
        if (d) { var day = d.substring(0, 10); dailyActivity[day] = (dailyActivity[day] || 0) + 1; }
      });
    });

    // ── SUMMARY ──
    var activeWorkersCount = activeWorkersList.length + activeContractorsList.length;
    var summary = {
      progressNotes: filtered.progressNotes.length,
      incidents: filtered.incidents.length,
      reportableIncidents: reportableCount,
      employeeContacts: filtered.employeeContacts.length,
      clientContacts: filtered.clientContacts.length,
      sleepDisturbances: sleepCount,
      risksOrConcerns: riskCount,
      scheduleOfSupport: (filtered.scheduleOfSupport || []).length + (filtered.handover || []).length,
      expiringAgreements: expiringDetails.length,
      pbspExpiring60d: pbspExpiring.length,
      totalServiceHours: Math.round(pnTotalHours * 10) / 10,
      totalTransportTrips: pnTransport,
      totalKms: Math.round(pnTotalKms * 10) / 10,
      activeWorkers: activeWorkersCount,
      activeEmployees: activeWorkersList.length,
      activeContractors: activeContractorsList.length,
      activeClients: activeClientCount,
      activeSIL: activeSIL,
      activeCAS: activeCAS,
      prospectClients: prospectClientCount,
      prospectSIL: prospectSIL,
      prospectCAS: prospectCAS,
      expiryByType: expiryByType,
      riskAssessExpired: riskAssessExpired,
      riskAssessExpiring: riskAssessExpiring
    };

    // ── NARRATIVE ──
    var fromStr = TitusDate.format(fromDate);
    var toStr = TitusDate.format(toDate);
    var narrative = [];

    narrative.push("EXECUTIVE SUMMARY");
    narrative.push("This report covers DCS operations from " + fromStr + " to " + toStr + ".");
    narrative.push("");
    narrative.push("SERVICE DELIVERY");
    if (summary.progressNotes > 0) {
      narrative.push(summary.progressNotes + " progress notes completed by " + Object.keys(pnByWorker).length + " support workers across " + Object.keys(pnByClient).length + " clients" + (summary.totalServiceHours ? ", totalling " + summary.totalServiceHours + " service hours" : "") + ".");
      if (pnTransport > 0) narrative.push(pnTransport + " transport trips recorded (" + summary.totalKms + " km total).");
    } else {
      narrative.push("No progress notes were recorded for this period. This may indicate a data entry gap that should be investigated.");
    }
    narrative.push("");
    narrative.push("WORKFORCE");
    narrative.push(activeWorkersCount + " active staff (" + activeWorkersList.length + " employees, " + activeContractorsList.length + " independent contractors) from Active Contacts 2026.");
    narrative.push("");
    narrative.push("CLIENT BASE");
    narrative.push(activeClientCount + " active client(s) and " + prospectClientCount + " prospect(s) in Client Active View.");
    narrative.push("");
    narrative.push("INCIDENT MANAGEMENT");
    if (summary.incidents > 0) {
      narrative.push(summary.incidents + " incident(s) reported during this period.");
      if (reportableCount > 0) narrative.push("CRITICAL: " + reportableCount + " incident(s) are NDIS Reportable — must be reported to the Commission within 24hrs (immediate) and 5 business days (detailed).");
      if (Object.keys(incidentBreakdown).length > 0) narrative.push("Categories: " + Object.keys(incidentBreakdown).map(function(k) { return k + " (" + incidentBreakdown[k] + ")"; }).join(", ") + ".");
      var repeatClients = Object.keys(incidentsByClient).filter(function(k) { return incidentsByClient[k] > 1; });
      if (repeatClients.length > 0) narrative.push("Repeat incidents: " + repeatClients.join(", ") + ". Review behaviour support plans.");
    } else { narrative.push("No incidents reported."); }
    narrative.push("");
    narrative.push("COMMUNICATION & CONTACT HISTORY");
    if (summary.employeeContacts > 0 || summary.clientContacts > 0) {
      narrative.push(summary.employeeContacts + " employee contacts and " + summary.clientContacts + " client contacts logged.");
      if (Object.keys(empContactReasons).length > 0) narrative.push("Top employee reasons: " + Object.keys(empContactReasons).sort(function(a, b) { return empContactReasons[b] - empContactReasons[a]; }).slice(0, 5).map(function(k) { return k + " (" + empContactReasons[k] + ")"; }).join(", ") + ".");
      if (Object.keys(clientContactReasons).length > 0) narrative.push("Top client reasons: " + Object.keys(clientContactReasons).sort(function(a, b) { return clientContactReasons[b] - clientContactReasons[a]; }).slice(0, 5).map(function(k) { return k + " (" + clientContactReasons[k] + ")"; }).join(", ") + ".");
    }
    narrative.push("");
    if (sleepCount > 0) {
      narrative.push("PARTICIPANT WELLBEING");
      narrative.push(sleepCount + " sleep disturbance(s) flagged in progress notes.");
      var sleepRepeat = Object.keys(sleepByClient).filter(function(k) { return sleepByClient[k].length > 1; });
      if (sleepRepeat.length > 0) narrative.push("Recurring for: " + sleepRepeat.map(function(k) { return k + " (" + sleepByClient[k].length + "x)"; }).join(", ") + ". Recommend reviewing sleep plans.");
      narrative.push("");
    }
    if (riskCount > 0) {
      narrative.push("RISKS & CONCERNS");
      narrative.push(riskCount + " risk(s)/concern(s) flagged by staff in progress notes. Require management review.");
      narrative.push("");
    }
    narrative.push("COMPLIANCE & EXPIRY ALERTS");
    if (expiringDetails.length > 0) {
      var expired = expiringDetails.filter(function(e) { return e.daysLeft < 0; });
      var expiringSoon = expiringDetails.filter(function(e) { return e.daysLeft >= 0 && e.daysLeft <= 30; });
      if (expired.length > 0) narrative.push(expired.length + " service agreement(s) EXPIRED.");
      if (expiringSoon.length > 0) narrative.push(expiringSoon.length + " agreement(s) expiring within 30 days.");
    }
    if (pbspExpiring.length > 0) narrative.push(pbspExpiring.length + " PBSP(s) due for review within 60 days.");
    if (expiringDetails.length === 0 && pbspExpiring.length === 0) narrative.push("No critical expiries identified.");
    narrative.push("");
    narrative.push("RECOMMENDATIONS");
    var recs = [];
    if (reportableCount > 0) recs.push("Ensure all NDIS Reportable Incidents lodged with Commission within required timeframes.");
    if (riskCount > 0) recs.push("Schedule risk review meeting for " + riskCount + " flagged concern(s).");
    if (sleepCount > 0) recs.push("Review sleep disturbance patterns; consult allied health where recurring.");
    if (expiringDetails.length > 0) recs.push("Prioritise service agreement renewals for " + expiringDetails.length + " expiring agreement(s).");
    if (pbspExpiring.length > 0) recs.push("Arrange PBSP review sessions for " + pbspExpiring.length + " participant(s).");
    if (summary.progressNotes === 0) recs.push("Investigate missing progress notes — possible staff compliance issue.");
    if (recs.length === 0) recs.push("Operations running smoothly. Continue routine monitoring.");
    recs.forEach(function(r2, i) { narrative.push((i + 1) + ". " + r2); });

    // ── CLIENT ROSTER ──
    var clientRoster = { sil: [], cas: [], prospects: [] };
    (results.clients || []).forEach(function(r) {
      var f = r.fields || {};
      var name = f["Client Name"] || f["Name"] || f["Full Name"] || "";
      if (Array.isArray(name)) name = name[0] || "";
      if (!name) return;
      var accountType = f["Account Type: Active or Inactive or Propsect"] || f["Account Type: Active or Inactive or Prospect"] || f["Account Type"] || "";
      var requiredSkills = f["Required Staff Skills"] || [];
      if (!Array.isArray(requiredSkills)) requiredSkills = requiredSkills ? [requiredSkills] : [];
      var ndisType = f["Type of NDIS Plan"] || f["NDIS Plan Type"] || "";
      if (Array.isArray(ndisType)) ndisType = ndisType.join(", ");
      var sc = ""; var suburb = ""; var ndisExpiry = "";
      Object.keys(f).forEach(function(fk) {
        var fl = fk.toLowerCase();
        if (fl.indexOf("support coordinator") >= 0 && !sc) sc = arrayVal(f[fk]);
        if ((fl === "suburb" || fl === "location") && !suburb) suburb = arrayVal(f[fk]);
      });
      ndisExpiry = f["NDIS Plan Expiry Date"] || "";
      var planEnd = f["NDIS Plan Start Date"] || "";
      var agreementExpiry = f["S/Agreement Expiry"] || "";
      var riskAssessExpiry = f["Risk Assessment Expiry Month"] || "";
      if (riskAssessExpiry === "#ERROR!" || riskAssessExpiry === "#ERROR") riskAssessExpiry = "";
      var silCasField = arrayVal(f["SIL or CAS?"] || "").toLowerCase();
      var isSIL = silCasField.indexOf("sil") >= 0;

      var clientObj = {
        name: name, skills: requiredSkills, ndisType: ndisType, supportCoordinator: sc,
        suburb: suburb, planEnd: ndisExpiry || planEnd, isSIL: isSIL, agreementExpiry: agreementExpiry,
        ndisExpiry: ndisExpiry, riskAssessmentExpiry: riskAssessExpiry,
        clientType: silCasField.indexOf("sil") >= 0 ? "SIL" : "CAS",
        accountType: accountType
      };
      var acLower = accountType.toLowerCase();
      if (acLower.indexOf("prospect") >= 0) clientRoster.prospects.push(clientObj);
      else if (acLower.indexOf("active") >= 0 || acLower === "") {
        if (isSIL) clientRoster.sil.push(clientObj);
        else clientRoster.cas.push(clientObj);
      }
    });
    clientRoster.sil.sort(function(a, b) { return a.name.localeCompare(b.name); });
    clientRoster.cas.sort(function(a, b) { return a.name.localeCompare(b.name); });
    clientRoster.prospects.sort(function(a, b) { return a.name.localeCompare(b.name); });

    function attachCounts(list) {
      list.forEach(function(c) {
        c.progressNotes = pnByClient[c.name] || 0;
        c.incidents = incidentsByClient[c.name] || 0;
        c.sleepIssues = sleepByClient[c.name] ? sleepByClient[c.name].length : 0;
        c.kms = Math.round((kmsByClient[c.name] || 0) * 10) / 10;

        var cn = clientNarrative[c.name];
        if (!cn) { c.opsNarrative = ""; return; }
        var p1 = [];
        var p2 = [];
        var noteCount = pnByClient[c.name] || 0;
        var workerNames = cn.workers ? Object.keys(cn.workers) : [];
        var workerCount = workerNames.length;
        var hrs = Math.round(cn.totalHours * 10) / 10;

        if (noteCount > 0) {
          var deliveryLine = noteCount + " progress note" + (noteCount > 1 ? "s" : "") + " recorded";
          if (hrs > 0) deliveryLine += " across " + hrs + " hours of support delivery";
          deliveryLine += ".";
          p1.push(deliveryLine);
          if (workerCount === 1) { p1.push("Sole support worker: " + workerNames[0] + "."); }
          else if (workerCount > 1 && workerCount <= 4) { p1.push("Support provided by " + workerNames.join(", ") + "."); }
          else if (workerCount > 4) {
            var topW = workerNames.sort(function(a, b) { return cn.workers[b] - cn.workers[a]; }).slice(0, 3);
            p1.push(workerCount + " workers rostered. Primary: " + topW.join(", ") + ".");
          }
        } else {
          p1.push("No progress notes recorded this period — requires follow-up to confirm service delivery and roster coverage.");
        }
        if (cn.pnContent && cn.pnContent.length > 0) {
          var sorted2 = cn.pnContent.slice().sort(function(a, b) { return (b.text || "").length - (a.text || "").length; });
          var snippet = sorted2[0].text || "";
          if (snippet.length > 30) {
            p1.push("Recent notes include: \"" + snippet.substring(0, 140) + (snippet.length > 140 ? "..." : "") + "\"");
          }
        }
        if (c.kms > 0) { p1.push(c.kms + " km transport claimed this period."); }

        var incCount = incidentsByClient[c.name] || 0;
        var sleepN = sleepByClient[c.name] ? sleepByClient[c.name].length : 0;
        var riskN = riskDetails.filter(function(rd) { return rd.client === c.name; }).length;
        var contactN = cn.contacts ? cn.contacts.length : 0;
        var hasFlags = incCount > 0 || sleepN > 0 || riskN > 0 || contactN > 0;

        if (hasFlags) {
          if (incCount > 0) {
            var incLine = incCount + " incident" + (incCount > 1 ? "s" : "") + " reported";
            if (cn.incidents && cn.incidents.length > 0) {
              var catMap = {};
              var repCount = 0;
              cn.incidents.forEach(function(i2) {
                if (i2.category) i2.category.split(", ").forEach(function(ct) { if (ct.trim()) catMap[ct.trim()] = 1; });
                if (i2.reportable) repCount++;
              });
              var catList = Object.keys(catMap);
              if (catList.length > 0) incLine += " (" + catList.slice(0, 3).join(", ") + ")";
              if (repCount > 0) incLine += " — <strong style='color:var(--red)'>" + repCount + " NDIS Reportable</strong>";
            }
            p2.push(incLine + ".");
          }
          if (riskN > 0) {
            var cRisks = riskDetails.filter(function(rd2) { return rd2.client === c.name; });
            var riskLine = riskN + " concern" + (riskN > 1 ? "s" : "") + " flagged by staff";
            if (cRisks[0] && cRisks[0].summary && cRisks[0].summary.length > 10) {
              var rSnip = cRisks[0].summary.substring(0, 80);
              riskLine += ": \"" + rSnip + (cRisks[0].summary.length > 80 ? "..." : "") + "\"";
            }
            p2.push(riskLine + ".");
          }
          if (sleepN > 0) { p2.push(sleepN + " sleep disturbance" + (sleepN > 1 ? "s" : "") + " recorded — review overnight support arrangements."); }
          if (contactN > 0) {
            var ccLine2 = contactN + " client contact record" + (contactN > 1 ? "s" : "") + " logged";
            var ccReasons2 = {};
            cn.contacts.forEach(function(cc2) {
              if (cc2.reason) cc2.reason.split(", ").forEach(function(r6) { if (r6.trim()) ccReasons2[r6.trim()] = 1; });
            });
            var rrList = Object.keys(ccReasons2);
            if (rrList.length > 0) ccLine2 += " re: " + rrList.slice(0, 3).join(", ");
            p2.push(ccLine2 + ".");
          }
        } else {
          p2.push("No incidents, concerns, or client contacts logged this period. Service delivery appears stable.");
        }
        c.opsNarrative = "<p style='margin:0 0 4px'>" + p1.join(" ") + "</p><p style='margin:0'>" + p2.join(" ") + "</p>";
      });
    }
    attachCounts(clientRoster.sil);
    attachCounts(clientRoster.cas);
    attachCounts(clientRoster.prospects);

    // ── READY TO WORK ──
    var readyToWorkList = [];
    (results.readyToWork || []).forEach(function(r) {
      var f = r.fields || {};
      var name = f["Full Name"] || f["Name"] || "";
      if (Array.isArray(name)) name = name[0] || "";
      var email = f["Email"] || "";
      if (Array.isArray(email)) email = email[0] || "";
      var mobile = f["Mobile"] || f["Phone"] || "";
      if (Array.isArray(mobile)) mobile = mobile[0] || "";
      var suburb = f["Suburb"] || f["Location"] || "";
      if (Array.isArray(suburb)) suburb = suburb[0] || "";
      var ethnicity = f["Cultural Ethnicity"] || f["Ethnicity"] || "";
      if (Array.isArray(ethnicity)) ethnicity = ethnicity[0] || "";
      var mandatoryDocs = f["Mandatory Docs Percentage"] || f["Mandatory Docs..."] || f["Mandatory Docs"] || "";
      if (!mandatoryDocs) {
        Object.keys(f).forEach(function(fk) {
          if (fk.toLowerCase().indexOf("mandatory") >= 0 && fk.toLowerCase().indexOf("doc") >= 0) {
            mandatoryDocs = f[fk] || "";
          }
        });
      }
      if (typeof mandatoryDocs === "number") mandatoryDocs = Math.round(mandatoryDocs * 100) + "%";
      var gender = f["Gender"] || f["Sex"] || "";
      if (Array.isArray(gender)) gender = gender[0] || "";
      if (!gender) {
        Object.keys(f).forEach(function(fk) {
          if (!gender && fk.toLowerCase().indexOf("gender") >= 0) gender = arrayVal(f[fk] || "");
        });
      }
      readyToWorkList.push({ name: name, email: email, mobile: mobile, suburb: suburb, ethnicity: ethnicity, gender: gender, mandatoryDocs: mandatoryDocs });
    });

    narrative.push("");
    narrative.push("CLIENT ROSTER");
    narrative.push(activeClientCount + " active client(s) and " + prospectClientCount + " prospect(s).");
    narrative.push(clientRoster.sil.length + " SIL and " + clientRoster.cas.length + " CAS.");
    var noNotes = clientRoster.sil.concat(clientRoster.cas).filter(function(c) { return c.progressNotes === 0; });
    if (noNotes.length > 0 && summary.progressNotes > 0) {
      narrative.push(noNotes.length + " active client(s) with no progress notes this period: " + noNotes.map(function(c) { return c.name; }).slice(0, 10).join(", ") + (noNotes.length > 10 ? "..." : "") + ".");
    }

    res.json({
      summary: summary,
      narrative: narrative.join("\n"),
      topWorkers: topWorkers,
      topClients: topClients,
      incidentBreakdown: Object.keys(incidentBreakdown).length > 0 ? incidentBreakdown : null,
      incidentDetails: incidentDetails.slice(0, 25),
      empContactMethods: Object.keys(empContactMethods).length > 0 ? empContactMethods : null,
      empContactReasons: Object.keys(empContactReasons).length > 0 ? empContactReasons : null,
      clientContactReasons: Object.keys(clientContactReasons).length > 0 ? clientContactReasons : null,
      clientContactMethods: Object.keys(clientContactMethods).length > 0 ? clientContactMethods : null,
      sleepByClient: Object.keys(sleepByClient).length > 0 ? sleepByClient : null,
      riskDetails: riskDetails.length > 0 ? riskDetails : null,
      expiringDetails: expiringDetails.length > 0 ? expiringDetails : null,
      pbspExpiring: pbspExpiring.length > 0 ? pbspExpiring : null,
      dailyActivity: Object.keys(dailyActivity).length > 0 ? dailyActivity : null,
      clientRoster: clientRoster,
      activeWorkersList: activeWorkersList.concat(activeContractorsList),
      empContactByUser: Object.keys(empContactByUser).length > 0 ? empContactByUser : null,
      clientContactByUser: Object.keys(clientContactByUser).length > 0 ? clientContactByUser : null,
      readyToWork: readyToWorkList.length > 0 ? readyToWorkList : null,
      incidentsByCatClient: incidentsByCatClient.length > 0 ? incidentsByCatClient : null,
      incidentsByMonth: incMonthsSorted.length > 0 ? incMonthsSorted : null,
      openIncidentsTotal: openTotal,
      closedIncidentsTotal: closedTotal,
      staffContactReport: staffContactList.length > 0 ? staffContactList : null
    });
  }).catch(function(err) {
    res.status(500).json({ error: "Failed to generate report: " + err.message });
  });
}

module.exports = opsReportHandler;

// ═══════════════════════════════════════════════
// ═══ ROSTER OF CARE (RoC) — RATES & HELPERS ═══
// ═══════════════════════════════════════════════

// NDIS Price Guide 2025-26 Line Items
var ROC_LINE_ITEMS = [
  // SIL — Supported Independent Living
  { code: "01_011_0107_1_1", description: "SIL Weekday Daytime", unit: "H", priceWeekday: 65.47, priceSaturday: 91.66, priceSunday: 117.85, pricePublicHoliday: 144.03, priceEvening: 75.29 },
  { code: "01_011_0107_1_1_S", description: "SIL Saturday", unit: "H", priceWeekday: 91.66, priceSaturday: 91.66, priceSunday: 91.66, pricePublicHoliday: 91.66, priceEvening: 91.66 },
  { code: "01_011_0107_1_1_SU", description: "SIL Sunday", unit: "H", priceWeekday: 117.85, priceSaturday: 117.85, priceSunday: 117.85, pricePublicHoliday: 117.85, priceEvening: 117.85 },
  { code: "01_011_0107_1_1_PH", description: "SIL Public Holiday", unit: "H", priceWeekday: 144.03, priceSaturday: 144.03, priceSunday: 144.03, pricePublicHoliday: 144.03, priceEvening: 144.03 },
  { code: "01_012_0107_1_1", description: "SIL Weekday Evening", unit: "H", priceWeekday: 75.29, priceSaturday: 75.29, priceSunday: 75.29, pricePublicHoliday: 75.29, priceEvening: 75.29 },
  { code: "01_013_0107_1_1", description: "SIL Weekday Night", unit: "H", priceWeekday: 72.10, priceSaturday: 100.94, priceSunday: 129.78, pricePublicHoliday: 158.62, priceEvening: 72.10 },
  { code: "01_015_0107_1_1", description: "SIL Sleepover", unit: "EA", priceWeekday: 62.47, priceSaturday: 62.47, priceSunday: 62.47, pricePublicHoliday: 62.47, priceEvening: 62.47 },

  // SIL High Intensity
  { code: "01_011_0107_1_1_H", description: "SIL High Intensity Weekday Daytime", unit: "H", priceWeekday: 70.88, priceSaturday: 99.23, priceSunday: 127.58, pricePublicHoliday: 155.94, priceEvening: 81.51 },
  { code: "01_011_0107_1_1_HS", description: "SIL High Intensity Saturday", unit: "H", priceWeekday: 99.23, priceSaturday: 99.23, priceSunday: 99.23, pricePublicHoliday: 99.23, priceEvening: 99.23 },
  { code: "01_011_0107_1_1_HSU", description: "SIL High Intensity Sunday", unit: "H", priceWeekday: 127.58, priceSaturday: 127.58, priceSunday: 127.58, pricePublicHoliday: 127.58, priceEvening: 127.58 },

  // Community Access
  { code: "04_104_0125_6_1", description: "Community Access Weekday", unit: "H", priceWeekday: 65.47, priceSaturday: 91.66, priceSunday: 117.85, pricePublicHoliday: 144.03, priceEvening: 75.29 },
  { code: "04_104_0125_6_1_S", description: "Community Access Saturday", unit: "H", priceWeekday: 91.66, priceSaturday: 91.66, priceSunday: 91.66, pricePublicHoliday: 91.66, priceEvening: 91.66 },
  { code: "04_104_0125_6_1_SU", description: "Community Access Sunday", unit: "H", priceWeekday: 117.85, priceSaturday: 117.85, priceSunday: 117.85, pricePublicHoliday: 117.85, priceEvening: 117.85 },
  { code: "04_104_0125_6_1_PH", description: "Community Access Public Holiday", unit: "H", priceWeekday: 144.03, priceSaturday: 144.03, priceSunday: 144.03, pricePublicHoliday: 144.03, priceEvening: 144.03 },
  { code: "04_104_0125_6_1_E", description: "Community Access Evening", unit: "H", priceWeekday: 75.29, priceSaturday: 75.29, priceSunday: 75.29, pricePublicHoliday: 75.29, priceEvening: 75.29 },

  // Transport
  { code: "15_037_0117_1_3", description: "Transport", unit: "KM", priceWeekday: 0.97, priceSaturday: 0.97, priceSunday: 0.97, pricePublicHoliday: 0.97, priceEvening: 0.97 },
  { code: "15_038_0117_1_3", description: "Transport — Provider Travel Non-Labour", unit: "KM", priceWeekday: 0.97, priceSaturday: 0.97, priceSunday: 0.97, pricePublicHoliday: 0.97, priceEvening: 0.97 },

  // Active Overnight
  { code: "01_002_0107_1_1", description: "Active Overnight Weekday", unit: "H", priceWeekday: 72.10, priceSaturday: 100.94, priceSunday: 129.78, pricePublicHoliday: 158.62, priceEvening: 72.10 },
  { code: "01_002_0107_1_1_S", description: "Active Overnight Saturday", unit: "H", priceWeekday: 100.94, priceSaturday: 100.94, priceSunday: 100.94, pricePublicHoliday: 100.94, priceEvening: 100.94 },
  { code: "01_002_0107_1_1_SU", description: "Active Overnight Sunday", unit: "H", priceWeekday: 129.78, priceSaturday: 129.78, priceSunday: 129.78, pricePublicHoliday: 129.78, priceEvening: 129.78 }
];

// QLD Public Holidays July 2025 - June 2026
var QLD_PUBLIC_HOLIDAYS_2025_26 = [
  { date: "2025-08-13", name: "Royal Queensland Show (Brisbane)" },
  { date: "2025-10-06", name: "King's Birthday" },
  { date: "2025-12-25", name: "Christmas Day" },
  { date: "2025-12-26", name: "Boxing Day" },
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-26", name: "Australia Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-04", name: "Saturday before Easter Sunday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-04-25", name: "Anzac Day" },
  { date: "2026-05-04", name: "Labour Day (QLD)" }
];

// SCHADS Award Loading Multipliers
var SCHADS_LOADINGS = {
  weekday: 1.0,
  saturdayCasual: 1.75,
  saturdayPermanent: 1.5,
  sundayCasual: 2.25,
  sundayPermanent: 2.0,
  publicHolidayCasual: 2.75,
  publicHolidayPermanent: 2.5,
  eveningAfter8pm: 1.15,
  overnight: 1.15,
  casualLoading: 0.25,
  overtimeFirst2hrs: 1.5,
  overtimeAfter2hrs: 2.0,
  sleepoverAllowance: 62.47,
  minimumShiftHours: 2
};

/**
 * getDayType — returns day classification based on date and holiday list
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {Array} holidays - array of {date, name}
 * @returns {"weekday"|"saturday"|"sunday"|"publicHoliday"}
 */
function getDayType(dateStr, holidays) {
  if (!dateStr) return "weekday";
  var isHoliday = holidays.some(function(h) { return h.date === dateStr; });
  if (isHoliday) return "publicHoliday";
  var d = new Date(dateStr + "T00:00:00");
  var day = d.getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

/**
 * getTimeOfDay — returns time classification based on start/end hours
 * @param {number} startHour - 0-23
 * @param {number} endHour - 0-23
 * @returns {"day"|"evening"|"overnight"}
 */
function getTimeOfDay(startHour, endHour) {
  if (startHour >= 0 && startHour < 6) return "overnight";
  if (endHour > 0 && endHour <= 6) return "overnight";
  if (startHour >= 20 || endHour > 20) return "evening";
  return "day";
}

/**
 * calculateShiftCost — calculates cost for a single shift
 * @param {Object} lineItem - from ROC_LINE_ITEMS
 * @param {string} dayType - "weekday"|"saturday"|"sunday"|"publicHoliday"
 * @param {string} timeOfDay - "day"|"evening"|"overnight"
 * @param {number} hours - duration in hours
 * @param {number} ratio - support ratio (e.g. 1 = 1:1, 2 = 1:2 shared)
 * @returns {number} calculated cost
 */
function calculateShiftCost(lineItem, dayType, timeOfDay, hours, ratio) {
  if (!lineItem || !hours) return 0;
  var r = ratio || 1;
  var price = 0;
  if (timeOfDay === "evening") {
    price = lineItem.priceEvening || lineItem.priceWeekday;
  } else if (dayType === "publicHoliday") {
    price = lineItem.pricePublicHoliday;
  } else if (dayType === "sunday") {
    price = lineItem.priceSunday;
  } else if (dayType === "saturday") {
    price = lineItem.priceSaturday;
  } else {
    price = lineItem.priceWeekday;
  }
  // For per-each items (sleepover), don't multiply by hours
  if (lineItem.unit === "EA") {
    return Math.round((price / r) * 100) / 100;
  }
  return Math.round((price * hours / r) * 100) / 100;
}

module.exports = {
  ROC_LINE_ITEMS: ROC_LINE_ITEMS,
  QLD_PUBLIC_HOLIDAYS_2025_26: QLD_PUBLIC_HOLIDAYS_2025_26,
  SCHADS_LOADINGS: SCHADS_LOADINGS,
  getDayType: getDayType,
  getTimeOfDay: getTimeOfDay,
  calculateShiftCost: calculateShiftCost
};

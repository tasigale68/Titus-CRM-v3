// SCHADS Award 2024 Rates for Titus CRM
// Social, Community, Home Care and Disability Services Industry Award

var RATES = {
  '1.1': { description: 'Level 1.1 - Entry', hourly: 23.53 },
  '1.2': { description: 'Level 1.2', hourly: 24.07 },
  '1.3': { description: 'Level 1.3', hourly: 24.61 },
  '2.1': { description: 'Level 2.1', hourly: 25.15 },
  '2.2': { description: 'Level 2.2', hourly: 25.69 },
  '2.3': { description: 'Level 2.3', hourly: 26.23 },
  '3.1': { description: 'Level 3.1', hourly: 27.31 },
  '3.2': { description: 'Level 3.2', hourly: 27.85 },
  '3.3': { description: 'Level 3.3', hourly: 28.39 },
  '4.1': { description: 'Level 4.1 - Senior/Team Leader', hourly: 29.93 },
  '4.2': { description: 'Level 4.2', hourly: 30.47 }
};

var PENALTIES = {
  weekday: 1.0,
  saturday: 1.25,
  sunday: 1.5,
  public_holiday: 2.5,
  overtime_first2: 1.5,
  overtime_after2: 2.0
};

var ALLOWANCES = {
  sleepover: 58.57,
  split_shift: 16.38
};

var SUPER_RATE = 0.115; // 11.5%

function getRate(level) {
  return RATES[level] || RATES['2.1'];
}

function calculateShiftCost(params) {
  // params: { level, hours, dayType, isOvertime, overtimeHours, isSleepover, isSplitShift }
  var rate = getRate(params.level || '2.1');
  var hourly = rate.hourly;
  var hours = params.hours || 0;
  var dayType = params.dayType || 'weekday';
  var penalty = PENALTIES[dayType] || 1.0;

  var baseCost = hourly * hours * penalty;

  // Overtime
  var otCost = 0;
  if (params.isOvertime && params.overtimeHours) {
    var otHrs = params.overtimeHours;
    var ot15 = Math.min(otHrs, 2);
    var ot20 = Math.max(0, otHrs - 2);
    otCost = (hourly * ot15 * PENALTIES.overtime_first2) + (hourly * ot20 * PENALTIES.overtime_after2);
    baseCost = hourly * (hours - otHrs) * penalty; // Recalculate ordinary portion
  }

  var sleepoverCost = params.isSleepover ? ALLOWANCES.sleepover : 0;
  var splitShiftCost = params.isSplitShift ? ALLOWANCES.split_shift : 0;

  var grossPay = baseCost + otCost + sleepoverCost + splitShiftCost;
  var superAmount = grossPay * SUPER_RATE;
  var totalCost = grossPay + superAmount;

  return {
    hourly_rate: hourly,
    hours: hours,
    day_type: dayType,
    penalty_multiplier: penalty,
    base_cost: Math.round(baseCost * 100) / 100,
    overtime_cost: Math.round(otCost * 100) / 100,
    sleepover_cost: sleepoverCost,
    split_shift_cost: splitShiftCost,
    gross_pay: Math.round(grossPay * 100) / 100,
    super_amount: Math.round(superAmount * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100
  };
}

// Check compliance warnings for a shift
function checkCompliance(params) {
  // params: { workerShifts (array of {start, end}), currentShift: {start, end}, weeklyHours, dailyHours, isPartTime, guaranteedHours, monthsEmployed, isCasual }
  var warnings = [];

  // 1. Minimum 10hr break between shifts
  if (params.workerShifts && params.currentShift) {
    var cs = params.currentShift;
    params.workerShifts.forEach(function(s) {
      var gapHours;
      if (new Date(s.end) <= new Date(cs.start)) {
        gapHours = (new Date(cs.start) - new Date(s.end)) / (1000 * 60 * 60);
      } else if (new Date(cs.end) <= new Date(s.start)) {
        gapHours = (new Date(s.start) - new Date(cs.end)) / (1000 * 60 * 60);
      }
      if (gapHours !== undefined && gapHours < 10) {
        warnings.push({ type: 'min_break', severity: 'red', message: 'Less than 10hr break between shifts (' + Math.round(gapHours * 10) / 10 + 'hrs gap)', rule: 'SCHADS cl.25.6' });
      }
    });
  }

  // 2. Over 10 ordinary hours in a day
  if (params.dailyHours && params.dailyHours > 10) {
    warnings.push({ type: 'daily_hours', severity: 'amber', message: 'Over 10 ordinary hours in a day (' + params.dailyHours + 'hrs)', rule: 'SCHADS cl.25.1' });
  }

  // 3. Over 38 ordinary hours in a week
  if (params.weeklyHours && params.weeklyHours > 38) {
    warnings.push({ type: 'weekly_hours', severity: 'amber', message: 'Over 38 ordinary hours in a week (' + params.weeklyHours + 'hrs). Overtime applies.', rule: 'SCHADS cl.25.1' });
  }

  // 4. Part-time below guaranteed hours
  if (params.isPartTime && params.guaranteedHours && params.weeklyHours < params.guaranteedHours) {
    warnings.push({ type: 'below_guaranteed', severity: 'amber', message: 'Part-time worker below guaranteed hours (' + params.weeklyHours + '/' + params.guaranteedHours + 'hrs)', rule: 'SCHADS cl.10.3' });
  }

  // 5. Casual conversion eligibility
  if (params.isCasual && params.monthsEmployed && params.monthsEmployed >= 12) {
    warnings.push({ type: 'casual_conversion', severity: 'info', message: 'Casual conversion eligibility: employed ' + params.monthsEmployed + ' months', rule: 'SCHADS cl.15.7' });
  }

  return warnings;
}

function getDayType(date) {
  // Returns weekday, saturday, sunday, or public_holiday
  // For now just check day of week; public holidays need separate list
  var d = new Date(date);
  var day = d.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

module.exports = {
  RATES: RATES,
  PENALTIES: PENALTIES,
  ALLOWANCES: ALLOWANCES,
  SUPER_RATE: SUPER_RATE,
  getRate: getRate,
  calculateShiftCost: calculateShiftCost,
  checkCompliance: checkCompliance,
  getDayType: getDayType
};

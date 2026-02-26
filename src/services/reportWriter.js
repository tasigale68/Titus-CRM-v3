// Titus CRM — AI Report Writer (NDIS Weekly Progress Reports)
// Uses Anthropic Claude API to generate formal NDIS participant progress reports

var ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();

function generateReport(params) {
  // params: { org_name, client_name, ndis_number, plan_type, start_date, end_date,
  //   goals_list, progress_notes, incidents, hours_summary,
  //   sc_name, sc_org, pm_name, pm_org, bp_name, guardian_name,
  //   notes_count, incidents_count }

  var systemPrompt = 'You are a senior NDIS report writer for ' + params.org_name + ', a registered NDIS provider in Australia. Write a formal 2-page NDIS Participant Progress Report for the participant below.\n\nWrite in formal NDIS provider language. Person-centred and strengths-based. Goal-focused. Flowing paragraphs only. No bullet points. Do not mention AI or Titus CRM. Max 2 A4 pages. Tone: senior Service Delivery Manager.';

  var userPrompt = 'PARTICIPANT: ' + params.client_name + ' | NDIS: ' + (params.ndis_number || 'N/A') + ' | Plan: ' + (params.plan_type || 'Agency Managed') + '\n' +
    'PERIOD: ' + params.start_date + ' to ' + params.end_date + '\n' +
    'GOALS: ' + (params.goals_list || 'No goals recorded') + '\n' +
    'PROGRESS NOTES (' + (params.notes_count || 0) + '): ' + (params.progress_notes || 'No notes this period') + '\n' +
    'INCIDENTS (' + (params.incidents_count || 0) + '): ' + (params.incidents || 'No incidents this period') + '\n' +
    'HOURS: ' + (params.hours_summary || 'No hours recorded') + '\n' +
    'SC: ' + (params.sc_name || 'N/A') + ' - ' + (params.sc_org || '') + ' | PM: ' + (params.pm_name || 'N/A') + ' - ' + (params.pm_org || '') + '\n' +
    'BP: ' + (params.bp_name || 'N/A') + ' | Guardian: ' + (params.guardian_name || 'N/A') + '\n\n' +
    'Write the report with these sections:\n' +
    '1. SUPPORT DELIVERED THIS PERIOD (1 paragraph, 4-6 sentences)\n' +
    '2. PROGRESS TOWARD NDIS PLAN GOALS (2-3 paragraphs per goal)\n' +
    '3. INCIDENT AND BEHAVIOUR SUMMARY (formal paragraph or "No reportable incidents")\n' +
    '4. RECOMMENDATIONS AND FORWARD PLANNING (1 paragraph)\n\n' +
    'Return the report content only. No headers or formatting markers.';

  if (!ANTHROPIC_API_KEY) return Promise.reject(new Error('ANTHROPIC_API_KEY not configured'));

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Claude API ' + r.status + ': ' + t.substring(0, 300)); });
    return r.json();
  }).then(function(data) {
    var text = '';
    if (data.content && data.content.length) text = data.content[0].text || '';
    return text;
  });
}

module.exports = { generateReport };

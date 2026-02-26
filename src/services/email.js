const env = require('../config/env');
const { db } = require('../db/sqlite');

let msGraphToken = null;
let msGraphTokenExpiry = 0;

async function getMsGraphToken() {
  if (msGraphToken && Date.now() < msGraphTokenExpiry - 60000) return msGraphToken;

  if (!env.microsoft.tenantId || !env.microsoft.clientId || !env.microsoft.clientSecret) {
    throw new Error('Microsoft Graph not configured');
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${env.microsoft.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.microsoft.clientId,
        client_secret: env.microsoft.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get MS Graph token');

  msGraphToken = data.access_token;
  msGraphTokenExpiry = Date.now() + data.expires_in * 1000;
  return msGraphToken;
}

async function msGraphFetch(endpoint, method, body) {
  const token = await getMsGraphToken();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://graph.microsoft.com/v1.0${endpoint}`;

  const options = {
    method: method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (method === 'POST' && res.status === 202) return {};
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MS Graph ${res.status}: ${text}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

// ─── Welcome Email ────────────────────────────────────────

const WELCOME_EMAIL_TEMPLATE = {
  subject: 'Welcome to Delta Community Support — Your Titus Account is Ready',
  body: function (name, email, password, role, jobTitle) {
    var firstName = (name || email || '').split(' ')[0] || 'there';
    var portalUrl =
      process.env.RAILWAY_STATIC_URL ||
      process.env.BASE_URL ||
      'https://prolific-transformation-production.up.railway.app';
    var roleLabel = role
      ? role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')
      : 'Team Member';
    var jobLine = jobTitle
      ? "<p style='margin:0 0 6px'><strong>Job Title:</strong> " + jobTitle + '</p>'
      : '';
    return (
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">' +
      '<div style="max-width:600px;margin:0 auto;padding:20px">' +
      '<div style="background:#0B1D3A;padding:30px 24px;border-radius:12px 12px 0 0;text-align:center">' +
      '<h1 style="margin:0;color:#00B4D8;font-size:22px;font-weight:700">Delta Community Support</h1>' +
      '<p style="margin:8px 0 0;color:rgba(255,255,255,.7);font-size:13px">Titus CRM Platform</p></div>' +
      '<div style="background:#ffffff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none">' +
      '<h2 style="margin:0 0 16px;color:#0B1D3A;font-size:20px">Welcome aboard, ' + firstName + '! 👋</h2>' +
      '<p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 20px">Your account on the Titus CRM platform has been created. You can now log in and start using the system.</p>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid #00B4D8;border-radius:8px;padding:20px;margin:0 0 24px">' +
      '<p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0B1D3A">Your Login Details</p>' +
      '<p style="margin:0 0 6px;font-size:14px;color:#4B5563"><strong>Email:</strong> <span style="font-family:monospace;background:#e5e7eb;padding:2px 8px;border-radius:4px">' + email + '</span></p>' +
      '<p style="margin:0 0 6px;font-size:14px;color:#4B5563"><strong>Temporary Password:</strong> <span style="font-family:monospace;background:#fef3c7;padding:2px 8px;border-radius:4px;color:#92400e">' + password + '</span></p>' +
      '<p style="margin:0 0 6px;font-size:14px;color:#4B5563"><strong>Role:</strong> ' + roleLabel + '</p>' +
      jobLine +
      '</div>' +
      '<div style="text-align:center;margin:0 0 24px"><a href="' + portalUrl + '" style="display:inline-block;background:#00B4D8;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:700">Log In to Titus →</a></div>' +
      '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin:0 0 20px">' +
      '<p style="margin:0;font-size:13px;color:#92400e"><strong>⚠️ Important:</strong> Please change your password after your first login for security.</p></div>' +
      '<p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 8px">If you have any questions or need help getting started, please reach out to your team leader or the admin team.</p>' +
      '</div>' +
      '<div style="padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">' +
      '<p style="margin:0 0 4px;font-size:12px;color:#9CA3AF">Delta Community Support</p>' +
      '<p style="margin:0;font-size:12px;color:#9CA3AF">📧 rosters@deltacommunity.com.au &nbsp;|&nbsp; 📞 (07) 3555 8000</p></div>' +
      '</div></body></html>'
    );
  },
};

function sendWelcomeEmail(toEmail, name, password, role, jobTitle) {
  var htmlBody = WELCOME_EMAIL_TEMPLATE.body(name, toEmail, password, role, jobTitle);
  var payload = {
    message: {
      subject: WELCOME_EMAIL_TEMPLATE.subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: toEmail, name: name || toEmail } }],
    },
    saveToSentItems: true,
  };

  return msGraphFetch('/users/' + env.microsoft.emailAddress + '/sendMail', 'POST', payload)
    .then(function () {
      try {
        db.prepare(
          "INSERT INTO emails (message_id, direction, from_address, from_name, to_address, to_name, subject, body_html, sent_at) VALUES (?, 'outbound', ?, 'Delta Community Support', ?, ?, ?, ?, datetime('now'))"
        ).run(
          'welcome_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          env.microsoft.emailAddress,
          toEmail,
          name || toEmail,
          WELCOME_EMAIL_TEMPLATE.subject,
          htmlBody
        );
      } catch (e) {
        console.error('[WELCOME] Failed to log email:', e.message);
      }
      console.log('[WELCOME] Email sent to ' + toEmail);
      return { success: true };
    })
    .catch(function (err) {
      console.error('[WELCOME] Failed to send to ' + toEmail + ':', err.message);
      return { success: false, error: err.message };
    });
}

module.exports = {
  getMsGraphToken,
  msGraphFetch,
  sendWelcomeEmail,
  WELCOME_EMAIL_TEMPLATE,
};

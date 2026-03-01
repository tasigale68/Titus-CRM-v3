var express = require('express');
var { authenticate, requireRole } = require('../../middleware/auth');
var { logAudit } = require('../../services/audit');
var airtable = require('../../services/database');
var sb = require('../../services/supabaseClient');
var env = require('../../config/env');
var { uploadCV } = require('../../config/upload');
var { msGraphFetch, getMsGraphToken } = require('../../services/email');

var router = express.Router();

router.use(authenticate);

// ═══════════════════════════════════════════════════════════════
// ═══ RECRUITMENT PIPELINE V8 — BACKEND ═══
// ═══════════════════════════════════════════════════════════════

// Automation toggle — OFF by default (Rule 1)
var AUTOMATION_ENABLED = false;

// V8 Pipeline stages
var V8_STAGES = ["Applied","Phone Screen","Video Interview","Assessment","Reference Check","Onboarding","Ready to Roster","Offer Extended","Offer Accepted","Unsuccessful","Withdrawn"];

// Stage migration map (old → new)
var STAGE_MIGRATION = {
  "Phone Interview":"Phone Screen","CV Received":"Applied","Onboard":"Onboarding","GA Interview":"Assessment","Employed":"Ready to Roster",
  "Info Session Sent":"Phone Screen","EOI Completed":"Assessment","Shortlisted":"Video Interview","Offer Sent":"Offer Extended","Active & Rostered":"Ready to Roster"
};

// SMS Templates
var RECRUIT_SMS_TEMPLATES = {
  "INFO_SESSION_SENT": "Hi [First Name], thanks for applying to Delta Community Support! \ud83d\ude4c\n\nBefore we chat, we\u2019d love for you to watch a short video about who we are and the work we do:\n\ud83d\udc49 https://app.heygen.com/videos/67fd613d90a1419ebc3ec1413350f37f\n\nAny questions? Call or SMS our recruitment line anytime:\n\ud83d\udcde +61 483 933 076 (Michael \u2014 available 24/7)\n\nAfter watching, please complete our short Expression of Interest form:\n\ud83d\udc49 [EOI_FORM_LINK]\n\nLooking forward to hearing from you!\nDelta Community Support",
  "INFO_SESSION_REMINDER": "Hi [First Name], just a reminder to watch our short intro video \u2014 it only takes a few minutes and tells you everything about working with Delta \ud83d\ude0a\n\n\ud83d\udc49 https://app.heygen.com/videos/67fd613d90a1419ebc3ec1413350f37f\n\nQuestions? Call Michael anytime: +61 483 933 076\n\nDelta Community Support",
  "SHORTLISTED": "Hi [First Name], great news! We\u2019ve reviewed your Expression of Interest and we\u2019d love to move forward with you. \ud83c\udf89\n\nWe\u2019ll be sending you a short video interview link shortly. Keep an eye on your SMS and email.\n\nAny questions in the meantime, Michael is available 24/7 on +61 483 933 076.\n\nDelta Community Support",
  "VIDEO_INTERVIEW_LINK": "Hi [First Name], you\u2019ve been shortlisted for a position at Delta Community Support!\n\nPlease complete your video interview at your own pace using the link below \u2014 no scheduling needed:\n\ud83d\udc49 [VIDEO_INTERVIEW_LINK]\n\nThe interview takes about 10\u201315 minutes. Answer the questions as naturally as you can \u2014 we just want to get to know you.\n\nQuestions? Call Michael: +61 483 933 076\n\nDelta Community Support",
  "VIDEO_INTERVIEW_REMINDER": "Hi [First Name], just a reminder to complete your video interview when you get a chance \ud83d\ude0a\n\n\ud83d\udc49 [VIDEO_INTERVIEW_LINK]\n\nNeed help or have questions? Call Michael anytime: +61 483 933 076\n\nDelta Community Support",
  "REFERENCE_REQUEST": "Hi [First Name], thank you for completing your video interview \u2014 we really enjoyed learning more about you!\n\nAs part of our process, we need details for two referees:\n  1. A professional referee (previous employer or supervisor)\n  2. A personal referee (someone who knows you outside of work \u2014 not a family member)\n\nPlease submit your referee details here:\n\ud83d\udc49 [REFEREE_FORM_LINK]\n\nDelta Community Support",
  "OFFER_SENT": "Hi [First Name], congratulations! \ud83c\udf89 We\u2019d love to offer you a position at Delta Community Support.\n\nWe\u2019re sending your conditional offer letter to [Email] now. Please check your inbox.\n\nQuestions? Call Michael: +61 483 933 076\n\nDelta Community Support",
  "OFFER_ACCEPTED": "Welcome to the Delta family, [First Name]! \ud83d\ude4c\ud83c\udf89\n\nWe\u2019re so excited to have you on board. Here\u2019s what happens next:\n\n1. Check your email for your Titus Portal login \u2014 this is where you\u2019ll complete your onboarding\n2. Upload your compliance documents\n3. Complete your induction training\n\nYour Titus Portal: [TITUS_PORTAL_LINK]\n\nAny questions, we\u2019re here to help.\nDelta Community Support",
  "LMS_INVITATION": "Hi [First Name], your learning account is ready! \ud83c\udf93\n\nPlease log in and complete your mandatory induction modules before your first shift:\n\ud83d\udc49 [LMS_LINK]\n\nMandatory modules (complete before first shift):\n\u2022 NDIS Orientation\n\u2022 Infection Control\n\u2022 Restrictive Practices Awareness\n\u2022 Incident Reporting\n\u2022 Manual Handling\n\u2022 Privacy & Confidentiality\n\nQuestions? Call us on [OFFICE_NUMBER].\n\nDelta Community Support",
  "CONTRACT_SENT": "Hi [First Name], your [EMPLOYMENT_TYPE_LABEL] is ready to review and sign.\n\nPlease check your email for the document and signing instructions.\n\nOnce signed, return it via email or upload it directly to your Titus Portal.\n\nDelta Community Support",
  "MISSING_DOCS_REMINDER": "Hi [First Name], just a reminder that we\u2019re still waiting on a few documents in your Titus Portal before we can add you to the roster.\n\nLog in here to check and upload: [TITUS_PORTAL_LINK]\n\nNeed help? Call us on [OFFICE_NUMBER].\n\nDelta Community Support",
  "ACTIVE_ROSTERED": "Great news, [First Name]! \u2705 Your onboarding is complete and you\u2019re now on the active roster.\n\nYou\u2019ll receive your first shift details soon. Keep an eye on your Titus app for shift notifications.\n\nWelcome to the team! \ud83d\ude4c\nDelta Community Support",
  "UNSUCCESSFUL": "Hi [First Name], thank you so much for your interest in joining Delta Community Support and for taking the time to go through our process.\n\nUnfortunately, we won\u2019t be moving forward at this time, but we really appreciate you sharing your experience with us.\n\nWe wish you all the best in your job search.\n\nDelta Community Support",
  "WITHDRAWN": "Hi [First Name], we\u2019ve received your withdrawal from the Delta Community Support recruitment process.\n\nWe completely understand \u2014 we wish you all the best! If you\u2019d like to reapply in the future, we\u2019d love to hear from you.\n\nDelta Community Support"
};

// Email Templates
var RECRUIT_EMAIL_TEMPLATES = {
  "APPLICATION_ACKNOWLEDGEMENT": {
    subject: "Thanks for applying \u2014 Delta Community Support \ud83d\udc4b",
    body: "<p>Hi [First Name],</p><p>Thank you for applying to Delta Community Support! We\u2019re really glad you\u2019re interested in joining our team.</p><p>We support people living with disability across Brisbane and surrounding areas, and we\u2019re always looking for passionate, compassionate people to join us.</p><h3>NEXT STEP \u2014 Watch Our Short Info Video</h3><p>Before we connect, we\u2019d love for you to watch a short video about who we are, the work we do, and what we look for in our team:</p><p>\ud83d\udc49 <a href=\"https://app.heygen.com/videos/67fd613d90a1419ebc3ec1413350f37f\">Watch the video here</a></p><p>The video covers:</p><ul><li>Who Delta Community Support is</li><li>The types of support work available</li><li>What makes a great Delta support worker</li><li>How to apply and what happens next</li></ul><h3>CAN\u2019T WATCH RIGHT NOW?</h3><p>No problem \u2014 you can call or SMS our recruitment line anytime, 24/7:</p><p>\ud83d\udcde +61 483 933 076 (just ask for Michael)</p><h3>AFTER WATCHING</h3><p>Please complete our short Expression of Interest form \u2014 it takes about 5 minutes and helps us match you with the right opportunities:</p><p>\ud83d\udc49 <a href=\"[EOI_FORM_LINK]\">Complete the EOI form</a></p><p>We look forward to learning more about you!</p><p>Warm regards,<br>Delta Community Support Recruitment Team</p>"
  },
  "SHORTLIST_NOTIFICATION": {
    subject: "You\u2019ve been shortlisted \u2014 Delta Community Support \ud83c\udf89",
    body: "<p>Hi [First Name],</p><p>Great news \u2014 you\u2019ve been shortlisted for a position at Delta Community Support!</p><p>We\u2019ve reviewed your Expression of Interest and we\u2019re impressed by your background and enthusiasm. We\u2019d love to get to know you better through a short video interview.</p><h3>WHAT HAPPENS NEXT</h3><p>You\u2019ll receive a video interview link shortly via SMS and email. The interview:</p><ul><li>Takes approximately 10\u201315 minutes</li><li>Is completely flexible \u2014 complete it at a time that suits you</li><li>Is recorded and reviewed by our team</li></ul><p>No scheduling, no travel required.</p><p>In the meantime, if you have any questions about the role or the process, you\u2019re welcome to call our recruitment line anytime:</p><p>\ud83d\udcde +61 483 933 076 (Michael \u2014 available 24/7)</p><p>We\u2019ll be in touch very soon!</p><p>Warm regards,<br>Delta Community Support Recruitment Team</p>"
  },
  "VIDEO_INTERVIEW_INVITATION": {
    subject: "Your video interview is ready \u2014 Delta Community Support",
    body: "<p>Hi [First Name],</p><p>You\u2019re one step closer to joining the Delta Community Support team! \ud83d\ude4c</p><p>It\u2019s time to complete your video interview. Here\u2019s everything you need to know:</p><h3>YOUR VIDEO INTERVIEW LINK</h3><p>\ud83d\udc49 <a href=\"[VIDEO_INTERVIEW_LINK]\">Start your video interview</a></p><h3>WHAT TO EXPECT</h3><ul><li>4\u20135 questions about your background, values, and approach to disability support</li><li>You\u2019ll record your responses directly in your browser \u2014 no app download needed</li><li>Takes approximately 10\u201315 minutes</li><li>Complete it whenever it suits you \u2014 the link is valid for 5 days</li></ul><h3>TIPS FOR A GREAT INTERVIEW</h3><ul><li>Find a quiet space with good lighting</li><li>Speak naturally \u2014 we want to hear your genuine voice</li><li>Answer based on real experiences where you can</li><li>Don\u2019t worry about being perfect \u2014 we\u2019re looking for warmth, honesty, and care</li></ul><p>Questions before you start? Call Michael on +61 483 933 076 (24/7).</p><p>We look forward to seeing you!</p><p>Warm regards,<br>Delta Community Support Recruitment Team</p>"
  },
  "REFERENCE_REQUEST": {
    subject: "One more step \u2014 we need your referee details",
    body: "<p>Hi [First Name],</p><p>Congratulations on completing your video interview \u2014 our team has been reviewing your responses and we\u2019re really encouraged by what we\u2019ve seen!</p><p>As part of our recruitment process, we conduct reference checks with two people who know you.</p><h3>WE NEED DETAILS FOR:</h3><p><strong>1. PROFESSIONAL REFEREE</strong><br>Someone who has supervised or worked closely with you in a professional capacity \u2014 a previous employer, manager, team leader, or supervisor. (Not a colleague at the same level.)</p><p><strong>2. PERSONAL REFEREE</strong><br>Someone who knows you outside of work and can speak to your character \u2014 a community member, mentor, or friend. (Not a family member.)</p><h3>SUBMIT YOUR REFEREE DETAILS HERE:</h3><p>\ud83d\udc49 <a href=\"[REFEREE_FORM_LINK]\">Submit referee details</a></p><p>Once we have their details, our system will reach out to them directly \u2014 no action needed from you after you submit the form.</p><h3>WE\u2019LL BE IN TOUCH SOON</h3><p>After reference checks are complete, we aim to have an outcome for you within 2\u20133 business days.</p><p>Questions? Call Michael: +61 483 933 076</p><p>Warm regards,<br>Delta Community Support Recruitment Team</p>"
  },
  "CONDITIONAL_OFFER": {
    subject: "Conditional Offer of [EMPLOYMENT_TYPE_LABEL] \u2014 Delta Community Support \ud83c\udf89",
    body: "<p>Hi [First Name],</p><p>We are absolutely delighted to offer you a position with Delta Community Support!</p><h3>CONDITIONAL OFFER \u2014 [EMPLOYMENT_TYPE_LABEL]</h3><p>This offer is conditional upon:</p><ul><li>Successful completion of all compliance document requirements</li><li>Verification of your NDIS Worker Screening Check and Queensland Blue Card</li><li>Completion of mandatory induction training via our LMS</li><li>Signing your [EMPLOYMENT_TYPE_LABEL]</li></ul><h3>YOUR NEXT STEPS</h3><ol><li>Accept this offer by replying to this email or clicking the link below</li><li>You\u2019ll receive access to your Titus Portal \u2014 our onboarding hub</li><li>Upload your compliance documents</li><li>Complete your induction training</li><li>Sign your [EMPLOYMENT_TYPE_LABEL]</li></ol><p>Once all steps are complete, you\u2019ll be added to our active roster and receive your first shift details.</p><p><strong>ACCEPT YOUR OFFER:</strong><br>\ud83d\udc49 <a href=\"[OFFER_ACCEPTANCE_LINK]\">Accept offer</a></p><p><strong>DECLINE YOUR OFFER:</strong><br>\ud83d\udc49 <a href=\"[OFFER_DECLINE_LINK]\">Decline offer</a></p><p>We are so excited to welcome you to the Delta family. If you have any questions before accepting, please don\u2019t hesitate to reach out.</p><p>\ud83d\udcde Office: [OFFICE_NUMBER]<br>\ud83d\udcde Michael (24/7): +61 483 933 076<br>\ud83d\udce7 rosters@deltacommunity.com.au</p><p>Warm regards,<br>[HIRING_MANAGER_NAME]<br>Delta Community Support</p>"
  },
  "WELCOME_PORTAL_ACCESS": {
    subject: "Welcome to Delta! Your onboarding portal is ready \ud83d\ude4c",
    body: "<p>Hi [First Name],</p><p>Welcome to the Delta Community Support family! We\u2019re so excited to have you with us.</p><p>Your onboarding portal is ready \u2014 here\u2019s everything you need to get started.</p><h3>YOUR TITUS PORTAL LOGIN</h3><p>\ud83d\udc49 Portal: <a href=\"[TITUS_PORTAL_LINK]\">[TITUS_PORTAL_LINK]</a><br>\ud83d\udce7 Email: [Email]<br>\ud83d\udd11 Temporary password: [TEMP_PASSWORD]<br>(Please change your password when you first log in)</p><h3>WHAT TO DO IN YOUR PORTAL</h3><p><strong>Step 1 \u2014 Upload your compliance documents</strong><br>You\u2019ll see a checklist of required documents. Please upload each one as soon as possible.</p><p><strong>Step 2 \u2014 Complete your induction training</strong><br>Your LMS account will be set up within 24 hours. You\u2019ll get a separate email with your login details.</p><p>Mandatory modules to complete BEFORE your first shift:</p><ul><li>NDIS Orientation</li><li>Infection Control</li><li>Restrictive Practices Awareness</li><li>Incident Reporting</li><li>Manual Handling</li><li>Privacy &amp; Confidentiality</li></ul><p><strong>Step 3 \u2014 Sign your contract</strong><br>Your agreement will be sent to this email address within 24 hours.</p><h3>NEED HELP?</h3><p>\ud83d\udcde Office: [OFFICE_NUMBER]<br>\ud83d\udce7 rosters@deltacommunity.com.au<br>\ud83d\udcde Michael (24/7): +61 483 933 076</p><p>We can\u2019t wait to see you in action!</p><p>Warm regards,<br>Delta Community Support Onboarding Team</p>"
  },
  "LMS_INVITATION": {
    subject: "Your Delta learning account is ready \u2014 complete before your first shift",
    body: "<p>Hi [First Name],</p><p>Your learning account is set up and ready to go! \ud83c\udf93</p><h3>LEARNING MANAGEMENT SYSTEM ACCESS</h3><p>\ud83d\udc49 LMS Link: <a href=\"[LMS_LINK]\">[LMS_LINK]</a><br>\ud83d\udce7 Login: [Email]<br>\ud83d\udd11 Password: [LMS_TEMP_PASSWORD]</p><h3>MANDATORY MODULES \u2014 COMPLETE BEFORE YOUR FIRST SHIFT</h3><ol><li>NDIS Orientation (~30 mins)</li><li>Infection Control (~20 mins)</li><li>Restrictive Practices Awareness (~25 mins)</li><li>Incident Reporting (~20 mins)</li><li>Manual Handling (~25 mins)</li><li>Privacy &amp; Confidentiality (~15 mins)</li></ol><p>Total estimated time: approximately 2 hours 15 minutes</p><h3>ADDITIONAL MODULES</h3><p>You\u2019ll also see additional modules in your account. These are not mandatory before your first shift but must be completed within 30 days of your start date.</p><p>Questions about the LMS? Email rosters@deltacommunity.com.au</p><p>Warm regards,<br>Delta Community Support Training Team</p>"
  },
  "CONTRACT_EMPLOYED": {
    subject: "Your Employment Agreement \u2014 please review and sign",
    body: "<p>Hi [First Name],</p><p>Your Employment Agreement is ready for your review and signature.</p><h3>EMPLOYMENT DETAILS</h3><ul><li>Position: Support Worker</li><li>Employment Type: Casual / Part-Time (as agreed)</li><li>Award: Social, Community, Home Care and Disability Services Industry Award 2010 (SCHADS MA000100)</li><li>Pay Classification: [CLASSIFICATION]</li><li>Commencement: Subject to compliance clearance</li></ul><h3>NEXT STEPS</h3><ol><li>Read the agreement carefully</li><li>Sign using the instructions in the attached document</li><li>Return the signed copy via email to rosters@deltacommunity.com.au, or upload it directly to your Titus Portal</li></ol><p>Please sign and return within 5 business days.</p><p>\ud83d\udcde Office: [OFFICE_NUMBER]<br>\ud83d\udce7 rosters@deltacommunity.com.au</p><p>We\u2019re looking forward to welcoming you officially!</p><p>Warm regards,<br>Delta Community Support HR Team</p>"
  },
  "CONTRACT_CONTRACTOR": {
    subject: "Your Contractor Agreement \u2014 please review and sign",
    body: "<p>Hi [First Name],</p><p>Your Contractor Agreement is ready for your review and signature.</p><h3>CONTRACTOR DETAILS</h3><ul><li>Engagement Type: Independent Contractor</li><li>ABN: [CANDIDATE_ABN]</li><li>GST Registered: [GST_STATUS]</li><li>Invoice Cycle: Fortnightly (generated automatically from completed shifts in Titus)</li></ul><h3>IMPORTANT \u2014 CONTRACTOR NOTES</h3><ul><li>You are engaged as an independent contractor and are not covered by the SCHADS Award</li><li>You are responsible for your own tax, superannuation, and insurance obligations</li><li>Invoices are auto-generated by Titus at the end of each fortnight based on your completed shifts</li><li>You must hold a valid ABN and keep your GST registration status current</li></ul><h3>NEXT STEPS</h3><ol><li>Review the agreement carefully</li><li>Sign and return to rosters@deltacommunity.com.au or upload to your Titus Portal</li><li>Confirm your ABN and GST status in your Titus Portal</li></ol><p>Please sign and return within 5 business days.</p><p>\ud83d\udcde [OFFICE_NUMBER] | \ud83d\udce7 rosters@deltacommunity.com.au</p><p>Warm regards,<br>Delta Community Support Operations Team</p>"
  },
  "ACTIVE_ROSTERED": {
    subject: "You\u2019re officially on the roster \u2014 welcome to the team! \ud83c\udf89",
    body: "<p>Hi [First Name],</p><p>This is the email you\u2019ve been waiting for \u2014 you\u2019re officially cleared and on the Delta Community Support active roster! \u2705\ud83c\udf89</p><h3>WHAT HAPPENS NOW</h3><ul><li>You\u2019ll receive shift offers via SMS through Titus</li><li>Accept or decline shifts directly from your phone</li><li>Log in to your Titus Portal anytime to view your schedule, upcoming shifts, and compliance status</li></ul><h3>IMPORTANT REMINDERS</h3><ul><li>Always clock in and out via the Titus app</li><li>Complete your shift notes in Titus after every shift</li><li>Keep your compliance documents up to date \u2014 Titus will remind you when anything is expiring</li><li>If you have any concerns about a client or shift, contact your Team Leader immediately</li></ul><p>TITUS PORTAL: <a href=\"[TITUS_PORTAL_LINK]\">[TITUS_PORTAL_LINK]</a></p><p>We are so glad to have you with us. Our participants and their families are lucky to have someone like you in their corner.</p><p>Let\u2019s do great work together \ud83d\udc99</p><p>Warm regards,<br>The Delta Community Support Team</p>"
  },
  "UNSUCCESSFUL": {
    subject: "Your application \u2014 Delta Community Support",
    body: "<p>Hi [First Name],</p><p>Thank you for taking the time to apply to Delta Community Support and for engaging with our recruitment process.</p><p>After careful consideration, we will not be proceeding with your application at this time.</p><p>This is not a reflection of your worth as a person \u2014 our decisions are based on the specific needs of our team and clients at this point in time.</p><p>We genuinely appreciate the effort you put into the process and wish you every success in finding a role where you can make a real difference.</p><p>If you\u2019d like to reapply in the future, we\u2019d welcome your application.</p><p>Warm regards,<br>Delta Community Support Recruitment Team</p>"
  },
  "WITHDRAWN": {
    subject: "Your withdrawal is confirmed \u2014 Delta Community Support",
    body: "<p>Hi [First Name],</p><p>We\u2019ve received your withdrawal from the Delta Community Support recruitment process and we completely understand.</p><p>Your details have been removed from our active pipeline and you won\u2019t receive any further recruitment communications from us.</p><p>If you ever decide to reapply in the future, we\u2019d love to hear from you \u2014 just reach out to rosters@deltacommunity.com.au.</p><p>We wish you all the very best.</p><p>Warm regards,<br>Delta Community Support Recruitment Team</p>"
  }
};

// Automation map — defines which communications fire on stage transitions
var RECRUIT_AUTOMATION_MAP = {
  "Applied": { sms: "INFO_SESSION_SENT", email: "APPLICATION_ACKNOWLEDGEMENT", suppressFlag: "Info Video Watched" },
  "Phone Screen": { sms: "INFO_SESSION_REMINDER", email: "APPLICATION_ACKNOWLEDGEMENT" },
  "Video Interview": { sms: "VIDEO_INTERVIEW_LINK", email: "VIDEO_INTERVIEW_INVITATION", suppressFlag: "Video Interview Completed" },
  "Assessment": { sms: "SHORTLISTED", email: "SHORTLIST_NOTIFICATION", suppressFlag: "EOI Form Submitted" },
  "Reference Check": { sms: "REFERENCE_REQUEST", email: "REFERENCE_REQUEST" },
  "Onboarding": { sms: "LMS_INVITATION", email: "WELCOME_PORTAL_ACCESS", suppressFlag: "Onboarded Externally" },
  "Ready to Roster": { sms: "ACTIVE_ROSTERED", email: "ACTIVE_ROSTERED" },
  "Offer Extended": { sms: "OFFER_SENT", email: "CONDITIONAL_OFFER", suppressFlag: "Offer Sent Externally" },
  "Offer Accepted": { sms: "OFFER_ACCEPTED", email: "WELCOME_PORTAL_ACCESS" },
  "Unsuccessful": { sms: "UNSUCCESSFUL", email: "UNSUCCESSFUL" },
  "Withdrawn": { sms: "WITHDRAWN", email: "WITHDRAWN" }
};

// Placeholder replacement
function recruitReplacePlaceholders(template, candidate) {
  var f = candidate.fields || candidate || {};
  var firstName = f["First Name"] || (f["Full Name"] || "").split(" ")[0] || "there";
  var email = f["Email"] || "";
  var empType = f["Type of Employment"] || "";
  var empLabel = empType === "Independent Contractor" ? "Contractor Agreement" : "Employment Contract";
  var abn = f["What is your ABN #"] || "";
  var gst = f["Do you have GST Registration with your ABN?"] || "No";
  return template
    .replace(/\[First Name\]/g, firstName)
    .replace(/\[Email\]/g, email)
    .replace(/\[OFFICE_NUMBER\]/g, "(07) 3555 8000")
    .replace(/\[EOI_FORM_LINK\]/g, "https://deltacommunity.com.au/eoi")
    .replace(/\[VIDEO_INTERVIEW_LINK\]/g, "https://deltacommunity.com.au/video-interview")
    .replace(/\[REFEREE_FORM_LINK\]/g, "https://deltacommunity.com.au/referee")
    .replace(/\[TITUS_PORTAL_LINK\]/g, "https://titus-voice-version-2-production.up.railway.app")
    .replace(/\[OFFER_ACCEPTANCE_LINK\]/g, "https://deltacommunity.com.au/offer-accept")
    .replace(/\[OFFER_DECLINE_LINK\]/g, "https://deltacommunity.com.au/offer-decline")
    .replace(/\[LMS_LINK\]/g, "https://deltacommunity.talentlms.com")
    .replace(/\[LMS_TEMP_PASSWORD\]/g, "DeltaLMS2026!")
    .replace(/\[TEMP_PASSWORD\]/g, "DeltaWelcome2026!")
    .replace(/\[EMPLOYMENT_TYPE\]/g, empType)
    .replace(/\[EMPLOYMENT_TYPE_LABEL\]/g, empLabel)
    .replace(/\[CANDIDATE_ABN\]/g, abn)
    .replace(/\[GST_STATUS\]/g, gst)
    .replace(/\[CLASSIFICATION\]/g, "Level 2")
    .replace(/\[HIRING_MANAGER_NAME\]/g, "Rina Lancuba");
}

// Email signature block
var RECRUIT_EMAIL_SIGNATURE = "<br><hr style='border:none;border-top:1px solid #ddd;margin:24px 0'><p style='color:#666;font-size:13px'>Delta Community Support<br>Phone: (07) 3555 8000<br>Recruitment Line (24/7): +61 483 933 076<br>Email: rosters@deltacommunity.com.au</p>";

// ─── Helper: get Twilio client (lazy init) ───
var _twilioClient = null;
function getTwilioClient() {
  if (_twilioClient) return _twilioClient;
  if (env.twilio.accountSid && env.twilio.authToken) {
    _twilioClient = require('twilio')(env.twilio.accountSid, env.twilio.authToken);
    return _twilioClient;
  }
  return null;
}

// ─── Helper: format phone for AU ───
function formatPhoneAU(phone) {
  var toPhone = (phone || "").replace(/\s/g, "");
  if (!toPhone) return "";
  if (!toPhone.startsWith("+")) toPhone = "+61" + toPhone.replace(/^0/, "");
  return toPhone;
}


// ═══════════════════════════════════════════════════════════════
// ═══ ROUTES ═══
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/recruitment/candidates — Fetch all jobseekers from All Contacts ───
router.get('/candidates', function(req, res) {
  function arrayVal(v) { return Array.isArray(v) ? v[0] || "" : v || ""; }
  var showArchived = req.query.showArchived === "true";

  // Fetch all contacts then filter for Jobseekers client-side (most reliable approach)
  airtable.fetchAllFromTable("All Contacts").then(function(allRecords) {
    var records = (allRecords || []).filter(function(rec) {
      var f = rec.fields || {};
      var t = f["Type of Contact (Single Select)"] || f["Type of Contact"] || f["type_of_contact"] || f["contact_type"] || "";
      return t === "Jobseeker";
    });
    console.log("Recruit: Found " + records.length + " jobseekers out of " + (allRecords || []).length + " total contacts");
    return records;
  }).then(function(records) {
    if (records && records.length > 0) {
      console.log("Recruit sample fields:", Object.keys(records[0].fields || {}).slice(0, 20).join(", "));
    }
    var result = (records || []).map(function(r) {
      var f = r.fields || {};
      var cvFiles = f["CV/Resume"] || f["CV"] || f["Resume"] || f["Upload CV"] || f["Attachments"] || [];
      if (!Array.isArray(cvFiles)) cvFiles = [];
      // Stage field — try multiple possible names
      var rawStage = f["Stage-in-Recruitment"] || f["Stage In Recruitment"] || f["Stage"] || f["Recruitment Stage"] || f["Status"] || "";
      // Migrate old stage names to V8
      if (STAGE_MIGRATION[rawStage]) rawStage = STAGE_MIGRATION[rawStage];
      // If stage still doesn't match any V8 stage, default to Applied
      if (!rawStage || V8_STAGES.indexOf(rawStage) < 0) rawStage = "Applied";
      return {
        airtableId: r.id,
        firstName: arrayVal(f["First Name"] || f["FirstName"] || ""),
        lastName: arrayVal(f["Last Name"] || f["LastName"] || f["Surname"] || ""),
        fullName: arrayVal(f["Full Name"] || ""),
        email: arrayVal(f["Email"] || f["Email Address"] || ""),
        phone: arrayVal(f["Mobile"] || f["Formatted Mobile"] || f["Final Phone"] || f["Phone"] || f["Phone Number"] || ""),
        suburb: arrayVal(f["Suburb"] || f["Location"] || ""),
        state: arrayVal(f["State"] || ""),
        appliedFor: arrayVal(f["Applied for which Role?"] || f["Applied For"] || f["Job Title"] || f["Role"] || f["Position"] || ""),
        dateApplied: arrayVal(f["Application Date"] || f["Online Application Submission Date"] || f["Date Applied"] || f["Created time"] || f["Created"] || ""),
        stage: rawStage,
        cvUrl: cvFiles.length > 0 ? (cvFiles[0].url || "") : "",
        cvName: cvFiles.length > 0 ? (cvFiles[0].filename || "CV") : "",
        lastEdited: arrayVal(f["Last Modified"] || f["Last modified"] || ""),
        employmentType: arrayVal(f["Type of Employment"] || ""),
        documentScore: parseFloat(f["Document Score"] || 0),
        communicationScore: parseFloat(f["Communication Score"] || 0),
        totalScore: (parseFloat(f["Document Score"] || 0)) + (parseFloat(f["Communication Score"] || 0)),
        archived: f["Recruitment Archived"] === true,
        infoVideoWatched: f["Info Video Watched"] === true,
        michaelCallCompleted: f["Michael Call Completed"] === true,
        eoiFormSubmitted: f["EOI Form Submitted"] === true,
        videoInterviewCompleted: f["Video Interview Completed"] === true,
        offerSentExternally: f["Offer Sent Externally"] === true,
        onboardedExternally: f["Onboarded Externally"] === true,
        offerAccepted: f["Offer Accepted"] === true,
        refCheckStatus: f["Reference Check Status"] || "",
        mandatoryDocsPercent: f["Mandatory Docs Completion %"] || 0,
        allFields: f
      };
    });
    // Filter out archived if not showing
    if (!showArchived) {
      result = result.filter(function(r) { return !r.archived; });
    }
    result.sort(function(a, b) { return (b.dateApplied || "").localeCompare(a.dateApplied || ""); });
    console.log("Recruit: Returning " + result.length + " candidates");
    res.json(result);
  }).catch(function(e) {
    console.error("Recruit error:", e.message);
    res.json([]);
  });
});

// ─── GET /api/recruitment/automation-status — Current automation state ───
router.get('/automation-status', function(req, res) {
  res.json({ enabled: AUTOMATION_ENABLED });
});

// ─── POST /api/recruitment/automation-toggle — Toggle automation (Super Admin / Director only) ───
router.post('/automation-toggle', function(req, res) {
  if (req.user.role !== "superadmin" && req.user.role !== "director") {
    return res.status(403).json({ error: "Not authorized \u2014 Super Admin or Director only" });
  }
  AUTOMATION_ENABLED = req.body.enabled === true;
  logAudit(req.user, "recruitment_automation_toggle", "recruitment", "", "", "enabled", !AUTOMATION_ENABLED, AUTOMATION_ENABLED);
  res.json({ success: true, enabled: AUTOMATION_ENABLED });
});

// ─── GET /api/recruitment/candidates/:id — Single candidate detail ───
router.get('/candidates/:id', function(req, res) {
  airtable.rawFetch("All Contacts", "GET", "/" + req.params.id).then(function(data) {
    if (data.error) return res.status(404).json(data);
    res.json(data);
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── PATCH /api/recruitment/candidates/:id — Update candidate fields in All Contacts ───
router.patch('/candidates/:id', function(req, res) {
  var recordId = req.params.id;
  var fields = req.body.fields || {};
  // Legacy support: if stage is sent directly
  if (req.body.stage && !fields["Stage-in-Recruitment"]) {
    fields["Stage-in-Recruitment"] = req.body.stage;
  }
  if (!recordId) return res.json({ error: "Missing id" });
  airtable.rawFetch("All Contacts", "PATCH", "/" + recordId, { fields: fields }).then(function(data) {
    if (data.error) return res.status(400).json(data);
    res.json({ success: true, record: data });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── GET /api/recruitment/candidates/:id/interactions — Candidate interaction history ───
router.get('/candidates/:id/interactions', function(req, res) {
  var filter = "FIND('" + req.params.id.replace(/'/g, "\\'") + "', {Candidate Record ID})";
  var params = "?filterByFormula=" + encodeURIComponent(filter) + "&sort%5B0%5D%5Bfield%5D=Timestamp&sort%5B0%5D%5Bdirection%5D=desc&pageSize=100";
  airtable.rawFetch("Candidate Interactions", "GET", params).then(function(data) {
    var records = (data.records || []).map(function(r) {
      var f = r.fields || {};
      return {
        id: r.id,
        timestamp: f["Timestamp"] || "",
        type: f["Type"] || "",
        direction: f["Direction"] || "",
        subject: f["Subject"] || "",
        body: f["Body"] || "",
        status: f["Status"] || "",
        triggeredBy: f["Triggered By"] || "",
        suppressedReason: f["Suppressed Reason"] || "",
        fromStage: f["From Stage"] || "",
        toStage: f["To Stage"] || ""
      };
    });
    res.json(records);
  }).catch(function(err) { res.json([]); });
});

// ─── POST /api/recruitment/log-interaction — Write interaction log entry ───
router.post('/log-interaction', function(req, res) {
  var b = req.body;
  var fields = {
    "Candidate Record ID": b.candidateId || "",
    "Candidate Name": b.candidateName || "",
    "Timestamp": b.timestamp || new Date().toISOString(),
    "Type": b.type || "Note",
    "Direction": b.direction || "Internal",
    "Subject": b.subject || "",
    "Body": b.body || "",
    "Status": b.status || "Completed",
    "Triggered By": b.triggeredBy || req.user.name || "System",
    "Suppressed Reason": b.suppressedReason || "",
    "From Stage": b.fromStage || "",
    "To Stage": b.toStage || ""
  };
  airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: fields }] }).then(function(data) {
    if (data.error) return res.status(400).json(data);
    res.json({ success: true });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/stage-change — Stage transition + automation check ───
router.post('/stage-change', function(req, res) {
  var candidateId = req.body.candidateId;
  var fromStage = req.body.fromStage || "";
  var toStage = req.body.toStage || "";
  var triggeredBy = req.body.triggeredBy || req.user.name || "System";
  if (!candidateId || !toStage) return res.status(400).json({ error: "candidateId and toStage required" });

  // Step 1: Always update Airtable stage
  airtable.rawFetch("All Contacts", "PATCH", "/" + candidateId, { fields: { "Stage-in-Recruitment": toStage } }).then(function(updated) {
    if (updated.error) return res.status(400).json(updated);
    var f = updated.fields || {};
    var candidateName = f["Full Name"] || f["First Name"] || "";

    // Step 1b: Log stage change interaction
    var logFields = {
      "Candidate Record ID": candidateId,
      "Candidate Name": candidateName,
      "Timestamp": new Date().toISOString(),
      "Type": "Stage Change",
      "Direction": "Internal",
      "Subject": "Stage changed: " + fromStage + " \u2192 " + toStage,
      "Body": "Pipeline stage changed from \"" + fromStage + "\" to \"" + toStage + "\"",
      "Status": "Completed",
      "Triggered By": triggeredBy,
      "From Stage": fromStage,
      "To Stage": toStage
    };
    airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: logFields }] }).catch(function(e) { console.error("Stage log error:", e.message); });

    // Audit trail
    logAudit(req.user, "recruitment_stage_change", "candidate", candidateId, candidateName, "Stage-in-Recruitment", fromStage, toStage);

    // Step 2: Check automation
    var automationResult = { smsSent: false, emailSent: false, suppressed: [] };
    if (!AUTOMATION_ENABLED) {
      // Log suppression
      var suppressLog = {
        "Candidate Record ID": candidateId, "Candidate Name": candidateName,
        "Timestamp": new Date().toISOString(), "Type": "Note", "Direction": "Internal",
        "Subject": "Automations suppressed (system disabled)",
        "Body": "Stage changed to " + toStage + " \u2014 automations suppressed (system disabled)",
        "Status": "Suppressed", "Triggered By": "System", "Suppressed Reason": "AUTOMATION_ENABLED=false"
      };
      airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: suppressLog }] }).catch(function() {});
      return res.json({ success: true, stage: toStage, automation: "disabled", suppressed: true });
    }

    // Automation is ON — check prior contact flags and send communications
    var autoConfig = RECRUIT_AUTOMATION_MAP[toStage];
    if (!autoConfig) return res.json({ success: true, stage: toStage, automation: "no_config" });

    // Check prior contact suppression flags
    var suppressFlag = autoConfig.suppressFlag;
    if (suppressFlag && f[suppressFlag] === true) {
      var flagLog = {
        "Candidate Record ID": candidateId, "Candidate Name": candidateName,
        "Timestamp": new Date().toISOString(), "Type": "Note", "Direction": "Internal",
        "Subject": "Communications skipped \u2014 prior contact flag set",
        "Body": "SMS/Email for stage '" + toStage + "' skipped \u2014 prior contact flag '" + suppressFlag + "' already set",
        "Status": "Suppressed", "Triggered By": "System", "Suppressed Reason": "Prior contact flag: " + suppressFlag
      };
      airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: flagLog }] }).catch(function() {});
      return res.json({ success: true, stage: toStage, automation: "suppressed_by_flag", flag: suppressFlag });
    }

    // Fire SMS if template exists
    var twilioClient = getTwilioClient();
    var smsPromise = Promise.resolve();
    if (autoConfig.sms && RECRUIT_SMS_TEMPLATES[autoConfig.sms]) {
      var smsBody = recruitReplacePlaceholders(RECRUIT_SMS_TEMPLATES[autoConfig.sms], f);
      var phone = f["Mobile"] || f["Formatted Mobile"] || f["Final Phone"] || "";
      if (phone && twilioClient) {
        var toPhone = formatPhoneAU(phone);
        smsPromise = twilioClient.messages.create({ to: toPhone, from: env.twilio.phoneNumber, body: smsBody }).then(function(msg) {
          automationResult.smsSent = true;
          var smsLog = {
            "Candidate Record ID": candidateId, "Candidate Name": candidateName,
            "Timestamp": new Date().toISOString(), "Type": "SMS", "Direction": "Outbound",
            "Subject": "SMS: " + autoConfig.sms, "Body": smsBody,
            "Status": "Sent", "Triggered By": "Automation"
          };
          return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: smsLog }] });
        }).catch(function(err) {
          console.error("Auto SMS error:", err.message);
          var failLog = {
            "Candidate Record ID": candidateId, "Candidate Name": candidateName,
            "Timestamp": new Date().toISOString(), "Type": "SMS", "Direction": "Outbound",
            "Subject": "SMS: " + autoConfig.sms + " (FAILED)", "Body": smsBody,
            "Status": "Failed", "Triggered By": "Automation", "Suppressed Reason": err.message
          };
          return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: failLog }] });
        });
      }
    }

    // Fire email if template exists
    var emailPromise = Promise.resolve();
    if (autoConfig.email && RECRUIT_EMAIL_TEMPLATES[autoConfig.email]) {
      var emailTpl = RECRUIT_EMAIL_TEMPLATES[autoConfig.email];
      var emailSubject = recruitReplacePlaceholders(emailTpl.subject, f);
      var emailBody = recruitReplacePlaceholders(emailTpl.body, f) + RECRUIT_EMAIL_SIGNATURE;
      var toEmail = f["Email"] || "";
      if (toEmail && env.microsoft.emailAddress) {
        var emailPayload = {
          message: {
            subject: emailSubject,
            body: { contentType: "HTML", content: emailBody },
            toRecipients: [{ emailAddress: { address: toEmail } }],
            from: { emailAddress: { address: env.microsoft.emailAddress } }
          }
        };
        emailPromise = getMsGraphToken().then(function() {
          return msGraphFetch("/users/" + env.microsoft.emailAddress + "/sendMail", "POST", emailPayload);
        }).then(function() {
          automationResult.emailSent = true;
          var emailLog = {
            "Candidate Record ID": candidateId, "Candidate Name": candidateName,
            "Timestamp": new Date().toISOString(), "Type": "Email", "Direction": "Outbound",
            "Subject": emailSubject, "Body": emailBody,
            "Status": "Sent", "Triggered By": "Automation"
          };
          return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: emailLog }] });
        }).catch(function(err) {
          console.error("Auto email error:", err.message);
          var failLog = {
            "Candidate Record ID": candidateId, "Candidate Name": candidateName,
            "Timestamp": new Date().toISOString(), "Type": "Email", "Direction": "Outbound",
            "Subject": emailSubject + " (FAILED)", "Body": emailBody,
            "Status": "Failed", "Triggered By": "Automation", "Suppressed Reason": err.message
          };
          return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: failLog }] });
        });
      }
    }

    Promise.all([smsPromise, emailPromise]).then(function() {
      res.json({ success: true, stage: toStage, automation: automationResult });
    });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/send-sms — Manual SMS send ───
router.post('/send-sms', function(req, res) {
  var candidateId = req.body.candidateId;
  var templateKey = req.body.templateKey || "";
  var customMessage = req.body.customMessage || "";

  airtable.rawFetch("All Contacts", "GET", "/" + candidateId).then(function(record) {
    if (record.error) return res.status(404).json(record);
    var f = record.fields || {};
    var phone = f["Mobile"] || f["Formatted Mobile"] || f["Final Phone"] || "";
    if (!phone) return res.status(400).json({ error: "No phone number on record" });
    var toPhone = formatPhoneAU(phone);

    var smsBody = customMessage || "";
    if (!smsBody && templateKey && RECRUIT_SMS_TEMPLATES[templateKey]) {
      smsBody = recruitReplacePlaceholders(RECRUIT_SMS_TEMPLATES[templateKey], f);
    }
    if (!smsBody) return res.status(400).json({ error: "No message content" });

    var twilioClient = getTwilioClient();
    if (!twilioClient) return res.status(500).json({ error: "Twilio not configured" });
    twilioClient.messages.create({ to: toPhone, from: env.twilio.phoneNumber, body: smsBody }).then(function(msg) {
      var candidateName = f["Full Name"] || f["First Name"] || "";
      var logFields = {
        "Candidate Record ID": candidateId, "Candidate Name": candidateName,
        "Timestamp": new Date().toISOString(), "Type": "SMS", "Direction": "Outbound",
        "Subject": templateKey ? "SMS: " + templateKey : "Manual SMS",
        "Body": smsBody, "Status": "Sent",
        "Triggered By": req.user.name + " (Manual)"
      };
      airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: logFields }] }).catch(function() {});
      res.json({ success: true, sid: msg.sid });
    }).catch(function(err) {
      res.status(500).json({ error: err.message });
    });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/send-email — Manual email send ───
router.post('/send-email', function(req, res) {
  var candidateId = req.body.candidateId;
  var templateKey = req.body.templateKey || "";
  var customSubject = req.body.customSubject || "";
  var customBody = req.body.customBody || "";

  airtable.rawFetch("All Contacts", "GET", "/" + candidateId).then(function(record) {
    if (record.error) return res.status(404).json(record);
    var f = record.fields || {};
    var toEmail = f["Email"] || "";
    if (!toEmail) return res.status(400).json({ error: "No email on record" });

    var subject = customSubject;
    var body = customBody;
    if (!subject && templateKey && RECRUIT_EMAIL_TEMPLATES[templateKey]) {
      subject = recruitReplacePlaceholders(RECRUIT_EMAIL_TEMPLATES[templateKey].subject, f);
      body = recruitReplacePlaceholders(RECRUIT_EMAIL_TEMPLATES[templateKey].body, f) + RECRUIT_EMAIL_SIGNATURE;
    }
    if (!subject || !body) return res.status(400).json({ error: "No email content" });

    if (!env.microsoft.emailAddress) return res.status(500).json({ error: "Email not configured" });
    var emailPayload = {
      message: {
        subject: subject,
        body: { contentType: "HTML", content: body },
        toRecipients: [{ emailAddress: { address: toEmail } }],
        from: { emailAddress: { address: env.microsoft.emailAddress } }
      }
    };
    getMsGraphToken().then(function() {
      return msGraphFetch("/users/" + env.microsoft.emailAddress + "/sendMail", "POST", emailPayload);
    }).then(function() {
      var candidateName = f["Full Name"] || f["First Name"] || "";
      var logFields = {
        "Candidate Record ID": candidateId, "Candidate Name": candidateName,
        "Timestamp": new Date().toISOString(), "Type": "Email", "Direction": "Outbound",
        "Subject": subject, "Body": body, "Status": "Sent",
        "Triggered By": req.user.name + " (Manual)"
      };
      airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: logFields }] }).catch(function() {});
      res.json({ success: true });
    }).catch(function(err) { res.status(500).json({ error: err.message }); });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/send-video-link — Generate and send video interview link ───
router.post('/send-video-link', function(req, res) {
  var candidateId = req.body.candidateId;
  airtable.rawFetch("All Contacts", "GET", "/" + candidateId).then(function(record) {
    if (record.error) return res.status(404).json(record);
    var f = record.fields || {};
    var candidateName = f["Full Name"] || f["First Name"] || "";
    var phone = f["Mobile"] || f["Formatted Mobile"] || f["Final Phone"] || "";
    var toEmail = f["Email"] || "";

    // Send SMS
    var smsBody = recruitReplacePlaceholders(RECRUIT_SMS_TEMPLATES["VIDEO_INTERVIEW_LINK"], f);
    var twilioClient = getTwilioClient();
    var smsPromise = Promise.resolve();
    if (phone && twilioClient) {
      var toPhone = formatPhoneAU(phone);
      smsPromise = twilioClient.messages.create({ to: toPhone, from: env.twilio.phoneNumber, body: smsBody }).then(function() {
        return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: {
          "Candidate Record ID": candidateId, "Candidate Name": candidateName,
          "Timestamp": new Date().toISOString(), "Type": "SMS", "Direction": "Outbound",
          "Subject": "SMS: Video Interview Link", "Body": smsBody, "Status": "Sent",
          "Triggered By": req.user.name + " (Manual)"
        }}] });
      }).catch(function(e) { console.error("Video link SMS error:", e.message); });
    }

    // Send email
    var emailPromise = Promise.resolve();
    if (toEmail && env.microsoft.emailAddress) {
      var emailTpl = RECRUIT_EMAIL_TEMPLATES["VIDEO_INTERVIEW_INVITATION"];
      var subject = recruitReplacePlaceholders(emailTpl.subject, f);
      var body = recruitReplacePlaceholders(emailTpl.body, f) + RECRUIT_EMAIL_SIGNATURE;
      emailPromise = getMsGraphToken().then(function() {
        return msGraphFetch("/users/" + env.microsoft.emailAddress + "/sendMail", "POST", {
          message: { subject: subject, body: { contentType: "HTML", content: body },
            toRecipients: [{ emailAddress: { address: toEmail } }],
            from: { emailAddress: { address: env.microsoft.emailAddress } } }
        });
      }).then(function() {
        return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: {
          "Candidate Record ID": candidateId, "Candidate Name": candidateName,
          "Timestamp": new Date().toISOString(), "Type": "Email", "Direction": "Outbound",
          "Subject": subject, "Body": body, "Status": "Sent",
          "Triggered By": req.user.name + " (Manual)"
        }}] });
      }).catch(function(e) { console.error("Video link email error:", e.message); });
    }

    Promise.all([smsPromise, emailPromise]).then(function() {
      res.json({ success: true });
    });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/trigger-referee-call — ElevenLabs/Twilio AI call to referee ───
router.post('/trigger-referee-call', function(req, res) {
  var candidateId = req.body.candidateId;
  var refereeNumber = req.body.refereeNumber || "";
  var refereeName = req.body.refereeName || "";
  var candidateName = req.body.candidateName || "";

  if (!refereeNumber) return res.status(400).json({ error: "refereeNumber required" });
  var toPhone = formatPhoneAU(refereeNumber);

  var twilioClient = getTwilioClient();
  if (!twilioClient) return res.status(500).json({ error: "Twilio not configured" });

  // Initiate outbound call to referee via Twilio → ElevenLabs AI agent
  var agentId = env.elevenLabs.agentId || "";
  var twimlUrl = agentId
    ? "https://api.us.elevenlabs.io/twilio/inbound_call?agent_id=" + agentId + "&caller=" + encodeURIComponent(toPhone)
    : null;

  if (!twimlUrl) {
    // Fallback: just initiate a Twilio call without AI agent
    return res.status(500).json({ error: "ElevenLabs agent not configured" });
  }

  var baseUrl = process.env.BASE_URL || "https://titus-voice-version-2-production.up.railway.app";
  twilioClient.calls.create({
    to: toPhone, from: env.twilio.phoneNumber, url: twimlUrl, method: "POST",
    statusCallback: baseUrl + "/webhook/call-status",
    statusCallbackEvent: ["completed"]
  }).then(function(call) {
    // Log the call
    var logFields = {
      "Candidate Record ID": candidateId, "Candidate Name": candidateName,
      "Timestamp": new Date().toISOString(), "Type": "Phone Call (AI)",
      "Direction": "Outbound",
      "Subject": "Michael AI call to referee: " + refereeName + " (" + refereeNumber + ")",
      "Body": "Automated reference check call initiated to " + refereeName + " at " + refereeNumber,
      "Status": "Completed", "Triggered By": req.user.name + " (Manual)"
    };
    airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: logFields }] }).catch(function() {});
    res.json({ success: true, callSid: call.sid });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/lms-invite — LMS invitation ───
router.post('/lms-invite', function(req, res) {
  var candidateId = req.body.candidateId;
  airtable.rawFetch("All Contacts", "GET", "/" + candidateId).then(function(record) {
    if (record.error) return res.status(404).json(record);
    var f = record.fields || {};
    var candidateName = f["Full Name"] || f["First Name"] || "";
    var phone = f["Mobile"] || f["Formatted Mobile"] || f["Final Phone"] || "";
    var toEmail = f["Email"] || "";

    // Send SMS
    var smsBody = recruitReplacePlaceholders(RECRUIT_SMS_TEMPLATES["LMS_INVITATION"], f);
    var twilioClient = getTwilioClient();
    var smsPromise = Promise.resolve();
    if (phone && twilioClient) {
      var toPhone = formatPhoneAU(phone);
      smsPromise = twilioClient.messages.create({ to: toPhone, from: env.twilio.phoneNumber, body: smsBody }).then(function() {
        return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: {
          "Candidate Record ID": candidateId, "Candidate Name": candidateName,
          "Timestamp": new Date().toISOString(), "Type": "SMS", "Direction": "Outbound",
          "Subject": "SMS: LMS Invitation", "Body": smsBody, "Status": "Sent",
          "Triggered By": req.user.name + " (Manual)"
        }}] });
      }).catch(function(e) { console.error("LMS SMS error:", e.message); });
    }

    // Send email
    var emailPromise = Promise.resolve();
    if (toEmail && env.microsoft.emailAddress) {
      var emailTpl = RECRUIT_EMAIL_TEMPLATES["LMS_INVITATION"];
      var subject = recruitReplacePlaceholders(emailTpl.subject, f);
      var body = recruitReplacePlaceholders(emailTpl.body, f) + RECRUIT_EMAIL_SIGNATURE;
      emailPromise = getMsGraphToken().then(function() {
        return msGraphFetch("/users/" + env.microsoft.emailAddress + "/sendMail", "POST", {
          message: { subject: subject, body: { contentType: "HTML", content: body },
            toRecipients: [{ emailAddress: { address: toEmail } }],
            from: { emailAddress: { address: env.microsoft.emailAddress } } }
        });
      }).then(function() {
        return airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: {
          "Candidate Record ID": candidateId, "Candidate Name": candidateName,
          "Timestamp": new Date().toISOString(), "Type": "Email", "Direction": "Outbound",
          "Subject": subject, "Body": body, "Status": "Sent",
          "Triggered By": req.user.name + " (Manual)"
        }}] });
      }).catch(function(e) { console.error("LMS email error:", e.message); });
    }

    Promise.all([smsPromise, emailPromise]).then(function() {
      res.json({ success: true });
    });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/send-contract — Contract email (employed or contractor) ───
router.post('/send-contract', function(req, res) {
  var candidateId = req.body.candidateId;
  airtable.rawFetch("All Contacts", "GET", "/" + candidateId).then(function(record) {
    if (record.error) return res.status(404).json(record);
    var f = record.fields || {};
    var candidateName = f["Full Name"] || f["First Name"] || "";
    var toEmail = f["Email"] || "";
    var empType = f["Type of Employment"] || "";
    var templateKey = empType === "Independent Contractor" ? "CONTRACT_CONTRACTOR" : "CONTRACT_EMPLOYED";
    var emailTpl = RECRUIT_EMAIL_TEMPLATES[templateKey];
    var subject = recruitReplacePlaceholders(emailTpl.subject, f);
    var body = recruitReplacePlaceholders(emailTpl.body, f) + RECRUIT_EMAIL_SIGNATURE;

    if (!toEmail || !env.microsoft.emailAddress) return res.status(400).json({ error: "No email configured" });

    getMsGraphToken().then(function() {
      return msGraphFetch("/users/" + env.microsoft.emailAddress + "/sendMail", "POST", {
        message: { subject: subject, body: { contentType: "HTML", content: body },
          toRecipients: [{ emailAddress: { address: toEmail } }],
          from: { emailAddress: { address: env.microsoft.emailAddress } } }
      });
    }).then(function() {
      // Log + update Airtable
      airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: {
        "Candidate Record ID": candidateId, "Candidate Name": candidateName,
        "Timestamp": new Date().toISOString(), "Type": "Email", "Direction": "Outbound",
        "Subject": subject, "Body": body, "Status": "Sent",
        "Triggered By": req.user.name + " (Manual)"
      }}] }).catch(function() {});
      // Also send SMS notification
      var smsBody = recruitReplacePlaceholders(RECRUIT_SMS_TEMPLATES["CONTRACT_SENT"], f);
      var phone = f["Mobile"] || f["Formatted Mobile"] || f["Final Phone"] || "";
      var twilioClient = getTwilioClient();
      if (phone && twilioClient) {
        var toPhone = formatPhoneAU(phone);
        twilioClient.messages.create({ to: toPhone, from: env.twilio.phoneNumber, body: smsBody }).catch(function() {});
      }
      res.json({ success: true });
    }).catch(function(err) { res.status(500).json({ error: err.message }); });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/mark-contract-signed — Update record + log ───
router.post('/mark-contract-signed', function(req, res) {
  var candidateId = req.body.candidateId;
  airtable.rawFetch("All Contacts", "PATCH", "/" + candidateId, { fields: {} }).then(function(record) {
    var f = (record.fields || {});
    var candidateName = f["Full Name"] || f["First Name"] || "";
    airtable.rawFetch("Candidate Interactions", "POST", "", { records: [{ fields: {
      "Candidate Record ID": candidateId, "Candidate Name": candidateName,
      "Timestamp": new Date().toISOString(), "Type": "Note", "Direction": "Internal",
      "Subject": "Contract marked as signed", "Body": "Contract marked as signed by " + req.user.name,
      "Status": "Completed", "Triggered By": req.user.name + " (Manual)"
    }}] }).catch(function() {});
    res.json({ success: true });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/score — Save document + communication scores ───
router.post('/score', function(req, res) {
  var candidateId = req.body.candidateId;
  var fields = {};
  if (req.body.documentScore !== undefined) fields["Document Score"] = parseFloat(req.body.documentScore);
  if (req.body.communicationScore !== undefined) fields["Communication Score"] = parseFloat(req.body.communicationScore);
  airtable.rawFetch("All Contacts", "PATCH", "/" + candidateId, { fields: fields }).then(function(data) {
    if (data.error) return res.status(400).json(data);
    res.json({ success: true });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/referee — Save referee details ───
router.post('/referee', function(req, res) {
  var candidateId = req.body.candidateId;
  var refNum = req.body.refereeNumber || "1"; // "1" or "2"
  var fields = {};
  if (req.body.name) fields["Referee " + refNum + " Name"] = req.body.name;
  if (req.body.relationship) fields["Referee " + refNum + " Relationship"] = req.body.relationship;
  if (req.body.phone) fields["Referee " + refNum + " Phone"] = req.body.phone;
  if (req.body.transcript) fields["Referee " + refNum + " Transcript"] = req.body.transcript;
  if (req.body.outcome) fields["Referee " + refNum + " Outcome"] = req.body.outcome;
  if (req.body.refCheckStatus) fields["Reference Check Status"] = req.body.refCheckStatus;
  airtable.rawFetch("All Contacts", "PATCH", "/" + candidateId, { fields: fields }).then(function(data) {
    if (data.error) return res.status(400).json(data);
    res.json({ success: true });
  }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/bulk-archive — Bulk set Recruitment Archived ───
router.post('/bulk-archive', function(req, res) {
  var ids = req.body.ids || [];
  if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });
  var batches = [];
  for (var i = 0; i < ids.length; i += 10) {
    batches.push(ids.slice(i, i + 10).map(function(id) {
      return { id: id, fields: { "Recruitment Archived": true } };
    }));
  }
  Promise.all(batches.map(function(batch) {
    return airtable.rawFetch("All Contacts", "PATCH", "", { records: batch });
  })).then(function() { res.json({ success: true, archived: ids.length }); })
  .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/bulk-stage — Bulk stage change (Airtable only, no automations) ───
router.post('/bulk-stage', function(req, res) {
  var ids = req.body.ids || [];
  var stage = req.body.stage || "";
  if (ids.length === 0 || !stage) return res.status(400).json({ error: "ids and stage required" });
  var batches = [];
  for (var i = 0; i < ids.length; i += 10) {
    batches.push(ids.slice(i, i + 10).map(function(id) {
      return { id: id, fields: { "Stage-in-Recruitment": stage } };
    }));
  }
  Promise.all(batches.map(function(batch) {
    return airtable.rawFetch("All Contacts", "PATCH", "", { records: batch });
  })).then(function() { res.json({ success: true, moved: ids.length, stage: stage }); })
  .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ─── POST /api/recruitment/scan-cv — AI CV extraction with Claude ───
router.post('/scan-cv', function(req, res) {
  try {
    var text = req.body.text || "";
    var fileName = req.body.fileName || "";
    if (!text || text.trim().length < 20) return res.status(400).json({ error: "No text to scan" });
    if (!env.anthropic.apiKey) return res.status(500).json({ error: "Anthropic API key not configured" });

    var prompt = 'Extract the following fields from this CV/resume text. Return ONLY valid JSON with these exact keys:\n{\n  "firstName": "",\n  "lastName": "",\n  "email": "",\n  "phone": "",\n  "suburb": "",\n  "state": "",\n  "appliedFor": "",\n  "skills": ""\n}\n\nRules:\n- phone: Australian mobile format preferred (e.g. 0412345678 or +61412345678)\n- state: Australian state abbreviation (QLD, NSW, VIC, SA, WA, NT, TAS, ACT)\n- suburb: just the suburb/city name\n- appliedFor: job title they seem suited for based on their experience, or "Disability Support Worker" as default for care/disability sector CVs\n- skills: comma-separated key skills (max 6), relevant to disability/aged care/support work if applicable\n- If a field cannot be determined, use empty string ""\n- Return ONLY the JSON object, no markdown, no backticks, no explanation\n\nCV Text:\n' + text.substring(0, 6000);

    var apiBody = JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    });

    var https = require("https");
    var opts = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.anthropic.apiKey,
        "anthropic-version": "2023-06-01"
      }
    };

    var apiReq = https.request(opts, function(apiRes) {
      var data = "";
      apiRes.on("data", function(c) { data += c; });
      apiRes.on("end", function() {
        try {
          var j = JSON.parse(data);
          if (j.error) {
            console.error("CV scan API error:", j.error);
            return res.status(502).json({ error: "AI API error: " + (j.error.message || JSON.stringify(j.error)) });
          }
          var content = "";
          if (j.content && j.content.length > 0) content = j.content[0].text || "";
          // Clean any markdown backticks
          content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          var parsed = JSON.parse(content);
          console.log("CV Scan [" + fileName + "]: " + (parsed.firstName || "") + " " + (parsed.lastName || "") + " <" + (parsed.email || "") + ">");
          res.json({ parsed: parsed });
        } catch(e) {
          console.error("CV scan parse error:", e.message, "Raw:", data.substring(0, 200));
          res.status(500).json({ error: "Failed to parse AI response", raw: data.substring(0, 500) });
        }
      });
    });
    apiReq.on("error", function(e) {
      console.error("CV scan request error:", e.message);
      res.status(502).json({ error: "AI request failed: " + e.message });
    });
    apiReq.write(apiBody);
    apiReq.end();
  } catch (err) {
    console.error("CV scan unexpected error:", err.message);
    res.status(500).json({ error: "CV scan failed: " + err.message });
  }
});

// ─── POST /api/recruitment/upload-cv — Upload CV file and save to Supabase (Airtable fallback) ───
router.post('/upload-cv', uploadCV.single("cv"), function(req, res) {
  var recordId = req.body.recordId || "";
  var aiSummary = req.body.aiSummary || "";
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (!recordId) return res.status(400).json({ error: "No recordId provided" });

  var BASE_URL = process.env.BASE_URL || ("http://localhost:" + (process.env.PORT || 3000));
  var fileUrl = BASE_URL + "/uploads/cv-temp/" + req.file.filename;
  var originalName = req.file.originalname || req.file.filename;
  var fs = require("fs");

  console.log("[CV Upload] Record:", recordId, "File:", originalName, "Serving URL:", fileUrl);

  // Helper: save CV info to Supabase contacts table
  function saveToSupabase() {
    var updateData = {
      cv_url: fileUrl,
      cv_filename: originalName,
      updated_at: new Date().toISOString()
    };
    if (aiSummary) updateData.cv_ai_summary = aiSummary;

    return sb.update('contacts', { eq: { id: recordId } }, updateData).then(function(sbRows) {
      if (!sbRows || sbRows.length === 0) {
        // recordId might be an Airtable ID — try matching by airtable_id
        return sb.update('contacts', { eq: { airtable_id: recordId } }, updateData);
      }
      return sbRows;
    }).then(function(sbRows) {
      console.log("[CV Upload] Supabase updated: " + (sbRows && sbRows.length || 0) + " rows");
      return true;
    });
  }

  // Try Airtable first (preserves existing attachment behavior)
  try {
    airtable.rawFetch("All Contacts", "PATCH", "/" + recordId, {
      fields: {
        "CV/Resume": [{ url: fileUrl, filename: originalName }]
      }
    }).then(function(data) {
      console.log("[CV Upload] Airtable response:", JSON.stringify(data).substring(0, 400));
      if (data.error) {
        var errMsg = data.error.message || JSON.stringify(data.error);
        console.warn("[CV Upload] Airtable PATCH failed:", errMsg, "— falling back to Supabase");
        // Airtable failed (e.g. INSUFFICIENT PERMISSIONS) — save to Supabase instead
        return saveToSupabase().then(function() {
          res.json({ success: true, source: 'supabase' });
        });
      }
      console.log("[CV Upload] CV attached to record:", recordId);

      // Also write to Supabase for data consistency (non-blocking)
      saveToSupabase().catch(function(e) {
        console.warn("[CV Upload] Supabase sync (non-blocking) failed:", e.message);
      });

      res.json({ success: true, source: 'airtable' });

      // Clean up temp file after 2 minutes (Airtable needs time to download from URL)
      setTimeout(function() {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
      }, 120000);
    }).catch(function(err) {
      console.warn("[CV Upload] Airtable exception:", err.message, "— falling back to Supabase");
      // Airtable completely failed — save to Supabase only
      saveToSupabase().then(function() {
        res.json({ success: true, source: 'supabase' });
        // Clean up temp file after 2 minutes
        setTimeout(function() {
          try { fs.unlinkSync(req.file.path); } catch(e) {}
        }, 120000);
      }).catch(function(sbErr) {
        console.error("[CV Upload] Both Airtable and Supabase failed:", sbErr.message);
        res.status(500).json({ error: "CV upload failed: " + err.message });
      });
    });
  } catch (outerErr) {
    // Airtable not available at all — go straight to Supabase
    console.warn("[CV Upload] Airtable unavailable:", outerErr.message, "— using Supabase only");
    saveToSupabase().then(function() {
      res.json({ success: true, source: 'supabase' });
      setTimeout(function() {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
      }, 120000);
    }).catch(function(sbErr) {
      console.error("[CV Upload] Supabase-only save failed:", sbErr.message);
      res.status(500).json({ error: "CV upload failed: " + sbErr.message });
    });
  }
});

// ─── GET /api/recruitment/templates — Return available SMS/email templates ───
router.get('/templates', function(req, res) {
  res.json({
    smsTemplates: Object.keys(RECRUIT_SMS_TEMPLATES),
    emailTemplates: Object.keys(RECRUIT_EMAIL_TEMPLATES),
    stages: V8_STAGES,
    automationMap: RECRUIT_AUTOMATION_MAP
  });
});

module.exports = router;

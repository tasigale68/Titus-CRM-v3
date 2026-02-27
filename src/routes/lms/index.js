var express = require('express');
var { authenticate, requireRole } = require('../../middleware/auth');
var { db } = require('../../db/sqlite');
var airtable = require('../../services/database');
var env = require('../../config/env');
var { msGraphFetch, getMsGraphToken } = require('../../services/email');

var router = express.Router();

function hasDB() {
  return (env.airtable.apiKey && env.airtable.baseId) || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

router.use(authenticate);

// ═══════════════════════════════════════════════════════════
//  LMS — Course List (v1, from /api/lms/courses)
// ═══════════════════════════════════════════════════════════
router.get('/courses', function (req, res) {
  if (!hasDB()) return res.json([]);
  airtable.fetchAllFromTable('Course List').then(function (records) {
    if (records && records.length > 0) {
      console.log('LMS Course fields:', Object.keys(records[0].fields || {}).join(', '));
    }
    var result = (records || []).map(function (r) {
      var f = r.fields || {};
      return {
        id: r.id,
        airtableId: r.id,
        name: f['Name'] || f['Course Name'] || '',
        category: f['Category'] || '',
        description: f['Course Description'] || f['Description'] || '',
        frequency: f['Frequency of Delivery (months)'] || f['Frequency'] || '',
        status: f['Status of Course'] || f['Status'] || '',
        duration: f['Time in Minutes'] || f['Duration'] || '',
        moduleCount: f['Module Count'] || f['Modules'] || 0
      };
    });
    console.log('LMS: Found ' + result.length + ' courses');
    res.json(result);
  }).catch(function (e) {
    console.error('LMS error:', e.message);
    res.json([]);
  });
});

// POST /api/lms/courses — create course
router.post('/courses', function (req, res) {
  if (!env.airtable.apiKey) return res.json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.name) fields['Name'] = req.body.name;
  if (req.body.category) fields['Category'] = req.body.category;
  if (req.body.description) fields['Course Description'] = req.body.description;
  fields['Status of Course'] = 'Active';
  airtable.rawFetch('Course List', 'POST', '', { records: [{ fields: fields }] }).then(function (data) {
    if (data.records && data.records[0]) res.json({ success: true, id: data.records[0].id });
    else res.json({ error: 'Failed to create course' });
  }).catch(function (err) { res.json({ error: err.message }); });
});

// PATCH /api/lms/courses/:id — update course
router.patch('/courses/:id', function (req, res) {
  if (!env.airtable.apiKey) return res.json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.name) fields['Name'] = req.body.name;
  if (req.body.category) fields['Category'] = req.body.category;
  if (req.body.description !== undefined) fields['Course Description'] = req.body.description;
  airtable.rawFetch('Course List', 'PATCH', '/' + req.params.id, { fields: fields }).then(function (data) {
    if (data.error) return res.json({ error: data.error.message || 'Update failed' });
    res.json({ success: true });
  }).catch(function (err) { res.json({ error: err.message }); });
});

// DELETE /api/lms/courses/:id — archive course
router.delete('/courses/:id', function (req, res) {
  if (!env.airtable.apiKey) return res.json({ error: 'Airtable not configured' });
  airtable.rawFetch('Course List', 'PATCH', '/' + req.params.id, { fields: { 'Status of Course': 'Archived' } }).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.json({ error: err.message }); });
});

// ═══════════════════════════════════════════════════════════
//  LMS — Batch Enroll (v1, from /api/lms/enroll)
// ═══════════════════════════════════════════════════════════
router.post('/enroll', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: 'Airtable not configured' });
  var candidateId = req.body.candidateId || '';
  var candidateName = req.body.candidateName || '';
  var courses = req.body.courses || [];
  if (!candidateId || courses.length === 0) return res.json({ error: 'Missing candidate or courses' });

  // Create enrollment records in Course Enrollments table
  var records = courses.map(function (c) {
    var fields = {
      'Contact': candidateName,
      'Course Name': c.name || ''
    };
    // If course has airtable ID, try to link it
    if (c.airtableId) fields['Course'] = [c.airtableId];
    // Try to link the contact
    if (candidateId) fields['Contact Record'] = [candidateId];
    fields['Enrollment Date'] = new Date().toISOString().split('T')[0];
    fields['Status'] = 'Enrolled';
    return { fields: fields };
  });

  // Batch create (max 10 at a time)
  var batches = [];
  for (var i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10));
  }

  var created = 0;
  var errors = 0;
  function processBatch(idx) {
    if (idx >= batches.length) {
      console.log('LMS Enroll: ' + created + ' enrollments created for ' + candidateName);
      res.json({ success: true, created: created, errors: errors });

      // Send enrollment notification email
      var candidateEmail = req.body.candidateEmail || '';
      var firstName = (candidateName || '').split(' ')[0] || 'Team Member';
      var courseNames = courses.map(function (c) { return c.name || 'Course'; }).join(', ');
      if (candidateEmail && env.microsoft.emailAddress && created > 0) {
        var emailSubject = "You've been enrolled in: " + courseNames;
        var emailBody = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">' +
          '<div style="background:linear-gradient(135deg,#0a9396,#2563eb);padding:24px;border-radius:12px 12px 0 0;text-align:center">' +
          '<div style="font-size:32px;margin-bottom:8px">🎓</div>' +
          '<h1 style="color:#fff;font-size:20px;margin:0">Course Enrollment</h1></div>' +
          '<div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">' +
          '<p style="font-size:15px;color:#1f2937;margin-bottom:16px">Hi ' + firstName + ',</p>' +
          '<p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:16px">You have been enrolled in <strong>' + created + ' course(s)</strong> at Delta Community Support:</p>' +
          '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">' +
          '<div style="font-size:14px;color:#1f2937"><strong>Courses:</strong> ' + courseNames + '</div>' +
          '<div style="font-size:14px;color:#1f2937;margin-top:4px"><strong>Date:</strong> ' + new Date().toLocaleDateString('en-AU') + '</div></div>' +
          '<p style="font-size:14px;color:#374151;line-height:1.6">Please log in to begin your training.</p>' +
          '<p style="font-size:14px;color:#6b7280;margin-top:24px">Kind regards,<br><strong>Delta Community Support</strong></p>' +
          '</div></div>';

        getMsGraphToken().then(function () {
          return msGraphFetch('/users/' + env.microsoft.emailAddress + '/sendMail', 'POST', {
            message: {
              subject: emailSubject,
              body: { contentType: 'HTML', content: emailBody },
              toRecipients: [{ emailAddress: { address: candidateEmail } }],
              from: { emailAddress: { address: env.microsoft.emailAddress } }
            }
          });
        }).then(function () {
          console.log('[LMS] Batch enrollment email sent to ' + candidateEmail);
        }).catch(function (emailErr) {
          console.error('[LMS] Batch enrollment email failed:', emailErr.message);
        });
      }
      return;
    }
    airtable.rawFetch('Course Enrollments', 'POST', '', { records: batches[idx] })
      .then(function (data) {
        if (data.records) created += data.records.length;
        else if (data.error) { errors += batches[idx].length; console.error('Enroll batch error:', data.error); }
        processBatch(idx + 1);
      })
      .catch(function (e) {
        errors += batches[idx].length;
        console.error('Enroll batch error:', e.message);
        processBatch(idx + 1);
      });
  }
  processBatch(0);
});

// ═══════════════════════════════════════════════════════════
//  LMS — Get Enrollments (v1, from /api/lms/enrollments)
// ═══════════════════════════════════════════════════════════
router.get('/enrollments', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var name = req.query.name || '';
  var email = req.query.email || '';
  var staffId = req.query.staffId || '';
  if (!name && !email && !staffId) return res.json([]);

  // Fetch enrollments and course list in parallel for richer data
  Promise.all([
    airtable.fetchAllFromTable('Course Enrollments'),
    airtable.fetchAllFromTable('Course List')
  ]).then(function (results) {
    var enrollments = results[0] || [];
    var courseList = results[1] || [];

    // Build course lookup by ID for duration/frequency
    var courseMap = {};
    courseList.forEach(function (cr) {
      courseMap[cr.id] = cr.fields || {};
    });

    var result = enrollments.filter(function (r) {
      var f = r.fields || {};
      // Match by staffId (linked record)
      if (staffId) {
        var link = f['Staff Name'] || f['Contact Record'] || [];
        if (Array.isArray(link) && link.indexOf(staffId) >= 0) return true;
      }
      // Match by name
      var contact = f['Contact'] || f['Contact Name'] || f['Name'] || '';
      if (Array.isArray(contact)) contact = contact.join(' ');
      var recEmail = f['Email'] || f['Contact Email'] || '';
      if (Array.isArray(recEmail)) recEmail = recEmail[0] || '';
      // Also check lookup name fields
      var staffNameLookup = f['Full Name (from Staff Name)'] || f['Name (from Staff Name)'] || '';
      if (Array.isArray(staffNameLookup)) staffNameLookup = staffNameLookup[0] || '';
      var matchName = name && (contact.toLowerCase().indexOf(name.toLowerCase()) >= 0 || staffNameLookup.toLowerCase().indexOf(name.toLowerCase()) >= 0);
      var matchEmail = email && recEmail.toLowerCase() === email.toLowerCase();
      return matchName || matchEmail;
    }).map(function (r) {
      var f = r.fields || {};
      var courseName = f['Course Name'] || '';
      if (Array.isArray(courseName)) courseName = courseName[0] || '';
      if (!courseName) courseName = f['Name (from Course)'] || f['Name (from Course List)'] || '';
      if (Array.isArray(courseName)) courseName = courseName[0] || '';

      // Get linked course ID for extra data
      var courseLink = f['Course List'] || f['Course'] || [];
      var courseId = Array.isArray(courseLink) ? courseLink[0] : courseLink;
      var courseData = courseId ? courseMap[courseId] || {} : {};

      // Get category from enrollment or course
      var category = f['Category (from Course)'] || f['Category (from Course List)'] || f['Category'] || courseData['Category'] || '';
      if (Array.isArray(category)) category = category[0] || '';

      // Progress: from enrollment field, default 0
      var progress = f['Progress'] || 0;
      if (typeof progress === 'string') progress = parseFloat(progress) || 0;

      // Status
      var status = f['Status'] || f['Completion Status'] || 'Enrolled';

      // Duration from course
      var duration = f['Time in Minutes (from Course List)'] || f['Duration (from Course)'] || courseData['Time in Minutes'] || courseData['Duration'] || '';
      if (Array.isArray(duration)) duration = duration[0] || '';

      // Frequency from course
      var frequency = f['Frequency of Delivery (months) (from Course List)'] || f['Frequency (from Course)'] || courseData['Frequency of Delivery (months)'] || courseData['Frequency'] || '';
      if (Array.isArray(frequency)) frequency = frequency[0] || '';

      return {
        enrollmentId: r.id,
        courseId: courseId || '',
        courseName: courseName,
        category: category,
        status: status,
        progress: progress,
        enrollDate: f['Enrollment Date'] || f['Date Enrolled'] || f['Enrolled Date & Time'] || '',
        completionDate: f['Completion Date'] || '',
        duration: duration,
        frequency: frequency
      };
    });

    // Sort: In Progress first, then Enrolled, then Completed
    var statusOrder = { 'in progress': 0, 'started': 0, 'enrolled': 1, 'completed': 2, 'expired': 3 };
    result.sort(function (a, b) {
      var sa = statusOrder[(a.status || '').toLowerCase()] !== undefined ? statusOrder[(a.status || '').toLowerCase()] : 1;
      var sb = statusOrder[(b.status || '').toLowerCase()] !== undefined ? statusOrder[(b.status || '').toLowerCase()] : 1;
      if (sa !== sb) return sa - sb;
      return (b.progress || 0) - (a.progress || 0);
    });

    res.json(result);
  }).catch(function (e) {
    console.error('Enrollments error:', e.message);
    res.json([]);
  });
});

// ═══════════════════════════════════════════════════════════
//  LMS — Course Detail with modules, lessons, quiz, questions
//  (from /api/lms/course-detail)
// ═══════════════════════════════════════════════════════════
router.get('/course-detail', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({});
  var courseId = req.query.id || '';
  if (!courseId) return res.json({ error: 'Missing course id' });

  Promise.all([
    airtable.fetchAllFromTable('Course Modules'),
    airtable.fetchAllFromTable('Course Lessons'),
    airtable.fetchAllFromTable('Course Quizzes'),
    airtable.fetchAllFromTable('Course QuizQuestions')
  ]).then(function (results) {
    var allModules = results[0] || [];
    var allLessons = results[1] || [];
    var allQuizzes = results[2] || [];
    var allQuestions = results[3] || [];

    // Filter modules for this course
    var modules = allModules.filter(function (r) {
      var link = r.fields['Course ID'];
      return Array.isArray(link) ? link.indexOf(courseId) >= 0 : link === courseId;
    }).map(function (r) {
      var f = r.fields || {};
      // Get lessons for this module
      var lessons = allLessons.filter(function (l) {
        var link = l.fields['Module ID'];
        return Array.isArray(link) ? link.indexOf(r.id) >= 0 : link === r.id;
      }).map(function (l) {
        var lf = l.fields || {};
        return {
          id: l.id,
          name: lf['Name'] || '',
          order: parseFloat(lf['Order'] || 0),
          type: lf['Type of Lesson'] || 'Text',
          content: lf['Content'] || '',
          videoUrl: lf['Video URL'] || '',
          notes: lf['Notes'] || ''
        };
      }).sort(function (a, b) { return a.order - b.order; });

      return {
        id: r.id,
        name: f['Name'] || '',
        order: parseFloat(f['Order'] || 0),
        description: f['Description'] || '',
        lessons: lessons
      };
    }).sort(function (a, b) { return a.order - b.order; });

    // Get quiz for this course
    var quiz = allQuizzes.find(function (r) {
      var link = r.fields['Courses'];
      return Array.isArray(link) ? link.indexOf(courseId) >= 0 : link === courseId;
    });

    var quizData = null;
    if (quiz) {
      var qf = quiz.fields || {};
      var questions = allQuestions.filter(function (r) {
        var link = r.fields['Quiz ID'];
        return Array.isArray(link) ? link.indexOf(quiz.id) >= 0 : link === quiz.id;
      }).map(function (r) {
        var f = r.fields || {};
        var opts = f['Options'] || '';
        // Parse options - stored as "a) Opt1, b) Opt2, c) Opt3, d) Opt4"
        var options = [];
        if (opts) {
          options = opts.split(/,\s*(?=[a-d]\))/i).map(function (o) {
            return o.replace(/^[a-d]\)\s*/i, '').trim();
          });
        }
        return {
          id: r.id,
          question: f['Name'] || '',
          options: options,
          correctAnswer: parseInt(f['Correct Answer'] || 0),
          order: parseFloat(f['Order'] || 0)
        };
      }).sort(function (a, b) { return a.order - b.order; });

      quizData = {
        id: quiz.id,
        name: qf['Name'] || '',
        description: qf['Description'] || '',
        passPercentage: parseFloat(qf['Pass Percentage'] || 100),
        questions: questions
      };
    }

    res.json({ modules: modules, quiz: quizData });
  }).catch(function (e) {
    console.error('LMS course-detail error:', e.message);
    res.json({ error: e.message });
  });
});

// ═══════════════════════════════════════════════════════════
//  LMS — Save Progress (from /api/lms/progress)
// ═══════════════════════════════════════════════════════════
router.post('/progress', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: 'Airtable not configured' });
  var enrollmentId = req.body.enrollmentId || '';
  var progress = req.body.progress || 0;
  var status = req.body.status || 'In Progress';
  var completionDate = req.body.completionDate || '';

  if (!enrollmentId) return res.json({ error: 'Missing enrollmentId' });

  var fields = { 'Progress': progress, 'Status': status };
  if (completionDate) fields['Completion Date'] = completionDate;

  airtable.rawFetch('Course Enrollments', 'PATCH', '/' + enrollmentId, { fields: fields })
    .then(function (data) {
      res.json({ success: true, data: data });
    }).catch(function (e) {
      console.error('LMS progress error:', e.message);
      res.json({ error: e.message });
    });
});

// ═══════════════════════════════════════════════════════════
//  LMS — Create Enrollment v2 (from /api/lms/enroll-v2)
// ═══════════════════════════════════════════════════════════
router.post('/enroll-v2', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: 'Airtable not configured' });
  var staffId = req.body.staffId || '';
  var courseId = req.body.courseId || '';
  var courseName = req.body.courseName || '';
  var staffName = req.body.staffName || '';
  if (!staffId || !courseId) return res.json({ error: 'Missing staffId or courseId' });

  var fields = {
    'Staff Name': [staffId],
    'Course List': [courseId],
    'Progress': 0,
    'Status': 'Enrolled',
    'Enrolled Date & Time': new Date().toISOString()
  };

  airtable.rawFetch('Course Enrollments', 'POST', '', { records: [{ fields: fields }] })
    .then(function (data) {
      if (data.records && data.records.length > 0) {
        var enrollmentId = data.records[0].id;
        res.json({ success: true, enrollmentId: enrollmentId });

        // Send enrollment notification email to staff member
        var staffEmail = req.body.staffEmail || '';
        var staffFirstName = req.body.staffFirstName || staffName.split(' ')[0] || 'Team Member';
        if (staffEmail && env.microsoft.emailAddress) {
          var emailSubject = "You've been enrolled in: " + (courseName || 'a course');
          var emailBody = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">' +
            '<div style="background:linear-gradient(135deg,#0a9396,#2563eb);padding:24px;border-radius:12px 12px 0 0;text-align:center">' +
            '<div style="font-size:32px;margin-bottom:8px">🎓</div>' +
            '<h1 style="color:#fff;font-size:20px;margin:0">Course Enrollment</h1></div>' +
            '<div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">' +
            '<p style="font-size:15px;color:#1f2937;margin-bottom:16px">Hi ' + staffFirstName + ',</p>' +
            '<p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:16px">You have been enrolled in <strong>' + (courseName || 'a new course') + '</strong> at Delta Community Support.</p>' +
            '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">' +
            '<div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Enrollment Details</div>' +
            '<div style="font-size:14px;color:#1f2937"><strong>Course:</strong> ' + (courseName || 'N/A') + '</div>' +
            '<div style="font-size:14px;color:#1f2937;margin-top:4px"><strong>Date Enrolled:</strong> ' + new Date().toLocaleDateString('en-AU') + '</div>' +
            '<div style="font-size:14px;color:#1f2937;margin-top:4px"><strong>Status:</strong> <span style="color:#0a9396;font-weight:700">Enrolled</span></div></div>' +
            '<p style="font-size:14px;color:#374151;line-height:1.6">Please log in to the Titus CRM platform to begin your training. If you have any questions, contact your Team Leader.</p>' +
            '<p style="font-size:14px;color:#6b7280;margin-top:24px">Kind regards,<br><strong>Delta Community Support</strong><br>Training & Compliance</p>' +
            '</div></div>';

          getMsGraphToken().then(function () {
            return msGraphFetch('/users/' + env.microsoft.emailAddress + '/sendMail', 'POST', {
              message: {
                subject: emailSubject,
                body: { contentType: 'HTML', content: emailBody },
                toRecipients: [{ emailAddress: { address: staffEmail } }],
                from: { emailAddress: { address: env.microsoft.emailAddress } }
              }
            });
          }).then(function () {
            console.log('[LMS] Enrollment email sent to ' + staffEmail + ' for course: ' + courseName);
          }).catch(function (emailErr) {
            console.error('[LMS] Enrollment email failed:', emailErr.message);
          });
        }
      } else {
        res.json({ error: data.error || 'Failed to create enrollment' });
      }
    }).catch(function (e) {
      console.error('LMS enroll-v2 error:', e.message);
      res.json({ error: e.message });
    });
});

// ═══════════════════════════════════════════════════════════
//  LMS — Get Staff Enrollments (from /api/lms/staff-enrollments)
// ═══════════════════════════════════════════════════════════
router.get('/staff-enrollments', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var staffId = req.query.staffId || '';

  airtable.fetchAllFromTable('Course Enrollments').then(function (records) {
    var result = (records || []).filter(function (r) {
      var link = r.fields['Staff Name'];
      if (!link) return false;
      return Array.isArray(link) ? link.indexOf(staffId) >= 0 : link === staffId;
    }).map(function (r) {
      var f = r.fields || {};
      var courseName = f['Name (from Course List)'];
      if (Array.isArray(courseName)) courseName = courseName[0] || '';
      var courseLink = f['Course List'];
      var courseId = Array.isArray(courseLink) ? courseLink[0] : courseLink;
      return {
        enrollmentId: r.id,
        courseId: courseId || '',
        courseName: courseName || '',
        progress: f['Progress'] || 0,
        status: f['Status'] || 'Enrolled',
        enrollDate: f['Enrolled Date & Time'] || '',
        completionDate: f['Completion Date'] || ''
      };
    });
    res.json(result);
  }).catch(function (e) {
    console.error('LMS staff-enrollments error:', e.message);
    res.json([]);
  });
});


// ═══════════════════════════════════════════════════════════
//  COURSES CRUD (v2, from /api/courses)
// ═══════════════════════════════════════════════════════════

// ─── Helper: map course fields ───
function mapCourseFields(r) {
  var f = r.fields || {};
  return {
    id: r.id, name: f['Course Name'], code: f['Course Code'],
    category: f['Category'], type: f['Type'], description: f['Description'],
    durationHours: parseFloat(f['Duration Hours'] || 0),
    passMarkPct: parseFloat(f['Pass Mark Percentage'] || 80),
    expiryMonths: parseInt(f['Certification Expiry Months'] || 0),
    relatedComplianceField: f['Related Compliance Field'] || '',
    externalProviderName: f['External Provider Name'] || '',
    externalProviderUrl: f['External Provider URL'] || '',
    externalCost: parseFloat(f['External Cost'] || 0),
    status: f['Status'] || 'Active'
  };
}

// GET /api/lms/courses-v2 — list courses with status filter
router.get('/courses-v2', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var filter = req.query.status ? encodeURIComponent("{Status}='" + req.query.status + "'") : encodeURIComponent("{Status}='Active'");
  var allRecords = [];
  function fetchPage(offset) {
    var url = '?filterByFormula=' + filter + '&pageSize=100' + (offset ? '&offset=' + offset : '');
    airtable.rawFetch('Course List', 'GET', url).then(function (data) {
      allRecords = allRecords.concat(data.records || []);
      if (data.offset) return fetchPage(data.offset);
      res.json(allRecords.map(mapCourseFields));
    }).catch(function (err) { res.status(500).json({ error: err.message }); });
  }
  fetchPage(null);
});

// GET /api/lms/courses-v2/:id — course detail with modules + questions
router.get('/courses-v2/:id', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  airtable.rawFetch('Course List', 'GET', '/' + req.params.id).then(function (rec) {
    var f = rec.fields || {};
    var course = mapCourseFields(rec);
    // Fetch modules
    var modFilter = encodeURIComponent("{Course}='" + (f['Course Name'] || '').replace(/'/g, "\\'") + "'");
    var modUrl = '?filterByFormula=' + modFilter + '&sort[0][field]=Module Order&sort[0][direction]=asc';
    return airtable.rawFetch('Course Modules', 'GET', modUrl).then(function (modData) {
      course.modules = (modData.records || []).map(function (m) {
        var mf = m.fields || {};
        return { id: m.id, order: parseInt(mf['Module Order'] || 0), title: mf['Module Title'],
          contentType: mf['Content Type'], contentBody: mf['Content Body'], attachment: mf['Attachment'] };
      });
      // Fetch questions
      var qFilter = encodeURIComponent("{Course}='" + (f['Course Name'] || '').replace(/'/g, "\\'") + "'");
      var qUrl = '?filterByFormula=' + qFilter + '&sort[0][field]=Question Order&sort[0][direction]=asc';
      return airtable.rawFetch('Assessment Questions', 'GET', qUrl);
    }).then(function (qData) {
      course.questions = (qData.records || []).map(function (q) {
        var qf = q.fields || {};
        var options = [];
        try { options = JSON.parse(qf['Options'] || '[]'); } catch (e) {}
        return { id: q.id, text: qf['Question Text'], type: qf['Question Type'],
          options: options, correctAnswer: qf['Correct Answer'], order: parseInt(qf['Question Order'] || 0) };
      });
      res.json(course);
    });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// POST /api/lms/courses-v2 — create course (admin only)
router.post('/courses-v2', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var fields = {
    'Course Name': req.body.name || '',
    'Course Code': req.body.code || '',
    'Category': req.body.category || 'Optional',
    'Type': req.body.type || 'Online',
    'Description': req.body.description || '',
    'Duration Hours': parseFloat(req.body.durationHours || 0),
    'Pass Mark Percentage': parseFloat(req.body.passMarkPct || 80),
    'Certification Expiry Months': parseInt(req.body.expiryMonths || 0),
    'Related Compliance Field': req.body.relatedComplianceField || '',
    'External Provider Name': req.body.externalProviderName || '',
    'External Provider URL': req.body.externalProviderUrl || '',
    'External Cost': parseFloat(req.body.externalCost || 0),
    'Status': 'Active'
  };
  airtable.rawFetch('Course List', 'POST', '', { records: [{ fields: fields }] }).then(function (data) {
    var created = (data.records && data.records[0]) ? data.records[0] : {};
    res.json({ success: true, id: created.id });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// PATCH /api/lms/courses-v2/:id — update course (admin only)
router.patch('/courses-v2/:id', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.name) fields['Course Name'] = req.body.name;
  if (req.body.code) fields['Course Code'] = req.body.code;
  if (req.body.category) fields['Category'] = req.body.category;
  if (req.body.type) fields['Type'] = req.body.type;
  if (req.body.description !== undefined) fields['Description'] = req.body.description;
  if (req.body.durationHours !== undefined) fields['Duration Hours'] = parseFloat(req.body.durationHours);
  if (req.body.passMarkPct !== undefined) fields['Pass Mark Percentage'] = parseFloat(req.body.passMarkPct);
  if (req.body.expiryMonths !== undefined) fields['Certification Expiry Months'] = parseInt(req.body.expiryMonths);
  if (req.body.relatedComplianceField !== undefined) fields['Related Compliance Field'] = req.body.relatedComplianceField;
  if (req.body.status) fields['Status'] = req.body.status;
  airtable.rawFetch('Course List', 'PATCH', '', { records: [{ id: req.params.id, fields: fields }] }).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// DELETE /api/lms/courses-v2/:id — soft delete (admin only)
router.delete('/courses-v2/:id', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  // Soft delete — set status to Archived
  airtable.rawFetch('Course List', 'PATCH', '', { records: [{ id: req.params.id, fields: { 'Status': 'Archived' } }] }).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  COURSE MODULES (from /api/courses/:id/modules, /api/modules/:id)
// ═══════════════════════════════════════════════════════════

// POST /api/lms/courses-v2/:id/modules — add module to course
router.post('/courses-v2/:id/modules', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  airtable.rawFetch('Course List', 'GET', '/' + req.params.id).then(function (course) {
    var courseName = (course.fields || {})['Course Name'] || '';
    var fields = {
      'Course': courseName,
      'Module Order': parseInt(req.body.order || 1),
      'Module Title': req.body.title || '',
      'Content Type': req.body.contentType || 'Text',
      'Content Body': req.body.contentBody || ''
    };
    return airtable.rawFetch('Course Modules', 'POST', '', { records: [{ fields: fields }] });
  }).then(function (data) {
    var created = (data.records && data.records[0]) ? data.records[0] : {};
    res.json({ success: true, id: created.id });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// PATCH /api/lms/modules/:id — update module
router.patch('/modules/:id', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.title) fields['Module Title'] = req.body.title;
  if (req.body.order !== undefined) fields['Module Order'] = parseInt(req.body.order);
  if (req.body.contentType) fields['Content Type'] = req.body.contentType;
  if (req.body.contentBody !== undefined) fields['Content Body'] = req.body.contentBody;
  airtable.rawFetch('Course Modules', 'PATCH', '', { records: [{ id: req.params.id, fields: fields }] }).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// DELETE /api/lms/modules/:id — delete module
router.delete('/modules/:id', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  airtable.rawFetch('Course Modules', 'DELETE', '/' + req.params.id).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  ASSESSMENT QUESTIONS (from /api/courses/:id/questions, /api/questions/:id)
// ═══════════════════════════════════════════════════════════

// POST /api/lms/courses-v2/:id/questions — add question to course
router.post('/courses-v2/:id/questions', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  airtable.rawFetch('Course List', 'GET', '/' + req.params.id).then(function (course) {
    var courseName = (course.fields || {})['Course Name'] || '';
    var fields = {
      'Course': courseName,
      'Question Text': req.body.text || '',
      'Question Type': req.body.type || 'Multiple Choice',
      'Options': JSON.stringify(req.body.options || []),
      'Correct Answer': req.body.correctAnswer || '',
      'Question Order': parseInt(req.body.order || 1)
    };
    return airtable.rawFetch('Assessment Questions', 'POST', '', { records: [{ fields: fields }] });
  }).then(function (data) {
    var created = (data.records && data.records[0]) ? data.records[0] : {};
    res.json({ success: true, id: created.id });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// PATCH /api/lms/questions/:id — update question
router.patch('/questions/:id', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var fields = {};
  if (req.body.text) fields['Question Text'] = req.body.text;
  if (req.body.type) fields['Question Type'] = req.body.type;
  if (req.body.options) fields['Options'] = JSON.stringify(req.body.options);
  if (req.body.correctAnswer !== undefined) fields['Correct Answer'] = req.body.correctAnswer;
  if (req.body.order !== undefined) fields['Question Order'] = parseInt(req.body.order);
  airtable.rawFetch('Assessment Questions', 'PATCH', '', { records: [{ id: req.params.id, fields: fields }] }).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// DELETE /api/lms/questions/:id — delete question
router.delete('/questions/:id', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  airtable.rawFetch('Assessment Questions', 'DELETE', '/' + req.params.id).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  ENROLLMENTS v2 (from /api/enrollments)
// ═══════════════════════════════════════════════════════════

// GET /api/lms/enrollments-v2 — list enrollments with filters
router.get('/enrollments-v2', function (req, res) {
  if (!hasDB()) return res.json([]);
  var filters = [];
  if (req.query.course) filters.push("{Course}='" + req.query.course + "'");
  if (req.query.status) filters.push("{Status}='" + req.query.status + "'");
  if (req.query.staff) filters.push("LOWER({Staff Email})='" + req.query.staff.toLowerCase() + "'");
  // Non-admin see only their own
  var fullUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);
  if (fullUser && fullUser.role !== 'superadmin' && fullUser.role !== 'admin') {
    filters.push("LOWER({Staff Email})='" + (fullUser.email || '').toLowerCase() + "'");
  }
  var formula = filters.length > 0 ? 'AND(' + filters.join(',') + ')' : '';
  var url = formula ? '?filterByFormula=' + encodeURIComponent(formula) : '';
  var allRecords = [];
  function fetchPage(offset) {
    var pageUrl = url + (url ? '&' : '?') + 'pageSize=100' + (offset ? '&offset=' + offset : '');
    airtable.rawFetch('Course Enrollments', 'GET', pageUrl).then(function (data) {
      allRecords = allRecords.concat(data.records || []);
      if (data.offset) return fetchPage(data.offset);
      res.json(allRecords.map(function (r) {
        var f = r.fields || {};
        return {
          id: r.id, staffName: f['Staff Name'], staffEmail: f['Staff Email'],
          course: f['Course'], assignedDate: f['Assigned Date'], dueDate: f['Due Date'],
          startedDate: f['Started Date'], completedDate: f['Completed Date'],
          progressPct: parseFloat(f['Progress Percentage'] || 0),
          currentModule: f['Current Module'] || '',
          assessmentScore: parseFloat(f['Assessment Score'] || 0),
          assessmentAttempts: parseInt(f['Assessment Attempts'] || 0),
          certificateIssued: f['Certificate Issued'] === true,
          certificateExpiry: f['Certificate Expiry Date'] || '',
          status: f['Status'] || 'Assigned',
          assignedBy: f['Assigned By'] || '',
          autoAssigned: f['Auto Assigned'] === true
        };
      }));
    }).catch(function (err) { res.status(500).json({ error: err.message }); });
  }
  fetchPage(null);
});

// POST /api/lms/enrollments-v2 — create enrollment
router.post('/enrollments-v2', function (req, res) {
  if (!hasDB()) return res.status(500).json({ error: 'Database not configured' });
  var staffEmail = req.body.staffEmail;
  var staffName = req.body.staffName || '';
  var courseId = req.body.courseId;
  var courseName = req.body.courseName || '';
  var dueDate = req.body.dueDate || '';
  if (!staffEmail || (!courseId && !courseName)) return res.status(400).json({ error: 'staffEmail and course required' });
  var getCourse = courseId ? airtable.rawFetch('Course List', 'GET', '/' + courseId) : Promise.resolve({ fields: { 'Course Name': courseName } });
  getCourse.then(function (courseRec) {
    var cName = (courseRec.fields || {})['Course Name'] || courseName;
    var fields = {
      'Staff Name': staffName,
      'Staff Email': staffEmail,
      'Course': cName,
      'Assigned Date': new Date().toISOString().split('T')[0],
      'Due Date': dueDate,
      'Status': 'Assigned',
      'Progress Percentage': 0,
      'Assessment Attempts': 0,
      'Assigned By': req.user.name || req.user.email,
      'Auto Assigned': req.body.autoAssigned === true
    };
    return airtable.rawFetch('Course Enrollments', 'POST', '', { records: [{ fields: fields }] });
  }).then(function (data) {
    var created = (data.records && data.records[0]) ? data.records[0] : {};
    res.json({ success: true, id: created.id });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// POST /api/lms/enrollments-v2/bulk — bulk enroll by job title
router.post('/enrollments-v2/bulk', requireRole('superadmin', 'admin'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var jobTitle = req.body.jobTitle || '';
  var courseId = req.body.courseId;
  var courseName = req.body.courseName || '';
  var dueDate = req.body.dueDate || '';
  if (!jobTitle || (!courseId && !courseName)) return res.status(400).json({ error: 'jobTitle and course required' });
  // Fetch staff with matching job title from All Contacts
  var filter = encodeURIComponent("FIND('" + jobTitle + "', {Type})");
  airtable.rawFetch('All Contacts', 'GET', '?filterByFormula=' + filter + '&fields[]=Full Name&fields[]=Email&pageSize=100').then(function (data) {
    var staff = (data.records || []).filter(function (r) { return r.fields && r.fields['Email']; });
    var getCourse = courseId ? airtable.rawFetch('Course List', 'GET', '/' + courseId) : Promise.resolve({ fields: { 'Course Name': courseName } });
    return getCourse.then(function (courseRec) {
      var cName = (courseRec.fields || {})['Course Name'] || courseName;
      var records = staff.map(function (s) {
        return {
          fields: {
            'Staff Name': s.fields['Full Name'] || '',
            'Staff Email': s.fields['Email'],
            'Course': cName,
            'Assigned Date': new Date().toISOString().split('T')[0],
            'Due Date': dueDate,
            'Status': 'Assigned',
            'Progress Percentage': 0,
            'Assessment Attempts': 0,
            'Assigned By': req.user.name || req.user.email,
            'Auto Assigned': true
          }
        };
      });
      var batches = [];
      for (var i = 0; i < records.length; i += 10) batches.push(records.slice(i, i + 10));
      return Promise.all(batches.map(function (b) { return airtable.rawFetch('Course Enrollments', 'POST', '', { records: b }); })).then(function () {
        return staff.length;
      });
    });
  }).then(function (count) {
    res.json({ success: true, enrolled: count });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// PATCH /api/lms/enrollments-v2/:id — update enrollment progress
router.patch('/enrollments-v2/:id', function (req, res) {
  if (!hasDB()) return res.status(500).json({ error: 'Database not configured' });
  var fields = {};
  if (req.body.status) fields['Status'] = req.body.status;
  if (req.body.progressPct !== undefined) fields['Progress Percentage'] = parseFloat(req.body.progressPct);
  if (req.body.currentModule) fields['Current Module'] = req.body.currentModule;
  if (req.body.startedDate) fields['Started Date'] = req.body.startedDate;
  if (req.body.completedDate) fields['Completed Date'] = req.body.completedDate;
  if (req.body.assessmentScore !== undefined) fields['Assessment Score'] = parseFloat(req.body.assessmentScore);
  if (req.body.assessmentAttempts !== undefined) fields['Assessment Attempts'] = parseInt(req.body.assessmentAttempts);
  if (req.body.certificateIssued !== undefined) fields['Certificate Issued'] = req.body.certificateIssued;
  if (req.body.certificateExpiry) fields['Certificate Expiry Date'] = req.body.certificateExpiry;
  airtable.rawFetch('Course Enrollments', 'PATCH', '', { records: [{ id: req.params.id, fields: fields }] }).then(function () {
    res.json({ success: true });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// POST /api/lms/enrollments-v2/:id/submit-assessment — submit assessment + auto-score
router.post('/enrollments-v2/:id/submit-assessment', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var answers = req.body.answers || {}; // { questionId: selectedAnswer }
  // Get enrollment details
  airtable.rawFetch('Course Enrollments', 'GET', '/' + req.params.id).then(function (enrollment) {
    var ef = enrollment.fields || {};
    var courseName = ef['Course'] || '';
    var attempts = parseInt(ef['Assessment Attempts'] || 0) + 1;
    // Get course for pass mark
    var courseFilter = encodeURIComponent("{Course Name}='" + courseName.replace(/'/g, "\\'") + "'");
    return airtable.rawFetch('Course List', 'GET', '?filterByFormula=' + courseFilter + '&maxRecords=1').then(function (courseData) {
      var courseRec = (courseData.records || [])[0];
      var passMarkPct = parseFloat((courseRec ? courseRec.fields : {})['Pass Mark Percentage'] || 80);
      var expiryMonths = parseInt((courseRec ? courseRec.fields : {})['Certification Expiry Months'] || 0);
      var complianceField = (courseRec ? courseRec.fields : {})['Related Compliance Field'] || '';
      // Get questions
      var qFilter = encodeURIComponent("{Course}='" + courseName.replace(/'/g, "\\'") + "'");
      return airtable.rawFetch('Assessment Questions', 'GET', '?filterByFormula=' + qFilter).then(function (qData) {
        var questions = qData.records || [];
        var correct = 0;
        var total = questions.length;
        questions.forEach(function (q) {
          var qf = q.fields || {};
          var userAnswer = answers[q.id] || '';
          if (userAnswer === qf['Correct Answer']) correct++;
        });
        var score = total > 0 ? Math.round((correct / total) * 100) : 0;
        var passed = score >= passMarkPct;
        var updateFields = {
          'Assessment Score': score,
          'Assessment Attempts': attempts
        };
        if (passed) {
          var now = new Date();
          updateFields['Status'] = 'Completed';
          updateFields['Completed Date'] = now.toISOString().split('T')[0];
          updateFields['Progress Percentage'] = 100;
          updateFields['Certificate Issued'] = true;
          if (expiryMonths > 0) {
            var expiry = new Date(now.getTime() + expiryMonths * 30 * 86400000);
            updateFields['Certificate Expiry Date'] = expiry.toISOString().split('T')[0];
          }
        }
        return airtable.rawFetch('Course Enrollments', 'PATCH', '', {
          records: [{ id: req.params.id, fields: updateFields }]
        }).then(function () {
          // If passed and has compliance field, update contact
          if (passed && complianceField && ef['Staff Email']) {
            var contactFilter = encodeURIComponent("LOWER({Email})='" + ef['Staff Email'].toLowerCase() + "'");
            airtable.rawFetch('All Contacts', 'GET', '?filterByFormula=' + contactFilter + '&maxRecords=1').then(function (contactData) {
              var contact = (contactData.records || [])[0];
              if (contact && expiryMonths > 0) {
                var expDate = new Date(Date.now() + expiryMonths * 30 * 86400000).toISOString().split('T')[0];
                var upd = {};
                upd[complianceField] = expDate;
                airtable.rawFetch('All Contacts', 'PATCH', '', { records: [{ id: contact.id, fields: upd }] }).catch(function () {});
              }
            }).catch(function () {});
          }
          res.json({
            success: true, score: score, total: total, correct: correct,
            passed: passed, passMarkPct: passMarkPct, attempts: attempts
          });
        });
      });
    });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// GET /api/lms/enrollments-v2/:id/certificate — generate certificate PDF
router.get('/enrollments-v2/:id/certificate', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  airtable.rawFetch('Course Enrollments', 'GET', '/' + req.params.id).then(function (enrollment) {
    var ef = enrollment.fields || {};
    if (ef['Status'] !== 'Completed') return res.status(400).json({ error: 'Course not completed' });
    var PDFDocument = require('pdfkit');
    var doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Certificate-' + (ef['Staff Name'] || '').replace(/\s/g, '-') + '.pdf');
    doc.pipe(res);
    // Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#2454A0');
    doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke('#00B4D8');
    doc.moveDown(3);
    doc.fontSize(14).font('Helvetica').fillColor('#2454A0').text('DELTA COMMUNITY SUPPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(32).font('Helvetica-Bold').fillColor('#0B1D3A').text('Certificate of Completion', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica').fillColor('#333').text('This is to certify that', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#2454A0').text(ef['Staff Name'] || 'Staff Member', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').fillColor('#333').text('has successfully completed', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0B1D3A').text(ef['Course'] || 'Course', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica').fillColor('#666');
    doc.text('Completion Date: ' + (ef['Completed Date'] || ''), { align: 'center' });
    if (ef['Certificate Expiry Date']) {
      doc.text('Valid Until: ' + ef['Certificate Expiry Date'], { align: 'center' });
    }
    if (ef['Assessment Score']) {
      doc.text('Score: ' + ef['Assessment Score'] + '%', { align: 'center' });
    }
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica').fillColor('#333');
    doc.text('_________________________', 200, doc.y);
    doc.text('_________________________', 480, doc.y - 14);
    doc.moveDown(0.3);
    doc.text('Director, Delta Community Support', 200, doc.y);
    doc.text('Date', 520, doc.y - 12);
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999').text('Certificate ID: CERT-' + req.params.id.substring(0, 8).toUpperCase(), { align: 'center' });
    doc.text('Delta Community Support Pty Ltd | ABN: 62 674 549 054', { align: 'center' });
    doc.end();
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  COMPLIANCE DASHBOARD (from /api/compliance/dashboard)
// ═══════════════════════════════════════════════════════════
router.get('/compliance/dashboard', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({});
  // Fetch all enrollments and aggregate
  var allEnrollments = [];
  function fetchPage(offset) {
    var url = '?pageSize=100' + (offset ? '&offset=' + offset : '');
    airtable.rawFetch('Course Enrollments', 'GET', url).then(function (data) {
      allEnrollments = allEnrollments.concat(data.records || []);
      if (data.offset) return fetchPage(data.offset);
      // Aggregate by staff
      var staffMap = {};
      allEnrollments.forEach(function (r) {
        var f = r.fields || {};
        var email = f['Staff Email'] || 'unknown';
        if (!staffMap[email]) {
          staffMap[email] = { name: f['Staff Name'] || email, email: email, total: 0, completed: 0, overdue: 0, inProgress: 0 };
        }
        staffMap[email].total++;
        if (f['Status'] === 'Completed') staffMap[email].completed++;
        else if (f['Status'] === 'Overdue') staffMap[email].overdue++;
        else if (f['Status'] === 'In Progress') staffMap[email].inProgress++;
      });
      var staffList = Object.values(staffMap);
      var totalStaff = staffList.length;
      var fullyCompliant = staffList.filter(function (s) { return s.completed === s.total; }).length;
      var nonCompliant = staffList.filter(function (s) { return s.overdue > 0; }).length;
      var overdueCourses = allEnrollments.filter(function (r) { return (r.fields || {})['Status'] === 'Overdue'; }).length;
      // Expiring within 30 days
      var now = new Date();
      var expiring = allEnrollments.filter(function (r) {
        var f = r.fields || {};
        if (!f['Certificate Expiry Date']) return false;
        var exp = new Date(f['Certificate Expiry Date']);
        var days = (exp - now) / 86400000;
        return days > 0 && days <= 30;
      }).length;
      res.json({
        totalStaff: totalStaff, fullyCompliant: fullyCompliant,
        partiallyCompliant: totalStaff - fullyCompliant - nonCompliant,
        nonCompliant: nonCompliant, overdueCourses: overdueCourses,
        expiringWithin30Days: expiring, staff: staffList
      });
    }).catch(function (err) { res.status(500).json({ error: err.message }); });
  }
  fetchPage(null);
});

// GET /api/lms/compliance/staff/:email — staff compliance detail
router.get('/compliance/staff/:email', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var filter = encodeURIComponent("LOWER({Staff Email})='" + req.params.email.toLowerCase() + "'");
  airtable.rawFetch('Course Enrollments', 'GET', '?filterByFormula=' + filter).then(function (data) {
    res.json((data.records || []).map(function (r) {
      var f = r.fields || {};
      return {
        id: r.id, course: f['Course'], status: f['Status'],
        assignedDate: f['Assigned Date'], dueDate: f['Due Date'],
        completedDate: f['Completed Date'], score: parseFloat(f['Assessment Score'] || 0),
        certificateExpiry: f['Certificate Expiry Date'] || '',
        progressPct: parseFloat(f['Progress Percentage'] || 0)
      };
    }));
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});


// ═══════════════════════════════════════════════════════════
//  SEED NDIS MANDATORY COURSES (from /api/courses/seed)
// ═══════════════════════════════════════════════════════════
router.post('/courses/seed', requireRole('superadmin', 'director'), function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: 'Airtable not configured' });
  var courses = [
    { name: 'NDIS Worker Orientation Module', code: 'NDIS-ORI-001', category: 'Mandatory', type: 'Online', duration: 1.5, passMark: 80, expiry: 0, compliance: '',
      modules: [
        { order: 1, title: 'Introduction to NDIS', type: 'Text', body: 'The National Disability Insurance Scheme (NDIS) is Australia\'s national scheme for people with disability. It provides funding for supports and services to eligible Australians.\n\nKey Principles:\n- Choice and control for participants\n- Person-centred approach\n- Rights-based framework\n- Independence and social participation\n\nThe NDIS was established under the National Disability Insurance Scheme Act 2013 and is administered by the National Disability Insurance Agency (NDIA).' },
        { order: 2, title: 'Rights of Participants', type: 'Text', body: 'NDIS participants have fundamental rights:\n\n1. Right to dignity and respect\n2. Right to privacy and confidentiality\n3. Right to choose their supports and providers\n4. Right to safe, quality services\n5. Right to be free from abuse, neglect and exploitation\n6. Right to complain without fear of retribution\n7. Right to access information in an accessible format\n8. Right to participate in decisions about their supports' },
        { order: 3, title: 'Code of Conduct', type: 'Text', body: 'The NDIS Code of Conduct requires workers to:\n\n1. Act with respect for individual rights\n2. Respect privacy and confidentiality\n3. Provide supports safely and competently\n4. Act with integrity, honesty and transparency\n5. Promptly take steps to raise and act on concerns about safety\n6. Take all reasonable steps to prevent and respond to all forms of violence, exploitation, neglect and abuse\n7. Take all reasonable steps to prevent sexual misconduct' },
        { order: 4, title: 'Reporting Obligations', type: 'Text', body: 'As an NDIS worker, you must report:\n\n1. Reportable incidents (death, serious injury, abuse, neglect, sexual misconduct, restrictive practices)\n2. Complaints or concerns about services\n3. Suspected abuse or neglect — immediately to supervisor and NDIS Commission\n4. Work health and safety hazards\n5. Changes to worker screening status\n\nReporting to NDIS Quality and Safeguards Commission: 1800 035 544' }
      ],
      questions: [
        { text: 'What does NDIS stand for?', type: 'Multiple Choice', options: ['National Disability Insurance Scheme', 'National Disability Income Support', 'National Disability Integration Service', 'National Disability Inclusion Scheme'], answer: 'National Disability Insurance Scheme' },
        { text: 'Participants have the right to choose their own supports and providers.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'Which is NOT a requirement of the NDIS Code of Conduct?', type: 'Multiple Choice', options: ['Act with respect', 'Provide supports safely', 'Share participant information freely', 'Act with integrity'], answer: 'Share participant information freely' },
        { text: 'When should suspected abuse be reported?', type: 'Multiple Choice', options: ['At the end of the week', 'During the next team meeting', 'Immediately', 'Only if you have proof'], answer: 'Immediately' },
        { text: 'The NDIS is administered by which agency?', type: 'Multiple Choice', options: ['Department of Health', 'NDIA', 'Centrelink', 'Medicare'], answer: 'NDIA' },
        { text: 'Workers must take steps to prevent all forms of violence and exploitation.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'What is the NDIS Commission phone number for reporting?', type: 'Multiple Choice', options: ['1800 035 544', '000', '1300 123 456', '131 450'], answer: '1800 035 544' },
        { text: 'Privacy and confidentiality of participants should always be respected.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'Restrictive practices are a type of reportable incident.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'The NDIS was established under which Act?', type: 'Multiple Choice', options: ['Disability Services Act 1986', 'NDIS Act 2013', 'Social Security Act 1991', 'Aged Care Act 1997'], answer: 'NDIS Act 2013' }
      ]
    },
    { name: 'First Aid', code: 'FA-001', category: 'Mandatory', type: 'External', duration: 8, passMark: 100, expiry: 36, compliance: 'First Aid Expiry',
      modules: [{ order: 1, title: 'External Certification Required', type: 'Text', body: 'This course requires external certification from an approved Registered Training Organisation (RTO).\n\nUpload your First Aid certificate (HLTAID011 — Provide First Aid) after completing external training.\n\nYour certificate must be:\n- From a nationally accredited RTO\n- Current and not expired\n- Include your full legal name' }],
      questions: []
    },
    { name: 'CPR', code: 'CPR-001', category: 'Mandatory', type: 'External', duration: 4, passMark: 100, expiry: 12, compliance: 'CPR Expiry',
      modules: [{ order: 1, title: 'External Certification Required', type: 'Text', body: 'This course requires external certification.\n\nUpload your CPR certificate (HLTAID009 — Provide CPR) after completing external training.\n\nCPR must be renewed annually. Your certificate must be:\n- From a nationally accredited RTO\n- Current and not expired\n- Include your full legal name' }],
      questions: []
    },
    { name: 'Manual Handling', code: 'MH-001', category: 'Mandatory', type: 'Online', duration: 2, passMark: 80, expiry: 24, compliance: '',
      modules: [
        { order: 1, title: 'Principles of Safe Manual Handling', type: 'Text', body: 'Manual handling includes any activity requiring the use of force exerted by a person to lift, push, pull, carry or otherwise move, hold or restrain any object.\n\nKey Principles:\n1. Plan the task before starting\n2. Assess the load — weight, size, shape\n3. Keep the load close to your body\n4. Maintain a stable base of support\n5. Use your legs, not your back\n6. Avoid twisting while lifting\n7. Get help for heavy or awkward loads' },
        { order: 2, title: 'Risk Assessment', type: 'Text', body: 'Before any manual handling task, assess:\n\nT — Task: What does the task involve?\nI — Individual: What are the worker\'s capabilities?\nL — Load: What are the characteristics of the load?\nE — Environment: What are the environmental conditions?\n\nControl measures:\n1. Eliminate the hazard if possible\n2. Use mechanical aids (hoists, slide sheets)\n3. Modify the task\n4. Provide training and supervision' },
        { order: 3, title: 'Practical Techniques', type: 'Text', body: 'Participant Transfer Techniques:\n\n1. Standing transfers: Use pivot technique with transfer belt\n2. Seated transfers: Use slide board or stand-pivot\n3. Hoisting: Check sling size, secure all clips, never leave unattended\n4. Repositioning in bed: Use slide sheets, draw sheets\n\nAlways:\n- Communicate with the participant\n- Check equipment before use\n- Use the participant\'s care plan\n- Report any concerns immediately' }
      ],
      questions: [
        { text: 'What does the \'L\' in TILE stand for?', type: 'Multiple Choice', options: ['Lift', 'Load', 'Location', 'Level'], answer: 'Load' },
        { text: 'You should always lift with your back, not your legs.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'When should you assess manual handling risks?', type: 'Multiple Choice', options: ['After the task', 'Before starting the task', 'Only on Mondays', 'When told to'], answer: 'Before starting the task' },
        { text: 'Mechanical aids should be used when available.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'What is the first priority in the hierarchy of controls?', type: 'Multiple Choice', options: ['PPE', 'Training', 'Elimination', 'Modification'], answer: 'Elimination' },
        { text: 'It is safe to twist your body while carrying a heavy load.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'Before using a hoist, you should:', type: 'Multiple Choice', options: ['Just start using it', 'Check the equipment first', 'Ask the participant to walk', 'Skip it'], answer: 'Check the equipment first' },
        { text: 'The load should be kept close to your body when lifting.', type: 'True False', options: ['True', 'False'], answer: 'True' }
      ]
    },
    { name: 'Medication Administration', code: 'MED-001', category: 'Mandatory', type: 'Blended', duration: 3, passMark: 80, expiry: 24, compliance: '',
      modules: [
        { order: 1, title: 'Medication Safety', type: 'Text', body: 'The 7 Rights of Medication Administration:\n\n1. Right Person\n2. Right Medication\n3. Right Dose\n4. Right Route\n5. Right Time\n6. Right Reason\n7. Right Documentation\n\nNever administer medication without:\n- Current medication chart/profile\n- Proper training and delegation\n- Understanding of the medication\'s purpose and side effects' },
        { order: 2, title: 'Administration Procedures', type: 'Text', body: 'Steps for Safe Administration:\n\n1. Wash hands thoroughly\n2. Check the medication chart\n3. Verify the 7 Rights\n4. Check medication packaging for expiry, damage\n5. Prepare medication as per instructions\n6. Administer to participant\n7. Observe for immediate reactions\n8. Document immediately after administration\n\nPRN (as needed) medications require specific protocols and must be documented with reason for administration.' },
        { order: 3, title: 'Documentation Requirements', type: 'Text', body: 'Documentation must include:\n\n- Date and time of administration\n- Medication name and dose\n- Route of administration\n- Staff member administering\n- Participant response/observations\n- Any refusals or missed doses\n\nErrors must be:\n- Reported immediately to supervisor\n- Documented in incident report\n- Medical advice sought if necessary\n- Poisons Information: 13 11 26' }
      ],
      questions: [
        { text: 'How many \'Rights\' of medication administration are there?', type: 'Multiple Choice', options: ['5', '6', '7', '8'], answer: '7' },
        { text: 'You should document medication administration before giving it.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'What should you do first before administering medication?', type: 'Multiple Choice', options: ['Open the packet', 'Wash your hands', 'Call the doctor', 'Check the time'], answer: 'Wash your hands' },
        { text: 'PRN medications can be given at any time without documentation.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'If a medication error occurs, you should:', type: 'Multiple Choice', options: ['Hide it', 'Report it immediately', 'Wait until next shift', 'Ask a colleague'], answer: 'Report it immediately' },
        { text: 'Expired medications should still be administered if nothing else is available.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'What is the Poisons Information number?', type: 'Multiple Choice', options: ['000', '13 11 26', '1800 035 544', '131 450'], answer: '13 11 26' },
        { text: 'Each medication dose must be documented.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'Which is NOT one of the 7 Rights?', type: 'Multiple Choice', options: ['Right Person', 'Right Cost', 'Right Route', 'Right Time'], answer: 'Right Cost' },
        { text: 'Medication administration requires proper training and delegation.', type: 'True False', options: ['True', 'False'], answer: 'True' }
      ]
    },
    { name: 'Behaviour Support', code: 'BS-001', category: 'Mandatory', type: 'Online', duration: 3, passMark: 80, expiry: 24, compliance: '',
      modules: [
        { order: 1, title: 'Understanding Behaviour', type: 'Text', body: 'All behaviour is communication. People with disability may use behaviour to express:\n\n- Unmet needs (pain, hunger, boredom)\n- Frustration with communication barriers\n- Environmental triggers (noise, crowds)\n- Emotional distress or anxiety\n- Desire for attention or social connection\n\nBehaviour of Concern is behaviour that puts the person or others at risk. It requires a positive, person-centred response.' },
        { order: 2, title: 'Positive Behaviour Support', type: 'Text', body: 'Positive Behaviour Support (PBS) focuses on:\n\n1. Understanding the function of behaviour\n2. Environmental modifications\n3. Skill development for the person\n4. Proactive strategies to prevent escalation\n5. Quality of life improvements\n\nKey strategies:\n- Active listening and validation\n- Redirection and distraction\n- Offering choices\n- Maintaining calm body language\n- De-escalation techniques\n- Following the person\'s Behaviour Support Plan (BSP)' },
        { order: 3, title: 'Restrictive Practices Awareness', type: 'Text', body: 'Restrictive practices are any practice that restricts the rights or freedom of movement of a person with disability.\n\nTypes:\n1. Seclusion\n2. Chemical restraint\n3. Mechanical restraint\n4. Physical restraint\n5. Environmental restraint\n\nRestrictions MUST:\n- Be authorised in the person\'s BSP\n- Be the least restrictive option\n- Be used only as a last resort\n- Be reported as required\n- Be reviewed regularly\n\nUnauthorised restrictive practices are a reportable incident.' }
      ],
      questions: [
        { text: 'All behaviour is a form of communication.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'What does PBS stand for?', type: 'Multiple Choice', options: ['Personal Behaviour System', 'Positive Behaviour Support', 'Professional Behaviour Standards', 'Physical Behaviour Services'], answer: 'Positive Behaviour Support' },
        { text: 'Restrictive practices should be used as a first response.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'How many types of restrictive practices are there?', type: 'Multiple Choice', options: ['3', '4', '5', '6'], answer: '5' },
        { text: 'Environmental restraint is a type of restrictive practice.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'When de-escalating, you should:', type: 'Multiple Choice', options: ['Raise your voice', 'Use calm body language', 'Ignore the person', 'Restrain them'], answer: 'Use calm body language' },
        { text: 'Unauthorised restrictive practices are a reportable incident.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'Behaviour of Concern puts the person or others at risk.', type: 'True False', options: ['True', 'False'], answer: 'True' }
      ]
    },
    { name: 'Infection Control', code: 'IC-001', category: 'Mandatory', type: 'Online', duration: 1.5, passMark: 80, expiry: 12, compliance: '',
      modules: [
        { order: 1, title: 'Standard Precautions', type: 'Text', body: 'Standard precautions apply to ALL care situations:\n\n1. Hand hygiene — the single most important measure\n2. Use of PPE appropriate to the task\n3. Respiratory hygiene and cough etiquette\n4. Safe handling and disposal of sharps\n5. Environmental cleaning\n6. Linen management\n7. Waste management\n\nThe chain of infection: Agent \u2192 Reservoir \u2192 Portal of Exit \u2192 Mode of Transmission \u2192 Portal of Entry \u2192 Susceptible Host. Breaking any link prevents transmission.' },
        { order: 2, title: 'PPE and Hand Hygiene', type: 'Text', body: '5 Moments of Hand Hygiene:\n1. Before touching a person\n2. Before a procedure\n3. After a procedure or body fluid exposure\n4. After touching a person\n5. After touching a person\'s surroundings\n\nPPE Selection:\n- Gloves: contact with blood/body fluids\n- Gown: splashes likely\n- Mask: respiratory transmission risk\n- Eye protection: splash risk to eyes\n\nPut on: Gown \u2192 Mask \u2192 Eye protection \u2192 Gloves\nRemove: Gloves \u2192 Eye protection \u2192 Gown \u2192 Mask\nAlways wash hands after removing PPE.' }
      ],
      questions: [
        { text: 'What is the single most important infection control measure?', type: 'Multiple Choice', options: ['Wearing gloves', 'Hand hygiene', 'Wearing a mask', 'Cleaning surfaces'], answer: 'Hand hygiene' },
        { text: 'Standard precautions only apply to sick patients.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'How many Moments of Hand Hygiene are there?', type: 'Multiple Choice', options: ['3', '4', '5', '6'], answer: '5' },
        { text: 'Gloves should be worn when there is contact with blood or body fluids.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'What is the correct order for putting on PPE?', type: 'Multiple Choice', options: ['Gloves, Gown, Mask, Eye', 'Gown, Mask, Eye, Gloves', 'Mask, Gloves, Gown, Eye', 'Eye, Mask, Gown, Gloves'], answer: 'Gown, Mask, Eye, Gloves' },
        { text: 'You should wash hands after removing PPE.', type: 'True False', options: ['True', 'False'], answer: 'True' }
      ]
    },
    { name: 'WHS/OH&S', code: 'WHS-001', category: 'Mandatory', type: 'Online', duration: 2, passMark: 80, expiry: 24, compliance: '',
      modules: [
        { order: 1, title: 'Workplace Health and Safety', type: 'Text', body: 'Everyone has WHS responsibilities:\n\nEmployer/PCBU duties:\n- Provide safe workplace\n- Provide training and supervision\n- Provide PPE\n- Maintain plant and equipment\n- Monitor health and safety\n\nWorker duties:\n- Take reasonable care for own safety\n- Take reasonable care for others\' safety\n- Follow reasonable instructions\n- Report hazards and incidents\n- Not interfere with safety provisions' },
        { order: 2, title: 'Hazard Identification', type: 'Text', body: 'Hazard categories in disability support:\n\n1. Physical: manual handling, slips/trips/falls\n2. Chemical: cleaning products, medications\n3. Biological: blood/body fluids, infection\n4. Psychosocial: stress, aggression, fatigue\n5. Ergonomic: repetitive tasks, awkward postures\n\nRisk Assessment:\n- Identify hazards\n- Assess the risk (likelihood \u00d7 consequence)\n- Implement controls (hierarchy of controls)\n- Review effectiveness' },
        { order: 3, title: 'Incident Reporting', type: 'Text', body: 'Report ALL incidents, near misses, and hazards:\n\n1. Ensure immediate safety\n2. Provide first aid if needed\n3. Report to supervisor immediately\n4. Complete incident report form\n5. Preserve evidence/scene if serious\n\nNotifiable incidents (to regulator):\n- Death\n- Serious injury/illness\n- Dangerous incident\n\nWorkers compensation:\nReport workplace injuries promptly. Seek medical attention and notify your employer within 24 hours.' }
      ],
      questions: [
        { text: 'Who has WHS responsibilities?', type: 'Multiple Choice', options: ['Only employers', 'Only workers', 'Only safety officers', 'Everyone'], answer: 'Everyone' },
        { text: 'Workers can ignore safety instructions if they are busy.', type: 'True False', options: ['True', 'False'], answer: 'False' },
        { text: 'Which is NOT a hazard category?', type: 'Multiple Choice', options: ['Physical', 'Financial', 'Biological', 'Psychosocial'], answer: 'Financial' },
        { text: 'Near misses should also be reported.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'Risk assessment involves:', type: 'Multiple Choice', options: ['Only identifying hazards', 'Likelihood times consequence', 'Ignoring minor risks', 'Annual reviews only'], answer: 'Likelihood times consequence' },
        { text: 'Notifiable incidents include death.', type: 'True False', options: ['True', 'False'], answer: 'True' },
        { text: 'Workplace injuries should be reported within:', type: 'Multiple Choice', options: ['24 hours', '1 week', '1 month', 'When convenient'], answer: '24 hours' },
        { text: 'Employers must provide PPE when required.', type: 'True False', options: ['True', 'False'], answer: 'True' }
      ]
    },
    { name: 'WWCC/Blue Card Awareness', code: 'WWCC-001', category: 'Mandatory', type: 'External', duration: 1, passMark: 100, expiry: 36, compliance: 'WWCC Expiry',
      modules: [{ order: 1, title: 'Working With Children Check', type: 'Text', body: 'A Working With Children Check (WWCC) / Blue Card is mandatory for all workers who may have contact with children or young people with disability.\n\nRequirements:\n- Must hold a current, valid WWCC/Blue Card\n- Must be renewed before expiry\n- Must notify employer of any changes to status\n- Must notify if charged with a disqualifying offence\n\nEnsure your WWCC/Blue Card is current and uploaded to your staff profile.' }],
      questions: []
    }
  ];
  // Check if courses already seeded
  airtable.rawFetch('Course List', 'GET', '?pageSize=1&filterByFormula=' + encodeURIComponent("{Course Code}='NDIS-ORI-001'")).then(function (check) {
    if (check.records && check.records.length > 0) {
      return res.json({ success: true, message: 'Courses already seeded', seeded: 0 });
    }
    var createPromises = courses.map(function (c) {
      var courseFields = {
        'Course Name': c.name,
        'Course Code': c.code,
        'Category': c.category,
        'Type': c.type,
        'Duration Hours': c.duration,
        'Pass Mark Percentage': c.passMark,
        'Certification Expiry Months': c.expiry,
        'Related Compliance Field': c.compliance,
        'Status': 'Active'
      };
      return airtable.rawFetch('Course List', 'POST', '', { records: [{ fields: courseFields }] }).then(function () {
        // Create modules
        var modPromises = c.modules.map(function (m) {
          return airtable.rawFetch('Course Modules', 'POST', '', {
            records: [{ fields: { 'Course': c.name, 'Module Order': m.order, 'Module Title': m.title, 'Content Type': m.type, 'Content Body': m.body } }]
          });
        });
        // Create questions
        var qPromises = c.questions.map(function (q, idx) {
          return airtable.rawFetch('Assessment Questions', 'POST', '', {
            records: [{ fields: { 'Course': c.name, 'Question Text': q.text, 'Question Type': q.type, 'Options': JSON.stringify(q.options), 'Correct Answer': q.answer, 'Question Order': idx + 1 } }]
          });
        });
        return Promise.all(modPromises.concat(qPromises));
      });
    });
    // Execute sequentially to avoid Airtable rate limits
    var chain = Promise.resolve();
    createPromises.forEach(function (p) {
      chain = chain.then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 500); }); // 500ms delay between courses
      }).then(function () { return p; });
    });
    return chain.then(function () {
      res.json({ success: true, message: 'Courses seeded', seeded: courses.length });
    });
  }).catch(function (err) {
    console.error('Course seed error:', err.message);
    res.status(500).json({ error: err.message });
  });
});

module.exports = router;

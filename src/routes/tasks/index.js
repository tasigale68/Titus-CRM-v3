const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { db } = require('../../db/sqlite');

const router = express.Router();

router.use(authenticate);

// GET /api/tasks
router.get('/', (req, res) => {
  const tasks = db
    .prepare('SELECT * FROM tasks ORDER BY created_at DESC')
    .all();
  res.json({ tasks });
});

// POST /api/tasks
router.post('/', (req, res) => {
  const { title, description, assigned_to, project_id, priority, due_date } = req.body;
  const result = db
    .prepare(
      'INSERT INTO tasks (title, description, assigned_to, project_id, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(title, description, assigned_to, project_id, priority || 'medium', due_date);
  res.json({ task: { id: result.lastInsertRowid, ...req.body } });
});

// PATCH /api/tasks/:id
router.patch('/:id', (req, res) => {
  const { status, assigned_to } = req.body;
  if (status) {
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  if (assigned_to) {
    db.prepare('UPDATE tasks SET assigned_to = ? WHERE id = ?').run(assigned_to, req.params.id);
  }
  res.json({ ok: true });
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;

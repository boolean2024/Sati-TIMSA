const express = require('express');
const { z } = require('zod');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const noteSchema = z.object({
  text: z.string().trim().min(1).max(260),
  due_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/))
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT n.id, n.text, n.due_at, n.created_at,
              u.name AS user_name
       FROM notes n
       JOIN users u ON u.id = n.user_id
       WHERE n.user_id = $1
       ORDER BY n.due_at ASC, n.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ notes: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = noteSchema.parse(req.body);
    const { rows } = await db.query(
      `INSERT INTO notes (user_id, text, due_at)
       VALUES ($1, $2, $3)
       RETURNING id, text, due_at, created_at`,
      [req.user.id, data.text, data.due_at]
    );
    const note = {
      ...rows[0],
      user_name: req.user.name
    };
    res.status(201).json({ note });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de nota invalidos.' });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Nota no encontrada.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;

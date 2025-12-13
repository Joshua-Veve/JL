const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

router.post('/', authenticate, async (req, res) => {
  const { bookId, book_id } = req.body;
  const bookIdToUse = bookId || book_id;
  const user_id = req.user.id;

  try {
    const bookResult = await pool.query('SELECT * FROM books WHERE id = $1', [bookIdToUse]);
    if (bookResult.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    if (!bookResult.rows[0].available) return res.status(400).json({ error: 'Book not available' });

    const borrowCheck = await pool.query(
      'SELECT * FROM borrowed_books WHERE user_id = $1 AND book_id = $2 AND returned = FALSE',
      [user_id, bookIdToUse]
    );
    if (borrowCheck.rows.length > 0) return res.status(400).json({ error: 'Book already borrowed' });

    const due_date = new Date();
    due_date.setDate(due_date.getDate() + 14);
    const result = await pool.query(
      'INSERT INTO borrowed_books (user_id, book_id, due_date) VALUES ($1, $2, $3) RETURNING *',
      [user_id, bookIdToUse, due_date]
    );

    await pool.query('UPDATE books SET available = FALSE WHERE id = $1', [bookIdToUse]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put('/:id/return', authenticate, async (req, res) => {
  const borrow_id = req.params.id;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      'UPDATE borrowed_books SET returned = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [borrow_id, user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Borrow record not found' });

    await pool.query('UPDATE books SET available = TRUE WHERE id = $1', [result.rows[0].book_id]);

    res.json({ message: 'Book returned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', authenticate, async (req, res) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT bb.*, b.title, b.author, b.isbn FROM borrowed_books bb
       JOIN books b ON bb.book_id = b.id
       WHERE bb.user_id = $1`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  try {
    const result = await pool.query(
      `SELECT bb.*, u.full_name, b.title, b.author FROM borrowed_books bb
       JOIN users u ON bb.user_id = u.id
       JOIN books b ON bb.book_id = b.id`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/due-soon', authenticate, async (req, res) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT bb.*, b.title, b.author, b.isbn FROM borrowed_books bb
       JOIN books b ON bb.book_id = b.id
       WHERE bb.user_id = $1 AND bb.returned = FALSE AND bb.due_date <= CURRENT_DATE + INTERVAL '7 days'`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

// Middleware to verify token
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

// Borrow a book
router.post('/', authenticate, async (req, res) => {
  const { book_id } = req.body;
  const user_id = req.user.id;

  try {
    // Check if book is available
    const bookResult = await pool.query('SELECT * FROM books WHERE id = $1', [book_id]);
    if (bookResult.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    if (!bookResult.rows[0].available) return res.status(400).json({ error: 'Book not available' });

    // Check if user already borrowed this book and not returned
    const borrowCheck = await pool.query(
      'SELECT * FROM borrowed_books WHERE user_id = $1 AND book_id = $2 AND returned = FALSE',
      [user_id, book_id]
    );
    if (borrowCheck.rows.length > 0) return res.status(400).json({ error: 'Book already borrowed' });

    // Borrow the book
    const due_date = new Date();
    due_date.setDate(due_date.getDate() + 14); // 14 days due
    const result = await pool.query(
      'INSERT INTO borrowed_books (user_id, book_id, due_date) VALUES ($1, $2, $3) RETURNING *',
      [user_id, book_id, due_date]
    );

    // Update book availability
    await pool.query('UPDATE books SET available = FALSE WHERE id = $1', [book_id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Return a book
router.put('/:id/return', authenticate, async (req, res) => {
  const borrow_id = req.params.id;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      'UPDATE borrowed_books SET returned = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [borrow_id, user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Borrow record not found' });

    // Update book availability
    await pool.query('UPDATE books SET available = TRUE WHERE id = $1', [result.rows[0].book_id]);

    res.json({ message: 'Book returned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's borrowed books
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

// Get all borrowed books (admin only)
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

module.exports = router;
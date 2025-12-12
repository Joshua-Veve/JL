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

// Get all books
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search and filter books
router.get('/search', async (req, res) => {
  const { title, author, category } = req.query;
  let query = 'SELECT * FROM books WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (title) {
    query += ` AND title ILIKE $${paramIndex}`;
    params.push(`%${title}%`);
    paramIndex++;
  }
  if (author) {
    query += ` AND author ILIKE $${paramIndex}`;
    params.push(`%${author}%`);
    paramIndex++;
  }
  if (category) {
    query += ` AND category ILIKE $${paramIndex}`;
    params.push(`%${category}%`);
    paramIndex++;
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add book (admin only)
router.post('/', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { title, author, isbn, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO books (title, author, isbn, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, author, isbn, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update book (admin only)
router.put('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { title, author, isbn, category, available } = req.body;
  try {
    const result = await pool.query(
      'UPDATE books SET title = $1, author = $2, isbn = $3, category = $4, available = $5 WHERE id = $6 RETURNING *',
      [title, author, isbn, category, available, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete book (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  try {
    const result = await pool.query('DELETE FROM books WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
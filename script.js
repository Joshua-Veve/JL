const API_BASE = 'https://jl-cezp.onrender.com';

let currentUser = null;
let token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
  if (location.protocol === 'file:') {
    const warning = document.getElementById('file-warning');
    if (warning) {
      warning.style.display = 'block';
    }
  }
  
  if (token) {
    try {
      currentUser = JSON.parse(localStorage.getItem('user'));
      showDashboard();
    } catch (error) {
      console.error('Error parsing user data:', error);
      logout();
    }
  }
  
  setupEventListeners();
});

function setupEventListeners() {
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const form = e.target.closest('form');
        if (form) {
          form.querySelector('button[type="submit"]')?.click();
        }
      }
    });
  });
}

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[onclick="showTab('${tab}')"]`).classList.add('active');
  
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  
  clearMessage();
  
  if (tab === 'login') {
    document.getElementById('login').reset();
  } else if (tab === 'register') {
    document.getElementById('register').reset();
  }
}

function showDashboard() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('message').innerHTML = '';
  
  if (currentUser.role === 'admin') {
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('student-dashboard').style.display = 'none';
    loadAdminBooks();
    loadAdminBorrowed();
  } else {
    document.getElementById('student-dashboard').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
    searchBooks();
    loadBorrowedBooks();
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  token = null;
  
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('student-dashboard').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'none';
  
  document.getElementById('login').reset();
  document.getElementById('register').reset();
  
  showTab('login');
  showMessage('Logged out successfully', 'success');
}

document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button');
  const originalText = button.textContent;
  setLoading(button, true);
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showDashboard();
      showMessage('Login successful!', 'success');
    } else {
      showMessage(data.error || 'Login failed. Please check your credentials.', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
    showMessage('Connection failed. Please check your internet connection.', 'error');
  } finally {
    setLoading(button, false, originalText);
  }
});

// Register handler
document.getElementById('register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button');
  const originalText = button.textContent;
  setLoading(button, true);
  
  const full_name = document.getElementById('reg-fullname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  
  if (password.length < 6) {
    showMessage('Password must be at least 6 characters long', 'error');
    setLoading(button, false, originalText);
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showMessage('Registration successful! Please login with your credentials.', 'success');
      showTab('login');
      document.getElementById('register').reset();
    } else {
      showMessage(data.error || 'Registration failed. Please try again.', 'error');
    }
  } catch (err) {
    console.error('Registration error:', err);
    showMessage('Connection failed. Please check your internet connection.', 'error');
  } finally {
    setLoading(button, false, originalText);
  }
});

async function searchBooks() {
  const title = document.getElementById('search-title').value.trim();
  const author = document.getElementById('search-author').value.trim();
  const category = document.getElementById('search-category').value;
  
  const params = new URLSearchParams();
  if (title) params.append('title', title);
  if (author) params.append('author', author);
  if (category) params.append('category', category);
  
  try {
    const response = await fetch(`${API_BASE}/api/books/search?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch books');
    
    const books = await response.json();
    displayBooks(books);
  } catch (err) {
    console.error('Search error:', err);
    showMessage('Error fetching books. Please try again.', 'error');
  }
}

function displayBooks(books) {
  const list = document.getElementById('book-list');
  list.innerHTML = '';
  
  if (books.length === 0) {
    list.innerHTML = '<li class="book-item"><em>No books found matching your criteria.</em></li>';
    return;
  }
  
  books.forEach(book => {
    const li = document.createElement('li');
    li.className = 'book-item';
    li.innerHTML = `
      <strong>${book.title}</strong>
      <div class="author">by ${book.author}</div>
      <div class="meta">
        ISBN: ${book.isbn} | Category: ${book.category} | Available: ${book.available ? 'Yes' : 'No'}
      </div>
      <div class="book-actions">
        ${book.available ? 
          `<button class="borrow-btn" onclick="borrowBook(${book.id})">Borrow</button>` : 
          '<button class="borrow-btn" disabled>Not Available</button>'
        }
      </div>
    `;
    list.appendChild(li);
  });
}

async function borrowBook(bookId) {
  if (!confirm('Are you sure you want to borrow this book?')) return;
  
  const button = event?.target;
  if (button) {
    button.disabled = true;
    button.textContent = 'Processing...';
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/borrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ book_id: bookId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showMessage('Book borrowed successfully!', 'success');
      loadBorrowedBooks();
      searchBooks();
    } else {
      showMessage(data.error || 'Failed to borrow book', 'error');
      if (button) {
        button.disabled = false;
        button.textContent = 'Borrow';
      }
    }
  } catch (err) {
    console.error('Borrow error:', err);
    showMessage('Error borrowing book. Please try again.', 'error');
    if (button) {
      button.disabled = false;
      button.textContent = 'Borrow';
    }
  }
}

async function loadBorrowedBooks() {
  try {
    const response = await fetch(`${API_BASE}/api/borrow/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load borrowed books');
    
    const borrowed = await response.json();
    const list = document.getElementById('borrowed-list');
    list.innerHTML = '';
    
    if (borrowed.length === 0) {
      list.innerHTML = '<li class="book-item"><em>You haven\'t borrowed any books yet.</em></li>';
      return;
    }
    
    borrowed.forEach(item => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.innerHTML = `
        <strong>${item.title}</strong>
        <div class="author">by ${item.author}</div>
        <div class="meta">
          Borrowed: ${formatDate(item.borrowed_date)} | 
          Due: ${formatDate(item.due_date)} | 
          Status: ${item.returned ? 'Returned' : 'Active'}
        </div>
        ${!item.returned ? 
          `<div class="book-actions">
            <button class="borrow-btn" onclick="returnBook(${item.id})">Return</button>
          </div>` : ''
        }
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Load borrowed error:', err);
    showMessage('Error loading borrowed books', 'error');
  }
}

async function returnBook(borrowId) {
  if (!confirm('Are you sure you want to return this book?')) return;
  
  const button = event?.target;
  if (button) {
    button.disabled = true;
    button.textContent = 'Processing...';
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/borrow/${borrowId}/return`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showMessage('Book returned successfully!', 'success');
      loadBorrowedBooks();
      searchBooks();
    } else {
      showMessage(data.error || 'Failed to return book', 'error');
      if (button) {
        button.disabled = false;
        button.textContent = 'Return';
      }
    }
  } catch (err) {
    console.error('Return error:', err);
    showMessage('Error returning book', 'error');
    if (button) {
      button.disabled = false;
      button.textContent = 'Return';
    }
  }
}

document.getElementById('add-book').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button');
  const originalText = button.textContent;
  setLoading(button, true);
  
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const isbn = document.getElementById('book-isbn').value.trim();
  const category = document.getElementById('book-category').value.trim();
  
  try {
    const response = await fetch(`${API_BASE}/api/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, author, isbn, category })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showMessage('Book added successfully!', 'success');
      document.getElementById('add-book').reset();
      loadAdminBooks();
    } else {
      showMessage(data.error || 'Failed to add book', 'error');
    }
  } catch (err) {
    console.error('Add book error:', err);
    showMessage('Error adding book', 'error');
  } finally {
    setLoading(button, false, originalText);
  }
});

async function loadAdminBooks() {
  try {
    const response = await fetch(`${API_BASE}/api/books`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load books');
    
    const books = await response.json();
    const list = document.getElementById('admin-book-list');
    list.innerHTML = '';
    
    books.forEach(book => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.innerHTML = `
        <strong>${book.title}</strong>
        <div class="author">by ${book.author}</div>
        <div class="meta">
          ISBN: ${book.isbn} | Category: ${book.category} | Available: ${book.available ? 'Yes' : 'No'}
        </div>
        <div class="book-actions">
          <button class="borrow-btn" onclick="editBook(${book.id})">Edit</button>
          <button class="borrow-btn" onclick="deleteBook(${book.id})">Delete</button>
        </div>
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Load admin books error:', err);
    showMessage('Error loading books', 'error');
  }
}

async function deleteBook(bookId) {
  if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/books/${bookId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      showMessage('Book deleted successfully', 'success');
      loadAdminBooks();
    } else {
      const data = await response.json();
      showMessage(data.error || 'Failed to delete book', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showMessage('Error deleting book', 'error');
  }
}

function editBook(bookId) {
  const title = prompt('Enter new title:');
  if (title === null) return;
  
  const author = prompt('Enter new author:');
  if (author === null) return;
  
  const isbn = prompt('Enter new ISBN:');
  if (isbn === null) return;
  
  const category = prompt('Enter new category:');
  if (category === null) return;
  
  const available = confirm('Is the book available?');
  
  if (title && author && isbn && category) {
    updateBook(bookId, { title, author, isbn, category, available });
  } else {
    showMessage('All fields are required for editing', 'error');
  }
}

async function updateBook(bookId, bookData) {
  try {
    const response = await fetch(`${API_BASE}/api/books/${bookId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(bookData)
    });
    
    if (response.ok) {
      showMessage('Book updated successfully', 'success');
      loadAdminBooks();
    } else {
      const data = await response.json();
      showMessage(data.error || 'Failed to update book', 'error');
    }
  } catch (err) {
    console.error('Update error:', err);
    showMessage('Error updating book', 'error');
  }
}

async function loadAdminBorrowed() {
  try {
    const response = await fetch(`${API_BASE}/api/borrow`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load borrowed records');
    
    const borrowed = await response.json();
    const list = document.getElementById('admin-borrowed-list');
    list.innerHTML = '';
    
    borrowed.forEach(item => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.innerHTML = `
        <strong>${item.title}</strong>
        <div class="author">by ${item.author}</div>
        <div class="meta">
          Borrower: ${item.full_name} | 
          Borrowed: ${formatDate(item.borrowed_date)} | 
          Due: ${formatDate(item.due_date)} | 
          Status: ${item.returned ? 'Returned' : 'Active'}
        </div>
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Load admin borrowed error:', err);
    showMessage('Error loading borrowed books', 'error');
  }
}

function showMessage(msg, type = 'info') {
  clearMessage();
  const messageDiv = document.getElementById('message');
  messageDiv.innerHTML = `<div class="message ${type}">${msg}</div>`;
  
  if (type === 'success') {
    setTimeout(clearMessage, 5000);
  }
}

function clearMessage() {
  const messageDiv = document.getElementById('message');
  messageDiv.innerHTML = '';
}

function setLoading(button, loading, originalText = null) {
  if (loading) {
    button.disabled = true;
    button.innerHTML = '<div class="loading"></div> Loading...';
    button.dataset.originalText = originalText || button.textContent;
  } else {
    button.disabled = false;
    button.textContent = originalText || button.dataset.originalText || 'Submit';
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
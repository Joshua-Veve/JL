const API_BASE = 'https://jl-cezp.onrender.com';

let currentUser = null;
let token = localStorage.getItem('token');

if (token) {
  currentUser = JSON.parse(localStorage.getItem('user'));
  showDashboard();
}

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[onclick="showTab('${tab}')"]`).classList.add('active');
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('message').innerHTML = '';
}

function showDashboard() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('main-header').style.display = 'block';
  if (currentUser.role === 'admin') {
    document.getElementById('admin-panel').style.display = 'block';
    loadAdminBooks();
    loadAdminBorrowed();
  } else {
    document.getElementById('student-dashboard').style.display = 'block';
    updateDashboardStats();
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
  document.getElementById('main-header').style.display = 'none';
  document.getElementById('student-dashboard').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'none';
}

document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button');
  button.dataset.originalText = button.innerHTML;
  setLoading(button, true);

  const email = document.getElementById('login-email').value;
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
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Connection failed. Please check your internet connection.', 'error');
  } finally {
    setLoading(button, false);
  }
});

document.getElementById('register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button');
  button.dataset.originalText = button.innerHTML;
  setLoading(button, true);

  const full_name = document.getElementById('reg-fullname').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, password })
    });
    const data = await response.json();
    if (response.ok) {
      showMessage('Registration successful! Please login.', 'success');
      showTab('login');
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Connection failed. Please check your internet connection.', 'error');
  } finally {
    setLoading(button, false);
  }
});

// Student functions
async function searchBooks() {
  const title = document.getElementById('search-title').value;
  const author = document.getElementById('search-author').value;
  const category = document.getElementById('search-category').value;

  const params = new URLSearchParams();
  if (title) params.append('title', title);
  if (author) params.append('author', author);
  if (category) params.append('category', category);

  try {
    const response = await fetch(`${API_BASE}/api/books/search?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const books = await response.json();
    displayBooks(books);
  } catch (err) {
    showMessage('Error fetching books', 'error');
  }
}

function displayBooks(books) {
  const container = document.getElementById('book-list');
  container.innerHTML = '';
  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <h4>${book.title}</h4>
      <p><strong>Author:</strong> ${book.author}</p>
      <p><strong>ISBN:</strong> ${book.isbn}</p>
      <p><strong>Category:</strong> ${book.category}</p>
      <p><strong>Available:</strong> ${book.available ? 'Yes' : 'No'}</p>
      ${book.available ? `<button class="borrow-btn" onclick="borrowBook(${book.id})">Borrow Book</button>` : '<span style="color: #ff6b6b;">Currently Unavailable</span>'}
    `;
    container.appendChild(card);
  });
}

async function borrowBook(bookId) {
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
      showMessage('Book borrowed successfully', 'success');
      loadBorrowedBooks();
      searchBooks();
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Error borrowing book', 'error');
  }
}

async function loadBorrowedBooks() {
  try {
    const response = await fetch(`${API_BASE}/api/borrow/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const borrowed = await response.json();
    const container = document.getElementById('borrowed-list');
    container.innerHTML = '';
    borrowed.forEach(item => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <h4>${item.title}</h4>
        <p><strong>Author:</strong> ${item.author}</p>
        <p><strong>Borrowed Date:</strong> ${new Date(item.borrowed_date).toLocaleDateString()}</p>
        <p><strong>Due Date:</strong> ${new Date(item.due_date).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${item.returned ? '<span style="color: #4caf50;">Returned</span>' : '<span style="color: #ff6b6b;">Borrowed</span>'}</p>
        ${!item.returned ? `<button class="borrow-btn" onclick="returnBook(${item.id})">Return Book</button>` : ''}
      `;
      container.appendChild(card);
    });
  } catch (err) {
    showMessage('Error loading borrowed books', 'error');
  }
}

async function returnBook(borrowId) {
  try {
    const response = await fetch(`${API_BASE}/api/borrow/${borrowId}/return`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (response.ok) {
      showMessage('Book returned successfully', 'success');
      loadBorrowedBooks();
      searchBooks();
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Error returning book', 'error');
  }
}

// Admin functions
document.getElementById('add-book').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('book-title').value;
  const author = document.getElementById('book-author').value;
  const isbn = document.getElementById('book-isbn').value;
  const category = document.getElementById('book-category').value;

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
      showMessage('Book added successfully', 'success');
      loadAdminBooks();
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Error adding book', 'error');
  }
});

async function loadAdminBooks() {
  try {
    const response = await fetch(`${API_BASE}/api/books`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const books = await response.json();
    const container = document.getElementById('admin-book-list');
    container.innerHTML = '';
    books.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <h4>${book.title}</h4>
        <p><strong>Author:</strong> ${book.author}</p>
        <p><strong>ISBN:</strong> ${book.isbn}</p>
        <p><strong>Category:</strong> ${book.category}</p>
        <p><strong>Available:</strong> ${book.available ? 'Yes' : 'No'}</p>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button class="borrow-btn" onclick="editBook(${book.id})" style="flex: 1;">Edit</button>
          <button class="borrow-btn" onclick="deleteBook(${book.id})" style="flex: 1; background: #dc3545;">Delete</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    showMessage('Error loading books', 'error');
  }
}

async function deleteBook(bookId) {
  if (!confirm('Are you sure you want to delete this book?')) return;
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
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Error deleting book', 'error');
  }
}

function editBook(bookId) {
  const title = prompt('New title:');
  const author = prompt('New author:');
  const isbn = prompt('New ISBN:');
  const category = prompt('New category:');
  const available = confirm('Available?');

  if (title && author && isbn && category) {
    updateBook(bookId, { title, author, isbn, category, available });
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
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Error updating book', 'error');
  }
}

async function loadAdminBorrowed() {
  try {
    const response = await fetch(`${API_BASE}/api/borrow`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const borrowed = await response.json();
    const container = document.getElementById('admin-borrowed-list');
    container.innerHTML = '';
    borrowed.forEach(item => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <h4>${item.title}</h4>
        <p><strong>Author:</strong> ${item.author}</p>
        <p><strong>Borrower:</strong> ${item.full_name}</p>
        <p><strong>Borrowed Date:</strong> ${new Date(item.borrowed_date).toLocaleDateString()}</p>
        <p><strong>Due Date:</strong> ${new Date(item.due_date).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${item.returned ? '<span style="color: #4caf50;">Returned</span>' : '<span style="color: #ff6b6b;">Borrowed</span>'}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    showMessage('Error loading borrowed books', 'error');
  }
}

function showMessage(msg, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.innerHTML = `<div class="message ${type}">${msg}</div>`;
  setTimeout(() => messageDiv.innerHTML = '', 5000);
}

function setLoading(button, loading) {
  button.disabled = loading;
  if (loading) {
    button.innerHTML = '<div class="loading"></div>Loading...';
  } else {
    button.innerHTML = button.dataset.originalText || 'Submit';
  }
}

// Dashboard stats function
async function updateDashboardStats() {
  try {
    const response = await fetch(`${API_BASE}/api/borrow/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const borrowed = await response.json();
    
    const borrowedCount = borrowed.filter(item => !item.returned).length;
    const dueSoonCount = borrowed.filter(item => {
      if (item.returned) return false;
      const dueDate = new Date(item.due_date);
      const now = new Date();
      const diffTime = dueDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0;
    }).length;
    
    document.getElementById('borrowed-count').textContent = borrowedCount;
    document.getElementById('due-count').textContent = dueSoonCount;
  } catch (err) {
    console.error('Error updating dashboard stats:', err);
  }
}

// Admin tab functions
function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[onclick="showAdminTab('${tab}')"]`).classList.add('active');
  
  document.getElementById('manage-books-tab').style.display = tab === 'manage-books' ? 'block' : 'none';
  document.getElementById('borrowing-records-tab').style.display = tab === 'borrowing-records' ? 'block' : 'none';
}

function showAddBookForm() {
  const formSection = document.getElementById('add-book-form-section');
  formSection.style.display = formSection.style.display === 'none' ? 'block' : 'none';
}
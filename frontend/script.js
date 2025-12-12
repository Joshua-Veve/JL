const API_BASE = 'https://your-render-backend-url'; // Replace with actual Render URL

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
  if (currentUser.role === 'admin') {
    document.getElementById('admin-panel').style.display = 'block';
    loadAdminBooks();
    loadAdminBorrowed();
  } else {
    document.getElementById('student-dashboard').style.display = 'block';
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
}

document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();
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
    showMessage('An error occurred', 'error');
  }
});

document.getElementById('register').addEventListener('submit', async (e) => {
  e.preventDefault();
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
    showMessage('An error occurred', 'error');
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
  const list = document.getElementById('book-list');
  list.innerHTML = '';
  books.forEach(book => {
    const li = document.createElement('li');
    li.className = 'book-item';
    li.innerHTML = `
      <strong>${book.title}</strong> by ${book.author}<br>
      ISBN: ${book.isbn} | Category: ${book.category} | Available: ${book.available ? 'Yes' : 'No'}
      ${book.available ? `<button class="borrow-btn" onclick="borrowBook(${book.id})">Borrow</button>` : ''}
    `;
    list.appendChild(li);
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
    const list = document.getElementById('borrowed-list');
    list.innerHTML = '';
    borrowed.forEach(item => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.innerHTML = `
        <strong>${item.title}</strong> by ${item.author}<br>
        Borrowed: ${new Date(item.borrowed_date).toLocaleDateString()} | Due: ${new Date(item.due_date).toLocaleDateString()} | Returned: ${item.returned ? 'Yes' : 'No'}
        ${!item.returned ? `<button class="borrow-btn" onclick="returnBook(${item.id})">Return</button>` : ''}
      `;
      list.appendChild(li);
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
    const list = document.getElementById('admin-book-list');
    list.innerHTML = '';
    books.forEach(book => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.innerHTML = `
        <strong>${book.title}</strong> by ${book.author}<br>
        ISBN: ${book.isbn} | Category: ${book.category} | Available: ${book.available ? 'Yes' : 'No'}
        <button class="borrow-btn" onclick="editBook(${book.id})">Edit</button>
        <button class="borrow-btn" onclick="deleteBook(${book.id})">Delete</button>
      `;
      list.appendChild(li);
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
    const list = document.getElementById('admin-borrowed-list');
    list.innerHTML = '';
    borrowed.forEach(item => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.innerHTML = `
        <strong>${item.title}</strong> by ${item.author}<br>
        Borrower: ${item.full_name} | Borrowed: ${new Date(item.borrowed_date).toLocaleDateString()} | Due: ${new Date(item.due_date).toLocaleDateString()} | Returned: ${item.returned ? 'Yes' : 'No'}
      `;
      list.appendChild(li);
    });
  } catch (err) {
    showMessage('Error loading borrowed books', 'error');
  }
}

function showMessage(msg, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.innerHTML = `<div class="${type}">${msg}</div>`;
  setTimeout(() => messageDiv.innerHTML = '', 3000);
}
const API_BASE = 'https://jl-cezp.onrender.com';

// Application state
let currentUser = null;
let token = localStorage.getItem('token');
let borrowedBooks = [];
let allBooks = [];

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  attachEventListeners();
  
  // Check for token on load
  if (token) {
    verifyToken();
  }
});

function initializeApp() {
  // Initialize password toggles
  document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const input = this.parentElement.querySelector('input');
      const icon = this.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
        this.setAttribute('aria-label', 'Hide password');
      } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
        this.setAttribute('aria-label', 'Show password');
      }
    });
  });
}

function attachEventListeners() {
  // Auth forms
  document.getElementById('login-form-content').addEventListener('submit', handleLogin);
  document.getElementById('register-form-content').addEventListener('submit', handleRegister);
  document.getElementById('add-book').addEventListener('submit', handleAddBook);
  
  // Search functionality
  document.getElementById('search-title-input').addEventListener('input', debounce(searchBooks, 300));
  document.getElementById('search-author').addEventListener('input', debounce(searchBooks, 300));
  document.getElementById('search-category').addEventListener('change', searchBooks);
  
  // Clear search button
  document.querySelector('.btn-secondary[onclick="clearSearch()"]')?.addEventListener('click', clearSearch);
}

// Token verification
async function verifyToken() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      currentUser = JSON.parse(localStorage.getItem('user'));
      showDashboard();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Token verification failed:', error);
    // Keep user logged in but show warning
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (currentUser) {
      showDashboard();
      showToast('Connected offline - some features may be limited', 'warning');
    }
  }
}

// Tab Management
function showTab(tab) {
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginForm = document.getElementById('login-form-content');
  const registerForm = document.getElementById('register-form-content');
  
  if (tab === 'login') {
    loginTab.classList.add('active');
    loginTab.setAttribute('aria-selected', 'true');
    registerTab.classList.remove('active');
    registerTab.setAttribute('aria-selected', 'false');
    loginForm.style.display = 'block';
    loginForm.setAttribute('aria-hidden', 'false');
    registerForm.style.display = 'none';
    registerForm.setAttribute('aria-hidden', 'true');
  } else {
    registerTab.classList.add('active');
    registerTab.setAttribute('aria-selected', 'true');
    loginTab.classList.remove('active');
    loginTab.setAttribute('aria-selected', 'false');
    registerForm.style.display = 'block';
    registerForm.setAttribute('aria-hidden', 'false');
    loginForm.style.display = 'none';
    loginForm.setAttribute('aria-hidden', 'true');
  }
  
  clearMessages();
}

function showAdminTab(tab) {
  const tabs = ['manage-books', 'borrowing-records', 'users'];
  const tabButtons = document.querySelectorAll('.admin-tab');
  
  tabButtons.forEach((btn, index) => {
    const isActive = tabs[index] === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  
  tabs.forEach(tabName => {
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
      const isVisible = tabName === tab;
      tabContent.style.display = isVisible ? 'block' : 'none';
      tabContent.setAttribute('aria-hidden', !isVisible);
    }
  });
  
  if (tab === 'manage-books') {
    loadAdminBooks();
  } else if (tab === 'borrowing-records') {
    loadAdminBorrowed();
  } else if (tab === 'users') {
    loadUsers();
  }
}

// Authentication Handlers
async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector('button[type="submit"]');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!validateEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }
  
  setLoading(button, true);
  
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
      localStorage.setItem('lastLogin', new Date().toISOString());
      showToast('Login successful!', 'success');
      showDashboard();
    } else {
      showToast(data.error || 'Invalid credentials', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Connection failed. Please try again.', 'error');
  } finally {
    setLoading(button, false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector('button[type="submit"]');
  const full_name = document.getElementById('reg-fullname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  
  // Validation
  if (full_name.length < 2) {
    showToast('Please enter your full name', 'error');
    return;
  }
  
  if (!validateEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  if (!validatePassword(password)) {
    showToast('Password must be at least 8 characters with letters and numbers', 'error');
    return;
  }
  
  setLoading(button, true);
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Registration successful! Please login.', 'success');
      showTab('login');
      form.reset();
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showToast('Connection failed. Please try again.', 'error');
  } finally {
    setLoading(button, false);
  }
}

// Dashboard Management
function showDashboard() {
  // Hide all sections first
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('student-dashboard').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'none';
  
  // Show header
  const header = document.getElementById('main-header');
  header.style.display = 'block';
  header.setAttribute('aria-hidden', 'false');
  
  // Update user greeting
  const userGreeting = document.getElementById('current-user');
  const studentName = document.getElementById('student-name');
  if (currentUser) {
    userGreeting.textContent = `Welcome, ${currentUser.full_name}`;
    if (studentName) studentName.textContent = currentUser.full_name;
    
    // Show last login
    const lastLogin = document.getElementById('last-login');
    const lastLoginTime = localStorage.getItem('lastLogin');
    if (lastLogin && lastLoginTime) {
      const timeAgo = getTimeAgo(new Date(lastLoginTime));
      lastLogin.textContent = `Last login: ${timeAgo}`;
    }
  }
  
  // Show appropriate dashboard
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
  
  // Focus on first element for accessibility
  setTimeout(() => {
    if (currentUser.role === 'admin') {
      document.querySelector('.admin-tab.active')?.focus();
    } else {
      document.querySelector('.search-form input')?.focus();
    }
  }, 100);
}

// Book Management
async function searchBooks() {
  const title = document.getElementById('search-title-input')?.value.trim();
  const author = document.getElementById('search-author')?.value.trim();
  const category = document.getElementById('search-category')?.value;
  
  showLoading(true);
  
  try {
    const params = new URLSearchParams();
    if (title) params.append('title', title);
    if (author) params.append('author', author);
    if (category) params.append('category', category);
    
    const response = await fetch(`${API_BASE}/api/books/search?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      allBooks = await response.json();
      displayBooks(allBooks);
      updateBookCount(allBooks.length);
    } else {
      throw new Error('Failed to fetch books');
    }
  } catch (error) {
    console.error('Search error:', error);
    showToast('Error fetching books. Please try again.', 'error');
    displayBooks([]);
  } finally {
    showLoading(false);
  }
}

function displayBooks(books) {
  const container = document.getElementById('book-list');
  if (!container) return;
  
  if (books.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <h4>No books found</h4>
        <p>Try adjusting your search filters</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = books.map(book => `
    <div class="book-card" role="article" aria-label="${book.title} by ${book.author}">
      <div class="book-header">
        <h4 class="book-title">${book.title}</h4>
        <span class="book-status ${book.available ? 'available' : 'unavailable'}">
          ${book.available ? 'Available' : 'Checked Out'}
        </span>
      </div>
      <div class="book-details">
        <p class="book-author">
          <i class="fas fa-user-pen"></i> ${book.author}
        </p>
        <p class="book-isbn">
          <i class="fas fa-barcode"></i> ${book.isbn}
        </p>
        <p class="book-category">
          <i class="fas fa-tag"></i> ${book.category}
        </p>
        ${book.location ? `
          <p class="book-location">
            <i class="fas fa-map-marker-alt"></i> ${book.location}
          </p>
        ` : ''}
        <p class="book-copies">
          <i class="fas fa-copy"></i> Copies: ${book.copies || 1}
        </p>
      </div>
      <div class="book-actions">
        ${book.available ? `
          <button class="btn-primary" onclick="borrowBook(${book.id})" 
                  aria-label="Borrow ${book.title}">
            <i class="fas fa-bookmark"></i> Borrow Book
          </button>
        ` : `
          <button class="btn-secondary" disabled 
                  aria-label="Book unavailable - ${book.title}">
            <i class="fas fa-clock"></i> Unavailable
          </button>
        `}
      </div>
    </div>
  `).join('');
}

// Borrowing Management
async function borrowBook(bookId) {
  if (!confirm('Are you sure you want to borrow this book?')) return;
  
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
      showToast('Book borrowed successfully!', 'success');
      loadBorrowedBooks();
      searchBooks();
      updateDashboardStats();
    } else {
      showToast(data.error || 'Failed to borrow book', 'error');
    }
  } catch (error) {
    console.error('Borrow error:', error);
    showToast('Error borrowing book. Please try again.', 'error');
  }
}

async function loadBorrowedBooks() {
  try {
    const response = await fetch(`${API_BASE}/api/borrow/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      borrowedBooks = await response.json();
      displayBorrowedBooks(borrowedBooks);
      updateDashboardStats();
    } else {
      throw new Error('Failed to load borrowed books');
    }
  } catch (error) {
    console.error('Load borrowed error:', error);
    showToast('Error loading borrowed books', 'error');
  }
}

function displayBorrowedBooks(borrowed) {
  const container = document.getElementById('borrowed-list');
  if (!container) return;
  
  if (borrowed.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book"></i>
        <h4>No borrowed books</h4>
        <p>Browse the available books to borrow one</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = borrowed.map(item => {
    const dueDate = new Date(item.due_date);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDue < 0;
    const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
    
    return `
      <div class="book-card ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}" 
           role="article" aria-label="${item.title} - Due ${dueDate.toLocaleDateString()}">
        <div class="book-header">
          <h4 class="book-title">${item.title}</h4>
          <span class="borrow-status ${item.returned ? 'returned' : isOverdue ? 'overdue' : 'borrowed'}">
            ${item.returned ? 'Returned' : isOverdue ? 'Overdue' : 'Borrowed'}
          </span>
        </div>
        <div class="book-details">
          <p class="book-author">
            <i class="fas fa-user-pen"></i> ${item.author}
          </p>
          <p class="borrow-date">
            <i class="fas fa-calendar-check"></i> Borrowed: ${new Date(item.borrowed_date).toLocaleDateString()}
          </p>
          <p class="due-date ${isOverdue ? 'overdue' : ''}">
            <i class="fas fa-calendar-times"></i> Due: ${dueDate.toLocaleDateString()}
            ${isOverdue ? ` (${Math.abs(daysUntilDue)} days overdue)` : 
              isDueSoon ? ` (${daysUntilDue} days left)` : ''}
          </p>
        </div>
        <div class="book-actions">
          ${!item.returned ? `
            <button class="btn-success" onclick="returnBook(${item.id})" 
                    aria-label="Return ${item.title}">
              <i class="fas fa-book-arrow-up"></i> Return Book
            </button>
          ` : ''}
          <button class="btn-secondary" onclick="viewBookDetails(${item.book_id})"
                  aria-label="View details for ${item.title}">
            <i class="fas fa-info-circle"></i> Details
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function returnBook(borrowId) {
  if (!confirm('Are you sure you want to return this book?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/borrow/${borrowId}/return`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      showToast('Book returned successfully!', 'success');
      loadBorrowedBooks();
      searchBooks();
      updateDashboardStats();
    } else {
      const data = await response.json();
      showToast(data.error || 'Failed to return book', 'error');
    }
  } catch (error) {
    console.error('Return error:', error);
    showToast('Error returning book', 'error');
  }
}

// Admin Functions
async function handleAddBook(e) {
  e.preventDefault();
  
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const isbn = document.getElementById('book-isbn').value.trim();
  const category = document.getElementById('book-category').value;
  const copies = document.getElementById('book-copies').value || 1;
  const location = document.getElementById('book-location').value.trim();
  
  // Validation
  if (!title || !author || !isbn || !category) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  const button = e.target.querySelector('button[type="submit"]');
  setLoading(button, true);
  
  try {
    const response = await fetch(`${API_BASE}/api/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        title, 
        author, 
        isbn, 
        category, 
        copies: parseInt(copies),
        location 
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Book added successfully!', 'success');
      loadAdminBooks();
      hideAddBookForm();
      e.target.reset();
    } else {
      showToast(data.error || 'Failed to add book', 'error');
    }
  } catch (error) {
    console.error('Add book error:', error);
    showToast('Error adding book', 'error');
  } finally {
    setLoading(button, false);
  }
}

async function loadAdminBooks() {
  try {
    const response = await fetch(`${API_BASE}/api/books`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const books = await response.json();
      displayAdminBooks(books);
      
      // Update catalog stats
      const totalBooks = books.length;
      const availableCopies = books.reduce((sum, book) => sum + (book.copies || 1), 0);
      
      document.getElementById('total-books').textContent = `Total: ${totalBooks} books`;
      document.getElementById('available-copies').textContent = `Available: ${availableCopies} copies`;
    } else {
      throw new Error('Failed to load books');
    }
  } catch (error) {
    console.error('Load admin books error:', error);
    showToast('Error loading books', 'error');
  }
}

function displayAdminBooks(books) {
  const container = document.getElementById('admin-book-list');
  if (!container) return;
  
  if (books.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book"></i>
        <h4>No books in catalog</h4>
        <p>Add your first book to get started</p>
        <button class="btn-primary" onclick="showAddBookForm()">
          <i class="fas fa-plus-circle"></i> Add Book
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = books.map(book => `
    <div class="book-card admin-book" role="article" aria-label="${book.title}">
      <div class="book-header">
        <h4 class="book-title">${book.title}</h4>
        <span class="book-status ${book.available ? 'available' : 'unavailable'}">
          ${book.available ? 'Available' : 'Unavailable'}
        </span>
      </div>
      <div class="book-details">
        <p><strong>Author:</strong> ${book.author}</p>
        <p><strong>ISBN:</strong> ${book.isbn}</p>
        <p><strong>Category:</strong> ${book.category}</p>
        <p><strong>Copies:</strong> ${book.copies || 1}</p>
        ${book.location ? `<p><strong>Location:</strong> ${book.location}</p>` : ''}
      </div>
      <div class="admin-actions">
        <button class="btn-edit" onclick="editBook(${book.id})" 
                aria-label="Edit ${book.title}">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-delete" onclick="deleteBook(${book.id})" 
                aria-label="Delete ${book.title}">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
}

async function deleteBook(bookId) {
  if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/books/${bookId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      showToast('Book deleted successfully!', 'success');
      loadAdminBooks();
    } else {
      const data = await response.json();
      showToast(data.error || 'Failed to delete book', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Error deleting book', 'error');
  }
}

function editBook(bookId) {
  // In a real application, you'd fetch the book details first
  // For now, using a simple prompt approach
  const book = allBooks.find(b => b.id === bookId);
  if (!book) {
    showToast('Book not found', 'error');
    return;
  }
  
  // Open a modal or form with pre-filled data
  // For simplicity, using a series of prompts
  const title = prompt('Edit title:', book.title) || book.title;
  const author = prompt('Edit author:', book.author) || book.author;
  const isbn = prompt('Edit ISBN:', book.isbn) || book.isbn;
  const category = prompt('Edit category:', book.category) || book.category;
  const available = confirm('Is this book available?');
  
  updateBook(bookId, { title, author, isbn, category, available });
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
      showToast('Book updated successfully!', 'success');
      loadAdminBooks();
      if (currentUser.role !== 'admin') {
        searchBooks();
      }
    } else {
      const data = await response.json();
      showToast(data.error || 'Failed to update book', 'error');
    }
  } catch (error) {
    console.error('Update error:', error);
    showToast('Error updating book', 'error');
  }
}

// Dashboard Statistics
async function updateDashboardStats() {
  try {
    const response = await fetch(`${API_BASE}/api/borrow/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const borrowed = await response.json();
      const activeBorrowed = borrowed.filter(item => !item.returned);
      const borrowedCount = activeBorrowed.length;
      
      // Calculate due soon (within 3 days)
      const dueSoonCount = activeBorrowed.filter(item => {
        const dueDate = new Date(item.due_date);
        const now = new Date();
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        return diffDays <= 3 && diffDays >= 0;
      }).length;
      
      // Calculate overdue
      const overdueCount = activeBorrowed.filter(item => {
        const dueDate = new Date(item.due_date);
        const now = new Date();
        return dueDate < now;
      }).length;
      
      // Update UI
      document.getElementById('borrowed-count').textContent = borrowedCount;
      document.getElementById('due-count').textContent = dueSoonCount;
      document.getElementById('history-count').textContent = borrowed.length;
      
      // Update borrowed total badge
      const borrowedTotal = document.getElementById('borrowed-total');
      if (borrowedTotal) {
        borrowedTotal.textContent = `${borrowedCount} books`;
        
        // Add overdue warning
        if (overdueCount > 0) {
          borrowedTotal.classList.add('overdue-badge');
          borrowedTotal.title = `${overdueCount} books overdue`;
        } else {
          borrowedTotal.classList.remove('overdue-badge');
        }
      }
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
  }
}

// Utility Functions
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    token = null;
    
    // Hide all sections
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('main-header').setAttribute('aria-hidden', 'true');
    document.getElementById('student-dashboard').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none';
    
    // Show auth section
    document.getElementById('auth-section').style.display = 'block';
    showTab('login');
    
    showToast('Logged out successfully', 'success');
  }
}

function showAddBookForm() {
  const formSection = document.getElementById('add-book-form-section');
  formSection.style.display = formSection.style.display === 'none' ? 'block' : 'none';
  
  // Focus on first input
  if (formSection.style.display === 'block') {
    setTimeout(() => {
      document.getElementById('book-title')?.focus();
    }, 100);
  }
}

function hideAddBookForm() {
  const formSection = document.getElementById('add-book-form-section');
  formSection.style.display = 'none';
  document.getElementById('add-book').reset();
}

function clearSearch() {
  document.getElementById('search-title-input').value = '';
  document.getElementById('search-author').value = '';
  document.getElementById('search-category').value = '';
  searchBooks();
}

function updateBookCount(count) {
  const countElement = document.getElementById('book-count');
  if (countElement) {
    countElement.textContent = `${count} book${count !== 1 ? 's' : ''}`;
  }
}

// Validation Functions
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

// UI Helper Functions
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 5000);
}

function setLoading(element, loading) {
  if (!element) return;
  
  if (loading) {
    element.disabled = true;
    const originalText = element.innerHTML;
    element.dataset.originalText = originalText;
    element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  } else {
    element.disabled = false;
    element.innerHTML = element.dataset.originalText || '';
    delete element.dataset.originalText;
  }
}

function showLoading(show) {
  const loadingOverlay = document.getElementById('loading');
  if (loadingOverlay) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';
  
  return Math.floor(seconds) + ' seconds ago';
}

function clearMessages() {
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';
}

// Placeholder functions for future features
async function loadUsers() {
  showToast('User management coming soon!', 'info');
}

async function exportBooks() {
  showToast('Export feature coming soon!', 'info');
}

function viewBookDetails(bookId) {
  showToast('Book details feature coming soon!', 'info');
}

function filterRecords() {
  showToast('Filtering records...', 'info');
  // Implementation would go here
}
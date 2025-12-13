// CONFIG & GLOBALS
const API_BASE = 'https://jl-cezp.onrender.com';
let currentUser = null, token = localStorage.getItem('token'), books = [], borrowedBooks = [], currentSection = 'dashboard', selectedBooks = new Set(), isLoading = false;

// DOM ELEMENTS
const authScreen = document.getElementById('auth-screen'), appContainer = document.getElementById('app-container'), loadingOverlay = document.getElementById('loading-overlay');

// UTILITY FUNCTIONS
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options };
    if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        return { response, data };
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

function setLoading(button, loading) {
    if (loading) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;
    } else {
        button.innerHTML = button.dataset.originalText || 'Submit';
        button.disabled = false;
    }
}

function showMessage(container, message, type = 'info') {
    container.innerHTML = `<div class="message ${type}">${message}</div>`;
    if (type !== 'error') setTimeout(() => container.innerHTML = '', 5000);
}

function showLoading() { loadingOverlay.classList.remove('d-none'); }
function hideLoading() { loadingOverlay.classList.add('d-none'); }

function showToast(message, type = 'info', duration = 5000) {
    const toastId = Date.now();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = `toast-${toastId}`;
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
        <div class="toast-content">
            <p>${message}</p>
        </div>
        <button class="toast-close" onclick="removeToast(${toastId})"><i class="fas fa-times"></i></button>
    `;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => removeToast(toastId), duration);
}

function removeToast(toastId) {
    const toast = document.getElementById(`toast-${toastId}`);
    if (toast) {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePassword(password) { return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password); }
function getInitials(name) { return name.split(' ').map(p => p[0]).join('').toUpperCase().substring(0, 2); }

// UI Helper Functions
function togglePassword(passwordId) {
    const input = document.getElementById(passwordId);
    const button = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

function clearSearch() {
    document.getElementById('global-search').value = '';
    searchBooks();
}

function showNotifications() {
    showToast('Notifications feature coming soon!', 'info');
}

function toggleDarkMode() {
    showToast('Dark mode feature coming soon!', 'info');
}

function showQuickActions() {
    showToast('Quick actions feature coming soon!', 'info');
}

// Placeholder functions for missing features
function showAllBooks() { showSection('books'); }
function showBorrowedBooks() { showSection('borrowed'); }
function showReservations() { showToast('Reservations feature coming soon!', 'info'); }
function showRenewals() { showToast('Renewals feature coming soon!', 'info'); }
function showRecommendations() { showToast('Recommendations feature coming soon!', 'info'); }
function showReadingGoals() { showToast('Reading goals feature coming soon!', 'info'); }
function showQuickBorrow() { showToast('Quick borrow feature coming soon!', 'info'); }
function showAdvancedSearch() { showToast('Advanced search feature coming soon!', 'info'); }
function exportBookList() { showToast('Export feature coming soon!', 'info'); }
function renewSelected() { showToast('Bulk renew feature coming soon!', 'info'); }
function downloadReceipt() { showToast('Receipt download feature coming soon!', 'info'); }
function setGridView() { document.getElementById('books-container').className = 'books-container grid-view'; }
function setListView() { document.getElementById('books-container').className = 'books-container list-view'; }
function clearFilters() {
    document.getElementById('search-title').value = '';
    document.getElementById('search-author').value = '';
    document.getElementById('search-category').value = '';
    document.getElementById('search-availability').value = '';
    searchBooks();
}
function viewBookDetails(bookId) { showToast(`Book details for ID ${bookId} coming soon!`, 'info'); }
function renewBook(bookId) { showToast(`Renew book ${bookId} feature coming soon!`, 'info'); }
function updateReadingStats(period) { showToast(`Reading stats for ${period} coming soon!`, 'info'); }
function loadReadingHistory() { showToast('Reading history feature coming soon!', 'info'); }
function refreshDashboard() { loadDashboard(); showToast('Dashboard refreshed!', 'success'); }

// AUTHENTICATION
async function initApp() {
    const fallbackTimer = setTimeout(() => hideLoading(), 10000);
    try {
        await checkConnection();
        updateCurrentDate();
        if (token) await verifyToken();
        else showAuthTab('login');
        setupEventListeners();
        setInterval(updateCurrentDate, 60000);
    } catch (error) {
        console.error('Init error:', error);
    } finally {
        clearTimeout(fallbackTimer);
        hideLoading();
    }
}

function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('global-search').addEventListener('input', debounce(searchBooks, 300));
    window.addEventListener('resize', handleResize);
}

function showAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    if (!validateEmail(email) || password.length < 6) {
        showToast('Invalid credentials', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);

    try {
        const { response, data } = await apiRequest('/api/auth/login', {
            method: 'POST', body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            if (rememberMe) {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
            localStorage.setItem('lastLogin', new Date().toISOString());
            showToast('Login successful!', 'success');
            showMainApp();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Connection failed', 'error');
    } finally {
        setLoading(submitBtn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('register-fullname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (fullName.length < 2 || !validateEmail(email) || !validatePassword(password) || password !== confirmPassword) {
        showToast('Invalid registration data', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);

    try {
        const { response, data } = await apiRequest('/api/auth/register', {
            method: 'POST', body: JSON.stringify({ fullName, email, password })
        });

        if (response.ok) {
            showToast('Registration successful! Please login.', 'success');
            showAuthTab('login');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Connection failed', 'error');
    } finally {
        setLoading(submitBtn, false);
    }
}

async function verifyToken() {
    try {
        const { response, data } = await apiRequest('/api/auth/verify');
        if (response.ok) {
            currentUser = data.user;
            showMainApp();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    token = null;
    currentUser = null;
    showAuthScreen();
    showToast('Logged out successfully', 'info');
}

function showAuthScreen() {
    authScreen.classList.remove('d-none');
    appContainer.classList.add('d-none');
}

function showMainApp() {
    authScreen.classList.add('d-none');
    appContainer.classList.remove('d-none');
    showSection('dashboard');
}

// NAVIGATION & UI
function showSection(sectionId) {
    currentSection = sectionId;
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    document.querySelectorAll('.section').forEach(section => section.classList.add('d-none'));
    document.getElementById(sectionId).classList.remove('d-none');
    updateBreadcrumb(sectionId);
    loadSectionData(sectionId);
    if (window.innerWidth < 992) toggleSidebar();
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function updateBreadcrumb(sectionId) {
    const names = { dashboard: 'Dashboard', books: 'Browse Books', borrowed: 'My Books', history: 'Reading History', reservations: 'Reservations', recommendations: 'Recommendations', favorites: 'Favorites', profile: 'My Profile', notifications: 'Notifications', help: 'Help & Support' };
    document.getElementById('breadcrumb').innerHTML = `<a href="#dashboard" onclick="showSection('dashboard')">Dashboard</a> <i class="fas fa-chevron-right"></i> <span>${names[sectionId] || sectionId}</span>`;
}

function loadSectionData(sectionId) {
    const loaders = { dashboard: loadDashboard, books: searchBooks, borrowed: loadBorrowedBooks, history: loadReadingHistory };
    if (loaders[sectionId]) loaders[sectionId]();
}

function handleResize() {
    if (window.innerWidth >= 992) document.querySelector('.sidebar').classList.remove('active');
}

// DASHBOARD
async function loadDashboard() {
    showLoading();
    try {
        await Promise.all([loadDashboardStats(), loadRecentBooks(), loadDueBooks(), loadReadingStats()]);
    } catch (error) {
        showToast('Failed to load dashboard', 'error');
    } finally {
        hideLoading();
    }
}

async function loadDashboardStats() {
    try {
        const { response, data } = await apiRequest('/api/dashboard/stats');
        if (response.ok) {
            document.getElementById('total-books').textContent = data.totalBooks || 0;
            document.getElementById('borrowed-books').textContent = data.borrowedBooks || 0;
            document.getElementById('overdue-books').textContent = data.overdueBooks || 0;
            document.getElementById('available-books').textContent = data.availableBooks || 0;
        }
    } catch (error) {
        console.error('Stats loading error:', error);
    }
}

async function loadRecentBooks() {
    try {
        const { response, data } = await apiRequest('/api/books/recent?limit=6');
        if (response.ok) displayBooks(data, 'recent-books-grid');
    } catch (error) {
        console.error('Recent books loading error:', error);
    }
}

async function loadDueBooks() {
    try {
        const { response, data } = await apiRequest('/api/borrowed/due-soon');
        if (response.ok) displayDueBooks(data);
    } catch (error) {
        console.error('Due books loading error:', error);
    }
}

function displayDueBooks(books) {
    const container = document.getElementById('due-books-list');
    if (books.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No books due soon</p></div>';
        return;
    }
    container.innerHTML = books.map(book => {
        const dueDate = new Date(book.due_date);
        const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0;
        return `<div class="due-book-item ${isOverdue ? 'overdue' : ''}">
            <i class="fas fa-book" style="color: ${isOverdue ? 'var(--danger)' : 'var(--warning)'};"></i>
            <div class="due-book-info">
                <div class="due-book-title">${book.title}</div>
                <div class="due-book-due">Due: ${formatDate(book.due_date)} (${isOverdue ? Math.abs(daysLeft) + ' days overdue' : daysLeft + ' days left'})</div>
            </div>
            <button class="btn btn-sm ${isOverdue ? 'btn-danger' : 'btn-warning'}" onclick="renewBook(${book.id})"><i class="fas fa-redo"></i> Renew</button>
        </div>`;
    }).join('');
}

function loadReadingStats() {
    document.getElementById('reading-stats').innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--gray-500);"><i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 1rem;"></i><p>Reading statistics chart</p></div>';
}

// BOOKS MANAGEMENT
async function searchBooks() {
    const title = document.getElementById('search-title')?.value.trim();
    const author = document.getElementById('search-author')?.value.trim();
    const category = document.getElementById('search-category')?.value;
    const availability = document.getElementById('search-availability')?.value;

    showLoading();
    try {
        const params = new URLSearchParams();
        if (title) params.append('title', title);
        if (author) params.append('author', author);
        if (category) params.append('category', category);
        if (availability) params.append('available', availability === 'available');

        const { response, data } = await apiRequest(`/api/books/search?${params}`);
        if (response.ok) {
            books = data;
            displayBooks(data, 'books-grid');
        }
    } catch (error) {
        showToast('Search failed', 'error');
    } finally {
        hideLoading();
    }
}

function displayBooks(books, containerId = 'books-grid') {
    const container = document.getElementById(containerId);
    if (books.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><h3>No books found</h3><p>Try adjusting your search criteria</p></div>';
        return;
    }
    container.innerHTML = books.map(book => `
        <div class="book-card">
            <div class="book-cover">
                <i class="fas fa-book"></i>
                <div class="book-category">${book.category || 'General'}</div>
            </div>
            <div class="book-info">
                <h4>${book.title}</h4>
                <p>by ${book.author}</p>
                <p>ISBN: ${book.isbn}</p>
            </div>
            <div class="book-actions">
                <button class="btn btn-sm btn-primary" onclick="borrowBook(${book.id})"><i class="fas fa-hand-holding"></i> Borrow</button>
                <button class="btn btn-sm btn-secondary" onclick="viewBookDetails(${book.id})"><i class="fas fa-eye"></i> Details</button>
            </div>
        </div>
    `).join('');
}

async function borrowBook(bookId) {
    if (!confirm('Are you sure you want to borrow this book?')) return;
    showLoading();
    try {
        const { response, data } = await apiRequest('/api/borrow', {
            method: 'POST', body: JSON.stringify({ bookId })
        });
        if (response.ok) {
            showToast('Book borrowed successfully!', 'success');
            searchBooks();
            loadBorrowedBooks();
        } else {
            showToast(data.error || 'Failed to borrow book', 'error');
        }
    } catch (error) {
        showToast('Connection failed', 'error');
    } finally {
        hideLoading();
    }
}

async function loadBorrowedBooks() {
    showLoading();
    try {
        const { response, data } = await apiRequest('/api/borrow/my');
        if (response.ok) {
            borrowedBooks = data;
            displayBorrowedBooks(data);
        }
    } catch (error) {
        showToast('Failed to load borrowed books', 'error');
    } finally {
        hideLoading();
    }
}

function displayBorrowedBooks(books) {
    const container = document.getElementById('borrowed-books-table');
    if (books.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-book-reader"></i><h3>No borrowed books</h3><p>You haven\'t borrowed any books yet</p></div>';
        return;
    }
    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Book Title</th>
                    <th>Borrow Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${books.map(book => `
                    <tr>
                        <td>${book.title}</td>
                        <td>${formatDate(book.borrow_date)}</td>
                        <td>${formatDate(book.due_date)}</td>
                        <td><span class="badge ${book.returned ? 'badge-success' : 'badge-warning'}">${book.returned ? 'Returned' : 'Borrowed'}</span></td>
                        <td>
                            ${!book.returned ? `<button class="btn btn-sm btn-primary" onclick="returnBook(${book.id})">Return</button>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function returnBook(borrowId) {
    if (!confirm('Are you sure you want to return this book?')) return;
    showLoading();
    try {
        const { response, data } = await apiRequest(`/api/borrowed/${borrowId}/return`, { method: 'PUT' });
        if (response.ok) {
            showToast('Book returned successfully!', 'success');
            loadBorrowedBooks();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to return book', 'error');
        }
    } catch (error) {
        showToast('Connection failed', 'error');
    } finally {
        hideLoading();
    }
}

// CONNECTION & MISC
async function testConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${API_BASE}/api/books/search?limit=1`, {
            headers: { 'Authorization': `Bearer ${token || 'test'}` }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok || response.status === 401;
    } catch (error) {
        return false;
    }
}

async function checkConnection() {
    const isConnected = await testConnection();
    if (!isConnected) showToast('Connection failed. Some features may not work.', 'warning');
}

function updateCurrentDate() {
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// ============================================
// CONFIGURATION & GLOBAL VARIABLES
// ============================================

const API_BASE = 'http://localhost:5000';

const APP_NAME = 'ScholarSync';
const APP_VERSION = '2.1.0';

// Application State
let currentUser = null;
let token = localStorage.getItem('token');
let books = [];
let borrowedBooks = [];
let currentSection = 'dashboard';
let selectedBooks = new Set();
let isLoading = false;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');
const loadingOverlay = document.getElementById('loading-overlay');

// ============================================
// CONNECTION TESTING FUNCTIONS
// ============================================

// Test database connection
async function testConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(`${API_BASE}/api/books/search?limit=1`, {
            headers: { 'Authorization': `Bearer ${token || 'test'}` },
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok || response.status === 401; // 401 is expected without auth
    } catch (error) {
        console.error('Connection test failed:', error);
        return false;
    }
}

// Show connection status
async function checkConnection() {
    const isConnected = await testConnection();
    if (!isConnected) {
        showToast('Unable to connect to database. Please check your internet connection.', 'error');
    }
    return isConnected;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Show loading overlay
 */
function showLoading() {
    isLoading = true;
    loadingOverlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    isLoading = false;
    loadingOverlay.style.display = 'none';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    const toastId = 'toast-' + Date.now();
    
    const toastTypes = {
        success: { icon: 'fas fa-check-circle', color: 'success' },
        error: { icon: 'fas fa-exclamation-circle', color: 'error' },
        warning: { icon: 'fas fa-exclamation-triangle', color: 'warning' },
        info: { icon: 'fas fa-info-circle', color: 'info' }
    };
    
    const toastType = toastTypes[type] || toastTypes.info;
    
    const toast = document.createElement('div');
    toast.className = `toast ${toastType.color}`;
    toast.id = toastId;
    toast.innerHTML = `
        <i class="${toastType.icon} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close" onclick="removeToast('${toastId}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        removeToast(toastId);
    }, duration);
}

/**
 * Remove toast notification
 */
function removeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

/**
 * Format date to readable string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format date with time
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Calculate days between dates
 */
function getDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get time ago string
 */
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
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

/**
 * Debounce function for search
 */
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

/**
 * Toggle password visibility
 */
function togglePassword(passwordId) {
    const passwordInput = document.getElementById(passwordId);
    const toggleButton = passwordInput.parentElement.querySelector('.toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleButton.className = 'fas fa-eye';
    }
}

/**
 * Validate email format
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validate password strength
 */
function validatePassword(password) {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

/**
 * Generate user avatar initials
 */
function getInitials(name) {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Initialize application
 */
async function initApp() {
    // Force hide loading after 10 seconds as fallback
    const fallbackTimer = setTimeout(() => {
        console.log('Fallback: Hiding loading overlay');
        hideLoading();
    }, 10000);

    try {
        console.log('Initializing app...');

        // Test database connection
        await checkConnection();

        // Update current date
        updateCurrentDate();

        // Check if user is already logged in
        if (token) {
            await verifyToken();
        } else {
            showAuthTab('login');
        }

        // Set up event listeners
        setupEventListeners();

        // Update date every minute
        setInterval(updateCurrentDate, 60000);

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error during app initialization:', error);
    } finally {
        // Always hide loading overlay
        clearTimeout(fallbackTimer);
        hideLoading();
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Global search
    const globalSearch = document.getElementById('global-search');
    globalSearch.addEventListener('input', debounce(searchBooks, 300));
    
    // Quick actions
    document.querySelector('.action-btn[onclick="showQuickActions()"]')
        .addEventListener('click', showQuickActions);
    
    // Theme toggle
    document.querySelector('.action-btn[onclick="toggleDarkMode()"]')
        .addEventListener('click', toggleDarkMode);
    
    // Notifications
    document.querySelector('.action-btn[onclick="showNotifications()"]')
        .addEventListener('click', showNotifications);
    
    // Window resize
    window.addEventListener('resize', handleResize);
}

/**
 * Show authentication tab
 */
function showAuthTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (tab === 'login') {
        document.getElementById('login-tab').classList.add('active');
        document.getElementById('login-form').classList.add('active');
        document.getElementById('register-form').classList.remove('active');
    } else {
        document.getElementById('register-tab').classList.add('active');
        document.getElementById('register-form').classList.add('active');
        document.getElementById('login-form').classList.remove('active');
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    
    // Validation
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    submitBtn.disabled = true;
    
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
            
            // Store in localStorage
            if (rememberMe) {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(currentUser));
            } else {
                sessionStorage.setItem('token', token);
                sessionStorage.setItem('user', JSON.stringify(currentUser));
            }
            
            // Store last login
            localStorage.setItem('lastLogin', new Date().toISOString());
            
            showToast('Login successful! Welcome back.', 'success');
            showMainApp();
        } else {
            showToast(data.error || 'Invalid email or password', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Connection failed. Please try again.', 'error');
    } finally {
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        submitBtn.disabled = false;
    }
}

/**
 * Handle registration form submission
 */
async function handleRegister(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('register-fullname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // Validation
    if (fullName.length < 2) {
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
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                full_name: fullName, 
                email, 
                password 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Registration successful! Please login.', 'success');
            showAuthTab('login');
            e.target.reset();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Connection failed. Please try again.', 'error');
    } finally {
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        submitBtn.disabled = false;
    }
}

/**
 * Verify token validity
 */
async function verifyToken() {
    if (!token) {
        showAuthTab('login');
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(`${API_BASE}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            showMainApp();
        } else {
            // Token is invalid, clear it and show login
            logout();
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        // If verification fails, clear token and show login
        logout();
    }
}

/**
 * Show main application
 */
function showMainApp() {
    // Hide auth screen
    authScreen.style.display = 'none';
    
    // Show app container
    appContainer.style.display = 'flex';
    
    // Update user info
    updateUserInfo();
    
    // Load initial data
    loadDashboard();
    
    // Show dashboard section
    showSection('dashboard');
}

/**
 * Update user information in UI
 */
function updateUserInfo() {
    if (!currentUser) return;
    
    // Update avatar
    const initials = getInitials(currentUser.full_name);
    document.getElementById('user-initials').textContent = initials;
    
    // Update user details
    document.getElementById('user-name').textContent = currentUser.full_name;
    document.getElementById('user-role').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('user-id').textContent = `ID: ${currentUser.id || 'ACU2024001'}`;
    
    // Update avatar background based on role
    const avatar = document.getElementById('user-avatar');
    if (currentUser.role === 'admin') {
        avatar.style.background = 'linear-gradient(135deg, var(--secondary) 0%, var(--accent) 100%)';
    }
}

/**
 * Update current date in UI
 */
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    const dateString = now.toLocaleDateString('en-US', options);
    document.getElementById('current-date').textContent = dateString;
}

/**
 * Logout user
 */
function logout() {
    showConfirmation(
        'Are you sure you want to logout?',
        () => {
            // Clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            
            // Reset state
            currentUser = null;
            token = null;
            books = [];
            borrowedBooks = [];
            
            // Show auth screen
            appContainer.style.display = 'none';
            authScreen.style.display = 'flex';
            
            // Reset forms
            document.getElementById('login-form').reset();
            showAuthTab('login');
            
            showToast('Logged out successfully', 'success');
        }
    );
}

// ============================================
// NAVIGATION FUNCTIONS
// ============================================

/**
 * Toggle sidebar visibility (mobile)
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

/**
 * Show section
 */
function showSection(sectionId) {
    // Update current section
    currentSection = sectionId;
    
    // Update navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Update breadcrumb
    updateBreadcrumb(sectionId);
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionId}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Load section data
        loadSectionData(sectionId);
    }
    
    // Close sidebar on mobile
    if (window.innerWidth < 992) {
        toggleSidebar();
    }
}

/**
 * Update breadcrumb
 */
function updateBreadcrumb(sectionId) {
    const breadcrumb = document.getElementById('breadcrumb');
    const sectionNames = {
        dashboard: 'Dashboard',
        books: 'Browse Books',
        borrowed: 'My Books',
        history: 'Reading History',
        reservations: 'Reservations',
        recommendations: 'Recommendations',
        favorites: 'Favorites',
        profile: 'My Profile',
        notifications: 'Notifications',
        help: 'Help & Support'
    };
    
    breadcrumb.innerHTML = `
        <a href="#dashboard" onclick="showSection('dashboard')">Dashboard</a>
        <i class="fas fa-chevron-right"></i>
        <span>${sectionNames[sectionId] || sectionId}</span>
    `;
}

/**
 * Load section data
 */
function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'books':
            searchBooks();
            break;
        case 'borrowed':
            loadBorrowedBooks();
            break;
        case 'history':
            loadReadingHistory();
            break;
        default:
            // Load default content for other sections
            break;
    }
}

/**
 * Handle window resize
 */
function handleResize() {
    if (window.innerWidth >= 992) {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.remove('active');
    }
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

/**
 * Load dashboard data
 */
async function loadDashboard() {
    showLoading();
    
    try {
        // Load stats
        await loadDashboardStats();
        
        // Load recent books
        await loadRecentBooks();
        
        // Load due books
        await loadDueBooks();
        
        // Load reading stats
        await loadReadingStats();
        
    } catch (error) {
        console.error('Dashboard loading error:', error);
        showToast('Failed to load dashboard data', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Load dashboard statistics
 */
async function loadDashboardStats() {
    try {
        // In a real app, fetch from API
        // For demo, use mock data
        const stats = {
            totalBorrowed: 5,
            dueSoon: 1,
            booksRead: 24,
            availableBooks: 1234
        };
        
        // Update stats cards
        document.getElementById('total-borrowed').textContent = stats.totalBorrowed;
        document.getElementById('due-soon').textContent = stats.dueSoon;
        document.getElementById('history-count').textContent = stats.booksRead;
        document.getElementById('available-count').textContent = stats.availableBooks.toLocaleString();
        
        // Update navigation badges
        document.getElementById('nav-available-count').textContent = stats.availableBooks.toLocaleString();
        
    } catch (error) {
        console.error('Stats loading error:', error);
    }
}

/**
 * Load recent books
 */
async function loadRecentBooks() {
    try {
        const response = await fetch(`${API_BASE}/api/books/recent`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            books = await response.json();
            displayRecentBooks(books.slice(0, 4));
        } else {
            // No books available
            displayRecentBooks([]);
        }
    } catch (error) {
        console.error('Recent books loading error:', error);
        displayRecentBooks([]);
    }
}

/**
 * Display recent books
 */
function displayRecentBooks(books) {
    const container = document.getElementById('recent-books-grid');
    
    if (books.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <p>No recent books available</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = books.map(book => `
        <div class="book-card">
            <div class="book-cover">
                <span class="book-category">${book.category}</span>
                <i class="fas fa-book-open" style="font-size: 3rem; color: rgba(255,255,255,0.8);"></i>
            </div>
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <div class="book-meta">
                    <div class="meta-item">
                        <i class="fas fa-user-pen"></i>
                        <span>${book.author}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-barcode"></i>
                        <span>${book.isbn}</span>
                    </div>
                </div>
                <div class="book-actions">
                    ${book.available ? 
                        `<button class="btn btn-primary" onclick="borrowBook(${book.id})">
                            <i class="fas fa-bookmark"></i> Borrow
                        </button>` : 
                        `<button class="btn btn-secondary" disabled>
                            <i class="fas fa-clock"></i> Checked Out
                        </button>`
                    }
                    <button class="btn btn-outline" onclick="showBookDetails(${book.id})">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Load due books
 */
async function loadDueBooks() {
    try {
        const response = await fetch(`${API_BASE}/api/borrow/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            borrowedBooks = await response.json();
            displayDueBooks(borrowedBooks.filter(book => !book.returned));
        } else {
            // Fallback to mock data
            displayDueBooks(getMockBorrowedBooks().filter(book => !book.returned));
        }
    } catch (error) {
        console.error('Due books loading error:', error);
        displayDueBooks(getMockBorrowedBooks().filter(book => !book.returned));
    }
}

/**
 * Display due books
 */
function displayDueBooks(books) {
    const container = document.getElementById('due-books-list');
    
    if (books.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>No books due soon</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = books.map(book => {
        const dueDate = new Date(book.due_date);
        const now = new Date();
        const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0;
        
        return `
            <div class="due-book-item ${isOverdue ? 'overdue' : ''}">
                <i class="fas fa-book" style="color: ${isOverdue ? 'var(--danger)' : 'var(--warning)'};"></i>
                <div class="due-book-info">
                    <div class="due-book-title">${book.title}</div>
                    <div class="due-book-due">
                        Due: ${formatDate(book.due_date)} 
                        <span class="due-book-days">(${isOverdue ? Math.abs(daysLeft) + ' days overdue' : daysLeft + ' days left'})</span>
                    </div>
                </div>
                <button class="btn btn-sm ${isOverdue ? 'btn-danger' : 'btn-warning'}" onclick="renewBook(${book.id})">
                    <i class="fas fa-redo"></i> Renew
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Load reading statistics
 */
async function loadReadingStats() {
    // This would typically fetch from API and render a chart
    // For demo, show placeholder
    const container = document.getElementById('reading-stats');
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
            <i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>Reading statistics chart will appear here</p>
        </div>
    `;
}

/**
 * Refresh dashboard
 */
function refreshDashboard() {
    loadDashboard();
    showToast('Dashboard refreshed', 'success');
}

// ============================================
// BOOKS MANAGEMENT FUNCTIONS
// ============================================

/**
 * Search books
 */
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
        
        const response = await fetch(`${API_BASE}/api/books/search?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            books = await response.json();
            displayBooks(books);
            updateBooksCount(books.length);
        } else {
            throw new Error('Failed to fetch books');
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Error fetching books. Please try again.', 'error');
        books = [];
        displayBooks(books);
        updateBooksCount(0);
    } finally {
        hideLoading();
    }
}

/**
 * Display books
 */
function displayBooks(books) {
    const container = document.getElementById('books-container');
    const isEmpty = books.length === 0;
    
    if (isEmpty) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No Books Found</h3>
                <p>Try adjusting your search filters</p>
                <button class="btn btn-primary" onclick="clearFilters()">
                    Clear Filters
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = books.map(book => `
        <div class="book-card">
            <div class="book-cover">
                <span class="book-category">${book.category}</span>
                <i class="fas fa-book-open" style="font-size: 3rem; color: rgba(255,255,255,0.8);"></i>
            </div>
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <div class="book-meta">
                    <div class="meta-item">
                        <i class="fas fa-user-pen"></i>
                        <span>${book.author}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-barcode"></i>
                        <span>${book.isbn}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-tag"></i>
                        <span>${book.category}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-copy"></i>
                        <span>Copies: ${book.copies || 1}</span>
                    </div>
                </div>
                <div class="book-actions">
                    ${book.available ? 
                        `<button class="btn btn-primary" onclick="borrowBook(${book.id})">
                            <i class="fas fa-bookmark"></i> Borrow
                        </button>` : 
                        `<button class="btn btn-secondary" disabled>
                            <i class="fas fa-clock"></i> Checked Out
                        </button>`
                    }
                    <button class="btn btn-outline" onclick="showBookDetails(${book.id})">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Update books count display
 */
function updateBooksCount(count) {
    const countElement = document.getElementById('books-count');
    if (countElement) {
        countElement.textContent = `${count} Book${count !== 1 ? 's' : ''} Found`;
    }
}

/**
 * Clear search filters
 */
function clearFilters() {
    document.getElementById('search-title').value = '';
    document.getElementById('search-author').value = '';
    document.getElementById('search-category').value = '';
    document.getElementById('search-availability').value = '';
    
    searchBooks();
    showToast('Filters cleared', 'success');
}

/**
 * Clear global search
 */
function clearSearch() {
    document.getElementById('global-search').value = '';
    showToast('Search cleared', 'info');
}

/**
 * Set grid view for books
 */
function setGridView() {
    const container = document.getElementById('books-container');
    const gridBtn = document.querySelector('.view-btn:nth-child(1)');
    const listBtn = document.querySelector('.view-btn:nth-child(2)');
    
    container.classList.remove('list-view');
    container.classList.add('grid-view');
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
}

/**
 * Set list view for books
 */
function setListView() {
    const container = document.getElementById('books-container');
    const gridBtn = document.querySelector('.view-btn:nth-child(1)');
    const listBtn = document.querySelector('.view-btn:nth-child(2)');
    
    container.classList.remove('grid-view');
    container.classList.add('list-view');
    gridBtn.classList.remove('active');
    listBtn.classList.add('active');
}

// ============================================
// BORROWING FUNCTIONS
// ============================================

/**
 * Load borrowed books
 */
async function loadBorrowedBooks() {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/api/borrow/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            borrowedBooks = await response.json();
            displayBorrowedBooks(borrowedBooks);
            updateBorrowedStats(borrowedBooks);
        } else {
            throw new Error('Failed to load borrowed books');
        }
    } catch (error) {
        console.error('Borrowed books loading error:', error);
        showToast('Error loading borrowed books', 'error');
        // Fallback to mock data
        borrowedBooks = getMockBorrowedBooks();
        displayBorrowedBooks(borrowedBooks);
        updateBorrowedStats(borrowedBooks);
    } finally {
        hideLoading();
    }
}

/**
 * Display borrowed books
 */
function displayBorrowedBooks(books) {
    const container = document.getElementById('borrowed-books-table');
    const emptyState = document.getElementById('empty-borrowed');
    const hasBooks = books.length > 0;
    
    if (!hasBooks) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    container.innerHTML = books.map(book => {
        const borrowedDate = new Date(book.borrowed_date);
        const dueDate = new Date(book.due_date);
        const now = new Date();
        const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0;
        const isDueSoon = daysLeft <= 3 && daysLeft >= 0;
        
        let status = 'Borrowed';
        let statusClass = '';
        
        if (book.returned) {
            status = 'Returned';
            statusClass = 'success';
        } else if (isOverdue) {
            status = 'Overdue';
            statusClass = 'danger';
        } else if (isDueSoon) {
            status = 'Due Soon';
            statusClass = 'warning';
        }
        
        return `
            <tr>
                <td>
                    <input type="checkbox" value="${book.id}" 
                           onchange="toggleBookSelection(${book.id})"
                           ${book.returned ? 'disabled' : ''}>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white;">
                            <i class="fas fa-book"></i>
                        </div>
                        <div>
                            <div style="font-weight: 600;">${book.title}</div>
                            <div style="font-size: 0.875rem; color: var(--gray-600);">${book.author}</div>
                        </div>
                    </div>
                </td>
                <td>${formatDate(book.borrowed_date)}</td>
                <td>
                    <div>${formatDate(book.due_date)}</div>
                    <div style="font-size: 0.75rem; color: ${isOverdue ? 'var(--danger)' : isDueSoon ? 'var(--warning)' : 'var(--gray-500)'};">
                        ${isOverdue ? Math.abs(daysLeft) + ' days overdue' : 
                          isDueSoon ? daysLeft + ' days left' : 
                          daysLeft + ' days left'}
                    </div>
                </td>
                <td>
                    <span class="stat-value ${isOverdue ? 'danger' : isDueSoon ? 'warning' : ''}">
                        ${isOverdue ? Math.abs(daysLeft) : daysLeft}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${status}</span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        ${!book.returned ? `
                            <button class="btn btn-sm btn-success" onclick="renewBook(${book.id})" title="Renew">
                                <i class="fas fa-redo"></i>
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="returnBook(${book.id})" title="Return">
                                <i class="fas fa-arrow-up"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline" onclick="showBookDetails(${book.book_id})" title="Details">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Update borrowed books statistics
 */
function updateBorrowedStats(books) {
    const currentBorrowed = books.filter(book => !book.returned).length;
    
    const dueSoon = books.filter(book => {
        if (book.returned) return false;
        const dueDate = new Date(book.due_date);
        const now = new Date();
        const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        return daysLeft <= 3 && daysLeft >= 0;
    }).length;
    
    const overdue = books.filter(book => {
        if (book.returned) return false;
        const dueDate = new Date(book.due_date);
        const now = new Date();
        return dueDate < now;
    }).length;
    
    // Update stats
    document.getElementById('current-borrowed-count').textContent = currentBorrowed;
    document.getElementById('due-soon-count').textContent = dueSoon;
    document.getElementById('overdue-count').textContent = overdue;
    
    // Update navigation badge
    document.getElementById('nav-borrowed-count').textContent = currentBorrowed;
}

/**
 * Toggle book selection
 */
function toggleBookSelection(bookId) {
    if (selectedBooks.has(bookId)) {
        selectedBooks.delete(bookId);
    } else {
        selectedBooks.add(bookId);
    }
    
    // Update select all checkbox
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('input[type="checkbox"][value]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked || cb.disabled);
    selectAll.checked = allChecked;
}

/**
 * Toggle select all books
 */
function toggleSelectAll() {
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('input[type="checkbox"][value]');
    
    checkboxes.forEach(checkbox => {
        if (!checkbox.disabled) {
            checkbox.checked = selectAll.checked;
            const bookId = parseInt(checkbox.value);
            if (selectAll.checked) {
                selectedBooks.add(bookId);
            } else {
                selectedBooks.delete(bookId);
            }
        }
    });
}

/**
 * Renew selected books
 */
function renewSelected() {
    if (selectedBooks.size === 0) {
        showToast('Please select books to renew', 'warning');
        return;
    }
    
    showConfirmation(
        `Renew ${selectedBooks.size} selected book(s)?`,
        async () => {
            showLoading();
            
            try {
                const promises = Array.from(selectedBooks).map(bookId => 
                    fetch(`${API_BASE}/api/borrow/${bookId}/renew`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                );
                
                const results = await Promise.allSettled(promises);
                const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
                
                if (successful > 0) {
                    showToast(`Successfully renewed ${successful} book(s)`, 'success');
                    loadBorrowedBooks();
                    loadDashboard();
                    selectedBooks.clear();
                    document.getElementById('select-all').checked = false;
                } else {
                    showToast('Failed to renew books', 'error');
                }
            } catch (error) {
                console.error('Renew error:', error);
                showToast('Error renewing books', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

/**
 * Renew single book
 */
async function renewBook(bookId) {
    showConfirmation(
        'Renew this book for another 14 days?',
        async () => {
            showLoading();
            
            try {
                const response = await fetch(`${API_BASE}/api/borrow/${bookId}/renew`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    showToast('Book renewed successfully', 'success');
                    loadBorrowedBooks();
                    loadDashboard();
                } else {
                    const data = await response.json();
                    showToast(data.error || 'Failed to renew book', 'error');
                }
            } catch (error) {
                console.error('Renew error:', error);
                showToast('Error renewing book', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

/**
 * Borrow a book
 */
async function borrowBook(bookId) {
    showConfirmation(
        'Borrow this book for 14 days?',
        async () => {
            showLoading();
            
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
                    showToast('Book borrowed successfully', 'success');
                    
                    // Refresh data
                    if (currentSection === 'dashboard') {
                        loadDashboard();
                    } else if (currentSection === 'books') {
                        searchBooks();
                    }
                    loadBorrowedBooks();
                    
                } else {
                    showToast(data.error || 'Failed to borrow book', 'error');
                }
            } catch (error) {
                console.error('Borrow error:', error);
                showToast('Error borrowing book', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

/**
 * Return a book
 */
async function returnBook(borrowId) {
    showConfirmation(
        'Return this book?',
        async () => {
            showLoading();
            
            try {
                const response = await fetch(`${API_BASE}/api/borrow/${borrowId}/return`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    showToast('Book returned successfully', 'success');
                    loadBorrowedBooks();
                    loadDashboard();
                    
                    if (currentSection === 'books') {
                        searchBooks();
                    }
                } else {
                    const data = await response.json();
                    showToast(data.error || 'Failed to return book', 'error');
                }
            } catch (error) {
                console.error('Return error:', error);
                showToast('Error returning book', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

/**
 * Return all books
 */
function returnAllBooks() {
    const activeBooks = borrowedBooks.filter(book => !book.returned);
    
    if (activeBooks.length === 0) {
        showToast('No books to return', 'info');
        return;
    }
    
    showConfirmation(
        `Return all ${activeBooks.length} borrowed books?`,
        async () => {
            showLoading();
            
            try {
                const promises = activeBooks.map(book => 
                    fetch(`${API_BASE}/api/borrow/${book.id}/return`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                );
                
                const results = await Promise.allSettled(promises);
                const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
                
                if (successful > 0) {
                    showToast(`Successfully returned ${successful} book(s)`, 'success');
                    loadBorrowedBooks();
                    loadDashboard();
                    
                    if (currentSection === 'books') {
                        searchBooks();
                    }
                } else {
                    showToast('Failed to return books', 'error');
                }
            } catch (error) {
                console.error('Return all error:', error);
                showToast('Error returning books', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

/**
 * Renew all books
 */
function renewAllBooks() {
    const activeBooks = borrowedBooks.filter(book => !book.returned);
    
    if (activeBooks.length === 0) {
        showToast('No books to renew', 'info');
        return;
    }
    
    showConfirmation(
        `Renew all ${activeBooks.length} borrowed books?`,
        async () => {
            showLoading();
            
            try {
                const promises = activeBooks.map(book => 
                    fetch(`${API_BASE}/api/borrow/${book.id}/renew`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                );
                
                const results = await Promise.allSettled(promises);
                const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
                
                if (successful > 0) {
                    showToast(`Successfully renewed ${successful} book(s)`, 'success');
                    loadBorrowedBooks();
                    loadDashboard();
                } else {
                    showToast('Failed to renew books', 'error');
                }
            } catch (error) {
                console.error('Renew all error:', error);
                showToast('Error renewing books', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Show confirmation modal
 */
function showConfirmation(message, onConfirm) {
    const modal = document.getElementById('confirmation-modal');
    const messageElement = document.getElementById('confirmation-message');
    const confirmBtn = document.getElementById('confirm-action-btn');
    
    messageElement.textContent = message;
    
    // Set up confirmation handler
    const confirmHandler = () => {
        modal.classList.remove('active');
        onConfirm();
        confirmBtn.removeEventListener('click', confirmHandler);
    };
    
    confirmBtn.addEventListener('click', confirmHandler);
    
    // Show modal
    modal.classList.add('active');
}

/**
 * Close modal
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

/**
 * Show book details
 */
function showBookDetails(bookId) {
    const book = books.find(b => b.id === bookId);
    
    if (!book) {
        showToast('Book not found', 'error');
        return;
    }
    
    const modal = document.getElementById('book-details-modal');
    const modalBody = modal.querySelector('.modal-body');
    
    modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
            <div>
                <div style="width: 100%; height: 300px; background: linear-gradient(135deg, var(--primary-light) 0%, var(--secondary) 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-book-open" style="font-size: 6rem; color: rgba(255,255,255,0.8);"></i>
                </div>
            </div>
            <div>
                <h3 style="margin-top: 0;">${book.title}</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                        <strong>Author:</strong>
                        <p>${book.author}</p>
                    </div>
                    <div>
                        <strong>ISBN:</strong>
                        <p>${book.isbn}</p>
                    </div>
                    <div>
                        <strong>Category:</strong>
                        <p>${book.category}</p>
                    </div>
                    <div>
                        <strong>Description:</strong>
                        <p>${book.description || 'No description available.'}</p>
                    </div>
                    <div>
                        <strong>Status:</strong>
                        <span class="status-badge ${book.available ? 'success' : 'warning'}">
                            ${book.available ? 'Available' : 'Checked Out'}
                        </span>
                    </div>
                    <div>
                        <strong>Copies Available:</strong>
                        <p>${book.copies || 1}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    ${book.available ? 
                        `<button class="btn btn-primary" onclick="borrowBook(${book.id}); closeModal('book-details-modal')">
                            <i class="fas fa-bookmark"></i> Borrow Book
                        </button>` : 
                        `<button class="btn btn-secondary" disabled>
                            <i class="fas fa-clock"></i> Currently Unavailable
                        </button>`
                    }
                    <button class="btn btn-outline">
                        <i class="fas fa-heart"></i> Add to Favorites
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

/**
 * Show quick borrow modal
 */
function showQuickBorrow() {
    const modal = document.getElementById('quick-borrow-modal');
    modal.classList.add('active');
}

/**
 * Show advanced search
 */
function showAdvancedSearch() {
    showToast('Advanced search feature coming soon!', 'info');
}

/**
 * Show quick actions menu
 */
function showQuickActions() {
    const menu = document.getElementById('quick-actions-menu');
    menu.classList.add('active');
}

/**
 * Hide quick actions menu
 */
function hideQuickActions() {
    const menu = document.getElementById('quick-actions-menu');
    menu.classList.remove('active');
}

/**
 * Show notifications
 */
function showNotifications() {
    showToast('Notifications feature coming soon!', 'info');
}

/**
 * Toggle dark mode
 */
function toggleDarkMode() {
    const body = document.body;
    const isDark = body.classList.contains('dark-mode');
    
    if (isDark) {
        body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        showToast('Switched to light mode', 'success');
    } else {
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        showToast('Switched to dark mode', 'success');
    }
}

// ============================================
// MOCK DATA (for demo purposes)
// ============================================

// ============================================
// INITIALIZATION
// ============================================

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Set theme based on preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
}

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
        // Refresh data when page becomes visible
        if (currentSection === 'dashboard') {
            loadDashboard();
        }
    }
});

// Prevent accidental navigation
window.addEventListener('beforeunload', (e) => {
    if (currentUser && !isLoading) {
        // Don't show confirmation for normal navigation
        return;
    }
});
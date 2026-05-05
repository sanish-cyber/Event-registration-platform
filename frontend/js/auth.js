// frontend/js/auth.js

// Authentication manager
const auth = {
    // Check if user is logged in
    isLoggedIn() {
        return !!localStorage.getItem('token');
    },

    // Get current user data
    getUser() {
        const userData = localStorage.getItem('user');
        return userData ? JSON.parse(userData) : null;
    },

    // Get user role
    getRole() {
        const user = this.getUser();
        return user ? user.role : null;
    },

    // Save user session
    saveSession(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    },

    // Clear user session
    clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    // Logout
    logout() {
        this.clearSession();
        window.location.href = 'login.html';
    },

    // Require authentication
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    // Require specific role
    requireRole(roles) {
        if (!this.requireAuth()) return false;
        
        const userRole = this.getRole();
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(userRole)) {
            showToast('You do not have permission to access this page', 'error');
            window.location.href = 'dashboard.html';
            return false;
        }
        return true;
    },

    // Redirect if logged in
    redirectIfLoggedIn() {
        if (this.isLoggedIn()) {
            window.location.href = 'dashboard.html';
        }
    }
};

// Update navbar based on auth status
function updateNavbar() {
    const user = auth.getUser();
    const navbarMenu = document.getElementById('navbarMenu');
    const navbarUser = document.getElementById('navbarUser');
    
    if (!navbarMenu || !navbarUser) return;

    if (user) {
        // Show menu items based on role
        let menuItems = `
            <a href="events.html"><i class="fas fa-calendar-alt"></i> Events</a>
            <a href="dashboard.html"><i class="fas fa-home"></i> Dashboard</a>
        `;

        if (user.role === 'organizer' || user.role === 'admin') {
            menuItems += `<a href="manage-events.html"><i class="fas fa-edit"></i> Manage Events</a>`;
        }

        if (user.role === 'admin') {
            menuItems += `<a href="admin.html"><i class="fas fa-cog"></i> Admin</a>`;
        }

        navbarMenu.innerHTML = menuItems;

        // User dropdown
        navbarUser.innerHTML = `
            <button class="notification-btn" onclick="toggleNotifications()">
                <i class="fas fa-bell"></i>
                <span class="notification-badge hidden" id="notificationBadge">0</span>
            </button>
            <div class="user-dropdown">
                <button class="user-dropdown-btn" onclick="toggleUserMenu()">
                    <div class="user-avatar">${user.firstName[0]}${user.lastName[0]}</div>
                    <span>${user.firstName}</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="user-dropdown-menu" id="userDropdownMenu">
                    <a href="dashboard.html"><i class="fas fa-user"></i> My Profile</a>
                    <div class="divider"></div>
                    <button onclick="auth.logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
                </div>
            </div>
        `;

        // Load notification count
        loadNotificationCount();
    } else {
        navbarMenu.innerHTML = `
            <a href="events.html"><i class="fas fa-calendar-alt"></i> Events</a>
        `;
        navbarUser.innerHTML = `
            <a href="login.html" class="btn btn-outline btn-sm">Login</a>
            <a href="register.html" class="btn btn-primary btn-sm">Register</a>
        `;
    }

    // Highlight active page
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.navbar-menu a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Toggle user dropdown menu
function toggleUserMenu() {
    const menu = document.getElementById('userDropdownMenu');
    menu.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.user-dropdown');
    const menu = document.getElementById('userDropdownMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.classList.remove('show');
    }
});

// Toggle mobile menu
function toggleMobileMenu() {
    const menu = document.getElementById('navbarMenu');
    menu.classList.toggle('show');
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    updateNavbar();
});

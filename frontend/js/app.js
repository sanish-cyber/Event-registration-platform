// frontend/js/app.js

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Modal functions
function showModal(title, content) {
    let backdrop = document.getElementById('modalBackdrop');
    
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'modalBackdrop';
        backdrop.className = 'modal-backdrop';
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeModal();
        };
        document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title">${escapeHtml(title)}</h3>
                <button class="modal-close" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;

    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) {
        backdrop.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// Notifications panel
let notificationsData = [];

async function loadNotificationCount() {
    if (!auth.isLoggedIn()) return;

    try {
        const { count } = await api.notifications.getUnreadCount();
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    } catch (error) {
        console.error('Error loading notification count:', error);
    }
}

async function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel') || createNotificationsPanel();
    
    if (panel.classList.contains('show')) {
        panel.classList.remove('show');
        return;
    }

    panel.classList.add('show');
    await loadNotifications();
}

function createNotificationsPanel() {
    const panel = document.createElement('div');
    panel.id = 'notificationsPanel';
    panel.className = 'notifications-panel';
    panel.innerHTML = `
        <div class="notifications-header">
            <h4>Notifications</h4>
            <button class="btn btn-sm btn-secondary" onclick="markAllNotificationsRead()">Mark all read</button>
        </div>
        <div class="notifications-list" id="notificationsList">
            <div class="loading"><div class="spinner"></div></div>
        </div>
    `;
    document.body.appendChild(panel);

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !e.target.closest('.notification-btn')) {
            panel.classList.remove('show');
        }
    });

    return panel;
}

async function loadNotifications() {
    const list = document.getElementById('notificationsList');
    if (!list) return;

    try {
        notificationsData = await api.notifications.getAll();

        if (notificationsData.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <div class="empty-state-icon"><i class="fas fa-bell-slash"></i></div>
                    <h3>No notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = notificationsData.map(notif => `
            <div class="notification-item ${notif.is_read ? '' : 'unread'}" onclick="markNotificationRead(${notif.id})">
                <div class="notification-icon ${notif.type}">
                    <i class="fas fa-${notif.type === 'success' ? 'check' : notif.type === 'warning' ? 'exclamation' : notif.type === 'event' ? 'calendar' : 'info'}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${escapeHtml(notif.title)}</div>
                    <div class="notification-message">${escapeHtml(notif.message)}</div>
                    <div class="notification-time">${formatTimeAgo(notif.created_at)}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading notifications:', error);
        list.innerHTML = '<p class="text-center text-muted">Failed to load notifications</p>';
    }
}

async function markNotificationRead(id) {
    try {
        await api.notifications.markAsRead(id);
        loadNotificationCount();
        loadNotifications();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        await api.notifications.markAllAsRead();
        loadNotificationCount();
        loadNotifications();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        showToast('Failed to update notifications', 'error');
    }
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
}

// Form validation
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;

    let isValid = true;
    const inputs = form.querySelectorAll('[required]');

    inputs.forEach(input => {
        const errorEl = input.parentElement.querySelector('.form-error');
        
        if (!input.value.trim()) {
            input.classList.add('error');
            if (errorEl) errorEl.textContent = 'This field is required';
            isValid = false;
        } else if (input.type === 'email' && !isValidEmail(input.value)) {
            input.classList.add('error');
            if (errorEl) errorEl.textContent = 'Please enter a valid email';
            isValid = false;
        } else {
            input.classList.remove('error');
            if (errorEl) errorEl.textContent = '';
        }
    });

    return isValid;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Initialize tooltips and other UI elements
document.addEventListener('DOMContentLoaded', () => {
    // Add smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Handle form validation on input
    document.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.classList.remove('error');
                const errorEl = this.parentElement.querySelector('.form-error');
                if (errorEl) errorEl.textContent = '';
            }
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
    gsap.from(".navbar", {
        y: -50,
        opacity: 0,
        duration: 0.8
    });

    gsap.from(".event-card", {
        opacity: 0,
        y: 50,
        duration: 0.6,
        stagger: 0.2
    });
});

// GSAP animations (safe guard — only run if GSAP is available)
document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') return;
    try {
        gsap.utils.toArray('.event-card').forEach(card => {
            gsap.from(card, {
                scrollTrigger: card,
                opacity: 0,
                y: 50,
                duration: 0.6
            });
        });

        gsap.from('.hero-title', { y: 100, opacity: 0, duration: 1 });
        gsap.from('.hero-subtitle', { y: 100, opacity: 0, delay: 0.3, duration: 1 });
        gsap.to('.hero', {
            backgroundPosition: '50% 100%',
            scrollTrigger: { trigger: '.hero', scrub: true }
        });
        gsap.from('.navbar', { y: -80, opacity: 0, duration: 0.8 });
    } catch(e) { /* GSAP not available or ScrollTrigger missing */ }
});

// 3D Aesthetics Injection
function injectScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function init3DEffects() {
    // 1. Inject Three.js and Vanta.js
    injectScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js')
        .then(() => injectScript('https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.net.min.js'))
        .then(() => {
            if (window.VANTA) {
                // Create a fixed background div to prevent Vanta from causing scrollbar jitter
                let vantaBg = document.getElementById('vanta-bg');
                if (!vantaBg) {
                    vantaBg = document.createElement('div');
                    vantaBg.id = 'vanta-bg';
                    Object.assign(vantaBg.style, {
                        position: 'fixed',
                        zIndex: '-1',
                        top: '0',
                        left: '0',
                        width: '100vw',
                        height: '100vh'
                    });
                    document.body.insertBefore(vantaBg, document.body.firstChild);
                }

                // Ensure body has no background image that hides vanta
                document.body.style.backgroundImage = 'none';
                document.body.style.backgroundColor = 'transparent';
                
                VANTA.NET({
                    el: "#vanta-bg",
                    mouseControls: true,
                    touchControls: true,
                    gyroControls: false,
                    minHeight: 200.00,
                    minWidth: 200.00,
                    scale: 1.00,
                    scaleMobile: 1.00,
                    color: 0x3b82f6, // primary color
                    backgroundColor: 0x0f172a, // gray-900
                    points: 12.00,
                    maxDistance: 20.00,
                    spacing: 18.00
                });
            }
        }).catch(err => console.error("Failed to load Vanta.js", err));

    // 2. Inject Vanilla Tilt
    injectScript('https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js')
        .then(() => {
            if (window.VanillaTilt) {
                const initTilt = () => {
                    VanillaTilt.init(document.querySelectorAll(".card, .stat-card, .event-card, .auth-card"), {
                        max: 10,
                        speed: 400,
                        glare: true,
                        "max-glare": 0.15,
                        scale: 1.02
                    });
                };
                
                // Initialize right away
                initTilt();
                
                // Also initialize occasionally in case things are loaded dynamically
                setInterval(initTilt, 2000); 
            }
        }).catch(err => console.error("Failed to load VanillaTilt", err));
}

document.addEventListener("DOMContentLoaded", init3DEffects);
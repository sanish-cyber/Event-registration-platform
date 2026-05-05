// frontend/js/dashboard.js

// Load user dashboard
async function loadDashboard() {
    if (!auth.requireAuth()) return;

    const user = auth.getUser();
    
    // Update welcome message
    const welcomeElement = document.getElementById('welcomeMessage');
    if (welcomeElement) {
        welcomeElement.textContent = `Welcome back, ${user.firstName}!`;
    }

    // Update role badge
    const roleElement = document.getElementById('userRole');
    if (roleElement) {
        roleElement.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        roleElement.className = `badge badge-${user.role === 'admin' ? 'danger' : user.role === 'organizer' ? 'primary' : 'success'}`;
    }

    // Load content based on role
    if (user.role === 'attendee') {
        await loadAttendeeDashboard();
    } else if (user.role === 'organizer') {
        await loadOrganizerDashboard();
    } else if (user.role === 'admin') {
        await loadAdminDashboardPreview();
    }
}

// Attendee Dashboard
async function loadAttendeeDashboard() {
    // Load user's registrations
    try {
        const registrations = await api.registrations.getMyRegistrations();
        
        const upcomingEvents = registrations.filter(
            r => r.status === 'registered' && new Date(r.event_date) >= new Date().setHours(0, 0, 0, 0)
        );
        const pastEvents = registrations.filter(
            r => r.status === 'registered' && new Date(r.event_date) < new Date().setHours(0, 0, 0, 0)
        );

        // Update stats
        document.getElementById('upcomingCount').textContent = upcomingEvents.length;
        document.getElementById('pastCount').textContent = pastEvents.length;
        document.getElementById('totalCount').textContent = registrations.length;

        // Load upcoming events
        const upcomingContainer = document.getElementById('upcomingEventsContainer');
        if (upcomingContainer) {
            if (upcomingEvents.length === 0) {
                upcomingContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fas fa-calendar-check"></i></div>
                        <h3>No upcoming events</h3>
                        <p>You haven't registered for any upcoming events yet.</p>
                        <a href="events.html" class="btn btn-primary">Browse Events</a>
                    </div>
                `;
            } else {
                upcomingContainer.innerHTML = upcomingEvents.map(reg => {
                    const bgOverlay = reg.image_url 
                        ? `background: linear-gradient(to right, rgba(15,23,42,0.95) 20%, rgba(15,23,42,0.6) 100%), url('${reg.image_url}'); background-size: cover; background-position: center; color: white; border: none;`
                        : ``;
                    return `
                    <div class="card" style="margin-bottom: 1rem; ${bgOverlay}">
                        <div class="card-body d-flex align-center justify-between" style="flex-wrap: wrap; gap: 1rem; position: relative; z-index: 1;">
                            <div>
                                <h4>${escapeHtml(reg.title)}</h4>
                                <p class="text-muted">
                                    <i class="fas fa-calendar"></i> ${eventUtils.formatDate(reg.event_date)} at ${eventUtils.formatTime(reg.start_time)}
                                    <br>
                                    <i class="fas fa-map-marker-alt"></i> ${escapeHtml(reg.location)}
                                </p>
                            </div>
                            <div class="d-flex gap-1">
                                <a href="event-details.html?id=${reg.event_id}" class="btn btn-sm btn-secondary">View</a>
                                <button class="btn btn-sm btn-danger" onclick="cancelDashboardRegistration(${reg.event_id})">Cancel</button>
                            </div>
                        </div>
                    </div>
                `}).join('');
            }
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

// Organizer Dashboard
async function loadOrganizerDashboard() {
    try {
        const events = await api.events.getMyEvents();
        
        const upcomingEvents = events.filter(e => new Date(e.event_date) >= new Date().setHours(0, 0, 0, 0));
        const totalRegistrations = events.reduce((sum, e) => sum + (e.registered_count || 0), 0);

        // Update stats
        document.getElementById('myEventsCount').textContent = events.length;
        document.getElementById('upcomingOrgCount').textContent = upcomingEvents.length;
        document.getElementById('totalRegCount').textContent = totalRegistrations;

        // Load recent events
        const recentContainer = document.getElementById('recentEventsContainer');
        if (recentContainer) {
            if (events.length === 0) {
                recentContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fas fa-calendar-plus"></i></div>
                        <h3>No events created</h3>
                        <p>Start by creating your first event!</p>
                        <a href="manage-events.html" class="btn btn-primary">Create Event</a>
                    </div>
                `;
            } else {
                recentContainer.innerHTML = events.slice(0, 5).map(event => {
                    const bgOverlay = event.image_url 
                        ? `background: linear-gradient(to right, rgba(15,23,42,0.95) 20%, rgba(15,23,42,0.6) 100%), url('${event.image_url}'); background-size: cover; background-position: center; color: white; border: none;`
                        : ``;
                    return `
                    <div class="card" style="margin-bottom: 1rem; ${bgOverlay}">
                        <div class="card-body d-flex align-center justify-between" style="flex-wrap: wrap; gap: 1rem; position: relative; z-index: 1;">
                            <div>
                                <h4>${escapeHtml(event.title)}</h4>
                                <p class="text-muted">
                                    <i class="fas fa-calendar"></i> ${eventUtils.formatDate(event.event_date)}
                                    <span class="badge badge-info">${event.registered_count || 0} registered</span>
                                </p>
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-secondary" onclick="viewAttendees(${event.id})">Attendees</button>
                                <a href="manage-events.html?edit=${event.id}" class="btn btn-sm btn-primary">Edit</a>
                            </div>
                        </div>
                    </div>
                `}).join('');
            }
        }
    } catch (error) {
        console.error('Error loading organizer dashboard:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

// Admin Dashboard Preview
async function loadAdminDashboardPreview() {
    try {
        const stats = await api.admin.getStats();

        // Update stats
        document.getElementById('totalUsersCount').textContent = stats.users.total_users;
        document.getElementById('totalEventsCount').textContent = stats.events.total_events;
        document.getElementById('totalRegistrationsCount').textContent = stats.events.total_registrations || 0;
        document.getElementById('upcomingEventsAdminCount').textContent = stats.events.upcoming_events;

        // Load popular events
        const popularContainer = document.getElementById('popularEventsContainer');
        if (popularContainer && stats.popularEvents) {
            popularContainer.innerHTML = stats.popularEvents.map(event => `
                <div class="d-flex align-center justify-between" style="padding: 0.75rem 0; border-bottom: 1px solid var(--gray-200);">
                    <div>
                        <strong>${escapeHtml(event.title)}</strong>
                        <div class="progress" style="width: 150px; margin-top: 0.25rem;">
                            <div class="progress-bar" style="width: ${event.fill_percentage}%"></div>
                        </div>
                    </div>
                    <span class="text-muted">${event.current_attendees}/${event.max_attendees}</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

// View attendees modal
async function viewAttendees(eventId) {
    try {
        const attendees = await api.events.getAttendees(eventId);
        
        let content = '';
        if (attendees.length === 0) {
            content = '<p class="text-center text-muted">No attendees yet</p>';
        } else {
            content = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Registered</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${attendees.map(a => `
                            <tr>
                                <td>${escapeHtml(a.first_name)} ${escapeHtml(a.last_name)}</td>
                                <td>${escapeHtml(a.email)}</td>
                                <td>${new Date(a.registration_date).toLocaleDateString()}</td>
                                <td><span class="badge badge-${a.status === 'registered' ? 'success' : 'warning'}">${a.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        showModal('Event Attendees', content);
    } catch (error) {
        showToast('Failed to load attendees', 'error');
    }
}

// Cancel registration from dashboard
function cancelDashboardRegistration(eventId) {
    const modalContent = `
        <div style="text-align:center; padding: 1rem 0;">
            <div style="font-size:3rem; margin-bottom:1rem;">⚠️</div>
            <p style="color:#94a3b8; margin-bottom:1.5rem;">Are you sure you want to cancel your registration for this event?</p>
            <div style="display:flex; gap:0.75rem; justify-content:center;">
                <button class="btn btn-secondary" onclick="closeModal()">Keep Registration</button>
                <button class="btn btn-danger" onclick="confirmCancelRegistration(${eventId})">
                    <i class="fas fa-times"></i> Yes, Cancel It
                </button>
            </div>
        </div>
    `;
    showModal('Cancel Registration', modalContent);
}

async function confirmCancelRegistration(eventId) {
    closeModal();
    try {
        await api.registrations.cancel(eventId);
        showToast('Registration cancelled successfully', 'success');
        await loadAttendeeDashboard();
    } catch (error) {
        showToast(error.message || 'Failed to cancel registration', 'error');
    }
}

// Profile management
async function loadProfile() {
    try {
        const profile = await api.auth.getProfile();
        
        document.getElementById('profileFirstName').value = profile.first_name;
        document.getElementById('profileLastName').value = profile.last_name;
        document.getElementById('profileEmail').value = profile.email;
        document.getElementById('profilePhone').value = profile.phone || '';
        document.getElementById('profileDepartment').value = profile.department || '';
    } catch (error) {
        showToast('Failed to load profile', 'error');
    }
}

async function updateProfile(event) {
    event.preventDefault();
    
    const data = {
        firstName: document.getElementById('profileFirstName').value,
        lastName: document.getElementById('profileLastName').value,
        phone: document.getElementById('profilePhone').value,
        department: document.getElementById('profileDepartment').value
    };

    try {
        await api.auth.updateProfile(data);
        
        // Update local storage
        const user = auth.getUser();
        user.firstName = data.firstName;
        user.lastName = data.lastName;
        localStorage.setItem('user', JSON.stringify(user));
        
        showToast('Profile updated successfully', 'success');
        updateNavbar();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        await api.auth.changePassword(currentPassword, newPassword);
        showToast('Password changed successfully', 'success');
        event.target.reset();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

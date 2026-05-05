// frontend/js/admin.js

// Admin panel functions
async function loadAdminPanel() {
    if (!auth.requireRole('admin')) return;

    await loadAdminStats();
    await loadUsersTable();
}

// Load admin statistics
async function loadAdminStats() {
    try {
        const stats = await api.admin.getStats();

        // Update stat cards
        document.getElementById('statTotalUsers').textContent = stats.users.total_users;
        document.getElementById('statTotalEvents').textContent = stats.events.total_events;
        document.getElementById('statTotalRegistrations').textContent = stats.events.total_registrations || 0;
        document.getElementById('statUpcomingEvents').textContent = stats.events.upcoming_events;

        // User breakdown
        document.getElementById('statAttendees').textContent = stats.users.attendees || 0;
        document.getElementById('statOrganizers').textContent = stats.users.organizers || 0;
        document.getElementById('statAdmins').textContent = stats.users.admins || 0;

        // Category chart (simple display)
        const categoryContainer = document.getElementById('categoryStats');
        if (categoryContainer && stats.categories) {
            categoryContainer.innerHTML = stats.categories.map(cat => `
                <div class="d-flex align-center justify-between" style="padding: 0.5rem 0;">
                    <span style="text-transform: capitalize;">${cat.category}</span>
                    <span class="badge badge-primary">${cat.count}</span>
                </div>
            `).join('');
        }

        // Recent registrations
        const recentRegContainer = document.getElementById('recentRegistrations');
        if (recentRegContainer && stats.recentRegistrations) {
            recentRegContainer.innerHTML = stats.recentRegistrations.map(reg => `
                <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--gray-200);">
                    <strong>${escapeHtml(reg.first_name)} ${escapeHtml(reg.last_name)}</strong>
                    <span class="text-muted"> registered for </span>
                    <strong>${escapeHtml(reg.event_title)}</strong>
                    <div class="text-muted" style="font-size: 0.8rem;">
                        ${new Date(reg.registration_date).toLocaleString()}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
        showToast('Failed to load statistics', 'error');
    }
}

// Load users table
async function loadUsersTable() {
    const container = document.getElementById('usersTableContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const users = await api.admin.getUsers();

        container.innerHTML = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</td>
                                <td>${escapeHtml(user.email)}</td>
                                <td>
                                    <select class="form-control" style="width: auto; padding: 0.25rem 0.5rem;" 
                                            onchange="updateUserRole(${user.id}, this.value)"
                                            ${user.id === auth.getUser().id ? 'disabled' : ''}>
                                        <option value="attendee" ${user.role === 'attendee' ? 'selected' : ''}>Attendee</option>
                                        <option value="organizer" ${user.role === 'organizer' ? 'selected' : ''}>Organizer</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </td>
                                <td>${escapeHtml(user.department || '-')}</td>
                                <td>
                                    <span class="badge badge-${user.is_active ? 'success' : 'danger'}">
                                        ${user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                <td class="table-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="toggleUserStatus(${user.id}, ${!user.is_active})"
                                            ${user.id === auth.getUser().id ? 'disabled' : ''}>
                                        ${user.is_active ? 'Disable' : 'Enable'}
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})"
                                            ${user.id === auth.getUser().id ? 'disabled' : ''}>
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>Failed to load users</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="loadUsersTable()">Retry</button>
            </div>
        `;
    }
}

// Update user role
async function updateUserRole(userId, role) {
    try {
        await api.admin.updateUserRole(userId, role);
        showToast('User role updated successfully', 'success');
    } catch (error) {
        showToast(error.message, 'error');
        loadUsersTable(); // Refresh to revert select
    }
}

// Toggle user status
async function toggleUserStatus(userId, isActive) {
    try {
        await api.admin.toggleUserStatus(userId, isActive);
        showToast(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
        loadUsersTable();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
        await api.admin.deleteUser(userId);
        showToast('User deleted successfully', 'success');
        loadUsersTable();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Show create user modal
function showCreateUserModal() {
    const content = `
        <form id="createUserForm" onsubmit="createUser(event)">
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="newUserEmail" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" id="newUserPassword" required minlength="6">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">First Name</label>
                    <input type="text" class="form-control" id="newUserFirstName" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Last Name</label>
                    <input type="text" class="form-control" id="newUserLastName" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Role</label>
                <select class="form-control" id="newUserRole">
                    <option value="attendee">Attendee</option>
                    <option value="organizer">Organizer</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Department</label>
                <input type="text" class="form-control" id="newUserDepartment">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Create User</button>
        </form>
    `;

    showModal('Create New User', content);
}

// Create user
async function createUser(event) {
    event.preventDefault();

    const userData = {
        email: document.getElementById('newUserEmail').value,
        password: document.getElementById('newUserPassword').value,
        firstName: document.getElementById('newUserFirstName').value,
        lastName: document.getElementById('newUserLastName').value,
        role: document.getElementById('newUserRole').value,
        department: document.getElementById('newUserDepartment').value
    };

    try {
        await api.admin.createUser(userData);
        showToast('User created successfully', 'success');
        closeModal();
        loadUsersTable();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Send notification modal
function showSendNotificationModal() {
    const content = `
        <form id="sendNotificationForm" onsubmit="sendNotification(event)">
            <div class="form-group">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" id="notifTitle" required>
            </div>
            <div class="form-group">
                <label class="form-label">Message</label>
                <textarea class="form-control" id="notifMessage" required rows="3"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Type</label>
                <select class="form-control" id="notifType">
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="event">Event</option>
                </select>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="notifSendToAll" checked> Send to all users
                </label>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Send Notification</button>
        </form>
    `;

    showModal('Send Notification', content);
}

// Send notification
async function sendNotification(event) {
    event.preventDefault();

    const data = {
        title: document.getElementById('notifTitle').value,
        message: document.getElementById('notifMessage').value,
        type: document.getElementById('notifType').value,
        sendToAll: document.getElementById('notifSendToAll').checked
    };

    try {
        await api.notifications.send(data);
        showToast('Notification sent successfully', 'success');
        closeModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Generate report
async function generateReport(type) {
    const startDate = document.getElementById('reportStartDate')?.value || '';
    const endDate = document.getElementById('reportEndDate')?.value || '';

    try {
        const data = await api.admin.getReport(type, startDate, endDate);
        
        // Display report in modal
        let content = '';
        
        if (data.length === 0) {
            content = '<p class="text-center text-muted">No data found for the selected period</p>';
        } else {
            // Convert to CSV for download
            const headers = Object.keys(data[0]);
            const csv = [
                headers.join(','),
                ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            content = `
                <p>Found ${data.length} records</p>
                <a href="${url}" download="${type}-report.csv" class="btn btn-primary">
                    <i class="fas fa-download"></i> Download CSV
                </a>
            `;
        }

        showModal(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`, content);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// frontend/js/api.js

const API_BASE_URL = 'http://localhost:3000/api';

// API utility functions
const api = {
    // Get auth token
    getToken() {
        return localStorage.getItem('token');
    },

    // Set auth headers
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (includeAuth && this.getToken()) {
            headers['Authorization'] = `Bearer ${this.getToken()}`;
        }
        return headers;
    },

    // Handle response
    async handleResponse(response) {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Something went wrong');
        }
        return data;
    },

    // Auth endpoints
    auth: {
        async login(email, password) {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: api.getHeaders(false),
                body: JSON.stringify({ email, password })
            });
            return api.handleResponse(response);
        },

        async register(userData) {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: api.getHeaders(false),
                body: JSON.stringify(userData)
            });
            return api.handleResponse(response);
        },

        async getProfile() {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async updateProfile(data) {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify(data)
            });
            return api.handleResponse(response);
        },

        async changePassword(currentPassword, newPassword) {
            const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify({ currentPassword, newPassword })
            });
            return api.handleResponse(response);
        }
    },

    // Events endpoints
    events: {
        async getAll(params = {}) {
            const query = new URLSearchParams(params).toString();
            const response = await fetch(`${API_BASE_URL}/events?${query}`, {
                headers: api.getHeaders(false)
            });
            return api.handleResponse(response);
        },

        async getById(id) {
            const response = await fetch(`${API_BASE_URL}/events/${id}`, {
                headers: api.getHeaders(false)
            });
            return api.handleResponse(response);
        },

        async create(eventData) {
            const response = await fetch(`${API_BASE_URL}/events`, {
                method: 'POST',
                headers: api.getHeaders(),
                body: JSON.stringify(eventData)
            });
            return api.handleResponse(response);
        },

        async update(id, eventData) {
            const response = await fetch(`${API_BASE_URL}/events/${id}`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify(eventData)
            });
            return api.handleResponse(response);
        },

        async delete(id) {
            const response = await fetch(`${API_BASE_URL}/events/${id}`, {
                method: 'DELETE',
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async getMyEvents() {
            const response = await fetch(`${API_BASE_URL}/events/organizer/my-events`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async getAttendees(eventId) {
            const response = await fetch(`${API_BASE_URL}/events/${eventId}/attendees`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        }
    },

    // Registrations endpoints
    registrations: {
        async register(eventId) {
            const response = await fetch(`${API_BASE_URL}/registrations/${eventId}`, {
                method: 'POST',
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async cancel(eventId) {
            const response = await fetch(`${API_BASE_URL}/registrations/${eventId}`, {
                method: 'DELETE',
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async getMyRegistrations() {
            const response = await fetch(`${API_BASE_URL}/registrations/my-registrations`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async checkRegistration(eventId) {
            const response = await fetch(`${API_BASE_URL}/registrations/check/${eventId}`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        }
    },

    // Admin endpoints
    admin: {
        async getUsers() {
            const response = await fetch(`${API_BASE_URL}/admin/users`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async createUser(userData) {
            const response = await fetch(`${API_BASE_URL}/admin/users`, {
                method: 'POST',
                headers: api.getHeaders(),
                body: JSON.stringify(userData)
            });
            return api.handleResponse(response);
        },

        async updateUserRole(userId, role) {
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify({ role })
            });
            return api.handleResponse(response);
        },

        async toggleUserStatus(userId, isActive) {
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify({ isActive })
            });
            return api.handleResponse(response);
        },

        async deleteUser(userId) {
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async getStats() {
            const response = await fetch(`${API_BASE_URL}/admin/stats`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async getReport(type, startDate, endDate) {
            const params = new URLSearchParams({ startDate, endDate }).toString();
            const response = await fetch(`${API_BASE_URL}/admin/reports/${type}?${params}`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        }
    },

    // Notifications endpoints
    notifications: {
        async getAll() {
            const response = await fetch(`${API_BASE_URL}/notifications`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async markAsRead(id) {
            const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
                method: 'PUT',
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async markAllAsRead() {
            const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
                method: 'PUT',
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async getUnreadCount() {
            const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        },

        async send(data) {
            const response = await fetch(`${API_BASE_URL}/notifications/send`, {
                method: 'POST',
                headers: api.getHeaders(),
                body: JSON.stringify(data)
            });
            return api.handleResponse(response);
        }
    },

    // Payments endpoints
    payments: {
        async uploadQr(eventId, { isPaid, price, paymentQr }) {
            const response = await fetch(`${API_BASE_URL}/payments/event/${eventId}/qr`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify({ isPaid, price, paymentQr })
            });
            return api.handleResponse(response);
        },

        async confirmPayment(eventId, transactionNote) {
            const response = await fetch(`${API_BASE_URL}/payments/confirm/${eventId}`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify({ transactionNote })
            });
            return api.handleResponse(response);
        },

        async verifyPayment(registrationId, action) {
            const response = await fetch(`${API_BASE_URL}/payments/verify/${registrationId}`, {
                method: 'PUT',
                headers: api.getHeaders(),
                body: JSON.stringify({ action })
            });
            return api.handleResponse(response);
        },

        async getPendingPayments() {
            const response = await fetch(`${API_BASE_URL}/payments/pending`, {
                headers: api.getHeaders()
            });
            return api.handleResponse(response);
        }
    }
};


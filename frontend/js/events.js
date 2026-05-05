// frontend/js/events.js

// Event utilities
const eventUtils = {
    // Format date
    formatDate(dateString) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    },

    // Format time
    formatTime(timeString) {
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    },

    // Get category icon
    getCategoryIcon(category) {
        const icons = {
            academic: 'fa-graduation-cap',
            cultural: 'fa-music',
            sports: 'fa-football-ball',
            workshop: 'fa-tools',
            seminar: 'fa-chalkboard-teacher',
            other: 'fa-star'
        };
        return icons[category] || icons.other;
    },

    // Get category color
    getCategoryColor(category) {
        const colors = {
            academic: '#6366f1',
            cultural: '#ec4899',
            sports: '#10b981',
            workshop: '#f59e0b',
            seminar: '#3b82f6',
            other: '#6b7280'
        };
        return colors[category] || colors.other;
    },

    // Check if event is past
    isPastEvent(eventDate) {
        return new Date(eventDate) < new Date().setHours(0, 0, 0, 0);
    },

    // Check if event is full
    isEventFull(currentAttendees, maxAttendees) {
        return currentAttendees >= maxAttendees;
    }
};

// Create event card HTML
function createEventCard(event, showActions = true) {
    const isPast = eventUtils.isPastEvent(event.event_date);
    const isFull = eventUtils.isEventFull(event.current_attendees, event.max_attendees);
    const availableSpots = event.max_attendees - event.current_attendees;

    const bgStyle = event.image_url 
        ? `background: linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.4) 100%), url('${event.image_url}'); background-size: cover; background-position: center;`
        : `background: linear-gradient(135deg, ${eventUtils.getCategoryColor(event.category)} 0%, ${eventUtils.getCategoryColor(event.category)}dd 100%);`;

    return `
        <div class="card event-card" data-event-id="${event.id}">
            <div class="event-card-image" style="${bgStyle}">
                <i class="fas ${eventUtils.getCategoryIcon(event.category)}"></i>
                <span class="event-card-category">${event.category}</span>
            </div>
            <div class="event-card-body">
                <h3 class="event-card-title">${escapeHtml(event.title)}</h3>
                <p class="event-card-description">${escapeHtml(event.description || 'No description available')}</p>
                <div class="event-card-meta">
                    <div class="event-card-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${eventUtils.formatDate(event.event_date)}</span>
                    </div>
                    <div class="event-card-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${eventUtils.formatTime(event.start_time)} - ${eventUtils.formatTime(event.end_time)}</span>
                    </div>
                    <div class="event-card-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(event.location)}</span>
                    </div>
                </div>
                <div class="event-card-footer">
                    <span class="event-card-spots ${isFull ? 'full' : ''}">
                        ${isFull ? 'Event Full' : `${availableSpots} spots left`}
                    </span>
                    ${showActions ? `
                        <a href="event-details.html?id=${event.id}" class="btn btn-sm ${isPast ? 'btn-secondary' : 'btn-primary'}">
                            ${isPast ? 'View Details' : 'Learn More'}
                        </a>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Load events with filters
async function loadEvents(containerId, params = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const events = await api.events.getAll(params);
        
        if (events.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-calendar-times"></i></div>
                    <h3>No events found</h3>
                    <p>Check back later for upcoming events!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = events.map(event => createEventCard(event)).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>Failed to load events</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="loadEvents('${containerId}')">Retry</button>
            </div>
        `;
    }
}

// Load event details
async function loadEventDetails(eventId) {
    const container = document.getElementById('eventDetailsContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const event = await api.events.getById(eventId);
        const isPast = eventUtils.isPastEvent(event.event_date);
        const isFull = eventUtils.isEventFull(event.current_attendees, event.max_attendees);

        let registrationButton = '';
        
        if (auth.isLoggedIn() && !isPast) {
            const { isRegistered } = await api.registrations.checkRegistration(eventId);
            
            if (isRegistered) {
                registrationButton = `
                    <button class="btn btn-danger btn-lg btn-block" onclick="cancelRegistration(${eventId})">
                        <i class="fas fa-times"></i> Cancel Registration
                    </button>
                `;
            } else if (!isFull) {
                registrationButton = `
                    <button class="btn btn-success btn-lg btn-block" onclick="registerForEvent(${eventId})">
                        <i class="fas fa-check"></i> Register Now
                    </button>
                `;
            } else {
                registrationButton = `
                    <button class="btn btn-secondary btn-lg btn-block" disabled>
                        <i class="fas fa-ban"></i> Event Full
                    </button>
                `;
            }
        } else if (!auth.isLoggedIn() && !isPast) {
            registrationButton = `
                <a href="login.html" class="btn btn-primary btn-lg btn-block">
                    <i class="fas fa-sign-in-alt"></i> Login to Register
                </a>
            `;
        }

        const bgStyle = event.image_url 
            ? `height: 250px; background: linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.4) 100%), url('${event.image_url}'); background-size: cover; background-position: center;`
            : `height: 250px; background: linear-gradient(135deg, ${eventUtils.getCategoryColor(event.category)} 0%, ${eventUtils.getCategoryColor(event.category)}dd 100%);`;

        container.innerHTML = `
            <div class="card">
                <div class="event-card-image" style="${bgStyle}">
                    <i class="fas ${eventUtils.getCategoryIcon(event.category)}" style="font-size: 5rem;"></i>
                    <span class="event-card-category">${event.category}</span>
                </div>
                <div class="card-body">
                    <h1 class="mb-2">${escapeHtml(event.title)}</h1>
                    
                    <div class="d-flex gap-2 mb-3" style="flex-wrap: wrap;">
                        ${isPast ? '<span class="badge badge-warning">Past Event</span>' : ''}
                        ${isFull ? '<span class="badge badge-danger">Full</span>' : ''}
                    </div>

                    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 2rem;">
                        <div class="stat-card">
                            <div class="stat-card-icon blue"><i class="fas fa-calendar"></i></div>
                            <div class="stat-card-content">
                                <p>Date</p>
                                <h3 style="font-size: 1rem;">${eventUtils.formatDate(event.event_date)}</h3>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-card-icon green"><i class="fas fa-clock"></i></div>
                            <div class="stat-card-content">
                                <p>Time</p>
                                <h3 style="font-size: 1rem;">${eventUtils.formatTime(event.start_time)} - ${eventUtils.formatTime(event.end_time)}</h3>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-card-icon purple"><i class="fas fa-map-marker-alt"></i></div>
                            <div class="stat-card-content">
                                <p>Location</p>
                                <h3 style="font-size: 1rem;">${escapeHtml(event.location)}</h3>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-card-icon orange"><i class="fas fa-users"></i></div>
                            <div class="stat-card-content">
                                <p>Attendees</p>
                                <h3 style="font-size: 1rem;">${event.current_attendees} / ${event.max_attendees}</h3>
                            </div>
                        </div>
                    </div>

                    <h4 class="mb-2">About This Event</h4>
                    <p class="text-muted mb-3">${escapeHtml(event.description || 'No description provided.')}</p>

                    <h4 class="mb-2">Organizer</h4>
                    <p class="text-muted mb-3">
                        ${escapeHtml(event.organizer_first_name)} ${escapeHtml(event.organizer_last_name)}
                        ${event.organizer_department ? ` - ${escapeHtml(event.organizer_department)}` : ''}
                    </p>

                    <div class="progress mb-2">
                        <div class="progress-bar ${event.current_attendees / event.max_attendees > 0.8 ? 'warning' : ''}" 
                             style="width: ${(event.current_attendees / event.max_attendees) * 100}%"></div>
                    </div>
                    <p class="text-muted text-center mb-3">
                        ${event.max_attendees - event.current_attendees} spots remaining
                    </p>

                    ${registrationButton}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading event details:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>Event not found</h3>
                <p>${error.message}</p>
                <a href="events.html" class="btn btn-primary">Back to Events</a>
            </div>
        `;
    }
}

// Register for event
async function registerForEvent(eventId) {
    if (!auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    try {
        await api.registrations.register(eventId);
        showToast('Successfully registered for the event!', 'success');
        loadEventDetails(eventId);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Cancel registration
async function cancelRegistration(eventId) {
    if (!confirm('Are you sure you want to cancel your registration?')) return;

    try {
        await api.registrations.cancel(eventId);
        showToast('Registration cancelled successfully', 'success');
        loadEventDetails(eventId);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

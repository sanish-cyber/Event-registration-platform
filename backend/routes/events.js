// backend/routes/events.js
console.log('events loaded');

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, isOrganizerOrAdmin } = require('../middleware/auth');

// Get all active events (public)
router.get('/', async (req, res) => {
    try {
        const { category, search, date, upcoming } = req.query;
        
        let query = `
            SELECT e.*, u.first_name as organizer_first_name, u.last_name as organizer_last_name,
                   (e.max_attendees - e.current_attendees) as available_spots
            FROM events e
            JOIN users u ON e.organizer_id = u.id
            WHERE e.is_active = TRUE
        `;
        const params = [];

        if (category && category !== 'all') {
            query += ' AND e.category = ?';
            params.push(category);
        }

        if (search) {
            query += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (date) {
            query += ' AND e.event_date = ?';
            params.push(date);
        }

        if (upcoming === 'true') {
            query += ' AND e.event_date >= CURDATE()';
        }

        query += ' ORDER BY e.event_date ASC, e.start_time ASC';

        const [events] = await pool.query(query, params);
        res.json(events);
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get single event by ID
router.get('/:id', async (req, res) => {
    try {
        const [events] = await pool.query(
            `SELECT e.*, u.first_name as organizer_first_name, u.last_name as organizer_last_name,
                    u.email as organizer_email, u.department as organizer_department,
                    (e.max_attendees - e.current_attendees) as available_spots
             FROM events e
             JOIN users u ON e.organizer_id = u.id
             WHERE e.id = ?`,
            [req.params.id]
        );

        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json(events[0]);
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Create new event (organizer/admin only)
router.post('/', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        const { title, description, eventDate, startTime, endTime, location, category, maxAttendees, imageUrl, isPaid, price, paymentQr } = req.body;

        if (!title || !eventDate || !startTime || !endTime || !location) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const [result] = await pool.query(
            `INSERT INTO events (title, description, event_date, start_time, end_time, location, category, max_attendees, organizer_id, image_url, is_paid, price, payment_qr)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, eventDate, startTime, endTime, location, category || 'other', maxAttendees || 100, req.user.id, imageUrl, isPaid ? 1 : 0, price || 0, paymentQr || null]
        );

        // Send notification to all users about new event
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type)
             SELECT id, 'New Event!', ?, 'event' FROM users WHERE role = 'attendee'`,
            [`Check out the new event: ${title}`]
        );

        res.status(201).json({ 
            message: 'Event created successfully',
            eventId: result.insertId 
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Update event (organizer who created it or admin)
router.put('/:id', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        const { title, description, eventDate, startTime, endTime, location, category, maxAttendees, imageUrl, isActive, isPaid, price, paymentQr } = req.body;

        // Check if user owns this event or is admin
        const [events] = await pool.query('SELECT organizer_id FROM events WHERE id = ?', [req.params.id]);
        
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (events[0].organizer_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this event' });
        }

        await pool.query(
            `UPDATE events SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, 
             location = ?, category = ?, max_attendees = ?, image_url = ?, is_active = ?,
             is_paid = ?, price = ?, payment_qr = ?
             WHERE id = ?`,
            [title, description, eventDate, startTime, endTime, location, category, maxAttendees, imageUrl, isActive !== false,
             isPaid ? 1 : 0, price || 0, paymentQr !== undefined ? paymentQr : null,
             req.params.id]
        );

        res.json({ message: 'Event updated successfully' });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete event (organizer who created it or admin)
router.delete('/:id', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        // Check ownership
        const [events] = await pool.query('SELECT organizer_id, title FROM events WHERE id = ?', [req.params.id]);
        
        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (events[0].organizer_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this event' });
        }

        // Notify registered users
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type)
             SELECT user_id, 'Event Cancelled', ?, 'warning' 
             FROM registrations WHERE event_id = ? AND status = 'registered'`,
            [`The event "${events[0].title}" has been cancelled.`, req.params.id]
        );

        // Delete event (cascades to registrations)
        await pool.query('DELETE FROM events WHERE id = ?', [req.params.id]);

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Get events created by current organizer
router.get('/organizer/my-events', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        const [events] = await pool.query(
            `SELECT e.*, 
                    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'registered') as registered_count
             FROM events e
             WHERE e.organizer_id = ?
             ORDER BY e.event_date DESC`,
            [req.user.id]
        );
        res.json(events);
    } catch (error) {
        console.error('Get organizer events error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get attendees for an event
router.get('/:id/attendees', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        const [attendees] = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.department, r.registration_date, r.status
             FROM registrations r
             JOIN users u ON r.user_id = u.id
             WHERE r.event_id = ?
             ORDER BY r.registration_date DESC`,
            [req.params.id]
        );
        res.json(attendees);
    } catch (error) {
        console.error('Get attendees error:', error);
        res.status(500).json({ error: 'Failed to fetch attendees' });
    }
});

module.exports = router;
console.log('exporting events router:', typeof router);

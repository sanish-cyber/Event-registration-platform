const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ⚠️  IMPORTANT: Static routes MUST come before dynamic /:eventId routes

// Get user's registrations
router.get('/my-registrations', authenticateToken, async (req, res) => {
    try {
        const [registrations] = await pool.query(
            `SELECT r.*, e.title, e.description, e.event_date, e.start_time, e.end_time, 
                    e.location, e.category, e.image_url
             FROM registrations r
             JOIN events e ON r.event_id = e.id
             WHERE r.user_id = ?
             ORDER BY e.event_date ASC`,
            [req.user.id]
        );

        res.json(registrations);

    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

// Check if registered
router.get('/check/:eventId', authenticateToken, async (req, res) => {
    try {
        const [registrations] = await pool.query(
            `SELECT status, COALESCE(payment_status, 'not_required') AS payment_status
             FROM registrations WHERE user_id = ? AND event_id = ? AND status = 'registered'`,
            [req.user.id, req.params.eventId]
        );

        res.json({
            isRegistered: registrations.length > 0,
            paymentStatus: registrations.length > 0 ? registrations[0].payment_status : null
        });

    } catch (error) {
        console.error('Check registration error:', error);
        res.status(500).json({ error: 'Failed to check registration' });
    }
});

// Register for an event
router.post('/:eventId', authenticateToken, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const eventId = req.params.eventId;
        const userId = req.user.id;

        // Check if event exists and has capacity
        const [events] = await connection.query(
            'SELECT * FROM events WHERE id = ? AND is_active = TRUE FOR UPDATE',
            [eventId]
        );

        if (events.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = events[0];

        if (event.current_attendees >= event.max_attendees) {
            await connection.rollback();
            return res.status(400).json({ error: 'Event is full' });
        }

        // Prevent past event registration
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (new Date(event.event_date) < today) {
            await connection.rollback();
            return res.status(400).json({ error: 'Cannot register for past events' });
        }

        // Check if already registered
        const [existing] = await connection.query(
            'SELECT * FROM registrations WHERE user_id = ? AND event_id = ?',
            [userId, eventId]
        );

        if (existing.length > 0) {
            if (existing[0].status === 'registered') {
                await connection.rollback();
                return res.status(400).json({ error: 'Already registered for this event' });
            }

            // Re-register if cancelled
            await connection.query(
                'UPDATE registrations SET status = "registered", registration_date = NOW() WHERE id = ?',
                [existing[0].id]
            );
        } else {
            // New registration
            await connection.query(
                'INSERT INTO registrations (user_id, event_id) VALUES (?, ?)',
                [userId, eventId]
            );
        }

        // Update attendee count
        await connection.query(
            'UPDATE events SET current_attendees = current_attendees + 1 WHERE id = ?',
            [eventId]
        );

        // Create notification
        await connection.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [userId, 'Registration Confirmed', `You have successfully registered for "${event.title}"`, 'success']
        );

        await connection.commit();

        res.status(201).json({ message: 'Registration successful' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });

    } finally {
        if (connection) connection.release();
    }
});

// Cancel registration
router.delete('/:eventId', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const eventId = req.params.eventId;
        const userId = req.user.id;

        // Check registration exists
        const [registrations] = await connection.query(
            `SELECT r.id, e.title
             FROM registrations r
             JOIN events e ON r.event_id = e.id
             WHERE r.user_id = ? AND r.event_id = ? AND r.status = 'registered'`,
            [userId, eventId]
        );

        if (registrations.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Cancel registration
        await connection.query(
            `UPDATE registrations SET status = 'cancelled' WHERE user_id = ? AND event_id = ?`,
            [userId, eventId]
        );

        // Update attendee count
        await connection.query(
            'UPDATE events SET current_attendees = GREATEST(current_attendees - 1, 0) WHERE id = ?',
            [eventId]
        );

        // Notification
        await connection.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [userId, 'Registration Cancelled', `Your registration for "${registrations[0].title}" has been cancelled`, 'info']
        );

        await connection.commit();
        res.json({ message: 'Registration cancelled successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Cancel registration error:', error);
        res.status(500).json({ error: 'Failed to cancel registration' });
    } finally {
        connection.release();
    }
});

module.exports = router;
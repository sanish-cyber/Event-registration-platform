const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all users
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT id, email, first_name, last_name, role, phone, department, is_active, created_at
             FROM users ORDER BY created_at DESC`
        );
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user role
router.put('/users/:id/role', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { role } = req.body;

        if (!['attendee', 'organizer', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);

        // Notify user
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [req.params.id, 'Role Updated', `Your account role has been changed to ${role}`, 'info']
        );

        res.json({ message: 'User role updated successfully' });

    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Toggle user active status
router.put('/users/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;

        await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, req.params.id]);

        res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });

    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Delete user
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);

        res.json({ message: 'User deleted successfully' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Create new user
router.post('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, department, role } = req.body;

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users (email, password, first_name, last_name, phone, department, role) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email, hashedPassword, firstName, lastName, phone || null, department || null, role || 'attendee']
        );

        res.status(201).json({
            message: 'User created successfully',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get dashboard statistics
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [[userStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN role = 'attendee' THEN 1 ELSE 0 END) as attendees,
                SUM(CASE WHEN role = 'organizer' THEN 1 ELSE 0 END) as organizers,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
            FROM users WHERE is_active = TRUE
        `);

        const [[eventStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_events,
                SUM(CASE WHEN event_date >= CURDATE() THEN 1 ELSE 0 END) as upcoming_events,
                SUM(CASE WHEN event_date < CURDATE() THEN 1 ELSE 0 END) as past_events,
                SUM(current_attendees) as total_registrations
            FROM events WHERE is_active = TRUE
        `);

        const [categoryStats] = await pool.query(`
            SELECT category, COUNT(*) as count 
            FROM events WHERE is_active = TRUE 
            GROUP BY category
        `);

        const [recentRegistrations] = await pool.query(`
            SELECT r.*, u.first_name, u.last_name, e.title as event_title
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            ORDER BY r.registration_date DESC
            LIMIT 10
        `);

        const [popularEvents] = await pool.query(`
            SELECT id, title, current_attendees, max_attendees,
                   ROUND((current_attendees / max_attendees) * 100) as fill_percentage
            FROM events 
            WHERE is_active = TRUE AND event_date >= CURDATE()
            ORDER BY current_attendees DESC
            LIMIT 5
        `);

        res.json({
            users: userStats,
            events: eventStats,
            categories: categoryStats,
            recentRegistrations,
            popularEvents
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Generate reports
router.get('/reports/:type', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;

        let data;

        switch (type) {
            case 'events':
                [data] = await pool.query(`
                    SELECT e.*, u.first_name as organizer_first_name, u.last_name as organizer_last_name,
                           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'registered') as registrations
                    FROM events e
                    JOIN users u ON e.organizer_id = u.id
                    WHERE e.event_date BETWEEN ? AND ?
                    ORDER BY e.event_date
                `, [startDate || '2020-01-01', endDate || '2030-12-31']);
                break;

            case 'registrations':
                [data] = await pool.query(`
                    SELECT r.*, u.first_name, u.last_name, u.email, e.title as event_title, e.event_date
                    FROM registrations r
                    JOIN users u ON r.user_id = u.id
                    JOIN events e ON r.event_id = e.id
                    WHERE r.registration_date BETWEEN ? AND ?
                    ORDER BY r.registration_date DESC
                `, [startDate || '2020-01-01', endDate || '2030-12-31']);
                break;

            case 'users':
                [data] = await pool.query(`
                    SELECT id, email, first_name, last_name, role, department, created_at,
                           (SELECT COUNT(*) FROM registrations r WHERE r.user_id = users.id) as total_registrations
                    FROM users
                    WHERE created_at BETWEEN ? AND ?
                    ORDER BY created_at DESC
                `, [startDate || '2020-01-01', endDate || '2030-12-31']);
                break;

            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        res.json(data);

    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

module.exports = router;
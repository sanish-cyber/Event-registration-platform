// backend/routes/notifications.js
console.log('notifications loaded');

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [notifications] = await pool.query(
            `SELECT * FROM notifications 
             WHERE user_id = ? OR user_id IS NULL
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.user.id]
        );
        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
            [req.user.id]
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

// Send notification (admin only)
router.post('/send', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { title, message, type, userIds, sendToAll } = req.body;

        if (sendToAll) {
            // Send to all users
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, type)
                 SELECT id, ?, ?, ? FROM users WHERE is_active = TRUE`,
                [title, message, type || 'info']
            );
        } else if (userIds && userIds.length > 0) {
            // Send to specific users
            const values = userIds.map(userId => [userId, title, message, type || 'info']);
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES ?',
                [values]
            );
        } else {
            return res.status(400).json({ error: 'Specify recipients or sendToAll' });
        }

        res.status(201).json({ message: 'Notifications sent successfully' });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        const [[result]] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );
        res.json({ count: result.count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get count' });
    }
});

module.exports = router;

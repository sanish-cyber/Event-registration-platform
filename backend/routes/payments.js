// backend/routes/payments.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, isOrganizerOrAdmin } = require('../middleware/auth');

// ─── Upload / Update Payment QR for an event ──────────────────────────────────
// Organizer uploads a base64 QR image for their event
router.put('/event/:eventId/qr', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        const { paymentQr, price, isPaid } = req.body;
        const eventId = req.params.eventId;

        // Verify ownership
        const [events] = await pool.query(
            'SELECT organizer_id FROM events WHERE id = ?', [eventId]
        );
        if (events.length === 0) return res.status(404).json({ error: 'Event not found' });
        if (events[0].organizer_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await pool.query(
            `UPDATE events SET is_paid = ?, price = ?, payment_qr = ? WHERE id = ?`,
            [isPaid ? 1 : 0, price || 0, paymentQr || null, eventId]
        );

        res.json({ message: 'Payment QR updated successfully' });
    } catch (error) {
        console.error('Payment QR update error:', error);
        res.status(500).json({ error: 'Failed to update payment QR' });
    }
});

// ─── Confirm Payment for a Registration ───────────────────────────────────────
// Attendee marks their payment as done (pending organizer confirmation)
router.put('/confirm/:eventId', authenticateToken, async (req, res) => {
    try {
        const { transactionNote } = req.body;
        const eventId = req.params.eventId;
        const userId = req.user.id;

        const [regs] = await pool.query(
            'SELECT id FROM registrations WHERE user_id = ? AND event_id = ? AND status = "registered"',
            [userId, eventId]
        );
        if (regs.length === 0) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        await pool.query(
            `UPDATE registrations SET payment_status = 'pending_verification', payment_note = ? WHERE user_id = ? AND event_id = ?`,
            [transactionNote || null, userId, eventId]
        );

        // Notify organizer
        const [event] = await pool.query(
            'SELECT title, organizer_id FROM events WHERE id = ?', [eventId]
        );
        if (event.length > 0) {
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                [event[0].organizer_id, 'Payment Submitted', `A participant submitted payment for "${event[0].title}". Please verify.`, 'info']
            );
        }

        // Notify attendee
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [userId, 'Payment Submitted', 'Your payment has been submitted. Waiting for organizer verification.', 'success']
        );

        res.json({ message: 'Payment confirmation submitted' });
    } catch (error) {
        console.error('Payment confirm error:', error);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// ─── Organizer: Verify / Reject payment ──────────────────────────────────────
router.put('/verify/:registrationId', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const regId = req.params.registrationId;

        const [regs] = await pool.query(
            `SELECT r.*, e.title, e.organizer_id, u.id as uid
             FROM registrations r 
             JOIN events e ON r.event_id = e.id
             JOIN users u ON r.user_id = u.id
             WHERE r.id = ?`,
            [regId]
        );
        if (regs.length === 0) return res.status(404).json({ error: 'Registration not found' });

        const reg = regs[0];
        if (reg.organizer_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const newStatus = action === 'approve' ? 'paid' : 'payment_rejected';
        await pool.query(
            'UPDATE registrations SET payment_status = ? WHERE id = ?',
            [newStatus, regId]
        );

        const msg = action === 'approve'
            ? `Your payment for "${reg.title}" has been verified. You're confirmed!`
            : `Your payment for "${reg.title}" was rejected. Please contact the organizer.`;

        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [reg.uid, action === 'approve' ? 'Payment Verified ✓' : 'Payment Rejected', msg, action === 'approve' ? 'success' : 'warning']
        );

        res.json({ message: `Payment ${action === 'approve' ? 'approved' : 'rejected'}` });
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// ─── Organizer: Get pending payments for their events ─────────────────────────
router.get('/pending', authenticateToken, isOrganizerOrAdmin, async (req, res) => {
    try {
        const [pending] = await pool.query(
            `SELECT r.id, r.payment_status, r.payment_note, r.registration_date,
                    u.first_name, u.last_name, u.email,
                    e.title as event_title, e.id as event_id
             FROM registrations r
             JOIN users u ON r.user_id = u.id
             JOIN events e ON r.event_id = e.id
             WHERE e.organizer_id = ? AND r.payment_status = 'pending_verification'
             ORDER BY r.registration_date DESC`,
            [req.user.id]
        );
        res.json(pending);
    } catch (error) {
        console.error('Get pending payments error:', error);
        res.status(500).json({ error: 'Failed to fetch pending payments' });
    }
});

module.exports = router;

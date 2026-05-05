// backend/routes/auth.js
console.log("AUTH ROUTE LOADED");

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, department, role } = req.body;

        // Validate input
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        // Check if user exists
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine role (only admin can create organizers/admins)
        const userRole = role === 'organizer' ? 'organizer' : 'attendee';

        // Insert user
        const [result] = await pool.query(
            `INSERT INTO users (email, password, first_name, last_name, phone, department, role) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email, hashedPassword, firstName, lastName, phone || null, department || null, userRole]
        );

        // Create welcome notification
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
            [result.insertId, 'Welcome!', 'Welcome to College Event Registration System. Start exploring events now!', 'success']
        );

        res.status(201).json({ 
            message: 'Registration successful',
            userId: result.insertId 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                firstName: user.first_name,
                lastName: user.last_name
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT id, email, first_name, last_name, role, phone, department, created_at 
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, phone, department } = req.body;

        await pool.query(
            `UPDATE users SET first_name = ?, last_name = ?, phone = ?, department = ? WHERE id = ?`,
            [firstName, lastName, phone, department, req.user.id]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get current password hash
        const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, users[0].password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;

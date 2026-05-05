// backend/middleware/auth.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'abc123';

// Verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Check if user is organizer or admin
const isOrganizerOrAdmin = (req, res, next) => {
    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Organizer or admin access required' });
    }
    next();
};

module.exports = { authenticateToken, isAdmin, isOrganizerOrAdmin, JWT_SECRET };

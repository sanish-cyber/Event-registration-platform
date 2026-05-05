// backend/server.js
console.log("Server file started");

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// 🔥 Import routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes = require('./routes/payments');

// 🔍 Debug (optional)
console.log('auth:', authRoutes);
console.log('events:', eventRoutes);
console.log('registrations:', registrationRoutes);
console.log('admin:', adminRoutes);
console.log('notifications:', notificationRoutes);

// ✅ Attach routes 
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static frontend files
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback: serve index.html for any unmatched route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 handler (API only - kept for reference, unreachable now)
// app.use((req, res) => {
//     res.status(404).json({ error: 'Endpoint not found' });
// });

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Auto-migrate payment columns (compatible with all MySQL versions)
async function runMigrations() {
    const pool = require('./config/database');

    async function addColumnIfMissing(table, column, definition) {
        const [rows] = await pool.query(
            `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [table, column]
        );
        if (rows[0].cnt === 0) {
            await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
            console.log(`  + Added column ${table}.${column}`);
        }
    }

    try {
        await addColumnIfMissing('events', 'is_paid', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfMissing('events', 'price', 'DECIMAL(10,2) DEFAULT 0');
        await addColumnIfMissing('events', 'payment_qr', 'LONGTEXT');
        await addColumnIfMissing('registrations', 'payment_status',
            "ENUM('not_required','pending_verification','paid','payment_rejected') DEFAULT 'not_required'");
        await addColumnIfMissing('registrations', 'payment_note', 'VARCHAR(500)');
        await pool.query("ALTER TABLE events MODIFY COLUMN image_url LONGTEXT;");
        console.log('✓ Event images base64 migration complete');
    } catch (err) {
        console.error('Migration error:', err.message);
    }
}

// Start server
app.listen(PORT, async () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 API endpoints available at http://localhost:${PORT}/api\n`);
    await runMigrations();
});
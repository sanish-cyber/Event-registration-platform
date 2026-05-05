-- database/schema.sql

-- Create the database
CREATE DATABASE IF NOT EXISTS college_events;
USE college_events;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('attendee', 'organizer', 'admin') DEFAULT 'attendee',
    phone VARCHAR(20),
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Events table
CREATE TABLE events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255) NOT NULL,
    category ENUM('academic', 'cultural', 'sports', 'workshop', 'seminar', 'other') DEFAULT 'other',
    max_attendees INT DEFAULT 100,
    current_attendees INT DEFAULT 0,
    organizer_id INT NOT NULL,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Registrations table
CREATE TABLE registrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    event_id INT NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('registered', 'cancelled', 'attended') DEFAULT 'registered',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE KEY unique_registration (user_id, event_id)
);

-- Notifications table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'event') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password, first_name, last_name, role) 
VALUES ('admin@college.edu', '$2b$10$rQZ5Y5Y5Y5Y5Y5Y5Y5Y5YO5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5', 'System', 'Admin', 'admin');

-- Insert sample organizer (password: organizer123)
INSERT INTO users (email, password, first_name, last_name, role, department) 
VALUES ('organizer@college.edu', '$2b$10$rQZ5Y5Y5Y5Y5Y5Y5Y5Y5YO5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5', 'John', 'Smith', 'organizer', 'Computer Science');

-- Insert sample events
INSERT INTO events (title, description, event_date, start_time, end_time, location, category, max_attendees, organizer_id) VALUES
('Annual Tech Fest 2025', 'A celebration of technology and innovation featuring workshops, hackathons, and guest speakers from leading tech companies.', '2025-02-15', '09:00:00', '18:00:00', 'Main Auditorium', 'academic', 500, 2),
('Cultural Night', 'An evening of music, dance, and drama performances showcasing diverse cultures from around the world.', '2025-02-20', '18:00:00', '22:00:00', 'Open Air Theatre', 'cultural', 300, 2),
('Web Development Workshop', 'Hands-on workshop covering modern web technologies including React, Node.js, and cloud deployment.', '2025-02-10', '10:00:00', '16:00:00', 'Computer Lab 101', 'workshop', 50, 2),
('Inter-College Basketball Tournament', 'Annual basketball championship featuring teams from 8 different colleges competing for the trophy.', '2025-03-01', '08:00:00', '20:00:00', 'Sports Complex', 'sports', 200, 2),
('AI & Machine Learning Seminar', 'Expert talks on the latest trends in artificial intelligence and machine learning applications.', '2025-02-25', '14:00:00', '17:00:00', 'Seminar Hall B', 'seminar', 150, 2);

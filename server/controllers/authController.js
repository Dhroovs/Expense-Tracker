const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyexpense123!@#';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Salary'
];

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user already exists
    const checkUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (checkUser.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const insertUser = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const newUser = insertUser.rows[0];

    // Seed default categories
    for (const catName of DEFAULT_CATEGORIES) {
      await client.query(
        'INSERT INTO categories (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING',
        [newUser.id, catName]
      );
    }

    await client.query('COMMIT');
    client.release();

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userResult = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, name, email, monthly_budget, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user: userResult.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, email, monthly_budget, currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  const budget = monthly_budget ? parseFloat(monthly_budget) : 0.00;
  if (isNaN(budget) || budget < 0) {
    return res.status(400).json({ error: 'Budget limit must be a positive number.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if new email is taken by another user
    const checkEmail = await client.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase().trim(), userId]);
    if (checkEmail.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'Email is already taken by another user.' });
    }

    // Get current user details for password verify if needed
    const userResult = await client.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    let passwordHash = user.password_hash;

    // Handle password change if requested
    if (newPassword) {
      if (!currentPassword) {
        client.release();
        return res.status(400).json({ error: 'Current password is required to set a new password.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        client.release();
        return res.status(400).json({ error: 'Incorrect current password.' });
      }

      if (newPassword.length < 8) {
        client.release();
        return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      }

      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(newPassword, salt);
    }

    // Update user
    const updateResult = await client.query(
      'UPDATE users SET name = $1, email = $2, monthly_budget = $3, password_hash = $4 WHERE id = $5 RETURNING id, name, email, monthly_budget',
      [name.trim(), email.toLowerCase().trim(), budget, passwordHash, userId]
    );

    await client.query('COMMIT');
    client.release();

    const updatedUser = updateResult.rows[0];

    // Generate new JWT
    const token = jwt.sign(
      { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Profile updated successfully.',
      token,
      user: updatedUser
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error updating profile.' });
  }
};

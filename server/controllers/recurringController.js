const db = require('../config/db');

exports.getRecurringTransactions = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT rt.id, rt.title, rt.amount, rt.type, rt.notes, rt.frequency, 
              rt.start_date::text, rt.next_due_date::text, rt.last_processed_date::text, 
              rt.is_active, rt.created_at, rt.category_id, c.name as category_name
       FROM recurring_transactions rt
       LEFT JOIN categories c ON rt.category_id = c.id
       WHERE rt.user_id = $1
       ORDER BY rt.created_at DESC`,
      [userId]
    );

    const formatted = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount),
    }));

    return res.status(200).json({ recurringTransactions: formatted });
  } catch (err) {
    console.error('Get recurring transactions error:', err);
    return res.status(500).json({ error: 'Internal server error fetching recurring transactions.' });
  }
};

exports.createRecurringTransaction = async (req, res) => {
  const { title, amount, type, category_id, frequency, start_date, notes } = req.body;
  const userId = req.user.id;

  // Validation
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  if (!type || (type !== 'income' && type !== 'expense')) {
    return res.status(400).json({ error: 'Type must be either "income" or "expense".' });
  }

  if (!category_id) {
    return res.status(400).json({ error: 'Category is required.' });
  }

  if (!frequency || (frequency !== 'weekly' && frequency !== 'monthly')) {
    return res.status(400).json({ error: 'Frequency must be weekly or monthly.' });
  }

  if (!start_date) {
    return res.status(400).json({ error: 'Start date is required.' });
  }

  try {
    // Validate category belongs to user
    const catCheck = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [category_id, userId]
    );

    if (catCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category selection.' });
    }

    // Set next_due_date initially to start_date.
    // If start_date is in the past, it will auto-generate them on the next background run.
    const next_due_date = start_date;

    const result = await db.query(
      `INSERT INTO recurring_transactions 
        (user_id, category_id, title, amount, type, notes, frequency, start_date, next_due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, amount, type, notes, frequency, start_date::text, next_due_date::text, is_active, category_id`,
      [userId, category_id, title.trim(), parsedAmount, type, notes ? notes.trim() : null, frequency, start_date, next_due_date]
    );

    const recurring = result.rows[0];
    recurring.amount = parseFloat(recurring.amount);

    return res.status(201).json({
      message: 'Recurring transaction scheduled successfully.',
      recurringTransaction: recurring
    });
  } catch (err) {
    console.error('Create recurring transaction error:', err);
    return res.status(500).json({ error: 'Internal server error creating recurring transaction.' });
  }
};

exports.updateRecurringTransaction = async (req, res) => {
  const { id } = req.params;
  const { title, amount, type, category_id, frequency, start_date, next_due_date, notes } = req.body;
  const userId = req.user.id;

  // Validation
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  if (!type || (type !== 'income' && type !== 'expense')) {
    return res.status(400).json({ error: 'Type must be either "income" or "expense".' });
  }

  if (!category_id) {
    return res.status(400).json({ error: 'Category is required.' });
  }

  if (!frequency || (frequency !== 'weekly' && frequency !== 'monthly')) {
    return res.status(400).json({ error: 'Frequency must be weekly or monthly.' });
  }

  if (!start_date) {
    return res.status(400).json({ error: 'Start date is required.' });
  }

  if (!next_due_date) {
    return res.status(400).json({ error: 'Next due date is required.' });
  }

  try {
    // Check ownership
    const check = await db.query(
      'SELECT id FROM recurring_transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found.' });
    }

    // Validate category
    const catCheck = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [category_id, userId]
    );

    if (catCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category selection.' });
    }

    const result = await db.query(
      `UPDATE recurring_transactions
       SET title = $1, amount = $2, type = $3, category_id = $4, frequency = $5, start_date = $6, next_due_date = $7, notes = $8
       WHERE id = $9 AND user_id = $10
       RETURNING id, title, amount, type, notes, frequency, start_date::text, next_due_date::text, last_processed_date::text, is_active, category_id`,
      [title.trim(), parsedAmount, type, category_id, frequency, start_date, next_due_date, notes ? notes.trim() : null, id, userId]
    );

    const recurring = result.rows[0];
    recurring.amount = parseFloat(recurring.amount);

    return res.status(200).json({
      message: 'Recurring transaction updated successfully.',
      recurringTransaction: recurring
    });
  } catch (err) {
    console.error('Update recurring transaction error:', err);
    return res.status(500).json({ error: 'Internal server error updating recurring transaction.' });
  }
};

exports.deleteRecurringTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const check = await db.query(
      'SELECT id FROM recurring_transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found.' });
    }

    await db.query(
      'DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    return res.status(200).json({ message: 'Recurring transaction schedule deleted successfully.' });
  } catch (err) {
    console.error('Delete recurring transaction error:', err);
    return res.status(500).json({ error: 'Internal server error deleting recurring transaction.' });
  }
};

exports.toggleRecurringActive = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const userId = req.user.id;

  try {
    const check = await db.query(
      'SELECT id FROM recurring_transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found.' });
    }

    const result = await db.query(
      `UPDATE recurring_transactions
       SET is_active = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, is_active`,
      [!!is_active, id, userId]
    );

    return res.status(200).json({
      message: `Recurring transaction schedule ${result.rows[0].is_active ? 'activated' : 'paused'} successfully.`,
      recurringTransaction: result.rows[0]
    });
  } catch (err) {
    console.error('Toggle recurring active error:', err);
    return res.status(500).json({ error: 'Internal server error updating schedule status.' });
  }
};

const db = require('../config/db');

exports.getTransactions = async (req, res) => {
  const userId = req.user.id;
  const {
    search,
    category_id,
    type,
    startDate,
    endDate,
    sortBy = 'transaction_date',
    sortOrder = 'DESC',
    page = 1,
    limit = 10
  } = req.query;

  try {
    let queryText = `
      SELECT t.id, t.title, t.amount, t.type, t.notes, t.transaction_date, t.created_at, t.category_id, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
    `;
    let countText = `
      SELECT COUNT(*)
      FROM transactions t
      WHERE t.user_id = $1
    `;

    const queryParams = [userId];
    const countParams = [userId];
    let paramIndex = 2;

    // Search filter (title, notes, or category name)
    if (search && search.trim() !== '') {
      const searchVal = `%${search.trim()}%`;
      queryText += ` AND (t.title ILIKE $${paramIndex} OR t.notes ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
      countText += ` AND (t.title ILIKE $${paramIndex} OR t.notes ILIKE $${paramIndex} OR EXISTS (SELECT 1 FROM categories WHERE id = t.category_id AND name ILIKE $${paramIndex}))`;
      queryParams.push(searchVal);
      countParams.push(searchVal);
      paramIndex++;
    }

    // Category filter
    if (category_id) {
      queryText += ` AND t.category_id = $${paramIndex}`;
      countText += ` AND t.category_id = $${paramIndex}`;
      queryParams.push(parseInt(category_id, 10));
      countParams.push(parseInt(category_id, 10));
      paramIndex++;
    }

    // Type filter (income/expense)
    if (type && (type === 'income' || type === 'expense')) {
      queryText += ` AND t.type = $${paramIndex}`;
      countText += ` AND t.type = $${paramIndex}`;
      queryParams.push(type);
      countParams.push(type);
      paramIndex++;
    }

    // Start Date filter
    if (startDate) {
      queryText += ` AND t.transaction_date >= $${paramIndex}`;
      countText += ` AND t.transaction_date >= $${paramIndex}`;
      queryParams.push(startDate);
      countParams.push(startDate);
      paramIndex++;
    }

    // End Date filter
    if (endDate) {
      queryText += ` AND t.transaction_date <= $${paramIndex}`;
      countText += ` AND t.transaction_date <= $${paramIndex}`;
      queryParams.push(endDate);
      countParams.push(endDate);
      paramIndex++;
    }

    // Sorting validation
    const allowedSortFields = ['transaction_date', 'amount', 'title', 'created_at'];
    const actualSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'transaction_date';
    const actualSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryText += ` ORDER BY t.${actualSortBy} ${actualSortOrder}, t.id DESC`;

    // Pagination (skip if limit is 'all')
    let totalCount = 0;
    const countResult = await db.query(countText, countParams);
    totalCount = parseInt(countResult.rows[0].count, 10);

    if (limit !== 'all') {
      const parsedLimit = parseInt(limit, 10) || 10;
      const parsedPage = parseInt(page, 10) || 1;
      const offset = (parsedPage - 1) * parsedLimit;

      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(parsedLimit, offset);
    }

    const transactionsResult = await db.query(queryText, queryParams);

    return res.status(200).json({
      transactions: transactionsResult.rows,
      pagination: limit !== 'all' ? {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / (parseInt(limit, 10) || 10)),
        currentPage: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10
      } : null
    });

  } catch (err) {
    console.error('Get transactions error:', err);
    return res.status(500).json({ error: 'Internal server error fetching transactions.' });
  }
};

exports.getTransactionById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT t.id, t.title, t.amount, t.type, t.notes, t.transaction_date, t.created_at, t.category_id, c.name as category_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    return res.status(200).json({ transaction: result.rows[0] });
  } catch (err) {
    console.error('Get transaction by id error:', err);
    return res.status(500).json({ error: 'Internal server error fetching transaction.' });
  }
};

exports.createTransaction = async (req, res) => {
  const { title, amount, type, category_id, transaction_date, notes } = req.body;
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

  if (!transaction_date) {
    return res.status(400).json({ error: 'Transaction date is required.' });
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

    const insertResult = await db.query(
      `INSERT INTO transactions (user_id, category_id, title, amount, type, notes, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, amount, type, notes, transaction_date, created_at, category_id`,
      [userId, category_id, title.trim(), parsedAmount, type, notes ? notes.trim() : null, transaction_date]
    );

    return res.status(201).json({
      message: 'Transaction created successfully.',
      transaction: insertResult.rows[0]
    });

  } catch (err) {
    console.error('Create transaction error:', err);
    return res.status(500).json({ error: 'Internal server error creating transaction.' });
  }
};

exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { title, amount, type, category_id, transaction_date, notes } = req.body;
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

  if (!transaction_date) {
    return res.status(400).json({ error: 'Transaction date is required.' });
  }

  try {
    // Verify ownership of transaction
    const transactionCheck = await db.query(
      'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (transactionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    // Verify category belongs to user
    const catCheck = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [category_id, userId]
    );

    if (catCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category selection.' });
    }

    const updateResult = await db.query(
      `UPDATE transactions
       SET category_id = $1, title = $2, amount = $3, type = $4, notes = $5, transaction_date = $6
       WHERE id = $7 AND user_id = $8
       RETURNING id, title, amount, type, notes, transaction_date, created_at, category_id`,
      [category_id, title.trim(), parsedAmount, type, notes ? notes.trim() : null, transaction_date, id, userId]
    );

    return res.status(200).json({
      message: 'Transaction updated successfully.',
      transaction: updateResult.rows[0]
    });

  } catch (err) {
    console.error('Update transaction error:', err);
    return res.status(500).json({ error: 'Internal server error updating transaction.' });
  }
};

exports.deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Verify ownership of transaction
    const transactionCheck = await db.query(
      'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (transactionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    await db.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    return res.status(200).json({
      message: 'Transaction deleted successfully.'
    });

  } catch (err) {
    console.error('Delete transaction error:', err);
    return res.status(500).json({ error: 'Internal server error deleting transaction.' });
  }
};

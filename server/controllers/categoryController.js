const db = require('../config/db');

exports.getCategories = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT 
         c.id, 
         c.name, 
         c.budget, 
         c.created_at,
         COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE) AND t.transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' THEN t.amount ELSE 0 END), 0) as spent
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id, c.name, c.budget, c.created_at
       ORDER BY c.name ASC`,
      [userId]
    );

    const formatted = result.rows.map(row => ({
      ...row,
      budget: parseFloat(row.budget || 0),
      spent: parseFloat(row.spent || 0)
    }));

    return res.status(200).json({ categories: formatted });
  } catch (err) {
    console.error('Get categories error:', err);
    return res.status(500).json({ error: 'Internal server error fetching categories.' });
  }
};

exports.createCategory = async (req, res) => {
  const { name, budget } = req.body;
  const userId = req.user.id;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const parsedBudget = parseFloat(budget) || 0.00;
  if (isNaN(parsedBudget) || parsedBudget < 0) {
    return res.status(400).json({ error: 'Budget must be a non-negative number.' });
  }

  try {
    const cleanName = name.trim();

    // Check duplicate name for this user
    const duplicateCheck = await db.query(
      'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
      [userId, cleanName]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Category name already exists.' });
    }

    const insertResult = await db.query(
      'INSERT INTO categories (user_id, name, budget) VALUES ($1, $2, $3) RETURNING id, name, budget, created_at',
      [userId, cleanName, parsedBudget]
    );

    return res.status(201).json({
      message: 'Category created successfully.',
      category: {
        ...insertResult.rows[0],
        budget: parseFloat(insertResult.rows[0].budget),
        spent: 0
      }
    });

  } catch (err) {
    console.error('Create category error:', err);
    return res.status(500).json({ error: 'Internal server error creating category.' });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, budget } = req.body;
  const userId = req.user.id;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const parsedBudget = parseFloat(budget) || 0.00;
  if (isNaN(parsedBudget) || parsedBudget < 0) {
    return res.status(400).json({ error: 'Budget must be a non-negative number.' });
  }

  try {
    const cleanName = name.trim();

    // Verify ownership
    const ownershipCheck = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or unauthorized.' });
    }

    // Check duplicate name for this user (excluding current category)
    const duplicateCheck = await db.query(
      'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
      [userId, cleanName, id]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Another category already has this name.' });
    }

    const updateResult = await db.query(
      'UPDATE categories SET name = $1, budget = $2 WHERE id = $3 AND user_id = $4 RETURNING id, name, budget, created_at',
      [cleanName, parsedBudget, id, userId]
    );

    // Fetch the updated spent amount for this category as well
    const spentResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as spent FROM transactions 
       WHERE category_id = $1 AND user_id = $2 AND type = 'expense'
       AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
       AND transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
      [id, userId]
    );

    return res.status(200).json({
      message: 'Category updated successfully.',
      category: {
        ...updateResult.rows[0],
        budget: parseFloat(updateResult.rows[0].budget),
        spent: parseFloat(spentResult.rows[0].spent || 0)
      }
    });

  } catch (err) {
    console.error('Update category error:', err);
    return res.status(500).json({ error: 'Internal server error updating category.' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Verify ownership
    const ownershipCheck = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or unauthorized.' });
    }

    await db.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    return res.status(200).json({
      message: 'Category deleted successfully.'
    });

  } catch (err) {
    console.error('Delete category error:', err);
    return res.status(500).json({ error: 'Internal server error deleting category.' });
  }
};

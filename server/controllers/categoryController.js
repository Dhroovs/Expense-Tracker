const db = require('../config/db');

exports.getCategories = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      'SELECT id, name, created_at FROM categories WHERE user_id = $1 ORDER BY name ASC',
      [userId]
    );
    return res.status(200).json({ categories: result.rows });
  } catch (err) {
    console.error('Get categories error:', err);
    return res.status(500).json({ error: 'Internal server error fetching categories.' });
  }
};

exports.createCategory = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required.' });
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
      'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
      [userId, cleanName]
    );

    return res.status(201).json({
      message: 'Category created successfully.',
      category: insertResult.rows[0]
    });

  } catch (err) {
    console.error('Create category error:', err);
    return res.status(500).json({ error: 'Internal server error creating category.' });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user.id;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required.' });
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
      'UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, created_at',
      [cleanName, id, userId]
    );

    return res.status(200).json({
      message: 'Category updated successfully.',
      category: updateResult.rows[0]
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

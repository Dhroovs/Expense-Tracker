const db = require('../config/db');

exports.getAuditLogs = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 15, action } = req.query;

  try {
    let queryText = `
      SELECT id, transaction_id, action, title, amount, type, details, performed_by, performed_at
      FROM audit_logs
      WHERE user_id = $1
    `;
    let countText = `
      SELECT COUNT(*)
      FROM audit_logs
      WHERE user_id = $1
    `;

    const queryParams = [userId];
    const countParams = [userId];
    let paramIndex = 2;

    if (action && action.trim() !== '') {
      queryText += ` AND action = $${paramIndex}`;
      countText += ` AND action = $${paramIndex}`;
      queryParams.push(action.trim());
      countParams.push(action.trim());
      paramIndex++;
    }

    queryText += ` ORDER BY performed_at DESC, id DESC`;

    // Pagination
    const countResult = await db.query(countText, countParams);
    const totalItems = parseInt(countResult.rows[0].count, 10);
    const parsedLimit = parseInt(limit, 10) || 15;
    const parsedPage = parseInt(page, 10) || 1;
    const offset = (parsedPage - 1) * parsedLimit;

    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parsedLimit, offset);

    const logsResult = await db.query(queryText, queryParams);

    return res.status(200).json({
      auditLogs: logsResult.rows,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / parsedLimit),
        currentPage: parsedPage,
        limit: parsedLimit
      }
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    return res.status(500).json({ error: 'Internal server error fetching audit logs.' });
  }
};

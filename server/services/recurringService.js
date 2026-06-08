const db = require('../config/db');

exports.processForUser = async (userId) => {
  const today = new Date().toISOString().split('T')[0];

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Find all active recurring transactions that are due (next_due_date <= today)
    const dueRecurrings = await client.query(
      `SELECT * FROM recurring_transactions 
       WHERE user_id = $1 AND is_active = true AND next_due_date <= $2`,
      [userId, today]
    );

    for (const rt of dueRecurrings.rows) {
      let currentDueDate = new Date(rt.next_due_date);
      const todayDate = new Date(today);

      // Save the original next_due_date as the last processed date for tracking
      let lastProcessed = rt.next_due_date;

      while (currentDueDate <= todayDate) {
        const dateStr = currentDueDate.toISOString().split('T')[0];

        // 1. Insert transaction
        const txResult = await client.query(
          `INSERT INTO transactions (user_id, category_id, title, amount, type, notes, transaction_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [rt.user_id, rt.category_id, rt.title, rt.amount, rt.type, rt.notes ? `${rt.notes} (Recurring)`.trim() : 'Recurring Transaction', dateStr]
        );

        // 2. Insert audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, transaction_id, action, title, amount, type, details, performed_by)
           VALUES ($1, $2, 'CREATE', $3, $4, $5, $6, 'SYSTEM')`,
          [rt.user_id, txResult.rows[0].id, rt.title, rt.amount, rt.type, 'Auto-generated recurring transaction.', 'SYSTEM']
        );

        // Record last processed date
        lastProcessed = dateStr;

        // 3. Advance to next due date
        if (rt.frequency === 'weekly') {
          currentDueDate.setDate(currentDueDate.getDate() + 7);
        } else if (rt.frequency === 'monthly') {
          currentDueDate.setMonth(currentDueDate.getMonth() + 1);
        } else {
          break; // Safeguard
        }
      }

      // Update the template in the database
      const nextDueDateStr = currentDueDate.toISOString().split('T')[0];
      await client.query(
        `UPDATE recurring_transactions
         SET next_due_date = $1, last_processed_date = $2
         WHERE id = $3`,
        [nextDueDateStr, lastProcessed, rt.id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

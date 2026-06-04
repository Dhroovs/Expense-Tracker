const db = require('../config/db');

exports.getSummary = async (req, res) => {
  const userId = req.user.id;

  // Calculate current month's date bounds
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
  const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

  try {
    // 1. Overall Totals
    const overallResult = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    );

    const { total_income, total_expenses } = overallResult.rows[0];
    const total_balance = parseFloat(total_income) - parseFloat(total_expenses);

    // 2. Current Month Totals
    const monthlyResult = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as monthly_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as monthly_expenses
       FROM transactions
       WHERE user_id = $1 AND transaction_date >= $2 AND transaction_date <= $3`,
      [userId, startOfMonth, endOfMonth]
    );

    const { monthly_income, monthly_expenses } = monthlyResult.rows[0];

    // 3. User Budget details
    const userResult = await db.query(
      'SELECT monthly_budget FROM users WHERE id = $1',
      [userId]
    );
    const monthly_budget = parseFloat(userResult.rows[0].monthly_budget || 0);

    // 4. Recent Transactions (last 5)
    const recentResult = await db.query(
      `SELECT t.id, t.title, t.amount, t.type, t.transaction_date, c.name as category_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT 5`,
      [userId]
    );

    return res.status(200).json({
      summary: {
        totalBalance: total_balance,
        totalIncome: parseFloat(total_income),
        totalExpenses: parseFloat(total_expenses),
        monthlyIncome: parseFloat(monthly_income),
        monthlyExpenses: parseFloat(monthly_expenses),
        monthlyBudget: monthly_budget,
        budgetProgress: monthly_budget > 0 ? (parseFloat(monthly_expenses) / monthly_budget) * 100 : 0
      },
      recentTransactions: recentResult.rows
    });

  } catch (err) {
    console.error('Get summary analytics error:', err);
    return res.status(500).json({ error: 'Internal server error calculating dashboard summary.' });
  }
};

exports.getCategoryBreakdown = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT COALESCE(c.name, 'Uncategorized') as category_name, SUM(t.amount) as total_amount
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
       GROUP BY c.name
       ORDER BY total_amount DESC`,
      [userId]
    );

    // Format amounts to float
    const formatted = result.rows.map(row => ({
      category: row.category_name,
      amount: parseFloat(row.total_amount)
    }));

    return res.status(200).json({ breakdown: formatted });
  } catch (err) {
    console.error('Get category breakdown error:', err);
    return res.status(500).json({ error: 'Internal server error calculating category breakdown.' });
  }
};

exports.getMonthlyComparison = async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch last 6 months summary
    const result = await db.query(
      `SELECT
         TO_CHAR(transaction_date, 'YYYY-MM') as month,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM transactions
       WHERE user_id = $1 AND transaction_date >= NOW() - INTERVAL '6 months'
       GROUP BY month
       ORDER BY month ASC`,
      [userId]
    );

    const formatted = result.rows.map(row => ({
      month: row.month,
      income: parseFloat(row.income),
      expense: parseFloat(row.expense)
    }));

    return res.status(200).json({ comparison: formatted });
  } catch (err) {
    console.error('Get monthly comparison error:', err);
    return res.status(500).json({ error: 'Internal server error calculating monthly comparison.' });
  }
};

exports.getSpendingTrend = async (req, res) => {
  const userId = req.user.id;

  // Calculate current month's date bounds
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
  const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

  try {
    const result = await db.query(
      `SELECT transaction_date::text as date, SUM(amount) as total_amount
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND transaction_date >= $2 AND transaction_date <= $3
       GROUP BY transaction_date
       ORDER BY transaction_date ASC`,
      [userId, startOfMonth, endOfMonth]
    );

    const formatted = result.rows.map(row => ({
      date: row.date,
      amount: parseFloat(row.total_amount)
    }));

    return res.status(200).json({ trend: formatted });
  } catch (err) {
    console.error('Get spending trend error:', err);
    return res.status(500).json({ error: 'Internal server error calculating spending trend.' });
  }
};

const bcrypt = require('bcryptjs');
const db = require('../server/config/db');

async function seed() {
  console.log('Seeding mock data for Spendora Expense Tracker...');
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clean up existing test user if present
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', ['test@spendora.com']);
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      console.log(`Cleaning up existing data for test user (ID: ${userId})...`);
      
      // Cascade delete takes care of transactions, categories, and recurring templates, but let's be explicit
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM recurring_transactions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM categories WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    }

    // 2. Create Test User
    const passwordHash = await bcrypt.hash('password123', 10);
    const insertUserRes = await client.query(
      `INSERT INTO users (name, email, password_hash, monthly_budget, theme) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      ['Dhroov Singh', 'test@spendora.com', passwordHash, 2000.00, 'dark']
    );
    const userId = insertUserRes.rows[0].id;
    console.log(`Created test user with ID: ${userId}`);

    // 3. Create Categories
    const categories = [
      { name: 'Housing', budget: 1000.00 },
      { name: 'Groceries', budget: 300.00 },
      { name: 'Entertainment', budget: 150.00 },
      { name: 'Utilities', budget: 200.00 },
      { name: 'Income/Salary', budget: 0.00 }
    ];

    const categoryIds = {};
    for (const cat of categories) {
      const catRes = await client.query(
        `INSERT INTO categories (user_id, name, budget) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [userId, cat.name, cat.budget]
      );
      categoryIds[cat.name] = catRes.rows[0].id;
      console.log(`Created Category: ${cat.name} (ID: ${catRes.rows[0].id})`);
    }

    // 4. Seed Historical Transactions
    // Let's seed transactions for:
    // - Current Month (June 2026) -> Current local time is 2026-06-08
    // - Previous Month (May 2026)
    // - April 2026
    // - March 2026
    // - February 2026
    // - January 2026
    // - December 2025 (Last Year)

    const txData = [
      // == JUNE 2026 (Current Month) ==
      // Monthly Salary
      { title: 'Monthly Salary', amount: 3500.00, type: 'income', category: 'Income/Salary', date: '2026-06-01' },
      // Housing (Overspent!)
      { title: 'Apartment Rent', amount: 1200.00, type: 'expense', category: 'Housing', date: '2026-06-01' },
      // Groceries (Within budget)
      { title: 'Organic Foods Store', amount: 125.50, type: 'expense', category: 'Groceries', date: '2026-06-02' },
      { title: 'Supermarket Groceries', amount: 84.20, type: 'expense', category: 'Groceries', date: '2026-06-05' },
      { title: 'Weekly Vegetables Market', amount: 40.30, type: 'expense', category: 'Groceries', date: '2026-06-07' },
      // Entertainment (Overspent!)
      { title: 'Cinema IMAX Ticket', amount: 45.00, type: 'expense', category: 'Entertainment', date: '2026-06-03' },
      { title: 'Weekend Dinner & Bar', amount: 95.00, type: 'expense', category: 'Entertainment', date: '2026-06-05' },
      { title: 'Console Video Game', amount: 69.99, type: 'expense', category: 'Entertainment', date: '2026-06-06' },
      // Utilities
      { title: 'Electricity Bill', amount: 110.00, type: 'expense', category: 'Utilities', date: '2026-06-04' },

      // == MAY 2026 ==
      { title: 'Monthly Salary', amount: 3500.00, type: 'income', category: 'Income/Salary', date: '2026-05-01' },
      { title: 'Apartment Rent', amount: 1000.00, type: 'expense', category: 'Housing', date: '2026-05-01' },
      { title: 'Supermarket Groceries', amount: 275.40, type: 'expense', category: 'Groceries', date: '2026-05-12' },
      { title: 'Concert Concert Ticket', amount: 120.00, type: 'expense', category: 'Entertainment', date: '2026-05-18' },
      { title: 'Electric & Internet Bills', amount: 185.00, type: 'expense', category: 'Utilities', date: '2026-05-05' },

      // == APRIL 2026 ==
      { title: 'Monthly Salary', amount: 3500.00, type: 'income', category: 'Income/Salary', date: '2026-04-01' },
      { title: 'Apartment Rent', amount: 1000.00, type: 'expense', category: 'Housing', date: '2026-04-01' },
      { title: 'Supermarket Groceries', amount: 290.10, type: 'expense', category: 'Groceries', date: '2026-04-10' },
      { title: 'Streaming Services Bundle', amount: 50.00, type: 'expense', category: 'Entertainment', date: '2026-04-15' },
      { title: 'Water & Electric Bills', amount: 160.00, type: 'expense', category: 'Utilities', date: '2026-04-05' },

      // == MARCH 2026 ==
      { title: 'Monthly Salary', amount: 3500.00, type: 'income', category: 'Income/Salary', date: '2026-03-01' },
      { title: 'Apartment Rent', amount: 1000.00, type: 'expense', category: 'Housing', date: '2026-03-01' },
      { title: 'Supermarket Groceries', amount: 260.00, type: 'expense', category: 'Groceries', date: '2026-03-12' },
      { title: 'Museum & Tour Tickets', amount: 90.00, type: 'expense', category: 'Entertainment', date: '2026-03-20' },
      { title: 'Electricity & Gas', amount: 140.00, type: 'expense', category: 'Utilities', date: '2026-03-05' },

      // == FEBRUARY 2026 ==
      { title: 'Monthly Salary', amount: 3500.00, type: 'income', category: 'Income/Salary', date: '2026-02-01' },
      { title: 'Apartment Rent', amount: 1000.00, type: 'expense', category: 'Housing', date: '2026-02-01' },
      { title: 'Bulk Grocery Store', amount: 310.00, type: 'expense', category: 'Groceries', date: '2026-02-14' },
      { title: 'Arcade & Drinks Night', amount: 110.00, type: 'expense', category: 'Entertainment', date: '2026-02-22' },
      { title: 'Electricity Bill', amount: 105.00, type: 'expense', category: 'Utilities', date: '2026-02-05' },

      // == JANUARY 2026 ==
      { title: 'Monthly Salary', amount: 3500.00, type: 'income', category: 'Income/Salary', date: '2026-01-01' },
      { title: 'Apartment Rent', amount: 1000.00, type: 'expense', category: 'Housing', date: '2026-01-01' },
      { title: 'Supermarket Groceries', amount: 240.00, type: 'expense', category: 'Groceries', date: '2026-01-11' },
      { title: 'Dinner Party Out', amount: 130.00, type: 'expense', category: 'Entertainment', date: '2026-01-25' },
      { title: 'Water & Heating Bills', amount: 190.00, type: 'expense', category: 'Utilities', date: '2026-01-05' },

      // == DECEMBER 2025 (Last Year) ==
      { title: 'Monthly Salary', amount: 3500.00, type: 'income', category: 'Income/Salary', date: '2025-12-01' },
      { title: 'Apartment Rent', amount: 1000.00, type: 'expense', category: 'Housing', date: '2025-12-01' },
      { title: 'Christmas Groceries Feast', amount: 270.00, type: 'expense', category: 'Groceries', date: '2025-12-23' },
      { title: 'Holiday Gifts & Shows', amount: 150.00, type: 'expense', category: 'Entertainment', date: '2025-12-25' },
      { title: 'Electricity Bill', amount: 115.00, type: 'expense', category: 'Utilities', date: '2025-12-05' }
    ];

    for (const tx of txData) {
      const categoryId = categoryIds[tx.category];
      const txRes = await client.query(
        `INSERT INTO transactions (user_id, category_id, title, amount, type, transaction_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, categoryId, tx.title, tx.amount, tx.type, tx.date]
      );
      
      // Add audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, transaction_id, action, title, amount, type, details, performed_by)
         VALUES ($1, $2, 'CREATE', $3, $4, $5, $6, $7)`,
        [userId, txRes.rows[0].id, tx.title, tx.amount, tx.type, 'Seeded transaction records.', 'SYSTEM']
      );
    }
    console.log(`Successfully seeded ${txData.length} transaction records.`);

    // 5. Seed Due Recurring Transaction Template
    // Start date is May 1st, next due date is June 1st (which is in the past compared to today's date June 8th).
    // This will trigger transaction auto-generation on user login!
    const recurringData = [
      {
        title: 'Netflix Subscription',
        amount: 15.49,
        type: 'expense',
        categoryName: 'Entertainment',
        frequency: 'monthly',
        startDate: '2026-05-01',
        nextDueDate: '2026-06-01',
        notes: 'Monthly standard streaming plan.'
      },
      {
        title: 'Weekly Gym Allowance',
        amount: 20.00,
        type: 'expense',
        categoryName: 'Entertainment',
        frequency: 'weekly',
        startDate: '2026-05-20',
        nextDueDate: '2026-06-03', // also due! Will create multiple weekly gym transactions (June 3)
        notes: 'Weekly personal health training budget.'
      }
    ];

    for (const rec of recurringData) {
      const categoryId = categoryIds[rec.categoryName];
      await client.query(
        `INSERT INTO recurring_transactions 
          (user_id, category_id, title, amount, type, notes, frequency, start_date, next_due_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
        [userId, categoryId, rec.title, rec.amount, rec.type, rec.notes, rec.frequency, rec.startDate, rec.nextDueDate]
      );
      console.log(`Scheduled active template: ${rec.title} (Next due: ${rec.nextDueDate})`);
    }

    await client.query('COMMIT');
    console.log('\n=========================================');
    console.log('Test Mock Data Seeding Completed Successfully!');
    console.log('Seeded User: test@spendora.com');
    console.log('Seeded Password: password123');
    console.log('=========================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during data seeding:', err);
    throw err;
  } finally {
    client.release();
  }
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

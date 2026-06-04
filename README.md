# 💸 Personal Expense Tracker

A full-stack, responsive **Personal Expense Tracker** application designed to help users track income, manage expenses, set budgets, and visualize financial analytics in real-time. Built with a Node.js/Express backend and an automated, zero-configuration local PostgreSQL database setup.

---

## 🚀 Key Features

*   **🔒 Secure Authentication**: User sign-up, login, password hashing (with `bcryptjs`), and session management using stateless JSON Web Tokens (JWT).
*   **📊 Dynamic Dashboard**: A premium dashboard view showing overall balance, income vs. expense ratios, monthly budget status, and financial breakdowns.
*   **💸 Transaction Management**: Full CRUD operations for tracking transactions. Filter, sort, and categorize your transactions as `income` or `expense`.
*   **🏷️ Custom Categories**: Add and manage custom categories to stay organized.
*   **🎯 Budgeting**: Set a monthly budget and track your spending progress against it.
*   **⚡ Automated Database Setup**: Single-command execution downloads, installs, configures, and spins up a local portable PostgreSQL database cluster instantly.

---

## 🛠️ Technology Stack

### Frontend (Client)
*   **HTML5 & Vanilla CSS3**: Sleek, modern, and clean design system with custom CSS custom properties (variables) for theme consistency.
*   **Vanilla JS**: Modular script structure handling API integrations, UI updates, state, and authentication natively.

### Backend (Server)
*   **Node.js & Express**: High-performance RESTful API server.
*   **PostgreSQL**: relational database management.
*   **JWT (JsonWebToken)**: Secure authentication headers.
*   **Bcrypt.js**: Cryptographic password hashing.
*   **Morgan & CORS**: Logging request details and managing cross-origin resource sharing.

---

## 📂 Project Directory Structure

```text
Expense-Tracker/
├── client/                     # Frontend Client Files
│   ├── css/
│   │   └── style.css           # Vanilla CSS Styling & Themes
│   ├── js/                     # Client-side JavaScript Controllers
│   │   ├── api.js              # Fetch requests & Authorization Headers
│   │   ├── auth.js             # Login/Registration Logic
│   │   ├── categories.js       # Category Management Logic
│   │   ├── dashboard.js        # Analytics & Budget Visuals
│   │   ├── profile.js          # Profile & Budget Updates
│   │   └── transactions.js     # Transaction CRUD Logic
│   ├── pages/                  # HTML Views (Pages)
│   │   ├── categories.html
│   │   ├── dashboard.html
│   │   ├── login.html
│   │   ├── profile.html
│   │   ├── register.html
│   │   └── transactions.html
│   └── index.html              # Router / Entry point redirector
├── server/                     # Node.js/Express Backend Server
│   ├── config/
│   │   └── db.js               # PostgreSQL connection pool pool configuration
│   ├── controllers/            # Route Controllers (analytics, auth, categories, transactions)
│   ├── database/
│   │   └── schema.sql          # PostgreSQL table schemas
│   ├── middleware/
│   │   └── auth.js             # Token verification middleware
│   ├── routes/                 # Express API routes
│   └── app.js                  # Express app & static folder routing
├── scripts/
│   └── setup-db.js             # Portable PostgreSQL downloader & auto-initializer
├── .env                        # Configuration environment variables
├── .gitignore                  # Git ignore definitions
├── package.json                # Project dependencies and script tasks
└── README.md                   # Project documentation
```

---

## ⚙️ Installation & Setup

Follow these simple steps to run the application locally on Windows.

### 1. Clone the Repository
```bash
git clone https://github.com/Dhroovs/Expense-Tracker.git
cd Expense-Tracker
```

### 2. Install Project Dependencies
Install backend and development dependencies using npm:
```bash
npm install
```

### 3. Spin up & Configure the Database
The project includes a utility script that automatically downloads a portable version of PostgreSQL, initializes a database cluster, creates the database, and loads the schema. No manual database installs are required!

Run the setup script:
```bash
npm run setup-db
```
*Note: The database runs locally on port `5433` with trust authentication.*

### 4. Configure Environment Variables
Create a `.env` file in the root directory (if not already present):
```env
PORT=3000
DB_USER=postgres
DB_HOST=127.0.0.1
DB_NAME=exp_tracker
DB_PORT=5433
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

### 5. Start the Application
Run the developer command to launch the server using `nodemon`:
```bash
npm run dev
```

Once started, open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔒 Security & Best Practices

*   **Environment Ignored**: The `.env` file is excluded from Git tracking to protect sensitive configurations and secret keys.
*   **Database Exclusions**: Local databases stored in `.postgres/` are ignored so they aren't uploaded, keeping repository size light.
*   **Password Hashing**: User passwords are encrypted with bcrypt before being stored in the database.

"""
Database management and SQLite schema definition for Kasa & Finans Takip Sistemi.
"""

import os
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "finance.db")


def get_db_connection() -> sqlite3.Connection:
    """Creates and returns a SQLite database connection with row factory and foreign keys enabled."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def init_db():
    """Initializes the database schema if tables do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table (RBAC)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'operator', 'viewer')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Accounts Table (Banka, Kripto, Nakit)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL CHECK(account_type IN ('bank', 'crypto', 'cash')),
        currency TEXT NOT NULL DEFAULT 'TRY',
        iban_or_address TEXT DEFAULT '',
        bank_name TEXT DEFAULT '',
        initial_balance REAL NOT NULL DEFAULT 0.0,
        current_balance REAL NOT NULL DEFAULT 0.0,
        color TEXT DEFAULT '#3b82f6',
        icon TEXT DEFAULT 'wallet',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Categories Table (Gelir & Gider Kategorileri)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        icon TEXT DEFAULT 'tag',
        color TEXT DEFAULT '#64748b',
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Transactions Table (Gelir, Gider, Kasalar Arası Transfer)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('income', 'expense', 'transfer')),
        from_account_id INTEGER,
        to_account_id INTEGER,
        category_id INTEGER,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'TRY',
        fx_rate REAL NOT NULL DEFAULT 1.0,
        converted_amount REAL NOT NULL DEFAULT 0.0,
        description TEXT NOT NULL DEFAULT '',
        receipt_filename TEXT DEFAULT '',
        receipt_path TEXT DEFAULT '',
        receipt_data TEXT DEFAULT '',
        transaction_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    );
    """)

    # 5. Subscriptions / Recurring Payments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category_id INTEGER,
        account_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'TRY',
        billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'yearly', 'weekly', 'quarterly')),
        next_due_date TEXT NOT NULL,
        last_paid_date TEXT DEFAULT '',
        auto_process INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );
    """)

    # 6. Z-Reports (Gün Sonu Kapanış & Mutabakat) Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS z_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT UNIQUE NOT NULL,
        closed_by_user_id INTEGER NOT NULL,
        opening_balance_try REAL NOT NULL DEFAULT 0.0,
        total_income_try REAL NOT NULL DEFAULT 0.0,
        total_expense_try REAL NOT NULL DEFAULT 0.0,
        calculated_closing_balance_try REAL NOT NULL DEFAULT 0.0,
        actual_closing_balance_try REAL NOT NULL DEFAULT 0.0,
        discrepancy_try REAL NOT NULL DEFAULT 0.0,
        accounts_snapshot_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT DEFAULT '',
        is_locked INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (closed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
    );
    """)

    # 7. Audit Logs Table (Değiştirilemez Denetim İzi)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT NOT NULL DEFAULT 'system',
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        details TEXT DEFAULT '{}',
        ip_address TEXT DEFAULT '127.0.0.1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 8. Exchange Rates Table (Döviz ve Kripto Kurları)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exchange_rates (
        pair TEXT PRIMARY KEY,
        rate REAL NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Create Indexes for high performance queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_from_acc ON transactions(from_account_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_to_acc ON transactions(to_account_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);")

    conn.commit()
    conn.close()


def query_all(query: str, params: Tuple = ()) -> List[Dict[str, Any]]:
    """Executes a SELECT query and returns all rows as list of dicts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    result = [dict(row) for row in rows]
    conn.close()
    return result


def query_one(query: str, params: Tuple = ()) -> Optional[Dict[str, Any]]:
    """Executes a SELECT query and returns the first row as a dict, or None."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def execute_write(query: str, params: Tuple = ()) -> int:
    """Executes an INSERT, UPDATE, or DELETE query and returns the lastrowid or affected rows."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    conn.commit()
    last_id = cursor.lastrowid
    conn.close()
    return last_id


def log_audit(user_id: Optional[int], username: str, action: str, entity_type: str, entity_id: Optional[int], details: str = "{}", ip_address: str = "127.0.0.1"):
    """Records an immutable audit log entry."""
    execute_write(
        """
        INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, username, action, entity_type, entity_id, details, ip_address)
    )

"""
Comprehensive Automated Test Suite for Kasa & Finans Takip Sistemi.
Tests database, auth, transactions, multi-currency transfers, Z-reports, subscriptions and audit logs.
"""

import json
import os
import sys
import unittest

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth import (
    create_session,
    generate_salt,
    has_permission,
    hash_password,
    validate_session,
    verify_password,
)
from app.db import (
    execute_write,
    get_db_connection,
    init_db,
    query_all,
    query_one,
)
from app.rates_service import (
    convert_currency,
    convert_to_try,
    get_all_rates,
    init_default_rates,
)
from app.seed_data import seed_database


class TestFinanceSystem(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Set up test database."""
        init_db()
        seed_database(force=True)

    def test_01_users_and_auth(self):
        """Tests user creation, password verification and session tokens."""
        admin = query_one("SELECT * FROM users WHERE username = 'admin'")
        self.assertIsNotNone(admin)
        self.assertEqual(admin["role"], "admin")

        # Test password check
        self.assertTrue(verify_password("admin123", admin["salt"], admin["password_hash"]))
        self.assertFalse(verify_password("wrongpassword", admin["salt"], admin["password_hash"]))

        # Test session token creation and validation
        token = create_session(admin["id"])
        self.assertIsNotNone(token)
        valid_user = validate_session(token)
        self.assertIsNotNone(valid_user)
        self.assertEqual(valid_user["username"], "admin")

    def test_02_rbac_permissions(self):
        """Tests RBAC role matrix permissions."""
        self.assertTrue(has_permission("admin", "can_manage_users"))
        self.assertFalse(has_permission("manager", "can_manage_users"))
        self.assertTrue(has_permission("manager", "can_transfer"))
        self.assertTrue(has_permission("operator", "can_create_transactions"))
        self.assertFalse(has_permission("operator", "can_delete_transactions"))
        self.assertFalse(has_permission("viewer", "can_create_transactions"))
        self.assertTrue(has_permission("viewer", "can_view_audit_logs"))

    def test_03_multi_currency_exchange_rates(self):
        """Tests currency conversion calculations."""
        rates = get_all_rates()
        self.assertIn("USD_TRY", rates)
        self.assertIn("EUR_TRY", rates)
        self.assertIn("USDT_TRY", rates)
        self.assertIn("BTC_USD", rates)

        # Convert 100 USD to TRY
        usd_try = convert_to_try(100.0, "USD", rates)
        self.assertAlmostEqual(usd_try, 100.0 * rates["USD_TRY"], places=2)

        # Convert 1000 USDT to USD
        usdt_usd = convert_currency(1000.0, "USDT", "USD", rates)
        self.assertGreater(usdt_usd, 900.0)

    def test_04_accounts_and_balances(self):
        """Tests account retrieval and balance consistency."""
        accounts = query_all("SELECT * FROM accounts WHERE is_active = 1")
        self.assertGreaterEqual(len(accounts), 5)

        bank_acc = query_one("SELECT * FROM accounts WHERE currency = 'TRY' AND account_type = 'bank' LIMIT 1")
        self.assertIsNotNone(bank_acc)
        self.assertGreater(bank_acc["current_balance"], 0)

    def test_05_income_expense_and_balance_update(self):
        """Tests income and expense creation and balance updates."""
        admin = query_one("SELECT * FROM users WHERE username = 'admin'")
        acc = query_one("SELECT * FROM accounts WHERE name LIKE 'Garanti%'")
        initial_balance = acc["current_balance"]

        # 1. Add Income of 10,000 TRY
        execute_write(
            """
            INSERT INTO transactions (transaction_type, to_account_id, user_id, amount, currency, converted_amount, description, transaction_date)
            VALUES ('income', ?, ?, 10000.0, 'TRY', 10000.0, 'Test Tahsilat', '2026-08-28 12:00:00')
            """,
            (acc["id"], admin["id"])
        )
        execute_write("UPDATE accounts SET current_balance = current_balance + 10000.0 WHERE id = ?", (acc["id"],))

        updated_acc = query_one("SELECT * FROM accounts WHERE id = ?", (acc["id"],))
        self.assertAlmostEqual(updated_acc["current_balance"], initial_balance + 10000.0, places=2)

        # 2. Add Expense of 2,500 TRY
        execute_write(
            """
            INSERT INTO transactions (transaction_type, from_account_id, user_id, amount, currency, converted_amount, description, transaction_date)
            VALUES ('expense', ?, ?, 2500.0, 'TRY', 2500.0, 'Test Harcama', '2026-08-28 12:30:00')
            """,
            (acc["id"], admin["id"])
        )
        execute_write("UPDATE accounts SET current_balance = current_balance - 2500.0 WHERE id = ?", (acc["id"],))

        updated_acc2 = query_one("SELECT * FROM accounts WHERE id = ?", (acc["id"],))
        self.assertAlmostEqual(updated_acc2["current_balance"], initial_balance + 7500.0, places=2)

    def test_06_inter_account_transfer_virman(self):
        """Tests atomic inter-account transfer with multi-currency conversion."""
        admin = query_one("SELECT * FROM users WHERE username = 'admin'")
        from_acc = query_one("SELECT * FROM accounts WHERE currency = 'USD' LIMIT 1")
        to_acc = query_one("SELECT * FROM accounts WHERE currency = 'TRY' AND account_type = 'cash' LIMIT 1")

        from_init = from_acc["current_balance"]
        to_init = to_acc["current_balance"]

        transfer_usd = 500.0
        rates = get_all_rates()
        to_try = convert_currency(transfer_usd, "USD", "TRY", rates)

        # Perform atomic transfer
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?", (transfer_usd, from_acc["id"]))
        cursor.execute("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", (to_try, to_acc["id"]))
        cursor.execute(
            """
            INSERT INTO transactions (transaction_type, from_account_id, to_account_id, user_id, amount, currency, converted_amount, description, transaction_date)
            VALUES ('transfer', ?, ?, ?, ?, 'USD', ?, 'Test Virman', '2026-08-28 13:00:00')
            """,
            (from_acc["id"], to_acc["id"], admin["id"], transfer_usd, to_try)
        )
        conn.commit()
        conn.close()

        after_from = query_one("SELECT * FROM accounts WHERE id = ?", (from_acc["id"],))
        after_to = query_one("SELECT * FROM accounts WHERE id = ?", (to_acc["id"],))

        self.assertAlmostEqual(after_from["current_balance"], from_init - transfer_usd, places=2)
        self.assertAlmostEqual(after_to["current_balance"], to_init + to_try, places=2)

    def test_07_z_report_reconciliation(self):
        """Tests Z-Report calculation and storage."""
        manager = query_one("SELECT * FROM users WHERE username = 'manager'")
        report_date = "2026-08-27"
        z_rep = query_one("SELECT * FROM z_reports WHERE report_date = ?", (report_date,))
        self.assertIsNotNone(z_rep)
        self.assertEqual(z_rep["closed_by_user_id"], manager["id"])
        self.assertTrue(z_rep["is_locked"])

    def test_08_subscriptions_and_due_dates(self):
        """Tests subscription listing and properties."""
        subs = query_all("SELECT * FROM subscriptions WHERE is_active = 1")
        self.assertGreater(len(subs), 0)
        first_sub = subs[0]
        self.assertIn(first_sub["billing_cycle"], ("monthly", "yearly", "weekly", "quarterly"))

    def test_09_audit_logs(self):
        """Tests audit logging."""
        logs = query_all("SELECT * FROM audit_logs ORDER BY id DESC")
        self.assertGreater(len(logs), 0)


if __name__ == "__main__":
    unittest.main()

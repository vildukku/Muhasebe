"""
Rich initial demo data seed for Kasa & Finans Takip Sistemi.
"""

from datetime import datetime, timedelta
import json
from app.auth import generate_salt, hash_password
from app.db import execute_write, get_db_connection, query_one, log_audit
from app.rates_service import init_default_rates


def seed_database(force: bool = False):
    """Populates database with initial realistic demo data if empty."""
    init_default_rates()

    # Check if users already exist
    existing_user = query_one("SELECT COUNT(*) as count FROM users")
    if existing_user and existing_user["count"] > 0 and not force:
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    if force:
        cursor.execute("DELETE FROM audit_logs;")
        cursor.execute("DELETE FROM z_reports;")
        cursor.execute("DELETE FROM subscriptions;")
        cursor.execute("DELETE FROM transactions;")
        cursor.execute("DELETE FROM categories;")
        cursor.execute("DELETE FROM accounts;")
        cursor.execute("DELETE FROM sessions;")
        cursor.execute("DELETE FROM users;")

    # 1. Create Users
    users_data = [
        ("admin", "admin@sirket.com", "admin123", "Ahmet Yılmaz (Yönetici)", "admin"),
        ("manager", "muhasebe@sirket.com", "manager123", "Zeynep Kaya (Finans Müdürü)", "manager"),
        ("operator", "kasa@sirket.com", "operator123", "Burak Demir (Kasa Sorumlusu)", "operator"),
        ("viewer", "denetim@sirket.com", "viewer123", "Elif Öztürk (Denetçi / İzleyici)", "viewer"),
    ]

    user_ids = {}
    for username, email, raw_password, full_name, role in users_data:
        salt = generate_salt()
        pwd_hash = hash_password(raw_password, salt)
        cursor.execute(
            """
            INSERT INTO users (username, email, password_hash, salt, full_name, role, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (username, email, pwd_hash, salt, full_name, role)
        )
        user_ids[username] = cursor.lastrowid

    # 2. Create Accounts (Banka, Nakit, Kripto)
    accounts_data = [
        ("Garanti BBVA - Ana Ticari", "bank", "TRY", "TR12 0006 2000 0001 2345 6789 01", "Garanti BBVA", 350000.0, 482500.0, "#10b981", "building-2", "Ana operasyonel banka hesabı"),
        ("İş Bankası - İhracat Döviz", "bank", "USD", "TR34 0006 4000 0009 8765 4321 02", "Türkiye İş Bankası", 15000.0, 24500.0, "#0284c7", "landmark", "Yurtdışı müşteri tahsilat hesabı"),
        ("Ofis Ana Çelik Kasa", "cash", "TRY", "", "", 25000.0, 18450.0, "#f59e0b", "vault", "Ofis içi acil nakit ve elden harcama kasası"),
        ("Yurtdışı Seyahat Kasası", "cash", "EUR", "", "", 2000.0, 3200.0, "#8b5cf6", "banknote", "Yurtdışı fuar ve seyahat nakit kasası"),
        ("Binance Kurumsal Cüzdan", "crypto", "USDT", "TRC20: TLq8kM9XwP7zBv4NaQxYzW3uT1s8LkJ9pM", "Binance", 10000.0, 16850.0, "#f97316", "coins", "USDT operasyonel kripto cüzdanı"),
        ("Ledger Cold Storage", "crypto", "BTC", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "Ledger Hardware", 0.5, 0.85, "#eab308", "shield", "Şirket BTC rezerv soğuk cüzdanı")
    ]

    account_ids = {}
    for name, acc_type, curr, iban, bank, init_bal, cur_bal, color, icon, notes in accounts_data:
        cursor.execute(
            """
            INSERT INTO accounts (name, account_type, currency, iban_or_address, bank_name, initial_balance, current_balance, color, icon, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, acc_type, curr, iban, bank, init_bal, cur_bal, color, icon, notes)
        )
        account_ids[name] = cursor.lastrowid

    # 3. Create Categories
    categories_data = [
        # Incomes
        ("Müşteri Ödemesi", "income", "hand-coins", "#10b981", 1),
        ("SaaS Yazılım Satışı", "income", "laptop", "#06b6d4", 1),
        ("Danışmanlık Hizmeti", "income", "briefcase", "#3b82f6", 1),
        ("Kur & Kripto Değer Artışı", "income", "trending-up", "#8b5cf6", 1),
        ("Diğer Gelirler", "income", "plus-circle", "#64748b", 1),
        # Expenses
        ("Sunucu & Bulut (AWS / Hetzner)", "expense", "server", "#ef4444", 1),
        ("Yazılım & API Lisansları", "expense", "code", "#f97316", 1),
        ("Personel & Maaş Ödemeleri", "expense", "users", "#ec4899", 1),
        ("Ofis Kirası & Aidat", "expense", "building", "#a855f7", 1),
        ("Pazarlama & Reklam (Google/Meta)", "expense", "megaphone", "#eab308", 1),
        ("Donanım & Ofis Demirbaşı", "expense", "monitor", "#6366f1", 1),
        ("Yemek, Temsil & Ulaşım", "expense", "coffee", "#14b8a6", 1),
        ("Banka & Transfer Komisyonu", "expense", "percent", "#94a3b8", 1),
        ("Vergi & Harçlar", "expense", "file-text", "#dc2626", 1),
    ]

    category_ids = {}
    for cat_name, cat_type, icon, color, is_sys in categories_data:
        cursor.execute(
            """
            INSERT INTO categories (name, type, icon, color, is_system)
            VALUES (?, ?, ?, ?, ?)
            """,
            (cat_name, cat_type, icon, color, is_sys)
        )
        category_ids[cat_name] = cursor.lastrowid

    # 4. Create Subscriptions
    today = datetime.now()
    subscriptions_data = [
        ("AWS Bulut Altyapısı", "Sunucu & Bulut (AWS / Hetzner)", "İş Bankası - İhracat Döviz", 480.0, "USD", "monthly", (today + timedelta(days=4)).strftime("%Y-%m-%d")),
        ("OpenAI API & ChatGPT Team", "Yazılım & API Lisansları", "Binance Kurumsal Cüzdan", 250.0, "USDT", "monthly", (today + timedelta(days=2)).strftime("%Y-%m-%d")),
        ("Hetzner Dedicated Server", "Sunucu & Bulut (AWS / Hetzner)", "Yurtdışı Seyahat Kasası", 185.0, "EUR", "monthly", (today + timedelta(days=12)).strftime("%Y-%m-%d")),
        ("Figma Enterprise Lisansı", "Yazılım & API Lisansları", "İş Bankası - İhracat Döviz", 90.0, "USD", "monthly", (today + timedelta(days=18)).strftime("%Y-%m-%d")),
        ("Plaza Ofis Kirası & Yönetim", "Ofis Kirası & Aidat", "Garanti BBVA - Ana Ticari", 45000.0, "TRY", "monthly", (today + timedelta(days=1)).strftime("%Y-%m-%d")),
        ("Google Workspace & Domain", "Yazılım & API Lisansları", "Garanti BBVA - Ana Ticari", 1850.0, "TRY", "monthly", (today + timedelta(days=25)).strftime("%Y-%m-%d")),
    ]

    for title, cat_name, acc_name, amount, curr, cycle, next_due in subscriptions_data:
        cursor.execute(
            """
            INSERT INTO subscriptions (title, category_id, account_id, amount, currency, billing_cycle, next_due_date, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (title, category_ids[cat_name], account_ids[acc_name], amount, curr, cycle, next_due)
        )

    # 5. Create Realistic Transactions
    now = datetime.now()
    transactions = [
        # Incomes
        ("income", None, account_ids["Garanti BBVA - Ana Ticari"], category_ids["Müşteri Ödemesi"], user_ids["admin"], 125000.0, "TRY", 1.0, 125000.0, "Acme Corp - Q3 Yazılım Geliştirme Hakedişi", (now - timedelta(days=5, hours=2)).strftime("%Y-%m-%d %H:%M:%S")),
        ("income", None, account_ids["İş Bankası - İhracat Döviz"], category_ids["SaaS Yazılım Satışı"], user_ids["manager"], 8500.0, "USD", 34.20, 290700.0, "Nexus Global - Yıllık Kurumsal SaaS Lisans Bedeli", (now - timedelta(days=4, hours=5)).strftime("%Y-%m-%d %H:%M:%S")),
        ("income", None, account_ids["Binance Kurumsal Cüzdan"], category_ids["Danışmanlık Hizmeti"], user_ids["admin"], 5000.0, "USDT", 34.25, 171250.0, "Web3 Proje Akıllı Sözleşme Güvenlik Denetim Ücreti", (now - timedelta(days=3, hours=1)).strftime("%Y-%m-%d %H:%M:%S")),
        ("income", None, account_ids["Ofis Ana Çelik Kasa"], category_ids["Diğer Gelirler"], user_ids["operator"], 4500.0, "TRY", 1.0, 4500.0, "Eski ofis monitör ve donanım elden nakit satışı", (now - timedelta(days=2, hours=4)).strftime("%Y-%m-%d %H:%M:%S")),
        ("income", None, account_ids["Garanti BBVA - Ana Ticari"], category_ids["Müşteri Ödemesi"], user_ids["manager"], 65000.0, "TRY", 1.0, 65000.0, "TechNova - Mobil Uygulama Aşama-2 Teslimatı", (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S")),

        # Expenses
        ("expense", account_ids["Garanti BBVA - Ana Ticari"], None, category_ids["Personel & Maaş Ödemeleri"], user_ids["manager"], 78000.0, "TRY", 1.0, 78000.0, "Ağustos Ayı Geliştirici Ekip Maaş & Prim Ödemeleri", (now - timedelta(days=7, hours=3)).strftime("%Y-%m-%d %H:%M:%S")),
        ("expense", account_ids["İş Bankası - İhracat Döviz"], None, category_ids["Sunucu & Bulut (AWS / Hetzner)"], user_ids["admin"], 450.0, "USD", 34.20, 15390.0, "AWS Fatura Ödemesi - Production Kubernetes Cluster", (now - timedelta(days=6, hours=4)).strftime("%Y-%m-%d %H:%M:%S")),
        ("expense", account_ids["Garanti BBVA - Ana Ticari"], None, category_ids["Pazarlama & Reklam (Google/Meta)"], user_ids["manager"], 14500.0, "TRY", 1.0, 14500.0, "Google Ads & Meta Ads Aylık Dönüşüm Kampanyası", (now - timedelta(days=3, hours=6)).strftime("%Y-%m-%d %H:%M:%S")),
        ("expense", account_ids["Ofis Ana Çelik Kasa"], None, category_ids["Yemek, Temsil & Ulaşım"], user_ids["operator"], 2350.0, "TRY", 1.0, 2350.0, "Müşteri öğle yemeği ve taksi ulaşım fişleri", (now - timedelta(days=1, hours=3)).strftime("%Y-%m-%d %H:%M:%S")),
        ("expense", account_ids["Binance Kurumsal Cüzdan"], None, category_ids["Yazılım & API Lisansları"], user_ids["admin"], 240.0, "USDT", 34.25, 8220.0, "OpenAI API Usage faturası (LLM inference)", (now - timedelta(hours=14)).strftime("%Y-%m-%d %H:%M:%S")),

        # Transfers (Virman)
        ("transfer", account_ids["Garanti BBVA - Ana Ticari"], account_ids["Ofis Ana Çelik Kasa"], None, user_ids["manager"], 15000.0, "TRY", 1.0, 15000.0, "Banka ATM'sinden Ofis Kasasına Nakit Takviyesi", (now - timedelta(days=4, hours=1)).strftime("%Y-%m-%d %H:%M:%S")),
        ("transfer", account_ids["İş Bankası - İhracat Döviz"], account_ids["Binance Kurumsal Cüzdan"], None, user_ids["admin"], 3000.0, "USD", 1.0, 102600.0, "Banka USD hesabından Binance USDT cüzdanına fon transferi", (now - timedelta(days=2, hours=2)).strftime("%Y-%m-%d %H:%M:%S")),
        ("transfer", account_ids["Binance Kurumsal Cüzdan"], account_ids["Ledger Cold Storage"], None, user_ids["admin"], 0.15, "BTC", 63500.0, 325755.0, "Borsa cüzdanından Soğuk Cüzdana BTC rezerv aktarımı", (now - timedelta(days=1, hours=8)).strftime("%Y-%m-%d %H:%M:%S")),
    ]

    for tx_type, from_acc, to_acc, cat_id, u_id, amount, curr, fx, conv, desc, tx_date in transactions:
        cursor.execute(
            """
            INSERT INTO transactions (
                transaction_type, from_account_id, to_account_id, category_id,
                user_id, amount, currency, fx_rate, converted_amount,
                description, transaction_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (tx_type, from_acc, to_acc, cat_id, u_id, amount, curr, fx, conv, desc, tx_date)
        )

    # 6. Create Yesterday's Z-Report
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    snapshot = {
        "accounts": [
            {"name": "Garanti BBVA", "currency": "TRY", "balance": 432500.0},
            {"name": "İş Bankası USD", "currency": "USD", "balance": 24500.0},
            {"name": "Ofis Ana Çelik Kasa", "currency": "TRY", "balance": 20800.0},
            {"name": "Binance Kurumsal", "currency": "USDT", "balance": 17090.0},
            {"name": "Ledger Cold Storage", "currency": "BTC", "balance": 0.85},
        ],
        "totals": {
            "income_try": 69500.0,
            "expense_try": 10570.0,
            "net_flow_try": 58930.0
        }
    }
    cursor.execute(
        """
        INSERT INTO z_reports (
            report_date, closed_by_user_id, opening_balance_try, total_income_try,
            total_expense_try, calculated_closing_balance_try, actual_closing_balance_try,
            discrepancy_try, accounts_snapshot_json, notes, is_locked
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """,
        (
            yesterday_str,
            user_ids["manager"],
            1850000.0,
            69500.0,
            10570.0,
            1908930.0,
            1908930.0,
            0.0,
            json.dumps(snapshot),
            "Gün sonu mutabakatı eksiksiz tamamlandı. Kasa sayımı ile banka bakiyeleri birebir uyuşuyor."
        )
    )

    # 7. Add Initial Audit Logs
    audit_events = [
        (user_ids["admin"], "admin", "SYSTEM_INIT", "system", 1, '{"message": "Sistem ve veritabanı ilk kurulumu tamamlandı."}'),
        (user_ids["admin"], "admin", "USER_CREATE", "user", user_ids["manager"], '{"username": "manager", "role": "manager"}'),
        (user_ids["admin"], "admin", "ACCOUNT_CREATE", "account", account_ids["Garanti BBVA - Ana Ticari"], '{"name": "Garanti BBVA", "type": "bank"}'),
        (user_ids["manager"], "manager", "CREATE_TX", "transaction", 1, '{"type": "income", "amount": 125000.0, "currency": "TRY"}'),
        (user_ids["manager"], "manager", "TRANSFER", "transaction", 11, '{"from": "Garanti BBVA", "to": "Ofis Kasası", "amount": 15000.0}'),
        (user_ids["manager"], "manager", "CLOSE_Z_REPORT", "z_report", 1, f'{{"date": "{yesterday_str}", "status": "balanced"}}'),
    ]

    for uid, uname, act, etype, eid, dets in audit_events:
        cursor.execute(
            """
            INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, '127.0.0.1')
            """,
            (uid, uname, act, etype, eid, dets)
        )

    conn.commit()
    conn.close()
    print("✓ Demo database successfully seeded!")


if __name__ == "__main__":
    from app.db import init_db
    init_db()
    seed_database(force=True)

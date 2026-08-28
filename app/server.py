"""
High-Performance HTTP/REST API and SPA Server for Kasa & Finans Takip Sistemi.
"""

import cgi
import csv
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import mimetypes
import os
import posixpath
import re
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

from app.auth import (
    create_session,
    delete_session,
    has_permission,
    hash_password,
    generate_salt,
    validate_session,
    verify_password,
)
from app.db import (
    execute_write,
    get_db_connection,
    init_db,
    log_audit,
    query_all,
    query_one,
)
from app.rates_service import (
    convert_currency,
    convert_to_try,
    get_all_rates,
    set_rate,
    sync_live_rates,
)
from app.seed_data import seed_database

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "app", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class FinanceRequestHandler(SimpleHTTPRequestHandler):
    """Custom request handler supporting REST API endpoints and static SPA routing."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def log_message(self, format, *args):
        # Clean terminal logging
        pass

    def send_json(self, data: Any, status_code: int = 200):
        """Helper to send JSON response."""
        response_bytes = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_json(self, message: str, status_code: int = 400):
        """Helper to send error JSON response."""
        self.send_json({"error": True, "message": message}, status_code=status_code)

    def get_auth_user(self) -> Optional[Dict[str, Any]]:
        """Extracts and validates user from Authorization header or cookie."""
        auth_header = self.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif "Cookie" in self.headers:
            cookies = self.headers.get("Cookie", "")
            for cookie in cookies.split(";"):
                cookie = cookie.strip()
                if cookie.startswith("token="):
                    token = cookie[6:]
                    break

        if not token:
            return None
        return validate_session(token)

    def read_json_body(self) -> Dict[str, Any]:
        """Reads and parses JSON body from request."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(body)
        except Exception:
            return {}

    def get_client_ip(self) -> str:
        """Extracts client IP address."""
        forwarded = self.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0] if self.client_address else "127.0.0.1"

    def do_OPTIONS(self):
        """Handles CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        """Handles GET requests for API endpoints and static assets."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # 1. API Endpoints
        if path.startswith("/api/"):
            self.handle_api_get(path, query_params)
            return

        # 2. Uploaded Receipts / Invoices Serving
        if path.startswith("/uploads/"):
            filename = os.path.basename(path)
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                self.serve_file(file_path)
                return
            else:
                self.send_error_json("Dosya bulunamadı", 404)
                return

        # 3. Static Files & SPA Fallback
        static_file_path = os.path.join(STATIC_DIR, path.lstrip("/"))
        if os.path.exists(static_file_path) and os.path.isfile(static_file_path):
            self.serve_file(static_file_path)
            return

        # Serve index.html for SPA frontend routes
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            self.serve_file(index_path)
            return

        self.send_error(404, "Page Not Found")

    def do_POST(self):
        """Handles POST requests for API endpoints."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path.startswith("/api/"):
            self.handle_api_post(path, query_params)
            return

        self.send_error_json("Endpoint not found", 404)

    def do_PUT(self):
        """Handles PUT requests for API endpoints."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path.startswith("/api/"):
            self.handle_api_put(path, query_params)
            return

        self.send_error_json("Endpoint not found", 404)

    def do_DELETE(self):
        """Handles DELETE requests for API endpoints."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path.startswith("/api/"):
            self.handle_api_delete(path, query_params)
            return

        self.send_error_json("Endpoint not found", 404)

    def serve_file(self, filepath: str):
        """Serves a file with appropriate MIME type."""
        mime_type, _ = mimetypes.guess_type(filepath)
        if mime_type is None:
            mime_type = "application/octet-stream"
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {str(e)}")

    # ----------------------------------------------------
    # API ROUTERS
    # ----------------------------------------------------

    def handle_api_get(self, path: str, params: Dict[str, List[str]]):
        """Routes GET API calls."""
        # Unauthenticated endpoints
        if path == "/api/auth/me":
            user = self.get_auth_user()
            if not user:
                self.send_error_json("Yetkisiz erişim / Oturum bulunamadı", 401)
                return
            user["permissions"] = {
                "can_manage_accounts": has_permission(user["role"], "can_manage_accounts"),
                "can_create_transactions": has_permission(user["role"], "can_create_transactions"),
                "can_edit_transactions": has_permission(user["role"], "can_edit_transactions"),
                "can_delete_transactions": has_permission(user["role"], "can_delete_transactions"),
                "can_transfer": has_permission(user["role"], "can_transfer"),
                "can_manage_z_reports": has_permission(user["role"], "can_manage_z_reports"),
                "can_manage_subscriptions": has_permission(user["role"], "can_manage_subscriptions"),
                "can_manage_users": has_permission(user["role"], "can_manage_users"),
                "can_view_audit_logs": has_permission(user["role"], "can_view_audit_logs"),
            }
            self.send_json({"success": True, "user": user})
            return

        if path == "/api/rates":
            rates = get_all_rates()
            self.send_json({"success": True, "rates": rates})
            return

        # Require authenticated user for all other endpoints
        user = self.get_auth_user()
        if not user:
            self.send_error_json("Oturum süresi dolmuş veya geçersiz. Lütfen tekrar giriş yapın.", 401)
            return

        # 1. Dashboard Summary
        if path == "/api/dashboard/summary":
            self.get_dashboard_summary()
            return

        # 2. Accounts
        if path == "/api/accounts":
            self.get_accounts()
            return

        # 3. Categories
        if path == "/api/categories":
            categories = query_all("SELECT * FROM categories ORDER BY type, name ASC")
            self.send_json({"success": True, "categories": categories})
            return

        # 4. Transactions
        if path == "/api/transactions":
            self.get_transactions(params)
            return

        if path == "/api/transactions/export":
            self.export_transactions_csv(params)
            return

        if path.startswith("/api/transactions/"):
            tx_id = path.split("/")[-1]
            if tx_id.isdigit():
                tx = query_one(
                    """
                    SELECT t.*, u.full_name as created_by_user,
                           c.name as category_name, c.color as category_color, c.icon as category_icon,
                           fa.name as from_account_name, fa.currency as from_account_currency,
                           ta.name as to_account_name, ta.currency as to_account_currency
                    FROM transactions t
                    LEFT JOIN users u ON t.user_id = u.id
                    LEFT JOIN categories c ON t.category_id = c.id
                    LEFT JOIN accounts fa ON t.from_account_id = fa.id
                    LEFT JOIN accounts ta ON t.to_account_id = ta.id
                    WHERE t.id = ?
                    """,
                    (int(tx_id),)
                )
                if tx:
                    self.send_json({"success": True, "transaction": tx})
                else:
                    self.send_error_json("İşlem bulunamadı", 404)
                return

        # 5. Subscriptions
        if path == "/api/subscriptions":
            self.get_subscriptions()
            return

        # 6. Z-Reports
        if path == "/api/z-reports":
            reports = query_all(
                """
                SELECT z.*, u.full_name as closed_by_name
                FROM z_reports z
                JOIN users u ON z.closed_by_user_id = u.id
                ORDER BY z.report_date DESC
                LIMIT 60
                """
            )
            self.send_json({"success": True, "reports": reports})
            return

        if path == "/api/z-reports/preview":
            report_date = params.get("date", [datetime.now().strftime("%Y-%m-%d")])[0]
            self.preview_z_report(report_date)
            return

        if path.startswith("/api/z-reports/"):
            zr_id = path.split("/")[-1]
            if zr_id.isdigit():
                zr = query_one(
                    """
                    SELECT z.*, u.full_name as closed_by_name
                    FROM z_reports z
                    JOIN users u ON z.closed_by_user_id = u.id
                    WHERE z.id = ?
                    """,
                    (int(zr_id),)
                )
                if zr:
                    try:
                        zr["accounts_snapshot"] = json.loads(zr["accounts_snapshot_json"])
                    except Exception:
                        zr["accounts_snapshot"] = {}
                    self.send_json({"success": True, "report": zr})
                else:
                    self.send_error_json("Z-Raporu bulunamadı", 404)
                return

        # 7. Reports & Analytics
        if path == "/api/reports/category-expenses":
            self.get_report_category_expenses(params)
            return

        if path == "/api/reports/cash-flow":
            self.get_report_cash_flow(params)
            return

        if path == "/api/reports/account-volume":
            self.get_report_account_volume()
            return

        # 8. Users (Admin Only)
        if path == "/api/users":
            if not has_permission(user["role"], "can_manage_users"):
                self.send_error_json("Bu işlem için Admin yetkisi gereklidir", 403)
                return
            users = query_all("SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY id ASC")
            self.send_json({"success": True, "users": users})
            return

        # 9. Audit Logs
        if path == "/api/audit-logs":
            if not has_permission(user["role"], "can_view_audit_logs"):
                self.send_error_json("Bu işlem için yetkiniz bulunmamaktadır", 403)
                return
            limit = int(params.get("limit", [100])[0])
            logs = query_all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,))
            self.send_json({"success": True, "logs": logs})
            return

        self.send_error_json("Endpoint bulunamadı", 404)

    def handle_api_post(self, path: str, params: Dict[str, List[str]]):
        """Routes POST API calls."""
        # 1. Login
        if path == "/api/auth/login":
            data = self.read_json_body()
            username = (data.get("username") or "").strip()
            password = data.get("password") or ""

            if not username or not password:
                self.send_error_json("Kullanıcı adı ve parola zorunludur")
                return

            user = query_one("SELECT * FROM users WHERE username = ? OR email = ?", (username, username))
            if not user or not user["is_active"]:
                self.send_error_json("Geçersiz kullanıcı adı veya şifre", 401)
                return

            if not verify_password(password, user["salt"], user["password_hash"]):
                self.send_error_json("Geçersiz kullanıcı adı veya şifre", 401)
                return

            token = create_session(user["id"])
            log_audit(user["id"], user["username"], "LOGIN", "session", user["id"], '{"status": "success"}', self.get_client_ip())

            user_data = {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "full_name": user["full_name"],
                "role": user["role"],
            }
            self.send_json({"success": True, "token": token, "user": user_data})
            return

        # Check authenticated user for all other POST endpoints
        user = self.get_auth_user()
        if not user:
            self.send_error_json("Yetkisiz erişim. Lütfen giriş yapın.", 401)
            return

        # 2. Logout
        if path == "/api/auth/logout":
            token = self.headers.get("Authorization", "").replace("Bearer ", "").strip()
            if token:
                delete_session(token)
            log_audit(user["id"], user["username"], "LOGOUT", "session", user["id"], '{"status": "success"}', self.get_client_ip())
            self.send_json({"success": True, "message": "Başarıyla çıkış yapıldı"})
            return

        # 3. Rates Sync
        if path == "/api/rates/sync":
            rates = sync_live_rates()
            log_audit(user["id"], user["username"], "SYNC_RATES", "rates", None, json.dumps(rates), self.get_client_ip())
            self.send_json({"success": True, "rates": rates})
            return

        if path == "/api/rates/set":
            data = self.read_json_body()
            pair = data.get("pair")
            rate = float(data.get("rate", 0))
            if pair and rate > 0:
                set_rate(pair, rate)
                self.send_json({"success": True, "rates": get_all_rates()})
            else:
                self.send_error_json("Geçersiz kur bilgisi")
            return

        # 4. Create Account
        if path == "/api/accounts":
            if not has_permission(user["role"], "can_manage_accounts"):
                self.send_error_json("Hesap oluşturma yetkiniz yok", 403)
                return
            self.create_account(user)
            return

        # 5. Inter-Account Transfer (Virman)
        if path == "/api/accounts/transfer":
            if not has_permission(user["role"], "can_transfer"):
                self.send_error_json("Transfer yapma yetkiniz yok", 403)
                return
            self.process_transfer(user)
            return

        # 6. Create Transaction (Gelir / Gider)
        if path == "/api/transactions":
            if not has_permission(user["role"], "can_create_transactions"):
                self.send_error_json("İşlem oluşturma yetkiniz yok", 403)
                return
            self.create_transaction(user)
            return

        # 7. Create Category
        if path == "/api/categories":
            data = self.read_json_body()
            name = (data.get("name") or "").strip()
            cat_type = data.get("type", "expense")
            icon = data.get("icon", "tag")
            color = data.get("color", "#64748b")
            if not name:
                self.send_error_json("Kategori adı zorunludur")
                return
            cat_id = execute_write(
                "INSERT INTO categories (name, type, icon, color, is_system) VALUES (?, ?, ?, ?, 0)",
                (name, cat_type, icon, color)
            )
            log_audit(user["id"], user["username"], "CREATE_CATEGORY", "category", cat_id, json.dumps({"name": name, "type": cat_type}), self.get_client_ip())
            self.send_json({"success": True, "id": cat_id, "message": "Kategori eklendi"})
            return

        # 8. Subscriptions
        if path == "/api/subscriptions":
            if not has_permission(user["role"], "can_manage_subscriptions"):
                self.send_error_json("Abonelik yönetme yetkiniz yok", 403)
                return
            self.create_subscription(user)
            return

        if path.endswith("/pay") and "/api/subscriptions/" in path:
            sub_id = path.split("/")[-2]
            if sub_id.isdigit():
                self.pay_subscription(int(sub_id), user)
                return

        # 9. Close Z-Report
        if path == "/api/z-reports/close":
            if not has_permission(user["role"], "can_manage_z_reports"):
                self.send_error_json("Z-Raporu kapatma yetkiniz yok", 403)
                return
            self.close_z_report(user)
            return

        # 10. Users Management (Admin)
        if path == "/api/users":
            if not has_permission(user["role"], "can_manage_users"):
                self.send_error_json("Kullanıcı ekleme yetkiniz yok", 403)
                return
            self.create_user(user)
            return

        self.send_error_json("Endpoint bulunamadı", 404)

    def handle_api_put(self, path: str, params: Dict[str, List[str]]):
        """Routes PUT API calls."""
        user = self.get_auth_user()
        if not user:
            self.send_error_json("Yetkisiz erişim", 401)
            return

        if path.startswith("/api/accounts/"):
            acc_id = path.split("/")[-1]
            if acc_id.isdigit() and has_permission(user["role"], "can_manage_accounts"):
                self.update_account(int(acc_id), user)
                return

        if path.startswith("/api/subscriptions/"):
            sub_id = path.split("/")[-1]
            if sub_id.isdigit() and has_permission(user["role"], "can_manage_subscriptions"):
                self.update_subscription(int(sub_id), user)
                return

        if path.startswith("/api/users/"):
            target_user_id = path.split("/")[-1]
            if target_user_id.isdigit() and has_permission(user["role"], "can_manage_users"):
                self.update_user(int(target_user_id), user)
                return

        self.send_error_json("Endpoint bulunamadı veya yetkisiz", 404)

    def handle_api_delete(self, path: str, params: Dict[str, List[str]]):
        """Routes DELETE API calls."""
        user = self.get_auth_user()
        if not user:
            self.send_error_json("Yetkisiz erişim", 401)
            return

        if path.startswith("/api/transactions/"):
            tx_id = path.split("/")[-1]
            if tx_id.isdigit():
                if not has_permission(user["role"], "can_delete_transactions"):
                    self.send_error_json("İşlem silme yetkiniz yok", 403)
                    return
                self.delete_transaction(int(tx_id), user)
                return

        if path.startswith("/api/accounts/"):
            acc_id = path.split("/")[-1]
            if acc_id.isdigit():
                if not has_permission(user["role"], "can_manage_accounts"):
                    self.send_error_json("Hesap silme yetkiniz yok", 403)
                    return
                execute_write("UPDATE accounts SET is_active = 0 WHERE id = ?", (int(acc_id),))
                log_audit(user["id"], user["username"], "ARCHIVE_ACCOUNT", "account", int(acc_id), "{}", self.get_client_ip())
                self.send_json({"success": True, "message": "Hesap arşivlendi"})
                return

        if path.startswith("/api/subscriptions/"):
            sub_id = path.split("/")[-1]
            if sub_id.isdigit():
                if not has_permission(user["role"], "can_manage_subscriptions"):
                    self.send_error_json("Abonelik silme yetkiniz yok", 403)
                    return
                execute_write("DELETE FROM subscriptions WHERE id = ?", (int(sub_id),))
                log_audit(user["id"], user["username"], "DELETE_SUBSCRIPTION", "subscription", int(sub_id), "{}", self.get_client_ip())
                self.send_json({"success": True, "message": "Abonelik silindi"})
                return

        if path.startswith("/api/categories/"):
            cat_id = path.split("/")[-1]
            if cat_id.isdigit():
                cat = query_one("SELECT * FROM categories WHERE id = ?", (int(cat_id),))
                if cat and cat["is_system"]:
                    self.send_error_json("Sistem kategorileri silinemez", 400)
                    return
                execute_write("DELETE FROM categories WHERE id = ? AND is_system = 0", (int(cat_id),))
                log_audit(user["id"], user["username"], "DELETE_CATEGORY", "category", int(cat_id), "{}", self.get_client_ip())
                self.send_json({"success": True, "message": "Kategori silindi"})
                return

        self.send_error_json("Endpoint bulunamadı", 404)

    # ----------------------------------------------------
    # BUSINESS LOGIC & CONTROLLER METHODS
    # ----------------------------------------------------

    def get_dashboard_summary(self):
        """Calculates comprehensive net worth, cash flow and widget data."""
        rates = get_all_rates()
        accounts = query_all("SELECT * FROM accounts WHERE is_active = 1")

        total_net_worth_try = 0.0
        total_cash_try = 0.0
        total_bank_try = 0.0
        total_crypto_try = 0.0

        for acc in accounts:
            bal_try = convert_to_try(acc["current_balance"], acc["currency"], rates)
            acc["balance_in_try"] = bal_try
            total_net_worth_try += bal_try
            if acc["account_type"] == "cash":
                total_cash_try += bal_try
            elif acc["account_type"] == "bank":
                total_bank_try += bal_try
            elif acc["account_type"] == "crypto":
                total_crypto_try += bal_try

        total_net_worth_usd = convert_currency(total_net_worth_try, "TRY", "USD", rates)
        total_net_worth_eur = convert_currency(total_net_worth_try, "TRY", "EUR", rates)

        # 30-day cash flow totals
        now = datetime.now()
        thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")

        inflow_row = query_one(
            """
            SELECT COALESCE(SUM(converted_amount), 0) as total
            FROM transactions
            WHERE transaction_type = 'income' AND transaction_date >= ?
            """,
            (thirty_days_ago,)
        )
        outflow_row = query_one(
            """
            SELECT COALESCE(SUM(converted_amount), 0) as total
            FROM transactions
            WHERE transaction_type = 'expense' AND transaction_date >= ?
            """,
            (thirty_days_ago,)
        )

        inflow_30d = inflow_row["total"] if inflow_row else 0.0
        outflow_30d = outflow_row["total"] if outflow_row else 0.0
        net_cash_flow_30d = inflow_30d - outflow_30d

        # Today's totals
        today_start = now.strftime("%Y-%m-%d 00:00:00")
        today_inflow = query_one(
            "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'income' AND transaction_date >= ?",
            (today_start,)
        )["total"]
        today_outflow = query_one(
            "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'expense' AND transaction_date >= ?",
            (today_start,)
        )["total"]

        # Recent 8 transactions
        recent_txs = query_all(
            """
            SELECT t.*, u.full_name as user_full_name,
                   c.name as category_name, c.color as category_color, c.icon as category_icon,
                   fa.name as from_account_name, fa.currency as from_account_currency,
                   ta.name as to_account_name, ta.currency as to_account_currency
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            ORDER BY t.transaction_date DESC, t.id DESC
            LIMIT 8
            """
        )

        # Upcoming subscriptions in next 7 days
        next_week = (now + timedelta(days=7)).strftime("%Y-%m-%d")
        upcoming_subs = query_all(
            """
            SELECT s.*, c.name as category_name, a.name as account_name
            FROM subscriptions s
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN accounts a ON s.account_id = a.id
            WHERE s.is_active = 1 AND s.next_due_date <= ?
            ORDER BY s.next_due_date ASC
            LIMIT 5
            """,
            (next_week,)
        )

        self.send_json({
            "success": True,
            "net_worth": {
                "total_try": total_net_worth_try,
                "total_usd": total_net_worth_usd,
                "total_eur": total_net_worth_eur,
                "bank_try": total_bank_try,
                "cash_try": total_cash_try,
                "crypto_try": total_crypto_try,
            },
            "cash_flow_30d": {
                "inflow_try": inflow_30d,
                "outflow_try": outflow_30d,
                "net_try": net_cash_flow_30d,
            },
            "today": {
                "inflow_try": today_inflow,
                "outflow_try": today_outflow,
            },
            "accounts": accounts,
            "recent_transactions": recent_txs,
            "upcoming_subscriptions": upcoming_subs,
            "rates": rates
        })

    def get_accounts(self):
        """Returns list of all accounts with current valuation."""
        rates = get_all_rates()
        accounts = query_all("SELECT * FROM accounts WHERE is_active = 1 ORDER BY account_type, id ASC")
        for acc in accounts:
            acc["balance_in_try"] = convert_to_try(acc["current_balance"], acc["currency"], rates)
            acc["balance_in_usd"] = convert_currency(acc["current_balance"], acc["currency"], "USD", rates)
        self.send_json({"success": True, "accounts": accounts, "rates": rates})

    def create_account(self, user: Dict[str, Any]):
        """Creates a new financial account/vault."""
        data = self.read_json_body()
        name = (data.get("name") or "").strip()
        account_type = data.get("account_type", "bank")
        currency = (data.get("currency") or "TRY").upper()
        iban_or_address = (data.get("iban_or_address") or "").strip()
        bank_name = (data.get("bank_name") or "").strip()
        initial_balance = float(data.get("initial_balance", 0.0))
        color = data.get("color", "#3b82f6")
        icon = data.get("icon", "wallet")
        notes = (data.get("notes") or "").strip()

        if not name:
            self.send_error_json("Hesap/Kasa adı zorunludur")
            return

        acc_id = execute_write(
            """
            INSERT INTO accounts (name, account_type, currency, iban_or_address, bank_name, initial_balance, current_balance, color, icon, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, account_type, currency, iban_or_address, bank_name, initial_balance, initial_balance, color, icon, notes)
        )
        log_audit(user["id"], user["username"], "CREATE_ACCOUNT", "account", acc_id, json.dumps({"name": name, "currency": currency, "balance": initial_balance}), self.get_client_ip())
        self.send_json({"success": True, "id": acc_id, "message": "Kasa/Hesap başarıyla oluşturuldu"})

    def update_account(self, acc_id: int, user: Dict[str, Any]):
        """Updates account metadata."""
        data = self.read_json_body()
        name = (data.get("name") or "").strip()
        iban_or_address = (data.get("iban_or_address") or "").strip()
        bank_name = (data.get("bank_name") or "").strip()
        color = data.get("color", "#3b82f6")
        icon = data.get("icon", "wallet")
        notes = (data.get("notes") or "").strip()

        if not name:
            self.send_error_json("Hesap adı zorunludur")
            return

        execute_write(
            """
            UPDATE accounts
            SET name = ?, iban_or_address = ?, bank_name = ?, color = ?, icon = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (name, iban_or_address, bank_name, color, icon, notes, acc_id)
        )
        log_audit(user["id"], user["username"], "UPDATE_ACCOUNT", "account", acc_id, json.dumps(data), self.get_client_ip())
        self.send_json({"success": True, "message": "Hesap bilgileri güncellendi"})

    def process_transfer(self, user: Dict[str, Any]):
        """Performs atomic inter-account transfer with multi-currency FX conversion."""
        data = self.read_json_body()
        from_id = int(data.get("from_account_id", 0))
        to_id = int(data.get("to_account_id", 0))
        from_amount = float(data.get("amount", 0))
        custom_target_amount = data.get("target_amount")
        description = (data.get("description") or "Kasalar arası virman/transfer").strip()
        tx_date = data.get("transaction_date") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if from_id == to_id:
            self.send_error_json("Kaynak ve hedef kasa aynı olamaz")
            return
        if from_amount <= 0:
            self.send_error_json("Transfer tutarı sıfırdan büyük olmalıdır")
            return

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM accounts WHERE id = ? AND is_active = 1", (from_id,))
            from_acc = cursor.fetchone()
            cursor.execute("SELECT * FROM accounts WHERE id = ? AND is_active = 1", (to_id,))
            to_acc = cursor.fetchone()

            if not from_acc or not to_acc:
                conn.close()
                self.send_error_json("Kaynak veya hedef hesap bulunamadı")
                return

            if from_acc["current_balance"] < from_amount:
                conn.close()
                self.send_error_json(f"Yetersiz bakiye! Mevcut bakiye: {from_acc['current_balance']:,.2f} {from_acc['currency']}")
                return

            rates = get_all_rates()
            if custom_target_amount is not None and float(custom_target_amount) > 0:
                to_amount = float(custom_target_amount)
            else:
                to_amount = convert_currency(from_amount, from_acc["currency"], to_acc["currency"], rates)

            converted_in_try = convert_to_try(from_amount, from_acc["currency"], rates)

            # Atomic balance updates
            cursor.execute("UPDATE accounts SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (from_amount, from_id))
            cursor.execute("UPDATE accounts SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (to_amount, to_id))

            # Record transfer transaction
            fx_rate = to_amount / from_amount if from_amount > 0 else 1.0
            cursor.execute(
                """
                INSERT INTO transactions (
                    transaction_type, from_account_id, to_account_id, user_id,
                    amount, currency, fx_rate, converted_amount, description, transaction_date
                )
                VALUES ('transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (from_id, to_id, user["id"], from_amount, from_acc["currency"], fx_rate, converted_in_try, description, tx_date)
            )
            tx_id = cursor.lastrowid

            cursor.execute(
                """
                INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
                VALUES (?, ?, 'TRANSFER', 'transaction', ?, ?, ?)
                """,
                (
                    user["id"], user["username"], tx_id,
                    json.dumps({
                        "from_account": from_acc["name"],
                        "to_account": to_acc["name"],
                        "from_amount": f"{from_amount} {from_acc['currency']}",
                        "to_amount": f"{to_amount} {to_acc['currency']}"
                    }),
                    self.get_client_ip()
                )
            )

            conn.commit()
            conn.close()
            self.send_json({
                "success": True,
                "message": f"Transfer tamamlandı: {from_amount:,.2f} {from_acc['currency']} -> {to_amount:,.2f} {to_acc['currency']}",
                "transaction_id": tx_id
            })
        except Exception as e:
            conn.rollback()
            conn.close()
            self.send_error_json(f"Transfer sırasında hata oluştu: {str(e)}", 500)

    def create_transaction(self, user: Dict[str, Any]):
        """Creates an income or expense transaction and updates account balance."""
        data = self.read_json_body()
        tx_type = data.get("transaction_type")
        account_id = int(data.get("account_id", 0))
        category_id = data.get("category_id")
        amount = float(data.get("amount", 0.0))
        description = (data.get("description") or "").strip()
        tx_date = data.get("transaction_date") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        receipt_filename = data.get("receipt_filename", "")
        receipt_data = data.get("receipt_data", "")  # Base64 string if uploaded

        if tx_type not in ("income", "expense"):
            self.send_error_json("İşlem türü 'income' veya 'expense' olmalıdır")
            return
        if account_id <= 0:
            self.send_error_json("Lütfen bir kasa/hesap seçin")
            return
        if amount <= 0:
            self.send_error_json("Tutar sıfırdan büyük olmalıdır")
            return

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM accounts WHERE id = ? AND is_active = 1", (account_id,))
            account = cursor.fetchone()
            if not account:
                conn.close()
                self.send_error_json("Seçilen hesap bulunamadı")
                return

            rates = get_all_rates()
            converted_try = convert_to_try(amount, account["currency"], rates)

            # Check balance for expenses
            if tx_type == "expense" and account["current_balance"] < amount:
                # Warning or block
                pass

            from_acc_id = account_id if tx_type == "expense" else None
            to_acc_id = account_id if tx_type == "income" else None

            # Handle receipt file save if provided
            receipt_path = ""
            if receipt_data and receipt_filename:
                # Save base64 to file
                try:
                    import base64
                    clean_b64 = receipt_data
                    if "," in clean_b64:
                        clean_b64 = clean_b64.split(",", 1)[1]
                    file_bytes = base64.b64decode(clean_b64)
                    safe_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{re.sub(r'[^a-zA-Z0-9_.-]', '', receipt_filename)}"
                    file_save_path = os.path.join(UPLOAD_DIR, safe_name)
                    with open(file_save_path, "wb") as f:
                        f.write(file_bytes)
                    receipt_path = f"/uploads/{safe_name}"
                except Exception:
                    pass

            # Update account balance
            if tx_type == "income":
                cursor.execute("UPDATE accounts SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (amount, account_id))
            else:
                cursor.execute("UPDATE accounts SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (amount, account_id))

            # Insert transaction
            cursor.execute(
                """
                INSERT INTO transactions (
                    transaction_type, from_account_id, to_account_id, category_id,
                    user_id, amount, currency, fx_rate, converted_amount,
                    description, receipt_filename, receipt_path, receipt_data, transaction_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tx_type, from_acc_id, to_acc_id, category_id,
                    user["id"], amount, account["currency"], converted_try,
                    description, receipt_filename, receipt_path, receipt_data if len(receipt_data) < 500000 else "", tx_date
                )
            )
            tx_id = cursor.lastrowid

            cursor.execute(
                """
                INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
                VALUES (?, ?, 'CREATE_TX', 'transaction', ?, ?, ?)
                """,
                (
                    user["id"], user["username"], tx_id,
                    json.dumps({
                        "type": tx_type,
                        "account": account["name"],
                        "amount": f"{amount} {account['currency']}",
                        "description": description
                    }),
                    self.get_client_ip()
                )
            )

            conn.commit()
            conn.close()
            self.send_json({"success": True, "id": tx_id, "message": "İşlem başarıyla kaydedildi"})
        except Exception as e:
            conn.rollback()
            conn.close()
            self.send_error_json(f"İşlem kaydedilirken hata oluştu: {str(e)}", 500)

    def delete_transaction(self, tx_id: int, user: Dict[str, Any]):
        """Deletes a transaction and reverses its financial impact on account balances."""
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
            tx = cursor.fetchone()
            if not tx:
                conn.close()
                self.send_error_json("Silinecek işlem bulunamadı", 404)
                return

            # Reverse balance changes
            if tx["transaction_type"] == "income" and tx["to_account_id"]:
                cursor.execute("UPDATE accounts SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (tx["amount"], tx["to_account_id"]))
            elif tx["transaction_type"] == "expense" and tx["from_account_id"]:
                cursor.execute("UPDATE accounts SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (tx["amount"], tx["from_account_id"]))
            elif tx["transaction_type"] == "transfer":
                # For transfer, we reverse both from and to
                rates = get_all_rates()
                cursor.execute("SELECT currency FROM accounts WHERE id = ?", (tx["to_account_id"],))
                to_curr = cursor.fetchone()["currency"]
                to_amount = convert_currency(tx["amount"], tx["currency"], to_curr, rates)
                cursor.execute("UPDATE accounts SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (tx["amount"], tx["from_account_id"]))
                cursor.execute("UPDATE accounts SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (to_amount, tx["to_account_id"]))

            cursor.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
            cursor.execute(
                """
                INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
                VALUES (?, ?, 'DELETE_TX', 'transaction', ?, ?, ?)
                """,
                (user["id"], user["username"], tx_id, json.dumps(dict(tx)), self.get_client_ip())
            )

            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": "İşlem silindi ve bakiyeler güncellendi"})
        except Exception as e:
            conn.rollback()
            conn.close()
            self.send_error_json(f"İşlem silinirken hata: {str(e)}", 500)

    def get_transactions(self, params: Dict[str, List[str]]):
        """Fetches transactions with comprehensive filtering and pagination."""
        conditions = []
        sql_params = []

        tx_type = params.get("type", [None])[0]
        if tx_type:
            conditions.append("t.transaction_type = ?")
            sql_params.append(tx_type)

        account_id = params.get("account_id", [None])[0]
        if account_id and account_id.isdigit():
            conditions.append("(t.from_account_id = ? OR t.to_account_id = ?)")
            sql_params.extend([int(account_id), int(account_id)])

        category_id = params.get("category_id", [None])[0]
        if category_id and category_id.isdigit():
            conditions.append("t.category_id = ?")
            sql_params.append(int(category_id))

        start_date = params.get("start_date", [None])[0]
        if start_date:
            conditions.append("t.transaction_date >= ?")
            sql_params.append(f"{start_date} 00:00:00")

        end_date = params.get("end_date", [None])[0]
        if end_date:
            conditions.append("t.transaction_date <= ?")
            sql_params.append(f"{end_date} 23:59:59")

        search = params.get("search", [None])[0]
        if search:
            conditions.append("(t.description LIKE ? OR u.full_name LIKE ?)")
            search_str = f"%{search}%"
            sql_params.extend([search_str, search_str])

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        limit = int(params.get("limit", [50])[0])
        offset = int(params.get("offset", [0])[0])

        count_query = f"SELECT COUNT(*) as count FROM transactions t LEFT JOIN users u ON t.user_id = u.id {where_clause}"
        total_count = query_one(count_query, tuple(sql_params))["count"]

        data_query = f"""
            SELECT t.*, u.full_name as user_full_name,
                   c.name as category_name, c.color as category_color, c.icon as category_icon,
                   fa.name as from_account_name, fa.currency as from_account_currency,
                   ta.name as to_account_name, ta.currency as to_account_currency
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            {where_clause}
            ORDER BY t.transaction_date DESC, t.id DESC
            LIMIT ? OFFSET ?
        """
        sql_params.extend([limit, offset])
        transactions = query_all(data_query, tuple(sql_params))

        self.send_json({
            "success": True,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "transactions": transactions
        })

    def export_transactions_csv(self, params: Dict[str, List[str]]):
        """Generates and downloads CSV of transactions."""
        txs = query_all(
            """
            SELECT t.id, t.transaction_date, t.transaction_type, t.amount, t.currency,
                   t.converted_amount as amount_in_try, t.description,
                   c.name as category, u.full_name as user,
                   fa.name as from_account, ta.name as to_account
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            ORDER BY t.transaction_date DESC
            """
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Tarih", "Tür", "Tutar", "Para Birimi", "TL Karşılığı", "Açıklama", "Kategori", "İşlemi Yapan", "Kaynak Kasa", "Hedef Kasa"])
        for r in txs:
            writer.writerow([
                r["id"], r["transaction_date"], r["transaction_type"],
                r["amount"], r["currency"], r["amount_in_try"],
                r["description"], r["category"] or "-", r["user"] or "-",
                r["from_account"] or "-", r["to_account"] or "-"
            ])
        csv_bytes = output.getvalue().encode("utf-8-sig")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="islemler_listesi.csv"')
        self.send_header("Content-Length", str(len(csv_bytes)))
        self.end_headers()
        self.wfile.write(csv_bytes)

    def get_subscriptions(self):
        """Returns subscriptions with calculated countdown and status."""
        today = datetime.now().date()
        subs = query_all(
            """
            SELECT s.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
                   a.name as account_name, a.currency as account_currency
            FROM subscriptions s
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN accounts a ON s.account_id = a.id
            ORDER BY s.is_active DESC, s.next_due_date ASC
            """
        )
        for s in subs:
            try:
                due_date = datetime.strptime(s["next_due_date"], "%Y-%m-%d").date()
                diff_days = (due_date - today).days
                s["days_remaining"] = diff_days
                if diff_days < 0:
                    s["status"] = "overdue"
                elif diff_days <= 3:
                    s["status"] = "due_soon"
                else:
                    s["status"] = "upcoming"
            except Exception:
                s["days_remaining"] = 0
                s["status"] = "upcoming"
        self.send_json({"success": True, "subscriptions": subs})

    def create_subscription(self, user: Dict[str, Any]):
        """Creates a recurring subscription entry."""
        data = self.read_json_body()
        title = (data.get("title") or "").strip()
        category_id = data.get("category_id")
        account_id = data.get("account_id")
        amount = float(data.get("amount", 0.0))
        currency = data.get("currency", "TRY")
        billing_cycle = data.get("billing_cycle", "monthly")
        next_due_date = data.get("next_due_date") or datetime.now().strftime("%Y-%m-%d")
        notes = data.get("notes", "")

        if not title or amount <= 0:
            self.send_error_json("Abonelik başlığı ve geçerli bir tutar zorunludur")
            return

        sub_id = execute_write(
            """
            INSERT INTO subscriptions (title, category_id, account_id, amount, currency, billing_cycle, next_due_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (title, category_id, account_id, amount, currency, billing_cycle, next_due_date, notes)
        )
        log_audit(user["id"], user["username"], "CREATE_SUBSCRIPTION", "subscription", sub_id, json.dumps({"title": title, "amount": amount}), self.get_client_ip())
        self.send_json({"success": True, "id": sub_id, "message": "Abonelik kaydedildi"})

    def update_subscription(self, sub_id: int, user: Dict[str, Any]):
        """Updates subscription details."""
        data = self.read_json_body()
        title = (data.get("title") or "").strip()
        category_id = data.get("category_id")
        account_id = data.get("account_id")
        amount = float(data.get("amount", 0.0))
        currency = data.get("currency", "TRY")
        billing_cycle = data.get("billing_cycle", "monthly")
        next_due_date = data.get("next_due_date")
        is_active = int(data.get("is_active", 1))
        notes = data.get("notes", "")

        execute_write(
            """
            UPDATE subscriptions
            SET title = ?, category_id = ?, account_id = ?, amount = ?, currency = ?, billing_cycle = ?, next_due_date = ?, is_active = ?, notes = ?
            WHERE id = ?
            """,
            (title, category_id, account_id, amount, currency, billing_cycle, next_due_date, is_active, notes, sub_id)
        )
        log_audit(user["id"], user["username"], "UPDATE_SUBSCRIPTION", "subscription", sub_id, json.dumps(data), self.get_client_ip())
        self.send_json({"success": True, "message": "Abonelik güncellendi"})

    def pay_subscription(self, sub_id: int, user: Dict[str, Any]):
        """Executes 'Tek Tıkla Öde' for a subscription and advances due date."""
        sub = query_one("SELECT * FROM subscriptions WHERE id = ?", (sub_id,))
        if not sub:
            self.send_error_json("Abonelik bulunamadı", 404)
            return

        account_id = sub["account_id"]
        if not account_id:
            # Fallback to first active account
            first_acc = query_one("SELECT id FROM accounts WHERE is_active = 1 LIMIT 1")
            account_id = first_acc["id"] if first_acc else None

        if not account_id:
            self.send_error_json("Ödeme yapılacak kasa seçilmemiş")
            return

        rates = get_all_rates()
        converted_try = convert_to_try(sub["amount"], sub["currency"], rates)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 1. Deduct from account & insert expense transaction
        execute_write("UPDATE accounts SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (sub["amount"], account_id))
        execute_write(
            """
            INSERT INTO transactions (
                transaction_type, from_account_id, category_id, user_id,
                amount, currency, fx_rate, converted_amount, description, transaction_date
            )
            VALUES ('expense', ?, ?, ?, ?, ?, 1.0, ?, ?, ?)
            """,
            (
                account_id, sub["category_id"], user["id"], sub["amount"], sub["currency"],
                converted_try, f"Abonelik Ödemesi: {sub['title']}", now_str
            )
        )

        # 2. Advance next due date based on billing cycle
        current_due = datetime.strptime(sub["next_due_date"], "%Y-%m-%d").date()
        if sub["billing_cycle"] == "yearly":
            next_due = current_due.replace(year=current_due.year + 1)
        elif sub["billing_cycle"] == "weekly":
            next_due = current_due + timedelta(days=7)
        elif sub["billing_cycle"] == "quarterly":
            next_due = current_due + timedelta(days=90)
        else:  # monthly default
            month = current_due.month + 1
            year = current_due.year
            if month > 12:
                month = 1
                year += 1
            try:
                next_due = current_due.replace(year=year, month=month)
            except ValueError:
                next_due = current_due + timedelta(days=30)

        execute_write(
            """
            UPDATE subscriptions
            SET next_due_date = ?, last_paid_date = ?
            WHERE id = ?
            """,
            (next_due.strftime("%Y-%m-%d"), datetime.now().strftime("%Y-%m-%d"), sub_id)
        )

        log_audit(user["id"], user["username"], "PAY_SUBSCRIPTION", "subscription", sub_id, json.dumps({"title": sub["title"], "amount": sub["amount"]}), self.get_client_ip())
        self.send_json({"success": True, "message": f"{sub['title']} ödemesi tamamlandı. Sonraki vade: {next_due.strftime('%Y-%m-%d')}"})

    def preview_z_report(self, report_date: str):
        """Calculates live totals for the day for Z-Report reconciliation."""
        rates = get_all_rates()
        accounts = query_all("SELECT * FROM accounts WHERE is_active = 1")
        accounts_snapshot = []
        total_current_try = 0.0

        for acc in accounts:
            bal_try = convert_to_try(acc["current_balance"], acc["currency"], rates)
            total_current_try += bal_try
            accounts_snapshot.append({
                "id": acc["id"],
                "name": acc["name"],
                "type": acc["account_type"],
                "currency": acc["currency"],
                "balance": acc["current_balance"],
                "balance_in_try": bal_try
            })

        start_str = f"{report_date} 00:00:00"
        end_str = f"{report_date} 23:59:59"

        income_row = query_one(
            "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'income' AND transaction_date BETWEEN ? AND ?",
            (start_str, end_str)
        )
        expense_row = query_one(
            "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'expense' AND transaction_date BETWEEN ? AND ?",
            (start_str, end_str)
        )

        income_total = income_row["total"] if income_row else 0.0
        expense_total = expense_row["total"] if expense_row else 0.0
        net_change = income_total - expense_total

        # Existing locked report check
        existing = query_one("SELECT * FROM z_reports WHERE report_date = ?", (report_date,))

        self.send_json({
            "success": True,
            "report_date": report_date,
            "total_income_try": income_total,
            "total_expense_try": expense_total,
            "net_change_try": net_change,
            "calculated_closing_balance_try": total_current_try,
            "accounts_snapshot": accounts_snapshot,
            "is_already_closed": bool(existing),
            "existing_report": existing
        })

    def close_z_report(self, user: Dict[str, Any]):
        """Finalizes and locks day's Z-Report settlement."""
        data = self.read_json_body()
        report_date = data.get("report_date") or datetime.now().strftime("%Y-%m-%d")
        actual_closing_balance = float(data.get("actual_closing_balance_try", 0.0))
        notes = (data.get("notes") or "").strip()

        # Preview calculation
        rates = get_all_rates()
        accounts = query_all("SELECT * FROM accounts WHERE is_active = 1")
        accounts_snapshot = []
        calculated_closing = 0.0
        for acc in accounts:
            bal_try = convert_to_try(acc["current_balance"], acc["currency"], rates)
            calculated_closing += bal_try
            accounts_snapshot.append({
                "id": acc["id"],
                "name": acc["name"],
                "type": acc["account_type"],
                "currency": acc["currency"],
                "balance": acc["current_balance"],
                "balance_in_try": bal_try
            })

        start_str = f"{report_date} 00:00:00"
        end_str = f"{report_date} 23:59:59"
        income_total = query_one(
            "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'income' AND transaction_date BETWEEN ? AND ?",
            (start_str, end_str)
        )["total"]
        expense_total = query_one(
            "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'expense' AND transaction_date BETWEEN ? AND ?",
            (start_str, end_str)
        )["total"]

        if actual_closing_balance == 0.0:
            actual_closing_balance = calculated_closing

        discrepancy = actual_closing_balance - calculated_closing
        opening_balance = calculated_closing - (income_total - expense_total)

        report_id = execute_write(
            """
            INSERT INTO z_reports (
                report_date, closed_by_user_id, opening_balance_try, total_income_try,
                total_expense_try, calculated_closing_balance_try, actual_closing_balance_try,
                discrepancy_try, accounts_snapshot_json, notes, is_locked
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(report_date) DO UPDATE SET
                closed_by_user_id = excluded.closed_by_user_id,
                total_income_try = excluded.total_income_try,
                total_expense_try = excluded.total_expense_try,
                calculated_closing_balance_try = excluded.calculated_closing_balance_try,
                actual_closing_balance_try = excluded.actual_closing_balance_try,
                discrepancy_try = excluded.discrepancy_try,
                accounts_snapshot_json = excluded.accounts_snapshot_json,
                notes = excluded.notes,
                created_at = CURRENT_TIMESTAMP
            """,
            (
                report_date, user["id"], opening_balance, income_total, expense_total,
                calculated_closing, actual_closing_balance, discrepancy, json.dumps(accounts_snapshot), notes
            )
        )

        log_audit(user["id"], user["username"], "CLOSE_Z_REPORT", "z_report", report_id, json.dumps({"date": report_date, "discrepancy": discrepancy}), self.get_client_ip())
        self.send_json({"success": True, "id": report_id, "message": f"{report_date} tarihli Z-Raporu başarıyla kapatıldı ve mühürlendi."})

    def get_report_category_expenses(self, params: Dict[str, List[str]]):
        """Analyzes expenses grouped by category."""
        start_date = params.get("start_date", [(datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")])[0]
        end_date = params.get("end_date", [datetime.now().strftime("%Y-%m-%d")])[0]

        rows = query_all(
            """
            SELECT c.id, c.name, c.color, c.icon,
                   COALESCE(SUM(t.converted_amount), 0) as total_amount,
                   COUNT(t.id) as tx_count
            FROM categories c
            LEFT JOIN transactions t ON t.category_id = c.id
                 AND t.transaction_type = 'expense'
                 AND t.transaction_date BETWEEN ? AND ?
            WHERE c.type = 'expense'
            GROUP BY c.id
            HAVING total_amount > 0
            ORDER BY total_amount DESC
            """,
            (f"{start_date} 00:00:00", f"{end_date} 23:59:59")
        )
        total_expense = sum(r["total_amount"] for r in rows)
        for r in rows:
            r["percentage"] = round((r["total_amount"] / total_expense * 100), 1) if total_expense > 0 else 0

        self.send_json({
            "success": True,
            "total_expense": total_expense,
            "start_date": start_date,
            "end_date": end_date,
            "categories": rows
        })

    def get_report_cash_flow(self, params: Dict[str, List[str]]):
        """Returns monthly cash inflow vs outflow for past 6 months."""
        today = datetime.now()
        months = []
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i * 30)
            months.append(m_date.strftime("%Y-%m"))

        result = []
        for ym in months:
            in_val = query_one(
                "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'income' AND transaction_date LIKE ?",
                (f"{ym}%",)
            )["total"]
            out_val = query_one(
                "SELECT COALESCE(SUM(converted_amount), 0) as total FROM transactions WHERE transaction_type = 'expense' AND transaction_date LIKE ?",
                (f"{ym}%",)
            )["total"]
            result.append({
                "month": ym,
                "income": in_val,
                "expense": out_val,
                "net": in_val - out_val
            })

        self.send_json({"success": True, "monthly_cash_flow": result})

    def get_report_account_volume(self):
        """Returns volume metrics per account."""
        accounts = query_all("SELECT id, name, account_type, currency, color FROM accounts WHERE is_active = 1")
        for acc in accounts:
            in_flow = query_one(
                "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE to_account_id = ? AND transaction_type = 'income'",
                (acc["id"],)
            )["total"]
            out_flow = query_one(
                "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE from_account_id = ? AND transaction_type = 'expense'",
                (acc["id"],)
            )["total"]
            acc["total_inflow"] = in_flow
            acc["total_outflow"] = out_flow
            acc["total_volume"] = in_flow + out_flow
        self.send_json({"success": True, "accounts": accounts})

    def create_user(self, admin_user: Dict[str, Any]):
        """Creates a new user with RBAC role."""
        data = self.read_json_body()
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip()
        password = data.get("password") or ""
        full_name = (data.get("full_name") or "").strip()
        role = data.get("role", "operator")

        if not username or not password or not full_name:
            self.send_error_json("Tüm alanlar zorunludur")
            return
        if role not in ("admin", "manager", "operator", "viewer"):
            self.send_error_json("Geçersiz rol seçimi")
            return

        existing = query_one("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
        if existing:
            self.send_error_json("Bu kullanıcı adı veya e-posta adresi zaten kullanımda")
            return

        salt = generate_salt()
        pwd_hash = hash_password(password, salt)
        user_id = execute_write(
            """
            INSERT INTO users (username, email, password_hash, salt, full_name, role, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (username, email, pwd_hash, salt, full_name, role)
        )
        log_audit(admin_user["id"], admin_user["username"], "CREATE_USER", "user", user_id, json.dumps({"username": username, "role": role}), self.get_client_ip())
        self.send_json({"success": True, "id": user_id, "message": "Kullanıcı başarıyla oluşturuldu"})

    def update_user(self, target_user_id: int, admin_user: Dict[str, Any]):
        """Updates user details or role."""
        data = self.read_json_body()
        full_name = (data.get("full_name") or "").strip()
        role = data.get("role")
        is_active = data.get("is_active")
        new_password = data.get("password")

        if role and role not in ("admin", "manager", "operator", "viewer"):
            self.send_error_json("Geçersiz rol")
            return

        if new_password:
            salt = generate_salt()
            pwd_hash = hash_password(new_password, salt)
            execute_write("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (pwd_hash, salt, target_user_id))

        if full_name:
            execute_write("UPDATE users SET full_name = ? WHERE id = ?", (full_name, target_user_id))
        if role:
            execute_write("UPDATE users SET role = ? WHERE id = ?", (role, target_user_id))
        if is_active is not None:
            execute_write("UPDATE users SET is_active = ? WHERE id = ?", (int(is_active), target_user_id))

        log_audit(admin_user["id"], admin_user["username"], "UPDATE_USER", "user", target_user_id, json.dumps(data), self.get_client_ip())
        self.send_json({"success": True, "message": "Kullanıcı bilgileri güncellendi"})


def run_server(host: str = "0.0.0.0", port: int = 8080):
    """Starts the Finance Tracker HTTP server."""
    init_db()
    seed_database()
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, FinanceRequestHandler)
    print(f"================================================================")
    print(f" 🚀 KASA & FİNANS TAKİP SİSTEMİ ÇALIŞIYOR")
    print(f" 👉 Web Arayüzü : http://localhost:{port}")
    print(f" 🔑 Giriş Bilgileri:")
    print(f"    - Admin:     admin / admin123")
    print(f"    - Müdür:     manager / manager123")
    print(f"    - Operatör:  operator / operator123")
    print(f"    - Denetçi:   viewer / viewer123")
    print(f"================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatılıyor...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()

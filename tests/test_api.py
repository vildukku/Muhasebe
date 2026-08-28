"""
Direct In-Memory Request Handler Testing for Kasa & Finans Takip Sistemi.
"""

from email.message import EmailMessage
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import init_db
from app.seed_data import seed_database
from app.server import FinanceRequestHandler


class CaseInsensitiveDict(dict):
    def get(self, key, default=None):
        lower_key = key.lower()
        for k, v in self.items():
            if k.lower() == lower_key:
                return v
        return default

    def __getitem__(self, key):
        lower_key = key.lower()
        for k, v in self.items():
            if k.lower() == lower_key:
                return v
        raise KeyError(key)

    def __contains__(self, key):
        lower_key = key.lower()
        for k in self.keys():
            if k.lower() == lower_key:
                return True
        return False


class MockFinanceHandler(FinanceRequestHandler):
    def __init__(self, method, path, headers=None, body=None):
        self.command = method
        self.path = path
        self.request_version = "HTTP/1.1"
        self.headers = CaseInsensitiveDict(headers or {})
        self.rfile = io.BytesIO(body.encode('utf-8') if isinstance(body, str) else (body or b""))
        self.wfile = io.BytesIO()
        self.client_address = ("127.0.0.1", 12345)
        self.status_code = 200
        self.response_headers = {}

    def send_response(self, code, message=None):
        self.status_code = code

    def send_header(self, keyword, value):
        self.response_headers[keyword.lower()] = value

    def end_headers(self):
        pass

    def log_message(self, format, *args):
        pass

    def run_request(self):
        if self.command == "GET":
            self.do_GET()
        elif self.command == "POST":
            self.do_POST()
        elif self.command == "PUT":
            self.do_PUT()
        elif self.command == "DELETE":
            self.do_DELETE()

        output = self.wfile.getvalue()
        content_type = self.response_headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                return json.loads(output.decode('utf-8')), self.status_code
            except Exception:
                return output, self.status_code
        return output, self.status_code


def call_api(method, path, data=None, token=None):
    headers = {}
    body = ""
    if data is not None:
        body = json.dumps(data)
        headers["Content-Length"] = str(len(body.encode('utf-8')))
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    handler = MockFinanceHandler(method, path, headers=headers, body=body)
    return handler.run_request()


class TestApiDirect(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()
        seed_database(force=True)

    def test_01_login_and_auth(self):
        # 1. Login with Admin
        resp, status = call_api("POST", "/api/auth/login", data={"username": "admin", "password": "admin123"})
        self.assertEqual(status, 200)
        self.assertTrue(resp.get("success", False))
        token = resp["token"]
        self.assertIsNotNone(token)

        # 2. Check /api/auth/me
        me_resp, me_status = call_api("GET", "/api/auth/me", token=token)
        self.assertEqual(me_status, 200)
        self.assertEqual(me_resp["user"]["username"], "admin")
        self.assertTrue(me_resp["user"]["permissions"]["can_manage_users"])

        # 3. Invalid credentials test
        inv_resp, inv_status = call_api("POST", "/api/auth/login", data={"username": "admin", "password": "wrong"})
        self.assertEqual(inv_status, 401)

    def test_02_dashboard_summary(self):
        login_resp, _ = call_api("POST", "/api/auth/login", data={"username": "admin", "password": "admin123"})
        token = login_resp["token"]

        dash_resp, status = call_api("GET", "/api/dashboard/summary", token=token)
        self.assertEqual(status, 200)
        self.assertTrue(dash_resp["success"])
        self.assertIn("net_worth", dash_resp)
        self.assertIn("cash_flow_30d", dash_resp)
        self.assertIn("recent_transactions", dash_resp)
        self.assertGreater(dash_resp["net_worth"]["total_try"], 0)

    def test_03_accounts_and_transfer_api(self):
        login_resp, _ = call_api("POST", "/api/auth/login", data={"username": "manager", "password": "manager123"})
        token = login_resp["token"]

        acc_resp, status = call_api("GET", "/api/accounts", token=token)
        self.assertEqual(status, 200)
        accounts = acc_resp["accounts"]
        self.assertGreaterEqual(len(accounts), 2)

        from_acc = accounts[0]
        to_acc = accounts[1]

        # Execute Transfer
        transfer_payload = {
            "from_account_id": from_acc["id"],
            "to_account_id": to_acc["id"],
            "amount": 100.0,
            "description": "API Test Transfer"
        }
        tx_resp, tx_status = call_api("POST", "/api/accounts/transfer", data=transfer_payload, token=token)
        self.assertEqual(tx_status, 200)
        self.assertTrue(tx_resp["success"])

    def test_04_create_and_delete_transaction(self):
        login_resp, _ = call_api("POST", "/api/auth/login", data={"username": "operator", "password": "operator123"})
        operator_token = login_resp["token"]

        acc_resp, _ = call_api("GET", "/api/accounts", token=operator_token)
        acc_id = acc_resp["accounts"][0]["id"]

        tx_payload = {
            "transaction_type": "income",
            "account_id": acc_id,
            "amount": 1500.0,
            "description": "API Test Income"
        }
        create_resp, status = call_api("POST", "/api/transactions", data=tx_payload, token=operator_token)
        self.assertEqual(status, 200)
        self.assertTrue(create_resp["success"])
        tx_id = create_resp["id"]

        # Operator tries to delete -> should be 403 Forbidden
        del_resp, del_status = call_api("DELETE", f"/api/transactions/{tx_id}", token=operator_token)
        self.assertEqual(del_status, 403)

        # Admin deletes -> should be 200 OK
        admin_login, _ = call_api("POST", "/api/auth/login", data={"username": "admin", "password": "admin123"})
        del_admin_resp, del_admin_status = call_api("DELETE", f"/api/transactions/{tx_id}", token=admin_login["token"])
        self.assertEqual(del_admin_status, 200)

    def test_05_z_report_preview_and_close(self):
        login_resp, _ = call_api("POST", "/api/auth/login", data={"username": "manager", "password": "manager123"})
        token = login_resp["token"]

        today_str = "2026-08-28"
        prev_resp, status = call_api("GET", f"/api/z-reports/preview?date={today_str}", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(prev_resp["report_date"], today_str)

        # Close Z-Report
        close_payload = {
            "report_date": today_str,
            "actual_closing_balance_try": prev_resp["calculated_closing_balance_try"],
            "notes": "API test Z-Report kapatma başarılı"
        }
        close_resp, close_status = call_api("POST", "/api/z-reports/close", data=close_payload, token=token)
        self.assertEqual(close_status, 200)
        self.assertTrue(close_resp["success"])

    def test_06_subscriptions_one_click_pay(self):
        login_resp, _ = call_api("POST", "/api/auth/login", data={"username": "manager", "password": "manager123"})
        token = login_resp["token"]

        subs_resp, _ = call_api("GET", "/api/subscriptions", token=token)
        subs = subs_resp["subscriptions"]
        self.assertGreater(len(subs), 0)
        sub_id = subs[0]["id"]

        # Pay subscription
        pay_resp, pay_status = call_api("POST", f"/api/subscriptions/{sub_id}/pay", token=token)
        self.assertEqual(pay_status, 200)
        self.assertTrue(pay_resp["success"])

    def test_07_csv_export(self):
        login_resp, _ = call_api("POST", "/api/auth/login", data={"username": "viewer", "password": "viewer123"})
        token = login_resp["token"]

        csv_bytes, status = call_api("GET", "/api/transactions/export", token=token)
        self.assertEqual(status, 200)
        self.assertIn(b"Tarih", csv_bytes)


if __name__ == "__main__":
    unittest.main()

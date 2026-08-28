#!/usr/bin/env python3
"""
Kasa & Finans Takip Sistemi - Application Launcher
"""

import argparse
import sys
from app.db import init_db
from app.seed_data import seed_database
from app.server import run_server


def main():
    import os
    env_port = int(os.environ.get("PORT", 8080))
    parser = argparse.ArgumentParser(description="Kasa & Finans Takip Sistemi")
    parser.add_argument("--host", default="0.0.0.0", help="Bağlanılacak host adresi (varsayılan: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=env_port, help=f"Sunucu portu (varsayılan: {env_port})")
    parser.add_argument("--seed", action="store_true", help="Veritabanını sıfırlayıp demo verilerini yeniden yükler")
    args = parser.parse_args()

    # 1. Initialize SQLite Database
    init_db()

    # 2. Seed demo data
    seed_database(force=args.seed)

    # 3. Start Multi-threaded Web Server
    run_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()

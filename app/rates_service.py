"""
Exchange rates service for multi-currency conversion (FX & Crypto).
"""

import json
import urllib.request
from datetime import datetime
from typing import Dict

from app.db import execute_write, query_all

DEFAULT_RATES = {
    "USD_TRY": 34.20,
    "EUR_TRY": 37.80,
    "GBP_TRY": 44.50,
    "USDT_TRY": 34.25,
    "BTC_USD": 63500.0,
    "ETH_USD": 2650.0,
    "SOL_USD": 145.0,
}


def init_default_rates():
    """Initializes default exchange rates if missing."""
    for pair, rate in DEFAULT_RATES.items():
        execute_write(
            """
            INSERT INTO exchange_rates (pair, rate, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(pair) DO UPDATE SET rate = excluded.rate, updated_at = CURRENT_TIMESTAMP
            WHERE NOT EXISTS (SELECT 1 FROM exchange_rates WHERE pair = ?)
            """,
            (pair, rate, pair)
        )


def get_all_rates() -> Dict[str, float]:
    """Fetches all exchange rates as a dictionary."""
    init_default_rates()
    rows = query_all("SELECT pair, rate, updated_at FROM exchange_rates")
    result = {r["pair"]: float(r["rate"]) for r in rows}
    # Ensure standard defaults are present
    for k, v in DEFAULT_RATES.items():
        if k not in result:
            result[k] = v
    return result


def set_rate(pair: str, rate: float):
    """Sets or updates a specific exchange rate."""
    execute_write(
        """
        INSERT INTO exchange_rates (pair, rate, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(pair) DO UPDATE SET rate = excluded.rate, updated_at = CURRENT_TIMESTAMP
        """,
        (pair, float(rate))
    )


def convert_to_try(amount: float, currency: str, rates: Dict[str, float] = None) -> float:
    """Converts any currency amount to TRY based on current rates."""
    if rates is None:
        rates = get_all_rates()

    curr = currency.upper()
    if curr == "TRY":
        return amount
    elif curr == "USD":
        return amount * rates.get("USD_TRY", 34.20)
    elif curr == "EUR":
        return amount * rates.get("EUR_TRY", 37.80)
    elif curr == "GBP":
        return amount * rates.get("GBP_TRY", 44.50)
    elif curr == "USDT":
        return amount * rates.get("USDT_TRY", 34.25)
    elif curr == "BTC":
        btc_usd = rates.get("BTC_USD", 63500.0)
        usd_try = rates.get("USD_TRY", 34.20)
        return amount * btc_usd * usd_try
    elif curr == "ETH":
        eth_usd = rates.get("ETH_USD", 2650.0)
        usd_try = rates.get("USD_TRY", 34.20)
        return amount * eth_usd * usd_try
    elif curr == "SOL":
        sol_usd = rates.get("SOL_USD", 145.0)
        usd_try = rates.get("USD_TRY", 34.20)
        return amount * sol_usd * usd_try
    else:
        return amount


def convert_currency(amount: float, from_curr: str, to_curr: str, rates: Dict[str, float] = None) -> float:
    """Converts an amount from one currency to another."""
    if rates is None:
        rates = get_all_rates()

    from_curr = from_curr.upper()
    to_curr = to_curr.upper()

    if from_curr == to_curr:
        return amount

    # Step 1: Convert from_curr to TRY
    amount_in_try = convert_to_try(amount, from_curr, rates)

    # Step 2: Convert TRY to to_curr
    if to_curr == "TRY":
        return amount_in_try
    elif to_curr == "USD":
        usd_try = rates.get("USD_TRY", 34.20)
        return amount_in_try / usd_try if usd_try else amount_in_try
    elif to_curr == "EUR":
        eur_try = rates.get("EUR_TRY", 37.80)
        return amount_in_try / eur_try if eur_try else amount_in_try
    elif to_curr == "GBP":
        gbp_try = rates.get("GBP_TRY", 44.50)
        return amount_in_try / gbp_try if gbp_try else amount_in_try
    elif to_curr == "USDT":
        usdt_try = rates.get("USDT_TRY", 34.25)
        return amount_in_try / usdt_try if usdt_try else amount_in_try
    elif to_curr == "BTC":
        btc_usd = rates.get("BTC_USD", 63500.0)
        usd_try = rates.get("USD_TRY", 34.20)
        btc_try = btc_usd * usd_try
        return amount_in_try / btc_try if btc_try else amount_in_try
    elif to_curr == "ETH":
        eth_usd = rates.get("ETH_USD", 2650.0)
        usd_try = rates.get("USD_TRY", 34.20)
        eth_try = eth_usd * usd_try
        return amount_in_try / eth_try if eth_try else amount_in_try
    return amount_in_try


def sync_live_rates():
    """Attempts to fetch live rates from free public APIs with fallback."""
    updated = {}
    try:
        # Fetch FX rates from open.er-api.com
        req = urllib.request.Request("https://open.er-api.com/v6/latest/USD", headers={"User-Agent": "FinanceTracker/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode())
            if data.get("result") == "success" and "rates" in data:
                fx = data["rates"]
                try_rate = fx.get("TRY", 34.20)
                eur_rate = fx.get("EUR", 0.92)
                gbp_rate = fx.get("GBP", 0.77)
                set_rate("USD_TRY", try_rate)
                set_rate("USDT_TRY", try_rate * 1.002)
                if eur_rate > 0:
                    set_rate("EUR_TRY", try_rate / eur_rate)
                if gbp_rate > 0:
                    set_rate("GBP_TRY", try_rate / gbp_rate)
                updated["USD_TRY"] = try_rate
    except Exception:
        pass

    try:
        # Fetch Crypto rates from CoinGecko or Binance
        req = urllib.request.Request(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd",
            headers={"User-Agent": "FinanceTracker/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode())
            if "bitcoin" in data:
                btc = float(data["bitcoin"]["usd"])
                set_rate("BTC_USD", btc)
                updated["BTC_USD"] = btc
            if "ethereum" in data:
                eth = float(data["ethereum"]["usd"])
                set_rate("ETH_USD", eth)
                updated["ETH_USD"] = eth
            if "solana" in data:
                sol = float(data["solana"]["usd"])
                set_rate("SOL_USD", sol)
                updated["SOL_USD"] = sol
    except Exception:
        pass

    return updated or get_all_rates()

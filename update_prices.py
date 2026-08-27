#!/usr/bin/env python3
import json, urllib.request, datetime, time
from collections import defaultdict

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
TICK = {
    "TSLA": "TSLA",
    "SPCX": "SPCX",
    "QDVE": "QDVE.DE",
    "VWCE": "VWCE.DE",
    "BTC": "BTC-EUR",
}

def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)

def get_json(url, timeout=25):
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.9",
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = e
            time.sleep(0.9 * (i + 1))
    raise last

def yahoo_chart(symbol):
    last = None
    for host in ("query1", "query2"):
        url = "https://%s.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=1mo" % (host, symbol)
        try:
            j = get_json(url)
            res = (j.get("chart") or {}).get("result") or []
            if not res:
                last = RuntimeError("sin result para " + symbol)
                continue
            meta = res[0].get("meta") or {}
            px = meta.get("regularMarketPrice")
            ts = res[0].get("timestamp") or []
            q = ((res[0].get("indicators") or {}).get("quote") or [{}])[0]
            closes = q.get("close") or []
            series = []
            for t, c in zip(ts, closes):
                if c is None:
                    continue
                day = datetime.datetime.fromtimestamp(int(t), datetime.timezone.utc).strftime("%Y-%m-%d")
                series.append((day, float(c)))
            if px is None:
                for _d, v in reversed(series):
                    px = v
                    break
            if px is None or float(px) <= 0:
                last = RuntimeError("precio invalido " + symbol)
                continue
            return float(px), series
        except Exception as e:
            last = e
    raise last if last else RuntimeError("yahoo fail " + symbol)

def btc_fallback():
    try:
        j = get_json("https://api.kraken.com/0/public/Ticker?pair=XBTEUR")
        px = float(j["result"]["XXBTZEUR"]["c"][0])
        if px > 0:
            return px
    except Exception as e:
        print("BTC kraken fail", e)
    try:
        j = get_json("https://api.coinbase.com/v2/prices/BTC-EUR/spot")
        px = float(j["data"]["amount"])
        if px > 0:
            return px
    except Exception as e:
        print("BTC coinbase fail", e)
    raise RuntimeError("btc fallback fail")

def fx_eurusd():
    try:
        j = get_json("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json")
        return float(j["eur"]["usd"])
    except Exception as e:
        print("FX jsdelivr fail", e)
    j = get_json("https://api.frankfurter.app/latest?from=EUR&to=USD")
    return float(j["rates"]["USD"])

def load_prev():
    try:
        with open("prices.json") as f:
            return json.load(f)
    except Exception:
        return {}

def main():
    prev = load_prev()
    prices = dict(prev.get("prices") or {})
    errors = {}
    daily = defaultdict(dict)
    old_daily = prev.get("daily") or {}
    if isinstance(old_daily, dict):
        for day, ticks in old_daily.items():
            if isinstance(ticks, dict):
                daily[day].update(ticks)

    for k, s in TICK.items():
        try:
            px, series = yahoo_chart(s)
            dec = 2 if k == "BTC" else 4
            prices[k] = round(px, dec)
            for day, val in series:
                daily[day][k] = round(val, dec)
            print("OK", k, prices[k], "dias", len(series))
        except Exception as e:
            if k == "BTC":
                try:
                    px = btc_fallback()
                    prices[k] = round(px, 2)
                    print("OK BTC fallback", prices[k])
                    continue
                except Exception as e2:
                    e = e2
            errors[k] = str(e)
            print("FAIL", k, e)

    try:
        eurusd = round(fx_eurusd(), 6)
        print("OK EURUSD", eurusd)
    except Exception as e:
        eurusd = prev.get("eurusd")
        print("FAIL FX", e)

    if len(prices) < 1:
        raise SystemExit("ningun precio")

    today = now_utc().strftime("%Y-%m-%d")
    daily[today].update({k: prices[k] for k in prices})
    keep = sorted(daily.keys())[-45:]
    daily_out = {d: daily[d] for d in keep}

    out = {
        "updatedAt": now_utc().replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "eurusd": eurusd,
        "prices": prices,
        "daily": daily_out,
        "tickers": TICK,
        "errors": errors,
    }
    with open("prices.json", "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print("wrote prices.json", {"updatedAt": out["updatedAt"], "nDaily": len(daily_out), "prices": prices, "errors": errors})

if __name__ == "__main__":
    main()

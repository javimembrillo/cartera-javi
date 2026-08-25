#!/usr/bin/env python3
import json, urllib.request, datetime
from collections import defaultdict

UA = "Mozilla/5.0 (compatible; cartera-javi-prices/1.2)"
TICK = {
    "TSLA": "TSLA",
    "SPCX": "SPCX",
    "QDVE": "QDVE.DE",
    "VWCE": "VWCE.DE",
}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())

def yahoo_chart(symbol):
    url = "https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=1mo" % symbol
    j = get(url)
    res = (j.get("chart") or {}).get("result") or []
    if not res:
        raise RuntimeError("sin result para " + symbol)
    meta = res[0].get("meta") or {}
    px = meta.get("regularMarketPrice")
    ts = res[0].get("timestamp") or []
    q = ((res[0].get("indicators") or {}).get("quote") or [{}])[0]
    closes = q.get("close") or []
    series = []
    for t, c in zip(ts, closes):
        if c is None:
            continue
        day = datetime.datetime.utcfromtimestamp(int(t)).strftime("%Y-%m-%d")
        series.append((day, float(c)))
    if px is None:
        for _d, v in reversed(series):
            px = v
            break
    if px is None or float(px) <= 0:
        raise RuntimeError("precio invalido " + symbol)
    return float(px), series

def fx_eurusd():
    j = get("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json")
    return float(j["eur"]["usd"])

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
            prices[k] = round(px, 4)
            for day, val in series:
                daily[day][k] = round(val, 4)
            print("OK", k, prices[k], "dias", len(series))
        except Exception as e:
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

    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    daily[today].update({k: prices[k] for k in prices})
    keep = sorted(daily.keys())[-45:]
    daily_out = {d: daily[d] for d in keep}

    out = {
        "updatedAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "eurusd": eurusd,
        "prices": prices,
        "daily": daily_out,
        "tickers": TICK,
        "errors": errors,
    }
    with open("prices.json", "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print("wrote prices.json", {"updatedAt": out["updatedAt"], "nDaily": len(daily_out), "prices": prices})

if __name__ == "__main__":
    main()

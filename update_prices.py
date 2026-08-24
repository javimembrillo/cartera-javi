#!/usr/bin/env python3
import json, urllib.request, datetime

UA = "Mozilla/5.0 (compatible; cartera-javi-prices/1.0)"
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

def yahoo_px(symbol):
    url = "https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=5d" % symbol
    j = get(url)
    res = (j.get("chart") or {}).get("result") or []
    if not res:
        raise RuntimeError("sin result para " + symbol)
    meta = res[0].get("meta") or {}
    px = meta.get("regularMarketPrice")
    if px is None:
        q = ((res[0].get("indicators") or {}).get("quote") or [{}])[0]
        closes = q.get("close") or []
        for x in reversed(closes):
            if x is not None:
                px = x
                break
    if px is None or float(px) <= 0:
        raise RuntimeError("precio invalido " + symbol)
    return float(px)

def fx_eurusd():
    j = get("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json")
    return float(j["eur"]["usd"])

def main():
    prices = {}
    errors = {}
    for k, s in TICK.items():
        try:
            prices[k] = round(yahoo_px(s), 4)
            print("OK", k, prices[k])
        except Exception as e:
            errors[k] = str(e)
            print("FAIL", k, e)
    try:
        eurusd = round(fx_eurusd(), 6)
        print("OK EURUSD", eurusd)
    except Exception as e:
        eurusd = None
        print("FAIL FX", e)
    if len(prices) < 1:
        raise SystemExit("ningun precio")
    out = {
        "updatedAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "eurusd": eurusd,
        "prices": prices,
        "tickers": TICK,
        "errors": errors,
    }
    with open("prices.json", "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print("wrote prices.json", out)

if __name__ == "__main__":
    main()

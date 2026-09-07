#!/usr/bin/env python3
import json
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from zoneinfo import ZoneInfo

MADRID = ZoneInfo("Europe/Madrid")
NY = ZoneInfo("America/New_York")
TO_DEFAULT = "javier@doctormembrillo.com"
SITE = "https://javimembrillo.github.io/cartera-javi/"
NAMES = {
    "TSLA": "Tesla",
    "SPCX": "SpaceX",
    "QDVE": "iShares S&P 500 Info Tech",
    "VWCE": "Vanguard FTSE All-World",
    "BTC": "Bitcoin",
}
CCY = {"TSLA": "USD", "SPCX": "USD", "QDVE": "EUR", "VWCE": "EUR", "BTC": "EUR"}
ORDER = ["TSLA", "SPCX", "QDVE", "VWCE", "BTC"]


def fmt_num(n, dec=2):
    try:
        n = float(n)
    except (TypeError, ValueError):
        return "—"
    s = f"{n:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def now_utc():
    return datetime.now(timezone.utc)


def in_window(local, hour, minute, span=25):
    if local.weekday() >= 5:
        return False
    cur = local.hour * 60 + local.minute
    start = hour * 60 + minute
    return start <= cur <= start + span


def detect_session(forced):
    forced = (forced or "auto").strip().lower()
    utc = now_utc()
    if forced in ("europa", "europe", "eu"):
        return "europa"
    if forced in ("wallstreet", "nyse", "us"):
        return "wallstreet"
    madrid = utc.astimezone(MADRID)
    ny = utc.astimezone(NY)
    if in_window(madrid, 9, 0):
        return "europa"
    if in_window(ny, 9, 30):
        return "wallstreet"
    return None


def prev_close(daily, ticker, today):
    days = sorted(d for d in (daily or {}) if d < today)
    for day in reversed(days):
        px = (daily.get(day) or {}).get(ticker)
        try:
            px = float(px)
        except (TypeError, ValueError):
            continue
        if px > 0:
            return px, day
    return None, None


def load_prices():
    with open("prices.json", encoding="utf-8") as f:
        return json.load(f)


def build_rows(data):
    today = now_utc().astimezone(MADRID).strftime("%Y-%m-%d")
    daily = data.get("daily") or {}
    prices = data.get("prices") or {}
    rows = []
    for tk in ORDER:
        px = prices.get(tk)
        try:
            px = float(px) if px is not None else None
        except (TypeError, ValueError):
            px = None
        prev, prev_d = prev_close(daily, tk, today)
        chg = None
        if px and prev:
            chg = (px - prev) / prev * 100
        rows.append({
            "ticker": tk,
            "name": NAMES.get(tk, tk),
            "ccy": CCY.get(tk, ""),
            "px": px,
            "chg": chg,
            "prev_d": prev_d,
        })
    return rows


def html_email(session, data, rows, when):
    title = "Apertura Europa" if session == "europa" else "Apertura Wall Street"
    subtitle = (
        "Bolsa europea (BME / Xetra / Euronext) · 09:00 Madrid"
        if session == "europa"
        else "NYSE / Nasdaq · 09:30 Nueva York (15:30 en Madrid la mayor parte del año)"
    )
    fx = data.get("eurusd")
    updated = data.get("updatedAt") or ""
    items = []
    for r in rows:
        px = fmt_num(r["px"], 2 if r["ticker"] == "BTC" else 4) if r["px"] else "—"
        if r["chg"] is None:
            chg = "—"
            color = "#9a9aab"
        else:
            sign = "+" if r["chg"] >= 0 else ""
            chg = sign + fmt_num(r["chg"], 2) + "%"
            color = "#22c55e" if r["chg"] >= 0 else "#ef4444"
        items.append(
            "<tr>"
            f"<td style='padding:10px 8px;border-bottom:1px solid #2e2e3a'><b>{r['ticker']}</b><br>"
            f"<span style='color:#9a9aab;font-size:12px'>{r['name']}</span></td>"
            f"<td style='padding:10px 8px;border-bottom:1px solid #2e2e3a;text-align:right'>{px} {r['ccy']}</td>"
            f"<td style='padding:10px 8px;border-bottom:1px solid #2e2e3a;text-align:right;color:{color}'>{chg}</td>"
            "</tr>"
        )
    errors = data.get("errors") or {}
    err_html = ""
    if errors:
        err_html = "<p style='color:#ef4444;font-size:13px'>Avisos: " + ", ".join(
            f"{k}: {v}" for k, v in errors.items()
        ) + "</p>"
    return f"""<!doctype html>
<html><body style="margin:0;padding:24px;background:#0f0f12;color:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#1a1a21;border:1px solid #2e2e3a;border-radius:16px;padding:20px">
    <p style="margin:0 0 4px;color:#9a9aab;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Cartera Javi</p>
    <h1 style="margin:0 0 8px;font-size:22px">{title}</h1>
    <p style="margin:0 0 16px;color:#9a9aab">{subtitle}<br>{when}</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr style="color:#9a9aab;font-size:12px;text-transform:uppercase">
        <th style="text-align:left;padding:0 8px 8px">Activo</th>
        <th style="text-align:right;padding:0 8px 8px">Precio</th>
        <th style="text-align:right;padding:0 8px 8px">vs cierre</th>
      </tr>
      {''.join(items)}
    </table>
    <p style="margin:16px 0 0;color:#9a9aab;font-size:13px">EUR/USD {fmt_num(fx, 4) if fx else '—'} · Actualizado {updated}</p>
    {err_html}
    <p style="margin:18px 0 0"><a href="{SITE}" style="color:#3b82f6">Abrir la cartera</a></p>
  </div>
</body></html>"""


def text_email(session, data, rows, when):
    title = "Apertura Europa" if session == "europa" else "Apertura Wall Street"
    lines = [title, when, ""]
    for r in rows:
        px = fmt_num(r["px"], 2 if r["ticker"] == "BTC" else 4) if r["px"] else "—"
        if r["chg"] is None:
            chg = "—"
        else:
            sign = "+" if r["chg"] >= 0 else ""
            chg = sign + fmt_num(r["chg"], 2) + "%"
        lines.append(f"{r['ticker']}  {px} {r['ccy']}  {chg}")
    fx = data.get("eurusd")
    lines += ["", f"EUR/USD {fmt_num(fx, 4) if fx else '—'}", SITE]
    return "\n".join(lines)


def send_mail(subject, text, html):
    host = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
    port = int(os.environ.get("SMTP_PORT") or "587")
    user = os.environ.get("SMTP_USER") or os.environ.get("MAIL_FROM") or TO_DEFAULT
    password = os.environ.get("SMTP_PASSWORD") or ""
    mail_from = os.environ.get("MAIL_FROM") or user
    mail_to = os.environ.get("MAIL_TO") or TO_DEFAULT
    if not password:
        raise SystemExit("Falta el secreto SMTP_PASSWORD")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = mail_to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    if port == 465:
        smtp = smtplib.SMTP_SSL(host, port, timeout=30)
    else:
        smtp = smtplib.SMTP(host, port, timeout=30)
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
    with smtp:
        smtp.login(user, password)
        smtp.send_message(msg)
    print("email ok", mail_to, subject)


def main():
    forced = os.environ.get("SESSION") or os.environ.get("INPUT_SESSION") or "auto"
    session = detect_session(forced)
    if not session:
        print("fuera de ventana de apertura; no se envia")
        return 0
    data = load_prices()
    rows = build_rows(data)
    when = now_utc().astimezone(MADRID).strftime("%A %d/%m/%Y %H:%M Madrid")
    title = "Apertura Europa" if session == "europa" else "Apertura Wall Street"
    tsla = next((r for r in rows if r["ticker"] == "TSLA"), None)
    tsla_txt = fmt_num(tsla["px"], 2) if tsla and tsla["px"] else "—"
    subject = f"{title} · TSLA {tsla_txt} USD · cartera Javi"
    send_mail(subject, text_email(session, data, rows, when), html_email(session, data, rows, when))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
import json
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from zoneinfo import ZoneInfo

MADRID = ZoneInfo("Europe/Madrid")
NY = ZoneInfo("America/New_York")
TO_DEFAULT = "javier@doctormembrillo.com"
SITE = "https://javimembrillo.github.io/cartera-javi/"
WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
DEFAULT_HOLDINGS = [
    {"ticker": "TSLA", "name": "Tesla", "currency": "USD", "symbol": "TSLA"},
    {"ticker": "SPCX", "name": "SpaceX", "currency": "USD", "symbol": "SPCX"},
    {"ticker": "NVDA", "name": "NVIDIA", "currency": "USD", "symbol": "NVDA"},
    {"ticker": "QDVE", "name": "iShares S&P 500 Info Tech", "currency": "EUR", "symbol": "QDVE.DE"},
    {"ticker": "VWCE", "name": "Vanguard FTSE All-World", "currency": "EUR", "symbol": "VWCE.DE"},
    {"ticker": "BTC", "name": "Bitcoin", "currency": "EUR", "symbol": "BTC-EUR"},
]

# Hasta ~3 h tras la apertura, más un margen corto por retrasos del cron.
WINDOW_MINUTES = 195
MARKER_DIR = Path(".open-email-sent")


def fmt_num(n, dec=2):
    try:
        n = float(n)
    except (TypeError, ValueError):
        return "sin dato"
    s = f"{n:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def now_utc():
    return datetime.now(timezone.utc)


def format_when(dt=None):
    dt = dt or now_utc().astimezone(MADRID)
    return f"{WEEKDAYS[dt.weekday()]} {dt.strftime('%d/%m/%Y %H:%M')} Madrid"


def in_window(local, hour, minute, span=WINDOW_MINUTES):
    if local.weekday() >= 5:
        return False
    cur = local.hour * 60 + local.minute
    start = hour * 60 + minute
    return start <= cur <= start + span


def marker_file(session):
    day = now_utc().astimezone(MADRID).strftime("%Y-%m-%d")
    return MARKER_DIR / f"{day}-{session}"


def already_sent(session):
    return marker_file(session).is_file()


def write_marker(session):
    MARKER_DIR.mkdir(parents=True, exist_ok=True)
    marker_file(session).write_text(now_utc().isoformat(), encoding="utf-8")


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


def _as_holding(h):
    if not isinstance(h, dict):
        return None
    tk = str(h.get("ticker") or "").strip().upper()
    if not tk:
        return None
    return {
        "ticker": tk,
        "name": str(h.get("name") or tk).strip(),
        "currency": str(h.get("currency") or h.get("ccy") or "").strip().upper(),
        "symbol": str(h.get("symbol") or h.get("yahoo") or tk).strip(),
    }


def load_holdings():
    try:
        raw = json.loads(Path("holdings.json").read_text(encoding="utf-8"))
        items = raw.get("holdings") if isinstance(raw, dict) else raw
        out = [x for x in (_as_holding(h) for h in items or []) if x]
        if out:
            return out
    except FileNotFoundError:
        pass
    except Exception as e:
        print("holdings.json no usable, uso lista por defecto:", e)
    return list(DEFAULT_HOLDINGS)


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
    try:
        with open("prices.json", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print("prices.json no usable:", e)
        return {}


def build_rows(data, holdings=None):
    holdings = holdings or load_holdings()
    today = now_utc().astimezone(MADRID).strftime("%Y-%m-%d")
    daily = data.get("daily") or {}
    prices = data.get("prices") or {}
    rows = []
    for h in holdings:
        tk = h["ticker"]
        px = prices.get(tk)
        try:
            px = float(px) if px is not None else None
            if px is not None and px <= 0:
                px = None
        except (TypeError, ValueError):
            px = None
        prev, prev_d = prev_close(daily, tk, today)
        chg = None
        if px is not None and prev:
            chg = (px - prev) / prev * 100
        rows.append({
            "ticker": tk,
            "name": h.get("name") or tk,
            "ccy": h.get("currency") or "",
            "symbol": h.get("symbol") or tk,
            "px": px,
            "chg": chg,
            "prev_d": prev_d,
        })
    return rows


def fmt_px(row):
    if row.get("px") is None:
        return "sin dato"
    return fmt_num(row["px"], 2)


def fmt_change(chg):
    if chg is None:
        return "sin dato"
    if abs(chg) < 0.005:
        return "= 0,00%"
    arrow = "▲" if chg >= 0 else "▼"
    sign = "+" if chg >= 0 else ""
    return f"{arrow} {sign}{fmt_num(chg, 2)}%"


def change_tone(chg):
    if chg is None:
        return "muted"
    if abs(chg) < 0.005:
        return "flat"
    return "up" if chg >= 0 else "down"


def close_label(rows):
    dates = [r["prev_d"] for r in rows if r.get("prev_d")]
    if not dates:
        return "respecto al cierre anterior"
    # Fecha más frecuente (normalmente el último día hábil).
    best = max(set(dates), key=dates.count)
    parts = best.split("-")
    if len(parts) == 3:
        best = f"{parts[2]}/{parts[1]}/{parts[0]}"
    return f"respecto al cierre del {best}"


def summary_bits(rows, include_flat=True):
    bits = []
    for r in rows:
        chg = fmt_change(r["chg"])
        if not include_flat and r["chg"] is not None and abs(r["chg"]) < 0.005:
            continue
        bits.append(f"{r['ticker']} {chg}")
    return bits


def subject_line(title, rows):
    movers = [r for r in rows if r["chg"] is not None and abs(r["chg"]) >= 0.005]
    movers.sort(key=lambda r: abs(r["chg"]), reverse=True)
    parts = [title]
    if movers:
        for r in movers[:3]:
            parts.append(f"{r['ticker']} {fmt_change(r['chg'])}")
    else:
        priced = [r for r in rows if r.get("px") is not None]
        for r in priced[:2]:
            parts.append(f"{r['ticker']} {fmt_px(r)} {r['ccy']}".strip())
    return " · ".join(parts) + " · cartera Javi"


def html_email(session, data, rows, when):
    title = "Apertura Europa" if session == "europa" else "Apertura Wall Street"
    subtitle = (
        "Bolsa europea (BME / Xetra / Euronext) · 09:00 Madrid"
        if session == "europa"
        else "NYSE / Nasdaq · 09:30 Nueva York (15:30 en Madrid la mayor parte del año)"
    )
    fx = data.get("eurusd")
    updated = data.get("updatedAt") or ""
    vs = close_label(rows)
    colors = {"up": "#22c55e", "down": "#ef4444", "flat": "#d4d4de", "muted": "#9a9aab"}
    items = []
    for r in rows:
        px = fmt_px(r)
        ccy = r["ccy"]
        price = "sin dato" if px == "sin dato" else f"{px} {ccy}".strip()
        tone = change_tone(r["chg"])
        items.append(
            "<tr>"
            f"<td style='padding:10px 8px;border-bottom:1px solid #2e2e3a'><b>{r['ticker']}</b><br>"
            f"<span style='color:#9a9aab;font-size:12px'>{r['name']}</span></td>"
            f"<td style='padding:10px 8px;border-bottom:1px solid #2e2e3a;text-align:right'>{price}</td>"
            f"<td style='padding:10px 8px;border-bottom:1px solid #2e2e3a;text-align:right;color:{colors[tone]}'>{fmt_change(r['chg'])}</td>"
            "</tr>"
        )
    resumen = " · ".join(summary_bits(rows, include_flat=True))
    missing = [r["ticker"] for r in rows if r["px"] is None or r["chg"] is None]
    err_html = ""
    if missing:
        err_html = (
            "<p style='color:#9a9aab;font-size:13px'>Sin dato en "
            + ", ".join(missing)
            + " (precio o cierre anterior).</p>"
        )
    return f"""<!doctype html>
<html><body style="margin:0;padding:24px;background:#0f0f12;color:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#1a1a21;border:1px solid #2e2e3a;border-radius:16px;padding:20px">
    <p style="margin:0 0 4px;color:#9a9aab;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Cartera Javi</p>
    <h1 style="margin:0 0 8px;font-size:22px">{title}</h1>
    <p style="margin:0 0 8px;color:#9a9aab">{subtitle}<br>{when}</p>
    <p style="margin:0 0 16px;color:#f0f0f5;font-size:14px">Cambio {vs}: {resumen}</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr style="color:#9a9aab;font-size:12px;text-transform:uppercase">
        <th style="text-align:left;padding:0 8px 8px">Activo</th>
        <th style="text-align:right;padding:0 8px 8px">Precio</th>
        <th style="text-align:right;padding:0 8px 8px">vs cierre anterior</th>
      </tr>
      {''.join(items)}
    </table>
    <p style="margin:16px 0 0;color:#9a9aab;font-size:13px">EUR/USD {fmt_num(fx, 4) if fx else 'sin dato'} · Actualizado {updated}</p>
    {err_html}
    <p style="margin:18px 0 0"><a href="{SITE}" style="color:#3b82f6">Abrir la cartera</a></p>
  </div>
</body></html>"""


def text_email(session, data, rows, when):
    title = "Apertura Europa" if session == "europa" else "Apertura Wall Street"
    vs = close_label(rows)
    lines = [
        title,
        when,
        f"Cambio {vs}: " + " · ".join(summary_bits(rows, include_flat=True)),
        "",
    ]
    for r in rows:
        px = fmt_px(r)
        price = "sin dato" if px == "sin dato" else f"{px} {r['ccy']}".strip()
        lines.append(f"{r['ticker']}  {price}  {fmt_change(r['chg'])}")
    fx = data.get("eurusd")
    lines += ["", f"EUR/USD {fmt_num(fx, 4) if fx else 'sin dato'}", SITE]
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
    # workflow_dispatch puede reenviar a propósito; los crons, solo una vez al día por sesión.
    event = (os.environ.get("GITHUB_EVENT_NAME") or "").strip()
    if event != "workflow_dispatch" and already_sent(session):
        print(f"ya enviado hoy para {session}; no se reenvia")
        return 0
    holdings = load_holdings()
    data = load_prices()
    rows = build_rows(data, holdings)
    when = format_when()
    title = "Apertura Europa" if session == "europa" else "Apertura Wall Street"
    subject = subject_line(title, rows)
    send_mail(subject, text_email(session, data, rows, when), html_email(session, data, rows, when))
    write_marker(session)
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Aviso diario para Martín sobre sus acciones de SpaceX (SPCX)."""
import json
import os
import smtplib
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from zoneinfo import ZoneInfo

from send_open_email import fmt_num, load_prices, parse_recipients

MADRID = ZoneInfo("Europe/Madrid")
NY = ZoneInfo("America/New_York")
TO_TEST_DEFAULT = "javier@doctormembrillo.com"
SITE = "https://javimembrillo.github.io/cartera-javi/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
WINDOW_MINUTES = 195  # desde las 10:00 NY, ~3 h más un margen
MARKER_DIR = Path(".kids-email-sent")
CONFIG_PATH = Path("kids-martin.json")

# Festivos en que NYSE/Nasdaq están cerrados (alineado con market-status.js).
NYSE_CLOSED = {
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
    "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
}

WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def now_utc():
    return datetime.now(timezone.utc)


def truthy(raw):
    return (raw or "").strip().lower() in {"1", "true", "yes", "y", "on", "si", "sí"}


def format_when(dt=None):
    dt = dt or now_utc().astimezone(MADRID)
    return f"{WEEKDAYS[dt.weekday()]} {dt.strftime('%d/%m/%Y %H:%M')} Madrid"


def fmt_date(iso):
    if not iso:
        return None
    parts = str(iso).split("-")
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return str(iso)


def money_usd(n):
    return f"{fmt_num(n, 2)} $"


def money_eur(n):
    return f"{fmt_num(n, 2)} €"


def pct(n):
    if n is None:
        return "sin dato"
    sign = "+" if n > 0 else ""
    return f"{sign}{fmt_num(n, 2)} %"


def in_window(local, hour, minute, span=WINDOW_MINUTES):
    cur = local.hour * 60 + local.minute
    start = hour * 60 + minute
    return start <= cur <= start + span


def is_nyse_trading_day(ny_dt):
    if ny_dt.weekday() >= 5:
        return False
    return ny_dt.strftime("%Y-%m-%d") not in NYSE_CLOSED


def marker_file(day):
    return MARKER_DIR / f"{day}-martin-spcx"


def already_sent(day):
    return marker_file(day).is_file()


def write_marker(day):
    MARKER_DIR.mkdir(parents=True, exist_ok=True)
    marker_file(day).write_text(now_utc().isoformat(), encoding="utf-8")


def load_config():
    raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    holdings = raw.get("holdings") or []
    if not holdings:
        raise SystemExit("kids-martin.json no tiene holdings")
    h = holdings[0]
    buys = h.get("buys") or []
    qty = 0.0
    cost = 0.0
    for b in buys:
        q = float(b.get("qty") or 0)
        px = float(b.get("px_usd") or 0)
        qty += q
        cost += q * px
    if not qty:
        qty = float(h.get("qty") or 0)
    if not cost:
        raise SystemExit("no hay precio de compra en kids-martin.json")
    return {
        "child_name": raw.get("child_name") or "Martín",
        "ticker": (h.get("ticker") or "SPCX").upper(),
        "name": h.get("name") or "SpaceX",
        "qty": qty,
        "cost_usd": cost,
        "buys": buys,
    }


def get_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def trading_closes(daily, ticker, upto_day, limit=8):
    """Cierres más recientes en días de bolsa, el más nuevo primero."""
    out = []
    for day in sorted((daily or {}), reverse=True):
        if day > upto_day:
            continue
        try:
            d = datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=NY)
        except ValueError:
            continue
        if not is_nyse_trading_day(d):
            continue
        px = (daily.get(day) or {}).get(ticker)
        try:
            px = float(px)
        except (TypeError, ValueError):
            continue
        if px > 0:
            out.append((day, px))
        if len(out) >= limit:
            break
    return out


def change_24h(ticker="SPCX"):
    """Precio hace ~24 h, si Yahoo da datos horarios."""
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/%s"
        "?interval=1h&range=5d&includePrePost=true" % ticker
    )
    try:
        j = get_json(url)
        res = (j.get("chart") or {}).get("result") or []
        if not res:
            return None
        ts = res[0].get("timestamp") or []
        q = ((res[0].get("indicators") or {}).get("quote") or [{}])[0]
        closes = q.get("close") or []
        rows = []
        for t, c in zip(ts, closes):
            if c is None:
                continue
            try:
                c = float(c)
            except (TypeError, ValueError):
                continue
            if c > 0:
                rows.append((datetime.fromtimestamp(int(t), timezone.utc), c))
        if len(rows) < 2:
            return None
        now_ts, now_px = rows[-1]
        target = now_ts - timedelta(hours=24)
        prev = None
        for t, c in rows:
            if t <= target:
                prev = (t, c)
        if not prev:
            return None
        prev_t, prev_px = prev
        return {
            "px_now": now_px,
            "px_then": prev_px,
            "when_then": prev_t,
            "chg": (now_px - prev_px) / prev_px * 100,
        }
    except Exception as e:
        print("24h yahoo fail", e)
        return None


def analyst_target(ticker="SPCX"):
    """Intenta un precio objetivo publicado. Si no hay fuente fiable, None."""
    modules = "financialData,defaultKeyStatistics,price"
    urls = [
        "https://query1.finance.yahoo.com/v10/finance/quoteSummary/%s?modules=%s" % (ticker, modules),
        "https://query2.finance.yahoo.com/v10/finance/quoteSummary/%s?modules=%s" % (ticker, modules),
        "https://query1.finance.yahoo.com/v11/finance/quoteSummary/%s?modules=%s" % (ticker, modules),
    ]
    for url in urls:
        try:
            j = get_json(url)
            res = ((j.get("quoteSummary") or {}).get("result") or [None])[0] or {}
            fd = res.get("financialData") or {}

            def raw(key):
                val = fd.get(key)
                if isinstance(val, dict):
                    val = val.get("raw")
                try:
                    val = float(val)
                except (TypeError, ValueError):
                    return None
                return val if val > 0 else None

            mean = raw("targetMeanPrice")
            low = raw("targetLowPrice")
            high = raw("targetHighPrice")
            n = raw("numberOfAnalystOpinions")
            rec = fd.get("recommendationKey") or ""
            if mean:
                return {
                    "source": "Yahoo Finance",
                    "mean": mean,
                    "low": low,
                    "high": high,
                    "n": int(n) if n else None,
                    "rec": rec,
                }
        except Exception as e:
            print("target fail", url.split(".com")[-1][:40], type(e).__name__)
    return None


def build_snapshot(cfg, data, extra_24h=None, forecast=None, market_open=None):
    ticker = cfg["ticker"]
    today = now_utc().astimezone(NY).strftime("%Y-%m-%d")
    prices = data.get("prices") or {}
    px = prices.get(ticker)
    try:
        px = float(px) if px is not None else None
        if px is not None and px <= 0:
            px = None
    except (TypeError, ValueError):
        px = None
    daily = data.get("daily") or {}
    if market_open:
        upto = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        closes = trading_closes(daily, ticker, upto)
        prev, prev_d = (closes[0][1], closes[0][0]) if closes else (None, None)
        chg_session = ((px - prev) / prev * 100) if px and prev else None
    else:
        # El último precio oficial es el cierre de la última sesión; se compara con la anterior.
        upto = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        closes = trading_closes(daily, ticker, upto)
        if len(closes) >= 2:
            prev, prev_d = closes[1][1], closes[1][0]
            last_px = closes[0][1]
            chg_session = (last_px - prev) / prev * 100
            if px is None:
                px = last_px
        elif closes:
            prev, prev_d = closes[0][1], closes[0][0]
            chg_session = None
        else:
            prev, prev_d, chg_session = None, None, None
    eurusd = data.get("eurusd")
    try:
        eurusd = float(eurusd) if eurusd else None
        if eurusd is not None and eurusd <= 0:
            eurusd = None
    except (TypeError, ValueError):
        eurusd = None

    value = (px * cfg["qty"]) if px is not None else None
    cost = cfg["cost_usd"]
    pl = (value - cost) if value is not None else None
    pl_pct = (pl / cost * 100) if pl is not None and cost else None
    value_eur = (value / eurusd) if value is not None and eurusd else None
    cost_eur = (cost / eurusd) if eurusd else None
    pl_eur = (pl / eurusd) if pl is not None and eurusd else None

    return {
        "cfg": cfg,
        "px": px,
        "prev": prev,
        "prev_d": prev_d,
        "chg_open": chg_session,
        "eurusd": eurusd,
        "value": value,
        "cost": cost,
        "pl": pl,
        "pl_pct": pl_pct,
        "value_eur": value_eur,
        "cost_eur": cost_eur,
        "pl_eur": pl_eur,
        "h24": extra_24h,
        "forecast": forecast,
        "market_open": market_open,
        "when": format_when(),
        "updated": data.get("updatedAt") or "",
    }


def _updown_word(chg):
    if chg is None:
        return None
    if abs(chg) < 0.05:
        return "casi no se ha movido"
    return "ha subido" if chg > 0 else "ha bajado"


def _arrow(chg):
    if chg is None:
        return ""
    if abs(chg) < 0.05:
        return "="
    return "▲" if chg > 0 else "▼"


def subject_line(snap):
    name = snap["cfg"]["child_name"]
    if snap["pl"] is None:
        return f"{name}, hoy no he podido ver el precio de tus SpaceX"
    if snap["pl"] > 1:
        return f"{name}, tus SpaceX van ganando {money_usd(snap['pl'])} 🚀"
    if snap["pl"] < -1:
        return f"{name}, tus SpaceX van un poquito por debajo hoy"
    return f"{name}, tus SpaceX están casi igual que cuando las compraste"


def text_email(snap):
    cfg = snap["cfg"]
    name = cfg["child_name"]
    buys_txt = " y ".join(
        f"una a {fmt_num(float(b.get('px_usd')), 0)} $" for b in cfg["buys"]
    )
    if not buys_txt:
        buys_txt = f"por {money_usd(cfg['cost'])}"

    lines = [
        f"Hola {name} 👋",
        "",
        "Te escribo para contarte cómo van tus dos acciones de SpaceX, la empresa de cohetes.",
        "",
    ]

    if snap["px"] is None:
        lines += [
            "Hoy no he podido ver el precio. No te preocupes: lo intentaré de nuevo en el próximo aviso.",
        ]
    else:
        lines += [
            f"Tus 2 acciones valen ahora mismo {money_usd(snap['value'])} (cada una a {money_usd(snap['px'])}).",
            f"Las compraste por {money_usd(snap['cost'])} ({buys_txt}).",
        ]
        if snap["pl"] is None:
            lines.append("Hoy no puedo calcular si vas ganando o perdiendo.")
        elif abs(snap["pl"]) < 1:
            extra = f" En euros serían unos {money_eur(snap['value_eur'])}." if snap["value_eur"] else ""
            lines.append(
                f"Estás casi igual que al comprarlas: la diferencia es de {money_usd(snap['pl'])} ({pct(snap['pl_pct'])})."
                + extra
            )
        elif snap["pl"] > 0:
            extra = f" En euros, ganas unos {money_eur(snap['pl_eur'])}." if snap["pl_eur"] is not None else ""
            lines.append(
                f"Ahora mismo vas ganando {money_usd(snap['pl'])}. Eso es un {pct(snap['pl_pct'])} respecto a lo que pagaste."
                + extra
            )
        else:
            extra = f" En euros, son unos {money_eur(abs(snap['pl_eur']))} menos." if snap["pl_eur"] is not None else ""
            lines.append(
                f"Ahora mismo vas un poquito por debajo: {money_usd(abs(snap['pl']))} menos que lo que pagaste ({pct(snap['pl_pct'])})."
                + extra
            )
            lines.append("No pasa nada. Los precios suben y bajan muchos días. Lo importante es mirar el conjunto, no solo un día.")

    lines.append("")

    # Apertura vs cierre anterior
    if snap["market_open"] is False:
        if snap["px"] is not None:
            lines.append(
                f"Wall Street todavía no ha abierto hoy. El último precio es el del cierre anterior: {money_usd(snap['px'])}."
            )
        else:
            lines.append("Wall Street todavía no ha abierto hoy.")
    if snap["chg_open"] is None or snap["prev"] is None:
        lines.append("No he podido comparar el precio con el cierre anterior (eso es el último precio de ayer, cuando el mercado cerró).")
    else:
        word = _updown_word(snap["chg_open"])
        close_d = fmt_date(snap["prev_d"]) or "ayer"
        if snap["market_open"] is False:
            head = f"En la última sesión, respecto al cierre del {close_d}"
        else:
            head = f"En la apertura de hoy, respecto al cierre del {close_d}"
        if abs(snap["chg_open"]) < 0.05:
            lines.append(f"{head}, el precio {word}: sigue cerca de {money_usd(snap['prev'])}.")
        else:
            lines.append(
                f"{head}, el precio {word} un {pct(snap['chg_open'])} "
                f"({money_usd(snap['prev'])} → {money_usd(snap['px'])})."
            )

    # 24 horas
    h24 = snap["h24"]
    px_now_24 = snap["px"] if snap["px"] is not None else (h24["px_now"] if h24 else None)
    chg_24 = None
    if h24 and px_now_24 and h24.get("px_then"):
        chg_24 = (px_now_24 - h24["px_then"]) / h24["px_then"] * 100
    if chg_24 is None:
        lines.append("De las últimas 24 horas no he podido sacar una cifra clara, así que me fijo sobre todo en el cierre anterior.")
    else:
        word = _updown_word(chg_24)
        if abs(chg_24) < 0.05:
            lines.append("En las últimas 24 horas el precio casi no se ha movido.")
        else:
            lines.append(
                f"En las últimas 24 horas el precio {word} un {pct(chg_24)} "
                f"(pasó de {money_usd(h24['px_then'])} a {money_usd(px_now_24)})."
            )

    lines.append("")

    # Evolución neta desde la compra
    if snap["pl"] is not None:
        lines.append(
            f"La evolución neta (o sea, cómo te ha ido de verdad desde que las compraste) es esta: "
            f"empezaste con {money_usd(snap['cost'])} y ahora tienes {money_usd(snap['value'])} "
            f"({pct(snap['pl_pct'])})."
        )

    lines.append("")
    forecast = snap["forecast"]
    if forecast and forecast.get("mean"):
        bits = [
            f"Algunos analistas (personas que estudian empresas) publican en Yahoo Finance un precio que les parece razonable a largo plazo: unos {money_usd(forecast['mean'])} por acción."
        ]
        if forecast.get("low") and forecast.get("high"):
            bits.append(
                f"Entre ellos, el más prudente habla de {money_usd(forecast['low'])} y el más optimista de {money_usd(forecast['high'])}."
            )
        if forecast.get("n"):
            bits.append(f"Esa media sale de {forecast['n']} opiniones.")
        bits.append("Ojo: una previsión es solo una opinión, no una promesa. Nadie sabe seguro lo que hará el precio.")
        lines.extend(bits)
    else:
        lines += [
            "He buscado si los analistas (personas que estudian empresas) tienen una previsión de precio para SpaceX, y hoy no he encontrado una cifra publicada de confianza.",
            "Eso no es raro. Nadie sabe seguro lo que hará el precio. Las previsiones son solo opiniones, no una promesa. Si más adelante hay datos, te los cuento.",
        ]

    lines += [
        "",
        "Un abrazo,",
        "Sydney",
        "La asistente digital de papá",
        "",
        "Este correo lo he escrito yo, Sydney, la asistente digital de papá.",
    ]
    return "\n".join(lines)


def html_email(snap):
    # Versión HTML sencilla, misma idea que el texto.
    body = text_email(snap)
    paras = []
    for block in body.split("\n\n"):
        safe = (
            block.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br>")
        )
        paras.append(f'<p style="margin:0 0 14px;line-height:1.5">{safe}</p>')
    return f"""<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f1ea;color:#1f1b16;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fffaf3;border:1px solid #eadfce;border-radius:16px;padding:24px">
    {''.join(paras)}
  </div>
</body></html>"""


def send_mail(subject, text, html, recipients, mail_from):
    host = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
    port = int(os.environ.get("SMTP_PORT") or "587")
    user = os.environ.get("SMTP_USER") or mail_from
    password = os.environ.get("SMTP_PASSWORD") or ""
    if not password:
        raise SystemExit("Falta el secreto SMTP_PASSWORD")
    if not recipients:
        raise SystemExit("No hay destinatarios")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr(("Sydney, asistente de papá", mail_from))
    msg["To"] = ", ".join(recipients)
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
        smtp.send_message(msg, to_addrs=recipients)
    print("email ok", ", ".join(recipients), subject)


def resolve_recipients(event_name):
    """En un cron, solo si está activado. En un disparo manual, el input manda (nunca Martín por defecto)."""
    override = (os.environ.get("KIDS_MAIL_TO_OVERRIDE") or "").strip()
    if event_name == "workflow_dispatch":
        if not override:
            raise SystemExit("En un disparo manual hay que indicar mail_to (para la prueba, el correo de Javi).")
        return parse_recipients(override, default=TO_TEST_DEFAULT), None
    if not truthy(os.environ.get("KIDS_ENABLED")):
        return None, "avisos de Martín desactivados (KIDS_ENABLED no está en true)"
    raw = (os.environ.get("KIDS_MAIL_TO") or "").strip()
    if not raw:
        return None, "falta el secreto KIDS_MAIL_TO; no se envia"
    return parse_recipients(raw), None


def main(argv=None):
    argv = list(argv or sys.argv[1:])
    dry = "--dry-run" in argv
    event = (os.environ.get("GITHUB_EVENT_NAME") or "").strip()
    force = truthy(os.environ.get("KIDS_FORCE")) or "--force" in argv
    ny = now_utc().astimezone(NY)
    day = ny.strftime("%Y-%m-%d")
    market_open = is_nyse_trading_day(ny) and in_window(ny, 9, 30, span=6 * 60 + 30)

    if not dry:
        recipients, reason = resolve_recipients(event or "schedule")
        if reason:
            print(reason)
            return 0
        if not force:
            if not is_nyse_trading_day(ny):
                print("Wall Street cerrado hoy; no se envia")
                return 0
            if not in_window(ny, 10, 0):
                print("fuera de ventana de aviso de Martín; no se envia")
                return 0
            if event != "workflow_dispatch" and already_sent(day):
                print(f"ya enviado hoy ({day}); no se reenvia")
                return 0
    else:
        recipients = parse_recipients(os.environ.get("KIDS_MAIL_TO_OVERRIDE") or TO_TEST_DEFAULT)
        print("dry-run, no se envia. destinatarios previstos:", ", ".join(recipients))

    cfg = load_config()
    data = load_prices()
    h24 = change_24h(cfg["ticker"])
    forecast = analyst_target(cfg["ticker"])
    snap = build_snapshot(cfg, data, extra_24h=h24, forecast=forecast, market_open=market_open)
    subject = subject_line(snap)
    text = text_email(snap)
    html = html_email(snap)

    if dry:
        print("SUBJECT:", subject)
        print("======= BODY =======")
        print(text)
        return 0

    mail_from = os.environ.get("MAIL_FROM") or os.environ.get("SMTP_USER") or TO_TEST_DEFAULT
    send_mail(subject, text, html, recipients, mail_from)
    write_marker(day)
    return 0


if __name__ == "__main__":
    sys.exit(main())

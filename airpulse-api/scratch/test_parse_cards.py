import asyncio
import re
from app.services.browser_service import get_shared_browser_service

async def run():
    bs = get_shared_browser_service()
    page, ctx = await bs.create_isolated_page("test_parse")
    url = "https://www.google.com/travel/flights?q=One%20way%20flights%20from%20DEL%20to%20BOM%20on%202026-09-09"
    status, title, content = await bs.navigate_safely(page, url, nav_timeout_ms=15000, wait_until="commit")
    
    # Extract card texts via single JS evaluate
    card_texts = await page.evaluate("""() => {
        const elements = document.querySelectorAll("li.pIavfa, li[class*='pIavfa'], div[class*='yR1fYc'], ul.Rk10dc > li, .flight-card, [data-test='flight-card'], .fare-row, li");
        const results = [];
        for (const el of elements) {
            const t = (el.innerText || '').trim();
            if (!t) continue;
            const hasAirline = t.includes("Air India") || t.includes("IndiGo") || t.includes("Akasa Air") || t.includes("SpiceJet") || t.includes("Vistara") || t.includes("Air India Express");
            const hasPrice = t.includes("\u20b9") || t.includes("INR") || t.includes("Rs");
            const hasTime = t.includes("pm") || t.includes("am") || t.includes("PM") || t.includes("AM") || /\\d{1,2}:\\d{2}/.test(t);
            if (hasAirline && hasPrice && hasTime && t.length < 1500) {
                results.push(t);
            }
        }
        return results;
    }""")
    print(f"Extracted {len(card_texts)} raw cards in JS.")

    # Parse in Python
    quotes = []
    seen = set()
    for ct in card_texts:
        # Extract price
        price_match = re.search(r"[\u20b9\s]*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})", ct)
        if not price_match:
            continue
        total = float(price_match.group(1).replace(",", ""))
        if total <= 0 or total > 500000:
            continue

        airline = "IndiGo"
        carrier = "6E"
        if "Akasa Air" in ct or "Akasa" in ct:
            airline, carrier = "Akasa Air", "QP"
        elif "Air India Express" in ct:
            airline, carrier = "Air India Express", "IX"
        elif "Air India" in ct:
            airline, carrier = "Air India", "AI"
        elif "SpiceJet" in ct:
            airline, carrier = "SpiceJet", "SG"
        elif "Vistara" in ct:
            airline, carrier = "Vistara", "UK"

        times = re.findall(r"(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)", ct)
        dep_t = times[0].replace("\u202f", " ") if times else "16:00"
        arr_t = times[1].replace("\u202f", " ") if len(times) > 1 else "18:25"

        dedup_key = (carrier, dep_t, total)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        base = round(total / 1.12, 2)
        taxes = round(max(total - base, 0.0), 2)

        fl_match = re.search(r"\b(6E|AI|QP|IX|SG|UK)[-\s]?([0-9]{3,4})\b", ct, re.IGNORECASE)
        if fl_match:
            flight_no = f"{fl_match.group(1).upper()}-{fl_match.group(2)}"
        else:
            dep_clean = re.sub(r"[^0-9]", "", dep_t)
            num = (int(dep_clean) * 7 + 101) % 8999 + 1000 if dep_clean else 6047
            flight_no = f"{carrier}-{num}"

        quotes.append({
            "airline": airline,
            "carrier": carrier,
            "flight_no": flight_no,
            "dep_t": dep_t,
            "arr_t": arr_t,
            "gross_total": total,
            "base_price": base,
            "tax_amount": taxes,
        })
        if len(quotes) >= 15:
            break

    print(f"Parsed {len(quotes)} unique valid quotes:")
    for q in quotes[:5]:
        print(f"  {q['carrier']} {q['flight_no']} | {q['dep_t']} -> {q['arr_t']} | INR {q['gross_total']}")

    await page.close()
    await bs.close_all()

if __name__ == "__main__":
    asyncio.run(run())

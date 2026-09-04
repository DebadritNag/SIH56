import asyncio
import time
from app.services.browser_service import get_shared_browser_service

async def run():
    bs = get_shared_browser_service()
    t0 = time.time()
    page, ctx = await bs.create_isolated_page("test_timing")
    t1 = time.time()
    print(f"create_page: {t1-t0:.2f}s")
    url = "https://www.google.com/travel/flights?q=One%20way%20flights%20from%20DEL%20to%20BOM%20on%202026-09-09"
    status, title, content = await bs.navigate_safely(page, url, nav_timeout_ms=15000, wait_until="commit")
    t2 = time.time()
    print(f"navigate: {t2-t1:.2f}s, status: {status}, title: {title[:30]}")

    t_eval_start = time.time()
    card_texts = await page.evaluate("""() => {
        const elements = document.querySelectorAll("li, div[role='listitem'], .flight-card, div.yR1fYc");
        const results = [];
        for (const el of elements) {
            const t = el.innerText;
            if (t && (t.includes("Air India") || t.includes("IndiGo") || t.includes("Akasa Air") || t.includes("SpiceJet") || t.includes("Vistara")) && (t.includes("\u20b9") || t.includes("INR") || t.includes("pm") || t.includes("am"))) {
                results.push(t);
            }
        }
        return results;
    }""")
    t3 = time.time()
    print(f"evaluate: {t3-t_eval_start:.2f}s, matching count: {len(card_texts)}")
    if card_texts:
        print("Sample:", card_texts[0].replace("\n", " ")[:100])
    await page.close()
    await bs.close_all()

if __name__ == "__main__":
    asyncio.run(run())

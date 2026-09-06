"""Verify the actual headed Chrome binary; no external network or DB access."""
import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel='chrome',headless=False)
        try:
            page = await browser.new_page()
            await page.set_content('<title>AirPulse Chrome check</title><p>Ready</p>')
            assert await page.title() == 'AirPulse Chrome check'
            print(f'Headed Google Chrome {browser.version}: launch and render passed')
        finally:
            await browser.close()


if __name__=='__main__':
    asyncio.run(main())

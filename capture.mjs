import { chromium } from '@playwright/test';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate directly to the portal
    await page.goto('http://localhost', { waitUntil: 'networkidle' });

    // Give it a short moment for animations/images to load properly
    await page.waitForTimeout(2500);

    // Capture screenshot
    const screenshotPath = '/tmp/portal_preview.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log('Screenshot saved to ' + screenshotPath);
    await browser.close();
})();

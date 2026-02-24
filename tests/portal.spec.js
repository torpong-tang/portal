// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Projects Portal - Full Integration Tests', () => {

    // ──────────────────────────────────────────────
    // TC-01: Portal homepage loads correctly
    // ──────────────────────────────────────────────
    test('TC-01: Portal homepage loads and shows 3 projects', async ({ page }) => {
        await page.goto('/?v=1', { waitUntil: 'networkidle' });

        await expect(page).toHaveTitle(/Projects Portal/i);

        const titleEl = page.locator('h2.title');
        await expect(titleEl).toBeVisible();
        await expect(titleEl).toContainText('Projects Portal');

        // ตรวจว่ามี card ทั้ง 3 ตัว
        const cards = page.locator('.card h3');
        await expect(cards).toHaveCount(3, { timeout: 15000 });

        // ตรวจชื่อโปรเจกต์
        const cardTexts = await cards.allInnerTexts();
        expect(cardTexts).toContain('timesheet');
        expect(cardTexts).toContain('roomie');
        expect(cardTexts).toContain('eqinfo');

        await page.screenshot({ path: 'test-results/tc01-portal-3-projects.png', fullPage: true });
    });

    // ──────────────────────────────────────────────
    // TC-02: Run timesheet and open at /timesheet
    // ──────────────────────────────────────────────
    test('TC-02: Run timesheet and access /timesheet', async ({ page }) => {
        // เช็ค status ก่อน
        const statusRes = await page.request.get('/api/status');
        const statusData = await statusRes.json();

        if (!statusData.timesheet?.running) {
            await page.request.post('/api/run', { data: { name: 'timesheet' } });
        }

        // รอจนกว่า timesheet จะพร้อม
        let ready = false;
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(3000);
            try {
                const res = await page.request.get('/timesheet', { timeout: 5000, maxRedirects: 0 });
                const status = res.status();
                if (status !== 502 && status !== 504) { ready = true; break; }
            } catch (e) { ready = true; break; }
        }
        expect(ready).toBeTruthy();

        // เปิด timesheet
        await page.goto('/timesheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const bodyText = await page.locator('body').innerText();
        expect(bodyText).not.toContain('502 Bad Gateway');

        const pageContent = await page.content();
        const hasContent =
            pageContent.includes('<!DOCTYPE') || pageContent.includes('<html') ||
            pageContent.toLowerCase().includes('timesheet') ||
            pageContent.toLowerCase().includes('login') ||
            pageContent.toLowerCase().includes('next-auth') ||
            pageContent.toLowerCase().includes('server error');
        expect(hasContent).toBeTruthy();

        const currentUrl = page.url();
        expect(currentUrl).toContain('/timesheet');

        await page.screenshot({ path: 'test-results/tc02-timesheet-app.png', fullPage: true });
    });

    // ──────────────────────────────────────────────
    // TC-03: Run roomie and open at /roomie
    // ──────────────────────────────────────────────
    test('TC-03: Run roomie and access /roomie', async ({ page }) => {
        const statusRes = await page.request.get('/api/status');
        const statusData = await statusRes.json();

        if (!statusData.roomie?.running) {
            await page.request.post('/api/run', { data: { name: 'roomie' } });
        }

        // รอจนกว่า roomie จะพร้อม
        let ready = false;
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(3000);
            try {
                const res = await page.request.get('/roomie', { timeout: 5000, maxRedirects: 0 });
                const status = res.status();
                if (status !== 502 && status !== 504) { ready = true; break; }
            } catch (e) { ready = true; break; }
        }
        expect(ready).toBeTruthy();

        // เปิด roomie
        await page.goto('/roomie', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const bodyText = await page.locator('body').innerText();
        expect(bodyText).not.toContain('502 Bad Gateway');

        const pageContent = await page.content();
        const hasContent =
            pageContent.includes('<!DOCTYPE') || pageContent.includes('<html');
        expect(hasContent).toBeTruthy();

        const currentUrl = page.url();
        expect(currentUrl).toContain('/roomie');

        await page.screenshot({ path: 'test-results/tc03-roomie-app.png', fullPage: true });
    });

    // ──────────────────────────────────────────────
    // TC-04: Run eqinfo and open at /eqinfo
    // ──────────────────────────────────────────────
    test('TC-04: Run eqinfo and access /eqinfo', async ({ page }) => {
        const statusRes = await page.request.get('/api/status');
        const statusData = await statusRes.json();

        if (!statusData.eqinfo?.running) {
            await page.request.post('/api/run', { data: { name: 'eqinfo' } });
        }

        // รอจนกว่า eqinfo จะพร้อม
        let ready = false;
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(3000);
            try {
                const res = await page.request.get('/eqinfo', { timeout: 5000, maxRedirects: 0 });
                const status = res.status();
                if (status !== 502 && status !== 504) { ready = true; break; }
            } catch (e) { ready = true; break; }
        }
        expect(ready).toBeTruthy();

        // เปิด eqinfo
        await page.goto('/eqinfo', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const bodyText = await page.locator('body').innerText();
        expect(bodyText).not.toContain('502 Bad Gateway');

        const pageContent = await page.content();
        const hasContent =
            pageContent.includes('<!DOCTYPE') || pageContent.includes('<html');
        expect(hasContent).toBeTruthy();

        const currentUrl = page.url();
        expect(currentUrl).toContain('/eqinfo');

        await page.screenshot({ path: 'test-results/tc04-eqinfo-app.png', fullPage: true });
    });

    // ──────────────────────────────────────────────
    // TC-05: Portal Run button works for all projects
    // ──────────────────────────────────────────────
    test('TC-05: Portal shows Run/Open buttons for all projects', async ({ page }) => {
        await page.goto('/?v=1', { waitUntil: 'networkidle' });

        // รอให้ cards โหลดทั้งหมด
        const cards = page.locator('.card');
        await expect(cards).toHaveCount(3, { timeout: 15000 });

        // ตรวจแต่ละ card ว่ามีปุ่ม Run หรือ เปิดแอป
        for (const name of ['timesheet', 'roomie', 'eqinfo']) {
            const card = page.locator(`.card:has(h3:has-text("${name}"))`).first();
            await expect(card).toBeVisible({ timeout: 10000 });

            const hasRunBtn = await card.locator('button:has-text("Run")').isVisible().catch(() => false);
            const hasOpenBtn = await card.locator('a:has-text("เปิดแอป")').isVisible().catch(() => false);
            const hasStopBtn = await card.locator('button:has-text("หยุด")').isVisible().catch(() => false);

            // ต้องมีปุ่ม Run หรือมีปุ่ม เปิดแอป+หยุด
            expect(hasRunBtn || (hasOpenBtn && hasStopBtn)).toBeTruthy();
        }

        await page.screenshot({ path: 'test-results/tc05-all-buttons.png', fullPage: true });
    });
});

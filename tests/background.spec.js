import { test, expect } from '@playwright/test';

test.describe('Portal Application Background Brightness', () => {
    test('background image should be cloud_bg.jpg and overlay should be semi-transparent', async ({ page }) => {
        // Go to the portal
        await page.goto('http://localhost');

        // Wait for the body to be available
        const body = page.locator('body');
        await expect(body).toBeVisible();

        // 1. Get the computed styles of the background (the pseudo-element ::before)
        const beforeStyle = await body.evaluate((el) => {
            const style = window.getComputedStyle(el, '::before');
            return {
                backgroundImage: style.getPropertyValue('background-image'),
                backgroundColor: style.getPropertyValue('background-color'),
                opacity: style.getPropertyValue('opacity'),
            };
        });

        console.log('--- BACKGROUND IMAGE (::before) ---');
        console.log(beforeStyle);

        // Check that background contains our cloud image
        expect(beforeStyle.backgroundImage).toContain('cloud_bg.jpg');

        // 2. Get the computed styles of the dark overlay (the pseudo-element ::after)
        const afterStyle = await body.evaluate((el) => {
            const style = window.getComputedStyle(el, '::after');
            return {
                backgroundColor: style.getPropertyValue('background-color'),
                opacity: style.getPropertyValue('opacity'),
            };
        });

        console.log('--- DARK OVERLAY (::after) ---');
        console.log(afterStyle);

        // It should match rgba(10, 10, 15, 0.05) or similar low opacity
        // Browsers return computed background-color as rgba
        // Check if the alpha channel is small (0.05 is the target)
        const bgAlphaMatch = afterStyle.backgroundColor.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
        const alpha = bgAlphaMatch ? parseFloat(bgAlphaMatch[1]) : 1;

        console.log(`Computed Dark Overlay Alpha: ${alpha}`);

        // Assert the overlay is indeed low brightness (<= 0.5)
        expect(alpha).toBeLessThanOrEqual(0.1);

        // 3. Take a screenshot for the report
        await page.screenshot({ path: 'test-results/background-brightness-check.png', fullPage: true });
    });
});

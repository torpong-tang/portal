// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 60000,
    expect: {
        timeout: 10000,
    },
    fullyParallel: false,
    retries: 0,
    reporter: [
        ['html', { open: 'never' }],
        ['list'],
    ],
    use: {
        baseURL: 'http://localhost',
        trace: 'on-first-retry',
        screenshot: 'on',
        video: 'on',
        actionTimeout: 15000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                headless: true,
            },
        },
    ],
});

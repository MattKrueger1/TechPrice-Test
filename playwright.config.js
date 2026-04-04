const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 240000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    actionTimeout: 30000,
  },
});

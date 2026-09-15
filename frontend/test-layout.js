const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8001/', { waitUntil: 'networkidle', timeout: 10000 });
  const r = await page.evaluate(() => {
    const sh = document.querySelector('.pw-shell');
    const ed = document.querySelector('.pw-edge');
    const tr = document.querySelector('.pw-edge-assistant-trigger');
    return {
      shH: sh?.getBoundingClientRect().height,
      shOv: getComputedStyle(sh).overflow,
      edH: ed?.getBoundingClientRect().height,
      edOvY: getComputedStyle(ed).overflowY,
      trB: tr?.getBoundingClientRect().bottom,
      trV: tr ? tr.getBoundingClientRect().bottom <= window.innerHeight : false
    };
  });
  console.log('LAYOUT:', JSON.stringify(r, null, 2));
  const btn = await page.$('.pw-edge-assistant-trigger button');
  if (btn && await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(500);
    const d = await page.evaluate(() => {
      const el = document.querySelector('[data-pw-drawer]');
      return el ? { open: el.getAttribute('data-pw-drawer-open'), pos: getComputedStyle(el).position, r: el.getBoundingClientRect() } : null;
    });
    console.log('DRAWER:', JSON.stringify(d, null, 2));
  } else {
    console.log('TRIGGER NOT VISIBLE');
  }
  await browser.close();
})().catch(e => console.error(e.message));

import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3456/login');
  await page.fill('input[name="username"]', 'operator');
  await page.fill('input[name="password"]', 'Cop1lot!bndaba');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);

  // Go to article detail at mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:3456/articles/seahawks-qb-dilemma-is-sam-darnold-actually-their-long-term-');
  await page.waitForTimeout(500);

  // Get computed styles for key elements
  const styles = await page.evaluate(() => {
    const detailGrid = document.querySelector('.detail-grid');
    const detailMain = document.querySelector('.detail-main');
    const body = document.body;
    
    const getStyles = (el: Element | null) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        gridTemplateColumns: s.gridTemplateColumns,
        display: s.display,
        width: (el as HTMLElement).offsetWidth,
        scrollWidth: (el as HTMLElement).scrollWidth,
        clientWidth: (el as HTMLElement).clientWidth,
        overflow: s.overflow,
        overflowX: s.overflowX,
      };
    };
    
    return {
      viewport: window.innerWidth,
      bodyWidth: body.offsetWidth,
      bodyScrollWidth: body.scrollWidth,
      detailGrid: getStyles(detailGrid),
      detailMain: getStyles(detailMain),
    };
  });

  console.log(JSON.stringify(styles, null, 2));
  
  await browser.close();
}

diagnose().catch(console.error);

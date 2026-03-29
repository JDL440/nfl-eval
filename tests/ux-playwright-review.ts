/**
 * UX Playwright Review - Visual review of dashboard pages
 * 
 * This script opens each dashboard page in both mobile and desktop viewports
 * to identify layout, spacing, and responsive issues.
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3456';
const SCREENSHOT_DIR = 'logs/ux-screenshots';

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile', width: 375, height: 812 }, // iPhone SE/13
  { name: 'tablet', width: 768, height: 1024 }, // iPad
  { name: 'desktop', width: 1280, height: 900 },
];

const PAGES_TO_REVIEW = [
  { path: '/', name: 'Dashboard Home' },
  { path: '/ideas/new', name: 'New Idea Form' },
  { path: '/config', name: 'Settings/Config' },
  { path: '/login', name: 'Login Page' },
];

interface ReviewFinding {
  page: string;
  viewport: string;
  issue: string;
  severity: 'minor' | 'moderate' | 'major';
}

async function reviewPage(
  page: Page,
  pagePath: string,
  pageName: string,
  viewport: ViewportConfig
): Promise<ReviewFinding[]> {
  const findings: ReviewFinding[] = [];

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  
  try {
    await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);
  } catch (e) {
    findings.push({
      page: pageName,
      viewport: viewport.name,
      issue: `Page failed to load: ${e}`,
      severity: 'major',
    });
    return findings;
  }

  // Check for horizontal overflow
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth;
  });
  
  if (hasHorizontalOverflow) {
    findings.push({
      page: pageName,
      viewport: viewport.name,
      issue: 'Horizontal overflow detected - content extends beyond viewport',
      severity: 'major',
    });
  }

  // Check for text that's too small on mobile
  if (viewport.name === 'mobile') {
    const tooSmallText = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, a, button, label, input, select, td, th');
      let count = 0;
      elements.forEach(el => {
        const fontSize = parseFloat(getComputedStyle(el).fontSize);
        if (fontSize < 12) count++;
      });
      return count;
    });

    if (tooSmallText > 5) {
      findings.push({
        page: pageName,
        viewport: viewport.name,
        issue: `${tooSmallText} elements have font-size below 12px - may be hard to read`,
        severity: 'moderate',
      });
    }
  }

  // Check for buttons too close together (tap target issues)
  if (viewport.name === 'mobile') {
    const tooCloseTapTargets = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a.btn, .btn'));
      let issues = 0;
      buttons.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          // Check if the combined interactive area is too small
          if (rect.width < 32 && rect.height < 32) {
            issues++;
          }
        }
      });
      return issues;
    });

    if (tooCloseTapTargets > 0) {
      findings.push({
        page: pageName,
        viewport: viewport.name,
        issue: `${tooCloseTapTargets} buttons/links may have small tap targets`,
        severity: 'minor',
      });
    }
  }

  // Check header nav stacking on mobile
  if (viewport.name === 'mobile') {
    const headerIssues = await page.evaluate(() => {
      const header = document.querySelector('.site-header');
      const nav = document.querySelector('.header-nav');
      const issues: string[] = [];
      
      if (header) {
        const headerRect = header.getBoundingClientRect();
        if (headerRect.height > 150) {
          issues.push('Header is very tall on mobile');
        }
      }
      
      if (nav) {
        const links = nav.querySelectorAll('a');
        const lastLink = links[links.length - 1];
        if (lastLink) {
          const rect = lastLink.getBoundingClientRect();
          if (rect.right > window.innerWidth) {
            issues.push('Nav links overflow horizontally');
          }
        }
      }
      
      return issues;
    });

    headerIssues.forEach(issue => {
      findings.push({
        page: pageName,
        viewport: viewport.name,
        issue,
        severity: 'moderate',
      });
    });
  }

  // Check for content clipping
  const clippedContent = await page.evaluate(() => {
    const containers = document.querySelectorAll('.section, .detail-section, .article-card');
    let clipped = 0;
    containers.forEach(container => {
      const style = getComputedStyle(container);
      if (style.overflow === 'hidden') {
        const el = container as HTMLElement;
        if (el.scrollHeight > el.clientHeight + 10 || el.scrollWidth > el.clientWidth + 10) {
          clipped++;
        }
      }
    });
    return clipped;
  });

  if (clippedContent > 0) {
    findings.push({
      page: pageName,
      viewport: viewport.name,
      issue: `${clippedContent} containers may have clipped content`,
      severity: 'moderate',
    });
  }

  // For Settings page, check grid layout
  if (pagePath === '/config') {
    const settingsGridIssue = await page.evaluate(() => {
      const grid = document.querySelector('.settings-grid');
      if (!grid) return null;
      const gridItems = grid.children;
      if (gridItems.length === 0) return null;
      
      // Check if items are overlapping
      const rects = Array.from(gridItems).map(el => el.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const r1 = rects[i];
          const r2 = rects[j];
          // Check for significant overlap
          const overlap = !(r1.right < r2.left || r2.right < r1.left || 
                          r1.bottom < r2.top || r2.bottom < r1.top);
          if (overlap && Math.abs(r1.top - r2.top) < 10) {
            return 'Grid items may be overlapping';
          }
        }
      }
      return null;
    });

    if (settingsGridIssue) {
      findings.push({
        page: pageName,
        viewport: viewport.name,
        issue: settingsGridIssue,
        severity: 'major',
      });
    }
  }

  return findings;
}

async function getArticleIds(page: Page): Promise<string[]> {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  // Wait for content to render
  await page.waitForTimeout(1000);
  
  const articleIds = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href^="/articles/"]');
    const ids = new Set<string>();
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const match = href.match(/\/articles\/([^/]+)/);
        if (match) ids.add(match[1]);
      }
    });
    return Array.from(ids).slice(0, 3); // First 3 articles for review
  });

  return articleIds;
}

async function captureVisualDetails(page: Page, pagePath: string, viewport: ViewportConfig): Promise<string[]> {
  const details: string[] = [];
  
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  
  try {
    await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);
  } catch {
    return [`Page failed to load at ${pagePath}`];
  }

  // Get key visual metrics
  const metrics = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const header = document.querySelector('.site-header');
    const main = document.querySelector('.content, main');
    const footer = document.querySelector('.site-footer');
    
    // Find elements that are wider than viewport
    const overflowingElements: string[] = [];
    const viewportWidth = window.innerWidth;
    document.querySelectorAll('*').forEach(el => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.right > viewportWidth + 5) {
        const classList = el.className || '(no class)';
        const tag = el.tagName.toLowerCase();
        const info = `${tag}.${classList}: right=${Math.round(rect.right)}px`;
        if (!overflowingElements.includes(info)) {
          overflowingElements.push(info);
        }
      }
    });
    
    const result: Record<string, unknown> = {
      bodyScrollWidth: body.scrollWidth,
      viewportWidth: window.innerWidth,
      horizontalOverflow: body.scrollWidth > window.innerWidth,
      headerHeight: header ? (header as HTMLElement).offsetHeight : 0,
      mainPadding: main ? getComputedStyle(main).padding : 'none',
      overflowingElements: overflowingElements.slice(0, 5), // First 5 overflowing elements
    };

    // Check filter/form elements
    const filterBar = document.querySelector('.filter-bar');
    if (filterBar) {
      result.filterBarOverflow = (filterBar as HTMLElement).scrollWidth > (filterBar as HTMLElement).clientWidth;
    }

    // Check team grid
    const teamGrid = document.querySelector('.team-grid');
    if (teamGrid) {
      result.teamGridOverflow = (teamGrid as HTMLElement).scrollWidth > (teamGrid as HTMLElement).clientWidth;
    }

    // Check settings panels
    const settingsPanels = document.querySelectorAll('.settings-panel');
    if (settingsPanels.length > 0) {
      result.settingsPanelCount = settingsPanels.length;
    }

    // Check tab bar
    const tabBar = document.querySelector('.tab-bar');
    if (tabBar) {
      result.tabBarOverflow = (tabBar as HTMLElement).scrollWidth > (tabBar as HTMLElement).clientWidth;
    }

    return result;
  });

  if (metrics.horizontalOverflow) {
    details.push(`❌ Horizontal overflow: body ${metrics.bodyScrollWidth}px > viewport ${metrics.viewportWidth}px`);
    if (Array.isArray(metrics.overflowingElements) && metrics.overflowingElements.length > 0) {
      details.push(`   Overflowing elements: ${metrics.overflowingElements.join(', ')}`);
    }
  }

  if (viewport.name === 'mobile' && typeof metrics.headerHeight === 'number' && metrics.headerHeight > 120) {
    details.push(`⚠️ Header very tall on mobile: ${metrics.headerHeight}px`);
  }

  if (metrics.filterBarOverflow) {
    details.push(`⚠️ Filter bar overflows - may need horizontal scroll`);
  }

  if (metrics.teamGridOverflow) {
    details.push(`⚠️ Team grid overflows - badges may be clipped`);
  }

  if (metrics.tabBarOverflow) {
    details.push(`ℹ️ Tab bar uses horizontal scroll (acceptable)`);
  }

  return details;
}

async function main() {
  console.log('🎨 UX Playwright Review - Starting...\n');
  
  // Create screenshot directory
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allFindings: ReviewFinding[] = [];
  const visualDetails: Map<string, string[]> = new Map();

  // Get some article IDs for reviewing article-specific pages
  const articleIds = await getArticleIds(page);
  console.log(`Found ${articleIds.length} articles to review\n`);

  // Add article-specific pages
  const dynamicPages = articleIds.flatMap(id => [
    { path: `/articles/${id}`, name: `Article Detail (${id.slice(0, 15)}...)` },
    { path: `/articles/${id}/traces`, name: `Article Traces (${id.slice(0, 15)}...)` },
    { path: `/articles/${id}/preview`, name: `Article Preview (${id.slice(0, 15)}...)` },
  ]);

  const allPages = [...PAGES_TO_REVIEW, ...dynamicPages.slice(0, 6)]; // Limit dynamic pages

  for (const pageConfig of allPages) {
    console.log(`📄 Reviewing: ${pageConfig.name}`);
    
    for (const viewport of VIEWPORTS) {
      console.log(`  - ${viewport.name} (${viewport.width}x${viewport.height})`);
      const findings = await reviewPage(page, pageConfig.path, pageConfig.name, viewport);
      allFindings.push(...findings);
      
      // Also capture visual details
      const details = await captureVisualDetails(page, pageConfig.path, viewport);
      const key = `${pageConfig.name} [${viewport.name}]`;
      if (details.length > 0) {
        visualDetails.set(key, details);
      }
      
      // Take screenshot
      const screenshotName = `${pageConfig.name.replace(/[^a-zA-Z0-9]/g, '-')}-${viewport.name}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName), fullPage: true });
    }
    console.log('');
  }

  await browser.close();
  
  console.log(`📸 Screenshots saved to ${SCREENSHOT_DIR}/\n`);

  // Report findings
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 UX REVIEW FINDINGS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (allFindings.length === 0 && visualDetails.size === 0) {
    console.log('✅ No issues found!\n');
  } else {
    if (allFindings.length > 0) {
      const byPage = new Map<string, ReviewFinding[]>();
      allFindings.forEach(f => {
        if (!byPage.has(f.page)) byPage.set(f.page, []);
        byPage.get(f.page)!.push(f);
      });

      byPage.forEach((findings, pageName) => {
        console.log(`\n🔍 ${pageName}:`);
        findings.forEach(f => {
          const icon = f.severity === 'major' ? '❌' : f.severity === 'moderate' ? '⚠️' : 'ℹ️';
          console.log(`   ${icon} [${f.viewport}] ${f.issue}`);
        });
      });
    }

    if (visualDetails.size > 0) {
      console.log('\n───────────────────────────────────────────────────────────────');
      console.log('VISUAL DETAILS:');
      visualDetails.forEach((details, key) => {
        console.log(`\n  ${key}:`);
        details.forEach(d => console.log(`    ${d}`));
      });
    }

    console.log('\n───────────────────────────────────────────────────────────────');
    console.log(`Total automated findings: ${allFindings.length}`);
    console.log(`  Major: ${allFindings.filter(f => f.severity === 'major').length}`);
    console.log(`  Moderate: ${allFindings.filter(f => f.severity === 'moderate').length}`);
    console.log(`  Minor: ${allFindings.filter(f => f.severity === 'minor').length}`);
  }
}

main().catch(console.error);

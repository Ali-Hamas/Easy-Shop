import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors=[];page.on('pageerror', e=>errors.push(e.message));
await mkdir('docs/screenshots/three-ui',{recursive:true});
const results=[];
for (const width of [1440,1280,1024,768,430,390,375,320]) {
 await page.setViewportSize({width,height:900});await page.goto('http://localhost:3000/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
 results.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 if([1440,390,320].includes(width)) await page.screenshot({path:`docs/screenshots/three-ui/hero-${width}.png`});
 const story=page.locator('#story');await page.evaluate(()=>{const e=document.querySelector('#story');window.scrollTo(0,e.offsetTop+(e.offsetHeight-innerHeight)*.8)});await page.waitForTimeout(500);
 if([1440,390,320].includes(width))await page.screenshot({path:`docs/screenshots/three-ui/story-${width}.png`});
}
console.log(JSON.stringify({results,errors}));await writeFile('docs/screenshots/three-ui/public-check.json',JSON.stringify({results,errors},null,2));await browser.close();

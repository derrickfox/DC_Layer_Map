const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  
  console.log("Clicking topography layer...");
  // Find the label or button containing 'Topography'
  const elements = await page.$x("//div[contains(text(), 'Topography')] | //button[contains(., 'Topography')] | //span[contains(., 'Topography')]");
  if (elements.length > 0) {
    let clickable = elements[0];
    const tag = await page.evaluate(el => el.tagName, clickable);
    if(tag !== 'BUTTON') {
      clickable = await clickable.$x('ancestor::button');
      if(clickable.length > 0) clickable = clickable[0];
      else clickable = elements[0];
    }
    await clickable.click();
    console.log("Clicked.");
    await page.waitForTimeout(3000);
  } else {
    console.log("Could not find Topography button.");
  }
  
  await browser.close();
})();

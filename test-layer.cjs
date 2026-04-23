const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  page.on('request', request => {
    if (request.url().includes('nationalmap.gov')) {
      console.log('REQUEST:', request.url());
    }
  });
  page.on('response', response => {
    if (response.url().includes('nationalmap.gov')) {
      console.log('RESPONSE:', response.status(), response.url());
    }
  });
  
  await page.goto('http://localhost:5173/');
  
  // Wait for React to mount
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Clicking topography layer...");
  const elements = await page.$$("::-p-xpath(//div[contains(text(), 'Topography')] | //button[contains(., 'Topography')] | //span[contains(., 'Topography')])");
  if (elements.length > 0) {
    let clickable = elements[0];
    const tag = await page.evaluate(el => el.tagName, clickable);
    if(tag !== 'BUTTON') {
      const ancestor = await clickable.$$('::-p-xpath(ancestor::button)');
      if(ancestor.length > 0) clickable = ancestor[0];
    }
    await clickable.click();
    console.log("Clicked.");
    await new Promise(r => setTimeout(r, 3000));
  } else {
    console.log("Could not find Topography button.");
  }
  
  await browser.close();
})();

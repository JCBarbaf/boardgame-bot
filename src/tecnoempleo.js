const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');

async function example() {
  const chromeOptions = new chrome.Options();

  chromeOptions.addArguments('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  chromeOptions.addArguments("--disable-search-engine-choice-screen");

  chromeOptions.setUserPreferences({
    profile: {
      default_content_settings: {
        images: 2
      },
      managed_default_content_settings: {
        images: 2
      }
    }
  });

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(chromeOptions).build();

  let url = `https://www.tecnoempleo.com/ofertas-trabajo/?pr=,239,&pagina=1`;
  await driver.get(url);

  let isActive = false;
  let offersUrl = [];

  while (!isActive) {
    await driver.wait(until.elementLocated(By.css('ul.pagination')), 10000)

    let listItems = await driver.findElements(By.css('ul.pagination li'))
    let lastItem = listItems[listItems.length - 1];

    if ((await lastItem.getAttribute('class')).includes('active')) {
      isActive = true;
    } else {

      let items = await driver.findElements(By.css('.fs-5 a'))

      for (let item of items) {
        let offerUrl = await item.getAttribute('href')
        offersUrl.push(offerUrl);
      }


      let link = await lastItem.findElement(By.css('a'))
      const nextPage = await link.getAttribute('href')
      await driver.get(nextPage);
    }
  }

  const offers = []

  for (let offerUrl of offersUrl) {

    await driver.get(offerUrl);

    try {
      await driver.wait(until.elementLocated(By.css('.ml-4')), 1000)
    } catch (error) {
      continue
    }

    const date = await driver.findElement(By.css('.ml-4')).getText()
    const description = await driver.findElement(By.css('p.fs--16')).getText()
    
    const offer = {
      url: offerUrl,
      titulo: await driver.findElement(By.css('h1')).getText(),
      descripcion: description,
      fecha: date.substring(0, 10),
      tecnologias: []
    }

    const ulElement = await driver.findElement(By.css('ul.list-unstyled.mb-0.fs--15'));
    let liElements = await ulElement.findElements(By.css('li:not(.mb-3)'));

    for (let li of liElements) {
      let dataTitle = await li.findElement(By.css('.px-2')).getText()
      dataTitle = toCamelCase(dataTitle)
      const dataDescription = await li.findElement(By.css('.float-end')).getText()

      offer[dataTitle] = dataDescription
    }

    liElements = await ulElement.findElements(By.css('.pl--12 p.m-0'));

    for (let li of liElements) {
      let dataTitle = await li.getText()

      if (dataTitle.includes(':')) {
        const data = dataTitle.split(':')
        offer[toCamelCase(data[0])] = data[1]
      }
    }

    const tagElements = await ulElement.findElements(By.css('li.mb-3 .float-end a'));

    for (let tag of tagElements) {
      let technology = await tag.getText()
      offer.tecnologias.push(technology.toLowerCase())
    }

    offers.push(offer)
  }

  fs.writeFileSync('tecnoempleo.json', JSON.stringify(offers, null, 2));
}

function toCamelCase(str) {
  str = str.toLowerCase();

  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
      if (+match === 0) return ""; 
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

example();
const { Builder, By, until } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')
const { ChromaClient } = require('chromadb')
const fs = require('fs')

async function example() {
  const client = new ChromaClient()
  const chromeOptions = new chrome.Options()

  chromeOptions.addArguments('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
  chromeOptions.addArguments("--disable-search-engine-choice-screen")

  chromeOptions.setUserPreferences({
    profile: {
      default_content_settings: {
        images: 2
      },
      managed_default_content_settings: {
        images: 2
      }
    }
  })

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(chromeOptions).build()

  let url = `https://zacatrus.es/juegos-de-mesa.html?p=1`
  await driver.get(url)

  let isActive = false
  let gamesUrl = []
  while (!isActive) {
    await driver.wait(until.elementLocated(By.css('ul.items.pages-items')), 10000)

    let lastItem = await driver.findElement(By.css('ul.items.pages-items li:last-of-type'))

    if ((await lastItem.getAttribute('class')).includes('pages-item-next')) {
      let items = await driver.findElements(By.css('li.item.product.product-item a.product-item-photo'))

      for (let item of items) {
        let gameUrl = await item.getAttribute('href')
        gamesUrl.push(gameUrl)
      }

      let link = await lastItem.findElement(By.css('a'))
      const nextPage = await link.getAttribute('href')
      await driver.get(nextPage)
    } else {
      isActive = true
      
    }
  }

  let games = []

  for (let gameUrl of gamesUrl) {

    await driver.get(gameUrl)

    try {
      await driver.wait(until.elementLocated(By.css('meta[itemprop="price"]')), 1000)
    } catch (error) {
      continue
    }

    const name = await driver.findElement(By.css('h1 [itemprop="name"]')).getText()
    const price = await driver.findElement(By.css('meta[itemprop="price"]')).getAttribute('content')

    const game = {
      url: gameUrl,
      name: name,
      price: price
    }

    const dataCells = await driver.findElements(By.css('.additional-attributes .tr'))

    for (let cell of dataCells) {
      let dataTitle = await cell.findElement(By.css('.label')).getText()
      dataTitle = toCamelCase(dataTitle)
      const dataValue = await cell.findElement(By.css('.data')).getText()
      game[dataTitle] = dataValue
    }

    games.push(game)
  }

  games = games.reduce((acc, game) => {
    const gameData = {
      url: game.url,
      name: game.name,
      price: game.price,
      numJugadores: game['num.Jugadores'] || null,
      tiempoDeJuego: game.tiempoDeJuego || null,
      mecanica: game.mecanica || null,
      edad: game.edad || null,
      autor: game.autor || null,
      editorial: game.editorial ||null,
      idioma: game.idioma || null
    };
    
    acc.push(gameData);
    return acc;
  }, [])

  let chromadbCollection = null

  try {
    chromadbCollection = await client.getCollection({ name: 'boardgames' })
    await client.deleteCollection(chromadbCollection)
    chromadbCollection = await client.createCollection({ name: 'boardgames' })
  } catch (err) {
    chromadbCollection = await client.createCollection({ name: 'boardgames'})
  }

  const ids = []
  const metadatas = []
  const documents = []

  let i = 1

  games.forEach((game) => {
    ids.push(i.toString())

    const gameElement = {
      id:  i.toString(),
      ...game
    }
    
    metadatas.push(gameElement)

    const document = `${game.name}, ${game.mecanica}, ${game.edad}, ${game.autor}, ${game.editorial}`
    documents.push(document)
    i++
  })

  try {
    await chromadbCollection.add({
      ids,
      metadatas,
      documents
    })
  } catch (err) {
    console.log(err)
  }

  fs.writeFileSync('zacatrus.json', JSON.stringify(games, null, 2))
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
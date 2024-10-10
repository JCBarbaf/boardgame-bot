const { ChromaClient } = require('chromadb')
const fs = require('fs')

async function example() {
  const client = new ChromaClient()
 
  const dataJson = await fs.readFileSync('./zacatrus.json', 'utf-8')
  const games = await JSON.parse(dataJson)

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

  for(let i = 0; i < games.length; i++){

    ids.push(i.toString())

    const gameElement = {
      id: i.toString(),
      ...games[i]
    }
    
    metadatas.push(gameElement)

    let document = [games[i].name, games[i].mecanica, games[i].edad, games[i].autor, games[i].editorial]
    console.log(document.join(',').replace(/,+/g, ',').trim())
    documents.push(document.join(',').replace(/,+/g, ',').trim())
  }

  const batchSize = 100;

  // Dividimos los datos en lotes
  const idBatches = splitIntoBatches(ids, batchSize);
  const metadataBatches = splitIntoBatches(metadatas, batchSize);
  const documentBatches = splitIntoBatches(documents, batchSize);

  // Enviamos cada lote de manera iterativa
  for (let i = 0; i < idBatches.length; i++) {
    try {
      console.log(`Enviando lote ${i + 1} de ${idBatches.length}...`);

      await chromadbCollection.add({
        ids: idBatches[i],
        metadatas: metadataBatches[i],
        documents: documentBatches[i]
      });

      console.log(`Lote ${i + 1} enviado correctamente.`);
    } catch (err) {
      console.log(`Error al enviar el lote ${i + 1}:`, err);
    }
  }
}

function splitIntoBatches(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize);
    batches.push(batch);
  }
  return batches;
}


example();
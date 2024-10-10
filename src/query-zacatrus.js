const { ChromaClient } = require('chromadb')
const chromaClient = new ChromaClient()
const TelegramBot = require('node-telegram-bot-api');
const OpenAIService = require('./services/openai-service')

class Zacatrus {
  constructor() {
    this.prompt = "Busco un juego de cartas para niños de menos de 15 años"
    this.OpenAIService = null;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = new TelegramBot(this.token, { polling: true }); 

    this.bot.onText(/\/busca/, async (msg) => {
      this.chatId = msg.chat.id; 
      const message = msg.text.replace('/busca','')
      await this.search(message);
    })
  }

  async search(message){
    this.OpenAIService = await new OpenAIService()
    const chromadbCollection = await chromaClient.getOrCreateCollection({ name: 'boardgames' })
    this.sendMessage("Estoy consultando la base de datos")

    const object = await this.OpenAIService.extractKeywords(this.prompt)

    const result = await chromadbCollection.query({
      nResults: 10,
      queryTexts: [message]
    })

    const elements = result.documents[0].map((_, i) => {
      const element = {}

      Object.entries(result.metadatas[0][i]).forEach(([key, value]) => {
        element[key] = value
      })

      return element
    })

    const prompt = `${this.prompt} ${JSON.stringify(elements)}`
    const answer = await this.OpenAIService.filterData(prompt)

    this.sendMessage(answer)
  }

  async sendMessage(message) {
    try {
      await this.bot.sendMessage(this.chatId, message)
    } catch (error) {
      console.error('Error al enviar el mensaje:', error)
    }
  }
}

(async () => {
  const query = new Zacatrus();
  setInterval(() => {}, 1000);
})();
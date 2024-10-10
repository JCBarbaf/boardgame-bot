require('dotenv').config()
const { ChromaClient } = require('chromadb')
const chromaClient = new ChromaClient()
const TelegramBot = require('node-telegram-bot-api')
const OpenAIService = require('./services/openai-service')

class Zacatrus {
  constructor() {
    this.OpenAIService = null;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = new TelegramBot(this.token, { polling: true }); 

    this.bot.onText(/\/bot/, async (msg) => {
      this.chatId = msg.chat.id; 
      const message = msg.text.replace('/bot','')
      await this.search(message);
    })
  }

  async search(message){
    this.OpenAIService = await new OpenAIService()
    const chromadbCollection = await chromaClient.getOrCreateCollection({ name: 'boardgames' })
    this.sendMessage("Estoy consultando la base de datos")

    // const result = await chromadbCollection.query({
    //   nResults: 10,
    //   queryTexts: [message]
    // })

    // const elements = result.documents[0].map((_, i) => {
    //   const element = {}

    //   Object.entries(result.metadatas[0][i]).forEach(([key, value]) => {
    //     element[key] = value
    //   })

    //   return element
    // })


    // const prompt = `${this.prompt} ${JSON.stringify(elements)}`
    const prompt = `${message}`
    await this.OpenAIService.createThread()
    await this.OpenAIService.setAssistant(process.env.ASSISTANT_ID)
    await this.OpenAIService.createMessage(prompt)
    await this.OpenAIService.runStatus()

    const tools = await this.OpenAIService.getTools()

    if (tools) {

      const toolsOutputs = []
    
      for (const tool of tools) {
        const data = JSON.parse(tool.function.arguments)
    
        if (tool.function.name === 'recommend_board_game') {

          const count = await chromadbCollection.count()

          const result = await chromadbCollection.query({
            nResults: count,
            queryTexts: ['']
          })


          const names = result.metadatas[0].map((metadata) => metadata.name);
          const prompt = `Recomiendamé juegos parecidos en jugabilidad a ${data.gameName}  que aparezcan en la siguiente lista: ${names.join(',')}`
          
          this.sendMessage("Elaborando la respuesta...")

          const answer = await this.OpenAIService.recommendDataFromtList(prompt)

          const filteredResults = result.metadatas[0].filter(metadata =>
            answer.recommendations.includes(metadata.name)
          );

          const output = {
            answer: filteredResults
          }

          toolsOutputs.push({
            tool_call_id: tool.id,
            output: JSON.stringify(output)
          })
        }
      }
    
      await this.OpenAIService.submitToolOutputs(toolsOutputs)
    }

    const answer = await this.OpenAIService.getAnswer()
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
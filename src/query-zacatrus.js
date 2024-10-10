require('dotenv').config();
const { ChromaClient } = require('chromadb');
const chromaClient = new ChromaClient();
const TelegramBot = require('node-telegram-bot-api');
const OpenAIService = require('./services/openai-service');

class Zacatrus {
  constructor() {
    this.OpenAIService = null;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = new TelegramBot(this.token, { polling: true });

    // Listener de comandos
    this.bot.onText(/\/bot/, async (msg) => {
      const chatId = msg.chat.id;
      const message = msg.text.replace('/bot', '').trim();
      await this.search(message, chatId);
    });
  }

  async search(message, chatId) {
    this.OpenAIService = await new OpenAIService();
    const chromadbCollection = await chromaClient.getOrCreateCollection({ name: 'boardgames' });

    // Enviar mensaje al chat correspondiente
    await this.sendMessage(chatId, "Estoy consultando la base de datos");

    // Descomentar esta parte cuando esté lista la búsqueda en ChromaDB
    // const result = await chromadbCollection.query({
    //   nResults: 10,
    //   queryTexts: [message]
    // });

    const prompt = `${message}`;
    await this.OpenAIService.createThread();
    await this.OpenAIService.setAssistant(process.env.ASSISTANT_ID);
    await this.OpenAIService.createMessage(prompt);
    await this.OpenAIService.runStatus();

    const tools = await this.OpenAIService.getTools();

    if (tools) {
      const toolsOutputs = [];

      for (const tool of tools) {
        const data = JSON.parse(tool.function.arguments);

        if (tool.function.name === 'recommend_board_game') {
          const count = await chromadbCollection.count();

          const result = await chromadbCollection.query({
            nResults: count,
            queryTexts: ['']
          });

          const names = result.metadatas[0].map((metadata) => metadata.name);
          const prompt = `Recomiéndame juegos parecidos en jugabilidad a ${data.gameName} que aparezcan en la siguiente lista: ${names.join(',')}`;

          // Enviar mensaje de progreso al chat correspondiente
          await this.sendMessage(chatId, "Elaborando la respuesta...");

          const answer = await this.OpenAIService.recommendDataFromtList(prompt);

          const filteredResults = result.metadatas[0].filter(metadata =>
            answer.recommendations.includes(metadata.name)
          );

          const output = {
            answer: filteredResults
          };

          toolsOutputs.push({
            tool_call_id: tool.id,
            output: JSON.stringify(output)
          });
        }
      }

      await this.OpenAIService.submitToolOutputs(toolsOutputs);
    }

    const answer = await this.OpenAIService.getAnswer();
    // Enviar la respuesta al chat que corresponda
    await this.sendMessage(chatId, answer);
  }

  async sendMessage(chatId, message) {
    try {
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Error al enviar el mensaje:', error);
    }
  }
}

(async () => {
  const query = new Zacatrus();
  setInterval(() => {}, 1000);
})()
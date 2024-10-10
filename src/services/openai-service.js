const OpenAI = require('openai')
const { zodResponseFormat } = require('openai/helpers/zod')
const { z } = require('zod')

module.exports = class OpenAIService {
  constructor () {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    this.assistantEndpoint = null
    this.threadId = null
    this.messages = null
    this.answer = null
    this.tools = null
  }

  async getAnswer () {
    return this.answer
  }

  async getTools () {
    return this.tools
  }


  async setAssistant (assistantEndpoint) {
    this.assistantEndpoint = assistantEndpoint
  }

  async createThread () {
    try {
      const thread = await this.openai.beta.threads.create()
      this.threadId = thread.id
    } catch (error) {
      console.log(error)
    }
  }

  setThread (theadId) {
    this.threadId = theadId
  }

  async createMessage (prompt) {
    try {
      await this.openai.beta.threads.messages.create(
        this.threadId,
        {
          role: 'user',
          content: prompt
        }
      )

      this.run = await this.openai.beta.threads.runs.createAndPoll(
        this.threadId,
        {
          assistant_id: this.assistantEndpoint
        }
      )
    } catch (error) {
      console.log(error)
    }
  }

  async runStatus () {
    try {
      
      if (this.run.status === 'completed') {
        const messages = await this.openai.beta.threads.messages.list(this.run.thread_id)
        this.messages = messages.data
        this.answer = this.messages[0].content[0].text.value
        return
      }

      if (
        this.run.required_action &&
        this.run.required_action.submit_tool_outputs &&
        this.run.required_action.submit_tool_outputs.tool_calls
      ) {
        this.tools = this.run.required_action.submit_tool_outputs.tool_calls
        return
      }

      if (this.run.status === 'queued' || this.run.status === 'in_progress') {
        await this.sleep(2000)

        this.run = await this.openai.beta.threads.runs.retrieve(
          this.threadId,
          this.run.id
        )

        await this.runStatus()
      }
    } catch (error) {
      console.log(error)
    }
  }

  async submitToolOutputs (toolOutputs) {
    try {
      this.run = await this.openai.beta.threads.runs.submitToolOutputs(
        this.threadId,
        this.run.id,
        { tool_outputs: toolOutputs }
      )

      await this.runStatus()
    } catch (error) {
      console.log(error)
    }
  }

  async analyzeImages (images, prompt) {
    const content = [{ type: 'text', text: `${prompt}` }]

    for (const image of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/webp;base64,${image}`,
          detail: 'high'
        }
      })
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content
        }
      ],
      temperature: 1,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        type: 'text'
      }
    })

    return response.choices[0].message.content
  }

  filterData = async (prompt, data) => {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: `Ante la pregunta del usuario, proporciona una respuesta humana que contenga los elementos que más se acerquen a la búsqueda del usuario y contengan la url de cada elemento. Si no encuentras nada responde "No he encontrado nada".
                Tu respuesta debe contener etiquetas HTML para que sea visualmente atractiva.`
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `El usuario ha preguntado lo siguiente: ${prompt}, y estos son los datos que se han obtenido: ${data}`
              }
            ]
          }
        ],
        temperature: 1,
        max_tokens: 2048,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: {
          type: 'text'
        }
      })

      return response.choices[0].message.content
    } catch (error) {
      console.log(error)
    }
  }

  recommendDataFromtList = async (prompt) => {

    const Recommendation = z.object({
      recommendations: z.array(z.string())
    })

    try {
      const response = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: `Eres un recomendador de productos similares. Devuelve una lista de cinco nombres de productos a partir de la que el usuario te ofrezca. 
                Los nombre que me devuelvas deben estar escritos exactamente igual que como aparecen en la lista que te haya dado el usuario. Elige diversidad, 
                no recomiendes diferentes versiones de un mismo juego, y en la medida de lo posible evita expansiones del mismo juego planteado por el usuario`
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${prompt}`
              }
            ]
          }
        ],
        temperature: 1,
        max_tokens: 16384,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: zodResponseFormat(Recommendation, 'recommendations')
      })

      const recommendations = response.choices[0].message.parsed
      return recommendations

    } catch (error) {
      console.log(error)
    }
  }

  extractKeywords = async (prompt) => {
    try {
      const Keywords = z.object({
        keywords: z.array(z.string())
      })

      const response = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: `Extrae las palabras clave que resuma el texto aportado por el usuario. Elige únicamente aquellas sean relevantes para describir el texto de manera única e identificable.`
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${prompt}`
              }
            ]
          }
        ],
        temperature: 1,
        max_tokens: 2048,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: zodResponseFormat(Keywords, 'keywords')
      })

      const keywords = response.choices[0].message.parsed
      return keywords
    } catch (error) {
      console.log(error)
    }
  }

  extractCode (response) {
    const regex = /```([^```]+)```/g
    const matches = response.match(regex)

    if (matches && matches.length > 0) {
      response = matches[0].replace(/```/g, '')
      return response
    } else {
      return response
    }
  }

  sleep (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
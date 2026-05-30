const Groq = require("groq-sdk")
const { GROQ_API_KEY } = require("./config")
const groq = new Groq({ apiKey: GROQ_API_KEY })
async function test() {
  try {
    const res = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: 'Respond ONLY with valid JSON: { "hello": "world" }',
        },
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
    })
    console.log("Success:", res.choices[0].message.content)
  } catch (err) {
    console.error("Error:", err.message)
  }
}
test()

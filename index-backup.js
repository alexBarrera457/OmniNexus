const OpenAI = require("openai");

const client = new OpenAI({
    baseURL: "http://localhost:20128/v1",
    apiKey: "apiKey: process.env.OMNIROUTE_API_KEY"
});

async function main() {
    const respuesta = await client.chat.completions.create({
        model: "mi-combo",
        messages: [
            {
                role: "user",
                content: "Hola. Responde solamente: Funciona desde Node.js."
            }
        ]
    });

    console.log(respuesta.choices[0].message.content);
}

main();

const OpenAI = require("openai");
const readline = require("readline");

const client = new OpenAI({
    baseURL: process.env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1",
    apiKey: process.env.OMNIROUTE_API_KEY || "omniroute-local"
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const messages = [
    {
        role: "system",
        content: "Eres un asistente útil. Responde en español."
    }
];

function preguntar() {
    rl.question("\nTú: ", async (texto) => {

        if (texto.toLowerCase() === "salir") {
            console.log("Adiós 👋");
            rl.close();
            return;
        }

        messages.push({
            role: "user",
            content: texto
        });

        try {
            const respuesta = await client.chat.completions.create({
                model: process.env.OMNIROUTE_MODEL || "gpt-4.1",
                messages: messages
            });

            const contenido = respuesta.choices[0].message.content;

            console.log("\nIA:", contenido);

            messages.push({
                role: "assistant",
                content: contenido
            });

        } catch (error) {
            console.error("\n❌ Error:", error.message);
        }

        preguntar();
    });
}

console.log("🤖 Chatbot OmniRoute");
console.log("Escribe 'salir' para cerrar.");

preguntar();
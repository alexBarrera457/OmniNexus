const express = require("express");
const OpenAI = require("openai");
const { calculate } = require("./lib/calculator");
const { validateChatRequest } = require("./lib/chat-validation");
const { createDatabase } = require("./lib/database");
const { createConversationRepository } = require("./lib/conversation-repository");
const { createConversationsRouter } = require("./routes/conversations");
const { createMemoryRepository } = require("./lib/memory-repository");
const { createMemoryRouter } = require("./routes/memory");
const { webSearch } = require("./services/web-search");
const { createNexusService } = require("./services/nexus-service");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// The app is intentionally local by default. Set HOST explicitly to expose it.
const HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_MODEL = process.env.OMNIROUTE_MODEL || "gpt-4.1";
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_REQUEST_MESSAGES = 50;
const MEMORY_CAPTURE_ENABLED = process.env.ENABLE_MEMORY === "true";
const requestBuckets = new Map();
const db = createDatabase(process.env.NEXUS_DB_PATH || "./nexus-memory.db");
const {
    createConversation,
    getConversations,
    getConversation,
    getMessages,
    saveMessage,
    updateConversationTitle,
    deleteConversation,
    clearMessages,
    searchConversations
} = createConversationRepository(db);
const { saveMemory, getMemories, deleteAllMemories } = createMemoryRepository(db);

// ============================================================
// 🤖 OMNIROUTE
// ============================================================

const client = new OpenAI({
    baseURL: process.env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1",
    apiKey: process.env.OMNIROUTE_API_KEY || "omniroute-local"
});

// ============================================================
// 💾 DATABASE
// ============================================================

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// 🧠 MEMORIA
// ============================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// ============================================================
// 💬 NEXUS CONVERSATIONS
// ============================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS nexus_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT 'Nueva conversación',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// ============================================================
// 📨 NEXUS MESSAGES
// ============================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS nexus_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (conversation_id)
        REFERENCES nexus_conversations(id)
        ON DELETE CASCADE
    );
`);

// ============================================================
// ⚙️ EXPRESS
// ============================================================

app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();

    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 30;
    const bucket = requestBuckets.get(key) || [];
    const recent = bucket.filter(timestamp => now - timestamp < windowMs);

    if (recent.length >= limit) {
        return res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo en un minuto." });
    }

    recent.push(now);
    requestBuckets.set(key, recent);
    next();
});

const nexus = createNexusService({
    client,
    conversations: { createConversation, getConversations, getConversation, getMessages, saveMessage, updateConversationTitle, deleteConversation, clearMessages, searchConversations },
    memories: { getMemories },
    webSearch,
    calculate,
    captureMemory: MEMORY_CAPTURE_ENABLED ? text => extractMemory(text) : null
});
app.use(express.static("public"));
app.use("/api", createConversationsRouter({
    createConversation,
    getConversations,
    getConversation,
    getMessages,
    deleteConversation,
    clearMessages,
    searchConversations
}));
app.use("/api", createMemoryRouter({ getMemories, deleteAllMemories }));

// ============================================================
// 💬 CREAR CONVERSACIÓN
// ============================================================

function legacyCreateConversation(
    title = "Nueva conversación"
) {

    const result = db.prepare(`
        INSERT INTO nexus_conversations (title)
        VALUES (?)
    `).run(title);

    return Number(result.lastInsertRowid);
}

// ============================================================
// 💬 OBTENER CONVERSACIONES
// ============================================================

function legacyGetConversations() {

    return db.prepare(`
        SELECT
            c.id,
            c.title,
            c.created_at,
            c.updated_at,
            COUNT(m.id) AS message_count

        FROM nexus_conversations c

        LEFT JOIN nexus_messages m
            ON m.conversation_id = c.id

        GROUP BY c.id

        ORDER BY c.updated_at DESC
    `).all();
}

// ============================================================
// 💬 OBTENER UNA CONVERSACIÓN
// ============================================================

function legacyGetConversation(id) {

    return db.prepare(`
        SELECT
            id,
            title,
            created_at,
            updated_at

        FROM nexus_conversations

        WHERE id = ?
    `).get(id);
}

// ============================================================
// 📨 OBTENER MENSAJES
// ============================================================

function legacyGetMessages(conversationId) {

    return db.prepare(`
        SELECT
            id,
            role,
            content,
            created_at

        FROM nexus_messages

        WHERE conversation_id = ?

        ORDER BY id ASC
    `).all(conversationId);
}

// ============================================================
// 📨 GUARDAR MENSAJE
// ============================================================

function legacySaveMessage(
    conversationId,
    role,
    content
) {

    db.prepare(`
        INSERT INTO nexus_messages
        (
            conversation_id,
            role,
            content
        )

        VALUES (?, ?, ?)
    `).run(
        conversationId,
        role,
        content
    );

    db.prepare(`
        UPDATE nexus_conversations

        SET updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
    `).run(conversationId);
}

// ============================================================
// 🏷️ CAMBIAR TÍTULO
// ============================================================

function legacyUpdateConversationTitle(
    conversationId,
    title
) {

    db.prepare(`
        UPDATE nexus_conversations

        SET
            title = ?,
            updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
    `).run(
        title,
        conversationId
    );
}

// ============================================================
// 🗑️ BORRAR CONVERSACIÓN
// ============================================================

function legacyDeleteConversation(
    conversationId
) {

    db.prepare(`
        DELETE FROM nexus_messages
        WHERE conversation_id = ?
    `).run(conversationId);

    db.prepare(`
        DELETE FROM nexus_conversations
        WHERE id = ?
    `).run(conversationId);
}

// ============================================================
// 🔎 BUSCAR CONVERSACIONES
// ============================================================

function legacySearchConversations(query) {

    const search =
        `%${query}%`;

    return db.prepare(`
        SELECT DISTINCT
            c.id,
            c.title,
            c.created_at,
            c.updated_at

        FROM nexus_conversations c

        LEFT JOIN nexus_messages m
            ON m.conversation_id = c.id

        WHERE
            c.title LIKE ?
            OR m.content LIKE ?

        ORDER BY c.updated_at DESC
    `).all(
        search,
        search
    );
}

// ============================================================
// 🧠 GUARDAR MEMORIA
// ============================================================

function legacySaveMemory(content) {

    db.prepare(`
        INSERT INTO memories (content)
        VALUES (?)
    `).run(content);

    console.log(
        `💾 MEMORY SAVED → ${content}`
    );
}

// ============================================================
// 🧠 OBTENER MEMORIAS
// ============================================================

function legacyGetMemories() {

    return db.prepare(`
        SELECT
            id,
            content,
            created_at

        FROM memories

        ORDER BY id DESC

        LIMIT 20
    `).all();
}

// ============================================================
// 🗑️ BORRAR MEMORIA
// ============================================================

function legacyDeleteAllMemories() {

    db.prepare(`
        DELETE FROM memories
    `).run();

    console.log(
        "🗑️ ALL MEMORIES DELETED"
    );
}

// ============================================================
// 🧠 EXTRAER MEMORIA
// ============================================================

async function extractMemory(userText) {

    try {

        const response =
            await client.chat.completions.create({

                model: DEFAULT_MODEL,

                messages: [

                    {
                        role: "system",

                        content: `
Analiza el mensaje del usuario.

Determina si contiene información útil
para recordar en futuras conversaciones.

Puedes guardar:

- proyectos
- estudios
- preferencias
- objetivos
- tecnologías utilizadas
- información relevante sobre sus proyectos

NO guardes:

- contraseñas
- API keys
- datos bancarios
- información extremadamente sensible

Si NO hay nada útil responde exactamente:

NONE

Si hay información útil,
devuelve solamente la memoria.
`
                    },

                    {
                        role: "user",

                        content: userText
                    }

                ]

            });

        const memory =
            response
                .choices?.[0]
                ?.message
                ?.content
                ?.trim();

        if (
            memory &&
            memory !== "NONE" &&
            memory.length < 500
        ) {

            saveMemory(memory);

        }

    }

    catch (error) {

        console.error(
            "⚠️ MEMORY ERROR:",
            error.message
        );

    }
}

// ============================================================
// 🧠 CONSTRUIR CONTEXTO DE MEMORIA
// ============================================================

function buildMemoryContext() {

    const memories =
        getMemories();

    if (
        memories.length === 0
    ) {

        return "No hay recuerdos guardados.";

    }

    return memories
        .map(
            memory =>
                `- ${memory.content}`
        )
        .join("\n");
}

// ============================================================
// 🧮 CALCULADORA
// ============================================================

function calculateSafely(normalized) {
    if (normalized.length > 200) {
        throw new Error("La expresión matemática es demasiado larga.");
    }

    const tokens = normalized.match(/\d+(?:\.\d+)?|[()+\-*/%]/g) || [];
    if (tokens.join("") !== normalized.replace(/\s/g, "")) {
        throw new Error("Expresión matemática no válida.");
    }

    let position = 0;
    const peek = () => tokens[position];
    const consume = () => tokens[position++];
    const factor = () => {
        if (peek() === "+") { consume(); return factor(); }
        if (peek() === "-") { consume(); return -factor(); }
        if (peek() === "(") {
            consume();
            const value = expressionParser();
            if (consume() !== ")") throw new Error("Paréntesis sin cerrar.");
            return value;
        }
        const token = consume();
        if (!token || !/^\d/.test(token)) throw new Error("Expresión matemática no válida.");
        return Number(token);
    };
    const term = () => {
        let value = factor();
        while (["*", "/", "%"].includes(peek())) {
            const operator = consume();
            const right = factor();
            if ((operator === "/" || operator === "%") && right === 0) {
                throw new Error("No se puede dividir entre cero.");
            }
            value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
        }
        return value;
    };
    const expressionParser = () => {
        let value = term();
        while (["+", "-"].includes(peek())) {
            value = consume() === "+" ? value + term() : value - term();
        }
        return value;
    };
    const result = expressionParser();
    if (position !== tokens.length) throw new Error("Expresión matemática no válida.");
    return result;
}

function calculateLegacy(expression) {

    const normalized =
        expression
            .replace(/,/g, ".")
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .trim();

    if (
        !/^[0-9+\-*/%.()\s]+$/.test(
            normalized
        )
    ) {

        throw new Error(
            "Expresión matemática no válida."
        );

    }

    const result = calculateSafely(normalized);

    if (
        typeof result !== "number" ||
        !Number.isFinite(result)
    ) {

        throw new Error(
            "Resultado matemático no válido."
        );

    }

    return result;
}

// ============================================================
// 🕐 HORA
// ============================================================

function getCurrentTime() {

    return new Intl.DateTimeFormat(
        "es-ES",
        {
            timeZone: "Europe/Madrid",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    ).format(new Date());
}

// ============================================================
// 📅 FECHA
// ============================================================

function getCurrentDate() {

    return new Intl.DateTimeFormat(
        "es-ES",
        {
            timeZone: "Europe/Madrid",
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(new Date());
}

// ============================================================
// 🌐 WEB SEARCH
// ============================================================

async function legacyWebSearch(query) {

    const cleanQuery =
        String(query || "")
            .replace(/\s+/g, " ")
            .trim();

    if (!cleanQuery) {
        throw new Error("Consulta WEB vacía.");
    }

    const url =
        `https://puri.li/api/search?q=${encodeURIComponent(cleanQuery)}`;

    console.log(`🌐 WEB SEARCH → ${cleanQuery}`);

    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {

        try {

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    15000
                );

            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

                        headers: {
                            "Accept": "application/json",
                            "User-Agent": "OMNI-NEXUS/6.2"
                        },

                        signal: controller.signal
                    }
                );

            clearTimeout(timeout);

            if (!response.ok) {

                throw new Error(
                    `Web HTTP ${response.status}`
                );

            }

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";

            if (
                !contentType
                    .toLowerCase()
                    .includes("json")
            ) {

                const body =
                    await response.text();

                throw new Error(
                    `El buscador no devolvió JSON (${contentType || "sin content-type"}). ` +
                    `Respuesta: ${body
                        .slice(0, 180)
                        .replace(/\s+/g, " ")}`
                );

            }

            const data =
                await response.json();

            const results =
                Array.isArray(data.results)

                    ? data.results
                        .filter(
                            result =>
                                result &&
                                (
                                    result.title ||
                                    result.url ||
                                    result.description
                                )
                        )
                        .map(
                            result => ({
                                title:
                                    String(
                                        result.title ||
                                        "Sin título"
                                    ),

                                url:
                                    String(
                                        result.url ||
                                        ""
                                    ),

                                description:
                                    String(
                                        result.description ||
                                        ""
                                    )
                            })
                        )

                    : [];

            if (
                results.length === 0
            ) {

                throw new Error(
                    "El buscador devolvió 0 resultados válidos."
                );

            }

            console.log(
                `🌐 WEB → ${results.length} resultados`
            );

            return {
                results,
                total:
                    Number(data.total) ||
                    results.length
            };

        }

        catch (error) {

            lastError =
                error.name === "AbortError"

                    ? new Error(
                        "Timeout del buscador WEB (15s)."
                    )

                    : error;

            console.error(
                `🌐 WEB ATTEMPT ${attempt} ERROR:`,
                lastError.message
            );

            if (
                attempt < 2
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            800
                        )
                );

            }

        }

    }

    throw lastError ||
        new Error(
            "No se pudo conectar con el buscador WEB."
        );
}

// ============================================================
// 🧠 CREAR PLAN
// ============================================================

async function createPlan(userText) {

    const response =
        await client.chat.completions.create({

            model: DEFAULT_MODEL,

            messages: [

                {
                    role: "system",

                    content: `
Eres el router de NEXUS.

Herramientas disponibles:

WEB
CALCULATOR
CLOCK
CHAT

Puedes utilizar varias herramientas.

Ejemplo:

Usuario:
"Busca información sobre Node.js y multiplica
los resultados por 3"

Respuesta:

{
    "tools": ["WEB", "CALCULATOR"],
    "reason": "Primero buscar y después calcular."
}

Otro ejemplo:

Usuario:
"¿Qué hora es?"

Respuesta:

{
    "tools": ["CLOCK"],
    "reason": "La petición necesita la hora actual."
}

Una pregunta normal:

{
    "tools": ["CHAT"],
    "reason": "No necesita herramientas."
}

Devuelve SOLO JSON válido.
`
                },

                {
                    role: "user",
                    content: userText
                }

            ]

        });

    let content =
        response
            .choices?.[0]
            ?.message
            ?.content
            ?.trim();

    if (!content) {

        return {
            tools: ["CHAT"],
            reason: "Fallback"
        };

    }

    content =
        content
            .replace(/^```json/i, "")
            .replace(/^```/i, "")
            .replace(/```$/i, "")
            .trim();

    try {

        const plan =
            JSON.parse(content);

        const allowed = [
            "WEB",
            "CALCULATOR",
            "CLOCK",
            "CHAT"
        ];

        plan.tools =
            Array.isArray(plan.tools)

                ? plan.tools
                    .map(
                        tool =>
                            String(tool)
                                .toUpperCase()
                    )
                    .filter(
                        tool =>
                            allowed.includes(tool)
                    )

                : ["CHAT"];

        if (
            plan.tools.length === 0
        ) {

            plan.tools = ["CHAT"];

        }

        if (
            plan.tools.length > 1
        ) {

            plan.tools =
                plan.tools.filter(
                    tool =>
                        tool !== "CHAT"
                );

        }

        return plan;

    }

    catch {

        return {
            tools: ["CHAT"],
            reason: "Fallback CHAT"
        };

    }
}

// ============================================================
// 🧮 CREAR OPERACIÓN A PARTIR DE WEB
// ============================================================

async function buildCalculationFromContext(
    userText,
    webResults
) {

    const count =
        webResults.length;

    const multiplier =
        userText.match(
            /(?:por|x|×)\s*(\d+(?:[.,]\d+)?)/i
        );

    if (multiplier) {

        return (
            `${count} * ${
                multiplier[1]
                    .replace(",", ".")
            }`
        );

    }

    const response =
        await client.chat.completions.create({

            model: DEFAULT_MODEL,

            messages: [

                {
                    role: "system",

                    content: `
El número de resultados WEB es:

${count}

Convierte la petición del usuario
en una operación matemática.

Devuelve SOLO la operación.
`
                },

                {
                    role: "user",
                    content: userText
                }

            ]

        });

    return response
        .choices?.[0]
        ?.message
        ?.content
        ?.trim()
        .replace(/```/g, "");
}

// ============================================================
// 🧠 EJECUTAR PLAN
// ============================================================

async function executePlan(
    conversationId,
    userText
) {

    const plan =
        await createPlan(userText);

    console.log("");

    console.log(
        "╔══════════════════════════════════════╗"
    );

    console.log(
        "║          🧠 NEXUS PLAN               ║"
    );

    console.log(
        "╚══════════════════════════════════════╝"
    );

    console.log(
        `🛠️ Tools → ${plan.tools.join(" → ")}`
    );

    console.log(
        `💡 ${plan.reason || "Sin explicación"}`
    );

    const context = [];

    let webResults = [];

// ============================================================
// 🕐 CLOCK
// ============================================================

    if (
        plan.tools.includes("CLOCK")
    ) {

        const date =
            getCurrentDate();

        const time =
            getCurrentTime();

        context.push({

            tool: "CLOCK",

            data:
                `Fecha: ${date}\n` +
                `Hora: ${time}`

        });

        console.log(
            `🕐 CLOCK → ${date} ${time}`
        );

    }

// ============================================================
// 🌐 WEB
// ============================================================

    if (
        plan.tools.includes("WEB")
    ) {

        try {

            const web =
                await webSearch(userText);

            webResults =
                web.results;

            context.push({

                tool: "WEB",

                data:
                    `Resultados encontrados: ${webResults.length}\n\n` +

                    webResults
                        .slice(0, 10)
                        .map(
                            (result, index) =>
                                `FUENTE ${index + 1}\n` +
                                `Título: ${result.title || ""}\n` +
                                `URL: ${result.url || ""}\n` +
                                `Descripción: ${
                                    result.description || ""
                                }`
                        )
                        .join("\n\n")

            });

        }

        catch (error) {

            console.error(
                "🌐 WEB ERROR:",
                error.message
            );

            context.push({

                tool: "WEB",

                data:
                    `Error: ${error.message}`

            });

        }

    }


// ============================================================
// 🧮 CALCULATOR
// ============================================================

    if (
        plan.tools.includes("CALCULATOR")
    ) {

        try {

            let expression = null;


            if (
                plan.tools.includes("WEB") &&
                webResults.length > 0
            ) {

                expression =
                    await buildCalculationFromContext(
                        userText,
                        webResults
                    );

            }

            else {

                const match =
                    userText.match(
                        /(?:\d+(?:[.,]\d+)?\s*[+\-*/%×÷]\s*)+\d+(?:[.,]\d+)?/
                    );


                if (match) {

                    expression =
                        match[0];

                }

            }


            if (!expression) {

                throw new Error(
                    "No se encontró una operación."
                );

            }


            const result =
                calculate(expression);


            context.push({

                tool: "CALCULATOR",

                data:
                    `Expresión: ${expression}\n` +
                    `Resultado: ${result}`

            });


            console.log(
                `🧮 CALCULATOR → ${expression} = ${result}`
            );

        }

        catch (error) {

            console.error(
                "🧮 CALCULATOR ERROR:",
                error.message
            );


            context.push({

                tool: "CALCULATOR",

                data:
                    `Error: ${error.message}`

            });

        }

    }


// ============================================================
// 🧠 MEMORIA
// ============================================================

    const memoryContext =
        buildMemoryContext();


// ============================================================
// 💬 HISTORIAL
// ============================================================

    const conversationMessages =
        getMessages(
            conversationId
        );


    const conversationContext =
        conversationMessages
            .slice(-20)
            .map(
                message =>
                    `${message.role}: ${message.content}`
            )
            .join("\n");


    const toolContext =
        context.length > 0

            ? context
                .map(
                    item =>
                        `===== ${item.tool} =====\n${item.data}`
                )
                .join("\n\n")

            : "No se utilizaron herramientas.";


// ============================================================
// 🤖 RESPUESTA FINAL
// ============================================================

    const finalMessages = [

        {
            role: "system",

            content: `
Eres NEXUS, un asistente inteligente.

MEMORIA DEL USUARIO:

${memoryContext}

HISTORIAL DE LA CONVERSACIÓN:

${conversationContext}

RESULTADOS DE HERRAMIENTAS:

${toolContext}

REGLAS:

- Responde en español.
- Sé natural.
- No inventes resultados.
- Si una herramienta proporciona un dato,
  utiliza ese dato.
- Si WEB proporciona resultados, utilízalos como fuente principal de información.
- Cuando la pregunta sea sobre novedades, actualidad o información reciente,
  basa la respuesta en los resultados WEB recibidos y no en recuerdos generales.
- No digas que no puedes consultar Internet si WEB ha devuelto resultados.
- No inventes hechos que no aparezcan en los resultados WEB o que no puedas deducir claramente de ellos.
- Si los resultados no contienen información suficiente para responder, dilo claramente.
- Cuando uses WEB, incluye al final una sección breve llamada "Fuentes" con las URLs de los resultados que hayas utilizado.
- Si CALCULATOR proporciona un resultado, respeta exactamente el resultado.
- Si CLOCK proporciona la hora, utiliza esa hora.
`
        },

        {
            role: "user",
            content: userText
        }

    ];


    const response =
        await client.chat.completions.create({

            model: DEFAULT_MODEL,

            messages: finalMessages

        });


    const answer =
        response
            .choices?.[0]
            ?.message
            ?.content
            ?.trim();


    if (!answer) {

        throw new Error(
            "La IA no devolvió contenido."
        );

    }


// ============================================================
// 💾 GUARDAR USUARIO
// ============================================================

    saveMessage(
        conversationId,
        "user",
        userText
    );


// ============================================================
// 💾 GUARDAR NEXUS
// ============================================================

    saveMessage(
        conversationId,
        "assistant",
        answer
    );


// ============================================================
// 🏷️ TÍTULO AUTOMÁTICO
// ============================================================

    const conversation =
        getConversation(
            conversationId
        );


    if (
        conversation &&
        conversation.title ===
            "Nueva conversación"
    ) {

        let title =
            userText
                .replace(/\s+/g, " ")
                .trim();


        if (
            title.length > 45
        ) {

            title =
                title.substring(0, 45) +
                "...";

        }


        if (!title) {

            title =
                "Nueva conversación";

        }


        updateConversationTitle(
            conversationId,
            title
        );

    }


// ============================================================
// 🧠 EXTRAER MEMORIA
// ============================================================

    // Capturing personal data is opt-in because extraction is model-driven.
    if (MEMORY_CAPTURE_ENABLED) {
        await extractMemory(userText);
    }


    console.log(
        `✅ NEXUS → ${plan.tools.join(" → ")}`
    );


    console.log(
        "══════════════════════════════════════"
    );


    return {

        respuesta: answer,

        tools: plan.tools,

        conversationId,

        memory:
            getMemories()

    };

}


// ============================================================
// 💬 API — CREAR CONVERSACIÓN
// ============================================================

app.post(
    "/api/conversations",
    (req, res) => {

        try {

            const title =
                req.body?.title ||
                "Nueva conversación";


            const id =
                createConversation(title);


            res.json({

                ok: true,

                conversation:
                    getConversation(id)

            });

        }

        catch (error) {

            console.error(
                "CREATE CONVERSATION ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo crear la conversación."

            });

        }

    }
);


// ============================================================
// 💬 API — LISTAR CONVERSACIONES
// ============================================================

app.get(
    "/api/conversations",
    (req, res) => {

        try {

            res.json({

                conversations:
                    getConversations()

            });

        }

        catch (error) {

            console.error(
                "GET CONVERSATIONS ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudieron obtener las conversaciones."

            });

        }

    }
);


// ============================================================
// 💬 API — OBTENER CONVERSACIÓN
// ============================================================

app.get(
    "/api/conversations/:id",
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id)
            ) {

                return res.status(400).json({

                    error:
                        "ID inválido."

                });

            }


            const conversation =
                getConversation(id);


            if (!conversation) {

                return res.status(404).json({

                    error:
                        "Conversación no encontrada."

                });

            }


            res.json({

                conversation,

                messages:
                    getMessages(id)

            });

        }

        catch (error) {

            console.error(
                "GET CONVERSATION ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo cargar la conversación."

            });

        }

    }
);


// ============================================================
// 🗑️ API — ELIMINAR CONVERSACIÓN
// ============================================================

app.delete(
    "/api/conversations/:id",
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id)
            ) {

                return res.status(400).json({

                    error:
                        "ID inválido."

                });

            }


            const conversation =
                getConversation(id);


            if (!conversation) {

                return res.status(404).json({

                    error:
                        "Conversación no encontrada."

                });

            }


            deleteConversation(id);


            res.json({

                ok: true,

                message:
                    "Conversación eliminada."

            });

        }

        catch (error) {

            console.error(
                "DELETE CONVERSATION ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo eliminar la conversación."

            });

        }

    }
);


// ============================================================
// 🔎 API — BUSCAR CONVERSACIONES
// ============================================================

app.get(
    "/api/conversations/search/:query",
    (req, res) => {

        try {

            const query =
                req.params.query || "";


            res.json({

                conversations:
                    searchConversations(query)

            });

        }

        catch (error) {

            console.error(
                "SEARCH ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "Error buscando conversaciones."

            });

        }

    }
);


// ============================================================
// 🤖 API — CHAT
// ============================================================

app.delete(
    "/api/conversations/:id/messages",
    (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "ID inválido." });
        }
        if (!getConversation(id)) {
            return res.status(404).json({ error: "Conversación no encontrada." });
        }

        clearMessages(id);
        res.json({ ok: true });
    }
);

app.post(
    "/api/chat",
    async (req, res) => {

        try {

            const {
                messages,
                conversationId
            } = req.body;

            const requestValidation = validateChatRequest(messages);
            if (!requestValidation.ok) {
                return res.status(requestValidation.status).json({
                    error: requestValidation.error
                });
            }


            if (
                !Array.isArray(messages) ||
                messages.length === 0 ||
                messages.length > MAX_REQUEST_MESSAGES
            ) {

                return res.status(400).json({

                    error:
                        "No se recibieron mensajes."

                });

            }


            const lastMessage =
                messages[
                    messages.length - 1
                ];


            const userText =
                String(
                    lastMessage?.content || ""
                ).trim();


            if (lastMessage?.role !== "user" || !userText) {

                return res.status(400).json({

                    error:
                        "Mensaje vacío."

                });

            }

            if (userText.length > MAX_MESSAGE_LENGTH) {
                return res.status(413).json({
                    error: `El mensaje supera el límite de ${MAX_MESSAGE_LENGTH} caracteres.`
                });
            }


// ------------------------------------------------------------
// Crear conversación si no existe ID
// ------------------------------------------------------------

            let activeConversationId =
                Number(conversationId);


            if (
                !Number.isInteger(
                    activeConversationId
                ) ||
                activeConversationId <= 0
            ) {

                activeConversationId =
                    createConversation();

            }


// ------------------------------------------------------------
// Comprobar conversación
// ------------------------------------------------------------

            if (
                !getConversation(
                    activeConversationId
                )
            ) {

                return res.status(404).json({

                    error:
                        "La conversación no existe."

                });

            }


            console.log("");

            console.log(
                "══════════════════════════════════════"
            );

            console.log(
                `💬 CHAT → ${activeConversationId}`
            );

            console.log(
                `👤 USER → ${userText}`
            );


            const result =
                await nexus.execute(
                    activeConversationId,
                    userText
                );


            res.json(result);

        }

        catch (error) {

            console.error("");

            console.error(
                "💥 NEXUS ERROR:",
                error
            );

            console.error("");


            res.status(500).json({

                error:
                    error.message ||
                    "Error interno del servidor."

            });

        }

    }
);


// ============================================================
// 🧠 API — MEMORIA
// ============================================================

app.get(
    "/api/memory",
    (req, res) => {

        try {

            res.json({

                memories:
                    getMemories()

            });

        }

        catch (error) {

            console.error(
                "MEMORY GET ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo obtener la memoria."

            });

        }

    }
);


// ============================================================
// 🗑️ API — BORRAR MEMORIA
// ============================================================

app.delete(
    "/api/memory",
    (req, res) => {

        try {

            deleteAllMemories();


            res.json({

                ok: true,

                message:
                    "Memoria eliminada."

            });

        }

        catch (error) {

            console.error(
                "MEMORY DELETE ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo eliminar la memoria."

            });

        }

    }
);


// ============================================================
// ❤️ HEALTH CHECK
// ============================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            ok: true,

            name:
                "OMNI // NEXUS",

            version:
                "6.2",

            status:
                "online",

            tools: [
                "WEB",
                "CALCULATOR",
                "CLOCK",
                "CHAT"
            ],

            memory:
                MEMORY_CAPTURE_ENABLED,

            conversations:
                true

        });

    }
);

module.exports = app;

// ============================================================
// 🚀 START SERVER
// ============================================================

if (require.main === module) {
    app.listen(
        PORT,
        HOST,
        () => {

            console.log("");

            console.log(
                "╔══════════════════════════════════════════╗"
            );

            console.log(
                "║          🤖 OMNI // NEXUS               ║"
            );

            console.log(
                "║                                          ║"
            );

            console.log(
                "║  🚀 http://localhost:3000               ║"
            );

            console.log(
                "║                                          ║"
            );

            console.log(
                "║  🧠 AI                                   ║"
            );

            console.log(
                "║  💾 MEMORY                               ║"
            );

            console.log(
                "║  💬 CONVERSATIONS                        ║"
            );

            console.log(
                "║  🌐 WEB                                  ║"
            );

            console.log(
                "║  🧮 CALCULATOR                           ║"
            );

            console.log(
                "║  🕐 CLOCK                                ║"
            );

            console.log(
                "║  🔎 SEARCH                               ║"
            );

            console.log(
                "║                                          ║"
            );

            console.log(
                "║  ⚡ NEXUS 6.2                            ║"
            );

            console.log(
                "╚══════════════════════════════════════════╝"
            );

            console.log("");

        }
    );
}

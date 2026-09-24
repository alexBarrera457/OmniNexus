"use strict";

function localMockPlan(userText) {
  const lower = userText.toLowerCase();
  const hasMath = /(?=[^]*[+\-*/%×÷])[()\d][()\d.,\s+\-*/%×÷]*/.test(userText);
  if (
    lower.includes("hora") ||
    lower.includes("fecha") ||
    lower.includes("dia") ||
    lower.includes("día") ||
    lower.includes("tiempo")
  ) {
    return { tools: ["CLOCK"], reason: "Local router detectó consulta temporal" };
  }
  if (
    hasMath &&
    (lower.includes("calcul") ||
      lower.includes("cuanto") ||
      lower.includes("cuánto") ||
      /[=+\-*/%×÷]/.test(userText))
  ) {
    return { tools: ["CALCULATOR"], reason: "Local router detectó cálculo matemático" };
  }
  if (
    lower.includes("buscar") ||
    lower.includes("busca") ||
    lower.includes("google") ||
    lower.includes("noticias")
  ) {
    return { tools: ["WEB"], reason: "Local router detectó búsqueda web" };
  }
  return { tools: ["CHAT"], reason: "Respuesta conversacional directa" };
}

function generateLocalMockAnswer(userText, route, context) {
  if (route.tools.includes("CALCULATOR")) {
    const calcResult = context.find((c) => c.startsWith("CALCULATOR:\nResultado:"));
    if (calcResult) {
      const res = calcResult.replace("CALCULATOR:\nResultado: ", "");
      return `[Demo Local ✦] El resultado de la operación matemática es: **${res}**.`;
    }
  }
  if (route.tools.includes("CLOCK")) {
    const clockResult = context.find((c) => c.startsWith("CLOCK:\n"));
    if (clockResult) {
      const timeStr = clockResult.replace("CLOCK:\n", "");
      return `[Demo Local ✦] La fecha y hora actual del sistema es:\n📅 **${timeStr}**.`;
    }
  }
  if (route.tools.includes("WEB")) {
    const webResult = context.find((c) => c.startsWith("WEB:\n"));
    if (webResult) {
      return `[Demo Local ✦] Resultados encontrados para "${userText}":\n\n${webResult.replace("WEB:\n", "")}`;
    }
    return `[Demo Local ✦] Has solicitado una búsqueda para *"${userText}"*. En modo demo local la búsqueda web simulada está activa.`;
  }

  const lower = userText.toLowerCase();
  if (
    lower.includes("hola") ||
    lower.includes("buenas") ||
    lower.includes("saludos") ||
    lower.includes("hey")
  ) {
    return `[Demo Local ✦] ¡Hola! Soy **OMNI // NEXUS v6.2**, tu asistente de inteligencia local ejecutándose en **Modo Demo**.\n\nPuedes probar:\n- Operaciones matemáticas (ej: \`(45 + 15) * 3\`)\n- Preguntarme la hora o el día actual\n- Guardar recuerdos o chatear para verificar la persistencia en SQLite y la barra lateral.\n\nPara activar respuestas con un modelo generativo completo, puedes configurar tu API key en el archivo \`.env\`.`;
  }
  if (
    lower.includes("quien eres") ||
    lower.includes("quién eres") ||
    lower.includes("que eres") ||
    lower.includes("qué eres")
  ) {
    return `[Demo Local ✦] Soy **NEXUS**, una capa de inteligencia local diseñada para coordinar herramientas (calculadora, reloj, web y memoria) sobre una base de datos SQLite y una interfaz web moderna en Astro.`;
  }
  if (
    lower.includes("recuerda") ||
    lower.includes("mi nombre es") ||
    lower.includes("me llamo") ||
    lower.includes("guardo")
  ) {
    return `[Demo Local ✦] He registrado la información en el contexto local. Tus mensajes se han guardado en la base de datos SQLite.`;
  }

  return `[Demo Local ✦] He recibido tu mensaje: *"${userText}"*.\n\nEl sistema lo ha procesado mediante la herramienta **${route.tools.join(", ")}** y lo ha almacenado correctamente en la conversación activa.`;
}

function createNexusService({
  client,
  conversations,
  memories,
  webSearch,
  calculate,
  captureMemory,
  model = process.env.OMNIROUTE_MODEL || "gpt-4.1",
  demoMode = false,
}) {
  const allowedTools = new Set(["WEB", "CALCULATOR", "CLOCK", "CHAT"]);

  async function plan(userText) {
    if (demoMode) {
      return localMockPlan(userText);
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            'Eres el router de NEXUS. Herramientas: WEB, CALCULATOR, CLOCK, CHAT. Devuelve SOLO JSON: {"tools":[...],"reason":"..."}.',
        },
        { role: "user", content: userText },
      ],
    });
    try {
      const raw = response.choices?.[0]?.message?.content?.replace(/```json|```/gi, "").trim();
      const parsed = JSON.parse(raw);
      let tools = Array.isArray(parsed.tools)
        ? parsed.tools
            .map((tool) => String(tool).toUpperCase())
            .filter((tool) => allowedTools.has(tool))
        : [];
      if (!tools.length) tools = ["CHAT"];
      if (tools.length > 1) tools = tools.filter((tool) => tool !== "CHAT");
      return { tools, reason: String(parsed.reason || "") };
    } catch {
      return { tools: ["CHAT"], reason: "Fallback" };
    }
  }

  const currentDateTime = () =>
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      dateStyle: "full",
      timeStyle: "medium",
    }).format(new Date());

  async function execute(conversationId, userText) {
    const route = demoMode ? localMockPlan(userText) : await plan(userText);
    const context = [];
    if (route.tools.includes("CLOCK")) context.push(`CLOCK:\n${currentDateTime()}`);
    if (route.tools.includes("WEB")) {
      try {
        const web = await webSearch(userText);
        context.push(
          `WEB:\n${web.results
            .slice(0, 10)
            .map(
              (result) =>
                `Título: ${result.title}\nURL: ${result.url}\nDescripción: ${result.description}`
            )
            .join("\n\n")}`
        );
      } catch (error) {
        context.push(`WEB ERROR: ${error.message}`);
      }
    }
    if (route.tools.includes("CALCULATOR")) {
      try {
        const expression = userText
          .match(/(?=[^]*[+\-*/%×÷])[()\d][()\d.,\s+\-*/%×÷]*/)?.[0]
          ?.trim();
        if (!expression) throw new Error("No se encontró una operación.");
        context.push(`CALCULATOR:\nResultado: ${calculate(expression)}`);
      } catch (error) {
        context.push(`CALCULATOR ERROR: ${error.message}`);
      }
    }

    let answer;
    if (demoMode) {
      answer = generateLocalMockAnswer(userText, route, context);
    } else {
      const history = conversations
        .getMessages(conversationId)
        .slice(-20)
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n");
      const memory =
        memories
          .getMemories()
          .map((item) => `- ${item.content}`)
          .join("\n") || "No hay recuerdos guardados.";
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `Eres NEXUS y respondes en español. MEMORIA:\n${memory}\nHISTORIAL:\n${history}\nHERRAMIENTAS:\n${context.join("\n\n") || "Sin herramientas"}\nNo inventes resultados.`,
          },
          { role: "user", content: userText },
        ],
      });
      answer = response.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error("La IA no devolvió contenido.");
    }

    conversations.saveMessage(conversationId, "user", userText);
    conversations.saveMessage(conversationId, "assistant", answer);
    const conversation = conversations.getConversation(conversationId);
    if (conversation?.title?.startsWith("Nueva conversaci"))
      conversations.updateConversationTitle(
        conversationId,
        userText.replace(/\s+/g, " ").trim().slice(0, 45) || "Nueva conversación"
      );
    if (captureMemory) await captureMemory(userText);
    return {
      respuesta: answer,
      tools: route.tools,
      conversationId,
      memory: memories.getMemories(),
    };
  }

  return { plan, execute };
}

module.exports = { createNexusService };

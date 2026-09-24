"use strict";

function createNexusService({
  client,
  conversations,
  memories,
  webSearch,
  calculate,
  captureMemory,
  model = process.env.OMNIROUTE_MODEL || "gpt-4.1",
}) {
  const allowedTools = new Set(["WEB", "CALCULATOR", "CLOCK", "CHAT"]);

  async function plan(userText) {
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
    const route = await plan(userText);
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
    const answer = response.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("La IA no devolvió contenido.");
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

# OMNI // NEXUS

Aplicación local de chat inteligente con interfaz web, almacenamiento de conversaciones, memoria opcional, búsqueda web, calculadora y routing de herramientas para un backend compatible con OmniRoute/OpenAI.

Este repositorio está pensado como una base funcional para continuar iterando, depurando y ampliando sin perder contexto. Cualquier IA o desarrollador que entre al proyecto puede entender en pocas páginas qué está funcionando, qué está pendiente y qué necesita para arrancar de nuevo.

---

## Estado actual del proyecto

### Lo que va bien

- La app web sirve correctamente en `http://127.0.0.1:3000`.
- El servidor Express se inicia y responde en el endpoint de salud.
- La API REST existe y está estructurada.
- La base de datos local funciona con SQLite y tiene repositorios para conversaciones y memoria.
- La lógica de cálculo local está testeada.
- La validación de peticiones del chat está funcionando.
- La interfaz web carga y presenta el flujo básico de conversaciones.
- La suite de pruebas automatizadas pasa.

### Lo que falla o está bloqueado

- El chat real no funciona si el proveedor de IA no tiene credenciales activas.
- El error verificado en ejecución es:

```text
401 No active credentials for provider: openai.
```

Esto no es un fallo de la interfaz ni del Express, sino de autentificación del proveedor externo. El backend no tiene una sesión válida del modelo activo.

### Qué significa esto

El proyecto está listo desde el punto de vista de estructura, API y UI, pero depende de un backend externo auténtico y operativo. Si ese proveedor no está activo, el chat no podrá responder.

---

## Objetivo del proyecto

OMNI // NEXUS quiere ser una interfaz local para:

- chatear con un agente inteligente
- guardar conversaciones en SQLite
- listar, buscar y borrar conversaciones
- responder con herramientas como:
  - WEB
  - CALCULATOR
  - CLOCK
  - CHAT
- habilitar memoria opcional de usuario
- ofrecer una UI web ligera y usable

La idea principal es tener un sistema más parecido a un “panel local de agente IA” que a un backend puro.

---

## Arquitectura general

### Frontend

La interfaz se encuentra en `public/index.html`.

Incluye:

- sidebar con conversaciones
- mensajes de usuario y assistant
- edición y borrado de conversaciones
- teclado rápido
- búsqueda local
- exportación JSON
- UI con estado en vivo

### Backend

El servidor principal es `server.js`.

Hace varias cosas:

- crea la app Express
- monta rutas para chat, conversaciones y memoria
- crea la base de datos SQLite
- inicia el cliente OpenAI/OmniRoute
- prepara el router de herramienta NEXUS
- ejecuta la lógica de planificación del agente

### Servicios

En `services/` se centraliza la lógica especial:

- `nexus-service.js`: orquesta la ejecución de la petición del usuario y persiste mensajes
- `web-search.js`: realiza consultas web con validación de JSON

### Repositorios y almacenamiento

En `lib/` están los repositorios:

- `database.js`: crea la base de datos y esquema
- `conversation-repository.js`: conversaciones y mensajes
- `memory-repository.js`: memorias del usuario
- `chat-validation.js`: validación del payload del chat
- `calculator.js`: calculadora segura y funcional

### Rutas HTTP

En `routes/` se exponen los endpoints de conversaciones y memoria:

- `routes/conversations.js`
- `routes/memory.js`

---

## Estructura del repo

```text
.
├── .env.example
├── .gitignore
├── README.md
├── index.js
├── index-backup.js
├── package.json
├── server.js
├── fix-db.js
├── lib/
│   ├── calculator.js
│   ├── chat-validation.js
│   ├── conversation-repository.js
│   ├── database.js
│   └── memory-repository.js
├── public/
│   └── index.html
├── routes/
│   ├── conversations.js
│   └── memory.js
├── services/
│   ├── nexus-service.js
│   └── web-search.js
├── test/
│   ├── calculator.test.js
│   ├── chat-validation.test.js
│   ├── conversation-repository.test.js
│   ├── memory-repository.test.js
│   ├── nexus-service.test.js
│   ├── server.test.js
│   └── web-search.test.js
└── node_modules/   (no se sube a GitHub)
```

---

## Cómo arrancar el proyecto

### 1) Instalar dependencias

```bash
npm install
```

### 2) Crear el archivo `.env`

Copia la plantilla:

```bash
cp .env.example .env
```

Contenido típico:

```env
OMNIROUTE_API_KEY=tu_clave_omniroute
OMNIROUTE_BASE_URL=http://localhost:20128/v1
OMNIROUTE_MODEL=gpt-4.1
PORT=3000
HOST=127.0.0.1
ENABLE_MEMORY=false
NEXUS_DB_PATH=./nexus-memory.db
```

### 3) Iniciar el backend

```bash
npm start
```

### 4) Abrir la web

```text
http://127.0.0.1:3000
```

### 5) Probar la API

```bash
curl -X POST http://127.0.0.1:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hola"}]}'
```

---

## Variables de entorno

### `OMNIROUTE_API_KEY`

Clave válida del proveedor de IA. Esta es la más importante. Si no es válida o no está activa, la app responderá 401.

### `OMNIROUTE_BASE_URL`

URL base del backend compatible con OpenAI. Para OmniRoute local suele ser:

```text
http://localhost:20128/v1
```

### `OMNIROUTE_MODEL`

Modelo disponible en tu backend. Un valor típico para OmniRoute/OpenAI-compatible es:

```text
gpt-4.1
```

### `PORT`

Puerto HTTP del servidor local. Por defecto:

```text
3000
```

### `HOST`

Host de bind del servidor. Por defecto:

```text
127.0.0.1
```

### `ENABLE_MEMORY`

Activa captura opcional de recuerdos del usuario.

```env
ENABLE_MEMORY=false
```

### `NEXUS_DB_PATH`

Ruta de la base de datos SQLite local.

```env
NEXUS_DB_PATH=./nexus-memory.db
```

---

## API REST

### Health

```http
GET /api/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "name": "OMNI // NEXUS",
  "version": "6.2",
  "status": "online",
  "tools": ["WEB", "CALCULATOR", "CLOCK", "CHAT"],
  "memory": false,
  "conversations": true
}
```

### Chat

```http
POST /api/chat
```

Body esperado:

```json
{
  "messages": [
    { "role": "user", "content": "hola" }
  ],
  "conversationId": 1
}
```

Respuesta esperada:

```json
{
  "respuesta": "...",
  "tools": ["CHAT"],
  "conversationId": 1,
  "memory": []
}
```

### Conversaciones

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `DELETE /api/conversations/:id`
- `GET /api/conversations/search/:query`
- `DELETE /api/conversations/:id/messages`

### Memoria

- `GET /api/memory`
- `DELETE /api/memory`

---

## Flujo de ejecución interna

1. El usuario manda un mensaje desde la web o desde la API.
2. El backend valida la petición con `chat-validation.js`.
3. Se crea o reutiliza la conversación activa.
4. El servicio `createNexusService` decide qué herramientas usar.
5. Si aplica:
   - Web search, calculadora, reloj o respuesta directa.
6. Se construye el contexto del historial y la memoria.
7. Se llama al proveedor de IA con el prompt final.
8. La respuesta se guarda en la base de datos y se devuelve al cliente.

---

## Base de datos

El proyecto usa SQLite con `better-sqlite3`.

Tablas principales:

- `memories`
- `nexus_conversations`
- `nexus_messages`

La base de datos se crea automáticamente al arrancar el proyecto si no existe.

---

## Qué está ya funcionando

### Verificado

- validación de entrada del chat
- cálculo matemático
- repositorio de conversaciones
- repositorio de memoria
- web search con validación de JSON
- servicio NEXUS con guardado persistente
- servidor Express arrancando correctamente
- UI web cargando
- suite de tests ejecutándose con éxito

### Estado de test

Se ha verificado que la suite funciona con Node Test:

```bash
npm test
```

Resultado verificado en el proyecto:

- 11 tests
- 11 aprobados
- 0 fallidos

---

## Qué falta o habría que mejorar

### Prioridad alta

- Validar la autenticación real del proveedor externo antes de cada arranque.
- Añadir un sistema de fallback si el modelo no está disponible.
- Mejorar los mensajes de error del backend para que digan claramente si falla la IA, la URL o la credencial.
- Añadir logs más estructurados para debugging.

### Prioridad media

- Soportar más modelos y proveedores dinámicos.
- Añadir contenido de salud del proveedor (endpoint, modelo, latencia).
- Mejorar la gestión de memoria con semántica y limpieza automática.
- Añadir rate limiting más configurables por usuario.

### Prioridad baja

- Mejorar la UX de la interfaz web.
- Añadir exportación CSV o markdown.
- Añadir modo oscuro/claro configurable.
- Añadir panel de diagnóstico de sistema.

---

## Problemas conocidos

### 1) 401 de credenciales del proveedor

Este es el bloqueo real actual.

Síntoma:

```text
401 No active credentials for provider: openai.
```

Causa:

- la clave no es válida
- el modelo no está disponible
- la URL no es la correcta
- la sesión no está activa en el backend

Solución:

- comprobar en el provider local que la sesión está activa
- comprobar que la clave coincide con ese endpoint
- comprobar que el modelo existe en ese entorno

### 2) Dependencia de un backend externo

La app no puede funcionar sin un modelo activo. Tiene un fuerte acoplamiento a la capa de IA.

### 3) SQLite local

La BD es local y por tanto se gestiona en el entorno del usuario. Eso está bien para un proyecto de prueba, pero no para producción multiusuario.

---

## Recomendación para continuar con el proyecto

### Ideal para seguir desarrollando

1. Asegurar un proveedor activo con credenciales válidas.
2. Mantener la app como interfaz local con backend centralizado.
3. Trabajar en refactor de configuración para que el proyecto no dependa de un modelo hardcodeado.
4. Añadir un estado visible de conexión del proveedor al frontend.
5. Separar mejor la capa de IA y la capa web para facilitar pruebas.

---

## Prompt de continuidad para otra IA

Si alguien o alguna IA quiere seguir trabajando con este repo, puede usar este prompt:

```text
Soy el mantenedor de un proyecto llamado OMNI // NEXUS. Este repositorio es una app local de chat con interfaz web, memoria, conversaciones, calculadora y routing de herramientas. Debe seguir estas reglas:

- Revisa primero README.md y la estructura del repositorio.
- Destaca qué funciona y qué está bloqueado.
- No reescribas cosas que ya están bien si no hay motivo.
- Mantén compatibilidad con Node.js y CommonJS.
- No introduzcas credenciales ni secretos en el código ni en el repositorio.
- Aprovecha .env.example para configuración de entorno.
- Si hay un fallo de autenticación con la IA, trátalo como un problema externo de provider y no como bug del frontend.
- Prioriza que la app siga arrancando, probarse y documentarse.
- Usa tests existentes antes de cambiar comportamiento crítico.
- Si falta funcionalidad, documenta qué falta y propone una implementación incremental.
```

---

## Comandos útiles

```bash
npm install
npm test
npm start
npm run dev
```

---

## Recomendación de publicación en GitHub

Antes de subirlo:

- crea un `.env` local para tus pruebas personales
- no subas `.env`
- no subas `node_modules`
- no subas `nexus-memory.db` ni archivos generados
- usa `.gitignore` para ignorarlos
- documenta la dependencia del proveedor externo en el README

---

## Conclusión

OMNI // NEXUS ya es un proyecto con base sólida, estructura clara, UI funcional y APIs definidas. Lo que falta para que el chat real funcione no es más código “de app”, sino un proveedor activo y autenticado con un endpoint válido.

El repo está listo para seguir avanzando, mantener y ampliar, siempre con la documentación clara de lo que ya funciona y lo que aún depende del entorno externo.

---

## Licencia

ISC

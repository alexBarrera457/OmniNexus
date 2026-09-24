# OMNI // NEXUS

Aplicación local de chat inteligente con interfaz web, almacenamiento persistente en SQLite, memoria opcional, búsqueda web, calculadora con soporte de expresiones complejas y routing de herramientas para un backend compatible con OmniRoute/OpenAI.

---

## Estado actual del proyecto

**Estado:** completamente modernizado, optimizado y testeado.

La aplicación cuenta con una arquitectura modular en Express (con `server.js` reducido a menos de 90 líneas limpias), seguridad HTTP mediante `helmet`, rate limiting configurable, persistencia en SQLite con WAL y una interfaz web construida en Astro con diseño interactivo, historial de conversaciones en tiempo real, indicador dinámico del estado del proveedor y mejoras de accesibilidad WCAG.

### Lo que está implementado y verificado

- **Arquitectura modular y limpia:** `server.js` desacoplado en módulos dedicados (`lib/config.js`, `lib/middleware.js`, `routes/chat.js`, `routes/health.js`).
- **Seguridad:** protección con cabeceras de seguridad `helmet` y rate limiter por IP en endpoints `/api/`.
- **Suite de pruebas completa:** 26 tests (unitarios e integración con `supertest` y `node:test`) que pasan al 100%.
- **Frontend Astro:**
  - Historial dinámico de conversaciones en la barra lateral con selector y borrado en tiempo real.
  - Indicador de estado del proveedor IA (`Provider: gpt-4.1` / `Provider: offline`) conectado a `/api/health`.
  - Soporte de accesibilidad y contrastes según pautas WCAG (etiquetas accesibles `.sr-only`).
  - Fondo visual procedural sin dependencias externas.
- **Herramientas NEXUS:**
  - `CALCULATOR`: evaluación matemática segura con soporte de paréntesis, porcentajes y precedencia.
  - `CLOCK`: consulta de fecha y hora del sistema.
  - `WEB`: buscador web con validación de JSON y gestión de timeouts.
  - `CHAT`: orquestación inteligente y memoria persistente opcional.
- **CLI interactivo:** `index.js` refactorizado a bucle iterativo asíncrono con `readline/promises`.
- **Tooling de calidad:** ESLint v10 (flat config `eslint.config.mjs`) y Prettier (`.prettierrc`) configurados y verificados.

---

## Estructura del repositorio

```text
.
├── .env.example
├── .gitignore
├── .prettierignore
├── .prettierrc
├── eslint.config.mjs
├── package.json
├── README.md
├── index.js                     # CLI interactivo iterativo
├── server.js                    # Bootstrap limpio de Express (~87 líneas)
├── astro.config.mjs             # Configuración de Astro y proxy de desarrollo
├── lib/
│   ├── calculator.js            # Motor seguro de cálculo matemático
│   ├── chat-validation.js       # Validación de payloads de chat
│   ├── config.js                # Constantes y variables de entorno centralizadas
│   ├── conversation-repository.js # Repositorio SQLite de conversaciones y mensajes
│   ├── database.js              # Inicialización de SQLite con WAL
│   ├── memory-repository.js     # Repositorio SQLite de recuerdos
│   └── middleware.js            # Rate limiter por IP
├── routes/
│   ├── chat.js                  # Endpoint POST /api/chat
│   ├── conversations.js         # Endpoints CRUD de conversaciones
│   ├── health.js                # Endpoint GET /api/health con provider y herramientas
│   └── memory.js                # Endpoints GET/DELETE /api/memory
├── services/
│   ├── nexus-service.js         # Orquestador del agente, herramientas y persistencia
│   └── web-search.js            # Servicio de búsqueda web con timeout y validación
├── src/
│   ├── pages/
│   │   └── index.astro          # Interfaz principal Astro con historial y estado
│   └── styles/
│       └── global.css           # Estilos visuales con soporte WCAG y responsive
├── public/
│   └── index.html               # Fallback estático en caso de ausencia de build
├── test/
│   ├── calculator.test.js
│   ├── chat-validation.test.js
│   ├── conversation-repository.test.js
│   ├── integration.test.js      # Pruebas de integración HTTP completas con supertest
│   ├── memory-repository.test.js
│   ├── nexus-service.test.js
│   ├── nexus-service-tools.test.js # Tests de herramientas CALCULATOR, CLOCK, WEB
│   ├── server.test.js
│   └── web-search.test.js
└── dist/                        # Build de producción de Astro (generado con npm run build)
```

---

## Cómo arrancar el proyecto

### 1) Instalar dependencias

```bash
npm install
```

En Windows con PowerShell (si la ejecución de scripts `.ps1` está restringida):

```powershell
npm.cmd install
```

### 2) Configurar variables de entorno

Copia la plantilla:

```bash
cp .env.example .env
```

Contenido de ejemplo:

```env
OMNIROUTE_API_KEY=tu_clave_omniroute
OMNIROUTE_BASE_URL=http://localhost:20128/v1
OMNIROUTE_MODEL=gpt-4.1
PORT=3000
HOST=127.0.0.1
ENABLE_MEMORY=false
NEXUS_DB_PATH=./nexus-memory.db
```

### 3) Iniciar en desarrollo

Para trabajar simultáneamente en frontend (Astro con hot reload) y backend (Express con `--watch`):

```bash
npm run dev
```

La interfaz web estará en `http://127.0.0.1:4321` y el backend en `http://127.0.0.1:3000`.

### 4) Iniciar solo el backend o producción

Para compilar el frontend y levantar el servidor:

```bash
npm run build
npm start
```

La aplicación completa se servirá en `http://127.0.0.1:3000`.

---

## Scripts disponibles

| Script                 | Propósito                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| `npm start`            | Arranca el servidor Express sirviendo `dist/` (o fallback `public/`). |
| `npm run dev`          | Ejecuta backend y frontend Astro en paralelo.                         |
| `npm run dev:server`   | Arranca únicamente el backend en modo watch.                          |
| `npm run dev:astro`    | Arranca únicamente el servidor dev de Astro.                          |
| `npm run build`        | Compila el frontend estático con Astro en la carpeta `dist/`.         |
| `npm run preview`      | Previsualiza la build de Astro.                                       |
| `npm run check`        | Comprobación de sintaxis de los scripts base.                         |
| `npm test`             | Ejecuta la suite de 26 pruebas con el runner nativo `node:test`.      |
| `npm run lint`         | Comprueba el código con ESLint (configuración plana v10).             |
| `npm run format`       | Da formato a todo el código con Prettier.                             |
| `npm run format:check` | Verifica si los archivos cumplen el formato Prettier.                 |

---

## API REST

### Health y Diagnóstico

```http
GET /api/health
```

Respuesta de ejemplo:

```json
{
  "ok": true,
  "name": "OMNI // NEXUS",
  "version": "6.2",
  "status": "online",
  "provider": "gpt-4.1",
  "tools": ["WEB", "CALCULATOR", "CLOCK", "CHAT"],
  "memory": false,
  "conversations": true
}
```

### Chat

```http
POST /api/chat
Content-Type: application/json

{
  "messages": [{ "role": "user", "content": "Cuánto es (25 * 4) / 2?" }],
  "conversationId": 1
}
```

### Conversaciones

- `GET /api/conversations`: lista de conversaciones ordenadas por última actualización.
- `POST /api/conversations`: crea una nueva conversación.
- `GET /api/conversations/:id`: obtiene la conversación y sus mensajes.
- `DELETE /api/conversations/:id`: elimina la conversación y sus mensajes en cascada.
- `GET /api/conversations/search/:query`: búsqueda de conversaciones por título o contenido.
- `DELETE /api/conversations/:id/messages`: vacía los mensajes de una conversación.

### Memoria

- `GET /api/memory`: lista los recuerdos capturados del usuario.
- `DELETE /api/memory`: elimina todos los recuerdos almacenados.

---

## Licencia

ISC

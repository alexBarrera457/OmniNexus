const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

console.log("");
console.log("══════════════════════════════════════");
console.log("       🔧 NEXUS DATABASE FIXER");
console.log("══════════════════════════════════════");
console.log("");

const dbPath = path.join(
    __dirname,
    "nexus-memory.db"
);

console.log("📦 Base de datos:");
console.log(dbPath);
console.log("");


// ============================================================
// COMPROBAR BASE DE DATOS
// ============================================================

if (!fs.existsSync(dbPath)) {

    console.error(
        "❌ No se ha encontrado nexus-memory.db"
    );

    process.exit(1);
}

console.log(
    "✅ nexus-memory.db encontrada"
);

console.log("");


// ============================================================
// ABRIR DATABASE
// ============================================================

let db;

try {

    db = new Database(dbPath);

    db.pragma("journal_mode = WAL");

    console.log(
        "✅ SQLite conectada"
    );

} catch (error) {

    console.error(
        "❌ Error abriendo SQLite:"
    );

    console.error(
        error.message
    );

    process.exit(1);
}

console.log("");


// ============================================================
// MOSTRAR TABLAS
// ============================================================

console.log(
    "📋 TABLAS ACTUALES:"
);

const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
`).all();

if (tables.length === 0) {

    console.log(
        "  (ninguna)"
    );

} else {

    for (const table of tables) {

        console.log(
            `  → ${table.name}`
        );

    }
}

console.log("");


// ============================================================
// CONVERSATIONS
// ============================================================

console.log(
    "💬 COMPROBANDO conversations..."
);

const conversationsExists =
    db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        AND name = 'conversations'
    `).get();


// ------------------------------------------------------------
// SI NO EXISTE
// ------------------------------------------------------------

if (!conversationsExists) {

    console.log(
        "⚠️ conversations no existe"
    );

    console.log(
        "🆕 Creando conversations..."
    );

    db.exec(`
        CREATE TABLE conversations (

            id INTEGER
                PRIMARY KEY AUTOINCREMENT,

            title TEXT
                NOT NULL
                DEFAULT 'Nueva conversación',

            created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP,

            updated_at DATETIME
                DEFAULT CURRENT_TIMESTAMP

        );
    `);

    console.log(
        "✅ conversations creada"
    );

}


// ------------------------------------------------------------
// SI YA EXISTE
// ------------------------------------------------------------

else {

    console.log(
        "✅ conversations ya existe"
    );

    console.log("");

    const columns =
        db.prepare(`
            PRAGMA table_info(conversations)
        `).all();


    console.log(
        "📋 COLUMNAS DE conversations:"
    );

    for (const column of columns) {

        console.log(
            `  → ${column.name} (${column.type})`
        );

    }

    console.log("");


// ------------------------------------------------------------
// TITLE
// ------------------------------------------------------------

    const hasTitle =
        columns.some(
            column =>
                column.name === "title"
        );


    if (!hasTitle) {

        console.log(
            "🔧 Falta conversations.title"
        );

        console.log(
            "➕ Añadiendo title..."
        );

        db.exec(`
            ALTER TABLE conversations
            ADD COLUMN title TEXT
        `);

        db.exec(`
            UPDATE conversations
            SET title = 'Nueva conversación'
            WHERE title IS NULL
               OR title = ''
        `);

        console.log(
            "✅ title añadido"
        );

    } else {

        console.log(
            "✅ title ya existe"
        );

    }


// ------------------------------------------------------------
// UPDATED_AT
// ------------------------------------------------------------

    const currentColumns =
        db.prepare(`
            PRAGMA table_info(conversations)
        `).all();


    const hasUpdatedAt =
        currentColumns.some(
            column =>
                column.name === "updated_at"
        );


    if (!hasUpdatedAt) {

        console.log(
            "🔧 Falta conversations.updated_at"
        );

        console.log(
            "➕ Añadiendo updated_at..."
        );

        db.exec(`
            ALTER TABLE conversations
            ADD COLUMN updated_at DATETIME
        `);

        db.exec(`
            UPDATE conversations
            SET updated_at = created_at
            WHERE updated_at IS NULL
        `);

        console.log(
            "✅ updated_at añadido"
        );

    } else {

        console.log(
            "✅ updated_at ya existe"
        );

    }

}


// ============================================================
// MESSAGES
// ============================================================

console.log("");

console.log(
    "📨 COMPROBANDO messages..."
);

const messagesExists =
    db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        AND name = 'messages'
    `).get();


// ------------------------------------------------------------
// SI NO EXISTE
// ------------------------------------------------------------

if (!messagesExists) {

    console.log(
        "⚠️ messages no existe"
    );

    console.log(
        "🆕 Creando messages..."
    );

    db.exec(`
        CREATE TABLE messages (

            id INTEGER
                PRIMARY KEY AUTOINCREMENT,

            conversation_id INTEGER,

            role TEXT,

            content TEXT,

            created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP

        );
    `);

    console.log(
        "✅ messages creada"
    );

}


// ------------------------------------------------------------
// SI EXISTE
// ------------------------------------------------------------

else {

    console.log(
        "✅ messages ya existe"
    );

    console.log("");

    const messageColumns =
        db.prepare(`
            PRAGMA table_info(messages)
        `).all();


    console.log(
        "📋 COLUMNAS DE messages:"
    );

    for (
        const column
        of messageColumns
    ) {

        console.log(
            `  → ${column.name} (${column.type})`
        );

    }

}


// ============================================================
// MEMORY
// ============================================================

console.log("");

console.log(
    "🧠 COMPROBANDO memories..."
);

const memoriesExists =
    db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        AND name = 'memories'
    `).get();


if (!memoriesExists) {

    console.log(
        "⚠️ memories no existe"
    );

    console.log(
        "🆕 Creando memories..."
    );

    db.exec(`
        CREATE TABLE memories (

            id INTEGER
                PRIMARY KEY AUTOINCREMENT,

            content TEXT
                NOT NULL,

            created_at DATETIME
                DEFAULT CURRENT_TIMESTAMP

        );
    `);

    console.log(
        "✅ memories creada"
    );

} else {

    console.log(
        "✅ memories ya existe"
    );

}


// ============================================================
// COMPROBACIÓN FINAL
// ============================================================

console.log("");

console.log(
    "══════════════════════════════════════"
);

console.log(
    "       🔍 COMPROBACIÓN FINAL"
);

console.log(
    "══════════════════════════════════════"
);

console.log("");


// ------------------------------------------------------------
// CONVERSATIONS FINAL
// ------------------------------------------------------------

const finalConversationColumns =
    db.prepare(`
        PRAGMA table_info(conversations)
    `).all();

console.log(
    "💬 conversations:"
);

for (
    const column
    of finalConversationColumns
) {

    console.log(
        `  ✅ ${column.name}`
    );

}


// ------------------------------------------------------------
// MESSAGES FINAL
// ------------------------------------------------------------

const finalMessageColumns =
    db.prepare(`
        PRAGMA table_info(messages)
    `).all();

console.log("");

console.log(
    "📨 messages:"
);

for (
    const column
    of finalMessageColumns
) {

    console.log(
        `  ✅ ${column.name}`
    );

}


// ============================================================
// CERRAR DATABASE
// ============================================================

db.close();

console.log("");

console.log(
    "══════════════════════════════════════"
);

console.log(
    "       🎉 DATABASE REPARADA"
);

console.log(
    "══════════════════════════════════════"
);

console.log("");

console.log(
    "Ahora ejecuta:"
);

console.log("");

console.log(
    "node server.js"
);

console.log("");
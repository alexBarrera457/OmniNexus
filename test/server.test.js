const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

test("server exporta la app sin arrancar el listener al importarla", () => {
    const result = spawnSync(process.execPath, ["-e", "const app = require('./server'); console.log(typeof app.use);"], {
        cwd: path.join(__dirname, ".."),
        encoding: "utf8",
        timeout: 3000
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stdout.trim(), "function");
});

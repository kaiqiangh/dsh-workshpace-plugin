import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { promisify } from "node:util"

const exec = promisify(execFile)
const repo = process.cwd()

function json(value) { return `${JSON.stringify(value, null, 2)}\n` }
async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, json(value))
}

async function wrapWebClient(file) {
  const source = (await readFile(file, "utf8")).replace(/[ \t]+$/gm, "")
  const match = source.match(/export \{ ([^}]+) \};\n?$/)
  if (!match) throw new Error("client bundle must end with named exports")
  const exports = match[1]
  const body = source.slice(0, match.index)
  if (/^\s*(?:import|export)\b/m.test(body)) throw new Error("client bundle must be self-contained")
  await writeFile(file, `window.__ModuleLoader__.load({
  id: "dsh-workspace-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    Object.assign(exports, { ${exports} });
    return module.exports;
  }
});
`)
}

const root = await mkdtemp(join(tmpdir(), "dsh-workspace-build-"))
try {
  const plugin = join(root, "packages/plugin")
  const protocol = join(root, "packages/protocol")
  await symlink(join(repo, "node_modules"), join(root, "node_modules"), "junction")
  await writeJson(join(root, "package.json"), { name: "dsh-workspace-build", private: true, type: "module" })
  await mkdir(plugin, { recursive: true })
  await cp(join(repo, "src"), join(plugin, "src"), { recursive: true })
  await writeFile(join(plugin, "src/typert.remote-client.js"), "export const TYPERT_REMOTE = { package: 'dsh-workspace-plugin', descriptors: [] }\n")
  await writeFile(join(plugin, "src/typert.remote-client.d.ts"), "export declare const TYPERT_REMOTE: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteContribution\n")
  await cp(join(repo, "package.json"), join(plugin, "package.json"))
  await cp(join(repo, "package-lock.json"), join(plugin, "package-lock.json"))
  await cp(join(repo, "cordis.patch.yml"), join(plugin, "cordis.patch.yml"))
  await cp(join(repo, "node_modules/@deepseek-ai/dsh-typert-protocol/lib"), join(protocol, "lib"), { recursive: true })
  await writeJson(join(protocol, "package.json"), {
    name: "@deepseek-ai/dsh-typert-protocol", private: true, type: "module",
    exports: { ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" }, "./types": { types: "./lib/types/types.d.ts", default: "./lib/types/types.js" } },
  })
  await writeJson(join(protocol, "tsconfig.json"), { extends: "../../tsconfig.base.json", compilerOptions: { rootDir: "lib", outDir: "lib/types", noEmit: true }, files: ["lib/types/index.d.ts", "lib/types/types.d.ts"] })
  await writeJson(join(root, "tsconfig.base.json"), {
    compilerOptions: { target: "ES2024", module: "ESNext", moduleResolution: "Bundler", strict: true, composite: true, noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true, types: ["node"], paths: {
      "@deepseek-ai/dsh-typert-protocol": ["./packages/protocol/lib/types/index.d.ts"],
      "@deepseek-ai/dsh-typert-protocol/types": ["./packages/protocol/lib/types/types.d.ts"],
      "dsh-workspace-plugin": ["./packages/plugin/src/index.ts"],
      "dsh-workspace-plugin/client": ["./packages/plugin/src/client.ts"],
      "dsh-workspace-plugin/types": ["./packages/plugin/src/types.ts"],
      "dsh-workspace-plugin/*": ["./packages/plugin/src/*"],
    } },
  })
  await writeJson(join(plugin, "tsconfig.json"), { extends: "../../tsconfig.base.json", compilerOptions: { rootDir: "src", outDir: "lib/types", noEmit: true }, include: ["src"] })
  await writeJson(join(root, "tsconfig.host.json"), { extends: "./tsconfig.base.json", files: [], references: [{ path: "./packages/protocol" }, { path: "./packages/plugin" }] })
  await writeJson(join(root, "tsconfig.client.json"), { extends: "./tsconfig.base.json", files: [], references: [{ path: "./packages/protocol" }, { path: "./packages/plugin" }] })
  await writeJson(join(root, "tsconfig.bundle.json"), { compilerOptions: { target: "ES2024", module: "ESNext", moduleResolution: "Bundler", strict: true, allowImportingTsExtensions: true, skipLibCheck: true, types: ["node"] } })
  await writeJson(join(root, "tsconfig.declarations.json"), { extends: "./tsconfig.base.json", compilerOptions: { rootDir: "packages/plugin/src", outDir: "packages/plugin/lib/types", declaration: true, emitDeclarationOnly: true, noEmit: false }, include: ["packages/plugin/src"] })
  await writeFile(join(root, "tsdown.host.config.mjs"), `import { defineConfig } from 'tsdown'\nimport { typertPlugin } from '@deepseek-ai/dsh-typert-generator/tsdown'\nexport default defineConfig({ entry: ['packages/plugin/src/index.ts'], outDir: 'packages/plugin/lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false, external: [/^@deepseek-ai\\//], plugins: [typertPlugin({ mode: 'workspace', faces: ['host', 'client'] })] })\n`)
  await writeFile(join(root, "tsdown.client.config.mjs"), `import { defineConfig } from 'tsdown'\nexport default defineConfig({ entry: { client: 'packages/plugin/src/client.ts' }, outDir: 'packages/plugin/lib', format: ['esm'], platform: 'browser', target: 'es2024', fixedExtension: false, dts: false, clean: false, external: ['@deepseek-ai/cordis', /^@deepseek-ai\\//], deps: { alwaysBundle: ['react', 'zod'] } })\n`)
  const node = process.execPath
  const tsdown = join(repo, "node_modules/tsdown/dist/run.mjs")
  const tsc = join(repo, "node_modules/typescript/bin/tsc")
  const run = (args) => exec(node, args, { cwd: root, stdio: "inherit" })
  await run([tsdown, "--config", "tsdown.host.config.mjs", "--tsconfig", "tsconfig.bundle.json", "--no-report"])
  await cp(join(plugin, "lib/typert.remote-client.js"), join(plugin, "src/typert.remote-client.js"))
  await run([tsdown, "--config", "tsdown.client.config.mjs", "--tsconfig", "tsconfig.bundle.json", "--no-report"])
  await run([tsc, "-p", "tsconfig.declarations.json", "--pretty", "false"])
  await rm(join(repo, "lib"), { recursive: true, force: true })
  await cp(join(plugin, "lib"), join(repo, "lib"), { recursive: true })
  await wrapWebClient(join(repo, "lib/client.js"))
  console.log("built dsh-workspace-plugin/lib")
} finally {
  await rm(root, { recursive: true, force: true })
}

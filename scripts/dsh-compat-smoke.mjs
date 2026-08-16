import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'

const exec = promisify(execFile)
const SOURCE_REVISION = '47f943859bef60e4160492346772ded9b24f765a'
const SOURCE_REPOSITORY = 'https://github.com/deepseek-ai/deepseek-harness.git'
const SOURCE_BASELINE_NOTE = 'ADR-0003 pinned baseline declaration'
const PACKAGE_VERSIONS = {
  '@deepseek-ai/cordis': '4.0.1',
  '@deepseek-ai/dsh-api-gateway': '0.1.0-rc.6',
  '@deepseek-ai/dsh-api-remotes': '0.1.0-rc.6',
  '@deepseek-ai/dsh-agent': '0.1.0-rc.6',
  '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
  '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6',
  '@deepseek-ai/dsh-host-webserver': '0.1.0-rc.6',
  '@deepseek-ai/dsh-session': '0.1.0-rc.6',
  '@deepseek-ai/dsh-system-prompt': '0.1.0-rc.6',
  '@deepseek-ai/dsh-token-meter': '0.1.0-rc.6',
  '@deepseek-ai/dsh-typert-generator': '0.1.0-rc.6',
  '@deepseek-ai/dsh-typert-protocol': '0.1.0-rc.6',
  '@deepseek-ai/dsh-typert-registry': '0.1.0-rc.6',
  '@types/react': '18.3.12',
  '@types/node': '26.2.0',
  react: '18.3.1',
  tsdown: '0.22.14',
  typescript: '6.0.3',
  zod: '4.4.3',
}

const npmSpecifiers = Object.entries(PACKAGE_VERSIONS).map(([name, version]) => `${name}@${version}`)

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, json(value))
}

async function writeText(file, value) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, value)
}

async function wrapWebClient(file) {
  const source = (await readFile(file, 'utf8')).replace(/[ \t]+$/gm, '')
  const match = source.match(/export \{ ([^}]+) \};\n?$/)
  if (!match) throw new Error('client bundle must end with named exports')
  const body = source.slice(0, match.index)
  const esmLine = body.split('\n').find(line => /^\s*(?:import|export)\b/.test(line))
  if (esmLine) throw new Error(`client bundle must be self-contained: ${esmLine}`)
  await writeText(file, `window.__ModuleLoader__.load({
  id: "dsh-workspace-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    Object.assign(exports, { ${match[1]} });
    return module.exports;
  }
});
`)
}

async function packageJson(root, name) {
  const file = join(root, 'node_modules', ...name.split('/'), 'package.json')
  return JSON.parse(await readFile(file, 'utf8'))
}

async function installProfile(root) {
  await writeJson(join(root, 'package.json'), { name: 'dsh-compat-profile', private: true, type: 'module' })
  await exec('npm', [
    'install', '--ignore-scripts', '--no-fund', '--no-audit',
    ...npmSpecifiers,
  ], { cwd: root, stdio: 'inherit' })
  const lockText = await readFile(join(root, 'package-lock.json'), 'utf8')
  const lock = JSON.parse(lockText)
  assert.equal(lock.lockfileVersion, 3)
  for (const [name, expected] of Object.entries(PACKAGE_VERSIONS)) {
    const entry = lock.packages[`node_modules/${name}`]
    assert.equal(entry?.version, expected, `${name} must be pinned in package-lock.json`)
  }
  for (const [name, expected] of Object.entries(PACKAGE_VERSIONS)) {
    const installed = await packageJson(root, name)
    assert.equal(installed.version, expected, `${name} must stay pinned at ${expected}`)
  }
  return createHash('sha256').update(lockText).digest('hex')
}

async function createFixture(root) {
  const protocolRoot = join(root, 'packages/protocol')
  const pluginRoot = join(root, 'packages/plugin')
  await mkdir(pluginRoot, { recursive: true })
  await cp(
    join(root, 'node_modules/@deepseek-ai/dsh-typert-protocol/lib'),
    join(protocolRoot, 'lib'),
    { recursive: true },
  )
  await writeJson(join(root, 'tsconfig.base.json'), {
    compilerOptions: {
      target: 'ES2024',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      composite: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      types: ['node'],
      paths: {
        '@deepseek-ai/dsh-typert-protocol': ['./packages/protocol/lib/types/index.d.ts'],
        '@deepseek-ai/dsh-typert-protocol/types': ['./packages/protocol/lib/types/types.d.ts'],
        'dsh-workspace-plugin': ['./packages/plugin/src/index.ts'],
        'dsh-workspace-plugin/client': ['./packages/plugin/src/client.ts'],
        'dsh-workspace-plugin/types': ['./packages/plugin/src/types.ts'],
        'dsh-workspace-plugin/*': ['./packages/plugin/src/*'],
      },
    },
  })
  await writeJson(join(root, 'tsconfig.host.json'), {
    extends: './tsconfig.base.json',
    files: [],
    references: [{ path: './packages/protocol' }, { path: './packages/plugin' }],
  })
  await writeJson(join(root, 'tsconfig.client.json'), {
    extends: './tsconfig.base.json',
    files: [],
    references: [{ path: './packages/protocol' }, { path: './packages/plugin' }],
  })
  await writeJson(join(root, 'tsconfig.bundle.json'), {
    compilerOptions: {
      target: 'ES2024',
      module: 'ESNext',
      moduleResolution: 'Bundler',
    strict: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      types: ['node'],
    },
  })
  await cp(join(process.cwd(), 'src'), join(pluginRoot, 'src'), { recursive: true })
  await writeText(join(pluginRoot, 'src/typert.remote-client.js'), "export const TYPERT_REMOTE = { package: 'dsh-workspace-plugin', descriptors: [] }\n")
  await writeText(join(pluginRoot, 'src/typert.remote-client.d.ts'), "export declare const TYPERT_REMOTE: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteContribution\n")
  await cp(join(process.cwd(), 'package.json'), join(pluginRoot, 'package.json'))
  await cp(join(process.cwd(), 'package-lock.json'), join(pluginRoot, 'package-lock.json'))
  await cp(join(process.cwd(), 'cordis.patch.yml'), join(pluginRoot, 'cordis.patch.yml'))
  await writeJson(join(protocolRoot, 'package.json'), {
    name: '@deepseek-ai/dsh-typert-protocol',
    private: true,
    type: 'module',
    exports: {
      '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
      './types': { types: './lib/types/types.d.ts', default: './lib/types/types.js' },
    },
  })
  await writeJson(join(protocolRoot, 'tsconfig.json'), {
    extends: '../../tsconfig.base.json',
    compilerOptions: { rootDir: 'lib', outDir: 'lib/types', noEmit: true },
    files: ['lib/types/index.d.ts', 'lib/types/types.d.ts'],
  })
  await writeJson(join(pluginRoot, 'tsconfig.json'), {
    extends: '../../tsconfig.base.json',
    compilerOptions: { rootDir: 'src', outDir: 'lib/types', noEmit: true },
    include: ['src'],
  })
  await writeText(join(root, 'tsdown.host.config.mjs'), `
import { defineConfig } from 'tsdown'
import { typertPlugin } from '@deepseek-ai/dsh-typert-generator/tsdown'
export default defineConfig({
  entry: ['packages/plugin/src/index.ts'], outDir: 'packages/plugin/lib',
  format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false,
  dts: false, clean: false, external: [/^@deepseek-ai\\//],
  plugins: [typertPlugin({ mode: 'workspace', faces: ['host', 'client'] })],
})
`)
  await writeText(join(root, 'tsdown.client.config.mjs'), `
import { defineConfig } from 'tsdown'
export default defineConfig({
  entry: { client: 'packages/plugin/src/client.ts' }, outDir: 'packages/plugin/lib',
  format: ['esm'], platform: 'browser', target: 'es2024', fixedExtension: false,
  dts: false, clean: false, external: ['@deepseek-ai/cordis'], deps: { alwaysBundle: ['react', 'zod'] },
  })
`)
  return { pluginRoot }
}

async function buildFixture(root) {
  const pluginRoot = join(root, 'packages/plugin')
  const tsc = join(root, 'node_modules/typescript/bin/tsc')
  const tsdown = join(root, 'node_modules/tsdown/dist/run.mjs')
  await exec(process.execPath, [tsdown, '--config', 'tsdown.host.config.mjs', '--tsconfig', 'tsconfig.bundle.json', '--no-report'], { cwd: root, stdio: 'inherit' })
  await cp(join(pluginRoot, 'lib/typert.remote-client.js'), join(pluginRoot, 'src/typert.remote-client.js'))
  await exec(process.execPath, [tsdown, '--config', 'tsdown.client.config.mjs', '--tsconfig', 'tsconfig.bundle.json', '--no-report'], { cwd: root, stdio: 'inherit' })
  await wrapWebClient(join(pluginRoot, 'lib/client.js'))
  await writeJson(join(root, 'tsconfig.declarations.json'), {
    extends: './tsconfig.base.json',
    compilerOptions: {
      rootDir: 'packages/plugin/src',
      outDir: 'packages/plugin/lib/types',
      declaration: true,
      emitDeclarationOnly: true,
      noEmit: false,
    },
    include: ['packages/plugin/src'],
  })
  await exec(process.execPath, [tsc, '-p', 'tsconfig.declarations.json', '--pretty', 'false'], { cwd: root, stdio: 'inherit' })
}

async function installPackedBundle(root, pluginRoot) {
  const packDir = join(root, 'pack')
  await mkdir(packDir, { recursive: true })
  const packed = JSON.parse((await exec('npm', ['pack', '--json', '--pack-destination', packDir], { cwd: pluginRoot })).stdout)
  const packedFiles = new Set(packed[0].files.map(file => file.path))
  for (const file of [
    'lib/index.js', 'lib/client.js', 'lib/types/index.d.ts', 'lib/types/types.d.ts',
    'lib/typert.host.js', 'lib/typert.client.js', 'lib/typert.remote-client.js', 'cordis.patch.yml',
  ]) assert.ok(packedFiles.has(file), `packed bundle must include ${file}`)
  assert.equal([...packedFiles].some(file => file.startsWith('src/')), false, 'packed bundle must not fall back to source files')
  const tarball = join(packDir, packed[0].filename)
  const consumer = join(root, 'consumer')
  await writeJson(join(consumer, 'package.json'), { name: 'dsh-compat-consumer', private: true, type: 'module' })
  await exec('npm', [
    'install', '--ignore-scripts', '--no-fund', '--no-audit',
    tarball, ...npmSpecifiers.filter(specifier => !specifier.startsWith('zod@')),
  ], { cwd: consumer, stdio: 'inherit' })
  const lockText = await readFile(join(consumer, 'package-lock.json'), 'utf8')
  const lock = JSON.parse(lockText)
  assert.equal(lock.lockfileVersion, 3)
  for (const [name, expected] of Object.entries(PACKAGE_VERSIONS)) {
    const entry = lock.packages[`node_modules/${name}`]
    assert.equal(entry?.version, expected, `${name} must be pinned in consumer package-lock.json`)
  }
  await writeText(join(consumer, 'runtime.mjs'), `
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
const manifest = (await import('dsh-workspace-plugin/package.json', { with: { type: 'json' } })).default
const host = await import('dsh-workspace-plugin')
const hostTypert = await import('dsh-workspace-plugin/typert')
const clientTypert = await import('dsh-workspace-plugin/client/typert')
const remote = await import('dsh-workspace-plugin/remote')
const clientSource = await readFile(new URL('./node_modules/dsh-workspace-plugin/lib/client.js', import.meta.url), 'utf8')
let handoff
const sandbox = { console, Symbol }
sandbox.globalThis = sandbox
sandbox.window = { __ModuleLoader__: { load(value) { handoff = value } } }
runInNewContext(clientSource, sandbox)
if (handoff?.id !== 'dsh-workspace-plugin' || typeof handoff.factory !== 'function') throw new Error('packed client did not register with the public module loader')
const client = handoff.factory(() => { throw new Error('packed client requested an unexpected dependency') })
export { manifest, host, client, hostTypert, clientTypert, remote }
`)
  await writeText(join(consumer, 'check.mjs'), `
const { manifest, host, client, hostTypert, clientTypert, remote } = await import('./runtime.mjs')
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('missing dsh.bundle patch metadata')
  if (manifest.dsh?.client?.platform !== 'web') throw new Error('missing web dsh.client metadata')
  if (manifest.dsh?.client?.immediately !== true) throw new Error('web client must be immediate')
  if (manifest.name !== 'dsh-workspace-plugin') throw new Error('packed consumer did not load the repository package')
if (typeof manifest.exports?.['./client'] !== 'object') throw new Error('missing public ./client export')
if (typeof manifest.exports?.['./typert'] !== 'object') throw new Error('missing public ./typert export')
if (typeof manifest.exports?.['./client/typert'] !== 'object') throw new Error('missing public ./client/typert export')
if (typeof host.WorkspaceService !== 'function' || typeof client.apply !== 'function') throw new Error('public bundle entries did not load')
if (hostTypert.TYPERT.face !== 'host' || clientTypert.TYPERT.face !== 'client') throw new Error('generated face mismatch')
if (hostTypert.TYPERT.package !== 'dsh-workspace-plugin' || clientTypert.TYPERT.package !== 'dsh-workspace-plugin') throw new Error('generated package identity mismatch')
if (remote.TYPERT_REMOTE.package !== 'dsh-workspace-plugin' || remote.TYPERT_REMOTE.descriptors.length === 0) throw new Error('missing remote contribution')
console.log('installed-bundle-ok')
`)
  const check = await exec(process.execPath, ['check.mjs'], { cwd: consumer })
  assert.match(check.stdout, /installed-bundle-ok/)
  return {
    consumer,
    lockfileSha256: createHash('sha256').update(lockText).digest('hex'),
  }
}

async function publicBundleSmoke(consumer) {
  const { manifest, host, client, hostTypert, clientTypert, remote } = await import(pathToFileURL(join(consumer, 'runtime.mjs')).href)
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.dsh.client.immediately, true)
  assert.equal(manifest.name, 'dsh-workspace-plugin')
  assert.equal(typeof manifest.exports['./client'], 'object')
  assert.equal(typeof manifest.exports['./typert'], 'object')
  assert.equal(typeof manifest.exports['./client/typert'], 'object')
  assert.equal(typeof host.WorkspaceService, 'function')
  assert.equal(typeof client.apply, 'function')
  assert.equal(hostTypert.TYPERT.face, 'host')
  assert.equal(hostTypert.TYPERT.package, 'dsh-workspace-plugin')
  assert.equal(clientTypert.TYPERT.face, 'client')
  assert.equal(clientTypert.TYPERT.package, 'dsh-workspace-plugin')
  assert.equal(remote.TYPERT_REMOTE.package, 'dsh-workspace-plugin')
  assert.ok(remote.TYPERT_REMOTE.descriptors.every(descriptor => descriptor.id.startsWith('dsh-workspace-plugin#')))
  const strictJson = JSON.stringify(hostTypert.TYPERT)
  assert.equal(strictJson.includes('src-json'), false, 'compatibility smoke must not downgrade to SRC JSON')
  return { host, client, hostTypert, profileRoot: consumer }
}

async function gatewaySmoke(root, host, hostTypert) {
  const { Context } = await import(pathToFileURL(join(root, 'node_modules/@deepseek-ai/cordis/lib/index.js')).href)
  const TypertRegistry = (await import(pathToFileURL(join(root, 'node_modules/@deepseek-ai/dsh-typert-registry/lib/index.js')).href)).default
  const TypertGatewayService = (await import(pathToFileURL(join(root, 'node_modules/@deepseek-ai/dsh-api-gateway/lib/index.js')).href)).default
  const ctx = new Context()
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(TypertGatewayService)
  await ctx.plugin(host.WorkspaceService)
  const scoped = ctx.extend({ fixtureScope: 'agent-1' })
  ctx.typert.contexts.registerHost('agent', {
    wire: 'agentId',
    wireTypeSymbol: 'dsh-workspace-plugin/types#AgentId',
    resolve: id => id === 'agent-1' ? scoped : undefined,
  })
  ctx.typert.register(hostTypert.TYPERT)
  const result = await ctx.typertGateway.invoke({
    namespace: 'workspace', method: 'focus', args: { agentId: 'agent-1' },
  })
  assert.deepEqual(result, { focused: true })
  const initialContext = await ctx.typertGateway.invoke({
    namespace: 'workspace', method: 'contextSnapshot', args: { agentId: 'agent-1' },
  })
  assert.equal(initialContext.status, 'omitted')
  assert.equal(initialContext.capacityTokens, 0)
  const replacedContext = await ctx.typertGateway.invoke({
    namespace: 'workspace', method: 'replaceContext',
    args: {
      agentId: 'agent-1',
      snapshot: {
        version: 1,
        contentHash: `sha256:${'c'.repeat(64)}`,
        estimatedTokens: 12,
        capacityTokens: 512,
        admittedTokens: 12,
        availableBudgetTokens: 480,
        remainingTokens: 468,
        status: 'ready',
        omissionReason: '',
      },
    },
  })
  assert.equal(replacedContext.version, 1)
  assert.equal(replacedContext.remainingTokens, 468)
  assert.equal(typeof host.registerPinnedContextCarrier, 'function')
  assert.equal(typeof host.createPinnedContext, 'function')
  const registrations = []
  const carrierAgent = {
    id: 'agent-1',
    ctx: {
      systemPrompt: {
        context(registration) {
          registrations.push(registration)
          return () => registrations.splice(registrations.indexOf(registration), 1)
        },
      },
    },
  }
  let contextState = host.createPinnedContext({ sessionId: 'agent-1', rootId: 'root-1' }, { maxItemBytes: 64, reservedOutputTokens: 4 })
  contextState = host.setContextCapacity(contextState, 256)
  contextState = host.pinContextPath(contextState, 'src/auth.py')
  const readyState = host.updateContextPath(contextState, { path: 'src/auth.py', status: 'ready', content: 'alpha', loadedAt: 1 })
  const omittedState = host.updateContextPath(contextState, { path: 'src/auth.py', status: 'ready', content: 'x'.repeat(80), loadedAt: 2 })
  assert.equal(omittedState.entries[0].status, 'over-budget')
  const carrier = host.registerPinnedContextCarrier(carrierAgent, readyState)
  const firstText = registrations[0].text()
  const changedState = host.updateContextPath(readyState, { path: 'src/auth.py', status: 'ready', content: 'beta', loadedAt: 3 })
  carrier.update(changedState)
  assert.notEqual(registrations[0].text(), firstText)
  carrier.dispose()
  assert.equal(registrations.length, 0)
  assert.ok(ctx.typert.local.list().length > 0)
  return { ctx, registry: ctx.typert, host }
}

async function webSmoke(root, host, ctx) {
  const WebServer = (await import(pathToFileURL(join(root, 'node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js')).href)).default
  const webFiber = ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  await webFiber
  const session = { sessionId: 'session-1', rootId: 'root-1' }
  const file = join(root, 'workspace-smoke.png')
  await writeFile(file, Buffer.from([98, 111, 117, 110, 100, 101, 100]))
  const preview = new host.PreviewService(root, session)
  const descriptor = await preview.preview('workspace-smoke.png')
  assert.equal(descriptor.type, 'binary')
  assert.equal(typeof host.registerWorkspaceResourceRoute, 'function')
  const resourceId = descriptor.resourceId
  const endpoint = `http://127.0.0.1:${ctx.webServer.port}/workspace/resource`
  host.installWorkspaceResourceRoute(ctx, ctx.webServer, { preview })
  const authorized = await fetch(`${endpoint}?id=${resourceId}&type=image%2Fpng&download=1`, {
    headers: { 'x-dsh-session': session.sessionId, 'x-dsh-root': session.rootId },
  })
  assert.equal(authorized.status, 200)
  assert.equal(authorized.headers.get('content-type'), 'image/png')
  assert.equal(authorized.headers.get('content-disposition'), 'attachment; filename="workspace-smoke.png"')
  assert.equal(await authorized.text(), 'bounded')
  const tampered = await fetch(`${endpoint}?id=tampered&type=image%2Fpng`, {
    headers: { 'x-dsh-session': session.sessionId, 'x-dsh-root': session.rootId },
  })
  assert.equal(tampered.status, 404)
  const wrongType = await fetch(`${endpoint}?id=${resourceId}&type=text%2Fplain`, {
    headers: { 'x-dsh-session': session.sessionId, 'x-dsh-root': session.rootId },
  })
  assert.equal(wrongType.status, 404)
  const staleIdentity = await fetch(`${endpoint}?id=${resourceId}&type=image%2Fpng`, {
    headers: { 'x-dsh-session': session.sessionId, 'x-dsh-root': 'root-replaced' },
  })
  assert.equal(staleIdentity.status, 404)
  return { endpoint, preview }
}

async function conversationSmoke(root, client, ctx) {
  const runtimeFile = pathToFileURL(join(root, 'node_modules/@deepseek-ai/dsh-client-runtime/lib/client.js')).href
  const cordis = await import(pathToFileURL(join(root, 'node_modules/@deepseek-ai/cordis/lib/index.js')).href)
  const slots = await import(pathToFileURL(join(root, 'node_modules/@deepseek-ai/dsh-client-ui-slots/lib/index.js')).href)
  let factory
  globalThis.window = { __ModuleLoader__: { load: ({ id, factory: next }) => { if (id === '@deepseek-ai/dsh-client-runtime') factory = next } } }
  await import(runtimeFile)
  assert.equal(typeof factory, 'function', 'installed Client bundle must register with the public module loader')
  const { ConversationNodeAssembler } = factory(id => {
    if (id === '@deepseek-ai/cordis') return cordis
    if (id === '@deepseek-ai/dsh-client-ui-slots') return slots
    throw new Error(`unexpected client dependency ${id}`)
  })
  const definitions = []
  const views = []
  const clientSlots = []
  let clientCleanup
  let clientRemoteMounted = 0
  let clientRemoteDisposed = false
  let clientOpened = 0
  const contribution = ctx.extend({
    conversationEvents: { register(definition) { definitions.push(definition); return () => definitions.splice(definitions.indexOf(definition), 1) } },
    conversationViews: { register(view) { views.push(view); return () => views.splice(views.indexOf(view), 1) } },
    slots: {
      inject(key, callback) {
        assert.equal(key, 'conversation.chat.node')
        const dispose = callback()
        return () => { dispose(); clientSlots.splice(0) }
      },
      register(options, component) {
        assert.equal(options.name, 'conversation.chat.node')
        assert.equal(options.key, 'dsh-workspace-summary')
        clientSlots.push(component)
        return () => clientSlots.splice(0)
      },
    },
    effect(factory) { clientCleanup = factory() },
    remote: {
      async $mount(remoteContribution) {
        assert.equal(remoteContribution.package, 'dsh-workspace-plugin')
        clientRemoteMounted += 1
        return async () => { clientRemoteMounted -= 1; clientRemoteDisposed = true }
      },
    },
    emit(event) { if (event === 'workspace/open') clientOpened += 1 },
  })
  const clientDispose = await client.apply(contribution)
  assert.equal(definitions.length, 1)
  assert.equal(views.length, 0)
  assert.equal(clientSlots.length, 1)
  assert.equal(clientRemoteMounted, 1)
  await assert.rejects(() => client.apply({}), /public conversation and Typert Remote seams/)
  const clientNode = clientSlots[0]({ node: {
    key: 'dsh-workspace-summary:client', kind: 'dsh-workspace-summary', id: 'client', target: 'chat',
    data: { filesTouched: 1, changes: 2, artifacts: 0, workspaceName: 'client' }, anchorSeq: 1,
    location: { kind: 'session' }, visibility: 'visible',
  } })
  assert.equal(clientNode.type, 'section')
  assert.equal(clientNode.props['data-dsh-workspace'], 'summary')
  assert.equal(clientNode.props.children[2].type, 'button')
  clientNode.props.children[2].props.onClick()
  assert.equal(clientOpened, 1)
  const workspace = client
  assert.equal(typeof workspace.workspaceConversationView, 'object')
  const events = { entries: () => definitions, fallbackEntry: () => undefined }
  const viewDefinitions = { entries: () => [workspace.workspaceConversationView] }
  const assembler = new ConversationNodeAssembler(events, viewDefinitions)
  const input = {
    event: {
      seq: 1,
      time: 1,
      type: 'workspace/summary',
      data: { id: 'summary-1', phase: 'start', summary: { filesTouched: 1, changes: 0, artifacts: 0, workspaceName: 'compat' } },
      ignorable: true,
    },
    view: undefined,
  }
  assembler.replaceWindow([input], false)
  assembler.flush()
  const first = assembler.snapshot('chat')
  assembler.replaceWindow([input], false)
  assembler.flush()
  const replayed = assembler.snapshot('chat')
  assert.deepEqual([...first.nodes.keys()], [...replayed.nodes.keys()])
  assert.deepEqual([...first.nodes.values()].map(node => node.data), [...replayed.nodes.values()].map(node => node.data))

  assert.equal(typeof workspace.applyWorkspaceConversationContribution, 'function', 'packed Client must export the Workspace Web contribution')
  assert.equal(typeof workspace.createWorkspaceDrawerController, 'function', 'packed Client must export typed Workspace operations')
  const workspaceDefinitions = []
  const workspaceViews = []
  const workspaceSlots = []
  let workspaceCleanup
  let opened = false
  let previewCalls = 0
  let sendCalls = 0
  let contextCalls = 0
  let rendered
  const workspaceContext = {
    conversationEvents: { register(definition) { workspaceDefinitions.push(definition); return () => workspaceDefinitions.splice(workspaceDefinitions.indexOf(definition), 1) } },
    conversationViews: { register(view) { workspaceViews.push(view); return () => workspaceViews.splice(workspaceViews.indexOf(view), 1) } },
    slots: {
      inject(key, callback) {
        assert.equal(key, 'conversation.chat.node')
        const dispose = callback()
        return () => { dispose(); workspaceSlots.splice(0) }
      },
      register(options, component) {
        assert.equal(options.name, 'conversation.chat.node')
        assert.equal(options.key, 'dsh-workspace-summary')
        workspaceSlots.push(component)
        return () => workspaceSlots.splice(0)
      },
    },
    effect(factory) { workspaceCleanup = factory() },
  }
  workspace.applyWorkspaceConversationContribution(workspaceContext, {
    renderSummary(model) { rendered = model; return model },
    openWorkspace() { opened = true },
  })
  assert.equal(workspaceDefinitions.length, 1)
  assert.equal(workspaceViews.length, 1)
  assert.equal(workspaceSlots.length, 1)
  const summary = { filesTouched: 8, changes: 3, artifacts: 2, workspaceName: 'compat' }
  const summaryEvent = { type: 'workspace/summary', seq: 2, data: { id: 'compat-session', phase: 'start', summary } }
  const summaryMatch = workspace.workspaceConversationDefinition.match(summaryEvent)
  assert.equal(summaryMatch.id, 'compat-session')
  assert.equal(summaryMatch.role, 'start')
  const summaryNode = workspace.workspaceConversationDefinition.buildViewNode({
    key: 'dsh-workspace-summary:compat-session', kind: 'dsh-workspace-summary', id: 'compat-session',
    start: { event: summaryEvent, role: 'start', id: 'compat-session', summary }, state: summary,
  })
  rendered = workspaceSlots[0]({ node: summaryNode })
  assert.deepEqual(rendered.summary, summary)
  rendered.openWorkspace.action()
  assert.equal(opened, true)
  const typedClient = {
    async listDirectory() { return [] },
    async stat() { return { path: 'src/auth.py', kind: 'file' } },
    async preview() { previewCalls += 1; return { type: 'text', path: 'src/auth.py', renderer: 'ui-primitives', content: 'ok', truncated: false } },
    async readResource() { return new Uint8Array() },
    async gitStatus() { return [] },
    async diff() { return '' },
    async sessionFiles() { return [] },
    async workingSet() { return { entries: [], summary: { count: 0, unresolvedCount: 0 } } },
    async pinWorkingSet() {},
    async unpinWorkingSet() {},
    async clearWorkingSet() {},
    async sendWorkingSet() { sendCalls += 1 },
    async pinnedContext() {
      contextCalls += 1
      return { count: 0, capacity: 'available', capacityTokens: 500, admittedTokens: 0, availableBudgetTokens: 500, remainingTokens: 500, entries: [] }
    },
    async pinContext(path) {
      contextCalls += 1
      return {
        count: 1, capacity: 'available', capacityTokens: 500, admittedTokens: 12, availableBudgetTokens: 488, remainingTokens: 488,
        entries: [{ path, order: 0, sourceStatus: 'ready', status: 'ready', contentHash: `sha256:${'b'.repeat(64)}`, bytes: 48, estimatedTokens: 12, loadedAt: 1 }],
      }
    },
    async unpinContext() {
      contextCalls += 1
      return { count: 0, capacity: 'available', capacityTokens: 500, admittedTokens: 0, availableBudgetTokens: 500, remainingTokens: 500, entries: [] }
    },
    async clearContext() {
      contextCalls += 1
      return { count: 0, capacity: 'available', capacityTokens: 500, admittedTokens: 0, availableBudgetTokens: 500, remainingTokens: 500, entries: [] }
    },
  }
  const controller = workspace.createWorkspaceDrawerController(typedClient)
  await controller.dispatch({ type: 'select-file', path: 'src/auth.py' })
  await controller.dispatch({ type: 'send-working-set' })
  await controller.dispatch({ type: 'inspect-pinned-context' })
  await controller.dispatch({ type: 'pin-context', path: 'src/auth.py' })
  assert.equal(controller.getState().pinnedContext.count, 1)
  assert.equal('content' in controller.getState().pinnedContext.entries[0], false)
  await controller.dispatch({ type: 'clear-context' })
  assert.equal(previewCalls, 1)
  assert.equal(sendCalls, 1)
  assert.equal(contextCalls, 3)
  assert.equal(controller.getState().pinnedContext.count, 0)
  await clientDispose()
  assert.equal(clientRemoteMounted, 0)
  assert.equal(clientRemoteDisposed, true)
  workspaceCleanup?.()
  assert.equal(workspaceDefinitions.length, 0)
  assert.equal(workspaceViews.length, 0)
  assert.equal(workspaceSlots.length, 0)
  return { definitions, views, workspaceDefinitions, workspaceViews, workspaceSlots, clientSlots }
}

async function main() {
  assert.match(SOURCE_REVISION, /^[0-9a-f]{40}$/)
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-compat-'))
  try {
    const lockfileSha256 = await installProfile(root)
    const { pluginRoot } = await createFixture(root)
    await buildFixture(root)
    const { consumer, lockfileSha256: consumerLockfileSha256 } = await installPackedBundle(root, pluginRoot)
    const { host, client, hostTypert, profileRoot } = await publicBundleSmoke(consumer)
    const { ctx, registry } = await gatewaySmoke(profileRoot, host, hostTypert)
    let endpoint
    let preview
    let conversation
    try {
      ({ endpoint, preview } = await webSmoke(profileRoot, host, ctx))
      conversation = await conversationSmoke(profileRoot, client, ctx)
    } finally {
      await ctx.fiber.dispose()
      assert.equal(registry.local.list().length, 0)
      assert.equal(conversation?.definitions.length ?? 0, 0)
      assert.equal(conversation?.views.length ?? 0, 0)
      assert.equal(conversation?.workspaceDefinitions.length ?? 0, 0)
      assert.equal(conversation?.workspaceViews.length ?? 0, 0)
      assert.equal(conversation?.workspaceSlots.length ?? 0, 0)
      assert.equal(conversation?.clientSlots.length ?? 0, 0)
      if (endpoint !== undefined) await assert.rejects(() => fetch(endpoint))
    }
    console.log(JSON.stringify({
      ok: true,
      // Metadata only: npm packages are resolved and checked independently.
      sourceRevisionDeclared: SOURCE_REVISION,
      sourceRepository: SOURCE_REPOSITORY,
      sourceBaseline: SOURCE_BASELINE_NOTE,
      profileLockfileSha256: lockfileSha256,
      consumerLockfileSha256,
      packages: PACKAGE_VERSIONS,
    }))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

await main()

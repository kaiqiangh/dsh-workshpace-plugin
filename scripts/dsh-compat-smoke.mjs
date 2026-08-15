import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const exec = promisify(execFile)
const SOURCE_REVISION = '47f943859bef60e4160492346772ded9b24f765a'
const SOURCE_REPOSITORY = 'https://github.com/deepseek-ai/deepseek-harness.git'
const SOURCE_BASELINE_NOTE = 'ADR-0003 pinned baseline declaration'
const PACKAGE_VERSIONS = {
  '@deepseek-ai/cordis': '4.0.1',
  '@deepseek-ai/dsh-api-gateway': '0.1.0-rc.6',
  '@deepseek-ai/dsh-agent': '0.1.0-rc.6',
  '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
  '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6',
  '@deepseek-ai/dsh-host-webserver': '0.1.0-rc.6',
  '@deepseek-ai/dsh-system-prompt': '0.1.0-rc.6',
  '@deepseek-ai/dsh-token-meter': '0.1.0-rc.6',
  '@deepseek-ai/dsh-typert-generator': '0.1.0-rc.6',
  '@deepseek-ai/dsh-typert-protocol': '0.1.0-rc.6',
  '@deepseek-ai/dsh-typert-registry': '0.1.0-rc.6',
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
  const compatTypesRoot = join(root, 'packages/compat-types')
  await mkdir(join(pluginRoot, 'src/web'), { recursive: true })
  await mkdir(join(pluginRoot, 'src/domain'), { recursive: true })
  await mkdir(compatTypesRoot, { recursive: true })
  await cp(join(process.cwd(), 'src/web/workspace-conversation.ts'), join(pluginRoot, 'src/web/workspace-conversation.ts'))
  await cp(join(process.cwd(), 'src/web/workspace-drawer.ts'), join(pluginRoot, 'src/web/workspace-drawer.ts'))
  await cp(join(process.cwd(), 'src/domain/path.ts'), join(pluginRoot, 'src/domain/path.ts'))
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
      paths: {
        '@deepseek-ai/dsh-typert-protocol': ['./packages/protocol/lib/types/index.d.ts'],
        '@deepseek-ai/dsh-typert-protocol/types': ['./packages/protocol/lib/types/types.d.ts'],
        '@fixture/plugin': ['./packages/plugin/src/index.ts'],
        '@fixture/plugin/*': ['./packages/plugin/src/*'],
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
    },
  })
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
  await writeJson(join(pluginRoot, 'package.json'), {
    name: '@fixture/plugin',
    version: '0.0.0-smoke',
    private: true,
    type: 'module',
    dsh: { client: { inject: [], platform: 'web', immediately: true } },
    exports: {
      '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
      './types': { types: './lib/types/types.d.ts', default: './lib/types/types.js' },
      './client': { types: './lib/types/client.d.ts', default: './lib/client.js' },
      './client/typert': { types: './lib/typert.client.d.ts', default: './lib/typert.client.js' },
      './typert': { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' },
      './remote': { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' },
      './package.json': './package.json',
    },
    files: [
      'lib/index.js', 'lib/client.js',
      'lib/typert.host.js', 'lib/typert.host.d.ts',
      'lib/typert.client.js', 'lib/typert.client.d.ts',
      'lib/typert.remote-client.js', 'lib/typert.remote-client.d.ts',
    ],
  })
  await writeJson(join(pluginRoot, 'tsconfig.json'), {
    extends: '../../tsconfig.base.json',
    compilerOptions: { rootDir: 'src', outDir: 'lib/types', noEmit: true },
    include: ['src'],
  })
  await writeText(join(pluginRoot, 'src/types.ts'), "import type { SessionId } from '@deepseek-ai/dsh-session'\nexport type AgentId = SessionId\n")
  await writeText(join(pluginRoot, 'src/index.ts'), `
import { Remote, RemoteScope, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Context, } from '@deepseek-ai/cordis'
import type { TypertContext } from '@deepseek-ai/dsh-typert-protocol'
import type { AgentId } from './types.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertContextMap { agent: TypertContext<AgentId> }
}

export class WorkspaceService extends TypertRemoteService {
  constructor(ctx: Context) { super(ctx, 'workspace') }

  @Remote
  summary(agent: AgentId): { readonly ready: boolean; readonly agent: AgentId } {
    return { ready: true, agent }
  }

  @RemoteScope('agent')
  focus(): { readonly focused: boolean } {
    return { focused: true }
  }
}

export type { AgentId } from './types.ts'
`)
  await writeText(join(compatTypesRoot, 'compat.ts'), `
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { PromptContext } from '@deepseek-ai/dsh-system-prompt'

export function registerPinnedContext(agent: Agent, context: PromptContext): () => void {
  return agent.ctx.systemPrompt.context(context)
}
`)
  await writeJson(join(root, 'tsconfig.compat-types.json'), {
    extends: './tsconfig.base.json',
    compilerOptions: { noEmit: true },
    files: ['packages/compat-types/compat.ts'],
  })
  await writeText(join(pluginRoot, 'src/client.ts'), `
import { Service, type Context } from '@deepseek-ai/cordis'
import { applyWorkspaceConversationContribution, createWorkspaceDrawerController, workspaceConversationDefinition as workspaceContributionDefinition, workspaceConversationView as workspaceContributionView } from './web/workspace-conversation.ts'

export const workspaceClient = { ready: true }

export const fixtureConversationDefinition = {
  kind: 'workspace-summary', target: 'chat',
  match: (event: any) => event.type === 'workspace/summary' ? { id: String(event.data.id), role: 'start' } : null,
  start: (_context: any, match: any) => ({ summary: match.event.data.summary }),
  update: (context: any) => context.state,
  buildViewNode: (context: any) => ({ key: context.key, kind: context.kind, id: context.id, target: 'chat', data: context.state }),
}

export const fixtureConversationView = {
  target: 'chat',
  create() {
    let snapshot: any = { order: [], nodes: new Map() }
    return {
      empty: snapshot,
      replace: ({ nodes }: any) => { snapshot = { order: nodes.map((node: any) => node.key), nodes: new Map(nodes.map((node: any) => [node.key, node])) }; return snapshot },
      apply: ({ upserts }: any) => { const nodes = new Map(snapshot.nodes); const order = [...snapshot.order]; for (const node of upserts as any[]) { if (!nodes.has(node.key)) order.push(node.key); nodes.set(node.key, node) }; snapshot = { order, nodes }; return snapshot },
    }
  },
}

export class ClientBridge extends Service {
  constructor(ctx: Context) { super(ctx, 'clientBridge') }
  reflect(value: string): string { return value }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    workspaceClient: typeof workspaceClient
    clientBridge: ClientBridge
  }
}

type ConversationContributionContext = Context & {
  conversationEvents?: { register(definition: typeof fixtureConversationDefinition): () => void }
  conversationViews?: { register(definition: typeof fixtureConversationView): () => void }
}

export function apply(ctx: ConversationContributionContext): void {
  ctx.provide('workspaceClient', workspaceClient)
  if (ctx.conversationEvents === undefined || ctx.conversationViews === undefined || typeof ctx.effect !== 'function') return
  const events = ctx.conversationEvents
  const views = ctx.conversationViews
  ctx.effect(() => {
    const disposeEvent = events.register(fixtureConversationDefinition)
    const disposeView = views.register(fixtureConversationView)
    return () => { disposeView(); disposeEvent() }
  }, 'workspace conversation contribution')
}

export { applyWorkspaceConversationContribution, createWorkspaceDrawerController, workspaceContributionDefinition as workspaceConversationDefinition, workspaceContributionView as workspaceConversationView }
`)
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
  dts: false, clean: false, external: ['@deepseek-ai/cordis'],
})
`)
  return { pluginRoot }
}

async function buildFixture(root) {
  const tsc = join(root, 'node_modules/typescript/bin/tsc')
  const tsdown = join(root, 'node_modules/tsdown/dist/run.mjs')
  await exec(process.execPath, [tsc, '-p', 'tsconfig.compat-types.json', '--pretty', 'false'], { cwd: root, stdio: 'inherit' })
  await exec(process.execPath, [tsc, '-b', 'tsconfig.host.json', '--pretty', 'false'], { cwd: root, stdio: 'inherit' })
  await exec(process.execPath, [tsdown, '--config', 'tsdown.host.config.mjs', '--tsconfig', 'tsconfig.bundle.json', '--no-report'], { cwd: root, stdio: 'inherit' })
  await exec(process.execPath, [tsdown, '--config', 'tsdown.client.config.mjs', '--tsconfig', 'tsconfig.bundle.json', '--no-report'], { cwd: root, stdio: 'inherit' })
}

async function installPackedBundle(root, pluginRoot) {
  const packDir = join(root, 'pack')
  await mkdir(packDir, { recursive: true })
  const packed = JSON.parse((await exec('npm', ['pack', '--json', '--pack-destination', packDir], { cwd: pluginRoot })).stdout)
  const tarball = join(packDir, packed[0].filename)
  const consumer = join(root, 'consumer')
  await writeJson(join(consumer, 'package.json'), { name: 'dsh-compat-consumer', private: true, type: 'module' })
  await exec('npm', [
    'install', '--ignore-scripts', '--no-fund', '--no-audit',
    tarball, ...npmSpecifiers,
  ], { cwd: consumer, stdio: 'inherit' })
  const lockText = await readFile(join(consumer, 'package-lock.json'), 'utf8')
  const lock = JSON.parse(lockText)
  assert.equal(lock.lockfileVersion, 3)
  for (const [name, expected] of Object.entries(PACKAGE_VERSIONS)) {
    const entry = lock.packages[`node_modules/${name}`]
    assert.equal(entry?.version, expected, `${name} must be pinned in consumer package-lock.json`)
  }
  await writeText(join(consumer, 'runtime.mjs'), `
const manifest = (await import('@fixture/plugin/package.json', { with: { type: 'json' } })).default
const host = await import('@fixture/plugin')
const client = await import('@fixture/plugin/client')
const hostTypert = await import('@fixture/plugin/typert')
const clientTypert = await import('@fixture/plugin/client/typert')
const remote = await import('@fixture/plugin/remote')
export { manifest, host, client, hostTypert, clientTypert, remote }
`)
  await writeText(join(consumer, 'check.mjs'), `
const { manifest, host, client, hostTypert, clientTypert, remote } = await import('./runtime.mjs')
if (manifest.dsh?.client?.platform !== 'web') throw new Error('missing web dsh.client metadata')
if (typeof manifest.exports?.['./client'] !== 'object') throw new Error('missing public ./client export')
if (typeof manifest.exports?.['./typert'] !== 'object') throw new Error('missing public ./typert export')
if (typeof manifest.exports?.['./client/typert'] !== 'object') throw new Error('missing public ./client/typert export')
if (typeof host.WorkspaceService !== 'function' || typeof client.apply !== 'function') throw new Error('public bundle entries did not load')
if (hostTypert.TYPERT.face !== 'host' || clientTypert.TYPERT.face !== 'client') throw new Error('generated face mismatch')
if (remote.TYPERT_REMOTE.descriptors.length === 0) throw new Error('missing remote contribution')
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
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(typeof manifest.exports['./client'], 'object')
  assert.equal(typeof manifest.exports['./typert'], 'object')
  assert.equal(typeof manifest.exports['./client/typert'], 'object')
  assert.equal(typeof host.WorkspaceService, 'function')
  assert.equal(typeof client.apply, 'function')
  assert.equal(hostTypert.TYPERT.face, 'host')
  assert.equal(clientTypert.TYPERT.face, 'client')
  assert.ok(remote.TYPERT_REMOTE.descriptors.length > 0)
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
    wireTypeSymbol: '@fixture/plugin/types#AgentId',
    resolve: id => id === 'agent-1' ? scoped : undefined,
  })
  ctx.typert.register(hostTypert.TYPERT)
  const result = await ctx.typertGateway.invoke({
    namespace: 'workspace', method: 'focus', args: { agentId: 'agent-1' },
  })
  assert.deepEqual(result, { focused: true })
  assert.equal(ctx.typert.local.list().length, 2)
  return { ctx, registry: ctx.typert }
}

async function webSmoke(root, ctx) {
  const WebServer = (await import(pathToFileURL(join(root, 'node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js')).href)).default
  const webFiber = ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  await webFiber
  const resource = {
    id: 'opaque-session-bound', session: 'session-1', root: 'root-1',
    body: Buffer.from('bounded-resource'), type: 'application/octet-stream',
  }
  const endpoint = `http://127.0.0.1:${ctx.webServer.port}/workspace/resource`
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/workspace/resource',
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const requestedType = url.searchParams.get('type')
      if (url.searchParams.get('id') !== resource.id
        || requestedType !== resource.type
        || req.headers['x-dsh-session'] !== resource.session
        || req.headers['x-dsh-root'] !== resource.root
        || resource.body.byteLength > 1024) {
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, { 'content-type': resource.type, 'content-length': resource.body.byteLength })
      res.end(resource.body.subarray(0, 1024))
    },
  }), 'workspace opaque resource route')
  const authorized = await fetch(`${endpoint}?id=${resource.id}&type=${encodeURIComponent(resource.type)}`, {
    headers: { 'x-dsh-session': resource.session, 'x-dsh-root': resource.root },
  })
  assert.equal(authorized.status, 200)
  assert.equal(authorized.headers.get('content-type'), resource.type)
  assert.ok(Number(authorized.headers.get('content-length')) <= 1024)
  assert.equal(await authorized.text(), 'bounded-resource')
  const tampered = await fetch(`${endpoint}?id=tampered&type=${encodeURIComponent(resource.type)}`, {
    headers: { 'x-dsh-session': resource.session, 'x-dsh-root': resource.root },
  })
  assert.equal(tampered.status, 404)
  const wrongType = await fetch(`${endpoint}?id=${resource.id}&type=text/plain`, {
    headers: { 'x-dsh-session': resource.session, 'x-dsh-root': resource.root },
  })
  assert.equal(wrongType.status, 404)
  const replaced = resource.root
  resource.root = 'root-replaced'
  const staleIdentity = await fetch(`${endpoint}?id=${resource.id}&type=${encodeURIComponent(resource.type)}`, {
    headers: { 'x-dsh-session': resource.session, 'x-dsh-root': replaced },
  })
  assert.equal(staleIdentity.status, 404)
  return { endpoint }
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
  const contribution = ctx.extend({
    conversationEvents: { register(definition) { definitions.push(definition); return () => definitions.splice(definitions.indexOf(definition), 1) } },
    conversationViews: { register(view) { views.push(view); return () => views.splice(views.indexOf(view), 1) } },
  })
  client.apply(contribution)
  assert.equal(definitions.length, 1)
  assert.equal(views.length, 1)
  const events = { entries: () => definitions, fallbackEntry: () => undefined }
  const viewDefinitions = { entries: () => views }
  const assembler = new ConversationNodeAssembler(events, viewDefinitions)
  const input = { event: { seq: 1, time: 1, type: 'workspace/summary', data: { id: 'summary-1', summary: 'ready' }, ignorable: true }, view: undefined }
  assembler.replaceWindow([input], false)
  assembler.flush()
  const first = assembler.snapshot('chat')
  assembler.replaceWindow([input], false)
  assembler.flush()
  const replayed = assembler.snapshot('chat')
  assert.deepEqual([...first.nodes.keys()], [...replayed.nodes.keys()])
  assert.deepEqual([...first.nodes.values()].map(node => node.data), [...replayed.nodes.values()].map(node => node.data))

  const workspace = client
  assert.equal(typeof workspace.applyWorkspaceConversationContribution, 'function', 'packed Client must export the Workspace Web contribution')
  assert.equal(typeof workspace.createWorkspaceDrawerController, 'function', 'packed Client must export typed Workspace operations')
  const workspaceDefinitions = []
  const workspaceViews = []
  const workspaceSlots = []
  let workspaceCleanup
  let opened = false
  let previewCalls = 0
  let sendCalls = 0
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
        assert.deepEqual(options, { name: 'conversation.chat.node', key: 'dsh-workspace-summary' })
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
  assert.deepEqual(summaryMatch, { id: 'compat-session', role: 'start' })
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
  }
  const controller = workspace.createWorkspaceDrawerController(typedClient)
  await controller.dispatch({ type: 'select-file', path: 'src/auth.py' })
  await controller.dispatch({ type: 'send-working-set' })
  assert.equal(previewCalls, 1)
  assert.equal(sendCalls, 1)
  workspaceCleanup?.()
  assert.equal(workspaceDefinitions.length, 0)
  assert.equal(workspaceViews.length, 0)
  assert.equal(workspaceSlots.length, 0)
  return { definitions, views, workspaceDefinitions, workspaceViews, workspaceSlots }
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
    let conversation
    try {
      ({ endpoint } = await webSmoke(profileRoot, ctx))
      conversation = await conversationSmoke(profileRoot, client, ctx)
    } finally {
      await ctx.fiber.dispose()
      assert.equal(registry.local.list().length, 0)
      assert.equal(conversation?.definitions.length ?? 0, 0)
      assert.equal(conversation?.views.length ?? 0, 0)
      assert.equal(conversation?.workspaceDefinitions.length ?? 0, 0)
      assert.equal(conversation?.workspaceViews.length ?? 0, 0)
      assert.equal(conversation?.workspaceSlots.length ?? 0, 0)
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

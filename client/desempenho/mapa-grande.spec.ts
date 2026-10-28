// HARNESS DE DESEMPENHO DO MAPA GRANDE (27/10/2026).
//
// Queixa do usuário: "estou tendo um grande gargalo em mapas 200x200, meu
// amigo ta travando demais" — "tudo parece que fica a 5 fps" (abrir, arrastar
// e dar zoom, mover ficha, revelar névoa e parado). Este spec mede isso.
//
// COMO RODA: `node scripts/medir-desempenho.cjs` (faz o build de produção com
// a sonda, sobe o `vite preview` e passa os casos por `LAB_DES_CASOS`). Cada
// caso grava uma linha JSON em `LAB_DES_SAIDA`.
//
// A MESA DE VERDADE, não um pedaço dela:
// - MESTRE: o app inteiro no navegador com o Tauri de mentira (disco em
//   memória, como `e2e/task-jogador-periodo-da-cena.spec.ts`), abrindo o mapa
//   pelo "Carregar Mapa existente". Com a sala aberta, o `hostBridge` REAL do
//   mestre calcula o recorte de cada jogador: o custo de mandar o mapa ao
//   amigo cai na thread do mestre, como na mesa.
// - JOGADOR: o `player.html` inteiro, ligado ao mestre por `routeWebSocket`
//   (o servidor axum vira um repasse: o que o jogador manda chega ao mestre
//   como `net:message`, o que o mestre manda com `net_send` chega ao jogador).
//
// O QUE SAI POR CENÁRIO: fps (quadros/s do requestAnimationFrame), quadro
// p50/p95/p99/máximo em ms, tarefas longas >= 50 ms (quantas e a maior), CPU
// da thread principal (ms por segundo, CDP `Performance.getMetrics`),
// chamadas de desenho do WebGL por quadro (o render redesenha parado?) e,
// com `perfil`, as 15 funções de maior tempo próprio (CDP `Profiler`) numa
// SEGUNDA passada do mesmo cenário (o perfil pesa e não entra nos números).
//
// O que NÃO é: portão. Nada aqui reprova por número; reprova só se a mesa não
// abrir. As metas entram quando a otimização tiver alvo.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { test, type Browser, type BrowserContext, type CDPSession, type Page, type WebSocketRoute } from '@playwright/test'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'
import { mapaSintetico, zonasOcultasPara } from './mapaSintetico'
import { conferirMetasF5 } from './metas-f5'
import { conferirMetasF4 } from './metas-f4'

// ---------------------------------------------------------------- casos

interface Caso {
  id: string
  mapa: 'real' | 'sintetico'
  /** Lado do sintético em casas. */
  lado?: number
  obra: 'meio-termo' | 'linhas'
  tela: { largura: number; altura: number; dpr: number }
  perfil: boolean
  /** `mestre`: só a fase do mestre sozinho; `mesa`: mestre sozinho e depois a mesa com o jogador. */
  fases: 'mestre' | 'mesa'
}

const CASO_PADRAO: Caso = { id: 'real-mt-1080', mapa: 'real', obra: 'meio-termo', tela: { largura: 1920, altura: 1080, dpr: 1 }, perfil: false, fases: 'mesa' }
const CASOS: Caso[] = process.env.LAB_DES_CASOS ? (JSON.parse(process.env.LAB_DES_CASOS) as Caso[]) : [CASO_PADRAO] // as: o JSON vem do scripts/medir-desempenho.cjs, que monta a lista
const SAIDA = process.env.LAB_DES_SAIDA ?? ''
const MAPA_REAL = process.env.LAB_DES_MAPA_REAL ?? ''

const AVENTURA = 'Mesa de medida'
const PASTA = 'C:/appdata/maps/map_medida'
const CODIGO = 'MEDE01'
const JOGADOR = 'Ana'
const NPC = 'npc-medida'

// ---------------------------------------------------------------- mapa

function mapaDoCaso(caso: Caso): { map: MapData; fichaDoJogador: Token; npc: Token } {
  let map: MapData
  if (caso.mapa === 'real') {
    map = JSON.parse(readFileSync(MAPA_REAL, 'utf8')) as MapData // as: o arquivo do usuário, no formato do disco
    map = { ...map, concealZones: [...(map.concealZones ?? []), ...zonasOcultasPara(map)] }
  } else map = mapaSintetico({ lado: caso.lado ?? 200 })
  // `npc`: a ficha que o MESTRE arrasta, a primeira do mapa (no real, "Saga", marcada NPC).
  const npc = map.tokens[0]
  if (npc === undefined) throw new Error('o mapa não tem ficha')
  // A ficha do JOGADOR (o real só tem uma, e NPC não ganha botão de atribuir): três casas à direita, à vista dele.
  const fichaDoJogador: Token = { id: NPC, characterId: null, name: 'Guarda', x: npc.x + 3 * map.grid, y: npc.y, size: 1, image: null }
  map = { ...map, tokens: [...map.tokens.filter((t) => t.id !== NPC), fichaDoJogador] }
  return { map, fichaDoJogador, npc }
}

/** Os segmentos se cruzam? (orientação; encostar não conta) */
function cruza(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }): boolean {
  const o = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

/** Primeira das 8 direções em que andar `distancia` a partir de `de` não atravessa parede que bloqueia passo. */
function rumoLivre(map: MapData, de: { x: number; y: number }, distancia: number): { x: number; y: number } {
  const limite = { x: map.width * map.grid, y: map.height * map.grid }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const n = Math.hypot(dx, dy)
    const passo = { x: Math.round((dx / n) * distancia), y: Math.round((dy / n) * distancia) }
    const para = { x: de.x + passo.x, y: de.y + passo.y }
    if (para.x < 0 || para.y < 0 || para.x > limite.x || para.y > limite.y) continue
    const bloqueia = map.walls.some((w) => w.blocksMove !== false && cruza(de, para, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }))
    if (!bloqueia) return passo
  }
  return { x: distancia, y: 0 }
}

function disco(map: MapData): Record<string, string> {
  const aventura = { version: 1, id: 'adv_medida', name: AVENTURA, startSceneId: 'scene_medida', scenes: [{ id: 'scene_medida', name: AVENTURA, file: 'map.json' }] }
  // A lista do "Carregar Mapa" mostra o nome do MAPA: ele leva o nome da aventura para o clique achar.
  return { [`${PASTA}/map.json`]: serializeMap({ ...map, name: AVENTURA }), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

// ---------------------------------------------------------------- coletor na página

interface Des {
  quadros: number[]
  draws: number[]
  longas: number[][]
  cliques: number[]
  canvas: number[]
  mensagens: Array<[number, string, number]>
}
interface Janela {
  __des: Des
  __labSonda?: Record<string, unknown>
}

/** Roda antes de qualquer script da página: quadros, desenhos do WebGL, tarefas longas, cliques, canvas e mensagens da rede. */
function coletor(): void {
  const des: Des = { quadros: [], draws: [], longas: [], cliques: [], canvas: [], mensagens: [] }
  ;(window as unknown as Janela).__des = des // as: campo nosso pendurado no window
  let draws = 0
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype] as unknown as Array<Record<string, unknown>>) {
    for (const nome of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = proto[nome]
      if (typeof original !== 'function') continue
      proto[nome] = function (this: unknown, ...args: unknown[]) {
        draws++
        return (original as (...a: unknown[]) => unknown).apply(this, args)
      }
    }
  }
  const laco = (t: number) => {
    des.quadros.push(t)
    des.draws.push(draws)
    draws = 0
    if (des.quadros.length > 40000) {
      des.quadros.splice(0, 20000)
      des.draws.splice(0, 20000)
    }
    requestAnimationFrame(laco)
  }
  requestAnimationFrame(laco)
  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) des.longas.push([e.startTime, e.duration])
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    // sem a API: a contagem de tarefas longas sai vazia
  }
  document.addEventListener('click', () => des.cliques.push(performance.now()), true)
  new MutationObserver((mudancas) => {
    for (const m of mudancas) for (const n of Array.from(m.addedNodes)) if (n instanceof HTMLCanvasElement || (n instanceof Element && n.querySelector('canvas'))) des.canvas.push(performance.now())
  }).observe(document, { childList: true, subtree: true })
  // As mensagens da rede são contadas no Node, no repasse (`fio`): o `routeWebSocket` do Playwright troca o WebSocket da página.
}

/** O Tauri de mentira do mestre (disco em memória e `net_send` repassado ao jogador). Igual ao de task-jogador-periodo-da-cena.spec.ts. */
function tauriDeMentira({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }): void {
  type Handler = (evento: { event: string; id: number; payload: unknown }) => void
  const alvo = window as unknown as Record<string, unknown> // as: os campos do Tauri de mentira são escritos logo abaixo
  const textos: Record<string, string> = { ...arquivos }
  const pastas = new Set<string>()
  const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
  const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
  const callbacks = new Map<number, Handler>()
  const ouvintes = new Map<number, { event: string; handler: Handler }>()
  let proximoId = 1
  alvo.isTauri = true
  alvo.__emitTauri = (event: string, payload: unknown) => {
    for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
  }
  alvo.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    convertFileSrc: (caminho: string) => String(caminho),
    transformCallback: (cb: Handler) => {
      const id = proximoId
      proximoId += 1
      callbacks.set(id, cb)
      return id
    },
    invoke: async (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => {
      const a = (args ?? {}) as Record<string, unknown> // o invoke do Tauri manda objeto de argumentos
      switch (cmd) {
        case 'net_start_room':
          return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
        case 'net_send':
          ;(alvo.__labParaJogador as (c: string, t: string) => void)(String(a.clientId), JSON.stringify(a.msg))
          return null
        case 'plugin:event|listen': {
          const id = Number(a.handler)
          const cb = callbacks.get(id)
          if (cb) ouvintes.set(id, { event: String(a.event), handler: cb })
          return id
        }
        case 'plugin:event|unlisten':
          ouvintes.delete(Number(a.eventId))
          return null
        case 'plugin:path|resolve_directory':
          return 'C:/appdata'
        case 'plugin:path|join':
          return (a.paths as string[]).join('/') // o plugin path manda `paths` como lista de texto
        case 'plugin:path|dirname': {
          const p = String(a.path)
          return p.slice(0, Math.max(0, p.lastIndexOf('/')))
        }
        case 'plugin:fs|exists': {
          const c = semBarraFinal(String(a.path))
          return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
        }
        case 'plugin:fs|mkdir':
          pastas.add(semBarraFinal(String(a.path)))
          return null
        case 'plugin:fs|write_text_file':
          textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array) // o plugin fs grava o texto como bytes no corpo
          return null
        case 'plugin:fs|read_text_file': {
          const caminho = String(a.path)
          if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
          return Array.from(new TextEncoder().encode(textos[caminho]))
        }
        case 'plugin:fs|read_dir': {
          const prefixo = `${semBarraFinal(String(a.path))}/`
          const filhos = new Map<string, boolean>()
          for (const p of todos()) {
            if (p.indexOf(prefixo) !== 0) continue
            const resto = p.slice(prefixo.length)
            if (resto.length === 0) continue
            const corte = resto.indexOf('/')
            const nome = corte === -1 ? resto : resto.slice(0, corte)
            filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1 || pastas.has(p))
          }
          return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
        }
        default:
          return null
      }
    },
  }
}

// ---------------------------------------------------------------- medida

interface Medida {
  cenario: string
  papel: 'mestre' | 'jogador'
  duracao_ms: number
  quadros: number
  fps: number
  quadro_p50_ms: number
  quadro_p95_ms: number
  quadro_p99_ms: number
  quadro_max_ms: number
  longas_n: number
  longas_max_ms: number
  longas_total_ms: number
  cpu_ms_por_s: number
  script_ms_por_s: number
  draws_por_quadro_p50: number
  quadros_com_desenho_pct: number
  mensagens: Record<string, { n: number; bytes: number }>
  extra?: Record<string, unknown>
  perfil?: Quente[]
  perfil_gc_ms?: number
  perfil_amostrado_ms?: number
}

interface Quente {
  funcao: string
  onde: string
  proprio_ms: number
  pct: number
}

const r1 = (n: number): number => Math.round(n * 10) / 10
const pct = (ordenado: number[], p: number): number => (ordenado.length === 0 ? 0 : ordenado[Math.min(ordenado.length - 1, Math.floor((ordenado.length - 1) * p))])

interface Medidor {
  page: Page
  papel: 'mestre' | 'jogador'
  cdp: CDPSession
}

async function metricas(cdp: CDPSession): Promise<Map<string, number>> {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return new Map(metrics.map((m) => [m.name, m.value]))
}

async function agora(page: Page): Promise<number> {
  return page.evaluate(() => performance.now())
}

/** Lê do coletor o que caiu na janela [de, ate] (relógio da página). */
async function janelaDaPagina(page: Page, de: number, ate: number) {
  return page.evaluate(
    ([a, b]) => {
      const des = (window as unknown as Janela).__des // as: o coletor pendurou no window
      const idx: number[] = []
      des.quadros.forEach((t, i) => {
        if (t >= a && t <= b) idx.push(i)
      })
      const intervalos: number[] = []
      const draws: number[] = []
      for (let k = 1; k < idx.length; k++) {
        intervalos.push(des.quadros[idx[k]] - des.quadros[idx[k - 1]])
        draws.push(des.draws[idx[k]])
      }
      const longas = des.longas.filter(([t]) => t >= a && t <= b).map(([, d]) => d)
      return { intervalos, draws, longas }
    },
    [de, ate],
  )
}

/** Mede `acao` em todas as páginas de `medidores` ao mesmo tempo (relógios separados, mesma janela de parede). */
async function medir(nome: string, medidores: Medidor[], acao: () => Promise<Record<string, unknown> | void>): Promise<Medida[]> {
  const inicio = await Promise.all(medidores.map(async (m) => ({ t: await agora(m.page), met: await metricas(m.cdp) })))
  const extra = (await acao()) ?? undefined
  const fim = await Promise.all(medidores.map(async (m) => ({ t: await agora(m.page), met: await metricas(m.cdp) })))
  const saida: Medida[] = []
  for (let i = 0; i < medidores.length; i++) {
    const { page, papel } = medidores[i]
    const j = await janelaDaPagina(page, inicio[i].t, fim[i].t)
    const dur = fim[i].t - inicio[i].t
    const delta = (n: string) => ((fim[i].met.get(n) ?? 0) - (inicio[i].met.get(n) ?? 0)) * 1000
    const ordenado = [...j.intervalos].sort((a, b) => a - b)
    const drawsOrd = [...j.draws].sort((a, b) => a - b)
    saida.push({
      cenario: nome,
      papel,
      duracao_ms: Math.round(dur),
      quadros: j.intervalos.length,
      fps: r1((j.intervalos.length * 1000) / Math.max(1, j.intervalos.reduce((s, v) => s + v, 0))),
      quadro_p50_ms: r1(pct(ordenado, 0.5)),
      quadro_p95_ms: r1(pct(ordenado, 0.95)),
      quadro_p99_ms: r1(pct(ordenado, 0.99)),
      quadro_max_ms: r1(ordenado[ordenado.length - 1] ?? 0),
      longas_n: j.longas.length,
      longas_max_ms: r1(Math.max(0, ...j.longas)),
      longas_total_ms: r1(j.longas.reduce((s, v) => s + v, 0)),
      cpu_ms_por_s: r1((delta('TaskDuration') * 1000) / Math.max(1, dur)),
      script_ms_por_s: r1((delta('ScriptDuration') * 1000) / Math.max(1, dur)),
      draws_por_quadro_p50: pct(drawsOrd, 0.5),
      quadros_com_desenho_pct: r1((100 * j.draws.filter((d) => d > 0).length) / Math.max(1, j.draws.length)),
      mensagens: {},
      ...(extra === undefined ? {} : { extra }),
    })
  }
  return saida
}

// ---------------------------------------------------------------- perfil de CPU

interface NoDoPerfil {
  id: number
  callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number }
}
interface Perfil {
  nodes: NoDoPerfil[]
  samples?: number[]
  timeDeltas?: number[]
}

type Mapeador = (url: string, linha: number, coluna: number) => Promise<string>

/** Traduz url:linha:coluna do bundle para arquivo:linha da fonte pelo `.map` do build (só produção; no dev a url já é o arquivo). */
function criarMapeador(): Mapeador {
  const cache = new Map<string, Promise<((l: number, c: number) => string) | null>>()
  const carregar = async (url: string) => {
    try {
      const resposta = await fetch(`${url}.map`)
      if (!resposta.ok) return null
      const { TraceMap, originalPositionFor } = await import('@jridgewell/trace-mapping')
      const mapa = new TraceMap((await resposta.text()) as unknown as ConstructorParameters<typeof TraceMap>[0]) // as: o texto JSON do .map, que o TraceMap aceita
      return (l: number, c: number) => {
        const p = originalPositionFor(mapa, { line: l + 1, column: c })
        return p.source === null ? '' : `${p.source.replace(/^(\.\.\/)+/, '').replace(/^.*?\/src\//, 'src/')}:${p.line ?? 0}`
      }
    } catch {
      return null
    }
  }
  return async (url, linha, coluna) => {
    const curto = url.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '')
    if (!/\/assets\/[^/]+\.js$/.test(url)) return `${curto}:${linha + 1}`
    if (!cache.has(url)) cache.set(url, carregar(url))
    const traduz = await cache.get(url)
    const fonte = traduz?.(linha, coluna) ?? ''
    return fonte === '' ? `${curto}:${linha + 1}` : fonte
  }
}

async function resumirPerfil(perfil: Perfil, mapear: Mapeador): Promise<{ quentes: Quente[]; gc: number; total: number }> {
  const porNo = new Map<number, number>()
  const amostras = perfil.samples ?? []
  const deltas = perfil.timeDeltas ?? []
  for (let i = 0; i < amostras.length; i++) porNo.set(amostras[i], (porNo.get(amostras[i]) ?? 0) + (deltas[i] ?? 0) / 1000)
  const porFuncao = new Map<string, { funcao: string; url: string; linha: number; coluna: number; ms: number }>()
  let gc = 0
  let total = 0
  for (const no of perfil.nodes) {
    const ms = porNo.get(no.id) ?? 0
    if (ms === 0) continue
    const { functionName, url, lineNumber, columnNumber } = no.callFrame
    if (functionName === '(idle)') continue
    total += ms
    if (functionName === '(garbage collector)') gc += ms
    const chave = `${functionName}|${url}|${lineNumber}|${columnNumber}`
    const atual = porFuncao.get(chave) ?? { funcao: functionName || '(anônima)', url, linha: lineNumber, coluna: columnNumber, ms: 0 }
    atual.ms += ms
    porFuncao.set(chave, atual)
  }
  const top = [...porFuncao.values()].sort((a, b) => b.ms - a.ms).slice(0, 15)
  const quentes: Quente[] = []
  for (const f of top) quentes.push({ funcao: f.funcao, onde: f.url === '' ? '(nativo)' : await mapear(f.url, f.linha, f.coluna), proprio_ms: r1(f.ms), pct: r1((100 * f.ms) / Math.max(1, total)) })
  return { quentes, gc: r1(gc), total: r1(total) }
}

/** Repete `acao` com o Profiler ligado em todas as páginas e pendura o resumo nas medidas da primeira passada. */
async function perfilar(medidas: Medida[], medidores: Medidor[], mapear: Mapeador, acao: () => Promise<unknown>): Promise<void> {
  for (const m of medidores) {
    await m.cdp.send('Profiler.enable')
    await m.cdp.send('Profiler.setSamplingInterval', { interval: 500 })
    await m.cdp.send('Profiler.start')
  }
  await acao()
  for (const m of medidores) {
    const { profile } = await m.cdp.send('Profiler.stop')
    const resumo = await resumirPerfil(profile as Perfil, mapear)
    const alvo = medidas.find((x) => x.papel === m.papel)
    if (alvo !== undefined) {
      alvo.perfil = resumo.quentes
      alvo.perfil_gc_ms = resumo.gc
      alvo.perfil_amostrado_ms = resumo.total
    }
  }
}

// ---------------------------------------------------------------- Pixi e câmera

/** Texturas do Pixi (GPU) e nós da cena, pela sonda. */
async function memoriaDaGpu(page: Page, chave: 'appMestre' | 'appJogador') {
  return page.evaluate((k) => {
    type Fonte = { pixelWidth?: number; pixelHeight?: number; label?: string; resource?: unknown }
    type No = { children?: No[] }
    const sonda = (window as unknown as Janela).__labSonda // as: a sonda do app (src/lib/sondaDeDesempenho.ts)
    const app = sonda?.[k] as { renderer: { texture: { managedTextures: Fonte[] }; resolution: number; width: number; height: number; name?: string }; stage: No } | undefined // as: o Application do Pixi pendurado pela sonda
    if (app === undefined) return null
    const fontes = app.renderer.texture.managedTextures.filter((s) => s !== null && s !== undefined)
    const tamanhos = fontes.map((s) => ({ px: (s.pixelWidth ?? 0) * (s.pixelHeight ?? 0), dim: `${s.pixelWidth}x${s.pixelHeight}`, rotulo: s.label ?? (s.resource as { constructor?: { name?: string } } | undefined)?.constructor?.name ?? '' }))
    const px = tamanhos.reduce((s, t) => s + t.px, 0)
    let nos = 0
    const andar = (n: No) => {
      nos++
      for (const f of n.children ?? []) andar(f)
    }
    andar(app.stage)
    return {
      texturas: fontes.length,
      megapixels: Math.round(px / 1e4) / 100,
      mb_rgba: Math.round((px * 4) / 1048576),
      maiores: tamanhos
        .sort((a, b) => b.px - a.px)
        .slice(0, 6)
        .map((t) => `${t.dim}${t.rotulo ? ` ${t.rotulo}` : ''}`),
      nos_na_cena: nos,
      resolucao: app.renderer.resolution,
      backbuffer: `${app.renderer.width}x${app.renderer.height}`,
    }
  }, chave)
}

/** Onde um ponto do mundo está na tela (px CSS da página), pelo `world` do Pixi (primeiro filho do palco nas duas telas). */
async function naTela(page: Page, chave: 'appMestre' | 'appJogador', x: number, y: number): Promise<{ x: number; y: number; escala: number }> {
  return page.evaluate(
    ({ k, x, y }) => {
      type Mundo = { toGlobal: (p: { x: number; y: number }) => { x: number; y: number }; scale: { x: number } }
      const app = (window as unknown as Janela).__labSonda?.[k] as { stage: { children: Mundo[] }; canvas: HTMLCanvasElement } // as: o Application do Pixi pendurado pela sonda
      const mundo = app.stage.children[0]
      const p = mundo.toGlobal({ x, y })
      const r = app.canvas.getBoundingClientRect()
      return { x: r.left + p.x, y: r.top + p.y, escala: mundo.scale.x }
    },
    { k: chave, x, y },
  )
}

async function centroDoCanvas(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (caixa === null) throw new Error('canvas sem caixa')
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2, w: caixa.width, h: caixa.height }
}

const PASSO_DO_GESTO_MS = 16

/** Arrasta com `botao` seguindo `caminho(t)` (t de 0 a 1) por `duracao` ms. */
async function arrastar(page: Page, botao: 'left' | 'middle', caminho: (t: number) => { x: number; y: number }, duracao: number, pausaAntesDeSoltar = 0): Promise<void> {
  const p0 = caminho(0)
  await page.mouse.move(p0.x, p0.y)
  await page.mouse.down({ button: botao })
  const inicio = Date.now()
  for (;;) {
    const t = Math.min(1, (Date.now() - inicio) / duracao)
    const p = caminho(t)
    await page.mouse.move(p.x, p.y)
    if (t >= 1) break
    await page.waitForTimeout(PASSO_DO_GESTO_MS)
  }
  if (pausaAntesDeSoltar > 0) await page.waitForTimeout(pausaAntesDeSoltar)
  await page.mouse.up({ button: botao })
}

async function rodar(page: Page, ponto: { x: number; y: number }, delta: number, duracao: number): Promise<void> {
  await page.mouse.move(ponto.x, ponto.y)
  const inicio = Date.now()
  while (Date.now() - inicio < duracao) {
    await page.mouse.wheel(0, delta)
    await page.waitForTimeout(80)
  }
}

/** Aproxima com a roda no ponto até uma casa ocupar ~`alvo` px (a roda mantém o ponto sob o cursor). */
async function aproximarNa(page: Page, chave: 'appMestre' | 'appJogador', mundo: { x: number; y: number }, grade: number, alvo = 40): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const p = await naTela(page, chave, mundo.x, mundo.y)
    if (grade * p.escala >= alvo) return
    await page.mouse.move(p.x, p.y)
    await page.mouse.wheel(0, -100)
    await page.waitForTimeout(60)
  }
}

/** Mestre: traz o ponto ao centro com o botão do meio (passos de até 40% da tela) e aproxima nele com a roda. */
async function centrarEAproximar(page: Page, mundo: { x: number; y: number }, grade: number): Promise<void> {
  const c = await centroDoCanvas(page)
  for (let i = 0; i < 8; i++) {
    const p = await naTela(page, 'appMestre', mundo.x, mundo.y)
    const dx = Math.max(-c.w * 0.4, Math.min(c.w * 0.4, c.x - p.x))
    const dy = Math.max(-c.h * 0.4, Math.min(c.h * 0.4, c.y - p.y))
    if (Math.hypot(c.x - p.x, c.y - p.y) < 40) break
    await arrastar(page, 'middle', (t) => ({ x: c.x - dx / 2 + dx * t, y: c.y - dy / 2 + dy * t }), 250)
    await page.waitForTimeout(100)
  }
  await aproximarNa(page, 'appMestre', mundo, grade)
}

// ---------------------------------------------------------------- abrir

/** Espera o primeiro quadro com desenho depois do canvas e o "interativo": 10 quadros seguidos abaixo de 50 ms. */
async function esperarAbrir(page: Page, desde: number, tetoMs = 120_000): Promise<{ canvas_ms: number; primeiro_quadro_ms: number; interativo_ms: number }> {
  const fim = Date.now() + tetoMs
  for (;;) {
    const r = await page.evaluate((d) => {
      const des = (window as unknown as Janela).__des // as: o coletor pendurou no window
      const canvas = des.canvas.find((t) => t >= d)
      if (canvas === undefined) return null
      let primeiro: number | null = null
      let seguidos = 0
      for (let i = 1; i < des.quadros.length; i++) {
        const t = des.quadros[i]
        if (t < canvas) continue
        if (primeiro === null && des.draws[i] > 0) primeiro = t
        if (primeiro === null) continue
        seguidos = des.quadros[i] - des.quadros[i - 1] < 50 ? seguidos + 1 : 0
        if (seguidos >= 10) return { canvas_ms: canvas - d, primeiro_quadro_ms: primeiro - d, interativo_ms: des.quadros[i - 9] - d }
      }
      return null
    }, desde)
    if (r !== null) return { canvas_ms: r1(r.canvas_ms), primeiro_quadro_ms: r1(r.primeiro_quadro_ms), interativo_ms: r1(r.interativo_ms) }
    if (Date.now() > fim) throw new Error('a tela não ficou interativa no teto')
    await page.waitForTimeout(250)
  }
}

async function longasEntre(page: Page, de: number, ate: number): Promise<{ n: number; max_ms: number; total_ms: number }> {
  const longas = await page.evaluate(([a, b]) => (window as unknown as Janela).__des.longas.filter(([t]) => t >= a && t <= b).map(([, d]) => d), [de, ate]) // as: o coletor pendurou no window
  return { n: longas.length, max_ms: r1(Math.max(0, ...longas)), total_ms: r1(longas.reduce((s, v) => s + v, 0)) }
}

async function gpuDaPagina(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '?'
  })
}

// ---------------------------------------------------------------- o teste

const contextos: BrowserContext[] = []
const outrosNavegadores: Browser[] = []
test.afterEach(async () => {
  await Promise.all(contextos.splice(0).map((c) => c.close()))
  await Promise.all(outrosNavegadores.splice(0).map((b) => b.close()))
})

async function novoContexto(browser: Browser, caso: Caso, baseURL: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: caso.tela.largura, height: caso.tela.altura }, deviceScaleFactor: caso.tela.dpr })
  contextos.push(ctx)
  await ctx.addInitScript(coletor)
  return ctx
}

for (const caso of CASOS) {
  test(`desempenho ${caso.id}`, async ({ browser, baseURL }) => {
    if (baseURL === undefined) throw new Error('sem baseURL')
    test.skip(caso.mapa === 'real' && (MAPA_REAL === '' || !existsSync(MAPA_REAL)), `mapa real ausente (LAB_DES_MAPA_REAL=${MAPA_REAL})`)
    const { map, fichaDoJogador, npc } = mapaDoCaso(caso)
    const sufixo = caso.obra === 'linhas' ? '?obra=linhas' : ''
    const inicioDoCaso = Date.now()
    const marco = (texto: string) => console.log(`[${caso.id} ${((Date.now() - inicioDoCaso) / 1000).toFixed(1)}s] ${texto}`)
    const mapear = criarMapeador()
    const cenarios: Medida[] = []
    const registro: Record<string, unknown> = {
      caso,
      mapa: { nome: caso.mapa === 'real' ? 'mapa real do usuário (fora do repo)' : map.name, lado: `${map.width}x${map.height}`, grade: map.grid, paredes: map.walls.length, salas: map.regions.length, desenhos: map.drawings.length, texturas: map.texturas?.length ?? 0, carimbos: map.carimbos?.length ?? 0, penhascos: map.penhascos?.length ?? 0, fichas: map.tokens.length, zonas: map.concealZones.length, relevo: map.relevo === true },
    }

    // ---- MESTRE sozinho
    const ctxMestre = await novoContexto(browser, caso, baseURL)
    const enviados = { n: 0, bytes: 0 }
    /** Tudo o que o mestre mandou ao jogador: [ms do relógio do Node, tipo, bytes]. */
    const fio: Array<[number, string, number]> = []
    const sockets = new Map<string, WebSocketRoute>()
    await ctxMestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
      enviados.n += 1
      enviados.bytes += texto.length
      fio.push([Date.now(), /"type":"([^"]+)"/.exec(texto.slice(0, 80))?.[1] ?? '?', texto.length])
      sockets.get(clientId)?.send(texto)
    })
    const tallyDoFio = (desde: number): Record<string, { n: number; bytes: number }> => {
      const saida: Record<string, { n: number; bytes: number }> = {}
      for (const [, tipo, bytes] of fio.slice(desde)) {
        saida[tipo] ??= { n: 0, bytes: 0 }
        saida[tipo].n += 1
        saida[tipo].bytes += bytes
      }
      return saida
    }
    await ctxMestre.addInitScript(tauriDeMentira, { arquivos: disco(map), codigo: CODIGO })
    const mestre = await ctxMestre.newPage()
    const erros: string[] = []
    mestre.on('pageerror', (e) => erros.push(`mestre: ${e.message}`))
    await mestre.goto(`/${sufixo}`)
    marco('mestre: página aberta')
    registro.gpu = await gpuDaPagina(mestre)
    registro.dpr_real = await mestre.evaluate(() => window.devicePixelRatio)
    await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
    const antesDoClique = await agora(mestre)
    await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
    await mestre.waitForSelector('canvas', { timeout: 120_000 })
    const clique = (await mestre.evaluate((d) => (window as unknown as Janela).__des.cliques.find((t) => t >= d), antesDoClique)) ?? antesDoClique // as: o coletor pendurou no window
    marco('mestre: canvas montado')
    const abrirMestre = await esperarAbrir(mestre, clique)
    marco(`mestre: abriu ${JSON.stringify(abrirMestre)}`)
    registro.abrir_mestre = { ...abrirMestre, longas: await longasEntre(mestre, clique, clique + abrirMestre.interativo_ms) }
    registro.gpu_mestre_ao_abrir = await memoriaDaGpu(mestre, 'appMestre')
    const cdpMestre = await ctxMestre.newCDPSession(mestre)
    await cdpMestre.send('Performance.enable', { timeDomain: 'threadTicks' })
    const soMestre: Medidor[] = [{ page: mestre, papel: 'mestre', cdp: cdpMestre }]
    await mestre.evaluate(() => {
      const s = (window as unknown as Janela).__labSonda as { mapStore: { getState: () => { setActiveTool: (t: string) => void } } } // as: a sonda do app
      s.mapStore.getState().setActiveTool('select')
    })
    await mestre.waitForTimeout(1500)

    const centro = await centroDoCanvas(mestre)
    const circulo = (raio: number) => (t: number) => ({ x: centro.x + raio * Math.cos(t * Math.PI * 3), y: centro.y + raio * Math.sin(t * Math.PI * 3) })
    const cenario = async (nome: string, medidores: Medidor[], acao: () => Promise<Record<string, unknown> | void>, preparar?: () => Promise<void>) => {
      marco(`cenário ${nome}`)
      if (preparar) await preparar()
      const fioAntes = fio.length
      const medidas = await medir(nome, medidores, acao)
      const doFio = tallyDoFio(fioAntes)
      for (const m of medidas) m.mensagens = doFio
      for (const m of medidas) marco(`  ${m.papel}: fps ${m.fps} p95 ${m.quadro_p95_ms} longa ${m.longas_max_ms} cpu ${m.cpu_ms_por_s} ${m.extra ? JSON.stringify(m.extra) : ''}`)
      if (caso.perfil) {
        if (preparar) await preparar()
        await perfilar(medidas, medidores, mapear, acao)
      }
      cenarios.push(...medidas)
      await medidores[0].page.waitForTimeout(800)
    }

    await cenario('parado-5s', soMestre, () => mestre.waitForTimeout(5000))
    await cenario('pan-mapa-inteiro-3s', soMestre, () => arrastar(mestre, 'middle', circulo(200), 3000))
    await cenario('zoom-roda-2s-dentro-2s-fora', soMestre, async () => {
      await rodar(mestre, centro, -100, 2000)
      await rodar(mestre, centro, 100, 2000)
    })
    registro.gpu_mestre_depois_do_zoom = await memoriaDaGpu(mestre, 'appMestre')
    // Perto da ficha (uma casa ~40 px), como na jogada.
    await centrarEAproximar(mestre, npc, map.grid)
    registro.gpu_mestre_perto = await memoriaDaGpu(mestre, 'appMestre')
    await cenario('pan-perto-3s', soMestre, () => arrastar(mestre, 'middle', circulo(200), 3000))
    await centrarEAproximar(mestre, npc, map.grid)
    let idaDoNpc = 1
    const arrastarNpc = async () => {
      const de = { x: npc.x, y: npc.y }
      const para = { x: npc.x + idaDoNpc * 10 * map.grid, y: npc.y }
      const a = await naTela(mestre, 'appMestre', de.x, de.y)
      const b = await naTela(mestre, 'appMestre', para.x, para.y)
      await arrastar(mestre, 'left', (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }), 1500, 150)
      npc.x = para.x
      idaDoNpc = -idaDoNpc
      await mestre.waitForTimeout(1000)
      const depois = await mestre.evaluate((id) => ((window as unknown as Janela).__labSonda as { mapStore: { getState: () => { map: MapData } } }).mapStore.getState().map.tokens.find((t) => t.id === id), npc.id) // as: a sonda do app
      return { ficha_andou_px: depois === undefined ? null : Math.round(depois.x - de.x) }
    }
    await cenario('arrastar-ficha-10-casas', soMestre, arrastarNpc)
    const esconderZonas = async () => {
      await mestre.evaluate((ids) => {
        const s = (window as unknown as Janela).__labSonda as { mapStore: { getState: () => { updateConcealZone: (id: string, p: { revealed: boolean }) => void } } } // as: a sonda do app
        for (const id of ids) s.mapStore.getState().updateConcealZone(id, { revealed: false })
      }, map.concealZones.map((z) => z.id))
      await mestre.waitForTimeout(1500)
    }
    const revelarZonas = async () => {
      for (const z of map.concealZones) {
        await mestre.evaluate((id) => {
          const s = (window as unknown as Janela).__labSonda as { mapStore: { getState: () => { updateConcealZone: (id: string, p: { revealed: boolean }) => void } } } // as: a sonda do app
          s.mapStore.getState().updateConcealZone(id, { revealed: true })
        }, z.id)
        await mestre.waitForTimeout(600)
      }
    }
    await cenario('revelar-nevoa-6-zonas', soMestre, revelarZonas, esconderZonas)

    // ---- MESA: sala aberta e o jogador no navegador
    if (caso.fases === 'mesa') {
      await esconderZonas()
      await mestre.getByRole('tab', { name: 'Grupo' }).click()
      await mestre.getByRole('button', { name: 'Abrir sala' }).click()
      await mestre.getByText(CODIGO).first().waitFor()
      // O jogador num NAVEGADOR À PARTE (outro processo de GPU), como o amigo em outra máquina:
      // no mesmo navegador as duas telas dividem um processo de GPU e uma derruba a outra.
      // `LAB_DES_MESMO_NAVEGADOR=1` volta ao navegador compartilhado.
      let navegadorDoJogador = browser
      if (process.env.LAB_DES_MESMO_NAVEGADOR !== '1') {
        const uso = test.info().project.use
        navegadorDoJogador = await browser.browserType().launch({ ...uso.launchOptions, headless: uso.headless ?? true, ...(uso.channel ? { channel: uso.channel } : {}) })
        outrosNavegadores.push(navegadorDoJogador)
      }
      registro.jogador_em_navegador_separado = navegadorDoJogador !== browser
      const ctxJogador = await novoContexto(navegadorDoJogador, caso, baseURL)
      const jogador = await ctxJogador.newPage()
      jogador.on('pageerror', (e) => erros.push(`jogador: ${e.message}`))
      let fila: Promise<unknown> = Promise.resolve()
      /** Tipos das mensagens que o jogador mandou, na ordem. */
      const doJogador: string[] = []
      await jogador.routeWebSocket(
        (url) => url.pathname === '/ws',
        (ws) => {
          sockets.set('c1', ws)
          ws.onMessage((bruto) => {
            const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
            doJogador.push(/"type":"([^"]+)"/.exec(texto.slice(0, 80))?.[1] ?? '?')
            fila = fila
              .then(() => mestre.evaluate(({ c, t }) => (window as unknown as { __emitTauri: (e: string, p: unknown) => void }).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }), { c: 'c1', t: texto })) // as: o Tauri de mentira do mestre
              .catch(() => undefined)
          })
        },
      )
      await jogador.goto(`/player.html${sufixo}`)
      await jogador.getByLabel('Código da sala').fill(CODIGO)
      await jogador.getByLabel('Seu nome').fill(JOGADOR)
      await jogador.getByRole('button', { name: 'Entrar' }).click()
      await jogador.getByRole('status').filter({ hasText: /Aguardando o mestre/ }).waitFor({ timeout: 20_000 })
      const antesDeAtribuir = await agora(jogador)
      const fioAntesDeAtribuir = fio.length
      const relogioAntesDeAtribuir = Date.now()
      const cartao = mestre.locator('#lb-rail-panel-room .lb-field').filter({ hasText: `${JOGADOR} —` })
      await cartao.getByRole('button', { name: `Atribuir ${fichaDoJogador.name}`, exact: true }).click()
      marco('mesa: ficha atribuída')
      const abrirJogador = await esperarAbrir(jogador, antesDeAtribuir)
      marco(`jogador: abriu ${JSON.stringify(abrirJogador)}`)
      const primeiraTela = fio.slice(fioAntesDeAtribuir).find(([, tipo]) => tipo === 'snapshot')
      registro.abrir_jogador = {
        ...abrirJogador,
        snapshot_ms_desde_o_clique: primeiraTela === undefined ? null : primeiraTela[0] - relogioAntesDeAtribuir,
        snapshot_bytes: primeiraTela?.[2] ?? null,
        longas: await longasEntre(jogador, antesDeAtribuir, antesDeAtribuir + abrirJogador.interativo_ms),
      }
      registro.gpu_jogador_ao_abrir = await memoriaDaGpu(jogador, 'appJogador')
      const cdpJogador = await ctxJogador.newCDPSession(jogador)
      await cdpJogador.send('Performance.enable', { timeDomain: 'threadTicks' })
      const mesa: Medidor[] = [
        { page: jogador, papel: 'jogador', cdp: cdpJogador },
        { page: mestre, papel: 'mestre', cdp: cdpMestre },
      ]
      await jogador.waitForTimeout(1500)
      const centroJ = await centroDoCanvas(jogador)
      // Pan do jogador: arrasto com o botão esquerdo no chão, longe do centro (onde costuma estar a própria ficha).
      const circuloJ = (t: number) => ({ x: centroJ.x - centroJ.w * 0.25 + 150 * Math.cos(t * Math.PI * 3), y: centroJ.y + centroJ.h * 0.2 + 150 * Math.sin(t * Math.PI * 3) })
      const posicaoDoMundo = async () => jogador.evaluate(() => {
        const app = (window as unknown as Janela).__labSonda?.appJogador as { stage: { children: Array<{ x: number; y: number }> } } // as: o Application do Pixi pendurado pela sonda
        return { x: app.stage.children[0].x, y: app.stage.children[0].y }
      })

      await cenario('mesa-parado-5s', mesa, () => jogador.waitForTimeout(5000))
      await cenario('mesa-jogador-pan-3s', mesa, async () => {
        const antes = await posicaoDoMundo()
        await arrastar(jogador, 'left', circuloJ, 3000)
        const depois = await posicaoDoMundo()
        return { mundo_mexeu_px: Math.round(Math.hypot(depois.x - antes.x, depois.y - antes.y)) }
      })
      await cenario('mesa-jogador-zoom-2s-dentro-2s-fora', mesa, async () => {
        await rodar(jogador, centroJ, -100, 2000)
        await rodar(jogador, centroJ, 100, 2000)
      })
      registro.gpu_jogador_depois_do_zoom = await memoriaDaGpu(jogador, 'appJogador')
      await aproximarNa(jogador, 'appJogador', fichaDoJogador, map.grid)
      let idaDoJogador = 1
      const fichaAtual = { x: fichaDoJogador.x, y: fichaDoJogador.y }
      // Para a direita; se o passo não sair (parede no caminho, o mestre recusa), a passada seguinte tenta uma direção sem parede.
      let rumo = { x: 10 * map.grid, y: 0 }
      registro.rumo_da_ficha_do_jogador = rumo
      await jogador.waitForTimeout(1000)
      await cenario('mesa-jogador-arrasta-propria-ficha-10-casas', mesa, async () => {
        const doJogadorAntes = doJogador.length
        if (idaDoJogador === 1 && registro.ficha_do_jogador_travou === true) rumo = rumoLivre(map, fichaAtual, 10 * map.grid)
        const para = { x: fichaAtual.x + idaDoJogador * rumo.x, y: fichaAtual.y + idaDoJogador * rumo.y }
        const a = await naTela(jogador, 'appJogador', fichaAtual.x, fichaAtual.y)
        const b = await naTela(jogador, 'appJogador', para.x, para.y)
        await arrastar(jogador, 'left', (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }), 1500, 150)
        await jogador.waitForTimeout(1000)
        const depois = await mestre.evaluate((id) => ((window as unknown as Janela).__labSonda as { mapStore: { getState: () => { map: MapData } } }).mapStore.getState().map.tokens.find((t) => t.id === id), fichaDoJogador.id) // as: a sonda do app
        const andou = depois === undefined ? 0 : Math.round(Math.hypot(depois.x - fichaAtual.x, depois.y - fichaAtual.y))
        if (depois !== undefined) {
          fichaAtual.x = depois.x
          fichaAtual.y = depois.y
        }
        if (andou !== 0) idaDoJogador = -idaDoJogador
        else registro.ficha_do_jogador_travou = true
        return { ficha_andou_px_no_mestre: andou, rumo, jogador_mandou: doJogador.slice(doJogadorAntes) }
      })
      await centrarEAproximar(mestre, npc, map.grid)
      await cenario('mesa-jogador-ve-mestre-mover-ficha', mesa, async () => {
        const antes = { n: enviados.n, bytes: enviados.bytes }
        const r = await arrastarNpc()
        return { ...r, mensagens_do_mestre: enviados.n - antes.n, bytes_do_mestre: enviados.bytes - antes.bytes }
      })
      await cenario(
        'mesa-mestre-revela-nevoa-6-zonas',
        mesa,
        async () => {
          const antes = { n: enviados.n, bytes: enviados.bytes }
          await revelarZonas()
          return { mensagens_do_mestre: enviados.n - antes.n, bytes_do_mestre: enviados.bytes - antes.bytes }
        },
        esconderZonas,
      )
      registro.gpu_jogador_fim = await memoriaDaGpu(jogador, 'appJogador')
    }

    // Abrir o mapa com o perfil ligado (outra aba do mesmo contexto, mesma mesa de mentira).
    if (caso.perfil) {
      const outra = await ctxMestre.newPage()
      await outra.goto(`/${sufixo}`)
      await outra.getByRole('button', { name: /Carregar Mapa existente/ }).click()
      const cdpOutra = await ctxMestre.newCDPSession(outra)
      await cdpOutra.send('Performance.enable', { timeDomain: 'threadTicks' })
      const medidaAbrir: Medida = { cenario: 'abrir-mapa', papel: 'mestre', duracao_ms: 0, quadros: 0, fps: 0, quadro_p50_ms: 0, quadro_p95_ms: 0, quadro_p99_ms: 0, quadro_max_ms: 0, longas_n: 0, longas_max_ms: 0, longas_total_ms: 0, cpu_ms_por_s: 0, script_ms_por_s: 0, draws_por_quadro_p50: 0, quadros_com_desenho_pct: 0, mensagens: {} }
      await perfilar([medidaAbrir], [{ page: outra, papel: 'mestre', cdp: cdpOutra }], mapear, async () => {
        const d = await agora(outra)
        await outra.getByRole('button', { name: new RegExp(AVENTURA) }).click()
        await outra.waitForSelector('canvas', { timeout: 120_000 })
        const c = (await outra.evaluate((x) => (window as unknown as Janela).__des.cliques.find((t) => t >= x), d)) ?? d // as: o coletor pendurou no window
        await esperarAbrir(outra, c)
      })
      registro.perfil_abrir_mestre = { quentes: medidaAbrir.perfil, gc_ms: medidaAbrir.perfil_gc_ms, amostrado_ms: medidaAbrir.perfil_amostrado_ms }
      await outra.close()
    }

    registro.cenarios = cenarios
    registro.erros_de_pagina = erros
    if (SAIDA !== '') appendFileSync(SAIDA, `${JSON.stringify(registro)}\n`)
    console.log(`DESEMPENHO ${caso.id} ${JSON.stringify({ abrir_mestre: registro.abrir_mestre, abrir_jogador: registro.abrir_jogador, cenarios: cenarios.map((c) => [c.papel, c.cenario, c.fps, c.quadro_p95_ms, c.longas_max_ms, c.cpu_ms_por_s]) })}`)
    conferirMetasF5(caso.id, registro)
    conferirMetasF4(caso.id, cenarios)
  })
}

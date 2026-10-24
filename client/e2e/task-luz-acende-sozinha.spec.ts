// LUZ QUE ACENDE SOZINHA (Luz L3): o mestre escolhe "Lampião" na ferramenta
// Luz e clica no mapa da cena EXTERNA; a luz nasce acesa só à tarde e à noite.
// De dia ela não chega à tela da Ana; o mestre aperta "Noite" e ela chega;
// "Dia" e ela some; "Noite" de novo e ela volta. O campo `acesaEm` nunca sai.
//
// COMO PROVA: o mesmo transporte de mentira de task-jogador-periodo-da-cena
// (o mestre é o app inteiro em modo Tauri com o disco de mentira; a Ana é o
// `player.html` inteiro). O que o mestre manda pelo `net_send` fica anotado e
// dá as luzes que a tela da Ana tem agora (snapshot, delta ou patch).
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { pickTool } from './helpers/tools'
import type { Light, MapData, Token } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODIGO = 'LUZ003'
const AVENTURA = 'Vale das Lanternas'
const PASTA = 'C:/appdata/maps/map_lanternas'
const TELA = { width: 1280, height: 800 }
const GRADE = 50
const ANA = { x: 300, y: 300 }
/** O lampião vai a 40 px acima da Ana: dentro da visão dela de dia e de noite, e na tela mesmo com o zoom máximo (400%) da abertura. */
const LAMPIAO = { x: 300, y: 260 }
const ASSENTAR_MS = 800

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function disco(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_lanternas', name: AVENTURA, startSceneId: 'scene_patio', scenes: [{ id: 'scene_patio', name: 'Patio', file: 'map.json' }] }
  const patio: MapData = { ...createEmptyMap('map_lanternas', AVENTURA, 20, 12, GRADE), tokens: [ficha('tok-lanterna', 'Lanterna', ANA.x, ANA.y)], externa: true }
  return { [`${PASTA}/map.json`]: serializeMap(patio), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

type HandlerTauri = (evento: { event: string; id: number; payload: unknown }) => void
type JanelaDoMestre = { isTauri: boolean; __emitTauri: (event: string, payload: unknown) => void; __labParaJogador: (clientId: string, texto: string) => void; __TAURI_INTERNALS__: unknown }

/** O que a tela do jogador recebe, só no que este teste lê. */
interface Tela {
  type?: unknown
  map?: { lights?: Light[]; set?: { lights?: Light[] } }
}

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  enviados: Map<string, Tela[]>
  textos: string[]
  fila: Promise<void>
}

async function mestreAbreASala(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), enviados: new Map(), textos: [], fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    const lista = rede.enviados.get(clientId) ?? []
    lista.push(JSON.parse(texto) as Tela) // o que o host mandou: só lido para achar as luzes
    rede.enviados.set(clientId, lista)
    rede.textos.push(texto)
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      const alvo = window as unknown as JanelaDoMestre // a janela de teste ganha o Tauri de mentira: os campos são escritos logo abaixo
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const callbacks = new Map<number, HandlerTauri>()
      const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
      let proximoId = 1
      alvo.isTauri = true
      alvo.__emitTauri = (event, payload) => {
        for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
      }
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: (cb: HandlerTauri) => {
          const id = proximoId
          proximoId += 1
          callbacks.set(id, cb)
          return id
        },
        invoke: async (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => {
          const a = (args ?? {}) as Record<string, unknown> // o invoke do Tauri manda objeto de argumentos; cada campo é convertido com String/Number antes do uso
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'net_send':
              alvo.__labParaJogador(String(a.clientId), JSON.stringify(a.msg))
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
              return (a.paths as string[]).join('/') // o plugin path do Tauri manda `paths` como lista de texto
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
    },
    { arquivos: disco(), codigo: CODIGO },
  )
  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

const contextos: BrowserContext[] = []
test.afterEach(async () => {
  await Promise.all(contextos.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextos.push(contexto)
  const page = await contexto.newPage()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          // `as`: a janela do mestre ganhou `__emitTauri` no init script acima; a mensagem vai crua, como o Rust a entregaria.
          .then(() => rede.mestre.evaluate(({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }), { c: clientId, t: texto }))
          .catch(() => undefined)
      })
    },
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill(nome)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return page
}

/** As luzes que a tela do jogador tem agora: a última lista que chegou (snapshot, delta ou patch). */
function luzesNaTela(rede: Rede, clientId: string): Light[] | null {
  let luzes: Light[] | null = null
  for (const m of rede.enviados.get(clientId) ?? []) {
    if (m.type === 'snapshot' || m.type === 'delta') luzes = m.map?.lights ?? luzes
    else if (m.type === 'patch') luzes = m.map?.set?.lights ?? luzes
  }
  return luzes
}

test('Lampião criado no editor: de dia não chega à jogadora, à noite chega, no Dia some e na Noite volta', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(90_000)
  if (baseURL === undefined) throw new Error('sem baseURL')
  await mestre.setViewportSize(TELA)
  const rede = await mestreAbreASala(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', 'Ana')
  await mestre.locator('#lb-rail-panel-room .lb-field').filter({ hasText: 'Ana —' }).getByRole('button', { name: 'Atribuir Lanterna', exact: true }).click()
  await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', 'dia', { timeout: 15_000 })

  // Gesto real: ferramenta Luz, preset Lampião no painel, clique no mapa.
  await pickTool(mestre, 'Luz')
  const proxima = mestre.getByRole('radiogroup', { name: 'Próxima luz' })
  if (!(await proxima.isVisible())) await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await proxima.getByRole('radio', { name: 'Lampião' }).click()
  await expect(proxima.getByRole('radio', { name: 'Lampião' })).toHaveAttribute('aria-checked', 'true')
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (caixa === null) throw new Error('canvas sem caixa')
  const camera = await mestre.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
  await mestre.mouse.click(caixa.x + camera.x + LAMPIAO.x * camera.scale, caixa.y + camera.y + LAMPIAO.y * camera.scale)

  const criadas = await mestre.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.lights)
  expect(criadas).toHaveLength(1)
  const lampiao = criadas[0]
  expect(lampiao?.acesaEm).toEqual(['tarde', 'noite'])
  expect(lampiao?.radius).toBe(3.5 * GRADE)
  const idDoLampiao = lampiao?.id

  // De dia: a luz existe no mestre, mas não chega à Ana.
  await mestre.waitForTimeout(ASSENTAR_MS)
  expect((luzesNaTela(rede, 'c1') ?? []).map((l) => l.id)).not.toContain(idDoLampiao)

  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  const periodo = mestre.locator('#lb-rail-panel-room').getByRole('radiogroup', { name: 'Período' })
  for (const [botao, chega] of [
    ['Noite', true],
    ['Dia', false],
    ['Noite', true],
  ] as const) {
    await periodo.getByRole('radio', { name: botao }).click()
    await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', botao === 'Noite' ? 'noite' : 'dia', { timeout: 5_000 })
    await expect.poll(() => (luzesNaTela(rede, 'c1') ?? []).some((l) => l.id === idDoLampiao), { message: `${botao}: o lampião ${chega ? 'chega' : 'some'}`, timeout: 5_000 }).toBe(chega)
  }
  // A regra nunca viaja.
  expect(rede.textos.join('\n')).not.toContain('acesaEm')
})

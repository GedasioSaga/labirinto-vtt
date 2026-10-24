// DIA/TARDE/NOITE (Luz L1): o mestre aperta "Noite" no painel Grupo; a tela
// da jogadora na cena EXTERNA recebe a noite numa mensagem só; a do jogador
// na cena INTERIOR não recebe nada e continua de dia.
//
// COMO PROVA: duas telas de verdade (mesmo transporte de mentira de
// task-jornada-cenas-com-gente.spec.ts): o mestre é o app inteiro em modo
// Tauri com o disco de mentira; Ana e Bruno são o `player.html` inteiro, cada
// um no próprio contexto. O que o mestre manda pelo `net_send` volta ao
// socket de cada um e fica anotado (`Rede.enviados`) para contar mensagens.
// A tela do jogador expõe o período da cena dele em `.pp-estado[data-periodo]`
// (a tinta é da L4b). Gesto real: clique no rádio "Noite" do painel.
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODIGO = 'NOITE1'
const AVENTURA = 'Vale das Oliveiras'
const PATIO = 'Patio das Oliveiras'
const CRIPTA = 'Cripta Rubra'
const PASTA = 'C:/appdata/maps/map_vale'
const TELA = { width: 1280, height: 800 }
/** Folga para a troca chegar (e para uma segunda mensagem, se houvesse, aparecer). */
const ASSENTAR_MS = 800

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function cena(id: string, nome: string, tokens: Token[], marcas: Partial<MapData>): MapData {
  return { ...createEmptyMap(id, nome, 20, 12, 50), tokens, ...marcas }
}

function disco(): Record<string, string> {
  const aventura = {
    version: 1,
    id: 'adv_vale',
    name: AVENTURA,
    startSceneId: 'scene_patio',
    scenes: [
      { id: 'scene_patio', name: PATIO, file: 'map.json' },
      { id: 'scene_cripta', name: CRIPTA, file: 'scenes/scene_cripta/map.json' },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(cena('map_vale', AVENTURA, [ficha('tok-lanterna', 'Lanterna', 300, 300)], { externa: true })),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/scene_cripta/map.json`]: serializeMap(cena('map_cripta', CRIPTA, [ficha('tok-machado', 'Machado', 300, 300)], {})),
  }
}

type HandlerTauri = (evento: { event: string; id: number; payload: unknown }) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string) => void
  __TAURI_INTERNALS__: unknown
}

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Toda mensagem que o mestre mandou, por jogador, na ordem. */
  enviados: Map<string, { type?: unknown; luz?: { periodo?: unknown } }[]>
  fila: Promise<void>
}

async function mestreAbreASala(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), enviados: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    const lista = rede.enviados.get(clientId) ?? []
    lista.push(JSON.parse(texto) as { type?: unknown }) // o que o host mandou: só lido para contar tipo e período
    rede.enviados.set(clientId, lista)
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

async function mestreAtribui(mestre: Page, jogador: string, botao: string): Promise<void> {
  const card = mestre.locator('#lb-rail-panel-room .lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: botao, exact: true }).click()
}

/** Mensagens de tela (snapshot ou patch) que o mestre mandou ao jogador a partir de `desde`. */
function telasDesde(rede: Rede, clientId: string, desde: number) {
  return (rede.enviados.get(clientId) ?? []).slice(desde).filter((m) => m.type === 'snapshot' || m.type === 'patch' || m.type === 'delta')
}

test('o mestre aperta Noite: a cena externa recebe numa mensagem, a interior não recebe nada', async ({ browser, page: mestre, baseURL }) => {
  test.setTimeout(90_000)
  if (baseURL === undefined) throw new Error('sem baseURL')
  await mestre.setViewportSize(TELA)
  const rede = await mestreAbreASala(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', 'Ana')
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', 'Bruno')
  await mestreAtribui(mestre, 'Ana', 'Atribuir Lanterna')
  await mestreAtribui(mestre, 'Bruno', `${CRIPTA} · Atribuir Machado`)
  await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', 'dia', { timeout: 15_000 })
  await expect(bruno.locator('.pp-estado')).toHaveAttribute('data-periodo', 'dia', { timeout: 15_000 })

  // O painel mostra o estado de agora: Dia marcado, a cena aberta (o Pátio) é externa.
  const painel = mestre.locator('#lb-rail-panel-room')
  const noite = painel.getByRole('radiogroup', { name: 'Período' }).getByRole('radio', { name: 'Noite' })
  await expect(painel.getByRole('radio', { name: 'Dia' })).toHaveAttribute('aria-checked', 'true')
  await expect(painel.getByRole('checkbox', { name: 'Cena externa' })).toBeChecked()
  await mestre.waitForTimeout(ASSENTAR_MS)
  const antesAna = rede.enviados.get('c1')?.length ?? 0
  const antesBruno = rede.enviados.get('c2')?.length ?? 0

  await noite.click()

  await expect(noite).toHaveAttribute('aria-checked', 'true')
  await expect(painel.getByText('Esta cena segue o período: agora está à noite.')).toBeVisible()
  await expect(ana.locator('.pp-estado')).toHaveAttribute('data-periodo', 'noite', { timeout: 5_000 })
  await mestre.waitForTimeout(ASSENTAR_MS)
  const paraAna = telasDesde(rede, 'c1', antesAna)
  expect(paraAna, 'a troca chega à Ana numa mensagem só').toHaveLength(1)
  expect(paraAna[0]?.luz?.periodo).toBe('noite')
  expect(telasDesde(rede, 'c2', antesBruno), 'cena interior: nada sai para o Bruno').toEqual([])
  await expect(bruno.locator('.pp-estado')).toHaveAttribute('data-periodo', 'dia')
  // Hora nenhuma viaja.
  expect(JSON.stringify([...rede.enviados.values()])).not.toMatch(/"relogio"|"hora"|"periodoFixo"|"ambientePorPeriodo"|"externa"/)
})

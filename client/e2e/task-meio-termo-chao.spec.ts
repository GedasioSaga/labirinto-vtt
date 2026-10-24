// CHÃO SEM REPETIÇÃO (fatia MT7 do Meio-Termo), com a chave de obra ligada
// pela URL (`?obra=meio-termo`, só no servidor de desenvolvimento). Prova a
// costura que os testes de unidade não veem, no JOGADOR de verdade (o mapa
// sai do arquivo, passa pelo recorte real e pela rede). Só PC (ordem do
// usuário de 24/10/2026: nada de celular por enquanto; o teste a 390 px com
// CPU 4x saiu do aceite, e o celular fica NÃO VERIFICADO):
// 1. 1440 x 900, CPU 1x: primeira pintura <= 400 ms OU até 10% acima da
//    chave desligada (neste mapa a desligada já leva ~1 s: os ladrilhos das 3
//    texturas, de antes da MT7), em 3 rodadas intercaladas; o ladrilho de hoje
//    fica por baixo até os pedaços chegarem; o chão pronto é registrado; arrastar
//    e afastar o mapa (pedaços novos e troca de nível) com quadro p95 <= 20 ms
//    (ou o da chave desligada, o piso deste Chromium sem tela) e nenhuma
//    tarefa longa >= 200 ms.
// 2. Os pixels mudam: com a chave, a grama sai diferente do ladrilho repetido;
//    sem ela, aberta de novo, sai igual (controle).
// A primeira pintura e o chão pronto saem das marcas `texturas:no-palco` e
// `chao:pronto` (`pixi/drawTexturas.ts`), contadas da chegada do snapshot.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addToken, createEmptyMap, setShowGrid } from '../src/lib/mapFactory'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import { deserializeMap, serializeMap } from '../src/lib/mapFile'
import type { MapData, PinceladaDeTextura, Region, RegionPoint } from '../src/types/map'

const GRADE = 64
const COLUNAS = 30
const LINHAS = 20
const FICHA = 'ficha-ana'
const OBRA = '?obra=meio-termo'
const RODADAS = 3
const PIORA_MAXIMA = 1.1
const TETO_DA_PRIMEIRA_PINTURA_MS = 400
const TETO_DO_P95_MS = 20
const TETO_DA_TAREFA_LONGA_MS = 200
const PROVAS = '../docs/design/objetos/provas'
/** Os prints só são regravados quando pedidos (GERAR_PROVAS_MT7=1): rodar o teste não suja a árvore. */
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT7 === '1'

test.use({ trace: 'off', video: 'off', contextOptions: { reducedMotion: 'reduce' } })

type Caixa = { x0: number; y0: number; x1: number; y1: number }
const TERCO = (COLUNAS * GRADE) / 3
const FAIXAS: { id: string; textura: string; caixa: Caixa }[] = [
  { id: 'campo', textura: 'grama', caixa: { x0: 0, y0: 0, x1: TERCO, y1: LINHAS * GRADE } },
  { id: 'trilha', textura: 'terra', caixa: { x0: TERCO, y0: 0, x1: TERCO * 2, y1: LINHAS * GRADE } },
  { id: 'mata', textura: 'floresta', caixa: { x0: TERCO * 2, y0: 0, x1: TERCO * 3, y1: LINHAS * GRADE } },
]

function anel(c: Caixa): RegionPoint[] {
  return [{ x: c.x0, y: c.y0 }, { x: c.x1, y: c.y0 }, { x: c.x1, y: c.y1 }, { x: c.x0, y: c.y1 }]
}

function mapaDoChao(): MapData {
  let map = setShowGrid(createEmptyMap('meio-termo-chao', 'Campo', COLUNAS, LINHAS, GRADE), false)
  const regioes: Region[] = FAIXAS.map((f) => ({ id: f.id, points: anel(f.caixa), tag: '', fillColor: '#6b5a48', fillPattern: 'solid', data: {} }))
  const texturas: PinceladaDeTextura[] = FAIXAS.map((f) => ({ id: `balde-${f.id}`, tipo: 'balde', textura: f.textura, forca: 1, alvo: { tipo: 'regiao', id: f.id } }))
  map = { ...map, regions: regioes, texturas }
  return addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: TERCO / 2, y: (LINHAS * GRADE) / 2, size: 1, image: null })
}

/** O host: o mapa reaberto do ARQUIVO, recortado para a Ana pelo `filterMapForPlayer` de verdade, depois do `welcome`. */
function host(): (ws: WebSocketRoute) => void {
  const doArquivo = deserializeMap(serializeMap(mapaDoChao()))
  const mundo = COLUNAS * GRADE
  const recorte = filterMapForPlayer(doArquivo, 'p-ana', { 'p-ana': [FICHA] }, mundo, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(doArquivo)).map
  if ((recorte.texturas ?? []).length !== FAIXAS.length) throw new Error(`o recorte do jogador perdeu as texturas: ${JSON.stringify(recorte.texturas)}`)
  const explored = encodeExploration(createExploration(doArquivo))
  const snapshot = JSON.stringify({ type: 'snapshot', rev: 1, map: recorte, vision: [anel({ x0: 0, y0: 0, x1: COLUNAS * GRADE, y1: LINHAS * GRADE })], explored, ownTokens: [FICHA], concealed: [], sceneName: doArquivo.name })
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(snapshot)
    })
  }
}

/** Antes do app: a hora em que o snapshot chega e as tarefas longas (com a hora de cada uma). */
async function instrumentar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __snapshotEm?: number; __longas: [number, number][] }
    w.__longas = []
    try {
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) w.__longas.push([e.startTime, e.duration])
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      // Sem a API: a lista fica vazia (o portão de tarefa longa passa sem medir; o de tempo continua).
    }
    const Original = window.WebSocket
    class ComRelogio extends Original {
      constructor(url: string | URL, protocolos?: string | string[]) {
        super(url, protocolos)
        this.addEventListener('message', (ev: MessageEvent) => {
          if (w.__snapshotEm === undefined && typeof ev.data === 'string' && ev.data.includes('"type":"snapshot"')) w.__snapshotEm = performance.now()
        })
      }
    }
    window.WebSocket = ComRelogio
  })
}

interface Abertura {
  primeiraMs: number
  prontoMs: number | null
  maiorLonga: number
}

/** Abre o jogador, entra e espera a textura no palco (e, com a chave, o chão pronto). */
async function abrir(page: Page, comObra: boolean): Promise<Abertura> {
  await instrumentar(page)
  await page.routeWebSocket((url) => url.pathname === '/ws', host())
  await page.goto(`/player.html${comObra ? OBRA : ''}`)
  await page.getByLabel('Código da sala').fill('CHAO77')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForFunction(() => performance.getEntriesByName('texturas:no-palco').length > 0, undefined, { timeout: 60_000 })
  if (comObra) await page.waitForFunction(() => performance.getEntriesByName('chao:pronto').length > 0, undefined, { timeout: 60_000 })
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => {
    const w = window as unknown as { __snapshotEm?: number; __longas: [number, number][] }
    const t0 = w.__snapshotEm ?? 0
    const marca = (nome: string) => performance.getEntriesByName(nome)[0]?.startTime
    const primeira = marca('texturas:no-palco')
    const pronto = marca('chao:pronto')
    const depois = w.__longas.filter(([inicio]) => inicio >= t0).map(([, d]) => d)
    return { primeiraMs: (primeira ?? NaN) - t0, prontoMs: pronto === undefined ? null : pronto - t0, maiorLonga: depois.length === 0 ? 0 : Math.max(...depois) }
  })
  return r
}

/** Arrasta e afasta o mapa por ~3 s, contando o intervalo entre quadros. */
async function passear(page: Page): Promise<{ p95: number; quadros: number; maiorLonga: number }> {
  const canvas = page.locator('canvas').first()
  const caixa = await canvas.boundingBox()
  if (caixa === null) throw new Error('sem canvas')
  const t0 = await page.evaluate(() => {
    const w = window as unknown as { __quadros: number[]; __parar: boolean }
    w.__quadros = []
    w.__parar = false
    let antes = performance.now()
    const passo = (agora: number) => {
      w.__quadros.push(agora - antes)
      antes = agora
      if (!w.__parar) requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
    return performance.now()
  })
  const cx = caixa.x + caixa.width / 2
  const cy = caixa.y + caixa.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let k = 0; k <= 30; k += 1) await page.mouse.move(cx - k * 20, cy - k * 8)
  await page.mouse.up()
  for (let k = 0; k < 6; k += 1) {
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(120)
  }
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let k = 0; k <= 30; k += 1) await page.mouse.move(cx + k * 15, cy + k * 10)
  await page.mouse.up()
  await page.waitForTimeout(800)
  return page.evaluate((desde) => {
    const w = window as unknown as { __quadros: number[]; __parar: boolean; __longas: [number, number][] }
    w.__parar = true
    const q = w.__quadros.slice(1).sort((a, b) => a - b)
    const longas = w.__longas.filter(([inicio]) => inicio >= desde).map(([, d]) => d)
    return { p95: q[Math.floor(q.length * 0.95)] ?? NaN, quadros: q.length, maiorLonga: longas.length === 0 ? 0 : Math.max(...longas) }
  }, t0)
}

const mediana = (l: number[]) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)]

test('1440 x 900, CPU 1x: primeira pintura até 400 ms ou até 10% acima da desligada; arrastar e afastar com quadro p95 até 20 ms e sem tarefa longa', async ({ browser }) => {
  test.setTimeout(300_000)
  const viewport = { width: 1440, height: 900 }
  const medir = async (comObra: boolean, comPasseio: boolean) => {
    const page = await browser.newPage({ viewport })
    const abertura = await abrir(page, comObra)
    if (GERAR_PROVAS && comObra && comPasseio) await page.screenshot({ path: `${PROVAS}/mt7-jogador-1440.png` })
    const passeio = comPasseio ? await passear(page) : null
    await page.close()
    return { abertura, passeio }
  }
  // Intercaladas: a carga da máquina pesa igual nas duas; o passeio só na última de cada.
  const desligadas: Abertura[] = []
  const ligadas: Abertura[] = []
  for (let k = 0; k < RODADAS - 1; k += 1) {
    desligadas.push((await medir(false, false)).abertura)
    ligadas.push((await medir(true, false)).abertura)
  }
  const desligada = await medir(false, true)
  const ligada = await medir(true, true)
  desligadas.push(desligada.abertura)
  ligadas.push(ligada.abertura)
  if (desligada.passeio === null || ligada.passeio === null) throw new Error('sem passeio')
  const base = mediana(desligadas.map((a) => a.primeiraMs))
  const nova = mediana(ligadas.map((a) => a.primeiraMs))
  console.log(
    `[medida] 1440 x 900, CPU 1x, ${RODADAS} rodadas: primeira pintura desligada ${desligadas.map((a) => a.primeiraMs.toFixed(0)).join('/')} ms (mediana ${base.toFixed(0)}), ` +
      `ligada ${ligadas.map((a) => a.primeiraMs.toFixed(0)).join('/')} ms (mediana ${nova.toFixed(0)}); chão pronto ${ligadas.map((a) => (a.prontoMs ?? NaN).toFixed(0)).join('/')} ms; ` +
      `passeio: p95 desligada ${desligada.passeio.p95.toFixed(1)} ms (${desligada.passeio.quadros} quadros), ligada ${ligada.passeio.p95.toFixed(1)} ms (${ligada.passeio.quadros} quadros); ` +
      `maior tarefa longa: abertura ligada ${Math.max(...ligadas.map((a) => a.maiorLonga)).toFixed(0)} ms, passeio desligada ${desligada.passeio.maiorLonga.toFixed(0)} ms, ligada ${ligada.passeio.maiorLonga.toFixed(0)} ms`,
  )
  // A desligada já passa dos 400 ms neste mapa (os ladrilhos das 3 texturas, em fatias, de antes da MT7): o teto vira 10% sobre ela.
  expect(nova, `primeira pintura ligada contra a desligada (${base.toFixed(0)} ms)`).toBeLessThanOrEqual(Math.max(TETO_DA_PRIMEIRA_PINTURA_MS, base * PIORA_MAXIMA))
  // Neste Chromium sem tela o intervalo anda em degraus de 16,7 ms: o teto é 20 ms ou o piso da chave desligada, o que for maior.
  expect(ligada.passeio.p95).toBeLessThanOrEqual(Math.max(TETO_DO_P95_MS, desligada.passeio.p95 * PIORA_MAXIMA))
  expect(ligada.passeio.maiorLonga).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
  for (const a of ligadas) expect(a.maiorLonga, 'maior tarefa longa na abertura com a chave ligada').toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
})

/** Foto do canvas quando a tela para (duas fotos seguidas iguais). */
async function fotoParada(page: Page): Promise<string> {
  const canvas = page.locator('canvas').first()
  let anterior = ''
  await expect
    .poll(
      async () => {
        const atual = (await canvas.screenshot({ animations: 'disabled' })).toString('base64')
        const parada = atual === anterior
        anterior = atual
        return parada
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe(true)
  return anterior
}

/** Fração dos pixels da foto cuja luz muda mais de 6 entre as duas. */
async function fracaoQueMuda(page: Page, a: string, b: string): Promise<{ fracao: number; doMapa: number }> {
  return page.evaluate(
    async ([pa, pb, fundo]) => {
      const ler = async (png: string) => {
        const img = new Image()
        img.src = `data:image/png;base64,${png}`
        await img.decode()
        const tela = document.createElement('canvas')
        tela.width = img.width
        tela.height = img.height
        const g = tela.getContext('2d')
        if (g === null) throw new Error('sem 2D')
        g.drawImage(img, 0, 0)
        return g.getImageData(0, 0, img.width, img.height).data
      }
      const [x, y] = await Promise.all([ler(pa), ler(pb)])
      let muda = 0
      let doMapa = 0
      for (let i = 0; i < x.length; i += 4) {
        const lx = 0.2126 * x[i] + 0.7152 * x[i + 1] + 0.0722 * x[i + 2]
        const ly = 0.2126 * y[i] + 0.7152 * y[i + 1] + 0.0722 * y[i + 2]
        // Só o chão do mapa: o fundo da tela fora dele (quase preto) não conta.
        if (lx <= fundo) continue
        doMapa += 1
        if (Math.abs(lx - ly) > 6) muda += 1
      }
      return { fracao: muda / Math.max(1, doMapa), doMapa: doMapa / (x.length / 4) }
    },
    [a, b, FUNDO_DA_TELA] as const,
  )
}

/** Luz (0-255) até a qual o pixel é o fundo da tela fora do mapa (#111). */
const FUNDO_DA_TELA = 40

test('os pixels: com a chave o chão sai diferente do ladrilho repetido; sem ela, aberto de novo, sai igual (controle)', async ({ browser }) => {
  test.setTimeout(180_000)
  const viewport = { width: 1440, height: 900 }
  const fotos: string[] = []
  let pagina: Page | null = null
  for (const comObra of [false, false, true]) {
    const page = await browser.newPage({ viewport })
    await abrir(page, comObra)
    fotos.push(await fotoParada(page))
    if (pagina === null) pagina = page
    else await page.close()
  }
  if (pagina === null) throw new Error('sem página')
  const ruido = await fracaoQueMuda(pagina, fotos[0], fotos[1])
  const mudanca = await fracaoQueMuda(pagina, fotos[0], fotos[2])
  console.log(
    `[medida] fração do chão do mapa (${(mudanca.doMapa * 100).toFixed(0)}% da tela) que muda: desligada contra desligada ${ruido.fracao.toFixed(4)}, desligada contra ligada ${mudanca.fracao.toFixed(4)}`,
  )
  expect(ruido.fracao).toBeLessThan(0.01)
  expect(mudanca.fracao).toBeGreaterThan(0.3)
  await pagina.close()
})

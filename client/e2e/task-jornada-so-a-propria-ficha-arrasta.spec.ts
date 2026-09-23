// RÉGUA do item "so-a-propria-ficha-arrasta" (backlog da simulação de 7
// jogadores) — escrita para SAIR VERMELHA no código de hoje.
//
// O ITEM: numa sala cheia o dedo pega a ficha do colega, ela anda e volta sem
// explicação; porta ou pino sob ficha alheia não se tocam. Ficha alheia deixa o
// toque passar, as próprias ficam por cima, e a recusa do host diz o motivo
// ('Parede no caminho', 'Fora do chão', 'Essa ficha não é sua').
// Aceite: 7 fichas empilhadas, arrastar no bolo move sempre a do Enzo; tocar a
// do Bruno rola o mapa; porta e pino cobertos respondem ao toque; arrastar
// através da parede volta com 'Parede no caminho' por 2-3 s.
//
// ONDE ISSO MORRE HOJE:
//   - client/src/player/PlayerView.tsx:294 — TODA ficha nasce com
//     eventMode 'static' (a própria e a alheia), então toda ficha pega o toque;
//   - PlayerView.tsx:818 — pointerdown de qualquer ficha vira startTokenDrag, e
//     PlayerView.tsx:866 (stopPropagation) engole o toque: o palco não rola o
//     mapa e o toque curto não chega ao pino nem à porta (endDrag, :1136-1146);
//   - PlayerView.tsx:811-820 — as fichas entram no palco na ordem do mapa: a
//     própria não fica por cima do bolo;
//   - client/src/player/playerConnection.ts:392 (handleRejected) — a recusa do
//     host só devolve a ficha, calada; main.tsx:34 só tem frase para porta.
//
// COMO ESTE ARQUIVO PROVA: a tela do Enzo é o player.html inteiro; do outro
// lado do WebSocket (page.routeWebSocket) está a sessão REAL do mestre
// (src/net/hostSession.ts), como em task-player-page.spec.ts. Os outros 6
// jogadores entram na mesma sessão pelo 'join' de verdade, sem página: a régua
// é sobre o que o dedo do Enzo faz na tela dele. Gestos por page.mouse com
// pausa antes de soltar; asserção por texto visível, diálogo acessível e pixel
// (foto da tela lida num canvas 2D — evaluate só LÊ).
//
// SUPOSIÇÕES:
//   - a ficha própria sem cor escolhida é azul (OWN_TOKEN_COLOR 0x3b82f6); as
//     alheias recebem cor laranja do mestre — é por essas cores que a foto acha
//     cada ficha;
//   - o painel da esquerda do jogador cobre x < ~300 px: tudo que a régua toca
//     fica à direita dele, e a foto só olha x >= 320;
//   - a recusa por parede aparece como texto visível exatamente
//     'Parede no caminho' (frase do aceite), em qualquer elemento da página;
//   - cartão do pino = role dialog com a descrição; porta trancada tocada =
//     texto 'Trancada' (main.tsx:35), iguais aos de hoje.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { fitCamera } from '../src/pixi/world'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Pin, Token, Wall } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODE = 'FICHA7'
const GRID = 50
const LARGURA = 20 * GRID // 1000
const ALTURA = 12 * GRID // 600
const TELA = { width: 1280, height: 800 } // playwright.config.ts
const FIT_MARGIN = 24 // PlayerView.tsx:94
const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)
const COR_ALHEIA = '#f97316'
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const TOQUE_MS = 120 // < SIGNAL_LONG_PRESS_MS (500): toque curto, não sinal
const PINTURA_MS = 500
const PIXELS_DE_FICHA = 600 // raio ~31 px na tela = ~3000 px; 600 é folga para borda e rótulo
const CANVAS_LIVRE = { x: 320, y: 0, width: TELA.width - 320, height: TELA.height }

const ENZO = 'tok-enzo'
const OUTROS = ['Ana', 'Bruno', 'Carla', 'Duda', 'Fabio', 'Gina'] as const
type Outro = (typeof OUTROS)[number]
type Ponto = { x: number; y: number }

const PINO: Ponto = { x: 600, y: 200 }
const CABECA_DO_PINO: Ponto = { x: 600, y: 200 - 23 } // PIN_HEAD_OFFSET = 34 - 11
const PORTA: Ponto = { x: 600, y: 480 } // meio da porta trancada
const PAREDE_X = 850
const DESCRICAO_DO_PINO = 'Um baú velho encostado na parede'

function naTela(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

function ficha(id: string, name: string, p: Ponto, color?: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, ...(color ? { color } : {}) } as Token
}

/** Sala inteira de chão; parede alta em x=850; porta trancada e um pino no meio. Enzo é a PRIMEIRA ficha (a de baixo). */
function mapa(enzo: Ponto, outros: Record<Outro, Ponto>): MapData {
  const base = createEmptyMap('m-ficha', 'Salão cheio', LARGURA / GRID, ALTURA / GRID, GRID)
  const parede: Wall = { id: 'w-parede', x1: PAREDE_X, y1: 0, x2: PAREDE_X, y2: ALTURA, blocksLight: true, blocksMove: true, door: null }
  const porta: Wall = {
    id: 'w-porta',
    x1: PORTA.x - 40,
    y1: PORTA.y,
    x2: PORTA.x + 40,
    y2: PORTA.y,
    blocksLight: false,
    blocksMove: true,
    door: { open: false, locked: true, kind: 'normal' },
  }
  const pino = { id: 'p-bau', x: PINO.x, y: PINO.y, kind: 'exclamacao', description: DESCRICAO_DO_PINO, image: null } as Pin
  return {
    ...base,
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    walls: [parede, porta],
    pins: [pino],
    tokens: [ficha(ENZO, 'Enzo', enzo), ...OUTROS.map((nome) => ficha(`tok-${nome.toLowerCase()}`, nome, outros[nome], COR_ALHEIA))],
  }
}

/** Enzo entra pelo player.html; os outros 6 entram na MESMA sessão real; o mestre atribui uma ficha a cada um. */
async function mesaDoEnzo(page: Page, inicial: MapData): Promise<void> {
  let map = inicial
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  let socket: WebSocketRoute | null = null
  const idDe = new Map<string, string>()
  const despachar = (saidas: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saidas) {
      if (msg.type === 'welcome') idDe.set(clientId, msg.playerId)
      if (clientId === 'c-enzo' && socket !== null) socket.send(JSON.stringify(msg))
    }
  }
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        const r = session.handleMessage('c-enzo', texto, map)
        despachar(r.outbound)
        if (r.applyMove) {
          const { tokenId, x, y } = r.applyMove
          map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
          despachar(session.broadcast(map).outbound)
        }
      })
    },
  )
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODE, { delay: 20 })
  const nome = page.getByLabel('Seu nome')
  await nome.click()
  await nome.pressSequentially('Enzo', { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })

  for (const outro of OUTROS) despachar(session.handleMessage(`c-${outro}`, JSON.stringify({ type: 'join', code: CODE, name: outro }), map).outbound)
  const enzoId = idDe.get('c-enzo')
  if (enzoId === undefined) throw new Error('Enzo entrou mas o host não mandou welcome')
  despachar(session.assignToken(enzoId, ENZO).outbound)
  for (const outro of OUTROS) {
    const pid = idDe.get(`c-${outro}`)
    if (pid === undefined) throw new Error(`${outro} não recebeu welcome`)
    despachar(session.assignToken(pid, `tok-${outro.toLowerCase()}`).outbound)
  }
  despachar(session.broadcast(map).outbound)
  await expect(page.locator('canvas').first(), 'o mapa não apareceu na tela do Enzo').toBeVisible({ timeout: 10_000 })
  // Ficha azul (a do Enzo) ou laranja (alheia): no bolo a do Enzo pode estar por baixo, e isso é o próprio defeito.
  await expect
    .poll(async () => { const c = await cores(page); return c.azul + c.laranja }, { timeout: 10_000, message: 'as fichas deveriam aparecer na tela do Enzo' })
    .toBeGreaterThan(PIXELS_DE_FICHA)
}

async function azul(page: Page, area = CANVAS_LIVRE): Promise<{ n: number; x: number; y: number }> {
  const c = await cores(page, area)
  return { n: c.azul, x: c.x, y: c.y }
}

/** Pixels azuis (ficha própria) e laranja (alheias) na área do canvas fora do painel, e o centro dos azuis (px de tela). Só LÊ a foto. */
async function cores(page: Page, area = CANVAS_LIVRE): Promise<{ azul: number; laranja: number; x: number; y: number }> {
  await page.waitForTimeout(PINTURA_MS)
  const foto = await page.screenshot({ clip: area })
  const r = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d')
    ctx.drawImage(bmp, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
    let n = 0
    let laranja = 0
    let sx = 0
    let sy = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        // azul 0x3b82f6 = (59,130,246); laranja #f97316 = (249,115,22)
        if (data[i + 2] > 200 && data[i] < 110 && data[i + 1] > 100 && data[i + 1] < 170) {
          n += 1
          sx += x
          sy += y
        } else if (data[i] > 220 && data[i + 1] > 80 && data[i + 1] < 150 && data[i + 2] < 60) laranja += 1
      }
    }
    return { n, laranja, x: n > 0 ? sx / n : -1, y: n > 0 ? sy / n : -1 }
  }, foto.toString('base64'))
  return { azul: r.n, laranja: r.laranja, x: r.n > 0 ? r.x + area.x : -1, y: r.n > 0 ? r.y + area.y : -1 }
}

function areaEm(p: Ponto, lado = 90) {
  return { x: p.x - lado / 2, y: p.y - lado / 2, width: lado, height: lado }
}

async function arrastar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 14 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Cada um no seu canto, longe do pino e da porta. */
const ESPALHADOS: Record<Outro, Ponto> = {
  Ana: { x: 350, y: 80 },
  Bruno: { x: 450, y: 80 },
  Carla: { x: 750, y: 80 },
  Duda: { x: 350, y: 550 },
  Fabio: { x: 450, y: 550 },
  Gina: { x: 750, y: 550 },
}

test('1. controle: a ficha do Enzo, sozinha, anda até onde o dedo solta; pino e porta descobertos respondem ao toque', async ({ page }) => {
  test.setTimeout(180_000)
  const origem: Ponto = { x: 450, y: 330 }
  const destino: Ponto = { x: 450, y: 400 }
  await mesaDoEnzo(page, mapa(origem, ESPALHADOS))

  await arrastar(page, naTela(origem), naTela(destino))
  await expect
    .poll(async () => (await azul(page, areaEm(naTela(destino)))).n, { timeout: 8000, message: 'a ficha do Enzo deveria ficar onde o dedo soltou' })
    .toBeGreaterThan(PIXELS_DE_FICHA)
  expect((await azul(page, areaEm(naTela(origem), 40))).n, 'a ficha do Enzo não deveria continuar no ponto de partida').toBeLessThan(50)

  await tocar(page, naTela(CABECA_DO_PINO))
  const cartao = page.getByRole('dialog').filter({ hasText: DESCRICAO_DO_PINO })
  await expect(cartao, 'tocar o pino descoberto deveria abrir o cartão').toBeVisible({ timeout: 8000 })
  await page.keyboard.press('Escape')
  await expect(cartao).toBeHidden({ timeout: 5000 })

  await tocar(page, naTela(PORTA))
  await expect(page.getByText('Trancada', { exact: true }), 'tocar a porta trancada descoberta deveria dizer "Trancada"').toBeVisible({ timeout: 8000 })
})

test('2. sete fichas empilhadas: arrastar no bolo leva sempre a do Enzo', async ({ page }) => {
  test.setTimeout(180_000)
  const bolo: Ponto = { x: 450, y: 330 }
  const destino: Ponto = { x: 450, y: 450 }
  const empilhados = Object.fromEntries(OUTROS.map((o) => [o, bolo])) as Record<Outro, Ponto>
  await mesaDoEnzo(page, mapa(bolo, empilhados))

  await arrastar(page, naTela(bolo), naTela(destino))
  await page.waitForTimeout(1500) // dá tempo de a recusa do host chegar e a ficha voltar
  const noDestino = await azul(page, areaEm(naTela(destino)))
  expect(
    noDestino.n,
    `arrastar no bolo de 7 fichas deveria levar a ficha do Enzo até onde o dedo soltou; lá há ${noDestino.n} px azuis (a do Enzo ficou no bolo, o dedo pegou a de cima)`,
  ).toBeGreaterThan(PIXELS_DE_FICHA)
})

test('3. tocar e arrastar a ficha do Bruno rola o mapa, não arrasta a ficha dele', async ({ page }) => {
  test.setTimeout(180_000)
  const enzo: Ponto = { x: 450, y: 330 }
  const bruno: Ponto = { x: 650, y: 330 }
  await mesaDoEnzo(page, mapa(enzo, { ...ESPALHADOS, Bruno: bruno }))

  const antes = await azul(page)
  expect(antes.n, 'a ficha do Enzo deveria estar na tela antes do gesto').toBeGreaterThan(PIXELS_DE_FICHA)
  const de = naTela(bruno)
  const DESLOCAMENTO = 150
  await arrastar(page, de, { x: de.x, y: de.y + DESLOCAMENTO })
  await page.waitForTimeout(1500)
  const depois = await azul(page)
  expect(
    Math.round(depois.y - antes.y),
    `o dedo na ficha do Bruno deveria rolar o mapa ${DESLOCAMENTO} px (a ficha do Enzo desce junto); a ficha do Enzo andou ${Math.round(depois.y - antes.y)} px na tela`,
  ).toBeGreaterThan(DESLOCAMENTO - 30)
})

test('4. pino e porta cobertos por ficha alheia respondem ao toque', async ({ page }) => {
  test.setTimeout(180_000)
  const enzo: Ponto = { x: 450, y: 330 }
  // Carla em cima da cabeça do pino; Duda em cima do meio da porta trancada.
  await mesaDoEnzo(page, mapa(enzo, { ...ESPALHADOS, Carla: CABECA_DO_PINO, Duda: PORTA }))

  await tocar(page, naTela(CABECA_DO_PINO))
  await expect(
    page.getByRole('dialog').filter({ hasText: DESCRICAO_DO_PINO }),
    'tocar o pino coberto pela ficha da Carla deveria abrir o cartão do pino',
  ).toBeVisible({ timeout: 8000 })
  await page.keyboard.press('Escape')

  await tocar(page, naTela(PORTA))
  await expect(
    page.getByText('Trancada', { exact: true }),
    'tocar a porta trancada coberta pela ficha da Duda deveria dizer "Trancada"',
  ).toBeVisible({ timeout: 8000 })
})

test('5. arrastar através da parede: a ficha volta e a tela diz "Parede no caminho" por 2-3 s', async ({ page }) => {
  test.setTimeout(180_000)
  const enzo: Ponto = { x: 780, y: 330 }
  await mesaDoEnzo(page, mapa(enzo, ESPALHADOS))

  await arrastar(page, naTela(enzo), naTela({ x: 930, y: 330 }))
  const aviso = page.getByText('Parede no caminho', { exact: true })
  await expect(aviso, 'a recusa do host por parede deveria aparecer escrita na tela do Enzo').toBeVisible({ timeout: 3000 })
  await expect
    .poll(async () => (await azul(page, areaEm(naTela(enzo)))).n, { timeout: 5000, message: 'a ficha do Enzo deveria voltar para antes da parede' })
    .toBeGreaterThan(PIXELS_DE_FICHA)
  await expect(aviso, 'o aviso deveria sumir sozinho em poucos segundos').toBeHidden({ timeout: 5000 })
})

// ONDE FOI PARAR CADA CONTROLE — inventário vivo do redesenho (fatia 0 do
// design consolidado, docs/design/consolidado/PLANO.md §2).
//
// O QUE PROVA: cada controle do inventário (e2e/helpers/ondeFoiParar.ts, que
// também gera docs/ui-onde-foi-parar.md) continua ao alcance do mestre ou do
// jogador pelo caminho de cliques escrito ali: nome acessível + cliques a
// partir do estado do bloco. Nasceu VERDE no layout de 15/10/2026. Cada fatia
// que muda um controle de lugar atualiza o caminho dele; uma linha que some é
// controle perdido, e o redesenho não pode perder nenhum.
//
// COMO PROVA: um teste por tela (cada um abre o app uma vez só), um passo por
// linha (o nome do passo é o controle, e o relatório diz qual não foi
// achado). O estado do bloco é refeito antes de cada linha: a ferramenta pelo
// botão da barra, o diálogo pelo botão que o abre e a seleção pela store (o
// mapa é um canvas; o clique no item não é o que este spec confere).
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { createHostSession } from '../src/net/hostSession'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, RegionPoint } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'
import { BLOCOS, type Alvo, type Bloco, type Escopo, type Tela } from './helpers/ondeFoiParar'

test.use({ trace: 'off', video: 'off' })

const AVENTURA = 'Cripta'
const CODIGO = 'ONDE01'
const PASTA = 'C:/appdata/maps/map_onde'
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const MOVEIS = ['barril', 'catre', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete'] as const

const quadrado = (x: number, y: number, lado: number): RegionPoint[] => [{ x, y }, { x: x + lado, y }, { x: x + lado, y: y + lado }, { x, y: y + lado }]
const parede = (id: string, x1: number, y1: number, x2: number, y2: number) => ({ id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null })

/** Uma cena com um item de cada tipo que tem ficha própria (os ids são os de `ondeFoiParar.ts`). */
function cenaComTudo(): MapData {
  return {
    ...createEmptyMap('map_onde', AVENTURA, 30, 20, 50),
    walls: [parede('w1', 100, 100, 400, 100), { ...parede('d1', 100, 400, 200, 400), door: { open: false, locked: false, kind: 'normal' } }],
    regions: [
      { id: 'r1', points: quadrado(500, 100, 200), tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} },
      { id: 'sala1', points: quadrado(500, 400, 200), tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Salão' } },
    ],
    lights: [{ id: 'l1', x: 900, y: 200, radius: 150, color: '#ffcc66', intensity: 1 }],
    tokens: [{ id: 't1', characterId: null, name: 'Goblin', x: 300, y: 300, size: 1, image: null }],
    props: [
      { id: 'p-img', src: PNG_1PX, x: 1000, y: 500, width: 50, height: 50, linkedMapPath: null },
      ...MOVEIS.map((mobilia, i) => ({ id: `m-${mobilia}`, src: '', x: 100 + i * 80, y: 800, width: 50, height: 50, linkedMapPath: null, mobilia })),
    ],
    stairs: [{ id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 1200, y1: 100, x2: 1200, y2: 300 }], stepWidth: 64 }],
    pins: [
      { id: 'pin-e', x: 700, y: 650, kind: 'exclamacao', description: 'Altar', image: null },
      { id: 'pin-v', x: 800, y: 650, kind: 'viagem', description: 'Saída', image: null },
      { id: 'pin-a', x: 900, y: 650, kind: 'alavanca', description: 'Alavanca', image: null },
    ],
    drawings: [
      { id: 'dr1', kind: 'line', x1: 100, y1: 600, x2: 300, y2: 650, color: '#ffffff', width: 3 },
      { id: 'tx1', kind: 'text', x: 400, y: 700, text: 'Aviso', color: '#ffffff', fontSize: 20 },
    ],
    floor: [{ id: 'f1', shape: { kind: 'rect', cx: 1300, cy: 800, w: 100, h: 100 }, op: 'add', modifiers: {} }],
    concealZones: [{ id: 'z1', points: quadrado(1100, 700, 100), name: 'Segredo', revealed: false }],
  }
}

function discoDaAventura(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_onde', name: AVENTURA, startSceneId: 'scene_onde', scenes: [{ id: 'scene_onde', name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(cenaComTudo()), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

function escopo(page: Page, qual: Escopo): Locator | Page {
  switch (qual) {
    // O livro do mestre (fatia 2): lombada, topo com as ações do mapa e a página aberta.
    case 'esquerda': return page.getByRole('complementary', { name: 'Livro do mestre' })
    case 'barra': return page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
    case 'acoes': return page.getByRole('complementary', { name: 'Livro do mestre' })
    case 'direita': return page.getByRole('complementary', { name: 'Jogo, chat e cenas' })
    case 'pagina': return page
  }
}

/** `/.../` vira expressão regular; o resto é nome exato. */
function achar(onde: Locator | Page, [papel, nome]: Alvo): Locator {
  const regex = nome.length > 2 && nome.startsWith('/') && nome.endsWith('/')
  return onde.getByRole(papel, regex ? { name: new RegExp(nome.slice(1, -1)) } : { name: nome, exact: true }).first()
}

async function selecionar(page: Page, selecao: NonNullable<Bloco['preparo']>['selecao'] = []): Promise<void> {
  await page.evaluate(async (itens) => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection(itens.filter((i) => i.tipo !== 'pin' && i.tipo !== 'zona').map((i) => ({ kind: i.tipo as never, id: i.id })))
    store.setSelectedPin(itens.find((i) => i.tipo === 'pin')?.id ?? null)
    store.setSelectedConcealZone(itens.find((i) => i.tipo === 'zona')?.id ?? null)
  }, selecao)
}

async function preparar(page: Page, bloco: Bloco): Promise<void> {
  const p = bloco.preparo ?? {}
  if (p.selecao !== undefined) await selecionar(page, p.selecao)
  else if (p.ferramenta === undefined && bloco.escopo === 'esquerda') await selecionar(page, [])
  if (p.ferramenta !== undefined) {
    const botao = achar(escopo(page, 'barra'), ['button', p.ferramenta])
    if ((await botao.getAttribute('aria-pressed')) !== 'true') await botao.click()
  }
  if (p.abrir !== undefined && !(await page.getByRole('dialog').first().isVisible())) {
    const abrir = achar(page, p.abrir)
    if (await abrir.isVisible()) await abrir.click()
  }
}

/** Clica o passo, menos seção recolhível que já está aberta (o segundo clique fecharia). */
async function passo(alvo: Locator): Promise<void> {
  if ((await alvo.getAttribute('aria-expanded')) === 'true') return
  await alvo.click()
}

async function conferirBloco(page: Page, bloco: Bloco): Promise<void> {
  await test.step(`${bloco.titulo} (${bloco.estado})`, async () => {
    for (const linha of bloco.linhas) {
      await test.step(linha.controle, async () => {
        await preparar(page, bloco)
        const onde = escopo(page, bloco.escopo)
        for (const clique of linha.caminho) await passo(achar(onde, clique))
        if (linha.tecla !== undefined) await page.keyboard.press(linha.tecla)
        // O menu (Arquivo) abre por cima de tudo, fora do livro.
        const alvo = achar(linha.alvo[0] === 'menuitem' ? page : onde, linha.alvo)
        await expect(alvo, `${bloco.titulo} > ${linha.controle}`).toBeVisible()
        if (linha.focado === true) await expect(alvo).toBeFocused()
        if (bloco.preparo?.escape === true || linha.alvo[0] === 'menuitem') await page.keyboard.press('Escape')
      })
    }
    // Diálogo do bloco fecha no fim, para o bloco seguinte partir do editor.
    if (bloco.preparo?.abrir !== undefined && bloco.tela !== 'jogador') {
      const dialogo = page.getByRole('dialog').first()
      if (await dialogo.isVisible()) await dialogo.getByRole('button', { name: 'Fechar' }).first().click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })
}

const blocosDa = (tela: Tela) => BLOCOS.filter((b) => b.tela === tela)

function vigiarErros(page: Page): string[] {
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  return erros
}

test('mestre: cada controle do inventário está no caminho anotado (editor, barra, fichas, diálogos, coluna da direita)', async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const erros = vigiarErros(page)
  await abrirAventuraDeMentira(page, discoDaAventura(), AVENTURA, CODIGO)
  for (const bloco of blocosDa('mestre')) await conferirBloco(page, bloco)
  expect(erros).toEqual([])
})

test('mestre com a sala aberta: código, Laser, Som, Ruído, Grupo, Mesa, Convidar e Fechar sala', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const erros = vigiarErros(page)
  await abrirAventuraDeMentira(page, discoDaAventura(), AVENTURA, CODIGO)
  await page.getByRole('tab', { name: 'Jogo' }).click()
  await page.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(page.getByText(CODIGO).first()).toBeVisible()
  for (const bloco of blocosDa('mestre-sala-aberta')) await conferirBloco(page, bloco)
  expect(erros).toEqual([])
})

test('jogador no celular (390 px): barra de cima, cantos e aba Jogo', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const erros = vigiarErros(page)
  const mapa: MapData = { ...createEmptyMap('m-jogador', AVENTURA, 20, 12, 50), tokens: [{ id: 'tok-a', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }] }
  const sessao = createHostSession({ code: CODIGO, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  let socket: WebSocketRoute | null = null
  let jogador: string | null = null
  const enviar = (saida: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saida) {
      if (clientId !== 'c1' || socket === null) continue
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') jogador = msg.playerId
    }
  }
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => enviar(sessao.handleMessage('c1', typeof raw === 'string' ? raw : raw.toString('utf8'), mapa).outbound))
  })
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  const id: string | null = jogador
  if (id === null) throw new Error('o mestre de mentira não mandou welcome')
  sessao.assignToken(id, 'tok-a')
  enviar(sessao.broadcast(mapa).outbound)
  await expect(page.getByRole('button', { name: 'Minha ficha' })).toBeVisible()
  for (const bloco of blocosDa('jogador')) await conferirBloco(page, bloco)
  expect(erros).toEqual([])
})

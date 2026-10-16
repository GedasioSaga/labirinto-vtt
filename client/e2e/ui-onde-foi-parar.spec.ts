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
    // O chip da cena (fatia 3), no alto do mapa: Voltar, o nome e o menu de cenas.
    case 'chip': return page.getByRole('group', { name: 'Cena aberta' })
    // O livro da mesa (fatia 4): lombada com Grupo, Chat, Cenas e Mesa, o topo da Sala e a página aberta.
    case 'direita': return page.getByRole('complementary', { name: 'Livro da mesa' })
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
    // Janela aberta por item de menu ("Ver todas as cenas" do chip): primeiro o gatilho do menu.
    if (p.abrirDe !== undefined) await achar(escopo(page, p.abrirDe.escopo), p.abrirDe.gatilho).click()
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
        // Menu, diálogo e pop abrem por cima de tudo, fora do livro.
        const porCima = (papel: Alvo[0]) => papel === 'menuitem' || papel === 'dialog' || papel === 'alertdialog'
        for (const clique of linha.caminho) await passo(achar(porCima(clique[0]) ? page : onde, clique))
        if (linha.tecla !== undefined) await page.keyboard.press(linha.tecla)
        // A ficha aberta de um jogador (bloco com `dentro`): o mesmo nome em outro cartão não conta.
        const dentro = bloco.dentro === undefined ? onde : achar(onde, bloco.dentro)
        const alvo = achar(porCima(linha.alvo[0]) || linha.noPop === true ? page : dentro, linha.alvo)
        await expect(alvo, `${bloco.titulo} > ${linha.controle}`).toBeVisible()
        if (linha.focado === true) await expect(alvo).toBeFocused()
        if (bloco.preparo?.escape === true || linha.alvo[0] === 'menuitem' || linha.noPop === true) await page.keyboard.press('Escape')
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

test('mestre com a sala aberta: código, Laser, Som, Convidar, Mais da sala (Fechar sala), Grupo e Mesa', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const erros = vigiarErros(page)
  await abrirAventuraDeMentira(page, discoDaAventura(), AVENTURA, CODIGO)
  await page.getByRole('tab', { name: 'Grupo' }).click()
  await page.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(page.getByText(CODIGO).first()).toBeVisible()
  for (const bloco of blocosDa('mestre-sala-aberta')) await conferirBloco(page, bloco)
  expect(erros).toEqual([])
})

/**
 * A aventura de sempre com uma segunda cena (o "Mandar para…" só aparece com
 * outra cena para onde mandar) e uma ficha para cada jogador que ganha uma:
 * Ana e Caio; Bruno fica em Chegando.
 */
function discoComJogadores(): Record<string, string> {
  const mapa = cenaComTudo()
  const ficha = (id: string, name: string, x: number) => ({ id, characterId: null, name, x, y: 300, size: 1, image: null })
  const aventura = {
    version: 1, id: 'adv_onde', name: AVENTURA, startSceneId: 'scene_onde',
    scenes: [{ id: 'scene_onde', name: AVENTURA, file: 'map.json' }, { id: 'scene_porao', name: 'Porão', file: 'porao.json' }],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap({ ...mapa, tokens: [...mapa.tokens, ficha('t-ana', 'Guerreira', 400), ficha('t-caio', 'Ladino', 450)] }),
    [`${PASTA}/porao.json`]: serializeMap(createEmptyMap('map_porao', 'Porão', 20, 12, 50)),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
  }
}

/** Um evento do transporte Rust (`net:message`, `net:peer`), pelo `__emitTauri` que o mestreDeMentira põe na janela. */
async function emitir(page: Page, evento: string, payload: unknown): Promise<void> {
  // A janela do app não declara o __emitTauri: é o init script do mestreDeMentira que o põe.
  await page.evaluate(({ e, p }) => (window as unknown as { __emitTauri(e: string, p: unknown): void }).__emitTauri(e, p), { e: evento, p: payload })
}

/** "Atribuir token" de quem está em Chegando: a lista com as fichas da cena. */
async function atribuir(page: Page, jogador: string, ficha: string): Promise<void> {
  const livro = escopo(page, 'direita')
  const lista = livro.locator('.gr-chegando', { hasText: jogador }).getByRole('combobox', { name: 'Atribuir token' })
  const texto = (await lista.locator('option', { hasText: ficha }).first().textContent()) ?? ficha
  await lista.selectOption({ label: texto.trim() })
  await expect(livro.getByRole('button', { name: `Remover ${ficha}` })).toBeVisible()
}

/** O anel de foco do teclado: o controle recebe o foco pelo Tab (é aí que :focus-visible vale) e o box-shadow não pode ser 'none'. */
async function anelDeFoco(page: Page, alvo: Locator): Promise<string> {
  await alvo.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(alvo).toBeFocused()
  return alvo.evaluate((el) => getComputedStyle(el).boxShadow)
}

test('mestre com jogadores: Grupo com Ana na cena, Bruno chegando e Caio fora; cada parte da ficha', async ({ page }) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const erros = vigiarErros(page)
  await abrirAventuraDeMentira(page, discoComJogadores(), AVENTURA, CODIGO)
  await page.getByRole('tab', { name: 'Grupo' }).click()
  await page.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(page.getByText(CODIGO).first()).toBeVisible()
  for (const [c, nome] of [['c1', 'Ana'], ['c2', 'Bruno'], ['c3', 'Caio']]) await emitir(page, 'net:message', { clientId: c, msg: { type: 'join', code: CODIGO, name: nome } })
  // Quem fica calado mais de 6 s cai (HOST_STALE_AFTER_MS): Ana e Bruno mandam ping o teste todo; Caio, até cair.
  await page.evaluate(() => {
    const janela = window as unknown as { __emitTauri(e: string, p: unknown): void; __pings: string[] } // idem: o __emitTauri do mestreDeMentira
    janela.__pings = ['c1', 'c2', 'c3']
    setInterval(() => { for (const c of janela.__pings) janela.__emitTauri('net:message', { clientId: c, msg: { type: 'ping' } }) }, 1_500)
  })
  await atribuir(page, 'Ana', 'Guerreira')
  await atribuir(page, 'Caio', 'Ladino')
  await page.evaluate(() => { (window as unknown as { __pings: string[] }).__pings = ['c1', 'c2'] }) // idem
  await emitir(page, 'net:peer', { clientId: 'c3', event: 'disconnected' })
  await expect(escopo(page, 'direita').getByRole('button', { name: /Caio — jogando · desconectado/ })).toBeVisible()

  // Foco do teclado nos botões de antes dentro do Grupo (o lb-btn com o visual novo): o anel aparece.
  const livro = escopo(page, 'direita')
  expect(await anelDeFoco(page, livro.getByRole('button', { name: 'Emprestar como ajudante…' }).first()), 'Emprestar como ajudante… sem anel de foco').not.toBe('none')
  const primario = livro.locator('.gr-grupo .lb-btn--primary').first()
  // O primário soma o brilho de cima (inset) ao anel (0 0 0 4px).
  if ((await primario.count()) > 0) expect(await anelDeFoco(page, primario), 'botão primário do Grupo sem anel de foco').toMatch(/inset.*0px 0px 0px 4px|0px 0px 0px 4px.*inset/)

  for (const bloco of blocosDa('mestre-com-jogadores')) await conferirBloco(page, bloco)
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

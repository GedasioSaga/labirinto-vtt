// E2E do HUD do jogador: nada por cima de nada, nada fora da tela.
//
// O QUE PROVA: os controles e selos que flutuam sobre o mapa do jogador — a
// barra de cima, a coluna do canto da direita (abas de andar, "Onde estou",
// confronto e as rolagens no pé), a pilha do canto de baixo à direita (zoom,
// "Chamar o mestre", alto-falante), a coluna das ações do lugar (espiar,
// trancar, subir), a faixa "Sua vez" e o selo de estado (hora do dia, tela
// acesa) — nos tamanhos de tela que o jogador usa: o notebook do mestre
// (1280 x 800), o celular em pé (390 x 844 e 320 x 568) e deitado (844 x 390,
// 844 x 340 com a barra do navegador, 667 x 375 e 568 x 320). Com TUDO aceso
// ao mesmo tempo, que é o pior caso: a ficha encostada numa escada que liga
// pisos E numa porta fechada, abas de andar, confronto, "Sua vez", hora do
// dia, tela acesa, quatro rolagens e a mão do "Chamar o mestre" acesa (duas
// linhas). O formulário do chamado, aberto, também cabe na tela.
//
// COMO PROVA: `player.html` inteiro no Chromium de verdade, com o host feito
// pelo próprio teste no WebSocket roteado (como task-controle-de-som.spec.ts).
// As caixas são as de `getBoundingClientRect` de cada flutuante visível; o
// teste falha se duas se cruzam, se uma sai da tela, se um controle não é o
// que o dedo acerta no meio dele (`elementFromPoint`), se o alvo tem menos de
// 44 px no dedo (24 no mouse) ou se uma rolagem aparece cortada pela metade.
// Em tela de gaveta, com a gaveta aberta, nada do mapa fica por cima dela — e
// a rolagem feita de dentro da gaveta aparece nela.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { addToken, createEmptyMap } from '../src/lib/mapFactory'
import type { MapData, RegionPoint, Stair, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const LADO = 1000
const VISAO_TODA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: LADO, y: 0 },
    { x: LADO, y: LADO },
    { x: 0, y: LADO },
  ],
]

/** Porta fechada e destrancada a uma célula da ficha: acende "Espiar pela porta" e o ferrolho. */
const PORTA: Wall = {
  id: 'porta',
  x1: 275,
  y1: 200,
  x2: 275,
  y2: 250,
  blocksLight: true,
  blocksMove: true,
  door: { open: false, locked: false, kind: 'normal' },
}

/** Escada que leva ao 1º piso, encostada na ficha: acende "Subir ao 1º piso". */
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 225, y1: 275, x2: 225, y2: 325 }], stepWidth: 50, levaAoPiso: 1 }

function mapaDoJogador(): MapData {
  const base = createEmptyMap('m1', 'Salão', 20, 20, 50)
  const comAna = addToken(base, { id: 'ficha-ana', characterId: null, name: 'Ana', x: 225, y: 225, size: 1, image: null })
  const comRato = addToken(comAna, { id: 'rato-1', characterId: null, name: 'Rato 1', x: 525, y: 525, size: 1, image: null })
  const comBia = addToken(comRato, { id: 'bia', characterId: null, name: 'Bia', x: 625, y: 525, size: 1, image: null })
  return { ...comBia, walls: [PORTA], stairs: [ESCADA] }
}

/** Outro andar do prédio que ele já conhece: acende as abas de andar. */
function outroAndar(): { rotulo: string; map: MapData; explored: ReturnType<typeof encodeExploration>; concealed: RegionPoint[][] } {
  const map = createEmptyMap('m2', 'Sótão', 20, 20, 50)
  return { rotulo: '2F', map, explored: encodeExploration(createExploration(map)), concealed: [] }
}

/** Tudo o que acende um flutuante, num recorte só. */
function recorte(): Record<string, unknown> {
  const map = mapaDoJogador()
  return {
    type: 'snapshot',
    rev: 1,
    map,
    vision: VISAO_TODA,
    explored: encodeExploration(createExploration(map)),
    ownTokens: ['ficha-ana'],
    concealed: [],
    sceneName: 'Casa do porto',
    turn: 'ficha-ana',
    confronto: { fila: ['ficha-ana', 'rato-1', 'bia'], vez: 'ficha-ana', suaVez: true, passo: 6, restam: 6 },
    andares: { atual: '1F', outros: [outroAndar()] },
    relogio: { periodo: 'noite', escuro: true },
  }
}

/** Rolagem de 2d6+3 que alguém da mesa fez: a linha mais larga que a lista mostra ("Bia 2d6+3 = 14 (5, 6)"). */
function rolagem(id: string, faces: readonly [number, number], de = 'Bia') {
  const total = faces[0] + faces[1] + 3
  return { type: 'dice.rolled', roll: { id, from: de, count: 2, sides: 6, modifier: 3, results: [...faces], total, at: 2_000 } }
}

/** Quatro rolagens: a lista inteira (`DICE_FEED_VISIBLE`). A última dá 14. */
const ROLAGENS: ReadonlyArray<readonly [number, number]> = [
  [6, 6],
  [1, 2],
  [4, 3],
  [5, 6],
]

/** O host de mentira: a cada `join` responde com a sessão e o recorte. */
class HostDeMentira {
  private socket: WebSocketRoute | null = null

  ligar(ws: WebSocketRoute): void {
    this.socket = ws
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      this.mandar({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' })
      this.mandar(recorte())
    })
  }

  mandar(msg: object): void {
    if (this.socket === null) throw new Error('nenhum jogador conectado')
    this.socket.send(JSON.stringify(msg))
  }
}

/** Roda NA PÁGINA antes de qualquer script dela: a trava de tela acesa sempre concedida (o selo "Tela acesa" aparece). */
function telaAcesaConcedida(): void {
  const sentinela = { release: async () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }
  Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => ({ request: async () => sentinela }) })
}

async function jogadorEntra(page: Page): Promise<HostDeMentira> {
  const host = new HostDeMentira()
  await page.addInitScript(telaAcesaConcedida)
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => host.ligar(ws),
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill('HUD123')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  return host
}

/** Mede só depois das entradas (deslizes e escalas curtos): no meio delas a caixa ainda não está no lugar. As que repetem para sempre não contam. */
async function esperarAsEntradas(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animacao) => animacao.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((animacao) => animacao.finished),
    ),
  )
}

/** A foto da tela na pasta do teste (também quando ele passa): é a prova para quem olha depois. */
async function fotografar(page: Page, nome: string): Promise<void> {
  const caminho = test.info().outputPath(`${nome}.png`)
  await page.screenshot({ path: caminho })
  await test.info().attach(nome, { path: caminho, contentType: 'image/png' })
}

/** O que flutua sobre o mapa. `toque`: é controle, e o dedo tem de acertá-lo pelo meio. */
interface Flutuante {
  nome: string
  seletor: string
  toque: boolean
}

const FLUTUANTES: readonly Flutuante[] = [
  { nome: 'Painel', seletor: '.pp-bar > .pp-toggle', toque: true },
  { nome: 'Minha ficha', seletor: '.pp-bar > .pp-mine', toque: true },
  { nome: 'Inventário', seletor: '.pp-bar > .pp-bag', toque: true },
  { nome: 'gaveta do painel', seletor: '.pp-panel', toque: false },
  { nome: 'abas de andar', seletor: '.pp-floors__list', toque: true },
  { nome: 'Onde estou', seletor: '.pp-where', toque: true },
  { nome: 'confronto', seletor: '.pp-confronto', toque: false },
  { nome: 'Sua vez', seletor: '.pp-turn', toque: false },
  { nome: 'hora do dia', seletor: '.pp-clock', toque: false },
  { nome: 'tela acesa', seletor: '.pp-awake', toque: false },
  { nome: 'zoom', seletor: '.pp-zoom', toque: true },
  { nome: 'som', seletor: '.pp-som .lb-som__gatilho', toque: true },
  { nome: 'escada', seletor: '.pp-escada__button', toque: true },
  { nome: 'mão do chamado', seletor: '.pp-call__hand, .pp-call__lower', toque: true },
  { nome: 'linha do chamado', seletor: '.pp-call__notice, .pp-call__lit', toque: false },
  { nome: 'rolagens', seletor: '.pp-dice-feed', toque: false },
  { nome: 'ferrolho', seletor: '.pp-ferrolho', toque: true },
  { nome: 'Espiar pela porta', seletor: '.pp-espiar', toque: true },
]

/** A barra é o cabeçalho da gaveta: morar dentro dela é o desenho, não sobreposição. */
const JUNTOS_DE_PROPOSITO: ReadonlyArray<readonly [string, string]> = [
  ['Painel', 'gaveta do painel'],
  ['Minha ficha', 'gaveta do painel'],
  ['Inventário', 'gaveta do painel'],
]

interface Medida {
  nome: string
  x: number
  y: number
  largura: number
  altura: number
  toque: boolean
  /** O dedo no meio da caixa acerta o próprio controle (só conta para `toque`). */
  acertado: boolean
  /** Rolagens: alguma linha cortada pela caixa da lista. */
  linhaCortada: boolean
}

/** Mede, na página, cada flutuante visível (desenhado, com opacidade e tamanho). */
async function medir(page: Page): Promise<Medida[]> {
  return page.evaluate((lista) => {
    const medidas: Medida[] = []
    for (const { nome, seletor, toque } of lista) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        const alvo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        // Só nas rolagens: a caixa do pé da coluna do canto corta o que passa dela, e a lista
        // tem de esconder as mais velhas inteiras, nunca deixar uma pela metade à vista.
        const linhas = nome === 'rolagens' ? Array.from(el.querySelectorAll('li')).filter((li) => li.checkVisibility()) : []
        const recorte = (el.closest('.pp-rolagens') ?? el).getBoundingClientRect()
        const linhaCortada = linhas.some((li) => {
          const l = li.getBoundingClientRect()
          return l.top < recorte.top - 0.5 || l.bottom > recorte.bottom + 0.5
        })
        medidas.push({ nome, x: r.x, y: r.y, largura: r.width, altura: r.height, toque, acertado: alvo !== null && el.contains(alvo), linhaCortada })
      }
    }
    return medidas
  }, FLUTUANTES)
}

const FOLGA = 0.5

function cruzam(a: Medida, b: Medida): boolean {
  return a.x + FOLGA < b.x + b.largura && b.x + FOLGA < a.x + a.largura && a.y + FOLGA < b.y + b.altura && b.y + FOLGA < a.y + a.altura
}

function dePropósito(a: string, b: string): boolean {
  return JUNTOS_DE_PROPOSITO.some(([p, q]) => (p === a && q === b) || (p === b && q === a))
}

const fmt = (m: Medida): string => `${m.nome} [${Math.round(m.x)},${Math.round(m.y)} ${Math.round(m.largura)}x${Math.round(m.altura)}]`

/** Tudo o que está errado na tela: cruzamentos, fora da tela, controle coberto, alvo pequeno, rolagem cortada. */
function problemas(medidas: readonly Medida[], tela: { width: number; height: number }, toqueMinimo: number): string[] {
  const achados: string[] = []
  for (const m of medidas) {
    if (m.x < -FOLGA || m.y < -FOLGA || m.x + m.largura > tela.width + FOLGA || m.y + m.altura > tela.height + FOLGA) achados.push(`fora da tela: ${fmt(m)}`)
    if (m.toque && !m.acertado) achados.push(`coberto (o dedo no meio acerta outra coisa): ${fmt(m)}`)
    if (m.toque && (m.altura < toqueMinimo - FOLGA || m.largura < toqueMinimo - FOLGA)) achados.push(`alvo de toque pequeno: ${fmt(m)}`)
    if (m.linhaCortada) achados.push(`rolagem cortada: ${fmt(m)}`)
  }
  for (let i = 0; i < medidas.length; i += 1) {
    for (let j = i + 1; j < medidas.length; j += 1) {
      const a = medidas[i]
      const b = medidas[j]
      if (a === undefined || b === undefined || a.nome === b.nome || dePropósito(a.nome, b.nome)) continue
      if (cruzam(a, b)) achados.push(`${fmt(a)} cruza ${fmt(b)}`)
    }
  }
  return achados
}

interface Tela {
  width: number
  height: number
  /** Celular: dedo (pointer coarse, sem hover). */
  toque: boolean
  /** O painel é gaveta (nasce fechada, aberta cobre o mapa): menos de 700 px de largura ou até 480 de altura. */
  gaveta: boolean
}

const TELAS: readonly Tela[] = [
  { width: 1280, height: 800, toque: false, gaveta: false },
  { width: 390, height: 844, toque: true, gaveta: true },
  { width: 320, height: 568, toque: true, gaveta: true },
  { width: 844, height: 390, toque: true, gaveta: true },
  { width: 844, height: 340, toque: true, gaveta: true },
  { width: 667, height: 375, toque: true, gaveta: true },
  { width: 568, height: 320, toque: true, gaveta: true },
]

/** Tudo o que o recorte acende tem de estar medido: sem isso o teste passaria com a tela vazia. */
const ACESOS = [
  'Painel',
  'Minha ficha',
  'Inventário',
  'abas de andar',
  'Onde estou',
  'confronto',
  'Sua vez',
  'hora do dia',
  'tela acesa',
  'zoom',
  'som',
  'escada',
  'mão do chamado',
  'linha do chamado',
  'rolagens',
  'ferrolho',
  'Espiar pela porta',
]

/** O dedo no alvo: o mínimo de 44 px do tema. Mouse: os 24 px da WCAG 2.5.8 — no notebook o "Onde estou" tem 36. */
const alvoMinimo = (tela: Tela): number => (tela.toque ? 44 : 24)

for (const tela of TELAS) {
  test.describe(`${tela.width}x${tela.height}${tela.toque ? ' (dedo)' : ''}`, () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, hasTouch: tela.toque, isMobile: tela.toque })

    test('com tudo aceso, nenhum flutuante cruza outro nem sai da tela', async ({ page }) => {
      const host = await jogadorEntra(page)
      for (const [i, faces] of ROLAGENS.entries()) host.mandar(rolagem(`r${i}`, faces))
      await expect(page.getByRole('log', { name: 'Rolagens' }).getByText('14', { exact: true })).toBeVisible()
      // O formulário do chamado, aberto, cabe inteiro na tela — deitado, a mão mora no pé dela e
      // o formulário, mais alto que a tela, rola por dentro. A mão continua à vista em cima dele.
      const mao = page.getByRole('button', { name: 'Chamar o mestre' })
      await mao.click()
      const formulario = page.locator('.pp-call__form')
      await expect(formulario).toBeVisible()
      await esperarAsEntradas(page)
      for (const [oQue, alvo] of [
        ['o formulário do chamado', formulario],
        ['a mão, com o formulário aberto', mao],
      ] as const) {
        const caixaAberta = await alvo.boundingBox()
        if (caixaAberta === null) throw new Error(`${oQue} sem caixa`)
        expect(caixaAberta.y, `o alto de ${oQue} na tela`).toBeGreaterThanOrEqual(0)
        expect(caixaAberta.x, `a esquerda de ${oQue} na tela`).toBeGreaterThanOrEqual(0)
        expect(caixaAberta.y + caixaAberta.height, `o pé de ${oQue} na tela`).toBeLessThanOrEqual(tela.height)
      }
      await fotografar(page, `chamado-aberto-${tela.width}x${tela.height}`)
      // A mão acesa ocupa as duas linhas do chamado ("Esperando o mestre" e "Baixar a mão").
      await page.getByRole('button', { name: 'Chamar', exact: true }).click()
      await expect(page.getByText(/^Esperando o mestre/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Subir ao 1º piso' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Espiar pela porta' })).toBeVisible()
      await expect(page.getByText('Tela acesa')).toBeVisible()
      await esperarAsEntradas(page)

      const medidas = await medir(page)
      await fotografar(page, `hud-${tela.width}x${tela.height}`)
      await test.info().attach(`hud-${tela.width}x${tela.height}.json`, { body: JSON.stringify(medidas, null, 2), contentType: 'application/json' })
      const medidos = new Set(medidas.map((m) => m.nome))
      expect(ACESOS.filter((nome) => !medidos.has(nome)), 'flutuantes que deviam estar acesos e não foram medidos').toEqual([])
      // A coluna do notebook nasce aberta e entra na conta; a gaveta do celular nasce fechada.
      expect(medidos.has('gaveta do painel')).toBe(!tela.gaveta)
      expect(problemas(medidas, tela, alvoMinimo(tela))).toEqual([])
    })

    test('gaveta aberta: nada do mapa fica por cima dela, a rolagem feita por ela aparece nela, e fechar devolve o HUD', async ({ page }) => {
      test.skip(!tela.gaveta, 'no notebook o painel é coluna, aberta desde a entrada: o teste de cima já a mede')
      const host = await jogadorEntra(page)
      for (const [i, faces] of ROLAGENS.entries()) host.mandar(rolagem(`r${i}`, faces))
      await expect(page.getByRole('log', { name: 'Rolagens' }).getByText('14', { exact: true })).toBeVisible()
      // Fechada ela se chama "Painel"; aberta, "Fechar painel".
      const botaoDoPainel = page.getByRole('button', { name: /^(Fechar )?painel$/i })
      await botaoDoPainel.click()
      const gaveta = page.getByRole('complementary', { name: 'Painel do jogador' })
      await expect(gaveta).toBeVisible()
      await esperarAsEntradas(page)

      // Só a barra (o cabeçalho da gaveta) e a gaveta: o zoom, a mão, o som, a coluna do canto e as ações do lugar saíram de cena.
      const comAGaveta = await medir(page)
      expect(comAGaveta.map((m) => m.nome).filter((nome) => !['Painel', 'Minha ficha', 'Inventário', 'gaveta do painel'].includes(nome))).toEqual([])
      expect(problemas(comAGaveta, tela, alvoMinimo(tela))).toEqual([])

      // Rolar pela gaveta: o pedido sai, o host devolve a rolagem da mesa, e ela aparece embaixo do formulário.
      await gaveta.getByRole('tab', { name: 'Dados' }).click()
      await gaveta.getByRole('button', { name: 'd6', exact: true }).click()
      await gaveta.getByRole('button', { name: 'Rolar', exact: true }).click()
      host.mandar(rolagem('r-gaveta', [1, 1], 'Ana'))
      const naGaveta = gaveta.getByRole('log', { name: 'Rolagens' })
      await expect(naGaveta.getByText('5', { exact: true })).toBeVisible()
      await naGaveta.scrollIntoViewIfNeeded()
      const caixaDaGaveta = await gaveta.boundingBox()
      const caixaDaLista = await naGaveta.boundingBox()
      if (caixaDaGaveta === null || caixaDaLista === null) throw new Error('a gaveta ou a lista de rolagens dela sem caixa')
      expect(caixaDaLista.y + caixaDaLista.height).toBeLessThanOrEqual(caixaDaGaveta.y + caixaDaGaveta.height + FOLGA)
      await fotografar(page, `gaveta-${tela.width}x${tela.height}`)

      // Fechar devolve o HUD inteiro, com a rolagem nova no pé da coluna do canto.
      await botaoDoPainel.click()
      await expect(gaveta).toBeHidden()
      await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
      await expect(page.getByRole('log', { name: 'Rolagens' }).getByText('5', { exact: true })).toBeVisible()
    })
  })
}

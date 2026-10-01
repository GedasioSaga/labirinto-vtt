// E2E do HUD do jogador: nada por cima de nada, nada fora da tela.
//
// O QUE PROVA: os controles e selos que flutuam sobre o mapa do jogador — a
// barra de cima, a coluna do canto da direita (abas de andar, "Onde estou",
// confronto e as rolagens no pé), a pilha do canto de baixo à direita (zoom,
// "Chamar o mestre", alto-falante), a coluna das ações do lugar (espiar,
// trancar, subir), a faixa "Sua vez", o selo de estado (hora do dia, tela
// acesa), a faixa do alarme, a faixa da porta trancada e os avisos — nos
// tamanhos de tela que o jogador usa: o notebook do mestre (1280 x 800), o
// tablet em pé com a coluna do painel aberta (768 x 1024), o celular em pé
// (390 x 844 e 320 x 568) e deitado (844 x 390, 844 x 340 com a barra do
// navegador, 667 x 375 e 568 x 320).
//
// Primeiro com TUDO aceso ao mesmo tempo: a ficha encostada numa escada que
// liga pisos E numa porta fechada, abas de andar, confronto, "Sua vez", hora
// do dia, tela acesa, quatro rolagens (a mais nova de nome comprido e quatro
// dados) e a mão do "Chamar o mestre" acesa (duas linhas). Depois os casos que
// apertam um canto da tela: a porta trancada com a faixa dos pedidos no
// celular deitado (com e sem alarme), o alarme com o confronto de sete
// fichas, a pausa com um aviso que passa, e o tablet com a coluna do painel
// aberta, sem abas de andar e com a porta aberta.
//
// COMO PROVA: `player.html` inteiro no Chromium de verdade, com o host feito
// pelo próprio teste no WebSocket roteado (como task-controle-de-som.spec.ts).
// As caixas são as de `getBoundingClientRect` de cada flutuante visível; o
// teste falha se duas se cruzam, se uma sai da tela, se um controle não é o
// que o dedo acerta no meio dele (`elementFromPoint`), se o alvo tem menos de
// 44 px no dedo (24 no mouse) ou se uma rolagem aparece cortada pela metade.
// Em tela de gaveta, com a gaveta aberta, nada do mapa fica por cima dela — e
// a rolagem feita de dentro da gaveta aparece nela. Por dentro, aba por aba, o
// miolo dela não rola de lado, nenhuma aba nem controle passa da borda, e cada
// aba tem o alvo do dedo e é o que o dedo acerta no meio dela.
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

/**
 * A porta a uma célula da ficha. Fechada: acende "Espiar pela porta" e o
 * ferrolho ("Trancar deste lado"). Aberta: só o ferrolho, com o rótulo mais
 * comprido ("Fechar e trancar deste lado"). Trancada pelo mestre: só o
 * "Espiar" — e o toque nela traz a faixa dos pedidos ("Trancada").
 */
type Porta = 'fechada' | 'aberta' | 'trancada'

/** O que a cena acende, além do que todo recorte traz (a ficha, a escada, a vez, a hora do dia). */
interface Cena {
  porta: Porta
  /** Quem divide a fila do confronto com a Ana, na ordem. */
  fila: readonly string[]
  /** Outro andar do prédio que ele já conhece: acende as abas de andar. */
  andares: boolean
}

const FILA_CURTA = ['Rato 1', 'Bia']
/** Sete fichas na fila: no celular ela quebra em três linhas. */
const FILA_LONGA = ['Rato 1', 'Bia', 'Rato 2', 'Bartolomeu', 'Rato 3', 'Guarda do porto']
const CENA_CHEIA: Cena = { porta: 'fechada', fila: FILA_CURTA, andares: true }

function porta(tipo: Porta): Wall {
  return {
    id: 'porta',
    x1: 275,
    y1: 200,
    x2: 275,
    y2: 250,
    blocksLight: true,
    blocksMove: true,
    door: { open: tipo === 'aberta', locked: tipo === 'trancada', kind: 'normal' },
  }
}

/** Escada que leva ao 1º piso, encostada na ficha: acende "Subir ao 1º piso". */
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 225, y1: 275, x2: 225, y2: 325 }], stepWidth: 50, levaAoPiso: 1 }

function mapaDoJogador(cena: Cena): MapData {
  let mapa = addToken(createEmptyMap('m1', 'Salão', 20, 20, 50), { id: 'ficha-ana', characterId: null, name: 'Ana', x: 225, y: 225, size: 1, image: null })
  for (const [i, nome] of cena.fila.entries()) {
    mapa = addToken(mapa, { id: `ficha-${i}`, characterId: null, name: nome, x: 525 + 50 * i, y: 525, size: 1, image: null })
  }
  return { ...mapa, walls: [porta(cena.porta)], stairs: [ESCADA] }
}

function outroAndar(): { rotulo: string; map: MapData; explored: ReturnType<typeof encodeExploration>; concealed: RegionPoint[][] } {
  const map = createEmptyMap('m2', 'Sótão', 20, 20, 50)
  return { rotulo: '2F', map, explored: encodeExploration(createExploration(map)), concealed: [] }
}

/** Tudo o que acende um flutuante, num recorte só. */
function recorte(cena: Cena): Record<string, unknown> {
  const map = mapaDoJogador(cena)
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
    confronto: { fila: map.tokens.map((t) => t.id), vez: 'ficha-ana', suaVez: true, passo: 6, restam: 6 },
    ...(cena.andares ? { andares: { atual: '1F', outros: [outroAndar()] } } : {}),
    relogio: { periodo: 'noite', escuro: true },
  }
}

interface Rolagem {
  de: string
  faces: readonly number[]
  modificador: number
}

function rolagem(id: string, { de, faces, modificador }: Rolagem) {
  const total = faces.reduce((soma, face) => soma + face, modificador)
  return { type: 'dice.rolled', roll: { id, from: de, count: faces.length, sides: 6, modifier: modificador, results: [...faces], total, at: 2_000 } }
}

/**
 * Quatro rolagens: a lista inteira (`DICE_FEED_VISIBLE`). A mais nova é a
 * linha mais larga — nome comprido e quatro dados: "Bartolomeu 4d6+3 = 18
 * (3, 4, 6, 2)". Ela passava por baixo do ferrolho a 320 e 390 px.
 */
const ROLAGENS: readonly Rolagem[] = [
  { de: 'Bia', faces: [6, 6], modificador: 3 },
  { de: 'Bia', faces: [1, 2], modificador: 3 },
  { de: 'Bia', faces: [4, 3], modificador: 3 },
  { de: 'Bartolomeu', faces: [3, 4, 6, 2], modificador: 3 },
]
const TOTAL_DA_MAIS_NOVA = '18'

/** O host de mentira: a cada `join` responde com a sessão e o recorte da cena. */
class HostDeMentira {
  private socket: WebSocketRoute | null = null

  constructor(private readonly cena: Cena) {}

  ligar(ws: WebSocketRoute): void {
    this.socket = ws
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      this.mandar({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' })
      this.mandar(recorte(this.cena))
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

async function jogadorEntra(page: Page, cena: Cena = CENA_CHEIA): Promise<HostDeMentira> {
  const host = new HostDeMentira(cena)
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

/**
 * As quatro rolagens chegam. Com `aVista`, a mais nova — a mais larga —
 * aparece com o total à vista; sem, basta ter chegado: com alarme e confronto
 * longo a coluna do canto pode não ter altura para nenhuma, e quem cede são elas.
 */
async function rolarTudo(page: Page, host: HostDeMentira, aVista = true): Promise<void> {
  for (const [i, uma] of ROLAGENS.entries()) host.mandar(rolagem(`r${i}`, uma))
  const total = page.getByRole('log', { name: 'Rolagens' }).getByText(TOTAL_DA_MAIS_NOVA, { exact: true })
  await (aVista ? expect(total).toBeVisible() : expect(total).toHaveCount(1))
}

/** A mão acesa ocupa as duas linhas do chamado ("Esperando o mestre" e "Baixar a mão"). */
async function chamarOMestre(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Chamar o mestre' }).click()
  await page.getByRole('button', { name: 'Chamar', exact: true }).click()
  await expect(page.getByText(/^Esperando o mestre/)).toBeVisible()
}

/** O alarme do mestre: a faixa de ponta a ponta no alto, e o que mora no alto desce a altura dela. */
async function soarOAlarme(page: Page, host: HostDeMentira): Promise<void> {
  host.mandar({ type: 'scene.alarm', id: 'alarme-1', text: 'Fogo no porão!' })
  await expect(page.getByText('Fogo no porão!')).toBeVisible()
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

/** Os avisos que ficam na tela enquanto o estado dura (pausa, ficha congelada, viagem esperando, encontro): moram um andar acima dos que passam. */
const AVISOS_QUE_FICAM = '.pp-notice--pause, .pp-notice--congelado, .pp-notice--travel, .pp-notice--wait'

const FLUTUANTES: readonly Flutuante[] = [
  { nome: 'Painel', seletor: '.pp-bar > .pp-toggle', toque: true },
  { nome: 'Minha ficha', seletor: '.pp-bar > .pp-mine', toque: true },
  { nome: 'Inventário', seletor: '.pp-bar > .pp-bag', toque: true },
  { nome: 'gaveta do painel', seletor: '.pp-panel', toque: false },
  { nome: 'alarme', seletor: '.pp-alarm', toque: false },
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
  { nome: 'faixa da porta', seletor: '.pp-notice--door', toque: false },
  { nome: 'pedido da porta', seletor: '.pp-notice--door button', toque: true },
  { nome: 'aviso que fica', seletor: AVISOS_QUE_FICAM, toque: false },
  { nome: 'aviso', seletor: `.pp-notice:not(.pp-notice--door, ${AVISOS_QUE_FICAM})`, toque: false },
]

/** A barra é o cabeçalho da gaveta, e os pedidos moram na faixa da porta: morar dentro é o desenho, não sobreposição. */
const JUNTOS_DE_PROPOSITO: ReadonlyArray<readonly [string, string]> = [
  ['Painel', 'gaveta do painel'],
  ['Minha ficha', 'gaveta do painel'],
  ['Inventário', 'gaveta do painel'],
  ['faixa da porta', 'pedido da porta'],
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
  /** Celular e tablet: dedo (pointer coarse, sem hover). */
  toque: boolean
  /** O painel é gaveta (nasce fechada, aberta cobre o mapa): menos de 700 px de largura ou até 480 de altura. */
  gaveta: boolean
}

const NOTEBOOK: Tela = { width: 1280, height: 800, toque: false, gaveta: false }
/** Janela de 768 px com a coluna do painel aberta: a faixa livre do mapa tem uns 370 px. */
const TABLET_EM_PE: Tela = { width: 768, height: 1024, toque: false, gaveta: false }
const TABLET_DEITADO: Tela = { width: 1024, height: 768, toque: false, gaveta: false }
const EM_PE: Tela = { width: 390, height: 844, toque: true, gaveta: true }
const EM_PE_ESTREITO: Tela = { width: 320, height: 568, toque: true, gaveta: true }
const DEITADO_LARGO: Tela = { width: 844, height: 390, toque: true, gaveta: true }
const DEITADO_BAIXO: Tela = { width: 844, height: 340, toque: true, gaveta: true }
const DEITADO_MEDIO: Tela = { width: 667, height: 375, toque: true, gaveta: true }
const DEITADO_PEQUENO: Tela = { width: 568, height: 320, toque: true, gaveta: true }

const TELAS: readonly Tela[] = [NOTEBOOK, TABLET_EM_PE, EM_PE, EM_PE_ESTREITO, DEITADO_LARGO, DEITADO_BAIXO, DEITADO_MEDIO, DEITADO_PEQUENO]

const nomeDaTela = (tela: Tela): string => `${tela.width}x${tela.height}${tela.toque ? ' (dedo)' : ''}`

/** Tudo o que o recorte cheio acende tem de estar medido: sem isso o teste passaria com a tela vazia. */
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

/** Mede a tela, guarda a foto e as caixas, e devolve as medidas. */
async function medirEFotografar(page: Page, nome: string): Promise<Medida[]> {
  await esperarAsEntradas(page)
  const medidas = await medir(page)
  await fotografar(page, nome)
  await test.info().attach(`${nome}.json`, { body: JSON.stringify(medidas, null, 2), contentType: 'application/json' })
  return medidas
}

/** Os acesos que não foram medidos: o teste que passa com eles apagados não prova nada. */
function apagados(medidas: readonly Medida[], acesos: readonly string[]): string[] {
  const medidos = new Set(medidas.map((m) => m.nome))
  return acesos.filter((nome) => !medidos.has(nome))
}

function caixaDe(medidas: readonly Medida[], nome: string): Medida {
  const achada = medidas.find((m) => m.nome === nome)
  if (achada === undefined) throw new Error(`${nome} não foi medido`)
  return achada
}

/** As abas da gaveta, na ordem. O Chat é a última: a que saía da tela a 320 px. */
const ABAS_DA_GAVETA = ['Jogo', 'Caderno', 'Lugares', 'Dados', 'Chat']

/**
 * Por dentro da gaveta aberta: o miolo não rola de lado, cada aba e cada
 * controle à vista ficam entre as bordas dele, e cada aba tem o alvo do dedo e
 * é o que o dedo acerta no meio dela. A caixa da gaveta sozinha não pega isso:
 * a 320 px ela cabia na tela, mas a fileira de abas era mais larga que ela — o
 * miolo rolava de lado, a aba "Chat" saía da tela (o dedo no meio dela
 * acertava o mapa) e todos os botões perdiam a borda direita.
 */
async function problemasPorDentroDaGaveta(page: Page, toqueMinimo: number): Promise<string[]> {
  return page.evaluate(
    ({ toqueMinimo, folga }) => {
      const corpo = document.querySelector<HTMLElement>('.pp-panel:not([hidden]) .pp-panel__body')
      if (corpo === null) return ['a gaveta aberta sem o miolo (.pp-panel__body)']
      const achados: string[] = []
      if (corpo.scrollWidth > corpo.clientWidth) achados.push(`o miolo rola de lado: ${corpo.scrollWidth} px de conteúdo em ${corpo.clientWidth}`)
      // A borda que corta é a do miolo (a caixa que rola), por dentro da borda do cartão.
      const esquerda = corpo.getBoundingClientRect().left + corpo.clientLeft
      const direita = esquerda + corpo.clientWidth
      for (const el of Array.from(corpo.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [role="tab"]'))) {
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
        const r = el.getBoundingClientRect()
        // O que é só para o leitor de tela é um recorte de 1 px: não é alvo de ninguém.
        if (r.width < 2 || r.height < 2) continue
        const aba = el.getAttribute('role') === 'tab'
        const nome = `${aba ? 'aba' : el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 32)}"`
        if (r.left < esquerda - folga || r.right > direita + folga) {
          achados.push(`${nome} passa da borda: vai de ${Math.round(r.left)} a ${Math.round(r.right)}, o miolo de ${Math.round(esquerda)} a ${Math.round(direita)}`)
        }
        if (!aba) continue
        if (r.width < toqueMinimo - folga || r.height < toqueMinimo - folga) achados.push(`${nome} pequena para o dedo: ${Math.round(r.width)}x${Math.round(r.height)}`)
        const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (alvo === null || !el.contains(alvo)) achados.push(`${nome}: o dedo no meio dela acerta ${alvo === null ? 'nada' : `${alvo.tagName.toLowerCase()}.${alvo.getAttribute('class') ?? ''}`}`)
      }
      return achados
    },
    { toqueMinimo, folga: FOLGA },
  )
}

for (const tela of TELAS) {
  test.describe(nomeDaTela(tela), () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, hasTouch: tela.toque, isMobile: tela.toque })

    test('com tudo aceso, nenhum flutuante cruza outro nem sai da tela', async ({ page }) => {
      const host = await jogadorEntra(page)
      await rolarTudo(page, host)
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
      await page.getByRole('button', { name: 'Chamar', exact: true }).click()
      await expect(page.getByText(/^Esperando o mestre/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Subir ao 1º piso' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Espiar pela porta' })).toBeVisible()
      await expect(page.getByText('Tela acesa')).toBeVisible()

      const medidas = await medirEFotografar(page, `hud-${tela.width}x${tela.height}`)
      expect(apagados(medidas, ACESOS), 'flutuantes que deviam estar acesos e não foram medidos').toEqual([])
      // A coluna do notebook nasce aberta e entra na conta; a gaveta do celular nasce fechada.
      expect(medidas.some((m) => m.nome === 'gaveta do painel')).toBe(!tela.gaveta)
      expect(problemas(medidas, tela, alvoMinimo(tela))).toEqual([])
    })

    test('gaveta aberta: nada do mapa fica por cima dela, a rolagem feita por ela aparece nela, e fechar devolve o HUD', async ({ page }) => {
      test.skip(!tela.gaveta, 'no notebook e no tablet o painel é coluna, aberta desde a entrada: o teste de cima já a mede')
      const host = await jogadorEntra(page)
      await rolarTudo(page, host)
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

      // Por dentro, aba por aba: o miolo não rola de lado, nada passa da borda e cada aba é alvo do dedo.
      // As cinco precisam estar lá: sem o Chat, a fileira cabia e o teste passaria sem provar nada.
      await expect(gaveta.getByRole('tab')).toHaveText(ABAS_DA_GAVETA)
      const porDentro: string[] = []
      for (const nome of ABAS_DA_GAVETA) {
        const aba = gaveta.getByRole('tab', { name: new RegExp(`^${nome}`) })
        await aba.click()
        await expect(aba).toHaveAttribute('aria-selected', 'true')
        await esperarAsEntradas(page)
        porDentro.push(...(await problemasPorDentroDaGaveta(page, alvoMinimo(tela))).map((achado) => `${nome}: ${achado}`))
      }
      // A foto de volta na aba Jogo, depois do traço da aba ativa terminar de passar de uma para a outra.
      await gaveta.getByRole('tab', { name: 'Jogo' }).click()
      await esperarAsEntradas(page)
      await fotografar(page, `${tela.width}x${tela.height}-aberta`)
      expect(porDentro, 'por dentro da gaveta aberta').toEqual([])

      // Rolar pela gaveta: o pedido sai, o host devolve a rolagem da mesa, e ela aparece embaixo do formulário.
      await gaveta.getByRole('tab', { name: 'Dados' }).click()
      await gaveta.getByRole('button', { name: 'd6', exact: true }).click()
      await gaveta.getByRole('button', { name: 'Rolar', exact: true }).click()
      host.mandar(rolagem('r-gaveta', { de: 'Ana', faces: [1, 1], modificador: 3 }))
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

/*
 * PORTA TRANCADA: o toque na porta que o mestre trancou traz a faixa dos
 * pedidos ("Trancada" com Bater, Forçar, Usar chave e o ×) — no celular,
 * duas linhas de botões no chão da esquerda. Deitado, a coluna das ações do
 * lugar descia por cima dela, e o alarme a empurrava ainda mais para baixo.
 * O pedido feito vira o aviso "Pedido enviado", no mesmo chão — onde mora
 * também o selo de estado, que caía embaixo dele.
 */
const PORTA_TRANCADA: ReadonlyArray<{ tela: Tela; alarme: boolean }> = [
  { tela: DEITADO_PEQUENO, alarme: false },
  { tela: DEITADO_PEQUENO, alarme: true },
  { tela: DEITADO_MEDIO, alarme: false },
  { tela: DEITADO_LARGO, alarme: true },
  { tela: EM_PE_ESTREITO, alarme: false },
]

for (const { tela, alarme } of PORTA_TRANCADA) {
  test.describe(`porta trancada ${nomeDaTela(tela)}${alarme ? ' com alarme' : ''}`, () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, hasTouch: tela.toque, isMobile: tela.toque })

    test('a faixa dos pedidos, o aviso do pedido e as ações do lugar não se cobrem', async ({ page }) => {
      const host = await jogadorEntra(page, { porta: 'trancada', fila: FILA_CURTA, andares: true })
      await rolarTudo(page, host)
      if (alarme) await soarOAlarme(page, host)
      // O mestre recusou o toque na porta: ela está trancada.
      host.mandar({ type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' })
      const faixa = page.getByRole('group', { name: 'Porta trancada' })
      await expect(faixa).toBeVisible()
      await expect(page.getByRole('button', { name: 'Espiar pela porta' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Subir ao 1º piso' })).toBeVisible()

      const comAFaixa = await medirEFotografar(page, `porta-trancada-${tela.width}x${tela.height}${alarme ? '-alarme' : ''}`)
      const acesos = ['faixa da porta', 'pedido da porta', 'Espiar pela porta', 'escada', 'Sua vez', 'Onde estou', 'zoom', 'mão do chamado', ...(alarme ? ['alarme'] : [])]
      expect(apagados(comAFaixa, acesos), 'flutuantes que deviam estar acesos e não foram medidos').toEqual([])
      expect(problemas(comAFaixa, tela, alvoMinimo(tela))).toEqual([])

      // "Bater": a faixa sai e o aviso do pedido entra no mesmo chão.
      await faixa.getByRole('button', { name: 'Bater' }).click()
      await expect(page.getByText('Pedido enviado')).toBeVisible()
      const comOAviso = await medirEFotografar(page, `pedido-enviado-${tela.width}x${tela.height}${alarme ? '-alarme' : ''}`)
      expect(apagados(comOAviso, ['aviso', 'Espiar pela porta', 'escada'])).toEqual([])
      expect(problemas(comOAviso, tela, alvoMinimo(tela))).toEqual([])
    })
  })
}

/*
 * ALARME E CONFRONTO LONGO: a faixa do alarme empurra tudo o que mora no alto
 * para baixo, e a fila de sete fichas quebra em três linhas. A coluna do canto
 * passava do pé — por cima do alto-falante e das ações do lugar (320 x 568),
 * e até o "Esperando o mestre" (844 x 340). Agora as rolagens cedem primeiro
 * e, quando nem os selos cabem, a fila do confronto: a coluna nunca passa do pé.
 */
for (const tela of [EM_PE_ESTREITO, EM_PE, DEITADO_BAIXO, DEITADO_PEQUENO, NOTEBOOK]) {
  test.describe(`alarme e confronto longo ${nomeDaTela(tela)}`, () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, hasTouch: tela.toque, isMobile: tela.toque })

    test('a coluna do canto não passa do pé, e nada cruza nada', async ({ page }) => {
      const host = await jogadorEntra(page, { porta: 'fechada', fila: FILA_LONGA, andares: true })
      await rolarTudo(page, host, false)
      await soarOAlarme(page, host)
      await chamarOMestre(page)
      await expect(page.getByRole('button', { name: 'Trancar deste lado' })).toBeVisible()

      const medidas = await medirEFotografar(page, `alarme-confronto-${tela.width}x${tela.height}`)
      const acesos = ['alarme', 'abas de andar', 'Onde estou', 'confronto', 'Sua vez', 'zoom', 'som', 'mão do chamado', 'linha do chamado', 'escada', 'ferrolho', 'Espiar pela porta']
      expect(apagados(medidas, acesos), 'flutuantes que deviam estar acesos e não foram medidos').toEqual([])
      expect(problemas(medidas, tela, alvoMinimo(tela))).toEqual([])

      // A vez continua inteira à vista; a fila corta por baixo (ou à direita, deitado) dentro da faixa.
      await expect(page.getByRole('region', { name: 'Confronto' }).getByText('Sua vez · 6 casas')).toBeInViewport({ ratio: 1 })
      const confronto = caixaDe(medidas, 'confronto')
      const pe = await page.locator('.pp-canto').evaluate((canto) => canto.getBoundingClientRect().bottom)
      expect(confronto.y + confronto.altura, 'o pé do confronto dentro do pé da coluna do canto').toBeLessThanOrEqual(pe + FOLGA)
    })
  })
}

/*
 * PAUSA E AVISO QUE PASSA, deitado: o aviso da pausa fica na tela enquanto o
 * mestre está com o outro grupo, e a resposta do mestre a uma ação no ponto
 * passa sozinha. Moravam a 112 e 156 px do rodapé — o meio da tela deitada,
 * na altura da coluna das ações do lugar.
 */
for (const tela of [DEITADO_PEQUENO, DEITADO_BAIXO]) {
  test.describe(`pausa e aviso que passa ${nomeDaTela(tela)}`, () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, hasTouch: tela.toque, isMobile: tela.toque })

    test('os avisos moram no chão da esquerda, abaixo das ações do lugar', async ({ page }) => {
      const host = await jogadorEntra(page)
      await rolarTudo(page, host)
      host.mandar({ type: 'scene.paused', paused: true })
      await expect(page.getByText('O mestre está com o outro grupo')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Trancar deste lado' })).toBeVisible()

      // Só a pausa, no segundo andar: ela não cobre o selo de estado, e ele fica à vista.
      const soAPausa = await medirEFotografar(page, `pausa-${tela.width}x${tela.height}`)
      expect(apagados(soAPausa, ['aviso que fica', 'hora do dia', 'tela acesa', 'Espiar pela porta', 'ferrolho', 'Sua vez'])).toEqual([])
      expect(problemas(soAPausa, tela, alvoMinimo(tela))).toEqual([])

      // A resposta do mestre a uma ação no ponto passa pelo chão: o selo sai de baixo dela.
      host.mandar({ type: 'point.action.answer', action: 'escutar', answer: 'seen' })
      await expect(page.locator('.pp-notice--point')).toBeVisible()
      const comOAviso = await medirEFotografar(page, `pausa-e-aviso-${tela.width}x${tela.height}`)
      expect(apagados(comOAviso, ['aviso que fica', 'aviso', 'Espiar pela porta', 'ferrolho', 'Sua vez', 'Onde estou', 'confronto'])).toEqual([])
      expect(comOAviso.some((m) => m.nome === 'hora do dia'), 'o selo de estado embaixo do aviso do chão').toBe(false)
      expect(problemas(comOAviso, tela, alvoMinimo(tela))).toEqual([])
    })
  })
}

/*
 * TABLET COM A COLUNA DO PAINEL ABERTA: o mapa que sobra tem uns 370 px. A
 * porta aberta dá o rótulo mais comprido do ferrolho ("Fechar e trancar deste
 * lado"), que passava do meio da faixa e cruzava a rolagem; sem abas de
 * andar, o "Onde estou" é o primeiro selo da coluna do canto e mora na altura
 * da faixa "Sua vez", centrada no mapa que sobra.
 */
for (const tela of [TABLET_EM_PE, TABLET_DEITADO]) {
  test.describe(`coluna do painel aberta ${nomeDaTela(tela)}`, () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, hasTouch: tela.toque, isMobile: tela.toque })

    test('a faixa "Sua vez", o "Onde estou", o ferrolho e as rolagens não se cruzam', async ({ page }) => {
      const host = await jogadorEntra(page, { porta: 'aberta', fila: FILA_CURTA, andares: false })
      await rolarTudo(page, host)
      await chamarOMestre(page)
      await expect(page.getByRole('button', { name: 'Fechar e trancar deste lado' })).toBeVisible()
      await expect(page.getByRole('complementary', { name: 'Painel do jogador' })).toBeVisible()

      const medidas = await medirEFotografar(page, `coluna-do-painel-${tela.width}x${tela.height}`)
      const acesos = ['gaveta do painel', 'Sua vez', 'Onde estou', 'confronto', 'ferrolho', 'escada', 'rolagens', 'hora do dia', 'zoom', 'som', 'mão do chamado', 'linha do chamado']
      expect(apagados(medidas, acesos), 'flutuantes que deviam estar acesos e não foram medidos').toEqual([])
      expect(problemas(medidas, tela, alvoMinimo(tela))).toEqual([])
    })
  })
}

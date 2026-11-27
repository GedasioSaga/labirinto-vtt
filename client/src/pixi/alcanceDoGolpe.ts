import { CanvasSource, Container, Graphics, Sprite, Texture, type Ticker } from 'pixi.js'
import { pegadaDaCasa, type Casa, type PegadaNaGrade } from '../lib/batalha/area'
import { casasDaExplosao, casasDoAlcance } from '../lib/batalha/alcance/casas'
import type { CorDoAlcance } from '../lib/batalha/alcance/cor'
import { TINTA_DO_ALVO_ATINGIDO, TINTAS_DO_ALCANCE, type TintaDoAlcance } from '../lib/batalha/alcance/cores'
import { usaDirecao, type FormaDaAreaLonge } from '../lib/batalha/alcance/forma'
import { casasDaFormaDeQuemUsa, casasPisadas, conjuntoDasCasas, fichaNasCasas, type MapaDoAlcance } from '../lib/batalha/alcance/quemEntra'
import type { MiraNoDesenho } from '../stores/batalha/miraNoMapa'

/**
 * O ALCANCE DO GOLPE NO CHÃO (plano docs/design/habilidades/ALCANCE.md §7.1, fase E; protótipo
 * aprovado tmp/proto-alcance/fonte.html). Com um golpe na mira, as casas que ele alcança acendem:
 * azul quando dá dano, verde claro quando não dá. No mestre e no jogador, na faixa da grade da
 * batalha, acima do alcance de andar (que some enquanto há mira) e por baixo das fichas.
 *
 * - Casa acesa: preenchimento com recuo, contorno escuro e a borda de dentro clara.
 * - O brilho (pedido do dono, 23/11: "uma animação que nem o Final Fantasy Tactics"): um sprite de
 *   degradê redondo por casa, a mesma textura para todas, que respira (ciclo de 1,4 s) e é cruzado
 *   por uma onda de luz que sai de quem usa para fora (o atraso cresce com a distância). Só o alfa
 *   dos sprites muda, a 30 quadros por segundo, só enquanto há mira; as casas não são refeitas.
 *   Movimento reduzido: o brilho fica parado no meio.
 * - Mouse em cima (só a mira desta tela): a casa forte com borda branca; no alvo e no anel só a
 *   casa, na área longe a explosão; nas formas inteiras, todas. Fora das casas, o tracejado.
 * - Os marcados ganham os cantos de latão; a forma que olha para um lado, a seta.
 * - Casa vermelha (pedido do dono, 27/11/2026: "quando os quadrados azuis acertarem um inimigo deixe o
 *   quadrado vermelho"): no golpe de dano (azul), a casa acesa onde pisa um marcado fica vermelha, com
 *   o mesmo desenho e o mesmo brilho; a vazia e a do aliado fora da mira ficam azuis. Quem pisa sai da
 *   mesma pegada da conferência do alcance (`casasPisadas`), então vermelho = "dentro" para o host.
 *
 * Traços em px de TELA: o zoom refaz o traço sem refazer a conta das casas.
 */

/** As cores do protótipo, as mesmas do Testar do editor (`lib/batalha/alcance/cores.ts`). */
const TINTAS = TINTAS_DO_ALCANCE

const BRANCO = 0xffffff
const TINTA_ESCURA = 0x0c0c0e
const LATAO_CLARO = 0xf3ba66
const TRACEJADO = 0xeceae4
const TRACEJADO_ALPHA = 0.85

/** O ciclo do brilho: respira e a onda passa, uma vez a cada 1,4 s (pedido do orquestrador, 23/11). */
const PERIODO_MS = 1400
/** Quanto do ciclo a onda atrasa a cada casa de distância (~112 ms por casa: ~9 casas por segundo). */
const ATRASO_DA_ONDA_POR_CASA = 0.08
/** A crista da onda: quanto maior, mais estreita (um anel de luz, não um piscar da área toda). */
const ESTREITEZA_DA_ONDA = 6
/** O alfa do brilho: o mínimo, o que a respiração soma e o que a onda soma (0,4 a 0,9, o do protótipo). */
const ALFA_MINIMO = 0.4
const ALFA_DA_RESPIRACAO = 0.3
const ALFA_DA_ONDA = 0.2
/** Movimento reduzido: o brilho parado, no meio do que ele respiraria. */
const ALFA_PARADO = 0.65
/** A mira acende em 160 ms (ease-out quártico): aparece, sem pular. */
const ENTRADA_MS = 160
/** O brilho troca de alfa a 30 quadros por segundo: o respirar de 1,4 s não pede mais. */
const QUADRO_DO_BRILHO_MS = 1000 / 30
/** A textura do brilho, em px (o sprite estica para a casa). */
const TEXTURA_PX = 64

export interface MovimentoDoAlcance {
  /** O relógio cru do app (`app.ticker`): o desenho sob pedido vê o alfa mudar e desenha. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  agora?: () => number
}

export interface EstadoDoAlcanceDoGolpe {
  miras: number
  casas: number
  animando: boolean
}

export interface AlcanceDoGolpe {
  readonly camada: Container
  /** As miras no chão (`mirasParaDesenhar`); a mesma lista e a mesma escala não refazem nada. */
  desenhar(miras: readonly MiraNoDesenho[], escala: number): void
  /** Há alguma mira no chão (o alcance de andar some enquanto houver). */
  temMira(): boolean
  destruir(): void
}

/** As casas acesas de uma mira, a conta das casas da lib (a mesma do host). */
function casasDaMira(mira: MiraNoDesenho): Casa[] {
  const { forma, quemUsa, direcao, mapa, acendeQuemUsa } = mira
  if (direcao !== null || !usaDirecao(forma) || acendeQuemUsa) return casasDoAlcance({ forma, quemUsa, direcao: direcao ?? 'norte', acendeQuemUsa, ...mapa })
  return casasDaFormaDeQuemUsa(forma, quemUsa, null, mapa)
}

function chaveDaCasa(casa: Casa): string {
  return `${casa.col},${casa.row}`
}

function chaveDaPegada(pegada: PegadaNaGrade | null): string {
  if (pegada === null) return '-'
  // O corpo fora do centro muda as casas da ficha (`casasDaFicha`) sem mudar a casa de referência.
  const { corpo } = pegada
  return `${pegada.col},${pegada.row},${pegada.tamanho}${corpo === undefined ? '' : `@${corpo.col},${corpo.row},${corpo.lado}`}`
}

/** A distância do xadrez da casa até a borda da ficha de quem usa (a onda sai dela). */
function distanciaDeQuemUsa(quemUsa: PegadaNaGrade, casa: Casa): number {
  const naCol = Math.max(quemUsa.col - casa.col, 0, casa.col - (quemUsa.col + quemUsa.tamanho - 1))
  const naRow = Math.max(quemUsa.row - casa.row, 0, casa.row - (quemUsa.row + quemUsa.tamanho - 1))
  return Math.max(naCol, naRow)
}

/** A tinta da casa: a da cor do golpe, ou a vermelha do alvo atingido. */
type ChaveDaTinta = CorDoAlcance | 'atingido'

function tintaDa(chave: ChaveDaTinta): TintaDoAlcance {
  return chave === 'atingido' ? TINTA_DO_ALVO_ATINGIDO : TINTAS[chave]
}

const texturas = new Map<ChaveDaTinta, Texture>()

/** O degradê redondo do brilho, feito uma vez por tinta (o do protótipo, `brilhoDa`). */
function texturaDoBrilho(chave: ChaveDaTinta): Texture {
  const pronta = texturas.get(chave)
  if (pronta !== undefined) return pronta
  const tela = typeof document === 'undefined' ? null : document.createElement('canvas')
  const g = tela?.getContext('2d') ?? null
  if (tela === null || g === null) return Texture.WHITE
  tela.width = TEXTURA_PX
  tela.height = TEXTURA_PX
  const meio = TEXTURA_PX / 2
  const degrade = g.createRadialGradient(meio, meio, 0, meio, meio, meio * 0.92)
  const rgb = tintaDa(chave).brilho
  degrade.addColorStop(0, `rgba(${rgb}, 0.95)`)
  degrade.addColorStop(0.45, `rgba(${rgb}, 0.45)`)
  degrade.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = degrade
  g.fillRect(0, 0, TEXTURA_PX, TEXTURA_PX)
  const textura = new Texture({ source: new CanvasSource({ resource: tela, autoGenerateMipmaps: true, scaleMode: 'linear' }) })
  texturas.set(chave, textura)
  return textura
}

const SEM_CASAS: ReadonlySet<string> = new Set()

/** As casas acesas onde pisa um marcado, só no golpe de dano (azul); a ajuda (verde) não pinta ninguém de vermelho. */
function casasAtingidas(mira: MiraNoDesenho, casas: readonly Casa[]): ReadonlySet<string> {
  if (mira.cor !== 'azul') return SEM_CASAS
  const pisadas = casasPisadas(casas, mira.alvos)
  return pisadas.length === 0 ? SEM_CASAS : conjuntoDasCasas(pisadas)
}

/** As casas na tinta delas: as atingidas em vermelho, o resto na tinta do golpe (o mesmo traço). */
function pintarComAtingidas(g: Graphics, casas: readonly Casa[], atingidas: ReadonlySet<string>, grid: number, px: number, tinta: TintaDoAlcance, forte: boolean): void {
  if (atingidas.size === 0) {
    pintarCasas(g, casas, grid, px, tinta, forte)
    return
  }
  const normais: Casa[] = []
  const vermelhas: Casa[] = []
  for (const casa of casas) (atingidas.has(chaveDaCasa(casa)) ? vermelhas : normais).push(casa)
  pintarCasas(g, normais, grid, px, tinta, forte)
  pintarCasas(g, vermelhas, grid, px, TINTA_DO_ALVO_ATINGIDO, forte)
}

/** O ease-out quártico: começa rápido e assenta (a entrada). */
function saidaQuartica(p: number): number {
  return 1 - (1 - p) ** 4
}

/** As medidas da casa acesa (as do protótipo, em px de mundo): o recuo e a borda de dentro. */
function medidasDaCasa(grid: number, px: number): { recuo: number; dentro: number } {
  const recuo = Math.max(1.5 * px, grid * 0.04)
  return { recuo, dentro: recuo + Math.max(2 * px, grid * 0.04) }
}

/** Casas acesas num traço só: o preenchimento, o contorno escuro e a borda de dentro. */
function pintarCasas(g: Graphics, casas: readonly Casa[], grid: number, px: number, tinta: TintaDoAlcance, forte: boolean): void {
  if (casas.length === 0) return
  const { recuo, dentro } = medidasDaCasa(grid, px)
  for (const { col, row } of casas) g.rect(col * grid + recuo, row * grid + recuo, grid - 2 * recuo, grid - 2 * recuo)
  g.fill({ color: forte ? tinta.forte : tinta.base, alpha: forte ? tinta.forteAlpha : tinta.baseAlpha })
  g.stroke({ width: 2 * px, color: tinta.contorno, alpha: tinta.contornoAlpha })
  for (const { col, row } of casas) g.rect(col * grid + dentro, row * grid + dentro, grid - 2 * dentro, grid - 2 * dentro)
  g.stroke({ width: (forte ? 2 : 1.25) * px, color: forte ? BRANCO : tinta.borda })
}

/** O tracejado 6/5 (px de tela) em volta da casa sob o mouse, fora das acesas. */
function pintarTracejado(g: Graphics, casa: Casa, grid: number, px: number): void {
  const recuo = grid * 0.0625
  const x0 = casa.col * grid + recuo
  const y0 = casa.row * grid + recuo
  const lado = grid - 2 * recuo
  const traco = 6 * px
  const vao = 5 * px
  const cantos: readonly [number, number, number, number][] = [
    [x0, y0, 1, 0],
    [x0 + lado, y0, 0, 1],
    [x0 + lado, y0 + lado, -1, 0],
    [x0, y0 + lado, 0, -1],
  ]
  for (const [x, y, dx, dy] of cantos) {
    for (let andado = 0; andado < lado; andado += traco + vao) {
      const fim = Math.min(lado, andado + traco)
      g.moveTo(x + dx * andado, y + dy * andado).lineTo(x + dx * fim, y + dy * fim)
    }
  }
  g.stroke({ width: 2 * px, color: TRACEJADO, alpha: TRACEJADO_ALPHA })
}

/** Os cantos de latão em volta da ficha marcada (escuro 6 px, latão 3 px). */
function pintarCantos(g: Graphics, pegadas: readonly PegadaNaGrade[], grid: number, px: number): void {
  if (pegadas.length === 0) return
  const tracar = () => {
    for (const pegada of pegadas) {
      const x = pegada.col * grid
      const y = pegada.row * grid
      const lado = pegada.tamanho * grid
      const fora = grid * 0.06
      const braco = grid * 0.3
      const cantos: readonly [number, number, number, number][] = [
        [x - fora, y - fora, 1, 1],
        [x + lado + fora, y - fora, -1, 1],
        [x - fora, y + lado + fora, 1, -1],
        [x + lado + fora, y + lado + fora, -1, -1],
      ]
      for (const [cx, cy, sx, sy] of cantos) g.moveTo(cx + sx * braco, cy).lineTo(cx, cy).lineTo(cx, cy + sy * braco)
    }
  }
  tracar()
  g.stroke({ width: 6 * px, color: TINTA_ESCURA, alpha: 0.85, cap: 'round', join: 'round' })
  tracar()
  g.stroke({ width: 3 * px, color: LATAO_CLARO, cap: 'round', join: 'round' })
}

const VETOR: Readonly<Record<'norte' | 'sul' | 'leste' | 'oeste', readonly [number, number]>> = { norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0] }

/** A seta da direção, a meia casa da borda da ficha, na cor da borda com contorno escuro. */
function pintarSeta(g: Graphics, mira: MiraNoDesenho, grid: number, px: number, tinta: TintaDoAlcance): void {
  if (mira.direcao === null || !usaDirecao(mira.forma)) return
  const [vx, vy] = VETOR[mira.direcao]
  const meio = (mira.quemUsa.tamanho * grid) / 2
  const cx = mira.quemUsa.col * grid + meio + vx * (meio - grid / 2 + grid * 0.5)
  const cy = mira.quemUsa.row * grid + meio + vy * (meio - grid / 2 + grid * 0.5)
  const t = grid * 0.13
  // A ponta, e a base atrás dela, girada para o lado (vx, vy).
  const pontos = [cx + vx * t, cy + vy * t, cx - vx * t * 0.7 - vy * t, cy - vy * t * 0.7 + vx * t, cx - vx * t * 0.7 + vy * t, cy - vy * t * 0.7 - vx * t]
  g.poly(pontos).stroke({ width: 3 * px, color: TINTA_ESCURA, alpha: 0.85, join: 'round' })
  g.poly(pontos).fill({ color: tinta.borda })
}

/** A explosão da área longe em volta de `centro` (a granada sob o mouse, ou a escolhida). */
function explosaoEm(forma: FormaDaAreaLonge, centro: PegadaNaGrade, mapa: MapaDoAlcance): Casa[] {
  return casasDaExplosao({ forma, centro, ...mapa })
}

/** As casas fortes com o mouse em `foco` (uma casa acesa). */
function fortesNoFoco(mira: MiraNoDesenho, foco: Casa, casas: readonly Casa[]): readonly Casa[] {
  const { forma } = mira
  if (forma.tipo === 'ponto') return explosaoEm(forma, pegadaDaCasa(foco), mira.mapa)
  if (forma.tipo === 'ficha') {
    const naFicha = mira.fichas.find((ficha) => fichaNasCasas(conjuntoDasCasas([foco]), ficha))
    return naFicha === undefined ? [foco] : explosaoEm(forma, naFicha, mira.mapa)
  }
  return forma.tipo === 'alvo' ? [foco] : casas
}

interface DesenhoDaMira {
  raiz: Container
  base: Graphics
  brilho: Container
  foco: Graphics
  sprites: Sprite[]
  /** A distância de cada sprite em uso até quem usa (a onda). */
  distancias: number[]
  usados: number
  casas: Casa[]
  acesas: ReadonlySet<string>
  /** As casas acesas onde pisa um marcado (as vermelhas). */
  atingidas: ReadonlySet<string>
  cor: CorDoAlcance | null
  chaveDasCasas: string
  chaveDosAlvos: string
  chaveDoTraco: string
  chaveDoFoco: string
  abriuEm: number
}

let proximoIdDoMapa = 1
const idsDosMapas = new WeakMap<MapaDoAlcance, number>()

function idDoMapa(mapa: MapaDoAlcance): number {
  let id = idsDosMapas.get(mapa)
  if (id === undefined) {
    id = proximoIdDoMapa
    proximoIdDoMapa += 1
    idsDosMapas.set(mapa, id)
  }
  return id
}

export function criarAlcanceDoGolpe(movimento?: MovimentoDoAlcance, aoMudar?: (estado: EstadoDoAlcanceDoGolpe) => void): AlcanceDoGolpe {
  const camada = new Container()
  camada.label = 'alcance-do-golpe'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  const desenhos = new Map<string, DesenhoDaMira>()
  const agora = movimento?.agora ?? (() => performance.now())
  let parado = movimento === undefined || movimento.reducedMotion()
  let noRelogio = false
  let ultimoQuadro = -Infinity
  let ultimas: readonly MiraNoDesenho[] = []
  let ultimaEscala = 0

  function animar(desenho: DesenhoDaMira, instante: number): void {
    if (parado) {
      desenho.raiz.alpha = 1
      for (let i = 0; i < desenho.usados; i += 1) desenho.sprites[i].alpha = ALFA_PARADO
      return
    }
    const t = Math.max(0, instante - desenho.abriuEm)
    desenho.raiz.alpha = saidaQuartica(Math.min(1, t / ENTRADA_MS))
    const fase = t / PERIODO_MS
    const respira = 0.5 - 0.5 * Math.cos(2 * Math.PI * fase)
    for (let i = 0; i < desenho.usados; i += 1) {
      const onda = (0.5 + 0.5 * Math.cos(2 * Math.PI * (fase - desenho.distancias[i] * ATRASO_DA_ONDA_POR_CASA))) ** ESTREITEZA_DA_ONDA
      desenho.sprites[i].alpha = ALFA_MINIMO + ALFA_DA_RESPIRACAO * respira + ALFA_DA_ONDA * onda
    }
  }

  const passo = () => {
    const instante = agora()
    // Na entrada, todo quadro (160 ms); depois, 30 por segundo.
    const entrando = [...desenhos.values()].some((desenho) => instante - desenho.abriuEm < ENTRADA_MS)
    if (!entrando && instante - ultimoQuadro < QUADRO_DO_BRILHO_MS) return
    ultimoQuadro = instante
    for (const desenho of desenhos.values()) animar(desenho, instante)
  }

  function conferirRelogio(): void {
    const quer = movimento !== undefined && !parado && desenhos.size > 0
    if (quer === noRelogio || movimento === undefined) return
    noRelogio = quer
    if (quer) movimento.ticker.add(passo)
    else movimento.ticker.remove(passo)
  }

  function avisar(): void {
    if (aoMudar === undefined) return
    let casas = 0
    for (const desenho of desenhos.values()) casas += desenho.casas.length
    aoMudar({ miras: desenhos.size, casas, animando: noRelogio })
  }

  function novoDesenho(): DesenhoDaMira {
    const raiz = new Container()
    const base = new Graphics()
    const brilho = new Container()
    // Como o protótipo (`mix-blend-mode: screen`): o brilho clareia a casa sem estourar em branco.
    brilho.blendMode = 'screen'
    const foco = new Graphics()
    raiz.addChild(base, brilho, foco)
    camada.addChild(raiz)
    return { raiz, base, brilho, foco, sprites: [], distancias: [], usados: 0, casas: [], acesas: new Set(), atingidas: SEM_CASAS, cor: null, chaveDasCasas: '', chaveDosAlvos: '', chaveDoTraco: '', chaveDoFoco: '', abriuEm: agora() }
  }

  /** O brilho de cada casa na tinta dela: vermelho onde pisa um marcado, a cor do golpe no resto. */
  function tingirBrilho(desenho: DesenhoDaMira, cor: CorDoAlcance): void {
    const doGolpe = texturaDoBrilho(cor)
    for (let i = 0; i < desenho.usados; i += 1) {
      const textura = desenho.atingidas.has(chaveDaCasa(desenho.casas[i])) ? texturaDoBrilho('atingido') : doGolpe
      if (desenho.sprites[i].texture !== textura) desenho.sprites[i].texture = textura
    }
  }

  /** As casas e o brilho: refeitos só quando a forma, a direção, a ficha ou as paredes mudam. */
  function refazerCasas(desenho: DesenhoDaMira, mira: MiraNoDesenho): void {
    const casas = casasDaMira(mira)
    desenho.casas = casas
    desenho.acesas = conjuntoDasCasas(casas)
    const textura = texturaDoBrilho(mira.cor)
    const grid = mira.mapa.grade
    for (let i = 0; i < casas.length; i += 1) {
      let sprite = desenho.sprites[i]
      if (sprite === undefined) {
        sprite = new Sprite(textura)
        sprite.anchor.set(0.5)
        desenho.sprites.push(sprite)
        desenho.brilho.addChild(sprite)
      }
      sprite.visible = true
      sprite.position.set((casas[i].col + 0.5) * grid, (casas[i].row + 0.5) * grid)
      sprite.setSize(grid, grid)
      desenho.distancias[i] = distanciaDeQuemUsa(mira.quemUsa, casas[i])
    }
    for (let i = casas.length; i < desenho.sprites.length; i += 1) desenho.sprites[i].visible = false
    desenho.usados = casas.length
    desenho.cor = mira.cor
  }

  function desenharUma(desenho: DesenhoDaMira, mira: MiraNoDesenho, escala: number): void {
    const grid = mira.mapa.grade
    const px = 1 / (escala > 0 ? escala : 1)
    const tinta = TINTAS[mira.cor]
    const chaveDasCasas = `${JSON.stringify(mira.forma)}|${mira.cor}|${chaveDaPegada(mira.quemUsa)}|${mira.direcao ?? '-'}|${mira.acendeQuemUsa}|${idDoMapa(mira.mapa)}`
    if (chaveDasCasas !== desenho.chaveDasCasas) {
      desenho.chaveDasCasas = chaveDasCasas
      refazerCasas(desenho, mira)
      animar(desenho, agora())
    }
    // Marcar ou desmarcar troca só a tinta das casas (vermelho onde pisa um marcado); as casas não são refeitas.
    const chaveDosAlvos = `${chaveDasCasas}|${mira.alvos.map(chaveDaPegada).join(';')}`
    if (chaveDosAlvos !== desenho.chaveDosAlvos) {
      desenho.chaveDosAlvos = chaveDosAlvos
      desenho.atingidas = casasAtingidas(mira, desenho.casas)
      tingirBrilho(desenho, mira.cor)
    }
    const chaveDoTraco = `${chaveDosAlvos}|${escala}`
    if (chaveDoTraco !== desenho.chaveDoTraco) {
      desenho.chaveDoTraco = chaveDoTraco
      desenho.base.clear()
      pintarComAtingidas(desenho.base, desenho.casas, desenho.atingidas, grid, px, tinta, false)
    }
    const foco = mira.foco
    const chaveDoFoco = `${chaveDoTraco}|${foco === null ? '-' : chaveDaCasa(foco)}|${chaveDaPegada(mira.centro)}`
    if (chaveDoFoco === desenho.chaveDoFoco) return
    desenho.chaveDoFoco = chaveDoFoco
    const g = desenho.foco
    g.clear()
    const longe = mira.forma.tipo === 'ponto' || mira.forma.tipo === 'ficha' ? mira.forma : null
    const pintarFortes = (casas: readonly Casa[]) => pintarComAtingidas(g, casas, casasAtingidas(mira, casas), grid, px, tinta, true)
    // A explosão já escolhida fica forte; o mouse em cima mostra outra por cima dela.
    if (longe !== null && mira.centro !== null) pintarFortes(explosaoEm(longe, mira.centro, mira.mapa))
    if (foco !== null) {
      if (desenho.acesas.has(chaveDaCasa(foco))) pintarFortes(fortesNoFoco(mira, foco, desenho.casas))
      else pintarTracejado(g, foco, grid, px)
    }
    pintarSeta(g, mira, grid, px, tinta)
    pintarCantos(g, longe !== null && mira.centro !== null ? [mira.centro, ...mira.alvos] : mira.alvos, grid, px)
  }

  function soltar(desenho: DesenhoDaMira): void {
    desenho.raiz.destroy({ children: true })
  }

  return {
    camada,
    desenhar(miras, escala) {
      if (miras === ultimas && escala === ultimaEscala) return
      const antes = desenhos.size
      ultimas = miras
      ultimaEscala = escala
      if (antes === 0 && miras.length > 0) parado = movimento === undefined || movimento.reducedMotion()
      const vistas = new Set<string>()
      for (const mira of miras) {
        if (mira.mapa.grade <= 0) continue
        vistas.add(mira.tokenId)
        let desenho = desenhos.get(mira.tokenId)
        if (desenho === undefined) {
          desenho = novoDesenho()
          desenhos.set(mira.tokenId, desenho)
        }
        desenharUma(desenho, mira, escala)
      }
      for (const [tokenId, desenho] of desenhos) {
        if (vistas.has(tokenId)) continue
        soltar(desenho)
        desenhos.delete(tokenId)
      }
      conferirRelogio()
      avisar()
    },
    temMira: () => desenhos.size > 0,
    destruir() {
      for (const desenho of desenhos.values()) soltar(desenho)
      desenhos.clear()
      conferirRelogio()
      camada.destroy({ children: true })
    },
  }
}

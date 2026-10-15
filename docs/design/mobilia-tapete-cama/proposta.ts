/**
 * PROPOSTA — o TAPETE (objeto novo) e as cores de TECIDO da cama.
 *
 * Código escrito para ser levado quase como está: a geometria e os dados vão
 * para `client/src/lib/mobilia.ts`; a pintura (`pintarMoveis`) é a extensão de
 * `client/src/pixi/drawPropSilhouettes.ts`. Aqui importa o que o app já tem
 * (glifo da cama, elipse, porta da cor, giro exato, fio de 1 px de tela) para
 * o protótipo desenhar com o mesmo código do mapa, e não com uma cópia.
 *
 * Convenções de `lib/mobilia.ts`: centro do objeto na origem, sem giro, y para
 * baixo; `w` x `h` em px de mundo; o glifo é uma lista de traços retos.
 */
import type { Prop, TipoMobilia, VistaMobilia } from '../../../client/src/types/map'
import { normalizarCorDoMovel, pontosDaElipse, tracosDoGlifo, type TracoDoGlifo } from '../../../client/src/lib/mobilia'
import { rotatePointAround, rotationTrig } from '../../../client/src/lib/roomRotation'
import { parseHexColor } from '../../../client/src/lib/tokenColor'
import {
  PROP_SILHOUETTE_EDGE_ALPHA,
  PROP_SILHOUETTE_EDGE_COLOR,
  PROP_SILHOUETTE_EDGE_SCREEN_PX,
  PROP_SILHOUETTE_FILL_ALPHA,
  PROP_SILHOUETTE_FILL_COLOR,
} from '../../../client/src/pixi/drawPropSilhouettes'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from '../../../client/src/pixi/pixelAlign'

type Ponto = { x: number; y: number }

// ---------------------------------------------------------------- dados

/** O tipo novo. No app ele entra em `TipoMobilia` (types/map.ts) e no fim de `TIPOS_MOBILIA`. */
export type TipoProposto = TipoMobilia | 'tapete'

/** "Forma" do tapete no painel. Só `'redondo'` é gravado (`Prop.mobiliaForma`); ausente = retangular. */
export type FormaDoTapete = 'retangular' | 'redondo'
export const FORMAS_DO_TAPETE: readonly FormaDoTapete[] = ['retangular', 'redondo']
export const ROTULO_FORMA: Readonly<Record<FormaDoTapete, string>> = { retangular: 'Retangular', redondo: 'Redondo' }

/** O objeto com os campos novos. No app são três campos opcionais de `Prop`. */
export type PropProposto = Omit<Prop, 'mobilia'> & {
  mobilia?: TipoProposto
  /** Só no tapete: `'redondo'`. Ausente = retangular, sem linha de migração. */
  mobiliaForma?: 'redondo'
  /** Só na cama: `#rrggbb`. Ausente = o travesseiro pinta como hoje (fundo da cama). */
  mobiliaCorDoTravesseiro?: string
  /** Só na cama: `#rrggbb`. Ausente = o cobertor pinta como hoje (fundo da cama). */
  mobiliaCorDoCobertor?: string
}

/** A forma na forma única que o mapa guarda: só `'redondo'`, e só no tapete. */
export function normalizarFormaDoTapete(tipo: TipoProposto | undefined, valor: unknown): 'redondo' | undefined {
  return tipo === 'tapete' && valor === 'redondo' ? 'redondo' : undefined
}

export function formaDoTapete(prop: Pick<PropProposto, 'mobilia' | 'mobiliaForma'>): FormaDoTapete {
  return normalizarFormaDoTapete(prop.mobilia, prop.mobiliaForma) ?? 'retangular'
}

/** Cor de tecido da cama: só na cama, só `#rrggbb` (a mesma porta da "Cor"). */
export function normalizarCorDeTecido(tipo: TipoProposto | undefined, valor: unknown): string | undefined {
  return tipo === 'catre' ? normalizarCorDoMovel(valor) : undefined
}

/**
 * Tamanho padrão do tapete em CASAS (largura x altura, sem giro). O retangular
 * cabe uma mesa de 2 x 1 com as cadeiras em volta; o redondo é o círculo de 2.
 * De lado é a faixa deitada no chão: a mesma largura, 1/4 de casa de altura
 * (a da cerca), para o clique ainda pegar.
 */
export const TAMANHO_DO_TAPETE_EM_CASAS: Readonly<Record<FormaDoTapete, Record<VistaMobilia, { largura: number; altura: number }>>> = {
  retangular: { frente: { largura: 3, altura: 2 }, lado: { largura: 3, altura: 0.25 } },
  redondo: { frente: { largura: 2, altura: 2 }, lado: { largura: 2, altura: 0.25 } },
}

/**
 * Paleta de tecido, um clique para o travesseiro e o cobertor. Tons de pano
 * tingido, contidos: nenhum passa de ~45% de saturação (HSL), para não
 * estourar sobre o chão chapado do minimapa. O branco é quebrado (linho), não #fff.
 */
export const PALETA_DE_TECIDO: readonly { nome: string; cor: string }[] = [
  { nome: 'Branco', cor: '#e6e1d6' },
  { nome: 'Creme', cor: '#d6c49e' },
  { nome: 'Cinza', cor: '#8c8a84' },
  { nome: 'Vermelho', cor: '#9a3f36' },
  { nome: 'Azul', cor: '#46638a' },
  { nome: 'Verde', cor: '#55704a' },
  { nome: 'Roxo', cor: '#6c5280' },
  { nome: 'Castanho', cor: '#7a5838' },
]

// ---------------------------------------------------------------- geometria do tapete

/**
 * Tapete visto de cima, em fração do LADO MENOR (`S`): franja nas duas pontas
 * curtas, faixa da borda, medalhão em losango (as pontas dele em fração do
 * campo de dentro da borda) e o miolo do losango. `fios` é quantos fios a
 * franja tem em cada ponta: número fixo, como as juntas da fogueira, para a
 * franja não virar borrão de longe nem ficar rala de perto.
 */
const TAPETE_DE_CIMA = { franja: 0.06, fios: 12, borda: 0.12, medalhaoAoLongo: 0.42, medalhaoAtravessado: 0.62, miolo: 0.45 }
/** Tapete redondo: borda em fração do lado menor; o losango em fração do raio de dentro. */
const TAPETE_REDONDO = { borda: 0.12, medalhao: 0.6, miolo: 0.45 }
/**
 * Tapete de lado (deitado no chão): a faixa ocupa de `topo` (fração da altura,
 * de cima) até o chão; franja e borda em fração da LARGURA (3 casas dão a mesma
 * franja de 0,12 casa da vista de cima). Os dois fios de cada ponta caem até o chão.
 */
const TAPETE_DE_LADO = { topo: 0.6, franja: 0.04, borda: 0.08, fioDeCima: 0.7, fioDeBaixo: 0.86, pontaDoFioDeBaixo: 0.75 }

function tamanhoDesenhavel(w: number, h: number): boolean {
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
}

/** Eixo do tapete: o comprimento corre em x quando ele é mais largo que alto. */
interface EixoDoTapete {
  deitado: boolean
  /** Meio comprimento do corpo (sem a franja) e meia largura. */
  corpoU: number
  corpoV: number
  franja: number
  borda: number
  /** Ponto no espaço do objeto a partir de (ao longo, atravessado). */
  p: (u: number, v: number) => Ponto
}

function eixoDoTapete(w: number, h: number): EixoDoTapete {
  const deitado = w >= h
  const comprimento = deitado ? w : h
  const lado = deitado ? h : w
  const franja = lado * TAPETE_DE_CIMA.franja
  return {
    deitado,
    corpoU: comprimento / 2 - franja,
    corpoV: lado / 2,
    franja,
    borda: lado * TAPETE_DE_CIMA.borda,
    p: (u, v) => (deitado ? { x: u, y: v } : { x: v, y: u }),
  }
}

function retanguloUV(e: EixoDoTapete, u: number, v: number): Ponto[] {
  return [e.p(-u, -v), e.p(u, -v), e.p(u, v), e.p(-u, v)]
}

function losangoUV(e: EixoDoTapete, u: number, v: number): Ponto[] {
  return [e.p(u, 0), e.p(0, v), e.p(-u, 0), e.p(0, -v)]
}

function contornoEmTracos(pontos: readonly Ponto[]): TracoDoGlifo[] {
  return pontos.map((a, i) => {
    const b = pontos[(i + 1) % pontos.length]
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  })
}

/**
 * Silhueta do tapete (o que leva o fundo e o fio de fora): de cima, o corpo
 * sem a franja (a franja é vazada, o chão aparece entre os fios, como na cerca)
 * ou a elipse do redondo; de lado, a faixa deitada. `null` = tamanho não desenhável.
 */
export function contornoDoTapete(forma: FormaDoTapete, w: number, h: number, vista: VistaMobilia): Ponto[] | null {
  if (!tamanhoDesenhavel(w, h)) return null
  if (vista === 'lado') {
    const corpo = w / 2 - (forma === 'retangular' ? w * TAPETE_DE_LADO.franja : 0)
    const topo = (TAPETE_DE_LADO.topo - 0.5) * h
    return [{ x: -corpo, y: topo }, { x: corpo, y: topo }, { x: corpo, y: h / 2 }, { x: -corpo, y: h / 2 }]
  }
  if (forma === 'redondo') return pontosDaElipse(w, h)
  const e = eixoDoTapete(w, h)
  return retanguloUV(e, e.corpoU, e.corpoV)
}

/** Losango do medalhão e o miolo, nos meios-eixos (ao longo, atravessado) do campo de dentro. */
function medalhao(e: EixoDoTapete, campoU: number, campoV: number, aoLongo: number, atravessado: number): { fora: Ponto[]; miolo: Ponto[] } {
  const u = campoU * aoLongo
  const v = campoV * atravessado
  return { fora: losangoUV(e, u, v), miolo: losangoUV(e, u * TAPETE_DE_CIMA.miolo, v * TAPETE_DE_CIMA.miolo) }
}

/** Uma área do desenho que leva cor própria (anel = `pontos` com o buraco dentro, num polígono só). */
export interface RegiaoDoMovel {
  pontos: Ponto[]
  tom: 'escuro' | 'travesseiro' | 'cobertor'
}

/**
 * Anel num polígono só: a volta de fora num sentido e a de dentro no outro,
 * ligadas por uma ponte. O Pixi (earcut) e o canvas (nonzero) furam o meio sem
 * `cut()` e sem regra par-ímpar.
 */
function anel(fora: readonly Ponto[], dentro: readonly Ponto[]): Ponto[] {
  return [...fora, fora[0], dentro[0], ...[...dentro].reverse().slice(0, -1), dentro[0], fora[0]].slice(0, -1)
}

/** O tapete visto de cima ou de lado: as áreas em tom escuro (borda e medalhão) e os traços do glifo. */
export function desenhoDoTapete(forma: FormaDoTapete, w: number, h: number, vista: VistaMobilia): { regioes: RegiaoDoMovel[]; tracos: TracoDoGlifo[] } {
  const vazio = { regioes: [], tracos: [] }
  if (!tamanhoDesenhavel(w, h)) return vazio
  if (vista === 'lado') return tapeteDeLado(forma, w, h)
  if (forma === 'redondo') {
    const m = Math.min(w, h)
    const borda = m * TAPETE_REDONDO.borda
    const campoU = w / 2 - borda
    const campoV = h / 2 - borda
    if (campoU <= 0 || campoV <= 0) return vazio
    const dentro = pontosDaElipse(campoU * 2, campoV * 2)
    const e: EixoDoTapete = { deitado: true, corpoU: w / 2, corpoV: h / 2, franja: 0, borda, p: (u, v) => ({ x: u, y: v }) }
    const { fora, miolo } = medalhao(e, campoU, campoV, TAPETE_REDONDO.medalhao, TAPETE_REDONDO.medalhao)
    return {
      regioes: [
        { pontos: anel(pontosDaElipse(w, h), dentro), tom: 'escuro' },
        { pontos: fora, tom: 'escuro' },
      ],
      tracos: [...contornoEmTracos(dentro), ...contornoEmTracos(fora), ...contornoEmTracos(miolo)],
    }
  }
  const e = eixoDoTapete(w, h)
  const campoU = e.corpoU - e.borda
  const campoV = e.corpoV - e.borda
  if (campoU <= 0 || campoV <= 0) return vazio
  const campo = retanguloUV(e, campoU, campoV)
  const { fora, miolo } = medalhao(e, campoU, campoV, TAPETE_DE_CIMA.medalhaoAoLongo, TAPETE_DE_CIMA.medalhaoAtravessado)
  const franja: TracoDoGlifo[] = []
  const passo = (2 * e.corpoV) / TAPETE_DE_CIMA.fios
  for (let i = 0; i < TAPETE_DE_CIMA.fios; i += 1) {
    const v = -e.corpoV + (i + 0.5) * passo
    for (const lado of [-1, 1]) {
      const a = e.p(lado * e.corpoU, v)
      const b = e.p(lado * (e.corpoU + e.franja), v)
      franja.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
  }
  return {
    regioes: [
      { pontos: anel(retanguloUV(e, e.corpoU, e.corpoV), campo), tom: 'escuro' },
      { pontos: fora, tom: 'escuro' },
    ],
    tracos: [...contornoEmTracos(campo), ...contornoEmTracos(fora), ...contornoEmTracos(miolo), ...franja],
  }
}

/** De lado: a faixa no chão, a borda vista de quina nas duas pontas e, no retangular, os fios caindo até o chão. */
function tapeteDeLado(forma: FormaDoTapete, w: number, h: number): { regioes: RegiaoDoMovel[]; tracos: TracoDoGlifo[] } {
  const y = (fracao: number): number => (fracao - 0.5) * h
  const franja = forma === 'retangular' ? w * TAPETE_DE_LADO.franja : 0
  const corpo = w / 2 - franja
  const dentro = corpo - w * TAPETE_DE_LADO.borda
  if (dentro <= 0) return { regioes: [], tracos: [] }
  const topo = y(TAPETE_DE_LADO.topo)
  const chao = h / 2
  const regioes: RegiaoDoMovel[] = []
  const tracos: TracoDoGlifo[] = []
  for (const lado of [-1, 1]) {
    regioes.push({ pontos: [{ x: lado * corpo, y: topo }, { x: lado * dentro, y: topo }, { x: lado * dentro, y: chao }, { x: lado * corpo, y: chao }], tom: 'escuro' })
    tracos.push({ x1: lado * dentro, y1: topo, x2: lado * dentro, y2: chao })
    if (franja > 0) {
      tracos.push({ x1: lado * corpo, y1: y(TAPETE_DE_LADO.fioDeCima), x2: lado * (w / 2), y2: chao })
      tracos.push({ x1: lado * corpo, y1: y(TAPETE_DE_LADO.fioDeBaixo), x2: lado * (corpo + franja * TAPETE_DE_LADO.pontaDoFioDeBaixo), y2: chao })
    }
  }
  return { regioes, tracos }
}

// ---------------------------------------------------------------- cama: travesseiro e cobertor

/** As mesmas réguas do glifo da cama em `lib/mobilia.ts` (lá são privadas: no app, use as de lá). */
const RECUO_TRAVESSEIRO = 0.12
const ALTURA_TRAVESSEIRO = 0.18
const DOBRA_DA_COBERTA = 0.42
/** Variante "moldura": o cobertor deixa à vista uma beira da cama nos lados e no pé, em fração do lado menor. */
const BEIRA_DA_MOLDURA = 0.07

/**
 * Áreas de tecido da cama, sobre os MESMOS traços de hoje (o retângulo do
 * travesseiro e a dobra): o travesseiro é o retângulo dele; o cobertor vai da
 * dobra ao pé. Só entra a área que tem cor própria — sem os campos novos a
 * cama sai pixel a pixel como hoje.
 */
export function regioesDaCama(w: number, h: number, corDoTravesseiro: boolean, corDoCobertor: boolean, moldura: boolean): RegiaoDoMovel[] {
  if (!tamanhoDesenhavel(w, h)) return []
  const hw = w / 2
  const hh = h / 2
  const recuo = Math.min(w, h) * RECUO_TRAVESSEIRO
  const topo = -hh + recuo
  const dobra = -hh + h * DOBRA_DA_COBERTA
  const beira = moldura ? Math.min(w, h) * BEIRA_DA_MOLDURA : 0
  const regioes: RegiaoDoMovel[] = []
  if (corDoCobertor) {
    regioes.push({ pontos: retanguloXY(-hw + beira, dobra, hw - beira, hh - beira), tom: 'cobertor' })
  }
  if (corDoTravesseiro) {
    regioes.push({ pontos: retanguloXY(-hw + recuo, topo, hw - recuo, topo + h * ALTURA_TRAVESSEIRO), tom: 'travesseiro' })
  }
  return regioes
}

function retanguloXY(esquerda: number, topo: number, direita: number, base: number): Ponto[] {
  return [{ x: esquerda, y: topo }, { x: direita, y: topo }, { x: direita, y: base }, { x: esquerda, y: base }]
}

// ---------------------------------------------------------------- pintura (extensão de drawPropSilhouettes)

/** O pedaço do `Graphics` do Pixi que a silhueta usa. */
export interface GraficoDoMovel {
  poly(pontos: number[], fechar?: boolean): GraficoDoMovel
  moveTo(x: number, y: number): GraficoDoMovel
  lineTo(x: number, y: number): GraficoDoMovel
  fill(estilo: { color: number; alpha: number }): GraficoDoMovel
  stroke(estilo: { width: number; color: number; alpha: number; join?: 'miter'; cap?: 'butt' }): GraficoDoMovel
}

interface Tinta {
  color: number
  alpha: number
}

/** O tapete sem "Cor" escurece o chão menos que os outros móveis: o móvel posto em cima dele ainda sai um tom abaixo. */
export const FUNDO_DO_TAPETE_ALPHA = 0.2
/** Borda e medalhão do tapete sem "Cor": mais uma camada de preto por cima do fundo (0,2 + 0,22 dá ~0,38 do chão). */
const ESCURO_DO_TAPETE_ALPHA = 0.22
/** Borda e medalhão do tapete com "Cor": a mesma cor, 30% mais perto do preto (mesmo matiz, nada que estoure). */
const ESCURECER_COR = 0.3

/** Mistura a cor com o preto na fração dada: o tom escuro da borda e do medalhão. */
export function tomEscuro(cor: number, fracao = ESCURECER_COR): number {
  const canal = (deslocamento: number): number => Math.round(((cor >> deslocamento) & 0xff) * (1 - fracao))
  return (canal(16) << 16) | (canal(8) << 8) | canal(0)
}

function tintaPropria(valor: unknown): Tinta | null {
  const cor = parseHexColor(normalizarCorDoMovel(valor))
  return cor === null ? null : { color: cor, alpha: 1 }
}

/** O que o fundo, o fio e cada área de tecido pintam neste móvel. `fundo: null` = "Preencher" desligado. */
function tintasDoMovel(prop: PropProposto): { fundo: Tinta | null; fio: Tinta; escuro: Tinta; travesseiro: Tinta | null; cobertor: Tinta | null } {
  const fio = tintaPropria(prop.mobiliaCorDaLinha) ?? { color: PROP_SILHOUETTE_EDGE_COLOR, alpha: PROP_SILHOUETTE_EDGE_ALPHA }
  const cor = tintaPropria(prop.mobiliaCor)
  const tapete = prop.mobilia === 'tapete'
  const fundoPadrao = { color: PROP_SILHOUETTE_FILL_COLOR, alpha: tapete ? FUNDO_DO_TAPETE_ALPHA : PROP_SILHOUETTE_FILL_ALPHA }
  const preenchido = prop.mobiliaPreenchido !== false
  return {
    fundo: preenchido ? (cor ?? fundoPadrao) : null,
    fio,
    escuro: cor === null ? { color: 0x000000, alpha: ESCURO_DO_TAPETE_ALPHA } : { color: tomEscuro(cor.color), alpha: 1 },
    travesseiro: preenchido ? tintaPropria(normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoTravesseiro)) : null,
    cobertor: preenchido ? tintaPropria(normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoCobertor)) : null,
  }
}

/** Ordem de desenho: o tapete fica no chão, por baixo de todo objeto (os outros na ordem de sempre). */
export function emOrdemDeDesenho<T extends { mobilia?: TipoProposto }>(props: readonly T[]): T[] {
  return [...props.filter((p) => p.mobilia === 'tapete'), ...props.filter((p) => p.mobilia !== 'tapete')]
}

/**
 * Pinta tapete e cama com tecido (o resto continua em `drawPropSilhouettes`).
 * A ordem é a mesma da silhueta de hoje — fundo, fio de fora, glifo — com as
 * áreas de cor entre o fundo e o fio, para o fio nunca ficar por baixo de uma cor.
 */
export function pintarMovelProposto(g: GraficoDoMovel, prop: PropProposto, cameraScale: number, rendererResolution: number, moldura = false): void {
  const tipo = prop.mobilia
  if (tipo === undefined || !tamanhoDesenhavel(prop.width, prop.height)) return
  const grade = pixelGrid(cameraScale, rendererResolution, PROP_SILHOUETTE_EDGE_SCREEN_PX)
  const largura = strokeWidthInWorld(grade)
  const tintas = tintasDoMovel(prop)
  const vista: VistaMobilia = tipo === 'tapete' && prop.mobiliaVista === 'lado' ? 'lado' : 'frente'
  const forma = formaDoTapete(prop)
  const redondo = tipo === 'tapete' && vista === 'frente' && forma === 'redondo'
  const contornoLocal = tipo === 'tapete' ? contornoDoTapete(forma, prop.width, prop.height, vista) : retanguloXY(-prop.width / 2, -prop.height / 2, prop.width / 2, prop.height / 2)
  if (contornoLocal === null) return
  // O redondo é curva: sem encostar no pixel, como o barril.
  const contorno = noMapa(prop, contornoLocal, redondo ? null : grade)
  const desenho = tipo === 'tapete' ? desenhoDoTapete(forma, prop.width, prop.height, vista) : null
  const regioes = desenho?.regioes ?? (tipo === 'catre' ? regioesDaCama(prop.width, prop.height, tintas.travesseiro !== null, tintas.cobertor !== null, moldura) : [])
  const tracos = desenho?.tracos ?? (tipo === 'tapete' ? [] : tracosDoGlifo(tipo, prop.width, prop.height))

  g.poly(contorno, true)
  if (tintas.fundo !== null) {
    g.fill(tintas.fundo)
    for (const regiao of regioes) {
      const tinta = regiao.tom === 'escuro' ? tintas.escuro : regiao.tom === 'travesseiro' ? tintas.travesseiro : tintas.cobertor
      if (tinta === null) continue
      g.poly(noMapa(prop, regiao.pontos, redondo ? null : grade), true).fill(tinta)
    }
    g.poly(contorno, true)
  }
  g.stroke({ width: largura, color: tintas.fio.color, alpha: tintas.fio.alpha, join: 'miter' })
  if (tracos.length === 0) return
  const trig = rotationTrig(prop.rotation ?? 0)
  const centro = { x: prop.x, y: prop.y }
  for (const t of tracos) {
    const a = rotatePointAround({ x: prop.x + t.x1, y: prop.y + t.y1 }, centro, trig)
    const b = rotatePointAround({ x: prop.x + t.x2, y: prop.y + t.y2 }, centro, trig)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y)
  }
  g.stroke({ width: largura, color: tintas.fio.color, alpha: tintas.fio.alpha, cap: 'butt' })
}

/** Pontos locais girados com o objeto; alinhado aos eixos, cada vértice encosta no pixel físico (como `silhouettePolygon`). */
function noMapa(prop: PropProposto, pontos: readonly Ponto[], grade: PixelGrid | null): number[] {
  const trig = rotationTrig(prop.rotation ?? 0)
  const centro = { x: prop.x, y: prop.y }
  const alinhado = grade !== null && (trig.sin === 0 || trig.cos === 0)
  return pontos.flatMap((p) => {
    const q = rotatePointAround({ x: prop.x + p.x, y: prop.y + p.y }, centro, trig)
    return alinhado ? [alignToPixel(q.x, grade), alignToPixel(q.y, grade)] : [q.x, q.y]
  })
}

/** O caminho novo vale para o tapete e para a cama com tecido; o resto segue igual. */
export function usaPinturaProposta(prop: PropProposto, moldura: boolean): boolean {
  if (prop.mobilia === 'tapete') return true
  if (prop.mobilia !== 'catre') return false
  return moldura || normalizarCorDeTecido('catre', prop.mobiliaCorDoTravesseiro) !== undefined || normalizarCorDeTecido('catre', prop.mobiliaCorDoCobertor) !== undefined
}

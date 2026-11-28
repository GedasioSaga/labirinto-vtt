import { Container, Graphics, GraphicsContext } from 'pixi.js'
import type { Prop } from '../types/map'
import { rotationToRadians } from '../lib/itemTransform'
import { faseDaAnimacao, type AnimacaoDoMovel } from '../lib/mobilia/animadores'
import { normalizarVersaoDoMovel } from '../lib/mobilia/versoes'
import { tresQuartosAtivo } from '../lib/mobilia/vistaTresQuartos'
import { ANIMACAO_DO_SAIDA_DE_ESGOTO } from '../texturas/meioTermo/moveis/saidaDeEsgoto'
import { ANIMACAO_DO_FONTE_DE_PAREDE } from '../texturas/meioTermo/moveis/fonteDeParede'

/**
 * O FIO DE ÁGUA (o animador `fioDeAgua` do I0-e, `lib/mobilia/animadores.ts`; plano de arte por tema, 28/11/2026): a
 * água que corre na saída de esgoto (a versão Escorrendo, L05) e na fonte de parede (a Correndo, L06), no MESMO relógio
 * e na mesma camada da chama e da água do chafariz (`chamasDasFogueiras.ts` cuida do relógio, do "menos movimento",
 * da névoa e da tela do jogador).
 *
 * A imagem do móvel já traz a água EM REPOUSO (o jorro e o fio de `montar<Tipo>QueMexe`, pintados junto da parte
 * parada): é a da folha aprovada e a de "menos movimento", e nunca é repintada por causa da água. O animador só põe
 * por cima o que mexe, um nó por objeto:
 *
 *   nó (posição = o meio do objeto)
 *     └ plano (gira com o objeto)
 *         ├ 2 anéis  (a onda que abre onde a água bate)
 *         └ 3 gotas  (descendo do pivô até onde a água bate, acelerando)
 *
 * As formas são desenhadas UMA vez por tela, brancas, e tingidas por tipo; por quadro só mudam posição, escala e alpha.
 * Com "menos movimento" (ou efeitos desligados) a pose é a PARADA: tudo apagado, e a imagem mostra a água parada.
 * Na vista 3/4 o objeto sai em pé e a água da imagem sobe junto: o fio de cima não entra (a imagem basta).
 */

export type TipoComFioDeAgua = 'saidaDeEsgoto' | 'fonteDeParede'

interface FioDoTipo {
  readonly animacao: AnimacaoDoMovel
  /** Quanto a água cai do pivô até bater, em fração da ALTURA da pegada (na pegada de partida). */
  readonly queda: number
  /** A versão gravada (já normalizada: `undefined` = a 1ª) em que a água corre. */
  readonly corre: (versao: string | undefined) => boolean
  /** O tom das gotas e dos anéis: o claro da água de cada peça. */
  readonly cor: number
}

/**
 * A queda de cada peça sai das medidas do desenhista: na saída, o `QUEDA` de 8,5 px do protótipo (56 px por casa,
 * `saidaDeEsgoto.ts`) da boca até a poça, na pegada de 1 casa; na fonte, os 3,4 px de `QUEDA - BOCA_DA_BICA`
 * (`fonteDeParede.ts`) na pegada de partida de 42 px de fundo.
 */
const QUEDA_DA_SAIDA = 8.5 / 56
const QUEDA_DA_FONTE = 3.4 / 42

export const FIOS_DE_AGUA: Readonly<Record<TipoComFioDeAgua, FioDoTipo>> = {
  // A água turva do esgoto: o claro esverdeado do reflexo do jorro, sem branco.
  saidaDeEsgoto: { animacao: ANIMACAO_DO_SAIDA_DE_ESGOTO, queda: QUEDA_DA_SAIDA, corre: (versao) => versao === 'escorrendo', cor: 0xb8c2ae },
  // A água limpa da bica: o claro da gota do chafariz (`aguaDosChafarizes.ts`).
  fonteDeParede: { animacao: ANIMACAO_DO_FONTE_DE_PAREDE, queda: QUEDA_DA_FONTE, corre: (versao) => versao !== 'seca', cor: 0xd4e1de },
}

export function ehTipoComFioDeAgua(tipo: string | undefined): tipo is TipoComFioDeAgua {
  return tipo === 'saidaDeEsgoto' || tipo === 'fonteDeParede'
}

/** O que o fio lê do objeto. */
export type PropDoFio = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'mobilia' | 'mobiliaVersao' | 'mobiliaTresQuartos'>

/** O fio deste objeto (`null` = não é peça de fio de água, a versão é a seca, o tamanho não desenha ou está em 3/4). */
export function fioDoMovel(prop: PropDoFio, vistaDosMoveis: Parameters<typeof tresQuartosAtivo>[1]): FioDoTipo | null {
  if (!ehTipoComFioDeAgua(prop.mobilia)) return null
  const fio = FIOS_DE_AGUA[prop.mobilia]
  if (!fio.corre(normalizarVersaoDoMovel(prop.mobilia, prop.mobiliaVersao))) return null
  if (!(prop.width > 0) || !(prop.height > 0) || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return null
  if (tresQuartosAtivo(prop, vistaDosMoveis)) return null
  return fio
}

// ---------- a pose (conta pura) ----------

/** As gotas nascem no pivô em terços do ciclo; cada uma cai numa fração dele. */
const NASCER_DAS_GOTAS = [0, 1 / 3, 2 / 3]
const VIDA_DA_GOTA = 0.55
/** Os anéis abrem onde a água bate, meio ciclo um do outro. */
const NASCER_DOS_ANEIS = [0, 0.5]

export interface PoseDaGota {
  /** De 0 (no pivô) a 1 (onde a água bate). */
  t: number
  escala: number
  alpha: number
}

export interface PoseDoAnel {
  /** De 0 (o ponto) a 1 (o anel aberto inteiro). */
  raio: number
  alpha: number
}

export interface PoseDoFio {
  gotas: PoseDaGota[]
  aneis: PoseDoAnel[]
}

export function novaPoseDoFio(): PoseDoFio {
  return {
    gotas: NASCER_DAS_GOTAS.map(() => ({ t: 0, escala: 1, alpha: 0 })),
    aneis: NASCER_DOS_ANEIS.map(() => ({ raio: 0, alpha: 0 })),
  }
}

function fracao(valor: number): number {
  return valor - Math.floor(valor)
}

/** Acende rápido e apaga devagar: o alpha na fração `p` da vida. */
function brilho(p: number, acender: number, apagar: number): number {
  return Math.min(1, p / acender) * Math.pow(1 - p, apagar)
}

/** Escreve em `destino` a pose do fio no instante `tempoMs`, na `fase` do objeto ([0, 1)), no período da peça. */
export function escreverPoseDoFio(animacao: AnimacaoDoMovel, tempoMs: number, fase: number, destino: PoseDoFio): PoseDoFio {
  const u = fracao(faseDaAnimacao(animacao, tempoMs) + fase)
  NASCER_DAS_GOTAS.forEach((inicio, i) => {
    const gota = destino.gotas[i]
    const p = fracao(u - inicio) / VIDA_DA_GOTA
    if (p >= 1) {
      gota.alpha = 0
      return
    }
    // Sai devagar da boca e acelera na queda (a gravidade).
    gota.t = p * p
    gota.escala = 1 - 0.3 * p
    gota.alpha = 0.85 * brilho(p, 0.15, 0.7)
  })
  NASCER_DOS_ANEIS.forEach((inicio, i) => {
    const anel = destino.aneis[i]
    const p = fracao(u - inicio)
    // Abre rápido onde a água bate e desacelera, apagando.
    anel.raio = 1 - (1 - p) * (1 - p)
    anel.alpha = 0.5 * brilho(p, 0.08, 1.4)
  })
  return destino
}

/** "Menos movimento" (ou sem relógio): nada por cima, a imagem mostra a água em repouso. Sempre o mesmo objeto. */
export const POSE_PARADA_DO_FIO: PoseDoFio = novaPoseDoFio()

/** A pose do fio (`reduzir` = a parada). Função pura. */
export function poseDoFio(animacao: AnimacaoDoMovel, tempoMs: number, fase: number, reduzir: boolean): PoseDoFio {
  if (reduzir) return POSE_PARADA_DO_FIO
  return escreverPoseDoFio(animacao, tempoMs, fase, novaPoseDoFio())
}

// ---------- o nó no palco ----------

/** O raio de referência das formas e o traço do anel nessa escala. */
const RAIO_DE_REFERENCIA = 64
const TRACO_DO_ANEL = 6
/** A gota: fração do menor lado da pegada, e nunca menor que isto na tela. */
const RAIO_DA_GOTA = 0.035
const RAIO_MINIMO_DA_GOTA_EM_PX = 1
/** O anel aberto inteiro: fração do menor lado; achatado no y (a poça vista de cima, um nada de lado, como a da folha). */
const RAIO_DO_ANEL = 0.2
const ACHATAMENTO_DO_ANEL = 0.55

export interface FormasDoFio {
  gota: GraphicsContext
  anel: GraphicsContext
}

/** Brancas: cada nó tinge com a cor do tipo. Todos os objetos da tela dividem as mesmas. */
export function criarFormasDoFio(): FormasDoFio {
  return {
    gota: new GraphicsContext().circle(0, 0, RAIO_DE_REFERENCIA).fill({ color: 0xffffff }),
    anel: new GraphicsContext().circle(0, 0, RAIO_DE_REFERENCIA).stroke({ width: TRACO_DO_ANEL, color: 0xffffff }),
  }
}

export function destruirFormasDoFio(formas: FormasDoFio): void {
  formas.gota.destroy()
  formas.anel.destroy()
}

export interface FioNoPalco {
  no: Container
  plano: Container
  gotas: Graphics[]
  aneis: Graphics[]
  tipo: TipoComFioDeAgua
  fase: number
  /** Medidas da última passada, em px de mundo no plano do objeto (o meio dele em 0, 0). */
  pivoX: number
  pivoY: number
  queda: number
  raioDaGota: number
  raioDoAnel: number
}

function graficos(n: number, contexto: GraphicsContext, rotulo: string, cor: number): Graphics[] {
  return Array.from({ length: n }, () => {
    const g = new Graphics(contexto)
    g.label = rotulo
    g.tint = cor
    g.alpha = 0
    return g
  })
}

/** Monta o nó do fio de um objeto (as formas são as da tela; `children: true` no destroy não as leva). */
export function criarFioNoPalco(id: string, tipo: TipoComFioDeAgua, formas: FormasDoFio, fase: number): FioNoPalco {
  const no = new Container()
  no.label = `fio:${id}`
  no.eventMode = 'none'
  const plano = new Container()
  plano.label = 'plano'
  const { cor } = FIOS_DE_AGUA[tipo]
  const aneis = graficos(NASCER_DOS_ANEIS.length, formas.anel, 'anel', cor)
  const gotas = graficos(NASCER_DAS_GOTAS.length, formas.gota, 'gota', cor)
  plano.addChild(...aneis, ...gotas)
  no.addChild(plano)
  return { no, plano, gotas, aneis, tipo, fase, pivoX: 0, pivoY: 0, queda: 0, raioDaGota: 1, raioDoAnel: 1 }
}

/** Põe o nó no meio do objeto, no giro dele, com o pivô e a queda desta pegada e o raio mínimo da gota neste zoom. */
export function posicionarFio(fio: FioNoPalco, prop: PropDoFio, cameraScale: number): void {
  const { animacao, queda } = FIOS_DE_AGUA[fio.tipo]
  fio.no.position.set(prop.x, prop.y)
  fio.plano.rotation = rotationToRadians(prop.rotation)
  fio.pivoX = (animacao.pivo.x - 0.5) * prop.width
  fio.pivoY = (animacao.pivo.y - 0.5) * prop.height
  fio.queda = queda * prop.height
  const escala = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
  const menor = Math.min(prop.width, prop.height)
  fio.raioDaGota = Math.max(RAIO_MINIMO_DA_GOTA_EM_PX / escala, RAIO_DA_GOTA * menor)
  fio.raioDoAnel = RAIO_DO_ANEL * menor
}

/** Só números: posição, escala e alpha de cada gota e anel, em px de mundo. */
export function aplicarPoseDoFio(fio: FioNoPalco, pose: PoseDoFio): void {
  const escalaDaGota = fio.raioDaGota / RAIO_DE_REFERENCIA
  for (let i = 0; i < fio.gotas.length; i += 1) {
    const p = pose.gotas[i]
    const g = fio.gotas[i]
    g.position.set(fio.pivoX, fio.pivoY + p.t * fio.queda)
    g.scale.set(escalaDaGota * p.escala)
    g.alpha = p.alpha
  }
  const yDaBatida = fio.pivoY + fio.queda
  for (let i = 0; i < fio.aneis.length; i += 1) {
    const p = pose.aneis[i]
    const g = fio.aneis[i]
    const k = (Math.max(fio.raioDaGota, p.raio * fio.raioDoAnel)) / RAIO_DE_REFERENCIA
    g.position.set(fio.pivoX, yDaBatida)
    g.scale.set(k, k * ACHATAMENTO_DO_ANEL)
    g.alpha = p.alpha
  }
}

/** O período do tipo (para o relógio: a pose usa a animação da peça). */
export function animacaoDoFio(tipo: TipoComFioDeAgua): AnimacaoDoMovel {
  return FIOS_DE_AGUA[tipo].animacao
}

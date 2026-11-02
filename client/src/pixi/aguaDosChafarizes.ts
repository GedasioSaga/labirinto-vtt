import { Container, Graphics, GraphicsContext } from 'pixi.js'
import type { Prop } from '../types/map'
import { aguaDoChafariz, ehChafariz, medidasDoChafariz, type MedidasDoChafariz } from '../lib/mobilia/chafariz'
import { rotationToRadians } from '../lib/itemTransform'

/**
 * A ÁGUA DOS CHAFARIZES (pedido do mestre de 02/11/2026): a parte animada do
 * chafariz, no MESMO relógio e na mesma camada da chama das fogueiras
 * (`chamasDasFogueiras.ts` cuida do relógio, do "menos movimento", da névoa e
 * da tela do jogador; aqui moram as formas, a pose e o nó de um chafariz). A
 * pedra, a água parada da bacia e o prato saem na imagem do móvel
 * (`texturas/meioTermo/moveis/chafariz.ts`), que NUNCA é repintada por causa
 * da água. Um nó por chafariz com a água ligada:
 *
 *   nó (posição = o meio do chafariz, sem giro)
 *     ├ plano (Container, gira com o objeto: a água da bacia)
 *     │   ├ 3 anéis      (a onda que sai do prato e abre até a borda)
 *     │   ├ 6 respingos  (a rodinha onde cada gota cai)
 *     │   └ 6 gotas      (caindo da borda do prato para a bacia)
 *     ├ jato: borda e miolo (EM PÉ na tela, como a chama: a coluna sobe do
 *     │       bico e os arcos caem de volta no prato)
 *     └ 3 borrifos (gotas claras descendo pelos arcos)
 *
 * As formas são desenhadas UMA vez por tela, em unidade de referência; por
 * quadro só mudam escala, posição e alpha (nada de `clear()` nem de `visible`).
 * Desligada, o nó sai. Com "menos movimento" a água fica na pose fixa
 * (`POSE_FIXA_DA_AGUA`): um quadro escolhido da água correndo, com o jato, a
 * coroa, as gotas a meio caminho e dois anéis na bacia (parada, não vazia).
 */

/** Um ciclo da água, em ms (o da chama): só harmônicos inteiros dele, então a volta não tem salto. */
export const CICLO_DA_AGUA_MS = 2400

/**
 * Cores próprias da água, a família do poço e do balde (o azul-petróleo do
 * Meio-Termo, `#40707e`) clareada e sem saturar: a borda do jato é a água com
 * luz, o miolo e as gotas são o claro do reflexo (`#c7d2cf`) um tom acima.
 * "Cor" e "Cor da linha" do móvel não mudam a água.
 */
export const COR_DA_BORDA_DO_JATO = 0x7fa2a8
export const COR_DO_MIOLO_DO_JATO = 0xdde8e5
export const COR_DA_GOTA = 0xd4e1de
export const COR_DO_ANEL = 0xd0dcd9

/** Unidades do contexto por H (a altura do jato), como a chama: a curva fica lisa até ~400 px de tela. */
const ALTURA_DE_REFERENCIA = 256
/**
 * O raio de referência do anel e da gota, e a espessura do traço nessa escala:
 * o anel grande da bacia (~1,5 a 2 px de mundo no chafariz de 2 x 2) e o
 * respingo, pequeno, com o traço mais grosso em proporção para não sumir.
 */
const RAIO_DE_REFERENCIA = 64
const TRACO_DO_ANEL = 3
const TRACO_DO_RESPINGO = 13
/** A gota nunca fica menor que isto na tela... */
const RAIO_MINIMO_DA_GOTA_EM_PX = 1.1
/** ...e no mais é esta fração do menor meio lado do chafariz. */
const RAIO_DA_GOTA = 0.03
/** O borrifo da coroa: fração da altura do jato. */
const RAIO_DO_BORRIFO = 0.035

/**
 * As 6 gotas: o ângulo na borda do prato (rad, no plano do objeto) e quando
 * nascem (fração do ciclo), fora de ordem: em sequência elas rodavam em volta
 * do prato como um ponteiro.
 */
const NASCER_DAS_GOTAS = [0, 0.52, 0.17, 0.69, 0.35, 0.86]
const GOTAS = NASCER_DAS_GOTAS.map((inicio, i) => ({ angulo: (i / 6) * 2 * Math.PI + 0.35, inicio }))
/** Vida da gota, em fração do ciclo (0,8 s): sai da borda e cai na bacia. */
const VIDA_DA_GOTA = 0.34
/** Até onde a gota anda, em fração da distância do prato à borda de dentro da bacia. */
const QUEDA_DA_GOTA = 0.42
/** O respingo nasce quando a gota cai e dura isto (fração do ciclo). */
const VIDA_DO_RESPINGO = 0.36
/** Os 3 anéis da bacia, um a cada terço do ciclo; cada um vive o ciclo inteiro. */
const ANEIS = [0, 1 / 3, 2 / 3]
/**
 * O jato em unidade de H (origem no bico, y negativo = para cima): a coluna
 * que sobe do bico e, de cada lado, dois arcos de água caindo de volta no
 * prato (o "buquê" do chafariz de praça). Cada arco é uma quadrática que sai
 * do alto da coluna: [início y, controle x, controle y, fim x, fim y], o lado
 * direito (o esquerdo é o espelho). Um jato cheio (bulbo) lia como um buraco
 * de fechadura visto de cima; a coluna fina sozinha, como um ponteiro.
 */
const ALTO_DA_COLUNA = -1
const ARCOS_DO_JATO: readonly (readonly [number, number, number, number, number])[] = [
  [-1, 0.42, -1.18, 0.66, -0.06],
  [-1, 0.2, -1.1, 0.4, -0.3],
]
/** Larguras do traço, em H: a coluna, os arcos, e o tanto que a borda passa do miolo. */
const LARGURA_DA_COLUNA = 0.075
const LARGURA_DO_ARCO = 0.045
const BORDA_DO_JATO = 0.04

/** O ponto do arco `arco` (lado direito) na fração `t` do caminho, em H. */
function pontoDoArco(arco: number, t: number, saida: { x: number; y: number }): void {
  const [inicioY, cx, cy, fimX, fimY] = ARCOS_DO_JATO[arco]
  const a = (1 - t) * (1 - t)
  const b = 2 * (1 - t) * t
  const c = t * t
  saida.x = b * cx + c * fimX
  saida.y = a * inicioY + b * cy + c * fimY
}

/** Os 3 borrifos: descem por um arco (o lado e qual arco) e quando nascem. */
const BORRIFOS = [
  { lado: -1, arco: 0, inicio: 0 },
  { lado: 1, arco: 0, inicio: 0.34 },
  { lado: 1, arco: 1, inicio: 0.67 },
]
const VIDA_DO_BORRIFO = 0.5

/** Uma partícula: posição em fração (o que cada uma quer dizer fica em `aplicarPoseDaAgua`), escala e alpha. */
interface Particula {
  x: number
  y: number
  escala: number
  alpha: number
}

/** A pose da água num instante: o que o relógio reescreve a cada quadro (nada novo para o coletor de lixo). */
export interface PoseDaAgua {
  jatoX: number
  jatoY: number
  /** Alpha do MIOLO do jato; a borda fica opaca. */
  miolo: number
  /** Em H (a altura do jato), a partir do bico; y negativo = para cima. */
  borrifos: Particula[]
  /** x = fração do caminho da borda do prato à queda (0..1); escala da gota. */
  gotas: Particula[]
  /** x = fração do raio do respingo (0..1). */
  respingos: Particula[]
  /** x = fração do caminho do anel, do prato à borda da bacia (0..1). */
  aneis: Particula[]
}

function particula(): Particula {
  return { x: 0, y: 0, escala: 1, alpha: 0 }
}

export function novaPoseDaAgua(): PoseDaAgua {
  return {
    jatoX: 1,
    jatoY: 1,
    miolo: 0.9,
    borrifos: BORRIFOS.map(particula),
    gotas: GOTAS.map(particula),
    respingos: GOTAS.map(particula),
    aneis: ANEIS.map(particula),
  }
}

function fracao(valor: number): number {
  return valor - Math.floor(valor)
}

/** Acende rápido e apaga devagar: o alpha de uma partícula na fração `p` da vida. */
function brilho(p: number, acender: number, apagar: number): number {
  return Math.min(1, p / acender) * Math.pow(1 - p, apagar)
}

/** Escreve em `destino` a pose da água no instante `tempoMs`, na fase `fase` ([0, 1), a do chafariz). */
export function escreverPoseDaAgua(tempoMs: number, fase: number, destino: PoseDaAgua): PoseDaAgua {
  const volta = 2 * Math.PI
  const u = fracao(tempoMs / CICLO_DA_AGUA_MS + fase)
  // O jato pulsa pouco (a pressão da água): sobe e afina, desce e engrossa.
  destino.jatoY = 1 + 0.05 * Math.sin(volta * 2 * u) + 0.025 * Math.sin(volta * 5 * u + 1.1) + 0.012 * Math.sin(volta * 11 * u + 0.3)
  destino.jatoX = 1 - 0.5 * (destino.jatoY - 1) + 0.025 * Math.sin(volta * 3 * u + 2.2)
  destino.miolo = Math.min(1, 0.84 + 0.1 * Math.sin(volta * 4 * u + 0.6) + 0.05 * Math.sin(volta * 7 * u + 2.4))
  BORRIFOS.forEach((b, i) => {
    const saida = destino.borrifos[i]
    const p = fracao(u - b.inicio) / VIDA_DO_BORRIFO
    if (p >= 1) {
      saida.alpha = 0
      return
    }
    // Desce pelo arco, devagar no alto e acelerando na queda.
    pontoDoArco(b.arco, 0.12 + 0.88 * p * (0.6 + 0.4 * p), saida)
    saida.x *= b.lado
    saida.escala = 1 - 0.3 * p
    saida.alpha = brilho(p, 0.1, 1.3)
  })
  GOTAS.forEach((g, i) => {
    const gota = destino.gotas[i]
    const respingo = destino.respingos[i]
    const p = fracao(u - g.inicio) / VIDA_DA_GOTA
    if (p < 1) {
      // Sai devagar da borda e acelera na queda.
      gota.x = p * p
      gota.escala = 1 - 0.25 * p
      gota.alpha = brilho(p, 0.15, 0.6)
    } else {
      gota.alpha = 0
    }
    const q = fracao(u - g.inicio - VIDA_DA_GOTA) / VIDA_DO_RESPINGO
    if (q < 1) {
      respingo.x = 1 - (1 - q) * (1 - q)
      respingo.alpha = 0.7 * brilho(q, 0.08, 1.6)
    } else {
      respingo.alpha = 0
    }
  })
  ANEIS.forEach((inicio, i) => {
    const anel = destino.aneis[i]
    const p = fracao(u - inicio)
    // Abre rápido perto do prato e desacelera até a borda, apagando.
    anel.x = 1 - (1 - p) * (1 - p)
    anel.alpha = 0.5 * brilho(p, 0.1, 1.5)
  })
  return destino
}

/** O instante (fração do ciclo) da pose parada: o jato com a coroa aberta, gotas a meio caminho, dois anéis na bacia. */
const INSTANTE_DA_POSE_FIXA = 0.22

/** A água parada ("menos movimento", ou sem relógio): sempre o mesmo objeto. */
export const POSE_FIXA_DA_AGUA: PoseDaAgua = escreverPoseDaAgua(INSTANTE_DA_POSE_FIXA * CICLO_DA_AGUA_MS, 0, novaPoseDaAgua())

/** A pose da água no instante `tempoMs` (`reduzir` = a pose fixa). Função pura. */
export function poseDaAgua(tempoMs: number, fase: number, reduzir: boolean): PoseDaAgua {
  if (reduzir) return POSE_FIXA_DA_AGUA
  return escreverPoseDaAgua(tempoMs, fase, novaPoseDaAgua())
}

/**
 * O jato desenhado em traço redondo: a borda é o mesmo desenho mais grosso
 * (`folga`), por baixo do miolo claro.
 */
function contextoDoJato(cor: number, folga: number): GraphicsContext {
  const r = ALTURA_DE_REFERENCIA
  const contexto = new GraphicsContext()
  contexto.moveTo(0, 0).lineTo(0, ALTO_DA_COLUNA * r)
  contexto.stroke({ width: (LARGURA_DA_COLUNA + folga) * r, color: cor, cap: 'round', join: 'round' })
  for (const lado of [1, -1]) {
    for (const [inicioY, cx, cy, fimX, fimY] of ARCOS_DO_JATO) {
      contexto.moveTo(0, inicioY * r).quadraticCurveTo(lado * cx * r, cy * r, lado * fimX * r, fimY * r)
    }
  }
  return contexto.stroke({ width: (LARGURA_DO_ARCO + folga) * r, color: cor, cap: 'round', join: 'round' })
}

/** As formas da água (o jato, a gota e o anel), em unidade de referência: todos os chafarizes da tela dividem as mesmas. */
export interface FormasDaAgua {
  borda: GraphicsContext
  miolo: GraphicsContext
  gota: GraphicsContext
  anel: GraphicsContext
  respingo: GraphicsContext
}

export function criarFormasDaAgua(): FormasDaAgua {
  return {
    borda: contextoDoJato(COR_DA_BORDA_DO_JATO, BORDA_DO_JATO),
    miolo: contextoDoJato(COR_DO_MIOLO_DO_JATO, 0),
    gota: new GraphicsContext().circle(0, 0, RAIO_DE_REFERENCIA).fill({ color: COR_DA_GOTA }),
    anel: new GraphicsContext().circle(0, 0, RAIO_DE_REFERENCIA).stroke({ width: TRACO_DO_ANEL, color: COR_DO_ANEL }),
    respingo: new GraphicsContext().circle(0, 0, RAIO_DE_REFERENCIA).stroke({ width: TRACO_DO_RESPINGO, color: COR_DO_ANEL }),
  }
}

export function destruirFormasDaAgua(formas: FormasDaAgua): void {
  formas.borda.destroy()
  formas.miolo.destroy()
  formas.gota.destroy()
  formas.anel.destroy()
  formas.respingo.destroy()
}

/** O que a água lê do objeto. */
export type PropDaAgua = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'mobilia' | 'mobiliaForma'>

/** As medidas da água deste objeto (`null` = não é chafariz, a água está desligada ou o tamanho não desenha). */
export function aguaCorrendo(prop: Pick<Prop, 'mobilia' | 'mobiliaForma' | 'width' | 'height'>): MedidasDoChafariz | null {
  if (!ehChafariz(prop.mobilia) || aguaDoChafariz(prop.mobiliaForma) === 'desligada') return null
  return medidasDoChafariz(prop.width, prop.height)
}

/** O nó de um chafariz no palco, com as medidas da última passada (px de mundo). */
export interface AguaNoPalco {
  no: Container
  plano: Container
  borda: Graphics
  miolo: Graphics
  borrifos: Graphics[]
  gotas: Graphics[]
  respingos: Graphics[]
  aneis: Graphics[]
  medidas: MedidasDoChafariz
  /** O raio da gota e do respingo nesta passada (px de mundo), com o mínimo de tela. */
  raioDaGota: number
  fase: number
}

function graficos(n: number, contexto: GraphicsContext, rotulo: string): Graphics[] {
  return Array.from({ length: n }, () => {
    const g = new Graphics(contexto)
    g.label = rotulo
    g.alpha = 0
    return g
  })
}

/** Monta o nó de um chafariz (as formas são as da tela; `children: true` no destroy não as leva). */
export function criarAguaNoPalco(id: string, formas: FormasDaAgua, medidas: MedidasDoChafariz, fase: number): AguaNoPalco {
  const no = new Container()
  no.label = `agua:${id}`
  no.eventMode = 'none'
  const plano = new Container()
  plano.label = 'plano'
  const aneis = graficos(ANEIS.length, formas.anel, 'anel')
  const respingos = graficos(GOTAS.length, formas.respingo, 'respingo')
  const gotas = graficos(GOTAS.length, formas.gota, 'gota')
  plano.addChild(...aneis, ...respingos, ...gotas)
  const borda = new Graphics(formas.borda)
  borda.label = 'jato'
  const miolo = new Graphics(formas.miolo)
  miolo.label = 'miolo'
  const borrifos = graficos(BORRIFOS.length, formas.gota, 'borrifo')
  no.addChild(plano, borda, miolo, ...borrifos)
  return { no, plano, borda, miolo, borrifos, gotas, respingos, aneis, medidas, raioDaGota: 1, fase }
}

/** Põe o nó no meio do chafariz, no giro dele, com as medidas desta pegada e o raio mínimo da gota neste zoom. */
export function posicionarAgua(agua: AguaNoPalco, prop: PropDaAgua, medidas: MedidasDoChafariz, cameraScale: number): void {
  agua.no.position.set(prop.x, prop.y)
  agua.plano.rotation = rotationToRadians(prop.rotation)
  agua.medidas = medidas
  const escala = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
  const menor = Math.min(prop.width, prop.height) / 2
  agua.raioDaGota = Math.max(RAIO_MINIMO_DA_GOTA_EM_PX / escala, RAIO_DA_GOTA * menor)
}

/** Só números: escala, posição e alpha de cada peça da água, em px de mundo a partir das medidas. */
export function aplicarPoseDaAgua(agua: AguaNoPalco, pose: PoseDaAgua): void {
  const m = agua.medidas
  const H = m.jato
  const k = H / ALTURA_DE_REFERENCIA
  agua.borda.scale.set(k * pose.jatoX, k * pose.jatoY)
  agua.miolo.scale.set(k * pose.jatoX, k * pose.jatoY)
  agua.miolo.alpha = pose.miolo
  const raioDoBorrifo = Math.max(agua.raioDaGota * 0.8, RAIO_DO_BORRIFO * H) / RAIO_DE_REFERENCIA
  for (let i = 0; i < agua.borrifos.length; i += 1) {
    const p = pose.borrifos[i]
    const g = agua.borrifos[i]
    g.position.set(p.x * H, p.y * H * pose.jatoY)
    g.scale.set(raioDoBorrifo * p.escala)
    g.alpha = p.alpha
  }
  // A água da bacia, no plano do objeto: a borda do prato até a borda de dentro, oval se esticada.
  const folgaX = Math.max(0, m.aguaX - m.prato)
  const folgaY = Math.max(0, m.aguaY - m.prato)
  const raioDaGota = agua.raioDaGota / RAIO_DE_REFERENCIA
  for (let i = 0; i < agua.gotas.length; i += 1) {
    const { angulo } = GOTAS[i]
    const cos = Math.cos(angulo)
    const sin = Math.sin(angulo)
    const gota = pose.gotas[i]
    const g = agua.gotas[i]
    const t = gota.x * QUEDA_DA_GOTA
    g.position.set(cos * (m.prato + folgaX * t), sin * (m.prato + folgaY * t))
    g.scale.set(raioDaGota * gota.escala)
    g.alpha = gota.alpha
    // O respingo onde a gota caiu: uma rodinha que abre até ~3 gotas de raio.
    const respingo = pose.respingos[i]
    const r = agua.respingos[i]
    r.position.set(cos * (m.prato + folgaX * QUEDA_DA_GOTA), sin * (m.prato + folgaY * QUEDA_DA_GOTA))
    r.scale.set(raioDaGota * (1 + 3.2 * respingo.x))
    r.alpha = respingo.alpha
  }
  for (let i = 0; i < agua.aneis.length; i += 1) {
    const anel = pose.aneis[i]
    const g = agua.aneis[i]
    const rx = m.prato * 1.04 + (m.aguaX * 0.94 - m.prato * 1.04) * anel.x
    const ry = m.prato * 1.04 + (m.aguaY * 0.94 - m.prato * 1.04) * anel.x
    g.scale.set(rx / RAIO_DE_REFERENCIA, ry / RAIO_DE_REFERENCIA)
    g.alpha = anel.alpha
  }
}

import { Container, Graphics, GraphicsContext } from 'pixi.js'
import type { Prop } from '../types/map'
import { ehMovelDeVento, RODAS_DO_VENTO, rodaNaPegada, ventoDoMovel, type DesenhoDoVento } from '../lib/mobilia/cataVento'

/**
 * AS PÁS DOS OBJETOS DE VENTO (pedido do mestre de 02/11/2026): a parte
 * animada do cata-vento de fazenda, do moinho e do cata-vento de brinquedo, no
 * MESMO relógio e na mesma camada da chama e da água (`chamasDasFogueiras.ts`
 * cuida do relógio, do "menos movimento", da névoa e da tela do jogador; aqui
 * moram as formas, o ângulo e o nó de um objeto). A base (os pés da torre, o
 * telhado do moinho, o palito) sai na imagem do móvel
 * (`texturas/meioTermo/moveis/cataVento.ts`), que NUNCA é repintada pelo giro.
 *
 *   nó (posição = o meio da roda: o meio da pegada, subido a altura da torre)
 *     ├ fixo (a haste até a base; na fazenda também o leme, atrás da roda)
 *     └ pás  (a roda de muitas pás, as 4 velas ou o papel: só a `rotation` muda)
 *
 * As pás ficam EM PÉ na tela, como a chama: de cima, uma roda de lado seria um
 * risco. As formas são desenhadas UMA vez por tela, em unidade de referência
 * (R = a ponta da pá); por quadro só muda a rotação (nada de `clear()`).
 * Parado, ou com "menos movimento", as pás ficam num ângulo fixo escolhido.
 */

/** Unidades do contexto por raio da roda: o traço fica liso até ~400 px de tela. */
const R = 128

/** O ângulo das pás paradas, escolhido por objeto: o moinho em X, a roda e o papel um pouco tortos. */
const ANGULO_PARADO: Readonly<Record<DesenhoDoVento, number>> = {
  cataVento: Math.PI / 36,
  moinho: Math.PI / 4,
  cataVentoBrinquedo: Math.PI / 9,
  // As 6 velas da torre: nenhuma em pé sobre a torre nem deitada reta.
  moinhoTorre: Math.PI / 12,
}

/**
 * Cores próprias, contidas: a roda de chapa galvanizada (cinza esverdeado) com
 * os aros escuros; as velas de lona crua na grade de madeira escura; o papel
 * do brinquedo em quatro tons de tinta velha (terracota, ocre, verde-água,
 * azul ardósia), sem saturar.
 */
const CHAPA = 0xbcc3bf
const CHAPA_ESCURA = 0x5c6460
const MADEIRA_ESCURA = 0x4a3a2c
const MADEIRA = 0x6e5843
const LONA = 0xd9cdb1
const PAPEL = [0xb0594d, 0xcfa752, 0x4f8682, 0x6a7ea4] as const
const PALITO = 0xb8925e
const PINO = 0xe8e0cf
/**
 * O moinho de torre (03/11/2026): o azul das velas e da cúpula, o mesmo da
 * imagem da base (`texturas/meioTermo/moveis/cataVento.ts`), um pouco
 * apagado para caber no Meio-Termo; a borda de lona crua e a vara escura.
 */
const AZUL_DA_VELA = 0x3f6e9f
const AZUL_ESCURO = 0x274563
const BORDA_DA_VELA = 0xe9dfc4
const VARA_DA_TORRE = 0x5a4634

type Ponto = readonly [number, number]

function polar(r: number, a: number): Ponto {
  return [r * Math.cos(a) * R, r * Math.sin(a) * R]
}

/** O ponto (u ao longo da pá, v para o lado) da pá no ângulo `a`, em unidade de referência. */
function naPa(u: number, v: number, a: number): Ponto {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [(u * c - v * s) * R, (u * s + v * c) * R]
}

function plano(pontos: readonly Ponto[]): number[] {
  return pontos.flatMap(([x, y]) => [x, y])
}

/** Quanto o meio da roda sobe, em R (a haste até a base tem este comprimento). */
function subidaEmR(tipo: DesenhoDoVento): number {
  const roda = RODAS_DO_VENTO[tipo]
  return roda.altura / roda.raio
}

/** A roda de fazenda: 18 pás de chapa entre os dois aros, o cubo escuro no meio. */
function contextoDaRoda(): GraphicsContext {
  const g = new GraphicsContext()
  const pas = 18
  for (let i = 0; i < pas; i += 1) {
    const a = (i / pas) * 2 * Math.PI
    // A pá é torta (o passo da hélice): mais larga na ponta, adiantada de um lado.
    g.poly(plano([polar(0.3, a - 0.06), polar(0.3, a + 0.07), polar(0.99, a + 0.15), polar(0.99, a - 0.04)])).fill({ color: CHAPA })
    g.stroke({ width: 0.014 * R, color: CHAPA_ESCURA, join: 'round' })
  }
  g.circle(0, 0, 0.34 * R).stroke({ width: 0.035 * R, color: CHAPA_ESCURA })
  g.circle(0, 0, 0.98 * R).stroke({ width: 0.028 * R, color: CHAPA_ESCURA })
  for (let i = 0; i < 6; i += 1) {
    const [x, y] = polar(0.34, (i / 6) * 2 * Math.PI)
    g.moveTo(0, 0).lineTo(x, y)
  }
  g.stroke({ width: 0.03 * R, color: CHAPA_ESCURA })
  g.circle(0, 0, 0.12 * R).fill({ color: 0x4a504d })
  return g.circle(0, 0, 0.05 * R).fill({ color: 0x9aa29e })
}

/** As 4 velas do moinho: a vara de madeira e, de um lado, a grade com a lona esticada. */
function contextoDasVelas(): GraphicsContext {
  const g = new GraphicsContext()
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * 2 * Math.PI
    const lona = plano([naPa(0.2, 0.035, a), naPa(0.98, 0.035, a), naPa(0.98, 0.3, a), naPa(0.2, 0.3, a)])
    g.poly(lona).fill({ color: LONA, alpha: 0.92 })
    for (let j = 1; j <= 5; j += 1) {
      const u = 0.2 + j * 0.13
      const [x1, y1] = naPa(u, 0.035, a)
      const [x2, y2] = naPa(u, 0.3, a)
      g.moveTo(x1, y1).lineTo(x2, y2)
    }
    const [lx1, ly1] = naPa(0.2, 0.17, a)
    const [lx2, ly2] = naPa(0.98, 0.17, a)
    g.moveTo(lx1, ly1).lineTo(lx2, ly2)
    g.stroke({ width: 0.014 * R, color: MADEIRA_ESCURA, alpha: 0.85 })
    g.poly(lona).stroke({ width: 0.022 * R, color: MADEIRA_ESCURA, join: 'round' })
    g.poly(plano([naPa(0, -0.028, a), naPa(1, -0.022, a), naPa(1, 0.022, a), naPa(0, 0.028, a)])).fill({ color: MADEIRA })
    g.stroke({ width: 0.012 * R, color: MADEIRA_ESCURA })
  }
  g.circle(0, 0, 0.09 * R).fill({ color: MADEIRA }).stroke({ width: 0.02 * R, color: MADEIRA_ESCURA })
  return g.circle(0, 0, 0.035 * R).fill({ color: 0x8a7356 })
}

/**
 * As 6 velas do moinho de torre (03/11/2026): a vara de madeira escura e, de
 * um lado, a vela azul comprida, um pouco mais larga na ponta, com a borda
 * clara de lona crua em volta e duas costuras; o cubo azul com o aro claro.
 */
function contextoDasVelasDaTorre(): GraphicsContext {
  const g = new GraphicsContext()
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * 2 * Math.PI
    g.poly(plano([naPa(0.04, -0.022, a), naPa(1, -0.016, a), naPa(1, 0.016, a), naPa(0.04, 0.022, a)])).fill({ color: VARA_DA_TORRE })
    g.stroke({ width: 0.012 * R, color: MADEIRA_ESCURA })
    // Estreita no pé (0,1) e mais larga na ponta (0,15): entre as velas a torre branca aparece.
    const vela = plano([naPa(0.2, 0.03, a), naPa(0.97, 0.03, a), naPa(0.97, 0.18, a), naPa(0.2, 0.13, a)])
    g.poly(vela).fill({ color: AZUL_DA_VELA })
    // As costuras da vela, de través, mais escuras que o azul.
    for (const u of [0.46, 0.72]) {
      const t = (u - 0.2) / 0.77
      const [x1, y1] = naPa(u, 0.03, a)
      const [x2, y2] = naPa(u, 0.13 + 0.05 * t, a)
      g.moveTo(x1, y1).lineTo(x2, y2)
    }
    g.stroke({ width: 0.01 * R, color: AZUL_ESCURO, alpha: 0.7 })
    g.poly(vela).stroke({ width: 0.026 * R, color: BORDA_DA_VELA, join: 'round' })
  }
  g.circle(0, 0, 0.11 * R).fill({ color: AZUL_DA_VELA }).stroke({ width: 0.026 * R, color: BORDA_DA_VELA })
  return g.circle(0, 0, 0.04 * R).fill({ color: AZUL_ESCURO })
}

/** O papel do brinquedo: 4 folhas dobradas em redemoinho, cada uma com a dobra mais escura, e o pino. */
function contextoDoPapel(): GraphicsContext {
  const g = new GraphicsContext()
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * 2 * Math.PI
    const ponta = polar(1, a)
    g.poly(plano([[0, 0], ponta, polar(0.5, a + Math.PI / 2 - 0.2)])).fill({ color: PAPEL[i] })
    g.stroke({ width: 0.03 * R, color: 0x3b3530, alpha: 0.55, join: 'round' })
    // A dobra: o lado de dentro da folha, na sombra.
    g.poly(plano([[0, 0], ponta, polar(0.36, a + 0.55)])).fill({ color: 0x000000, alpha: 0.2 })
  }
  g.circle(0, 0, 0.1 * R).fill({ color: PINO }).stroke({ width: 0.025 * R, color: 0x5b524a })
  return g
}

/** A parte que não gira: a haste do meio da roda até a base, e o leme da fazenda (atrás da roda). */
function contextoFixo(tipo: DesenhoDoVento): GraphicsContext {
  const g = new GraphicsContext()
  const desce = subidaEmR(tipo) * R
  if (tipo === 'cataVento') {
    // O leme: a vara saindo para trás (o lado, na tela) e a chapa na ponta, para fora da roda.
    g.moveTo(0, 0).lineTo(1.02 * R, 0.1 * R).stroke({ width: 0.045 * R, color: CHAPA_ESCURA, cap: 'round' })
    g.poly(plano([[0.66 * R, -0.04 * R], [1.08 * R, -0.18 * R], [1.16 * R, 0.3 * R], [0.7 * R, 0.2 * R]])).fill({ color: 0xa9b1ad })
    g.stroke({ width: 0.02 * R, color: CHAPA_ESCURA, join: 'round' })
    // O alto da torre: as duas pernas de madeira que descem para a plataforma, com uma travessa.
    g.poly(plano([[-0.05 * R, 0], [0.05 * R, 0], [0.16 * R, desce], [-0.16 * R, desce]])).fill({ color: MADEIRA })
    g.stroke({ width: 0.02 * R, color: MADEIRA_ESCURA, join: 'round' })
    return g.moveTo(-0.11 * R, desce * 0.55).lineTo(0.11 * R, desce * 0.55).stroke({ width: 0.02 * R, color: MADEIRA_ESCURA })
  }
  if (tipo === 'moinhoTorre') {
    // O pescoço azul do eixo, saindo do alto da cúpula até o cubo das velas.
    g.poly(plano([[-0.06 * R, 0], [0.06 * R, 0], [0.09 * R, desce], [-0.09 * R, desce]])).fill({ color: AZUL_DA_VELA })
    g.stroke({ width: 0.02 * R, color: AZUL_ESCURO, join: 'round' })
    return g.circle(0, 0, 0.15 * R).fill({ color: AZUL_DA_VELA }).stroke({ width: 0.02 * R, color: AZUL_ESCURO })
  }
  if (tipo === 'moinho') {
    // O boné do moinho, de onde sai o eixo das velas, assentado no alto do telhado.
    g.poly(plano([[-0.07 * R, 0], [0.07 * R, 0], [0.1 * R, desce], [-0.1 * R, desce]])).fill({ color: MADEIRA })
    g.stroke({ width: 0.02 * R, color: MADEIRA_ESCURA, join: 'round' })
    return g.circle(0, 0, 0.15 * R).fill({ color: MADEIRA }).stroke({ width: 0.02 * R, color: MADEIRA_ESCURA })
  }
  // O palito do brinquedo, do pino até a terra.
  g.rect(-0.035 * R, 0, 0.07 * R, desce).fill({ color: PALITO })
  return g.stroke({ width: 0.015 * R, color: 0x6b5236 })
}

/** As formas das pás de uma tela, por tipo: a parte fixa e a que gira. Todos os objetos da tela dividem as mesmas. */
export type FormasDoVento = Readonly<Record<DesenhoDoVento, { readonly fixo: GraphicsContext; readonly pas: GraphicsContext }>>

export function criarFormasDoVento(): FormasDoVento {
  return {
    cataVento: { fixo: contextoFixo('cataVento'), pas: contextoDaRoda() },
    moinho: { fixo: contextoFixo('moinho'), pas: contextoDasVelas() },
    cataVentoBrinquedo: { fixo: contextoFixo('cataVentoBrinquedo'), pas: contextoDoPapel() },
    moinhoTorre: { fixo: contextoFixo('moinhoTorre'), pas: contextoDasVelasDaTorre() },
  }
}

export function destruirFormasDoVento(formas: FormasDoVento): void {
  for (const tipo of Object.keys(formas) as DesenhoDoVento[]) {
    formas[tipo].fixo.destroy()
    formas[tipo].pas.destroy()
  }
}

/** O que as pás leem do objeto. */
export type PropDoVento = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'mobilia' | 'mobiliaForma'>

/** O nó das pás de um objeto no palco. */
export interface VentoNoPalco {
  no: Container
  fixo: Graphics
  pas: Graphics
  /** O desenho das pás (o tipo, ou as 6 velas do moinho de torre): trocar a forma troca o nó. */
  tipo: DesenhoDoVento
  /** Girando (o mapa não diz Parado). */
  girando: boolean
  /** Fase do giro, em fração de volta: objetos vizinhos não giram juntos. */
  fase: number
}

/** Monta o nó das pás (as formas são as da tela; `children: true` no destroy não as leva). */
export function criarVentoNoPalco(id: string, tipo: DesenhoDoVento, formas: FormasDoVento, fase: number): VentoNoPalco {
  const no = new Container()
  no.label = `vento:${id}`
  no.eventMode = 'none'
  const fixo = new Graphics(formas[tipo].fixo)
  fixo.label = 'fixo'
  const pas = new Graphics(formas[tipo].pas)
  pas.label = 'pas'
  no.addChild(fixo, pas)
  return { no, fixo, pas, tipo, girando: true, fase }
}

/**
 * Põe o nó no meio da roda deste objeto (o meio da pegada, subido a altura da
 * torre; as pás ficam em pé, então o giro do objeto não as vira) e lê o vento.
 * `false` = não é objeto de vento ou o tamanho não desenha.
 */
export function posicionarVento(vento: VentoNoPalco, prop: PropDoVento): boolean {
  if (!ehMovelDeVento(prop.mobilia) || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return false
  const roda = rodaNaPegada(vento.tipo, prop.width, prop.height)
  if (roda === null) return false
  vento.no.position.set(prop.x, prop.y - roda.sobe)
  const k = roda.raio / R
  vento.fixo.scale.set(k)
  vento.pas.scale.set(k)
  vento.girando = ventoDoMovel(prop.mobiliaForma) === 'girando'
  return true
}

/** O ângulo das pás no instante `tempoMs` (`parado` = o ângulo fixo do tipo). Função pura. */
export function anguloDasPas(tipo: DesenhoDoVento, tempoMs: number, fase: number, parado: boolean): number {
  if (parado) return ANGULO_PARADO[tipo]
  const roda = RODAS_DO_VENTO[tipo]
  const volta = tempoMs / roda.voltaMs + fase
  return roda.sentido * 2 * Math.PI * (volta - Math.floor(volta)) + ANGULO_PARADO[tipo]
}

/** Só a rotação: as pás no instante `tempoMs` (`parado` = o ângulo fixo). */
export function aplicarAnguloDasPas(vento: VentoNoPalco, tempoMs: number, parado: boolean): void {
  vento.pas.rotation = anguloDasPas(vento.tipo, tempoMs, vento.fase, parado || !vento.girando)
}

import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, vizinhos, type Rgb } from '../ruido'

/**
 * BASALTO COM BRASA (L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Lava): a crosta
 * de lava que esfriou por cima e ainda arde por baixo. A crosta é de basalto escuro, quebrada em PLACAS tortas (as
 * células de uma grade sorteada), cada placa um nada estufada (acesa do lado de cima à esquerda, escura do lado de lá)
 * e num tom próprio, com o grão, os furinhos de gás e as rachas finas que não chegam a abrir. Entre as placas, a
 * FENDA: onde a lava está perto, ela arde (o fio claro no meio, a beira vinho e a beira das placas avermelhada pelo
 * calor); onde está longe, a fenda é só escura. As fendas acesas juntam em zonas (um ruído largo), não em toda parte.
 * Ladrilho de 8 casas, que dá a volta.
 *
 * Conta barata por pixel (dois `vizinhos` e dois `fbm`): o ladrilho sai em fatias, sem tabela.
 */

/** O basalto: o tom das placas e a variação de uma para outra; o grão. */
const BASALTO: Rgb = rgb('#4f4945')
const BASALTO_CLARO: Rgb = rgb('#5e5751')
const FURO: Rgb = rgb('#3a3532')
/** A fenda fria (escura) e a acesa: a beira vinho, o meio e o fio claro; a beira da placa no calor. */
const FENDA_FRIA: Rgb = rgb('#332e2c')
const BRASA_FUNDA: Rgb = rgb('#76382a')
const BRASA: Rgb = rgb('#ac6240')
const BRASA_CLARA: Rgb = rgb('#c48c60')
const BEIRA_QUENTE: Rgb = rgb('#6c4436')

/** As placas: células por lado do ladrilho, o quanto o ponto foge do meio da célula. */
const PLACAS = { celulas: 11, folga: 0.42, semente: 6101 } as const
/** A fenda entre as placas: a meia largura (em células) e o quanto ela varia ao longo do caminho. */
const FENDA = { meia: 0.05, varia: 0.5 } as const
/**
 * Onde a fenda arde: as zonas (células por lado do ladrilho) e o limiar. Com 4 zonas por ladrilho (1ª folha,
 * 28/11/2026) as faixas quentes juntavam por linha e a folha media listra (0,019 de 0,0175).
 */
const ZONA = { celulas: 6, de: 0.38, ate: 0.72, semente: 6111 } as const
/** A luz da placa estufada (o quanto o lado de cima à esquerda acende e o de lá apaga) e o calor na beira dela. */
const ESTUFA = { claro: 0.11, escuro: 0.13, beira: 0.16, forcaDaBeira: 0.5 } as const
/** As rachas finas da crosta (fechadas, sem brasa): as células e a meia largura. */
const RACHAS = { celulas: 34, meia: 0.03, forca: 0.32, semente: 6121 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

interface NaPlaca {
  /** A distância (em células) até a beira da placa mais perto (a fenda). */
  readonly beira: number
  /** De onde até o meio da placa (em células): a estufa dela. */
  readonly dx: number
  readonly dy: number
  /** O sorteio do tom da placa. */
  readonly tom: number
}

/**
 * A placa que cobre o ponto e a distância até a beira dela: a distância exata até a mediatriz entre o ponto da
 * célula mais perto e o segundo mais perto (a beira da célula de Voronoi).
 */
function placa(u: number, v: number, n: number, semente: number, folga: number): NaPlaca {
  let d1 = Infinity
  let d2 = Infinity
  let a: readonly [number, number] = [0, 0]
  let b: readonly [number, number] = [0, 0]
  let tom = 0
  vizinhos(u, v, n, semente, folga, ({ dx, dy, ix, iy }) => {
    const d = dx * dx + dy * dy
    if (d < d1) {
      d2 = d1
      b = a
      d1 = d
      a = [dx, dy]
      tom = hash(ix, iy, semente + 3)
    } else if (d < d2) {
      d2 = d
      b = [dx, dy]
    }
  })
  const entre = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1
  return { beira: (d2 - d1) / (2 * entre), dx: a[0], dy: a[1], tom }
}

/** A cor do basalto com brasa no ponto (u, v) do ladrilho. */
export function texturaBasaltoComBrasa(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const p = placa(uu, vv, PLACAS.celulas, PLACAS.semente, PLACAS.folga)
  // A placa: o tom dela, a estufa (o lado de cima à esquerda acende), o grão e os furinhos.
  let c = misturar(BASALTO, BASALTO_CLARO, p.tom * 0.5)
  const voltado = -(p.dx + p.dy) / Math.SQRT2
  c = luz(c, voltado > 0 ? voltado * ESTUFA.claro * 2 : voltado * ESTUFA.escuro * 2)
  c = luz(c, fbm(uu, vv, 16, 3, 6131) * 0.06 + (valor(uu * 512, vv * 512, 512, 6132) - 0.5) * 0.1)
  c = misturar(c, FURO, passoSuave(0.9, 0.97, valor(uu * 420, vv * 420, 420, 6133)) * 0.8)
  // As rachas finas da crosta, fechadas.
  const r = placa(uu, vv, RACHAS.celulas, RACHAS.semente, 0.45)
  c = misturar(c, FENDA_FRIA, passoSuave(RACHAS.meia, 0, r.beira) * RACHAS.forca)
  // A fenda entre as placas: mais larga e acesa nas zonas quentes, fina e escura no resto.
  const calor = passoSuave(ZONA.de, ZONA.ate, valor(uu * ZONA.celulas, vv * ZONA.celulas, ZONA.celulas, ZONA.semente))
  const meia = FENDA.meia * (1 + FENDA.varia * fbm(uu, vv, 8, 2, 6134)) * (0.7 + 0.6 * calor)
  c = misturar(c, BEIRA_QUENTE, passoSuave(meia + ESTUFA.beira, meia, p.beira) * calor * ESTUFA.forcaDaBeira)
  if (p.beira < meia) {
    const t = p.beira / meia
    const acesa = t < 0.35 ? misturar(BRASA_CLARA, BRASA, t / 0.35) : misturar(BRASA, BRASA_FUNDA, (t - 0.35) / 0.65)
    c = misturar(FENDA_FRIA, acesa, calor)
  }
  return empacotar(c)
}

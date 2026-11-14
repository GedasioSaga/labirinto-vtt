import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * ROCHA DE CAVERNA (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Pisos de pedra):
 * a masmorra natural, a caverna. Rocha sem junta nenhuma, cinza-pardo escuro: o chão é um relevo em degraus
 * baixos (a rocha que se partiu em camadas), com placas lisas entre eles, cada camada num tom um nada diferente;
 * o degrau virado para a luz (de cima à esquerda) acende, o de costas cai na sombra. Por cima, as fendas: finas,
 * tortas, que se ramificam devagar e somem no meio do caminho.
 */

/** Ladrilho de 8 casas: as contas de inclinação são em casas. */
const CASAS = 8
/** O relevo: escala da primeira oitava (células por ladrilho) e quantas oitavas. */
const RELEVO = { escala: 3, oitavas: 4, ganho: 0.5 } as const
/**
 * Camadas por unidade do relevo (quantos degraus o chão tem de alto a baixo): poucas, para a placa ser larga; com
 * mais, o chão vira um mapa de curvas de nível.
 */
const NIVEIS = 2
/** A fração de cada camada que é degrau (o resto é a placa lisa). */
const DEGRAU = 0.2
/** O pé do degrau, na placa de baixo: em fração da camada, até onde a sombra dele chega, e quanto escurece. */
const PE_DO_DEGRAU = { largura: 0.12, forca: 0.09 } as const
/** A altura de cada camada, em casas (um degrau baixo, de um palmo). */
const ALTURA_DA_CAMADA = 0.075
/** O quanto a placa não é plana de todo (o relevo de baixo aparece um pouco nela). */
const ONDULADO = 0.18
/** O passo da diferença finita, em fração do ladrilho. */
const PASSO = 1 / 2048
const LUZ_DO_RELEVO = 0.36
/** As fendas: células por lado do ladrilho, a folga do ponto de cada uma e o quanto a rede é torcida (em células). */
const FENDAS = { celulas: 7, folga: 0.42, torcao: 0.3 } as const
/** Meia largura do miolo e do halo da fenda, em casas, e quanto cada um puxa para a cor dela. */
const FENDA = { miolo: 0.011, halo: 0.04, forcaMiolo: 0.6, forcaHalo: 0.15 } as const

/** Cinza-pardo escuro: a rocha comum, a mais fria e funda, e a parda de ferro, que aparece em manchas largas. */
const ROCHA: Rgb = rgb('#58534c')
const ROCHA_FRIA: Rgb = rgb('#4e4b47')
const ROCHA_PARDA: Rgb = rgb('#5d554b')
/** O fundo da fenda. */
const COR_DA_FENDA: Rgb = rgb('#2d2a26')

/** Os pontos da rede de fendas, sorteados uma vez (em células, já com a célula). */
let pontos: { x: Float64Array; y: Float64Array } | null = null

function pontosDasFendas(): { x: Float64Array; y: Float64Array } {
  if (pontos !== null) return pontos
  const n = FENDAS.celulas
  const x = new Float64Array(n * n)
  const y = new Float64Array(n * n)
  for (let iy = 0; iy < n; iy += 1) {
    for (let ix = 0; ix < n; ix += 1) {
      x[iy * n + ix] = ix + 0.5 + (hash(ix, iy, 2101) - 0.5) * 2 * FENDAS.folga
      y[iy * n + ix] = iy + 0.5 + (hash(ix, iy, 2102) - 0.5) * 2 * FENDAS.folga
    }
  }
  pontos = { x, y }
  return pontos
}

/** O relevo bruto em (u, v): em torno de [-1, 1]. */
function relevo(u: number, v: number): number {
  return fbm(u, v, RELEVO.escala, RELEVO.oitavas, 2103, RELEVO.ganho)
}

/** A altura em camadas: os degraus, as placas e o ondulado delas. */
function emCamadas(h: number): number {
  const q = h * NIVEIS
  const nivel = Math.floor(q)
  return nivel + passoSuave(1 - DEGRAU, 1, q - nivel) + h * ONDULADO
}

/**
 * A distância (em casas) do ponto à fenda mais perto: a borda entre as duas células de Voronoi mais perto dele,
 * numa grade que dá a volta.
 */
function distanciaDaFenda(u: number, v: number): number {
  const { x: gx, y: gy } = pontosDasFendas()
  const n = FENDAS.celulas
  const x = u * n + fbm(u, v, 6, 2, 2104) * FENDAS.torcao
  const y = v * n + fbm(u, v, 6, 2, 2105) * FENDAS.torcao
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  // As duas mais perto: (ax, ay) a primeira e a distância² dela; depois a borda com cada outra.
  let melhor = Infinity
  let ax = 0
  let ay = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const ix = (((cx + ox) % n) + n) % n
      const iy = (((cy + oy) % n) + n) % n
      const dx = x - (gx[iy * n + ix] + (cx + ox - ix))
      const dy = y - (gy[iy * n + ix] + (cy + oy - iy))
      const d2 = dx * dx + dy * dy
      if (d2 < melhor) {
        melhor = d2
        ax = dx
        ay = dy
      }
    }
  }
  let borda = Infinity
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const ix = (((cx + ox) % n) + n) % n
      const iy = (((cy + oy) % n) + n) % n
      const dx = x - (gx[iy * n + ix] + (cx + ox - ix))
      const dy = y - (gy[iy * n + ix] + (cy + oy - iy))
      const qx = ax - dx
      const qy = ay - dy
      const entre = Math.sqrt(qx * qx + qy * qy)
      if (entre < 1e-9) continue
      const s = (dx * dx + dy * dy - melhor) / (2 * entre)
      if (s < borda) borda = s
    }
  }
  return (borda * CASAS) / n
}

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A cor da rocha de caverna no ponto (u, v) do ladrilho. */
export function texturaRochaDeCaverna(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const h = relevo(uu, vv)
  const altura = emCamadas(h)
  // A inclinação em casas: a diferença de altura dividida pelo passo (em casas).
  const passoEmCasas = PASSO * CASAS
  const dhx = ((emCamadas(relevo(uu + PASSO, vv)) - altura) / passoEmCasas) * ALTURA_DA_CAMADA
  const dhy = ((emCamadas(relevo(uu, vv + PASSO)) - altura) / passoEmCasas) * ALTURA_DA_CAMADA

  // A cor: a rocha, a fria e a parda em manchas largas; cada camada num tom um nada diferente.
  const q = h * NIVEIS
  const camada = Math.floor(q)
  // Um ruído só para as duas manchas: a fria onde ele desce, a parda onde ele sobe.
  const mancha = fbm(uu, vv, 5, 2, 2106)
  let c = misturar(ROCHA, ROCHA_FRIA, passoSuave(-0.1, -0.6, mancha))
  c = misturar(c, ROCHA_PARDA, passoSuave(0.15, 0.65, mancha) * 0.8)
  // O pé do degrau: a sombra que junta na placa de baixo, rente a ele, e sobe até o meio da face.
  const f = q - camada
  const pe = passoSuave(1 - DEGRAU - PE_DO_DEGRAU.largura, 1 - DEGRAU, f) * passoSuave(1, 1 - DEGRAU * 0.5, f)
  c = luz(c, -pe * PE_DO_DEGRAU.forca)
  c = luz(c, (hash(camada, 0, 2108) - 0.5) * 0.08 + fbm(uu, vv, 24, 2, 2109) * 0.03 + (valor(uu * 256, vv * 256, 256, 2110) - 0.5) * 0.03)
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)

  // As fendas: a rede inteira só aparece onde a máscara deixa, então cada fenda afina e some no caminho.
  const mascara = passoSuave(-0.05, 0.4, fbm(uu, vv, 4, 3, 2111))
  if (mascara > 0) {
    const d = distanciaDaFenda(uu, vv)
    const fenda = passoSuave(FENDA.miolo * mascara, 0, d) * FENDA.forcaMiolo + passoSuave(FENDA.halo * mascara, 0, d) * FENDA.forcaHalo
    c = misturar(c, COR_DA_FENDA, fenda)
  }
  return empacotar(c)
}

import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * PEDRA COM MUSGO (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Pisos de pedra):
 * a ruína e o jardim antigo. Lajes chatas e ANGULOSAS de tamanhos diferentes (o contrário do Calçamento, de pedra
 * arredondada), cinza frio, assentadas na terra; o musgo verde-oliva apagado cresce nas juntas e sobe pelas bordas
 * das lajes, mais numas regiões do chão que noutras (o canto úmido).
 *
 * Cada laje é a célula de um diagrama de potência (Voronoi com peso) sobre uma grade sorteada: borda reta e canto
 * vivo, e a laje de peso maior fica maior. A borda serpenteia um nada (pedra lascada), sem arredondar o canto.
 */

/** Células da grade das lajes por lado do ladrilho (8 casas): uma laje mede perto de 0,8 casa, umas mais, outras menos. */
const CELULAS = 10
const CASAS_POR_CELULA = 8 / CELULAS
/** O quanto o ponto de cada laje foge do meio da célula (0 a 0,5). */
const FOLGA = 0.42
/** O peso de cada laje (raio, em células): o raio maior ganha laje maior. */
const PESO = [0, 0.62] as const
/**
 * A busca da dona: 4 x 4 células, do lado da metade da célula em que o ponto cai. Com a folga e o peso acima, um
 * ponto a duas células do lado de lá nunca ganha (a potência dele passa de 2,1; a do ponto da própria célula não passa de 1,7).
 */
const LADO_DA_BUSCA = 4
/** O quanto a borda serpenteia, em casas, e a escala do ruído que a torce. */
const TORCAO = 0.022
const TORCAO_ESCALA = 20
/** Meia junta de terra entre as lajes, em casas (varia ao longo da borda). */
const MEIA_JUNTA = [0.016, 0.04] as const
/** A passagem macia da laje para a junta, em casas. */
const PASSAGEM = 0.012
/** O chanfro da laje: largura em casas e a inclinação dele. */
const CHANFRO = { largura: 0.05, inclinacao: 0.45 } as const
/** Cada laje assentada um nada torta. */
const TORTO = 0.07
/** Quanto a luz do relevo pesa na cor. */
const LUZ_DO_RELEVO = 0.25
/** Até onde o musgo sobe pela laje a partir da junta, em casas, onde o chão é mais úmido. */
const MUSGO_SOBE = 0.15

/** Cinza frio da laje: o azul passa o vermelho por poucos níveis. */
const TONS: readonly Rgb[] = [rgb('#7c7f82'), rgb('#777a7e'), rgb('#828487'), rgb('#74777a'), rgb('#7f8183'), rgb('#797b7d')]
/** A terra escura da junta. */
const TERRA = rgb('#59534a')
/** O musgo: verde-oliva apagado (o teto da croma é 0,18) e o mais fundo, na sombra dele. */
const MUSGO = rgb('#69734b')
const MUSGO_FUNDO = rgb('#535c3b')

/** A grade das lajes, sorteada uma vez: o ponto (em células, já com a célula) e o peso (raio²) de cada uma. */
let lajes: { x: Float64Array; y: Float64Array; peso: Float64Array } | null = null

function grade(): { x: Float64Array; y: Float64Array; peso: Float64Array } {
  if (lajes !== null) return lajes
  const n = CELULAS * CELULAS
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const peso = new Float64Array(n)
  for (let iy = 0; iy < CELULAS; iy += 1) {
    for (let ix = 0; ix < CELULAS; ix += 1) {
      const i = iy * CELULAS + ix
      x[i] = ix + 0.5 + (hash(ix, iy, 1901) - 0.5) * 2 * FOLGA
      y[i] = iy + 0.5 + (hash(ix, iy, 1902) - 0.5) * 2 * FOLGA
      const r = PESO[0] + (PESO[1] - PESO[0]) * hash(ix, iy, 1903)
      peso[i] = r * r
    }
  }
  lajes = { x, y, peso }
  return lajes
}

/** Rascunho por ponto (o ladrilho pinta um ponto por vez): as lajes em volta, sem alocar a cada pixel. */
const CANDIDATAS = LADO_DA_BUSCA * LADO_DA_BUSCA
const candidataDx = new Float64Array(CANDIDATAS)
const candidataDy = new Float64Array(CANDIDATAS)
const candidataPotencia = new Float64Array(CANDIDATAS)
const candidataIndice = new Int32Array(CANDIDATAS)

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/**
 * A cor da pedra com musgo no ponto (u, v) do ladrilho.
 * A grade das lajes dá a volta: a laje do lado de lá da emenda aparece inteira do lado de cá.
 */
export function texturaPedraMusgo(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const { x: gx, y: gy, peso } = grade()
  const x = uu * CELULAS + (fbm(uu, vv, TORCAO_ESCALA, 2, 1904) * TORCAO) / CASAS_POR_CELULA
  const y = vv * CELULAS + (fbm(uu, vv, TORCAO_ESCALA, 2, 1905) * TORCAO) / CASAS_POR_CELULA
  // A primeira célula da busca: duas para trás se o ponto está na metade de cá da célula, uma se na de lá.
  const x0 = Math.floor(x - 0.5) - 1
  const y0 = Math.floor(y - 0.5) - 1
  // A dona do ponto: a laje de menor potência (distância² − peso) entre as de perto.
  let n = 0
  let dona = 0
  for (let oy = 0; oy < LADO_DA_BUSCA; oy += 1) {
    const gy0 = y0 + oy
    const iy = ((gy0 % CELULAS) + CELULAS) % CELULAS
    for (let ox = 0; ox < LADO_DA_BUSCA; ox += 1) {
      const gx0 = x0 + ox
      const ix = ((gx0 % CELULAS) + CELULAS) % CELULAS
      const i = iy * CELULAS + ix
      // O ponto da laje na cópia da grade que está ao lado deste (a volta do ladrilho).
      const dx = x - (gx[i] + (gx0 - ix))
      const dy = y - (gy[i] + (gy0 - iy))
      candidataDx[n] = dx
      candidataDy[n] = dy
      candidataPotencia[n] = dx * dx + dy * dy - peso[i]
      candidataIndice[n] = i
      if (candidataPotencia[n] < candidataPotencia[dona]) dona = n
      n += 1
    }
  }
  // A borda mais perto (reta: distância exata no diagrama de potência) e o rumo para dentro da laje.
  const pdx = candidataDx[dona]
  const pdy = candidataDy[dona]
  let borda = Infinity
  let dentroX = 0
  let dentroY = 0
  for (let j = 0; j < n; j += 1) {
    if (j === dona) continue
    const qx = pdx - candidataDx[j]
    const qy = pdy - candidataDy[j]
    const distancia = Math.sqrt(qx * qx + qy * qy)
    if (distancia === 0) continue
    const s = (candidataPotencia[j] - candidataPotencia[dona]) / (2 * distancia)
    if (s < borda) {
      borda = s
      // De lá (a vizinha) para cá (a dona): o rumo para dentro da laje, no espaço do ladrilho.
      dentroX = -qx / distancia
      dentroY = -qy / distancia
    }
  }
  borda *= CASAS_POR_CELULA
  const laje = candidataIndice[dona]

  // A laje: o tom dela, as manchas largas e o grão, o chanfro de cima à esquerda e o assentamento torto.
  let pedra = TONS[Math.floor(hash(laje, 0, 1906) * TONS.length) % TONS.length]
  pedra = luz(pedra, (hash(laje, 1, 1906) - 0.5) * 0.08 + fbm(uu, vv, 24, 2, 1907) * 0.04 + (valor(uu * 288, vv * 288, 288, 1908) - 0.5) * 0.04)
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * valor(uu * 40, vv * 40, 40, 1909)
  const naLaje = borda - meiaJunta
  const chanfro = CHANFRO.inclinacao * (1 - passoSuave(0, CHANFRO.largura, naLaje))
  const dhx = dentroX * chanfro + (hash(laje, 2, 1906) - 0.5) * 2 * TORTO
  const dhy = dentroY * chanfro + (hash(laje, 3, 1906) - 0.5) * 2 * TORTO
  pedra = luz(pedra, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)

  // O musgo: mais nas regiões úmidas, cheio na junta e subindo pela borda em franja.
  // Longe da junta, ou no chão seco, não há musgo nem terra: a laje sai como está (a maior parte dos pontos).
  if (naLaje >= MUSGO_SOBE && naLaje >= PASSAGEM) return empacotar(pedra)
  const umido = passoSuave(-0.25, 0.45, fbm(uu, vv, 5, 3, 1910))
  const naJunta = passoSuave(PASSAGEM, -PASSAGEM, naLaje)
  if (umido <= 0) return empacotar(misturar(pedra, TERRA, naJunta))
  const franja = valor(uu * 96, vv * 96, 96, 1911)
  const tufo = valor(uu * 160, vv * 160, 160, 1912)
  const corDoMusgo = misturar(MUSGO_FUNDO, MUSGO, passoSuave(0.25, 0.75, tufo))
  const musgoNaLaje = umido * passoSuave(MUSGO_SOBE * umido * (0.35 + 0.65 * franja), 0, naLaje)
  pedra = misturar(pedra, corDoMusgo, musgoNaLaje * 0.9)
  // A junta: terra, coberta de musgo onde o chão é úmido.
  const junta = misturar(TERRA, luz(corDoMusgo, -0.08), passoSuave(0.15, 0.6, umido * (0.4 + 0.8 * franja)))
  return empacotar(misturar(pedra, junta, naJunta))
}

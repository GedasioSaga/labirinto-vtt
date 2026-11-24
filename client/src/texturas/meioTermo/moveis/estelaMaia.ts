/**
 * ESTELA ENTALHADA (lote L07 "Selva: ruína e água", 24/11/2026; objeto novo, id `estelaMaia`). A laje de pé, baixa e
 * chata, que marca a ruína na mata: o pé de pedra rente ao chão e a laje de ombros redondos, com a INSCRIÇÃO nas duas
 * faces largas (a moldura rebaixada e três colunas de quatro glifos em cartucho). Os glifos são desenhos próprios, só
 * geometria (olho, barra e pontos, voluta, degraus, cruz com pontos): lembram a escrita das ruínas sem copiar nenhuma.
 * O musgo sobe do pé e pega o alto da laje.
 *
 * As duas vistas saem da PILHA DE FATIAS: de cima, a laje é um risco grosso com o alto áspero e o pé em volta; na 3/4,
 * cada fatia mostra a faixa da face virada para quem olha, e a textura dela desenha a inscrição naquela altura (de
 * costas, a outra face, com outros glifos). Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`.
 *
 * Exporta `luzDoGlifo`, o cartucho com o glifo, que a coluna com glifos também usa.
 */
import { hash } from '../../ruido'
import { poligono, type Ponto } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'
import { blocoEmFatias, GRAO_POR_ALTURA, manchaDeMusgo, musgar, PASSO_DAS_FATIAS } from './muroEmRuina'

// ---------- o glifo ----------

/** O cartucho de cantos redondos (meios lados a, b e raio r): a distância com sinal. */
function distanciaDoCartucho(u: number, v: number, a: number, b: number, r: number): number {
  const qx = Math.abs(u) - a + r
  const qy = Math.abs(v) - b + r
  const ox = qx > 0 ? qx : 0
  const oy = qy > 0 ? qy : 0
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

/** A meia largura do sulco do cartucho e do traço do glifo, na casa do glifo (-0,5 a 0,5). */
const SULCO = 0.05
const TRACO = 0.045
/** O quanto o sulco escurece e o quanto o miolo do cartucho sobe. */
const FUNDO = -0.26
const RELEVO = 0.04

/**
 * A luz do GLIFO no ponto (u, v) da casa dele (os dois de -0,5 a 0,5; v para cima): fora do cartucho a pedra lisa (0),
 * o sulco do cartucho escuro e, dentro, o miolo em relevo com o traço do glifo `id` escavado. Cinco desenhos, todos
 * só geometria; o `id` também escolhe quantos pontos o numeral tem.
 */
export function luzDoGlifo(u: number, v: number, id: number): number {
  const d = distanciaDoCartucho(u, v, 0.42, 0.42, 0.15)
  if (d > SULCO) return 0
  if (d > -SULCO) return FUNDO
  const tipo = id % 5
  if (tipo === 0) {
    // O olho: o anel e a pupila.
    const r = Math.hypot(u, v)
    return Math.abs(r - 0.19) < TRACO || r < 0.065 ? FUNDO : RELEVO
  }
  if (tipo === 1) {
    // A barra e os pontos (de um a três, como um numeral).
    if (Math.abs(v + 0.14) < 0.055 && Math.abs(u) < 0.27) return FUNDO
    const pontos = 1 + (Math.floor(id / 5) % 3)
    for (let k = 0; k < pontos; k += 1) if (Math.hypot(u - (k - (pontos - 1) / 2) * 0.17, v - 0.13) < 0.06) return FUNDO
    return RELEVO
  }
  if (tipo === 2) {
    // A voluta: o arco aberto embaixo à esquerda e o ponto dentro dele.
    const r = Math.hypot(u + 0.03, v + 0.02)
    const a = Math.atan2(v + 0.02, u + 0.03)
    if (Math.abs(r - 0.2) < TRACO && a > -2.2) return FUNDO
    return Math.hypot(u - 0.06, v - 0.05) < 0.06 ? FUNDO : RELEVO
  }
  if (tipo === 3) {
    // Os degraus: quatro pisos subindo para a direita, com os espelhos.
    if (Math.abs(u) >= 0.3) return RELEVO
    const i = Math.min(3, Math.floor((u + 0.3) / 0.15))
    const nivel = -0.2 + i * 0.12
    if (Math.abs(v - nivel) < TRACO) return FUNDO
    const fr = (u + 0.3) / 0.15 - i
    return i > 0 && fr < 0.3 && v > nivel - 0.12 - TRACO && v < nivel + TRACO ? FUNDO : RELEVO
  }
  // A cruz com um ponto em cada quarto.
  if ((Math.abs(u) < TRACO && Math.abs(v) < 0.24) || (Math.abs(v) < TRACO && Math.abs(u) < 0.24)) return FUNDO
  return Math.hypot(Math.abs(u) - 0.15, Math.abs(v) - 0.15) < 0.055 ? FUNDO : RELEVO
}

// ---------- a estela ----------

/** A laje: meia largura (fração do meio lado maior), meia grossura (fração do menor) e alto (casas). */
const MEIA_LARGURA = 0.68
const MEIA_GROSSURA = 0.36
const ALTURA = 0.9
/** O raio dos ombros (fração da meia largura). */
const OMBRO = 0.45
/** O pé: meios lados (frações dos meios lados da pegada) e alto (casas). */
const PE = { a: 0.94, b: 0.82, alto: 0.06 } as const
/** A inscrição: a margem da moldura (px), colunas e linhas de glifos. */
const MOLDURA = 2.6
const COLUNAS = 3
const LINHAS = 4

export const montarEstelaMaia: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  // A laje corre ao longo do lado maior da pegada.
  const deitada = hw >= hh
  const W = Math.max(hw, hh) * MEIA_LARGURA
  const T = Math.min(hw, hh) * MEIA_GROSSURA
  const zPe = g * PE.alto
  const zAlto = g * ALTURA
  const rOmbro = W * OMBRO
  /** Do referencial da laje (`a` ao comprido, `b` de través) para o objeto, e de volta. */
  const ponto = (a: number, b: number): Ponto => (deitada ? [a, b] : [-b, a])
  const naLaje = (x: number, y: number): readonly [number, number] => (deitada ? [x, y] : [y, -x])

  // O PÉ: a laje rente ao chão, com musgo.
  const pa = (deitada ? hw : hh) * PE.a
  const pb = (deitada ? hh : hw) * PE.b
  const pe = [ponto(-pa, -pb), ponto(pa, -pb), ponto(pa, pb), ponto(-pa, pb)]
  blocoEmFatias(f, 0, pe, 0, zPe, pedra, { semente: 7100, tom: 0.86, bisel: 0.9, musgo: (x, y) => manchaDeMusgo(x, y, 17, -0.04) })

  // A INSCRIÇÃO: a moldura rebaixada e a grade de glifos, nas duas faces largas.
  const zBaixo = zPe + 3
  const zCima = zAlto - rOmbro * 0.55
  const larguraDaCasa = (2 * (W - MOLDURA)) / COLUNAS
  const alturaDaCasa = (zCima - zBaixo) / LINHAS
  const inscricao = (a: number, z: number, costas: boolean): number => {
    // A beira da moldura: o sulco em volta do painel.
    const dentroA = W - MOLDURA - Math.abs(a)
    const dentroZ = Math.min(z - zBaixo, zCima - z)
    if (dentroA < -0.2 || dentroZ < -0.2) return 0
    if (dentroA < 0.7 || dentroZ < 0.7) return -0.22
    const ca = (a + W - MOLDURA) / larguraDaCasa
    const cz = (z - zBaixo) / alturaDaCasa
    const coluna = Math.min(COLUNAS - 1, Math.floor(ca))
    const linha = Math.min(LINHAS - 1, Math.floor(cz))
    const id = Math.floor(hash(coluna, linha + (costas ? 11 : 0), 7150) * 25)
    return luzDoGlifo(ca - coluna - 0.5, cz - linha - 0.5, id) - 0.03
  }

  // A LAJE: o corpo reto e os ombros redondos no alto (a meia largura encolhe pelo arco).
  const musgoDaLaje = (x: number, y: number, z: number): number => {
    const pe2 = z < zPe + 5 ? (1 - (z - zPe) / 5) * manchaDeMusgo(x * 1.2, y + z * 1.4, 19, -0.08) : 0
    const alto = z > zAlto - 4 ? manchaDeMusgo(x + z * 0.4, y + z, 23, 0.02) : 0
    return Math.max(pe2, alto)
  }
  for (const z of alturas(zPe, zAlto, PASSO_DAS_FATIAS).slice(1)) {
    const noOmbro = z - (zAlto - rOmbro)
    const meia = noOmbro > 0 ? W - rOmbro + Math.sqrt(Math.max(0, rOmbro * rOmbro - noOmbro * noOmbro)) : W
    const corte = poligono([ponto(-meia, -T), ponto(meia, -T), ponto(meia, T), ponto(-meia, T)])
    if (z >= zAlto - 1e-6) {
      const doAlto: Textura = (u, v, x, y, p, s, escala) => {
        if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
        s[3] += 0.04
        musgar(s, musgoDaLaje(x, y, z), x, y)
      }
      f.fatia(0, z, corte, pedra, { tabua: 0, bisel: 1.1, tom: 1, contorno: 0.26, textura: doAlto, semente: 7120 })
      continue
    }
    const face: Textura = (u, v, x, y, p, s, escala) => {
      if (daPedra !== null) daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, p, s, escala)
      const [a, b] = naLaje(x, y)
      // A face: as largas (b = ±T) levam a inscrição; nos ombros e nas pontas, a luz do arco.
      const largas = T - Math.abs(b) < meia - Math.abs(a)
      let luz: number
      if (largas) {
        const nb = Math.sign(b)
        const [nx, ny] = deitada ? [0, nb] : [-nb, 0]
        luz = luzDaNormal(nx, ny, 0, q) + inscricao(b > 0 ? a : -a, z, b < 0)
      } else {
        const na = Math.sign(a)
        const [nx, ny] = deitada ? [na, 0] : [0, na]
        const subida = noOmbro > 0 ? noOmbro / rOmbro : 0
        luz = luzDaNormal(nx * (1 - subida), ny * (1 - subida), subida, q)
      }
      if (z - zPe < 1) luz -= 0.18
      s[3] += luz
      musgar(s, musgoDaLaje(x, y, z), x, y)
    }
    f.fatia(0, z, corte, pedra, lisa(0.95, face, 7121))
  }
  f.fechar()

  // A sombra comprida da laje, a do pé e o contato.
  const [ax, ay] = ponto(-W, -T)
  const [bx, by] = ponto(W, T)
  const [cx, cy] = ponto(-pa, -pb)
  const [dx, dy] = ponto(pa, pb)
  cena.sombras.push(
    sombraVarrida(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), zAlto - rOmbro * 0.3, q, 0.26, 1.6),
    sombraVarrida(Math.min(cx, dx), Math.min(cy, dy), Math.max(cx, dx), Math.max(cy, dy), zPe, q, 0.2, 1.1),
    contato(poligono(pe), 0.3),
  )
}

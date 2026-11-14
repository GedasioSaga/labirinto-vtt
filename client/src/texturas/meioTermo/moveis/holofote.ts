/**
 * HOLOFOTE de base militar, de cima com volume (L06 dos objetos novos,
 * 14/11/2026, grupo Base militar). O TAMBOR grande de chapa pintada de oliva,
 * apontado para a frente (o sul da pegada) e inclinado para o céu: do alto, a
 * LENTE redonda vira uma elipse na ponta da frente, com o aro de aço
 * aparafusado, a cruz de varetas que segura o miolo e os anéis de Fresnel; o
 * corpo do tambor aparece atrás dela, com as duas cintas de reforço, o
 * RESPIRO do lampião no lombo e a ALÇA de mirar em U na traseira. Dos
 * lados, o GARFO (os dois braços de aço com o munhão redondo onde o tambor
 * gira); embaixo, as quatro PERNAS em X com a sapata de nivelar e o CABO de
 * força que sai pelo chão (o gerador mora do outro lado dele).
 *
 * ACESO (variante 0) e APAGADO (variante 1), como a tocha: aceso, a lente é
 * branca e quente, toda emissão, com um brilho em volta; apagado, vidro
 * escuro com o reflexo do céu. A luz que alcança o mapa é a da tabela
 * `LUZ_DOS_OBJETOS` (o integrador põe a linha); aqui é só o desenho.
 *
 * NA 3/4: o tambor é um tampo solto no ar (a beirada dele é o costado do
 * cilindro, `ESPESSURA_DO_TAMBOR_DO_HOLOFOTE`), o pedestal é uma coluna no meio
 * e cada braço do garfo, uma coluna do lado. As peças do alto têm o meio
 * dentro do tambor (a alça usa `comMeioEm`); as pernas e o cabo ficam no
 * chão.
 *
 * Sem material no painel: a tinta, o aço, o vidro e a borracha são fixos. As
 * medidas saem do menor meio lado da pegada (1 x 1 casa de partida): esticado,
 * o tambor continua redondo.
 */
import type { Rgb } from '../../ruido'
import { anel, barra, cadeia, caixa, capsula, dentroDe, elipse, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

// ---------- as medidas, em frações do menor meio lado ----------

/** O raio do tambor e o quanto a boca dele achata vista do alto (o seno da elevação, ~50 graus). */
const RAIO_DO_TAMBOR = 0.68
const ACHATAMENTO = 0.77
/** O meio da lente (para a frente) e o meio do fundo do tambor (para trás). */
const MEIO_DA_LENTE = 0.4
const MEIO_DO_FUNDO = -0.18
/** As duas cintas de reforço do corpo, em fração do caminho do fundo até a lente. */
const CINTAS: readonly number[] = [0.3, 0.72]
/** O aro da lente (fração do raio do tambor onde o vidro começa) e os parafusos dele. */
const VIDRO_DO_ARO = 0.84
const PARAFUSOS_DO_ARO = 10
/** O miolo (a capa do lampião vista pelo vidro) e as quatro varetas que o seguram. */
const RAIO_DO_MIOLO = 0.17
const VARETAS: readonly number[] = [45, 135, 225, 315]
/** Quantos anéis de Fresnel o vidro tem do miolo à beira. */
const ANEIS_DA_LENTE = 5
/** O respiro do lampião no lombo, perto do fundo: onde fica e o raio. */
const RESPIRO: Ponto = [0, -0.5]
const RAIO_DO_RESPIRO = 0.155
/** A alça de mirar em U atrás do tambor (de um lado ao outro) e o punho de borracha no meio dela. */
const ALCA: readonly Ponto[] = [[-0.3, -0.56], [-0.34, -0.88], [0.34, -0.88], [0.3, -0.56]]
const PUNHO = 0.24
/** O garfo: a que distância do meio fica cada braço, a meia largura e o meio comprimento dele, e o munhão. */
const BRACO_X = 0.8
const MEIA_LARGURA_DO_BRACO = 0.06
const MEIO_COMPRIMENTO_DO_BRACO = 0.2
const MEIO_DO_BRACO_Y = 0.08
const RAIO_DO_MUNHAO = 0.11
/** As pernas em X: a ponta de cada uma, a grossura e a sapata de nivelar (chata, quadrada). */
const PONTA_DA_PERNA = 0.84
const GROSSURA_DA_PERNA = 0.1
const MEIA_SAPATA = 0.13
/** O pedestal debaixo do tambor (o prato giratório). */
const RAIO_DO_PEDESTAL = 0.32
/** O cabo de força no chão, de debaixo do tambor até a quina da pegada. */
const CAMINHO_DO_CABO: readonly Ponto[] = [
  [0.55, 0.42],
  [0.78, 0.5],
  [0.86, 0.66],
  [0.8, 0.8],
  [0.92, 0.97],
]
const RAIO_DO_CABO = 0.035

/** Alturas em casas: o meio do tambor, o munhão do garfo; a beirada do tambor (o costado na 3/4). */
const ALTURA_DO_TAMBOR = 0.85
const ALTURA_DO_MUNHAO = 0.68
export const ESPESSURA_DO_TAMBOR_DO_HOLOFOTE = 0.3 * G

// ---------- os materiais (fixos) ----------

/** A chapa pintada de verde-oliva, fosca. */
const TINTA: MaterialDaPeca = { classe: 'metal', rgb: [0x5f, 0x63, 0x48] }
/** O aço do garfo, do aro e das pernas, e o ferro escuro dos parafusos. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x5e, 0x60] }
const PARAFUSO: MaterialDaPeca = { classe: 'metal', rgb: [0x46, 0x48, 0x4a] }
/** A borracha do cabo e dos punhos. */
const BORRACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x33, 0x31] }
/** O vidro da lente: a cor sai da textura. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x58, 0x60] }
/** Aceso: o branco quente do miolo e o creme da beira do vidro; o brilho em volta. */
const MIOLO_ACESO: Rgb = [0xff, 0xfa, 0xea]
const BEIRA_ACESA: Rgb = [0xf2, 0xdc, 0xad]
const COR_DO_BRILHO: Rgb = [0xff, 0xef, 0xcc]
const ALFA_DO_BRILHO = 0.45
/** Até onde o brilho vai, em vezes o raio do aro. */
const BRILHO_ALEM_DO_ARO = 1.18
/** Apagado: o reflexo do céu no vidro (o quanto clareia na faixa). */
const REFLEXO_DO_VIDRO = 64
/** O escuro em que o pixel escuro demais é levantado: cinza quente do aço (o padrão, a nogueira, amarronzava a sombra). */
const ESCURO_DO_ACO: Rgb = [0x48, 0x46, 0x42]

// ---------- a luz do cilindro (a do motor: de cima à esquerda) ----------

const LUZ_X = -0.62
const LUZ_Z = 0.62
const FORCA_DO_CILINDRO = 0.7

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** O lombo do tambor: claro do lado da luz, escuro do outro, com a textura do metal por baixo. */
function texDoTambor(raio: number): Textura {
  const doMetal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    const q = limitar(x / raio, -0.98, 0.98)
    s[3] += FORCA_DO_CILINDRO * (LUZ_X * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (doMetal !== null) doMetal(u, v, x, y, p, s, escala)
  }
}

/** O vidro: anéis de Fresnel do miolo à beira; aceso, branco quente e toda emissão; apagado, escuro com o reflexo. */
function texDaLente(cx: number, cy: number, rx: number, ry: number, aceso: boolean): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const r = Math.min(1, Math.hypot(dx, dy))
    const anelDeFresnel = Math.cos(r * ANEIS_DA_LENTE * Math.PI * 2)
    if (aceso) {
      const t = Math.pow(r, 1.6)
      const brilho = 1 + 0.04 * anelDeFresnel
      s[0] = (MIOLO_ACESO[0] + (BEIRA_ACESA[0] - MIOLO_ACESO[0]) * t) * brilho
      s[1] = (MIOLO_ACESO[1] + (BEIRA_ACESA[1] - MIOLO_ACESO[1]) * t) * brilho
      s[2] = (MIOLO_ACESO[2] + (BEIRA_ACESA[2] - MIOLO_ACESO[2]) * t) * brilho
      s[4] = 1
      return
    }
    s[3] += 0.07 * anelDeFresnel - 0.12 * r
    // O reflexo do céu: uma faixa clara de viés, do lado da luz.
    const faixa = (dx * 0.8 + dy * 0.6 + 0.38) / 0.16
    const reflexo = REFLEXO_DO_VIDRO * Math.exp(-faixa * faixa)
    s[0] += reflexo
    s[1] += reflexo
    s[2] += reflexo
  }
}

/** O brilho em volta da lente acesa: o tom claro com o alfa caindo do meio para fora. */
function texDoBrilho(cx: number, cy: number, rx: number, ry: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const q = Math.min(1, dx * dx + dy * dy)
    s[0] = COR_DO_BRILHO[0]
    s[1] = COR_DO_BRILHO[1]
    s[2] = COR_DO_BRILHO[2]
    s[4] = 1
    s[5] = ALFA_DO_BRILHO * (1 - q) * (1 - q)
  }
}

/** A mesma forma com a caixa centrada em (mx, my): o desenho não muda, mas na 3/4 a peça sobe com o que está ali. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** Só o que fica ao norte de `y` (a metade de cima de uma cinta, a que se vê no lombo inclinado). */
function aoNorteDe(f: Forma, y: number): Forma {
  return dentroDe(f, caixa(f.b[0] - 1, f.b[1] - 1, f.b[2] + 1, y))
}

export const montarHolofote: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const aceso = c.variante !== 1
  cena.corDoPiso = ESCURO_DO_ACO
  const rx = RAIO_DO_TAMBOR * R
  const ry = rx * ACHATAMENTO
  const yLente = MEIO_DA_LENTE * R
  const yFundo = MEIO_DO_FUNDO * R
  const tambor = uniao(uniao(elipse(0, yFundo, rx, ry), caixa(-rx, yFundo, rx, yLente)), elipse(0, yLente, rx, ry))
  const zTambor = ALTURA_DO_TAMBOR * G
  const zMunhao = ALTURA_DO_MUNHAO * G
  const zPedestal = zTambor - ESPESSURA_DO_TAMBOR_DO_HOLOFOTE
  const pedestal = elipse(0, 0, RAIO_DO_PEDESTAL * R, RAIO_DO_PEDESTAL * R)

  // ---------- as sombras: o tambor no ar, o pedestal e os dois braços do garfo ----------
  cena.sombras.push({ forma: tambor, z: zTambor, solta: true, forca: 0.3 })
  cena.sombras.push({ forma: pedestal, z: zPedestal, forca: 0.28 })

  // ---------- no chão: as pernas em X com a sapata e o cabo de força ----------
  for (const [i, [sx, sy]] of ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).entries()) {
    const ponta: Ponto = [sx * PONTA_DA_PERNA * R * 0.92, sy * PONTA_DA_PERNA * R * 0.86]
    const perna = barra(0, 0, ponta[0], ponta[1], GROSSURA_DA_PERNA * 2 * R)
    const ms = MEIA_SAPATA * R
    const sapata = caixa(ponta[0] - ms, ponta[1] - ms, ponta[0] + ms, ponta[1] + ms, ms * 0.3)
    cena.sombras.push(contato(uniao(perna, sapata), 0.3), { forma: perna, z: 0.07 * G, forca: 0.22 })
    // O meio da perna fica debaixo do tambor: a caixa vai para a sapata, senão a perna subia com ele na 3/4.
    L.push(P(comMeioEm(perna, ponta[0], ponta[1]), ACO, { tabua: 0, bisel: 1, tom: 0.86, contorno: 0.28, metal: 0.25, semente: 28001 + i }))
    L.push(P(sapata, ACO, { tabua: 0, bisel: 1, tom: 0.98, contorno: 0.28, metal: 0.25, semente: 28005 + i }))
    L.push(P(elipse(ponta[0], ponta[1], ms * 0.42, ms * 0.42), PARAFUSO, { bisel: ms * 0.3, tom: 1.1, contorno: 0.24, metal: 0.4, semente: 28009 + i, projeta: { dist: 0.6, forca: 0.26 } }))
  }
  const cabo = cadeia(CAMINHO_DO_CABO.map(([x, y]): Ponto => [x * c.hw, y * c.hh]), RAIO_DO_CABO * R)
  cena.sombras.push(contato(cabo, 0.26))
  L.push(P(cabo, BORRACHA, { tabua: 0, bisel: RAIO_DO_CABO * R, contorno: 0.24, semente: 28013, projeta: { dist: 0.6, forca: 0.24 } }))

  // ---------- o garfo: os dois braços (colunas na 3/4) com o munhão por cima ----------
  for (const lado of [-1, 1]) {
    const bx = lado * BRACO_X * R
    const by = MEIO_DO_BRACO_Y * R
    const braco = caixa(bx - MEIA_LARGURA_DO_BRACO * R, by - MEIO_COMPRIMENTO_DO_BRACO * R, bx + MEIA_LARGURA_DO_BRACO * R, by + MEIO_COMPRIMENTO_DO_BRACO * R, 0.8)
    cena.sombras.push({ forma: braco, z: zMunhao, forca: 0.24 })
    L.push(P(braco, ACO, { tabua: 0, bisel: 0.9, tom: 0.9, contorno: 0.28, metal: 0.3, semente: 28016 + lado }))
    L.push(P(elipse(bx, by, RAIO_DO_MUNHAO * R, RAIO_DO_MUNHAO * R), ACO, { tabua: 0, bisel: RAIO_DO_MUNHAO * R * 0.8, tom: 1.06, contorno: 0.28, metal: 0.45, semente: 28019 + lado, projeta: { dist: 0.8, forca: 0.28 } }))
    L.push(P(elipse(bx, by, RAIO_DO_MUNHAO * R * 0.4, RAIO_DO_MUNHAO * R * 0.4), PARAFUSO, { bisel: 0.6, tom: 1.15, contorno: 0.2, metal: 0.5, semente: 28022 + lado }))
  }

  // ---------- o tambor: o corpo pintado, as cintas, o respiro e a alça ----------
  L.push(P(tambor, TINTA, { tabua: 0, bisel: 1.4, contorno: 0.3, metal: 0.12, textura: texDoTambor(rx), semente: 28030, projeta: { dist: 2.2, forca: 0.34, suave: 1.2 } }))
  CINTAS.forEach((f, i) => {
    const y = yFundo + (yLente - yFundo) * f
    const cinta = aoNorteDe(anel(0, y, rx + 0.4, ry + 0.4, rx - 1.6, ry - 1.6), y)
    L.push(P(cinta, TINTA, { tabua: 0, bisel: 0.7, tom: 1.1, contorno: 0.22, metal: 0.18, textura: texDoTambor(rx), semente: 28031 + i, projeta: { dist: 0.6, forca: 0.26 } }))
  })
  const [rsx, rsy] = [RESPIRO[0] * R, RESPIRO[1] * R]
  const rR = RAIO_DO_RESPIRO * R
  L.push(P(elipse(rsx, rsy, rR, rR * 0.86), TINTA, { tabua: 0, bisel: rR * 0.5, tom: 0.92, contorno: 0.3, metal: 0.15, semente: 28034, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(anel(rsx, rsy, rR * 0.72, rR * 0.62, rR * 0.4, rR * 0.34), PARAFUSO, { tabua: 0, bisel: 0.5, tom: 0.8, contorno: 0.2, recesso: { k: 0.8, forca: 0.3 }, semente: 28035 }))
  L.push(P(elipse(rsx, rsy, rR * 0.4, rR * 0.34), TINTA, { tabua: 0, bisel: rR * 0.3, tom: 1.12, contorno: 0.2, metal: 0.2, semente: 28036 }))
  // A alça em U e o punho: as caixas vão para dentro do tambor, para subirem com ele na 3/4.
  const alca = cadeia(ALCA.map(([x, y]): Ponto => [x * R, y * R]), 0.045 * R)
  L.push(P(comMeioEm(alca, 0, yFundo), ACO, { tabua: 0, bisel: 0.045 * R, tom: 0.95, contorno: 0.28, metal: 0.35, semente: 28040, projeta: { dist: 1, forca: 0.3 } }))
  const yPunho = ALCA[1][1] * R
  L.push(P(comMeioEm(capsula(-PUNHO * R, yPunho, PUNHO * R, yPunho, 0.075 * R), 0, yFundo), BORRACHA, { tabua: 0, bisel: 0.075 * R, contorno: 0.26, semente: 28041, projeta: { dist: 1, forca: 0.3 } }))

  // ---------- a frente: o aro aparafusado, o vidro, as varetas e o miolo ----------
  L.push(P(anel(0, yLente, rx, ry, rx * VIDRO_DO_ARO, ry * VIDRO_DO_ARO), ACO, { tabua: 0, bisel: 1.1, tom: 1.02, contorno: 0.3, metal: 0.4, semente: 28050, projeta: { dist: 0.8, forca: 0.3 } }))
  for (let i = 0; i < PARAFUSOS_DO_ARO; i += 1) {
    const a = (i / PARAFUSOS_DO_ARO) * Math.PI * 2
    const meio = (1 + VIDRO_DO_ARO) / 2
    L.push(P(elipse(Math.cos(a) * rx * meio, yLente + Math.sin(a) * ry * meio, 0.03 * R, 0.03 * R), PARAFUSO, { bisel: 0.5, tom: 1.2, contorno: 0.15, metal: 0.5, semente: 28051 + i }))
  }
  const vrx = rx * VIDRO_DO_ARO
  const vry = ry * VIDRO_DO_ARO
  L.push(P(elipse(0, yLente, vrx, vry), VIDRO, { tabua: 0, bisel: aceso ? 0 : 1.2, contorno: aceso ? 0 : 0.2, recesso: aceso ? undefined : { k: 1.2, forca: 0.35 }, textura: texDaLente(0, yLente, vrx, vry, aceso), semente: 28062 }))
  for (const [i, graus] of VARETAS.entries()) {
    const a = (graus * Math.PI) / 180
    const vareta = barra(Math.cos(a) * vrx * 0.98, yLente + Math.sin(a) * vry * 0.98, 0, yLente, 0.035 * R)
    L.push(P(vareta, ACO, { tabua: 0, bisel: 0.4, tom: aceso ? 0.7 : 0.95, contorno: 0.2, metal: 0.3, semente: 28063 + i, projeta: aceso ? undefined : { dist: 0.6, forca: 0.24 } }))
  }
  const rMiolo = RAIO_DO_MIOLO * R
  L.push(P(elipse(0, yLente, rMiolo, rMiolo * ACHATAMENTO), ACO, { tabua: 0, bisel: rMiolo * 0.7, tom: aceso ? 0.8 : 0.98, contorno: 0.28, metal: 0.45, semente: 28068, projeta: aceso ? undefined : { dist: 0.8, forca: 0.3 } }))
  L.push(P(elipse(0, yLente, rMiolo * 0.4, rMiolo * 0.4 * ACHATAMENTO), PARAFUSO, { bisel: 0.6, tom: 1.15, contorno: 0.2, metal: 0.5, semente: 28069 }))
  // O brilho tem a caixa menor que a do tambor: a beirada da 3/4 pega o material da maior peça, e tem de ser a tinta.
  if (aceso) L.push(P(elipse(0, yLente, rx * BRILHO_ALEM_DO_ARO, ry * BRILHO_ALEM_DO_ARO), VIDRO, { bisel: 0, contorno: 0, textura: texDoBrilho(0, yLente, rx * BRILHO_ALEM_DO_ARO, ry * BRILHO_ALEM_DO_ARO), semente: 28070 }))
}

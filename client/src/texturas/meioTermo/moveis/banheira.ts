/**
 * BANHEIRA de cima com volume (lote 5 dos objetos novos, 11/11/2026): a
 * banheira de LOUÇA com pés de garra, cheia para o banho. De cima aparecem a
 * BORDA grossa e roliça em volta, a parede de dentro na sombra (mais larga na
 * ponta do encosto, à esquerda, que é inclinada), a ÁGUA (a sombra da borda do
 * lado da luz, a beira rasa mais clara, os reflexos e dois montes de espuma),
 * o TAMPÃO no fundo, visto por dentro da água, com a correntinha subindo até a
 * borda, a TORNEIRA na ponta direita (a bica e as duas cruzetas), um sabão na
 * borda do fundo e a TOALHA dobrada na borda da frente. Nos quatro cantos
 * saem as pontas dos pés. A frente é o lado de baixo.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura; cada peça
 * sobe com a mais alta que contém o meio da caixa dela):
 * - o BOJO é a coluna, recuado da borda: a frente dele é a louça;
 * - a BORDA é um tampo solto um nada mais alto, com a beirada da grossura dela
 *   (`ESPESSURA_DA_BORDA_DA_BANHEIRA`, que o perfil usa): tudo o que está na
 *   banheira sobe com ela, e a borda fica roliça por cima do bojo;
 * - a TOALHA que cai pela frente é um tampo solto e fino colado na borda (a
 *   dobra é a peça dele): desce a mesma beirada, por cima da louça;
 * - os PÉS são colunas baixas, com o meio fora da banheira: ficam no chão.
 *
 * A 25% de zoom sobram o aro branco, a água azul com a mancha de espuma e o
 * retalho da toalha: é o que diz "banheira" e não "cocho" nem "caixão". As
 * medidas miúdas saem do menor lado da pegada (2 x 1 casas de partida); a
 * banheira esticada ganha comprimento, não uma borda mais grossa. Materiais:
 * `metais` (a torneira, a correntinha e os pés) e `toalha`. A louça, a água,
 * a espuma, o sabão e o tampão são fixos.
 */
import { hash, limitar01, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, elipse, elipseGirada, menos, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, LENCOL, type MontarMovel } from './contexto'

/** O desenho foi medido com uma casa de fundo (28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_CASA = G / 2
const GRAUS = Math.PI / 180

/** A altura da borda e a dos pés, em casas. */
const ALTURA = 0.5
const ALTURA_DO_PE = 0.11
/** A grossura da borda roliça (px do protótipo): a beirada dela e a queda da toalha na 3/4. O perfil da banheira em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DA_BORDA_DA_BANHEIRA = 0.1 * G
/** Quanto o bojo fica abaixo da borda (px do protótipo): só para as peças subirem com a borda, e não com ele. */
const FOLGA_DO_BOJO = 1

/** A banheira na pegada: meio comprimento e meia largura (frações da meia pegada) e o raio dos cantos (fração do menor dos dois). */
const MEIO_COMPRIMENTO = 0.965
const MEIA_LARGURA = 0.9
const RAIO_DO_CANTO = 0.8
/** A largura da borda vista de cima, a da parede que aparece acima da água e o que a ponta do encosto tem a mais (px da casa de partida). */
const BORDA = 4.6
const PAREDE = 2.4
const ENCOSTO = 3.2
/** Quanto o bojo é recuado da borda (px da casa de partida): a borda passa dele na 3/4. */
const RECUO_DO_BOJO = 2.6

/** Os pés de garra: o ângulo em que saem do canto (a partir do comprido), quanto o meio fica além da borda e as duas meias medidas (px). */
const ANGULO_DO_PE = 58 * GRAUS
const PE_ALEM_DA_BORDA = 1.1
const MEIO_PE_AO_COMPRIDO = 3.2
const MEIO_PE_DE_TRAVES = 2.3

/** A louça, como a dos pratos e a da privada, e a parede de dentro, na sombra da borda. */
const LOUCA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('branco', 0.93)) }
const TOM_DA_PAREDE = 0.86
/**
 * A água do banho: o azul-petróleo do Meio-Termo mais claro e leitoso (o fundo é louça branca e há sabão nela;
 * o tom da tabela x 1,22 saía azul de piscina), e a beira rasa junto da parede.
 */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x62, 0x97, 0xa3] }
const AGUA_RASA: Rgb = [0xae, 0xcb, 0xc8]
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xdd, 0xe6, 0xe2] }
/** A espuma do sabão, o sabão (um rosado de sebo, contido) e o tampão de borracha escura. */
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xf1, 0xee, 0xe4] }
const SABAO: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xa5, 0x86] }
const TAMPAO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x44, 0x40] }

// ---------- a água ----------

/** Para o lado da luz, no chão (os mesmos números do motor): a borda desse lado faz sombra na água. */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
/** O comprimento da sombra da borda na água e o borrão dela (px da casa de partida), e quanto ela escurece. */
const SOMBRA_DA_BORDA = 2.4
const BORRAO_DA_SOMBRA = 1.8
const FORCA_DA_SOMBRA = 0.26
/** Até onde, a partir da parede, a água é rasa (px da casa de partida), e quanto da cor rasa entra nela. */
const RASO = 5
const COR_DO_RASO = 0.62

/** A água da banheira: a sombra da borda do lado da luz, a beira rasa (a louça aparece por baixo) e as marolas ao comprido. */
function texDaAgua(agua: Forma, k: number, sem: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const naSombra = limitar01(0.5 + agua.d(x + PARA_A_LUZ_X * SOMBRA_DA_BORDA * k, y + PARA_A_LUZ_Y * SOMBRA_DA_BORDA * k) / (BORRAO_DA_SOMBRA * k))
    const rasa = limitar01(1 + agua.d(x, y) / (RASO * k))
    const t = rasa * rasa * COR_DO_RASO
    s[0] += (AGUA_RASA[0] - s[0]) * t
    s[1] += (AGUA_RASA[1] - s[1]) * t
    s[2] += (AGUA_RASA[2] - s[2]) * t
    const xs = x / k
    const ys = y / k
    s[3] += ruido(xs * 0.08 + sem, ys * 0.42) * 0.07 + ruido(xs * 0.3, ys * 0.8 + sem) * 0.03 - FORCA_DA_SOMBRA * naSombra
  }
}

/** Os riscos do reflexo: [ao comprido, de través, meio comprimento] em frações da água, e a meia largura (px). */
const REFLEXOS: readonly (readonly [number, number, number, number])[] = [
  [-0.12, -0.46, 0.2, 0.7],
  [0.42, -0.2, 0.1, 0.6],
  [0.04, 0.24, 0.08, 0.5],
]
/**
 * Os dois montes de espuma, o da ponta do encosto e o da parede da frente: o meio [ao comprido, de través] em
 * frações da água e os gomos [x, y, raio] em px a partir dele. Os gomos de um monte se tocam: são uma massa só.
 */
type Gomo = readonly [x: number, y: number, raio: number]
const MONTES_DE_ESPUMA: readonly { readonly meio: readonly [number, number]; readonly gomos: readonly Gomo[] }[] = [
  {
    meio: [-0.8, -0.04],
    gomos: [[-5, -3.5, 3.4], [-6, 1, 2.8], [-2.5, 4.4, 3], [-1, -7.5, 2.6], [1, -1.5, 3.2], [2.6, 7.6, 2.3], [5.4, -5.2, 2.2], [5, 2.4, 1.9], [-2.4, -0.4, 3]],
  },
  {
    meio: [0.34, 0.62],
    gomos: [[-3.2, 1.4, 2.6], [0, 0, 3], [3.2, 2, 2.2], [-1, -3.6, 2], [4.6, -1.4, 1.8], [1.4, 3.4, 2.2]],
  },
]
/** O chanfro da massa de espuma (px): só a beira dos gomos pega sombra, o miolo fica branco. */
const CHANFRO_DA_ESPUMA = 1.2
/** A partir deste raio (px) o gomo ganha o volume dele por dentro da massa. */
const GOMO_COM_VOLUME = 2.5
/** A película rala de espuma em volta de cada monte: quanto passa dele (px). */
const PELICULA_DA_ESPUMA = 1.7
/** Quantas bolhinhas são sorteadas em volta de cada monte. */
const BOLHINHAS_POR_MONTE = 12

/** A forma crescida `quanto` px por igual (a película em volta do monte de espuma). */
function crescida(f: Forma, quanto: number): Forma {
  return { b: [f.b[0] - quanto, f.b[1] - quanto, f.b[2] + quanto, f.b[3] + quanto], d: (x, y) => f.d(x, y) - quanto }
}

/** As bolhas soltas em volta dos montes: [ao comprido, de través] em frações da água, e o raio (px). */
const BOLHAS: readonly (readonly [number, number, number])[] = [
  [-0.5, 0.1, 0.9],
  [-0.55, -0.56, 0.7],
  [-0.47, 0.42, 0.8],
  [0.14, 0.56, 0.7],
  [0.56, 0.44, 0.8],
  [0.55, 0.8, 0.6],
  [-0.52, -0.2, 0.6],
  [0.2, 0.9, 0.7],
]
/** O tampão no fundo: quanto fica antes da parede da ponta da torneira e para a frente do meio (px). */
const TAMPAO_ANTES_DA_PAREDE = 8.5
const TAMPAO_PARA_A_FRENTE = 3.4

/** A bica da torneira: quanto avança por cima da água, a partir da borda de dentro (px), e o ângulo das cruzetas na curva da ponta. */
const BICA = 6.2
const ANGULO_DAS_CRUZETAS = 32 * GRAUS
/** A toalha dobrada na borda da frente: onde começa (fração do meio comprimento), a largura e o que passa da borda para dentro e para fora (px). */
const COMECO_DA_TOALHA = -0.5
const LARGURA_DA_TOALHA = 18
const TOALHA_PARA_DENTRO = 1.4
const TOALHA_PARA_FORA = 0.9
/** O sabão na borda do fundo: onde fica, em fração do meio comprimento. */
const LUGAR_DO_SABAO = 0.22

export const montarBanheira: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const metal = c.m.metais
  const toalha = c.m.toalha
  const k = Math.min(hw, hh) / MEIA_CASA
  const L = cena.partes
  const a = hw * MEIO_COMPRIMENTO
  const b = hh * MEIA_LARGURA
  const raio = Math.min(a, b) * RAIO_DO_CANTO
  const borda = BORDA * k
  const altura = g * ALTURA
  const casco = caixa(-a, -b, a, b, raio)
  const cova = caixa(-a + borda, -b + borda, a - borda, b - borda, Math.max(1, raio - borda))

  // OS PÉS de garra: saem dos quatro cantos, com o meio fora da banheira (na 3/4 ficam no chão).
  const zPe = g * ALTURA_DO_PE
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const nx = sx * Math.cos(ANGULO_DO_PE)
      const ny = sy * Math.sin(ANGULO_DO_PE)
      const longe = raio + PE_ALEM_DA_BORDA * k
      const pe = elipseGirada(sx * (a - raio) + nx * longe, sy * (b - raio) + ny * longe, MEIO_PE_AO_COMPRIDO * k, MEIO_PE_DE_TRAVES * k, Math.atan2(ny, nx))
      cena.sombras.push({ forma: pe, z: zPe }, contato(pe, 0.32))
      L.push(P(pe, metal, { bisel: MEIO_PE_DE_TRAVES * k * 0.8, metal: 0.5, contorno: 0.3, semente: 6100 + sx * 2 + sy }))
    }
  }

  // O BOJO (a coluna, recuada) e a BORDA (o tampo solto por cima dele): as sombras são as alturas da 3/4.
  const recuo = RECUO_DO_BOJO * k
  const bojo = caixa(-a + recuo, -b + recuo, a - recuo, b - recuo, Math.max(1, raio - recuo))
  cena.sombras.push({ forma: bojo, z: altura - FOLGA_DO_BOJO }, contato(bojo, 0.3), { forma: casco, z: altura, solta: true, forca: 0.24 })

  // A PAREDE de dentro, na sombra da borda do lado da luz.
  L.push(P(cova, LOUCA, { bisel: 0, tom: TOM_DA_PAREDE, contorno: 0.2, recesso: { k: 3.2 * k, forca: 0.38 }, semente: 6110 }))

  // A ÁGUA: a ponta do encosto (à esquerda) é inclinada, e sobra mais parede acima dela.
  const parede = PAREDE * k
  const x0 = -a + borda + parede + ENCOSTO * k
  const x1 = a - borda - parede
  const meiaAgua = b - borda - parede
  const agua = caixa(x0, -meiaAgua, x1, meiaAgua, Math.max(1, raio - borda - parede))
  const meioDaAgua = (x0 + x1) / 2
  const meioComprimentoDaAgua = (x1 - x0) / 2
  const naAgua = (fx: number, fy: number): Ponto => [meioDaAgua + fx * meioComprimentoDaAgua, fy * meiaAgua]
  L.push(P(agua, AGUA, { bisel: 0, contorno: 0.18, textura: texDaAgua(agua, k, 6120), semente: 6120 }))
  // O tampão no fundo, visto por dentro da água, com a argola.
  const xTampao = x1 - TAMPAO_ANTES_DA_PAREDE * k
  const yTampao = TAMPAO_PARA_A_FRENTE * k
  L.push(P(elipse(xTampao, yTampao, 2.3 * k, 2.3 * k), TAMPAO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.7 * k, semente: 6121 }))
  L.push(P(anel(xTampao, yTampao, 1.15 * k, 1.15 * k, 0.55 * k, 0.55 * k), metal, { bisel: 0.3 * k, contorno: 0.1, alfa: 0.8, semente: 6122 }))
  REFLEXOS.forEach(([fx, fy, meio, alta], i) => {
    const [x, y] = naAgua(fx, fy)
    L.push(P(elipse(x, y, meio * meioComprimentoDaAgua, alta * k), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.9 * k, semente: 6130 + i }))
  })
  // A espuma: as bolhas soltas na água e os dois montes (cada um uma massa só, de beira em gomos).
  BOLHAS.forEach(([fx, fy, raioDaBolha], i) => {
    const [x, y] = naAgua(fx, fy)
    const r = raioDaBolha * k
    L.push(P(anel(x, y, r, r, r - 0.42 * k, r - 0.42 * k), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.75, semente: 6140 + i }))
  })
  MONTES_DE_ESPUMA.forEach(({ meio, gomos }, i) => {
    const [mx, my] = naAgua(meio[0], meio[1])
    const massa = gomos.map(([x, y, r]): Forma => elipse(mx + x * k, my + y * k, r * k, r * k)).reduce(uniao)
    // A película rala em volta, a massa de beira macia e, por dentro, o volume de cada gomo grande, meio apagado.
    L.push(P(crescida(massa, PELICULA_DA_ESPUMA * k), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.32, suave: PELICULA_DA_ESPUMA * k, semente: 6150 + i }))
    L.push(P(massa, ESPUMA, { bisel: CHANFRO_DA_ESPUMA * k, contorno: 0.06, suave: 0.6 * k, semente: 6152 + i, projeta: { dist: 0.9 * k, forca: 0.18 } }))
    gomos.forEach(([x, y, r], j) => {
      if (r < GOMO_COM_VOLUME) return
      const raioDoVolume = r * 0.62 * k
      L.push(P(elipse(mx + (x - 0.25) * k, my + (y - 0.25) * k, raioDoVolume, raioDoVolume), ESPUMA, { bisel: raioDoVolume * 0.7, contorno: 0, alfa: 0.45, suave: 0.5 * k, semente: 6160 + i * 16 + j }))
    })
    // As bolhinhas que se soltam da beira do monte, sorteadas: só as que caem fora dele e dentro da água.
    for (let j = 0; j < BOLHINHAS_POR_MONTE; j += 1) {
      const [gx, gy, gr] = gomos[Math.floor(hash(j, i, 6181) * gomos.length)]
      const angulo = hash(j, i, 6182) * Math.PI * 2
      const longe = gr + 0.5 + hash(j, i, 6183) * 1.7
      const r = (0.45 + hash(j, i, 6184) * 0.5) * k
      const x = mx + (gx + Math.cos(angulo) * longe) * k
      const y = my + (gy + Math.sin(angulo) * longe) * k
      if (massa.d(x, y) < 0.2 * k || agua.d(x, y) > -r - 0.4 * k) continue
      L.push(P(elipse(x, y, r, r), ESPUMA, { bisel: r * 0.6, contorno: 0.14, semente: 6185 + i * 16 + j }))
    }
  })

  // A BORDA roliça: o chanfro dos dois lados faz dela um tubo.
  L.push(P(menos(casco, cova), LOUCA, { bisel: borda / 2, luz: 0.02, contorno: 0.24, semente: 6170 }))

  // A correntinha do tampão, do fundo até a borda, ao pé da torneira.
  const xTorneira = a - borda / 2
  const corrente: Ponto[] = [[xTampao + 0.8 * k, yTampao + 0.3 * k], [xTampao + 4.6 * k, yTampao + 1.9 * k], [a - borda - 0.5 * k, yTampao + 1.7 * k], [xTorneira - 0.4 * k, yTampao + 0.4 * k]]
  L.push(P(cadeia(corrente, 0.42 * k), metal, { bisel: 0.3 * k, metal: 0.4, contorno: 0.2, semente: 6171, projeta: { dist: 0.5 * k, forca: 0.2 } }))
  // A TORNEIRA na ponta direita: a bica por cima da água, a base e as duas cruzetas na curva da borda.
  L.push(P(capsula(xTorneira, 0, a - borda - BICA * k, 0, 1.45 * k), metal, { bisel: 1.2 * k, metal: 0.55, contorno: 0.28, semente: 6172, projeta: { dist: 2 * k, forca: 0.3 } }))
  L.push(P(elipse(xTorneira, 0, 2.2 * k, 2.2 * k), metal, { bisel: 1.4 * k, metal: 0.5, contorno: 0.28, semente: 6173 }))
  const raioDoMeioDaBorda = raio - borda / 2
  for (const sy of [-1, 1]) {
    const x = a - raio + raioDoMeioDaBorda * Math.cos(ANGULO_DAS_CRUZETAS)
    const y = sy * (b - raio + raioDoMeioDaBorda * Math.sin(ANGULO_DAS_CRUZETAS))
    const braco = 1.9 * k
    for (const giro of [45 * GRAUS, 135 * GRAUS]) {
      const dx = Math.cos(giro) * braco
      const dy = Math.sin(giro) * braco
      L.push(P(capsula(x - dx, y - dy, x + dx, y + dy, 0.55 * k), metal, { bisel: 0.5 * k, metal: 0.4, contorno: 0.26, semente: 6174 + sy, projeta: { dist: 0.6 * k, forca: 0.24 } }))
    }
    L.push(P(elipse(x, y, 1.2 * k, 1.2 * k), metal, { bisel: 0.9 * k, metal: 0.55, contorno: 0.24, semente: 6177 + sy }))
  }

  // O sabão na borda do fundo.
  const xSabao = a * LUGAR_DO_SABAO
  const ySabao = -b + borda / 2
  L.push(P(caixa(xSabao - 2.1 * k, ySabao - 1.3 * k, xSabao + 2.1 * k, ySabao + 1.3 * k, 0.9 * k), SABAO, { bisel: 0.9 * k, contorno: 0.22, semente: 6180, projeta: { dist: 0.6 * k, forca: 0.22 } }))

  // A TOALHA dobrada na borda da frente: as duas listras da barra e a dobra que cai para fora.
  const t0 = a * COMECO_DA_TOALHA
  const t1 = t0 + LARGURA_DA_TOALHA * k
  const y0 = b - borda - TOALHA_PARA_DENTRO * k
  const y1 = b + TOALHA_PARA_FORA * k
  L.push(P(caixa(t0, y0, t1, y1, 0.9 * k), toalha, { bisel: 0.9 * k, ruga: 0.5, contorno: 0.24, semente: 6190, projeta: { dist: 0.9 * k, forca: 0.26 } }))
  for (const antes of [2.6, 4.8]) {
    const x = t1 - antes * k
    L.push(P(caixa(x - 0.55 * k, y0 + 0.4 * k, x + 0.55 * k, y1 - 0.4 * k), LENCOL, { bisel: 0, contorno: 0, alfa: 0.85, semente: 6191 }))
  }
  // A dobra: o meio dela fica fora da banheira, dentro da tira que a 3/4 desce pela frente.
  const dobra = caixa(t0 + 0.2 * k, b - 0.3 * k, t1 - 0.2 * k, y1, 0.4 * k)
  L.push(P(dobra, toalha, { bisel: 0.5 * k, tom: 0.88, contorno: 0.2, semente: 6193 }))
  cena.sombras.push({ forma: caixa(t0 + 0.2 * k, b + 0.05 * k, t1 - 0.2 * k, y1), z: altura, solta: true, forca: 0 })
}

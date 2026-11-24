/**
 * CADEIRA DE FERRO de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; a versão de
 * ferro da cadeira). A cadeira do guarda e da sala de interrogatório: o ASSENTO é um U de barra chata (as barras do
 * lado ligam os pés) com três RIPAS de chapa atravessadas por cima, rebitadas nas pontas, e o vão escuro entre elas;
 * o ESPALDAR é reto, uma chapa de pé com a barra chata por cima, entre os dois POSTES (os pés de trás que sobem), cada
 * um com o rebite da emenda. Desenho original: só a ideia do móvel de cadeia, nada das referências.
 *
 * De cima ela tem SILHUETA de cadeira, e não de grelha: os postes saem para fora da largura do assento, as pontas dos
 * pés da frente aparecem como dois quadradinhos escuros nas quinas de baixo, um VÃO escuro separa o assento do
 * espaldar e o espaldar é mais escuro que as ripas (duas massas, não um caixote listrado).
 *
 * O ferro é escuro e fosco, com o brilho só no chanfro; a FERRUGEM fica só nas QUINAS (`texFerroGasto`): forte nos
 * postes e nas pontas das ripas, mais fraca no quadro e na chapa, e as beiras compridas ficam limpas. Os REBITES são
 * cabeças redondas que pegam a luz em cima à esquerda e deixam um fio de sombra na chapa.
 *
 * As sombras: o assento solto no ar; o espaldar uma COLUNA entre os postes, até o alto (na 3/4 a derivação pinta a
 * face da chapa entre o assento e a barra de cima; o pedaço de baixo da coluna fica atrás do assento); cada pé uma
 * coluna, os de trás até o espaldar. A frente é o lado de baixo (o espaldar fica em cima). Sem material escolhido: o
 * ferro, a ferrugem e os rebites são fixos.
 *
 * Também exporta o ferro do lote (o material, o escuro do piso de luz, a textura gasta e o rebite), que a mesa, o
 * catre, o balde, os grilhões e a bola de ferro usam.
 */
import { limitar01, type Rgb } from '../../ruido'
import { caixa, capsula, elipse, uniao, type Forma } from './formas'
import { contato, ruido, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'

// ---------- o ferro do lote ----------

/** O ferro da prisão: o ferro da tabela, no tom do Meio-Termo. */
export const FERRO_DA_PRISAO: MaterialDaPeca = materialDaPeca('ferro')
/** O escuro em que o pixel escuro demais é levantado: o cinza quente do ferro (o da corrente; o padrão é a nogueira). */
export const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** A ferrugem: castanho apagado, nunca laranja (o tom da corrente). */
const FERRUGEM: Rgb = [0x7e, 0x5e, 0x4a]
/** Até onde a ferrugem entra a partir da quina da peça (px do protótipo). Com 4,6 ela quase não aparecia de cima. */
const RAIO_DA_FERRUGEM = 6

const DO_METAL = texturaDaClasse('metal')

/** Puxa a cor da peça para a ferrugem, `t` de 0 a 1. */
function enferrujar(s: Float32Array, t: number): void {
  s[0] += (FERRUGEM[0] - s[0]) * t
  s[1] += (FERRUGEM[1] - s[1]) * t
  s[2] += (FERRUGEM[2] - s[2]) * t
}

/**
 * O ferro gasto: o metal e a ferrugem em manchas. `quinas` (0 a 1) é a força dela perto das quinas da caixa da peça,
 * onde a tinta e a carepa saem primeiro; `soltas` (0 a 1), a das manchas espalhadas pela chapa (0 = só nas quinas).
 */
export function texFerroGasto(forma: Forma, quinas: number, soltas = 0): Textura {
  const [x0, y0, x1, y1] = forma.b
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const naQuina = limitar01(1 - Math.hypot(Math.min(x - x0, x1 - x), Math.min(y - y0, y1 - y)) / RAIO_DA_FERRUGEM)
    const mancha = limitar01((ruido(x * 0.55 + p.su, y * 0.55 + p.sv) + 0.5) * 1.3)
    const solta = soltas > 0 ? limitar01((ruido(x * 0.19 + p.sv, y * 0.19 + p.su) - 0.12) * 2.6) * soltas : 0
    const t = Math.max(naQuina * naQuina * quinas, solta) * mancha
    if (t > 0) enferrujar(s, t)
  }
}

/** Um rebite: a cabeça redonda (o chanfro do tamanho dela) que pega a luz e deixa um fio de sombra embaixo à direita. */
export function rebite(P: CriarPeca, x: number, y: number, r: number, semente: number, tom = 1.12): Peca {
  return P(elipse(x, y, r, r), FERRO_DA_PRISAO, { tabua: 0, bisel: r * 0.9, tom, metal: 0.5, contorno: 0.26, semente, projeta: { dist: r * 0.7, forca: 0.3, suave: r * 0.6 } })
}

// ---------- a cadeira ----------

/** O lado de partida da cadeira (0,6 casa): as medidas miúdas escalam por ele. */
const LADO_DE_PARTIDA = 0.6 * G
/** As alturas, em casas: o assento e o alto do espaldar. */
const ALTURA_DO_ASSENTO = 0.3
const ALTURA_DO_ESPALDAR = 0.7
/** O espaldar ocupa esta fração da pegada em cima; o poste (o pé de trás que sobe), esta fração do lado. */
const FUNDO_DO_ESPALDAR = 0.21
const LADO_DO_POSTE = 0.17
/**
 * A silhueta de cima (px de partida): quanto os postes e as pontas dos pés da frente saem para fora do assento, e o
 * vão escuro entre o assento e o espaldar. A ponta do pé é um quadradinho (fração do poste), mais escuro.
 */
const SOBRA_DO_POSTE = 0.6
const VAO_DO_ESPALDAR = 0.8
const PONTA_DO_PE = 0.8
const TOM_DA_PONTA = 0.6
/** O espaldar mais escuro que as ripas: de cima, as duas massas se separam. */
const TOM_DO_ESPALDAR = 0.85
const TOM_DAS_RIPAS = 1.06
/** A barra chata do assento (px de partida), a dobra da beira que aparece embaixo, as ripas e o vão entre elas. */
const BARRA_DA_MOLDURA = 2.6
const DOBRA = 1.5
const RIPAS = 3
const VAO_DAS_RIPAS = 1.1
const RAIO_DO_REBITE = 0.95
/** O vão escuro entre a chapa do espaldar e a barra de cima, e o que separa o assento do espaldar. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x2f, 0x2c, 0x2a] }

const QUINAS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

export const montarCadeiraDeFerro: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const k = Math.min(w, h) / LADO_DE_PARTIDA
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const zS = g * ALTURA_DO_ASSENTO
  const zE = g * ALTURA_DO_ESPALDAR
  const poste = LADO_DO_POSTE * Math.min(w, h)
  const pe = PONTA_DO_PE * poste
  const sobra = SOBRA_DO_POSTE * k
  const yEspaldar = -hh + FUNDO_DO_ESPALDAR * h
  const yFimDoPoste = yEspaldar + 0.4 * k
  // O assento fica dentro dos postes e das pontas dos pés (a sobra de cada lado e na frente), com o vão escuro atrás.
  const [ax0, ay0, ax1, ay1] = [-hw + sobra, yEspaldar + VAO_DO_ESPALDAR * k, hw - sobra, hh - sobra]
  const assento = caixa(ax0, ay0, ax1, ay1, 1.3 * k)
  // O espaldar entre os postes (a coluna que a 3/4 sobe) e a chapa, que entra um nada debaixo deles.
  const espaldar = caixa(-hw + poste, -hh, hw - poste, yEspaldar, 0.5 * k)
  const chapa = caixa(-hw + poste - 0.4 * k, -hh, hw - poste + 0.4 * k, yEspaldar, 0.9 * k)

  // As sombras: o assento solto; o espaldar uma coluna entre os postes; cada pé uma coluna (os de trás sobem até o
  // espaldar e vão até o fim do poste, para a 3/4 desenhá-los por cima da chapa) com o contato.
  cena.sombras.push({ forma: assento, z: zS, solta: true, forca: 0.26 }, { forma: espaldar, z: zE, forca: 0.24 })
  for (const [sx, sy] of QUINAS) {
    const atras = sy < 0
    const lado = atras ? poste : pe
    const x = sx < 0 ? -hw : hw - lado
    const [y0, y1] = atras ? [-hh, yFimDoPoste] : [hh - lado, hh]
    const folga = 0.5 * k
    cena.sombras.push(contato(caixa(x - folga, y0 - folga, x + lado + folga, y1 + folga, 0.8 * k), 0.34), { forma: caixa(x, y0, x + lado, y1, 0.4 * k), z: atras ? zE : zS, forca: 0.26 })
  }

  // O ASSENTO: a dobra da beira (embaixo e um fio à direita), o U de barra chata (as barras do lado, que ligam os pés,
  // e a da frente) e as RIPAS de chapa atravessadas por cima, com o vão escuro entre elas, cada uma rebitada nas barras.
  const b = BARRA_DA_MOLDURA * k
  L.push(P(assento, FERRO_DA_PRISAO, { dx: 0.4 * k, dy: DOBRA * k, tabua: 0, bisel: 0.6 * k, tom: 0.56, contorno: 0.3, semente: 24101 }))
  const quadro = uniao(uniao(caixa(ax0, ay0, ax0 + b, ay1, 0.7 * k), caixa(ax1 - b, ay0, ax1, ay1, 0.7 * k)), caixa(ax0, ay1 - b, ax1, ay1, 0.7 * k))
  L.push(P(quadro, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.8 * k, tom: 0.84, metal: 0.3, contorno: 0.26, textura: texFerroGasto(assento, 0.6), semente: 24102 }))
  const [r0, r1] = [ay0 + 0.5 * k, ay1 - b - 0.5 * k]
  const vao = VAO_DAS_RIPAS * k
  const alto = (r1 - r0 - vao * (RIPAS - 1)) / RIPAS
  for (let j = 0; j < RIPAS; j += 1) {
    const y0 = r0 + j * (alto + vao)
    const ripa = caixa(ax0 + 0.6 * k, y0, ax1 - 0.6 * k, y0 + alto, 0.6 * k)
    L.push(P(ripa, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.7 * k, tom: TOM_DAS_RIPAS, metal: 0.34, contorno: 0.26, textura: texFerroGasto(ripa, 1), semente: 24103 + j, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.6 * k } }))
    for (const sx of [-1, 1]) L.push(rebite(P, sx < 0 ? ax0 + b / 2 : ax1 - b / 2, y0 + alto / 2, RAIO_DO_REBITE * k, 24110 + j * 2 + sx))
  }

  // O ESPALDAR: o vão escuro que o separa do assento, a dobra fina da chapa (o vão aparece logo abaixo dela), a chapa,
  // que faz sombra no assento, e o vão da barra de cima.
  L.push(P(caixa(-hw + poste, yEspaldar - 0.2 * k, hw - poste, ay0 + 0.2 * k, 0.2 * k), VAO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 24119 }))
  L.push(P(chapa, FERRO_DA_PRISAO, { dx: 0.3 * k, dy: 0.5 * k, tabua: 0, bisel: 0.5 * k, tom: 0.56, contorno: 0.3, semente: 24120 }))
  const yBarra = -hh + (yEspaldar + hh) * 0.62
  L.push(P(chapa, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.9 * k, tom: TOM_DO_ESPALDAR, metal: 0.36, contorno: 0.24, textura: texFerroGasto(chapa, 0.7), semente: 24121, projeta: { dist: (zE - zS) * 0.18, forca: 0.34, suave: 1.4 * k } }))
  L.push(P(capsula(-hw + poste, yBarra, hw - poste, yBarra, 0.28 * k), VAO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, semente: 24122 }))

  // Os POSTES nas pontas do espaldar, para fora do assento: o chanfro forte, a ferrugem nas quinas e o rebite da emenda.
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -hw : hw - poste
    const forma = caixa(x0, -hh, x0 + poste, yFimDoPoste, 0.7 * k)
    L.push(P(forma, FERRO_DA_PRISAO, { tabua: 0, bisel: 1.2 * k, tom: 1.04, metal: 0.4, contorno: 0.28, textura: texFerroGasto(forma, 1), semente: 24130 + sx }))
    L.push(rebite(P, x0 + poste / 2, (-hh + yEspaldar) / 2, RAIO_DO_REBITE * k, 24133 + sx, 1.18))
  }

  // As PONTAS DOS PÉS da frente: o quadradinho escuro em cada quina de baixo, saindo para fora do assento.
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -hw : hw - pe
    const ponta = caixa(x0, hh - pe, x0 + pe, hh, 0.5 * k)
    L.push(P(ponta, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.7 * k, tom: TOM_DA_PONTA, metal: 0.3, contorno: 0.3, textura: texFerroGasto(ponta, 0.2), semente: 24140 + sx }))
  }
}

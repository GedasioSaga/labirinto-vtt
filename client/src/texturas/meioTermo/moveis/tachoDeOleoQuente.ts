/**
 * TACHO DE ÓLEO QUENTE DA MURALHA de cima com volume (14/11/2026, o cerco e a
 * defesa): o tacho largo e raso de ferro que se vira por cima do parapeito
 * em quem sobe a escada. Não é o caldeirão da cozinha (bojudo, em cima das
 * pedras e do fogo, com a sopa): aqui o tacho fica PENDURADO num EIXO de ferro
 * entre dois POSTES grossos de madeira, com o BICO de despejar virado para a
 * frente e a ALAVANCA na ponta do eixo, por fora do poste da direita, para
 * virar: a barra de ferro com o punho de madeira, deitada para trás.
 *
 * De cima: o beiço grosso do tacho, o ÓLEO escuro e quente com o brilho do
 * céu, as bolhas e os fiapos de fumaça pintados saindo dele; os dois munhões
 * que prendem o tacho no eixo; o topo de cada poste, com os anéis da madeira
 * cortada, a chapa do mancal e dois parafusos; e no chão, debaixo do bico, as
 * manchas do óleo que já pingou. Sem fogo: o óleo vem quente de outro lugar
 * (só pintura, sem chama).
 *
 * A 25% de zoom sobra o disco escuro de beiço claro entre dois quadrados de
 * madeira, com a barra do eixo de um ao outro e a alavanca: é o que diz
 * "tacho na muralha" e não "poço" nem "barril". A pegada é 1,5 x 1 casa de
 * partida; o tacho sai do lado menor e os postes, da largura. Materiais:
 * `metal` (o tacho, o eixo e as ferragens) e `madeira` (os postes e o punho);
 * o óleo, as bolhas e a fumaça são fixos.
 */
import { type Rgb } from '../../ruido'
import { anel, caixa, cadeia, capsula, elipse, poligono, uniao, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/**
 * O óleo quente: âmbar (saturação HSV ~0,56), o brilho do céu nele, quase branco, e a beira dourada. Mais
 * escuro que isto, com o marrom puxado, o tacho parecia de café.
 */
const OLEO: MaterialDaPeca = { classe: 'liso', rgb: [0x80, 0x66, 0x38] }
/** A meia-lua do brilho: a que distância do meio (fração do raio do óleo) e a meia largura dela. A luz vem de cima à esquerda. */
const RAIO_DO_BRILHO = 0.64
const LARGURA_DO_BRILHO = 0.14
const LUZ_X = -0.6
const LUZ_Y = -0.8
const TOM_DO_BRILHO: Rgb = [0xe2, 0xd6, 0xbc]
const TOM_DA_BEIRA: Rgb = [0xa6, 0x84, 0x4a]
/** A mancha do óleo pingado no chão: escura, meio transparente (o chão aparece por baixo). */
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x2f, 0x22] }
/** A fumaça rala: cinza claro morno, quase transparente. */
const FUMACA: MaterialDaPeca = { classe: 'liso', rgb: [0xde, 0xda, 0xd0] }
/** O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do ferro (com a nogueira, o beiço na sombra saía marrom). */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]

/** O raio do tacho em fração da meia altura da pegada, e o meio dele (fração da meia altura, para trás, para o bico caber). */
const RAIO = 0.84
const MEIO_DO_TACHO = -0.08
/** O beiço: a parte do raio que ele ocupa. O bico: o comprimento (em raios) e a meia boca dele. */
const BEICO = 0.15
const BICO = 0.17
const MEIA_BOCA_DO_BICO = 0.26
/** O poste: o meio dele (fração da meia largura) e o meio lado (fração do menor lado da pegada). */
const LUGAR_DO_POSTE = 0.75
const MEIO_POSTE = 0.11
/** A grossura do eixo (raio, px do protótipo) e a alavanca: o comprimento (fração do menor lado) e a parte do punho. */
const RAIO_DO_EIXO = 1.5
const ALAVANCA = 0.4
const PUNHO = 0.42
/** As alturas, em casas: o alto do poste (onde o eixo passa) e o beiço do tacho. */
const ALTURA_DO_POSTE = 0.7
const ALTURA_DO_TACHO = 0.56
/** Os anéis da madeira no topo do poste: quantos por px do protótipo. */
const ANEIS_POR_PX = 0.9
/** As bolhas do óleo: [x, y, raio] em frações do raio do óleo. */
const BOLHAS: readonly (readonly [number, number, number])[] = [
  [0.34, 0.2, 0.075],
  [0.46, 0.02, 0.05],
  [-0.1, 0.46, 0.06],
  [0.2, 0.52, 0.04],
  [-0.4, 0.26, 0.045],
  [0.08, 0.24, 0.035],
  [0.52, 0.32, 0.03],
]
/** Os três fiapos de fumaça: os pontos em frações do raio do óleo, do pé (no óleo) para a ponta (para trás). */
const FUMACAS: readonly (readonly Ponto[])[] = [
  [[-0.24, 0.16], [-0.34, -0.02], [-0.24, -0.2], [-0.36, -0.4], [-0.26, -0.6], [-0.36, -0.78]],
  [[0.1, 0.08], [0.2, -0.1], [0.1, -0.3], [0.22, -0.5], [0.14, -0.66]],
  [[0.36, -0.16], [0.46, -0.3], [0.38, -0.46]],
]

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * O óleo: escuro no fundo, com o brilho do céu em meia-lua do lado da luz (em cima à esquerda), as ondas rasas
 * da fervura que tremem o brilho, e a beira dourada, onde o óleo fica raso contra o ferro e a luz passa.
 */
function texDoOleo(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = (x - cx) / r
    const dy = (y - cy) / r
    const onda = ruido(x * 0.35 + p.su, y * 0.35) * 0.9 + ruido(x * 0.9, y * 0.9 + p.sv) * 0.4
    // O brilho é a meia-lua do céu refletida perto da beira, do lado da luz (uma mancha no meio virava espuma).
    const raio = Math.hypot(dx, dy)
    const paraALuz = (dx * LUZ_X + dy * LUZ_Y) / Math.max(raio, 1e-3)
    const meiaLua = limitar(1 - Math.abs(raio - RAIO_DO_BRILHO) / LARGURA_DO_BRILHO, 0, 1) * limitar((paraALuz - 0.5) / 0.35, 0, 1)
    const brilho = limitar(meiaLua * (1.5 + onda * 0.8), 0, 1) * 0.7
    const beira = limitar((raio - 0.8) / 0.2, 0, 1) * 0.55
    s[0] += (TOM_DA_BEIRA[0] - s[0]) * beira
    s[1] += (TOM_DA_BEIRA[1] - s[1]) * beira
    s[2] += (TOM_DA_BEIRA[2] - s[2]) * beira
    s[0] += (TOM_DO_BRILHO[0] - s[0]) * brilho
    s[1] += (TOM_DO_BRILHO[1] - s[1]) * brilho
    s[2] += (TOM_DO_BRILHO[2] - s[2]) * brilho
    s[3] += onda * 0.06
  }
}

/** O topo do poste cortado: os anéis da madeira em volta do miolo (um nada fora do meio) e a rachadura de secar. */
function texDoTopo(cx: number, cy: number, meio: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = x - cx - meio * 0.12
    const dy = y - cy + meio * 0.08
    const d = Math.hypot(dx, dy) + ruido(x * 0.4 + p.su, y * 0.4) * 0.8
    s[3] += Math.sin(d * ANEIS_POR_PX * 2 * Math.PI) * 0.05 - (d / meio) * 0.06
    const racha = Math.abs(dy - dx * 0.35)
    if (dx > 0 && racha < 0.35) s[3] -= 0.18 * (1 - racha / 0.35)
  }
}

/** Um poste: a madeira com o topo cortado, a chapa do mancal por cima (onde o eixo deita) e os dois parafusos. */
function montarPoste(c: ContextoDoMovel, cena: Cena, x: number, y: number, meio: number, lado: number): void {
  const P = c.peca
  const metal = c.m.metal
  const poste = caixa(x - meio, y - meio, x + meio, y + meio, 1)
  cena.sombras.push({ forma: poste, z: c.g * ALTURA_DO_POSTE, forca: 0.3 }, contato(poste, 0.34))
  cena.partes.push(P(poste, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: meio * 0.32, tom: 1.02, contorno: 0.34, textura: texDoTopo(x, y, meio), semente: 8700 + lado }))
  const meiaChapa = meio * 0.3
  cena.partes.push(P(caixa(x - meiaChapa, y - meio - 0.4, x + meiaChapa, y + meio + 0.4, 0.5), metal, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.3, metal: 0.22, semente: 8702 + lado, projeta: { dist: 0.7, forca: 0.3 } }))
  for (const s of [-1, 1]) {
    cena.partes.push(P(elipse(x, y + s * meio * 0.74, 0.8, 0.8), metal, { bisel: 0.8, tom: 1.2, contorno: 0.1, metal: 0.36, semente: 8704 + lado }))
  }
}

export const montarTachoDeOleoQuente: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const metal = c.m.metal
  const k = Math.min(c.w, c.h)
  const xPoste = c.hw * LUGAR_DO_POSTE
  const meioPoste = k * MEIO_POSTE
  const cy = c.hh * MEIO_DO_TACHO
  const R = Math.min(c.hh * RAIO, xPoste - meioPoste - 1.5)
  const rOleo = R * (1 - BEICO)
  cena.corDoPiso = ESCURO_DO_FERRO

  // No chão, debaixo do bico: as manchas do óleo que já pingou.
  const yBico = cy + R * (1 + BICO)
  for (const [mx, my, rx, ry] of [[-0.18, 0.04, 0.13, 0.07], [0.12, 0.1, 0.09, 0.05], [0.28, -0.02, 0.045, 0.03]]) {
    const y = Math.min(c.hh - R * ry, yBico + R * my)
    L.push(P(elipse(R * mx, y, R * rx, R * ry), MANCHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 0.6, semente: 8710 }))
  }

  // Os postes e o eixo de ponta a ponta, por cima deles.
  montarPoste(c, cena, -xPoste, cy, meioPoste, -1)
  montarPoste(c, cena, xPoste, cy, meioPoste, 1)
  const xFimDoEixo = xPoste + meioPoste + 1.6
  const eixo = capsula(-xPoste - meioPoste * 0.6, cy, xFimDoEixo, cy, RAIO_DO_EIXO)
  cena.sombras.push({ forma: eixo, z: c.g * ALTURA_DO_POSTE, solta: true, forca: 0.3 })
  L.push(P(eixo, metal, { tabua: 0, bisel: RAIO_DO_EIXO, tom: 1.02, contorno: 0.3, metal: 0.4, semente: 8720, projeta: { dist: 0.8, forca: 0.3 } }))

  // A alavanca: a barra de ferro deitada para trás na ponta do eixo, com o punho de madeira na ponta.
  const yFim = cy - k * ALAVANCA
  const yPunho = yFim + k * ALAVANCA * PUNHO
  const barraDaAlavanca = capsula(xFimDoEixo, cy, xFimDoEixo, yPunho, RAIO_DO_EIXO * 0.85)
  const punho = capsula(xFimDoEixo, yPunho + 0.6, xFimDoEixo, yFim, 1.9)
  cena.sombras.push({ forma: uniao(barraDaAlavanca, punho), z: c.g * ALTURA_DO_POSTE, solta: true, forca: 0.3 })
  L.push(P(barraDaAlavanca, metal, { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_EIXO * 0.85, tom: 1, contorno: 0.3, metal: 0.36, semente: 8722 }))
  L.push(P(punho, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 1.9, tom: 1.1, contorno: 0.32, semente: 8723, projeta: { dist: 0.6, forca: 0.28 } }))
  L.push(P(elipse(xFimDoEixo, cy, RAIO_DO_EIXO * 1.3, RAIO_DO_EIXO * 1.3), metal, { bisel: RAIO_DO_EIXO * 1.3, tom: 1.12, contorno: 0.24, metal: 0.4, semente: 8724 }))

  // O tacho: a sombra dele, o beiço com o bico, o óleo e o que está no óleo.
  const borda = elipse(0, cy, R, R)
  const bico = poligono([[-R * MEIA_BOCA_DO_BICO, cy + R * 0.9], [0, yBico], [R * MEIA_BOCA_DO_BICO, cy + R * 0.9]])
  const corpo = uniao(borda, bico)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DO_TACHO, forca: 0.3 })
  L.push(P(corpo, metal, { tabua: 0, bisel: R * BEICO * 0.8, tom: 0.98, contorno: 0.36, metal: 0.3, semente: 8730, projeta: { dist: 1.6, forca: 0.3 } }))
  // O canal do bico, por onde o óleo escorre: um fio de óleo até a ponta.
  L.push(P(poligono([[-R * MEIA_BOCA_DO_BICO * 0.45, cy + R * 0.86], [0, yBico - R * 0.06], [R * MEIA_BOCA_DO_BICO * 0.45, cy + R * 0.86]]), OLEO, { tabua: 0, bisel: 0.4, tom: 1.1, contorno: 0.1, semente: 8731 }))
  L.push(P(elipse(0, cy, rOleo, rOleo), OLEO, { tabua: 0, bisel: 0.6, contorno: 0.2, textura: texDoOleo(0, cy, rOleo), recesso: { k: 3.2, forca: 0.42 }, semente: 8732 }))
  // O beiço por cima do óleo, com a luz na volta: faz a sombra dentro do tacho.
  L.push(P(anel(0, cy, R * 0.98, R * 0.98, rOleo, rOleo), metal, { tabua: 0, bisel: R * BEICO * 0.5, tom: 1.08, contorno: 0.3, metal: 0.38, semente: 8733, projeta: { dist: 2.2, forca: 0.42, suave: 1.2 } }))
  BOLHAS.forEach(([bx, by, br], i) => {
    const r = Math.max(0.7, rOleo * br)
    L.push(P(anel(rOleo * bx, cy + rOleo * by, r, r, r * 0.5, r * 0.5), OLEO, { tabua: 0, bisel: r * 0.4, tom: 1.9, contorno: 0.16, semente: 8740 + i }))
  })
  // Os munhões: o tacho preso no eixo dos dois lados, por cima do beiço.
  for (const lado of [-1, 1]) {
    const x = lado * R
    L.push(P(caixa(x - R * 0.1, cy - R * 0.13, x + R * 0.1, cy + R * 0.13, 0.6), metal, { tabua: 0, bisel: 0.8, tom: 1.1, contorno: 0.3, metal: 0.34, semente: 8750 + lado, projeta: { dist: 0.8, forca: 0.3 } }))
    L.push(P(elipse(x, cy, 0.9, 0.9), metal, { bisel: 0.9, tom: 1.25, contorno: 0.1, metal: 0.4, semente: 8752 + lado }))
  }

  // Os fiapos de fumaça, finos, por cima de tudo.
  FUMACAS.forEach((fiapa, i) => {
    const pontos = fiapa.map(([fx, fy]): Ponto => [rOleo * fx, cy + rOleo * fy])
    L.push(P(cadeia(pontos, rOleo * 0.05), FUMACA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: rOleo * 0.09, semente: 8760 + i }))
  })
}

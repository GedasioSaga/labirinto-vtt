/**
 * RELÓGIO DE SOL de cima com volume (lote L13 dos objetos novos, 14/11/2026,
 * grupo Cidade e vila): o relógio de praça ou de jardim. De baixo para cima:
 * o DEGRAU oitavado de pedra, o FUSTE redondo (escondido de cima pelo
 * capitel, aparece na 3/4), o CAPITEL redondo com a moldura e, nele, o
 * MOSTRADOR de metal com a borda alta, as LINHAS DAS HORAS em leque na metade
 * do norte (as de três em três mais compridas), o SOL gravado na metade do
 * sul e o GNÔMON, a lâmina que corre do meio para o norte e sobe para lá.
 *
 * O que diz "relógio de sol" a 25% de zoom é o disco claro de metal com a
 * SOMBRA DO GNÔMON pintada: a cunha escura que sai da lâmina para baixo à
 * direita (a luz do mapa vem de cima à esquerda) e se alarga para o norte,
 * onde a lâmina é mais alta. O musgo no degrau e o verdete nas linhas
 * gravadas dizem que ele está ali faz tempo.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o fuste é uma coluna e o capitel, um
 * tampo solto na mesma altura, com a beirada `ESPESSURA_DO_RELOGIO_DE_SOL`; o
 * gnômon é um tampo solto um pouco acima, e a mesma beirada o põe de pé no
 * mostrador. O degrau vai em duas metades com o pé do fuste recortado nas
 * duas (a regra do pilar): inteiro, ele seria pintado por último (a base dele
 * é a mais ao sul) e cobriria o fuste. O corte acompanha o quarto de volta
 * que a 3/4 pinta (`c.giro`).
 *
 * Materiais: `pedra` (o degrau, o fuste e o capitel) e `metal` (o mostrador e
 * o gnômon). O verdete, o musgo e a sombra pintada são fixos. As medidas saem
 * do menor meio lado da pegada (o relógio continua redondo esticado).
 */
import { caixa, capsula, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

// ---------- as medidas, em frações do menor meio lado ----------

/** O degrau oitavado (o raio de dentro, de face a face), o fuste, o capitel, a moldura dele e o mostrador. */
const RAIO_DO_DEGRAU = 0.96
const RAIO_DO_FUSTE = 0.4
const RAIO_DO_CAPITEL = 0.76
const RAIO_DA_MOLDURA = 0.66
const RAIO_DO_MOSTRADOR = 0.6
const RAIO_DA_BORDA_DO_MOSTRADOR = 0.52
/** As linhas das horas: do raio de dentro ao de fora (as de três em três começam mais para dentro). */
const HORA_DE = 0.38
const HORA_DE_TRES_EM_TRES = 0.27
const HORA_ATE = 0.49
/** Quantas horas o leque tem, de oeste a leste pelo norte (13 linhas: das 6 às 18). */
const HORAS = 12
/** O gnômon: o pé (um pouco ao sul do meio, onde as linhas se encontram) e a ponta do norte. */
const PE_DO_GNOMON = 0.1
const PONTA_DO_GNOMON = -0.5
/** A meia grossura da lâmina, em px do protótipo. */
const MEIA_LAMINA = 0.85
/** A sombra do gnômon no mostrador: quanto a ponta alta dela anda para baixo à direita. */
const SOMBRA_DO_GNOMON = 0.24
/** O sol gravado na metade do sul: o meio, o raio do rosto e o comprimento dos raios. */
const MEIO_DO_SOL = 0.3
const RAIO_DO_SOL = 0.075
const RAIO_DO_RAIO = 0.075
const RAIOS_DO_SOL = 8
/** O ponto que vai na forma do gnômon (px do protótipo): o raio dele e o quanto fica para dentro da beira de baixo. */
const PONTO_SEM_TAMANHO = 0.05
const PONTO_DO_SUL = 0.3
/** Onde a estrutura do gnômon para, ao norte do meio do mostrador (px do protótipo). */
const FOLGA_DO_MEIO = 1.5

// ---------- as alturas, em casas ----------

const ALTURA_DO_DEGRAU = 0.1
/** O alto do capitel (o mostrador fica nele) e o quanto o gnômon sobe acima do mostrador. */
const ALTURA_DO_CAPITEL = 0.72
const ALTURA_DO_GNOMON = 0.15
/** A beirada dos tampos soltos na 3/4, em px do protótipo: a grossura do capitel e a altura do gnômon. */
export const ESPESSURA_DO_RELOGIO_DE_SOL = ALTURA_DO_GNOMON * G

// ---------- os materiais fixos ----------

/** O verdete do bronze velho, que junta nas linhas gravadas. */
const VERDETE: MaterialDaPeca = { classe: 'liso', rgb: [0x5b, 0x7f, 0x6c] }
/** A sombra pintada do gnômon e o escuro das linhas. */
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x26, 0x1e] }
/** O musgo nas juntas do degrau. */
const MUSGO: MaterialDaPeca = { classe: 'folha', rgb: [0x5a, 0x6b, 0x42] }

/** As manchas de musgo no degrau: o ângulo (radianos) e o tamanho, em fração do menor meio lado. */
const MANCHAS_DE_MUSGO: readonly (readonly [number, number])[] = [
  [-2.6, 0.1],
  [-2.2, 0.07],
  [2.3, 0.08],
  [0.9, 0.06],
]

/** O oitavado de raio de dentro `r` (de face a face), com as faces viradas para os quatro lados. */
function oitavado(r: number): Forma {
  const vertice = r / Math.cos(Math.PI / 8)
  const pontos: Ponto[] = Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4
    return [Math.cos(a) * vertice, Math.sin(a) * vertice]
  })
  return poligono(pontos)
}

/**
 * As duas metades do degrau como a 3/4 as pinta: a de trás e a da frente NA TELA. No giro ímpar (um quarto de
 * volta) a frente da tela é um lado do desenho, e o corte é de pé.
 */
function metades(forma: Forma, giro: number): [Forma, Forma] {
  const longe = 1000
  if (deLado(giro)) return [dentroDe(forma, caixa(-longe, -longe, 0, longe)), dentroDe(forma, caixa(0, -longe, longe, longe))]
  return [dentroDe(forma, caixa(-longe, -longe, longe, 0)), dentroDe(forma, caixa(-longe, 0, longe, longe))]
}

function deLado(giro: number): boolean {
  return ((Math.round(giro / 90) % 2) + 2) % 2 === 1
}

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

export const montarRelogioDeSol: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const pedra = c.m.pedra
  const metal = c.m.metal
  const L = cena.partes
  const zDegrau = ALTURA_DO_DEGRAU * G
  const zCapitel = ALTURA_DO_CAPITEL * G

  // ---------- as sombras: o degrau em duas metades, o fuste, o capitel solto e o gnômon ----------
  const pe = elipse(0, 0, RAIO_DO_FUSTE * R, RAIO_DO_FUSTE * R)
  const degrau = oitavado(RAIO_DO_DEGRAU * R)
  const [degrauDeTras, degrauDaFrente] = metades(menos(degrau, pe), c.giro)
  const capitel = elipse(0, 0, RAIO_DO_CAPITEL * R, RAIO_DO_CAPITEL * R)
  const lamina = caixa(-MEIA_LAMINA, PONTA_DO_GNOMON * R, MEIA_LAMINA, PE_DO_GNOMON * R, MEIA_LAMINA)
  // O ponto sem tamanho na beira de baixo da pegada põe a base do gnômon mais ao sul que a do capitel e a do
  // degrau: ele sai por último na 3/4, de pé em cima do mostrador (senão a beirada do capitel o cobriria).
  // A estrutura do gnômon para antes do meio do mostrador: com o meio dentro dela, o capitel e o mostrador
  // inteiros subiam com o gnômon e cobriam as linhas das horas.
  const laminaAteOMeio = dentroDe(lamina, caixa(-R, -R, R, -FOLGA_DO_MEIO))
  const gnomon = uniao(laminaAteOMeio, elipse(0, R - PONTO_DO_SUL, PONTO_SEM_TAMANHO, PONTO_SEM_TAMANHO))
  cena.sombras.push(
    { forma: degrauDeTras, z: zDegrau },
    { forma: degrauDaFrente, z: zDegrau },
    contato(degrau, 0.32),
    // O fuste vai até debaixo do capitel: mais baixo que ele, não leva nenhuma peça, e tudo o que fica no
    // capitel sobe com o capitel (no empate o fuste, mais justo, ficava com o mostrador, e a beirada do capitel,
    // pintada depois, o cobria).
    { forma: pe, z: zCapitel - ESPESSURA_DO_RELOGIO_DE_SOL, forca: 0.3 },
    { forma: capitel, z: zCapitel, solta: true, forca: 0.26 },
    { forma: gnomon, z: zCapitel + ESPESSURA_DO_RELOGIO_DE_SOL, solta: true, forca: 0.2 },
  )

  // ---------- o degrau de pedra e o musgo nas quinas ----------
  // O meio da caixa de cada metade vai para a beira do degrau, fora do capitel: senão ela subiria com ele.
  const beira = (RAIO_DO_DEGRAU + RAIO_DO_CAPITEL) * 0.5 * R
  const [tx, ty] = deLado(c.giro) ? [-beira, 0] : [0, -beira]
  L.push(P(comMeioEm(degrauDeTras, tx, ty), pedra, { tabua: 0, bisel: 1.8, tom: 0.9, contorno: 0.28, semente: 7401 }))
  L.push(P(comMeioEm(degrauDaFrente, -tx, -ty), pedra, { tabua: 0, bisel: 1.8, tom: 0.9, contorno: 0.28, semente: 7401 }))
  // Cada mancha é um tufo de três bolinhas de tamanhos diferentes, não uma moeda verde.
  MANCHAS_DE_MUSGO.forEach(([a, t], k) => {
    const r = RAIO_DO_DEGRAU * R * 0.88
    const mx = Math.cos(a) * r
    const my = Math.sin(a) * r
    for (let j = 0; j < 3; j += 1) {
      const da = (j - 1) * 0.09
      const rr = t * R * (j === 1 ? 0.8 : 0.55)
      const tufo = dentroDe(elipse(Math.cos(a + da) * r + (j - 1) * 0.6, Math.sin(a + da) * r, rr * 1.2, rr), degrau)
      L.push(P(comMeioEm(tufo, mx, my), MUSGO, { bisel: 0.5, contorno: 0.06, alfa: 0.9, tom: 0.9 + j * 0.06 + k * 0.03, semente: 7410 + k * 3 + j }))
    }
  })

  // ---------- o fuste (escondido de cima) e o capitel com a moldura ----------
  L.push(P(pe, pedra, { tabua: 0, bisel: RAIO_DO_FUSTE * R * 0.5, tom: 0.96, contorno: 0.24, semente: 7420 }))
  L.push(P(capitel, pedra, { tabua: 0, bisel: 2.2, tom: 1.04, contorno: 0.3, semente: 7421, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(elipse(0, 0, RAIO_DA_MOLDURA * R, RAIO_DA_MOLDURA * R), pedra, { tabua: 0, bisel: 1, tom: 0.92, contorno: 0.16, recesso: { k: 1.2, forca: 0.3 }, semente: 7422 }))

  // ---------- o mostrador: o disco, a borda alta e as linhas das horas em leque ----------
  const gnomonY = PE_DO_GNOMON * R
  L.push(P(elipse(0, 0, RAIO_DO_MOSTRADOR * R, RAIO_DO_MOSTRADOR * R), metal, { tabua: 0, bisel: 1.4, tom: 0.9, contorno: 0.32, metal: 0.32, semente: 7430, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(elipse(0, 0, RAIO_DA_BORDA_DO_MOSTRADOR * R, RAIO_DA_BORDA_DO_MOSTRADOR * R), metal, { tabua: 0, bisel: 0.8, tom: 1.06, contorno: 0.14, metal: 0.36, recesso: { k: 1.1, forca: 0.28 }, semente: 7431 }))
  for (let k = 0; k <= HORAS; k += 1) {
    // A linha do meio-dia fica debaixo do gnômon.
    if (k === HORAS / 2) continue
    const a = Math.PI + (k * Math.PI) / HORAS
    const de = (k % 3 === 0 ? HORA_DE_TRES_EM_TRES : HORA_DE) * R
    const co = Math.cos(a)
    const si = Math.sin(a)
    const linha = capsula(co * de, gnomonY * 0.4 + si * de, co * HORA_ATE * R, gnomonY * 0.4 + si * HORA_ATE * R, k % 3 === 0 ? 0.6 : 0.42)
    L.push(P(linha, VERDETE, { bisel: 0.3, contorno: 0.3, tom: 0.82, semente: 7440 + k }))
  }

  // ---------- o sol gravado na metade do sul ----------
  const sy = MEIO_DO_SOL * R
  for (let k = 0; k < RAIOS_DO_SOL; k += 1) {
    const a = (k * Math.PI * 2) / RAIOS_DO_SOL
    const de = (RAIO_DO_SOL + 0.03) * R
    const ate = de + RAIO_DO_RAIO * R
    L.push(P(capsula(Math.cos(a) * de, sy + Math.sin(a) * de, Math.cos(a) * ate, sy + Math.sin(a) * ate, 0.4), VERDETE, { bisel: 0.3, contorno: 0.26, tom: 0.86, semente: 7460 + k }))
  }
  L.push(P(elipse(0, sy, RAIO_DO_SOL * R, RAIO_DO_SOL * R), metal, { tabua: 0, bisel: RAIO_DO_SOL * R * 0.7, tom: 1.12, contorno: 0.3, metal: 0.4, semente: 7470 }))

  // ---------- a sombra do gnômon e a lâmina ----------
  // A cunha cai para baixo à direita da lâmina e se alarga para o norte, onde o gnômon é mais alto.
  const s = SOMBRA_DO_GNOMON * R
  const ponta = PONTA_DO_GNOMON * R
  const sombra = poligono([
    [MEIA_LAMINA, gnomonY],
    [MEIA_LAMINA, ponta],
    [MEIA_LAMINA + s, ponta + s * 0.78],
  ])
  L.push(P(sombra, ESCURO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.8, semente: 7480 }))
  L.push(P(lamina, metal, { eixo: Math.PI / 2, tabua: 0, bisel: MEIA_LAMINA, tom: 1.16, contorno: 0.38, metal: 0.45, semente: 7481 }))
  // O botão do pé do gnômon, onde as linhas se encontram (o meio dele fora da lâmina: fica no mostrador).
  L.push(P(elipse(0, gnomonY + 0.9, 1.5, 1.5), metal, { tabua: 0, bisel: 1.2, tom: 1.08, contorno: 0.3, metal: 0.45, semente: 7482 }))
}

/**
 * PRANCHA DO NAVIO de cima com volume (lote L08 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do mestre:
 * "prancha do navio"). A prancha que liga o convés ao cais (ou que sai pela borda, para o prisioneiro andar até o
 * fim): DUAS TÁBUAS compridas lado a lado, com as TRAVESSAS largas pregadas por cima para o pé não escorregar, e na
 * ponta do navio a DOBRADIÇA de ferro: o pino grosso atravessado, com as cabeças nas pontas, e as duas ferragens
 * rebitadas que seguram as tábuas nele. Perto da ponta solta, uma cinta de ferro fina; no meio das tábuas, o
 * caminho gasto pelos pés, mais claro; na ponta solta, as manchas de água.
 *
 * A 25% de zoom sobra a faixa de madeira inteira com as travessas claras de través e o pino escuro numa ponta: é o
 * que diz "prancha" e não "banco" (o banco tem encosto) nem "escada" (a escada de cerco tem o vão entre os dois
 * banzos e os degraus passam deles; aqui as tábuas são cheias e as travessas ficam dentro delas). Como a cerca e o
 * muro baixo, a prancha estica EM LINHA: o comprimento sai da largura da pegada e o número de travessas, do
 * comprimento; a largura das tábuas, as travessas e o ferro saem da altura. De partida, 2 x 0,5 casas. Material:
 * `madeira` (o carvalho de partida).
 *
 * Na 3/4 (derivado) as tábuas são uma coluna baixa, da grossura delas, e tudo o que está em cima delas sobe junto;
 * o pino da dobradiça é outra coluna, um pouco mais alta.
 */
import { hash } from '../../ruido'
import { caixa, capsula, elipse, poligono, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca, type Projecao } from './motor'
import { PREGO, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A grossura das tábuas e a altura do pino da dobradiça (as colunas na 3/4), em casas. */
const GROSSURA = 0.07
const ALTURA_DO_PINO = 0.09
/** A largura de cada tábua e a fresta entre elas, em fração da altura da pegada. */
const LARGURA_DA_TABUA = 0.42
const FRESTA = 0.012
/** Onde as tábuas começam (depois do pino) e acabam, em fração da altura a partir de cada ponta. */
const RECUO_DO_NAVIO = 0.2
const RECUO_DA_PONTA = 0.04
/** As travessas: a largura, o recuo da beira das tábuas e o passo entre elas, em fração da altura. */
const LARGURA_DA_TRAVESSA = 0.16
const RECUO_DA_TRAVESSA = 0.05
const PASSO_DAS_TRAVESSAS = 0.62
/** O pino da dobradiça: o raio, o das cabeças e o meio dele (fração da altura, a partir da ponta do navio). */
const RAIO_DO_PINO = 0.052
const RAIO_DA_CABECA = 0.064
const MEIO_DO_PINO = 0.1
/** As ferragens: o meio de cada uma (fração da meia altura), o comprimento e a largura (fração da altura). */
const FERRAGENS: readonly number[] = [-0.42, 0.42]
const COMPRIMENTO_DA_FERRAGEM = 0.62
const LARGURA_DA_FERRAGEM = 0.17
/** A cinta da ponta solta (largura em fração da altura). */
const CINTA_DA_PONTA = 0.09

const FERRO: MaterialDaPeca = materialDaPeca('ferro')
/** O caminho gasto: a madeira clareada pelos pés. */
const GASTO: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd2, 0xb4] }
/** A mancha de água na ponta solta: escura e fria. */
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x44, 0x40] }

/** A sombra que a travessa e o ferro fazem nas tábuas. */
const SOMBRA_DA_TRAVESSA: Projecao = { dist: 1.2, forca: 0.36, suave: 0.6 }

export const montarPranchaDoNavio: MontarMovel = (c, cena) => {
  const { hw, h, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const xi = -hw + h * RECUO_DO_NAVIO
  const xf = hw - h * RECUO_DA_PONTA
  const larg = h * LARGURA_DA_TABUA
  const fresta = h * FRESTA
  const beira = larg + fresta

  // As duas tábuas, cada uma com a ponta solta um pouco gasta (o canto redondo). A coluna da 3/4 é a prancha
  // inteira, fresta junto: o meio das travessas e do ferro cai na fresta, e eles têm de subir com as tábuas.
  const prancha = caixa(xi, -beira, xf, beira, 0.6)
  cena.sombras.push({ forma: prancha, z: c.g * GROSSURA, forca: 0.28 }, contato(prancha, 0.3))
  const tabuas: Forma[] = [caixa(xi, -beira, xf, -fresta, 0.6), caixa(xi, fresta, xf, beira, 0.6)]
  tabuas.forEach((t, i) => L.push(P(t, mad, { eixo: 0, tabua: 0, bisel: 1.1, contorno: 0.28, tom: i === 0 ? 1.04 : 0.95, semente: 8301 + i })))
  // O caminho gasto pelos pés, no meio, e a água que ficou na ponta solta.
  L.push(P(caixa(xi + h * 0.5, -larg * 0.55, xf - h * 0.3, larg * 0.55, larg * 0.5), GASTO, { bisel: 0, contorno: 0, alfa: 0.16, suave: larg * 0.5, semente: 8305 }))
  for (let i = 0; i < 3; i += 1) {
    const x = xf - h * (0.35 + 0.5 * hash(i, 1, 8306))
    const y = (hash(i, 2, 8306) - 0.5) * larg * 1.4
    L.push(P(elipse(x, y, h * (0.12 + 0.08 * hash(i, 3, 8306)), h * 0.07), MOLHADO, { bisel: 0, contorno: 0, alfa: 0.2, suave: h * 0.05, semente: 8307 + i }))
  }

  // As travessas, dentro das tábuas, um pouco tortas, com um prego em cada tábua.
  const comeco = xi + h * (COMPRIMENTO_DA_FERRAGEM + 0.3)
  const fim = xf - h * (CINTA_DA_PONTA + 0.42)
  const n = Math.max(2, Math.round((fim - comeco) / (h * PASSO_DAS_TRAVESSAS)) + 1)
  const meiaT = (h * LARGURA_DA_TRAVESSA) / 2
  const alto = beira - h * RECUO_DA_TRAVESSA
  for (let i = 0; i < n; i += 1) {
    const x = comeco + ((fim - comeco) * i) / (n - 1) + (hash(i, 4, 8310) - 0.5) * h * 0.04
    const torto = (hash(i, 5, 8310) - 0.5) * h * 0.06
    const travessa = poligono([[x - torto - meiaT, -alto], [x - torto + meiaT, -alto], [x + torto + meiaT, alto], [x + torto - meiaT, alto]])
    L.push(P(travessa, mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.3, tom: 1.14, projeta: SOMBRA_DA_TRAVESSA, semente: 8320 + i }))
    for (const y of [-larg * 0.55, larg * 0.55]) L.push(P(elipse(x + (torto * y) / alto, y, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.25, semente: 8340 + i }))
  }

  // A cinta fina perto da ponta solta, com os rebites.
  const porRebites = (x: number, ys: readonly number[], semente: number): void => {
    for (const y of ys) L.push(P(elipse(x, y, 0.7, 0.7), FERRO, { bisel: 0.5, tom: 1.2, contorno: 0.2, metal: 0.5, semente }))
  }
  const xc = xf - h * (CINTA_DA_PONTA / 2 + 0.12)
  L.push(P(caixa(xc - (h * CINTA_DA_PONTA) / 2, -beira + h * 0.02, xc + (h * CINTA_DA_PONTA) / 2, beira - h * 0.02, 0.4), FERRO, { eixo: QUARTO, bisel: 0.7, contorno: 0.3, metal: 0.3, projeta: SOMBRA_DA_TRAVESSA, semente: 8360 }))
  porRebites(xc, [-larg * 0.7, -larg * 0.25, larg * 0.25, larg * 0.7], 8361)

  // A dobradiça: as duas ferragens de ponta redonda sobre as tábuas e o pino atravessado, com as cabeças.
  const xp = -hw + h * MEIO_DO_PINO
  const lf = (h * LARGURA_DA_FERRAGEM) / 2
  FERRAGENS.forEach((fy, i) => {
    const y = fy * h
    const x1 = xp + h * COMPRIMENTO_DA_FERRAGEM
    // Ponta redonda: a ponta de lança das dobradiças de porta fazia a prancha ler como porta deitada.
    const ferragem = caixa(xp, y - lf, x1, y + lf, lf)
    L.push(P(ferragem, FERRO, { eixo: 0, bisel: 0.8, contorno: 0.3, metal: 0.32, projeta: SOMBRA_DA_TRAVESSA, semente: 8370 + i }))
    porRebites(xp + h * 0.28, [y], 8372 + i)
    porRebites(x1 - lf * 1.4, [y], 8374 + i)
  })
  const rp = h * RAIO_DO_PINO
  const rc = h * RAIO_DA_CABECA
  const pino = uniao(capsula(xp, -beira, xp, beira, rp), uniao(elipse(xp, -beira, rc, rc), elipse(xp, beira, rc, rc)))
  cena.sombras.push({ forma: pino, z: c.g * ALTURA_DO_PINO, forca: 0.3 }, contato(pino, 0.3))
  L.push(P(pino, FERRO, { eixo: QUARTO, bisel: rp, contorno: 0.32, metal: 0.5, projeta: SOMBRA_DA_TRAVESSA, semente: 8380 }))
  // Os nós da dobradiça em volta do pino, onde as ferragens enrolam nele.
  FERRAGENS.forEach((fy, i) => L.push(P(caixa(xp - rp * 1.25, fy * h - lf, xp + rp * 1.25, fy * h + lf, rp), FERRO, { bisel: rp, tom: 0.92, contorno: 0.3, metal: 0.5, semente: 8382 + i })))
}

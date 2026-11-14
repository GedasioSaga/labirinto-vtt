/**
 * SINO NO SUPORTE de cima com volume (lote L13 dos objetos novos, 14/11/2026,
 * grupo Cidade e vila): o sino de bronze da praça da vila, pendurado numa
 * armação de madeira. Nas duas pontas, a SAPATA deitada no chão de norte a
 * sul, o POSTE quadrado no meio dela e as duas ESCORAS inclinadas; em cima
 * dos postes, a TRAVE; debaixo dela, o SINO, preso por duas CINTAS de ferro.
 *
 * De cima o sino são anéis um dentro do outro: a coroa debaixo da trave, o
 * ombro, a cintura e, por fora, a BOCA que abre, com a beira clara. O verdete
 * em manchas no bronze velho diz "sino de sino" e não "panela". A 25% de
 * zoom sobram o disco de bronze cruzado pela trave e as duas pontas da
 * armação; a sombra comprida diz que tudo está no alto.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado, beirada de `ESPESSURA_DO_SINO`):
 * - o SINO é uma pilha de tampos soltos em anel, do mais largo e mais baixo
 *   (a boca) ao mais estreito e mais alto (a coroa), cada um a menos de uma
 *   beirada do outro: a frente sai em degraus finos, com a silhueta de sino.
 *   Cada anel tem a caixa com o meio nele mesmo (`comMeioEm`), senão subiria
 *   com a coroa, que contém o meio de todos;
 * - a TRAVE é um tampo solto um pouco acima da coroa. A forma dela leva um
 *   ponto sem tamanho na beira de baixo da pegada: a base dela fica a mais ao
 *   sul, e ela é pintada por último, por cima da coroa e do ombro;
 * - os POSTES são colunas; as SAPATAS vão em duas metades com o pé do poste
 *   recortado (a regra do pilar), e as ESCORAS, em fatias finas, cada uma um
 *   tampo solto na altura dela (a regra do balanço).
 * O desenho não lê `c.giro`: girado um quarto de volta, as fatias das escoras
 * correm de lado na tela e saem em degraus (como no balanço antes da conta
 * dele).
 *
 * Materiais: `madeira` (a armação) e `sino` (o bronze; latão de partida). O
 * ferro das cintas e o verdete são fixos. As medidas da armação saem da
 * pegada (1,5 x 1 casa de partida) e as do sino, do menor lado.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, dentroDe, elipse, menos, uniao, type Caixa, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

// ---------- a armação, em frações da meia pegada e em casas ----------

/** Onde ficam os postes (fração da meia largura) e até onde vai a trave. */
const LINHA_DOS_POSTES = 0.8
const PONTA_DA_TRAVE = 0.93
/** A sapata vai até esta fração da meia altura; as escoras saem dela aqui e chegam no poste ali. */
const PONTA_DA_SAPATA = 0.86
const PE_DA_ESCORA = 0.74
const TOPO_DA_ESCORA = 0.16
/** As meias larguras, em casas: o poste, a sapata, a escora e a trave. */
const MEIO_POSTE = 0.065
const MEIA_SAPATA = 0.05
const MEIA_ESCORA = 0.032
const MEIA_TRAVE = 0.06
/** As alturas, em casas: a sapata, onde a escora chega no poste, o alto do poste e o da trave. */
const ALTURA_DA_SAPATA = 0.07
const ALTURA_DO_TOPO_DA_ESCORA = 0.72
const ALTURA_DO_POSTE = 1.38
const ALTURA_DA_TRAVE = 1.32
/** Fatias de cada escora (a 3/4 sobe cada uma na altura dela). */
const FATIAS_DA_ESCORA = 8

// ---------- o sino ----------

/** O raio da boca, em casas. */
const RAIO_DA_BOCA = 0.36
/**
 * Os anéis do sino, de baixo para cima: a boca, a cintura e a coroa, cada um com o raio de fora (fração da boca)
 * e a altura do alto (casas). Os degraus de altura não passam da beirada (0,17 casa), para a frente da 3/4 sair
 * inteira. Com seis anéis finos a 3/4 saía listrada como uma mola.
 */
const ANEIS: readonly (readonly [number, number])[] = [
  [1, 0.9],
  [0.74, 1.07],
  [0.5, 1.24],
]
/** O tom de cada anel visto de cima: a boca larga pega luz, a cintura (quase de pé) menos, a coroa (o domo) mais. */
const TONS_DOS_ANEIS: readonly number[] = [1, 0.84, 1.1]
/** O chanfro de cada anel (px do protótipo): largo, para o bronze sair arredondado e não em degraus. */
const BISEIS_DOS_ANEIS: readonly number[] = [2.6, 2.2, 3.2]
/** A beirada dos tampos soltos na 3/4 (px do protótipo): um degrau do sino, a grossura da trave. */
export const ESPESSURA_DO_SINO = 0.17 * G
/** O bronze velho é mais escuro que o latão novo da tabela (a luz multiplicada). */
const TOM_DO_BRONZE = 0.86
/** O ponto que as estruturas do sino levam (px do protótipo): o raio dele e o quanto fica além da boca. */
const PONTO_SEM_TAMANHO = 0.05
const PONTO_ALEM_DA_BOCA = 0.5
/** A madeira de dentro nas pontas cortadas da trave (o cerne claro dos destroços) e a largura do corte (px). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.35
const PONTA_CORTADA = 2.4

// ---------- os materiais fixos ----------

const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.86)) }
/** O verdete do bronze velho. */
const VERDETE: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x8e, 0x7b] }
/** As manchas de verdete: o ângulo, a distância ao meio (fração da boca) e o tamanho. */
const MANCHAS_DE_VERDETE: readonly (readonly [number, number, number])[] = [
  [-2.4, 0.66, 0.16],
  [-0.4, 0.82, 0.12],
  [2.0, 0.9, 0.1],
  [1.1, 0.56, 0.1],
  [3.0, 0.88, 0.09],
]

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

export const montarSinoNoSuporte: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const bronze = c.m.sino
  const L = cena.partes
  const S = cena.sombras
  const casa = Math.min(g, c.h, c.w)
  const rb = RAIO_DA_BOCA * casa
  const xPoste = LINHA_DOS_POSTES * hw
  const ySapata = PONTA_DA_SAPATA * hh
  const mp = MEIO_POSTE * g
  const ms = MEIA_SAPATA * g
  const me = MEIA_ESCORA * g
  const mt = MEIA_TRAVE * g

  // ---------- as duas pontas da armação: a sapata em metades, as escoras em fatias e o poste ----------
  for (const lado of [-1, 1]) {
    const x = lado * xPoste
    const pe = caixa(x - mp, -mp, x + mp, mp, 0.6)
    const sapata = caixa(x - ms, -ySapata, x + ms, ySapata, 1.2)
    const metades = [dentroDe(menos(sapata, pe), caixa(x - 99, -99, x + 99, 0)), dentroDe(menos(sapata, pe), caixa(x - 99, 0, x + 99, 99))]
    for (const metade of metades) S.push({ forma: metade, z: ALTURA_DA_SAPATA * g, forca: 0.3 })
    S.push(contato(sapata, 0.32))
    // O meio da caixa de cada metade vai para a ponta da sapata, além do pé da escora: senão subia com ela.
    const ponta = (PONTA_DA_SAPATA + PE_DA_ESCORA) * 0.5 * hh
    metades.forEach((metade, k) => L.push(P(comMeioEm(metade, x, (k === 0 ? -1 : 1) * ponta), mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.84, contorno: 0.28, semente: 7501 + lado + k * 3 })))

    // As escoras, do pé (na sapata) ao poste, em fatias: cada uma um tampo solto na altura do meio dela. Cada
    // fatia pinta a escora inteira, só dentro da caixa dela: sem contorno no corte (de cima, uma tábua só).
    for (const sentido of [-1, 1]) {
      const y0 = sentido * PE_DA_ESCORA * hh
      const y1 = sentido * (mp + TOPO_DA_ESCORA * 0.2 * hh)
      const escora = caixa(x - me, Math.min(y0, y1), x + me, Math.max(y0, y1), 0.6)
      for (let i = 0; i < FATIAS_DA_ESCORA; i += 1) {
        const a = y0 + ((y1 - y0) * i) / FATIAS_DA_ESCORA
        const b = y0 + ((y1 - y0) * (i + 1)) / FATIAS_DA_ESCORA
        const z = (ALTURA_DA_SAPATA + ((ALTURA_DO_TOPO_DA_ESCORA - ALTURA_DA_SAPATA) * (i + 0.5)) / FATIAS_DA_ESCORA) * g
        const corte: Caixa = [x - me - 1, Math.min(a, b) - 0.35, x + me + 1, Math.max(a, b) + 0.35]
        const fatia = caixa(corte[0] + 1, corte[1], corte[2] - 1, corte[3], 0.4)
        S.push({ forma: fatia, z, solta: true, forca: 0.16 })
        L.push(P({ b: corte, d: escora.d }, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: 1.02, contorno: 0.24, semente: 7510 + lado * 20 + sentido * 9 }))
      }
    }

    S.push({ forma: pe, z: ALTURA_DO_POSTE * g, forca: 0.3 }, contato(pe, 0.34))
    L.push(P(pe, mad, { tabua: 0, bisel: 1.4, tom: 1.06, contorno: 0.3, semente: 7550 + lado, projeta: { dist: 1.2, forca: 0.35 } }))
  }

  // ---------- o sino: os discos da boca à coroa, cada um com o meio da caixa na faixa dele ----------
  // Cada disco é inteiro (de cima, o chanfro só na beira de fora: bronze arredondado, não roscas). Para a 3/4
  // pintar a coroa por cima da boca, as três estruturas levam o mesmo ponto sem tamanho na beira de baixo do sino:
  // com a mesma base, sai primeiro a mais baixa (a boca) e por último a mais alta (a coroa).
  const faixaDoAnel = (k: number): Forma => {
    const r = ANEIS[k][0] * rb
    const dentro = k + 1 < ANEIS.length ? ANEIS[k + 1][0] * rb : 0
    return dentro > 0 ? anel(0, 0, r, r, dentro, dentro) : elipse(0, 0, r, r)
  }
  const meioDoAnel = (k: number): number => (ANEIS[k][0] * rb + (k + 1 < ANEIS.length ? ANEIS[k + 1][0] * rb : 0)) / 2
  const baseDoSino = elipse(0, rb + PONTO_ALEM_DA_BOCA, PONTO_SEM_TAMANHO, PONTO_SEM_TAMANHO)
  ANEIS.forEach(([fr, alto], k) => {
    const disco = elipse(0, 0, fr * rb, fr * rb)
    S.push({ forma: uniao(faixaDoAnel(k), baseDoSino), z: alto * g, solta: true, forca: 0.22 })
    L.push(P(comMeioEm(disco, 0, meioDoAnel(k)), bronze, { tabua: 0, bisel: BISEIS_DOS_ANEIS[k], tom: TONS_DOS_ANEIS[k] * TOM_DO_BRONZE, contorno: k === 0 ? 0.34 : 0.14, metal: 0.4, semente: 7560 + k, projeta: { dist: 1.1, forca: 0.26 } }))
  })
  // A beira da boca, mais clara: o lábio grosso que o badalo bate.
  L.push(P(comMeioEm(anel(0, 0, rb, rb, rb * 0.93, rb * 0.93), 0, rb * 0.965), bronze, { tabua: 0, bisel: 0.8, tom: 1.2 * TOM_DO_BRONZE, contorno: 0.12, metal: 0.5, semente: 7570 }))
  // O verdete em manchas, cada uma cortada no anel em que está (sobe com ele na 3/4).
  MANCHAS_DE_VERDETE.forEach(([a, d, t], k) => {
    const mx = Math.cos(a) * d * rb
    const my = Math.sin(a) * d * rb
    const noAnel = ANEIS.findIndex((_, i) => i + 1 === ANEIS.length || ANEIS[i + 1][0] <= d)
    const mancha = dentroDe(elipse(mx, my, t * rb * 1.3, t * rb), faixaDoAnel(noAnel))
    L.push(P(comMeioEm(mancha, mx, my), VERDETE, { bisel: 0.4, contorno: 0, alfa: 0.55 + hash(k, 2, 7571) * 0.2, suave: 1.1, semente: 7572 + k }))
  })

  // ---------- a trave por cima de tudo, com as cintas de ferro que seguram o sino ----------
  const xt = PONTA_DA_TRAVE * hw
  // O ponto sem tamanho na beira de baixo põe a base da trave mais ao sul que a do sino: ela sai por último na 3/4.
  const trave = uniao(caixa(-xt, -mt, xt, mt, 1), elipse(0, hh - PONTO_ALEM_DA_BOCA, PONTO_SEM_TAMANHO, PONTO_SEM_TAMANHO))
  S.push({ forma: trave, z: ALTURA_DA_TRAVE * g, solta: true, forca: 0.3 })
  L.push(P(comMeioEm(caixa(-xt, -mt, xt, mt, 1), 0, 0), mad, { tabua: 0, bisel: 1.5, tom: 1.04, contorno: 0.3, semente: 7580, projeta: { dist: 1.6, forca: 0.4 } }))
  for (const lado of [-1, 1]) {
    const cx = lado * rb * 0.3
    L.push(P(caixa(cx - 1.3, -mt - 1.1, cx + 1.3, mt + 1.1, 0.5), FERRO, { tabua: 0, bisel: 0.7, tom: 0.9, contorno: 0.34, metal: 0.3, semente: 7585 + lado }))
    L.push(P(elipse(cx, 0, 0.7, 0.7), FERRO, { bisel: 0.5, contorno: 0.3, tom: 1.2, metal: 0.4, semente: 7588 + lado }))
  }
  // As pontas da trave cortadas, mais claras.
  const cerne: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  for (const lado of [-1, 1]) {
    const de = lado * (xt - PONTA_CORTADA)
    L.push(P(caixa(Math.min(de, lado * xt), -mt + 0.5, Math.max(de, lado * xt), mt - 0.5, 0.4), cerne, { tabua: 0, bisel: 0.5, contorno: 0.16, semente: 7590 + lado }))
  }
}

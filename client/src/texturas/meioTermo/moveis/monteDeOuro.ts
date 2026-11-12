/**
 * MONTE DE OURO de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do mestre:
 * "coloque Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): a "poça" de ouro, o tesouro
 * despejado no chão. BARRAS de fundição jogadas umas por cima das outras, cada uma num rumo, com PEPITAS e uns
 * pedaços de MINÉRIO (rocha escura com veio de ouro) entre elas; mais alto no meio e se espalhando para a beira
 * num contorno IRREGULAR, com duas barras e umas pepitas soltas fora do monte.
 *
 * Não é a pilha de lingotes do ferreiro (`pilhaDeLingotes.ts`, barras de ferro arrumadas em camadas cruzadas
 * num estrado): aqui é ouro sem ordem nenhuma. Nem o monte de moedas (`monteDeMoedasDeOuro.ts`), que é de
 * discos miúdos: aqui o que se lê de longe são os retângulos claros das barras e o caroçado das pepitas.
 *
 * Três camadas, cada uma com a MASSA de ouro por baixo (o vão escuro, com pintas de ouro enterrado): a BEIRA, o
 * ANEL do meio e o MIOLO, cada uma fazendo sombra na de baixo. As barras são as de `tesouroDeOuro.ts` (a mesma
 * da barra de ouro sozinha, menores), e duas das de cima têm a marca de punção.
 *
 * É OBJETO DE CHÃO COM ALTURA (o mestre põe um baú, um trono ou uma ficha em cima): na 3/4 (derivada, sem
 * beirada: `espessura: 0`) o anel e o miolo sobem em dois degraus baixos, o flanco de cada degrau é a massa de
 * baixo, escura e riscada de quinas, e as duas barras soltas ficam deitadas, sem altura (a sombra delas é
 * pintada no chão), como a barra sozinha. Lê
 * `c.giro` para a luz das rampas e as quinas do flanco ficarem certas NA TELA. Escreve `cena.corDoPiso`.
 *
 * Esticado, o contorno estica com a pegada e as barras, as pepitas e o minério NÃO esticam: têm o tamanho de
 * desenho e se repetem (mais barras, nunca barras compridas). A pegada de partida é 1,5 x 1 casa. Sem material
 * no painel; sem luz.
 */
import { hash } from '../../ruido'
import type { Forma, Ponto } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'
import {
  baseDaBarra,
  comMeioEm,
  contornoDoMonte,
  declararAlturas,
  deslocada,
  desgirado,
  encolhida,
  espalhar,
  ESCURO_DO_OURO,
  MASSA_DO_OURO,
  meioDaCamada,
  paraALuz,
  pintarBarraDeOuro,
  pintarBrilho,
  pintarMinerio,
  pintarPepita,
  texDaMassa,
  type BarraDeOuro,
  type CamadasDoMonte,
  type Lobulo,
} from './tesouroDeOuro'

// ---------- o contorno e as alturas ----------

/** Os lóbulos do monte: meio e raios em frações da meia pegada (esticam com ela). */
const LOBULOS: readonly Lobulo[] = [
  [0.02, 0.0, 0.64, 0.62],
  [-0.46, 0.14, 0.34, 0.44],
  [0.42, -0.1, 0.36, 0.46],
  [-0.16, -0.4, 0.34, 0.3],
  [0.22, 0.42, 0.34, 0.3],
  [-0.56, -0.24, 0.2, 0.26],
]
/** O pico (frações da meia pegada): um pouco para a direita e para o fundo. */
const PICO: Ponto = [0.06, -0.08]
const FATOR_DO_MEIO = 0.64
const FATOR_DO_MIOLO = 0.34
const ONDA = 1.8
/** As alturas da 3/4 (casas): as barras são mais grossas que as moedas, o monte sobe um pouco mais. */
const ALTURA_DO_MEIO = 0.05
const ALTURA_DO_MIOLO = 0.11

// ---------- as peças ----------

/** A barra do monte (casas): meio comprimento e meia largura, fixos (o monte esticado ganha barras). */
const MEIO_COMPRIMENTO = 0.15
const MEIA_LARGURA = 0.066
/** O passo da grade de barras de cada camada (casas) e o quanto cada uma sai do lugar (fração do passo). */
const PASSO_DAS_BARRAS = 0.2
const PASSO_DAS_BARRAS_DO_MIOLO = 0.17
const SACODE_DAS_BARRAS = 0.36
/** As pepitas: o passo da grade (casas), o raio (casas, do menor ao maior) e o quanto saem do lugar. */
const PASSO_DAS_PEPITAS = 0.075
const RAIO_DA_PEPITA = 0.03
const RAIO_DA_PEPITA_A_MAIS = 0.02
const SACODE_DAS_PEPITAS = 0.4
/** A beira rareia: perto do contorno só fica esta fração das pepitas (a beira inteira leva tantas meias larguras). */
const FICA_NA_BEIRA = 0.45
const FUNDO_DA_BEIRA = 2.2
/** A sombra que cada barra faz nas de baixo (px), e a da massa de cada camada na de baixo. */
const PROJECAO_DA_BARRA = 1.1
const PROJECAO_DA_CAMADA = { dist: 1.7, forca: 0.32, suave: 1.3 } as const
/** A massa acaba antes do contorno (px): fica debaixo das peças da beira, e o chão aparece entre elas. */
const RECUO_DA_MASSA = 4

/** Os pedaços de minério: meio (frações da meia pegada) e raio (casas). */
const MINERIOS: readonly (readonly [number, number, number])[] = [
  [-0.62, 0.3, 0.085],
  [0.52, 0.38, 0.08],
  [-0.12, -0.5, 0.075],
  [0.26, -0.18, 0.07],
]
/** As barras soltas fora do monte: meio (frações da meia pegada) e rumo; as pepitas soltas: meio e raio (casas). */
const BARRAS_SOLTAS: readonly (readonly [number, number, number])[] = [
  [0.78, 0.66, 0.5],
  [-0.84, -0.66, -0.3],
]
const PEPITAS_SOLTAS: readonly (readonly [number, number, number])[] = [
  [-0.9, 0.56, 0.03],
  [0.92, -0.42, 0.028],
  [0.36, 0.9, 0.026],
  [-0.3, -0.88, 0.032],
  [0.64, -0.82, 0.024],
]
/** A sombra curta das barras soltas, pintada no chão (px): sem altura, ficam deitadas na 3/4, como a barra sozinha. */
const SOMBRA_DA_SOLTA: Ponto = [1.2, 0.95]
/** Quantas barras de cima levam a marca de punção, e os brilhos em estrela (quantos e o tamanho, casas). */
const MARCADAS = 2
const BRILHOS = 7
const RAIO_DO_BRILHO = 0.05

const SOMBRA_DO_MONTE: Ponto = [2.6, 2]
const FORCA_DA_SOMBRA_DO_MONTE = 0.26

export const montarMonteDeOuro: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const luz = paraALuz(c.giro)
  const vertical = desgirado(0, 1, c.giro)
  const sorteio = Math.round(c.w * 3 + c.h * 7)
  const [a, b] = [g * MEIO_COMPRIMENTO, g * MEIA_LARGURA]
  cena.corDoPiso = ESCURO_DO_OURO

  const camadas: CamadasDoMonte = {
    tudo: contornoDoMonte(LOBULOS, hw, hh, PICO, 1, ONDA, 2.3),
    meio: contornoDoMonte(LOBULOS, hw, hh, PICO, FATOR_DO_MEIO, ONDA, 6.1),
    miolo: contornoDoMonte(LOBULOS, hw, hh, PICO, FATOR_DO_MIOLO, ONDA, 9.7),
  }
  const { tudo, meio, miolo } = camadas
  const [px, py] = [PICO[0] * hw, PICO[1] * hh]

  cena.sombras.push(contato(tudo, 0.3), { forma: deslocada(encolhida(tudo, 2), SOMBRA_DO_MONTE[0], SOMBRA_DO_MONTE[1]), z: 0, suave: 2.6, forca: FORCA_DA_SOMBRA_DO_MONTE })
  declararAlturas(cena, camadas, g * ALTURA_DO_MEIO, g * ALTURA_DO_MIOLO)

  /** Uma barra no lugar, sorteada: o rumo, o tom e um tico de tamanho. */
  const barraNoLugar = ([x, y]: Ponto, i: number, semente: number): BarraDeOuro => ({
    x,
    y,
    ang: hash(i, semente, 77) * Math.PI,
    a: a * (0.92 + 0.16 * hash(i, semente, 78)),
    b: b * (0.94 + 0.12 * hash(i, semente, 79)),
    tom: 0.9 + 0.2 * hash(i, semente, 80),
    marca: false,
    projeta: PROJECAO_DA_BARRA,
    semente: semente + i * 30,
  })
  const pepitas = (regiao: Forma, semente: number, rarear: boolean): void => {
    espalhar(regiao, g * PASSO_DAS_PEPITAS, g * PASSO_DAS_PEPITAS * SACODE_DAS_PEPITAS, semente + sorteio)
      .filter(([x, y]) => !rarear || hash(x * 3.7, y * 9.1, semente) < FICA_NA_BEIRA + (1 - FICA_NA_BEIRA) * Math.min(1, -tudo.d(x, y) / (b * FUNDO_DA_BEIRA)))
      .forEach(([x, y], i) => pintarPepita(P, cena, x, y, g * (RAIO_DA_PEPITA + RAIO_DA_PEPITA_A_MAIS * hash(i, semente, 81)), 0.9 + 0.2 * hash(i, semente, 82), semente + 1000 + i))
  }
  const barras = (regiao: Forma, passo: number, semente: number): BarraDeOuro[] =>
    espalhar(regiao, g * passo, g * passo * SACODE_DAS_BARRAS, semente + sorteio).map((p, i) => barraNoLugar(p, i, semente))

  // As soltas fora do monte: no chão, por baixo de tudo, com a sombra pintada (sem altura).
  PEPITAS_SOLTAS.forEach(([fx, fy, r], i) => cena.sombras.push(contato(pintarPepita(P, cena, fx * hw, fy * hh, g * r, 1, 6000 + i), 0.32)))
  BARRAS_SOLTAS.forEach(([fx, fy, rumo], i) => {
    const barra: BarraDeOuro = { x: fx * hw, y: fy * hh, ang: rumo, a, b, tom: 1, marca: false, projeta: 0, semente: 6100 + i * 30 }
    const base = baseDaBarra(barra)
    cena.sombras.push(contato(base, 0.32), { forma: deslocada(base, SOMBRA_DA_SOLTA[0], SOMBRA_DA_SOLTA[1]), z: 0, suave: 1.2, forca: 0.28 })
    pintarBarraDeOuro(P, cena, barra, luz)
  })

  // A beira: a massa (que acaba antes do contorno), as pepitas no chão, as barras por cima e o minério por cima delas.
  // O meio da caixa da massa cai na beira de TUDO, fora do anel (na faixa da massa recuada podia não caber).
  const massa0 = encolhida(tudo, RECUO_DA_MASSA)
  const [m0x, m0y] = meioDaCamada(tudo, meio, px, py, 1)
  L.push(P(comMeioEm(massa0, m0x, m0y), MASSA_DO_OURO, { bisel: 0, contorno: 0, suave: 1.2, textura: texDaMassa(meio, vertical), semente: 6200 }))
  const naBeira = { b: tudo.b, d: (x: number, y: number) => Math.max(tudo.d(x, y), -meio.d(x, y) - b) }
  pepitas(naBeira, 6300, true)
  barras(encolhida(naBeira, b * 0.5), PASSO_DAS_BARRAS, 6500).forEach((barra) => pintarBarraDeOuro(P, cena, barra, luz))
  MINERIOS.slice(0, 2).forEach(([fx, fy, r], i) => pintarMinerio(P, cena, fx * hw, fy * hh, g * r, 6400 + i * 10))

  // O anel do meio: a massa, com a sombra dela na beira, as pepitas, as barras e o minério.
  const [m1x, m1y] = meioDaCamada(meio, miolo, px, py, 1)
  L.push(P(comMeioEm(meio, m1x, m1y), MASSA_DO_OURO, { bisel: 0, contorno: 0, suave: 1, tom: 1.04, textura: texDaMassa(miolo, vertical), projeta: PROJECAO_DA_CAMADA, semente: 6201 }))
  const noMeio = { b: meio.b, d: (x: number, y: number) => Math.max(meio.d(x, y), -miolo.d(x, y) - b) }
  pepitas(noMeio, 6600, false)
  barras(noMeio, PASSO_DAS_BARRAS, 6800).forEach((barra) => pintarBarraDeOuro(P, cena, barra, luz))
  MINERIOS.slice(2, 3).forEach(([fx, fy, r], i) => pintarMinerio(P, cena, fx * hw, fy * hh, g * r, 6700 + i * 10))

  // O miolo: a massa, as pepitas, as barras de cima, cruzadas, duas com a marca de punção, e o último minério.
  const [m2x, m2y] = meioDaCamada(miolo, null, px, py, 1)
  L.push(P(comMeioEm(miolo, m2x, m2y), MASSA_DO_OURO, { bisel: 0, contorno: 0, suave: 1, tom: 1.08, textura: texDaMassa(null, vertical), projeta: PROJECAO_DA_CAMADA, semente: 6202 }))
  pepitas(miolo, 6900, false)
  const topo = barras(miolo, PASSO_DAS_BARRAS_DO_MIOLO, 7100)
  topo.forEach((barra, i) => pintarBarraDeOuro(P, cena, { ...barra, marca: i >= topo.length - MARCADAS }, luz))
  MINERIOS.slice(3).forEach(([fx, fy, r], i) => pintarMinerio(P, cena, fx * hw, fy * hh, g * r, 7000 + i * 10))
  // Os brilhos: nas quinas das barras de cima e do anel, do lado da luz.
  topo.slice(0, BRILHOS).forEach((barra, i) => {
    const ponta = (i % 2 === 0 ? 1 : -1) * barra.a * 0.7
    pintarBrilho(P, cena, barra.x + Math.cos(barra.ang) * ponta + luz[0] * barra.b * 0.4, barra.y + Math.sin(barra.ang) * ponta + luz[1] * barra.b * 0.4, g * RAIO_DO_BRILHO, 7300 + i)
  })
}

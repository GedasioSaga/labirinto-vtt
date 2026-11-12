/**
 * MONTE DE MOEDAS DE OURO de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do
 * mestre: "coloque Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): a "poça" de moedas,
 * o tesouro derramado no chão. Centenas de moedas: mais fundo e mais alto no meio, rareando para a beira num
 * contorno IRREGULAR (lóbulos de beira ondulada, como o sangue no chão), com moedas soltas em volta e duas
 * rolando para fora, de quina.
 *
 * Três camadas, cada uma com a MASSA de ouro por baixo (o vão entre as moedas, escuro, com pintas de ouro
 * enterrado): a BEIRA, de moedas inteiras e legíveis (o desenho da moeda única, menor: a borda em cordão, o
 * sulco e o relevo do meio), quase deitadas e cada vez mais raras para fora; o ANEL do meio e o MIOLO, de moedas
 * inclinadas em todo rumo (a elipse de cada uma é o que tira o monte da escama de peixe), com as PILHINHAS
 * tombadas em leque, as moedas DE QUINA (quase de pé) e os BRILHOS em estrela salpicados por cima. Cada camada faz
 * sombra na de baixo, do lado de lá da luz.
 *
 * É OBJETO DE CHÃO COM ALTURA (o mestre põe um baú, um trono ou uma ficha em cima): na 3/4 (derivada, sem
 * beirada: `espessura: 0`) o anel e o miolo sobem em dois degraus baixos, e o flanco de cada degrau é a massa
 * de baixo, escura e riscada de quinas de moeda (`tesouroDeOuro.ts`). Lê `c.giro` para a luz pintada e as
 * quinas do flanco ficarem certas NA TELA. Escreve `cena.corDoPiso` (o escuro do ouro).
 *
 * Esticado, o contorno estica com a pegada (lóbulos em frações dela) e as moedas NÃO esticam: têm o tamanho de
 * desenho e se repetem, mais moedas e nunca moedas ovais. A pegada de partida é 1,5 x 1 casa. Sem material no
 * painel; sem luz.
 */
import { hash } from '../../ruido'
import type { Ponto } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'
import {
  contornoDoMonte,
  declararAlturas,
  deslocada,
  desgirado,
  encolhida,
  espalhar,
  ESCURO_DO_OURO,
  formaDaMoeda,
  MASSA_DO_OURO,
  meioDaCamada,
  paraALuz,
  pintarBrilho,
  pintarMoedaDeOuro,
  texDaMassa,
  comMeioEm,
  type CamadasDoMonte,
  type DetalheDaMoeda,
  type Lobulo,
  type MoedaDeOuro,
} from './tesouroDeOuro'

// ---------- o contorno e as alturas ----------

/** Os lóbulos do monte: meio e raios em frações da meia pegada (esticam com ela). */
const LOBULOS: readonly Lobulo[] = [
  [-0.06, 0.02, 0.66, 0.68],
  [-0.48, -0.14, 0.38, 0.44],
  [0.4, 0.12, 0.4, 0.48],
  [0.1, -0.4, 0.38, 0.34],
  [-0.26, 0.46, 0.32, 0.32],
  [0.52, -0.28, 0.24, 0.28],
]
/** O pico do monte (frações da meia pegada): um pouco para o fundo à esquerda, para não sair um alvo. */
const PICO: Ponto = [-0.08, -0.06]
/** O anel do meio e o miolo: o contorno encolhido em volta do pico. */
const FATOR_DO_MEIO = 0.66
const FATOR_DO_MIOLO = 0.36
/** A beira ondulada do contorno (px). */
const ONDA = 1.6
/** As alturas da 3/4 (casas): o anel do meio e o miolo. Monte baixo, não montanha. */
const ALTURA_DO_MEIO = 0.04
const ALTURA_DO_MIOLO = 0.09

// ---------- as moedas ----------

/** O raio da moeda do monte (casas): fixo, para o monte esticado ganhar moedas e não moedas ovais. */
const RAIO = 0.058
/** O tom de cada moeda, sorteado: um pouco abaixo da moeda única (miúdas e claras, liam biscoito, não metal). */
const TOM_MINIMO = 0.84
const TOM_A_MAIS = 0.22
/** O passo da grade de cada camada (em raios) e o quanto cada moeda sai do lugar: mais apertado no miolo. */
const PASSO_DA_BEIRA = 1.45
const PASSO_DO_MEIO = 1.4
const PASSO_DO_MIOLO = 1.34
const SACODE = 0.42
/** A beira rareia: perto do contorno só fica esta fração das moedas, e a beira inteira leva tantos raios. */
const FICA_NA_BEIRA = 0.38
const FUNDO_DA_BEIRA = 2.4
/** O quanto a moeda de cada camada pode estar inclinada (o achatado mínimo): a da beira quase deitada, a do miolo em todo rumo. */
const ACHATADO_DA_BEIRA = 0.76
const ACHATADO_DO_MEIO = 0.5
const ACHATADO_DO_MIOLO = 0.42
/** A sombra que cada moeda faz nas de baixo (px), e a da massa de cada camada na camada de baixo. */
const PROJECAO_DA_MOEDA = 0.6
const PROJECAO_DA_CAMADA = { dist: 1.5, forca: 0.32, suave: 1.3 } as const
/** A massa acaba antes do contorno (raios), já onde a beira está cheia: entre as moedas raras da beira aparece o chão, e não uma auréola de lama. */
const RECUO_DA_MASSA = 2.6

/** As pilhinhas tombadas em leque: o pé (frações da meia pegada), o rumo, quantas moedas e o passo (raios). */
const PILHINHAS: readonly (readonly [number, number, number, number])[] = [
  [-0.3, 0.06, -0.5, 5],
  [0.16, -0.22, 2.5, 4],
  [0.28, 0.3, 0.9, 4],
]
const PASSO_DA_PILHINHA = 0.42
const ACHATADO_DA_PILHINHA = 0.56
/**
 * As moedas de quina, quase de pé (a elipse fininha de uma moeda inclinada é o que se vê de cima; a fatia de
 * uma moeda de pé a prumo lia como palito): o meio (frações da meia pegada) e o rumo. O achatado e a sombra (px).
 */
const DE_QUINA: readonly (readonly [number, number, number])[] = [
  [-0.04, -0.22, 0.4],
  [-0.22, 0.24, 2.1],
  [0.14, 0.06, 1.2],
  [0.44, -0.06, -0.3],
]
const ACHATADO_DE_QUINA = 0.32
const PROJECAO_DE_QUINA = 1.2
/** As soltas em volta: o meio (frações da meia pegada); e as duas que rolam para fora, de quina (meio e rumo). */
const SOLTAS: readonly Ponto[] = [
  [-0.9, -0.36],
  [-0.78, 0.66],
  [-0.46, -0.84],
  [0.14, 0.88],
  [0.62, 0.74],
  [0.9, 0.3],
  [0.82, -0.62],
  [0.3, -0.86],
]
const ROLANDO: readonly (readonly [number, number, number])[] = [
  [0.92, -0.08, 0.15],
  [-0.62, 0.86, 1.9],
]
/** Os brilhos em estrela: quantos, espalhados pelo monte (uma moeda a cada tantas leva), e o tamanho (raios). */
const BRILHOS = 6
const UMA_A_CADA = 9
const RAIO_DO_BRILHO = 0.55

/** A sombra do monte no chão, pintada (sem altura): o quanto ela anda (px) e a força. */
const SOMBRA_DO_MONTE: Ponto = [2.2, 1.7]
const FORCA_DA_SOMBRA_DO_MONTE = 0.24

/** Uma moeda da camada, sorteada pelo lugar: o tamanho, o achatado, o rumo e o tom mudam de moeda para moeda. */
function moedaNoLugar([x, y]: Ponto, r: number, achatadoMinimo: number, detalhe: DetalheDaMoeda, semente: number): MoedaDeOuro {
  return {
    x,
    y,
    r: r * (0.86 + 0.28 * hash(x * 7.1, y * 3.3, semente)),
    achatado: achatadoMinimo + (1 - achatadoMinimo) * hash(x * 2.3, y * 5.9, semente + 1),
    ang: hash(x * 4.7, y * 1.9, semente + 2) * Math.PI,
    tom: TOM_MINIMO + TOM_A_MAIS * hash(x * 3.1, y * 6.7, semente + 3),
    detalhe,
    projeta: PROJECAO_DA_MOEDA,
    semente: semente + Math.round(hash(x, y, semente + 4) * 997),
  }
}

/** As moedas de uma camada em ordem sorteada (a de cima é qualquer uma, como no monte de verdade). */
function embaralhadas(moedas: MoedaDeOuro[], semente: number): MoedaDeOuro[] {
  return moedas
    .map((m) => ({ m, k: hash(m.x * 13.7, m.y * 7.3, semente) }))
    .sort((a, b) => a.k - b.k)
    .map(({ m }) => m)
}

/** A moeda de quina, quase de pé: a elipse fininha, mais clara (pega a luz de frente), com a sombra mais comprida nas de baixo. */
function moedaDeQuina(x: number, y: number, r: number, rumo: number, semente: number): MoedaDeOuro {
  return { x, y, r, achatado: ACHATADO_DE_QUINA, ang: rumo, tom: 1.06, detalhe: 'beira', projeta: PROJECAO_DE_QUINA, semente }
}

export const montarMonteDeMoedasDeOuro: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const r = c.g * RAIO
  const luz = paraALuz(c.giro)
  const vertical = desgirado(0, 1, c.giro)
  const sorteio = Math.round(c.w * 3 + c.h * 7)
  cena.corDoPiso = ESCURO_DO_OURO

  const camadas: CamadasDoMonte = {
    tudo: contornoDoMonte(LOBULOS, hw, hh, PICO, 1, ONDA, 3.1),
    meio: contornoDoMonte(LOBULOS, hw, hh, PICO, FATOR_DO_MEIO, ONDA, 5.7),
    miolo: contornoDoMonte(LOBULOS, hw, hh, PICO, FATOR_DO_MIOLO, ONDA, 8.3),
  }
  const { tudo, meio, miolo } = camadas
  const [px, py] = [PICO[0] * hw, PICO[1] * hh]

  // A sombra do monte no chão (pintada, sem altura) e as alturas da 3/4.
  cena.sombras.push(contato(tudo, 0.3), { forma: deslocada(encolhida(tudo, r * 0.4), SOMBRA_DO_MONTE[0], SOMBRA_DO_MONTE[1]), z: 0, suave: 2.4, forca: FORCA_DA_SOMBRA_DO_MONTE })
  declararAlturas(cena, camadas, c.g * ALTURA_DO_MEIO, c.g * ALTURA_DO_MIOLO)

  // As soltas em volta e as que rolam para fora: no chão, por baixo de tudo.
  SOLTAS.forEach(([fx, fy], i) => {
    const m = moedaNoLugar([fx * hw, fy * hh], r, 0.85, 'beira', 1800 + i * 7)
    const solta = { ...m, projeta: 0 }
    cena.sombras.push(contato(formaDaMoeda(solta), 0.32))
    pintarMoedaDeOuro(P, cena, solta, luz)
  })
  ROLANDO.forEach(([fx, fy, rumo], i) => {
    const m = { ...moedaDeQuina(fx * hw, fy * hh, r, rumo, 1880 + i), projeta: 0 }
    const forma = formaDaMoeda(m)
    cena.sombras.push(contato(forma, 0.34), { forma: deslocada(forma, r * 0.5, r * 0.4), z: 0, suave: 0.9, forca: 0.26 })
    pintarMoedaDeOuro(P, cena, m, luz)
  })

  // A beira: a massa (que acaba antes do contorno) e as moedas inteiras, mais raras para fora.
  // O meio da caixa da massa cai na beira de TUDO, fora do anel: na faixa da massa recuada ele podia não caber
  // e voltar para o pico, e a massa da beira subia com o miolo, por cima das moedas do anel.
  const massa0 = encolhida(tudo, r * RECUO_DA_MASSA)
  const [m0x, m0y] = meioDaCamada(tudo, meio, px, py, 1)
  L.push(P(comMeioEm(massa0, m0x, m0y), MASSA_DO_OURO, { bisel: 0, contorno: 0, suave: 1.2, textura: texDaMassa(meio, vertical), semente: 1900 }))
  const beira = espalhar({ b: tudo.b, d: (x, y) => Math.max(tudo.d(x, y), -meio.d(x, y) - r) }, r * PASSO_DA_BEIRA, r * SACODE, 1910 + sorteio)
    .filter(([x, y]) => hash(x * 3.7, y * 9.1, 1911) < FICA_NA_BEIRA + (1 - FICA_NA_BEIRA) * Math.min(1, -tudo.d(x, y) / (r * FUNDO_DA_BEIRA)))
    .map((p, i) => moedaNoLugar(p, r, ACHATADO_DA_BEIRA, 'beira', 2000 + i * 5))
  embaralhadas(beira, 1912).forEach((m) => pintarMoedaDeOuro(P, cena, m, luz))

  // O anel do meio: a massa, com a sombra dela na beira, e as moedas inclinadas.
  const [m1x, m1y] = meioDaCamada(meio, miolo, px, py, 1)
  L.push(P(comMeioEm(meio, m1x, m1y), MASSA_DO_OURO, { bisel: 0, contorno: 0, suave: 1, tom: 1.04, textura: texDaMassa(miolo, vertical), projeta: PROJECAO_DA_CAMADA, semente: 1901 }))
  const anel = espalhar({ b: meio.b, d: (x, y) => Math.max(meio.d(x, y), -miolo.d(x, y) - r) }, r * PASSO_DO_MEIO, r * SACODE, 1920 + sorteio).map((p, i) => moedaNoLugar(p, r, ACHATADO_DO_MEIO, i % 3 === 0 ? 'beira' : 'miolo', 3000 + i * 5))
  embaralhadas(anel, 1921).forEach((m) => pintarMoedaDeOuro(P, cena, m, luz))

  // O miolo: a massa, as moedas em todo rumo, as pilhinhas tombadas, as de quina e os brilhos.
  const [m2x, m2y] = meioDaCamada(miolo, null, px, py, 1)
  L.push(P(comMeioEm(miolo, m2x, m2y), MASSA_DO_OURO, { bisel: 0, contorno: 0, suave: 1, tom: 1.08, textura: texDaMassa(null, vertical), projeta: PROJECAO_DA_CAMADA, semente: 1902 }))
  const topo = espalhar(miolo, r * PASSO_DO_MIOLO, r * SACODE, 1930 + sorteio).map((p, i) => moedaNoLugar(p, r, ACHATADO_DO_MIOLO, i % 4 === 0 ? 'beira' : 'miolo', 4000 + i * 5))
  embaralhadas(topo, 1931).forEach((m) => pintarMoedaDeOuro(P, cena, m, luz))
  PILHINHAS.forEach(([fx, fy, rumo, quantas], i) => {
    for (let j = 0; j < quantas; j += 1) {
      const passo = r * PASSO_DA_PILHINHA * j
      const m: MoedaDeOuro = { x: fx * hw + Math.cos(rumo) * passo, y: fy * hh + Math.sin(rumo) * passo, r, achatado: ACHATADO_DA_PILHINHA, ang: rumo, tom: 0.96 + 0.08 * (j % 2), detalhe: j === quantas - 1 ? 'beira' : 'miolo', projeta: PROJECAO_DA_MOEDA * 1.4, semente: 5000 + i * 10 + j }
      pintarMoedaDeOuro(P, cena, m, luz)
    }
  })
  DE_QUINA.forEach(([fx, fy, rumo], i) => pintarMoedaDeOuro(P, cena, moedaDeQuina(fx * hw, fy * hh, r, rumo, 5100 + i), luz))
  // Os brilhos: espalhados pelo monte inteiro (uma moeda a cada tantas, na ordem sorteada), do lado da luz de cada uma.
  const comBrilho = embaralhadas([...topo, ...anel, ...beira], 1940).filter((_, i) => i % UMA_A_CADA === 0).slice(0, BRILHOS)
  comBrilho.forEach((m, i) => pintarBrilho(P, cena, m.x + luz[0] * m.r * 0.45, m.y + luz[1] * m.r * 0.45, r * RAIO_DO_BRILHO, 5200 + i))
}

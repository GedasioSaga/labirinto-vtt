/**
 * BARRIS DEITADOS NUM SUPORTE de cima com volume (lote 6 dos objetos novos,
 * 11/11/2026): os barris da taberna e da adega, deitados lado a lado num
 * cavalete, com as torneiras para a frente (o lado de baixo: o mestre encosta
 * o fundo na parede e gira).
 *
 * DE CIMA aparece o DORSO de cada barril: as aduelas ao comprido, largas no
 * alto e espremidas para os lados (é o que arredonda), os quatro aros de ferro
 * atravessados e o batoque no meio; entre um barril e outro, as duas
 * longarinas do cavalete com os calços; na frente, a torneira de latão de cada
 * um e, debaixo da primeira, a CANECA cheia.
 *
 * NA 3/4 aparece o TAMPO redondo de cada barril, de frente (o aro da ponta, o
 * topo das aduelas em volta e as tábuas do tampo afundadas), com a torneira
 * embaixo e o dorso por trás, em arco. Como: `pipaDeitada.ts` (o barril da 3/4
 * é desenhado à parte e guardado debaixo do dorso). A torneira é uma peça só,
 * num pino: de cima sai da ponta do barril, na 3/4 sobe para o pé do tampo. A
 * caneca e as longarinas sobem pela regra de sempre.
 *
 * GIRADO NA 3/4 (`c.giro`), a cena é montada já na tela: de costas, o tampo de
 * trás (sem torneira; a caneca fica escondida atrás dos barris); de lado, o
 * bojo de cada barril deitado, um na frente do outro, com a torneira saindo
 * da ponta e a caneca no chão.
 *
 * O que diz "barris deitados" e não "barril" (em pé, redondo, com a tampa à
 * mostra) nem "troncos" (casca, sem aro): as faixas de madeira clara cortadas
 * pelos riscos escuros dos aros, lado a lado. O número de barris sai da
 * largura (um a cada 0,66 casa: três nas 2 x 1 casas de partida). Materiais:
 * `madeira` e `aros` (os do barril do catálogo); o latão das torneiras e a
 * espuma da caneca são fixos (um objeto só guarda duas cores).
 */
import { anel, caixa, capsula, elipse, uniao } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { materialDaPeca, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { bojoDeLado, desgirarCena, montarPipaDePe, noPino, pendurar, pinoNoLugar, pregar, quartosDoGiro, sombraNoAr, texDoBojoDeLado, type Aro, type PecaDoQuadro, type Pino, type Pipa } from './pipaDeitada'

/** Um barril a cada tanto de largura, em casas. */
const LARGURA_POR_BARRIL = 0.66
/** O quanto as longarinas passam dos barris de fora e a folga de cada lado de um barril (px do protótipo). */
const SOBRA_DO_CAVALETE = 3
const FOLGA_DO_BARRIL = 0.9
/** A altura do cavalete, em casas: o barril fica um palmo acima do chão. */
const ALTURA_DO_CAVALETE = 0.11
/** O raio das pontas do barril, em fração do raio do bojo, e as aduelas da meia volta de cima. */
const PONTA_DO_BARRIL = 0.88
const ADUELAS = 9
/** Dois aros perto de cada ponta: o da ponta, mais largo, e o do quarto. */
const AROS: readonly Aro[] = [
  { em: 0.05, largura: 2.4 },
  { em: 0.22, largura: 2.1 },
  { em: 0.78, largura: 2.1 },
  { em: 0.95, largura: 2.4 },
]
/** O que sobra da pegada atrás dos barris e na frente deles, onde ficam a torneira e a caneca (px do protótipo). */
const FUNDO = 2
const FRENTE = 10.5
/** O barril não fica mais comprido que isto, nem mais curto que aquilo, em raios (o objeto esticado ou encolhido). */
const COMPRIMENTO_MAXIMO = 3.1
const COMPRIMENTO_MINIMO = 2.2
/**
 * As longarinas: a distância de cada uma à ponta do barril, em raios (nunca no
 * lugar dos pinos das fatias do barril, que ficam a mais de 0,6 raio da ponta),
 * e a meia largura (px do protótipo).
 */
const RECUO_DA_LONGARINA = 0.36
const MEIA_LONGARINA = 2.4
/** O cavalete fica na sombra dos barris; os calços, um pouco mais claros. */
const TOM_DO_CAVALETE = 0.74
const TOM_DO_CALCO = 0.94
/**
 * De lado na 3/4, o tampo da longarina debaixo da barriga do barril, e a
 * sombra firme no chão ali: com a longarina clara num chão claro ela lia como
 * uma perna comprida, e não como uma viga deitada no chão, debaixo do barril.
 * O escuro é sombra do chão, e não uma peça escura por cima: peça escura cai
 * abaixo do piso de luz e é levantada para o escuro da nogueira.
 */
const TOM_NA_SOMBRA_DO_BARRIL = 0.42
const FORCA_DA_SOMBRA_DEBAIXO_DO_BARRIL = 0.48
const MEIO_CALCO = 1.9
/** A frente recebe menos luz que o tampo: o tom que a 3/4 dá à frente varrida (`TOM_DA_FRENTE` de `tresQuartos.ts`). */
const TOM_DA_FRENTE = 0.74
/** O tampo do barril de frente: o aro da ponta, o topo das aduelas em volta e as tábuas afundadas (px do protótipo e tons). */
const ARO_DA_PONTA = 1.5
const TOPO_DAS_ADUELAS = 1.6
const TOM_DO_TOPO_DAS_ADUELAS = 0.84
const TOM_DO_TAMPO = 0.8
/** A torneira: a altura dela acima do cavalete (em raios), o quanto o bico sai do tampo e os raios (px do protótipo). */
const ALTURA_DA_TORNEIRA = 0.38
const BICO = 3.4
const RAIO_DO_BICO = 1.15
const MEIO_MANIPULO = 2
const RAIO_DO_MANIPULO = 0.75
const RAIO_DO_ESPELHO = 1.9
/** O batoque no alto do barril (px do protótipo). */
const RAIO_DO_BATOQUE = 1.7
/** A caneca: o raio, a altura (em casas) e a distância do meio dela ao tampo (px do protótipo). */
const RAIO_DA_CANECA = 3
const ALTURA_DA_CANECA = 0.15
const DISTANCIA_DA_CANECA = 6.4
/** O latão das torneiras, fixo: o da tabela, no tom do Meio-Termo. */
const LATAO = materialDaPeca('latao')
/** A espuma da caneca cheia: creme claro, contido. */
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xd8, 0xb8] }

/** As medidas do desenho no referencial do objeto (a frente embaixo). */
interface Arranjo {
  /** O meio de cada barril em x e a distância entre dois vizinhos. */
  readonly xs: readonly number[]
  readonly passo: number
  /** A ponta de trás e a da frente dos barris. */
  readonly yN: number
  readonly yS: number
  /** A altura do cavalete e a distância de cada longarina à ponta do barril (px do protótipo). */
  readonly cavalete: number
  readonly recuo: number
  /** O barril, sem a semente (cada um tem a dele). */
  readonly pipa: Pipa
}

function arranjar(c: ContextoDoMovel): Arranjo {
  const { w, h, hw, hh, g } = c
  const livre = w - 2 * SOBRA_DO_CAVALETE
  const cabe = Math.max(1, h - FUNDO - FRENTE)
  // O raio que a largura dá; na pegada rasa manda a profundidade (o barril não fica mais largo que comprido),
  // e entram mais barris, menores, em vez de poucos e espalhados.
  const pelaLargura = livre / Math.max(2, Math.round(w / (g * LARGURA_POR_BARRIL))) / 2 - FOLGA_DO_BARRIL
  const raio = Math.min(pelaLargura, cabe / COMPRIMENTO_MINIMO)
  const n = Math.max(1, Math.floor(livre / (2 * (raio + FOLGA_DO_BARRIL)) + 1e-6))
  const passo = livre / n
  const comprimento = Math.min(cabe, raio * COMPRIMENTO_MAXIMO)
  const cavalete = g * ALTURA_DO_CAVALETE
  const yS = hh - FRENTE
  const xs: number[] = []
  for (let k = 0; k < n; k += 1) xs.push(-hw + SOBRA_DO_CAVALETE + passo * (k + 0.5))
  return {
    xs,
    passo,
    yN: yS - comprimento,
    yS,
    cavalete,
    recuo: raio * RECUO_DA_LONGARINA,
    pipa: { comprimento, raio, raioDaPonta: raio * PONTA_DO_BARRIL, eixo: cavalete + raio, aduelas: ADUELAS, aros: AROS, madeira: c.m.madeira, ferro: c.m.aros, semente: 0 },
  }
}

/** A semente de cada barril: o veio e o tom das aduelas mudam de um para o outro. */
function barril(a: Arranjo, k: number): Pipa {
  return { ...a.pipa, semente: 5300 + k * 16 }
}

/** O tampo do barril de frente, em volta de (cx, y) na tela: o aro da ponta, o topo das aduelas e as tábuas afundadas. */
function tampoDoBarril(pipa: Pipa, cx: number, y: number, sem: number): PecaDoQuadro[] {
  const r = pipa.raioDaPonta
  const dentro = r - ARO_DA_PONTA
  const fundo = dentro - TOPO_DAS_ADUELAS
  return [
    { forma: elipse(cx, y, r, r), mat: pipa.ferro, o: { bisel: 0.9, contorno: 0.3, semente: sem } },
    { forma: elipse(cx, y, dentro, dentro), mat: pipa.madeira, o: { polar: { cx, cy: y, r }, tabua: (Math.PI * pipa.raio) / pipa.aduelas, bisel: 0.6, tom: TOM_DO_TOPO_DAS_ADUELAS, contorno: 0.2, semente: sem + 1 } },
    { forma: elipse(cx, y, fundo, fundo), mat: pipa.madeira, o: { tabua: r * 0.55, bisel: 0.5, recesso: { k: 1.6, forca: 0.3 }, tom: TOM_DO_TAMPO, contorno: 0.24, semente: sem + 2 } },
  ]
}

/** O batoque: a rolha de madeira escura no alto do barril, em (x, y). */
function batoque(pipa: Pipa, x: number, y: number, sem: number): PecaDoQuadro {
  return { forma: elipse(x, y, RAIO_DO_BATOQUE, RAIO_DO_BATOQUE), mat: pipa.madeira, o: { tabua: 0, bisel: 1.3, tom: 0.66, contorno: 0.3, semente: sem } }
}

/** Uma longarina do cavalete, de lado a lado da pegada na altura `y`, com um prego em cada ponta e os calços entre os barris. */
function longarina(c: ContextoDoMovel, cena: Cena, a: Arranjo, y: number, sem: number): void {
  const { hw, peca: P } = c
  const mad = c.m.madeira
  const forma = caixa(-hw + 0.5, y - MEIA_LONGARINA, hw - 0.5, y + MEIA_LONGARINA, 0.6)
  cena.sombras.push({ forma, z: a.cavalete }, contato(forma, 0.3))
  const L = cena.partes
  L.push(P(forma, mad, { tabua: 0, bisel: 1, tom: TOM_DO_CAVALETE, semente: sem }))
  for (const lado of [-1, 1]) L.push(P(elipse(lado * (hw - 1.6), y, 0.55, 0.55), PREGO, { bisel: 0.5, contorno: 0, metal: 0.2 }))
  // Um calço em cada vão: entre dois barris e do lado de fora dos dois da ponta.
  for (let i = 0; i <= a.xs.length; i += 1) {
    const x = a.xs[0] + a.passo * (i - 0.5)
    L.push(P(caixa(x - MEIO_CALCO, y - MEIO_CALCO, x + MEIO_CALCO, y + MEIO_CALCO, 0.5), mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: TOM_DO_CALCO, contorno: 0.26, semente: sem + 1 + i }))
  }
}

/**
 * A torneira de latão na ponta do barril: o bico e o manípulo atravessado.
 * Fica num pino: de cima sai do tampo; na 3/4 sobe para a altura dela e
 * aparece no pé do tampo, apontada para cá.
 */
function torneiraDeCima(c: ContextoDoMovel, cena: Cena, cx: number, yS: number, altura: number, sem: number): void {
  const P = c.peca
  const pino: Pino = { x: cx, y: yS + BICO / 2, z: altura, ordem: yS + BICO }
  pregar(cena, pino)
  cena.partes.push(P(noPino(capsula(cx, yS - 0.4, cx, yS + BICO, RAIO_DO_BICO), pino), LATAO, { eixo: QUARTO, bisel: RAIO_DO_BICO, contorno: 0.26, semente: sem, projeta: { dist: 1, forca: 0.28, suave: 0.7 } }))
  cena.partes.push(P(noPino(capsula(cx - MEIO_MANIPULO, yS + BICO * 0.4, cx + MEIO_MANIPULO, yS + BICO * 0.4, RAIO_DO_MANIPULO), pino), LATAO, { bisel: RAIO_DO_MANIPULO, contorno: 0.26, tom: 0.9, semente: sem + 1 }))
}

/** A caneca de madeira cheia, no chão em (x, y): as aduelas, a cinta de ferro, a espuma e a asa. */
function caneca(c: ContextoDoMovel, cena: Cena, x: number, y: number, sem: number): void {
  const P = c.peca
  const mad = c.m.madeira
  const r = RAIO_DA_CANECA
  const corpo = elipse(x, y, r, r)
  const asa = capsula(x + r - 0.4, y, x + r + 1.7, y, 0.8)
  const toda = uniao(corpo, asa)
  cena.sombras.push({ forma: toda, z: c.g * ALTURA_DA_CANECA }, contato(toda, 0.3))
  const L = cena.partes
  L.push(P(asa, mad, { tabua: 0, bisel: 0.8, tom: 0.9, contorno: 0.28, semente: sem }))
  L.push(P(corpo, mad, { polar: { cx: x, cy: y, r }, tabua: 2.3, bisel: 1, contorno: 0.28, semente: sem + 1 }))
  L.push(P(anel(x, y, r * 0.98, r * 0.98, r * 0.78, r * 0.78), c.m.aros, { bisel: 0.6, contorno: 0.2, semente: sem + 2 }))
  L.push(P(elipse(x, y, r * 0.74, r * 0.74), ESPUMA, { bisel: 0.9, contorno: 0.2, recesso: { k: 0.6, forca: 0.18 }, semente: sem + 3 }))
}

/**
 * Os barris com o eixo de pé na tela. `deFrente`: os tampos da frente para cá
 * (sem giro: a mesma cena serve à vista de cima e à 3/4), com as torneiras e a
 * caneca; senão, os de trás (a meia volta da 3/4: torneiras e caneca ficam
 * escondidas atrás dos barris e não entram).
 */
function montarDePe(c: ContextoDoMovel, cena: Cena, a: Arranjo, deFrente: boolean): void {
  const P = c.peca
  const yN = deFrente ? a.yN : -a.yS
  const yS = yN + a.pipa.comprimento
  const meio = (yN + yS) / 2
  const altoDaTorneira = a.cavalete + ALTURA_DA_TORNEIRA * a.pipa.raio
  longarina(c, cena, a, yN + a.recuo, 5200)
  longarina(c, cena, a, yS - a.recuo, 5220)
  a.xs.forEach((cx, k) => {
    const pipa = barril(a, k)
    const sem = pipa.semente
    const quadro: PecaDoQuadro[] = [batoque(pipa, cx, meio - pipa.eixo - pipa.raio + 0.6, sem + 4), ...tampoDoBarril(pipa, cx, yS - pipa.eixo, sem + 5)]
    // O espelho da torneira no tampo: o disco de latão de onde o bico sai.
    if (deFrente) quadro.push({ forma: elipse(cx, yS - altoDaTorneira, RAIO_DO_ESPELHO, RAIO_DO_ESPELHO), mat: LATAO, o: { bisel: 0.8, contorno: 0.26, tom: 0.84, semente: sem + 9 } })
    montarPipaDePe(P, cena, pipa, cx, yN, quadro, [batoque(pipa, cx, meio, sem + 4)])
  })
  if (!deFrente) return
  caneca(c, cena, a.xs[0], yS + DISTANCIA_DA_CANECA, 5280)
  a.xs.forEach((cx, k) => torneiraDeCima(c, cena, cx, yS, altoDaTorneira, 5290 + k * 2))
}

/**
 * Os barris de lado na tela (o quarto de volta da 3/4), um na frente do outro,
 * do norte para o sul. `sentido` = para onde as torneiras apontam: -1 oeste,
 * 1 leste. Tudo já está no lugar da tela, pendurado em pinos só para a 3/4
 * pintar na ordem: o cavalete primeiro, depois cada barril.
 */
function montarDeLado(c: ContextoDoMovel, tela: Cena, a: Arranjo, sentido: -1 | 1): void {
  const P = c.peca
  const mad = c.m.madeira
  const { comprimento, raio, eixo } = a.pipa
  // A pegada girada: a largura do objeto é a altura da tela.
  const meiaAltura = c.hw
  const xFrente = sentido * a.yS
  const xO = Math.min(xFrente, sentido * a.yN)
  const altoDaTorneira = a.cavalete + ALTURA_DA_TORNEIRA * raio

  const ys = a.xs.map((x) => -sentido * x).sort((p, q) => p - q)

  // As duas longarinas, de pé na tela: o tampo, subido a altura do cavalete, e a ponta de cá. Até a beira do
  // último barril o tampo fica debaixo da barriga dele, na sombra; só a ponta que sobra pega luz.
  const y0 = -meiaAltura + 0.5
  const y1 = meiaAltura - 0.5
  const fimDaSombra = Math.min(y1 - 1, ys[ys.length - 1] + raio * 0.9)
  const pinoDoCavalete = pinoNoLugar(0, 0, y0)
  pregar(tela, pinoDoCavalete)
  for (const [i, recuo] of [a.yN + a.recuo, a.yS - a.recuo].entries()) {
    const x = sentido * recuo
    const sem = 5200 + i * 20
    tela.sombras.push(contato(caixa(x - MEIA_LONGARINA, y0, x + MEIA_LONGARINA, y1, 0.6), 0.3))
    pendurar(P, tela.partes, { forma: caixa(x - MEIA_LONGARINA, y0 - a.cavalete, x + MEIA_LONGARINA, y1 - a.cavalete, 0.6), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: 1, tom: TOM_DO_CAVALETE * TOM_NA_SOMBRA_DO_BARRIL, semente: sem } }, pinoDoCavalete)
    pendurar(P, tela.partes, { forma: caixa(x - MEIA_LONGARINA, fimDaSombra - a.cavalete, x + MEIA_LONGARINA, y1 - a.cavalete, 0.6), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: 1, tom: TOM_DO_CAVALETE, contorno: 0.1, semente: sem } }, pinoDoCavalete)
    pendurar(P, tela.partes, { forma: caixa(x - MEIA_LONGARINA, y1 - a.cavalete - 0.3, x + MEIA_LONGARINA, y1, 0.5), mat: mad, o: { tabua: 0, bisel: 0.8, tom: TOM_DO_CAVALETE * TOM_DA_FRENTE, contorno: 0.2, semente: sem + 1 } }, pinoDoCavalete)
  }

  ys.forEach((cy, k) => {
    const pipa = barril(a, k)
    const sem = pipa.semente
    const yEixo = cy - eixo
    const meio = xO + comprimento / 2
    tela.sombras.push(
      sombraNoAr(caixa(xO, cy - raio * 0.7, xO + comprimento, cy + raio * 0.7, raio * 0.4), eixo),
      { forma: caixa(xO + 1, cy - raio * 0.5, xO + comprimento - 1, cy + raio * 0.8, raio * 0.3), z: 0, suave: 2.2, forca: FORCA_DA_SOMBRA_DEBAIXO_DO_BARRIL },
    )
    const pino = pinoNoLugar(meio, cy - eixo, cy + raio)
    pregar(tela, pino)
    const yDaTorneira = cy - altoDaTorneira
    const ponta = xFrente + sentido * BICO
    const quadro: PecaDoQuadro[] = [
      { forma: bojoDeLado(pipa, xO, yEixo), mat: pipa.madeira, o: { bisel: 0.9, contorno: 0.26, textura: texDoBojoDeLado(pipa, xO, yEixo), semente: sem } },
      batoque(pipa, meio, yEixo - raio + 0.4, sem + 4),
      // A torneira de lado: o cano que sai do tampo, o bico virado para baixo e o manípulo de pé.
      { forma: capsula(xFrente, yDaTorneira, ponta, yDaTorneira, RAIO_DO_BICO), mat: LATAO, o: { bisel: RAIO_DO_BICO, contorno: 0.26, semente: sem + 9 } },
      { forma: capsula(ponta, yDaTorneira, ponta, yDaTorneira + 1.7, RAIO_DO_BICO * 0.85), mat: LATAO, o: { eixo: QUARTO, bisel: RAIO_DO_BICO * 0.85, contorno: 0.26, tom: 0.92, semente: sem + 10 } },
      { forma: capsula(xFrente + sentido * BICO * 0.45, yDaTorneira - 2.6, xFrente + sentido * BICO * 0.45, yDaTorneira, RAIO_DO_MANIPULO), mat: LATAO, o: { eixo: QUARTO, bisel: RAIO_DO_MANIPULO, contorno: 0.26, tom: 0.9, semente: sem + 11 } },
    ]
    for (const peca of quadro) pendurar(P, tela.partes, peca, pino)
  })
  // A caneca, no chão, debaixo da torneira do primeiro barril do objeto.
  caneca(c, tela, xFrente + sentido * DISTANCIA_DA_CANECA, -sentido * a.xs[0], 5280)
}

export const montarBarrisDeitados: MontarMovel = (c, cena) => {
  const a = arranjar(c)
  const quartos = quartosDoGiro(c.giro)
  if (quartos === 0) {
    montarDePe(c, cena, a, true)
    return
  }
  const tela: Cena = { partes: [], sombras: [] }
  if (quartos === 2) montarDePe(c, tela, a, false)
  else montarDeLado(c, tela, a, quartos === 1 ? -1 : 1)
  desgirarCena(tela, quartos, cena)
}

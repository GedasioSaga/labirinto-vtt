/**
 * TONEL DE ADEGA de cima com volume (lote 6 dos objetos novos, 11/11/2026): o
 * tonel enorme da adega, deitado sobre três berços de madeira, com o tampo da
 * frente no lado de baixo (um dos lados menores: o mestre encosta o fundo na
 * parede e gira). É o objeto grande da Armazenagem: quase 2 casas de bojo, bem
 * maior que os barris deitados.
 *
 * DE CIMA aparece o DORSO: as aduelas largas ao comprido, espremidas para os
 * lados, os seis AROS LARGOS de ferro atravessados e, no alto, o BATOQUE (a
 * rolha de cortiça no furo de encher). Dos dois lados do bojo sobram as pontas
 * dos três BERÇOS, cada uma com a cunha que trava o tonel. Na frente, a
 * TORNEIRA GRANDE de latão, com o manípulo atravessado, e a ESCADINHA
 * encostada no tampo: de cima ela é curta (está quase de pé), com a sombra
 * comprida no chão.
 *
 * NA 3/4 aparece o TAMPO redondo de frente: o aro da ponta, o topo das
 * aduelas, as tábuas afundadas, a travessa de reforço com os dois parafusos, a
 * conta riscada a giz, a torneira embaixo e a escadinha de pé, do chão até a
 * beira do tampo; por trás, o dorso em arco com os aros. Como: `pipaDeitada.ts`
 * (o tonel da 3/4 é desenhado à parte e guardado debaixo do dorso). A
 * escadinha é metade guardada (do tampo para cima) e metade a da vista de
 * cima: os montantes ficam no chão nas duas vistas; os degraus de cima somem
 * atrás do tampo.
 *
 * GIRADO NA 3/4 (`c.giro`), a cena é montada já na tela: de costas, o tampo de
 * trás (sem torneira, sem giz, sem escadinha: ficam escondidos atrás do
 * tonel); de lado, o bojo deitado sobre os três berços, com a torneira e a
 * escadinha na ponta.
 *
 * O que diz "tonel de adega" e não "barris deitados": um bojo só, do tamanho
 * da pegada, com aros largos e a escadinha que dá a escala. As medidas saem
 * da pegada (2 x 3 casas de partida). Materiais: `madeira` e `aros` (os do
 * barril do catálogo); o latão da torneira, a cortiça e o giz são fixos (um
 * objeto só guarda duas cores).
 */
import { caixa, capsula, dentroDe, elipse } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca } from './motor'
import { materialDaPeca, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { bojoDeLado, desgirarCena, montarPipaDePe, noPino, pendurar, pinoNoLugar, pregar, quartosDoGiro, raioEm, sombraNoAr, texDoBojoDeLado, type Aro, type PecaDoQuadro, type Pino, type Pipa } from './pipaDeitada'

/** O quanto os berços passam do bojo de cada lado (px do protótipo) e a altura deles, em casas. */
const SOBRA_DO_BERCO = 7
const ALTURA_DO_BERCO = 0.2
/** O raio das pontas do tonel, em fração do raio do bojo, e as aduelas da meia volta de cima. */
const PONTA_DO_TONEL = 0.9
const ADUELAS = 13
/** Três aros largos perto de cada ponta. */
const AROS: readonly Aro[] = [
  { em: 0.035, largura: 5.6 },
  { em: 0.15, largura: 5 },
  { em: 0.31, largura: 4.6 },
  { em: 0.69, largura: 4.6 },
  { em: 0.85, largura: 5 },
  { em: 0.965, largura: 5.6 },
]
/** O que sobra da pegada atrás do tonel e na frente dele, onde ficam a torneira e a escadinha (px do protótipo). */
const FUNDO = 3
const FRENTE = 17
/** O tonel não fica mais comprido que isto, nem mais curto que aquilo, em raios (o objeto esticado ou encolhido). */
const COMPRIMENTO_MAXIMO = 3.4
const COMPRIMENTO_MINIMO = 2.2
/** Os berços: a distância dos dois de fora à ponta do tonel, em raios, e a meia largura da viga (px do protótipo). */
const RECUO_DO_BERCO = 0.18
const MEIO_BERCO = 3.6
/** O berço fica na sombra do tonel; a cunha, um pouco mais clara. */
const TOM_DO_BERCO = 0.74
const TOM_DA_CUNHA = 0.96
const CUNHA = 5.5
/**
 * De lado na 3/4, o tampo do berço debaixo da barriga do tonel, e a sombra
 * firme no chão ali: com o berço claro num chão claro ele lia como uma perna
 * comprida, e não como uma viga deitada no chão, debaixo do tonel. O escuro é
 * sombra do chão, e não uma peça escura por cima: peça escura cai abaixo do
 * piso de luz e é levantada para o escuro da nogueira, uma mancha vermelha.
 */
const TOM_NA_SOMBRA_DO_TONEL = 0.42
const FORCA_DA_SOMBRA_DEBAIXO_DO_TONEL = 0.5
/** A frente recebe menos luz que o tampo: o tom que a 3/4 dá à frente varrida (`TOM_DA_FRENTE` de `tresQuartos.ts`). */
const TOM_DA_FRENTE = 0.74
/** O tampo de frente: o aro da ponta, o topo das aduelas em volta e as tábuas afundadas (px do protótipo e tons). */
const ARO_DA_PONTA = 2.6
const TOPO_DAS_ADUELAS = 2.6
const TOM_DO_TOPO_DAS_ADUELAS = 0.84
const TOM_DO_TAMPO = 0.8
/** A travessa de reforço do tampo: quanto ela fica acima do meio (em raios da ponta) e a meia altura (px do protótipo). */
const ALTURA_DA_TRAVESSA = 0.2
const MEIA_TRAVESSA = 3.2
const TOM_DA_TRAVESSA = 0.95
/** A sombra que a travessa faz nas tábuas do tampo: o escuro quente, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
/** A conta do taberneiro, riscada a giz no tampo. */
const GIZ: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xe0, 0xd2] }
const RISCOS_DE_GIZ = 4
/** O latão da torneira, fixo: o da tabela, no tom do Meio-Termo. */
const LATAO = materialDaPeca('latao')
/** A torneira grande: a altura dela acima do berço (em raios), o quanto o bico sai do tampo e os raios (px do protótipo). */
const ALTURA_DA_TORNEIRA = 0.3
const BICO = 8
const RAIO_DO_BICO = 2.2
const MEIO_MANIPULO = 4.6
const RAIO_DO_MANIPULO = 1.25
const RAIO_DO_ESPELHO = 4.2
/** O batoque: o furo de encher, com a beira escura, e a rolha de cortiça (px do protótipo). */
const RAIO_DO_BATOQUE = 4.6
const CORTICA: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x96, 0x68] }
/**
 * A escadinha: onde os dois montantes ficam (em raios, a partir do meio do
 * tonel), até onde ela sobe no tampo (em raios da ponta, acima do eixo), a
 * distância do pé ao tampo em fração da altura (está quase de pé) e as medidas
 * das peças (px do protótipo).
 */
const MONTANTES_DA_ESCADA: readonly [number, number] = [0.3, 0.58]
const SUBIDA_DA_ESCADA = 0.7
const PE_DA_ESCADA = 0.13
const RAIO_DO_MONTANTE = 1.2
const RAIO_DO_DEGRAU = 0.85
const DEGRAUS = 6
const TOM_DA_ESCADA = 1.12
/** A escadinha guardada sobe só isto na 3/4 (px do protótipo): fica debaixo do dorso, logo atrás da ponta da frente. */
const SUBIDA_DA_ESCADA_GUARDADA = 0.6

/** As medidas do desenho no referencial do objeto (a frente embaixo). */
interface Arranjo {
  /** A ponta de trás e a da frente do tonel. */
  readonly yN: number
  readonly yS: number
  /** A altura do berço e onde cada berço fica ao longo do tonel (px do protótipo). */
  readonly berco: number
  readonly bercos: readonly number[]
  readonly pipa: Pipa
}

function arranjar(c: ContextoDoMovel): Arranjo {
  const { h, hw, hh, g } = c
  const cabe = Math.max(1, h - FUNDO - FRENTE)
  const raio = Math.min(hw - SOBRA_DO_BERCO, cabe / COMPRIMENTO_MINIMO)
  const comprimento = Math.min(cabe, raio * COMPRIMENTO_MAXIMO)
  const berco = g * ALTURA_DO_BERCO
  const yS = hh - FRENTE
  const yN = yS - comprimento
  const recuo = raio * RECUO_DO_BERCO
  return {
    yN,
    yS,
    berco,
    bercos: [yN + recuo, (yN + yS) / 2, yS - recuo],
    pipa: { comprimento, raio, raioDaPonta: raio * PONTA_DO_TONEL, eixo: berco + raio, aduelas: ADUELAS, aros: AROS, madeira: c.m.madeira, ferro: c.m.aros, semente: 5400 },
  }
}

/**
 * O tampo do tonel de frente, em volta de (cx, y) na tela: o aro da ponta, o
 * topo das aduelas, as tábuas afundadas e a travessa de reforço com a sombra
 * e os dois parafusos.
 */
function tampoDoTonel(pipa: Pipa, cx: number, y: number, sem: number): PecaDoQuadro[] {
  const r = pipa.raioDaPonta
  const dentro = r - ARO_DA_PONTA
  const fundo = dentro - TOPO_DAS_ADUELAS
  const noFundo = elipse(cx, y, fundo - 0.5, fundo - 0.5)
  const yDaTravessa = y - ALTURA_DA_TRAVESSA * r
  const pecas: PecaDoQuadro[] = [
    { forma: elipse(cx, y, r, r), mat: pipa.ferro, o: { bisel: 1.2, contorno: 0.3, semente: sem } },
    { forma: elipse(cx, y, dentro, dentro), mat: pipa.madeira, o: { polar: { cx, cy: y, r }, tabua: (Math.PI * pipa.raio) / pipa.aduelas, bisel: 0.8, tom: TOM_DO_TOPO_DAS_ADUELAS, contorno: 0.2, semente: sem + 1 } },
    { forma: elipse(cx, y, fundo, fundo), mat: pipa.madeira, o: { tabua: r * 0.34, bisel: 0.6, recesso: { k: 2.2, forca: 0.3 }, tom: TOM_DO_TAMPO, contorno: 0.24, semente: sem + 2 } },
    { forma: dentroDe(caixa(cx - r, yDaTravessa + MEIA_TRAVESSA - 0.4, cx + r, yDaTravessa + MEIA_TRAVESSA + 2.2), noFundo), mat: SOMBRA, o: { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.9 } },
    { forma: dentroDe(caixa(cx - r, yDaTravessa - MEIA_TRAVESSA, cx + r, yDaTravessa + MEIA_TRAVESSA, 0.8), noFundo), mat: pipa.madeira, o: { tabua: 0, bisel: 1.2, tom: TOM_DA_TRAVESSA, contorno: 0.28, semente: sem + 3 } },
  ]
  for (const lado of [-1, 1]) pecas.push({ forma: elipse(cx + lado * r * 0.62, yDaTravessa, 1.1, 1.1), mat: PREGO, o: { bisel: 1, contorno: 0.1, metal: 0.25 } })
  return pecas
}

/** A conta riscada a giz no tampo, acima da travessa: os riscos de pé e o que os atravessa. */
function contaDeGiz(pipa: Pipa, cx: number, y: number): PecaDoQuadro[] {
  const r = pipa.raioDaPonta
  const x0 = cx - r * 0.4
  const alto = y - r * 0.62
  const baixo = y - r * 0.4
  const passo = r * 0.075
  const giz = { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.4 }
  const pecas: PecaDoQuadro[] = []
  for (let i = 0; i < RISCOS_DE_GIZ; i += 1) pecas.push({ forma: capsula(x0 + i * passo, alto, x0 + i * passo + 0.5, baixo, 0.5), mat: GIZ, o: giz })
  pecas.push({ forma: capsula(x0 - passo * 0.6, baixo - 1.2, x0 + (RISCOS_DE_GIZ - 0.4) * passo, alto + 1.4, 0.5), mat: GIZ, o: giz })
  return pecas
}

/** O batoque em (x, y): a beira escura do furo e a rolha de cortiça. */
function batoque(pipa: Pipa, x: number, y: number, sem: number): PecaDoQuadro[] {
  return [
    { forma: elipse(x, y, RAIO_DO_BATOQUE, RAIO_DO_BATOQUE), mat: pipa.madeira, o: { tabua: 0, bisel: 0.8, tom: 0.6, contorno: 0.3, semente: sem } },
    { forma: elipse(x, y, RAIO_DO_BATOQUE * 0.72, RAIO_DO_BATOQUE * 0.72), mat: CORTICA, o: { bisel: 2.2, contorno: 0.26, semente: sem + 1 } },
  ]
}

/**
 * Um berço com o tonel de pé na tela: a viga de lado a lado na altura `y`. Só
 * as duas pontas são peças (o meio fica debaixo do bojo, e o meio da viga
 * inteira cairia no pino do dorso): cada uma com a cunha que trava o tonel e
 * um prego.
 */
function berco(c: ContextoDoMovel, cena: Cena, a: Arranjo, yN: number, y: number, sem: number): void {
  const { hw, peca: P } = c
  const mad = c.m.madeira
  const forma = caixa(-hw + 0.5, y - MEIO_BERCO, hw - 0.5, y + MEIO_BERCO, 0.7)
  cena.sombras.push({ forma, z: a.berco }, contato(forma, 0.3))
  const bojo = raioEm(a.pipa, y - yN)
  const L = cena.partes
  for (const lado of [-1, 1]) {
    const dentro = lado * (bojo - 4)
    const fora = lado * (hw - 0.5)
    L.push(P(caixa(Math.min(dentro, fora), y - MEIO_BERCO, Math.max(dentro, fora), y + MEIO_BERCO, 0.7), mad, { tabua: 0, bisel: 1.1, tom: TOM_DO_BERCO, semente: sem + (lado + 1) }))
    const junto = lado * (bojo - 0.6)
    const ponta = lado * (bojo - 0.6 + CUNHA)
    L.push(P(caixa(Math.min(junto, ponta), y - MEIO_BERCO + 0.7, Math.max(junto, ponta), y + MEIO_BERCO - 0.7, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: TOM_DA_CUNHA, contorno: 0.26, semente: sem + 4 + lado, projeta: { dist: 0.9, forca: 0.28, suave: 0.7 } }))
    L.push(P(elipse(lado * (hw - 2.2), y, 0.65, 0.65), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
  }
}

/**
 * A torneira grande na ponta do tonel: o bico e o manípulo atravessado com o
 * miolo. Fica num pino: de cima sai do tampo; na 3/4 sobe para a altura dela e
 * aparece no pé do tampo, apontada para cá.
 */
function torneiraDeCima(c: ContextoDoMovel, cena: Cena, cx: number, yS: number, altura: number, sem: number): void {
  const P = c.peca
  const pino: Pino = { x: cx, y: yS + BICO / 2, z: altura, ordem: yS + BICO }
  pregar(cena, pino)
  const yDoManipulo = yS + BICO * 0.42
  const L = cena.partes
  L.push(P(noPino(capsula(cx, yS - 0.5, cx, yS + BICO, RAIO_DO_BICO), pino), LATAO, { eixo: QUARTO, bisel: RAIO_DO_BICO, contorno: 0.26, semente: sem, projeta: { dist: 1.4, forca: 0.28, suave: 0.8 } }))
  L.push(P(noPino(capsula(cx - MEIO_MANIPULO, yDoManipulo, cx + MEIO_MANIPULO, yDoManipulo, RAIO_DO_MANIPULO), pino), LATAO, { bisel: RAIO_DO_MANIPULO, contorno: 0.26, tom: 0.9, semente: sem + 1, projeta: { dist: 0.9, forca: 0.24, suave: 0.6 } }))
  L.push(P(noPino(elipse(cx, yDoManipulo, RAIO_DO_BICO * 0.9, RAIO_DO_BICO * 0.9), pino), LATAO, { bisel: RAIO_DO_BICO * 0.8, contorno: 0.2, tom: 1.05, semente: sem + 2 }))
}

/** Onde a escadinha fica: os dois montantes (x), o pé e o topo dela no chão (y) e a altura em que ela encosta no tampo. */
interface Escada {
  readonly x0: number
  readonly x1: number
  readonly pe: number
  readonly topo: number
  readonly alto: number
}

function escadaDo(a: Arranjo, cx: number, yS: number): Escada {
  const alto = a.pipa.eixo + SUBIDA_DA_ESCADA * a.pipa.raioDaPonta
  return { x0: cx + MONTANTES_DA_ESCADA[0] * a.pipa.raio, x1: cx + MONTANTES_DA_ESCADA[1] * a.pipa.raio, pe: yS + 1 + PE_DA_ESCADA * alto, topo: yS + 1, alto }
}

/**
 * A escadinha vista de cima, encostada no tampo: os dois montantes, curtos
 * (ela está quase de pé), a sombra comprida de cada um no chão e os degraus
 * que se veem (um sim, um não: de cima eles se encavalam). Os montantes ficam
 * no chão nas duas vistas: na 3/4 são o pé da escadinha de pé. Os degraus
 * ficam num pino que os leva para trás do tampo.
 */
function escadaDeCima(c: ContextoDoMovel, cena: Cena, a: Arranjo, e: Escada, yS: number, sem: number): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  for (const [i, x] of [e.x0, e.x1].entries()) {
    const montante = capsula(x, yS - 0.5, x, e.pe, RAIO_DO_MONTANTE)
    cena.sombras.push(contato(montante, 0.24), { forma: capsula(x, e.pe, x + SOMBRA_X * e.alto, e.topo + SOMBRA_Y * e.alto, RAIO_DO_MONTANTE), z: 0, suave: 1.6, forca: 0.2 })
    L.push(P(montante, mad, { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_MONTANTE, tom: TOM_DA_ESCADA, contorno: 0.3, semente: sem + i, projeta: { dist: 0.9, forca: 0.26, suave: 0.7 } }))
  }
  const pino: Pino = { x: (e.x0 + e.x1) / 2, y: (e.pe + e.topo) / 2, z: (e.pe + e.topo) / 2 - (yS - a.pipa.eixo), ordem: yS - 1.2 }
  pregar(cena, pino)
  for (let i = 2; i <= DEGRAUS; i += 2) {
    const y = e.pe - ((e.pe - e.topo) * i) / (DEGRAUS + 1)
    L.push(P(noPino(capsula(e.x0, y, e.x1, y, RAIO_DO_DEGRAU), pino), mad, { tabua: 0, bisel: RAIO_DO_DEGRAU, tom: TOM_DA_ESCADA * 0.94, contorno: 0.3, semente: sem + 2 + i }))
  }
}

/**
 * A escadinha de pé na tela, na 3/4 de frente: os montantes do pé (no chão)
 * até onde ela encosta no tampo, e os seis degraus. O ponto dela a `f` do
 * caminho (0 no pé, 1 no topo) aparece em y = pé - f x (pé - topo + altura).
 */
function escadaDeFrente(c: ContextoDoMovel, e: Escada, sem: number): PecaDoQuadro[] {
  const mad = c.m.madeira
  const sobe = e.pe - e.topo + e.alto
  const pecas: PecaDoQuadro[] = []
  for (let i = 1; i <= DEGRAUS; i += 1) {
    const y = e.pe - (sobe * i) / (DEGRAUS + 1)
    pecas.push({ forma: capsula(e.x0, y, e.x1, y, RAIO_DO_DEGRAU), mat: mad, o: { tabua: 0, bisel: RAIO_DO_DEGRAU, tom: TOM_DA_ESCADA * 0.94, contorno: 0.3, semente: sem + 2 + i } })
  }
  for (const [i, x] of [e.x0, e.x1].entries()) {
    pecas.push({ forma: capsula(x, e.pe, x, e.pe - sobe, RAIO_DO_MONTANTE), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_MONTANTE, tom: TOM_DA_ESCADA, contorno: 0.3, semente: sem + i } })
  }
  return pecas
}

/**
 * O tonel com o eixo de pé na tela. `deFrente`: o tampo da frente para cá (sem
 * giro: a mesma cena serve à vista de cima e à 3/4), com a torneira, o giz e a
 * escadinha; senão, o de trás (a meia volta da 3/4: o resto fica escondido
 * atrás do tonel e não entra).
 */
function montarDePe(c: ContextoDoMovel, cena: Cena, a: Arranjo, deFrente: boolean): void {
  const P = c.peca
  const pipa = a.pipa
  const sem = pipa.semente
  const cx = 0
  const yN = deFrente ? a.yN : -a.yS
  const yS = yN + pipa.comprimento
  const meio = (yN + yS) / 2
  const altoDaTorneira = a.berco + ALTURA_DA_TORNEIRA * pipa.raio
  const noAlto = meio - pipa.eixo - pipa.raio + 1.2
  const face = yS - pipa.eixo
  a.bercos.forEach((ao, i) => berco(c, cena, a, yN, yN + (deFrente ? ao - a.yN : a.yS - ao), 5440 + i * 10))

  const quadro: PecaDoQuadro[] = [...batoque(pipa, cx, noAlto, sem + 4), ...tampoDoTonel(pipa, cx, face, sem + 6)]
  if (deFrente) {
    quadro.push(...contaDeGiz(pipa, cx, face))
    // O espelho da torneira no tampo: o disco de latão de onde o bico sai.
    quadro.push({ forma: elipse(cx, yS - altoDaTorneira, RAIO_DO_ESPELHO, RAIO_DO_ESPELHO), mat: LATAO, o: { bisel: 1.2, contorno: 0.26, tom: 0.84, semente: sem + 12 } })
  }
  const e = escadaDo(a, cx, yS)
  if (deFrente) {
    // A escadinha de pé, guardada debaixo do dorso: do tampo para cima. O pino fica entre o berço do meio e o da frente.
    const pino: Pino = { x: (e.x0 + e.x1) / 2, y: (meio + yS - RECUO_DO_BERCO * pipa.raio) / 2, z: SUBIDA_DA_ESCADA_GUARDADA, ordem: yS - 0.1 }
    pregar(cena, pino)
    for (const peca of escadaDeFrente(c, e, 5480)) pendurar(P, cena.partes, peca, pino, [-Infinity, yS - 0.9])
  }
  montarPipaDePe(P, cena, pipa, cx, yN, quadro, batoque(pipa, cx, meio, sem + 4))
  if (!deFrente) return
  escadaDeCima(c, cena, a, e, yS, 5480)
  torneiraDeCima(c, cena, cx, yS, altoDaTorneira, 5470)
}

/**
 * O tonel de lado na tela (o quarto de volta da 3/4). `sentido` = para onde o
 * tampo da frente aponta: -1 oeste, 1 leste. Tudo já está no lugar da tela,
 * pendurado em pinos só para a 3/4 pintar na ordem: os berços primeiro, depois
 * o bojo, e por último a escadinha.
 */
function montarDeLado(c: ContextoDoMovel, tela: Cena, a: Arranjo, sentido: -1 | 1): void {
  const P = c.peca
  const mad = c.m.madeira
  const pipa = a.pipa
  const sem = pipa.semente
  const { comprimento, raio, eixo } = pipa
  // A pegada girada: a largura do objeto é a altura da tela.
  const meiaAltura = c.hw
  const xFrente = sentido * a.yS
  const xO = Math.min(xFrente, sentido * a.yN)
  const meio = xO + comprimento / 2
  const cy = 0
  const yEixo = cy - eixo

  // Os berços, de pé na tela: o tampo, subido a altura do berço, na sombra do bojo até a beira dele; a ponta
  // que sobra, com a cunha; e a ponta de cá.
  const y0 = -meiaAltura + 0.5
  const y1 = meiaAltura - 0.5
  const fimDaSombra = Math.min(y1 - 1, cy + raio * 0.9)
  const pinoDosBercos = pinoNoLugar(meio, cy - a.berco, y0)
  pregar(tela, pinoDosBercos)
  a.bercos.forEach((ao, i) => {
    const x = sentido * ao
    const semDoBerco = 5440 + i * 10
    tela.sombras.push(contato(caixa(x - MEIO_BERCO, y0, x + MEIO_BERCO, y1, 0.7), 0.3))
    const pecas: PecaDoQuadro[] = [
      { forma: caixa(x - MEIO_BERCO, y0 - a.berco, x + MEIO_BERCO, y1 - a.berco, 0.7), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: TOM_DO_BERCO * TOM_NA_SOMBRA_DO_TONEL, semente: semDoBerco } },
      { forma: caixa(x - MEIO_BERCO, fimDaSombra - a.berco, x + MEIO_BERCO, y1 - a.berco, 0.7), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: TOM_DO_BERCO, contorno: 0.1, semente: semDoBerco } },
      { forma: caixa(x - MEIO_BERCO + 0.7, fimDaSombra - a.berco - 1, x + MEIO_BERCO - 0.7, fimDaSombra - a.berco + CUNHA - 1, 0.6), mat: mad, o: { tabua: 0, bisel: 1, tom: TOM_DA_CUNHA, contorno: 0.26, semente: semDoBerco + 5 } },
      { forma: caixa(x - MEIO_BERCO, y1 - a.berco - 0.3, x + MEIO_BERCO, y1, 0.5), mat: mad, o: { tabua: 0, bisel: 0.9, tom: TOM_DO_BERCO * TOM_DA_FRENTE, contorno: 0.2, semente: semDoBerco + 1 } },
    ]
    for (const peca of pecas) pendurar(P, tela.partes, peca, pinoDosBercos)
  })

  tela.sombras.push(
    sombraNoAr(caixa(xO, cy - raio * 0.7, xO + comprimento, cy + raio * 0.7, raio * 0.4), eixo),
    { forma: caixa(xO + 2, cy - raio * 0.5, xO + comprimento - 2, cy + raio * 0.82, raio * 0.3), z: 0, suave: 4, forca: FORCA_DA_SOMBRA_DEBAIXO_DO_TONEL },
  )
  const pinoDoBojo = pinoNoLugar(meio, yEixo, cy + raio)
  pregar(tela, pinoDoBojo)
  const yDaTorneira = cy - (a.berco + ALTURA_DA_TORNEIRA * raio)
  const ponta = xFrente + sentido * BICO
  const xDoManipulo = xFrente + sentido * BICO * 0.42
  const quadro: PecaDoQuadro[] = [
    { forma: bojoDeLado(pipa, xO, yEixo), mat: pipa.madeira, o: { bisel: 0.9, contorno: 0.26, textura: texDoBojoDeLado(pipa, xO, yEixo), semente: sem } },
    ...batoque(pipa, meio, yEixo - raio + 0.8, sem + 4),
    // A torneira de lado: o cano que sai do tampo, o bico virado para baixo e o manípulo de pé.
    { forma: capsula(xFrente, yDaTorneira, ponta, yDaTorneira, RAIO_DO_BICO), mat: LATAO, o: { bisel: RAIO_DO_BICO, contorno: 0.26, semente: sem + 12 } },
    { forma: capsula(ponta, yDaTorneira, ponta, yDaTorneira + 3.4, RAIO_DO_BICO * 0.85), mat: LATAO, o: { eixo: QUARTO, bisel: RAIO_DO_BICO * 0.85, contorno: 0.26, tom: 0.92, semente: sem + 13 } },
    { forma: capsula(xDoManipulo, yDaTorneira - 5.4, xDoManipulo, yDaTorneira, RAIO_DO_MANIPULO), mat: LATAO, o: { eixo: QUARTO, bisel: RAIO_DO_MANIPULO, contorno: 0.26, tom: 0.9, semente: sem + 14 } },
  ]
  for (const peca of quadro) pendurar(P, tela.partes, peca, pinoDoBojo)

  // A escadinha de lado: os dois montantes inclinados, do pé (no chão, para lá do tampo) até a beira do tampo, e
  // os degraus entre eles. O montante de cada lado do objeto está num y do chão; o de cá é pintado por último.
  // Do lado de cá do tonel a escadinha passa na frente da torneira: entra na fila depois do bojo.
  const e = escadaDo(a, 0, a.yS)
  const xDoPe = xFrente + sentido * (e.pe - a.yS)
  const xDoTopo = xFrente + sentido * (e.topo - a.yS)
  const ys = [-sentido * e.x0, -sentido * e.x1].sort((p, q) => p - q)
  const pinoDaEscada = pinoNoLugar((xDoPe + xDoTopo) / 2, (ys[0] + ys[1] - e.alto) / 2, ys[1] > cy ? cy + raio + 1 : ys[1] + 1)
  pregar(tela, pinoDaEscada)
  const escada: PecaDoQuadro[] = [{ forma: capsula(xDoPe, ys[0], xDoTopo, ys[0] - e.alto, RAIO_DO_MONTANTE), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_MONTANTE, tom: TOM_DA_ESCADA * 0.9, contorno: 0.3, semente: 5480 } }]
  for (let i = 1; i <= DEGRAUS; i += 1) {
    const f = i / (DEGRAUS + 1)
    const x = xDoPe + (xDoTopo - xDoPe) * f
    escada.push({ forma: capsula(x, ys[0] - e.alto * f, x, ys[1] - e.alto * f, RAIO_DO_DEGRAU), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_DEGRAU, tom: TOM_DA_ESCADA * 0.94, contorno: 0.3, semente: 5482 + i } })
  }
  escada.push({ forma: capsula(xDoPe, ys[1], xDoTopo, ys[1] - e.alto, RAIO_DO_MONTANTE), mat: mad, o: { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_MONTANTE, tom: TOM_DA_ESCADA, contorno: 0.3, semente: 5481 } })
  for (const y of ys) tela.sombras.push(contato(elipse(xDoPe, y, RAIO_DO_MONTANTE, RAIO_DO_MONTANTE), 0.26))
  for (const peca of escada) pendurar(P, tela.partes, peca, pinoDaEscada)
}

export const montarTonelDeAdega: MontarMovel = (c, cena) => {
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

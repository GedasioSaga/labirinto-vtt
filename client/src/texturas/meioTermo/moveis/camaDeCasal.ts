/**
 * CAMA DE CASAL de cima com volume (lote 4 dos objetos novos, 11/11/2026): a
 * cama larga de quarto de casa boa. De cima aparecem a CABECEIRA trabalhada
 * (a régua com o cordão boleado, o florão no meio e os dois postes com a
 * pinha torneada), os DOIS TRAVESSEIROS, o LENÇOL DOBRADO por cima da COLCHA
 * (matelassê em losangos, com a barra lisa em volta), as réguas da armação dos
 * lados e a PESEIRA com os dois postes dos pés. A cabeceira fica em cima (o
 * fundo) e os pés embaixo (a frente), como na cama de solteiro (`catre.ts`).
 *
 * Os lugares de material são os da cama de solteiro: `madeira`, `cobertor` (a
 * colcha) e `travesseiro`. O lençol é fixo, o linho do `LENCOL`.
 *
 * NA 3/4 A CABECEIRA E A PESEIRA MOSTRAM AS ALMOFADAS. A frente que a 3/4
 * varre sozinha é madeira lisa, de veio deitado; aqui a face da cabeceira (a
 * régua de cima, o florão e as almofadas em relevo, com um losango entalhado
 * em cada uma), a da peseira (a régua, as almofadas, a travessa de baixo e o
 * vão escuro debaixo da cama, entre os pés) e a frente dos quatro postes (o
 * fuste de veio em pé, com dois anéis torneados) são desenhadas de frente e
 * ficam GUARDADAS debaixo das cobertas na vista de cima, onde nada delas
 * aparece. O que as põe no lugar é a regra de sempre da 3/4
 * (`tresQuartos.ts`): cada peça sobe a altura da estrutura que contém o meio
 * da caixa dela. Cada ponta da cama tem a sua FRESTA, um tampo no ar de um
 * quarto de px, e a caixa de pintura de cada peça é espelhada em volta dela
 * (`guardada`), como na estante de livros e no guarda-roupa:
 * - a da PESEIRA fica colada na frente da pegada e sobe meio px: a face e os
 *   postes, guardados logo atrás (debaixo da colcha), caem na frente dela;
 * - a da CABECEIRA fica logo à frente dos postes dela, debaixo dos
 *   travesseiros, e sobe um pouco mais que os postes inteiros: a face e os
 *   postes, guardados à FRENTE da fresta, sobem para trás e caem cada um no
 *   plano dele, acima dos travesseiros.
 *
 * O perfil da 3/4 tem de ser derivado com espessura 0: com a beirada padrão
 * dos tampos soltos, a da fresta da cabeceira apareceria como uma tira de
 * madeira por cima da quina dela, e a da peseira, no chão.
 *
 * A cama LÊ `c.giro` (o quarto de volta que a 3/4 pinta): girada, ela não
 * guarda as faces. De lado ou de costas a 3/4 varre a madeira lisa, que é o
 * que se veria; e a face da cabeceira, que sobe mais que o colchão que a
 * esconde, apareceria solta por cima dele.
 *
 * As medidas da armação são por casa (a cama esticada ganha colchão, não uma
 * cabeceira mais grossa); só uma cama menor que 2 x 2 encolhe tudo junto. A
 * 25% de zoom sobram o quadro de madeira, as duas manchas claras dos
 * travesseiros, a faixa do lençol e o campo da colcha.
 */
import { caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { LENCOL, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas em casas: o colchão, o alto da cabeceira e o da peseira, e quanto os postes passam delas (a pinha). */
const ALTURA_DO_COLCHAO = 0.38
const ALTURA_DA_CABECEIRA = 0.95
const ALTURA_DA_PESEIRA = 0.5
const ALTURA_DA_PINHA = 0.09
/** O lado de partida, em casas: abaixo dele as medidas por casa encolhem junto. */
const LADO_DE_PARTIDA = 2

/** A armação vista de cima, em casas: a cabeceira e a peseira (a grossura), os postes de cada uma (o lado) e a régua de cada lado. */
const FUNDO_DA_CABECEIRA = 0.17
const FUNDO_DA_PESEIRA = 0.14
const POSTE_DA_CABECEIRA = 0.23
const POSTE_DA_PESEIRA = 0.2
const BEIRA = 0.1
/** Quanto da régua de cada lado a colcha deixa à mostra. */
const BEIRA_A_MOSTRA = 0.55
/** O florão do meio da cabeceira: a meia largura, em casas, e quanto ele passa da cabeceira para a frente (px do protótipo). */
const MEIO_FLORAO = 0.3
const SALIENCIA_DO_FLORAO = 1.4
/** A pinha de cada poste: o raio, em fração do lado do poste. */
const RAIO_DA_PINHA = 0.36

/** Os travesseiros: a folga até a régua e entre os dois (px do protótipo) e a altura, em fração do comprimento da cama. */
const FOLGA_DO_TRAVESSEIRO = 2.2
const ENTRE_TRAVESSEIROS = 1.6
const ALTO_DO_TRAVESSEIRO = 0.2
/** O travesseiro não fica mais alto que esta fração da largura dele (a cama comprida não ganha travesseiro quadrado). */
const PROPORCAO_DO_TRAVESSEIRO = 0.62
/** O da direita fica um nada mais abaixo: cama arrumada por gente. */
const DESCIDA_DO_SEGUNDO = 0.9
/** A costura da aba da fronha fica a esta distância da ponta de fora (px do protótipo). */
const ABA_DA_FRONHA = 3.4
/** O lençol dobrado: o vão entre os travesseiros e ele e a largura da dobra, em fração do comprimento da cama. */
const VAO_ATE_A_DOBRA = 0.03
const DOBRA_DO_LENCOL = 0.115
/** O bordado da dobra: a distância da beira dela e a grossura do fio (px do protótipo). */
const RECUO_DO_BORDADO = 2.4
const FIO_DO_BORDADO = 0.7

// ---------- a colcha ----------

/** O matelassê: o lado do losango (px do protótipo, 8 pixels a 1x), a costura entre eles e o gomo estufado de cada um. */
const LOSANGO = 9
const LARGURA_DA_COSTURA = 0.7
const FUNDO_DA_COSTURA = 0.13
const GOMO = 0.05
/** A barra lisa em volta da colcha (px do protótipo) e o pesponto que a separa dos losangos. */
const BARRA_DA_COLCHA = 5
const PESPONTO = 0.6
/**
 * De onde vem a luz, no plano dos losangos: a luz do motor (de cima à
 * esquerda) vista ao longo das duas diagonais. A que desce para a direita
 * pega quase toda a luz; a outra, quase nada.
 */
const LUZ_NA_DIAGONAL = 1.1
const LUZ_NA_OUTRA_DIAGONAL = 0.14

/**
 * A colcha de matelassê: o pano do material com os losangos costurados em
 * diagonal, cada um um gomo estufado (claro do lado da luz, escuro do outro),
 * e a barra lisa em volta, separada por um pesponto. Discreto: só luz, a cor
 * é a do material.
 */
function texMatelasse(colcha: Forma): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const dentro = -colcha.d(x, y)
    if (dentro < BARRA_DA_COLCHA) {
      if (dentro > BARRA_DA_COLCHA - PESPONTO) s[3] -= FUNDO_DA_COSTURA
      return
    }
    const a = (x + y) / LOSANGO
    const b = (x - y) / LOSANGO
    const fa = a - Math.floor(a)
    const fb = b - Math.floor(b)
    const ateACostura = Math.min(fa, 1 - fa, fb, 1 - fb) * LOSANGO
    if (ateACostura < LARGURA_DA_COSTURA) s[3] -= FUNDO_DA_COSTURA * (1 - ateACostura / LARGURA_DA_COSTURA)
    s[3] += GOMO * (LUZ_NA_DIAGONAL * Math.cos(Math.PI * fa) * Math.sin(Math.PI * fb) + LUZ_NA_OUTRA_DIAGONAL * Math.sin(Math.PI * fa) * Math.cos(Math.PI * fb))
  }
}

// ---------- as faces guardadas ----------

/** A fresta de cada face (px do protótipo): fina, para a peseira acabar a meio px da frente da pegada. */
const FRESTA = 0.25
/** Quanto a face da peseira sobe na 3/4 (px do protótipo): o mínimo para a fresta dela valer como estrutura. */
const SUBIDA_DA_PESEIRA = 0.5
/** Quanto a fresta da cabeceira fica à frente dos postes dela e quanto a face sobe além do alto deles (px do protótipo). */
const FRESTA_DA_CABECEIRA_A_FRENTE = 0.2
const FOLGA_DA_CABECEIRA = 1
/** Cada fresta acaba este tanto antes de cada ponta: girada na 3/4, o colchão é pintado depois dela e cobre a face guardada. */
const RECUO_DA_FRESTA = 0.5
/** A face da cabeceira começa este tanto abaixo do colchão (px do protótipo): os travesseiros a cobrem dali para baixo. */
const CABECEIRA_ATRAS_DO_COLCHAO = 4

/**
 * A peça desenhada DE FRENTE (x como na pegada, y = 0 no chão e negativo para
 * cima) no lugar em que fica guardada na vista de cima: descida `desce` px,
 * para debaixo das cobertas, com a caixa de pintura espelhada em volta de
 * `meio` (o meio da fresta). O desenho não muda, porque fora da forma nada
 * pinta; o meio da caixa, que é o que a 3/4 lê para saber em que estrutura a
 * peça está, cai na fresta.
 */
function guardada(forma: Forma, desce: number, meio: number): Forma {
  const alcance = Math.max(Math.abs(forma.b[1] + desce - meio), Math.abs(forma.b[3] + desce - meio))
  return { b: [forma.b[0], meio - alcance, forma.b[2], meio + alcance], d: (x, y) => forma.d(x, y - desce) }
}

/** Põe uma peça numa face: a forma em coordenadas de frente (y = 0 no chão, negativo para cima). */
type PorNaFace = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

/** Uma almofada da face a cada tanto de largura, em casas, e o montante entre duas (px do protótipo). */
const LARGURA_DA_ALMOFADA = 0.52
const MONTANTE = 2.6
/** A régua de cima de cada face e a travessa de baixo da peseira (px do protótipo). */
const REGUA_DA_CABECEIRA = 4.6
const REGUA_DA_PESEIRA = 3.8
const TRAVESSA_DA_PESEIRA = 3.6
/** O vão debaixo da cama, entre os pés, em fração da altura da peseira. */
const VAO_DOS_PES = 0.2
/** Quanto o painel em relevo recua da moldura da almofada (px do protótipo). */
const RECUO_DO_PAINEL = 2.3
/** A madeira vista de frente pega menos luz que a de cima: o fundo, a moldura afundada, o painel em relevo, a régua e o poste. */
const TOM_DO_FUNDO = 0.82
const TOM_DA_MOLDURA = 0.76
const TOM_DO_PAINEL = 0.98
const TOM_DA_REGUA = 0.96
const TOM_DO_ENTALHE = 1.08
const TOM_DO_POSTE = 0.86
const TOM_DO_VAO = 0.5
/** Os dois anéis torneados de cada poste: a distância de cada um ao alto do poste e a meia grossura (px do protótipo). */
const ANEIS_DO_POSTE: readonly number[] = [3.4, 6.2]
const MEIO_ANEL = 0.75
/** A sombra que a régua de cima faz nas almofadas: o escuro quente da nogueira, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
const ALTO_DA_SOMBRA_DA_REGUA = 2.2

/** Losango de meias medidas `mx` e `my` em volta de (cx, cy). */
function losango(cx: number, cy: number, mx: number, my: number): Forma {
  const pontos: Ponto[] = [[cx, cy - my], [cx + mx, cy], [cx, cy + my], [cx - mx, cy]]
  return poligono(pontos)
}

/**
 * As almofadas de uma face, de `-meia` a `meia` e do pé ao topo (alturas a
 * partir do chão): em cada uma, a moldura afundada, o painel em relevo e, se
 * `entalhe` (a altura do meio dele), um losango entalhado.
 */
function almofadas(por: PorNaFace, mad: MaterialDaPeca, meia: number, pe: number, topo: number, casa: number, entalhe: number | null, semente: number): void {
  const quantas = Math.max(2, Math.round((2 * meia) / (casa * LARGURA_DA_ALMOFADA)))
  const largura = (2 * meia - (quantas + 1) * MONTANTE) / quantas
  for (let i = 0; i < quantas; i += 1) {
    const x0 = -meia + MONTANTE + i * (largura + MONTANTE)
    const x1 = x0 + largura
    por(caixa(x0, -topo, x1, -pe, 0.5), mad, { eixo: QUARTO, tabua: 0, bisel: 0.3, tom: TOM_DA_MOLDURA, contorno: 0.12, recesso: { k: 2.2, forca: 0.34 }, semente: semente + i * 4 })
    const r = RECUO_DO_PAINEL
    por(caixa(x0 + r, -topo + r, x1 - r, -pe - r, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1.9, tom: TOM_DO_PAINEL, contorno: 0.14, semente: semente + i * 4 + 1 })
    if (entalhe === null) continue
    const xm = (x0 + x1) / 2
    const mx = Math.min(4.4, largura * 0.2)
    por(losango(xm, -entalhe, mx, mx * 1.35), mad, { tabua: 0, bisel: 1.3, tom: TOM_DO_ENTALHE, contorno: 0.2, semente: semente + i * 4 + 2 })
    por(losango(xm, -entalhe, mx * 0.4, mx * 0.54), mad, { tabua: 0, bisel: 0, tom: TOM_DA_MOLDURA, contorno: 0, recesso: { k: 0.6, forca: 0.3 }, semente: semente + i * 4 + 3 })
  }
}

/** A régua de cima de uma face, com a sombra que ela faz nas almofadas. */
function reguaDeCima(por: PorNaFace, mad: MaterialDaPeca, meia: number, topo: number, alto: number, semente: number): void {
  por(caixa(-meia + 0.6, -topo + alto - 0.3, meia - 0.6, -topo + alto + ALTO_DA_SOMBRA_DA_REGUA), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.4 })
  por(caixa(-meia - 0.5, -topo, meia + 0.5, -topo + alto, 0.8), mad, { tabua: 0, bisel: 1.3, tom: TOM_DA_REGUA, semente })
}

/** O florão: a placa em relevo e o losango entalhado nela, com o olho no meio. O mesmo de cima e de frente. */
function florao(por: PorNaFace, mad: MaterialDaPeca, placa: Forma, cx: number, cy: number, mx: number, my: number, semente: number, projeta: boolean): void {
  por(placa, mad, { tabua: 0, bisel: 1.6, tom: 1.03, contorno: 0.22, semente, projeta: projeta ? { dist: 1.2, forca: 0.26 } : undefined })
  por(losango(cx, cy, mx, my), mad, { tabua: 0, bisel: Math.min(mx, my) * 0.7, tom: 1.12, contorno: 0.22, semente: semente + 1 })
  por(elipse(cx, cy, my * 0.36, my * 0.36), mad, { tabua: 0, bisel: 0, tom: 0.78, contorno: 0, recesso: { k: 0.5, forca: 0.3 }, semente: semente + 2 })
}

/**
 * A frente de um poste, de `x0` a `x0 + lado` e do pé ao topo: o fuste de veio
 * em pé (a frente que a 3/4 varre teria o veio deitado, em tábuas) e os dois
 * anéis torneados perto do alto.
 */
function frenteDoPoste(por: PorNaFace, mad: MaterialDaPeca, x0: number, lado: number, pe: number, topo: number, semente: number): void {
  por(caixa(x0 + 0.3, -topo, x0 + lado - 0.3, -pe, 0.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: TOM_DO_POSTE, semente })
  for (const [i, desce] of ANEIS_DO_POSTE.entries()) {
    por(caixa(x0 + 0.1, -topo + desce - MEIO_ANEL, x0 + lado - 0.1, -topo + desce + MEIO_ANEL, MEIO_ANEL), mad, { tabua: 0, bisel: MEIO_ANEL, tom: 1.02, contorno: 0.2, semente: semente + 1 + i })
  }
}

/** A face da cabeceira, de frente, entre os postes: o fundo, as almofadas entalhadas, a régua de cima e o florão. */
function faceDaCabeceira(por: PorNaFace, mad: MaterialDaPeca, meia: number, pe: number, topo: number, casa: number): void {
  por(caixa(-meia - 0.5, -topo, meia + 0.5, -pe), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_FUNDO, semente: 430 })
  const topoDasAlmofadas = topo - REGUA_DA_CABECEIRA - 1
  // O losango fica no meio do que os travesseiros deixam ver da almofada.
  almofadas(por, mad, meia, pe, topoDasAlmofadas, casa, (topoDasAlmofadas + pe + CABECEIRA_ATRAS_DO_COLCHAO) / 2, 431)
  reguaDeCima(por, mad, meia, topo, REGUA_DA_CABECEIRA, 446)
  const mf = Math.min(casa * MEIO_FLORAO, meia * 0.5)
  const alto = REGUA_DA_CABECEIRA + 3.4
  florao(por, mad, caixa(-mf, -topo, mf, -topo + alto, 1.2), 0, -topo + alto / 2, Math.min(5.4, mf * 0.5), alto * 0.3, 447, false)
}

/** A face da peseira, de frente, entre os pés: o vão escuro debaixo da cama, o fundo, a travessa, as almofadas e a régua. */
function faceDaPeseira(por: PorNaFace, mad: MaterialDaPeca, meia: number, topo: number, casa: number): void {
  const vao = topo * VAO_DOS_PES
  // O vão não tem beira embaixo: acaba no chão.
  por(caixa(-meia - 0.5, -vao - 0.4, meia + 0.5, 0), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_VAO, recesso: { k: 2.4, forca: 0.3 }, semente: 450 })
  por(caixa(-meia - 0.5, -topo, meia + 0.5, -vao), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_FUNDO, semente: 451 })
  por(caixa(-meia - 0.5, -vao - TRAVESSA_DA_PESEIRA, meia + 0.5, -vao, 0.5), mad, { tabua: 0, bisel: 1, tom: TOM_DA_REGUA - 0.04, semente: 452 })
  almofadas(por, mad, meia, vao + TRAVESSA_DA_PESEIRA + 0.9, topo - REGUA_DA_PESEIRA - 0.9, casa, null, 453)
  reguaDeCima(por, mad, meia, topo, REGUA_DA_PESEIRA, 466)
}

// ---------- a cama ----------

/** O cordão torcido entalhado ao longo da régua da cabeceira e da peseira: o passo do gomo (px do protótipo) e a luz dele. */
const PASSO_DO_CORDAO = 3.4
const LUZ_DO_CORDAO = 0.1
const VEIO_DA_MADEIRA = texturaDaClasse('madeira')

/** A madeira com os gomos do cordão em diagonal, um claro e um escuro. */
const texCordao: Textura = (u, v, x, y, p, s, escala) => {
  if (VEIO_DA_MADEIRA !== null) VEIO_DA_MADEIRA(u, v, x, y, p, s, escala)
  s[3] += LUZ_DO_CORDAO * Math.sin(((x + y * 1.3) * 2 * Math.PI) / PASSO_DO_CORDAO)
}

/** Um poste de canto, de cima: o topo quadrado e a pinha torneada (a bola, com o botão no alto). */
function poste(L: Peca[], P: CriarPeca, mad: MaterialDaPeca, x0: number, y0: number, lado: number, semente: number): void {
  L.push(P(caixa(x0, y0, x0 + lado, y0 + lado, lado * 0.17), mad, { eixo: QUARTO, tabua: 0, bisel: lado * 0.17, semente }))
  const r = lado * RAIO_DA_PINHA
  const cx = x0 + lado / 2
  const cy = y0 + lado / 2
  L.push(P(elipse(cx, cy, r, r), mad, { tabua: 0, bisel: r * 0.92, tom: 1.08, contorno: 0.26, semente: semente + 1, projeta: { dist: 1.4, forca: 0.3 } }))
  L.push(P(elipse(cx, cy, r * 0.32, r * 0.32), mad, { tabua: 0, bisel: r * 0.3, tom: 1.2, contorno: 0.16, semente: semente + 2 }))
}

/** O que a cama mede, em px do protótipo (centro na origem). */
interface Medidas {
  /** Px do protótipo por casa, já com o encolhimento da cama menor que a de partida. */
  readonly casa: number
  /** Onde acaba a cabeceira e onde começa a peseira. */
  readonly yCab: number
  readonly yPe: number
  readonly posteCab: number
  readonly postePe: number
  readonly beira: number
}

function medidasDaCama(c: ContextoDoMovel): Medidas {
  const casa = Math.min(c.g, c.w / LADO_DE_PARTIDA, c.h / LADO_DE_PARTIDA)
  return {
    casa,
    yCab: -c.hh + casa * FUNDO_DA_CABECEIRA,
    yPe: c.hh - casa * FUNDO_DA_PESEIRA,
    posteCab: casa * POSTE_DA_CABECEIRA,
    postePe: casa * POSTE_DA_PESEIRA,
    beira: casa * BEIRA,
  }
}

/** O colchão arrumado: o lençol de baixo, os dois travesseiros, a colcha de matelassê e o lençol dobrado por cima dela. */
function roupaDeCama(c: ContextoDoMovel, L: Peca[], m: Medidas): void {
  const { hw, h, peca: P } = c
  const dentro = hw - m.beira
  L.push(P(caixa(-dentro, m.yCab + 0.4, dentro, m.yPe, 2), LENCOL, { bisel: 2.4, ruga: 1.2, semente: 35 }))

  const largura = (2 * dentro - 2 * FOLGA_DO_TRAVESSEIRO - ENTRE_TRAVESSEIROS) / 2
  const alto = Math.min(ALTO_DO_TRAVESSEIRO * h, largura * PROPORCAO_DO_TRAVESSEIRO)
  const yTr = m.yCab + 2
  for (const i of [0, 1]) {
    const x0 = -dentro + FOLGA_DO_TRAVESSEIRO + i * (largura + ENTRE_TRAVESSEIROS)
    const y0 = yTr + i * DESCIDA_DO_SEGUNDO
    L.push(P(caixa(x0, y0, x0 + largura, y0 + alto, alto * 0.26), c.m.travesseiro, { bisel: alto * 0.32, ruga: 1.1, semente: 36 + i, projeta: { dist: 1.8, forca: 0.3, suave: 1.3 } }))
    // A costura da aba da fronha, na ponta de fora.
    const xAba = i === 0 ? x0 + ABA_DA_FRONHA : x0 + largura - ABA_DA_FRONHA
    L.push(P(caixa(xAba - 0.3, y0 + alto * 0.2, xAba + 0.3, y0 + alto * 0.8, 0.3), c.m.travesseiro, { bisel: 0, contorno: 0, tom: 0.78, alfa: 0.7, semente: 38 + i }))
  }

  const yDobra = yTr + DESCIDA_DO_SEGUNDO + alto + VAO_ATE_A_DOBRA * h
  const fimDaDobra = yDobra + DOBRA_DO_LENCOL * h
  const meiaColcha = hw - m.beira * BEIRA_A_MOSTRA
  const colcha = caixa(-meiaColcha, yDobra + 1, meiaColcha, m.yPe + 0.5, 2.2)
  L.push(P(colcha, c.m.cobertor, { bisel: 2.8, ruga: 1.3, eixo: QUARTO, textura: texMatelasse(colcha), semente: 40, projeta: { dist: 1.2, forca: 0.28 } }))
  L.push(P(caixa(-meiaColcha - 0.4, yDobra, meiaColcha + 0.4, fimDaDobra, 2.4), LENCOL, { bisel: 2.6, ruga: 1.1, luz: 0.03, semente: 41, projeta: { dist: 1.5, forca: 0.34 } }))
  // O bordado da dobra: um fio da cor da colcha perto da beira.
  L.push(P(caixa(-meiaColcha + 1.6, fimDaDobra - RECUO_DO_BORDADO - FIO_DO_BORDADO, meiaColcha - 1.6, fimDaDobra - RECUO_DO_BORDADO), c.m.cobertor, { bisel: 0, contorno: 0, alfa: 0.75, semente: 42 }))
}

/** As alturas da cama, em px do protótipo. */
interface Alturas {
  readonly colchao: number
  readonly cabeceira: number
  readonly peseira: number
  /** Quanto os postes passam da cabeceira e da peseira. */
  readonly pinha: number
}

/**
 * As faces guardadas debaixo das cobertas e as duas frestas que as põem no
 * lugar na 3/4 (as frestas não fazem sombra: só dizem quanto cada face sobe).
 * `frente` = onde a peseira acaba e a fresta dela começa.
 */
function guardarFaces(c: ContextoDoMovel, cena: Cena, m: Medidas, z: Alturas, frente: number): void {
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes

  // A face da peseira e a frente dos dois postes dela, guardadas debaixo da colcha, logo atrás da fresta.
  const naPeseira: PorNaFace = (forma, mat, o) => L.push(P(guardada(forma, frente + SUBIDA_DA_PESEIRA, frente + FRESTA / 2), mat, o))
  faceDaPeseira(naPeseira, mad, hw - m.postePe, z.peseira, m.casa)
  for (const [i, x0] of [-hw, hw - m.postePe].entries()) frenteDoPoste(naPeseira, mad, x0, m.postePe, 0, z.peseira + z.pinha, 470 + i * 3)

  // A face da cabeceira e a frente dos dois postes dela, guardadas debaixo dos travesseiros, à frente da fresta:
  // sobem mais que os postes inteiros e caem para trás, cada uma no plano dela (os postes são mais grossos).
  const yPoste = -hh + m.posteCab
  const yFresta = yPoste + FRESTA_DA_CABECEIRA_A_FRENTE
  const subida = z.cabeceira + z.pinha + FOLGA_DA_CABECEIRA
  const pe = z.colchao - CABECEIRA_ATRAS_DO_COLCHAO
  const naCabeceira: PorNaFace = (forma, mat, o) => L.push(P(guardada(forma, m.yCab + subida, yFresta + FRESTA / 2), mat, o))
  const noPoste: PorNaFace = (forma, mat, o) => L.push(P(guardada(forma, yPoste + subida, yFresta + FRESTA / 2), mat, o))
  faceDaCabeceira(naCabeceira, mad, hw - m.posteCab, pe, z.cabeceira, m.casa)
  for (const [i, x0] of [-hw, hw - m.posteCab].entries()) frenteDoPoste(noPoste, mad, x0, m.posteCab, pe, z.cabeceira + z.pinha, 476 + i * 3)

  cena.sombras.push(
    { forma: caixa(-hw + RECUO_DA_FRESTA, yFresta, hw - RECUO_DA_FRESTA, yFresta + FRESTA), z: subida, solta: true, forca: 0 },
    { forma: caixa(-hw + RECUO_DA_FRESTA, frente, hw - RECUO_DA_FRESTA, frente + FRESTA), z: SUBIDA_DA_PESEIRA, solta: true, forca: 0 },
  )
}

export const montarCamaDeCasal: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const m = medidasDaCama(c)
  const z: Alturas = { colchao: g * ALTURA_DO_COLCHAO, cabeceira: g * ALTURA_DA_CABECEIRA, peseira: g * ALTURA_DA_PESEIRA, pinha: g * ALTURA_DA_PINHA }
  /** Onde a peseira e os postes dela acabam e a fresta da face começa. */
  const frente = hh - 2 * FRESTA
  const L = cena.partes

  // As faces guardadas só entram com a cama de frente. Girada na 3/4 (`c.giro`, o quarto de volta que a 3/4
  // pinta), quem olha vê o lado ou as costas da cama, de madeira lisa; e a face da cabeceira, que sobe mais que
  // o colchão que a esconde, apareceria solta por cima dele.
  if (c.giro === 0) guardarFaces(c, cena, m, z, frente)

  // As alturas: a cabeceira, o colchão, a peseira e os quatro postes.
  const colchao = caixa(-hw, m.yCab, hw, m.yPe)
  cena.sombras.push(
    contato(caixa(-hw, -hh, hw, hh, 1.5)),
    { forma: caixa(-hw, -hh, hw, m.yCab), z: z.cabeceira },
    { forma: colchao, z: z.colchao },
    { forma: caixa(-hw, m.yPe, hw, frente), z: z.peseira },
  )
  for (const x0 of [-hw, hw - m.posteCab]) cena.sombras.push({ forma: caixa(x0, -hh, x0 + m.posteCab, -hh + m.posteCab), z: z.cabeceira + z.pinha })
  for (const x0 of [-hw, hw - m.postePe]) cena.sombras.push({ forma: caixa(x0, hh - m.postePe, x0 + m.postePe, frente), z: z.peseira + z.pinha })

  // A armação (as réguas dos lados aparecem), o colchão arrumado, a peseira e, por último, a cabeceira:
  // fica por cima e faz sombra nos travesseiros.
  const meiaPeseira = hw - m.postePe
  const meiaCabeceira = hw - m.posteCab
  L.push(P(colchao, mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: 0.92, semente: 34 }))
  roupaDeCama(c, L, m)

  L.push(P(caixa(-meiaPeseira - 1, m.yPe, meiaPeseira + 1, hh, 0.8), mad, { tabua: 0, bisel: 1.3, semente: 43 }))
  const meioDaPeseira = (m.yPe + hh) / 2
  L.push(P(caixa(-meiaPeseira, meioDaPeseira - 1.1, meiaPeseira, meioDaPeseira + 1.1, 1.1), mad, { tabua: 0, bisel: 1.1, tom: 1.07, contorno: 0.12, textura: texCordao, semente: 44 }))
  for (const [i, x0] of [-hw, hw - m.postePe].entries()) poste(L, P, mad, x0, hh - m.postePe, m.postePe, 45 + i * 3)

  L.push(P(caixa(-meiaCabeceira - 1, -hh + 0.8, meiaCabeceira + 1, m.yCab, 0.8), mad, { tabua: 0, bisel: 1.5, semente: 51, projeta: { dist: 3.4, forca: 0.32, suave: 1.6 } }))
  const meioDaCabeceira = (-hh + 0.8 + m.yCab) / 2
  L.push(P(caixa(-meiaCabeceira, meioDaCabeceira - 1.4, meiaCabeceira, meioDaCabeceira + 1.4, 1.4), mad, { tabua: 0, bisel: 1.4, tom: 1.07, contorno: 0.12, textura: texCordao, semente: 52 }))
  const mf = Math.min(m.casa * MEIO_FLORAO, meiaCabeceira * 0.5)
  const placa = caixa(-mf, -hh + 0.3, mf, m.yCab + SALIENCIA_DO_FLORAO, 1.4)
  florao((forma, mat, o) => L.push(P(forma, mat, o)), mad, placa, 0, meioDaCabeceira, Math.min(5.4, mf * 0.5), (m.yCab + hh) * 0.3, 53, true)
  for (const [i, x0] of [-hw, hw - m.posteCab].entries()) poste(L, P, mad, x0, -hh, m.posteCab, 56 + i * 3)
}

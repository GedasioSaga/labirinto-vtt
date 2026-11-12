/**
 * CARROÇA QUEBRADA de cima com volume (lote 11 dos objetos novos, 11/11/2026): a carroça de feira do app
 * (`carroca.ts`) depois de um acidente, arriada num canto. O EIXO partiu do lado de baixo: a roda de lá saiu e
 * está DEITADA no chão ao lado, mostrando os oito raios (um arrancado, outro partido ao meio) e o toco do eixo
 * no cubo; a caçamba caiu para esse lado, com a tábua da borda arrebentada, uma tábua do fundo faltando e o
 * toco do eixo saindo por baixo. A OUTRA RODA continua presa, mas torta: inclinada, aparece de viés, em elipse.
 * Um dos VARAIS rachou ao meio e a ponta caiu; a travessa ficou só no outro. Em volta, as TÁBUAS que soltaram
 * da caçamba e a CARGA espalhada: um saco ainda dentro, outro no chão com o grão saindo, e um CAIXOTE aberto,
 * com as couves.
 *
 * Tem de ler como a carroça que o app já tem: a mesma caçamba (a borda de tábuas e o fundo de tábuas ao
 * comprido), os mesmos varais com a travessa, os sacos de linho e a roda de raios com o aro de ferro. A 25%
 * de zoom sobram o retângulo da caçamba, a roda deitada (o círculo com os raios, a pista mais forte de
 * "carroça") e os varais para a esquerda.
 *
 * Materiais: `madeira` e `aros`, os da carroça. O linho dos sacos, o grão, as couves e o ferro dos pregos são
 * fixos. O comprimento sai da largura da pegada e a largura, da altura dela (2 x 1,5 casas de
 * partida); o que é redondo (as rodas, os sacos, as couves) sai do lado que menos esticou.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { anel, barra, capsula, dentroDe, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca, type Peca } from './motor'
import { BURACO, G, materialDaPeca, PREGO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- a pegada de partida e as medidas (px do protótipo nela, com o meio em (0, 0)) ----------

/** A pegada de partida: 2 x 1,5 casas. As medidas do desenho valem nela; esticada, cada eixo escala com o seu lado. */
const LARGURA_DE_PARTIDA = 2 * G
const ALTURA_DE_PARTIDA = 1.5 * G

/** A caçamba: o meio, o meio comprimento, a meia largura, o giro (a ponta de trás, à direita, desceu um pouco) e a tábua da borda. */
const CACAMBA = { x: 6, y: -9, meioComp: 36, meiaLarg: 21, ang: 0.06, borda: 2.8 }
/** As tábuas do fundo da caçamba (cinco na largura) e a que falta, do lado que desceu: de onde a onde ao comprido. */
const TABUAS_DO_FUNDO = 5
const FALTA_NO_FUNDO: readonly [number, number] = [-6, 15]
/** A borda de baixo arrebentou: os dois pedaços que ficaram, ao comprido da caçamba (o vão entre eles caiu no chão). */
const BORDA_QUE_FICOU: readonly (readonly [number, number])[] = [[-36, -7], [15, 36]]
/** A altura da caçamba (casas): a do lado que ficou no ar. O lado de baixo encosta no chão. */
const ALTURA_DA_CACAMBA = 0.32
/**
 * A face de fora do lado que ficou no ar (px): com a caçamba arriada para o outro lado, ela se deita para cima e
 * aparece de cima, acima da borda. É o que diz "tombou", e não "está parada"; o tom é o de uma face meio de lado.
 */
const FACE_DO_LADO_ALTO = 5
const TOM_DA_FACE_ALTA = 0.82

/** As rodas: o raio (px), a largura do aro de ferro e da cambota (frações do raio) e quantos raios. */
const RAIO_DA_RODA = 15
const ARO_DA_RODA = 0.1
const CAMBOTA = 0.14
const RAIOS = 8
/** A roda deitada no chão: o meio, o raio que foi arrancado e o que partiu ao meio (pela ordem dos raios). */
const RODA_SOLTA = { x: -33, y: 21, giro: 0.2, arrancado: 2, partido: 5 }
/**
 * A roda presa e torta: o meio, o giro e quanto ela aparece (1 = de frente; inclinada, a elipse achata). Com a
 * caçamba arriada, o alto da roda se deita por cima da borda: a elipse cobre a borda, e a roda lê como presa.
 */
const RODA_PRESA = { x: 10, y: -31, giro: 0.24, achata: 0.42 }
/** A altura do cubo da roda deitada (casas): ele fica de pé, para cima, e faz sombra. */
const ALTURA_DO_CUBO = 0.16

/** Os varais, a partir da frente da caçamba (px no referencial dela): o de cima inteiro; o de baixo partido. */
const AFASTAMENTO_DO_VARAL = 8.4
const LARGURA_DO_VARAL = 2.8
const COMPRIMENTO_DO_VARAL = 25
/** O varal de baixo: onde rachou (px antes da ponta da frente) e o quanto a ponta caída girou e desceu. */
const RACHOU_EM = 12
const GIRO_DA_PONTA_CAIDA = 0.34

/** O toco do eixo que ficou na caçamba, saindo por baixo do lado que desceu: onde (ao comprido) e quanto sai. */
const TOCO_DO_EIXO = { em: 6, sai: 7, larg: 4.2 }

/** Como a ponta de uma tábua acabou: inteira (o corte, com os pregos) ou lascada. */
type Ponta = 'inteira' | 'lascada'
/** Uma tábua solta no chão: de onde a onde (px) e as pontas. */
interface TabuaSolta {
  readonly de: Ponto
  readonly ate: Ponto
  readonly larg: number
  readonly pontas: readonly [Ponta, Ponta]
  readonly tom: number
}
/** As tábuas soltas: o vão da borda arrebentada (embaixo), uma do fundo (no alto à esquerda) e uma que voou para o alto à direita. */
const TABUAS_SOLTAS: readonly TabuaSolta[] = [
  { de: [-14, 21], ate: [6, 24], larg: 4.4, pontas: ['lascada', 'lascada'], tom: 0.96 },
  { de: [-55, -35], ate: [-33, -39], larg: 4.4, pontas: ['inteira', 'lascada'], tom: 1.04 },
  { de: [30, -37], ate: [53, -33], larg: 6.6, pontas: ['lascada', 'inteira'], tom: 0.92 },
]

/** A carga: o saco que ficou na caçamba (no referencial dela) e o que caiu (com a boca para a esquerda, e o grão saindo). */
const SACO_DENTRO = { x: -8, y: 5, rx: 13, ry: 10, tom: 0.8 }
const SACO_CAIDO = { x: 27, y: 27, rx: 12.5, ry: 8.6, ang: -0.35, tom: 0.74 }
/**
 * O grão espalhado da boca do saco caído: o meio do monte e os raios dele; os grãos por cima do monte e os
 * soltos em volta. Liso, o monte lia como uma almofada amarela: são os grãos um a um que dizem "grão".
 */
const GRAO_ESPALHADO = { x: 11, y: 33, rx: 7.5, ry: 4.6 }
const GRAOS_NO_MONTE = 34
const GRAOS = 22
/** O caixote aberto: o meio, as meias medidas e o giro; as couves dentro e a que rolou para fora. */
const CAIXOTE = { x: 44, y: 24, meioComp: 9.5, meiaLarg: 8, ang: 0.32 }
const COUVES: readonly (readonly [number, number, number])[] = [
  [40.8, 22.2, 4.4],
  [46.6, 26.4, 4],
  [49, 37.6, 3.6],
]

/** As lascas soltas: o meio (px), o comprimento e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [-46, 9, 5, 0.6],
  [-20, 34, 4.5, -0.4],
  [19, 15, 4, 1.9],
  [-2, -40, 4, 0.2],
]

// ---------- os materiais fixos ----------

/** A madeira de dentro, na quebra: o cerne claro dos destroços (`destrocos.ts`). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.58
/** O grão dos sacos (`sacosDeGrao.ts`). */
const GRAO: MaterialDaPeca = { classe: 'liso', rgb: [0xcb, 0xa6, 0x66] }
/**
 * As couves: o verde da folha de fora, contido, enrugado, e o miolo mais claro, macio e sem contorno (com
 * contorno, o miolo virava a pupila de um olho).
 */
const COUVE: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x91, 0x58] }
const MIOLO_DA_COUVE: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0xb8, 0x7c] }
const RUGA_DA_COUVE = 2.2
/** A sombra debaixo da caçamba, que aparece onde falta uma tábua do fundo. */
const DEBAIXO_DA_CACAMBA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x24, 0x1c] }

/** Dentes de uma ponta lascada e o fundo deles (em larguras da tábua). */
const DENTES = 3
const FUNDO_DOS_DENTES = 1.3

// ---------- ajudantes ----------

/** Onde as coisas vão na pegada: a pegada de partida escalada, cada eixo pelo seu lado. */
interface Pegada {
  readonly sx: number
  readonly sy: number
  /** O lado que menos esticou: o que é redondo escala por ele. */
  readonly s: number
}

function noMapa(p: Pegada, [x, y]: Ponto): Ponto {
  return [x * p.sx, y * p.sy]
}

/** Um ponto no referencial da caçamba (x ao comprido, para a traseira; y através, para o lado que desceu), na pegada. */
function naCacamba(p: Pegada, x: number, y: number): Ponto {
  const co = Math.cos(CACAMBA.ang)
  const si = Math.sin(CACAMBA.ang)
  return noMapa(p, [CACAMBA.x + x * co - y * si, CACAMBA.y + x * si + y * co])
}

/** O quadrilátero de (x0, y0) a (x1, y1) no referencial da caçamba. */
function naCacambaQuadro(p: Pegada, x0: number, y0: number, x1: number, y1: number): Forma {
  return poligono([naCacamba(p, x0, y0), naCacamba(p, x1, y0), naCacamba(p, x1, y1), naCacamba(p, x0, y1)])
}

/** O contorno de uma tábua no referencial dela (x de 0 a `comp`, y através), com cada ponta inteira ou lascada em dentes. */
function contornoDaTabua(comp: number, larg: number, pontas: readonly [Ponta, Ponta], sem: number): Ponto[] {
  const meia = larg / 2
  const ponta = (lado: 0 | 1): Ponto[] => {
    const x = lado === 0 ? 0 : comp
    const para = lado === 0 ? 1 : -1
    // De uma beira à outra: a de trás vai de baixo para cima, a da frente de cima para baixo.
    const [y0, y1] = lado === 0 ? [meia, -meia] : [-meia, meia]
    if (pontas[lado] === 'inteira') return [[x, y0], [x, y1]]
    const pontos: Ponto[] = []
    for (let k = 0; k <= DENTES * 2; k += 1) {
      const entra = k % 2 === 1 ? 0.4 + 0.6 * hash(k, sem + lado, 71) : 0.12 * hash(k, sem + lado, 72)
      pontos.push([x + para * larg * FUNDO_DOS_DENTES * entra, y0 + ((y1 - y0) * k) / (DENTES * 2)])
    }
    return pontos
  }
  return [...ponta(0), ...ponta(1)]
}

/**
 * Uma tábua de `de` a `ate` (px na pegada), com as pontas lascadas mostrando o cerne e as inteiras com os dois
 * pregos. `z` = a altura dela (px): a sombra arrastada.
 */
function montarTabua(c: ContextoDoMovel, cena: Cena, L: Peca[], de: Ponto, ate: Ponto, larg: number, pontas: readonly [Ponta, Ponta], tom: number, z: number, sem: number): Forma {
  const P = c.peca
  const mad = c.m.madeira
  const ang = Math.atan2(ate[1] - de[1], ate[0] - de[0])
  const comp = Math.hypot(ate[0] - de[0], ate[1] - de[1])
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const naTabua = ([x, y]: Ponto): Ponto => [de[0] + x * co - y * si, de[1] + x * si + y * co]
  const forma = poligono(contornoDaTabua(comp, larg, pontas, sem).map(naTabua))
  cena.sombras.push({ forma, z, forca: 0.26 }, contato(forma, 0.24))
  L.push(P(forma, mad, { eixo: ang, tabua: 0, bisel: 1, tom, contorno: 0.28, semente: sem, projeta: { dist: 0.8, forca: 0.3 } }))
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  for (const lado of [0, 1] as const) {
    const x = lado === 0 ? 0 : comp
    const para = lado === 0 ? 1 : -1
    if (pontas[lado] === 'lascada') {
      const [ax, ay] = naTabua([x - para, 0])
      const [bx, by] = naTabua([x + para * larg * FUNDO_DOS_DENTES * 0.9, 0])
      L.push(P(dentroDe(forma, barra(ax, ay, bx, by, larg + 2)), quebra, { eixo: ang, tabua: 0, bisel: 0.5, contorno: 0.16, semente: sem + 1 + lado }))
      continue
    }
    for (const v of [-0.3, 0.3]) {
      const [px, py] = naTabua([x + para * larg * 0.4, v * larg])
      L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
    }
  }
  return forma
}

/** Uma roda de raios (a da carroça): o meio, o raio, o giro e o achatamento (1 = deitada, de frente para cima). */
interface Roda {
  readonly cx: number
  readonly cy: number
  readonly raio: number
  readonly giro: number
  readonly achata: number
  /** O raio arrancado (só os tocos ficam) e o partido ao meio, pela ordem; -1 = nenhum. */
  readonly arrancado: number
  readonly partido: number
  readonly sem: number
}

/**
 * A roda de raios vista de frente (deitada) ou de viés (inclinada, `achata` < 1), como a de `carroca.ts`: os
 * raios, a cambota de madeira, o aro de ferro por fora e o cubo com o miolo de ferro. Na deitada, o cubo fica de
 * pé e mostra o toco do eixo partido.
 */
function montarRoda(c: ContextoDoMovel, cena: Cena, L: Peca[], r: Roda): void {
  const P = c.peca
  const mad = c.m.madeira
  const aro = c.m.aros
  const co = Math.cos(r.giro)
  const si = Math.sin(r.giro)
  const ponto = (u: number, v: number): Ponto => [r.cx + u * co - v * r.achata * si, r.cy + u * si + v * r.achata * co]
  const roda = (raio: number): Forma => elipseGirada(r.cx, r.cy, raio, raio * r.achata, r.giro)
  const larguraDoAro = Math.max(1.6, r.raio * ARO_DA_RODA)
  const cambota = Math.max(2, r.raio * CAMBOTA)
  const dentroDaCambota = r.raio - larguraDoAro - cambota
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  const deitada = r.achata >= 1
  const anelDa = (fora: number, dentro: number): Forma => (deitada ? anel(r.cx, r.cy, fora, fora, dentro, dentro) : menos(roda(fora), roda(dentro)))

  // A sombra: deitada, o aro rente ao chão e o cubo de pé; inclinada, a roda inteira no ar.
  const volta = anelDa(r.raio, dentroDaCambota)
  cena.sombras.push(deitada ? { forma: volta, z: 2.4, forca: 0.28 } : { forma: volta, z: c.g * 0.3, forca: 0.22 }, contato(volta, 0.26))

  // Os raios: do cubo à cambota; o arrancado deixou só os tocos, o partido acaba em lasca no meio do caminho.
  const raioDoCubo = r.raio * 0.2
  const grossura = Math.max(1.6, r.raio * 0.09)
  for (let i = 0; i < RAIOS; i += 1) {
    const a = (i / RAIOS) * 2 * Math.PI + 0.2
    const [ca, sa] = [Math.cos(a), Math.sin(a)]
    const trechos: (readonly [number, number, boolean])[] =
      i === r.arrancado ? [[raioDoCubo, raioDoCubo + 3, true], [dentroDaCambota - 2.6, dentroDaCambota + 0.5, true]] : i === r.partido ? [[raioDoCubo, dentroDaCambota * 0.6, true]] : [[raioDoCubo, dentroDaCambota + 0.5, false]]
    trechos.forEach(([de, ate, lascado], k) => {
      const [ax, ay] = ponto(ca * de, sa * de)
      const [bx, by] = ponto(ca * ate, sa * ate)
      const raio = barra(ax, ay, bx, by, grossura)
      if (deitada) cena.sombras.push({ forma: raio, z: 1.6, forca: 0.24 })
      L.push(P(raio, mad, { tabua: 0, eixo: Math.atan2(by - ay, bx - ax), bisel: 0.7, tom: 0.92, contorno: 0.26, semente: r.sem + i * 3 + k }))
      if (!lascado) return
      // A ponta quebrada do raio: o cerne claro, do lado de onde ele se partiu.
      const fim = k === 0 ? ate : de
      const [qx, qy] = ponto(ca * fim, sa * fim)
      L.push(P(elipse(qx, qy, grossura * 0.55, grossura * 0.55), quebra, { bisel: 0.4, contorno: 0.2, semente: r.sem + i * 3 + 2 }))
    })
  }
  // A cambota de madeira (rachada perto do raio arrancado, na deitada) e o aro de ferro por fora.
  const arco = deitada ? { cx: r.cx, cy: r.cy, r: dentroDaCambota + cambota / 2, a0: 0 } : undefined
  L.push(P(anelDa(r.raio - larguraDoAro + 0.3, dentroDaCambota), mad, { arco, eixo: r.giro, tabua: 0, bisel: 1, contorno: 0.26, semente: r.sem + 40 }))
  if (deitada) {
    const a = ((r.arrancado + 0.5) / RAIOS) * 2 * Math.PI + 0.2
    const [ax, ay] = ponto(Math.cos(a) * (dentroDaCambota - 0.4), Math.sin(a) * (dentroDaCambota - 0.4))
    const [bx, by] = ponto(Math.cos(a + 0.05) * (r.raio - larguraDoAro + 0.6), Math.sin(a + 0.05) * (r.raio - larguraDoAro + 0.6))
    L.push(P(capsula(ax, ay, bx, by, 0.45), BURACO, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.4, semente: r.sem + 41 }))
  }
  L.push(P(anelDa(r.raio, r.raio - larguraDoAro), aro, { bisel: 0.8, contorno: 0.3, semente: r.sem + 42 }))
  // O cubo de madeira e o miolo: na deitada, o cubo fica de pé e o miolo é o toco do eixo partido (o cerne claro);
  // na presa, o miolo é o ferro do eixo.
  const cubo = deitada ? elipse(r.cx, r.cy, raioDoCubo, raioDoCubo) : roda(raioDoCubo)
  if (deitada) cena.sombras.push({ forma: cubo, z: c.g * ALTURA_DO_CUBO, forca: 0.3 })
  L.push(P(cubo, mad, { tabua: 0, bisel: raioDoCubo * 0.6, tom: 0.86, contorno: 0.28, semente: r.sem + 43, projeta: { dist: deitada ? 2.4 : 1, forca: 0.32 } }))
  const miolo = r.raio * 0.09
  L.push(P(deitada ? elipse(r.cx, r.cy, miolo, miolo) : roda(miolo), deitada ? quebra : aro, { tabua: 0, bisel: miolo * 0.6, contorno: 0.3, semente: r.sem + 44 }))
}

/** Um saco de linho (o da carroça): a elipse fofa, enrugada, que faz sombra no que está embaixo. */
function montarSaco(c: ContextoDoMovel, cena: Cena, L: Peca[], forma: Forma, tom: number, z: number, sem: number): void {
  cena.sombras.push({ forma, z, forca: 0.28 }, contato(forma, 0.26))
  L.push(c.peca(forma, materialDaPeca('linho'), { bisel: 5, ruga: 1.5, tom, contorno: 0.24, semente: sem, projeta: { dist: 2, forca: 0.3 } }))
}

/** Uma couve: a bola de folhas enrugadas e o miolo claro, macio, do lado da luz. */
function montarCouve(c: ContextoDoMovel, L: Peca[], [x, y]: Ponto, raio: number, sem: number): Forma {
  const P = c.peca
  const couve = elipse(x, y, raio, raio)
  L.push(P(couve, COUVE, { bisel: raio * 0.6, ruga: RUGA_DA_COUVE, contorno: 0.26, semente: sem, projeta: { dist: 1.4, forca: 0.3 } }))
  L.push(P(elipse(x - raio * 0.12, y - raio * 0.14, raio * 0.5, raio * 0.5), MIOLO_DA_COUVE, { bisel: 0, contorno: 0, alfa: 0.55, suave: raio * 0.3, semente: sem + 1 }))
  return couve
}

/** O caixote aberto, como o de `caixa.ts` sem a tampa: as quatro tábuas da borda, o fundo afundado e as couves. */
function montarCaixote(c: ContextoDoMovel, cena: Cena, L: Peca[], p: Pegada): void {
  const P = c.peca
  const mad = c.m.madeira
  const co = Math.cos(CAIXOTE.ang)
  const si = Math.sin(CAIXOTE.ang)
  const [mx, my] = noMapa(p, [CAIXOTE.x, CAIXOTE.y])
  const a = CAIXOTE.meioComp * p.s
  const b = CAIXOTE.meiaLarg * p.s
  const borda = Math.min(a, b) * 0.3
  const quadro = (x0: number, y0: number, x1: number, y1: number): Forma =>
    poligono([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]): Ponto => [mx + x * co - y * si, my + x * si + y * co]))
  const corpo = quadro(-a, -b, a, b)
  cena.sombras.push({ forma: corpo, z: c.g * 0.3, forca: 0.3 }, contato(corpo, 0.28))
  L.push(P(quadro(-a + borda, -b + borda, a - borda, b - borda), mad, { eixo: CAIXOTE.ang, tabua: (2 * (b - borda)) / 3, bisel: 0.5, tom: 0.72, recesso: { k: 2.4, forca: 0.4 }, semente: 4700 }))
  // As couves dentro, por baixo da borda (a que rolou para fora vai no chão, antes).
  COUVES.slice(0, 2).forEach(([fx, fy, raio], k) => montarCouve(c, L, noMapa(p, [fx, fy]), raio * p.s, 4710 + k * 2))
  // A borda: as duas tábuas compridas e as duas de cabeça, com um prego em cada canto.
  L.push(P(quadro(-a, -b, a, -b + borda), mad, { eixo: CAIXOTE.ang, tabua: 0, bisel: 0.9, semente: 4720 }))
  L.push(P(quadro(-a, b - borda, a, b), mad, { eixo: CAIXOTE.ang, tabua: 0, bisel: 0.9, semente: 4721 }))
  L.push(P(quadro(-a, -b, -a + borda, b), mad, { eixo: CAIXOTE.ang + Math.PI / 2, tabua: 0, bisel: 0.9, tom: 0.94, semente: 4722 }))
  L.push(P(quadro(a - borda, -b, a, b), mad, { eixo: CAIXOTE.ang + Math.PI / 2, tabua: 0, bisel: 0.9, tom: 0.94, semente: 4723 }))
  for (const [x, y] of [[-a + borda / 2, -b + borda / 2], [a - borda / 2, -b + borda / 2], [-a + borda / 2, b - borda / 2], [a - borda / 2, b - borda / 2]]) {
    L.push(P(elipse(mx + x * co - y * si, my + x * si + y * co, 0.6, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
  }
}

// ---------- o desenho ----------

export const montarCarrocaQuebrada: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const sx = c.w / LARGURA_DE_PARTIDA
  const sy = c.h / ALTURA_DE_PARTIDA
  const p: Pegada = { sx, sy, s: Math.min(sx, sy) }
  const mad = c.m.madeira
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  const { meioComp: mc, meiaLarg: ml, borda } = CACAMBA

  // No chão, por baixo de tudo: as lascas, o grão espalhado e as tábuas soltas.
  LASCAS.forEach(([x, y, comp, ang], k) => {
    const [mx, my] = noMapa(p, [x, y])
    const meio = (comp * p.s) / 2
    const forma = capsula(mx - Math.cos(ang) * meio, my - Math.sin(ang) * meio, mx + Math.cos(ang) * meio, my + Math.sin(ang) * meio, 0.7)
    cena.sombras.push(contato(forma, 0.2))
    L.push(P(forma, quebra, { eixo: ang, tabua: 0, bisel: 0.5, contorno: 0.24, semente: 4600 + k }))
  })
  const [gx, gy] = noMapa(p, [GRAO_ESPALHADO.x, GRAO_ESPALHADO.y])
  const monte = elipseGirada(gx, gy, GRAO_ESPALHADO.rx * p.s, GRAO_ESPALHADO.ry * p.s, -0.2)
  cena.sombras.push(contato(monte, 0.2))
  L.push(P(monte, GRAO, { bisel: 1, ruga: 2.6, tom: 0.9, contorno: 0.2, semente: 4610 }))
  for (let k = 0; k < GRAOS_NO_MONTE; k += 1) {
    // Espalhados por igual no monte (a raiz do sorteio no raio), cada um virado para um lado.
    const t = hash(k, 4, 97) * 2 * Math.PI
    const longe = Math.sqrt(hash(k, 5, 97)) * 0.9
    const x = gx + Math.cos(t) * GRAO_ESPALHADO.rx * p.s * longe
    const y = gy + Math.sin(t) * GRAO_ESPALHADO.ry * p.s * longe
    L.push(P(elipseGirada(x, y, 0.8, 0.55, hash(k, 6, 97) * Math.PI), GRAO, { bisel: 0.5, contorno: 0.24, tom: 0.86 + 0.28 * hash(k, 7, 97), semente: 4900 + k }))
  }
  for (let k = 0; k < GRAOS; k += 1) {
    const t = hash(k, 1, 97) * 2 * Math.PI
    const longe = 0.9 + 0.7 * hash(k, 2, 97)
    const x = gx + Math.cos(t) * GRAO_ESPALHADO.rx * p.s * longe
    const y = gy + Math.sin(t) * GRAO_ESPALHADO.ry * p.s * longe
    L.push(P(elipseGirada(x, y, 0.8, 0.55, t), GRAO, { bisel: 0.5, contorno: 0.3, tom: 0.88 + 0.24 * hash(k, 3, 97), semente: 4620 + k }))
  }
  TABUAS_SOLTAS.forEach((t, k) => montarTabua(c, cena, L, noMapa(p, t.de), noMapa(p, t.ate), t.larg * p.s, t.pontas, t.tom, 1.6, 4630 + k * 4))

  // A ponta do varal que rachou, caída no chão.
  const pontaDoVaral = (x: number): Ponto => naCacamba(p, -mc - x, AFASTAMENTO_DO_VARAL)
  const rachou = pontaDoVaral(RACHOU_EM + 1.5)
  const giro = GIRO_DA_PONTA_CAIDA
  const [rx, ry] = rachou
  const [fx, fy] = pontaDoVaral(COMPRIMENTO_DO_VARAL)
  const caida: Ponto = [rx + (fx - rx) * Math.cos(giro) - (fy - ry) * Math.sin(giro), ry + (fx - rx) * Math.sin(giro) + (fy - ry) * Math.cos(giro)]
  montarTabua(c, cena, L, rachou, caida, LARGURA_DO_VARAL * p.s, ['lascada', 'inteira'], 0.9, 1.6, 4650)

  // A roda solta, deitada no chão, e o saco caído com a boca aberta para o grão.
  const [rsx, rsy] = noMapa(p, [RODA_SOLTA.x, RODA_SOLTA.y])
  montarRoda(c, cena, L, { cx: rsx, cy: rsy, raio: RAIO_DA_RODA * p.s, giro: RODA_SOLTA.giro, achata: 1, arrancado: RODA_SOLTA.arrancado, partido: RODA_SOLTA.partido, sem: 4400 })
  const [scx, scy] = noMapa(p, [SACO_CAIDO.x, SACO_CAIDO.y])
  const sacoCaido = elipseGirada(scx, scy, SACO_CAIDO.rx * p.s, SACO_CAIDO.ry * p.s, SACO_CAIDO.ang)
  montarSaco(c, cena, L, sacoCaido, SACO_CAIDO.tom, c.g * 0.2, 4660)
  const boca = (k: number): Ponto => [scx - Math.cos(SACO_CAIDO.ang) * SACO_CAIDO.rx * p.s * k, scy - Math.sin(SACO_CAIDO.ang) * SACO_CAIDO.rx * p.s * k]
  const [bx, by] = boca(0.86)
  L.push(P(elipseGirada(bx, by, SACO_CAIDO.ry * p.s * 0.26, SACO_CAIDO.ry * p.s * 0.52, SACO_CAIDO.ang), BURACO, { bisel: 0, contorno: 0, alfa: 0.62, suave: 0.6, semente: 4661 }))
  const [b2x, b2y] = boca(0.98)
  L.push(P(elipseGirada(b2x, b2y, SACO_CAIDO.ry * p.s * 0.16, SACO_CAIDO.ry * p.s * 0.36, SACO_CAIDO.ang), GRAO, { bisel: 0.8, ruga: 1.4, contorno: 0.2, semente: 4662 }))

  // O caixote aberto e a couve que rolou para fora (essa, no chão, faz sombra; as de dentro ficam na do caixote).
  const [cx3, cy3, r3] = COUVES[2]
  const couve = montarCouve(c, L, noMapa(p, [cx3, cy3]), r3 * p.s, 4716)
  cena.sombras.push({ forma: couve, z: r3 * p.s, forca: 0.28 }, contato(couve, 0.26))
  montarCaixote(c, cena, L, p)

  // Os varais, por baixo da caçamba: o de cima inteiro, com a travessa torta; o de baixo, só o toco até onde rachou.
  const ponta = -mc - COMPRIMENTO_DO_VARAL
  const varal = (de: number, ate: number, y: number): Forma => {
    const larg = (LARGURA_DO_VARAL * p.s) / 2
    return naCacambaQuadro(p, de, y - larg, ate, y + larg)
  }
  const varalDeCima = varal(ponta, -mc + 4, -AFASTAMENTO_DO_VARAL)
  cena.sombras.push({ forma: varalDeCima, z: 3, forca: 0.26 }, contato(varalDeCima, 0.24))
  L.push(P(varalDeCima, mad, { eixo: CACAMBA.ang, tabua: 0, bisel: 0.9, semente: 4500 }))
  const toco = montarTabua(c, cena, L, naCacamba(p, -mc + 4, AFASTAMENTO_DO_VARAL), naCacamba(p, -mc - RACHOU_EM, AFASTAMENTO_DO_VARAL), LARGURA_DO_VARAL * p.s, ['inteira', 'lascada'], 1, 3, 4510)
  // A racha que correu pelo toco antes de partir: a madeira aberta, escurecida, perto da quebra.
  L.push(P(dentroDe(toco, elipse(...naCacamba(p, -mc - RACHOU_EM * 0.5, AFASTAMENTO_DO_VARAL), 6, 6)), BURACO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.4, semente: 4515 }))
  const [t0x, t0y] = naCacamba(p, ponta, -AFASTAMENTO_DO_VARAL - 4.5)
  const [t1x, t1y] = naCacamba(p, ponta + 3.4, AFASTAMENTO_DO_VARAL - 1)
  const travessa = barra(t0x, t0y, t1x, t1y, 3.2 * p.s)
  cena.sombras.push({ forma: travessa, z: 3, forca: 0.26 }, contato(travessa, 0.24))
  L.push(P(travessa, mad, { eixo: Math.atan2(t1y - t0y, t1x - t0x), tabua: 0, bisel: 0.8, tom: 0.96, semente: 4520 }))

  // O toco do eixo saindo por baixo do lado que desceu, com a ponta lascada.
  montarTabua(c, cena, L, naCacamba(p, TOCO_DO_EIXO.em, ml - 3), naCacamba(p, TOCO_DO_EIXO.em, ml + TOCO_DO_EIXO.sai), TOCO_DO_EIXO.larg * p.s, ['inteira', 'lascada'], 0.84, 2, 4530)

  // A caçamba, arriada: a sombra no ar do lado de cima e encostada no chão do lado de baixo.
  const corpo = naCacambaQuadro(p, -mc, -ml - FACE_DO_LADO_ALTO, mc, ml)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DA_CACAMBA, solta: true, forca: 0.3 }, contato(naCacambaQuadro(p, -mc, ml - 3, mc, ml), 0.3))
  // A face de fora do lado alto, deitada para cima: duas tábuas ao comprido.
  const faceAlta = naCacambaQuadro(p, -mc, -ml - FACE_DO_LADO_ALTO, mc, -ml)
  L.push(P(faceAlta, mad, { eixo: CACAMBA.ang, tabua: (FACE_DO_LADO_ALTO * p.sy) / 2, bisel: 0.8, tom: TOM_DA_FACE_ALTA, contorno: 0.28, semente: 4539 }))
  // O fundo de tábuas ao comprido, afundado, e o vão da tábua que falta (a sombra debaixo da caçamba).
  L.push(P(naCacambaQuadro(p, -mc + borda, -ml + borda, mc - borda, ml - borda), mad, { eixo: CACAMBA.ang, tabua: ((ml - borda) * 2 * p.sy) / TABUAS_DO_FUNDO, bisel: 0.8, tom: 0.9, recesso: { k: 2, forca: 0.24 }, semente: 4540 }))
  const tabuaDoFundo = ((ml - borda) * 2) / TABUAS_DO_FUNDO
  const vao = naCacambaQuadro(p, FALTA_NO_FUNDO[0], ml - borda - tabuaDoFundo, FALTA_NO_FUNDO[1], ml - borda)
  L.push(P(vao, DEBAIXO_DA_CACAMBA, { bisel: 0, contorno: 0.3, alfa: 0.9, tom: 0.6, semente: 4541 }))
  for (const [k, x] of FALTA_NO_FUNDO.entries()) {
    // As pontas da tábua do fundo que ficou, lascadas, dos dois lados do vão.
    const lado = k === 0 ? -1 : 1
    L.push(P(naCacambaQuadro(p, x + lado * 2.2, ml - borda - tabuaDoFundo, x + lado * 0.2, ml - borda), quebra, { bisel: 0.4, contorno: 0.2, semente: 4542 + k }))
  }
  // O saco que ficou dentro, escorregado para o lado que desceu.
  const [sdx, sdy] = naCacamba(p, SACO_DENTRO.x, SACO_DENTRO.y)
  montarSaco(c, cena, L, elipseGirada(sdx, sdy, SACO_DENTRO.rx * p.s, SACO_DENTRO.ry * p.s, CACAMBA.ang), SACO_DENTRO.tom, c.g * 0.18, 4550)
  // A borda: a de cima, a da frente e a de trás inteiras; a de baixo arrebentada, só os dois pedaços.
  L.push(P(naCacambaQuadro(p, -mc, -ml, mc, -ml + borda), mad, { eixo: CACAMBA.ang, tabua: 0, bisel: 1.1, semente: 4560 }))
  L.push(P(naCacambaQuadro(p, -mc, -ml, -mc + borda, ml), mad, { eixo: CACAMBA.ang + Math.PI / 2, tabua: 0, bisel: 1.1, tom: 0.96, semente: 4561 }))
  L.push(P(naCacambaQuadro(p, mc - borda, -ml, mc, ml), mad, { eixo: CACAMBA.ang + Math.PI / 2, tabua: 0, bisel: 1.1, tom: 0.96, semente: 4562 }))
  BORDA_QUE_FICOU.forEach(([de, ate], k) => {
    const pontas: readonly [Ponta, Ponta] = k === 0 ? ['inteira', 'lascada'] : ['lascada', 'inteira']
    montarTabua(c, cena, L, naCacamba(p, de, ml - borda / 2), naCacamba(p, ate, ml - borda / 2), borda * p.sy, pontas, 1, 0, 4570 + k * 4)
  })

  // A roda que ficou presa, torta, por cima da borda de cima.
  const [rpx, rpy] = noMapa(p, [RODA_PRESA.x, RODA_PRESA.y])
  montarRoda(c, cena, L, { cx: rpx, cy: rpy, raio: RAIO_DA_RODA * p.s, giro: RODA_PRESA.giro, achata: RODA_PRESA.achata, arrancado: -1, partido: -1, sem: 4800 })
}

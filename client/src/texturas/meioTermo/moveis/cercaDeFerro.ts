/**
 * CERCA DE FERRO de cima com volume (11/11/2026, lote 8 dos objetos novos,
 * grupo Cemitério): um TRECHO da grade do cemitério, que o mestre estica e
 * emenda para cercar as covas. Barras de ferro escuro com ponta de lança, duas
 * travessas, um pilarete de pedra em cada ponta e ferrugem discreta.
 *
 * De cima a grade é uma LINHA DE PONTAS: a travessa de cima, a ponta de cada
 * barra (um losango de ferro, mais largo que a travessa) e a capa de pedra dos
 * pilaretes, com a pirâmide e o líquen. O que diz "grade" é a SOMBRA dela,
 * riscada no chão: cada barra deixa uma risca na direção da luz, cada travessa
 * uma linha paralela à cerca, cada lança uma ponta no fim da risca. Tufos de
 * capim nascem ao pé, os da cova e da lápide.
 *
 * O desenho se REPARTE pelo comprimento, como a cerca de madeira reparte os
 * mourões: o trecho esticado ganha mais barras, nunca barras mais largas (uma
 * a cada `PASSO_DAS_BARRAS` casa). Cada pilarete tem o MEIO na ponta da
 * pegada: dois trechos encostados põem os pilaretes um em cima do outro, e a
 * emenda vira um pilarete só (meio pilarete passa da pegada em cada ponta). A
 * cerca corre pelo lado MAIOR da pegada (`u` ao comprido, `v` de través),
 * como o muro baixo de pedra.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura; cada peça
 * sobe com a estrutura mais alta que contém o meio da caixa dela) a grade
 * aparece de frente:
 * - cada BARRA é uma coluna do chão até o alto dela; o losango da ponta, que
 *   é a peça dela, sobe junto e vira o colar logo abaixo da lança (e dá à
 *   frente da barra o ferro: sem peça, ela pegaria a pedra da capa, a maior
 *   peça do móvel);
 * - cada LANÇA é um tampo solto em forma de pipa, com a ponta para cima NA
 *   TELA (o desenho lê `c.giro`, a conta do candelabro): a beirada do tampo é
 *   o corpo da lança. A pipa fica `RECUO_DA_LANCA` mais para cima na tela, e
 *   o tampo, outro tanto mais baixo (o mesmo lugar na tela): assim o rabo dela
 *   não cobre o meio da barra, e o losango fica com a barra. A peça da lança
 *   é um pingo de ferro escondido debaixo do losango, com a caixa no meio da
 *   pipa. Com a cerca de topo na tela a pipa fica fina (a lâmina de lado);
 * - as TRAVESSAS são tampos soltos compridos, com a base um pouco ao sul da
 *   das barras: saem depois delas e passam inteiras por cima. A de baixo tem
 *   uma pecinha escondida debaixo da de cima, com a caixa centrada dentro da
 *   estrutura dela (`comMeioEm`), pelo mesmo motivo do losango;
 * - o PILARETE é uma coluna e a CAPA, um tampo solto um pouco maior que ele.
 * O perfil é o DERIVADO, com a beirada padrão dos tampos (0,06 casa, a
 * `BEIRADA`): a lança, as travessas e a capa a usam.
 *
 * Materiais: `grade` (o metal, escurecido: ferro escuro) e `pedra` (os
 * pilaretes). O capim, a ferrugem e o líquen são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** As alturas, em casas: o alto das barras, o do pilarete (sem a capa) e o de cima de cada travessa. */
const ALTURA_DAS_BARRAS = 0.9
const ALTURA_DO_PILARETE = 1
const ALTURA_DA_TRAVESSA_DE_CIMA = 0.8
const ALTURA_DA_TRAVESSA_DE_BAIXO = 0.17
/** A beirada dos tampos soltos na 3/4: a padrão de `tresQuartos.ts` (`ESPESSURA_DO_TAMPO`), 0,06 casa. */
const BEIRADA = 0.06 * G
/** Uma barra a cada tanto de casa: é o que reparte o trecho. */
const PASSO_DAS_BARRAS = 0.13
/** O raio da barra (px do protótipo). */
const RAIO_DA_BARRA = 0.8
/** Quanto a lança assenta na ponta da barra, na 3/4 (px do protótipo). */
const ASSENTO_DA_LANCA = 1
/**
 * A lança na 3/4: a ponta acima dos ombros, o rabo abaixo deles e a meia
 * largura, de frente e de lado (px do protótipo). Com a beirada do tampo entre
 * os ombros e o rabo, a silhueta é a de uma ponta de lança: bico, corpo reto e
 * o pescoço afinando até a barra.
 */
const PONTA_DA_LANCA = 2.6
const RABO_DA_LANCA = 1.3
const MEIA_LANCA = 1.5
const MEIA_LANCA_DE_LADO = 0.8
/** Quanto a pipa da lança fica para cima na tela, no desenho (e o tampo, mais baixo): o rabo para 0,2 px antes do meio da barra. */
const RECUO_DA_LANCA = RABO_DA_LANCA + 0.2
/** O losango da ponta de cada barra: meio comprimento ao longo da cerca e meia grossura (px do protótipo). */
const LOSANGO_AO_LONGO = 1.6
const LOSANGO_DE_TRAVES = 0.85
/**
 * O pingo de ferro de cada lança (a peça que lhe dá o material): o raio (px),
 * quanto o meio da caixa dele entra na pipa além do recuo e o tom, o da
 * frente varrida (`TOM_DA_FRENTE` de `tresQuartos.ts`), para sumir nela.
 */
const RAIO_DO_PINGO = 0.45
const PINGO_DENTRO_DA_PIPA = 0.8
const TOM_DO_PINGO = 0.74
/** As travessas: a meia grossura de cima (px do protótipo) e a faixa da de baixo, mais ao sul, fora da de cima. */
const MEIA_TRAVESSA = 0.75
const NORTE_DA_TRAVESSA_DE_BAIXO = 0.3
const SUL_DA_TRAVESSA_DE_BAIXO = 1.6
const MEIO_DA_PECA_DE_BAIXO = 1.1
/** O pilarete: meio lado (casas), quanto a capa passa dele, o canto dela e a beira lisa em volta da pirâmide (px). */
const MEIO_PILARETE = 0.15
const SOBRA_DA_CAPA = 1.2
const CANTO_DA_CAPA = 0.9
const BEIRA_DA_PIRAMIDE = 1.5
/** A luz de cada água da pirâmide: o tom base e quanto a água virada para a luz clareia (ou a do outro lado escurece). */
const TOM_DA_PIRAMIDE = 0.97
const LUZ_DA_PIRAMIDE = 0.18
/** De onde vem a luz no chão (a de `motor.ts`: de cima, à esquerda). */
const LUZ_X = -0.79
const LUZ_Y = -0.61
/** O ferro da grade é o metal escolhido mais escuro: ferro escuro, de cemitério. */
const TOM_DO_FERRO = 0.82
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza
 * de ferro, de luminância linear 0,063. Com o escuro de sempre (o da nogueira)
 * a frente das barras na 3/4, abaixo do piso, saía marrom, como ferrugem.
 */
const ESCURO_DO_FERRO: Rgb = [0x45, 0x47, 0x4a]
/** O brilho do ferro velho: menos que o metal novo (0,42); a ferrugem não espelha. */
const BRILHO_DO_FERRO = 0.26
/** A ferrugem: um marrom-alaranjado baixo, em manchas; no miolo da mancha ainda sobra um pouco do ferro. */
const FERRUGEM: Rgb = rgb('#8c5b45')
const FERRUGEM_CHEIA = 0.7
/** Quanta ferrugem cada peça leva, de `FERRUGEM_MINIMA` a `FERRUGEM_MINIMA + FERRUGEM_VARIA` (discreta). */
const FERRUGEM_MINIMA = -0.22
const FERRUGEM_VARIA = 0.3
/** As sombras da grade no chão: a risca das barras, a linha das travessas e a ponta das lanças. */
const SOMBRA_DA_BARRA = { suave: 1.1, forca: 0.32 } as const
const SOMBRA_DA_TRAVESSA = { suave: 1, forca: 0.3 } as const
const SOMBRA_DA_LANCA = { suave: 0.9, forca: 0.28 } as const
/**
 * O capim do pé: o tufo de folhas em zigue-zague da cova e da lápide, de pé
 * na tela, no verde-oliva da lápide (visto do alto em estrela, lia como um
 * asterisco). Um tufo a cada tantas casas de cerca; largura e alto (px).
 */
const CAPIM: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.95)) }
const TUFO_A_CADA = 0.5
const LARGURA_DO_TUFO = 4.2
const ALTO_DO_TUFO = 3.8
/** O líquen da capa: o cinza-esverdeado claro do muro baixo, meio transparente. */
const LIQUEN: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xc6, 0xa6] }
const ALFA_DO_LIQUEN = 0.42

/** O referencial da cerca: `u` ao comprido, `v` de través. No trecho em pé os eixos trocam. */
interface Referencial {
  em(u: number, v: number): Ponto
  ret(u0: number, v0: number, u1: number, v1: number, raio?: number): Forma
}

function referencial(aoComprido: boolean): Referencial {
  if (aoComprido) return { em: (u, v) => [u, v], ret: (u0, v0, u1, v1, raio = 0) => caixa(u0, v0, u1, v1, raio) }
  return { em: (u, v) => [v, u], ret: (u0, v0, u1, v1, raio = 0) => caixa(v0, u0, v1, u1, raio) }
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de
 * volta que a 3/4 pinta (`giro`, em graus): a conta do altar e do candelabro.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** A direção (dx, dy) do desenho NA TELA depois do quarto de volta que a 3/4 pinta. */
function naTela(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [-dy, dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [dy, -dx] : [dx, dy]
}

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber com que estrutura a peça sobe, cai onde se quer.
 */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** O ferro velho: o metal com manchas de ferrugem (`quanto` de -0,3, quase limpo, a 0,3) e o grão do metal. */
function texFerroVelho(quanto: number): Textura {
  return (_u, _v, x, y, p, s) => {
    // Duas escalas: a mancha e o recorte dela, que desfaz a beira (ferrugem não tem contorno).
    const mancha = ruido(x * 0.2 + p.su, y * 0.2 + p.sv) * 1.4 + ruido(x * 0.8 + p.sv, y * 0.8 + p.su) * 0.7
    const q = (mancha + quanto - 0.3) / 0.4
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] += ruido(x * 0.16 + p.su, y * 0.16) * 0.1 + ruido(x * 0.7, y * 0.7 + p.sv) * 0.04 - t * 0.05
  }
}

/**
 * Um tufo de capim com o pé em (x, y), de pé NA TELA: (nx, ny) é o "para
 * cima" na tela, no desenho. Folhas em zigue-zague, como na cova e na lápide.
 */
function tufo(x: number, y: number, largura: number, alto: number, inclina: number, nx: number, ny: number): Forma {
  const m = largura / 2
  // (lado, acima): `lado` para a direita na tela, `acima` para cima.
  const folhas: readonly (readonly [number, number])[] = [
    [-m, -0.8],
    [-m * 0.85 + inclina, alto * 0.7],
    [-m * 0.35, alto * 0.2],
    [inclina * 0.6, alto],
    [m * 0.3, alto * 0.25],
    [m * 0.9 + inclina, alto * 0.62],
    [m, -0.8],
  ]
  return poligono(folhas.map(([a, b]): Ponto => [x - ny * a + nx * b, y + nx * a + ny * b]))
}

export const montarCercaDeFerro: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const aoComprido = c.w >= c.h
  const R = referencial(aoComprido)
  const comprimento = aoComprido ? c.w : c.h
  const fundura = aoComprido ? c.h : c.w
  const mc = comprimento / 2
  const meioPilarete = Math.min(fundura / 2, g * MEIO_PILARETE)
  const capa = meioPilarete + SOBRA_DA_CAPA
  const base = c.m.grade
  const ferro: MaterialDaPeca = { ...base, rgb: [base.rgb[0] * TOM_DO_FERRO, base.rgb[1] * TOM_DO_FERRO, base.rgb[2] * TOM_DO_FERRO] }
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  // O sorteio muda com o tamanho do trecho (como no muro): trechos de tamanhos diferentes não repetem a ferrugem.
  const sorteio = Math.round(c.w + 7 * c.h)
  const ferrugem = (k: number): Textura => texFerroVelho(FERRUGEM_MINIMA + FERRUGEM_VARIA * hash(k, 3, 190 + sorteio))
  const doFerro = (k: number) => ({ tabua: 0, metal: BRILHO_DO_FERRO, textura: ferrugem(k), semente: 300 + k })

  // Para onde é "para cima" NA TELA, no desenho: de cima é o norte; na 3/4 girada, o lado que o giro leva para lá.
  const [nx, ny] = desgirado(0, -1, c.giro)
  // A lâmina da lança atravessa esse "para cima": de frente se a cerca corre de lado a lado na tela.
  const [ax, ay] = aoComprido ? [1, 0] : [0, 1]
  const deFrente = Math.abs(-ny * ax + nx * ay) > 0.5
  const meiaLanca = deFrente ? MEIA_LANCA : MEIA_LANCA_DE_LADO

  const zBarras = g * ALTURA_DAS_BARRAS
  const zPilarete = g * ALTURA_DO_PILARETE
  const zDeCima = g * ALTURA_DA_TRAVESSA_DE_CIMA
  const zDeBaixo = g * ALTURA_DA_TRAVESSA_DE_BAIXO
  // O rabo da lança (a beirada do tampo e o rabo da pipa) assenta `ASSENTO_DA_LANCA` px dentro da ponta da barra, na tela.
  const zLanca = zBarras + BEIRADA + RABO_DA_LANCA - RECUO_DA_LANCA + RAIO_DA_BARRA - ASSENTO_DA_LANCA

  // ---------- as barras, de face a face dos pilaretes ----------
  const face = mc - meioPilarete
  const vaos = face > 0 ? Math.max(1, Math.round((2 * face) / (g * PASSO_DAS_BARRAS))) : 0
  const passo = vaos > 0 ? (2 * face) / vaos : 0
  const barras: number[] = []
  for (let i = 1; i < vaos; i += 1) barras.push(-face + passo * i)
  // Os trechos de travessa: de dentro de um pilarete à primeira barra, de barra a barra, da última ao outro pilarete.
  const juntas = [-face - SOBRA_DA_CAPA, ...barras, face + SOBRA_DA_CAPA]
  const trechos = vaos > 0 ? juntas.slice(1).map((u1, i) => [juntas[i], u1] as const) : []

  // ---------- o capim ao pé: do lado de baixo e no pé de cada pilarete (a caixa no pé: fica no chão na 3/4) ----------
  const capim = (u: number, v: number, escala: number, k: number) => {
    const [x, y] = R.em(u, v)
    const forma = tufo(x, y, LARGURA_DO_TUFO * escala, ALTO_DO_TUFO * escala, (hash(k, 5, 191 + sorteio) - 0.5) * 1.2, nx, ny)
    L.push(P(comMeioEm(forma, x, y), CAPIM, { bisel: 0.8, contorno: 0.2, tom: 0.9 + 0.16 * hash(k, 4, 191 + sorteio), semente: 400 + k }))
  }
  const tufos = Math.max(1, Math.round(comprimento / (g * TUFO_A_CADA)))
  for (let i = 0; i < tufos; i += 1) {
    const u = -mc + capa + ((i + 0.2 + 0.6 * hash(i, 1, 191 + sorteio)) / tufos) * (comprimento - 2 * capa)
    capim(u, SUL_DA_TRAVESSA_DE_BAIXO + 1.6 + hash(i, 2, 191 + sorteio) * 1.4, 0.8 + 0.4 * hash(i, 3, 191 + sorteio), i)
  }
  for (const lado of [-1, 1]) capim(lado * (mc - capa * 0.45), capa + 0.9, 1.1, 20 + lado)

  // ---------- as estruturas da grade: o que sobe na 3/4 e as riscas no chão ----------
  if (trechos.length > 0) {
    const de = -face - SOBRA_DA_CAPA
    const ate = face + SOBRA_DA_CAPA
    cena.sombras.push(
      { forma: R.ret(de, -MEIA_TRAVESSA, ate, MEIA_TRAVESSA), z: zDeCima, solta: true, ...SOMBRA_DA_TRAVESSA },
      { forma: R.ret(de, NORTE_DA_TRAVESSA_DE_BAIXO, ate, SUL_DA_TRAVESSA_DE_BAIXO), z: zDeBaixo, solta: true, ...SOMBRA_DA_TRAVESSA },
    )
  }
  barras.forEach((u) => {
    const [x, y] = R.em(u, 0)
    cena.sombras.push({ forma: elipse(x, y, RAIO_DA_BARRA, RAIO_DA_BARRA), z: zBarras, ...SOMBRA_DA_BARRA })
    // A lança: a pipa com a ponta para cima na tela e a lâmina atravessada, recuada para cima.
    const mx = x + nx * RECUO_DA_LANCA
    const my = y + ny * RECUO_DA_LANCA
    const lanca = poligono([
      [mx + nx * PONTA_DA_LANCA, my + ny * PONTA_DA_LANCA],
      [mx - ny * meiaLanca, my + nx * meiaLanca],
      [mx - nx * RABO_DA_LANCA, my - ny * RABO_DA_LANCA],
      [mx + ny * meiaLanca, my - nx * meiaLanca],
    ])
    cena.sombras.push({ forma: lanca, z: zLanca - RECUO_DA_LANCA, solta: true, ...SOMBRA_DA_LANCA })
  })

  // ---------- as travessas: a de baixo escondida (só dá o ferro à frente dela) e a de cima, que se vê do alto ----------
  trechos.forEach(([u0, u1], i) => {
    const [mx, my] = R.em((u0 + u1) / 2, MEIO_DA_PECA_DE_BAIXO)
    L.push(P(comMeioEm(R.ret(u0, -MEIA_TRAVESSA, u1, MEIA_TRAVESSA), mx, my), ferro, { bisel: 0.5, ...doFerro(i) }))
  })
  trechos.forEach(([u0, u1], i) => {
    L.push(P(R.ret(u0, -MEIA_TRAVESSA, u1, MEIA_TRAVESSA, 0.3), ferro, { bisel: MEIA_TRAVESSA, contorno: 0.2, ...doFerro(40 + i) }))
  })
  // O losango da ponta de cada barra: de cima, a ponta; na 3/4, o colar debaixo da lança. Antes dele, escondido
  // debaixo dele de cima, um pingo de ferro com a caixa no meio da pipa: sobe com a lança e lhe dá o ferro (sem peça
  // a beirada dela pegaria a pedra da capa); na 3/4 cai na beirada da lança, no mesmo tom dela.
  barras.forEach((u, i) => {
    const [x, y] = R.em(u, 0)
    const meio = RECUO_DA_LANCA + PINGO_DENTRO_DA_PIPA
    L.push(P(comMeioEm(elipse(x, y, RAIO_DO_PINGO, RAIO_DO_PINGO), x + nx * meio, y + ny * meio), ferro, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_PINGO, semente: 260 + i }))
    const losango = poligono([R.em(u - LOSANGO_AO_LONGO, 0), R.em(u, -LOSANGO_DE_TRAVES), R.em(u + LOSANGO_AO_LONGO, 0), R.em(u, LOSANGO_DE_TRAVES)])
    L.push(P(losango, ferro, { bisel: LOSANGO_DE_TRAVES, contorno: 0.24, ...doFerro(80 + i) }))
  })

  // ---------- os pilaretes, com o meio na ponta da pegada ----------
  for (const lado of [-1, 1]) {
    const u = lado * mc
    const corpo = R.ret(u - meioPilarete, -meioPilarete, u + meioPilarete, meioPilarete)
    const tampa = R.ret(u - capa, -capa, u + capa, capa, CANTO_DA_CAPA)
    cena.sombras.push({ forma: corpo, z: zPilarete }, contato(corpo, 0.3), { forma: tampa, z: zPilarete + BEIRADA, solta: true })
    const sem = lado < 0 ? 0 : 20
    L.push(P(tampa, pedra, { tabua: 0, bisel: 1.4, contorno: 0.28, semente: 500 + sem }))
    // A pirâmide da capa: quatro águas até o meio, cada uma com a luz do lado para onde vira NA TELA.
    const k = capa - BEIRA_DA_PIRAMIDE
    const [cx, cy] = R.em(u, 0)
    const cantos: Ponto[] = [[cx - k, cy - k], [cx + k, cy - k], [cx + k, cy + k], [cx - k, cy + k]]
    const aguas: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
    aguas.forEach(([dx, dy], i) => {
      const [sx, sy] = naTela(dx, dy, c.giro)
      const luz = -(sx * LUZ_X + sy * LUZ_Y)
      const agua = poligono([cantos[i], cantos[(i + 1) % 4], [cx, cy]])
      L.push(P(agua, pedra, { tabua: 0, bisel: 0.5, contorno: 0.12, tom: TOM_DA_PIRAMIDE + LUZ_DA_PIRAMIDE * luz, semente: 501 + sem + i }))
    })
    // Uma mancha de líquen na capa, de um lado ou do outro.
    const [lx, ly] = R.em(u + (hash(lado, 5, 192 + sorteio) - 0.5) * k, (hash(lado, 6, 192 + sorteio) - 0.5) * k)
    L.push(P(elipse(lx, ly, k * 0.42, k * 0.34), LIQUEN, { bisel: 0, contorno: 0, alfa: ALFA_DO_LIQUEN, suave: 0.7, semente: 510 + sem }))
  }
}

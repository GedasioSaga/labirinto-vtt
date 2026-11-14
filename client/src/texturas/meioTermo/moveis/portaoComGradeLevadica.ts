/**
 * PORTÃO COM GRADE LEVADIÇA de cima com volume (construção do lote L15,
 * 14/11/2026, grupo Fortes e castelos): o corpo do portão de pedra em fiadas,
 * com o ADARVE de lajes em cima (ameias na frente, o parapeito baixo atrás e a
 * fenda da grade), entre duas TORRES mais altas e mais avançadas, cada uma com
 * o terraço de lajes, o parapeito em volta, as ameias e duas seteiras na
 * frente. Na frente do corpo, o VÃO em arco com as aduelas, e a GRADE de ferro
 * erguida, com as pontas para baixo: o portão está aberto (não barra). O
 * calçamento passa pelo vão, na frente e atrás.
 *
 * De cima: o adarve com a fenda da grade e o topo dela, os terraços das
 * torres, as ameias, a sombra das torres e das ameias pintada nas lajes, o
 * calçamento entre as torres; a sombra das três massas cai no chão.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado com a beirada
 * `ESPESSURA_DA_FIADA_DO_PORTAO`, a altura de uma fiada):
 * - cada fachada é o miolo (coluna) com as fiadas da frente em blocos (tampos
 *   soltos da altura da fiada, a conta da torre do sino): o miolo aparece
 *   escuro nas juntas;
 * - o vão de baixo é uma coluna que sai 1,6 px da fachada com a peça escura em
 *   cima: a frente dela é o vão;
 * - o ARCO escuro, as ADUELAS, a GRADE e as SETEIRAS são DECALQUES: peças
 *   desenhadas na planta com o alto para o norte, dentro da pegada e debaixo do
 *   adarve ou do terraço (a vista de cima não as vê), levantadas por um PINO
 *   no chão da frente (fora de toda estrutura): na 3/4 o desenho aparece de pé
 *   na fachada, na altura certa (planta y = frente - altura + alto do pino);
 * - parapeitos e ameias são tampos soltos uma e duas fiadas acima do piso.
 *
 * Não lê `c.giro`: o portão tem frente (o vão olha para o sul da planta).
 * Planta em casas (4 x 2 de partida: o menor lado é a casa), alturas em casas.
 * Material: `pedra`; o ferro da grade e o escuro do vão são fixos.
 */
import { hash } from '../../ruido'
import { anel, caixa, poligono, uniao, type Forma } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { G, PREGO, type MontarMovel } from './contexto'
import { caixaArrastada, colunaSemSombra, comMeioEm, emOrdem, fiadaRetangular, pino, solta, texturaComSombra, texturaDeLajes, type QueFazSombra } from './andaimeDaTresQuartos'

/** A altura de uma fiada (casas e px do protótipo): a beirada de todo tampo solto do portão. O perfil usa. */
const FIADA_EM_CASAS = 0.18
export const ESPESSURA_DA_FIADA_DO_PORTAO = FIADA_EM_CASAS * G
/** Quantas fiadas tem o corpo do portão e cada torre. */
const FIADAS_DO_CORPO = 10
const FIADAS_DAS_TORRES = 14
/** O corpo (meia largura, a beira de trás e a da frente) e as torres (de onde a onde em x, trás, frente), em casas. */
const CORPO = { x: 0.98, tras: -0.62, frente: 0.5 }
const TORRE = { x0: 0.98, x1: 1.96, tras: -0.94, frente: 0.94 }
/** O vão: meia largura (o raio do arco) e a altura em que o arco nasce, em casas; e quanto a coluna dele sai da fachada (px). */
const VAO = { l: 0.4, pe: 0.95 }
const VAO_SAI = 1.6
/** As aduelas do arco (largura em casas) e quantas. */
const ADUELAS = { largura: 0.13, quantas: 7 }
/**
 * O escuro da abóbada do arco e das seteiras, de pedra quase preta (o `BURACO` da casa e o liso escuro saíam
 * vermelho-castanho na 3/4 e liam como porta de madeira fechada), e a PASSAGEM do vão: a pedra cinza do outro lado,
 * que diz "aberto".
 */
const ESCURO: MaterialDaPeca = { classe: 'pedra', rgb: [0x3a, 0x3a, 0x3b] }
const PASSAGEM: MaterialDaPeca = { classe: 'pedra', rgb: [0x7c, 0x79, 0x74] }
/** A grade erguida: a altura das pontas (casas), quantas barras, as alturas das travessas. */
const GRADE = { pontas: 0.55, barras: 7, travessas: [0.7, 0.9, 1.1] }
const RAIO_DA_BARRA = 0.022
/** As seteiras de cada torre: [de, até, alto do pino] em casas. */
const SETEIRAS: readonly (readonly [number, number, number])[] = [[0.62, 0.98, 0.52], [1.5, 1.88, 1.4]]
const MEIA_SETEIRA = 0.034
/** O parapeito (fundo em casas) e as ameias (largura e vão em casas). */
const PARAPEITO = 0.12
const AMEIA = { largura: 0.2, vao: 0.13 }
/** A casca das fiadas (px) e o comprimento do bloco (casas). */
const CASCA = 4
const BLOCO = 0.32
/** A espessura da placa do miolo atrás das fiadas (px). */
const PLACA_DO_MIOLO = 2
/** As lajes do adarve e do calçamento (px), a sombra no chão e a pintada nas lajes. */
const LAJE = { largura: 11, altura: 8 }
const PEDRA_DO_CALCAMENTO = { largura: 6, altura: 5 }
const FORCA_DA_SOMBRA = 0.34
const BORDA_DA_SOMBRA = 2.6
const BORDA_DA_SOMBRA_PINTADA = 1.4
const FORCA_DA_SOMBRA_PINTADA = 0.3

/** Ameias ao longo de uma faixa (x0..x1 por y0..y1): blocos de `largura` com `vao` entre eles, correndo em x ou em y. */
function ameias(x0: number, y0: number, x1: number, y1: number, largura: number, vao: number, emX: boolean): Forma {
  const faixa = caixa(x0, y0, x1, y1)
  const { quantas, passo } = passoDasAmeias(emX ? x1 - x0 : y1 - y0, largura, vao)
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      const t = (emX ? x - x0 : y - y0) - largura / 2
      const i = passo > 0 ? Math.max(0, Math.min(quantas - 1, Math.round(t / passo))) : 0
      return Math.max(faixa.d(x, y), Math.abs(t - i * passo) - largura / 2)
    },
  }
}

/** Quantas ameias cabem na faixa e o passo entre elas: elas se espalham para a primeira e a última ficarem nas pontas. */
function passoDasAmeias(comprimento: number, largura: number, vao: number): { quantas: number; passo: number } {
  const quantas = Math.max(2, Math.round((comprimento + vao) / (largura + vao)))
  return { quantas, passo: (comprimento - largura) / (quantas - 1) }
}

/**
 * Onde pôr o meio da caixa da peça de uma faixa com ameias (a partir do começo da faixa): no meio da primeira ameia
 * (a peça das ameias sobe com elas) ou no meio do primeiro vão (a peça do parapeito não sobe com as ameias).
 */
function meioNaFaixa(comprimento: number, largura: number, vao: number, noVao: boolean): number {
  return largura / 2 + (noVao ? passoDasAmeias(comprimento, largura, vao).passo / 2 : 0)
}

/** O anel retangular (o parapeito em volta do terraço): a caixa menos a caixa de dentro. */
function anelRetangular(x0: number, y0: number, x1: number, y1: number, fundo: number): Forma {
  const fora = caixa(x0, y0, x1, y1)
  const dentro = caixa(x0 + fundo, y0 + fundo, x1 - fundo, y1 - fundo)
  return { b: fora.b, d: (x, y) => Math.max(fora.d(x, y), -dentro.d(x, y)) }
}

/** A metade de cima (norte) de uma forma, acima da linha y = cy. */
function metadeDeCima(f: Forma, cy: number): Forma {
  return { b: [f.b[0], f.b[1], f.b[2], Math.min(f.b[3], cy)], d: (x, y) => Math.max(f.d(x, y), y - cy) }
}

export const montarPortaoComGradeLevadica: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.hw, c.hh)
  const q = (v: number): number => v * k
  const pedra = c.m.pedra
  const L = cena.partes
  const S = cena.sombras
  const e = q(FIADA_EM_CASAS)
  const [zCorpo, zTorre] = [e * FIADAS_DO_CORPO, e * FIADAS_DAS_TORRES]
  const [cx, cTras, cFrente] = [q(CORPO.x), q(CORPO.tras), q(CORPO.frente)]
  const [tTras, tFrente] = [q(TORRE.tras), q(TORRE.frente)]
  const corpo = caixa(-cx, cTras, cx, cFrente)
  const torres = [-1, 1].map((s) => {
    const [a, b] = [s * q(TORRE.x0), s * q(TORRE.x1)]
    return { s, x0: Math.min(a, b), x1: Math.max(a, b), forma: caixa(Math.min(a, b), tTras, Math.max(a, b), tFrente) }
  })
  const [ow, zPe] = [q(VAO.l), q(VAO.pe)]
  const fundo = q(PARAPEITO)
  const bloco = q(BLOCO)

  // ---------- as sombras no chão ----------
  for (const [forma, z] of [[corpo, zCorpo], ...torres.map((t) => [t.forma, zTorre] as const)] as const) {
    const [x0, y0, x1, y1] = forma.b
    S.push(contato(forma, 0.36))
    S.push({ forma: caixaArrastada(x0, y0, x1, y1, z + e), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  }

  // ---------- as estruturas da 3/4, na ordem de pintura ----------
  const estruturas: { forma: Forma; z: number; coluna: boolean }[] = []
  const pore = (forma: Forma, z: number, coluna = false): void => {
    estruturas.push({ forma, z, coluna })
  }
  /** O miolo e as fiadas da frente de uma fachada. */
  const fachada = (x0: number, x1: number, tras: number, frente: number, fiadas: number, semente: number): void => {
    // O miolo é uma placa fina atrás das fiadas (é ela que aparece escura nas juntas) e um tampo na altura do piso
    // (o piso sobe com ele): uma coluna cheia varria a planta inteira do chão ao alto, e o portão passava do tempo.
    pore(caixa(x0 + 1, tras, x1 - 1, frente - CASCA), e * fiadas - 1)
    pore(caixa(x0 + 1, frente - CASCA - PLACA_DO_MIOLO, x1 - 1, frente - CASCA), e * fiadas - 1, true)
    for (let i = 0; i < fiadas; i += 1) {
      pore(fiadaRetangular(x0, frente - CASCA, x1, frente, CASCA, bloco, (i % 2) * bloco * 0.5 + hash(i, semente, 1882) * 2), e * (i + 1))
    }
  }
  // Os pinos dos decalques: no chão da frente, fora de toda estrutura, um para cada decalque.
  const yDosPinos = cFrente + VAO_SAI + q(0.05)
  const decalques: { pino: [number, number]; z: number }[] = []
  const decalque = (x: number, y: number, z: number): [number, number] => {
    decalques.push({ pino: [x, y], z })
    return [x, y]
  }
  fachada(-cx, cx, cTras, cFrente, FIADAS_DO_CORPO, 1)
  const vao = caixa(-ow, cFrente - 3, ow, cFrente + VAO_SAI)
  pore(vao, zPe, true)
  pore(caixa(-cx, cTras, cx, cTras + fundo), zCorpo + e)
  pore(caixa(-cx, cFrente - fundo, cx, cFrente), zCorpo + e)
  pore(ameias(-cx, cFrente - fundo, cx, cFrente, q(AMEIA.largura), q(AMEIA.vao), true), zCorpo + 2 * e)
  // O arco escuro e as aduelas nascem em zPe; a grade fica pendurada até as pontas.
  const zDoArco = zPe - q(0.1)
  const zDaGrade = q(GRADE.pontas) - q(0.06)
  const pinoDoArco = decalque(-q(0.2), yDosPinos, zDoArco)
  const pinoDaGrade = decalque(0, yDosPinos, zDaGrade)
  const pinoDasAduelas = decalque(q(0.2), yDosPinos, zDoArco)
  const pinosDasSeteiras = torres.map((t) =>
    SETEIRAS.map(([, , alto], i) => decalque((t.x0 + t.x1) / 2 + (i - 0.5) * q(0.2), tFrente + q(0.04), q(alto))),
  )
  for (const t of torres) {
    fachada(t.x0, t.x1, tTras, tFrente, FIADAS_DAS_TORRES, 2 + t.s)
    pore(anelRetangular(t.x0, tTras, t.x1, tFrente, fundo), zTorre + e)
    const ameiasDaTorre: Forma[] = [
      ameias(t.x0, tTras, t.x1, tTras + fundo, q(AMEIA.largura), q(AMEIA.vao), true),
      ameias(t.x0, tFrente - fundo, t.x1, tFrente, q(AMEIA.largura), q(AMEIA.vao), true),
      ameias(t.x0, tTras, t.x0 + fundo, tFrente, q(AMEIA.largura), q(AMEIA.vao), false),
      ameias(t.x1 - fundo, tTras, t.x1, tFrente, q(AMEIA.largura), q(AMEIA.vao), false),
    ]
    for (const a of ameiasDaTorre) pore(a, zTorre + 2 * e)
  }
  // Os decalques por último, na ordem em que foram pedidos: o arco escuro, a grade, as aduelas e as seteiras.
  for (const d of decalques) pore(pino(d.pino[0], d.pino[1]), d.z)
  const naOrdem = emOrdem(
    estruturas.map((x) => x.forma),
    c.hh + 2,
  )
  estruturas.forEach((x, i) => S.push(x.coluna ? colunaSemSombra(naOrdem[i], x.z) : solta(naOrdem[i], x.z)))

  const daPedra = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1.2, contorno: 0.28, semente, ...mais })
  const [la, va] = [q(AMEIA.largura), q(AMEIA.vao)]
  /** A peça de uma faixa com ameias com o meio da caixa na primeira ameia ou no primeiro vão. */
  const naFaixa = (f: Forma, emX: boolean, noVao: boolean): Forma => {
    const [x0, y0, x1, y1] = f.b
    const m = meioNaFaixa(emX ? x1 - x0 : y1 - y0, la, va, noVao)
    return emX ? comMeioEm(f, x0 + m, (y0 + y1) / 2) : comMeioEm(f, (x0 + x1) / 2, y0 + m)
  }
  /** Um decalque: a forma desenhada de pé (alto para o norte), com o meio da caixa no pino que a levanta. */
  const noPino = (f: Forma, [px, py]: [number, number]): Forma => comMeioEm(f, px, py)
  /** O y da planta onde o decalque de um pino de alto `z` aparece na altura `h` da fachada da frente `frente`. */
  const naAltura = (frente: number, h: number, z: number): number => frente - h + z

  // ---------- o calçamento na frente (entre as torres) e atrás ----------
  const calcamento = texturaDeLajes(PEDRA_DO_CALCAMENTO.largura, PEDRA_DO_CALCAMENTO.altura, 18820)
  L.push(P(caixa(-ow - 2, cFrente, ow + 2, c.hh, 1), pedra, daPedra(18821, { tom: 0.86, bisel: 0.8, textura: calcamento })))
  L.push(P(caixa(-ow - 2, -c.hh, ow + 2, cTras, 1), pedra, daPedra(18822, { tom: 0.86, bisel: 0.8, textura: calcamento })))

  // ---------- os decalques (debaixo do adarve e dos terraços na vista de cima) ----------
  const frenteDoVao = cFrente + VAO_SAI
  const yDoArco = naAltura(frenteDoVao, zPe, zDoArco)
  L.push(P(noPino(metadeDeCima(caixa(-ow, yDoArco - ow, ow, yDoArco + 1, ow), yDoArco + 0.5), pinoDoArco), ESCURO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.62, semente: 18823 }))
  // A grade numa peça só (cada peça de decalque tem a caixa até o pino: muitas peças pesam): as barras do arco até
  // as pontas, com a ponta afinando, e as travessas.
  const passoDaBarra = (2 * ow) / (GRADE.barras + 1)
  const rb = q(RAIO_DA_BARRA)
  const yDaGrade = (h: number): number => naAltura(frenteDoVao, h, zDaGrade)
  const [yDoAlto, yDasPontas] = [yDaGrade(zPe + ow), yDaGrade(q(GRADE.pontas))]
  const travessas = GRADE.travessas.map((h) => ({ y: yDaGrade(q(h)), meia: Math.sqrt(Math.max(0, ow * ow - Math.max(0, q(h) - zPe) ** 2)) - 1 }))
  const grade: Forma = {
    b: [-ow, yDoAlto, ow, yDasPontas],
    d(x, y) {
      const i = Math.max(1, Math.min(GRADE.barras, Math.round((x + ow) / passoDaBarra)))
      const xb = -ow + passoDaBarra * i
      // A barra vai do arco até a ponta; nos últimos px ela afina até a ponta.
      const topo = yDaGrade(zPe + Math.sqrt(Math.max(0, ow * ow - xb * xb)) - 1)
      const afina = Math.max(0, (y - (yDasPontas - rb * 2.4)) / (rb * 2.4))
      let d = Math.max(Math.abs(x - xb) - rb * (1 - 0.75 * afina), topo - y, y - yDasPontas)
      for (const t of travessas) d = Math.min(d, Math.max(Math.abs(y - t.y) - rb * 0.9, Math.abs(x) - t.meia))
      return d
    },
  }
  L.push(P(noPino(grade, pinoDaGrade), PREGO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.45, eixo: Math.PI / 2, semente: 18830 }))
  // As aduelas em volta do arco numa peça só, com a junta em leque; a chave no alto, mais clara.
  const ra = ow + q(ADUELAS.largura)
  const yDasAduelas = naAltura(frenteDoVao, zPe, zDoArco)
  const anelDoArco = metadeDeCima(anel(0, yDasAduelas, ra, ra, ow, ow), yDasAduelas)
  const fatiaDaAduela = Math.PI / ADUELAS.quantas
  const aduelas: Forma = {
    b: anelDoArco.b,
    d(x, y) {
      const ang = Math.atan2(yDasAduelas - y, x) / fatiaDaAduela
      const junta = Math.abs(ang - Math.round(ang)) * fatiaDaAduela * Math.hypot(x, y - yDasAduelas)
      return Math.max(anelDoArco.d(x, y), 0.5 - junta)
    },
  }
  L.push(P(noPino(aduelas, pinoDasAduelas), pedra, daPedra(18860, { bisel: 0.9, tom: 1.06 })))
  const meiaChave = fatiaDaAduela * 0.5
  const chave = poligono([
    [-Math.sin(meiaChave) * ra, yDasAduelas - Math.cos(meiaChave) * ra - 1],
    [Math.sin(meiaChave) * ra, yDasAduelas - Math.cos(meiaChave) * ra - 1],
    [Math.sin(meiaChave) * ow, yDasAduelas - Math.cos(meiaChave) * ow],
    [-Math.sin(meiaChave) * ow, yDasAduelas - Math.cos(meiaChave) * ow],
  ])
  L.push(P(noPino(chave, pinoDasAduelas), pedra, daPedra(18861, { bisel: 0.9, tom: 1.18 })))
  // As seteiras das torres: a fenda alta e, na de cima, o braço da besta.
  torres.forEach((t, it) => {
    const xm = (t.x0 + t.x1) / 2
    SETEIRAS.forEach(([de, ate, alto], i) => {
      const [y0, y1] = [naAltura(tFrente, q(ate), q(alto)), naAltura(tFrente, q(de), q(alto))]
      const ms = q(MEIA_SETEIRA)
      const ym = (y0 + y1) / 2
      const fenda = caixa(xm - ms, y0, xm + ms, y1, ms * 0.8)
      // Na de cima, o braço da besta cruzando a fenda (na mesma peça).
      const seteira = i === 1 ? uniao(fenda, caixa(xm - ms * 3, ym - ms * 0.6, xm + ms * 3, ym + ms * 0.6)) : fenda
      L.push(P(noPino(seteira, pinosDasSeteiras[it][i]), ESCURO, { tabua: 0, bisel: 0, contorno: 0.24, tom: 0.9, semente: 18870 + it * 2 + i }))
    })
  })

  // ---------- o corpo: o vão, o adarve com a fenda e o topo da grade, os parapeitos e as ameias ----------
  L.push(P(comMeioEm(caixa(-ow, cFrente + 0.3, ow, frenteDoVao, 0.4), 0, cFrente + VAO_SAI * 0.7), PASSAGEM, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.62, semente: 18880 }))
  // A luz vem de cima à esquerda: no adarve só caem a sombra da torre da esquerda e a do parapeito de trás. As duas
  // já arrastadas (o hexágono e a faixa): uma conta por ponto, sem andar a sombra.
  const torreDaEsquerda = torres[0]
  const sombrasNoAdarve: QueFazSombra[] = [
    { forma: caixaArrastada(torreDaEsquerda.x0, tTras, torreDaEsquerda.x1, tFrente, zTorre - zCorpo + 2 * e), de: 0, ate: 0 },
    { forma: caixa(-cx, cTras, cx, cTras + fundo + SOMBRA_Y * e), de: 0, ate: 0 },
  ]
  const lajesDoAdarve = texturaComSombra(texturaDeLajes(LAJE.largura, LAJE.altura, 18881), sombrasNoAdarve, BORDA_DA_SOMBRA_PINTADA, FORCA_DA_SOMBRA_PINTADA)
  L.push(P(caixa(-cx, cTras, cx, cFrente, 1), pedra, daPedra(18882, { textura: lajesDoAdarve })))
  const yDaFenda = cFrente - fundo - q(0.14)
  L.push(P(caixa(-ow - 2, yDaFenda - q(0.04), ow + 2, yDaFenda + q(0.04), 0.4), ESCURO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.6, semente: 18883 }))
  L.push(P(caixa(-ow, yDaFenda - q(0.016), ow, yDaFenda + q(0.016), 0.6), PREGO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.45, semente: 18884 }))
  L.push(P(caixa(-cx, cTras, cx, cTras + fundo, 0.8), pedra, daPedra(18885, { tom: 1.06 })))
  L.push(P(naFaixa(caixa(-cx, cFrente - fundo, cx, cFrente, 0.8), true, true), pedra, daPedra(18886, { tom: 1.06 })))
  L.push(P(naFaixa(ameias(-cx, cFrente - fundo, cx, cFrente, la, va, true), true, false), pedra, daPedra(18887, { tom: 1.12, bisel: 1 })))

  // ---------- as torres: o terraço de lajes com a sombra do parapeito, o parapeito e as ameias ----------
  torres.forEach((t, it) => {
    const anelDaTorre = anelRetangular(t.x0, tTras, t.x1, tFrente, fundo)
    const ameiasDaTorre = [
      ameias(t.x0, tTras, t.x1, tTras + fundo, q(AMEIA.largura), q(AMEIA.vao), true),
      ameias(t.x0, tFrente - fundo, t.x1, tFrente, q(AMEIA.largura), q(AMEIA.vao), true),
      ameias(t.x0, tTras, t.x0 + fundo, tFrente, q(AMEIA.largura), q(AMEIA.vao), false),
      ameias(t.x1 - fundo, tTras, t.x1, tFrente, q(AMEIA.largura), q(AMEIA.vao), false),
    ]
    // A sombra do parapeito (com meia ameia) no terraço, já arrastada: a faixa junto à beira de trás e à da esquerda.
    const dentro = caixa(t.x0 + fundo, tTras + fundo, t.x1 - fundo, tFrente - fundo)
    const [ax, ay] = [SOMBRA_X * e * 1.5, SOMBRA_Y * e * 1.5]
    const faixaDaSombra: Forma = { b: dentro.b, d: (x, y) => Math.max(dentro.d(x, y), -dentro.d(x - ax, y - ay)) }
    const sombrasNoTerraco: QueFazSombra[] = [{ forma: faixaDaSombra, de: 0, ate: 0 }]
    const lajes = texturaComSombra(texturaDeLajes(LAJE.largura, LAJE.altura, 18890 + it), sombrasNoTerraco, BORDA_DA_SOMBRA_PINTADA, FORCA_DA_SOMBRA_PINTADA)
    L.push(P(caixa(t.x0, tTras, t.x1, tFrente, 1), pedra, daPedra(18892 + it, { textura: lajes })))
    // O parapeito em quatro lados (cada um com o meio nele) e as ameias.
    const lados = [
      naFaixa(caixa(t.x0, tTras, t.x1, tTras + fundo, 0.8), true, true),
      naFaixa(caixa(t.x0, tFrente - fundo, t.x1, tFrente, 0.8), true, true),
      naFaixa(caixa(t.x0, tTras, t.x0 + fundo, tFrente, 0.8), false, true),
      naFaixa(caixa(t.x1 - fundo, tTras, t.x1, tFrente, 0.8), false, true),
    ]
    lados.forEach((lado, i) => L.push(P(lado, pedra, daPedra(18894 + it * 4 + i, { tom: 1.06 }))))
    ameiasDaTorre.forEach((a, i) => L.push(P(naFaixa(a, i < 2, false), pedra, daPedra(18902 + it * 4 + i, { tom: 1.12, bisel: 1 }))))
  })
}

/**
 * O PORTAL TORII (lote L19 de 14/11/2026, item 110 da lista do dia; construção do parque que não barra: passa-se
 * por baixo). Os dois pilares redondos cor de zarcão com o pé preto, a travessa de baixo (nuki) passando dos pilares,
 * a escora do meio com a placa preta de moldura dourada, a travessa de cima (shimaki) cor de zarcão e, por cima de
 * tudo, a viga preta (kasagi) com as pontas curvadas para cima.
 *
 * De cima, a viga preta comprida com as pontas finas e a quina de luz no meio, a beira de zarcão espiando embaixo
 * dela e a sombra comprida dos pilares e das vigas; na 3/4 (as duas vistas de `duasVistasDoParque.ts`), o portão de
 * frente, com as pontas da viga subindo. Os desenhos de 3D do palco giram com o objeto: de lado, o portão fica de
 * perfil. A pegada esticada de pé deita o portão na vertical.
 *
 * Sem materiais de escolha: o zarcão e a laca preta são o que faz um torii (as cores são fixas e contidas).
 */
import { rgb } from '../../ruido'
import { caixa, elipse } from './formas'
import type { MaterialDaPeca } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'
import { bloco, novoPalco, type OpcoesDaVista, type P3, type Palco } from './duasVistasDoParque'

/** O zarcão contido (saturação perto de 0,57: o vermelhão cru passava do teto de 0,62) e a laca preta (acima do piso de luz). */
const ZARCAO: MaterialDaPeca = { classe: 'madeira', rgb: [0xae, 0x5e, 0x4a] }
const LACA: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x40, 0x3c] }
const DOURADO = materialDaPeca('latao')
const PEDRA: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: rgb('#a39d93') }

/** O comprimento de partida (a meia pegada comprida de 3 casas): `k` = 1 nele. */
const COMPRIMENTO_DE_PARTIDA = 84
/** A meia pegada curta de partida (meia casa): a grossura das peças não passa dela. */
const LARGURA_DE_PARTIDA = 28
/** Os pilares: o lugar (fração da meia pegada comprida), o raio, o pé preto (raio e altura em casas) e a pedra de base. */
const PILAR = 0.6
const RAIO_DO_PILAR = 4.2
const RAIO_DO_PE = 4.9
const ALTURA_DO_PE = 0.16
const RAIO_DA_BASE = 8.5
/** As alturas, em casas: a travessa de baixo (de, até), a de cima (de, até) e a viga preta (a grossura). */
const NUKI = [1.42, 1.56] as const
const SHIMAKI = [1.84, 1.96] as const
const GROSSURA_DO_KASAGI = 0.13
/** Até onde vão (fração da meia pegada comprida) e a meia grossura (px) de cada travessa. */
const NUKI_ATE = 0.8
const MEIA_NUKI = 2.4
const SHIMAKI_ATE = 0.9
const MEIA_SHIMAKI = 3
const MEIA_KASAGI = 4.8
/** As pontas do kasagi: quanto sobem (casas) e a curva (expoente), e a ponta afinada (fração da meia grossura). */
const SUBIDA_DAS_PONTAS = 0.15
const CURVA_DAS_PONTAS = 3
const PONTA_FINA = 0.55
const PEDACOS_DO_KASAGI = 18
/** O cume do kasagi acima da beira (px): a quina de luz no meio da viga, de cima. */
const CUME_DO_KASAGI = 0.9
/** A escora do meio e a placa (px): a meia largura de cada, a meia grossura e a moldura dourada. */
const MEIA_ESCORA = 2.6
const MEIA_PLACA = 5.6
const MEIA_GROSSURA_DA_PLACA = 2.8
const MOLDURA = 1
/** A beira de zarcão que espia ao sul da viga preta, de cima (px). */
const BEIRA_DE_ZARCAO = 2.4

interface Medidas {
  readonly k: number
  readonly ky: number
  readonly g: number
  readonly deitado: boolean
  readonly a: number
}

/** Do referencial do portão (u ao comprido, v de través) para o do objeto. */
function noObjeto(m: Medidas, u: number, v: number, z: number): P3 {
  return m.deitado ? [u, v, z] : [v, u, z]
}

function face(palco: Palco, m: Medidas, pontos: readonly P3[], mat: MaterialDaPeca, o: OpcoesDaVista, dentro: P3, adiante = 0): void {
  palco.face(
    pontos.map((p) => noObjeto(m, p[0], p[1], p[2])),
    mat,
    { ...o, eixo: (o.eixo ?? 0) + (m.deitado ? 0 : QUARTO) },
    { dentro: noObjeto(m, dentro[0], dentro[1], dentro[2]), adiante },
  )
}

function blocoUV(palco: Palco, m: Medidas, u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, mat: MaterialDaPeca, o: OpcoesDaVista): void {
  const [x0, y0] = noObjeto(m, u0, v0, 0)
  const [x1, y1] = noObjeto(m, u1, v1, 0)
  bloco(palco, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), z0, z1, mat, { ...o, eixo: (o.eixo ?? 0) + (m.deitado ? 0 : QUARTO) })
}

/** Os pilares: a pedra de base, o pé preto e o fuste de zarcão. */
function pilares(palco: Palco, m: Medidas): void {
  const { k, ky, g } = m
  const zTopo = SHIMAKI[0] * g
  ;[-1, 1].forEach((lado, i) => {
    const [x, y] = noObjeto(m, lado * PILAR * m.a, 0, 0)
    palco.plano(elipse(x, y, RAIO_DA_BASE * ky, RAIO_DA_BASE * ky), 1.2 * k, PEDRA, { tabua: 0, bisel: 1.2 * ky, contorno: 0.26, semente: 10 + i }, { adiante: -1e3 })
    palco.contato(elipse(x, y, RAIO_DA_BASE * ky * 1.08, RAIO_DA_BASE * ky * 1.08), 0.32)
    palco.costado(x, y, RAIO_DO_PILAR * ky, 1, zTopo, ZARCAO, { tabua: 0, bisel: 1.2 * ky, contorno: 0.28, semente: 12 + i })
    palco.costado(x, y, RAIO_DO_PE * ky, 1, ALTURA_DO_PE * g, LACA, { tabua: 0, bisel: 1 * ky, contorno: 0.3, semente: 14 + i }, { adiante: 5 })
  })
}

/** A travessa de baixo, a escora do meio com a placa, e a travessa de cima. */
function travessas(palco: Palco, m: Medidas): void {
  const { ky, g } = m
  const opcoes: OpcoesDaVista = { tabua: 0, bisel: 0.8 * ky, contorno: 0.28 }
  blocoUV(palco, m, -NUKI_ATE * m.a, -MEIA_NUKI * ky, NUKI_ATE * m.a, MEIA_NUKI * ky, NUKI[0] * g, NUKI[1] * g, ZARCAO, { ...opcoes, semente: 20 })
  blocoUV(palco, m, -MEIA_ESCORA * ky, -MEIA_ESCORA * ky * 0.8, MEIA_ESCORA * ky, MEIA_ESCORA * ky * 0.8, NUKI[1] * g, SHIMAKI[0] * g, ZARCAO, { ...opcoes, tom: 0.95, semente: 21 })
  // A placa: o quadro preto, e a moldura e as letras douradas nas duas faces (o palco mostra a que se vê).
  const z0 = NUKI[1] * g + 2 * ky
  const z1 = SHIMAKI[0] * g - 1.5 * ky
  blocoUV(palco, m, -MEIA_PLACA * ky, -MEIA_GROSSURA_DA_PLACA * ky, MEIA_PLACA * ky, MEIA_GROSSURA_DA_PLACA * ky, z0, z1, LACA, { ...opcoes, semente: 22 })
  const dentro: P3 = [0, 0, (z0 + z1) / 2]
  for (const lado of [-1, 1]) {
    const v = lado * (MEIA_GROSSURA_DA_PLACA * ky + 0.2)
    const w = MEIA_PLACA * ky - MOLDURA * ky
    const anelDaMoldura = (u0: number, u1: number, za: number, zb: number): void => face(palco, m, [[u0, v, za], [u1, v, za], [u1, v, zb], [u0, v, zb]], DOURADO, { tabua: 0, bisel: 0.3, contorno: 0.16, metal: 0.5 }, dentro, 0.5)
    anelDaMoldura(-w - MOLDURA * ky * 0.5, w + MOLDURA * ky * 0.5, z1 - MOLDURA * ky * 1.6, z1 - MOLDURA * ky * 0.6)
    anelDaMoldura(-w - MOLDURA * ky * 0.5, w + MOLDURA * ky * 0.5, z0 + MOLDURA * ky * 0.6, z0 + MOLDURA * ky * 1.6)
    anelDaMoldura(-w - MOLDURA * ky * 0.5, -w + MOLDURA * ky * 0.5, z0 + MOLDURA * ky * 0.6, z1 - MOLDURA * ky * 0.6)
    anelDaMoldura(w - MOLDURA * ky * 0.5, w + MOLDURA * ky * 0.5, z0 + MOLDURA * ky * 0.6, z1 - MOLDURA * ky * 0.6)
    // Duas letras: riscos dourados de pé no meio da placa.
    const altura = z1 - z0
    for (const [um, zm] of [[0, 0.68], [0, 0.34]] as const) {
      const zc = z0 + altura * zm
      face(palco, m, [[um - 0.5 * ky, v, zc - altura * 0.12], [um + 0.5 * ky, v, zc - altura * 0.12], [um + 0.5 * ky, v, zc + altura * 0.12], [um - 0.5 * ky, v, zc + altura * 0.12]], DOURADO, { tabua: 0, bisel: 0.2, contorno: 0.12, metal: 0.5 }, dentro, 0.6)
      face(palco, m, [[um - 2.2 * ky, v, zc - 0.4 * ky], [um + 2.2 * ky, v, zc - 0.4 * ky], [um + 2.2 * ky, v, zc + 0.4 * ky], [um - 2.2 * ky, v, zc + 0.4 * ky]], DOURADO, { tabua: 0, bisel: 0.2, contorno: 0.12, metal: 0.5 }, dentro, 0.6)
    }
  }
  blocoUV(palco, m, -SHIMAKI_ATE * m.a, -MEIA_SHIMAKI * ky, SHIMAKI_ATE * m.a, MEIA_SHIMAKI * ky, SHIMAKI[0] * g, SHIMAKI[1] * g, ZARCAO, { ...opcoes, semente: 23 })
}

/**
 * A viga preta de cima, em pedaços ao comprido: cada pedaço sobe com a curva das pontas e afina nelas. Por cima, as
 * duas águas rasas (a quina de luz no meio); dos lados, as faces de pé; nas pontas, o corte inclinado.
 */
function kasagi(palco: Palco, m: Medidas): void {
  const { ky, g } = m
  const base = SHIMAKI[1] * g
  const grossura = GROSSURA_DO_KASAGI * g
  const subida = (u: number): number => SUBIDA_DAS_PONTAS * g * Math.pow(Math.abs(u) / m.a, CURVA_DAS_PONTAS)
  const meia = (u: number): number => MEIA_KASAGI * ky * (1 - (1 - PONTA_FINA) * Math.pow(Math.abs(u) / m.a, 4))
  const cume = CUME_DO_KASAGI * ky
  const opcoes: OpcoesDaVista = { tabua: 0, bisel: 0.5, contorno: 0.16, eixo: 0 }
  const ponta = m.a * 0.99
  for (let i = 0; i < PEDACOS_DO_KASAGI; i += 1) {
    const u0 = -ponta + (2 * ponta * i) / PEDACOS_DO_KASAGI
    const u1 = -ponta + (2 * ponta * (i + 1)) / PEDACOS_DO_KASAGI
    const [b0, b1] = [base + subida(u0), base + subida(u1)]
    const [t0, t1] = [b0 + grossura, b1 + grossura]
    const [w0, w1] = [meia(u0), meia(u1)]
    const dentro: P3 = [(u0 + u1) / 2, 0, (b0 + b1) / 2]
    face(palco, m, [[u0, -w0, t0], [u1, -w1, t1], [u1, 0, t1 + cume], [u0, 0, t0 + cume]], LACA, { ...opcoes, tom: 1.2, semente: 30 + i }, dentro)
    face(palco, m, [[u0, 0, t0 + cume], [u1, 0, t1 + cume], [u1, w1, t1], [u0, w0, t0]], LACA, { ...opcoes, tom: 1.2, semente: 50 + i }, dentro)
    face(palco, m, [[u0, w0, b0], [u1, w1, b1], [u1, w1, t1], [u0, w0, t0]], LACA, { ...opcoes, tom: 0.92, semente: 70 + i }, dentro)
    face(palco, m, [[u0, -w0, b0], [u1, -w1, b1], [u1, -w1, t1], [u0, -w0, t0]], LACA, { ...opcoes, tom: 0.92, semente: 90 + i }, dentro)
  }
  // As pontas: o corte inclinado (mais largo em cima), de pé no fim da viga.
  for (const lado of [-1, 1]) {
    const u = lado * ponta
    const b = base + subida(u)
    const w = meia(u)
    face(palco, m, [[u, -w, b], [u, w, b], [u + lado * 1.6 * ky, w, b + grossura], [u + lado * 1.6 * ky, -w, b + grossura]], LACA, { ...opcoes, tom: 0.85 }, [0, 0, b])
  }
  // A beira de zarcão do shimaki que espia ao sul da viga preta, de cima (só a vista de cima: na 3/4 ela já aparece).
  if (palco.q === 0) {
    const [x0, y0] = noObjeto(m, -SHIMAKI_ATE * m.a, MEIA_KASAGI * ky - 0.2, 0)
    const [x1, y1] = noObjeto(m, SHIMAKI_ATE * m.a, MEIA_KASAGI * ky + BEIRA_DE_ZARCAO * ky, 0)
    palco.deCima(caixa(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), 0.4), ZARCAO, { tabua: 0, bisel: 0.4, contorno: 0.24, eixo: m.deitado ? 0 : QUARTO }, base - 1)
  }
}

export const montarPortalTorii: MontarMovel = (c, cena) => {
  const deitado = c.hw >= c.hh
  const a = deitado ? c.hw : c.hh
  const b = deitado ? c.hh : c.hw
  const k = a / COMPRIMENTO_DE_PARTIDA
  const ky = Math.min(k, b / LARGURA_DE_PARTIDA)
  const m: Medidas = { k, ky, g: G * k, deitado, a }
  const palco = novoPalco(c.peca, cena, c.giro)
  // A sombra no chão, peça por peça (o portão é vazado: o casco de tudo faria uma parede de sombra): cada pilar do
  // pé ao alto, e as duas vigas no alto, caídas pela altura.
  const alto = (SHIMAKI[1] + GROSSURA_DO_KASAGI) * m.g
  const viga = (ate: number, meia: number, z: number): P3[] =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([su, sv]) => noObjeto(m, su * ate * a, sv * meia, z))
  palco.sombra(viga(0.99, MEIA_KASAGI * ky, alto), SOMBRA_DAS_VIGAS, 2.2)
  palco.sombra(viga(NUKI_ATE, MEIA_NUKI * ky, NUKI[1] * m.g), SOMBRA_DAS_VIGAS, 2)
  for (const lado of [-1, 1]) {
    const [x, y] = noObjeto(m, lado * PILAR * a, 0, 0)
    const r = RAIO_DO_PILAR * ky
    const pontos: P3[] = []
    for (const z of [0, SHIMAKI[0] * m.g]) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pontos.push([x + dx * r, y + dy * r, z])
    palco.sombra(pontos, SOMBRA_DAS_VIGAS, 2)
  }
  pilares(palco, m)
  travessas(palco, m)
  kasagi(palco, m)
  palco.fechar()
}

/** A força da sombra de cada peça no chão. */
const SOMBRA_DAS_VIGAS = 0.24

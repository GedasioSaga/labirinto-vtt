/**
 * O CARROSSEL (lote L19 de 14/11/2026, item 105 da lista do dia; construção do parque que não barra: entra-se
 * nele). O estrado redondo de tábuas, oito cavalos de pau no anel de fora, cada um no seu varão de latão, o
 * tambor listrado do meio e o telhado em cone de gomos alternados (a cor do `pano` e o creme), com a sanefa
 * recortada, o galão de latão no beiral e o pináculo com a flâmula.
 *
 * De cima, o telhado é MENOR que o estrado (o carrossel de feira, de toldo curto): os cavalos do anel de fora
 * ficam à mostra, cada um debaixo da ponta do braço que sai do beiral, e é isso que diz "carrossel" e não
 * "tenda". Na 3/4 (as duas vistas de `duasVistasDoParque.ts`), o telhado fica no alto dos braços e os cavalos
 * aparecem de perfil nos varões, virados para onde o carrossel anda (os dos lados, de frente ou de costas, mais
 * estreitos). Redondo: o giro não muda o desenho, só a ordem dos cavalos.
 *
 * Materiais: `madeira` (o estrado e os braços) e `pano` (os gomos coloridos, as listras do tambor e o costado do
 * estrado).
 */
import { rgb } from '../../ruido'
import { anel, barra, cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { deslocada, novoPalco, sanefa, type OpcoesDaVista, type P3, type Palco } from './duasVistasDoParque'

// ---------- os materiais fixos ----------

const CREME: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb('#ddd2bb') }
const LATAO = materialDaPeca('latao')
const FLAMULA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x9a, 0x4c, 0x44] }
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x16, 0x10] }
/** Os cavalos: o branco de pau pintado, o tordilho e o alazão, alternados. */
const PELOS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0xe6, 0xdd, 0xcc] },
  { classe: 'liso', rgb: [0xaa, 0xa6, 0x9e] },
  { classe: 'liso', rgb: [0xe6, 0xdd, 0xcc] },
  { classe: 'liso', rgb: [0x95, 0x63, 0x44] },
]
const CRINA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x38, 0x2c] }
/** As selas, cada cavalo uma: vinho, anil, verde e ocre, contidas. */
const SELAS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x8a, 0x42, 0x3e] },
  { classe: 'liso', rgb: [0x4c, 0x5c, 0x84] },
  { classe: 'liso', rgb: [0x5a, 0x70, 0x4c] },
  { classe: 'liso', rgb: [0xae, 0x86, 0x44] },
]

// ---------- as medidas (px do protótipo num carrossel de 3 casas; crescem com o raio) ----------

/** O raio de partida (a meia pegada de 3 casas): `k` = 1 nele. */
const RAIO_DE_PARTIDA = 84
/** Frações do raio: o estrado, o anel dos cavalos, o beiral do telhado e o tambor do meio. */
const ESTRADO = 0.97
const ANEL_DOS_CAVALOS = 0.76
const BEIRAL = 0.6
const TAMBOR = 0.2
/** As alturas, em casas: o estrado, o beiral (onde saem os braços), o cone acima dele e o pináculo acima do cone. */
const ALTURA_DO_ESTRADO = 0.16
const ALTURA_DO_BEIRAL = 1.22
const ALTURA_DO_CONE = 0.95
const ALTURA_DO_PINACULO = 0.26
/**
 * A COROA (o friso redondo que pende da ponta dos braços, com as lâmpadas): um pouco por fora do anel dos cavalos
 * (px numa de 3 casas), a largura da tábua de cima, a altura do friso, quantas lâmpadas na volta e o raio delas.
 * Sem ela, na 3/4 os varões do fundo subiam acima do telhado como chifres soltos.
 */
const FORA_DOS_CAVALOS = 4.5
const LARGURA_DA_COROA = 1.8
const FRISO_DA_COROA = 5.5
const LAMPADAS = 24
const RAIO_DA_LAMPADA = 0.95
const LAMPADA: MaterialDaPeca = { classe: 'liso', rgb: [0xf2, 0xe6, 0xc4] }
/** Os gomos do telhado e as faces do tambor (listras alternadas). */
const GOMOS = 16
const FACES_DO_TAMBOR = 12
/** Os cavalos: quantos, o ângulo do primeiro (nenhum fica bem na frente do tambor), o comprimento (fração do raio). */
const CAVALOS = 8
const PRIMEIRO_CAVALO = Math.PI / 8
const COMPRIMENTO_DO_CAVALO = 0.36
/** O meio do cavalo acima do estrado (casas) e quanto um sobe e o outro desce (o carrossel parado no meio do galope). */
const ALTURA_DO_CAVALO = 0.42
const GALOPE = 0.05
/** Os de lado ficam de frente ou de costas: a largura do perfil nunca passa abaixo disto. */
const LARGURA_MINIMA_DO_PERFIL = 0.32
/** A sanefa: a faixa e o bico, e o galão do beiral (px numa de 3 casas). */
const FAIXA_DA_SANEFA = 4.2
const BICO_DA_SANEFA = 2.8
const GALAO = 1.4
/** Os raios do varão, do braço e do enfeite da ponta do braço (px numa de 3 casas). */
const RAIO_DO_VARAO = 1.05
const LARGURA_DO_BRACO = 2.6
const RAIO_DO_ENFEITE = 1.7
/** A força da sombra pintada (o telhado e os cavalos no estrado). */
const ALFA_DA_SOMBRA = 0.26
/** O estrado e a sombra dele vão antes de tudo na 3/4: tudo o mais fica em cima dele. */
const ANTES_DE_TUDO = -1e4
/** A coroa, o pináculo, a bola e a flâmula vão depois de tudo na 3/4: ficam no alto, por cima dos gomos. */
const DEPOIS_DE_TUDO = 1e4

const OPCOES_DO_PANO: OpcoesDaVista = { tabua: 0, bisel: 1.1, contorno: 0.24, ruga: 0.25 }
const OPCOES_DO_CAVALO: OpcoesDaVista = { tabua: 0, bisel: 0.7, contorno: 0.3 }
const OPCOES_DA_SOMBRA: OpcoesDaVista = { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA }

interface Medidas {
  readonly k: number
  readonly re: number
  readonly rc: number
  readonly rb: number
  readonly rt: number
  /** O raio da coroa (o friso redondo das lâmpadas). */
  readonly rd: number
  readonly ze: number
  readonly zb: number
  readonly cume: number
  readonly topo: number
}

function medir(r: number): Medidas {
  const k = r / RAIO_DE_PARTIDA
  const ze = ALTURA_DO_ESTRADO * G * k
  const zb = ALTURA_DO_BEIRAL * G * k
  const cume = zb + ALTURA_DO_CONE * G * k
  return { k, re: ESTRADO * r, rc: ANEL_DOS_CAVALOS * r, rb: BEIRAL * r, rt: TAMBOR * r, rd: ANEL_DOS_CAVALOS * r + FORA_DOS_CAVALOS * k, ze, zb, cume, topo: cume + ALTURA_DO_PINACULO * G * k }
}

// ---------- o cavalo ----------

/** O perfil do cavalo de pau, de lado, virado para +X, em unidades de 1/10 do comprimento: [pontos, raio da cadeia]. */
const PERNA_DE_LONGE_DA_FRENTE: readonly Ponto[] = [[1.9, 0.9], [2.8, 1.9], [3.6, 2.1]]
const PERNA_DE_LONGE_DE_TRAS: readonly Ponto[] = [[-1.7, 0.8], [-2.1, 2.1], [-2.2, 3.1]]
const PERNA_DE_PERTO_DA_FRENTE: readonly Ponto[] = [[2.3, 0.7], [3.4, 1.4], [3.2, 2.6]]
const PERNA_DE_PERTO_DE_TRAS: readonly Ponto[] = [[-2.2, 0.6], [-2.9, 1.9], [-3.3, 3.0]]
const RABO: readonly Ponto[] = [[-2.9, -0.5], [-3.9, 0.3], [-4.3, 1.6]]
const CRINA_DO_PESCOCO: readonly Ponto[] = [[1.7, -1.1], [2.6, -2.8], [3.4, -3.8]]
const PESCOCO: readonly Ponto[] = [[1.4, -0.8], [2.6, -3.0], [3.5, -3.7], [4.1, -2.7], [3.3, -1.0], [2.6, 0.5]]
const CABECA: readonly Ponto[] = [[3.3, -3.7], [4.0, -4.0], [5.5, -2.8], [5.8, -2.2], [5.3, -1.9], [4.2, -2.3], [3.6, -2.6]]
const ORELHA: readonly Ponto[] = [[3.5, -3.8], [3.75, -4.6], [4.05, -3.9]]
const MANTA: readonly Ponto[] = [[-1.2, -1.25], [1.0, -1.25], [0.8, 0.7], [-1.0, 0.7]]
const SELA: readonly Ponto[] = [[-1.2, -1.5], [-0.6, -1.2], [0.6, -1.2], [1.0, -1.6], [1.0, -1.0], [-1.2, -1.0]]

/**
 * O cavalo de perfil na 3/4, com o meio do corpo em (cx, cy) na tela: `s` = para onde olha (1 = direita) e
 * `largura` = quanto o perfil encolhe de lado. A ordem é de trás para a frente: as pernas de longe (mais escuras),
 * o rabo, o corpo, o pescoço, a cabeça, a crina, a manta e a sela, e as pernas de perto.
 */
function cavaloDePerfil(palco: Palco, cx: number, cy: number, s: number, largura: number, u: number, pelo: MaterialDaPeca, sela: MaterialDaPeca, fundo: number): void {
  const em = (p: Ponto): Ponto => [cx + s * largura * p[0] * u, cy + p[1] * u]
  const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(em))
  const cad = (pontos: readonly Ponto[], r: number): Forma => cadeia(pontos.map(em), r * u)
  let ordem = 0
  const por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaVista): void => {
    ordem += 1
    palco.deFrente(forma, mat, o, fundo + ordem * 1e-4)
  }
  por(cad(PERNA_DE_LONGE_DA_FRENTE, 0.4), pelo, { ...OPCOES_DO_CAVALO, tom: 0.72 })
  por(cad(PERNA_DE_LONGE_DE_TRAS, 0.42), pelo, { ...OPCOES_DO_CAVALO, tom: 0.72 })
  por(cad(RABO, 0.5), CRINA, { ...OPCOES_DO_CAVALO, tom: 0.95 })
  por(elipse(cx, cy, 3.0 * u * largura, 1.45 * u), pelo, { ...OPCOES_DO_CAVALO, bisel: 1.2 * u })
  por(pol(PESCOCO), pelo, { ...OPCOES_DO_CAVALO, tom: 0.97 })
  por(pol(CABECA), pelo, { ...OPCOES_DO_CAVALO, tom: 0.95 })
  por(pol(ORELHA), pelo, { ...OPCOES_DO_CAVALO, tom: 0.9 })
  por(cad(CRINA_DO_PESCOCO, 0.45), CRINA, { ...OPCOES_DO_CAVALO, tom: 1 })
  por(pol(MANTA), sela, { ...OPCOES_DO_CAVALO, tom: 0.92 })
  por(pol(SELA), sela, { ...OPCOES_DO_CAVALO, tom: 0.7 })
  por(cad(PERNA_DE_PERTO_DA_FRENTE, 0.42), pelo, { ...OPCOES_DO_CAVALO, tom: 0.92 })
  por(cad(PERNA_DE_PERTO_DE_TRAS, 0.46), pelo, { ...OPCOES_DO_CAVALO, tom: 0.92 })
}

/** O cavalo de cima, deitado ao longo de `rumo` (radianos) com o meio em (cx, cy): o corpo, a cabeça, a crina, o rabo e a sela. */
function cavaloDeCima(palco: Palco, cx: number, cy: number, rumo: number, u: number, z: number, pelo: MaterialDaPeca, sela: MaterialDaPeca): void {
  const tx = Math.cos(rumo)
  const ty = Math.sin(rumo)
  const em = (t: number, n: number): Ponto => [cx + tx * t * u - ty * n * u, cy + ty * t * u + tx * n * u]
  palco.deCima(capsula(...em(-2.8, 0), ...em(-4.3, 0.5), 0.45 * u), CRINA, { ...OPCOES_DO_CAVALO, tom: 0.95 }, z)
  palco.deCima(elipseGirada(cx, cy, 3.0 * u, 1.15 * u, rumo), pelo, { ...OPCOES_DO_CAVALO, bisel: 1 * u }, z + 0.01)
  palco.deCima(elipseGirada(...em(3.5, 0), 1.9 * u, 0.62 * u, rumo), pelo, { ...OPCOES_DO_CAVALO, tom: 0.96 }, z + 0.02)
  palco.deCima(capsula(...em(1.6, 0), ...em(3.6, 0), 0.4 * u), CRINA, OPCOES_DO_CAVALO, z + 0.03)
  palco.deCima(elipseGirada(...em(-0.4, 0), 1.05 * u, 1.3 * u, rumo), sela, { ...OPCOES_DO_CAVALO, tom: 0.9 }, z + 0.04)
}

// ---------- o carrossel ----------

/** O estrado: o costado (no `pano`, com o galão de latão), as tábuas por cima e a sombra do telhado nelas. */
function estrado(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  palco.costado(0, 0, m.re, 0, m.ze, c.m.pano, { tabua: 0, bisel: 0.9 * k, contorno: 0.28, tom: 0.86, semente: 10 }, { adiante: ANTES_DE_TUDO })
  const galao = menos(capsula(0, -m.ze + 2.2 * k, 0, -m.ze + 0.6 * k, m.re), elipse(0, -m.ze + 0.6 * k, m.re, m.re))
  palco.deFrente(galao, LATAO, { tabua: 0, bisel: 0.4, contorno: 0.16, tom: 0.9 }, ANTES_DE_TUDO + 150)
  palco.plano(elipse(0, 0, m.re, m.re), m.ze, c.m.madeira, { tabua: 6.5 * k, eixo: 0, bisel: 1.2 * k, contorno: 0.28, semente: 11 }, { adiante: ANTES_DE_TUDO + 200 })
  // A sombra do telhado nas tábuas, caída para baixo à direita na tela (a luz não gira com o objeto).
  const alto = m.zb - m.ze
  const sombra = dentroDe(elipse(SOMBRA_X * alto, SOMBRA_Y * alto, m.rb + 1.5 * k, m.rb + 1.5 * k), elipse(0, 0, m.re - 0.8, m.re - 0.8))
  palco.deCima(sombra, SOMBRA, OPCOES_DA_SOMBRA, m.ze + 0.1)
  palco.deFrente(deslocada(sombra, 0, -m.ze), SOMBRA, OPCOES_DA_SOMBRA, ANTES_DE_TUDO + 300)
  // A beira de latão das tábuas, de cima.
  palco.deCima(anel(0, 0, m.re, m.re, m.re - 1.6 * k, m.re - 1.6 * k), LATAO, { tabua: 0, bisel: 0.5, contorno: 0.2, tom: 0.85 }, m.ze + 0.2)
}

/** Os oito cavalos, cada um com o varão, o braço do beiral, o enfeite da ponta e a sombra no estrado. */
function cavalos(palco: Palco, c: ContextoDoMovel, m: Medidas, r: number): void {
  const k = m.k
  const u = (COMPRIMENTO_DO_CAVALO * r) / 10
  for (let i = 0; i < CAVALOS; i += 1) {
    const a = PRIMEIRO_CAVALO + (i * 2 * Math.PI) / CAVALOS
    const hx = m.rc * Math.cos(a)
    const hy = m.rc * Math.sin(a)
    const z = m.ze + (ALTURA_DO_CAVALO + (i % 2 === 0 ? GALOPE : -GALOPE)) * G * k
    const pelo = PELOS[i % PELOS.length]
    const sela = SELAS[i % SELAS.length]
    // Andando no sentido anti-horário da tela: de frente para (-sen a, cos a).
    const rumo = Math.atan2(Math.cos(a), -Math.sin(a))
    // A sombra no estrado, na tela (caída para baixo à direita pela altura acima das tábuas).
    const [gx, gy] = palco.noChao(hx, hy)
    const [tx, ty] = palco.noChao(Math.cos(rumo), Math.sin(rumo))
    const alto = z - m.ze
    const sombra = elipseGirada(gx + SOMBRA_X * alto, gy + SOMBRA_Y * alto, 3.2 * u, 1.3 * u, Math.atan2(ty, tx))
    palco.deCima(sombra, SOMBRA, OPCOES_DA_SOMBRA, m.ze + 0.3)
    palco.deFrente(deslocada(sombra, 0, -m.ze), SOMBRA, OPCOES_DA_SOMBRA, ANTES_DE_TUDO + 301 + i)
    // O varão, do estrado ao braço; o cavalo vai logo depois dele (por cima, o varão espia em cima e embaixo).
    palco.costado(hx, hy, RAIO_DO_VARAO * k, m.ze, m.zb, LATAO, { bisel: 0.6, contorno: 0.26, metal: 0.55, semente: 20 + i })
    const fundo = gy + RAIO_DO_VARAO * k + (m.ze + m.zb) / 2 + 0.5
    const largura = Math.max(LARGURA_MINIMA_DO_PERFIL, Math.abs(tx))
    cavaloDePerfil(palco, gx, gy - z, tx < 0 ? -1 : 1, largura, u, pelo, sela, fundo)
    cavaloDeCima(palco, hx, hy, rumo, u, z, pelo, sela)
    // O braço que sai de baixo do beiral até o varão, e o enfeite de latão na ponta.
    palco.plano(barra(m.rt * Math.cos(a), m.rt * Math.sin(a), m.rd * Math.cos(a), m.rd * Math.sin(a), LARGURA_DO_BRACO * k), m.zb, c.m.madeira, { tabua: 0, eixo: a, bisel: 0.7, contorno: 0.26, tom: 0.9, semente: 30 + i })
    palco.plano(elipse(hx, hy, RAIO_DO_ENFEITE * k, RAIO_DO_ENFEITE * k), m.zb + 0.5, LATAO, { bisel: 0.9 * k, contorno: 0.28, metal: 0.6, semente: 40 + i })
  }
}

/** O tambor do meio: as faces de pé em listras (o `pano` e o creme), do estrado ao beiral. */
function tambor(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const dentro: P3 = [0, 0, m.ze]
  for (let i = 0; i < FACES_DO_TAMBOR; i += 1) {
    const a0 = (i * 2 * Math.PI) / FACES_DO_TAMBOR
    const a1 = a0 + (2 * Math.PI) / FACES_DO_TAMBOR
    const p0: Ponto = [m.rt * Math.cos(a0), m.rt * Math.sin(a0)]
    const p1: Ponto = [m.rt * Math.cos(a1), m.rt * Math.sin(a1)]
    palco.face([[p0[0], p0[1], m.ze], [p1[0], p1[1], m.ze], [p1[0], p1[1], m.zb], [p0[0], p0[1], m.zb]], i % 2 === 0 ? c.m.pano : CREME, { ...OPCOES_DO_PANO, eixo: QUARTO, semente: 50 + i }, { dentro })
  }
}

/** O friso da coroa e a metade da frente dela vão depois dos cavalos e do telhado na 3/4 (antes do pináculo). */
const DEPOIS_DA_FRENTE = 500

/**
 * A coroa: a tábua redonda na ponta dos braços, com as lâmpadas. De cima, o anel e as lâmpadas. Na 3/4, a metade de
 * trás fica atrás do telhado e a da frente passa na frente de tudo, com o friso de pé (o `pano`, a beira de latão
 * embaixo) e as lâmpadas nele. Redondo: a frente da tela é a mesma em qualquer giro.
 */
function coroa(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  const fora = m.rd + (LARGURA_DA_COROA * k) / 2
  const dentro = m.rd - (LARGURA_DA_COROA * k) / 2
  const tabua = anel(0, 0, fora, fora, dentro, dentro)
  const opcoes: OpcoesDaVista = { tabua: 0, bisel: 0.6, contorno: 0.26, semente: 70 }
  palco.deCima(tabua, c.m.pano, opcoes, m.zb + 0.4)
  const passo = (2 * Math.PI) / LAMPADAS
  for (let i = 0; i < LAMPADAS; i += 1) {
    const a = (i + 0.5) * passo
    palco.deCima(elipse(m.rd * Math.cos(a), m.rd * Math.sin(a), RAIO_DA_LAMPADA * k, RAIO_DA_LAMPADA * k), LAMPADA, { tabua: 0, bisel: 0.5, contorno: 0.2 }, m.zb + 0.5)
  }
  const noAlto = deslocada(tabua, 0, -m.zb)
  palco.deFrente(dentroDe(noAlto, caixa(-fora - 1, -m.zb - fora - 1, fora + 1, -m.zb)), LATAO, { ...opcoes, metal: 0.5 }, 0)
  const friso = FRISO_DA_COROA * k
  palco.deFrente(menos(capsula(0, -m.zb + friso, 0, -m.zb, fora), elipse(0, -m.zb, fora, fora)), c.m.pano, { ...opcoes, tom: 0.8, eixo: QUARTO }, DEPOIS_DA_FRENTE)
  const baixo = friso - 1.2 * k
  palco.deFrente(menos(capsula(0, -m.zb + friso, 0, -m.zb + baixo, fora), elipse(0, -m.zb + baixo, fora, fora)), LATAO, { tabua: 0, bisel: 0.3, contorno: 0.14, tom: 0.85 }, DEPOIS_DA_FRENTE + 1)
  palco.deFrente(dentroDe(noAlto, caixa(-fora - 1, -m.zb, fora + 1, -m.zb + fora + 1)), LATAO, { ...opcoes, metal: 0.5 }, DEPOIS_DA_FRENTE + 2)
  // As lâmpadas do friso, só as que ficam de frente (de lado elas se amontoariam na beira).
  for (let i = 0; i < LAMPADAS; i += 1) {
    const a = (i + 0.5) * passo
    if (Math.sin(a) < LAMPADA_DE_FRENTE) continue
    const x = fora * Math.cos(a)
    const y = fora * Math.sin(a) - m.zb + baixo / 2 + 0.4 * k
    palco.deFrente(elipse(x, y, RAIO_DA_LAMPADA * k, RAIO_DA_LAMPADA * k), LAMPADA, { tabua: 0, bisel: 0.5, contorno: 0.22, tom: 1.08 }, DEPOIS_DA_FRENTE + 3)
  }
}

/** Só a lâmpada com o seno do ângulo acima disto entra no friso de frente. */
const LAMPADA_DE_FRENTE = 0.22

/** O telhado: os gomos em leque, a sanefa recortada, o galão do beiral, a coroa e o pináculo com a flâmula. */
function telhado(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  const apice: P3 = [0, 0, m.cume]
  const beiral = (a: number): P3 => [m.rb * Math.cos(a), m.rb * Math.sin(a), m.zb]
  const passo = (2 * Math.PI) / GOMOS
  for (let i = 0; i < GOMOS; i += 1) {
    const a0 = i * passo
    palco.face([apice, beiral(a0), beiral(a0 + passo / 2), beiral(a0 + passo)], i % 2 === 0 ? c.m.pano : CREME, { ...OPCOES_DO_PANO, eixo: a0 + passo / 2, semente: 60 + i })
  }
  const contorno: Ponto[] = Array.from({ length: GOMOS }, (_, i) => [(m.rb + 0.4) * Math.cos(i * passo), (m.rb + 0.4) * Math.sin(i * passo)])
  sanefa(palco, contorno, m.zb, FAIXA_DA_SANEFA * k, BICO_DA_SANEFA * k, [CREME, c.m.pano], { ...OPCOES_DO_PANO, eixo: QUARTO }, [0, 0, m.zb])
  // O galão do beiral: de cima o anel de latão na beira; na 3/4 a beira de cima da sanefa.
  palco.plano(anel(0, 0, m.rb + 0.9 * k, m.rb + 0.9 * k, m.rb - GALAO * k, m.rb - GALAO * k), m.zb + 0.3, LATAO, { tabua: 0, bisel: 0.5, contorno: 0.2, tom: 0.9, metal: 0.5 }, { acima: m.cume, adiante: m.rb })
  // A coroa onde os gomos se juntam, o pináculo, a bola e a flâmula (de cima, uma fita para a direita).
  palco.plano(elipse(0, 0, 4 * k, 4 * k), m.cume, LATAO, { bisel: 1.4 * k, contorno: 0.28, tom: 0.9 }, { acima: 1, adiante: DEPOIS_DE_TUDO })
  palco.costado(0, 0, 0.9 * k, m.cume, m.topo, LATAO, { bisel: 0.6, contorno: 0.28, metal: 0.5 }, { adiante: DEPOIS_DE_TUDO + 1 })
  palco.plano(elipse(0, 0, 1.9 * k, 1.9 * k), m.topo, LATAO, { bisel: 1.1 * k, contorno: 0.28, metal: 0.65 }, { acima: 3, adiante: DEPOIS_DE_TUDO + 2 })
  const [bx, by] = palco.naTela([0, 0, m.topo - 2.4 * k])
  palco.deFrente(poligono([[bx + 0.8 * k, by - 2.2 * k], [bx + 7 * k, by - 0.8 * k], [bx + 13 * k, by + 0.6 * k], [bx + 7 * k, by + 1.6 * k], [bx + 0.8 * k, by + 2.4 * k]]), FLAMULA, { tabua: 0, bisel: 0.6, contorno: 0.26, tom: 0.92 }, DEPOIS_DE_TUDO + 3)
  palco.deCima(poligono([[1.4 * k, -1 * k], [8 * k, -0.4 * k], [14 * k, 0.6 * k], [8 * k, 1.1 * k], [1.4 * k, 1 * k]]), FLAMULA, { tabua: 0, bisel: 0.5, contorno: 0.25 }, m.topo + 1)
}

export const montarCarrossel: MontarMovel = (c, cena) => {
  const r = Math.min(c.hw, c.hh)
  const m = medir(r)
  const palco = novoPalco(c.peca, cena, c.giro)
  // A sombra no chão: o estrado, o beiral e a ponta do pináculo, caídos pela altura; e o contato do estrado.
  const pontos: P3[] = []
  for (let i = 0; i < GOMOS; i += 1) {
    const a = (i * 2 * Math.PI) / GOMOS
    pontos.push([m.re * Math.cos(a), m.re * Math.sin(a), m.ze], [m.rb * Math.cos(a), m.rb * Math.sin(a), m.zb])
  }
  pontos.push([0, 0, m.topo])
  palco.sombra(pontos, 0.26, 2.6)
  palco.contato(elipse(0, 0, m.re + 0.6, m.re + 0.6), 0.34)
  estrado(palco, c, m)
  tambor(palco, c, m)
  cavalos(palco, c, m, r)
  coroa(palco, c, m)
  telhado(palco, c, m)
  palco.fechar()
}

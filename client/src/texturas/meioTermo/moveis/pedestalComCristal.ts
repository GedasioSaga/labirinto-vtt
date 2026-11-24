/**
 * PEDESTAL COM CRISTAL (lote L06 de 24/11/2026, item 54, dos cantos da nave da cripta do mapa 8; desenho próprio, só a
 * ideia do objeto). A base de CANTO: três degraus em quarto de círculo encostados nas duas paredes (o canto da sala é
 * o canto de cima à esquerda da pegada). Os dois de baixo são de blocos, com o encaixe desencontrado meio bloco de um
 * para o outro (como numa parede, e não em leque); o de cima é uma pedra só, com o friso gravado. No MEIO do patamar
 * de cima nasce o NINHO DE CRISTAIS ciano: o grande pende uns 15° para dentro da sala e os outros o rodeiam. Os
 * cristais acendem a pedra: a poça de luz fria no patamar e o fio de luz na quina de cada degrau (pintados); a luz de
 * verdade é a do integrador (`LUZ_DOS_OBJETOS`).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): cada degrau é o quarto de disco em fatias, e a 3/4
 * mostra o espelho curvo com as juntas de pé; cada cristal é um prisma sextavado em fatias, que afina até a ponta.
 * Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`; o ciano e o musgo são fixos.
 *
 * ESTE ARQUIVO TAMBÉM É O APOIO DO LOTE L06 ("Cripta: cristal e chama fria"): o CIANO FRIO, o prisma em fatias
 * (`fatiarCristal`), o ninho (`ninhoDeCristais`), o prisma deitado (`prismaDeitado`), a pedra lapidada das áreas
 * grandes (`tomDaLapidacao`, `texDaFaceta`), o halo e o banho de luz fria na pedra e o musgo preso ao contorno
 * (`musgoPreso`). O sarcófago de cristais, o relicário, a laje tumular acesa, a arandela, o braseiro de chama fria,
 * o ossário, o arcossólio e o selo de cristal importam daqui, para a cripta ler como um conjunto.
 *
 * REVISÃO DO DIRETOR DE ARTE (24/11/2026), os três ajustes que valem para o lote inteiro:
 * 1. VISTO DE CIMA, o cristal é a PONTA SEXTAVADA (as seis facetas em volta do miolo claro), e não uma pétala
 *    comprida: os prismas ficam quase de pé (pouco tombo) e o ninho é irregular, sem roda de pétalas.
 * 2. Área grande de cristal é PEDRA LAPIDADA: ciano com menos saturação, puxado para o azul-acinzentado, com véu
 *    por dentro, e nunca um retângulo liso e claro.
 * 3. Musgo e enfeite ficam PRESOS ao contorno da peça (`musgoPreso`): nada vaza para fora.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, naTela, novoFatiador, rumoDaSombra, sombraNoAr, type Fatiador, type OpcoesDaFatia } from './pilhaDeFatias'
import { disco, ESCURO_DA_PEDRA, lisa, luzDaNormal } from './apoioDasReferencias'

// ---------- o ciano frio do lote L06 ----------

/**
 * O CIANO FRIO do lote, do fundo da face na sombra ao reflexo da quina: contido (saturação HSV de 0,05 a 0,55, abaixo
 * do teto de 0,62 dos móveis), puxado para o azul-acinzentado, nunca neon.
 */
export const CIANO = {
  fundo: [0x3a, 0x72, 0x80],
  escuro: [0x52, 0x94, 0xa2],
  meio: [0x7a, 0xbc, 0xc7],
  claro: [0xae, 0xe0, 0xe5],
  reflexo: [0xe6, 0xf6, 0xf4],
} as const satisfies Record<string, Rgb>

/** A luz fria que o cristal joga em volta: o tom do halo e do banho na pedra. */
export const LUZ_FRIA: Rgb = [0x9c, 0xdc, 0xe6]
/** O material das peças de cristal e de luz: a cor sai da textura. */
export const CRISTAL: MaterialDaPeca = { classe: 'liso', rgb: CIANO.meio }
/** A sombra pintada em cima da pedra (a fatia não projeta): o escuro frio da cripta. */
export const SOMBRA_PINTADA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x30, 0x34] }
/** O musgo do túmulo de pedra e da laje tumular. */
export const MUSGO_DA_CRIPTA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }

const VOLTA = Math.PI * 2
const SEXTO = Math.PI / 3

/** O tom do cristal pela luz da face, de 0 (a face no escuro) a 1 (a face acesa). */
export function tomDoCristal(t: number): Rgb {
  const k = limitar01(t)
  if (k < 0.25) return misturar(CIANO.fundo, CIANO.escuro, k / 0.25)
  if (k < 0.6) return misturar(CIANO.escuro, CIANO.meio, (k - 0.25) / 0.35)
  return misturar(CIANO.meio, CIANO.claro, (k - 0.6) / 0.4)
}

// ---------- a pedra lapidada (as áreas grandes de cristal) ----------

/** O azul-acinzentado para onde a área grande de cristal é puxada: pedra, e não tela acesa. */
const AZUL_ACINZENTADO: Rgb = [0x6c, 0x84, 0x92]

/** A cor com `quanto` (0 a 1) a menos de saturação e um tanto igual do caminho até o azul-acinzentado. */
export function dessaturada(cor: Rgb, quanto: number): Rgb {
  const cinza = 0.3 * cor[0] + 0.59 * cor[1] + 0.11 * cor[2]
  const semCor: Rgb = [cor[0] + (cinza - cor[0]) * quanto, cor[1] + (cinza - cor[1]) * quanto, cor[2] + (cinza - cor[2]) * quanto]
  return misturar(semCor, AZUL_ACINZENTADO, quanto * 0.3)
}

/** O tom da pedra LAPIDADA (a faceta grande, a mesa): o do cristal com `quanto` a menos de saturação. */
export function tomDaLapidacao(t: number, quanto = 0.3): Rgb {
  return dessaturada(tomDoCristal(t), quanto)
}

/** Como a faceta é pintada: o tom, quanto perde de saturação, o véu, a emissão e para onde ela clareia. */
export interface Faceta {
  readonly tom: number
  readonly dessatura?: number
  /** A força do véu de dentro (as nuvens da pedra): quanto o tom anda para cima e para baixo. */
  readonly veu?: number
  readonly emissao?: number
  /** A faceta clareia `ganho` de tom ao longo de (dx, dy), contado de (x, y), em `em` px: a luz que vem de dentro. */
  readonly clareia?: { readonly x: number; readonly y: number; readonly dx: number; readonly dy: number; readonly em: number; readonly ganho: number }
}

/**
 * A textura de uma FACETA de pedra lapidada: o tom dela com o VÉU de dentro (duas escalas de nuvem, a pedra nunca é
 * lisa como vidro de tela) e, se pedido, o degradê para o lado de onde a luz vem. `semente` desloca as nuvens: duas
 * facetas vizinhas não repetem o desenho.
 */
export function texDaFaceta(f: Faceta, semente: number): Textura {
  const dessatura = f.dessatura ?? 0.3
  const veu = f.veu ?? 0.1
  const emissao = f.emissao ?? 0.45
  const [ox, oy] = [hash(semente, 1, 611) * 40, hash(semente, 2, 611) * 40]
  const c = f.clareia
  return (_u, _v, x, y, _p, s) => {
    let tom = f.tom + veu * (ruido(x * 0.16 + ox, y * 0.16 + oy) * 1.5 + ruido(x * 0.5 + oy, y * 0.5 + ox) * 0.6)
    if (c !== undefined) tom += c.ganho * limitar01(((x - c.x) * c.dx + (y - c.y) * c.dy) / c.em)
    const cor = tomDaLapidacao(tom, dessatura)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = emissao
  }
}

/** A cor pura, com a parte que não pega sombra (o fio de reflexo, a trinca acesa). */
export function corAcesa(cor: Rgb, emissao: number): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = emissao
  }
}

// ---------- o prisma em fatias ----------

/** Um cristal: o pé (px, no objeto), o raio do sextavado, a altura, a inclinação (px por px de altura) e o giro das faces. */
export interface Cristal {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly alto: number
  readonly ix: number
  readonly iy: number
  readonly fase: number
}

/**
 * O passo das fatias do prisma de pé (px; o tombado ganha fatias mais juntas, senão a beira sai em serrilha) e de que
 * fração da altura para cima ele afina até a ponta.
 */
const PASSO_DO_CRISTAL = 0.45
const OMBRO = 0.54
/** A fatia mais fina que ainda entra (px de raio): menor que isto some no pixel. */
const RAIO_MINIMO = 0.28
/**
 * O tom das faces pela luz (a normal NA TELA, de -1, de costas para a luz, a 1): a face acesa e a da sombra ficam a
 * mais de dois degraus da rampa uma da outra, senão o prisma lê como plástico ou gelo.
 */
const TOM_DO_MEIO = 0.56
const ABRE_DO_TOM = 0.48
/** O pé é mais fundo (a luz de dentro sobe para a ponta): quanto escurece e até que fração da altura. */
const PE_ESCURO = 0.3
const ATE_ONDE_O_PE = 0.36
/**
 * A ponta acende: o que a faceta do lado da luz ganha de tom no ombro e no bico (a da sombra quase nada: de cima são
 * três tons bem separados) e quanto o MIOLO (o bico, o ponto claro no meio do sextavado) vai ao quase branco.
 */
const TOM_DA_PONTA: readonly [number, number] = [0.08, 0.24]
const MIOLO_DA_PONTA = 0.9
/** O fio de reflexo na quina entre duas faces: a meia largura (px) e a força na quina mais acesa. */
const FIO_DA_QUINA = 0.4
const FORCA_DO_FIO = 0.62
/** Quanto do cristal é emissão: essa parte não pega a sombra de cima (ele é a luz). */
const EMISSAO_DO_CRISTAL = 0.55
/** A direção de onde a luz desenhada vem NA TELA (a de `luzDaNormal`: de cima à esquerda), de comprimento 1. */
const LUZ_NA_TELA: readonly [number, number] = [-0.844, -0.537]

/** As seis faces de uma fatia: o tom de cada uma pela direção em 3D e o fio de reflexo de cada quina. */
function texDaFatia(cr: Cristal, cx: number, cy: number, t: number, q: number, apagado: number): Textura {
  const naPonta = t >= OMBRO
  const subida = naPonta ? (t - OMBRO) / (1 - OMBRO) : 0
  const tons: number[] = []
  for (let k = 0; k < 6; k += 1) {
    const a = cr.fase + (k + 0.5) * SEXTO
    const [sx, sy] = naTela(Math.cos(a), Math.sin(a), q)
    // De -1 a 1: quanto a face olha para a luz. A face de costas para a inclinação olha para cima e pega mais.
    const paraALuz = sx * LUZ_NA_TELA[0] + sy * LUZ_NA_TELA[1]
    const paraCima = naPonta ? 0 : -0.5 * (Math.cos(a) * cr.ix + Math.sin(a) * cr.iy)
    // Na ponta só o lado da luz ganha tom; no corpo o pé é fundo e o tom sobe um nada com a altura.
    const daAltura = naPonta ? (TOM_DA_PONTA[0] + (TOM_DA_PONTA[1] - TOM_DA_PONTA[0]) * subida) * limitar01(0.5 + paraALuz) : 0.1 * t - PE_ESCURO * (1 - limitar01(t / ATE_ONDE_O_PE))
    tons.push(TOM_DO_MEIO + ABRE_DO_TOM * Math.sign(paraALuz) * Math.pow(Math.abs(paraALuz), 0.7) + paraCima + daAltura)
  }
  // O miolo: só bem perto do bico as facetas vão ao quase branco (de cima é o ponto claro no meio do sextavado).
  const miolo = naPonta ? MIOLO_DA_PONTA * Math.pow(subida, 3) * (1 - apagado) : 0
  const cores = tons.map((tom) => misturar(tomDoCristal(tom * (1 - apagado * 0.45)), CIANO.reflexo, miolo * limitar01(0.35 + tom * 0.7)))
  // A quina k fica entre a face k - 1 e a face k: acende mais onde as duas faces são claras.
  const fios = tons.map((tom, k) => FORCA_DO_FIO * limitar01(0.2 + 0.8 * Math.max(tom, tons[(k + 5) % 6])) * (1 - apagado))
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    const volta = (Math.atan2(dy, dx) - cr.fase) / SEXTO
    const inteiro = Math.floor(volta)
    const k = ((inteiro % 6) + 6) % 6
    const dentro = volta - inteiro
    const cor = cores[k]
    let r = cor[0]
    let g = cor[1]
    let b = cor[2]
    const quina = dentro < 0.5 ? k : (k + 1) % 6
    const ateAQuina = (dentro < 0.5 ? dentro : 1 - dentro) * SEXTO * Math.sqrt(dx * dx + dy * dy)
    if (ateAQuina < FIO_DA_QUINA) {
      const w = (1 - ateAQuina / FIO_DA_QUINA) * fios[quina]
      r += (CIANO.reflexo[0] - r) * w
      g += (CIANO.reflexo[1] - g) * w
      b += (CIANO.reflexo[2] - b) * w
    }
    s[0] = r
    s[1] = g
    s[2] = b
    s[4] = EMISSAO_DO_CRISTAL * (1 - apagado)
  }
}

/**
 * O cristal em FATIAS na pilha `f`, com o pé na altura `z0`: o sextavado sobe pela inclinação e afina do ombro ao
 * bico. De cima, o que se vê é a ponta: as seis facetas em volta do miolo claro. `apagado` (0 a 1) tira a luz de
 * dentro (o cristal morto, só pedra azulada).
 */
export function fatiarCristal(f: Fatiador, camada: number, z0: number, cr: Cristal, semente: number, apagado = 0): void {
  const passo = PASSO_DO_CRISTAL / (1 + 0.9 * Math.hypot(cr.ix, cr.iy))
  for (const h of alturas(0, cr.alto, passo)) {
    const t = h / cr.alto
    const r = t < OMBRO ? cr.r : cr.r * (1 - (t - OMBRO) / (1 - OMBRO))
    if (r < RAIO_MINIMO) continue
    const cx = cr.x + cr.ix * h
    const cy = cr.y + cr.iy * h
    const pontos: Ponto[] = []
    for (let k = 0; k < 6; k += 1) pontos.push([cx + Math.cos(cr.fase + k * SEXTO) * r, cy + Math.sin(cr.fase + k * SEXTO) * r])
    f.fatia(camada, z0 + h, poligono(pontos), CRISTAL, lisa(1, texDaFatia(cr, cx, cy, t, f.q, apagado), semente))
  }
}

/** O ninho: o meio, o raio em que os pés se espalham, a altura do maior, quantos e para onde abrem. */
export interface Ninho {
  readonly cx: number
  readonly cy: number
  readonly raio: number
  readonly alto: number
  readonly quantos: number
  readonly semente: number
  /** O arco de azimutes (radianos; 0 = para a direita, pi/2 = para baixo) em que os de fora ficam. Ausente = a volta toda. */
  readonly de?: number
  readonly ate?: number
  /** Quanto os de fora tombam para fora (px por px de altura). Pouco: de cima o cristal é a ponta, não uma pétala. */
  readonly tombo?: number
  /** A inclinação do GRANDE (px por px de altura); ausente = quase de pé, pendendo um nada para o meio do arco. */
  readonly pende?: readonly [number, number]
  /** O raio do sextavado do grande, em fração do raio do ninho. */
  readonly gordura?: number
}

/** Os tamanhos dos de fora (fração do grande), nesta ordem: nunca dois vizinhos iguais. */
const TAMANHOS_DO_NINHO: readonly number[] = [0.7, 0.44, 0.56, 0.34, 0.5, 0.3, 0.4]
/** O tombo de partida dos de fora e o teto do que a ponta anda, de cima, em diâmetros do próprio prisma. */
const TOMBO_DE_PARTIDA = 0.24
const PONTA_ANDA_NO_MAXIMO = 0.95

/**
 * Os cristais de um ninho, sempre os mesmos para a mesma semente: o GRANDE fora do meio, quase em pé, e os outros em
 * volta, de tamanhos desencontrados, a distâncias e em ângulos irregulares, cada um tombando POUCO para o seu lado.
 * Nada de roda: de cima, um ninho de pétalas iguais abrindo do meio lia como flor.
 */
export function ninhoDeCristais(n: Ninho): Cristal[] {
  const de = n.de ?? 0
  const ate = n.ate ?? VOLTA
  const meio = (de + ate) / 2
  const fechado = ate - de < VOLTA - 0.01
  const tombo = n.tombo ?? TOMBO_DE_PARTIDA
  const gordura = n.gordura ?? 0.44
  const s = n.semente
  // O grande fica um pouco para trás do arco (ou para um lado qualquer, na volta toda).
  const aDoGrande = fechado ? meio + Math.PI + (hash(1, 0, s) - 0.5) * 1.4 : hash(1, 0, s) * VOLTA
  const recuo = n.raio * (fechado ? 0.28 : 0.2)
  const pende = n.pende ?? [Math.cos(meio) * tombo * 0.4 + (hash(2, 0, s) - 0.5) * 0.1, Math.sin(meio) * tombo * 0.4 + (hash(3, 0, s) - 0.5) * 0.1]
  const lista: Cristal[] = [{ x: n.cx + Math.cos(aDoGrande) * recuo, y: n.cy + Math.sin(aDoGrande) * recuo, r: n.raio * gordura, alto: n.alto, ix: pende[0], iy: pende[1], fase: hash(4, 0, s) * SEXTO }]
  const fora = n.quantos - 1
  // Ângulos irregulares: o arco é repartido em fatias de larguras bem diferentes (uns encostam, outros deixam um
  // vão), e cada um fica num ponto qualquer da sua. Em fatias iguais, quatro em volta do grande davam uma cruz.
  const larguras = Array.from({ length: fora }, (_, i) => 0.45 + 1.3 * hash(i, 4, s))
  const total = larguras.reduce((soma, l) => soma + l, 0)
  let andado = fechado ? 0 : hash(5, 0, s) * total
  for (let i = 0; i < fora; i += 1) {
    const fracao = (andado + larguras[i] * (0.3 + 0.4 * hash(i, 11, s))) / total
    andado += larguras[i]
    const a = de + (ate - de) * fracao
    const tamanho = TAMANHOS_DO_NINHO[i % TAMANHOS_DO_NINHO.length] * (0.9 + 0.2 * hash(i, 6, s))
    const d = n.raio * (0.6 + 0.42 * hash(i, 5, s))
    const r = n.raio * gordura * (0.42 + 0.44 * tamanho) * (0.92 + 0.16 * hash(i, 8, s))
    const alto = n.alto * tamanho
    // Tomba para fora com desvio, e nunca tanto que a ponta ande mais que um diâmetro (viraria pétala).
    const rumo = a + (hash(i, 10, s) - 0.5) * 1.1
    const abre = Math.min(tombo * (0.6 + 0.9 * hash(i, 7, s)), (PONTA_ANDA_NO_MAXIMO * 2 * r) / alto)
    lista.push({ x: n.cx + Math.cos(a) * d, y: n.cy + Math.sin(a) * d, r, alto, ix: Math.cos(rumo) * abre, iy: Math.sin(rumo) * abre, fase: hash(i, 9, s) * SEXTO })
  }
  return lista
}

/** A lasca de rocha em volta do pé de um cristal: seis quinas de raio sorteado (o corte reto do prisma não aparece). */
export function lascaDeRocha(cr: Cristal, semente: number): Forma {
  const pontos: Ponto[] = []
  for (let k = 0; k < 6; k += 1) {
    const a = k * SEXTO + hash(k, 1, semente) * 0.6
    const d = cr.r * (1.25 + 0.5 * hash(k, 2, semente))
    pontos.push([cr.x + Math.cos(a) * d, cr.y + Math.sin(a) * d])
  }
  return poligono(pontos)
}

/** A sombra CURTA de um cristal no plano em que ele pisa: do pé até a sombra do bico, para o lado da sombra NA TELA. */
export function sombraDoCristal(cr: Cristal, q: number): Forma {
  const [rx, ry] = rumoDaSombra(q)
  return capsula(cr.x, cr.y, cr.x + (cr.ix + rx) * cr.alto, cr.y + (cr.iy + ry) * cr.alto, cr.r * 0.85)
}

// ---------- o prisma deitado (a arandela, as lascas caídas) ----------

/** Um prisma visto DE LADO: do pé (x, y) anda `comprido` px no rumo `rumo` (radianos), com `meia` de meia largura. */
export interface PrismaDeitado {
  readonly x: number
  readonly y: number
  readonly rumo: number
  readonly comprido: number
  readonly meia: number
}

/** Uma face do prisma deitado: a forma e as opções da peça (ou da fatia). */
export interface FaceDoPrisma {
  readonly forma: Forma
  readonly o: OpcoesDaFatia
}

/**
 * As faces de um prisma DEITADO, de baixo para cima: a face do lado da luz, a do lado da sombra (dois degraus mais
 * escura), a faceta acesa do bico com o miolo claro e o fio de reflexo na quina. `q` = o quarto de volta (a luz fica
 * no lado certo NA TELA); `luz` (0 a 1) acende ou apaga o conjunto.
 */
export function prismaDeitado(p: PrismaDeitado, q: number, semente: number, luz = 1): FaceDoPrisma[] {
  const [ux, uy] = [Math.cos(p.rumo), Math.sin(p.rumo)]
  // O lado que olha para a luz NA TELA é o da face clara.
  const [tx, ty] = naTela(-uy, ux, q)
  const lado = tx * LUZ_NA_TELA[0] + ty * LUZ_NA_TELA[1] >= 0 ? 1 : -1
  const [nx, ny] = [-uy * lado, ux * lado]
  const em = (ao: number, deLado: number): Ponto => [p.x + ux * ao + nx * deLado, p.y + uy * ao + ny * deLado]
  const ombro = p.comprido - Math.min(p.comprido * 0.32, p.meia * 1.9)
  // A quina não fica no meio: a face clara é a mais larga.
  const quina = -p.meia * 0.2
  const bico = em(p.comprido, quina * 0.5)
  const chapada = (tom: number, emissao: number, clareia = 0): OpcoesDaFatia => ({ tabua: 0, bisel: 0, contorno: 0.2, textura: corAcesa(misturar(tomDoCristal(tom), CIANO.reflexo, clareia), emissao * luz), semente })
  return [
    { forma: poligono([em(0, p.meia), em(ombro, p.meia), bico, em(ombro, quina), em(0, quina)]), o: chapada(0.86 * luz, 0.55) },
    { forma: poligono([em(0, quina), em(ombro, quina), bico, em(ombro, -p.meia), em(0, -p.meia)]), o: chapada(0.2 * luz, 0.5) },
    // O pé fundo: a luz de dentro sobe para a ponta.
    { forma: poligono([em(0, p.meia), em(p.comprido * 0.3, p.meia), em(p.comprido * 0.3, -p.meia), em(0, -p.meia)]), o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 0.5, textura: corAcesa(CIANO.fundo, 0.3), semente: semente + 1 } },
    { forma: poligono([em(ombro, p.meia), bico, em(ombro, quina)]), o: chapada(1, 0.7, 0.5 * luz) },
    { forma: capsula(...em(p.comprido * 0.16, quina), ...em(ombro, quina), 0.19), o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.62 * luz, textura: corAcesa(CIANO.reflexo, 1), semente: semente + 2 } },
  ]
}

// ---------- a luz fria ----------

/** O halo frio: a luz do cristal com alfa que cai suave do meio (cx, cy) até os raios rx, ry. Toda emissão. */
export function texHaloFrio(cx: number, cy: number, rx: number, ry: number, alfa: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const d2 = Math.min(1, dx * dx + dy * dy)
    s[0] = LUZ_FRIA[0]
    s[1] = LUZ_FRIA[1]
    s[2] = LUZ_FRIA[2]
    s[4] = 1
    s[5] = alfa * (1 - d2) * (1 - d2)
  }
}

/** Uma fonte de luz fria na pedra: o meio, o raio em que ela cai a um terço e a força no meio (0 a 1). */
export interface FonteFria {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly forca: number
}

/** Teto do banho: a pedra nunca vira cristal. */
const BANHO_MAXIMO = 0.55
/** O banho também CLAREIA a pedra (a luz chega nela): sem isso o ciano sobre o cinza do granito quase não aparecia. */
const CLAREIA_NO_BANHO = 0.34

/** Quanto da luz fria das fontes chega ao ponto (0 a `BANHO_MAXIMO`). */
export function luzFriaEm(x: number, y: number, fontes: readonly FonteFria[]): number {
  let w = 0
  for (const f of fontes) {
    const d2 = ((x - f.x) * (x - f.x) + (y - f.y) * (y - f.y)) / (f.r * f.r)
    if (d2 < 4) w += f.forca * Math.exp(-d2 * 1.1)
  }
  return w > BANHO_MAXIMO ? BANHO_MAXIMO : w
}

/**
 * A textura `base` BANHADA pela luz fria das `fontes`: a cor da peça puxa para a luz perto delas e clareia, e essa
 * parte não escurece com a sombra (emissão). É o que diz "o cristal acende a pedra" sem depender da luz do mapa.
 */
export function banhada(base: Textura | null, fontes: readonly FonteFria[]): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const w = luzFriaEm(x, y, fontes)
    if (w <= 0.004) return
    s[0] += (LUZ_FRIA[0] - s[0]) * w
    s[1] += (LUZ_FRIA[1] - s[1]) * w
    s[2] += (LUZ_FRIA[2] - s[2]) * w
    s[3] += w * CLAREIA_NO_BANHO
    if (w * 0.7 > s[4]) s[4] = w * 0.7
  }
}

/**
 * A textura `base` numa fatia de DENTRO da pilha, na altura `z`: o grão anda com a altura. Sem isso toda fatia lê o
 * mesmo ponto do grão e, na frente da 3/4, ele vira riscas de pé.
 */
export function graoNaAltura(base: Textura | null, z: number): Textura | null {
  if (base === null) return null
  return (u, v, x, y, p, s, escala) => base(u + z * 3.7, v + z * 5.3, x, y, p, s, escala)
}

// ---------- o musgo preso ao contorno ----------

/** As opções da mancha de musgo: macia e meio transparente. A beira macia espalha `MUSGO.suave` px para fora da forma. */
export const MUSGO = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.5, suave: 0.9 } as const

/**
 * A mancha de musgo PRESA ao `limite` (a junta, a laje, o degrau): cortada por ele com a folga da beira macia, para
 * nada passar do contorno da peça. Todo musgo do lote passa por aqui.
 */
export function musgoPreso(mancha: Forma, limite: Forma, folga: number = MUSGO.suave * 0.6): Forma {
  return dentroDe(mancha, { b: limite.b, d: (x, y) => limite.d(x, y) + folga })
}

// ---------- o pedestal ----------

/**
 * Os três degraus: o raio (fração do menor lado da pegada), o alto (casas), os blocos em que o quarto de volta é
 * cortado (0 = pedra inteira) e o desencontro do encaixe (meio bloco de um degrau para o outro).
 */
const DEGRAUS = [
  { raio: 0.98, alto: 0.12, blocos: 4, desencontro: 0, tom: 0.86 },
  { raio: 0.74, alto: 0.24, blocos: 4, desencontro: 0.5, tom: 0.93 },
  { raio: 0.5, alto: 0.36, blocos: 0, desencontro: 0, tom: 1 },
] as const
/** O passo das fatias dos degraus (px), a meia largura da junta entre os blocos (px) e quanto ela escurece (pouco: não lista). */
const PASSO = 0.8
const JUNTA = 0.4
const ESCURO_DA_JUNTA = { piso: 0.13, espelho: 0.1 } as const
/** O friso gravado no patamar (px a partir da beira) e a meia largura dele. */
const FRISO = 3.4
const MEIO_FRISO = 0.5
/** O fio de luz na quina de cada degrau: a largura (px a partir da beira), a força junto do ninho e até onde chega (px). */
const FIO_DE_LUZ = { largura: 1, forca: 0.46, alcance: 44 } as const
/**
 * O ninho no MEIO do patamar (a fração do raio dele em que o meio do quarto de disco fica, em cada eixo), o raio
 * (fração do raio do patamar), a altura do grande (casas) e quanto ele pende para dentro da sala (uns 15°).
 */
const NINHO = { em: 0.43, raio: 0.25, alto: 0.45, quantos: 5, pende: 0.19 } as const
/** A poça de luz fria no patamar: o alfa no meio. */
const POCA_DE_LUZ = 0.36
const SEMENTE = 5400

export const montarPedestalComCristal: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const lado = Math.min(c.w, c.h)
  // O canto da sala: o canto de cima à esquerda da pegada.
  const [ox, oy] = [-hw, -hh]
  const pegada = caixa(-hw, -hh, hw, hh)
  const quarto = (r: number): Forma => dentroDe(disco(ox, oy, r), pegada)
  const raios = DEGRAUS.map((d) => d.raio * lado - 0.5)
  const altos = DEGRAUS.map((d) => d.alto * g)
  const [sx, sy] = rumoDaSombra(q)

  // O ninho no meio do patamar e a luz fria dele na pedra.
  const rPatamar = raios[2]
  const zPatamar = altos[2]
  const [nx, ny] = [ox + rPatamar * NINHO.em, oy + rPatamar * NINHO.em]
  const cristais = ninhoDeCristais({ cx: nx, cy: ny, raio: rPatamar * NINHO.raio, alto: NINHO.alto * g, quantos: NINHO.quantos, pende: [NINHO.pende, NINHO.pende], gordura: 0.5, semente: SEMENTE })
  const fontes: FonteFria[] = [{ x: nx, y: ny, r: rPatamar * 0.7, forca: 0.24 }]

  const comPedra = (luz: (x: number, y: number) => number, grao: Textura | null = daPedra): Textura => (u, v, x, y, p, s, escala) => {
    if (grao !== null) grao(u, v, x, y, p, s, escala)
    s[3] += luz(x, y)
  }
  /** A junta de pé mais perto do ponto, num degrau de `blocos` blocos: a distância ao longo do arco (px) e o bloco. */
  const noLeque = (x: number, y: number, blocos: number, desencontro: number): readonly [number, number] => {
    if (blocos === 0) return [Infinity, 0]
    const volta = (Math.atan2(y - oy, x - ox) / (Math.PI / 2)) * blocos + desencontro
    const bloco = Math.floor(volta)
    const perto = Math.round(volta)
    // A junta que cai em cima da parede não é junta.
    const naParede = desencontro === 0 && (perto <= 0 || perto >= blocos)
    return [naParede ? Infinity : Math.abs(volta - perto) * (Math.PI / 2 / blocos) * Math.hypot(x - ox, y - oy), bloco]
  }
  /** Quanto do fio de luz chega ao ponto: cai com a distância ao ninho. */
  const fioEm = (x: number, y: number): number => {
    const d = Math.hypot(x - nx, y - ny) / FIO_DE_LUZ.alcance
    return FIO_DE_LUZ.forca * Math.exp(-d * d * 1.6)
  }
  const comFio = (base: Textura, quanto: (x: number, y: number) => number): Textura => (u, v, x, y, p, s, escala) => {
    base(u, v, x, y, p, s, escala)
    const w = quanto(x, y)
    if (w <= 0.01) return
    s[0] += (CIANO.claro[0] - s[0]) * w
    s[1] += (CIANO.claro[1] - s[1]) * w
    s[2] += (CIANO.claro[2] - s[2]) * w
    if (w > s[4]) s[4] = w
  }

  DEGRAUS.forEach((d, k) => {
    const r = raios[k]
    const z0 = k === 0 ? 0 : altos[k - 1]
    const z1 = altos[k]
    const forma = quarto(r)
    // O ESPELHO curvo: a luz da face, as juntas de pé, o pé mais escuro e o fio de luz no alto.
    const espelho = (z: number): Textura =>
      comFio(
        banhada(
          comPedra((x, y) => {
            const a = Math.atan2(y - oy, x - ox)
            const [ateAJunta, bloco] = noLeque(x, y, d.blocos, d.desencontro)
            return luzDaNormal(Math.cos(a), Math.sin(a), 0, q) + (ateAJunta < JUNTA ? -ESCURO_DA_JUNTA.espelho : 0) + 0.05 * (hash(bloco, k, SEMENTE + 1) - 0.5) - (z < z0 + 1 ? 0.08 : 0)
          }, graoNaAltura(daPedra, z)),
          fontes,
        ),
        (x, y) => (z > z1 - 1.1 ? fioEm(x, y) * 0.8 : 0),
      )
    // O PISO do degrau: os blocos, a sombra do degrau de cima, o pé dele, a beira gasta e o fio de luz na quina.
    const piso = comFio(
      banhada(
        comPedra((x, y) => {
          const rr = Math.hypot(x - ox, y - oy)
          const [ateAJunta, bloco] = noLeque(x, y, d.blocos, d.desencontro)
          let luz = 0.07 * (hash(bloco, k, SEMENTE + 2) - 0.5) + (ateAJunta < JUNTA ? -ESCURO_DA_JUNTA.piso : 0)
          if (k < 2) {
            const dz = altos[k + 1] - z1
            const naSombra = raios[k + 1] - Math.hypot(x - ox - sx * dz * 1.6, y - oy - sy * dz * 1.6)
            luz -= 0.17 * limitar01(0.5 + naSombra / 1.6)
            luz -= 0.1 * limitar01(1 - (rr - raios[k + 1]) / 1.8)
          } else if (Math.abs(rr - (r - FRISO)) < MEIO_FRISO) {
            luz -= 0.2
          }
          if (rr > r - 1.5) luz += 0.05 + 0.05 * ruido(x * 0.5 + 3, y * 0.5)
          return luz
        }),
        fontes,
      ),
      (x, y) => (Math.hypot(x - ox, y - oy) > r - FIO_DE_LUZ.largura ? fioEm(x, y) : 0),
    )
    for (const z of alturas(z0, z1, PASSO)) {
      const topo = z >= z1 - 1e-6
      f.fatia(0, z, forma, pedra, topo ? { tabua: 0, bisel: 1.1, tom: d.tom, contorno: 0.26, textura: piso, semente: SEMENTE + 10 + k } : lisa(0.66, espelho(z), SEMENTE + 20 + k))
    }
  })

  // O MUSGO nos cantos da parede, preso ao piso de cada degrau de baixo.
  f.fatia(1, altos[0] + 0.2, musgoPreso(elipse(ox + raios[0] * 0.86, oy + 2.4, 4.6, 2.2), menos(quarto(raios[0]), disco(ox, oy, raios[1]))), MUSGO_DA_CRIPTA, { ...MUSGO, semente: SEMENTE + 30 })
  f.fatia(1, altos[1] + 0.2, musgoPreso(elipse(ox + 2.2, oy + raios[1] * 0.84, 2, 3.8), menos(quarto(raios[1]), disco(ox, oy, raios[2]))), MUSGO_DA_CRIPTA, { ...MUSGO, alfa: 0.42, semente: SEMENTE + 31 })

  // No patamar: a POÇA de luz fria, a sombra curta de cada cristal e as lascas de rocha dos pés.
  const patamar = quarto(rPatamar)
  const rPoca = rPatamar * 0.66
  f.fatia(1, zPatamar + 0.1, dentroDe(elipse(nx, ny, rPoca, rPoca), patamar), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(nx, ny, rPoca, rPoca, POCA_DE_LUZ), semente: SEMENTE + 40 })
  cristais.forEach((cr, i) => {
    f.fatia(1, zPatamar + 0.2, dentroDe(sombraDoCristal(cr, q), patamar), SOMBRA_PINTADA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.24, suave: 1, semente: SEMENTE + 50 + i })
    f.fatia(2, zPatamar + 0.5, lascaDeRocha(cr, SEMENTE + 60 + i), pedra, { tabua: 0, bisel: 0.7, tom: 0.84 + 0.12 * hash(i, 3, SEMENTE), contorno: 0.24, textura: banhada(daPedra, fontes), semente: SEMENTE + 70 + i })
  })

  // Os CRISTAIS.
  cristais.forEach((cr, i) => fatiarCristal(f, 3, zPatamar + 0.5, cr, SEMENTE + 80 + i))
  f.fechar()

  // No chão: a sombra dos degraus (para o lado da sombra na tela) e o contato.
  cena.sombras.push(sombraNoAr(quarto(raios[0]), altos[0], q, 0.24, 1.4), sombraNoAr(quarto(raios[1]), altos[1], q, 0.16, 2), contato(quarto(raios[0]), 0.32))
}

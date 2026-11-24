/**
 * CABEÇA COLOSSAL (lote L08 de 24/11/2026, item 73: objeto novo, do tema do templo na selva do mapa 6; desenho próprio,
 * feições próprias, só a ideia do objeto). Uma cabeça de pedra do tamanho de duas casas, meio enterrada: o elmo redondo
 * com a crista no alto e a faixa de três botões na testa, as rodelas das orelhas dos lados, a sobrancelha pesada, os
 * OLHOS FECHADOS (a pálpebra cheia com o risco da fenda), dois riscos gravados descendo de cada olho (a marca dela), o
 * nariz largo, a boca grossa de cantos caídos e o queixo sumindo na terra. A pedra é um basalto cinza-esverdeado quente
 * (o granito e a ardósia do painel puxados para ele), para não esfriar ao lado do arenito da pirâmide.
 *
 * DUAS VISTAS, DOIS DESENHOS (perfil `{ modo: 'derivado', propria: true }`; lê `c.vista` e `c.giro`):
 * - DE CIMA: o alto do elmo domina (perto de dois terços da área, com a capa de musgo), e o rosto é uma faixa em
 *   escorço na borda para onde a cabeça olha (a testa debaixo da faixa, a sobrancelha, as pálpebras, o nariz e o lábio
 *   saindo para a frente). O giro vira a cabeça; a luz e a sombra pousada ficam no lugar (a sombra sai do lado oposto
 *   à luz, em qualquer giro).
 * - NA 3/4: a cabeça de pé. De frente (sem giro), o rosto; de costas, a nuca do elmo; de lado, o perfil com a rodela
 *   da orelha no meio e o nariz saindo do contorno.
 *
 * O tempo por cima: o musgo em TUFOS de beira roída e dois tons (grosso no alto do elmo, escorrendo pelas rugas e
 * pelo canto dos olhos), o escorrido da chuva, uma trinca que desce do elmo até a bochecha, uma lasca faltando no
 * alto, cipós pendurados e, no pé, o musgo com as moitas, a samambaia e duas pedras caídas. Os vincos da boca, do nariz
 * e da pálpebra são escuros o bastante para o rosto ler numa casa.
 *
 * O desenho é feito numa meia pegada de 56 px e escala com o menor lado. Material: `pedra`; o musgo e as plantas são
 * fixos. Escreve `cena.corDoPiso`.
 */
import { cadeia, caixa, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import {
  acasoDoTemplo,
  caixaNaTela,
  cipo,
  DA_PEDRA,
  entregarNaTela,
  ESCURO_DA_PEDRA_DO_TEMPLO,
  manchaIrregular,
  moita,
  MUSGO_CLARO_DO_TEMPLO,
  MUSGO_ESCURO_DO_TEMPLO,
  pontoNaTela,
  samambaia,
  vistaDoTemplo,
  type VistaDoTemplo,
} from './piramideEmDegraus'

/** A meia pegada em que a cabeça é desenhada (px do protótipo). */
const MEIA_PEGADA = 56
/** A altura da cabeça para a sombra no chão (px no desenho de 56): de pé e vista de cima. */
const ALTURA_DE_PE = 0.62 * 2 * MEIA_PEGADA
const ALTURA_DE_CIMA = 46
/** O vão escuro dos sulcos (a fenda do olho, a boca, a narina, a trinca), quase opaco: o rosto tem de ler numa casa. */
const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x34, 0x2c] }

/** O basalto da cabeça: o granito e a ardósia do painel puxados para um cinza-esverdeado quente; o arenito fica como está. */
function basalto(pedra: MaterialDaPeca): MaterialDaPeca {
  const [r, g, b] = pedra.rgb
  if (pedra.pedra === 'arenito') return pedra
  return { ...pedra, rgb: [r * 0.9, g * 0.93, b * 0.8] }
}

/** O que os dois desenhos dividem: a escala, a fábrica e a pedra. */
interface Desenho {
  readonly k: number
  readonly P: CriarPeca
  readonly L: Peca[]
  readonly pedra: MaterialDaPeca
  readonly liso: OpcoesDaPeca
}

/**
 * Um TUFO de musgo da cabeça: a mancha escura de beira roída e, por cima, a clara menor do lado da luz. `dentro`
 * prende o tufo a uma forma (o elmo). Comprido de pé (`ry` maior que `rx`) é o musgo que escorre por uma ruga.
 */
function musgo(d: Desenho, forma: (x: number, y: number, rx: number, ry: number, semente: number) => Forma, x: number, y: number, rx: number, ry: number, semente: number, dentro?: Forma): void {
  const { k, P, L } = d
  const escura = forma(x, y, rx, ry, semente)
  const clara = forma(x - rx * 0.18, y - ry * 0.22, rx * 0.62, ry * 0.58, semente + 13)
  L.push(P(dentro === undefined ? escura : dentroDe(dentro, escura), MUSGO_ESCURO_DO_TEMPLO, { bisel: 0, contorno: 0.16, alfa: 0.95, suave: 0.6 * k, tom: 0.96 + 0.1 * acasoDoTemplo(semente, 51), semente: 5890 + semente, projeta: { dist: 0.9 * k, forca: 0.16 } }))
  L.push(P(dentro === undefined ? clara : dentroDe(dentro, clara), MUSGO_CLARO_DO_TEMPLO, { bisel: 0, contorno: 0, alfa: 0.9, suave: 0.7 * k, tom: 0.92 + 0.12 * acasoDoTemplo(semente, 52), semente: 5940 + semente }))
}

/** O pé da cabeça: o musgo, as moitas, a samambaia e as pedras caídas, em volta do ponto (0, `y`) do desenho. */
function pe(d: Desenho, em: (x: number, y: number) => Ponto, y: number): void {
  const { k, P, L, pedra } = d
  const mancha = (x: number, yy: number, rx: number, ry: number, semente: number): Forma => manchaIrregular(...em(x, yy), rx * k, ry * k, 0, semente, 0.5)
  for (const [x, dy, rx, ry, semente] of [[-30, 0, 16, 5.6, 1], [-2, 1.4, 18, 5, 2], [24, 0.4, 16, 5.2, 3], [43, 2, 8, 3.4, 4]] as const) musgo(d, mancha, x, y + dy, rx, ry, 60 + semente)
  for (const [x, dy, r, giro] of [[41, -4, 5.4, 0.5], [48, 2, 3.6, 2.1]] as const) {
    const [px, py] = em(x, y + dy)
    const [cs, sn] = [Math.cos(giro), Math.sin(giro)]
    const canto = (ax: number, ay: number): Ponto => [px + (ax * cs - ay * sn) * k, py + (ax * sn + ay * cs) * k]
    L.push(P(poligono([canto(-r, -r * 0.7), canto(r, -r * 0.7), canto(r, r * 0.7), canto(-r, r * 0.7)]), pedra, { bisel: 1.6 * k, tom: 0.98, contorno: 0.28, textura: DA_PEDRA, semente: 5980 + Math.round(x), projeta: { dist: 1.6 * k, forca: 0.3 } }))
  }
  moita(L, P, ...em(-37, y - 3), 8 * k, 610, 5)
  moita(L, P, ...em(30, y + 1), 6 * k, 612, 4)
  samambaia(L, P, ...em(-14, y + 2), 8 * k, 613, 6)
}

/** A cabeça DE PÉ (a da 3/4): de frente, de costas ou de perfil (`olha` = -1 para a esquerda, 1 para a direita). */
function dePe(d: Desenho, cena: Cena, rosto: 'frente' | 'costas' | 'perfil', olha: number): void {
  const { k, P, L, pedra, liso } = d
  const cx = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => caixa(x0 * k, y0 * k, x1 * k, y1 * k, raio * k)
  const el = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * k, y * k, rx * k, ry * k)
  const fio = (pontos: readonly Ponto[], r: number): Forma => cadeia(pontos.map(([x, y]): Ponto => [x * k, y * k]), r * k)
  const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(([x, y]): Ponto => [x * k, y * k]))
  const sulco = (forma: Forma, semente: number, alfa = 0.94): void => {
    L.push(P(forma, SULCO, { bisel: 0, contorno: 0, alfa, semente }))
  }

  cena.sombras.push({ forma: el(0, 40, 40, 9), z: ALTURA_DE_PE * k }, contato(el(0, 45, 45, 8), 0.32))

  // ---------- a CABEÇA: o crânio redondo e a mandíbula mais estreita ----------
  const cranio = cx(-44, -50, 44, 22, 30)
  L.push(P(uniao(cranio, cx(-40, -8, 40, 46, 17)), pedra, { ...liso, bisel: 15 * k, tom: 0.9, contorno: 0.3, semente: 5800 }))

  if (rosto === 'frente') {
    // As bochechas e o queixo: volumes mansos, por cima da pedra.
    for (const lado of [-1, 1]) L.push(P(el(lado * 25, 17, 11.5, 9.5), pedra, { ...liso, bisel: 6 * k, tom: 0.98, contorno: 0, alfa: 0.55, suave: 2.6 * k, semente: 5810 + lado }))
    L.push(P(el(0, 41, 13, 5), pedra, { ...liso, bisel: 3.4 * k, tom: 1, contorno: 0, alfa: 0.6, suave: 2 * k, semente: 5812 }))
    // Os OLHOS fechados: a órbita funda, a pálpebra cheia, a fenda escura e os dois riscos gravados.
    for (const lado of [-1, 1]) {
      const ox = lado * 17.5
      L.push(P(el(ox, 2, 12, 7.6), pedra, { ...liso, bisel: 0, tom: 0.72, contorno: 0.06, recesso: { k: 3 * k, forca: 0.56 }, semente: 5820 + lado }))
      L.push(P(el(ox, 3.8, 10.6, 5.6), pedra, { ...liso, bisel: 4.2 * k, tom: 1, contorno: 0.2, semente: 5822 + lado }))
      sulco(fio([[ox - 9, 4.4], [ox - 3, 6.6], [ox + 3, 6.6], [ox + 9, 4.4]], 0.95), 5824 + lado)
      for (const dx of [-2.6, 2.6]) sulco(fio([[ox + dx, 10.5], [ox + dx + lado * 0.6, 20]], 0.85), 5826 + lado + dx, 0.62)
    }
    // O NARIZ largo, com o vinco dos dois lados dele e as narinas.
    for (const lado of [-1, 1]) sulco(fio([[lado * 6.4, -4], [lado * 11.4, 16], [lado * 9.6, 20.4]], 0.8), 5828 + lado, 0.66)
    L.push(P(pol([[-4.2, -9], [4.2, -9], [10, 16.5], [5, 20.6], [-5, 20.6], [-10, 16.5]]), pedra, { ...liso, bisel: 5 * k, tom: 1.05, contorno: 0.26, semente: 5830, projeta: { dist: 3.6 * k, forca: 0.5 } }))
    for (const lado of [-1, 1]) sulco(el(lado * 5.4, 18.2, 2.5, 1.7), 5832 + lado, 0.86)
    // A BOCA grossa, de cantos caídos, com o vinco fundo entre os lábios.
    L.push(P(el(0, 27.4, 16.5, 3.9), pedra, { ...liso, bisel: 3 * k, tom: 0.96, contorno: 0.26, semente: 5840 }))
    L.push(P(el(0, 33.2, 13.6, 4.5), pedra, { ...liso, bisel: 3.8 * k, tom: 1.04, contorno: 0.26, semente: 5841, projeta: { dist: 2.4 * k, forca: 0.42 } }))
    sulco(fio([[-18, 31.8], [-13, 29.9], [-6, 30.6], [0, 30.2], [6, 30.6], [13, 29.9], [18, 31.8]], 1.05), 5842)
    // A SOBRANCELHA pesada: faz a sombra funda em cima dos olhos.
    L.push(P(uniao(el(-17, -9.4, 16, 5.2), el(17, -9.4, 16, 5.2)), pedra, { ...liso, bisel: 4.4 * k, tom: 1.02, contorno: 0.26, semente: 5850, projeta: { dist: 4.2 * k, forca: 0.52 } }))
    // As RODELAS das orelhas.
    for (const lado of [-1, 1]) {
      L.push(P(el(lado * 44.5, 2, 8, 9.6), pedra, { ...liso, bisel: 4 * k, tom: 0.98, contorno: 0.3, semente: 5860 + lado, projeta: { dist: 2.4 * k, forca: 0.34 } }))
      L.push(P(el(lado * 44.5, 2, 4, 4.9), pedra, { ...liso, bisel: 0, tom: 0.6, contorno: 0.16, recesso: { k: 1.4 * k, forca: 0.4 }, semente: 5862 + lado }))
    }
  } else if (rosto === 'perfil') {
    // De lado: a rodela da orelha no meio, a sobrancelha, a pálpebra, o nariz saindo do contorno e os lábios.
    const o = olha
    L.push(P(el(o * 20, 17, 12, 9.5), pedra, { ...liso, bisel: 6 * k, tom: 0.98, contorno: 0, alfa: 0.55, suave: 2.6 * k, semente: 5810 }))
    L.push(P(el(o * 30, 2, 10, 7.4), pedra, { ...liso, bisel: 0, tom: 0.72, contorno: 0.06, recesso: { k: 3 * k, forca: 0.56 }, semente: 5820 }))
    L.push(P(el(o * 31, 3.8, 8.6, 5.4), pedra, { ...liso, bisel: 4 * k, tom: 1, contorno: 0.2, semente: 5822 }))
    sulco(fio([[o * 24, 4.6], [o * 30, 6.6], [o * 38, 5]], 0.95), 5824)
    L.push(P(pol([[o * 36, -9], [o * 43, -8], [o * 53, 15], [o * 49, 20.6], [o * 37, 20.6]]), pedra, { ...liso, bisel: 4 * k, tom: 1.05, contorno: 0.28, semente: 5830, projeta: { dist: 3 * k, forca: 0.44 } }))
    sulco(el(o * 46, 18.4, 2.2, 1.6), 5832, 0.86)
    L.push(P(el(o * 36, 27.4, 9.5, 3.9), pedra, { ...liso, bisel: 3 * k, tom: 0.96, contorno: 0.26, semente: 5840 }))
    L.push(P(el(o * 35, 33.2, 8.4, 4.5), pedra, { ...liso, bisel: 3.6 * k, tom: 1.04, contorno: 0.26, semente: 5841, projeta: { dist: 2.2 * k, forca: 0.4 } }))
    sulco(fio([[o * 24, 31.6], [o * 32, 30.2], [o * 43, 30.4]], 1), 5842)
    L.push(P(el(o * 30, -9.4, 15, 5.2), pedra, { ...liso, bisel: 4.4 * k, tom: 1.02, contorno: 0.26, semente: 5850, projeta: { dist: 4 * k, forca: 0.5 } }))
    L.push(P(el(o * -6, 3, 10, 11.6), pedra, { ...liso, bisel: 4.4 * k, tom: 1, contorno: 0.3, semente: 5860, projeta: { dist: 2.6 * k, forca: 0.36 } }))
    L.push(P(el(o * -6, 3, 5, 6), pedra, { ...liso, bisel: 0, tom: 0.6, contorno: 0.16, recesso: { k: 1.6 * k, forca: 0.4 }, semente: 5862 }))
  } else {
    // De costas: a nuca lisa, com duas rachaduras e o escorrido.
    sulco(fio([[-12, -12], [-9, 2], [-14, 16], [-10, 30]], 0.6), 5830, 0.6)
    sulco(fio([[20, -10], [24, 6], [19, 22]], 0.5), 5831, 0.5)
  }

  // ---------- o ELMO: a calota (com a lasca que falta), a crista do alto e a faixa de três botões ----------
  const noElmo = cx(-46, -52, 46, 6, 31)
  const calota = menos(dentroDe(noElmo, cx(-48, -54, 48, -17)), el(36, -47, 9, 7))
  L.push(P(calota, pedra, { ...liso, bisel: 13 * k, tom: 1, contorno: 0.28, semente: 5870, projeta: { dist: 2.6 * k, forca: 0.36 } }))
  if (rosto !== 'perfil') L.push(P(dentroDe(cx(-5.5, -53, 5.5, -22, 3), noElmo), pedra, { ...liso, bisel: 2.8 * k, tom: 1.1, contorno: 0.24, semente: 5871, projeta: { dist: 2 * k, forca: 0.3 } }))
  L.push(P(cx(-47, -25, 47, -13.5, 4), pedra, { ...liso, bisel: 3.2 * k, tom: 1.06, contorno: 0.28, semente: 5872, projeta: { dist: 3.4 * k, forca: 0.46 } }))
  const botoes = rosto === 'frente' ? [-25, 0, 25] : rosto === 'perfil' ? [olha * 34] : []
  for (const bx of botoes) {
    const grande = bx === 0
    const lado = grande ? 6 : 4.6
    L.push(P(cx(bx - lado, -19.2 - lado * 0.82, bx + lado, -19.2 + lado * 0.82, 1.4), pedra, { ...liso, bisel: 2 * k, tom: 1.16, contorno: 0.26, semente: 5874 + bx, projeta: { dist: 1.4 * k, forca: 0.3 } }))
  }

  // ---------- o TEMPO: a trinca, o musgo grosso no alto e escorrendo pelas rugas, os cipós ----------
  sulco(fio([[15, -50], [12, -38], [17, -28], [13, -14], [21, -5], [25, 7], [21, 19]], 0.6), 5880, 0.7)
  sulco(fio([[17, -28], [24, -24], [28, -17]], 0.45), 5881, 0.55)
  const mancha = (x: number, y: number, rx: number, ry: number, semente: number): Forma => manchaIrregular(x * k, y * k, rx * k, ry * k, 0, semente, 0.55)
  // A capa do alto: grossa do lado da luz, afinando para a direita.
  for (const [x, y, rx, ry, semente] of [[-24, -45, 23, 9.5, 1], [-38, -33, 10, 12, 2], [-4, -49, 15, 5.6, 3], [16, -47, 8, 4, 4]] as const) musgo(d, mancha, x, y, rx, ry, semente, noElmo)
  // O que escorre: pela têmpora, pelo canto dos olhos e pela ruga do nariz.
  const escorridos: readonly (readonly [number, number, number, number])[] = rosto === 'frente' ? [[-41, -8, 4, 13], [-30, 12, 2.6, 8], [29, 11, 2.2, 7], [-9, 22, 2, 5.4], [39, 20, 3, 7]] : [[-41, -8, 4, 13], [38, 4, 3, 10], [-20, 24, 3, 9], [8, -6, 2.6, 8]]
  escorridos.forEach(([x, y, rx, ry], i) => musgo(d, mancha, x, y, rx, ry, 20 + i))
  musgo(d, mancha, -30, -19, 6, 2.8, 30)
  cipo(L, P, -38 * k, -14 * k, 0.1, 1, 25 * k, 600)
  cipo(L, P, 37 * k, -14 * k, -0.06, 1, 15 * k, 601)

  pe(d, (x, y) => [x * k, y * k], 47.5)
}

/**
 * A cabeça DE CIMA: o alto do elmo domina e o rosto é a faixa em escorço na borda para onde ela olha (o lado de baixo
 * do objeto: o giro o leva para onde o mestre virar). Montada NA TELA pela vista: a luz e a sombra não giram.
 */
function deCima(d: Desenho, v: VistaDoTemplo, cena: Cena): void {
  const { k, P, L, pedra, liso } = d
  const em = (x: number, y: number): Ponto => pontoNaTela(v, x * k, y * k)
  const cx = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => {
    const b = caixaNaTela(v, x0 * k, y0 * k, x1 * k, y1 * k)
    return caixa(b[0], b[1], b[2], b[3], raio * k)
  }
  const deLado = v.q % 2 === 1
  const el = (x: number, y: number, rx: number, ry: number): Forma => elipse(...em(x, y), (deLado ? ry : rx) * k, (deLado ? rx : ry) * k)
  const fio = (pontos: readonly Ponto[], r: number): Forma => cadeia(pontos.map(([x, y]) => em(x, y)), r * k)
  const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(([x, y]) => em(x, y)))
  const sulco = (forma: Forma, semente: number, alfa = 0.9): void => {
    L.push(P(forma, SULCO, { bisel: 0, contorno: 0, alfa, semente }))
  }

  // A planta da cabeça (o que ela cobre do chão) e a sombra pousada: sai do lado oposto à luz.
  const planta = uniao(cx(-43, -46, 43, 24, 28), cx(-37, 0, 37, 44, 15))
  cena.sombras.push({ forma: planta, z: ALTURA_DE_CIMA * k, forca: 0.36 }, contato(planta, 0.34))

  // O pé por trás (o musgo e as plantas saem de debaixo da nuca).
  pe(d, em, -46)

  // ---------- o ROSTO em escorço: a faixa da frente, mais baixa que o elmo ----------
  L.push(P(cx(-37, 0, 37, 44, 15), pedra, { ...liso, bisel: 9 * k, tom: 0.86, contorno: 0.3, semente: 5800 }))
  for (const lado of [-1, 1]) L.push(P(el(lado * 23, 34, 9.5, 6), pedra, { ...liso, bisel: 4 * k, tom: 0.97, contorno: 0, alfa: 0.6, suave: 2.2 * k, semente: 5810 + lado }))
  // O lábio saindo para a frente e o vinco da boca.
  L.push(P(el(0, 40.4, 13.5, 3.2), pedra, { ...liso, bisel: 2.4 * k, tom: 1.02, contorno: 0.24, semente: 5840, projeta: { dist: 1.6 * k, forca: 0.34 } }))
  sulco(fio([[-13, 43.2], [-6, 44], [6, 44], [13, 43.2]], 0.8), 5842)
  // As pálpebras fechadas, debaixo da sobrancelha, com a fenda e os dois riscos gravados.
  for (const lado of [-1, 1]) {
    const ox = lado * 18
    L.push(P(el(ox, 29.6, 9.6, 3.8), pedra, { ...liso, bisel: 2.6 * k, tom: 1, contorno: 0.2, semente: 5822 + lado }))
    sulco(fio([[ox - 8.4, 30.6], [ox - 3, 32], [ox + 3, 32], [ox + 8.4, 30.6]], 0.8), 5824 + lado)
    for (const dx of [-2.6, 2.6]) sulco(fio([[ox + dx, 34.4], [ox + dx + lado * 0.5, 39.4]], 0.7), 5826 + lado + dx, 0.6)
  }
  // O NARIZ: a cunha que sai debaixo da testa e passa da boca.
  for (const lado of [-1, 1]) sulco(fio([[lado * 5.6, 26], [lado * 9.8, 38]], 0.7), 5828 + lado, 0.6)
  L.push(P(pol([[-4, 22], [4, 22], [8.6, 37.5], [5, 42.6], [-5, 42.6], [-8.6, 37.5]]), pedra, { ...liso, bisel: 3.6 * k, tom: 1.06, contorno: 0.26, semente: 5830, projeta: { dist: 2.6 * k, forca: 0.44 } }))
  // A SOBRANCELHA pesada: a prateleira que sombreia os olhos.
  L.push(P(uniao(el(-17.5, 24, 16, 4.4), el(17.5, 24, 16, 4.4)), pedra, { ...liso, bisel: 3.4 * k, tom: 1.03, contorno: 0.26, semente: 5850, projeta: { dist: 3 * k, forca: 0.5 } }))
  // As RODELAS das orelhas, de topo.
  for (const lado of [-1, 1]) {
    L.push(P(el(lado * 43.5, 6, 5.6, 9), pedra, { ...liso, bisel: 3 * k, tom: 0.96, contorno: 0.3, semente: 5860 + lado, projeta: { dist: 2 * k, forca: 0.32 } }))
    sulco(el(lado * 45, 6, 2, 4.6), 5862 + lado, 0.5)
  }

  // ---------- o ELMO: o alto redondo que domina, a faixa de três botões na testa e a crista ----------
  const noElmo = cx(-44, -48, 44, 14, 30)
  const calota = menos(noElmo, el(33, -40, 9, 7))
  L.push(P(calota, pedra, { ...liso, bisel: 18 * k, tom: 1.02, contorno: 0.28, semente: 5870, projeta: { dist: 3.4 * k, forca: 0.42 } }))
  L.push(P(cx(-45, 7, 45, 18.6, 4.4), pedra, { ...liso, bisel: 3.2 * k, tom: 1.07, contorno: 0.28, semente: 5872, projeta: { dist: 3.2 * k, forca: 0.46 } }))
  for (const bx of [-25, 0, 25]) {
    const lado = bx === 0 ? 5 : 4
    L.push(P(cx(bx - lado, 12.8 - lado * 0.8, bx + lado, 12.8 + lado * 0.8, 1.4), pedra, { ...liso, bisel: 1.8 * k, tom: 1.17, contorno: 0.26, semente: 5874 + bx, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  }
  L.push(P(dentroDe(cx(-5.5, -50, 5.5, 7, 3), noElmo), pedra, { ...liso, bisel: 3 * k, tom: 1.1, contorno: 0.24, semente: 5871, projeta: { dist: 2.2 * k, forca: 0.32 } }))
  // A trinca, do alto até a faixa.
  sulco(fio([[15, -44], [12, -32], [18, -20], [14, -8], [21, 2]], 0.6), 5880, 0.68)
  sulco(fio([[18, -20], [26, -16], [30, -8]], 0.45), 5881, 0.52)

  // ---------- a CAPA DE MUSGO do alto do elmo: grossa do lado da luz, escorrendo para a faixa e as orelhas ----------
  const mancha = (x: number, y: number, rx: number, ry: number, semente: number): Forma => manchaIrregular(...em(x, y), (deLado ? ry : rx) * k, (deLado ? rx : ry) * k, 0, semente, 0.55)
  for (const [x, y, rx, ry, semente] of [[-17, -27, 24, 17, 1], [-33, -6, 9, 14, 2], [3, -41, 17, 7, 3], [-6, -6, 10, 8, 4], [27, -24, 7, 9, 5]] as const) musgo(d, mancha, x, y, rx, ry, semente, noElmo)
  for (const [x, y, rx, ry, semente] of [[-40, 14, 4, 6, 6], [-13, 12, 3, 5, 7], [35, 2, 4, 7, 8], [-27, 27, 2.4, 4, 9], [28, 30, 2, 3.6, 10]] as const) musgo(d, mancha, x, y, rx, ry, 20 + semente)
  const [c1x, c1y] = em(-40, -6)
  const [d1x, d1y] = pontoNaTela(v, -1, 0.5)
  cipo(L, P, c1x, c1y, d1x, d1y, 14 * k, 600)
  const [c2x, c2y] = em(38, -30)
  const [d2x, d2y] = pontoNaTela(v, 1, -0.3)
  cipo(L, P, c2x, c2y, d2x, d2y, 11 * k, 601)
}

export const montarCabecaColossal: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIA_PEGADA
  if (!(k > 0)) return
  const v = vistaDoTemplo(c)
  const pedra = basalto(c.m.pedra)
  const tela: Cena = { partes: [], sombras: [], corDoPiso: ESCURO_DA_PEDRA_DO_TEMPLO }

  // A pedra com o escorrido da chuva: em faixas de pé na cabeça de pé, em manchas no alto visto de cima.
  const dePeNaTela = v.sobe > 0
  const texDaCabeca: Textura = (u, w, x, y, p, s, escala) => {
    DA_PEDRA(u, w, x, y, p, s, escala)
    const faixa = dePeNaTela ? ruido((x / k) * 0.5 + 41, (y / k) * 0.045 + 9) : ruido((x / k) * 0.16 + 41, (y / k) * 0.16 + 9)
    if (faixa > 0.08) s[3] -= (faixa - 0.08) * 0.34
  }
  const d: Desenho = { k, P, L: tela.partes, pedra, liso: { textura: texDaCabeca } }

  if (dePeNaTela) dePe(d, tela, v.q === 0 ? 'frente' : v.q === 2 ? 'costas' : 'perfil', v.q === 1 ? -1 : 1)
  else deCima(d, v, tela)
  // A cabeça de pé é montada como aparece; a de cima, pela vista. As duas voltam ao objeto pelo mesmo caminho.
  entregarNaTela(v, tela, cena)
}

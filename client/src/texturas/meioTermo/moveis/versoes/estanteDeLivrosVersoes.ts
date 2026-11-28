/**
 * As VERSÕES da estante de livros (lote L02 do plano de arte por tema, 28/11/2026): a 1ª, Cheia, é o desenho de
 * `MONTADORES`; a 2ª, REVIRADA, é a biblioteca saqueada (vãos meio vazios, livros tombados e deitados de qualquer
 * jeito, um livro aberto e folhas soltas em cima do tampo); a 3ª, VAZIA COM TEIAS, é a estante abandonada (as
 * prateleiras sem nada, teia nos cantos dos vãos, bolos de pó e um ou outro livro esquecido).
 *
 * O MÓVEL é o do tipo base, peça por peça: a versão monta a estante de hoje e tira dela tudo o que não é a madeira (as
 * lombadas, os filetes e o livro do tampo). As prateleiras são lidas das próprias peças que ficam: o FUNDO de cada uma é
 * a única peça com recesso, e a caixa dele guarda o alto do vão e a fresta (`naFresta` de `../estanteDeLivros.ts`); o
 * TAMPO é a única peça com tábuas de 7. Assim a versão segue a estante em qualquer tamanho e na 3/4, sem repetir a
 * conta das prateleiras: o que vai numa prateleira de baixo entra ANTES do tampo (guardado debaixo dele na vista de
 * cima, no lugar na 3/4), o que vai na de cima entra no fim (é a faixa que se vê de cima, na frente do tampo).
 *
 * Os livros têm as capas, as folhas e os filetes do tipo base (os mesmos tons). Material: `madeira`, como o tipo.
 */
import type { VersoesDesenhadas } from '.'
import { hash } from '../../../ruido'
import { cadeia, capsula, caixa, elipse, poligono, type Forma, type Ponto } from '../formas'
import type { Cena, CriarPeca, MaterialDaPeca, OpcoesDaPeca, Peca, Projecao } from '../motor'
import { materialDaPeca, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { montarEstanteDeLivros } from '../estanteDeLivros'

/** As medidas do tipo base (`../estanteDeLivros.ts`): a tábua da prateleira (casas), a fresta, a divisória e o vão. */
const TABUA = 0.06
const FRESTA = 0.25
const DIVISORIA = 2.2
const LARGURA_DO_VAO = 1
/** O tampo é a única peça de madeira com tábuas de 7 px. */
const TABUAS_DO_TAMPO = 7

const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x5e, 0x42] }
const PETROLEO: MaterialDaPeca = { classe: 'liso', rgb: [0x4e, 0x6a, 0x6c] }
const PERGAMINHO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xb1, 0x8e] }
const CAPAS: readonly MaterialDaPeca[] = [materialDaPeca('vinho'), materialDaPeca('azul'), materialDaPeca('musgo'), materialDaPeca('ocre'), PERGAMINHO, COURO, PETROLEO]
const FOLHAS: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xca, 0xae] }
const FILETE: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xbd, 0x84] }
const FILETE_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6b, 0x4a, 0x34] }
/** A teia (a de `../nichoFunerario.ts`) e o pó (o de `../ossos.ts`). */
const TEIA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd2, 0xc8] }
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x9a, 0x82] }
const SOMBRA_DO_LIVRO: Projecao = { dist: 0.7, forca: 0.24, suave: 0.5 }
const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }
const CAPA_GASTA = 0.8
const CAPA_NOVA = 1.02

/** Uma prateleira lida do fundo dela: o alto do vão, o meio da fresta, onde os livros apoiam e de onde até onde vai. */
interface Prateleira {
  readonly topo: number
  readonly meio: number
  readonly chao: number
  readonly x0: number
  readonly x1: number
  readonly deCima: boolean
  readonly linha: number
}

/** Um vão de uma prateleira, com a função que guarda a forma na fresta dela. */
interface Vao {
  readonly x0: number
  readonly x1: number
  readonly topo: number
  readonly chao: number
  readonly guardar: (f: Forma) => Forma
  readonly semente: number
  readonly deCima: boolean
  /** O 1º vão da prateleira, o último ou um do meio. */
  readonly ponta: 'primeiro' | 'ultimo' | 'meio'
}

function capaDe(sorteio: number): MaterialDaPeca {
  return CAPAS[Math.min(CAPAS.length - 1, Math.floor(sorteio * CAPAS.length))]
}

function fileteDe(capa: MaterialDaPeca): MaterialDaPeca {
  return capa.rgb[0] + capa.rgb[1] + capa.rgb[2] > 480 ? FILETE_ESCURO : FILETE
}

/** As prateleiras, de baixo para cima, lidas dos fundos (a de cima é a da fresta mais funda: o menor meio). */
function lerPrateleiras(c: ContextoDoMovel, madeira: readonly Peca[]): Prateleira[] {
  const fundos = madeira.filter((p) => p.recesso !== undefined)
  const menorMeio = Math.min(...fundos.map((p) => (p.forma.b[1] + p.forma.b[3]) / 2))
  return fundos
    .map((p) => {
      const meio = (p.forma.b[1] + p.forma.b[3]) / 2
      return { topo: p.forma.b[1], meio, chao: meio - FRESTA / 2 - c.g * TABUA, x0: p.forma.b[0] + 0.4, x1: p.forma.b[2] - 0.4, deCima: meio === menorMeio, linha: 0 }
    })
    .sort((a, b) => b.meio - a.meio)
    .map((p, linha) => ({ ...p, linha }))
}

function vaosDe(c: ContextoDoMovel, pr: Prateleira, semente: number): Vao[] {
  const quantos = Math.max(1, Math.round(c.w / (c.g * LARGURA_DO_VAO)))
  const largura = (pr.x1 - pr.x0 - (quantos - 1) * DIVISORIA) / quantos
  const guardar = (f: Forma): Forma => ({ b: [f.b[0], pr.topo, f.b[2], 2 * pr.meio - pr.topo], d: f.d })
  return Array.from({ length: quantos }, (_, i) => ({
    x0: pr.x0 + i * (largura + DIVISORIA),
    x1: pr.x0 + i * (largura + DIVISORIA) + largura,
    topo: pr.topo,
    chao: pr.chao,
    guardar,
    semente: semente + pr.linha * 37 + i * 7,
    deCima: pr.deCima,
    ponta: i === 0 ? 'primeiro' : i === quantos - 1 ? 'ultimo' : 'meio',
  }))
}

/** O retângulo de meias medidas (mx, my) girado `ang` em volta de (cx, cy). */
function girado(cx: number, cy: number, mx: number, my: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

// ---------- os livros de frente, dentro do vão ----------

/** As peças de um vão: o livro (capa, filete) com a sombra curta no vizinho, guardado na fresta. */
function livros(P: CriarPeca, v: Vao, saida: Peca[]): {
  emPe: (x: number, larg: number, alt: number, i: number) => number
  tombado: (xPe: number, larg: number, alt: number, ang: number, i: number) => void
  deitado: (x: number, comp: number, grossura: number, base: number, i: number) => number
} {
  const sorte = (i: number, k: number): number => hash(i, k, v.semente)
  const capa = (forma: Forma, material: MaterialDaPeca, grossura: number, i: number): void => {
    saida.push(P(v.guardar(forma), material, { bisel: Math.min(1, grossura * 0.3), contorno: 0.24, tom: CAPA_GASTA + (CAPA_NOVA - CAPA_GASTA) * sorte(i, 4), semente: 700 + i, projeta: SOMBRA_DO_LIVRO }))
  }
  return {
    emPe(x, larg, alt, i) {
      const material = capaDe(sorte(i, 3))
      capa(caixa(x, v.chao - alt, x + larg, v.chao, 0.45), material, larg, i)
      if (larg >= 2.9) {
        for (const f of [0.2, 0.8]) {
          const y = v.chao - alt * f
          saida.push(P(v.guardar(caixa(x + 0.4, y - 0.35, x + larg - 0.4, y + 0.35)), fileteDe(material), SEM_BORDA))
        }
      }
      return x + larg
    },
    /**
     * Tombado, apoiado no canto de baixo em `xPe` e inclinado `ang` radianos: positivo deita para a ESQUERDA (o canto
     * de baixo da esquerda no chão, a conta do tombado do tipo base), negativo para a DIREITA (o espelho).
     */
    tombado(xPe, larg, alt, ang, i) {
      const material = capaDe(sorte(i, 3))
      const s = ang >= 0 ? 1 : -1
      const co = Math.cos(Math.abs(ang))
      const si = Math.sin(Math.abs(ang))
      const p1: Ponto = [xPe + s * larg * co, v.chao - larg * si]
      const cantos: Ponto[] = [[xPe, v.chao], p1, [p1[0] - s * alt * si, p1[1] - alt * co], [xPe - s * alt * si, v.chao - alt * co]]
      capa(poligono(cantos), material, larg, i)
    },
    deitado(x, comp, grossura, base, i) {
      const material = capaDe(sorte(i, 3))
      capa(caixa(x, base - grossura, x + comp, base, 0.45), material, grossura, i)
      for (const f of [0.16, 0.84]) {
        const xf = x + comp * f
        saida.push(P(v.guardar(caixa(xf - 0.35, base - grossura + 0.4, xf + 0.35, base - 0.4)), fileteDe(material), SEM_BORDA))
      }
      return base - grossura
    },
  }
}

/**
 * O vão REVIRADO: ainda tem livro, mas nada no lugar. Três arrumações, sorteadas por vão (a prateleira que se vê de
 * cima tem as três, fixas): o DOMINÓ (quatro ou cinco tombados para a direita, um apoiado no outro, até os que ficaram
 * em pé, e a pilha jogada no resto), a PILHA (os deitados de qualquer jeito, um grupo em pé e um tombado nele) e o
 * RESTO EM PÉ (o vão meio vazio, um deitado sozinho e o dominó curto contra os que sobraram junto da divisória).
 */
function vaoRevirado(P: CriarPeca, v: Vao, saida: Peca[]): void {
  const sorte = (i: number, k: number): number => hash(i, k, v.semente + 900)
  const alto = v.chao - v.topo
  const l = livros(P, v, saida)
  const largura = v.x1 - v.x0
  const lombada = (i: number): number => 2.3 + 2.1 * sorte(i, 1)
  const altura = (i: number): number => alto * (0.62 + 0.3 * sorte(i, 2))
  const cabe = (x: number): boolean => x <= v.x1 - 0.3

  /** A fileira em pé a partir de `x`: `n` livros encostados; devolve a beira direita e a altura do último. */
  const emPe = (x: number, n: number, i0: number): [number, number] => {
    let alt = 0
    for (let i = 0; i < n; i += 1) {
      const larg = lombada(i0 + i)
      if (!cabe(x + larg)) break
      alt = altura(i0 + i)
      x = l.emPe(x, larg, alt, i0 + i) + 0.2
    }
    return [x, alt]
  }

  /** O dominó: `n` tombados para a direita, cada um apoiado no seguinte, terminando nos `m` que ficaram em pé. */
  const domino = (x: number, n: number, m: number, i0: number): number => {
    const a = 0.32 + 0.14 * sorte(i0, 4)
    const co = Math.cos(a)
    let pe = x + lombada(i0) * co
    let altDoUltimo = 0
    for (let i = 0; i < n; i += 1) {
      const larg = lombada(i0 + i)
      if (i > 0) pe += larg / co
      altDoUltimo = alto * (0.74 + 0.2 * sorte(i0 + i, 2))
      if (!cabe(pe + altDoUltimo * Math.sin(a) + 2.5)) break
      l.tombado(pe, larg, altDoUltimo, -a, i0 + i)
    }
    // O primeiro em pé recebe o tombado na quina de cima: a quina cai na face de baixo do último tombado.
    const alturaDoPrimeiro = Math.min(altDoUltimo * co * 0.86, alto * 0.86)
    const xEmPe = pe + alturaDoPrimeiro * Math.tan(a)
    let xFim = xEmPe
    if (cabe(xEmPe + 2.5)) {
      xFim = l.emPe(xEmPe, lombada(i0 + 20), alturaDoPrimeiro, i0 + 20) + 0.2
      xFim = emPe(xFim, m - 1, i0 + 21)[0]
    }
    return xFim
  }

  /** A pilha deitada de qualquer jeito a partir de `x` (até `ate`): cada um mais curto e desencontrado do de baixo. */
  const pilha = (x: number, ate: number, n: number, i0: number): void => {
    let base = v.chao
    for (let j = 0; j < n; j += 1) {
      const grossura = 2.2 + 0.9 * sorte(i0 + j, 8)
      const comp = Math.min(ate - x, 9.8) - 1.6 * sorte(i0 + j, 9)
      if (base - grossura < v.topo + 1 || comp < 4) break
      const desvio = (j % 2 === 0 ? 1 : -1) * 1.2 * sorte(i0 + j, 10)
      base = l.deitado(Math.max(x, x + desvio + (j === 0 ? 0 : 0.6)), comp, grossura, base, i0 + j)
    }
  }

  const tipo = v.deCima ? (v.ponta === 'primeiro' ? 0 : v.ponta === 'ultimo' ? 1 : 2) : Math.floor(sorte(0, 3) * 3)
  if (tipo === 0) {
    const x = domino(v.x0 + 0.3, 4 + Math.floor(sorte(1, 5) * 2), 2, 0)
    if (v.x1 - x > 7) pilha(x + 0.6, v.x1 - 0.4, 3, 40)
  } else if (tipo === 1) {
    pilha(v.x0 + 0.4, v.x0 + largura * 0.5, 4, 50)
    const [x, alt] = emPe(v.x0 + largura * 0.52, 3, 60)
    // O tombado para a esquerda, com a face de cima apoiada na quina do último em pé.
    const a = 0.5 + 0.2 * sorte(70, 4)
    const pe = x + 0.3 + alt * Math.tan(a)
    if (cabe(pe + lombada(70) * Math.cos(a))) l.tombado(pe, lombada(70), alto * 0.86, a, 70)
  } else {
    l.deitado(v.x0 + 0.6, Math.min(largura * 0.3, 8.6), 2.6, v.chao, 80)
    domino(v.x0 + largura * 0.42, 2 + Math.floor(sorte(81, 5) * 2), 3, 82)
  }
}

// ---------- a teia e o pó ----------

/** A teia no canto de cima do vão (`lado` 1 = o canto da esquerda, -1 = o da direita): os raios e os fios em arco. */
function teiaNoCanto(P: CriarPeca, v: Vao, lado: 1 | -1, saida: Peca[], semente: number): void {
  const sorte = (i: number): number => hash(i, semente, 977)
  const xc = lado === 1 ? v.x0 : v.x1
  const raio = Math.min((v.chao - v.topo) * 0.8, (v.x1 - v.x0) * 0.42) * (0.8 + 0.3 * sorte(0))
  const raios = 5
  const angulos = Array.from({ length: raios }, (_, j) => (j / (raios - 1)) * (Math.PI / 2) + (sorte(j + 1) - 0.5) * 0.12)
  const ponta = (a: number, r: number): Ponto => [xc + lado * Math.cos(a) * r, v.topo + Math.sin(a) * r]
  const fio = (f: Forma, alfa: number, i: number): void => {
    saida.push(P(v.guardar(f), TEIA, { bisel: 0, contorno: 0, alfa, semente: semente + i }))
  }
  angulos.forEach((a, j) => {
    const [x, y] = ponta(a, raio * (0.88 + 0.18 * sorte(j + 9)))
    fio(capsula(xc, v.topo, x, y, 0.16), 0.62, j)
  })
  // Os fios em arco: cada trecho entre dois raios cai um pouco para dentro (o fio cede no meio).
  for (const [i, f] of [0.34, 0.6, 0.84].entries()) {
    const pontos: Ponto[] = []
    angulos.forEach((a, j) => {
      pontos.push(ponta(a, raio * f))
      const b = angulos[j + 1]
      if (b !== undefined) pontos.push(ponta((a + b) / 2, raio * f * 0.9))
    })
    // O último arco rompeu: falta o pedaço do fim, e a ponta solta pende.
    const ate = i === 2 ? pontos.length - 3 : pontos.length
    fio(cadeia(pontos.slice(0, ate), 0.13), 0.5, 20 + i)
  }
}

/** Os bolos de pó no chão do vão: dois ou três, macios e claros. */
function poNoVao(P: CriarPeca, v: Vao, saida: Peca[], semente: number): void {
  const sorte = (i: number): number => hash(i, semente, 983)
  const quantos = 2 + Math.floor(sorte(0) * 2)
  for (let i = 0; i < quantos; i += 1) {
    const x = v.x0 + (v.x1 - v.x0) * (0.12 + 0.76 * sorte(i + 1))
    const r = 0.9 + 0.8 * sorte(i + 5)
    saida.push(P(v.guardar(elipse(x, v.chao - r * 0.45, r * 1.6, r * 0.6)), PO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.6, tom: 1.08, semente: semente + i }))
  }
}

/** O vão ABANDONADO: teia num canto (às vezes nos dois), o pó no chão e, às vezes, um livro esquecido. */
function vaoComTeias(P: CriarPeca, v: Vao, saida: Peca[]): void {
  const sorte = (i: number): number => hash(i, 7, v.semente + 1300)
  const ladoDaTeia: 1 | -1 = sorte(1) < 0.5 ? 1 : -1
  poNoVao(P, v, saida, v.semente + 1310)
  const esquecido = v.deCima ? v.ponta === 'ultimo' : sorte(2) < 0.4
  if (esquecido) {
    const l = livros(P, v, saida)
    const comp = Math.min((v.x1 - v.x0) * 0.32, 8)
    if (sorte(3) < 0.5 || v.deCima) l.deitado(v.x1 - comp - 1.4, comp, 2.4, v.chao, 60)
    else l.tombado(v.x0 + 0.2 + (v.chao - v.topo) * 0.8 * Math.sin(1.15), 2.6, (v.chao - v.topo) * 0.8, 1.15, 61)
  }
  teiaNoCanto(P, v, ladoDaTeia, saida, v.semente + 1320)
  if (sorte(4) < (v.deCima ? 0.35 : 0.5)) teiaNoCanto(P, v, ladoDaTeia === 1 ? -1 : 1, saida, v.semente + 1340)
}

// ---------- em cima do tampo ----------

/** O livro aberto largado em cima do tampo, de folhas para cima, e as folhas soltas espalhadas. */
function tampoRevirado(c: ContextoDoMovel, saida: Peca[], cy: number, meiaFaixa: number): void {
  const P = c.peca
  const my = Math.min(2.6, meiaFaixa - 1.3)
  if (my < 1.4) return
  const mx = my * 1.4
  const cx = 0.16 * c.w
  const ang = -0.22
  const capa = CAPAS[0]
  // A capa aberta (um pouco maior que as duas folhas) e as duas folhas, com o vinco escuro no meio.
  saida.push(P(girado(cx, cy, mx * 2 + 0.5, my + 0.45, ang), capa, { bisel: 0.5, contorno: 0.26, tom: 0.86, semente: 780, projeta: { dist: 0.8, forca: 0.26 } }))
  for (const lado of [-1, 1]) {
    const [ox, oy] = [Math.cos(ang) * mx * lado * 1.02, Math.sin(ang) * mx * lado * 1.02]
    saida.push(P(girado(cx + ox, cy + oy, mx * 0.98, my, ang + lado * 0.03), FOLHAS, { bisel: 0.9, contorno: 0.18, tom: lado === 1 ? 1.02 : 0.96, semente: 781 + lado }))
  }
  saida.push(P(girado(cx, cy, 0.22, my * 0.96, ang), FILETE_ESCURO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 784 }))
  // As folhas soltas: arrancadas, cada uma girada para um lado, uma por cima da beira do livro.
  const soltas: readonly (readonly [number, number, number])[] = [
    [-0.3, -0.25, 0.5],
    [-0.12, 0.3, -0.35],
    [0.34, 0.1, 1.2],
  ]
  soltas.forEach(([fx, fy, a], i) => {
    const sx = fx * c.w
    const sy = cy + fy * meiaFaixa
    saida.push(P(girado(sx, sy, my * 0.62, my * 0.82, a), FOLHAS, { bisel: 0.3, contorno: 0.16, tom: 1 - 0.05 * i, semente: 790 + i, projeta: { dist: 0.45, forca: 0.2 } }))
  })
}

/**
 * O pó em cima do tampo abandonado: um véu ralo e falhado de ponta a ponta (bolos miúdos e desencontrados, cada um
 * de um tamanho), mais cheio nos cantos de trás, e a marca limpa de onde estava o livro que alguém levou.
 */
function tampoComPo(c: ContextoDoMovel, saida: Peca[], cy: number, meiaFaixa: number): void {
  const P = c.peca
  const quantos = Math.max(8, Math.round(c.w / 7))
  for (let i = 0; i < quantos; i += 1) {
    const fx = (i + 0.5) / quantos - 0.5 + (hash(i, 1, 811) - 0.5) * 0.06
    const nosCantos = Math.abs(fx) > 0.36 ? 1.3 : 1
    const r = Math.min(meiaFaixa * 0.55, 4.2) * (0.55 + 0.6 * hash(i, 2, 811)) * nosCantos
    const fy = (hash(i, 3, 811) - 0.6) * 0.9
    saida.push(P(elipse(fx * c.w, cy + fy * meiaFaixa, r * (1.4 + hash(i, 4, 811)), r * 0.8), PO, { bisel: 0, contorno: 0, alfa: 0.16 + 0.12 * hash(i, 5, 811), suave: r * 0.7, tom: 1.1, semente: 800 + i }))
  }
  // A marca do livro que saiu: o retângulo onde o pó não pegou, a madeira um pouco mais escura que o véu em volta.
  const my = Math.min(3.1, meiaFaixa - 1.4)
  if (my > 1.5) saida.push(P(girado(-0.27 * c.w, cy, 4.6, my, 0.2), c.m.madeira, { bisel: 0, contorno: 0, tom: 0.9, alfa: 0.5, suave: 0.5, semente: 830 }))
}

// ---------- a montagem ----------

type Versao = 'revirada' | 'vaziaComTeias'

function montarEstanteDaVersao(versao: Versao): MontarMovel {
  return (c, cena: Cena) => {
    const inicio = cena.partes.length
    montarEstanteDeLivros(c, cena)
    const madeira = cena.partes.slice(inicio).filter((p) => p.mat === c.m.madeira)
    const tampo = madeira.findIndex((p) => p.tabua === TABUAS_DO_TAMPO)
    const prateleiras = lerPrateleiras(c, madeira)
    if (tampo < 0 || prateleiras.length === 0) {
      cena.partes.splice(inicio, cena.partes.length - inicio, ...madeira)
      return
    }
    const deBaixo: Peca[] = []
    const deCima: Peca[] = []
    const noTampo: Peca[] = []
    const semente = versao === 'revirada' ? 5100 : 5300
    for (const pr of prateleiras) {
      for (const v of vaosDe(c, pr, semente)) {
        const saida = pr.deCima ? deCima : deBaixo
        if (versao === 'revirada') vaoRevirado(c.peca, v, saida)
        else vaoComTeias(c.peca, v, saida)
      }
    }
    const aDeCima = prateleiras.find((p) => p.deCima) ?? prateleiras[prateleiras.length - 1]
    // A faixa do tampo que aparece de cima vai da parede até o alto da prateleira de cima.
    const cy = (-c.hh + aDeCima.topo) / 2
    const meiaFaixa = (aDeCima.topo + c.hh) / 2
    if (versao === 'revirada') tampoRevirado(c, noTampo, cy, meiaFaixa)
    else tampoComPo(c, noTampo, cy, meiaFaixa)
    cena.partes.splice(inicio, cena.partes.length - inicio, ...madeira.slice(0, tampo), ...deBaixo, madeira[tampo], ...noTampo, ...madeira.slice(tampo + 1), ...deCima)
  }
}

export const montarEstanteRevirada: MontarMovel = montarEstanteDaVersao('revirada')
export const montarEstanteVaziaComTeias: MontarMovel = montarEstanteDaVersao('vaziaComTeias')

export const versoesDoEstanteDeLivros: VersoesDesenhadas = {
  revirada: montarEstanteRevirada,
  vaziaComTeias: montarEstanteVaziaComTeias,
}

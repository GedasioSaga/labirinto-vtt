import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { clamp01, easeInOutSine, easeInQuad, easeOutCubic, span } from '../../transicoes/curvas'
import { descartarCena, semente } from '../../transicoes/texturas'
import { arvoresDoFundo, type FundoDoCampo, montarPaisagem } from './_paisagemDoCampo'

/*
 * CAMPO ENSOLARADO (pacote de animações, transição de viagem).
 *
 * Primeira pessoa, como as telas de carregamento do Resident Evil clássico: o
 * personagem não aparece. Anda por uma estrada de terra entre cercas tortas e
 * capim dourado, na sombra manchada de uma árvore; sai da sombra, para, ergue
 * o olhar até o sol que espia na borda da copa, e o sol cresce (raios,
 * fantasmas de lente, brilho) até a tela ficar branca. O branco é um plano
 * dentro da cena; o preto do fim é o `fade` devolvido ao motor, que sempre
 * fecha em preto.
 *
 * Estilo de pintura de anime: tudo pintado em canvas na criação (o pacote não
 * aceita imagem), luz quente de sol baixo vindo de frente, sombras azuladas.
 *
 * Cena dividida por três animações (pedido de 27/10/2026): `campo-ensolarado`
 * (a aprovada, fundo 'nenhum', pixel a pixel igual à de 12/10),
 * `campo-ensolarado-tres-casas` e `campo-ensolarado-vila`. Câmera, sol, tempos
 * e som são os mesmos; só o fundo muda (`_paisagemDoCampo.ts`).
 */

// ---------------------------------------------------------------------------
// Roteiro (segundos da cena)
// ---------------------------------------------------------------------------

const DURACAO = 7
const FADE_ENTRADA = 0.5
const INICIO_DA_FREADA = 3.6
const PARADA = 4
const FIM_DO_OLHAR = 5.2
/** Reduzir movimento: o olhar sobe menos e mais devagar. */
const FIM_DO_OLHAR_REDUZIDO = 5.7
const AMPLITUDE_DO_OLHAR_REDUZIDO = 0.6
/** O sol começa a crescer um pouco antes de o olhar assentar: sem pausa morta entre os dois. */
const INICIO_DO_SOL = 5.05
const INICIO_DO_BRANCO = 5.55
const BRANCO_TOTAL = 6.3
const INICIO_DO_ESCURO = 6.5

// ---------------------------------------------------------------------------
// Corpo e passo
// ---------------------------------------------------------------------------

/** Passeio sem pressa: 2 passos por segundo, 72,5 cm por passo. */
const VELOCIDADE = 1.45
const CADENCIA = 2
const PASSADA = VELOCIDADE / CADENCIA
/** O último pé assenta no meio da freada: o corpo ainda escorrega um palmo e para. */
const ULTIMO_PASSO = 3.75
const OLHO = 1.62
/** Andando, o olhar cai um pouco na estrada à frente. */
const INCLINACAO_ANDANDO = -0.05
const BALANCO_VERTICAL = 0.016
const BALANCO_LATERAL = 0.011
const ROLAGEM = 0.0045

// ---------------------------------------------------------------------------
// Sol: à direita da estrada, 24° acima do horizonte, de frente para quem anda
// ---------------------------------------------------------------------------

const SOL_AZIMUTE = 0.21
const SOL_ELEVACAO = 0.42
/** No fim do olhar o sol fica um pouco acima e à direita do centro: os fantasmas cruzam a tela. */
const INCLINACAO_FINAL = SOL_ELEVACAO - 0.055
const GUINADA_FINAL = -(SOL_AZIMUTE - 0.07)
const DISTANCIA_DO_CEU = 340

function andadoEm(t: number): number {
  if (t <= INICIO_DA_FREADA) return VELOCIDADE * Math.max(0, t)
  const s = span(t, INICIO_DA_FREADA, PARADA)
  // Integral de 1 - smoothstep: a velocidade cai sem tranco no começo nem no fim da freada.
  return VELOCIDADE * (INICIO_DA_FREADA + (PARADA - INICIO_DA_FREADA) * (s - s ** 3 + s ** 4 / 2))
}

/** Velocidade relativa (1 andando, 0 parado). */
function ritmoEm(t: number): number {
  const s = span(t, INICIO_DA_FREADA, PARADA)
  return 1 - s * s * (3 - 2 * s)
}

/** Fase contínua do passo: cada inteiro é um pé assentando (presa à distância, os passos encurtam na freada). */
const FASE_INICIAL = Math.ceil(andadoEm(ULTIMO_PASSO) / PASSADA) - andadoEm(ULTIMO_PASSO) / PASSADA
function faseEm(t: number): number {
  return andadoEm(t) / PASSADA + FASE_INICIAL
}
const PASSOS = Math.floor(faseEm(PARADA))

function fadeEm(t: number): number {
  // Entra em ease-out (a cena aparece logo e assenta); sai em ease-in-out, do branco ao preto.
  return Math.max(1 - easeOutCubic(span(t, 0, FADE_ENTRADA)), easeInOutSine(span(t, INICIO_DO_ESCURO, DURACAO)))
}

function solEm(t: number): number {
  return easeInOutSine(span(t, INICIO_DO_SOL, BRANCO_TOTAL))
}

/** O branco acelera no fim: a luz toma a tela, não "acende". */
function brancoEm(t: number): number {
  return easeInQuad(span(t, INICIO_DO_BRANCO, BRANCO_TOTAL))
}

/** Rajadas de vento (0 a 1): o capim e o som do vento seguem a mesma curva. */
export function rajadaEm(t: number): number {
  return clamp01(0.5 + 0.28 * Math.sin(t * 0.83 + 0.6) + 0.22 * Math.sin(t * 2.07 + 2.1))
}

/** O roteiro, para os testes e para as provas (gráfico do movimento e onda do som). */
export const ROTEIRO_DO_CAMPO = {
  duracao: DURACAO,
  fadeEntrada: FADE_ENTRADA,
  inicioDaFreada: INICIO_DA_FREADA,
  parada: PARADA,
  fimDoOlhar: FIM_DO_OLHAR,
  fimDoOlharReduzido: FIM_DO_OLHAR_REDUZIDO,
  inicioDoSol: INICIO_DO_SOL,
  inicioDoBranco: INICIO_DO_BRANCO,
  brancoTotal: BRANCO_TOTAL,
  inicioDoEscuro: INICIO_DO_ESCURO,
  passos: PASSOS,
  olho: OLHO,
  inclinacaoAndando: INCLINACAO_ANDANDO,
  inclinacaoFinal: INCLINACAO_FINAL,
  balancoVertical: BALANCO_VERTICAL,
} as const

/** Quando o pé `k` (1 a PASSOS) assenta: é aí que soa o passo na terra, no vale do balanço. */
export function momentoDoPasso(k: number): number {
  let a = 0
  let b = PARADA
  for (let i = 0; i < 48; i++) {
    const m = (a + b) / 2
    if (faseEm(m) < k) a = m
    else b = m
  }
  return b
}

export interface EstadoDoCampo {
  /** Metros andados. */
  andado: number
  /** Fase do passo (cada inteiro = um pé assentando). */
  fase: number
  x: number
  y: number
  z: number
  rolagem: number
  inclinacao: number
  guinada: number
  /** 0 a 1: quanto do erguer do olhar já foi. */
  olhar: number
  /** 0 a 1: o crescimento do sol (raios, fantasmas, brilho). */
  sol: number
  /** 0 a 1: opacidade do plano branco dentro da cena. */
  branco: number
  fade: number
}

/** Tudo o que a câmera e a luz fazem no instante `t`. Puro: os testes e o gráfico leem daqui. */
export function estadoDoCampo(t: number, reduzirMovimento: boolean): EstadoDoCampo {
  const fase = faseEm(t)
  const passo = reduzirMovimento ? 0 : ritmoEm(t)
  const lado = Math.sin(Math.PI * fase)
  const fimDoOlhar = reduzirMovimento ? FIM_DO_OLHAR_REDUZIDO : FIM_DO_OLHAR
  const amplitude = reduzirMovimento ? AMPLITUDE_DO_OLHAR_REDUZIDO : 1
  const olhar = easeInOutSine(span(t, PARADA, fimDoOlhar))
  const andado = andadoEm(t)
  return {
    andado,
    fase,
    x: passo === 0 ? 0 : BALANCO_LATERAL * passo * lado,
    // Vale (-) quando o pé assenta (fase inteira), topo no meio do passo.
    y: OLHO - (passo === 0 ? 0 : BALANCO_VERTICAL * passo * Math.cos(2 * Math.PI * fase)),
    z: -andado,
    rolagem: passo === 0 ? 0 : ROLAGEM * passo * lado,
    inclinacao: INCLINACAO_ANDANDO + (INCLINACAO_FINAL - INCLINACAO_ANDANDO) * amplitude * olhar,
    guinada: GUINADA_FINAL * amplitude * olhar,
    olhar,
    sol: solEm(t),
    branco: brancoEm(t),
    fade: fadeEm(t),
  }
}

// ---------------------------------------------------------------------------
// Lugar
// ---------------------------------------------------------------------------

const ESTRADA_MEIA_LARGURA = 1.8
const CERCA_X = 2.35
const CERCA_FIM = -82

/** Sombra de copa no chão (cada uma de uma árvore à direita, com o sol de frente). */
interface Sombra {
  x: number
  z: number
  largura: number
  comprimento: number
  variacao: number
}

const SOMBRAS: readonly Sombra[] = [
  // A árvore grande: a caminhada inteira é na sombra dela, e a parada é na borda.
  { x: 1.0, z: 0.4, largura: 7.6, comprimento: 17, variacao: 0 },
  { x: 1.1, z: -18.7, largura: 5.8, comprimento: 13, variacao: 1 },
  { x: 0.7, z: -36.8, largura: 5.2, comprimento: 12, variacao: 2 },
  { x: -10, z: -11.7, largura: 6, comprimento: 13, variacao: 3 },
]

interface Arvore {
  tronco: [number, number]
  copa: [number, number, number]
  raio: number
  clumps: number
}

const ARVORES: readonly Arvore[] = [
  // A copa por onde o olhar passa: espia o sol na borda esquerda dela.
  { tronco: [4.75, -12.9], copa: [4.39, 7.21, -12.54], raio: 3.1, clumps: 14 },
  { tronco: [4.2, -33], copa: [4.0, 5.1, -33], raio: 2.7, clumps: 9 },
  { tronco: [3.9, -50], copa: [3.6, 4.8, -50], raio: 2.5, clumps: 7 },
  { tronco: [-7, -26], copa: [-7, 5.0, -26], raio: 2.9, clumps: 9 },
  { tronco: [-11, -48], copa: [-11, 4.6, -48], raio: 2.6, clumps: 6 },
  { tronco: [7.5, -72], copa: [7.5, 5.2, -72], raio: 3, clumps: 7 },
  { tronco: [-9, -88], copa: [-9, 5.0, -88], raio: 3, clumps: 6 },
]

/** Nuvens no céu: azimute e elevação (graus), largura (graus), espelhada quando o sol fica à esquerda dela. */
const NUVENS: readonly { az: number; el: number; largura: number; variante: number; espelho: boolean }[] = [
  { az: -38, el: 8.5, largura: 44, variante: 0, espelho: false },
  { az: -14, el: 4.2, largura: 22, variante: 1, espelho: false },
  { az: 3, el: 5.6, largura: 17, variante: 2, espelho: false },
  { az: 52, el: 5.2, largura: 32, variante: 3, espelho: true },
  { az: -12, el: 33, largura: 15, variante: 2, espelho: false },
  { az: -42, el: 26, largura: 19, variante: 1, espelho: false },
]

/** Fantasmas de lente: posição na linha sol-centro (1 = no sol, -1 = espelhado), tamanho e cor pastel. */
const FANTASMAS: readonly { k: number; tamanho: number; cor: number; alfa: number }[] = [
  { k: 0.62, tamanho: 0.06, cor: 0xffe4b8, alfa: 0.4 },
  { k: 0.3, tamanho: 0.12, cor: 0xc4ead9, alfa: 0.24 },
  { k: -0.12, tamanho: 0.07, cor: 0xffd8a2, alfa: 0.34 },
  { k: -0.4, tamanho: 0.17, cor: 0xcdc4f0, alfa: 0.2 },
  { k: -0.72, tamanho: 0.06, cor: 0xafd8fa, alfa: 0.3 },
  { k: -1.08, tamanho: 0.24, cor: 0xf2cdbd, alfa: 0.16 },
]

// ---------------------------------------------------------------------------
// Pintura (canvas com semente: a miniatura sai igual toda vez)
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number]

const cor = (c: Rgb, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  // Pintado na CPU: sem isso o navegador pinta na GPU e cada envio para o WebGL vira uma leitura
  // de volta (~20 ms por textura no Edge, medido), que travaria a miniatura da galeria.
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('canvas 2D indisponível')
  return [canvas, g]
}

/** Lâmina de capim: da base (x, y) à ponta, curvada para o lado, afinando. Só acrescenta ao caminho aberto. */
function lamina(g: CanvasRenderingContext2D, x: number, y: number, altura: number, curva: number, largura: number): void {
  const cx = x + curva * 0.3
  const cy = y - altura * 0.55
  g.moveTo(x - largura / 2, y)
  g.quadraticCurveTo(cx - largura * 0.25, cy, x + curva, y - altura)
  g.quadraticCurveTo(cx + largura * 0.25, cy, x + largura / 2, y)
  g.closePath()
}

/** Ponto do eixo da lâmina na fração `s` (0 base, 1 ponta). */
function eixoDaLamina(x: number, y: number, altura: number, curva: number, s: number): [number, number] {
  const cx = x + curva * 0.3
  const cy = y - altura * 0.55
  const a = (1 - s) * (1 - s)
  const b = 2 * (1 - s) * s
  const c = s * s
  return [a * x + b * cx + c * (x + curva), a * y + b * cy + c * (y - altura)]
}

/**
 * Capim alto e viçoso em 4 variantes lado a lado (256 × 256 cada): fundo verde-escuro frio, meio verde,
 * frente verde-amarelado, pontas acesas pelo sol em verde-limão. Cada variante é uma touceira: as bases
 * se juntam no meio e as lâminas das pontas abrem para fora, para o pé do cartão não virar um retângulo
 * chapado (era o "degrau" na beira da estrada, perto da câmera).
 */
function pintarCapim(g: CanvasRenderingContext2D): void {
  const rnd = semente(911)
  const camadas: { tom: Rgb; n: number; alt: [number, number]; larg: [number, number] }[] = [
    { tom: [40, 68, 46], n: 64, alt: [0.22, 0.58], larg: [6, 10] },
    { tom: [72, 110, 52], n: 58, alt: [0.38, 0.8], larg: [4, 8] },
    { tom: [116, 150, 64], n: 54, alt: [0.48, 0.94], larg: [3, 6] },
    { tom: [150, 180, 80], n: 40, alt: [0.55, 1], larg: [2.4, 4.4] },
  ]
  const MEIO = 128
  const ABERTURA = 108
  for (let v = 0; v < 4; v++) {
    const x0 = v * 256
    const vento = (rnd() - 0.35) * 34
    const pontas: [number, number, number, number, number][] = []
    // Recorta na variante: lâmina que tomba para fora não vaza para o cartão vizinho do atlas.
    g.save()
    g.beginPath()
    g.rect(x0 + 2, 0, 252, 256)
    g.clip()
    for (const [i, c] of camadas.entries()) {
      g.fillStyle = cor(c.tom)
      g.beginPath()
      for (let j = 0; j < c.n; j++) {
        // Distribuição triangular: denso no meio, ralo nas bordas.
        const desvio = (rnd() + rnd() - 1) * ABERTURA
        const bx = x0 + MEIO + desvio
        const by = 254 + rnd() * 8
        const h = (c.alt[0] + rnd() * (c.alt[1] - c.alt[0])) * 244 * (1 - 0.35 * Math.abs(desvio / ABERTURA))
        const curva = vento + desvio * 0.24 + (rnd() - 0.5) * 46
        lamina(g, bx, by, h, curva, c.larg[0] + rnd() * (c.larg[1] - c.larg[0]))
        if (i >= 2) pontas.push([bx, by, h, curva, i])
      }
      g.fill()
    }
    // Contraluz: o terço de cima das lâminas da frente acende em verde-limão quente.
    g.fillStyle = cor([198, 214, 110])
    g.beginPath()
    for (const [bx, by, h, curva, i] of pontas) {
      if (i < 3 && rnd() < 0.55) continue
      const [px, py] = eixoDaLamina(bx, by, h, curva, 0.66)
      lamina(g, px, py, h * 0.34, curva * 0.34, 1.8)
    }
    g.fill()
    g.restore()
  }
}

/** Terra batida clara com dois sulcos de roda, capim no meio e nas beiradas. 256 (3,6 m) × 512 (9 m), repete no comprimento. */
function pintarEstrada(g: CanvasRenderingContext2D): void {
  const L = 256
  const A = 512
  const rnd = semente(4243)
  const px = (m: number) => ((m + ESTRADA_MEIA_LARGURA) / (2 * ESTRADA_MEIA_LARGURA)) * L
  // Borda irregular e periódica (o fim emenda no começo).
  const borda = (y: number, lado: number) => {
    const k = (y / A) * Math.PI * 2
    return 1.6 + 0.07 * Math.sin(k * 2 + lado * 1.3) + 0.04 * Math.sin(k * 5 + lado * 0.4) + 0.025 * Math.sin(k * 11 + lado * 2.2)
  }
  g.fillStyle = cor([214, 192, 154])
  g.beginPath()
  for (let y = 0; y <= A; y += 8) g.lineTo(px(-borda(y, -1)), y)
  for (let y = A; y >= 0; y -= 8) g.lineTo(px(borda(y, 1)), y)
  g.closePath()
  g.fill()
  // Perfil da estrada: beira mais escura, sulcos lisos, lombada clara entre eles.
  g.globalCompositeOperation = 'source-atop'
  const perfil = g.createLinearGradient(0, 0, L, 0)
  const paradas: [number, Rgb][] = [
    [-1.8, [186, 160, 120]],
    [-1.25, [214, 193, 156]],
    [-0.78, [228, 210, 174]],
    [-0.62, [196, 172, 134]],
    [-0.46, [224, 206, 170]],
    [0, [212, 194, 152]],
    [0.46, [224, 206, 170]],
    [0.62, [196, 172, 134]],
    [0.78, [228, 210, 174]],
    [1.25, [214, 193, 156]],
    [1.8, [186, 160, 120]],
  ]
  for (const [m, c] of paradas) perfil.addColorStop(px(m) / L, cor(c))
  g.fillStyle = perfil
  g.fillRect(0, 0, L, A)
  // Riscos ao comprido: marcas de roda e de chuva.
  const riscos: [Rgb, number][] = [
    [[176, 148, 110], 70],
    [[238, 224, 194], 60],
  ]
  for (const [tom, n] of riscos) {
    g.strokeStyle = cor(tom, 0.7)
    g.lineWidth = 1
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const sulco = rnd() < 0.7 ? (rnd() < 0.5 ? -0.62 : 0.62) : (rnd() - 0.5) * 2.8
      const x = px(sulco + (rnd() - 0.5) * 0.24)
      const y = rnd() * A
      const c = 20 + rnd() * 90
      for (const dy of [0, -A]) {
        g.moveTo(x, y + dy)
        g.lineTo(x + (rnd() - 0.5) * 2, y + dy + c)
      }
    }
    g.stroke()
  }
  // Pedrinhas: topo aceso e sombra para o lado da câmera.
  const pedras: [number, number, number][] = []
  for (let i = 0; i < 420; i++) pedras.push([px((rnd() - 0.5) * 3.3), rnd() * A, 0.7 + rnd() * 1.5])
  g.fillStyle = cor([150, 126, 96], 0.8)
  g.beginPath()
  for (const [x, y, r] of pedras) {
    g.moveTo(x + r, y + 1)
    g.ellipse(x, y + 1, r, r * 0.6, 0, 0, Math.PI * 2)
  }
  g.fill()
  g.fillStyle = cor([244, 234, 210], 0.9)
  g.beginPath()
  for (const [x, y, r] of pedras) {
    g.moveTo(x + r * 0.8, y)
    g.ellipse(x, y, r * 0.8, r * 0.5, 0, 0, Math.PI * 2)
  }
  g.fill()
  g.globalCompositeOperation = 'source-over'
  // Capim ralo no meio e capim invadindo as beiradas (passa da borda: o alphaTest recorta).
  const tufos: [Rgb, number, number, number][] = [
    [[120, 140, 72], 70, 0, 0.26],
    [[148, 164, 86], 50, 0, 0.22],
    [[76, 110, 50], 150, 1, 0.22],
    [[130, 160, 72], 130, 1, 0.18],
  ]
  for (const [tom, n, beira, espalho] of tufos) {
    g.fillStyle = cor(tom)
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const y = rnd() * A
      const lado = rnd() < 0.5 ? -1 : 1
      const m = beira ? lado * (borda(y, lado) - 0.05 + (rnd() - 0.6) * espalho) : (rnd() - 0.5) * espalho * 2
      const x = px(m)
      const h = 6 + rnd() * (beira ? 16 : 8)
      for (const dy of [0, -A]) lamina(g, x, y + dy, h, (rnd() - 0.5) * 8 - lado * beira * 3, 2.2)
    }
    g.fill()
  }
}

/** Chão do campo: verde de verão com manchas mais claras e mais escuras e um granulado de lâminas. 512 × 512 (12 m). */
function pintarCampo(g: CanvasRenderingContext2D): void {
  const L = 512
  const rnd = semente(7331)
  g.fillStyle = cor([88, 124, 54])
  g.fillRect(0, 0, L, L)
  const manchas: Rgb[] = [
    [110, 144, 62],
    [66, 100, 46],
    [128, 156, 70],
    [58, 90, 44],
  ]
  for (let i = 0; i < 90; i++) {
    const x = rnd() * L
    const y = rnd() * L
    const r = 30 + rnd() * 70
    g.fillStyle = cor(manchas[i % manchas.length], 0.22)
    g.beginPath()
    for (const dx of [-L, 0, L]) for (const dy of [-L, 0, L]) {
      if (x + dx + r < 0 || x + dx - r > L || y + dy + r < 0 || y + dy - r > L) continue
      g.moveTo(x + dx + r, y + dy)
      g.ellipse(x + dx, y + dy, r, r * 0.7, 0, 0, Math.PI * 2)
    }
    g.fill()
  }
  const tons: Rgb[] = [
    [146, 172, 80],
    [62, 96, 42],
    [108, 140, 60],
    [176, 194, 100],
    [48, 78, 38],
  ]
  for (const [i, tom] of tons.entries()) {
    g.strokeStyle = cor(tom, 0.75)
    g.lineWidth = i === 3 ? 1 : 1.5
    g.beginPath()
    for (let j = 0; j < 420; j++) {
      const x = rnd() * L
      const y = rnd() * L
      const c = 3 + rnd() * 7
      g.moveTo(x, y)
      g.lineTo(x + (rnd() - 0.5) * 3, y - c)
    }
    g.stroke()
  }
}

/** Madeira cinza de mourão velho, veio na vertical. */
function pintarMadeira(g: CanvasRenderingContext2D): void {
  const rnd = semente(2213)
  g.fillStyle = cor([146, 128, 104])
  g.fillRect(0, 0, 64, 256)
  for (const [tom, n] of [
    [[104, 88, 70], 26],
    [[178, 162, 138], 18],
  ] as [Rgb, number][]) {
    g.strokeStyle = cor(tom, 0.8)
    g.lineWidth = 1.5
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const x = rnd() * 64
      g.moveTo(x, 0)
      g.bezierCurveTo(x + (rnd() - 0.5) * 6, 90, x + (rnd() - 0.5) * 6, 170, x + (rnd() - 0.5) * 4, 256)
    }
    g.stroke()
  }
  g.fillStyle = cor([82, 68, 54])
  g.beginPath()
  for (let i = 0; i < 4; i++) {
    const x = 10 + rnd() * 44
    const y = rnd() * 256
    g.moveTo(x + 3, y)
    g.ellipse(x, y, 3, 7, 0, 0, Math.PI * 2)
  }
  g.fill()
}

/** Copa em contraluz: verde-escuro com a borda acesa do lado do sol (esquerda, em cima). 2 variantes de 256. */
function pintarFolhagem(g: CanvasRenderingContext2D): void {
  const rnd = semente(6607)
  for (let v = 0; v < 2; v++) {
    const cx = 128 + v * 256
    const cy = 134
    const tufos: [number, number, number][] = []
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd())
      tufos.push([cx + Math.cos(a) * d * 82, cy + Math.sin(a) * d * 74, 16 + rnd() * 20])
    }
    const passe = (tom: Rgb, escala: number, desloca: number) => {
      g.fillStyle = cor(tom)
      g.beginPath()
      for (const [x, y, r] of tufos) {
        const rr = r * escala
        g.moveTo(x - r * desloca + rr, y - r * desloca)
        g.arc(x - r * desloca, y - r * desloca, rr, 0, Math.PI * 2)
      }
      g.fill()
    }
    // Verde mais escuro e azulado que o capim, para a copa não sumir no campo verde.
    passe([26, 44, 44], 1, 0)
    // Folhas soltas recortando a silhueta.
    g.fillStyle = cor([26, 44, 44])
    g.beginPath()
    for (let i = 0; i < 140; i++) {
      const [x, y, r] = tufos[i % tufos.length]
      const a = rnd() * Math.PI * 2
      const fx = x + Math.cos(a) * (r + 2)
      const fy = y + Math.sin(a) * (r + 2)
      g.moveTo(fx + 2.5, fy)
      g.ellipse(fx, fy, 2.5, 5.5, a, 0, Math.PI * 2)
    }
    g.fill()
    passe([42, 70, 60], 0.74, 0.24)
    passe([84, 114, 74], 0.4, 0.46)
    g.fillStyle = cor([188, 208, 140])
    g.beginPath()
    for (let i = 0; i < 90; i++) {
      const [x, y, r] = tufos[i % tufos.length]
      const a = Math.PI * (1 + rnd() * 0.6)
      const fx = x + Math.cos(a) * r * 0.82
      const fy = y + Math.sin(a) * r * 0.82
      const rr = 1.2 + rnd() * 2.2
      g.moveTo(fx + rr, fy)
      g.arc(fx, fy, rr, 0, Math.PI * 2)
    }
    g.fill()
    // Furos por onde passa o céu.
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    for (let i = 0; i < 12; i++) {
      const [x, y, r] = tufos[Math.floor(rnd() * tufos.length)]
      const rr = 2 + rnd() * 4
      g.moveTo(x + r * 0.7 + rr, y)
      g.arc(x + r * 0.7, y, rr, 0, Math.PI * 2)
    }
    g.fill()
    g.globalCompositeOperation = 'source-over'
  }
}

/** Mancha de sombra de copa (alphaMap: branco = sombra), com furos de luz. */
function pintarSombra(g: CanvasRenderingContext2D): void {
  const rnd = semente(1499)
  g.fillStyle = '#000'
  g.fillRect(0, 0, 512, 512)
  const bolhas: [number, number, number][] = []
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd())
    bolhas.push([256 + Math.cos(a) * d * 180, 256 + Math.sin(a) * d * 196, 34 + rnd() * 50])
  }
  // Borda em meio-tom: a penumbra da copa.
  for (const [tom, escala] of [
    ['#7a7a7a', 1.12],
    ['#ffffff', 1],
  ] as [string, number][]) {
    g.fillStyle = tom
    g.beginPath()
    for (const [x, y, r] of bolhas) {
      g.moveTo(x + r * escala, y)
      g.arc(x, y, r * escala, 0, Math.PI * 2)
    }
    g.fill()
  }
  // Furos de luz (komorebi): esticam no comprimento junto com a mancha.
  for (const [tom, n] of [
    ['#3a3a3a', 26],
    ['#000000', 48],
  ] as [string, number][]) {
    g.fillStyle = tom
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const [x, y, r] = bolhas[Math.floor(rnd() * bolhas.length)]
      const a = rnd() * Math.PI * 2
      const fx = x + Math.cos(a) * r * rnd()
      const fy = y + Math.sin(a) * r * rnd()
      const rr = 3 + rnd() * 10
      g.moveTo(fx + rr, fy)
      g.ellipse(fx, fy, rr, rr * (0.6 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2)
    }
    g.fill()
  }
}

/** Cúmulos de verão em 4 variantes (512 × 256 cada): base azulada, topo aceso pelo sol (à direita, em cima). */
function pintarNuvens(g: CanvasRenderingContext2D): void {
  const rnd = semente(8101)
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * 512
    const oy = Math.floor(v / 2) * 256
    const base = oy + 214
    const bolhas: [number, number, number][] = []
    const torres = 3 + Math.floor(rnd() * 4)
    for (let i = 0; i < 8; i++) {
      const r = 28 + rnd() * 30
      bolhas.push([ox + 70 + (i / 7) * 372 + (rnd() - 0.5) * 30, base - r * 0.55, r])
    }
    for (let i = 0; i < torres; i++) {
      const r = 34 + rnd() * 40
      bolhas.push([ox + 150 + rnd() * 210, base - 70 - rnd() * 80, r])
    }
    for (let i = 0; i < 10; i++) {
      const [x, y, r] = bolhas[Math.floor(rnd() * bolhas.length)]
      const a = -Math.PI * rnd()
      bolhas.push([x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * (0.35 + rnd() * 0.3)])
    }
    const passe = (tom: Rgb, escala: number, dx: number, dy: number) => {
      g.fillStyle = cor(tom)
      g.beginPath()
      for (const [x, y, r] of bolhas) {
        g.moveTo(x + r * dx + r * escala, y + r * dy)
        g.arc(x + r * dx, y + r * dy, r * escala, 0, Math.PI * 2)
      }
      g.fill()
    }
    passe([172, 188, 214], 1, 0, 0)
    passe([214, 224, 238], 0.84, 0.1, -0.14)
    passe([252, 250, 243], 0.56, 0.22, -0.3)
    // Base reta, como a de um cúmulo.
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = '#000'
    g.fillRect(ox, base, 512, 256 - (base - oy))
    g.globalCompositeOperation = 'source-over'
  }
}

/** Linha de árvores e morros no horizonte, já na névoa. 1024 × 128; o chão (linha 112) na cor da névoa. */
function pintarHorizonte(g: CanvasRenderingContext2D, nevoa: Rgb): void {
  const rnd = semente(3571)
  g.fillStyle = cor([178, 196, 206])
  g.beginPath()
  g.moveTo(0, 128)
  for (let x = 0; x <= 1024; x += 16) g.lineTo(x, 84 - 10 * Math.sin(x * 0.006 + 1) - 6 * Math.sin(x * 0.019))
  g.lineTo(1024, 128)
  g.closePath()
  g.fill()
  for (const [tom, n, r0, r1, topo] of [
    [[150, 172, 166], 150, 3, 8, 104],
    [[122, 146, 128], 34, 6, 13, 106],
  ] as [Rgb, number, number, number, number][]) {
    g.fillStyle = cor(tom)
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const x = rnd() * 1024
      const r = r0 + rnd() * (r1 - r0)
      const y = topo - rnd() * r * 0.6
      g.moveTo(x + r, y)
      g.arc(x, y, r, 0, Math.PI * 2)
    }
    g.fill()
  }
  g.fillStyle = cor(nevoa)
  g.fillRect(0, 110, 1024, 18)
}

/** Disco do sol e halo: degradê radial quente. */
function pintarBrilho(g: CanvasRenderingContext2D, paradas: [number, string][]): void {
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (const [p, c] of paradas) grad.addColorStop(p, c)
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
}

/** Raios do sol: cunhas finas de comprimentos diferentes, mais fortes no centro. */
function pintarRaios(g: CanvasRenderingContext2D): void {
  const rnd = semente(4441)
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256)
  grad.addColorStop(0, 'rgba(255,252,240,0.95)')
  grad.addColorStop(0.25, 'rgba(255,240,205,0.4)')
  grad.addColorStop(1, 'rgba(255,230,190,0)')
  g.fillStyle = grad
  g.beginPath()
  const n = 26
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.18
    const meia = 0.008 + rnd() * 0.022
    const r = 110 + rnd() * 146
    g.moveTo(256, 256)
    g.lineTo(256 + Math.cos(a - meia) * r, 256 + Math.sin(a - meia) * r)
    g.lineTo(256 + Math.cos(a + meia) * r, 256 + Math.sin(a + meia) * r)
    g.closePath()
  }
  g.fill()
}

/** Fantasma hexagonal (as lâminas do diafragma), borda um pouco mais forte. */
function pintarFantasma(g: CanvasRenderingContext2D): void {
  const hexagono = (r: number) => {
    g.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
    }
    g.closePath()
  }
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 60)
  grad.addColorStop(0, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0.7)')
  g.fillStyle = grad
  hexagono(56)
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.lineWidth = 2.5
  hexagono(55)
  g.stroke()
}

// ---------------------------------------------------------------------------
// Céu (shader: degradê de verão e a auréola do sol; escreve a cor final direto)
// ---------------------------------------------------------------------------

const CEU_VERTICE = /* glsl */ `
varying vec3 vDirecao;
void main() {
  vDirecao = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const CEU_FRAGMENTO = /* glsl */ `
uniform vec3 uSol;
uniform float uBrilho;
varying vec3 vDirecao;
float acaso(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDirecao);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(vec3(0.88, 0.88, 0.84), vec3(0.45, 0.67, 0.92), smoothstep(0.0, 0.22, h));
  c = mix(c, vec3(0.18, 0.43, 0.83), smoothstep(0.18, 0.85, h));
  float s = max(dot(d, uSol), 0.0);
  float aureola = pow(s, 8.0) * 0.45 + pow(1.0 - h, 5.0) * pow(s, 3.0) * 0.35;
  c = mix(c, vec3(1.0, 0.93, 0.78), clamp(aureola * (1.0 + 1.5 * uBrilho), 0.0, 1.0));
  c += vec3(1.0, 0.96, 0.86) * (pow(s, 90.0) * (0.5 + uBrilho) + pow(s, 900.0) * 0.8);
  c += (acaso(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}
`

// ---------------------------------------------------------------------------
// A cena
// ---------------------------------------------------------------------------

/** Direção (unitária) de azimute/elevação em graus; azimute positivo = à direita da estrada. */
function direcao(THREE: ThreeModule, azGraus: number, elGraus: number): Three.Vector3 {
  const az = (azGraus * Math.PI) / 180
  const el = (elGraus * Math.PI) / 180
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
}

/** Cor dada em sRGB, guardada linear: o motor desliga o gerenciamento e a saída em sRGB devolve o tom exato. */
function corLinear(THREE: ThreeModule, hex: number): Three.Color {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace).convertSRGBToLinear()
}

function montarCampo(THREE: ThreeModule, { reduzirMovimento }: OpcoesDaCena, fundo: FundoDoCampo): CenaTransicao {
  const scene = new THREE.Scene()
  const NEVOA: Rgb = [216, 222, 202]
  scene.fog = new THREE.Fog(corLinear(THREE, 0xd8deca), 16, 300)
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1200)
  scene.add(camera)
  const texturas: Three.Texture[] = []
  const rnd = semente(20261012)

  const textura = (canvas: HTMLCanvasElement, opcoes: { repetir?: boolean; cor?: boolean } = {}) => {
    const tex = new THREE.CanvasTexture(canvas)
    if (opcoes.cor !== false) tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    if (opcoes.repetir) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    texturas.push(tex)
    return tex
  }
  const pintar = (largura: number, altura: number, pintor: (g: CanvasRenderingContext2D) => void) => {
    const [canvas, g] = tela(largura, altura)
    pintor(g)
    return canvas
  }

  const solDir = direcao(THREE, (SOL_AZIMUTE * 180) / Math.PI, (SOL_ELEVACAO * 180) / Math.PI)
  /** Para onde as sombras deitam no chão: o contrário do sol, no plano. */
  const giroDasSombras = Math.atan2(-solDir.x, -solDir.z)

  // --- Luz (só mourões e troncos são iluminados; o resto é pintado) ---------
  const sol = new THREE.DirectionalLight(0xffdcae, 2.1)
  sol.position.copy(solDir).multiplyScalar(60)
  scene.add(sol)
  scene.add(new THREE.HemisphereLight(0xa6c0ea, 0x6e8448, 1.25))

  // --- Céu ---------------------------------------------------------------------
  const materialDoCeu = new THREE.ShaderMaterial({
    uniforms: { uSol: { value: solDir.clone() }, uBrilho: { value: 0 } },
    vertexShader: CEU_VERTICE,
    fragmentShader: CEU_FRAGMENTO,
    side: THREE.BackSide,
    depthWrite: false,
  })
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), materialDoCeu)
  ceu.renderOrder = -10
  ceu.frustumCulled = false
  scene.add(ceu)

  const texNuvens = textura(pintar(1024, 512, pintarNuvens))
  const nuvens = NUVENS.map((n) => {
    const tex = texNuvens.clone()
    texturas.push(tex)
    tex.repeat.set(0.5, 0.5)
    tex.offset.set((n.variante % 2) * 0.5, n.variante < 2 ? 0.5 : 0)
    const material = new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false })
    const sprite = new THREE.Sprite(material)
    const largura = 2 * DISTANCIA_DO_CEU * Math.tan((n.largura * Math.PI) / 360)
    sprite.scale.set(n.espelho ? -largura : largura, largura / 2, 1)
    sprite.renderOrder = -5
    scene.add(sprite)
    return { sprite, dir: direcao(THREE, n.az, n.el) }
  })

  const horizonte = new THREE.Mesh(
    new THREE.CylinderGeometry(260, 260, 26, 48, 1, true, Math.PI - 1.9, 3.8),
    new THREE.MeshBasicMaterial({ map: textura(pintar(1024, 128, (g) => pintarHorizonte(g, NEVOA))), side: THREE.BackSide, alphaTest: 0.5, fog: false }),
  )
  // A linha 112 do canvas (o chão da pintura) cai na altura do chão.
  horizonte.position.y = 26 * (112 / 128) - 26 / 2
  scene.add(horizonte)

  // --- Chão --------------------------------------------------------------------
  const texCampo = textura(pintar(512, 512, pintarCampo), { repetir: true })
  texCampo.repeat.set(600 / 12, 600 / 12)
  const campo = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texCampo }))
  campo.position.z = -280
  scene.add(campo)

  const texEstrada = textura(pintar(256, 512, pintarEstrada), { repetir: true })
  texEstrada.repeat.set(1, 600 / 9)
  const estrada = new THREE.Mesh(
    new THREE.PlaneGeometry(ESTRADA_MEIA_LARGURA * 2, 600).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texEstrada, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  )
  estrada.position.set(0, 0.004, -280)
  scene.add(estrada)

  // --- Sombras de copa ---------------------------------------------------------
  const texSombra = textura(pintar(512, 512, pintarSombra), { cor: false })
  const tomDaSombra = corLinear(THREE, 0x2c3350)
  const materialDaSombra = new THREE.MeshBasicMaterial({
    color: tomDaSombra,
    alphaMap: texSombra,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const planoDeChao = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  for (const s of SOMBRAS) {
    const malha = new THREE.Mesh(planoDeChao, materialDaSombra)
    malha.position.set(s.x, 0.012, s.z)
    malha.rotation.y = giroDasSombras + (s.variacao >= 2 ? Math.PI : 0)
    malha.scale.set(s.variacao % 2 === 1 ? -s.largura : s.largura, 1, s.comprimento)
    malha.renderOrder = 1
    scene.add(malha)
  }
  /** 0 = no sol, 1 = dentro de uma mancha de sombra (para tingir capim e mourões). */
  const sombraEm = (x: number, z: number): number => {
    let s = 0
    for (const m of SOMBRAS) {
      const dx = x - m.x
      const dz = z - m.z
      const c = Math.cos(giroDasSombras)
      const n = Math.sin(giroDasSombras)
      const u = (dx * c - dz * n) / (m.largura * 0.5)
      const w = (dx * n + dz * c) / (m.comprimento * 0.5)
      s = Math.max(s, 1 - clamp01((Math.hypot(u, w) - 0.62) / 0.3))
    }
    return s
  }
  const SOMBRA_RGB: Rgb = [0.6, 0.62, 0.8]

  // --- Capim alto (cartões em contraluz) ---------------------------------------
  const texCapim = textura(pintar(1024, 256, pintarCapim))
  interface Tufo {
    x: number
    z: number
    largura: number
    altura: number
    giro: number
    variante: number
    fase: number
  }
  const tufos: Tufo[] = []
  const plantar = (x: number, z: number, largura: number, altura: number) =>
    tufos.push({ x, z, largura, altura, giro: (rnd() - 0.5) * 0.7, variante: Math.floor(rnd() * 4), fase: rnd() * Math.PI * 2 })
  for (const lado of [-1, 1]) {
    // Primeira fileira: o miolo da touceira fica fora da terra; só as lâminas da ponta invadem a beira.
    for (let z = 4; z > -62; z -= 0.42 + rnd() * 0.3) {
      const largura = 0.8 + rnd() * 0.5
      plantar(lado * (1.5 + largura * 0.3 + rnd() * 0.4), z, largura, 0.5 + rnd() * 0.45)
    }
    for (let z = 4; z > -62; z -= 0.3 + rnd() * 0.25) plantar(lado * (2.45 + rnd() * 3.2), z, 1 + rnd() * 0.6, 0.75 + rnd() * 0.55)
    for (let z = 0; z > -70; z -= 0.6 + rnd() * 0.6) plantar(lado * (5.6 + rnd() * 9), z, 1.3 + rnd() * 0.8, 0.85 + rnd() * 0.5)
  }
  const nTufos = tufos.length
  const posCapim = new Float32Array(nTufos * 12)
  const uvCapim = new Float32Array(nTufos * 8)
  const corCapim = new Float32Array(nTufos * 12)
  const indCapim: number[] = []
  const topoBase = new Float32Array(nTufos * 6)
  tufos.forEach((t, i) => {
    const ax = Math.cos(t.giro) * t.largura * 0.5
    const az = -Math.sin(t.giro) * t.largura * 0.5
    const cantos = [
      [t.x - ax, -0.04, t.z - az],
      [t.x + ax, -0.04, t.z + az],
      [t.x + ax, t.altura, t.z + az],
      [t.x - ax, t.altura, t.z - az],
    ]
    cantos.forEach((p, k) => posCapim.set(p, i * 12 + k * 3))
    topoBase.set([...cantos[2], ...cantos[3]], i * 6)
    const u0 = t.variante / 4 + 0.004
    const u1 = (t.variante + 1) / 4 - 0.004
    uvCapim.set([u0, 0, u1, 0, u1, 1, u0, 1], i * 8)
    const luz = 0.86 + rnd() * 0.18
    const sombra = sombraEm(t.x, t.z)
    for (let k = 0; k < 4; k++) {
      const pe = k < 2 ? 0.8 : 1
      for (let c = 0; c < 3; c++) corCapim[i * 12 + k * 3 + c] = luz * pe * (1 + (SOMBRA_RGB[c] - 1) * sombra) * (c === 2 ? 0.94 : 1)
    }
    indCapim.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3)
  })
  const geoCapim = new THREE.BufferGeometry()
  const atributoCapim = new THREE.BufferAttribute(posCapim, 3)
  atributoCapim.setUsage(THREE.DynamicDrawUsage)
  geoCapim.setAttribute('position', atributoCapim)
  geoCapim.setAttribute('uv', new THREE.BufferAttribute(uvCapim, 2))
  geoCapim.setAttribute('color', new THREE.BufferAttribute(corCapim, 3))
  geoCapim.setIndex(indCapim)
  const capim = new THREE.Mesh(geoCapim, new THREE.MeshBasicMaterial({ map: texCapim, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true }))
  capim.frustumCulled = false
  scene.add(capim)

  /** Vento no capim: ondas que correm da direita para a esquerda, mais fortes nas rajadas. */
  const ventoX = -0.94
  const ventoZ = 0.33
  function balancarCapim(t: number) {
    const ritmo = reduzirMovimento ? 0.5 : 1
    const forca = reduzirMovimento ? 0.4 : 1
    const rajada = rajadaEm(t)
    for (let i = 0; i < nTufos; i++) {
      const tufo = tufos[i]
      const onda = 0.5 + 0.5 * Math.sin(1.9 * t * ritmo + 0.35 * tufo.x - 0.22 * tufo.z + tufo.fase)
      const empurrao = tufo.altura * forca * (0.04 + 0.09 * rajada) * (0.35 + 0.65 * onda)
      for (let k = 0; k < 2; k++) {
        const o = i * 6 + k * 3
        const v = i * 12 + (k + 2) * 3
        posCapim[v] = topoBase[o] + ventoX * empurrao
        posCapim[v + 1] = topoBase[o + 1] - empurrao * 0.25
        posCapim[v + 2] = topoBase[o + 2] + ventoZ * empurrao
      }
    }
    atributoCapim.needsUpdate = true
  }

  // --- Cercas: mourões tortos e três fios de arame -----------------------------
  interface Mourao {
    matriz: Three.Matrix4
    x: number
    z: number
    altura: number
    largura: number
  }
  const mouroes: Mourao[][] = [[], []]
  const euler = new THREE.Euler()
  const quat = new THREE.Quaternion()
  for (const [l, lado] of [-1, 1].entries()) {
    let z = 1.4 - rnd() * 1.2
    while (z > CERCA_FIM) {
      const altura = 1.05 + rnd() * 0.3
      const largura = 0.085 + rnd() * 0.04
      const torto = rnd() < 0.12 ? lado * 0.28 : (rnd() - 0.5) * 0.18
      euler.set((rnd() - 0.5) * 0.16, rnd() * 0.6, torto)
      quat.setFromEuler(euler)
      const x = lado * (CERCA_X + (rnd() - 0.5) * 0.12)
      const matriz = new THREE.Matrix4().compose(new THREE.Vector3(x, -0.05, z), quat, new THREE.Vector3(largura, altura, largura * (0.9 + rnd() * 0.3)))
      mouroes[l].push({ matriz, x, z, altura, largura })
      z -= 2.45 + rnd() * 0.5
    }
  }
  const todos = [...mouroes[0], ...mouroes[1]]
  const geoMourao = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const texMadeira = textura(pintar(64, 256, pintarMadeira))
  const materialMourao = new THREE.MeshLambertMaterial({ map: texMadeira })
  const cerca = new THREE.InstancedMesh(geoMourao, materialMourao, todos.length)
  const tom = new THREE.Color()
  todos.forEach((m, i) => {
    cerca.setMatrixAt(i, m.matriz)
    const s = sombraEm(m.x, m.z)
    tom.setRGB(1 + (SOMBRA_RGB[0] - 1) * s, 1 + (SOMBRA_RGB[1] - 1) * s, 1 + (SOMBRA_RGB[2] - 1) * s)
    cerca.setColorAt(i, tom)
  })
  scene.add(cerca)

  // Arame: prisma fino de 3 faces ao longo de uma curva que cede entre os mourões.
  const posArame: number[] = []
  const indArame: number[] = []
  const RAIO_DO_ARAME = 0.0065
  const ponto = new THREE.Vector3()
  const fio = (pontos: Three.Vector3[]) => {
    const base = posArame.length / 3
    for (let i = 0; i < pontos.length; i++) {
      const p = pontos[i]
      const q = pontos[Math.min(i + 1, pontos.length - 1)]
      const r = pontos[Math.max(i - 1, 0)]
      const tx = q.x - r.x
      const ty = q.y - r.y
      const tz = q.z - r.z
      const tl = Math.hypot(tx, ty, tz) || 1
      // normal = tangente × cima; binormal = normal × tangente
      let nx = -tz / tl
      let nz = tx / tl
      const nl = Math.hypot(nx, nz) || 1
      nx /= nl
      nz /= nl
      const bx = (-nz * ty) / tl
      const by = (nz * tx - nx * tz) / tl
      const bz = (nx * ty) / tl
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2
        const c = Math.cos(a) * RAIO_DO_ARAME
        const s = Math.sin(a) * RAIO_DO_ARAME
        posArame.push(p.x + nx * c + bx * s, p.y + by * s, p.z + nz * c + bz * s)
      }
    }
    for (let i = 0; i < pontos.length - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const a = base + i * 3 + k
        const b = base + i * 3 + ((k + 1) % 3)
        indArame.push(a, a + 3, b, b, a + 3, b + 3)
      }
    }
  }
  for (const lado of mouroes) {
    for (let i = 0; i < lado.length - 1; i++) {
      for (const [f, cede] of [
        [0.4, 0.05],
        [0.66, 0.04],
        [0.9, 0.03],
      ]) {
        const a = new THREE.Vector3(0, f, 0).applyMatrix4(lado[i].matriz)
        const b = new THREE.Vector3(0, f, 0).applyMatrix4(lado[i + 1].matriz)
        const pontos: Three.Vector3[] = []
        for (let s = 0; s <= 6; s++) {
          const u = s / 6
          ponto.lerpVectors(a, b, u)
          ponto.y -= cede * (1 + rnd() * 0.5) * 4 * u * (1 - u)
          pontos.push(ponto.clone())
        }
        fio(pontos)
      }
    }
  }
  const geoArame = new THREE.BufferGeometry()
  geoArame.setAttribute('position', new THREE.Float32BufferAttribute(posArame, 3))
  geoArame.setIndex(indArame)
  scene.add(new THREE.Mesh(geoArame, new THREE.MeshBasicMaterial({ color: corLinear(THREE, 0x3b3631) })))

  // Sombra comprida de cada mourão (fora das manchas de copa), deitando para a câmera.
  const posSombraMourao: number[] = []
  const indSombraMourao: number[] = []
  const comprimentoDaSombra = 1 / Math.tan(SOL_ELEVACAO)
  const dsx = Math.sin(giroDasSombras)
  const dsz = Math.cos(giroDasSombras)
  for (const m of todos) {
    if (sombraEm(m.x, m.z) > 0.5) continue
    const c = m.altura * comprimentoDaSombra
    const b = posSombraMourao.length / 3
    const l0 = m.largura * 0.6
    const l1 = m.largura * 0.35
    posSombraMourao.push(
      m.x - dsz * l0,
      0.014,
      m.z + dsx * l0,
      m.x + dsz * l0,
      0.014,
      m.z - dsx * l0,
      m.x + dsx * c + dsz * l1,
      0.014,
      m.z + dsz * c - dsx * l1,
      m.x + dsx * c - dsz * l1,
      0.014,
      m.z + dsz * c + dsx * l1,
    )
    indSombraMourao.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const geoSombraMourao = new THREE.BufferGeometry()
  geoSombraMourao.setAttribute('position', new THREE.Float32BufferAttribute(posSombraMourao, 3))
  geoSombraMourao.setIndex(indSombraMourao)
  const sombrasDosMouroes = new THREE.Mesh(
    geoSombraMourao,
    new THREE.MeshBasicMaterial({
      color: tomDaSombra,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
  sombrasDosMouroes.renderOrder = 1
  scene.add(sombrasDosMouroes)

  // --- Árvores -------------------------------------------------------------------
  const texFolhagem = textura(pintar(512, 256, pintarFolhagem))
  const materialTronco = new THREE.MeshLambertMaterial({ color: corLinear(THREE, 0x6a5848) })
  interface Folha {
    sprite: Three.Sprite
    base: Three.Vector3
    fase: number
  }
  const folhas: Folha[] = []
  for (const [i, a] of arvoresDoFundo(fundo, ARVORES).entries()) {
    const [cx, cy, cz] = a.copa
    const altura = cy - a.raio * 0.3
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.12 + a.raio * 0.05, 0.22 + a.raio * 0.08, altura, 8), materialTronco)
    tronco.position.set((a.tronco[0] + cx) / 2, altura / 2, (a.tronco[1] + cz) / 2)
    tronco.rotation.set((cz - a.tronco[1]) / altura, 0, -(cx - a.tronco[0]) / altura)
    scene.add(tronco)
    // Dois galhos subindo do meio do tronco para dentro da copa: o tronco não fica um poste.
    for (const lado of [-1, 1]) {
      const de = new THREE.Vector3(a.tronco[0] + (cx - a.tronco[0]) * 0.55, altura * 0.55, a.tronco[1] + (cz - a.tronco[1]) * 0.55)
      const para = new THREE.Vector3(cx + lado * a.raio * 0.55, cy - a.raio * 0.1, cz + lado * a.raio * 0.15)
      const galho = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + a.raio * 0.02, 0.09 + a.raio * 0.035, de.distanceTo(para), 6), materialTronco)
      galho.position.copy(de).lerp(para, 0.5)
      galho.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), para.clone().sub(de).normalize())
      scene.add(galho)
    }
    // A copa grande é redonda; as do fundo, mais largas que altas.
    const espalho = i === 0 ? 0.62 : 0.82
    const alturaDaCopa = i === 0 ? 0.62 : 0.42
    for (let k = 0; k < a.clumps; k++) {
      const tex = texFolhagem.clone()
      texturas.push(tex)
      tex.repeat.set(0.5, 1)
      tex.offset.set(k % 2 === 0 ? 0 : 0.5, 0)
      const material = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false, color: i === 0 ? 0xffffff : 0xe8f0f4 })
      const sprite = new THREE.Sprite(material)
      const ang = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * a.raio * espalho
      const base = new THREE.Vector3(cx + Math.cos(ang) * d, cy + (rnd() - 0.45) * a.raio * alturaDaCopa, cz + Math.sin(ang) * d * 0.8)
      const tamanho = a.raio * (0.9 + rnd() * 0.45)
      sprite.scale.set(tamanho, tamanho, 1)
      sprite.position.copy(base)
      scene.add(sprite)
      folhas.push({ sprite, base, fase: rnd() * Math.PI * 2 })
    }
  }
  // Raminhos soltos na borda da copa grande, do lado do sol: emolduram o sol no fim do olhar.
  for (const [dx, dy, dz, tamanho] of [
    [-2.2, -0.6, -1.0, 1.5],
    [-2.6, 0.9, -0.6, 1.1],
    [-1.6, -1.7, -0.3, 1.3],
  ]) {
    const tex = texFolhagem.clone()
    texturas.push(tex)
    tex.repeat.set(0.5, 1)
    tex.offset.set(0.5, 0)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false }))
    const [cx, cy, cz] = ARVORES[0].copa
    const base = new THREE.Vector3(cx + dx, cy + dy, cz + dz)
    sprite.scale.set(tamanho, tamanho, 1)
    sprite.position.copy(base)
    scene.add(sprite)
    folhas.push({ sprite, base, fase: rnd() * Math.PI * 2 })
  }
  function balancarCopas(t: number) {
    const forca = reduzirMovimento ? 0.35 : 1
    const ritmo = reduzirMovimento ? 0.5 : 1
    const rajada = 0.5 + 0.5 * rajadaEm(t)
    for (const f of folhas) {
      f.sprite.position.set(
        f.base.x + Math.sin(t * 1.3 * ritmo + f.fase) * 0.07 * forca * rajada,
        f.base.y + Math.sin(t * 1.7 * ritmo + f.fase * 1.3) * 0.04 * forca * rajada,
        f.base.z,
      )
    }
    // As manchas de luz no chão tremem junto com as folhas.
    texSombra.offset.set(Math.sin(t * 1.3 * ritmo) * 0.004 * forca, Math.sin(t * 1.1 * ritmo + 1) * 0.003 * forca)
  }

  // --- Sol: disco, halo, raios e fantasmas --------------------------------------
  const texDisco = textura(
    pintar(128, 128, (g) =>
      pintarBrilho(g, [
        [0, 'rgba(255,255,255,1)'],
        [0.2, 'rgba(255,253,242,1)'],
        [0.34, 'rgba(255,238,196,0.55)'],
        [0.62, 'rgba(255,214,150,0.12)'],
        [1, 'rgba(255,200,130,0)'],
      ]),
    ),
  )
  const texHalo = textura(
    pintar(128, 128, (g) =>
      pintarBrilho(g, [
        [0, 'rgba(255,250,236,1)'],
        [0.14, 'rgba(255,240,206,0.72)'],
        [0.38, 'rgba(255,222,172,0.26)'],
        [0.72, 'rgba(255,210,150,0.06)'],
        [1, 'rgba(255,205,145,0)'],
      ]),
    ),
  )
  const aditivo = (map: Three.Texture, depthTest: boolean) =>
    new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false, depthTest, fog: false, transparent: true })
  const disco = new THREE.Sprite(aditivo(texDisco, true))
  disco.renderOrder = 5
  const halo = new THREE.Sprite(aditivo(texHalo, false))
  halo.renderOrder = 6
  const raios = new THREE.Sprite(aditivo(textura(pintar(512, 512, pintarRaios)), false))
  raios.name = 'raios'
  raios.renderOrder = 7
  scene.add(disco, halo, raios)
  // Calor de fim de tarde: um brilho largo e quente vindo do sol, que fica logo acima do quadro enquanto anda.
  const calor = new THREE.Sprite(aditivo(texHalo, false))
  calor.material.color.setHex(0xffb870)
  calor.renderOrder = 4
  calor.scale.setScalar(300)
  scene.add(calor)

  const texFantasma = textura(pintar(128, 128, pintarFantasma))
  const geoFantasma = new THREE.PlaneGeometry(1, 1)
  const fantasmas = FANTASMAS.map((f) => {
    const malha = new THREE.Mesh(
      geoFantasma,
      new THREE.MeshBasicMaterial({ map: texFantasma, color: f.cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }),
    )
    malha.renderOrder = 8
    malha.rotation.z = 0.3
    camera.add(malha)
    return { malha, ...f }
  })

  // O branco: um plano colado na frente da câmera, dentro da cena.
  const branco = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }),
  )
  branco.name = 'branco'
  branco.position.z = -0.5
  branco.renderOrder = 20
  branco.visible = false
  camera.add(branco)

  // O fundo das variações entra por último e com semente própria: o `rnd` da cena não anda, e com
  // 'nenhum' nada é criado (a aprovada continua pixel a pixel igual).
  const paisagem = fundo === 'nenhum' ? null : montarPaisagem(THREE, { fundo, scene, textura, pintar, sol: solDir, reduzirMovimento })

  const solNoCeu = new THREE.Vector3()
  const solNaTela = new THREE.Vector3()

  function atualizar(t: number) {
    const e = estadoDoCampo(t, reduzirMovimento)
    camera.position.set(e.x, e.y, e.z)
    camera.rotation.set(e.inclinacao, e.guinada, e.rolagem, 'YXZ')
    camera.updateMatrixWorld()

    // Céu, nuvens e sol ficam no infinito: andam junto com a câmera.
    ceu.position.copy(camera.position)
    horizonte.position.x = camera.position.x
    horizonte.position.z = camera.position.z
    for (const n of nuvens) n.sprite.position.copy(camera.position).addScaledVector(n.dir, DISTANCIA_DO_CEU)
    solNoCeu.copy(camera.position).addScaledVector(solDir, DISTANCIA_DO_CEU)
    disco.position.copy(solNoCeu)
    halo.position.copy(solNoCeu)
    raios.position.copy(solNoCeu)
    calor.position.copy(solNoCeu)

    balancarCapim(t)
    balancarCopas(t)
    paisagem?.atualizar(t)

    // Saindo da sombra da copa, o sol aparece na borda das folhas e o brilho cresce.
    const saindoDaSombra = easeInOutSine(span(t, 1.8, 3.6))
    const s = e.sol
    materialDoCeu.uniforms.uBrilho.value = s
    disco.scale.setScalar(15 + 40 * s)
    halo.scale.setScalar(80 + 1500 * s * s)
    halo.material.opacity = 0.18 * saindoDaSombra + 0.32 * e.olhar + 0.5 * s
    // Cintilar lento (de anime), não estrobo; reduzido, os raios ficam parados.
    const tremor = reduzirMovimento ? 1 : 0.92 + 0.08 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1)
    raios.scale.setScalar(130 + 760 * s)
    raios.material.opacity = (0.2 + 0.8 * s) * clamp01(e.olhar * 1.4) * tremor
    raios.material.rotation = reduzirMovimento ? 0.3 : 0.3 + t * 0.05

    // Fantasmas na linha do sol pelo centro da tela, só com o sol à vista.
    solNaTela.copy(solNoCeu).project(camera)
    const longe = Math.max(Math.abs(solNaTela.x), Math.abs(solNaTela.y))
    const naTela = solNaTela.z < 1 ? 1 - clamp01((longe - 0.85) / 0.4) : 0
    const meiaAltura = Math.tan((camera.fov * Math.PI) / 360)
    const flare = naTela * (0.35 + 0.65 * s) * (1 - e.branco)
    for (const f of fantasmas) {
      f.malha.position.set(solNaTela.x * f.k * meiaAltura * camera.aspect, solNaTela.y * f.k * meiaAltura, -1)
      f.malha.scale.setScalar(f.tamanho * meiaAltura * 2)
      f.malha.material.opacity = f.alfa * flare
      f.malha.visible = flare > 0.001
    }

    calor.material.opacity = 0.3 * (1 - e.branco)
    branco.material.opacity = e.branco
    branco.visible = e.branco > 0
    return { fade: e.fade }
  }

  function ajustarTela(aspecto: number) {
    camera.aspect = aspecto
    camera.fov = aspecto < 0.8 ? 66 : 50
    camera.updateProjectionMatrix()
  }

  return {
    scene,
    camera,
    atualizar,
    ajustarTela,
    criarSom: (kit: KitDeSom) => somDoCampo(kit),
    descartar: () => {
      cerca.dispose()
      descartarCena(scene)
      for (const tex of texturas) tex.dispose()
    },
  }
}

/** A cena do campo com o fundo escolhido; cada animação do pacote é um `export default criarCampo(...)`. */
export function criarCampo(fundo: FundoDoCampo): CriarCena {
  return (THREE, opcoes) => montarCampo(THREE, opcoes, fundo)
}

// ---------------------------------------------------------------------------
// Som
// ---------------------------------------------------------------------------

/**
 * Ganho da mixagem inteira: põe o campo no volume das transições aprovadas
 * (conferido com scripts/conferir-som.cjs) e o pico verdadeiro abaixo de -1 dBTP.
 */
const MIXAGEM = 1.75
const VENTO = 0.2
const PASSO = 0.62
const PASSAROS = 0.11
const BRILHO_TONAL = 0.05
const BRILHO_DE_AR = 0.05
const PING = 0.05
/** O mundo (vento, pássaros) some debaixo do clarão. */
function mundoEm(t: number): number {
  return 1 - 0.85 * easeInOutSine(span(t, 5.3, 6.35))
}
/** O brilho agudo cresce com o sol e segura no branco. */
function brilhoDoSomEm(t: number): number {
  return easeInQuad(span(t, 5.0, 6.35))
}
/** Entra com o fade e sai antes do fim: o motor fecha o som em 7 s e não pode cortar nada. */
function envelopeGeralEm(t: number): number {
  return easeInOutSine(span(t, 0, 0.45)) * (1 - easeInOutSine(span(t, 6.45, 6.92)))
}

interface Nota {
  dt: number
  f0: number
  f1: number
  dur: number
  vol: number
}

/** Pássaros ao longe: frases curtas de 2 a 4 piados, cada uma de um lado. */
function cantosDosPassaros(): { em: number; pan: number; notas: Nota[] }[] {
  const rnd = semente(5051)
  return [0.55, 1.45, 2.4, 3.15, 4.35, 4.95].map((em, i) => {
    const n = 2 + Math.floor(rnd() * 3)
    const base = 3300 + rnd() * 1500
    const notas: Nota[] = []
    let dt = 0
    for (let j = 0; j < n; j++) {
      const f0 = base * (0.9 + rnd() * 0.25)
      const f1 = rnd() < 0.6 ? f0 * (1.22 + rnd() * 0.25) : f0 * (0.7 + rnd() * 0.1)
      const dur = 0.05 + rnd() * 0.07
      notas.push({ dt, f0, f1, dur, vol: 0.7 + rnd() * 0.3 })
      dt += dur + 0.045 + rnd() * 0.08
    }
    return { em, pan: (i % 2 === 0 ? -1 : 1) * (0.3 + rnd() * 0.4), notas }
  })
}

/** Cintilas do clarão: notas agudas cada vez mais juntas (3/s a 18/s) e mais altas no tom. */
function cintilas(): { em: number; f: number; pan: number; vol: number }[] {
  const rnd = semente(7177)
  const escala = [2093, 2349, 2637, 3136, 3520, 4186, 4699, 5274, 6272]
  const lista: { em: number; f: number; pan: number; vol: number }[] = []
  let t = 5.05
  while (t < 6.42) {
    const p = span(t, 5.05, 6.42)
    const i = Math.min(escala.length - 1, Math.floor((0.25 + 0.75 * p) * rnd() * escala.length + p * 2))
    lista.push({ em: t, f: escala[i], pan: (rnd() - 0.5) * 1.1, vol: 0.45 + 0.55 * p })
    t += (0.6 + rnd() * 0.8) / (3 + 15 * p * p)
  }
  return lista
}

/** Grão de passo na terra: estalinhos de cascalho, densos no calcanhar e de novo na planta do pé. */
function passoNaTerra(ctx: BaseAudioContext, k: number): AudioBuffer {
  const taxa = ctx.sampleRate
  const n = Math.ceil(taxa * 0.24)
  const buffer = ctx.createBuffer(1, n, taxa)
  const dados = buffer.getChannelData(0)
  const rnd = semente(3301 + k * 977)
  for (let g = 0; g < 72; g++) {
    const em = g < 44 ? rnd() * rnd() * 0.09 : 0.05 + rnd() * 0.12
    const dur = 0.0015 + rnd() * 0.004
    const amp = (0.25 + rnd() * 0.75) * Math.exp(-em * 13)
    const i0 = Math.floor(em * taxa)
    const i1 = Math.min(n, i0 + Math.max(2, Math.floor(dur * taxa)))
    for (let i = i0; i < i1; i++) {
      const u = (i - i0) / (i1 - i0)
      dados[i] += (rnd() * 2 - 1) * amp * Math.min(1, u * 12) * Math.exp(-u * 5)
    }
  }
  // Arrasto do pé: um chiado baixo que some.
  for (let i = 0; i < n; i++) {
    const tt = i / taxa
    dados[i] += (rnd() * 2 - 1) * 0.07 * Math.exp(-tt * 20) * Math.min(1, tt * 400)
  }
  let pico = 0
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(dados[i]))
  // Fim em zero: nada de clique no último grão.
  for (let i = 0; i < n; i++) dados[i] = (dados[i] / (pico || 1)) * Math.min(1, (n - 1 - i) / (taxa * 0.01))
  return buffer
}

/**
 * Pistas do som, todas pelo tempo da cena (o motor escala a duração e o som
 * acompanha): passos na terra no vale do balanço, vento no capim seguindo as
 * rajadas, pássaros ao longe e o brilho agudo que cresce com o sol.
 */
function somDoCampo(kit: KitDeSom) {
  const { ctx } = kit
  const mixagem = ctx.createGain()
  mixagem.gain.value = MIXAGEM
  mixagem.connect(kit.destino)
  const geral = ctx.createGain()
  geral.gain.value = 0
  geral.connect(mixagem)
  const mundo = ctx.createGain()
  mundo.gain.value = 1
  mundo.connect(geral)

  // Vento: duas camadas de ruído em faixas diferentes, uma de cada lado, e um grave por baixo.
  const ruido = kit.ruido(2)
  const vento = ctx.createGain()
  vento.gain.value = 0
  vento.connect(mundo)
  const camadas = [
    { tipo: 'bandpass' as BiquadFilterType, freq: 1050, q: 0.55, pan: -0.55, ganho: 1, inicio: 0 },
    { tipo: 'bandpass' as BiquadFilterType, freq: 1750, q: 0.6, pan: 0.55, ganho: 0.8, inicio: 0.9 },
    { tipo: 'lowpass' as BiquadFilterType, freq: 260, q: 0.7, pan: 0, ganho: 0.6, inicio: 1.4 },
  ].map((c) => {
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruido
    fonte.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = c.tipo
    filtro.frequency.value = c.freq
    filtro.Q.value = c.q
    const ganho = ctx.createGain()
    ganho.gain.value = c.ganho
    const pan = ctx.createStereoPanner()
    pan.pan.value = c.pan
    fonte.connect(filtro).connect(ganho).connect(pan).connect(vento)
    return { fonte, filtro, freq: c.freq, inicio: c.inicio }
  })

  // Brilho do sol: acorde agudo com batimento (pares levemente desafinados) e um ar chiado por cima.
  const brilho = ctx.createGain()
  brilho.gain.value = 0
  brilho.connect(geral)
  const tremolo = ctx.createGain()
  tremolo.gain.value = 0.75
  tremolo.connect(brilho)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 6.5
  const profundidade = ctx.createGain()
  profundidade.gain.value = 0.25
  lfo.connect(profundidade).connect(tremolo.gain)
  const tons = [2093, 2637, 3136, 3951, 4699].flatMap((f, i) =>
    [1, 1.004].map((d) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * d
      const g = ctx.createGain()
      g.gain.value = [1, 0.8, 0.65, 0.45, 0.3][i] * 0.5
      o.connect(g).connect(tremolo)
      return o
    }),
  )
  const ar = ctx.createGain()
  ar.gain.value = 0
  ar.connect(geral)
  const arFonte = ctx.createBufferSource()
  arFonte.buffer = ruido
  arFonte.loop = true
  const arFiltro = ctx.createBiquadFilter()
  arFiltro.type = 'highpass'
  arFiltro.frequency.value = 6500
  arFonte.connect(arFiltro).connect(ar)
  const cintilasBus = ctx.createGain()
  cintilasBus.gain.value = 1
  cintilasBus.connect(geral)

  const graos = Array.from({ length: PASSOS + 1 }, (_, k) => passoNaTerra(ctx, k))
  const cantos = cantosDosPassaros()
  const notasDoBrilho = cintilas()

  function tocarPasso(at: number, k: number) {
    const nivel = k === PASSOS ? 0.72 : 1
    const pan = ctx.createStereoPanner()
    pan.pan.value = k % 2 === 0 ? -0.12 : 0.12
    pan.connect(mundo)
    const fonte = ctx.createBufferSource()
    fonte.buffer = graos[k]
    const banda = ctx.createBiquadFilter()
    banda.type = 'bandpass'
    banda.frequency.value = 1500 + (k % 3) * 160
    banda.Q.value = 0.55
    const volume = ctx.createGain()
    volume.gain.value = PASSO * nivel
    fonte.connect(banda).connect(volume).connect(pan)
    fonte.start(at)
    // Baque surdo do calcanhar na terra.
    const baque = ctx.createOscillator()
    baque.type = 'sine'
    baque.frequency.setValueAtTime(94, at)
    baque.frequency.exponentialRampToValueAtTime(50, at + 0.1)
    const corpo = ctx.createGain()
    corpo.gain.setValueAtTime(0.0001, at)
    corpo.gain.exponentialRampToValueAtTime(0.28 * nivel, at + 0.01)
    corpo.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
    baque.connect(corpo).connect(pan)
    baque.start(at)
    baque.stop(at + 0.18)
  }

  function tocarCanto(at: number, canto: { pan: number; notas: Nota[] }) {
    const pan = ctx.createStereoPanner()
    pan.pan.value = canto.pan
    const longe = ctx.createBiquadFilter()
    longe.type = 'lowpass'
    longe.frequency.value = 6200
    longe.connect(pan).connect(mundo)
    for (const n of canto.notas) {
      const t0 = at + n.dt
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(n.f0, t0)
      o.frequency.exponentialRampToValueAtTime(n.f1, t0 + n.dur)
      const v = ctx.createGain()
      v.gain.setValueAtTime(0.0001, t0)
      v.gain.exponentialRampToValueAtTime(PASSAROS * n.vol, t0 + 0.012)
      v.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur)
      o.connect(v).connect(longe)
      o.start(t0)
      o.stop(t0 + n.dur + 0.02)
    }
  }

  function tocarCintila(at: number, c: { f: number; pan: number; vol: number }) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = c.f
    const v = ctx.createGain()
    v.gain.setValueAtTime(0.0001, at)
    v.gain.exponentialRampToValueAtTime(PING * c.vol, at + 0.004)
    v.gain.exponentialRampToValueAtTime(0.0001, at + 0.45)
    const pan = ctx.createStereoPanner()
    pan.pan.value = c.pan
    o.connect(v).connect(pan).connect(cintilasBus)
    o.start(at)
    o.stop(at + 0.47)
  }

  /** Corre o parâmetro para o alvo só quando o alvo muda (arredondado): poucas automações por segundo. */
  const ultimos = new Map<AudioParam, number>()
  function levar(param: AudioParam, alvo: number, constante: number, casas = 1000) {
    const a = Math.round(alvo * casas) / casas
    if (ultimos.get(param) === a) return
    ultimos.set(param, a)
    param.setTargetAtTime(a, ctx.currentTime, constante)
  }

  let ligado = false
  let ultimoPasso = 0
  let proximoCanto = 0
  let proximaCintila = 0
  return {
    atualizar(t: number) {
      if (!ligado) {
        ligado = true
        const agora = ctx.currentTime
        for (const c of camadas) c.fonte.start(agora, c.inicio)
        arFonte.start(agora, 0.37)
        lfo.start(agora)
        for (const o of tons) o.start(agora)
      }
      levar(geral.gain, envelopeGeralEm(t), 0.04)
      levar(mundo.gain, mundoEm(t), 0.08)
      const rajada = rajadaEm(t)
      levar(vento.gain, VENTO * (0.45 + 0.55 * rajada), 0.18)
      for (const c of camadas) levar(c.filtro.frequency, c.freq * (0.82 + 0.4 * rajada), 0.25, 1)
      const b = brilhoDoSomEm(t)
      levar(brilho.gain, BRILHO_TONAL * b, 0.08)
      levar(ar.gain, BRILHO_DE_AR * b, 0.1)

      const k = Math.floor(faseEm(t))
      if (k > ultimoPasso && k >= 1 && k <= PASSOS) {
        ultimoPasso = k
        tocarPasso(ctx.currentTime, k)
      }
      while (proximoCanto < cantos.length && t >= cantos[proximoCanto].em) tocarCanto(ctx.currentTime, cantos[proximoCanto++])
      while (proximaCintila < notasDoBrilho.length && t >= notasDoBrilho[proximaCintila].em) tocarCintila(ctx.currentTime, notasDoBrilho[proximaCintila++])
    },
    reiniciar: () => {
      ultimoPasso = 0
      proximoCanto = 0
      proximaCintila = 0
      ultimos.clear()
    },
  }
}

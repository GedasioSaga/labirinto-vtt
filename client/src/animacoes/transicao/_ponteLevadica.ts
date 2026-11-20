import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'
import { descartarCena, semente } from '../../transicoes/texturas'

/*
 * PONTE LEVADIÇA (protótipo de transição de viagem, pedido de 20/11/2026):
 * "alguém passando por uma ponte levadiça indo e vindo do castelo à tarde".
 * Ajuste do dono no mesmo dia: "faz a transição sendo em primeira pessoa como
 * em resident evil". Duas versões de 4,8 s, mesma cena e mesmo sol baixo:
 *
 * - "entrando": a câmera é quem anda, na altura dos olhos, da estrada para a
 *   ponte e para dentro do portão. O arco e as correntes vêm chegando, o pátio
 *   claro aparece no fim da passagem escura. O sol vem de trás e doura a pedra.
 * - "saindo": a câmera sai da passagem escura (a tocha passa ao lado), cruza a
 *   ponte entre as correntes rumo ao sol e chega à beira do campo.
 *
 * O passo balança de leve (sobe e desce a cada pé, pende de lado a cada dois),
 * como nas portas e escadas do Resident Evil. Com movimento reduzido não há
 * balanço: só um avanço liso e curto. No fim o nome do lugar sobe devagar no
 * terço de baixo (`opcoes.nome`; sem nome, sem placa) e o motor fecha em preto.
 * Estilo Meio-Termo (docs/design/ESTILO-DO-RPG.md): pintura por código e
 * determinística, cores contidas, contorno no tom escuro da própria cor nas
 * copas, sombra suave. Tudo é função do tempo `t`: a miniatura é sempre o
 * mesmo quadro e o motor pode escalar a duração.
 */

export type Sentido = 'entrando' | 'saindo'

/** Roteiro em segundos (o motor fecha em preto no fim). */
export const ROTEIRO_DA_PONTE = {
  duracao: 4.8,
  claroFim: 0.45,
  nomeInicio: 3.0,
  nomeCheio: 3.55,
  escuroInicio: 4.3,
  escuroFim: 4.8,
} as const
const T = ROTEIRO_DA_PONTE

/**
 * Passo de quem olha: 2,25 m/s e 85 cm por passo (~2,6 passos por segundo), passo decidido de quem
 * tem 4,8 s para cruzar. Com movimento reduzido: 0,45 m/s, passos curtos e lentos, sem balanço.
 */
const ANDAR = {
  normal: { velocidade: 2.25, passada: 0.85 },
  reduzido: { velocidade: 0.45, passada: 0.5 },
} as const
/** Onde os olhos estão em t = 0 (z) e para onde andam. */
const PARTIDA: Record<Sentido, { normal: number; reduzido: number }> = {
  // Da estrada, com o castelo inteiro à frente, até 1,8 m dentro da passagem (cruza o arco aos 4,0 s).
  entrando: { normal: 9.0, reduzido: 6.0 },
  // Do fundo da passagem (o arco claro recortado à frente, a tocha passa ao lado) até o fim da ponte.
  // Reduzido: fica dentro da passagem, chegando devagar ao arco claro (as paredes escuras emolduram).
  saindo: { normal: -5.2, reduzido: -2.6 },
}
const RUMO: Record<Sentido, number> = { entrando: -1, saindo: 1 }
/** Altura dos olhos acima do piso (m). */
const OLHOS = 1.62
/** Balanço do passo: altura (m) a cada pé, lado (m) e giro (rad) a cada dois. Sutil de propósito. */
const BALANCO = { altura: 0.026, lado: 0.016, giro: 0.0055 }
/** Inclinação do olhar (rad, + para cima) no começo e no fim do caminho. */
const OLHAR: Record<Sentido, { de: number; ate: number; reduzido: number }> = {
  // Começa erguido para ler o arco e as torres; nivela ao chegar no portão.
  entrando: { de: 0.11, ate: 0.02, reduzido: 0.07 },
  // Começa erguido para o arco claro caber inteiro; baixa para a ponte e o campo, e o nome cabe embaixo.
  saindo: { de: 0.06, ate: -0.06, reduzido: 0.0 },
}

/** Medidas em metros. A fachada da guarita fica em z = 0, virada para +z (o lado de fora). */
/** `topo`: o tabuleiro fica um palmo acima do gramado, sem brigar com ele onde assenta na margem. */
const PONTE = { meiaLargura: 1.5, fim: 5.75, espessura: 0.3, topo: 0.035 }
const AGUA_Y = -1.0
const BASE_Y = -1.7
const MARGEM_Z = 5.0
/** A margem de fora desce em talude de grama até a água; o aterro da ponte fica plano. */
const TALUDE = { fundo: -0.85, inicio: 8.5, aterro: 2.3, aterroFim: 4.6 }
function taludeEm(x: number, z: number): number {
  const suave = (a: number, b: number, v: number) => {
    const u = clamp01((v - a) / (b - a))
    return u * u * (3 - 2 * u)
  }
  return TALUDE.fundo * suave(TALUDE.inicio, MARGEM_Z, z) * suave(TALUDE.aterro, TALUDE.aterroFim, Math.abs(x))
}
const VAO = { meiaLargura: 1.4, alturaReta: 3.2 }
const GUARITA = { meiaLargura: 4.2, topo: 9.4, fundo: 6 }
const TORRE = { x: 5.5, z: -1.2, raio: 2.3, topo: 12 }
const CORTINA = { frente: -1.2, topo: 6.7, fim: 41 }
const CORRENTE = { elo: 0.14, flecha: 0.22 }
/** Pátio de dentro: laje até a muralha de dentro (frente em z = -21), com o segundo portão no meio. */
const PATIO = { fundo: -44, muralha: -21, espessura: 2, topo: 7.4, vao: 1.3, vaoReto: 2.6 }
const MENAGEM = { x: -6.5, z: -33 }

/**
 * Sol baixo de fim de tarde, apagado pela névoa: azimute a partir de +z rumo a -x, elevação (rad).
 * Força baixa e cor pálida: a sombra fica mansa e o céu quase não doura.
 */
const SOL: Record<Sentido, { azimute: number; elevacao: number; cor: number; forca: number }> = {
  // Entrando: o sol vem de trás da câmera, à esquerda.
  entrando: { azimute: 0.8, elevacao: 0.22, cor: 0xdcd4c8, forca: 1.05 },
  // Saindo: o sol fica à frente, um pouco à direita: um brilho difuso dentro da névoa, no arco.
  saindo: { azimute: 0.2, elevacao: 0.2, cor: 0xead6c0, forca: 1.1 },
}

/**
 * Recorte da sombra do sol (câmera ortográfica, metros). No Entrando ele cobre também o pátio de dentro:
 * com o sol baixo atrás de quem chega, a guarita e as muralhas deixam o pátio na sombra, e o pátio fica
 * em contraluz contra a névoa clara. No Saindo o pátio fica às costas.
 */
const SOMBRA: Record<Sentido, { alvo: [x: number, z: number]; meiaLargura: number }> = {
  entrando: { alvo: [-11, -9], meiaLargura: 25 },
  saindo: { alvo: [0, 2.5], meiaLargura: 15 },
}

/**
 * Névoa do vale (exponencial ao quadrado): a ponte e as correntes ficam nítidas, o campo vai
 * apagando, e árvore a 60 m é só vulto. A cor é a mesma do horizonte do céu, para nada recortar.
 */
const NEVOA = { cor: 0x8f918d, densidade: 0.038 } as const
/** Névoa rasteira: camadas deitadas sobre o campo e o pátio, longe da ponte. */
const NEVOEIRO_BAIXO = { cor: 0xa3a5a1, deriva: 0.35 } as const

/** Campo de visão de olho (vertical, graus): ~84° na horizontal em 16:9. */
const FOV = 54
/** Em tela estreita o campo de visão abre até manter ~66° na horizontal (teto 80°). */
const FOV_HORIZONTAL_MIN = 66
const FOV_MAX = 80

const NOME_MAX_LETRAS = 28
/** A fonte de título do app (`--lb-font-display`), a mesma das aberturas de batalha. */
const FONTE_DO_NOME = "'Sitka Banner', 'Sitka Display', Constantia, Georgia, 'Times New Roman', serif"

// ---------------------------------------------------------------------------
// Movimento (funções puras: o som, o teste e o gráfico leem sem desenhar)
// ---------------------------------------------------------------------------

const andarDe = (reduzir: boolean) => (reduzir ? ANDAR.reduzido : ANDAR.normal)

/** Onde os olhos estão no eixo da ponte (z) no instante `t`. */
export function zDosOlhos(t: number, s: Sentido, reduzir: boolean): number {
  return PARTIDA[s][reduzir ? 'reduzido' : 'normal'] + RUMO[s] * andarDe(reduzir).velocidade * t
}

/** Fase do passo: avança π a cada passo; o pé assenta em π/2 + kπ (é quando a cabeça está mais baixa). */
export function faseDoPasso(t: number, reduzir: boolean): number {
  const { velocidade, passada } = andarDe(reduzir)
  return (Math.PI * velocidade * t) / passada
}

/** Instantes em que um pé assenta, dentro da cena. */
export function passosDosOlhos(reduzir: boolean): number[] {
  const { velocidade, passada } = andarDe(reduzir)
  const tempos: number[] = []
  for (let k = 0; ; k++) {
    const t = (passada * (k + 0.5)) / velocidade
    if (t >= T.escuroFim) break
    tempos.push(t)
  }
  return tempos
}

export type Piso = 'pedra' | 'madeira' | 'terra'
export function pisoEm(z: number): Piso {
  if (z < -0.05) return 'pedra'
  if (z <= PONTE.fim) return 'madeira'
  return 'terra'
}

/** 0 = cena visível, 1 = preto. Entra rápido do preto e fecha devagar no fim. */
export function fadeDaPonte(t: number): number {
  if (t < T.claroFim) return 1 - easeOutCubic(span(t, 0, T.claroFim))
  return easeInOutSine(span(t, T.escuroInicio, T.escuroFim))
}

/** Placa do nome: 0 a 1. */
export function nomeEm(t: number): number {
  return easeOutCubic(span(t, T.nomeInicio, T.nomeCheio))
}

export interface Olhos {
  pos: [number, number, number]
  olhar: [number, number, number]
  /** Giro em volta do eixo do olhar (rad). */
  giro: number
}

/** Onde a câmera (os olhos) está e para onde olha. Sem balanço com movimento reduzido. */
export function olhosEm(t: number, s: Sentido, reduzir: boolean): Olhos {
  const z = zDosOlhos(t, s, reduzir)
  const piso = pisoEm(z) === 'madeira' ? PONTE.topo : 0
  const fase = faseDoPasso(t, reduzir)
  const b = reduzir ? 0 : 1
  // Cabeça mais baixa quando o pé assenta (π/2 + kπ), mais alta no meio da passada; pende para o pé de apoio.
  const y = piso + OLHOS + b * BALANCO.altura * Math.cos(2 * fase)
  const x = b * BALANCO.lado * Math.sin(fase)
  const o = OLHAR[s]
  const inclinacao = reduzir ? o.reduzido : o.de + (o.ate - o.de) * easeInOutSine(span(t, 0, 3.6))
  const longe = 10
  return {
    pos: [x, y, z],
    // O olhar mira o eixo da ponte lá na frente: o corpo pende e a cabeça compensa, como gente.
    olhar: [0, y + Math.tan(inclinacao) * longe, z + RUMO[s] * longe],
    giro: b * BALANCO.giro * Math.sin(fase),
  }
}

/** Quanto do passo ecoa: cheio dentro da passagem de pedra, um pouco junto da fachada. */
function ecoEm(z: number): number {
  return clamp01(clamp01(-z / 2.2) * 0.9 + 0.25 * clamp01(1 - Math.abs(z) / 3))
}

/** O que se ouve do próprio passo: piso de onde o pé assenta, um pé de cada lado, eco pela passagem. */
export function escutaDoPasso(t: number, k: number, s: Sentido, reduzir: boolean): { volume: number; pan: number; piso: Piso; eco: number } {
  const z = zDosOlhos(t, s, reduzir)
  return { volume: reduzir ? 0.7 : 0.8, pan: k % 2 === 0 ? -0.12 : 0.12, piso: pisoEm(z), eco: ecoEm(z) }
}

/** Espaços juntados, até 28 letras (sem partir emoji ao meio); `''` = sem nome. */
export function nomeDoLugar(nome: string | undefined): string {
  const limpo = (nome ?? '').replace(/\s+/g, ' ').trim()
  return Array.from(limpo).slice(0, NOME_MAX_LETRAS).join('')
}

// ---------------------------------------------------------------------------
// Pintura (canvas, determinística)
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number]

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  // Canvas na CPU: subir para a placa vira cópia de memória, sem ler de volta da GPU (o 1º quadro a frio caía de ~140 ms de texturas).
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('canvas 2D indisponível')
  return [canvas, g]
}

function rgb([r, g, b]: Rgb, fator = 1, alfa = 1): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v * fator)))
  return `rgba(${c(r)},${c(g)},${c(b)},${alfa})`
}

/** Cor dada em sRGB, guardada linear: o motor desliga o gerenciamento e a saída em sRGB devolve o tom exato. */
function corLinear(THREE: ThreeModule, hex: number): Three.Color {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace).convertSRGBToLinear()
}

/** Pedra antiga, cinza morno e pouco saturado, para casar com o vale de névoa. */
const PEDRA: Rgb = [160, 158, 150]
/** O ladrilho de pedra cobre 5 m: fiadas de 62 cm, blocos de 0,8 a 1,5 m. */
const UV_DA_PEDRA = 1 / 5
/** Força do relevo da cantaria (bumpMap tirado da própria cor). */
const RELEVO_DA_PEDRA = 2

/**
 * Cantaria antiga: blocos de tom desigual e contorno irregular (quinas gastas, arestas comidas), junta
 * funda e escura (nunca preta), uma ou outra trinca, manchas grandes de sujeira, umidade escorrendo das
 * juntas e musgo nas arestas de baixo. Cinza morno, pouco saturado. 512 px = 5 m.
 */
function pintarPedra(rnd: () => number): HTMLCanvasElement {
  const [canvas, g] = tela(512, 512)
  g.fillStyle = rgb(PEDRA, 0.44)
  g.fillRect(0, 0, 512, 512)
  const fiada = 64
  const junta = 2.2
  const bloco = (x: number, y: number, largura: number, cor: Rgb, sementeDoBloco: number) => {
    const r = semente(sementeDoBloco)
    const x0 = x + junta
    const y0 = y + junta
    const x1 = x + largura - junta
    const y1 = y + fiada - junta
    // Contorno: cada quina vira dois pontos (gasta) e cada aresta ganha um ponto torto no meio.
    const gasto = () => 2 + r() * 6
    const torto = () => (r() - 0.3) * 2.6
    const pontos: [number, number][] = [
      [x0 + gasto(), y0 + torto()],
      [(x0 + x1) / 2, y0 + torto()],
      [x1 - gasto(), y0 + torto()],
      [x1 + torto() * -1, y0 + gasto()],
      [x1 - torto(), (y0 + y1) / 2],
      [x1 - torto(), y1 - gasto()],
      [x1 - gasto(), y1 - torto()],
      [(x0 + x1) / 2, y1 - torto()],
      [x0 + gasto(), y1 - torto()],
      [x0 + torto(), y1 - gasto()],
      [x0 + torto(), (y0 + y1) / 2],
      [x0 + torto(), y0 + gasto()],
    ]
    g.beginPath()
    pontos.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)))
    g.closePath()
    // Face levemente abaulada: clara em cima, mais escura embaixo (o relevo sai da cor).
    const face = g.createLinearGradient(0, y0, 0, y1)
    face.addColorStop(0, rgb(cor, 1.08))
    face.addColorStop(0.5, rgb(cor))
    face.addColorStop(1, rgb(cor, 0.8))
    g.fillStyle = face
    g.fill()
    // Manchas miúdas do próprio bloco.
    for (let k = 0; k < 26; k++) {
      g.fillStyle = rgb(cor, 0.8 + r() * 0.32, 0.28)
      g.fillRect(x0 + 3 + r() * (x1 - x0 - 9), y0 + 3 + r() * (y1 - y0 - 7), 2 + r() * 7, 1 + r() * 3)
    }
    // Trinca fina num bloco ou outro.
    if (r() < 0.22) {
      g.strokeStyle = rgb(PEDRA, 0.42, 0.8)
      g.lineWidth = 1.1
      g.beginPath()
      let cx = x0 + 8 + r() * (x1 - x0 - 16)
      let cy = y0
      g.moveTo(cx, cy)
      while (cy < y1 - 4) {
        cx += (r() - 0.5) * 9
        cy += 4 + r() * 7
        g.lineTo(cx, cy)
      }
      g.stroke()
    }
    // Musgo seco na aresta de baixo de alguns blocos.
    if (r() < 0.3) {
      g.fillStyle = 'rgba(92,100,78,' + (0.22 + r() * 0.22).toFixed(2) + ')'
      for (let k = 0; k < 7; k++) g.fillRect(x0 + r() * (x1 - x0 - 14), y1 - 3 - r() * 5, 6 + r() * 14, 2 + r() * 4)
    }
  }
  for (let y = 0; y < 512; y += fiada) {
    let x = -rnd() * 120
    while (x < 512) {
      const largura = 82 + rnd() * 70
      const tom = 0.64 + rnd() * 0.42
      const frio = (rnd() - 0.5) * 12
      const cor: Rgb = [PEDRA[0] * tom + frio * 0.2, PEDRA[1] * tom + frio * 0.3, PEDRA[2] * tom + frio * 0.7]
      const sementeDoBloco = Math.floor(rnd() * 1e9)
      bloco(x, y, largura, cor, sementeDoBloco)
      // Copia o bloco que passa da borda no outro lado, com a mesma semente: o ladrilho repete sem emenda.
      if (x + largura > 512) bloco(x - 512, y, largura, cor, sementeDoBloco)
      if (x < 0) bloco(x + 512, y, largura, cor, sementeDoBloco)
      x += largura
    }
  }
  // Sujeira em manchas largas (com cópia do outro lado quando passa da borda).
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 512
    const y = rnd() * 512
    const raio = 34 + rnd() * 60
    const forca = (0.12 + rnd() * 0.14).toFixed(2)
    for (const dx of [-512, 0, 512]) {
      for (const dy of [-512, 0, 512]) {
        if (x + dx + raio < 0 || x + dx - raio > 512 || y + dy + raio < 0 || y + dy - raio > 512) continue
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, raio)
        grad.addColorStop(0, 'rgba(52,52,46,' + forca + ')')
        grad.addColorStop(1, 'rgba(52,52,46,0)')
        g.fillStyle = grad
        g.fillRect(x + dx - raio, y + dy - raio, raio * 2, raio * 2)
      }
    }
  }
  // Umidade escorrendo: faixas estreitas e escuras que descem das juntas e somem.
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 512
    const y = Math.floor(rnd() * 8) * fiada + fiada - junta
    const comprimento = 90 + rnd() * 300
    const grad = g.createLinearGradient(0, y, 0, y + comprimento)
    grad.addColorStop(0, 'rgba(56,56,50,' + (0.14 + rnd() * 0.12).toFixed(2) + ')')
    grad.addColorStop(1, 'rgba(56,56,50,0)')
    g.fillStyle = grad
    const largura = 2 + rnd() * 6
    g.fillRect(x, y, largura, comprimento)
    if (y + comprimento > 512) g.fillRect(x, y - 512, largura, comprimento)
  }
  return canvas
}

/** Pedra perto da água fica úmida e mais escura; a cor vai por vértice (o material usa vertexColors). */
function umidade(y: number): number {
  return 0.72 + 0.28 * Math.min(1, Math.max(0, (y + 1.7) / 3.6)) ** 0.8
}

function sujarDeUmidade(THREE: ThreeModule, geo: Three.BufferGeometry, yDaMalha: number): Three.BufferGeometry {
  const pos = geo.getAttribute('position')
  const cores = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + yDaMalha
    const k = umidade(y)
    // Musgo e sujeira na faixa perto do chão e da água: esverdeia e escurece.
    const musgo = clamp01(1 - Math.abs(y - 0.1) / 1.6)
    cores[i * 3] = k * (1 - 0.2 * musgo)
    cores[i * 3 + 1] = k * (1 - 0.06 * musgo) * 0.98
    cores[i * 3 + 2] = k * (1 - 0.26 * musgo) * 0.97
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  return geo
}

/** Tábuas atravessadas do tabuleiro (3 m × 5,75 m), cintas de ferro, cravos. */
function pintarTabuleiro(rnd: () => number): HTMLCanvasElement {
  const [canvas, g] = tela(512, 1024)
  const tabuas = 24
  const altura = 1024 / tabuas
  g.fillStyle = 'rgb(70,50,37)'
  g.fillRect(0, 0, 512, 1024)
  for (let i = 0; i < tabuas; i++) {
    const y = i * altura
    const tom = 0.88 + rnd() * 0.18
    const base: Rgb = [136 * tom, 110 * tom, 86 * tom]
    g.fillStyle = rgb(base)
    g.fillRect(0, y + 2, 512, altura - 3)
    for (let k = 0; k < 9; k++) {
      g.strokeStyle = rgb(base, 0.78, 0.35)
      g.lineWidth = 1 + rnd() * 1.4
      g.beginPath()
      const yy = y + 4 + rnd() * (altura - 8)
      g.moveTo(0, yy)
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, yy + Math.sin(x / 70 + k + i) * 1.6)
      g.stroke()
    }
    g.fillStyle = rgb(base, 1.08, 0.5)
    g.fillRect(0, y + 2, 512, 2)
  }
  for (const u of [0.11, 0.89]) {
    const x = u * 512 - 10
    g.fillStyle = 'rgb(74,66,62)'
    g.fillRect(x, 0, 20, 1024)
    g.fillStyle = 'rgba(120,108,100,0.6)'
    g.fillRect(x, 0, 20, 2)
    for (let i = 0; i < tabuas; i++) {
      g.fillStyle = 'rgb(52,46,44)'
      g.beginPath()
      g.arc(x + 10, i * altura + altura / 2, 3.2, 0, Math.PI * 2)
      g.fill()
    }
  }
  return canvas
}

/** Grama seca e cinza de vale com névoa, sem repetir: manchas grandes, poucas flores murchas. 60 × 50 m. */
function pintarGramado(rnd: () => number): HTMLCanvasElement {
  const [canvas, g] = tela(1024, 1024)
  g.fillStyle = 'rgb(106,108,96)'
  g.fillRect(0, 0, 1024, 1024)
  const tons: Rgb[] = [
    [92, 96, 84],
    [128, 126, 108],
    [116, 110, 92],
    [80, 86, 78],
  ]
  // Manchas médias: com a névoa, mancha enorme não aparece e custa caro pintar (canvas em CPU).
  for (let i = 0; i < 200; i++) {
    const x = rnd() * 1024
    const y = rnd() * 1024
    const r = 24 + rnd() * 66
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    const cor = tons[Math.floor(rnd() * tons.length)]
    grad.addColorStop(0, rgb(cor, 1, 0.5))
    grad.addColorStop(1, rgb(cor, 1, 0))
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = rgb(tons[i % 4], 0.8 + rnd() * 0.35, 0.55)
    g.fillRect(rnd() * 1024, rnd() * 1024, 1, 2 + rnd() * 3)
  }
  const flores: Rgb[] = [
    [196, 192, 180],
    [170, 160, 128],
    [150, 140, 150],
  ]
  for (let i = 0; i < 28; i++) {
    const cx = rnd() * 1024
    const cy = rnd() * 1024
    const cor = flores[Math.floor(rnd() * flores.length)]
    for (let k = 0; k < 9; k++) {
      g.fillStyle = rgb(cor, 0.95 + rnd() * 0.1, 0.9)
      g.beginPath()
      g.arc(cx + (rnd() - 0.5) * 26, cy + (rnd() - 0.5) * 22, 1.3 + rnd() * 1.1, 0, Math.PI * 2)
      g.fill()
    }
  }
  return canvas
}

/** Terra de caminho alaranjada e calma, trilhas de roda, pedrinhas; borda some na grama. 3 × 6 m. */
function pintarEstrada(rnd: () => number): HTMLCanvasElement {
  const [canvas, g] = tela(256, 512)
  g.fillStyle = 'rgb(132,124,110)'
  g.fillRect(0, 0, 256, 512)
  for (let i = 0; i < 160; i++) {
    const x = rnd() * 256
    const y = rnd() * 512
    const r = 8 + rnd() * 30
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    const f = 0.88 + rnd() * 0.2
    grad.addColorStop(0, rgb([132, 124, 110], f, 0.5))
    grad.addColorStop(1, rgb([132, 124, 110], f, 0))
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (const u of [0.3, 0.7]) {
    const grad = g.createLinearGradient(u * 256 - 16, 0, u * 256 + 16, 0)
    grad.addColorStop(0, 'rgba(100,94,84,0)')
    grad.addColorStop(0.5, 'rgba(100,94,84,0.55)')
    grad.addColorStop(1, 'rgba(100,94,84,0)')
    g.fillStyle = grad
    g.fillRect(u * 256 - 16, 0, 32, 512)
  }
  for (let i = 0; i < 220; i++) {
    g.fillStyle = rgb([150, 128, 108], 0.85 + rnd() * 0.4, 0.8)
    g.beginPath()
    g.ellipse(rnd() * 256, rnd() * 512, 1 + rnd() * 2.2, 1 + rnd() * 1.6, rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }
  // Borda: a terra afina para a grama (alfa), sem linha dura.
  const img = g.getImageData(0, 0, 256, 512)
  for (let y = 0; y < 512; y++) {
    const ruido = Math.sin(y * 0.07) * 6 + Math.sin(y * 0.19 + 1.3) * 4
    for (let x = 0; x < 256; x++) {
      const borda = Math.min(x, 255 - x) + ruido
      img.data[(y * 256 + x) * 4 + 3] = Math.round(255 * clamp01((borda - 4) / 34))
    }
  }
  g.putImageData(img, 0, 0)
  return canvas
}

/** Telhado de ardósia azul-acinzentada em escamas. 256 px = 2 m. */
function pintarArdosia(rnd: () => number): HTMLCanvasElement {
  const [canvas, g] = tela(256, 256)
  g.fillStyle = 'rgb(62,64,70)'
  g.fillRect(0, 0, 256, 256)
  const fileira = 22
  for (let y = 0, linha = 0; y < 256 + fileira; y += fileira, linha++) {
    for (let x = linha % 2 ? -16 : 0; x < 256 + 32; x += 32) {
      const f = 0.9 + rnd() * 0.18
      g.fillStyle = rgb([92, 96, 106], f)
      g.beginPath()
      g.moveTo(x + 1, y)
      g.lineTo(x + 31, y)
      g.lineTo(x + 31, y + fileira - 6)
      g.quadraticCurveTo(x + 16, y + fileira + 4, x + 1, y + fileira - 6)
      g.closePath()
      g.fill()
      g.fillStyle = rgb([98, 108, 140], f * 1.12, 0.5)
      g.fillRect(x + 2, y + 1, 28, 2)
    }
  }
  return canvas
}

/** Estandarte carmim com barra dourada e um sol poente; ponta em rabo de andorinha. */
function pintarEstandarte(): HTMLCanvasElement {
  const [canvas, g] = tela(128, 512)
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(128, 0)
  g.lineTo(128, 512)
  g.lineTo(64, 440)
  g.lineTo(0, 512)
  g.closePath()
  g.fillStyle = 'rgb(108,52,48)'
  g.fill()
  g.lineWidth = 10
  g.strokeStyle = 'rgb(160,140,96)'
  g.stroke()
  g.fillStyle = 'rgb(160,140,96)'
  g.beginPath()
  g.arc(64, 190, 26, Math.PI, 0)
  g.fill()
  g.fillRect(24, 196, 80, 7)
  for (let k = 0; k < 7; k++) {
    const a = Math.PI + (k + 0.5) * (Math.PI / 7)
    g.fillRect(64 + Math.cos(a) * 34 - 2, 190 + Math.sin(a) * 34 - 6, 4, 12)
  }
  return canvas
}

function pintarTufo(rnd: () => number): HTMLCanvasElement {
  const [canvas, g] = tela(128, 128)
  for (let i = 0; i < 26; i++) {
    const x = 20 + rnd() * 88
    const altura = 50 + rnd() * 70
    const curva = (rnd() - 0.5) * 40
    g.strokeStyle = rgb([128, 128, 110], 0.75 + rnd() * 0.45)
    g.lineWidth = 2.5 + rnd() * 2.5
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(x, 128)
    g.quadraticCurveTo(x + curva * 0.3, 128 - altura * 0.6, x + curva, 128 - altura)
    g.stroke()
  }
  return canvas
}

function pintarBrilho(tamanho: number, paradas: [number, string][]): HTMLCanvasElement {
  const [canvas, g] = tela(tamanho, tamanho)
  const grad = g.createRadialGradient(tamanho / 2, tamanho / 2, 0, tamanho / 2, tamanho / 2, tamanho / 2)
  for (const [p, cor] of paradas) grad.addColorStop(p, cor)
  g.fillStyle = grad
  g.fillRect(0, 0, tamanho, tamanho)
  return canvas
}

function pintarChama(): HTMLCanvasElement {
  const [canvas, g] = tela(64, 128)
  const grad = g.createRadialGradient(32, 92, 2, 32, 80, 56)
  grad.addColorStop(0, 'rgba(255,248,220,1)')
  grad.addColorStop(0.25, 'rgba(255,206,120,0.95)')
  grad.addColorStop(0.6, 'rgba(240,120,50,0.5)')
  grad.addColorStop(1, 'rgba(200,70,30,0)')
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(32, 4)
  g.bezierCurveTo(54, 50, 60, 84, 32, 124)
  g.bezierCurveTo(4, 84, 10, 50, 32, 4)
  g.fill()
  return canvas
}

/** Véu de névoa rasteira: manchas brancas largas e macias, que repetem sem emenda. 256 px. */
function pintarNevoeiro(rnd: () => number): HTMLCanvasElement {
  const [canvas, g] = tela(256, 256)
  g.fillStyle = 'rgba(255,255,255,0.28)'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 42; i++) {
    const x = rnd() * 256
    const y = rnd() * 256
    const r = 26 + rnd() * 38
    const a = (0.1 + rnd() * 0.16).toFixed(2)
    // Só desenha a cópia do outro lado quando a mancha passa da borda.
    for (const dx of [-256, 0, 256]) {
      for (const dy of [-256, 0, 256]) {
        if (x + dx + r < 0 || x + dx - r > 256 || y + dy + r < 0 || y + dy - r > 256) continue
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
        grad.addColorStop(0, 'rgba(255,255,255,' + a + ')')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
      }
    }
  }
  return canvas
}

/**
 * Borda do véu (vai no alphaMap, que lê o canal verde): some na boca de perto, a do topo da imagem
 * (onde fica a ponte ou a passagem), e nos dois lados.
 */
function pintarBordaDoNevoeiro(): HTMLCanvasElement {
  const [canvas, g] = tela(64, 64)
  const perto = g.createLinearGradient(0, 0, 0, 64)
  perto.addColorStop(0, 'rgb(0,0,0)')
  perto.addColorStop(0.1, 'rgb(255,255,255)')
  perto.addColorStop(1, 'rgb(255,255,255)')
  g.fillStyle = perto
  g.fillRect(0, 0, 64, 64)
  const lados = g.createLinearGradient(0, 0, 64, 0)
  lados.addColorStop(0, 'rgba(0,0,0,1)')
  lados.addColorStop(0.14, 'rgba(0,0,0,0)')
  lados.addColorStop(0.86, 'rgba(0,0,0,0)')
  lados.addColorStop(1, 'rgba(0,0,0,1)')
  g.fillStyle = lados
  g.fillRect(0, 0, 64, 64)
  return canvas
}

/** A placa do nome: letras creme com sombra quente (nunca preta), filete dourado com losango. */
function pintarNome(nome: string): HTMLCanvasElement {
  const [canvas, g] = tela(2048, 512)
  let px = 168
  g.font = `600 ${px}px ${FONTE_DO_NOME}`
  const largura = g.measureText(nome).width
  if (largura > 1800) px = Math.floor((px * 1800) / largura)
  g.font = `600 ${px}px ${FONTE_DO_NOME}`
  const final = g.measureText(nome).width
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.shadowColor = 'rgba(36,22,14,0.75)'
  g.shadowBlur = 28
  g.shadowOffsetY = 5
  g.fillStyle = 'rgb(244,232,208)'
  g.fillText(nome, 1024, 270)
  g.shadowBlur = 14
  g.shadowOffsetY = 2
  const meio = Math.max(220, Math.min(820, final * 0.42))
  g.fillStyle = 'rgba(216,182,108,0.95)'
  g.fillRect(1024 - meio, 334, meio - 26, 4)
  g.fillRect(1024 + 26, 334, meio - 26, 4)
  g.beginPath()
  g.moveTo(1024, 320)
  g.lineTo(1040, 336)
  g.lineTo(1024, 352)
  g.lineTo(1008, 336)
  g.closePath()
  g.fill()
  return canvas
}

function pintarVeuDeBaixo(): HTMLCanvasElement {
  const [canvas, g] = tela(4, 256)
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, 'rgba(30,20,16,0)')
  grad.addColorStop(0.45, 'rgba(30,20,16,0)')
  grad.addColorStop(1, 'rgba(30,20,16,0.62)')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 256)
  return canvas
}

// ---------------------------------------------------------------------------
// Shaders (cores escritas já em sRGB: o motor não converte ShaderMaterial)
// ---------------------------------------------------------------------------

const DIRECAO_VERTICE = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * Céu encoberto de fim de tarde: no horizonte é a própria névoa (cor de NEVOA, em sRGB), em cima um
 * cinza um tico mais frio. O sol é só um brilho largo e pálido, sem disco, que some perto do chão
 * para não recortar o campo apagado pela névoa.
 */
const CEU_GLSL = /* glsl */ `
uniform vec3 uNevoa;
vec3 ceuEm(vec3 d, vec3 sol) {
  float h = d.y;
  float s = max(dot(d, sol), 0.0);
  vec3 alto = uNevoa * vec3(0.84, 0.88, 0.95);
  vec3 c = mix(uNevoa, alto, smoothstep(0.04, 0.6, h));
  float acima = smoothstep(0.03, 0.2, h);
  c = mix(c, vec3(0.80, 0.76, 0.69), pow(s, 5.0) * 0.5 * acima);
  c += vec3(0.13, 0.11, 0.08) * pow(s, 36.0) * acima;
  return c;
}
`

const CEU_FRAGMENTO = /* glsl */ `
uniform vec3 uSol;
varying vec3 vDir;
${CEU_GLSL}
float acaso(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  vec3 c = ceuEm(d, uSol);
  c += (acaso(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}
`

const AGUA_VERTICE = /* glsl */ `
varying vec3 vPos;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vPos = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}
`

/**
 * Água do fosso: ondinhas por senos, céu refletido, reflexo barato da fachada
 * (plano z = -0,6 com a altura de cada trecho e o vão escuro) e da margem de
 * pedra do lado de fora, faiscas onde o reflexo aponta para o sol.
 */
const AGUA_FRAGMENTO = /* glsl */ `
uniform float uT;
uniform float uMexe;
uniform vec3 uSol;
uniform float uDensidade;
varying vec3 vPos;
${CEU_GLSL}
void main() {
  float t = uT * uMexe;
  vec2 p = vPos.xz;
  vec3 n = normalize(vec3(
    0.05 * sin(p.x * 1.7 + t * 1.3) + 0.035 * sin(p.x * 0.6 + p.y * 2.3 - t * 1.9) + 0.02 * sin(p.x * 4.1 - p.y * 3.3 + t * 2.7),
    1.0,
    0.045 * sin(p.y * 2.9 + t * 1.1) + 0.03 * sin(p.x * 1.1 - p.y * 1.4 + t * 2.3)));
  vec3 v = normalize(vPos - cameraPosition);
  vec3 r = reflect(v, n);
  vec3 refl = ceuEm(r, uSol);
  if (r.z < -0.02) {
    float k = (-0.6 - vPos.z) / r.z;
    vec2 hit = vec2(vPos.x + r.x * k, vPos.y + r.y * k);
    float ax = abs(hit.x);
    float topo = ax < 4.2 ? 9.4 : (ax < 7.8 ? 12.0 : 6.7);
    if (k > 0.0 && hit.y < topo) {
      refl = vec3(0.44, 0.43, 0.40) * (0.85 + 0.15 * sin(hit.y * 6.0));
      if (ax < 1.4 && hit.y < 4.6) refl = vec3(0.10, 0.10, 0.10);
    }
  } else if (r.z > 0.02) {
    float k = (5.0 - vPos.z) / r.z;
    float y = vPos.y + r.y * k;
    if (k > 0.0 && y < 0.0) refl = vec3(0.26, 0.25, 0.24);
    else if (k > 0.0 && y < 0.6) refl = mix(vec3(0.33, 0.34, 0.30), refl, 0.4);
  }
  float cosv = max(dot(-v, n), 0.0);
  float fresnel = 0.16 + 0.5 * pow(1.0 - cosv, 3.0);
  // Faixas deitadas que andam devagar: o reflexo se quebra como em água parada de fosso.
  float faixas = sin(p.y * 13.0 + sin(p.x * 0.7 + t * 0.6) * 2.2 + t * 1.4) * sin(p.y * 5.3 - p.x * 0.4 - t * 0.9);
  refl *= 0.84 + 0.22 * faixas;
  vec3 fundo = vec3(0.07, 0.08, 0.08);
  vec3 c = mix(fundo, refl * vec3(0.72, 0.75, 0.77), fresnel);
  // Escurece junto das pedras do castelo e da margem: a água "encosta" nelas.
  c *= 0.72 + 0.28 * smoothstep(-0.6, 1.6, p.y) * (1.0 - smoothstep(4.4, 5.0, p.y));
  float brilho = pow(max(dot(r, uSol), 0.0), 600.0);
  float cintila = 0.5 + 0.5 * sin(p.x * 23.0 + t * 7.0) * sin(p.y * 19.0 - t * 5.0);
  c += vec3(0.9, 0.86, 0.78) * brilho * cintila * 0.9;
  float longe = length(vPos - cameraPosition) * uDensidade;
  c = mix(c, uNevoa, 1.0 - exp(-longe * longe));
  gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);
}
`

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

/** UV em metros: `escala` = 1 / (metros que a textura cobre). */
function escalarUv(geo: Three.BufferGeometry, su: number, sv: number): Three.BufferGeometry {
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  uv.needsUpdate = true
  return geo
}

/** Casco do contorno: a mesma forma empurrada pela normal (o lado de dentro aparece como linha). */
function casco(geo: Three.BufferGeometry, espessura: number): Three.BufferGeometry {
  const c = geo.clone()
  const pos = c.getAttribute('position')
  const nor = c.getAttribute('normal')
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * espessura, pos.getY(i) + nor.getY(i) * espessura, pos.getZ(i) + nor.getZ(i) * espessura)
  }
  return c
}

/** Bandeirola triangular: tira de 8 gomos do mastro à ponta (a ondulação mexe no z). */
function geometriaDeBandeirola(THREE: ThreeModule, comprimento: number, altura: number): Three.BufferGeometry {
  const gomos = 8
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= gomos; i++) {
    const x = (i / gomos) * comprimento
    const meia = (altura / 2) * (1 - i / gomos) + 0.01
    pos.push(x, meia, 0, x, -meia, 0)
    if (i < gomos) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// ---------------------------------------------------------------------------
// A cena
// ---------------------------------------------------------------------------

export function criarPonteLevadica(sentido: Sentido): CriarCena {
  return (THREE: ThreeModule, opcoes: OpcoesDaCena): CenaTransicao => montarPonte(THREE, opcoes, sentido)
}

function montarPonte(THREE: ThreeModule, { reduzirMovimento, nome }: OpcoesDaCena, sentido: Sentido): CenaTransicao {
  const scene = new THREE.Scene()
  // A névoa do three mistura a cor DEPOIS de converter para sRGB, e com o ColorManagement desligado
  // (como no motor do app) a cor dela não é convertida: vai crua, em sRGB, para casar com o céu.
  scene.fog = new THREE.FogExp2(new THREE.Color().setHex(NEVOA.cor, THREE.LinearSRGBColorSpace), NEVOA.densidade)
  /** A mesma cor da névoa, em sRGB, para os shaders próprios (céu e água), que o motor não converte. */
  const nevoaSrgb = new THREE.Vector3(((NEVOA.cor >> 16) & 255) / 255, ((NEVOA.cor >> 8) & 255) / 255, (NEVOA.cor & 255) / 255)
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 1200)
  scene.add(camera)
  const rnd = semente(20261120)
  const texturas: Three.Texture[] = []
  const instanciadas: Three.InstancedMesh[] = []

  const textura = (canvas: HTMLCanvasElement, repetir = false) => {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    if (repetir) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    texturas.push(tex)
    return tex
  }
  const lambert = (hex: number, extra: Three.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: corLinear(THREE, hex), ...extra })
  const basico = (hex: number, extra: Three.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color: corLinear(THREE, hex), ...extra })
  const malha = (geo: Three.BufferGeometry, mat: Three.Material | Three.Material[], x = 0, y = 0, z = 0, sombra: 'ambas' | 'recebe' | 'nenhuma' = 'ambas') => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = sombra === 'ambas'
    m.receiveShadow = sombra !== 'nenhuma'
    scene.add(m)
    return m
  }

  // --- Luz -------------------------------------------------------------------
  const { azimute, elevacao, cor: corDoSol, forca } = SOL[sentido]
  const solDir = new THREE.Vector3(-Math.sin(azimute) * Math.cos(elevacao), Math.sin(elevacao), Math.cos(azimute) * Math.cos(elevacao))
  const sol = new THREE.DirectionalLight(corLinear(THREE, corDoSol), forca)
  const recorte = SOMBRA[sentido]
  sol.target.position.set(recorte.alvo[0], 0, recorte.alvo[1])
  sol.position.copy(solDir).multiplyScalar(60).add(sol.target.position)
  sol.castShadow = true
  sol.shadow.mapSize.set(2048, 2048)
  sol.shadow.camera.left = -recorte.meiaLargura
  sol.shadow.camera.right = recorte.meiaLargura
  sol.shadow.camera.top = 15
  sol.shadow.camera.bottom = -15
  sol.shadow.camera.near = 1
  sol.shadow.camera.far = 130
  sol.shadow.bias = -0.0004
  sol.shadow.normalBias = 0.03
  scene.add(sol, sol.target)
  // Luz de céu encoberto: fria por cima, terra apagada por baixo. Quem aquece são as tochas.
  scene.add(new THREE.HemisphereLight(corLinear(THREE, 0xaab4c2), corLinear(THREE, 0x54534e), 1.45))

  // --- Céu de névoa e o brilho difuso do sol -------------------------------------
  const ceu = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({ uniforms: { uSol: { value: solDir.clone() }, uNevoa: { value: nevoaSrgb } }, vertexShader: DIRECAO_VERTICE, fragmentShader: CEU_FRAGMENTO, side: THREE.BackSide, depthWrite: false }),
  )
  ceu.renderOrder = -10
  ceu.frustumCulled = false
  scene.add(ceu)

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textura(pintarBrilho(256, [[0, 'rgba(255,246,228,0.8)'], [0.25, 'rgba(255,232,200,0.35)'], [0.6, 'rgba(240,220,190,0.08)'], [1, 'rgba(230,210,180,0)']])),
      color: corLinear(THREE, 0xe8dccb),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.2,
    }),
  )
  halo.position.copy(solDir).multiplyScalar(340)
  halo.scale.set(170, 170, 1)
  scene.add(halo)

  // --- Chão, fosso, estrada ---------------------------------------------------
  const texGrama = textura(pintarGramado(rnd))
  {
    const geo = new THREE.PlaneGeometry(60, 50, 120, 100).rotateX(-Math.PI / 2)
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pos.setY(i, taludeEm(pos.getX(i), pos.getZ(i) + MARGEM_Z + 25))
    geo.computeVertexNormals()
    malha(geo, lambert(0xffffff, { map: texGrama }), 0, 0, MARGEM_Z + 25, 'recebe')
  }
  const gramaLonge = lambert(0x7c7d72)
  // Começa depois do talude: antes ele tampava a descida da margem com um lençol liso, sem textura.
  malha(new THREE.PlaneGeometry(700, 320).rotateX(-Math.PI / 2), gramaLonge, 0, -0.03, TALUDE.inicio + 160, 'nenhuma')

  const texPedra = textura(pintarPedra(rnd), true)
  // A própria textura vira relevo: a junta escura afunda e a quina pega luz (sem outra textura para subir).
  const pedra = lambert(0xffffff, { map: texPedra, vertexColors: true, bumpMap: texPedra, bumpScale: RELEVO_DA_PEDRA })
  /** Toda peça de pedra passa por aqui: UV em metros já feita por quem chama, umidade pela altura do mundo. */
  const pedraEm = (geo: Three.BufferGeometry, x: number, y: number, z: number, sombra: 'ambas' | 'recebe' = 'ambas') => malha(sujarDeUmidade(THREE, geo, y), pedra, x, y, z, sombra)
  const metros = (geo: Three.BufferGeometry, largura: number, altura: number) => escalarUv(geo, largura * UV_DA_PEDRA, altura * UV_DA_PEDRA)
  // Muro de arrimo da margem de fora (a face vira para o castelo): o topo segue o talude, alto só no aterro da ponte.
  {
    const perfil = new THREE.Shape()
    perfil.moveTo(-350, BASE_Y)
    perfil.lineTo(350, BASE_Y)
    // Amostra fina só onde o topo muda (o aterro da ponte), grossa no resto.
    const xs = [350, 100, 20, 8]
    for (let x = 6; x >= -6; x -= 0.25) xs.push(x)
    xs.push(-8, -20, -100, -350)
    for (const x of xs) perfil.lineTo(x, taludeEm(x, MARGEM_Z) - 0.01)
    perfil.closePath()
    const geo = new THREE.ExtrudeGeometry(perfil, { depth: 0.8, bevelEnabled: false, curveSegments: 1 })
    escalarUv(geo, UV_DA_PEDRA, UV_DA_PEDRA)
    pedraEm(geo, 0, 0, MARGEM_Z, 'recebe')
  }

  const materialDaAgua = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uMexe: { value: reduzirMovimento ? 0.35 : 1 }, uSol: { value: solDir.clone() }, uNevoa: { value: nevoaSrgb }, uDensidade: { value: NEVOA.densidade } },
    vertexShader: AGUA_VERTICE,
    fragmentShader: AGUA_FRAGMENTO,
  })
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(700, MARGEM_Z + 2.5, 1, 1).rotateX(-Math.PI / 2), materialDaAgua)
  agua.position.set(0, AGUA_Y, (MARGEM_Z - 2.5) / 2)
  scene.add(agua)

  // Estrada: fita ao longo de uma curva mansa, da ponte até os morros.
  {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.1, 0, PONTE.fim - 0.4),
      new THREE.Vector3(0.25, 0, 12),
      new THREE.Vector3(-1.4, 0, 24),
      new THREE.Vector3(1.6, 0, 40),
      new THREE.Vector3(-2.2, 0, 70),
      new THREE.Vector3(1.2, 0, 112),
      new THREE.Vector3(-0.5, 0, 170),
    ])
    const n = 90
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    let andado = 0
    let anterior = curva.getPointAt(0)
    for (let i = 0; i <= n; i++) {
      const u = i / n
      const p = curva.getPointAt(u)
      andado += p.distanceTo(anterior)
      anterior = p
      const tg = curva.getTangentAt(u)
      const lado = new THREE.Vector3(tg.z, 0, -tg.x).normalize()
      const meia = 1.75 - 0.5 * u
      pos.push(p.x - lado.x * meia, 0.012, p.z - lado.z * meia, p.x + lado.x * meia, 0.012, p.z + lado.z * meia)
      uv.push(0, andado / 6, 1, andado / 6)
      if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    // Ordem (esquerda, frente, direita): a normal sai para cima.
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const estrada = malha(geo, lambert(0xffffff, { map: textura(pintarEstrada(rnd), true), transparent: true, depthWrite: false }), 0, 0, 0, 'recebe')
    estrada.renderOrder = 1

    // Tufos de capim nas margens da estrada (cruzes com alfa recortado).
    const tufoGeo = new THREE.BufferGeometry()
    tufoGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0.3, 0.4, 0, -0.3, 0.4, 0, 0, 0, -0.3, 0, 0, 0.3, 0, 0.4, 0.3, 0, 0.4, -0.3], 3))
    tufoGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2))
    tufoGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
    tufoGeo.computeVertexNormals()
    const tufos = new THREE.InstancedMesh(tufoGeo, lambert(0xffffff, { map: textura(pintarTufo(rnd)), alphaTest: 0.5, side: THREE.DoubleSide }), 240)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const cor = new THREE.Color()
    let k = 0
    while (k < 240) {
      const z = MARGEM_Z + 0.7 + Math.pow(rnd(), 1.6) * 30
      const x = (rnd() - 0.5) * 34
      const meio = curva.getPointAt(clamp01((z - (PONTE.fim - 0.4)) / 170)).x
      if (Math.abs(x - meio) < 1.9) continue
      const e = 0.7 + rnd() * 0.8
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI)
      m.compose(new THREE.Vector3(x, taludeEm(x, z), z), q, new THREE.Vector3(e, e * (0.8 + rnd() * 0.5), e))
      tufos.setMatrixAt(k, m)
      tufos.setColorAt(k, cor.setRGB(0.85 + rnd() * 0.25, 0.9 + rnd() * 0.15, 0.8 + rnd() * 0.2))
      k++
    }
    tufos.receiveShadow = true
    scene.add(tufos)
    instanciadas.push(tufos)
  }

  // --- Árvores de copa redonda (as do Meio-Termo), com contorno -----------------
  {
    const lugares: [number, number, number][] = [
      [-8.6, 9.2, 1.15],
      [9.8, 8.0, 1.25],
      [-7.2, 17, 1.1],
      [11.5, 27, 1.3],
      [-10.5, 30, 1.45],
      [9.5, 36, 1.25],
      [-5.8, 46, 1.35],
      [12.5, 52, 1.55],
      [-14.5, 61, 1.6],
      [5, 72, 1.4],
      [-16, 14, 1.3],
      [17, 18, 1.4],
      // Mais longe, só para a névoa ir engolindo: vulto, depois nada.
      [-23, 40, 1.5],
      [25, 47, 1.6],
      [-31, 70, 1.7],
      [29, 82, 1.6],
      [-9, 96, 1.8],
      [17, 112, 1.8],
      [-42, 92, 1.8],
      [38, 62, 1.6],
    ]
    const copaGeo = new THREE.IcosahedronGeometry(1, 2)
    const troncos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 7), lambert(0x4c443c), lugares.length)
    const copas = new THREE.InstancedMesh(copaGeo, lambert(0x5d6356), lugares.length * 3)
    const contornos = new THREE.InstancedMesh(casco(copaGeo, 0.06), basico(0x363a33, { side: THREE.BackSide }), lugares.length * 3)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const cor = new THREE.Color()
    // Copa redonda: um bolo grande em cima e dois menores dos lados, mais baixos (sem virar coração).
    const blocos: [number, number, number, number][] = [
      [0, 2.5, 0, 1.12],
      [0.66, 2.02, 0.16, 0.72],
      [-0.6, 2.08, -0.14, 0.76],
    ]
    lugares.forEach(([x, z, e], i) => {
      m.compose(new THREE.Vector3(x, 0.9 * e, z), q.identity(), new THREE.Vector3(e, e, e))
      troncos.setMatrixAt(i, m)
      blocos.forEach(([bx, by, bz, r], j) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6)
        m.compose(new THREE.Vector3(x + bx * e, by * e, z + bz * e), q, new THREE.Vector3(r * e, r * e * 0.92, r * e))
        copas.setMatrixAt(i * 3 + j, m)
        contornos.setMatrixAt(i * 3 + j, m)
        copas.setColorAt(i * 3 + j, cor.setRGB(0.88 + rnd() * 0.22, 0.92 + rnd() * 0.14, 0.86 + rnd() * 0.18))
      })
    })
    // Árvores longe não projetam: a sombra delas mal aparece e cada variante de sombra é mais um programa a compilar.
    troncos.castShadow = copas.castShadow = false
    troncos.receiveShadow = copas.receiveShadow = true
    scene.add(troncos, copas, contornos)
    instanciadas.push(troncos, copas, contornos)
  }

  // --- O castelo ---------------------------------------------------------------
  // Guarita: a fachada com o vão em arco, extrudada 6 m (os lados do furo viram a passagem).
  const forma = new THREE.Shape()
  forma.moveTo(-GUARITA.meiaLargura, BASE_Y)
  forma.lineTo(GUARITA.meiaLargura, BASE_Y)
  forma.lineTo(GUARITA.meiaLargura, GUARITA.topo)
  forma.lineTo(-GUARITA.meiaLargura, GUARITA.topo)
  forma.closePath()
  const furo = new THREE.Path()
  furo.moveTo(-VAO.meiaLargura, 0)
  furo.lineTo(-VAO.meiaLargura, VAO.alturaReta)
  furo.absarc(0, VAO.alturaReta, VAO.meiaLargura, Math.PI, 0, true)
  furo.lineTo(VAO.meiaLargura, 0)
  furo.closePath()
  forma.holes.push(furo)
  const guaritaGeo = new THREE.ExtrudeGeometry(forma, { depth: GUARITA.fundo, bevelEnabled: false, curveSegments: 18, steps: 6 })
  escalarUv(guaritaGeo, UV_DA_PEDRA, UV_DA_PEDRA)
  sujarDeUmidade(THREE, guaritaGeo, 0)
  // Lados do furo (a passagem): fiadas deitadas ao longo da passagem (a UV de lado da extrusão as põe em pé)
  // e a pedra escurece com a distância da boca mais perto: o meio da abóbada some na penumbra (só as tochas
  // o acendem). A boca do pátio clareia menos que a de fora, porque o pátio é fechado por muralhas.
  {
    const pos = guaritaGeo.getAttribute('position')
    const nor = guaritaGeo.getAttribute('normal')
    const uv = guaritaGeo.getAttribute('uv')
    const cor = guaritaGeo.getAttribute('color')
    const lados = guaritaGeo.groups.find((gr) => gr.materialIndex === 1)
    if (lados) {
      for (let i = lados.start; i < lados.start + lados.count; i++) {
        const deitada = Math.abs(nor.getY(i)) > 0.7
        uv.setXY(i, pos.getZ(i) * UV_DA_PEDRA, (deitada ? pos.getX(i) : pos.getY(i)) * UV_DA_PEDRA)
        const daFrente = GUARITA.fundo - pos.getZ(i)
        const doPatio = pos.getZ(i) * 1.35
        const k = 1 - 0.9 * Math.pow(clamp01(Math.min(daFrente, doPatio) / 2.3), 0.7)
        cor.setXYZ(i, cor.getX(i) * k, cor.getY(i) * k * 0.97, cor.getZ(i) * k * 0.94)
      }
    }
  }
  malha(guaritaGeo, pedra, 0, 0, -GUARITA.fundo)

  // Torres redondas, cinta de mísulas, telhado cônico de ardósia, bandeirola.
  const texArdosia = textura(pintarArdosia(rnd), true)
  const ardosia = lambert(0xffffff, { map: texArdosia })
  const altura = TORRE.topo - BASE_Y
  const bandeirolas: Three.Mesh[] = []
  const bandeirolaGeo = geometriaDeBandeirola(THREE, 1.5, 0.55)
  // Sombra pelo lado de trás, como os sólidos: reaproveita o mesmo programa de sombra (menos compilação no 1º quadro).
  const carmim = lambert(0x6c3834, { side: THREE.DoubleSide, shadowSide: THREE.BackSide })
  const ferro = lambert(0x3d3633)
  const mastro = (x: number, y: number, z: number) => {
    malha(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5), ferro, x, y + 0.65, z, 'nenhuma')
    const b = malha(bandeirolaGeo.clone(), carmim, x, y + 1.08, z, 'nenhuma')
    bandeirolas.push(b)
  }
  const volta = 2 * Math.PI * TORRE.raio
  const torreGeo = metros(new THREE.CylinderGeometry(TORRE.raio, TORRE.raio * 1.04, altura, 36, 6), volta, altura)
  const cintaGeo = metros(new THREE.CylinderGeometry(TORRE.raio + 0.25, TORRE.raio, 0.7, 36), volta, 0.7)
  const coneGeo = escalarUv(new THREE.ConeGeometry(TORRE.raio + 0.55, 5, 32, 1), 6, 2.5)
  for (const lado of [-1, 1]) {
    const x = lado * TORRE.x
    pedraEm(torreGeo, x, BASE_Y + altura / 2, TORRE.z)
    pedraEm(cintaGeo, x, TORRE.topo - 0.1, TORRE.z)
    malha(coneGeo, ardosia, x, TORRE.topo + 2.7, TORRE.z)
    mastro(x, TORRE.topo + 5.1, TORRE.z)
  }
  // Seteiras e janelas acesas.
  const escuro = basico(0x34261f)
  const acesa = basico(0xffc47a)
  for (const lado of [-1, 1]) {
    for (const [y, a] of [
      [4.6, 0.25],
      [8.2, -0.35],
    ] as const) {
      const ang = a * lado
      const s = malha(new THREE.PlaneGeometry(0.16, 0.9), escuro, lado * TORRE.x + Math.sin(ang) * (TORRE.raio + 0.02), y, TORRE.z + Math.cos(ang) * (TORRE.raio + 0.02), 'nenhuma')
      s.rotation.y = ang
    }
  }
  const janela = malha(new THREE.PlaneGeometry(0.5, 0.8), acesa, -TORRE.x + Math.sin(0.5) * (TORRE.raio + 0.02), 9.6, TORRE.z + Math.cos(0.5) * (TORRE.raio + 0.02), 'nenhuma')
  janela.rotation.y = 0.5

  // Muralhas de cortina e torres dos cantos.
  for (const lado of [-1, 1]) {
    const largura = CORTINA.fim - (TORRE.x + 1)
    const alturaDaCortina = CORTINA.topo - BASE_Y
    const geo = metros(new THREE.BoxGeometry(largura, alturaDaCortina, 2.4, 1, 4, 1), largura, alturaDaCortina)
    pedraEm(geo, lado * (TORRE.x + 1 + largura / 2), BASE_Y + alturaDaCortina / 2, CORTINA.frente - 1.2)
    const canto = metros(new THREE.CylinderGeometry(2.7, 2.8, 12, 28, 4), 2 * Math.PI * 2.7, 12)
    pedraEm(canto, lado * (CORTINA.fim + 1), BASE_Y + 6, CORTINA.frente - 1.2)
    malha(escalarUv(new THREE.ConeGeometry(3.2, 4.6, 28), 6, 2.3), ardosia, lado * (CORTINA.fim + 1), BASE_Y + 12 + 2.3, CORTINA.frente - 1.2)
    for (const xs of [12, 20, 29]) malha(new THREE.PlaneGeometry(0.16, 0.8), escuro, lado * xs, 3.6, CORTINA.frente + 0.01, 'nenhuma')
  }
  // Torre de menagem, no fundo, depois da muralha de dentro e à esquerda do segundo portão.
  pedraEm(metros(new THREE.BoxGeometry(8, 20, 8, 1, 4, 1), 8, 20), MENAGEM.x, 8.3, MENAGEM.z)
  const telhadoDaMenagem = malha(escalarUv(new THREE.ConeGeometry(6.3, 5.5, 4, 1), 9, 2.8), ardosia, MENAGEM.x, 18.3 + 2.75, MENAGEM.z)
  telhadoDaMenagem.rotation.y = Math.PI / 4
  mastro(MENAGEM.x, 18.3 + 5.5, MENAGEM.z)
  for (const [x, y] of [
    [-1.9, 13.2],
    [0.9, 13.2],
    [-0.5, 9.6],
  ] as const) {
    malha(new THREE.PlaneGeometry(0.55, 0.9), acesa, MENAGEM.x + x, y, MENAGEM.z + 4.02, 'nenhuma')
  }
  pedraEm(metros(new THREE.CylinderGeometry(2.1, 2.2, 17, 28, 4), 2 * Math.PI * 2.1, 17), 9.5, BASE_Y + 8.5, -12)
  malha(escalarUv(new THREE.ConeGeometry(2.6, 4.4, 28), 6, 2.2), ardosia, 9.5, BASE_Y + 17 + 2.2, -12)

  // Pátio de dentro: o que se vê pela passagem. Laje úmida, um poço e caixotes a meia distância (dão a
  // profundidade quando quem olha anda), a muralha de dentro com o segundo portão e, atrás dele, a névoa clara.
  const madeiraVelha = lambert(0x5c5044)
  {
    const comprimento = -PATIO.fundo + CORTINA.frente - 1.3
    const laje = metros(new THREE.PlaneGeometry(80, comprimento).rotateX(-Math.PI / 2), 80 * 0.6, comprimento * 0.6)
    // Um tico abaixo do chão da passagem, que é da guarita: as duas não brigam pela mesma profundidade.
    pedraEm(laje, 0, -0.01, CORTINA.frente - 1.3 - comprimento / 2, 'recebe')

    const muro = new THREE.Shape()
    muro.moveTo(-30, BASE_Y)
    muro.lineTo(30, BASE_Y)
    muro.lineTo(30, PATIO.topo)
    muro.lineTo(-30, PATIO.topo)
    muro.closePath()
    const vao = new THREE.Path()
    vao.moveTo(-PATIO.vao, 0)
    vao.lineTo(-PATIO.vao, PATIO.vaoReto)
    vao.absarc(0, PATIO.vaoReto, PATIO.vao, Math.PI, 0, true)
    vao.lineTo(PATIO.vao, 0)
    vao.closePath()
    muro.holes.push(vao)
    const muralhaDeDentro = new THREE.ExtrudeGeometry(muro, { depth: PATIO.espessura, bevelEnabled: false, curveSegments: 14 })
    escalarUv(muralhaDeDentro, UV_DA_PEDRA, UV_DA_PEDRA)
    sujarDeUmidade(THREE, muralhaDeDentro, 0)
    // Fica na sombra das torres e da menagem: escura contra a névoa clara de trás, em contraluz.
    const corDaMuralha = muralhaDeDentro.getAttribute('color')
    for (let i = 0; i < corDaMuralha.count; i++) corDaMuralha.setXYZ(i, corDaMuralha.getX(i) * 0.55, corDaMuralha.getY(i) * 0.56, corDaMuralha.getZ(i) * 0.6)
    malha(muralhaDeDentro, pedra, 0, 0, PATIO.muralha - PATIO.espessura)

    // Poço de pedra com a boca escura, dois esteios e a trave.
    const poco = { x: 2.7, z: -12.5 }
    pedraEm(metros(new THREE.CylinderGeometry(0.95, 1.02, 0.85, 22, 1), 6, 0.85), poco.x, 0.425, poco.z)
    malha(new THREE.CircleGeometry(0.8, 22).rotateX(-Math.PI / 2), escuro, poco.x, 0.856, poco.z, 'nenhuma')
    for (const lado of [-1, 1]) malha(new THREE.BoxGeometry(0.13, 1.9, 0.13), madeiraVelha, poco.x + lado * 0.86, 0.85 + 0.95, poco.z)
    malha(new THREE.BoxGeometry(1.95, 0.13, 0.13), madeiraVelha, poco.x, 2.72, poco.z)
    // Casa do fundo, depois do segundo portão: vulto na névoa com uma janela acesa.
    const casa = { x: 1.6, z: -36 }
    pedraEm(metros(new THREE.BoxGeometry(5, 4.4, 4, 1, 2, 1), 5, 4.4), casa.x, 2.2, casa.z)
    const telhadoDaCasa = malha(escalarUv(new THREE.ConeGeometry(4.0, 2.6, 4, 1), 6, 2), ardosia, casa.x, 4.4 + 1.3, casa.z)
    telhadoDaCasa.rotation.y = Math.PI / 4
    malha(new THREE.PlaneGeometry(0.6, 0.8), acesa, casa.x - 0.9, 2.3, casa.z + 2.01, 'nenhuma')
    malha(new THREE.PlaneGeometry(1.0, 1.9), escuro, casa.x + 1.1, 0.95, casa.z + 2.01, 'nenhuma')
    // Caixotes encostados do outro lado.
    for (const [x, y, z, lado, giro] of [
      [-2.3, 0.45, -9.6, 0.9, 0.12],
      [-1.55, 0.35, -10.5, 0.7, -0.3],
      [-2.2, 1.25, -9.7, 0.7, 0.4],
    ] as const) {
      const caixote = malha(new THREE.BoxGeometry(lado, lado, lado), madeiraVelha, x, y, z)
      caixote.rotation.y = giro
    }
  }

  // Ameias da guarita e das cortinas.
  {
    const lugares: [number, number, number][] = []
    for (let x = -3.75; x <= 3.76; x += 1.5) lugares.push([x, GUARITA.topo + 0.5, -0.35])
    for (const lado of [-1, 1]) for (let x = TORRE.x + 2.6; x < CORTINA.fim - 1.5; x += 1.6) lugares.push([lado * x, CORTINA.topo + 0.5, CORTINA.frente - 0.35])
    for (let x = -28.8; x <= 28.9; x += 1.6) lugares.push([x, PATIO.topo + 0.5, PATIO.muralha - 0.35])
    const ameias = new THREE.InstancedMesh(sujarDeUmidade(THREE, metros(new THREE.BoxGeometry(0.9, 1, 0.7), 0.9, 1), CORTINA.topo), pedra, lugares.length)
    const m = new THREE.Matrix4()
    lugares.forEach(([x, y, z], i) => ameias.setMatrixAt(i, m.makeTranslation(x, y, z)))
    ameias.castShadow = ameias.receiveShadow = true
    scene.add(ameias)
    instanciadas.push(ameias)
  }

  // Estandartes na fachada.
  const texEstandarte = textura(pintarEstandarte())
  const estandartes: Three.Mesh[] = []
  for (const lado of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(1.0, 3.2, 1, 8)
    geo.translate(0, -1.6, 0)
    const e = malha(geo, lambert(0xffffff, { map: texEstandarte, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), lado * 2.85, 8.6, 0.08, 'recebe')
    estandartes.push(e)
  }

  // Grades levadiças erguidas, uma em cada boca da passagem: só os dentes aparecem sob o arco.
  {
    const bocas = [-0.55, -GUARITA.fundo + 0.55]
    const barras = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 3.6, 0.07), ferro, (9 + 3) * bocas.length)
    const dentes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.2, 5).rotateX(Math.PI), ferro, 9 * bocas.length)
    const m = new THREE.Matrix4()
    bocas.forEach((z, b) => {
      for (let i = 0; i < 9; i++) {
        const x = -1.2 + i * 0.3
        barras.setMatrixAt(b * 12 + i, m.makeTranslation(x, 4.05 + 1.8, z))
        dentes.setMatrixAt(b * 9 + i, m.makeTranslation(x, 3.95, z))
      }
      for (let j = 0; j < 3; j++) {
        m.makeRotationZ(Math.PI / 2).setPosition(0, 4.3 + j * 0.62, z)
        m.scale(new THREE.Vector3(1, 2.7 / 3.6, 1))
        barras.setMatrixAt(b * 12 + 9 + j, m)
      }
    })
    barras.castShadow = dentes.castShadow = true
    scene.add(barras, dentes)
    instanciadas.push(barras, dentes)
  }

  // --- A ponte levadiça e as correntes ------------------------------------------
  {
    const texTabuas = textura(pintarTabuleiro(rnd))
    const madeiraEscura = lambert(0x5e4330)
    const tabuleiro = malha(new THREE.BoxGeometry(PONTE.meiaLargura * 2, PONTE.espessura, PONTE.fim), [madeiraEscura, madeiraEscura, lambert(0xffffff, { map: texTabuas }), madeiraEscura, madeiraEscura, madeiraEscura], 0, PONTE.topo - PONTE.espessura / 2, PONTE.fim / 2)
    tabuleiro.castShadow = true
    for (const lado of [-1, 1]) malha(new THREE.BoxGeometry(0.16, 0.22, PONTE.fim), madeiraEscura, lado * (PONTE.meiaLargura - 0.08), PONTE.topo + 0.11, PONTE.fim / 2)
    // Encontro de pedra onde a ponte assenta, do lado de fora.
    pedraEm(metros(new THREE.BoxGeometry(4.2, -BASE_Y, 1.0), 4.2, -BASE_Y), 0, BASE_Y / 2 - 0.02, MARGEM_Z + 0.3, 'recebe')

    const elo = new THREE.TorusGeometry(0.05, 0.016, 5, 10)
    elo.scale(1, 1.55, 1)
    const totais: { a: Three.Vector3; b: Three.Vector3; n: number }[] = [-1, 1].map((lado) => {
      const a = new THREE.Vector3(lado * 1.72, 5.35, 0.08)
      const b = new THREE.Vector3(lado * 1.42, PONTE.topo + 0.24, PONTE.fim - 0.4)
      return { a, b, n: Math.round(a.distanceTo(b) / CORRENTE.elo) }
    })
    const correntes = new THREE.InstancedMesh(elo, ferro, totais.reduce((s, c) => s + c.n, 0))
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const giro = new THREE.Quaternion()
    const cima = new THREE.Vector3(0, 1, 0)
    const um = new THREE.Vector3(1, 1, 1)
    let k = 0
    for (const { a, b, n } of totais) {
      const ponto = (s: number) => new THREE.Vector3().lerpVectors(a, b, s).add(new THREE.Vector3(0, -CORRENTE.flecha * 4 * s * (1 - s), 0))
      for (let i = 0; i < n; i++) {
        const s = (i + 0.5) / n
        const p = ponto(s)
        const d = ponto(Math.min(1, s + 0.01)).sub(ponto(Math.max(0, s - 0.01))).normalize()
        q.setFromUnitVectors(cima, d)
        giro.setFromAxisAngle(d, i % 2 ? Math.PI / 2 : 0)
        m.compose(p, giro.multiply(q), um)
        correntes.setMatrixAt(k++, m)
      }
    }
    correntes.castShadow = true
    scene.add(correntes)
    instanciadas.push(correntes)
    for (const lado of [-1, 1]) malha(new THREE.CircleGeometry(0.17, 12), escuro, lado * 1.72, 5.38, 0.012, 'nenhuma')
  }

  // --- Névoa rasteira e o clarão atrás do segundo portão ---------------------------------
  // Véus deitados rente ao chão: vistos de pé, de lado, engrossam com a distância como névoa de vale.
  // Começam depois da ponte e depois da passagem, para a ponte e as correntes ficarem nítidas.
  const texNevoeiro = textura(pintarNevoeiro(rnd), true)
  const texBorda = textura(pintarBordaDoNevoeiro())
  texBorda.colorSpace = THREE.NoColorSpace
  const veus: { tex: Three.Texture; porMetro: number; rumo: number }[] = []
  const veuDeNevoa = (largura: number, comprimento: number, y: number, z: number, deFrente: boolean, opacidade: number, repete: [number, number], rumo: number) => {
    const tex = texNevoeiro.clone()
    tex.repeat.set(repete[0], repete[1])
    tex.needsUpdate = true
    texturas.push(tex)
    const geo = new THREE.PlaneGeometry(largura, comprimento).rotateX(-Math.PI / 2)
    // A borda que some fica do lado de quem vem do castelo.
    if (!deFrente) geo.rotateY(Math.PI)
    const material = new THREE.MeshBasicMaterial({ color: corLinear(THREE, NEVOEIRO_BAIXO.cor), map: tex, alphaMap: texBorda, transparent: true, depthWrite: false, opacity: opacidade })
    const m = malha(geo, material, 0, y, z, 'nenhuma')
    m.renderOrder = 2
    veus.push({ tex, porMetro: repete[0] / largura, rumo })
  }
  veuDeNevoa(150, 120, 0.35, PONTE.fim + 3 + 60, true, 0.62, [4, 3.4], 1)
  veuDeNevoa(150, 120, 0.95, PONTE.fim + 6 + 60, true, 0.42, [3, 2.5], -0.7)
  veuDeNevoa(60, 36, 0.4, -GUARITA.fundo - 2 - 18, false, 0.5, [2, 1.3], 0.8)
  // Clarão da névoa do outro lado do segundo portão: o pátio de dentro fica em contraluz.
  const clarao = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: (halo.material as Three.SpriteMaterial).map, color: corLinear(THREE, 0xb8b4ac), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.16 }),
  )
  clarao.position.set(0, 2.6, PATIO.muralha - PATIO.espessura - 9)
  clarao.scale.set(26, 15, 1)
  scene.add(clarao)

  // --- Tochas -------------------------------------------------------------------
  const texChama = textura(pintarChama())
  const tochas: { chama: Three.Sprite; luz: Three.PointLight | null; fase: number; base?: number }[] = []
  const madeiraDaTocha = lambert(0x6a4a32)
  const texHaloDaTocha = textura(pintarBrilho(64, [[0, 'rgba(255,190,110,0.55)'], [0.4, 'rgba(255,150,80,0.18)'], [1, 'rgba(255,130,70,0)']]))
  /** Tocha de parede: argola de ferro, cabo de madeira inclinado para fora, chama e um halo baixinho. */
  const tocha = (x: number, y: number, z: number, nx: number, nz: number, fase: number, forca = 0.5, alcance = 8) => {
    const suporte = new THREE.Group()
    suporte.position.set(x, y, z)
    suporte.rotation.y = Math.atan2(nx, nz)
    const placa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.03), ferro)
    const argola = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 5, 12).rotateX(Math.PI / 2), ferro)
    argola.position.set(0, 0.02, 0.1)
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.42, 7), madeiraDaTocha)
    cabo.position.set(0, 0.1, 0.12)
    cabo.rotation.x = 0.38
    const cabeca = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 8), ferro)
    cabeca.position.set(0, 0.3, 0.2)
    cabeca.rotation.x = 0.38
    suporte.add(placa, argola, cabo, cabeca)
    scene.add(suporte)
    const ponta = new THREE.Vector3(0, 0.45, 0.25).applyEuler(suporte.rotation).add(suporte.position)
    const haloDaTocha = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHaloDaTocha, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }))
    haloDaTocha.position.copy(ponta)
    haloDaTocha.scale.set(1.1, 1.1, 1)
    const chama = new THREE.Sprite(new THREE.SpriteMaterial({ map: texChama, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: corLinear(THREE, 0xffd8a0) }))
    chama.position.copy(ponta)
    chama.scale.set(0.2, 0.36, 1)
    scene.add(haloDaTocha, chama)
    // Força 0: só chama e halo, sem luz pontual (cada luz a mais pesa em todo shader iluminado).
    const luz = forca > 0 ? new THREE.PointLight(corLinear(THREE, 0xffa860), forca, alcance, 2) : null
    if (luz) {
      luz.position.copy(ponta).add(new THREE.Vector3(nx * 0.25, 0, nz * 0.25))
      scene.add(luz)
    }
    tochas.push({ chama, luz, fase })
  }
  // As de fora aquecem só uma poça em volta: o resto da fachada fica no frio da névoa.
  tocha(-2.3, 2.7, 0.02, 0, 1, 0, 0.3, 4.5)
  tocha(2.3, 2.7, 0.02, 0, 1, 2.1, 0.3, 4.5)
  // A de dentro é mais fraca: acende um pouco a parede sem desmanchar a moldura escura do arco.
  tocha(VAO.meiaLargura - 0.02, 2.3, -2.3, -1, 0, 4.2, 0.22)
  tocha(-VAO.meiaLargura + 0.02, 2.3, -4.4, 1, 0, 1.3, 0.2)
  // As do segundo portão: dois pontos quentes no pátio frio, a meia névoa. Longe assim, chama e halo
  // bastam; sem luz pontual, o primeiro quadro compila mais leve.
  tocha(-2.1, 2.5, PATIO.muralha + 0.02, 0, 1, 0.7, 0)
  tocha(2.1, 2.5, PATIO.muralha + 0.02, 0, 1, 2.9, 0)

  // --- Pássaros e poeira na luz ------------------------------------------------------
  const passaros: { malha: Three.Mesh; fase: number; de: Three.Vector3; ate: Three.Vector3 }[] = []
  if (!reduzirMovimento) {
    const voo: [number, number, number, number, number, number][] =
      sentido === 'entrando'
        ? [
            [-26, 21, -26, 12, 24, -30],
            [-30, 19, -24, 8, 22, -28],
            [-24, 23, -30, 15, 26, -32],
          ]
        : [
            [16, 9, 48, -8, 11, 54],
            [19, 8, 50, -5, 10, 55],
            [14, 10.5, 52, -11, 12, 58],
          ]
    voo.forEach(([x0, y0, z0, x1, y1, z1], i) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(18).fill(0), 3))
      const m = new THREE.Mesh(geo, basico(0x262628, { side: THREE.DoubleSide }))
      m.frustumCulled = false
      scene.add(m)
      passaros.push({ malha: m, fase: i * 1.9, de: new THREE.Vector3(x0, y0, z0), ate: new THREE.Vector3(x1, y1, z1) })
    })
  }

  const N_POEIRA = 70
  /** Distância (m) abaixo da qual um grão de umidade some, em vez de cobrir a tela. */
  const POEIRA_PERTO_DEMAIS = 1.2
  const poeiraPos = new Float32Array(N_POEIRA * 3)
  const poeiraBase: number[] = []
  for (let i = 0; i < N_POEIRA; i++) poeiraBase.push((rnd() - 0.5) * 3.4, 0.3 + rnd() * 3.8, -3 + rnd() * 8, rnd() * 6)
  const poeiraGeo = new THREE.BufferGeometry()
  poeiraGeo.setAttribute('position', new THREE.BufferAttribute(poeiraPos, 3))
  const poeira = new THREE.Points(
    poeiraGeo,
    new THREE.PointsMaterial({
      size: 0.045,
      map: textura(pintarBrilho(32, [[0, 'rgba(240,240,232,1)'], [1, 'rgba(230,230,220,0)']])),
      color: corLinear(THREE, 0xc8c8c0),
      transparent: true,
      opacity: sentido === 'saindo' ? 0.4 : 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  poeira.frustumCulled = false
  scene.add(poeira)

  // --- Placa do nome e o véu de baixo (presos à câmera) ------------------------------
  const nomeLimpo = nomeDoLugar(nome)
  const veu = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textura(pintarVeuDeBaixo()), transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 }))
  veu.renderOrder = 999
  veu.visible = false
  camera.add(veu)
  const placaMat = nomeLimpo ? new THREE.MeshBasicMaterial({ map: textura(pintarNome(nomeLimpo)), transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 }) : null
  const placa = placaMat ? new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), placaMat) : null
  if (placa) {
    placa.renderOrder = 1000
    placa.visible = false
    camera.add(placa)
  }

  let aspecto = 16 / 9
  let placaY = 0
  function ajustarTela(a: number) {
    aspecto = a
    const fovHorizontal = (FOV_HORIZONTAL_MIN * Math.PI) / 180
    const precisa = (2 * Math.atan(Math.tan(fovHorizontal / 2) / a) * 180) / Math.PI
    camera.fov = Math.min(FOV_MAX, Math.max(FOV, precisa))
    camera.aspect = a
    camera.updateProjectionMatrix()
    const alturaVista = 2 * Math.tan((camera.fov * Math.PI) / 360)
    const larguraVista = alturaVista * a
    veu.scale.set(larguraVista * 1.02, alturaVista * 1.02, 1)
    veu.position.set(0, 0, -1)
    if (placa) {
      const largura = Math.min(larguraVista * (a < 1 ? 0.96 : 0.62), alturaVista * 1.5)
      placa.scale.set(largura, largura, 1)
      // Terço de baixo, sobre o tabuleiro e o chão da passagem, longe do arco e do horizonte.
      placaY = -alturaVista * 0.3
      placa.position.set(0, placaY, -0.99)
    }
  }
  ajustarTela(aspecto)

  // --- Animação ----------------------------------------------------------------------
  const alvo = new THREE.Vector3()
  function atualizarMundo(t: number) {
    materialDaAgua.uniforms.uT.value = t
    const vento = reduzirMovimento ? 0.4 : 1
    for (const [i, b] of bandeirolas.entries()) {
      const pos = b.geometry.getAttribute('position')
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v)
        pos.setZ(v, 0.16 * (x / 1.5) * Math.sin(x * 3.2 - t * 6.5 * vento + i))
      }
      pos.needsUpdate = true
    }
    for (const [i, e] of estandartes.entries()) {
      const pos = e.geometry.getAttribute('position')
      for (let v = 0; v < pos.count; v++) {
        const queda = -pos.getY(v) / 3.2
        pos.setZ(v, 0.05 * queda * queda * Math.sin(t * 1.7 * vento + i * 1.3 + queda * 2))
      }
      pos.needsUpdate = true
    }
    for (const tocha of tochas) {
      const { chama, luz, fase } = tocha
      // O motor multiplica a luz pontual depois de montar (FATOR_LUZ_PONTUAL): o tremor parte do valor já convertido.
      const tremor = 1 + 0.12 * Math.sin(t * 13 + fase) + 0.07 * Math.sin(t * 23.7 + fase * 2.3)
      chama.scale.set(0.2 * (1.1 - 0.4 * (tremor - 1)), 0.36 * tremor, 1)
      if (luz) {
        tocha.base ??= luz.intensity
        luz.intensity = tocha.base * tremor
      }
    }
    for (const p of passaros) {
      const u = t / T.escuroFim
      const pos = new THREE.Vector3().lerpVectors(p.de, p.ate, u)
      const asa = Math.sin(t * 11 + p.fase)
      const k = 0.35
      const arr = p.malha.geometry.getAttribute('position')
      const dx = p.ate.x - p.de.x > 0 ? 1 : -1
      const pontos = [
        [0, 0, 0],
        [-0.12 * dx, 0, 0],
        [-0.05 * dx, asa * k * 0.6, -k],
        [0, 0, 0],
        [-0.12 * dx, 0, 0],
        [-0.05 * dx, asa * k * 0.6, k],
      ]
      pontos.forEach(([x, y, z], v) => arr.setXYZ(v, pos.x + x * 3, pos.y + y * 3, pos.z + z * 3))
      arr.needsUpdate = true
    }
    for (let i = 0; i < N_POEIRA; i++) {
      const [bx, by, bz, f] = poeiraBase.slice(i * 4, i * 4 + 4)
      const deriva = reduzirMovimento ? 0.2 : 1
      poeiraPos[i * 3] = bx + 0.15 * Math.sin(t * 0.7 * deriva + f)
      poeiraPos[i * 3 + 1] = by + 0.1 * Math.sin(t * 0.9 * deriva + f * 1.7) + 0.05 * t * deriva
      poeiraPos[i * 3 + 2] = bz + 0.12 * Math.cos(t * 0.6 * deriva + f)
      // Grão colado no olho vira uma bola borrada na tela: some enquanto a câmera passa por ele.
      const dx = poeiraPos[i * 3] - camera.position.x
      const dy = poeiraPos[i * 3 + 1] - camera.position.y
      const dz = poeiraPos[i * 3 + 2] - camera.position.z
      if (dx * dx + dy * dy + dz * dz < POEIRA_PERTO_DEMAIS ** 2) poeiraPos[i * 3 + 1] = -50
    }
    poeiraGeo.getAttribute('position').needsUpdate = true
    const deriva = NEVOEIRO_BAIXO.deriva * (reduzirMovimento ? 0.3 : 1)
    for (const v of veus) v.tex.offset.x = v.rumo * deriva * t * v.porMetro
  }

  function atualizar(t: number) {
    const { pos, olhar, giro } = olhosEm(t, sentido, reduzirMovimento)
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(alvo.set(olhar[0], olhar[1], olhar[2]))
    camera.rotateZ(giro)
    atualizarMundo(t)
    const n = nomeEm(t)
    veu.visible = n > 0.001
    ;(veu.material as Three.MeshBasicMaterial).opacity = n
    if (placa && placaMat) {
      placa.visible = n > 0.001
      placaMat.opacity = n
      placa.position.y = placaY - (reduzirMovimento ? 0 : (1 - n) * 0.018)
    }
    return { fade: fadeDaPonte(t) }
  }

  function descartar() {
    for (const m of instanciadas) m.dispose()
    descartarCena(scene)
    for (const tex of texturas) tex.dispose()
  }

  return { scene, camera, atualizar, ajustarTela, criarSom: (kit: KitDeSom) => criarSomDaPonte(kit, sentido, reduzirMovimento, nomeLimpo !== ''), descartar }
}

// ---------------------------------------------------------------------------
// Som (todo sintetizado; disparado pelo tempo da cena)
// ---------------------------------------------------------------------------

/** Ganho da mixagem por versão: põe cada uma perto das aprovadas (~-18,6 LUFS integrado; conferir-som.cjs). */
const MIXAGEM: Record<Sentido, number> = { entrando: 1.4, saindo: 1.4 }

function criarSomDaPonte(kitDoMotor: KitDeSom, sentido: Sentido, reduzir: boolean, comNome: boolean) {
  const { ctx } = kitDoMotor
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -8
  limitador.knee.value = 6
  limitador.ratio.value = 10
  limitador.attack.value = 0.002
  limitador.release.value = 0.2
  limitador.connect(kitDoMotor.destino)
  const mixagem = ctx.createGain()
  mixagem.gain.value = MIXAGEM[sentido]
  mixagem.connect(limitador)
  /** Tudo some junto com a imagem: nenhum passo ou eco fica tocando quando a tela fecha em preto. */
  const fecharJuntoComAImagem = (at: number) => {
    const g = mixagem.gain
    g.cancelScheduledValues(at)
    g.setValueAtTime(MIXAGEM[sentido], at)
    g.setValueAtTime(MIXAGEM[sentido], at + T.escuroInicio)
    g.linearRampToValueAtTime(0, at + T.escuroFim - 0.03)
  }
  const kit: KitDeSom = { ...kitDoMotor, destino: mixagem }

  // Eco da passagem de pedra: dois retornos curtos com cauda abafada.
  const sala = ctx.createGain()
  const ecoA = ctx.createDelay(0.4)
  ecoA.delayTime.value = 0.061
  const ecoB = ctx.createDelay(0.4)
  ecoB.delayTime.value = 0.097
  const abafa = ctx.createBiquadFilter()
  abafa.type = 'lowpass'
  abafa.frequency.value = 1900
  const retorno = ctx.createGain()
  retorno.gain.value = 0.38
  sala.connect(ecoA)
  sala.connect(ecoB)
  ecoA.connect(abafa)
  ecoB.connect(abafa)
  abafa.connect(retorno).connect(ecoA)
  const molhado = ctx.createGain()
  molhado.gain.value = 0.6
  abafa.connect(molhado).connect(mixagem)

  type Pista = [nome: string, quando: number, tocar: (agora: number) => void]
  const pistas: Pista[] = [
    [
      'ambiente',
      0,
      (a) => {
        fecharJuntoComAImagem(a)
        ambiente(kit, a)
      },
    ],
  ]
  passosDosOlhos(reduzir).forEach((quando, k) => {
    const escuta = escutaDoPasso(quando, k, sentido, reduzir)
    pistas.push([`passo${k}`, quando, (a) => passo(kit, sala, a, k, escuta)])
    // Na ponte, o tabuleiro cede um nada a cada passo e as correntes das laterais tilintam, um lado de cada vez.
    if (escuta.piso === 'madeira') pistas.push([`corrente${k}`, quando + 0.035, (a) => correntes(kit, a, k % 2 === 0 ? 0.6 : -0.6, k)])
  })
  for (const [quando, pan] of sentido === 'entrando'
    ? ([
        [0.85, -0.45],
        [2.35, -0.2],
      ] as const)
    : ([
        [0.95, 0.35],
        [2.5, 0.1],
      ] as const)) {
    pistas.push([`andorinha${quando}`, quando, (a) => andorinhas(kit, a, pan)])
  }
  if (comNome) pistas.push(['nome', T.nomeInicio, (a) => acordeDoNome(kit, a)])

  const tocadas = new Set<string>()
  return {
    atualizar(t: number) {
      for (const [nome, quando, tocar] of pistas) {
        if (t >= quando && !tocadas.has(nome)) {
          tocadas.add(nome)
          tocar(ctx.currentTime)
        }
      }
    },
    reiniciar: () => tocadas.clear(),
  }
}

/** Vento manso e a água do fosso batendo na pedra; entra com a imagem e sai antes do preto. */
function ambiente(kit: KitDeSom, at: number) {
  const { ctx } = kit
  const fim = at + T.escuroFim - 0.04
  const geral = ctx.createGain()
  geral.gain.setValueAtTime(0.0001, at)
  geral.gain.exponentialRampToValueAtTime(1, at + 0.5)
  geral.gain.setValueAtTime(1, at + T.escuroInicio - 0.15)
  geral.gain.exponentialRampToValueAtTime(0.0001, fim)
  geral.connect(kit.destino)

  const vento = ctx.createBufferSource()
  vento.buffer = kit.ruido(3)
  vento.loop = true
  const ventoFiltro = ctx.createBiquadFilter()
  ventoFiltro.type = 'lowpass'
  ventoFiltro.frequency.value = 380
  const rajada = ctx.createOscillator()
  rajada.frequency.value = 0.21
  const rajadaGanho = ctx.createGain()
  rajadaGanho.gain.value = 120
  rajada.connect(rajadaGanho).connect(ventoFiltro.frequency)
  const ventoVolume = ctx.createGain()
  ventoVolume.gain.value = 0.11
  vento.connect(ventoFiltro).connect(ventoVolume).connect(geral)

  for (const [pan, deslocamento, taxa] of [
    [-0.5, 0.4, 0.37],
    [0.5, 1.6, 0.29],
  ] as const) {
    const agua = ctx.createBufferSource()
    agua.buffer = kit.ruido(3)
    agua.loop = true
    const banda = ctx.createBiquadFilter()
    banda.type = 'bandpass'
    banda.frequency.value = 620
    banda.Q.value = 0.9
    const marola = ctx.createGain()
    marola.gain.value = 0.035
    const lfo = ctx.createOscillator()
    lfo.frequency.value = taxa
    const lfoGanho = ctx.createGain()
    lfoGanho.gain.value = 0.03
    lfo.connect(lfoGanho).connect(marola.gain)
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    agua.connect(banda).connect(marola).connect(p).connect(geral)
    agua.start(at, deslocamento)
    agua.stop(fim + 0.05)
    lfo.start(at)
    lfo.stop(fim + 0.05)
  }
  vento.start(at, 0.9)
  vento.stop(fim + 0.05)
  rajada.start(at)
  rajada.stop(fim + 0.05)
}

/** Um pé assentando: madeira oca na ponte, pedra seca na passagem, terra abafada fora. */
function passo(kit: KitDeSom, sala: AudioNode, at: number, k: number, escuta: ReturnType<typeof escutaDoPasso>) {
  const { ctx } = kit
  const rnd = semente(5101 + k * 7919)
  const saida = ctx.createGain()
  saida.gain.value = escuta.volume * (0.92 + rnd() * 0.12)
  const pan = ctx.createStereoPanner()
  pan.pan.value = escuta.pan
  saida.connect(pan).connect(kit.destino)
  const envio = ctx.createGain()
  envio.gain.value = escuta.eco
  saida.connect(envio).connect(sala)

  if (escuta.piso === 'madeira') {
    const oco = ctx.createOscillator()
    oco.frequency.setValueAtTime(138 + rnd() * 22, at)
    oco.frequency.exponentialRampToValueAtTime(74, at + 0.13)
    const ocoVolume = ctx.createGain()
    ocoVolume.gain.setValueAtTime(0.0001, at)
    ocoVolume.gain.exponentialRampToValueAtTime(0.7, at + 0.006)
    ocoVolume.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
    oco.connect(ocoVolume).connect(saida)
    oco.start(at)
    oco.stop(at + 0.32)
    ruidoCurto(kit, saida, at, 0.08, 'bandpass', 1250 + rnd() * 200, 1.2, 1.0, 0.06)
  } else if (escuta.piso === 'pedra') {
    ruidoCurto(kit, saida, at, 0.2, 'lowpass', 430, 0.7, 1.1, 0.15)
    ruidoCurto(kit, saida, at + 0.01, 0.08, 'bandpass', 1800 + rnd() * 300, 2, 0.4, 0.06)
  } else {
    ruidoCurto(kit, saida, at, 0.18, 'lowpass', 300, 0.7, 0.8, 0.14)
    ruidoCurto(kit, saida, at + 0.005, 0.1, 'bandpass', 2600, 1.4, 0.22, 0.08)
  }
}

/**
 * Corrente de ferro de lado: três ou quatro elos batendo (ruído estreito e agudo, cada um com seu tom)
 * e um rangido curto e grave do ferro puxado. Baixo: é textura, não evento.
 */
function correntes(kit: KitDeSom, at: number, panValor: number, k: number) {
  const { ctx } = kit
  const rnd = semente(9203 + k * 6151)
  const pan = ctx.createStereoPanner()
  pan.pan.value = panValor
  const saida = ctx.createGain()
  saida.gain.value = 0.85 + rnd() * 0.3
  saida.connect(pan).connect(kit.destino)
  const elos = 3 + Math.floor(rnd() * 2)
  for (let i = 0; i < elos; i++) {
    const quando = at + i * (0.028 + rnd() * 0.03)
    ruidoCurto(kit, saida, quando, 0.12, 'bandpass', 2900 + rnd() * 1700, 9, 0.5 + rnd() * 0.3, 0.06 + rnd() * 0.05)
  }
  const rangido = ctx.createOscillator()
  rangido.type = 'sawtooth'
  rangido.frequency.setValueAtTime(118 + rnd() * 20, at)
  rangido.frequency.exponentialRampToValueAtTime(84, at + 0.16)
  const filtro = ctx.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.frequency.value = 700
  filtro.Q.value = 1.4
  const volume = ctx.createGain()
  volume.gain.setValueAtTime(0.0001, at)
  volume.gain.exponentialRampToValueAtTime(0.05, at + 0.02)
  volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
  rangido.connect(filtro).connect(volume).connect(saida)
  rangido.start(at)
  rangido.stop(at + 0.2)
}

function ruidoCurto(kit: KitDeSom, destino: AudioNode, at: number, dur: number, tipo: BiquadFilterType, freq: number, q: number, volume: number, queda: number) {
  const { ctx } = kit
  const s = ctx.createBufferSource()
  s.buffer = kit.ruido(dur)
  const f = ctx.createBiquadFilter()
  f.type = tipo
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(volume, at + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, at + queda)
  s.connect(f).connect(g).connect(destino)
  s.start(at)
  s.stop(at + dur)
}

/** Duas ou três andorinhas chilreando longe. */
function andorinhas(kit: KitDeSom, at: number, panValor: number) {
  const { ctx } = kit
  const pan = ctx.createStereoPanner()
  pan.pan.value = panValor
  pan.connect(kit.destino)
  const rnd = semente(Math.round(at * 1000) + 77)
  for (let i = 0; i < 3; i++) {
    const quando = at + i * (0.075 + rnd() * 0.03)
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(3600 + rnd() * 500, quando)
    o.frequency.exponentialRampToValueAtTime(5200 + rnd() * 600, quando + 0.04)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, quando)
    g.gain.exponentialRampToValueAtTime(0.022, quando + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.05)
    o.connect(g).connect(pan)
    o.start(quando)
    o.stop(quando + 0.06)
  }
}

/** Quando o nome sobe: um acorde baixo e quente (lá, mi, lá), entra devagar e some com o escuro. */
function acordeDoNome(kit: KitDeSom, at: number) {
  const { ctx } = kit
  const fim = at + (T.escuroFim - T.nomeInicio) - 0.05
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(1, at + 0.55)
  g.gain.setValueAtTime(1, at + (T.escuroInicio - T.nomeInicio))
  g.gain.exponentialRampToValueAtTime(0.0001, fim)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  lp.connect(g).connect(kit.destino)
  for (const [freq, volume, desafina] of [
    [220, 0.05, 0],
    [329.63, 0.032, 0.5],
    [440, 0.024, -0.4],
  ] as const) {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq + desafina
    const v = ctx.createGain()
    v.gain.value = volume
    o.connect(v).connect(lp)
    o.start(at)
    o.stop(fim + 0.05)
  }
}

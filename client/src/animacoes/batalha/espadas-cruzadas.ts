import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'
import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Espadas cruzadas: a primeira abertura de batalha (pedido de 27/10/2026,
 * protótipo em docs/design/transicao-batalha-espadas/). Versão de vilão
 * (ajuste do mestre no mesmo dia: "coloca elas se batendo direto, coloca um
 * impacto mais forte, royals são vilões então bota um pouco mais ameaçador").
 *
 * Duas espadas de aço escurecido, serrilhadas junto à guarda, avançam pelos
 * lados já em velocidade e se chocam no centro sem parar. O contato congela
 * por um instante (hit-stop) num clarão carmesim; então tudo estoura: duas
 * ondas de choque, faíscas, tremor forte e curto. O nome desce pesado, em
 * ferro escuro com rachaduras de brasa vermelha, e bate no lugar com um
 * segundo tranco. Névoa vermelha rola no fundo e um drone grave segura tudo
 * por baixo. No fim, dois cortes em X riscam a tela e quatro cunhas pretas
 * fecham sobre o cruzamento para a troca.
 *
 * Contrato: o mesmo `CriarCena` das transições (`src/transicoes/tipos.ts`),
 * com um campo a mais e opcional, `nome` (padrão "Royals"). Aprovada pelo
 * mestre em 27/10/2026: vai no pacote como tipo `batalha`, o app registra em
 * `transicoes/aberturasDeBatalha.ts` e toca com `tocarAberturaDeBatalha`
 * (`transicoes/motor.ts`), que passa o `nome` em `OpcoesDaCena`.
 *
 * Tudo é desenhado com `ShaderMaterial` sem conversão de cor na saída, então
 * o que foi pintado no canvas é o que aparece, com ou sem gerenciamento de
 * cor. Não há luz na cena (a conversão de luzes legadas do motor não mexe em
 * nada aqui).
 */

export const NOME_PADRAO = 'Royals'
export const NOME_MAX_LETRAS = 24

/** Roteiro em segundos (movimento completo). */
export const ROTEIRO_DAS_ESPADAS = {
  duracao: 2.8,
  fadeInFim: 0.08,
  /** As lâminas se encontram no centro, sem pausa antes. */
  impacto: 0.4,
  /** Quadro congelado no contato; depois tudo estoura. */
  congela: 0.07,
  /** O nome aparece grande, cai e bate no lugar. */
  nomeSurge: 0.53,
  nomeAssenta: 0.7,
  esfriaFim: 1.25,
  brilhoDaLaminaInicio: 1.35,
  brilhoDaLaminaFim: 1.8,
  brilhoDoNomeInicio: 1.5,
  brilhoDoNomeFim: 1.95,
  /** Dois cortes em X riscam a tela. */
  corte: 2.1,
  /** As quatro cunhas pretas fecham sobre o cruzamento. */
  fechaInicio: 2.16,
  fechaFim: 2.5,
  fadeOutInicio: 2.5,
} as const

/** Com movimento reduzido: nada voa nem treme; as espadas surgem cruzadas e o fim é um escurecer. */
export const ROTEIRO_REDUZIDO = {
  surgeFim: 0.4,
  impacto: 0.42,
  nomeSurge: 0.5,
  nomeAceso: 0.95,
  esfriaFim: 1.35,
  fadeOutInicio: 2.25,
} as const

export interface OpcoesDaBatalha extends OpcoesDaCena {
  /** O nome que aparece (grupo, equipe, inimigo). Vazio = "Royals". */
  nome?: string
}

/** Espaços juntados, até 24 letras (sem partir emoji ao meio); vazio vira o padrão. */
export function nomeDaBatalha(nome: string | undefined): string {
  const limpo = (nome ?? '').replace(/\s+/g, ' ').trim()
  return limpo === '' ? NOME_PADRAO : Array.from(limpo).slice(0, NOME_MAX_LETRAS).join('')
}

// ── Medidas ──────────────────────────────────────────────────────────────────

/** 36° do vertical: o ângulo de cada espada cruzada e dos cortes do fim. */
const ANGULO_CRUZADO = 0.628
/** Altura do cruzamento e do nome; o desenho das espadas fica centrado na tela. */
const CENTRO_Y = 0.2
const FOV = 34
const TAN_MEIO_FOV = Math.tan((FOV * Math.PI) / 360)
/** Perto o bastante para o desenho cruzado ocupar ~57% da altura em 16:9. */
const DISTANCIA_BASE = 6.6
/** Metade da largura do desenho cruzado (guarda e pomos), com folga. */
const MEIA_LARGURA_DO_DESENHO = 1.45

const ESPADA_LARGURA_PX = 480
const ESPADA_ALTURA_PX = 1600
const PX_POR_UNIDADE = 520
/** Onde as lâminas se cruzam, em px do desenho (de cima). */
const CRUZAMENTO_PX = 640

const NOME_LARGURA_PX = 2048
const NOME_ALTURA_PX = 640
const NOME_LARGURA = 4.4
const NOME_ALTURA = (NOME_LARGURA * NOME_ALTURA_PX) / NOME_LARGURA_PX
const NOME_Z = 0.6
const NOME_FONTE_MAX_PX = 330
const NOME_LARGURA_UTIL_PX = 1760
/** A fonte de título do app (`--lb-font-display`). */
const FONTE_DO_NOME = "'Sitka Banner', 'Sitka Display', Constantia, Georgia, 'Times New Roman', serif"

const N_FAISCAS = 120
const N_BRASAS = 34

// ── Shaders ──────────────────────────────────────────────────────────────────

const VERTICE = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const VERTICE_FUNDO = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const VERTICE_PARTICULA = /* glsl */ `
attribute vec3 cor;
varying vec2 vUv;
varying vec3 vCor;
void main() {
  vUv = uv;
  vCor = cor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/** Fundo: poço de vinho muito escuro no centro, quase preto nas bordas, com grão fino contra faixas. */
const FRAG_FUNDO = /* glsl */ `
uniform vec3 uCentro;
uniform vec3 uBorda;
varying vec2 vPos;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float r = length(vPos / vec2(7.0, 4.4));
  vec3 cor = mix(uCentro, uBorda, smoothstep(0.0, 1.0, r));
  cor += (hash(floor(vPos * 90.0)) - 0.5) * 0.008;
  gl_FragColor = vec4(cor, 1.0);
}`

/** Névoa vermelha: ruído fractal dobrado sobre si mesmo, mais densa embaixo, rolando devagar. */
const FRAG_NEVOA = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
uniform float uTempo;
uniform vec2 uDesvio;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ruido(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 p = vUv * vec2(4.0, 2.25) + uDesvio;
  vec2 q = vec2(fbm(p + vec2(0.0, uTempo * 0.06)), fbm(p + vec2(5.2, 1.3) - uTempo * 0.05));
  float n = fbm(p + 1.7 * q + vec2(uTempo * 0.11, -uTempo * 0.03));
  float baixo = smoothstep(1.0, 0.1, vUv.y);
  float borda = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  float v = smoothstep(0.38, 0.9, n) * (0.35 + 0.65 * baixo) * borda;
  gl_FragColor = vec4(uCor * v * uForca, 1.0);
}`

/** Espada pintada: brilho geral, luz carmesim do choque perto do cruzamento, o vermelho da névoa e um reflexo frio. */
const FRAG_ESPADA = /* glsl */ `
uniform sampler2D mapa;
uniform float uOpacidade;
uniform float uLuz;
uniform float uCalor;
uniform float uBrilho;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(mapa, vUv);
  if (c.a < 0.004) discard;
  float lamina = smoothstep(0.352, 0.37, vUv.y);
  float aco = smoothstep(0.12, 0.45, dot(c.rgb, vec3(0.333)));
  vec3 cor = c.rgb * uLuz;
  float perto = exp(-abs(vUv.y - 0.6) * 6.0);
  cor += vec3(1.0, 0.16, 0.08) * perto * uCalor * (0.35 + 0.65 * lamina) * c.a;
  cor += vec3(0.16, 0.015, 0.012) * c.a;
  float b = (vUv.y - uBrilho) / 0.028;
  cor += vec3(0.8, 0.86, 0.95) * exp(-b * b) * lamina * aco * 0.55;
  gl_FragColor = vec4(cor, c.a * uOpacidade);
}`

const FRAG_NOME_METAL = /* glsl */ `
uniform sampler2D mapa;
uniform float uOpacidade;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(mapa, vUv);
  gl_FragColor = vec4(c.rgb, c.a * uOpacidade);
}`

/**
 * Por cima do ferro (somando luz): o rubro da queda e da batida, que esfria;
 * as rachaduras em brasa que respiram e tremem; o halo vermelho; um reflexo frio.
 */
const FRAG_NOME_BRILHO = /* glsl */ `
uniform sampler2D mascara;
uniform float uCalor;
uniform float uBrasa;
uniform float uBrilho;
uniform float uOpacidade;
uniform float uLargura;
uniform float uTempo;
varying vec2 vUv;
void main() {
  vec4 k = texture2D(mascara, vUv);
  float letra = k.r;
  float halo = k.g;
  float fenda = k.b;
  vec3 quente = mix(vec3(0.6, 0.03, 0.02), vec3(1.0, 0.4, 0.22), uCalor);
  vec3 cor = quente * (letra * 0.9 * uCalor + halo * (0.35 * uBrasa + 0.6 * uCalor));
  float tremula = 0.75 + 0.25 * sin(vUv.x * 41.0 + uTempo * 7.0) * sin(vUv.y * 23.0 - uTempo * 5.0);
  cor += vec3(1.0, 0.2, 0.08) * fenda * (uBrasa * 1.1 * tremula + uCalor);
  float s = (vUv.x - 0.5) / uLargura + 0.5 + (vUv.y - 0.5) * 0.18;
  float b = (s - uBrilho) / 0.045;
  cor += vec3(0.8, 0.86, 0.95) * exp(-b * b) * letra * 0.45;
  gl_FragColor = vec4(cor * uOpacidade, 1.0);
}`

/** Clarão: miolo quase branco e halo carmesim. */
const FRAG_CLARAO = /* glsl */ `
uniform vec3 uMiolo;
uniform vec3 uCor;
uniform float uForca;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  vec3 cor = uMiolo * exp(-r2 * 28.0) * 1.2 + uCor * exp(-r2 * 5.0) * 0.6;
  cor *= 1.0 - smoothstep(0.7, 1.0, r2);
  gl_FragColor = vec4(cor * uForca, 1.0);
}`

/** Estrela de quatro raios do choque. */
const FRAG_ESTRELA = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float h = exp(-abs(p.y) * 60.0) * pow(max(0.0, 1.0 - abs(p.x)), 2.0);
  float v = exp(-abs(p.x) * 60.0) * pow(max(0.0, 1.0 - abs(p.y)), 2.0);
  float miolo = exp(-dot(p, p) * 40.0);
  gl_FragColor = vec4(uCor * (h + v * 0.8 + miolo) * uForca, 1.0);
}`

/** Onda de choque: anel de espessura própria (`uEspessura` em fração do raio). */
const FRAG_ONDA = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
uniform float uEspessura;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float fino = (r - 0.8) / uEspessura;
  float largo = (r - 0.78) / (uEspessura * 3.5);
  float v = exp(-fino * fino) + exp(-largo * largo) * 0.3;
  gl_FragColor = vec4(uCor * v * uForca, 1.0);
}`

const FRAG_POCO = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  gl_FragColor = vec4(uCor * exp(-dot(p, p) * 3.2) * uForca, 1.0);
}`

const FRAG_COR_LISA = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
void main() {
  gl_FragColor = vec4(uCor * uForca, 1.0);
}`

/** Risco do corte: núcleo fino e um véu largo; desenha de uma ponta à outra. */
const FRAG_CORTE = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
uniform float uDesenho;
varying vec2 vUv;
void main() {
  float a = abs(vUv.y - 0.5) * 2.0;
  float v = exp(-a * a * 60.0) + exp(-a * a * 6.0) * 0.25;
  float desenhado = step(vUv.x, uDesenho);
  float pontas = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  gl_FragColor = vec4(uCor * v * desenhado * pontas * uForca, 1.0);
}`

/** Faísca alongada: cauda que some, cabeça quente. */
const FRAG_PARTICULA = /* glsl */ `
varying vec2 vUv;
varying vec3 vCor;
void main() {
  float a = (vUv.y - 0.5) / 0.25;
  float atraves = exp(-a * a);
  float aoLongo = smoothstep(0.0, 1.0, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x) * 0.5);
  gl_FragColor = vec4(vCor * atraves * aoLongo, 1.0);
}`

const FRAG_CUNHA = /* glsl */ `
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`

// ── Pintura (canvas) ─────────────────────────────────────────────────────────

interface Descartavel {
  dispose: () => void
}

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponível')
  return [canvas, ctx]
}

/** Contorno das peças: quase preto e frio, nunca preto puro (régua do estilo do app). */
const CONTORNO = '#140f11'

/** Ferro enegrecido: claro só no fio de cima. */
function ferro(g: CanvasRenderingContext2D, topo: number, pe: number): CanvasGradient {
  const grad = g.createLinearGradient(0, topo, 0, pe)
  grad.addColorStop(0, '#7a7f88')
  grad.addColorStop(0.4, '#454a52')
  grad.addColorStop(0.75, '#24272c')
  grad.addColorStop(1, '#111216')
  return grad
}

function granada(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  const grad = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry) * 1.15)
  grad.addColorStop(0, '#ff7a66')
  grad.addColorStop(0.4, '#c0141e')
  grad.addColorStop(1, '#4a0508')
  g.fillStyle = grad
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#1c0a0b'
  g.lineWidth = 2.5
  g.stroke()
  g.fillStyle = 'rgba(255, 225, 220, 0.75)'
  g.beginPath()
  g.ellipse(x - rx * 0.3, y - ry * 0.45, rx * 0.25, ry * 0.28, -0.3, 0, Math.PI * 2)
  g.fill()
}

/**
 * A espada em pé, ponta para cima, num canvas de 480 × 1600 (520 px por
 * unidade): lâmina de aço escurecido em duas facetas, fio claro só do lado da
 * luz, sulco central e quatro dentes de serra junto à guarda; guarda de ferro
 * com as pontas afiadas viradas para a lâmina e um filete vermelho; escudete
 * em forma de presa com uma granada; punho de couro preto trançado com cordão
 * carmesim; pomo em ponta de diamante. A segunda espada é a mesma imagem espelhada.
 */
function pintarEspada(THREE: ThreeModule): Three.CanvasTexture {
  const [canvas, g] = tela(ESPADA_LARGURA_PX, ESPADA_ALTURA_PX)
  const cx = ESPADA_LARGURA_PX / 2
  const rnd = semente(1931)
  g.lineJoin = 'round'
  g.lineCap = 'round'

  // Lâmina: base 1034, ponta 30. O fio desce reto e tem quatro dentes junto à guarda.
  const meiaLargura = (y: number) => 31 + ((y - 330) / (1034 - 330)) * 11
  const borda: [number, number][] = [[42, 1034]]
  for (let k = 0; k < 4; k++) {
    const y = 1000 - k * 44
    borda.push([meiaLargura(y), y], [meiaLargura(y) - 12, y - 10], [meiaLargura(y - 26), y - 26])
  }
  borda.push([31, 330])
  const fio = (lado: 1 | -1) => {
    const p = new Path2D()
    borda.forEach(([dx, y], i) => (i === 0 ? p.moveTo(cx + lado * dx, y) : p.lineTo(cx + lado * dx, y)))
    p.quadraticCurveTo(cx + lado * 28, 190, cx, 30)
    return p
  }
  const lamina = new Path2D()
  borda.forEach(([dx, y], i) => (i === 0 ? lamina.moveTo(cx - dx, y) : lamina.lineTo(cx - dx, y)))
  lamina.quadraticCurveTo(cx - 28, 190, cx, 30)
  lamina.quadraticCurveTo(cx + 28, 190, cx + 31, 330)
  for (let i = borda.length - 1; i >= 0; i--) lamina.lineTo(cx + borda[i][0], borda[i][1])
  lamina.closePath()
  g.strokeStyle = CONTORNO
  g.lineWidth = 7
  g.stroke(lamina)
  g.save()
  g.clip(lamina)
  const clara = g.createLinearGradient(cx - 42, 0, cx, 0)
  clara.addColorStop(0, '#5b6068')
  clara.addColorStop(1, '#8c929b')
  g.fillStyle = clara
  g.fillRect(cx - 50, 0, 50, 1040)
  const escura = g.createLinearGradient(cx, 0, cx + 42, 0)
  escura.addColorStop(0, '#2c3036')
  escura.addColorStop(1, '#1b1d22')
  g.fillStyle = escura
  g.fillRect(cx, 0, 50, 1040)
  g.lineWidth = 4
  g.strokeStyle = '#b9c0c9'
  g.stroke(fio(-1))
  g.strokeStyle = '#0d0e11'
  g.stroke(fio(1))
  const reflexo = g.createLinearGradient(0, 360, 0, 660)
  reflexo.addColorStop(0, 'rgba(200, 210, 225, 0)')
  reflexo.addColorStop(0.5, 'rgba(200, 210, 225, 0.12)')
  reflexo.addColorStop(1, 'rgba(200, 210, 225, 0)')
  g.fillStyle = reflexo
  g.fillRect(cx - 50, 360, 100, 300)
  const baseEscura = g.createLinearGradient(0, 860, 0, 1034)
  baseEscura.addColorStop(0, 'rgba(8, 6, 8, 0)')
  baseEscura.addColorStop(1, 'rgba(8, 6, 8, 0.35)')
  g.fillStyle = baseEscura
  g.fillRect(cx - 50, 860, 100, 180)
  g.strokeStyle = 'rgba(200, 208, 220, 0.35)'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(cx - 0.5, 1030)
  g.lineTo(cx - 0.5, 60)
  g.stroke()
  const sulco = g.createLinearGradient(cx - 8, 0, cx + 8, 0)
  sulco.addColorStop(0, '#16181c')
  sulco.addColorStop(0.45, '#3b3f46')
  sulco.addColorStop(1, '#1d2025')
  g.fillStyle = sulco
  g.beginPath()
  g.roundRect(cx - 8, 430, 16, 584, 8)
  g.fill()
  g.strokeStyle = 'rgba(160, 168, 180, 0.3)'
  g.lineWidth = 1
  g.stroke()
  g.lineWidth = 1
  for (let i = 0; i < 90; i++) {
    const x = cx + (rnd() - 0.5) * 70
    const y = 120 + rnd() * 900
    const comprimento = 6 + rnd() * 20
    const inclinacao = (rnd() - 0.5) * 0.9
    g.strokeStyle = rnd() < 0.5 ? `rgba(220, 225, 235, ${0.04 + rnd() * 0.05})` : `rgba(0, 0, 0, ${0.08 + rnd() * 0.08})`
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.sin(inclinacao) * comprimento, y + Math.cos(inclinacao) * comprimento)
    g.stroke()
  }
  g.restore()

  // Punho de couro preto com cordão carmesim.
  const punho = new Path2D()
  punho.moveTo(cx - 25, 1100)
  punho.quadraticCurveTo(cx - 31, 1243, cx - 25, 1386)
  punho.lineTo(cx + 25, 1386)
  punho.quadraticCurveTo(cx + 31, 1243, cx + 25, 1100)
  punho.closePath()
  g.strokeStyle = CONTORNO
  g.lineWidth = 6
  g.stroke(punho)
  g.save()
  g.clip(punho)
  const couro = g.createLinearGradient(cx - 30, 0, cx + 30, 0)
  couro.addColorStop(0, '#120c0d')
  couro.addColorStop(0.27, '#3a2b2d')
  couro.addColorStop(0.57, '#1c1416')
  couro.addColorStop(1, '#0c0809')
  g.fillStyle = couro
  g.fillRect(cx - 40, 1090, 80, 310)
  for (let y = 1084; y < 1400; y += 22) {
    g.strokeStyle = 'rgba(130, 16, 20, 0.9)'
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(cx - 34, y)
    g.lineTo(cx + 34, y + 16)
    g.stroke()
    g.strokeStyle = 'rgba(255, 120, 110, 0.18)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(cx - 34, y - 3)
    g.lineTo(cx + 34, y + 13)
    g.stroke()
  }
  g.restore()

  // Anel de ferro entre o punho e o pomo.
  g.fillStyle = CONTORNO
  g.beginPath()
  g.roundRect(cx - 36, 1377, 72, 24, 9)
  g.fill()
  g.fillStyle = ferro(g, 1380, 1398)
  g.beginPath()
  g.roundRect(cx - 33, 1380, 66, 18, 7)
  g.fill()

  // Guarda: braços com ponta afiada, escudete em presa. Contornos primeiro, depois o ferro.
  const braco = (lado: 1 | -1) => {
    const p = new Path2D()
    p.moveTo(cx, 1030)
    p.quadraticCurveTo(cx + lado * 120, 1034, cx + lado * 212, 984)
    p.quadraticCurveTo(cx + lado * 140, 1064, cx, 1080)
    p.closePath()
    return p
  }
  const escudete = new Path2D()
  escudete.moveTo(cx, 1004)
  escudete.lineTo(cx + 40, 1028)
  escudete.lineTo(cx + 30, 1070)
  escudete.lineTo(cx, 1122)
  escudete.lineTo(cx - 30, 1070)
  escudete.lineTo(cx - 40, 1028)
  escudete.closePath()
  g.lineJoin = 'miter'
  g.strokeStyle = CONTORNO
  g.lineWidth = 9
  g.stroke(braco(-1))
  g.stroke(braco(1))
  g.lineWidth = 11
  g.stroke(escudete)
  const ferroDaGuarda = ferro(g, 980, 1090)
  g.fillStyle = ferroDaGuarda
  g.fill(braco(-1))
  g.fill(braco(1))
  for (const lado of [-1, 1] as const) {
    g.strokeStyle = 'rgba(210, 215, 225, 0.35)'
    g.lineWidth = 2.5
    g.beginPath()
    g.moveTo(cx, 1036)
    g.quadraticCurveTo(cx + lado * 118, 1040, cx + lado * 200, 994)
    g.stroke()
    g.strokeStyle = '#8e1a1a'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(cx + lado * 30, 1054)
    g.quadraticCurveTo(cx + lado * 110, 1052, cx + lado * 170, 1012)
    g.stroke()
    g.strokeStyle = 'rgba(255, 90, 70, 0.5)'
    g.lineWidth = 1
    g.stroke()
  }
  g.fillStyle = ferroDaGuarda
  g.fill(escudete)
  g.save()
  g.translate(cx, 1058)
  g.scale(0.72, 0.72)
  g.translate(-cx, -1058)
  g.strokeStyle = 'rgba(150, 155, 165, 0.35)'
  g.lineWidth = 3
  g.stroke(escudete)
  g.restore()
  g.lineJoin = 'round'
  granada(g, cx, 1052, 12, 17)

  // Pomo em ponta de diamante, com uma granada pequena.
  const pomo = new Path2D()
  pomo.moveTo(cx, 1398)
  pomo.lineTo(cx + 34, 1440)
  pomo.lineTo(cx, 1512)
  pomo.lineTo(cx - 34, 1440)
  pomo.closePath()
  g.lineJoin = 'miter'
  g.strokeStyle = CONTORNO
  g.lineWidth = 9
  g.stroke(pomo)
  g.fillStyle = ferro(g, 1398, 1512)
  g.fill(pomo)
  g.save()
  g.clip(pomo)
  g.fillStyle = 'rgba(255, 255, 255, 0.12)'
  g.fillRect(cx - 40, 1390, 40, 130)
  g.restore()
  g.lineJoin = 'round'
  granada(g, cx, 1442, 8, 9)

  return new THREE.CanvasTexture(canvas)
}

interface NomePintado {
  metal: Three.CanvasTexture
  /** Meia resolução: vermelho = letras com o aro, verde = halo borrado, azul = rachaduras. */
  mascara: Three.CanvasTexture
  /** Largura do texto (com o aro) em fração da largura do plano. */
  fracao: number
}

/**
 * O nome em ferro escuro: aro quase preto, chanfro frio, face com faixas de
 * metal fosco, rachaduras cavadas (que a brasa acende no shader) e duas sombras
 * por baixo. Encolhe para caber até 24 letras.
 */
function pintarNome(THREE: ThreeModule, nome: string): NomePintado {
  const [canvas, g] = tela(NOME_LARGURA_PX, NOME_ALTURA_PX)
  const fonte = (px: number) => `600 ${px}px ${FONTE_DO_NOME}`
  g.font = fonte(100)
  const largura100 = Math.max(1, g.measureText(nome).width)
  const px = Math.min(NOME_FONTE_MAX_PX, (100 * NOME_LARGURA_UTIL_PX) / largura100)
  g.font = fonte(px)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  const medida = g.measureText(nome)
  const subida = medida.actualBoundingBoxAscent || px * 0.7
  const descida = medida.actualBoundingBoxDescent || 0
  const alturaDoH = g.measureText('H').actualBoundingBoxAscent || px * 0.68
  const cx = NOME_LARGURA_PX / 2
  const base = NOME_ALTURA_PX / 2 + (subida - descida) / 2
  const aro = px * 0.075
  const topo = base - alturaDoH
  const pe = base + alturaDoH * 0.2
  g.lineJoin = 'round'
  g.miterLimit = 2

  g.strokeStyle = '#0b0809'
  g.lineWidth = aro
  g.strokeText(nome, cx, base)
  const chanfro = g.createLinearGradient(0, topo, 0, pe)
  chanfro.addColorStop(0, '#b4b9c1')
  chanfro.addColorStop(0.5, '#4a4f57')
  chanfro.addColorStop(1, '#0f1013')
  g.strokeStyle = chanfro
  g.lineWidth = px * 0.034
  g.strokeText(nome, cx, base)
  const face = g.createLinearGradient(0, topo, 0, pe)
  face.addColorStop(0, '#8a8f97')
  face.addColorStop(0.25, '#5d626a')
  face.addColorStop(0.48, '#33373d')
  face.addColorStop(0.52, '#18191d')
  face.addColorStop(0.6, '#41454c')
  face.addColorStop(0.85, '#25282d')
  face.addColorStop(1, '#111215')
  g.fillStyle = face
  g.fillText(nome, cx, base)

  // Rachaduras: um caminho só, usado no ferro (cavado) e na máscara (brasa).
  const rnd = semente(5381)
  const fendas = new Path2D()
  // Rachadura de verdade: quase reta, com quebras secas, sem serpentear.
  const nFendas = Math.max(5, Math.round(Array.from(nome).length * 2.5))
  const inicioX = cx - medida.width / 2
  for (let i = 0; i < nFendas; i++) {
    let x = inicioX + rnd() * medida.width
    let y = topo + rnd() * (base - topo)
    fendas.moveTo(x, y)
    let angulo = rnd() * Math.PI * 2
    const passos = 2 + Math.floor(rnd() * 3)
    for (let j = 0; j < passos; j++) {
      angulo += (rnd() - 0.5) * 0.9
      const passo = px * (0.06 + rnd() * 0.08)
      x += Math.cos(angulo) * passo
      y += Math.sin(angulo) * passo
      fendas.lineTo(x, y)
    }
  }
  g.save()
  g.globalCompositeOperation = 'source-atop'
  g.strokeStyle = '#0b0708'
  g.lineWidth = px * 0.02
  g.stroke(fendas)
  g.strokeStyle = '#4a0c0c'
  g.lineWidth = px * 0.008
  g.stroke(fendas)
  g.lineWidth = 1.2
  for (let i = 0; i < 220; i++) {
    const x = cx + (rnd() - 0.5) * medida.width
    const y = topo + rnd() * (pe - topo + descida)
    const comprimento = 4 + rnd() * 16
    const angulo = rnd() * Math.PI
    g.strokeStyle = rnd() < 0.5 ? 'rgba(220, 225, 235, 0.07)' : 'rgba(0, 0, 0, 0.14)'
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(angulo) * comprimento, y + Math.sin(angulo) * comprimento)
    g.stroke()
  }
  g.restore()

  // Sombras por baixo do que já existe.
  g.save()
  g.globalCompositeOperation = 'destination-over'
  g.fillStyle = '#060405'
  g.strokeStyle = '#060405'
  g.lineWidth = aro
  g.shadowColor = 'rgba(0, 0, 0, 0.9)'
  g.shadowBlur = px * 0.1
  g.shadowOffsetY = px * 0.045
  g.fillText(nome, cx, base)
  g.strokeText(nome, cx, base)
  g.shadowColor = 'rgba(0, 0, 0, 0.7)'
  g.shadowBlur = px * 0.4
  g.shadowOffsetY = 0
  g.fillText(nome, cx, base)
  g.strokeText(nome, cx, base)
  g.restore()

  // Máscara: o halo é a sombra de um texto desenhado fora da tela (funciona sem `ctx.filter`).
  const [canvasM, k] = tela(NOME_LARGURA_PX / 2, NOME_ALTURA_PX / 2)
  k.fillStyle = '#000'
  k.fillRect(0, 0, canvasM.width, canvasM.height)
  k.font = fonte(px / 2)
  k.textAlign = 'center'
  k.textBaseline = 'alphabetic'
  k.lineJoin = 'round'
  const FORA = 5000
  k.save()
  k.shadowColor = 'rgb(0, 255, 0)'
  k.shadowBlur = px * 0.14
  k.shadowOffsetX = FORA
  k.fillStyle = '#fff'
  k.fillText(nome, cx / 2 - FORA, base / 2)
  k.fillText(nome, cx / 2 - FORA, base / 2)
  k.restore()
  k.globalCompositeOperation = 'lighter'
  k.fillStyle = 'rgb(255, 0, 0)'
  k.strokeStyle = 'rgb(255, 0, 0)'
  k.lineWidth = aro / 2
  k.fillText(nome, cx / 2, base / 2)
  k.strokeText(nome, cx / 2, base / 2)
  // Rachaduras só dentro das letras: letras como destino, traço com `source-in`.
  const [canvasF, f] = tela(canvasM.width, canvasM.height)
  f.scale(0.5, 0.5)
  f.font = fonte(px)
  f.textAlign = 'center'
  f.textBaseline = 'alphabetic'
  f.fillStyle = '#fff'
  f.fillText(nome, cx, base)
  f.globalCompositeOperation = 'source-in'
  f.strokeStyle = 'rgb(0, 0, 255)'
  f.lineJoin = 'round'
  f.lineCap = 'round'
  f.lineWidth = px * 0.018
  f.stroke(fendas)
  k.save()
  k.shadowColor = 'rgb(0, 0, 255)'
  k.shadowBlur = px * 0.03
  k.drawImage(canvasF, 0, 0)
  k.restore()

  return {
    metal: new THREE.CanvasTexture(canvas),
    mascara: new THREE.CanvasTexture(canvasM),
    fracao: Math.min(1, (medida.width + aro) / NOME_LARGURA_PX),
  }
}

// ── Movimento ────────────────────────────────────────────────────────────────

interface PoseDaEspada {
  x: number
  y: number
  rz: number
  ry: number
}

/** A espada da esquerda; a da direita é o espelho (x e rotações com o sinal trocado). */
const POSE_FORA: PoseDaEspada = { x: -6, y: -1.2, rz: -1.5, ry: 1 }
const POSE_CRUZADA: PoseDaEspada = { x: 0, y: 0, rz: -ANGULO_CRUZADO, ry: 0 }

const easeInCubic = (x: number): number => x * x * x

function poseDaEspada(t: number, reduzir: boolean): PoseDaEspada {
  const T = ROTEIRO_DAS_ESPADAS
  if (reduzir) return POSE_CRUZADA
  if (t < T.impacto) {
    // Entra já em velocidade e ainda acelera até bater: nenhuma parada antes do choque.
    const u = span(t, 0, T.impacto)
    const k = 0.45 * u + 0.55 * u * u
    const a = POSE_FORA
    const b = POSE_CRUZADA
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, rz: a.rz + (b.rz - a.rz) * k, ry: a.ry * (1 - easeOutCubic(span(u, 0, 0.75))) }
  }
  // Congela no contato, depois o rebote amortecido (empurram uma à outra).
  const tau = Math.max(0, t - T.impacto - T.congela)
  const rebote = Math.exp(-tau * 10) * Math.sin(tau * 34)
  return { x: -0.12 * rebote, y: 0, rz: -ANGULO_CRUZADO + 0.085 * rebote, ry: 0 }
}

/** Ida e volta rápida que vale 1 em `pico` segundos. */
function pancada(tau: number, pico: number): number {
  if (tau <= 0) return 0
  return (tau / pico) * Math.exp(1 - tau / pico)
}

interface EstadoDaCamera {
  x: number
  y: number
  z: number
  giro: number
}

function estadoDaCamera(t: number, reduzir: boolean, distancia: number): EstadoDaCamera {
  const T = ROTEIRO_DAS_ESPADAS
  if (reduzir) return { x: 0, y: 0, z: distancia, giro: 0 }
  const escala = distancia / DISTANCIA_BASE
  const estouro = T.impacto + T.congela
  // Vem junto com as espadas, para no contato, e depois se aproxima devagar até o fim.
  const u = span(t, 0, T.impacto)
  let z = distancia * (1.04 - 0.04 * u * u) * (1 - 0.045 * easeInOutSine(span(t, estouro, T.fechaFim)))
  const tau = t - estouro
  z -= 0.45 * escala * pancada(tau, 0.035)
  // Tremor forte e curto no estouro; um segundo, menor, quando o nome bate.
  const tauNome = t - T.nomeAssenta
  const forte = tau > 0 ? 0.15 * escala * Math.exp(-tau * 16) : 0
  const nome = tauNome > 0 ? 0.05 * escala * Math.exp(-tauNome * 20) : 0
  return {
    x: forte * (Math.sin(tau * 110) + 0.5 * Math.sin(tau * 170)) + nome * Math.sin(tauNome * 120),
    y: forte * 0.8 * (Math.cos(tau * 97) + 0.5 * Math.sin(tau * 151)) + nome * Math.cos(tauNome * 105),
    z,
    giro: tau > 0 ? 0.02 * Math.exp(-tau * 16) * Math.sin(tau * 83) : 0,
  }
}

function fadeDasEspadas(t: number, reduzir: boolean): number {
  const T = ROTEIRO_DAS_ESPADAS
  const entrada = 1 - span(t, 0, T.fadeInFim)
  const saida = reduzir ? easeInOutSine(span(t, ROTEIRO_REDUZIDO.fadeOutInicio, T.duracao)) : span(t, T.fadeOutInicio, T.duracao)
  return Math.max(entrada, saida)
}

// ── Partículas ───────────────────────────────────────────────────────────────

interface Particulas {
  malha: Three.Mesh
  /** Cabeça em (x, y); a cauda vai para trás na direção (dx, dy). */
  definir: (i: number, x: number, y: number, dx: number, dy: number, comprimento: number, largura: number, r: number, g: number, b: number) => void
  esconder: (i: number) => void
  enviar: () => void
}

function criarParticulas(THREE: ThreeModule, n: number, z: number, ordem: number, guardar: <T extends Descartavel>(x: T) => T): Particulas {
  const pos = new Float32Array(n * 12)
  const cor = new Float32Array(n * 12)
  const uv = new Float32Array(n * 8)
  const indices: number[] = []
  for (let i = 0; i < n; i++) {
    uv.set([0, 0, 0, 1, 1, 1, 1, 0], i * 8)
    const v = i * 4
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3)
  }
  const geo = guardar(new THREE.BufferGeometry())
  const atributoPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
  const atributoCor = new THREE.BufferAttribute(cor, 3).setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', atributoPos)
  geo.setAttribute('cor', atributoCor)
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(indices)
  const mat = guardar(
    new THREE.ShaderMaterial({
      vertexShader: VERTICE_PARTICULA,
      fragmentShader: FRAG_PARTICULA,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  )
  const malha = new THREE.Mesh(geo, mat)
  malha.frustumCulled = false
  malha.renderOrder = ordem
  return {
    malha,
    definir(i, x, y, dx, dy, comprimento, largura, r, g, b) {
      const tamanho = Math.hypot(dx, dy) || 1
      const ux = dx / tamanho
      const uy = dy / tamanho
      const nx = (-uy * largura) / 2
      const ny = (ux * largura) / 2
      const tx = x - ux * comprimento
      const ty = y - uy * comprimento
      pos.set([tx + nx, ty + ny, z, tx - nx, ty - ny, z, x - nx, y - ny, z, x + nx, y + ny, z], i * 12)
      for (let c = 0; c < 4; c++) cor.set([r, g, b], i * 12 + c * 3)
    },
    esconder(i) {
      pos.fill(0, i * 12, i * 12 + 12)
      cor.fill(0, i * 12, i * 12 + 12)
    },
    enviar() {
      atributoPos.needsUpdate = true
      atributoCor.needsUpdate = true
    },
  }
}

// ── Cena ─────────────────────────────────────────────────────────────────────

export function criarCenaEspadasCruzadas(THREE: ThreeModule, opcoes: OpcoesDaBatalha): CenaTransicao {
  const reduzir = opcoes.reduzirMovimento
  const T = ROTEIRO_DAS_ESPADAS
  const R = ROTEIRO_REDUZIDO
  const lixo: Descartavel[] = []
  const guardar = <X extends Descartavel>(x: X): X => {
    lixo.push(x)
    return x
  }
  const vec3 = (r: number, g: number, b: number) => new THREE.Vector3(r, g, b)
  const material = (vertexShader: string, fragmentShader: string, uniforms: Record<string, Three.IUniform>, aditivo: boolean) =>
    guardar(
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
        side: THREE.DoubleSide,
      }),
    )
  const malha = (geo: Three.BufferGeometry, mat: Three.Material, ordem: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.renderOrder = ordem
    m.frustumCulled = false
    return m
  }
  const quadrado = guardar(new THREE.PlaneGeometry(1, 1))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 80)
  scene.add(camera)
  let aspecto = 16 / 9
  let distancia = DISTANCIA_BASE

  // Fundo opaco: vai primeiro, sem escrever profundidade.
  const fundo = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(80, 45)),
    guardar(
      new THREE.ShaderMaterial({
        vertexShader: VERTICE_FUNDO,
        fragmentShader: FRAG_FUNDO,
        uniforms: { uCentro: { value: vec3(0.05, 0.018, 0.02) }, uBorda: { value: vec3(0.006, 0.004, 0.005) } },
        depthWrite: false,
        depthTest: false,
      }),
    ),
  )
  fundo.position.z = -3
  fundo.renderOrder = 0
  fundo.frustumCulled = false
  scene.add(fundo)

  // Névoa vermelha atrás das espadas e um véu baixo na frente delas.
  const uNevoaFundo = { uCor: { value: vec3(0.32, 0.03, 0.03) }, uForca: { value: 0 }, uTempo: { value: 0 }, uDesvio: { value: new THREE.Vector2(0, 0) } }
  const nevoaFundo = malha(quadrado, material(VERTICE, FRAG_NEVOA, uNevoaFundo, true), 1)
  nevoaFundo.scale.set(16, 9, 1)
  nevoaFundo.position.set(0, 0, -1.5)
  const uNevoaFrente = { uCor: { value: vec3(0.26, 0.02, 0.025) }, uForca: { value: 0 }, uTempo: { value: 0 }, uDesvio: { value: new THREE.Vector2(3.7, 1.9) } }
  const nevoaFrente = malha(quadrado, material(VERTICE, FRAG_NEVOA, uNevoaFrente, true), 10)
  nevoaFrente.scale.set(12, 4.5, 1)
  nevoaFrente.position.set(0, -1.6, 1)
  scene.add(nevoaFundo, nevoaFrente)

  // Poço de luz carmesim atrás do nome.
  const uPoco = { uCor: { value: vec3(0.3, 0.02, 0.02) }, uForca: { value: 0 } }
  const poco = malha(quadrado, material(VERTICE, FRAG_POCO, uPoco, true), 2)
  poco.scale.set(9, 6, 1)
  poco.position.set(0, CENTRO_Y, -1.2)
  scene.add(poco)

  // Brasas que sobem devagar depois do choque (atrás das espadas).
  const rndBrasas = semente(2711)
  const brasas = Array.from({ length: N_BRASAS }, () => ({
    x: (rndBrasas() * 2 - 1) * 3.6,
    y0: rndBrasas(),
    vel: 0.16 + 0.22 * rndBrasas(),
    fase: rndBrasas() * Math.PI * 2,
    tamanho: 0.02 + 0.02 * rndBrasas(),
  }))
  const particulasDeBrasa = criarParticulas(THREE, N_BRASAS, -0.8, 3, guardar)
  particulasDeBrasa.malha.visible = !reduzir
  scene.add(particulasDeBrasa.malha)

  // Espadas: grupo no ponto do cruzamento; rastro de duas cópias enquanto voam.
  const texturaDaEspada = guardar(pintarEspada(THREE))
  const geoEspada = guardar(new THREE.PlaneGeometry(ESPADA_LARGURA_PX / PX_POR_UNIDADE, ESPADA_ALTURA_PX / PX_POR_UNIDADE))
  const descidaDoDesenho = (ESPADA_ALTURA_PX / 2 - CRUZAMENTO_PX) / PX_POR_UNIDADE
  const emblema = new THREE.Group()
  emblema.position.y = CENTRO_Y
  scene.add(emblema)
  interface Espada {
    grupo: Three.Group
    uniforms: { mapa: Three.IUniform<Three.Texture>; uOpacidade: Three.IUniform<number>; uLuz: Three.IUniform<number>; uCalor: Three.IUniform<number>; uBrilho: Three.IUniform<number> }
  }
  const RASTRO = [0.025, 0.05]
  const criarEspada = (espelho: boolean, ordem: number, z: number): Espada => {
    const uniforms = { mapa: { value: texturaDaEspada as Three.Texture }, uOpacidade: { value: 1 }, uLuz: { value: 1 }, uCalor: { value: 0 }, uBrilho: { value: -1 } }
    const grupo = new THREE.Group()
    const desenho = malha(geoEspada, material(VERTICE, FRAG_ESPADA, uniforms, false), ordem)
    desenho.position.y = -descidaDoDesenho
    if (espelho) desenho.scale.x = -1
    grupo.add(desenho)
    grupo.position.z = z
    emblema.add(grupo)
    return { grupo, uniforms }
  }
  // Ordem: rastros da direita, direita, rastros da esquerda, esquerda (a da esquerda cruza por cima).
  const rastroDireita = RASTRO.map(() => criarEspada(true, 4, -0.03))
  const direita = criarEspada(true, 5, -0.03)
  const rastroEsquerda = RASTRO.map(() => criarEspada(false, 6, 0.03))
  const esquerda = criarEspada(false, 7, 0.03)
  const aplicarPose = (espada: Espada, pose: PoseDaEspada, lado: 1 | -1) => {
    espada.grupo.position.x = pose.x * -lado
    espada.grupo.position.y = pose.y
    espada.grupo.rotation.z = pose.rz * -lado
    espada.grupo.rotation.y = pose.ry * -lado
  }

  // Choque: duas ondas (uma rápida e fina, outra lenta e larga), clarão e estrela no cruzamento.
  const uOndaRapida = { uCor: { value: vec3(1, 0.45, 0.38) }, uForca: { value: 0 }, uEspessura: { value: 0.03 } }
  const ondaRapida = malha(quadrado, material(VERTICE, FRAG_ONDA, uOndaRapida, true), 8)
  ondaRapida.position.set(0, CENTRO_Y, 0.3)
  const uOndaLarga = { uCor: { value: vec3(0.85, 0.08, 0.06) }, uForca: { value: 0 }, uEspessura: { value: 0.07 } }
  const ondaLarga = malha(quadrado, material(VERTICE, FRAG_ONDA, uOndaLarga, true), 8)
  ondaLarga.position.set(0, CENTRO_Y, 0.28)
  const uClarao = { uMiolo: { value: vec3(1, 0.9, 0.86) }, uCor: { value: vec3(0.95, 0.14, 0.08) }, uForca: { value: 0 } }
  const clarao = malha(quadrado, material(VERTICE, FRAG_CLARAO, uClarao, true), 9)
  clarao.position.set(0, CENTRO_Y, 0.35)
  const uEstrela = { uCor: { value: vec3(1, 0.8, 0.75) }, uForca: { value: 0 } }
  const estrela = malha(quadrado, material(VERTICE, FRAG_ESTRELA, uEstrela, true), 9)
  estrela.position.set(0, CENTRO_Y, 0.4)
  ondaRapida.visible = !reduzir
  ondaLarga.visible = !reduzir
  estrela.visible = !reduzir
  scene.add(ondaLarga, ondaRapida, clarao, estrela)

  // Nome.
  const nome = nomeDaBatalha(opcoes.nome)
  const pintado = pintarNome(THREE, nome)
  guardar(pintado.metal)
  guardar(pintado.mascara)
  const larguraDoNome = NOME_LARGURA * pintado.fracao
  const uNome = {
    mapa: { value: pintado.metal },
    mascara: { value: pintado.mascara },
    uCalor: { value: 0 },
    uBrasa: { value: 0 },
    uBrilho: { value: -1 },
    uOpacidade: { value: 0 },
    uLargura: { value: Math.max(0.05, pintado.fracao) },
    uTempo: { value: 0 },
  }
  const geoNome = guardar(new THREE.PlaneGeometry(NOME_LARGURA, NOME_ALTURA))
  const grupoDoNome = new THREE.Group()
  grupoDoNome.position.set(0, CENTRO_Y, NOME_Z)
  grupoDoNome.add(malha(geoNome, material(VERTICE, FRAG_NOME_METAL, uNome, false), 11))
  grupoDoNome.add(malha(geoNome, material(VERTICE, FRAG_NOME_BRILHO, uNome, true), 12))
  scene.add(grupoDoNome)

  // Faíscas do choque (na frente do nome).
  const rndFaiscas = semente(4243)
  const faiscas = Array.from({ length: N_FAISCAS }, () => {
    const angulo = rndFaiscas() * Math.PI * 2
    const rapida = rndFaiscas()
    // Espirram mais para os lados e para cima do que para baixo.
    const freio = Math.sin(angulo) < 0 ? 0.6 : 1
    return {
      cos: Math.cos(angulo),
      sen: Math.sin(angulo),
      vel: (3.5 + 8 * rapida * rapida) * freio,
      vida: 0.25 + 0.5 * rndFaiscas(),
      atraso: rndFaiscas() * 0.025,
      largura: 0.016 + 0.016 * rndFaiscas(),
    }
  })
  const particulasDeFaisca = criarParticulas(THREE, N_FAISCAS, 0.5, 13, guardar)
  particulasDeFaisca.malha.visible = !reduzir
  scene.add(particulasDeFaisca.malha)

  // Na frente da câmera: clarão de tela, os dois cortes e as quatro cunhas do fim.
  const frente = new THREE.Group()
  frente.position.z = -1
  camera.add(frente)
  const uTela = { uCor: { value: vec3(1, 0.85, 0.8) }, uForca: { value: 0 } }
  const claraoDeTela = malha(quadrado, material(VERTICE, FRAG_COR_LISA, uTela, true), 14)
  claraoDeTela.scale.set(8, 8, 1)
  claraoDeTela.visible = !reduzir
  frente.add(claraoDeTela)
  const ALCANCE = 1.2
  const geoCorte = guardar(new THREE.PlaneGeometry(ALCANCE * 2, 0.03))
  const criarCorte = (angulo: number) => {
    const uniforms = { uCor: { value: vec3(1, 0.35, 0.3) }, uForca: { value: 0 }, uDesenho: { value: 0 } }
    const m = malha(geoCorte, material(VERTICE, FRAG_CORTE, uniforms, true), 15)
    m.rotation.z = angulo
    m.visible = false
    frente.add(m)
    return { m, uniforms }
  }
  const GRAU = Math.PI / 180
  const corteA = criarCorte(54 * GRAU)
  const corteB = criarCorte(126 * GRAU)
  // Cunhas entre as linhas a ±36° do vertical; um fio de sobra para não abrir fresta.
  const SOBRA = 0.004
  const RAIO_DA_CUNHA = 6
  const matCunha = material(VERTICE, FRAG_CUNHA, {}, false)
  const criarCunha = (de: number, ate: number, bissetriz: number) => {
    const a0 = de - SOBRA
    const a1 = ate + SOBRA
    const geo = guardar(new THREE.BufferGeometry())
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, RAIO_DA_CUNHA * Math.cos(a0), RAIO_DA_CUNHA * Math.sin(a0), 0, RAIO_DA_CUNHA * Math.cos(a1), RAIO_DA_CUNHA * Math.sin(a1), 0]), 3),
    )
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2))
    const m = malha(geo, matCunha, 16)
    m.visible = false
    frente.add(m)
    return { m, dx: Math.cos(bissetriz), dy: Math.sin(bissetriz) }
  }
  const cunhas = [
    criarCunha(54 * GRAU, 126 * GRAU, 90 * GRAU),
    criarCunha(126 * GRAU, 234 * GRAU, 180 * GRAU),
    criarCunha(234 * GRAU, 306 * GRAU, 270 * GRAU),
    criarCunha(-54 * GRAU, 54 * GRAU, 0),
  ]

  /** Quanto cada cunha precisa andar para ficar toda fora da tela, pela direção dela. */
  const recuoDaCunha = (dx: number, dy: number, ox: number, oy: number) => {
    const meiaAltura = TAN_MEIO_FOV
    const meiaLargura = TAN_MEIO_FOV * aspecto
    const folga = 0.06
    if (dy > 0.5) return meiaAltura - oy + folga
    if (dy < -0.5) return meiaAltura + oy + folga
    if (dx > 0.5) return meiaLargura - ox + folga
    return meiaLargura + ox + folga
  }

  const atualizarFaiscas = (t: number) => {
    const K = 3
    const G = 7
    const estouro = T.impacto + T.congela
    for (let i = 0; i < N_FAISCAS; i++) {
      const f = faiscas[i]
      const tau = t - estouro - f.atraso
      if (tau <= 0 || tau >= f.vida) {
        particulasDeFaisca.esconder(i)
        continue
      }
      const e = Math.exp(-K * tau)
      const s = (1 - e) / K
      const x = f.cos * f.vel * s
      const y = f.sen * f.vel * s - (G / K) * (tau - s)
      const vx = f.cos * f.vel * e
      const vy = f.sen * f.vel * e - (G * (1 - e)) / K
      const idade = tau / f.vida
      const luz = Math.pow(1 - idade, 1.5) * 1.7
      const comprimento = Math.min(0.5, 0.06 + 0.045 * Math.hypot(vx, vy))
      particulasDeFaisca.definir(i, x, CENTRO_Y + y, vx, vy, comprimento, f.largura * (1 - 0.5 * idade), luz, Math.max(0, 0.85 - 0.8 * idade) * luz, Math.max(0, 0.75 - 0.72 * idade) * luz)
    }
    particulasDeFaisca.enviar()
  }

  const atualizarBrasas = (t: number) => {
    const surge = easeOutCubic(span(t, T.impacto, T.impacto + 0.5))
    for (let i = 0; i < N_BRASAS; i++) {
      const b = brasas[i]
      if (surge <= 0) {
        particulasDeBrasa.esconder(i)
        continue
      }
      const y = -2.7 + ((b.y0 * 5.4 + b.vel * t) % 5.4)
      const x = b.x + 0.1 * Math.sin(t * 1.1 + b.fase)
      const luz = (0.35 + 0.25 * Math.sin(t * 6 + b.fase * 3)) * surge
      particulasDeBrasa.definir(i, x, y, 0.1 * Math.cos(t * 1.1 + b.fase), 1, b.tamanho * 2.2, b.tamanho, luz, luz * 0.18, luz * 0.06)
    }
    particulasDeBrasa.enviar()
  }

  function atualizar(tBruto: number) {
    const t = Math.max(0, tBruto)
    const impacto = reduzir ? R.impacto : T.impacto
    const contato = t >= impacto
    const congelado = !reduzir && contato && t < T.impacto + T.congela
    // Depois do quadro congelado, tudo estoura a partir daqui.
    const tau = t - (reduzir ? R.impacto : T.impacto + T.congela)
    const brilhoDoChoque = congelado ? 1 : tau >= 0 ? Math.pow(1 - span(tau, 0, 0.2), 2) : 0

    // Névoa: rola sempre (parada no movimento reduzido) e acende com o choque.
    const tempoDaNevoa = reduzir ? 1 : t
    const acesa = (contato ? 0.5 * (congelado ? 1 : Math.exp(-Math.max(0, tau) * 5)) : 0) + 0.6 * span(t, 0, 0.3)
    uNevoaFundo.uTempo.value = tempoDaNevoa
    uNevoaFrente.uTempo.value = tempoDaNevoa * 1.3
    uNevoaFundo.uForca.value = acesa
    uNevoaFrente.uForca.value = acesa * 0.7

    // Espadas e rastro.
    const pose = poseDaEspada(t, reduzir)
    aplicarPose(esquerda, pose, 1)
    aplicarPose(direita, pose, -1)
    const opacidade = reduzir ? easeOutCubic(span(t, 0, R.surgeFim)) : 1
    const brilhoDaLamina = reduzir || t < T.brilhoDaLaminaInicio || t > T.brilhoDaLaminaFim ? -1 : 0.37 + 0.63 * easeInOutSine(span(t, T.brilhoDaLaminaInicio, T.brilhoDaLaminaFim))
    const calorDaLamina = congelado ? 1 : tau >= 0 ? 0.2 + 0.8 * Math.exp(-tau * 6) : 0
    for (const espada of [esquerda, direita]) {
      espada.uniforms.uOpacidade.value = opacidade
      espada.uniforms.uLuz.value = 1 + 0.6 * brilhoDoChoque
      espada.uniforms.uCalor.value = calorDaLamina
      espada.uniforms.uBrilho.value = brilhoDaLamina
    }
    const rastroVisivel = !reduzir && t < T.impacto ? clamp01(span(t, 0, 0.05)) : 0
    RASTRO.forEach((atraso, i) => {
      const poseAntiga = poseDaEspada(Math.max(0, t - atraso), reduzir)
      const forca = rastroVisivel * (i === 0 ? 0.4 : 0.18)
      for (const [espada, lado] of [
        [rastroEsquerda[i], 1],
        [rastroDireita[i], -1],
      ] as const) {
        espada.grupo.visible = forca > 0.003
        aplicarPose(espada, poseAntiga, lado)
        espada.uniforms.uOpacidade.value = forca
      }
    })

    // Choque: no quadro congelado o clarão fica compacto e no máximo; depois abre e some.
    if (reduzir) {
      uClarao.uForca.value = tau >= 0 ? 0.6 * (1 - span(tau, 0, 0.5)) : 0
      clarao.scale.setScalar(2)
    } else if (congelado) {
      uClarao.uForca.value = 1.3
      clarao.scale.setScalar(1.3)
      uEstrela.uForca.value = 1
      estrela.scale.setScalar(1.8)
      estrela.rotation.z = 0
      uTela.uForca.value = 0.55
      uOndaRapida.uForca.value = 0
      uOndaLarga.uForca.value = 0
    } else {
      uClarao.uForca.value = tau >= 0 ? 1.3 * Math.pow(1 - span(tau, 0, 0.3), 2) : 0
      clarao.scale.setScalar(1.3 + 3.4 * easeOutCubic(span(tau, 0, 0.22)))
      uEstrela.uForca.value = tau >= 0 ? 1 - span(tau, 0, 0.22) : 0
      estrela.scale.setScalar(1.8 + 1.8 * easeOutCubic(span(tau, 0, 0.22)))
      estrela.rotation.z = 0.12 * span(tau, 0, 0.22)
      uTela.uForca.value = tau >= 0 ? 0.55 * Math.pow(1 - span(tau, 0, 0.1), 2) : 0
      uOndaRapida.uForca.value = tau >= 0 ? 1.1 * Math.pow(1 - span(tau, 0, 0.3), 1.5) : 0
      ondaRapida.scale.setScalar(0.4 + 4.6 * easeOutCubic(span(tau, 0, 0.3)))
      uOndaLarga.uForca.value = tau >= 0 ? 0.8 * Math.pow(1 - span(tau, 0, 0.55), 1.5) : 0
      ondaLarga.scale.setScalar(0.4 + 3.2 * easeOutCubic(span(tau, 0, 0.55)))
    }
    uPoco.uForca.value = congelado ? 1.2 : tau >= 0 ? 0.55 + 0.65 * Math.exp(-tau * 4) : 0.2 * span(t, 0, 0.4)

    // Nome: surge grande, cai e bate no lugar em rubro; esfria em ferro com as rachaduras em brasa.
    uNome.uTempo.value = t
    if (reduzir) {
      uNome.uOpacidade.value = easeOutCubic(span(t, R.nomeSurge, R.nomeAceso))
      uNome.uCalor.value = 0.6 * (1 - easeOutCubic(span(t, R.nomeSurge, R.esfriaFim)))
      uNome.uBrasa.value = 0.6 * span(t, R.nomeSurge, R.nomeAceso)
      grupoDoNome.scale.setScalar(1)
    } else {
      const assentou = t >= T.nomeAssenta
      uNome.uOpacidade.value = easeOutCubic(span(t, T.nomeSurge, T.nomeSurge + 0.06))
      uNome.uCalor.value = assentou ? 1 - easeOutCubic(span(t, T.nomeAssenta, T.esfriaFim)) : 0.3
      uNome.uBrasa.value = assentou ? span(t, T.nomeAssenta, T.nomeAssenta + 0.05) * (0.58 + 0.12 * Math.sin((t - T.nomeAssenta) * 5)) : 0
      const queda = 1.45 - 0.45 * easeInCubic(span(t, T.nomeSurge, T.nomeAssenta))
      const batida = 1 - 0.02 * pancada(t - T.nomeAssenta, 0.03)
      grupoDoNome.scale.setScalar(queda * batida * (1 + 0.02 * span(t, T.nomeAssenta, T.fechaFim)))
    }
    uNome.uBrilho.value = t < T.brilhoDoNomeInicio || t > T.brilhoDoNomeFim ? -1 : -0.2 + 1.45 * easeInOutSine(span(t, T.brilhoDoNomeInicio, T.brilhoDoNomeFim))

    if (!reduzir) {
      atualizarFaiscas(t)
      atualizarBrasas(t)
    }

    // Câmera.
    const c = estadoDaCamera(t, reduzir, distancia)
    camera.position.set(c.x, c.y, c.z)
    camera.rotation.set(0, 0, c.giro)

    // Fim: dois cortes em X e as cunhas fechando sobre o cruzamento.
    if (!reduzir) {
      const ox = -c.x / c.z
      const oy = (CENTRO_Y - c.y) / c.z
      frente.position.set(ox, oy, -1)
      const cortes: [typeof corteA, number][] = [
        [corteA, T.corte],
        [corteB, T.corte + 0.05],
      ]
      for (const [corte, inicio] of cortes) {
        const forca = (1 - span(t, inicio + 0.06, inicio + 0.3)) * (t >= inicio ? 1 : 0)
        corte.m.visible = forca > 0
        corte.uniforms.uForca.value = forca
        corte.uniforms.uDesenho.value = easeOutCubic(span(t, inicio, inicio + 0.09))
      }
      const fecha = easeInCubic(span(t, T.fechaInicio, T.fechaFim))
      for (const cunha of cunhas) {
        cunha.m.visible = t >= T.fechaInicio
        const recuo = recuoDaCunha(cunha.dx, cunha.dy, ox, oy) * (1 - fecha)
        cunha.m.position.set(cunha.dx * recuo, cunha.dy * recuo, 0)
      }
    }

    return { fade: fadeDasEspadas(t, reduzir) }
  }

  function ajustarTela(novo: number) {
    aspecto = Math.max(0.2, novo)
    const metadeVisivel = TAN_MEIO_FOV * aspecto
    // O nome cai de 1,45x: ele precisa caber já grande.
    const precisaNome = ((larguraDoNome / 2) * 1.5) / metadeVisivel + NOME_Z
    const precisaDesenho = MEIA_LARGURA_DO_DESENHO / metadeVisivel
    distancia = Math.max(DISTANCIA_BASE, precisaNome, precisaDesenho)
    camera.aspect = aspecto
    camera.updateProjectionMatrix()
  }

  function descartar() {
    for (const coisa of lixo) coisa.dispose()
    lixo.length = 0
  }

  ajustarTela(aspecto)
  atualizar(0)

  return { scene, camera, atualizar, ajustarTela, criarSom: (kit: KitDeSom) => criarSomDasEspadas(kit, reduzir), descartar }
}

// ── Som (sintetizado) ────────────────────────────────────────────────────────

interface Saida {
  ctx: AudioContext
  seco: AudioNode
  sala: AudioNode
  ruido: (segundos: number) => AudioBuffer
}

/** Ataque e queda exponenciais (o ganho nunca chega a zero de verdade). */
function envelope(g: GainNode, a: number, pico: number, ataque: number, queda: number) {
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), a + ataque)
  g.gain.exponentialRampToValueAtTime(0.0001, a + ataque + queda)
}

/** Salão de pedra (cauda de 2,2 s) feito de ruído que cai, igual em toda volta. */
function respostaDaSala(ctx: AudioContext, segundos: number): AudioBuffer {
  const n = Math.ceil(ctx.sampleRate * segundos)
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let canal = 0; canal < 2; canal++) {
    const rnd = semente(canal === 0 ? 7 : 11)
    const dados = buffer.getChannelData(canal)
    for (let i = 0; i < n; i++) dados[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, 3)
  }
  return buffer
}

/** Saturação suave (tanh) para a batida ganhar grão. */
function curvaDeSaturacao(forca: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curva = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curva[i] = Math.tanh(forca * x) / Math.tanh(forca)
  }
  return curva
}

function ruidoFiltrado(s: Saida, a: number, duracao: number, filtros: BiquadFilterNode[], ganho: GainNode) {
  const fonte = s.ctx.createBufferSource()
  fonte.buffer = s.ruido(1)
  let elo: AudioNode = fonte
  for (const filtro of filtros) {
    elo.connect(filtro)
    elo = filtro
  }
  elo.connect(ganho)
  fonte.start(a)
  fonte.stop(a + duracao)
}

function filtro(ctx: AudioContext, tipo: BiquadFilterType, frequencia: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = tipo
  f.frequency.value = frequencia
  f.Q.value = q
  return f
}

/** Zunido de lâmina cortando o ar, acelerando até o choque. */
function zunido(s: Saida, a: number, duracao: number, pan: number, volume: number, de: number, ate: number) {
  const { ctx } = s
  const banda = filtro(ctx, 'bandpass', de, 1.4)
  banda.frequency.setValueAtTime(de, a)
  banda.frequency.exponentialRampToValueAtTime(ate, a + duracao)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(volume * 0.4, a + 0.05)
  g.gain.exponentialRampToValueAtTime(volume, a + duracao * 0.97)
  g.gain.exponentialRampToValueAtTime(0.0001, a + duracao + 0.03)
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(pan, a)
  p.pan.linearRampToValueAtTime(pan * 0.2, a + duracao)
  g.connect(p)
  p.connect(s.seco)
  ruidoFiltrado(s, a, duracao + 0.08, [banda], g)
}

/** Batida grave: seno que despenca com grão, baque de ruído abafado e um sub. */
function batida(s: Saida, a: number, volume: number, de: number, ate: number, queda: number, sub: number) {
  const { ctx } = s
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(de, a)
  osc.frequency.exponentialRampToValueAtTime(ate, a + 0.38)
  const grao = ctx.createWaveShaper()
  grao.curve = curvaDeSaturacao(2.5)
  const g = ctx.createGain()
  envelope(g, a, volume, 0.004, queda)
  osc.connect(grao)
  grao.connect(g)
  g.connect(s.seco)
  g.connect(s.sala)
  osc.start(a)
  osc.stop(a + queda + 0.06)
  const baque = ctx.createGain()
  envelope(baque, a, volume * 0.7, 0.002, 0.16)
  baque.connect(s.seco)
  ruidoFiltrado(s, a, 0.22, [filtro(ctx, 'lowpass', 220)], baque)
  const grave = ctx.createOscillator()
  grave.frequency.value = sub
  const gs = ctx.createGain()
  envelope(gs, a, volume * 0.45, 0.01, queda * 0.9)
  grave.connect(gs)
  gs.connect(s.seco)
  grave.start(a)
  grave.stop(a + queda + 0.06)
}

/** Parciais inarmônicos de uma lâmina pesada; a segunda vem 1,35% acima e as duas batem entre si. */
const PARCIAIS_DA_LAMINA: readonly [frequencia: number, volume: number, queda: number][] = [
  [620, 0.22, 0.35],
  [940, 0.16, 0.3],
  [1320, 0.2, 1.3],
  [2110, 0.17, 1.0],
  [3010, 0.12, 0.8],
  [4180, 0.08, 0.6],
  [5600, 0.05, 0.4],
]

/** O choque: estalo, lâmina raspando a outra, o tinido pesado das duas e a batida grave funda. */
function choque(s: Saida, a: number, forca: number) {
  const { ctx } = s
  const estalo = ctx.createGain()
  envelope(estalo, a, 0.9 * forca, 0.001, 0.04)
  estalo.connect(s.seco)
  ruidoFiltrado(s, a, 0.06, [filtro(ctx, 'highpass', 1800)], estalo)

  const raspa = ctx.createGain()
  envelope(raspa, a, 0.4 * forca, 0.004, 0.5)
  raspa.connect(s.seco)
  raspa.connect(s.sala)
  const banda = filtro(ctx, 'bandpass', 6200, 5)
  banda.frequency.setValueAtTime(6200, a)
  banda.frequency.exponentialRampToValueAtTime(2400, a + 0.36)
  ruidoFiltrado(s, a, 0.6, [filtro(ctx, 'highpass', 1400), banda], raspa)

  for (const [desvio, pan] of [
    [1, -0.2],
    [1.0135, 0.2],
  ] as const) {
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    p.connect(s.seco)
    p.connect(s.sala)
    for (const [frequencia, volume, queda] of PARCIAIS_DA_LAMINA) {
      const osc = ctx.createOscillator()
      osc.frequency.value = frequencia * desvio
      const g = ctx.createGain()
      envelope(g, a, volume * forca * 0.8, 0.002, queda)
      osc.connect(g)
      g.connect(p)
      osc.start(a)
      osc.stop(a + queda + 0.05)
    }
  }
  batida(s, a, 1.0 * forca, 120, 30, 0.9, 36)
}

/** O nome batendo no lugar: chapa de ferro pesada no chão de pedra. */
function chapa(s: Saida, a: number) {
  const { ctx } = s
  batida(s, a, 0.8, 90, 28, 0.7, 32)
  const p = ctx.createStereoPanner()
  p.connect(s.seco)
  p.connect(s.sala)
  for (const [frequencia, volume, queda] of [
    [210, 0.14, 0.28],
    [330, 0.1, 0.22],
    [470, 0.07, 0.18],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = frequencia
    const g = ctx.createGain()
    envelope(g, a, volume, 0.002, queda)
    osc.connect(g)
    g.connect(p)
    osc.start(a)
    osc.stop(a + queda + 0.05)
  }
}

/**
 * Drone sinistro por baixo de tudo: duas serras graves em trítono (49 e 69,3 Hz)
 * e uma terceira desafinada que bate devagar, num passa-baixa que respira.
 * Cresce no choque e some no preto do fim.
 */
function drone(s: Saida, a: number, duracao: number, impacto: number) {
  const { ctx } = s
  const passaBaixa = filtro(ctx, 'lowpass', 300, 4)
  const respira = ctx.createOscillator()
  respira.frequency.value = 0.45
  const fundoDoFiltro = ctx.createGain()
  fundoDoFiltro.gain.value = 90
  respira.connect(fundoDoFiltro)
  fundoDoFiltro.connect(passaBaixa.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(0.13, a + 0.3)
  g.gain.setValueAtTime(0.13, a + impacto)
  g.gain.exponentialRampToValueAtTime(0.22, a + impacto + 0.08)
  g.gain.exponentialRampToValueAtTime(0.14, a + impacto + 0.8)
  g.gain.setValueAtTime(0.14, a + duracao - 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, a + duracao)
  passaBaixa.connect(g)
  g.connect(s.seco)
  const fontes: OscillatorNode[] = [respira]
  for (const [frequencia, volume] of [
    [49, 0.5],
    [49.4, 0.35],
    [69.3, 0.4],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = frequencia
    const v = ctx.createGain()
    v.gain.value = volume
    osc.connect(v)
    v.connect(passaBaixa)
    fontes.push(osc)
  }
  for (const osc of fontes) {
    osc.start(a)
    osc.stop(a + duracao + 0.05)
  }
}

/** "Tiin" frio e baixinho do reflexo atravessando o nome. */
function tilin(s: Saida, a: number) {
  const { ctx } = s
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(-0.3, a)
  p.pan.linearRampToValueAtTime(0.3, a + 0.5)
  p.connect(s.seco)
  p.connect(s.sala)
  for (const [frequencia, volume] of [
    [2093, 0.035],
    [3136, 0.02],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.frequency.value = frequencia
    const g = ctx.createGain()
    envelope(g, a, volume, 0.004, 0.7)
    osc.connect(g)
    g.connect(p)
    osc.start(a)
    osc.stop(a + 0.75)
  }
}

/** O risco do corte: ruído agudo que varre para cima, da esquerda para a direita. */
function corte(s: Saida, a: number) {
  const { ctx } = s
  const banda = filtro(ctx, 'bandpass', 2500, 2)
  banda.frequency.setValueAtTime(2500, a)
  banda.frequency.exponentialRampToValueAtTime(9000, a + 0.1)
  const g = ctx.createGain()
  envelope(g, a, 0.28, 0.008, 0.16)
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(-0.5, a)
  p.pan.linearRampToValueAtTime(0.5, a + 0.15)
  g.connect(p)
  p.connect(s.seco)
  p.connect(s.sala)
  ruidoFiltrado(s, a, 0.2, [filtro(ctx, 'highpass', 2200), banda], g)
}

type Pista = [nome: string, quando: number, tocar: (agora: number) => void]

function criarSomDasEspadas(kitDoMotor: KitDeSom, reduzir: boolean) {
  const { ctx } = kitDoMotor
  // Limitador na saída: o choque soma estalo, tinido, batida e drone no mesmo instante.
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -10
  limitador.knee.value = 6
  limitador.ratio.value = 12
  limitador.attack.value = 0.002
  limitador.release.value = 0.25
  limitador.connect(kitDoMotor.destino)
  const sala = ctx.createConvolver()
  sala.buffer = respostaDaSala(ctx, 2.2)
  const volta = ctx.createGain()
  volta.gain.value = 0.38
  sala.connect(volta)
  volta.connect(limitador)
  const s: Saida = { ctx, seco: limitador, sala, ruido: kitDoMotor.ruido }
  const T = ROTEIRO_DAS_ESPADAS
  const R = ROTEIRO_REDUZIDO
  const pistas: Pista[] = reduzir
    ? [
        ['drone', 0, (a) => drone(s, a, T.duracao, R.impacto)],
        ['choque', R.impacto, (a) => choque(s, a, 0.75)],
        ['brilho', T.brilhoDoNomeInicio + 0.12, (a) => tilin(s, a)],
      ]
    : [
        ['drone', 0, (a) => drone(s, a, T.duracao, T.impacto)],
        [
          'zunido',
          0,
          (a) => {
            zunido(s, a, T.impacto, -0.8, 0.55, 500, 3200)
            zunido(s, a + 0.01, T.impacto - 0.01, 0.8, 0.5, 460, 3000)
          },
        ],
        ['choque', T.impacto, (a) => choque(s, a, 1)],
        ['chapa', T.nomeAssenta, (a) => chapa(s, a)],
        ['brilho', T.brilhoDoNomeInicio + 0.12, (a) => tilin(s, a)],
        ['corte', T.corte, (a) => corte(s, a)],
        ['fecha', T.fechaFim, (a) => batida(s, a, 0.75, 80, 26, 0.8, 30)],
      ]
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

const criar: CriarCena = criarCenaEspadasCruzadas
export default criar

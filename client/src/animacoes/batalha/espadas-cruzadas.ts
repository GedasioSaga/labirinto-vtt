import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'
import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Espadas cruzadas: a primeira abertura de batalha (pedido de 27/10/2026,
 * protótipo em docs/design/transicao-batalha-espadas/). Duas espadas entram
 * pelos lados, param armadas, recuam um palmo e se cruzam no centro com um
 * clarão, faíscas, um tremor curto e o "shing" da lâmina com uma batida grave.
 * O nome do grupo nasce do clarão, em letras de ouro envelhecido que saem em
 * brasa do centro para as pontas e esfriam; um reflexo corre pelas lâminas e
 * pelo nome; no fim dois cortes em X riscam a tela e quatro cunhas pretas
 * fecham sobre o cruzamento para a troca.
 *
 * Contrato: o mesmo `CriarCena` das transições (`src/transicoes/tipos.ts`),
 * com um campo a mais e opcional, `nome` (padrão "Royals"). O tipo `batalha`
 * ainda não existe no pacote (`scripts/pacote-animacoes.cjs` só lê os tipos
 * conhecidos) nem no app: entra quando o mestre aprovar o protótipo.
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
  fadeInFim: 0.12,
  /** As espadas entram pelos lados e param armadas, uma de cada lado. */
  entradaFim: 0.38,
  /** Recuo curto antes do golpe (antecipação). */
  armadaFim: 0.48,
  /** As lâminas se encontram no centro: clarão, faíscas, tremor e som. */
  impacto: 0.6,
  /** O choque segura dois quadros antes do rebote. */
  pausaDoChoque: 0.035,
  revelaInicio: 0.66,
  revelaFim: 1.02,
  esfriaFim: 1.45,
  brilhoDaLaminaInicio: 1.3,
  brilhoDaLaminaFim: 1.75,
  brilhoDoNomeInicio: 1.45,
  brilhoDoNomeFim: 1.95,
  /** Dois cortes em X riscam a tela. */
  corte: 2.1,
  /** As quatro cunhas pretas fecham sobre o cruzamento. */
  fechaInicio: 2.16,
  fechaFim: 2.52,
  fadeOutInicio: 2.52,
} as const

/** Com movimento reduzido: nada voa nem treme; as espadas surgem cruzadas e o fim é um escurecer. */
export const ROTEIRO_REDUZIDO = {
  surgeFim: 0.4,
  impacto: 0.42,
  revelaInicio: 0.5,
  revelaFim: 0.95,
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

const N_FAISCAS = 64
const N_BRASAS = 26

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

/** Fundo: poço escuro e quente no centro, quase preto nas bordas, com grão fino contra faixas. */
const FRAG_FUNDO = /* glsl */ `
uniform vec3 uCentro;
uniform vec3 uBorda;
varying vec2 vPos;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float r = length(vPos / vec2(7.0, 4.4));
  vec3 cor = mix(uCentro, uBorda, smoothstep(0.0, 1.0, r));
  cor += (hash(floor(vPos * 90.0)) - 0.5) * 0.012;
  gl_FragColor = vec4(cor, 1.0);
}`

/** Espada pintada: brilho geral, luz quente do choque perto do cruzamento e o reflexo que corre a lâmina. */
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
  float aco = smoothstep(0.15, 0.5, dot(c.rgb, vec3(0.333)));
  vec3 cor = c.rgb * uLuz;
  float perto = exp(-abs(vUv.y - 0.6) * 7.0);
  cor += vec3(1.0, 0.7, 0.36) * perto * uCalor * (0.35 + 0.65 * lamina) * c.a;
  float b = (vUv.y - uBrilho) / 0.028;
  float faixa = exp(-b * b);
  cor += vec3(1.0, 0.97, 0.9) * faixa * lamina * aco * 0.7;
  gl_FragColor = vec4(cor, c.a * uOpacidade);
}`

/** Letras de metal; aparecem do centro para as pontas. */
const FRAG_NOME_METAL = /* glsl */ `
uniform sampler2D mapa;
uniform float uRevela;
uniform float uOpacidade;
uniform float uLargura;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(mapa, vUv);
  float d = abs(vUv.x - 0.5) * 2.0 / uLargura;
  float frente = uRevela * 1.6;
  float revelado = 1.0 - smoothstep(frente - 0.25, frente, d);
  gl_FragColor = vec4(c.rgb, c.a * revelado * uOpacidade);
}`

/** Por cima do metal (somando luz): a brasa das letras que esfria, a frente da revelação e o reflexo. */
const FRAG_NOME_BRILHO = /* glsl */ `
uniform sampler2D mascara;
uniform float uRevela;
uniform float uCalor;
uniform float uBrilho;
uniform float uOpacidade;
uniform float uLargura;
varying vec2 vUv;
void main() {
  vec4 k = texture2D(mascara, vUv);
  float letra = k.r;
  float halo = k.g;
  float d = abs(vUv.x - 0.5) * 2.0 / uLargura;
  float frente = uRevela * 1.6;
  float revelado = 1.0 - smoothstep(frente - 0.25, frente, d);
  vec3 quente = mix(vec3(0.95, 0.38, 0.1), vec3(1.0, 0.94, 0.8), uCalor);
  vec3 cor = quente * (letra * 0.95 + halo * 0.55) * uCalor * revelado;
  float f = (d - frente + 0.1) / 0.08;
  float naFrente = exp(-f * f) * step(0.001, uRevela) * (1.0 - step(0.999, uRevela));
  cor += vec3(1.0, 0.86, 0.6) * naFrente * (letra + halo * 0.6);
  float s = (vUv.x - 0.5) / uLargura + 0.5 + (vUv.y - 0.5) * 0.18;
  float b = (s - uBrilho) / 0.045;
  float faixa = exp(-b * b);
  cor += vec3(1.0, 0.95, 0.82) * faixa * letra * 0.8;
  gl_FragColor = vec4(cor * uOpacidade, 1.0);
}`

const FRAG_CLARAO = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  float v = exp(-r2 * 28.0) * 1.2 + exp(-r2 * 5.0) * 0.45;
  v *= 1.0 - smoothstep(0.7, 1.0, r2);
  gl_FragColor = vec4(uCor * v * uForca, 1.0);
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

const FRAG_ONDA = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float fino = (r - 0.8) / 0.035;
  float largo = (r - 0.8) / 0.12;
  float v = exp(-fino * fino) + exp(-largo * largo) * 0.25;
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

/** Contorno das peças: marrom quase preto, nunca preto puro (régua do estilo do app). */
const CONTORNO = '#2a1f1a'

function latao(g: CanvasRenderingContext2D, topo: number, pe: number): CanvasGradient {
  const grad = g.createLinearGradient(0, topo, 0, pe)
  grad.addColorStop(0, '#f3d991')
  grad.addColorStop(0.35, '#cf9f4c')
  grad.addColorStop(0.7, '#94692b')
  grad.addColorStop(1, '#5e4219')
  return grad
}

/**
 * A espada em pé, ponta para cima, num canvas de 480 × 1600 (520 px por
 * unidade): lâmina de duas facetas com fio claro do lado da luz (esquerda) e
 * sulco central, guarda de latão com as pontas viradas para a lâmina e
 * remates redondos, escudete com uma granada, punho de couro trançado e pomo.
 * A segunda espada é a mesma imagem espelhada.
 */
function pintarEspada(THREE: ThreeModule): Three.CanvasTexture {
  const [canvas, g] = tela(ESPADA_LARGURA_PX, ESPADA_ALTURA_PX)
  const cx = ESPADA_LARGURA_PX / 2
  const rnd = semente(1931)
  g.lineJoin = 'round'
  g.lineCap = 'round'

  // Lâmina: base 1034, ponta 34, mais larga na base.
  const lamina = new Path2D()
  lamina.moveTo(cx - 42, 1034)
  lamina.lineTo(cx - 31, 330)
  lamina.quadraticCurveTo(cx - 30, 150, cx, 34)
  lamina.quadraticCurveTo(cx + 30, 150, cx + 31, 330)
  lamina.lineTo(cx + 42, 1034)
  lamina.closePath()
  g.strokeStyle = CONTORNO
  g.lineWidth = 7
  g.stroke(lamina)
  g.save()
  g.clip(lamina)
  const clara = g.createLinearGradient(cx - 42, 0, cx, 0)
  clara.addColorStop(0, '#c3cad2')
  clara.addColorStop(1, '#eef1f4')
  g.fillStyle = clara
  g.fillRect(cx - 50, 0, 50, 1040)
  const escura = g.createLinearGradient(cx, 0, cx + 42, 0)
  escura.addColorStop(0, '#7d848e')
  escura.addColorStop(1, '#5a616a')
  g.fillStyle = escura
  g.fillRect(cx, 0, 50, 1040)
  // Fio de cada lado: claro onde bate a luz, escuro do outro.
  const fio = (lado: 1 | -1) => {
    const p = new Path2D()
    p.moveTo(cx + lado * 42, 1034)
    p.lineTo(cx + lado * 31, 330)
    p.quadraticCurveTo(cx + lado * 30, 150, cx, 34)
    return p
  }
  g.lineWidth = 5
  g.strokeStyle = '#f6f8fa'
  g.stroke(fio(-1))
  g.strokeStyle = '#3f454d'
  g.stroke(fio(1))
  // Reflexo comprido no terço de cima e a lâmina escurecendo junto à guarda.
  const reflexo = g.createLinearGradient(0, 360, 0, 660)
  reflexo.addColorStop(0, 'rgba(255, 248, 235, 0)')
  reflexo.addColorStop(0.5, 'rgba(255, 248, 235, 0.22)')
  reflexo.addColorStop(1, 'rgba(255, 248, 235, 0)')
  g.fillStyle = reflexo
  g.fillRect(cx - 50, 360, 100, 300)
  const baseEscura = g.createLinearGradient(0, 880, 0, 1034)
  baseEscura.addColorStop(0, 'rgba(30, 20, 15, 0)')
  baseEscura.addColorStop(1, 'rgba(30, 20, 15, 0.22)')
  g.fillStyle = baseEscura
  g.fillRect(cx - 50, 880, 100, 160)
  // Aresta central e o sulco (da guarda até perto da ponta).
  g.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(cx - 0.5, 1030)
  g.lineTo(cx - 0.5, 60)
  g.stroke()
  const sulco = g.createLinearGradient(cx - 8, 0, cx + 8, 0)
  sulco.addColorStop(0, '#4d535b')
  sulco.addColorStop(0.45, '#9ea5ae')
  sulco.addColorStop(1, '#646b74')
  g.fillStyle = sulco
  g.beginPath()
  g.roundRect(cx - 8, 430, 16, 584, 8)
  g.fill()
  g.strokeStyle = 'rgba(40, 44, 50, 0.8)'
  g.lineWidth = 1.5
  g.stroke()
  // Riscos de uso, quase invisíveis.
  g.lineWidth = 1
  for (let i = 0; i < 90; i++) {
    const x = cx + (rnd() - 0.5) * 70
    const y = 120 + rnd() * 900
    const comprimento = 6 + rnd() * 20
    const inclinacao = (rnd() - 0.5) * 0.9
    g.strokeStyle = rnd() < 0.5 ? `rgba(255, 255, 255, ${0.05 + rnd() * 0.05})` : `rgba(20, 24, 30, ${0.05 + rnd() * 0.05})`
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.sin(inclinacao) * comprimento, y + Math.cos(inclinacao) * comprimento)
    g.stroke()
  }
  g.restore()

  // Punho de couro trançado, levemente abaulado.
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
  couro.addColorStop(0, '#3a2317')
  couro.addColorStop(0.27, '#7a4e35')
  couro.addColorStop(0.57, '#53321f')
  couro.addColorStop(1, '#2a1810')
  g.fillStyle = couro
  g.fillRect(cx - 40, 1090, 80, 310)
  for (let y = 1084; y < 1400; y += 22) {
    g.strokeStyle = 'rgba(28, 14, 8, 0.65)'
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(cx - 34, y)
    g.lineTo(cx + 34, y + 16)
    g.stroke()
    g.strokeStyle = 'rgba(255, 214, 170, 0.16)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(cx - 34, y - 5)
    g.lineTo(cx + 34, y + 11)
    g.stroke()
  }
  g.restore()

  // Anel entre o punho e o pomo.
  g.fillStyle = CONTORNO
  g.beginPath()
  g.roundRect(cx - 36, 1377, 72, 24, 9)
  g.fill()
  g.fillStyle = latao(g, 1380, 1398)
  g.beginPath()
  g.roundRect(cx - 33, 1380, 66, 18, 7)
  g.fill()

  // Guarda: braços com as pontas viradas para a lâmina, remates e escudete.
  // Todos os contornos primeiro, depois o latão, para as peças se fundirem.
  const braco = (lado: 1 | -1, dy = 0) => {
    const p = new Path2D()
    p.moveTo(cx, 1056 + dy)
    p.quadraticCurveTo(cx + lado * 120, 1066 + dy, cx + lado * 192, 1016 + dy)
    return p
  }
  const escudete = new Path2D()
  escudete.moveTo(cx, 1000)
  escudete.lineTo(cx + 46, 1030)
  escudete.lineTo(cx + 38, 1082)
  escudete.lineTo(cx, 1110)
  escudete.lineTo(cx - 38, 1082)
  escudete.lineTo(cx - 46, 1030)
  escudete.closePath()
  g.strokeStyle = CONTORNO
  g.fillStyle = CONTORNO
  g.lineWidth = 42
  g.stroke(braco(-1))
  g.stroke(braco(1))
  for (const lado of [-1, 1]) {
    g.beginPath()
    g.arc(cx + lado * 198, 1008, 26, 0, Math.PI * 2)
    g.fill()
  }
  g.lineWidth = 12
  g.stroke(escudete)
  const latDaGuarda = latao(g, 985, 1090)
  g.strokeStyle = latDaGuarda
  g.lineWidth = 32
  g.stroke(braco(-1))
  g.stroke(braco(1))
  for (const lado of [-1, 1]) {
    const remate = g.createRadialGradient(cx + lado * 198 - 7, 1000, 2, cx + lado * 198, 1008, 24)
    remate.addColorStop(0, '#fbe8b6')
    remate.addColorStop(0.45, '#cf9f4c')
    remate.addColorStop(1, '#6e4e1e')
    g.fillStyle = remate
    g.beginPath()
    g.arc(cx + lado * 198, 1008, 21, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = 'rgba(255, 241, 205, 0.55)'
  g.lineWidth = 3
  g.stroke(braco(-1, -9))
  g.stroke(braco(1, -9))
  g.fillStyle = latDaGuarda
  g.fill(escudete)
  g.save()
  g.translate(cx, 1054)
  g.scale(0.74, 0.74)
  g.translate(-cx, -1054)
  g.strokeStyle = 'rgba(90, 60, 20, 0.7)'
  g.lineWidth = 3
  g.stroke(escudete)
  g.restore()
  // Granada no escudete.
  const granada = g.createRadialGradient(cx - 4, 1046, 1, cx, 1054, 20)
  granada.addColorStop(0, '#e8857c')
  granada.addColorStop(0.45, '#a0262d')
  granada.addColorStop(1, '#5a1016')
  g.fillStyle = granada
  g.beginPath()
  g.ellipse(cx, 1054, 13, 18, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#2a1612'
  g.lineWidth = 2.5
  g.stroke()
  g.fillStyle = 'rgba(255, 235, 230, 0.8)'
  g.beginPath()
  g.ellipse(cx - 4, 1045, 3, 5, -0.3, 0, Math.PI * 2)
  g.fill()

  // Botão do fim e pomo.
  g.fillStyle = CONTORNO
  g.beginPath()
  g.arc(cx, 1486, 15, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = latao(g, 1476, 1497)
  g.beginPath()
  g.arc(cx, 1486, 11, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = CONTORNO
  g.beginPath()
  g.arc(cx, 1438, 45, 0, Math.PI * 2)
  g.fill()
  const pomo = g.createRadialGradient(cx - 13, 1424, 3, cx, 1438, 46)
  pomo.addColorStop(0, '#fff0c2')
  pomo.addColorStop(0.3, '#dcae5c')
  pomo.addColorStop(0.75, '#9c712f')
  pomo.addColorStop(1, '#5b3f18')
  g.fillStyle = pomo
  g.beginPath()
  g.arc(cx, 1438, 40, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(70, 45, 15, 0.55)'
  g.lineWidth = 2
  g.beginPath()
  g.arc(cx, 1438, 27, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = 'rgba(255, 240, 200, 0.5)'
  g.lineWidth = 1.5
  g.beginPath()
  g.arc(cx - 1, 1437, 27, Math.PI, Math.PI * 1.5)
  g.stroke()

  return new THREE.CanvasTexture(canvas)
}

interface NomePintado {
  metal: Three.CanvasTexture
  /** Meia resolução: vermelho = letras com o aro, verde = halo borrado. */
  mascara: Three.CanvasTexture
  /** Largura do texto (com o aro) em fração da largura do plano. */
  fracao: number
}

/**
 * O nome em ouro envelhecido: aro escuro, chanfro, face com faixas de metal
 * polido, riscos de uso e duas sombras por baixo (uma justa, outra larga, que
 * separa as letras das lâminas atrás). Encolhe para caber até 24 letras.
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

  g.strokeStyle = '#2b1d10'
  g.lineWidth = aro
  g.strokeText(nome, cx, base)
  const chanfro = g.createLinearGradient(0, topo, 0, pe)
  chanfro.addColorStop(0, '#fbe9b4')
  chanfro.addColorStop(0.5, '#c8973f')
  chanfro.addColorStop(1, '#6e4c1c')
  g.strokeStyle = chanfro
  g.lineWidth = px * 0.034
  g.strokeText(nome, cx, base)
  const face = g.createLinearGradient(0, topo, 0, pe)
  face.addColorStop(0, '#fff3cf')
  face.addColorStop(0.22, '#f0d28a')
  face.addColorStop(0.46, '#c8973f')
  face.addColorStop(0.52, '#8a5f22')
  face.addColorStop(0.58, '#d9b468')
  face.addColorStop(0.8, '#b88a3c')
  face.addColorStop(1, '#6e4c1c')
  g.fillStyle = face
  g.fillText(nome, cx, base)

  // Riscos de uso só sobre o que já está pintado.
  g.save()
  g.globalCompositeOperation = 'source-atop'
  const rnd = semente(5381)
  g.lineWidth = 1.2
  for (let i = 0; i < 220; i++) {
    const x = cx + (rnd() - 0.5) * medida.width
    const y = topo + rnd() * (pe - topo + descida)
    const comprimento = 4 + rnd() * 16
    const angulo = rnd() * Math.PI
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255, 240, 200, 0.09)' : 'rgba(50, 30, 10, 0.1)'
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(angulo) * comprimento, y + Math.sin(angulo) * comprimento)
    g.stroke()
  }
  g.restore()

  // Sombras por baixo do que já existe.
  g.save()
  g.globalCompositeOperation = 'destination-over'
  g.fillStyle = '#120c08'
  g.strokeStyle = '#120c08'
  g.lineWidth = aro
  g.shadowColor = 'rgba(0, 0, 0, 0.85)'
  g.shadowBlur = px * 0.1
  g.shadowOffsetY = px * 0.045
  g.fillText(nome, cx, base)
  g.strokeText(nome, cx, base)
  g.shadowColor = 'rgba(8, 5, 3, 0.6)'
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
const POSE_FORA: PoseDaEspada = { x: -6.4, y: -1.7, rz: -1.4, ry: 1.15 }
const POSE_ARMADA: PoseDaEspada = { x: -1.1, y: 0.1, rz: -0.27, ry: 0 }
const POSE_RECUO: PoseDaEspada = { x: -1.26, y: 0.15, rz: -0.17, ry: 0 }
const POSE_CRUZADA: PoseDaEspada = { x: 0, y: 0, rz: -ANGULO_CRUZADO, ry: 0 }

function misturar(a: PoseDaEspada, b: PoseDaEspada, k: number): PoseDaEspada {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, rz: a.rz + (b.rz - a.rz) * k, ry: a.ry + (b.ry - a.ry) * k }
}

const easeInCubic = (x: number): number => x * x * x

function poseDaEspada(t: number, reduzir: boolean): PoseDaEspada {
  const T = ROTEIRO_DAS_ESPADAS
  if (reduzir) return POSE_CRUZADA
  // Entra rápido e freia até parar armada.
  if (t < T.entradaFim) return misturar(POSE_FORA, POSE_ARMADA, easeOutCubic(span(t, 0, T.entradaFim)))
  // Recua um palmo, devagar.
  if (t < T.armadaFim) return misturar(POSE_ARMADA, POSE_RECUO, easeInOutSine(span(t, T.entradaFim, T.armadaFim)))
  // O golpe acelera até o encontro: lâmina de verdade não freia antes de bater.
  if (t < T.impacto) return misturar(POSE_RECUO, POSE_CRUZADA, easeInCubic(span(t, T.armadaFim, T.impacto)))
  // Dois quadros parados no choque, depois o rebote amortecido.
  const tau = Math.max(0, t - T.impacto - T.pausaDoChoque)
  const rebote = Math.exp(-tau * 9) * Math.sin(tau * 30)
  return { x: -0.075 * rebote, y: 0, rz: -ANGULO_CRUZADO + 0.055 * rebote, ry: 0 }
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
  // Aproximação lenta do choque até o fim: a tela nunca fica parada.
  let z = distancia * (1 - 0.045 * easeInOutSine(span(t, T.impacto, T.fechaFim)))
  const tau = t - T.impacto
  // Soco de câmera no choque e tremor que morre em ~0,4 s.
  z -= 0.25 * escala * pancada(tau, 0.05)
  const tremor = tau > 0 ? 0.07 * escala * Math.exp(-tau * 11) : 0
  return {
    x: tremor * (Math.sin(tau * 93) + 0.5 * Math.sin(tau * 151)),
    y: tremor * 0.8 * (Math.cos(tau * 79) + 0.5 * Math.sin(tau * 137)),
    z,
    giro: tau > 0 ? 0.012 * Math.exp(-tau * 11) * Math.sin(tau * 71) : 0,
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
        uniforms: { uCentro: { value: vec3(0.13, 0.085, 0.065) }, uBorda: { value: vec3(0.025, 0.02, 0.022) } },
        depthWrite: false,
        depthTest: false,
      }),
    ),
  )
  fundo.position.z = -3
  fundo.renderOrder = 0
  fundo.frustumCulled = false
  scene.add(fundo)

  // Poço de luz quente atrás do nome.
  const uPoco = { uCor: { value: vec3(0.42, 0.17, 0.06) }, uForca: { value: 0 } }
  const poco = malha(quadrado, material(VERTICE, FRAG_POCO, uPoco, true), 1)
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
  const particulasDeBrasa = criarParticulas(THREE, N_BRASAS, -0.8, 2, guardar)
  particulasDeBrasa.malha.visible = !reduzir
  scene.add(particulasDeBrasa.malha)

  // Espadas: grupo no ponto do cruzamento; rastro de duas cópias só quando correm.
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
  const RASTRO = [0.03, 0.06]
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
  const rastroDireita = RASTRO.map(() => criarEspada(true, 3, -0.03))
  const direita = criarEspada(true, 4, -0.03)
  const rastroEsquerda = RASTRO.map(() => criarEspada(false, 5, 0.03))
  const esquerda = criarEspada(false, 6, 0.03)
  const aplicarPose = (espada: Espada, pose: PoseDaEspada, lado: 1 | -1) => {
    espada.grupo.position.x = pose.x * -lado
    espada.grupo.position.y = pose.y
    espada.grupo.rotation.z = pose.rz * -lado
    espada.grupo.rotation.y = pose.ry * -lado
  }

  // Choque: onda, clarão e estrela no cruzamento.
  const uOnda = { uCor: { value: vec3(1, 0.8, 0.55) }, uForca: { value: 0 } }
  const onda = malha(quadrado, material(VERTICE, FRAG_ONDA, uOnda, true), 7)
  onda.position.set(0, CENTRO_Y, 0.3)
  const uClarao = { uCor: { value: vec3(1, 0.86, 0.6) }, uForca: { value: 0 } }
  const clarao = malha(quadrado, material(VERTICE, FRAG_CLARAO, uClarao, true), 8)
  clarao.position.set(0, CENTRO_Y, 0.35)
  const uEstrela = { uCor: { value: vec3(1, 0.93, 0.78) }, uForca: { value: 0 } }
  const estrela = malha(quadrado, material(VERTICE, FRAG_ESTRELA, uEstrela, true), 9)
  estrela.position.set(0, CENTRO_Y, 0.4)
  onda.visible = !reduzir
  estrela.visible = !reduzir
  scene.add(onda, clarao, estrela)

  // Nome.
  const nome = nomeDaBatalha(opcoes.nome)
  const pintado = pintarNome(THREE, nome)
  guardar(pintado.metal)
  guardar(pintado.mascara)
  const larguraDoNome = NOME_LARGURA * pintado.fracao
  const uNome = {
    mapa: { value: pintado.metal },
    mascara: { value: pintado.mascara },
    uRevela: { value: 0 },
    uCalor: { value: 1 },
    uBrilho: { value: -1 },
    uOpacidade: { value: 1 },
    uLargura: { value: Math.max(0.05, pintado.fracao) },
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
    // As faíscas espirram mais para os lados e para cima do que para baixo.
    const freio = Math.sin(angulo) < 0 ? 0.6 : 1
    return {
      cos: Math.cos(angulo),
      sen: Math.sin(angulo),
      vel: (2.4 + 5.2 * rapida * rapida) * freio,
      vida: 0.32 + 0.55 * rndFaiscas(),
      atraso: rndFaiscas() * 0.03,
      largura: 0.016 + 0.014 * rndFaiscas(),
    }
  })
  const particulasDeFaisca = criarParticulas(THREE, N_FAISCAS, 0.5, 13, guardar)
  particulasDeFaisca.malha.visible = !reduzir
  scene.add(particulasDeFaisca.malha)

  // Na frente da câmera: clarão de tela, os dois cortes e as quatro cunhas do fim.
  const frente = new THREE.Group()
  frente.position.z = -1
  camera.add(frente)
  const uTela = { uCor: { value: vec3(1, 0.93, 0.8) }, uForca: { value: 0 } }
  const claraoDeTela = malha(quadrado, material(VERTICE, FRAG_COR_LISA, uTela, true), 14)
  claraoDeTela.scale.set(8, 8, 1)
  claraoDeTela.visible = !reduzir
  frente.add(claraoDeTela)
  const ALCANCE = 1.2
  const geoCorte = guardar(new THREE.PlaneGeometry(ALCANCE * 2, 0.03))
  const criarCorte = (angulo: number) => {
    const uniforms = { uCor: { value: vec3(1, 0.9, 0.72) }, uForca: { value: 0 }, uDesenho: { value: 0 } }
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
    const K = 3.4
    const G = 6.5
    for (let i = 0; i < N_FAISCAS; i++) {
      const f = faiscas[i]
      const tau = t - T.impacto - f.atraso
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
      const luz = Math.pow(1 - idade, 1.6) * 1.6
      const comprimento = Math.min(0.38, 0.05 + 0.04 * Math.hypot(vx, vy))
      particulasDeFaisca.definir(i, x, CENTRO_Y + y, vx, vy, comprimento, f.largura * (1 - 0.5 * idade), luz, (0.9 - 0.55 * idade) * luz, Math.max(0, 0.7 - 0.62 * idade) * luz)
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
      particulasDeBrasa.definir(i, x, y, 0.1 * Math.cos(t * 1.1 + b.fase), 1, b.tamanho * 2.2, b.tamanho, luz, luz * 0.5, luz * 0.18)
    }
    particulasDeBrasa.enviar()
  }

  function atualizar(tBruto: number) {
    const t = Math.max(0, tBruto)
    const impacto = reduzir ? R.impacto : T.impacto
    const tau = t - impacto
    const choque = tau >= 0 ? Math.pow(1 - span(tau, 0, 0.22), 2) : 0

    // Espadas e rastro.
    const pose = poseDaEspada(t, reduzir)
    aplicarPose(esquerda, pose, 1)
    aplicarPose(direita, pose, -1)
    const opacidade = reduzir ? easeOutCubic(span(t, 0, R.surgeFim)) : 1
    const brilhoDaLamina = reduzir || t < T.brilhoDaLaminaInicio || t > T.brilhoDaLaminaFim ? -1 : 0.37 + 0.63 * easeInOutSine(span(t, T.brilhoDaLaminaInicio, T.brilhoDaLaminaFim))
    const calorDaLamina = tau >= 0 ? 0.15 + 0.85 * Math.exp(-tau * 6) : 0
    for (const espada of [esquerda, direita]) {
      espada.uniforms.uOpacidade.value = opacidade
      espada.uniforms.uLuz.value = 1 + 0.5 * choque
      espada.uniforms.uCalor.value = calorDaLamina
      espada.uniforms.uBrilho.value = brilhoDaLamina
    }
    const velocidade = (() => {
      if (reduzir) return 0
      const antes = poseDaEspada(Math.max(0, t - 0.016), false)
      return (Math.hypot(pose.x - antes.x, pose.y - antes.y) + Math.abs(pose.rz - antes.rz) * 1.5) / 0.016
    })()
    const rastroVisivel = clamp01((velocidade - 2.5) / 6) * (t < T.impacto + 0.1 ? 1 : 0)
    RASTRO.forEach((atraso, i) => {
      const poseAntiga = poseDaEspada(Math.max(0, t - atraso), reduzir)
      const forca = rastroVisivel * (i === 0 ? 0.35 : 0.15)
      for (const [espada, lado] of [
        [rastroEsquerda[i], 1],
        [rastroDireita[i], -1],
      ] as const) {
        espada.grupo.visible = forca > 0.003
        aplicarPose(espada, poseAntiga, lado)
        espada.uniforms.uOpacidade.value = forca
      }
    })

    // Choque.
    if (reduzir) {
      uClarao.uForca.value = tau >= 0 ? 0.6 * (1 - span(tau, 0, 0.5)) : 0
      clarao.scale.setScalar(2)
    } else {
      uClarao.uForca.value = tau >= 0 ? Math.pow(1 - span(tau, 0, 0.32), 2) : 0
      clarao.scale.setScalar(0.5 + 3 * easeOutCubic(span(tau, 0, 0.25)))
      uEstrela.uForca.value = tau >= 0 ? (1 - span(tau, 0, 0.28)) * span(tau, -0.01, 0.02) : 0
      estrela.scale.setScalar(0.8 + 1.8 * easeOutCubic(span(tau, 0, 0.28)))
      estrela.rotation.z = 0.15 * span(tau, 0, 0.28)
      uOnda.uForca.value = tau >= 0 ? 0.6 * Math.pow(1 - span(tau, 0, 0.45), 1.5) : 0
      onda.scale.setScalar(0.3 + 3.1 * easeOutCubic(span(tau, 0, 0.45)))
      uTela.uForca.value = tau >= 0 ? 0.42 * Math.pow(1 - span(tau, 0, 0.14), 2) : 0
    }
    uPoco.uForca.value = tau >= 0 ? 0.5 + 0.6 * Math.exp(-tau * 4) : 0.25 * span(t, 0, 0.4)

    // Nome: nasce em brasa do centro para as pontas, esfria em ouro; um reflexo atravessa.
    const revelaInicio = reduzir ? R.revelaInicio : T.revelaInicio
    const revelaFim = reduzir ? R.revelaFim : T.revelaFim
    const esfriaFim = reduzir ? R.esfriaFim : T.esfriaFim
    if (reduzir) {
      uNome.uRevela.value = t >= revelaInicio ? 1 : 0
      uNome.uOpacidade.value = easeOutCubic(span(t, revelaInicio, revelaFim))
    } else {
      uNome.uRevela.value = easeOutCubic(span(t, revelaInicio, revelaFim))
      uNome.uOpacidade.value = 1
    }
    uNome.uCalor.value = 1 - easeOutCubic(span(t, revelaInicio + 0.05, esfriaFim))
    uNome.uBrilho.value = t < T.brilhoDoNomeInicio || t > T.brilhoDoNomeFim ? -1 : -0.2 + 1.45 * easeInOutSine(span(t, T.brilhoDoNomeInicio, T.brilhoDoNomeFim))
    const escalaDoNome = reduzir ? 1 : (1.14 - 0.14 * easeOutCubic(span(t, revelaInicio, revelaInicio + 0.42))) * (1 + 0.025 * span(t, revelaFim, T.fechaFim))
    grupoDoNome.scale.setScalar(escalaDoNome)

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
    const precisaNome = ((larguraDoNome / 2) * 1.16) / metadeVisivel + NOME_Z
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

/** Sala curta (cauda de 1,5 s) feita de ruído que cai, igual em toda volta. */
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

/** Zunido de lâmina cortando o ar: ruído numa banda que varre; `sobe` acelera até o fim, `cai` chega forte e freia. */
function zunido(s: Saida, a: number, duracao: number, pan: number, volume: number, de: number, ate: number, forma: 'sobe' | 'cai') {
  const { ctx } = s
  const banda = filtro(ctx, 'bandpass', de, 1.4)
  banda.frequency.setValueAtTime(de, a)
  banda.frequency.exponentialRampToValueAtTime(ate, a + duracao)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  if (forma === 'sobe') {
    g.gain.exponentialRampToValueAtTime(volume, a + duracao * 0.95)
    g.gain.exponentialRampToValueAtTime(0.0001, a + duracao + 0.04)
  } else {
    g.gain.exponentialRampToValueAtTime(volume, a + 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, a + duracao)
  }
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(pan, a)
  p.pan.linearRampToValueAtTime(pan * 0.3, a + duracao)
  g.connect(p)
  p.connect(s.seco)
  ruidoFiltrado(s, a, duracao + 0.08, [banda], g)
}

/** Batida grave: seno que despenca, baque de ruído abafado e um sub. */
function batida(s: Saida, a: number, volume: number, de: number, ate: number) {
  const { ctx } = s
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(de, a)
  osc.frequency.exponentialRampToValueAtTime(ate, a + 0.32)
  const g = ctx.createGain()
  envelope(g, a, volume, 0.004, 0.55)
  osc.connect(g)
  g.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.62)
  const baque = ctx.createGain()
  envelope(baque, a, volume * 0.6, 0.002, 0.14)
  baque.connect(s.seco)
  ruidoFiltrado(s, a, 0.2, [filtro(ctx, 'lowpass', 260)], baque)
  const sub = ctx.createOscillator()
  sub.frequency.value = 48
  const gs = ctx.createGain()
  envelope(gs, a, volume * 0.35, 0.01, 0.5)
  sub.connect(gs)
  gs.connect(s.seco)
  sub.start(a)
  sub.stop(a + 0.56)
}

/** Parciais inarmônicos de uma lâmina; a segunda vem 1,35% acima e as duas batem entre si. */
const PARCIAIS_DA_LAMINA: readonly [frequencia: number, volume: number, queda: number][] = [
  [1863, 0.2, 1.5],
  [2988, 0.15, 1.15],
  [4227, 0.11, 0.9],
  [5641, 0.07, 0.65],
  [7402, 0.045, 0.45],
]

/** O choque: estalo, "shiiing" da lâmina raspando a outra, o tinido das duas e a batida grave. */
function choque(s: Saida, a: number, forca: number) {
  const { ctx } = s
  const estalo = ctx.createGain()
  envelope(estalo, a, 0.6 * forca, 0.001, 0.03)
  estalo.connect(s.seco)
  ruidoFiltrado(s, a, 0.05, [filtro(ctx, 'highpass', 2500)], estalo)

  const raspa = ctx.createGain()
  envelope(raspa, a, 0.32 * forca, 0.004, 0.42)
  raspa.connect(s.seco)
  raspa.connect(s.sala)
  const banda = filtro(ctx, 'bandpass', 7600, 6)
  banda.frequency.setValueAtTime(7600, a)
  banda.frequency.exponentialRampToValueAtTime(3200, a + 0.3)
  ruidoFiltrado(s, a, 0.5, [filtro(ctx, 'highpass', 1800), banda], raspa)

  for (const [desvio, pan] of [
    [1, -0.18],
    [1.0135, 0.18],
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
  batida(s, a, 0.95 * forca, 150, 42)
}

/** "Tiin" baixinho do reflexo atravessando o nome. */
function tilin(s: Saida, a: number) {
  const { ctx } = s
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(-0.3, a)
  p.pan.linearRampToValueAtTime(0.3, a + 0.5)
  p.connect(s.seco)
  p.connect(s.sala)
  for (const [frequencia, volume] of [
    [3136, 0.045],
    [4699, 0.025],
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
  // Limitador na saída: o choque soma estalo, tinido e batida no mesmo instante.
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -10
  limitador.knee.value = 6
  limitador.ratio.value = 12
  limitador.attack.value = 0.002
  limitador.release.value = 0.25
  limitador.connect(kitDoMotor.destino)
  const sala = ctx.createConvolver()
  sala.buffer = respostaDaSala(ctx, 1.5)
  const volta = ctx.createGain()
  volta.gain.value = 0.32
  sala.connect(volta)
  volta.connect(limitador)
  const s: Saida = { ctx, seco: limitador, sala, ruido: kitDoMotor.ruido }
  const T = ROTEIRO_DAS_ESPADAS
  const pistas: Pista[] = reduzir
    ? [
        ['choque', ROTEIRO_REDUZIDO.impacto, (a) => choque(s, a, 0.75)],
        ['brilho', T.brilhoDoNomeInicio + 0.12, (a) => tilin(s, a)],
      ]
    : [
        [
          'zunido-entrada',
          0.02,
          (a) => {
            zunido(s, a, 0.36, -0.75, 0.5, 900, 2600, 'cai')
            zunido(s, a + 0.012, 0.36, 0.75, 0.45, 820, 2400, 'cai')
          },
        ],
        [
          'zunido-golpe',
          T.armadaFim - 0.02,
          (a) => {
            const duracao = T.impacto - T.armadaFim + 0.02
            zunido(s, a, duracao, -0.35, 0.55, 1200, 4200, 'sobe')
            zunido(s, a, duracao, 0.35, 0.5, 1100, 3900, 'sobe')
          },
        ],
        ['choque', T.impacto, (a) => choque(s, a, 1)],
        ['brilho', T.brilhoDoNomeInicio + 0.12, (a) => tilin(s, a)],
        ['corte', T.corte, (a) => corte(s, a)],
        ['fecha', T.fechaFim, (a) => batida(s, a, 0.55, 95, 34)],
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

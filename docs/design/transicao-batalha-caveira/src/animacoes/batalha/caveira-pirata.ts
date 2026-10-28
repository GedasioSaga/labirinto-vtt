import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'
import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Caveira pirata: a terceira abertura de batalha (pedido de 28/10/2026, "mais
 * uma animação de luta, dessa vez é uma caveira, que vai ganhar um brilho
 * vermelho nos olhos", no estilo "pirata, com ossos cruzados"; protótipo em
 * docs/design/transicao-batalha-caveira/). Faz par com a Bandeira da Marinha:
 * os piratas contra a Marinha. Esta pasta espelha `client/src`: o arquivo
 * entra como está em `client/src/animacoes/batalha/`.
 *
 * Uma caveira de osso velho com dois ossos cruzados atrás (Jolly Roger
 * genérica, desenho próprio) se forma da fumaça, de dentro para fora, numa
 * noite fria de mar. Uma pausa com as órbitas vazias. Então os olhos acendem
 * em vermelho, o esquerdo um instante antes do direito: um clarão curto que
 * assenta num brilho que pulsa, tinge o osso em volta e vaza na fumaça. O nome
 * sai da fumaça embaixo. No fim a cena apaga e só os olhos ficam no escuro,
 * até se fecharem como uma fenda; o motor fecha em preto e o mapa entra dali.
 *
 * Contrato: o mesmo `CriarCena` das transições (`src/transicoes/tipos.ts`),
 * com o `nome` opcional das aberturas. Nome ausente, vazio ou só espaço = sem
 * nome: a caveira sobe para o centro e a pista de som do nome fica fora.
 *
 * Tudo é `ShaderMaterial` sem conversão de cor na saída, sem luz na cena e sem
 * imagem externa: caveira, ossos e nome são pintados em canvas na montagem;
 * fumaça, poros do osso e o brilho dos olhos são contas no shader.
 */

export const NOME_MAX_LETRAS = 24

/** Roteiro em segundos (movimento completo, tela 16:9). */
export const ROTEIRO_DA_CAVEIRA = {
  duracao: 3.8,
  fadeInFim: 0.12,
  /** A caveira se forma da fumaça (o centro do crânio primeiro, as pontas dos ossos por último). */
  surgeInicio: 0.05,
  surgeFim: 1.15,
  /** A pausa: órbitas vazias; uma brasa mínima pega no fundo delas logo antes. */
  brasa: 1.4,
  acendeEsquerdo: 1.55,
  acendeDireito: 1.6,
  /** O vermelho termina de espalhar pela fumaça. */
  vazaFim: 2.2,
  nomeSurge: 2.02,
  nomeNitido: 2.5,
  /** Os dois pulsos do brilho (pico). */
  pulsos: [2.38, 3.0] as const,
  /** A cena apaga e só os olhos ficam; depois eles se fecham. */
  apagaInicio: 3.1,
  apagaFim: 3.5,
  fechaInicio: 3.42,
  fechaFim: 3.7,
  fadeOutInicio: 3.62,
} as const

/** Com movimento reduzido: nada se desloca; a caveira e o nome entram por dissolução e os olhos acendem sem clarão nem pulso. */
export const ROTEIRO_REDUZIDO = {
  surgeInicio: 0.1,
  surgeFim: 1.05,
  acende: 1.45,
  acendeFim: 1.95,
  nomeSurge: 2.0,
  nomeAceso: 2.45,
  apagaInicio: 3.1,
  apagaFim: 3.5,
  fadeOutInicio: 3.45,
} as const

export interface OpcoesDaCaveira extends OpcoesDaCena {
  /** O nome que sai da fumaça (grupo, inimigo). Ausente ou vazio = sem nome. */
  nome?: string
}

/** Espaços juntados, até 24 letras (sem partir emoji ao meio); `''` = sem nome. */
export function nomeDaBatalha(nome: string | undefined): string {
  const limpo = (nome ?? '').replace(/\s+/g, ' ').trim()
  return Array.from(limpo).slice(0, NOME_MAX_LETRAS).join('')
}

// ── Medidas ──────────────────────────────────────────────────────────────────

const FOV = 34
const TAN_MEIO_FOV = Math.tan((FOV * Math.PI) / 360)
const DISTANCIA_BASE = 6.6
/** O desenho do emblema mora num quadrado de 1600 unidades (centro em 800, 800). */
const DESENHO = 1600
const CENTRO = 800
const COR_PX = 1600
const MASCARA_PX = 800
/** Lado do plano do emblema no mundo. */
const EMBLEMA_LADO = 4
const K = EMBLEMA_LADO / DESENHO
/** Altura do centro do plano: com nome o emblema sobe para o nome caber embaixo. */
const EMBLEMA_Y_COM_NOME = 0.42
const EMBLEMA_Y_SEM_NOME = 0.06
/** Meia largura do emblema com folga: tela estreita afasta a câmera. */
const MEIA_LARGURA_DO_EMBLEMA = 1.6
/** Onde o brilho de cada olho nasce, no desenho (o fundo da órbita, um pouco abaixo do meio). */
const OLHO_DX = 148
const OLHO_Y = 760
const OLHO_X_MUNDO = OLHO_DX * K
const OLHO_Y_MUNDO = (CENTRO - OLHO_Y) * K
/** Os planos de fumaça: um atrás (junto com o fundo) e um na frente do emblema. */
const Z_FUNDO = -1.6
const Z_FUMACA_FRENTE = 0.75
/** O emblema vem de trás enquanto se forma. */
const Z_EMBLEMA_INICIO = -0.45

const NOME_LARGURA_PX = 2048
const NOME_ALTURA_PX = 512
const NOME_FONTE_MAX_PX = 230
const NOME_LARGURA_UTIL_PX = 1700
/** O nome fica diante da câmera (título), no terço de baixo. */
const NOME_DISTANCIA = 4
const NOME_Y = -0.78
const NOME_LARGURA = 3.0
/** A fonte de título do app (`--lb-font-display`). */
const FONTE_DO_NOME = "'Sitka Banner', 'Sitka Display', Constantia, Georgia, 'Times New Roman', serif"

// ── Shaders ──────────────────────────────────────────────────────────────────

// Hash só com aritmética (sem sin): mais barato na GPU integrada e igual em toda placa.
const GLSL_RUIDO = /* glsl */ `
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm3(vec2 p) {
  float v = 0.5 * ruido(p);
  v += 0.25 * ruido(p * 2.03 + vec2(1.7, 9.2));
  v += 0.125 * ruido(p * 4.01 + vec2(8.3, 2.8));
  return v / 0.875;
}`

/** O vermelho dos olhos espalhado num plano: duas manchas largas em volta da projeção de cada olho. */
const GLSL_VAZA = /* glsl */ `
uniform vec2 uVazaE;
uniform vec2 uVazaD;
uniform float uVaza;
float campoDosOlhos(vec2 p, float largura) {
  vec2 e = p - uVazaE;
  vec2 d = p - uVazaD;
  return (exp(-dot(e, e) / largura) + exp(-dot(d, d) / largura)) * uVaza;
}`

const VERTICE = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const VERTICE_MUNDO = /* glsl */ `
varying vec3 vPos;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vPos = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`

const VERTICE_LOCAL = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/** Tela inteira, sem câmera: as coordenadas saem direto em NDC. */
const VERTICE_TELA = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy * 2.0;
  gl_Position = vec4(vNdc, 0.0, 1.0);
}`

/**
 * O fundo: noite fria de mar, quase preta, com uma luz fraca atrás do crânio
 * (contraluz), e a fumaça de trás subindo devagar, mais densa embaixo. O
 * vermelho dos olhos tinge a fumaça onde ela é densa.
 */
const FRAG_FUNDO = /* glsl */ `
${GLSL_RUIDO}
${GLSL_VAZA}
uniform float uTempo;
uniform float uLuz;
uniform float uFumaca;
uniform vec2 uCentro;
varying vec3 vPos;
void main() {
  vec2 p = vPos.xy;
  vec2 r = (p - uCentro) / vec2(3.8, 2.5);
  vec3 cor = mix(vec3(0.04, 0.052, 0.054), vec3(0.006, 0.009, 0.01), smoothstep(0.0, 1.15, length(r))) * (0.25 + 0.75 * uLuz);
  vec2 atras = p - uCentro - vec2(0.0, 0.85);
  cor += vec3(0.045, 0.064, 0.07) * exp(-dot(atras, atras) / 1.6) * (0.4 + 0.6 * uLuz);
  vec2 q = p * 0.42 + vec2(0.0, -uTempo * 0.12);
  // Um ruído só torce o campo (dois custavam 1 ms a mais na GPU integrada).
  float w = ruido(q * 1.3 + vec2(uTempo * 0.07, 0.0));
  float n = fbm3(q + 1.15 * vec2(w, 0.6 - w) + vec2(uTempo * 0.03, 0.0));
  float baixo = smoothstep(1.3, -2.2, p.y - uCentro.y);
  float d = smoothstep(0.36, 0.84, n) * (0.4 + 0.6 * baixo) * uFumaca;
  vec3 fumaca = mix(vec3(0.085, 0.1, 0.104), vec3(0.25, 0.28, 0.29), smoothstep(0.55, 1.0, n));
  cor = mix(cor, fumaca * (0.3 + 0.7 * uLuz), d);
  cor += vec3(0.4, 0.028, 0.018) * campoDosOlhos(p, 0.55) * (0.1 + 0.95 * d);
  gl_FragColor = vec4(cor, 1.0);
}`

/**
 * O emblema pintado: poros do osso, luz fria de cima, o vermelho dos olhos no
 * osso em volta (o canal R da máscara diz o quanto cada ponto pega) e a brasa
 * no fundo das órbitas (canal G). Ao surgir, a forma condensa da fumaça: o
 * centro do crânio primeiro, as pontas dos ossos por último (canal B = crânio).
 */
const FRAG_EMBLEMA = /* glsl */ `
${GLSL_RUIDO}
uniform sampler2D uCor;
uniform sampler2D uMascara;
uniform float uSurge;
uniform float uLimpo;
uniform float uLuz;
uniform float uOlhoE;
uniform float uOlhoD;
uniform vec2 uUvE;
uniform vec2 uUvD;
uniform float uTempo;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uCor, vUv);
  if (c.a < 0.004) discard;
  vec3 m = texture2D(uMascara, vUv).rgb;

  // Formada (a maior parte da abertura), a dissolução nem é calculada.
  float forma = 1.0;
  float assenta = 1.0;
  if (uSurge < 1.0) {
    float n = 0.65 * fbm3(vUv * 4.5 + vec2(0.0, -uTempo * 0.3)) + 0.35 * ruido(vUv * 16.0 + vec2(uTempo * 0.4, 0.0));
    float ordem = length((vUv - vec2(0.5, 0.56)) * vec2(1.0, 1.15)) / 0.62 + 0.25 * (1.0 - m.b);
    ordem = 0.6 * ordem + 0.55 * n;
    // Em uSurge = 1 até a ponta mais longe já assentou (ordem máx. ~0,99 + 0,3): o desvio do ramo não dá salto.
    float p = uSurge * 1.45 - 0.12;
    forma = mix(smoothstep(ordem - 0.2, ordem + 0.04, p), uSurge, uLimpo);
    assenta = mix(smoothstep(ordem, ordem + 0.3, p), uSurge, uLimpo);
  }

  float poro = 0.55 * ruido(vUv * 260.0) + 0.45 * ruido(vUv * 72.0 + 3.1);
  vec3 osso = c.rgb * (0.86 + 0.22 * poro);
  vec3 cor = osso * vec3(0.82, 0.86, 0.88) * uLuz * (0.52 + 0.55 * smoothstep(0.25, 0.9, vUv.y));

  vec2 dE = vUv - uUvE;
  vec2 dD = vUv - uUvD;
  float alcance = exp(-dot(dE, dE) / 0.012) * uOlhoE + exp(-dot(dD, dD) / 0.012) * uOlhoD;
  cor += vec3(1.0, 0.14, 0.07) * c.rgb * m.r * alcance * 1.15;
  float fundo = exp(-dot(dE, dE) / 0.0011) * uOlhoE + exp(-dot(dD, dD) / 0.0011) * uOlhoD;
  cor += vec3(0.6, 0.04, 0.018) * m.g * (0.06 * (uOlhoE + uOlhoD) + 0.8 * fundo);

  vec3 fumaca = vec3(0.13, 0.15, 0.155) * (0.35 + 0.65 * uLuz);
  cor = mix(fumaca, cor, assenta) + vec3(0.2, 0.23, 0.24) * forma * (1.0 - assenta) * uLuz * (1.0 - uLimpo);
  float alfa = c.a * forma;
  gl_FragColor = vec4(cor * alfa, alfa);
}`

/** A fumaça da frente: fiapos que se abrem no centro quando a caveira se forma; o vermelho vaza nela. */
const FRAG_FUMACA = /* glsl */ `
${GLSL_RUIDO}
${GLSL_VAZA}
uniform float uTempo;
uniform float uLuz;
uniform float uFumaca;
uniform float uAbre;
uniform vec2 uCentro;
varying vec3 vPos;
void main() {
  vec2 p = vPos.xy;
  vec2 q = p * 0.62 + vec2(3.7, -uTempo * 0.21);
  float w = ruido(q * 0.8 + vec2(uTempo * 0.1, 2.0));
  float n = fbm3(q + vec2(1.4 * w, -0.6 * w));
  float d = smoothstep(0.46, 0.9, n);
  vec2 c = (p - uCentro) / vec2(1.7, 1.35);
  float centro = exp(-dot(c, c));
  float baixo = smoothstep(0.7, -1.7, p.y - uCentro.y);
  d *= (0.3 + 0.7 * baixo) * uFumaca * (1.0 - 0.82 * uAbre * centro);
  float fecha = 1.0 - uAbre;
  d = max(d, smoothstep(0.3, 0.78, n) * centro * fecha * fecha * 0.95 * uFumaca);
  vec3 cor = mix(vec3(0.1, 0.115, 0.12), vec3(0.3, 0.33, 0.34), smoothstep(0.62, 1.0, n)) * (0.28 + 0.72 * uLuz);
  cor += vec3(0.75, 0.05, 0.03) * campoDosOlhos(p, 0.32);
  float a = d * 0.78;
  gl_FragColor = vec4(cor * a, a);
}`

/**
 * O brilho dos olhos, somado por cima: um ponto quente no fundo de cada órbita,
 * o vermelho em volta, o halo largo e uma faixa horizontal fina. Fechando, o
 * brilho achata até virar uma fenda e some. Soma pura (alfa 0 na saída).
 */
const FRAG_OLHOS = /* glsl */ `
uniform vec2 uE;
uniform vec2 uD;
uniform float uForcaE;
uniform float uForcaD;
uniform float uFecha;
uniform float uFaixa;
varying vec2 vLocal;
vec3 olho(vec2 p, vec2 c, float forca) {
  if (forca <= 0.0) return vec3(0.0);
  vec2 d = p - c;
  float alto = max(0.05, 1.0 - 0.93 * uFecha);
  vec2 q = vec2(d.x * 0.88, d.y / alto);
  float r2 = dot(q, q);
  float raio = 0.75 + 0.25 * min(forca, 1.7);
  float nucleo = exp(-r2 / (0.0005 * raio));
  float meio = exp(-r2 / (0.0026 * raio));
  float halo = exp(-sqrt(r2) / (0.16 * raio));
  float faixa = exp(-abs(d.y) / (0.009 * alto)) * exp(-abs(d.x) / 0.55) * uFaixa;
  return (vec3(1.0, 0.66, 0.42) * nucleo * 0.85 + vec3(1.0, 0.1, 0.04) * meio * 0.85 + vec3(0.48, 0.015, 0.01) * halo * 0.3 + vec3(0.85, 0.05, 0.03) * faixa * 0.34) * forca;
}
void main() {
  gl_FragColor = vec4(olho(vLocal, uE, uForcaE) + olho(vLocal, uD, uForcaD), 0.0);
}`

/** O nome sai da fumaça (dissolução por ruído, do meio para as pontas) e pega o vermelho dos olhos no alto das letras. */
const FRAG_NOME = /* glsl */ `
${GLSL_RUIDO}
uniform sampler2D uMapa;
uniform float uSurge;
uniform float uLimpo;
uniform float uDesfoque;
uniform float uOlhos;
uniform float uApaga;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMapa, vUv, uDesfoque);
  float n = fbm3(vUv * vec2(10.0, 2.5) + vec2(3.0, 0.0));
  float ordem = 0.7 * n + 0.45 * abs(vUv.x - 0.5);
  float p = uSurge * 1.3 - 0.1;
  float a = mix(smoothstep(ordem - 0.07, ordem + 0.07, p), uSurge, uLimpo);
  float face = smoothstep(0.25, 0.6, dot(c.rgb, vec3(0.333)));
  vec3 cor = c.rgb + vec3(0.7, 0.06, 0.03) * uOlhos * 0.3 * face * smoothstep(0.32, 0.72, vUv.y);
  float alfa = c.a * a * uApaga;
  gl_FragColor = vec4(cor * alfa, alfa);
}`

/** Por cima de tudo: vinheta e um grão fino (também esconde as faixas do degradê escuro). */
const FRAG_TELA = /* glsl */ `
uniform float uTempo;
uniform float uGrao;
varying vec2 vNdc;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float vinheta = smoothstep(0.5, 1.5, length(vNdc * vec2(0.92, 1.0))) * 0.6;
  float g = hash(floor(gl_FragCoord.xy * 0.5) + vec2(floor(uTempo * 24.0) * 17.0, 3.0)) - 0.5;
  float escuro = max(-g, 0.0) * uGrao * 2.0;
  gl_FragColor = vec4(vec3(max(g, 0.0) * uGrao), clamp(vinheta + escuro, 0.0, 1.0));
}`

// ── O emblema, desenhado no quadrado de 1600 ─────────────────────────────────

type Ponto = readonly [number, number]
/** Um trecho cúbico: controle 1, controle 2, ponto final. */
type Trecho = readonly [Ponto, Ponto, Ponto]

/** O lado direito do contorno do crânio com a mandíbula, do alto (0, 330) até o queixo (0, 1084); x relativo ao centro. */
const CRANIO_INICIO: Ponto = [0, 330]
const CRANIO: readonly Trecho[] = [
  [[172, 330], [306, 440], [306, 602]],
  [[306, 682], [287, 722], [273, 748]],
  [[283, 768], [297, 790], [293, 814]],
  [[286, 864], [240, 906], [206, 930]],
  [[195, 952], [193, 978], [197, 1000]],
  [[199, 1036], [160, 1064], [112, 1073]],
  [[66, 1081], [28, 1084], [0, 1084]],
]

/** A órbita direita, fechada, começando no canto de dentro do alto (a sobrancelha desce para o nariz: cara de ameaça). */
const ORBITA_INICIO: Ponto = [46, 714]
const ORBITA: readonly Trecho[] = [
  [[110, 690], [176, 658], [228, 660]],
  [[262, 662], [264, 724], [242, 764]],
  [[222, 802], [182, 832], [130, 830]],
  [[74, 828], [36, 774], [46, 714]],
]

/** O lado direito do nariz (pera de cabeça para baixo, com o septo embaixo). */
const NARIZ_INICIO: Ponto = [0, 810]
const NARIZ: readonly Trecho[] = [
  [[14, 832], [47, 852], [45, 880]],
  [[43, 898], [27, 905], [15, 901]],
  [[8, 898], [3, 891], [0, 887]],
]

/** Contorno simétrico: o lado direito como veio e o esquerdo espelhado, de volta ao início. */
function contornoSimetrico(inicio: Ponto, trechos: readonly Trecho[]): Path2D {
  const p = new Path2D()
  p.moveTo(CENTRO + inicio[0], inicio[1])
  for (const [c1, c2, fim] of trechos) p.bezierCurveTo(CENTRO + c1[0], c1[1], CENTRO + c2[0], c2[1], CENTRO + fim[0], fim[1])
  for (let i = trechos.length - 1; i >= 0; i--) {
    const [c1, c2] = trechos[i]
    const anterior = i === 0 ? inicio : trechos[i - 1][2]
    p.bezierCurveTo(CENTRO - c2[0], c2[1], CENTRO - c1[0], c1[1], CENTRO - anterior[0], anterior[1])
  }
  p.closePath()
  return p
}

/** Contorno fechado de um lado (lado = 1 direita, -1 esquerda). */
function contornoDeUmLado(inicio: Ponto, trechos: readonly Trecho[], lado: 1 | -1): Path2D {
  const p = new Path2D()
  p.moveTo(CENTRO + lado * inicio[0], inicio[1])
  for (const [c1, c2, fim] of trechos) p.bezierCurveTo(CENTRO + lado * c1[0], c1[1], CENTRO + lado * c2[0], c2[1], CENTRO + lado * fim[0], fim[1])
  p.closePath()
  return p
}

const CONTORNO = '#1a120b'

interface Osso {
  /** Ponto do cruzamento, ângulo (rad, y para baixo) e meia distância até o começo das cabeças. */
  x: number
  y: number
  angulo: number
  meio: number
}

/** Os dois ossos atrás da caveira, cruzando atrás da boca. */
const OSSOS: readonly Osso[] = [
  { x: CENTRO, y: 862, angulo: 0.6, meio: 470 },
  { x: CENTRO, y: 862, angulo: -0.6, meio: 470 },
]

/** O osso longo: haste com cintura e as duas cabeças de dois lóbulos (sempre no sentido horário, para a união preencher). */
function formaDoOsso(meio: number): Path2D {
  const p = new Path2D()
  const ponta = 44
  const cintura = 31
  p.moveTo(-meio, -ponta)
  p.bezierCurveTo(-meio * 0.45, -cintura, meio * 0.45, -cintura, meio, -ponta)
  p.lineTo(meio, ponta)
  p.bezierCurveTo(meio * 0.45, cintura, -meio * 0.45, cintura, -meio, ponta)
  p.closePath()
  for (const lado of [-1, 1]) {
    const cx = lado * (meio + 26)
    for (const [dx, dy, r] of [
      [18, -38, 50],
      [18, 38, 50],
      [0, 0, 46],
    ] as const) {
      p.moveTo(cx + lado * dx + r, dy)
      p.arc(cx + lado * dx, dy, r, 0, Math.PI * 2)
    }
  }
  return p
}

function pintarOsso(g: CanvasRenderingContext2D, osso: Osso): void {
  const forma = formaDoOsso(osso.meio)
  g.save()
  g.translate(osso.x, osso.y)
  g.rotate(osso.angulo)
  // A luz vem de cima à esquerda: o lado de cima de cada osso pega mais ou menos conforme o ângulo.
  const virado = Math.max(0, -0.6 * Math.sin(osso.angulo) + 0.8 * Math.cos(osso.angulo))
  g.lineJoin = 'round'
  g.strokeStyle = CONTORNO
  g.lineWidth = 16
  g.stroke(forma)
  const largura = 92
  const face = g.createLinearGradient(0, -largura, 0, largura)
  face.addColorStop(0, virado > 0.7 ? '#efe4c9' : '#d9cba8')
  face.addColorStop(0.4, '#cdbb91')
  face.addColorStop(0.75, '#9b865d')
  face.addColorStop(1, '#5e4c30')
  g.fillStyle = face
  g.fill(forma)
  g.save()
  g.clip(forma)
  // Volume: sombra larga e macia embaixo, brilho estreito em cima, a cabeça mais clara que a haste.
  for (const [w, y, cor] of [
    [34, 40, 'rgba(46, 31, 15, 0.22)'],
    [18, 34, 'rgba(46, 31, 15, 0.22)'],
    [16, -22, `rgba(255, 250, 236, ${0.1 + 0.14 * virado})`],
    [7, -20, `rgba(255, 250, 236, ${0.1 + 0.16 * virado})`],
  ] as const) {
    g.strokeStyle = cor
    g.lineWidth = w
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(-osso.meio * 0.9, y)
    g.bezierCurveTo(-osso.meio * 0.45, y * 0.75, osso.meio * 0.45, y * 0.75, osso.meio * 0.9, y)
    g.stroke()
  }
  for (const lado of [-1, 1]) {
    const cx = lado * (osso.meio + 30)
    mancha(g, cx, -30, 52, '255, 250, 236', 0.16 + 0.2 * virado)
    // A garganta entre a haste e a cabeça.
    mancha(g, lado * (osso.meio - 6), 0, 40, '46, 31, 15', 0.28)
  }
  g.restore()
  g.restore()
}

/** Um gradiente radial de uma cor, do centro até sumir. */
function mancha(g: CanvasRenderingContext2D, x: number, y: number, raio: number, cor: string, alfa: number): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, raio)
  grad.addColorStop(0, `rgba(${cor}, ${alfa})`)
  grad.addColorStop(1, `rgba(${cor}, 0)`)
  g.fillStyle = grad
  g.fillRect(x - raio, y - raio, raio * 2, raio * 2)
}

/** Os dentes de cima e de baixo, numa linha que sobe nos cantos (sorriso de caveira). */
function pintarDentes(g: CanvasRenderingContext2D): void {
  const n = 8
  const metade = 128
  const largura = (2 * metade) / n
  const curva = (x: number) => -0.0008 * x * x
  // A boca: só uma sombra funda atrás da linha da mordida (o resto é osso).
  g.save()
  g.translate(CENTRO, 980)
  g.scale(1, 0.32)
  mancha(g, 0, 0, metade + 36, '18, 11, 6', 0.75)
  g.restore()
  for (const [cima, topo, altura] of [
    [true, 934, 44],
    [false, 984, 37],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const x0 = -metade + i * largura
      const xm = x0 + largura / 2
      const borda = Math.abs(xm) / metade
      const folga = 2.5 + 1.5 * borda
      const alto = altura * (1 - 0.22 * borda * borda)
      const y0 = cima ? topo + curva(xm) : topo + 0.55 * curva(xm)
      const caminho = new Path2D()
      caminho.roundRect(CENTRO + x0 + folga, y0, largura - 2 * folga, alto, cima ? [4, 4, 12, 12] : [12, 12, 4, 4])
      g.strokeStyle = CONTORNO
      g.lineWidth = 7
      g.stroke(caminho)
      const dente = g.createLinearGradient(0, y0, 0, y0 + alto)
      const claro = borda > 0.8 ? '#b5a27b' : '#e8dcc0'
      dente.addColorStop(0, cima ? '#a8946b' : claro)
      dente.addColorStop(cima ? 0.4 : 0.25, claro)
      dente.addColorStop(1, cima ? '#cdbd97' : '#7d6a47')
      g.fillStyle = dente
      g.fill(caminho)
    }
  }
}

/** Uma rachadura cavada: fenda escura com a beirada de baixo clara. */
function rachadura(g: CanvasRenderingContext2D, pontos: readonly Ponto[], largura: number): void {
  for (const [cor, w, dx, dy] of [
    ['rgba(255, 248, 230, 0.3)', largura * 0.55, 2, 3],
    ['#24170d', largura, 0, 0],
  ] as const) {
    g.strokeStyle = cor
    g.lineWidth = w
    g.beginPath()
    pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(CENTRO + x + dx, y + dy) : g.lineTo(CENTRO + x + dx, y + dy)))
    g.stroke()
  }
}

/**
 * Pinta o emblema (ossos e caveira) no espaço de 1600 de `g`: osso envelhecido
 * em marfim frio, luz de cima à esquerda, órbitas fundas com a sobrancelha
 * descendo para o nariz, nariz de pera, dentes em sorriso, uma rachadura no
 * crânio e contorno escuro de emblema.
 */
export function desenharEmblema(g: CanvasRenderingContext2D): void {
  const cranio = contornoSimetrico(CRANIO_INICIO, CRANIO)
  for (const osso of OSSOS) pintarOsso(g, osso)

  // A sombra da caveira sobre os ossos (só onde já há osso).
  g.save()
  g.globalCompositeOperation = 'source-atop'
  g.shadowColor = 'rgba(14, 8, 4, 0.8)'
  g.shadowBlur = 36
  g.shadowOffsetX = 18
  g.shadowOffsetY = 26
  g.fillStyle = 'rgba(14, 8, 4, 0.85)'
  g.fill(cranio)
  g.restore()

  g.lineJoin = 'round'
  g.strokeStyle = CONTORNO
  g.lineWidth = 16
  g.stroke(cranio)
  const base = g.createRadialGradient(CENTRO - 120, 520, 40, CENTRO - 60, 600, 760)
  base.addColorStop(0, '#f3ead6')
  base.addColorStop(0.35, '#e2d4b2')
  base.addColorStop(0.7, '#bba67c')
  base.addColorStop(1, '#7e6946')
  g.fillStyle = base
  g.fill(cranio)

  g.save()
  g.clip(cranio)
  // Volume: a beirada escurece por dentro, em passos largos e fracos.
  g.strokeStyle = 'rgba(66, 44, 22, 0.045)'
  for (let w = 170; w > 8; w -= 12) {
    g.lineWidth = w
    g.stroke(cranio)
  }
  // Contraluz fria no alto do crânio.
  g.strokeStyle = 'rgba(236, 246, 250, 0.22)'
  g.lineWidth = 10
  g.beginPath()
  g.ellipse(CENTRO + 6, 610, 292, 274, 0, Math.PI * 1.12, Math.PI * 1.9)
  g.stroke()
  // Têmporas e bochechas fundas.
  for (const lado of [-1, 1]) {
    g.save()
    g.translate(CENTRO + lado * 286, 752)
    g.scale(0.45, 1)
    mancha(g, 0, 0, 90, '58, 38, 18', 0.55)
    g.restore()
    mancha(g, CENTRO + lado * 190, 948, 72, '46, 30, 14', 0.6)
    mancha(g, CENTRO + lado * 196, 842, 54, '255, 249, 232', 0.22)
  }
  // A testa e a ponte do nariz pegam luz.
  mancha(g, CENTRO - 70, 470, 220, '255, 251, 238', 0.3)
  mancha(g, CENTRO, 772, 46, '255, 249, 232', 0.25)
  // A sombra que a testa joga sobre o rosto.
  const rosto = g.createLinearGradient(0, 640, 0, 760)
  rosto.addColorStop(0, 'rgba(60, 40, 20, 0)')
  rosto.addColorStop(1, 'rgba(60, 40, 20, 0.14)')
  g.fillStyle = rosto
  g.fillRect(0, 640, DESENHO, 460)
  rachadura(
    g,
    [
      [128, 352],
      [112, 408],
      [140, 450],
      [108, 516],
      [121, 562],
    ],
    7,
  )
  rachadura(
    g,
    [
      [112, 408],
      [70, 432],
      [58, 468],
    ],
    5,
  )
  g.restore()

  // Órbitas: buracos fundos, mais escuros no alto (a sobrancelha faz sombra), com a beirada de baixo pegando luz.
  for (const lado of [-1, 1] as const) {
    const orbita = contornoDeUmLado(ORBITA_INICIO, ORBITA, lado)
    const cx = CENTRO + lado * 148
    g.strokeStyle = 'rgba(255, 248, 228, 0.32)'
    g.lineWidth = 18
    g.save()
    g.translate(0, 7)
    g.stroke(orbita)
    g.restore()
    const fundo = g.createRadialGradient(cx, 772, 8, cx, 752, 120)
    fundo.addColorStop(0, '#040201')
    fundo.addColorStop(0.62, '#120a05')
    fundo.addColorStop(1, '#3b2814')
    g.fillStyle = fundo
    g.fill(orbita)
    g.save()
    g.clip(orbita)
    const sombra = g.createLinearGradient(0, 656, 0, 730)
    sombra.addColorStop(0, 'rgba(0, 0, 0, 0.75)')
    sombra.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = sombra
    g.fillRect(cx - 140, 640, 280, 100)
    g.restore()
    g.strokeStyle = CONTORNO
    g.lineWidth = 6
    g.stroke(orbita)
    // Sobrancelha: o osso logo acima da órbita pega luz (mais do lado da luz).
    g.strokeStyle = `rgba(255, 251, 238, ${lado < 0 ? 0.3 : 0.18})`
    g.lineWidth = 12
    g.beginPath()
    g.moveTo(CENTRO + lado * 60, 690)
    g.bezierCurveTo(CENTRO + lado * 116, 668, CENTRO + lado * 178, 640, CENTRO + lado * 232, 644)
    g.stroke()
  }

  const nariz = contornoSimetrico(NARIZ_INICIO, NARIZ)
  const fundoDoNariz = g.createLinearGradient(0, 810, 0, 900)
  fundoDoNariz.addColorStop(0, '#070402')
  fundoDoNariz.addColorStop(1, '#2a1a0d')
  g.fillStyle = fundoDoNariz
  g.fill(nariz)
  g.strokeStyle = CONTORNO
  g.lineWidth = 5
  g.stroke(nariz)

  pintarDentes(g)
}

/**
 * A máscara (meia resolução, opaca): R = o quanto cada ponto do osso pega a luz
 * dos olhos (beirada das órbitas, maçãs, ponte do nariz; pouco na testa), G =
 * o fundo das órbitas (onde a brasa acende), B = é crânio (os ossos surgem
 * depois).
 */
function desenharMascara(g: CanvasRenderingContext2D): void {
  const cranio = contornoSimetrico(CRANIO_INICIO, CRANIO)
  g.fillStyle = '#000'
  g.fillRect(0, 0, DESENHO, DESENHO)
  g.globalCompositeOperation = 'lighter'
  g.fillStyle = 'rgb(0, 0, 255)'
  g.fill(cranio)
  g.save()
  g.clip(cranio)
  g.fillStyle = 'rgb(22, 0, 0)'
  g.fill(cranio)
  for (const lado of [-1, 1]) {
    mancha(g, CENTRO + lado * 150, 812, 210, '255, 0, 0', 0.8)
    mancha(g, CENTRO + lado * 196, 850, 70, '255, 0, 0', 0.35)
  }
  mancha(g, CENTRO, 790, 80, '255, 0, 0', 0.45)
  g.restore()
  for (const lado of [-1, 1] as const) {
    const orbita = contornoDeUmLado(ORBITA_INICIO, ORBITA, lado)
    g.save()
    g.clip(cranio)
    g.strokeStyle = 'rgba(255, 0, 0, 0.55)'
    g.lineWidth = 30
    g.stroke(orbita)
    g.restore()
    g.save()
    g.shadowColor = 'rgb(0, 255, 0)'
    g.shadowBlur = 10
    g.fillStyle = 'rgb(0, 255, 0)'
    g.fill(orbita)
    g.restore()
  }
}

// ── Pintura ──────────────────────────────────────────────────────────────────

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const g = canvas.getContext('2d')
  if (!g) throw new Error('caveira pirata: sem canvas 2D')
  return [canvas, g]
}

function pintarEmblema(THREE: ThreeModule): { cor: Three.CanvasTexture; mascara: Three.CanvasTexture } {
  const [canvasCor, g] = tela(COR_PX, COR_PX)
  g.setTransform(COR_PX / DESENHO, 0, 0, COR_PX / DESENHO, 0, 0)
  desenharEmblema(g)
  const [canvasMascara, m] = tela(MASCARA_PX, MASCARA_PX)
  m.setTransform(MASCARA_PX / DESENHO, 0, 0, MASCARA_PX / DESENHO, 0, 0)
  desenharMascara(m)
  const cor = new THREE.CanvasTexture(canvasCor)
  cor.anisotropy = 4
  return { cor, mascara: new THREE.CanvasTexture(canvasMascara) }
}

interface NomePintado {
  textura: Three.CanvasTexture
  /** Largura do texto (com o halo) em fração da largura da textura. */
  fracao: number
}

/** O nome em osso envelhecido: halo escuro largo (lê sobre a fumaça), contorno quase preto, face marfim gasta. */
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
  const cx = NOME_LARGURA_PX / 2
  const base = NOME_ALTURA_PX / 2 + (subida - descida) / 2
  const topo = base - subida
  g.lineJoin = 'round'
  g.save()
  g.shadowColor = 'rgba(0, 0, 0, 0.85)'
  g.shadowBlur = px * 0.34
  g.fillStyle = 'rgba(0, 0, 0, 0.6)'
  g.fillText(nome, cx, base)
  g.restore()
  g.strokeStyle = '#120a05'
  g.lineWidth = px * 0.075
  g.strokeText(nome, cx, base)
  const face = g.createLinearGradient(0, topo, 0, base + descida)
  face.addColorStop(0, '#efe5cb')
  face.addColorStop(0.5, '#d4c299')
  face.addColorStop(1, '#957e52')
  g.fillStyle = face
  g.fillText(nome, cx, base)
  // Desgaste: lascas escuras e riscos claros só por cima das letras.
  const rnd = semente(1717)
  g.save()
  g.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < 260; i++) {
    const x = cx + (rnd() - 0.5) * medida.width
    const y = topo + rnd() * (subida + descida)
    const comprimento = 3 + rnd() * 14
    const angulo = rnd() * Math.PI
    g.strokeStyle = rnd() < 0.62 ? 'rgba(48, 30, 14, 0.4)' : 'rgba(255, 250, 236, 0.18)'
    g.lineWidth = 1 + rnd() * 2.2
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(angulo) * comprimento, y + Math.sin(angulo) * comprimento)
    g.stroke()
  }
  g.restore()
  const textura = new THREE.CanvasTexture(canvas)
  return { textura, fracao: Math.min(1, (medida.width + px * 0.8) / NOME_LARGURA_PX) }
}

// ── Tempo ────────────────────────────────────────────────────────────────────

const T = ROTEIRO_DA_CAVEIRA
const R = ROTEIRO_REDUZIDO

function pancada(tau: number, pico: number): number {
  if (tau <= 0) return 0
  return (tau / pico) * Math.exp(1 - tau / pico)
}

/** O acender de um olho: sobe em 70 ms, passa do ponto (até ~1,75) e assenta. */
function acendimento(t: number, acende: number): number {
  const s = t - acende
  if (s <= 0) return 0
  const sobe = easeOutCubic(clamp01(s / 0.07))
  return sobe * (1 + 1.1 * Math.exp(-s / 0.15))
}

/**
 * Os dois pulsos, como brasa soprada: sobem em 0,12 s até o pico e caem devagar.
 * A queda (1 + s/τ)·e^(−s/τ) sai do pico com velocidade zero: o brilho não faz
 * bico no alto.
 */
function pulsos(t: number): number {
  const SOBE = 0.12
  const TAU = 0.2
  let soma = 0
  for (const pico of T.pulsos) {
    const s = t - pico
    if (s < -SOBE) continue
    soma += 0.34 * (s < 0 ? easeInOutSine((s + SOBE) / SOBE) : (1 + s / TAU) * Math.exp(-s / TAU))
  }
  return soma
}

/** Respiração lenta e um tremor miúdo de fogo (só 3%, abaixo de 6 Hz). */
function vida(t: number): number {
  const tremor = 0.5 * Math.sin(t * 13.1) + 0.3 * Math.sin(t * 21.7 + 1) + 0.2 * Math.sin(t * 33.9 + 2)
  return 0.04 * Math.sin((2 * Math.PI * t) / 1.4) + 0.03 * tremor
}

function fechamento(t: number): number {
  return easeInOutSine(span(t, T.fechaInicio, T.fechaFim))
}

/** Força de cada olho (0 = apagado, 1 = aceso, até ~1,7 no clarão). */
function forcaDosOlhos(t: number, reduzir: boolean): [number, number] {
  if (reduzir) {
    const f = easeInOutSine(span(t, R.acende, R.acendeFim)) * (1 - easeInOutSine(span(t, R.apagaInicio + 0.15, R.apagaFim + 0.1)))
    return [f, f]
  }
  const brasa = 0.1 * easeOutCubic(span(t, T.brasa, T.acendeEsquerdo))
  const fica = 1 - (t < T.fechaInicio ? 0 : easeInOutSine(span(fechamento(t), 0.5, 1)))
  const extra = 1 + pulsos(t) + (t > T.acendeEsquerdo ? vida(t) : 0)
  return [
    Math.max(brasa, acendimento(t, T.acendeEsquerdo) * extra) * fica,
    Math.max(brasa, acendimento(t, T.acendeDireito) * extra) * fica,
  ]
}

/** A luz da cena: sobe enquanto a caveira se forma, baixa um pouco quando os olhos acendem e apaga no fim. */
function luzDaCena(t: number, reduzir: boolean): number {
  if (reduzir) {
    const sobe = easeInOutSine(span(t, R.surgeInicio, R.surgeFim))
    return (0.08 + 0.92 * sobe) * (1 - 0.12 * easeInOutSine(span(t, R.acende, R.acendeFim))) * (1 - easeInOutSine(span(t, R.apagaInicio, R.apagaFim)))
  }
  const sobe = easeOutCubic(span(t, 0.04, 1.3))
  const baixa = 1 - 0.22 * easeInOutSine(span(t, T.brasa - 0.05, T.acendeEsquerdo + 0.3))
  return (0.06 + 0.94 * sobe) * baixa * (1 - easeInOutSine(span(t, T.apagaInicio, T.apagaFim)))
}

interface EstadoDaCamera {
  x: number
  y: number
  z: number
}

function estadoDaCamera(t: number, reduzir: boolean, distancia: number): EstadoDaCamera {
  if (reduzir) return { x: 0, y: 0, z: distancia }
  const escala = distancia / DISTANCIA_BASE
  // Aproxima devagar a cena toda; um tranco curto para a frente quando os olhos acendem.
  const z = distancia * (1.07 - 0.07 * easeOutCubic(span(t, 0, T.duracao))) - 0.035 * distancia * pancada(t - T.acendeEsquerdo, 0.08)
  return { x: 0.025 * escala * Math.sin(t * 0.7 + 0.4), y: 0.015 * escala * Math.sin(t * 0.9), z }
}

function fadeDaCaveira(t: number, reduzir: boolean): number {
  const entrada = 1 - easeOutCubic(span(t, 0, T.fadeInFim))
  const saida = easeInOutSine(span(t, reduzir ? R.fadeOutInicio : T.fadeOutInicio, T.duracao))
  return Math.max(entrada, saida)
}

// ── Cena ─────────────────────────────────────────────────────────────────────

type Descartavel = { dispose: () => void }

/** Mistura pré-multiplicada (a saída dos shaders já vem multiplicada pelo alfa). */
function materialPorCima(THREE: ThreeModule, vertexShader: string, fragmentShader: string, uniforms: Record<string, Three.IUniform>): Three.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  })
}

export function criarCenaCaveiraPirata(THREE: ThreeModule, opcoes: OpcoesDaCaveira): CenaTransicao {
  const reduzir = opcoes.reduzirMovimento
  const nomeLimpo = nomeDaBatalha(opcoes.nome)
  const comNome = nomeLimpo !== ''
  const emblemaY = comNome ? EMBLEMA_Y_COM_NOME : EMBLEMA_Y_SEM_NOME
  const lixo: Descartavel[] = []
  const guardar = <X extends Descartavel>(x: X): X => {
    lixo.push(x)
    return x
  }
  const vec2 = (x: number, y: number) => new THREE.Vector2(x, y)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 60)
  scene.add(camera)
  let aspecto = 16 / 9
  let distancia = DISTANCIA_BASE

  // O vermelho que vaza: cada plano recebe os olhos projetados na própria profundidade.
  const uTempo = { value: 0 }
  const uLuz = { value: 0 }
  const uFumaca = { value: 1 }
  const uVaza = { value: 0 }
  const uCentro = { value: vec2(0, emblemaY + 0.22) }

  const uFundo = { uTempo, uLuz, uFumaca, uCentro, uVaza, uVazaE: { value: vec2(0, 0) }, uVazaD: { value: vec2(0, 0) } }
  const fundo = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(30, 17)),
    guardar(new THREE.ShaderMaterial({ vertexShader: VERTICE_MUNDO, fragmentShader: FRAG_FUNDO, uniforms: uFundo, depthTest: false, depthWrite: false })),
  )
  fundo.position.set(0, 0, Z_FUNDO)
  fundo.renderOrder = 1
  fundo.frustumCulled = false
  scene.add(fundo)

  // O emblema e o brilho dos olhos andam juntos (o emblema vem de trás enquanto se forma).
  const emblema = new THREE.Group()
  emblema.position.set(0, emblemaY, 0)
  scene.add(emblema)
  const pintado = pintarEmblema(THREE)
  const uvDoOlho = (lado: number) => vec2(0.5 + (lado * OLHO_DX) / DESENHO, 1 - OLHO_Y / DESENHO)
  const uEmblema = {
    uCor: { value: guardar(pintado.cor) as Three.Texture },
    uMascara: { value: guardar(pintado.mascara) as Three.Texture },
    uSurge: { value: 0 },
    uLimpo: { value: reduzir ? 1 : 0 },
    uLuz,
    uOlhoE: { value: 0 },
    uOlhoD: { value: 0 },
    uUvE: { value: uvDoOlho(-1) },
    uUvD: { value: uvDoOlho(1) },
    uTempo,
  }
  const placa = new THREE.Mesh(guardar(new THREE.PlaneGeometry(EMBLEMA_LADO, EMBLEMA_LADO)), guardar(materialPorCima(THREE, VERTICE, FRAG_EMBLEMA, uEmblema)))
  placa.renderOrder = 2
  placa.frustumCulled = false
  emblema.add(placa)

  const uFrente = { uTempo, uLuz, uFumaca, uCentro, uVaza, uAbre: { value: 0 }, uVazaE: { value: vec2(0, 0) }, uVazaD: { value: vec2(0, 0) } }
  const frente = new THREE.Mesh(guardar(new THREE.PlaneGeometry(16, 9)), guardar(materialPorCima(THREE, VERTICE_MUNDO, FRAG_FUMACA, uFrente)))
  frente.position.set(0, 0, Z_FUMACA_FRENTE)
  frente.renderOrder = 3
  frente.frustumCulled = false
  scene.add(frente)

  const uOlhos = {
    uE: { value: vec2(-OLHO_X_MUNDO, 0) },
    uD: { value: vec2(OLHO_X_MUNDO, 0) },
    uForcaE: { value: 0 },
    uForcaD: { value: 0 },
    uFecha: { value: 0 },
    uFaixa: { value: 0 },
  }
  const olhos = new THREE.Mesh(guardar(new THREE.PlaneGeometry(3.4, 1.8)), guardar(materialPorCima(THREE, VERTICE_LOCAL, FRAG_OLHOS, uOlhos)))
  olhos.position.set(0, OLHO_Y_MUNDO, 0.02)
  olhos.renderOrder = 4
  olhos.frustumCulled = false
  emblema.add(olhos)

  // O nome: um título diante da câmera, embaixo. Sem nome, o plano nem existe.
  const nome = comNome ? pintarNome(THREE, nomeLimpo) : null
  const uNome = {
    uMapa: { value: (nome ? guardar(nome.textura) : null) as Three.Texture | null },
    uSurge: { value: 0 },
    uLimpo: { value: reduzir ? 1 : 0 },
    uDesfoque: { value: 0 },
    uOlhos: { value: 0 },
    uApaga: { value: 1 },
  }
  const placaDoNome = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(NOME_LARGURA, (NOME_LARGURA * NOME_ALTURA_PX) / NOME_LARGURA_PX)),
    guardar(materialPorCima(THREE, VERTICE, FRAG_NOME, uNome)),
  )
  placaDoNome.position.set(0, NOME_Y, -NOME_DISTANCIA)
  placaDoNome.renderOrder = 5
  placaDoNome.frustumCulled = false
  placaDoNome.visible = false
  if (nome) camera.add(placaDoNome)
  const larguraDoTexto = NOME_LARGURA * (nome?.fracao ?? 0)
  let escalaDoNome = 1

  const uTela = { uTempo, uGrao: { value: reduzir ? 0 : 0.03 } }
  const veu = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1, 1)), guardar(materialPorCima(THREE, VERTICE_TELA, FRAG_TELA, uTela)))
  veu.renderOrder = 6
  veu.frustumCulled = false
  scene.add(veu)

  const olhoNoMundo = new THREE.Vector3()
  /** Onde o olho cai no plano de profundidade `z`, visto da câmera. */
  function projetarOlho(lado: number, z: number, destino: Three.Vector2): void {
    olhoNoMundo.set(lado * OLHO_X_MUNDO, OLHO_Y_MUNDO, 0)
    emblema.localToWorld(olhoNoMundo)
    const c = camera.position
    const f = (z - c.z) / (olhoNoMundo.z - c.z)
    destino.set(c.x + (olhoNoMundo.x - c.x) * f, c.y + (olhoNoMundo.y - c.y) * f)
  }

  function atualizar(tBruto: number) {
    const t = Math.min(T.duracao, Math.max(0, tBruto))
    uTempo.value = reduzir ? 2.2 : t
    uLuz.value = luzDaCena(t, reduzir)
    uFumaca.value = (0.7 + 0.3 * easeOutCubic(span(t, 0, 0.6))) * (1 - 0.75 * easeInOutSine(span(t, T.apagaInicio, T.apagaFim)))

    // A caveira se forma da fumaça e vem de trás.
    const surge = reduzir ? easeInOutSine(span(t, R.surgeInicio, R.surgeFim)) : span(t, T.surgeInicio, T.surgeFim)
    uEmblema.uSurge.value = surge
    uFrente.uAbre.value = surge
    if (reduzir) {
      emblema.position.z = 0
      emblema.scale.setScalar(1)
    } else {
      const chega = easeOutCubic(span(t, T.surgeInicio, T.surgeFim + 0.25))
      emblema.position.z = Z_EMBLEMA_INICIO * (1 - chega)
      emblema.scale.setScalar(0.965 + 0.035 * chega)
    }

    const c = estadoDaCamera(t, reduzir, distancia)
    camera.position.set(c.x, c.y, c.z)
    camera.updateMatrixWorld()
    emblema.updateMatrixWorld()

    // Os olhos.
    const [e, d] = forcaDosOlhos(t, reduzir)
    uOlhos.uForcaE.value = e
    uOlhos.uForcaD.value = d
    uOlhos.uFecha.value = reduzir ? 0 : fechamento(t)
    uOlhos.uFaixa.value = reduzir ? 0.25 : 0.32 + 0.9 * Math.exp(-Math.max(0, t - T.acendeEsquerdo) / 0.18) * (t >= T.acendeEsquerdo ? 1 : 0)
    uEmblema.uOlhoE.value = Math.min(e, 1.4)
    uEmblema.uOlhoD.value = Math.min(d, 1.4)
    const medio = (e + d) / 2
    const espalha = reduzir ? easeInOutSine(span(t, R.acende, R.acendeFim + 0.2)) : easeOutCubic(span(t, T.acendeEsquerdo, T.vazaFim))
    // No acender, uma onda de vermelho corre pela fumaça e assenta no brilho de sempre.
    const onda = reduzir || t < T.acendeEsquerdo ? 0 : 0.7 * Math.exp(-(t - T.acendeEsquerdo) / 0.2) * easeOutCubic(clamp01((t - T.acendeEsquerdo) / 0.06))
    uVaza.value = espalha * Math.min(1.3, medio) + onda
    projetarOlho(-1, Z_FUNDO, uFundo.uVazaE.value)
    projetarOlho(1, Z_FUNDO, uFundo.uVazaD.value)
    projetarOlho(-1, Z_FUMACA_FRENTE, uFrente.uVazaE.value)
    projetarOlho(1, Z_FUMACA_FRENTE, uFrente.uVazaD.value)

    // O nome sai da fumaça embaixo, do borrão para o foco, subindo um pouco; apaga antes dos olhos.
    if (nome) {
      const surgeNome = reduzir ? easeInOutSine(span(t, R.nomeSurge, R.nomeAceso)) : easeOutCubic(span(t, T.nomeSurge, T.nomeNitido))
      uNome.uSurge.value = surgeNome
      uNome.uDesfoque.value = reduzir ? 0 : 3 * (1 - surgeNome)
      uNome.uOlhos.value = Math.min(1.3, medio)
      uNome.uApaga.value = 1 - easeInOutSine(span(t, (reduzir ? R.apagaInicio : T.apagaInicio) - 0.05, (reduzir ? R.apagaFim : T.apagaFim) - 0.1))
      placaDoNome.position.y = NOME_Y - (reduzir ? 0 : 0.05 * (1 - surgeNome))
      placaDoNome.visible = surgeNome > 0.001 && uNome.uApaga.value > 0.001
    }

    return { fade: fadeDaCaveira(t, reduzir) }
  }

  function ajustarTela(novo: number) {
    aspecto = Math.max(0.2, novo)
    const metadeVisivel = TAN_MEIO_FOV * aspecto
    distancia = Math.max(DISTANCIA_BASE, MEIA_LARGURA_DO_EMBLEMA / metadeVisivel)
    camera.aspect = aspecto
    camera.updateProjectionMatrix()
    // O nome cabe em 86% da largura visível na distância dele.
    const larguraVisivel = 2 * NOME_DISTANCIA * metadeVisivel
    escalaDoNome = larguraDoTexto > 0 ? Math.min(1, (0.86 * larguraVisivel) / larguraDoTexto) : 1
    placaDoNome.scale.set(escalaDoNome, escalaDoNome, 1)
  }

  function descartar() {
    for (const coisa of lixo) coisa.dispose()
    lixo.length = 0
  }

  ajustarTela(aspecto)
  atualizar(0)

  return { scene, camera, atualizar, ajustarTela, criarSom: (kit: KitDeSom) => criarSomDaCaveira(kit, reduzir, comNome), descartar }
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

function filtro(ctx: AudioContext, tipo: BiquadFilterType, frequencia: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = tipo
  f.frequency.value = frequencia
  f.Q.value = q
  return f
}

/** Uma enseada de pedra (cauda de 2,4 s) feita de ruído que cai, igual em toda volta. */
function respostaDaEnseada(ctx: AudioContext, segundos: number): AudioBuffer {
  const n = Math.ceil(ctx.sampleRate * segundos)
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let canal = 0; canal < 2; canal++) {
    const rnd = semente(canal === 0 ? 13 : 29)
    const dados = buffer.getChannelData(canal)
    for (let i = 0; i < n; i++) dados[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, 3.4)
  }
  return buffer
}

/** Ruído do kit, começando num ponto qualquer, passando pelos filtros até o ganho. */
function ruidoPor(s: Saida, a: number, duracao: number, inicio: number, filtros: BiquadFilterNode[], ganho: AudioNode) {
  const fonte = s.ctx.createBufferSource()
  fonte.buffer = s.ruido(2)
  fonte.loop = true
  let elo: AudioNode = fonte
  for (const f of filtros) {
    elo.connect(f)
    elo = f
  }
  elo.connect(ganho)
  fonte.start(a, inicio % 2)
  fonte.stop(a + duracao)
}

/** O ronco de baixo: ré grave com um batimento e um trítono por cima, abafado, crescendo no acender. */
function ronco(s: Saida, a: number, acende: number, fim: number, reduzir: boolean) {
  const { ctx } = s
  const passaBaixa = filtro(ctx, 'lowpass', 190, 3)
  const respira = ctx.createOscillator()
  respira.frequency.value = 0.32
  const fundoDoFiltro = ctx.createGain()
  fundoDoFiltro.gain.value = 55
  respira.connect(fundoDoFiltro)
  fundoDoFiltro.connect(passaBaixa.frequency)
  const g = ctx.createGain()
  const alto = reduzir ? 0.15 : 0.2
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(0.1, a + 0.7)
  g.gain.setValueAtTime(0.1, a + acende - 0.05)
  g.gain.exponentialRampToValueAtTime(alto, a + acende + 0.1)
  g.gain.exponentialRampToValueAtTime(0.13, a + acende + 0.9)
  g.gain.setValueAtTime(0.13, fim - 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, fim)
  passaBaixa.connect(g)
  g.connect(s.seco)
  const fontes: OscillatorNode[] = [respira]
  for (const [frequencia, volume] of [
    [36.71, 0.5],
    [36.95, 0.35],
    [55, 0.28],
    [51.91, 0.16],
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
    osc.stop(fim + 0.05)
  }
}

/** O sino de um navio, longe, no nevoeiro: parciais de sino (fora da série harmônica) abafados e com muita enseada. */
function sino(s: Saida, a: number) {
  const { ctx } = s
  const abafa = filtro(ctx, 'lowpass', 1900, 0.6)
  const g = ctx.createGain()
  g.gain.value = 0.07
  abafa.connect(g)
  g.connect(s.seco)
  const longe = ctx.createGain()
  longe.gain.value = 0.22
  abafa.connect(longe)
  longe.connect(s.sala)
  const fundamental = 293.66
  for (const [razao, volume, queda] of [
    [0.5, 0.45, 2.8],
    [1, 1, 2.4],
    [1.183, 0.42, 1.7],
    [1.506, 0.34, 1.35],
    [2, 0.28, 1.05],
    [2.514, 0.16, 0.8],
    [3.011, 0.1, 0.6],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.frequency.value = fundamental * razao
    const v = ctx.createGain()
    envelope(v, a, volume, 0.004, queda)
    osc.connect(v)
    v.connect(abafa)
    osc.start(a)
    osc.stop(a + queda + 0.05)
  }
}

/** O sopro da fumaça enquanto a caveira se forma: ar que abre e fecha, de um lado para o outro. */
function sopro(s: Saida, a: number, duracao: number, volume: number) {
  const { ctx } = s
  const banda = filtro(ctx, 'bandpass', 300, 0.8)
  banda.frequency.setValueAtTime(300, a)
  banda.frequency.exponentialRampToValueAtTime(1100, a + duracao * 0.6)
  banda.frequency.exponentialRampToValueAtTime(480, a + duracao)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(volume, a + duracao * 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, a + duracao)
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(-0.4, a)
  p.pan.linearRampToValueAtTime(0.4, a + duracao)
  g.connect(p)
  p.connect(s.seco)
  p.connect(s.sala)
  ruidoPor(s, a, duracao + 0.05, 0.4, [banda], g)
}

/** A brasa pegando no fundo das órbitas: uns estalinhos agudos e baixos. */
function chiado(s: Saida, a: number) {
  const { ctx } = s
  const rnd = semente(808)
  for (let i = 0; i < 6; i++) {
    const quando = a + i * 0.022 + rnd() * 0.012
    const g = ctx.createGain()
    envelope(g, quando, 0.05 + rnd() * 0.04, 0.001, 0.02)
    const p = ctx.createStereoPanner()
    p.pan.value = (i % 2 === 0 ? -1 : 1) * 0.25
    g.connect(p)
    p.connect(s.seco)
    ruidoPor(s, quando, 0.03, rnd() * 2, [filtro(ctx, 'highpass', 3200, 0.9)], g)
  }
}

/** O acender: um "vum" de fogo que abre, um baque grave e uma segunda menor aguda, fria, que fica na enseada. */
function acende(s: Saida, a: number, forca: number) {
  const { ctx } = s
  const abre = filtro(ctx, 'lowpass', 250, 0.8)
  abre.frequency.setValueAtTime(250, a)
  abre.frequency.exponentialRampToValueAtTime(3200, a + 0.09)
  abre.frequency.exponentialRampToValueAtTime(520, a + 0.7)
  const vum = ctx.createGain()
  envelope(vum, a, 0.5 * forca, 0.03, 0.7)
  vum.connect(s.seco)
  vum.connect(s.sala)
  ruidoPor(s, a, 0.8, 1.2, [abre], vum)

  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(85, a)
  osc.frequency.exponentialRampToValueAtTime(32, a + 0.4)
  const baque = ctx.createGain()
  envelope(baque, a, 0.6 * forca, 0.005, 0.55)
  osc.connect(baque)
  baque.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.65)

  for (const [frequencia, volume, atraso] of [
    [739.99, 0.045, 0],
    [783.99, 0.04, 0.05],
    [369.99, 0.035, 0],
  ] as const) {
    const nota = ctx.createOscillator()
    nota.frequency.value = frequencia
    const v = ctx.createGain()
    envelope(v, a + atraso, volume * forca, 0.012, 1.4)
    const p = ctx.createStereoPanner()
    p.pan.value = atraso > 0 ? 0.3 : -0.2
    nota.connect(v)
    v.connect(p)
    p.connect(s.seco)
    p.connect(s.sala)
    nota.start(a + atraso)
    nota.stop(a + atraso + 1.45)
  }
}

/** Um pulso: duas batidas graves e abafadas, a segunda mais fraca (tum-tum). */
function batimento(s: Saida, a: number, volume: number) {
  const { ctx } = s
  const abafa = filtro(ctx, 'lowpass', 220, 0.7)
  abafa.connect(s.seco)
  for (const [atraso, forca] of [
    [0, 1],
    [0.17, 0.6],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(62, a + atraso)
    osc.frequency.exponentialRampToValueAtTime(40, a + atraso + 0.18)
    const g = ctx.createGain()
    envelope(g, a + atraso, volume * forca, 0.006, 0.32)
    osc.connect(g)
    g.connect(abafa)
    osc.start(a + atraso)
    osc.stop(a + atraso + 0.4)
  }
}

/** O nome saindo da fumaça: um chiado macio. */
function chiadoDoNome(s: Saida, a: number) {
  const { ctx } = s
  const g = ctx.createGain()
  envelope(g, a, 0.06, 0.15, 0.35)
  g.connect(s.seco)
  g.connect(s.sala)
  ruidoPor(s, a, 0.55, 0.8, [filtro(ctx, 'bandpass', 1800, 0.7)], g)
}

/** Os olhos se fechando: um suspiro grave que cai. */
function suspiro(s: Saida, a: number) {
  const { ctx } = s
  const cai = filtro(ctx, 'lowpass', 900, 0.7)
  cai.frequency.setValueAtTime(900, a)
  cai.frequency.exponentialRampToValueAtTime(160, a + 0.4)
  const g = ctx.createGain()
  envelope(g, a, 0.12, 0.05, 0.42)
  g.connect(s.seco)
  ruidoPor(s, a, 0.5, 1.6, [cai], g)
}

/** Cada pista recebe a hora do áudio que corresponde ao t = 0 da cena. */
type Pista = [nome: string, quando: number, tocar: (base: number) => void]

function criarSomDaCaveira(kitDoMotor: KitDeSom, reduzir: boolean, comNome: boolean) {
  const { ctx } = kitDoMotor
  // Limitador na saída: no acender somam ronco, vum, baque e as notas.
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -10
  limitador.knee.value = 6
  limitador.ratio.value = 12
  limitador.attack.value = 0.003
  limitador.release.value = 0.25
  limitador.connect(kitDoMotor.destino)
  const sala = ctx.createConvolver()
  sala.buffer = respostaDaEnseada(ctx, 2.4)
  const volta = ctx.createGain()
  volta.gain.value = 0.35
  sala.connect(volta)
  volta.connect(limitador)
  const s: Saida = { ctx, seco: limitador, sala, ruido: kitDoMotor.ruido }
  const todas: Pista[] = reduzir
    ? [
        ['ronco', 0, (base) => ronco(s, base, R.acende, base + T.duracao, true)],
        ['sino', 0.18, (base) => sino(s, base + 0.18)],
        ['sopro', R.surgeInicio, (base) => sopro(s, base + R.surgeInicio, R.surgeFim - R.surgeInicio + 0.1, 0.09)],
        ['acende', R.acende, (base) => acende(s, base + R.acende, 0.55)],
        ['nome', R.nomeSurge, (base) => chiadoDoNome(s, base + R.nomeSurge)],
        ['fecha', R.apagaInicio + 0.2, (base) => suspiro(s, base + R.apagaInicio + 0.2)],
      ]
    : [
        ['ronco', 0, (base) => ronco(s, base, T.acendeEsquerdo, base + T.duracao, false)],
        ['sino', 0.18, (base) => sino(s, base + 0.18)],
        ['sopro', T.surgeInicio - 0.04, (base) => sopro(s, base + T.surgeInicio - 0.04, T.surgeFim - T.surgeInicio + 0.15, 0.14)],
        ['chiado', T.brasa + 0.06, (base) => chiado(s, base + T.brasa + 0.06)],
        ['acende', T.acendeEsquerdo, (base) => acende(s, base + T.acendeEsquerdo, 1)],
        ['pulso1', T.pulsos[0] - 0.05, (base) => batimento(s, base + T.pulsos[0] - 0.05, 0.42)],
        ['pulso2', T.pulsos[1] - 0.05, (base) => batimento(s, base + T.pulsos[1] - 0.05, 0.36)],
        ['nome', T.nomeSurge, (base) => chiadoDoNome(s, base + T.nomeSurge)],
        ['fecha', T.fechaInicio, (base) => suspiro(s, base + T.fechaInicio)],
      ]
  const pistas = comNome ? todas : todas.filter(([nome]) => nome !== 'nome')
  const tocadas = new Set<string>()
  return {
    atualizar(t: number) {
      for (const [nome, quando, tocar] of pistas) {
        if (t >= quando && !tocadas.has(nome)) {
          tocadas.add(nome)
          // A hora do t = 0 da cena, vista do relógio do áudio.
          tocar(ctx.currentTime - quando)
        }
      }
    },
    reiniciar: () => tocadas.clear(),
  }
}

const criar: CriarCena = criarCenaCaveiraPirata
export default criar

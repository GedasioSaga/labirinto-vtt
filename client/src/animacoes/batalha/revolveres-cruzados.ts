import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'
import { clamp01, easeInOutSine, easeInQuad, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Revólveres cruzados: a quarta abertura de batalha (pedido de 29/10/2026,
 * "esse revolver se cruzando com esse revolver e atirando"; protótipo em
 * docs/design/transicao-batalha-revolveres-cruzados/). Esta pasta espelha
 * `client/src`: o arquivo entra como está em `client/src/animacoes/batalha/`.
 *
 * Duas armas de desenho próprio, uma contra a outra: uma pistola de fantasia
 * de dois canos, laca roxa com ouro rosa, uma rosa gravada no cabo e uma
 * corrente com pingente; e um revólver de aço gasto, cano comprido, tambor de
 * seis e cabo de madeira quadriculada. É um duelo: as duas saem do coldre, de
 * baixo, cada uma do seu lado, e sobem girando até os canos baterem em X (um
 * tranco de metal). Pausa; o aço engatilha (o cão volta e o tambor gira uma
 * câmara), depois a roxa. O som some, e as duas atiram: o aço primeiro, a roxa
 * com os dois canos 70 ms depois. Clarão nas bocas, coice, faíscas e fumaça
 * de pólvora. Um rastro de pólvora acende do meio para as pontas e revela o
 * nome; a fumaça toma a tela e o motor fecha em preto, de onde entra o mapa.
 *
 * Contrato: o mesmo `CriarCena` das transições (`src/transicoes/tipos.ts`),
 * com o `nome` opcional das aberturas. Nome ausente, vazio ou só espaço = sem
 * nome: o X desce para o meio da tela e a pista de som do nome fica fora.
 *
 * Tudo é `ShaderMaterial` sem conversão de cor na saída, sem luz na cena e sem
 * imagem externa: as armas, o cão de cada uma, a corrente, a fumaça e o nome
 * são pintados em canvas na montagem; o brilho que corre, a luz dos tiros, as
 * caneluras do tambor girando, o calor do cano e a névoa são contas no shader.
 */

export const NOME_MAX_LETRAS = 24

/** Roteiro em segundos (movimento completo, tela 16:9). */
export const ROTEIRO_DOS_REVOLVERES = {
  duracao: 3.8,
  fadeInFim: 0.14,
  /** As duas armas sobem de baixo, cada uma do seu lado, e param de pé, com o cano para cima. */
  saqueInicio: 0.18,
  pronto: 0.5,
  /** Tomam impulso para trás e descem com força, uma contra a outra: os canos se cruzam. */
  golpe: 0.62,
  /** Os canos se encontram em X: o tranco de metal. */
  tranco: 0.78,
  /** O cão do aço vai para trás e o tambor gira uma câmara. */
  engatilhaAco: 1.04,
  giroInicio: 1.06,
  giroFim: 1.17,
  /** O cão da roxa. */
  engatilhaRoxa: 1.2,
  /** A respiração presa: o som de fundo some antes do tiro. */
  silencio: 1.3,
  tiroAco: 1.46,
  /** A roxa dispara os dois canos juntos, 70 ms depois do aço. */
  tiroRoxa: 1.53,
  /** O rastro de pólvora acende do meio para as pontas e revela o nome. */
  nomeAcende: 1.86,
  nomeFim: 2.24,
  /** Um reflexo corre pelas armas e depois pelo nome. */
  brilhoArmas: 2.4,
  brilhoNome: 2.72,
  /** A fumaça dos tiros toma a tela enquanto a luz cai. */
  fumacaInicio: 2.95,
  fumacaFim: 3.6,
  apagaInicio: 3.22,
  apagaFim: 3.62,
  fadeOutInicio: 3.58,
} as const

/** Com movimento reduzido: as armas surgem já cruzadas, sem saque, coice, tremor, faíscas nem câmera; o clarão é só luz. */
export const ROTEIRO_REDUZIDO = {
  surgeInicio: 0.12,
  surgeFim: 0.7,
  tranco: 0.62,
  engatilhaAco: 1.0,
  giroInicio: 1.02,
  giroFim: 1.13,
  engatilhaRoxa: 1.16,
  tiroAco: 1.42,
  tiroRoxa: 1.5,
  nomeSurge: 1.9,
  nomeAceso: 2.35,
  apagaInicio: 3.1,
  apagaFim: 3.5,
  fadeOutInicio: 3.45,
} as const

export interface OpcoesDosRevolveres extends OpcoesDaCena {
  /** O nome que o rastro de pólvora revela (grupo, inimigo). Ausente ou vazio = sem nome. */
  nome?: string
}

/** Espaços juntados, até 24 letras (sem partir emoji ao meio); `''` = sem nome. */
export function nomeDaBatalha(nome: string | undefined): string {
  const limpo = (nome ?? '').replace(/\s+/g, ' ').trim()
  return Array.from(limpo).slice(0, NOME_MAX_LETRAS).join('')
}

// ── Medidas ──────────────────────────────────────────────────────────────────

type Ponto = readonly [number, number]

const FOV = 34
const TAN_MEIO_FOV = Math.tan((FOV * Math.PI) / 360)
const DISTANCIA_BASE = 6.6
/** O quanto cada cano sobe da horizontal no X (34°). */
const ANGULO_CRUZADO = 0.6
/** As armas são desenhadas em "unidades da arma" (origem na mão, cano para a direita); no mundo valem isto. */
const ESCALA = 0.86
/** Quanto da tela o X ocupa: de largura, e de altura com e sem nome (a câmera se afasta até caber). */
const X_NA_LARGURA = 0.86
const X_NA_ALTURA_COM_NOME = 0.7
const X_NA_ALTURA_SEM_NOME = 0.88
/** Onde fica o meio do X na altura da tela (NDC): com nome ele sobe para o nome caber embaixo. */
const X_NDC_COM_NOME = 0.22
/** O nome, na altura da tela (NDC). */
const NOME_NDC = -0.67

/** O desenho de cada arma: 540 px por unidade, a mão (origem) neste pixel. */
const ARMA_LARGURA_PX = 2048
const ARMA_ALTURA_PX = 1024
const PX = 540
const ORIGEM_X_PX = 525
const ORIGEM_Y_PX = 478
const MASCARA_FATOR = 0.5
/** O cão é uma peça à parte (gira no pino); o pino cai neste pixel do quadrado dele. */
const CAO_PX = 384
const CAO_ORIGEM_PX = 240
/** Corrente e pingente da roxa: penduradas no anel do cabo, pelo alto. */
const CORRENTE_LARGURA_PX = 128
const CORRENTE_ALTURA_PX = 300
const PINGENTE_LARGURA_PX = 128
const PINGENTE_ALTURA_PX = 176
const PECA_ORIGEM_Y_PX = 14
const ELOS = 7
const PASSO_DO_ELO = 0.057
const COMPRIMENTO_DA_CORRENTE = ELOS * PASSO_DO_ELO
const QUEDA_DO_PINGENTE = COMPRIMENTO_DA_CORRENTE + 0.17

const Z_FUNDO = -2.2
const Z_FAISCAS = 0.25
const Z_FUMACA = 0.15
const Z_FUMACA_FRENTE = 0.9

const NOME_LARGURA_PX = 2048
const NOME_ALTURA_PX = 512
const NOME_FONTE_MAX_PX = 230
const NOME_LARGURA_UTIL_PX = 1600
/** O nome fica diante da câmera (título), embaixo do X. */
const NOME_DISTANCIA = 4
const NOME_LARGURA = 3.5
/** A fonte de título do app (`--lb-font-display`). */
const FONTE_DO_NOME = "'Sitka Banner', 'Sitka Display', Constantia, Georgia, 'Times New Roman', serif"

interface Arma {
  /** 1 = como foi desenhada (cano para a direita); -1 = espelhada. */
  espelho: 1 | -1
  /** O lado da tela de onde ela sai (-1 = esquerda). */
  lado: 1 | -1
  /** O ponto do eixo do cano que cruza o outro cano. */
  cruza: Ponto
  /** A boca de cada cano e o meio delas. */
  bocas: readonly Ponto[]
  boca: Ponto
  pinoDoCao: Ponto
  /** Quanto o cão gira para trás ao engatilhar (rad). */
  caoArmado: number
  /** O coice: o recuo ao longo do cano (mundo) e o quanto a boca sobe (rad). */
  recuo: number
  subida: number
  z: number
  /** Pontos da borda do desenho (para enquadrar o X). */
  contorno: readonly Ponto[]
}

/** A pistola roxa, à esquerda, cano para a direita; fica na frente. */
const ROXA: Arma = {
  espelho: 1,
  lado: -1,
  cruza: [1.18, 0.4175],
  bocas: [
    [2.125, 0.5],
    [2.125, 0.335],
  ],
  boca: [2.125, 0.4175],
  pinoDoCao: [-0.36, 0.5],
  caoArmado: 0.62,
  recuo: 0.17,
  subida: 0.25,
  z: 0.05,
  contorno: [
    [2.125, 0.6],
    [2.125, 0.24],
    [-0.64, 0.8],
    [-0.84, -0.72],
    [-0.62, -0.87],
    [0.07, -0.3],
  ],
}

/** O revólver de aço, à direita: o mesmo desenho espelhado, cano para a esquerda; fica atrás. */
const ACO: Arma = {
  espelho: -1,
  lado: 1,
  cruza: [1.36, 0.44],
  bocas: [[2.285, 0.44]],
  boca: [2.285, 0.44],
  pinoDoCao: [-0.46, 0.47],
  caoArmado: 0.55,
  recuo: 0.15,
  subida: 0.21,
  z: -0.05,
  contorno: [
    [2.235, 0.64],
    [2.285, 0.36],
    [-0.86, 0.82],
    [-0.79, -0.9],
    [-0.5, -1.02],
    [0.08, -0.34],
  ],
}

const ANEL_DA_ROXA: Ponto = [-0.64, -0.875]
/** A fresta entre o tambor e o cano do aço: no tiro escapa um leque de fogo ali. */
const FRESTA_DO_ACO: Ponto = [0.484, 0.44]
/** Os dois canos da roxa vistos como uma faixa só (a sombra que ela faz no aço). */
const CANOS_DA_ROXA = { inicio: 0.5, fim: 2.125, eixo: 0.4175, raio: 0.165 }

const N_FAISCAS_TRANCO = 30
const N_FAISCAS_ACO = 34
const N_FAISCAS_FRESTA = 10
const N_FAISCAS_ROXA = 40

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

/** As três luzes que acendem a cena: o tranco, o tiro do aço e o tiro da roxa (xy = posição, z = força). */
const GLSL_LUZES = /* glsl */ `
uniform vec3 uLuzes[3];
uniform vec3 uCoresDasLuzes[3];
vec3 luzDosTiros(vec2 p, float queda) {
  vec3 luz = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec2 d = p - uLuzes[i].xy;
    luz += uCoresDasLuzes[i] * (uLuzes[i].z / (1.0 + dot(d, d) * queda));
  }
  return luz;
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

const VERTICE_ARMA = /* glsl */ `
varying vec2 vUv;
varying vec2 vMundo;
void main() {
  vUv = uv;
  vec4 m = modelMatrix * vec4(position, 1.0);
  vMundo = m.xy;
  gl_Position = projectionMatrix * viewMatrix * m;
}`

const VERTICE_RISCO = /* glsl */ `
attribute vec3 cor;
varying vec2 vUv;
varying vec3 vCor;
void main() {
  vUv = uv;
  vCor = cor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const VERTICE_NUVEM = /* glsl */ `
attribute vec4 cor;
varying vec2 vUv;
varying vec4 vCor;
void main() {
  vUv = uv;
  vCor = cor;
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
 * O fundo: fim de tarde de duelo, quase preto, com um poço de luz quente e
 * baixa atrás do X, poeira que corre devagar rente ao chão e ciscos de pó no
 * ar. Os tiros acendem a poeira em volta das bocas.
 */
const FRAG_FUNDO = /* glsl */ `
${GLSL_RUIDO}
${GLSL_LUZES}
uniform float uTempo;
uniform float uLuz;
uniform vec2 uCentro;
varying vec3 vPos;
void main() {
  vec2 p = vPos.xy - uCentro;
  // O horizonte do fim de tarde: brasa baixa no céu, a silhueta de mesas ao longe e o chão escuro.
  float hor = -1.25;
  float crista = hor + 0.05 + 0.3 * smoothstep(0.38, 0.72, fbm3(vec2(p.x * 0.3 + 3.1, 1.7))) + 0.04 * ruido(vec2(p.x * 2.1, 0.5));
  float acima = p.y - hor;
  vec3 ceu = mix(vec3(0.2, 0.088, 0.04), vec3(0.02, 0.015, 0.019), smoothstep(0.0, 2.8, acima));
  ceu += vec3(0.15, 0.065, 0.02) * exp(-pow(acima / 0.5, 2.0));
  vec2 sol = p - vec2(0.0, hor + 0.5);
  ceu += vec3(0.08, 0.035, 0.012) * exp(-dot(sol, sol) / 3.5);
  vec3 serra = vec3(0.038, 0.022, 0.019);
  vec3 chao = mix(vec3(0.062, 0.036, 0.024), vec3(0.011, 0.008, 0.008), smoothstep(0.0, 2.2, -acima));
  vec3 cor = mix(ceu, serra, smoothstep(crista + 0.012, crista - 0.012, p.y));
  cor = mix(cor, chao, smoothstep(hor + 0.012, hor - 0.012, p.y));
  vec2 q = p * vec2(0.3, 0.8) + vec2(uTempo * 0.07, 0.0);
  float w = ruido(q * 1.6 + vec2(0.0, uTempo * 0.05));
  float n = fbm3(q + vec2(0.8 * w, 0.3 * w));
  float baixo = smoothstep(0.9, -2.2, acima);
  float poeira = smoothstep(0.42, 0.86, n) * (0.28 + 0.72 * baixo);
  cor = mix(cor, vec3(0.15, 0.1, 0.074), poeira * 0.5);
  vec2 gp = (p + vec2(uTempo * 0.09, -uTempo * 0.025)) / 0.21;
  vec2 cel = floor(gp);
  vec2 f = fract(gp) - 0.5;
  float h = hash(cel);
  vec2 o = vec2(hash(cel + 7.13), hash(cel + 3.71)) - 0.5;
  float cisco = step(0.88, h) * smoothstep(0.06, 0.0, length(f - 0.7 * o)) * (0.55 + 0.45 * sin(uTempo * 2.7 + h * 50.0));
  cor += vec3(0.55, 0.4, 0.27) * cisco * 0.2;
  cor *= uLuz;
  cor += luzDosTiros(p, 1.2) * (0.04 + 0.32 * poeira + 0.7 * cisco);
  gl_FragColor = vec4(cor, 1.0);
}`

/**
 * Uma arma pintada. A máscara diz o que é metal polido (R), ouro rosa (G) e o
 * tambor (B). Por cima da pintura: um reflexo que corre (no mundo, então o
 * cano gira através dele), a luz dos tiros e do tranco, o calor da boca depois
 * do tiro e a sombra que a arma da frente faz nesta. No aço, as caneluras do
 * tambor são contas (giram quando ele engatilha) e o aço tem um grão fino; na
 * laca roxa, flocos que só aparecem no reflexo.
 */
const FRAG_ARMA = /* glsl */ `
${GLSL_RUIDO}
${GLSL_LUZES}
uniform sampler2D uCor;
uniform sampler2D uMascara;
uniform float uOpacidade;
uniform float uLuz;
uniform float uBrilho;
uniform float uForcaDoBrilho;
uniform vec2 uDirecaoDoBrilho;
uniform vec3 uCorDoBrilho;
uniform vec2 uBoca;
uniform float uQuente;
uniform vec3 uCorQuente;
uniform vec4 uSombraLinha;
uniform vec2 uSombraTrecho;
uniform float uSombraRaio;
uniform float uSombra;
#ifdef ACO
uniform float uGiro;
uniform vec4 uTambor;
#endif
varying vec2 vUv;
varying vec2 vMundo;
void main() {
  vec4 c = texture2D(uCor, vUv);
  if (c.a < 0.004) discard;
  vec3 m = texture2D(uMascara, vUv).rgb;
  vec3 cor = c.rgb;
  float lum = dot(cor, vec3(0.299, 0.587, 0.114));
#ifdef ACO
  if (m.b > 0.5) {
    float meio = (uTambor.y + uTambor.w) * 0.5;
    float v = clamp((vUv.y - meio) / ((uTambor.w - uTambor.y) * 0.5), -0.995, 0.995);
    float u = (vUv.x - uTambor.x) / (uTambor.z - uTambor.x);
    float a = asin(v) + uGiro;
    float k = cos(6.0 * a);
    float aoLongo = smoothstep(0.09, 0.16, u) * smoothstep(0.86, 0.78, u);
    float face = sqrt(1.0 - v * v);
    float canal = smoothstep(0.45, 0.85, k) * aoLongo;
    float labio = smoothstep(0.12, 0.42, k) * (1.0 - smoothstep(0.42, 0.75, k)) * aoLongo;
    cor *= 1.0 - 0.55 * canal * face;
    cor += vec3(0.3, 0.31, 0.32) * labio * step(sin(6.0 * a), 0.0) * face;
  }
  float grao = ruido(vUv * vec2(1100.0, 550.0)) - 0.5;
  cor *= 1.0 + 0.12 * grao * m.r;
#else
  float floco = step(0.992, hash(floor(vUv * vec2(1400.0, 700.0))));
#endif
  cor *= uLuz;
  float b = (dot(vMundo, uDirecaoDoBrilho) - uBrilho) / 0.2;
  float brilho = exp(-b * b) * uForcaDoBrilho * m.r * smoothstep(0.12, 0.6, lum);
  cor += uCorDoBrilho * brilho * 0.55;
#ifndef ACO
  cor += vec3(1.0, 0.9, 1.0) * floco * brilho * 1.6 * (1.0 - m.g);
#endif
  vec3 luz = luzDosTiros(vMundo, 2.4);
  cor += luz * (0.45 * c.rgb + 0.55 * m.r * smoothstep(0.1, 0.65, lum));
  vec2 dq = (vUv - uBoca) * vec2(2.0, 1.0);
  cor += uCorQuente * uQuente * exp(-dot(dq, dq) / 0.0016) * (0.35 + 0.65 * m.r);
  if (uSombra > 0.0) {
    vec2 rel = vMundo + vec2(0.0, 0.05) - uSombraLinha.xy;
    float s = clamp(dot(rel, uSombraLinha.zw), uSombraTrecho.x, uSombraTrecho.y);
    float dist = length(rel - uSombraLinha.zw * s);
    cor *= 1.0 - uSombra * 0.6 * smoothstep(uSombraRaio + 0.09, uSombraRaio - 0.01, dist);
  }
  float alfa = c.a * uOpacidade;
  gl_FragColor = vec4(cor * alfa, alfa);
}`

/** O rastro do saque: uma cópia apagada da arma alguns milissegundos atrás. */
const FRAG_RASTRO = /* glsl */ `
uniform sampler2D uCor;
uniform float uOpacidade;
uniform float uLuz;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uCor, vUv);
  float a = c.a * uOpacidade;
  gl_FragColor = vec4(c.rgb * uLuz * a, a);
}`

/** Faísca alongada: cauda que some, cabeça quente (soma de luz). */
const FRAG_RISCO = /* glsl */ `
varying vec2 vUv;
varying vec3 vCor;
void main() {
  float a = (vUv.y - 0.5) / 0.25;
  float atraves = exp(-a * a);
  float aoLongo = smoothstep(0.0, 1.0, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x) * 0.5);
  gl_FragColor = vec4(vCor * atraves * aoLongo, 0.0);
}`

/** Um tufo de fumaça do atlas (quatro desenhos), já com a cor e o alfa do quadro. */
const FRAG_NUVEM = /* glsl */ `
uniform sampler2D uFumaca;
varying vec2 vUv;
varying vec4 vCor;
void main() {
  float d = texture2D(uFumaca, vUv).a;
  float a = d * vCor.a;
  gl_FragColor = vec4(vCor.rgb * a, a);
}`

/**
 * O clarão de boca (soma de luz), no sentido do cano: miolo branco, o cone de
 * fogo que se rasga em línguas, os jatos curtos de lado (a cruz do sopro) e um
 * nó de luz à frente. A roxa tem dois miolos, um por cano.
 */
const FRAG_CLARAO = /* glsl */ `
${GLSL_RUIDO}
uniform float uForca;
uniform float uFase;
uniform float uSemente;
uniform float uSeparacao;
uniform vec3 uMiolo;
uniform vec3 uMeio;
uniform vec3 uBorda;
varying vec2 vLocal;
vec3 boca(vec2 p) {
  float x = p.x;
  float xf = max(x, 0.0);
  // A estrela de cinco pontas na boca (gira a cada quadro, pela semente).
  float r = length(p - vec2(0.02, 0.0));
  float ang = atan(p.y, p.x - 0.02);
  float petalas = pow(abs(cos(ang * 2.5 + uSemente * 1.7)), 5.0);
  float estrela = exp(-r / (0.035 + 0.3 * petalas * (1.0 - 0.6 * uFase))) * (1.0 - 0.7 * uFase);
  vec2 q = vec2((x - 0.08) / 0.22, p.y / 0.09);
  float miolo = exp(-dot(q, q));
  float alcance = mix(0.6, 1.2, uFase);
  float largura = 0.06 + 0.42 * xf;
  float k = p.y / largura;
  float n = fbm3(vec2(xf * 4.5 - uSemente * 4.0, p.y * 6.0 + uSemente * 7.0));
  float cone = exp(-k * k) * smoothstep(-0.02, 0.06, x) * exp(-xf / (alcance * 0.5));
  cone *= smoothstep(0.2, 0.7, n + 0.5 - xf * 0.45);
  float lado = exp(-pow((x - 0.03) / 0.06, 2.0)) * exp(-abs(p.y) / (0.13 + 0.14 * uFase)) * smoothstep(0.02, 0.07, abs(p.y));
  lado *= 0.6 + 0.8 * n;
  vec2 dq = vec2((x - alcance * 0.5) / 0.1, p.y / 0.05);
  float no = exp(-dot(dq, dq)) * (1.0 - uFase);
  return uMiolo * (miolo * 1.6 + no * 0.8 + estrela * 1.2) + uMeio * (cone * 1.3 + lado * 0.8 + estrela * 0.6) + uBorda * (cone * 0.55 + lado * 0.5);
}
void main() {
  vec3 cor = uSeparacao > 0.0 ? boca(vLocal - vec2(0.0, uSeparacao * 0.5)) + 0.9 * boca(vLocal + vec2(0.0, uSeparacao * 0.5)) : boca(vLocal);
  gl_FragColor = vec4(cor * uForca, 0.0);
}`

/** A luz no ar em volta da boca (soma): um miolo e um véu largo. */
const FRAG_HALO = /* glsl */ `
uniform float uForca;
uniform vec3 uCor;
varying vec2 vLocal;
void main() {
  float r2 = dot(vLocal, vLocal);
  gl_FragColor = vec4(uCor * (exp(-r2 / 0.08) * 0.85 + exp(-r2 / 0.9) * 0.32) * uForca, 0.0);
}`

/** O leque de fogo que escapa na fresta do tambor do aço, de través. */
const FRAG_LEQUE = /* glsl */ `
uniform float uForca;
uniform vec3 uCor;
varying vec2 vLocal;
void main() {
  float x = vLocal.x;
  float y = vLocal.y;
  float leque = exp(-pow(x / (0.018 + 0.14 * abs(y)), 2.0)) * exp(-abs(y) / 0.11) * smoothstep(0.01, 0.04, abs(y));
  float miolo = exp(-(x * x + y * y) / 0.0012);
  gl_FragColor = vec4(uCor * (leque * 1.2 + miolo) * uForca, 0.0);
}`

/** O tranco: um brilho de metal com dois raios que correm pelos dois canos. */
const FRAG_FAGULHA = /* glsl */ `
uniform float uForca;
uniform float uAngulo;
uniform vec3 uCor;
varying vec2 vLocal;
void main() {
  vec2 p = vLocal;
  vec2 a = vec2(cos(uAngulo), sin(uAngulo));
  vec2 b = vec2(cos(uAngulo), -sin(uAngulo));
  float ra = exp(-abs(dot(p, vec2(-a.y, a.x))) / 0.006) * exp(-abs(dot(p, a)) / 0.22);
  float rb = exp(-abs(dot(p, vec2(-b.y, b.x))) / 0.006) * exp(-abs(dot(p, b)) / 0.22);
  float miolo = exp(-dot(p, p) / 0.004);
  gl_FragColor = vec4(uCor * (ra + rb + miolo * 1.5) * uForca, 0.0);
}`

/** No fim, a fumaça dos tiros toma a tela: densa nas bordas primeiro, o meio por último. */
const FRAG_FUMACA_FRENTE = /* glsl */ `
${GLSL_RUIDO}
uniform float uTempo;
uniform float uLuz;
uniform float uDensidade;
uniform vec2 uCentro;
varying vec3 vPos;
void main() {
  if (uDensidade <= 0.0) discard;
  vec2 p = vPos.xy;
  vec2 q = p * 0.55 + vec2(uTempo * 0.12, -uTempo * 0.08);
  float w = ruido(q * 0.9 + 3.0);
  float n = fbm3(q + vec2(1.2 * w, -0.5 * w));
  vec2 c = (p - uCentro) / vec2(2.6, 1.7);
  float borda = smoothstep(0.0, 1.0, length(c));
  float d = smoothstep(0.7 - 0.8 * uDensidade, 1.05 - 0.6 * uDensidade, n + 0.3 * borda) * uDensidade;
  vec3 cor = mix(vec3(0.14, 0.12, 0.105), vec3(0.4, 0.35, 0.3), smoothstep(0.45, 1.0, n)) * (0.3 + 0.7 * uLuz);
  float a = clamp(d * 1.15, 0.0, 0.97);
  gl_FragColor = vec4(cor * a, a);
}`

/**
 * O nome em ouro rosa. Um rastro de pólvora corre pela régua embaixo, do meio
 * para as duas pontas; as letras acendem em brasa quando a faísca passa e
 * esfriam até o metal. Depois, um reflexo atravessa as letras.
 */
const FRAG_NOME = /* glsl */ `
${GLSL_RUIDO}
uniform sampler2D uMapa;
uniform float uFrente;
uniform float uMeia;
uniform float uRegua;
uniform float uApaga;
uniform float uLimpo;
uniform float uBrilho;
uniform float uTempo;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMapa, vUv);
  float d = abs(vUv.x - 0.5) / max(uMeia, 0.001);
  float atras = uFrente - d;
  float revela = mix(smoothstep(0.0, 0.03, atras), 1.0, uLimpo);
  float halo = mix(smoothstep(-0.3, 0.05, atras), 1.0, uLimpo);
  float face = smoothstep(0.22, 0.55, dot(c.rgb, vec3(0.333)));
  float tras = max(atras, 0.0);
  float calor = exp(-tras / 0.2) * revela * (1.0 - uLimpo);
  vec3 quente = mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.93, 0.78), exp(-tras / 0.045));
  vec3 cor = c.rgb + quente * calor * face * 1.1;
  float s = (vUv.x - 0.5) / max(uMeia, 0.001) * 0.5 + 0.5 + (vUv.y - 0.5) * 0.3;
  float b = (s - uBrilho) / 0.06;
  cor += vec3(1.0, 0.92, 0.86) * exp(-b * b) * face * 0.5;
  float a = c.a * mix(halo, revela, face) * uApaga;
  float faisca = 0.0;
  if (uLimpo < 0.5 && uFrente > 0.0 && uFrente < 1.1) {
    float dx = (d - uFrente) * uMeia / 0.0045;
    float dy = (vUv.y - uRegua) / 0.02;
    faisca = exp(-(dx * dx + dy * dy)) * (0.7 + 0.3 * ruido(vec2(uTempo * 70.0, d * 30.0)));
  }
  gl_FragColor = vec4(cor * a + vec3(1.0, 0.85, 0.55) * faisca * 1.8 * uApaga, a);
}`

/** Por cima de tudo: vinheta, um grão fino e o clarão quente de cada tiro na tela inteira. */
const FRAG_TELA = /* glsl */ `
uniform float uTempo;
uniform float uGrao;
uniform vec3 uClarao;
varying vec2 vNdc;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float vinheta = smoothstep(0.45, 1.5, length(vNdc * vec2(0.9, 1.0))) * 0.62;
  float g = hash(floor(gl_FragCoord.xy * 0.5) + vec2(floor(uTempo * 24.0) * 17.0, 3.0)) - 0.5;
  float escuro = max(-g, 0.0) * uGrao * 2.0;
  vec3 claro = vec3(max(g, 0.0) * uGrao) + uClarao * (1.0 - 0.5 * vinheta);
  gl_FragColor = vec4(claro, clamp(vinheta + escuro, 0.0, 1.0));
}`

// ── Pintura: utilidades ──────────────────────────────────────────────────────

type Paradas = readonly (readonly [number, string])[]

const CONTORNO_ACO = '#0c0d0f'
const CONTORNO_ROXA = '#12071a'
const ESPESSURA = 0.011

const ACO_TUBO: Paradas = [
  [0, '#26292c'],
  [0.09, '#6c7074'],
  [0.19, '#c3c6c9'],
  [0.26, '#e6e8ea'],
  [0.35, '#8a8e92'],
  [0.55, '#4a4d51'],
  [0.77, '#25272a'],
  [0.9, '#3a3d40'],
  [1, '#121315'],
]
const ACO_CHAPA: Paradas = [
  [0, '#8d9195'],
  [0.07, '#62666a'],
  [0.45, '#4b4f53'],
  [1, '#2a2d30'],
]
const ACO_ESCURO: Paradas = [
  [0, '#5a5e62'],
  [0.3, '#3b3e42'],
  [1, '#1b1d1f'],
]
const LACA_TUBO: Paradas = [
  [0, '#1a0926'],
  [0.09, '#4e2878'],
  [0.18, '#b48ee6'],
  [0.245, '#f3e9ff'],
  [0.32, '#7a4ab0'],
  [0.52, '#3b1a5c'],
  [0.78, '#1c0a2d'],
  [0.9, '#3a1d57'],
  [1, '#0e0517'],
]
const LACA_CHAPA: Paradas = [
  [0, '#8a5cc0'],
  [0.1, '#5a3290'],
  [0.5, '#3a1a5c'],
  [1, '#1c0a2e'],
]
const OURO_TUBO: Paradas = [
  [0, '#4d261c'],
  [0.12, '#b77764'],
  [0.22, '#f2c6b1'],
  [0.28, '#fff1e8'],
  [0.38, '#cb8a74'],
  [0.6, '#8c4d3c'],
  [0.85, '#5b2e23'],
  [1, '#331812'],
]
const OURO_CHAPA: Paradas = [
  [0, '#f8d3c0'],
  [0.3, '#d6977f'],
  [0.7, '#9a5946'],
  [1, '#5e3125'],
]
const OURO = '#d4917a'

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const g = canvas.getContext('2d')
  if (!g) throw new Error('revólveres cruzados: sem canvas 2D')
  return [canvas, g]
}

/** Põe o contexto em unidades da arma: origem na mão, y para cima. */
function emUnidades(g: CanvasRenderingContext2D, fator: number, origemX = ORIGEM_X_PX, origemY = ORIGEM_Y_PX): void {
  g.setTransform(PX * fator, 0, 0, -PX * fator, origemX * fator, origemY * fator)
}

function degrade(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, paradas: Paradas): CanvasGradient {
  const grd = g.createLinearGradient(x0, y0, x1, y1)
  for (const [p, c] of paradas) grd.addColorStop(p, c)
  return grd
}

/** Degradê de cima para baixo (de `topo` até `pe`, em unidades). */
const vertical = (g: CanvasRenderingContext2D, topo: number, pe: number, paradas: Paradas) => degrade(g, 0, topo, 0, pe, paradas)

function retangulo(x0: number, y0: number, x1: number, y1: number, raio = 0): Path2D {
  const p = new Path2D()
  const r = Math.min(raio, (x1 - x0) / 2, (y1 - y0) / 2)
  p.moveTo(x0 + r, y0)
  p.lineTo(x1 - r, y0)
  p.quadraticCurveTo(x1, y0, x1, y0 + r)
  p.lineTo(x1, y1 - r)
  p.quadraticCurveTo(x1, y1, x1 - r, y1)
  p.lineTo(x0 + r, y1)
  p.quadraticCurveTo(x0, y1, x0, y1 - r)
  p.lineTo(x0, y0 + r)
  p.quadraticCurveTo(x0, y0, x0 + r, y0)
  p.closePath()
  return p
}

/** Um cano: afina de `r0` para `r1` até a boca, com os cantos da boca quebrados. */
function tubo(x0: number, x1: number, yc: number, r0: number, r1: number): Path2D {
  const p = new Path2D()
  const b = Math.min(0.012, r1 * 0.3)
  p.moveTo(x0, yc + r0)
  p.lineTo(x1 - b, yc + r1)
  p.quadraticCurveTo(x1, yc + r1, x1, yc + r1 - b)
  p.lineTo(x1, yc - r1 + b)
  p.quadraticCurveTo(x1, yc - r1, x1 - b, yc - r1)
  p.lineTo(x0, yc - r0)
  p.closePath()
  return p
}

function circulo(x: number, y: number, r: number): Path2D {
  const p = new Path2D()
  p.arc(x, y, r, 0, Math.PI * 2)
  return p
}

/** Preenche e contorna (a ordem de pintura decide o que fica na frente). */
function peca(g: CanvasRenderingContext2D, p: Path2D, preenchimento: string | CanvasGradient, contorno: string, espessura = ESPESSURA): void {
  g.fillStyle = preenchimento
  g.fill(p)
  g.lineJoin = 'round'
  g.strokeStyle = contorno
  g.lineWidth = espessura
  g.stroke(p)
}

/** Traço grosso com contorno e um fio de luz por cima (guarda-mato, anel). */
function tracar(g: CanvasRenderingContext2D, p: Path2D, largura: number, cor: string, contorno: string, luz: string): void {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = contorno
  g.lineWidth = largura + 2 * ESPESSURA
  g.stroke(p)
  g.strokeStyle = cor
  g.lineWidth = largura
  g.stroke(p)
  g.translate(0, largura * 0.22)
  g.globalAlpha = 0.75
  g.strokeStyle = luz
  g.lineWidth = largura * 0.24
  g.stroke(p)
  g.restore()
}

/** Linha de ouro rosa embutida: um sulco escuro, o metal e um fio de luz. */
function gravar(g: CanvasRenderingContext2D, p: Path2D, largura: number): void {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.translate(0.003, -0.004)
  g.strokeStyle = 'rgba(10, 3, 14, 0.75)'
  g.lineWidth = largura * 1.6
  g.stroke(p)
  g.translate(-0.003, 0.004)
  g.strokeStyle = OURO
  g.lineWidth = largura
  g.stroke(p)
  g.translate(-0.0015, 0.002)
  g.strokeStyle = 'rgba(255, 236, 226, 0.75)'
  g.lineWidth = largura * 0.35
  g.stroke(p)
  g.restore()
}

/** Espiral logarítmica gravada (as volutas da roxa). */
function voluta(g: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, voltas: number, sentido: 1 | -1, largura: number, inicio = 0): void {
  const p = new Path2D()
  const passos = Math.max(24, Math.round(voltas * 60))
  for (let i = 0; i <= passos; i++) {
    const k = i / passos
    const ang = inicio + sentido * k * voltas * Math.PI * 2
    const r = r0 * Math.pow(r1 / r0, k)
    const x = cx + Math.cos(ang) * r
    const y = cy + Math.sin(ang) * r
    if (i === 0) p.moveTo(x, y)
    else p.lineTo(x, y)
  }
  gravar(g, p, largura)
}

/** Folha de acanto em ouro rosa (enfeite das volutas). */
function folha(g: CanvasRenderingContext2D, x: number, y: number, comprimento: number, largura: number, angulo: number): void {
  g.save()
  g.translate(x, y)
  g.rotate(angulo)
  const p = new Path2D()
  p.moveTo(0, 0)
  p.bezierCurveTo(comprimento * 0.3, largura, comprimento * 0.75, largura * 0.8, comprimento, 0)
  p.bezierCurveTo(comprimento * 0.75, -largura * 0.45, comprimento * 0.3, -largura * 0.7, 0, 0)
  p.closePath()
  g.fillStyle = degrade(g, 0, largura, 0, -largura, OURO_CHAPA)
  g.fill(p)
  g.strokeStyle = CONTORNO_ROXA
  g.lineWidth = 0.004
  g.stroke(p)
  g.strokeStyle = 'rgba(255, 236, 226, 0.6)'
  g.lineWidth = 0.003
  g.beginPath()
  g.moveTo(comprimento * 0.08, 0)
  g.quadraticCurveTo(comprimento * 0.5, largura * 0.2, comprimento * 0.88, 0)
  g.stroke()
  g.restore()
}

/** Um parafuso de fenda (sem marca nenhuma). */
function parafuso(g: CanvasRenderingContext2D, x: number, y: number, r: number, paradas: Paradas, contorno: string, angulo: number): void {
  const p = circulo(x, y, r)
  peca(g, p, degrade(g, x - r, y + r, x + r, y - r, paradas), contorno, ESPESSURA * 0.6)
  g.save()
  g.strokeStyle = 'rgba(8, 6, 6, 0.85)'
  g.lineWidth = r * 0.28
  g.beginPath()
  g.moveTo(x - Math.cos(angulo) * r * 0.78, y - Math.sin(angulo) * r * 0.78)
  g.lineTo(x + Math.cos(angulo) * r * 0.78, y + Math.sin(angulo) * r * 0.78)
  g.stroke()
  g.restore()
}

/** Um brilho comprido e macio (o lustro da laca). */
function lustro(g: CanvasRenderingContext2D, p: Path2D, largura: number, alfa: number): void {
  g.save()
  g.lineCap = 'round'
  g.globalAlpha = alfa
  g.shadowColor = 'rgba(245, 232, 255, 0.9)'
  g.shadowBlur = largura * PX * 1.4
  g.strokeStyle = 'rgba(248, 240, 255, 0.85)'
  g.lineWidth = largura
  g.stroke(p)
  g.restore()
}

// ── O revólver de aço ────────────────────────────────────────────────────────

function formasDoAco() {
  const armacao = new Path2D()
  armacao.moveTo(0.665, 0.635)
  armacao.lineTo(-0.33, 0.655)
  armacao.quadraticCurveTo(-0.42, 0.66, -0.47, 0.6)
  armacao.lineTo(-0.55, 0.47)
  armacao.quadraticCurveTo(-0.63, 0.35, -0.665, 0.2)
  armacao.lineTo(-0.645, 0.05)
  armacao.lineTo(-0.08, -0.005)
  armacao.lineTo(0.36, 0.015)
  armacao.quadraticCurveTo(0.52, 0.025, 0.6, 0.12)
  armacao.lineTo(0.665, 0.22)
  armacao.closePath()

  const mira = new Path2D()
  mira.moveTo(2.03, 0.512)
  mira.lineTo(2.055, 0.57)
  mira.quadraticCurveTo(2.075, 0.632, 2.135, 0.632)
  mira.quadraticCurveTo(2.2, 0.632, 2.215, 0.57)
  mira.lineTo(2.235, 0.51)
  mira.closePath()

  const presilha = new Path2D()
  presilha.moveTo(1.57, 0.365)
  presilha.lineTo(1.58, 0.3)
  presilha.quadraticCurveTo(1.6, 0.272, 1.64, 0.272)
  presilha.lineTo(1.68, 0.272)
  presilha.quadraticCurveTo(1.71, 0.278, 1.715, 0.31)
  presilha.lineTo(1.722, 0.365)
  presilha.closePath()

  const guarda = new Path2D()
  guarda.moveTo(0.385, 0.02)
  guarda.bezierCurveTo(0.405, -0.13, 0.3, -0.335, 0.08, -0.338)
  guarda.bezierCurveTo(-0.1, -0.34, -0.205, -0.2, -0.17, 0.0)

  const gatilho = new Path2D()
  gatilho.moveTo(0.11, 0.0)
  gatilho.bezierCurveTo(0.16, -0.08, 0.13, -0.19, 0.035, -0.24)
  gatilho.bezierCurveTo(0.005, -0.256, -0.03, -0.245, -0.022, -0.226)
  gatilho.bezierCurveTo(0.05, -0.175, 0.068, -0.085, 0.03, 0.0)
  gatilho.closePath()

  const cabo = new Path2D()
  cabo.moveTo(-0.05, 0.01)
  cabo.bezierCurveTo(-0.1, -0.28, -0.12, -0.62, -0.2, -0.93)
  cabo.bezierCurveTo(-0.24, -1.0, -0.62, -1.03, -0.725, -0.945)
  cabo.bezierCurveTo(-0.795, -0.86, -0.775, -0.5, -0.725, -0.2)
  cabo.bezierCurveTo(-0.7, -0.05, -0.685, 0.1, -0.645, 0.21)
  cabo.lineTo(-0.5, 0.06)
  cabo.closePath()

  const madeira = new Path2D()
  madeira.moveTo(-0.1, -0.035)
  madeira.bezierCurveTo(-0.135, -0.3, -0.155, -0.62, -0.225, -0.895)
  madeira.bezierCurveTo(-0.27, -0.96, -0.6, -0.985, -0.69, -0.912)
  madeira.bezierCurveTo(-0.75, -0.83, -0.732, -0.5, -0.69, -0.22)
  madeira.bezierCurveTo(-0.67, -0.08, -0.655, 0.0, -0.628, 0.055)
  madeira.bezierCurveTo(-0.5, 0.02, -0.3, -0.02, -0.1, -0.035)
  madeira.closePath()

  const xadrez = new Path2D()
  xadrez.moveTo(-0.165, -0.13)
  xadrez.bezierCurveTo(-0.19, -0.36, -0.205, -0.6, -0.265, -0.835)
  xadrez.bezierCurveTo(-0.36, -0.895, -0.55, -0.9, -0.632, -0.85)
  xadrez.bezierCurveTo(-0.672, -0.7, -0.665, -0.45, -0.635, -0.24)
  xadrez.bezierCurveTo(-0.615, -0.12, -0.6, -0.05, -0.582, -0.01)
  xadrez.bezierCurveTo(-0.46, -0.06, -0.3, -0.1, -0.165, -0.13)
  xadrez.closePath()

  return {
    armacao,
    tambor: retangulo(-0.215, 0.09, 0.475, 0.53, 0.045),
    raiz: retangulo(0.6, 0.334, 0.865, 0.546, 0.012),
    cano: tubo(0.86, 2.285, 0.44, 0.084, 0.078),
    mira,
    vareta: retangulo(0.86, 0.277, 1.46, 0.333, 0.02),
    pontaDaVareta: retangulo(1.44, 0.263, 1.575, 0.347, 0.018),
    presilha,
    trava: retangulo(-0.45, 0.3, -0.27, 0.405, 0.022),
    guarda,
    gatilho,
    cabo,
    madeira,
    xadrez,
  }
}

/** Ferrugem velha, riscos de coldre e picadas: só no aço (recortado pela região). */
function desgastarAco(g: CanvasRenderingContext2D, regiao: Path2D, rnd: () => number): void {
  g.save()
  g.clip(regiao)
  for (let i = 0; i < 18; i++) {
    const x = -0.65 + rnd() * 2.95
    const y = rnd() * 0.66
    const r = 0.05 + rnd() * 0.17
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, `rgba(98, 76, 56, ${(0.1 + rnd() * 0.15).toFixed(3)})`)
    grd.addColorStop(1, 'rgba(98, 76, 56, 0)')
    g.fillStyle = grd
    g.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
  for (let i = 0; i < 460; i++) {
    const x = -0.68 + rnd() * 2.98
    const y = -0.36 + rnd() * 1.02
    const comprimento = 0.008 + rnd() * 0.07
    const angulo = (rnd() - 0.5) * (rnd() < 0.7 ? 0.35 : 3.0)
    const claro = rnd() < 0.55
    g.strokeStyle = claro ? `rgba(215, 220, 226, ${(0.08 + rnd() * 0.16).toFixed(3)})` : `rgba(8, 9, 10, ${(0.12 + rnd() * 0.2).toFixed(3)})`
    g.lineWidth = 0.0018 + rnd() * 0.0035
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(angulo) * comprimento, y + Math.sin(angulo) * comprimento)
    g.stroke()
  }
  for (let i = 0; i < 560; i++) {
    const x = -0.68 + rnd() * 2.98
    const y = -0.36 + rnd() * 1.02
    g.fillStyle = `rgba(10, 10, 11, ${(0.18 + rnd() * 0.3).toFixed(3)})`
    g.beginPath()
    g.arc(x, y, 0.0015 + rnd() * 0.004, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

/** Fio claro onde o azulado gastou (quina de cima de cada peça). */
function quinaGasta(g: CanvasRenderingContext2D, pontos: readonly Ponto[], alfa: number): void {
  g.save()
  g.strokeStyle = `rgba(232, 235, 238, ${alfa})`
  g.lineWidth = 0.006
  g.lineCap = 'round'
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.stroke()
  g.restore()
}

/** Madeira de nogueira com veio, quadriculado em relevo, losango liso e um parafuso. */
function pintarMadeira(g: CanvasRenderingContext2D, madeira: Path2D, xadrez: Path2D, rnd: () => number): void {
  g.save()
  g.clip(madeira)
  g.fillStyle = '#5b3820'
  g.fillRect(-0.85, -1.05, 0.9, 1.3)
  const luz = g.createRadialGradient(-0.36, -0.3, 0.02, -0.36, -0.3, 0.78)
  luz.addColorStop(0, 'rgba(178, 118, 70, 0.85)')
  luz.addColorStop(0.55, 'rgba(120, 74, 40, 0.4)')
  luz.addColorStop(1, 'rgba(40, 22, 10, 0)')
  g.fillStyle = luz
  g.fillRect(-0.85, -1.05, 0.9, 1.3)
  for (let i = 0; i < 90; i++) {
    const x0 = -0.82 + rnd() * 0.84
    const onda = 0.004 + rnd() * 0.012
    const fase = rnd() * 6
    g.strokeStyle = rnd() < 0.75 ? `rgba(38, 20, 9, ${(0.12 + rnd() * 0.25).toFixed(3)})` : `rgba(190, 130, 80, ${(0.08 + rnd() * 0.12).toFixed(3)})`
    g.lineWidth = 0.002 + rnd() * 0.006
    g.beginPath()
    for (let k = 0; k <= 24; k++) {
      const y = 0.22 - k * 0.052
      const x = x0 - k * 0.006 + Math.sin(k * 0.55 + fase) * onda
      if (k === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  // O quadriculado: duas famílias de sulcos, cada uma com um fio de luz ao lado (o relevo dos losangos).
  g.save()
  g.clip(xadrez)
  g.fillStyle = 'rgba(28, 15, 6, 0.3)'
  g.fillRect(-0.85, -1.05, 0.9, 1.3)
  const centro: Ponto = [-0.42, -0.48]
  for (const angulo of [1.12, -1.12]) {
    const dx = Math.cos(angulo)
    const dy = Math.sin(angulo)
    for (let k = -42; k <= 42; k++) {
      const ox = centro[0] - dy * k * 0.02
      const oy = centro[1] + dx * k * 0.02
      g.strokeStyle = 'rgba(16, 8, 3, 0.62)'
      g.lineWidth = 0.0058
      g.beginPath()
      g.moveTo(ox - dx * 1.2, oy - dy * 1.2)
      g.lineTo(ox + dx * 1.2, oy + dy * 1.2)
      g.stroke()
      g.strokeStyle = 'rgba(232, 172, 112, 0.17)'
      g.lineWidth = 0.0026
      g.beginPath()
      g.moveTo(ox - dy * 0.0045 - dx * 1.2, oy + dx * 0.0045 - dy * 1.2)
      g.lineTo(ox - dy * 0.0045 + dx * 1.2, oy + dx * 0.0045 + dy * 1.2)
      g.stroke()
    }
  }
  g.restore()
  const losango = new Path2D()
  losango.moveTo(-0.44, -0.55)
  losango.lineTo(-0.385, -0.665)
  losango.lineTo(-0.44, -0.78)
  losango.lineTo(-0.495, -0.665)
  losango.closePath()
  g.fillStyle = '#6a4326'
  g.fill(losango)
  g.strokeStyle = 'rgba(20, 10, 4, 0.55)'
  g.lineWidth = 0.005
  g.stroke(losango)
  parafuso(g, -0.44, -0.665, 0.026, ACO_TUBO, CONTORNO_ACO, 0.5)
  // Sombra por dentro da borda do painel (a madeira assenta abaixo da armação).
  g.strokeStyle = 'rgba(18, 9, 3, 0.5)'
  g.lineWidth = 0.05
  g.stroke(madeira)
  g.restore()
  g.strokeStyle = CONTORNO_ACO
  g.lineWidth = ESPESSURA
  g.stroke(madeira)
}

/** O revólver de aço, cano para a direita, em unidades da arma (origem na mão). */
export function desenharRevolverDeAco(g: CanvasRenderingContext2D): void {
  const f = formasDoAco()
  const rnd = semente(9071)
  g.lineJoin = 'round'

  // O cabo: a armação de aço por baixo, a madeira por cima, deixando um filete de aço.
  peca(g, f.cabo, vertical(g, 0.2, -1.0, ACO_ESCURO), CONTORNO_ACO)
  quinaGasta(g, [
    [-0.06, -0.01],
    [-0.11, -0.3],
    [-0.13, -0.62],
    [-0.2, -0.91],
  ], 0.3)
  pintarMadeira(g, f.madeira, f.xadrez, rnd)

  // Guarda-mato e gatilho.
  tracar(g, f.guarda, 0.05, '#45484c', CONTORNO_ACO, '#9fa3a7')
  peca(g, f.gatilho, degrade(g, 0.13, 0, -0.02, -0.24, ACO_CHAPA), CONTORNO_ACO)

  // A armação, com a sombra da janela do tambor, a placa lateral, a trava e os parafusos.
  peca(g, f.armacao, vertical(g, 0.66, 0.0, ACO_CHAPA), CONTORNO_ACO)
  g.save()
  g.strokeStyle = 'rgba(5, 6, 7, 0.75)'
  g.lineWidth = 0.032
  g.stroke(retangulo(-0.23, 0.075, 0.49, 0.545, 0.05))
  g.restore()
  g.save()
  g.strokeStyle = 'rgba(8, 9, 10, 0.7)'
  g.lineWidth = 0.005
  g.beginPath()
  g.moveTo(-0.47, 0.585)
  g.quadraticCurveTo(-0.52, 0.3, -0.42, 0.06)
  g.quadraticCurveTo(-0.2, 0.03, 0.32, 0.045)
  g.stroke()
  g.fillStyle = 'rgba(6, 7, 8, 0.9)'
  g.fillRect(-0.305, 0.62, 0.05, 0.035)
  g.restore()
  peca(g, f.trava, vertical(g, 0.405, 0.3, ACO_TUBO), CONTORNO_ACO, ESPESSURA * 0.8)
  g.save()
  g.clip(f.trava)
  g.strokeStyle = 'rgba(10, 11, 12, 0.55)'
  g.lineWidth = 0.004
  for (let k = 0; k < 14; k++) {
    const x = -0.45 + k * 0.016
    g.beginPath()
    g.moveTo(x, 0.29)
    g.lineTo(x + 0.06, 0.42)
    g.moveTo(x + 0.06, 0.29)
    g.lineTo(x, 0.42)
    g.stroke()
  }
  g.restore()
  parafuso(g, -0.34, 0.15, 0.022, ACO_TUBO, CONTORNO_ACO, 0.3)
  parafuso(g, 0.3, 0.07, 0.02, ACO_TUBO, CONTORNO_ACO, 1.2)
  quinaGasta(g, [
    [-0.33, 0.645],
    [0.655, 0.625],
  ], 0.4)

  // O tambor (as caneluras giram no shader) e a fresta escura na frente dele.
  peca(g, f.tambor, vertical(g, 0.53, 0.09, ACO_TUBO), CONTORNO_ACO)
  g.save()
  g.clip(f.tambor)
  g.fillStyle = degrade(g, -0.215, 0, -0.16, 0, [
    [0, 'rgba(0, 0, 0, 0.45)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  g.fillRect(-0.215, 0.09, 0.06, 0.44)
  g.fillStyle = degrade(g, 0.475, 0, 0.42, 0, [
    [0, 'rgba(0, 0, 0, 0.5)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  g.fillRect(0.415, 0.09, 0.06, 0.44)
  g.restore()
  g.fillStyle = '#0a0b0c'
  g.fillRect(0.476, 0.13, 0.016, 0.38)

  // Cano, raiz do cano, mira, vareta do extrator e a presilha embaixo.
  peca(g, f.raiz, vertical(g, 0.546, 0.334, ACO_TUBO), CONTORNO_ACO)
  peca(g, f.vareta, vertical(g, 0.333, 0.277, ACO_TUBO), CONTORNO_ACO, ESPESSURA * 0.8)
  peca(g, f.pontaDaVareta, vertical(g, 0.347, 0.263, ACO_TUBO), CONTORNO_ACO, ESPESSURA * 0.8)
  g.save()
  g.clip(f.pontaDaVareta)
  g.strokeStyle = 'rgba(10, 11, 12, 0.55)'
  g.lineWidth = 0.004
  for (let x = 1.45; x < 1.575; x += 0.012) {
    g.beginPath()
    g.moveTo(x, 0.26)
    g.lineTo(x, 0.35)
    g.stroke()
  }
  g.restore()
  peca(g, f.presilha, vertical(g, 0.365, 0.272, ACO_CHAPA), CONTORNO_ACO)
  peca(g, f.cano, vertical(g, 0.524, 0.356, ACO_TUBO), CONTORNO_ACO)
  g.fillStyle = 'rgba(12, 13, 14, 0.55)'
  g.fillRect(2.262, 0.364, 0.022, 0.152)
  g.fillStyle = 'rgba(220, 224, 228, 0.35)'
  g.fillRect(2.268, 0.37, 0.004, 0.14)
  peca(g, f.mira, vertical(g, 0.632, 0.51, ACO_CHAPA), CONTORNO_ACO)
  quinaGasta(g, [
    [0.87, 0.519],
    [2.26, 0.513],
  ], 0.45)

  // Desgaste por cima de todo o aço (a madeira tem o dela).
  const metal = new Path2D()
  for (const p of [f.armacao, f.tambor, f.raiz, f.cano, f.mira, f.vareta, f.pontaDaVareta, f.presilha, f.trava, f.gatilho]) metal.addPath(p)
  desgastarAco(g, metal, rnd)
}

/** O cão do aço: corpo largo e a espora serrilhada, para trás. */
function formaDoCaoDeAco(): Path2D {
  const p = new Path2D()
  p.moveTo(-0.425, 0.43)
  p.lineTo(-0.41, 0.6)
  p.bezierCurveTo(-0.415, 0.675, -0.465, 0.735, -0.55, 0.765)
  p.lineTo(-0.775, 0.808)
  p.bezierCurveTo(-0.835, 0.818, -0.865, 0.79, -0.845, 0.758)
  p.bezierCurveTo(-0.81, 0.72, -0.71, 0.7, -0.625, 0.665)
  p.bezierCurveTo(-0.565, 0.638, -0.535, 0.585, -0.528, 0.515)
  p.lineTo(-0.535, 0.43)
  p.closePath()
  return p
}

/** O cão foi desenhado grande demais para o corpo: encolhe em volta do pino, que fica no mesmo lugar. */
function encolherNoPino(g: CanvasRenderingContext2D, pino: Ponto, fator: number): void {
  g.translate(pino[0], pino[1])
  g.scale(fator, fator)
  g.translate(-pino[0], -pino[1])
}

function desenharCaoDeAco(g: CanvasRenderingContext2D): void {
  encolherNoPino(g, ACO.pinoDoCao, 0.74)
  const p = formaDoCaoDeAco()
  peca(g, p, degrade(g, -0.4, 0.82, -0.6, 0.45, ACO_TUBO), CONTORNO_ACO)
  g.save()
  g.clip(p)
  g.strokeStyle = 'rgba(10, 11, 12, 0.65)'
  g.lineWidth = 0.005
  for (let k = 0; k < 11; k++) {
    const x = -0.6 - k * 0.022
    const y = 0.768 + k * 0.0042
    g.beginPath()
    g.moveTo(x - 0.004, y - 0.03)
    g.lineTo(x + 0.004, y + 0.03)
    g.stroke()
  }
  g.restore()
  quinaGasta(g, [
    [-0.418, 0.6],
    [-0.47, 0.72],
    [-0.56, 0.76],
  ], 0.4)
}

// ── A pistola roxa ───────────────────────────────────────────────────────────

function formasDaRoxa() {
  const corpo = new Path2D()
  corpo.moveTo(0.53, 0.615)
  corpo.bezierCurveTo(0.3, 0.665, -0.08, 0.675, -0.3, 0.655)
  corpo.bezierCurveTo(-0.4, 0.648, -0.47, 0.62, -0.505, 0.56)
  corpo.bezierCurveTo(-0.545, 0.48, -0.555, 0.35, -0.565, 0.22)
  corpo.lineTo(-0.09, -0.005)
  corpo.bezierCurveTo(0.1, 0.015, 0.3, 0.06, 0.42, 0.14)
  corpo.bezierCurveTo(0.5, 0.19, 0.535, 0.23, 0.545, 0.26)
  corpo.closePath()

  const bandaDaBoca = new Path2D()
  bandaDaBoca.moveTo(1.975, 0.262)
  bandaDaBoca.lineTo(2.07, 0.244)
  bandaDaBoca.quadraticCurveTo(2.125, 0.24, 2.125, 0.29)
  bandaDaBoca.lineTo(2.125, 0.545)
  bandaDaBoca.quadraticCurveTo(2.125, 0.595, 2.07, 0.592)
  bandaDaBoca.lineTo(1.975, 0.574)
  bandaDaBoca.closePath()

  const guarda = new Path2D()
  guarda.moveTo(0.31, 0.07)
  guarda.bezierCurveTo(0.345, -0.1, 0.27, -0.29, 0.07, -0.295)
  guarda.bezierCurveTo(-0.06, -0.298, -0.13, -0.22, -0.125, -0.12)

  const gatilho = new Path2D()
  gatilho.moveTo(0.1, 0.02)
  gatilho.bezierCurveTo(0.14, -0.06, 0.11, -0.17, 0.03, -0.215)
  gatilho.bezierCurveTo(0.01, -0.225, -0.012, -0.215, -0.004, -0.2)
  gatilho.bezierCurveTo(0.05, -0.15, 0.06, -0.07, 0.035, 0.02)
  gatilho.closePath()

  const cabo = new Path2D()
  cabo.moveTo(-0.07, 0.03)
  cabo.bezierCurveTo(-0.09, -0.2, -0.2, -0.48, -0.4, -0.7)
  cabo.lineTo(-0.44, -0.745)
  cabo.lineTo(-0.815, -0.7)
  cabo.bezierCurveTo(-0.815, -0.48, -0.68, -0.2, -0.59, 0.12)
  cabo.lineTo(-0.565, 0.24)
  cabo.closePath()

  const caboDeDentro = new Path2D()
  caboDeDentro.moveTo(-0.12, -0.03)
  caboDeDentro.bezierCurveTo(-0.15, -0.23, -0.25, -0.47, -0.42, -0.66)
  caboDeDentro.lineTo(-0.76, -0.64)
  caboDeDentro.bezierCurveTo(-0.76, -0.47, -0.65, -0.21, -0.57, 0.08)
  caboDeDentro.closePath()

  const capa = new Path2D()
  capa.moveTo(-0.4, -0.69)
  capa.bezierCurveTo(-0.43, -0.79, -0.52, -0.845, -0.625, -0.85)
  capa.bezierCurveTo(-0.725, -0.85, -0.81, -0.8, -0.84, -0.71)
  capa.bezierCurveTo(-0.835, -0.69, -0.82, -0.675, -0.805, -0.68)
  capa.bezierCurveTo(-0.68, -0.722, -0.53, -0.722, -0.43, -0.672)
  capa.closePath()

  return {
    corpo,
    canoDeCima: tubo(0.5, 2.1, 0.5, 0.075, 0.072),
    canoDeBaixo: tubo(0.5, 2.1, 0.335, 0.075, 0.072),
    nervura: retangulo(0.56, 0.405, 1.99, 0.43, 0.006),
    bandaDeTras: retangulo(0.48, 0.248, 0.625, 0.587, 0.02),
    bandaDoMeio: retangulo(1.27, 0.252, 1.355, 0.583, 0.018),
    bandaDaBoca,
    guarda,
    gatilho,
    cabo,
    caboDeDentro,
    capa,
    anel: circulo(ANEL_DA_ROXA[0], ANEL_DA_ROXA[1], 0.032),
  }
}

/** Uma pétala de ouro rosa: sai do miolo e termina redonda, mais clara na borda. */
function petala(g: CanvasRenderingContext2D, cx: number, cy: number, angulo: number, comprimento: number, largura: number): void {
  g.save()
  g.translate(cx, cy)
  g.rotate(angulo)
  const p = new Path2D()
  p.moveTo(comprimento * 0.12, 0)
  p.bezierCurveTo(comprimento * 0.12, largura, comprimento, largura * 1.3, comprimento, 0)
  p.bezierCurveTo(comprimento, -largura * 1.3, comprimento * 0.12, -largura, comprimento * 0.12, 0)
  p.closePath()
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, comprimento)
  grd.addColorStop(0, '#5e2c22')
  grd.addColorStop(0.55, '#c2806b')
  grd.addColorStop(0.9, '#f6cdb9')
  grd.addColorStop(1, '#ffe9dd')
  g.fillStyle = grd
  g.fill(p)
  g.strokeStyle = 'rgba(24, 8, 14, 0.85)'
  g.lineWidth = 0.0042
  g.stroke(p)
  g.restore()
}

/** A rosa no cabo, em ouro rosa: três voltas de pétalas, o botão em espiral, o talo e as folhas. */
function rosaGravada(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const talo = new Path2D()
  talo.moveTo(cx + r * 0.1, cy - r * 0.5)
  talo.bezierCurveTo(cx + r * 0.45, cy - r * 1.25, cx + r * 0.05, cy - r * 1.55, cx + r * 0.2, cy - r * 2.0)
  gravar(g, talo, 0.008)
  folha(g, cx + r * 0.34, cy - r * 1.2, r * 0.7, r * 0.24, -0.5)
  folha(g, cx + r * 0.2, cy - r * 1.55, r * 0.6, r * 0.2, Math.PI + 0.4)
  for (let i = 0; i < 5; i++) petala(g, cx, cy, (i * 2 * Math.PI) / 5 + 0.3, r, r * 0.42)
  for (let i = 0; i < 4; i++) petala(g, cx, cy, (i * 2 * Math.PI) / 4 + 0.9, r * 0.7, r * 0.36)
  for (let i = 0; i < 3; i++) petala(g, cx, cy, (i * 2 * Math.PI) / 3 + 0.2, r * 0.45, r * 0.3)
  peca(g, circulo(cx, cy, r * 0.17), degrade(g, cx - r * 0.17, cy + r * 0.17, cx + r * 0.17, cy - r * 0.17, OURO_CHAPA), CONTORNO_ROXA, 0.004)
  const botao = new Path2D()
  for (let i = 0; i <= 40; i++) {
    const k = i / 40
    const a = k * Math.PI * 3.2
    const raio = r * (0.02 + 0.13 * k)
    if (i === 0) botao.moveTo(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio)
    else botao.lineTo(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio)
  }
  g.strokeStyle = 'rgba(60, 22, 18, 0.9)'
  g.lineWidth = 0.004
  g.stroke(botao)
}

/** Um ponto e a direção da curva de Bézier cúbica em `t` (para pôr as folhas ao longo de um ramo). */
function naCurva(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: number): [number, number, number] {
  const u = 1 - t
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
  return [x, y, Math.atan2(dy, dx)]
}

/** O arabesco do corpo: uma voluta grande ligada a uma pequena por um ramo em S, com folhas ao longo dele. */
function arabesco(g: CanvasRenderingContext2D): void {
  voluta(g, 0.12, 0.33, 0.012, 0.15, 2.0, 1, 0.011, Math.PI * 1.15)
  voluta(g, -0.33, 0.4, 0.008, 0.065, 1.5, -1, 0.008, Math.PI * 0.78)
  const ramo: [Ponto, Ponto, Ponto, Ponto] = [
    [-0.014, 0.262],
    [-0.08, 0.17],
    [-0.24, 0.27],
    [-0.28, 0.358],
  ]
  const p = new Path2D()
  p.moveTo(...ramo[0])
  p.bezierCurveTo(...ramo[1], ...ramo[2], ...ramo[3])
  gravar(g, p, 0.009)
  ;[0.3, 0.55, 0.8].forEach((t, i) => {
    const [x, y, a] = naCurva(...ramo, t)
    folha(g, x, y, 0.1 - i * 0.012, 0.026, a + (i % 2 === 0 ? 0.75 : -0.75))
  })
  folha(g, 0.25, 0.46, 0.13, 0.03, 0.3)
  folha(g, 0.27, 0.2, 0.12, 0.028, -0.45)
}

/** Filigrana nos canos: uma onda fina com caracóis nas cristas. */
function filigrana(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, amplitude: number, ondas: number): void {
  const p = new Path2D()
  for (let i = 0; i <= 80; i++) {
    const k = i / 80
    const x = x0 + (x1 - x0) * k
    const yy = y + Math.sin(k * Math.PI * 2 * ondas) * amplitude
    if (i === 0) p.moveTo(x, yy)
    else p.lineTo(x, yy)
  }
  gravar(g, p, 0.005)
  for (let c = 0; c < ondas * 2; c++) {
    const k = (c + 0.5) / (ondas * 2)
    const sinal = c % 2 === 0 ? 1 : -1
    voluta(g, x0 + (x1 - x0) * k, y + sinal * amplitude * 1.55, 0.005, 0.022, 1.15, sinal === 1 ? 1 : -1, 0.004)
  }
}

/** A pistola roxa, cano para a direita, em unidades da arma (origem na mão). */
export function desenharPistolaRoxa(g: CanvasRenderingContext2D): void {
  const f = formasDaRoxa()
  g.lineJoin = 'round'

  // O cabo de laca: o lustro comprido pelas costas, o filete de ouro rosa e a rosa.
  peca(g, f.cabo, degrade(g, -0.08, -0.2, -0.72, -0.36, [
    [0, '#2a1140'],
    [0.28, '#5d3292'],
    [0.5, '#3b1a5e'],
    [1, '#160823'],
  ]), CONTORNO_ROXA)
  const costas = new Path2D()
  costas.moveTo(-0.6, 0.08)
  costas.bezierCurveTo(-0.66, -0.18, -0.74, -0.42, -0.765, -0.6)
  lustro(g, costas, 0.014, 0.55)
  const frente = new Path2D()
  frente.moveTo(-0.11, -0.05)
  frente.bezierCurveTo(-0.14, -0.25, -0.24, -0.46, -0.38, -0.62)
  lustro(g, frente, 0.008, 0.3)
  gravar(g, f.caboDeDentro, 0.0075)
  rosaGravada(g, -0.42, -0.27, 0.13)

  // A capa do cabo e o anel da corrente.
  peca(g, f.capa, degrade(g, -0.4, -0.67, -0.6, -0.85, OURO_CHAPA), CONTORNO_ROXA)
  g.save()
  g.clip(f.capa)
  g.strokeStyle = 'rgba(80, 36, 26, 0.6)'
  g.lineWidth = 0.005
  g.beginPath()
  g.moveTo(-0.44, -0.72)
  g.bezierCurveTo(-0.52, -0.78, -0.7, -0.79, -0.8, -0.73)
  g.stroke()
  g.restore()
  tracar(g, f.anel, 0.016, '#c9866f', CONTORNO_ROXA, '#ffe2d3')

  // Guarda-mato de ouro rosa com um caracol na ponta, e o gatilho.
  tracar(g, f.guarda, 0.04, '#c4826b', CONTORNO_ROXA, '#ffe6da')
  voluta(g, -0.11, -0.115, 0.008, 0.04, 1.2, -1, 0.012, Math.PI * 0.5)
  peca(g, f.gatilho, degrade(g, 0.12, 0, -0.01, -0.22, OURO_CHAPA), CONTORNO_ROXA)

  // O corpo: laca com um lustro largo no alto, o friso de ouro rosa e a grande voluta com folhas.
  peca(g, f.corpo, vertical(g, 0.675, 0.0, LACA_CHAPA), CONTORNO_ROXA)
  g.save()
  g.clip(f.corpo)
  g.fillStyle = vertical(g, 0.66, 0.5, [
    [0, 'rgba(240, 225, 255, 0)'],
    [0.35, 'rgba(240, 225, 255, 0.32)'],
    [1, 'rgba(240, 225, 255, 0)'],
  ])
  g.fillRect(-0.6, 0.5, 1.2, 0.18)
  // A moldura: um filete de ouro rosa por dentro da borda, com um sulco escuro logo depois.
  g.lineJoin = 'round'
  g.strokeStyle = 'rgba(14, 4, 20, 0.7)'
  g.lineWidth = 0.075
  g.stroke(f.corpo)
  g.strokeStyle = OURO
  g.lineWidth = 0.036
  g.stroke(f.corpo)
  g.strokeStyle = 'rgba(255, 232, 220, 0.55)'
  g.lineWidth = 0.008
  g.stroke(f.corpo)
  g.restore()
  arabesco(g)
  parafuso(g, 0.47, 0.3, 0.032, OURO_CHAPA, CONTORNO_ROXA, 0.8)
  parafuso(g, -0.43, 0.53, 0.018, OURO_CHAPA, CONTORNO_ROXA, 0.2)
  parafuso(g, -0.22, 0.1, 0.018, OURO_CHAPA, CONTORNO_ROXA, 1.4)

  // Os dois canos de laca, a nervura e as três cintas de ouro rosa, com filigrana entre elas.
  peca(g, f.bandaDeTras, vertical(g, 0.587, 0.248, OURO_TUBO), CONTORNO_ROXA)
  peca(g, f.canoDeBaixo, vertical(g, 0.41, 0.26, LACA_TUBO), CONTORNO_ROXA)
  peca(g, f.canoDeCima, vertical(g, 0.575, 0.425, LACA_TUBO), CONTORNO_ROXA)
  peca(g, f.nervura, vertical(g, 0.43, 0.405, OURO_TUBO), CONTORNO_ROXA, ESPESSURA * 0.6)
  filigrana(g, 0.66, 1.24, 0.5, 0.022, 2)
  filigrana(g, 0.66, 1.24, 0.335, 0.022, 2)
  filigrana(g, 1.4, 1.94, 0.5, 0.018, 2)
  peca(g, f.bandaDoMeio, vertical(g, 0.583, 0.252, OURO_TUBO), CONTORNO_ROXA)
  peca(g, f.bandaDaBoca, vertical(g, 0.595, 0.24, OURO_TUBO), CONTORNO_ROXA)
  g.save()
  g.clip(f.bandaDaBoca)
  g.strokeStyle = 'rgba(70, 30, 20, 0.6)'
  g.lineWidth = 0.004
  for (const x of [2.005, 2.03, 2.098]) {
    g.beginPath()
    g.moveTo(x, 0.2)
    g.lineTo(x, 0.64)
    g.stroke()
  }
  g.restore()
  peca(g, circulo(1.92, 0.588, 0.017), degrade(g, 1.9, 0.6, 1.94, 0.57, OURO_CHAPA), CONTORNO_ROXA, ESPESSURA * 0.6)
  const lustroDeCima = new Path2D()
  lustroDeCima.moveTo(0.66, 0.548)
  lustroDeCima.lineTo(1.24, 0.546)
  lustroDeCima.moveTo(1.38, 0.546)
  lustroDeCima.lineTo(1.95, 0.544)
  lustro(g, lustroDeCima, 0.006, 0.5)
}

/** O cão da roxa, de ouro rosa, com a espora enrolada num caracol. */
function formaDoCaoRoxo(): Path2D {
  const p = new Path2D()
  p.moveTo(-0.33, 0.44)
  p.lineTo(-0.315, 0.6)
  p.bezierCurveTo(-0.315, 0.69, -0.37, 0.755, -0.455, 0.775)
  p.bezierCurveTo(-0.545, 0.795, -0.63, 0.765, -0.64, 0.71)
  p.bezierCurveTo(-0.648, 0.665, -0.61, 0.638, -0.575, 0.652)
  p.bezierCurveTo(-0.545, 0.664, -0.548, 0.7, -0.575, 0.703)
  p.bezierCurveTo(-0.53, 0.718, -0.47, 0.705, -0.435, 0.665)
  p.bezierCurveTo(-0.405, 0.63, -0.398, 0.58, -0.402, 0.52)
  p.lineTo(-0.41, 0.44)
  p.closePath()
  return p
}

function desenharCaoRoxo(g: CanvasRenderingContext2D): void {
  encolherNoPino(g, ROXA.pinoDoCao, 0.8)
  peca(g, formaDoCaoRoxo(), degrade(g, -0.32, 0.78, -0.6, 0.5, OURO_CHAPA), CONTORNO_ROXA)
  const linha = new Path2D()
  linha.moveTo(-0.36, 0.5)
  linha.bezierCurveTo(-0.355, 0.64, -0.4, 0.72, -0.48, 0.745)
  gravar(g, linha, 0.004)
}

/** A corrente: elos de ouro rosa alternando de frente e de lado, pendurada pelo alto (origem). */
function desenharCorrente(g: CanvasRenderingContext2D): void {
  for (let i = 0; i < ELOS; i++) {
    const y = -(i + 0.5) * PASSO_DO_ELO
    if (i % 2 === 0) {
      const p = new Path2D()
      p.ellipse(0, y, 0.021, 0.034, 0, 0, Math.PI * 2)
      tracar(g, p, 0.011, '#c9866f', CONTORNO_ROXA, '#ffe2d3')
    } else {
      peca(g, retangulo(-0.0065, y - 0.036, 0.0065, y + 0.036, 0.006), degrade(g, -0.007, 0, 0.007, 0, OURO_TUBO), CONTORNO_ROXA, ESPESSURA * 0.7)
    }
  }
}

/** O pingente: uma gota de pedra violeta lapidada numa garra de ouro rosa (sem letra, sem marca). */
function desenharPingente(g: CanvasRenderingContext2D): void {
  peca(g, retangulo(-0.024, -0.032, 0.024, 0.0, 0.008), degrade(g, -0.024, 0, 0.024, 0, OURO_TUBO), CONTORNO_ROXA, ESPESSURA * 0.7)
  const gota = new Path2D()
  gota.moveTo(0, -0.028)
  gota.bezierCurveTo(0.05, -0.03, 0.058, -0.095, 0, -0.165)
  gota.bezierCurveTo(-0.058, -0.095, -0.05, -0.03, 0, -0.028)
  gota.closePath()
  const pedra = g.createRadialGradient(-0.014, -0.07, 0.004, 0, -0.09, 0.08)
  pedra.addColorStop(0, '#f6d4ff')
  pedra.addColorStop(0.25, '#b25ae6')
  pedra.addColorStop(0.6, '#5a1888')
  pedra.addColorStop(1, '#1e0632')
  peca(g, gota, pedra, CONTORNO_ROXA, ESPESSURA * 0.8)
  g.save()
  g.clip(gota)
  g.strokeStyle = 'rgba(240, 200, 255, 0.35)'
  g.lineWidth = 0.003
  g.beginPath()
  g.moveTo(0, -0.03)
  g.lineTo(-0.02, -0.08)
  g.lineTo(0, -0.165)
  g.moveTo(0, -0.03)
  g.lineTo(0.022, -0.085)
  g.lineTo(0, -0.165)
  g.moveTo(-0.045, -0.085)
  g.lineTo(0.045, -0.085)
  g.stroke()
  g.restore()
  g.fillStyle = 'rgba(255, 255, 255, 0.9)'
  g.beginPath()
  g.arc(-0.016, -0.062, 0.006, 0, Math.PI * 2)
  g.fill()
}

// ── Pintura: texturas ────────────────────────────────────────────────────────

/** A máscara: R = metal polido, G = ouro rosa, B = tambor. Mesmas formas, cores chapadas. */
function pintarMascaraDoAco(g: CanvasRenderingContext2D): void {
  const f = formasDoAco()
  const metal = 'rgb(190, 0, 0)'
  g.fillStyle = metal
  g.fill(f.cabo)
  g.fillStyle = 'rgb(35, 0, 0)'
  g.fill(f.madeira)
  g.save()
  g.lineCap = 'round'
  g.strokeStyle = metal
  g.lineWidth = 0.05 + 2 * ESPESSURA
  g.stroke(f.guarda)
  g.restore()
  g.fillStyle = metal
  for (const p of [f.gatilho, f.armacao, f.raiz, f.cano, f.mira, f.vareta, f.pontaDaVareta, f.presilha, f.trava]) g.fill(p)
  g.fillStyle = 'rgb(200, 0, 255)'
  g.fill(f.tambor)
}

function pintarMascaraDaRoxa(g: CanvasRenderingContext2D): void {
  const f = formasDaRoxa()
  const laca = 'rgb(235, 0, 0)'
  const ouro = 'rgb(255, 255, 0)'
  g.fillStyle = laca
  for (const p of [f.cabo, f.corpo, f.canoDeCima, f.canoDeBaixo]) g.fill(p)
  g.fillStyle = ouro
  for (const p of [f.capa, f.gatilho, f.nervura, f.bandaDeTras, f.bandaDoMeio, f.bandaDaBoca]) g.fill(p)
  g.save()
  g.lineCap = 'round'
  g.strokeStyle = ouro
  g.lineWidth = 0.04 + 2 * ESPESSURA
  g.stroke(f.guarda)
  g.lineWidth = 0.016 + 2 * ESPESSURA
  g.stroke(f.anel)
  g.restore()
}

/** As armas e as peças pintadas, em canvas (o protótipo também as mostra em tamanho grande). */
export function pintarAsPecas(): {
  roxa: HTMLCanvasElement
  aco: HTMLCanvasElement
  mascaraRoxa: HTMLCanvasElement
  mascaraAco: HTMLCanvasElement
  caoRoxo: HTMLCanvasElement
  caoDeAco: HTMLCanvasElement
  corrente: HTMLCanvasElement
  pingente: HTMLCanvasElement
} {
  const arma = (desenhar: (g: CanvasRenderingContext2D) => void, fator: number) => {
    const [canvas, g] = tela(Math.round(ARMA_LARGURA_PX * fator), Math.round(ARMA_ALTURA_PX * fator))
    emUnidades(g, fator)
    desenhar(g)
    return canvas
  }
  const cao = (desenhar: (g: CanvasRenderingContext2D) => void, pino: Ponto) => {
    const [canvas, g] = tela(CAO_PX, CAO_PX)
    emUnidades(g, 1, CAO_ORIGEM_PX - pino[0] * PX, CAO_ORIGEM_PX + pino[1] * PX)
    desenhar(g)
    return canvas
  }
  const pendurada = (desenhar: (g: CanvasRenderingContext2D) => void, largura: number, altura: number) => {
    const [canvas, g] = tela(largura, altura)
    emUnidades(g, 1, largura / 2, PECA_ORIGEM_Y_PX)
    desenhar(g)
    return canvas
  }
  return {
    roxa: arma(desenharPistolaRoxa, 1),
    aco: arma(desenharRevolverDeAco, 1),
    mascaraRoxa: arma(pintarMascaraDaRoxa, MASCARA_FATOR),
    mascaraAco: arma(pintarMascaraDoAco, MASCARA_FATOR),
    caoRoxo: cao(desenharCaoRoxo, ROXA.pinoDoCao),
    caoDeAco: cao(desenharCaoDeAco, ACO.pinoDoCao),
    corrente: pendurada(desenharCorrente, CORRENTE_LARGURA_PX, CORRENTE_ALTURA_PX),
    pingente: pendurada(desenharPingente, PINGENTE_LARGURA_PX, PINGENTE_ALTURA_PX),
  }
}

/** A arma inteira num canvas só (cão, corpo e, na roxa, a corrente pendurada), para o protótipo mostrar de perto. */
export function retratoDaArma(qual: 'roxa' | 'aco'): HTMLCanvasElement {
  const pecas = pintarAsPecas()
  const arma = qual === 'roxa' ? ROXA : ACO
  const [canvas, g] = tela(ARMA_LARGURA_PX, ARMA_ALTURA_PX + 320)
  const pino = (p: Ponto): Ponto => [ORIGEM_X_PX + p[0] * PX, ORIGEM_Y_PX - p[1] * PX]
  const [cx, cy] = pino(arma.pinoDoCao)
  g.drawImage(qual === 'roxa' ? pecas.caoRoxo : pecas.caoDeAco, cx - CAO_ORIGEM_PX, cy - CAO_ORIGEM_PX)
  g.drawImage(qual === 'roxa' ? pecas.roxa : pecas.aco, 0, 0)
  if (qual === 'roxa') {
    const [ax, ay] = pino(ANEL_DA_ROXA)
    g.drawImage(pecas.corrente, ax - CORRENTE_LARGURA_PX / 2, ay - PECA_ORIGEM_Y_PX)
    g.drawImage(pecas.pingente, ax - PINGENTE_LARGURA_PX / 2, ay + COMPRIMENTO_DA_CORRENTE * PX - PECA_ORIGEM_Y_PX)
  }
  return canvas
}

/** Quatro tufos de fumaça num atlas 2 × 2 (só o alfa importa). */
function pintarFumaca(THREE: ThreeModule): Three.CanvasTexture {
  const [canvas, g] = tela(512, 512)
  const rnd = semente(5150)
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * 256 + 128
    const oy = Math.floor(v / 2) * 256 + 128
    for (let i = 0; i < 46; i++) {
      const angulo = rnd() * Math.PI * 2
      const distancia = Math.pow(rnd(), 0.7) * 60
      const x = ox + Math.cos(angulo) * distancia
      const y = oy + Math.sin(angulo) * distancia * 0.85
      const r = 20 + rnd() * 42
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      grd.addColorStop(0, `rgba(255, 255, 255, ${(0.14 + rnd() * 0.14).toFixed(3)})`)
      grd.addColorStop(1, 'rgba(255, 255, 255, 0)')
      g.fillStyle = grd
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }
  return new THREE.CanvasTexture(canvas)
}

/** Uma máscara de uma cor só (o cão, a corrente e o pingente são metal do começo ao fim). */
function mascaraLisa(THREE: ThreeModule, cor: string): Three.CanvasTexture {
  const [canvas, g] = tela(4, 4)
  g.fillStyle = cor
  g.fillRect(0, 0, 4, 4)
  return new THREE.CanvasTexture(canvas)
}

interface NomePintado {
  textura: Three.CanvasTexture
  /** Largura do texto (com a régua) em fração da largura da textura. */
  fracao: number
  /** Altura da régua de pólvora em v da textura. */
  regua: number
}

/** O nome em ouro rosa sobre um halo escuro, com a régua de pólvora embaixo (um losango no meio). */
function pintarNome(THREE: ThreeModule, nome: string): NomePintado {
  const [canvas, g] = tela(NOME_LARGURA_PX, NOME_ALTURA_PX)
  const fonte = (px: number) => `700 ${px}px ${FONTE_DO_NOME}`
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
  const base = NOME_ALTURA_PX * 0.42 + (subida - descida) / 2
  const topo = base - subida
  const yRegua = base + descida + Math.max(18, px * 0.2)
  const meia = Math.min(NOME_LARGURA_PX / 2 - 40, medida.width / 2 + px * 0.3)
  const regua = new Path2D()
  regua.moveTo(cx - meia, yRegua)
  regua.lineTo(cx - px * 0.09, yRegua - px * 0.016)
  regua.lineTo(cx, yRegua - px * 0.06)
  regua.lineTo(cx + px * 0.09, yRegua - px * 0.016)
  regua.lineTo(cx + meia, yRegua)
  regua.lineTo(cx + px * 0.09, yRegua + px * 0.016)
  regua.lineTo(cx, yRegua + px * 0.06)
  regua.lineTo(cx - px * 0.09, yRegua + px * 0.016)
  regua.closePath()
  g.lineJoin = 'round'
  g.save()
  g.shadowColor = 'rgba(0, 0, 0, 0.88)'
  g.shadowBlur = px * 0.34
  g.fillStyle = 'rgba(0, 0, 0, 0.62)'
  g.fillText(nome, cx, base)
  g.fill(regua)
  g.restore()
  const metal = (y0: number, y1: number) => {
    const grd = g.createLinearGradient(0, y0, 0, y1)
    grd.addColorStop(0, '#ffe5d6')
    grd.addColorStop(0.38, '#e2a58c')
    grd.addColorStop(0.52, '#8f4f3e')
    grd.addColorStop(0.64, '#bb735c')
    grd.addColorStop(1, '#f2bca3')
    return grd
  }
  g.strokeStyle = '#1a0c10'
  g.lineWidth = px * 0.08
  g.strokeText(nome, cx, base)
  g.lineWidth = px * 0.03
  g.stroke(regua)
  g.fillStyle = metal(topo, base + descida)
  g.fillText(nome, cx, base)
  g.fillStyle = metal(yRegua - px * 0.06, yRegua + px * 0.06)
  g.fill(regua)
  const textura = new THREE.CanvasTexture(canvas)
  return { textura, fracao: Math.min(1, (meia * 2) / NOME_LARGURA_PX), regua: 1 - yRegua / NOME_ALTURA_PX }
}

// ── Tempo e poses ────────────────────────────────────────────────────────────

const T = ROTEIRO_DOS_REVOLVERES
const R = ROTEIRO_REDUZIDO
/** De onde cada arma sobe: de baixo da tela, um pouco para fora, inclinada para fora. */
const SAQUE_DX = 0.55
const SAQUE_DY = 3.4
const SAQUE_ELEVACAO = 1.98
/** De pé, à espera: o cano para cima, a mão um pouco para fora e para baixo do lugar do X. */
const PRONTO_ELEVACAO = 1.57
const PRONTO_DX = 0.32
const PRONTO_DY = -0.16
/** O impulso para trás antes do golpe (antecipação). */
const IMPULSO = 0.1
/** Quanto o cano volta depois de bater no outro. */
const REBOTE = 0.09

interface Pose {
  /** A mão (origem do desenho) no mundo. */
  x: number
  y: number
  /** O ângulo do cano acima da horizontal, para o lado em que ele aponta. */
  elevacao: number
  /** A rotação da arma no mundo (a espelhada gira ao contrário). */
  angulo: number
}

export interface PoseDaArma extends Pose {
  /** O cão: 0 = descansado, positivo = para trás. */
  cao: number
  /** O tambor do aço (rad; uma câmara = π/3). */
  tambor: number
  /** O coice ao longo do cano (unidades do mundo). */
  recuo: number
  opacidade: number
}

function girar(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c - y * s, x * s + y * c]
}

/** Um ponto do desenho (unidades da arma) no mundo, para a pose dada. */
function noMundo(arma: Arma, pose: Pose, p: Ponto): [number, number] {
  const [dx, dy] = girar(p[0] * ESCALA * arma.espelho, p[1] * ESCALA, pose.angulo)
  return [pose.x + dx, pose.y + dy]
}

/** Onde a mão fica com os canos cruzados no ponto `centro`. */
function maoFinal(arma: Arma, centro: Ponto): Ponto {
  const [dx, dy] = girar(arma.cruza[0] * ESCALA * arma.espelho, arma.cruza[1] * ESCALA, arma.espelho * ANGULO_CRUZADO)
  return [centro[0] - dx, centro[1] - dy]
}

/** A caixa do X montado (cruzando no zero), contando a corrente pendurada e o alcance do clarão. */
function caixaDoX(): { x0: number; x1: number; y0: number; y1: number } {
  const caixa = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
  const somar = (x: number, y: number) => {
    caixa.x0 = Math.min(caixa.x0, x)
    caixa.x1 = Math.max(caixa.x1, x)
    caixa.y0 = Math.min(caixa.y0, y)
    caixa.y1 = Math.max(caixa.y1, y)
  }
  for (const arma of [ROXA, ACO]) {
    const [x, y] = maoFinal(arma, [0, 0])
    const pose: Pose = { x, y, elevacao: ANGULO_CRUZADO, angulo: arma.espelho * ANGULO_CRUZADO }
    for (const p of arma.contorno) somar(...noMundo(arma, pose, p))
    somar(...noMundo(arma, pose, [arma.boca[0] + 0.5, arma.boca[1]]))
    // No coice a boca sobe: o clarão não pode sair pelo alto da tela.
    const [hx, hy] = maoFinal(arma, [0, 0])
    const coiceAlto: Pose = { x: hx, y: hy, elevacao: ANGULO_CRUZADO + arma.subida, angulo: arma.espelho * (ANGULO_CRUZADO + arma.subida) }
    somar(...noMundo(arma, coiceAlto, [arma.boca[0] + 0.3, arma.boca[1] + 0.12]))
    if (arma === ROXA) {
      const [ax, ay] = noMundo(arma, pose, ANEL_DA_ROXA)
      somar(ax, ay - QUEDA_DO_PINGENTE * ESCALA)
    }
  }
  return caixa
}

const CAIXA_DO_X = caixaDoX()
const MEIA_LARGURA_DO_X = (CAIXA_DO_X.x1 - CAIXA_DO_X.x0) / 2
const MEIA_ALTURA_DO_X = (CAIXA_DO_X.y1 - CAIXA_DO_X.y0) / 2
/** O ponto onde os canos se cruzam, escolhido para o meio da caixa do X cair no zero do mundo. */
const CENTRO: Ponto = [-(CAIXA_DO_X.x0 + CAIXA_DO_X.x1) / 2, -(CAIXA_DO_X.y0 + CAIXA_DO_X.y1) / 2]

/** Ida e volta rápida que vale 1 em `pico` segundos. */
function pancada(tau: number, pico: number): number {
  if (tau <= 0) return 0
  return (tau / pico) * Math.exp(1 - tau / pico)
}

/** O coice: sobe em `sobe` segundos e volta em `cai`, com pico 1. */
function coice(tau: number, sobe: number, cai: number): number {
  if (tau <= 0) return 0
  const pico = sobe * Math.log(1 + cai / sobe)
  const norma = (1 - Math.exp(-pico / sobe)) * Math.exp(-pico / cai)
  return ((1 - Math.exp(-tau / sobe)) * Math.exp(-tau / cai)) / norma
}

/** O cano bate no outro e volta um pouco, amortecido. */
function rebote(tau: number): number {
  return tau <= 0 ? 0 : Math.exp(-tau * 16) * Math.sin(tau * 44)
}

function temposDa(arma: Arma, reduzir: boolean): { engatilha: number; tiro: number; giroInicio: number; giroFim: number } {
  const roxa = arma === ROXA
  if (reduzir) return { engatilha: roxa ? R.engatilhaRoxa : R.engatilhaAco, tiro: roxa ? R.tiroRoxa : R.tiroAco, giroInicio: R.giroInicio, giroFim: R.giroFim }
  return { engatilha: roxa ? T.engatilhaRoxa : T.engatilhaAco, tiro: roxa ? T.tiroRoxa : T.tiroAco, giroInicio: T.giroInicio, giroFim: T.giroFim }
}

/** O cão vai para trás em 75 ms ao engatilhar e cai de uma vez logo antes do tiro. */
function anguloDoCao(t: number, engatilha: number, tiro: number, armado: number): number {
  const arma = easeInOutSine(span(t, engatilha, engatilha + 0.075))
  const cai = easeInQuad(span(t, tiro - 0.03, tiro - 0.012))
  return armado * arma * (1 - cai)
}

function poseDe(arma: Arma, t: number, reduzir: boolean, centro: Ponto): PoseDaArma {
  const [fx, fy] = maoFinal(arma, centro)
  const { engatilha, tiro, giroInicio, giroFim } = temposDa(arma, reduzir)
  const cao = anguloDoCao(t, engatilha, tiro, arma.caoArmado)
  const tambor = arma === ACO ? (Math.PI / 3) * easeInOutSine(span(t, giroInicio, giroFim)) : 0
  if (reduzir) {
    const opacidade = easeInOutSine(span(t, R.surgeInicio, R.surgeFim))
    return { x: fx, y: fy, elevacao: ANGULO_CRUZADO, angulo: arma.espelho * ANGULO_CRUZADO, cao, tambor, recuo: 0, opacidade }
  }
  let x = fx
  let y = fy
  let e = ANGULO_CRUZADO
  if (t < T.tranco) {
    // Sobe e para de pé (freando); toma impulso para trás; desce acelerando até bater (é isso que faz o tranco).
    const s = easeOutCubic(span(t, T.saqueInicio, T.pronto))
    const impulso = easeInOutSine(span(t, T.pronto + 0.02, T.golpe))
    const u = span(t, T.golpe, T.tranco)
    const golpe = u * u
    const xPronto = fx + arma.lado * (PRONTO_DX + SAQUE_DX * (1 - s))
    const yPronto = fy + PRONTO_DY - SAQUE_DY * (1 - s) - 0.03 * impulso
    const ePronto = PRONTO_ELEVACAO + (SAQUE_ELEVACAO - PRONTO_ELEVACAO) * (1 - s) + IMPULSO * impulso
    x = xPronto + (fx - xPronto) * golpe
    y = yPronto + (fy - yPronto) * golpe
    e = ePronto + (ANGULO_CRUZADO - ePronto) * golpe
  } else {
    const tau = t - T.tranco
    e += REBOTE * rebote(tau)
    x += arma.lado * 0.035 * pancada(tau, 0.028)
  }
  // O polegar puxando o cão abaixa a boca um pouquinho.
  e -= 0.016 * pancada(t - engatilha, 0.05)
  // A mão tensa entre o engatilhar e o tiro: um tremor miúdo.
  const tensao = span(t, T.tranco + 0.3, T.tranco + 0.5) * (1 - span(t, tiro - 0.03, tiro))
  e += 0.0028 * tensao * Math.sin(t * 31 + arma.lado)
  y += 0.0035 * tensao * Math.sin(t * 23 + 2 * arma.lado)
  // O coice: a arma recua ao longo do cano e a boca sobe.
  let recuo = 0
  if (t > tiro) {
    recuo = arma.recuo * coice(t - tiro, 0.006, 0.11)
    e += arma.subida * coice(t - tiro, 0.014, 0.16)
  }
  x -= recuo * arma.espelho * Math.cos(e)
  y -= recuo * Math.sin(e)
  return { x, y, elevacao: e, angulo: arma.espelho * e, cao, tambor, recuo, opacidade: 1 }
}

/** A pose das duas armas no instante `t` (exportada para o gráfico do movimento). */
export function poseDasArmas(t: number, reduzir: boolean): { roxa: PoseDaArma; aco: PoseDaArma } {
  return { roxa: poseDe(ROXA, t, reduzir, CENTRO), aco: poseDe(ACO, t, reduzir, CENTRO) }
}

/**
 * A corrente da roxa: dois pêndulos amortecidos (a corrente e o pingente na
 * ponta dela) puxados pela aceleração do anel do cabo. Integrado a passo fixo
 * desde o zero, então o mesmo `t` dá sempre o mesmo ângulo (a miniatura não
 * varia); voltar no tempo recomeça a conta. Devolve [corrente, pingente] em
 * rad a partir da vertical.
 */
export function criarCorrente(reduzir: boolean): (t: number) => [number, number] {
  const centro = CENTRO
  const L1 = COMPRIMENTO_DA_CORRENTE * ESCALA
  const L2 = 0.075 * ESCALA
  const G = 60
  const AMORTECE_1 = 3.4
  const AMORTECE_2 = 5
  const DT = 1 / 240
  /** O coice e o saque são bruscos demais para um pêndulo de verdade: só uma parte da aceleração passa. */
  const REPASSE = 0.32
  const LIMITE = 1.25
  const anel = (t: number) => noMundo(ROXA, poseDe(ROXA, t, false, centro), ANEL_DA_ROXA)
  let tempo = 0
  let a1 = 0
  let v1 = 0
  let a2 = 0
  let v2 = 0
  return (t: number) => {
    if (reduzir) {
      const s = 0.02 * Math.sin(t * 2.1)
      return [s, s * 1.4]
    }
    if (t < tempo - 1e-9) {
      tempo = 0
      a1 = v1 = a2 = v2 = 0
    }
    while (tempo + DT <= t) {
      const p0 = anel(tempo - DT)
      const p1 = anel(tempo)
      const p2 = anel(tempo + DT)
      const ax = ((p2[0] - 2 * p1[0] + p0[0]) / (DT * DT)) * REPASSE
      const ay = ((p2[1] - 2 * p1[1] + p0[1]) / (DT * DT)) * REPASSE
      const acc1 = -(G / L1) * Math.sin(a1) - (ax * Math.cos(a1) + ay * Math.sin(a1)) / L1 - AMORTECE_1 * v1
      const ex = ax + L1 * (acc1 * Math.cos(a1) - v1 * v1 * Math.sin(a1))
      const ey = ay + L1 * (acc1 * Math.sin(a1) + v1 * v1 * Math.cos(a1))
      const acc2 = -(G / L2) * Math.sin(a2) - (ex * Math.cos(a2) + ey * Math.sin(a2)) / L2 - AMORTECE_2 * v2
      v1 += acc1 * DT
      a1 += v1 * DT
      if (Math.abs(a1) > LIMITE) {
        a1 = Math.sign(a1) * LIMITE
        v1 *= -0.3
      }
      v2 += acc2 * DT
      a2 += v2 * DT
      if (Math.abs(a2 - a1) > LIMITE) {
        a2 = a1 + Math.sign(a2 - a1) * LIMITE
        v2 *= -0.3
      }
      tempo += DT
    }
    return [a1, a2]
  }
}

/** O clarão de boca: acende num quadro e some em ~3 quadros. */
function clarao(t: number, tiro: number): number {
  const tau = t - tiro
  if (tau < 0) return 0
  return Math.exp(-tau / 0.028) * easeOutCubic(clamp01(tau / 0.006))
}

/** A luz que o tiro joga na cena: o estouro e uma brasa que fica na fumaça. */
function luzDoTiro(t: number, tiro: number, reduzir: boolean): number {
  const tau = t - tiro
  if (tau < 0) return 0
  if (reduzir) return 0.9 * Math.exp(-tau / 0.2) * easeInOutSine(clamp01(tau / 0.06))
  return clarao(t, tiro) * 2.8 + 0.28 * Math.exp(-tau / 0.22) * clamp01(tau / 0.01)
}

/** O cano quente: acende com o tiro e esfria devagar. */
function calorDoCano(t: number, tiro: number): number {
  const tau = t - tiro
  return tau < 0 ? 0 : (1 - Math.exp(-tau / 0.04)) * Math.exp(-tau / 1.0)
}

/** A luz da cena: sobe na entrada, baixa um pouco na tensão antes do tiro e apaga no fim. */
function luzDaCena(t: number, reduzir: boolean): number {
  if (reduzir) return (0.12 + 0.88 * easeInOutSine(span(t, 0.02, 0.6))) * (1 - 0.82 * easeInOutSine(span(t, R.apagaInicio, R.apagaFim)))
  const sobe = easeOutCubic(span(t, 0.02, 0.6))
  const tensao = 1 - 0.16 * easeInOutSine(span(t, T.engatilhaRoxa, T.silencio + 0.1)) * (1 - span(t, T.tiroAco, T.tiroAco + 0.3))
  return (0.12 + 0.88 * sobe) * tensao * (1 - 0.82 * easeInOutSine(span(t, T.apagaInicio, T.apagaFim)))
}

interface EstadoDaCamera {
  x: number
  y: number
  z: number
  giro: number
}

/** A câmera olha reto; o X fica na altura `ndcDoX` da tela porque a câmera desce (ou sobe) o tanto certo. */
function estadoDaCamera(t: number, reduzir: boolean, distancia: number, ndcDoX: number): EstadoDaCamera {
  if (reduzir) return { x: 0, y: -ndcDoX * distancia * TAN_MEIO_FOV, z: distancia, giro: 0 }
  const escala = distancia / DISTANCIA_BASE
  // Chega devagar até o tiro (a tensão) e continua bem pouco depois.
  let z = distancia * (1.06 - 0.06 * easeInOutSine(span(t, 0.3, T.tiroAco)) - 0.03 * easeInOutSine(span(t, T.tiroRoxa + 0.15, T.duracao)))
  z -= escala * (0.12 * pancada(t - T.tranco, 0.025) + 0.2 * pancada(t - T.tiroAco, 0.03) + 0.24 * pancada(t - T.tiroRoxa, 0.032))
  let x = 0.022 * escala * Math.sin(t * 0.6 + 0.3)
  let y = 0.014 * escala * Math.sin(t * 0.85) - ndcDoX * z * TAN_MEIO_FOV
  let giro = 0
  for (const [quando, forca] of [
    [T.tranco, 0.05],
    [T.tiroAco, 0.075],
    [T.tiroRoxa, 0.09],
  ] as const) {
    const tau = t - quando
    if (tau <= 0) continue
    const a = forca * escala * Math.exp(-tau * 17)
    x += a * (Math.sin(tau * 97 + quando * 10) + 0.5 * Math.sin(tau * 163))
    y += a * 0.8 * (Math.cos(tau * 89 + quando * 7) + 0.5 * Math.sin(tau * 141))
    giro += 0.16 * a * Math.sin(tau * 73 + quando)
  }
  return { x, y, z, giro }
}

function fadeDosRevolveres(t: number, reduzir: boolean): number {
  const entrada = 1 - easeOutCubic(span(t, 0, T.fadeInFim))
  const saida = easeInOutSine(span(t, reduzir ? R.fadeOutInicio : T.fadeOutInicio, T.duracao))
  return Math.max(entrada, saida)
}

// ── Partículas ───────────────────────────────────────────────────────────────

type Descartavel = { dispose: () => void }
type Guardar = <X extends Descartavel>(x: X) => X

/** Mistura pré-multiplicada (a saída dos shaders já vem multiplicada pelo alfa; alfa 0 = soma de luz). */
function materialPorCima(THREE: ThreeModule, vertexShader: string, fragmentShader: string, uniforms: Record<string, Three.IUniform>, defines?: Record<string, string>): Three.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    defines: defines ?? {},
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  })
}

interface Riscos {
  malha: Three.Mesh
  /** Cabeça em (x, y); a cauda vai para trás na direção (dx, dy). */
  definir: (i: number, x: number, y: number, dx: number, dy: number, comprimento: number, largura: number, r: number, g: number, b: number) => void
  esconder: (i: number) => void
  enviar: () => void
}

function criarRiscos(THREE: ThreeModule, n: number, guardar: Guardar): Riscos {
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
  const malha = new THREE.Mesh(geo, guardar(materialPorCima(THREE, VERTICE_RISCO, FRAG_RISCO, {})))
  malha.frustumCulled = false
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
      pos.set([tx + nx, ty + ny, 0, tx - nx, ty - ny, 0, x - nx, y - ny, 0, x + nx, y + ny, 0], i * 12)
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

interface Nuvens {
  malha: Three.Mesh
  definir: (i: number, x: number, y: number, tamanho: number, giro: number, variante: number, r: number, g: number, b: number, a: number) => void
  esconder: (i: number) => void
  enviar: () => void
}

function criarNuvens(THREE: ThreeModule, n: number, textura: Three.Texture, guardar: Guardar): Nuvens {
  const pos = new Float32Array(n * 12)
  const cor = new Float32Array(n * 16)
  const uv = new Float32Array(n * 8)
  const indices: number[] = []
  for (let i = 0; i < n; i++) {
    const v = i * 4
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3)
  }
  const geo = guardar(new THREE.BufferGeometry())
  const atributoPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
  const atributoCor = new THREE.BufferAttribute(cor, 4).setUsage(THREE.DynamicDrawUsage)
  const atributoUv = new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', atributoPos)
  geo.setAttribute('cor', atributoCor)
  geo.setAttribute('uv', atributoUv)
  geo.setIndex(indices)
  const malha = new THREE.Mesh(geo, guardar(materialPorCima(THREE, VERTICE_NUVEM, FRAG_NUVEM, { uFumaca: { value: textura } })))
  malha.frustumCulled = false
  const cantos = [
    [-1, -1, 0, 0],
    [-1, 1, 0, 1],
    [1, 1, 1, 1],
    [1, -1, 1, 0],
  ] as const
  return {
    malha,
    definir(i, x, y, tamanho, giro, variante, r, g, b, a) {
      const c = Math.cos(giro) * tamanho * 0.5
      const s = Math.sin(giro) * tamanho * 0.5
      const u0 = (variante % 2) * 0.5
      const v0 = Math.floor(variante / 2) * 0.5
      cantos.forEach(([cx, cy, cu, cv], k) => {
        pos.set([x + cx * c - cy * s, y + cx * s + cy * c, 0], i * 12 + k * 3)
        uv.set([u0 + cu * 0.5, v0 + cv * 0.5], i * 8 + k * 2)
        cor.set([r, g, b, a], i * 16 + k * 4)
      })
    },
    esconder(i) {
      pos.fill(0, i * 12, i * 12 + 12)
      cor.fill(0, i * 16, i * 16 + 16)
    },
    enviar() {
      atributoPos.needsUpdate = true
      atributoCor.needsUpdate = true
      atributoUv.needsUpdate = true
    },
  }
}

interface Faisca {
  t0: number
  x0: number
  y0: number
  vx: number
  vy: number
  arrasto: number
  gravidade: number
  vida: number
  largura: number
  cor: readonly [number, number, number]
  fim: readonly [number, number, number]
}

interface Nuvem {
  t0: number
  x0: number
  y0: number
  vx: number
  vy: number
  arrasto: number
  sobe: number
  s0: number
  s1: number
  cresce: number
  alfa: number
  vida: number
  giro0: number
  giroV: number
  variante: number
  /** 1 = nasce acesa pelo clarão. */
  quente: number
  balanco: number
  fase: number
  tom: readonly [number, number, number]
}

// ── Cena ─────────────────────────────────────────────────────────────────────

export function criarCenaRevolveresCruzados(THREE: ThreeModule, opcoes: OpcoesDosRevolveres): CenaTransicao {
  const reduzir = opcoes.reduzirMovimento
  const nomeLimpo = nomeDaBatalha(opcoes.nome)
  const comNome = nomeLimpo !== ''
  /** Onde os canos se cruzam (o meio da caixa do X é o zero do mundo). */
  const centro = CENTRO
  const ndcDoX = comNome ? X_NDC_COM_NOME : 0
  const lixo: Descartavel[] = []
  const guardar: Guardar = (x) => {
    lixo.push(x)
    return x
  }
  const v2 = (x: number, y: number) => new THREE.Vector2(x, y)
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const tiroAco = reduzir ? R.tiroAco : T.tiroAco
  const tiroRoxa = reduzir ? R.tiroRoxa : T.tiroRoxa
  const tranco = reduzir ? R.tranco : T.tranco

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 60)
  scene.add(camera)
  let aspecto = 16 / 9
  let distancia = DISTANCIA_BASE

  // O que vários materiais leem juntos.
  const uTempo = { value: 0 }
  const uLuz = { value: 0 }
  const uLuzes = { value: [v3(0, 0, 0), v3(0, 0, 0), v3(0, 0, 0)] }
  const uCoresDasLuzes = { value: [v3(1, 0.86, 0.72), v3(1, 0.68, 0.34), v3(1, 0.6, 0.82)] }
  const uBrilho = { value: -9 }
  const uForcaDoBrilho = { value: 0 }
  const uDirecaoDoBrilho = { value: v2(0, 1) }

  const fundo = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(30, 17)),
    guardar(
      new THREE.ShaderMaterial({
        vertexShader: VERTICE_MUNDO,
        fragmentShader: FRAG_FUNDO,
        uniforms: { uTempo, uLuz, uLuzes, uCoresDasLuzes, uCentro: { value: v2(0, 0) } },
        depthTest: false,
        depthWrite: false,
      }),
    ),
  )
  fundo.position.set(0, 0, Z_FUNDO)
  fundo.renderOrder = 0
  fundo.frustumCulled = false
  scene.add(fundo)

  // As peças pintadas.
  const pintadas = pintarAsPecas()
  const textura = (canvas: HTMLCanvasElement, anisotropia = 1) => {
    const t = guardar(new THREE.CanvasTexture(canvas))
    t.anisotropy = anisotropia
    return t
  }
  const corRoxa = textura(pintadas.roxa, 4)
  const corAco = textura(pintadas.aco, 4)
  const mascaraRoxa = textura(pintadas.mascaraRoxa)
  const mascaraAco = textura(pintadas.mascaraAco)
  const mascaraDeOuro = guardar(mascaraLisa(THREE, 'rgb(255, 255, 0)'))
  const mascaraDeAco = guardar(mascaraLisa(THREE, 'rgb(190, 0, 0)'))

  const uv = (p: Ponto) => v2((ORIGEM_X_PX + p[0] * PX) / ARMA_LARGURA_PX, 1 - (ORIGEM_Y_PX - p[1] * PX) / ARMA_ALTURA_PX)
  const geoArma = guardar(new THREE.PlaneGeometry(ARMA_LARGURA_PX / PX, ARMA_ALTURA_PX / PX))
  geoArma.translate((ARMA_LARGURA_PX / 2 - ORIGEM_X_PX) / PX, (ORIGEM_Y_PX - ARMA_ALTURA_PX / 2) / PX, 0)
  const geoCao = guardar(new THREE.PlaneGeometry(CAO_PX / PX, CAO_PX / PX))
  geoCao.translate((CAO_PX / 2 - CAO_ORIGEM_PX) / PX, (CAO_ORIGEM_PX - CAO_PX / 2) / PX, 0)
  const pendurada = (largura: number, altura: number) => {
    const geo = guardar(new THREE.PlaneGeometry(largura / PX, altura / PX))
    geo.translate(0, (PECA_ORIGEM_Y_PX - altura / 2) / PX, 0)
    return geo
  }

  const uniformesDaPeca = (cor: Three.Texture, mascara: Three.Texture, brilho: Three.Vector3, boca: Three.Vector2, quente: Three.Vector3) => ({
    uCor: { value: cor },
    uMascara: { value: mascara },
    uOpacidade: { value: 1 },
    uLuz,
    uBrilho,
    uForcaDoBrilho,
    uDirecaoDoBrilho,
    uCorDoBrilho: { value: brilho },
    uLuzes,
    uCoresDasLuzes,
    uBoca: { value: boca },
    uQuente: { value: 0 },
    uCorQuente: { value: quente },
    uSombraLinha: { value: new THREE.Vector4(0, 0, 1, 0) },
    uSombraTrecho: { value: v2(0, 1) },
    uSombraRaio: { value: CANOS_DA_ROXA.raio * ESCALA },
    uSombra: { value: 0 },
    uGiro: { value: 0 },
    uTambor: { value: new THREE.Vector4(0, 0, 1, 1) },
  })
  type UniformesDaPeca = ReturnType<typeof uniformesDaPeca>

  interface Montagem {
    arma: Arma
    grupo: Three.Group
    corpo: UniformesDaPeca
    cao: Three.Mesh
    caoU: UniformesDaPeca
    rastros: { grupo: Three.Group; u: { uCor: { value: Three.Texture }; uOpacidade: { value: number }; uLuz: { value: number } } }[]
    clarao: Three.Mesh
    uClarao: { uForca: { value: number }; uFase: { value: number }; uSemente: { value: number }; uSeparacao: { value: number }; uMiolo: { value: Three.Vector3 }; uMeio: { value: Three.Vector3 }; uBorda: { value: Three.Vector3 } }
    uHalo: { uForca: { value: number }; uCor: { value: Three.Vector3 } }
  }

  const montar = (arma: Arma, cor: Three.Texture, mascara: Three.Texture, caoTex: Three.Texture, ordem: number): Montagem => {
    const roxa = arma === ROXA
    const brilho = roxa ? v3(0.95, 0.85, 1.0) : v3(0.85, 0.88, 0.92)
    const quente = roxa ? v3(1.0, 0.32, 0.5) : v3(1.0, 0.36, 0.1)
    // O rastro do saque: duas cópias atrás, só enquanto a arma voa.
    const rastros = [0, 1].map(() => {
      const u = { uCor: { value: cor }, uOpacidade: { value: 0 }, uLuz }
      const grupo = new THREE.Group()
      const m = new THREE.Mesh(geoArma, guardar(materialPorCima(THREE, VERTICE, FRAG_RASTRO, u)))
      m.renderOrder = ordem
      m.frustumCulled = false
      grupo.add(m)
      grupo.scale.set(ESCALA * arma.espelho, ESCALA, 1)
      // Visível até o primeiro quadro: o motor compila os shaders antes do relógio, e só compila o que está visível.
      grupo.visible = true
      scene.add(grupo)
      return { grupo, u }
    })
    const grupo = new THREE.Group()
    grupo.scale.set(ESCALA * arma.espelho, ESCALA, 1)
    grupo.position.z = arma.z
    scene.add(grupo)
    const caoU = uniformesDaPeca(caoTex, roxa ? mascaraDeOuro : mascaraDeAco, brilho, v2(-9, -9), quente)
    const cao = new THREE.Mesh(geoCao, guardar(materialPorCima(THREE, VERTICE_ARMA, FRAG_ARMA, caoU)))
    cao.position.set(arma.pinoDoCao[0], arma.pinoDoCao[1], -0.001)
    cao.renderOrder = ordem + 1
    cao.frustumCulled = false
    grupo.add(cao)
    const corpo = uniformesDaPeca(cor, mascara, brilho, uv(arma.boca), quente)
    if (!roxa) {
      const a = uv([-0.215, 0.09])
      const b = uv([0.475, 0.53])
      corpo.uTambor.value.set(a.x, a.y, b.x, b.y)
    }
    const malhaDoCorpo = new THREE.Mesh(geoArma, guardar(materialPorCima(THREE, VERTICE_ARMA, FRAG_ARMA, corpo, roxa ? undefined : { ACO: '' })))
    malhaDoCorpo.renderOrder = ordem + 2
    malhaDoCorpo.frustumCulled = false
    grupo.add(malhaDoCorpo)

    // O clarão e a luz no ar: presos na boca, então seguem o coice.
    const uClarao = {
      uForca: { value: 0 },
      uFase: { value: 0 },
      uSemente: { value: 0 },
      uSeparacao: { value: roxa ? 0.165 : 0 },
      uMiolo: { value: roxa ? v3(1, 0.96, 1) : v3(1, 0.98, 0.9) },
      uMeio: { value: roxa ? v3(1, 0.72, 0.86) : v3(1, 0.78, 0.35) },
      uBorda: { value: roxa ? v3(0.72, 0.32, 1.0) : v3(1, 0.42, 0.08) },
    }
    const geoClarao = guardar(new THREE.PlaneGeometry(2.4, 1.5))
    geoClarao.translate(0.95, 0, 0)
    const clarao = new THREE.Mesh(geoClarao, guardar(materialPorCima(THREE, VERTICE_LOCAL, FRAG_CLARAO, uClarao)))
    clarao.position.set(arma.boca[0], arma.boca[1], 0.02)
    clarao.renderOrder = 30
    clarao.frustumCulled = false
    clarao.visible = true
    grupo.add(clarao)
    const uHalo = { uForca: { value: 0 }, uCor: { value: roxa ? v3(0.9, 0.42, 0.8) : v3(1, 0.55, 0.2) } }
    const halo = new THREE.Mesh(guardar(new THREE.PlaneGeometry(4.4, 4.4)), guardar(materialPorCima(THREE, VERTICE_LOCAL, FRAG_HALO, uHalo)))
    halo.position.set(arma.boca[0] + 0.12, arma.boca[1], 0.02)
    halo.renderOrder = 29
    halo.frustumCulled = false
    grupo.add(halo)
    return { arma, grupo, corpo, cao, caoU, rastros, clarao, uClarao, uHalo }
  }

  // O aço vai atrás (desenhado primeiro); a roxa cruza por cima.
  const aco = montar(ACO, corAco, mascaraAco, textura(pintadas.caoDeAco, 2), 1)
  const roxa = montar(ROXA, corRoxa, mascaraRoxa, textura(pintadas.caoRoxo, 2), 5)

  // O leque da fresta do tambor (só o aço).
  const uLeque = { uForca: { value: 0 }, uCor: { value: v3(1, 0.7, 0.32) } }
  const leque = new THREE.Mesh(guardar(new THREE.PlaneGeometry(0.24, 0.8)), guardar(materialPorCima(THREE, VERTICE_LOCAL, FRAG_LEQUE, uLeque)))
  leque.position.set(FRESTA_DO_ACO[0], FRESTA_DO_ACO[1], 0.02)
  leque.renderOrder = 30
  leque.frustumCulled = false
  leque.visible = !reduzir
  aco.grupo.add(leque)

  // A corrente e o pingente da roxa, pendurados no mundo (a gravidade é do mundo, não da arma).
  const corrente = criarCorrente(reduzir)
  const pecaPendurada = (canvas: HTMLCanvasElement, largura: number, altura: number, ordem: number) => {
    const u = uniformesDaPeca(textura(canvas, 2), mascaraDeOuro, v3(0.95, 0.85, 1.0), v2(-9, -9), v3(0, 0, 0))
    const m = new THREE.Mesh(pendurada(largura, altura), guardar(materialPorCima(THREE, VERTICE_ARMA, FRAG_ARMA, u)))
    m.scale.setScalar(ESCALA)
    m.renderOrder = ordem
    m.frustumCulled = false
    scene.add(m)
    return { m, u }
  }
  const elo = pecaPendurada(pintadas.corrente, CORRENTE_LARGURA_PX, CORRENTE_ALTURA_PX, 8)
  const pingente = pecaPendurada(pintadas.pingente, PINGENTE_LARGURA_PX, PINGENTE_ALTURA_PX, 9)

  // O brilho de metal do tranco, no cruzamento.
  const uFagulha = { uForca: { value: 0 }, uAngulo: { value: ANGULO_CRUZADO }, uCor: { value: v3(1, 0.9, 0.78) } }
  const fagulha = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1.4, 1.4)), guardar(materialPorCima(THREE, VERTICE_LOCAL, FRAG_FAGULHA, uFagulha)))
  fagulha.position.set(centro[0], centro[1], 0.12)
  fagulha.renderOrder = 31
  fagulha.frustumCulled = false
  scene.add(fagulha)

  // As poses na hora de cada tiro: de onde saem as faíscas e a fumaça.
  const bocaNoTiro = (m: Montagem, tiro: number, boca: Ponto) => {
    const pose = poseDe(m.arma, tiro, reduzir, centro)
    const [x, y] = noMundo(m.arma, pose, boca)
    const angulo = Math.atan2(Math.sin(pose.elevacao), m.arma.espelho * Math.cos(pose.elevacao))
    return { x, y, angulo }
  }
  const tiroDoAco = bocaNoTiro(aco, tiroAco, ACO.boca)
  const frestaDoAco = bocaNoTiro(aco, tiroAco, FRESTA_DO_ACO)
  const tirosDaRoxa = ROXA.bocas.map((b) => bocaNoTiro(roxa, tiroRoxa, b))

  // Faíscas: do tranco (para cima e para baixo do cruzamento), das bocas (num cone) e da fresta (de través).
  const rnd = semente(6007)
  const faiscas: Faisca[] = []
  const QUENTE: readonly [number, number, number] = [1, 0.86, 0.5]
  const BRASA: readonly [number, number, number] = [0.9, 0.28, 0.05]
  for (let i = 0; i < N_FAISCAS_TRANCO; i++) {
    const angulo = (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 1.6
    const v = 2.2 + rnd() * 4
    faiscas.push({ t0: tranco + rnd() * 0.012, x0: centro[0], y0: centro[1], vx: Math.cos(angulo) * v, vy: Math.sin(angulo) * v, arrasto: 0.09 + rnd() * 0.1, gravidade: 7, vida: 0.22 + rnd() * 0.3, largura: 0.012 + rnd() * 0.01, cor: [1, 0.92, 0.75], fim: [1, 0.45, 0.12] })
  }
  for (let i = 0; i < N_FAISCAS_ACO; i++) {
    const angulo = tiroDoAco.angulo + (rnd() + rnd() - 1) * 0.36
    const v = 4 + rnd() * 8
    faiscas.push({ t0: tiroAco + rnd() * 0.02, x0: tiroDoAco.x, y0: tiroDoAco.y, vx: Math.cos(angulo) * v, vy: Math.sin(angulo) * v, arrasto: 0.06 + rnd() * 0.14, gravidade: 3.5, vida: 0.18 + rnd() * 0.42, largura: 0.012 + rnd() * 0.012, cor: QUENTE, fim: BRASA })
  }
  for (let i = 0; i < N_FAISCAS_FRESTA; i++) {
    const angulo = frestaDoAco.angulo + (rnd() < 0.5 ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 0.6
    const v = 1.6 + rnd() * 2.4
    faiscas.push({ t0: tiroAco + rnd() * 0.008, x0: frestaDoAco.x, y0: frestaDoAco.y, vx: Math.cos(angulo) * v, vy: Math.sin(angulo) * v, arrasto: 0.05, gravidade: 3, vida: 0.08 + rnd() * 0.12, largura: 0.01, cor: QUENTE, fim: BRASA })
  }
  for (let i = 0; i < N_FAISCAS_ROXA; i++) {
    const boca = tirosDaRoxa[i % 2]
    const angulo = boca.angulo + (rnd() + rnd() - 1) * 0.38
    const v = 4 + rnd() * 8.5
    faiscas.push({ t0: tiroRoxa + rnd() * 0.02, x0: boca.x, y0: boca.y, vx: Math.cos(angulo) * v, vy: Math.sin(angulo) * v, arrasto: 0.06 + rnd() * 0.14, gravidade: 3.5, vida: 0.18 + rnd() * 0.42, largura: 0.012 + rnd() * 0.012, cor: [1, 0.82, 0.92], fim: [0.75, 0.28, 0.95] })
  }
  const riscos = criarRiscos(THREE, faiscas.length, guardar)
  riscos.malha.position.z = Z_FAISCAS
  riscos.malha.renderOrder = 28
  riscos.malha.visible = !reduzir
  scene.add(riscos.malha)

  // Fumaça: o jato de cada boca, os dois tufos da fresta e os fiapos que sobem das bocas até o fim.
  const nuvens: Nuvem[] = []
  const CINZA_DO_ACO: readonly [number, number, number] = [0.72, 0.68, 0.62]
  const CINZA_DA_ROXA: readonly [number, number, number] = [0.72, 0.66, 0.74]
  const jato = (origem: { x: number; y: number; angulo: number }, t0: number, n: number, tom: readonly [number, number, number]) => {
    for (let i = 0; i < n; i++) {
      const angulo = origem.angulo + (rnd() - 0.5) * 0.7
      const v = 1.2 + rnd() * 2.6
      nuvens.push({ t0: t0 + rnd() * 0.03, x0: origem.x, y0: origem.y, vx: Math.cos(angulo) * v, vy: Math.sin(angulo) * v, arrasto: 0.18 + rnd() * 0.22, sobe: 0.1 + rnd() * 0.16, s0: 0.1 + rnd() * 0.1, s1: 0.55 + rnd() * 0.6, cresce: 0.4 + rnd() * 0.5, alfa: 0.18 + rnd() * 0.2, vida: 1.7 + rnd() * 1.2, giro0: rnd() * 6.28, giroV: (rnd() - 0.5) * 1.2, variante: Math.floor(rnd() * 4), quente: 1, balanco: 0.02, fase: rnd() * 6.28, tom })
    }
  }
  jato(tiroDoAco, tiroAco, 20, CINZA_DO_ACO)
  for (const sinal of [1, -1]) {
    const angulo = frestaDoAco.angulo + (sinal * Math.PI) / 2
    nuvens.push({ t0: tiroAco, x0: frestaDoAco.x, y0: frestaDoAco.y, vx: Math.cos(angulo) * 0.8, vy: Math.sin(angulo) * 0.8, arrasto: 0.2, sobe: 0.12, s0: 0.05, s1: 0.28, cresce: 0.3, alfa: 0.3, vida: 1.1, giro0: rnd() * 6.28, giroV: 0.4, variante: Math.floor(rnd() * 4), quente: 1, balanco: 0.01, fase: 0, tom: CINZA_DO_ACO })
  }
  for (const boca of tirosDaRoxa) jato(boca, tiroRoxa, 11, CINZA_DA_ROXA)
  const fiapos = (m: Montagem, tiro: number, boca: Ponto, tom: readonly [number, number, number]) => {
    for (let t0 = tiro + 0.3; t0 < T.duracao - 0.35; t0 += 0.13) {
      const pose = poseDe(m.arma, t0, reduzir, centro)
      const [x, y] = noMundo(m.arma, pose, boca)
      nuvens.push({ t0, x0: x, y0: y, vx: (rnd() - 0.5) * 0.08, vy: 0.05, arrasto: 0.3, sobe: 0.26 + rnd() * 0.08, s0: 0.03, s1: 0.15 + rnd() * 0.06, cresce: 0.5, alfa: 0.15 + rnd() * 0.06, vida: 0.9, giro0: rnd() * 6.28, giroV: (rnd() - 0.5) * 0.8, variante: Math.floor(rnd() * 4), quente: 0, balanco: 0.045, fase: rnd() * 6.28, tom })
    }
  }
  fiapos(aco, tiroAco, ACO.boca, CINZA_DO_ACO)
  fiapos(roxa, tiroRoxa, ROXA.bocas[0], CINZA_DA_ROXA)
  const fumacaTex = guardar(pintarFumaca(THREE))
  const tufos = criarNuvens(THREE, nuvens.length, fumacaTex, guardar)
  tufos.malha.position.z = Z_FUMACA
  tufos.malha.renderOrder = 27
  scene.add(tufos.malha)

  // A fumaça que toma a tela no fim.
  const uFrente = { uTempo, uLuz, uDensidade: { value: 0 }, uCentro: { value: v2(0, 0) } }
  const frente = new THREE.Mesh(guardar(new THREE.PlaneGeometry(16, 9)), guardar(materialPorCima(THREE, VERTICE_MUNDO, FRAG_FUMACA_FRENTE, uFrente)))
  frente.position.set(0, 0, Z_FUMACA_FRENTE)
  frente.renderOrder = 40
  frente.frustumCulled = false
  frente.visible = true
  scene.add(frente)

  // O nome: um título diante da câmera, embaixo do X. Sem nome, o plano nem existe.
  const nome = comNome ? pintarNome(THREE, nomeLimpo) : null
  const uNome = {
    uMapa: { value: (nome ? guardar(nome.textura) : null) as Three.Texture | null },
    uFrente: { value: 0 },
    uMeia: { value: (nome?.fracao ?? 0) / 2 },
    uRegua: { value: nome?.regua ?? 0 },
    uApaga: { value: 0 },
    uLimpo: { value: reduzir ? 1 : 0 },
    uBrilho: { value: -1 },
    uTempo,
  }
  const placaDoNome = new THREE.Mesh(guardar(new THREE.PlaneGeometry(NOME_LARGURA, (NOME_LARGURA * NOME_ALTURA_PX) / NOME_LARGURA_PX)), guardar(materialPorCima(THREE, VERTICE, FRAG_NOME, uNome)))
  placaDoNome.position.set(0, NOME_NDC * NOME_DISTANCIA * TAN_MEIO_FOV, -NOME_DISTANCIA)
  placaDoNome.renderOrder = 41
  placaDoNome.frustumCulled = false
  placaDoNome.visible = true
  if (nome) camera.add(placaDoNome)
  const larguraDoTexto = NOME_LARGURA * (nome?.fracao ?? 0)

  const uTela = { uTempo, uGrao: { value: reduzir ? 0 : 0.03 }, uClarao: { value: v3(0, 0, 0) } }
  const veu = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1, 1)), guardar(materialPorCima(THREE, VERTICE_TELA, FRAG_TELA, uTela)))
  veu.renderOrder = 50
  veu.frustumCulled = false
  scene.add(veu)

  const aplicarPose = (grupo: Three.Group, pose: Pose) => {
    grupo.position.x = pose.x
    grupo.position.y = pose.y
    grupo.rotation.z = pose.angulo
  }

  function atualizarArma(m: Montagem, t: number, tiro: number): PoseDaArma {
    const pose = poseDe(m.arma, t, reduzir, centro)
    aplicarPose(m.grupo, pose)
    m.cao.rotation.z = pose.cao
    m.corpo.uOpacidade.value = pose.opacidade
    m.caoU.uOpacidade.value = pose.opacidade
    m.corpo.uGiro.value = pose.tambor
    m.corpo.uQuente.value = calorDoCano(t, tiro) * (reduzir ? 0.6 : 1)
    // O rastro: só no golpe, o trecho rápido (some no quadro do tranco).
    const rastro = reduzir ? 0 : span(t, T.golpe + 0.05, T.golpe + 0.1) * (1 - span(t, T.tranco - 0.004, T.tranco + 0.012))
    m.rastros.forEach((r, k) => {
      r.grupo.visible = rastro > 0.001
      if (!r.grupo.visible) return
      const atras = poseDe(m.arma, Math.min(t, T.tranco) - 0.014 * (k + 1), reduzir, centro)
      aplicarPose(r.grupo, atras)
      r.grupo.position.z = m.arma.z - 0.01
      r.u.uOpacidade.value = rastro * (k === 0 ? 0.34 : 0.16)
    })
    // O clarão: um quadro de luz e três de fogo; o halo fica um pouco mais.
    const c = clarao(t, tiro)
    m.clarao.visible = !reduzir && c > 0.002
    m.uClarao.uForca.value = c * 1.5
    m.uClarao.uFase.value = span(t - tiro, 0, 0.09)
    m.uClarao.uSemente.value = Math.floor(Math.max(0, t - tiro) / 0.016)
    m.uHalo.uForca.value = reduzir ? 0.5 * luzDoTiro(t, tiro, true) : 0.9 * c + 0.5 * Math.exp(-Math.max(0, t - tiro) / 0.12) * (t >= tiro ? 1 : 0)
    return pose
  }

  function atualizarFaiscas(t: number) {
    for (let i = 0; i < faiscas.length; i++) {
      const f = faiscas[i]
      const a = t - f.t0
      if (a < 0 || a > f.vida) {
        riscos.esconder(i)
        continue
      }
      const amortece = Math.exp(-a / f.arrasto)
      const k = f.arrasto * (1 - amortece)
      const x = f.x0 + f.vx * k
      const y = f.y0 + f.vy * k - 0.5 * f.gravidade * a * a
      const vx = f.vx * amortece
      const vy = f.vy * amortece - f.gravidade * a
      const idade = a / f.vida
      const luz = Math.pow(1 - idade, 1.4)
      const comprimento = Math.min(0.5, 0.012 + Math.hypot(vx, vy) * 0.024)
      const mistura = (j: 0 | 1 | 2) => (f.cor[j] + (f.fim[j] - f.cor[j]) * idade) * luz
      riscos.definir(i, x, y, vx || 0.0001, vy, comprimento, f.largura * (1 - 0.4 * idade), mistura(0), mistura(1), mistura(2))
    }
    riscos.enviar()
  }

  function atualizarFumaca(t: number) {
    const luz = 0.22 + 0.78 * uLuz.value
    for (let i = 0; i < nuvens.length; i++) {
      const n = nuvens[i]
      const a = t - n.t0
      if (a < 0 || a > n.vida) {
        tufos.esconder(i)
        continue
      }
      const k = reduzir ? 0 : n.arrasto * (1 - Math.exp(-a / n.arrasto))
      const x = n.x0 + n.vx * k + (reduzir ? 0 : n.balanco * Math.sin(a * 2.2 + n.fase))
      const y = n.y0 + n.vy * k + (reduzir ? 0 : n.sobe * a)
      const tamanho = n.s0 + (n.s1 - n.s0) * (reduzir ? 0.5 : 1) * (1 - Math.exp(-a / n.cresce))
      const alfa = n.alfa * (reduzir ? 0.7 : 1) * easeOutCubic(clamp01(a / 0.05)) * (1 - easeInOutSine(span(a, 0.5 * n.vida, n.vida)))
      // A cor: o cinza da pólvora na luz da cena, a luz dos tiros e o fogo de quando nasce.
      let r = n.tom[0] * luz
      let g = n.tom[1] * luz
      let b = n.tom[2] * luz
      for (let j = 1; j < 3; j++) {
        const fonte = uLuzes.value[j]
        const d2 = (x - fonte.x) ** 2 + (y - fonte.y) ** 2
        const f = (fonte.z / (1 + d2 * 2)) * 0.6
        const cor = uCoresDasLuzes.value[j]
        r += cor.x * f
        g += cor.y * f
        b += cor.z * f
      }
      const fogo = n.quente * 1.5 * Math.exp(-a / 0.06) * (reduzir ? 0.3 : 1)
      tufos.definir(i, x, y, tamanho, n.giro0 + n.giroV * a, n.variante, r + fogo, g + 0.6 * fogo, b + 0.3 * fogo, alfa)
    }
    tufos.enviar()
  }

  function atualizar(tBruto: number) {
    const t = Math.min(T.duracao, Math.max(0, tBruto))
    uTempo.value = reduzir ? 1.2 : t
    uLuz.value = luzDaCena(t, reduzir)

    const poseAco = atualizarArma(aco, t, tiroAco)
    const poseRoxa = atualizarArma(roxa, t, tiroRoxa)
    // A roxa (na frente) faz sombra no aço onde os canos se cruzam.
    const [sx, sy] = noMundo(ROXA, poseRoxa, [CANOS_DA_ROXA.inicio, CANOS_DA_ROXA.eixo])
    aco.corpo.uSombraLinha.value.set(sx, sy, Math.cos(poseRoxa.angulo), Math.sin(poseRoxa.angulo))
    aco.corpo.uSombraTrecho.value.set(0, (CANOS_DA_ROXA.fim - CANOS_DA_ROXA.inicio) * ESCALA)
    aco.corpo.uSombra.value = reduzir ? poseAco.opacidade : span(t, T.tranco - 0.1, T.tranco)

    // A corrente pendurada no anel do cabo.
    const [a1, a2] = corrente(t)
    const [ax, ay] = noMundo(ROXA, poseRoxa, ANEL_DA_ROXA)
    elo.m.position.set(ax, ay, ROXA.z + 0.01)
    elo.m.rotation.z = a1
    const fimDaCorrente = COMPRIMENTO_DA_CORRENTE * ESCALA
    pingente.m.position.set(ax + Math.sin(a1) * fimDaCorrente, ay - Math.cos(a1) * fimDaCorrente, ROXA.z + 0.012)
    pingente.m.rotation.z = a2
    elo.u.uOpacidade.value = poseRoxa.opacidade
    pingente.u.uOpacidade.value = poseRoxa.opacidade

    // As luzes: o tranco no cruzamento e cada tiro na sua boca (seguindo o coice).
    const tauTranco = t - tranco
    uLuzes.value[0].set(centro[0], centro[1], tauTranco < 0 ? 0 : reduzir ? 0.45 * Math.exp(-tauTranco / 0.15) : 1.3 * Math.exp(-tauTranco / 0.05))
    const [bax, bay] = noMundo(ACO, poseAco, ACO.boca)
    const [brx, bry] = noMundo(ROXA, poseRoxa, ROXA.boca)
    uLuzes.value[1].set(bax, bay, luzDoTiro(t, tiroAco, reduzir))
    uLuzes.value[2].set(brx, bry, luzDoTiro(t, tiroRoxa, reduzir))
    uFagulha.uForca.value = tauTranco < 0 ? 0 : reduzir ? 0.5 * Math.exp(-tauTranco / 0.15) : 2.1 * Math.exp(-tauTranco / 0.05) * clamp01(tauTranco / 0.004)
    fagulha.visible = uFagulha.uForca.value > 0.002
    uLeque.uForca.value = reduzir ? 0 : 1.4 * Math.exp(-Math.max(0, t - tiroAco) / 0.018) * (t >= tiroAco ? 1 : 0)

    // O reflexo: uma faixa parada por onde as armas passam no saque; depois um reflexo que corre.
    if (!reduzir && t < T.tranco + 0.3) {
      uDirecaoDoBrilho.value.set(0, 1)
      uBrilho.value = 0.1
      uForcaDoBrilho.value = 0.9 * span(t, T.saqueInicio + 0.1, T.tranco - 0.1) * (1 - span(t, T.tranco, T.tranco + 0.3))
    } else {
      uDirecaoDoBrilho.value.set(0.94, 0.34)
      const corre = span(t, T.brilhoArmas, T.brilhoArmas + 0.55)
      uBrilho.value = -3.2 + 6.4 * easeInOutSine(corre)
      uForcaDoBrilho.value = (reduzir ? 0.5 : 0.85) * Math.sin(Math.PI * corre)
    }

    if (!reduzir) atualizarFaiscas(t)
    atualizarFumaca(t)

    const densidade = reduzir ? 0.85 * easeInOutSine(span(t, R.apagaInicio, R.fadeOutInicio + 0.2)) : 0.92 * easeInOutSine(span(t, T.fumacaInicio, T.fumacaFim))
    uFrente.uDensidade.value = densidade
    frente.visible = densidade > 0.001

    if (nome) {
      const acende = reduzir ? easeInOutSine(span(t, R.nomeSurge, R.nomeAceso)) : span(t, T.nomeAcende, T.nomeFim)
      uNome.uFrente.value = reduzir ? 1.2 : -0.05 + 1.2 * easeOutCubic(acende)
      const apaga = 1 - easeInOutSine(span(t, (reduzir ? R.apagaInicio : T.apagaInicio) - 0.05, (reduzir ? R.apagaFim : T.apagaFim) - 0.1))
      uNome.uApaga.value = (reduzir ? acende : clamp01(acende * 8)) * apaga
      uNome.uBrilho.value = reduzir ? -1 : -0.2 + 1.4 * span(t, T.brilhoNome, T.brilhoNome + 0.5)
      // A placa fica sempre visível (alfa 0 até acender): a textura do nome sobe para a GPU no primeiro quadro, não no meio.
    }

    const c = estadoDaCamera(t, reduzir, distancia, ndcDoX)
    camera.position.set(c.x, c.y, c.z)
    camera.rotation.z = c.giro

    // O clarão quente na tela inteira, um em cada tiro.
    const claraoDaTela = reduzir ? 0.06 * (luzDoTiro(t, tiroAco, true) + luzDoTiro(t, tiroRoxa, true)) : 0.3 * clarao(t, tiroAco) + 0.34 * clarao(t, tiroRoxa)
    uTela.uClarao.value.set(claraoDaTela, claraoDaTela * 0.72, claraoDaTela * 0.5)

    return { fade: fadeDosRevolveres(t, reduzir) }
  }

  function ajustarTela(novo: number) {
    aspecto = Math.max(0.2, novo)
    const metadeVisivel = TAN_MEIO_FOV * aspecto
    // Longe o bastante para o X caber na largura e na altura reservadas para ele.
    const naAltura = comNome ? X_NA_ALTURA_COM_NOME : X_NA_ALTURA_SEM_NOME
    distancia = Math.max(MEIA_LARGURA_DO_X / (X_NA_LARGURA * metadeVisivel), MEIA_ALTURA_DO_X / (naAltura * TAN_MEIO_FOV))
    camera.aspect = aspecto
    camera.updateProjectionMatrix()
    // O nome cabe em 84% da largura visível na distância dele.
    const larguraVisivel = 2 * NOME_DISTANCIA * metadeVisivel
    const escalaDoNome = larguraDoTexto > 0 ? Math.min(1, (0.84 * larguraVisivel) / larguraDoTexto) : 1
    placaDoNome.scale.set(escalaDoNome, escalaDoNome, 1)
  }

  function descartar() {
    for (const coisa of lixo) coisa.dispose()
    lixo.length = 0
  }

  ajustarTela(aspecto)
  // Sem atualizar(0) aqui: tudo nasce visível para o motor compilar todos os shaders antes do relógio
  // (compilar no meio, no primeiro tiro, travava um quadro de 200 ms). O primeiro atualizar(t) esconde o que não aparece.

  return { scene, camera, atualizar, ajustarTela, criarSom: (kit: KitDeSom) => criarSomDosRevolveres(kit, reduzir, comNome), descartar }
}

// ── Som (sintetizado) ────────────────────────────────────────────────────────

interface Saida {
  ctx: AudioContext
  seco: AudioNode
  eco: AudioNode
  ruido: (segundos: number) => AudioBuffer
}

/** Ataque e queda exponenciais (o ganho nunca chega a zero de verdade). */
function envelope(g: GainNode, a: number, pico: number, ataque: number, queda: number): void {
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

function painel(ctx: AudioContext, pan: number): StereoPannerNode {
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  return p
}

/**
 * Um desfiladeiro de pedra: a cauda de ruído que cai e os ecos secos das
 * paredes (o bang volta duas, três vezes, cada lado num tempo). Igual em toda volta.
 */
function respostaDoDesfiladeiro(ctx: AudioContext, segundos: number): AudioBuffer {
  const n = Math.ceil(ctx.sampleRate * segundos)
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let canal = 0; canal < 2; canal++) {
    const rnd = semente(canal === 0 ? 31 : 47)
    const dados = buffer.getChannelData(canal)
    for (let i = 0; i < n; i++) dados[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, 4) * 0.5
    const ecos = canal === 0 ? [[0.11, 0.55], [0.23, 0.3], [0.41, 0.16]] : [[0.15, 0.5], [0.29, 0.26], [0.47, 0.13]]
    for (const [quando, ganho] of ecos) {
      const i0 = Math.floor(quando * ctx.sampleRate)
      for (let k = 0; k < 96 && i0 + k < n; k++) dados[i0 + k] += (rnd() * 2 - 1) * ganho * Math.exp(-k / 24)
    }
  }
  return buffer
}

/** Saturação macia (o estalo do tiro ganha aspereza sem passar do teto). */
function curvaDeSaturacao(forca: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curva = new Float32Array(new ArrayBuffer(n * 4))
  const norma = Math.tanh(forca)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curva[i] = (0.85 * Math.tanh(forca * x)) / norma
  }
  return curva
}

/** Ruído do kit, começando num ponto qualquer, passando pelos filtros até o ganho. */
function ruidoPor(s: Saida, a: number, duracao: number, inicio: number, filtros: BiquadFilterNode[], ganho: AudioNode): void {
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

/** Vento rasteiro de fim de tarde, que vai e volta de um lado para o outro. */
function vento(s: Saida, a: number, fim: number, volume: number): void {
  const { ctx } = s
  const banda = filtro(ctx, 'bandpass', 620, 0.6)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.4
  const fundoDoLfo = ctx.createGain()
  fundoDoLfo.gain.value = 260
  lfo.connect(fundoDoLfo)
  fundoDoLfo.connect(banda.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(volume, a + 0.5)
  g.gain.setValueAtTime(volume, fim - 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, fim)
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(-0.3, a)
  p.pan.linearRampToValueAtTime(0.3, fim)
  banda.connect(g)
  g.connect(p)
  p.connect(s.seco)
  ruidoPor(s, a, fim - a + 0.05, 0.9, [banda], g)
  lfo.start(a)
  lfo.stop(fim + 0.05)
}

/** O grave da tensão (mi bem baixo, com batimento): cresce, some na respiração presa e volta com o tiro. */
function grave(s: Saida, a: number, corte: number, volta: number, fim: number): void {
  const { ctx } = s
  const passaBaixa = filtro(ctx, 'lowpass', 150, 2.2)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(0.085, corte - 0.1)
  g.gain.setValueAtTime(0.085, corte - 0.02)
  g.gain.exponentialRampToValueAtTime(0.0005, corte + 0.1)
  g.gain.setValueAtTime(0.0005, volta - 0.01)
  g.gain.exponentialRampToValueAtTime(0.11, volta + 0.06)
  g.gain.exponentialRampToValueAtTime(0.05, volta + 1.1)
  g.gain.setValueAtTime(0.05, fim - 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, fim)
  passaBaixa.connect(g)
  g.connect(s.seco)
  for (const [frequencia, volume] of [
    [41.2, 0.5],
    [41.55, 0.4],
    [61.74, 0.22],
    [82.4, 0.1],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = frequencia
    const v = ctx.createGain()
    v.gain.value = volume
    osc.connect(v)
    v.connect(passaBaixa)
    osc.start(a)
    osc.stop(fim + 0.05)
  }
}

/** O saque: o couro do coldre e dois sopros (um de cada lado) que sobem e se encontram no meio. */
function saque(s: Saida, a: number, duracao: number): void {
  const { ctx } = s
  for (const pan of [-0.55, 0.55]) {
    const banda = filtro(ctx, 'bandpass', 420, 1.1)
    banda.frequency.setValueAtTime(420, a)
    banda.frequency.exponentialRampToValueAtTime(2300, a + duracao * 0.85)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, a)
    g.gain.exponentialRampToValueAtTime(0.13, a + duracao * 0.8)
    g.gain.exponentialRampToValueAtTime(0.0001, a + duracao + 0.08)
    const p = ctx.createStereoPanner()
    p.pan.setValueAtTime(pan, a)
    p.pan.linearRampToValueAtTime(pan * 0.3, a + duracao)
    g.connect(p)
    p.connect(s.seco)
    ruidoPor(s, a, duracao + 0.1, pan > 0 ? 0.3 : 1.1, [banda], g)
  }
  const couro = ctx.createGain()
  envelope(couro, a, 0.05, 0.004, 0.07)
  couro.connect(s.seco)
  ruidoPor(s, a, 0.1, 0.7, [filtro(ctx, 'bandpass', 1500, 0.9)], couro)
}

/** O tranco dos canos: um estalo seco, os parciais de dois metais (o aço mais grave) e um baque. */
function tranco(s: Saida, a: number, forca: number): void {
  const { ctx } = s
  const estalo = ctx.createGain()
  envelope(estalo, a, 0.3 * forca, 0.0015, 0.03)
  estalo.connect(s.seco)
  estalo.connect(s.eco)
  ruidoPor(s, a, 0.05, 0.6, [filtro(ctx, 'highpass', 2500, 0.7)], estalo)
  for (const [frequencia, volume, queda, pan] of [
    [612, 0.1, 0.6, 0.18],
    [1418, 0.065, 0.42, 0.18],
    [2611, 0.04, 0.26, 0.18],
    [4069, 0.022, 0.16, 0.18],
    [883, 0.085, 0.75, -0.18],
    [2297, 0.05, 0.5, -0.18],
    [4337, 0.026, 0.3, -0.18],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.frequency.value = frequencia
    const v = ctx.createGain()
    envelope(v, a, volume * forca, 0.0015, queda)
    const p = painel(ctx, pan)
    osc.connect(v)
    v.connect(p)
    p.connect(s.seco)
    p.connect(s.eco)
    osc.start(a)
    osc.stop(a + queda + 0.05)
  }
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(96, a)
  osc.frequency.exponentialRampToValueAtTime(46, a + 0.2)
  const baque = ctx.createGain()
  envelope(baque, a, 0.42 * forca, 0.003, 0.24)
  osc.connect(baque)
  baque.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.3)
}

/** Um clique de mecanismo: ruído estreito e um tinido curto. */
function clique(s: Saida, a: number, frequencia: number, volume: number, pan: number): void {
  const { ctx } = s
  const p = painel(ctx, pan)
  p.connect(s.seco)
  const envio = ctx.createGain()
  envio.gain.value = 0.15
  p.connect(envio)
  envio.connect(s.eco)
  const g = ctx.createGain()
  envelope(g, a, volume, 0.0006, 0.014)
  g.connect(p)
  ruidoPor(s, a, 0.03, (frequencia % 1000) / 500, [filtro(ctx, 'bandpass', frequencia, 2.5)], g)
  const osc = ctx.createOscillator()
  osc.frequency.value = frequencia * 0.61
  const og = ctx.createGain()
  envelope(og, a, volume * 0.3, 0.0008, 0.03)
  osc.connect(og)
  og.connect(p)
  osc.start(a)
  osc.stop(a + 0.05)
}

/** Elos e pingente batendo: tinidos agudos e curtos, espalhados. */
function tilintar(s: Saida, a: number, n: number, volume: number, pan: number, sementeDoSom: number): void {
  const { ctx } = s
  const rnd = semente(sementeDoSom)
  const p = painel(ctx, pan)
  p.connect(s.seco)
  for (let i = 0; i < n; i++) {
    const quando = a + rnd() * 0.14
    const osc = ctx.createOscillator()
    osc.frequency.value = 3200 + rnd() * 4200
    const v = ctx.createGain()
    const queda = 0.05 + rnd() * 0.08
    envelope(v, quando, volume * (0.5 + 0.5 * rnd()), 0.001, queda)
    osc.connect(v)
    v.connect(p)
    osc.start(quando)
    osc.stop(quando + queda + 0.03)
  }
}

/** O aço engatilhando: a catraca do tambor e o cão travando (tric-clac), do lado direito. */
function engatilharAco(s: Saida, a: number): void {
  clique(s, a, 2300, 0.2, 0.35)
  clique(s, a + 0.065, 3500, 0.26, 0.35)
  const { ctx } = s
  const osc = ctx.createOscillator()
  osc.frequency.value = 420
  const g = ctx.createGain()
  envelope(g, a + 0.065, 0.06, 0.002, 0.025)
  const p = painel(ctx, 0.35)
  osc.connect(g)
  g.connect(p)
  p.connect(s.seco)
  osc.start(a + 0.065)
  osc.stop(a + 0.1)
}

/** A roxa engatilhando: um clique mais fino e a corrente tilintando, do lado esquerdo. */
function engatilharRoxa(s: Saida, a: number): void {
  clique(s, a, 4700, 0.16, -0.35)
  clique(s, a + 0.05, 6100, 0.13, -0.35)
  tilintar(s, a + 0.015, 5, 0.028, -0.4, 77)
}

/** Um tiro: o estalo áspero, o sopro que fecha de agudo para grave, o baque fundo e o eco do desfiladeiro. */
function tiro(s: Saida, a: number, volume: number, pan: number, grave: number): void {
  const { ctx } = s
  const p = painel(ctx, pan)
  p.connect(s.seco)
  const envio = ctx.createGain()
  envio.gain.value = 0.6
  p.connect(envio)
  envio.connect(s.eco)
  const estalo = ctx.createGain()
  envelope(estalo, a, 0.7 * volume, 0.002, 0.06)
  const satura = ctx.createWaveShaper()
  satura.curve = curvaDeSaturacao(2.5)
  estalo.connect(satura)
  satura.connect(p)
  ruidoPor(s, a, 0.09, 0.25, [filtro(ctx, 'highpass', 1100, 0.6)], estalo)
  const fecha = filtro(ctx, 'lowpass', 3000, 0.8)
  fecha.frequency.setValueAtTime(3000, a)
  fecha.frequency.exponentialRampToValueAtTime(240, a + 0.32)
  const corpo = ctx.createGain()
  envelope(corpo, a, 0.65 * volume, 0.003, 0.42)
  corpo.connect(p)
  ruidoPor(s, a, 0.5, 1.3, [fecha], corpo)
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(130 * grave, a)
  osc.frequency.exponentialRampToValueAtTime(34 * grave, a + 0.24)
  const baque = ctx.createGain()
  envelope(baque, a, 0.9 * volume, 0.004, 0.34)
  osc.connect(baque)
  baque.connect(p)
  osc.start(a)
  osc.stop(a + 0.45)
}

/** A roxa "canta" depois do tiro: o ouro rosa vibrando, três parciais baixinhos que ficam no eco. */
function cantoDaRoxa(s: Saida, a: number): void {
  const { ctx } = s
  const p = painel(ctx, 0.25)
  p.connect(s.seco)
  p.connect(s.eco)
  for (const [frequencia, volume, queda] of [
    [1318.5, 0.035, 0.9],
    [1975.5, 0.022, 0.65],
    [3520, 0.012, 0.42],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.frequency.value = frequencia
    const v = ctx.createGain()
    envelope(v, a, volume, 0.004, queda)
    osc.connect(v)
    v.connect(p)
    osc.start(a)
    osc.stop(a + queda + 0.05)
  }
}

/** O zumbido no ouvido depois de dois tiros: um agudo fininho que some. */
function zumbido(s: Saida, a: number): void {
  const { ctx } = s
  const osc = ctx.createOscillator()
  osc.frequency.value = 3600
  const g = ctx.createGain()
  envelope(g, a, 0.006, 0.08, 1.05)
  osc.connect(g)
  g.connect(s.seco)
  osc.start(a)
  osc.stop(a + 1.2)
}

/** O rastro de pólvora: um chiado e estalinhos que correm do meio para os dois lados. */
function pavio(s: Saida, a: number, duracao: number): void {
  const { ctx } = s
  const rnd = semente(1213)
  for (const lado of [-1, 1]) {
    const p = ctx.createStereoPanner()
    p.pan.setValueAtTime(0, a)
    p.pan.linearRampToValueAtTime(0.75 * lado, a + duracao)
    p.connect(s.seco)
    const chiado = ctx.createGain()
    envelope(chiado, a, 0.03, 0.03, duracao)
    chiado.connect(p)
    ruidoPor(s, a, duracao + 0.06, lado > 0 ? 0.4 : 1.4, [filtro(ctx, 'bandpass', 5200, 0.9)], chiado)
    for (let i = 0; i < 22; i++) {
      const quando = a + rnd() * duracao
      const g = ctx.createGain()
      envelope(g, quando, 0.03 + rnd() * 0.05, 0.0005, 0.004 + rnd() * 0.008)
      g.connect(p)
      ruidoPor(s, quando, 0.02, rnd() * 2, [filtro(ctx, 'highpass', 4000, 0.8)], g)
    }
  }
}

/** Cada pista recebe a hora do áudio que corresponde ao t = 0 da cena. */
type Pista = [nome: string, quando: number, tocar: (base: number) => void]

function criarSomDosRevolveres(kitDoMotor: KitDeSom, reduzir: boolean, comNome: boolean) {
  const { ctx } = kitDoMotor
  // Limitador na saída, só para os picos (os dois tiros e o tranco): o resto passa reto por ele. O ganho de
  // entrada dá o volume e o corte depois do limitador segura o pico verdadeiro. Com o limiar em -10 dB, o grave
  // do fim também era comprimido: o conferir-som media -22,8 LUFS (4,2 LU abaixo das aprovadas) e -0,7 dBTP.
  const entrada = ctx.createGain()
  entrada.gain.value = 3.3
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -3
  limitador.knee.value = 0
  limitador.ratio.value = 20
  limitador.attack.value = 0.001
  limitador.release.value = 0.15
  const corte = ctx.createGain()
  corte.gain.value = 0.75
  entrada.connect(limitador)
  limitador.connect(corte)
  corte.connect(kitDoMotor.destino)
  const eco = ctx.createConvolver()
  eco.buffer = respostaDoDesfiladeiro(ctx, 2.0)
  const volta = ctx.createGain()
  volta.gain.value = 0.4
  eco.connect(volta)
  volta.connect(entrada)
  const s: Saida = { ctx, seco: entrada, eco, ruido: kitDoMotor.ruido }
  const todas: Pista[] = reduzir
    ? [
        ['vento', 0, (b) => vento(s, b, b + T.duracao, 0.035)],
        ['grave', 0, (b) => grave(s, b, b + R.tiroAco - 0.16, b + R.tiroAco, b + T.duracao)],
        ['tranco', R.tranco, (b) => tranco(s, b + R.tranco, 0.6)],
        ['engatilhaAco', R.engatilhaAco, (b) => engatilharAco(s, b + R.engatilhaAco)],
        ['engatilhaRoxa', R.engatilhaRoxa, (b) => engatilharRoxa(s, b + R.engatilhaRoxa)],
        ['tiroAco', R.tiroAco, (b) => tiro(s, b + R.tiroAco, 0.8, -0.22, 1)],
        ['tiroRoxa', R.tiroRoxa, (b) => {
          tiro(s, b + R.tiroRoxa, 0.85, 0.22, 0.82)
          cantoDaRoxa(s, b + R.tiroRoxa + 0.01)
        }],
        ['nome', R.nomeSurge, (b) => pavio(s, b + R.nomeSurge, R.nomeAceso - R.nomeSurge)],
      ]
    : [
        ['vento', 0, (b) => vento(s, b, b + T.duracao, 0.04)],
        ['grave', 0, (b) => grave(s, b, b + T.silencio, b + T.tiroAco, b + T.duracao)],
        ['saque', T.saqueInicio, (b) => saque(s, b + T.saqueInicio, T.tranco - T.saqueInicio)],
        ['tranco', T.tranco, (b) => {
          tranco(s, b + T.tranco, 1)
          tilintar(s, b + T.tranco + 0.02, 6, 0.03, -0.45, 31)
        }],
        ['engatilhaAco', T.engatilhaAco, (b) => engatilharAco(s, b + T.engatilhaAco)],
        ['engatilhaRoxa', T.engatilhaRoxa, (b) => engatilharRoxa(s, b + T.engatilhaRoxa)],
        ['tiroAco', T.tiroAco, (b) => tiro(s, b + T.tiroAco, 0.95, -0.22, 1)],
        ['tiroRoxa', T.tiroRoxa, (b) => {
          tiro(s, b + T.tiroRoxa, 1, 0.22, 0.82)
          cantoDaRoxa(s, b + T.tiroRoxa + 0.01)
          tilintar(s, b + T.tiroRoxa + 0.03, 7, 0.032, -0.4, 53)
        }],
        ['zumbido', T.tiroRoxa + 0.06, (b) => zumbido(s, b + T.tiroRoxa + 0.06)],
        ['nome', T.nomeAcende, (b) => pavio(s, b + T.nomeAcende, T.nomeFim - T.nomeAcende)],
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

const criar: CriarCena = criarCenaRevolveresCruzados
export default criar

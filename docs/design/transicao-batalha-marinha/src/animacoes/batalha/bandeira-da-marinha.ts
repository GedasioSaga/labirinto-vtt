import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'
import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Bandeira da Marinha: a segunda abertura de batalha (pedido de 28/10/2026,
 * "a bandeira da marinha esvoaçando e enchendo o local de água"; protótipo em
 * docs/design/transicao-batalha-marinha/). Esta pasta espelha `client/src`:
 * o arquivo entra como está em `client/src/animacoes/batalha/`.
 *
 * Uma bandeira branca com o símbolo da Marinha (redesenhado em vetor: asas da
 * gaivota, haste, barra com as duas meias-luas e MARINE em serifa) esvoaça
 * num mastro contra um céu fechado, com ondas que correm do mastro para a
 * ponta, luz e sombra nas dobras e um estalo do pano na primeira rajada.
 * Então o mar sobe e enche o lugar como um tanque de vidro: primeiro a
 * superfície vista de cima, depois o corte meio dentro e meio fora, depois
 * tudo debaixo d'água, com espuma em formas, raios de luz e a bandeira
 * ondulando devagar. O nome surge na água, e a cena afunda no escuro até o
 * preto da troca (o motor fecha sempre em preto e o mapa entra dali).
 *
 * Contrato: o mesmo `CriarCena` das transições (`src/transicoes/tipos.ts`),
 * com o `nome` opcional das aberturas (padrão "Royals", o mesmo do app) e um
 * campo só do protótipo, `semNome`. O motor de hoje não passa `semNome`, então
 * no app o nome sempre aparece.
 *
 * Tudo é `ShaderMaterial` sem conversão de cor na saída, sem luz na cena e sem
 * imagem externa: símbolo e nome são pintados em canvas na montagem, nuvem,
 * onda, espuma e raio de luz são contas no shader. A água é um plano de
 * verdade (altura com ondas) e cada peça calcula a própria parte molhada.
 */

export const NOME_PADRAO = 'Royals'
export const NOME_MAX_LETRAS = 24

/** Roteiro em segundos (movimento completo, tela 16:9). */
export const ROTEIRO_DA_MARINHA = {
  duracao: 3.8,
  fadeInFim: 0.1,
  /** A rajada que abre o pano: o pulso corre do mastro até a ponta e estala. */
  rajadaInicio: 0.08,
  estalo: 0.42,
  /** O mar sobe: a borda do fundo aparece em 0,87 s, o corte meio a meio é em 1,52 s. */
  aguaSobe: 0.8,
  aguaCheia: 2.25,
  meioDagua: 1.52,
  /** A linha da água passa do alto da tela: tudo debaixo d'água. */
  mergulho: 1.99,
  nomeSurge: 2.02,
  nomeNitido: 2.5,
  /** A câmera afunda devagar até o fim; a luz da superfície vai ficando para trás. */
  afundaInicio: 2.6,
  fadeOutInicio: 3.35,
} as const

/** Com movimento reduzido: a bandeira fica parada, a água entra por dissolução e o fim é um escurecer. */
export const ROTEIRO_REDUZIDO = {
  aguaInicio: 0.95,
  aguaFim: 1.75,
  nomeSurge: 2.0,
  nomeAceso: 2.45,
  fadeOutInicio: 3.3,
} as const

export interface OpcoesDaMarinha extends OpcoesDaCena {
  /** O nome que aparece na água (grupo, inimigo). Vazio = "Royals". */
  nome?: string
  /** Só o protótipo passa: a bandeira sozinha, sem o nome. */
  semNome?: boolean
}

/** Espaços juntados, até 24 letras (sem partir emoji ao meio); vazio vira o padrão. */
export function nomeDaBatalha(nome: string | undefined): string {
  const limpo = (nome ?? '').replace(/\s+/g, ' ').trim()
  return limpo === '' ? NOME_PADRAO : Array.from(limpo).slice(0, NOME_MAX_LETRAS).join('')
}

// ── Medidas ──────────────────────────────────────────────────────────────────

const FOV = 34
const TAN_MEIO_FOV = Math.tan((FOV * Math.PI) / 360)
const DISTANCIA_BASE = 6.6
const CAMERA_Y = 0.05
const BANDEIRA_LARGURA = 3.84
const BANDEIRA_ALTURA = 2.56
/** A borda do pano presa no mastro; o mastro fica logo à esquerda. */
const TALHA_X = -1.925
const MASTRO_X = -1.978
const MASTRO_RAIO = 0.05
const MASTRO_TOPO = 1.56
const BANDEIRA_Y = 0.18
/** Meia largura do mastro até a ponta do pano, com folga: tela estreita afasta a câmera. */
const MEIA_LARGURA_DO_CONJUNTO = 2.3
/** O vidro do "tanque" (onde a linha da água corre pela tela) e a parede do fundo (o céu). */
const Z_VIDRO = 1.4
const Z_FUNDO = -3
/** Altura média da água no começo e no fim da subida (antes de escalar pela distância). */
const NIVEL_BAIXO = -3.4
const NIVEL_ALTO = 3.4
/** A subida desacelera no meio: o corte meio dentro, meio fora fica um instante a mais. */
const PAUSA_NO_MEIO = 0.55
/** Cheia, a água ainda sobe na velocidade em que chegou e assenta nesta constante de tempo (s), sem parar de estalo. */
const ASSENTA_S = 0.08
/** Velocidade da onda do pano (rad/s) no ar e debaixo d'água. */
const VENTO_NO_AR = 13.5
const VENTO_NA_AGUA = 4.2
const DESACELERA_INICIO = 1.2
const DESACELERA_FIM = 2.0

const PANO_LARGURA_PX = 2048
const PANO_ALTURA_PX = 1366
const NOME_LARGURA_PX = 2048
const NOME_ALTURA_PX = 512
const NOME_FONTE_MAX_PX = 236
const NOME_LARGURA_UTIL_PX = 1700
/** O nome fica diante da câmera (título), no terço de baixo. */
const NOME_DISTANCIA = 4
const NOME_Y = -0.64
const NOME_LARGURA = 3.2
/** A fonte de título do app (`--lb-font-display`). */
const FONTE_DO_NOME = "'Sitka Banner', 'Sitka Display', Constantia, Georgia, 'Times New Roman', serif"
/** O azul do símbolo (referência medida: #0e42ac; pedido: cerca de #1a43b0). */
const AZUL_DA_MARINHA = '#1543ae'
const LUZ = [-0.72, 0.5, 0.48] as const

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

/**
 * A água: um plano na altura `uNivel` com três ondas correndo para a direita
 * (o mesmo lado do vento). `ondaDaAgua` devolve altura e inclinação (x, z);
 * cada peça usa `alturaDagua` para saber o quanto está submersa.
 */
const GLSL_AGUA = /* glsl */ `
uniform float uNivel;
uniform float uAgito;
uniform float uTempoAgua;
uniform float uMistura;
vec3 ondaDaAgua(vec2 xz) {
  float t = uTempoAgua;
  float f1 = 0.85 * xz.x + 0.35 * xz.y - 1.9 * t + 0.6;
  float f2 = 1.65 * xz.x - 0.5 * xz.y - 2.7 * t + 1.9;
  float f3 = 2.9 * xz.x + 0.9 * xz.y - 3.9 * t + 4.1;
  float h = 0.11 * sin(f1) + 0.065 * sin(f2) + 0.035 * sin(f3);
  float dx = 0.11 * 0.85 * cos(f1) + 0.065 * 1.65 * cos(f2) + 0.035 * 2.9 * cos(f3);
  float dz = 0.11 * 0.35 * cos(f1) - 0.065 * 0.5 * cos(f2) + 0.035 * 0.9 * cos(f3);
  return vec3(uNivel + uAgito * h, uAgito * dx, uAgito * dz);
}
// Só a altura (três senos): é o que os fragmentos usam a cada pixel.
float alturaDagua(vec2 xz) {
  float t = uTempoAgua;
  float h = 0.11 * sin(0.85 * xz.x + 0.35 * xz.y - 1.9 * t + 0.6)
    + 0.065 * sin(1.65 * xz.x - 0.5 * xz.y - 2.7 * t + 1.9)
    + 0.035 * sin(2.9 * xz.x + 0.9 * xz.y - 3.9 * t + 4.1);
  return uNivel + uAgito * h;
}
vec3 corDaAgua(float prof) {
  return mix(vec3(0.11, 0.315, 0.37), vec3(0.012, 0.05, 0.08), smoothstep(0.0, 7.0, prof));
}
vec3 sobAgua(vec3 cor, float prof) {
  float p = max(prof, 0.0);
  vec3 passa = exp(-vec3(1.05, 0.4, 0.3) * (0.55 + 0.5 * p));
  float nevoa = 0.85 * (1.0 - exp(-(0.5 + 0.32 * p)));
  return mix(cor * passa, corDaAgua(p), nevoa);
}
float causticas(vec2 p, float t) {
  vec2 q = p * 2.1;
  float a = sin(q.x + 1.2 * sin(q.y * 1.3 + t * 0.9) + t * 0.7);
  float b = sin(q.y * 1.1 + 1.3 * sin(q.x * 1.2 - t * 0.8) - t * 0.6);
  return pow(1.0 - abs(a * b), 7.0);
}`

const VERTICE_MUNDO = /* glsl */ `
varying vec3 vPos;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vPos = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`

/** O céu fechado na parede do fundo; abaixo da linha da água, o corpo do mar. */
const FRAG_FUNDO = /* glsl */ `
${GLSL_RUIDO}
${GLSL_AGUA}
uniform float uTempoCeu;
varying vec3 vPos;
vec3 ceu(vec2 p) {
  vec3 cor = mix(vec3(0.47, 0.54, 0.6), vec3(0.15, 0.21, 0.28), smoothstep(-3.0, 4.0, p.y));
  cor += vec3(0.24, 0.25, 0.24) * exp(-length((p - vec2(-3.4, 2.4)) / vec2(4.0, 2.8)));
  vec2 q = p * vec2(0.3, 0.52) + vec2(-uTempoCeu * 0.2, 0.0);
  float v = fbm3(q);
  float nuvem = smoothstep(0.45, 0.8, v);
  // A barriga escura da nuvem: o mesmo campo, deslocado por um ruído só (em vez de um segundo fbm).
  float sombra = smoothstep(0.42, 0.88, v + 0.2 * (ruido(q * 1.7 + vec2(0.05, 0.22)) - 0.5));
  return mix(cor, mix(vec3(0.66, 0.7, 0.73), vec3(0.25, 0.3, 0.36), sombra * 0.85), nuvem * 0.7);
}
void main() {
  float prof = alturaDagua(vPos.xz) - vPos.y;
  float aa = fwidth(prof) + 0.002;
  float sub = smoothstep(-aa, aa, prof) * uMistura;
  vec3 agua = corDaAgua(prof) + vec3(0.07, 0.13, 0.13) * exp(-max(prof, 0.0) * 2.5);
  // Onde já é só água, o céu nem é calculado (a maior parte da tela depois do mergulho).
  vec3 cor = agua;
  if (sub < 0.999) cor = mix(ceu(vPos.xy), agua, sub);
  gl_FragColor = vec4(cor, 1.0);
}`

/**
 * O pano: a malha é só a grade de uv; a forma sai daqui. Ondas que crescem do
 * mastro para a ponta, um tremor fino na ponta, o pulso da rajada, o pano
 * encolhendo na largura quando ondula e caindo um pouco quando o vento cede.
 * Debaixo d'água a imagem tremula (refração) na parte submersa.
 */
const VERTICE_PANO = /* glsl */ `
${GLSL_AGUA}
uniform float uFase;
uniform float uForca;
uniform float uOndaK;
uniform float uPulso;
uniform float uPulsoForca;
uniform vec2 uTamanho;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormal;
varying float vCavidade;
vec3 pano(vec2 uv) {
  float x = uv.x;
  float y = uv.y;
  float a = pow(x, 1.3);
  float f1 = x * 11.0 * uOndaK - uFase + y * 1.1;
  float f2 = x * 19.0 * uOndaK - uFase * 1.55 + y * 2.3 + 1.7;
  float f3 = x * 31.0 * uOndaK - uFase * 2.3 + y * 3.7 + 0.4;
  float z = (0.23 * sin(f1) + 0.07 * sin(f2) + 0.026 * smoothstep(0.5, 1.0, x) * sin(f3)) * a * uForca;
  float pulso = exp(-pow((x - uPulso) / 0.16, 2.0)) * uPulsoForca;
  z += 0.2 * pulso * a * sin(x * 8.0 - uFase * 0.5 + y * 0.8 + 0.8);
  float dy = 0.085 * a * sin(f1 * 0.5 + 0.9 + y) * uForca - 0.08 * x * x * max(0.0, 1.2 - uForca);
  float dx = -0.07 * pow(x, 2.6) * uForca * (1.0 + 0.35 * sin(2.0 * f1));
  return vec3(x * uTamanho.x + dx, (y - 0.5) * uTamanho.y + dy, z);
}
void main() {
  vUv = uv;
  vec3 p = pano(uv);
  vec3 px = pano(uv + vec2(0.004, 0.0));
  vec3 py = pano(uv + vec2(0.0, 0.004));
  vec3 n = normalize(cross(px - p, py - p));
  vCavidade = clamp(-p.z / (0.23 * uForca + 0.001), 0.0, 1.0);
  vec4 m = modelMatrix * vec4(p, 1.0);
  float onda = smoothstep(0.0, 0.3, alturaDagua(m.xz) - m.y) * uMistura;
  m.x += 0.02 * onda * sin(m.y * 5.0 + uTempoAgua * 2.2);
  m.y += 0.012 * onda * sin(m.x * 4.0 + uTempoAgua * 1.6);
  vPos = m.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * m;
}`

/** Pano branco com luz de céu fechado: difusa enrolada, cavidade nas dobras, lustro baixo e a sombra lenta das nuvens. */
const FRAG_PANO = /* glsl */ `
${GLSL_RUIDO}
${GLSL_AGUA}
uniform sampler2D uMapa;
uniform vec3 uLuz;
uniform float uTempoCeu;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormal;
varying float vCavidade;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(cameraPosition - vPos);
  vec3 base = texture2D(uMapa, vUv).rgb;
  float ndl = dot(n, uLuz);
  float dif = clamp((ndl + 0.2) / 1.2, 0.0, 1.0);
  float nuvem = 0.9 + 0.14 * ruido(vec2(vPos.x * 0.45 - uTempoCeu * 0.55, vPos.y * 0.35 + 3.1));
  float cav = 1.0 - 0.38 * vCavidade;
  vec3 luz = vec3(1.0, 0.985, 0.96) * (0.27 + 0.76 * dif) * cav * nuvem + vec3(0.56, 0.64, 0.74) * 0.1 * (0.6 + 0.4 * n.y);
  luz += vec3(0.85, 0.88, 0.9) * clamp(-ndl, 0.0, 1.0) * 0.12;
  vec3 H = normalize(uLuz + V);
  float brilho = pow(max(dot(n, H), 0.0), 20.0) * 0.08 * cav;
  float lustro = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.06;
  vec3 cor = base * luz + vec3(brilho + lustro);
  float prof = alturaDagua(vPos.xz) - vPos.y;
  float aa = fwidth(prof) + 0.0015;
  float sub = smoothstep(-aa, aa, prof) * uMistura;
  if (sub > 0.0) {
    float c = causticas(vPos.xy + vec2(0.0, vPos.z), uTempoAgua) * exp(-max(prof, 0.0) * 0.6);
    cor = mix(cor, sobAgua(cor * (1.0 + 0.35 * c), prof), sub);
  }
  gl_FragColor = vec4(cor, 1.0);
}`

/** Mastro e pomo: a mesma luz do pano; a malha alta deixa o mastro tremular debaixo d'água. */
const VERTICE_SOLIDO = /* glsl */ `
${GLSL_AGUA}
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  float onda = smoothstep(0.0, 0.3, alturaDagua(m.xz) - m.y) * uMistura;
  m.x += 0.02 * onda * sin(m.y * 5.0 + uTempoAgua * 2.2);
  vPos = m.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * m;
}`

const FRAG_SOLIDO = /* glsl */ `
${GLSL_AGUA}
uniform vec3 uCor;
uniform vec3 uLuz;
uniform float uBrilho;
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vPos);
  float dif = clamp((dot(n, uLuz) + 0.25) / 1.25, 0.0, 1.0);
  float esp = pow(max(dot(reflect(-uLuz, n), V), 0.0), 28.0) * uBrilho;
  float borda = pow(1.0 - max(dot(n, V), 0.0), 2.0) * 0.12;
  vec3 cor = uCor * (0.32 + 0.85 * dif + borda) + vec3(esp);
  float prof = alturaDagua(vPos.xz) - vPos.y;
  float aa = fwidth(prof) + 0.0015;
  float sub = smoothstep(-aa, aa, prof) * uMistura;
  gl_FragColor = vec4(mix(cor, sobAgua(cor, prof), sub), 1.0);
}`

/** A superfície do mar: plano com as mesmas ondas, visto de cima (céu refletido, espuma) ou de baixo (prata esverdeada). */
const VERTICE_SUPERFICIE = /* glsl */ `
${GLSL_AGUA}
varying vec3 vPos;
varying vec3 vN;
varying float vCrista;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vec3 onda = ondaDaAgua(m.xz);
  m.y = onda.x;
  vPos = m.xyz;
  vN = normalize(vec3(-onda.y, 1.0, -onda.z));
  vCrista = (onda.x - uNivel) / (0.21 * max(uAgito, 0.001));
  gl_Position = projectionMatrix * viewMatrix * m;
}`

const FRAG_SUPERFICIE = /* glsl */ `
${GLSL_RUIDO}
${GLSL_AGUA}
uniform float uEspuma;
varying vec3 vPos;
varying vec3 vN;
varying float vCrista;
float espumaNaAgua(vec2 xz) {
  vec2 fluxo = vec2(uTempoAgua * 0.85, 0.0);
  float n = 0.65 * ruido(xz * vec2(1.05, 1.7) - fluxo) + 0.35 * ruido(xz * vec2(2.4, 3.3) - fluxo * 1.3 + 7.3);
  float limiar = 0.7 - 0.3 * smoothstep(0.25, 0.95, vCrista);
  float aa = fwidth(n) * 1.2 + 0.004;
  return smoothstep(limiar - aa, limiar + aa, n) * uEspuma;
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vPos);
  float f = espumaNaAgua(vPos.xz);
  vec4 saida;
  if (gl_FrontFacing) {
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    vec3 reflexo = mix(vec3(0.33, 0.4, 0.47), vec3(0.6, 0.66, 0.7), clamp(reflect(-V, N).y * 1.6, 0.0, 1.0));
    vec3 cor = mix(vec3(0.07, 0.22, 0.27), reflexo, fres) + vec3(0.1, 0.12, 0.12) * smoothstep(0.35, 1.0, vCrista);
    float alfa = mix(0.68, 0.97, fres);
    cor = mix(cor, vec3(0.87, 0.91, 0.92) * (0.86 + 0.14 * N.y), f);
    alfa = mix(alfa, 0.97, f);
    saida = vec4(cor * alfa, alfa);
  } else {
    vec3 cor = vec3(0.15, 0.38, 0.43) + vec3(0.18, 0.24, 0.24) * smoothstep(0.2, 1.0, vCrista);
    cor = mix(cor, vec3(0.06, 0.14, 0.17), f * 0.75);
    saida = vec4(cor * 0.93, 0.93);
  }
  gl_FragColor = saida * uMistura;
}`

const VERTICE = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/** O nome: tremor leve de refração e o foco que chega (o borrão é o nível do mipmap). Saída pré-multiplicada. */
const FRAG_NOME = /* glsl */ `
uniform sampler2D uMapa;
uniform float uOpacidade;
uniform float uDesfoque;
uniform float uOndula;
uniform float uTempo;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  uv.x += uOndula * 0.0022 * sin(uv.y * 16.0 + uTempo * 2.1);
  uv.y += uOndula * 0.003 * sin(uv.x * 9.0 - uTempo * 1.4);
  vec4 c = texture2D(uMapa, uv, uDesfoque);
  gl_FragColor = vec4(c.rgb * c.a, c.a) * uOpacidade;
}`

/** Tela inteira, sem câmera: as coordenadas saem direto em NDC. */
const VERTICE_TELA = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy * 2.0;
  gl_Position = vec4(vNdc, 0.0, 1.0);
}`

/**
 * Por cima de tudo: onde a água encosta no vidro (menisco claro e a faixa de
 * espuma com lóbulos), os raios de luz que descem inclinados da superfície e
 * a vinheta. A linha do vidro sai da mesma `alturaDagua`, projetada na tela.
 */
const FRAG_TELA = /* glsl */ `
${GLSL_RUIDO}
${GLSL_AGUA}
uniform vec3 uCam;
uniform float uTanMeio;
uniform float uAspecto;
uniform float uTempo;
uniform float uTempoRaios;
uniform float uRaios;
uniform float uEspumaVidro;
varying vec2 vNdc;
void main() {
  float prof = uCam.z - ${Z_VIDRO.toFixed(2)};
  float xw = uCam.x + vNdc.x * prof * uTanMeio * uAspecto;
  float linha = (alturaDagua(vec2(xw, ${Z_VIDRO.toFixed(2)})) - uCam.y) / (prof * uTanMeio);
  float dy = vNdc.y - linha;
  float aa = fwidth(dy) * 1.5 + 0.0005;
  float sob = (1.0 - smoothstep(-aa, aa, dy)) * uMistura;
  float abaixo = max(-dy, 0.0);

  // Raios: só onde há água na frente do olho.
  vec3 luz = vec3(0.0);
  if (sob > 0.0) {
    vec2 s = vec2(vNdc.x * uAspecto, vNdc.y);
    float u = s.x * 0.906 + s.y * 0.423;
    float r1 = smoothstep(0.2, 1.0, sin(u * 2.6 + uTempoRaios * 0.31 + 1.7 * sin(u * 0.9 - uTempoRaios * 0.17)));
    float r2 = smoothstep(0.55, 1.0, sin(u * 4.9 - uTempoRaios * 0.43 + 0.6));
    float raios = (0.7 * r1 + 0.45 * r2) * exp(-abaixo * 0.5);
    float rente = exp(-abaixo * 6.0);
    luz = vec3(0.5, 0.7, 0.72) * (raios * 0.24 + rente * 0.1) * uRaios * sob;
  }

  // Menisco e espuma: só na faixa rente à linha do vidro (a faixa mais grossa tem 0,09 de NDC).
  float menisco = 0.0;
  float espuma = 0.0;
  vec3 corDaEspuma = vec3(0.0);
  if (uEspumaVidro * uMistura > 0.0 && dy > -0.1 && dy < 0.03) {
    menisco = exp(-pow((dy + 0.006) / 0.005, 2.0)) * 0.5 * uEspumaVidro * uMistura;
    float n1 = ruido(vec2(xw * 1.1 - uTempo * 1.6, uTempo * 0.6));
    float n2 = ruido(vec2(xw * 3.9 + uTempo * 1.3, 3.7));
    float grossura = 0.028 + 0.062 * (0.6 * n1 + 0.4 * n2);
    float faixa = smoothstep(-grossura - aa, -grossura + aa, dy) * (1.0 - smoothstep(0.004 - aa, 0.004 + aa, dy));
    float furos = smoothstep(0.3, 0.42, ruido(vec2(xw * 2.4 - uTempo * 2.2, dy * 11.0 + uTempo * 0.9)));
    espuma = faixa * mix(1.0, furos, smoothstep(0.0, grossura, abaixo)) * uEspumaVidro * uMistura;
    corDaEspuma = vec3(0.88, 0.92, 0.93) * (0.8 + 0.2 * smoothstep(-grossura, 0.0, dy));
  }

  float vinheta = smoothstep(0.55, 1.45, length(vNdc * vec2(0.9, 1.0))) * (0.3 + 0.12 * sob);
  float alfa = espuma + (1.0 - espuma) * vinheta;
  vec3 rgb = corDaEspuma * espuma + (luz + menisco * vec3(0.8, 0.9, 0.92)) * (1.0 - espuma);
  gl_FragColor = vec4(rgb, alfa);
}`

// ── O símbolo, redesenhado em vetor ──────────────────────────────────────────
// Coordenadas da referência (720 × 540, símbolo de x 104 a 615, y 135 a 404),
// simétrico em x = 359,5. A textura só escala e centra.

type Ponto = readonly [number, number]

const ESPELHO_X = 719
const espelhar = (p: Ponto): Ponto => [ESPELHO_X - p[0], p[1]]

/** Asa esquerda, borda de cima: da ponta até o bico entre as duas asas. */
const ASA_TOPO: readonly Ponto[] = [
  [103.5, 247.5], [107.5, 223], [112, 211], [120, 195], [140, 171], [170, 150], [200, 139], [232, 135],
  [262, 137.5], [290, 146], [318, 163], [338, 182], [350, 199], [356, 210.5], [359.5, 219.5],
]
/** Asa esquerda, borda de baixo: da junção com a haste até a ponta. */
const ASA_BAIXO: readonly Ponto[] = [
  [340, 221], [331, 204], [320, 189], [300, 171], [280, 159], [250, 150], [220, 148], [190, 154],
  [160, 167], [140, 183], [124, 201], [113, 221], [108, 235], [103.5, 254.5],
]
/** Haste, lado esquerdo: da junção com a asa até o pé. */
const HASTE: readonly Ponto[] = [[340, 221], [344, 230], [347.5, 240], [350, 250], [351.2, 262], [352.5, 280], [353, 297.5]]

const LETRA_TOPO = 320.5
const LETRA_BASE = 402.5
const SERIFA_ESPESSURA = 2.6
const SERIFA_APOIO = 7

/** Curva suave pelos pontos (Catmull-Rom em Bézier); o ponto atual já é o primeiro. */
function tracarSuave(g: CanvasRenderingContext2D, pts: readonly Ponto[]): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1])
  }
}

function poligono(g: CanvasRenderingContext2D, pts: readonly Ponto[]): void {
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.closePath()
  g.fill()
}

/** Serifa com apoio côncavo: placa de `a` a `b` na ponta da haste (`s0` a `s1`). */
function serifa(g: CanvasRenderingContext2D, s0: number, s1: number, a: number, b: number, y: number, embaixo: boolean): void {
  const lado = embaixo ? -1 : 1
  const y1 = y + lado * SERIFA_ESPESSURA
  const y2 = y + lado * (SERIFA_ESPESSURA + SERIFA_APOIO)
  g.beginPath()
  g.moveTo(a, y)
  g.lineTo(b, y)
  g.lineTo(b, y1)
  g.quadraticCurveTo(s1, y1, s1, y2)
  g.lineTo(s0, y2)
  g.quadraticCurveTo(s0, y1, a, y1)
  g.closePath()
  g.fill()
}

/** Asas, haste e o bico entre as asas: um contorno só. */
function tracarGaivota(g: CanvasRenderingContext2D): void {
  const topoDireito = ASA_TOPO.map(espelhar).reverse()
  const baixoDireito = ASA_BAIXO.map(espelhar).reverse()
  const hasteDireita = HASTE.map(espelhar)
  const pe = HASTE[HASTE.length - 1]
  g.beginPath()
  g.moveTo(ASA_TOPO[0][0], ASA_TOPO[0][1])
  tracarSuave(g, ASA_TOPO)
  tracarSuave(g, topoDireito)
  g.lineTo(baixoDireito[0][0], baixoDireito[0][1])
  tracarSuave(g, baixoDireito)
  tracarSuave(g, hasteDireita)
  g.lineTo(pe[0], pe[1])
  tracarSuave(g, [...HASTE].reverse())
  tracarSuave(g, ASA_BAIXO)
  g.closePath()
  g.fill()
}

/** Meia-lua: círculo de fora menos a mordida deslocada para a ponta (as pontas saem do encontro dos dois). */
function meiaLua(g: CanvasRenderingContext2D, ox: number, oy: number, raio: number, ix: number, raioDentro: number): void {
  const x = (raio * raio - raioDentro * raioDentro - ox * ox + ix * ix) / (2 * (ix - ox))
  const dy = Math.sqrt(Math.max(0, raio * raio - (x - ox) * (x - ox)))
  const anguloFora = Math.atan2(-dy, x - ox)
  const anguloDentro = Math.atan2(-dy, x - ix)
  g.beginPath()
  g.arc(ox, oy, raio, anguloFora, -anguloFora, false)
  g.arc(ix, oy, raioDentro, -anguloDentro, anguloDentro, true)
  g.closePath()
  g.fill()
}

/** MARINE em serifa de contraste alto (hastes de 10,5, finos de 5), medido na referência. */
function tracarMarine(g: CanvasRenderingContext2D): void {
  const T = LETRA_TOPO
  const B = LETRA_BASE
  // M
  poligono(g, [[127, T + 2], [132, T + 2], [132, B], [127, B]])
  serifa(g, 127, 132, 116, 143, B, true)
  serifa(g, 127, 132, 116, 141, T, false)
  poligono(g, [[129, T], [142, T], [170, B + 1.5], [162, B + 1.5]])
  poligono(g, [[165, B + 1.5], [170.5, B + 1.5], [202, T], [196.5, T]])
  poligono(g, [[200.5, T], [211, T], [211, B], [200.5, B]])
  serifa(g, 200.5, 211, 189, 222, T, false)
  serifa(g, 200.5, 211, 189, 222, B, true)
  // A
  poligono(g, [[266, T - 0.5], [271.5, T - 0.5], [244.5, B], [237.5, B]])
  poligono(g, [[267, T - 0.5], [278.5, T - 0.5], [305.5, B], [292.5, B]])
  poligono(g, [[265.5, T], [279, T], [273, T - 2.5]])
  poligono(g, [[253, 368.5], [284, 368.5], [284, 373], [253, 373]])
  serifa(g, 237.5, 244.5, 228, 254, B, true)
  serifa(g, 292.5, 305.5, 284, 314, B, true)
  // R
  poligono(g, [[332, T], [343, T], [343, B], [332, B]])
  serifa(g, 332, 343, 321, 346, T, false)
  serifa(g, 332, 343, 321, 354, B, true)
  g.beginPath()
  g.moveTo(340, T)
  g.lineTo(361, T)
  g.bezierCurveTo(377.5, T, 385.5, 328.5, 385.5, 338.5)
  g.bezierCurveTo(385.5, 349.5, 376, 357.5, 359, 357.5)
  g.lineTo(340, 357.5)
  g.closePath()
  g.moveTo(340, T + 4.2)
  g.lineTo(357.5, T + 4.2)
  g.bezierCurveTo(367, T + 4.2, 371.5, 330, 371.5, 338.5)
  g.bezierCurveTo(371.5, 347.5, 366, 353.3, 356.5, 353.3)
  g.lineTo(340, 353.3)
  g.closePath()
  g.fill('evenodd')
  poligono(g, [[347, 356], [360.5, 356], [392.5, B], [380, B]])
  serifa(g, 380, 392.5, 377, 397, B, true)
  // I
  poligono(g, [[412, T], [422.5, T], [422.5, B], [412, B]])
  serifa(g, 412, 422.5, 401, 434, T, false)
  serifa(g, 412, 422.5, 401, 434, B, true)
  // N
  poligono(g, [[452, T + 4], [457, T + 4], [457, B], [452, B]])
  serifa(g, 452, 457, 441, 467, B, true)
  serifa(g, 452, 466, 441, 467, T, false)
  poligono(g, [[452, T], [466, T], [523, B + 1.5], [510.5, B + 1.5]])
  poligono(g, [[517, T], [522, T], [522, B + 1.5], [517, B + 1.5]])
  serifa(g, 517, 522, 506, 532, T, false)
  // E
  poligono(g, [[551, T], [562, T], [562, B], [551, B]])
  serifa(g, 551, 562, 541, 566, T, false)
  serifa(g, 551, 562, 547, 566, B, true)
  poligono(g, [[551, T], [599.5, T], [599.5, T + 4.2], [551, T + 4.2]])
  poligono(g, [[594.5, T], [600, T], [600.5, T + 15], [598, T + 15]])
  poligono(g, [[551, 358.5], [588.5, 358.5], [588.5, 363], [551, 363]])
  poligono(g, [[586.5, 351], [589.5, 351], [591, 370.5], [588, 370.5]])
  poligono(g, [[551, B - 4.5], [603, B - 4.5], [603, B], [551, B]])
  poligono(g, [[598, B - 16], [601, B - 16], [603, B], [597, B]])
}

/** O símbolo inteiro em `cor`, no sistema da referência (quem chama põe a escala). */
export function desenharSimboloDaMarinha(g: CanvasRenderingContext2D, cor: string): void {
  g.fillStyle = cor
  tracarGaivota(g)
  meiaLua(g, 246, 268.5, 26, 239.5, 21.5)
  g.save()
  g.translate(ESPELHO_X, 0)
  g.scale(-1, 1)
  meiaLua(g, 246, 268.5, 26, 239.5, 21.5)
  g.restore()
  // A barra nasce onde acaba a mordida de cada meia-lua (x 261), não dentro dela.
  g.fillRect(261.5, 263.8, ESPELHO_X - 2 * 261.5, 10.6)
  tracarMarine(g)
}

// ── Pintura ──────────────────────────────────────────────────────────────────

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const g = canvas.getContext('2d')
  if (!g) throw new Error('bandeira da marinha: sem canvas 2D')
  return [canvas, g]
}

/** Pano branco com a bainha do mastro, as costuras da beirada e o símbolo centrado no pano livre. */
function pintarBandeira(THREE: ThreeModule): Three.CanvasTexture {
  const [canvas, g] = tela(PANO_LARGURA_PX, PANO_ALTURA_PX)
  const L = PANO_LARGURA_PX
  const A = PANO_ALTURA_PX
  const bainha = 78
  const beirada = 14
  g.fillStyle = '#f3f2ee'
  g.fillRect(0, 0, L, A)
  g.fillStyle = '#ebe9e3'
  g.fillRect(0, 0, L, beirada)
  g.fillRect(0, A - beirada, L, beirada)
  g.fillRect(L - beirada, 0, beirada, A)
  g.fillStyle = '#e2e0d9'
  g.fillRect(0, 0, bainha, A)
  g.fillStyle = '#d3d0c8'
  g.fillRect(bainha - 3, 0, 3, A)
  g.fillRect(0, beirada, L, 2)
  g.fillRect(0, A - beirada - 2, L, 2)
  g.fillRect(L - beirada - 2, 0, 2, A)
  const escala = (0.64 * L) / 511
  const cx = bainha + (L - bainha) / 2
  g.save()
  g.setTransform(escala, 0, 0, escala, cx - 359.5 * escala, A / 2 - 269.5 * escala)
  desenharSimboloDaMarinha(g, AZUL_DA_MARINHA)
  g.restore()
  const textura = new THREE.CanvasTexture(canvas)
  textura.anisotropy = 8
  return textura
}

interface NomePintado {
  textura: Three.CanvasTexture
  /** Largura do texto (com o halo) em fração da largura da textura. */
  fracao: number
}

/** O nome em branco perolado, contorno azul-noite fino e um halo escuro largo para ler sobre os raios. */
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
  g.lineJoin = 'round'
  g.save()
  g.shadowColor = 'rgba(2, 9, 16, 0.75)'
  g.shadowBlur = px * 0.32
  g.fillStyle = 'rgba(2, 9, 16, 0.6)'
  g.fillText(nome, cx, base)
  g.restore()
  g.strokeStyle = '#06121f'
  g.lineWidth = px * 0.06
  g.strokeText(nome, cx, base)
  const face = g.createLinearGradient(0, base - subida, 0, base + descida)
  face.addColorStop(0, '#f5f8f8')
  face.addColorStop(0.55, '#dfe9ec')
  face.addColorStop(1, '#b9cdd3')
  g.fillStyle = face
  g.fillText(nome, cx, base)
  const textura = new THREE.CanvasTexture(canvas)
  return { textura, fracao: Math.min(1, (medida.width + px * 0.7) / NOME_LARGURA_PX) }
}

// ── Tempo ────────────────────────────────────────────────────────────────────

/** Altura média da água: entra já em velocidade, segura um instante no meio, acaba de encher e assenta. */
function nivelDaAgua(t: number): number {
  const T = ROTEIRO_DA_MARINHA
  if (t >= T.aguaCheia) {
    // A curva de subida chega em cima a (1 + PAUSA_NO_MEIO) vezes a velocidade média: continua dela e freia.
    const chegada = ((1 + PAUSA_NO_MEIO) * (NIVEL_ALTO - NIVEL_BAIXO)) / (T.aguaCheia - T.aguaSobe)
    const assenta = chegada * ASSENTA_S * (1 - Math.exp(-(t - T.aguaCheia) / ASSENTA_S))
    return NIVEL_ALTO + assenta + 0.9 * easeInOutSine(span(t, T.afundaInicio, T.duracao))
  }
  const u = span(t, T.aguaSobe, T.aguaCheia)
  const f = u + (PAUSA_NO_MEIO / (2 * Math.PI)) * Math.sin(2 * Math.PI * u)
  return NIVEL_BAIXO + (NIVEL_ALTO - NIVEL_BAIXO) * f
}

/** Fase da onda do pano: a integral da velocidade, que cai do ar para a água (função pura do tempo). */
function faseDoVento(t: number): number {
  const a = DESACELERA_INICIO
  const b = DESACELERA_FIM
  if (t <= a) return VENTO_NO_AR * t
  if (t <= b) {
    const s = t - a
    return VENTO_NO_AR * a + VENTO_NO_AR * s - ((VENTO_NO_AR - VENTO_NA_AGUA) * s * s) / (2 * (b - a))
  }
  return VENTO_NO_AR * a + ((VENTO_NO_AR + VENTO_NA_AGUA) / 2) * (b - a) + VENTO_NA_AGUA * (t - b)
}

/** Força do vento no pano: rajada logo no começo, depois firme; debaixo d'água o pano relaxa. */
function forcaDoVento(t: number): number {
  // A rajada bate de uma vez (seno) e some sem tranco (cosseno levantado até zero, com velocidade zero).
  const u = span(t, ROTEIRO_DA_MARINHA.rajadaInicio, 0.85)
  const rajada = 0.32 * (u < 0.5 ? Math.sin(Math.PI * u) : 0.5 + 0.5 * Math.cos(2 * Math.PI * (u - 0.5)))
  return 0.9 + rajada + 0.1 * easeInOutSine(span(t, 0, 0.5)) - 0.22 * easeInOutSine(span(t, DESACELERA_INICIO, DESACELERA_FIM))
}

/** Quão agitada a água chega: mansa no começo, forte na subida, assentando depois de cheia. */
function agitoDaAgua(t: number): number {
  const T = ROTEIRO_DA_MARINHA
  return 0.6 + 0.65 * span(t, T.aguaSobe - 0.1, T.aguaSobe + 0.3) - 0.55 * easeInOutSine(span(t, T.mergulho, T.duracao))
}

function pancada(tau: number, pico: number): number {
  if (tau <= 0) return 0
  return (tau / pico) * Math.exp(1 - tau / pico)
}

interface EstadoDaCamera {
  x: number
  y: number
  z: number
}

function estadoDaCamera(t: number, reduzir: boolean, distancia: number): EstadoDaCamera {
  const T = ROTEIRO_DA_MARINHA
  if (reduzir) return { x: 0, y: CAMERA_Y, z: distancia }
  const escala = distancia / DISTANCIA_BASE
  // Chega devagar no pano; balança pouco (vento); um tranco quando a água passa; afunda até o fim.
  const z = distancia * (1.05 - 0.05 * easeInOutSine(span(t, 0, 1.8)))
  const x = 0.03 * escala * Math.sin(t * 0.9)
  let y = CAMERA_Y + 0.02 * escala * Math.sin(t * 1.3 + 0.5)
  y -= 0.05 * escala * pancada(t - T.mergulho, 0.06)
  y -= 0.55 * escala * easeInOutSine(span(t, T.afundaInicio, T.duracao))
  return { x, y, z }
}

function fadeDaMarinha(t: number, reduzir: boolean): number {
  const T = ROTEIRO_DA_MARINHA
  const entrada = 1 - easeOutCubic(span(t, 0, T.fadeInFim))
  const saida = easeInOutSine(span(t, reduzir ? ROTEIRO_REDUZIDO.fadeOutInicio : T.fadeOutInicio, T.duracao))
  return Math.max(entrada, saida)
}

// ── Cena ─────────────────────────────────────────────────────────────────────

type Descartavel = { dispose: () => void }

export function criarCenaBandeiraDaMarinha(THREE: ThreeModule, opcoes: OpcoesDaMarinha): CenaTransicao {
  const reduzir = opcoes.reduzirMovimento
  const comNome = opcoes.semNome !== true
  const T = ROTEIRO_DA_MARINHA
  const R = ROTEIRO_REDUZIDO
  const lixo: Descartavel[] = []
  const guardar = <X extends Descartavel>(x: X): X => {
    lixo.push(x)
    return x
  }
  const vec3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const luz = vec3(LUZ[0], LUZ[1], LUZ[2]).normalize()

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 80)
  scene.add(camera)
  let aspecto = 16 / 9
  let distancia = DISTANCIA_BASE

  // A água é uma só: os mesmos objetos de uniform em todo material que molha.
  const agua = {
    uNivel: { value: NIVEL_BAIXO },
    uAgito: { value: 0.6 },
    uTempoAgua: { value: 0 },
    uMistura: { value: reduzir ? 0 : 1 },
  }
  const uTempoCeu = { value: 0 }

  // Céu (e o mar, quando a água chega à parede do fundo). Desenhado depois do
  // mastro e do pano: o teste de profundidade pula os pixels que eles já cobrem.
  const fundo = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(34, 18)),
    guardar(new THREE.ShaderMaterial({ vertexShader: VERTICE_MUNDO, fragmentShader: FRAG_FUNDO, uniforms: { ...agua, uTempoCeu }, depthWrite: false })),
  )
  fundo.position.set(0, -1, Z_FUNDO)
  fundo.renderOrder = 2.5
  fundo.frustumCulled = false
  scene.add(fundo)

  // Mastro e pomo: opacos, com profundidade (a superfície da água passa na frente e atrás deles).
  const solido = (cor: Three.Vector3, brilho: number) =>
    guardar(new THREE.ShaderMaterial({ vertexShader: VERTICE_SOLIDO, fragmentShader: FRAG_SOLIDO, uniforms: { ...agua, uCor: { value: cor }, uLuz: { value: luz }, uBrilho: { value: brilho } } }))
  const alturaDoMastro = 9
  const mastro = new THREE.Mesh(guardar(new THREE.CylinderGeometry(MASTRO_RAIO, MASTRO_RAIO * 1.1, alturaDoMastro, 18, 60, true)), solido(vec3(0.16, 0.18, 0.21), 0.3))
  mastro.position.set(MASTRO_X, MASTRO_TOPO - alturaDoMastro / 2, 0)
  mastro.renderOrder = 1
  const pomo = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.075, 24, 16)), solido(vec3(0.55, 0.46, 0.3), 0.5))
  pomo.position.set(MASTRO_X, MASTRO_TOPO + 0.06, 0)
  pomo.renderOrder = 1
  scene.add(mastro, pomo)

  // A bandeira: a grade de uv vira pano no shader.
  const uPano = {
    ...agua,
    uMapa: { value: guardar(pintarBandeira(THREE)) as Three.Texture },
    uLuz: { value: luz },
    uTempoCeu,
    uFase: { value: 0 },
    uForca: { value: 1 },
    uOndaK: { value: 1 },
    uPulso: { value: -1 },
    uPulsoForca: { value: 0 },
    uTamanho: { value: new THREE.Vector2(BANDEIRA_LARGURA, BANDEIRA_ALTURA) },
  }
  const bandeira = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(1, 1, 112, 72)),
    guardar(new THREE.ShaderMaterial({ vertexShader: VERTICE_PANO, fragmentShader: FRAG_PANO, uniforms: uPano, side: THREE.DoubleSide })),
  )
  bandeira.position.set(TALHA_X, BANDEIRA_Y, 0)
  bandeira.renderOrder = 2
  bandeira.frustumCulled = false
  scene.add(bandeira)

  // A superfície do mar, do vidro até a parede do fundo (some no movimento reduzido).
  const profundidadeDoTanque = Z_VIDRO - Z_FUNDO
  const geoSuperficie = guardar(new THREE.PlaneGeometry(26, profundidadeDoTanque, 160, 40))
  geoSuperficie.rotateX(-Math.PI / 2)
  const uSuperficie = { ...agua, uEspuma: { value: 0 } }
  const superficie = new THREE.Mesh(
    geoSuperficie,
    guardar(
      new THREE.ShaderMaterial({
        vertexShader: VERTICE_SUPERFICIE,
        fragmentShader: FRAG_SUPERFICIE,
        uniforms: uSuperficie,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    ),
  )
  superficie.position.set(0, 0, (Z_VIDRO + Z_FUNDO) / 2)
  superficie.renderOrder = 3
  superficie.frustumCulled = false
  superficie.visible = !reduzir
  scene.add(superficie)

  // O nome: um título diante da câmera, dentro da água.
  const pintado = comNome ? pintarNome(THREE, nomeDaBatalha(opcoes.nome)) : null
  const uNome = {
    uMapa: { value: (pintado ? guardar(pintado.textura) : null) as Three.Texture | null },
    uOpacidade: { value: 0 },
    uDesfoque: { value: 0 },
    uOndula: { value: reduzir ? 0 : 1 },
    uTempo: { value: 0 },
  }
  const nome = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(NOME_LARGURA, (NOME_LARGURA * NOME_ALTURA_PX) / NOME_LARGURA_PX)),
    guardar(
      new THREE.ShaderMaterial({
        vertexShader: VERTICE,
        fragmentShader: FRAG_NOME,
        uniforms: uNome,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    ),
  )
  nome.position.set(0, NOME_Y, -NOME_DISTANCIA)
  nome.renderOrder = 4
  nome.frustumCulled = false
  nome.visible = pintado !== null
  camera.add(nome)
  const larguraDoTexto = NOME_LARGURA * (pintado?.fracao ?? 0)

  // Por cima de tudo: espuma no vidro, raios de luz e vinheta.
  const uTela = {
    ...agua,
    uCam: { value: vec3(0, CAMERA_Y, DISTANCIA_BASE) },
    uTanMeio: { value: TAN_MEIO_FOV },
    uAspecto: { value: aspecto },
    uTempo: { value: 0 },
    uTempoRaios: { value: 0 },
    uRaios: { value: 1 },
    uEspumaVidro: { value: 0 },
  }
  const frente = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(1, 1)),
    guardar(
      new THREE.ShaderMaterial({
        vertexShader: VERTICE_TELA,
        fragmentShader: FRAG_TELA,
        uniforms: uTela,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    ),
  )
  frente.renderOrder = 5
  frente.frustumCulled = false
  scene.add(frente)

  function atualizar(tBruto: number) {
    const t = Math.min(T.duracao, Math.max(0, tBruto))
    const escala = distancia / DISTANCIA_BASE

    // Água: sobe (ou, no movimento reduzido, já está em cima e entra por dissolução).
    agua.uNivel.value = CAMERA_Y + (reduzir ? NIVEL_ALTO : nivelDaAgua(t)) * escala
    agua.uAgito.value = reduzir ? 0 : agitoDaAgua(t)
    agua.uTempoAgua.value = reduzir ? 0 : t
    agua.uMistura.value = reduzir ? easeInOutSine(span(t, R.aguaInicio, R.aguaFim)) : 1
    uTempoCeu.value = reduzir ? 0 : t
    uSuperficie.uEspuma.value = reduzir ? 0 : 0.35 + 0.65 * span(t, T.aguaSobe, T.aguaSobe + 0.4)

    // Pano: no reduzido, uma pose parada e bonita.
    if (reduzir) {
      uPano.uFase.value = 2.4
      uPano.uForca.value = 0.75
      uPano.uOndaK.value = 1
      uPano.uPulsoForca.value = 0
    } else {
      uPano.uFase.value = faseDoVento(t)
      uPano.uForca.value = forcaDoVento(t)
      uPano.uOndaK.value = 1 - 0.38 * easeInOutSine(span(t, DESACELERA_INICIO + 0.05, DESACELERA_FIM))
      const corre = span(t, T.rajadaInicio, T.estalo + 0.04)
      uPano.uPulso.value = -0.2 + 1.45 * corre
      uPano.uPulsoForca.value = Math.sin(Math.PI * clamp01(corre * 1.08)) * (t >= T.rajadaInicio ? 1 : 0)
    }

    // Câmera.
    const c = estadoDaCamera(t, reduzir, distancia)
    camera.position.set(c.x, c.y, c.z)
    uTela.uCam.value.set(c.x, c.y, c.z)
    uTela.uTempo.value = reduzir ? 0 : t
    uTela.uTempoRaios.value = reduzir ? 1.5 : t
    uTela.uEspumaVidro.value = reduzir ? 0 : 1
    uTela.uRaios.value = reduzir ? 0.8 : 0.55 + 0.45 * span(t, T.mergulho - 0.4, T.mergulho + 0.2)

    // Nome: chega do borrão para o foco, subindo um pouco, e fica.
    if (pintado) {
      uNome.uTempo.value = t
      if (reduzir) {
        uNome.uOpacidade.value = easeOutCubic(span(t, R.nomeSurge, R.nomeAceso))
        uNome.uDesfoque.value = 0
        nome.position.y = NOME_Y
      } else {
        const chega = easeOutCubic(span(t, T.nomeSurge, T.nomeNitido))
        uNome.uOpacidade.value = easeOutCubic(span(t, T.nomeSurge, T.nomeSurge + 0.38))
        uNome.uDesfoque.value = 4 * (1 - chega)
        nome.position.y = NOME_Y - 0.06 * (1 - chega)
        const s = (0.97 + 0.03 * chega) * escalaDoNome
        nome.scale.set(s, s, 1)
      }
      // Antes de surgir, o plano do nome nem é desenhado.
      nome.visible = uNome.uOpacidade.value > 0.001
    }

    return { fade: fadeDaMarinha(t, reduzir) }
  }

  let escalaDoNome = 1
  function ajustarTela(novo: number) {
    aspecto = Math.max(0.2, novo)
    const metadeVisivel = TAN_MEIO_FOV * aspecto
    distancia = Math.max(DISTANCIA_BASE, MEIA_LARGURA_DO_CONJUNTO / metadeVisivel)
    camera.aspect = aspecto
    camera.updateProjectionMatrix()
    uTela.uAspecto.value = aspecto
    // O nome cabe em 86% da largura visível na distância dele.
    const larguraVisivel = 2 * NOME_DISTANCIA * metadeVisivel
    escalaDoNome = larguraDoTexto > 0 ? Math.min(1, (0.86 * larguraVisivel) / larguraDoTexto) : 1
    nome.scale.set(escalaDoNome, escalaDoNome, 1)
  }

  function descartar() {
    for (const coisa of lixo) coisa.dispose()
    lixo.length = 0
  }

  ajustarTela(aspecto)
  atualizar(0)

  return { scene, camera, atualizar, ajustarTela, criarSom: (kit: KitDeSom) => criarSomDaMarinha(kit, reduzir), descartar }
}

// ── Som (sintetizado) ────────────────────────────────────────────────────────

interface Saida {
  ctx: AudioContext
  seco: AudioNode
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

/** Ruído do kit em laço, começando num ponto qualquer (vento e mar não saem iguais). */
function ruidoEmLaco(s: Saida, a: number, duracao: number, inicio: number, filtros: BiquadFilterNode[], ganho: AudioNode) {
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

/** Vento forte de mar: rajada no começo, firme, abafa e some quando a água cobre tudo. */
function vento(s: Saida, base: number, debaixo: number, reduzir: boolean) {
  const { ctx } = s
  const passaBaixa = filtro(ctx, 'lowpass', 1300, 0.5)
  passaBaixa.frequency.setValueAtTime(1300, base)
  if (!reduzir) {
    passaBaixa.frequency.linearRampToValueAtTime(2600, base + 0.3)
    passaBaixa.frequency.linearRampToValueAtTime(1500, base + 0.9)
  }
  passaBaixa.frequency.setValueAtTime(1500, base + debaixo - 0.25)
  passaBaixa.frequency.exponentialRampToValueAtTime(260, base + debaixo + 0.05)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, base)
  g.gain.exponentialRampToValueAtTime(reduzir ? 0.2 : 0.3, base + 0.12)
  if (!reduzir) g.gain.exponentialRampToValueAtTime(0.42, base + 0.3)
  g.gain.exponentialRampToValueAtTime(reduzir ? 0.18 : 0.27, base + 0.9)
  g.gain.setValueAtTime(reduzir ? 0.18 : 0.27, base + debaixo - 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, base + debaixo + 0.3)
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(-0.35, base)
  p.pan.linearRampToValueAtTime(0.3, base + debaixo)
  g.connect(p)
  p.connect(s.seco)
  ruidoEmLaco(s, base, debaixo + 0.4, 0.3, [filtro(ctx, 'bandpass', 520, 0.55), passaBaixa], g)
}

/** Um baque do pano grande a cada onda, e o tremido fino da ponta por baixo. */
function tremulado(s: Saida, base: number, debaixo: number) {
  const { ctx } = s
  const rnd = semente(4242)
  for (let i = 0; ; i++) {
    const quando = 0.06 + i / 2.15 + (rnd() - 0.5) * 0.05
    if (quando > debaixo - 0.35) break
    const forca = (i === 0 ? 0.7 : 1) * (1 - 0.6 * span(quando, debaixo - 1, debaixo - 0.35))
    const g = ctx.createGain()
    envelope(g, base + quando, 0.2 * forca, 0.012, 0.11)
    const p = ctx.createStereoPanner()
    p.pan.value = (i % 2 === 0 ? -1 : 1) * 0.2
    g.connect(p)
    p.connect(s.seco)
    ruidoEmLaco(s, base + quando, 0.16, rnd() * 2, [filtro(ctx, 'bandpass', 380, 1.1)], g)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, base)
  g.gain.exponentialRampToValueAtTime(0.05, base + 0.25)
  g.gain.setValueAtTime(0.05, base + debaixo - 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, base + debaixo - 0.1)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 11
  const profundidade = ctx.createGain()
  profundidade.gain.value = 0.04
  lfo.connect(profundidade)
  profundidade.connect(g.gain)
  lfo.start(base)
  lfo.stop(base + debaixo)
  g.connect(s.seco)
  ruidoEmLaco(s, base, debaixo, 1.1, [filtro(ctx, 'bandpass', 1100, 0.9)], g)
}

/** O estalo do pano quando a rajada chega na ponta: chicote seco e o corpo grave do tecido. */
function estalo(s: Saida, a: number) {
  const { ctx } = s
  const p = ctx.createStereoPanner()
  p.pan.value = 0.3
  p.connect(s.seco)
  const seco = ctx.createGain()
  envelope(seco, a, 0.5, 0.002, 0.09)
  seco.connect(p)
  ruidoEmLaco(s, a, 0.14, 0.7, [filtro(ctx, 'highpass', 700), filtro(ctx, 'bandpass', 1700, 0.8)], seco)
  const corpo = ctx.createGain()
  envelope(corpo, a, 0.38, 0.004, 0.16)
  corpo.connect(p)
  ruidoEmLaco(s, a, 0.22, 1.3, [filtro(ctx, 'bandpass', 170, 1.3)], corpo)
}

/** O mar subindo: ronco que abre até o mergulho, abafa debaixo d'água e vai embora no escuro. */
function mar(s: Saida, base: number, comeco: number, debaixo: number, fim: number, reduzir: boolean) {
  const { ctx } = s
  const passaBaixa = filtro(ctx, 'lowpass', 220, 0.6)
  passaBaixa.frequency.setValueAtTime(220, base + comeco)
  passaBaixa.frequency.exponentialRampToValueAtTime(reduzir ? 700 : 1500, base + debaixo - 0.05)
  passaBaixa.frequency.exponentialRampToValueAtTime(380, base + debaixo + 0.12)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, base + comeco)
  g.gain.exponentialRampToValueAtTime(reduzir ? 0.25 : 0.5, base + debaixo - 0.1)
  g.gain.exponentialRampToValueAtTime(0.3, base + debaixo + 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, base + fim)
  const balanco = ctx.createOscillator()
  balanco.frequency.value = 0.7
  const fundoDoBalanco = ctx.createGain()
  fundoDoBalanco.gain.value = 0.08
  balanco.connect(fundoDoBalanco)
  fundoDoBalanco.connect(g.gain)
  balanco.start(base + comeco)
  balanco.stop(base + fim)
  g.connect(s.seco)
  ruidoEmLaco(s, base + comeco, fim - comeco, 0.9, [passaBaixa, filtro(ctx, 'peaking', 420, 0.8)], g)
}

/** O mergulho: um "vum" grave que despenca e o baque abafado da água fechando. */
function mergulho(s: Saida, a: number, forca: number) {
  const { ctx } = s
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(95, a)
  osc.frequency.exponentialRampToValueAtTime(34, a + 0.45)
  const g = ctx.createGain()
  envelope(g, a, 0.55 * forca, 0.01, 0.6)
  osc.connect(g)
  g.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.7)
  const baque = ctx.createGain()
  envelope(baque, a, 0.4 * forca, 0.006, 0.45)
  baque.connect(s.seco)
  ruidoEmLaco(s, a, 0.55, 0.2, [filtro(ctx, 'lowpass', 750, 0.8)], baque)
}

/** Fundo do mar: ruído grave e manso até o fim. */
function fundoDoMar(s: Saida, a: number, fim: number) {
  const { ctx } = s
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(0.2, a + 0.35)
  g.gain.exponentialRampToValueAtTime(0.13, fim - 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, fim)
  g.connect(s.seco)
  ruidoEmLaco(s, a, fim - a, 1.6, [filtro(ctx, 'lowpass', 300, 0.7)], g)
}

/** Uma bolha: seno curto que sobe de tom, abafado. */
function bolha(s: Saida, a: number, de: number, volume: number) {
  const { ctx } = s
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(de, a)
  osc.frequency.exponentialRampToValueAtTime(de * 2.5, a + 0.05)
  const g = ctx.createGain()
  envelope(g, a, volume, 0.004, 0.06)
  const abafa = filtro(ctx, 'lowpass', 1600)
  osc.connect(abafa)
  abafa.connect(g)
  g.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.1)
}

/** O apito grave de navio, longe e debaixo d'água: duas notas (ré e lá) levemente desafinadas. */
function apito(s: Saida, a: number, fim: number) {
  const { ctx } = s
  const abafa = filtro(ctx, 'lowpass', 420, 0.9)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(0.16, a + 0.4)
  g.gain.setValueAtTime(0.16, fim - 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, fim)
  abafa.connect(g)
  g.connect(s.seco)
  const mistura = ctx.createGain()
  mistura.gain.value = 0.25
  mistura.connect(abafa)
  const notas: [number, number][] = [
    [73.4, -4],
    [73.4, 4],
    [110, -3],
    [110, 3],
  ]
  for (const [frequencia, desafina] of notas) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = frequencia
    osc.detune.value = desafina
    osc.connect(mistura)
    osc.start(a)
    osc.stop(fim + 0.05)
  }
}

/** Cada pista recebe a hora do áudio que corresponde ao t = 0 da cena. */
type Pista = [nome: string, quando: number, tocar: (base: number) => void]

function criarSomDaMarinha(kitDoMotor: KitDeSom, reduzir: boolean) {
  const { ctx } = kitDoMotor
  // Limitador na saída: no mergulho somam vento, mar, baque e apito.
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -10
  limitador.knee.value = 6
  limitador.ratio.value = 12
  limitador.attack.value = 0.003
  limitador.release.value = 0.25
  limitador.connect(kitDoMotor.destino)
  const s: Saida = { ctx, seco: limitador, ruido: kitDoMotor.ruido }
  const T = ROTEIRO_DA_MARINHA
  const R = ROTEIRO_REDUZIDO
  const pistas: Pista[] = reduzir
    ? [
        ['vento', 0, (base) => vento(s, base, R.aguaFim, true)],
        ['mar', R.aguaInicio - 0.2, (base) => mar(s, base, R.aguaInicio - 0.2, R.aguaFim, T.duracao, true)],
        ['mergulho', R.aguaFim - 0.1, (base) => mergulho(s, base + R.aguaFim - 0.1, 0.5)],
        ['fundo', R.aguaFim - 0.1, (base) => fundoDoMar(s, base + R.aguaFim - 0.1, base + T.duracao)],
        ['apito', R.aguaFim, (base) => apito(s, base + R.aguaFim, base + T.duracao)],
      ]
    : [
        ['vento', 0, (base) => vento(s, base, T.mergulho, false)],
        ['tremulado', 0, (base) => tremulado(s, base, T.mergulho)],
        ['estalo', T.estalo, (base) => estalo(s, base + T.estalo)],
        ['mar', T.aguaSobe - 0.18, (base) => mar(s, base, T.aguaSobe - 0.18, T.mergulho, T.duracao, false)],
        ['mergulho', T.mergulho, (base) => mergulho(s, base + T.mergulho, 1)],
        ['fundo', T.mergulho, (base) => fundoDoMar(s, base + T.mergulho, base + T.duracao)],
        [
          'bolhas',
          T.mergulho + 0.06,
          (base) => {
            const bolhas: [number, number, number][] = [
              [0.06, 340, 0.12],
              [0.19, 460, 0.08],
              [0.42, 300, 0.1],
              [0.71, 520, 0.06],
            ]
            for (const [atraso, de, volume] of bolhas) bolha(s, base + T.mergulho + atraso, de, volume)
          },
        ],
        ['apito', T.mergulho + 0.12, (base) => apito(s, base + T.mergulho + 0.12, base + T.duracao)],
      ]
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

const criar: CriarCena = criarCenaBandeiraDaMarinha
export default criar

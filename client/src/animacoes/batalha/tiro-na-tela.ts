import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'
import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Tiro na tela: a quarta abertura de batalha (pedido de 29/10/2026, "uma
 * animação de um revolver girando e atirando na tela e tela quebrando";
 * protótipo em docs/design/transicao-batalha-revolver/). Esta pasta espelha
 * `client/src`: o arquivo entra como está em `client/src/animacoes/batalha/`.
 *
 * Um revólver de aço velho, de cano comprido e cabo de nogueira quadriculado
 * (desenho próprio, sem marca), sobe girando no dedo pelo guarda-mato, o giro
 * de pistoleiro, e o metal pega a luz a cada volta. A mão o pega seco e o
 * pulso o vira para quem está olhando. O cão engatilha; o tiro: clarão na
 * boca, o recuo, e a bala acerta o vidro da tela. A rachadura nasce em estrela
 * no ponto do impacto e corre pela tela; o nome aparece pintado a folha de
 * ouro no vidro, como letreiro de saloon; o vidro cede e os cacos caem,
 * levando o nome junto. O motor fecha em preto e o mapa entra dali.
 *
 * Contrato: o mesmo `CriarCena` das transições (`src/transicoes/tipos.ts`),
 * com o `nome` opcional das aberturas. Nome ausente, vazio ou só espaço = sem
 * nome: a arma fica no meio da tela e a pista de som do nome fica fora.
 *
 * Como desenha: o revólver é geometria de verdade (o giro e a virada para a
 * tela pedem 3D) e vai para uma textura própria, desenhada no `onBeforeRender`
 * do vidro, o mesmo jeito do `Reflector` do three. O vidro é UMA malha de cacos
 * na tela inteira: cada caco carrega o pedaço da imagem que cobria, então a
 * imagem quebra e cai junto. Os materiais da arma são `RawShaderMaterial`: o
 * programa deles não depende do alvo do desenho, e assim a compilação antes do
 * relógio (`compileAsync` do motor) vale também para a passada da textura.
 * Sem luz na cena e sem imagem externa: o nome é pintado em canvas na montagem.
 */

export const NOME_MAX_LETRAS = 24

/** Roteiro em segundos (movimento completo, tela 16:9). */
export const ROTEIRO_DO_TIRO = {
  duracao: 3.8,
  fadeInFim: 0.12,
  /** O revólver sobe de baixo já girando (saiu do coldre). */
  sobeFim: 0.55,
  /** A mão pega: o giro para seco, cano para a esquerda. */
  pega: 1.12,
  /** O pulso vira a arma para a tela. */
  miraInicio: 1.17,
  miraFim: 1.45,
  /** O cão vai para trás e o tambor roda uma câmara. */
  engatilha: 1.6,
  tiro: 1.92,
  /** A bala chega ao vidro um quadro depois do clarão. */
  impacto: 1.935,
  /** As rachaduras em raio chegam às bordas; os anéis vêm atrás. */
  raiosFim: 2.22,
  aneisFim: 2.4,
  nomeSurge: 2.2,
  nomeNitido: 2.58,
  /** O vidro range (estalinhos) e cede. */
  range: 2.82,
  cede: 3.05,
  fadeOutInicio: 3.6,
} as const

/** Com movimento reduzido: a arma já está mirando, nada gira, nada treme, nada cai; o vidro racha por dissolução. */
export const ROTEIRO_REDUZIDO = {
  surgeInicio: 0.1,
  surgeFim: 0.75,
  engatilha: 1.25,
  tiro: 1.7,
  rachaFim: 2.0,
  nomeSurge: 2.05,
  nomeAceso: 2.45,
  apagaInicio: 3.1,
  apagaFim: 3.55,
  fadeOutInicio: 3.45,
} as const

export interface OpcoesDoTiro extends OpcoesDaCena {
  /** O nome pintado no vidro (grupo, inimigo). Ausente ou vazio = sem nome. */
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
const FOCAL = 1 / TAN_MEIO_FOV
/** A arma é desenhada na camada 1: só a câmera da arma a vê; a câmera do motor só vê o vidro. */
const CAMADA_DA_ARMA = 1
/** Lado maior da textura da arma (tela de alta densidade desenha a arma nesse teto). */
const RT_LADO_MAX = 2560
/** Enquanto gira, a arma vai para uma textura com 60% do lado (o borrão do giro cobre a diferença). */
const ESCALA_NO_GIRO = 0.6
/** Folga da caixa da arma, no espaço do desenho (o cão engatilhado sai um pouco da caixa em repouso). */
const FOLGA_DA_CAIXA = 0.15

// O desenho da arma, de perfil pelo lado esquerdo: x para o cabo, y para cima,
// z para quem olha; 1 unidade = uns 75 mm. A boca fica em -x.
/** O pivô do giro: o dedo dentro do guarda-mato. */
const PIVO_X = -0.12
const PIVO_Y = -0.02
const EIXO_DO_CANO_Y = 0.705
const EIXO_DO_TAMBOR_Y = 0.55
const BOCA_X = -2.16
/** Onde a mão segura no recuo (o arco entre o polegar e o indicador). */
const MAO_X = 0.8
const MAO_Y = 0.12
/** O cão gira no pino dele; engatilhado vai 0,62 rad para trás. */
const CAO_X = 0.36
const CAO_Y = 0.6
const CAO_ENGATILHADO = 0.62
/** Raio da volta do giro (a boca é o ponto mais longe do dedo). */
const RAIO_DO_GIRO = Math.hypot(BOCA_X - PIVO_X, EIXO_DO_CANO_Y - PIVO_Y)

/**
 * Na mira o pulso vira a boca para a câmera, em três quartos (32 graus de lado): a boca e a alma
 * olham para quem vê, e o lado da arma continua à mostra (o cão engatilhando aparece contra o
 * fundo). Arfagem positiva levanta a boca.
 */
const GUINADA_MIRA = (58 * Math.PI) / 180
const ARFAGEM_MIRA = (-3 * Math.PI) / 180
/** Recuo: a boca sobe até 17 graus e a arma vem 0,2 para trás. */
const RECUO_ANGULO = (13 * Math.PI) / 180
const RECUO_TRAS = 0.2

/** Distância (em z) da câmera ao pivô no giro e à boca na mira. */
const DISTANCIA_GIRO = 7.3
const DISTANCIA_BOCA = 3.3
const APROXIMA_ATE_O_TIRO = 0.32
/** Onde, na tela (unidades de altura: -1 a 1), ficam o pivô no giro e a boca na mira. */
const TELA_GIRO_X = 0.05
const TELA_GIRO_Y_COM_NOME = 0.04
const TELA_GIRO_Y_SEM_NOME = 0.0
const TELA_MIRA_X = -0.3
const TELA_MIRA_Y_COM_NOME = 0.3
const TELA_MIRA_Y_SEM_NOME = 0.16
/** A bala bate no vidro onde a linha do cano está a 0,3 da boca (logo à frente do clarão). */
const BALA_ATE_O_VIDRO = 0.3

/** O giro: voltas por segundo no começo e quando a mão pega, e a curva do freio. */
const GIRO_INICIAL = 4.4
const GIRO_FINAL = 1.35
const GIRO_CURVA = 1.6
const GIRO_VOLTAS = GIRO_FINAL * ROTEIRO_DO_TIRO.pega + ((GIRO_INICIAL - GIRO_FINAL) * ROTEIRO_DO_TIRO.pega) / (GIRO_CURVA + 1)
/** A pega: o tranco que sobra quando a mão segura (oscilação curta, amortecida). */
const PEGA_HZ = 10
const PEGA_AMORTECE = 22
/** Obturador de meio quadro e um pouco: o borrão do giro. */
const OBTURADOR_S = 0.0135

const NOME_LARGURA_PX = 2048
const NOME_ALTURA_PX = 512
const NOME_FONTE_MAX_PX = 290
const NOME_LARGURA_UTIL_PX = 1640
/** O letreiro no vidro: centro na altura -0,62 da tela, até 2,1 unidades de largura (a textura inteira). */
const NOME_Y = -0.62
const NOME_LARGURA_MAX = 2.1
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

/**
 * A malha dos cacos. `position.xy` é o ponto em repouso, contado do impacto
 * (unidades de altura da tela). Caído, cada caco gira no próprio centro, cai
 * com a gravidade, abre para fora e vem para quem olha (a perspectiva é feita
 * aqui: o olho fica 2,2 à frente do vidro).
 */
const VERT_VIDRO = /* glsl */ `
attribute vec2 aPivo;
attribute vec4 aCaco;
attribute float aBorda;
attribute float aRacha;
attribute float aLinha;
uniform vec2 uImpacto;
uniform float uAspecto;
uniform float uQueda;
uniform vec2 uTremor;
varying vec2 vTela;
varying vec2 vRel;
varying vec4 vCaco;
varying float vBorda;
varying float vRacha;
varying float vLinha;
varying vec3 vNormal;
varying vec3 vP;
varying float vQueda;
const float GRAVIDADE = 7.5;
const float OLHO = 2.2;
mat3 girar(vec3 e, float a) {
  float c = cos(a);
  float s = sin(a);
  float t = 1.0 - c;
  return mat3(
    t * e.x * e.x + c, t * e.x * e.y + s * e.z, t * e.x * e.z - s * e.y,
    t * e.x * e.y - s * e.z, t * e.y * e.y + c, t * e.y * e.z + s * e.x,
    t * e.x * e.z + s * e.y, t * e.y * e.z - s * e.x, t * e.z * e.z + c);
}
void main() {
  vec2 p = uImpacto + position.xy;
  vTela = p;
  vRel = position.xy;
  vCaco = aCaco;
  vBorda = aBorda;
  vRacha = aRacha;
  vLinha = aLinha;
  vec3 P = vec3(p, 0.0);
  vec3 N = vec3(0.0, 0.0, 1.0);
  float tq = uQueda - aCaco.w;
  vQueda = max(tq, 0.0);
  if (tq > 0.0) {
    vec2 c = uImpacto + aPivo;
    vec3 eixo = normalize(vec3(aCaco.x - 0.5, aCaco.y - 0.5, (aCaco.z - 0.5) * 0.5) + vec3(0.0, 0.0, 0.001));
    float sentido = aCaco.z > 0.5 ? 1.0 : -1.0;
    mat3 R = girar(eixo, sentido * (2.5 + 6.5 * aCaco.x) * tq);
    P = vec3(c, 0.0) + R * vec3(p - c, 0.0);
    N = R * N;
    vec2 fora = aPivo / (0.25 + length(aPivo));
    P.xy += fora * (0.35 + 0.5 * aCaco.y) * tq;
    P.y -= 0.5 * GRAVIDADE * tq * tq;
    P.z += (0.35 + 0.9 * aCaco.x) * tq;
  }
  vNormal = N;
  vP = P;
  // A perspectiva vai no w: a GPU interpola o caco inclinado sem torcer a imagem dele.
  float w = max(0.2, 1.0 - P.z / OLHO);
  vec2 tela = P.xy + uTremor * w;
  gl_Position = vec4(tela.x / uAspecto, tela.y, clamp(-P.z * 0.3, -0.95, 0.95) * w, w);
}`

/**
 * Tudo o que a tela mostra, desenhado no ponto do vidro: o fundo (escuro
 * quente, um facho de luz empoeirada de cima), a arma (da textura, com o
 * borrão do giro), o clarão, a fumaça; e o vidro por cima: o pó do furo, as
 * rachaduras com luz na borda, o nome em folha de ouro e, caindo, o reflexo
 * de cada caco.
 */
const FRAG_VIDRO = /* glsl */ `
${GLSL_RUIDO}
uniform float uTempo;
uniform float uAspecto;
uniform float uLuz;
uniform sampler2D uArma;
uniform vec4 uCaixaArma;
uniform float uAlcanceDoClarao;
uniform vec2 uPivo;
uniform float uArco;
uniform float uRaioArma;
uniform float uPxPorUnidade;
uniform float uSurgeArma;
uniform vec2 uBoca;
uniform vec2 uDirTiro;
uniform float uClarao;
uniform float uBola;
uniform float uFumaca;
uniform float uIdadeDaFumaca;
uniform float uBrilho;
uniform vec2 uBrilhoPos;
uniform float uRacha;
uniform float uFrenteR;
uniform float uFrenteA;
uniform float uRevela;
uniform float uLuzDoImpacto;
uniform float uOnda;
uniform sampler2D uNome;
uniform vec4 uNomeRet;
uniform float uNomeSurge;
uniform float uVarre;
uniform float uGrao;
varying vec2 vTela;
varying vec2 vRel;
varying vec4 vCaco;
varying float vBorda;
varying float vRacha;
varying float vLinha;
varying vec3 vNormal;
varying vec3 vP;
varying float vQueda;
const float OLHO = 2.2;

vec2 paraUv(vec2 p) {
  return vec2(p.x / uAspecto, p.y) * 0.5 + 0.5;
}

// A arma da textura; girando, a média de até 10 amostras no arco em volta do dedo (uma a cada
// 2 pixels da textura: no giro ela é desenhada em resolução menor, e o borrão esconde isso).
vec4 arma(vec2 p) {
  vec2 rel = p - uPivo;
  float r = length(rel);
  float n = clamp(floor(uArco * r * uPxPorUnidade / 2.0), 1.0, 10.0);
  if (r > uRaioArma) n = 1.0;
  vec4 soma = vec4(0.0);
  for (int k = 0; k < 10; k++) {
    if (float(k) >= n) break;
    float a = uArco * ((float(k) + 0.5) / n - 0.5);
    float c = cos(a);
    float s = sin(a);
    vec2 uv = paraUv(uPivo + vec2(c * rel.x - s * rel.y, s * rel.x + c * rel.y));
    // A textura só é limpa e desenhada dentro da caixa da arma: fora dela, sobra de outro quadro.
    vec2 dentro = step(uCaixaArma.xy, uv) * step(uv, uCaixaArma.zw);
    soma += texture2D(uArma, uv) * (dentro.x * dentro.y);
  }
  return soma / n;
}

float poeira(vec2 p) {
  vec2 q = p * 7.0 + vec2(uTempo * 0.21, -uTempo * 0.09);
  vec2 i = floor(q);
  vec2 f = fract(q);
  float h = hash(i);
  vec2 c = vec2(hash(i + 17.3), hash(i + 41.9)) * 0.6 + 0.2 + 0.12 * vec2(sin(uTempo * (0.8 + h) + h * 30.0), cos(uTempo * (0.7 + h) + h * 21.0));
  return smoothstep(0.035 + 0.03 * h, 0.0, length(f - c)) * step(0.86, h) * (0.35 + 0.65 * hash(i + 3.1));
}

// Lampiões desfocados no fundo do salão: manchas quentes e macias, bem fracas.
float lampiao(vec2 p, vec2 c, float r) {
  return smoothstep(r, r * 0.55, length(p - c));
}

vec3 fundo(vec2 p) {
  vec3 cor = mix(vec3(0.07, 0.042, 0.024), vec3(0.01, 0.007, 0.005), smoothstep(0.05, 1.35, length(p * vec2(0.6, 1.0) - vec2(-0.06, 0.15))));
  cor += vec3(0.55, 0.3, 0.1) * (lampiao(p, vec2(1.32, 0.52), 0.12) * 0.11 + lampiao(p, vec2(1.62, 0.38), 0.07) * 0.08 + lampiao(p, vec2(-1.38, -0.42), 0.15) * 0.06 + lampiao(p, vec2(0.92, -0.7), 0.09) * 0.05) * (0.3 + 0.7 * uLuz);
  // O facho entra pelo alto à esquerda e passa pelo meio da tela, onde a arma gira.
  vec2 dir = normalize(vec2(0.5, -0.87));
  vec2 q = p - vec2(-1.05, 1.45);
  float ao = dot(q, dir);
  float at = abs(dot(q, vec2(-dir.y, dir.x)));
  float largura = 0.16 + 0.24 * max(ao, 0.0);
  float feixe = smoothstep(largura, largura * 0.2, at) * smoothstep(0.0, 0.5, ao) * exp(-max(ao, 0.0) * 0.36);
  // O facho e a poeira que boia nele só onde há facho (os ruídos são a parte cara do fundo).
  if (feixe > 0.001) {
    feixe *= 0.45 + 0.75 * fbm3(p * 1.7 + vec2(uTempo * 0.06, -uTempo * 0.03));
    cor += vec3(0.36, 0.21, 0.095) * feixe * uLuz;
    cor += vec3(1.0, 0.82, 0.56) * poeira(p) * (0.02 + 1.2 * feixe) * uLuz;
  }
  return cor;
}

vec3 luzDoClarao(vec2 p) {
  if (uClarao < 0.002 && uBola < 0.01) return vec3(0.0);
  vec2 d = p - uBoca;
  float r = length(d);
  // Além do alcance (onde o clarão já não soma nem 1/300), não calcula nada.
  if (r > uAlcanceDoClarao) return vec3(0.0);
  float ang = atan(d.y, d.x);
  float nucleo = exp(-r * r / 0.0035);
  float halo = exp(-r / 0.17);
  float raios = pow(abs(cos(ang * 3.0 + 0.5)), 26.0) * exp(-r / 0.34) + 0.6 * pow(abs(cos(ang * 2.0 + 1.3)), 40.0) * exp(-r / 0.5);
  vec3 c = (vec3(1.0, 0.95, 0.82) * nucleo * 3.2 + vec3(1.0, 0.6, 0.22) * (halo * 0.9 + raios * 0.85)) * uClarao;
  // A língua de fogo: sai da boca no rumo do cano e abre como um cone.
  float ao = dot(d, uDirTiro);
  float at = dot(d, vec2(-uDirTiro.y, uDirTiro.x));
  float lingua = smoothstep(-0.01, 0.03, ao) * exp(-max(ao, 0.0) / 0.15) * exp(-at * at / (0.0008 + 0.06 * ao * ao));
  c += vec3(1.0, 0.72, 0.34) * lingua * 1.7 * uClarao;
  if (uBola > 0.01 && r < 0.5) {
    float b = fbm3(d * 8.0 + vec2(3.1, 7.7) + uTempo);
    c += vec3(1.0, 0.42, 0.1) * smoothstep(0.42, 0.0, r + 0.12 * (b - 0.5)) * uBola * 0.85;
  }
  return c;
}

vec3 fumaca(vec3 cor, vec2 p) {
  if (uFumaca < 0.002) return cor;
  float idade = uIdadeDaFumaca;
  vec2 centro = uBoca + vec2(0.06, 0.12) * idade + vec2(0.0, 0.05) * idade * idade;
  float raio = 0.08 + 0.42 * (1.0 - exp(-idade / 0.35));
  vec2 d = (p - centro) / raio;
  vec2 w = p - uBoca;
  // Longe da nuvem e do fio que sobe, não há fumaça: pula o ruído. (A nuvem acaba em
  // |d| + 0,55 (n - 0,5) = 1, então nunca passa de |d| = 1,275, ou d·d = 1,63.)
  if (dot(d, d) > 1.65 && (w.y < -0.03 || abs(w.x) > 0.25 + 0.2 * max(w.y, 0.0))) return cor;
  float n = fbm3(d * 1.9 + vec2(idade * 0.6, -idade * 1.1));
  float a = smoothstep(1.0, 0.15, length(d) + 0.55 * (n - 0.5)) * uFumaca;
  // O fio de fumaça que sobe da boca.
  float coluna = exp(-pow((w.x - 0.04 * sin(w.y * 7.0 + uTempo * 2.0)) / (0.02 + 0.06 * max(w.y, 0.0)), 2.0)) * smoothstep(-0.02, 0.05, w.y) * exp(-max(w.y, 0.0) / 0.5);
  a = max(a, coluna * uFumaca * 0.6 * smoothstep(0.25, 0.6, idade) * (0.4 + 0.6 * ruido(vec2(w.x * 20.0, w.y * 6.0 - uTempo * 1.5))));
  vec3 c = vec3(0.3, 0.27, 0.24) + vec3(0.22, 0.13, 0.05) * smoothstep(0.45, 1.0, n);
  return mix(cor, c * (0.5 + 0.5 * uLuz), clamp(a, 0.0, 1.0) * 0.7);
}

vec3 mundo(vec2 p) {
  vec3 cor = fundo(p);
  vec4 a = arma(p) * uSurgeArma;
  cor = cor * (1.0 - a.a) + a.rgb;
  cor += vec3(0.3, 0.15, 0.055) * uClarao * 0.5;
  cor = fumaca(cor, p);
  cor += luzDoClarao(p);
  if (uBrilho > 0.001) {
    vec2 d = p - uBrilhoPos;
    // O lampejo do aço: miolo, halo e uma cruz fina (o "tim" de luz de faroeste).
    float estrela = exp(-dot(d, d) / 0.00018) * 2.2 + exp(-length(d) / 0.05) * 0.35 + 1.1 * (exp(-abs(d.y) / 0.003) * exp(-abs(d.x) / 0.16) + exp(-abs(d.x) / 0.003) * exp(-abs(d.y) / 0.13));
    cor += vec3(1.0, 0.93, 0.8) * estrela * uBrilho;
  }
  return cor;
}

void main() {
  float r0 = length(vRel);
  vec2 dir = vRel / max(r0, 0.00001);
  // Onde este ponto do vidro olha o mundo: o lugar dele, o desvio do caco e a onda do impacto.
  // O caco só entorta depois que a rachadura passou por ele.
  float alcancado = smoothstep(uFrenteR + 0.02, uFrenteR - 0.25, r0) * uRacha;
  vec2 p = vTela + (vCaco.xy - 0.5) * 0.016 * alcancado;
  // A onda do impacto some em 0,6 s (exp(-0,6/0,11) < 0,005): depois disso, nem calcula.
  if (uOnda >= 0.0 && uOnda < 0.6) {
    float banda = exp(-pow((r0 - uOnda * 3.6) / 0.08, 2.0)) * exp(-uOnda / 0.11);
    p += dir * banda * 0.02;
  }
  vec3 cor = mundo(p);

  // Cada caco ficou um pouco torto: uns refletem mais.
  cor += vec3(0.05, 0.055, 0.06) * alcancado * uRevela * pow(vCaco.z, 4.0) * (0.4 + 0.6 * uLuz);

  // O pó de vidro em volta do furo (um anel fosco, riscado do centro para fora), e o furo.
  // (o pó alcança no máximo 0,23 do furo: fora disso, pula os ruídos)
  if (uRacha > 0.0 && r0 < 0.3) {
    float n = ruido(dir * 7.0 + vec2(r0 * 28.0, r0 * 9.0));
    float riscos = ruido(dir * 14.0 + r0 * 2.0) * ruido(dir * 31.0 + 5.0 + r0 * 5.0);
    float alcance = 0.075 + 0.03 * ruido(dir * 3.0 + 7.0);
    float po = smoothstep(alcance, 0.012, r0) * (0.35 + 0.65 * n) + smoothstep(alcance * 2.2, alcance * 0.6, r0) * riscos * 0.5;
    cor = mix(cor, vec3(0.8, 0.86, 0.88) * (0.55 + 0.5 * uLuz), clamp(po, 0.0, 1.0) * 0.78 * uRacha * uRevela);
    cor = mix(cor, vec3(0.012, 0.01, 0.009), smoothstep(0.017, 0.011, r0 * (0.85 + 0.3 * n)) * uRacha * uRevela);
  }
  // O estalo de luz da bala no vidro.
  if (uLuzDoImpacto > 0.001) cor += vec3(1.0, 0.96, 0.88) * uLuzDoImpacto * (exp(-r0 / 0.07) * 1.8 + exp(-r0 / 0.5) * 0.25);

  // O nome, em folha de ouro pintada no vidro: quebra e cai com ele (antes de surgir, nem lê).
  if (uNomeSurge > 0.001) {
    vec2 q = vTela + (vCaco.xy - 0.5) * 0.003 * uRacha;
    vec2 uvNome = (q - uNomeRet.xy) / (2.0 * uNomeRet.zw) + 0.5;
    vec4 tinta = texture2D(uNome, clamp(uvNome, 0.0, 1.0));
    float dentro = step(0.0, uvNome.x) * step(uvNome.x, 1.0) * step(0.0, uvNome.y) * step(uvNome.y, 1.0);
    float ouro = smoothstep(0.2, 0.55, dot(tinta.rgb, vec3(0.4, 0.4, 0.2)));
    float varre = exp(-pow((uvNome.x - uVarre) * 8.0 - (uvNome.y - 0.5) * 2.5, 2.0));
    vec3 corDoNome = tinta.rgb * (0.85 + 0.25 * uLuz) + vec3(1.0, 0.88, 0.6) * varre * ouro * 0.85;
    cor = mix(cor, corDoNome, tinta.a * dentro * uNomeSurge);
  }

  // As rachaduras: um fio de luz fino (cada trecho pega a luz de um jeito, e ela corre pelo fio),
  // com a sombra da refração ao lado; perto do furo os fios engrossam e brilham mais.
  float px = vBorda / max(fwidth(vBorda), 0.000001);
  float perto = 1.0 - smoothstep(0.0, 0.5, r0);
  // (antes do tiro não há fio nenhum: pula a conta inteira)
  if (vRacha > 0.5 && uRacha > 0.0) {
    float frente = vRacha < 1.5 ? uFrenteR : uFrenteA;
    float vis = smoothstep(frente, frente - 0.06, r0) * uRevela;
    bool radial = vRacha < 1.5;
    float largura = mix(0.9, 2.1, perto) * (radial ? 1.0 : 0.8);
    float linha = (1.0 - smoothstep(largura * 0.5, largura * 0.5 + 0.9, px)) * vis;
    float sombra = (1.0 - smoothstep(0.5, 3.5 + 4.0 * vCaco.y, px)) * vis;
    cor *= 1.0 - (0.12 + 0.3 * vCaco.z) * sombra;
    // O ruído da luz que corre no fio só onde há fio (o miolo do caco pula).
    if (linha > 0.0) {
      float corre = 0.55 + 0.9 * ruido(vTela * 9.0 + vLinha * 17.0);
      float forca = clamp((0.18 + 0.82 * vLinha) * corre * (radial ? 1.0 : 0.7) + 0.6 * perto, 0.0, 1.35);
      vec3 corDaRacha = mix(vec3(0.74, 0.88, 0.88), vec3(1.0, 0.95, 0.86), vLinha) * (0.65 + 0.45 * uLuz);
      cor = mix(cor, corDaRacha, clamp(linha * forca, 0.0, 1.0));
    }
  }

  // Caindo: o caco capota; a face escurece um pouco ao virar para longe da luz e pega um lampejo
  // quando passa pelo reflexo; a quina cortada brilha só onde fica de frente para a luz.
  if (vQueda > 0.0) {
    // Vidro brilha dos dois lados: a normal sempre virada para quem olha.
    vec3 N = normalize(vNormal);
    if (N.z < 0.0) N = -N;
    float inclina = clamp(1.0 - N.z, 0.0, 1.0);
    cor *= (1.0 - 0.38 * smoothstep(0.05, 0.6, inclina)) * (1.0 - 0.3 * smoothstep(0.1, 0.6, vQueda));
    // O reflexo do facho de luz na face: o olho vê cada ponto do caco de um ângulo, então o lampejo
    // é uma mancha que corre pelo caco enquanto ele capota (não o caco inteiro branco).
    vec3 V = normalize(vec3(0.0, 0.0, OLHO) - vP);
    vec3 Rf = reflect(-V, N);
    float nh = max(dot(Rf, normalize(vec3(-0.45, 0.6, 0.66))), 0.0);
    float reflexo = smoothstep(0.93, 0.99, nh) * 0.95 + pow(nh, 10.0) * 0.08;
    cor += vec3(1.0, 0.93, 0.8) * reflexo * (0.6 + 0.4 * ruido(vRel * 6.0 + vCaco.xy * 9.0));
    float quina = (1.0 - smoothstep(0.6, 2.2, px)) * step(0.5, vRacha);
    float deFrente = 0.15 + 0.85 * pow(max(dot(N, normalize(vec3(-0.45, 0.6, 0.66))), 0.0), 3.0);
    cor = mix(cor, vec3(0.7, 0.96, 0.9) * (0.55 + 0.9 * reflexo + 0.3 * inclina), quina * deFrente * (0.35 + 0.65 * vLinha));
  }

  float vinheta = smoothstep(1.6, 0.35, length(vTela * vec2(0.56, 1.0)));
  cor *= 0.5 + 0.5 * vinheta;
  cor += (hash(gl_FragCoord.xy + fract(uTempo * 13.0) * 91.0) - 0.5) * uGrao;
  gl_FragColor = vec4(max(cor, 0.0), 1.0);
}`

// Os materiais da arma: GLSL 3 cru (o programa não muda com o alvo do desenho).
const VERT_ARMA = /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 uMundoParaArma;
out vec3 vArma;
out vec3 vNArma;
out vec3 vN;
out vec3 vV;
void main() {
  vec4 mundo = modelMatrix * vec4(position, 1.0);
  vArma = (uMundoParaArma * mundo).xyz;
  vNArma = mat3(uMundoParaArma) * (mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = mv.xyz;
  vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`

/** Cantos por lado da grade do ruído da arma (textura 3D de 64³ bytes = 256 KB). */
const LADO_DO_RUIDO = 64

/**
 * Aço velho (MATERIAL 0): reflexo de uma caixa de luz quente no alto à
 * esquerda e de uma faixa fria atrás à direita; o desgaste vem da curvatura
 * (quina e chanfro gastos, claros e mais lisos), de manchas grandes de pátina
 * com um pouco de ferrugem, de riscos ao longo do cano e de pites escuros.
 * Nogueira quadriculada (1), chumbo das balas (2) e o escuro do cano (3).
 */
const FRAG_ARMA = /* glsl */ `
precision highp float;
in vec3 vArma;
in vec3 vNArma;
in vec3 vN;
in vec3 vV;
uniform mat3 normalMatrix;
uniform float uLuz;
uniform float uClarao;
uniform vec3 uBocaV;
uniform vec3 uTinta;
uniform highp sampler3D uRuido;
out vec4 saida;
// Ruído de valor com a grade sorteada numa textura 3D: o filtro da placa faz a mistura dos 8
// cantos numa leitura só (no lugar de 8 sorteios por ponto). A curva suave vai na coordenada.
float ruido3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return texture(uRuido, (i + u + 0.5) / ${LADO_DO_RUIDO}.0).r;
}
float fbm3d(vec3 p) {
  return (0.5 * ruido3(p) + 0.25 * ruido3(p * 2.03 + 1.7) + 0.125 * ruido3(p * 4.01 + 4.3)) / 0.875;
}
// O salão refletido no aço: a caixa de luz quente do facho (alto, à esquerda, na frente), uma faixa
// comprida no teto (o fio de luz no cano parado e o lampejo a cada volta), o contra fria atrás à
// direita, o chão de tábua devolvendo um marrom fraco e a linha do horizonte.
vec3 ambiente(vec3 r, float rug) {
  float expo = exp2(mix(7.0, 2.5, rug));
  float ganho = (expo + 2.0) * 0.045;
  float k = max(dot(r, normalize(vec3(-0.5, 0.62, 0.6))), 0.0);
  vec3 c = vec3(1.0, 0.8, 0.58) * (pow(k, expo) * ganho + pow(k, 3.0) * 0.32) * uLuz;
  float teto = smoothstep(0.5, 0.92, r.y) * (1.0 - smoothstep(0.25, 0.75, abs(r.x + 0.1)));
  c += vec3(0.95, 0.78, 0.56) * teto * mix(0.9, 0.35, rug) * uLuz;
  float s = max(dot(r, normalize(vec3(0.85, 0.2, -0.3))), 0.0);
  c += vec3(0.45, 0.56, 0.74) * (pow(s, expo * 0.7) * ganho * 0.55 + pow(s, 4.0) * 0.16) * uLuz;
  c += vec3(0.13, 0.075, 0.04) * smoothstep(0.1, -0.6, r.y) * (0.5 + 0.5 * uLuz);
  c += vec3(0.18, 0.1, 0.05) * smoothstep(-0.35, 0.25, r.y) * smoothstep(0.85, 0.2, r.y) * (0.4 + 0.6 * uLuz);
  return c + vec3(0.03, 0.024, 0.019);
}
float capsula(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(-vV);
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  vec3 cor;
  vec3 espec;
#if MATERIAL == 0
  float curv = length(fwidth(vNArma)) / max(length(fwidth(vArma)), 0.00001);
  float borda = smoothstep(7.0, 30.0, curv);
  float manchas = fbm3d(vArma * 2.6);
  float detalhe = ruido3(vArma * 13.0);
  float pintas = ruido3(vArma * 52.0 + 7.0);
  float riscos = ruido3(vArma * vec3(1.2, 34.0, 34.0));
  float gasto = clamp(0.55 * borda + 1.2 * (manchas - 0.52) + 0.25 * (detalhe - 0.5), 0.0, 1.0);
  vec3 F0 = mix(vec3(0.2, 0.198, 0.195), vec3(0.6, 0.585, 0.56), gasto) * uTinta;
  float ferrugem = smoothstep(0.62, 0.8, manchas) * (1.0 - borda) * smoothstep(0.4, 0.7, detalhe);
  F0 = mix(F0, vec3(0.2, 0.13, 0.08), ferrugem * 0.55);
  F0 *= 0.86 + 0.14 * riscos;
  float poro = smoothstep(0.78, 0.96, pintas);
  F0 *= 1.0 - 0.55 * poro;
  float rug = clamp(mix(0.58, 0.24, gasto) + 0.12 * (riscos - 0.5) + 0.2 * poro, 0.12, 0.9);
  vec3 R = reflect(-V, N);
  float NV = max(dot(N, V), 0.0);
  vec3 fres = F0 + (1.0 - F0) * pow(1.0 - NV, 5.0) * (1.0 - rug) * 0.6;
  cor = fres * ambiente(R, rug);
  // O rebatedor atrás da câmera: as faces chapadas de lado (que olham para quem vê) ganham um
  // cinza quente largo, senão o aço de perfil vira preto; e um contorno frio no que fica de quina.
  cor += F0 * vec3(0.62, 0.54, 0.44) * pow(max(dot(R, normalize(vec3(-0.2, 0.3, 1.0))), 0.0), 5.0) * 0.55 * uLuz;
  cor += vec3(0.3, 0.36, 0.46) * pow(1.0 - NV, 3.0) * (0.25 + 0.4 * gasto) * uLuz;
  cor += vec3(0.045, 0.04, 0.035) * (1.0 - gasto) * (0.3 + max(dot(N, L), 0.0)) * (0.35 + 0.65 * uLuz);
  espec = F0;
#elif MATERIAL == 1
  vec2 eixo = normalize(vec2(0.17, -1.0));
  vec2 lado = vec2(-eixo.y, eixo.x);
  float ao = dot(vArma.xy, eixo);
  float at = dot(vArma.xy, lado);
  float veio = ruido3(vec3(at * 26.0 + 3.0 * ruido3(vArma * 3.0), ao * 2.0, vArma.z * 26.0));
  float anel = fract(at * 9.0 + 2.2 * ruido3(vec3(ao * 1.6, vArma.z * 3.0, 1.0)));
  vec3 alb = mix(vec3(0.075, 0.04, 0.024), vec3(0.17, 0.088, 0.048), veio);
  alb = mix(alb, alb * 0.55, smoothstep(0.75, 1.0, anel) * 0.7);
  // Mãos de décadas: o meio do painel mais escuro e oleoso, a borda mais clara e gasta.
  alb *= 0.85 + 0.3 * ruido3(vArma * 4.0);
  // O quadriculado: pirâmides miúdas dentro do painel, só nas faces laterais.
  float lateral = smoothstep(0.55, 0.8, abs(normalize(vNArma).z));
  float painel = smoothstep(0.012, -0.012, capsula(vArma.xy, vec2(0.86, 0.16), vec2(1.08, -0.88)) - 0.15) * lateral;
  vec2 g = vec2(dot(vArma.xy, vec2(0.83, 0.56)), dot(vArma.xy, vec2(-0.56, 0.83))) * 27.0;
  float fino = clamp(1.6 - length(fwidth(g)) * 1.2, 0.0, 1.0) * painel;
  vec2 f = fract(g) - 0.5;
  vec2 inc = abs(f.x) > abs(f.y) ? vec2(sign(f.x), 0.0) : vec2(0.0, sign(f.y));
  vec2 incXY = inc.x * vec2(0.83, 0.56) + inc.y * vec2(-0.56, 0.83);
  vec3 Np = normalize(N + normalMatrix * vec3(incXY * 0.55, 0.0) * fino);
  float sulco = 1.0 - smoothstep(0.0, 0.09, 0.5 - max(abs(f.x), abs(f.y)));
  alb *= 1.0 - 0.45 * sulco * fino;
  float dif = max(dot(Np, L), 0.0);
  cor = alb * (0.12 + 1.15 * dif * uLuz + 0.14 * (dot(Np, L) * 0.5 + 0.5));
  // O verniz: um reflexo largo e um fino da caixa de luz, e o contra frio na quina.
  vec3 R = reflect(-V, Np);
  float verniz = (1.0 - 0.7 * painel);
  cor += vec3(1.0, 0.84, 0.64) * (pow(max(dot(R, L), 0.0), 36.0) * 0.5 + pow(max(dot(R, L), 0.0), 6.0) * 0.05) * verniz * uLuz;
  cor += vec3(0.4, 0.5, 0.66) * pow(1.0 - max(dot(Np, V), 0.0), 4.0) * 0.12 * uLuz;
  espec = vec3(0.05);
#elif MATERIAL == 2
  vec3 R = reflect(-V, N);
  float n = ruido3(vArma * 60.0);
  vec3 F0 = vec3(0.3, 0.3, 0.31) * (0.8 + 0.2 * n);
  cor = F0 * ambiente(R, 0.72) + vec3(0.03) * max(dot(N, L), 0.0) * uLuz;
  espec = F0;
#else
  vec3 R = reflect(-V, N);
  cor = vec3(0.01, 0.009, 0.008) + vec3(0.05) * ambiente(R, 0.6) * pow(1.0 - max(dot(N, V), 0.0), 2.0);
  espec = vec3(0.02);
#endif
  // O clarão da boca acende o que está perto.
  vec3 Lf = uBocaV - vV;
  float df = length(Lf);
  Lf /= max(df, 0.0001);
  float luzF = uClarao / (1.0 + 1.5 * df * df);
  cor += luzF * (vec3(0.4, 0.2, 0.07) * max(dot(N, Lf), 0.0) + espec * pow(max(dot(reflect(-V, N), Lf), 0.0), 8.0) * 3.0);
  saida = vec4(cor, 1.0);
}`

// ── O revólver ───────────────────────────────────────────────────────────────

type Descartavel = { dispose: () => void }
type Guardar = <X extends Descartavel>(x: X) => X
type Ponto = readonly [number, number]

interface MateriaisDaArma {
  aco: Three.Material
  acoDoCao: Three.Material
  madeira: Three.Material
  chumbo: Three.Material
  escuro: Three.Material
}

interface Revolver {
  /** O pulso: a virada para a tela (guinada e arfagem). */
  pulso: Three.Group
  /** A arma no dedo: o giro e o recuo (origem = o pivô). */
  arma: Three.Group
  /** O desenho, deslocado para o pivô cair na origem de `arma`. */
  modelo: Three.Group
  cao: Three.Group
  tambor: Three.Group
}

/**
 * Normais suaves nas paredes e chanfros de uma extrusão (o three entrega cada
 * triângulo chapado), sem passar de `limiteGraus`; as tampas (faces em z)
 * ficam planas, senão o lado da armação ganharia listras.
 */
function suavizar(THREE: ThreeModule, g: Three.BufferGeometry, limiteGraus = 40): void {
  const pos = g.getAttribute('position')
  const total = pos.count
  const faces = Math.floor(total / 3)
  const fn = new Float32Array(faces * 3)
  for (let f = 0; f < faces; f++) {
    const i = f * 3
    const ax = pos.getX(i)
    const ay = pos.getY(i)
    const az = pos.getZ(i)
    const ux = pos.getX(i + 1) - ax
    const uy = pos.getY(i + 1) - ay
    const uz = pos.getZ(i + 1) - az
    const vx = pos.getX(i + 2) - ax
    const vy = pos.getY(i + 2) - ay
    const vz = pos.getZ(i + 2) - az
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const c = Math.hypot(nx, ny, nz) || 1
    nx /= c
    ny /= c
    nz /= c
    fn[f * 3] = nx
    fn[f * 3 + 1] = ny
    fn[f * 3 + 2] = nz
  }
  const tampa = (f: number) => Math.abs(fn[f * 3 + 2]) > 0.999
  // Vértices no mesmo lugar (a extrusão repete o canto em cada face) entram no mesmo grupo.
  const grupos = new Map<number, number[]>()
  // Chave numérica (mais rápida que texto): x e y até ±4 unidades, z até ±0,25, em passos de 1/4096.
  const Q = 4096
  const chave = (i: number) => (Math.round(pos.getX(i) * Q) + 16384) * 67108864 + (Math.round(pos.getY(i) * Q) + 16384) * 2048 + (Math.round(pos.getZ(i) * Q) + 1024)
  for (let i = 0; i < total; i++) {
    const k = chave(i)
    const lista = grupos.get(k)
    if (lista) lista.push(i)
    else grupos.set(k, [i])
  }
  const limite = Math.cos((limiteGraus * Math.PI) / 180)
  const normais = new Float32Array(total * 3)
  for (const cantos of grupos.values()) {
    for (const i of cantos) {
      const f = Math.floor(i / 3)
      let sx = fn[f * 3]
      let sy = fn[f * 3 + 1]
      let sz = fn[f * 3 + 2]
      if (!tampa(f)) {
        sx = 0
        sy = 0
        sz = 0
        for (const j of cantos) {
          const h = Math.floor(j / 3)
          if (tampa(h)) continue
          const d = fn[f * 3] * fn[h * 3] + fn[f * 3 + 1] * fn[h * 3 + 1] + fn[f * 3 + 2] * fn[h * 3 + 2]
          if (d < limite) continue
          sx += fn[h * 3]
          sy += fn[h * 3 + 1]
          sz += fn[h * 3 + 2]
        }
        const c = Math.hypot(sx, sy, sz) || 1
        sx /= c
        sy /= c
        sz /= c
      }
      normais[i * 3] = sx
      normais[i * 3 + 1] = sy
      normais[i * 3 + 2] = sz
    }
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3))
}

function extrudar(THREE: ThreeModule, guardar: Guardar, forma: Three.Shape, profundidade: number, chanfro: number, gomos = 4): Three.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(forma, { depth: profundidade, bevelEnabled: true, bevelThickness: chanfro, bevelSize: chanfro * 0.9, bevelSegments: gomos, curveSegments: 16 })
  g.translate(0, 0, -profundidade / 2)
  suavizar(THREE, g)
  return guardar(g)
}

/** Cilindro deitado em x, com o raio `rFrente` virado para a boca (-x). */
function cilindroX(THREE: ThreeModule, guardar: Guardar, rFrente: number, rTras: number, comprimento: number, segmentos: number, aberto = false): Three.BufferGeometry {
  const g = new THREE.CylinderGeometry(rFrente, rTras, comprimento, segmentos, 1, aberto)
  g.rotateZ(Math.PI / 2)
  return guardar(g)
}

/** Distância angular até a canelura mais próxima (seis, entre as câmaras). */
function distanciaDaCanelura(a: number): number {
  const passo = Math.PI / 3
  const d = (((a - Math.PI / 6) % passo) + passo) % passo
  return Math.min(d, passo - d)
}

/** O tambor por fora, com as seis caneluras (x ao longo do eixo; a = 0 no alto). */
function geometriaDoTambor(THREE: ThreeModule, guardar: Guardar): Three.BufferGeometry {
  const COMPRIMENTO = 0.63
  const RAIO = 0.25
  const FUNDO = 0.05
  const LARGURA = 0.21
  const NX = 40
  const NA = 192
  const raio = (x: number, a: number) => {
    const u = Math.min(1, distanciaDaCanelura(a) / LARGURA)
    const mascara = smoothstep(-0.27, -0.19, x) * smoothstep(0.33, 0.28, x)
    return RAIO - FUNDO * Math.sqrt(Math.max(0, 1 - u * u)) * mascara
  }
  const ponto = (x: number, a: number): [number, number, number] => {
    const r = raio(x, a)
    return [x, r * Math.cos(a), r * Math.sin(a)]
  }
  const posicoes: number[] = []
  const normais: number[] = []
  const indices: number[] = []
  const E = 0.0006
  for (let i = 0; i <= NX; i++) {
    const x = -COMPRIMENTO / 2 + (COMPRIMENTO * i) / NX
    for (let j = 0; j <= NA; j++) {
      const a = (2 * Math.PI * j) / NA
      const p = ponto(x, a)
      posicoes.push(p[0], p[1], p[2])
      // Normal pelas tangentes (diferença finita), virada para fora.
      const pa = ponto(x, a + E)
      const pb = ponto(x, a - E)
      const px = ponto(x + E, a)
      const pxb = ponto(x - E, a)
      const ta = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]]
      const tx = [px[0] - pxb[0], px[1] - pxb[1], px[2] - pxb[2]]
      let nx = ta[1] * tx[2] - ta[2] * tx[1]
      let ny = ta[2] * tx[0] - ta[0] * tx[2]
      let nz = ta[0] * tx[1] - ta[1] * tx[0]
      if (nx * 0 + ny * Math.cos(a) + nz * Math.sin(a) < 0) {
        nx = -nx
        ny = -ny
        nz = -nz
      }
      const c = Math.hypot(nx, ny, nz) || 1
      normais.push(nx / c, ny / c, nz / c)
    }
  }
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j
      const b = a + NA + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3))
  g.setIndex(indices)
  // O lado de fora tem de ser a frente: confere a ordem pelo primeiro triângulo.
  const p0 = new THREE.Vector3().fromArray(posicoes, 0)
  const p1 = new THREE.Vector3().fromArray(posicoes, 3)
  const p2 = new THREE.Vector3().fromArray(posicoes, (NA + 1) * 3)
  const face = p1.clone().sub(p0).cross(p2.clone().sub(p0))
  if (face.dot(new THREE.Vector3(0, Math.cos(0), Math.sin(0))) < 0) {
    const inv: number[] = []
    for (let k = 0; k < indices.length; k += 3) inv.push(indices[k], indices[k + 2], indices[k + 1])
    g.setIndex(inv)
  }
  return guardar(g)
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** As seis câmaras: a de cima (a = 0) fica alinhada com o cano. */
const CAMARAS = Array.from({ length: 6 }, (_, k) => (k * Math.PI) / 3)
const RAIO_DAS_CAMARAS = 0.155
const RAIO_DA_CAMARA = 0.072

function construirRevolver(THREE: ThreeModule, m: MateriaisDaArma, guardar: Guardar): Revolver {
  const pulso = new THREE.Group()
  const arma = new THREE.Group()
  const modelo = new THREE.Group()
  modelo.position.set(-PIVO_X, -PIVO_Y, 0)
  pulso.add(arma)
  arma.add(modelo)
  const peca = (g: Three.BufferGeometry, mat: Three.Material, x = 0, y = 0, z = 0, pai: Three.Object3D = modelo) => {
    const malha = new THREE.Mesh(g, mat)
    malha.position.set(x, y, z)
    malha.frustumCulled = false
    pai.add(malha)
    return malha
  }

  // O cano: comprido, um pouco mais fino na boca; a coroa da boca, a alma e a massa de mira.
  peca(cilindroX(THREE, guardar, 0.086, 0.092, 1.5, 56, true), m.aco, BOCA_X + 0.75, EIXO_DO_CANO_Y)
  const boca = guardar(new THREE.RingGeometry(0.04, 0.086, 56))
  boca.rotateY(-Math.PI / 2)
  peca(boca, m.aco, BOCA_X, EIXO_DO_CANO_Y)
  const coroa = guardar(new THREE.TorusGeometry(0.083, 0.0045, 8, 56))
  coroa.rotateY(Math.PI / 2)
  peca(coroa, m.aco, BOCA_X + 0.002, EIXO_DO_CANO_Y)
  peca(cilindroX(THREE, guardar, 0.04, 0.04, 0.7, 32, true), m.escuro, BOCA_X + 0.35, EIXO_DO_CANO_Y)
  // A massa de mira: uma meia-lua baixa e fina.
  const mira = new THREE.Shape()
  mira.moveTo(-0.075, 0)
  mira.quadraticCurveTo(-0.06, 0.068, 0.01, 0.07)
  mira.quadraticCurveTo(0.065, 0.06, 0.075, 0)
  mira.lineTo(-0.075, 0)
  peca(extrudar(THREE, guardar, mira, 0.018, 0.005, 2), m.aco, BOCA_X + 0.14, EIXO_DO_CANO_Y + 0.07)
  // Onde o cano entra na armação.
  peca(cilindroX(THREE, guardar, 0.118, 0.118, 0.14, 56), m.aco, -0.73, EIXO_DO_CANO_Y)

  // A armação, com a janela do tambor.
  const armacao = new THREE.Shape()
  armacao.moveTo(-0.69, 0.5)
  armacao.lineTo(-0.68, 0.79)
  armacao.quadraticCurveTo(-0.67, 0.875, -0.58, 0.88)
  armacao.lineTo(0.16, 0.89)
  armacao.quadraticCurveTo(0.31, 0.89, 0.4, 0.81)
  armacao.lineTo(0.47, 0.71)
  armacao.quadraticCurveTo(0.6, 0.56, 0.8, 0.5)
  armacao.quadraticCurveTo(0.95, 0.47, 0.95, 0.4)
  armacao.lineTo(0.9, 0.3)
  armacao.lineTo(0.62, 0.22)
  armacao.quadraticCurveTo(0.3, 0.14, -0.05, 0.155)
  armacao.lineTo(-0.42, 0.16)
  armacao.quadraticCurveTo(-0.62, 0.17, -0.67, 0.3)
  armacao.lineTo(-0.69, 0.5)
  const janela = new THREE.Path()
  janela.moveTo(-0.5, 0.25)
  janela.lineTo(0.21, 0.25)
  janela.lineTo(0.21, 0.85)
  janela.lineTo(-0.5, 0.85)
  janela.lineTo(-0.5, 0.25)
  armacao.holes.push(janela)
  peca(extrudar(THREE, guardar, armacao, 0.2, 0.025), m.aco)

  // O guarda-mato: um anel; a parte de cima some dentro da armação.
  const guarda = new THREE.Shape()
  guarda.absarc(-0.03, -0.06, 0.3, 0, Math.PI * 2, false)
  const vao = new THREE.Path()
  vao.absarc(-0.03, -0.06, 0.245, 0, Math.PI * 2, true)
  guarda.holes.push(vao)
  peca(extrudar(THREE, guardar, guarda, 0.085, 0.014, 3), m.aco)

  // O gatilho, curvo, com a ponta para a frente.
  const gatilho = new THREE.Shape()
  gatilho.moveTo(0.04, 0.17)
  gatilho.quadraticCurveTo(0.065, 0.02, 0.0, -0.1)
  gatilho.quadraticCurveTo(-0.06, -0.2, -0.16, -0.235)
  gatilho.lineTo(-0.152, -0.2)
  gatilho.quadraticCurveTo(-0.08, -0.17, -0.04, -0.08)
  gatilho.quadraticCurveTo(-0.0, 0.02, -0.02, 0.17)
  gatilho.lineTo(0.04, 0.17)
  peca(extrudar(THREE, guardar, gatilho, 0.06, 0.01, 2), m.acoDoCao)

  // O cão, no pino dele (engatilhar gira o grupo).
  const cao = new THREE.Group()
  cao.position.set(CAO_X, CAO_Y, 0)
  modelo.add(cao)
  // O cão: corpo no pino, a espora larga para trás e para cima (o polegar puxa por ela).
  const formaDoCao = new THREE.Shape()
  formaDoCao.moveTo(-0.07, -0.03)
  formaDoCao.lineTo(0.07, -0.06)
  formaDoCao.quadraticCurveTo(0.16, 0.02, 0.21, 0.14)
  formaDoCao.quadraticCurveTo(0.28, 0.23, 0.38, 0.25)
  formaDoCao.lineTo(0.41, 0.3)
  formaDoCao.quadraticCurveTo(0.3, 0.36, 0.18, 0.32)
  formaDoCao.quadraticCurveTo(0.07, 0.28, 0.02, 0.19)
  formaDoCao.lineTo(-0.05, 0.1)
  formaDoCao.lineTo(-0.07, -0.03)
  peca(extrudar(THREE, guardar, formaDoCao, 0.1, 0.013, 2), m.acoDoCao, 0, 0, 0, cao)

  // O tambor: por fora com caneluras, a frente com as seis câmaras e as balas, o fundo fechado.
  const tambor = new THREE.Group()
  tambor.position.set(-0.145, EIXO_DO_TAMBOR_Y, 0)
  modelo.add(tambor)
  peca(geometriaDoTambor(THREE, guardar), m.aco, 0, 0, 0, tambor)
  const chanfro = cilindroX(THREE, guardar, 0.232, 0.25, 0.02, 72, true)
  peca(chanfro, m.aco, -0.325 + 0.01, 0, 0, tambor)
  const frente = new THREE.Shape()
  frente.absarc(0, 0, 0.232, 0, Math.PI * 2, false)
  for (const a of CAMARAS) {
    const furo = new THREE.Path()
    furo.absarc(RAIO_DAS_CAMARAS * Math.sin(a), RAIO_DAS_CAMARAS * Math.cos(a), RAIO_DA_CAMARA, 0, Math.PI * 2, true)
    frente.holes.push(furo)
  }
  const centro = new THREE.Path()
  centro.absarc(0, 0, 0.032, 0, Math.PI * 2, true)
  frente.holes.push(centro)
  const tampaDaFrente = guardar(new THREE.ShapeGeometry(frente, 24))
  tampaDaFrente.rotateY(-Math.PI / 2)
  peca(tampaDaFrente, m.aco, -0.325, 0, 0, tambor)
  const fundoDoTambor = guardar(new THREE.CircleGeometry(0.25, 64))
  fundoDoTambor.rotateY(Math.PI / 2)
  peca(fundoDoTambor, m.aco, 0.315, 0, 0, tambor)
  const camara = cilindroX(THREE, guardar, RAIO_DA_CAMARA, RAIO_DA_CAMARA, 0.16, 28, true)
  const ponta = guardar(new THREE.SphereGeometry(RAIO_DA_CAMARA * 0.92, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2))
  ponta.rotateZ(Math.PI / 2)
  for (const a of CAMARAS) {
    const y = RAIO_DAS_CAMARAS * Math.cos(a)
    const z = RAIO_DAS_CAMARAS * Math.sin(a)
    peca(camara, m.escuro, -0.325 + 0.08, y, z, tambor)
    peca(ponta, m.chumbo, -0.325 + 0.075, y, z, tambor)
  }

  // A vareta do extrator sob o cano, com o botão serrilhado na ponta.
  peca(cilindroX(THREE, guardar, 0.022, 0.022, 0.4, 20), m.aco, -0.9, EIXO_DO_TAMBOR_Y)
  peca(cilindroX(THREE, guardar, 0.034, 0.034, 0.1, 28), m.aco, -1.13, EIXO_DO_TAMBOR_Y)

  // O ferrolho do tambor e dois parafusos no lado.
  const ferrolho = new THREE.Shape()
  ferrolho.moveTo(-0.08, -0.035)
  ferrolho.lineTo(0.08, -0.035)
  ferrolho.quadraticCurveTo(0.1, -0.035, 0.1, -0.015)
  ferrolho.lineTo(0.1, 0.015)
  ferrolho.quadraticCurveTo(0.1, 0.035, 0.08, 0.035)
  ferrolho.lineTo(-0.08, 0.035)
  ferrolho.quadraticCurveTo(-0.1, 0.035, -0.1, 0.015)
  ferrolho.lineTo(-0.1, -0.015)
  ferrolho.quadraticCurveTo(-0.1, -0.035, -0.08, -0.035)
  peca(extrudar(THREE, guardar, ferrolho, 0.022, 0.008, 2), m.aco, 0.42, 0.44, 0.138)
  const parafuso = guardar(new THREE.CylinderGeometry(0.028, 0.03, 0.014, 24))
  parafuso.rotateX(Math.PI / 2)
  peca(parafuso, m.aco, 0.3, 0.27, 0.128)
  peca(parafuso, m.aco, -0.57, 0.25, 0.128)

  // O cabo de nogueira, inclinado para trás, com o parafuso no meio do painel.
  const cabo = new THREE.Shape()
  cabo.moveTo(0.56, 0.36)
  cabo.splineThru([new THREE.Vector2(0.78, 0.47), new THREE.Vector2(0.95, 0.42), new THREE.Vector2(1.06, 0.18), new THREE.Vector2(1.16, -0.25), new THREE.Vector2(1.27, -0.72), new THREE.Vector2(1.34, -1.04)])
  cabo.quadraticCurveTo(1.35, -1.13, 1.25, -1.15)
  cabo.lineTo(0.92, -1.14)
  cabo.quadraticCurveTo(0.84, -1.13, 0.83, -1.04)
  cabo.splineThru([new THREE.Vector2(0.79, -0.72), new THREE.Vector2(0.72, -0.4), new THREE.Vector2(0.68, -0.1), new THREE.Vector2(0.64, 0.12)])
  cabo.quadraticCurveTo(0.6, 0.28, 0.56, 0.36)
  peca(extrudar(THREE, guardar, cabo, 0.26, 0.05, 5), m.madeira)
  const parafusoDoCabo = guardar(new THREE.CylinderGeometry(0.032, 0.034, 0.016, 24))
  parafusoDoCabo.rotateX(Math.PI / 2)
  peca(parafusoDoCabo, m.aco, 0.97, -0.38, 0.178)
  peca(parafusoDoCabo, m.aco, 0.97, -0.38, -0.178)

  pulso.traverse((o) => o.layers.set(CAMADA_DA_ARMA))
  return { pulso, arma, modelo, cao, tambor }
}

// ── O vidro: a malha dos cacos ───────────────────────────────────────────────

/** Raios dos anéis da teia (unidades de altura da tela); do sexto para fora os cacos ficam grandes. O último cobre até tela 21:9 com o impacto no canto. */
const ANEIS = [0, 0.024, 0.06, 0.12, 0.2, 0.31, 0.46, 0.66, 0.92, 1.26, 1.7, 2.3, 3.1, 4.4, 6.4]
/** Setores por faixa: 10 perto do furo, 20 e depois 40 (os raios se bifurcam). */
const SETORES = [10, 10, 10, 10, 20, 20, 20, 20, 40, 40, 40, 40, 40, 40]
/** Chance de um trecho de anel rachar (perto do furo, sempre) e de um raio seguir rachando. */
const CHANCE_DO_ANEL = [1, 0.85, 0.72, 0.64, 0.56, 0.5, 0.45, 0.4, 0.34, 0.3, 0.26, 0.22, 0.2, 0.2, 0.2]
const CHANCE_DO_RAIO = [1, 1, 1, 1, 1, 1, 0.96, 0.9, 0.84, 0.78, 0.72, 0.66, 0.6, 0.55]
/** A frente das rachaduras vai até aqui (a esquina mais longe de qualquer impacto na tela). */
const RAIO_DA_RACHADURA = 4.8

interface Aresta {
  a: Ponto
  b: Ponto
  chave: string
  tipo: 1 | 2
}

/**
 * A teia de rachaduras em volta do impacto: raios que saem do furo e anéis
 * que os ligam, com os cantos tremidos e cada trecho quebrado no meio. Trecho
 * que não racha junta as duas células num caco só (cacos de tamanhos
 * diferentes). Cada célula vira um leque de triângulos a partir do centro; o
 * atributo `aBorda` (1 no centro, 0 na aresta) dá a distância até a rachadura.
 */
/**
 * A grade do ruído do aço e da madeira: um valor sorteado por canto, numa textura 3D que se
 * repete (64 cantos por lado: a repetição não aparece na superfície curva da arma).
 */
function criarGradeDeRuido(THREE: ThreeModule): Three.Data3DTexture {
  const rnd = semente(6464)
  const dados = new Uint8Array(LADO_DO_RUIDO ** 3)
  for (let i = 0; i < dados.length; i++) dados[i] = Math.floor(rnd() * 256)
  const grade = new THREE.Data3DTexture(dados, LADO_DO_RUIDO, LADO_DO_RUIDO, LADO_DO_RUIDO)
  grade.format = THREE.RedFormat
  grade.type = THREE.UnsignedByteType
  grade.minFilter = THREE.LinearFilter
  grade.magFilter = THREE.LinearFilter
  grade.wrapS = THREE.RepeatWrapping
  grade.wrapT = THREE.RepeatWrapping
  grade.wrapR = THREE.RepeatWrapping
  grade.unpackAlignment = 1
  grade.generateMipmaps = false
  grade.needsUpdate = true
  return grade
}

function gerarVidro(THREE: ThreeModule): Three.BufferGeometry {
  const rnd = semente(90127)
  const giro0 = rnd() * Math.PI * 2
  const cantos: Ponto[][] = [[[0, 0]]]
  for (let j = 1; j < ANEIS.length; j++) {
    const n = SETORES[Math.min(j, SETORES.length - 1)]
    const anel: Ponto[] = []
    // Perto do furo a teia é mais torta (os anéis de dentro não podem parecer polígonos).
    const torto = j <= 4 ? 0.8 : 0.6
    for (let k = 0; k < n; k++) {
      const a = giro0 + ((k + (rnd() - 0.5) * torto) / n) * Math.PI * 2
      const r = ANEIS[j] * (1 + (rnd() - 0.5) * 0.36)
      anel.push([r * Math.cos(a), r * Math.sin(a)])
    }
    cantos.push(anel)
  }
  const rachado = new Map<string, boolean>()
  const racha = (chave: string, chance: number) => {
    let v = rachado.get(chave)
    if (v === undefined) {
      v = rnd() < chance
      rachado.set(chave, v)
    }
    return v
  }
  const meios = new Map<string, Ponto>()
  const meio = (aresta: Aresta): Ponto => {
    const pronto = meios.get(aresta.chave)
    if (pronto) return pronto
    const [ax, ay] = aresta.a
    const [bx, by] = aresta.b
    const dx = bx - ax
    const dy = by - ay
    const l = Math.hypot(dx, dy)
    const t = 0.5 + (rnd() - 0.5) * 0.2
    const desvio = (rnd() - 0.5) * 0.16 * l
    const m: Ponto = [ax + dx * t - (dy / (l || 1)) * desvio, ay + dy * t + (dx / (l || 1)) * desvio]
    meios.set(aresta.chave, m)
    return m
  }

  // Células e a união dos que não racham entre si.
  interface Celula {
    arestas: Aresta[]
    pontos: Ponto[]
    area: number
    cx: number
    cy: number
  }
  const celulas: Celula[] = []
  const indiceDaCelula = new Map<string, number>()
  const pai: number[] = []
  const achar = (i: number): number => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]]
      i = pai[i]
    }
    return i
  }
  const unir = (a: number, b: number) => {
    const ra = achar(a)
    const rb = achar(b)
    if (ra !== rb) pai[rb] = ra
  }
  for (let j = 0; j < SETORES.length; j++) {
    const n = SETORES[j]
    const fora = cantos[j + 1]
    const razao = fora.length / n
    for (let i = 0; i < n; i++) {
      const dentro0 = j === 0 ? cantos[0][0] : cantos[j][i]
      const dentro1 = j === 0 ? cantos[0][0] : cantos[j][(i + 1) % n]
      const externos: Ponto[] = []
      const chavesDeFora: string[] = []
      for (let s = razao; s >= 0; s--) externos.push(fora[(i * razao + s) % fora.length])
      for (let s = razao - 1; s >= 0; s--) chavesDeFora.push(`A:${j + 1}:${(i * razao + s) % fora.length}`)
      const arestas: Aresta[] = []
      if (j > 0) arestas.push({ a: dentro0, b: dentro1, chave: `A:${j}:${i}`, tipo: 2 })
      arestas.push({ a: dentro1, b: externos[0], chave: `R:${j}:${(i + 1) % n}`, tipo: 1 })
      for (let s = 0; s < externos.length - 1; s++) arestas.push({ a: externos[s], b: externos[s + 1], chave: chavesDeFora[s], tipo: 2 })
      arestas.push({ a: externos[externos.length - 1], b: dentro0, chave: `R:${j}:${i}`, tipo: 1 })
      const pontos: Ponto[] = []
      for (const aresta of arestas) pontos.push(aresta.a, meio(aresta))
      let area = 0
      let cx = 0
      let cy = 0
      for (let k = 0; k < pontos.length; k++) {
        const [x0, y0] = pontos[k]
        const [x1, y1] = pontos[(k + 1) % pontos.length]
        const cruz = x0 * y1 - x1 * y0
        area += cruz
        cx += (x0 + x1) * cruz
        cy += (y0 + y1) * cruz
      }
      area /= 2
      const indice = celulas.length
      celulas.push({ arestas, pontos, area: Math.abs(area), cx: cx / (6 * area || 1), cy: cy / (6 * area || 1) })
      indiceDaCelula.set(`${j}:${i}`, indice)
      pai.push(indice)
    }
  }
  // Juntar pelo trecho que não rachou: anel entre a faixa j-1 e j, raio entre setores vizinhos.
  for (let j = 0; j < SETORES.length; j++) {
    const n = SETORES[j]
    for (let i = 0; i < n; i++) {
      const aqui = indiceDaCelula.get(`${j}:${i}`) ?? 0
      if (!racha(`R:${j}:${i}`, CHANCE_DO_RAIO[j])) unir(aqui, indiceDaCelula.get(`${j}:${(i - 1 + n) % n}`) ?? aqui)
      if (j > 0) {
        const nAntes = SETORES[j - 1]
        const razao = n / nAntes
        if (!racha(`A:${j}:${i}`, CHANCE_DO_ANEL[j])) unir(aqui, indiceDaCelula.get(`${j - 1}:${Math.floor(i / razao)}`) ?? aqui)
      }
    }
  }
  // Centro de cada caco (média pela área das células) e os números dele.
  const somas = new Map<number, { area: number; x: number; y: number }>()
  for (let c = 0; c < celulas.length; c++) {
    const raiz = achar(c)
    const s = somas.get(raiz) ?? { area: 0, x: 0, y: 0 }
    s.area += celulas[c].area
    s.x += celulas[c].cx * celulas[c].area
    s.y += celulas[c].cy * celulas[c].area
    somas.set(raiz, s)
  }
  const caco = new Map<number, [number, number, number, number, number, number]>()
  for (const [raiz, s] of somas) {
    const px = s.x / (s.area || 1)
    const py = s.y / (s.area || 1)
    const r = Math.hypot(px, py)
    // Solta do furo para fora: perto do furo primeiro, a borda até 0,34 s depois.
    const atraso = Math.min(0.34, 0.34 * Math.pow(r / 1.9, 0.8)) + rnd() * 0.05
    caco.set(raiz, [px, py, rnd(), rnd(), rnd(), atraso])
  }

  const posicoes: number[] = []
  const pivos: number[] = []
  const dados: number[] = []
  const bordas: number[] = []
  const rachas: number[] = []
  const linhas: number[] = []
  // Cada trecho de rachadura pega a luz de um jeito (o plano da quebra fica torto): o mesmo valor dos dois lados.
  const brilhos = new Map<string, number>()
  const brilhoDe = (chave: string) => {
    let b = brilhos.get(chave)
    if (b === undefined) {
      b = Math.pow(rnd(), 1.6)
      brilhos.set(chave, b)
    }
    return b
  }
  const vertice = (p: Ponto, borda: number, tipo: number, c: readonly number[], brilho: number) => {
    posicoes.push(p[0], p[1], 0)
    pivos.push(c[0], c[1])
    dados.push(c[2], c[3], c[4], c[5])
    bordas.push(borda)
    rachas.push(tipo)
    linhas.push(brilho)
  }
  for (let c = 0; c < celulas.length; c++) {
    const celula = celulas[c]
    const numeros = caco.get(achar(c)) ?? [0, 0, 0.5, 0.5, 0.5, 0]
    let mx = 0
    let my = 0
    for (const p of celula.pontos) {
      mx += p[0]
      my += p[1]
    }
    const centro: Ponto = [mx / celula.pontos.length, my / celula.pontos.length]
    for (const aresta of celula.arestas) {
      // A borda de fora da teia nunca foi sorteada: fica rachada (está fora da tela).
      const tipo = rachado.get(aresta.chave) === false ? 0 : aresta.tipo
      const m = meio(aresta)
      const b = brilhoDe(aresta.chave)
      vertice(centro, 1, tipo, numeros, b)
      vertice(aresta.a, 0, tipo, numeros, b)
      vertice(m, 0, tipo, numeros, b)
      vertice(centro, 1, tipo, numeros, b)
      vertice(m, 0, tipo, numeros, b)
      vertice(aresta.b, 0, tipo, numeros, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3))
  g.setAttribute('aPivo', new THREE.Float32BufferAttribute(pivos, 2))
  g.setAttribute('aCaco', new THREE.Float32BufferAttribute(dados, 4))
  g.setAttribute('aBorda', new THREE.Float32BufferAttribute(bordas, 1))
  g.setAttribute('aRacha', new THREE.Float32BufferAttribute(rachas, 1))
  g.setAttribute('aLinha', new THREE.Float32BufferAttribute(linhas, 1))
  return g
}

// ── Pintura do nome ──────────────────────────────────────────────────────────

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const g = canvas.getContext('2d')
  if (!g) throw new Error('tiro na tela: sem canvas 2D')
  return [canvas, g]
}

interface NomePintado {
  textura: Three.CanvasTexture
  /** Largura do letreiro (com a sombra) em fração da largura da textura. */
  fracao: number
}

/**
 * O nome como letreiro de vidraça de saloon: folha de ouro brunida com
 * círculos de polimento, contorno quase preto e a "sombra" deslocada em
 * castanho, como faz o pintor de letreiro.
 */
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
  const base = NOME_ALTURA_PX / 2 + (subida - descida) / 2
  const topo = base - subida
  g.lineJoin = 'round'
  // Halo escuro largo: o letreiro lê sobre a cena.
  g.save()
  g.shadowColor = 'rgba(0, 0, 0, 0.8)'
  g.shadowBlur = px * 0.3
  g.fillStyle = 'rgba(0, 0, 0, 0.55)'
  g.fillText(nome, cx, base)
  g.restore()
  // A sombra do pintor: castanho escuro, para baixo e para a direita.
  g.fillStyle = '#2b0f06'
  g.strokeStyle = '#2b0f06'
  g.lineWidth = px * 0.09
  g.strokeText(nome, cx + px * 0.05, base + px * 0.055)
  g.fillText(nome, cx + px * 0.05, base + px * 0.055)
  g.strokeStyle = '#0c0703'
  g.lineWidth = px * 0.085
  g.strokeText(nome, cx, base)
  // A folha de ouro, numa tela à parte para os círculos de polimento ficarem só nela.
  const [canvasOuro, o] = tela(NOME_LARGURA_PX, NOME_ALTURA_PX)
  o.font = fonte(px)
  o.textAlign = 'center'
  o.textBaseline = 'alphabetic'
  const ouro = o.createLinearGradient(0, topo, 0, base + descida)
  ouro.addColorStop(0, '#fff0c0')
  ouro.addColorStop(0.2, '#f0cd78')
  ouro.addColorStop(0.46, '#c58f2d')
  ouro.addColorStop(0.56, '#9a671b')
  ouro.addColorStop(0.74, '#dfb04e')
  ouro.addColorStop(1, '#7a4e12')
  o.fillStyle = ouro
  o.fillText(nome, cx, base)
  o.globalCompositeOperation = 'source-atop'
  const rnd = semente(3131)
  const passo = px * 0.11
  for (let y = topo - passo; y < base + descida + passo; y += passo * 0.86) {
    for (let x = cx - medida.width / 2 - passo; x < cx + medida.width / 2 + passo; x += passo) {
      o.strokeStyle = `rgba(255, 246, 214, ${0.07 + rnd() * 0.1})`
      o.lineWidth = 1 + rnd() * 1.5
      o.beginPath()
      o.arc(x + (rnd() - 0.5) * passo * 0.3, y, passo * 0.48, 0, Math.PI * 2)
      o.stroke()
    }
  }
  for (let i = 0; i < 140; i++) {
    const x = cx + (rnd() - 0.5) * medida.width
    const y = topo + rnd() * (subida + descida)
    const ang = (rnd() - 0.5) * 0.6
    const comp = 4 + rnd() * 16
    o.strokeStyle = rnd() < 0.7 ? 'rgba(70, 40, 8, 0.35)' : 'rgba(255, 250, 230, 0.25)'
    o.lineWidth = 1 + rnd() * 1.6
    o.beginPath()
    o.moveTo(x, y)
    o.lineTo(x + Math.cos(ang) * comp, y + Math.sin(ang) * comp)
    o.stroke()
  }
  g.drawImage(canvasOuro, 0, 0)
  const textura = new THREE.CanvasTexture(canvas)
  textura.anisotropy = 4
  return { textura, fracao: Math.min(1, (medida.width + px * 0.9) / NOME_LARGURA_PX) }
}

// ── Tempo ────────────────────────────────────────────────────────────────────

const T = ROTEIRO_DO_TIRO
const R = ROTEIRO_REDUZIDO

/** Voltas dadas desde t = 0 (o giro freia de 4,4 para 1,35 volta por segundo até a pega). */
function voltasAte(t: number): number {
  const s = clamp01(t / T.pega)
  return GIRO_FINAL * T.pega * s + ((GIRO_INICIAL - GIRO_FINAL) * T.pega * (1 - Math.pow(1 - s, GIRO_CURVA + 1))) / (GIRO_CURVA + 1)
}

/** Ângulo do giro (rad, anti-horário na tela): chega a 0 na pega, com o cano para a esquerda; depois, o tranco amortecido. */
export function anguloDoGiro(t: number): number {
  if (t < T.pega) return 2 * Math.PI * (voltasAte(t) - GIRO_VOLTAS)
  const tau = t - T.pega
  const wd = 2 * Math.PI * PEGA_HZ
  return ((2 * Math.PI * GIRO_FINAL) / wd) * Math.exp(-PEGA_AMORTECE * tau) * Math.sin(wd * tau)
}

/** Velocidade do giro (rad/s): dá o borrão do metal. */
export function velocidadeDoGiro(t: number): number {
  if (t < T.pega) return 2 * Math.PI * (GIRO_FINAL + (GIRO_INICIAL - GIRO_FINAL) * Math.pow(1 - clamp01(t / T.pega), GIRO_CURVA))
  const tau = t - T.pega
  const wd = 2 * Math.PI * PEGA_HZ
  return 2 * Math.PI * GIRO_FINAL * Math.exp(-PEGA_AMORTECE * tau) * (Math.cos(wd * tau) - (PEGA_AMORTECE / wd) * Math.sin(wd * tau))
}

function voltaComSobra(x: number, c1: number): number {
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** A virada do pulso para a tela: 0 = de perfil, 1 = mirando (passa 2% e volta). */
export function viradaDaMira(t: number, reduzir: boolean): number {
  if (reduzir) return 1
  return t <= T.miraInicio ? 0 : voltaComSobra(span(t, T.miraInicio, T.miraFim), 0.9)
}

/** O cão: 0 = abaixado, 1 = engatilhado; cai no tiro. */
export function caoEngatilhado(t: number, reduzir: boolean): number {
  const a = reduzir ? R.engatilha : T.engatilha
  if (t >= (reduzir ? R.tiro : T.tiro) - 0.01) return 0
  return easeInOutSine(span(t, a, a + 0.1))
}

/** Quanto o tambor rodou ao engatilhar (0 a 1 = uma câmara, 60 graus). */
function indiceDoTambor(t: number, reduzir: boolean): number {
  const a = reduzir ? R.engatilha : T.engatilha
  return easeInOutSine(span(t, a + 0.02, a + 0.1))
}

/** O recuo: sobe em 45 ms e a mão traz de volta (sem quicar). */
export function recuo(t: number, reduzir: boolean): number {
  if (reduzir) return 0
  const tau = t - T.tiro
  if (tau <= 0) return 0
  const SOBE = 0.045
  if (tau < SOBE) return easeOutCubic(tau / SOBE)
  const s = tau - SOBE
  return (1 + s / 0.11) * Math.exp(-s / 0.11)
}

function momentoDoTiro(reduzir: boolean): number {
  return reduzir ? R.tiro : T.tiro
}

/** O clarão da boca: um estalo que some em uns três quadros. */
export function clarao(t: number, reduzir: boolean): number {
  const tau = t - momentoDoTiro(reduzir)
  return tau < 0 ? 0 : Math.exp(-tau / 0.032) * (reduzir ? 0.55 : 1)
}

/**
 * Até onde o clarão ainda soma luz que se vê (menos de 1/300 além disso), em unidades de altura:
 * o raio mais comprido decai com exp(-r/0,5) e a língua de fogo com exp(-r/0,15); a bola de fogo
 * não passa de 0,5 da boca.
 */
function alcanceDoClarao(forca: number, bola: number): number {
  const doClarao = forca > 0.002 ? Math.max(0.5 * Math.log(453 * forca), 0.15 * Math.log(567 * forca), 0) : 0
  return Math.max(doClarao, bola > 0.01 ? 0.5 : 0)
}

function bolaDeFogo(t: number, reduzir: boolean): number {
  const tau = t - momentoDoTiro(reduzir)
  return tau < 0 ? 0 : easeOutCubic(clamp01(tau / 0.012)) * Math.exp(-tau / 0.075) * (reduzir ? 0.5 : 1)
}

/** Até onde as rachaduras em raio chegaram (unidades de altura da tela). */
export function frenteDaRachadura(t: number, reduzir: boolean): number {
  if (reduzir) return t >= R.tiro ? RAIO_DA_RACHADURA : 0
  const s = span(t, T.impacto, T.raiosFim)
  return t < T.impacto ? 0 : RAIO_DA_RACHADURA * (1 - (1 - s) * (1 - s))
}

function frenteDosAneis(t: number, reduzir: boolean): number {
  if (reduzir) return t >= R.tiro ? RAIO_DA_RACHADURA : 0
  const s = span(t, T.impacto + 0.03, T.aneisFim)
  return t < T.impacto + 0.03 ? 0 : RAIO_DA_RACHADURA * (1 - (1 - s) * (1 - s))
}

/** O letreiro: 0 = ainda não, 1 = aceso. */
function surgeDoNome(t: number, reduzir: boolean): number {
  return reduzir ? easeInOutSine(span(t, R.nomeSurge, R.nomeAceso)) : easeOutCubic(span(t, T.nomeSurge, T.nomeNitido))
}

/** A luz da cena: sobe na entrada; na mira estreita um pouco (tensão); com movimento reduzido apaga no fim. */
function luzDaCena(t: number, reduzir: boolean): number {
  if (reduzir) return (0.12 + 0.88 * easeInOutSine(span(t, 0, R.surgeFim))) * (1 - easeInOutSine(span(t, R.apagaInicio, R.apagaFim)))
  return (0.08 + 0.92 * easeOutCubic(span(t, 0, 0.5))) * (1 - 0.14 * easeInOutSine(span(t, T.miraFim, T.tiro)))
}

function fadeDoTiro(t: number, reduzir: boolean): number {
  const entrada = 1 - easeOutCubic(span(t, 0, T.fadeInFim))
  const saida = easeInOutSine(span(t, reduzir ? R.fadeOutInicio : T.fadeOutInicio, T.duracao))
  return Math.max(entrada, saida)
}

/** O tremor da tela no tiro (unidades de altura da tela). */
function tremor(t: number, reduzir: boolean): [number, number] {
  const tau = t - T.impacto
  if (reduzir || tau < 0) return [0, 0]
  const k = 0.014 * Math.exp(-tau / 0.06)
  return [k * Math.sin(tau * 2 * Math.PI * 23), k * Math.cos(tau * 2 * Math.PI * 31)]
}

export interface EstadoDoTiro {
  giroGraus: number
  voltasPorSegundo: number
  miraGraus: number
  cao: number
  tamborGraus: number
  recuoGraus: number
  clarao: number
  frenteDaRachadura: number
  /** Segundos desde que o vidro cedeu (negativo = inteiro). */
  quedaS: number
  nome: number
  luz: number
  fade: number
}

/** O estado da animação no tempo `t`, sem desenhar (o gráfico do movimento sai daqui). */
export function estadoDoTiro(t: number, reduzir: boolean): EstadoDoTiro {
  const graus = 180 / Math.PI
  return {
    giroGraus: reduzir ? 0 : anguloDoGiro(t) * graus,
    voltasPorSegundo: reduzir ? 0 : velocidadeDoGiro(t) / (2 * Math.PI),
    miraGraus: viradaDaMira(t, reduzir) * GUINADA_MIRA * graus,
    cao: caoEngatilhado(t, reduzir),
    tamborGraus: indiceDoTambor(t, reduzir) * 60,
    recuoGraus: recuo(t, reduzir) * RECUO_ANGULO * graus,
    clarao: clarao(t, reduzir),
    frenteDaRachadura: frenteDaRachadura(t, reduzir),
    quedaS: reduzir ? -1 : t - T.cede,
    nome: surgeDoNome(t, reduzir),
    luz: luzDaCena(t, reduzir),
    fade: fadeDoTiro(t, reduzir),
  }
}

// ── Cena ─────────────────────────────────────────────────────────────────────

export function criarCenaTiroNaTela(THREE: ThreeModule, opcoes: OpcoesDoTiro): CenaTransicao {
  const reduzir = opcoes.reduzirMovimento
  const nomeLimpo = nomeDaBatalha(opcoes.nome)
  const comNome = nomeLimpo !== ''
  const lixo: Descartavel[] = []
  const guardar: Guardar = (x) => {
    lixo.push(x)
    return x
  }
  const vec2 = (x: number, y: number) => new THREE.Vector2(x, y)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 60)
  scene.add(camera)
  const olho = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 60)
  olho.layers.set(CAMADA_DA_ARMA)
  scene.add(olho)
  let aspecto = 16 / 9
  let afastar = 1

  // ── a arma ──
  const uLuz = { value: 0 }
  const uClarao = { value: 0 }
  const uBocaV = { value: new THREE.Vector3() }
  const uMundoParaArma = { value: new THREE.Matrix4() }
  const uRuido = { value: guardar(criarGradeDeRuido(THREE)) as Three.Texture }
  const material = (tipo: number, tinta: readonly [number, number, number], lados: Three.Side = THREE.FrontSide) =>
    guardar(
      new THREE.RawShaderMaterial({
        vertexShader: VERT_ARMA,
        fragmentShader: FRAG_ARMA,
        glslVersion: THREE.GLSL3,
        defines: { MATERIAL: tipo },
        side: lados,
        uniforms: { uLuz, uClarao, uBocaV, uMundoParaArma, uRuido, uTinta: { value: new THREE.Vector3(...tinta) } },
      }),
    )
  const revolver = construirRevolver(
    THREE,
    {
      aco: material(0, [1, 1, 1]),
      acoDoCao: material(0, [1.22, 1.08, 0.92]),
      madeira: material(1, [1, 1, 1]),
      chumbo: material(2, [1, 1, 1]),
      escuro: material(3, [1, 1, 1], THREE.DoubleSide),
    },
    guardar,
  )
  scene.add(revolver.pulso)

  // ── o vidro (a tela) ──
  // Duas texturas para a arma: a inteira (parada, na mira) e uma menor enquanto gira (o borrão
  // esconde a resolução e o borrão lê até 10 vezes cada ponto: na placa integrada isso pesa).
  const rt = guardar(new THREE.WebGLRenderTarget(1, 1, { samples: 4 }))
  const rtDoGiro = guardar(new THREE.WebGLRenderTarget(1, 1, { samples: 4 }))
  let girando = !reduzir
  let texturasProntas = false
  const nome = comNome ? pintarNome(THREE, nomeLimpo) : null
  if (nome) guardar(nome.textura)
  const semNome = guardar(new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1))
  semNome.needsUpdate = true
  const uTempo = { value: 0 }
  const uAspecto = { value: aspecto }
  const uVidro = {
    uTempo,
    uAspecto,
    uLuz,
    uClarao,
    uArma: { value: rt.texture as Three.Texture },
    uCaixaArma: { value: new THREE.Vector4(0, 0, 1, 1) },
    uAlcanceDoClarao: { value: 0 },
    uPivo: { value: vec2(0, 0) },
    uArco: { value: 0 },
    uRaioArma: { value: 1 },
    uPxPorUnidade: { value: 540 },
    uSurgeArma: { value: 1 },
    uBoca: { value: vec2(0, 0) },
    uDirTiro: { value: vec2(-1, 0) },
    uBola: { value: 0 },
    uFumaca: { value: 0 },
    uIdadeDaFumaca: { value: 0 },
    uBrilho: { value: 0 },
    uBrilhoPos: { value: vec2(0, 0) },
    uRacha: { value: 0 },
    uFrenteR: { value: 0 },
    uFrenteA: { value: 0 },
    uRevela: { value: 1 },
    uLuzDoImpacto: { value: 0 },
    uOnda: { value: -1 },
    uNome: { value: (nome ? nome.textura : semNome) as Three.Texture },
    uNomeRet: { value: new THREE.Vector4(0, NOME_Y, 1, 0.25) },
    uNomeSurge: { value: 0 },
    uVarre: { value: -1 },
    uGrao: { value: reduzir ? 0 : 0.028 },
    uImpacto: { value: vec2(0, 0) },
    uQueda: { value: -1 },
    uTremor: { value: vec2(0, 0) },
  }
  // Dos dois lados: a teia é montada no sentido horário, e o caco que cai capota.
  const vidro = new THREE.Mesh(guardar(gerarVidro(THREE)), guardar(new THREE.ShaderMaterial({ vertexShader: VERT_VIDRO, fragmentShader: FRAG_VIDRO, uniforms: uVidro, side: THREE.DoubleSide })))
  vidro.frustumCulled = false
  scene.add(vidro)

  // Antes de desenhar o vidro, a arma vai para a textura (o mesmo jeito do Reflector do three).
  const tamanho = new THREE.Vector2()
  const corDeAntes = new THREE.Color()
  vidro.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(tamanho)
    const escala = Math.min(1, RT_LADO_MAX / Math.max(tamanho.x, tamanho.y, 1))
    const w = Math.max(1, Math.round(tamanho.x * escala))
    const h = Math.max(1, Math.round(tamanho.y * escala))
    const wGiro = Math.max(1, Math.round(w * ESCALA_NO_GIRO))
    const hGiro = Math.max(1, Math.round(h * ESCALA_NO_GIRO))
    if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h)
      texturasProntas = false
    }
    if (rtDoGiro.width !== wGiro || rtDoGiro.height !== hGiro) {
      rtDoGiro.setSize(wGiro, hGiro)
      texturasProntas = false
    }
    const alvo = girando ? rtDoGiro : rt
    uVidro.uArma.value = alvo.texture
    uVidro.uPxPorUnidade.value = alvo.height / 2
    const alvoDeAntes = renderer.getRenderTarget()
    renderer.getClearColor(corDeAntes)
    const alfaDeAntes = renderer.getClearAlpha()
    renderer.setClearColor(0x000000, 0)
    // Na primeira vez, as duas texturas ganham memória já (senão a troca no meio da cena engasga).
    if (!texturasProntas) {
      for (const outra of [rt, rtDoGiro]) {
        outra.scissorTest = false
        renderer.setRenderTarget(outra)
        renderer.clear()
      }
      texturasProntas = true
    }
    // Só a caixa da arma é limpa, desenhada e resolvida (na placa integrada, limpar e resolver a
    // tela inteira com 4 amostras custa mais que a própria arma). O vidro ignora o resto.
    const x0 = Math.max(0, Math.floor((caixaNaTela.x / aspecto) * 0.5 * alvo.width + 0.5 * alvo.width) - 2)
    const y0 = Math.max(0, Math.floor(caixaNaTela.y * 0.5 * alvo.height + 0.5 * alvo.height) - 2)
    const x1 = Math.min(alvo.width, Math.ceil((caixaNaTela.z / aspecto) * 0.5 * alvo.width + 0.5 * alvo.width) + 2)
    const y1 = Math.min(alvo.height, Math.ceil(caixaNaTela.w * 0.5 * alvo.height + 0.5 * alvo.height) + 2)
    const largura = Math.max(1, x1 - x0)
    const altura = Math.max(1, y1 - y0)
    alvo.scissor.set(Math.min(x0, alvo.width - 1), Math.min(y0, alvo.height - 1), largura, altura)
    alvo.scissorTest = true
    // Um texel para dentro: o filtro bilinear da borda não lê o que ficou de fora.
    uVidro.uCaixaArma.value.set((x0 + 1) / alvo.width, (y0 + 1) / alvo.height, (x0 + largura - 1) / alvo.width, (y0 + altura - 1) / alvo.height)
    renderer.setRenderTarget(alvo)
    renderer.clear()
    renderer.render(scene, olho)
    renderer.setRenderTarget(alvoDeAntes)
    renderer.setClearColor(corDeAntes, alfaDeAntes)
  }

  // ── a pose ──
  const pivoNoMundo = new THREE.Vector3()
  const bocaNaMira = new THREE.Vector3()
  const temp = new THREE.Vector3()
  const temp2 = new THREE.Vector3()
  const frenteDaBoca = new THREE.Vector2()
  const pontoNaTela = new THREE.Vector2()
  /** A caixa da arma na tela (x0, y0, x1, y1), em unidades de altura. */
  const caixaNaTela = new THREE.Vector4(-aspecto, -1, aspecto, 1)
  // A caixa do desenho da arma no espaço dela, com folga para o cão engatilhado e o fim do borrão.
  revolver.pulso.updateMatrixWorld(true)
  const caixaDaArma = new THREE.Box3()
    .setFromObject(revolver.modelo)
    .applyMatrix4(revolver.modelo.matrixWorld.clone().invert())
    .expandByScalar(FOLGA_DA_CAIXA)
  const telaGiroY = comNome ? TELA_GIRO_Y_COM_NOME : TELA_GIRO_Y_SEM_NOME
  const telaMiraY = comNome ? TELA_MIRA_Y_COM_NOME : TELA_MIRA_Y_SEM_NOME

  /** Põe a arma e a câmera da arma no tempo `t` (sem tremor). */
  function posicionar(t: number) {
    const virada = viradaDaMira(t, reduzir)
    const giro = reduzir ? 0 : anguloDoGiro(t)
    const sobe = reduzir ? 1 : easeOutCubic(span(t, 0, T.sobeFim))
    revolver.pulso.position.set(0.5 * (1 - sobe), -3.6 * (1 - sobe), 0)
    // Primeiro a guinada (o cano vem para a câmera), depois a arfagem no eixo x do mundo.
    revolver.pulso.rotation.set(-ARFAGEM_MIRA * virada, GUINADA_MIRA * virada, 0, 'XYZ')
    // Giro no dedo; o recuo gira em volta da mão e empurra para trás (o cano aponta para -x).
    const r = recuo(t, reduzir)
    const fi = -RECUO_ANGULO * r
    const hx = MAO_X - PIVO_X
    const hy = MAO_Y - PIVO_Y
    const c = Math.cos(fi)
    const s = Math.sin(fi)
    const tras = RECUO_TRAS * r
    revolver.arma.rotation.set(0, 0, giro + fi)
    revolver.arma.position.set(hx - (c * hx - s * hy) + c * tras, hy - (s * hx + c * hy) + s * tras, 0)
    // Um tranquinho para baixo quando o cão trava.
    const trava = reduzir ? 0 : 0.035 * Math.exp(-Math.max(0, t - T.engatilha - 0.09) / 0.05) * (t > T.engatilha + 0.09 ? 1 : 0)
    revolver.arma.rotation.z += trava
    revolver.cao.rotation.z = -CAO_ENGATILHADO * caoEngatilhado(t, reduzir)
    revolver.tambor.rotation.x = (indiceDoTambor(t, reduzir) * Math.PI) / 3
    // A câmera: no giro olha o pivô; na mira, a boca; vai chegando até o tiro.
    const enquadra = reduzir ? 1 : easeInOutSine(span(t, T.pega - 0.02, T.miraFim + 0.12))
    const chega = reduzir ? 0 : easeInOutSine(span(t, T.miraFim, T.tiro))
    const alvoX = pivoNoMundo.x + (bocaNaMira.x - pivoNoMundo.x) * enquadra
    const alvoY = pivoNoMundo.y + (bocaNaMira.y - pivoNoMundo.y) * enquadra
    const alvoZ = pivoNoMundo.z + (bocaNaMira.z - pivoNoMundo.z) * enquadra
    const dz = (DISTANCIA_GIRO + (DISTANCIA_BOCA - DISTANCIA_GIRO) * enquadra) * afastar - APROXIMA_ATE_O_TIRO * chega
    const telaX = TELA_GIRO_X + (TELA_MIRA_X - TELA_GIRO_X) * enquadra
    const telaY = telaGiroY + (telaMiraY - telaGiroY) * enquadra
    olho.position.set(alvoX - (telaX * dz) / FOCAL, alvoY - (telaY * dz) / FOCAL, alvoZ + dz)
    revolver.pulso.updateMatrixWorld(true)
    olho.updateMatrixWorld()
  }

  /** Um ponto do desenho da arma, no mundo. */
  function noMundo(x: number, y: number, z: number, destino: Three.Vector3): Three.Vector3 {
    return revolver.modelo.localToWorld(destino.set(x, y, z))
  }

  /** Um ponto do mundo na tela, em unidades de altura (x vai de -aspecto a aspecto). */
  function naTela(p: Three.Vector3, destino: Three.Vector2): Three.Vector2 {
    temp2.copy(p).project(olho)
    return destino.set(temp2.x * aspecto, temp2.y)
  }

  let impactoSujo = true
  /** Onde a bala bate: a linha do cano, a 1,4 da boca, com a arma na pose do tiro. */
  function calcularImpacto() {
    // A boca na pose da mira (sem recuo), para a câmera enquadrar.
    pivoNoMundo.set(0, 0, 0)
    bocaNaMira.set(0, 0, 0)
    posicionar(T.miraFim + 0.3)
    noMundo(BOCA_X, EIXO_DO_CANO_Y, 0, bocaNaMira)
    posicionar(momentoDoTiro(reduzir) - 0.005)
    const boca = noMundo(BOCA_X, EIXO_DO_CANO_Y, 0, new THREE.Vector3())
    const atras = noMundo(BOCA_X + 1, EIXO_DO_CANO_Y, 0, new THREE.Vector3())
    const rumo = boca.clone().sub(atras).normalize()
    const ponto = boca.clone().addScaledVector(rumo, BALA_ATE_O_VIDRO)
    const impacto = naTela(ponto, uVidro.uImpacto.value)
    impacto.x = Math.max(-0.8 * aspecto, Math.min(0.8 * aspecto, impacto.x))
    impacto.y = Math.max(-0.75, Math.min(0.75, impacto.y))
    impactoSujo = false
  }

  function atualizar(tBruto: number) {
    const t = Math.min(T.duracao, Math.max(0, tBruto))
    if (impactoSujo) calcularImpacto()
    posicionar(t)
    uTempo.value = t
    uLuz.value = luzDaCena(t, reduzir)
    uMundoParaArma.value.copy(revolver.modelo.matrixWorld).invert()
    const tiro = momentoDoTiro(reduzir)

    // A arma na tela: pivô e raio para o borrão do giro; a boca para o clarão e a fumaça.
    noMundo(PIVO_X, PIVO_Y, 0, temp)
    naTela(temp, uVidro.uPivo.value)
    const distancia = Math.max(0.5, olho.position.z - temp.z)
    uVidro.uRaioArma.value = ((RAIO_DO_GIRO + 0.25) * FOCAL) / distancia
    uVidro.uArco.value = reduzir ? 0 : Math.abs(velocidadeDoGiro(t)) * OBTURADOR_S
    // A troca para a textura inteira cai no tranco da pegada: a arma para e fica nítida junto.
    girando = !reduzir && t < T.pega + 0.03
    // A caixa da arma na tela: girando, o disco inteiro do giro; parada, os 8 cantos do desenho.
    if (girando) {
      const p = uVidro.uPivo.value
      const raio = uVidro.uRaioArma.value
      caixaNaTela.set(p.x - raio, p.y - raio, p.x + raio, p.y + raio)
    } else {
      caixaNaTela.set(Infinity, Infinity, -Infinity, -Infinity)
      for (let canto = 0; canto < 8; canto++) {
        const cx = canto & 1 ? caixaDaArma.max.x : caixaDaArma.min.x
        const cy = canto & 2 ? caixaDaArma.max.y : caixaDaArma.min.y
        const cz = canto & 4 ? caixaDaArma.max.z : caixaDaArma.min.z
        naTela(noMundo(cx, cy, cz, temp), pontoNaTela)
        caixaNaTela.set(
          Math.min(caixaNaTela.x, pontoNaTela.x),
          Math.min(caixaNaTela.y, pontoNaTela.y),
          Math.max(caixaNaTela.z, pontoNaTela.x),
          Math.max(caixaNaTela.w, pontoNaTela.y),
        )
      }
    }
    noMundo(BOCA_X, EIXO_DO_CANO_Y, 0, temp)
    naTela(temp, uVidro.uBoca.value)
    uBocaV.value.copy(temp).applyMatrix4(olho.matrixWorldInverse)
    // O rumo do cano na tela (a língua de fogo sai por ele).
    noMundo(BOCA_X - 0.25, EIXO_DO_CANO_Y, 0, temp)
    naTela(temp, frenteDaBoca)
    const dir = frenteDaBoca.sub(uVidro.uBoca.value)
    if (dir.lengthSq() > 1e-8) uVidro.uDirTiro.value.copy(dir.normalize())
    uVidro.uSurgeArma.value = reduzir ? easeInOutSine(span(t, R.surgeInicio, R.surgeFim)) : 1

    // O brilho que corre no cano a cada volta (só no fim do giro, quando já dá para ver).
    if (!reduzir && t < T.pega + 0.1) {
      const w = velocidadeDoGiro(t)
      const angCano = Math.PI + anguloDoGiro(t)
      const angLuz = Math.atan2(0.62, -0.5) + Math.PI / 2
      let d = (((angCano - angLuz) % Math.PI) + Math.PI) % Math.PI
      d = Math.min(d, Math.PI - d)
      const largura = Math.max(0.12, Math.abs(w) * 0.02)
      const lento = 1 - smoothstep(1.6, 2.8, Math.abs(w) / (2 * Math.PI))
      uVidro.uBrilho.value = Math.exp(-(d * d) / (largura * largura)) * (0.12 / largura) * lento * uLuz.value * 0.8
      noMundo(-1.15, EIXO_DO_CANO_Y + 0.08, 0.05, temp)
      naTela(temp, uVidro.uBrilhoPos.value)
    } else uVidro.uBrilho.value = 0

    // O tiro: clarão, bola de fogo, fumaça.
    uClarao.value = clarao(t, reduzir)
    uVidro.uBola.value = bolaDeFogo(t, reduzir)
    uVidro.uAlcanceDoClarao.value = alcanceDoClarao(uClarao.value, uVidro.uBola.value)
    const idade = t - tiro
    uVidro.uIdadeDaFumaca.value = Math.max(0, idade)
    uVidro.uFumaca.value = idade < 0 ? 0 : easeOutCubic(clamp01(idade / 0.08)) * Math.exp(-idade / 1.3) * (reduzir ? 0.6 : 1)

    // O vidro: racha, onda, tremor, cai.
    const impacto = reduzir ? R.tiro : T.impacto
    uVidro.uRacha.value = t < impacto ? 0 : reduzir ? easeInOutSine(span(t, impacto, R.rachaFim)) : easeOutCubic(span(t, impacto, impacto + 0.05))
    uVidro.uRevela.value = reduzir ? uVidro.uRacha.value : 1
    uVidro.uFrenteR.value = frenteDaRachadura(t, reduzir)
    uVidro.uFrenteA.value = frenteDosAneis(t, reduzir)
    uVidro.uLuzDoImpacto.value = t < impacto ? 0 : Math.exp(-(t - impacto) / 0.05) * (reduzir ? 0.35 : 1)
    uVidro.uOnda.value = reduzir || t < impacto ? -1 : t - impacto
    const [tx, ty] = tremor(t, reduzir)
    uVidro.uTremor.value.set(tx, ty)
    uVidro.uQueda.value = reduzir ? -1 : t - T.cede

    // O letreiro.
    uVidro.uNomeSurge.value = comNome ? surgeDoNome(t, reduzir) : 0
    uVidro.uVarre.value = reduzir || !comNome ? -1 : -0.3 + 1.6 * easeInOutSine(span(t, T.nomeSurge + 0.05, T.nomeNitido + 0.25))

    return { fade: fadeDoTiro(t, reduzir) }
  }

  function ajustarTela(novo: number) {
    aspecto = Math.max(0.2, novo)
    uAspecto.value = aspecto
    camera.aspect = aspecto
    camera.updateProjectionMatrix()
    olho.aspect = aspecto
    olho.updateProjectionMatrix()
    // Tela estreita: a câmera recua até a volta do giro caber na largura.
    afastar = Math.max(1, (RAIO_DO_GIRO * FOCAL) / (0.95 * aspecto * DISTANCIA_GIRO))
    // O letreiro cabe em 86% da largura visível.
    const fracao = nome?.fracao ?? 1
    const largura = Math.min(NOME_LARGURA_MAX, (0.86 * 2 * aspecto) / fracao)
    uVidro.uNomeRet.value.set(0, NOME_Y, largura / 2, (largura * NOME_ALTURA_PX) / NOME_LARGURA_PX / 2)
    impactoSujo = true
  }

  function descartar() {
    for (const coisa of lixo) coisa.dispose()
    lixo.length = 0
  }

  ajustarTela(aspecto)
  atualizar(0)

  return { scene, camera, atualizar, ajustarTela, criarSom: (kit: KitDeSom) => criarSomDoTiro(kit, reduzir, comNome), descartar }
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

/** Um vale seco (cauda de 1,6 s), feito de ruído que cai, igual em toda volta. */
function respostaDoVale(ctx: AudioContext, segundos: number): AudioBuffer {
  const n = Math.ceil(ctx.sampleRate * segundos)
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let canal = 0; canal < 2; canal++) {
    const rnd = semente(canal === 0 ? 71 : 113)
    const dados = buffer.getChannelData(canal)
    for (let i = 0; i < n; i++) dados[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, 4.2)
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

function panorama(s: Saida, valor: number, destino: AudioNode): StereoPannerNode {
  const p = s.ctx.createStereoPanner()
  p.pan.value = valor
  p.connect(destino)
  return p
}

/** O vento seco do deserto, baixo, o tempo todo. */
function vento(s: Saida, a: number, fim: number, volume: number) {
  const { ctx } = s
  const banda = filtro(ctx, 'bandpass', 520, 0.55)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.23
  const fundo = ctx.createGain()
  fundo.gain.value = 180
  lfo.connect(fundo)
  fundo.connect(banda.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(volume, a + 0.5)
  g.gain.setValueAtTime(volume, fim - 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, fim - 0.05)
  g.connect(panorama(s, -0.2, s.seco))
  ruidoPor(s, a, fim - a, 0.3, [banda], g)
  lfo.start(a)
  lfo.stop(fim)
}

/** A tensão: lá grave com a quinta, crescendo até o tiro e cortando nele (o silêncio depois do estampido). */
function tensao(s: Saida, a: number, tiro: number, volume: number) {
  const { ctx } = s
  const passa = filtro(ctx, 'lowpass', 200, 1.2)
  passa.frequency.setValueAtTime(200, a)
  passa.frequency.linearRampToValueAtTime(430, tiro)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, a)
  g.gain.exponentialRampToValueAtTime(volume * 0.45, a + 0.6)
  g.gain.exponentialRampToValueAtTime(volume, tiro - 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, tiro + 0.06)
  passa.connect(g)
  g.connect(s.seco)
  for (const [frequencia, tipo, nivel] of [
    [55, 'sawtooth', 0.4],
    [55.32, 'sawtooth', 0.3],
    [82.41, 'triangle', 0.35],
    [110, 'sine', 0.15],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = tipo
    osc.frequency.value = frequencia
    const v = ctx.createGain()
    v.gain.value = nivel
    osc.connect(v)
    v.connect(passa)
    osc.start(a)
    osc.stop(tiro + 0.1)
  }
}

/** Um "fiu" do giro: o ar cortado pelo cano (alto) ou pelo cabo (mais baixo). */
function zunido(s: Saida, a: number, voltas: number, volume: number, lado: number) {
  const { ctx } = s
  const periodo = 1 / Math.max(0.8, voltas)
  const banda = filtro(ctx, 'bandpass', 260 + 210 * voltas, 1.4)
  const g = ctx.createGain()
  // O ar sobe um pouco antes da passada; nunca antes de agora (hora negativa no áudio é erro).
  const inicio = Math.max(ctx.currentTime, a - periodo * 0.22)
  const pico = Math.max(inicio + 0.005, a)
  g.gain.setValueAtTime(0.0001, inicio)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), pico)
  g.gain.exponentialRampToValueAtTime(0.0001, pico + periodo * 0.32)
  g.connect(panorama(s, lado, s.seco))
  ruidoPor(s, inicio, pico - inicio + periodo * 0.34 + 0.02, a * 7.3, [banda], g)
}

/** O giro todo: um fiu cada vez que o cano passa embaixo, um mais fraco quando passa em cima. */
function giro(s: Saida, base: number) {
  let anterior = anguloDoGiro(0)
  let lado = 0.25
  for (let t = 0.001; t <= T.pega; t += 0.001) {
    const a = anguloDoGiro(t)
    const volta = (x: number, desvio: number) => Math.floor((x + desvio) / (2 * Math.PI))
    const voltas = velocidadeDoGiro(t) / (2 * Math.PI)
    const entra = easeOutCubic(span(t, 0, T.sobeFim))
    if (volta(a, Math.PI / 2) !== volta(anterior, Math.PI / 2)) {
      zunido(s, base + t, voltas, (0.08 + 0.045 * Math.min(1, voltas / 4.4)) * (0.4 + 0.6 * entra), lado)
      lado = -lado
    }
    if (volta(a, -Math.PI / 2) !== volta(anterior, -Math.PI / 2)) zunido(s, base + t, voltas * 0.8, (0.04 + 0.022 * Math.min(1, voltas / 4.4)) * (0.4 + 0.6 * entra), -lado * 0.6)
    anterior = a
  }
}

/** A pega: tapa de couro na palma, um baque baixo e o tlim do metal. */
function pega(s: Saida, a: number) {
  const { ctx } = s
  const tapa = ctx.createGain()
  envelope(tapa, a, 0.3, 0.002, 0.07)
  tapa.connect(s.seco)
  ruidoPor(s, a, 0.1, 0.9, [filtro(ctx, 'lowpass', 1400, 0.8)], tapa)
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(150, a)
  osc.frequency.exponentialRampToValueAtTime(60, a + 0.08)
  const baque = ctx.createGain()
  envelope(baque, a, 0.28, 0.003, 0.09)
  osc.connect(baque)
  baque.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.13)
  const tlim = ctx.createGain()
  envelope(tlim, a + 0.004, 0.06, 0.001, 0.02)
  tlim.connect(s.seco)
  ruidoPor(s, a + 0.004, 0.04, 1.4, [filtro(ctx, 'highpass', 3000, 0.7)], tlim)
}

/** A virada para a tela: um assobio curto que desce. */
function viradaDoPulso(s: Saida, a: number) {
  const { ctx } = s
  const banda = filtro(ctx, 'bandpass', 1100, 0.9)
  banda.frequency.setValueAtTime(1100, a)
  banda.frequency.exponentialRampToValueAtTime(420, a + 0.2)
  const g = ctx.createGain()
  envelope(g, a, 0.07, 0.04, 0.16)
  g.connect(s.seco)
  g.connect(s.sala)
  ruidoPor(s, a, 0.24, 1.7, [banda], g)
}

/** Um clique de metal: um sopro de ruído curtíssimo que faz soar filtros estreitos. */
function estalo(s: Saida, a: number, volume: number, frequencias: readonly number[]) {
  const { ctx } = s
  const env = ctx.createGain()
  envelope(env, a, 1, 0.0005, 0.012)
  const saida = ctx.createGain()
  saida.gain.value = volume
  for (const f of frequencias) {
    const b = filtro(ctx, 'bandpass', f, 26)
    env.connect(b)
    b.connect(saida)
  }
  saida.connect(s.seco)
  saida.connect(s.sala)
  const fonte = ctx.createBufferSource()
  fonte.buffer = s.ruido(2)
  fonte.loop = true
  fonte.connect(env)
  fonte.start(a, (a * 3.7) % 2)
  fonte.stop(a + 0.06)
}

/** Engatilhar: o cão sai (clic), a catraca do tambor e o cão trava (clac). */
function engatilhar(s: Saida, a: number) {
  const { ctx } = s
  estalo(s, a, 2.6, [2900, 4700, 7400])
  estalo(s, a + 0.03, 0.9, [5200, 8100])
  estalo(s, a + 0.055, 0.8, [5600, 8600])
  estalo(s, a + 0.09, 3.6, [2300, 3900, 6100])
  const osc = ctx.createOscillator()
  osc.frequency.value = 210
  const g = ctx.createGain()
  envelope(g, a + 0.09, 0.08, 0.002, 0.05)
  osc.connect(g)
  g.connect(s.seco)
  osc.start(a + 0.09)
  osc.stop(a + 0.16)
}

/** O tiro: o estalo, o corpo que fecha, o estrondo grave e o eco do vale, duas vezes. */
function estampido(s: Saida, a: number, forca: number) {
  const { ctx } = s
  const estalido = ctx.createGain()
  envelope(estalido, a, 0.6 * forca, 0.0004, 0.018)
  estalido.connect(s.seco)
  ruidoPor(s, a, 0.05, 0.11, [filtro(ctx, 'highpass', 700, 0.7)], estalido)
  const corpo = ctx.createGain()
  envelope(corpo, a, 0.55 * forca, 0.0015, 0.5)
  const fecha = filtro(ctx, 'lowpass', 7000, 0.7)
  fecha.frequency.setValueAtTime(7000, a)
  fecha.frequency.exponentialRampToValueAtTime(260, a + 0.35)
  corpo.connect(s.seco)
  corpo.connect(s.sala)
  ruidoPor(s, a, 0.6, 1.3, [fecha], corpo)
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(115, a)
  osc.frequency.exponentialRampToValueAtTime(34, a + 0.3)
  const estrondo = ctx.createGain()
  envelope(estrondo, a, 0.7 * forca, 0.002, 0.42)
  osc.connect(estrondo)
  estrondo.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.5)
  for (const [atraso, corte, volume] of [
    [0.34, 1600, 0.3],
    [0.71, 800, 0.14],
  ] as const) {
    const d = ctx.createDelay(1)
    d.delayTime.value = atraso
    const f = filtro(ctx, 'lowpass', corte, 0.6)
    const g = ctx.createGain()
    g.gain.value = volume * forca
    corpo.connect(d)
    estalido.connect(d)
    d.connect(f)
    f.connect(g)
    g.connect(s.seco)
    g.connect(s.sala)
  }
}

/** A bala no vidro: o golpe, as rachaduras correndo (um trem de estalinhos) e o vidro soando. */
function vidroQuebra(s: Saida, a: number, forca: number) {
  const { ctx } = s
  const golpe = ctx.createGain()
  envelope(golpe, a, 0.55 * forca, 0.0004, 0.012)
  golpe.connect(s.seco)
  ruidoPor(s, a, 0.04, 0.5, [filtro(ctx, 'highpass', 4200, 0.7)], golpe)
  const rnd = semente(4242)
  const N = 34
  for (let i = 0; i < N; i++) {
    const quando = a + 0.004 + Math.pow(i / N, 1.5) * 0.24 + rnd() * 0.006
    const g = ctx.createGain()
    envelope(g, quando, (0.26 - (0.18 * i) / N) * (0.6 + 0.4 * rnd()) * forca, 0.0004, 0.004 + rnd() * 0.006)
    g.connect(panorama(s, (rnd() - 0.5) * 1.2, s.seco))
    ruidoPor(s, quando, 0.02, rnd() * 2, [filtro(ctx, 'highpass', 2600 + rnd() * 3800, 0.8)], g)
  }
  for (const [f, v, queda] of [
    [2350, 0.04, 0.6],
    [3810, 0.032, 0.46],
    [5170, 0.024, 0.36],
    [6930, 0.016, 0.28],
    [8420, 0.012, 0.22],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.frequency.value = f * (0.995 + rnd() * 0.01)
    const g = ctx.createGain()
    envelope(g, a + 0.002, v * forca, 0.002, queda)
    osc.connect(g)
    const p = panorama(s, (rnd() - 0.5) * 0.8, s.seco)
    g.connect(p)
    g.connect(s.sala)
    osc.start(a)
    osc.stop(a + queda + 0.05)
  }
}

/** O letreiro acendendo: um brilho miúdo, agudo e macio. */
function brilhoDoNome(s: Saida, a: number) {
  const { ctx } = s
  for (const [f, atraso, lado] of [
    [2093, 0, -0.3],
    [3136, 0.06, 0],
    [4186, 0.12, 0.3],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.frequency.value = f
    const g = ctx.createGain()
    envelope(g, a + atraso, 0.012, 0.12, 0.55)
    osc.connect(g)
    g.connect(panorama(s, lado, s.seco))
    g.connect(s.sala)
    osc.start(a + atraso)
    osc.stop(a + atraso + 0.72)
  }
  const g = ctx.createGain()
  envelope(g, a, 0.02, 0.15, 0.3)
  g.connect(s.seco)
  ruidoPor(s, a, 0.5, 0.2, [filtro(ctx, 'highpass', 6500, 0.7)], g)
}

/** O vidro range antes de ceder: uns estalinhos soltos. */
function rangido(s: Saida, a: number) {
  const { ctx } = s
  const rnd = semente(2727)
  for (const atraso of [0, 0.06, 0.13, 0.17, 0.24]) {
    const g = ctx.createGain()
    envelope(g, a + atraso, 0.07 + rnd() * 0.05, 0.0004, 0.006)
    g.connect(panorama(s, (rnd() - 0.5) * 1.0, s.seco))
    ruidoPor(s, a + atraso, 0.02, rnd() * 2, [filtro(ctx, 'highpass', 3000 + rnd() * 2000, 0.8)], g)
  }
}

/** O vidro cede: o estouro, o baque da massa soltando e os cacos tilintando, cada vez menos. */
function cacosCaindo(s: Saida, a: number, fim: number) {
  const { ctx } = s
  const estouro = ctx.createGain()
  envelope(estouro, a, 0.4, 0.003, 0.32)
  estouro.connect(s.seco)
  estouro.connect(s.sala)
  ruidoPor(s, a, 0.4, 0.7, [filtro(ctx, 'bandpass', 4200, 0.7)], estouro)
  const chiado = ctx.createGain()
  envelope(chiado, a, 0.12, 0.002, 0.22)
  chiado.connect(s.seco)
  ruidoPor(s, a, 0.3, 1.1, [filtro(ctx, 'highpass', 7500, 0.7)], chiado)
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(95, a)
  osc.frequency.exponentialRampToValueAtTime(48, a + 0.2)
  const baque = ctx.createGain()
  envelope(baque, a, 0.16, 0.004, 0.2)
  osc.connect(baque)
  baque.connect(s.seco)
  osc.start(a)
  osc.stop(a + 0.26)
  const rnd = semente(5151)
  for (let i = 0; i < 28; i++) {
    const quando = a + 0.02 + Math.pow(rnd(), 1.4) * 0.5
    const f = 2600 + rnd() * 5200
    const v = 0.03 + rnd() * 0.045
    const queda = 0.05 + rnd() * 0.1
    const lado = (rnd() - 0.5) * 1.4
    if (quando + queda > fim - 0.08) continue
    for (const [razao, k] of [
      [1, 1],
      [2.76, 0.45],
    ] as const) {
      const t = ctx.createOscillator()
      t.frequency.value = f * razao
      const g = ctx.createGain()
      envelope(g, quando, v * k, 0.0015, queda)
      t.connect(g)
      g.connect(panorama(s, lado, s.seco))
      t.start(quando)
      t.stop(quando + queda + 0.03)
    }
  }
}

/** Cada pista recebe a hora do áudio que corresponde ao t = 0 da cena. */
type Pista = [nome: string, quando: number, tocar: (base: number) => void]

/** Reta até 0,6; dali arredonda até 0,8 (cerca de -2 dBFS). Som baixo passa sem mudar nada. */
function curvaDoTeto(): Float32Array<ArrayBuffer> {
  const N = 2049
  const JOELHO = 0.6
  const MAXIMO = 0.8
  const curva = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a < JOELHO ? a : JOELHO + (MAXIMO - JOELHO) * Math.tanh((a - JOELHO) / (MAXIMO - JOELHO))
    curva[i] = Math.sign(x) * y
  }
  return curva
}

function criarSomDoTiro(kitDoMotor: KitDeSom, reduzir: boolean, comNome: boolean) {
  const { ctx } = kitDoMotor
  // Limitador na saída: o estampido e o vidro chegam juntos. O compressor deixa passar a frente do
  // estalo (ataque de 2 ms); a curva depois dele arredonda o que sobra, sem passar de -2 dBFS.
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -10
  limitador.knee.value = 4
  limitador.ratio.value = 16
  limitador.attack.value = 0.002
  limitador.release.value = 0.2
  const teto = ctx.createWaveShaper()
  teto.curve = curvaDoTeto()
  teto.oversample = '4x'
  limitador.connect(teto)
  teto.connect(kitDoMotor.destino)
  // O fecho: tudo some até o fim da cena (o motor fecha o som ali).
  const mestre = ctx.createGain()
  mestre.connect(limitador)
  const sala = ctx.createConvolver()
  sala.buffer = respostaDoVale(ctx, 1.6)
  const volta = ctx.createGain()
  volta.gain.value = 0.24
  sala.connect(volta)
  volta.connect(mestre)
  const s: Saida = { ctx, seco: mestre, sala, ruido: kitDoMotor.ruido }
  const fim = T.duracao
  const fecho = (base: number) => {
    mestre.gain.cancelScheduledValues(0)
    mestre.gain.setValueAtTime(1, Math.max(ctx.currentTime, base))
    mestre.gain.setValueAtTime(1, base + fim - 0.32)
    mestre.gain.exponentialRampToValueAtTime(0.0001, base + fim - 0.02)
  }
  const todas: Pista[] = reduzir
    ? [
        ['fecho', 0, fecho],
        ['vento', 0, (base) => vento(s, base, base + fim, 0.045)],
        ['tensao', 0, (base) => tensao(s, base, base + R.tiro, 0.11)],
        ['engatilha', R.engatilha, (base) => engatilhar(s, base + R.engatilha)],
        ['tiro', R.tiro, (base) => estampido(s, base + R.tiro, 0.85)],
        ['vidro', R.tiro + 0.015, (base) => vidroQuebra(s, base + R.tiro + 0.015, 0.8)],
        ['nome', R.nomeSurge, (base) => brilhoDoNome(s, base + R.nomeSurge)],
      ]
    : [
        ['fecho', 0, fecho],
        ['vento', 0, (base) => vento(s, base, base + fim, 0.05)],
        ['tensao', 0, (base) => tensao(s, base, base + T.tiro, 0.15)],
        ['giro', 0, (base) => giro(s, base)],
        ['pega', T.pega, (base) => pega(s, base + T.pega)],
        ['mira', T.miraInicio, (base) => viradaDoPulso(s, base + T.miraInicio)],
        ['engatilha', T.engatilha, (base) => engatilhar(s, base + T.engatilha)],
        ['tiro', T.tiro, (base) => estampido(s, base + T.tiro, 1)],
        ['vidro', T.impacto, (base) => vidroQuebra(s, base + T.impacto, 1)],
        ['nome', T.nomeSurge, (base) => brilhoDoNome(s, base + T.nomeSurge)],
        ['range', T.range, (base) => rangido(s, base + T.range)],
        ['cede', T.cede, (base) => cacosCaindo(s, base + T.cede, base + fim)],
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

const criar: CriarCena = criarCenaTiroNaTela
export default criar

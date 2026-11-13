import { CanvasSource, Container, Geometry, GlProgram, Mesh, Shader, UniformGroup, type Renderer, type Ticker, type TextureSource } from 'pixi.js'
import type { EfeitoDoAmbiente, FloorPiece, FrequenciaDoRelampago, MapData, Periodo, PinceladaDeAmbiente, TipoDeFolhas } from '../types/map'
import type { SomDaChuva } from '../lib/sons/somDaChuva'
import { chaveDoAbrigo, type AbrigoDoAmbiente } from '../lib/abrigoDoAmbiente'
import {
  AJUSTE_DO_CHAO_MOLHADO,
  CHAO_SECO,
  alvoDoChao,
  climaNoPonto,
  meioDoPoligono,
  niveisDepois,
  passosDasPocas,
  type ClimaDosTelhados,
  type NiveisDoChao,
} from '../lib/chaoMolhado'
import { aquecerChaoMolhado, criarChaoMolhado, type EntradaDoChaoMolhado, type PincelDoChao } from './chaoMolhado'
import { aquecerPrograma } from './aquecerPrograma'
import { BORDA_DA_MASCARA, caixaDaMascara, pintarMascara, telaVazia, type CaixaDaMascara } from './drawNeblina'

/**
 * AMBIENTE no palco (`lib/ambiente.ts`, pedido de 12/11/2026): chuva, neve,
 * brasas, folhas, cinzas e fumaça, cada um num `Mesh` instanciado com um
 * shader próprio (GLSL 300 es). O protótipo aprovado é
 * `docs/design/ambiente/prototipo-ambiente.html`; os números vêm de lá.
 *
 * - AS PARTÍCULAS NÃO GUARDAM ESTADO: a placa de vídeo calcula a posição de
 *   cada uma a partir do número dela (`gl_InstanceID`), de um sorteio e do
 *   relógio. O processador não toca em nenhuma partícula por quadro: só troca
 *   o tempo, o vento e os ladrilhos à vista.
 * - LADRILHOS DE MUNDO: as partículas moram num ladrilho de 32 x 20 casas que
 *   se repete; só os ladrilhos à vista desenham, com no máximo
 *   `tetoNaTela` instâncias por efeito (de longe, cada ladrilho fica com menos).
 * - O ABRIGO (`lib/abrigoDoAmbiente.ts`) são duas máscaras pequenas, refeitas
 *   só quando a cena muda: o SECO (casa fechada: chuva, neve, folhas e cinzas
 *   não caem) e o AR (o seco menos o degradê da porta aberta: brasas, fumaça e
 *   neblina entram por ela).
 * - O PINCEL de cada efeito é a máscara da neblina pintada (`drawNeblina.ts`).
 *
 * Fica acima da noite e da névoa, como a neblina: o efeito do mapa inteiro cai
 * igual sobre o preto (não tem forma), e o pincel do jogador já chega cortado.
 * Movimento reduzido ou "Efeitos do mapa" desligado = partículas paradas.
 */

export type TipoDeParticula = 'chuva' | 'neve' | 'brasas' | 'folhas' | 'cinzas' | 'fumaca'
export const TIPOS_DE_PARTICULA: readonly TipoDeParticula[] = ['chuva', 'neve', 'folhas', 'cinzas', 'fumaca', 'brasas']

/** OS NÚMEROS QUE SE AJUSTAM (os do protótipo aprovado em 12/11/2026). */
export const AJUSTE_DO_AMBIENTE = {
  /** O ladrilho de mundo (casas) e quantas partículas moram nele na intensidade 100. */
  ladrilhoEmCasas: [32, 20],
  porLadrilho: { chuva: 2600, neve: 1500, brasas: 320, folhas: 170, cinzas: 900, fumaca: 140 } satisfies Record<TipoDeParticula, number>,
  /** O teto de instâncias por efeito na tela. */
  tetoNaTela: 6000,
  /** A casa do protótipo (px): os tamanhos e as distâncias do shader estão nessa régua. */
  casaDoPrototipo: 40,
  /** Quanto leva para o efeito aparecer e sumir (constante de tempo, s). */
  aparecerS: 0.3,
  sumirS: 0.1,
  /** Rajadas: a força varia até 22% para mais ou para menos, devagar, a partir da força Vento (0,3). */
  rajada: 0.22,
  noite: { dia: 0, tarde: 0.4, noite: 1 } satisfies Record<Periodo, number>,
  /** O degradê da porta aberta: até onde vai (casas) e a força no miolo, no meio e na ponta. */
  portaEmCasas: 3.75,
  portaParadas: [
    [0, 0.85],
    [0.45, 0.45],
    [1, 0],
  ],
  /** Texels do abrigo por casa e o teto do lado da máscara. */
  texelsDoAbrigoPorCasa: 4,
  ladoMaximoDoAbrigo: 1024,
  /**
   * RELÂMPAGO (decisão do mestre: raro, respeitando o menos movimento): só com a chuva do mapa
   * inteiro a partir de 70%. Um clarão por janela de tempo (s), num instante sorteado pelo número
   * da janela: cai igual no mestre e nos jogadores, pelo relógio de parede.
   */
  relampago: { chuvaMinima: 0.7, janelaS: { raro: 25, frequente: 8.5 }, duracaoS: 0.7, forcaDia: 0.22, forcaNoite: 0.3 },
  /** O som de quem só pintou chuva numa área (sem a chuva do mapa inteiro): uma garoa. */
  chuvaDoPincelNoSom: 0.4,
  /** O relógio volta a zero a cada hora (a precisão do float da placa). */
  voltaDoRelogioS: 3600,
} as const

const VERTICE = `#version 300 es
precision highp float;
precision highp int;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uMundo;
// largura e altura do ladrilho (px de mundo), primeiro ladrilho à vista (x, y)
uniform vec4 uLadrilho;
// ladrilhos por linha, -, escala (casa / 40), 1 px de tela na régua do protótipo
uniform vec4 uGrade;
uniform float uTempo;
uniform float uTipo;
uniform float uPorLadrilho;
uniform vec2 uVento;
// mapa inteiro, pincel (0 a 1)
uniform vec2 uInt;
uniform float uNoite;
uniform vec4 uCaixaDoPincel;
uniform sampler2D uPincel;
uniform sampler2D uSeco;
out vec2 vLocal;
out vec2 vMundo;
out vec4 vParam;
out vec3 vCor;
out float vAlfa;
out float vDoPincel;
flat out int vForma;

uint hsh(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float r01(uint x) { return float(hsh(x) >> 8u) * (1.0 / 16777216.0); }
vec2 girar(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

void main() {
  int tipo = int(uTipo + 0.5);
  int porLadrilho = max(1, int(uPorLadrilho + 0.5));
  int nx = max(1, int(uGrade.x + 0.5));
  float E = uGrade.z;
  float uPx = uGrade.w;
  int ladrilho = gl_InstanceID / porLadrilho;
  int indice = gl_InstanceID - ladrilho * porLadrilho;
  ivec2 lt = ivec2(int(uLadrilho.z) + ladrilho - (ladrilho / nx) * nx, int(uLadrilho.w) + ladrilho / nx);
  uint semente = hsh(uint(lt.x + 4096) * 0x9E3779B1u ^ hsh(uint(lt.y + 4096) * 0x85EBCA77u));
  uint base = hsh(uint(indice) * 16u + uint(tipo) * 0x01000193u + 0x5bd1e995u + semente);
  float h1 = r01(base + 1u), h2 = r01(base + 2u), h3 = r01(base + 3u), h4 = r01(base + 4u), h5 = r01(base + 5u);
  float periodo = tipo == 0 ? mix(0.5, 0.75, h2) : tipo == 1 ? mix(7.0, 11.0, h2) : tipo == 2 ? mix(2.8, 5.2, h2) : tipo == 3 ? mix(6.0, 10.0, h2) : tipo == 4 ? mix(8.0, 13.0, h2) : mix(6.0, 10.0, h2);
  float tt = uTempo / periodo + h1;
  float k = floor(tt);
  float fase = tt - k;
  uint sk = hsh(base + uint(mod(k, 65536.0)) * 0x9E3779B9u + 7u);
  vec2 L = (vec2(lt) + vec2(r01(sk + 11u), r01(sk + 23u))) * uLadrilho.xy;
  vec2 m = L / uMundo;
  float noMapa = (m.x >= 0.0 && m.y >= 0.0 && m.x <= 1.0 && m.y <= 1.0) ? 1.0 : 0.0;
  float pin = textureLod(uPincel, (L - uCaixaDoPincel.xy) * uCaixaDoPincel.zw, 0.0).a * uInt.y;
  float I = max(uInt.x, pin);
  float existe = smoothstep(h3, h3 + 0.05, I) * noMapa;
  vDoPincel = step(uInt.x, h3);
  // Chuva, neve e cinza não pousam no seco (dentro de casa de teto fechado e de cômodo fechado).
  if (tipo == 0 || tipo == 1 || tipo == 4) existe *= 1.0 - step(0.5, textureLod(uSeco, clamp(m, 0.0, 1.0), 0.0).a);
  float forca = length(uVento);
  vec2 desl = vec2(0.0);
  vec2 meio = vec2(1.0);
  float ang = 0.0;
  float alfa = 0.0;
  vec3 cor = vec3(1.0);
  vec4 par = vec4(0.0);
  int forma = 0;
  if (tipo == 0) {
    float queda = 0.8;
    vec2 caida = vec2(uVento.x * 95.0, max(30.0, 105.0 + uVento.y * 45.0));
    if (fase < queda) {
      float u = fase / queda;
      float len = mix(8.0, 22.0, I) * mix(0.8, 1.2, h4);
      vec2 dir = normalize(caida);
      desl = -caida * (1.0 - u) - dir * len * 0.5;
      meio = vec2(len * 0.5 + 1.5, 0.65 + 2.0 + uPx);
      ang = atan(dir.y, dir.x);
      alfa = existe * smoothstep(0.0, 0.15, u) * mix(0.5, 0.8, I);
      par = vec4(len * 0.5, 0.65, 0.0, 0.0);
      forma = 0;
    } else {
      float s = (fase - queda) / (1.0 - queda);
      float r = mix(1.0, mix(2.5, 6.0, I) * mix(0.8, 1.2, h4), sqrt(s));
      meio = vec2(r + 2.5, r * 0.62 + 2.5);
      alfa = existe * pow(1.0 - s, 1.5) * mix(0.4, 0.75, I);
      par = vec4(r, 0.55, 0.0, 0.0);
      forma = 1;
    }
  } else if (tipo == 1) {
    float queda = 0.86;
    vec2 caida = vec2(uVento.x * 230.0, max(50.0, 120.0 + uVento.y * 80.0));
    float r = mix(1.2, 2.6, h4) * mix(0.9, 1.15, I);
    float bal = sin(uTempo * mix(0.9, 1.7, h5) + h1 * 6.2832) * mix(3.0, 9.0, h2);
    float u = min(fase / queda, 1.0);
    desl = -caida * (1.0 - u) + vec2(bal * (1.0 - u * u), 0.0);
    if (fase < queda) {
      alfa = existe * smoothstep(0.0, 0.08, u) * mix(0.8, 1.0, h2);
    } else {
      float s = (fase - queda) / (1.0 - queda);
      r *= 1.0 - 0.35 * s;
      alfa = existe * (1.0 - s) * 0.8;
    }
    meio = vec2(r + 1.0 + uPx);
    par = vec4(r, 0.0, 0.0, 0.0);
    forma = 2;
  } else if (tipo == 2) {
    float t = fase;
    float sobe = mix(90.0, 190.0, h4);
    desl = vec2(uVento.x * 200.0 * t + sin(t * 4.0 + h1 * 6.2832) * 9.0 + sin(t * 11.0 + h5 * 6.2832) * 3.0,
                -sobe * t + uVento.y * 110.0 * t);
    float r = mix(1.0, 1.9, h5) * (1.0 - 0.45 * t);
    float halo = mix(2.6, 4.6, uNoite);
    meio = vec2(r * halo + uPx);
    float pisca = 0.72 + 0.28 * sin(uTempo * mix(12.0, 20.0, h2) + h1 * 40.0);
    alfa = existe * smoothstep(0.0, 0.08, t) * (1.0 - t * t) * pisca;
    // Nasce laranja-claro, esfria para laranja e termina vermelho-escuro (brasa, não vaga-lume).
    cor = mix(mix(vec3(1.0, 0.74, 0.36), vec3(1.0, 0.47, 0.13), smoothstep(0.0, 0.4, t)), vec3(0.78, 0.2, 0.06), smoothstep(0.4, 1.0, t));
    par = vec4(r, halo, 0.0, 0.0);
    forma = 3;
  } else if (tipo == 3) {
    float t = fase;
    vec2 dirV = forca > 0.04 ? uVento / forca : vec2(0.0, 1.0);
    vec2 perp = vec2(-dirV.y, dirV.x);
    float D = mix(70.0, 460.0, forca) * mix(0.8, 1.2, h4);
    float laco = sin(t * 6.2832 * mix(1.0, 2.2, h5) + h1 * 6.2832) * mix(10.0, 24.0, h3);
    desl = dirV * (t - 0.5) * D + perp * laco + vec2(0.0, (t - 0.5) * 50.0 * (1.0 - forca));
    float giro = (h5 > 0.5 ? 1.0 : -1.0) * mix(1.2, 3.5, h2) * (0.5 + forca);
    ang = h1 * 6.2832 + uTempo * giro;
    float vira = cos(uTempo * mix(2.0, 4.5, h3) + h4 * 6.2832);
    float hl = mix(4.2, 6.8, h4);
    meio = vec2(hl + 3.0, hl * 0.6 + 1.5 + uPx);
    par = vec4(hl, hl * 0.42 * (0.3 + 0.7 * abs(vira)), vira, 0.0);
    alfa = existe * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.88, 1.0, t));
    int q = int(h3 * 4.0);
    cor = q == 0 ? vec3(0.70, 0.45, 0.24) : q == 1 ? vec3(0.78, 0.59, 0.29) : q == 2 ? vec3(0.55, 0.40, 0.22) : vec3(0.60, 0.56, 0.31);
    forma = 4;
  } else if (tipo == 4) {
    float queda = 0.9;
    vec2 caida = vec2(uVento.x * 200.0, max(35.0, 85.0 + uVento.y * 60.0));
    float bal = sin(uTempo * mix(0.7, 1.4, h5) + h1 * 6.2832) * mix(4.0, 11.0, h2);
    float u = min(fase / queda, 1.0);
    desl = -caida * (1.0 - u) + vec2(bal * (1.0 - u), 0.0);
    ang = h4 * 6.2832 + uTempo * mix(-2.0, 2.0, h3) * (1.0 - u);
    float tam = mix(0.8, 1.8, h4);
    meio = vec2(tam * 1.4 + 1.5 + uPx, tam + 1.5 + uPx);
    par = vec4(tam * 1.4, tam * mix(0.45, 0.8, h5), 0.0, 0.0);
    float s = fase < queda ? 0.0 : (fase - queda) / (1.0 - queda);
    alfa = existe * smoothstep(0.0, 0.08, u) * (1.0 - s) * mix(0.55, 0.85, h2);
    float g = mix(0.52, 0.8, h3);
    cor = h5 > 0.94 ? vec3(0.7, 0.52, 0.42) : vec3(g, g * 0.97, g * 0.93);
    forma = 5;
  } else {
    // Fumaça: um novelo escuro que sobe devagar, cresce e vai com o vento.
    float t = fase;
    float sobe = mix(50.0, 110.0, h4);
    desl = vec2(uVento.x * 160.0 * t + sin(t * 3.0 + h1 * 6.2832) * 6.0, -sobe * t + uVento.y * 90.0 * t);
    float r = mix(6.0, 10.0, h5) * (1.0 + 1.6 * t);
    meio = vec2(r * 1.3 + uPx);
    alfa = existe * smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(0.55, 1.0, t)) * mix(0.25, 0.45, I);
    float g = mix(0.16, 0.26, h2);
    cor = vec3(g, g * 0.97, g * 0.95);
    par = vec4(r, 0.0, 0.0, 0.0);
    forma = 6;
  }
  vec2 local = aPosition * meio;
  vec2 mundo = L + E * (desl + girar(local, ang));
  vLocal = local;
  vMundo = mundo;
  vParam = par;
  vCor = cor;
  vAlfa = alfa;
  vForma = forma;
  if (alfa <= 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(mundo, 1.0)).xy, 0.0, 1.0);
}
`

const PIXEL = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vMundo;
in vec4 vParam;
in vec3 vCor;
in float vAlfa;
in float vDoPincel;
flat in int vForma;
uniform vec2 uMundo;
uniform vec4 uGrade;
uniform float uNoite;
uniform vec4 uCaixaDoPincel;
uniform sampler2D uPincel;
uniform sampler2D uSeco;
uniform sampler2D uAr;
out vec4 finalColor;
void main() {
  vec2 m = vMundo / uMundo;
  float fora = (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) ? 1.0 : 0.0;
  vec2 mc = clamp(m, 0.0, 1.0);
  // Brasas e fumaça usam o abrigo do ar (entram pela porta aberta); o resto, o seco.
  float abrigo = (vForma == 3 || vForma == 6) ? texture(uAr, mc).a : texture(uSeco, mc).a;
  float a = vAlfa * (1.0 - abrigo) * (1.0 - fora);
  if (vDoPincel > 0.5) a *= smoothstep(0.02, 0.3, texture(uPincel, (vMundo - uCaixaDoPincel.xy) * uCaixaDoPincel.zw).a);
  float aa = uGrade.w;
  vec3 prem;
  float al;
  if (vForma == 0) {
    float hl = vParam.x, hw = vParam.y;
    float y = abs(vLocal.y), x = vLocal.x;
    float nucleo = 1.0 - smoothstep(hw - aa * 0.5, hw + aa, y);
    float borda = max((1.0 - smoothstep(hw + 0.8, hw + 1.8 + aa, y)) - nucleo, 0.0);
    float aoLongo = smoothstep(-hl, hl * 0.5, x) * (1.0 - smoothstep(hl - aa, hl + aa, x));
    float c1 = nucleo * 0.9, c2 = borda * 0.28 * (1.0 - uNoite);
    prem = (vec3(0.86, 0.91, 0.98) * c1 + vec3(0.28, 0.34, 0.44) * c2) * aoLongo;
    al = (c1 + c2) * aoLongo;
  } else if (vForma == 1) {
    float d = length(vLocal / vec2(1.0, 0.62));
    float r = vParam.x, th = vParam.y;
    float anel = 1.0 - smoothstep(th - aa * 0.5, th + aa, abs(d - r));
    float sombra = max((1.0 - smoothstep(th, th + 1.4 + aa, abs(d - r - 0.9))) * (1.0 - uNoite) * 0.3 - anel, 0.0);
    prem = vec3(0.88, 0.92, 0.98) * anel * 0.9 + vec3(0.28, 0.34, 0.44) * sombra;
    al = anel * 0.9 + sombra;
  } else if (vForma == 2) {
    float d = length(vLocal), r = vParam.x;
    float c = 1.0 - smoothstep(r - aa, r + aa, d);
    prem = mix(vec3(0.98, 0.99, 1.0), vec3(0.72, 0.78, 0.88), smoothstep(r * 0.25, r, d)) * c;
    al = c;
  } else if (vForma == 3) {
    float d = length(vLocal), r = vParam.x;
    float nucleo = 1.0 - smoothstep(r * 0.55, r + aa, d);
    float brilho = exp(-(d * d) / (r * r * vParam.y * 0.9));
    float g = mix(0.25, 0.85, uNoite);
    vec3 c = mix(vCor * vec3(1.0, 0.68, 0.46), vCor, uNoite);
    prem = c * (nucleo + brilho * g);
    // De dia a brasa é pintada por cima (contraste no chão claro); à noite ela soma luz, mas não ilumina nada.
    al = (nucleo + brilho * 0.3 * g) * (1.0 - mix(0.2, 0.95, uNoite));
  } else if (vForma == 4) {
    float hl = vParam.x, hw = vParam.y, x = vLocal.x, y = vLocal.y;
    float perfil = hw * pow(max(0.0, 1.0 - (x * x) / (hl * hl)), 0.75);
    float dentro = 1.0 - smoothstep(-aa, aa, abs(y) - perfil);
    float cabo = (1.0 - smoothstep(0.35, 0.35 + aa, abs(y))) * step(-hl - 2.2, x) * step(x, -hl + 0.5);
    float c = max(dentro, cabo);
    float nervura = 1.0 - smoothstep(0.25, 0.25 + aa, abs(y));
    float beira = smoothstep(-0.9, -0.1, abs(y) - perfil);
    vec3 base = vCor * (vParam.z < 0.0 ? 0.84 : 1.0) * (y > 0.0 ? 1.06 : 0.94);
    vec3 escuro = vCor * 0.6;
    vec3 cor = mix(base, escuro, max(nervura * 0.7 * dentro, beira * 0.8));
    cor = mix(cor, escuro, cabo * (1.0 - dentro));
    prem = cor * c;
    al = c;
  } else if (vForma == 5) {
    // Floco de cinza: um losango torto de beira macia.
    vec2 q = abs(vLocal) / vParam.xy;
    float d = (q.x + q.y * 1.15 - 1.0) * min(vParam.x, vParam.y);
    float c = 1.0 - smoothstep(-aa * 1.5, aa * 1.5, d);
    prem = vCor * c;
    al = c;
  } else {
    float d = length(vLocal) / max(vParam.x, 0.001);
    float c = pow(max(0.0, 1.0 - d), 1.6);
    prem = vCor * c;
    al = c;
  }
  // À noite: chuva e neve pegam a pouca luz; folha escurece mais; cinza e fumaça ficam no meio.
  if (vForma != 3) prem *= vForma <= 2 ? mix(1.0, 0.72, uNoite) : vForma == 5 || vForma == 6 ? mix(1.0, 0.78, uNoite) : mix(1.0, 0.5, uNoite);
  finalColor = vec4(prem, al) * a;
}
`

/** O VÉU DO RELÂMPAGO: um retângulo claro sobre a vista. Não tem forma: não revela nada do escuro. */
const VERTICE_DO_VEU = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uCaixa;
void main() {
  vec2 p = uCaixa.xy + aPosition * uCaixa.zw;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
}
`

const PIXEL_DO_VEU = `#version 300 es
precision highp float;
uniform vec4 uCorDoVeu;
out vec4 finalColor;
void main() { finalColor = uCorDoVeu; }
`

/** O brilho do clarão `t` segundos depois de começar (dois pulsos e a cauda, como no protótipo). */
export function brilhoDoRelampago(t: number): number {
  if (t < 0 || t > AJUSTE_DO_AMBIENTE.relampago.duracaoS) return 0
  const pulso = (centro: number, largura: number) => Math.max(0, 1 - Math.abs(t - centro) / largura)
  return Math.max(pulso(0.05, 0.06), 0.7 * pulso(0.22, 0.07), t > 0.22 ? 0.35 * Math.max(0, 1 - (t - 0.22) / 0.48) : 0)
}

function sorteioDaJanela(janela: number): number {
  let x = Math.imul(janela ^ 0x5bd1e995, 0x9e3779b1) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 0x85ebca77) >>> 0
  x ^= x >>> 13
  return (x >>> 8) / 16777216
}

/** O instante (s do relógio) do clarão da janela em que `t` está, e a força dele. */
export function relampagoDaJanela(t: number, frequencia: Exclude<FrequenciaDoRelampago, 'nao'>): { inicio: number; forca: number } {
  const janela = AJUSTE_DO_AMBIENTE.relampago.janelaS[frequencia]
  const n = Math.floor(t / janela)
  return { inicio: n * janela + sorteioDaJanela(n) * (janela - 1), forca: 0.4 + 0.6 * sorteioDaJanela(n + 7919) }
}

const NUMERO_DO_TIPO: Record<TipoDeParticula, number> = { chuva: 0, neve: 1, brasas: 2, folhas: 3, cinzas: 4, fumaca: 5 }
/** De qual efeito do mapa cada tipo de partícula lê a chave e o pincel (folhas e cinzas são um efeito só). */
const EFEITO_DO_TIPO: Record<TipoDeParticula, EfeitoDoAmbiente> = { chuva: 'chuva', neve: 'neve', brasas: 'brasas', folhas: 'folhas', cinzas: 'folhas', fumaca: 'fumaca' }

let programa: GlProgram | null = null
function programaDoAmbiente(): GlProgram {
  programa ??= new GlProgram({ vertex: VERTICE, fragment: PIXEL, name: 'ambiente' })
  return programa
}

// ---------- compilar cedo, sem travar ----------

/**
 * Compila o shader do Ambiente EM SEGUNDO PLANO (`aquecerPrograma.ts`): no
 * protótipo, compilar na hora do primeiro desenho travou a tela 721 ms.
 * Chamado ao montar a cena. Aquece junto o do chão molhado, que aparece com a
 * chuva (`aquecerChaoMolhado`). `false` = a placa não compila: sem Ambiente
 * (com aviso), o resto do mapa segue igual.
 */
export function aquecerAmbiente(renderer: Renderer): Promise<boolean> {
  void aquecerChaoMolhado(renderer)
  return aquecerPrograma(renderer, programaDoAmbiente(), '[ambiente] o shader não compilou nesta placa; o Ambiente não aparece')
}

// ---------- as máscaras do abrigo ----------

function novaTela(largura: number, altura: number): HTMLCanvasElement {
  const tela = document.createElement('canvas')
  tela.width = Math.max(1, largura)
  tela.height = Math.max(1, altura)
  return tela
}

function preencherSalas(g: CanvasRenderingContext2D, secas: AbrigoDoAmbiente['secas']): void {
  g.fillStyle = '#fff'
  for (const sala of secas) {
    const [primeiro, ...resto] = sala
    if (primeiro === undefined) continue
    g.beginPath()
    g.moveTo(primeiro.x, primeiro.y)
    for (const p of resto) g.lineTo(p.x, p.y)
    g.closePath()
    g.fill()
  }
}

/** Pinta o seco e o ar do mapa nas duas telas (só quando o abrigo muda). */
function pintarAbrigo(abrigo: AbrigoDoAmbiente, largura: number, altura: number, grid: number): { seco: HTMLCanvasElement; ar: HTMLCanvasElement } {
  const escala = Math.min(AJUSTE_DO_AMBIENTE.texelsDoAbrigoPorCasa / Math.max(1, grid), AJUSTE_DO_AMBIENTE.ladoMaximoDoAbrigo / Math.max(1, largura, altura))
  const w = Math.ceil(largura * escala)
  const h = Math.ceil(altura * escala)
  const seco = novaTela(w, h)
  const ar = novaTela(w, h)
  const gs = seco.getContext('2d')
  const ga = ar.getContext('2d')
  if (gs === null || ga === null) return { seco, ar }
  gs.setTransform(escala, 0, 0, escala, 0, 0)
  ga.setTransform(escala, 0, 0, escala, 0, 0)
  preencherSalas(gs, abrigo.secas)
  preencherSalas(ga, abrigo.secas)
  // Porta aberta: brasas, fumaça e neblina entram, mais fortes perto dela, e param na parede (o ar só existe dentro da sala).
  const raio = AJUSTE_DO_AMBIENTE.portaEmCasas * grid
  ga.globalCompositeOperation = 'destination-out'
  for (const porta of abrigo.portas) {
    const degrade = ga.createRadialGradient(porta.x, porta.y, 0, porta.x, porta.y, raio)
    for (const [parada, forca] of AJUSTE_DO_AMBIENTE.portaParadas) degrade.addColorStop(parada, `rgba(0,0,0,${forca})`)
    ga.fillStyle = degrade
    ga.fillRect(porta.x - raio, porta.y - raio, raio * 2, raio * 2)
  }
  ga.globalCompositeOperation = 'source-over'
  return { seco, ar }
}

// ---------- o renderer ----------

export interface EntradaDoAmbiente {
  /** Tamanho do mapa em px de mundo e o lado da casa. */
  largura: number
  altura: number
  grid: number
  /** A chave do mapa inteiro de cada efeito, 0 a 1 (brasas e fumaça já em 0 quando nascem dos fogos). */
  inteira: Readonly<Record<EfeitoDoAmbiente, number>>
  /** As pinceladas do piso à vista (no jogador, já cortadas no recorte). */
  pintada: readonly PinceladaDeAmbiente[] | undefined
  folhas: TipoDeFolhas
  /** O vento, em px de tela por unidade (comprimento 0 a 1, `vetorDoVento`). */
  vento: readonly [number, number]
  /** `false` = partículas paradas ("Efeitos do mapa" desligado no jogador). */
  animar: boolean
  relampago: FrequenciaDoRelampago
  /** O mestre deixou o som da chuva ligado (cada um ainda tem o volume e o mudo dele). */
  somDaChuva: boolean
  /** "Chão molha e junta neve" (`chaoMolhaLigado`): o chão e o telhado molham e juntam neve (`pixi/chaoMolhado.ts`). */
  chaoMolha: boolean
}

/** De onde saem as poças (`passosDasPocas`): as Texturas e o terreno que ESTA tela desenha. */
export interface EntradaDasPocas {
  mapa: Pick<MapData, 'width' | 'height' | 'grid' | 'regions'>
  texturas: MapData['texturas']
  /** A MESMA lista que o terreno desenha (o contorno guardado é por lista: outra lista recontaria). */
  floor: FloorPiece[]
}

export interface MovimentoDoAmbiente {
  ticker: Pick<Ticker, 'add' | 'remove'>
  reducedMotion: () => boolean
  /** Relógio de PAREDE em ms (padrão `Date.now()`): a chuva cai igual no mestre e no jogador. */
  agora?: () => number
  /** Pede um quadro (`desenhoSobPedido`): o chão secando sozinho, sem nada mais animando. Sem isto, o pulso da tela faz o mesmo, mais devagar. */
  pedir?: () => void
}

/** Quem recebe o clima dos telhados (`pixi/telhadosRenderer.ts`). */
export interface TelhadosDoClima {
  setClima: (clima: ClimaDosTelhados | null) => void
}

export interface EstadoDoAmbiente {
  ligado: boolean
  movendo: boolean
  /** Quantas partículas cada efeito desenhou no último quadro (`chuva:2600 neve:0 ...`), para a medida. */
  instancias: string
}

export interface AmbienteRenderer {
  readonly camada: Container
  /**
   * O CHÃO MOLHADO E A NEVE ACUMULADA (`pixi/chaoMolhado.ts`): quem monta a tela
   * põe esta camada logo acima do terreno do chão (no jogador, com a máscara do conhecido).
   */
  readonly chao: Container
  /** `null` = sem Ambiente (as partículas somem de leve e o relógio sai; o chão seca devagar). */
  atualizar: (entrada: EntradaDoAmbiente | null) => void
  /** De onde saem as poças; refeitas sem pressa (`esperaDasPocasMs`) e só com chuva. */
  setPocas: (entrada: EntradaDasPocas | null) => void
  /** Os telhados que molham e juntam neve com o chão; `null` = nenhum. */
  ligarTelhados: (telhados: TelhadosDoClima | null) => void
  /** As salas secas e as portas (refaz as máscaras só quando mudam). */
  setAbrigo: (abrigo: AbrigoDoAmbiente, largura: number, altura: number, grid: number) => void
  /** A máscara do ar, para a neblina entrar só pela porta; `null` = nenhuma sala seca. */
  ar: () => TextureSource | null
  setPeriodo: (periodo: Periodo | null) => void
  destruir: () => void
}

interface MalhaDoTipo {
  tipo: TipoDeParticula
  mesh: Mesh<Geometry, Shader>
  geometria: Geometry
  ajustes: UniformGroup
  mascara: CanvasSource
  pintadaDesenhada: readonly PinceladaDeAmbiente[] | null
  caixa: CaixaDaMascara | null
  /** O quanto o mapa inteiro e o pincel já apareceram (0 a 1), indo para o alvo. */
  inteira: number
  pincel: number
  alvoInteira: number
  alvoPincel: number
}

function aproximar(atual: number, alvo: number, dt: number): number {
  if (Math.abs(atual - alvo) < 1e-3) return alvo
  const tau = alvo > atual ? AJUSTE_DO_AMBIENTE.aparecerS : AJUSTE_DO_AMBIENTE.sumirS
  return alvo + (atual - alvo) * Math.exp(-dt / tau)
}

export function createAmbienteRenderer(
  renderer: Renderer,
  movimento: MovimentoDoAmbiente,
  opcoes: { aoMudar?: (estado: EstadoDoAmbiente) => void; som?: SomDaChuva } = {},
): AmbienteRenderer {
  const agora = movimento.agora ?? Date.now
  const camada = new Container()
  camada.label = 'ambiente'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  camada.visible = false
  camada.enableRenderGroup()

  const malhas = new Map<TipoDeParticula, MalhaDoTipo>()
  const comum = new UniformGroup({
    uMundo: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uLadrilho: { value: new Float32Array(4), type: 'vec4<f32>' },
    uGrade: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
    uTempo: { value: 0, type: 'f32' },
    uVento: { value: new Float32Array(2), type: 'vec2<f32>' },
    uNoite: { value: 0, type: 'f32' },
  })
  let seco: CanvasSource = telaVazia()
  let ar: CanvasSource = telaVazia()
  let temAbrigo = false
  let chaveDoAbrigoAtual = ''
  let entrada: EntradaDoAmbiente | null = null
  let pronto = false
  let compilando = false
  let destruido = false
  let noRelogio = false
  let movendo = false
  let tempoParado = 0
  let ultimoPasso = 0
  let periodo: Periodo = 'dia'
  let avisado = ''
  /** O VÉU DO RELÂMPAGO, criado no primeiro clarão; o último filho da camada. */
  let veu: { mesh: Mesh<Geometry, Shader>; caixa: Float32Array; cor: Float32Array } | null = null
  let ultimoClarao = -1
  /** A vista em px de mundo no último desenho: o véu cobre só ela. */
  const vista = { x: 0, y: 0, largura: 1, altura: 1 }

  // ---------- o chão molhado, a neve acumulada e o telhado ----------
  const chao = criarChaoMolhado()
  // O chão molhado só se mostra com o shader dele pronto (compilado em segundo plano, sem travar o ligar da chuva).
  void aquecerChaoMolhado(renderer).then((ok) => {
    if (destruido || !ok) return
    chao.shaderPronto()
    movimento.pedir?.()
  })
  let niveisDoChao: NiveisDoChao = CHAO_SECO
  let alvoDoChaoAtual: NiveisDoChao = CHAO_SECO
  /**
   * A PRIMEIRA entrada chega pronta: quem abre a tela num mapa com chuva já vê o
   * chão molhado. Depois, ligar a chuva molha devagar.
   */
  let chaoComecou = false
  let pularChao = false
  let ultimoChaoMs = 0
  let timerDoChao: ReturnType<typeof setTimeout> | null = null
  let telhados: TelhadosDoClima | null = null
  let coberturaDosTelhados: ClimaDosTelhados['cobertura'] | null = null
  let climaAvisado: { cobertura: ClimaDosTelhados['cobertura'] | null; molhado: number; neve: number } | null = null
  let pocasPedidas: EntradaDasPocas | null = null
  let pocasFeitas: EntradaDasPocas | null | undefined
  let timerDasPocas: ReturnType<typeof setTimeout> | null = null

  const chaoNoAlvo = (): boolean => niveisDoChao.molhado === alvoDoChaoAtual.molhado && niveisDoChao.neve === alvoDoChaoAtual.neve
  /** O chão anda devagar; com "menos movimento" ou os efeitos parados, vai direto ao alvo (o protótipo deixa o molhado à vista). */
  const chaoAnda = (): boolean => !movimento.reducedMotion() && (entrada?.animar ?? true)

  /** O clima dos telhados: só manda quando o nível andou um passo ou o que cai mudou (cada mudança custa uma volta nos telhados). */
  function avisarTelhados(): void {
    if (telhados === null) return
    const seco = niveisDoChao.molhado === 0 && niveisDoChao.neve === 0
    const cobertura = seco ? null : coberturaDosTelhados
    const passo = AJUSTE_DO_CHAO_MOLHADO.passoDoNivel
    const antes = climaAvisado
    if (
      antes !== null &&
      antes.cobertura === cobertura &&
      (cobertura === null ||
        (Math.abs(antes.molhado - niveisDoChao.molhado) < passo && Math.abs(antes.neve - niveisDoChao.neve) < passo && (niveisDoChao.molhado !== 0) === (antes.molhado !== 0) && (niveisDoChao.neve !== 0) === (antes.neve !== 0)))
    ) {
      return
    }
    climaAvisado = { cobertura, molhado: niveisDoChao.molhado, neve: niveisDoChao.neve }
    telhados.setClima(cobertura === null ? null : { cobertura, niveis: niveisDoChao })
  }

  /** Anda o nível do chão pelo relógio de parede (do relógio do desenho com chuva caindo, do temporizador secando). */
  function andarChao(): void {
    const t = performance.now()
    const dt = ultimoChaoMs === 0 ? 0 : Math.min(5, (t - ultimoChaoMs) / 1000)
    ultimoChaoMs = t
    const antes = niveisDoChao
    niveisDoChao = chaoAnda() ? niveisDepois(niveisDoChao, alvoDoChaoAtual, dt) : alvoDoChaoAtual
    if (niveisDoChao.molhado !== antes.molhado || niveisDoChao.neve !== antes.neve) chao.niveis(niveisDoChao)
    avisarTelhados()
    if (chaoNoAlvo()) ultimoChaoMs = 0
  }

  /**
   * Sem chuva caindo (o relógio do desenho já saiu), o chão secando pede um
   * quadro a cada `quadroSecandoMs`: a tela não redesenha todo quadro por ele.
   */
  function agendarChao(): void {
    if (timerDoChao !== null || destruido || noRelogio || chaoNoAlvo()) return
    timerDoChao = setTimeout(() => {
      timerDoChao = null
      if (destruido || noRelogio) return
      andarChao()
      movimento.pedir?.()
      agendarChao()
    }, AJUSTE_DO_CHAO_MOLHADO.quadroSecandoMs)
  }

  function pincelDoChao(tipo: 'chuva' | 'neve'): PincelDoChao | null {
    const m = malhas.get(tipo)
    if (m === undefined || m.caixa === null || m.alvoPincel <= 0) return null
    const caixa = m.ajustes.uniforms.uCaixaDoPincel as Float32Array // UniformGroup sem genérico tipa uniforms como any; o valor é o Float32Array(4) do criarMalha
    return { fonte: m.mascara, caixa, aparecido: 1 }
  }

  /** O que o chão desenhou por último: secando (sem chuva), ele continua com a chuva de antes enquanto o nível desce. */
  let ultimaDoChao: EntradaDoChaoMolhado | null = null

  /** O pincel de antes, se a máscara dele ainda é a da malha (a borracha que tirou tudo destrói a máscara: aí some na hora). */
  function pincelQueFica(tipo: 'chuva' | 'neve', anterior: PincelDoChao | null): PincelDoChao | null {
    return anterior !== null && malhas.get(tipo)?.mascara === anterior.fonte ? anterior : null
  }

  /** O que o chão recebe desta entrada e para onde o nível vai. Chamado depois de cada `aplicar` e quando o abrigo muda. */
  function aplicarChao(): void {
    const e = entrada
    const inteira = e === null ? { chuva: 0, neve: 0 } : { chuva: Math.min(1, Math.max(0, e.inteira.chuva)), neve: Math.min(1, Math.max(0, e.inteira.neve)) }
    const pintada = e?.pintada ?? []
    const chuvaPintada = pintada.some((p) => p.efeito === 'chuva' && p.tipo === 'pincel')
    const nevePintada = pintada.some((p) => p.efeito === 'neve' && p.tipo === 'pincel')
    const molha = e?.chaoMolha ?? false
    const novoAlvo = alvoDoChao(molha, { inteira: inteira.chuva, pintada: chuvaPintada }, { inteira: inteira.neve, pintada: nevePintada })
    // Chovendo, o chão desenha a chuva de agora; parou, fica com a de antes e só o nível desce (seca devagar).
    const antes = ultimaDoChao
    const chovendo = novoAlvo.molhado > 0 || antes === null
    const nevando = novoAlvo.neve > 0 || antes === null
    const doChao: EntradaDoChaoMolhado | null =
      e === null && antes === null
        ? null
        : {
            largura: e?.largura ?? antes?.largura ?? 1,
            altura: e?.altura ?? antes?.altura ?? 1,
            grid: e?.grid ?? antes?.grid ?? 1,
            inteira: { chuva: chovendo ? inteira.chuva : antes.inteira.chuva, neve: nevando ? inteira.neve : antes.inteira.neve },
            chuva: chovendo ? pincelDoChao('chuva') : pincelQueFica('chuva', antes.chuva),
            neve: nevando ? pincelDoChao('neve') : pincelQueFica('neve', antes.neve),
            seco,
          }
    ultimaDoChao = doChao
    if (doChao !== null) chao.definir(doChao)
    // O que cai em cada telhado só muda com a chave e o pincel: a mesma função = o telhado não reconta.
    // Parou de chover: o telhado seca devagar com o que caía antes, como o chão.
    if (novoAlvo.molhado > 0 || novoAlvo.neve > 0) {
      coberturaDosTelhados = (pontos) => climaNoPonto(inteira, pintada, meioDoPoligono(pontos))
    } else if (niveisDoChao.molhado === 0 && niveisDoChao.neve === 0) {
      coberturaDosTelhados = null
    }
    alvoDoChaoAtual = novoAlvo
    if (pularChao) {
      pularChao = false
      niveisDoChao = novoAlvo
      chao.niveis(niveisDoChao)
    }
    andarChao()
    movimento.pedir?.()
    agendarChao()
    pedirPocas()
  }

  /** As poças só se fazem com chuva (e depois de o chão parar de mudar): sem chuva, a conta fica para quando chover. */
  function pedirPocas(): void {
    if (pocasPedidas === pocasFeitas || (alvoDoChaoAtual.molhado === 0 && niveisDoChao.molhado === 0)) return
    if (timerDasPocas !== null) clearTimeout(timerDasPocas)
    timerDasPocas = setTimeout(() => {
      timerDasPocas = null
      if (destruido) return
      const pedidas = pocasPedidas
      pocasFeitas = pedidas
      if (pedidas === null) {
        chao.pocas(null, 1, 1, 1)
        return
      }
      const { mapa } = pedidas
      const largura = mapa.width * mapa.grid
      const altura = mapa.height * mapa.grid
      const passos = passosDasPocas(mapa, pedidas.texturas, pedidas.floor, () => {
        // O terreno voltou do worker: as poças saem de novo, agora com ele (se ainda são estas as pedidas).
        if (destruido || pocasPedidas !== pedidas) return
        pocasFeitas = undefined
        pedirPocas()
      })
      // O terreno ainda está sendo contado (`lib/terrenoNoWorker.ts`): as poças de agora ficam até ele chegar.
      if (passos === null) return
      chao.pocas(passos, largura, altura, mapa.grid)
      movimento.pedir?.()
    }, AJUSTE_DO_CHAO_MOLHADO.esperaDasPocasMs)
  }

  function criarVeu(): { mesh: Mesh<Geometry, Shader>; caixa: Float32Array; cor: Float32Array } {
    // O grupo guarda os próprios arrays: mudar os valores no lugar é o que sobe para a GPU.
    const caixa = new Float32Array(4)
    const cor = new Float32Array(4)
    const ajustes = new UniformGroup({
      uCaixa: { value: caixa, type: 'vec4<f32>' },
      uCorDoVeu: { value: cor, type: 'vec4<f32>' },
    })
    const shader = new Shader({ glProgram: new GlProgram({ vertex: VERTICE_DO_VEU, fragment: PIXEL_DO_VEU, name: 'ambiente-veu' }), resources: { veu: ajustes } })
    const geometria = new Geometry({
      attributes: { aPosition: { buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), format: 'float32x2' } },
      indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
    })
    const mesh = new Mesh<Geometry, Shader>({ geometry: geometria, shader })
    mesh.eventMode = 'none'
    mesh.visible = false
    camada.addChild(mesh)
    return { mesh, caixa, cor }
  }

  /**
   * O clarão deste instante: só com a chuva do mapa inteiro a partir de 70% e
   * com movimento (o "menos movimento" e os efeitos desligados não piscam). É
   * um véu sem forma sobre a vista: não acende nada nem revela o escuro.
   */
  function relampago(e: EntradaDoAmbiente, t: number): void {
    const { chuvaMinima, forcaDia, forcaNoite } = AJUSTE_DO_AMBIENTE.relampago
    const frequencia = e.relampago
    if (frequencia === 'nao' || !movendo || e.inteira.chuva < chuvaMinima) {
      if (veu !== null) veu.mesh.visible = false
      return
    }
    const { inicio, forca } = relampagoDaJanela(t, frequencia)
    const brilho = brilhoDoRelampago(t - inicio) * forca
    if (brilho > 0 && inicio !== ultimoClarao) {
      ultimoClarao = inicio
      opcoes.som?.trovao(forca)
    }
    const v = veu ?? criarVeu()
    veu = v
    const noite = AJUSTE_DO_AMBIENTE.noite[periodo]
    const clarao = brilho * (forcaDia + (forcaNoite - forcaDia) * noite)
    v.mesh.visible = clarao > 0.002
    if (!v.mesh.visible) return
    v.caixa.set([vista.x, vista.y, vista.largura, vista.altura])
    v.cor.set([0.85 * clarao, 0.9 * clarao, clarao, clarao])
  }

  function avisar(): void {
    const contagem = TIPOS_DE_PARTICULA.map((tipo) => `${tipo}:${malhas.get(tipo)?.geometria.instanceCount ?? 0}`).join(' ')
    const estado: EstadoDoAmbiente = { ligado: camada.visible, movendo, instancias: contagem }
    const chave = `${estado.ligado}:${estado.movendo}:${contagem}`
    if (chave === avisado) return
    avisado = chave
    opcoes.aoMudar?.(estado)
  }

  function criarMalha(tipo: TipoDeParticula): MalhaDoTipo {
    const ajustes = new UniformGroup({
      uTipo: { value: NUMERO_DO_TIPO[tipo], type: 'f32' },
      uPorLadrilho: { value: 1, type: 'f32' },
      uInt: { value: new Float32Array(2), type: 'vec2<f32>' },
      uCaixaDoPincel: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
    })
    const mascara = telaVazia()
    const shader = new Shader({ glProgram: programaDoAmbiente(), resources: { comum, efeito: ajustes, uPincel: mascara, uSeco: seco, uAr: ar } })
    const geometria = new Geometry({
      attributes: { aPosition: { buffer: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), format: 'float32x2' } },
      indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
      instanceCount: 0,
    })
    const mesh = new Mesh<Geometry, Shader>({ geometry: geometria, shader })
    mesh.eventMode = 'none'
    mesh.visible = false
    camada.addChild(mesh)
    return { tipo, mesh, geometria, ajustes, mascara, pintadaDesenhada: null, caixa: null, inteira: 0, pincel: 0, alvoInteira: 0, alvoPincel: 0 }
  }

  function malha(tipo: TipoDeParticula): MalhaDoTipo {
    const existente = malhas.get(tipo)
    if (existente !== undefined) return existente
    const nova = criarMalha(tipo)
    malhas.set(tipo, nova)
    return nova
  }

  /** Repinta a máscara do pincel de um tipo só quando a lista mudou de referência. */
  function refazerPincel(m: MalhaDoTipo, lista: readonly PinceladaDeAmbiente[], grid: number): void {
    if (lista === m.pintadaDesenhada) return
    m.pintadaDesenhada = lista
    const caixa = lista.length === 0 ? null : caixaDaMascara(lista, grid)
    const tela = caixa === null ? null : pintarMascara(lista, caixa, grid)
    m.caixa = tela === null ? null : caixa
    const nova = tela === null ? telaVazia() : new CanvasSource({ resource: tela, scaleMode: 'linear', addressMode: 'clamp-to-edge' })
    const velha = m.mascara
    m.mascara = nova
    if (m.mesh.shader !== null) m.mesh.shader.resources.uPincel = nova
    velha.destroy()
    const v = m.ajustes.uniforms.uCaixaDoPincel as Float32Array // UniformGroup sem genérico tipa uniforms como any; o valor é o Float32Array(4) do criarMalha
    if (m.caixa === null) {
      v.set([0, 0, 1, 1])
      return
    }
    v[0] = m.caixa.x - BORDA_DA_MASCARA / m.caixa.escala
    v[1] = m.caixa.y - BORDA_DA_MASCARA / m.caixa.escala
    v[2] = m.caixa.escala / m.caixa.texelsX
    v[3] = m.caixa.escala / m.caixa.texelsY
  }

  /** Os ladrilhos à vista e quantas partículas cabem em cada um, para cada malha. */
  function ladrilhosAVista(e: EntradaDoAmbiente): void {
    const [casasX, casasY] = AJUSTE_DO_AMBIENTE.ladrilhoEmCasas
    const lw = casasX * e.grid
    const lh = casasY * e.grid
    // A vista em px de mundo; sem câmera ainda (antes do primeiro desenho), o mapa todo.
    let x0 = 0
    let y0 = 0
    let x1 = e.largura
    let y1 = e.altura
    const tela = renderer.screen
    const a = camada.toLocal({ x: 0, y: 0 })
    const b = camada.toLocal({ x: tela.width, y: tela.height })
    vista.x = 0
    vista.y = 0
    vista.largura = e.largura
    vista.altura = e.altura
    if ([a.x, a.y, b.x, b.y].every(Number.isFinite) && b.x > a.x && b.y > a.y) {
      vista.x = a.x
      vista.y = a.y
      vista.largura = b.x - a.x
      vista.altura = b.y - a.y
      // Uma margem para o que cai de fora para dentro (a chuva nasce acima, a folha voa de longe).
      const folga = 12 * e.grid
      x0 = Math.max(0, a.x - folga)
      y0 = Math.max(0, a.y - folga)
      x1 = Math.min(e.largura, b.x + folga)
      y1 = Math.min(e.altura, b.y + folga)
    }
    const tx0 = Math.floor(x0 / lw)
    const ty0 = Math.floor(y0 / lh)
    const nx = Math.max(1, Math.ceil(x1 / lw) - tx0)
    const ny = Math.max(1, Math.ceil(y1 / lh) - ty0)
    const ladrilho = comum.uniforms.uLadrilho
    ladrilho.set([lw, lh, tx0, ty0])
    const grade = comum.uniforms.uGrade
    grade[0] = nx
    grade[2] = e.grid / AJUSTE_DO_AMBIENTE.casaDoPrototipo
    // 1 px de tela na régua do protótipo (o serrilhado das bordas).
    const zoom = Math.abs(camada.worldTransform.a) || 1
    grade[3] = 1 / (zoom * grade[2] * (renderer.resolution || 1))
    for (const m of malhas.values()) {
      const cheio = AJUSTE_DO_AMBIENTE.porLadrilho[m.tipo]
      const porLadrilho = Math.max(1, Math.min(cheio, Math.floor(AJUSTE_DO_AMBIENTE.tetoNaTela / (nx * ny))))
      const ativo = m.mesh.visible
      m.geometria.instanceCount = ativo ? porLadrilho * nx * ny : 0
      // O número de partículas por ladrilho é por malha: mora no grupo do efeito, junto com o quanto já apareceu.
      m.ajustes.uniforms.uPorLadrilho = porLadrilho
      const intensidade = m.ajustes.uniforms.uInt as Float32Array // UniformGroup sem genérico tipa uniforms como any; o valor é o Float32Array(2) do criarMalha
      intensidade[0] = m.inteira
      intensidade[1] = m.pincel
    }
  }

  function tempoAgora(): number {
    const volta = AJUSTE_DO_AMBIENTE.voltaDoRelogioS
    return movendo ? (agora() / 1000) % volta : tempoParado
  }

  /** Antes de cada desenho (o Pixi chama): tempo, vento, ladrilhos. Não roda quando a tela não desenha. */
  function antesDoDesenho(): void {
    const e = entrada
    if (e === null) return
    const t = tempoAgora()
    comum.uniforms.uTempo = t
    const [vx, vy] = e.vento
    const forca = Math.hypot(vx, vy)
    const rajada = forca > 0.3 ? 1 + AJUSTE_DO_AMBIENTE.rajada * Math.sin(t * 0.7) * Math.sin(t * 0.31 + 1) : 1
    const vento = comum.uniforms.uVento
    vento[0] = vx * rajada
    vento[1] = vy * rajada
    ladrilhosAVista(e)
    relampago(e, t)
    avisar()
  }

  function passo(): void {
    const t = performance.now()
    const dt = ultimoPasso === 0 ? 0 : Math.min(0.1, (t - ultimoPasso) / 1000)
    ultimoPasso = t
    let animando = false
    for (const m of malhas.values()) {
      m.inteira = aproximar(m.inteira, m.alvoInteira, dt)
      m.pincel = aproximar(m.pincel, m.alvoPincel, dt)
      if (m.inteira !== m.alvoInteira || m.pincel !== m.alvoPincel) animando = true
      const some = m.alvoInteira === 0 && m.alvoPincel === 0
      if (some && m.inteira === 0 && m.pincel === 0 && m.mesh.visible) m.mesh.visible = false
    }
    if (![...malhas.values()].some((m) => m.mesh.visible)) camada.visible = false
    if (movendo && movimento.reducedMotion()) {
      tempoParado = tempoAgora()
      movendo = false
    }
    // O chão anda junto com a chuva caindo (o quadro já desenha); não segura o relógio sozinho.
    andarChao()
    if (!movendo && !animando) sairDoRelogio()
  }

  function entrarNoRelogio(): void {
    if (noRelogio) return
    noRelogio = true
    ultimoPasso = 0
    movimento.ticker.add(passo)
  }

  function sairDoRelogio(): void {
    if (!noRelogio) return
    noRelogio = false
    movimento.ticker.remove(passo)
    // O chão que ainda seca (ou junta neve parada) segue no temporizador, sem desenhar todo quadro.
    agendarChao()
  }

  function aplicar(): void {
    const e = entrada
    if (e === null || !pronto) {
      for (const m of malhas.values()) {
        m.alvoInteira = 0
        m.alvoPincel = 0
      }
      movendo = false
      if (veu !== null) veu.mesh.visible = false
      opcoes.som?.atualizar(0, false)
      if (malhas.size > 0) entrarNoRelogio()
      avisar()
      // O chão não espera o shader das partículas: a chuva do mapa inteiro já molha.
      aplicarChao()
      return
    }
    comum.uniforms.uMundo.set([Math.max(1, e.largura), Math.max(1, e.altura)])
    comum.uniforms.uNoite = AJUSTE_DO_AMBIENTE.noite[periodo]
    let algum = false
    for (const tipo of TIPOS_DE_PARTICULA) {
      const efeito = EFEITO_DO_TIPO[tipo]
      const queFolha = tipo === 'folhas' || tipo === 'cinzas'
      const vale = !queFolha || e.folhas === 'duas' || e.folhas === tipo
      const lista = vale ? (e.pintada ?? []).filter((p) => p.efeito === efeito) : []
      const inteira = vale ? Math.min(1, Math.max(0, e.inteira[efeito])) : 0
      const temPincel = lista.some((p) => p.tipo === 'pincel')
      const existente = malhas.get(tipo)
      if (inteira <= 0 && !temPincel && existente === undefined) continue
      const m = malha(tipo)
      refazerPincel(m, lista, e.grid)
      m.alvoInteira = inteira
      m.alvoPincel = temPincel && m.caixa !== null ? 1 : 0
      if (m.alvoInteira > 0 || m.alvoPincel > 0) {
        m.mesh.visible = true
        algum = true
      }
    }
    if (algum) camada.visible = true
    const andar = e.animar && !movimento.reducedMotion()
    if (!andar && movendo) tempoParado = tempoAgora()
    movendo = andar && algum
    if (!movendo && veu !== null) veu.mesh.visible = false
    // O som segue a chuva que está na cena: a do mapa inteiro, ou uma garoa de quem pintou chuva numa área.
    const chuvaPintada = (e.pintada ?? []).some((p) => p.efeito === 'chuva' && p.tipo === 'pincel')
    const chuva = Math.max(Math.min(1, Math.max(0, e.inteira.chuva)), chuvaPintada ? AJUSTE_DO_AMBIENTE.chuvaDoPincelNoSom : 0)
    opcoes.som?.atualizar(chuva, e.somDaChuva && e.animar)
    entrarNoRelogio()
    avisar()
    aplicarChao()
  }

  camada.onRender = antesDoDesenho

  return {
    camada,
    atualizar(nova) {
      entrada = nova !== null && nova.largura > 0 && nova.altura > 0 ? nova : null
      if (!chaoComecou) {
        chaoComecou = true
        pularChao = true
      }
      if (entrada !== null && !pronto && !compilando) {
        compilando = true
        void aquecerAmbiente(renderer).then((ok) => {
          compilando = false
          if (destruido) return
          pronto = ok
          if (ok) aplicar()
        })
      }
      aplicar()
    },
    setAbrigo(abrigo, largura, altura, grid) {
      const chave = `${largura}x${altura}@${grid}:${chaveDoAbrigo(abrigo)}`
      if (chave === chaveDoAbrigoAtual) return
      chaveDoAbrigoAtual = chave
      const velhos = [seco, ar]
      temAbrigo = abrigo.secas.length > 0
      if (temAbrigo) {
        const telas = pintarAbrigo(abrigo, largura, altura, grid)
        seco = new CanvasSource({ resource: telas.seco, scaleMode: 'linear', addressMode: 'clamp-to-edge' })
        ar = new CanvasSource({ resource: telas.ar, scaleMode: 'linear', addressMode: 'clamp-to-edge' })
      } else {
        seco = telaVazia()
        ar = telaVazia()
      }
      for (const m of malhas.values()) {
        if (m.mesh.shader === null) continue
        m.mesh.shader.resources.uSeco = seco
        m.mesh.shader.resources.uAr = ar
      }
      // O chão também não molha dentro de casa: troca o seco dele no mesmo passo.
      if (ultimaDoChao !== null) {
        ultimaDoChao = { ...ultimaDoChao, seco }
        chao.definir(ultimaDoChao)
        movimento.pedir?.()
      }
      // A neblina lê o ar antes da troca chegar a ela: destrói depois do quadro.
      setTimeout(() => {
        for (const velho of velhos) velho.destroy()
      }, 0)
    },
    ar: () => (temAbrigo ? ar : null),
    setPeriodo(novo) {
      const proximo = novo ?? 'dia'
      if (proximo === periodo) return
      periodo = proximo
      comum.uniforms.uNoite = AJUSTE_DO_AMBIENTE.noite[periodo]
    },
    chao: chao.camada,
    setPocas(nova) {
      const atual = pocasPedidas
      // A mesma forma do chão (as mesmas listas): nada a refazer.
      const igual =
        nova !== null &&
        atual !== null &&
        nova.floor === atual.floor &&
        nova.texturas === atual.texturas &&
        nova.mapa.regions === atual.mapa.regions &&
        nova.mapa.width === atual.mapa.width &&
        nova.mapa.height === atual.mapa.height &&
        nova.mapa.grid === atual.mapa.grid
      if (igual || (nova === null && atual === null)) return
      pocasPedidas = nova
      pedirPocas()
    },
    ligarTelhados(novos) {
      if (novos === telhados) return
      telhados?.setClima(null)
      telhados = novos
      climaAvisado = null
      avisarTelhados()
    },
    destruir() {
      destruido = true
      sairDoRelogio()
      if (timerDoChao !== null) clearTimeout(timerDoChao)
      if (timerDasPocas !== null) clearTimeout(timerDasPocas)
      telhados?.setClima(null)
      telhados = null
      opcoes.som?.destruir()
      camada.onRender = null
      for (const m of malhas.values()) m.mascara.destroy()
      malhas.clear()
      camada.destroy({ children: true })
      chao.destruir()
      seco.destroy()
      ar.destroy()
    },
  }
}

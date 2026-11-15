import { BufferImageSource, Container, Geometry, GlProgram, Mesh, Shader, UniformGroup, type Renderer, type TextureSource, type Ticker } from 'pixi.js'
import type { Agua, Periodo } from '../types/map'
import type { Caixa } from '../lib/texturas'
import { CASA_U, FORA, buracoDoCampo, campoDoCorpo, comporCampo, porOBuraco, unirCaixas, uPorPx, type CaixaEmTexels, type CampoComposto, type CampoDoCorpo, type CorpoDoCampo, type FormaDoBuraco } from '../lib/agua/campo'
import { chaveDoCorpo, corpoDaAgua, formasDoBuraco, texelDasAguas } from '../lib/agua/corpos'
import type { EntornoDaAgua } from '../lib/agua/entorno'
import { aquecerPrograma, programaPronto } from './aquecerPrograma'

/**
 * ÁGUA no palco (pedido de 12/11/2026, protótipo aprovado
 * `docs/design/agua/prototipo-agua.html`): rios, lagos e mares num SHADER SÓ,
 * no molde da neblina (`drawNeblina.ts`): um retângulo com o campo das águas
 * (`lib/agua/campo.ts`, refeito só quando uma água muda), um ruído que se
 * repete, e por quadro só o tempo muda.
 *
 * Fica numa faixa própria ACIMA das Texturas e do terreno do Chão
 * (`lib/camadas/ordem.ts`): a grama pintada não cobre mais a água. A margem
 * (praia do mar, barro do rio e do lago, beira molhada) é pintada por cima do
 * chão que já está ali, em transparência.
 *
 * RITMO (decisão do mestre, a recomendada): a água NÃO entra no `relogio` do
 * desenho sob pedido (que desenha todo quadro, a 60). Ela escuta o ticker cru,
 * troca o tempo do shader todo tique e pede um desenho a cada `MS_POR_QUADRO`
 * (30 por segundo) com `pedir()`. Se outra coisa já desenha todo quadro (fogo,
 * chafariz), o tempo novo vai em todo desenho: a água anda a 60 de graça. Sem
 * água na tela, com "menos movimento" ou com os efeitos do mapa desligados, a
 * água fica parada e não pede quadro nenhum.
 *
 * A linha tracejada creme da beira do mar no protótipo é a marca de "Barra a
 * passagem" da visão do mestre (`desenharPorCima`), não espuma: não vem para
 * o app.
 *
 * LAVA (pedido de 15/11/2026): o mesmo programa (um aquecimento só), pelo
 * peso da lava em cada texel (`f3.a`): placas de crosta que racham com fio de
 * brasa, o fundido laranja com miolo amarelo, bolhas que estouram, e a beira
 * de rocha queimada. Sem luz própria: de noite ela segue à vista, mas não
 * acende o chão em volta.
 */

/** 30 quadros por segundo quando só a água mexe. */
export const MS_POR_QUADRO = 1000 / 30
/** Espera depois da última mudança antes de refazer o campo (a mão ainda mexendo). */
export const ESPERA_DO_CAMPO_MS = 120

const VERTICE = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
// x, y, largura, altura (px de mundo) do retângulo desenhado.
uniform vec4 uCaixa;
out vec2 vPos;
void main() {
  vec2 p = uCaixa.xy + aPosition * uCaixa.zw;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vPos = p;
}
`

// O FRAG do protótipo, com a saída em transparência (pré-multiplicada) por cima do chão.
const PIXEL = `#version 300 es
precision highp float;
in vec2 vPos;
uniform sampler2D uF1;
uniform sampler2D uF2;
uniform sampler2D uF3;
// O chão das salas e do Chão Liso por cima da água (vermelho = cobertura).
uniform sampler2D uF4;
uniform sampler2D uRuido;
// u por px de mundo, tempo (s), noite (0 ou 1), u por texel do campo.
uniform vec4 uAgua;
// origem do campo (texels), 1 / largura, 1 / altura (texels).
uniform vec4 uCampo;
out vec4 finalColor;
const float CASA = ${CASA_U.toFixed(1)};
const float FORA = ${FORA.toFixed(1)};
const float PI2 = 6.2831853;

vec4 R(vec2 c) { return texture(uRuido, c / 8.0); }
float graoDoPapel(vec2 w) { vec3 q = fract(vec3(floor(w / 2.0).xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return (fract((q.x + q.y) * q.z) - 0.5) * 22.0 * 0.55 / 255.0; }
float contraste(float v, float k) { return clamp((v - 0.5) * k + 0.5, 0.0, 1.0); }
float cintila(vec2 c, float t) {
  float a = R(c / 2.4 + vec2(t * 0.7, -t * 0.45)).b;
  float b = R(c / 3.1 - vec2(t * 0.4, t * 0.65) + 9.0).a;
  return smoothstep(0.455, 0.52, a * b);
}
// Uma camada por cima da que já está (cores pré-multiplicadas).
vec4 sobre(vec4 baixo, vec3 c, float a) { return vec4(c * a, a) + baixo * (1.0 - a); }

// ---------- LAVA (pedido de 15/11/2026): o mesmo programa, pelo peso da lava em cada texel ----------

// Sorteio sem seno (Dave Hoskins): o mesmo número em toda placa de vídeo.
vec2 sorteio(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

// As placas de crosta (Voronoi, F2 - F1): x = a distância (u) até a rachadura mais perto; y = a sorte da placa.
vec2 placas(vec2 q, float lado) {
  vec2 c = q / lado;
  vec2 g = floor(c), f = c - g;
  float d1 = 9.0, d2 = 9.0, sorte = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = sorteio(g + o);
      vec2 r = o + 0.12 + 0.76 * h - f;
      float dd = dot(r, r);
      if (dd < d1) { d2 = d1; d1 = dd; sorte = h.y; }
      else if (dd < d2) { d2 = dd; }
    }
  }
  return vec2((sqrt(d2) - sqrt(d1)) * 0.5 * lado, sorte);
}

// Uma bolha por célula de 1,4 casa, no máximo: incha devagar, estoura e some; na volta seguinte, outro lugar da
// célula (ou nenhum). x = a cúpula, y = a altura da cúpula (0 na pele, 1 no alto), z = o anel do estouro, w = o clarão.
vec4 bolha(vec2 q, float t, float quantas) {
  const float LADO = 56.0, INCHA = 1.5, ESTOURA = 0.45;
  vec2 g = floor(q / LADO);
  vec2 h = sorteio(g + 37.0);
  float periodo = mix(3.2, 7.5, h.x);
  float tt = t + h.y * periodo;
  float volta = floor(tt / periodo);
  float tau = tt - volta * periodo;
  vec2 k = sorteio(g + volta * vec2(7.31, 3.17));
  if (k.x >= quantas || tau > INCHA + ESTOURA) return vec4(0.0);
  vec2 m = sorteio(g * 1.7 + volta + 11.0);
  vec2 centro = (g + 0.35 + 0.3 * m) * LADO;
  float dist = length(q - centro);
  float raio = mix(4.5, 8.5, k.y);
  if (tau < INCHA) {
    float rb = raio * (0.3 + 0.7 * sqrt(tau / INCHA));
    float dentro = 1.0 - smoothstep(rb - 1.0, rb + 0.6, dist);
    // A cúpula: alta no meio, com o reflexo da luz do mapa no alto à esquerda.
    vec2 rel = (q - centro) / rb;
    float alto = sqrt(max(0.0, 1.0 - dot(rel, rel)));
    float realce = 1.0 - smoothstep(0.0, 0.5, length(rel + vec2(0.38, 0.38)));
    return vec4(dentro * smoothstep(0.0, 0.2, tau), clamp(alto * 0.75 + realce * 0.5, 0.0, 1.0), 0.0, 0.0);
  }
  float e = (tau - INCHA) / ESTOURA;
  // O anel abre rápido e assenta (ease-out): o estouro é a resposta, não um passeio.
  float anelR = mix(raio, raio * 1.85, 1.0 - (1.0 - e) * (1.0 - e));
  float anel = (1.0 - smoothstep(0.0, 1.8, abs(dist - anelR))) * (1.0 - e);
  float clarao = (1.0 - smoothstep(0.0, anelR, dist)) * (1.0 - e) * (1.0 - e);
  return vec4(0.0, 0.0, anel, clarao);
}

// A cor da lava num ponto. q: onde o ponto está NA LAVA (anda com ela, u); alongar: as placas compridas no rumo
// de q.x (o rio); lado: o tamanho das placas (u); calor: 0 (crosta fechada, só a rachadura fina) a 1 (mancha
// quente: ilhas de crosta no fundido); uPx: u por pixel da tela.
// Tudo por mistura normal: nada aditivo (vira neon), como o objeto Fogo.
vec3 corDaLava(vec2 q, float alongar, float lado, vec3 base, float calor, float t, float bolhas, float noite, float uPx) {
  // O laranja do fundido puxa para o amarelo no quente, de qualquer base (o magma não vira salmão).
  vec3 quente = mix(base, vec3(1.0, 0.72, 0.28), 0.6);
  vec3 branco = mix(quente, vec3(1.0, 0.86, 0.52), 0.45);
  vec3 escuro = base * vec3(0.55, 0.36, 0.3);
  vec2 qp = vec2(q.x / alongar, q.y);
  // O fundido: veios presos à lava, do vermelho escuro ao laranja; o brilho respira devagar, em manchas.
  float veio = contraste(R(qp / 30.0 + 3.7).r * 0.6 + R(qp / 11.0 + 1.3).g * 0.4, 1.9);
  float respira = 0.86 + 0.14 * sin(t * 0.9 + R(qp / 90.0).b * PI2);
  vec3 fundido = mix(escuro, base, smoothstep(0.15, 0.6, veio));
  fundido = mix(fundido, quente, smoothstep(0.55, 0.95, veio) * (0.35 + 0.65 * calor) * respira);
  // As placas, com a beira torta em duas escalas (tamanhos desiguais, nada de favo); a folga entre elas é a
  // rachadura fina na crosta fechada e abre nas manchas quentes.
  vec2 torto = (R(qp / 23.0).ab - 0.5) * 12.0 + (R(qp / 71.0 + 4.0).rg - 0.5) * 22.0;
  vec2 pl = placas(qp + torto, lado);
  float borda = pl.x, sorte = pl.y;
  float folga = mix(0.55, 6.5, pow(calor, 1.4)) * mix(0.75, 1.25, sorte);
  float aaq = max(uPx, 0.3);
  float naPlaca = smoothstep(folga - aaq, folga + aaq, borda);
  // De longe a rachadura fica menor que o pixel: vira a média, sem chuvisco.
  float longe = smoothstep(1.2, 3.5, uPx);
  naPlaca = mix(naPlaca, clamp(1.0 - folga / (lado * 0.3), 0.0, 1.0), longe);
  // A crosta: quase preta, marrom-avermelhada; a placa mais nova, na mancha quente, ainda guarda um vermelho apagado.
  vec3 crosta = mix(vec3(0.085, 0.06, 0.052), vec3(0.165, 0.1, 0.08), R(qp / 4.5).a);
  crosta = mix(crosta, base * 0.4, sorte * sorte * 0.5 * calor);
  crosta = mix(crosta, escuro * 0.85, (1.0 - smoothstep(folga, folga + 2.5, borda)) * 0.55);
  // Racha por dentro da placa: riscos finos que abrem (fio de brasa) e fecham devagar.
  float risca = 1.0 - smoothstep(0.0, 0.035, abs(R(qp / 13.0 + 7.7).r - 0.5));
  float abre = smoothstep(0.55, 0.85, R(qp / 70.0 + vec2(t * 0.03, -t * 0.02)).g);
  crosta = mix(crosta, mix(escuro, base, 0.6), risca * abre * 0.75 * (1.0 - longe));
  // A rachadura: o fio incandescente colado no meio dela; nas folgas largas, o fundido em volta.
  float fio = 1.0 - smoothstep(0.0, max(folga * 0.55, 1.0), borda);
  vec3 racha = mix(fundido, mix(quente, branco, fio), fio * 0.85 * respira);
  vec3 cor = mix(racha, crosta, naPlaca);
  // As bolhas (redondas: no espaço da lava, sem o alongar): a cúpula laranja que sobe, pele escura na volta;
  // o clarão e o anel de respingos ao estourar.
  vec4 b = bolha(q, t, bolhas);
  vec3 cupula = mix(escuro * 0.8, quente, smoothstep(0.1, 0.75, b.y));
  cupula = mix(cupula, branco, smoothstep(0.8, 1.0, b.y) * 0.8);
  cor = mix(cor, cupula, b.x);
  cor = mix(cor, branco, b.w * 0.8);
  cor = mix(cor, crosta * 0.8, b.z * 0.7);
  // De noite a lava continua à vista: o que é quente fica mais vivo, a crosta mais escura; ela não acende o chão.
  float quentura = max(1.0 - naPlaca, max(b.x, b.w));
  return cor * mix(1.0, mix(0.85, 1.2, quentura), noite);
}

void main() {
  vec2 w = vPos * uAgua.x;
  vec2 uv = (w / uAgua.w - uCampo.xy) * uCampo.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
  vec4 f1 = texture(uF1, uv);
  float d = f1.x;
  if (d <= -FORA) discard;
  float t = uAgua.y;
  float noite = uAgua.z;
  vec4 f2 = texture(uF2, uv), f3 = texture(uF3, uv);
  vec3 base = f2.rgb;
  float mar = f2.a, rio = f1.w, lago = clamp(1.0 - mar - rio, 0.0, 1.0);
  float vel = f3.r, ondas = f3.g, espuma = f3.b;
  // LAVA: o peso (1 = lava), misturado na foz como as ondas. Na lava, as "ondas" são as bolhas.
  float lava = f3.a;
  // u por pixel da tela, medido FORA dos ramos (derivada dentro de if de pixel é indefinida).
  float uPx = length(fwidth(w)) * 0.7071;
  vec3 raso = clamp(base * 1.17 + vec3(0.03, 0.04, 0.035), 0.0, 1.0);
  vec3 fundo = base * 0.64;
  vec3 corDaEspuma = mix(vec3(0.94, 0.95, 0.92), base, 0.08);
  vec4 nl = R(w / 220.0);
  vec4 nm = R(w / 46.0 + vec2(13.0, 7.0));

  // Beira irregular (rio e lago): a grama entra na água em tufos; a do mar é a praia.
  float tufo = R(vec2(w.x / 1.6, w.y / 5.5) / 4.0 + 3.1).a;
  float irregular = (nm.r - 0.5) * 9.0 + (R(w / 9.0).g - 0.5) * 3.0;
  float lambida = sin(t * 1.3 + nl.g * 12.0) * 1.4;
  float de = d + (irregular + lambida * lago) * (1.0 - mar) - smoothstep(0.62, 0.8, tufo) * 3.5 * (1.0 - mar);

  // Mar: a água sobe na areia e volta (sobe rápido, desce devagar), fora de fase ao longo da praia.
  float sobe = mix(7.0, 18.0, ondas);
  float fase = fract(t / 5.2 + nl.r * 2.3 + nl.b);
  float e = fase < 0.32 ? 1.0 - pow(1.0 - fase / 0.32, 2.0) : 1.0 - smoothstep(0.0, 1.0, (fase - 0.32) / 0.68);
  float frente = sobe * e - sobe * 0.25;
  float deMar = d + frente + (nm.g - 0.5) * 4.0;
  de = mix(de, deMar, mar);
  // LAVA: a beira não lambe nem sobe na areia; mexe quase nada (a lava esfria na margem).
  de = mix(de, d + irregular * 0.7 + sin(t * 0.21 + nl.g * 9.0) * 0.5, lava);

  // O chão da beira, por cima do chão que já está: praia de areia no mar, barro no rio e no lago.
  vec4 acc = vec4(0.0);
  // O pincel "Tirar areia" (verde do uF4): a areia some no trecho tirado, com a beira quebrada pelo ruído; a água e a espuma ficam.
  // Também é a beira que não é margem (borda do mapa, junto de sala): ali nem areia nem rocha.
  float semAreia = texture(uF4, uv).g;
  if (lava < 0.99) {
    vec3 areia = mix(vec3(214., 194., 134.) / 255., vec3(191., 167., 116.) / 255., contraste(R(w / 30.0).b, 1.6));
    float bordaDaPraia = -d + (nl.a - 0.5) * 26.0 + (nm.b - 0.5) * 12.0 + (R(w / 6.0).g - 0.5) * 7.0 - smoothstep(0.6, 0.8, tufo) * 6.0;
    float praia = mar * (1.0 - smoothstep(33.0, 37.0, bordaDaPraia)) * (1.0 - smoothstep(0.25, 0.75, semAreia + (nm.r - 0.5) * 0.4 * step(0.002, semAreia)));
    acc = sobre(acc, areia + graoDoPapel(w), praia);
    float molhadaDoMar = mar * smoothstep(-sobe * 0.85, -sobe * 0.85 + 6.0, d);
    acc = sobre(acc, vec3(0.0), molhadaDoMar * 0.2);
    float barro = (1.0 - mar) * (1.0 - smoothstep(0.0, 9.0 + nm.b * 8.0, -de));
    acc = sobre(acc, vec3(0.2, 0.15, 0.03), barro * 0.85 * 0.4);
    acc = sobre(acc, fundo * 0.85, (1.0 - mar) * (1.0 - smoothstep(0.0, 1.6, -de)) * 0.55);
  }
  // LAVA: a beira é rocha queimada (basalto) escura sobre uma fuligem rala, com um fio de brasa colado na lava.
  if (lava > 0.01) {
    vec4 accL = vec4(0.0);
    float temBeira = 1.0 - smoothstep(0.25, 0.75, semAreia);
    float largura = mix(11.0 + nm.b * 9.0, 22.0 + nm.b * 12.0, mar);
    float fora = -de + (R(w / 7.0).g - 0.5) * 6.0 + (nl.a - 0.5) * 8.0;
    accL = sobre(accL, vec3(0.17, 0.13, 0.11), (1.0 - smoothstep(largura, largura + 9.0, fora)) * 0.18 * temBeira);
    vec3 basalto = mix(vec3(0.115, 0.098, 0.092), vec3(0.235, 0.2, 0.185), contraste(R(w / 8.0).b * 0.65 + R(w / 2.6).a * 0.35, 1.9));
    accL = sobre(accL, basalto + graoDoPapel(w), (1.0 - smoothstep(largura * 0.82, largura, fora)) * 0.93 * temBeira);
    // O fio de brasa: fino, vermelho-alaranjado, mais vivo onde a pedra ainda está quente, mudando devagar (nunca pisca).
    float fio = 1.0 - smoothstep(0.1, 1.5 + nm.g * 1.2, -de);
    float vivo = 0.55 + 0.45 * smoothstep(0.3, 0.7, R(w / 16.0 + vec2(t * 0.02, -t * 0.015)).r);
    accL = sobre(accL, mix(base, vec3(0.8, 0.3, 0.12), 0.5) * mix(0.8, 1.0, vivo), fio * vivo * 0.85 * temBeira);
    acc = mix(acc, accL, lava);
  }

  // Profundidade em três tons macios.
  float meiaLargura = max(d + abs(f1.z), 4.0);
  float prof = mix(mix(d / (2.2 * CASA), d / (5.0 * CASA), mar), d / meiaLargura, rio);
  prof = clamp(prof, 0.0, 1.0);
  float degrau = mix(smoothstep(0.03, 0.22, prof) * 0.5 + smoothstep(0.38, 0.78, prof) * 0.5, smoothstep(0.0, 1.0, prof) * 0.85, rio);
  vec3 agua = mix(raso, base, smoothstep(0.0, 0.5, degrau));
  agua = mix(agua, fundo, smoothstep(0.5, 1.0, degrau));
  float luz = 0.0, risco = 0.0, brilho = 0.0;

  // RIO: correnteza no rumo do traço, mais rápida no meio (dois tempos que se trocam, sem esticar).
  // Onde é só lava, o movimento da água nem é feito (a lava tem o dela, abaixo).
  if (rio > 0.01 && lava < 0.99) {
    float s = f1.y, n = f1.z;
    float lado = clamp(abs(n) / meiaLargura, 0.0, 1.0);
    float rapidez = mix(6.0, 80.0, vel) * (0.3 + 0.7 * (1.0 - lado * lado));
    float ciclo = 2.6;
    float pa = fract(t / ciclo), pb = fract(pa + 0.5);
    float peso = abs(2.0 * pa - 1.0);
    float sa = s - rapidez * ciclo * pa, sb = s - rapidez * ciclo * pb + 41.0;
    float torce = (R(vec2(s / 160.0, 0.5)).g - 0.5) * 10.0;
    float ma = R(vec2(sa / 70.0, (n + torce) / 11.0)).r, mb = R(vec2(sb / 70.0, (n + torce) / 11.0) + 2.7).r;
    float fa = R(vec2(sa / 26.0, n / 4.5) + 5.1).g, fb = R(vec2(sb / 26.0, n / 4.5) + 1.9).g;
    float k = 1.0 / sqrt(peso * peso + (1.0 - peso) * (1.0 - peso));
    float meio = (mix(ma, mb, peso) - 0.5) * k + 0.5;
    float fino = (mix(fa, fb, peso) - 0.5) * k + 0.5;
    float linhas = smoothstep(0.6, 0.72, contraste(meio, 1.8)) * 0.55 + smoothstep(0.62, 0.74, contraste(fino, 1.8)) * 0.3;
    float rLuz = (contraste(meio, 1.6) - 0.5) * 0.10 + linhas * 0.10 * (0.4 + 0.6 * vel);
    float rRisco = smoothstep(0.7, 0.8, contraste(fino, 2.0)) * smoothstep(0.15, 0.6, 1.0 - lado) * 0.35 * (0.3 + vel);
    float rBrilho = mix(cintila(vec2(sa, n * 1.6), t), cintila(vec2(sb, n * 1.6) + 17.0, t), peso) * smoothstep(0.35, 0.65, nl.g);
    luz += rLuz * rio; risco += rRisco * rio; brilho += rBrilho * rio;
  }
  // LAGO: duas camadas lentas se cruzando.
  float tamanho = mix(0.6, 1.5, ondas);
  if (lago > 0.01 && lava < 0.99) {
    float l1 = R((w + vec2(7.0, 3.0) * t) / (70.0 * tamanho)).r, l2 = R((w + vec2(-4.0, 6.0) * t) / (48.0 * tamanho) + 4.4).g;
    float ond = (l1 + l2) * 0.5;
    float lLuz = (contraste(ond, 2.0) - 0.5) * 0.07 * (0.6 + 0.6 * ondas);
    float lRisco = smoothstep(0.66, 0.74, contraste(ond, 2.2)) * 0.18 * (0.5 + ondas);
    float lBrilho = cintila(w + vec2(2.0, 1.0) * t, t * 0.6) * smoothstep(0.4, 0.7, l1);
    luz += lLuz * lago; risco += lRisco * lago; brilho += lBrilho * lago;
  }
  // MAR: ondas largas que andam para a praia, quebradas pelo ruído (nunca listras), espuma na arrebentação.
  float rendaMar = 0.0;
  if (mar > 0.01 && lava < 0.99) {
    float dd = max(d, 0.0);
    float lambda = mix(48.0, 120.0, ondas);
    float torto = (nl.b - 0.5) * lambda * 1.3 + (nm.r - 0.5) * lambda * 0.25;
    float ph = (dd + torto) / lambda + t * 0.21;
    float onda = 0.5 + 0.5 * cos(PI2 * ph);
    float trecho = smoothstep(0.3, 0.7, R(w / 150.0 + vec2(t * 0.012, -t * 0.008)).a);
    float aoFundo = smoothstep(0.0, 4.0 * CASA, dd);
    float mLuz = (onda - 0.5) * 0.16 * trecho * (0.5 + 0.5 * ondas) * (1.0 - 0.4 * aoFundo);
    float crista = smoothstep(0.86, 0.97, onda) * trecho * (1.0 - aoFundo * 0.7);
    float m1 = R((w + vec2(9.0, 4.0) * t) / 90.0).r, m2 = R((w + vec2(-6.0, 7.0) * t) / 60.0 + 2.2).g;
    mLuz += (contraste((m1 + m2) * 0.5, 2.0) - 0.5) * 0.05 * aoFundo;
    float renda = contraste(R((w + vec2(t * 3.0, -t * 2.0)) / 9.0).b * 0.6 + R(w / 4.0 + t * 0.15).a * 0.4, 2.2);
    float quebra = crista * (1.0 - smoothstep(0.35 * CASA, 1.5 * CASA, dd)) * smoothstep(0.08 * CASA, 0.3 * CASA, dd);
    float mRisco = crista * 0.3 * smoothstep(0.3, 0.6, renda) + quebra * smoothstep(0.4, 0.6, renda) * 0.9;
    float frenteLarga = mix(4.0, 13.0, espuma);
    float naFrente = smoothstep(-0.5, 1.5, deMar) * (1.0 - smoothstep(frenteLarga * 0.4, frenteLarga, deMar));
    float sobra = (1.0 - smoothstep(0.0, 2.2, abs(d + sobe * 0.75 + (nm.g - 0.5) * 4.0))) * (fase > 0.32 ? 1.0 - (fase - 0.32) / 0.68 : 0.0);
    rendaMar = (naFrente * (0.7 + 0.3 * smoothstep(0.35, 0.6, renda)) + sobra * smoothstep(0.45, 0.6, renda) * 0.75) * (0.3 + 0.7 * espuma);
    float mBrilho = cintila(w + vec2(4.0, 2.0) * t, t) * smoothstep(0.42, 0.7, m1) * (0.3 + 0.7 * aoFundo);
    luz += mLuz * mar; risco += mRisco * mar * (0.4 + 0.6 * espuma); brilho += mBrilho * mar;
  }
  float ceu = smoothstep(0.55, 0.82, R((w + vec2(t * 4.0, t * 1.5)) / 260.0).b) * 0.07;
  agua = agua * (1.0 + luz) + ceu;
  agua = mix(agua, corDaEspuma, clamp(risco, 0.0, 1.0) * 0.55);
  float labio = (1.0 - smoothstep(0.0, 1.8, de)) * smoothstep(-0.5, 0.5, de) * (1.0 - mar) * (0.12 + 0.28 * espuma);
  agua = mix(agua, corDaEspuma, labio);
  // Sol de cima à esquerda; de noite, a lua: menos pontos e mais frios.
  vec3 corDoBrilho = noite > 0.5 ? vec3(0.85, 0.9, 1.0) : vec3(1.0, 0.98, 0.9);
  float forcaDoBrilho = noite > 0.5 ? 0.45 : 0.65;
  float limiar = noite > 0.5 ? 0.5 : 0.0;
  agua = mix(agua, corDoBrilho, smoothstep(limiar, 1.0, brilho) * forcaDoBrilho * smoothstep(1.0, 6.0, de));
  agua = clamp(agua + graoDoPapel(w), 0.0, 1.0);
  // LAVA: no lugar da água (sem espuma, sem céu, sem sol nem lua refletidos). O rio de lava anda em bloco, viscoso:
  // a mesma rapidez de margem a margem (as placas não esticam) e bem mais devagar que a água; no lago e no mar a
  // crosta só deriva. As placas do rio são compridas no rumo da correnteza.
  if (lava > 0.01) {
    // O calor: manchas quentes que somem perto da margem. No lago e no mar ficam paradas no mundo (a crosta deriva
    // por elas); no rio descem com a lava (parada, a mancha virava um risco claro fixo na correnteza).
    // O miolo (longe da margem) é sempre um pouco quente: o canal do meio do rio, o centro do lago.
    float perto = smoothstep(0.0, 0.55, prof);
    float miolo = smoothstep(0.5, 1.0, prof);
    vec3 corL = vec3(0.0);
    if (rio > 0.01) {
      float rapidezDaLava = mix(3.0, 24.0, vel);
      vec2 qr = vec2(f1.y - rapidezDaLava * t, f1.z);
      float calorR = clamp(smoothstep(0.38, 0.75, R(qr / 170.0 + 2.0).a * 0.65 + R(qr / 61.0 + 5.0).b * 0.35) + miolo * 0.6, 0.0, 1.0) * perto;
      corL += rio * corDaLava(qr, 1.35, clamp(meiaLargura * 0.85, 14.0, 34.0), base, calorR, t, ondas, noite, uPx);
    }
    if (rio < 0.99) {
      vec2 qa = w + mix(vec2(2.2, 1.1), vec2(-1.3, 1.9), mar) * t;
      float calorA = clamp(smoothstep(0.38, 0.75, R(w / 170.0 + 2.0).a * 0.65 + R(w / 61.0 + 5.0).b * 0.35) + miolo * 0.4, 0.0, 1.0) * perto;
      corL += (1.0 - rio) * corDaLava(qa, 1.0, mix(32.0, 40.0, mar), base, calorA, t, ondas, noite, uPx);
    }
    // Junto da margem a lava esfria: a crosta fecha.
    corL = mix(corL, vec3(0.1, 0.07, 0.06), (1.0 - smoothstep(0.0, 4.5, de)) * 0.55);
    agua = mix(agua, clamp(corL + graoDoPapel(w), 0.0, 1.0), lava);
  }
  // A beira rasa deixa ver o chão molhado por baixo; a lava cobre inteira.
  float aa = max(fwidth(de), 0.5);
  float cobre = smoothstep(-aa, aa, de) * mix(mix(0.62, 1.0, smoothstep(0.0, 7.0, de)), 1.0, lava);
  acc = sobre(acc, agua, cobre);
  acc = sobre(acc, corDaEspuma, clamp(rendaMar, 0.0, 1.0) * 0.9 * (1.0 - lava));
  // O chão das salas e do Chão Liso por cima: a cobertura lida como distância (meio = a borda), fina em qualquer zoom.
  float cob = texture(uF4, uv).r;
  float aaDoChao = max(fwidth(cob), 0.001) * 0.7;
  acc *= 1.0 - smoothstep(0.5 - aaDoChao, 0.5 + aaDoChao, cob);
  if (acc.a <= 0.002) discard;
  finalColor = acc;
}
`

let programa: GlProgram | null = null
function programaDaAgua(): GlProgram {
  programa ??= new GlProgram({ vertex: VERTICE, fragment: PIXEL, name: 'agua-do-mapa' })
  return programa
}

/**
 * O shader da água compila nesta placa? Uma vez por renderer, EM SEGUNDO PLANO
 * (`aquecerPrograma.ts`): a conferência na hora travava a primeira água
 * (517 ms no Goa). Não compilou = sem água animada (com aviso).
 */
function aquecerAgua(renderer: Renderer): Promise<boolean> {
  return aquecerPrograma(renderer, programaDaAgua(), '[agua] o shader não compilou nesta placa; a água não aparece')
}

/** O float com filtro linear existe? Sem ele o campo vai sem filtro (a beira fica um pouco mais dura). */
function floatLinear(renderer: Renderer): boolean {
  return 'gl' in renderer && renderer.gl.getExtension('OES_texture_float_linear') !== null
}

// ---------- o ruído (o mesmo do protótipo: 4 canais de fbm de valor, 256 x 256, que se repete) ----------

const LADO_DO_RUIDO = 256
let ruidoPronto: Uint8Array | null = null

/** Os 4 canais do ruído do protótipo (`canalDoRuido`), feitos uma vez por página. Exportado para o teste. */
export function pixelsDoRuidoDaAgua(): Uint8Array {
  if (ruidoPronto !== null) return ruidoPronto
  const L = LADO_DO_RUIDO
  const px = new Uint8Array(L * L * 4)
  let semente = 0x51f15e
  const aleatorio = (): number => {
    semente = (semente + 0x6d2b79f5) >>> 0
    let x = semente
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  for (let c = 0; c < 4; c += 1) {
    const oitavas = [8, 16, 32, 64].map((n) => ({ n, v: Float32Array.from({ length: n * n }, aleatorio) }))
    for (let y = 0; y < L; y += 1) {
      for (let x = 0; x < L; x += 1) {
        let t = 0
        let soma = 0
        let a = 0.5
        for (const o of oitavas) {
          const fx = (x / L) * o.n
          const fy = (y / L) * o.n
          const ix = Math.floor(fx)
          const iy = Math.floor(fy)
          const ux = fx - ix
          const uy = fy - iy
          const sx = ux * ux * (3 - 2 * ux)
          const sy = uy * uy * (3 - 2 * uy)
          const x0 = ix % o.n
          const y0 = iy % o.n
          const x1 = (ix + 1) % o.n
          const y1 = (iy + 1) % o.n
          const va = o.v[y0 * o.n + x0]
          const vb = o.v[y0 * o.n + x1]
          const vc = o.v[y1 * o.n + x0]
          const vd = o.v[y1 * o.n + x1]
          t += a * (va + (vb - va) * sx + (vc - va) * sy + (va - vb - vc + vd) * sx * sy)
          soma += a
          a *= 0.5
        }
        px[(y * L + x) * 4 + c] = Math.min(255, Math.max(0, Math.round((t / soma) * 255)))
      }
    }
  }
  ruidoPronto = px
  return px
}

// ---------- o renderer ----------

export interface EntradaDaAgua {
  /** Id da cena (com o piso): cena nova refaz o campo na hora, sem esperar. */
  cena: string
  aguas: readonly Agua[]
  grid: number
  /** O mapa e o que está em volta (`lib/agua/entorno.ts`): a água não passa do mapa. Ausente = como antes. */
  entorno?: EntornoDaAgua
}

export interface AguaDoMapa {
  /** A água viva (no jogador, só onde ele vê agora). */
  readonly camada: Container
  /** No jogador: a mesma água com o tempo parado, para o que ele só lembra (`null` no editor). */
  readonly camadaParada: Container | null
  atualizar: (entrada: EntradaDaAgua | null) => void
  /** O pedaço do mundo à vista: sem água nele, a água não pede quadro. */
  ajustarAVista: (vista: Caixa | null) => void
  setPeriodo: (periodo: Periodo | null) => void
  /** Os efeitos do mapa ligados (com "menos movimento" a água fica parada de qualquer jeito). */
  setAnimar: (animar: boolean) => void
  /** Medidas para o teste e a prova: quantos campos refeitos e o tempo do último. */
  readonly medidas: { campos: number; ultimoCampoMs: number; texels: number }
  destruir: () => void
}

interface Copia {
  mesh: Mesh<Geometry, Shader>
  /** Os valores dos uniforms (o UniformGroup lê estes mesmos arrays). */
  caixa: Float32Array
  agua: Float32Array
  campo: Float32Array
}

export function criarAguaDoMapa(dep: {
  renderer: Renderer
  /** O ticker CRU do app (não o `relogio`, que desenha todo quadro). */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `desenhoSobPedido.pedir`: desenha no próximo quadro. */
  pedir: () => void
  reducedMotion: () => boolean
  /** Jogador: faz também a cópia parada para o lembrado. */
  comCopiaParada?: boolean
  aoMudar?: (estado: { aguas: number; animando: boolean }) => void
}): AguaDoMapa {
  const camada = new Container()
  camada.label = 'agua'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  camada.visible = false
  const camadaParada = dep.comCopiaParada === true ? new Container() : null
  if (camadaParada !== null) {
    camadaParada.label = 'agua-parada'
    camadaParada.eventMode = 'none'
    camadaParada.interactiveChildren = false
    camadaParada.visible = false
  }
  const medidas = { campos: 0, ultimoCampoMs: 0, texels: 0 }
  let copias: Copia[] = []
  let ruido: TextureSource | null = null
  let fontes: TextureSource[] = []
  let campo: CampoComposto | null = null
  /** A caixa das águas em px de mundo (para saber se há água na tela). */
  let caixaNoMundo: Caixa | null = null
  let vista: Caixa | null = null
  let animar = true
  let noite = 0
  let noTicker = false
  let ultimoPedido = 0
  let inicio = performance.now()
  /** Quando o tempo parou (fora do ticker): ao voltar, a água continua de onde estava, sem salto. */
  let paradoEm = performance.now()
  let pendente: ReturnType<typeof setTimeout> | null = null
  let geracao = 0
  let cenaPedida: string | null = null
  /** A lista do último campo pedido: o recorte do jogador chega novo a cada passo, quase sempre igual. */
  let assinaturaPedida = ''
  let destruido = false
  /** O que foi para a placa da última vez (corpos, cores, mapa e buraco): igual, nada a juntar nem a subir. */
  let compostoAplicado = ''
  /** O buraco do último campo: a mesma caixa com as mesmas formas reaproveita a conta. */
  let buracoFeito: { chave: string; buraco: Uint8Array | null } | null = null
  /** Campo de cada água já feito: chave do corpo + texel. */
  const feitos = new Map<string, { chave: string; texel: number; campo: CampoDoCorpo }>()

  function montarCopia(alvo: Container): Copia | null {
    // Só depois do `aquecerAgua` (o `refazer` espera por ele): compilado ou não, já se sabe.
    if (programaPronto(dep.renderer, programaDaAgua()) !== true) return null
    ruido ??= new BufferImageSource({
      resource: pixelsDoRuidoDaAgua(),
      width: LADO_DO_RUIDO,
      height: LADO_DO_RUIDO,
      format: 'rgba8unorm',
      scaleMode: 'linear',
      addressMode: 'repeat',
      autoGenerateMipmaps: true,
      alphaMode: 'no-premultiply-alpha',
    })
    const caixa = new Float32Array(4)
    const agua = new Float32Array([1, 0, noite, 4])
    const campoU = new Float32Array([0, 0, 1, 1])
    const ajustes = new UniformGroup({
      uCaixa: { value: caixa, type: 'vec4<f32>' },
      uAgua: { value: agua, type: 'vec4<f32>' },
      uCampo: { value: campoU, type: 'vec4<f32>' },
    })
    const vazio = fontes[0] ?? ruido
    const shader = new Shader({ glProgram: programaDaAgua(), resources: { uRuido: ruido, uF1: fontes[0] ?? vazio, uF2: fontes[1] ?? vazio, uF3: fontes[2] ?? vazio, uF4: fontes[3] ?? vazio, agua: ajustes } })
    const geometria = new Geometry({
      attributes: { aPosition: { buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), format: 'float32x2' } },
      indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
    })
    const mesh = new Mesh<Geometry, Shader>({ geometry: geometria, shader })
    mesh.eventMode = 'none'
    alvo.addChild(mesh)
    return { mesh, caixa, agua, campo: campoU }
  }

  function garantirCopias(): boolean {
    if (copias.length > 0) return true
    const viva = montarCopia(camada)
    if (viva === null) return false
    copias = [viva]
    if (camadaParada !== null) {
      const parada = montarCopia(camadaParada)
      if (parada !== null) copias.push(parada)
    }
    return true
  }

  function haAguaNaVista(): boolean {
    if (caixaNoMundo === null) return false
    if (vista === null) return true
    return caixaNoMundo.maxX >= vista.minX && caixaNoMundo.minX <= vista.maxX && caixaNoMundo.maxY >= vista.minY && caixaNoMundo.minY <= vista.maxY
  }

  const anda = (): boolean => campo !== null && animar && !dep.reducedMotion() && haAguaNaVista()

  function avisar(): void {
    dep.aoMudar?.({ aguas: feitos.size, animando: noTicker })
  }

  function tique(): void {
    if (!anda()) {
      sairDoTicker()
      return
    }
    const agora = performance.now()
    // O tempo vai em todo tique: se outro já desenha a 60, a água anda a 60 junto.
    const viva = copias[0]
    if (viva !== undefined) viva.agua[1] = (agora - inicio) / 1000
    if (agora - ultimoPedido >= MS_POR_QUADRO - 4) {
      ultimoPedido = agora
      dep.pedir()
    }
  }

  function entrarNoTicker(): void {
    if (noTicker || !anda()) return
    noTicker = true
    inicio += performance.now() - paradoEm
    dep.ticker.add(tique)
    avisar()
  }

  function sairDoTicker(): void {
    if (!noTicker) return
    noTicker = false
    paradoEm = performance.now()
    dep.ticker.remove(tique)
    dep.pedir()
    avisar()
  }

  function trocarFontes(c: CampoComposto): void {
    const velhas = fontes
    const linear = floatLinear(dep.renderer)
    fontes = [
      new BufferImageSource({ resource: c.f1, width: c.w, height: c.h, format: 'rgba32float', scaleMode: linear ? 'linear' : 'nearest', addressMode: 'clamp-to-edge', alphaMode: 'no-premultiply-alpha' }),
      new BufferImageSource({ resource: c.f2, width: c.w, height: c.h, format: 'rgba8unorm', scaleMode: 'linear', addressMode: 'clamp-to-edge', alphaMode: 'no-premultiply-alpha' }),
      new BufferImageSource({ resource: c.f3, width: c.w, height: c.h, format: 'rgba8unorm', scaleMode: 'linear', addressMode: 'clamp-to-edge', alphaMode: 'no-premultiply-alpha' }),
      new BufferImageSource({ resource: c.f4, width: c.w, height: c.h, format: 'rgba8unorm', scaleMode: 'linear', addressMode: 'clamp-to-edge', alphaMode: 'no-premultiply-alpha' }),
    ]
    for (const copia of copias) {
      const recursos = copia.mesh.shader?.resources
      if (recursos === undefined) continue
      recursos.uF1 = fontes[0]
      recursos.uF2 = fontes[1]
      recursos.uF3 = fontes[2]
      recursos.uF4 = fontes[3]
    }
    for (const f of velhas) f.destroy()
  }

  /** O campo pronto: sobe as texturas, acerta o retângulo e liga o tempo. */
  function aplicar(c: CampoComposto | null, grid: number, mapa: EntornoDaAgua['mapa'] = null): void {
    campo = c
    const k = uPorPx(grid)
    // O retângulo do campo em px de mundo, cortado ao mapa: o que passa da borda não é desenhado.
    const x = c === null ? 0 : Math.max((c.x0 * c.texel) / k, mapa === null ? -Infinity : 0)
    const y = c === null ? 0 : Math.max((c.y0 * c.texel) / k, mapa === null ? -Infinity : 0)
    const x1 = c === null ? 0 : Math.min(((c.x0 + c.w) * c.texel) / k, mapa === null ? Infinity : mapa.largura)
    const y1 = c === null ? 0 : Math.min(((c.y0 + c.h) * c.texel) / k, mapa === null ? Infinity : mapa.altura)
    if (c === null || c.w <= 0 || c.h <= 0 || x1 <= x || y1 <= y) {
      campo = null
      caixaNoMundo = null
      camada.visible = false
      if (camadaParada !== null) camadaParada.visible = false
      sairDoTicker()
      dep.pedir()
      return
    }
    if (!garantirCopias()) return
    trocarFontes(c)
    const largura = x1 - x
    const altura = y1 - y
    caixaNoMundo = { minX: x, minY: y, maxX: x + largura, maxY: y + altura }
    medidas.texels = c.w * c.h
    for (const copia of copias) {
      copia.caixa.set([x, y, largura, altura])
      copia.agua[0] = k
      copia.agua[2] = noite
      copia.agua[3] = c.texel
      copia.campo.set([c.x0, c.y0, 1 / c.w, 1 / c.h])
    }
    camada.visible = true
    if (camadaParada !== null) camadaParada.visible = true
    dep.pedir()
    entrarNoTicker()
    avisar()
  }

  /**
   * Refaz o campo sem travar a tela: um corpo por tarefa, o ruído (a primeira
   * vez) noutra, a junção noutra e a subida para a placa noutra, essa só com o
   * shader já compilado (ele compila em segundo plano enquanto os corpos se fazem).
   */
  function refazer(entrada: EntradaDaAgua): void {
    geracao += 1
    const minha = geracao
    const corpos = entrada.aguas
      .map((a) => ({ agua: a, corpo: corpoDaAgua(a, entrada.grid, entrada.entorno) }))
      .filter((x): x is { agua: Agua; corpo: CorpoDoCampo } => x.corpo !== null)
      .map((x) => ({ ...x, chave: chaveDoCorpo(x.agua, x.corpo) }))
    const mapa = entrada.entorno?.mapa ?? null
    if (corpos.length === 0) {
      feitos.clear()
      compostoAplicado = ''
      aplicar(null, entrada.grid)
      return
    }
    const compilou = aquecerAgua(dep.renderer)
    const texel = texelDasAguas(corpos.map((x) => x.corpo))
    const vivos = new Set(corpos.map((x) => x.agua.id))
    for (const id of [...feitos.keys()]) if (!vivos.has(id)) feitos.delete(id)
    const fila = corpos.filter(({ agua, chave }) => {
      const feito = feitos.get(agua.id)
      return feito === undefined || feito.chave !== chave || feito.texel !== texel
    })
    const t0 = performance.now()
    const vale = (): boolean => minha === geracao && !destruido
    const subir = (composto: CampoComposto | null, chaveDoComposto: string): void => {
      void compilou.then(() => {
        if (!vale()) return
        compostoAplicado = chaveDoComposto
        aplicar(composto, entrada.grid, mapa)
        medidas.campos += 1
        medidas.ultimoCampoMs = performance.now() - t0
      })
    }
    const juntar = (): void => {
      if (!vale()) return
      let caixa: CaixaEmTexels | null = null
      const lista: { agua: Agua; corpo: CorpoDoCampo; campo: CampoDoCorpo }[] = []
      for (const { agua, corpo } of corpos) {
        const feito = feitos.get(agua.id)
        if (feito === undefined) continue
        lista.push({ agua, corpo, campo: feito.campo })
        caixa = unirCaixas(caixa, feito.campo)
      }
      // O chão por cima (salas e o Chão Liso de cada água) que toca a caixa: o buraco só é refeito quando ele muda.
      const formas = caixa === null ? [] : formasDoBuraco({ ...caixa, texel }, entrada.entorno, entrada.grid, lista)
      // A peça de Chão Liso que só fica por cima de uma das águas que toca depende de quem manda em cada texel (as formas das águas).
      const comDono = formas.some((f) => f.soNas !== undefined)
      const chaveDoBuraco = caixa === null ? '' : `${caixa.x0},${caixa.y0},${caixa.w},${caixa.h},${texel}|${JSON.stringify(formas)}${comDono ? `|${corpos.map((c) => c.chave).join(';')}` : ''}`
      // O líquido entra (água ou lava): trocar só ele não refaz o campo do corpo, mas refaz a junção.
      const chaveDoComposto = JSON.stringify([texel, mapa, corpos.map(({ chave, corpo }) => [chave, corpo.cor, corpo.velocidade, corpo.ondas, corpo.espuma, corpo.lava ?? 0]), chaveDoBuraco])
      // Nada mudou no que está na placa (uma sala mexida longe da água, o mesmo recorte de novo).
      if (campo !== null && chaveDoComposto === compostoAplicado) return
      const composto = caixa === null ? null : comporCampo(lista, caixa, texel, comDono)
      setTimeout(() => furar(composto, formas, chaveDoBuraco, chaveDoComposto), 0)
    }
    const furar = (composto: CampoComposto | null, formas: FormaDoBuraco[], chaveDoBuraco: string, chaveDoComposto: string): void => {
      if (!vale()) return
      if (composto !== null && formas.length > 0) {
        if (buracoFeito === null || buracoFeito.chave !== chaveDoBuraco) buracoFeito = { chave: chaveDoBuraco, buraco: buracoDoCampo(composto, texel, formas, composto.dono) }
        porOBuraco(composto.f4, buracoFeito.buraco)
      }
      setTimeout(() => subir(composto, chaveDoComposto), 0)
    }
    let ruidoFeito = ruido !== null
    const proximo = (): void => {
      if (!vale()) return
      const item = fila.shift()
      if (item === undefined) {
        // O ruído da primeira água (feito uma vez por página) numa tarefa só dele.
        if (!ruidoFeito) {
          ruidoFeito = true
          pixelsDoRuidoDaAgua()
          setTimeout(proximo, 0)
          return
        }
        juntar()
        return
      }
      feitos.set(item.agua.id, { chave: item.chave, texel, campo: campoDoCorpo(item.corpo, texel) })
      setTimeout(proximo, 0)
    }
    proximo()
  }

  return {
    camada,
    camadaParada,
    medidas,
    atualizar(entrada) {
      if (destruido) return
      const cenaNova = (entrada?.cena ?? null) !== cenaPedida
      cenaPedida = entrada?.cena ?? null
      if (entrada === null || entrada.aguas.length === 0) {
        // Já sem água e sem nada na espera: o jogador sem água no recorte não pede quadro a cada passo.
        if (campo === null && pendente === null && assinaturaPedida === '') return
        assinaturaPedida = ''
        if (pendente !== null) clearTimeout(pendente)
        pendente = null
        geracao += 1
        feitos.clear()
        aplicar(null, entrada?.grid ?? 1)
        return
      }
      // O entorno entra pelo conteúdo (`chave`): o recorte do jogador chega novo a cada passo, quase sempre igual.
      const assinatura = `${entrada.grid}|${JSON.stringify(entrada.entorno?.mapa ?? null)}|${entrada.entorno?.chave ?? ''}|${JSON.stringify(entrada.aguas)}`
      // A mesma lista do pedido de antes (o feito ou o que está na espera): nada muda.
      if (!cenaNova && assinatura === assinaturaPedida) return
      assinaturaPedida = assinatura
      if (pendente !== null) clearTimeout(pendente)
      pendente = null
      if (cenaNova) {
        feitos.clear()
        refazer(entrada)
      } else {
        pendente = setTimeout(() => {
          pendente = null
          refazer(entrada)
        }, ESPERA_DO_CAMPO_MS)
      }
    },
    ajustarAVista(nova) {
      vista = nova
      if (anda()) entrarNoTicker()
    },
    setPeriodo(periodo) {
      const nova = periodo === 'noite' ? 1 : 0
      if (nova === noite) return
      noite = nova
      for (const copia of copias) copia.agua[2] = noite
      dep.pedir()
    },
    setAnimar(novo) {
      if (novo === animar) return
      animar = novo
      if (animar) entrarNoTicker()
      else sairDoTicker()
    },
    destruir() {
      destruido = true
      if (pendente !== null) clearTimeout(pendente)
      sairDoTicker()
      camada.destroy({ children: true })
      camadaParada?.destroy({ children: true })
      for (const f of fontes) f.destroy()
      fontes = []
      ruido?.destroy()
      ruido = null
      copias = []
    },
  }
}

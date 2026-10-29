// =====================================================================
// comum/traco.gdshaderinc: o cabeçalho do textura.gdshader de um TRAÇO (onda 5:
// penhasco, borda do penhasco, parede, janela, grade; CONTRATO.md, seção 11).
// Os designers só incluem, nunca editam.
//
// Um traço é desenhado no ESPAÇO DA FACE, não no mapa: x anda AO LONGO da beira
// (q.x, px do mundo, 64 por casa) e y DESCE da beira de cima para o pé (q.y, px do
// mundo, 0 na beira). O app deita esse espaço ao longo da linha ou da curva que o
// mestre riscou (a beira de `lib/barranco.ts`) e acende pela luz dele: a cor que você
// pinta NÃO leva luz de direção, só o perfil de cima para baixo (a beira mais clara, o
// pé mais escuro) e a sombra de dentro.
//
// Uma face de traço (parte "face": penhasco, parede) escreve as DUAS funções:
//
//   vec4 pintar_face(vec2 q, float H, float L, int modulo, int alt, float px, int sem)
//       A cor RETA e o alfa da face no ponto q. H = a altura da face nesta altura do
//       app (alt 0 Baixo, 1 Médio, 2 Alto: 20, 32 e 48 px do mundo), L = o comprimento
//       deste módulo (px do mundo). q.x vai de 0 a L; q.y de -traco_acima (acima da
//       beira) a H + traco_abaixo (o pé recortado: o zigue-zague passa de H). Fora da
//       face, alfa 0. Com "tingir": true no config, o valor vai em r (0,5 = a cor do
//       mestre) e g e b são ignorados.
//
//   vec2 relevo_da_face(vec2 q, float H, float L, int modulo, int alt, float px, int sem)
//       Para onde a superfície inclina, de -1 a 1: x AO LONGO (+1 = virada para +x),
//       y PARA BAIXO (+1 = virada para o pé, -1 = virada para a beira, como o topo de
//       uma laje). Plano = (0, 0). O app soma isto à luz da face (seção 11.5).
//
//   REGRA DA COSTURA: os primeiros e os últimos COSTURA_PX px de todo módulo são a
//   MESMA coluna em todos os módulos e alturas iguais (a face lisa: terra, reboco),
//   com relevo x = 0. É ela que deixa o app emendar qualquer módulo em qualquer outro,
//   e espelhar. O exportador mede e recusa acima de 2/255.
//
// Uma borda de traço (parte "borda": penhasco-borda) escreve UMA função:
//
//   vec4 pintar_borda(vec2 q, float L, int linha, float px, int sem)
//       A cor reta e o alfa da linha "linha" da borda (a ordem de "linhas" no config).
//       q.x de 0 a L (a borda repete a cada L), q.y em px do mundo a partir da âncora
//       da linha (a beira, ou o pé), de -traco_acima a traco_abaixo. Não é acesa pelo app.
//
// px = 1 px da imagem em px do mundo (0,5: a imagem tem 128 px por casa). Use
// cobre(d, px) para toda borda. Nenhum parâmetro pode ter o nome de um uniform daqui
// nem do cabeçalho do chão (modo, variante, periodo, semente, ...).
// =====================================================================

#include "res://comum/cabecalho.gdshaderinc"

uniform int traco_alt = 1;           // 0 Baixo, 1 Médio, 2 Alto
uniform float traco_h = 32.0;        // H: a altura da face, px do mundo
uniform int traco_modulo = 0;        // o módulo (face) desta imagem
uniform float traco_l = 128.0;       // L: o comprimento do módulo ou da borda, px do mundo
uniform float traco_acima = 4.0;     // px do mundo da imagem acima da beira (ou da âncora)
uniform float traco_abaixo = 8.0;    // px do mundo da imagem abaixo de H (ou da âncora)
uniform float traco_folga = 4.0;     // px do mundo de folga antes e depois do módulo
uniform vec2 traco_imagem = vec2(256.0, 64.0); // o tamanho desta imagem, px
uniform int traco_linha = 0;         // a linha da borda

const float TRACO_PX_POR_CASA = 128.0;
const float COSTURA_PX = 4.0;        // px do mundo lisos em cada ponta do módulo
const float H_BAIXO = 20.0;          // as alturas do app a 64 px por casa (lib/barranco.ts,
const float H_MEDIO = 32.0;          // ESPESSURA_DO_PROTOTIPO 10, 16 e 24 num quadrado de 32)
const float H_ALTO = 48.0;

// A espessura do contorno da família (o protótipo do Fogo e os móveis: 0,042 casa).
const float CONTORNO_TRACO = 2.4;

// Pinta uma massa com contorno: o miolo na cor c, o contorno na própria cor escurecida.
// d = distância com sinal (negativa dentro), w = largura do contorno, px do mundo.
vec4 massa_com_contorno(vec4 acc, float d, vec3 c, float w, float px) {
	acc = sobre(acc, contorno_de(c), cobre(d, px));
	return sobre(acc, c, cobre(d + w, px));
}

// Um degrau suave de a para b (0 antes de a, 1 depois de b).
float rampa_traco(float a, float b, float x) {
	return smoothstep(a, b, x);
}

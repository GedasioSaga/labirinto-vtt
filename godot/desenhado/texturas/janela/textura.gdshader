shader_type canvas_item;
render_mode blend_disabled;

// JANELA (onda 5, lote 17; CONTRATO.md 11.14 e 11.15). Um módulo de 1 casa que o app põe no
// lugar da parede no trecho da janela, repetido inteiro (a janela de 3 casas são 3 vidraças
// com um pilar de parede entre elas). Pega a cor da parede ("tingir": "familia-pedra").
//
// - As pontas são a parede: a coluna da costura (parede_comum.gdshaderinc) e o fim do tampo
//   com o corte em contorno (a ombreira). Assim a janela emenda na parede sem degrau.
// - No vão, o peitoril, mais fundo que o tampo (o valor da sombra), e no meio da espessura o
//   VIDRO numa massa calma e clara, com o caixilho no contorno e um brilho largo e suave.
//   Lido de longe, é o traço duplo da janela de hoje virado desenho.
// - O vidro e o peitoril são planos (relevo 0); só a ombreira tem chanfro.

#include "res://comum/traco.gdshaderinc"
#include "res://texturas/parede/parede_comum.gdshaderinc"

const float VIDRO_FRACAO = 0.15;      // a meia largura do vidro, em fração de H
const float VIDRO_MIN = 2.4;          // px do mundo
const float CAIXILHO = 1.5;           // o contorno do vidro
const float V_VIDRO = 0.80;
const float V_BRILHO = 0.92;

vec2 janela_no_ponto(vec2 q, float H, float L, int alt, float px, out vec2 rel) {
	// O peitoril.
	float v = PV_SOMBRA;
	// O vidro, de ombreira a ombreira (entra um pouco debaixo do corte).
	float meia = max(VIDRO_FRACAO * H, VIDRO_MIN);
	float x0 = PAREDE_OMBREIRA - PAREDE_CORTE;
	vec2 c = vec2(0.5 * L, 0.5 * H);
	vec2 b = vec2(0.5 * L - x0, meia);
	float d = sd_caixa(q - c, b, 0.8);
	float a = cobre(d, px);
	float ai = cobre(d + CAIXILHO, px);
	// Um brilho só, largo e inclinado, que some antes das pontas do vidro.
	float s = (q.x - 0.36 * L) - 0.9 * (q.y - c.y);
	float brilho = (1.0 - smoothstep(2.0, 4.5, abs(s))) * 0.75;
	float vidro = mix(V_VIDRO, V_BRILHO, brilho);
	v = mix(v, PV_CONTORNO, a);
	v = mix(v, vidro, ai);
	vec2 rel_vao = vec2(0.0);
	return parede_vao(q, alt, H, L, v, rel_vao, px, rel);
}

vec4 pintar_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	vec2 va = janela_no_ponto(q, H, L, alt, px, rel);
	return vec4(vec3(va.x), va.y);
}

vec2 relevo_da_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	janela_no_ponto(q, H, L, alt, px, rel);
	return rel;
}

#define FACE
#include "res://comum/rodape_traco.gdshaderinc"

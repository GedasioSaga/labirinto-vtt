shader_type canvas_item;
render_mode blend_disabled;

// GRADE DE PRISÃO (onda 5, lote 17; CONTRATO.md 11.14 e 11.15). Um módulo de 1 casa que o
// app põe no lugar da parede no trecho da grade, repetido inteiro. Pega a cor da parede
// ("tingir": "familia-pedra"); as barras ficam nos valores mais escuros da rampa, que com o
// croma da pedra lê como ferro em qualquer cor de parede.
//
// - As pontas são a parede (a coluna da costura e a ombreira), como na janela.
// - No vão, o peitoril e, de ombreira a ombreira, o trilho no meio da espessura; por cima,
//   TRÊS barras por casa, grossas e redondas (a cabeça de cada barra vista de cima), de
//   contorno grosso e topo em cúpula no relevo: o app acende o lado de cima à esquerda.
//   Nada de risquinho nem de fileira miúda: três massas por casa.

#include "res://comum/traco.gdshaderinc"
#include "res://texturas/parede/parede_comum.gdshaderinc"

const int BARRAS = 3;
const float V_PEITORIL = 0.42;
const float V_FERRO = 0.20;
const float V_FERRO_CONTORNO = 0.03;
const float CONTORNO_BARRA = 1.6;

float raio_da_barra(float H) {
	return clamp(0.22 * H, 3.6, 6.0);
}

vec2 grade_no_ponto(vec2 q, float H, float L, int alt, float px, out vec2 rel) {
	float v = V_PEITORIL;
	vec2 rel_vao = vec2(0.0);
	float yc = 0.5 * H;
	// O trilho, de ombreira a ombreira.
	float meia = clamp(0.065 * H, 1.3, 2.6);
	float x0 = PAREDE_OMBREIRA - PAREDE_CORTE;
	float dt = sd_caixa(q - vec2(0.5 * L, yc), vec2(0.5 * L - x0, meia), meia);
	float at = cobre(dt, px);
	v = mix(v, V_FERRO_CONTORNO, at);
	v = mix(v, V_FERRO, cobre(dt + 1.0, px));
	rel_vao = mix(rel_vao, vec2(0.0, 0.6 * clamp((q.y - yc) / max(meia, 1.0), -1.0, 1.0)), at);
	// As barras.
	float rb = raio_da_barra(H);
	float vao = L - 2.0 * PAREDE_OMBREIRA;
	// O app põe a imagem só no miolo (a espessura menos os dois contornos, 11.15): a barra
	// nasce mais alta na imagem para sair redonda na parede da espessura nominal.
	float aperto = (H - 2.0 * CONTORNO_TRACO) / H;
	for (int i = 0; i < BARRAS; i++) {
		vec2 c = vec2(PAREDE_OMBREIRA + (float(i) + 0.5) * vao / float(BARRAS), yc);
		vec2 p = (q - c) * vec2(1.0, aperto);
		float d = length(p) - rb;
		float a = cobre(d, px);
		if (a <= 0.0) continue;
		v = mix(v, V_FERRO_CONTORNO, a);
		v = mix(v, V_FERRO, cobre(d + CONTORNO_BARRA, px));
		rel_vao = mix(rel_vao, 0.85 * clamp(p / rb, vec2(-1.0), vec2(1.0)), a);
	}
	return parede_vao(q, alt, H, L, v, rel_vao, px, rel);
}

vec4 pintar_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	vec2 va = grade_no_ponto(q, H, L, alt, px, rel);
	return vec4(vec3(va.x), va.y);
}

vec2 relevo_da_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	grade_no_ponto(q, H, L, alt, px, rel);
	return rel;
}

#define FACE
#include "res://comum/rodape_traco.gdshaderinc"

shader_type canvas_item;
render_mode blend_disabled;

// PAREDE (onda 5, lote 17; CONTRATO.md 11.14 e 11.15). O tampo da parede vista de cima, que
// pega a cor do mestre ("tingir": "familia-pedra"): a pedra lavrada em poucos blocos largos.
//
// - As 3 alturas são 3 materiais da mesma parede, escolhidos pela espessura (11.4): a parede
//   fina e a média (até 26 px do mundo) usam o Baixo, lajes compridas numa fiada só (uma
//   junta a cada 1,2 a 2,4 casas; um módulo inteiro sem junta, para o olho descansar); a
//   grossa (até 40) usa o Médio, blocos de uma casa; a muralha usa o Alto, duas fiadas
//   desencontradas com a junta comprida no meio.
// - Nada de tijolinho, pedrinha ou risco: cada bloco é uma massa só, de tom levemente
//   diferente do vizinho (3%), com o canto redondo e o chanfro no relevo.
// - 5 módulos de 2 a 3,5 casas, sorteados e espelhados pelo app: na parede comprida a mesma
//   junta não volta num ritmo que o olho ache. As juntas ficam a 16 px ou mais das pontas do
//   módulo: a costura é sempre o meio de um bloco (parede_comum.gdshaderinc).
// - O contorno é do app (11.15): a imagem é só o miolo.

#include "res://comum/traco.gdshaderinc"
#include "res://texturas/parede/parede_comum.gdshaderinc"

// As juntas de cada módulo, em fração do comprimento (até 3 por fiada; -1 = acabou).
// Módulos: 0 = 2,5 casas, 1 = 3, 2 = 2, 3 = 3,5, 4 = 2,75.
float junta(int alt, int k, int f, int j) {
	if (alt == 0) {
		if (k == 0 && j == 0) return 0.52;
		if (k == 1 && j == 0) return 0.62;
		if (k == 3 && j == 0) return 0.30;
		if (k == 3 && j == 1) return 0.71;
		if (k == 4 && j == 0) return 0.45;
		return -1.0;
	}
	if (alt == 1) {
		if (k == 0) return j == 0 ? 0.30 : (j == 1 ? 0.68 : -1.0);
		if (k == 1) return j == 0 ? 0.24 : (j == 1 ? 0.55 : 0.83);
		if (k == 2) return j == 0 ? 0.50 : -1.0;
		if (k == 3) return j == 0 ? 0.22 : (j == 1 ? 0.50 : 0.76);
		return j == 0 ? 0.36 : (j == 1 ? 0.72 : -1.0);
	}
	if (f == 0) {
		if (k == 0) return j == 0 ? 0.32 : (j == 1 ? 0.74 : -1.0);
		if (k == 1) return j == 0 ? 0.27 : (j == 1 ? 0.62 : -1.0);
		if (k == 2) return j == 0 ? 0.55 : -1.0;
		if (k == 3) return j == 0 ? 0.25 : (j == 1 ? 0.58 : 0.86);
		return j == 0 ? 0.40 : (j == 1 ? 0.80 : -1.0);
	}
	if (k == 0) return j == 0 ? 0.52 : -1.0;
	if (k == 1) return j == 0 ? 0.44 : (j == 1 ? 0.84 : -1.0);
	if (k == 2) return j == 0 ? 0.27 : (j == 1 ? 0.80 : -1.0);
	if (k == 3) return j == 0 ? 0.41 : (j == 1 ? 0.72 : -1.0);
	return j == 0 ? 0.21 : (j == 1 ? 0.60 : -1.0);
}

// O bloco do ponto: entre a junta de antes e a de depois (sem junta, segue para o vizinho).
void bloco_do_ponto(float x, int alt, int k, int f, float L, out float x0, out float x1, out int b) {
	x0 = -4096.0;
	x1 = 4096.0;
	b = 0;
	for (int j = 0; j < 3; j++) {
		float fr = junta(alt, k, f, j);
		if (fr < 0.0) break;
		float xj = fr * L;
		if (xj < x) {
			x0 = xj + PAREDE_JUNTA * 0.5;
			b = j + 1;
		} else {
			x1 = xj - PAREDE_JUNTA * 0.5;
			break;
		}
	}
}

// -1, 0 ou +1 vezes PAREDE_TOM: vizinhos nunca iguais dentro do módulo.
float tom_do_bloco(int k, int f, int b) {
	int t = (k * 7 + f * 4 + b * 2 + 1) % 3;
	return PAREDE_TOM * (float(t) - 1.0);
}

vec2 parede_no_ponto(vec2 q, float H, float L, int k, int alt, float px, out vec2 rel) {
	int f = parede_qual_fiada(q.y, alt, H);
	float x0;
	float x1;
	int b;
	bloco_do_ponto(q.x, alt, k, f, L, x0, x1, b);
	// O bloco que passa para o módulo vizinho fica no tom do meio (a costura); os de dentro variam.
	float tom = (x0 < -4000.0 || x1 > 4000.0) ? 0.0 : tom_do_bloco(k, f, b);
	return parede_bloco(q, x0, x1, alt, H, L, tom, px, rel);
}

vec4 pintar_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	vec2 va = parede_no_ponto(q, H, L, k, alt, px, rel);
	return vec4(vec3(va.x), va.y);
}

vec2 relevo_da_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	parede_no_ponto(q, H, L, k, alt, px, rel);
	return rel;
}

#define FACE
#include "res://comum/rodape_traco.gdshaderinc"

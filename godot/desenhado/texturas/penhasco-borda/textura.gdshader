shader_type canvas_item;
render_mode blend_disabled;

// PENHASCO, a borda (onda 5, lote 17; CONTRATO.md seção 11). O que o app põe por cima
// da face, ao longo da beira de cima (o chão do alto que debruça) e do pé (a água que
// bate). Uma linha por tipo de chão; o app escolhe pela cor do chão da beira.
//
//   0 grama (beira): a grama do alto debruça na face numa onda larga e mansa, com o
//                    contorno escuro dela e uma sombra curta na terra logo embaixo.
//   1 terra (beira): o mesmo debruço, mais curto, em terra clara (caminho, areia, piso).
//   2 neve  (beira): a neve debruça mais gorda e redonda.
//   3 agua  (pe):    a espuma no pé, onde a água encosta.
//
// Tudo repete a cada L (16 casas): as ondas têm um número inteiro de voltas em L.
// Nada de tufo, folhinha ou pontinho: uma massa só, de contorno grosso.

#include "res://comum/traco.gdshaderinc"

const vec3 BARRANCO_REALCE = vec3(0.761, 0.545, 0.443); // #c28b71
const vec3 BARRANCO_SOMBRA = vec3(0.569, 0.373, 0.290); // #915f4a
const vec3 NEVE = vec3(0.925, 0.945, 0.960);
const vec3 ESPUMA = vec3(0.880, 0.945, 0.960);

// Uma onda periódica em L: v voltas, modulada por uma onda lenta de m voltas.
float onda(float x, float L, float v, float m, float fase) {
	float t = x / L;
	return sin(TAU * v * t + 0.9 * sin(TAU * m * t + fase) + fase * 0.37);
}

// O debruço: uma massa do chão que começa acima da beira (some no chão do alto) e
// desce até w(x) na face. Devolve a camada com alfa pré-multiplicado.
vec4 debruco(vec2 q, float w, vec3 cor, float px) {
	vec4 acc = vec4(0.0);
	// A sombra curta na terra, logo abaixo da beira do debruço.
	float s = (1.0 - smoothstep(w, w + 3.6, q.y)) * step(w, q.y);
	acc = sobre(acc, contorno_de(BARRANCO_SOMBRA), 0.30 * s);
	// A massa: some para cima (lá aparece o chão do alto) e tem o contorno embaixo.
	float d = q.y - w;                                   // < 0 dentro
	float entra = smoothstep(-traco_acima, -traco_acima + 5.0, q.y);
	vec3 c = mix(cor, realce_de(cor), 0.35 * (1.0 - smoothstep(-1.0, 1.6, q.y)));
	float aro = cobre(d, px) * (1.0 - cobre(d + CONTORNO_TRACO, px));
	c = mix(c, contorno_de(cor), aro);
	return sobre(acc, c, cobre(d, px) * entra);
}

// Do pré-multiplicado para a cor reta do contrato.
vec4 reta(vec4 acc, vec3 fundo) {
	return vec4(acc.a > 0.001 ? acc.rgb / acc.a : fundo, acc.a);
}

vec4 pintar_borda(vec2 q, float L, int linha, float px, int sem) {
	float fase = float(sem % 7) * 0.9;
	if (linha == 0) {
		float w = 5.2 + 2.4 * onda(q.x, L, 12.0, 3.0, fase);
		return reta(debruco(q, w, GRAMA, px), GRAMA);
	}
	if (linha == 1) {
		vec3 cor = mix(TERRA, BARRANCO_REALCE, 0.35);
		float w = 3.4 + 1.4 * onda(q.x, L, 14.0, 4.0, fase + 1.3);
		return reta(debruco(q, w, cor, px), cor);
	}
	if (linha == 2) {
		float w = 6.4 + 2.6 * onda(q.x, L, 10.0, 3.0, fase + 2.1);
		return reta(debruco(q, w, NEVE, px), NEVE);
	}
	// A espuma no pé: uma fita clara em onda, e um segundo anel mais fraco adiante.
	float w = 2.0 + 1.1 * onda(q.x, L, 13.0, 4.0, fase + 0.7);
	float fita = cobre(abs(q.y - 0.6) - w, px);
	float anel_y = 6.8 + 1.2 * onda(q.x, L, 9.0, 2.0, fase + 3.3);
	float anel = cobre(abs(q.y - anel_y) - 0.9, px) * 0.45;
	vec4 acc = sobre(vec4(0.0), ESPUMA, anel);
	acc = sobre(acc, ESPUMA, fita * 0.85);
	return reta(acc, ESPUMA);
}

#include "res://comum/rodape_traco.gdshaderinc"

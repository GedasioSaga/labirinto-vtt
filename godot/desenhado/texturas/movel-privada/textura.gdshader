// PRIVADA desenhada que pega cor (onda 4, lote 14; CONTRATO.md seção 10).
//
// Da família aprovada (piloto, lotes 10 a 13): contorno grosso na própria cor, formas
// grandes, a luz de cima à esquerda em poucas massas. Vista de cima, de trás (em cima, na
// virada 0) para a frente, de baixo para cima:
// - O COLO de louça (cor própria): o pedaço da bacia entre a caixa e o assento, com o
//   contorno na própria cor e a sombra curta da caixa (que é a peça mais alta).
// - O ASSENTO (lugar 1, a madeira): um aro estreito em ovo, mais largo atrás, alongado de
//   trás para a frente (uma privada é mais comprida que larga; redondo e grosso, o aro com
//   a água no meio lia como um olho). A massa clara em cima à esquerda e a escura embaixo à
//   direita; o contorno é mais fino que o da família (o aro é estreito: contorno_para).
// - A BACIA por dentro (cor própria): a louça é o que mais se vê, funda: na sombra da beira
//   em cima à esquerda e acesa embaixo à direita (é côncava: o contrário de uma peça
//   levantada). A ÁGUA (cor própria) enche o fundo, um ovo menor que a boca e um pouco
//   para trás (a louça seca aparece na frente), escura e contida, sem brilho; ela também
//   escurece do lado da luz. Pequena e redonda no meio, ela lia como a íris de um olho.
// - A CAIXA de descarga (lugar 1), atrás e por cima de tudo: a tampa de uma tábua só, com
//   as massas da borda (com 2 tábuas, a caixa de 0,15 casa de fundo virava listra).
// - O PUXADOR (lugar 2, o metal): a alavanca que sai da frente da caixa, à direita, um
//   pouco aberta para fora. Por ele o desenho não é simétrico: 4 viradas.
// - Nada de cano, parafuso, dobradiça em bolinha, veio nem brilho pontilhado. A sombra no
//   chão é do app.
// A louça e a água são as do app (privada.ts: a louça é o branco x 0,93, a dos pratos), pela
// rampa OKLab da família (CONTRATO 10.5) tirada nos níveis V_*, como o lençol da cama: a
// cor própria anda como as partes tingidas.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// A louça #e2ded2 (o branco #f3efe2 x 0,93 do app) pela rampa da família, nos níveis V_*.
vec3 louca(float v) {
	const vec3 L10 = vec3(0.351, 0.336, 0.291);
	const vec3 L24 = vec3(0.489, 0.474, 0.428);
	const vec3 L36 = vec3(0.640, 0.625, 0.578);
	const vec3 L50 = vec3(0.887, 0.871, 0.824);
	const vec3 L62 = vec3(0.901, 0.886, 0.840);
	const vec3 L76 = vec3(0.919, 0.904, 0.859);
	if (v <= 0.24) {
		return mix(L10, L24, clamp((v - 0.10) / 0.14, 0.0, 1.0));
	}
	if (v <= 0.36) {
		return mix(L24, L36, (v - 0.24) / 0.12);
	}
	if (v <= 0.50) {
		return mix(L36, L50, (v - 0.36) / 0.14);
	}
	if (v <= 0.62) {
		return mix(L50, L62, (v - 0.50) / 0.12);
	}
	return mix(L62, L76, clamp((v - 0.62) / 0.14, 0.0, 1.0));
}

// A água: um verde-água acinzentado (#5a7a78, perto da poça aprovada e da água da paleta
// #40707e, sem o azul que fazia do vaso um olho), pela mesma rampa: o meio e a sombra.
const vec3 AGUA = vec3(0.354, 0.479, 0.471);
const vec3 AGUA_FUNDA = vec3(0.262, 0.392, 0.384);

// ---- A forma, no referencial da privada (casas a partir do meio; y para a frente) ----
const vec2 CAIXA_C = vec2(0.0, -0.222);   // a caixa de descarga, encostada atrás
const vec2 CAIXA_B = vec2(0.245, 0.075);
const float CAIXA_R = 0.030;
const vec2 COLO_C = vec2(0.0, -0.125);    // o colo da bacia, que entra debaixo da caixa
const vec2 COLO_B = vec2(0.100, 0.045);
const float COLO_R = 0.035;
const vec2 ASSENTO_C = vec2(0.0, 0.105);  // o assento em ovo
const vec2 ASSENTO_E = vec2(0.168, 0.190);
const float CONTORNO_DO_ASSENTO = 0.026;
const vec2 BOCA_C = vec2(0.0, 0.105);     // a boca do assento, o mesmo ovo mais estreito
const vec2 BOCA_E = vec2(0.106, 0.134);
const float LINHA_DA_BOCA = 0.011;
const float OVO = 0.14;                   // o quanto o ovo alarga atrás e afina na frente
const vec2 AGUA_C = vec2(0.0, 0.080);     // a água, o ovo da bacia menor e um pouco para trás:
const vec2 AGUA_E = vec2(0.068, 0.082);    // a louça seca aparece mais na frente
const vec2 PUXADOR_A = vec2(0.156, -0.156); // a alavanca: da frente da caixa para fora
const vec2 PUXADOR_B = vec2(0.186, -0.094);
const float PUXADOR_R = 0.021;

// As massas (casas): a clara anda isso para a luz, a escura 1,5 x para longe.
const float LUZ_DA_CAIXA = 0.022;
const float LUZ_DO_ASSENTO = 0.020;
const float SOMBRA_DA_CAIXA = 0.050; // o quanto a sombra da caixa anda no colo

// O ovo: uma elipse que alarga atrás (-y) e afina na frente (+y).
float sd_ovo(vec2 p, vec2 e) {
	p.x *= 1.0 + OVO * clamp(p.y / e.y, -1.0, 1.0);
	return sd_elipse(p, e);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir); // a luz da tela, no referencial da privada
	// A sombra curta da caixa (a peça mais alta) no que fica embaixo à direita dela.
	float sombra_da_caixa = cobre(sd_caixa(m + lm * SOMBRA_DA_CAIXA - CAIXA_C, CAIXA_B, CAIXA_R), px * 2.0);

	// 1. O colo de louça.
	float dn = sd_caixa(m - COLO_C, COLO_B, COLO_R);
	if (dn < px) {
		float co = contorno_para(COLO_B);
		pousar_cor(av, ac, louca(V_CONTORNO), cobre(dn, px));
		float dentro = cobre(dn + co, px);
		vec3 c = mix(louca(V_MEIO), louca(V_SOMBRA - 0.02), sombra_da_caixa);
		pousar_cor(av, ac, c, dentro);
	}

	// 2. O assento de madeira.
	float da = sd_ovo(m - ASSENTO_C, ASSENTO_E);
	if (da < px) {
		pousar(av, ac, V_CONTORNO, 1, cobre(da, px));
		float dentro = cobre(da + CONTORNO_DO_ASSENTO, px);
		pousar(av, ac, V_MEIO + 0.02, 1, dentro);
		float ds = sd_ovo(m - lm * LUZ_DO_ASSENTO * 1.5 - ASSENTO_C, ASSENTO_E) + CONTORNO_DO_ASSENTO;
		float dl = sd_ovo(m + lm * LUZ_DO_ASSENTO - ASSENTO_C, ASSENTO_E) + CONTORNO_DO_ASSENTO;
		pousar(av, ac, V_SOMBRA - 0.01, 1, dentro * (1.0 - cobre(ds, px)));
		pousar(av, ac, V_LUZ + 0.04, 1, dentro * (1.0 - cobre(dl, px)));
		pousar(av, ac, V_SOMBRA - 0.02, 1, dentro * sombra_da_caixa);

		// 3. A bacia por dentro e a água.
		float db = sd_ovo(m - BOCA_C, BOCA_E);
		if (db < px) {
			pousar(av, ac, V_CONTORNO, 1, cobre(db, px));
			float funda = cobre(db + LINHA_DA_BOCA, px);
			// Côncava: a beira de cima à esquerda faz sombra, a de baixo à direita pega a luz.
			float sombra = 1.0 - cobre(sd_ovo(m + lm * 0.030 - BOCA_C, BOCA_E) + LINHA_DA_BOCA, px);
			float luz = 1.0 - cobre(sd_ovo(m - lm * 0.026 - BOCA_C, BOCA_E) + LINHA_DA_BOCA, px);
			vec3 c = louca(V_MEIO);
			c = mix(c, louca(V_REALCE), luz);
			c = mix(c, louca(V_SOMBRA + 0.02), sombra);
			pousar_cor(av, ac, c, funda);
			float dw = sd_ovo(m - AGUA_C, AGUA_E);
			float na_agua = cobre(dw, px * 1.5) * funda;
			float agua_na_sombra = 1.0 - cobre(sd_ovo(m + lm * 0.022 - AGUA_C, AGUA_E), px * 2.0);
			pousar_cor(av, ac, mix(AGUA, AGUA_FUNDA, agua_na_sombra), na_agua);
		}
	}

	// 4. A caixa de descarga, por cima: a tampa de uma tábua só.
	float dc = sd_caixa(m - CAIXA_C, CAIXA_B, CAIXA_R);
	if (dc < px) {
		float co = contorno_para(CAIXA_B);
		pousar(av, ac, V_CONTORNO, 1, cobre(dc, px));
		float dentro = cobre(dc + co, px);
		pousar(av, ac, V_MEIO + 0.02, 1, dentro);
		float ds = sd_caixa(m - lm * LUZ_DA_CAIXA * 1.5 - CAIXA_C, CAIXA_B, CAIXA_R) + co;
		float dl = sd_caixa(m + lm * LUZ_DA_CAIXA - CAIXA_C, CAIXA_B, CAIXA_R) + co;
		pousar(av, ac, V_SOMBRA - 0.01, 1, dentro * (1.0 - cobre(ds, px)));
		pousar(av, ac, V_LUZ + 0.04, 1, dentro * (1.0 - cobre(dl, px)));
	}

	// 5. O puxador de metal, saindo da frente da caixa.
	float dp = sd_traco(m, PUXADOR_A, PUXADOR_B, PUXADOR_R, PUXADOR_R);
	if (dp < px) {
		float co = 0.45 * PUXADOR_R;
		pousar(av, ac, V_CONTORNO, 2, cobre(dp, px));
		float dentro = cobre(dp + co, px);
		pousar(av, ac, V_MEIO + 0.02, 2, dentro);
		float ds = sd_traco(m - lm * 0.012, PUXADOR_A, PUXADOR_B, PUXADOR_R, PUXADOR_R) + co;
		float dl = sd_traco(m + lm * 0.009, PUXADOR_A, PUXADOR_B, PUXADOR_R, PUXADOR_R) + co;
		pousar(av, ac, V_SOMBRA - 0.02, 2, dentro * (1.0 - cobre(ds, px)));
		pousar(av, ac, V_REALCE, 2, dentro * (1.0 - cobre(dl, px)));
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

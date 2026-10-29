// TAPETE LONGO desenhado que pega cor (onda 4, lote 13; CONTRATO.md seção 10).
//
// O irmão do tapete (texturas/movel-tapete/), a mesma família e a mesma régua do tecido do
// cobertor da cama: contorno grosso na própria cor, poucas massas largas, nada de fio,
// xadrez, listra fina, bordado nem franja fio por fio.
//
// - A passadeira de 1 x 4 (desenhada deitada, 4 x 1; o app troca pelo lado maior): a BARRA
//   larga em volta, mais funda, com a massa clara da borda em cima à esquerda e a escura
//   embaixo à direita; o CAMPO no meio, mais claro e um pouco fundo (a sombra curta da barra
//   na beira de cima e da esquerda); nas pontas curtas, a FRANJA de linho (cor própria), uma
//   faixa lisa.
// - O MEIO QUE REPETE (CONTRATO 10.6): pontas de 0,5 casa (a franja, a barra da ponta e um
//   pouco de campo) e um módulo por casa com UM losango do medalhão do tapete (o mesmo tom,
//   as mesmas massas e o miolo claro), a emenda no campo liso entre dois losangos. O app
//   põe um losango inteiro por casa do meio, em todo comprimento: 1 x 2 = 1, 1 x 4 = 3,
//   1 x 8 = 7; nunca sai meio losango.
// - Simétrico de lado a lado e de cima a baixo: 1 virada (a transposta faz a em pé, com a luz
//   no lugar). Um lugar só (1 = o tecido). Sem vista de lado. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RECUO = 0.012;
const float FRANJA = 0.095;
const float QUINA = 0.05;
const float BARRA = 0.15;          // mais estreita que a do tapete: a passadeira tem 1 casa
const float CO_CAMPO = 0.026;
const float LUZ_DO_PANO = 0.05;
const float SOMBRA_NO_CAMPO = 0.045;
const float V_BARRA = 0.37;
const float V_CAMPO = 0.56;
const float V_MEDALHAO = 0.37;
const float V_MIOLO = 0.68;
const vec2 MEDALHAO = vec2(0.38, 0.25);   // meias diagonais de cada losango
const float FRACAO_DO_MIOLO = 0.40;
const float CO_MEDALHAO = 0.03;
const float PONTA_MACIA = 0.025;
const float MODULOS = 3.0;                 // os módulos do desenho (o meio de 3 casas)

// A franja: o linho do app pela rampa da família (as cores do lençol da cama, lote 11).
vec3 linho(float v) {
	const vec3 L10 = vec3(0.356, 0.302, 0.162);
	const vec3 L24 = vec3(0.489, 0.434, 0.296);
	const vec3 L36 = vec3(0.628, 0.573, 0.435);
	const vec3 L50 = vec3(0.859, 0.804, 0.667);
	const vec3 L62 = vec3(0.880, 0.827, 0.692);
	const vec3 L76 = vec3(0.905, 0.854, 0.723);
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

float ndot(vec2 a, vec2 b) {
	return a.x * b.x - a.y * b.y;
}

float sd_losango(vec2 p, vec2 b) {
	p = abs(p);
	float h = clamp(ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0);
	float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
	return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}

float sd_losango_macio(vec2 p, vec2 b, float r) {
	float L = length(b);
	return sd_losango(p, b - r * vec2(L / b.y, L / b.x)) - r;
}

void medalhao(inout vec4 av, inout vec4 ac, vec2 p, vec2 b, vec2 lm, float px) {
	float d = sd_losango_macio(p, b, PONTA_MACIA);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO + 0.04, 1, cobre(d, px));
	float dentro = cobre(d + CO_MEDALHAO, px);
	pousar(av, ac, V_MEDALHAO, 1, dentro);
	pousar(av, ac, V_MEDALHAO - 0.08, 1, dentro * (1.0 - cobre(sd_losango_macio(p - lm * 0.045, b, PONTA_MACIA) + CO_MEDALHAO, px)));
	pousar(av, ac, V_MEDALHAO + 0.09, 1, dentro * (1.0 - cobre(sd_losango_macio(p + lm * 0.03, b, PONTA_MACIA) + CO_MEDALHAO, px)));
	float dm = sd_losango_macio(p, b * FRACAO_DO_MIOLO, PONTA_MACIA * 0.6);
	pousar(av, ac, V_MIOLO, 1, dentro * cobre(dm, px));
	pousar(av, ac, V_MIOLO - 0.07, 1, dentro * cobre(dm, px) * (1.0 - cobre(sd_losango_macio(p - lm * 0.025, b * FRACAO_DO_MIOLO, PONTA_MACIA * 0.6), px)));
}

void franja(inout vec4 av, inout vec4 ac, vec2 p, vec2 b, vec2 lm, float px) {
	float d = sd_caixa(p, b, 0.02);
	if (d > px) {
		return;
	}
	pousar_cor(av, ac, linho(V_CONTORNO + 0.06), cobre(d, px));
	float dentro = cobre(d + 0.03, px);
	pousar_cor(av, ac, linho(V_MEIO), dentro);
	pousar_cor(av, ac, linho(V_SOMBRA + 0.05), dentro * (1.0 - cobre(sd_caixa(p - lm * 0.045, b, 0.02) + 0.03, px)));
	pousar_cor(av, ac, linho(V_REALCE), dentro * (1.0 - cobre(sd_caixa(p + lm * 0.03, b, 0.02) + 0.03, px)));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = pegada_do_movel(vir) * 0.5;
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	vec2 hb = vec2(h.x - RECUO - FRANJA, h.y - RECUO);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		franja(av, ac, m - vec2(sx * (hb.x + FRANJA * 0.5 - 0.01), 0.0), vec2(FRANJA * 0.5 + 0.012, hb.y - 0.09), lm, px);
	}
	float db = sd_caixa(m, hb, QUINA);
	if (db > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(db, px));
	float dentro = cobre(db + CONTORNO_CASAS, px);
	pousar(av, ac, V_BARRA, 1, dentro);
	pousar(av, ac, V_BARRA - MASSA_ESCURA, 1, dentro * (1.0 - cobre(sd_caixa(m - lm * LUZ_DO_PANO * 1.5, hb, QUINA) + CONTORNO_CASAS, px)));
	pousar(av, ac, V_BARRA + MASSA_CLARA, 1, dentro * (1.0 - cobre(sd_caixa(m + lm * LUZ_DO_PANO, hb, QUINA) + CONTORNO_CASAS, px)));
	vec2 hc = hb - vec2(BARRA);
	float dc = sd_caixa(m, hc, 0.03);
	pousar(av, ac, V_CONTORNO + 0.10, 1, dentro * cobre(dc, px));
	float campo = dentro * cobre(dc + CO_CAMPO, px);
	pousar(av, ac, V_CAMPO, 1, campo);
	pousar(av, ac, V_CAMPO - 0.07, 1, campo * (1.0 - cobre(sd_caixa(m + lm * SOMBRA_NO_CAMPO, hc, 0.03) + CO_CAMPO, px)));
	// Um losango por módulo (por casa do meio), centrado nele; nada nas pontas.
	float n = round(m.x);
	if (abs(n) <= (MODULOS - 1.0) * 0.5) {
		medalhao(av, ac, vec2(m.x - n, m.y), MEDALHAO, lm, px);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

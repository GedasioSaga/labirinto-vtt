// TAPETE desenhado que pega cor (onda 4, lote 13; CONTRATO.md seção 10).
//
// Da família aprovada (lotes 9 a 12) e na régua do tecido do cobertor da cama e do toldo da
// barraca: contorno grosso na própria cor, poucas massas largas, nada de fio, xadrez,
// listra fina, bordado nem franja fio por fio.
//
// - O RETANGULAR (a forma de sempre, 3 x 2): uma BARRA larga em volta (mais funda que o
//   campo, com a massa clara da borda em cima à esquerda e a escura embaixo à direita, como
//   o pano do cobertor) e o CAMPO no meio, mais claro, um pouco fundo (a barra faz uma
//   sombra curta na beira de cima e da esquerda dele). No campo, UM medalhão em losango
//   de pontas macias, no tom da barra, com as massas dele e o miolo claro. Nas pontas
//   curtas, a FRANJA de linho (cor própria): uma faixa lisa com contorno, nunca fio por fio.
// - ESTICA nos dois eixos pelo lado maior, com o CENTRO FIXO nos dois (CONTRATO 10.6, lote
//   13): ao longo, ponta (a franja, a barra da ponta e um pouco de campo) + meio liso +
//   centro de 1,125 casa (o medalhão) + meio liso + ponta; atravessado, o mesmo com o centro
//   de 0,75. O medalhão fica inteiro e no meio em todo tamanho, e a barra corre lisa nos 4
//   lados (o meio liso é só barra reta e campo).
// - O REDONDO (variante "redondo", a forma redonda do app, 2 x 2): o disco com a barra em
//   anel, o campo e o mesmo losango, sem franja. Não estica: vira oval pela escala (o
//   medalhão acompanha, como no Atual).
// - A VISTA DE LADO (3 x 0,25; redonda 2 x 0,25): a faixa deitada no chão, a borda da barra
//   com o topo do pano aceso e a franja rente ao chão nas pontas (só a retangular).
// - Simétrico de lado a lado e de cima a baixo: 1 virada (a transposta faz a de 90 graus,
//   com a luz no lugar). Um lugar só (1 = o tecido). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RECUO = 0.012;        // o pano recuado da pegada, casas
const float FRANJA = 0.095;       // o quanto a franja sai do corpo
const float QUINA = 0.05;
const float BARRA = 0.28;         // a largura da barra (retangular)
const float BARRA_REDONDA = 0.24;
const float CO_CAMPO = 0.026;     // o contorno da beira do campo (mais fino que o de fora)
const float LUZ_DO_PANO = 0.05;   // a massa clara da borda do pano (a escura é 1,5 x)
const float SOMBRA_NO_CAMPO = 0.045;
const float V_BARRA = 0.37;
const float V_CAMPO = 0.56;
const float V_MEDALHAO = 0.37;
const float V_MIOLO = 0.68;
const vec2 MEDALHAO = vec2(0.62, 0.46);          // meias diagonais (retangular)
const vec2 MEDALHAO_REDONDO = vec2(0.50, 0.50);
const float FRACAO_DO_MIOLO = 0.40;                        // o miolo, em fração do medalhão
const float CO_MEDALHAO = 0.032;
const float PONTA_MACIA = 0.03;                  // o raio das pontas do losango

// A FRANJA: o linho do app pela rampa da família, nos níveis V_* (as mesmas cores do lençol
// da cama, aprovado no lote 11), para a cor própria andar como as partes tingidas.
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

// A distância ao losango de meias diagonais b (exata).
float sd_losango(vec2 p, vec2 b) {
	p = abs(p);
	float h = clamp(ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0);
	float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
	return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}

// O losango com as pontas macias de raio r e os lados no mesmo lugar.
float sd_losango_macio(vec2 p, vec2 b, float r) {
	float L = length(b);
	return sd_losango(p, b - r * vec2(L / b.y, L / b.x)) - r;
}

// O medalhão: o losango no tom da barra com contorno e as massas dele, e o miolo claro.
void medalhao(inout vec4 av, inout vec4 ac, vec2 p, vec2 b, vec2 lm, float px) {
	float d = sd_losango_macio(p, b, PONTA_MACIA);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO + 0.04, 1, cobre(d, px));
	float dentro = cobre(d + CO_MEDALHAO, px);
	pousar(av, ac, V_MEDALHAO, 1, dentro);
	pousar(av, ac, V_MEDALHAO - 0.08, 1, dentro * (1.0 - cobre(sd_losango_macio(p - lm * 0.05, b, PONTA_MACIA) + CO_MEDALHAO, px)));
	pousar(av, ac, V_MEDALHAO + 0.09, 1, dentro * (1.0 - cobre(sd_losango_macio(p + lm * 0.035, b, PONTA_MACIA) + CO_MEDALHAO, px)));
	float dm = sd_losango_macio(p, b * FRACAO_DO_MIOLO, PONTA_MACIA * 0.6);
	pousar(av, ac, V_MIOLO, 1, dentro * cobre(dm, px));
	pousar(av, ac, V_MIOLO - 0.07, 1, dentro * cobre(dm, px) * (1.0 - cobre(sd_losango_macio(p - lm * 0.03, b * FRACAO_DO_MIOLO, PONTA_MACIA * 0.6), px)));
}

// A franja de uma ponta (cor própria): a faixa lisa com o contorno e as massas.
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

// O retangular de cima: a franja, o corpo (a barra) com as massas, o campo e o medalhão.
void retangular(inout vec4 av, inout vec4 ac, vec2 m, vec2 h, vec2 lm, float px) {
	vec2 hb = vec2(h.x - RECUO - FRANJA, h.y - RECUO);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		franja(av, ac, m - vec2(sx * (hb.x + FRANJA * 0.5 - 0.01), 0.0), vec2(FRANJA * 0.5 + 0.012, hb.y - 0.11), lm, px);
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
	// O campo, um pouco fundo: a beira com contorno fino e a sombra curta da barra em cima à esquerda.
	vec2 hc = hb - vec2(BARRA);
	float dc = sd_caixa(m, hc, 0.035);
	pousar(av, ac, V_CONTORNO + 0.10, 1, dentro * cobre(dc, px));
	float campo = dentro * cobre(dc + CO_CAMPO, px);
	pousar(av, ac, V_CAMPO, 1, campo);
	pousar(av, ac, V_CAMPO - 0.07, 1, campo * (1.0 - cobre(sd_caixa(m + lm * SOMBRA_NO_CAMPO, hc, 0.035) + CO_CAMPO, px)));
	medalhao(av, ac, m, MEDALHAO, lm, px);
}

// O redondo de cima: o disco com a barra em anel, o campo e o losango.
void redondo(inout vec4 av, inout vec4 ac, vec2 m, vec2 h, vec2 lm, float px) {
	float R = min(h.x, h.y) - RECUO;
	float db = length(m) - R;
	if (db > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(db, px));
	float dentro = cobre(db + CONTORNO_CASAS, px);
	pousar(av, ac, V_BARRA, 1, dentro);
	pousar(av, ac, V_BARRA - MASSA_ESCURA, 1, dentro * (1.0 - cobre(length(m - lm * LUZ_DO_PANO * 1.5) - R + CONTORNO_CASAS, px)));
	pousar(av, ac, V_BARRA + MASSA_CLARA, 1, dentro * (1.0 - cobre(length(m + lm * LUZ_DO_PANO) - R + CONTORNO_CASAS, px)));
	float Rc = R - BARRA_REDONDA;
	float dc = length(m) - Rc;
	pousar(av, ac, V_CONTORNO + 0.10, 1, dentro * cobre(dc, px));
	float campo = dentro * cobre(dc + CO_CAMPO, px);
	pousar(av, ac, V_CAMPO, 1, campo);
	pousar(av, ac, V_CAMPO - 0.07, 1, campo * (1.0 - cobre(length(m + lm * SOMBRA_NO_CAMPO) - Rc + CO_CAMPO, px)));
	medalhao(av, ac, m, MEDALHAO_REDONDO, lm, px);
}

// A vista de lado: a faixa deitada no chão (a borda da barra, o topo do pano aceso) e, na
// retangular, a franja rente ao chão nas pontas.
void de_lado(inout vec4 av, inout vec4 ac, vec2 m, vec2 h, bool com_franja, vec2 lm, float px) {
	float alto = 0.055;
	float base = h.y - RECUO;
	vec2 hb = vec2(h.x - RECUO - (com_franja ? FRANJA : 0.0), alto);
	vec2 c = vec2(0.0, base - alto);
	if (com_franja) {
		for (int i = 0; i < 2; i++) {
			float sx = i == 0 ? -1.0 : 1.0;
			franja(av, ac, m - vec2(sx * (hb.x + FRANJA * 0.5 - 0.01), base - 0.02), vec2(FRANJA * 0.5 + 0.012, 0.02), lm, px);
		}
	}
	float r = com_franja ? 0.03 : 0.05;
	float db = sd_caixa(m - c, hb, r);
	if (db > px) {
		return;
	}
	float co = contorno_para(hb);
	pousar(av, ac, V_CONTORNO, 1, cobre(db, px));
	float dentro = cobre(db + co, px);
	pousar(av, ac, V_BARRA, 1, dentro);
	// O avesso de baixo, na sombra (o ponto andado para baixo sai da faixa), e o topo do pano aceso.
	pousar(av, ac, V_BARRA - MASSA_ESCURA, 1, dentro * (1.0 - cobre(sd_caixa(m - c + vec2(0.0, 0.03), hb, r) + co, px)));
	pousar(av, ac, V_BARRA + 0.15, 1, dentro * (1.0 - cobre(sd_caixa(m - c - vec2(0.0, 0.028), hb, r) + co, px)));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = pegada_do_movel(vir) * 0.5;
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	if (vis == 1) {
		de_lado(av, ac, m, h, qual != 0, lm, px);
		return;
	}
	if (qual == 0) {
		redondo(av, ac, m, h, lm, px);
		return;
	}
	retangular(av, ac, m, h, lm, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

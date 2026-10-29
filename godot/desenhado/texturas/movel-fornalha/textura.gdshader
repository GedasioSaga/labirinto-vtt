// FORNALHA de ferreiro desenhada que pega cor (onda 4, lote 15; CONTRATO.md seção 10). A forja
// da oficina, vista de cima; a frente é o lado de baixo (o ferreiro trabalha de frente para
// ela). Da mesma família da lareira (texturas/movel-lareira/), do poço e da pia aprovados.
//
// Contorno grosso na própria cor, formas grandes, a luz de cima à esquerda em poucas massas,
// nada de risquinho, bolinha ou grão. A disposição é a do app (lib/mobilia/fogoDeCasa.ts,
// FORNALHA, em fração da pegada de 1,5 x 1,5): é dela que a chama animada lê onde nascer. De
// baixo para cima:
// - A BANCADA de pedra (lugar 1): a borda alta em 6 BLOCOS grandes em volta do leito (o da
//   frente e os dos cantos seguram a borda, os dos lados fecham), como a boca do poço e a
//   cuba da pia: a RECEITA DA PEDRA do poço (o tom V_MEIO + 0,05 com um tom próprio por
//   bloco, as massas pela forma andada para a luz e para longe dela, a junta de 0,022 casa
//   em V_FUNDO + 0,02, o contorno da família por fora e na boca do leito).
// - O LEITO de cinza (cor própria) afundado na borda: a beira de cima à esquerda faz sombra
//   nele, e a coifa também.
// - O FOGAREIRO: um anel de 5 CARVÕES grandes (cor própria, o carvão do app), cada um com o
//   contorno e as massas, em volta do MIOLO: ACESO (a variante "aceso", a padrão), a brasa
//   numa forma só em 3 tons contidos; APAGADO ("apagado", o que o painel grava em
//   mobiliaForma), a cinza fria.
// - A COIFA da chaminé (lugar 1) no fundo, por cima da borda de trás: 2 blocos com a boca
//   escura no meio; é o que mais sobe e faz sombra (valor) na bancada.
// - O FOLE à esquerda: o couro (cor própria, o do app) em gota, a tábua de cima (lugar 2, a
//   madeira) e o cabo ao longo dela, e o bico de ferro (cor própria) passando pela borda até
//   o carvão.
// A CHAMA ANIMADA e o HALO quente não entram na imagem: são do app, por cima (a língua nasce
// em (0,15; 0,195) casas do meio, no miolo). Duas viradas (a memória: 4 x 2 formas de 1,5
// casa passam do teto de 3 MiB): nas de 90 e 270 graus a imagem é a transposta, o fole troca
// de lado, e a chama do app tem de nascer no fogareiro espelhado (o x da língua troca de
// sinal no referencial do móvel). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As cores próprias ----
// O carvão frio do app (fogoDeCasa.ts, CARVAO_FRIO #3e332c) e o couro do fole (fornalha.ts, #6a4c38).
const vec3 CARVAO = vec3(0.243, 0.200, 0.173);
const vec3 COURO = vec3(0.416, 0.298, 0.220);
// As brasas da fogueira do app (BRASA_VIVA, BRASA_QUENTE) e o miolo, o laranja do fogo do
// Meio-Termo (#e39446, a brasa do fogão aprovado). As mesmas da lareira.
const vec3 BRASA_VIVA = vec3(0.588, 0.322, 0.243);
const vec3 BRASA_QUENTE = vec3(0.769, 0.510, 0.322);
const vec3 BRASA_MIOLO = vec3(0.890, 0.580, 0.275);
// A cinza (o granito da paleta, #9a968b) e o ferro do bico (MATERIAIS.ferro, #4c4e51).
const vec3 CINZA_CLARA = vec3(0.604, 0.588, 0.545);
const vec3 FERRO_DO_BICO = vec3(0.298, 0.306, 0.318);
const vec3 BRILHO_DO_FERRO = vec3(0.80, 0.81, 0.82);

// ---- A disposição (casas, no referencial da fornalha: x e y de -0,75 a 0,75) ----
const vec2 BANCADA_C = vec2(0.1575, 0.075);
const vec2 BANCADA_B = vec2(0.5625, 0.615);
const float BEIRA = 0.185;             // a largura da borda de pedra
const float QUINA_DO_LEITO = 0.08;
const float CONTORNO_DO_LEITO = 0.02;  // o contorno na boca do leito
const vec2 COIFA_C = vec2(0.15, -0.54);
const vec2 COIFA_B = vec2(0.315, 0.205);
const vec2 BOCA_C = vec2(0.15, -0.555);
const vec2 BOCA_B = vec2(0.13, 0.075);
const vec2 FOGO = vec2(0.15, 0.15);    // FORNALHA.fogareiro (0,1; 0,1) da pegada
const float R_ANEL = 0.175;            // a distância do meio de cada carvão ao fogo
const vec2 CARVAO_B = vec2(0.112, 0.088);
const float R_MIOLO = 0.13;
// O fole: a gota de couro, a tábua e o bico.
const float FOLE_Y = 0.15;
const vec2 FOLE_A = vec2(-0.47, 0.15); // o meio da ponta larga
const vec2 FOLE_B = vec2(-0.33, 0.15); // o da ponta fina
const float FOLE_RA = 0.27;
const float FOLE_RB = 0.075;
const float TABUA = 0.04;              // o quanto a tábua é menor que o couro

// ---- A pedra ----
const int BLOCOS = 6;
const float JUNTA = 0.011;
const float LUZ_DA_PEDRA = 0.032;
const float SOMBRA_DA_COIFA = 0.2;
const float SOMBRA_DA_BEIRA = 0.075;

float smax(float a, float b, float k) {
	float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) + k * h * (1.0 - h);
}

float na_sombra(float d) {
	return 1.0 - smoothstep(-0.02, 0.02, d);
}

// A peça talhada: a caixa de lados um pouco abaulados (raio A; grande = quase reto).
float sd_talhada(vec2 p, vec2 b, float A, float quina) {
	float dx = length(vec2(abs(p.x) - b.x + A, p.y)) - A;
	float dy = length(vec2(p.x, abs(p.y) - b.y + A)) - A;
	return smax(dx, dy, quina);
}

float sd_bancada(vec2 m) {
	return sd_talhada(m - BANCADA_C, BANCADA_B, 6.0, 0.06);
}

float sd_leito(vec2 m) {
	return sd_caixa(m - BANCADA_C, BANCADA_B - vec2(BEIRA), QUINA_DO_LEITO);
}

float sd_coifa(vec2 m) {
	return sd_talhada(m - COIFA_C, COIFA_B, 4.0, 0.05);
}

// ---- Os 6 blocos da borda (como a cuba da pia): o ângulo de cada junta (graus, de x
// para y, do meio da bancada) e o quanto ela entorta (rad) ----
float angulo_da_junta(int k) {
	float a[6] = float[6](-40.0, 25.0, 75.0, 118.0, 165.0, 215.0);
	return radians(a[k % BLOCOS]) + (k >= BLOCOS ? 6.2831853 : 0.0);
}

float torto_da_junta(int k) {
	float t[6] = float[6](0.09, -0.08, 0.10, -0.07, 0.08, -0.10);
	return t[k % BLOCOS];
}

float tom_do_bloco(int i) {
	float t[6] = float[6](0.035, -0.02, 0.04, -0.035, 0.015, -0.01);
	return t[i];
}

// Onde a junta k cruza o meio da borda (o raio do meio da bancada no ângulo dela).
vec2 meio_da_junta(int k) {
	float a = angulo_da_junta(k);
	vec2 u = vec2(cos(a), sin(a));
	vec2 b = BANCADA_B - vec2(0.5 * BEIRA);
	float t = min(b.x / max(abs(u.x), 1e-4), b.y / max(abs(u.y), 1e-4));
	return u * t;
}

float lado_da_junta(vec2 p, int k, float lado) {
	vec2 c = meio_da_junta(k);
	float b = angulo_da_junta(k) + torto_da_junta(k);
	vec2 u = vec2(cos(b), sin(b));
	float cr = u.x * (p.y - c.y) - u.y * (p.x - c.x);
	return -lado * cr;
}

float sd_bloco(vec2 m, int i) {
	vec2 p = m - BANCADA_C;
	float d = max(sd_bancada(m) + CONTORNO_CASAS, CONTORNO_DO_LEITO - sd_leito(m));
	d = smax(d, lado_da_junta(p, i, 1.0) + JUNTA, 0.012);
	return smax(d, lado_da_junta(p, i + 1, -1.0) + JUNTA, 0.012);
}

void desenhar_bancada(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_bancada(m);
	if (d > px) {
		return;
	}
	float sc = na_sombra(sd_coifa(m + lm * SOMBRA_DA_COIFA));
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	pousar(av, ac, V_FUNDO + 0.02 - 0.04 * sc, 1, cobre(max(d + CONTORNO_CASAS, CONTORNO_DO_LEITO - sd_leito(m)), px));
	for (int i = 0; i < BLOCOS; i++) {
		float db = sd_bloco(m, i);
		if (db > px) {
			continue;
		}
		float dentro = cobre(db, px);
		float v = V_MEIO + 0.05 + tom_do_bloco(i);
		pousar(av, ac, v - 0.12 * sc, 1, dentro);
		float esc = dentro * (1.0 - cobre(sd_bloco(m - lm * LUZ_DA_PEDRA * 1.5, i), px));
		pousar(av, ac, v - MASSA_ESCURA - 0.02 - 0.08 * sc, 1, esc);
		float cla = dentro * (1.0 - cobre(sd_bloco(m + lm * LUZ_DA_PEDRA, i), px));
		pousar(av, ac, v + MASSA_CLARA - 0.13 * sc, 1, cla);
	}
}

// O leito de cinza, afundado: a beira de cima à esquerda e a coifa fazem sombra nele.
void desenhar_leito(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_leito(m);
	if (d > px) {
		return;
	}
	float s = 1.0 - smoothstep(-0.015, 0.015, sd_leito(m + lm * SOMBRA_DA_BEIRA) * -1.0);
	s = max(s, na_sombra(sd_coifa(m + lm * SOMBRA_DA_COIFA)));
	// O pó de carvão no fundo, cinza quente e escuro: a cinza clara lia como uma bandeja.
	vec3 fundo = mix(CINZA_CLARA, CARVAO, 0.42);
	// A parede de baixo à direita do leito olha para a luz (como a cuba da pia).
	float luz = 1.0 - cobre(sd_leito(m - lm * 0.04), px);
	vec3 cor = fundo * mix(1.0, 1.16, luz) * mix(1.0, 0.7, s);
	pousar_cor(av, ac, cor, cobre(d - CONTORNO_DO_LEITO * 0.5, px));
}

// Os 6 carvões do monte, grandes, de tamanhos e vãos diferentes (um anel certinho lia como
// flor): o meio de cada um em volta do fogo, a meia medida e o giro.
vec4 carvao(int i) {
	if (i == 0) {
		return vec4(-0.175, -0.06, 0.105, 0.5);
	}
	if (i == 1) {
		return vec4(-0.02, -0.175, 0.12, -0.25);
	}
	if (i == 2) {
		return vec4(0.165, -0.105, 0.085, 0.95);
	}
	if (i == 3) {
		return vec4(0.19, 0.075, 0.11, 1.75);
	}
	if (i == 4) {
		return vec4(0.035, 0.185, 0.125, 0.12);
	}
	return vec4(-0.165, 0.125, 0.085, -0.7);
}

float sd_carvao(vec2 m, int i) {
	vec4 c = carvao(i);
	vec2 p = girar(m - FOGO - c.xy, -c.w);
	return sd_caixa(p, vec2(c.z, c.z * 0.74), c.z * 0.55);
}

void desenhar_carvoes(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, bool aceso, float px) {
	if (length(m - FOGO) > R_ANEL + 0.2) {
		return;
	}
	float sc = na_sombra(sd_coifa(m + lm * SOMBRA_DA_COIFA));
	for (int i = 0; i < 6; i++) {
		float d = sd_carvao(m, i);
		if (d > px) {
			continue;
		}
		float co = 0.024;
		// A beira de dentro de cada carvão, que olha para o miolo, pega a brasa quando aceso.
		vec3 escura = aceso ? mix(CARVAO * 0.78, BRASA_VIVA * 0.85, 0.7) : CARVAO * 0.76;
		pousar_cor(av, ac, CARVAO * 0.6, cobre(d, px));
		float dentro = cobre(d + co, px);
		pousar_cor(av, ac, CARVAO * (1.0 - 0.15 * sc), dentro);
		pousar_cor(av, ac, escura, dentro * (1.0 - cobre(sd_carvao(m - lm * 0.036, i) + co, px)));
		pousar_cor(av, ac, CARVAO * (1.55 - 0.3 * sc), dentro * (1.0 - cobre(sd_carvao(m + lm * 0.024, i) + co, px)));
	}
}

// O miolo do fogareiro: aceso, a brasa em 3 tons; apagado, a cinza fria com o carvão em volta.
float sd_miolo(vec2 m) {
	vec2 p = m - FOGO;
	return sd_elipse(p, vec2(R_MIOLO * 1.08, R_MIOLO)) + 0.012 * sin(atan(p.y, p.x) * 3.0);
}

void desenhar_miolo(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, bool aceso, float px) {
	float d = sd_miolo(m);
	if (d > px) {
		return;
	}
	if (aceso) {
		pousar_cor(av, ac, BRASA_VIVA * 0.66, cobre(d, px));
		float dentro = cobre(d + 0.02, px);
		pousar_cor(av, ac, BRASA_VIVA, dentro);
		pousar_cor(av, ac, BRASA_QUENTE, dentro * cobre(d + 0.045, px));
		pousar_cor(av, ac, BRASA_MIOLO, dentro * cobre(sd_elipse(m - FOGO - vec2(0.0, 0.03), vec2(0.07, 0.055)), px));
		return;
	}
	pousar_cor(av, ac, CINZA_CLARA * 0.55, cobre(d, px));
	float dentro = cobre(d + 0.02, px);
	pousar_cor(av, ac, CINZA_CLARA * 0.86, dentro);
	pousar_cor(av, ac, CINZA_CLARA * 0.7, dentro * (1.0 - cobre(sd_miolo(m - lm * 0.04) + 0.02, px)));
	pousar_cor(av, ac, CINZA_CLARA * 1.02, dentro * (1.0 - cobre(sd_miolo(m + lm * 0.028) + 0.02, px)));
}

void desenhar_coifa(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_coifa(m);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	pousar(av, ac, V_FUNDO + 0.02, 1, cobre(d + CONTORNO_CASAS, px));
	// 2 blocos, a junta um pouco torta, à direita da boca.
	vec2 p = m - COIFA_C;
	vec2 n = vec2(cos(0.12), -sin(0.12));
	for (int i = 0; i < 2; i++) {
		float lado = i == 0 ? 1.0 : -1.0;
		float dj = lado * dot(p - vec2(0.2, 0.0), n) + JUNTA;
		float db = smax(sd_coifa(m) + CONTORNO_CASAS, dj, 0.012);
		if (db > px) {
			continue;
		}
		float dentro = cobre(db, px);
		float v = V_MEIO + 0.05 + (i == 0 ? 0.03 : -0.03);
		pousar(av, ac, v, 1, dentro);
		vec2 pe = m - lm * LUZ_DA_PEDRA * 1.5;
		float de = smax(sd_coifa(pe) + CONTORNO_CASAS, lado * dot(pe - COIFA_C - vec2(0.2, 0.0), n) + JUNTA, 0.012);
		pousar(av, ac, v - MASSA_ESCURA - 0.02, 1, dentro * (1.0 - cobre(de, px)));
		vec2 pl = m + lm * LUZ_DA_PEDRA;
		float dl = smax(sd_coifa(pl) + CONTORNO_CASAS, lado * dot(pl - COIFA_C - vec2(0.2, 0.0), n) + JUNTA, 0.012);
		pousar(av, ac, v + MASSA_CLARA, 1, dentro * (1.0 - cobre(dl, px)));
	}
	// A boca escura da chaminé; a parede de baixo à direita olha para a luz.
	float dbo = sd_caixa(m - BOCA_C, BOCA_B, 0.03);
	if (dbo > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(dbo, px));
	float dentro = cobre(dbo + 0.016, px);
	float luz = 1.0 - cobre(sd_caixa(m - BOCA_C - lm * 0.035, BOCA_B, 0.03) + 0.016, px);
	pousar(av, ac, V_FUNDO - 0.08, 1, dentro);
	pousar(av, ac, V_SOMBRA - 0.04, 1, dentro * luz);
}

// O couro em sanfona: a gota, com 3 dobras largas de cada lado (as pregas do fole, vistas
// de cima, saem para fora da tábua entre as ripas).
float sd_couro(vec2 m) {
	float d = sd_traco(m, FOLE_A, FOLE_B, FOLE_RA, FOLE_RB);
	vec2 p = m - FOLE_A;
	float a = atan(p.y, -p.x);
	float dobra = 0.5 + 0.5 * cos(a * 6.0);
	return d + 0.022 * dobra * smoothstep(0.08, 0.2, length(p));
}

float sd_tabua(vec2 m) {
	return sd_traco(m, FOLE_A + vec2(0.01, 0.0), FOLE_B, FOLE_RA - TABUA, FOLE_RB - 0.03);
}

// Uma peça de ferro (cor própria): o contorno e a faixa clara pela luz da tela.
void desenhar_bico(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	vec2 a = vec2(-0.36, FOLE_Y);
	vec2 b = vec2(-0.13, FOLE_Y);
	float d = sd_traco(m, a, b, 0.036, 0.028);
	if (d > px) {
		return;
	}
	pousar_cor(av, ac, FERRO_DO_BICO * 0.55, cobre(d, px));
	float dentro = cobre(d + 0.014, px);
	pousar_cor(av, ac, FERRO_DO_BICO, dentro);
	pousar_cor(av, ac, sombra_de(FERRO_DO_BICO) * 0.85, dentro * (1.0 - cobre(sd_traco(m - lm * 0.02, a, b, 0.036, 0.028) + 0.014, px)));
	pousar_cor(av, ac, mix(FERRO_DO_BICO, BRILHO_DO_FERRO, 0.3), dentro * (1.0 - cobre(sd_traco(m + lm * 0.014, a, b, 0.036, 0.028) + 0.014, px)));
}

void desenhar_fole(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, int v, float px) {
	float d = sd_couro(m);
	if (d > px) {
		return;
	}
	// O couro: a gota inteira, com as massas (o couro é fosco: a clara é curta).
	pousar_cor(av, ac, COURO * 0.6, cobre(d, px));
	float dentro = cobre(d + CONTORNO_CASAS, px);
	pousar_cor(av, ac, COURO, dentro);
	pousar_cor(av, ac, sombra_de(COURO) * 0.88, dentro * (1.0 - cobre(sd_couro(m - lm * 0.05) + CONTORNO_CASAS, px)));
	pousar_cor(av, ac, realce_de(COURO), dentro * (1.0 - cobre(sd_couro(m + lm * 0.03) + CONTORNO_CASAS, px)));
	// A tábua de cima (a madeira), com o contorno e as massas da família.
	float dt = sd_tabua(m);
	if (dt <= px) {
		float co = 0.03;
		pousar(av, ac, V_CONTORNO, 2, cobre(dt, px));
		float dd = cobre(dt + co, px);
		pousar(av, ac, V_MEIO, 2, dd);
		pousar(av, ac, V_MEIO - MASSA_ESCURA, 2, dd * (1.0 - cobre(sd_tabua(m - lm * 0.05) + co, px)));
		pousar(av, ac, V_MEIO + MASSA_CLARA, 2, dd * (1.0 - cobre(sd_tabua(m + lm * 0.034) + co, px)));
	}
	// O cabo atravessado na ponta larga, por onde o ferreiro puxa.
	vec2 c0 = vec2(-0.625, FOLE_Y - 0.115);
	vec2 c1 = vec2(-0.625, FOLE_Y + 0.115);
	float dc = sd_traco(m, c0, c1, 0.04, 0.034);
	if (dc <= px) {
		float co = 0.022;
		pousar(av, ac, V_CONTORNO, 2, cobre(dc, px));
		float dd = cobre(dc + co, px);
		pousar(av, ac, V_MEIO - 0.04, 2, dd);
		pousar(av, ac, V_MEIO - 0.04 - MASSA_ESCURA, 2, dd * (1.0 - cobre(sd_traco(m - lm * 0.022, c0, c1, 0.04, 0.034) + co, px)));
		pousar(av, ac, V_MEIO - 0.04 + MASSA_CLARA, 2, dd * (1.0 - cobre(sd_traco(m + lm * 0.016, c0, c1, 0.04, 0.034) + co, px)));
	}
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	bool aceso = qual == 1;
	desenhar_bancada(av, ac, m, lm, px);
	desenhar_leito(av, ac, m, lm, px);
	desenhar_miolo(av, ac, m, lm, aceso, px);
	desenhar_carvoes(av, ac, m, lm, aceso, px);
	desenhar_coifa(av, ac, m, lm, px);
	desenhar_bico(av, ac, m, lm, px);
	desenhar_fole(av, ac, m, lm, vir, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

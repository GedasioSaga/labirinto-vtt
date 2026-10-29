// BIGORNA de ferro num toco, desenhada que pega cor (onda 4, lote 16; CONTRATO.md seção 10).
//
// Vista de cima, da família aprovada e com o metal do fogão e do barril: o contorno grosso
// na cor do material, massas largas e um realce calmo, a luz de cima à esquerda em toda
// virada. Deitada ao comprido, o chifre para a esquerda (como no app). De baixo para cima:
// - O TOCO (lugar 2, a madeira): um disco que enche a altura da pegada, debaixo da cintura
//   da bigorna. A CASCA em volta é cor própria ("corFixa", os tons da casca do tronco caído
//   da onda 3), acesa em cima à esquerda; o corte fica um nada andado para a luz, então a
//   casca aparece mais larga embaixo à direita (o lado do toco que se vê). No corte, como
//   no tronco caído: a borda clara (o alburno) e 2 anéis largos, um pouco fora do centro.
//   A bigorna, mais alta, faz sombra (valor) no corte e na casca, embaixo à direita.
// - Os PÉS (lugar 1, ferro ou o metal do mestre): a base debaixo da mesa, com um arco
//   largo entre os pés de cada lado, então só as 4 quinas saem da mesa, em 4 lóbulos
//   calmos; um tom abaixo do ferro, a beira de cima à esquerda acesa e a sombra da mesa
//   caindo neles embaixo à direita. O toco aparece nos arcos, com os anéis.
// - O CHIFRE (lugar 1): um cone de perfil cheio, afinando até a ponta; a luz anda pela
//   seção (aceso na borda que olha para a luz, escuro na outra), em tons de borda firme,
//   como a vara do fogão.
// - O DEGRAU: o pescoço entre o chifre e a mesa, mais estreito que ela (a mesa tem ombro).
// - A MESA de aço: a parte mais clara, com a massa clara e a escura do fogão e um realce
//   calmo, uma metade acesa cortada na diagonal da luz; o calcanhar afina um nada na ponta
//   da direita, com o furo quadrado (uma massa escura só; nada do furo redondo).
// Nada de rebite, risquinho nem granulado. Não é simétrica de lado a lado (o chifre de um
// lado só): 4 viradas. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// A casca do tronco caído (texturas/tronco-caido: CASCA_LUZ, CASCA_SOMBRA, CASCA_CONTORNO).
const vec3 CASCA_LUZ = vec3(0.486, 0.361, 0.243);      // #7c5c3e
const vec3 CASCA_SOMBRA = vec3(0.345, 0.251, 0.173);   // #583f2c
const vec3 CASCA_CONTORNO = vec3(0.243, 0.176, 0.122); // #3e2d1f

// ---- As medidas, em casas, no referencial da bigorna (x ao longo, o chifre em -x) ----
const vec2 TOCO = vec2(0.11, 0.0);
const float R_TOCO = 0.245;
const float CORTE_ANDA = 0.010;          // o quanto o corte anda para a luz
const float R_CORTE = 0.197;             // o raio do corte (a casca é o resto)
const float CONTORNO_DA_CASCA = 0.024;    // mais fino que o da família: a casca é estreita
const float BEIRA_DO_CORTE = 0.012;      // a junta firme entre a casca e o corte
const vec2 CENTRO_DOS_ANEIS = vec2(0.014, 0.009);   // o centro dos anéis, fora do centro do corte
const float ANEL_1 = 0.84;               // as divisas dos anéis, em frações de R_CORTE
const float ANEL_2 = 0.68;
const float ANEL_3 = 0.40;

const float X_PONTA = -0.47;
const float X_BASE_DO_CHIFRE = -0.19;
const float R_PONTA = 0.010;
const float MEIA_DO_CHIFRE = 0.078;
const float CONTORNO_DO_CHIFRE = 0.034;

// O degrau é o pescoço: mais estreito que a mesa, para ela ter ombro.
const vec2 DEGRAU_C = vec2(-0.155, 0.0);
const vec2 DEGRAU_B = vec2(0.062, 0.078);
const float QUINA_DO_DEGRAU = 0.016;

const float X_MESA_0 = -0.105;
const float X_MESA_1 = 0.458;
const float MEIA_DA_MESA = 0.118;
const float MEIA_DO_CALCANHAR = 0.092;
const float QUINA_DA_MESA = 0.03;
const float LUZ_DA_MESA = 0.032;   // a largura da massa clara da mesa
const float ESCURO_DA_MESA = 0.046; // a da massa escura
const vec2 REALCE_EM = vec2(0.075, 0.0); // por onde passa a divisa do realce
const float REALCE = 0.06;         // o quanto a metade acesa sobe

// A base: os 4 pés saem por baixo da mesa nas quinas; entre os pés de cada lado, o arco.
const vec2 BASE_C = vec2(0.12, 0.0);
const vec2 BASE_B = vec2(0.185, 0.172);
const float QUINA_DA_BASE = 0.05;
const vec2 ARCO = vec2(0.105, 0.075);
const float Y_ARCO = 0.19;
const float LUZ_DOS_PES = 0.03;
const float SOMBRA_NOS_PES = 0.035; // o quanto a sombra da mesa anda nos pés

const vec2 FURO = vec2(0.375, 0.0);
const float MEIO_FURO = 0.027;

const vec2 DIR_DA_SOMBRA = vec2(0.5369, 0.8437); // (7, 11) normalizado: a direção da do app
const float SOMBRA_NO_TOCO = 0.05;               // o quanto a sombra da bigorna anda no toco

// ---- As formas ----

float meia_do_chifre(float x) {
	float t = clamp((x - X_PONTA) / (X_BASE_DO_CHIFRE - X_PONTA), 0.0, 1.0);
	return R_PONTA + (MEIA_DO_CHIFRE - R_PONTA) * (1.0 - pow(1.0 - t, 1.7));
}

float inclinacao_do_chifre(float x) {
	return (meia_do_chifre(x + GRAD_E) - meia_do_chifre(x - GRAD_E)) / (2.0 * GRAD_E);
}

float sd_chifre(vec2 p) {
	if (p.x < X_PONTA) {
		return length(p - vec2(X_PONTA, 0.0)) - R_PONTA;
	}
	float w = meia_do_chifre(p.x);
	float k = inclinacao_do_chifre(p.x);
	float d = (abs(p.y) - w) / sqrt(1.0 + k * k);
	return max(d, p.x - X_BASE_DO_CHIFRE);
}

float sd_mesa(vec2 p) {
	float meio = 0.5 * (X_MESA_0 + X_MESA_1);
	float meia_x = 0.5 * (X_MESA_1 - X_MESA_0);
	float meia_y = mix(MEIA_DA_MESA, MEIA_DO_CALCANHAR, smoothstep(0.24, X_MESA_1, p.x));
	return sd_caixa(p - vec2(meio, 0.0), vec2(meia_x, meia_y), QUINA_DA_MESA);
}

float sd_degrau(vec2 p) {
	return sd_caixa(p - DEGRAU_C, DEGRAU_B, QUINA_DO_DEGRAU);
}

float sd_bigorna(vec2 p) {
	return min(min(sd_chifre(p), sd_degrau(p)), sd_mesa(p));
}

float sd_base(vec2 p) {
	vec2 b = p - BASE_C;
	float d = sd_caixa(b, BASE_B, QUINA_DA_BASE);
	float arco = sd_elipse(vec2(b.x, abs(b.y) - Y_ARCO), ARCO);
	return max(d, -arco);
}

// Os pés: mais baixos que a mesa, no escuro dela; a beira de cima à esquerda acesa e a
// sombra da mesa caindo neles embaixo à direita.
void desenhar_pes(inout vec4 av, inout vec4 ac, vec2 m, vec2 q, vec2 lm, int v, float px) {
	float d = sd_base(m);
	if (d > px) {
		return;
	}
	float co = CONTORNO_CASAS * 0.75;
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + co, px);
	float sombra = cobre(sd_mesa(movel_de(q - DIR_DA_SOMBRA * SOMBRA_NOS_PES, v)), px * 1.5);
	float tom = V_MEIO - 0.05;
	pousar(av, ac, tom, 1, dentro);
	float dl = sd_base(m + lm * LUZ_DOS_PES) + co;
	pousar(av, ac, tom + MASSA_CLARA, 1, dentro * (1.0 - cobre(dl, px)));
	pousar(av, ac, V_SOMBRA - 0.03, 1, dentro * sombra);
}

// ---- As partes ----

// O toco, na tela (é redondo): a casca (cor própria), o corte com os anéis (lugar 2) e a
// sombra da bigorna por cima dos dois.
void desenhar_toco(inout vec4 av, inout vec4 ac, vec2 q, int v, float px) {
	vec2 ct = tela_de(TOCO, v);
	vec2 p = q - ct;
	float r = length(p);
	float d = r - R_TOCO;
	if (d > px) {
		return;
	}
	// A sombra da bigorna: o ponto que, andado de volta para a luz, cai dentro dela.
	float sombra = cobre(sd_bigorna(movel_de(q - DIR_DA_SOMBRA * SOMBRA_NO_TOCO, v)), px * 2.0);
	// A casca: o contorno e o recheio, aceso em cima à esquerda.
	float l = dot(p / max(r, 1e-5), LUZ);
	pousar_cor(av, ac, CASCA_CONTORNO, cobre(d, px));
	vec3 casca = mix(CASCA_SOMBRA, CASCA_LUZ, smoothstep(-0.2, 0.25, l));
	casca = mix(casca, CASCA_CONTORNO, 0.55 * sombra);
	pousar_cor(av, ac, casca, cobre(d + CONTORNO_DA_CASCA, px));
	// O corte: a junta firme, o alburno claro e os 2 anéis largos.
	vec2 pc = p - LUZ * CORTE_ANDA;
	float dc = length(pc) - R_CORTE;
	pousar(av, ac, V_SOMBRA - 0.06, 2, cobre(dc, px));
	float no_corte = cobre(dc + BEIRA_DO_CORTE, px);
	float ra = length(movel_de(pc, v) - CENTRO_DOS_ANEIS);
	float val = V_MEIO + 0.11;
	val = mix(val, V_MEIO + 0.01, cobre(ra - R_CORTE * ANEL_1, px));
	val = mix(val, V_MEIO - 0.08, cobre(ra - R_CORTE * ANEL_2, px));
	val = mix(val, V_MEIO - 0.01, cobre(ra - R_CORTE * ANEL_3, px));
	val -= 0.15 * sombra;
	pousar(av, ac, val, 2, no_corte);
}

// O chifre: o contorno e a luz pela seção, em três tons de borda firme.
void desenhar_chifre(inout vec4 av, inout vec4 ac, vec2 m, int v, float px) {
	float d = sd_chifre(m);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float w = meia_do_chifre(m.x);
	float co = min(CONTORNO_DO_CHIFRE, 0.45 * w);
	float dentro = cobre(d + co, px);
	// A seção: s = -1 na borda de cima, 1 na de baixo; o cone olha um pouco para a ponta.
	float s = clamp(m.y / max(w - co, 1e-3), -1.0, 1.0);
	float l = dot(tela_de(vec2(-0.25, s), v), LUZ) / 0.7071;
	float valor = mix(V_SOMBRA - 0.02, V_MEIO, smoothstep(-0.42, -0.26, l));
	valor = mix(valor, V_LUZ + 0.05, smoothstep(0.52, 0.68, l));
	pousar(av, ac, valor, 1, dentro);
}

// A mesa: a fresta em volta (o contorno), o aço claro, a metade acesa na diagonal da luz,
// a massa escura embaixo à direita, a clara em cima à esquerda e o furo quadrado.
void desenhar_mesa(inout vec4 av, inout vec4 ac, vec2 m, vec2 q, vec2 lm, int v, float px) {
	float d = sd_mesa(m);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CONTORNO_CASAS, px);
	float tom = V_LUZ + 0.02;
	pousar(av, ac, tom, 1, dentro);
	// O realce calmo: a metade da mesa do lado da luz, cortada na diagonal (na tela).
	float divisa = dot(q - tela_de(REALCE_EM, v), LUZ);
	pousar(av, ac, tom + REALCE, 1, dentro * cobre(-divisa, px * 1.5));
	float ds = sd_mesa(m - lm * ESCURO_DA_MESA) + CONTORNO_CASAS;
	float dl = sd_mesa(m + lm * LUZ_DA_MESA) + CONTORNO_CASAS;
	pousar(av, ac, tom - MASSA_ESCURA - 0.02, 1, dentro * (1.0 - cobre(ds, px)));
	pousar(av, ac, V_REALCE + 0.07, 1, dentro * (1.0 - cobre(dl, px)));
	// O furo quadrado: a boca escura e a parede do fundo acesa (a de baixo à direita).
	vec2 pf = m - FURO;
	float df = sd_caixa(pf, vec2(MEIO_FURO), 0.006);
	float no_furo = cobre(df, px);
	pousar(av, ac, V_FUNDO - 0.06, 1, no_furo);
	float acesa = 1.0 - cobre(sd_caixa(pf - lm * 0.012, vec2(MEIO_FURO), 0.006), px);
	pousar(av, ac, V_SOMBRA - 0.02, 1, no_furo * acesa);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	desenhar_toco(av, ac, q, vir, px);
	desenhar_pes(av, ac, m, q, lm, vir, px);
	desenhar_chifre(av, ac, m, vir, px);
	desenhar_caixa(av, ac, m, DEGRAU_C, DEGRAU_B, QUINA_DO_DEGRAU, V_MEIO - 0.02, 0.024, 1, vir, px);
	desenhar_mesa(av, ac, m, q, lm, vir, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

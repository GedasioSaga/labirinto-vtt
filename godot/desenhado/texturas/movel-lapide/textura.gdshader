// LÁPIDE desenhada que pega cor (onda 4, lote 15; CONTRATO.md seção 10).
//
// Da família aprovada (piloto, lotes 10 a 13): contorno grosso na própria cor, formas
// grandes, a luz de cima à esquerda em poucas massas. Vista como o app mostra (em pé, de
// frente, olhada de cima: client/src/texturas/meioTermo/moveis/lapide.ts), a pedra sobe até
// 0,2 casa acima da pegada, como a do Atual (por isso a margem de 0,21875). De trás para a
// frente:
// - A BASE: um soco de pedra baixo e largo em que a lápide pousa. O topo dela é um plano
//   claro (olha para o céu), com a quina viva do lado da luz; a frente, abaixo da quina, é
//   um degrau de tom, sem linha. A pedra faz sombra no topo da base (valor, no desenho).
// - A PEDRA, de topo arredondado: a FACE numa massa calma (o tom do material, um nada mais
//   clara quando a frente vira para a luz), com a massa clara na beira do lado da luz e a
//   escura do outro lado e no pé (onde ela assenta na base); atrás da face, a mesma forma
//   subida 0,075 casa é o TOPO visto do alto, a faixa mais clara que segue o arco, com a
//   quina viva na luz. É ela que diz "pedra em pé" e não "placa deitada".
// - A INSCRIÇÃO é uma faixa rebaixada sem letra: um campo um nada mais fundo e a sombra da
//   borda do lado da luz. Nada de letra, cruz em risquinho, poro, rachadura ou musgo.
// - Dois TUFOS de capim (cor própria) nas quinas da frente da base, um maior e um menor
//   (nunca um par igual), com as folhas e os tons da grama aprovada (texturas/grama/): na
//   grama somem no chão e assentam a base nela.
// - A receita da pedra é a do poço aprovado (texturas/movel-poco/): o tom V_MEIO + 0,02 a
//   + 0,05, a massa clara + MASSA_CLARA de 0,045 casa e a escura - (MASSA_ESCURA + 0,02) de
//   1,5 x isso, o contorno da família. Um lugar (a pedra: granito, arenito ou ardósia,
//   que tingem com menos croma no escuro, CONTRATO 10.5).
// - 4 viradas: o capim muda de lado a lado (um tufo maior que o outro) e a pedra não é
//   simétrica de cima a baixo. Desenhada no referencial da lápide (movel_de) e acesa no da
//   tela (LUZ). A sombra no chão é do app (a altura da pedra: 0,2 casa).
// - Uma forma só, o arco (a variante 0 do Atual). O Atual sorteia 3 contornos pelo id do
//   objeto (varianteDaLapide); o contrato ainda não escolhe variante pelo id.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- A pedra, no referencial da lápide (pegada 0,6 x 0,35; y para baixo; o pé embaixo) ----
const float MEIA_LARGURA = 0.18;
const float Y_PE = 0.075;        // onde a pedra pousa no topo da base
const float ALTO_DA_FACE = 0.375;
const float ARCO = 0.16;         // o semieixo de cima do topo arredondado
const float TOPO = 0.075;        // a faixa de cima: a espessura da pedra vista do alto

// ---- A base (o soco de pedra em que ela pousa) ----
const float BASE_MEIA = 0.225;   // meia largura
const float BASE_FUNDO = 0.045;  // a beira de trás do topo da base
const float BASE_QUINA = 0.112;  // a quina entre o topo e a frente da base
const float BASE_PE = 0.162;     // onde a frente da base entra no chão

// ---- A faixa rebaixada (a inscrição, sem letra) ----
const vec2 FAIXA_C = vec2(0.0, -0.092);
const vec2 FAIXA_B = vec2(0.1, 0.048);
const float FAIXA_R = 0.018;

// ---- A receita da pedra (texturas/movel-poco/) ----
const float LUZ_DA_PEDRA = 0.045;
const float SOMBRA_NA_BASE = 0.07; // o quanto a sombra da pedra anda no topo da base

float sd_face(vec2 p) {
	float cy = Y_PE - ALTO_DA_FACE + ARCO;
	float hb = 0.5 * (Y_PE - cy);
	float caixa = sd_caixa(p - vec2(0.0, cy + hb), vec2(MEIA_LARGURA, hb), 0.0);
	return min(caixa, sd_elipse(p - vec2(0.0, cy), vec2(MEIA_LARGURA, ARCO)));
}

// A pedra inteira: a face e, atrás dela, a mesma forma subida TOPO (o topo visto do alto).
float sd_pedra(vec2 p) {
	return min(sd_face(p), sd_face(p + vec2(0.0, TOPO)));
}

float sd_base(vec2 p) {
	float hb = 0.5 * (BASE_PE - BASE_FUNDO);
	return sd_caixa(p - vec2(0.0, BASE_FUNDO + hb), vec2(BASE_MEIA, hb), 0.012);
}

// Tudo o que é pedra (para as massas que andam até a beira de fora).
float sd_tudo(vec2 p) {
	return min(sd_pedra(p), sd_base(p));
}

void desenhar_base(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_base(m);
	if (d > px) {
		return;
	}
	float co = contorno_para(vec2(BASE_MEIA, 0.5 * (BASE_PE - BASE_FUNDO)));
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + co, px);
	// O topo da base, claro (olha para o céu), com a quina viva do lado da luz e a sombra da
	// pedra andada para longe da luz.
	float vt = V_LUZ + 0.03;
	pousar(av, ac, vt, 1, dentro);
	pousar(av, ac, V_REALCE - 0.03, 1, dentro * (1.0 - cobre(sd_base(m + lm * 0.026) + co, px)));
	float sp = 1.0 - smoothstep(-0.012, 0.012, sd_pedra(m + lm * SOMBRA_NA_BASE));
	pousar(av, ac, vt - 0.2, 1, dentro * sp);
	// A frente da base: abaixo da quina, um degrau de tom (sem linha).
	float frente = dentro * (1.0 - smoothstep(-0.5 * px, 0.5 * px, BASE_QUINA - m.y));
	float vf = V_MEIO - 0.02 + 0.035 * dot(vec2(0.0, 1.0), lm) / 0.7071;
	pousar(av, ac, vf, 1, frente);
	pousar(av, ac, vf + MASSA_CLARA, 1, frente * (1.0 - cobre(sd_base(m + lm * LUZ_DA_PEDRA) + co, px)));
	pousar(av, ac, vf - MASSA_ESCURA - 0.02, 1, frente * (1.0 - cobre(sd_base(m - lm * LUZ_DA_PEDRA * 1.5) + co, px)));
}

void desenhar_pedra(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_pedra(m);
	if (d > px) {
		return;
	}
	float co = CONTORNO_CASAS;
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + co, px);
	// O topo: o plano mais claro (olha para o céu em toda virada).
	float vt = V_LUZ + 0.06;
	pousar(av, ac, vt, 1, dentro);
	// A quina viva do topo, do lado da luz.
	pousar(av, ac, V_REALCE, 1, dentro * (1.0 - cobre(sd_pedra(m + lm * 0.03) + co, px)));
	// A face: olha para a frente (+y no móvel); um nada mais clara quando a frente vira para a luz.
	float df = sd_face(m);
	float face = cobre(df + co, px) * dentro;
	float vf = V_MEIO + 0.02 + 0.035 * dot(vec2(0.0, 1.0), lm) / 0.7071;
	pousar(av, ac, vf, 1, face);
	float escura = face * (1.0 - cobre(sd_pedra(m - lm * LUZ_DA_PEDRA * 1.5) + co, px));
	pousar(av, ac, vf - MASSA_ESCURA - 0.02, 1, escura);
	float clara = face * (1.0 - cobre(sd_pedra(m + lm * LUZ_DA_PEDRA) + co, px));
	pousar(av, ac, vf + MASSA_CLARA, 1, clara);
	// A faixa rebaixada: um campo um nada mais fundo, e a borda do lado da luz faz sombra
	// dentro (sem fio claro do outro lado: com ele, a faixa lia como gaveta).
	vec2 pf = m - FAIXA_C;
	float dr = sd_caixa(pf, FAIXA_B, FAIXA_R);
	float rebaixo = cobre(dr, px) * face;
	pousar(av, ac, vf - 0.04, 1, rebaixo);
	pousar(av, ac, V_SOMBRA + 0.05, 1, rebaixo * (1.0 - cobre(sd_caixa(pf + lm * 0.024, FAIXA_B, FAIXA_R), px)));
}

// Um tufo de capim com o pé em pe: n folhas largas, como as da grama aprovada.
void desenhar_tufo(inout vec4 av, inout vec4 ac, vec2 m, vec2 pe, float alto, int n, float inclina, float px) {
	for (int b = 0; b < 5; b++) {
		if (b >= n) {
			break;
		}
		float k = float(b) - float(n - 1) * 0.5;
		float lado = k / max(float(n - 1) * 0.5, 1.0);
		vec2 p0 = pe + vec2(k * 0.028, 0.0);
		float altura = alto * (1.0 - 0.3 * abs(lado)) * (b == 1 ? 1.08 : 0.94);
		vec2 ponta = p0 + vec2(lado * alto * 0.36 + inclina * alto, -altura);
		vec2 eixo = normalize(ponta - p0);
		vec2 meio = mix(p0, ponta, 0.5) + vec2(-eixo.y, eixo.x) * (lado * 0.016 + inclina * 0.02);
		float d = min(sd_traco(m, p0, meio, 0.021, 0.015), sd_traco(m, meio, ponta, 0.015, 0.005));
		float a = cobre(d, px);
		if (a <= 0.0) {
			continue;
		}
		float hh = clamp(dot(m - p0, ponta - p0) / dot(ponta - p0, ponta - p0), 0.0, 1.0);
		vec3 cor = mix(mix(TUFO, GRAMA_SOMBRA, 0.45), mix(GRAMA_SOMBRA, GRAMA_REALCE, 0.75), hh);
		pousar_cor(av, ac, cor, a);
	}
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	desenhar_base(av, ac, m, lm, px);
	desenhar_pedra(av, ac, m, lm, px);
	desenhar_tufo(av, ac, m, vec2(-BASE_MEIA + 0.012, BASE_PE + 0.012), 0.1, 3, -0.1, px);
	desenhar_tufo(av, ac, m, vec2(BASE_MEIA - 0.03, BASE_PE + 0.014), 0.075, 3, 0.12, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

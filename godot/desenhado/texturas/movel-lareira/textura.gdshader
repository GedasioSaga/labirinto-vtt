// LAREIRA desenhada que pega cor (onda 4, lote 15; CONTRATO.md seção 10). A lareira de pedra
// da casa, vista de cima; a frente é o lado de baixo (o mestre encosta o fundo na parede).
//
// Da família aprovada (piloto, lotes 10 a 14): contorno grosso na própria cor, formas
// grandes, a luz de cima à esquerda em poucas massas, nada de risquinho, bolinha ou grão.
// A disposição é a do app (lib/mobilia/fogoDeCasa.ts, LAREIRA, em fração da pegada de
// 2 x 1): é dela que a chama animada do app lê onde nascer. De baixo para cima:
// - A SOLEIRA (lugar 1, a pedra), rente ao chão na frente: 3 lajes largas, a junta firme e
//   um pouco torta entre elas.
// - O LAR (lugar 1), o chão da boca entre as ombreiras: a pedra na sombra, mais escura de
//   fuligem no fundo, com a sombra das ombreiras e do consolo (é fundo: "cavado").
// - O LEITO DE CINZA (cor própria), claro e calmo, debaixo do fogo.
// - ACESO (a variante "aceso", a padrão): a MASSA DE BRASA na frente das toras, uma forma só
//   em 3 tons contidos (a borda vermelha apagada, o meio, o miolo quente), sem pontinho.
//   APAGADO ("apagado", o que o painel grava em mobiliaForma): a cinza mais larga e 3
//   carvões grandes e frios, escuros.
// - As 2 TORAS (cor própria), a lenha dos Troncos do app e do tronco caído aprovado da onda 3
//   (texturas/tronco-caido/): a casca em 3 faixas longas (a luz, o meio, a sombra), o corte
//   claro na ponta da esquerda, e o meio queimado, quase carvão, perto do fogo (aceso, mais).
// - As 2 OMBREIRAS (lugar 1), de 2 blocos cada, e o PEITO DA CHAMINÉ (lugar 1) no fundo, de
//   3 blocos, com a boca escura da chaminé no do meio (a parede de baixo à direita da boca
//   olha para a luz). A RECEITA DA PEDRA é a do poço aprovado (texturas/movel-poco/): o tom
//   V_MEIO + 0,05 com um tom próprio por bloco, as massas pela forma andada para a luz e
//   para longe dela, a junta de 0,022 casa em V_FUNDO + 0,02, o contorno da família por fora.
// - O CONSOLO (lugar 2, a madeira) por cima da boca, uma tábua grossa só, com a face embaixo
//   à direita, como o tampo da pia aprovada (texturas/movel-pia/).
// A CHAMA ANIMADA e o HALO quente não entram na imagem: são do app, por cima (as línguas
// nascem em (0; 0,17), (-0,24; 0,13) e (0,24; 0,12) casas do meio, na brasa e na tora da
// frente). Duas viradas: o desenho é simétrico de lado a lado no que conta (o fogo no eixo,
// as línguas dos lados em par), então a transposta faz as de 90 e 270 graus com a chama no
// lugar. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As cores próprias ----
// A casca e o corte do tronco caído aprovado (texturas/tronco-caido/textura.gdshader).
const vec3 CASCA_LUZ = vec3(0.486, 0.361, 0.243);      // #7c5c3e
const vec3 CASCA_SOMBRA = vec3(0.345, 0.251, 0.173);   // #583f2c
const vec3 CASCA_CONTORNO = vec3(0.243, 0.176, 0.122); // #3e2d1f
const vec3 CERNE_CLARO = vec3(0.698, 0.557, 0.392);    // #b28e64
const vec3 CERNE_ESCURO = vec3(0.502, 0.384, 0.267);   // #806244
// O carvão frio do app (fogoDeCasa.ts, CARVAO_FRIO #3e332c).
const vec3 CARVAO = vec3(0.243, 0.200, 0.173);
// As brasas da fogueira do app (fogueira.ts: BRASA_VIVA, BRASA_QUENTE) e o miolo, o laranja
// do fogo do Meio-Termo (#e39446, a brasa do fogão aprovado).
const vec3 BRASA_VIVA = vec3(0.588, 0.322, 0.243);
const vec3 BRASA_QUENTE = vec3(0.769, 0.510, 0.322);
const vec3 BRASA_MIOLO = vec3(0.890, 0.580, 0.275);
// A cinza: o granito da paleta (#9a968b), claro e frio.
const vec3 CINZA_CLARA = vec3(0.604, 0.588, 0.545);

// ---- A disposição (casas, no referencial da lareira: x de -1 a 1, y de -0,5 a 0,5) ----
const vec2 CHAMINE_C = vec2(0.0, -0.335);
const vec2 CHAMINE_B = vec2(0.665, 0.145);
const vec2 BOCA_C = vec2(0.0, -0.345);
const vec2 BOCA_B = vec2(0.175, 0.068);
const vec2 CONSOLO_C = vec2(0.0, -0.18);
const vec2 CONSOLO_B = vec2(0.93, 0.068);
const vec2 ESPESSURA = vec2(0.012, 0.03); // para onde a face do consolo aparece, NA TELA
const float X_OMBREIRA = 0.73;
const vec2 OMBREIRA_B = vec2(0.19, 0.21);
const float Y_OMBREIRA = 0.09;
const vec2 LAR_C = vec2(0.0, 0.08);
const vec2 LAR_B = vec2(0.56, 0.22);
const vec2 SOLEIRA_C = vec2(0.0, 0.385);
const vec2 SOLEIRA_B = vec2(0.975, 0.105);
// O centro do fogo (LAREIRA.fogo do app: (0; 0,1) da pegada).
const vec2 FOGO = vec2(0.0, 0.10);

// ---- A pedra ----
const float JUNTA = 0.011;        // meia junta entre blocos (0,022 casa, a do poço)
const float LUZ_DA_PEDRA = 0.034; // a largura da massa clara de cada bloco (a escura 1,5 x)
const float SOMBRA_DAS_OMBREIRAS = 0.15; // o quanto a sombra delas anda no lar e na soleira
const float SOMBRA_DO_CONSOLO = 0.17;

// ---- O fogo ----
// As toras cruzadas em X por cima do fogo (o cruzamento no centro do fogo, onde a língua do
// meio nasce): a brasa aparece nos 4 vãos entre elas. A da frente é a que sobe para a direita.
const vec4 TORA_TRAS = vec4(-0.29, 0.0, 0.29, 0.2);
const vec4 TORA_FRENTE = vec4(-0.29, 0.2, 0.29, 0.0);
const float R_TORA = 0.072;
const vec3 CASCA_MEIO = vec3(0.408, 0.299, 0.205); // entre a luz e a sombra da casca

float smax(float a, float b, float k) {
	float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) + k * h * (1.0 - h);
}

float smin(float a, float b, float k) {
	return -smax(-a, -b, k);
}

// Sombra macia: 1 dentro da forma d, com a borda esfumada.
float na_sombra(float d) {
	return 1.0 - smoothstep(-0.02, 0.02, d);
}

// A peça talhada: a caixa de lados um pouco abaulados (raio A; grande = quase reto).
float sd_talhada(vec2 p, vec2 b, float A, float quina) {
	float dx = length(vec2(abs(p.x) - b.x + A, p.y)) - A;
	float dy = length(vec2(p.x, abs(p.y) - b.y + A)) - A;
	return smax(dx, dy, quina);
}

// ---- As 4 peças de pedra: 0 o peito da chaminé, 1 e 2 as ombreiras, 3 a soleira ----
vec2 meio_da_peca(int k) {
	if (k == 0) {
		return CHAMINE_C;
	}
	if (k == 1) {
		return vec2(-X_OMBREIRA, Y_OMBREIRA);
	}
	if (k == 2) {
		return vec2(X_OMBREIRA, Y_OMBREIRA);
	}
	return SOLEIRA_C;
}

float sd_peca(vec2 m, int k) {
	vec2 p = m - meio_da_peca(k);
	if (k == 0) {
		return sd_talhada(p, CHAMINE_B, 12.0, 0.05);
	}
	if (k == 3) {
		return sd_talhada(p, SOLEIRA_B, 18.0, 0.045);
	}
	return sd_talhada(p, OMBREIRA_B, 2.0, 0.045);
}

// Quantas juntas a peça tem e onde (posição a partir do meio, torto em rad). Eixo 0: a junta
// corta o x (a peça larga); eixo 1: corta o y (a ombreira, funda).
int juntas_da_peca(int k) {
	return (k == 1 || k == 2) ? 1 : 2;
}

vec2 junta_da_peca(int k, int j) {
	if (k == 0) {
		return j == 0 ? vec2(-0.25, 0.10) : vec2(0.24, -0.08);
	}
	if (k == 1) {
		return vec2(-0.03, 0.13);
	}
	if (k == 2) {
		return vec2(0.025, -0.11);
	}
	return j == 0 ? vec2(-0.36, 0.09) : vec2(0.31, -0.11);
}

float lado_da_junta(vec2 p, int k, int j) {
	vec2 jj = junta_da_peca(k, j);
	if (k == 1 || k == 2) {
		vec2 n = vec2(-sin(jj.y), cos(jj.y));
		return dot(p - vec2(0.0, jj.x), n);
	}
	vec2 n = vec2(cos(jj.y), -sin(jj.y));
	return dot(p - vec2(jj.x, 0.0), n);
}

// O bloco i da peça k, encolhido do contorno por fora e da junta dos lados.
float sd_bloco(vec2 m, int k, int i) {
	vec2 p = m - meio_da_peca(k);
	float d = sd_peca(m, k) + CONTORNO_CASAS;
	int nj = juntas_da_peca(k);
	if (i > 0) {
		d = smax(d, JUNTA - lado_da_junta(p, k, i - 1), 0.012);
	}
	if (i < nj) {
		d = smax(d, lado_da_junta(p, k, i) + JUNTA, 0.012);
	}
	return d;
}

// O tom próprio de cada bloco, bem perto dos outros.
float tom_do_bloco(int k, int i) {
	if (k == 0) {
		return i == 0 ? 0.02 : (i == 1 ? -0.03 : 0.035);
	}
	if (k == 1) {
		return i == 0 ? 0.04 : -0.02;
	}
	if (k == 2) {
		return i == 0 ? -0.035 : 0.025;
	}
	return i == 0 ? -0.02 : (i == 1 ? 0.03 : -0.04);
}

// O que sobe (para a sombra no que fica embaixo).
float sd_ombreiras(vec2 m) {
	return min(sd_peca(m, 1), sd_peca(m, 2));
}

float sd_consolo(vec2 m) {
	return sd_caixa(m - CONSOLO_C, CONSOLO_B, 0.03);
}

// Uma peça de pedra em blocos: o contorno por fora, a argamassa na junta e os blocos pela
// receita do poço. sombra = o quanto ela está na sombra de quem sobe (0..1).
void desenhar_pedra(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, int k, float sombra, float px) {
	float d = sd_peca(m, k);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	pousar(av, ac, V_FUNDO + 0.02 - 0.04 * sombra, 1, cobre(d + CONTORNO_CASAS, px));
	int nb = juntas_da_peca(k) + 1;
	for (int i = 0; i < 3; i++) {
		if (i >= nb) {
			break;
		}
		float db = sd_bloco(m, k, i);
		if (db > px) {
			continue;
		}
		float dentro = cobre(db, px);
		float v = V_MEIO + 0.05 + tom_do_bloco(k, i);
		pousar(av, ac, v - 0.12 * sombra, 1, dentro);
		float esc = dentro * (1.0 - cobre(sd_bloco(m - lm * LUZ_DA_PEDRA * 1.5, k, i), px));
		pousar(av, ac, v - MASSA_ESCURA - 0.02 - 0.08 * sombra, 1, esc);
		float cla = dentro * (1.0 - cobre(sd_bloco(m + lm * LUZ_DA_PEDRA, k, i), px));
		pousar(av, ac, v + MASSA_CLARA - 0.13 * sombra, 1, cla);
	}
}

// A sombra das ombreiras e do consolo no fundo da boca.
float sombra_no_lar(vec2 m, vec2 lm) {
	float s = na_sombra(sd_ombreiras(m + lm * SOMBRA_DAS_OMBREIRAS));
	return max(s, na_sombra(sd_consolo(m + lm * SOMBRA_DO_CONSOLO)));
}

void desenhar_lar(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_caixa(m - LAR_C, LAR_B, 0.03);
	if (d > px) {
		return;
	}
	// A fuligem: o fundo da boca mais escuro, clareando para a frente.
	float t = clamp((m.y - (LAR_C.y - LAR_B.y)) / (2.0 * LAR_B.y), 0.0, 1.0);
	float v = mix(V_FUNDO - 0.03, V_SOMBRA + 0.03, smoothstep(0.1, 0.95, t));
	v -= 0.08 * sombra_no_lar(m, lm);
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	pousar(av, ac, v, 1, cobre(d + 0.5 * CONTORNO_CASAS, px));
}

// Uma cor própria com contorno e as massas de luz pela forma andada (como desenhar_caixa).
// d0 = a forma; dl = a forma andada para a luz; ds = a andada para longe dela.
void pousar_massas(inout vec4 av, inout vec4 ac, float d0, float dl, float ds, float co, vec3 cor, vec3 contorno, vec3 clara, vec3 escura, float px) {
	pousar_cor(av, ac, contorno, cobre(d0, px));
	float dentro = cobre(d0 + co, px);
	pousar_cor(av, ac, cor, dentro);
	pousar_cor(av, ac, escura, dentro * (1.0 - cobre(ds + co, px)));
	pousar_cor(av, ac, clara, dentro * (1.0 - cobre(dl + co, px)));
}

// O leito do fogo (a brasa, acesa; a cinza, apagada): uma forma só, de 3 lobos largos,
// debaixo das toras; aparece na frente delas e nas frestas.
float sd_leito(vec2 m) {
	float d = sd_elipse(m - vec2(-0.21, 0.09), vec2(0.21, 0.115));
	d = smin(d, sd_elipse(m - vec2(0.2, 0.125), vec2(0.21, 0.105)), 0.07);
	d = smin(d, sd_elipse(m - vec2(-0.02, 0.205), vec2(0.22, 0.075)), 0.07);
	d = smin(d, sd_elipse(m - vec2(0.04, 0.025), vec2(0.17, 0.075)), 0.07);
	// A beira que ondula devagar: a brasa não é um prato.
	vec2 p = m - FOGO;
	return d + 0.014 * sin(atan(p.y, p.x) * 5.0 + 0.7);
}

// A cinza do apagado, macia e da cor da pedra queimada: sem contorno duro, para não virar
// um prato debaixo da lenha.
void desenhar_cinza(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_leito(m) - 0.02;
	if (d > 0.03) {
		return;
	}
	float s = sombra_no_lar(m, lm);
	float borda = 1.0 - smoothstep(-0.03, 0.03, d);
	vec3 cor = mix(CINZA_CLARA * (0.78 - 0.2 * s), CINZA_CLARA * (0.9 - 0.2 * s), 1.0 - cobre(sd_leito(m + lm * 0.04) - 0.02, px));
	pousar_cor(av, ac, cor, borda);
}

float sd_brasa(vec2 m) {
	return sd_leito(m);
}

void desenhar_brasa(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_brasa(m);
	if (d > px) {
		return;
	}
	// A borda firme no vermelho apagado (o desenho) e, por dentro, o calor subindo para o meio
	// sem anel nenhum, até o miolo onde a chama nasce (um lobo largo, não um ponto).
	pousar_cor(av, ac, BRASA_VIVA * 0.62, cobre(d, px));
	float dentro = cobre(d + 0.018, px);
	float calor = 1.0 - smoothstep(-0.1, -0.02, d);
	vec3 cor = mix(BRASA_VIVA * 0.92, BRASA_QUENTE, calor);
	float miolo = 1.0 - smoothstep(-0.03, 0.04, sd_elipse(m - vec2(0.0, 0.135), vec2(0.17, 0.08)));
	cor = mix(cor, BRASA_MIOLO, 0.8 * miolo);
	pousar_cor(av, ac, cor, dentro);
}

// Os 3 carvões frios do apagado, grandes e calmos (o meio de cada um, o tamanho, o giro).
vec4 carvao(int i) {
	if (i == 0) {
		return vec4(-0.215, 0.105, 0.062, 0.3);
	}
	if (i == 1) {
		return vec4(0.0, 0.24, 0.07, -0.4);
	}
	return vec4(0.22, 0.1, 0.058, 0.9);
}

float sd_carvao(vec2 m, int i) {
	vec4 c = carvao(i);
	vec2 p = girar(m - c.xy, c.w);
	return sd_caixa(p, vec2(c.z, c.z * 0.62), c.z * 0.5);
}

void desenhar_carvoes(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	for (int i = 0; i < 3; i++) {
		float d = sd_carvao(m, i);
		if (d > px) {
			continue;
		}
		pousar_massas(av, ac, d, sd_carvao(m + lm * 0.022, i), sd_carvao(m - lm * 0.033, i), 0.022,
				CARVAO, CARVAO * 0.62, CARVAO * 1.5, CARVAO * 0.8, px);
	}
}

// Uma tora: a casca em 3 faixas longas, o meio queimado (quase carvão) perto do fogo e o
// corte claro nas duas pontas, o da ponta que olha para a luz mais claro. Acesa, a faixa de
// baixo do meio queimado é brasa (a tora queima por baixo). queima = o quanto o meio virou
// carvão (0..1).
void desenhar_tora(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, vec4 t, float queima, bool aceso, int v, float px) {
	float d = sd_traco(m, t.xy, t.zw, R_TORA, R_TORA);
	if (d > px) {
		return;
	}
	float co = contorno_para(vec2(R_TORA));
	vec2 u = normalize(t.zw - t.xy);
	float ao_longo = dot(m - 0.5 * (t.xy + t.zw), u);
	float perto = queima * (1.0 - smoothstep(0.1, 0.22, abs(ao_longo)));
	float sh = 1.0 - 0.22 * 0.6 * na_sombra(sd_ombreiras(m + lm * SOMBRA_DAS_OMBREIRAS));
	vec3 meio = mix(CASCA_MEIO, CARVAO, perto) * sh;
	vec3 clara = mix(CASCA_LUZ, CARVAO * 1.5, perto) * sh;
	vec3 escura = mix(CASCA_SOMBRA * 0.86, aceso ? mix(CARVAO * 0.76, BRASA_VIVA, 0.4) : CARVAO * 0.76, perto) * sh;
	vec3 contorno = mix(CASCA_CONTORNO, CARVAO * 0.62, perto);
	pousar_massas(av, ac, d, sd_traco(m + lm * 0.024, t.xy, t.zw, R_TORA, R_TORA), sd_traco(m - lm * 0.036, t.xy, t.zw, R_TORA, R_TORA), co,
			meio, contorno, clara, escura, px);
	// O corte nas pontas: a madeira clara, vista de quina, dentro da ponta redonda.
	float dentro = cobre(d + co, px);
	for (int e = 0; e < 2; e++) {
		vec2 a = e == 0 ? t.xy : t.zw;
		vec2 fora = e == 0 ? -u : u;
		vec2 pc = m - (a - fora * 0.012);
		vec2 r = vec2(dot(pc, u), dot(pc, vec2(-u.y, u.x)));
		float dc = sd_elipse(r, vec2(0.034, R_TORA - co));
		float acesa = mix(0.74, 1.0, smoothstep(-0.3, 0.3, para_a_luz(tela_de(fora, v))));
		pousar_cor(av, ac, CERNE_ESCURO * acesa * sh, cobre(dc, px) * dentro);
		pousar_cor(av, ac, CERNE_CLARO * acesa * sh, cobre(dc + 0.016, px) * dentro);
	}
}

void desenhar_boca(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_caixa(m - BOCA_C, BOCA_B, 0.03);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + 0.016, px);
	// O fundo escuro da chaminé; a parede de baixo à direita olha para a luz.
	float luz = 1.0 - cobre(sd_caixa(m - BOCA_C - lm * 0.035, BOCA_B, 0.03) + 0.016, px);
	pousar(av, ac, V_FUNDO - 0.08, 1, dentro);
	pousar(av, ac, V_SOMBRA - 0.04, 1, dentro * luz);
}

void desenhar_consolo(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, int v, float px) {
	// A face da tábua grossa, embaixo à direita na tela.
	vec2 off = movel_de(ESPESSURA, v);
	pousar_com_contorno(av, ac, sd_caixa(m - CONSOLO_C - off, CONSOLO_B, 0.03), V_FUNDO + 0.04, 2, px);
	desenhar_caixa(av, ac, m, CONSOLO_C, CONSOLO_B, 0.03, V_MEIO, 0.032, 2, v, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	bool aceso = qual == 1;
	// A soleira, com a sombra das ombreiras.
	float s_sol = na_sombra(sd_ombreiras(m + lm * SOMBRA_DAS_OMBREIRAS * 0.8));
	desenhar_pedra(av, ac, m, lm, 3, s_sol, px);
	desenhar_lar(av, ac, m, lm, px);
	if (aceso) {
		desenhar_brasa(av, ac, m, lm, px);
	} else {
		desenhar_cinza(av, ac, m, lm, px);
		desenhar_carvoes(av, ac, m, lm, px);
	}
	desenhar_tora(av, ac, m, lm, TORA_TRAS, aceso ? 0.8 : 0.65, aceso, vir, px);
	desenhar_tora(av, ac, m, lm, TORA_FRENTE, aceso ? 0.9 : 0.7, aceso, vir, px);
	desenhar_pedra(av, ac, m, lm, 1, 0.0, px);
	desenhar_pedra(av, ac, m, lm, 2, 0.0, px);
	desenhar_pedra(av, ac, m, lm, 0, 0.0, px);
	desenhar_boca(av, ac, m, lm, px);
	desenhar_consolo(av, ac, m, lm, vir, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

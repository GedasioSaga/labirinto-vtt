// TRONCO CAÍDO deitado no chão (onda 3, lote 8; CONTRATO.md, seção 9). Entrou no app em
// 28/10 (embutidos.ts, desenharTroncoCaido); aqui com o desenho calmo do Desenhado.
//
// Visto como a família (lote 6): o chão um pouco de frente, então o comprimento que aponta
// para cima ou para baixo encolhe (0,7, o mesmo do app) e a grossura não. O lado de cima do
// tronco pega a luz, o flanco de baixo fica na sombra.
//
// - A casca é de POUCAS FAIXAS LONGAS ao longo do tronco: a da luz, a do meio e a da sombra,
//   de borda que ondula devagar, mais uma ou duas fendas largas que nascem e morrem ao longo.
//   Nada de risquinho, escama ou textura miúda.
// - As 4 formas são as do app, cada uma numa direção, e a direção segue o giro do mestre:
//   o arquivo é k mod 4, e o app aponta o tronco de hoje assim também (k mod 4 = 0 deitado,
//   1 na diagonal \, 2 de frente, 3 na diagonal /). Por isso "espelho": "nenhum": o espelho
//   diagonal trocaria a direção do tronco sem o giro pedir (o deitado viraria de frente).
//     1 (k 0) com musgo, deitado, a ponta lascada à direita;
//     2 (k 1) com o galho seco, na diagonal \, seco e mais claro, o corte embaixo à direita;
//     3 (k 2) curto e grosso, de frente, o corte com dois anéis largos virado para quem vê
//             (a face embaixo diz "deitado": o toco em pé mostraria a face em cima);
//     4 (k 3) quebrado, na diagonal /, a ponta rasgada lá atrás, em cima à direita.
// - Sem sombra no chão (é do app: "deslocada" 0,09, a "deitada" de hoje).
//
// q em unidades do tamanho, a partir do meio da imagem (o meio do tronco); o pé fica 0,2
// abaixo (config: ancoraPx), como no app (CENTRO_DO_TRONCO).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

const float ACHATA = 0.7;

// Os tons do tronco das árvores do lote 6 (texturas/arvore, arvore-redonda).
const vec3 CASCA_LUZ = vec3(0.486, 0.361, 0.243);      // #7c5c3e
const vec3 CASCA_SOMBRA = vec3(0.345, 0.251, 0.173);   // #583f2c
const vec3 CASCA_CONTORNO = vec3(0.243, 0.176, 0.122); // #3e2d1f
// A madeira do corte e da quebra (os do app: CERNE_CLARO, CERNE_ESCURO).
const vec3 CERNE_CLARO = vec3(0.698, 0.557, 0.392);    // #b28e64
const vec3 CERNE_ESCURO = vec3(0.502, 0.384, 0.267);   // #806244
// O musgo: os verdes do arbusto do lote 6 (texturas/arbusto, a forma 2, a mais amarelada),
// para os dois conversarem no mapa.
const vec3 MUSGO_LUZ = vec3(0.341, 0.529, 0.290);
const vec3 MUSGO_MEIO = vec3(0.259, 0.431, 0.243);
const vec3 MUSGO_FUNDO = vec3(0.200, 0.345, 0.200);
const vec3 MUSGO_CONTORNO = vec3(0.153, 0.271, 0.161);

const int REDONDA = 0;
const int CORTE = 1;
const int QUEBRADA = 2;
const int LASCADA = 3;

// Os dentes da ponta, do lado +v ao -v: (de través, em frações do raio; para fora, em
// unidades). Poucos e grandes (os do app).
const vec2 QUEBRA[7] = vec2[](vec2(1.0, -0.02), vec2(0.6, 0.05), vec2(0.26, 0.18), vec2(0.02, 0.05), vec2(-0.34, 0.12), vec2(-0.68, 0.01), vec2(-1.0, 0.03));
const vec2 LASCA[5] = vec2[](vec2(1.0, 0.0), vec2(0.45, 0.07), vec2(0.05, 0.02), vec2(-0.4, 0.09), vec2(-1.0, 0.01));

// A direção de cada forma no chão (rad, y para baixo; o app: giro k x 45 graus).
float angulo(int k) {
	if (k == 1) {
		return 3.927; // 225 graus: a diagonal \, o pé (o corte) embaixo à direita
	}
	if (k == 2) {
		return 1.50; // 86 graus: de frente, o corte embaixo, para quem vê
	}
	if (k == 3) {
		return 5.498; // 315 graus: a diagonal /, a ponta quebrada em cima à direita
	}
	return 0.06;
}

// u0, u1 (onde o cilindro começa e acaba, em unidades no chão), raio e afina (do pé, u0,
// para a ponta, u1; negativa = mais grosso na ponta). As medidas do app.
vec4 medidas(int k) {
	if (k == 1) {
		return vec4(-0.57, 0.57, 0.116, 0.16);
	}
	if (k == 2) {
		return vec4(-0.36, 0.36, 0.168, -0.08);
	}
	if (k == 3) {
		return vec4(-0.57, 0.48, 0.12, 0.2);
	}
	return vec4(-0.57, 0.55, 0.126, 0.14);
}

int ponta_do_pe(int k) {
	return k == 1 ? CORTE : REDONDA;
}

int ponta_da_ponta(int k) {
	if (k == 1) {
		return REDONDA;
	}
	if (k == 2) {
		return CORTE;
	}
	if (k == 3) {
		return QUEBRADA;
	}
	return LASCADA;
}

// O tom de cada forma, a partir do tronco da árvore: o do musgo mais úmido e fechado, o do
// galho seco e acinzentado, o curto um pouco mais quente.
vec3 tom_da_forma(int k, vec3 c) {
	if (k == 0) {
		return c * vec3(0.93, 0.95, 0.94);
	}
	if (k == 1) {
		float y = dot(c, vec3(0.30, 0.59, 0.11));
		return mix(c, vec3(y) * vec3(1.06, 1.0, 0.92), 0.38) * 1.1;
	}
	if (k == 2) {
		return c * vec3(1.05, 1.0, 0.95);
	}
	if (k == 3) {
		return c * vec3(0.97, 0.95, 0.95);
	}
	return c;
}

vec2 dente(int tipo, int i) {
	return tipo == QUEBRADA ? QUEBRA[i] : LASCA[i];
}

int dentes(int tipo) {
	return tipo == QUEBRADA ? 7 : 5;
}

// Quanto a ponta rasgada passa do fim do cilindro no través n (frações do raio), em unidades.
float dente_em(float n, int tipo, bool espelho) {
	float nn = clamp(espelho ? -n : n, -1.0, 1.0);
	int nd = dentes(tipo);
	float du = dente(tipo, 0).y;
	for (int i = 1; i < 7; i++) {
		if (i >= nd) {
			break;
		}
		vec2 a = dente(tipo, i - 1);
		vec2 b = dente(tipo, i);
		if (nn <= a.x && nn >= b.x) {
			du = mix(a.y, b.y, (a.x - nn) / max(a.x - b.x, 1e-4));
		}
	}
	return du;
}

// O vértice i do polígono da ponta rasgada: os dentes e, depois, dois pontos para dentro
// do tronco (sem vetor local: o driver recusa índice variável na escrita).
vec2 vertice(int i, int tipo, bool espelho, float r, float e) {
	int nd = dentes(tipo);
	if (i < nd) {
		vec2 dt = dente(tipo, i);
		return vec2(dt.y * e, (espelho ? -dt.x : dt.x) * r);
	}
	float v = i == nd ? dente(tipo, nd - 1).x : dente(tipo, 0).x;
	return vec2(-0.3, (espelho ? -v : v) * r);
}

// A ponta rasgada como polígono. lp = (para fora do fim do cilindro, de través a partir do
// eixo), unidades da tela.
float sd_dentes(vec2 lp, int tipo, bool espelho, float r, float e) {
	int n = dentes(tipo) + 2;
	vec2 v0 = vertice(0, tipo, espelho, r, e);
	float d = dot(lp - v0, lp - v0);
	float s = 1.0;
	for (int i = 0; i < 9; i++) {
		if (i >= n) {
			break;
		}
		int j = i == 0 ? n - 1 : i - 1;
		vec2 vi = vertice(i, tipo, espelho, r, e);
		vec2 vj = vertice(j, tipo, espelho, r, e);
		vec2 ed = vj - vi;
		vec2 wv = lp - vi;
		vec2 b = wv - ed * clamp(dot(wv, ed) / dot(ed, ed), 0.0, 1.0);
		d = min(d, dot(b, b));
		bool c1 = lp.y >= vi.y;
		bool c2 = lp.y < vj.y;
		bool c3 = ed.x * wv.y > ed.y * wv.x;
		if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) {
			s *= -1.0;
		}
	}
	return s * sqrt(d);
}

// O bojo da ponta redonda ou serrada, ao longo do tronco NA TELA, em frações do raio: a
// ponta que olha para quem vê mostra mais de si (as contas do app).
float bojo(int tipo, float de_frente) {
	if (tipo == CORTE) {
		return (0.3 + 0.42 * de_frente) / 0.78;
	}
	return 0.42 + 0.25 * de_frente;
}

// A distância até a ponta (para fora do fim do cilindro), unidades da tela.
float sd_ponta(int tipo, vec2 lp, float r, float e, float de_frente, bool espelho) {
	if (tipo == QUEBRADA || tipo == LASCADA) {
		return sd_dentes(lp, tipo, espelho, r, e);
	}
	return sd_elipse(lp, vec2(bojo(tipo, de_frente) * r, r));
}

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

// O ponto da tela no tronco: t ao longo (0 no pé, 1 na ponta) e xr de través, em frações
// do raio para o lado da luz. f = (u0, comprimento, raio, afina); j = (arco, fase, lado da
// luz, encolhe).
vec2 no_tronco(float t, float xr, vec2 a, vec2 p, vec4 f, vec4 j) {
	float u = f.x + t * f.y;
	float meio = j.x * (1.0 - (2.0 * t - 1.0) * (2.0 * t - 1.0));
	float r = f.z * (1.0 + f.w * (0.5 - t)) * (1.0 + 0.03 * sin(u * 7.0 + j.y));
	return a * (u * j.w) + p * (meio + j.z * xr * r);
}

// A manta de musgo: calombos LARGOS e compridos fundidos numa massa só (nunca bolinha),
// por cima do tronco, na metade do pé. s encolhe, anda desloca (para a luz); n = quantos
// calombos entram (o boné de luz só nos primeiros, os de cima à esquerda).
float sd_manta(vec2 q, vec2 a, vec2 p, vec4 f, vec4 j, float s, vec2 anda, int n) {
	float d = 1e9;
	for (int i = 0; i < 3; i++) {
		if (i >= n) {
			break;
		}
		vec4 l = i == 0 ? vec4(0.16, 0.62, 0.16, 0.56) : (i == 1 ? vec4(0.33, 0.3, 0.13, 0.64) : vec4(0.47, 0.64, 0.14, 0.48));
		vec2 v = q - no_tronco(l.x, l.y, a, p, f, j) - anda;
		vec2 lv = vec2(dot(v, a), dot(v, p));
		d = smin(d, sd_elipse(lv, vec2(l.z, l.w * f.z) * s), 0.07);
	}
	return d;
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	float th = angulo(k);
	vec4 md = medidas(k);
	float u0 = md.x;
	float u1 = md.y;
	float r0 = md.z;
	float afina = md.w;
	int pa = ponta_do_pe(k);
	int pb = ponta_da_ponta(k);
	float traco = 1.0 / unidade_mundo;
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float pxl = px * 128.0;

	// O eixo na tela: a ao longo (o comprimento encolhe quando aponta para cima ou para
	// baixo), p de través (o lado +v).
	vec2 dch = vec2(cos(th), sin(th) * ACHATA);
	float e = length(dch);
	vec2 a = dch / e;
	vec2 p = vec2(-a.y, a.x);
	vec2 frente = vec2(cos(th), sin(th));
	// De que lado bate a luz (o +v = 1 ou o -v = -1); empatado, o de cima na tela.
	float olhar = dot(vec2(-sin(th), cos(th)), LUZ);
	float lado_luz = abs(olhar) >= 0.16 ? sign(olhar) : (p.y > 0.0 ? -1.0 : 1.0);
	float de_lado = abs(olhar);

	uint h = hash_cel(vec2(float(k), 3.0), sem + 901);
	float arco = (rk(h, 0) - 0.5) * 0.5 * r0;
	float fase = TAU * rk(h, 1);
	bool espelho = rk(h, 2) < 0.5;

	float sa = dot(q, a);
	float w = dot(q, p);
	float u = sa / e;
	float comp = u1 - u0;
	float uc = clamp(u, u0, u1);
	float t = (uc - u0) / comp;
	float meio = arco * (1.0 - (2.0 * t - 1.0) * (2.0 * t - 1.0));
	float ondula = 1.0 + 0.03 * sin(uc * 7.0 + fase);
	float r = r0 * (1.0 + afina * (0.5 - t)) * ondula;
	float ra = r0 * (1.0 + afina * 0.5) * (1.0 + 0.03 * sin(u0 * 7.0 + fase));
	float rb = r0 * (1.0 - afina * 0.5) * (1.0 + 0.03 * sin(u1 * 7.0 + fase));
	float wn = w - meio;

	// O musgo (forma 1) é uma almofada por cima: a silhueta ganha os calombos dele.
	vec4 f_t = vec4(u0, comp, r0, afina);
	vec4 j_t = vec4(arco, fase, lado_luz, e);
	float d_musgo = k == 0 ? sd_manta(q, a, p, f_t, j_t, 1.0, vec2(0.0), 3) : 1e9;

	// A silhueta: o cilindro cortado nos dois fins e as duas pontas.
	float d_corpo = min(max(abs(wn) - r, max(sa - u1 * e, u0 * e - sa)), d_musgo);
	vec2 lp_a = vec2(u0 * e - sa, -wn);
	vec2 lp_b = vec2(sa - u1 * e, wn);
	float fa = max(0.0, -frente.y);
	float fb = max(0.0, frente.y);
	float d_a = sd_ponta(pa, lp_a, ra, e, fa, !espelho);
	float d_b = sd_ponta(pb, lp_b, rb, e, fb, espelho);
	float d = min(d_corpo, min(d_a, d_b));
	float luz_a = 0.5 - 0.5 * dot(frente, LUZ);
	float luz_b = 0.5 + 0.5 * dot(frente, LUZ);

	// Os tons desta forma.
	vec3 c_luz = tom_da_forma(k, CASCA_LUZ);
	vec3 c_sombra = tom_da_forma(k, CASCA_SOMBRA);
	vec3 c_meio = mix(c_luz, c_sombra, 0.5);
	vec3 c_cont = tom_da_forma(k, CASCA_CONTORNO);

	// As faixas da casca: x = +1 na borda da luz, -1 na da sombra.
	float n = wn / r;
	float x = n * lado_luz;
	float aa = max(px / r, 0.025);
	float b1 = -0.6 + 0.25 * de_lado + 0.08 * sin(u * 5.2 + fase * 1.3);
	float b2 = -0.3 + 0.52 * de_lado + 0.08 * sin(u * 5.2 + fase * 2.1 + 1.0);
	float fim = 0.5 + 0.5 * de_lado;
	float b3 = 1.0 - fim < 0.22 ? 9.0 : fim + 0.06 * sin(u * 4.1 + fase);
	float s_sombra = 1.0 - smoothstep(b1 - aa, b1 + aa, x);
	float s_luz = smoothstep(b2 - aa, b2 + aa, x) * (1.0 - smoothstep(b3 - aa, b3 + aa, x));
	vec3 c = mix(c_meio, c_sombra, s_sombra);
	c = mix(c, c_luz, s_luz);

	// As fendas: uma ou duas faixas escuras largas, que nascem e morrem ao longo.
	// O curto não leva fenda: num tronco curto a faixa que nasce e morre vira um olho.
	int nf = k == 2 ? 0 : 2;
	for (int i = 0; i < 2; i++) {
		if (i >= nf) {
			break;
		}
		uint hf = hash_cel(vec2(float(k), 10.0 + float(i)), sem + 905);
		float ta = 0.12 + 0.2 * rk(hf, 0) + 0.3 * float(i);
		float tb = min(ta + 0.32 + 0.2 * rk(hf, 1), 0.92);
		float xf = (i == 0 ? 0.08 + 0.18 * rk(hf, 2) : -0.42 + 0.14 * rk(hf, 2)) + 0.06 * sin(u * 6.0 + TAU * rk(hf, 3));
		float corpo_f = smoothstep(ta, ta + 0.12, t) * (1.0 - smoothstep(tb - 0.12, tb, t));
		float wf = 0.1 * corpo_f;
		float mf = (1.0 - smoothstep(wf - aa, wf + aa, abs(x - xf))) * step(0.001, corpo_f);
		c = mix(c, (i == 0 ? c_sombra : c_sombra * 0.86), mf * 0.8);
	}

	// As pontas: a redonda é casca (mais clara se olha para a luz); o corte mostra a face e
	// dois anéis largos; a quebra mostra a madeira rasgada.
	float oa = u0 * e - sa;
	float ob = sa - u1 * e;
	float perto_a = smoothstep(-0.02, 0.05, oa);
	float perto_b = smoothstep(-0.02, 0.05, ob);
	c = mix(c, mix(c_sombra, c_luz, luz_a), perto_a * 0.3);
	c = mix(c, mix(c_sombra, c_luz, luz_b), perto_b * 0.3);
	for (int lado_p = 0; lado_p < 2; lado_p++) {
		int tipo = lado_p == 0 ? pa : pb;
		vec2 lp = lado_p == 0 ? lp_a : lp_b;
		float rp = lado_p == 0 ? ra : rb;
		float lz = max(lado_p == 0 ? luz_a : luz_b, 0.25);
		float ff = lado_p == 0 ? fa : fb;
		bool esp = lado_p == 0 ? !espelho : espelho;
		if (tipo == CORTE) {
			float rx = 0.78 * bojo(CORTE, ff) * rp;
			float ry = 0.86 * rp;
			vec2 miolo = vec2(-0.012 * e, -lado_luz * rp * 0.12 * (lado_p == 0 ? -1.0 : 1.0));
			// A madeira do topo é clara mesmo de costas para a luz (o céu ilumina).
			vec3 face = mix(CERNE_ESCURO, CERNE_CLARO, 0.55 + 0.45 * max(lz, 0.4));
			// Nada de alvo: a borda clara (o alburno), o cerne um tom abaixo, largo e fora
			// do centro, e um anel só, largo e manso, dentro dele.
			vec3 cerne = mix(face, CERNE_ESCURO, 0.38);
			vec3 anel = mix(face, CERNE_ESCURO, 0.62);
			float m1 = cobre(sd_elipse(lp, vec2(rx, ry)), px);
			float m2 = cobre(sd_elipse(lp - miolo * 0.45, vec2(rx, ry) * 0.74), px);
			float m3 = cobre(sd_elipse(lp - miolo * 0.75, vec2(rx, ry) * 0.5), px);
			float m4 = cobre(sd_elipse(lp - miolo * 0.85, vec2(rx, ry) * 0.34), px);
			c = mix(c, face, m1);
			c = mix(c, cerne, m2);
			c = mix(c, anel, m3);
			c = mix(c, cerne, m4);
		} else if (tipo == QUEBRADA || tipo == LASCADA) {
			float fundo = tipo == QUEBRADA ? 0.075 : 0.05;
			float nn = (lp.y / rp) / 0.8;
			float limite = (dente_em(nn, tipo, esp) - fundo) * e;
			float mw = cobre(limite - lp.x, px) * (1.0 - smoothstep(0.92, 1.0, abs(nn)));
			c = mix(c, mix(CERNE_ESCURO, CERNE_CLARO, 0.15 + 0.6 * lz), mw);
		}
	}

	// O musgo (forma 1): a almofada em três camadas, como a copa da árvore: a massa inteira
	// no tom de baixo; por cima, a mesma menor e andada para a luz, no meio; e um boné de luz
	// só nos calombos de cima à esquerda. Embaixo à direita dela, a casca escurece (a sombra
	// de dentro): é o que a separa do tronco, sem linha nenhuma.
	float musgo_borda = 0.0;
	if (k == 0) {
		float d_sob = sd_manta(q - vec2(0.018, 0.024), a, p, f_t, j_t, 1.0, vec2(0.0), 3);
		c = mix(c, c_sombra * 0.9, (1.0 - smoothstep(-0.004, 0.004, d_sob)) * smoothstep(-0.002, 0.004, d_musgo) * 0.8);
		float m_1 = cobre(d_musgo, px);
		float d_meio_m = sd_manta(q, a, p, f_t, j_t, 0.85, LUZ * 0.02, 3);
		float m_2 = cobre(d_meio_m, px);
		// O boné: o crescente da camada do meio na borda de cima à esquerda (o que sobra
		// dela andada para a sombra), só na metade do pé.
		float d_bone = max(d_meio_m, -sd_manta(q + LUZ * 0.03, a, p, f_t, j_t, 0.85, LUZ * 0.02, 3));
		float m_3 = cobre(d_bone, px) * (1.0 - smoothstep(0.26, 0.4, t));
		c = mix(c, MUSGO_FUNDO, m_1);
		c = mix(c, MUSGO_MEIO, m_2);
		c = mix(c, MUSGO_LUZ, m_3);
		musgo_borda = 1.0 - smoothstep(-0.004, 0.012, d_musgo);
	}

	// A mão de pintura: pinceladas ao longo do tronco e o grão do papel, de leve.
	c *= 1.0 + 0.035 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 20.0, atan(a.y, a.x), 0.3);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;

	// O contorno: a cor do tronco escurecida, mais grosso no lado da sombra.
	float esp_c = mix(2.4, 1.4, smoothstep(-0.7, 0.7, x)) * traco;
	vec3 c_traco = mix(c_cont, MUSGO_CONTORNO, musgo_borda);

	vec4 acc = vec4(0.0);
	// O galho seco (forma 2): sai do lado de quem vê perto do meio, deitado no chão (o
	// comprimento dele encolhe como o do tronco), por baixo do tronco, afina até a ponta e
	// abre um raminho de volta para a ponta do tronco. Metade na luz, metade na sombra.
	if (k == 1) {
		uint hg = hash_cel(vec2(float(k), 20.0), sem + 907);
		float lado_g = p.y > 0.0 ? 1.0 : -1.0;
		float ub = 0.06 + 0.08 * rk(hg, 0);
		vec2 base = a * ub * e + p * (lado_g * r0 * 0.45);
		float th_g = th + lado_g * 1.0;
		vec2 ponta_g = base + vec2(cos(th_g), sin(th_g) * ACHATA) * 0.30;
		vec2 meio_g = mix(base, ponta_g, 0.6);
		float th_r = th_g - lado_g * 0.65;
		vec2 ponta_r = meio_g + vec2(cos(th_r), sin(th_r) * ACHATA) * 0.12;
		float dg1 = sd_traco(q, base, ponta_g, 0.052, 0.022);
		float dg2 = sd_traco(q, meio_g, ponta_r, 0.03, 0.015);
		float d_g = min(dg1, dg2);
		vec2 nrm = normalize(vec2(-(ponta_g - base).y, (ponta_g - base).x));
		float lado_l = dot(q - base, nrm) * sign(dot(nrm, LUZ));
		vec2 nrm2 = normalize(vec2(-(ponta_r - meio_g).y, (ponta_r - meio_g).x));
		float lado_l2 = dot(q - meio_g, nrm2) * sign(dot(nrm2, LUZ));
		float lz_g = dg2 < dg1 ? lado_l2 : lado_l;
		vec3 cg = mix(c_sombra, c_luz, smoothstep(-px, px, lz_g + 0.004));
		cg *= 1.0 + (grao(pl, 1024.0, sem + 41) - 1.0) * 0.6;
		acc = sobre(acc, c_cont, cobre(d_g, px));
		acc = sobre(acc, cg, cobre(d_g + 1.5 * traco, px));
	}
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + esp_c, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : c_cont;
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

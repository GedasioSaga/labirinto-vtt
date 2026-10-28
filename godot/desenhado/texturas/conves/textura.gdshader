// Convés: piso de navio com estrutura. Lote 4 da onda 1.
// Tábuas compridas de madeira clara, desbotada pelo sol e gasta pelo uso, com as
// juntas calafetadas escuras e macias (nunca pretas). Três tábuas por casa, ao
// comprido (na horizontal), alinhadas na grade da casa: a junta comprida cai em 1/6,
// 1/2 e 5/6 da casa, nunca na linha da grade (lá fica o meio de uma tábua).
//
// Piso com estrutura (CONTRATO.md seção 1): as juntas, os topos e as cavilhas são
// iguais nas 3 variantes; a variante só troca a superfície (o tom de cada tábua, o
// veio, a mancha larga do sol e da água).
//
// Diferente do convés de hoje do app (marrom quase preto, 4 tábuas por casa, tábua de
// 2 a 3 casas) e do telhado de madeira (cinza-marrom, tábua da cumeeira ao beiral):
// aqui a madeira é clara, a tábua é longa (de 2,4 a 8 casas, 5 em média) e o veio é
// largo e calmo, nunca listra fina.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// ---------- geometria (igual nas variantes) ----------

const int CV_FILAS = 24;
const float CV_H = 21.3333333;   // 3 tábuas por casa
const float CV_Y0 = 10.6666667;  // meia tábua: a grade da casa cai no meio da tábua
const int CV_MAX = 3;            // topos por fiada, no máximo

// Os topos (onde uma tábua acaba e a próxima começa) de cada fiada, em px do
// ladrilho. Saíram de um gerador com sorteio fixo (semente 4103), escritos aqui por
// extenso: topos de fiadas vizinhas a 72 px ou mais um do outro (38 a duas fiadas,
// 16 a três), nenhum a menos de 8 px de uma linha de casa nem da borda do ladrilho,
// sem escada de três fiadas no mesmo passo, sem coluna a 4 fiadas e espalhados por
// igual (nenhum quadrado de 2 x 2 casas sem topo). 38 topos em 64 casas.
const int CV_N[24] = { 2, 1, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2, 1, 3, 1, 2, 2, 1, 2, 1, 2, 1, 1, 1 };
const float CV_B[72] = {
	43.85, 368.88, 0.00,
	228.20, 0.00, 0.00,
	311.58, 486.87, 0.00,
	101.92, 0.00, 0.00,
	25.95, 374.45, 0.00,
	155.58, 464.50, 0.00,
	73.60, 0.00, 0.00,
	247.70, 418.29, 0.00,
	328.72, 495.77, 0.00,
	111.82, 0.00, 0.00,
	34.54, 221.45, 0.00,
	301.86, 470.23, 0.00,
	87.11, 0.00, 0.00,
	12.10, 163.88, 351.31,
	271.25, 0.00, 0.00,
	118.94, 439.36, 0.00,
	33.96, 225.08, 0.00,
	397.25, 0.00, 0.00,
	142.81, 471.23, 0.00,
	353.55, 0.00, 0.00,
	86.87, 271.27, 0.00,
	170.65, 0.00, 0.00,
	410.08, 0.00, 0.00,
	293.77, 0.00, 0.00
};
// Os topos que têm cavilha (13 de 38, espalhados): uma de cada lado do topo, no
// meio da tábua. Raras, e quase do tom da madeira.
const int CV_CAV[72] = { 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0 };

const float CV_JUNTA = 1.3;        // meia largura do calafeto da junta comprida, px
const float CV_JUNTA_TOPO = 1.1;   // meia largura no topo
const float CV_CAVILHA = 2.6;      // raio da cavilha, px
const float CV_CAVILHA_U = 7.0;    // distância da cavilha ao topo, px

// ---------- paleta (client/src/texturas/meioTermo/paleta.ts) ----------
// PINHO, LINHO, NOGUEIRA, CARVALHO e REBOCO vêm da base.
const vec3 CV_GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b
const vec3 CV_LENHA = vec3(0.431, 0.341, 0.271);   // #6e5745
const vec3 CV_CORDA = vec3(0.706, 0.612, 0.427);   // #b49c6d
const vec3 CV_TELHA_MADEIRA = vec3(0.525, 0.478, 0.416); // #867a6a
const vec3 CV_MADEIRA_CLARA = vec3(0.886, 0.725, 0.541); // #e2b98a

// A madeira do convés: madeira clara desbotada pelo sol, puxada para o linho e para o
// granito (a madeira de navio ao sol fica clara e acinzentada). Com pinho no lugar da
// madeira clara (rodada 1) o convés saía amarelo de papel kraft e, acinzentado,
// cáqui: a madeira clara traz o vermelho que segura o tom de madeira.
vec3 cv_madeira() {
	return mix(mix(CV_MADEIRA_CLARA, LINHO, 0.45), CV_GRANITO, 0.22) * 0.96;
}

// A tábua mais curtida pelo tempo vira prata quente (linho com a madeira do telhado;
// com granito e linho ela saía cáqui, quase oliva, ao lado das tábuas de mel).
vec3 cv_prata() {
	return mix(LINHO, CV_TELHA_MADEIRA, 0.35) * 1.04;
}

// O calafeto: breu velho, lenha com um pouco de nogueira, escuro e quente.
vec3 cv_calafeto() {
	return mix(CV_LENHA, NOGUEIRA, 0.35) * 0.82;
}

// A tábua no ponto p. Devolve, por out: a fiada, o número da tábua, a posição ao
// longo dela (u, de 0 a len) e através (v, de 0 a CV_H), o comprimento, e se cada
// ponta tem cavilha.
void cv_tabua(vec2 p, float P, out int id, out float u, out float v, out float len,
		out bool cav_ini, out bool cav_fim) {
	float t = mod(p.y - CV_Y0, P);
	int r = min(int(floor(t / CV_H)), CV_FILAS - 1);
	v = t - float(r) * CV_H;
	float xs = mod(p.x, P);
	int n = CV_N[r];
	int b0 = r * CV_MAX;
	int k = -1;
	for (int i = 0; i < CV_MAX; i++) {
		if (i < n && xs >= CV_B[b0 + i]) {
			k = i;
		}
	}
	float s;
	float e;
	if (k < 0) {
		// Antes do primeiro topo: é a última tábua da fiada, que deu a volta.
		k = n - 1;
		s = CV_B[b0 + n - 1] - P;
		e = CV_B[b0];
	} else {
		s = CV_B[b0 + k];
		e = (k + 1 < n) ? CV_B[b0 + k + 1] : CV_B[b0] + P;
	}
	int kf = (k + 1 < n) ? k + 1 : 0;
	id = b0 + k;
	u = xs - s;
	len = e - s;
	cav_ini = CV_CAV[b0 + k] == 1;
	cav_fim = CV_CAV[b0 + kf] == 1;
}

// Ruído de gradiente sem período curto (para o veio, medido na tábua e não no
// ladrilho: a tábua que passa pela borda segue contínua).
float cv_ruido(vec2 q, int sem) {
	return ruido_p(q, vec2(4096.0), sem);
}

// ---------- tons (mudam com a variante) ----------

vec3 cv_cor_da_tabua(int id, int qual, int sem) {
	uint h = hash_cel(vec2(float(id), float(qual) + 11.0), sem);
	vec3 c = cv_madeira();
	float r0 = rk(h, 0);
	c = mix(c, cv_prata(), 0.35 * r0 * r0);
	c = mix(c, mix(CV_CORDA, PINHO, 0.5), 0.22 * smoothstep(0.72, 1.0, rk(h, 2)));
	c *= 1.0 + 0.035 * (rk(h, 1) * 2.0 - 1.0);
	return c;
}

// ---------- base ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	int id;
	float u;
	float v;
	float len;
	bool cav_ini;
	bool cav_fim;
	cv_tabua(p, P, id, u, v, len, cav_ini, cav_fim);
	float dv = min(v, CV_H - v);       // até a junta comprida mais perto
	float du = min(u, len - u);        // até o topo mais perto

	// 1. A tábua: o tom dela e o veio largo, ao comprido, um pouco ondulado.
	vec3 c = cv_cor_da_tabua(id, qual, sem);
	int sg = s + 500 + id * 31;
	float ond = 3.0 * (cv_ruido(vec2(u / 190.0, 0.5), sg) - 0.5);
	float g1 = cv_ruido(vec2(u / 150.0, (v + ond) / 6.5), sg + 1);
	float g2 = cv_ruido(vec2(u / 64.0, (v + ond) / 5.0), sg + 2);
	c *= 1.0 + 0.09 * (g1 - 0.5) + 0.015 * (g2 - 0.5);
	// O veio gasto: 2 linhas macias e onduladas por tábua, que somem e voltam ao longo
	// dela (a madeira mole foi embora com o sol e a água, a dura ficou). Largas o
	// bastante para não serrilhar a 300%; fracas o bastante para sumir a 50%.
	float veio = 0.0;
	for (int j = 0; j < 2; j++) {
		uint hv = hash_cel(vec2(float(id), float(j) + 40.0 + float(qual) * 7.0), sem);
		float y0 = CV_H * (0.18 + 0.64 * rk(hv, 0));
		float amp = 1.2 + 2.2 * rk(hv, 1);
		float yy = y0 + amp * 2.0 * (cv_ruido(vec2(u / (80.0 + 70.0 * rk(hv, 2)), float(j) * 3.1), sg + 10 + j) - 0.5);
		float linha = 1.0 - smoothstep(0.8, 2.9, abs(v - yy));
		float some = smoothstep(0.38, 0.66, cv_ruido(vec2(u / 70.0, float(j) * 5.3 + 1.7), sg + 20 + j));
		veio = max(veio, linha * some);
	}
	c *= 1.0 - 0.04 * veio;

	// 2. O sol e a água no convés: manchas largas, de 1 a 3 casas, que atravessam as
	//    tábuas (mudam com a variante).
	float larga = fz(p, 128.0, P, s + 3, 2);
	c *= 1.0 + 0.03 * (smoothstep(0.25, 0.75, larga) - 0.5);
	float media = fz(p, 64.0, P, s + 4, 2);
	c *= 1.0 + 0.018 * (media - 0.5);

	// 3. A beira gasta: arredondada pelo uso, pega a luz em cima e à esquerda e cai
	//    em baixo e à direita; perto da junta e do topo a madeira encardiu um pouco.
	float beira_v = 1.0 - smoothstep(CV_JUNTA, CV_JUNTA + 3.2, dv);
	float sinal_v = v < CV_H * 0.5 ? 0.7071 : -0.7071;
	float beira_u = 1.0 - smoothstep(CV_JUNTA_TOPO, CV_JUNTA_TOPO + 3.0, du);
	float sinal_u = u < len * 0.5 ? 0.7071 : -0.7071;
	float luz = beira_v * sinal_v + beira_u * sinal_u;
	c *= 1.0 + 0.06 * clamp(luz, -1.0, 1.0);
	float encardido = 1.0 - smoothstep(CV_JUNTA, CV_JUNTA + 5.0, dv);
	c *= 1.0 - 0.035 * encardido;
	float ponta = 1.0 - smoothstep(CV_JUNTA_TOPO, CV_JUNTA_TOPO + 12.0, du);
	c *= 1.0 - 0.035 * ponta;

	// 4. As cavilhas: um tampão redondo de madeira, quase do tom da tábua, com a
	//    beira um nada mais escura; uma de cada lado do topo, no meio da tábua.
	vec2 qc = vec2(1e4);
	if (cav_ini) {
		qc = vec2(u - CV_CAVILHA_U, v - CV_H * 0.5);
	}
	if (cav_fim && len - u < u) {
		qc = vec2(u - (len - CV_CAVILHA_U), v - CV_H * 0.5);
	}
	float dc = length(qc) - CV_CAVILHA;
	float tampa = 1.0 - smoothstep(-0.6, 0.6, dc);
	float aro = (1.0 - smoothstep(0.0, 0.9, abs(dc + 0.3))) * 0.6;
	vec3 tampao = mix(c, CARVALHO, 0.22) * (1.0 + 0.04 * dot(normalize(qc + vec2(1e-4)), LUZ));
	c = mix(c, tampao, tampa * 0.85);
	c *= 1.0 - 0.05 * aro;

	// 5. O calafeto: escuro e macio, a largura anda um pouco (calafetado à mão).
	vec3 calafeto = cv_calafeto();
	calafeto *= 1.0 + 0.08 * (fz(p, 32.0, P, s + 6, 2) - 0.5);
	float wl = CV_JUNTA + 0.45 * (rz(p, 32.0, P, sem + 21) - 0.5);
	float na_junta = 1.0 - smoothstep(wl - 0.8, wl + 0.8, dv);
	float wt = CV_JUNTA_TOPO + 0.3 * (rz(p, 16.0, P, sem + 22) - 0.5);
	float no_topo = (1.0 - smoothstep(wt - 0.8, wt + 0.8, du)) * 0.9;
	c = mix(c, calafeto, max(na_junta, no_topo));

	// 6. Mão de pintura: poucas pinceladas ao comprido das tábuas e o grão do papel.
	c *= 1.0 + 0.018 * pinceladas(p, P, px, s + 8, 32.0, 0.0, 0.25);
	c *= grao(p, P, s + 9);
	return c;
}

// ---------- atlas: manchas largas e macias, sem contorno ----------

// Distância (px) a uma elipse torta: raios r, 3 harmônicos baixos na borda.
float cv_torta(vec2 q, vec2 c, vec2 r, float torto, uint h) {
	vec2 lq = (q - c) / r;
	float th = atan(lq.y, lq.x);
	float f = 1.0 + torto * (0.12 * cos(th + TAU * rk(h, 0)) + 0.08 * cos(2.0 * th + TAU * rk(h, 1))
			+ 0.05 * cos(3.0 * th + TAU * rk(h, 2)));
	return (length(lq) - f) * min(r.x, r.y);
}

vec4 cv_mancha(vec4 acc, vec2 q, vec2 c, vec2 r, vec3 cor, float alfa, uint h) {
	float d = cv_torta(q, c, r, 1.3, h);
	float a = 1.0 - smoothstep(-min(r.x, r.y) * 0.85, 0.0, d);
	return sobre(acc, cor, a * a * (3.0 - 2.0 * a) * alfa);
}

// Mancha de água salgada que secou: o miolo quase nada, a beira com o sal mais claro.
vec4 cv_sal(vec4 acc, vec2 q, vec2 c, vec2 r, vec3 cor, float alfa, uint h) {
	float d = cv_torta(q, c, r, 1.3, h);
	float rm = min(r.x, r.y);
	float dentro = 1.0 - smoothstep(-rm * 0.5, 0.0, d);
	float beira = (1.0 - smoothstep(0.0, rm * 0.3, abs(d + rm * 0.16))) * dentro;
	acc = sobre(acc, cor, dentro * alfa * 0.45);
	return sobre(acc, cor, beira * alfa * 0.55);
}

// O atlas (4 células de 2 casas). Tudo deitado ao comprido das tábuas, como a água e o
// sol marcam um convés:
//   0 sal seco (mais claro na beira)   1 úmido (mais escuro, comprido)
//   2 desbotado do sol (mais claro)    3 curtido, acinzentado (dois lobos)
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 5.0), 7411);
	vec4 acc = vec4(0.0);
	if (i == 0) {
		acc = cv_sal(acc, q, vec2(0.0), vec2(50.0, 27.0), mix(LINHO, BRANCO, 0.35), 0.13, h);
	} else if (i == 1) {
		acc = cv_mancha(acc, q, vec2(0.0), vec2(56.0, 22.0), cv_madeira() * 0.7, 0.11, h);
	} else if (i == 2) {
		acc = cv_mancha(acc, q, vec2(0.0), vec2(46.0, 31.0), mix(LINHO, REBOCO, 0.5), 0.1, h);
	} else {
		uint h2 = hash_cel(vec2(float(i), 6.0), 7411);
		acc = cv_mancha(acc, q, vec2(-12.0, -3.0), vec2(38.0, 21.0), cv_prata() * 0.96, 0.11, h);
		acc = cv_mancha(acc, q, vec2(18.0, 6.0), vec2(30.0, 17.0), cv_prata() * 0.96, 0.09, h2);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

// JARDINEIRA vista de cima (onda 3, lote 7; CONTRATO.md, seção 9.5). Trecho reto: o móvel
// esticado repete o período de L px ao longo e não estica a imagem.
//
// - A caixa: uma tábua larga em cada beira comprida e uma na ponta, de madeira de carvalho
//   puxada para a do convés aprovado (texturas/conves/), com o contorno do protótipo do Fogo
//   (a própria cor a 60%). As emendas das tábuas de cima e de baixo caem em lugares
//   diferentes e o período tem 4 casas: esticada a 6 casas, a emenda não volta no mesmo
//   lugar a cada casa. A primeira casa não tem emenda (a jardineira de 1 casa sai inteira).
// - Dentro, a terra escura quase coberta por tufos da família do arbusto aprovado
//   (texturas/arbusto/: os mesmos tons, o contorno só por fora da massa e o festão raso),
//   uns 3 por casa, de tamanho, tom e lugar diferentes, às vezes dois pequenos lado a lado.
//   Cada tufo é uma moita de 1 a 3 cachos largos; os cachos largos levam um punhado de
//   folhas por cima, fora do meio. 3 flores calmas no período, uma delas na primeira casa.
// - SEM luz de direção na cor (a imagem gira com o móvel). A luz é do app, pelo relevo: cada
//   cacho é chato por dentro e só a beira dele inclina para fora, então o app acende a beira
//   de cima à esquerda e escurece a de baixo à direita, em qualquer giro. A beira de fora da
//   caixa inclina para fora, a de dentro para a terra, e a terra é côncava (afundada): o
//   lado de cima escurece, como a sombra da parede.
// - A ponta do começo (s < 0) é só a tábua da ponta; o app espelha para a do fim. Nada do
//   período passa para a ponta, então qualquer comprimento fecha igual. A caixa passa 6 px
//   do eixo em cada ponta: para ela ocupar a casa exata, o app deita T = largura - 12 px.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// ---------- medidas (px do mundo; 64 px = 1 casa) ----------
const float JD_W = 16.0;        // meia largura da caixa: 0,5 casa de largura
const float JD_TABUA = 6.0;     // largura da tábua da beira e da ponta
const float JD_FIM = -6.0;      // onde a caixa acaba na ponta do começo (s)
const float JD_CANTO = 2.5;     // raio do canto de fora
const float JD_TRACO = 1.8;     // contorno de fora (0,03 casa, o do protótipo do Fogo)
const float JD_LINHA = 1.1;     // a linha entre a beira e a terra, e a emenda

// As emendas das tábuas da beira, em px do período (L = 256): as de cima e as de baixo em
// lugares diferentes; a primeira casa (0 a 64) sem emenda.
const vec2 JD_EMENDA_CIMA = vec2(100.0, 210.0);
const vec2 JD_EMENDA_BAIXO = vec2(150.0, 250.0);

// ---------- paleta (client/src/texturas/meioTermo/paleta.ts) ----------
const vec3 JD_LENHA = vec3(0.431, 0.341, 0.271);          // #6e5745
const vec3 JD_MADEIRA_CLARA = vec3(0.886, 0.725, 0.541);  // #e2b98a
const vec3 JD_GRANITO = vec3(0.604, 0.588, 0.545);        // #9a968b
const vec3 JD_TELHA_MADEIRA = vec3(0.525, 0.478, 0.416);  // #867a6a

// A madeira do convés aprovado (texturas/conves/, cv_madeira e cv_prata).
vec3 jd_conves() {
	return mix(mix(JD_MADEIRA_CLARA, LINHO, 0.45), JD_GRANITO, 0.22) * 0.96;
}

vec3 jd_prata() {
	return mix(LINHO, JD_TELHA_MADEIRA, 0.35) * 1.04;
}

// A caixa: carvalho puxado para o convés, um pouco mais escuro que ele (a caixa clara
// sumia no chão claro; o Atual também escurece a caixa).
vec3 jd_madeira() {
	return mix(CARVALHO, jd_conves(), 0.28);
}

// O tom de cada tábua: 0 e 1 em cima, 2 e 3 embaixo, 4 a da ponta.
vec3 jd_cor_da_tabua(int id) {
	vec3 c = jd_madeira();
	if (id == 1) {
		c = mix(c, jd_prata(), 0.2) * 1.02;
	} else if (id == 2) {
		c = mix(c, NOGUEIRA, 0.1) * 0.98;
	} else if (id == 3) {
		c = mix(c, PINHO, 0.12) * 1.01;
	} else if (id == 4) {
		c = mix(c, NOGUEIRA, 0.06) * 0.97;
	}
	return c;
}

// A terra escura e úmida da jardineira (a do Atual: lenha a 78%).
vec3 jd_terra() {
	return mix(JD_LENHA, NOGUEIRA, 0.3) * 0.74;
}

// Os tons do arbusto aprovado (texturas/arbusto/, tom()): luz, meio, sombra, fundo, contorno.
vec3 jd_folha(int k, int qual) {
	vec3 t0 = vec3(0.400, 0.643, 0.384);
	vec3 t1 = vec3(0.251, 0.490, 0.302);
	vec3 t2 = vec3(0.184, 0.396, 0.259);
	vec3 t4 = vec3(0.110, 0.255, 0.173);
	if (k == 1) {
		t0 = vec3(0.471, 0.651, 0.373);
		t1 = vec3(0.341, 0.529, 0.290);
		t2 = vec3(0.259, 0.431, 0.243);
		t4 = vec3(0.153, 0.271, 0.161);
	} else if (k == 2) {
		t0 = vec3(0.373, 0.620, 0.420);
		t1 = vec3(0.235, 0.475, 0.337);
		t2 = vec3(0.173, 0.384, 0.282);
		t4 = vec3(0.106, 0.247, 0.188);
	} else if (k == 3) {
		t0 = vec3(0.443, 0.694, 0.427);
		t1 = vec3(0.290, 0.545, 0.337);
		t2 = vec3(0.212, 0.447, 0.290);
		t4 = vec3(0.129, 0.290, 0.196);
	}
	return qual == 0 ? t0 : (qual == 1 ? t1 : (qual == 2 ? t2 : t4));
}

// ---------- os tufos do período, na ordem de pintar (de baixo para cima) ----------
// s e c do centro, os raios (rx ao longo, ry atravessando; o festão passa um pouco) e o tom
// (0 verde, 1 oliva, 2 verde-azulado, 3 claro). Três por casa em média, fora de fileira e de
// tamanhos bem diferentes: massas compridas, médias, pequenas e dois pares de pequenos lado
// a lado, para a jardineira comprida não virar uma fieira de bolas iguais.
const int TF_N = 12;
const float TF_S[12] = { 78.0, 172.0, 8.0, 233.0, 148.0, 50.0, 124.0, 196.0, 31.0, 104.0, 55.0, 212.0 };
const float TF_C[12] = { 0.0, 1.0, -0.5, -0.5, -1.0, -3.5, 2.0, -2.5, 1.5, -2.0, 4.0, 3.0 };
const float TF_RX[12] = { 17.0, 15.0, 13.0, 14.0, 11.0, 7.0, 12.0, 9.5, 10.0, 9.0, 7.5, 8.0 };
const float TF_RY[12] = { 10.0, 10.0, 9.5, 10.0, 9.5, 7.0, 9.5, 8.5, 9.5, 8.5, 7.0, 7.5 };
const int TF_TOM[12] = { 2, 0, 0, 3, 1, 3, 0, 2, 1, 3, 0, 1 };

// As flores: s, c, raio e o tom (0 rosa apagado, 1 creme). Uma na primeira casa; o
// espaçamento entre elas não se repete. A ponta do fim corta o período onde o móvel acaba
// (s = T mod L), e flor cortada ao meio fica feia (um tufo cortado lê como a folhagem
// passando por baixo da tábua). Por isso as flores ficam longe de onde o corte cai num
// móvel de casas inteiras, nas duas contas que o app pode fazer (T = largura, ou T =
// largura - 12 px para a caixa ocupar a casa exata), e do 1,5 casa da mesa.
const int FL_N = 3;
const float FL_S[3] = { 30.0, 150.0, 210.0 };
const float FL_C[3] = { -3.5, 3.0, -3.0 };
const float FL_R[3] = { 4.2, 4.0, 4.3 };
const int FL_TOM[3] = { 0, 1, 0 };

// O festão de um tufo: poucos lóbulos largos e desiguais (o do arbusto, borda()).
float jd_festao(vec2 v, float r, int i, int sal, int sem, float fundo) {
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(i), float(sal)), sem + 701);
	float m = floor(r * 0.5 + 1.99 * rk(h, 2));
	float a = ang + 0.35 * sin(2.0 * ang + TAU * rk(h, 1));
	float t = (a / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float alto = fundo * r * (0.45 + 0.75 * rk(hash_cel(vec2(float(i) * 16.0 + float(sal), j), sem + 703), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

// Quantos cachos o tufo i tem: os grandes 3, os médios 2, os pequenos 1 (como o arbusto,
// que é uma moita de 3 ou 4 cachos largos).
int jd_quantos(int i) {
	return TF_RX[i] >= 12.0 ? 3 : (TF_RX[i] >= 9.0 ? 2 : 1);
}

// O cacho j do tufo i (0 = o corpo; 1 e 2 = os menores, um de cada lado): xy = o centro a
// partir do centro do tufo, zw = os raios. Nenhum passa da beira de dentro mais que 1,5 px.
vec4 jd_cacho(int i, int j, int sem) {
	vec2 ab = vec2(TF_RX[i], TF_RY[i]);
	uint h = hash_cel(vec2(float(i), float(j) + 20.0), sem + 721);
	float lado = rk(hash_cel(vec2(float(i), 19.0), sem + 721), 0) < 0.5 ? -1.0 : 1.0;
	vec2 o;
	vec2 r;
	if (j == 0) {
		o = (vec2(rk(h, 0), rk(h, 1)) - 0.5) * vec2(1.6, 1.0);
		r = ab * 0.95;
	} else if (j == 1) {
		r = ab * vec2(0.6 + 0.1 * rk(h, 2), 0.66 + 0.1 * rk(h, 3));
		o = vec2(lado * 0.55 * ab.x, (rk(h, 1) - 0.5) * 0.8 * ab.y);
	} else {
		r = ab * vec2(0.54 + 0.1 * rk(h, 2), 0.62 + 0.1 * rk(h, 3));
		o = vec2(-lado * 0.52 * ab.x, (rk(h, 1) - 0.5) * 0.8 * ab.y);
	}
	float teto = 12.0 - 1.12 * r.y;
	o.y = clamp(o.y, -teto - TF_C[i], teto - TF_C[i]);
	return vec4(o, r);
}

// A tábua da beira no ponto: o número dela e o quanto falta (com sinal) até a emenda mais
// perto (negativo = antes da emenda).
void jd_tabua(float s, float c, float L, out int id, out float para_emenda) {
	vec2 e = c < 0.0 ? JD_EMENDA_CIMA : JD_EMENDA_BAIXO;
	float x = mod(s, L);
	bool meio = x >= e.x && x < e.y;
	id = (c < 0.0 ? 0 : 2) + (meio ? 1 : 0);
	float da = mod(x - e.x + L * 0.5, L) - L * 0.5;
	float db = mod(x - e.y + L * 0.5, L) - L * 0.5;
	para_emenda = abs(da) < abs(db) ? da : db;
}

// A caixa inteira (a ponta do começo arredondada; ao longo, sem fim dentro do período).
float jd_sd_caixa(vec2 q) {
	return sd_caixa(vec2(q.x - (JD_FIM + 500.0), q.y), vec2(500.0, JD_W), JD_CANTO);
}

// Tudo de uma vez: a cor reta, o alfa e o relevo (x ao longo, y atravessando).
void jd_pintar(vec2 q, float L, float px, int sem, out vec3 cor, out float alfa, out vec2 rel) {
	vec2 qn = q + vec2(0.0, 64.0);
	float d_caixa = jd_sd_caixa(q);
	float ac = abs(q.y);
	float sc = sign(q.y + 1e-4);
	float dentro = JD_W - JD_TABUA;   // onde a beira encontra a terra

	vec3 c;
	rel = vec2(0.0);
	if (q.x < 0.0) {
		// A tábua da ponta, de través: o veio corre atravessando.
		c = jd_cor_da_tabua(4);
		float xin = q.x - JD_FIM;
		float y0 = 2.2 + 1.6 * rk(hash_cel(vec2(4.0, 1.0), sem + 31), 0);
		float onda = 0.7 * (rz(qn, 16.0, L, sem + 33) - 0.5) * 2.0;
		c *= 1.0 - 0.045 * (1.0 - smoothstep(0.5, 1.6, abs(xin - y0 - onda)));
		c *= 1.0 + 0.04 * (rz(vec2(q.x * 4.0, qn.y), 32.0, L, sem + 35) - 0.5);
		// A linha de dentro: a tábua da ponta encontra as da beira e a terra.
		c = mix(c, contorno_de(c), smoothstep(-JD_LINHA - 0.5 * px, -JD_LINHA + 0.5 * px, q.x) * 0.85);
		rel.x = 0.55 * smoothstep(-2.2, -0.6, q.x);
	} else if (ac >= dentro) {
		// A tábua da beira comprida: o tom dela, o veio ao comprido e a emenda.
		int id;
		float pe;
		jd_tabua(q.x, q.y, L, id, pe);
		c = jd_cor_da_tabua(id);
		float yin = JD_W - ac;
		uint hv = hash_cel(vec2(float(id), 2.0), sem + 41);
		float y0 = 1.8 + 2.4 * rk(hv, 0);
		float onda = 0.8 * (rz(qn, 32.0, L, sem + 43 + id) - 0.5) * 2.0;
		float some = smoothstep(0.35, 0.65, rz(qn, 32.0, L, sem + 47 + id));
		c *= 1.0 - 0.05 * (1.0 - smoothstep(0.5, 1.7, abs(yin - y0 - onda))) * some;
		c *= 1.0 + 0.05 * (rz(qn, 32.0, L, sem + 51 + id) - 0.5);
		c *= 1.0 + 0.02 * pinceladas(qn, L, px, sem + 53, 16.0, 0.0, 0.25);
		// A emenda: uma linha fina e escura atravessando a tábua; as pontas das duas tábuas
		// inclinam um nada para a emenda.
		float ae = abs(pe);
		c = mix(c, mix(c, contorno_de(c), 0.8), 1.0 - smoothstep(0.5 * JD_LINHA - 0.5 * px, 0.5 * JD_LINHA + 0.5 * px, ae));
		rel.x = (pe < 0.0 ? 0.45 : -0.45) * (1.0 - smoothstep(0.6, 1.8, ae));
		// A beira de dentro desce para a terra.
		rel.y = -sc * 0.55 * (1.0 - smoothstep(0.6, 1.9, ac - dentro));
		// A linha entre a beira e a terra.
		c = mix(c, mix(c, contorno_de(c), 0.85), 1.0 - smoothstep(JD_LINHA - 0.5 * px, JD_LINHA + 0.5 * px, ac - dentro));
	} else {
		// A terra: escura, afundada (côncava) e mais escura perto das paredes.
		c = jd_terra();
		c *= 1.0 + 0.08 * (rz(qn, 16.0, L, sem + 61) - 0.5);
		c *= 1.0 - 0.16 * smoothstep(dentro - 3.5, dentro, ac);
		rel.y = -q.y / dentro * 0.45;
	}

	// Os tufos e as flores, só no período (a ponta é só a tábua).
	if (q.x >= 0.0) {
		vec2 pl = qn * 2.0;
		float mancha = rz(qn, 16.0, L, sem + 71) - 0.5;
		// A massa de folhas: o contorno só por fora dela (contra a terra e a madeira); por
		// dentro, um tufo se separa do de baixo pelo tom e por uma faixa escura, como os
		// cachos do arbusto (sem linha por dentro, senão vira uma fieira de bolhas).
		float d_massa = 1e9;
		vec3 traco_massa = jd_folha(0, 3);
		for (int i = 0; i < TF_N; i++) {
			vec2 v = q - vec2(TF_S[i], TF_C[i]);
			v.x = mod(v.x + L * 0.5, L) - L * 0.5;
			vec2 ab = vec2(TF_RX[i], TF_RY[i]);
			if (abs(v.x) > ab.x * 1.3 + 8.0) {
				continue;
			}
			int t = TF_TOM[i];
			vec3 base = mix(jd_folha(t, 1), jd_folha(t, 0), 0.15);
			base *= 1.0 + 0.05 * mancha;
			base *= 1.0 + (grao(pl, 2.0 * L, sem + 73) - 1.0) * 0.6;
			// O contorno do arbusto, um pouco aberto para o meio: o app escurece o lado de
			// baixo à direita e clareia o de cima à esquerda (o traço pesa na sombra).
			vec3 traco = mix(jd_folha(t, 3), jd_folha(t, 1), 0.25);
			int n = jd_quantos(i);
			bool corpo_por_cima = rk(hash_cel(vec2(float(i), 18.0), sem + 721), 0) < 0.5;
			for (int jj = 0; jj < 3; jj++) {
				if (jj >= n) {
					break;
				}
				int j = corpo_por_cima ? (jj == n - 1 ? 0 : jj + 1) : jj;
				vec4 cc = jd_cacho(i, j, sem);
				vec2 w = v - cc.xy;
				vec2 rr = cc.zw;
				float rm = 0.5 * (rr.x + rr.y);
				float d = sd_elipse(w, rr) - jd_festao(w, rm, i * 4 + j, 0, sem, 0.18);
				// O cacho assenta no que está embaixo: uma faixa escura e macia em volta dele,
				// igual de todos os lados (a luz de direção é do app). Mais forte sobre outro
				// cacho (é o que separa as massas) que sobre a terra, já escura.
				float perto = (1.0 - smoothstep(0.0, 3.0, d)) * (1.0 - cobre(d, px));
				float sobre_folha = 1.0 - smoothstep(-0.5, 0.5, d_massa);
				c *= 1.0 - mix(0.1, 0.2, sobre_folha) * perto;
				// Chato por dentro e só a beira inclina para fora: o app acende a beira de cima
				// à esquerda e escurece a de baixo à direita, em qualquer giro.
				uint hc = hash_cel(vec2(float(i), float(j) + 30.0), sem + 731);
				vec3 cor_j = base * (0.95 + 0.1 * rk(hc, 0)) * (jj == n - 1 ? 1.04 : 1.0);
				cor_j *= 1.0 + 0.04 * pinceladas(pl, 2.0 * L, px * 2.0, sem + 75 + i, 16.0, -0.785, 0.6);
				vec2 nn = normalize(w / (rr * rr) + vec2(1e-5));
				float k = clamp(length(w / rr), 0.0, 1.0);
				vec2 rel_j = nn * mix(0.15 * k, 0.95, smoothstep(-2.8, -1.2, d));
				if (rm > 8.5) {
					// Nos cachos largos, um punhado de folhas por cima, bem fora do meio (para
					// um lado sorteado), como a camada do meio do arbusto: um degrau só, com a
					// sua beira inclinada; dois ou três degraus em roda viravam um repolho.
					float ang = TAU * rk(hc, 1);
					vec2 w2 = w - vec2(cos(ang), sin(ang)) * rr * 0.34;
					vec2 rr2 = rr * 0.58;
					float d2 = sd_elipse(w2, rr2) - jd_festao(w2, rm * 0.58, i * 4 + j, 1, sem, 0.26);
					float por_cima = cobre(d2, px);
					cor_j = mix(cor_j, cor_j * 1.07, por_cima);
					vec2 n2 = normalize(w2 / (rr2 * rr2) + vec2(1e-5));
					rel_j = mix(rel_j, n2 * mix(0.12, 0.8, smoothstep(-2.2, -0.9, d2)), por_cima);
				}
				float tem = cobre(d, px);
				c = mix(c, cor_j, tem);
				rel = mix(rel, rel_j, tem);
				if (d < d_massa) {
					traco_massa = traco;
				}
				d_massa = min(d_massa, d);
			}
		}
		c = mix(c, traco_massa, cobre(d_massa, px) - cobre(d_massa + 1.6, px));
		for (int i = 0; i < FL_N; i++) {
			vec2 v = q - vec2(FL_S[i], FL_C[i]);
			v.x = mod(v.x + L * 0.5, L) - L * 0.5;
			float R = FL_R[i];
			if (length(v) > R + 3.0) {
				continue;
			}
			uint h = hash_cel(vec2(float(i), 9.0), sem + 801);
			float ang = atan(v.y, v.x) + TAU * rk(h, 0);
			float pet = R * (0.6 + 0.4 * pow(abs(cos(2.5 * ang)), 0.8));
			float d = length(v) - pet;
			vec3 cor_flor = FL_TOM[i] == 0 ? mix(ROSA, LINHO, 0.4) : mix(BRANCO, LINHO, 0.4);
			float tem = cobre(d, px);
			c = mix(c, contorno_de(cor_flor), tem);
			c = mix(c, cor_flor, cobre(d + 1.1, px));
			float dm = length(v) - R * 0.32;
			c = mix(c, mix(MIOLO, cor_flor, 0.25), cobre(dm, px));
			rel = mix(rel, v / R * 0.6, tem);
		}
	}

	// O contorno de fora da caixa e a beira de fora, que inclina para fora.
	vec3 cont = contorno_de(jd_cor_da_tabua(q.x < 0.0 ? 4 : (q.y < 0.0 ? 0 : 2)));
	c = mix(c, cont, 1.0 - cobre(d_caixa + JD_TRACO, px));
	vec2 fora = normal_caixa(vec2(q.x - (JD_FIM + 500.0), q.y), vec2(500.0, JD_W), JD_CANTO);
	rel = mix(rel, fora * 0.85, smoothstep(-2.8, -1.4, d_caixa));
	cor = c;
	alfa = cobre(d_caixa, px);
}

vec4 pintar_trecho(vec2 q, float L, float meia, float ponta, float px, int sem) {
	vec3 c;
	float a;
	vec2 r;
	jd_pintar(q, L, px, sem, c, a, r);
	return vec4(c, a);
}

vec2 relevo_do_trecho(vec2 q, float L, float meia, float ponta, float px, int sem) {
	vec3 c;
	float a;
	vec2 r;
	jd_pintar(q, L, px, sem, c, a, r);
	return r;
}

#define TRECHO
#include "res://comum/rodape_carimbo.gdshaderinc"

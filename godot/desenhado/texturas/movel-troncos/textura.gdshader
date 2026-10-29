// TRONCOS desenhados que pegam cor (onda 4, lote 16; CONTRATO.md seção 10). Novos no app em
// 29/10 (lib/mobilia/pilhas.ts): um objeto com DUAS FORMAS no painel, cada uma com a pegada
// dela (variante com "vistas" próprias, como o tapete redondo):
// - TORAS (2 x 1, a forma de partida): troncos grandes deitados ao comprido em pirâmide, 3
//   embaixo, 2 no meio e 1 em cima. De cima se veem a tora de cima inteira, a metade de fora
//   das do meio e a beira das de baixo, cada fileira um tom abaixo e na sombra da de cima;
//   as pontas ficam em degrau (cada fileira mais curta) e cada ponta mostra o CORTE: a face
//   clara, o cerne um tom abaixo e um anel largo, fora do centro, como o tronco caído da
//   onda 3. A casca vai em faixas largas ao comprido, de largura sorteada por tora. As toras
//   crescem: o meio é liso (pontas 0,4375).
// - LENHA (1,5 x 0,5, "quando forma = lenha"): a lenha cortada em fileira, encostada na
//   parede (o lado de cima da pegada). As achas vão da parede para a frente, de largura e
//   comprimento desiguais, umas redondas com a casca, outras rachadas (as duas faces da
//   racha, uma na luz e outra não); na frente, o corte. Uma acha deitada por cima da ponta
//   da direita faz da fileira um monte. Nas frestas, o fundo escuro. O meio REPETE (10.6): um
//   módulo de 0,625 casa com 3 achas, a emenda no meio de uma fresta larga.
// AS TRÊS MADEIRAS (a classe casca da lenha: carvalho, pinho, bétula) se separam pelo
// DESENHO, não só pelo tom (o carvalho e o pinho do app têm quase a mesma cor):
// - o CARVALHO (variantes "lenhaDeCarvalho" e "torasDeCarvalho") é escuro, de casca funda:
//   duas fendas largas ao comprido que partem a faixa da luz; na lenha, quase toda rachada;
// - o PINHO e a BÉTULA ("lenha" e "toras") têm a casca lisa e um tom acima, com poucas
//   marcas largas de través perto das pontas (as placas do pinho, as manchas da bétula); a
//   bétula, de tom claro, sai branca de marcas escuras, e o pinho, avermelhado e liso.
// Nada de risquinho, anel miúdo, nó ou veio. Desenhado no referencial do móvel e aceso no
// da tela: a luz fica em cima à esquerda nas 2 viradas (de lado a lado é simétrico; de
// frente para trás, a lenha não: a parede fica atrás). Lugar 1 = a lenha. A sombra no chão é
// do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// As variantes, na ordem do config.json.
const int LENHA_DE_CARVALHO = 0;
const int TORAS_DE_CARVALHO = 2;

// ---- TORAS ----
// O meio liso: tudo o que muda ao longo fica além deste x (as pontas do config.json são
// 0,4375; a folga é a borda suave).
const float MEIO_LISO = 0.5625;
const float BOJO = 0.72;              // o quanto a ponta aparece, em raios (o corte deitado)
const float SOMBRA_DO_TOPO = 0.05;    // o quanto uma tora de cima sombreia as de baixo (casas)
// As toras, de baixo para cima (3, 2 e 1, a pirâmide): (meio y, raio, x do corte da
// esquerda, x do da direita). Cada fileira mais curta que a de baixo: as pontas em degrau.
const vec4 TORAS[6] = vec4[](
	vec4(-0.333, 0.163, -0.866, 0.878),
	vec4(0.002, 0.166, -0.884, 0.872),
	vec4(0.334, 0.162, -0.876, 0.860),
	vec4(-0.167, 0.168, -0.786, 0.796),
	vec4(0.168, 0.165, -0.796, 0.780),
	vec4(0.0, 0.172, -0.700, 0.708)
);
// A fileira de cada tora e o tom dela (a de baixo na sombra das de cima).
int fileira(int i) {
	return i < 3 ? 0 : (i < 5 ? 1 : 2);
}

// ---- LENHA ----
const float RY_DA_PONTA = 0.052;      // a meia altura do corte na frente da acha
// A emenda do módulo (10.6): o meio que repete vai de -EMENDA a +EMENDA. Nada que mude ao
// longo chega a menos de 0,04 casa dela (a costura confere 4 px para cada lado).
const float EMENDA = 0.3125;
// As achas, da esquerda para a direita: (meio x, meia largura, rachada no carvalho 0 ou 1,
// inclinação em radianos). Larguras e frestas desiguais, para a fileira não virar grade; as
// duas frestas largas são as da emenda. As vizinhas da emenda vão retas.
const vec4 ACHAS[7] = vec4[](
	vec4(-0.647, 0.087, 0.0, 0.045),
	vec4(-0.447, 0.095, 1.0, 0.0),
	vec4(-0.191, 0.080, 1.0, 0.0),
	vec4(0.004, 0.095, 1.0, 0.025),
	vec4(0.196, 0.075, 0.0, 0.0),
	vec4(0.441, 0.089, 1.0, 0.0),
	vec4(0.642, 0.092, 1.0, -0.040)
);
// (y de trás, y do corte da frente, rachada no pinho e na bétula 0 ou 1). A frente
// desencontrada: cada acha de um comprimento.
// As quatro vizinhas da emenda têm o mesmo fundo e a frente parecida: a faixa escura da emenda vai
// até onde a mais comprida delas vai, e não pode sobrar além das achas.
const vec3 ACHAS_B[7] = vec3[](
	vec3(-0.212, 0.150, 0.0),
	vec3(-0.230, 0.176, 0.0),
	vec3(-0.230, 0.180, 0.0),
	vec3(-0.222, 0.160, 1.0),
	vec3(-0.230, 0.178, 0.0),
	vec3(-0.230, 0.180, 0.0),
	vec3(-0.208, 0.196, 1.0)
);
// A faixa escura das emendas, de trás até a frente: o fundo das vizinhas e a frente delas mais
// o tanto do corte que fica a 3 px da beira (o resto do corte cobre a ponta da faixa). A MESMA nas duas
// emendas (toda emenda tem de ser a mesma coluna).
const vec2 FAIXA_DA_EMENDA = vec2(-0.232, 0.220);
// A acha de cima: deitada ao comprido por cima da ponta da direita, a fileira vira monte e
// não cerca. (meio, meia largura, meio comprimento), inclinação.
const vec4 ACHA_DE_CIMA = vec4(0.540, 0.0, 0.066, 0.135);
const float GIRO_DE_CIMA = -1.42;
const float SOMBRA_DE_CIMA = 0.030;   // o quanto ela sombreia as de baixo (casas)

// ---- A casca ----
// A casca da TORA em faixas largas ao comprido: xl = +1 na borda que olha para a luz, -1 na
// outra. Cinco faixas de largura sorteada por tora (h), cada uma num tom, mais claras para o
// lado da luz, e a beira de cima um pouco abaixo (a tora curva para longe da luz). É o que
// tira o "cano": a casca é um feixe de cristas, não um cilindro liso. O carvalho um tom
// abaixo.
float casca_da_tora(float xl, bool carvalho, float aa, uint h) {
	float b1 = -0.52 + 0.10 * (rk(h, 60) - 0.5);
	float b2 = -0.08 + 0.16 * (rk(h, 61) - 0.5);
	float b3 = 0.36 + 0.12 * (rk(h, 62) - 0.5);
	float b4 = 0.80 + 0.06 * (rk(h, 63) - 0.5);
	vec4 tons = carvalho ? vec4(V_FUNDO + 0.08, V_SOMBRA + 0.02, V_SOMBRA + 0.09, V_MEIO + 0.06) : vec4(V_SOMBRA + 0.03, V_MEIO - 0.01, V_MEIO + 0.05, V_LUZ + 0.05);
	float aba = carvalho ? V_MEIO - 0.01 : V_LUZ - 0.02;
	float v = mix(tons.x, tons.y, smoothstep(b1 - aa, b1 + aa, xl));
	v = mix(v, tons.z, smoothstep(b2 - aa, b2 + aa, xl));
	v = mix(v, tons.w, smoothstep(b3 - aa, b3 + aa, xl));
	return mix(v, aba, smoothstep(b4 - aa, b4 + aa, xl));
}

// A casca da ACHA (estreita) e dos paus: DUAS massas só, o corpo e a faixa da luz (três
// faixas numa acha de 10 px liam como código de barras); o carvalho um tom abaixo.
float casca(float xl, bool carvalho, float aa) {
	float luz = smoothstep(0.18 - aa, 0.18 + aa, xl);
	if (carvalho) {
		return mix(V_SOMBRA + 0.08, V_MEIO + 0.06, luz);
	}
	return mix(V_MEIO + 0.02, V_LUZ + 0.06, luz);
}

// Uma faixa de casca de xl0 a xl1 (a fenda ou a marca), com a cobertura a.
float faixa(float xl, float centro, float meia, float aa) {
	return 1.0 - smoothstep(meia - aa, meia + aa, abs(xl - centro));
}

// O CORTE: a face clara (o alburno), o cerne um tom abaixo, um anel largo e o miolo, tudo
// fora do centro (o miolo em "miolo", casas a partir do meio do corte). Dois anéis largos,
// como o tronco caído; na acha rachada o miolo fica fora da face e os anéis viram arcos.
void corte(inout vec4 av, inout vec4 ac, vec2 p, vec2 e, vec2 miolo, float face, float px) {
	float d = sd_elipse(p, e);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_SOMBRA - 0.08, 1, cobre(d, px));
	float co = min(0.016, 0.28 * min(e.x, e.y));
	float dentro = cobre(d + co, px);
	pousar(av, ac, face, 1, dentro);
	pousar(av, ac, face - 0.11, 1, dentro * cobre(sd_elipse(p - miolo * 0.45, e * 0.72), px));
	pousar(av, ac, face - 0.23, 1, dentro * cobre(sd_elipse(p - miolo * 0.75, e * 0.48), px));
	pousar(av, ac, face - 0.11, 1, dentro * cobre(sd_elipse(p - miolo * 0.92, e * 0.27), px));
}

// A face do corte pela luz da tela: a que olha para a luz, a mais clara; a de costas, ainda
// clara (o céu ilumina o topo da madeira).
float face_do_corte(vec2 para_fora, int vir) {
	float l = dot(tela_de(para_fora, vir), LUZ);
	return mix(V_LUZ + 0.07, V_REALCE + 0.06, smoothstep(-0.35, 0.35, l));
}

// ---------- TORAS ----------

// A silhueta de uma tora: o corpo entre os dois cortes e as pontas em elipse (o bojo).
float sd_tora(vec2 m, vec4 t) {
	float r = t.y;
	float d = max(abs(m.y - t.x) - r, max(m.x - t.w, t.z - m.x));
	d = min(d, sd_elipse(m - vec2(t.z, t.x), vec2(BOJO * r, r)));
	return min(d, sd_elipse(m - vec2(t.w, t.x), vec2(BOJO * r, r)));
}

// As fendas do carvalho: duas faixas fundas ao comprido, uma partindo a faixa da luz e outra
// no meio, que acabam um pouco antes das pontas (sempre além do meio liso).
void fendas_da_tora(inout vec4 av, inout vec4 ac, vec2 m, vec4 t, float xl, float aa, float dentro, uint h) {
	for (int k = 0; k < 2; k++) {
		float centro = k == 0 ? 0.52 + 0.1 * (rk(h, 0) - 0.5) : -0.26 + 0.14 * (rk(h, 1) - 0.5);
		float fim_a = mix(MEIO_LISO + 0.07, abs(t.z) - 0.04, rk(h, 2 + k));
		float fim_b = mix(MEIO_LISO + 0.07, abs(t.w) - 0.04, rk(h, 4 + k));
		float ao_longo = smoothstep(-fim_a, -fim_a + 0.06, m.x) * (1.0 - smoothstep(fim_b - 0.06, fim_b, m.x));
		float meia = (k == 0 ? 0.10 : 0.085) * ao_longo;
		float a = faixa(xl, centro, meia, aa) * step(0.001, ao_longo);
		pousar(av, ac, V_FUNDO + 0.01, 1, dentro * a * 0.92);
	}
}

// As marcas do pinho e da bétula: poucas faixas largas de través, só perto das pontas (o
// meio é liso), da borda da luz até o meio da tora.
void marcas_da_tora(inout vec4 av, inout vec4 ac, vec2 m, vec4 t, float xl, float px, float dentro, uint h) {
	float r = t.y;
	for (int k = 0; k < 4; k++) {
		float lado = k < 2 ? -1.0 : 1.0;
		float fim = lado < 0.0 ? abs(t.z) : abs(t.w);
		if (k % 2 == 1 && rk(h, 30 + k) < 0.45) {
			continue;
		}
		float x = lado * mix(MEIO_LISO + 0.05, fim - 0.05, rk(h, 10 + k));
		float meia = 0.017 + 0.009 * rk(h, 14 + k);
		float de = mix(-0.35, 0.25, rk(h, 18 + k));
		vec2 p = vec2(m.x - x, (xl - (de + 1.0) * 0.5) * r);
		float d = sd_caixa(p, vec2(meia, (1.0 - de) * 0.5 * r), meia * 0.9);
		pousar(av, ac, V_SOMBRA - 0.07, 1, dentro * cobre(d, px) * 0.9);
	}
}

void tora(inout vec4 av, inout vec4 ac, vec2 m, int i, bool carvalho, int vir, int sem, float px) {
	vec4 t = TORAS[i];
	float d = sd_tora(m, t);
	if (d > px) {
		return;
	}
	uint h = hash_cel(vec2(float(i), 3.0), sem + 71);
	float r = t.y;
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + contorno_para(vec2(r)), px);
	// A luz: o lado -y do móvel olha para a luz na virada 0 e para longe dela na 2.
	float s = sign(dot(tela_de(vec2(0.0, -1.0), vir), LUZ));
	float xl = -(m.y - t.x) / r * s;
	float aa = max(px / r, 0.02);
	// Cada fileira um tom: as de cima pegam a luz que as de baixo não pegam.
	int f = fileira(i);
	float tom = (f == 0 ? -0.07 : (f == 1 ? -0.015 : 0.04)) + 0.03 * (rk(h, 40) - 0.5);
	pousar(av, ac, casca_da_tora(xl, carvalho, aa, h) + tom, 1, dentro);
	if (carvalho) {
		fendas_da_tora(av, ac, m, t, xl, aa, dentro, h);
	} else {
		marcas_da_tora(av, ac, m, t, xl, px, dentro, h);
	}
	// Os dois cortes, com o miolo um pouco para o lado da sombra (a árvore cresceu torta).
	for (int k = 0; k < 2; k++) {
		float sx = k == 0 ? -1.0 : 1.0;
		vec2 e = vec2(BOJO * r, r) * 0.82;
		vec2 miolo = vec2(-sx * e.x * 0.14, e.y * (0.10 + 0.22 * (rk(h, 50 + k) - 0.5)) * s);
		corte(av, ac, m - vec2(k == 0 ? t.z : t.w, t.x), e, miolo, face_do_corte(vec2(sx, 0.0), vir) + tom * 0.5, px);
	}
	// A sombra das fileiras de cima nesta (a sombra de dentro, em valor): é o degrau da
	// pirâmide, a borda de baixo à direita de cada tora de cima escurece a de baixo.
	if (f < 2) {
		vec2 off = movel_de(-LUZ * SOMBRA_DO_TOPO, vir);
		float ds = sd_tora(m - off, TORAS[5]);
		if (f == 0) {
			ds = min(ds, min(sd_tora(m - off, TORAS[3]), sd_tora(m - off, TORAS[4])));
		}
		pousar(av, ac, V_FUNDO - 0.03, 1, dentro * (1.0 - smoothstep(-0.012, 0.012, ds)) * 0.7);
	}
}

void toras(vec2 q, float px, bool carvalho, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	for (int i = 0; i < 6; i++) {
		tora(av, ac, m, i, carvalho, vir, sem, px);
	}
}

// ---------- LENHA ----------

// Uma acha no referencial dela: x de través, y ao comprido, de -l (atrás) a +l (o corte).
float sd_acha(vec2 p, float w, float l) {
	// A ponta de trás serrada, de canto vivo (encostada na parede).
	float d = sd_caixa(p, vec2(w, l), 0.012);
	return min(d, sd_elipse(p - vec2(0.0, l), vec2(w, RY_DA_PONTA)));
}

// O corte da acha: a face clara e o cerne numa massa só, fora do centro. Numa acha de 10 px
// dois anéis viravam anel miúdo.
void corte_da_acha(inout vec4 av, inout vec4 ac, vec2 p, vec2 e, vec2 miolo, float face, float px) {
	float d = sd_elipse(p, e);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_SOMBRA - 0.08, 1, cobre(d, px));
	float dentro = cobre(d + min(0.014, 0.26 * min(e.x, e.y)), px);
	pousar(av, ac, face, 1, dentro);
	pousar(av, ac, face - 0.13, 1, dentro * cobre(sd_elipse(p - miolo * 0.6, e * 0.52), px));
}

// Uma acha de meio c, inclinada ang, meia largura w e meio comprimento l. A REDONDA tem a casca
// em duas massas (o carvalho, mais uma fenda funda; o pinho e a bétula, lisa: marca de
// través numa acha de 10 px virava risquinho). A RACHADA mostra as duas faces da racha, que se encontram numa
// quina ao comprido: a que olha para a luz, a madeira clara; a outra, um tom abaixo; e uma
// tira de casca na beira do lado "lado". tom = o tom da acha (a de cima, mais clara).
void acha(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, float w, float l, float ang, bool rachada, float lado, bool carvalho, float tom, int vir, float px) {
	vec2 p = girar(m - c, -ang);
	float d = sd_acha(p, w, l);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + contorno_para(vec2(w)), px);
	// s > 0: o lado -x da acha olha para a luz.
	float s = sign(dot(tela_de(girar(vec2(-1.0, 0.0), ang), vir), LUZ));
	float aa = max(px / w, 0.02);
	float xn = p.x / w;
	// Ao longo, do fundo até antes do corte.
	float ao_longo = smoothstep(-l + 0.03, -l + 0.06, p.y) * (1.0 - smoothstep(l - 0.05, l - 0.02, p.y));
	if (rachada) {
		float quina = -lado * 0.18;
		// A madeira de dentro, bem mais clara que a casca: é ela que diz "rachada".
		float clara = carvalho ? V_LUZ + 0.06 : V_LUZ + 0.12;
		float funda = carvalho ? V_MEIO : V_MEIO + 0.08;
		// A face de -x olha para a luz quando s > 0.
		float de_menos = s > 0.0 ? clara : funda;
		float de_mais = s > 0.0 ? funda : clara;
		float v = mix(de_menos, de_mais, smoothstep(quina - aa, quina + aa, xn));
		// A tira de casca, na beira do lado da casca.
		float tira = smoothstep(0.66 - aa, 0.66 + aa, xn * lado);
		v = mix(v, (carvalho ? V_FUNDO + 0.07 : V_SOMBRA + 0.02), tira);
		pousar(av, ac, v + tom, 1, dentro);
	} else {
		float xl = -xn * s;
		pousar(av, ac, casca(xl, carvalho, aa) + tom, 1, dentro);
		if (carvalho) {
			// A fenda do carvalho, no corpo (fora da faixa da luz).
			pousar(av, ac, V_FUNDO + 0.02, 1, dentro * faixa(xl, -0.20, 0.17, aa) * ao_longo * 0.92);
		}
	}
	// O corte, na ponta da frente: na redonda, o miolo perto do meio; na rachada, no canto da
	// casca.
	vec2 e = vec2(w * 0.86, RY_DA_PONTA * 0.84);
	vec2 miolo = rachada ? vec2(lado * w * 0.95, e.y * 0.6) : vec2(0.18 * w, e.y * 0.15);
	float face = face_do_corte(girar(vec2(0.0, 1.0), ang), vir) - 0.05 + tom * 0.5;
	corte_da_acha(av, ac, p - vec2(0.0, l), e, miolo, face, px);
}

void lenha(vec2 q, float px, bool carvalho, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 h = pegada_do_movel(vir) * 0.5;
	// O fundo, escuro, que só aparece nas frestas: uma caixa por dentro das achas (fica
	// escondida nas pontas, sem moldura em volta da fileira) e, nas duas emendas, uma faixa da
	// parede até a frente. A faixa cobre a altura de todas as achas: a borda quase invisível da
	// imagem em volta de cada forma fica dentro dela na emenda do módulo.
	float dg = sd_caixa(m - vec2(0.0, -0.03), vec2(h.x - 0.05, 0.170), 0.03);
	vec2 fe = FAIXA_DA_EMENDA;
	float de = sd_caixa(vec2(abs(m.x) - EMENDA, m.y - (fe.x + fe.y) * 0.5), vec2(0.040, (fe.y - fe.x) * 0.5), 0.004);
	float db = min(dg, de);
	pousar(av, ac, V_CONTORNO + 0.03, 1, cobre(db, px));
	for (int i = 0; i < 7; i++) {
		vec4 a = ACHAS[i];
		vec3 b = ACHAS_B[i];
		uint hh = hash_cel(vec2(float(i), 5.0), sem + 83);
		float tom = 0.05 * (rk(hh, 0) - 0.5);
		bool rachada = carvalho ? a.z > 0.5 : b.z > 0.5;
		float lado = rk(hh, 1) < 0.5 ? -1.0 : 1.0;
		vec2 c = vec2(a.x, (b.x + b.y) * 0.5);
		acha(av, ac, m, c, a.y, (b.y - b.x) * 0.5, a.w, rachada, lado, carvalho, tom, vir, px);
	}
	// A acha de cima e a sombra dela nas de baixo (só onde já tem lenha).
	vec2 cc = ACHA_DE_CIMA.xy;
	vec2 off = movel_de(-LUZ * SOMBRA_DE_CIMA, vir);
	float ds = sd_acha(girar(m - off - cc, -GIRO_DE_CIMA), ACHA_DE_CIMA.z, ACHA_DE_CIMA.w);
	pousar(av, ac, V_FUNDO - 0.02, 1, av.a * (1.0 - smoothstep(-0.010, 0.010, ds)) * 0.65);
	acha(av, ac, m, cc, ACHA_DE_CIMA.z, ACHA_DE_CIMA.w, GIRO_DE_CIMA, carvalho, 1.0, carvalho, 0.04, vir, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	bool carvalho = qual == LENHA_DE_CARVALHO || qual == TORAS_DE_CARVALHO;
	if (qual < TORAS_DE_CARVALHO) {
		lenha(q, px, carvalho, vir, sem, av, ac);
	} else {
		toras(q, px, carvalho, vir, sem, av, ac);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

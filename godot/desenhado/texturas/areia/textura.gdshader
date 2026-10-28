// Areia: chão de praia. Lote 2 da onda 1.
// Base: o campo claro e frio da areia (mais clara e mais amarela que a terra, que é
// alaranjada), manchas largas de areia úmida (mais funda e acinzentada) e seca (mais
// pálida), e a ondulação do vento: ondas largas (2,2 a 2,8 casas) e baixas, com a
// encosta suave para o vento e a face mais curta do outro lado, que se leem só pela luz
// de cima à esquerda. A onda serpenteia (a fase é torcida por ruído largo), cada
// variante tem a sua largura e direção, e a força varia em manchas de 4 casas: nunca
// uma listra regular.
// O atlas leva os marcos, raros: conchas (vieira, búzio, amêijoa, caco), seixo cinza,
// um graveto de deriva e, quase sempre, manchas macias de areia úmida e seca.
//
// Paleta, para a `duna` (lote 3) reaproveitar: AREIA #dbc695 entre AREIA_SOMBRA #bca77a
// e AREIA_REALCE #f2dca5; úmida AREIA_UMIDA #bcaa86; seca AREIA_SECA #e2d2a9.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta (client/src/texturas/meioTermo/paleta.ts). LINHO, REBOCO, BRANCO, ROSA, VIOLETA,
// PRACA_SOMBRA, SEIXO_CINZA, PEDRA e CARVALHO vêm da base.
const vec3 PALHA = vec3(0.839, 0.710, 0.416);   // #d6b56a palha
const vec3 GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b granito
// Tons da areia, todos misturas da paleta.
const vec3 AREIA = vec3(0.859, 0.778, 0.583);        // #dbc695 linho 65% + palha 35%, +3% de luz
const vec3 AREIA_REALCE = vec3(0.948, 0.862, 0.646); // #f2dca5 realce_de(AREIA)
const vec3 AREIA_SOMBRA = vec3(0.739, 0.654, 0.478); // #bca77a sombra_de(AREIA)
const vec3 AREIA_UMIDA = vec3(0.738, 0.667, 0.524);  // #bcaa86 sombra 55% + praça sombra 45%
const vec3 AREIA_SECA = vec3(0.886, 0.823, 0.663);   // #e2d2a9 areia 65% + reboco 35%

// ---------- base ----------

// A ondulação: ciclos por ladrilho em x e y (inteiros: a onda repete no ladrilho).
// Cada variante tem a sua: (3, 2) e (2, 3) dão 142 px (2,2 casas) entre cristas e (2, 2)
// 181 px, com as cristas a 11 graus umas das outras. Onde duas variantes se misturam,
// uma onda se divide em duas, como na praia. Com a mesma onda nas 3, a repetição a 8
// casas caía para 0,78; com 1,5 casa entre cristas (rodada 5) a 25% a praia inteira
// virava listra. Nenhuma componente é 1: com (3, 1) a onda andava só 1/8 de volta a 7 e
// a 9 casas na vertical, quase igual ao ladrilho, e a repetição caía.
// O vento sopra para +k: a encosta suave fica do lado da luz e a face curta, na sombra.
vec2 onda_k(int qual) {
	return qual == 1 ? vec2(2.0, 2.0) : (qual == 2 ? vec2(2.0, 3.0) : vec2(3.0, 2.0));
}

// A fase é torcida só por ruído largo (4 casas) e um resto de 2: crista longa e curva,
// nunca tremida. Com a torção de 2 casas da rodada 1 a onda virava pano amassado; com
// torção forte (2,2 voltas, rodada 9) a crista fechava em laços e virava rabisco.
float fase_onda(vec2 p, float P, int s, vec2 k) {
	float w = (rz(p, 256.0, P, s + 20) - 0.5) * 1.0 + (rz(p, 128.0, P, s + 21) - 0.5) * 0.15;
	return dot(p, k) / P + w;
}

// Sobe por 58% da onda (do lado do vento) e desce no resto. Com a face curta de 30%
// (rodada 10) a sombra dela virava vírgulas escuras a 25%.
float perfil_onda(float f) {
	float t = fract(f);
	return t < 0.58 ? smoothstep(0.0, 1.0, t / 0.58) : 1.0 - smoothstep(0.0, 1.0, (t - 0.58) / 0.42);
}

float altura_onda(vec2 p, float P, int s, vec2 k) {
	return perfil_onda(fase_onda(p, P, s, k));
}

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (4 casas), entre a sombra e o realce da areia, a um quinto.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = rz(p, 128.0, P, s + 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(AREIA, mix(AREIA_SOMBRA, AREIA_REALCE, t), 0.22);
	// 2. Úmida e seca, em manchas de 2 a 3 casas torcidas e de borda bem macia.
	vec2 w = vec2(rz(p, 128.0, P, s + 4), rz(p, 128.0, P, s + 14)) - 0.5;
	float n_b = rz(p + 32.0 * w, 128.0, P, s + 3) * 0.8 + rz(p + 32.0 * w, 64.0, P, s + 13) * 0.2;
	float seca = smoothstep(0.52, 0.8, n_b);
	float umida = smoothstep(0.45, 0.18, n_b);
	c = mix(c, AREIA_SECA, seca * 0.28);
	c = mix(c, AREIA_UMIDA, umida * 0.2);
	// As variantes têm o mesmo tom médio: só o desenho muda. Com 1 a 2% de diferença
	// (rodada 16) a borda entre elas, torta no ruído de 0,6 casa da mistura, virava
	// nuvens miúdas a 50%.
	// 3. A ondulação, só pela luz, em toda a praia: mais marcada em manchas de 4 casas,
	//    mais apagada no resto. Com ela só em manchas pequenas (rodada 4) cada mancha
	//    mostrava uma crista só, e a crista solta virava uma mancha escura em cunha.
	float na = rz(p, 256.0, P, s + 24) * 0.85 + rz(p, 128.0, P, s + 25) * 0.15;
	float m = 0.4 + 0.6 * smoothstep(0.4, 0.68, na);
	vec2 k = onda_k(qual);
	float hA = altura_onda(p - LUZ * 3.0, P, s, k);
	float hB = altura_onda(p + LUZ * 3.0, P, s, k);
	// O teto tira as manchas escuras onde a torção aperta a onda (face curta mais
	// íngreme) e iguala a face da sombra das 3 variantes, de ondas de largura diferente.
	c *= 1.0 + 0.21 * m * clamp(hA - hB, -0.12, 0.12);
	// 4. Relevo fino de areia (1/4 e 1/8 de casa) com luz: no close a 300% o chão tem
	//    grão; a 50% a média é zero e ele some na cor.
	float gA = smoothstep(0.3, 0.7, rz(p - LUZ, 16.0, P, s + 9));
	float gB = smoothstep(0.3, 0.7, rz(p + LUZ, 16.0, P, s + 9));
	float fA = smoothstep(0.25, 0.75, rz(p - LUZ * 0.9, 8.0, P, s + 19));
	float fB = smoothstep(0.25, 0.75, rz(p + LUZ * 0.9, 8.0, P, s + 19));
	c *= 1.0 + 0.025 * (gA - gB) + 0.045 * (fA - fB);
	// 5. Sem pinceladas: na areia lisa as de 1 casa (rodada 4) liam como riscos curtos
	//    na direção das cristas, e a 25% a praia ficava arranhada.
	c *= grao(p, P, s + 16);
	return c;
}

// ---------- atlas ----------

// Cores das conchas e do que a maré deixa: claras e contidas, perto da areia.
const vec3 CONCHA_ROSA = vec3(0.944, 0.870, 0.860);  // branco 78% + rosa 22%
const vec3 CONCHA_CREME = vec3(0.886, 0.851, 0.755); // linho 55% + branco 45%
const vec3 CONCHA_PALHA = vec3(0.835, 0.745, 0.531); // linho 50% + palha 50%
const vec3 CONCHA_LILAS = vec3(0.909, 0.871, 0.872); // branco 85% + violeta 15%
const vec3 DERIVA = vec3(0.750, 0.661, 0.515);       // linho 60% + carvalho 40% (madeira lavada)

// Distância a uma forma torta (de terra): círculo achatado e girado, com 3 harmônicos.
float dist_torta(vec2 q, vec2 c, float r, float achata, float ang, float torto, uint h) {
	vec2 lq = girar(q - c, -ang);
	lq.y *= achata;
	float th = atan(lq.y, lq.x);
	float f = 1.0 + torto * (0.12 * cos(th + TAU * rk(h, 0)) + 0.08 * cos(2.0 * th + TAU * rk(h, 1))
			+ 0.05 * cos(3.0 * th + TAU * rk(h, 2)));
	return (length(lq) - r * f) / sqrt(achata);
}

// A sombra macia de uma forma, para baixo e para a direita.
vec4 sombra_em(vec4 acc, float ds, float alfa) {
	return sobre(acc, SOMBRA, (1.0 - smoothstep(-1.5, 2.2, ds)) * alfa);
}

// Corpo com contorno da própria cor escurecida (2 px do lado da sombra, 1 do lado da
// luz) e luz de cima à esquerda. "luz" vai de -1 (sombra) a 1 (luz).
vec4 corpo_em(vec4 acc, float d, float luz, vec3 cor, float px) {
	acc = sobre(acc, contorno_de(cor), cobre(d, px) * 0.6);
	vec3 corpo = mix(sombra_de(cor), realce_de(cor), smoothstep(-0.8, 0.9, luz));
	float dentro = d + mix(2.0, 0.9, smoothstep(-0.7, 0.7, luz));
	return sobre(acc, corpo, cobre(dentro, px));
}

// Setor de círculo com a ponta na origem, abrindo para -y; meia abertura a, raio r.
float sd_leque(vec2 p, float a, float r) {
	p.x = abs(p.x);
	p.y = -p.y;
	vec2 cs = vec2(sin(a), cos(a));
	float l = length(p) - r;
	float m = length(p - cs * clamp(dot(p, cs), 0.0, r));
	return max(l, m * sign(cs.y * p.x - cs.x * p.y));
}

// Vieira vista de cima: um leque de 7 costelas com a borda ondulada e as duas
// orelhinhas na charneira. R = meia largura, em px do mundo. "quebra" > 0 corta a
// concha por uma linha torta (o caco): quanto maior, mais se perde.
vec4 vieira_em(vec4 acc, vec2 q, vec2 c, float R, float ang, vec3 cor, float px, float quebra) {
	const float ABRE = 0.95;
	const float COSTELAS = 7.0;
	vec2 l = girar(q - c, -ang);
	vec2 pp = l - vec2(0.0, 0.5 * R);
	float L = 1.05 * R;
	float th = atan(pp.x, -pp.y);
	float u = (th + ABRE) / (2.0 * ABRE) * COSTELAS;
	float borda = cos(TAU * (fract(u) - 0.5)) * smoothstep(0.5 * L, L, length(pp));
	float d = sd_leque(pp, ABRE, L - 2.0) - 2.0 - 0.55 * (R / 17.0) * borda;
	d = min(d, sd_caixa(pp - vec2(0.0, -1.2), vec2(0.34 * R, 1.6), 1.0));
	vec2 ls = girar(q - vec2(1.6, 1.9) - c, -ang) - vec2(0.0, 0.5 * R);
	float ds = min(sd_leque(ls, ABRE, L - 2.0) - 2.0, sd_caixa(ls - vec2(0.0, -1.2), vec2(0.34 * R, 1.6), 1.0));
	if (quebra > 0.0) {
		// A linha da quebra atravessa o leque na diagonal, num zigue-zague largo (com dentes
		// de 3 px, rodada 3, a quebra virava franja de espinhos).
		vec2 n = normalize(vec2(0.8, -0.6));
		float t = dot(l, vec2(-n.y, n.x));
		float corte = dot(l, n) - (1.0 - quebra) * R + 1.5 * sin(t * 0.5 + 0.8);
		d = max(d, corte);
		vec2 lsq = girar(q - vec2(1.6, 1.9) - c, -ang);
		float ts = dot(lsq, vec2(-n.y, n.x));
		ds = max(ds, dot(lsq, n) - (1.0 - quebra) * R + 1.5 * sin(ts * 0.5 + 0.8));
	}
	acc = sombra_em(acc, ds, 0.18);
	acc = corpo_em(acc, d, dot((q - c) / R, LUZ), cor, px);
	// Sulcos entre as costelas, finos e claros de perto, somem perto da charneira.
	float g = min(fract(u), 1.0 - fract(u)) * (2.0 * ABRE / COSTELAS) * length(pp);
	float sulco = (1.0 - smoothstep(0.3, 1.0, g)) * smoothstep(3.0, 7.0, length(pp));
	sulco *= step(0.5, u) * step(u, COSTELAS - 0.5);
	acc = sobre(acc, sombra_de(cor) * 0.92, cobre(d + 1.5, px) * sulco * 0.5);
	return acc;
}

// A forma do búzio: um fuso (afina para as duas pontas, a espiral mais comprida que o
// canal), com a volta do corpo larga. Na rodada 1 era uma gota com rabo: lia como
// alfinete de mapa.
float dist_buzio(vec2 l, float L) {
	vec2 A = vec2(-0.12 * L, 0.0);
	float corpo = sd_elipse(l - A, vec2(0.3 * L, 0.23 * L));
	float espira = sd_traco(l, A + vec2(0.1 * L, 0.0), vec2(0.5 * L, -0.02 * L), 0.18 * L, 0.03 * L);
	float canal = sd_traco(l, A, vec2(-0.48 * L, 0.04 * L), 0.12 * L, 0.035 * L);
	return min(corpo, min(espira, canal));
}

// Búzio: o fuso, 4 voltas da espiral (mais juntas na ponta) e a boca de um lado.
// L = comprimento, em px do mundo.
vec4 buzio_em(vec4 acc, vec2 q, vec2 c, float L, float ang, vec3 cor, vec3 faixa, float px) {
	vec2 l = girar(q - c, -ang);
	float d = dist_buzio(l, L);
	acc = sombra_em(acc, dist_buzio(girar(q - vec2(1.6, 1.9) - c, -ang), L), 0.18);
	acc = corpo_em(acc, d, dot((q - c) / (0.3 * L), LUZ), cor, px);
	// As voltas: arcos inclinados que atravessam a espira, mais juntos na ponta.
	float x = l.x + 0.35 * abs(l.y);
	float volta = 0.0;
	for (int k = 0; k < 4; k++) {
		float xk = L * (0.08 + 0.13 * float(k) - 0.012 * float(k * k));
		volta = max(volta, 1.0 - smoothstep(0.45, 1.2, abs(x - xk)));
	}
	acc = sobre(acc, mix(sombra_de(cor), faixa, 0.6), cobre(d + 1.4, px) * volta * 0.7);
	// A boca: uma fenda comprida e escura ao longo do corpo, do lado de baixo.
	float boca = sd_elipse(l - vec2(-0.16 * L, 0.07 * L), vec2(0.2 * L, 0.055 * L));
	acc = sobre(acc, mix(contorno_de(cor), faixa, 0.35), cobre(boca, px) * 0.5);
	return acc;
}

// Amêijoa: concha oval lisa, com 2 linhas de crescimento em arco ao redor da
// charneira e 2 raios de cor saindo dela (é o que a separa de um seixo).
vec4 ameijoa_em(vec4 acc, vec2 q, vec2 c, float r, float ang, vec3 cor, vec3 raio, float px, uint h) {
	float d = dist_torta(q, c, r, 1.3, ang, 0.5, h);
	acc = sombra_em(acc, dist_torta(q - vec2(1.6, 1.9), c, r * 1.03, 1.3, ang, 0.5, h), 0.18);
	acc = corpo_em(acc, d, dot((q - c) / r, LUZ), cor, px);
	vec2 l = girar(q - c, -ang);
	vec2 umbo = vec2(0.0, -0.78 * r / 1.3);
	vec2 du = l - umbo;
	float th = atan(du.x, du.y);
	float raios = 0.0;
	for (int k = 0; k < 2; k++) {
		float t0 = (float(k) - 0.5) * 0.75 + 0.15 * (rk(h, 30) - 0.5);
		raios = max(raios, 1.0 - smoothstep(0.08, 0.2, abs(th - t0)));
	}
	raios *= smoothstep(0.2 * r, 0.6 * r, length(du));
	acc = sobre(acc, raio, cobre(d + 2.0, px) * raios * 0.3);
	// 3 linhas de crescimento e a beira um pouco mais funda: lisa e branca, a
	// amêijoa da rodada 3 lia como ovo.
	float arco = 0.0;
	for (int k = 0; k < 3; k++) {
		float rho = r * (0.55 + 0.33 * float(k));
		arco = max(arco, 1.0 - smoothstep(0.4, 1.1, abs(length(du) - rho)));
	}
	acc = sobre(acc, sombra_de(cor) * 0.92, cobre(d + 1.6, px) * arco * 0.65);
	float beira = 1.0 - smoothstep(1.8, 4.5, -d);
	acc = sobre(acc, sombra_de(cor), cobre(d + 1.6, px) * beira * 0.3);
	return acc;
}

// Seixo liso e cinza, gasto pela água.
vec4 seixo_em(vec4 acc, vec2 q, vec2 c, float r, float achata, float ang, vec3 cor, float px, uint h) {
	float d = dist_torta(q, c, r, achata, ang, 0.8, h);
	acc = sombra_em(acc, dist_torta(q - vec2(1.6, 1.9), c, r * 1.04, achata, ang, 0.8, h), 0.18);
	return corpo_em(acc, d, dot((q - c) / r, LUZ), cor, px);
}

// Traço (graveto): distância e a luz de cilindro, do lado da luz ao da sombra.
vec2 traco_luz(vec2 p, vec2 a, vec2 b, float ra, float rb) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	vec2 off = pa - ba * hh;
	float r = mix(ra, rb, hh);
	return vec2(length(off) - r, dot(off / r, LUZ));
}

// Graveto de deriva: madeira lavada e clara, levemente torta, com um toco de galho.
vec4 graveto_em(vec4 acc, vec2 q, float ang, float px, uint h) {
	// Os pontos do graveto, já girados para o mundo (a luz do cilindro é do mundo).
	vec2 P0 = girar(vec2(-22.0, 3.0), ang);
	vec2 P1 = girar(vec2(-1.0, -1.5 + 2.0 * rk(h, 3)), ang);
	vec2 P2 = girar(vec2(21.0, 1.5), ang);
	vec2 T0 = P1 + girar(vec2(4.0, -1.0), ang);
	vec2 T1 = P1 + girar(vec2(10.0, -8.0), ang);
	vec2 qs = q - vec2(1.6, 1.9);
	float ds = min(min(sd_traco(qs, P0, P1, 3.4, 2.8), sd_traco(qs, P1, P2, 2.8, 1.9)), sd_traco(qs, T0, T1, 1.6, 1.0));
	acc = sombra_em(acc, ds, 0.2);
	vec2 s0 = traco_luz(q, P0, P1, 3.4, 2.8);
	vec2 s1 = traco_luz(q, P1, P2, 2.8, 1.9);
	vec2 s2 = traco_luz(q, T0, T1, 1.6, 1.0);
	vec2 s = s0.x < s1.x ? s0 : s1;
	s = s2.x < s.x ? s2 : s;
	acc = corpo_em(acc, s.x, s.y, DERIVA, px);
	// Um veio comprido da madeira lavada, do lado da sombra.
	vec2 off = girar(vec2(0.0, 0.9), ang);
	float veio = cobre(sd_traco(q - off, mix(P0, P1, 0.25), mix(P1, P2, 0.7), 0.4, 0.3), px);
	return sobre(acc, sombra_de(DERIVA), cobre(s.x + 1.2, px) * veio * 0.45);
}

// Mancha de 1 casa sem contorno: areia úmida (mais funda) ou seca (mais pálida).
vec4 mancha_em(vec4 acc, vec2 q, vec2 c, float r, vec3 cor, float alfa, float ang, uint h) {
	float d = dist_torta(q, c, r, 1.25, ang, 1.2, h);
	float a = 1.0 - smoothstep(-r * 0.55, 0.0, d);
	return sobre(acc, cor, a * a * (3.0 - 2.0 * a) * alfa);
}

// O atlas (16 células de 1 casa). Conchas são raras (13% dos pesos) e cada uma é uma
// peça só ou um par desigual e separado; a maioria dos detalhes são manchas macias.
//   0 vieira rosada   1 vieira creme   2 búzio   3 amêijoa lilás   4 amêijoa palha
//   5 vieira quebrada   6 seixo cinza   7 seixo e amêijoa pequena   8 graveto de deriva
//   9 vieira numa mancha úmida   10-12 mancha úmida   13-14 mancha seca
//   15 amêijoa e seixo pequeno
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 5.0), 6113);
	uint h2 = hash_cel(vec2(float(i), 6.0), 6113);
	vec4 acc = vec4(0.0);
	float ang = TAU * rk(h, 20);
	float a2 = TAU * rk(h, 23);
	vec3 seixo = mix(SEIXO_CINZA, PEDRA, 0.4);
	// Conchas de meia casa ou mais, e poucas: na rodada 1 (um terço de casa) e na 2
	// (0,4 casa, 150 marcos na área) a 25% a praia virava pimenta branca.
	vec3 raio = mix(ROSA, VIOLETA, 0.4);
	if (i == 0) {
		acc = vieira_em(acc, q, vec2(0.0), 19.0, ang, CONCHA_ROSA, px, 0.0);
	} else if (i == 1) {
		acc = vieira_em(acc, q, vec2(0.0), 17.0, ang, CONCHA_CREME, px, 0.0);
	} else if (i == 2) {
		acc = buzio_em(acc, q, vec2(0.0), 40.0, ang, CONCHA_PALHA, mix(PALHA, CARVALHO, 0.3), px);
	} else if (i == 3) {
		acc = ameijoa_em(acc, q, vec2(0.0), 15.0, ang, CONCHA_LILAS, raio, px, h);
	} else if (i == 4) {
		acc = ameijoa_em(acc, q, vec2(0.0), 14.0, ang, CONCHA_PALHA, mix(PALHA, CARVALHO, 0.4), px, h);
	} else if (i == 5) {
		acc = vieira_em(acc, q, vec2(0.0), 17.0, ang, CONCHA_CREME, px, 0.55);
	} else if (i == 6) {
		acc = seixo_em(acc, q, vec2(0.0), 10.0 + 2.0 * rk(h, 21), 1.25, ang, seixo, px, h);
	} else if (i == 7) {
		// Par desigual e separado (encostados, na rodada 12 a concha saía de trás da
		// pedra; e a vieira pequena ficava de dentes de serra).
		vec2 dir = vec2(cos(a2), sin(a2));
		acc = ameijoa_em(acc, q, dir * 13.0, 7.0, ang + 2.0, CONCHA_ROSA, raio, px, h2);
		acc = seixo_em(acc, q, -dir * 6.0, 8.0, 1.2, ang, mix(seixo, GRANITO, 0.35), px, h);
	} else if (i == 8) {
		acc = graveto_em(acc, q, (rk(h, 21) - 0.5) * 1.4 - 0.4, px, h);
	} else if (i == 9) {
		acc = mancha_em(acc, q, vec2(1.5, 2.0), 20.0, AREIA_UMIDA, 0.2, ang, h2);
		acc = vieira_em(acc, q, vec2(0.0), 15.0, ang, CONCHA_CREME, px, 0.0);
	} else if (i <= 12) {
		acc = mancha_em(acc, q, vec2(0.0), 18.0 + 3.0 * rk(h, 21), AREIA_UMIDA, 0.1, ang, h);
	} else if (i <= 14) {
		acc = mancha_em(acc, q, vec2(0.0), 19.0 + 2.5 * rk(h, 21), AREIA_SECA, 0.12, ang, h);
	} else {
		vec2 dir = vec2(cos(a2), sin(a2));
		acc = seixo_em(acc, q, dir * 15.0, 5.0, 1.2, ang + 0.7, seixo, px, h2);
		acc = ameijoa_em(acc, q, -dir * 5.0, 11.5, ang, CONCHA_CREME, raio, px, h);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

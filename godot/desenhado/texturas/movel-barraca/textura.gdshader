// BARRACA DE FEIRA desenhada que pega cor (onda 4, lote 12; CONTRATO.md seção 10).
//
// Da família do piloto e dos lotes 10 e 11: contorno grosso na própria cor, formas grandes
// e luz em poucas massas, a de cima à esquerda. O pano segue a régua do cobertor da cama
// (movel-catre): massas largas e curvas, uma dobra calma por pano, sem costura nem xadrez.
// Lugares: 1 = o toldo (tecido), 2 = a madeira (o balcão e os esteios). Os montes de
// mercadoria (o saco de grão e as frutas) são cor própria (os PRODUTOS do app), tirada pela
// mesma rampa OKLab da família (cor_fixa), para andar como as partes tingidas.
//
// DE CIMA (a frente, 2 x 2; 2 viradas: simétrica de lado a lado, não de frente para trás):
// - o TOLDO de duas águas, o que mais aparece: 3 panos largos (os de fora no tom do tecido,
//   o do meio mais claro), a água de trás na luz e a da frente mais funda, a cumeeira macia
//   (o pano dobrando por cima da vara, que fica escondida), e uma dobra calma por pano na
//   água da frente, em leque, puxada para as quinas onde os esteios seguram o pano;
// - a BEIRA da frente recortada em 3 festões largos, um por pano;
// - o BALCÃO aparecendo na frente, com a face para baixo e à direita na tela, a sombra curta
//   dos festões no tampo e 3 montes grandes: o saco aberto no meio e um monte de frutas de
//   cada lado, espelhados. A fileira é simétrica de propósito: com 2 viradas, a de 90 e a de
//   270 graus saem transpostas (espelhadas), e só uma fileira simétrica gira sem trocar de
//   ordem (4 viradas não cabem no teto de 3 MiB por vista com a cor própria).
// DE LADO (a Frente/Lado do mestre, 2 x 2, a barraca em pé vista de frente; 2 viradas, a
// mesma regra): o toldo inclinado em trapézio com os mesmos 3 panos e dobras em leque, os
// festões, os dois esteios com o vão aberto (o chão aparece) e o balcão de duas tábuas
// deitadas com os mesmos 3 montes em cima, no mesmo x da vista de cima. As dobras dos panos
// de fora também são espelhadas, e a do meio desce reta, pelo mesmo motivo.
// Desenhada no referencial da barraca e acesa no da tela (movel_de / tela_de). Margem 0: tudo
// fica dentro da pegada. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const int PANOS = 3;
const float PANO_CLARO = 0.16;       // o quanto os panos claros sobem do tom do tecido
const vec2 DOBRA_CRISTA = vec2(0.026, 0.056); // meia largura do rolo: nas pontas, no meio
const vec2 DOBRA_SOMBRA = vec2(0.030, 0.062);
const float DOBRA_CLARA = 0.045;     // o rolo, sobre o tom do pano
const float DOBRA_FUNDA = 0.065;     // a sombra curta dele
const vec2 S_DOBRA = vec2(0.022, 0.026);      // para onde a sombra da dobra anda, na tela

// ---- De cima (y = -1 atrás, 1 na frente) ----
const float TOLDO_X = 0.90;          // meia largura do toldo
const float TOLDO_TRAS = -0.955;
const float CUMEEIRA_Y = -0.52;
const float CUMEEIRA_MACIA = 0.035; // a meia largura da passagem de uma água para a outra
const float BEIRA_Y = 0.14;          // a beira da frente, onde os festões começam
const float R_TOLDO = 0.05;
const float FESTAO_FUNDO = 0.16;     // o quanto o festão desce da beira
const float AGUA_TRAS = 0.09;        // a água de trás, quando olha para a luz
const float AGUA_FRENTE = -0.05;
const float FESTAO_NA_SOMBRA = -0.07; // o festão em pé, de costas para a luz
const float FESTAO_NA_LUZ = 0.02;
const float LUZ_DO_PANO = 0.05;      // a massa clara da borda do toldo (a escura é 1,5 x)
const vec2 BALCAO_C = vec2(0.0, 0.60);
const vec2 BALCAO_B = vec2(0.86, 0.36);
const vec2 BALCAO_ESP = vec2(0.02, 0.12);     // a face do balcão, na tela
const vec2 S_FESTAO = vec2(0.025, 0.06);
const vec2 S_MONTE = vec2(0.03, 0.04);
const vec2 S_CORCOVA = vec2(0.022, 0.03);   // a sombra curta da corcova no corpo do monte, na tela

// ---- De lado (y = -1 no alto, 1 no chão) ----
const float L_TOPO = -0.90;
const float L_BEIRA = -0.36;
const float L_RT = 0.74;             // meia largura do toldo em cima (mais longe)
const float L_RB = 0.90;             // e na beira
const float L_FESTAO = 0.15;
const float L_ESTEIO_X = 0.80;
const float L_ESTEIO_R = 0.045;
const float L_CHAO = 0.975;
const float L_TAMPO_A = 0.20;        // o tampo do balcão, de cima
const float L_TAMPO_B = 0.29;        // a baixo
const float L_TAMPO_X = 0.91;
const float L_CORPO_X = 0.86;
const float L_JUNTA = 0.625;
const vec2 S_L_FESTAO = vec2(0.02, 0.07);
const vec2 S_L_TAMPO = vec2(0.015, 0.035);

// Os PRODUTOS do app (moveis/barraca.ts) e o saco: juta no tom da corda e o grão em palha.
const vec3 SACO = vec3(0.627, 0.541, 0.384);   // #a08a62 (a corda do app: juta)
const vec3 GRAO = vec3(0.839, 0.710, 0.416);   // #d6b56a (palha)
const vec3 MACA = vec3(0.541, 0.298, 0.243);   // #8a4c3e
const vec3 COUVE = vec3(0.420, 0.478, 0.243);  // #6b7a3e
const vec3 ABOBORA = vec3(0.639, 0.478, 0.259); // #a37a42

// ---------- a cor própria pela rampa da família (CONTRATO 10.5) ----------
vec3 para_linear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 para_srgb(vec3 c) {
	c = clamp(c, 0.0, 1.0);
	return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

vec3 oklab_de(vec3 rgb) {
	vec3 c = para_linear(rgb);
	float l = pow(max(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 0.0), 1.0 / 3.0);
	float n = pow(max(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 0.0), 1.0 / 3.0);
	float s = pow(max(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 0.0), 1.0 / 3.0);
	return vec3(0.2104542553 * l + 0.793617785 * n - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * n + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * n - 0.808675766 * s);
}

vec3 linear_de_oklab(vec3 o) {
	float l = o.x + 0.3963377774 * o.y + 0.2158037573 * o.z;
	float n = o.x - 0.1055613458 * o.y - 0.0638541728 * o.z;
	float s = o.x - 0.0894841775 * o.y - 1.291485548 * o.z;
	l = l * l * l;
	n = n * n * n;
	s = s * s * s;
	return vec3(4.0767416621 * l - 3.3077115913 * n + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * n - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * n + 1.707614701 * s);
}

bool cabe_na_tela(vec3 c) {
	return all(greaterThanEqual(c, vec3(-1e-4))) && all(lessThanEqual(c, vec3(1.0001)));
}

float fator_no_escuro(float g) {
	if (g <= 0.10) {
		return mix(0.42, 0.50, g / 0.10);
	}
	if (g <= 0.24) {
		return mix(0.50, 0.64, (g - 0.10) / 0.14);
	}
	if (g <= 0.36) {
		return mix(0.64, 0.78, (g - 0.24) / 0.12);
	}
	return mix(0.78, 1.0, clamp((g - 0.36) / 0.14, 0.0, 1.0));
}

float fator_no_claro(float g) {
	if (g <= 0.62) {
		return mix(0.0, 0.12, (g - 0.5) / 0.12);
	}
	if (g <= 0.76) {
		return mix(0.12, 0.26, (g - 0.62) / 0.14);
	}
	return mix(0.26, 0.45, clamp((g - 0.76) / 0.24, 0.0, 1.0));
}

// A cor de um tom próprio no valor g, como o app tinge uma parte (o tom é o 0,5).
vec3 cor_fixa(vec3 tom, float g) {
	vec3 o = oklab_de(tom);
	float C = length(o.yz);
	float h = atan(o.z, o.y);
	vec3 am = oklab_de(vec3(0.941, 0.824, 0.400));
	float dh = atan(am.z, am.y) - h;
	if (dh > PI) {
		dh -= TAU;
	}
	if (dh < -PI) {
		dh += TAU;
	}
	float L2;
	float C2;
	float h2 = h;
	if (g <= 0.5) {
		float f = fator_no_escuro(g);
		L2 = o.x * f;
		C2 = C * (1.0 + 0.25 * (1.0 - f));
	} else {
		float f = fator_no_claro(g);
		L2 = o.x + (1.0 - o.x) * f;
		C2 = C * (1.0 - 0.2 * f);
		h2 = h + dh * 0.12 * min(1.0, f / 0.26);
	}
	vec3 c = linear_de_oklab(vec3(L2, C2 * cos(h2), C2 * sin(h2)));
	if (!cabe_na_tela(c)) {
		float lo = 0.0;
		float hi = 1.0;
		for (int k = 0; k < 12; k++) {
			float t = (lo + hi) * 0.5;
			if (cabe_na_tela(linear_de_oklab(vec3(L2, C2 * t * cos(h2), C2 * t * sin(h2))))) {
				lo = t;
			} else {
				hi = t;
			}
		}
		c = linear_de_oklab(vec3(L2, C2 * lo * cos(h2), C2 * lo * sin(h2)));
	}
	return para_srgb(c);
}

// ---------- formas ----------
float uniao_suave(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

// O trapézio do toldo de lado: meia largura rt em cima (y = -he) e rb embaixo (y = he).
float sd_trapezio(vec2 p, float rt, float rb, float he) {
	vec2 k1 = vec2(rb, he);
	vec2 k2 = vec2(rb - rt, 2.0 * he);
	p.x = abs(p.x);
	vec2 ca = vec2(p.x - min(p.x, p.y < 0.0 ? rt : rb), abs(p.y) - he);
	vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
	float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
	return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}

// A distância (casas) até o pano claro mais perto (negativa dentro): os panos 1 e 3 de 5.
float sd_panos_claros(float x, float meia) {
	float w = 2.0 * meia / float(PANOS);
	float d = 1e3;
	for (int i = 1; i < PANOS; i += 2) {
		float c = -meia + (float(i) + 0.5) * w;
		d = min(d, abs(x - c) - w * 0.5);
	}
	return d;
}

float tom_do_pano(int i) {
	return i % 2 == 1 ? PANO_CLARO : 0.0;
}

// O meio do pano i, em fração da meia largura (-1 a 1).
float meio_do_pano(int i) {
	return -1.0 + (float(i) + 0.5) * 2.0 / float(PANOS);
}

// Uma curva suave (Bézier de a a b puxada por c, em 6 trechos), meia largura r.x nas
// pontas e r.y no meio: a dobra do pano, como a do cobertor da cama.
float sd_curva(vec2 m, vec2 a, vec2 c, vec2 b, vec2 r) {
	float d = 1e3;
	vec2 p0 = a;
	float r0 = r.x;
	for (int k = 1; k <= 6; k++) {
		float t = float(k) / 6.0;
		float u = 1.0 - t;
		vec2 p1 = u * u * a + 2.0 * u * t * c + t * t * b;
		float r1 = mix(r.x, r.y, sin(PI * t));
		d = min(d, sd_traco(m, p0, p1, r0, r1));
		p0 = p1;
		r0 = r1;
	}
	return d;
}

// Um sorteio de -1 a 1 por pano (o mesmo nas duas vistas: a mesma barraca). Os panos i e
// PANOS - 1 - i tiram o mesmo sorteio, e sd_dobra espelha o de lá: a barraca fica simétrica
// de lado a lado, como as 2 viradas pedem.
float jeito_do_pano(int i, int k, int sem) {
	int par = min(i, PANOS - 1 - i);
	return rk(hash_u(uint(par) * 7919u + uint(sem) * 31u), k) * 2.0 - 1.0;
}

// A dobra do pano i: de perto da cumeeira até perto da beira, em leque: as dos panos de
// fora descem puxadas para as quinas da frente, onde os esteios seguram o pano, espelhadas
// uma na outra; a do meio desce reta. Nunca paralelas (paralelas liam como fendas).
float sd_dobra(vec2 m, int i, int vis, int sem, vec2 r) {
	float u = meio_do_pano(i);
	// O lado: -1 à esquerda, 1 à direita, 0 no pano do meio (sem sorteio em x: fica reta).
	float lado = sign(u);
	float j0 = jeito_do_pano(i, 0, sem) * -lado;
	float j1 = jeito_do_pano(i, 1, sem) * -lado;
	float j2 = jeito_do_pano(i, 2, sem) * -lado;
	float y0 = vis == 1 ? L_TOPO + 0.07 + 0.02 * abs(j0) : CUMEEIRA_Y + 0.11 + 0.03 * abs(j0);
	float y1 = vis == 1 ? L_BEIRA - 0.06 - 0.02 * abs(j1) : BEIRA_Y - 0.07 - 0.03 * abs(j1);
	float wa = vis == 1 ? L_RT : TOLDO_X;
	float wb = vis == 1 ? L_RB : TOLDO_X;
	vec2 a = vec2(u * wa * 0.68 + 0.02 * j1, y0);
	vec2 b = vec2(u * wb * 1.12 + 0.02 * j0, y1);
	vec2 c = (a + b) * 0.5 + vec2(0.035 * j2 * (1.0 - abs(u)) + 0.03 * u, 0.0);
	return sd_curva(m, a, c, b, r);
}

// Os festões da beira (para a sombra curta): a união das 5 meias-luas.
float sd_festoes(vec2 m, float meia, float y, float fundo) {
	float w = 2.0 * meia / float(PANOS);
	float d = 1e3;
	for (int i = 0; i < PANOS; i++) {
		d = min(d, sd_elipse(m - vec2(meio_do_pano(i) * meia, y), vec2(w * 0.5 + 0.004, fundo)));
	}
	return max(d, y - 0.02 - m.y);
}

// ---------- os montes (cor própria) ----------
// 0 = o saco aberto, no meio; 1 = as frutas, um monte de cada lado, espelhados (o de lá é o
// de cá com x trocado de sinal). O mesmo x nas duas vistas.
const vec3 FRUTA = COUVE;

vec3 tom_do_monte(int i) {
	return i == 0 ? SACO : FRUTA;
}

// Onde fica o saco, nas duas vistas (o mesmo x): no eixo da barraca.
const float SACO_X = 0.0;

// Dobra o ponto para o lado direito: os dois montes de frutas são um só, espelhado.
// Andar a luz antes de dobrar já espelha a luz para o monte da esquerda.
vec2 dobrar(vec2 p) {
	return vec2(abs(p.x), p.y);
}

// O monte de frutas da direita: UMA massa, o corpo largo e uma corcova menor por cima,
// puxada para o meio da barraca (a fileira sobe para o saco), unidos sem vinco (o monte,
// nunca as frutas uma a uma). k = 0 o corpo, 1 a corcova: xy o meio, zw os semieixos. De
// lado, o corpo assenta no tampo e a corcova sobe dele.
vec4 lobo_cru(int vis, int k) {
	if (vis == 1) {
		float y0 = L_TAMPO_A;
		return k == 0 ? vec4(0.51, y0, 0.17, 0.125) : vec4(0.50, y0 - 0.09, 0.11, 0.10);
	}
	return k == 0 ? vec4(0.51, 0.58, 0.152, 0.13) : vec4(0.49, 0.515, 0.104, 0.088);
}

// O monte inteiro um pouco maior, em volta do meio do corpo (de lado, do pé dele no tampo).
const float MONTE_MAIOR = 1.2;

vec4 lobo_do_monte(int vis, int k) {
	vec4 corpo = lobo_cru(vis, 0);
	vec4 l = lobo_cru(vis, k);
	return vec4(corpo.xy + (l.xy - corpo.xy) * MONTE_MAIOR, l.zw * MONTE_MAIOR);
}

float sd_monte(vec2 p, int i, int vis) {
	if (i == 0) {
		if (vis == 1) {
			return sd_caixa(p - vec2(SACO_X, L_TAMPO_A - 0.14), vec2(0.155, 0.14), 0.10);
		}
		return sd_caixa(p - vec2(SACO_X, 0.56), vec2(0.172, 0.156), 0.12);
	}
	vec2 pd = dobrar(p);
	vec4 a = lobo_do_monte(vis, 0);
	vec4 b = lobo_do_monte(vis, 1);
	float s = uniao_suave(sd_elipse(pd - a.xy, a.zw), sd_elipse(pd - b.xy, b.zw), 0.07);
	// De lado, o monte assenta no tampo (a base reta).
	return vis == 1 ? max(s, p.y - L_TAMPO_A) : s;
}

float sd_montes(vec2 p, int vis) {
	return min(sd_monte(p, 0, vis), sd_monte(p, 1, vis));
}

// Os montes de frutas: contorno, o tom, a sombra embaixo à direita e uma massa de luz larga
// em cima à esquerda. escurece = a sombra curta de quem está por cima (o festão). Todo ponto
// anda na luz ANTES de dobrar, para o monte da esquerda acender do lado certo.
void monte_de_frutas(inout vec4 av, inout vec4 ac, vec2 q, vec2 m, vec2 lm, int vis, int vir, float escurece, float px) {
	float d = sd_monte(m, 1, vis);
	if (d > px) {
		return;
	}
	vec3 tom = FRUTA;
	float co = 0.034;
	pousar_cor(av, ac, cor_fixa(tom, V_CONTORNO), cobre(d, px));
	float dentro = cobre(d + co, px);
	float v0 = V_MEIO - 0.12 * escurece;
	pousar_cor(av, ac, cor_fixa(tom, v0), dentro);
	float ds = sd_monte(m - lm * 0.055, 1, vis) + co;
	pousar_cor(av, ac, cor_fixa(tom, v0 - MASSA_ESCURA), dentro * (1.0 - cobre(ds, px)));
	// Duas massas de luz: a do corpo e a da corcova, com a sombra curta da corcova no corpo
	// (andada na tela). Sem contorno entre as duas: é um monte só.
	vec4 e = lobo_do_monte(vis, 0);
	vec4 f = lobo_do_monte(vis, 1);
	vec2 cl = vis == 1 ? e.xy - vec2(0.0, 0.5 * e.w) : e.xy;
	vec2 el = vis == 1 ? e.zw * vec2(0.5, 0.3) : e.zw * 0.52;
	float dl = sd_elipse(dobrar(m - lm * 0.3 * min(e.z, e.w)) - cl, el);
	pousar_cor(av, ac, cor_fixa(tom, v0 + MASSA_CLARA), dentro * cobre(dl, px));
	float corcova = cobre(sd_elipse(dobrar(m) - f.xy, f.zw), px);
	float s_corcova = cobre(sd_elipse(dobrar(movel_de(q - S_CORCOVA, vir)) - f.xy, f.zw), px);
	pousar_cor(av, ac, cor_fixa(tom, v0 - 0.07), dentro * (1.0 - corcova) * s_corcova);
	float dlc = sd_elipse(dobrar(m - lm * 0.3 * min(f.z, f.w)) - f.xy, f.zw * 0.5);
	pousar_cor(av, ac, cor_fixa(tom, v0 + MASSA_CLARA + 0.04), dentro * corcova * cobre(dlc, px));
}

// O saco aberto, de cima: o pano de juta com a beira enrolada e o grão dentro, com a
// sombra que a beira joga para dentro (do lado da luz).
// O pano do saco de cima: uma almofada de quina larga, com a beira um pouco franzida (o
// franzido simétrico de lado a lado, como a fileira).
float sd_saco_de_cima(vec2 p) {
	float a = atan(p.y, p.x);
	return sd_caixa(p, vec2(0.172, 0.156), 0.12) - 0.01 * (0.5 + 0.5 * cos(4.0 * a + PI));
}

void saco_de_cima(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float escurece, float px) {
	vec2 p = m - vec2(SACO_X, 0.56);
	float d = sd_saco_de_cima(p);
	if (d > px) {
		return;
	}
	float co = 0.034;
	float v0 = V_MEIO - 0.12 * escurece;
	pousar_cor(av, ac, cor_fixa(SACO, V_CONTORNO), cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar_cor(av, ac, cor_fixa(SACO, v0), dentro);
	pousar_cor(av, ac, cor_fixa(SACO, v0 - MASSA_ESCURA), dentro * (1.0 - cobre(sd_saco_de_cima(p - lm * 0.05) + co, px)));
	pousar_cor(av, ac, cor_fixa(SACO, v0 + MASSA_CLARA), dentro * (1.0 - cobre(sd_saco_de_cima(p + lm * 0.035) + co, px)));
	// A boca larga: a borda funda, o grão e a sombra que a beira joga dentro, do lado da luz.
	vec2 pb = p - vec2(0.0, -0.005);
	vec2 eb = vec2(0.128, 0.108);
	float db = sd_elipse(pb, eb);
	pousar_cor(av, ac, cor_fixa(SACO, V_SOMBRA - 0.06), cobre(db, px));
	float boca = cobre(db + 0.018, px);
	pousar_cor(av, ac, cor_fixa(GRAO, v0 - 0.02), boca);
	pousar_cor(av, ac, cor_fixa(GRAO, V_SOMBRA), boca * (1.0 - cobre(sd_elipse(pb + lm * 0.04, eb) + 0.018, px)));
}

// O saco de lado: o corpo estufado em pé, a boca mais estreita com a beira enrolada e o
// grão aparecendo por cima.
void saco_de_lado(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float y0 = L_TAMPO_A;
	vec2 c = vec2(SACO_X, y0 - 0.14);
	vec2 b = vec2(0.155, 0.14);
	float co = 0.034;
	// O grão (atrás da beira, só o alto aparece), no tom do grão de cima.
	vec2 pg = m - vec2(SACO_X, y0 - 0.292);
	float dg = sd_elipse(pg, vec2(0.11, 0.05));
	if (dg < px) {
		pousar_cor(av, ac, cor_fixa(GRAO, V_CONTORNO), cobre(dg, px));
		float dentro = cobre(dg + co * 0.8, px);
		pousar_cor(av, ac, cor_fixa(GRAO, V_MEIO - 0.02), dentro);
		pousar_cor(av, ac, cor_fixa(GRAO, V_MEIO + 0.08), dentro * cobre(sd_elipse(pg - lm * 0.02, vec2(0.065, 0.025)), px));
	}
	// O corpo do saco, estufado: mais largo embaixo, um pouco mais estreito na boca.
	vec2 p = m - c;
	float afina = 1.0 + 0.12 * clamp(p.y / b.y, -1.0, 1.0);
	float d = sd_caixa(vec2(p.x / afina, p.y), b, 0.10);
	if (d < px) {
		pousar_cor(av, ac, cor_fixa(SACO, V_CONTORNO), cobre(d, px));
		float dentro = cobre(d + co, px);
		vec2 ps = p - lm * 0.05;
		vec2 pl = p + lm * 0.035;
		float ds = sd_caixa(vec2(ps.x / afina, ps.y), b, 0.10) + co;
		float dl = sd_caixa(vec2(pl.x / afina, pl.y), b, 0.10) + co;
		pousar_cor(av, ac, cor_fixa(SACO, V_MEIO), dentro);
		pousar_cor(av, ac, cor_fixa(SACO, V_MEIO - MASSA_ESCURA), dentro * (1.0 - cobre(ds, px)));
		pousar_cor(av, ac, cor_fixa(SACO, V_MEIO + MASSA_CLARA), dentro * (1.0 - cobre(dl, px)));
	}
	// A beira enrolada, da largura da boca, no tom do pano com a luz em cima.
	vec2 pr = m - vec2(SACO_X, y0 - 0.262);
	vec2 br = vec2(0.146, 0.034);
	float dr = sd_caixa(pr, br, 0.032);
	if (dr < px) {
		float cr = contorno_para(br);
		pousar_cor(av, ac, cor_fixa(SACO, V_CONTORNO), cobre(dr, px));
		float dentro = cobre(dr + cr, px);
		pousar_cor(av, ac, cor_fixa(SACO, V_MEIO + 0.04), dentro);
		pousar_cor(av, ac, cor_fixa(SACO, V_MEIO - 0.06), dentro * (1.0 - cobre(sd_caixa(pr - lm * 0.02, br, 0.032) + cr, px)));
	}
}

// ---------- de cima ----------
void de_cima(vec2 q, float px, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	// +1 quando a água de trás olha para a luz na tela (a virada 0), -1 na meia volta.
	float s = sign(dot(tela_de(vec2(0.0, -1.0), vir), LUZ));
	vec2 cb = vec2(0.0, (TOLDO_TRAS + BEIRA_Y) * 0.5);
	vec2 bb = vec2(TOLDO_X, (BEIRA_Y - TOLDO_TRAS) * 0.5);

	// 1. O balcão: a face funda para baixo e à direita na tela, o tampo com as massas.
	vec2 em = movel_de(BALCAO_ESP, vir);
	vec2 bt = BALCAO_B - abs(em) * 0.5;
	vec2 ct = BALCAO_C - em * 0.5;
	float dbal = sd_caixa(m - BALCAO_C - em * 0.5, bt, 0.04);
	if (dbal < px) {
		pousar(av, ac, V_CONTORNO, 2, cobre(dbal, px));
		pousar(av, ac, V_FUNDO + 0.05, 2, cobre(dbal + contorno_para(bt), px));
	}
	desenhar_caixa(av, ac, m, ct, bt, 0.04, V_MEIO + 0.02, 0.035, 2, vir, px);
	float tampo = cobre(sd_caixa(m - ct, bt, 0.04) + CONTORNO_CASAS, px);
	// As sombras curtas no tampo: a dos festões (o toldo alto) e a dos montes.
	float d_toldo_s = min(sd_caixa(movel_de(q - S_FESTAO, vir) - cb, bb, R_TOLDO), sd_festoes(movel_de(q - S_FESTAO, vir), TOLDO_X, BEIRA_Y, FESTAO_FUNDO));
	float s_fest = cobre(d_toldo_s, px);
	float s_mon = cobre(sd_montes(movel_de(q - S_MONTE, vir), 0), px);
	pousar(av, ac, V_SOMBRA - 0.02, 2, tampo * max(s_fest, s_mon * 0.85) * 0.85);

	// 2. Os montes, com a sombra dos festões por cima.
	saco_de_cima(av, ac, m, lm, s_fest, px);
	monte_de_frutas(av, ac, q, m, lm, 0, vir, s_fest, px);

	// 3. Os festões da beira, um por pano, em pé (de costas para a luz na virada 0).
	float w = 2.0 * TOLDO_X / float(PANOS);
	float tom_f = s > 0.0 ? FESTAO_NA_SOMBRA : FESTAO_NA_LUZ;
	for (int i = 0; i < PANOS; i++) {
		vec2 cf = vec2(meio_do_pano(i) * TOLDO_X, BEIRA_Y);
		desenhar_elipse(av, ac, m, cf, vec2(w * 0.5 + 0.004, FESTAO_FUNDO), V_MEIO + tom_do_pano(i) + tom_f, 0.035, 1, vir, px);
	}

	// 4. O toldo: as duas águas (a passagem macia: o pano dobra por cima da vara, não é
	// costura), os panos, as massas da borda e as dobras.
	vec2 p = m - cb;
	float d = sd_caixa(p, bb, R_TOLDO);
	if (d < px) {
		pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
		float dentro = cobre(d + CONTORNO_CASAS, px);
		float tras = 1.0 - smoothstep(-CUMEEIRA_MACIA, CUMEEIRA_MACIA, m.y - CUMEEIRA_Y);
		float claro = cobre(sd_panos_claros(m.x, TOLDO_X), px);
		float v = V_MEIO + PANO_CLARO * claro + s * mix(AGUA_FRENTE, AGUA_TRAS, tras);
		pousar(av, ac, v, 1, dentro);
		float ds = sd_caixa(p - lm * LUZ_DO_PANO * 1.5, bb, R_TOLDO) + CONTORNO_CASAS;
		float dl = sd_caixa(p + lm * LUZ_DO_PANO, bb, R_TOLDO) + CONTORNO_CASAS;
		pousar(av, ac, v - MASSA_ESCURA, 1, dentro * (1.0 - cobre(ds, px)));
		pousar(av, ac, v + MASSA_CLARA, 1, dentro * (1.0 - cobre(dl, px)));
		float frente = 1.0 - tras;
		float dsh = 1e3;
		float dcr = 1e3;
		for (int i = 0; i < PANOS; i++) {
			dsh = min(dsh, sd_dobra(movel_de(q - S_DOBRA, vir), i, 0, sem, DOBRA_SOMBRA));
			dcr = min(dcr, sd_dobra(m, i, 0, sem, DOBRA_CRISTA));
		}
		pousar(av, ac, v - DOBRA_FUNDA, 1, dentro * frente * cobre(dsh, px));
		pousar(av, ac, v + DOBRA_CLARA, 1, dentro * frente * cobre(dcr, px));
	}
}

// ---------- de lado ----------
void de_lado(vec2 q, float px, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	float he = (L_BEIRA - L_TOPO) * 0.5;
	vec2 ctr = vec2(0.0, (L_TOPO + L_BEIRA) * 0.5);
	float r_tr = 0.04;

	// 1. Os esteios, do toldo ao chão, por trás do balcão; a sombra curta dos festões no alto.
	float s_fest = cobre(min(sd_trapezio(movel_de(q - S_L_FESTAO, vir) - ctr, L_RT, L_RB, he), sd_festoes(movel_de(q - S_L_FESTAO, vir), L_RB, L_BEIRA, L_FESTAO)), px);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		vec2 ce = vec2(sx * L_ESTEIO_X, (L_BEIRA + L_CHAO) * 0.5);
		vec2 be = vec2(L_ESTEIO_R, (L_CHAO - L_BEIRA) * 0.5);
		desenhar_caixa(av, ac, m, ce, be, 0.02, V_MEIO, 0.02, 2, vir, px);
		float dentro = cobre(sd_caixa(m - ce, be, 0.02) + contorno_para(be), px);
		pousar(av, ac, V_SOMBRA - 0.02, 2, dentro * s_fest * 0.85);
	}

	// 2. Os festões, em pé de frente.
	float w = 2.0 * L_RB / float(PANOS);
	for (int i = 0; i < PANOS; i++) {
		vec2 cf = vec2(meio_do_pano(i) * L_RB, L_BEIRA);
		desenhar_elipse(av, ac, m, cf, vec2(w * 0.5 + 0.004, L_FESTAO), V_MEIO + tom_do_pano(i) - 0.05, 0.035, 1, vir, px);
	}

	// 3. O toldo inclinado: o trapézio com os 5 panos que se fecham para cima, as massas e
	// uma dobra calma por pano.
	vec2 p = m - ctr;
	float d = sd_trapezio(p, L_RT - r_tr, L_RB - r_tr, he - r_tr) - r_tr;
	if (d < px) {
		pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
		float dentro = cobre(d + CONTORNO_CASAS, px);
		float t = clamp((m.y - L_TOPO) / (L_BEIRA - L_TOPO), 0.0, 1.0);
		float meia = mix(L_RT, L_RB, t);
		float claro = cobre(sd_panos_claros(m.x, meia), px);
		float v = V_MEIO + 0.02 + PANO_CLARO * claro;
		pousar(av, ac, v, 1, dentro);
		float ds = sd_trapezio(p - lm * LUZ_DO_PANO * 1.5, L_RT - r_tr, L_RB - r_tr, he - r_tr) - r_tr + CONTORNO_CASAS;
		float dl = sd_trapezio(p + lm * LUZ_DO_PANO, L_RT - r_tr, L_RB - r_tr, he - r_tr) - r_tr + CONTORNO_CASAS;
		pousar(av, ac, v - MASSA_ESCURA, 1, dentro * (1.0 - cobre(ds, px)));
		pousar(av, ac, v + MASSA_CLARA, 1, dentro * (1.0 - cobre(dl, px)));
		float dsh = 1e3;
		float dcr = 1e3;
		for (int i = 0; i < PANOS; i++) {
			dsh = min(dsh, sd_dobra(movel_de(q - S_DOBRA, vir), i, 1, sem, DOBRA_SOMBRA));
			dcr = min(dcr, sd_dobra(m, i, 1, sem, DOBRA_CRISTA));
		}
		pousar(av, ac, v - DOBRA_FUNDA, 1, dentro * cobre(dsh, px));
		pousar(av, ac, v + DOBRA_CLARA, 1, dentro * cobre(dcr, px));
	}

	// 4. O balcão: duas tábuas deitadas, o tampo que passa e a sombra curta dele.
	vec2 cc = vec2(0.0, (L_TAMPO_B + L_CHAO) * 0.5);
	vec2 bc = vec2(L_CORPO_X, (L_CHAO - L_TAMPO_B) * 0.5);
	float dcorpo = sd_caixa(m - cc, bc, 0.03);
	if (dcorpo < px) {
		// A tábua de cima é a caixa inteira; a de baixo, por cima dela, faz a junta com o
		// próprio contorno.
		desenhar_caixa(av, ac, m, cc, bc, 0.03, V_MEIO - 0.03, 0.03, 2, vir, px);
		vec2 cl = vec2(0.0, (L_JUNTA + L_CHAO) * 0.5);
		vec2 bl = vec2(L_CORPO_X, (L_CHAO - L_JUNTA) * 0.5);
		desenhar_caixa(av, ac, m, cl, bl, 0.03, V_MEIO - 0.07, 0.03, 2, vir, px);
		float dentro = cobre(dcorpo + CONTORNO_CASAS, px);
		float st = cobre(sd_caixa(movel_de(q - S_L_TAMPO, vir) - vec2(0.0, (L_TAMPO_A + L_TAMPO_B) * 0.5), vec2(L_TAMPO_X, (L_TAMPO_B - L_TAMPO_A) * 0.5), 0.02), px);
		pousar(av, ac, V_SOMBRA - 0.04, 2, dentro * st * 0.85);
	}
	vec2 ctp = vec2(0.0, (L_TAMPO_A + L_TAMPO_B) * 0.5);
	vec2 btp = vec2(L_TAMPO_X, (L_TAMPO_B - L_TAMPO_A) * 0.5);
	desenhar_caixa(av, ac, m, ctp, btp, 0.02, V_LUZ - 0.03, 0.02, 2, vir, px);

	// 5. Os montes em cima do tampo.
	saco_de_lado(av, ac, m, lm, px);
	monte_de_frutas(av, ac, q, m, lm, 1, vir, 0.0, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (vis == 1) {
		de_lado(q, px, vir, sem, av, ac);
	} else {
		de_cima(q, px, vir, sem, av, ac);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

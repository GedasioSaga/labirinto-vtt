// JUNCOS em pé, meio de lado (onda 3, lote 7; CONTRATO.md, seção 9). Da família do lote 6
// aprovado em 28/10 (texturas/arbusto/, texturas/arvore/): a mesma vista, a mesma luz, o
// mesmo contorno e a mesma escala; o arbusto tem o mesmo tamanho (6).
//
// - Uma touceira de beira d'água: 5 a 8 folhas compridas em LÂMINA LARGA, que saem de um pé
//   comum e abrem em leque. Cada lâmina é uma faixa curva (um arco) que afina numa ponta, com
//   uma dobra no meio: a metade que olha para a esquerda no tom da luz, a outra no da sombra.
//   Poucas e largas: risco fino de capim repetido vira pente a 25%.
// - As de trás são mais escuras e as da frente mais claras; cada lâmina da frente joga uma
//   faixa de sombra na de trás (embaixo à direita) e uma linha fina a separa dela. Perto do
//   pé tudo escurece e as linhas somem: o pé é uma massa só.
// - Uma ou duas taboas: a espiga marrom em cima de uma haste fina, em 2 tons, com a pontinha.
// - As 4 formas mudam a altura, a abertura do leque, o número de espigas (2, 1, 1, 2) e o
//   tom (sálvia, oliva, verde-azulado, claro).
// - "espelho": "nenhum" (desenho em pé) e a sombra "em-pe" do app, curta (comprimento 0,40,
//   como o arbusto: a sombra "baixa" de hoje).
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qo = q - PE, y para baixo, 0 = o chão), que fica onde o pé de hoje fica (config:
// ancoraPx). Sem sombra no chão: ela é do app, pela silhueta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// O pé em unidades a partir do meio da imagem: (ancoraPx - ladoPx / 2) / unidadePx.
const vec2 PE = vec2(0.0063, 0.4203);
// A linha do chão fica um tico abaixo do pé: as folhas de baixo cobrem o ponto onde a
// sombra "em-pe" nasce, e ela sai grudada na base.
const float CHAO_ABAIXO_DO_PE = 0.03;
// A dobra de cada lâmina: a metade que olha para este lado pega a luz. Quase pura esquerda:
// numa lâmina que sobe acende a metade da esquerda; numa que deita, a de cima.
const vec2 LUZ_DA_DOBRA = vec2(-0.98, -0.2);
// A faixa de sombra que uma lâmina da frente joga na de trás.
const vec2 SOMBRA_DENTRO = vec2(0.020, 0.028);
const float RAIO_DA_ESPIGA = 0.046;

// A taboa: a espiga marrom (paleta: NOGUEIRA #775739 e CARVALHO #a07b51; a de hoje, #745234).
const vec3 TABOA_LUZ = vec3(0.545, 0.408, 0.267);
const vec3 TABOA_SOMBRA = vec3(0.380, 0.275, 0.180);
const vec3 TABOA_CONTORNO = vec3(0.220, 0.150, 0.090);

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
	return -smin(-a, -b, k);
}

int quantas(int k) {
	if (k == 1) {
		return 6;
	}
	if (k == 2) {
		return 8;
	}
	if (k == 3) {
		return 5;
	}
	return 7;
}

// Quantas lâminas ficam atrás das espigas (as hastes saem do meio da touceira).
int de_tras(int k) {
	if (k == 3) {
		return 2;
	}
	if (k == 2) {
		return 4;
	}
	return 3;
}

// Uma ou duas por touceira (sem nenhuma, a touceira lê como capim, outra planta).
int espigas(int k) {
	if (k == 1 || k == 2) {
		return 1;
	}
	return 2;
}

// A lâmina i da forma k, de trás para a frente: x = onde ela sai do pé, y = o ângulo de
// saída (radianos a partir do prumo, + = para a direita), z = o comprimento, w = a curvatura
// (+ = curva para a direita; o arco vira a ponta para fora).
vec4 folha(int k, int i, int sem) {
	vec4 a;
	// Junco sobe: as lâminas saem quase no prumo e só as de fora arqueiam; uma ou duas por
	// forma dobram e caem (a folha quebrada da taboa). Leque aberto demais vira agave.
	// O desenho é um VASO: pé apertado, as lâminas quase paralelas embaixo e abrindo só no
	// alto, pela curvatura (sair já inclinado faz um V de agave).
	if (k == 1) {
		// Alta e fechada, oliva: quase uma coluna, uma espiga.
		a = i == 0 ? vec4(0.000, 0.01, 1.08, 0.08)
			: i == 1 ? vec4(-0.020, -0.05, 1.00, -0.14)
			: i == 2 ? vec4(0.020, 0.06, 0.94, 0.20)
			: i == 3 ? vec4(-0.020, -0.08, 0.84, -0.32)
			: i == 4 ? vec4(0.020, 0.08, 0.74, 0.55)
			: vec4(0.000, -0.02, 0.58, -0.18);
	} else if (k == 2) {
		// Baixa e larga, verde-azulada, sem espiga: o pé mais largo (as lâminas não saem de um
		// ponto só, senão a touceira vira estrela) e o peso para a esquerda.
		a = i == 0 ? vec4(-0.020, -0.04, 0.78, -0.30)
			: i == 1 ? vec4(0.050, 0.05, 0.70, 0.50)
			: i == 2 ? vec4(-0.060, -0.10, 0.66, -0.70)
			: i == 3 ? vec4(0.070, 0.12, 0.60, 1.25)
			: i == 4 ? vec4(0.010, 0.01, 0.62, 0.15)
			: i == 5 ? vec4(-0.080, -0.06, 0.52, -0.45)
			: i == 6 ? vec4(0.030, -0.03, 0.50, -0.25)
			: vec4(-0.040, -0.14, 0.56, -1.20);
	} else if (k == 3) {
		// Ao vento, clara: tudo deita para a direita, cinco lâminas, uma espiga.
		a = i == 0 ? vec4(-0.010, 0.04, 0.98, 0.40)
			: i == 1 ? vec4(0.020, 0.10, 0.90, 0.62)
			: i == 2 ? vec4(-0.020, -0.04, 0.80, 0.34)
			: i == 3 ? vec4(0.030, 0.14, 0.66, 1.15)
			: vec4(-0.020, -0.08, 0.56, 0.30);
	} else {
		// A de sempre, sálvia: sete lâminas, duas espigas, uma folha caída à esquerda.
		a = i == 0 ? vec4(-0.010, -0.03, 1.00, -0.12)
			: i == 1 ? vec4(0.020, 0.06, 0.92, 0.30)
			: i == 2 ? vec4(-0.030, -0.10, 0.86, -0.42)
			: i == 3 ? vec4(0.030, 0.10, 0.80, 0.75)
			: i == 4 ? vec4(-0.010, -0.02, 0.66, -0.20)
			: i == 5 ? vec4(-0.030, -0.12, 0.72, -1.30)
			: vec4(0.030, 0.06, 0.62, 0.45);
	}
	uint h = hash_cel(vec2(float(k), float(i) + 20.0), sem + 901);
	return vec4(a.x, a.y + (rk(h, 0) - 0.5) * 0.05, a.z * (0.97 + 0.06 * rk(h, 1)), a.w);
}

// A espiga j da forma k: x = onde a haste sai do pé, y = o ângulo da haste, z = a altura da
// haste até a espiga, w = o comprimento da espiga.
vec4 espiga(int k, int j, int sem) {
	vec4 t;
	if (k == 1) {
		t = vec4(0.000, -0.02, 0.76, 0.24);
	} else if (k == 2) {
		// Baixa, no meio das folhas.
		t = vec4(0.010, 0.12, 0.48, 0.19);
	} else if (k == 3) {
		// As duas deitam com o vento.
		t = j == 0 ? vec4(0.000, 0.08, 0.64, 0.21) : vec4(-0.020, 0.18, 0.50, 0.19);
	} else {
		t = j == 0 ? vec4(0.010, 0.02, 0.66, 0.22) : vec4(-0.020, -0.07, 0.54, 0.20);
	}
	uint h = hash_cel(vec2(float(k), float(j) + 60.0), sem + 907);
	return vec4(t.x, t.y + (rk(h, 0) - 0.5) * 0.04, t.z * (0.97 + 0.06 * rk(h, 1)), t.w);
}

// A largura ao longo da lâmina (u = 0 no pé, 1 na ponta): uma FITA, um pouco mais estreita
// no pé, quase reta até 70% e com a ponta curta (sem agulha: a inclinação não zera na
// ponta). Afinar desde o meio faz um triângulo, e a touceira vira agave.
float largura(float u) {
	float pe = 0.70 + 0.30 * smoothstep(0.0, 0.12, u);
	// A ponta em ogiva (lados convexos): reta, ela vira espinho de agave.
	float x = max(u - 0.55, 0.0) / 0.45;
	float ponta = pow(max(1.0 - pow(x, 1.6), 0.0), 0.8);
	return pe * ponta;
}

// Um pedaço de arco que sai de f com o ângulo th (a partir do prumo, + = para a direita) e
// a curvatura ka (+ = curva para a direita), por lp: devolve (s, n) no ponto p (s ao longo,
// n atravessando, + = a direita de quem sobe) e, em fim, o ponto final.
vec2 arco(vec2 p, vec2 f, float th, float ka, float lp, out vec2 fim) {
	vec2 t0 = vec2(sin(th), -cos(th));
	vec2 n0 = vec2(cos(th), sin(th));
	if (abs(ka) < 1e-3) {
		vec2 v = p - f;
		fim = f + t0 * lp;
		return vec2(dot(v, t0), dot(v, n0));
	}
	vec2 cc = f + n0 / ka;
	vec2 a0 = f - cc;
	vec2 v = p - cc;
	float phi = atan(a0.x * v.y - a0.y * v.x, dot(a0, v));
	fim = cc + girar(a0, ka * lp);
	return vec2(phi / ka, sign(ka) * (1.0 / abs(ka) - length(v)));
}

// A lâmina a, que sai de (a.x, 0): dois arcos emendados, o de cima curvando mais (a ponta
// pesa, como folha de capim). Devolve (d, u, n, w) no ponto p: d = a distância com sinal
// até a borda; u = onde o ponto está ao longo (0 a 1); n = atravessando; w = a meia largura.
vec4 lamina(vec2 p, vec4 a, float larg) {
	// A folha muito curva dobra de vez na metade, ainda larga, e a ponta cai (a folha
	// quebrada da taboa); dobrar só na ponta fina não se vê.
	bool quebrada = abs(a.w) > 1.1;
	float l1 = (quebrada ? 0.45 : 0.6) * a.z;
	float l2 = a.z - l1;
	float k2 = a.w * (quebrada ? 3.0 : 2.0) + sign(a.w) * 0.25;
	float uj = l1 / a.z;
	float wj = larg * largura(uj);
	vec2 junta;
	vec2 ponta;
	vec2 sa = arco(p, vec2(a.x, 0.0), a.y, a.w, l1, junta);
	vec2 sb = arco(p, junta, a.y + a.w * l1, k2, l2, ponta);
	// O pedaço de baixo, cortado reto no pé.
	float ua = sa.x / a.z;
	float wa = larg * largura(clamp(ua, 0.0, uj));
	float da = abs(sa.y) - wa;
	if (sa.x < 0.0) {
		da = max(da, -sa.x);
	} else if (sa.x > l1) {
		da = length(p - junta) - wj;
	}
	// O de cima, até a ponta.
	float ub = (l1 + sb.x) / a.z;
	float wb = larg * largura(clamp(ub, uj, 1.0));
	float db = abs(sb.y) - wb;
	if (sb.x < 0.0) {
		db = length(p - junta) - wj;
	} else if (sb.x > l2) {
		db = length(p - ponta);
	}
	if (da <= db) {
		return vec4(da, clamp(ua, 0.0, 1.0), sa.y, wa);
	}
	return vec4(db, clamp(ub, 0.0, 1.0), sb.y, wb);
}

// Para que lado da dobra fica a luz (+1 = o lado +n): decidido no meio da lâmina, para a
// dobra não trocar de lado ao longo de uma folha que curva.
float lado_da_luz(vec4 a) {
	float th = a.y + a.w * a.z * 0.5;
	return dot(vec2(cos(th), sin(th)), normalize(LUZ_DA_DOBRA)) > 0.0 ? 1.0 : -1.0;
}

vec3 tom(int k, int qual) {
	// Sálvia, perto do junco de hoje (#5c9068 / #265c4a).
	vec3 t0 = vec3(0.420, 0.640, 0.460);
	vec3 t1 = vec3(0.270, 0.490, 0.370);
	vec3 t2 = vec3(0.190, 0.390, 0.300);
	vec3 t3 = vec3(0.110, 0.250, 0.190);
	if (k == 1) {
		// Oliva, mais quente (fim do verão); mais marrom que isto vira espiga de milho a 50%.
		t0 = vec3(0.500, 0.660, 0.400);
		t1 = vec3(0.370, 0.550, 0.320);
		t2 = vec3(0.270, 0.440, 0.270);
		t3 = vec3(0.150, 0.280, 0.160);
	} else if (k == 2) {
		// Verde-azulado, frio (contido: mais azul que isto vira agave e some na água).
		t0 = vec3(0.420, 0.650, 0.510);
		t1 = vec3(0.270, 0.490, 0.390);
		t2 = vec3(0.200, 0.390, 0.320);
		t3 = vec3(0.110, 0.260, 0.210);
	} else if (k == 3) {
		// Claro.
		t0 = vec3(0.450, 0.690, 0.440);
		t1 = vec3(0.310, 0.550, 0.370);
		t2 = vec3(0.220, 0.440, 0.300);
		t3 = vec3(0.130, 0.290, 0.200);
	}
	return qual == 0 ? t0 : (qual == 1 ? t1 : (qual == 2 ? t2 : t3));
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qo = q - PE - vec2(0.0, CHAO_ABAIXO_DO_PE);
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float traco = 1.0 / unidade_mundo;
	float e = 1.2 * px;

	vec3 c_luz = tom(k, 0);
	vec3 c_sombra = tom(k, 1);
	vec3 c_fundo = tom(k, 2);
	vec3 c_cont = tom(k, 3);
	vec3 c_linha = mix(c_cont, c_fundo, 0.35);
	vec3 c_haste = mix(c_cont, c_fundo, 0.3);
	float linha_dentro = 0.9 * traco;
	float esp_espiga = 1.6 * traco;
	// Perto do pé as linhas entre lâminas somem: o pé é uma massa só.
	float longe_do_pe = 1.0 - smoothstep(-0.16, -0.04, qo.y);

	int n = quantas(k);
	int nt = de_tras(k);
	int ne = espigas(k);
	vec3 c = c_fundo;
	float d_resto = 1e9;
	float d_cab = 1e9;
	float cobriu = 0.0;
	float esp_f = 1.0;

	for (int i = 0; i < 9; i++) {
		if (i >= n) {
			break;
		}
		if (i == nt) {
			// As taboas: a haste fina e a espiga, entre as lâminas de trás e as da frente.
			for (int j = 0; j < 2; j++) {
				if (j >= ne) {
					break;
				}
				vec4 t = espiga(k, j, sem);
				vec2 dir = vec2(sin(t.y), -cos(t.y));
				vec2 perp = vec2(cos(t.y), sin(t.y));
				vec2 base = vec2(t.x, 0.0);
				vec2 h0 = base + dir * t.z;
				vec2 h1 = h0 + dir * t.w;
				float dh = sd_traco(qo, base, h0 + dir * RAIO_DA_ESPIGA, 0.012, 0.010);
				float dp = sd_traco(qo, h1 - dir * RAIO_DA_ESPIGA * 0.4, h1 + dir * 0.075, 0.010, 0.003);
				float dl = min(dh, dp);
				float covh = 1.0 - smoothstep(-e, e, dl);
				c = mix(c, c_haste, covh);
				d_resto = min(d_resto, dl);
				cobriu = max(cobriu, covh);
				float dc = sd_traco(qo, h0 + dir * RAIO_DA_ESPIGA, h1 - dir * RAIO_DA_ESPIGA, RAIO_DA_ESPIGA, RAIO_DA_ESPIGA * 0.94);
				float covc = 1.0 - smoothstep(-e, e, dc);
				float nh = dot(qo - h0, perp);
				float acesa = 1.0 - smoothstep(-e, e, nh - 0.12 * RAIO_DA_ESPIGA);
				vec3 cheio = mix(TABOA_SOMBRA, TABOA_LUZ, acesa);
				float cin = 1.0 - smoothstep(-e, e, dc + esp_espiga);
				c = mix(c, TABOA_CONTORNO, covc);
				c = mix(c, cheio, cin);
				esp_f = mix(esp_f, esp_espiga, 1.0 - smoothstep(-e, e, dc - 0.012));
				d_cab = min(d_cab, dc);
				cobriu = max(cobriu, covc);
			}
		}
		vec4 a = folha(k, i, sem);
		float prof = float(i) / float(max(n - 1, 1));
		float larg = 0.050 + 0.010 * prof;
		vec4 lb = lamina(qo, a, larg);
		float cov = 1.0 - smoothstep(-e, e, lb.x);
		// A faixa de sombra que esta lâmina joga no que ficou atrás dela.
		float ds = lamina(qo - SOMBRA_DENTRO, a, larg).x;
		float sh = (1.0 - smoothstep(-0.015, 0.015, ds)) * (1.0 - cov) * cobriu;
		c = mix(c, c * 0.74, sh * 0.6);
		// A linha fina entre esta lâmina e a de trás.
		float sobre_outra = cobriu * longe_do_pe;
		c = mix(c, c_linha, cov * sobre_outra);
		// Os dois tons da dobra: a de trás pega menos luz, a da frente mais.
		float dobra = lb.z * lado_da_luz(a) + (0.15 * prof - 0.05) * lb.w;
		float acesa = smoothstep(-e, e, dobra);
		vec3 c_l = mix(mix(c_sombra, c_luz, 0.5), c_luz, prof);
		vec3 c_s = mix(c_fundo, c_sombra, prof);
		vec3 tl = mix(c_s, c_l, acesa);
		float cin = 1.0 - smoothstep(-e, e, lb.x + linha_dentro);
		c = mix(c, tl, mix(cov, cin, sobre_outra));
		// Na ponta, o contorno de fora afina com a lâmina (senão a ponta vira só traço).
		esp_f = mix(esp_f, 0.5 * lb.w + 0.004, 1.0 - smoothstep(-e, e, lb.x - 0.012));
		cobriu = max(cobriu, cov);
		d_resto = min(d_resto, lb.x);
	}

	// O chão corta tudo reto, um pouco torto.
	float d = min(d_resto, d_cab);
	float chao = 0.006 * (rz(pl, 24.0, 1024.0, sem + 43 + k) - 0.5);
	d = smax(d, qo.y - chao, 0.02);

	// O pé escurece: a touceira assenta no chão.
	float perto = smoothstep(-0.24, 0.0, qo.y);
	c = mix(c, c * 0.76, perto * 0.75);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;

	// O contorno: a própria cor escurecida, mais grosso do lado da sombra e na base; marrom
	// em volta da espiga.
	vec2 centro = vec2(0.0, -0.40);
	vec2 dir_c = normalize(qo - centro + vec2(1e-4));
	float lado_sombra = dot(dir_c, -LUZ) * 0.5 + 0.5;
	lado_sombra = max(lado_sombra, smoothstep(-0.06, 0.0, qo.y));
	vec3 c_traco = mix(mix(c_cont, c_sombra, 0.3), c_cont, smoothstep(0.3, 0.8, lado_sombra));
	float perto_cab = 1.0 - smoothstep(-0.01, 0.01, d_cab - d_resto);
	c_traco = mix(c_traco, TABOA_CONTORNO, perto_cab);
	float esp = mix(1.5, 2.3, smoothstep(0.2, 0.85, lado_sombra)) * traco;
	esp = min(esp, esp_f);

	vec4 acc = vec4(0.0);
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + esp, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : c_traco;
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

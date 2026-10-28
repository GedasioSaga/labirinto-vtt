// ARBUSTO em pé, meio de lado (onda 3, lote 6; CONTRATO.md, seção 9). Da família da árvore
// aprovada em 28/10 (texturas/arvore/): a mesma vista, a mesma luz, o mesmo contorno e o
// mesmo jeito de cacho, só que baixo, largo e sem tronco.
//
// - Uma moita assentada no chão: 3 ou 4 cachos LARGOS (o arbusto é pequeno, 6 contra 15 da
//   árvore; mais cachos viram bolinha a 25%). Cada cacho em três camadas, como na copa da
//   árvore: a massa inteira no tom da sombra; por cima, a mesma forma menor e andada para a
//   luz, no tom do meio; e, só no cacho de cima à esquerda, um boné de luz. Embaixo à direita
//   de cada cacho da frente sobra um crescente escuro, que separa as massas sem linha por
//   dentro.
// - A base é chata, cortada pelo chão, e escura: um pé escuro, com a beira de baixo das
//   folhas em poucos lóbulos largos pendurados por cima dele, mostra onde a moita encosta.
// - As 4 formas mudam a largura, a altura, o tom e o número de cachos (3 ou 4): numa
//   fileira na beira do caminho, nenhuma parece o carimbo da vizinha.
// - "espelho": "nenhum" (o desenho tem um em pé) e a sombra "em-pe" do app, curta
//   (comprimento 0,40: a mesma conta da sombra "baixa" de hoje, COMPRIMENTO.baixa em
//   client/src/carimbos/arte.ts).
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qf = q - PE, y para baixo, 0 = o chão), que fica onde o pé de hoje fica (config:
// ancoraPx). Sem sombra no chão: ela é do app, pela silhueta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// O pé em unidades a partir do meio da imagem: (ancoraPx - ladoPx / 2) / unidadePx.
const vec2 PE = vec2(0.0133, 0.3188);
// A linha do chão fica um tico abaixo do pé: as folhas de baixo cobrem o ponto onde a
// sombra "em-pe" nasce, e ela sai grudada na base, sem fresta de grama clara.
const float CHAO_ABAIXO_DO_PE = 0.04;
// O crescente que um cacho joga no de trás: mais largo que o lóbulo do festão, senão ele só
// aparece no vão entre dois lóbulos e vira um furinho escuro em vez de uma faixa.
const vec2 SOMBRA_DENTRO = vec2(0.048, 0.062);

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
	return -smin(-a, -b, k);
}

int quantos(int k) {
	return (k == 1 || k == 3) ? 4 : 3;
}

// O cacho i da forma k, na ordem de pintar (de trás para a frente; o de cima à esquerda por
// último): xy = centro a partir do pé, z = raio, w = quanto ele pega de luz (1 = o boné de
// luz; 0 = todo na sombra).
vec4 cacho(int k, int i, int sem) {
	vec4 b;
	if (k == 1) {
		// Larga e baixa: quatro cachos, a mais comprida do lote.
		b = i == 0 ? vec4(0.335, -0.100, 0.165, 0.10)
			: i == 1 ? vec4(-0.335, -0.110, 0.175, 0.50)
			: i == 2 ? vec4(0.080, -0.160, 0.200, 0.35)
			: vec4(-0.130, -0.260, 0.195, 1.00);
	} else if (k == 2) {
		// Alta e redonda: um cacho grande no alto, sentado em dois pequenos.
		b = i == 0 ? vec4(0.180, -0.100, 0.160, 0.10)
			: i == 1 ? vec4(-0.170, -0.120, 0.180, 0.50)
			: vec4(-0.025, -0.350, 0.255, 1.00);
	} else if (k == 3) {
		// Torta: a massa grande à direita, um cacho baixo à esquerda e um no meio da frente.
		b = i == 0 ? vec4(0.205, -0.175, 0.230, 0.25)
			: i == 1 ? vec4(-0.330, -0.085, 0.145, 0.50)
			: i == 2 ? vec4(-0.050, -0.105, 0.165, 0.40)
			: vec4(-0.140, -0.330, 0.195, 1.00);
	} else {
		// A de sempre: dois na base, desiguais, e um grande no alto.
		b = i == 0 ? vec4(0.225, -0.115, 0.185, 0.15)
			: i == 1 ? vec4(-0.215, -0.125, 0.205, 0.55)
			: vec4(-0.020, -0.325, 0.240, 1.00);
	}
	uint h = hash_cel(vec2(float(k), float(i) + 50.0), sem + 801);
	vec2 j = (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.02;
	return vec4(b.xy + j, b.z * (0.97 + 0.06 * rk(h, 2)), b.w);
}

// A silhueta do cacho: poucos lóbulos largos e desiguais (festão raso, não serrilha).
float borda(int k, int i, vec3 l, vec2 q, int sem) {
	vec2 v = q - l.xy;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 30.0), sem + 709);
	float m = floor(l.z * 22.0 + 1.99 * rk(h, 2));
	float a = ang + 0.35 * sin(2.0 * ang + TAU * rk(h, 1));
	float t = (a / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float alto = 0.22 * l.z * (0.4 + 0.8 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j), sem + 711), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

// Folhas na beira da luz: cachinhos largos e desiguais ao longo da linha entre dois tons.
float beira_folhas(vec2 q, vec2 c, float r, int k, int i, int sem, float alto) {
	vec2 v = q - c;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 70.0), sem + 811);
	float m = 5.0 + floor(2.99 * rk(h, 2));
	float t = (ang / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float a = alto * r * (0.3 + 0.9 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j + 40.0), sem + 813), 0));
	float x = 2.0 * f - 1.0;
	return a * pow(max(1.0 - x * x, 0.0), 0.6);
}

// A sola: uma massa baixa e chata entre os cachos de baixo, para a moita encostar no chão
// inteira (sem ela, os cachos redondos só tocam o chão numa cordinha e a moita fica em pé
// sobre "pernas"). x = começo, y = fim, z = altura acima do chão.
vec3 sola(int k) {
	// Alta o bastante para cobrir FUNDO a junção dos cachos de baixo com o de cima: onde três
	// formas só se tocam, a distância da união fica menor que o traço e o contorno aparece por
	// dentro, como um ponto escuro.
	if (k == 1) {
		return vec3(-0.460, 0.450, 0.150);
	}
	if (k == 2) {
		return vec3(-0.300, 0.305, 0.180);
	}
	if (k == 3) {
		return vec3(-0.420, 0.400, 0.150);
	}
	return vec3(-0.400, 0.400, 0.170);
}

float sd_sola(vec2 q, vec3 b) {
	vec2 c = vec2((b.x + b.y) * 0.5, (0.06 - b.z) * 0.5);
	vec2 h = vec2((b.y - b.x) * 0.5, (b.z + 0.06) * 0.5);
	float r = 0.06;
	vec2 dd = abs(q - c) - h + r;
	return length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - r;
}

float sd_cacho(int k, int i, vec3 l, vec2 q, int sem, float s, float o) {
	vec2 c = l.xy + LUZ * o * l.z;
	return length(q - c) - l.z * s - borda(k, i, l, q - LUZ * o * l.z, sem) * s;
}

// A beira de baixo das folhas, por cima do pé escuro: 0 entre dois lóbulos, 1 no meio de um.
float lobos_do_pe(float x, int k, int sem) {
	uint h = hash_cel(vec2(float(k), 90.0), sem + 821);
	float t = (x + 0.6) / (0.19 + 0.03 * rk(h, 0)) + rk(h, 1);
	float j = floor(t);
	float f = fract(t);
	float a = 0.55 + 0.45 * rk(hash_cel(vec2(float(k), j), sem + 823), 0);
	float u = 2.0 * f - 1.0;
	return a * pow(max(1.0 - u * u, 0.0), 0.7);
}

vec3 tom(int k, int qual) {
	// Verde, como a árvore (k = 0).
	vec3 t0 = vec3(0.400, 0.643, 0.384);
	vec3 t1 = vec3(0.251, 0.490, 0.302);
	vec3 t2 = vec3(0.184, 0.396, 0.259);
	vec3 t3 = vec3(0.141, 0.318, 0.212);
	vec3 t4 = vec3(0.110, 0.255, 0.173);
	if (k == 1) {
		// Oliva, mais quente.
		t0 = vec3(0.471, 0.651, 0.373);
		t1 = vec3(0.341, 0.529, 0.290);
		t2 = vec3(0.259, 0.431, 0.243);
		t3 = vec3(0.200, 0.345, 0.200);
		t4 = vec3(0.153, 0.271, 0.161);
	} else if (k == 2) {
		// Verde-azulado, um pouco mais frio que a de sempre.
		t0 = vec3(0.373, 0.620, 0.420);
		t1 = vec3(0.235, 0.475, 0.337);
		t2 = vec3(0.173, 0.384, 0.282);
		t3 = vec3(0.133, 0.310, 0.235);
		t4 = vec3(0.106, 0.247, 0.188);
	} else if (k == 3) {
		// Claro.
		t0 = vec3(0.443, 0.694, 0.427);
		t1 = vec3(0.290, 0.545, 0.337);
		t2 = vec3(0.212, 0.447, 0.290);
		t3 = vec3(0.165, 0.361, 0.243);
		t4 = vec3(0.129, 0.290, 0.196);
	}
	return qual == 0 ? t0 : (qual == 1 ? t1 : (qual == 2 ? t2 : (qual == 3 ? t3 : t4)));
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qf = q - PE - vec2(0.0, CHAO_ABAIXO_DO_PE);
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float pxl = px * 128.0;
	float traco = 1.0 / unidade_mundo;
	vec2 qo = qf + 0.016 * (vec2(rz(pl, 48.0, 1024.0, sem + 31 + k), rz(pl, 48.0, 1024.0, sem + 37 + k)) - 0.5);
	float e = 1.2 * px;

	vec3 c_luz = tom(k, 0);
	vec3 c_meio = tom(k, 1);
	vec3 c_sombra = tom(k, 2);
	vec3 c_fundo = tom(k, 3);
	vec3 c_cont = tom(k, 4);
	float mancha = rz(pl, 32.0, 1024.0, sem + 17 + k) - 0.5;

	// Os cachos, de trás para a frente; o de cima à esquerda por último.
	int n = quantos(k);
	// Onde nenhum cacho cobre (a sola, entre os cachos de baixo): o tom da sombra, não o do
	// fundo, senão a fresta entre os cachos vira um furinho escuro a 300%.
	vec3 c = c_sombra;
	float d = 1e9;
	// A sola conta como já coberta: o crescente do cacho de cima corre inteiro por cima dela,
	// sem se partir na fresta entre os cachos de baixo (o toco solto lia como um ponto escuro).
	float cobriu = 1.0 - smoothstep(-e, e, sd_sola(qo, sola(k)));
	for (int i = 0; i < 4; i++) {
		if (i >= n) {
			break;
		}
		vec4 l = cacho(k, i, sem);
		float di = sd_cacho(k, i, l.xyz, qo, sem, 1.0, 0.0);
		float cov = 1.0 - smoothstep(-e, e * 0.5, di);
		float ds = sd_cacho(k, i, l.xyz, qo - SOMBRA_DENTRO, sem, 1.0, 0.0);
		c = mix(c, c_fundo, (1.0 - smoothstep(-0.03, 0.03, ds)) * (1.0 - cov) * cobriu * 0.8);
		vec3 c_m = mix(c_sombra, c_meio, 0.35 + 0.65 * l.w);
		float m1 = 1.0 - smoothstep(-e, e, sd_cacho(k, i, l.xyz, qo, sem, 0.84, 0.24) - beira_folhas(qo, l.xy + LUZ * 0.24 * l.z, l.z, k, i, sem, 0.07) + mancha * 0.03);
		vec3 tl = mix(c_sombra, c_m, m1);
		float w = smoothstep(0.7, 1.0, l.w);
		float m2 = 1.0 - smoothstep(-e, e, sd_cacho(k, i, l.xyz, qo, sem, 0.56, 0.52) - beira_folhas(qo, l.xy + LUZ * 0.52 * l.z, l.z, k, i + 8, sem, 0.09) + mancha * 0.035);
		tl = mix(tl, c_luz, m2 * w);
		c = mix(c, tl, cov);
		cobriu = max(cobriu, cov);
		d = min(d, di);
	}

	// Assentada no chão: a sola fecha a base entre os cachos (por baixo deles, no tom do fundo)
	// e a linha do pé, um pouco torta, corta tudo reto.
	d = smin(d, sd_sola(qo, sola(k)), 0.035);
	float chao = 0.006 * (rz(pl, 24.0, 1024.0, sem + 43 + k) - 0.5);
	d = smax(d, qo.y - chao, 0.03);

	// O pé escuro: embaixo, a moita escurece; a beira das folhas pende em lóbulos largos por
	// cima da faixa escura, que encosta no chão.
	float perto = smoothstep(-0.26, -0.02, qo.y);
	c = mix(c, c * 0.86, perto * 0.6);
	float beira = -0.085 + 0.045 * lobos_do_pe(qo.x, k, sem);
	float pe = smoothstep(beira - e, beira + e, qo.y);
	c = mix(c, mix(c_fundo, c_cont, smoothstep(beira, 0.0, qo.y) * 0.7), pe);

	c *= 1.0 + 0.04 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 40.0, -0.785, 0.5);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;

	// O contorno: a própria cor escurecida, mais grosso do lado da sombra e na base.
	vec2 centro = vec2(0.0, -0.26);
	vec2 dir = normalize(qo - centro + vec2(1e-4));
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	lado_sombra = max(lado_sombra, smoothstep(-0.06, 0.0, qo.y));
	vec3 c_traco = mix(mix(c_cont, c_meio, 0.35), c_cont, smoothstep(0.3, 0.8, lado_sombra));
	float esp = mix(1.6, 2.6, smoothstep(0.2, 0.85, lado_sombra)) * traco;

	vec4 acc = vec4(0.0);
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + esp, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : c_traco;
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

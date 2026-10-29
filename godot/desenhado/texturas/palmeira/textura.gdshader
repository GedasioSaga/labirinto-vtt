// PALMEIRA em pé, meio de lado (onda 3, lote 7; CONTRATO.md, seção 9).
//
// Da família do lote 6 aprovado (texturas/arvore/, pinheiro/, arbusto/): a mesma vista, a
// mesma luz de cima à esquerda, o mesmo contorno (a própria cor escurecida, fino na luz e
// mais grosso na sombra) e os mesmos tons de tronco.
//
// - O tronco é fino e curvo (uma curva de 2º grau do pé ao alto), metade na luz e metade na
//   sombra, com 3 a 5 anéis LARGOS: cada gomo escurece de leve embaixo e clareia em cima, e
//   o anel curva um pouco para baixo no meio (o anel visto de cima). Nada de risquinho.
// - O leque: 5 a 7 folhas compridas que saem do alto, sobem um pouco e caem nas pontas.
//   Cada folha é UMA forma larga, fina na base e na ponta, com a beira em festão raso (4 a 6
//   ondas desiguais, a de baixo um pouco mais funda: os folíolos pendurados). Nada de
//   folíolo por folíolo nem serrilha.
// - Cada folha em três camadas, como os cachos da árvore: a massa inteira no tom da sombra;
//   a metade virada para a luz no tom do meio (a beira entre as duas metades é a nervura,
//   com ondas largas); e, só nas folhas que apontam para cima ou para a esquerda, um boné de
//   luz encostado na beira clara. As folhas de trás ficam no tom da sombra. Cada folha faz
//   sombra na de baixo (uma massa embaixo à direita da outra), sem linha nenhuma por dentro.
// - 4 formas bem diferentes: a 1 média, inclinada para a direita, 6 folhas; a 2 alta, em
//   arco para a esquerda, 7 folhas, mais fria; a 3 baixa, em arco para a direita, 5 folhas
//   largas, mais quente; a 4 inclinada para a esquerda, 6 folhas, a mais escura.
// - "espelho": "nenhum" (em pé, transposto ele deitaria) e a sombra "em-pe" de hoje.
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qf = q - PE, y para baixo), que fica onde o pé de hoje fica (config: ancoraPx). Sem sombra
// no chão: ela é do app, pela silhueta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// O pé em unidades a partir do meio da imagem: (ancoraPx - ladoPx / 2) / unidadePx.
const vec2 PE = vec2(-0.05, 0.61);
const vec2 SOMBRA_DENTRO = vec2(0.020, 0.028);
const int MAX_FOLHAS = 7;

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float dot2(vec2 v) {
	return dot(v, v);
}

// O ponto mais perto numa curva de 2º grau (A, B controle, C): devolve (distância, t).
vec2 bezier_perto(vec2 pos, vec2 A, vec2 B, vec2 C) {
	vec2 a = B - A;
	vec2 b = A - 2.0 * B + C;
	vec2 c = a * 2.0;
	vec2 d = A - pos;
	float kk = 1.0 / max(dot(b, b), 1e-8);
	float kx = kk * dot(a, b);
	float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
	float kz = kk * dot(d, a);
	float p = ky - kx * kx;
	float p3 = p * p * p;
	float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
	float h = q * q + 4.0 * p3;
	float res;
	float t;
	if (h >= 0.0) {
		h = sqrt(h);
		vec2 x = (vec2(h, -h) - q) / 2.0;
		vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
		t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
		res = dot2(d + (c + b * t) * t);
	} else {
		float z = sqrt(-p);
		float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
		float m = cos(v);
		float n = sin(v) * 1.732050808;
		vec2 t2 = clamp(vec2(m + m, -n - m) * z - kx, 0.0, 1.0);
		float d1 = dot2(d + (c + b * t2.x) * t2.x);
		float d2 = dot2(d + (c + b * t2.y) * t2.y);
		if (d1 < d2) {
			res = d1;
			t = t2.x;
		} else {
			res = d2;
			t = t2.y;
		}
	}
	return vec2(sqrt(res), t);
}

// O tronco da forma k: x = altura até o alto, y = x do alto, z = x do controle (a curva),
// w = quantos anéis.
vec4 tronco(int k) {
	if (k == 1) {
		return vec4(0.88, 0.02, -0.16, 5.0);
	}
	if (k == 2) {
		return vec4(0.60, 0.12, 0.10, 3.0);
	}
	if (k == 3) {
		return vec4(0.74, -0.12, -0.02, 4.0);
	}
	return vec4(0.78, 0.14, 0.0, 4.0);
}

int n_folhas(int k) {
	return k == 1 ? 7 : (k == 2 ? 5 : 6);
}

// O ângulo da folha i em volta do alto, em graus: 0 = para a direita, 90 = para quem olha
// (desce na tela), -90 = para trás (sobe na tela).
float angulo_da_folha(int k, int i) {
	if (k == 1) {
		float a[7] = float[](-150.0, -112.0, -52.0, 4.0, 58.0, 126.0, 176.0);
		return radians(a[i]);
	}
	if (k == 2) {
		float a[7] = float[](-130.0, -48.0, 14.0, 66.0, 168.0, 0.0, 0.0);
		return radians(a[i]);
	}
	if (k == 3) {
		float a[7] = float[](-150.0, -72.0, -18.0, 36.0, 122.0, 166.0, 0.0);
		return radians(a[i]);
	}
	float a[7] = float[](-120.0, -58.0, -8.0, 52.0, 140.0, 188.0, 0.0);
	return radians(a[i]);
}

float comprimento(int k) {
	return k == 1 ? 0.54 : (k == 2 ? 0.46 : (k == 3 ? 0.52 : 0.51));
}

float largura(int k) {
	return k == 2 ? 0.088 : 0.080;
}

// A folha i: A = a base (o alto do tronco), B = o controle, T = a ponta, W = a meia largura,
// prof = de -1 (atrás) a 1 (na frente).
void folha(int k, int i, int sem, vec2 cc, out vec2 A, out vec2 B, out vec2 T, out float W, out float prof) {
	uint h = hash_cel(vec2(float(k), float(i) + 90.0), sem + 901);
	float th = angulo_da_folha(k, i) + (rk(h, 0) - 0.5) * 0.14;
	// As de trás um pouco mais compridas: só a parte de cima delas aparece acima do leque.
	float R = comprimento(k) * (0.90 + 0.20 * rk(h, 1)) * mix(1.0, 1.30, smoothstep(-0.2, -0.7, sin(th)));
	vec2 d = vec2(cos(th), sin(th) * 0.45);
	float lado = abs(cos(th));
	float atras = smoothstep(-0.2, -0.7, sin(th));
	float sobe = R * (0.36 + 0.10 * rk(h, 2)) * mix(1.0, 0.55, atras);
	// As de trás quase não caem (sobem para fora, a ponta à mostra acima do leque); as de
	// lado caem mais.
	float cai = R * (0.12 + 0.08 * rk(h, 3) + 0.16 * lado) * mix(1.0, 0.30, atras);
	A = cc;
	B = cc + d * R * 0.45 + vec2(0.0, -sobe);
	T = cc + d * R + vec2(0.0, cai);
	W = largura(k) * (0.92 + 0.16 * rk(h, 4));
	prof = sin(th);
}

// Mede a folha no ponto q: x = a distância à beira (negativa dentro), y = o lado (u > 0
// na metade virada para a luz), z = t ao longo (0 na base, 1 na ponta), w = a meia
// largura sem o festão.
vec4 medir_folha(vec2 q, vec2 A, vec2 B, vec2 T, float W, int k, int i, int sem) {
	vec2 r = bezier_perto(q, A, B, T);
	float t = r.y;
	vec2 tg = 2.0 * (1.0 - t) * (B - A) + 2.0 * t * (T - B);
	vec2 P = mix(mix(A, B, t), mix(B, T, t), t);
	vec2 v = q - P;
	float cr = tg.x * v.y - tg.y * v.x;
	vec2 dir = normalize(T - A + vec2(1e-5));
	float lado_luz = dot(vec2(dir.y, -dir.x), LUZ) >= 0.0 ? 1.0 : -1.0;
	float s = (cr < 0.0 ? 1.0 : -1.0) * lado_luz;
	// Larga quase até o fim e fina na base (o talo) e na ponta.
	float perfil = smoothstep(0.0, 0.22, t) * pow(max(1.0 - t, 0.0), 0.55) / 0.872;
	uint h = hash_cel(vec2(float(k), float(i) + 20.0), sem + 911);
	float m = 4.0 + floor(2.99 * rk(h, 0));
	float f = fract(t * m + (s > 0.0 ? rk(h, 1) : rk(h, 2)));
	float x = 2.0 * f - 1.0;
	float onda = pow(max(1.0 - x * x, 0.0), 0.65);
	// Sem festão perto da base, onde a folha ainda é estreita (lá ele vira serrilha).
	float fundo = (s > 0.0 ? 0.12 : 0.22) * smoothstep(0.12, 0.32, t);
	float wl = W * perfil * (1.0 - fundo + fundo * onda);
	return vec4(r.x - wl, r.x * s, t, W * perfil);
}

vec3 tom(int k, int qual) {
	vec3 t0 = vec3(0.345, 0.620, 0.392);
	vec3 t1 = vec3(0.212, 0.475, 0.322);
	vec3 t2 = vec3(0.157, 0.384, 0.275);
	vec3 t3 = vec3(0.122, 0.310, 0.235);
	vec3 t4 = vec3(0.102, 0.251, 0.188);
	if (k == 1) {
		t0 = vec3(0.318, 0.604, 0.420);
		t1 = vec3(0.184, 0.459, 0.345);
		t2 = vec3(0.137, 0.369, 0.290);
		t3 = vec3(0.106, 0.298, 0.247);
		t4 = vec3(0.090, 0.243, 0.200);
	} else if (k == 2) {
		t0 = vec3(0.420, 0.655, 0.365);
		t1 = vec3(0.275, 0.506, 0.290);
		t2 = vec3(0.200, 0.404, 0.243);
		t3 = vec3(0.161, 0.329, 0.208);
		t4 = vec3(0.133, 0.271, 0.173);
	} else if (k == 3) {
		t0 = vec3(0.310, 0.565, 0.361);
		t1 = vec3(0.188, 0.427, 0.294);
		t2 = vec3(0.137, 0.341, 0.247);
		t3 = vec3(0.106, 0.275, 0.208);
		t4 = vec3(0.090, 0.224, 0.169);
	}
	return qual == 0 ? t0 : (qual == 1 ? t1 : (qual == 2 ? t2 : (qual == 3 ? t3 : t4)));
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qf = q - PE;
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float pxl = px * 128.0;
	float traco = 1.0 / unidade_mundo;

	// O tronco.
	vec4 tr = tronco(k);
	float H = tr.x;
	float hh = -qf.y;
	float t = clamp(hh / H, 0.0, 1.0);
	float xa = 2.0 * (1.0 - t) * t * tr.z + t * t * tr.y;
	float incl = (2.0 * (1.0 - 2.0 * t) * tr.z + 2.0 * t * tr.y) / H;
	float lat = qf.x - xa;
	float wt = mix(0.030, 0.020, t) + 0.016 * exp(-t * 10.0);
	float uu = clamp(lat / wt, -1.0, 1.0);
	float r_an = (hh + 0.016 * sqrt(max(1.0 - uu * uu, 0.0))) / H * tr.w;
	float f_an = fract(r_an);
	float dt = (abs(lat) - wt) / sqrt(1.0 + incl * incl);
	dt = max(dt, qf.y - 0.004);
	dt = max(dt, hh - H - 0.03);
	vec3 t_luz = vec3(0.486, 0.361, 0.243);
	vec3 t_sombra = vec3(0.345, 0.251, 0.173);
	vec3 t_cont = vec3(0.243, 0.176, 0.122);
	vec3 ct = mix(t_luz, t_sombra, smoothstep(-0.15, 0.10, uu));
	// Os anéis: cada gomo escurece embaixo numa faixa larga e suave (um terço dele) e clareia
	// em cima; sem degrau na silhueta e sem risco.
	float banda = mix(0.76, 1.06, smoothstep(0.02, 0.38, f_an)) * mix(1.0, 0.92, smoothstep(0.80, 1.0, f_an));
	ct *= mix(1.0, banda, smoothstep(0.0, 0.3, r_an));
	ct = mix(ct, t_sombra * 0.72, smoothstep(H - 0.15, H - 0.05, hh) * 0.85);
	ct *= 1.0 + (grao(pl, 1024.0, sem + 41) - 1.0) * 0.6;

	// O leque.
	vec2 cc = vec2(tr.y, -H);
	vec2 qo = qf + 0.012 * (vec2(rz(pl, 64.0, 1024.0, sem + 31 + k), rz(pl, 64.0, 1024.0, sem + 37 + k)) - 0.5);
	float mancha = rz(pl, 40.0, 1024.0, sem + 17 + k) - 0.5;
	vec3 c_luz = tom(k, 0);
	vec3 c_meio = tom(k, 1);
	vec3 c_sombra = tom(k, 2);
	vec3 c_fundo = tom(k, 3);
	vec3 c_cont = tom(k, 4);

	int n = n_folhas(k);
	float profs[MAX_FOLHAS];
	int ordem[MAX_FOLHAS];
	for (int i = 0; i < MAX_FOLHAS; i++) {
		vec2 A;
		vec2 B;
		vec2 T;
		float W;
		float pr;
		folha(k, i, sem, cc, A, B, T, W, pr);
		profs[i] = i < n ? pr : 9.0;
		ordem[i] = i;
	}
	for (int a = 1; a < MAX_FOLHAS; a++) {
		for (int b = a; b > 0; b--) {
			if (profs[ordem[b]] < profs[ordem[b - 1]]) {
				int tmp = ordem[b];
				ordem[b] = ordem[b - 1];
				ordem[b - 1] = tmp;
			}
		}
	}

	vec3 c = c_fundo;
	float d = 1e9;
	float u_min = 0.0;
	float w_min = 1.0;
	float cobriu = 0.0;
	bool miolo = false;
	for (int m = 0; m < MAX_FOLHAS; m++) {
		int i = ordem[m];
		if (i >= n) {
			continue;
		}
		vec2 A;
		vec2 B;
		vec2 T;
		float W;
		float pr;
		folha(k, i, sem, cc, A, B, T, W, pr);
		if (!miolo && pr >= 0.0) {
			// O miolo do leque, entre as folhas de trás e as da frente.
			float dm = sd_elipse(qo - cc - vec2(0.0, 0.008), vec2(0.042, 0.026));
			float cm = 1.0 - smoothstep(-0.006, 0.004, dm);
			c = mix(c, c_sombra, cm);
			cobriu = max(cobriu, cm);
			if (dm < d) {
				d = dm;
				u_min = -1.0;
				w_min = 1.0;
			}
			miolo = true;
		}
		vec2 dir = normalize(T - A + vec2(1e-5));
		float dl = dot(dir, LUZ);
		float atras = smoothstep(-0.15, -0.55, pr);
		vec4 mf = medir_folha(qo, A, B, T, W, k, i, sem);
		float cov = 1.0 - smoothstep(-0.006, 0.003, mf.x);
		vec4 ms = medir_folha(qo - SOMBRA_DENTRO, A, B, T, W, k, i, sem);
		c = mix(c, c_fundo * 0.92, (1.0 - smoothstep(-0.02, 0.02, ms.x)) * (1.0 - cov) * cobriu * 0.8);
		vec3 c_m = mix(c_sombra, c_meio, 0.35 + 0.65 * smoothstep(-0.9, 0.3, dl));
		c_m = mix(c_m, c_sombra, atras);
		vec3 c_s = mix(c_sombra, c_fundo, atras);
		// A nervura: a beira entre a metade da sombra e a da luz, em ondas largas.
		uint hn = hash_cel(vec2(float(k), float(i) + 60.0), sem + 921);
		float mn = 3.0 + floor(2.99 * rk(hn, 0));
		float fn = fract(mf.z * mn + rk(hn, 1));
		float xn = 2.0 * fn - 1.0;
		float nerv = mf.w * (-0.08 + 0.16 * pow(max(1.0 - xn * xn, 0.0), 0.7) + mancha * 0.3);
		float m1 = smoothstep(-0.004, 0.004, mf.y - nerv);
		vec3 tl = mix(c_s, c_m, m1);
		// O boné de luz, só nas folhas que olham para a luz, encostado na beira clara.
		float wluz = smoothstep(-0.05, 0.45, dl) * (1.0 - atras);
		float limiar = mf.w * mix(0.48, 1.05, smoothstep(0.30, 0.70, mf.z));
		float m2 = smoothstep(-0.004, 0.004, mf.y - limiar - mancha * 0.012) * smoothstep(0.04, 0.12, mf.z);
		tl = mix(tl, c_luz, m2 * step(0.05, wluz));
		c = mix(c, tl, cov);
		cobriu = max(cobriu, cov);
		if (mf.x < d) {
			d = mf.x;
			u_min = mf.y;
			w_min = max(mf.w, 1e-3);
		}
	}
	c *= 1.0 + 0.05 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 48.0, -0.785, 0.5);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;
	float lado_sombra = 0.5 - 0.5 * clamp(u_min / w_min, -1.0, 1.0);
	vec3 c_traco = mix(mix(c_cont, c_meio, 0.35), c_cont, smoothstep(0.3, 0.8, lado_sombra));
	float esp = mix(1.6, 2.6, smoothstep(0.2, 0.85, lado_sombra)) * traco;

	vec4 acc = vec4(0.0);
	acc = sobre(acc, t_cont, cobre(dt, px));
	acc = sobre(acc, ct, cobre(dt + 1.6 * traco, px));
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + esp, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : (dt < d ? t_cont : c_traco);
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

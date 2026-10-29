// VASO DE PLANTA visto de cima (onda 3, lote 7; CONTRATO.md, seção 9.6). Móvel de 0,5 x 0,5
// casa: carimbo de destino "movel", 1 unidade = 1 casa, o pé no meio da imagem.
//
// - Visto DE CIMA, como os outros móveis de dentro de casa (a vista padrão do app, "de cima
//   com volume"): a boca do vaso é um anel de barro grosso em volta da planta. Em pé, ao lado
//   de uma mesa e de uma cadeira vistas de cima, o vaso pareceria um adesivo deitado no chão.
// - A borda é um toro: a beira de fora acende em cima à esquerda e escurece embaixo à
//   direita; por dentro é o contrário (a parede de baixo à direita olha para a luz). A borda
//   faz sombra na terra do lado de cima à esquerda, e a planta faz sombra na borda e na terra
//   do lado de baixo à direita (a única sombra pintada: a do chão é do app).
// - A planta vem do arbusto aprovado (texturas/arbusto/): os mesmos tons, o mesmo contorno e o
//   mesmo cacho largo em três camadas (a massa no tom da sombra; por cima, a mesma forma menor
//   e andada para a luz no tom do meio; o boné de luz só no cacho de cima à esquerda).
// - As 4 formas: 0 = baixa e larga (5 cachos, passa da borda), barro de hoje; 1 = alta (3
//   cachos grandes e altos, sombra comprida na borda), barro escuro; 2 = com flor (4 cachos e
//   duas flores contidas), terracota; 3 = mais seca (3 cachos pequenos, oliva e palha, mais
//   terra à mostra), barro claro e velho. O espelho diagonal (o padrão) dá 8 formas.
//
// q em casas, a partir do meio da imagem (y para baixo). Sem sombra no chão.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// O barro (client/src/texturas/meioTermo/materiais.ts e paleta.ts).
const vec3 BARRO = vec3(0.659, 0.451, 0.353);          // #a8735a, TOM_DO_BARRO: o vaso de hoje
const vec3 BARRO_ESCURO = vec3(0.541, 0.353, 0.275);   // #8a5a46, o barro oficial da vila
const vec3 TELHA_TERRACOTA = vec3(0.710, 0.431, 0.314); // #b56e50, telhaTerracota
// A terra dentro do vaso: a NOGUEIRA (#775739) a 62%.
const vec3 TERRA_DO_VASO = vec3(0.290, 0.212, 0.139);

// O barro de cada forma: o de hoje, o escuro, a terracota (puxada para o de hoje, que a
// terracota pura saturava demais) e o claro, desbotado como vaso velho.
vec3 barro(int k) {
	if (k == 1) {
		return BARRO_ESCURO;
	}
	if (k == 2) {
		return mix(TELHA_TERRACOTA, BARRO, 0.3);
	}
	if (k == 3) {
		return mix(BARRO, PRACA_SOMBRA, 0.4);
	}
	return BARRO;
}

// O vaso de cada forma: x = raio de fora, y = largura da borda, z = quanto a planta anda na
// sombra que ela faz na borda (a planta alta faz a sombra mais comprida).
vec3 vaso(int k) {
	if (k == 1) {
		return vec3(0.238, 0.072, 0.046);
	}
	if (k == 2) {
		return vec3(0.244, 0.074, 0.038);
	}
	if (k == 3) {
		return vec3(0.236, 0.070, 0.026);
	}
	return vec3(0.243, 0.074, 0.024);
}

int quantos(int k) {
	return (k == 0 || k == 2) ? 4 : 3;
}

// O cacho i da forma k, na ordem de pintar (de baixo para cima; o de cima à esquerda, o
// mais alto, por último): xy = centro em casas, z = raio, w = quanto ele pega de luz.
vec4 cacho(int k, int i, int sem) {
	vec4 b;
	if (k == 1) {
		// Alta: três cachos grandes, empilhados num domo.
		b = i == 0 ? vec4(0.055, 0.050, 0.100, 0.15)
			: i == 1 ? vec4(-0.062, 0.042, 0.096, 0.50)
			: vec4(-0.010, -0.035, 0.125, 1.00);
	} else if (k == 2) {
		// Com flor: quatro cachos médios.
		b = i == 0 ? vec4(0.075, 0.058, 0.088, 0.15)
			: i == 1 ? vec4(-0.080, 0.055, 0.086, 0.45)
			: i == 2 ? vec4(0.066, -0.066, 0.084, 0.50)
			: vec4(-0.035, -0.032, 0.112, 1.00);
	} else if (k == 3) {
		// Seca: três cachos pequenos, a terra aparecendo em volta.
		b = i == 0 ? vec4(0.062, 0.050, 0.074, 0.15)
			: i == 1 ? vec4(-0.068, 0.030, 0.078, 0.45)
			: vec4(0.004, -0.050, 0.086, 1.00);
	} else {
		// Baixa e larga: espalhada para os lados, passando da borda à direita e embaixo à
		// esquerda, com um cacho grande no meio. A borda fica à mostra em cima e embaixo: sem
		// ela, a 50% o vaso vira bola.
		b = i == 0 ? vec4(0.134, 0.046, 0.092, 0.15)
			: i == 1 ? vec4(-0.132, 0.070, 0.088, 0.40)
			: i == 2 ? vec4(0.055, -0.072, 0.086, 0.50)
			: vec4(-0.030, -0.012, 0.110, 1.00);
	}
	uint h = hash_cel(vec2(float(k), float(i) + 50.0), sem + 801);
	vec2 j = (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.008;
	return vec4(b.xy + j, b.z * (0.97 + 0.06 * rk(h, 2)), b.w);
}

// A silhueta do cacho: poucos lóbulos largos e desiguais (festão raso, não serrilha). A
// conta do arbusto, com o número de lóbulos medido no raio do arbusto (o cacho do vaso tem a
// metade do tamanho e quase o mesmo número de lóbulos).
float borda(int k, int i, vec3 l, vec2 q, int sem) {
	vec2 v = q - l.xy;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 30.0), sem + 709);
	float m = floor(l.z * 30.0 + 1.99 * rk(h, 2));
	float a = ang + 0.35 * sin(2.0 * ang + TAU * rk(h, 1));
	float t = (a / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float alto = 0.16 * l.z * (0.4 + 0.8 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j), sem + 711), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

// Folhas na beira da luz: cachinhos largos e desiguais ao longo da linha entre dois tons.
float beira_folhas(vec2 q, vec2 c, float r, int k, int i, int sem, float alto) {
	vec2 v = q - c;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 70.0), sem + 811);
	float m = 4.0 + floor(2.99 * rk(h, 2));
	float t = (ang / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float a = alto * r * (0.3 + 0.9 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j + 40.0), sem + 813), 0));
	float x = 2.0 * f - 1.0;
	return a * pow(max(1.0 - x * x, 0.0), 0.6);
}

float sd_cacho(int k, int i, vec3 l, vec2 q, int sem, float s, float o) {
	vec2 c = l.xy + LUZ * o * l.z;
	return length(q - c) - l.z * s - borda(k, i, l, q - LUZ * o * l.z, sem) * s;
}

// A silhueta da planta inteira (para a sombra dela na borda).
float sd_planta(vec2 q, int k, int sem) {
	float d = 1e9;
	for (int i = 0; i < 5; i++) {
		if (i >= quantos(k)) {
			break;
		}
		vec4 l = cacho(k, i, sem);
		d = min(d, sd_cacho(k, i, l.xyz, q, sem, 1.0, 0.0));
	}
	return d;
}

vec3 tom(int k, int qual) {
	// Verde, o do arbusto e da árvore (k = 0).
	vec3 t0 = vec3(0.400, 0.643, 0.384);
	vec3 t1 = vec3(0.251, 0.490, 0.302);
	vec3 t2 = vec3(0.184, 0.396, 0.259);
	vec3 t3 = vec3(0.141, 0.318, 0.212);
	vec3 t4 = vec3(0.110, 0.255, 0.173);
	if (k == 1) {
		// Verde-azulado, o arbusto 3 (a planta alta, mais funda).
		t0 = vec3(0.373, 0.620, 0.420);
		t1 = vec3(0.235, 0.475, 0.337);
		t2 = vec3(0.173, 0.384, 0.282);
		t3 = vec3(0.133, 0.310, 0.235);
		t4 = vec3(0.106, 0.247, 0.188);
	} else if (k == 2) {
		// Claro, o arbusto 4 (embaixo das flores).
		t0 = vec3(0.443, 0.694, 0.427);
		t1 = vec3(0.290, 0.545, 0.337);
		t2 = vec3(0.212, 0.447, 0.290);
		t3 = vec3(0.165, 0.361, 0.243);
		t4 = vec3(0.129, 0.290, 0.196);
	} else if (k == 3) {
		// Seca: o oliva do arbusto 2 puxado para a palha.
		t0 = vec3(0.580, 0.627, 0.392);
		t1 = vec3(0.447, 0.506, 0.306);
		t2 = vec3(0.357, 0.408, 0.255);
		t3 = vec3(0.278, 0.318, 0.204);
		t4 = vec3(0.208, 0.235, 0.153);
	}
	return qual == 0 ? t0 : (qual == 1 ? t1 : (qual == 2 ? t2 : (qual == 3 ? t3 : t4)));
}

// A flor: cinco pétalas largas e redondas (festão fundo), sem miolo de alvo.
float sd_flor(vec2 v, float rf, float giro) {
	float a = atan(v.y, v.x) + giro;
	float p = 0.5 + 0.5 * cos(5.0 * a);
	return length(v) - rf * (0.74 + 0.26 * pow(p, 0.5));
}

// As flores da forma 2: xy = centro, z = raio, w = giro das pétalas.
vec4 flor(int i) {
	return i == 0 ? vec4(-0.050, -0.052, 0.060, 0.3) : vec4(0.088, 0.034, 0.042, 1.1);
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 pl = (q + vec2(2.0)) * 256.0;
	vec2 pg = (q + vec2(2.0)) * 128.0;
	float pxl = px * 256.0;
	float traco = 1.0 / unidade_mundo;
	float e = 1.2 * px;
	vec2 qo = q + 0.006 * (vec2(rz(pl, 64.0, 1024.0, sem + 31 + k), rz(pl, 64.0, 1024.0, sem + 37 + k)) - 0.5);

	// ---------- o vaso ----------
	vec3 vs = vaso(k);
	float R = vs.x;
	float W = vs.y;
	float Ri = R - W;
	float Rt = Ri - 0.016;
	float r = length(q);
	vec2 dir = q / max(r, 1e-4);
	vec3 cb = barro(k) * (1.0 + 0.05 * (rz(pl, 64.0, 1024.0, sem + 5 + k) - 0.5));

	// A borda: a normal de um toro (t = -1 na beira de dentro, +1 na de fora).
	float t = clamp((r - (R - W * 0.5)) / (W * 0.5), -1.0, 1.0);
	vec3 n = normalize(vec3(dir * t * 0.85, sqrt(max(1.0 - 0.7225 * t * t, 0.0))));
	float lb = dot(n, normalize(vec3(LUZ, 0.9)));
	vec3 c_borda = mix(sombra_de(cb) * 0.9, mix(cb, realce_de(cb), 0.25), smoothstep(0.16, 0.4, lb));
	c_borda = mix(c_borda, realce_de(cb), smoothstep(0.73, 0.8, lb) * 0.85);

	// Por dentro: a parede (a de baixo à direita olha para a luz) e a terra.
	float lp = dot(-dir, LUZ);
	vec3 c_parede = mix(cb * 0.5, cb * 0.82, smoothstep(-0.6, 0.9, lp));
	float mancha_t = rz(pl, 32.0, 1024.0, sem + 61 + k) - 0.5;
	vec3 c_terra = TERRA_DO_VASO * (1.0 + 0.16 * mancha_t);
	vec3 c_boca = mix(c_terra, c_parede, smoothstep(Rt - e, Rt + e, r));
	// A borda faz sombra na boca, do lado de cima à esquerda.
	float sb = smoothstep(Ri - 0.014, Ri + 0.002, length(q + LUZ * 0.032));
	c_boca *= mix(1.0, 0.62, sb);
	vec3 cp = mix(c_boca, c_borda, smoothstep(Ri - e, Ri + e, r));
	// A linha fina entre a borda e a boca.
	float linha = 1.0 - smoothstep(0.0, 0.9 * traco + e, abs(r - Ri));
	cp = mix(cp, contorno_de(cb), linha * 0.55);

	// A sombra da planta na borda e na terra, para baixo e à direita.
	float dsp = sd_planta(qo + LUZ * vs.z, k, sem);
	cp *= mix(1.0, 0.7, 1.0 - smoothstep(-0.012, 0.014, dsp));
	cp *= 1.0 + 0.03 * pinceladas(pl, 1024.0, pxl, sem + 41 + k, 48.0, -0.785, 0.5);
	cp *= 1.0 + (grao(pg, 1024.0, sem + 29) - 1.0) * 0.6;

	float ls = dot(dir, -LUZ) * 0.5 + 0.5;
	float esp_v = mix(1.5, 2.4, smoothstep(0.2, 0.85, ls)) * traco;
	vec3 c_traco_v = mix(contorno_de(cb), contorno_de(cb) * 0.85, smoothstep(0.3, 0.8, ls));
	float d_vaso = r - R;

	// ---------- a planta ----------
	vec3 c_luz = tom(k, 0);
	vec3 c_meio = tom(k, 1);
	vec3 c_sombra = tom(k, 2);
	vec3 c_fundo = tom(k, 3);
	vec3 c_cont = tom(k, 4);
	float mancha = rz(pl, 64.0, 1024.0, sem + 17 + k) - 0.5;
	vec2 sombra_dentro = vec2(0.022, 0.028);

	int nq = quantos(k);
	vec3 c = c_sombra;
	float d = 1e9;
	float cobriu = 0.0;
	for (int i = 0; i < 5; i++) {
		if (i >= nq) {
			break;
		}
		vec4 l = cacho(k, i, sem);
		float di = sd_cacho(k, i, l.xyz, qo, sem, 1.0, 0.0);
		float cov = 1.0 - smoothstep(-e, e * 0.5, di);
		float ds = sd_cacho(k, i, l.xyz, qo - sombra_dentro, sem, 1.0, 0.0);
		c = mix(c, c_fundo, (1.0 - smoothstep(-0.015, 0.015, ds)) * (1.0 - cov) * cobriu * 0.8);
		// Um pouco mais de meio-tom que no arbusto: o cacho do vaso tem a metade do tamanho, e
		// com a beira escura do arbusto cada cacho lia como uma bola separada.
		vec3 c_m = mix(c_sombra, c_meio, 0.45 + 0.55 * l.w);
		// A seca tem um cacho mais pardo, já passando.
		if (k == 3 && i == 0) {
			c_m = mix(c_m, vec3(0.478, 0.420, 0.267), 0.45);
		}
		float m1 = 1.0 - smoothstep(-e, e, sd_cacho(k, i, l.xyz, qo, sem, 0.88, 0.2) - beira_folhas(qo, l.xy + LUZ * 0.2 * l.z, l.z, k, i, sem, 0.07) + mancha * 0.012);
		vec3 tl = mix(c_sombra, c_m, m1);
		float w = smoothstep(0.7, 1.0, l.w);
		float m2 = 1.0 - smoothstep(-e, e, sd_cacho(k, i, l.xyz, qo, sem, 0.56, 0.52) - beira_folhas(qo, l.xy + LUZ * 0.52 * l.z, l.z, k, i + 8, sem, 0.09) + mancha * 0.014);
		tl = mix(tl, c_luz, m2 * w);
		c = mix(c, tl, cov);
		cobriu = max(cobriu, cov);
		d = min(d, di);
	}
	// O domo: a beira da planta, mais baixa, escurece um pouco.
	vec2 centro = vec2(-0.01, -0.01);
	c *= mix(1.0, 0.9, smoothstep(0.1, 0.24, length(qo - centro)));
	c *= 1.0 + 0.04 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 48.0, -0.785, 0.5);
	c *= 1.0 + (grao(pg, 1024.0, sem + 29) - 1.0) * 0.6;

	vec2 dp = normalize(qo - centro + vec2(1e-4));
	float lsp = dot(dp, -LUZ) * 0.5 + 0.5;
	vec3 c_traco = mix(mix(c_cont, c_meio, 0.35), c_cont, smoothstep(0.3, 0.8, lsp));
	float esp = mix(1.3, 2.1, smoothstep(0.2, 0.85, lsp)) * traco;

	vec4 acc = vec4(0.0);
	acc = sobre(acc, c_traco_v, cobre(d_vaso, px));
	acc = sobre(acc, cp, cobre(d_vaso + esp_v, px));
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + esp, px));

	// ---------- as flores (forma 2) ----------
	if (k == 2) {
		// A rosa um pouco puxada para o verde de baixo: a 50% a flor não salta como pontinho.
		vec3 rosa = mix(mix(ROSA, BRANCO, 0.12), c_meio, 0.12);
		for (int i = 0; i < 2; i++) {
			vec4 f = flor(i);
			vec2 v = qo - f.xy;
			float df = sd_flor(v, f.z, f.w);
			float lf = luz_do_domo(v, vec2(0.0), f.z);
			vec3 cf = mix(sombra_de(rosa) * 0.94, rosa, smoothstep(-0.1, 0.45, lf));
			cf = mix(cf, mix(MIOLO, rosa, 0.25), 1.0 - smoothstep(f.z * 0.2 - e, f.z * 0.2 + e, length(v - LUZ * f.z * 0.08)));
			vec3 ctf = mix(contorno_de(ROSA), c_cont, 0.45);
			acc = sobre(acc, ctf, cobre(df, px));
			acc = sobre(acc, cf, cobre(df + 1.2 * traco, px));
		}
	}

	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : c_traco_v;
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

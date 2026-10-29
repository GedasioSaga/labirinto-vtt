// =====================================================================
// materiais.gdshaderinc: os cinco materiais de chão do estilo Desenhado.
// grama, terra, pedra (praça), madeira (assoalho) e telha.
//
// Inclua depois de base.gdshaderinc. Quem inclui declara antes:
//     bool regiao_grama(vec2 p)
// que diz onde capim e flor podem nascer (na textura exportada: sempre).
// Cada material recebe p (px do mundo), P (período), px (tamanho do
// pixel na tela, em px do mundo, para a borda suave) e a semente.
// =====================================================================

// ---------------------------------------------------------------- grama
vec3 grama_base(vec2 p, float P, float px, int sem, float variacao) {
	float n_g = rz(p, 256.0, P, sem + 1);
	float n_m = fz(p, 64.0, P, sem + 2, 3);
	float n_s = rz(p, 16.0, P, sem + 3);
	float t = smoothstep(0.28, 0.72, n_m * 0.6 + n_g * 0.28 + n_s * 0.12 + variacao * 0.1);
	vec3 c = mix(GRAMA_SOMBRA, GRAMA_REALCE, t);
	c = mix(GRAMA, c, 0.82);
	float n_w = rz(p + vec2(91.0, 37.0), 128.0, P, sem + 4);
	c = mix(c, GRAMA_QUENTE, 0.32 * smoothstep(0.56, 0.82, n_w));
	c = mix(c, GRAMA_FRIA, 0.24 * smoothstep(0.58, 0.86, 1.0 - n_w));
	c *= 1.0 + 0.05 * pinceladas(p, P, px, sem + 5, 16.0, -1.35, 0.9);
	return c;
}

// Risquinhos de capim: 3 a 5 folhas curvas por tufo, escuras no pé e claras na ponta.
vec4 tufos(vec2 p, float P, float px, int sem, float densidade) {
	float cel = 32.0;
	vec2 c0 = floor(p / cel);
	vec2 per = vec2(P / cel);
	vec4 acc = vec4(0.0);
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 c = c0 + vec2(float(i), float(j));
			uint h = hash_cel(mod(c, per), sem);
			if (rk(h, 0) > densidade) {
				continue;
			}
			vec2 base = (c + vec2(0.14, 0.3) + vec2(rk(h, 1), rk(h, 2)) * vec2(0.72, 0.6)) * cel;
			float alto = 7.5 + 6.5 * rk(h, 3);
			if (length(p - base + vec2(0.0, alto * 0.5)) > alto + 6.0) {
				continue;
			}
			if (!regiao_grama(base)) {
				continue;
			}
			float inclina = (rk(h, 4) - 0.5) * 0.6;
			// sombra no pé
			float ds = length((p - base - vec2(1.8, 0.9)) / vec2(5.8, 2.3)) - 1.0;
			acc = sobre(acc, SOMBRA_VERDE, (1.0 - smoothstep(-0.7, 0.5, ds)) * 0.2);
			int n = 3 + int(rk(h, 5) * 2.99);
			for (int b = 0; b < 5; b++) {
				if (b >= n) {
					break;
				}
				float t = float(b) - float(n - 1) * 0.5;
				float lado = t / max(float(n - 1) * 0.5, 1.0);
				vec2 pe = base + vec2(t * 1.7, 0.0);
				float altura = alto * (1.0 - 0.3 * abs(lado)) * (0.85 + 0.3 * rk(h, 10 + b));
				vec2 ponta = pe + vec2(lado * alto * 0.5 + inclina * alto, -altura);
				vec2 eixo = normalize(ponta - pe);
				vec2 meio = mix(pe, ponta, 0.5) + vec2(-eixo.y, eixo.x) * (lado * 1.3 + inclina * 1.5);
				float d = min(sd_traco(p, pe, meio, 1.2, 0.8), sd_traco(p, meio, ponta, 0.8, 0.28));
				float a = cobre(d, px);
				if (a <= 0.0) {
					continue;
				}
				float hh = clamp(dot(p - pe, ponta - pe) / dot(ponta - pe, ponta - pe), 0.0, 1.0);
				vec3 cor = mix(TUFO * 0.88, mix(TUFO, GRAMA_REALCE, 0.62), hh);
				if (abs(lado) < 0.3) {
					cor = mix(cor, GRAMA_REALCE * 1.03, 0.28 * hh);
				}
				acc = sobre(acc, cor, a);
			}
		}
	}
	return acc;
}

// Florzinhas em moitas: 1 a 4 flores de 5 pétalas, folhinhas e sombra suave.
vec4 flores(vec2 p, float P, float px, int sem, float densidade) {
	float cel = 64.0;
	vec2 c0 = floor(p / cel);
	vec2 per = vec2(P / cel);
	vec4 acc = vec4(0.0);
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 c = c0 + vec2(float(i), float(j));
			uint h = hash_cel(mod(c, per), sem);
			if (rk(h, 0) > densidade) {
				continue;
			}
			vec2 centro = (c + vec2(0.22) + vec2(rk(h, 1), rk(h, 2)) * 0.56) * cel;
			if (length(p - centro) > 24.0) {
				continue;
			}
			float esc = rk(h, 3);
			vec3 cor = esc < 0.36 ? ROSA : (esc < 0.66 ? AMARELO : (esc < 0.93 ? BRANCO : VIOLETA));
			vec3 miolo = (esc >= 0.66 && esc < 0.93) ? AMARELO * 0.97 : MIOLO;
			// folhinhas
			for (int f = 0; f < 2; f++) {
				vec2 fc = centro + (vec2(rk(h, 20 + f), rk(h, 22 + f)) - 0.5) * 15.0;
				if (!regiao_grama(fc)) {
					continue;
				}
				float ang = rk(h, 24 + f) * TAU;
				vec2 q = girar(p - fc, -ang);
				float d = sd_elipse(q, vec2(4.4, 1.8));
				vec3 cf = mix(FOLHA_ESCURA * 0.82, FOLHA_ESCURA * 1.12, smoothstep(-4.0, 4.0, q.x));
				cf = mix(cf, FOLHA_CONTORNO, cobre(abs(q.y) - 0.35, px) * 0.35 * step(abs(q.x), 3.2));
				acc = sobre(acc, cf, cobre(d, px) * 0.95);
			}
			int n = 1 + int(rk(h, 4) * 3.99);
			for (int k = 0; k < 4; k++) {
				if (k >= n) {
					break;
				}
				float rr = (k == 0) ? 0.0 : 4.0 + 8.0 * rk(h, 5 + k);
				float aa = rk(h, 10 + k) * TAU;
				vec2 fc = centro + vec2(cos(aa), sin(aa)) * rr;
				if (!regiao_grama(fc)) {
					continue;
				}
				float s = 0.95 + 0.4 * rk(h, 15 + k);
				vec2 q = p - fc;
				if (dot(q, q) > 64.0 * s * s) {
					continue;
				}
				// sombra da flor no chão
				float dsh = length(q - vec2(1.4, 1.8)) - 4.4 * s;
				acc = sobre(acc, SOMBRA_VERDE, (1.0 - smoothstep(-1.6, 1.6, dsh)) * 0.24);
				// pétala mais perto pelo ângulo (5 pétalas)
				float a0 = rk(h, 30 + k) * 1.2566371;
				float seg = 1.2566371;
				float ang = atan(q.y, q.x) - a0;
				float idx = floor(ang / seg + 0.5);
				vec2 qp = girar(q, -(a0 + idx * seg));
				float dp = sd_elipse(qp - vec2(2.55 * s, 0.0), vec2(2.4, 1.8) * s);
				vec3 cp = cor * mix(0.84, 1.05, smoothstep(0.4 * s, 4.6 * s, qp.x));
				float borda = 1.0 - smoothstep(0.0, 1.0, -dp / max(px, 0.5));
				cp = mix(cp, cor * 0.66, borda * 0.6);
				acc = sobre(acc, cp, cobre(dp, px));
				// miolo com um ponto de luz
				float dm = length(q) - 1.4 * s;
				vec3 cm = mix(miolo * 0.86, miolo * 1.18, clamp(0.5 - dot(q, vec2(0.7071)) * 0.4, 0.0, 1.0));
				acc = sobre(acc, cm, cobre(dm, px));
			}
		}
	}
	return acc;
}

vec3 grama(vec2 p, float P, float px, int sem, float variacao) {
	vec3 c = grama_base(p, P, px, sem, variacao);
	c = aplicar(c, tufos(p, P, px, sem + 40, 0.62 + 0.12 * variacao));
	c = aplicar(c, flores(p, P, px, sem + 60, 0.3 + 0.14 * variacao));
	return c * grao(p, P, sem + 80);
}

// ---------------------------------------------------------------- terra
vec3 terra(vec2 p, float P, float px, int sem) {
	float n_m = fz(p, 64.0, P, sem + 1, 3);
	float n_g = rz(p, 128.0, P, sem + 2);
	float n_s = rz(p, 16.0, P, sem + 3);
	vec3 c = mix(TERRA, TERRA_SOMBRA, smoothstep(0.42, 0.76, n_m * 0.62 + n_g * 0.26 + n_s * 0.12) * 0.85);
	c = mix(c, TERRA_AREIA, 0.5 * smoothstep(0.6, 0.86, 1.0 - n_m * 0.75 - n_s * 0.25));
	c *= 1.0 + 0.035 * pinceladas(p, P, px, sem + 4, 16.0, 0.0, 3.1);
	// grãos de areia: um por célula de 8 px, sem sair da célula
	{
		vec2 cc = floor(p / 8.0);
		uint h = hash_cel(mod(cc, vec2(P / 8.0)), sem + 5);
		vec2 o = (cc + vec2(0.22) + vec2(rk(h, 0), rk(h, 1)) * 0.56) * 8.0;
		float rr = 0.55 + 0.65 * rk(h, 2);
		float tt = rk(h, 3);
		vec3 cg = tt < 0.55 ? TERRA_SOMBRA * 0.9 : TERRA_AREIA * 1.05;
		c = mix(c, cg, cobre(length(p - o) - rr, px) * (tt < 0.85 ? 0.8 : 0.0));
	}
	// seixos com luz, sombra e contorno
	{
		float cel = 32.0;
		vec2 c0 = floor(p / cel);
		for (int j = -1; j <= 1; j++) {
			for (int i = -1; i <= 1; i++) {
				vec2 cc = c0 + vec2(float(i), float(j));
				uint h = hash_cel(mod(cc, vec2(P / cel)), sem + 6);
				if (rk(h, 0) > 0.45) {
					continue;
				}
				vec2 o = (cc + vec2(0.2) + vec2(rk(h, 1), rk(h, 2)) * 0.6) * cel;
				if (length(p - o) > 10.0) {
					continue;
				}
				float rr = 2.0 + 3.0 * rk(h, 3);
				vec2 ab = vec2(rr, rr * (0.62 + 0.3 * rk(h, 4)));
				float ang = rk(h, 5) * PI;
				vec2 q = girar(p - o, -ang);
				float ds = sd_elipse(girar(p - o - vec2(1.2, 1.6), -ang), ab * 1.06);
				c = mix(c, c * 0.74, (1.0 - smoothstep(-1.0, 1.4, ds)) * 0.55);
				float d = sd_elipse(q, ab);
				vec3 cs = mix(SEIXO, SEIXO_CINZA, step(0.62, rk(h, 6)) * 0.85) * (0.9 + 0.18 * rk(h, 7));
				vec2 nw = girar(q / ab, ang);
				cs *= 1.0 + 0.2 * dot(nw, LUZ);
				cs = mix(cs, cs * 1.16, (1.0 - smoothstep(0.0, 0.42, length(nw - LUZ * 0.42))) * 0.7);
				cs = mix(cs, cs * 0.62, cobre(abs(d + 0.45) - 0.45, px) * 0.85);
				c = mix(c, cs, cobre(d, px));
			}
		}
	}
	return c * grao(p, P, sem + 7);
}

// ---------------------------------------------------------------- pedra
// Lajes claras e quentes em fileiras, cada uma com tom, chanfro e às vezes rachadura;
// junta escura com musgo aqui e ali.
vec3 pedra(vec2 p, float P, float px, int sem) {
	float nl = P / 512.0 * 10.0;
	float alt = P / nl;
	float ns = P / 512.0 * 6.0;
	float slot = P / ns;
	float junta = 3.0;
	float yw = p.y + 2.4 * (rz(p, 64.0, P, sem + 1) - 0.5) * 2.0;
	float r = floor(yw / alt);
	float rw = mod(r, nl);
	float yl = yw - r * alt;
	float off = rnd(vec2(rw, 3.0), sem, 0) * slot;
	float x = p.x - off;
	float k = floor(x / slot);
	float b0 = (k + 0.26 * (2.0 * rnd(vec2(mod(k, ns), rw), sem, 1) - 1.0)) * slot;
	float b1 = (k + 1.0 + 0.26 * (2.0 * rnd(vec2(mod(k + 1.0, ns), rw), sem, 1) - 1.0)) * slot;
	float xa = b0;
	float xb = b1;
	float kk = k;
	if (x < b0) {
		kk = k - 1.0;
		xb = b0;
		xa = (k - 1.0 + 0.26 * (2.0 * rnd(vec2(mod(k - 1.0, ns), rw), sem, 1) - 1.0)) * slot;
	} else if (x >= b1) {
		kk = k + 1.0;
		xa = b1;
		xb = (k + 2.0 + 0.26 * (2.0 * rnd(vec2(mod(k + 2.0, ns), rw), sem, 1) - 1.0)) * slot;
	}
	uint h = hash_cel(vec2(mod(kk, ns), rw), sem + 7);
	vec2 centro = vec2((xa + xb) * 0.5, alt * 0.5);
	vec2 meia = vec2((xb - xa) * 0.5, alt * 0.5) - vec2(junta * 0.5);
	vec2 pl = vec2(x, yl);
	vec2 q = pl - centro;
	q += 1.3 * vec2(rz(p, 8.0, P, sem + 2) - 0.5, rz(p + vec2(31.0, 17.0), 8.0, P, sem + 3) - 0.5) * 2.0;
	float raio = 6.0 + 4.0 * rk(h, 0);
	float d = sd_caixa(q, meia, raio);
	vec2 n = normal_caixa(q, meia, raio);
	float t = rk(h, 1);
	vec3 c = t < 0.25 ? mix(PRACA, PRACA_REALCE, 0.75) : (t < 0.82 ? PRACA : mix(PRACA, PRACA_SOMBRA, 0.35));
	c *= vec3(1.0 + 0.035 * (rk(h, 2) - 0.5), 1.0, 1.0 - 0.05 * (rk(h, 2) - 0.5));
	c *= 0.96 + 0.08 * fz(p, 16.0, P, sem + 4, 2);
	c *= 1.0 - 0.06 * smoothstep(0.68, 0.8, rz(p, 2.0, P, sem + 5));
	float borda = smoothstep(-6.0, 0.0, d);
	c *= 1.0 + 0.085 * dot(n, LUZ) * borda;
	if (rk(h, 3) > 0.82) {
		vec2 a = centro + vec2((rk(h, 4) - 0.5) * meia.x, -meia.y);
		vec2 m = centro + vec2((rk(h, 5) - 0.5) * meia.x * 0.8, (rk(h, 6) - 0.5) * meia.y * 0.6);
		vec2 b = centro + vec2((rk(h, 7) - 0.5) * meia.x, meia.y * 0.35);
		float dr = min(sd_traco(pl, a, m, 0.55, 0.35), sd_traco(pl, m, b, 0.35, 0.1));
		c = mix(c, c * 0.72, cobre(dr, px) * 0.8);
	}
	vec3 cj = mix(mix(PRACA_JUNTA, PRACA_SOMBRA, 0.45) * 0.93, MUSGO, 0.3 * smoothstep(0.58, 0.78, rz(p, 32.0, P, sem + 6)));
	cj *= 0.92 + 0.08 * smoothstep(0.0, 2.0, d);
	c = mix(c, c * 0.8, cobre(abs(d + 0.6) - 0.6, px) * 0.6);
	return mix(cj, c, cobre(d, px)) * grao(p, P, sem + 8);
}

// ---------------------------------------------------------------- madeira
// Assoalho: 3 tábuas por casa, comprimentos sorteados, veio ondulado, nós, pregos.
vec3 madeira(vec2 p, float P, float px, int sem) {
	float nl = P / 64.0 * 3.0;
	float alt = P / nl;
	float r = floor(p.y / alt);
	float rw = mod(r, nl);
	float yl = p.y - r * alt;
	float n = 3.0 + step(0.5, rnd(vec2(rw, 1.0), sem, 0));
	float L = P / n;
	float off = rnd(vec2(rw, 2.0), sem, 1) * P;
	float x = p.x - off;
	float k = floor(x / L);
	float b0 = (k + 0.2 * (2.0 * rnd(vec2(mod(k, n), rw), sem, 2) - 1.0)) * L;
	float b1 = (k + 1.0 + 0.2 * (2.0 * rnd(vec2(mod(k + 1.0, n), rw), sem, 2) - 1.0)) * L;
	float xa = b0;
	float xb = b1;
	float kk = k;
	if (x < b0) {
		kk = k - 1.0;
		xb = b0;
		xa = (k - 1.0 + 0.2 * (2.0 * rnd(vec2(mod(k - 1.0, n), rw), sem, 2) - 1.0)) * L;
	} else if (x >= b1) {
		kk = k + 1.0;
		xa = b1;
		xb = (k + 2.0 + 0.2 * (2.0 * rnd(vec2(mod(k + 2.0, n), rw), sem, 2) - 1.0)) * L;
	}
	uint h = hash_cel(vec2(mod(kk, n), rw), sem + 3);
	float xl = x - xa;
	float comp = xb - xa;
	vec3 c = CARVALHO * (0.98 + 0.13 * rk(h, 0));
	c = mix(c, PINHO, 0.3 * rk(h, 1));
	c = mix(c, NOGUEIRA, 0.2 * rk(h, 2) * rk(h, 2));
	float g = fbm_p(vec2((p.x + rk(h, 3) * 40.0) / 64.0, p.y / 4.0), vec2(P / 64.0, P / 4.0), sem + 5, 2);
	float v = yl / alt * 2.4 + (g - 0.5) * 3.2 + rk(h, 4) * 4.0;
	float no_a = 0.0;
	float anel = 0.0;
	if (rk(h, 5) > 0.84) {
		vec2 nc = vec2(comp * (0.2 + 0.6 * rk(h, 6)), alt * (0.36 + 0.28 * rk(h, 7)));
		vec2 dn = (vec2(xl, yl) - nc) / vec2(4.2, 2.0);
		float dd = length(dn);
		v += 1.8 * exp(-dd * dd * 0.3);
		no_a = 1.0 - smoothstep(0.55, 1.0, dd);
		anel = (1.0 - smoothstep(0.0, 0.35, abs(dd - 1.55))) * (1.0 - smoothstep(1.5, 2.6, dd));
	}
	float dv = abs(fract(v + 0.5) - 0.5);
	c *= 1.0 - 0.11 * (1.0 - smoothstep(0.04, 0.11, dv));
	float fibra = fbm_p(vec2(p.x / 128.0, p.y / 2.0), vec2(P / 128.0, P / 2.0), sem + 6, 2);
	c *= 0.965 + 0.07 * fibra;
	c = mix(c, NOGUEIRA * 0.95, no_a * 0.6);
	c *= 1.0 - 0.1 * anel;
	c *= 1.0 + 0.07 * (1.0 - smoothstep(0.8, 2.6, yl)) - 0.08 * (1.0 - smoothstep(0.8, 3.0, alt - yl));
	c *= 1.0 + 0.05 * (1.0 - smoothstep(0.8, 2.4, xl)) - 0.06 * (1.0 - smoothstep(0.8, 2.6, comp - xl));
	vec2 pl = vec2(xl, yl);
	float dp = min(min(length(pl - vec2(5.0, alt * 0.3)), length(pl - vec2(5.0, alt * 0.7))),
			min(length(pl - vec2(comp - 5.0, alt * 0.3)), length(pl - vec2(comp - 5.0, alt * 0.7))));
	c = mix(c, NOGUEIRA * 0.66, cobre(dp - 0.95, px) * 0.85);
	float fr = min(min(yl, alt - yl), min(xl, comp - xl));
	c = mix(c, NOGUEIRA * 0.6, cobre(fr - 0.75, px));
	c *= 0.97 + 0.06 * rz(p, 128.0, P, sem + 9);
	return c * grao(p, P, sem + 10);
}

// ---------------------------------------------------------------- telha
// Telha em escama, 2 por casa na largura e 3 fileiras por casa, desencontradas meia telha.
// O beiral fica embaixo: a fileira de cima cobre o topo da de baixo e faz sombra nela.
vec3 telha(vec2 p, float P, float px, int sem, vec3 base) {
	float w = 512.0 / 20.0;
	float alt = 512.0 / 28.0;
	float nl = P / alt;
	float nw = P / w;
	float ext = 0.55 * alt;
	float r = floor(p.y / alt);
	float q = r - 1.0;
	float offq = mod(q, 2.0) * 0.5 * w;
	float kq = floor((p.x - offq) / w);
	float cxq = (kq + 0.5) * w + offq;
	float uq = (p.x - cxq) / (0.5 * w);
	float fundo_q = (q + 1.0) * alt + ext * sqrt(max(0.0, 1.0 - uq * uq));
	bool de_cima = p.y < fundo_q;
	float fila = de_cima ? q : r;
	float off = mod(fila, 2.0) * 0.5 * w;
	float k = floor((p.x - off) / w);
	float cx = (k + 0.5) * w + off;
	float y0 = (fila + 1.0) * alt;
	uint h = hash_cel(vec2(mod(k, nw), mod(fila, nl)), sem);
	float ux = (p.x - cx) / (0.5 * w);
	vec3 c = base * (0.9 + 0.2 * rk(h, 0));
	c = mix(c, base * vec3(1.08, 0.95, 0.86), 0.4 * rk(h, 1));
	c = mix(c, base * vec3(0.88, 0.86, 0.86), 0.35 * step(0.84, rk(h, 2)));
	c *= 1.0 - 0.1 * ux - 0.06 * ux * ux;
	float v = (p.y - fila * alt) / (alt + ext);
	c *= 1.04 - 0.14 * smoothstep(0.5, 1.0, v);
	if (rk(h, 3) > 0.94) {
		c = mix(c, LIQUEN, 0.38 * smoothstep(0.6, 0.72, rz(p, 2.0, P, sem + 9)));
	}
	if (!de_cima) {
		c *= 1.0 - 0.34 * exp(-(p.y - fundo_q) / 2.6);
	}
	c *= 1.0 + 0.07 * (rz(p, 4.0, P, sem + 7) - 0.5);
	float d = (p.y < y0) ? abs(p.x - cx) - 0.5 * w : sd_elipse(vec2(p.x - cx, p.y - y0), vec2(0.5 * w, ext));
	float w_lin = (p.y < y0) ? 0.8 : 1.25;
	float a_lin = cobre(abs(d + w_lin * 0.5) - w_lin * 0.5, px) * ((p.y < y0) ? 0.6 : 0.92);
	c = mix(c, base * 0.56, a_lin);
	return c * grao(p, P, sem + 11);
}

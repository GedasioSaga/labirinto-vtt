// Peça retangular vista de cima (móvel, parede, caixote, tapete...), com sombra suave
// no chão, chanfro de luz em cima e à esquerda, e contorno da própria cor escurecida
// (60% da luz, nunca preto), a regra do Meio-Termo.
shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;

uniform vec2 tamanho = vec2(64.0, 64.0);
uniform float raio = 4.0;
uniform vec3 cor = vec3(0.627, 0.482, 0.318);
uniform vec3 cor2 = vec3(0.831, 0.780, 0.647);
// 0 liso, 1 tábuas deitadas, 2 tábuas em pé, 3 linho, 4 tapete, 5 caixote, 6 colcha,
// 7 reboco, 8 almofada, 9 pedra lavrada, 10 prato, 11 caneca, 12 pão, 13 cesto de frutas
uniform int padrao = 0;
uniform float altura = 4.0;
uniform int semente = 1;
uniform float contorno = 1.3;
uniform int puxadores = 0;

varying vec2 local;

void vertex() {
	local = VERTEX;
}

#include "res://shaders/base.gdshaderinc"

// Tábuas ao longo de x; q vai de 0 a sz.
vec3 tabuas(vec2 q, vec2 sz, float larg, vec3 base, float px, int sem) {
	float r = floor(q.y / larg);
	float yl = q.y - r * larg;
	uint h = hash_cel(vec2(r, 3.0), sem);
	vec3 c = base * (0.92 + 0.16 * rk(h, 0));
	float g = fbm_p(vec2(q.x / 40.0 + rk(h, 1) * 50.0, q.y / 3.0), vec2(4096.0), sem + 1, 2);
	float v = yl / larg * 2.0 + (g - 0.5) * 2.8 + rk(h, 2) * 3.0;
	float dv = abs(fract(v + 0.5) - 0.5);
	c *= 1.0 - 0.15 * (1.0 - smoothstep(0.04, 0.11, dv));
	c *= 1.0 + 0.06 * (1.0 - smoothstep(0.6, 2.0, yl)) - 0.07 * (1.0 - smoothstep(0.6, 2.4, larg - yl));
	float fr = r < 0.5 ? 99.0 : yl;
	return mix(c, base * 0.58, cobre(fr - 0.7, px));
}

float largura_tabua(float lado) {
	return lado / max(1.0, floor(lado / 12.0 + 0.5));
}

vec3 pintar(vec2 u, vec2 q, vec2 meia, float d, float px) {
	vec3 c = cor;
	float m = min(meia.x, meia.y);
	if (padrao == 0) {
		c = cor * (0.96 + 0.08 * fbm_p(u / 14.0, vec2(4096.0), semente, 2));
	} else if (padrao == 1) {
		c = tabuas(u, tamanho, largura_tabua(tamanho.y), cor, px, semente);
	} else if (padrao == 2) {
		c = tabuas(u.yx, tamanho.yx, largura_tabua(tamanho.x), cor, px, semente);
	} else if (padrao == 3) {
		float trama = sin(u.x * 2.3) * sin(u.y * 2.3) * (1.0 - smoothstep(0.6, 1.4, px));
		c = cor * (0.98 + 0.035 * trama);
		c *= 0.94 + 0.12 * fbm_p(u / 20.0 + vec2(float(semente) * 3.1), vec2(4096.0), semente, 2);
	} else if (padrao == 4) {
		float dentro = -d;
		float b0 = m * 0.16;
		float b1 = m * 0.38;
		c = cor * (1.02 + 0.04 * fbm_p(u / 16.0, vec2(4096.0), semente, 2));
		if (dentro > b0 && dentro < b1) {
			c = cor * 0.72;
			float ao_longo = (meia.x - abs(q.x) < meia.y - abs(q.y)) ? q.y : q.x;
			float meio_barra = (b0 + b1) * 0.5;
			float lz = abs(fract(ao_longo / 10.0) - 0.5) * 10.0 + abs(dentro - meio_barra) * 1.4;
			c = mix(c, cor2, cobre(lz - 3.2, px) * 0.85);
		}
		c = mix(c, cor * 0.6, cobre(abs(dentro - b0) - 0.6, px) * 0.6);
		c = mix(c, cor * 0.6, cobre(abs(dentro - b1) - 0.6, px) * 0.6);
		vec2 lo = vec2(meia.x - b1 - m * 0.3, meia.y - b1 - m * 0.18);
		float dl = abs(q.x) / max(lo.x, 1.0) + abs(q.y) / max(lo.y, 1.0) - 1.0;
		vec3 cm = mix(cor, cor2, 0.55);
		c = mix(c, cm, cobre(dl * min(lo.x, lo.y), px));
		c = mix(c, cor * 0.62, cobre(abs(dl * min(lo.x, lo.y)) - 0.6, px) * 0.7);
		c *= 1.0 - 0.06 * (1.0 - smoothstep(0.0, 2.5, abs(fract(u.y / 4.0) - 0.5) * 4.0)) * (1.0 - smoothstep(0.6, 1.4, px));
	} else if (padrao == 5) {
		float fw = 0.15 * min(tamanho.x, tamanho.y);
		c = tabuas(u.yx, tamanho.yx, tamanho.x / 4.0, cor * 0.9, px, semente);
		float dx = min(sd_traco(u, vec2(fw), tamanho - vec2(fw), fw * 0.42, fw * 0.42),
				sd_traco(u, vec2(tamanho.x - fw, fw), vec2(fw, tamanho.y - fw), fw * 0.42, fw * 0.42));
		vec3 cx = cor * 1.03;
		cx = mix(cx, cor * 0.6, cobre(abs(dx + 0.55) - 0.55, px) * 0.8);
		c = mix(c, cor * 0.7, (1.0 - smoothstep(0.0, 3.0, dx)) * 0.35);
		c = mix(c, cx, cobre(dx, px));
		float df = max(abs(q.x) - (meia.x - fw), abs(q.y) - (meia.y - fw));
		vec3 cf = cor * 1.06;
		cf *= 1.0 + 0.05 * sin(u.x * 0.9 + u.y * 0.3);
		c = mix(c, cf, smoothstep(-0.5 * px, 0.5 * px, df));
		c = mix(c, cor * 0.58, cobre(abs(df) - 0.55, px) * 0.85);
		vec2 qn = abs(q) - (meia - vec2(fw * 0.5));
		c = mix(c, FERRO * 0.9, cobre(length(qn) - 1.2, px));
	} else if (padrao == 6) {
		float dobra = tamanho.y * 0.15;
		vec2 g = floor(u / 11.0);
		c = mod(g.x + g.y, 2.0) < 0.5 ? cor : cor * 0.87;
		vec2 fg = abs(fract(u / 11.0) - 0.5) * 11.0;
		float lb = min(5.5 - fg.x, 5.5 - fg.y);
		float ponto = step(0.45, fract((u.x + u.y) / 3.5));
		c = mix(c, cor2, cobre(lb - 0.5, px) * 0.45 * ponto);
		c *= 0.93 + 0.12 * fbm_p(u / 24.0 + vec2(5.0), vec2(4096.0), semente + 3, 2);
		if (u.y < dobra) {
			c = mix(cor2, cor * 1.25, 0.35) * (0.97 + 0.05 * sin(u.x * 0.5));
		} else {
			c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 3.5, u.y - dobra));
		}
		c = mix(c, cor * 0.62, cobre(abs(u.y - dobra) - 0.55, px) * 0.8);
	} else if (padrao == 7) {
		c = cor * (0.965 + 0.06 * fbm_p(u / 12.0 + vec2(float(semente)), vec2(4096.0), semente, 3));
		c *= 1.0 - 0.06 * smoothstep(0.7, 0.85, ruido_p(u / 2.0, vec2(4096.0), semente + 2));
	} else if (padrao == 8) {
		float r2 = length(q / meia);
		c = cor * (1.06 - 0.12 * smoothstep(0.3, 1.0, r2));
		c *= 1.0 - 0.08 * (1.0 - smoothstep(0.0, 1.6, abs(q.y))) * (1.0 - smoothstep(0.5, 0.9, abs(q.x) / meia.x));
	} else if (padrao == 9) {
		c = cor * (0.95 + 0.1 * fbm_p(u / 6.0 + vec2(float(semente) * 7.0), vec2(4096.0), semente, 2));
		c *= 1.0 - 0.08 * smoothstep(0.66, 0.8, ruido_p(u / 1.6, vec2(4096.0), semente + 4));
	} else if (padrao == 10) {
		float r2 = length(q) / m;
		c = cor * (1.04 - 0.05 * r2);
		c = mix(c, cor * 0.84, smoothstep(0.66, 0.6, r2) * 0.7);
		c = mix(c, cor * 0.7, cobre(abs(r2 - 0.63) * m - 0.4, px) * 0.6);
		c = mix(c, vec3(1.0), (1.0 - smoothstep(0.0, 0.25, length(q / m - vec2(-0.38, -0.42)))) * 0.35);
	} else if (padrao == 11) {
		float r2 = length(q) / m;
		c = cor * (1.04 - 0.06 * r2);
		c = mix(c, cor2, smoothstep(0.72, 0.68, r2));
		c = mix(c, cor2 * 1.3, (1.0 - smoothstep(0.0, 0.18, length(q / m - vec2(-0.25, -0.3)))) * 0.5);
	} else if (padrao == 12) {
		c = cor * (1.0 + 0.1 * dot(q / meia, LUZ));
		float corte = abs(fract((u.x + u.y * 0.35) / (tamanho.x / 3.0)) - 0.5) * (tamanho.x / 3.0);
		c = mix(c, cor * 1.22, cobre(corte - 1.1, px) * smoothstep(0.85, 0.6, length(q / meia)));
	} else if (padrao == 13) {
		// cesto de vime cheio de frutas (cor2 = cor da fruta)
		float r2 = length(q) / m;
		float ang = atan(q.y, q.x);
		float tr = abs(fract(ang / TAU * 22.0 + r2 * 2.0) - 0.5);
		c = cor * (0.82 + 0.26 * smoothstep(0.08, 0.38, tr));
		if (r2 < 0.74) {
			float fc = m * 0.36;
			vec2 g0 = floor(q / fc);
			vec3 cf = cor * 0.42;
			float alto_f = -1.0;
			for (int j = -1; j <= 1; j++) {
				for (int i = -1; i <= 1; i++) {
					vec2 gc = g0 + vec2(float(i), float(j));
					uint h = hash_cel(gc + vec2(7.0), semente);
					vec2 o = (gc + vec2(0.5) + (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.3) * fc;
					float fr = fc * (0.52 + 0.08 * rk(h, 2));
					float dd = length(q - o);
					if (dd < fr && length(o) < m * 0.7) {
						float zf = sqrt(1.0 - dd * dd / (fr * fr)) + rk(h, 3) * 0.3;
						if (zf > alto_f) {
							alto_f = zf;
							vec2 nn = (q - o) / fr;
							vec3 fcor = cor2 * (0.9 + 0.2 * rk(h, 4));
							cf = fcor * (0.86 + 0.34 * clamp(dot(nn, LUZ), -1.0, 1.0));
							cf = mix(cf, vec3(1.0), (1.0 - smoothstep(0.0, 0.32, length(nn - LUZ * 0.45))) * 0.32);
							cf = mix(cf, fcor * 0.55, cobre(abs(dd - fr + 0.4) - 0.4, px) * 0.8);
						}
					}
				}
			}
			c = cf * (1.0 - 0.28 * smoothstep(0.5, 0.74, r2) * max(dot(normalize(q + vec2(1e-4)), LUZ), 0.0));
		}
		c = mix(c, cor * 0.6, cobre(abs(r2 - 0.74) * m - 0.5, px) * 0.8);
	}
	return c;
}

void fragment() {
	vec2 p = local;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	vec2 meia = tamanho * 0.5;
	vec2 q = p - meia;
	float rr = min(raio, min(meia.x, meia.y));
	vec4 acc = vec4(0.0);
	// sombra suave no chão (luz de cima e da esquerda)
	if (altura > 0.01) {
		vec2 off = vec2(0.75, 0.95) * altura;
		float borr = 1.2 + altura * 0.8;
		float ds = sd_caixa(q - off, meia, rr);
		float a_s = (1.0 - smoothstep(-borr, borr, ds)) * 0.3;
		acc = sobre(acc, SOMBRA, a_s);
	}
	// franja do tapete, para fora dos lados curtos
	if (padrao == 4 && abs(q.y) < meia.y - 3.0 && abs(q.x) > meia.x && abs(q.x) < meia.x + 5.0) {
		float fio = abs(fract(q.y / 3.2) - 0.5) * 3.2;
		acc = sobre(acc, cor2 * 0.95, cobre(fio - 0.6, px) * 0.9);
	}
	float d = sd_caixa(q, meia, rr);
	if (d < 1.0) {
		vec3 c = pintar(p, q, meia, d, px);
		vec2 n = normal_caixa(q, meia, rr);
		float borda = smoothstep(-3.5, 0.0, d);
		c *= 1.0 + 0.12 * dot(n, LUZ) * borda;
		if (puxadores > 0) {
			for (int i = 0; i < 4; i++) {
				if (i >= puxadores) {
					break;
				}
				vec2 pc = vec2(tamanho.x * (float(i) + 1.0) / (float(puxadores) + 1.0), tamanho.y - 5.0);
				float dp = length(p - pc) - 2.4;
				c = mix(c, SOMBRA, (1.0 - smoothstep(-0.5, 1.5, length(p - pc - vec2(0.8, 1.0)) - 2.4)) * 0.4);
				vec3 cl = LATAO * (1.0 + 0.3 * dot(normalize(p - pc + vec2(1e-4)), LUZ) * smoothstep(0.0, 2.4, length(p - pc)));
				c = mix(c, mix(cl, LATAO * 0.6, cobre(abs(dp + 0.4) - 0.4, px) * 0.7), cobre(dp, px));
			}
		}
		c = mix(c, cor * 0.6, cobre(abs(d + contorno * 0.5) - contorno * 0.5, px));
		acc = sobre(acc, c, cobre(d, px));
	}
	COLOR = acc;
}

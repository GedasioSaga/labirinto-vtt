// Árvore redonda vista de cima: copa em bolas (um lobo no meio, oito em volta e três
// por cima), cada bola com luz de cima e da esquerda, cachos de folha, vinco onde um
// lobo passa por cima do outro, sombra que o lobo mais alto joga no vizinho e a
// sombra da árvore no chão. "tom" escurece para fazer arbusto.
shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;

uniform float raio = 64.0;
uniform int semente = 1;
uniform bool frutas = false;
uniform float tom = 1.0;

varying vec2 local;

void vertex() {
	local = VERTEX;
}

#include "res://shaders/base.gdshaderinc"

const int NL = 12;
const vec3 LUZ3 = vec3(-0.5, -0.6, 0.62);

void lobo(int k, float R, out vec2 c, out float r, out float z) {
	uint h = hash_cel(vec2(float(k), 5.0), semente);
	if (k == 0) {
		c = vec2(-0.05, -0.06) * R + (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.06 * R;
		r = 0.58 * R;
		z = 0.34 * R;
	} else if (k <= 8) {
		float a = (float(k) - 1.0) * TAU / 8.0 + 0.35 + (rk(h, 0) - 0.5) * 0.45;
		c = vec2(cos(a), sin(a)) * (0.45 + 0.08 * rk(h, 1)) * R;
		r = (0.44 + 0.1 * rk(h, 2)) * R;
		z = 0.05 * R * rk(h, 3);
	} else {
		float a = (float(k) - 9.0) * TAU / 3.0 + 1.1 + (rk(h, 0) - 0.5) * 0.6;
		c = vec2(cos(a), sin(a)) * (0.26 + 0.05 * rk(h, 1)) * R;
		r = (0.34 + 0.05 * rk(h, 2)) * R;
		z = 0.24 * R;
	}
}

vec3 rampa_folha(float l) {
	vec3 c = mix(FOLHA_SOMBRA, FOLHA_ESCURA, smoothstep(0.12, 0.42, l));
	c = mix(c, FOLHA, smoothstep(0.42, 0.7, l));
	return mix(c, FOLHA_LUZ, smoothstep(0.76, 0.98, l));
}

void fragment() {
	vec2 p = local;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	float R = raio;
	vec2 so = vec2(0.3, 0.36) * R;
	float dsh = 1e5;
	float duni = 1e5;
	float alto = -1e5;
	vec2 cb = vec2(0.0);
	float rb = 1.0;
	vec2 cn = vec2(0.0);
	float rn = 1.0;
	float dn = 1e5;
	int dentro = 0;
	for (int k = 0; k < NL; k++) {
		vec2 lc;
		float lr;
		float lz;
		lobo(k, R, lc, lr, lz);
		float dd = length(p - lc);
		dsh = min(dsh, length(p - so - lc) - lr);
		duni = min(duni, dd - lr);
		if (dd - lr < dn) {
			dn = dd - lr;
			cn = lc;
			rn = lr;
		}
		if (dd < lr) {
			dentro += 1;
			float hg = lz + sqrt(lr * lr - dd * dd);
			if (hg > alto) {
				alto = hg;
				cb = lc;
				rb = lr;
			}
		}
	}
	float a_s = (1.0 - smoothstep(-0.16 * R, 0.24 * R, dsh)) * 0.3;
	vec4 acc = vec4(SOMBRA_VERDE * a_s, a_s);
	if (duni < 1.5) {
		if (dentro == 0) {
			cb = cn;
			rb = rn;
			alto = 0.0;
		}
		vec2 dl = (p - cb) / rb;
		float hz = sqrt(max(1.0 - dot(dl, dl), 0.0));
		vec3 nrm = normalize(vec3(dl, hz * 1.1));
		float l = clamp(dot(nrm, normalize(LUZ3)), 0.0, 1.0);
		// cachos de folha: bolhas redondas (a mais alta vence) com vão escuro entre elas
		float cel = 0.17 * R;
		vec2 g0 = floor(p / cel);
		float hb = -1.0;
		vec2 nb = vec2(0.0);
		float bord = 1e5;
		int nbol = 0;
		vec2 o1 = vec2(0.0);
		uint h1 = 0u;
		for (int j = -1; j <= 1; j++) {
			for (int i = -1; i <= 1; i++) {
				vec2 gc = g0 + vec2(float(i), float(j));
				uint h = hash_cel(gc + vec2(40.0), semente + 11);
				vec2 o = (gc + vec2(0.2) + vec2(rk(h, 0), rk(h, 1)) * 0.6) * cel;
				float rc = cel * (0.64 + 0.22 * rk(h, 2));
				float dd = length(p - o);
				if (dd < rc) {
					nbol += 1;
					float zb = sqrt(1.0 - (dd * dd) / (rc * rc)) + rk(h, 3) * 0.35;
					if (zb > hb) {
						hb = zb;
						nb = (p - o) / rc;
						bord = rc - dd;
						o1 = o;
						h1 = h;
					}
				}
			}
		}
		// a forma grande (o lobo) manda na luz; a bolha só modula, e o vinco some na sombra
		float luz;
		if (nbol == 0) {
			luz = l * 0.62 - 0.04;
		} else {
			vec3 n3 = normalize(vec3(nb, sqrt(max(1.0 - dot(nb, nb), 0.0)) * 1.2));
			float lb = clamp(dot(n3, normalize(LUZ3)), 0.0, 1.0);
			luz = l * 0.9 + (lb - 0.6) * 0.24 + 0.02;
			if (nbol >= 2) {
				luz -= 0.12 * (0.35 + 0.65 * l) * (1.0 - smoothstep(0.0, max(px * 1.2, 0.02 * R), bord));
			}
			luz += 0.1 * smoothstep(0.55, 0.8, l) * smoothstep(0.82, 0.95, lb);
		}
		// sombra que um lobo mais alto joga neste
		float passo = 0.1 * R;
		vec2 t = p + LUZ * passo;
		float hmax = -1e5;
		for (int k = 0; k < NL; k++) {
			vec2 lc;
			float lr;
			float lz;
			lobo(k, R, lc, lr, lz);
			float dd = length(t - lc);
			if (dd < lr) {
				hmax = max(hmax, lz + sqrt(lr * lr - dd * dd));
			}
		}
		luz -= 0.3 * smoothstep(0.0, 0.06 * R, hmax - (alto + passo * 0.9));
		vec3 c = rampa_folha(clamp(luz, 0.0, 1.0)) * tom;
		if (frutas && nbol > 0 && rk(h1, 5) > 0.8 && l > 0.4) {
			vec2 fc = o1 + (vec2(rk(h1, 6), rk(h1, 7)) - 0.5) * cel * 0.3;
			float fr = 0.065 * R;
			float df = length(p - fc) - fr;
			c = mix(c, SOMBRA_VERDE, (1.0 - smoothstep(-0.5, 1.5, length(p - fc - vec2(1.0, 1.3)) - fr)) * 0.35);
			vec3 cf = vec3(0.84, 0.37, 0.29) * (1.0 + 0.32 * clamp(dot((p - fc) / fr, LUZ), -1.0, 1.0));
			cf = mix(cf, vec3(0.52, 0.21, 0.17), cobre(abs(df + 0.5) - 0.5, px) * 0.8);
			c = mix(c, cf, cobre(df, px));
		}
		if (dentro >= 2) {
			float borda_cima = rb - length(p - cb);
			c = mix(c, FOLHA_CONTORNO * tom, cobre(abs(borda_cima - 0.7) - 0.7, px) * 0.7);
		}
		c = mix(c, FOLHA_CONTORNO * 0.95 * tom, cobre(abs(duni + 0.9) - 0.9, px));
		acc = sobre(acc, c, cobre(duni, px));
	}
	COLOR = acc;
}

// Barril visto de cima: topo das aduelas em anel, cinta de ferro com rebites de latão,
// tampa de tábuas afundada (a cinta faz sombra nela) e batoque.
shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;

uniform float raio = 23.0;
uniform int semente = 2;
uniform vec3 madeira = vec3(0.627, 0.482, 0.318);

varying vec2 local;

void vertex() {
	local = VERTEX;
}

#include "res://shaders/base.gdshaderinc"

void fragment() {
	vec2 p = local;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	float R = raio;
	vec4 acc = vec4(0.0);
	float ds = length(p - vec2(0.26, 0.32) * R) - R;
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-0.18 * R, 0.26 * R, ds)) * 0.32);
	float r = length(p);
	float d = r - R;
	if (d < 1.0) {
		float rr = r / R;
		vec2 dir = p / max(r, 1e-3);
		float ang = atan(p.y, p.x);
		vec3 c;
		if (rr > 0.84) {
			float seg = (ang / TAU + 0.5) * 18.0;
			uint h = hash_cel(vec2(mod(floor(seg), 18.0), 1.0), semente);
			c = madeira * (0.8 + 0.18 * rk(h, 0));
			float dj = min(fract(seg), 1.0 - fract(seg)) * TAU * r / 18.0;
			c = mix(c, NOGUEIRA * 0.7, cobre(dj - 0.55, px) * 0.8);
		} else if (rr > 0.72) {
			float lz = dot(dir, LUZ);
			c = FERRO * (1.0 + 0.32 * lz);
			c = mix(c, FERRO * 1.55, (1.0 - smoothstep(0.0, 0.3, abs(lz - 0.85))) * 0.35);
			float sg = (ang / TAU + 0.5) * 8.0 + 0.25;
			float dr2 = length(vec2((fract(sg) - 0.5) * TAU * r / 8.0, r - 0.78 * R)) - 0.05 * R;
			c = mix(c, LATAO * (1.0 + 0.3 * lz), cobre(dr2, px));
		} else {
			float larg = 0.72 * R * 2.0 / 4.0;
			float yy = p.y + 0.72 * R;
			float fila = floor(yy / larg);
			float yl = yy - fila * larg;
			uint h = hash_cel(vec2(fila, 2.0), semente);
			c = madeira * (0.97 + 0.14 * rk(h, 0));
			float g = fbm_p(vec2(p.x / 12.0 + rk(h, 1) * 9.0, p.y / 2.0), vec2(4096.0), semente, 2);
			float v = yl / larg * 2.0 + (g - 0.5) * 2.2;
			c *= 1.0 - 0.12 * (1.0 - smoothstep(0.04, 0.1, abs(fract(v + 0.5) - 0.5)));
			if (fila > 0.5) {
				c = mix(c, NOGUEIRA * 0.65, cobre(yl - 0.6, px) * 0.85);
			}
			vec2 bq = p - vec2(0.3, 0.14) * R;
			float db = length(bq) - 0.1 * R;
			c = mix(c, NOGUEIRA * 0.85, cobre(db, px));
			c = mix(c, NOGUEIRA * 0.55, cobre(abs(db + 0.45) - 0.45, px));
			c *= 1.0 - 0.28 * smoothstep(0.52, 0.72, rr) * max(dot(dir, LUZ), 0.0);
		}
		c *= 1.0 + 0.08 * dot(p / R, LUZ);
		c = mix(c, NOGUEIRA * 0.6, cobre(abs(rr - 0.84) * R - 0.5, px) * 0.8);
		c = mix(c, FERRO * 0.55, cobre(abs(rr - 0.72) * R - 0.5, px) * 0.8);
		c = mix(c, madeira * 0.6, cobre(abs(d + 0.7) - 0.7, px));
		acc = sobre(acc, c, cobre(d, px));
	}
	COLOR = acc;
}

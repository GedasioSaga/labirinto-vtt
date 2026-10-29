// Telhado de duas águas visto de cima, com a telha em escama do material "telha".
// A água de cima vira para a luz (mais clara); a cumeeira é uma fileira de meias-canas;
// chaminé de pedra com face lateral, juntas, boca de fuligem e sombra no telhado.
shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;

uniform vec2 tamanho = vec2(396.8, 204.8);
uniform vec3 tom = vec3(0.710, 0.431, 0.314);
uniform int semente = 3;
uniform vec2 chamine = vec2(313.6, 22.4);
uniform float chamine_lado = 32.0;

varying vec2 local;

void vertex() {
	local = VERTEX;
}

#include "res://shaders/base.gdshaderinc"

bool regiao_grama(vec2 p) {
	return true;
}

#include "res://shaders/materiais.gdshaderinc"

void fragment() {
	vec2 p = local;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	vec2 meia = tamanho * 0.5;
	vec2 q = p - meia;
	vec4 acc = vec4(0.0);
	float ds = sd_caixa(q - vec2(14.0, 18.0), meia, 3.0);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-7.0, 9.0, ds)) * 0.32);
	float d = sd_caixa(q, meia, 2.0);
	if (d < 1.0) {
		float meio = meia.y;
		bool cima = p.y < meio;
		vec2 pt = cima ? vec2(p.x + 16.0, meio - p.y) : vec2(p.x, p.y - meio);
		vec3 c = telha(pt + vec2(7.0, 4.0), 512.0, px, semente + (cima ? 1 : 0), tom);
		c *= cima ? 1.06 : 0.86;
		float ate_borda = cima ? p.y : tamanho.y - p.y;
		c *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 8.0, ate_borda));
		float dr = abs(p.y - meio);
		float larg_c = 6.5;
		if (!cima) {
			c *= 1.0 - 0.28 * exp(-max(dr - larg_c, 0.0) / 3.0);
		}
		if (dr < larg_c + 1.0) {
			float seg = 22.0;
			float sx = mod(p.x + 5.0, seg);
			vec3 cr = tom * 0.84 * (1.0 + 0.2 * clamp(-(p.y - meio) / larg_c, -1.0, 1.0));
			cr *= 1.0 - 0.14 * smoothstep(seg * 0.55, seg, sx);
			cr = mix(cr, tom * 0.52, cobre(min(sx, seg - sx) - 0.7, px) * 0.8);
			cr = mix(cr, tom * 0.52, cobre(abs(dr - larg_c + 0.6) - 0.6, px));
			c = mix(c, cr, cobre(dr - larg_c, px));
		}
		c = mix(c, tom * 0.5, cobre(abs(d + 1.2) - 1.2, px));
		acc = sobre(acc, c, cobre(d, px));
	}
	// chaminé
	vec2 qc = p - chamine - vec2(chamine_lado * 0.5);
	float hc = chamine_lado * 0.5;
	float dsc = sd_caixa(qc - vec2(10.0, 12.0), vec2(hc), 2.0);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-4.0, 6.0, dsc)) * 0.38 * step(d, 0.0));
	float dl = sd_caixa(qc - vec2(3.0, 4.0), vec2(hc), 1.5);
	acc = sobre(acc, mix(PEDRA * 0.62, PEDRA * 0.42, cobre(abs(dl + 0.6) - 0.6, px)), cobre(dl, px));
	float dt = sd_caixa(qc, vec2(hc), 1.5);
	if (dt < 1.0) {
		float lado = chamine_lado / 2.0;
		vec2 u = qc + vec2(hc);
		float fila = floor(u.y / lado);
		float xo = mod(fila, 2.0) * lado * 0.5;
		float xx = mod(u.x + xo, lado);
		float yy = mod(u.y, lado);
		float jd = min(min(xx, lado - xx), min(yy, lado - yy));
		vec3 ct = PEDRA * (0.94 + 0.1 * rnd(vec2(floor((u.x + xo) / lado), fila), semente, 0));
		ct = mix(ct, PEDRA * 0.7, cobre(jd - 0.6, px) * 0.8);
		ct *= 1.0 + 0.1 * dot(normal_caixa(qc, vec2(hc), 1.5), LUZ) * smoothstep(-3.0, 0.0, dt);
		float db = sd_caixa(qc, vec2(hc * 0.52), 1.0);
		vec3 boca = mix(vec3(0.19, 0.17, 0.16), vec3(0.31, 0.28, 0.26), smoothstep(-hc * 0.52, 0.0, db));
		ct = mix(ct, boca, cobre(db, px));
		ct = mix(ct, PEDRA * 0.5, cobre(abs(db + 0.5) - 0.5, px) * 0.8);
		ct = mix(ct, PEDRA * 0.5, cobre(abs(dt + 0.6) - 0.6, px));
		acc = sobre(acc, ct, cobre(dt, px));
	}
	COLOR = acc;
}

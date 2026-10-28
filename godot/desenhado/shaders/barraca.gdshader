// Barraca de feira vista de cima: toldo de duas águas em faixas (vinho e linho), pano
// abaulado entre as costuras, vinco da cumeeira, babado em escamas na frente, pontas
// dos postes nos cantos e sombra larga no chão (o toldo é alto).
shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;

uniform vec2 tamanho = vec2(204.8, 128.0);
uniform float faixa = 25.6;
uniform vec3 cor_a = vec3(0.561, 0.290, 0.286);
uniform vec3 cor_b = vec3(0.831, 0.780, 0.647);
uniform int semente = 4;

varying vec2 local;

void vertex() {
	local = VERTEX;
}

#include "res://shaders/base.gdshaderinc"

float sd_toldo(vec2 p) {
	vec2 meia = tamanho * 0.5;
	float dr = sd_caixa(p - meia, meia, 2.0);
	float i = clamp(floor(p.x / faixa), 0.0, floor((tamanho.x - 0.01) / faixa));
	float dsc = length(p - vec2((i + 0.5) * faixa, tamanho.y)) - faixa * 0.5;
	return min(dr, dsc);
}

void fragment() {
	vec2 p = local;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	vec4 acc = vec4(0.0);
	float ds = sd_toldo(p - vec2(11.0, 15.0));
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-8.0, 11.0, ds)) * 0.32);
	float d = sd_toldo(p);
	if (d < 1.0) {
		float i = floor(p.x / faixa);
		vec3 c = mod(i, 2.0) < 0.5 ? cor_b : cor_a;
		float u = fract(p.x / faixa);
		c *= 0.95 + 0.08 * sin(u * PI);
		float cume = tamanho.y * 0.42;
		if (p.y < cume) {
			c *= 1.03 + 0.05 * (p.y / cume);
		} else {
			c *= 0.94 - 0.1 * (p.y - cume) / (tamanho.y - cume);
		}
		float costura = min(u, 1.0 - u) * faixa;
		c = mix(c, c * 0.78, cobre(costura - 0.5, px) * 0.6);
		c = mix(c, c * 0.7, cobre(abs(p.y - cume) - 0.7, px) * 0.8);
		c = mix(c, c * 1.12, cobre(abs(p.y - cume + 2.4) - 0.8, px) * 0.55);
		float babado = tamanho.y - 7.0;
		if (p.y > babado) {
			c *= 0.93;
		}
		c = mix(c, c * 0.74, cobre(abs(p.y - babado) - 0.5, px) * 0.55 * step(costura, faixa));
		c *= 0.97 + 0.06 * fbm_p(p / 18.0, vec2(4096.0), semente, 2);
		for (int k = 0; k < 4; k++) {
			vec2 canto = vec2(k % 2 == 0 ? 5.0 : tamanho.x - 5.0, k < 2 ? 5.0 : tamanho.y - 9.0);
			float dp = length(p - canto) - 2.8;
			vec3 cp = NOGUEIRA * (1.0 + 0.35 * clamp(dot((p - canto) / 2.8, LUZ), -1.0, 1.0));
			c = mix(c, c * 0.8, (1.0 - smoothstep(-0.5, 1.5, length(p - canto - vec2(1.0, 1.3)) - 2.8)) * 0.5);
			c = mix(c, cp, cobre(dp, px));
		}
		c = mix(c, cor_a * 0.6, cobre(abs(d + 0.75) - 0.75, px));
		acc = sobre(acc, c, cobre(d, px));
	}
	COLOR = acc;
}

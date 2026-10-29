// ÁRVORE em pé, meio de lado (onda 3, lote 6; CONTRATO.md, seção 9). Refeita em 28/10.
//
// O piloto era a copa vista de cima, sem tronco: lia como moita ou nuvem verde, clara demais
// para a grama aprovada. Esta é a árvore como o app de hoje a mostra (a copa no alto, o
// tronco embaixo com as raízes abrindo no chão), com o desenho calmo do Desenhado:
//
// - A copa é 5 ou 6 cachos LARGOS (nada de bolinha), pintados como a mão pinta folhagem, em
//   três camadas por cacho: a massa inteira no tom da sombra; por cima, a mesma forma menor
//   e andada para a luz, no tom do meio; e, só nos cachos de cima à esquerda, uma terceira,
//   menor ainda, na luz. Embaixo à direita de cada cacho sobra um crescente escuro: é ele que
//   separa as massas, sem linha nenhuma por dentro. A beira entre dois tons tem cachinhos
//   largos e desiguais (a luz não é um arco de compasso); a silhueta tem poucos cachos de
//   ponta firme. Os cachos de baixo ficam na sombra da própria copa.
// - Os tons são mais fechados que os do piloto e puxados para o verde-azulado (a grama é
//   amarelada): a copa salta da grama sem escurecer como a de hoje.
// - O tronco: metade na luz (a esquerda), metade na sombra, a sombra da copa no alto dele.
// - O desenho tem um "em pé" (o tronco embaixo): ele NÃO pode espelhar na diagonal, por isso
//   o config pede "espelho": "nenhum" (4 formas, uma por arquivo) e a sombra "em-pe", a
//   silhueta deitada no chão a partir do pé, para baixo e à direita, como a de hoje
//   (matrizDaSombra; CONTRATO.md 9.4).
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qf = q - PE, y para baixo), que fica onde o pé de hoje fica (config: ancoraPx). Sem sombra
// no chão: ela é do app, pela silhueta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// O pé em unidades a partir do meio da imagem: (ancoraPx - ladoPx / 2) / unidadePx.
const vec2 PE = vec2(-0.008, 0.6141);
const vec2 SOMBRA_DENTRO = vec2(0.026, 0.034);

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

bool usa(int k, int i) {
	return !(k == 1 && i == 3);
}

vec2 centro_da_copa(int k) {
	if (k == 1) {
		return vec2(0.02, -0.75);
	}
	if (k == 2) {
		return vec2(-0.01, -0.67);
	}
	if (k == 3) {
		return vec2(0.03, -0.71);
	}
	return vec2(0.0, -0.71);
}

float inclina(int k) {
	if (k == 1) {
		return 0.025;
	}
	if (k == 2) {
		return -0.015;
	}
	if (k == 3) {
		return 0.04;
	}
	return 0.0;
}

// O cacho i da variação k: xy = centro a partir do centro da copa, z = raio.
vec3 cacho(int k, int i, int sem) {
	vec3 b = vec3(0.0, 0.15, 0.20);
	if (i == 0) {
		b = vec3(0.0, -0.17, 0.24);
	} else if (i == 1) {
		b = vec3(-0.20, 0.13, 0.19);
	} else if (i == 2) {
		b = vec3(0.20, 0.14, 0.185);
	} else if (i == 3) {
		b = vec3(-0.24, -0.06, 0.175);
	} else if (i == 4) {
		b = vec3(0.24, -0.05, 0.18);
	}
	uint h = hash_cel(vec2(float(k), float(i) + 50.0), sem + 801);
	vec2 j = (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.05;
	float r = b.z * (0.92 + 0.16 * rk(h, 2));
	vec2 c = b.xy;
	if (k == 1) {
		c *= vec2(0.84, 1.12);
		r *= 0.96;
	} else if (k == 2) {
		c *= vec2(1.12, 0.90);
	} else if (k == 3) {
		c.x += 0.05 * (0.2 - c.y);
		r *= c.x > 0.0 ? 1.07 : 0.93;
	}
	return vec3(c + j, r);
}

float borda(int k, int i, vec3 l, vec2 q, int sem) {
	vec2 v = q - l.xy;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 30.0), sem + 709);
	float m = 4.0 + floor(2.99 * rk(h, 2));
	float a = ang + 0.35 * sin(2.0 * ang + TAU * rk(h, 1));
	float t = (a / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float alto = 0.022 * (0.3 + 0.95 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j), sem + 711), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

// Folhas na beira da luz: cachinhos largos e desiguais ao longo da linha entre dois tons
// (a linha da luz não é um arco de compasso). Só dentro do cacho; a silhueta não muda.
float beira_folhas(vec2 q, vec2 c, int k, int i, int sem, float alto) {
	vec2 v = q - c;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 70.0), sem + 811);
	float m = 9.0 + floor(4.99 * rk(h, 2));
	float t = (ang / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float a = alto * (0.3 + 0.9 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j + 40.0), sem + 813), 0));
	float x = 2.0 * f - 1.0;
	return a * pow(max(1.0 - x * x, 0.0), 0.6);
}

float sd_cacho(int k, int i, vec3 l, vec2 q, int sem, float s, float o) {
	vec3 ls = vec3(l.xy + LUZ * o * l.z, l.z * s);
	return length(q - ls.xy) - ls.z - borda(k, i, l, q - LUZ * o * l.z, sem) * s;
}

vec3 tom(int k, int qual) {
	vec3 t0 = vec3(0.345, 0.620, 0.392);
	vec3 t1 = vec3(0.212, 0.475, 0.322);
	vec3 t2 = vec3(0.157, 0.384, 0.275);
	vec3 t3 = vec3(0.122, 0.310, 0.235);
	vec3 t4 = vec3(0.102, 0.251, 0.188);
	if (k == 1) {
		t0 = vec3(0.318, 0.604, 0.408);
		t1 = vec3(0.188, 0.459, 0.333);
		t2 = vec3(0.141, 0.369, 0.282);
		t3 = vec3(0.110, 0.298, 0.239);
		t4 = vec3(0.094, 0.243, 0.192);
	} else if (k == 2) {
		t0 = vec3(0.392, 0.627, 0.373);
		t1 = vec3(0.247, 0.478, 0.302);
		t2 = vec3(0.180, 0.384, 0.255);
		t3 = vec3(0.145, 0.314, 0.216);
		t4 = vec3(0.122, 0.259, 0.184);
	} else if (k == 3) {
		t0 = vec3(0.384, 0.675, 0.431);
		t1 = vec3(0.243, 0.533, 0.353);
		t2 = vec3(0.180, 0.431, 0.306);
		t3 = vec3(0.141, 0.353, 0.259);
		t4 = vec3(0.118, 0.290, 0.212);
	}
	return qual == 0 ? t0 : (qual == 1 ? t1 : (qual == 2 ? t2 : (qual == 3 ? t3 : t4)));
}

float sd_copa(int k, vec2 qc, int sem) {
	float d = 1e9;
	for (int i = 0; i < 6; i++) {
		if (usa(k, i)) {
			d = min(d, sd_cacho(k, i, cacho(k, i, sem), qc, sem, 1.0, 0.0));
		}
	}
	return d;
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qf = q - PE;
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float pxl = px * 128.0;
	float traco = 1.0 / unidade_mundo;
	vec2 qo = qf + 0.02 * (vec2(rz(pl, 64.0, 1024.0, sem + 31 + k), rz(pl, 64.0, 1024.0, sem + 37 + k)) - 0.5);
	vec2 C = centro_da_copa(k);
	vec2 qc = qo - C;

	vec3 c_luz = tom(k, 0);
	vec3 c_meio = tom(k, 1);
	vec3 c_sombra = tom(k, 2);
	vec3 c_fundo = tom(k, 3);
	vec3 c_cont = tom(k, 4);
	float mancha = rz(pl, 40.0, 1024.0, sem + 17 + k) - 0.5;

	// A copa: os cachos de trás e de baixo primeiro, o do alto por último; cada um em três
	// camadas (a massa no tom da sombra, a forma andada para a luz no meio e, nos de cima à
	// esquerda, a luz). Os de baixo ficam na sombra da própria copa.
	int ordem[6] = int[](3, 4, 1, 2, 5, 0);
	vec3 c = c_fundo;
	float d = 1e9;
	float cobriu = 0.0;
	for (int m = 0; m < 6; m++) {
		int i = ordem[m];
		if (!usa(k, i)) {
			continue;
		}
		vec3 l = cacho(k, i, sem);
		float dl = dot(normalize(l.xy + vec2(0.0, -1e-3)), LUZ);
		float embaixo = smoothstep(0.0, 0.14, l.y);
		float di = sd_cacho(k, i, l, qc, sem, 1.0, 0.0);
		float cov = 1.0 - smoothstep(-0.008, 0.004, di);
		float ds = sd_cacho(k, i, l, qc - SOMBRA_DENTRO, sem, 1.0, 0.0);
		c = mix(c, c_fundo, (1.0 - smoothstep(-0.026, 0.026, ds)) * (1.0 - cov) * cobriu * 0.85);
		vec3 c_m = mix(c_sombra, c_meio, (0.30 + 0.70 * smoothstep(-0.95, 0.25, dl)) * (1.0 - 0.55 * embaixo));
		float m1 = 1.0 - smoothstep(-0.006, 0.006, sd_cacho(k, i, l, qc, sem, 0.86, 0.22) - beira_folhas(qc, l.xy + LUZ * 0.22 * l.z, k, i, sem, 0.012) + mancha * 0.035);
		vec3 tl = mix(c_sombra, c_m, m1);
		float w = smoothstep(0.05, 0.55, dl) * (1.0 - embaixo);
		float m2 = 1.0 - smoothstep(-0.006, 0.006, sd_cacho(k, i, l, qc, sem, mix(0.52, 0.68, w), mix(0.56, 0.46, w)) - beira_folhas(qc, l.xy + LUZ * mix(0.56, 0.46, w) * l.z, k, i + 8, sem, 0.015) + mancha * 0.04);
		tl = mix(tl, c_luz, m2 * step(0.08, w));
		c = mix(c, tl, cov);
		cobriu = max(cobriu, cov);
		d = min(d, di);
	}
	c *= 1.0 + 0.05 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 48.0, -0.785, 0.5);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;
	vec2 dir = normalize(qc + vec2(1e-4));
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	vec3 c_traco = mix(mix(c_cont, c_meio, 0.35), c_cont, smoothstep(0.3, 0.8, lado_sombra));
	float esp = mix(1.6, 2.6, smoothstep(0.2, 0.85, lado_sombra)) * traco;

	// O tronco: metade na luz (a esquerda), metade na sombra, as raízes abrindo no chão.
	float inc = inclina(k);
	vec2 topo = vec2(inc, C.y + 0.14);
	float dt = sd_traco(qf, vec2(0.0, -0.01), topo, 0.044, 0.030);
	dt = smin(dt, sd_traco(qf, vec2(-0.015, -0.03), vec2(-0.10, 0.012), 0.024, 0.007), 0.025);
	dt = smin(dt, sd_traco(qf, vec2(0.015, -0.03), vec2(0.115, 0.018), 0.026, 0.007), 0.025);
	float eixo = inc * clamp(-qf.y / max(-topo.y, 0.1), 0.0, 1.0);
	float lado = qf.x - eixo;
	vec3 t_luz = vec3(0.486, 0.361, 0.243);
	vec3 t_sombra = vec3(0.345, 0.251, 0.173);
	vec3 t_cont = vec3(0.243, 0.176, 0.122);
	vec3 ct = mix(t_luz, t_sombra, smoothstep(-0.012, 0.0, lado));
	float na_sombra = 1.0 - smoothstep(-0.02, 0.02, sd_copa(k, qf - vec2(0.02, 0.085) - C, sem));
	ct = mix(ct, t_sombra * 0.7, na_sombra * 0.85);
	ct *= 1.0 + (grao(pl, 1024.0, sem + 41) - 1.0) * 0.6;

	vec4 acc = vec4(0.0);
	acc = sobre(acc, t_cont, cobre(dt, px));
	acc = sobre(acc, ct, cobre(dt + 1.6 * traco, px));
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + esp, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : (dt < d ? t_cont : c_traco);
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

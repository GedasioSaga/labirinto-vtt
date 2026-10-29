// Campo (verde): PILOTO da fundação, não é a textura final.
// Base calma (manchas largas, poucas pinceladas longas, grão de papel); o capim e
// as florzinhas do protótipo do Fogo moram no atlas e o app espalha pelo mundo.
//
// Rodada 2 (28/10): a 50% a rodada 1 virava pimenta (um tufo pequeno e escuro
// por casa, espalhado por igual). Agora: menos detalhes, metade deles são
// touceiras (2 ou 3 tufos juntos), tufo um pouco maior e mais perto do tom do
// chão, e a base com 1 pincelada por casa em vez de 4.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	// Mesma receita nas 3 variantes; muda a semente das manchas e a temperatura.
	int s = sem + qual * 1000;
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.22, 0.78, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(GRAMA_SOMBRA, GRAMA_REALCE, t);
	c = mix(GRAMA, c, 0.55);
	if (qual == 1) {
		c = mix(c, GRAMA_QUENTE, 0.14);
	} else if (qual == 2) {
		c = mix(c, GRAMA_FRIA, 0.12) * 0.985;
	}
	// Uma pincelada larga por casa, todas na mesma direção geral.
	c *= 1.0 + 0.022 * pinceladas(p, P, px, s + 5, 64.0, -1.2, 0.5);
	c *= grao(p, P, s + 7);
	return c;
}

// Um tufo de capim com o pé em `pe0`: 3 a 5 risquinhos curvos, mais escuros no
// pé e claros na ponta, e uma sombra bem leve no pé. q em px do mundo.
vec4 tufo_em(vec4 acc, vec2 q, vec2 pe0, float alto, float px, uint h) {
	float inclina = (rk(h, 4) - 0.5) * 0.5;
	float ds = length((q - pe0 - vec2(1.8, 0.7)) / vec2(alto * 0.42, 2.4)) - 1.0;
	acc = sobre(acc, SOMBRA_VERDE, (1.0 - smoothstep(-0.7, 0.6, ds)) * 0.13);
	int n = 3 + int(rk(h, 5) * 2.99);
	for (int b = 0; b < 5; b++) {
		if (b >= n) {
			break;
		}
		float k = float(b) - float(n - 1) * 0.5;
		float lado = k / max(float(n - 1) * 0.5, 1.0);
		vec2 pe = pe0 + vec2(k * 1.9, 0.0);
		float altura = alto * (1.0 - 0.3 * abs(lado)) * (0.85 + 0.3 * rk(h, 10 + b));
		vec2 ponta = pe + vec2(lado * alto * 0.42 + inclina * alto, -altura);
		vec2 eixo = normalize(ponta - pe);
		vec2 meio = mix(pe, ponta, 0.5) + vec2(-eixo.y, eixo.x) * (lado * 1.3 + inclina * 1.5);
		float d = min(sd_traco(q, pe, meio, 1.35, 0.95), sd_traco(q, meio, ponta, 0.95, 0.4));
		float a = cobre(d, px);
		if (a <= 0.0) {
			continue;
		}
		float hh = clamp(dot(q - pe, ponta - pe) / dot(ponta - pe, ponta - pe), 0.0, 1.0);
		// Pé no tom do tufo, ponta quase no realce: de longe o tufo some no chão em vez de virar ponto escuro.
		vec3 cor = mix(mix(TUFO, GRAMA_SOMBRA, 0.45), mix(GRAMA_SOMBRA, GRAMA_REALCE, 0.75), hh);
		acc = sobre(acc, cor, a);
	}
	return acc;
}

// Detalhes 0 a 2: um tufo só. Detalhes 3 a 5: touceira, um tufo grande e 1 ou 2
// menores encostados (nunca dois iguais lado a lado: par simétrico vira carimbo).
vec4 capim(vec2 q, float px, int i) {
	uint h = hash_cel(vec2(float(i), 3.0), 911);
	vec4 acc = vec4(0.0);
	if (i < 3) {
		float alto = 12.0 + 6.0 * rk(h, 3);
		return tufo_em(acc, q, vec2((rk(h, 6) - 0.5) * 4.0, alto * 0.45), alto, px, h);
	}
	int n = (i == 4) ? 2 : 3;
	float giro = TAU * rk(h, 1);
	for (int t = 0; t < 3; t++) {
		if (t >= n) {
			break;
		}
		uint ht = hash_cel(vec2(float(i), float(t) + 20.0), 917);
		// O primeiro é o grande, no meio; os outros, menores e para os lados.
		float alto = (t == 0) ? 15.0 + 4.0 * rk(ht, 3) : 8.0 + 4.0 * rk(ht, 3);
		float raio = (t == 0) ? 2.0 : 9.0 + 3.0 * rk(ht, 7);
		float ang = giro + float(t) * 2.4;
		vec2 pe = vec2(cos(ang) * raio, sin(ang) * raio * 0.45) + vec2(0.0, alto * 0.4);
		acc = tufo_em(acc, q, pe, alto, px, ht);
	}
	return acc;
}

// Florzinha do protótipo do Fogo: 4 pétalas e miolo, com duas folhinhas.
vec4 florzinhas(vec2 q, float px, int i) {
	uint h = hash_cel(vec2(float(i), 7.0), 913);
	vec3 cor = i == 6 ? ROSA : (i == 7 ? AMARELO : BRANCO);
	vec3 miolo = i == 7 ? MIOLO * 1.05 : MIOLO;
	vec4 acc = vec4(0.0);
	int n = 1 + int(rk(h, 1) * 2.99);
	for (int f = 0; f < 2; f++) {
		vec2 fc = vec2((rk(h, 20 + f) - 0.5) * 9.0, 3.0 + rk(h, 22 + f) * 3.0);
		vec2 lq = girar(q - fc, -(rk(h, 24 + f) - 0.5) * 2.4 - 1.57);
		float d = sd_elipse(lq, vec2(4.2, 1.7));
		acc = sobre(acc, mix(FOLHA_ESCURA * 0.85, FOLHA_ESCURA * 1.08, smoothstep(-3.0, 3.0, lq.x)), cobre(d, px) * 0.9);
	}
	for (int k = 0; k < 3; k++) {
		if (k >= n) {
			break;
		}
		float ang = rk(h, 10 + k) * TAU;
		vec2 fc = (k == 0) ? vec2(0.0) : vec2(cos(ang), sin(ang)) * (6.0 + 3.0 * rk(h, 5 + k));
		vec2 lq = q - fc;
		float dsh = length(lq - vec2(1.3, 1.6)) - 5.0;
		acc = sobre(acc, SOMBRA_VERDE, (1.0 - smoothstep(-1.5, 1.5, dsh)) * 0.16);
		float giro = rk(h, 30 + k) * 1.5708;
		float dp = 1e9;
		for (int e = 0; e < 4; e++) {
			float a = giro + float(e) * 1.5708;
			dp = min(dp, length(lq - vec2(cos(a), sin(a)) * 3.0) - 2.3);
		}
		acc = sobre(acc, mix(cor * 0.9, cor, smoothstep(2.5, -1.0, lq.x + lq.y)), cobre(dp, px));
		acc = sobre(acc, miolo, cobre(length(lq) - 1.4, px));
	}
	return acc;
}

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	vec4 acc;
	if (i < 6) {
		acc = capim(q, px, i);
	} else if (i < 9) {
		acc = florzinhas(q, px, i);
	} else {
		// tufo com uma florzinha amarela no meio
		acc = capim(q, px, 1);
		vec4 f = florzinhas(q * 1.25 + vec2(0.0, 6.0), px * 1.25, 7);
		acc = vec4(f.rgb + acc.rgb * (1.0 - f.a), f.a + acc.a * (1.0 - f.a));
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

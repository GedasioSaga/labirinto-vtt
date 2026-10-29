// Campo (forma Amarelo): o mesmo campo da grama verde aprovada (28/10), seco e
// mais quente. Mesma calma, mesma escala de tufo, mesmo agrupamento em moitas e
// clareiras; muda o tom (palha contida, com um resto de verde nas manchas baixas)
// e o capim, que agora tem espigas.
//
// Diferente da piloto, de propósito:
// - a flor tem 5 pétalas redondas com contorno e miolo grande, para ler como
//   flor a 100% (a florzinha da piloto vira quadradinho de cor);
// - a base leva uma segunda camada de pinceladas, mais fina e na mesma direção,
//   para não ficar lisa a 300%.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Cores da paleta que não estão na base (client/src/texturas/meioTermo/paleta.ts).
const vec3 PALHA = vec3(0.839, 0.710, 0.416);    // #d6b56a palha
const vec3 MUSGO_MT = vec3(0.435, 0.490, 0.294); // #6f7d4b musgo

// Tons do campo seco, todos misturas da paleta (matiz ~46°, entre a palha e o
// líquen: mais para capim que para areia).
const vec3 SECO = vec3(0.757, 0.689, 0.471);        // palha 55% + líquen 25% + linho 20%, a 92% da luz, -10% de croma
const vec3 SECO_SOMBRA = vec3(0.672, 0.600, 0.402); // seco puxado para o ocre, -12% de luz
const vec3 SECO_REALCE = vec3(0.837, 0.770, 0.554); // realce_de(SECO)
const vec3 OLIVA = vec3(0.635, 0.630, 0.389);       // líquen 70% + musgo 30%: o verde que sobra
const vec3 PE_SECO = vec3(0.585, 0.522, 0.333);     // pé do tufo: ocre com um pouco de musgo
const vec3 ESPIGA = vec3(0.849, 0.745, 0.498);      // palha 80% + branco 20%

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	// Mesma receita da grama verde nas 3 variantes; muda a semente e a temperatura.
	int s = sem + qual * 1000;
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.22, 0.78, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(SECO_SOMBRA, SECO_REALCE, t);
	c = mix(SECO, c, 0.42);
	// O verde que resta no capim seco fica nas manchas baixas: é o que liga a
	// Amarela à Verde quando as duas estão lado a lado.
	c = mix(c, OLIVA, (1.0 - t) * 0.08);
	// Cada variante com a sua luz: uma mais dourada, outra um pouco mais funda.
	// A diferença vem do valor, não do matiz: matiz diferente a 50% vira mancha de mofo.
	if (qual == 1) {
		c = mix(c, PALHA, 0.18) * 1.01;
	} else if (qual == 2) {
		c = mix(c, OLIVA, 0.08) * 0.975;
	}
	// Uma pincelada larga por casa (a da Verde) e outra camada mais fina na mesma
	// direção, bem fraca: a 50% some, a 300% tira o liso.
	c *= 1.0 + 0.022 * pinceladas(p, P, px, s + 5, 64.0, -1.2, 0.5);
	c *= 1.0 + 0.02 * pinceladas(p, P, px, s + 6, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 7);
	return c;
}

// Espiga: um fuso fino e dourado na ponta de uma haste, ao longo dela, com um
// contorno leve da própria cor escurecida. ponta = onde a haste acaba.
vec4 espiga_em(vec4 acc, vec2 q, vec2 ponta, vec2 eixo, float comp, vec3 cor, float px) {
	vec2 a = ponta - eixo * 0.5;
	vec2 m = ponta + eixo * comp * 0.4;
	vec2 b = ponta + eixo * comp;
	float d = min(sd_traco(q, a, m, 0.45, 1.25), sd_traco(q, m, b, 1.25, 0.3));
	acc = sobre(acc, contorno_de(cor), cobre(d - 0.6, px) * 0.4);
	vec2 normal = vec2(-eixo.y, eixo.x);
	// Luz de cima à esquerda: o lado do fuso virado para ela é mais claro.
	float luz = smoothstep(-1.2, 1.2, dot(q - m, normal) * sign(dot(normal, LUZ) + 1e-4));
	acc = sobre(acc, mix(sombra_de(cor), realce_de(cor), luz * 0.8), cobre(d, px));
	return acc;
}

// Haste com espiga: um talo fino que passa da altura do tufo, faz uma curva
// leve e termina na espiga, pendendo para o lado do vento (a direita).
vec4 haste_em(vec4 acc, vec2 q, vec2 pe, float alto, float lado, float inclina, float comp, vec3 cor, float px) {
	vec2 topo = pe + vec2(lado * 2.5 + inclina * alto * 1.4 + 1.5, -alto * 1.25);
	vec2 eixo0 = normalize(topo - pe);
	vec2 meio = mix(pe, topo, 0.55) + vec2(-eixo0.y, eixo0.x) * 1.2;
	float d = min(sd_traco(q, pe, meio, 0.7, 0.55), sd_traco(q, meio, topo, 0.55, 0.45));
	acc = sobre(acc, mix(PE_SECO, SECO_REALCE, 0.55), cobre(d, px));
	vec2 dir = normalize(normalize(topo - meio) + vec2(0.35, 0.15));
	return espiga_em(acc, q, topo, dir, comp, cor, px);
}

// Um tufo de capim seco com o pé em `pe0`: 3 a 5 lâminas curvas, perto do tom
// do chão no pé e claras na ponta, todas pendendo um pouco para o mesmo lado.
// `espigas` = quantas hastes com espiga saem do meio do tufo (0 a 2).
vec4 tufo_em(vec4 acc, vec2 q, vec2 pe0, float alto, float px, uint h, int espigas) {
	float inclina = 0.1 + (rk(h, 4) - 0.5) * 0.4;
	float ds = length((q - pe0 - vec2(1.8, 0.7)) / vec2(alto * 0.42, 2.4)) - 1.0;
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-0.7, 0.6, ds)) * 0.08);
	int n = 3 + int(rk(h, 5) * 2.99);
	for (int b = 0; b < 5; b++) {
		if (b >= n) {
			break;
		}
		float k = float(b) - float(n - 1) * 0.5;
		float lado = k / max(float(n - 1) * 0.5, 1.0);
		vec2 pe = pe0 + vec2(k * 1.8, 0.0);
		float altura = alto * (1.0 - 0.28 * abs(lado)) * (0.85 + 0.3 * rk(h, 10 + b));
		vec2 ponta = pe + vec2(lado * alto * 0.45 + inclina * alto, -altura);
		vec2 eixo = normalize(ponta - pe);
		vec2 meio = mix(pe, ponta, 0.5) + vec2(-eixo.y, eixo.x) * (lado * 1.3 + inclina * 1.5);
		float d = min(sd_traco(q, pe, meio, 1.3, 0.9), sd_traco(q, meio, ponta, 0.9, 0.35));
		float a = cobre(d, px);
		if (a <= 0.0) {
			continue;
		}
		float hh = clamp(dot(q - pe, ponta - pe) / dot(ponta - pe, ponta - pe), 0.0, 1.0);
		// Cada lâmina com o seu tom de palha; o pé perto do chão, a ponta no realce:
		// de longe o tufo some no chão em vez de virar tracinho escuro.
		float v = rk(h, 20 + b);
		vec3 ponta_cor = mix(mix(SECO_SOMBRA, SECO_REALCE, 0.85), PALHA, 0.25 * v);
		// O pé fica 19% abaixo do chão, o mesmo contraste do tufo da Verde.
		vec3 cor = mix(mix(PE_SECO, SECO_SOMBRA, 0.45), ponta_cor, hh);
		acc = sobre(acc, cor, a);
	}
	for (int e = 0; e < 2; e++) {
		if (e >= espigas) {
			break;
		}
		float lado = (e == 0) ? -0.2 : 0.6;
		acc = haste_em(acc, q, pe0 + vec2(lado * 2.0, 0.0), alto * (e == 0 ? 1.0 : 0.85), lado, inclina, 6.0 + 1.5 * rk(h, 30 + e), ESPIGA, px);
	}
	return acc;
}

// Detalhes 0 a 2: um tufo só. 3 a 5: touceira, um tufo grande e 1 ou 2 menores
// para os lados (nunca dois iguais lado a lado). `espigas` vale para o grande.
vec4 capim(vec2 q, float px, int i, int espigas) {
	uint h = hash_cel(vec2(float(i), 3.0), 931);
	vec4 acc = vec4(0.0);
	if (i < 3) {
		float alto = 12.0 + 6.0 * rk(h, 3);
		return tufo_em(acc, q, vec2((rk(h, 6) - 0.5) * 4.0, alto * 0.45 + 2.0), alto, px, h, espigas);
	}
	int n = (i == 4) ? 2 : 3;
	float giro = TAU * rk(h, 1);
	for (int t = 0; t < 3; t++) {
		if (t >= n) {
			break;
		}
		uint ht = hash_cel(vec2(float(i), float(t) + 20.0), 937);
		float alto = (t == 0) ? 15.0 + 4.0 * rk(ht, 3) : 8.0 + 4.0 * rk(ht, 3);
		float raio = (t == 0) ? 2.0 : 9.0 + 3.0 * rk(ht, 7);
		float ang = giro + float(t) * 2.4;
		vec2 pe = vec2(cos(ang) * raio, sin(ang) * raio * 0.45) + vec2(0.0, alto * 0.4 + 2.0);
		acc = tufo_em(acc, q, pe, alto, px, ht, (t == 0) ? espigas : 0);
	}
	return acc;
}

// Flor do campo seco: 5 pétalas redondas, contorno da própria cor e miolo
// grande. 12 px de lado: a 100% lê como flor, não como ponto.
vec4 flor_em(vec4 acc, vec2 q, vec2 c0, float r, float giro, vec3 cor, float px) {
	vec2 lq = q - c0;
	float dsh = length(lq - vec2(1.3, 1.6)) - r;
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-1.5, 1.5, dsh)) * 0.14);
	float dp = 1e9;
	for (int e = 0; e < 5; e++) {
		float a = giro + float(e) * TAU / 5.0;
		dp = min(dp, length(lq - vec2(cos(a), sin(a)) * r * 0.58) - r * 0.4);
	}
	// Contorno puxado para o chão: define as pétalas a 100% sem virar anel escuro a 50%.
	acc = sobre(acc, mix(contorno_de(cor), SECO_SOMBRA, 0.35), cobre(dp - 0.8, px) * 0.55);
	acc = sobre(acc, mix(cor * 0.9, cor, smoothstep(r, -r, lq.x + lq.y)), cobre(dp, px));
	float dm = length(lq) - r * 0.3;
	acc = sobre(acc, contorno_de(MIOLO), cobre(dm - 0.6, px) * 0.8);
	acc = sobre(acc, mix(MIOLO, realce_de(MIOLO), smoothstep(1.0, -1.0, lq.x + lq.y)), cobre(dm, px));
	return acc;
}

// Folha de flor, seca: elipse comprida em musgo e palha.
vec4 folha_em(vec4 acc, vec2 q, vec2 c0, float ang, float px) {
	vec2 lq = girar(q - c0, ang);
	float d = sd_elipse(lq, vec2(4.6, 1.7));
	vec3 base_cor = mix(MUSGO_MT, PE_SECO, 0.45);
	acc = sobre(acc, mix(base_cor * 0.9, base_cor * 1.08, smoothstep(-3.0, 3.0, lq.x)), cobre(d, px) * 0.9);
	return acc;
}

// Margaridas brancas: 1 ou 2 flores com duas folhas.
vec4 margaridas(vec2 q, float px, int i) {
	uint h = hash_cel(vec2(float(i), 7.0), 941);
	vec4 acc = vec4(0.0);
	for (int f = 0; f < 2; f++) {
		vec2 fc = vec2((rk(h, 20 + f) - 0.5) * 10.0, 4.0 + rk(h, 22 + f) * 3.0);
		acc = folha_em(acc, q, fc, -(rk(h, 24 + f) - 0.5) * 2.4 - 1.57, px);
	}
	int n = 1 + int(rk(h, 1) * 1.99);
	for (int k = 0; k < 2; k++) {
		if (k >= n) {
			break;
		}
		float ang = rk(h, 10 + k) * TAU;
		vec2 fc = (k == 0) ? vec2(0.0) : vec2(cos(ang), sin(ang) * 0.7) * 10.0;
		float r = (k == 0) ? 6.2 : 5.0;
		acc = flor_em(acc, q, fc, r, rk(h, 30 + k) * TAU, BRANCO, px);
	}
	return acc;
}

// Lavanda do campo: um tufo baixo com 3 espigas violeta.
vec4 lavanda(vec2 q, float px, int i) {
	uint h = hash_cel(vec2(float(i), 9.0), 947);
	vec4 acc = tufo_em(vec4(0.0), q, vec2(0.0, 9.0), 10.0, px, h, 0);
	vec3 cor = mix(VIOLETA, SECO, 0.25);
	for (int k = 0; k < 3; k++) {
		float lado = float(k) - 1.0;
		vec2 pe = vec2(lado * 2.0, 8.0);
		float altura = 13.0 + 4.0 * rk(h, 40 + k) - 3.0 * abs(lado);
		vec2 ponta = pe + vec2(lado * 4.5 + 1.5, -altura);
		vec2 eixo = normalize(ponta - pe);
		float d = sd_traco(q, pe, ponta, 0.8, 0.5);
		acc = sobre(acc, mix(PE_SECO, MUSGO_MT, 0.35), cobre(d, px));
		acc = espiga_em(acc, q, ponta, eixo, 7.0 + 2.0 * rk(h, 50 + k), cor, px);
	}
	return acc;
}

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	vec4 acc;
	if (i < 6) {
		acc = capim(q, px, i, 0);
	} else if (i == 6) {
		acc = capim(q, px, 1, 1);
	} else if (i == 7) {
		acc = capim(q, px, 2, 2);
	} else if (i == 8) {
		acc = capim(q, px, 5, 2);
	} else if (i == 9) {
		acc = margaridas(q, px, i);
	} else if (i == 10) {
		acc = lavanda(q, px, i);
	} else if (i == 11) {
		// touceira pequena com uma margarida no meio
		acc = capim(q, px, 4, 0);
		acc = flor_em(acc, q, vec2(1.0, 2.0), 5.4, 0.7, BRANCO, px);
	} else {
		// células do atlas que o config não usa ficam vazias
		return vec4(SECO, 0.0);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

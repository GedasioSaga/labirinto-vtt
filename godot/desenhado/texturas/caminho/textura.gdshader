// Caminho (a ferramenta Caminho): a trilha de terra pisada que o mestre risca por cima
// do chão, de meia a 4 casas de largura. Lote 1 da onda 1. O app hoje pinta o traço de
// uma cor chapada (#8a6a45); aqui ele ganha a mesma família de tons da `terra`, um pouco
// mais clara, mais lisa e mais empoeirada (terra batida: onde se pisa o chão clareia, a
// mesma regra das manchas da `terra`), para o caminho se ler também por cima da terra.
//
// A faixa é estreita e a borda é o próprio traço do app (recorte duro, suavizado):
// a textura não sabe onde fica a borda. Por isso:
// - a base é isótropa (nenhum sulco ou rastro com direção: o caminho pode ir para
//   qualquer lado) e calma, com um relevo baixo de chão batido para o close a 300%;
// - o atlas tem poucos marcos e pequenos, para quase nenhum ser cortado pela borda;
// - o capim que nasce na trilha está no tom da grama: cortado pela borda, some na
//   grama em vez de deixar meio desenho.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta (client/src/texturas/meioTermo/paleta.ts). TERRA (#dda56c), TERRA_SOMBRA
// (#c78d58), SEIXO (#c4915f), PEDRA (#c3c0b2), TUFO e GRAMA_* vêm da base.
const vec3 TERRA_REALCE = vec3(0.906, 0.722, 0.510); // #e7b882 (terra.realce)
const vec3 BARRANCO = vec3(0.667, 0.455, 0.361);     // #aa745c
const vec3 PALHA = vec3(0.839, 0.710, 0.416);        // #d6b56a
// A cor do caminho: o realce da terra com 15% da praça (poeira: menos laranja que a terra
// solta) e 30% da própria terra. #e3b581
const vec3 CAMINHO = vec3(0.890, 0.709, 0.506);

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (4 casas), entre a sombra e o realce do próprio caminho.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(CAMINHO, mix(sombra_de(CAMINHO), realce_de(CAMINHO), t), 0.32);
	// 2. Onde mais se pisa o chão fica liso e claro; onde menos, um pouco mais escuro.
	//    Manchas de 2 a 3 casas torcidas, de transição longa: com borda curta, a 50% o
	//    chão virava camuflagem de manchas do mesmo tamanho.
	vec2 w = vec2(rz(p, 128.0, P, s + 4), rz(p, 128.0, P, s + 14)) - 0.5;
	float n_b = rz(p + 28.0 * w, 128.0, P, s + 3) * 0.7 + fz(p + 28.0 * w, 64.0, P, s + 13, 2) * 0.3;
	float batido = smoothstep(0.5, 0.85, n_b);
	float solto = smoothstep(0.5, 0.15, n_b);
	c = mix(c, mix(CAMINHO, TERRA_REALCE, 0.55), batido * 0.32);
	c = mix(c, mix(sombra_de(CAMINHO), BARRANCO, 0.12), solto * 0.2);
	// 3. As variantes diferem na temperatura, de leve.
	if (qual == 1) {
		c = mix(c, mix(CAMINHO, BARRANCO, 0.35), 0.1) * 0.99;
	} else if (qual == 2) {
		c = mix(c, mix(TERRA_REALCE, PALHA, 0.35), 0.1) * 1.008;
	}
	// 4. Relevo de chão batido (meia casa e 1/4 de casa) com luz de cima à esquerda:
	//    mais baixo que o da terra, porque chão pisado é mais liso.
	float hA = smoothstep(0.3, 0.7, fz(p - LUZ * 2.0, 32.0, P, s + 8, 2));
	float hB = smoothstep(0.3, 0.7, fz(p + LUZ * 2.0, 32.0, P, s + 8, 2));
	float fA = smoothstep(0.3, 0.7, rz(p - LUZ * 1.2, 16.0, P, s + 9));
	float fB = smoothstep(0.3, 0.7, rz(p + LUZ * 1.2, 16.0, P, s + 9));
	// 4b. Grão de terra batida (1/8 de casa), também com luz: no close a 300% o chão tem
	//    superfície; a 50% a média é zero e ele some na cor.
	float gA = smoothstep(0.25, 0.75, rz(p - LUZ * 0.9, 8.0, P, s + 19));
	float gB = smoothstep(0.25, 0.75, rz(p + LUZ * 0.9, 8.0, P, s + 19));
	c *= 1.0 + 0.08 * (hA - hB) + 0.055 * (fA - fB) + 0.035 * (gA - gB);
	// 4c. Poeira: um véu bem fino e macio.
	c *= 1.0 + 0.024 * (rz(p, 8.0, P, s + 18) - 0.5);
	// 5. Pinceladas largas e poucas, na mesma direção geral da grama.
	c *= 1.0 + 0.025 * pinceladas(p, P, px, s + 10, 64.0, -1.2, 0.5);
	c *= 1.0 + 0.018 * pinceladas(p, P, px, s + 12, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 16);
	return c;
}

// ---------- atlas ----------

// Distância (px do mundo, negativa dentro) a uma forma torta: um círculo achatado e
// girado, com 3 harmônicos baixos na borda (seixo de rio, nunca um ovo liso).
float dist_torta(vec2 q, vec2 c, float r, float achata, float ang, float torto, uint h) {
	vec2 lq = girar(q - c, -ang);
	lq.y *= achata;
	float th = atan(lq.y, lq.x);
	float f = 1.0 + torto * (0.11 * cos(th + TAU * rk(h, 0)) + 0.07 * cos(2.0 * th + TAU * rk(h, 1))
			+ 0.04 * cos(3.0 * th + TAU * rk(h, 2)));
	return (length(lq) - r * f) / sqrt(achata);
}

// Um seixo assentado na trilha: sombra macia para baixo e para a direita, contorno da
// própria cor escurecida (mais fino do lado da luz), corpo da sombra ao realce.
vec4 seixo_em(vec4 acc, vec2 q, vec2 c, float r, float achata, float ang, vec3 cor, float px, uint h) {
	float ds = dist_torta(q - vec2(1.5, 1.8), c, r * 1.04, achata, ang, 1.0, h);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-1.5, 2.2, ds)) * 0.14);
	float d = dist_torta(q, c, r, achata, ang, 1.0, h);
	acc = sobre(acc, contorno_de(cor), cobre(d, px) * 0.55);
	float luz = dot((q - c) / r, LUZ);
	vec3 corpo = mix(sombra_de(cor), realce_de(cor), smoothstep(-0.8, 0.9, luz));
	float dentro = d + mix(1.9, 0.9, smoothstep(-0.7, 0.7, luz));
	acc = sobre(acc, corpo, cobre(dentro, px));
	return acc;
}

// A cor de um seixo: o seixo da paleta puxado para o chão do caminho, um pouco mais claro
// ou mais escuro. Perto do chão: a 50% o seixo some em vez de virar pingo escuro.
vec3 cor_de_seixo(uint h) {
	vec3 c = mix(mix(SEIXO, CAMINHO, 0.45), TERRA_REALCE, 0.35 * rk(h, 8));
	if (rk(h, 9) > 0.9) {
		c = mix(c, PEDRA, 0.2);
	}
	return c;
}

// Mancha de 1 casa sem contorno (umidade, mais escura; poeira, mais clara).
vec4 mancha_em(vec4 acc, vec2 q, vec2 c, float r, vec3 cor, float alfa, float ang, uint h) {
	float d = dist_torta(q, c, r, 1.3, ang, 1.3, h);
	float a = 1.0 - smoothstep(-r * 0.6, 0.0, d);
	acc = sobre(acc, cor, a * a * (3.0 - 2.0 * a) * alfa);
	return acc;
}

// Capim que nasce na trilha: 2 a 4 risquinhos curvos, sem contorno, no tom da grama
// puxado para a palha (capim pisado): fica no chão em vez de virar pingo verde.
vec4 tufo_em(vec4 acc, vec2 q, vec2 pe0, float alto, float px, uint h) {
	float inclina = (rk(h, 4) - 0.5) * 0.5;
	float ds = length((q - pe0 - vec2(1.8, 0.7)) / vec2(alto * 0.42, 2.4)) - 1.0;
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-0.7, 0.6, ds)) * 0.12);
	int n = 2 + int(rk(h, 5) * 2.99);
	for (int b = 0; b < 4; b++) {
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
		float d = min(sd_traco(q, pe, meio, 1.3, 0.9), sd_traco(q, meio, ponta, 0.9, 0.4));
		float a = cobre(d, px);
		if (a <= 0.0) {
			continue;
		}
		float hh = clamp(dot(q - pe, ponta - pe) / dot(ponta - pe, ponta - pe), 0.0, 1.0);
		vec3 cor = mix(mix(TUFO, GRAMA_SOMBRA, 0.4), mix(GRAMA_SOMBRA, GRAMA_REALCE, 0.7), hh);
		cor = mix(cor, PALHA, 0.28);
		acc = sobre(acc, cor, a);
	}
	return acc;
}

vec2 polar(float a, float r) {
	return vec2(cos(a), sin(a) * 0.75) * r;
}

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 5.0), 6151);
	uint h2 = hash_cel(vec2(float(i), 6.0), 6151);
	vec4 acc = vec4(0.0);
	float ang = (rk(h, 20) - 0.5) * 2.2;
	float a2 = TAU * rk(h, 23);
	if (i <= 2) {
		// seixo sozinho
		float r = 6.8 + 1.6 * rk(h, 21);
		acc = seixo_em(acc, q, vec2(0.0), r, 1.2 + 0.35 * rk(h, 22), ang, cor_de_seixo(h), px, h);
	} else if (i == 3) {
		// um seixo e um menor, com folga (nunca dois iguais)
		float r = 7.0 + 1.0 * rk(h, 21);
		float r2 = 5.6 + 0.6 * rk(h2, 21);
		acc = seixo_em(acc, q, polar(a2, r + r2 + 4.5), r2, 1.2, ang + 1.0, cor_de_seixo(h2), px, h2);
		acc = seixo_em(acc, q, vec2(0.0), r, 1.25, ang, cor_de_seixo(h), px, h);
	} else if (i <= 5) {
		// capim de trilha, um tufo
		acc = tufo_em(acc, q, vec2(0.0, 6.0), 12.0 + 4.0 * rk(h, 21), px, h);
	} else if (i == 6) {
		// touceira: um tufo e um menor ao lado
		acc = tufo_em(acc, q, vec2(polar(a2, 10.0).x, 7.0), 9.0 + 2.0 * rk(h2, 21), px, h2);
		acc = tufo_em(acc, q, vec2(0.0, 6.0), 15.0 + 3.0 * rk(h, 21), px, h);
	} else if (i <= 8) {
		// mancha de umidade
		acc = mancha_em(acc, q, vec2(0.0), 17.0 + 3.0 * rk(h, 21), mix(TERRA_SOMBRA, BARRANCO, 0.3), 0.18, ang, h);
	} else if (i == 9) {
		// poeira clara
		acc = mancha_em(acc, q, vec2(0.0), 18.0 + 2.0 * rk(h, 21), mix(TERRA_REALCE, PALHA, 0.15), 0.32, ang, h);
	} else if (i == 10) {
		// pedra chata meio enterrada
		vec3 cor = mix(mix(SEIXO, PEDRA, 0.35), TERRA_REALCE, 0.15);
		acc = mancha_em(acc, q, vec2(1.0, 1.5), 15.0, mix(TERRA_SOMBRA, BARRANCO, 0.25), 0.16, ang * 0.5, h2);
		acc = seixo_em(acc, q, vec2(0.0), 9.0, 1.7, ang * 0.5, cor, px, h);
	} else {
		// seixo na mancha de umidade
		acc = mancha_em(acc, q, vec2(2.0, 2.0), 17.0, mix(TERRA_SOMBRA, BARRANCO, 0.3), 0.18, ang, h2);
		acc = seixo_em(acc, q, polar(a2, 2.0), 6.8, 1.3, ang, cor_de_seixo(h), px, h);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

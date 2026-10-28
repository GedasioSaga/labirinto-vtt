// Serra (pedra): chão de terreno de rocha visto de cima. Lote 3 da onda 1.
//
// Base: o lajedo entre as lajes, a mesma rocha um degrau mais funda, num cinza quente
// entre o granito e a pedra da paleta: manchas largas, temperatura bem larga (mais linho
// ou mais granito), zonas de rocha lisa no meio do cascalho fino, ondulações largas e
// fracas com a luz de cima à esquerda (para o close a 300% não ficar liso) e poucas
// pinceladas na mesma direção da grama e da terra. Nenhuma linha na base: as curvas de
// nível de um ruído viram rede de rachadura fina.
//
// Atlas (4 células de 2 casas, espalhadas com passoCasas 3,2, afastarCasas 3,2, grupos e
// espelho; as lajes têm de 1,5 a 3 casas e nenhuma cai em cima da outra):
//   0  laje grande: polígono de 4 a 6 lados tangente a uma elipse, quinas pouco
//      arredondadas, borda com baías largas, luz em cima à esquerda, face de sombra
//      (a espessura da laje) embaixo à direita e um líquen leve na beira da sombra
//   1  laje comprida, mais quente (arenito)
//   2  laje partida de lado a lado por uma fenda larga e torta: a única fenda, rara
//      (peso 0,1 de 2,7, menos de 4% das lajes)
//   3  laje menor e mais gasta
//
// O que as rodadas de 28/10 ensinaram (20, todas na folha):
// - Células de 1 casa (lajes de 0,7 a 1 casa) viravam seixos redondos espalhados por
//   igual a 25% (cascalho); a fenda numa laje pequena virava grão de café; a fenda
//   solta no lajedo virava gravetinho; a lombada de meia casa da base virava reboco.
// - Laje com pedrinha ao lado era sempre a mesma dupla: carimbo a 25%.
// - Com passo 2,6 e lajes de até 2,7 casas, uma laje caía em cima da outra pela beira;
//   com passo 3,2, na simulação do espalhamento (hash e ruído do app, semente 43),
//   0,4% das lajes têm vizinha a menos de 0,9 da soma dos raios médios.
// - Líquen redondo no meio virava um "olho" amarelo repetido; a fenda de trechos retos
//   virava raio desenhado; relevo de ±6% na base virava reboco de parede; cinza neutro
//   ficava frio e morto ao lado da terra e da grama aprovadas.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta do Meio-Termo (client/src/texturas/meioTermo/paleta.ts) que não está na base.
const vec3 GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b
const vec3 ARDOSIA = vec3(0.373, 0.416, 0.400); // #5f6a66
// O lajedo entre as lajes: a mesma rocha, um degrau mais fundo que elas. GRANITO 38% para
// PEDRA (#c3c0b2), depois 12% para LINHO (#d4c7a5) e 4% para TERRA (#dda56c): o cinza
// neutro (rodada 16) ficava frio e morto ao lado da terra e da grama aprovadas.
const vec3 ROCHA = vec3(0.698, 0.666, 0.593);
const vec3 ROCHA_LUZ = vec3(0.721, 0.696, 0.630);    // ROCHA 35% para PEDRA
const vec3 ROCHA_SOMBRA = vec3(0.622, 0.602, 0.551); // ROCHA 70% para GRANITO, a 98,5%
// A sombra que a laje joga no chão (px do mundo antes da escala).
const vec2 SOMBRA_DESLOCA = vec2(3.0, 3.4);

// ---------- base: o lajedo ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (2 a 4 casas), entre a sombra e a luz da rocha, a meio caminho.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = rz(p, 128.0, P, s + 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.7 + n_m * 0.3);
	vec3 c = mix(ROCHA, mix(ROCHA_SOMBRA, ROCHA_LUZ, t), 0.5);
	// 2. Temperatura bem larga: rocha mais seca e quente (linho) ou mais funda e fria
	//    (granito com um nada de ardósia).
	float n_t = rz(p + vec2(97.0, 31.0), 256.0, P, s + 3);
	c = mix(c, mix(ROCHA, LINHO, 0.35), smoothstep(0.56, 0.86, n_t) * 0.2);
	c = mix(c, mix(GRANITO, ARDOSIA, 0.12), smoothstep(0.44, 0.14, n_t) * 0.14);
	// As variantes diferem um nada na luz e na temperatura (menos de 1%).
	if (qual == 1) {
		c = mix(c, mix(ROCHA, LINHO, 0.4), 0.06) * 0.994;
	} else if (qual == 2) {
		c = mix(c, GRANITO, 0.05) * 1.005;
	}
	// 3. Rocha lisa e cascalho: zonas largas (2 a 3 casas) de lajedo raso, um pouco mais
	//    claro e liso, entre o cascalho, de borda bem macia (sem linha). É o que faz o chão
	//    entre as lajes ler como serra, e não como reboco.
	float z = smoothstep(0.42, 0.7, rz(p + vec2(211.0, 57.0), 128.0, P, s + 20));
	c = mix(c, ROCHA_LUZ, z * 0.4);
	// 4. Relevo, luz de cima à esquerda: ondulações largas da rocha (2 a 4 casas), fracas
	//    (com ±6%, na rodada 13, o chão virou reboco de parede), e um cascalho fino
	//    de 1/8 de casa, mais fraco ainda e quase sumido no lajedo liso (a 25% some no
	//    grão; a 300% dá a aspereza). Sem smoothstep: degrau de ruído vira linha. A
	//    lombada de meia e de 1 casa (rodadas 1 a 3) virava reboco a 25%.
	float hA = fz(p - LUZ * 4.0, 128.0, P, s + 4, 2);
	float hB = fz(p + LUZ * 4.0, 128.0, P, s + 4, 2);
	float gA = rz(p - LUZ * 1.2, 8.0, P, s + 5);
	float gB = rz(p + LUZ * 1.2, 8.0, P, s + 5);
	c *= 1.0 + clamp(1.0 * (hA - hB), -0.03, 0.03) + clamp(0.16 * (gA - gB), -0.018, 0.018) * (1.0 - 0.7 * z);
	// 5. Pinceladas largas e poucas, na mesma direção geral da grama e da terra.
	c *= 1.0 + 0.022 * pinceladas(p, P, px, s + 10, 64.0, -1.2, 0.5);
	c *= 1.0 + 0.016 * pinceladas(p, P, px, s + 12, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 16);
	return c;
}

// ---------- atlas: as lajes ----------

// Máximo suave: a quina do polígono sai arredondada, com raio perto de k.
float smax_k(float a, float b, float k) {
	float h = max(k - abs(a - b), 0.0) / k;
	return max(a, b) + h * h * k * 0.25;
}

// A forma de uma laje: (A, B) = semieixos da elipse em px, z = ângulo, w = raio da quina.
vec4 forma_de_laje(uint h, float amin, float amax, float asp_min, float asp_max) {
	float A = mix(amin, amax, rk(h, 3));
	float asp = mix(asp_min, asp_max, rk(h, 4));
	return vec4(A, A / asp, TAU * rk(h, 5), mix(2.5, 4.5, rk(h, 6)));
}

// A laje no espaço dela (lq já girado): um polígono convexo de 4 a 6 lados tangentes à
// elipse, dentro de uma elipse um pouco maior (que corta a ponta das quinas compridas).
// Com 5 a 7 lados e quina de 3,5 a 6,5 px (rodadas 2 a 4) a laje saía redonda e lia
// como seixo, ou biscoito, a 25%.
float sd_laje_local(vec2 lq, vec4 f, uint h) {
	int n = 4 + int(rk(h, 1) * 2.99);
	float rot = TAU * rk(h, 2);
	float d = sd_elipse(lq, f.xy * 1.15);
	for (int k = 0; k < 6; k++) {
		if (k >= n) {
			break;
		}
		float phi = rot + TAU * (float(k) + 0.5 * (rk(h, 10 + k) - 0.5)) / float(n);
		vec2 nn = vec2(cos(phi), sin(phi));
		float o = length(f.xy * nn) * (0.93 + 0.07 * rk(h, 20 + k));
		d = smax_k(d, dot(lq, nn) - o, f.w);
	}
	return d;
}

// A borda torta da laje: baías e pontas largas (1 casa, puxadas para dentro, para a
// laje não passar da célula), um ondulado menor e a mão do traço. Com a borda quase
// reta das rodadas 2 a 10 a laje era um polígono limpo e lia como pedra solta a 25%;
// com as baías ela lê como rocha exposta no lajedo.
float onda_da_laje(vec2 q0, int sl, float esc) {
	return ((rz(q0, 64.0, 256.0, sl + 2) - 0.45) * 13.0 + (rz(q0, 32.0, 256.0, sl) - 0.5) * 4.5
			+ (rz(q0, 16.0, 256.0, sl + 1) - 0.5) * 1.5) * esc;
}

// A fenda: uma curva torta que atravessa a laje pelo lado curto (duas ondas desiguais
// somadas, sem quina), larga no meio, mais fina nas beiras e com a largura variando um
// pouco ao longo. O zigue-zague de trechos retos da rodada 5 lia como um raio desenhado.
float sd_fenda_local(vec2 lq, vec4 f, uint h, float w) {
	float b = 1.5708 + (rk(h, 40) - 0.5) * 0.8;
	vec2 dir = vec2(cos(b), sin(b));
	vec2 nor = vec2(-dir.y, dir.x);
	vec2 r = lq - vec2((rk(h, 43) - 0.5) * 0.4 * f.x, 0.0);
	float t = dot(r, dir);
	float s = dot(r, nor);
	float L = 1.25 * f.y + 6.0;
	float u = t / L;
	float k1 = 1.3 + 0.5 * rk(h, 41);
	float f1 = TAU * rk(h, 42);
	float f2 = TAU * rk(h, 44);
	float a1 = 0.15 * f.y;
	float a2 = 0.045 * f.y;
	float desvio = a1 * sin(k1 * PI * u + f1) + a2 * sin(3.7 * PI * u + f2);
	float inclina = (a1 * k1 * cos(k1 * PI * u + f1) + a2 * 3.7 * cos(3.7 * PI * u + f2)) * PI / L;
	float larg = w * (1.0 - 0.4 * u * u) * (0.82 + 0.36 * rz(vec2(t + 128.0, 40.0), 16.0, 256.0, 77));
	return max(abs(s - desvio) / sqrt(1.0 + inclina * inclina) - larg, abs(t) - L);
}

// A peça inteira (laje menos a fenda), no espaço da célula, com o centro da laje em 0.
float sd_peca(vec2 lp, vec4 f, uint h, float w) {
	vec2 lq = girar(lp, -f.z);
	float d = sd_laje_local(lq, f, h);
	if (w > 0.0) {
		d = max(d, -sd_fenda_local(lq, f, h, w));
	}
	return d;
}

// A cor de uma laje: perto do lajedo (é a mesma rocha), uma mais clara, uma mais quente
// (arenito, para o linho), uma mais funda que o lajedo (para o granito). Quem desenha a
// laje é o relevo da beira, não um recorte claro: com a laje bem mais clara que o chão
// (rodadas 2 a 9) a 25% ela virava pedra solta, ou bolinha.
vec3 cor_de_laje(int i) {
	vec3 c = mix(mix(ROCHA_LUZ, PEDRA, 0.6), LINHO, 0.08);
	if (i == 1) {
		c = mix(mix(ROCHA_LUZ, PEDRA, 0.5), LINHO, 0.2);
	} else if (i == 2) {
		c = mix(ROCHA_LUZ, PEDRA, 0.3);
	} else if (i == 3) {
		c = mix(ROCHA_LUZ, PEDRA, 0.45) * 0.99;
	}
	return c;
}

// Uma laje em c: sombra macia no chão, contorno da própria cor escurecida (mais grosso do
// lado da sombra), corpo calmo com a luz de cima à esquerda, uma beira clara do lado da
// luz e a face de sombra (a espessura da laje) embaixo à direita. Com fenda (w > 0), o vão
// fica escuro e as duas beiras dele ganham a mesma luz e a mesma face.
// alto = quanto ela sobe do chão (1 = laje; 0,6 = pedra solta, mais baixa).
vec4 laje_em(vec4 acc, vec2 q, vec2 c, vec4 f, uint h, int sl, float w, vec3 cor, float alto, bool liquen, float px) {
	vec2 lp = q - c;
	vec2 q0 = lp + vec2(64.0);
	float esc = clamp(f.x / 40.0, 0.3, 1.0);
	float onda = onda_da_laje(q0, sl, esc);
	float d = sd_peca(lp, f, h, w) + onda;
	// A normal sai da borda torta de verdade (com a onda), para a luz seguir as baías.
	float e = 0.8;
	vec2 ex = vec2(e, 0.0);
	vec2 ey = vec2(0.0, e);
	vec2 g = vec2(sd_peca(lp + ex, f, h, w) + onda_da_laje(q0 + ex, sl, esc) - sd_peca(lp - ex, f, h, w) - onda_da_laje(q0 - ex, sl, esc),
			sd_peca(lp + ey, f, h, w) + onda_da_laje(q0 + ey, sl, esc) - sd_peca(lp - ey, f, h, w) - onda_da_laje(q0 - ey, sl, esc));
	vec2 nrm = g / max(length(g), 1e-4);
	float lit = dot(nrm, LUZ);

	// 1. A sombra no chão, para baixo e para a direita, borda esfumada.
	vec2 sd_ = SOMBRA_DESLOCA * alto;
	float ds = sd_peca(lp - sd_, f, h, w) + onda_da_laje(q0 - sd_, sl, esc);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-2.5, 3.0, ds)) * 0.14);

	// 2. O vão da fenda: fundo e escuro, mas nunca preto.
	if (w > 0.0) {
		float dout = sd_laje_local(girar(lp, -f.z), f, h) + onda;
		float a_f = cobre(dout, px) * (1.0 - cobre(d, px));
		// A parede de cima à esquerda joga sombra no vão; a de baixo à direita olha para a
		// luz e fica um pouco mais clara (a normal, dentro do vão, aponta para longe da
		// beira mais perto).
		vec3 fundo = mix(contorno_de(cor) * 0.9, SOMBRA, 0.1);
		vec3 parede = mix(fundo * 0.94, mix(fundo, sombra_de(cor), 0.35), smoothstep(-0.3, 0.9, lit));
		// No meio do vão as duas paredes se fundem no fundo (sem a linha dura de onde a
		// normal troca de lado).
		vec3 vao = mix(parede, fundo * 0.97, smoothstep(0.3, 1.8, d));
		acc = sobre(acc, vao, a_f * 0.9);
	}

	// 3. Contorno: mais fino do lado da luz.
	float lado_sombra = clamp(0.5 - 0.5 * lit, 0.0, 1.0);
	float esp = mix(0.75, 1.1, lado_sombra);
	acc = sobre(acc, contorno_de(cor), cobre(d, px) * mix(0.2, 0.55, lado_sombra));

	// 4. Corpo: a luz cai devagar de cima à esquerda para baixo à direita, com manchas
	//    largas e fracas da própria pedra e um relevo bem macio (para os 300%). Mais forte
	//    que isto (rodadas 5 a 14) a laje ficava com manchas de algodão a 50%.
	float gl = dot(lp / f.x, LUZ);
	float mancha = (rz(q0, 64.0, 256.0, sl + 3) - 0.5) * 0.35 + (rz(q0, 32.0, 256.0, sl + 4) - 0.5) * 0.08;
	vec3 corpo = mix(cor * 0.96, cor * 1.025, smoothstep(-1.0, 1.0, gl + mancha));
	float rA = rz(q0 - LUZ * 2.5, 32.0, 256.0, sl + 6);
	float rB = rz(q0 + LUZ * 2.5, 32.0, 256.0, sl + 6);
	corpo *= 1.0 + clamp(0.3 * (rA - rB), -0.018, 0.018);
	// Líquen: uma faixa comprida e macia ao longo da beira de baixo à direita (o lado da
	// sombra, onde ele cresce), nunca no meio: a mancha redonda da rodada 5 virava um
	// "olho" amarelo em cada laje, o mesmo a cada repetição da peça.
	if (liquen) {
		float al = 0.785 + (rk(h, 51) - 0.5) * 1.4;
		vec2 dl_ = vec2(cos(al), sin(al));
		vec2 rl = lp - dl_ * 0.6 * f.y;
		vec2 rr = vec2(dot(rl, dl_), dot(rl, vec2(-dl_.y, dl_.x))) / (f.y * vec2(0.2, 0.62));
		float dl = (length(rr) - 1.0) * 0.2 * f.y + (rz(q0, 16.0, 256.0, sl + 5) - 0.5) * 6.0;
		float a_l = 1.0 - smoothstep(-5.0, 5.0, dl);
		corpo = mix(corpo, mix(corpo, LIQUEN, 0.4), a_l * 0.45);
	}
	// A beira clara do lado da luz e a face de sombra do outro lado.
	float dentro = -(d + esp);
	float a_beira = (1.0 - smoothstep(0.8, 3.0, dentro)) * smoothstep(0.15, 0.85, lit);
	corpo = mix(corpo, realce_de(cor), a_beira * 0.7);
	float face = 2.4 * alto + 0.5;
	float a_face = (1.0 - smoothstep(face - 1.1, face + 1.1, dentro)) * smoothstep(0.1, 0.8, -lit);
	corpo = mix(corpo, sombra_de(cor) * 0.94, a_face * 0.9);
	// A mão de pintura: pinceladas largas na mesma direção do chão e um grão bem leve.
	corpo *= 1.0 + 0.028 * pinceladas(q0 + vec2(float(sl), 0.0), 256.0, px, sl + 7, 32.0, -1.2, 0.5);
	corpo *= 1.0 + (grao(q0, 256.0, sl + 9) - 1.0) * 0.6;
	acc = sobre(acc, corpo, cobre(d + esp, px));
	return acc;
}

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 3.0), 5503);
	uint h2 = hash_cel(vec2(float(i), 4.0), 5503);
	uint h3 = hash_cel(vec2(float(i), 5.0), 5503);
	int sl = 6000 + i * 37;
	vec4 acc = vec4(0.0);
	vec3 cor = cor_de_laje(i);
	if (i == 0) {
		vec4 f = forma_de_laje(h, 48.0, 52.0, 1.12, 1.3);
		acc = laje_em(acc, q, vec2(0.0), f, h, sl, 0.0, cor, 1.0, true, px);
	} else if (i == 1) {
		vec4 f = forma_de_laje(h, 50.0, 52.0, 1.3, 1.45);
		acc = laje_em(acc, q, vec2(0.0), f, h, sl, 0.0, cor, 1.0, false, px);
	} else if (i == 2) {
		vec4 f = forma_de_laje(h, 48.0, 51.0, 1.15, 1.3);
		acc = laje_em(acc, q, vec2(0.0), f, h, sl, 2.4, cor, 1.0, false, px);
	} else {
		// Laje menor e mais gasta. Sem pedra solta ao lado: a dupla laje + pedrinha das
		// rodadas 3 e 4 era sempre a mesma e virava carimbo (um ponto ao lado) a 25%.
		vec4 f = forma_de_laje(h, 34.0, 37.0, 1.1, 1.3);
		acc = laje_em(acc, q, vec2(0.0), f, h, sl, 0.0, cor, 0.85, true, px);
	}
	// A célula termina transparente (4 px de folga), aconteça o que acontecer com a sombra.
	acc *= 1.0 - smoothstep(58.0, 61.0, max(abs(q.x), abs(q.y)));
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

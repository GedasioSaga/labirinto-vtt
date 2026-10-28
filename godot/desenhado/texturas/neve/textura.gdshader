// Neve: chão nevado. Lote 3 da onda 1.
// Base: o branco quente da paleta (nunca branco puro, nunca acima do BRANCO #f3efe2) com
// relevo largo de montes e vales macios (de 2 a 6 casas) e a beira de alguns montes de
// vento, que se leem só pela luz de cima à esquerda: a encosta virada para a luz fica
// quente e clara, a do outro lado e o fundo dos vales, azulados. Uma crosta de vento leve
// para o close a 300%. Nada de brilho de pixel nem cintilação: o teto de cor é o NEVE_LUZ
// (com o tom do mundo, no máximo o BRANCO), e o grão de papel vai pela metade.
// O atlas leva os marcos, raros e grandes: capim seco furando a neve, pedra meio coberta,
// pegadas e um graveto; quase sempre, montinhos e covas macias sem contorno, que só
// mexem na luz.
//
// O que as rodadas de 28/10 mudaram (10, todas na folha):
// - Ruído de gradiente em grade de 2 x 2 células por ladrilho deixava faixas retas na
//   horizontal e na vertical: as grades agora são giradas (matriz inteira) e os montes
//   grandes são ondas de direção inteira, que repetem no ladrilho sem grade.
// - Só com montes de 2 a 3 casas e a sombra fraca, a 50% a neve ficava chapada (papel
//   bege): vieram os montes grandes e a sombra mais azul, com a luz ainda dentro de ±5%.
// - A pedra lia como ovo, lua crescente ou olho: agora tem faces, e o gorro de neve fica
//   preso nas faces de cima.
// - O capim lia como coroinha ("www") e depois como fileira ("////"): agora sai de um pé
//   estreito em leque torto, com lâminas de comprimento desigual.
//
// Paleta: NEVE #dedbcf entre NEVE_SOMBRA #c2ccd8 (azulada) e NEVE_LUZ #e8e4d8.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta (client/src/texturas/meioTermo/paleta.ts). BRANCO, PEDRA e CARVALHO vêm da base.
// O azul das sombras sai do telhaAzul #43639a (0,263, 0,388, 0,604).
const vec3 ARDOSIA = vec3(0.373, 0.416, 0.400);    // #5f6a66 ardosia
const vec3 GRANITO = vec3(0.604, 0.588, 0.545);    // #9a968b granito
const vec3 LENHA = vec3(0.431, 0.341, 0.271);      // #6e5745 lenha
// Tons da neve, todos misturas da paleta.
const vec3 NEVE_LUZ = vec3(0.910, 0.895, 0.846);    // #e8e4d8 branco a 95,5% (o teto: com o tom do
                                                    // mundo, +4,5%, fica no BRANCO)
const vec3 NEVE = vec3(0.872, 0.857, 0.811);        // #dedbcf branco a 91,5%
const vec3 NEVE_SOMBRA = vec3(0.761, 0.799, 0.847); // #c2ccd8 branco 64% + telhaAzul 36%, a 108%
const vec3 SOMBRA_NEVE = vec3(0.307, 0.399, 0.522); // sombra projetada: telhaAzul 60% + ardósia 40%
// Capim seco (os mesmos tons da grama-amarela aprovada).
const vec3 CAPIM_PE = vec3(0.585, 0.522, 0.333);    // ocre com um pouco de musgo
const vec3 CAPIM = vec3(0.757, 0.689, 0.471);       // palha 55% + líquen 25% + linho 20%
const vec3 CAPIM_PONTA = vec3(0.860, 0.790, 0.600); // palha 60% + branco 40%

// ---------- base ----------

// Grades giradas: o ruído de gradiente numa grade de 2 x 2 células por ladrilho deixa
// linhas retas na horizontal e na vertical (rodada 2: faixas claras a cada 4 casas). Com
// a posição multiplicada por uma matriz inteira, a grade gira e continua repetindo a cada
// P: (1, 1 / -1, 1) gira 45 graus (células de 181 px), (2, 1 / -1, 2) gira 27 graus
// (114 px) e (1, 2 / -2, 1), -63 graus (114 px).
vec2 gira45(vec2 p) {
	return vec2(p.x + p.y, p.y - p.x);
}

vec2 gira27(vec2 p) {
	return vec2(2.0 * p.x + p.y, 2.0 * p.y - p.x);
}

vec2 gira63(vec2 p) {
	return vec2(p.x + 2.0 * p.y, p.y - 2.0 * p.x);
}

// Os montes grandes (3,6 e 5,7 casas): seis ondas de direção inteira no ladrilho (repetem
// a cada P sem grade nenhuma), com a fase sorteada por variante e torcidas por ruído. É o
// relevo que se lê a 50%: só com ruído de 2 a 3 casas (rodada 5) a neve ficava chapada.
float montes_grandes(vec2 p, float P, int s) {
	vec2 w = vec2(rz(p, 128.0, P, s + 32), rz(p, 128.0, P, s + 33)) - 0.5;
	vec2 pw = p + 48.0 * w;
	uint h = hash_cel(vec2(3.0, 7.0), s + 60);
	float t = 0.0;
	for (int k = 0; k < 6; k++) {
		vec2 kv = vec2(1.0, 1.0);
		if (k == 1) {
			kv = vec2(1.0, -1.0);
		} else if (k == 2) {
			kv = vec2(2.0, 1.0);
		} else if (k == 3) {
			kv = vec2(1.0, -2.0);
		} else if (k == 4) {
			kv = vec2(2.0, -1.0);
		} else if (k == 5) {
			kv = vec2(1.0, 2.0);
		}
		float amp = k < 2 ? 1.0 : 0.55;
		t += amp * cos(TAU * dot(kv, pw) / P + TAU * rk(h, k));
	}
	return t / 4.2;
}

// Os montes médios (2 a 3 casas), numa grade girada e torcida por ruído (os montes não
// saem redondos nem em fila).
float altura_larga(vec2 p, float P, int s) {
	vec2 w = vec2(rz(p, 128.0, P, s + 30), rz(p, 128.0, P, s + 31)) - 0.5;
	vec2 pw = p + 40.0 * w;
	return rz(gira45(pw), 256.0, P, s + 1) * 0.65 + rz(gira27(pw), 256.0, P, s + 2) * 0.35;
}

// A beira dos montes de vento: um platô macio (de 2 casas) cuja borda é a única coisa que
// a luz marca, como uma onda de neve que o vento deixou.
float deriva(vec2 p, float P, int s) {
	vec2 w = vec2(rz(p, 128.0, P, s + 40), rz(p, 128.0, P, s + 41)) - 0.5;
	vec2 pw = p + 32.0 * w;
	float n = rz(gira63(pw), 256.0, P, s + 4) * 0.7 + rz(gira45(pw), 256.0, P, s + 5) * 0.3;
	return smoothstep(0.54, 0.7, n);
}

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. A luz do relevo: a encosta que desce para a luz fica clara e quente, a outra
	//    azulada. Montes grandes primeiro, os médios e a beira do vento por cima.
	const float D = 6.0;
	float g = montes_grandes(p, P, s);
	float luz_g = (montes_grandes(p - LUZ * D, P, s) - montes_grandes(p + LUZ * D, P, s)) / (2.0 * D) * 60.0;
	float luz_l = (altura_larga(p - LUZ * D, P, s) - altura_larga(p + LUZ * D, P, s)) / (2.0 * D) * 170.0;
	const float DD = 3.0;
	float luz_d = (deriva(p - LUZ * DD, P, s) - deriva(p + LUZ * DD, P, s)) / (2.0 * DD) * 40.0;
	float luz = clamp(luz_g * 0.65 + luz_l * 0.4 + luz_d * 0.3, -1.0, 1.0);
	vec3 c = NEVE;
	c = mix(c, NEVE_LUZ, smoothstep(0.0, 1.0, luz));
	c = mix(c, NEVE_SOMBRA, smoothstep(0.0, 1.0, -luz) * 0.6);
	// O fundo dos vales grandes, um pouco mais frio.
	c = mix(c, NEVE_SOMBRA, smoothstep(0.05, -0.45, g) * 0.15);
	// 2. Cada variante com a sua temperatura (menos de 1%).
	if (qual == 1) {
		c = mix(c, NEVE_LUZ, 0.1);
	} else if (qual == 2) {
		c = mix(c, NEVE_SOMBRA, 0.08);
	}
	// 3. Crosta de vento (1/2 e 1/4 de casa), só pela luz e bem baixa: no close a 300% a
	//    neve não fica lisa. Com uma de 1/8 (rodada 2) ou a de 1/4 forte (rodada 8), reboco.
	float gA = smoothstep(0.3, 0.7, rz(gira27(p - LUZ * 2.5), 64.0, P, s + 9));
	float gB = smoothstep(0.3, 0.7, rz(gira27(p + LUZ * 2.5), 64.0, P, s + 9));
	float fA = smoothstep(0.3, 0.7, rz(gira27(p - LUZ * 1.5), 32.0, P, s + 19));
	float fB = smoothstep(0.3, 0.7, rz(gira27(p + LUZ * 1.5), 32.0, P, s + 19));
	c *= 1.0 + 0.028 * (gA - gB) + 0.012 * (fA - fB);
	// 4. Grão de papel pela metade: no branco o grão inteiro vira chuvisco.
	c *= 1.0 + 0.5 * (grao(p, P, s + 16) - 1.0);
	return min(c, NEVE_LUZ);
}

// ---------- atlas ----------

// Distância a uma forma torta: círculo achatado e girado, com 3 harmônicos.
float dist_torta(vec2 q, vec2 c, float r, float achata, float ang, float torto, uint h) {
	vec2 lq = girar(q - c, -ang);
	lq.y *= achata;
	float th = atan(lq.y, lq.x);
	float f = 1.0 + torto * (0.12 * cos(th + TAU * rk(h, 0)) + 0.08 * cos(2.0 * th + TAU * rk(h, 1))
			+ 0.05 * cos(3.0 * th + TAU * rk(h, 2)));
	return (length(lq) - r * f) / sqrt(achata);
}

// A altura (0 a 1) de um monte macio de raio r; parede = largura da encosta em px.
float monte(vec2 q, vec2 c, float r, float achata, float ang, float parede, uint h) {
	float t = clamp(-dist_torta(q, c, r, achata, ang, 0.9, h) / parede, 0.0, 1.0);
	return t * t * (3.0 - 2.0 * t);
}

// Pinta a luz de um relevo: clara do lado da luz, azulada do outro. "luz" de -1 a 1.
vec4 luz_em(vec4 acc, float luz, float forca) {
	acc = sobre(acc, NEVE_LUZ, clamp(luz, 0.0, 1.0) * forca);
	return sobre(acc, NEVE_SOMBRA, clamp(-luz, 0.0, 1.0) * forca);
}

// Montinho (sinal 1) ou cova (sinal -1) de neve, sem contorno: só mexe na luz.
vec4 relevo_em(vec4 acc, vec2 q, vec2 c, float r, float achata, float ang, float forca, float sinal, uint h) {
	float parede = r * 0.8;
	float a = monte(q - LUZ * 2.0, c, r, achata, ang, parede, h);
	float b = monte(q + LUZ * 2.0, c, r, achata, ang, parede, h);
	float luz = sinal * (a - b) / 4.0 * parede * 1.4;
	if (sinal < 0.0) {
		// O fundo da cova fica um pouco na sombra.
		acc = sobre(acc, NEVE_SOMBRA, monte(q, c, r, achata, ang, parede, h) * forca * 0.35);
	}
	return luz_em(acc, luz, forca);
}

// Uma lâmina de capim seco do pé até a ponta, com uma curva; "dobra" > 0 quebra a lâmina
// no meio e deixa a ponta cair para o lado do vento.
vec4 lamina_em(vec4 acc, vec2 q, vec2 pe, float ang, float comp, float dobra, float tom, float px) {
	vec2 eixo = vec2(sin(ang), -cos(ang));
	vec2 meio = pe + eixo * comp * 0.55;
	vec2 eixo2 = vec2(sin(ang + 0.25 + dobra), -cos(ang + 0.25 + dobra));
	vec2 ponta = meio + eixo2 * comp * mix(0.45, 0.4, step(0.01, dobra));
	float d = min(sd_traco(q, pe, meio, 1.4, 1.0), sd_traco(q, meio, ponta, 1.0, 0.35));
	float a = cobre(d, px);
	if (a <= 0.0) {
		return acc;
	}
	float hh = clamp(dot(q - pe, ponta - pe) / dot(ponta - pe, ponta - pe), 0.0, 1.0);
	vec3 ponta_cor = mix(CAPIM, CAPIM_PONTA, tom);
	return sobre(acc, mix(mix(CAPIM_PE, CAPIM, 0.3), ponta_cor, hh), a);
}

// Um tufo de capim seco que fura a neve: 5 a 7 lâminas de comprimento desigual, saindo de
// um pé estreito em leque torto, todas pendendo para o lado do vento (a direita), às vezes
// uma quebrada; a sombra azulada para baixo e para a direita e um montinho de neve no pé.
// Lâminas iguais em leque viravam coroinha ("www") na rodada 1; com o pé largo e as
// lâminas paralelas (rodada 6), fileira de riscos ("////").
vec4 capim_em(vec4 acc, vec2 q, vec2 pe0, float alto, float px, uint h) {
	float vento = 0.3 + 0.15 * rk(h, 4);
	float larg = alto * 0.22;
	float ds = length((q - pe0 - vec2(alto * 0.35, 2.2)) / vec2(alto * 0.62, 3.8)) - 1.0;
	acc = sobre(acc, SOMBRA_NEVE, (1.0 - smoothstep(-0.8, 0.9, ds)) * 0.14);
	int n = 5 + int(rk(h, 5) * 2.99);
	for (int b = 0; b < 7; b++) {
		if (b >= n) {
			break;
		}
		// O pé de cada lâmina: espalhado na largura do tufo, sem passo fixo.
		float u = (float(b) + 0.2 + 0.6 * rk(h, 40 + b)) / float(n);
		vec2 pe = pe0 + vec2((u - 0.5) * larg, (rk(h, 50 + b) - 0.5) * 2.4);
		float comp = alto * (0.45 + 0.55 * rk(h, 10 + b)) * (1.0 - 0.6 * abs(u - 0.5));
		float ang = (u - 0.5) * 1.6 + vento + (rk(h, 60 + b) - 0.5) * 0.45;
		float dobra = (b == 1 && rk(h, 70) > 0.5) ? 0.55 + 0.3 * rk(h, 80) : 0.0;
		acc = lamina_em(acc, q, pe, ang, comp, dobra, rk(h, 20 + b), px);
	}
	// O montinho de neve no pé: a borda funde no chão, a luz igual à do monte.
	vec2 l = (q - pe0 - vec2(alto * 0.05, -0.4)) / vec2(larg * 0.75 + 3.0, 3.8);
	float dm = length(l) - 1.0;
	vec3 neve = mix(NEVE_SOMBRA, NEVE_LUZ, smoothstep(-0.9, 0.6, dot(l, LUZ) * 1.4 + 0.25));
	return sobre(acc, neve, 1.0 - smoothstep(-0.5, 0.15, dm));
}

// A pedra: um polígono torto de 7 faces com os cantos arredondados (máximo suave das
// faces), em px do mundo, negativa dentro. Lisa e oval (rodadas 1 a 8), com o gorro
// dentro, ela lia como ovo ou olho; com faces, lê como pedra.
float dist_rocha(vec2 q, vec2 c, float r, float achata, float ang, uint h) {
	vec2 lq = girar(q - c, -ang);
	lq.y *= achata;
	const float K = 2.2;
	float s = 0.0;
	for (int i = 0; i < 7; i++) {
		float th = (float(i) + 0.4 * (rk(h, 30 + i) - 0.5)) * TAU / 7.0;
		float di = dot(lq, vec2(cos(th), sin(th))) - r * (0.86 + 0.22 * rk(h, 40 + i));
		s += exp(di / K);
	}
	return K * log(s) / sqrt(achata);
}

// Pedra meio coberta: a pedra de faces com contorno da própria cor escurecida, a sombra
// azulada e uma beira clara do lado da luz; em cima, um gorro de neve torto puxado para a
// luz, preso nas faces de cima (a beira dele, desse lado, é a beira da pedra) e solto
// embaixo e à direita, onde a pedra aparece. "cobre_n" é quanto da pedra o gorro cobre.
vec4 pedra_em(vec4 acc, vec2 q, vec2 c, float r, float achata, float ang, vec3 cor, float cobre_n, float px, uint h, uint h2) {
	float ds = dist_rocha(q - vec2(2.2, 2.6), c, r * 1.03, achata, ang, h);
	acc = sobre(acc, SOMBRA_NEVE, (1.0 - smoothstep(-1.5, 3.0, ds)) * 0.2);
	float d = dist_rocha(q, c, r, achata, ang, h);
	float luz = dot((q - c) / r, LUZ);
	acc = sobre(acc, contorno_de(cor), cobre(d, px) * 0.6);
	vec3 corpo = mix(sombra_de(cor), realce_de(cor), smoothstep(-0.8, 0.9, luz));
	float dentro = d + mix(2.0, 1.0, smoothstep(-0.7, 0.7, luz));
	acc = sobre(acc, corpo, cobre(dentro, px));
	float aro = (1.0 - smoothstep(0.0, 2.4, -dentro)) * smoothstep(0.25, 0.9, luz);
	acc = sobre(acc, realce_de(cor), cobre(dentro, px) * aro * 0.45);
	// O gorro: puxado para a luz até passar da beira, e cortado 2 px para dentro dela.
	float rc = r * cobre_n;
	vec2 cc = c + LUZ * r * (1.0 - cobre_n) * 0.85;
	float ag = ang + 0.5;
	float dc = max(dist_torta(q, cc, rc, achata, ag, 1.8, h2), d + 2.0);
	// A sombra da beira do gorro sobre a pedra, para baixo e para a direita.
	float dsc = max(dist_torta(q - vec2(1.5, 1.8), cc, rc, achata, ag, 1.8, h2), d + 1.2);
	acc = sobre(acc, contorno_de(cor), (1.0 - smoothstep(-1.0, 1.3, dsc)) * cobre(d + 1.0, px) * 0.45);
	vec2 lc = (q - cc) / rc;
	vec3 neve = mix(NEVE_SOMBRA, NEVE_LUZ, smoothstep(-0.8, 0.45, dot(lc, LUZ) + 0.2));
	return sobre(acc, neve, cobre(dc, px * 1.2));
}

// A cor de uma pedra: granito puxado para a ardósia ou para a pedra clara.
vec3 cor_de_pedra(uint h) {
	vec3 c = mix(mix(GRANITO, PEDRA, 0.3), ARDOSIA, 0.1 + 0.2 * rk(h, 8));
	if (rk(h, 9) > 0.6) {
		c = mix(GRANITO, PEDRA, 0.55);
	}
	return c;
}

// Pegadas: 3 marcas de bota em fila, alternadas, rasas e macias (a neve já cobriu um
// pouco). Cada uma é uma cova de parede curta.
float pegada(vec2 q, vec2 c, vec2 dir, float parede) {
	vec2 l = vec2(dot(q - c, dir), dot(q - c, vec2(-dir.y, dir.x)));
	// Bota: a sola mais larga na frente e o salto atrás, juntos numa forma só.
	float d = min(sd_elipse(l - vec2(3.2, 0.0), vec2(6.6, 4.1)), sd_elipse(l - vec2(-6.2, 0.0), vec2(3.7, 3.5)));
	float t = clamp(-d / parede, 0.0, 1.0);
	return t * t * (3.0 - 2.0 * t);
}

vec4 pegadas_em(vec4 acc, vec2 q, float ang, float px, uint h) {
	vec2 dir = vec2(cos(ang), sin(ang));
	vec2 nrm = vec2(-dir.y, dir.x);
	float fundo = 0.0;
	float luz = 0.0;
	for (int k = 0; k < 3; k++) {
		float lado = (k == 1) ? -1.0 : 1.0;
		vec2 c = dir * (float(k) - 1.0) * 21.0 + nrm * lado * 5.5;
		vec2 dk = girar(dir, (rk(h, 3 + k) - 0.5) * 0.25);
		fundo = max(fundo, pegada(q, c, dk, 1.8));
		luz += pegada(q + LUZ * 1.4, c, dk, 1.8) - pegada(q - LUZ * 1.4, c, dk, 1.8);
	}
	acc = sobre(acc, NEVE_SOMBRA, fundo * 0.42);
	return luz_em(acc, luz, 0.8);
}

// Graveto caído meio coberto: madeira escura, fina e torta, com neve por cima do lado
// da luz, em trechos, e um toco de galho.
vec4 graveto_em(vec4 acc, vec2 q, float ang, float px, uint h) {
	vec2 P0 = girar(vec2(-23.0, 2.5), ang);
	vec2 P1 = girar(vec2(-1.0, -1.0 + 2.0 * rk(h, 3)), ang);
	vec2 P2 = girar(vec2(22.0, 1.5), ang);
	vec2 T0 = P1 + girar(vec2(4.0, -0.8), ang);
	vec2 T1 = P1 + girar(vec2(10.0, -7.5), ang);
	vec2 qs = q - vec2(1.8, 2.1);
	float ds = min(min(sd_traco(qs, P0, P1, 2.4, 2.0), sd_traco(qs, P1, P2, 2.0, 1.4)), sd_traco(qs, T0, T1, 1.2, 0.8));
	acc = sobre(acc, SOMBRA_NEVE, (1.0 - smoothstep(-1.2, 2.0, ds)) * 0.18);
	float d = min(min(sd_traco(q, P0, P1, 2.4, 2.0), sd_traco(q, P1, P2, 2.0, 1.4)), sd_traco(q, T0, T1, 1.2, 0.8));
	vec3 madeira = mix(LENHA, CARVALHO, 0.3);
	acc = sobre(acc, contorno_de(madeira), cobre(d, px) * 0.8);
	acc = sobre(acc, madeira, cobre(d + 0.9, px));
	float dn = max(min(min(sd_traco(q + LUZ * 1.2, P0, P1, 2.2, 1.8), sd_traco(q + LUZ * 1.2, P1, P2, 1.8, 1.2)), sd_traco(q + LUZ * 1.0, T0, T1, 1.0, 0.6)), d + 0.4);
	float t = dot(q, girar(vec2(1.0, 0.0), ang));
	float trechos = smoothstep(-0.2, 0.3, sin(t * 0.21 + TAU * rk(h, 4)) + 0.35);
	return sobre(acc, mix(NEVE, NEVE_LUZ, 0.6), cobre(dn, px) * trechos);
}

vec2 polar(float a, float r) {
	return vec2(cos(a), sin(a) * 0.8) * r;
}

// O atlas (16 células de 1 casa). Os marcos são raros (13% dos pesos) e grandes; a
// maioria dos detalhes são montinhos e covas sem contorno.
//   0 capim seco   1 capim seco alto   2 touceira desigual   3 pedra meio coberta
//   4 laje meio coberta   5 pedra pequena e capim curto   6 pegadas   7 graveto
//   8-10 montinho   11-13 cova   14 monte comprido de vento   15 pedra grande e pequena
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 5.0), 6719);
	uint h2 = hash_cel(vec2(float(i), 6.0), 6719);
	vec4 acc = vec4(0.0);
	float ang = TAU * rk(h, 20);
	float a2 = TAU * rk(h, 23);
	if (i == 0) {
		float alto = 29.0 + 3.0 * rk(h, 21);
		acc = capim_em(acc, q, vec2(-7.0, alto * 0.42), alto, px, h);
	} else if (i == 1) {
		float alto = 34.0 + 2.0 * rk(h, 21);
		acc = capim_em(acc, q, vec2(-8.0, alto * 0.42), alto, px, h);
	} else if (i == 2) {
		// Um tufo grande e um menor, para o lado e um pouco atrás.
		acc = capim_em(acc, q, vec2(10.0, 4.0), 17.0, px, h2);
		acc = capim_em(acc, q, vec2(-9.0, 13.0), 28.0, px, h);
	} else if (i == 3) {
		acc = pedra_em(acc, q, vec2(0.0), 20.0 + 2.0 * rk(h, 21), 1.25, ang, cor_de_pedra(h), 0.68, px, h, h2);
	} else if (i == 4) {
		acc = pedra_em(acc, q, vec2(0.0), 25.0, 1.65, ang * 0.3, cor_de_pedra(h2), 0.72, px, h, h2);
	} else if (i == 5) {
		// A pedra chata à direita e o capim à esquerda, lado a lado: com o capim embaixo da
		// pedra redonda (rodada 7) o par lia como alfinete de mapa.
		acc = pedra_em(acc, q, vec2(8.0, 3.0), 12.5, 1.55, 0.3, cor_de_pedra(h), 0.62, px, h, h2);
		acc = capim_em(acc, q, vec2(-12.0, 10.0), 16.0, px, h2);
	} else if (i == 6) {
		acc = pegadas_em(acc, q, -0.5 + (rk(h, 21) - 0.5) * 0.8, px, h);
	} else if (i == 7) {
		acc = graveto_em(acc, q, (rk(h, 21) - 0.5) * 1.4 - 0.4, px, h);
	} else if (i <= 10) {
		acc = relevo_em(acc, q, vec2(0.0), 24.0 + 3.0 * rk(h, 21), 1.25, ang, 0.24, 1.0, h);
	} else if (i <= 13) {
		acc = relevo_em(acc, q, vec2(0.0), 23.0 + 3.0 * rk(h, 21), 1.3, ang, 0.2, -1.0, h);
	} else if (i == 14) {
		acc = relevo_em(acc, q, vec2(0.0), 27.0, 2.1, -0.5, 0.24, 1.0, h);
	} else {
		// Par desigual e separado: a pedra grande e uma pequena para o lado.
		vec2 d2 = polar(a2, 19.0);
		acc = pedra_em(acc, q, d2, 7.5, 1.2, ang + 1.3, cor_de_pedra(h2), 0.55, px, h2, h);
		acc = pedra_em(acc, q, -d2 * 0.3, 15.0, 1.35, ang, cor_de_pedra(h), 0.66, px, h, h2);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

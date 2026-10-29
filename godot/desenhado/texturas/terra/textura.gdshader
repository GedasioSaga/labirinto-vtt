// Terra: chão de estrada e chão batido. Lote 1 da onda 1.
// Base: manchas largas de terra pisada (mais clara e lisa onde se anda) e solta
// (um pouco mais escura e quente), um relevo miúdo de torrões com luz de cima à
// esquerda (para o close a 300% não ficar liso) e poucas pinceladas na mesma
// direção da grama. O atlas leva os marcos: seixos de forma irregular, sozinhos ou
// em grupo desigual, pedra chata, manchas de umidade e de terra seca (sem
// contorno, de 1 casa) e um capim seco raro, que liga a estrada à grama.
//
// O que as rodadas de 28/10 mudaram (13, todas na folha):
// - A 50% a rodada 1 virava pimenta (seixos pequenos, de contorno escuro, muitos
//   cinza, por igual) e o grupo grande + bolinha virava carimbo. Agora quase todo
//   detalhe é UMA pedra maior e torta, quente, de contorno mais fino do lado da luz;
//   grupo é raro e espaçado, e um terço dos detalhes são manchas macias.
// - Variantes com 2% de diferença de luz e mistura de faixa estreita viravam
//   camuflagem a 50%: agora menos de 1% e faixa 0,2.
// - A 300% o fundo ficava liso: o relevo de torrões ganhou platôs de borda curta
//   (linhas de crosta de terra seca), que de longe somem no chão.
//
// Paleta, para o 'caminho' (mesma família): chão TERRA #dda56c entre TERRA_SOMBRA
// #c78d58 e TERRA_REALCE #e7b882; puxões largos de PALHA #d6b56a (seco) e BARRANCO
// #aa745c (úmido, solto); seixo SEIXO #c4915f, às vezes puxado para PEDRA #c3c0b2.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta da terra (client/src/texturas/meioTermo/paleta.ts). TERRA (#dda56c),
// TERRA_SOMBRA (#c78d58), SEIXO (#c4915f) e PEDRA (#c3c0b2) vêm da base.
const vec3 TERRA_REALCE = vec3(0.906, 0.722, 0.510); // #e7b882 (terra.realce)
const vec3 BARRANCO = vec3(0.667, 0.455, 0.361);     // #aa745c
const vec3 PALHA = vec3(0.839, 0.710, 0.416);        // #d6b56a

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (4 casas), entre a sombra e o realce da terra, a meio caminho.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(TERRA, mix(TERRA_SOMBRA, TERRA_REALCE, t), 0.42);
	// 2. Chão batido (manchas de 2 a 3 casas, torcidas para não sair redondas): onde se
	//    pisa, mais claro; na beira, um pouco mais solto e escuro. Borda bem macia: com
	//    borda marcada (rodada 3) a 50% o chão virava camuflagem de manchas do mesmo tamanho.
	vec2 w = vec2(rz(p, 128.0, P, s + 4), rz(p, 128.0, P, s + 14)) - 0.5;
	float n_b = fz(p + 32.0 * w, 128.0, P, s + 3, 2);
	float batido = smoothstep(0.5, 0.76, n_b);
	float solto = smoothstep(0.46, 0.2, n_b);
	c = mix(c, mix(TERRA, TERRA_REALCE, 0.6), batido * 0.35);
	c = mix(c, mix(TERRA_SOMBRA, BARRANCO, 0.4), solto * 0.2);
	// 3. Temperatura bem larga: um pouco mais seca (palha) ou mais vermelha (barranco).
	float n_t = rz(p, 256.0, P, s + 6);
	c = mix(c, PALHA, smoothstep(0.55, 0.85, n_t) * 0.10);
	c = mix(c, mix(BARRANCO, TERRA, 0.5), smoothstep(0.45, 0.15, n_t) * 0.10);
	// As variantes diferem também um pouco na luz (menos de 1%): a 8 casas de distância o
	// chão já não é o mesmo. Com 2% (rodada 3) a troca de variante virava manchas de
	// borda marcada a 50%.
	if (qual == 1) {
		c = mix(c, mix(TERRA, BARRANCO, 0.3), 0.08) * 0.993;
	} else if (qual == 2) {
		c = mix(c, mix(TERRA_REALCE, PALHA, 0.4), 0.08) * 1.006;
	}
	// 4. Relevo de torrões (1/3 e 1/4 de casa) com luz de cima à esquerda: platôs
	//    macios, e a luz só aparece na encosta, como terra seca vista de perto.
	float hA = smoothstep(0.42, 0.58, fz(p - LUZ, 32.0, P, s + 8, 2));
	float hB = smoothstep(0.42, 0.58, fz(p + LUZ, 32.0, P, s + 8, 2));
	float fA = smoothstep(0.35, 0.65, rz(p - LUZ, 16.0, P, s + 9));
	float fB = smoothstep(0.35, 0.65, rz(p + LUZ, 16.0, P, s + 9));
	// Teto de ±5,5% na encosta mais forte: a linha de crosta não passa da faixa da mancha.
	c *= 1.0 + 0.11 * clamp(hA - hB, -0.5, 0.5) + 0.03 * (fA - fB);
	// 5. Pinceladas largas e poucas, na mesma direção geral da grama.
	c *= 1.0 + 0.025 * pinceladas(p, P, px, s + 10, 64.0, -1.2, 0.5);
	c *= 1.0 + 0.02 * pinceladas(p, P, px, s + 12, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 16);
	return c;
}

// ---------- atlas ----------

// Distância (px do mundo, negativa dentro) a uma forma torta: um círculo achatado e
// girado, com 3 harmônicos baixos na borda (batata, feijão; nunca um ovo liso).
float dist_torta(vec2 q, vec2 c, float r, float achata, float ang, float torto, uint h) {
	vec2 lq = girar(q - c, -ang);
	lq.y *= achata;
	float th = atan(lq.y, lq.x);
	float f = 1.0 + torto * (0.12 * cos(th + TAU * rk(h, 0)) + 0.08 * cos(2.0 * th + TAU * rk(h, 1))
			+ 0.05 * cos(3.0 * th + TAU * rk(h, 2)));
	return (length(lq) - r * f) / sqrt(achata);
}

// Um seixo: sombra macia para baixo e para a direita, contorno da própria cor
// escurecida (2 px do lado da sombra, 1 px do lado da luz: a pedra assenta no chão
// em vez de virar bolinha recortada), corpo da sombra ao realce pela luz e uma borda
// clara do lado da luz.
vec4 seixo_em(vec4 acc, vec2 q, vec2 c, float r, float achata, float ang, vec3 cor, float px, uint h) {
	float ds = dist_torta(q - vec2(1.6, 1.9), c, r * 1.04, achata, ang, 1.2, h);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-1.5, 2.2, ds)) * 0.18);
	float d = dist_torta(q, c, r, achata, ang, 1.2, h);
	acc = sobre(acc, contorno_de(cor), cobre(d, px) * 0.68);
	float luz = dot((q - c) / r, LUZ);
	vec3 corpo = mix(sombra_de(cor), realce_de(cor), smoothstep(-0.8, 0.9, luz));
	float dentro = d + mix(2.1, 0.9, smoothstep(-0.7, 0.7, luz));
	acc = sobre(acc, corpo, cobre(dentro, px));
	float aro = (1.0 - smoothstep(0.0, 2.2, -dentro)) * smoothstep(0.3, 0.95, luz);
	acc = sobre(acc, realce_de(cor) * 1.04, cobre(dentro, px) * aro * 0.35);
	return acc;
}

// A cor de um seixo: quase sempre o seixo da paleta, quente, um pouco mais claro ou
// mais escuro; às vezes puxado para a pedra. Todos perto do tom do chão.
vec3 cor_de_seixo(uint h) {
	float k = rk(h, 9);
	vec3 c = mix(SEIXO, TERRA_REALCE, 0.3 * rk(h, 8));
	if (k > 0.85) {
		c = mix(SEIXO, PEDRA, 0.3 + 0.15 * rk(h, 8));
	}
	return c;
}

// Mancha de 1 casa sem contorno: umidade (mais escura) ou terra seca (mais clara).
// Borda bem esfumada e alfa baixo; de longe é só o chão variando.
vec4 mancha_em(vec4 acc, vec2 q, vec2 c, float r, vec3 cor, float alfa, float ang, uint h) {
	float d = dist_torta(q, c, r, 1.25, ang, 1.2, h);
	float a = 1.0 - smoothstep(-r * 0.55, 0.0, d);
	acc = sobre(acc, cor, a * a * (3.0 - 2.0 * a) * alfa);
	return acc;
}

// Capim seco de beira de estrada: 4 ou 5 risquinhos curvos sem contorno (o traço é o
// desenho), do oliva no pé à palha na ponta. Alto o bastante (15 a 18 px) para ler
// como tufo a 100%, e não como um quadradinho verde.
vec4 capim_seco(vec4 acc, vec2 q, vec2 pe0, float alto, float px, uint h) {
	float inclina = (rk(h, 4) - 0.5) * 0.5;
	float ds = length((q - pe0 - vec2(1.8, 0.7)) / vec2(alto * 0.45, 2.6)) - 1.0;
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-0.7, 0.6, ds)) * 0.14);
	int n = 4 + int(rk(h, 5) * 1.99);
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
		float d = min(sd_traco(q, pe, meio, 1.4, 1.0), sd_traco(q, meio, ponta, 1.0, 0.45));
		float a = cobre(d, px);
		if (a <= 0.0) {
			continue;
		}
		float hh = clamp(dot(q - pe, ponta - pe) / dot(ponta - pe, ponta - pe), 0.0, 1.0);
		vec3 cor = mix(mix(TUFO, PALHA, 0.3), mix(PALHA, TERRA_REALCE, 0.25), hh);
		acc = sobre(acc, cor, a);
	}
	return acc;
}

vec2 polar(float a, float r) {
	return vec2(cos(a), sin(a) * 0.75) * r;
}

// O atlas (16 células de 1 casa). Quase tudo é UMA pedra, cada uma com forma, tamanho
// e cor próprios; grupo é raro (10% dos pesos) e sempre desigual e espaçado: na rodada
// 4 o trio e a dupla fixos se achavam de novo três vezes num miolo de 14 casas.
//   0-5 seixo sozinho   6 pedra chata   7 seixo comprido   8-9 dupla   10 trio
//   11-12 mancha de umidade   13 mancha de terra seca   14 capim seco
//   15 seixo assentado numa mancha de umidade
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 5.0), 4513);
	uint h2 = hash_cel(vec2(float(i), 6.0), 4513);
	uint h3 = hash_cel(vec2(float(i), 7.0), 4513);
	vec4 acc = vec4(0.0);
	float ang = (rk(h, 20) - 0.5) * 2.4;
	float a2 = TAU * rk(h, 23);
	vec3 umido = mix(TERRA_SOMBRA, BARRANCO, 0.3);
	if (i <= 5) {
		float r = 5.8 + 2.6 * rk(h, 21);
		acc = seixo_em(acc, q, vec2(0.0), r, 1.1 + 0.55 * rk(h, 22), ang, cor_de_seixo(h), px, h);
	} else if (i == 6) {
		vec3 cor = mix(mix(SEIXO, PEDRA, 0.4), TERRA_REALCE, 0.15);
		acc = mancha_em(acc, q, vec2(1.0, 1.5), 15.0, umido, 0.18, ang * 0.5, h2);
		acc = seixo_em(acc, q, vec2(0.0), 10.5, 1.75, ang * 0.5, cor, px, h);
	} else if (i == 7) {
		acc = seixo_em(acc, q, vec2(0.0), 7.6, 1.85, ang, cor_de_seixo(h), px, h);
	} else if (i <= 9) {
		float r = 6.8 + 1.4 * rk(h, 21);
		float r2 = 4.4 + 0.9 * rk(h2, 21);
		vec2 c2 = polar(a2, r + r2 + 6.0 + 3.0 * rk(h2, 24));
		acc = seixo_em(acc, q, c2, r2, 1.15 + 0.3 * rk(h2, 22), ang + 1.3, cor_de_seixo(h2), px, h2);
		acc = seixo_em(acc, q, vec2(0.0), r, 1.2 + 0.35 * rk(h, 22), ang, cor_de_seixo(h), px, h);
	} else if (i == 10) {
		acc = seixo_em(acc, q, polar(a2 + 1.1, 19.0), 4.2, 1.2, ang - 0.6, cor_de_seixo(h3), px, h3);
		acc = seixo_em(acc, q, polar(a2, 13.5), 5.0, 1.15, ang + 0.8, cor_de_seixo(h2), px, h2);
		acc = seixo_em(acc, q, vec2(0.0), 6.6, 1.3, ang, cor_de_seixo(h), px, h);
	} else if (i <= 12) {
		acc = mancha_em(acc, q, vec2(0.0), 17.0 + 2.5 * rk(h, 21), umido, 0.2, ang, h);
	} else if (i == 13) {
		acc = mancha_em(acc, q, vec2(0.0), 18.0 + 2.0 * rk(h, 21), mix(TERRA_REALCE, PALHA, 0.15), 0.3, ang, h);
	} else if (i == 14) {
		float alto = 15.0 + 3.0 * rk(h, 21);
		acc = capim_seco(acc, q, vec2(0.0, alto * 0.45), alto, px, h);
	} else {
		acc = mancha_em(acc, q, vec2(2.0, 2.0), 18.0, umido, 0.2, ang, h2);
		acc = seixo_em(acc, q, polar(a2, 2.0), 7.0, 1.3, ang, cor_de_seixo(h), px, h);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

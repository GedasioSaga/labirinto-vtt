// Chão de floresta: o chão da mata fechada visto de cima, sem árvore (os carimbos de
// árvore e a Floresta ficam por cima e ao lado). Lote 2 da onda 1.
// Base: a sombra da mata da Floresta, mais escura e puxada para o musgo e o húmus
// (úmida), com manchas largas de húmus na mesma luz, um relevo macio de meia casa
// para o close e poucas pinceladas na direção da grama. O atlas leva os marcos:
// montes de folhas (uma mancha escura de folhiço com 3 a 5 folhas largas por cima, de
// uma árvore só, ocupando quase a casa inteira), raízes compridas que saem do chão e
// voltam a afundar e um galho seco raro. O monte é a unidade que se lê a 50%; a folha
// só aparece de perto.
// Contraste baixo de propósito: pino, nome e ficha leem por cima.
//
// O que as rodadas de 28/10 ensinaram (folha a 50%, 100% e 300%):
// - folha de 1/3 de casa, uma a uma, vira confete a 50%; com 2 folhas por detalhe
//   e as de baixo apagadas, continuava confete: o monte tem de encher a casa;
// - folhiço quente e mais claro que o chão virou um brilho laranja em volta da folha:
//   agora é mais escuro que o chão e quase sem cor;
// - raiz curta e grossa parecia espinho: agora é comprida, fina e em S;
// - almofada de musgo clara e redonda virava um "o" a 50% (saiu do atlas);
// - o chão na luz da Floresta ficou claro para um chão úmido (agora 12% mais escuro).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta do Meio-Termo que não está na base (client/src/texturas/meioTermo/paleta.ts).
const vec3 MUSGO_MT = vec3(0.435, 0.490, 0.294); // #6f7d4b musgo
const vec3 LENHA = vec3(0.431, 0.341, 0.271);    // #6e5745 lenha
// O chão: a sombra da mata da Floresta (texturas/floresta, CHAO_MATA #306644) 12% mais
// escura e puxada para o musgo.
const vec3 CHAO = vec3(0.215, 0.338, 0.222);
// Úmido: o chão 6% mais escuro e um pouco mais frio.
const vec3 CHAO_UMIDO = vec3(0.196, 0.321, 0.218);
// Musgo do chão: o chão 6% mais claro e puxado para o musgo.
const vec3 CHAO_MUSGO = vec3(0.240, 0.360, 0.222);
// Húmus: terra escura de folha podre, na mesma luz do chão (só o matiz esquenta).
const vec3 HUMUS = vec3(0.310, 0.295, 0.205);

// ---------- base ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (4 casas), do úmido ao musgo.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(CHAO_UMIDO, CHAO_MUSGO, t);
	// 2. Húmus: manchas de 3 a 4 casas, mais quentes, na mesma luz. É aqui que o chão
	//    ganha os trechos de folhiço e de musgo que se leem a 35%: o agrupamento dos
	//    detalhes no mundo é fraco demais para fazer moita e clareira sozinho.
	//    Ruído de 128 px, uma oitava (4 x 4 células por ladrilho): o de 256 px tinha só 2 x 2 e as
	//    manchas caíam numa grade de 8 casas (caixa de ovos); com a oitava de 64 px viravam
	//    pinta de 1 casa a 25%.
	float h = rz(p + vec2(70.0, 140.0), 128.0, P, s + 3) * 0.7 + rz(p, 256.0, P, s + 4) * 0.3;
	c = mix(c, HUMUS, 0.55 * smoothstep(0.44, 0.76, h));
	// 3. Relevo macio de meia casa e de 1/4 de casa (+-2% e +-1%): o close a 300% não
	//    fica liso, e de longe some (ciclo de 16 px, bem acima dos 4 px do mipmap).
	c *= 1.0 + 0.04 * (fz(p, 32.0, P, s + 6, 2) - 0.5) + 0.02 * (rz(p, 16.0, P, s + 8) - 0.5);
	if (qual == 1) {
		c = mix(c, HUMUS, 0.05);
	} else if (qual == 2) {
		c *= vec3(0.985, 0.995, 1.01);
	}
	// 4. Pinceladas largas, uma por meia casa, todas na mesma direção.
	c *= 1.0 + 0.03 * pinceladas(p, P, px, s + 5, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 7);
	return c;
}

// ---------- folhas caídas ----------

// Amêndoa vertical (duas curvas que se encontram no pé e na ponta).
float sd_amendoa(vec2 p, float r, float d) {
	p = abs(p);
	float b = sqrt(r * r - d * d);
	return ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}

// A silhueta da folha no sistema dela (eixo em y, pé em +y). L = meio comprimento,
// W = meia largura, torto = quanto o eixo enverga (folha seca enrola um pouco).
// "eixo" devolve a distância com sinal até a nervura (para a dobra de luz).
float sd_folha(vec2 r, float L, float W, float torto, out float eixo) {
	float y = clamp(r.y / L, -1.0, 1.0);
	r.x -= torto * L * (y * y - 0.3);
	eixo = r.x;
	// Mais larga perto do pé.
	r.x /= 1.0 + 0.18 * y;
	float rr = 0.5 * (W + L * L / W);
	float dd = 0.5 * (L * L / W - W);
	return sd_amendoa(r, rr, dd);
}

// Uma folha caída com o centro em c e o pé apontando para "ang". A metade virada para
// a luz é mais clara (a folha dobra na nervura); contorno da própria cor escurecida,
// mais fino do lado da luz; sombra macia para baixo e para a direita. "forca" < 1 é a
// folha meio afundada no folhiço.
vec4 folha_em(vec4 acc, vec2 q, vec2 c, float ang, float L, float W, float torto, vec3 cor, float forca, float px) {
	float eixo;
	float eixo_s;
	vec2 r = girar(q - c, -ang);
	vec2 rs = girar(q - c - vec2(1.4, 1.7), -ang);
	float ds = sd_folha(rs, L, W, torto, eixo_s);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-1.5, 2.5, ds)) * 0.16 * forca);
	float d = sd_folha(r, L, W, torto, eixo);
	vec3 c_traco = contorno_de(cor);
	// O cabinho: curto, saindo do pé.
	float dp = sd_traco(r, vec2(0.0, L * 0.9), vec2(torto * L * 0.4, L + 4.0), 1.0, 0.6);
	acc = sobre(acc, mix(c_traco, cor, 0.25), cobre(dp, px) * forca);
	vec2 dir = (q - c) / max(length(q - c), 1e-3);
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	float esp = mix(1.0, 1.5, lado_sombra);
	// Traço fino, e do lado da luz puxado para a cor da folha: o anel escuro inteiro
	// fazia cada folha ler como um ponto a 50%. Perto do tom do chão, como o tufo da
	// grama, a folha some de longe e aparece de perto.
	acc = sobre(acc, mix(mix(cor, c_traco, 0.45), c_traco, smoothstep(0.3, 0.8, lado_sombra)), cobre(d, px) * forca);
	// A dobra: a metade cuja beira olha para a luz clareia, a outra escurece.
	vec2 normal_metade = girar(vec2(sign(eixo), 0.0), ang);
	float luz_metade = dot(normal_metade, LUZ) * smoothstep(0.2, 1.6, abs(eixo));
	float y = clamp(r.y / L, -1.0, 1.0);
	vec3 corpo = mix(sombra_de(cor), mix(cor, realce_de(cor), 0.5), 0.5 + 0.5 * luz_metade);
	corpo *= 1.0 - 0.04 * y;
	acc = sobre(acc, corpo, cobre(d + esp, px) * forca);
	return acc;
}

// O tom da folha: uma família por monte (folhas da mesma árvore) e um desvio pequeno
// por folha. Oliva, ocre apagado e um castanho só, todos puxados para o chão (estão
// úmidos), de 10% a 15% acima da luz dele. Perto do matiz do chão, como o tufo da
// grama: a 25% o castanho-avermelhado da rodada 7 virava pimenta; assim a folha some
// de longe e aparece de perto.
vec3 cor_folha(float familia, float desvio) {
	vec3 c;
	if (familia < 0.36) {
		c = MUSGO_MT * 0.8;
	} else if (familia < 0.68) {
		c = mix(OCRE * 0.7, MUSGO_MT * 0.8, 0.5);
	} else if (familia < 0.9) {
		c = NOGUEIRA;
	} else {
		c = CARVALHO * 0.78;
	}
	c *= 0.96 + 0.08 * desvio;
	return mix(c, CHAO, 0.4);
}

// O quanto empurrar um ponto para ele voltar ao quadrado de meio lado m.
vec2 recolher(vec2 p, float m) {
	return clamp(p, vec2(-m), vec2(m)) - p;
}

// n folhas de um monte em volta de "centro": deitam lado a lado numa direção geral
// (+-20 graus, com o pé para um lado ou para o outro), deslocadas de "espalha" px na
// perpendicular e um pouco para a frente ou para trás. A primeira fica por cima; as
// outras, um pouco menores, por baixo (nunca duas iguais lado a lado).
// O que as rodadas mostraram: folha solta de todo lado fazia leque (lia como flor), e
// espalhada em volta do centro não cabia na casa e acabava empilhada numa só.
vec4 folhas_em(vec4 acc, vec2 q, vec2 centro, int n, float tam, float espalha, int i, float px) {
	uint h = hash_cel(vec2(float(i), 3.0), 2711);
	float familia = rk(h, 1);
	float rumo = TAU * rk(h, 2);
	vec2 u0 = vec2(-sin(rumo), cos(rumo));
	vec2 p0 = vec2(-u0.y, u0.x);
	for (int k = 5; k >= 0; k--) {
		if (k >= n) {
			continue;
		}
		uint hk = hash_cel(vec2(float(i), float(k) + 10.0), 2713);
		float L = (k == 0) ? tam : tam * (0.8 + 0.14 * rk(hk, 0));
		L = min(L, 19.0);
		float W = L * (0.42 + 0.08 * rk(hk, 1));
		// 0 no meio, 1 e 3 de um lado, 2 do outro (3 mais para trás, 4 e 5 na ponta).
		float lado = (k == 0) ? 0.0 : ((k == 2) ? -1.0 : 1.0);
		float frente = (k == 3) ? -0.9 : ((k >= 4) ? 0.9 : (rk(hk, 2) - 0.5) * 1.0);
		vec2 c = centro + p0 * lado * espalha * (0.85 + 0.3 * rk(hk, 9)) + u0 * frente * L;
		float ang = rumo + (rk(hk, 3) - 0.5) * 1.2 + ((rk(hk, 8) < 0.5) ? 0.0 : PI);
		// A folha inteira (ponta e cabinho) cabe na casa: em vez de encolher a folha,
		// ela é empurrada para dentro (a ponta cortada pela célula seria uma linha reta).
		vec2 u = vec2(-sin(ang), cos(ang));
		c += recolher(c - u * L, 21.0) + recolher(c + u * (L + 4.0), 21.0);
		float torto = (rk(hk, 4) - 0.5) * 0.24;
		// Uma folha de outra árvore, às vezes, no meio do monte.
		float fam = (rk(hk, 5) < 0.15) ? fract(familia + 0.37) : familia;
		float forca = (k == 0) ? 1.0 : 0.8 + 0.2 * rk(hk, 7);
		acc = folha_em(acc, q, c, ang, L, W, torto, cor_folha(fam, rk(hk, 6)), forca, px);
	}
	return acc;
}

// Mancha de folhiço: folha podre já virando terra, embaixo do monte. Macia, sem
// contorno, de borda irregular, no tom do húmus.
vec4 folhico_em(vec4 acc, vec2 q, vec2 c, float R, float forca, int i) {
	uint h = hash_cel(vec2(float(i), 4.0), 2721);
	vec2 q0 = q + vec2(32.0 + float(i) * 64.0, 32.0);
	float onda = (rz(q0, 16.0, 1024.0, 2723) - 0.5) * 7.0 + (rz(q0, 8.0, 1024.0, 2725) - 0.5) * 2.5;
	float d = 1e9;
	for (int k = 0; k < 3; k++) {
		float a = TAU * (rk(h, k) * 0.3 + float(k) / 3.0);
		vec2 o = c + ((k == 0) ? vec2(0.0) : vec2(cos(a), sin(a)) * R * 0.32);
		vec2 ab = R * vec2(0.7 + 0.16 * rk(h, 3 + k), 0.54 + 0.12 * rk(h, 6 + k));
		d = min(d, sd_elipse(girar(q - o, a), ab));
	}
	// Nunca passa de um círculo (ondulado) de 21 px: a borda macia termina antes da
	// folga da célula.
	d = max(d + onda, length(q) - 21.0 + onda * 0.6);
	// No tom do húmus da base, na luz do chão: mais escuro que o chão, o folhiço virava
	// um halo escuro (um buraco a 50%); mais quente e claro, um brilho laranja.
	vec3 cor = HUMUS * (0.95 + 0.08 * rz(q0, 32.0, 1024.0, 2727));
	return sobre(acc, cor, (1.0 - smoothstep(-7.0, 4.0, d)) * 0.6 * forca);
}

// ---------- raízes e galho ----------

vec2 bez3(vec2 a, vec2 b, vec2 c, vec2 e, float t) {
	float s = 1.0 - t;
	return s * s * s * a + 3.0 * s * s * t * b + 3.0 * s * t * t * c + t * t * t * e;
}

// Distância a um cordão que corre pela curva a-b-c-e e afina de ra até re; devolve
// também o t (0..1), o ponto do eixo e o raio no ponto mais perto.
float sd_cordao(vec2 q, vec2 a, vec2 b, vec2 c, vec2 e, float ra, float re, out float t_m, out vec2 eixo_m, out float raio_m) {
	float melhor = 1e9;
	t_m = 0.0;
	eixo_m = a;
	raio_m = ra;
	vec2 p0 = a;
	for (int k = 1; k <= 14; k++) {
		vec2 p1 = bez3(a, b, c, e, float(k) / 14.0);
		vec2 pa = q - p0;
		vec2 ba = p1 - p0;
		float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
		float t = (float(k - 1) + hh) / 14.0;
		float raio = mix(ra, re, t);
		float dist = length(pa - ba * hh) - raio;
		if (dist < melhor) {
			melhor = dist;
			t_m = t;
			eixo_m = p0 + ba * hh;
			raio_m = raio;
		}
		p0 = p1;
	}
	return melhor;
}

// Quanto do cordão aparece no ponto t: some nas pontas e, se "mergulha" > 0, afunda
// no chão perto do meio e volta a sair (raiz que corre meio enterrada).
float aparece(float t, float mergulha) {
	float v = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.86, 1.0, t));
	return v * (1.0 - mergulha * (1.0 - smoothstep(0.0, 0.09, abs(t - 0.56))));
}

// Uma raiz (ou galho): sai do chão em a, corre pela curva até e e volta a afundar.
// Corpo redondo com a luz de cima à esquerda, contorno da própria cor (o galho, fino,
// não tem), sombra macia.
vec4 cordao_em(vec4 acc, vec2 q, vec2 a, vec2 b, vec2 c, vec2 e, float ra, float re, vec3 cor, bool contorno, float mergulha, float px) {
	float t;
	vec2 ex;
	float raio;
	float ts;
	vec2 es;
	float raio_s;
	float ds = sd_cordao(q - vec2(1.3, 1.6), a, b, c, e, ra, re, ts, es, raio_s);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-1.5, 2.5, ds)) * 0.2 * aparece(ts, mergulha));
	float d = sd_cordao(q, a, b, c, e, ra, re, t, ex, raio);
	float some = aparece(t, mergulha);
	vec2 v = (q - ex) / max(raio, 0.5);
	float luz = dot(v, LUZ);
	vec3 corpo = mix(sombra_de(cor) * 0.96, cor, smoothstep(-0.9, 0.2, luz));
	corpo = mix(corpo, realce_de(cor), 0.4 * smoothstep(0.3, 0.9, luz));
	if (contorno) {
		float esp = mix(1.0, 1.5, smoothstep(0.4, -0.4, luz));
		acc = sobre(acc, contorno_de(cor), cobre(d, px) * some);
		acc = sobre(acc, corpo, cobre(d + esp, px) * some);
	} else {
		acc = sobre(acc, corpo, cobre(d, px) * some);
	}
	return acc;
}

vec3 cor_raiz(int i) {
	// Castanho entre a lenha e a nogueira, puxado para o chão: a lenha pura, rosada contra
	// o verde, lia como graveto vermelho a 100%.
	vec3 c = mix(LENHA, NOGUEIRA, (i % 2 == 0) ? 0.45 : 0.7);
	return mix(c, CHAO, 0.26);
}

// Raiz comprida em S, quase de canto a canto da casa, com um ramo fino que sai do
// lado de fora da primeira curva.
vec4 raiz(vec4 acc, vec2 q, int i, float mergulha, float px) {
	uint h = hash_cel(vec2(float(i), 5.0), 2731);
	// Perto da diagonal (assim cabe comprida na casa), para um lado ou para o outro.
	float giro = ((rk(h, 0) < 0.5) ? 0.785 : 2.356) + (rk(h, 5) - 0.5) * 0.5;
	vec2 eixo = vec2(cos(giro), sin(giro));
	vec2 normal = vec2(-eixo.y, eixo.x);
	// A ponta grossa (raio 6 + contorno) tem de terminar antes da folga da célula: com
	// 20 px ela saía cortada reta; grossa num lado só e curta, parecia chifre: é um
	// cordão de espessura quase igual, que entra e sai do chão nas duas pontas.
	float comp = 18.5 / max(abs(eixo.x), abs(eixo.y));
	float s1 = (rk(h, 2) < 0.5 ? -1.0 : 1.0) * (6.0 + 4.0 * rk(h, 6));
	float s2 = -s1 * (0.6 + 0.5 * rk(h, 7));
	vec2 a = -eixo * comp;
	vec2 e = eixo * comp * 0.95;
	vec2 b = mix(a, e, 0.33) + normal * s1;
	vec2 c = mix(a, e, 0.66) + normal * s2;
	float ra = 4.6 + 0.8 * rk(h, 3);
	vec3 cor = cor_raiz(i);
	// O ramo: sai perto do primeiro terço, para o lado de fora da curva.
	vec2 r0 = bez3(a, b, c, e, 0.3);
	float lado = (s1 >= 0.0) ? 1.0 : -1.0;
	vec2 r_dir = normalize(eixo * 1.0 + normal * lado * 1.1);
	vec2 r3 = r0 + r_dir * (14.0 + 4.0 * rk(h, 4));
	vec2 r_n = vec2(-r_dir.y, r_dir.x) * lado;
	acc = cordao_em(acc, q, r0, mix(r0, r3, 0.33) + r_n * 2.0, mix(r0, r3, 0.66) - r_n * 1.5, r3, ra * 0.6, 1.0, cor * 0.97, true, 0.0, px);
	acc = cordao_em(acc, q, a, b, c, e, ra, ra * 0.6, cor, true, mergulha, px);
	return acc;
}

// Galho seco: fino, sem contorno, com uma forquilha curta.
vec4 galho(vec4 acc, vec2 q, int i, float px) {
	uint h = hash_cel(vec2(float(i), 6.0), 2741);
	float giro = 2.356 + (rk(h, 0) - 0.5) * 0.4;
	vec2 eixo = vec2(cos(giro), sin(giro));
	vec2 normal = vec2(-eixo.y, eixo.x);
	float comp = 21.0 / max(abs(eixo.x), abs(eixo.y));
	vec2 a = -eixo * comp;
	vec2 e = eixo * comp;
	vec2 b = mix(a, e, 0.33) + normal * 3.0;
	vec2 c = mix(a, e, 0.66) + normal * 2.0;
	vec3 cor = mix(mix(LENHA, NOGUEIRA, 0.5) * 1.08, CHAO, 0.2);
	vec2 f0 = bez3(a, b, c, e, 0.62);
	vec2 f3 = f0 + normalize(eixo + normal * 0.9) * 11.0;
	acc = cordao_em(acc, q, f0, mix(f0, f3, 0.33), mix(f0, f3, 0.66), f3, 1.5, 0.9, cor, false, 0.0, px);
	acc = cordao_em(acc, q, a, b, c, e, 2.3, 1.2, cor, false, 0.0, px);
	return acc;
}

// Musgo em cima de uma raiz: mancha macia, sem contorno, quase no tom do chão.
vec4 musgo_em(vec4 acc, vec2 q, vec2 c, float R, int i) {
	vec2 q0 = q + vec2(32.0 + float(i) * 64.0, 32.0);
	float onda = (rz(q0, 8.0, 1024.0, 2751) - 0.5) * 3.0;
	float d = length((q - c) / vec2(1.0, 0.75)) - R + onda;
	vec3 cor = mix(CHAO, MUSGO_MT, 0.35);
	vec3 corpo = mix(cor * 0.96, cor * 1.04, smoothstep(R, -R, dot(q - c, -LUZ)));
	return sobre(acc, corpo, (1.0 - smoothstep(-3.0, 2.0, d)) * 0.75);
}

// ---------- o atlas ----------

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	vec4 acc = vec4(0.0);
	uint h = hash_cel(vec2(float(i), 1.0), 2701);
	if (i < 6) {
		// Monte: folhiço que enche quase a casa, com 2 ou 3 folhas largas por cima.
		int n = 2 + i % 2;
		vec2 c = (vec2(rk(h, 1), rk(h, 2)) - 0.5) * 4.0;
		acc = folhico_em(acc, q, c, 19.5 + 2.0 * rk(h, 3), 1.0, i);
		acc = folhas_em(acc, q, c, n, 15.0 + 1.5 * rk(h, 0), 10.5, i, px);
	} else if (i < 8) {
		// Três ou duas folhas no chão limpo, sem folhiço (o folhiço sozinho virava um ponto escuro).
		acc = folhas_em(acc, q, vec2(0.0), 9 - i, 15.5, 10.5, i, px);
	} else if (i < 10) {
		// Uma folha grande (ou duas) no chão limpo, sem folhiço.
		acc = folhas_em(acc, q, vec2(0.0), i - 7, 16.0, 10.0, i, px);
	} else if (i < 12) {
		acc = raiz(acc, q, i, (i == 11) ? 0.9 : 0.0, px);
	} else if (i == 12) {
		// Raiz com folhiço e folhas presos de um lado.
		acc = folhico_em(acc, q, vec2(-7.0, 8.0), 14.0, 0.9, i);
		acc = raiz(acc, q, i, 0.0, px);
		acc = folhas_em(acc, q, vec2(-8.0, 8.0), 2, 12.5, 7.0, i, px);
	} else if (i == 13) {
		// Raiz meio enterrada com musgo em cima.
		acc = raiz(acc, q, i, 0.0, px);
		acc = musgo_em(acc, q, vec2(3.0, -2.0), 7.0, i);
	} else if (i == 14) {
		// Monte pequeno junto de uma raiz.
		acc = raiz(acc, q, i, 0.8, px);
		acc = folhico_em(acc, q, vec2(6.0, -6.0), 13.0, 0.9, i);
		acc = folhas_em(acc, q, vec2(6.0, -6.0), 3, 12.5, 8.0, i, px);
	} else {
		// Galho seco atravessado num folhiço pequeno.
		acc = folhico_em(acc, q, vec2(2.0, 2.0), 16.0, 1.0, i);
		acc = galho(acc, q, i, px);
		acc = folhas_em(acc, q, vec2(5.0, 5.0), 2, 13.0, 8.0, i, px);
	}
	// A célula termina transparente (4 px de folga), aconteça o que acontecer.
	acc *= 1.0 - smoothstep(26.0, 28.0, max(abs(q.x), abs(q.y)));
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

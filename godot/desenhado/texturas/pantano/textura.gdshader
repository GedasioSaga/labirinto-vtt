// Pântano: lama e musgo úmido vistos de cima, com poças de água parada e touceiras de
// junco. Lote 2 da onda 1.
// Base: a mesma família do Chão de floresta (mesma luz), puxada para a lama e o musgo
// oliva; manchas largas de lama encharcada, um relevo macio para o close e poucas
// pinceladas. O atlas (células de 2 casas) leva os marcos: duas poças largas e amorfas
// (elipses fundidas com folga larga e a borda ondulada por um ruído largo), uma
// touceira grande com taboa numa água rasa e duas touceiras na lama. A poça é um buraco
// com água: sombra do barranco e linha d'água em cima à esquerda, raso com lama e borda
// macia embaixo à direita, reflexo do céu em dois riscos deitados. O junco são poucas
// hastes firmes de alturas bem diferentes, algumas folhas dobradas para fora.
// Água contida: o #40707e do Meio-Termo turvado pelo chão e, no fundo, no valor do chão.
//
// O que as rodadas de 28/10 ensinaram (folha a 25%, 50%, 100% e 300%):
// - poça de 1,2 casa com contorno escuro em volta virava pílula azul, e com o brilho no
//   meio lia como seixo: o contorno fica só do lado do barranco;
// - água mais clara que o chão virava bolha azul a 25%: o fundo fica no valor do chão;
// - forma reconhecível repetida vira carimbo (baía funda, poça satélite sempre no mesmo
//   canto, ponta virada que lia como bicho, pílula diagonal paralela num grupo), e
//   forma redonda ou chata vira bolinha ou risquinho a 25%: amorfa, de proporção 1,6;
// - fio d'água fino no pé do junco virava tracinho azul a 50%;
// - junco baixo de ponta amarela lia como tufo de grama, e a ponta clara virava pontinho
//   a 25%; a ponta redonda do traço fazia uma bolinha escura no pé de cada haste.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta do Meio-Termo que não está na base (client/src/texturas/meioTermo/paleta.ts).
const vec3 MUSGO_MT = vec3(0.435, 0.490, 0.294); // #6f7d4b musgo
const vec3 AGUA_MT = vec3(0.251, 0.439, 0.494);  // #40707e água

// O chão: lama úmida e musgo úmido, na luz do Chão de floresta (luminância ~0,29).
// (Na rodada 6, ao lado do Chão de floresta, a lama puxava demais para o marrom.)
const vec3 LAMA = vec3(0.280, 0.292, 0.198);
const vec3 MUSGO_CHAO = vec3(0.240, 0.345, 0.214);
// Onde a lama está mais encharcada: 7% mais escura e um pouco mais fria.
const vec3 ENCHARCADO = vec3(0.228, 0.275, 0.192);
// Lama molhada da beira da poça e do pé do junco.
const vec3 BEIRA = vec3(0.226, 0.246, 0.176);
// A água parada: o #40707e com 30% do chão (turva). Com 15% ela lia como furo azul no
// chão escuro (rodada 2).
const vec3 AGUA = vec3(0.258, 0.403, 0.396);
// Lama vista pela água rasa, no lado da luz.
const vec3 LAMA_RASA = vec3(0.280, 0.322, 0.262);

// Junco: pé escuro e úmido, corpo no musgo, ponta pouco acima dele.
const vec3 JUNCO_PE = vec3(0.180, 0.232, 0.140);
const vec3 JUNCO_SECO = vec3(0.500, 0.465, 0.290);
// Taboa (a espiga do junco): castanho da nogueira puxado para a lama.
// (A nogueira pura puxava para o vermelho contra o verde e virava pontinho a 50%.)
const vec3 TABOA = vec3(0.385, 0.315, 0.220);

// ---------- base ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (4 casas), da lama ao musgo.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	// O ruído de 256 px tem só 2 x 2 células por ladrilho: com peso 0,6 a mancha de 4 casas
	// voltava a cada 8 e a base misturada ficava em 0,73 (rodada 9).
	float t = smoothstep(0.2, 0.8, n_g * 0.4 + n_m * 0.6);
	vec3 c = mix(LAMA, MUSGO_CHAO, t);
	// 2. Lama encharcada: manchas de 2 a 3 casas (ruído de 128 px, uma oitava, como o
	//    húmus do Chão de floresta: com 256 px as manchas caem numa grade de 8 casas).
	float e = rz(p + vec2(90.0, 30.0), 128.0, P, s + 3) * 0.8 + rz(p, 256.0, P, s + 4) * 0.2;
	c = mix(c, ENCHARCADO, 0.6 * smoothstep(0.46, 0.78, e));
	// 3. Relevo macio de meia casa e de 1/4 de casa: o close a 300% não fica liso.
	c *= 1.0 + 0.05 * (fz(p, 32.0, P, s + 6, 2) - 0.5) + 0.025 * (rz(p, 16.0, P, s + 8) - 0.5);
	if (qual == 1) {
		c = mix(c, LAMA, 0.06);
	} else if (qual == 2) {
		c *= vec3(0.985, 0.995, 1.01);
	}
	// 4. Pinceladas largas, uma por meia casa, todas na mesma direção.
	c *= 1.0 + 0.03 * pinceladas(p, P, px, s + 5, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 7);
	return c;
}

// ---------- poças ----------

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float lobo(vec2 q, vec2 c, vec2 ab, float a) {
	return sd_elipse(girar(q - c, -a), ab);
}

// A forma de cada poça (q em px do mundo; com escala 1 a água vai até +-50 px e a beira
// termina antes dos 56 da folga). Lobos de tamanhos bem diferentes fundidos com folga
// larga (contorno de ameba calma, sem dedo nem entalhe: a baía funda da rodada 2 virava
// peça de quebra-cabeça a 50%) e a borda ondulada por um ruído largo.
// "c" devolve o centro do lobo maior e "ab" e "ang" a forma dele (para o reflexo).
float sd_poca(vec2 q, int forma, out vec2 c, out vec2 ab, out float ang) {
	float d;
	float irreg;
	if (forma == 0) {
		// Grande, deitada, com um braço para baixo à esquerda e um calombo em cima à
		// esquerda. Sem baía funda: a da rodada 4 era uma marca que o olho achava de novo.
		c = vec2(-8.0, 2.0);
		ab = vec2(32.0, 23.0);
		ang = -0.25;
		d = lobo(q, c, ab, ang);
		d = smin(d, lobo(q, vec2(22.0, -8.0), vec2(22.0, 17.0), 0.5), 10.0);
		d = smin(d, lobo(q, vec2(18.0, 22.0), vec2(19.0, 12.0), -0.2), 12.0);
		d = smin(d, lobo(q, vec2(-36.0, 20.0), vec2(14.0, 9.0), -0.6), 8.0);
		d = smin(d, lobo(q, vec2(-30.0, -22.0), vec2(13.0, 9.0), 0.3), 8.0);
		irreg = 10.0;
	} else if (forma == 1) {
		// A segunda larga: amorfa como a primeira, com outros lobos e um pouco inclinada.
		// O que não deu certo: comprida e reta na diagonal (rodada 10), todas saíam
		// paralelas num grupo (o app não gira o detalhe); redonda (13), bolinha a 25%;
		// com uma ponta virada (14), bicho de rabo para cima; rim deitado e chato (15),
		// pilha de risquinhos a 25%. Amorfa e de proporção 1,6 não fica na memória.
		c = vec2(4.0, -2.0);
		ab = vec2(30.0, 19.0);
		ang = -0.3;
		d = lobo(q, c, ab, ang);
		d = smin(d, lobo(q, vec2(-24.0, 9.0), vec2(18.0, 14.0), 0.4), 12.0);
		d = smin(d, lobo(q, vec2(22.0, 18.0), vec2(16.0, 10.0), 0.2), 10.0);
		d = smin(d, lobo(q, vec2(-8.0, -22.0), vec2(13.0, 8.0), -0.1), 10.0);
		// Sem a poça pequena solta: sempre no mesmo canto, o par virava carimbo a 100%
		// (rodada 12), e menor que isso virava pontinho a 50%.
		irreg = 8.0;
	} else {
		// Rasa, no pé da touceira: larga e alta (deitada e fina, virava tracinho azul a 50%).
		c = vec2(2.0, 24.0);
		ab = vec2(25.0, 15.0);
		ang = -0.12;
		d = lobo(q, c, ab, ang);
		d = smin(d, lobo(q, vec2(-22.0, 22.0), vec2(14.0, 11.0), 0.4), 10.0);
		d = smin(d, lobo(q, vec2(24.0, 14.0), vec2(13.0, 10.0), -0.45), 10.0);
		irreg = 7.0;
	}
	vec2 q0 = q + vec2(160.0 + float(forma) * 230.0, 190.0);
	int sd = 4100 + forma * 7;
	// Duas ondas na borda: uma larga (baías e cabos de meia casa) e uma média (a beira
	// não sai lisa como seixo). Nenhuma fina: a 50% viraria serrilhado.
	float onda = (rz(q0, 56.0, 1024.0, sd) - 0.5) * irreg + (rz(q0, 24.0, 1024.0, sd + 1) - 0.5) * irreg * 0.45;
	return d + onda;
}

// Uma poça é um buraco com água, não uma pedra: a luz vem de cima à esquerda, então o
// barranco de cima à esquerda faz sombra na água e tem a linha d'água firme; o lado de
// baixo à direita não tem contorno: o raso mostra a lama, a beira acende num brilho fino
// e a água some macia na lama molhada. (Rodada 3: contorno escuro em volta toda e brilho
// no meio liam como seixo.) O reflexo do céu são dois riscos deitados, macios, no mesmo
// rumo em todas as poças.
vec4 poca_em(vec4 acc, vec2 q, int forma, float px) {
	vec2 c;
	vec2 ab;
	float ang;
	float d = sd_poca(q, forma, c, ab, ang);
	// A mesma forma vista de um ponto mais perto da luz: > 0 = entre este ponto e a luz há
	// barranco (o lado de cima à esquerda da água).
	float d_luz = sd_poca(q + LUZ * 7.0, forma, c, ab, ang);
	float d_luz2 = sd_poca(q + LUZ * 3.0, forma, c, ab, ang);
	float sombra = smoothstep(-3.0, 3.0, d_luz);
	float lado_sombra = smoothstep(-2.0, 2.0, d_luz2);
	// 1. Beira molhada: a lama escurece em volta, macia.
	acc = sobre(acc, BEIRA, (1.0 - smoothstep(-1.0, 6.0, d)) * 0.36);
	// 2. A água.
	// Funda, a água fica no valor do chão e se lê pela cor (mais clara que o chão, cada
	// poça virava uma bolha azul a 25% na rodada 7); o céu a devolve ao #40707e turvo.
	vec3 agua = AGUA * 0.78;
	float raso = 1.0 - smoothstep(0.0, 9.0, -d);
	agua = mix(agua, LAMA_RASA, 0.42 * raso * (1.0 - sombra));
	agua = mix(agua, sombra_de(AGUA) * 0.8, 0.62 * sombra);
	vec2 cs = c - LUZ * ab.y * 0.3;
	float ceu = 1.0 - smoothstep(-12.0, 10.0, lobo(q, cs, ab * vec2(0.6, 0.45), ang));
	agua = mix(agua, AGUA * 0.96, 0.5 * ceu * (1.0 - sombra));
	// O céu: dois riscos deitados, longe da beira.
	vec2 rr = girar(q - cs, 0.1);
	float r1 = sd_elipse(rr - vec2(-ab.x * 0.12, -2.0), vec2(ab.x * 0.38, 1.4));
	float r2 = sd_elipse(rr - vec2(ab.x * 0.16, 4.5), vec2(ab.x * 0.2, 1.1));
	float risco = max((1.0 - smoothstep(-1.0, 2.5, r1)) * 0.3, (1.0 - smoothstep(-1.0, 2.0, r2)) * 0.2);
	agua = mix(agua, realce_de(AGUA), risco * smoothstep(4.0, 10.0, -d));
	// O brilho da beira do lado da luz: um fio claro logo dentro da água.
	float brilho = (1.0 - smoothstep(0.6, 2.4, -d)) * (1.0 - lado_sombra);
	// (Com 0,4 a beira acesa fazia cada poça ler como bolha clara a 25%.)
	agua = mix(agua, realce_de(mix(AGUA, LAMA_RASA, 0.4)), 0.24 * brilho);
	// Borda macia do lado da luz (2 px), firme do lado do barranco.
	float a_agua = mix(clamp(0.5 - d / max(px, 2.2), 0.0, 1.0), cobre(d, px), lado_sombra);
	acc = sobre(acc, agua, a_agua);
	// 3. A linha d'água, só do lado do barranco em sombra.
	float linha = (1.0 - smoothstep(0.4, 1.6, abs(d + 0.6))) * lado_sombra;
	acc = sobre(acc, mix(contorno_de(AGUA), BEIRA, 0.3), linha * 0.85);
	return acc;
}

// ---------- junco ----------

// Uma touceira de junco com o pé em pe0: n hastes firmes (até 8) que saem de perto do
// mesmo pé e sobem quase retas, de alturas bem diferentes (uma é a mais alta); duas ou
// três são folhas mais baixas que se dobram para fora. Sem contorno: o traço é o
// desenho. Pé escuro e úmido, corpo no musgo. Com "taboa", a mais alta leva a espiga.
vec4 junco_em(vec4 acc, vec2 q, vec2 pe0, float alto, int n, float abre, int i, int j, bool taboa, float px) {
	uint h = hash_cel(vec2(float(i), float(j) + 20.0), 4201);
	// 1. Lama molhada no pé: mancha macia e larga (um traço deitado vira tracinho a 50%).
	vec2 dq = (q - pe0 - vec2(2.5, 1.5)) / vec2(abre * 1.5 + 6.0, abre * 0.9 + 5.0);
	float dm = length(dq) - 1.0;
	acc = sobre(acc, BEIRA, (1.0 - smoothstep(-0.7, 0.6, dm)) * 0.34);
	float inclina = (rk(h, 0) - 0.5) * 0.2;
	int alta = int(rk(h, 1) * float(n) * 0.999);
	// Perto do tom do chão, como o tufo da grama: a 25% a ponta clara virava pontinho.
	vec3 c_meio = MUSGO_MT * 0.74;
	vec3 c_ponta = MUSGO_MT * 0.96;
	for (int b = 0; b < 8; b++) {
		if (b >= n) {
			break;
		}
		uint hb = hash_cel(vec2(float(i * 8 + j), float(b)), 4203);
		float lado = (float(b) - float(n - 1) * 0.5) / max(float(n - 1) * 0.5, 1.0);
		// Pés espalhados sem passo regular (passo igual vira pente).
		vec2 pe = pe0 + vec2(lado * abre + (rk(hb, 0) - 0.5) * abre * 0.8, (rk(hb, 1) - 0.5) * 3.0);
		bool folha = (b != alta) && (rk(hb, 7) < 0.3);
		float altura = (b == alta) ? alto : alto * (0.5 + 0.38 * rk(hb, 2)) * (1.0 - 0.15 * abs(lado));
		float ang = lado * 0.2 + inclina + (rk(hb, 3) - 0.5) * 0.22;
		float dobra = 1.5;
		if (folha) {
			// Folha: mais baixa e dobrada para fora.
			altura *= 0.7;
			ang = sign(lado + 0.01) * (0.45 + 0.25 * rk(hb, 4)) + inclina;
			dobra = 2.3;
		}
		vec2 u0 = vec2(sin(ang * 0.5), -cos(ang * 0.5));
		vec2 u1 = vec2(sin(ang * dobra), -cos(ang * dobra));
		vec2 meio = pe + u0 * altura * 0.6;
		vec2 ponta = meio + u1 * altura * 0.4;
		float w0 = folha ? 2.0 : 1.8;
		float d1 = sd_traco(q, pe, meio, w0, 1.3);
		float d2 = sd_traco(q, meio, ponta, 1.3, 0.45);
		float a = cobre(min(d1, d2), px);
		if (a > 0.0) {
			float t1 = dot(q - pe, meio - pe) / max(dot(meio - pe, meio - pe), 1e-4) * 0.6;
			float t2 = 0.6 + clamp(dot(q - meio, ponta - meio) / max(dot(ponta - meio, ponta - meio), 1e-4), 0.0, 1.0) * 0.4;
			float hh = (d1 < d2) ? t1 : t2;
			// A haste sai de dentro da lama: o pé some (a ponta redonda do traço, escura,
			// virava uma bolinha no pé de cada haste a 300%).
			a *= smoothstep(-0.01, 0.07, hh);
			hh = clamp(hh, 0.0, 1.0);
			vec3 cor = mix(JUNCO_PE, c_meio, smoothstep(0.0, 0.4, hh));
			cor = mix(cor, c_ponta, smoothstep(0.5, 1.0, hh));
			if (rk(hb, 5) < 0.2) {
				cor = mix(cor, JUNCO_SECO, 0.35 * smoothstep(0.4, 1.0, hh));
			}
			cor *= 0.94 + 0.1 * rk(hb, 6);
			acc = sobre(acc, cor, a);
		}
		if (taboa && b == alta) {
			// A espiga: um charuto castanho na parte de cima da haste, com a luz à esquerda.
			vec2 e0 = mix(meio, ponta, 0.08);
			vec2 e1 = mix(meio, ponta, 0.62);
			float dt = sd_traco(q, e0, e1, 2.5, 2.3);
			float luz_t = clamp((q.x - mix(e0.x, e1.x, 0.5)) / 2.5, -1.0, 1.0);
			vec3 corpo = mix(realce_de(TABOA), sombra_de(TABOA), 0.5 + 0.45 * luz_t);
			acc = sobre(acc, contorno_de(TABOA), cobre(dt, px));
			acc = sobre(acc, corpo, cobre(dt + 1.0, px));
		}
	}
	return acc;
}

// ---------- o atlas (4 células de 2 casas: q vai de -64 a 64) ----------

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	vec4 acc = vec4(0.0);
	if (i == 0) {
		// Poça grande, com uma touceira na beira de baixo à esquerda que sobe por cima da
		// água (a ponta da folha cortada pela célula seria uma linha reta: o pé fica embaixo).
		acc = poca_em(acc, q, 0, px);
		acc = junco_em(acc, q, vec2(-26.0, 26.0), 54.0, 6, 7.0, i, 0, false, px);
	} else if (i == 1) {
		// A segunda poça larga, sem junco.
		acc = poca_em(acc, q, 1, px);
	} else if (i == 2) {
		// Touceira grande com taboa dentro de uma água rasa, e outra menor ao lado.
		acc = poca_em(acc, q, 2, px);
		acc = junco_em(acc, q, vec2(-8.0, 22.0), 60.0, 7, 8.0, i, 0, true, px);
		acc = junco_em(acc, q, vec2(23.0, 16.0), 38.0, 4, 5.0, i, 1, false, px);
	} else {
		// Duas touceiras de tamanhos diferentes na lama (o fio d'água no pé, na rodada 4,
		// virava tracinho azul a 50%).
		acc = junco_em(acc, q, vec2(-16.0, 18.0), 54.0, 6, 7.0, i, 0, false, px);
		acc = junco_em(acc, q, vec2(24.0, 30.0), 32.0, 4, 4.5, i, 1, false, px);
	}
	// A célula termina transparente (4 px de folga), aconteça o que acontecer.
	acc *= 1.0 - smoothstep(56.0, 60.0, max(abs(q.x), abs(q.y)));
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

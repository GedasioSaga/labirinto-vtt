// POÇA vista de cima (onda 3, lote 8; CONTRATO.md, seção 9). Carimbo rente ao chão: sem
// sombra (é do chão), o pé no meio da imagem e o espelho diagonal (o padrão), então as 4
// formas viram 8.
//
// A técnica vem da poça do Pântano aprovado (texturas/pantano/, lote 2): uma poça é um
// buraco com água, não uma pedra nem um domo. A luz vem de cima à esquerda, então o barranco
// de cima à esquerda faz sombra na água e tem a linha d'água firme; o lado de baixo à direita
// não tem contorno: o raso clareia (a lama do fundo acende), a beira acende num fio contido e
// a água some macia na lama molhada. Em volta, a terra molhada escurece o chão que estiver
// embaixo (grama, terra, caminho, pântano), cheia no primeiro terço e fundindo no resto. O
// céu é um lençol largo e chato ao longo da poça, fora da sombra do barranco. A água deixa
// passar um pouco do chão de baixo, com a cor compensada para a grama: o mesmo carimbo
// escurece no Pântano e fica barrento na terra. Nada de ondinha, anel ou brilho pontilhado.
//
// As 4 formas (o espelho diagonal dá 8): 1 = a de hoje no tamanho, deitada e amorfa;
// 2 = a dupla (uma grande e uma pequena, com a ponte de lama); 3 = quase seca (pouca água,
// a beira mais larga, mais turva); 4 = comprida e funda, mais escura e um pouco mais azul.
//
// q em unidades do tamanho, a partir do meio da imagem (y para baixo). O desenho é feito em
// px do mundo (Q = q x unidade_mundo; no mapa de referência a poça tem 124 px, 1,9 casa).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// Paleta do Meio-Termo que não está na base (client/src/texturas/meioTermo/paleta.ts).
const vec3 AGUA_MT = vec3(0.251, 0.439, 0.494); // #40707e água
// A água do Pântano aprovado: o #40707e com 30% do chão (turva).
const vec3 AGUA_PANTANO = vec3(0.258, 0.403, 0.396);
// A água da poça: a do Pântano, um pouco mais clara e com o azul um pouco abaixo do verde.
// (Rodada 1: a do Pântano chapada, sobre a grama clara, lia como laje escura; rodadas 8 a
// 10: com mais #40707e, azul demais sobre o Pântano: a água que deixa passar o chão perde
// mais verde que azul num chão escuro, B passava de G e a poça virava pedrinha azul a 25%.)
const vec3 AGUA = vec3(0.262, 0.408, 0.386);
// O fundo de lama visto pela água rasa, no lado da luz.
const vec3 LAMA_RASA = vec3(0.380, 0.400, 0.320);
// A terra molhada da beira: um marrom neutro e escuro, para escurecer a grama, a terra e o
// caminho do mesmo jeito (o oliva do Pântano esverdeava a terra).
const vec3 BEIRA = vec3(0.235, 0.222, 0.155);
// Quanto a lama do fundo cobre o chão de baixo da água.
const float LAMA_DO_FUNDO = 0.5;

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float lobo(vec2 q, vec2 c, vec2 ab, float a) {
	return sd_elipse(girar(q - c, -a), ab);
}

// A forma da água (Q em px do mundo, distância negativa dentro). Lobos de tamanhos bem
// diferentes fundidos com folga larga e a borda ondulada por dois ruídos largos (nenhum fino:
// a 50% viraria serrilhado). Amorfa e de proporção perto de 1,6, como a do Pântano: redonda
// vira bolinha a 25%, chata vira risquinho.
float sd_agua(vec2 q, int k) {
	float d;
	float irreg;
	if (k == 0) {
		// Forma 1, a de hoje no tamanho: deitada, amorfa, um braço curto embaixo à esquerda.
		// (Rodada 4: com o lobo da direita alto, a forma lia como feijão.)
		// (Rodada 5: com a borda esquerda reta, pão; rodada 6: com o topo reto, lancheira. O
		// lobo da direita sobe um pouco, com uma sela macia, sem o calombo do feijão.)
		d = lobo(q, vec2(-6.0, 3.0), vec2(35.0, 19.0), -0.2);
		d = smin(d, lobo(q, vec2(25.0, -6.0), vec2(19.0, 14.0), 0.35), 9.0);
		d = smin(d, lobo(q, vec2(-33.0, 12.0), vec2(14.0, 10.0), -0.6), 12.0);
		d = smin(d, lobo(q, vec2(11.0, 16.0), vec2(18.0, 10.0), 0.15), 10.0);
		irreg = 10.0;
	} else if (k == 1) {
		// A dupla: uma grande e, separada por uma ponte de lama, uma bem menor embaixo à
		// direita (um grande e um pequeno; par igual lado a lado vira carimbo).
		d = lobo(q, vec2(-12.0, -8.0), vec2(32.0, 21.0), 0.3);
		d = smin(d, lobo(q, vec2(-34.0, 6.0), vec2(15.0, 11.0), -0.3), 10.0);
		d = smin(d, lobo(q, vec2(10.0, -20.0), vec2(17.0, 11.0), 0.55), 10.0);
		// (Rodada 4: o satélite de um lobo só lia como semente.)
		float s = lobo(q, vec2(31.0, 27.0), vec2(16.0, 10.0), -0.35);
		s = smin(s, lobo(q, vec2(42.0, 20.0), vec2(10.0, 8.0), 0.5), 10.0);
		s = smin(s, lobo(q, vec2(22.0, 32.0), vec2(9.0, 6.0), 0.1), 8.0);
		d = min(d, s);
		irreg = 7.0;
	} else if (k == 2) {
		// Quase seca: pouca água e muita lama em volta (a beira desta é a mais larga).
		// (Rodada 4: com dois lobos, ovo; rodada 5: o lobo pequeno embaixo à direita, um pé
		// que lia como cabeça de bicho.)
		d = lobo(q, vec2(4.0, 0.0), vec2(25.0, 14.0), -0.45);
		d = smin(d, lobo(q, vec2(-14.0, 9.0), vec2(15.0, 10.0), 0.25), 10.0);
		d = smin(d, lobo(q, vec2(-4.0, -10.0), vec2(14.0, 8.0), 0.1), 10.0);
		irreg = 7.0;
	} else {
		// Comprida e funda, na diagonal, com lobos para os dois lados.
		d = lobo(q, vec2(-4.0, 0.0), vec2(42.0, 21.0), 0.42);
		d = smin(d, lobo(q, vec2(-28.0, -20.0), vec2(19.0, 14.0), 0.1), 12.0);
		d = smin(d, lobo(q, vec2(26.0, 22.0), vec2(19.0, 13.0), 0.7), 12.0);
		// (Rodada 5: este lobo alto e estreito fazia o calcanhar de uma bota.)
		d = smin(d, lobo(q, vec2(10.0, -11.0), vec2(21.0, 10.0), 0.3), 14.0);
		irreg = 8.0;
	}
	vec2 q0 = q + vec2(300.0 + float(k) * 211.0, 260.0);
	int sd = semente * 31 + k * 7;
	float onda = (rz(q0, 52.0, 1024.0, sd) - 0.5) * irreg + (rz(q0, 22.0, 1024.0, sd + 1) - 0.5) * irreg * 0.45;
	return d + onda;
}

// O eixo do lobo maior de cada forma: centro (x, y), ângulo e meio comprimento, em px do
// mundo. Os riscos do céu correm ao longo dele (no espelho, o eixo vira junto).
vec4 eixo_da_agua(int k) {
	if (k == 0) {
		return vec4(-2.0, 2.0, -0.12, 44.0);
	} else if (k == 1) {
		return vec4(-12.0, -8.0, 0.3, 34.0);
	} else if (k == 2) {
		return vec4(0.0, 3.0, -0.5, 26.0);
	}
	return vec4(0.0, 0.0, 0.42, 48.0);
}

// Quanto a terra molhada passa da água, em px do mundo: varia em volta (a beira não é anel).
float largura_da_beira(vec2 q, int k) {
	vec2 q0 = q + vec2(120.0, 410.0 + float(k) * 157.0);
	float n = smoothstep(0.2, 0.8, rz(q0, 28.0, 1024.0, semente * 31 + 50 + k));
	return (k == 2) ? mix(9.0, 22.0, n) : mix(3.5, 13.0, n);
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	float W = unidade_mundo;
	vec2 Q = q * W;
	float pxw = px * W;
	float d = sd_agua(Q, k);
	// A mesma forma vista de um ponto mais perto da luz: > 0 = entre este ponto e a luz há
	// barranco (o lado de cima à esquerda da água).
	float d_luz2 = sd_agua(Q + LUZ * 3.0, k);
	float lado_sombra = smoothstep(-2.0, 2.0, d_luz2);
	// Quanta água há indo para a luz (a) e indo para o outro lado (b), até 36 px: a = 0 encostado
	// no barranco de cima à esquerda, b = 0 encostado na beira de baixo à direita. Vale para
	// qualquer forma, a dupla incluída.
	float a = 0.0;
	float b = 0.0;
	for (int i = 1; i <= 6; i++) {
		float s = 6.0 * float(i);
		a += 1.0 - smoothstep(-2.0, 2.0, sd_agua(Q + LUZ * s, k));
		b += 1.0 - smoothstep(-2.0, 2.0, sd_agua(Q - LUZ * s, k));
	}
	a /= 6.0;
	b /= 6.0;
	float perto_barranco = 1.0 - smoothstep(0.0, 0.45, a);
	float perto_raso = 1.0 - smoothstep(0.0, 0.5, b);

	vec4 acc = vec4(0.0);
	// 1. A terra molhada: escurece o chão em volta e cai devagar até sumir.
	float w = largura_da_beira(Q, k);
	// A terra molhada fica cheia no primeiro terço e funde no chão no resto. (Rodada 3: só o
	// degradê largo lia como sombra borrada embaixo de um objeto saltado; rodada 4: a faixa
	// chapada com a borda de 4 px virava um adesivo.)
	float faixa = 1.0 - smoothstep(w * 0.3, w + 2.0, d);
	// Por baixo da água, a lama do fundo: metade do chão de baixo ainda passa (ver o passo 2).
	float fundo_de_lama = 1.0 - smoothstep(-3.0, 0.0, d);
	acc = sobre(acc, BEIRA, max(0.32 * faixa, LAMA_DO_FUNDO * fundo_de_lama));

	// 2. A água. Como num buraco, não num domo: escura junto do barranco de cima à esquerda
	// (a sombra dele), funda no meio, clara no raso de baixo à direita, onde a luz entra e a
	// lama do fundo aparece. (Rodada 2: com o céu claro encostado no barranco, a poça lia
	// como almofada em relevo.) A profundidade sai da forma borrada (média de 4 pontos a
	// 9 px): direto da distância, o encontro de dois lobos virava um vinco.
	float db = 0.25 * (sd_agua(Q + vec2(9.0, 0.0), k) + sd_agua(Q - vec2(9.0, 0.0), k)
			+ sd_agua(Q + vec2(0.0, 9.0), k) + sd_agua(Q - vec2(0.0, 9.0), k));
	float fundo = smoothstep(2.0, 26.0, -db);
	vec3 meio = AGUA * 0.98;
	vec3 funda = AGUA * 0.80;
	// O raso no lado da luz: mais claro que o meio (o fundo de lama acende pela água); com a
	// lama só, ele ficava no valor do meio e a poça não abria (rodada 3).
	vec3 rasa = mix(AGUA * 1.18, LAMA_RASA, 0.4);
	float turva = 0.0;
	if (k == 2) {
		// Quase seca: mais lama vista pela água e menos fundo.
		fundo *= 0.55;
		turva = 0.3;
	} else if (k == 3) {
		// A funda: mais escura no meio e um pouco mais azul.
		funda = mix(AGUA, AGUA_MT, 0.5) * 0.70;
	}
	vec3 agua = mix(meio, funda, fundo);
	agua = mix(agua, rasa, 0.85 * perto_raso);
	agua = mix(agua, LAMA_RASA, turva);
	agua = mix(agua, sombra_de(AGUA_PANTANO) * 0.82, 0.6 * perto_barranco);
	// O céu: um ou dois riscos largos e chatos, ao longo da poça, fora da sombra do barranco.
	// Chatos de propósito: o brilho que acompanha o contorno é o de um domo.
	vec4 e = eixo_da_agua(k);
	vec2 rr = girar(Q - e.xy, -e.z);
	// Um lençol largo e macio; o segundo, fraco, mais perto do raso. (Rodada 4: dois do mesmo
	// peso com o fundo escuro entre eles viravam listra no close; rodada 7: um risco estreito
	// no eixo, entre o meio escuro e o raso claro, fazia um sulco de grão de café a 100%.)
	float r1 = sd_elipse(rr - vec2(-e.w * 0.1, -3.0), vec2(e.w * 0.56, 10.0));
	float r2 = sd_elipse(rr - vec2(e.w * 0.3, 10.0), vec2(e.w * 0.22, 4.0));
	float ceu = max((1.0 - smoothstep(-9.0, 9.0, r1)) * 0.34, (1.0 - smoothstep(-3.0, 5.0, r2)) * 0.12);
	ceu *= (1.0 - perto_barranco) * smoothstep(3.0, 9.0, -d);
	agua = mix(agua, realce_de(mix(AGUA, AGUA_MT, 0.25)), ceu);
	// A beira do lado de baixo à direita pega luz: um fio contido logo dentro da água.
	float brilho = (1.0 - smoothstep(0.6, 2.6, -d)) * (1.0 - lado_sombra);
	agua = mix(agua, realce_de(mix(AGUA_MT, LAMA_RASA, 0.4)), 0.34 * brilho);
	// Um relevo largo na água, para o close a 300% não ficar chapado.
	agua *= 1.0 + 0.04 * (rz(Q + vec2(512.0), 26.0, 1024.0, semente + 9) - 0.5);
	agua *= grao(Q + vec2(512.0), 1024.0, semente + 11);
	// A água deixa passar um pouco do chão de baixo (já escurecido pela lama do fundo): o
	// carimbo é um só para todos os chãos, e a água chapada ficava mais clara que o Pântano
	// (pedrinha azul a 25%, rodada 8) ou escura demais na grama (laje, rodada 1). Mais
	// transparente no raso, quase cheia na sombra do barranco. (O céu cheio cobria o meio todo
	// e anulava a conta, rodada 9.) A cor guardada é compensada para que, sobre a grama, saia
	// exatamente "agua": num chão mais escuro ela escurece, num mais claro clareia e esquenta.
	float opaca = mix(0.50, 0.66, fundo);
	opaca = mix(opaca, 0.9, perto_barranco * 0.8);
	vec3 grama_de_baixo = mix(GRAMA, BEIRA, LAMA_DO_FUNDO);
	vec3 guardada = clamp((agua - (1.0 - opaca) * grama_de_baixo) / opaca, 0.0, 1.0);
	// Borda macia do lado da luz (2 px do mundo), firme do lado do barranco.
	float a_agua = mix(clamp(0.5 - d / max(pxw, 2.2), 0.0, 1.0), cobre(d, pxw), lado_sombra);
	acc = sobre(acc, guardada, a_agua * opaca);
	// 3. A linha d'água, só do lado do barranco em sombra (cerca de 2 px do mundo).
	float linha = (1.0 - smoothstep(0.4, 1.6, abs(d + 0.6))) * lado_sombra;
	acc = sobre(acc, mix(contorno_de(AGUA), BEIRA, 0.3), linha * 0.85);

	// A imagem termina transparente (3 px da imagem de folga), aconteça o que acontecer.
	float meia = 0.5 * sprite_lado / sprite_unidade;
	acc *= 1.0 - smoothstep(meia - 5.0 * px, meia - 3.0 * px, max(abs(q.x), abs(q.y)));
	return vec4(acc.a > 0.002 ? acc.rgb / acc.a : BEIRA, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

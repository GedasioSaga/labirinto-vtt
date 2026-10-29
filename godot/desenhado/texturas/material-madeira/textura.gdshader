// Madeira, o MATERIAL dos móveis (onda 4, lote 9, piloto). CONTRATO.md seção 10.
//
// A superfície de uma tábua de móvel, vista de cima, em cinza (0,5 = o tom escolhido:
// carvalho, nogueira, pinho, cerejeira ou madeira velha). O app tinge e lê em (u, v)
// da peça; a tábua, a fresta, a emenda de topo e o tom de cada tábua continuam do motor
// de hoje, e cada tábua lê uma janela sorteada desta imagem.
//
// A crítica que criou o estilo: "tá muito detalhado, cheio de bolinhas, fica estranho,
// faz algo mais bonito". Então o veio é feito de POUCAS faixas longas e calmas:
//   - faixas de TOM largas (0,25 a 0,5 casa), claras e escuras, que correm juntas ao
//     longo da tábua, com a mesma onda larga (os anéis cortados de uma tora);
//   - por cima, poucas linhas escuras e macias (a madeira de fim de anel), que somem e
//     voltam em trechos de 2 a 4 casas.
// Nada de nó, risquinho nem granulado. Conversa com o convés aprovado (2 linhas macias
// por tábua que somem e voltam), em escala de móvel: uma tábua de mesa tem 0,2 casa,
// então cabe uma linha, às vezes duas, e o resto é tom.
//
// Imagem de 8 x 2 casas (1024 x 256 px): ao longo, 8 casas sem repetir, para o aparador
// e o balcão esticados não mostrarem o período; atravessando, 2 casas (umas 10 tábuas
// de mesa; cada tábua cai numa janela sorteada).
//
// Todo ruído de uma dimensão aqui é de VALOR (md_valor): o de gradiente da base vale
// 0,5 em cada nó da grade, e as faixas se encontravam todas no mesmo ponto a cada 128 px
// (a primeira rodada mostrou o ritmo).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/material.gdshaderinc"

const int MD_LINHAS = 13;

// Ruído de valor em 1 dimensão, periódico a cada "per" células: 0..1, suave (quíntica).
float md_valor(float t, float per, uint h) {
	float i = floor(t);
	float f = t - i;
	float u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	float a = u01(hash_u(h + uint(int(mod(i, per)) + 4096) * 2246822519u));
	float b = u01(hash_u(h + uint(int(mod(i + 1.0, per)) + 4096) * 2246822519u));
	return mix(a, b, u);
}

// Ao longo de u, a cada "cel" px, com um deslocamento próprio (as grades de duas ondas
// não caem no mesmo lugar): -1..1.
float md_onda(float x, float cel, vec2 P, uint h) {
	float desloca = u01(hash_u(h + 977u));
	return 2.0 * md_valor(x / cel + desloca, P.x / cel, h) - 1.0;
}

float pintar_material(vec2 p, vec2 P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	uint hs = hash_u(uint(s) + 31u);
	float x = p.x;
	float y = p.y;

	// 1. A onda comum: tudo desvia junto, devagar (os anéis correm juntos).
	float comum = 8.0 * md_onda(x, 256.0, P, hs + 1u) + 2.5 * md_onda(x, 128.0, P, hs + 2u);
	float yc = y + comum;

	// 2. As faixas de tom, atravessando: a cada 32 px um valor, suave, e duas camadas que
	//    se revezam devagar ao longo (a faixa larga se estreita e muda de tom adiante).
	float tom_a = md_valor(yc / 32.0, P.y / 32.0, hs + 10u);
	float tom_b = md_valor(yc / 32.0 + 0.5, P.y / 32.0, hs + 11u);
	float troca = 0.5 + 0.5 * md_onda(x, 512.0, P, hs + 12u);
	float tom = mix(tom_a, tom_b, smoothstep(0.2, 0.8, troca));
	float fino = md_valor(yc / 16.0 + 0.25, P.y / 16.0, hs + 13u);
	float v = 0.09 * (tom - 0.5) + 0.03 * (fino - 0.5);

	// 3. O campo: manchas muito largas e fracas (2 a 4 casas ao longo).
	float larga = fbm_p(vec2(x / 512.0, y / 128.0) + vec2(0.37, 0.61), vec2(P.x / 512.0, P.y / 128.0), s + 3, 2);
	v += 0.03 * (larga - 0.5);

	// 4. As linhas escuras: poucas, macias, de um lado mais longo que o outro, e cada uma
	//    some por trechos (não vira listra contínua).
	float escuro = 0.0;
	float brilho = 0.0;
	for (int b = 0; b < MD_LINHAS; b++) {
		uint h = hash_u(hs + uint(b) * 7919u + 101u);
		float y0 = (float(b) + 0.15 + 0.7 * u01(hash_u(h + 1u))) * (P.y / float(MD_LINHAS));
		float yb = y0 + 3.0 * md_onda(x, 128.0, P, h + 2u);
		float dy = mod(yc - yb + 0.5 * P.y, P.y) - 0.5 * P.y;
		float meia = (1.8 + 1.8 * u01(hash_u(h + 3u))) * (0.75 + 0.5 * (0.5 + 0.5 * md_onda(x, 256.0, P, h + 4u)));
		float lado = dy > 0.0 ? 1.6 : 0.85;
		float perfil = 1.0 - smoothstep(0.2, 1.0, abs(dy) / (meia * lado));
		float aparece = smoothstep(0.12, 0.42, 0.5 + 0.5 * md_onda(x, 512.0, P, h + 5u));
		float forca = 0.085 + 0.065 * u01(hash_u(h + 6u));
		escuro = max(escuro, forca * aparece * perfil);
		// O brilho do começo do anel: largo e fraco, do lado curto da linha.
		float r = smoothstep(meia * 1.0, meia * 2.0, -dy) * (1.0 - smoothstep(meia * 2.0, meia * 4.0, -dy));
		brilho = max(brilho, 0.025 * aparece * r);
	}
	v += brilho - escuro;

	// 5. A fibra: só a 300% se vê, ao comprido, nunca em ponto (8 px atravessando, 64 ao longo).
	float fibra = ruido_p(vec2(x / 64.0, y / 8.0) + vec2(0.29, 0.43), vec2(P.x / 64.0, P.y / 8.0), s + 90);
	v += 0.02 * (fibra - 0.5);

	// O meio: as linhas escurecem a média; volta para 0,5 (o tom escolhido).
	return valor_de(v + 0.014);
}

#include "res://comum/rodape_material.gdshaderinc"

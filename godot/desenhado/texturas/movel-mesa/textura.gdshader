// MESA desenhada que pega cor (onda 4, lote 9, piloto; CONTRATO.md seção 10).
//
// Vista de cima, como a família da onda 3: contorno grosso na própria cor, formas grandes
// e luz em poucas massas. Nada de veio em risquinho, prego ou nó.
//
// - O TAMPO: 3 tábuas largas por casa de fundo, ao longo do comprimento, cada uma num tom
//   chapado (a de cima mais clara, a de baixo mais funda: a luz vem de cima), separadas
//   por uma junta firme; por cima, as duas massas da borda (a clara em cima e à esquerda,
//   a escura embaixo e à direita, largas como as das copas) e o contorno.
// - A ESPESSURA: o tampo repetido para baixo e um pouco para a direita, no tom do fundo: a
//   face da tábua grossa, que faz o tampo "flutuar" sobre as pernas.
// - As PERNAS: quatro quadrados nas quinas da pegada, saindo de baixo do tampo, na sombra
//   dele.
// - ESTICA ao longo (config: pontas de 0,3 casa): tudo o que muda ao longo fica nas pontas
//   (as quinas, as pernas, as massas da esquerda e da direita, a espessura à direita); o
//   meio é a mesma coluna em todo x, e o app estica o meio sem emenda. Simétrica de lado a
//   lado e de cima a baixo na forma: 1 virada (a transposta faz a de 90 graus, com a luz
//   no lugar, porque a luz está na diagonal).
// - Um lugar só (1 = a madeira). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RECUO = 0.07;   // o tampo recuado da pegada: por onde as pernas aparecem
const float QUINA = 0.05;   // o raio da quina do tampo
const float PERNA = 0.13;   // o lado da perna
const float LUZ_DA_BORDA = 0.05; // a largura da massa clara da borda (a escura é 1,5 x)
const vec2 ESPESSURA = vec2(0.014, 0.05); // para onde a face do tampo aparece
const float TABUAS_POR_CASA = 3.6;
const float JUNTA = 0.009; // meia largura da junta entre as tábuas

// O tom de cada tábua, de cima para baixo: a de cima pega a luz, a de baixo fica funda, as
// do meio alternam pouco (uma mesa de 2 casas de fundo não vira listra).
float tom_da_tabua(int j, int n) {
	if (j == 0) {
		return 0.06;
	}
	if (j == n - 1) {
		return -0.05;
	}
	return j % 2 == 1 ? -0.005 : 0.02;
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = movel_casas * 0.5;
	vec2 bt = h - vec2(RECUO);
	// As pernas, nas quinas.
	for (int i = 0; i < 4; i++) {
		vec2 s = vec2(i % 2 == 0 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0);
		desenhar_caixa(av, ac, q, s * (h - vec2(PERNA * 0.5)), vec2(PERNA * 0.5), 0.022, V_SOMBRA - 0.02, 0.02, 1, 0, px);
	}
	// A espessura do tampo.
	float de = sd_caixa(q - ESPESSURA, bt, QUINA);
	pousar_com_contorno(av, ac, de, V_FUNDO + 0.04, 1, px);
	// O tampo: contorno, tábuas, juntas, massas.
	float dt = sd_caixa(q, bt, QUINA);
	pousar(av, ac, V_CONTORNO, 1, cobre(dt, px));
	float di = dt + CONTORNO_CASAS;
	float dentro = cobre(di, px);
	if (dentro <= 0.0) {
		return;
	}
	float alto = 2.0 * bt.y - 2.0 * CONTORNO_CASAS;
	float n = max(2.0, floor(alto * TABUAS_POR_CASA + 0.5));
	float larg = alto / n;
	float ty = (q.y + bt.y - CONTORNO_CASAS) / larg;
	int j = int(clamp(floor(ty), 0.0, n - 1.0));
	pousar(av, ac, V_MEIO + tom_da_tabua(j, int(n)), 1, dentro);
	// A junta entre tábuas (não na primeira nem depois da última).
	float k = floor(ty + 0.5);
	if (k >= 1.0 && k <= n - 1.0) {
		float dj = abs(ty - k) * larg;
		desenhar_linha(av, ac, dj, JUNTA, V_FUNDO, dentro, 1, px);
	}
	// As massas da borda: o tampo andado para longe da luz e para a luz.
	float ds = sd_caixa(q - LUZ * LUZ_DA_BORDA * 1.5, bt, QUINA) + CONTORNO_CASAS;
	float dl = sd_caixa(q + LUZ * LUZ_DA_BORDA, bt, QUINA) + CONTORNO_CASAS;
	pousar(av, ac, V_SOMBRA - 0.01, 1, dentro * (1.0 - cobre(ds, px)));
	pousar(av, ac, V_LUZ + 0.04, 1, dentro * (1.0 - cobre(dl, px)));
}

#include "res://comum/rodape_movel.gdshaderinc"

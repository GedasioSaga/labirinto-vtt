// MESA QUADRADA desenhada que pega cor (onda 4, lote 10; CONTRATO.md seção 10).
//
// Irmã da mesa do piloto (texturas/movel-mesa/): o mesmo recuo do tampo, a mesma quina, a
// mesma espessura que faz o tampo "flutuar", as mesmas quatro pernas nas quinas e as
// mesmas duas massas da borda. O que a faz ler como QUADRADA e não como a mesa cortada:
//
// - O TAMPO é uma MOLDURA de quatro tábuas em volta de um MIOLO, como o quadrado que o
//   app desenha para ela no modo Linhas (pecasNovas.ts, tracosDeFrente): a travessa de
//   cima e a de baixo correm a largura inteira, as laterais entram entre elas (a junta de
//   topo, reta; a meia-esquadria na diagonal virava moldura de quadro, com as quatro
//   rampas de luz de um botão).
// - Cada tábua num tom chapado. O MIOLO é a mais clara, uma peça só: o tampo de cima, o
//   quadrado que o olho lê primeiro (mais escuro que a moldura, ele afundava e a mesa
//   virava bandeja). Na moldura, a luz do piloto: a travessa de cima clara, a de baixo
//   funda, as laterais no meio. Juntas firmes entre todas. Nada de veio, prego ou nó.
// - ESTICA nos dois eixos (config: "xy", pontas de 0,32 casa): as laterais, as juntas de
//   topo, as quinas e as pernas ficam nas pontas; o meio é o miolo chapado e as travessas
//   retas, iguais em todo x e em todo y (medido nos dois: 0). Uma mesa de 2 x 2 é a mesma
//   moldura, da mesma largura, com as mesmas pernas e o mesmo contorno, em volta de um
//   miolo maior (o app também mede por casa, não pela pegada: mesaComPernas.ts). O preço:
//   o miolo da 2 x 2 é um campo liso grande (o contrato só estica o meio, não repete).
// - Simétrica de lado a lado e de cima a baixo: 1 virada (a transposta faz a de 90 graus,
//   com a luz no lugar). Um lugar só (1 = a madeira). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RECUO = 0.07;   // o tampo recuado da pegada: por onde as pernas aparecem
const float QUINA = 0.05;   // o raio da quina do tampo
const float PERNA = 0.13;   // o lado da perna
const float LUZ_DA_BORDA = 0.05; // a largura da massa clara da borda (a escura é 1,5 x)
const vec2 ESPESSURA = vec2(0.014, 0.05); // para onde a face do tampo aparece
const float JUNTA = 0.009;  // meia largura da junta
const float MOLDURA = 0.14; // a largura da moldura, da beira do tampo até a junta do miolo
const float QUINA_DO_MIOLO = 0.012;
// O tom de cada tábua: o miolo é o mais claro; na moldura, a de cima pega a luz e a de
// baixo fica funda (como as tábuas da mesa do piloto).
const float TOM_DE_CIMA = 0.03;
const float TOM_DA_LATERAL = -0.01;
const float TOM_DO_MIOLO = 0.06;
const float TOM_DE_BAIXO = -0.05;

// A distância à junta de topo de uma quina: a travessa de cima e a de baixo correm a
// largura inteira; a junta que as separa das laterais sai da quina do miolo para fora, na
// horizontal (p = |m| - meia medida do miolo).
float dist_da_junta_de_topo(vec2 p) {
	if (p.x < 0.0) {
		return length(p);
	}
	return abs(p.y);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = pegada_do_movel(vir) * 0.5;
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	vec2 bt = h - vec2(RECUO);
	// As pernas, nas quinas.
	for (int i = 0; i < 4; i++) {
		vec2 s = vec2(i % 2 == 0 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0);
		desenhar_caixa(av, ac, m, s * (h - vec2(PERNA * 0.5)), vec2(PERNA * 0.5), 0.022, V_SOMBRA - 0.02, 0.02, 1, vir, px);
	}
	// A espessura do tampo (para baixo e à direita na tela).
	float de = sd_caixa(m - movel_de(ESPESSURA, vir), bt, QUINA);
	pousar_com_contorno(av, ac, de, V_FUNDO + 0.04, 1, px);
	// O tampo: contorno e, por dentro, a moldura inteira.
	float dt = sd_caixa(m, bt, QUINA);
	pousar(av, ac, V_CONTORNO, 1, cobre(dt, px));
	float dentro = cobre(dt + CONTORNO_CASAS, px);
	if (dentro <= 0.0) {
		return;
	}
	// As quatro tábuas da moldura (a junta de topo cobre o degrau de tom entre elas).
	vec2 bm = bt - vec2(MOLDURA);
	float tom = abs(m.y) > bm.y ? (m.y < 0.0 ? TOM_DE_CIMA : TOM_DE_BAIXO) : TOM_DA_LATERAL;
	pousar(av, ac, V_MEIO + tom, 1, dentro);
	// O miolo, a junta em volta dele e as quatro juntas de topo.
	float dm = sd_caixa(m, bm, QUINA_DO_MIOLO);
	pousar(av, ac, V_MEIO + TOM_DO_MIOLO, 1, dentro * cobre(dm, px));
	desenhar_linha(av, ac, abs(dm), JUNTA, V_FUNDO, dentro, 1, px);
	desenhar_linha(av, ac, dist_da_junta_de_topo(abs(m) - bm), JUNTA, V_FUNDO, dentro, 1, px);
	// As massas da borda: o tampo andado para longe da luz e para a luz.
	float ds = sd_caixa(m - lm * LUZ_DA_BORDA * 1.5, bt, QUINA) + CONTORNO_CASAS;
	float dl = sd_caixa(m + lm * LUZ_DA_BORDA, bt, QUINA) + CONTORNO_CASAS;
	pousar(av, ac, V_SOMBRA - 0.01, 1, dentro * (1.0 - cobre(ds, px)));
	pousar(av, ac, V_LUZ + 0.04, 1, dentro * (1.0 - cobre(dl, px)));
}

#include "res://comum/rodape_movel.gdshaderinc"

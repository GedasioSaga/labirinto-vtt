// CERCA desenhada que pega cor (onda 4, lote 12; CONTRATO.md seção 10, a curva em 10.12).
//
// Vista de cima, da família dos lotes 9 a 11: contorno grosso na própria cor, formas
// grandes, a luz de cima à esquerda em poucas massas. Uma cerca de 2 casas com 3 mourões
// (onde a geometriaDaCerca do app os põe numa cerca de 2: a 0,1125 casa de cada borda e no
// meio), e entre eles a ligação:
// - O MOURÃO (lugar 1): o topo cortado de um tronco redondo. A casca é o anel escuro de
//   fora (funda embaixo à direita); o topo é o disco claro de dentro, o mais claro da cerca
//   (é ele que olha para o céu), com uma meia-lua de realce em cima à esquerda. Nada de
//   anel de idade nem rachadura.
// - A LIGAÇÃO (lugar 2), uma faixa larga e calma de mourão a mourão, a mesma coluna em todo
//   x (é ela que o app deita na curva, 10.12): as VARAS (a madeira do mourão), uma vara
//   grossa; a CORDA, mais estreita e mais macia; o ARAME, dois fios de metal com o brilho
//   em cima, afastados um do outro (como os do Atual), largos o bastante para não virar
//   risco.
// O meio que repete (10.6): pontas de 0,5 casa e um módulo de 1 casa, a emenda no meio do
// vão, onde a ligação é igual em todo x. 1 virada: o desenho é simétrico de lado a lado e
// de cima a baixo (a transposta deita a cerca com a luz no lugar).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RAIO = 0.120;        // o mourão (o da seleção do app: 0,45 x 0,25 = 0,1125)
const float PASSO = 0.8875;      // de mourão a mourão na cerca de 2 casas (o app: 1,775 / 2)
const float CONTORNO_MOURAO = 0.026; // o contorno do mourão, casas
const float MEIA_VARA = 0.050;
const float MEIA_CORDA = 0.040;
const float MEIA_ARAME = 0.026;
const float ARAME_LADO = 0.050;  // o meio de cada fio, afastado do eixo

// Uma faixa ao longo (x) de x0 a x1, meia altura h, com o contorno da família (mais fino
// na faixa estreita, sem virar só contorno) e as duas massas de luz: a clara na borda de
// cima à esquerda e a escura na de baixo à direita.
void faixa(inout vec4 av, inout vec4 ac, vec2 m, float yc, float h, float valor, float luz, int lugar, int v, float px) {
	vec2 p = m - vec2(0.0, yc);
	vec2 b = vec2(PASSO, h);
	float r = h * 0.95;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	float co = min(CONTORNO_CASAS, 0.30 * h);
	pousar(av, ac, V_CONTORNO, lugar, cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar(av, ac, valor, lugar, dentro);
	vec2 lm = movel_de(LUZ, v);
	float miolo = h - co;
	float wl = miolo * 0.62 * luz;
	float ws = miolo * 0.78;
	pousar(av, ac, valor - MASSA_ESCURA, lugar, dentro * (1.0 - cobre(sd_caixa(p - lm * ws, b, r) + co, px)));
	pousar(av, ac, valor + MASSA_CLARA, lugar, dentro * (1.0 - cobre(sd_caixa(p + lm * wl, b, r) + co, px)));
}

// O mourão no meio c: um disco cheio, não um anel. O contorno da família (um pouco mais
// fino: no mourão de 0,23 casa o de 0,042 fazia um "o"), a casca só como a meia-lua funda
// embaixo à direita, o topo claro andado um pouco para a luz e o realce em cima à esquerda.
void mourao(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, int v, float px) {
	vec2 p = m - c;
	float r = length(p);
	float d = r - RAIO;
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CONTORNO_MOURAO, px);
	pousar(av, ac, V_SOMBRA - 0.02, 1, dentro);
	vec2 lm = movel_de(LUZ, v);
	float rt = RAIO - CONTORNO_MOURAO - 0.013;
	vec2 pt = p - lm * 0.016;
	float topo = dentro * cobre(length(pt) - rt, px);
	pousar(av, ac, V_LUZ + 0.03, 1, topo);
	pousar(av, ac, V_REALCE, 1, topo * (1.0 - cobre(length(pt + lm * 0.030) - rt, px)));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	// A ligação primeiro (passa por baixo dos mourões, de meio a meio).
	if (qual == 2) {
		faixa(av, ac, m, -ARAME_LADO, MEIA_ARAME, V_SOMBRA + 0.04, 1.0, 2, vir, px);
		faixa(av, ac, m, ARAME_LADO, MEIA_ARAME, V_SOMBRA + 0.04, 1.0, 2, vir, px);
	} else if (qual == 1) {
		faixa(av, ac, m, 0.0, MEIA_CORDA, V_MEIO + 0.08, 0.8, 2, vir, px);
	} else {
		faixa(av, ac, m, 0.0, MEIA_VARA, V_MEIO - 0.02, 1.0, 2, vir, px);
	}
	for (int i = -1; i <= 1; i++) {
		mourao(av, ac, m, vec2(float(i) * PASSO, 0.0), vir, px);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

// MESA REDONDA desenhada que pega cor (onda 4, lote 10; CONTRATO.md seção 10).
//
// Da família do piloto (movel-mesa, aprovado em 29/10): contorno grosso na própria cor,
// formas grandes e luz em poucas massas. Nada de veio em risquinho, prego, nó nem anel.
//
// - O TAMPO: um disco quase cheio da pegada, com 3 tábuas largas ao longo (a de cima mais
//   clara, a de baixo mais funda: a luz vem de cima), separadas por uma junta firme; por
//   cima, as duas massas da borda (a clara em cima à esquerda, a escura embaixo à direita,
//   em meia-lua, as mesmas larguras da mesa) e o contorno.
// - A ESPESSURA: o disco repetido para baixo e um pouco para a direita, no tom do fundo: a
//   face da tábua grossa, que faz o tampo "flutuar" sobre as pernas (como na mesa).
// - As PERNAS: quatro quadradas, como as da mesa, nas diagonais, com a quina saindo de baixo
//   da borda do tampo, na sombra dele (no app elas também ficam nas diagonais). Redondas,
//   liam como bolinhas presas na borda; quadradas, são da mesma família da mesa e separam
//   a mesa da tampa do barril.
// - ESTICA ao longo e vira oval (config: pontas de 0,625 casa = as duas metades do disco).
//   O app repete a coluna do meio; para ela ser lisa, o disco é desenhado num espaço
//   "dobrado": a faixa |x| < MEIO é a mesma coluna em todo x, e fora dela as metades são
//   o círculo com o x encolhido para caber (desvio do círculo de 0,3%: não se vê). As
//   pernas e as massas da borda ficam nas pontas; o meio esticado é a borda reta, as
//   tábuas e as massas de cima e de baixo, como no meio da mesa.
// - Simétrica de lado a lado e de cima a baixo: 1 virada (a transposta faz a de 90 graus
//   e deita as tábuas, com a luz no lugar, porque a luz está na diagonal).
// - Um lugar só (1 = a madeira). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RECUO = 0.035;       // o disco recuado da pegada (as pernas saem nas diagonais)
const float MEIO = 0.0625;       // meia largura da faixa lisa do meio, casas (cobre a faixa que o exportador mede)
const float PERNA = 0.136;       // o lado da perna (quadrada, como a da mesa)
const float QUINA_DA_PERNA = 0.022;
const float PERNA_FORA = 0.005;  // o meio da perna fica isto para fora da borda do tampo, na diagonal
const float LUZ_DA_BORDA = 0.05; // a largura da massa clara da borda (a escura é 1,5 x)
const vec2 ESPESSURA = vec2(0.014, 0.05); // para onde a face do tampo aparece
const float TABUAS = 3.0;
const float JUNTA = 0.009;       // meia largura da junta entre as tábuas

// O tom de cada tábua, de cima para baixo (o mesmo da mesa).
float tom_da_tabua(int j, int n) {
	if (j == 0) {
		return 0.06;
	}
	if (j == n - 1) {
		return -0.05;
	}
	return j % 2 == 1 ? -0.005 : 0.02;
}

// O x "dobrado": zero na faixa do meio e, fora dela, o círculo de raio R com o x encolhido
// para caber (em x = R, dobrado = R). Tudo o que se desenha com ele é a mesma coluna em
// todo x da faixa, e a distância continua boa para o cobre (o gradiente em x fica perto
// de 1 longe do meio e pequeno na borda de cima e de baixo, onde a forma é reta).
float dobrar(float x, float R) {
	float k = R / sqrt(R * R - MEIO * MEIO);
	return sign(x) * k * sqrt(max(x * x - MEIO * MEIO, 0.0));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = movel_casas * 0.5;
	float R = min(h.x, h.y) - RECUO;
	vec2 w = vec2(dobrar(q.x, R), q.y);
	// As pernas, nas diagonais, saindo de baixo da borda.
	float rp = R + PERNA_FORA;
	for (int i = 0; i < 4; i++) {
		vec2 s = vec2(i % 2 == 0 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0);
		desenhar_caixa(av, ac, w, s * rp * 0.7071, vec2(PERNA * 0.5), QUINA_DA_PERNA, V_SOMBRA - 0.02, 0.02, 1, 0, px);
	}
	// A espessura do tampo.
	float de = length(w - ESPESSURA) - R;
	pousar_com_contorno(av, ac, de, V_FUNDO + 0.04, 1, px);
	// O tampo: contorno, tábuas, juntas, massas.
	float dt = length(w) - R;
	pousar(av, ac, V_CONTORNO, 1, cobre(dt, px));
	float dentro = cobre(dt + CONTORNO_CASAS, px);
	if (dentro <= 0.0) {
		return;
	}
	float alto = 2.0 * R - 2.0 * CONTORNO_CASAS;
	float larg = alto / TABUAS;
	float ty = (q.y + R - CONTORNO_CASAS) / larg;
	int j = int(clamp(floor(ty), 0.0, TABUAS - 1.0));
	pousar(av, ac, V_MEIO + tom_da_tabua(j, int(TABUAS)), 1, dentro);
	// A junta entre tábuas (não na primeira nem depois da última).
	float k = floor(ty + 0.5);
	if (k >= 1.0 && k <= TABUAS - 1.0) {
		desenhar_linha(av, ac, abs(ty - k) * larg, JUNTA, V_FUNDO, dentro, 1, px);
	}
	// As massas da borda: o disco andado para longe da luz e para a luz (meias-luas).
	float ds = length(w - LUZ * LUZ_DA_BORDA * 1.5) - R + CONTORNO_CASAS;
	float dl = length(w + LUZ * LUZ_DA_BORDA) - R + CONTORNO_CASAS;
	pousar(av, ac, V_SOMBRA - 0.01, 1, dentro * (1.0 - cobre(ds, px)));
	pousar(av, ac, V_LUZ + 0.04, 1, dentro * (1.0 - cobre(dl, px)));
}

#include "res://comum/rodape_movel.gdshaderinc"

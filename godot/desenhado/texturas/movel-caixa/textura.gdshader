// CAIXA desenhada que pega cor (onda 4, lote 10; CONTRATO.md seção 10).
//
// Um caixote de madeira visto de cima, da família do piloto (mesa, cadeira, barril):
// contorno grosso na própria cor, formas grandes, luz em poucas massas. De fora para dentro:
// - A MOLDURA: o topo das quatro paredes, uma faixa larga em volta, com a massa clara em
//   cima à esquerda e a escura embaixo à direita (as da mesa).
// - A TAMPA afundada dentro da moldura: tábuas largas ao comprido, cada uma num tom chapado
//   (a de cima pega a luz), com uma junta firme; a moldura joga uma faixa de sombra na
//   beira de cima e da esquerda da tampa (ela é mais funda).
// - O TRAVESSÃO em X, por cima da tampa: a ripa "/" inteira, por cima, e a "\" por baixo
//   dela; as duas mais claras que a tampa (estão mais altas), a de cima joga a sua sombra
//   embaixo à direita.
// - Nada de prego, veio nem nó. Simétrica de lado a lado e de cima a baixo na forma: 1
//   virada (a transposta deita as tábuas; a ripa "/" fica a de cima e a luz no lugar,
//   porque a luz está na diagonal). Um lugar só (1 = a madeira). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float QUINA = 0.045;         // o raio da quina da caixa
const float ARO = 0.075;           // a largura da moldura, dentro do contorno
const float LUZ_DA_BORDA = 0.05;   // a massa clara da borda (a escura é 1,5 x)
const float TABUAS = 3.0;
const float JUNTA = 0.008;         // meia largura da junta entre as tábuas
const float LINHA = 0.010;         // meia largura da linha entre a moldura e a tampa
const float FUNDO_DA_TAMPA = 0.05; // a faixa de sombra que a moldura joga na tampa
const float RIPA = 0.062;          // meia largura das ripas do X
const float CONTORNO_DA_RIPA = 0.022;
const float SOMBRA_DA_RIPA = 0.045; // o quanto a sombra da ripa de cima anda

float tom_da_tabua(int j) {
	if (j == 0) {
		return 0.03;
	}
	if (j == 1) {
		return 0.0;
	}
	return -0.035;
}

// Uma ripa do X: a faixa de normal n pelo meio, cortada pela tampa (dp).
float sd_ripa(vec2 q, vec2 n, float dp) {
	return max(abs(dot(q, n)) - RIPA, dp);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = movel_casas * 0.5;
	float d = sd_caixa(q, h, QUINA);
	if (d > px) {
		return;
	}
	// O contorno e a moldura com as suas massas.
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CONTORNO_CASAS, px);
	pousar(av, ac, V_MEIO + 0.04, 1, dentro);
	float ds = sd_caixa(q - LUZ * LUZ_DA_BORDA * 1.5, h, QUINA) + CONTORNO_CASAS;
	float dl = sd_caixa(q + LUZ * LUZ_DA_BORDA, h, QUINA) + CONTORNO_CASAS;
	pousar(av, ac, V_SOMBRA + 0.02, 1, dentro * (1.0 - cobre(ds, px)));
	pousar(av, ac, V_LUZ + 0.04, 1, dentro * (1.0 - cobre(dl, px)));
	// A tampa afundada: a linha da beira e as tábuas.
	vec2 hp = h - vec2(CONTORNO_CASAS + ARO);
	float dp = sd_caixa(q, hp, 0.015);
	pousar(av, ac, V_FUNDO, 1, cobre(dp - LINHA, px));
	float tampa = cobre(dp + LINHA, px);
	if (tampa <= 0.0) {
		return;
	}
	float larg = 2.0 * hp.y / TABUAS;
	float ty = (q.y + hp.y) / larg;
	int j = int(clamp(floor(ty), 0.0, TABUAS - 1.0));
	pousar(av, ac, V_MEIO - 0.03 + tom_da_tabua(j), 1, tampa);
	float k = floor(ty + 0.5);
	if (k >= 1.0 && k <= TABUAS - 1.0) {
		desenhar_linha(av, ac, abs(ty - k) * larg, JUNTA, V_FUNDO, tampa, 1, px);
	}
	// A sombra da moldura na tampa: o ponto que, andado para a luz, sai da tampa.
	float luz_na_tampa = cobre(sd_caixa(q + LUZ * FUNDO_DA_TAMPA, hp, 0.015), px);
	pousar(av, ac, V_SOMBRA - 0.02, 1, tampa * (1.0 - luz_na_tampa));
	// O X: a ripa "\" por baixo, a sombra da "/" e a "/" por cima.
	vec2 n_baixo = vec2(0.7071, -0.7071);
	vec2 n_cima = vec2(0.7071, 0.7071);
	float r2 = sd_ripa(q, n_baixo, dp + LINHA);
	pousar(av, ac, V_CONTORNO + 0.04, 1, cobre(r2, px));
	pousar(av, ac, V_MEIO + 0.05, 1, cobre(r2 + CONTORNO_DA_RIPA, px));
	float sombra_da_ripa = cobre(sd_ripa(q + LUZ * SOMBRA_DA_RIPA, n_cima, dp + LINHA), px);
	pousar(av, ac, V_SOMBRA - 0.02, 1, tampa * sombra_da_ripa);
	float r1 = sd_ripa(q, n_cima, dp + LINHA);
	pousar(av, ac, V_CONTORNO + 0.04, 1, cobre(r1, px));
	pousar(av, ac, V_LUZ - 0.01, 1, cobre(r1 + CONTORNO_DA_RIPA, px));
}

#include "res://comum/rodape_movel.gdshaderinc"

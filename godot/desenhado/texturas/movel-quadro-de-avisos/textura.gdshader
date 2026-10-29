// QUADRO DE AVISOS desenhado que pega cor (onda 4, lote 11; CONTRATO.md seção 10).
//
// O quadro de vila como o app mostra (de cima, meio de lado: a frente do quadro em pé),
// da família do piloto e do lote 10: contorno grosso na própria cor, formas grandes, luz
// em poucas massas. De trás para a frente:
// - a MOLDURA, uma faixa larga em volta do quadro, com a massa clara em cima à esquerda e
//   a escura embaixo à direita;
// - o FUNDO afundado dentro dela, 2 tábuas largas ao comprido num tom mais fundo, com uma
//   junta firme; a moldura e os postes jogam nele uma faixa de sombra em cima e à esquerda;
// - 3 PAPÉIS de cor própria (corFixa), retângulos claros calmos, um pouco tortos e de
//   tamanhos e alturas diferentes (nada de fileira de gavetas); o do meio tem uma faixa
//   larga de título, mais escura; cada um joga uma sombra curta no fundo. Nada de letra,
//   risquinho de texto nem tachinha;
// - os 2 POSTES firmes, na frente das pontas da moldura: passam um pouco acima dela e
//   descem até o chão. São eles que dizem "quadro em pé" e não "mesa".
// - Os papéis tornam o quadro diferente de lado a lado: 4 viradas desenhadas (CONTRATO
//   10.4), desenhado no referencial do quadro (movel_de) e aceso no da tela (LUZ).
// - Um lugar (1 = a madeira); os papéis são cor própria. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As medidas, em casas, no referencial do quadro (pegada 1 x 0,4; y para baixo) ----
const float POSTE_X = 0.428;
const float POSTE_Y = -0.014;
const vec2 POSTE_B = vec2(0.058, 0.236);  // de -0,25 a 0,222: passa da moldura e vai ao chão
const vec2 MOLDURA_C = vec2(0.0, -0.034);
const vec2 MOLDURA_B = vec2(0.405, 0.164); // de -0,198 a 0,13
const float ARO = 0.03;            // a faixa da moldura, dentro do contorno
const float JUNTA_Y = -0.03;       // a junta entre as 2 tábuas do fundo
const float JUNTA = 0.008;         // meia largura da junta
const float LINHA = 0.008;         // meia largura da linha entre a moldura e o fundo
const float CO_MOLDURA = 0.038;    // o contorno da moldura (o da família é 0,042)
const float CO_POSTE = 0.034;      // o dos postes, um pouco mais fino: a peça é estreita
const float SOMBRA_NO_FUNDO = 0.032; // a faixa de sombra que a moldura joga no fundo

// ---- Os papéis ----
const float CO_PAPEL = 0.016;      // o contorno do papel (a peça é pequena)
const float SOMBRA_DO_PAPEL = 0.016; // o quanto a sombra do papel anda no fundo
const vec3 PAPEL_A = vec3(0.922, 0.886, 0.804); // #ebe2cd (PRACA_REALCE)
const vec3 PAPEL_B = vec3(0.941, 0.914, 0.839); // #f0e9d6, o mais branco
const vec3 PAPEL_C = vec3(0.878, 0.824, 0.690); // #e0d2b0, o amarelado
const vec3 TINTA = vec3(0.490, 0.353, 0.314);   // #7d5a50, entre VINHO e NOGUEIRA: a faixa de título
const vec3 BEIRA_DO_PAPEL = vec3(0.58, 0.52, 0.42); // o contorno do papel: a própria cor, escura e quente

const vec2 A_C = vec2(-0.195, -0.045);
const vec2 A_B = vec2(0.108, 0.066);
const float A_GRAUS = -7.0;
const vec2 B_C = vec2(0.032, -0.03);
const vec2 B_B = vec2(0.08, 0.088);
const float B_GRAUS = 3.0;
const vec2 C_C = vec2(0.245, -0.004);
const vec2 C_B = vec2(0.068, 0.056);
const float C_GRAUS = 10.0;

// A distância a uma caixa girada (graus) de meio c e meia medida b.
float sd_papel(vec2 m, vec2 c, vec2 b, float graus) {
	return sd_caixa(girar(m - c, -radians(graus)), b, 0.008);
}

// Uma peça: contorno de espessura co, recheio e as duas massas de luz (as de
// desenhar_caixa, com o contorno escolhido aqui).
void peca(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, vec2 c, vec2 b, float r, float co, float valor, float bisel, float px) {
	vec2 p = m - c;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar(av, ac, valor, 1, dentro);
	float wl = largura_da_massa(bisel, b, co);
	float ws = largura_da_massa(bisel * 1.5, b, co);
	pousar(av, ac, valor - MASSA_ESCURA, 1, dentro * (1.0 - cobre(sd_caixa(p - lm * ws, b, r) + co, px)));
	pousar(av, ac, valor + MASSA_CLARA, 1, dentro * (1.0 - cobre(sd_caixa(p + lm * wl, b, r) + co, px)));
}

// Um papel de cor própria: contorno na própria cor, o recheio, a faixa de título (se
// faixa > 0) e a beira funda, tudo no referencial do papel (girado).
void papel(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, vec2 c, vec2 b, float graus, vec3 cor, float faixa, float px) {
	float ang = radians(graus);
	vec2 p = girar(m - c, -ang);
	vec2 lp = girar(lm, -ang);
	float r = 0.008;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar_cor(av, ac, cor * BEIRA_DO_PAPEL, cobre(d, px));
	float dentro = cobre(d + CO_PAPEL, px);
	pousar_cor(av, ac, cor, dentro);
	if (faixa > 0.0) {
		vec2 bf = vec2(b.x - 0.026, 0.017);
		vec2 cf = vec2(0.0, -b.y + CO_PAPEL + 0.016 + bf.y);
		pousar_cor(av, ac, mix(cor, TINTA, faixa), dentro * cobre(sd_caixa(p - cf, bf, 0.004), px));
	}
	// O papel é chato: só a beira de baixo à direita um pouco mais funda (ele descola).
	pousar_cor(av, ac, mix(cor, sombra_de(cor), 0.7), dentro * (1.0 - cobre(sd_caixa(p - lp * 0.016, b, r) + CO_PAPEL, px)));
}

// O fundo afundado (dentro da moldura).
vec2 fundo_b() {
	return MOLDURA_B - vec2(CO_MOLDURA + ARO);
}

// O que fica mais alto que o fundo e joga sombra nele: a moldura em volta (o que está fora
// do fundo) e os postes.
float sd_alto(vec2 m) {
	float d = -sd_caixa(m - MOLDURA_C, fundo_b(), 0.012);
	d = min(d, sd_caixa(m - vec2(-POSTE_X, POSTE_Y), POSTE_B, 0.02));
	return min(d, sd_caixa(m - vec2(POSTE_X, POSTE_Y), POSTE_B, 0.02));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	// A moldura, com as suas massas.
	peca(av, ac, m, lm, MOLDURA_C, MOLDURA_B, 0.024, CO_MOLDURA, V_MEIO + 0.04, 0.026, px);
	// O fundo: a linha da beira, 2 tábuas, a junta, a sombra da moldura e a dos papéis.
	float df = sd_caixa(m - MOLDURA_C, fundo_b(), 0.012);
	pousar(av, ac, V_FUNDO, 1, cobre(df - LINHA, px));
	float fundo = cobre(df + LINHA, px);
	if (fundo > 0.0) {
		pousar(av, ac, V_MEIO - 0.1 + (m.y < JUNTA_Y ? 0.02 : -0.01), 1, fundo);
		desenhar_linha(av, ac, abs(m.y - JUNTA_Y), JUNTA, V_FUNDO + 0.02, fundo, 1, px);
		pousar(av, ac, V_SOMBRA - 0.04, 1, fundo * cobre(sd_alto(m + lm * SOMBRA_NO_FUNDO), px));
		vec2 ms = m + lm * SOMBRA_DO_PAPEL;
		float dp = min(sd_papel(ms, A_C, A_B, A_GRAUS), min(sd_papel(ms, B_C, B_B, B_GRAUS), sd_papel(ms, C_C, C_B, C_GRAUS)));
		pousar(av, ac, V_FUNDO + 0.02, 1, fundo * cobre(dp, px) * 0.85);
	}
	// Os papéis.
	papel(av, ac, m, lm, A_C, A_B, A_GRAUS, PAPEL_A, 0.0, px);
	papel(av, ac, m, lm, B_C, B_B, B_GRAUS, PAPEL_B, 0.6, px);
	papel(av, ac, m, lm, C_C, C_B, C_GRAUS, PAPEL_C, 0.0, px);
	// Os postes, na frente das pontas da moldura.
	peca(av, ac, m, lm, vec2(-POSTE_X, POSTE_Y), POSTE_B, 0.02, CO_POSTE, V_MEIO - 0.02, 0.024, px);
	peca(av, ac, m, lm, vec2(POSTE_X, POSTE_Y), POSTE_B, 0.02, CO_POSTE, V_MEIO - 0.02, 0.024, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

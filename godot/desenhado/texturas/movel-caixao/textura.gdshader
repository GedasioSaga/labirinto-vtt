// CAIXÃO fechado, de madeira, visto de cima (onda 4, lote 19, cemitério; CONTRATO.md seção 10).
//
// Da família aprovada (baú, mesa, barril): contorno grosso na própria cor, formas grandes e
// luz em poucas massas, a de cima à esquerda. Nada de veio, prego em bolinha ou granulado.
// Pegada 1 x 2 casas (y para baixo, a cabeça em -y). A tampa é um hexágono de caixão: lados
// retos no meio, ombros em cada ponta e um afinamento curto até a ponta. Ele é igual nas duas
// pontas (centrossimétrico), então bastam 2 viradas (a de 180 graus é a mesma tampa com a luz
// no lugar).
//
// - A TAMPA (lugar 1, madeira): um só bloco de contorno grosso, com a junta de duas tábuas ao
//   comprido (um fio firme no meio) e as massas de luz e sombra da borda.
// - As ALÇAS (lugar 2, ferragens): duas pegas de metal, uma em cada lado, saindo um nada da
//   tampa, no tom claro (a de cima à esquerda pega mais luz).
// Lugares: 1 = a madeira, 2 = as ferragens. A cor é do material (corFixa: false). A sombra no
// chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- A forma (casas; a pegada é 1 x 2, a meia medida 0,5 x 1) ----
const float MEIO_MEIA = 0.38;      // meia largura nos lados retos
const float PONTA_MEIA = 0.24;     // meia largura na ponta (o afinamento vai do ombro até ela)
const float OMBRO_Y = 0.55;        // onde os lados retos acabam e a tampa começa a afinar
const float PONTA_Y = 0.98;        // a meia altura da tampa (cabeça e pé)
const float AFINA = (MEIO_MEIA - PONTA_MEIA) / (PONTA_Y - OMBRO_Y);

// ---- Os valores (V_* do cabeçalho) ----
const float TAMPA_VALOR = 0.52;    // a tábua em tom médio; a luz sobe e a sombra desce daí
const float JUNTA_MEIA = 0.010;    // meia largura do fio entre as duas tábuas
const float ALCA_VALOR = 0.66;     // o metal um tom acima da madeira

// ---- Relevo das massas (casas) ----
const float MASSA_LUZ = 0.07;      // quanto a massa clara anda para a luz
const float MASSA_SOMBRA = 0.09;   // quanto a escura anda para longe da luz

// Distância ao hexágono do caixão, em casas (negativo dentro). folga encolhe a forma (o
// aro e o forro usam a mesma conta com uma folga). Aproximação de máximos: boa para o
// contorno e as massas, que só pedem a distância perto da borda.
float sd_caixao(vec2 p, float folga) {
	float ay = abs(p.y);
	float meia = MEIO_MEIA - folga - max(ay - OMBRO_Y, 0.0) * AFINA;
	return max(abs(p.x) - meia, ay - (PONTA_Y - folga));
}

// Uma alça de metal: uma caixa pequena de quina redonda, do lado de fora da tampa.
void desenhar_alca(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, int vir, float px) {
	desenhar_caixa(av, ac, m, c, vec2(0.040, 0.085), 0.02, ALCA_VALOR, 0.030, 2, vir, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	// As pegas primeiro: a tampa, por cima, cobre a parte delas que entra nela.
	desenhar_alca(av, ac, m, vec2(0.425, -0.30), vir, px);
	desenhar_alca(av, ac, m, vec2(-0.425, 0.30), vir, px);
	// A tampa de madeira: contorno, recheio no tom da tábua, luz e sombra de borda.
	float d = sd_caixao(m, 0.0);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CONTORNO_CASAS, px);
	pousar(av, ac, TAMPA_VALOR, 1, dentro);
	float escura = dentro * (1.0 - cobre(sd_caixao(m - lm * MASSA_SOMBRA, 0.0) + CONTORNO_CASAS, px));
	float clara = dentro * (1.0 - cobre(sd_caixao(m + lm * MASSA_LUZ, 0.0) + CONTORNO_CASAS, px));
	pousar(av, ac, TAMPA_VALOR - MASSA_ESCURA, 1, escura);
	pousar(av, ac, TAMPA_VALOR + MASSA_CLARA, 1, clara);
	// A junta de duas tábuas, ao comprido, no meio (um fio firme, a 50% ainda se lê).
	desenhar_linha(av, ac, abs(m.x), JUNTA_MEIA, V_FUNDO, dentro, 1, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

// ARCO DO PORTÃO desenhado que pega cor (onda 4, lote 12; CONTRATO.md seção 10).
//
// A entrada de vila vista de cima, como o app mostra (o Atual, moveis/arcoDoPortao.ts:
// a silhueta de esteio, trave e esteio, com a placa pendurada na frente). Da família do
// piloto e dos lotes 10 e 11: contorno grosso na própria cor, formas grandes, luz em
// poucas massas. De baixo para cima:
// - as 2 ALÇAS curtas que seguram a placa: só aparecem no vão entre a trave e a placa (é
//   o vão que diz "pendurada");
// - a TRAVE de ponta a ponta, uma viga só, que passa um pouco dos esteios: a face de cima
//   clara e a da frente escura, partidas por uma aresta firme, e a sombra curta de cada
//   esteio nela, à direita;
// - a PLACA pendurada no meio, na frente (+y do arco), de outro material (lugar 2): a
//   tábua com as duas massas e o NOME, uma massa clara larga, sem letra;
// - os 2 ESTEIOS firmes nas pontas, por cima da trave: o topo quadrado com chapéu de 4
//   águas, as 2 viradas para a luz claras e as 2 do outro lado escuras (é o chapéu que
//   diz "esteio" e não "ponta de haltere").
// Nada de veio, prego, corrente em bolinha, flor nem letra.
//
// Simétrico de lado a lado, não de cima a baixo (a placa fica na frente): 2 viradas
// (CONTRATO 10.4). Desenhado no referencial do arco (movel_de) e aceso no da tela (LUZ).
//
// Esticar (ao longo): tudo o que muda ao longo fica nas pontas. Fora do miolo da placa
// (|x| < 0,17) e dos esteios, cada coluna é só a trave; no miolo da placa a coluna também
// é a mesma em todo x (as massas da placa e o nome são faixas). Com o contrato de hoje o
// meio liso é o miolo da placa (pontasCasas 0,859375: a placa cresce com o arco); o
// desenho já serve para um centro fixo (a placa de largura fixa e a trave lisa dos dois
// lados esticando), que é a mudança proposta ao contrato.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As medidas, em casas, no referencial do arco (pegada 2 x 0,5; y para baixo) ----
const float EIXO = -0.0875;          // a linha dos esteios e da trave (a placa fica abaixo)

// Os esteios: o topo quadrado com o chapéu em pirâmide (4 águas), de -0,2275 a 0,0525
// no atravessado. As 2 águas viradas para a luz claras, as 2 do outro lado escuras.
const float ESTEIO_X = 0.74;
const vec2 ESTEIO_B = vec2(0.14, 0.14);
const float ESTEIO_R = 0.036;
const float CO_ESTEIO = 0.042;
const float TOM_ESTEIO = 0.06;       // o esteio é o mais alto: um tom acima
const float AGUA_CIMA = 0.13;        // as águas, em volta do tom do esteio (na tela)
const float AGUA_ESQUERDA = 0.07;
const float AGUA_DIREITA = -0.05;
const float AGUA_BAIXO = -0.12;

// A trave: de ponta a ponta, passa 0,1 casa de cada esteio. Uma viga de seção quadrada:
// a face de cima clara e a da frente escura, partidas por uma aresta firme (com 3 faixas
// ela lia como um cano).
const vec2 TRAVE_B = vec2(0.985, 0.08);
const float TRAVE_R = 0.034;
const float CO_TRAVE = 0.032;
const float TOM_TRAVE = 0.03;
const float FACE_DE_CIMA = 0.07;     // o quanto a face de cima sobe do tom
const float FACE_DA_FRENTE = -0.09;  // o quanto a da frente desce
const float ARESTA = 0.006;          // a aresta fica um pouco para o lado da frente
const float SOMBRA_DO_ESTEIO = 0.042; // o quanto a sombra do esteio anda na trave

// A placa, pendurada 0,05 casa abaixo da trave (de 0,0325 a 0,2325).
const vec2 PLACA_C = vec2(0.0, 0.1325);
const vec2 PLACA_B = vec2(0.28, 0.1);
const float PLACA_R = 0.03;
const float CO_PLACA = 0.034;
const float LUZ_PLACA = 0.024;
const float TOM_PLACA = 0.0;
// O nome: uma massa clara larga, entre a massa clara e a escura da placa.
const vec2 NOME_C = vec2(0.0, 0.129);
const vec2 NOME_B = vec2(0.19, 0.04);
const float NOME_R = 0.026;
const float TOM_NOME = 0.29;

// As alças: do meio da trave até um pouco dentro da placa (só o vão aparece).
const float ALCA_X = 0.2;
const float ALCA_R = 0.022;
const float CO_ALCA = 0.012;

// Uma peça: contorno de espessura co, o recheio e as duas massas de luz, largas (as de
// desenhar_caixa, com o contorno e a largura escolhidos aqui: a trave e a placa são
// estreitas demais para a conta de 40% da biblioteca).
void peca(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, vec2 c, vec2 b, float r, float co, float valor, float luz, int lugar, float px) {
	vec2 p = m - c;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, lugar, cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar(av, ac, valor, lugar, dentro);
	pousar(av, ac, valor - MASSA_ESCURA, lugar, dentro * (1.0 - cobre(sd_caixa(p - lm * luz * 1.4, b, r) + co, px)));
	pousar(av, ac, valor + MASSA_CLARA, lugar, dentro * (1.0 - cobre(sd_caixa(p + lm * luz, b, r) + co, px)));
}

float sd_esteios(vec2 m) {
	vec2 p = vec2(abs(m.x) - ESTEIO_X, m.y - EIXO);
	return sd_caixa(p, ESTEIO_B, ESTEIO_R);
}

// Um esteio: o contorno e o chapéu de 4 águas. As águas são contadas na TELA (t = o ponto
// a partir do meio do esteio, já na tela): a de cima e a da esquerda olham para a luz.
void esteio(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, int vir, float px) {
	vec2 p = m - c;
	float d = sd_caixa(p, ESTEIO_B, ESTEIO_R);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CO_ESTEIO, px);
	vec2 t = tela_de(p, vir);
	float u = cobre((t.y - t.x) * 0.7071, px); // acima da diagonal de cima à esquerda para baixo à direita
	float w = cobre((t.y + t.x) * 0.7071, px); // acima da outra
	float agua = u * w * AGUA_CIMA + (1.0 - u) * w * AGUA_ESQUERDA + u * (1.0 - w) * AGUA_DIREITA + (1.0 - u) * (1.0 - w) * AGUA_BAIXO;
	pousar(av, ac, V_MEIO + TOM_ESTEIO + agua, 1, dentro);
}

// A trave: o contorno, a face de cima e a da frente. "Para a luz" é o lado da trave que
// fica em cima na tela (o y do arco com o sinal da luz).
void trave(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	vec2 p = m - vec2(0.0, EIXO);
	float d = sd_caixa(p, TRAVE_B, TRAVE_R);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CO_TRAVE, px);
	float k = p.y * sign(lm.y); // > 0 do lado da luz
	float cima = cobre(-(k + ARESTA), px); // a face de cima: onde k > -ARESTA
	float v = V_MEIO + TOM_TRAVE + mix(FACE_DA_FRENTE, FACE_DE_CIMA, cima);
	pousar(av, ac, v, 1, dentro);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir); // a luz da tela, no referencial do arco

	// As alças, por baixo de tudo: só o vão entre a trave e a placa mostra.
	vec2 alca = vec2(abs(m.x), m.y);
	float da = sd_traco(alca, vec2(ALCA_X, EIXO), vec2(ALCA_X, PLACA_C.y - PLACA_B.y + 0.03), ALCA_R, ALCA_R);
	if (da <= px) {
		pousar(av, ac, V_CONTORNO, 1, cobre(da, px));
		pousar(av, ac, V_FUNDO + 0.08, 1, cobre(da + CO_ALCA, px));
	}

	// A trave, e a sombra curta que cada esteio joga nela (embaixo à direita).
	float dt = sd_caixa(m - vec2(0.0, EIXO), TRAVE_B, TRAVE_R);
	if (dt <= px) {
		trave(av, ac, m, lm, px);
		float dentro = cobre(dt + CO_TRAVE, px);
		float ds = sd_esteios(m + lm * SOMBRA_DO_ESTEIO);
		pousar(av, ac, V_SOMBRA - 0.04, 1, dentro * cobre(ds, px) * 0.9);
	}

	// A placa e o nome (lugar 2).
	float dp = sd_caixa(m - PLACA_C, PLACA_B, PLACA_R);
	if (dp <= px) {
		peca(av, ac, m, lm, PLACA_C, PLACA_B, PLACA_R, CO_PLACA, V_MEIO + TOM_PLACA, LUZ_PLACA, 2, px);
		float dentro = cobre(dp + CO_PLACA, px);
		pousar(av, ac, V_MEIO + TOM_NOME, 2, dentro * cobre(sd_caixa(m - NOME_C, NOME_B, NOME_R), px));
	}

	// Os esteios por cima de tudo.
	esteio(av, ac, m, vec2(m.x < 0.0 ? -ESTEIO_X : ESTEIO_X, EIXO), vir, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

// =====================================================================
// comum/movel.gdshaderinc: CONGELADO. Os designers da onda 4 só incluem, nunca editam.
//
// O cabeçalho de um MÓVEL DESENHADO que pega cor (CONTRATO.md, seção 10). Primeira linha
// útil do textura.gdshader (depois de shader_type e render_mode unshaded, blend_disabled).
// Traz tudo do cabeçalho do chão (paleta, sorteio, ruído, formas, tons) e os uniforms
// que o exportador preenche. Depois dele o móvel escreve UMA função e, por último,
// inclui comum/rodape_movel.gdshaderinc:
//
//   void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem,
//                     inout vec4 av, inout vec4 ac)
//       O móvel VISTO DE CIMA, em CAMADAS, da de baixo para a de cima, cada uma com
//       pousar(av, ac, valor, lugar, alfa) ou pousar_cor(av, ac, cor, alfa).
//         q em CASAS a partir do MEIO da pegada, y para baixo. A pegada desta imagem é
//           movel_casas (na virada 1 e 3 desenhadas, já deitada: h x w); a imagem tem
//           movel_margem casas de borda além da pegada, para o contorno que passa.
//         px = o tamanho de um pixel da imagem, em casas (1/128): use cobre(d, px).
//         vis (a vista): 0 = frente (a de cima, o padrão), 1 = lado (a Frente/Lado do mestre).
//         qual (a variante): o índice em "variantes" do config.json (a opção do lugar que muda o
//           desenho: o assento de palha ou de madeira, as varas ou a corda da cerca).
//         vir (a virada): 0..3, quartos de volta no sentido do relógio (CONTRATO 10.4). Só as
//           desenhadas chegam: viradas 1 = só a 0; 2 = a 0 e a 2; 4 = as quatro.
//       O VALOR é cinza: 0,5 = o tom do material que o mestre escolheu. Use os níveis
//       daqui (V_CONTORNO, V_SOMBRA, V_MEIO, V_LUZ, V_REALCE): são eles que fazem os
//       móveis de designers diferentes parecerem do mesmo jogo.
//       O LUGAR é o número do lugar de material, na ordem de "lugares" do config.json
//       (1, 2 ou 3; os de LUGARES_DE_MATERIAL do app). pousar_cor é a parte de cor
//       própria (louça, comida, água, vidro, chama): vai na imagem -cor, com "corFixa".
//       A luz vem de cima à esquerda em TODA virada; a sombra no chão é do app (não
//       pinte nada fora do móvel); a sombra de DENTRO (a perna debaixo do tampo, o
//       fundo do barril) é valor.
//
// Nenhum parâmetro pode ter o nome de um uniform daqui nem do cabeçalho do chão.
// =====================================================================

#include "res://comum/cabecalho.gdshaderinc"

uniform int movel_vista = 0;                    // 0 = frente, 1 = lado
uniform int movel_virada = 0;                   // 0..3, quartos de volta
uniform vec2 movel_casas = vec2(1.0, 1.0);      // a pegada desta imagem, em casas
uniform float movel_margem = 0.0625;            // a borda além da pegada, em casas
uniform vec2 movel_imagem = vec2(144.0, 144.0); // o tamanho da imagem, px

const float MOVEL_CASA = 128.0; // px da imagem por casa

// Os níveis de valor da família (o app troca cada um pela cor da rampa do material:
// CONTRATO 10.5). Contorno = 50% da luz do tom (a tinta escura das copas); sombra = 78%; luz e realce andam para o
// branco e um pouco para o amarelo.
const float V_CONTORNO = 0.10;
const float V_FUNDO = 0.24;   // o mais escuro de dentro: fresta, o oco, o fundo do barril
const float V_SOMBRA = 0.36;
const float V_MEIO = 0.50;
const float V_LUZ = 0.62;
const float V_REALCE = 0.76;

// A espessura do contorno da família, em casas (2,7 px do mundo a 100%; a das
// árvores da onda 3).
const float CONTORNO_CASAS = 0.042;

// Uma camada por cima das de baixo (alfa reto em pousar; o acumulado é pré-multiplicado):
//   av = (valor·a, peso do lugar 1·a, peso do lugar 2·a, a)
//   ac = (peso do lugar 3·a, cor fixa·a)
void pousar(inout vec4 av, inout vec4 ac, float valor, int lugar, float a) {
	a = clamp(a, 0.0, 1.0);
	vec4 sv = vec4(clamp(valor, 0.0, 1.0), lugar == 1 ? 1.0 : 0.0, lugar == 2 ? 1.0 : 0.0, 1.0);
	vec4 sc = vec4(lugar == 3 ? 1.0 : 0.0, 0.0, 0.0, 0.0);
	av = sv * a + av * (1.0 - a);
	ac = sc * a + ac * (1.0 - a);
}

void pousar_cor(inout vec4 av, inout vec4 ac, vec3 cor, float a) {
	a = clamp(a, 0.0, 1.0);
	float l = dot(cor, vec3(0.30, 0.59, 0.11));
	av = vec4(l, 0.0, 0.0, 1.0) * a + av * (1.0 - a);
	ac = vec4(0.0, clamp(cor, 0.0, 1.0)) * a + ac * (1.0 - a);
}

// Forma com contorno: o contorno (a forma inteira, no valor do contorno) e por cima o
// recheio (a forma encolhida pela espessura). d = a distância à forma, em casas.
void pousar_com_contorno(inout vec4 av, inout vec4 ac, float d, float valor, int lugar, float px) {
	pousar(av, ac, V_CONTORNO, lugar, cobre(d, px));
	pousar(av, ac, valor, lugar, cobre(d + CONTORNO_CASAS, px));
}

// O quanto um ponto da borda de dentro de uma forma olha para a LUZ (de cima à esquerda):
// a normal da forma (gradiente de d) contra LUZ. 1 = a borda de cima à esquerda, -1 = a
// de baixo à direita. Bom para a faixa de realce e a de sombra da borda.
float para_a_luz(vec2 normal) {
	return dot(normalize(normal + vec2(1e-5)), LUZ);
}

// ---- As viradas: desenhe no referencial do MÓVEL e acenda no da TELA ----
// O móvel virado v quartos de volta no sentido do relógio: o ponto m do móvel vai para
// tela_de(m, v) na tela; movel_de é a volta. A distância de uma forma não muda com o giro,
// então sd(movel_de(q, v)) é a distância na tela; o gradiente (a normal) volta para a
// tela por tela_de, e a luz é sempre a da tela (LUZ).
vec2 tela_de(vec2 m, int v) {
	if (v == 1) {
		return vec2(-m.y, m.x);
	}
	if (v == 2) {
		return -m;
	}
	if (v == 3) {
		return vec2(m.y, -m.x);
	}
	return m;
}

vec2 movel_de(vec2 q, int v) {
	if (v == 1) {
		return vec2(q.y, -q.x);
	}
	if (v == 2) {
		return -q;
	}
	if (v == 3) {
		return vec2(-q.y, q.x);
	}
	return q;
}

// A pegada no referencial do móvel (nas viradas 1 e 3 a imagem vem deitada).
vec2 pegada_do_movel(int v) {
	return v % 2 == 1 ? movel_casas.yx : movel_casas;
}

const float GRAD_E = 0.002; // passo da diferença central, em casas

// O contorno de uma peça de meia medida b: o da família, mais fino na peça estreita (a
// perna, a travessa), para ela não virar só contorno.
float contorno_para(vec2 b) {
	return min(CONTORNO_CASAS, 0.45 * min(b.x, b.y));
}

// AS MASSAS DE LUZ de uma peça levantada, como as das copas da onda 3: em vez de um bisel
// fino (some a 50%), duas massas de borda firme. A de LUZ é o pedaço da peça que, andado
// "luz" casas para a luz, sai dela (a borda de cima à esquerda); a de SOMBRA, o que andado
// 1,5 x isso para longe da luz sai dela (a de baixo à direita). Largas o bastante para ler
// a 50%, nunca mais que 40% da peça (a perna não vira só sombra). lm = LUZ no referencial
// do móvel (movel_de(LUZ, v)): a conta é feita no móvel, e a luz continua a da tela.
const float MASSA_CLARA = 0.11;  // o quanto a massa de luz sobe do tom da peça
const float MASSA_ESCURA = 0.12; // o quanto a de sombra desce

// A meia medida útil de uma massa numa peça de meia medida b.
float largura_da_massa(float pedida, vec2 b, float co) {
	return min(pedida, max(0.4 * min(b.x, b.y) - co, 0.0));
}

// Uma caixa de quina redonda com contorno e as massas de luz, desenhada no referencial do
// móvel. m = o ponto no móvel; c, b, r = meio, meia medida e raio; valor = o tom do
// recheio; bisel = a largura da massa de luz, casas (a de sombra é 1,5 x).
void desenhar_caixa(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float r, float valor, float bisel, int lugar, int v, float px) {
	vec2 p = m - c;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	float co = contorno_para(b);
	pousar(av, ac, V_CONTORNO, lugar, cobre(d, px));
	float di = d + co;
	float dentro = cobre(di, px);
	pousar(av, ac, valor, lugar, dentro);
	vec2 lm = movel_de(LUZ, v);
	float wl = largura_da_massa(bisel, b, co);
	float ws = largura_da_massa(bisel * 1.5, b, co);
	pousar(av, ac, valor - MASSA_ESCURA, lugar, dentro * (1.0 - cobre(sd_caixa(p - lm * ws, b, r) + co, px)));
	pousar(av, ac, valor + MASSA_CLARA, lugar, dentro * (1.0 - cobre(sd_caixa(p + lm * wl, b, r) + co, px)));
}

// O mesmo para uma elipse (meio c, semieixos e).
void desenhar_elipse(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 e, float valor, float bisel, int lugar, int v, float px) {
	vec2 p = m - c;
	float d = sd_elipse(p, e);
	if (d > px) {
		return;
	}
	float co = contorno_para(e);
	pousar(av, ac, V_CONTORNO, lugar, cobre(d, px));
	float di = d + co;
	float dentro = cobre(di, px);
	pousar(av, ac, valor, lugar, dentro);
	vec2 lm = movel_de(LUZ, v);
	float wl = largura_da_massa(bisel, e, co);
	float ws = largura_da_massa(bisel * 1.5, e, co);
	pousar(av, ac, valor - MASSA_ESCURA, lugar, dentro * (1.0 - cobre(sd_elipse(p - lm * ws, e) + co, px)));
	pousar(av, ac, valor + MASSA_CLARA, lugar, dentro * (1.0 - cobre(sd_elipse(p + lm * wl, e) + co, px)));
}

// Um traço fino de valor (a junta entre tábuas, a costura), já com a cobertura a.
void desenhar_linha(inout vec4 av, inout vec4 ac, float d, float meia, float valor, float a, int lugar, float px) {
	pousar(av, ac, valor, lugar, cobre(d - meia, px) * a);
}

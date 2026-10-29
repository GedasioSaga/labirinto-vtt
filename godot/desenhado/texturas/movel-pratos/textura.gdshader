// PRATOS desenhados, a MESA POSTA (onda 4, lote 14; CONTRATO.md seção 10).
//
// Meia casa que o mestre põe POR CIMA da mesa ou do balcão. Sem material: a louça, a
// comida, a caneca e o talher são cor própria ("corFixa", lugares vazio, como no app). Visto
// de cima, como a família da onda 3: contorno grosso na própria cor escurecida, formas
// grandes, a luz de cima à esquerda em duas massas por peça. As três formas do painel do
// mestre ("Forma", Prop.mobiliaForma) são as variantes, escolhidas pela forma do objeto
// (quando: { forma }), como o tapete redondo:
// - CHEIO (o padrão, a última variante): o prato com o assado e o pão (duas massas calmas:
//   o assado enche o fundo, o pão se encosta na aba), a colher deitada ao lado e a caneca no
//   canto;
// - VAZIO: o prato limpo, a colher deitada nele com o cabo para fora (de quem acabou de
//   comer), e a caneca;
// - PILHA: quatro pratos empilhados, cada um um pouco fora do de baixo: de cima se veem a
//   aba do de cima inteira e três bordas mais fundas embaixo à direita.
// O PRATO é uma elipse clara com a aba numa massa só (a borda acesa em cima à esquerda, a
// funda embaixo à direita) e o fundo rebaixado: a aba faz sombra no fundo em cima à esquerda
// e a parede de baixo à direita pega a luz. Nada de grão, ervilha, migalha ou reflexo em
// bolinha. 4 viradas: o prato, a caneca e o talher giram com o móvel (a caneca vai para o
// canto girado) e a luz fica na tela. A pilha é desenhada na tela (é redonda): as bordas
// de baixo ficam sempre embaixo à direita, do lado da sombra. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// As cores próprias, as do app (client meioTermo/moveis/pratos.ts: tomDoMeio da paleta).
const vec3 LOUCA = vec3(0.886, 0.871, 0.824);  // branco #f3efe2 x 0,93
const vec3 ASSADO = vec3(0.541, 0.376, 0.220); // madeiraEscura #8d6239 x 0,98
const vec3 PAO = vec3(0.773, 0.655, 0.384);    // palha #d6b56a x 0,92
const vec3 BEBIDA = vec3(0.337, 0.247, 0.161); // nogueira #775739 x 0,72
const vec3 CANECA = vec3(0.467, 0.341, 0.224); // nogueira #775739 (o tom do material)
// O talher: o ferro do app (#5d6164) puxado para o aço claro, para ler no tampo escuro.
const vec3 TALHER = vec3(0.560, 0.572, 0.584);

const float TINTA = 0.50;          // o contorno: a própria cor a 50% (a tinta da família), nunca preto
// O contorno da louça: o creme escurecido e puxado para o marrom quente, para o prato não
// ganhar um aro cinza (a louça clara contra o tampo é o que tem de ler).
const vec3 TINTA_DA_LOUCA = vec3(0.42, 0.39, 0.34);

// O prato do cheio e do vazio, no referencial do móvel (casas a partir do meio da pegada).
const vec2 PRATO = vec2(-0.044, 0.036);
const float R_PRATO = 0.178;
const float CO_PRATO = 0.034;      // o contorno da louça (o da família é 0,042: o prato é pequeno)
const float FUNDO = 0.62;          // o raio do fundo rebaixado, em raios do prato
const float SOMBRA_DA_ABA = 0.032; // a sombra que a aba faz no fundo, em cima à esquerda

// A caneca no canto de cima à direita, a asa para fora.
const vec2 CAN = vec2(0.150, -0.158);
const float R_CANECA = 0.064;
const float CO_CANECA = 0.020;

// A pilha (na tela): o prato de cima e o quanto cada um de baixo sai dele.
const vec2 TOPO_DA_PILHA = vec2(-0.052, -0.050);
const float R_PILHA = 0.160;
const float CO_PILHA = 0.026;

vec3 tinta_de(vec3 c) {
	return c * TINTA;
}

// Uma peça de cor própria com a regra da família: o contorno na própria cor escurecida, o
// recheio e as duas massas (a clara em cima à esquerda, a funda embaixo à direita). d = a
// distância à peça; dl e ds = a distância com o ponto andado para a luz e para longe dela
// (a massa é o que sai da peça andando). funda = o fator da massa funda.
void pousar_peca(inout vec4 av, inout vec4 ac, float d, float dl, float ds, vec3 cor, float co, float funda, float px) {
	pousar_cor(av, ac, tinta_de(cor), cobre(d, px));
	float dentro = cobre(d + co, px);
	vec3 c = mix(cor, cor * funda, 1.0 - cobre(ds + co, px));
	c = mix(c, realce_de(cor), 1.0 - cobre(dl + co, px));
	pousar_cor(av, ac, c, dentro);
}

// Uma elipse de cor própria, meio c, semieixos e, girada a radianos; l = a luz no
// referencial em que m está; w = a largura da massa clara (a funda é 1,5 x).
void elipse_de_cor(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 e, float a, vec2 l, vec3 cor, float co, float w, float px) {
	vec2 p = girar(m - c, -a);
	float d = sd_elipse(p, e);
	if (d > px) {
		return;
	}
	vec2 le = girar(l, -a);
	pousar_peca(av, ac, d, sd_elipse(p + le * w, e), sd_elipse(p - le * w * 1.5, e), cor, co, 0.80, px);
}

// Um prato de louça de raio r (meio no zero de p), no tom t da louça (a pilha escurece os
// de baixo). Três massas: a ABA numa massa só, a mais clara (é ela que lê a 25%: um ponto
// creme no tampo); o FUNDO rebaixado, a louça um pouco abaixo; e a sombra que a aba faz no
// fundo em cima à esquerda. O contorno é a louça escurecida, puxada para o marrom quente.
void prato(inout vec4 av, inout vec4 ac, vec2 p, float r, float co, float t, bool com_fundo, vec2 l, float px) {
	float d = length(p) - r;
	if (d > px) {
		return;
	}
	vec3 base = LOUCA * t;
	pousar_cor(av, ac, base * TINTA_DA_LOUCA, cobre(d, px));
	pousar_cor(av, ac, realce_de(base), cobre(d + co, px));
	if (!com_fundo) {
		return;
	}
	float rf = r * FUNDO;
	float df = length(p) - rf;
	if (df > px) {
		return;
	}
	// A sombra da aba: o que, andado para a luz, sai do fundo (a borda de cima à esquerda).
	vec3 f = mix(base * 0.985, base * vec3(0.85, 0.84, 0.82), 1.0 - cobre(length(p + l * SOMBRA_DA_ABA) - rf, px));
	pousar_cor(av, ac, f, cobre(df, px));
}

// O talher: UMA colher larga (a concha e o cabo), de "a" (a ponta da concha) a "b" (o fim
// do cabo). O app tem a faca e o garfo, dois riscos finos lado a lado; a 50% o par vira
// "||", a fileira de traços que o estilo proíbe. Uma peça só, com a concha, lê como talher e
// fica calma.
float sd_colher(vec2 m, vec2 a, vec2 b) {
	vec2 t = normalize(b - a);
	vec2 n = vec2(-t.y, t.x);
	vec2 v = m - (a + t * 0.044);
	float concha = sd_elipse(vec2(dot(v, n), dot(v, t)), vec2(0.033, 0.044));
	return min(concha, sd_traco(m, a + t * 0.070, b, 0.014, 0.017));
}

void colher(inout vec4 av, inout vec4 ac, vec2 m, vec2 a, vec2 b, vec2 l, float px) {
	float d = sd_colher(m, a, b);
	if (d > px) {
		return;
	}
	pousar_peca(av, ac, d, sd_colher(m + l * 0.011, a, b), sd_colher(m - l * 0.016, a, b), TALHER, 0.013, 0.80, px);
}

// A caneca de madeira de cima: a asa para fora, a borda acesa em cima à esquerda e a bebida
// escura com a sombra da borda.
void caneca(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 l, float px) {
	vec2 p = m - c;
	// A asa, por baixo do corpo, para o lado de fora (+x do móvel).
	vec2 a0 = vec2(R_CANECA * 0.7, 0.0);
	vec2 a1 = vec2(R_CANECA * 1.42, 0.0);
	float da = sd_traco(p, a0, a1, 0.021, 0.019);
	if (da < px) {
		pousar_peca(av, ac, da, sd_traco(p + l * 0.010, a0, a1, 0.021, 0.019), sd_traco(p - l * 0.015, a0, a1, 0.021, 0.019), CANECA, 0.012, 0.80, px);
	}
	float d = length(p) - R_CANECA;
	if (d > px) {
		return;
	}
	pousar_peca(av, ac, d, length(p + l * 0.022) - R_CANECA, length(p - l * 0.026) - R_CANECA, CANECA, CO_CANECA, 0.80, px);
	// A bebida: a cerveja escura, com a sombra da borda em cima à esquerda.
	float rb = R_CANECA * 0.60;
	float db = length(p) - rb;
	vec3 b = mix(BEBIDA, BEBIDA * 0.72, 1.0 - cobre(length(p + l * 0.016) - rb, px));
	pousar_cor(av, ac, b, cobre(db, px));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (qual == 1) {
		// A PILHA, na tela: do de baixo para o de cima, cada um mais claro. Os passos não são
		// iguais (a pilha foi posta à mão, não é uma escada).
		vec2 passos[4] = vec2[4](vec2(0.104, 0.106), vec2(0.068, 0.072), vec2(0.036, 0.034), vec2(0.0));
		float tons[4] = float[4](0.80, 0.86, 0.93, 1.0);
		for (int i = 0; i < 4; i++) {
			prato(av, ac, q - (TOPO_DA_PILHA + passos[i]), R_PILHA, CO_PILHA, tons[i], i == 3, LUZ, px);
		}
		return;
	}
	vec2 m = movel_de(q, vir);
	vec2 l = movel_de(LUZ, vir);
	prato(av, ac, m - PRATO, R_PRATO, CO_PRATO, 1.0, true, l, px);
	if (qual == 0) {
		// VAZIO: a colher deitada no prato, a concha no fundo e o cabo saindo pela aba
		// embaixo à direita. Fora do meio (uma corda, não o diâmetro): atravessada no meio, a
		// 50% o prato lia como o sinal de proibido.
		colher(av, ac, m, PRATO + vec2(0.020, -0.096), PRATO + vec2(0.152, 0.134), l, px);
	} else {
		// CHEIO: o assado enche o fundo do prato e o pão se encosta na aba, por cima dele;
		// a colher deitada ao lado.
		elipse_de_cor(av, ac, m, PRATO + vec2(-0.016, 0.022), vec2(0.086, 0.066), -0.30, l, ASSADO, 0.022, 0.024, px);
		elipse_de_cor(av, ac, m, PRATO + vec2(0.070, -0.060), vec2(0.060, 0.040), 0.65, l, PAO, 0.018, 0.020, px);
		colher(av, ac, m, vec2(0.198, -0.046), vec2(0.198, 0.218), l, px);
	}
	caneca(av, ac, m, CAN, l, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

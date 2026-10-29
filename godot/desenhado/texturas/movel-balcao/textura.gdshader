// BALCÃO desenhado que pega cor (onda 4, lote 11; CONTRATO.md seção 10). O da cozinha e o
// da taverna: o mestre faz o balcão comprido esticando, e o meio REPETE (10.6) em vez de
// esticar liso: a cada casa, um vão da prateleira de trás e um suporte da barra de pé.
//
// Parte do armário aprovado (lote 10). Desenhado no referencial do balcão e aceso no da
// tela (movel_de / tela_de): a luz fica em cima à esquerda nas 2 viradas. Contorno grosso
// na própria cor nas peças de fora; nada de veio, prego ou nó.
//
// DE CIMA (a pegada 2 x 0,6; 2 viradas: simétrico de lado a lado, não de frente para trás;
// y para baixo = a frente, o lado do freguês):
// - atrás, a PRATELEIRA de quem serve, um degrau abaixo do tampo, dividida em VÃOS escuros
//   por divisórias (uma por módulo);
// - o TAMPO GROSSO, em 2 massas: a tábua larga de cima e, na frente, a MOLDURA larga e
//   clara (a beira onde se debruça), com o contorno dela como junta firme e a borda que pega
//   a luz: é o que faz o tampo ler mais grosso que o do aparador;
// - na frente, rente ao chão, a BARRA DE PÉ de metal (lugar 2) de ponta a ponta, com as
//   voltas das pontas e um suporte por módulo.
// O módulo (PERIODO casas) tem a divisória e o suporte no meio; a emenda de dois módulos cai
// no meio de um vão, onde tudo é a mesma coluna (a costura que o exportador mede).
// Lugares: 1 = a madeira, 2 = a barra de pé. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// O meio que repete: os mesmos números do config.json (esticar.pontasCasas, periodoCasas).
const float PONTA = 0.5;
const float PERIODO = 1.0;

// ---- As medidas (em casas; fundo de 0,6, y de -0,3 atrás a 0,3 na frente) ----
const float PRAT_Y0 = -0.29;
const float PRAT_Y1 = -0.11;        // a prateleira some embaixo do tampo
const float PRAT_RECUO = 0.04;      // a prateleira começa um pouco para dentro das pontas
const float VAO_RECUO = 0.03;       // a beira da prateleira em volta dos vãos
const float TAMPO_Y0 = -0.15;
const float TAMPO_Y1 = 0.16;
const float MOLDURA_Y0 = 0.02;      // a moldura larga da frente, onde se debruça
const float BARRA_Y = 0.238;
const float BARRA_R = 0.032;
const float BARRA_FIM = 0.14;       // a volta da barra, a partir da ponta do balcão
const float QUINA = 0.055;
const float LUZ_DA_MOLDURA = 0.03;  // a borda da moldura que pega a luz
const float DIVISORIA = 0.045;      // meia largura da divisória entre dois vãos
const float SUPORTE = 0.03;         // meio suporte da barra

// A barra de metal (lugar 2): contorno fino e três massas pela luz da tela, como o aro do
// barril (escuro embaixo à direita, o tom no meio, o brilho em cima à esquerda).
void barra(inout vec4 av, inout vec4 ac, vec2 m, vec2 a, vec2 b, float r, int v, float px) {
	float d = sd_traco(m, a, b, r, r);
	if (d > px) {
		return;
	}
	float co = min(CONTORNO_CASAS, 0.45 * r);
	pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
	float dentro = cobre(d + co, px);
	vec2 ab = b - a;
	float t = clamp(dot(m - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
	vec2 fora = (m - (a + ab * t)) / r;
	float l = dot(tela_de(fora, v), LUZ);
	float valor = mix(V_SOMBRA - 0.02, V_MEIO + 0.02, smoothstep(-0.7, -0.1, l));
	valor = mix(valor, V_REALCE + 0.06, smoothstep(0.25, 0.5, l));
	pousar(av, ac, valor, 2, dentro);
}

// A borda de uma peça estreita que olha para a luz (a da tela), como a massa clara de
// desenhar_caixa, mas com a largura pedida: numa peça estreita a massa da família some.
void borda_clara(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float r, float w, float valor, int v, float px) {
	vec2 p = m - c;
	float co = contorno_para(b);
	float dentro = cobre(sd_caixa(p, b, r) + co, px);
	if (dentro <= 0.0) {
		return;
	}
	vec2 lm = movel_de(LUZ, v);
	pousar(av, ac, valor, 1, dentro * (1.0 - cobre(sd_caixa(p + lm * w, b, r) + co, px)));
}

// O meio do módulo mais perto de x: o desenho tem módulos inteiros de PERIODO casas entre
// as pontas, com a divisória e o suporte no meio de cada um.
float meio_do_modulo(float x, float hx) {
	float x0 = -hx + PONTA;
	float n = max(1.0, round((2.0 * hx - 2.0 * PONTA) / PERIODO));
	float k = clamp(floor((x - x0) / PERIODO), 0.0, n - 1.0);
	return x0 + (k + 0.5) * PERIODO;
}

void de_cima(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	float xm = meio_do_modulo(m.x, h.x);
	// 1. A prateleira de trás: a tábua, os vãos escuros e a divisória do módulo.
	vec2 cp = vec2(0.0, (PRAT_Y0 + PRAT_Y1) * 0.5);
	vec2 bp = vec2(h.x - PRAT_RECUO, (PRAT_Y1 - PRAT_Y0) * 0.5);
	desenhar_caixa(av, ac, m, cp, bp, 0.02, V_MEIO - 0.08, 0.02, 1, vir, px);
	vec2 bv = vec2(bp.x - VAO_RECUO, bp.y - VAO_RECUO * 0.5);
	vec2 cv = cp + vec2(0.0, VAO_RECUO * 0.5);
	float dv = sd_caixa(m - cv, bv, 0.012);
	if (dv < px) {
		// O vão: o fundo escuro e a sombra que a beira de cima (na tela) joga dentro.
		float dentro_v = cobre(dv, px);
		pousar(av, ac, V_FUNDO + 0.02, 1, dentro_v);
		float dsv = sd_caixa(m - cv + lm * 0.035, bv, 0.012);
		pousar(av, ac, V_FUNDO + 0.1, 1, dentro_v * cobre(dsv, px));
	}
	if (abs(m.x - xm) < DIVISORIA + 0.05) {
		desenhar_caixa(av, ac, m, vec2(xm, cv.y), vec2(DIVISORIA, bv.y + 0.008), 0.012, V_LUZ - 0.03, 0.018, 1, vir, px);
	}
	// 2. O tampo grosso, em 2 massas: a tábua larga de cima e, na frente, a moldura larga e
	// clara, com o contorno dela (a junta firme) e a borda que pega a luz.
	vec2 ct = vec2(0.0, (TAMPO_Y0 + TAMPO_Y1) * 0.5);
	vec2 bt = vec2(h.x, (TAMPO_Y1 - TAMPO_Y0) * 0.5);
	desenhar_caixa(av, ac, m, ct, bt, QUINA, V_MEIO, 0.04, 1, vir, px);
	vec2 cm = vec2(0.0, (MOLDURA_Y0 + TAMPO_Y1) * 0.5);
	vec2 bm = vec2(h.x - 0.008, (TAMPO_Y1 - MOLDURA_Y0) * 0.5);
	desenhar_caixa(av, ac, m, cm, bm, QUINA * 0.7, V_LUZ, 0.028, 1, vir, px);
	borda_clara(av, ac, m, cm, bm, QUINA * 0.7, LUZ_DA_MOLDURA, V_LUZ + MASSA_CLARA, vir, px);
	// 3. A barra de pé: as voltas das pontas, o suporte do módulo e a barra.
	float xb = h.x - BARRA_FIM;
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		barra(av, ac, m, vec2(sx * xb, TAMPO_Y1 - 0.03), vec2(sx * xb, BARRA_Y), BARRA_R * 0.9, vir, px);
	}
	if (abs(m.x - xm) < SUPORTE + 0.03) {
		barra(av, ac, m, vec2(xm, TAMPO_Y1 - 0.02), vec2(xm, BARRA_Y), SUPORTE, vir, px);
	}
	barra(av, ac, m, vec2(-xb, BARRA_Y), vec2(xb, BARRA_Y), BARRA_R, vir, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	de_cima(q, px, vir, av, ac);
}

#include "res://comum/rodape_movel.gdshaderinc"

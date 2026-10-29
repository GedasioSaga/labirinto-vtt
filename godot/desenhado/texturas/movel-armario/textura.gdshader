// ARMÁRIO de cozinha desenhado que pega cor (onda 4, lote 10; CONTRATO.md seção 10).
//
// Parte do piloto movel-cadeira (vista de lado). Desenhado no referencial do armário e
// aceso no da tela (movel_de / tela_de): a luz fica em cima à esquerda em toda virada.
// Contorno grosso na própria cor nas peças de fora; as portas e o nicho, que são de
// dentro, levam uma borda fina e as duas massas de luz. Nada de veio, prego ou nó.
//
// DE CIMA (a pegada 1 x 0,5; 2 viradas: o armário é simétrico de lado a lado, não de
// frente para trás):
// - atrás, o ARMÁRIO DE CIMA (o mais alto, o mais claro), um bloco calmo;
// - na frente, a BANCADA, 2 tábuas largas ao longo, com a junta firme; a sombra do
//   armário de cima cobre a tábua de trás quando a luz vem de trás (dentro, é valor), e
//   a da frente, mais larga, fica na luz;
// - os 2 PUXADORES (lugar 2) saindo da beira da frente, junto da fresta das portas de baixo.
// DE LADO (a Frente/Lado do mestre, 1 x 1,5: o armário em pé, visto de frente; 2 viradas,
// simétrico de lado a lado): a coroa, as 2 portas de cima, o nicho aberto, a bancada, as
// 2 portas de baixo e o rodapé; um puxador em pé por porta, junto da fresta do meio e da
// bancada. Os de baixo estão no mesmo x dos da vista de cima: é o mesmo armário.
// Lugares: 1 = a madeira, 2 = os puxadores. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As medidas que as duas vistas dividem (em casas) ----
const float BANCADA_MEIA_X = 0.49;  // a bancada passa um pouco do corpo
const float COROA_MEIA_X = 0.475;   // o topo do armário de cima
const float CORPO_MEIA_X = 0.455;
const float PORTA_FORA = 0.39;      // a beira de fora das portas
const float PORTA_MEIO = 0.022;     // meia fresta entre as duas portas
const float X_DO_PUXADOR = 0.1;     // junto da fresta do meio, na beira que abre
const float BORDA_DO_PAINEL = 0.02; // a borda fina das portas e do nicho
const float QUINA = 0.03;

// ---- De cima ----
const float FUNDO_DO_ALTO = 0.45;   // a parte de trás que é o armário de cima (o DEGRAU do app)
const float FRENTE_DA_BANCADA = 0.02;
const vec2 SOMBRA_DO_ALTO = vec2(0.035, 0.085); // para onde a sombra do armário de cima cai, na tela (até a junta)
const float TABUA_DE_TRAS = 0.4; // a tábua de trás da bancada, em fração do fundo que aparece
const float JUNTA = 0.009;
const float LUZ_DA_BORDA = 0.022;
const vec2 PUXADOR_DE_CIMA = vec2(0.024, 0.05);

// ---- De lado ----
const vec2 PUXADOR_DE_FRENTE = vec2(0.024, 0.065);
const vec2 SOMBRA_NO_NICHO = vec2(-0.03, -0.09); // a sombra que o armário de cima joga no nicho, na tela

// Um puxador de metal (lugar 2): contorno fino e três massas pela luz da tela, como o aro
// do barril (escuro embaixo à direita, o tom no meio, o brilho em cima à esquerda).
void puxador(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, int v, float px) {
	vec2 p = m - c;
	float r = min(b.x, b.y) * 0.55;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	float co = contorno_para(b);
	pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
	float dentro = cobre(d + co, px);
	vec2 s = tela_de(p, v);
	vec2 bs = v % 2 == 1 ? b.yx : b;
	float l = dot(s / bs, LUZ);
	float valor = mix(V_SOMBRA - 0.02, V_MEIO + 0.02, smoothstep(-0.7, -0.1, l));
	valor = mix(valor, V_REALCE + 0.06, smoothstep(0.2, 0.45, l));
	pousar(av, ac, valor, 2, dentro);
}

// Um painel de dentro (a porta): a borda fina no escuro de dentro, o recheio e as duas
// massas de luz de desenhar_caixa.
void painel(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float valor, float bisel, int v, float px) {
	vec2 p = m - c;
	float r = 0.014;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_FUNDO, 1, cobre(d, px));
	float dentro = cobre(d + BORDA_DO_PAINEL, px);
	pousar(av, ac, valor, 1, dentro);
	vec2 lm = movel_de(LUZ, v);
	pousar(av, ac, valor - MASSA_ESCURA, 1, dentro * (1.0 - cobre(sd_caixa(p - lm * bisel * 1.5, b, r) + BORDA_DO_PAINEL, px)));
	pousar(av, ac, valor + MASSA_CLARA, 1, dentro * (1.0 - cobre(sd_caixa(p + lm * bisel, b, r) + BORDA_DO_PAINEL, px)));
}

// O nicho aberto entre o armário de cima e a bancada: fundo, e a sombra que a peça de cima
// joga para dentro (em cima e um pouco à esquerda, pela luz da tela).
void nicho(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, int v, float px) {
	vec2 p = m - c;
	float r = 0.01;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_FUNDO - 0.04, 1, cobre(d, px));
	float dentro = cobre(d + BORDA_DO_PAINEL, px);
	pousar(av, ac, V_SOMBRA - 0.02, 1, dentro);
	vec2 sh = movel_de(SOMBRA_NO_NICHO, v);
	pousar(av, ac, V_FUNDO, 1, dentro * (1.0 - cobre(sd_caixa(p + sh, b, r) + BORDA_DO_PAINEL, px)));
}

void de_cima(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	float y_degrau = -h.y + FUNDO_DO_ALTO * pm.y;
	float y_frente = h.y - FRENTE_DA_BANCADA;
	// A bancada: contorno, 2 tábuas, a junta e as massas da borda.
	float y0 = y_degrau - 0.05;
	vec2 cb = vec2(0.0, (y0 + y_frente) * 0.5);
	vec2 bb = vec2(BANCADA_MEIA_X, (y_frente - y0) * 0.5);
	float db = sd_caixa(m - cb, bb, QUINA);
	float dentro_b = cobre(db + CONTORNO_CASAS, px);
	if (db < px) {
		pousar(av, ac, V_CONTORNO, 1, cobre(db, px));
		float y_junta = mix(y_degrau, y_frente - CONTORNO_CASAS, TABUA_DE_TRAS);
		// A tábua de cima na TELA pega mais luz (na virada 2 é a da frente).
		float s_junta = tela_de(vec2(0.0, y_junta), vir).y;
		pousar(av, ac, V_MEIO + (q.y < s_junta ? 0.02 : 0.0), 1, dentro_b);
		desenhar_linha(av, ac, abs(m.y - y_junta), JUNTA, V_FUNDO, dentro_b, 1, px);
		float ds = sd_caixa(m - cb - lm * LUZ_DA_BORDA * 1.5, bb, QUINA) + CONTORNO_CASAS;
		float dl = sd_caixa(m - cb + lm * LUZ_DA_BORDA, bb, QUINA) + CONTORNO_CASAS;
		pousar(av, ac, V_SOMBRA, 1, dentro_b * (1.0 - cobre(ds, px)));
		pousar(av, ac, V_LUZ + 0.02, 1, dentro_b * (1.0 - cobre(dl, px)));
	}
	// O armário de cima e a sombra dele na bancada (só quando ela cai para dentro).
	vec2 ca = vec2(0.0, (-h.y + 0.01 + y_degrau) * 0.5);
	vec2 ba = vec2(COROA_MEIA_X, (y_degrau - (-h.y + 0.01)) * 0.5);
	float dsom = sd_caixa(movel_de(q - SOMBRA_DO_ALTO, vir) - ca, ba, QUINA);
	pousar(av, ac, V_SOMBRA - 0.05, 1, cobre(dsom, px) * dentro_b * 0.85);
	desenhar_caixa(av, ac, m, ca, ba, QUINA, V_MEIO + 0.06, 0.04, 1, vir, px);
	// Os puxadores das portas de baixo, saindo da beira da bancada.
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		puxador(av, ac, m, vec2(sx * X_DO_PUXADOR, y_frente - 0.012), PUXADOR_DE_CIMA, vir, px);
	}
}

void em_pe(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	float a0 = -h.y;
	float H = pm.y;
	// O rodapé, recuado e no escuro, por baixo do corpo.
	float r0 = a0 + 0.94 * H;
	float r1 = h.y - 0.006;
	desenhar_caixa(av, ac, m, vec2(0.0, (r0 + r1) * 0.5), vec2(CORPO_MEIA_X - 0.03, (r1 - r0) * 0.5), 0.01, V_SOMBRA - 0.02, 0.015, 1, vir, px);
	// O corpo: a moldura que aparece em volta das portas.
	float c0 = a0 + 0.035 * H;
	float c1 = a0 + 0.95 * H;
	desenhar_caixa(av, ac, m, vec2(0.0, (c0 + c1) * 0.5), vec2(CORPO_MEIA_X, (c1 - c0) * 0.5), QUINA, V_MEIO - 0.07, 0.05, 1, vir, px);
	// A coroa, o topo do armário de cima.
	float k0 = a0 + 0.004;
	float k1 = a0 + 0.06 * H;
	desenhar_caixa(av, ac, m, vec2(0.0, (k0 + k1) * 0.5), vec2(COROA_MEIA_X, (k1 - k0) * 0.5), 0.015, V_MEIO + 0.06, 0.025, 1, vir, px);
	// O nicho aberto.
	float n0 = a0 + 0.315 * H;
	float n1 = a0 + 0.555 * H;
	nicho(av, ac, m, vec2(0.0, (n0 + n1) * 0.5), vec2(PORTA_FORA, (n1 - n0) * 0.5), vir, px);
	// A bancada, que passa do corpo e pega a luz.
	float b0 = n1;
	float b1 = a0 + 0.60 * H;
	desenhar_caixa(av, ac, m, vec2(0.0, (b0 + b1) * 0.5), vec2(BANCADA_MEIA_X, (b1 - b0) * 0.5), 0.012, V_LUZ - 0.02, 0.02, 1, vir, px);
	// As portas, 2 em cima e 2 embaixo, e um puxador em cada, junto da bancada.
	float u0 = a0 + 0.085 * H;
	float u1 = a0 + 0.29 * H;
	float d0 = a0 + 0.625 * H;
	float d1 = a0 + 0.925 * H;
	float cx = (PORTA_MEIO + PORTA_FORA) * 0.5;
	float bx = (PORTA_FORA - PORTA_MEIO) * 0.5;
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		painel(av, ac, m, vec2(sx * cx, (u0 + u1) * 0.5), vec2(bx, (u1 - u0) * 0.5), V_MEIO + 0.03, 0.035, vir, px);
		painel(av, ac, m, vec2(sx * cx, (d0 + d1) * 0.5), vec2(bx, (d1 - d0) * 0.5), V_MEIO + 0.03, 0.04, vir, px);
		puxador(av, ac, m, vec2(sx * X_DO_PUXADOR, u1 - 0.085), PUXADOR_DE_FRENTE, vir, px);
		puxador(av, ac, m, vec2(sx * X_DO_PUXADOR, d0 + 0.095), PUXADOR_DE_FRENTE, vir, px);
	}
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (vis == 1) {
		em_pe(q, px, vir, av, ac);
	} else {
		de_cima(q, px, vir, av, ac);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

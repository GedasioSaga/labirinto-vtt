// APARADOR desenhado que pega cor (onda 4, lote 11; CONTRATO.md seção 10). Estica ao longo
// e o meio REPETE (10.6): a cada PERIODO casas, um par de portas que se encontram no meio,
// com os dois puxadores no encontro. Esticado, ganha portas em vez de esticar as que tem.
//
// Parte do armário aprovado (lote 10): o painel das portas, o puxador de metal e a vista
// de lado. Desenhado no referencial do aparador e aceso no da tela (movel_de / tela_de):
// a luz fica em cima à esquerda nas 2 viradas. Contorno grosso na própria cor nas peças de
// fora; as portas, que são de dentro, levam a borda fina e as duas massas de luz.
//
// DE CIMA (a pegada 2 x 0,5; 2 viradas: simétrico de lado a lado, não de frente para trás):
// - atrás, o ESPALDAR, a tábua alta encostada na parede (o mais claro: é o mais alto), que
//   joga a sombra no tampo quando a luz vem de trás;
// - o TAMPO calmo, 2 tábuas largas ao longo com a junta firme;
// - os PUXADORES (lugar 2) saindo da beira da frente, um par por módulo, no encontro das
//   portas. É o que separa o aparador do balcão (tampo grosso, vãos atrás, barra de pé).
// DE LADO (a Frente/Lado do mestre, 2 x 0,9: o aparador em pé, visto de frente): o
// espaldar, o tampo que sobra dos dois lados, o corpo com as portas (2 por módulo), um
// puxador em pé de cada lado do encontro, e o rodapé. Os puxadores estão no mesmo x nas
// duas vistas: é o mesmo aparador.
// A emenda de dois módulos cai no montante entre dois pares de portas, onde tudo é a mesma
// coluna (a costura que o exportador mede). Lugares: 1 = a madeira, 2 = os puxadores.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// O meio que repete: os mesmos números do config.json (esticar.pontasCasas, periodoCasas).
const float PONTA = 0.140625;  // 18 px: a borda do corpo e as massas dela ficam antes da faixa da emenda
const float PERIODO = 0.859375; // 110 px: 2 módulos no desenho de 2 casas

// ---- As medidas que as duas vistas dividem (em casas) ----
const float SOBRA = 0.035;          // o quanto o tampo sobra do corpo de cada lado
const float X_DO_PUXADOR = 0.042;   // do encontro das portas ao puxador
const float FRESTA = 0.012;         // meia fresta do encontro das portas
const float MONTANTE = 0.042;       // meio montante entre dois pares de portas (a emenda)
const float BORDA_DO_PAINEL = 0.02;
const float QUINA = 0.03;
const float JUNTA = 0.009;

// ---- De cima ----
const float ESPALDAR_FUNDO = 0.14;   // o fundo do espaldar, a partir de trás
const vec2 SOMBRA_DO_ESPALDAR = vec2(0.03, 0.06); // para onde a sombra dele cai, na tela
const float LUZ_DO_ESPALDAR = 0.022; // a borda do espaldar que pega a luz
const vec2 PUXADOR_DE_CIMA = vec2(0.026, 0.045);

// ---- De lado (fração da altura de 0,9, de cima para baixo) ----
const float LADO_ESPALDAR = 0.07;
const float LADO_TAMPO = 0.16;
const float LADO_PORTA_0 = 0.205;
const float LADO_PORTA_1 = 0.885;
const float LADO_RODAPE = 0.93;
const vec2 PUXADOR_DE_FRENTE = vec2(0.02, 0.075);

// Um puxador de metal (lugar 2), o do armário: contorno fino e três massas pela luz da tela.
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

// Um painel de dentro (a porta), o do armário: a borda fina no escuro de dentro, o recheio
// e as duas massas de luz.
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

// O meio (o encontro das portas) e o começo do módulo mais perto de x: o desenho tem
// módulos inteiros de PERIODO casas entre as pontas.
vec2 modulo_de(float x, float hx) {
	float x0 = -hx + PONTA;
	float n = max(1.0, round((2.0 * hx - 2.0 * PONTA) / PERIODO));
	float k = clamp(floor((x - x0) / PERIODO), 0.0, n - 1.0);
	return vec2(x0 + (k + 0.5) * PERIODO, x0 + k * PERIODO);
}

void de_cima(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	float xm = modulo_de(m.x, h.x).x;
	// O tampo: contorno, 2 tábuas e a junta.
	float y0 = -h.y + ESPALDAR_FUNDO - 0.03;
	float y1 = h.y - 0.035;
	vec2 ct = vec2(0.0, (y0 + y1) * 0.5);
	vec2 bt = vec2(h.x, (y1 - y0) * 0.5);
	desenhar_caixa(av, ac, m, ct, bt, QUINA, V_MEIO, 0.035, 1, vir, px);
	float dentro_t = cobre(sd_caixa(m - ct, bt, QUINA) + CONTORNO_CASAS, px);
	float y_junta = mix(-h.y + ESPALDAR_FUNDO, y1 - CONTORNO_CASAS, 0.5);
	desenhar_linha(av, ac, abs(m.y - y_junta), JUNTA, V_FUNDO, dentro_t, 1, px);
	// O espaldar e a sombra dele no tampo (só quando ela cai para dentro).
	vec2 ce = vec2(0.0, -h.y + 0.004 + ESPALDAR_FUNDO * 0.5);
	vec2 be = vec2(h.x - 0.012, ESPALDAR_FUNDO * 0.5);
	float dsom = sd_caixa(movel_de(q - SOMBRA_DO_ESPALDAR, vir) - ce, be, 0.02);
	pousar(av, ac, V_SOMBRA - 0.03, 1, cobre(dsom, px) * dentro_t * 0.8);
	desenhar_caixa(av, ac, m, ce, be, 0.02, V_LUZ + 0.03, 0.022, 1, vir, px);
	borda_clara(av, ac, m, ce, be, 0.02, LUZ_DO_ESPALDAR, V_LUZ + 0.03 + MASSA_CLARA, vir, px);
	// Os puxadores do módulo, saindo da beira da frente.
	if (abs(m.x - xm) < X_DO_PUXADOR + 0.06) {
		for (int i = 0; i < 2; i++) {
			float sx = i == 0 ? -1.0 : 1.0;
			puxador(av, ac, m, vec2(xm + sx * X_DO_PUXADOR, y1 + 0.022), PUXADOR_DE_CIMA, vir, px);
		}
	}
}

void em_pe(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	vec2 mod_ = modulo_de(m.x, h.x);
	float xm = mod_.x;
	float x0 = mod_.y;
	float a0 = -h.y;
	float H = pm.y;
	// O rodapé, recuado e no escuro.
	float r0 = a0 + LADO_PORTA_1 * H;
	float r1 = h.y - 0.006;
	desenhar_caixa(av, ac, m, vec2(0.0, (r0 + r1) * 0.5), vec2(h.x - SOBRA - 0.03, (r1 - r0) * 0.5), 0.01, V_SOMBRA - 0.02, 0.015, 1, vir, px);
	// O corpo: a moldura que aparece em volta das portas.
	float c0 = a0 + LADO_TAMPO * H - 0.01;
	float c1 = a0 + LADO_RODAPE * H;
	desenhar_caixa(av, ac, m, vec2(0.0, (c0 + c1) * 0.5), vec2(h.x - SOBRA, (c1 - c0) * 0.5), QUINA, V_MEIO - 0.07, 0.02, 1, vir, px);
	// O espaldar, por trás e acima do tampo.
	float e0 = a0 + 0.004;
	float e1 = a0 + (LADO_ESPALDAR + 0.02) * H;
	desenhar_caixa(av, ac, m, vec2(0.0, (e0 + e1) * 0.5), vec2(h.x - 0.012, (e1 - e0) * 0.5), 0.015, V_MEIO - 0.02, 0.02, 1, vir, px);
	// O tampo, que sobra dos dois lados e pega a luz.
	float t0 = a0 + LADO_ESPALDAR * H;
	float t1 = a0 + LADO_TAMPO * H;
	desenhar_caixa(av, ac, m, vec2(0.0, (t0 + t1) * 0.5), vec2(h.x, (t1 - t0) * 0.5), 0.015, V_LUZ, 0.025, 1, vir, px);
	// As 2 portas do módulo e um puxador em pé de cada lado do encontro.
	float u0 = a0 + LADO_PORTA_0 * H;
	float u1 = a0 + LADO_PORTA_1 * H;
	float cy = (u0 + u1) * 0.5;
	float by = (u1 - u0) * 0.5;
	float fora = x0 + MONTANTE;
	float bx = (xm - FRESTA - fora) * 0.5;
	painel(av, ac, m, vec2(fora + bx, cy), vec2(bx, by), V_MEIO + 0.03, 0.04, vir, px);
	painel(av, ac, m, vec2(xm + FRESTA + bx, cy), vec2(bx, by), V_MEIO + 0.03, 0.04, vir, px);
	float yp = u0 + 0.32 * (u1 - u0);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		puxador(av, ac, m, vec2(xm + sx * X_DO_PUXADOR, yp), PUXADOR_DE_FRENTE, vir, px);
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

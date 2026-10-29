// GELADEIRA desenhada que pega cor (onda 4, lote 14; CONTRATO.md seção 10): a caixa de
// gelo de madeira da época, um armário alto e quadrado, vista de cima.
//
// Da família do piloto (mesa, cadeira, barril) e do baú e do armário do lote 10: contorno
// grosso na própria cor, formas grandes e luz em poucas massas, a de cima à esquerda. Nada
// de veio, rebite em bolinha ou granulado. Desenhado no referencial da geladeira (a frente
// é o lado de baixo) e aceso no da tela (movel_de / tela_de).
//
// DE CIMA (a pegada 1 x 0,75; 4 viradas: a porta abre para um lado só, então ela não é
// simétrica nem de lado a lado):
// - a MOLDURA (lugar 1): o tampo inteiro, uma faixa larga e clara de madeira em volta,
//   com as duas massas de luz da borda; a da frente é mais larga, porque é dela que saem
//   as ferragens;
// - a TAMPA DO GELO (lugar 1) rebaixada na moldura e mais escura que ela: a fresta funda
//   em volta, 3 tábuas largas de trás para a frente (o baú tem as dele ao comprido) com a
//   junta firme, e a sombra que a moldura joga para dentro na beira que fica do lado da
//   luz (a do outro lado é a parede de dentro, acesa);
// - as FERRAGENS da porta da frente (lugar 2), duas chapas largas que passam da beira da
//   frente, cada uma com o brilho em cima à esquerda e a sombra curta na madeira: a
//   DOBRADIÇA, alta e estreita, perto da quina de um lado, e o TRINCO, deitado e mais
//   largo, do outro.
// O que a separa do baú (tampa abaulada de tábuas ao comprido, cintas de trás até a frente,
// cantoneiras nas 4 quinas, fecho no meio) e do armário (dois blocos em degrau, puxadores
// em par no meio): a moldura em volta da tampa funda, as tábuas atravessadas e o metal só
// na beira da frente, para um lado e para o outro. A sombra comprida do app diz que é alta.
// Lugares: 1 = a madeira, 2 = as ferragens. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RECUO = 0.006;          // a forma recuada da pegada, casas
const float QUINA = 0.045;          // o raio da quina do tampo
const float LUZ_DA_MOLDURA = 0.042; // a massa clara da borda do tampo (a escura é 1,5 x)

// A tampa do gelo, no referencial da geladeira (y para a frente).
const vec2 TAMPA_MEIA = vec2(0.34, 0.2);
const float TAMPA_Y = -0.03;        // um pouco para trás: a faixa da frente fica mais larga
const float QUINA_TAMPA = 0.02;
const float FRESTA = 0.018;         // a fresta funda em volta da tampa
const float TABUAS = 3.0;
const float JUNTA = 0.009;          // meia largura da junta entre as tábuas
const float REBAIXO = 0.045;        // a largura da sombra que a moldura joga na tampa
const vec3 TONS_DAS_TABUAS = vec3(0.02, -0.025, 0.0); // o tom de cada tábua em volta do da tampa

// As ferragens (x a partir do meio, y = o meio da peça a partir da beira da frente).
const vec2 DOBRADICA = vec2(0.07, 0.1);
const float X_DA_DOBRADICA = -0.36;
const vec2 CHAPA_DO_TRINCO = vec2(0.13, 0.08);
const float X_DO_TRINCO = 0.24;
const float SOBRA = 0.046;          // o quanto as ferragens passam da beira da frente
const vec2 SOMBRA_CURTA = vec2(0.016, 0.02); // para onde a ferragem levantada joga a sombra na madeira, casas (na tela)

// Uma peça de metal (lugar 2): o contorno da peça, o tom e as duas massas de borda, com
// o brilho mais alto que o da madeira (V_REALCE), como as cintas do baú. bisel = a
// largura da massa de luz, casas (a de sombra é 1,5 x).
void ferragem(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float r, float valor, float bisel, int vir, float px) {
	vec2 p = m - c;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	float co = contorno_para(b);
	pousar(av, ac, V_CONTORNO + 0.02, 2, cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar(av, ac, valor, 2, dentro);
	vec2 lm = movel_de(LUZ, vir);
	// A peça é estreita: as massas contam da borda de dentro do contorno, até 35% dela.
	float wl = min(bisel, 0.35 * min(b.x, b.y));
	float ws = min(bisel * 1.5, 0.45 * min(b.x, b.y));
	pousar(av, ac, V_SOMBRA - 0.02, 2, dentro * (1.0 - cobre(sd_caixa(p - lm * ws, b, r) + co, px)));
	pousar(av, ac, V_REALCE, 2, dentro * (1.0 - cobre(sd_caixa(p + lm * wl, b, r) + co, px)));
}

// A sombra curta de uma peça levantada na madeira de baixo.
void sombra_curta(inout vec4 av, inout vec4 ac, vec2 ms, vec2 c, vec2 b, float r, float madeira, float px) {
	pousar(av, ac, V_SOMBRA - 0.04, 1, cobre(sd_caixa(ms - c, b, r), px) * madeira * 0.75);
}

void de_cima(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 bt = pm * 0.5 - vec2(RECUO);
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	float dt = sd_caixa(m, bt, QUINA);
	if (dt > SOBRA + px) {
		return;
	}
	// A moldura: o tampo inteiro com o contorno e as massas da borda.
	desenhar_caixa(av, ac, m, vec2(0.0), bt, QUINA, V_MEIO + 0.04, LUZ_DA_MOLDURA, 1, vir, px);
	float madeira = cobre(dt + CONTORNO_CASAS, px);

	// A tampa do gelo, funda na moldura.
	vec2 ct = vec2(0.0, TAMPA_Y);
	vec2 p = m - ct;
	vec2 bf = TAMPA_MEIA + vec2(FRESTA);
	float df = sd_caixa(p, bf, QUINA_TAMPA + FRESTA);
	if (df < px) {
		// A fresta: funda do lado da luz, a parede de dentro acesa do outro.
		float buraco = cobre(df, px);
		pousar(av, ac, V_FUNDO - 0.02, 1, buraco);
		float parede = 1.0 - cobre(sd_caixa(p - lm * FRESTA * 1.2, bf, QUINA_TAMPA + FRESTA), px);
		pousar(av, ac, V_SOMBRA + 0.02, 1, buraco * parede);
		// As tábuas, de trás para a frente, cada uma no seu tom.
		float dtampa = sd_caixa(p, TAMPA_MEIA, QUINA_TAMPA);
		float tampa = cobre(dtampa, px);
		float larg = 2.0 * TAMPA_MEIA.x / TABUAS;
		float tx = (p.x + TAMPA_MEIA.x) / larg;
		float j = clamp(floor(tx), 0.0, TABUAS - 1.0);
		float tom = j < 0.5 ? TONS_DAS_TABUAS.x : (j < 1.5 ? TONS_DAS_TABUAS.y : TONS_DAS_TABUAS.z);
		pousar(av, ac, V_MEIO - 0.05 + tom, 1, tampa);
		float k = floor(tx + 0.5);
		if (k >= 1.0 && k <= TABUAS - 1.0) {
			desenhar_linha(av, ac, abs(tx - k) * larg, JUNTA, V_FUNDO, tampa, 1, px);
		}
		// A sombra da moldura na beira da tampa que fica do lado da luz.
		float sombra = 1.0 - cobre(sd_caixa(p + lm * REBAIXO, TAMPA_MEIA, QUINA_TAMPA), px);
		pousar(av, ac, V_SOMBRA - 0.02, 1, tampa * sombra * 0.9);
	}

	// As ferragens da porta, na beira da frente.
	vec2 ms = movel_de(q - SOMBRA_CURTA, vir);
	float yb = bt.y;
	vec2 cd = vec2(X_DA_DOBRADICA, yb + SOBRA - DOBRADICA.y);
	sombra_curta(av, ac, ms, cd, DOBRADICA, 0.024, madeira, px);
	ferragem(av, ac, m, cd, DOBRADICA, 0.024, V_MEIO + 0.04, 0.026, vir, px);
	vec2 cc = vec2(X_DO_TRINCO, yb + SOBRA - CHAPA_DO_TRINCO.y);
	sombra_curta(av, ac, ms, cc, CHAPA_DO_TRINCO, 0.024, madeira, px);
	ferragem(av, ac, m, cc, CHAPA_DO_TRINCO, 0.024, V_MEIO + 0.03, 0.026, vir, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	de_cima(q, px, vir, av, ac);
}

#include "res://comum/rodape_movel.gdshaderinc"

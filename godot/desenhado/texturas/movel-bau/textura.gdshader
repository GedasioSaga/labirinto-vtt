// BAÚ desenhado que pega cor (onda 4, lote 10; CONTRATO.md seção 10).
//
// Da família do piloto (mesa, cadeira, barril): contorno grosso na própria cor, formas
// grandes e luz em poucas massas, a de cima à esquerda. Nada de veio, rebite em bolinha ou
// granulado. Desenhado no referencial do baú e aceso no da tela (movel_de / tela_de).
//
// DE FRENTE (vista de cima; 2 viradas: o fecho na frente, embaixo, e atrás; as de lado
// saem transpostas, porque ele é simétrico de lado a lado):
// - a TAMPA ABAULADA (lugar 1): 3 tábuas largas ao comprido, cada uma num tom chapado pelo
//   quanto a sua face do arco olha para a luz (a de trás clara, a da crista no tom, a da
//   frente funda), com a junta firme e as massas da borda;
// - as QUINAS (lugar 2): a cantoneira em L que corre pela beira da tampa em cada quina, no
//   lugar do contorno (uma chapa só, sem o quadradinho que a 50% vira ponto), cada uma no
//   tom do lado em que está;
// - as duas CINTAS (lugar 2): faixas largas de metal de trás até a frente, que dobram com o
//   arco (o pedaço de cada tábua no seu tom: o brilho na face que pega a luz), com a sombra
//   curta na madeira;
// - o FECHO (lugar 2): uma chapa no meio da frente, passando da beira, com o buraco da
//   fechadura numa massa escura só.
// DE LADO (a Frente/Lado do mestre; o baú visto pela ponta, 0,6 x 0,6; 2 viradas): a tampa
// em arco com a beira de metal (a cinta vista de lado: clara em cima à esquerda, funda à
// direita), o corpo de 2 tábuas largas um pouco mais estreito que a tampa, a sombra curta
// da tampa nele, a alça de metal no meio e as cantoneiras em L nas quinas de baixo.
// Lugares: 1 = a madeira, 2 = as ferragens. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float RECUO = 0.006;          // a forma recuada da pegada, casas
const float JUNTA = 0.009;          // meia largura da junta entre as tábuas
const float LUZ_DA_BORDA = 0.04;    // a massa clara da borda (a escura é 1,5 x)
const vec2 SOMBRA_CURTA = vec2(0.016, 0.02); // para onde a ferragem levantada joga a sombra na madeira, casas (na tela)
const float METAL_DENTRO = 0.016;   // o contorno da ferragem do lado da madeira (o do aro do barril)
const float CANTONEIRA = 0.075;     // a largura da cantoneira em L, da beira para dentro
const float CANTONEIRA_FORA = 0.018; // o contorno de fora dela (peça estreita: contorno_para)

// De cima.
const float QUINA_TAMPA = 0.05;
const float TABUAS = 3.0;
const float ARCO = 0.07;            // o quanto o tom das tábuas anda com o arco
const vec2 BRACO = vec2(0.1, 0.115); // o comprimento dos braços da cantoneira, ao comprido e ao fundo
const float CINTA_X = 0.3;          // o meio de cada cinta, a partir do meio do baú
const float CINTA_MEIA = 0.058;
const vec2 FECHO = vec2(0.066, 0.076); // a meia medida do fecho
const float FECHO_SOBRA = 0.024;    // o quanto o fecho passa da beira da frente
const vec2 FECHADURA = vec2(0.018, 0.032);

// De lado.
const float COSTURA = 0.42;         // a fração da altura, de cima, onde a tampa encontra o corpo
const float CORPO_DENTRO = 0.016;   // o corpo um pouco mais estreito que a tampa
const float BEIRA = 0.095;          // a largura da beira de metal do arco
const vec2 ALCA = vec2(0.095, 0.04);
const vec2 BRACO_LADO = vec2(0.12, 0.12);

// O quanto uma face do arco olha para a luz, na tela, de -1 a 1. f = onde ela fica no
// fundo do baú (-1 = atrás, 0 = a crista, 1 = na frente; no lado, a de cima e a de baixo).
float luz_do_arco(float f, int vir) {
	return dot(tela_de(vec2(0.0, f), vir), LUZ) / 0.7071;
}

// O tom do metal pela luz, em 3 massas de borda firme: o fundo, o meio e o brilho.
float tom_do_metal(float l) {
	float t = mix(V_SOMBRA - 0.02, V_MEIO + 0.03, smoothstep(-0.5, -0.3, l));
	return mix(t, V_REALCE, smoothstep(0.3, 0.5, l));
}

// A face do arco em que cai um y do móvel, de -1 a 1, com a dobra suave na junta.
float face_do_arco(float y, float y0, float alto, float n) {
	float ty = (y - y0) / (alto / n);
	float f = 0.0;
	for (int k = 1; k < 3; k++) {
		if (float(k) <= n - 1.0) {
			f += smoothstep(float(k) - 0.06, float(k) + 0.06, ty);
		}
	}
	return n > 1.0 ? f / (n - 1.0) * 2.0 - 1.0 : 0.0;
}

// Um painel de tábuas ao comprido (x do móvel): contorno, tábuas chapadas pelo arco,
// juntas e as massas da borda. base = o tom da crista; forca = o quanto o arco anda.
void painel(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float r, float n, float base, float forca, int vir, float px) {
	vec2 p = m - c;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CONTORNO_CASAS, px);
	float alto = 2.0 * (b.y - CONTORNO_CASAS);
	float larg = alto / n;
	float ty = (p.y + b.y - CONTORNO_CASAS) / larg;
	float j = clamp(floor(ty), 0.0, n - 1.0);
	float f = j / (n - 1.0) * 2.0 - 1.0;
	pousar(av, ac, base + forca * luz_do_arco(f, vir), 1, dentro);
	float k = floor(ty + 0.5);
	if (k >= 1.0 && k <= n - 1.0) {
		desenhar_linha(av, ac, abs(ty - k) * larg, JUNTA, V_FUNDO, dentro, 1, px);
	}
	vec2 lm = movel_de(LUZ, vir);
	float ds = sd_caixa(p - lm * LUZ_DA_BORDA * 1.5, b, r) + CONTORNO_CASAS;
	float dl = sd_caixa(p + lm * LUZ_DA_BORDA, b, r) + CONTORNO_CASAS;
	pousar(av, ac, V_SOMBRA - 0.01, 1, dentro * (1.0 - cobre(ds, px)));
	pousar(av, ac, V_LUZ + 0.04, 1, dentro * (1.0 - cobre(dl, px)));
}

// Uma chapa de metal presa na beira de uma forma (a cinta, a beira do arco): d_chapa = a
// chapa sem a beira, d_forma = a forma que ela cobre. O contorno de fora é o da forma
// (fora, casas); o de dentro, o fino do aro do barril.
void chapa_na_beira(inout vec4 av, inout vec4 ac, float d_chapa, float d_forma, float fora, float tom, float px) {
	pousar(av, ac, V_CONTORNO + 0.02, 2, cobre(max(d_chapa, d_forma), px));
	pousar(av, ac, tom, 2, cobre(max(d_chapa + METAL_DENTRO, d_forma + fora), px));
}

// A cantoneira em L: a faixa de CANTONEIRA casas por dentro da beira de uma forma (d_forma),
// só onde a caixa da quina (d_quina) a corta.
void cantoneira(inout vec4 av, inout vec4 ac, float d_forma, float d_quina, float tom, float px) {
	float faixa = -(d_forma + CANTONEIRA);
	pousar(av, ac, V_CONTORNO + 0.02, 2, cobre(max(max(d_forma, faixa), d_quina), px));
	float recheio = max(max(d_forma + CANTONEIRA_FORA, faixa + METAL_DENTRO), d_quina + METAL_DENTRO);
	pousar(av, ac, tom, 2, cobre(recheio, px));
}

void de_cima(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 bt = pm * 0.5 - vec2(RECUO);
	vec2 m = movel_de(q, vir);
	float dt = sd_caixa(m, bt, QUINA_TAMPA);
	if (dt > FECHO_SOBRA + px) {
		return;
	}
	// A tampa.
	painel(av, ac, m, vec2(0.0), bt, QUINA_TAMPA, TABUAS, V_MEIO + 0.015, ARCO, vir, px);
	float madeira = cobre(dt + CONTORNO_CASAS, px);
	vec2 ms = movel_de(q - SOMBRA_CURTA, vir); // o ponto que joga sombra aqui
	// As cantoneiras nas quatro quinas.
	for (int i = 0; i < 4; i++) {
		vec2 s = vec2(i % 2 == 0 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0);
		float dq = sd_caixa(m - s * (bt - BRACO * 0.5 + vec2(0.03)), BRACO * 0.5 + vec2(0.03), 0.02);
		float l = dot(normalize(tela_de(s, vir)), LUZ);
		cantoneira(av, ac, dt, dq, tom_do_metal(l), px);
	}
	// As cintas: a sombra curta na madeira e a faixa que dobra com o arco.
	float f = face_do_arco(m.y, -bt.y + CONTORNO_CASAS, 2.0 * (bt.y - CONTORNO_CASAS), TABUAS);
	float la = luz_do_arco(f, vir);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		vec2 cs = vec2(sx * CINTA_X, 0.0);
		vec2 bs = vec2(CINTA_MEIA, bt.y + 0.04);
		// O lado da cinta na tela (a da esquerda pega um pouco mais de luz).
		float lx = dot(tela_de(vec2(sx, 0.0), vir), LUZ) / 0.7071;
		pousar(av, ac, V_SOMBRA - 0.04, 1, cobre(sd_caixa(ms - cs, bs, 0.012), px) * madeira * 0.75);
		chapa_na_beira(av, ac, sd_caixa(m - cs, bs, 0.012), dt, CONTORNO_CASAS, tom_do_metal(la) + 0.025 * lx, px);
	}
	// O fecho: a sombra, a chapa com as massas e a fechadura numa massa escura só.
	vec2 cf = vec2(0.0, bt.y - FECHO.y + FECHO_SOBRA);
	pousar(av, ac, V_SOMBRA - 0.04, 1, cobre(sd_caixa(ms - cf, FECHO, 0.022), px) * madeira * 0.75);
	desenhar_caixa(av, ac, m, cf, FECHO, 0.022, V_MEIO - 0.01, 0.022, 2, vir, px);
	pousar(av, ac, V_FUNDO - 0.06, 2, cobre(sd_caixa(m - cf - vec2(0.0, 0.008), FECHADURA, FECHADURA.x * 0.9), px));
}

void de_lado(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	float yc = -h.y + COSTURA * pm.y;
	float fundo = h.y - RECUO;
	vec2 lm = movel_de(LUZ, vir);
	// A tampa em arco: meia elipse que entra um pouco no corpo (o corpo a cobre).
	vec2 cd = vec2(0.0, yc);
	vec2 e = vec2(h.x - RECUO, yc + h.y - RECUO);
	float dd = max(sd_elipse(m - cd, e), m.y - yc - 0.03);
	if (dd < px) {
		// A beira é peça estreita: o contorno de fora é o dela (contorno_para), como na cadeira.
		float fora = contorno_para(vec2(BEIRA * 0.5));
		pousar(av, ac, V_CONTORNO, 1, cobre(dd, px));
		float dentro = cobre(dd + fora, px);
		pousar(av, ac, V_MEIO + 0.05, 1, dentro);
		vec2 ei = e - vec2(BEIRA);
		// O painel da ponta da tampa é baixo: massas mais estreitas, para ele não virar só sombra.
		float ds = max(sd_elipse(m - cd - lm * LUZ_DA_BORDA * 0.9, ei), m.y - yc - 0.03);
		float dl = max(sd_elipse(m - cd + lm * LUZ_DA_BORDA * 0.6, ei), m.y - yc - 0.03);
		float painel_dentro = cobre(max(sd_elipse(m - cd, ei), m.y - yc - 0.03), px);
		pousar(av, ac, V_SOMBRA - 0.01, 1, painel_dentro * (1.0 - cobre(ds, px)));
		pousar(av, ac, V_LUZ + 0.04, 1, painel_dentro * (1.0 - cobre(dl, px)));
		// A beira de metal do arco, com o tom pela normal (na tela).
		vec2 p = m - cd;
		vec2 n = normalize(p / (e * e) + vec2(1e-5));
		float l = para_a_luz(tela_de(n, vir));
		chapa_na_beira(av, ac, -sd_elipse(p, ei), dd, fora, tom_do_metal(l), px);
	}
	// O corpo: 2 tábuas largas, um pouco mais estreito que a tampa.
	vec2 cc = vec2(0.0, (yc + fundo) * 0.5);
	vec2 bc = vec2(h.x - RECUO - CORPO_DENTRO, (fundo - yc) * 0.5);
	float dc = sd_caixa(m - cc, bc, 0.03);
	if (dc > px) {
		return;
	}
	painel(av, ac, m, cc, bc, 0.03, 2.0, V_MEIO - 0.01, 0.035, vir, px);
	float madeira = cobre(dc + CONTORNO_CASAS, px);
	vec2 ms = movel_de(q - SOMBRA_CURTA, vir);
	// A sombra curta da tampa no alto do corpo.
	float d_tampa_s = max(sd_elipse(ms - cd, e), ms.y - yc);
	pousar(av, ac, V_SOMBRA - 0.04, 1, cobre(d_tampa_s, px) * madeira * 0.75);
	// As cantoneiras das quinas de baixo.
	for (int i = 0; i < 2; i++) {
		vec2 s = vec2(i == 0 ? -1.0 : 1.0, 1.0);
		vec2 c = vec2(s.x * (bc.x - BRACO_LADO.x * 0.5 + 0.03), fundo - BRACO_LADO.y * 0.5 + 0.03);
		float dq = sd_caixa(m - c, BRACO_LADO * 0.5 + vec2(0.03), 0.02);
		float l = dot(normalize(tela_de(s, vir)), LUZ);
		cantoneira(av, ac, dc, dq, tom_do_metal(l), px);
	}
	// A alça no meio da ponta, com a sombra curta.
	vec2 ca = vec2(0.0, yc + (fundo - yc) * 0.3);
	pousar(av, ac, V_SOMBRA - 0.04, 1, cobre(sd_caixa(ms - ca, ALCA, 0.03), px) * madeira * 0.75);
	desenhar_caixa(av, ac, m, ca, ALCA, 0.03, V_MEIO, 0.02, 2, vir, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (vis == 1) {
		de_lado(q, px, vir, av, ac);
	} else {
		de_cima(q, px, vir, av, ac);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

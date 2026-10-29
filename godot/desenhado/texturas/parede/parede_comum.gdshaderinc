// =====================================================================
// texturas/parede/parede_comum.gdshaderinc: o que a PAREDE, a JANELA e a GRADE DE PRISÃO
// dividem (onda 5, lote 17; CONTRATO.md 11.15). As três incluem este arquivo depois de
// comum/traco.gdshaderinc; é ele que garante a mesma COLUNA DA COSTURA nas três (o
// exportador só mede dentro de cada item; a mesa da sala mede entre elas).
//
// A parede vista de cima, no espaço da face (11.3): q.x ao longo do traço, q.y atravessando
// a espessura, de 0 (o lado esquerdo de quem risca) a H (o direito). A imagem é SÓ O MIOLO:
// o contorno da família (os dois lados e a ponta) é do app, num passe por baixo, e por isso
// o T e o cruzamento de duas paredes se fundem sem fio no meio (11.15). Valores (tingir
// "familia-pedra": 0,5 = a cor do mestre), os da família dos móveis (CONTRATO 10.5).
//
// - O tampo é feito de BLOCOS largos (a pedra lavrada da parede): no Baixo uma fiada de
//   lajes compridas, no Médio uma fiada de blocos, no Alto (a muralha) duas fiadas
//   desencontradas. Entre dois blocos, a junta: uma fresta escura e larga, que abre um dente
//   onde encontra o contorno (o canto do bloco é redondo).
// - A COLUNA DA COSTURA é o meio de um bloco: o valor do meio, o chanfro das beiras e, no
//   Alto, a junta comprida entre as duas fiadas. Igual em todo módulo, altura e item.
// - Sem luz de direção: o chanfro (a beira e a ponta do bloco) vai no relevo e o app acende.
// =====================================================================

const float PV_CONTORNO = 0.10;
const float PV_FUNDO = 0.24;
const float PV_SOMBRA = 0.36;
const float PV_MEIO = 0.50;
const float PV_LUZ = 0.62;
const float PV_REALCE = 0.76;

const float PAREDE_JUNTA = 2.4;       // a fresta entre dois blocos, px do mundo
const float PAREDE_PASSA = 1.5;       // o bloco passa da banda: nenhum fio escuro na beira
const float PAREDE_TOM = 0.03;        // o tom de um bloco para o outro (poucas massas)
const float PAREDE_BEIRA = 0.70;      // o chanfro da beira (relevo para fora da parede)
const float PAREDE_PONTA = 0.55;      // o chanfro da ponta do bloco, na junta
const float PAREDE_GOLA = 0.40;       // o chanfro de cada fiada na junta comprida (Alto)
// O vão da janela e da grade: o fim do tampo (a ombreira) e o fio do corte.
const float PAREDE_OMBREIRA = 8.0;    // px do mundo da ponta do módulo ao corte
const float PAREDE_OMBREIRA_RAIO = 3.0;
const float PAREDE_CORTE = 2.0;       // o contorno do corte do tampo

float parede_raio(float H) {
	return clamp(0.26 * H, 3.0, 6.0);
}

// O tom de um bloco some perto das pontas do módulo: a costura é o valor do meio.
float parede_miolo(float x, float L) {
	float d = min(x, L - x);
	return smoothstep(COSTURA_PX, COSTURA_PX + 12.0, d);
}

// A fiada i: o y de cima e o de baixo. Baixo e Médio têm uma; o Alto, duas.
vec2 parede_fiada(int i, int alt, float H) {
	if (alt < 2) return vec2(0.0, H);
	float g = PAREDE_JUNTA * 0.5;
	return i == 0 ? vec2(0.0, H * 0.5 - g) : vec2(H * 0.5 + g, H);
}

int parede_qual_fiada(float y, int alt, float H) {
	return (alt < 2 || y < H * 0.5) ? 0 : 1;
}

// O bloco de x0 a x1 na fiada fy, de canto redondo r. A beira que é a da banda passa
// PAREDE_PASSA para fora (o contorno de lá é do app).
float parede_sd_bloco(vec2 q, float x0, float x1, vec2 fy, float H, float r) {
	float y0 = fy.x <= 0.0 ? -PAREDE_PASSA : fy.x;
	float y1 = fy.y >= H ? H + PAREDE_PASSA : fy.y;
	vec2 c = vec2(0.5 * (x0 + x1), 0.5 * (y0 + y1));
	vec2 b = vec2(0.5 * (x1 - x0), 0.5 * (y1 - y0));
	return sd_caixa(q - c, b, min(r, min(b.x, b.y)));
}

// A banda da face (o alfa): de 0 a H, a borda suave.
float parede_banda(float y, float H, float px) {
	return cobre(-y, px) * cobre(y - H, px);
}

// O chanfro de atravessado: a beira de cima vira para fora (-), a de baixo para fora (+); no
// Alto, cada fiada vira para a junta comprida do meio.
float parede_relevo_y(float y, int alt, float H) {
	float e = min(0.30 * H, 7.0);
	float r = -PAREDE_BEIRA * (1.0 - smoothstep(0.0, e, y)) + PAREDE_BEIRA * smoothstep(H - e, H, y);
	if (alt == 2) {
		float m = H * 0.5;
		float g = PAREDE_JUNTA * 0.5;
		float ei = min(0.16 * H, 6.0);
		r += PAREDE_GOLA * smoothstep(m - ei, m - g, y) * step(y, m);
		r -= PAREDE_GOLA * (1.0 - smoothstep(m + g, m + ei, y)) * step(m, y);
	}
	return r;
}

// O chanfro da ponta do bloco: vira para a junta, numa faixa de e px do mundo.
float parede_relevo_x(float x, float x0, float x1, float e) {
	return -PAREDE_PONTA * (1.0 - smoothstep(x0, x0 + e, x)) + PAREDE_PONTA * smoothstep(x1 - e, x1, x);
}

// O tampo no ponto q, dado o bloco [x0, x1] da fiada do ponto (x0 = -4096 ou x1 = 4096: o
// bloco segue para o módulo vizinho) e o tom dele. Devolve (valor, alfa) e o relevo.
vec2 parede_bloco(vec2 q, float x0, float x1, int alt, float H, float L, float tom, float px, out vec2 rel) {
	int f = parede_qual_fiada(q.y, alt, H);
	vec2 fy = parede_fiada(f, alt, H);
	float d = parede_sd_bloco(q, x0, x1, fy, H, parede_raio(H));
	float a = cobre(d, px);
	float v = mix(PV_FUNDO, PV_MEIO + tom * parede_miolo(q.x, L), a);
	float e = min(min(0.30 * H, 7.0), 0.3 * (x1 - x0));
	rel = vec2(parede_relevo_x(q.x, x0, x1, e) * a, parede_relevo_y(q.y, alt, H));
	return vec2(v, parede_banda(q.y, H, px));
}

// O VÃO (a janela e a grade): as duas ombreiras, o fim do tampo de cada lado com o corte em
// contorno, por cima do que o item pintou no vão (v_vao, rel_vao). Nos primeiros e últimos
// COSTURA_PX px a ombreira é exatamente a coluna da parede.
vec2 parede_vao(vec2 q, int alt, float H, float L, float v_vao, vec2 rel_vao, float px, out vec2 rel) {
	bool esq = q.x < 0.5 * L;
	float x0 = esq ? -4096.0 : L - PAREDE_OMBREIRA;
	float x1 = esq ? PAREDE_OMBREIRA : 4096.0;
	int f = parede_qual_fiada(q.y, alt, H);
	vec2 fy = parede_fiada(f, alt, H);
	float r = PAREDE_OMBREIRA_RAIO;
	float d = parede_sd_bloco(q, x0, x1, fy, H, r);
	float di = parede_sd_bloco(q, esq ? x0 : x0 + PAREDE_CORTE, esq ? x1 - PAREDE_CORTE : x1, fy, H, max(r - PAREDE_CORTE, 0.5));
	float a = cobre(d, px);
	float ai = cobre(di, px);
	// Fora do bloco: a junta da parede junto da ponta, o vão depois do corte.
	float sx = esq ? q.x - (x1 - r) : (x0 + r) - q.x;
	float w_tampo = 1.0 - smoothstep(0.0, r, sx);
	float fora = mix(v_vao, PV_FUNDO, w_tampo);
	// Por cobertura (fora, o anel do corte, o tampo): onde o anel não existe (as beiras de cima
	// e de baixo, d = di) a conta é a mesma da parede_bloco, e a costura fica igual à da parede.
	float anel = max(a - ai, 0.0);
	float v = (1.0 - a) * fora + anel * PV_CONTORNO + ai * PV_MEIO;
	float ep = PAREDE_OMBREIRA - COSTURA_PX - 1.0;
	vec2 rt = vec2(parede_relevo_x(q.x, x0, x1, ep) * a, parede_relevo_y(q.y, alt, H));
	rel = mix(rel_vao, rt, max(a, w_tampo));
	return vec2(v, parede_banda(q.y, H, px));
}

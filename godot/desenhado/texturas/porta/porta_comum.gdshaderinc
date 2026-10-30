// =====================================================================
// texturas/porta/porta_comum.gdshaderinc: o que as três PORTAS dividem (lote 18, 29/10/2026;
// CONTRATO.md 11.16). Incluído depois de comum/traco.gdshaderinc e de
// texturas/parede/parede_comum.gdshaderinc: as pontas de todo módulo são a COLUNA DA
// COSTURA da parede (a mesma ombreira da janela), e o vão emenda na parede sem degrau.
//
// Uma porta tem 4 módulos de 1 casa, um por estado (o app escolhe pelo estado, sem sorteio):
//   0 VAO      as duas ombreiras (o fim do tampo com o corte, parede_vao) e a SOLEIRA, o
//              fundo do vão, mais escuro que o tampo. É o que a parede desenha sempre no
//              trecho da porta, aberta ou fechada (e durante a animação).
//   1 FECHADA  a folha cheia, de ombreira a ombreira.
//   2 ABERTA   o batente: a mesma caixa vazada, o miolo deixa ver a soleira.
//   3 SECRETA  a folha fechada partida em 3 traços (o mestre vê; o jogador vê parede).
// Nos módulos 1 a 3 só a folha tem alfa entre as ombreiras (o app a pinta POR CIMA do vão,
// na cor da PORTA: a creme, a vermelha da trancada ou a cor própria); fora da folha, só as
// pontas da costura (os primeiros e os últimos COSTURA_PX px) são opacas, iguais ao vão.
//
// q.x ao longo (0 a L = 64), q.y atravessando a espessura (0 a H), como a parede. A folha
// fica no meio da espessura; tudo que atravessa é medido em fração de H (11.4). Valores na
// rampa da família da pedra (CONTRATO 10.5): 0,5 = a cor (da parede no vão, da porta na folha).
// Sem luz de direção: o chanfro da folha vai no relevo e o app acende.
// =====================================================================

const int PORTA_VAO = 0;
const int PORTA_FECHADA = 1;
const int PORTA_ABERTA = 2;
const int PORTA_SECRETA = 3;

const int FORMA_NORMAL = 0;
const int FORMA_DUPLA = 1;
const int FORMA_PORTAO = 2;

const float PORTA_SOLEIRA = 0.30;     // o fundo do vão (o tampo é 0,5; o peitoril da janela 0,36)
const float PORTA_X0 = 8.0;           // a folha começa onde a ombreira acaba (PAREDE_OMBREIRA)
const float PORTA_MEIA = 0.24;        // a meia espessura da folha, em fração de H
const float PORTA_MEIA_MIN = 2.2;     // px do mundo
const float PORTA_CONTORNO = 0.30;    // o contorno da folha, em fração da meia espessura
const float PORTA_ARO = 0.24;         // o aro claro do batente (aberta), idem
const float PORTA_ARO_DENTRO = 0.18;  // o contorno de dentro do batente, idem
const float PORTA_CHANFRO = 0.50;     // o relevo da beira da folha
const float PORTA_RAIO = 0.9;         // o canto da folha, px do mundo
const float PORTA_TRACOS = 3.0;       // a secreta: 3 traços e 2 vãos do mesmo tamanho
// O portão: o quadro vazado, os mourões nas pontas e uma travessa a cada período.
const float PORTAO_MOURAO = 6.0;      // o comprimento do mourão de cada ponta (o pedaço fixo)
const float PORTAO_PERIODO = 18.0;    // px do mundo entre duas travessas (o pedaço que repete)
const float PORTAO_BARRA = 0.42;      // a meia largura da travessa, em fração da meia da folha

float porta_meia(float H) {
	return max(PORTA_MEIA * H, PORTA_MEIA_MIN);
}

// Uma peça da folha: a caixa de x0 a x1 no meio da espessura, de meia altura m.
float porta_sd_caixa(vec2 q, float x0, float x1, float H, float m, float r) {
	vec2 c = vec2(0.5 * (x0 + x1), 0.5 * H);
	vec2 b = vec2(0.5 * (x1 - x0), m);
	return sd_caixa(q - c, b, min(r, min(b.x, b.y)));
}

// O chanfro de uma caixa: as beiras compridas viram para fora, as pontas também.
vec2 porta_relevo_caixa(vec2 q, float x0, float x1, float H, float m) {
	float e = max(0.45 * m, 1.0);
	float y0 = 0.5 * H - m;
	float y1 = 0.5 * H + m;
	float ry = -PORTA_CHANFRO * (1.0 - smoothstep(y0, y0 + e, q.y)) + PORTA_CHANFRO * smoothstep(y1 - e, y1, q.y);
	float ex = min(e, 0.3 * (x1 - x0));
	float rx = -PORTA_CHANFRO * (1.0 - smoothstep(x0, x0 + ex, q.x)) + PORTA_CHANFRO * smoothstep(x1 - ex, x1, q.x);
	return vec2(rx, ry);
}

// A soma das peças: (valor, alfa) e o relevo da peça mais coberta.
struct Folha {
	float a;       // cobre a caixa
	float corpo;   // cobre o corpo (dentro do contorno)
	float vazio;   // o miolo vazado do batente (aberta)
	vec2 rel;
	float melhor;
};

void porta_somar(inout Folha f, vec2 q, float d, float m, bool vazada, vec2 rel, float px) {
	float c = PORTA_CONTORNO * m;
	float a = cobre(d, px);
	float corpo = cobre(d + c, px);
	float vazio = 0.0;
	if (vazada) {
		float aro = c + PORTA_ARO * m;
		float dentro = aro + PORTA_ARO_DENTRO * m;
		// O corpo do batente é só o aro; o miolo é o contorno de dentro e o vazio.
		corpo = corpo * (1.0 - cobre(d + aro, px));
		vazio = cobre(d + dentro, px);
	}
	f.a = max(f.a, a * (1.0 - vazio));
	f.corpo = max(f.corpo, corpo);
	f.vazio = max(f.vazio, vazio);
	if (a > f.melhor) {
		f.melhor = a;
		f.rel = rel;
	}
}

void porta_caixa(inout Folha f, vec2 q, float x0, float x1, float H, float m, bool vazada, float px) {
	float d = porta_sd_caixa(q, x0, x1, H, m, PORTA_RAIO);
	porta_somar(f, q, d, m, vazada, porta_relevo_caixa(q, x0, x1, H, m), px);
}

// A folha de cada forma e estado. L = o comprimento do módulo; a folha vai de PORTA_X0 a L - PORTA_X0.
Folha porta_folha(vec2 q, float H, float L, int forma, int estado, float px) {
	Folha f = Folha(0.0, 0.0, 0.0, vec2(0.0), -1.0);
	float m = porta_meia(H);
	float x0 = PORTA_X0;
	float x1 = L - PORTA_X0;
	float c = PORTA_CONTORNO * m;
	bool vazada = estado == PORTA_ABERTA;
	if (estado == PORTA_SECRETA) {
		// Os 3 traços da folha fechada, como a secreta do Atual (drawDoors.ts).
		float peca = (x1 - x0) / (2.0 * PORTA_TRACOS - 1.0);
		for (int i = 0; i < 3; i++) {
			float a0 = x0 + peca * 2.0 * float(i);
			porta_caixa(f, q, a0, a0 + peca, H, m, false, px);
		}
		return f;
	}
	if (forma == FORMA_DUPLA) {
		// Duas folhas que se encontram no meio: a junta é o contorno das duas, encostado.
		float meio = 0.5 * L;
		porta_caixa(f, q, x0, meio + 0.5 * c, H, m, vazada, px);
		porta_caixa(f, q, meio - 0.5 * c, x1, H, m, vazada, px);
		return f;
	}
	if (forma == FORMA_PORTAO && !vazada) {
		// O portão visto de cima: o quadro vazado (os dois trilhos e os mourões das pontas) e
		// uma travessa larga a cada período, de trilho a trilho; entre elas o vão aparece (a
		// visão passa pelo portão). Sem bolinhas: as barras são massas do tamanho do quadro.
		porta_caixa(f, q, x0, x1, H, m, true, px);
		float bw = PORTAO_BARRA * m;
		float k = floor((q.x - (x0 + PORTAO_MOURAO)) / PORTAO_PERIODO);
		for (int j = -1; j <= 1; j++) {
			float cx = x0 + PORTAO_MOURAO + (k + float(j) + 0.5) * PORTAO_PERIODO;
			if (cx < x0 + PORTAO_MOURAO || cx > x1 - PORTAO_MOURAO) continue;
			porta_caixa(f, q, cx - bw, cx + bw, H, m, false, px);
		}
		return f;
	}
	porta_caixa(f, q, x0, x1, H, m, vazada, px);
	return f;
}

// O módulo inteiro: (valor, alfa) e o relevo.
vec2 porta_no_ponto(vec2 q, float H, float L, int alt, int forma, int estado, float px, out vec2 rel) {
	vec2 rel_vao;
	vec2 vao = parede_vao(q, alt, H, L, PORTA_SOLEIRA, vec2(0.0), px, rel_vao);
	if (estado == PORTA_VAO) {
		rel = rel_vao;
		return vao;
	}
	// As pontas da costura: iguais ao vão (o exportador mede; o app nunca as pinta por cima).
	float ponta = COSTURA_PX + 0.5;
	if (q.x < ponta || q.x > L - ponta) {
		rel = rel_vao;
		return vao;
	}
	Folha f = porta_folha(q, H, L, forma, estado, px);
	float v = mix(PV_CONTORNO, PV_MEIO, f.corpo);
	rel = f.rel * f.corpo;
	return vec2(v, f.a * parede_banda(q.y, H, px));
}

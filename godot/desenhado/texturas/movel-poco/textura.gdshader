// POÇO desenhado que pega cor (onda 4, lote 12; CONTRATO.md seção 10). O primeiro móvel
// com PEDRA: é a referência da pia, da fogueira e da lápide.
//
// Da família aprovada (piloto, lotes 10 e 11): contorno grosso na própria cor, formas
// grandes, a luz de cima à esquerda em poucas massas. Visto de cima, de baixo para cima:
// - O BALDE no chão, fora da boca, embaixo à direita (como no Atual): um aro de aduelas
//   (lugar 2, a madeira), a água dentro (cor própria) e a alça de ferro (cor própria) em
//   pé, vista como um arco raso por cima da água. (Reta de lado a lado, lia como um sinal
//   de "menos"; caída em U por fora, como um segundo contorno.)
// - O POÇO por dentro: a parede da cisterna (lugar 1, a pedra), funda e na sombra, e a
//   água (cor própria) lá embaixo. A água aparece andada para baixo à direita, longe da
//   luz (é funda: some atrás da boca do lado de perto), então a parede só se vê em
//   meia-lua em cima à esquerda; a boca faz sombra na água desse lado. A água é a da poça
//   aprovada (texturas/poca/), mais funda: escura no meio, um lençol de céu largo e chato
//   no lado da luz. Nada de brilho pontilhado nem de onda.
// - A BOCA (lugar 1): 8 blocos de pedra grandes e calmos, como as pedras aprovadas do
//   lote 8 (texturas/pedras/): planos chapados, a quina viva. Cada bloco tem o lado de
//   fora um pouco abaulado e as juntas um pouco tortas (talhado à mão, não um anel de
//   bolinhas), um tom próprio bem perto dos outros, a massa clara do lado da luz e a
//   escura do outro (os de baixo à direita acendem pela beira de dentro, que olha para a
//   luz). Contorno grosso por fora e na boca; entre os blocos, a junta firme e mais fina,
//   como a das tábuas.
// - A TRAVE e o SARILHO (lugar 2, a madeira), com a corda enrolada (cor própria) num rolo
//   de 3 voltas largas; o sarilho e a corda são rolos deitados, a luz anda só de través.
//   Os 2 ESTEIOS vêm por cima de tudo (são o que mais sobe): dois quadrados firmes nas
//   pontas da trave. (Por baixo dela, sumiam a 100%.) A madeira faz sombra na pedra
//   (valor, no desenho); a da água cairia na parede funda e não se vê.
// - A RECEITA DA PEDRA (para a pia, a fogueira e a lápide): o tom do bloco V_MEIO + 0,05
//   com um tom próprio de até ±0,045; a massa clara + MASSA_CLARA, de 0,045 casa, e a
//   escura - (MASSA_ESCURA + 0,02), de 1,5 x isso, as duas pela forma do bloco andada
//   para a luz e para longe dela (como desenhar_caixa); o contorno da família por fora e a
//   junta entre blocos de 0,022 casa em V_FUNDO + 0,02; a pedra na sombra (a parede da
//   cisterna) entre V_FUNDO e V_SOMBRA. Nada de risco, poro nem musgo.
// - Uma virada: o desenho é simétrico pela diagonal (a luz, a água andada, o balde e as
//   sombras de dentro andam na diagonal), então a transposta faz a de 90 graus com tudo no
//   lugar. O balde não acompanha o giro de 180 graus (fica embaixo à direita): é o preço
//   de 1 forma em vez de 4. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// Paleta do Meio-Termo que não está na base (client/src/texturas/meioTermo/paleta.ts).
const vec3 AGUA_MT = vec3(0.251, 0.439, 0.494); // #40707e água
// A água da poça aprovada (texturas/poca/textura.gdshader, AGUA).
const vec3 AGUA = vec3(0.262, 0.408, 0.386);
// A corda (MATERIAIS.corda do app, #a08a62) e o ferro da alça (MATERIAIS.ferro, #4c4e51).
const vec3 CORDA = vec3(0.627, 0.541, 0.384);
const vec3 FERRO_DA_ALCA = vec3(0.298, 0.306, 0.318);

// ---- A boca de pedra ----
const int BLOCOS = 8;
const float R_DENTRO = 0.355;  // o raio da boca (a água e a parede), casas
const float R_FORA = 0.575;    // a distância média do lado de fora de cada bloco ao meio
const float ABAULADO = 0.9;    // o raio do arco do lado de fora de cada bloco (grande = quase reto)
const float R_JUNTA = 0.47;    // onde a junta torta cruza o raio de referência
const float JUNTA = 0.011;     // meia largura da junta entre blocos, casas
const float QUINA = 0.03;      // o arredondado da quina dos blocos
const float LUZ_DO_BLOCO = 0.045; // a largura da massa clara (a escura é 1,5 x)

// ---- O fundo ----
const float AGUA_ANDA = 0.075;   // o quanto a água aparece andada para longe da luz, casas
const float SOMBRA_DA_BOCA = 0.12; // o comprimento da sombra da boca na água

// ---- A madeira ----
const float Y_TRAVE = -0.02;     // o meio da trave, casas (um nada para cima: a luz)
const vec2 TRAVE = vec2(0.70, 0.048);
const float X_ESTEIO = 0.645;
const vec2 ESTEIO = vec2(0.092, 0.092);
const vec2 SARILHO = vec2(0.24, 0.092);
const vec2 ROLO = vec2(0.125, 0.1);
const float SOMBRA_DA_TRAVE = 0.13; // o quanto a sombra da madeira anda sobre a pedra

// ---- O balde ----
const vec2 BALDE = vec2(0.505, 0.505);
const float R_BALDE = 0.125;
const float ARO_DO_BALDE = 0.042;

// O ângulo de cada junta (graus, no sentido de x para y) e o quanto ela entorta (rad).
float angulo_da_junta(int k) {
	float a[8] = float[8](20.0, 68.0, 112.0, 160.0, 203.0, 247.0, 290.0, 336.0);
	return radians(a[k % BLOCOS]) + (k >= BLOCOS ? 6.2831853 : 0.0);
}

float torto_da_junta(int k) {
	float t[8] = float[8](0.10, -0.08, 0.06, -0.12, 0.09, -0.05, 0.11, -0.07);
	return t[k % BLOCOS];
}

// O tom próprio de cada bloco (perto dos outros) e o quanto o lado de fora avança.
float tom_do_bloco(int i) {
	float t[8] = float[8](0.03, -0.035, 0.045, -0.005, -0.045, 0.02, -0.015, 0.04);
	return t[i];
}

float fora_do_bloco(int i) {
	float f[8] = float[8](0.0, 0.022, -0.016, 0.024, -0.01, 0.014, -0.022, 0.01);
	return f[i];
}

float smax(float a, float b, float k) {
	float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) + k * h * (1.0 - h);
}

// A distância (com sinal: + para fora do bloco) à junta k, do lado do bloco que vem depois
// dela (lado = 1) ou antes (lado = -1).
float lado_da_junta(vec2 p, int k, float lado) {
	float a = angulo_da_junta(k);
	vec2 c = vec2(cos(a), sin(a)) * R_JUNTA;
	float b = a + torto_da_junta(k);
	vec2 u = vec2(cos(b), sin(b));
	float cr = u.x * (p.y - c.y) - u.y * (p.x - c.x);
	return -lado * cr;
}

// O bloco i: entre a junta i e a i + 1, de R_DENTRO até o lado de fora abaulado.
// recuo_fora: o quanto encolher por fora e por dentro (o contorno); recuo_junta: o quanto
// encolher nas juntas.
float sd_bloco(vec2 p, int i, float recuo_fora, float recuo_junta) {
	float a0 = angulo_da_junta(i);
	float a1 = angulo_da_junta(i + 1);
	float am = 0.5 * (a0 + a1);
	vec2 n = vec2(cos(am), sin(am));
	float ro = R_FORA + fora_do_bloco(i) - recuo_fora;
	float d_fora = length(p - n * (ro - ABAULADO)) - ABAULADO;
	float d_dentro = R_DENTRO + recuo_fora - length(p);
	float s0 = lado_da_junta(p, i, 1.0) + recuo_junta;
	float s1 = lado_da_junta(p, i + 1, -1.0) + recuo_junta;
	float d = smax(d_fora, d_dentro, QUINA);
	d = smax(d, s0, QUINA);
	return smax(d, s1, QUINA);
}

// A boca inteira (a silhueta): os blocos sem junta, sobrepostos só o bastante para não
// abrir costura na junta (mais que isso, o bloco maior faz um chifre no vizinho).
float sd_boca(vec2 p) {
	float d = 1e3;
	for (int i = 0; i < BLOCOS; i++) {
		d = min(d, sd_bloco(p, i, 0.0, -0.01));
	}
	return d;
}

// A madeira de cima (para a sombra que ela faz na pedra).
float sd_madeira(vec2 p) {
	float d = sd_caixa(p - vec2(0.0, Y_TRAVE), TRAVE, 0.02);
	d = min(d, sd_caixa(p - vec2(0.0, Y_TRAVE), SARILHO, 0.04));
	d = min(d, sd_caixa(p - vec2(-X_ESTEIO, Y_TRAVE), ESTEIO, 0.02));
	return min(d, sd_caixa(p - vec2(X_ESTEIO, Y_TRAVE), ESTEIO, 0.02));
}

// ---- As partes ----

void desenhar_balde(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	vec2 p = q - BALDE;
	float r = length(p);
	float d = r - R_BALDE;
	if (d > px) {
		return;
	}
	vec2 dir = p / max(r, 1e-5);
	float l = dot(dir, LUZ);
	// O aro das aduelas: contorno, o tom que acende em cima à esquerda.
	pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
	float aro = mix(V_SOMBRA - 0.02, V_LUZ + 0.02, smoothstep(-0.5, 0.6, l));
	pousar(av, ac, aro, 2, cobre(d + CONTORNO_CASAS * 0.8, px));
	// A beira de dentro do aro e a água.
	float ri = R_BALDE - ARO_DO_BALDE;
	float di = r - ri;
	pousar(av, ac, V_FUNDO, 2, cobre(di - 0.01, px));
	vec3 agua = AGUA * 0.82;
	// A sombra do aro na água, em meia-lua do lado da luz.
	float sombra = cobre(ri - length(p + LUZ * 0.04), px);
	agua = mix(agua, AGUA * 0.58, sombra);
	pousar_cor(av, ac, agua, cobre(di + 0.004, px));
}

// A alça de ferro do balde, em pé e um nada caída para o lado de perto: vista de cima, um
// arco raso de uma orelha à outra, por cima da água (as orelhas ficam no aro).
void desenhar_alca(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	vec2 p = q - BALDE;
	float ri = R_BALDE - ARO_DO_BALDE;
	if (p.y < -0.02 || length(p) > R_BALDE + 0.02) {
		return;
	}
	float d = abs(sd_elipse(p, vec2(ri + 0.012, 0.042))) - 0.011;
	d = max(d, -p.y - 0.002);
	pousar_cor(av, ac, FERRO_DA_ALCA * 0.55, cobre(d, px));
	pousar_cor(av, ac, mix(FERRO_DA_ALCA, vec3(0.80, 0.81, 0.82), 0.25), cobre(d + 0.0065, px));
}

void desenhar_fundo(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	float r = length(q);
	float d = r - R_DENTRO - 0.012;
	if (d > px) {
		return;
	}
	// A parede da cisterna: funda, mais escura do lado de cima à esquerda (de costas para a luz).
	vec2 dir = q / max(r, 1e-5);
	float l = dot(dir, LUZ);
	float parede = mix(V_SOMBRA - 0.03, V_FUNDO + 0.01, smoothstep(-0.3, 0.8, l));
	pousar(av, ac, parede, 1, cobre(d, px));
	// A água, andada para longe da luz (a parte de perto some atrás da boca).
	vec2 cw = -LUZ * AGUA_ANDA;
	vec2 pw = q - cw;
	float dw = length(pw) - R_DENTRO;
	float dentro = cobre(dw, px) * cobre(d, px);
	if (dentro <= 0.0) {
		return;
	}
	// Funda no meio, um pouco mais clara para a beira.
	float meio = 1.0 - smoothstep(0.04, 0.32, length(pw));
	vec3 agua = mix(AGUA * 0.82, AGUA * 0.60, meio);
	// O céu: um lençol largo e chato, do lado da luz, longe da sombra da boca.
	vec2 rr = girar(pw - vec2(-0.03, 0.06), 0.7854);
	float ceu = 1.0 - smoothstep(-0.05, 0.05, sd_elipse(rr, vec2(0.20, 0.07)));
	agua = mix(agua, realce_de(mix(AGUA, AGUA_MT, 0.3)), 0.36 * ceu);
	// A sombra da boca na água: o ponto que, andado para a luz, sai da boca.
	float sombra = 1.0 - smoothstep(-0.02, 0.02, length(q + LUZ * SOMBRA_DA_BOCA) - R_DENTRO);
	agua = mix(agua, AGUA * 0.47, 0.85 * sombra);
	pousar_cor(av, ac, agua, dentro);
}

void desenhar_boca(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	float r = length(q);
	if (r > R_FORA + 0.08 || r < R_DENTRO - 0.02) {
		return;
	}
	// A silhueta no contorno, a argamassa na junta.
	float ds = sd_boca(q);
	pousar(av, ac, V_CONTORNO, 1, cobre(ds, px));
	pousar(av, ac, V_FUNDO + 0.02, 1, cobre(ds + CONTORNO_CASAS, px));
	// A sombra da madeira de cima na pedra (valor): a trave andada para longe da luz.
	float sm = 1.0 - smoothstep(-0.015, 0.015, sd_madeira(q + LUZ * SOMBRA_DA_TRAVE));
	vec2 lm = LUZ;
	for (int i = 0; i < BLOCOS; i++) {
		float db = sd_bloco(q, i, CONTORNO_CASAS, JUNTA);
		if (db > px) {
			continue;
		}
		float dentro = cobre(db, px);
		float v = V_MEIO + 0.05 + tom_do_bloco(i);
		pousar(av, ac, v - 0.12 * sm, 1, dentro);
		float escura = dentro * (1.0 - cobre(sd_bloco(q - lm * LUZ_DO_BLOCO * 1.5, i, CONTORNO_CASAS, JUNTA), px));
		pousar(av, ac, v - MASSA_ESCURA - 0.02 - 0.08 * sm, 1, escura);
		float clara = dentro * (1.0 - cobre(sd_bloco(q + lm * LUZ_DO_BLOCO, i, CONTORNO_CASAS, JUNTA), px));
		pousar(av, ac, v + MASSA_CLARA - 0.13 * sm, 1, clara);
	}
}

void desenhar_madeira(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	// A trave (o eixo do sarilho) passa entre os esteios, mais baixa que o topo deles: os
	// esteios vêm por cima, no fim (as 2 colunas são o que mais sobe).
	desenhar_caixa(av, ac, q, vec2(0.0, Y_TRAVE), TRAVE, 0.02, V_MEIO - 0.04, 0.028, 2, 0, px);
	// O sarilho é um rolo deitado ao longo da trave: a luz anda só de través (a faixa de
	// cima clara, a de baixo escura), nunca em L como numa caixa.
	vec2 p = q - vec2(0.0, Y_TRAVE);
	float ds = sd_caixa(p, SARILHO, 0.05);
	if (ds > px) {
		return;
	}
	float cs = contorno_para(SARILHO);
	pousar(av, ac, V_CONTORNO, 2, cobre(ds, px));
	float dentro_s = cobre(ds + cs, px);
	float vs = V_MEIO + 0.04;
	pousar(av, ac, vs, 2, dentro_s);
	pousar(av, ac, vs - MASSA_ESCURA, 2, dentro_s * (1.0 - cobre(sd_caixa(p - vec2(0.0, 0.05), SARILHO, 0.05) + cs, px)));
	pousar(av, ac, vs + MASSA_CLARA, 2, dentro_s * (1.0 - cobre(sd_caixa(p + vec2(0.0, 0.032), SARILHO, 0.05) + cs, px)));
	// A corda enrolada no meio do sarilho: um rolo só, mais grosso que a madeira, com a
	// mesma luz de través.
	float d = sd_caixa(p, ROLO, 0.05);
	if (d > px) {
		return;
	}
	pousar_cor(av, ac, CORDA * 0.5, cobre(d, px));
	float co = contorno_para(ROLO);
	float dentro = cobre(d + co, px);
	pousar_cor(av, ac, CORDA, dentro);
	pousar_cor(av, ac, sombra_de(CORDA) * 0.86, dentro * (1.0 - cobre(sd_caixa(p - vec2(0.0, 0.05), ROLO, 0.05) + co, px)));
	pousar_cor(av, ac, realce_de(CORDA), dentro * (1.0 - cobre(sd_caixa(p + vec2(0.0, 0.032), ROLO, 0.05) + co, px)));
	// As 3 voltas largas da corda, separadas por 2 vincos firmes (como as tábuas de um tampo).
	float passo = 2.0 * (ROLO.x - co) / 3.0;
	float dv = abs(abs(p.x) - 0.5 * passo);
	pousar_cor(av, ac, sombra_de(CORDA) * 0.72, dentro * cobre(dv - 0.0075, px));
}

void desenhar_esteios(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	for (int s = 0; s < 2; s++) {
		float x = s == 0 ? -X_ESTEIO : X_ESTEIO;
		desenhar_caixa(av, ac, q, vec2(x, Y_TRAVE), ESTEIO, 0.026, V_MEIO + 0.03, 0.04, 2, 0, px);
	}
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	desenhar_balde(av, ac, q, px);
	desenhar_alca(av, ac, q, px);
	desenhar_fundo(av, ac, q, px);
	desenhar_boca(av, ac, q, px);
	desenhar_madeira(av, ac, q, px);
	desenhar_esteios(av, ac, q, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

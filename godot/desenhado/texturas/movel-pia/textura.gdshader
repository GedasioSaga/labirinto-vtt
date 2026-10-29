// PIA desenhada que pega cor (onda 4, lote 14; CONTRATO.md seção 10). A pia de pedra da
// cozinha de fantasia: uma cuba talhada num bloco de pedra, em cima de um balcão de tábuas,
// a bica de ferro saindo da parede e o balde de aduelas ao lado.
//
// Da família aprovada (piloto, lotes 10 a 13): contorno grosso na própria cor, formas
// grandes, a luz de cima à esquerda em poucas massas, nada de risquinho, bolinha ou grão.
// Visto de cima (pegada 1 x 0,6; y para baixo = a frente, y para cima = a parede), de baixo
// para cima:
// - O TAMPO de madeira (lugar 2), a pegada inteira: 2 tábuas, a de trás (onde a pedra e o
//   balde pousam) e a da FRENTE, mais clara, a beira onde se debruça, com uma junta firme;
//   a face da tábua grossa aparece embaixo à direita, como a da mesa do piloto.
// - A CUBA de pedra (lugar 1), à esquerda, rente à parede: a beira em 4 BLOCOS grandes (o
//   de trás e o da frente seguram a cuba de ponta a ponta e descem pelos lados; dois
//   menores fecham os lados), com a junta firme só nas beiras dos lados, em alturas
//   diferentes e um pouco torta, e o contorno de fora com os lados um pouco abaulados:
//   talhado à mão, não uma moldura. Pela RECEITA DA PEDRA do poço aprovado
//   (texturas/movel-poco/): o tom V_MEIO + 0,05 com um tom próprio por bloco, a massa
//   clara + MASSA_CLARA e a escura - (MASSA_ESCURA + 0,02) pela forma do bloco andada para
//   a luz e para longe dela (estreitas: o bloco fica chapado, a quina viva), a junta de
//   0,022 casa em V_FUNDO + 0,02, o contorno da família por fora; a pedra na sombra (o
//   fundo da cuba) entre V_FUNDO e V_SOMBRA. No fundo, a beira de cima à esquerda faz
//   sombra e a parede de baixo à direita olha para a luz: é o que diz "cavado". Nada de
//   risco, poro, ralo nem musgo.
// - A BICA de ferro (cor própria, o ferro do app), presa na parede por uma braçadeira,
//   curta e alargando até a boca sobre a cuba (um cano reto lia como torneira de hoje), com
//   a sombra dela (valor) na beira e, mais andada, no fundo: é o que diz "cano no alto".
// - O BALDE à direita, como o do poço aprovado: o aro de aduelas (lugar 2), a água no tom
//   contido da poça aprovada (texturas/poca/) e a alça de ferro em arco raso.
// A pedra e o balde, mais altos que o tampo, fazem sombra (valor) nas tábuas.
// 4 viradas: a cuba fica de um lado e o balde do outro, a bica na parede (nem de lado a
// lado nem de cima a baixo é simétrico). Desenhado no referencial do móvel (movel_de) e
// aceso no da tela (LUZ): a luz fica em cima à esquerda nas 4. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// A água da poça aprovada (texturas/poca/textura.gdshader, AGUA).
const vec3 AGUA = vec3(0.262, 0.408, 0.386);
// O ferro da bica e da alça (MATERIAIS.ferro do app, #4c4e51; a alça do balde do poço).
const vec3 FERRO_DA_BICA = vec3(0.298, 0.306, 0.318);
const vec3 BRILHO_DO_FERRO = vec3(0.80, 0.81, 0.82);

// ---- O tampo (casas, no referencial do móvel: x de -0,5 a 0,5, y de -0,3 a 0,3) ----
const vec2 TAMPO = vec2(0.48, 0.27);
const float QUINA = 0.045;
const vec2 ESPESSURA = vec2(0.012, 0.032); // para onde a face do tampo aparece, NA TELA
const float Y_JUNTA = 0.155;               // a junta da tábua da frente
const float JUNTA = 0.011;                 // meia largura da junta
const float LUZ_DO_TAMPO = 0.04;           // a largura da massa clara do tampo (a escura 1,5 x)

// ---- A cuba de pedra ----
const vec2 PEDRA_C = vec2(-0.19, -0.055);   // o meio do bloco
const vec2 PEDRA_B = vec2(0.29, 0.22);      // a meia medida no meio dos lados (as quinas recuam)
const float ABAULADO = 2.0;                 // o raio do arco de cada lado (grande = quase reto)
const float QUINA_DA_PEDRA = 0.05;
const vec2 BEIRA = vec2(0.12, 0.11);        // a largura da beira dos lados e de trás e da frente
const float QUINA_DA_CUBA = 0.08;
const float CONTORNO_DA_CUBA = 0.02;        // o contorno na boca da cuba
const float LUZ_DA_PEDRA = 0.018;           // a massa clara de cada bloco (a escura 1,5 x)
const float JUNTA_DA_PEDRA = 0.011;         // meia junta entre os blocos (0,022 casa, a do poço)
const float SOMBRA_NA_CUBA = 0.075;         // a sombra da beira no fundo
const float LUZ_NA_CUBA = 0.032;            // a parede de dentro que olha para a luz
const float SOMBRA_DA_PEDRA = 0.05;         // a sombra do bloco nas tábuas
const int BLOCOS = 4;
const float X_DA_JUNTA = 0.235;             // onde a junta cruza a beira do lado (do meio do bloco)

// ---- A bica ----
const vec2 BRACADEIRA = vec2(0.05, 0.022);  // a braçadeira na parede, meia medida
const float BRACADEIRA_Y = -0.287;
const float BICA_Y0 = -0.27;
const float BICA_Y1 = -0.105;  // a boca, sobre a cuba
const float BICA_R0 = 0.026;   // o cano na parede
const float BICA_R1 = 0.04;    // a boca, mais larga: é uma bica, não um cano reto
const float SOMBRA_DA_BICA = 0.07;  // na beira; no fundo, 1,5 x (é mais fundo)

// ---- O balde ----
const vec2 BALDE = vec2(0.295, -0.045);
const float R_BALDE = 0.15;
const float ARO_DO_BALDE = 0.045;
const float SOMBRA_DO_BALDE = 0.065;

float smax(float a, float b, float k) {
	float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) + k * h * (1.0 - h);
}

// O bloco talhado: 4 lados em arco de raio ABAULADO (o meio de cada lado avança um pouco),
// as quinas arredondadas.
float sd_pedra(vec2 m) {
	vec2 p = m - PEDRA_C;
	float dx = length(vec2(abs(p.x) - PEDRA_B.x + ABAULADO, p.y)) - ABAULADO;
	float dy = length(vec2(p.x, abs(p.y) - PEDRA_B.y + ABAULADO)) - ABAULADO;
	return smax(dx, dy, QUINA_DA_PEDRA);
}

float sd_cuba(vec2 m) {
	return sd_caixa(m - PEDRA_C, PEDRA_B - BEIRA, QUINA_DA_CUBA);
}

// ---- Os 4 blocos da cuba (como a boca do poço) ----
// As juntas cruzam só as beiras dos lados, em alturas diferentes: o bloco de trás e o da
// frente seguram a cuba de ponta a ponta e descem pelos lados; os 2 blocos menores fecham
// os lados. O ângulo de cada junta (graus, de x para y, a partir do meio do bloco) e o
// quanto ela entorta (rad): talhado à mão, não uma moldura.
float angulo_da_junta(int k) {
	float a[4] = float[4](-19.0, 21.0, 161.0, 198.0);
	return radians(a[k % BLOCOS]);
}

float torto_da_junta(int k) {
	float t[4] = float[4](0.10, -0.08, 0.07, -0.11);
	return t[k % BLOCOS];
}

// O tom próprio de cada bloco (perto dos outros): o do lado direito, o da frente, o do
// lado esquerdo, o de trás.
float tom_do_bloco(int i) {
	float t[4] = float[4](0.035, -0.025, 0.045, 0.0);
	return t[i];
}

// A distância (com sinal: + para fora do bloco) à junta k, do lado do bloco que vem depois
// dela (lado = 1) ou antes (lado = -1).
float lado_da_junta(vec2 p, int k, float lado) {
	float a = angulo_da_junta(k);
	vec2 c = vec2(cos(a), sin(a)) * (X_DA_JUNTA / abs(cos(a)));
	float b = a + torto_da_junta(k);
	vec2 u = vec2(cos(b), sin(b));
	float cr = u.x * (p.y - c.y) - u.y * (p.x - c.x);
	return -lado * cr;
}

// O bloco i da beira, encolhido do contorno por fora, do da boca por dentro e da junta.
float sd_bloco(vec2 m, int i) {
	vec2 p = m - PEDRA_C;
	float d = max(sd_pedra(m) + CONTORNO_CASAS, CONTORNO_DA_CUBA - sd_cuba(m));
	d = smax(d, lado_da_junta(p, i, 1.0) + JUNTA_DA_PEDRA, 0.012);
	return smax(d, lado_da_junta(p, i + 1, -1.0) + JUNTA_DA_PEDRA, 0.012);
}

float sd_cano(vec2 m) {
	return sd_traco(m, vec2(PEDRA_C.x, BICA_Y0), vec2(PEDRA_C.x, BICA_Y1), BICA_R0, BICA_R1);
}

float sd_bracadeira(vec2 m) {
	return sd_caixa(m - vec2(PEDRA_C.x, BRACADEIRA_Y), BRACADEIRA, 0.016);
}

float sd_bica(vec2 m) {
	return min(sd_cano(m), sd_bracadeira(m));
}

// Sombra macia: 1 dentro da forma d, com a borda esfumada.
float na_sombra(float d) {
	return 1.0 - smoothstep(-0.015, 0.015, d);
}

void desenhar_tampo(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, int v, float px) {
	// A face da tábua grossa, embaixo à direita na tela.
	vec2 off = movel_de(ESPESSURA, v);
	float de = sd_caixa(m - off, TAMPO, QUINA);
	pousar_com_contorno(av, ac, de, V_FUNDO + 0.04, 2, px);
	// O tampo: contorno, as 2 tábuas, a junta, as massas e as sombras da pedra e do balde.
	float dt = sd_caixa(m, TAMPO, QUINA);
	if (dt > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 2, cobre(dt, px));
	float dentro = cobre(dt + CONTORNO_CASAS, px);
	float frente = smoothstep(-0.5 * px, 0.5 * px, m.y - Y_JUNTA);
	float tom = mix(V_MEIO, V_MEIO + 0.05, frente);
	float esc = 1.0 - cobre(sd_caixa(m - lm * LUZ_DO_TAMPO * 1.5, TAMPO, QUINA) + CONTORNO_CASAS, px);
	float cla = 1.0 - cobre(sd_caixa(m + lm * LUZ_DO_TAMPO, TAMPO, QUINA) + CONTORNO_CASAS, px);
	float val = mix(tom, tom - MASSA_ESCURA, esc);
	val = mix(val, tom + MASSA_CLARA, cla);
	float s = max(na_sombra(sd_pedra(m + lm * SOMBRA_DA_PEDRA)), na_sombra(length(m + lm * SOMBRA_DO_BALDE - BALDE) - R_BALDE));
	val -= 0.09 * s;
	pousar(av, ac, val, 2, dentro);
	desenhar_linha(av, ac, abs(m.y - Y_JUNTA), JUNTA, V_FUNDO, dentro, 2, px);
}

void desenhar_cuba(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_pedra(m);
	if (d > px) {
		return;
	}
	float dc = sd_cuba(m);
	float sb = na_sombra(sd_bica(m + lm * SOMBRA_DA_BICA));
	// O contorno por fora (o bloco inteiro) e a argamassa na junta.
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	pousar(av, ac, V_FUNDO + 0.02, 1, cobre(max(d + CONTORNO_CASAS, CONTORNO_DA_CUBA - dc), px));
	// Os blocos: o tom próprio, a massa escura e a clara pela forma do bloco andada para
	// longe da luz e para ela (a junta também pega luz e sombra), a sombra da bica.
	for (int i = 0; i < BLOCOS; i++) {
		float db = sd_bloco(m, i);
		if (db > px) {
			continue;
		}
		float dentro = cobre(db, px);
		float tom = V_MEIO + 0.05 + tom_do_bloco(i);
		pousar(av, ac, tom - 0.12 * sb, 1, dentro);
		float esc = dentro * (1.0 - cobre(sd_bloco(m - lm * LUZ_DA_PEDRA * 1.5, i), px));
		pousar(av, ac, tom - MASSA_ESCURA - 0.02 - 0.08 * sb, 1, esc);
		float cla = dentro * (1.0 - cobre(sd_bloco(m + lm * LUZ_DA_PEDRA, i), px));
		pousar(av, ac, tom + MASSA_CLARA - 0.13 * sb, 1, cla);
	}
	// O fundo da cuba: a pedra na sombra; a parede de baixo à direita acesa; a sombra da
	// beira em cima à esquerda; a da bica, mais andada.
	float fundo = cobre(dc, px);
	if (fundo <= 0.0) {
		return;
	}
	float luz = 1.0 - cobre(sd_cuba(m - lm * LUZ_NA_CUBA), px);
	float sombra = 1.0 - smoothstep(-0.012, 0.012, sd_cuba(m + lm * SOMBRA_NA_CUBA));
	float sbf = na_sombra(sd_bica(m + lm * SOMBRA_DA_BICA * 1.5));
	float vf = mix(V_SOMBRA + 0.01, V_MEIO - 0.03, luz);
	vf = mix(vf, V_FUNDO + 0.01, max(sombra, 0.8 * sbf));
	pousar(av, ac, vf, 1, fundo);
}

// Uma peça de ferro (cor própria): o contorno e 3 massas pela luz da tela, pela normal n
// (no referencial do móvel).
void pousar_ferro(inout vec4 av, inout vec4 ac, float d, float co, vec2 n, int v, float px) {
	float l = para_a_luz(tela_de(n, v));
	pousar_cor(av, ac, FERRO_DA_BICA * 0.55, cobre(d, px));
	vec3 cor = mix(sombra_de(FERRO_DA_BICA) * 0.9, FERRO_DA_BICA, smoothstep(-0.55, -0.35, l));
	cor = mix(cor, mix(FERRO_DA_BICA, BRILHO_DO_FERRO, 0.3), smoothstep(0.35, 0.55, l));
	pousar_cor(av, ac, cor, cobre(d + co, px));
}

void desenhar_bica(inout vec4 av, inout vec4 ac, vec2 m, int v, float px) {
	if (sd_bica(m) > px) {
		return;
	}
	// A braçadeira na parede, por baixo do cano.
	vec2 pb = m - vec2(PEDRA_C.x, BRACADEIRA_Y);
	pousar_ferro(av, ac, sd_bracadeira(m), contorno_para(BRACADEIRA), normal_caixa(pb, BRACADEIRA, 0.016), v, px);
	// A bica, que alarga até a boca: a normal sai do eixo (na ponta, do meio da boca).
	vec2 eixo = vec2(PEDRA_C.x, clamp(m.y, BICA_Y0, BICA_Y1));
	pousar_ferro(av, ac, sd_cano(m), 0.014, m - eixo, v, px);
}

// O balde, como o do poço: desenhado na tela (o meio dele virado), porque é redondo.
void desenhar_balde(inout vec4 av, inout vec4 ac, vec2 q, int v, float px) {
	vec2 p = q - tela_de(BALDE, v);
	float r = length(p);
	float d = r - R_BALDE;
	if (d > px) {
		return;
	}
	vec2 dir = p / max(r, 1e-5);
	float l = dot(dir, LUZ);
	pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
	float aro = mix(V_SOMBRA - 0.02, V_LUZ + 0.02, smoothstep(-0.5, 0.6, l));
	pousar(av, ac, aro, 2, cobre(d + CONTORNO_CASAS * 0.8, px));
	float ri = R_BALDE - ARO_DO_BALDE;
	float di = r - ri;
	pousar(av, ac, V_FUNDO, 2, cobre(di - 0.01, px));
	vec3 agua = AGUA * 0.82;
	float sombra = cobre(ri - length(p + LUZ * 0.045), px);
	agua = mix(agua, AGUA * 0.58, sombra);
	pousar_cor(av, ac, agua, cobre(di + 0.004, px));
	// A alça em pé, um arco raso de uma orelha à outra, por cima da água.
	if (p.y < -0.02) {
		return;
	}
	float da = abs(sd_elipse(p, vec2(ri + 0.012, 0.04))) - 0.011;
	da = max(da, -p.y - 0.002);
	pousar_cor(av, ac, FERRO_DA_BICA * 0.55, cobre(da, px));
	pousar_cor(av, ac, mix(FERRO_DA_BICA, BRILHO_DO_FERRO, 0.25), cobre(da + 0.0065, px));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	desenhar_tampo(av, ac, m, lm, vir, px);
	desenhar_cuba(av, ac, m, lm, px);
	desenhar_bica(av, ac, m, vir, px);
	desenhar_balde(av, ac, q, vir, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

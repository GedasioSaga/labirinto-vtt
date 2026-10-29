// FOGUEIRA desenhada que pega cor (onda 4, lote 15; CONTRATO.md seção 10). Lugares: 1 = as
// pedras (granito, arenito, ardósia), 2 = a lenha (a casca: carvalho, pinho, bétula). Cor
// própria (corFixa): o chão queimado, o leito de cinza, a lenha queimada e as brasas.
//
// Da família aprovada (piloto, lotes 10 a 13): contorno grosso na própria cor, formas
// grandes, a luz de cima à esquerda em poucas massas.
//
// A CHAMA e o BRILHO não entram na imagem: são do app (pixi/chamasDasFogueiras.ts, que
// nasce de chamaDaFogueira de lib/mobilia.ts). De cima a chama nasce no meio da roda (a
// âncora), em pé na tela, com a base 0,18 casa abaixo dela; de lado, na altura 0,68 a partir
// de cima, onde a lenha cruza. O desenho deixa o cruzamento da lenha exatamente aí e as
// brasas no pé da chama, dos dois lados, onde ela não cobre.
//
// De cima, de baixo para cima:
// - O CHÃO QUEIMADO (cor própria) debaixo da roda: só aparece nas frestas entre as pedras.
// - O LEITO DE CINZA (cor própria): escuro e morno, uma massa larga de cinza fina do lado
//   da luz, a sombra das pedras em meia-lua na beira de cima à esquerda e a da lenha.
// - A LENHA em X (lugar 2), como a lenha aprovada dos Troncos e o tronco caído da onda 3:
//   a casca em 3 faixas largas ao longo da tora (a da luz, a do meio, a da sombra), de borda
//   que ondula devagar, e o CORTE nas pontas com 2 anéis largos. O cruzamento é carvão (cor
//   própria), uma massa só que some suave para a casca.
// - As BRASAS (cor própria): 3 massas quentes contidas, a grande no cruzamento e 2 pequenas
//   no pé da chama; a borda vermelha apagada e o miolo laranja para o lado da luz. Nada de
//   pontilhado.
// - A RODA DE PEDRAS (lugar 1) pela RECEITA DO POÇO (texturas/movel-poco/): 8 pedras grandes
//   e calmas, o lado de fora abaulado, o de dentro um pouco para o fogo, as juntas tortas;
//   o tom da pedra V_MEIO + 0,05 com um tom próprio de até ±0,045, a massa clara +MASSA_CLARA
//   de 0,045 casa, a escura -(MASSA_ESCURA + 0,02) de 1,5 x isso, o contorno da família. Aqui
//   as pedras são soltas: entre elas, uma fresta com o contorno mais fino e o chão queimado.
// - Uma virada: o X a ±35 graus e a roda ficam iguais na transposta, com a luz no lugar.
//
// De lado (1 x 1,25, a vista Frente/Lado do app; 2 viradas, simétrica de lado a lado):
// 4 pedras em domo na frente, o monte de cinza atrás delas, a lenha em X subindo de trás das
// pedras (o corte nas pontas de cima) e cruzando na altura da base da chama, as brasas no
// colo do X. O alto fica vazio para a chama do app subir.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As cores próprias ----
// As brasas do app (meioTermo/moveis/fogueira.ts, BRASA_VIVA e BRASA_QUENTE: saturação até
// 0,60, contidas; quem dá o fogo vivo é a chama animada por cima).
const vec3 BRASA_VIVA = vec3(0.588, 0.322, 0.243);   // (150, 82, 62)
const vec3 BRASA_QUENTE = vec3(0.769, 0.510, 0.322); // (196, 130, 82)
// A cinza do leito, escura e morna (a do fogo do app, entre #2a201b e #9c948b).
const vec3 LEITO = vec3(0.373, 0.345, 0.322);
const vec3 CINZA_FINA = vec3(0.588, 0.561, 0.529);
// A lenha queimada (o carvão do fogo do app, #3a2e27, um pouco mais fundo).
const vec3 CARVAO = vec3(0.196, 0.157, 0.137);
// A terra queimada entre as pedras (a fuligem clara do fogo do app, #4d3b2f).
const vec3 CHAO_QUEIMADO = vec3(0.302, 0.231, 0.184);

// ---- De cima: a roda ----
const int PEDRAS = 8;
const float R_DENTRO = 0.272;        // o raio de dentro da roda, casas
const float R_FORA = 0.486;          // a distância média do lado de fora de cada pedra ao meio
const float ABAULADO = 0.40;         // o raio do arco de fora (grande = quase reto)
const float ABAULADO_DENTRO = 0.46;  // o raio do arco de dentro (a pedra avança para o fogo)
const float R_JUNTA = 0.39;          // onde a junta torta cruza o raio de referência
const float FOLGA = 0.004;           // meia largura da fresta entre as pedras
const float QUINA = 0.045;           // o arredondado da quina (mais que no poço: pedra solta)
const float CONTORNO_DA_JUNTA = 0.020; // o contorno na fresta, mais fino que o de fora
const float LUZ_DA_PEDRA = 0.045;    // a largura da massa clara (a escura é 1,5 x)

// ---- De cima: a lenha e as brasas ----
const float LENHA_MEIA = 0.212;      // o meio comprimento do corpo da tora, sem a face do corte
const float LENHA_RAIO = 0.074;
const float ANG_LENHA = 0.6109;      // 35 graus, o X do app
const float CARVAO_RAIO = 0.105;     // o cruzamento queimado

// ---- De lado ----
const float FUNDO_LADO = 0.598;      // a base das pedras (a pegada vai até 0,625)
const float LENHA_RAIO_LADO = 0.062;

float smax(float a, float b, float k) {
	float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) + k * h * (1.0 - h);
}

// ---- A roda de pedras (a receita do poço, com as pedras soltas) ----

float angulo_da_junta(int k) {
	float a[8] = float[8](14.0, 60.0, 106.0, 151.0, 199.0, 244.0, 292.0, 333.0);
	return radians(a[k % PEDRAS]) + (k >= PEDRAS ? 6.2831853 : 0.0);
}

float torto_da_junta(int k) {
	float t[8] = float[8](0.12, -0.10, 0.08, -0.13, 0.10, -0.07, 0.12, -0.09);
	return t[k % PEDRAS];
}

// O tom próprio de cada pedra (perto das outras) e o quanto o lado de fora e o de dentro andam.
float tom_da_pedra(int i) {
	float t[8] = float[8](0.03, -0.035, 0.045, -0.01, -0.045, 0.02, -0.02, 0.04);
	return t[i];
}

float fora_da_pedra(int i) {
	float f[8] = float[8](0.0, 0.016, -0.014, 0.018, -0.01, 0.012, -0.018, 0.008);
	return f[i];
}

float dentro_da_pedra(int i) {
	float f[8] = float[8](0.01, -0.012, 0.014, -0.006, 0.012, -0.014, 0.006, -0.01);
	return f[i];
}

float lado_da_junta(vec2 p, int k, float lado) {
	float a = angulo_da_junta(k);
	vec2 c = vec2(cos(a), sin(a)) * R_JUNTA;
	float b = a + torto_da_junta(k);
	vec2 u = vec2(cos(b), sin(b));
	float cr = u.x * (p.y - c.y) - u.y * (p.x - c.x);
	return -lado * cr;
}

// A pedra i: entre a junta i e a i + 1, do lado de dentro (que avança para o fogo) até o de
// fora abaulado. recuo_fora encolhe por fora e por dentro; recuo_junta, nas juntas.
float sd_pedra(vec2 p, int i, float recuo_fora, float recuo_junta) {
	float a0 = angulo_da_junta(i);
	float a1 = angulo_da_junta(i + 1);
	float am = 0.5 * (a0 + a1);
	vec2 n = vec2(cos(am), sin(am));
	float ro = R_FORA + fora_da_pedra(i) - recuo_fora;
	float ri = R_DENTRO + dentro_da_pedra(i) + recuo_fora;
	float d_fora = length(p - n * (ro - ABAULADO)) - ABAULADO;
	float d_dentro = length(p - n * (ri + ABAULADO_DENTRO)) - ABAULADO_DENTRO;
	float s0 = lado_da_junta(p, i, 1.0) + recuo_junta;
	float s1 = lado_da_junta(p, i + 1, -1.0) + recuo_junta;
	float d = smax(d_fora, d_dentro, QUINA);
	d = smax(d, s0, QUINA);
	return smax(d, s1, QUINA);
}

void desenhar_roda(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float r = length(m);
	if (r > R_FORA + 0.06 || r < R_DENTRO - 0.06) {
		return;
	}
	float recuo = FOLGA + CONTORNO_DA_JUNTA;
	for (int i = 0; i < PEDRAS; i++) {
		float d = sd_pedra(m, i, 0.0, FOLGA);
		if (d > px) {
			continue;
		}
		pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
		float dentro = cobre(sd_pedra(m, i, CONTORNO_CASAS, recuo), px);
		float v = V_MEIO + 0.05 + tom_da_pedra(i);
		pousar(av, ac, v, 1, dentro);
		float escura = dentro * (1.0 - cobre(sd_pedra(m - lm * LUZ_DA_PEDRA * 1.5, i, CONTORNO_CASAS, recuo), px));
		pousar(av, ac, v - MASSA_ESCURA - 0.02, 1, escura);
		float clara = dentro * (1.0 - cobre(sd_pedra(m + lm * LUZ_DA_PEDRA, i, CONTORNO_CASAS, recuo), px));
		pousar(av, ac, v + MASSA_CLARA, 1, clara);
	}
}

// ---- A lenha ----

// A tora: o corpo reto e a face do corte nas pontas (a elipse do bojo, como nos Troncos).
float sd_tora(vec2 l, float meia, float raio) {
	float corpo = sd_caixa(l, vec2(meia, raio), 0.01);
	float face = sd_elipse(vec2(abs(l.x) - meia, l.y), vec2(raio * 0.5, raio));
	return min(corpo, face);
}

// A face do corte numa ponta (lado = 1 a ponta do +x local, -1 a do -x): clara, com 2 anéis
// largos em volta do miolo um pouco fora do meio; a ponta que olha para a luz, mais clara.
void desenhar_corte(inout vec4 av, inout vec4 ac, vec2 l, float meia, float raio, float lado, float lz, float dentro, float px) {
	vec2 c = vec2(lado * meia, 0.0);
	vec2 e = vec2(raio * 0.5, raio) - vec2(0.006);
	float d = sd_elipse(l - c, e);
	if (d > px) {
		return;
	}
	float face = lz > 0.0 ? V_REALCE - 0.03 : V_LUZ + 0.02;
	float anel = face - 0.13;
	// A beira da face (onde a casca dobra): um traço firme no tom do anel.
	pousar(av, ac, anel - 0.04, 2, cobre(d, px) * dentro);
	pousar(av, ac, face, 2, cobre(d + 0.011, px) * dentro);
	vec2 miolo = c + vec2(-lado * 0.004, -0.010);
	vec2 k = (l - miolo) / e;
	float q = length(k);
	float aa = px / raio;
	float a1 = smoothstep(0.50 - aa, 0.50 + aa, q) * (1.0 - smoothstep(0.70 - aa, 0.70 + aa, q));
	float a2 = 1.0 - smoothstep(0.24 - aa, 0.24 + aa, q);
	pousar(av, ac, anel, 2, a1 * cobre(d + 0.011, px) * dentro);
	pousar(av, ac, anel + 0.03, 2, a2 * dentro);
}

// Uma tora de meio comprimento meia e raio raio, com o meio em c e o eixo em ang (no
// referencial do móvel); corte nas duas pontas (cortes = 2) ou só na do +x (cortes = 1).
void desenhar_tora(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, float ang, float meia, float raio, int cortes, float fase, vec2 lm, float px) {
	vec2 l = girar(m - c, -ang);
	float d = sd_tora(l, meia, raio);
	if (d > px) {
		return;
	}
	float co = contorno_para(vec2(meia, raio));
	pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
	float dentro = cobre(d + co, px);
	// As 3 faixas largas da casca, de través: x = +1 na borda da luz, -1 na da sombra.
	vec2 nrm = girar(vec2(0.0, 1.0), ang);
	float lado_luz = dot(nrm, lm) >= 0.0 ? 1.0 : -1.0;
	float x = l.y / raio * lado_luz;
	float u = l.x;
	float aa = px / raio;
	float b1 = -0.40 + 0.08 * sin(u * 10.0 + fase);
	float b2 = 0.28 + 0.08 * sin(u * 8.0 + fase * 1.3 + 1.0);
	float s_sombra = 1.0 - smoothstep(b1 - aa, b1 + aa, x);
	float s_luz = smoothstep(b2 - aa, b2 + aa, x);
	float v = mix(V_MEIO - 0.02, V_SOMBRA - 0.03, s_sombra);
	v = mix(v, V_LUZ + 0.03, s_luz);
	pousar(av, ac, v, 2, dentro);
	vec2 eixo = girar(vec2(1.0, 0.0), ang);
	desenhar_corte(av, ac, l, meia, raio, 1.0, dot(eixo, lm), dentro, px);
	if (cortes == 2) {
		desenhar_corte(av, ac, l, meia, raio, -1.0, -dot(eixo, lm), dentro, px);
	}
}

// ---- As brasas ----

// Uma brasa: a borda vermelha apagada e o miolo laranja andado para a luz; luz própria.
void desenhar_brasa(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 e, float ang, vec2 lm, float px) {
	vec2 p = girar(m - c, -ang);
	float d = sd_elipse(p, e);
	if (d > px) {
		return;
	}
	pousar_cor(av, ac, BRASA_VIVA, cobre(d, px));
	vec2 ll = girar(lm, -ang);
	float di = sd_elipse(p - ll * (0.24 * e.y), e * vec2(0.60, 0.56));
	pousar_cor(av, ac, BRASA_QUENTE, cobre(di, px));
}

// ---- De cima ----

void pintar_de_cima(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float r = length(m);
	// O chão queimado debaixo da roda (só se vê nas frestas).
	pousar_cor(av, ac, CHAO_QUEIMADO, cobre(r - (R_DENTRO + 0.11), px));
	// O leito de cinza.
	float dl = r - (R_DENTRO + 0.03);
	if (dl < px) {
		vec3 c = LEITO;
		// A cinza fina: uma massa larga do lado da luz, longe do fogo do meio.
		float fina = cobre(sd_elipse(girar(m - vec2(-0.10, 0.10), -0.75), vec2(0.19, 0.115)), px);
		c = mix(c, CINZA_FINA, 0.85 * fina);
		// A sombra das pedras, em meia-lua na beira do lado da luz.
		float sp = cobre(R_DENTRO + 0.004 - length(m + lm * 0.08), px);
		// A sombra da lenha no leito.
		vec2 l1 = girar(m + lm * 0.05, -ANG_LENHA);
		vec2 l2 = girar(m + lm * 0.05, ANG_LENHA);
		float sl = cobre(min(sd_tora(l1, LENHA_MEIA, LENHA_RAIO), sd_tora(l2, LENHA_MEIA, LENHA_RAIO)), px);
		c = mix(c, c * 0.70, max(sp, sl));
		pousar_cor(av, ac, c, cobre(dl, px));
	}
	// A lenha em X: a de baixo (+35 graus) e a de cima (-35 graus).
	desenhar_tora(av, ac, m, vec2(0.0), ANG_LENHA, LENHA_MEIA, LENHA_RAIO, 2, 0.0, lm, px);
	desenhar_tora(av, ac, m, vec2(0.0), -ANG_LENHA, LENHA_MEIA, LENHA_RAIO, 2, 1.9, lm, px);
	// O cruzamento queimado: uma massa de carvão que some suave para a casca.
	float ang = atan(m.y, m.x);
	vec2 l1 = girar(m, -ANG_LENHA);
	vec2 l2 = girar(m, ANG_LENHA);
	float na_lenha = cobre(min(sd_tora(l1, LENHA_MEIA, LENHA_RAIO), sd_tora(l2, LENHA_MEIA, LENHA_RAIO)) + 0.03, px);
	float dc = r - (CARVAO_RAIO + 0.014 * cos(3.0 * ang + 0.7));
	pousar_cor(av, ac, CARVAO, 0.9 * na_lenha * clamp(0.5 - dc / 0.03, 0.0, 1.0));
	// As brasas: a grande no cruzamento, 2 pequenas no pé da chama (que nasce 0,18 abaixo do meio).
	desenhar_brasa(av, ac, m, vec2(0.004, 0.012), vec2(0.076, 0.058), 0.35, lm, px);
	desenhar_brasa(av, ac, m, vec2(-0.152, 0.158), vec2(0.044, 0.032), -0.25, lm, px);
	desenhar_brasa(av, ac, m, vec2(0.158, 0.128), vec2(0.038, 0.028), 0.45, lm, px);
	// A roda, por cima de tudo.
	desenhar_roda(av, ac, m, lm, px);
}

// ---- De lado ----

// Um domo de pedra: a meia elipse de cima, cortada reta na base.
float sd_domo(vec2 p, float x, float topo, float meia) {
	vec2 c = vec2(x, FUNDO_LADO);
	float d = sd_elipse(p - c, vec2(meia, FUNDO_LADO - topo));
	return smax(d, p.y - FUNDO_LADO, 0.02);
}

void desenhar_domo(inout vec4 av, inout vec4 ac, vec2 m, float x, float topo, float meia, float tom, vec2 lm, float px) {
	float d = sd_domo(m, x, topo, meia);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + CONTORNO_CASAS, px);
	float v = V_MEIO + 0.05 + tom;
	pousar(av, ac, v, 1, dentro);
	float escura = dentro * (1.0 - cobre(sd_domo(m - lm * LUZ_DA_PEDRA * 1.5, x, topo, meia) + CONTORNO_CASAS, px));
	pousar(av, ac, v - MASSA_ESCURA - 0.02, 1, escura);
	float clara = dentro * (1.0 - cobre(sd_domo(m + lm * LUZ_DA_PEDRA, x, topo, meia) + CONTORNO_CASAS, px));
	pousar(av, ac, v + MASSA_CLARA, 1, clara);
}

void pintar_de_lado(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	// O monte de cinza atrás das pedras (só a beirada aparece entre os domos).
	float dm = sd_elipse(m - vec2(0.0, 0.405), vec2(0.43, 0.07));
	if (dm < px) {
		float fina = cobre(sd_elipse(m - vec2(0.0, 0.405) + lm * 0.03, vec2(0.41, 0.05)) + 0.0, px);
		pousar_cor(av, ac, mix(LEITO, CINZA_FINA, 0.8 * (1.0 - fina) * cobre(dm + 0.01, px)), cobre(dm, px));
	}
	// A lenha em X, subindo de trás das pedras: o corte só na ponta de cima.
	vec2 a1 = vec2(-0.27, 0.42);
	vec2 b1 = vec2(0.25, 0.085);
	vec2 a2 = vec2(0.27, 0.42);
	vec2 b2 = vec2(-0.25, 0.085);
	float meia = 0.5 * length(b1 - a1);
	float ang1 = atan(b1.y - a1.y, b1.x - a1.x);
	float ang2 = atan(b2.y - a2.y, b2.x - a2.x);
	desenhar_tora(av, ac, m, 0.5 * (a1 + b1), ang1, meia, LENHA_RAIO_LADO, 1, 0.4, lm, px);
	desenhar_tora(av, ac, m, 0.5 * (a2 + b2), ang2, meia, LENHA_RAIO_LADO, 1, 2.2, lm, px);
	// O cruzamento queimado, onde a chama do app nasce (0,68 da altura a partir de cima).
	vec2 cr = vec2(0.0, 0.245);
	float na_lenha = cobre(min(sd_tora(girar(m - 0.5 * (a1 + b1), -ang1), meia, LENHA_RAIO_LADO), sd_tora(girar(m - 0.5 * (a2 + b2), -ang2), meia, LENHA_RAIO_LADO)) + 0.03, px);
	float dc = length((m - cr) / vec2(1.0, 0.85)) - 0.085;
	pousar_cor(av, ac, CARVAO, 0.9 * na_lenha * clamp(0.5 - dc / 0.03, 0.0, 1.0));
	// As brasas no colo do X.
	desenhar_brasa(av, ac, m, vec2(0.0, 0.300), vec2(0.078, 0.034), 0.0, lm, px);
	desenhar_brasa(av, ac, m, vec2(-0.135, 0.346), vec2(0.040, 0.024), 0.15, lm, px);
	desenhar_brasa(av, ac, m, vec2(0.128, 0.350), vec2(0.036, 0.022), -0.15, lm, px);
	// As 4 pedras em domo, na frente; as do meio por cima das das pontas.
	desenhar_domo(av, ac, m, -0.372, 0.372, 0.142, 0.03, lm, px);
	desenhar_domo(av, ac, m, 0.378, 0.360, 0.140, -0.02, lm, px);
	desenhar_domo(av, ac, m, -0.128, 0.348, 0.138, -0.035, lm, px);
	desenhar_domo(av, ac, m, 0.124, 0.376, 0.136, 0.045, lm, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	if (vis == 1) {
		pintar_de_lado(av, ac, m, lm, px);
	} else {
		pintar_de_cima(av, ac, m, lm, px);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

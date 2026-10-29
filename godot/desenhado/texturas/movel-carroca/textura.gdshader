// CARROÇA desenhada que pega cor (onda 4, lote 12; CONTRATO.md seção 10).
//
// Uma carroça de 4 rodas, a mesma nas duas vistas: a caçamba de x -0,62 a 0,98, o varal
// em -x, a roda da frente menor (x -0,34) e a de trás maior (x 0,56), e 3 sacos de carga
// nos mesmos x. Desenhada no referencial da carroça e acesa no da tela (movel_de /
// tela_de), como a cadeira: a luz fica em cima à esquerda em toda virada. Ela não é
// simétrica (o varal só de um lado): 4 viradas nas duas vistas.
//
// DE FRENTE (vista de cima):
// - os 2 VARAIS e a travessa na ponta, saindo de baixo da caçamba;
// - as 4 RODAS dos lados, cada uma uma tira do aro de ferro (lugar 2) com o cubo de
//   madeira para fora; a sombra da caçamba cai nelas;
// - a CAÇAMBA: a borda das paredes (o mais claro) e o fundo em 3 tábuas largas ao
//   longo, um tom abaixo, com a sombra das paredes de cima e da esquerda;
// - a CARGA: 3 sacos de linho (cor própria), massas grandes com a sombra no fundo.
// DE LADO (a Frente/Lado do mestre): a caçamba em 2 tábuas largas com a borda e os 2
// esteios, a longarina embaixo, o varal descendo até o chão, os sacos aparecendo por
// cima da borda e as 2 rodas na frente de tudo: o aro de ferro (lugar 2, o brilho em
// cima à esquerda, como o do barril), a cambota e 5 raios largos de madeira e o cubo.
// Nada de prego, veio nem raio fino. Lugares: 1 = a madeira, 2 = os aros. A sombra no
// chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- A planta, em casas, no referencial da carroça (x ao longo, o varal em -x) ----
const float CAIXA_X0 = -0.62;
const float CAIXA_X1 = 0.98;
const float CAIXA_Y = 0.42;      // meia largura da caçamba, de cima
const float PAREDE = 0.075;      // a borda das paredes vista de cima
const float RODA_X_FRENTE = -0.34;
const float RODA_R_FRENTE = 0.29;
const float RODA_X_TRAS = 0.56;
const float RODA_R_TRAS = 0.37;
const float RODA_Y = 0.465;      // o meio da roda, de cima (a beira de dentro passa debaixo da caçamba)
const float RODA_MEIA = 0.052;   // meia largura da roda vista de cima
const float VARAL_Y = 0.2;
const float VARAL_PONTA = -0.95;
const float MEIO_PAU = 0.036;    // meia largura dos varais e da travessa
const float CHAO = 0.605;        // onde as rodas pousam, de lado
const int RAIOS = 5;
const float MEIO_RAIO = 0.04;

// As sombras curtas, na tela (o quanto cada coisa é alta).
const vec2 S_CACAMBA = vec2(0.035, 0.055);
const vec2 S_SACO = vec2(0.03, 0.045);

// O LINHO do app (#c1b59c, o saco da carroça de hoje) pela rampa OKLab da família
// (CONTRATO 10.5), tirada nos níveis V_* com ferramentas/movel.ts: a cor própria anda
// como as partes tingidas.
vec3 linho(float v) {
	const vec3 L10 = vec3(0.310, 0.264, 0.167);
	const vec3 L24 = vec3(0.426, 0.380, 0.282);
	const vec3 L36 = vec3(0.552, 0.505, 0.407);
	const vec3 L50 = vec3(0.757, 0.710, 0.612);
	const vec3 L62 = vec3(0.789, 0.743, 0.647);
	const vec3 L76 = vec3(0.827, 0.784, 0.688);
	if (v <= 0.24) {
		return mix(L10, L24, clamp((v - 0.10) / 0.14, 0.0, 1.0));
	}
	if (v <= 0.36) {
		return mix(L24, L36, (v - 0.24) / 0.12);
	}
	if (v <= 0.50) {
		return mix(L36, L50, (v - 0.36) / 0.14);
	}
	if (v <= 0.62) {
		return mix(L50, L62, (v - 0.50) / 0.12);
	}
	return mix(L62, L76, clamp((v - 0.62) / 0.14, 0.0, 1.0));
}

// Uma peça de distância d com as massas de luz (dl = a distância andada para a luz, ds =
// andada para longe dela), como desenhar_caixa, para as peças giradas (raio, varal, saco).
void pousar_peca(inout vec4 av, inout vec4 ac, float d, float dl, float ds, float co, float valor, int lugar, float px) {
	pousar(av, ac, V_CONTORNO, lugar, cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar(av, ac, valor, lugar, dentro);
	pousar(av, ac, valor - MASSA_ESCURA, lugar, dentro * (1.0 - cobre(ds + co, px)));
	pousar(av, ac, valor + MASSA_CLARA, lugar, dentro * (1.0 - cobre(dl + co, px)));
}

// O mesmo, em cor própria (os sacos).
void pousar_saco(inout vec4 av, inout vec4 ac, float d, float dl, float ds, float co, float v, float px) {
	pousar_cor(av, ac, linho(V_CONTORNO + 0.03), cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar_cor(av, ac, linho(v), dentro);
	pousar_cor(av, ac, linho(v - 0.13), dentro * (1.0 - cobre(ds + co, px)));
	pousar_cor(av, ac, linho(v + 0.2), dentro * (1.0 - cobre(dl + co, px)));
}

// Uma caixa de quina redonda girada a (meio c, meia medida b, raio r).
float sd_girada(vec2 m, vec2 c, vec2 b, float r, float a) {
	return sd_caixa(girar(m - c, -a), b, r);
}

// Os 3 sacos: de cima (meio, meia medida, giro, para que ponta vai a boca amarrada: 1 ou
// -1, 0 = escondida) e de lado (meio, meia medida da corcova).
void saco_de_cima(int i, out vec2 c, out vec2 e, out float a, out float tom, out float boca) {
	if (i == 0) {
		c = vec2(-0.2, -0.11); e = vec2(0.21, 0.165); a = 0.25; tom = 0.0; boca = -1.0;
	} else if (i == 1) {
		c = vec2(0.6, -0.07); e = vec2(0.18, 0.15); a = 0.45; tom = -0.03; boca = 0.0;
	} else {
		c = vec2(0.17, 0.13); e = vec2(0.22, 0.17); a = -0.2; tom = 0.02; boca = 1.0;
	}
}

void saco_de_lado(int i, out vec2 c, out vec2 e, out float tom) {
	if (i == 0) {
		c = vec2(-0.22, -0.36); e = vec2(0.22, 0.15); tom = -0.02;
	} else if (i == 1) {
		c = vec2(0.58, -0.33); e = vec2(0.19, 0.125); tom = -0.05;
	} else {
		c = vec2(0.17, -0.37); e = vec2(0.24, 0.165); tom = 0.02;
	}
}

void frente(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	vec2 cc = vec2((CAIXA_X0 + CAIXA_X1) * 0.5, 0.0);
	vec2 bc = vec2((CAIXA_X1 - CAIXA_X0) * 0.5, CAIXA_Y);
	// O que está debaixo da caçamba leva a sombra dela.
	float s_cac = cobre(sd_caixa(movel_de(q - S_CACAMBA, vir) - cc, bc, 0.045), px) * 0.8;
	// 1. Os varais e a travessa na ponta.
	for (int i = 0; i < 2; i++) {
		float sy = i == 0 ? -1.0 : 1.0;
		vec2 cv = vec2((VARAL_PONTA + CAIXA_X0 + 0.08) * 0.5, sy * VARAL_Y);
		vec2 bv = vec2((CAIXA_X0 + 0.08 - VARAL_PONTA) * 0.5, MEIO_PAU);
		desenhar_caixa(av, ac, m, cv, bv, 0.02, V_MEIO - 0.02, 0.02, 1, vir, px);
		pousar(av, ac, V_SOMBRA - 0.06, 1, cobre(sd_caixa(m - cv, bv, 0.02) + 0.01, px) * s_cac);
	}
	desenhar_caixa(av, ac, m, vec2(VARAL_PONTA, 0.0), vec2(MEIO_PAU, VARAL_Y + 0.075), 0.02, V_MEIO + 0.02, 0.02, 1, vir, px);
	// 2. As 4 rodas: o cubo de madeira para fora e a tira do aro de ferro.
	for (int i = 0; i < 4; i++) {
		float xr = i < 2 ? RODA_X_FRENTE : RODA_X_TRAS;
		float R = i < 2 ? RODA_R_FRENTE : RODA_R_TRAS;
		float sy = i % 2 == 0 ? -1.0 : 1.0;
		vec2 ch = vec2(xr, sy * (RODA_Y + RODA_MEIA + 0.02));
		desenhar_caixa(av, ac, m, ch, vec2(0.075, 0.035), 0.025, V_MEIO + 0.03, 0.02, 1, vir, px);
		vec2 cr = vec2(xr, sy * RODA_Y);
		vec2 br = vec2(R, RODA_MEIA);
		desenhar_caixa(av, ac, m, cr, br, RODA_MEIA * 0.9, V_MEIO - 0.04, 0.03, 2, vir, px);
		pousar(av, ac, V_SOMBRA - 0.04, 2, cobre(sd_caixa(m - cr, br, RODA_MEIA * 0.9) + 0.01, px) * s_cac);
	}
	// 3. A caçamba: a borda das paredes e o fundo de 3 tábuas largas.
	desenhar_caixa(av, ac, m, cc, bc, 0.045, V_MEIO + 0.04, 0.03, 1, vir, px);
	vec2 bf = bc - vec2(PAREDE);
	float df = sd_caixa(m - cc, bf, 0.02);
	pousar(av, ac, V_CONTORNO + 0.04, 1, cobre(df, px));
	float dentro = cobre(df + 0.016, px);
	float alto = 2.0 * bf.y / 3.0;
	float ty = (m.y + bf.y) / alto;
	float j = clamp(floor(ty), 0.0, 2.0);
	float tom = j == 0.0 ? 0.02 : (j == 1.0 ? -0.02 : 0.0);
	pousar(av, ac, V_MEIO - 0.06 + tom, 1, dentro);
	float kt = floor(ty + 0.5);
	if (kt >= 1.0 && kt <= 2.0) {
		desenhar_linha(av, ac, abs(ty - kt) * alto, 0.007, V_FUNDO + 0.02, dentro, 1, px);
	}
	// A sombra das paredes de cima e da esquerda (na tela) no fundo.
	float sombra_parede = 1.0 - cobre(sd_caixa(m + lm * 0.06 - cc, bf, 0.02), px);
	pousar(av, ac, V_SOMBRA - 0.04, 1, dentro * sombra_parede * 0.85);
	// 4. A carga: a sombra dos sacos no fundo, depois os sacos.
	vec2 ms = movel_de(q - S_SACO, vir);
	for (int i = 0; i < 3; i++) {
		vec2 c; vec2 e; float a; float t; float boca;
		saco_de_cima(i, c, e, a, t, boca);
		float r = min(e.x, e.y) * 0.95;
		pousar(av, ac, V_SOMBRA - 0.08, 1, dentro * cobre(sd_girada(ms, c, e, r, a), px) * 0.8);
	}
	for (int i = 0; i < 3; i++) {
		vec2 c; vec2 e; float a; float t; float boca;
		saco_de_cima(i, c, e, a, t, boca);
		vec2 eixo = vec2(cos(a), sin(a)) * boca;
		if (boca != 0.0) {
			// A boca amarrada: o tufo do pano franzido e o pescoço, por baixo do saco.
			vec2 ct = c + eixo * (e.x + 0.065);
			vec2 bt = vec2(0.05, 0.082);
			pousar_saco(av, ac, sd_girada(m, ct, bt, 0.04, a), sd_girada(m + lm * 0.02, ct, bt, 0.04, a), sd_girada(m - lm * 0.03, ct, bt, 0.04, a), 0.02, V_MEIO + t - 0.02, px);
			vec2 cn = c + eixo * (e.x + 0.005);
			vec2 bn = vec2(0.035, 0.04);
			pousar_saco(av, ac, sd_girada(m, cn, bn, 0.02, a), -1.0, -1.0, 0.016, V_SOMBRA + t, px);
		}
		float r = min(e.x, e.y) * 0.95;
		float d = sd_girada(m, c, e, r, a);
		float dl = sd_girada(m + lm * 0.035, c, e, r, a);
		float ds = sd_girada(m - lm * 0.05, c, e, r, a);
		pousar_saco(av, ac, d, dl, ds, CONTORNO_CASAS * 0.85, V_MEIO + t, px);
	}
}

// Uma roda de lado: os raios, o aro de ferro, a cambota e o cubo.
void roda_de_lado(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, float R, float a0, int vir, float px) {
	vec2 p = m - c;
	float r = length(p);
	if (r - R > px) {
		return;
	}
	vec2 lm = movel_de(LUZ, vir);
	float l = dot(tela_de(p, vir) / max(r, 1e-5), LUZ); // 1 = o lado de cima à esquerda
	float r_aro = R - 0.03 - 0.10 * R;          // a beira de dentro do ferro
	float r_cambota = r_aro - 0.012 - 0.12 * R; // a beira de dentro da cambota
	float r_dentro = r_cambota - 0.02;
	// Os raios, largos, por baixo da cambota e do cubo.
	for (int i = 0; i < RAIOS; i++) {
		float a = a0 + float(i) * 6.2831853 / float(RAIOS);
		vec2 dir = vec2(cos(a), sin(a));
		float r0 = 0.05;
		float r1 = r_cambota + 0.01;
		vec2 cr = dir * (r0 + r1) * 0.5;
		vec2 br = vec2((r1 - r0) * 0.5, MEIO_RAIO);
		float d = sd_girada(p, cr, br, 0.012, a);
		float dl = sd_girada(p + lm * 0.014, cr, br, 0.012, a);
		float ds = sd_girada(p - lm * 0.018, cr, br, 0.012, a);
		pousar_peca(av, ac, d, dl, ds, 0.016, V_MEIO - 0.02, 1, px);
	}
	// O contorno do anel: o de fora no ferro, o de dentro na madeira.
	pousar(av, ac, V_CONTORNO, 2, cobre(max(r - R, r_aro - 0.006 - r), px));
	pousar(av, ac, V_CONTORNO, 1, cobre(max(r - (r_aro - 0.006), r_dentro - r), px));
	// O aro de ferro: o brilho em faixa em cima à esquerda, o escuro embaixo à direita.
	float metal = mix(V_FUNDO + 0.06, V_MEIO - 0.02, smoothstep(-0.6, -0.1, l));
	metal = mix(metal, V_REALCE + 0.04, smoothstep(0.35, 0.6, l));
	pousar(av, ac, metal, 2, cobre(max(r - (R - 0.03), r_aro - r), px));
	// A cambota de madeira.
	float cambota = mix(V_SOMBRA + 0.02, V_MEIO + 0.07, smoothstep(-0.5, 0.5, l));
	pousar(av, ac, cambota, 1, cobre(max(r - (r_aro - 0.012), r_cambota - r), px));
	// O cubo.
	desenhar_elipse(av, ac, m, c, vec2(0.075), V_MEIO + 0.04, 0.02, 1, vir, px);
}

void de_lado(vec2 q, float px, int vir, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	// 1. Os sacos por cima da borda (o de trás primeiro).
	for (int i = 0; i < 3; i++) {
		vec2 c; vec2 e; float t;
		saco_de_lado(i, c, e, t);
		float r = min(e.x, e.y) * 0.85;
		float d = sd_caixa(m - c, e, r);
		float dl = sd_caixa(m + lm * 0.035 - c, e, r);
		float ds = sd_caixa(m - lm * 0.05 - c, e, r);
		pousar_saco(av, ac, d, dl, ds, CONTORNO_CASAS * 0.85, V_MEIO + t, px);
	}
	// 2. O varal, da frente da caçamba até o chão, e a travessa vista de ponta.
	vec2 va = vec2(-0.58, 0.02);
	vec2 vb = vec2(-0.93, 0.56);
	vec2 vd = vb - va;
	float ang = atan(vd.y, vd.x);
	vec2 cv = (va + vb) * 0.5;
	vec2 bv = vec2(length(vd) * 0.5, MEIO_PAU);
	pousar_peca(av, ac, sd_girada(m, cv, bv, 0.025, ang), sd_girada(m + lm * 0.014, cv, bv, 0.025, ang), sd_girada(m - lm * 0.02, cv, bv, 0.025, ang), 0.016, V_MEIO - 0.02, 1, px);
	desenhar_caixa(av, ac, m, vec2(VARAL_PONTA, 0.565), vec2(0.04, 0.04), 0.015, V_MEIO + 0.02, 0.02, 1, vir, px);
	// 3. A longarina debaixo da caçamba, na sombra dela.
	desenhar_caixa(av, ac, m, vec2(0.19, 0.08), vec2(0.69, 0.03), 0.01, V_SOMBRA, 0.012, 1, vir, px);
	// 4. A caçamba: 2 tábuas largas, a borda de cima e os 2 esteios.
	vec2 cc = vec2((CAIXA_X0 + CAIXA_X1) * 0.5, -0.125);
	vec2 bc = vec2((CAIXA_X1 - CAIXA_X0) * 0.5, 0.175);
	desenhar_caixa(av, ac, m, cc, bc, 0.02, V_MEIO - 0.03, 0.03, 1, vir, px);
	float dc = sd_caixa(m - cc, bc, 0.02);
	desenhar_linha(av, ac, abs(m.y - cc.y), 0.007, V_FUNDO + 0.02, cobre(dc + 0.03, px), 1, px);
	desenhar_caixa(av, ac, m, vec2(cc.x, -0.31), vec2(bc.x + 0.03, 0.036), 0.015, V_MEIO + 0.07, 0.02, 1, vir, px);
	for (int i = 0; i < 2; i++) {
		float x = i == 0 ? CAIXA_X0 + 0.04 : CAIXA_X1 - 0.04;
		desenhar_caixa(av, ac, m, vec2(x, -0.11), vec2(0.04, 0.2), 0.015, V_MEIO + 0.0, 0.02, 1, vir, px);
	}
	// 5. As rodas, na frente de tudo.
	roda_de_lado(av, ac, m, vec2(RODA_X_FRENTE, CHAO - RODA_R_FRENTE), RODA_R_FRENTE, 0.35, vir, px);
	roda_de_lado(av, ac, m, vec2(RODA_X_TRAS, CHAO - RODA_R_TRAS), RODA_R_TRAS, 0.95, vir, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (vis == 1) {
		de_lado(q, px, vir, av, ac);
	} else {
		frente(q, px, vir, av, ac);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

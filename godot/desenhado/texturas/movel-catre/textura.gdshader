// CAMA (catre) desenhada que pega cor (onda 4, lote 11; CONTRATO.md seção 10).
//
// Da família do piloto e do lote 10: contorno grosso na própria cor, formas grandes e luz
// em poucas massas, a de cima à esquerda. Nada de veio, prego, costura, franja ou xadrez.
// É o primeiro móvel com TECIDO grande (o sofá, a poltrona e os tapetes seguem esta
// régua): o pano lê como pano porque as massas dele são curvas e largas, e a madeira
// porque é reta e tem face.
//
// A cama de 1 x 2, a cabeceira em cima (y do móvel = -1), de baixo para cima:
// - a ARMAÇÃO (lugar 1): a caixa inteira, que aparece como as duas laterais largas ao
//   lado do colchão (a da esquerda pega a luz, a da direita fica funda);
// - o LENÇOL (cor própria, o LENCOL do app): o colchão entre as laterais, liso, com as
//   massas da borda e as sombras curtas do travesseiro, da cabeceira e da barra dobrada;
// - o TRAVESSEIRO (lugar 3): uma almofada de lados um pouco cavados, com UMA massa de
//   luz larga para cima e à esquerda e a sombra embaixo à direita;
// - o COBERTOR (lugar 2): o corpo cobre as laterais até o pé (o pano cai por cima da
//   armação), com as massas da borda e UMA dobra grande, um rolo de pano em curva
//   suave (o lado claro em cima, a sombra curta embaixo, afinando nas duas pontas); por
//   cima, a BARRA dobrada, o avesso virado: uma faixa mais clara, um pouco mais larga, com
//   contorno e a sombra curta no corpo;
// - o PÉ (lugar 1): uma tábua baixa com dois postes nas quinas, por cima do cobertor;
// - a CABECEIRA (lugar 1): a tábua firme e alta, com a face que aparece para baixo e para a
//   direita na tela (como o tampo da mesa) e dois postes mais altos nas quinas; ela faz a
//   sombra curta no travesseiro e no lençol.
// 4 viradas: a cabeceira não é simétrica de cima a baixo e a dobra do cobertor não é de
// lado a lado. Desenhada no referencial da cama e acesa no da tela (movel_de / tela_de):
// a face das tábuas altas e as sombras curtas andam sempre para baixo e para a direita
// na tela. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- A estrutura (lugar 1) ----
const float RECUO = 0.01;              // a armação recuada da pegada, casas
const float QUINA = 0.04;
const float BEIRA = 0.10;              // a largura da lateral, da beira até o colchão
const float LUZ_DA_ARMACAO = 0.035;
const float CAB_FIM = -0.74;           // onde a cabeceira acaba (a cama vai de -1 a 1)
const vec2 CAB_ESP = vec2(0.014, 0.05);      // a face da cabeceira, na tela
const vec2 POSTE_CAB = vec2(0.11, 0.135);    // meia medida do poste da cabeceira
const vec2 POSTE_CAB_ESP = vec2(0.018, 0.065);
const float PE_COMECO = 0.875;
const vec2 PE_ESP = vec2(0.008, 0.026);
const vec2 POSTE_PE = vec2(0.075, 0.075);
const vec2 POSTE_PE_ESP = vec2(0.010, 0.034);

// ---- O lençol (cor própria) ----
const vec2 C_LENCOL = vec2(0.0, 0.05);
const float LENCOL_Y = 0.87;           // meia altura (vai de debaixo da cabeceira até o pé)
const float CO_LENCOL = 0.034;         // o contorno do lençol (a costura com a lateral)
const float LUZ_DO_LENCOL = 0.035;

// ---- O travesseiro (lugar 3) ----
const vec2 C_TRAV = vec2(0.0, -0.585);
const vec2 B_TRAV = vec2(0.36, 0.16);
const float R_TRAV = 0.10;
const float APERTO = 0.022;            // o quanto o meio de cada lado entra (a almofada)

// ---- O cobertor (lugar 2) ----
const vec2 C_CORPO = vec2(0.0, 0.405);
const vec2 B_CORPO = vec2(0.495, 0.525);
const float R_CORPO = 0.035;
const float LUZ_DO_PANO = 0.06;        // a massa clara da borda do pano (a escura é 1,5 x)
const vec2 C_BARRA = vec2(0.0, -0.12);
const vec2 B_BARRA = vec2(0.505, 0.10);
const float R_BARRA = 0.045;
const float ESTUFA = 0.008;            // o quanto o meio de cada beira do pano estufa para fora
// A dobra grande: uma ruga longa e larga NO COMPRIDO, a que o pano faz quando as beiras
// caem pelos lados: uma curva suave (Bézier de A a B puxada por M, em 6 trechos), mais
// larga no meio e de pontas redondas; o rolo claro e, encostada embaixo à direita, a
// sombra curta dele, os dois de pouco contraste. (Testado e reprovado no olho: o rolo
// fino atravessado lia como um corte; dois lobos de beira a beira, como uma faixa; o arco
// de uma elipse, como um enfeite carimbado; dois trechos retos, como um "<".)
const vec2 DOBRA_A = vec2(0.18, 0.02);
const vec2 DOBRA_M = vec2(-0.10, 0.40);
const vec2 DOBRA_B = vec2(0.12, 0.80);
const vec2 DOBRA_CRISTA = vec2(0.016, 0.058); // meia largura do rolo: nas pontas, no meio
const vec2 DOBRA_SOMBRA = vec2(0.02, 0.064);
const vec2 S_DOBRA = vec2(0.03, 0.035);  // para onde a sombra dele anda, na tela

// ---- As sombras curtas, na tela (o quanto cada peça é alta) ----
const vec2 S_CAB = vec2(0.03, 0.06);
const vec2 S_TRAV = vec2(0.02, 0.035);
const vec2 S_BARRA = vec2(0.02, 0.045);
const vec2 S_PE = vec2(0.02, 0.035);

// O LENCOL do app (contexto.ts: o linho x 1,03, #dbcdaa) pela rampa OKLab da família
// (CONTRATO 10.5), tirada nos níveis V_*: a cor própria anda como as partes tingidas.
vec3 lencol(float v) {
	const vec3 L10 = vec3(0.356, 0.302, 0.162);
	const vec3 L24 = vec3(0.489, 0.434, 0.296);
	const vec3 L36 = vec3(0.628, 0.573, 0.435);
	const vec3 L50 = vec3(0.859, 0.804, 0.667);
	const vec3 L62 = vec3(0.880, 0.827, 0.692);
	const vec3 L76 = vec3(0.905, 0.854, 0.723);
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

// A almofada: a caixa de quina redonda com o meio de cada lado um pouco para dentro.
float sd_almofada(vec2 p, vec2 b, float r, float aperto) {
	vec2 t = clamp(p / b, -1.0, 1.0);
	vec2 bb = b - aperto * vec2(1.0 - t.y * t.y, 1.0 - t.x * t.x);
	return sd_caixa(p, bb, r);
}

// A ruga do cobertor: a curva em 6 trechos, meia largura r.x nas pontas e r.y no meio.
vec2 ponto_da_dobra(float t) {
	float u = 1.0 - t;
	return u * u * DOBRA_A + 2.0 * u * t * DOBRA_M + t * t * DOBRA_B;
}

float sd_dobra(vec2 m, vec2 r) {
	float d = 1e3;
	vec2 a = ponto_da_dobra(0.0);
	float ra = r.x;
	for (int i = 1; i <= 6; i++) {
		float t = float(i) / 6.0;
		vec2 b = ponto_da_dobra(t);
		float rb = mix(r.x, r.y, sin(3.14159265 * t));
		d = min(d, sd_traco(m, a, b, ra, rb));
		a = b;
		ra = rb;
	}
	return d;
}

// A cabeceira inteira (a tábua e os dois postes), para a sombra curta.
float sd_cabeceira(vec2 m, vec2 bf) {
	float d = sd_caixa(m - vec2(0.0, (-bf.y + CAB_FIM) * 0.5), vec2(bf.x, (CAB_FIM + bf.y) * 0.5), QUINA);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		d = min(d, sd_caixa(m - vec2(sx * (bf.x - POSTE_CAB.x), -bf.y + POSTE_CAB.y), POSTE_CAB, 0.03));
	}
	return d;
}

// O pé inteiro (a tábua e os dois postes), para a sombra curta.
float sd_pe(vec2 m, vec2 bf) {
	float d = sd_caixa(m - vec2(0.0, (PE_COMECO + bf.y) * 0.5), vec2(bf.x, (bf.y - PE_COMECO) * 0.5), 0.03);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		d = min(d, sd_caixa(m - vec2(sx * (bf.x - POSTE_PE.x), bf.y - POSTE_PE.y), POSTE_PE, 0.025));
	}
	return d;
}

// Uma peça alta de madeira (a cabeceira, o pé, um poste): a face, que aparece para baixo
// e para a direita na tela, no tom do fundo, e o topo com as massas. A peça inteira cabe
// na caixa (c0, b0): o topo anda meia face para a luz, a face meia face para longe dela.
void peca_alta(inout vec4 av, inout vec4 ac, vec2 m, vec2 c0, vec2 b0, float r, vec2 esp, float valor, float bisel, int vir, float px) {
	if (sd_caixa(m - c0, b0, r) > px) {
		return;
	}
	vec2 em = movel_de(esp, vir);
	vec2 b = b0 - abs(em) * 0.5;
	float df = sd_caixa(m - c0 - em * 0.5, b, r);
	pousar(av, ac, V_CONTORNO, 1, cobre(df, px));
	pousar(av, ac, V_FUNDO + 0.05, 1, cobre(df + contorno_para(b), px));
	desenhar_caixa(av, ac, m, c0 - em * 0.5, b, r, valor, bisel, 1, vir, px);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = pegada_do_movel(vir) * 0.5;
	vec2 bf = h - vec2(RECUO);
	vec2 m = movel_de(q, vir);
	if (sd_caixa(m, bf + vec2(0.04), QUINA) > px) {
		return;
	}
	vec2 lm = movel_de(LUZ, vir);
	// As sombras curtas: o ponto de cada peça alta que joga sombra aqui (andado na tela).
	float s_cab = cobre(sd_cabeceira(movel_de(q - S_CAB, vir), bf), px);
	float s_trav = cobre(sd_almofada(movel_de(q - S_TRAV, vir) - C_TRAV, B_TRAV, R_TRAV, APERTO), px);
	float s_barra = cobre(sd_caixa(movel_de(q - S_BARRA, vir) - C_BARRA, B_BARRA, R_BARRA), px);
	float s_pe = cobre(sd_pe(movel_de(q - S_PE, vir), bf), px);

	// 1. A armação: as laterais ao lado do colchão.
	desenhar_caixa(av, ac, m, vec2(0.0), bf, QUINA, V_MEIO - 0.01, LUZ_DA_ARMACAO, 1, vir, px);
	float armacao = cobre(sd_caixa(m, bf, QUINA) + CONTORNO_CASAS, px);
	pousar(av, ac, V_SOMBRA - 0.04, 1, armacao * s_cab * 0.75);

	// 2. O lençol: liso, as massas da borda e as sombras curtas de quem está por cima.
	vec2 bl = vec2(bf.x - BEIRA, LENCOL_Y);
	vec2 pl = m - C_LENCOL;
	float dl = sd_caixa(pl, bl, 0.03);
	if (dl < px) {
		pousar_cor(av, ac, lencol(V_CONTORNO + 0.04), cobre(dl, px));
		float dentro = cobre(dl + CO_LENCOL, px);
		pousar_cor(av, ac, lencol(V_MEIO), dentro);
		pousar_cor(av, ac, lencol(V_SOMBRA + 0.05), dentro * (1.0 - cobre(sd_caixa(pl - lm * LUZ_DO_LENCOL * 1.5, bl, 0.03) + CO_LENCOL, px)));
		pousar_cor(av, ac, lencol(V_REALCE), dentro * (1.0 - cobre(sd_caixa(pl + lm * LUZ_DO_LENCOL, bl, 0.03) + CO_LENCOL, px)));
		pousar_cor(av, ac, lencol(V_SOMBRA + 0.02), dentro * max(max(s_cab, s_trav), s_barra) * 0.8);
	}

	// 3. O travesseiro: a almofada, a sombra embaixo à direita e uma massa de luz larga.
	vec2 pt = m - C_TRAV;
	float dt = sd_almofada(pt, B_TRAV, R_TRAV, APERTO);
	if (dt < px) {
		pousar(av, ac, V_CONTORNO, 3, cobre(dt, px));
		float dentro = cobre(dt + CONTORNO_CASAS, px);
		pousar(av, ac, V_MEIO, 3, dentro);
		pousar(av, ac, V_SOMBRA + 0.03, 3, dentro * (1.0 - cobre(sd_almofada(pt - lm * 0.045, B_TRAV, R_TRAV, APERTO) + CONTORNO_CASAS, px)));
		float d_luz = sd_almofada(pt - lm * 0.035, B_TRAV - vec2(0.08, 0.055), R_TRAV * 0.8, APERTO);
		pousar(av, ac, V_LUZ + 0.06, 3, dentro * cobre(d_luz, px));
		pousar(av, ac, V_SOMBRA - 0.02, 3, dentro * max(s_cab, s_barra) * 0.75);
	}

	// 4. O cobertor: o corpo estufado com as massas largas da beira (o pano que cai pela
	// lateral: claro à esquerda, fundo à direita), a ruga grande e as sombras curtas da
	// barra e do pé.
	vec2 pc = m - C_CORPO;
	float dc = sd_almofada(pc, B_CORPO, R_CORPO, -ESTUFA);
	if (dc < px) {
		pousar(av, ac, V_CONTORNO, 2, cobre(dc, px));
		float dentro = cobre(dc + CONTORNO_CASAS, px);
		pousar(av, ac, V_MEIO - 0.01, 2, dentro);
		pousar(av, ac, V_MEIO - 0.01 - MASSA_ESCURA, 2, dentro * (1.0 - cobre(sd_almofada(pc - lm * LUZ_DO_PANO * 1.5, B_CORPO, R_CORPO, -ESTUFA) + CONTORNO_CASAS, px)));
		pousar(av, ac, V_MEIO - 0.01 + MASSA_CLARA, 2, dentro * (1.0 - cobre(sd_almofada(pc + lm * LUZ_DO_PANO, B_CORPO, R_CORPO, -ESTUFA) + CONTORNO_CASAS, px)));
		pousar(av, ac, V_MEIO - 0.09, 2, dentro * cobre(sd_dobra(movel_de(q - S_DOBRA, vir), DOBRA_SOMBRA), px));
		pousar(av, ac, V_MEIO + 0.06, 2, dentro * cobre(sd_dobra(m, DOBRA_CRISTA), px));
		pousar(av, ac, V_SOMBRA - 0.02, 2, dentro * max(s_barra, s_pe) * 0.8);
	}

	// 5. A barra dobrada do cobertor (o avesso, mais claro), estufada como o corpo.
	vec2 pb = m - C_BARRA;
	float db = sd_almofada(pb, B_BARRA, R_BARRA, -ESTUFA);
	if (db < px) {
		pousar(av, ac, V_CONTORNO, 2, cobre(db, px));
		float dentro = cobre(db + CONTORNO_CASAS, px);
		pousar(av, ac, V_MEIO + 0.05, 2, dentro);
		pousar(av, ac, V_MEIO + 0.05 - MASSA_ESCURA, 2, dentro * (1.0 - cobre(sd_almofada(pb - lm * 0.035, B_BARRA, R_BARRA, -ESTUFA) + CONTORNO_CASAS, px)));
		pousar(av, ac, V_MEIO + 0.05 + MASSA_CLARA, 2, dentro * (1.0 - cobre(sd_almofada(pb + lm * 0.03, B_BARRA, R_BARRA, -ESTUFA) + CONTORNO_CASAS, px)));
	}

	// 6. O pé: a tábua baixa e os dois postes, por cima do cobertor.
	vec2 cpe = vec2(0.0, (PE_COMECO + bf.y) * 0.5);
	vec2 bpe = vec2(bf.x, (bf.y - PE_COMECO) * 0.5);
	peca_alta(av, ac, m, cpe, bpe, 0.03, PE_ESP, V_MEIO, 0.02, vir, px);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		peca_alta(av, ac, m, vec2(sx * (bf.x - POSTE_PE.x), bf.y - POSTE_PE.y), POSTE_PE, 0.025, POSTE_PE_ESP, V_MEIO + 0.02, 0.022, vir, px);
	}

	// 7. A cabeceira: a tábua firme e alta, e os dois postes mais altos.
	vec2 ccab = vec2(0.0, (-bf.y + CAB_FIM) * 0.5);
	vec2 bcab = vec2(bf.x, (CAB_FIM + bf.y) * 0.5);
	peca_alta(av, ac, m, ccab, bcab, QUINA, CAB_ESP, V_MEIO + 0.01, 0.03, vir, px);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		peca_alta(av, ac, m, vec2(sx * (bf.x - POSTE_CAB.x), -bf.y + POSTE_CAB.y), POSTE_CAB, 0.03, POSTE_CAB_ESP, V_MEIO + 0.03, 0.03, vir, px);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

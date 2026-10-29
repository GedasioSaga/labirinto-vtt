// O ESTOFADO desenhado que pega cor: o sofá e a poltrona (onda 4, lote 13; CONTRATO.md seção 10).
// Incluído pelo textura.gdshader de movel-sofa e de movel-poltrona, depois de
// comum/movel.gdshaderinc (como texturas/lajotas/lajotas.gdshaderinc nas lajotas escuras).
//
// Da família dos lotes 9 a 12 e da régua do pano (o cobertor da cama, o toldo da barraca):
// contorno grosso na própria cor, formas grandes e macias, luz em poucas massas largas. Nada
// de botão de capitonê, costura, padrão ou franja.
//
// Visto de cima, no referencial do móvel (x ao longo, y de -h.y atrás a h.y na frente), de
// baixo para cima:
// - os PÉS de madeira (lugar 2): um em cada quina, aparecendo pouco fora do estofado;
// - o CORPO (lugar 1): a caixa inteira, escura, que só aparece na fresta entre as almofadas;
// - as ALMOFADAS do assento (lugar 1): grandes, uma por módulo do meio que repete, cada uma
//   com UMA massa de luz larga para cima e à esquerda e a sombra curta embaixo à direita; a
//   junta entre duas é firme (os dois contornos e a fresta do corpo na frente);
// - os BRAÇOS (lugar 1): dois rolos grossos dos lados, por cima da ponta das almofadas;
// - o ENCOSTO (lugar 1): o rolo mais alto e mais grosso, de ponta a ponta atrás, com as
//   massas largas e a sombra curta que joga no assento e nos braços.
// A luz fica em cima à esquerda nas viradas 0 e 2 (desenhado no móvel, aceso na tela).
//
// O MEIO QUE REPETE (CONTRATO 10.6) do sofá: pontas de 0,5 casa e P = 1. A junta de duas
// almofadas fica no meio de cada módulo; a emenda de dois módulos cai no meio de uma almofada,
// onde a coluna é a mesma (a borda reta de cima e de baixo, a massa de luz inteira). Por isso
// a massa de luz da almofada da ponta vai até mais perto do braço que a do meio da almofada:
// as pontas dela têm de passar da faixa lisa (4 px de cada lado da emenda).

const float EST_RECUO = 0.035;     // o estofado recuado da pegada, casas
const float EST_QUINA = 0.10;
const float BRACO = 0.24;          // a largura do braço, de fora até a almofada
const float BRACO_QUINA = 0.12;    // a frente do braço é meia volta: o rolo
const float BRACO_Y0 = 0.07;       // o braço começa um pouco à frente da beira de trás
const float ENCOSTO = 0.30;        // a profundidade do encosto
const float ENC_QUINA = 0.15;      // as pontas do encosto também
const float ALM_SOB_ENCOSTO = 0.07;  // a almofada entra embaixo do encosto
const float ALM_SOB_BRACO = 0.03;    // e embaixo do braço
const float ALM_QUINA = 0.10;
const float ALM_RECUO_FRENTE = 0.03; // a frente do assento um pouco atrás da dos braços
const float ALM_ESTUFA = 0.012;      // o meio dos lados da almofada estufa para a junta
const float ALM_CONTORNO = 0.03;     // a junta é dois destes
const vec2 B_PE = vec2(0.085, 0.06); // meia medida do pé, no móvel
const vec2 S_PE = vec2(0.0, 0.07);   // o quanto ele anda na tela (sai 0,05 embaixo)
const float PE_RECUO = 0.02;         // o pé recuado da quina (o de cima fica escondido)

// A massa de sombra (casas), embaixo à direita.
const float ROLO_SOMBRA = 0.06;
const float ALM_SOMBRA = 0.05;

// As massas de luz, em casas da borda: (do lado da luz em x, do outro, do lado da luz em y,
// do outro). Na almofada, a do lado do braço tem de passar da faixa lisa da emenda (a 0,5
// casa do meio): com o braço de 0,24 e a quina de 0,09, o recuo de x fica em até 0,134.
const vec4 BOLHA_ALM = vec4(0.10, 0.13, 0.13, 0.14);
const float BOLHA_QUINA = 0.09;
const vec4 BOLHA_BRACO = vec4(0.06, 0.10, 0.10, 0.12);
const vec4 BOLHA_ENC = vec4(0.12, 0.16, 0.07, 0.13);

// As sombras curtas, na tela (o quanto cada peça é mais alta que o assento).
const vec2 S_ENC = vec2(0.035, 0.055);
const vec2 S_BRACO = vec2(0.025, 0.04);

// Os tons de cada peça (o tecido no 0,5).
const float V_ROLO = V_MEIO + 0.04;   // encosto e braços, mais perto da luz
const float V_ALM = V_MEIO - 0.03;    // o assento
const float V_CORPO = V_FUNDO + 0.04; // a fresta

// A almofada: a caixa de quina redonda com o meio dos lados (x) estufado; em cima e embaixo
// a borda é reta (é ela que passa pela emenda dos módulos).
float sd_almofada_lados(vec2 p, vec2 b, float r, float e) {
	float t = clamp(p.y / b.y, -1.0, 1.0);
	return sd_caixa(p, vec2(b.x + e * (1.0 - t * t), b.y), r);
}

// A massa de luz de uma peça macia: a peça encolhida, mais perto da borda do lado da luz.
// recuo = (do lado da luz em x, do outro em x, do lado da luz em y, do outro em y), casas.
float sd_bolha(vec2 p, vec2 b, vec4 recuo, float r, vec2 lado_luz) {
	vec2 encolhe = vec2(recuo.x + recuo.y, recuo.z + recuo.w) * 0.5;
	vec2 anda = lado_luz * vec2(recuo.y - recuo.x, recuo.w - recuo.z) * 0.5;
	return sd_caixa(p - anda, b - encolhe, r);
}

// Uma peça macia (encosto, braço), da régua do pano: contorno co, recheio, a massa de
// sombra embaixo à direita (ws de largura) e UMA massa de luz larga para cima e à esquerda.
void peca_macia(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float r, float co, float valor, float ws, vec4 recuo, float rb, vec2 lm, float px) {
	vec2 p = m - c;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar(av, ac, valor, 1, dentro);
	pousar(av, ac, valor - MASSA_ESCURA, 1, dentro * (1.0 - cobre(sd_caixa(p - lm * ws, b, r) + co, px)));
	pousar(av, ac, valor + 0.10, 1, dentro * cobre(sd_bolha(p, b, recuo, rb, sign(lm)), px));
}

// A sombra curta de uma caixa alta no ponto q da tela, andada s na tela.
float sombra_curta(vec2 q, vec2 s, vec2 c, vec2 b, float r, int vir, float px) {
	return cobre(sd_caixa(movel_de(q - s, vir) - c, b, r), px);
}

// O estofado inteiro. juntas = quantas juntas no assento (0 = uma almofada só); ponta e
// largo = onde começa o meio e o tamanho de um módulo (as juntas ficam no meio de cada um).
void desenhar_estofado(vec2 q, float px, int vir, int juntas, float ponta, inout vec4 av, inout vec4 ac) {
	vec2 h = pegada_do_movel(vir) * 0.5;
	vec2 m = movel_de(q, vir);
	vec2 bf = h - vec2(EST_RECUO);
	if (sd_caixa(m, bf + vec2(0.08), 0.02) > px) {
		return;
	}
	vec2 lm = movel_de(LUZ, vir);
	vec2 lado_luz = sign(lm);   // para que lado, no móvel, a luz da tela vem

	// As peças, no móvel.
	vec2 c_enc = vec2(0.0, -bf.y + ENCOSTO * 0.5);
	vec2 b_enc = vec2(bf.x, ENCOSTO * 0.5);
	float y0_braco = -bf.y + BRACO_Y0;
	vec2 b_braco = vec2(BRACO * 0.5, (bf.y - y0_braco) * 0.5);
	float cy_braco = (y0_braco + bf.y) * 0.5;

	// As sombras curtas do encosto e dos braços (andadas na tela).
	float s_enc = sombra_curta(q, S_ENC, c_enc, b_enc, ENC_QUINA, vir, px);
	float s_braco = max(sombra_curta(q, S_BRACO, vec2(-bf.x + BRACO * 0.5, cy_braco), b_braco, BRACO_QUINA, vir, px),
			sombra_curta(q, S_BRACO, vec2(bf.x - BRACO * 0.5, cy_braco), b_braco, BRACO_QUINA, vir, px));

	// 1. Os pés de madeira, um em cada quina, por baixo de tudo. Como a face das peças altas
	// (a cabeceira da cama), eles aparecem só para baixo e para a direita NA TELA: o pé é
	// andado S_PE na tela, então só o das quinas de baixo sai do estofado, como uma tábua
	// curta debaixo da frente do braço (na virada 2, debaixo das pontas do encosto).
	for (int i = 0; i < 4; i++) {
		vec2 s = vec2(i % 2 == 0 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0);
		vec2 c_pe = s * (bf - B_PE - vec2(PE_RECUO));
		vec2 p = movel_de(q - S_PE, vir) - c_pe;
		float d = sd_caixa(p, B_PE, 0.03);
		if (d < px) {
			float co = 0.022;
			pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
			float dentro = cobre(d + co, px);
			pousar(av, ac, V_MEIO - 0.04, 2, dentro);
			pousar(av, ac, V_MEIO - 0.04 + MASSA_CLARA, 2, dentro * (1.0 - cobre(sd_caixa(p + lm * 0.025, B_PE, 0.03) + co, px)));
		}
	}

	// 2. O corpo: a caixa de baixo, escura, por dentro dos rolos (aparece só na fresta da
	// frente, entre duas almofadas).
	float y1 = bf.y - ALM_RECUO_FRENTE;
	vec2 b_corpo = vec2(bf.x - 0.06, (y1 + bf.y - 0.06) * 0.5);
	vec2 c_corpo = vec2(0.0, (y1 - bf.y + 0.06) * 0.5);
	float d_corpo = sd_caixa(m - c_corpo, b_corpo, 0.05);
	pousar(av, ac, V_CONTORNO, 1, cobre(d_corpo, px));
	pousar(av, ac, V_CORPO, 1, cobre(d_corpo + CONTORNO_CASAS, px));

	// 3. As almofadas do assento: a almofada em que x cai, entre os braços.
	float xi = bf.x - BRACO + ALM_SOB_BRACO;
	float y0 = -bf.y + ENCOSTO - ALM_SOB_ENCOSTO;
	float a0 = -xi;
	float a1 = xi;
	float n = float(juntas);
	float largo = juntas > 0 ? (2.0 * h.x - 2.0 * ponta) / n : 0.0;
	for (int k = 0; k < 8; k++) {
		if (k >= juntas) {
			break;
		}
		float j = -h.x + ponta + (float(k) + 0.5) * largo;
		if (m.x < j) {
			a1 = j;
			break;
		}
		a0 = j;
	}
	vec2 c_alm = vec2((a0 + a1) * 0.5, (y0 + y1) * 0.5);
	vec2 b_alm = vec2((a1 - a0) * 0.5, (y1 - y0) * 0.5);
	vec2 pa = m - c_alm;
	float da = sd_almofada_lados(pa, b_alm, ALM_QUINA, ALM_ESTUFA);
	if (da < px) {
		pousar(av, ac, V_CONTORNO, 1, cobre(da, px));
		float dentro = cobre(da + ALM_CONTORNO, px);
		pousar(av, ac, V_ALM, 1, dentro);
		pousar(av, ac, V_ALM - MASSA_ESCURA, 1, dentro * (1.0 - cobre(sd_almofada_lados(pa - lm * ALM_SOMBRA, b_alm, ALM_QUINA, ALM_ESTUFA) + ALM_CONTORNO, px)));
		// A massa de luz: a almofada encolhida, mais perto da borda do lado da luz.
		pousar(av, ac, V_ALM + 0.10, 1, dentro * cobre(sd_bolha(pa, b_alm, BOLHA_ALM, BOLHA_QUINA, lado_luz), px));
		// As sombras curtas do encosto e dos braços.
		pousar(av, ac, V_ALM - 0.13, 1, dentro * max(s_enc, s_braco) * 0.8);
	}

	// 4. Os braços: dois rolos grossos, por cima da ponta das almofadas.
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		vec2 c_b = vec2(sx * (bf.x - BRACO * 0.5), cy_braco);
		peca_macia(av, ac, m, c_b, b_braco, BRACO_QUINA, CONTORNO_CASAS * 0.9, V_ROLO, ROLO_SOMBRA * 0.75, BOLHA_BRACO, 0.05, lm, px);
		float dentro = cobre(sd_caixa(m - c_b, b_braco, BRACO_QUINA) + CONTORNO_CASAS, px);
		pousar(av, ac, V_ROLO - 0.12, 1, dentro * s_enc * 0.8);
	}

	// 5. O encosto: o rolo mais alto, de ponta a ponta.
	peca_macia(av, ac, m, c_enc, b_enc, ENC_QUINA, CONTORNO_CASAS, V_ROLO, ROLO_SOMBRA, BOLHA_ENC, 0.05, lm, px);
}

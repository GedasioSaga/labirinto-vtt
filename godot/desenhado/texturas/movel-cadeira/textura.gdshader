// CADEIRA desenhada que pega cor (onda 4, lote 9, piloto; CONTRATO.md seção 10).
//
// Desenhada no referencial da cadeira e acesa no da tela (movel_de / tela_de): a luz fica
// em cima à esquerda em toda virada.
//
// DE FRENTE (vista de cima; 2 viradas: o encosto em cima e embaixo; as de lado saem
// transpostas, porque ela é simétrica de lado a lado):
// - o ASSENTO, uma caixa larga de madeira com o bisel e o contorno;
//   palha (lugar 2): o miolo afundado na moldura, em 4 panos que se encontram no meio (o
//   trançado de junco), cada um num tom pela luz, e a sombra da moldura no alto à
//   esquerda do miolo;
//   madeira (o assento "Madeira", variante 1): 2 tábuas largas com uma junta;
// - o ENCOSTO, a travessa por cima do assento, com os dois postes nas pontas (o mais alto
//   da cadeira, os mais claros), e a sombra dele no assento quando ela cai para dentro.
// DE LADO (a Frente/Lado do mestre; 4 viradas, ela não é simétrica): o poste do encosto à
// esquerda, o assento no meio da altura, a perna da frente e a travessa; na palha, a faixa
// do trançado em cima do assento.
// Lugares: 1 = a madeira, 2 = o assento. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const vec2 SOMBRA_DO_ENCOSTO = vec2(0.022, 0.035); // para onde a sombra do encosto cai, casas

// O tom de cada pano do trançado (na TELA, como a luz): os 4 panos caem para o meio como
// um telhado baixo, cada um num tom, o de cima o mais claro e o de baixo o mais fundo; o
// da esquerda e o da direita entre os dois (a luz de cima à esquerda pega mais o de cima
// que o da esquerda, para os dois não virarem um L só).
float tom_do_pano(vec2 s, vec2 b) {
	vec2 n = s / b;
	if (abs(n.x) > abs(n.y)) {
		return n.x < 0.0 ? 0.035 : -0.04;
	}
	return n.y < 0.0 ? 0.085 : -0.08;
}

void frente(vec2 q, float px, int qual, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	// O assento.
	vec2 ca = vec2(0.0, (-h.y + 0.15 * pm.y + h.y) * 0.5);
	vec2 ba = vec2(h.x - 0.02 * pm.x, (h.y - (-h.y + 0.15 * pm.y)) * 0.5);
	desenhar_caixa(av, ac, m, ca, ba, 0.05 * pm.x, V_MEIO, 0.035, 1, vir, px);
	float d_assento = sd_caixa(m - ca, ba, 0.05 * pm.x) + contorno_para(ba);
	if (qual == 0) {
		// Palha: o miolo afundado.
		vec2 bp = ba - vec2(0.13 * pm.x);
		float dp = sd_caixa(m - ca, bp, 0.02);
		pousar(av, ac, V_CONTORNO + 0.06, 2, cobre(dp, px));
		float dentro = cobre(dp + 0.012, px);
		vec2 s = q - tela_de(ca, vir);
		vec2 bs = vir % 2 == 1 ? bp.yx : bp;
		pousar(av, ac, V_MEIO + 0.02 + tom_do_pano(s, bs), 2, dentro);
		// A sombra da moldura no alto à esquerda do miolo.
		float desloc = sd_caixa(movel_de(q + LUZ * 0.028, vir) - ca, bp, 0.02);
		pousar(av, ac, V_SOMBRA - 0.03, 2, dentro * (1.0 - cobre(desloc, px)) * 0.85);
	} else {
		// Madeira: 2 tábuas ao longo de x do móvel.
		float dentro = cobre(d_assento, px);
		float alto = 2.0 * ba.y;
		float ty = (m.y - ca.y + ba.y) / alto * 2.0;
		desenhar_linha(av, ac, abs(ty - 1.0) * alto * 0.5, 0.006, V_FUNDO, dentro * cobre(d_assento + 0.02, px), 1, px);
	}
	// A sombra do encosto no assento (só quando cai para dentro dele).
	vec2 ce = vec2(0.0, -h.y + 0.09 * pm.y);
	vec2 be = vec2(h.x, 0.09 * pm.y);
	float ds = sd_caixa(movel_de(q - SOMBRA_DO_ENCOSTO, vir) - ce, be, 0.03 * pm.x);
	pousar(av, ac, V_SOMBRA - 0.05, 1, cobre(ds, px) * cobre(d_assento, px) * 0.8);
	// O encosto e os postes.
	desenhar_caixa(av, ac, m, ce, be, 0.03 * pm.x, V_MEIO - 0.02, 0.025, 1, vir, px);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		desenhar_caixa(av, ac, m, vec2(sx * (h.x - 0.1 * pm.x), ce.y), vec2(0.1 * pm.x, 0.105 * pm.y), 0.03 * pm.x, V_MEIO + 0.06, 0.03, 1, vir, px);
	}
}

void de_lado(vec2 q, float px, int qual, int vir, inout vec4 av, inout vec4 ac) {
	vec2 pm = pegada_do_movel(vir);
	vec2 h = pm * 0.5;
	vec2 m = movel_de(q, vir);
	float x_encosto = -h.x + 0.2 * pm.x;
	float topo = -h.y + 0.5 * pm.y;
	float base = topo + 0.14 * pm.y;
	// A travessa (atrás), a perna da frente, o poste do encosto e o assento.
	float yt = h.y - 0.2 * pm.y;
	desenhar_caixa(av, ac, m, vec2((x_encosto + h.x - 0.1 * pm.x) * 0.5, yt), vec2((h.x - 0.1 * pm.x - x_encosto) * 0.5, 0.022 * pm.y), 0.005, V_SOMBRA, 0.01, 1, vir, px);
	desenhar_caixa(av, ac, m, vec2(h.x - 0.1 * pm.x, (base + h.y) * 0.5), vec2(0.07 * pm.x, (h.y - base) * 0.5), 0.01, V_MEIO - 0.05, 0.02, 1, vir, px);
	desenhar_caixa(av, ac, m, vec2(-h.x + 0.1 * pm.x, 0.0), vec2(0.1 * pm.x, h.y), 0.015, V_MEIO, 0.025, 1, vir, px);
	desenhar_caixa(av, ac, m, vec2((x_encosto + h.x) * 0.5, (topo + base) * 0.5), vec2((h.x - x_encosto) * 0.5, (base - topo) * 0.5), 0.012, V_MEIO + 0.03, 0.025, 1, vir, px);
	if (qual == 0) {
		// A faixa do trançado em cima do assento.
		desenhar_caixa(av, ac, m, vec2((x_encosto + h.x - 0.04 * pm.x) * 0.5, topo - 0.012 * pm.y), vec2((h.x - 0.04 * pm.x - x_encosto) * 0.5, 0.035 * pm.y), 0.008, V_MEIO + 0.05, 0.012, 2, vir, px);
	}
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (vis == 1) {
		de_lado(q, px, qual, vir, av, ac);
	} else {
		frente(q, px, qual, vir, av, ac);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

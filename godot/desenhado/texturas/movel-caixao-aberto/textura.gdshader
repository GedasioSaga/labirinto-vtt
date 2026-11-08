// CAIXÃO ABERTO, de madeira, visto de cima (onda 4, lote 19, cemitério; CONTRATO.md seção 10).
//
// A mesma forma hexagonal de texturas/movel-caixao, com a tampa escorregada até a metade e o
// interior à vista: o aro de madeira (lugar 1), o forro de cetim em cor própria (corFixa:
// true, não tinge pelo material), a tampa de madeira na cabeça (lugar 1) e as duas alças de
// metal (lugar 2). Pegada 1 x 2 casas (y para baixo, a cabeça em -y). A tampa fica de um lado
// só: não é simétrico, então 4 viradas, cada uma desenhada no referencial do móvel e acesa
// no da tela.
//
// - O ARO (lugar 1): a moldura de 0,075 casa em volta do forro, com o contorno grosso.
// - O FORRO (cor própria): cetim creme; a parede do lado de longe da luz em sombra, uma dobra
//   suave ao meio. A luz vem de cima à esquerda.
// - A TAMPA (lugar 1): a metade da cabeça do hexágono, com a sua borda como corte (um contorno
//   firme) e a sombra dela caindo no forro. A junta de duas tábuas, ao comprido, no meio.
// - As ALÇAS (lugar 2): duas pegas de metal nas laterais, como o fechado.
// Lugares: 1 = a madeira. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As cores do forro (cor própria) ----
const vec3 FORRO = vec3(0.800, 0.725, 0.596);        // cetim creme
const vec3 FORRO_SOMBRA = vec3(0.580, 0.510, 0.420); // a parede e a dobra em sombra

// ---- A forma (mesma do fechado; casas) ----
const float MEIO_MEIA = 0.38;
const float PONTA_MEIA = 0.24;
const float OMBRO_Y = 0.55;
const float PONTA_Y = 0.98;
const float AFINA = (MEIO_MEIA - PONTA_MEIA) / (PONTA_Y - OMBRO_Y);
const float ARO_LARGURA = 0.075;     // a moldura de madeira em volta do forro
const float CORTE_TAMPA = -0.30;     // a tampa vai da cabeça até esta linha (y)

// ---- Os valores ----
const float TAMPA_VALOR = 0.52;
const float JUNTA_MEIA = 0.010;
const float ALCA_VALOR = 0.66;

// ---- Relevo das massas (casas) ----
const float MASSA_LUZ = 0.05;
const float MASSA_SOMBRA = 0.07;
const float SOMBRA_TAMPA = 0.07;     // a sombra da tampa no forro, para longe da luz

// Distância ao hexágono do caixão, em casas (negativo dentro). Mesma conta do fechado.
float sd_caixao(vec2 p, float folga) {
	float ay = abs(p.y);
	float meia = MEIO_MEIA - folga - max(ay - OMBRO_Y, 0.0) * AFINA;
	return max(abs(p.x) - meia, ay - (PONTA_Y - folga));
}

// A tampa: o hexágono cortado pela linha CORTE_TAMPA (só a metade da cabeça).
float sd_tampa(vec2 p) {
	return max(sd_caixao(p, 0.0), p.y - CORTE_TAMPA);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	float co = CONTORNO_CASAS;
	// As alças nas laterais (fora da tampa, que está na cabeça).
	desenhar_caixa(av, ac, m, vec2(0.425, 0.40), vec2(0.040, 0.085), 0.02, ALCA_VALOR, 0.030, 2, vir, px);
	desenhar_caixa(av, ac, m, vec2(-0.425, 0.40), vec2(0.040, 0.085), 0.02, ALCA_VALOR, 0.030, 2, vir, px);
	// O aro de madeira: o hexágono inteiro no contorno e no tom da tábua.
	float d_aro = sd_caixao(m, 0.0);
	if (d_aro > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d_aro, px));
	pousar(av, ac, TAMPA_VALOR, 1, cobre(d_aro + co, px));
	// O forro: o hexágono encolhido pelo aro, com o contorno fino e o cetim dentro dele.
	float d_forro = sd_caixao(m, ARO_LARGURA);
	float dentro_forro = cobre(d_forro + co, px);
	pousar(av, ac, V_CONTORNO, 1, cobre(d_forro, px));
	pousar_cor(av, ac, FORRO, dentro_forro);
	// A parede do lado de longe da luz em sombra; a dobra ao meio, um fio suave.
	float parede = dentro_forro * (1.0 - cobre(sd_caixao(m - lm * 0.10, ARO_LARGURA) + co, px));
	pousar_cor(av, ac, FORRO_SOMBRA, parede * 0.8);
	float dobra = dentro_forro * (1.0 - cobre(abs(m.y - 0.42) - 0.012, px));
	pousar_cor(av, ac, FORRO_SOMBRA, dobra * 0.6);
	// A tampa: a metade da cabeça, com a sombra dela caindo no forro.
	float d_tampa = sd_tampa(m);
	float sombra_tampa = dentro_forro * cobre(sd_tampa(m + lm * SOMBRA_TAMPA), px);
	pousar_cor(av, ac, FORRO_SOMBRA * 0.85, sombra_tampa * (1.0 - cobre(d_tampa, px)));
	pousar(av, ac, V_CONTORNO, 1, cobre(d_tampa, px));
	float dentro_tampa = cobre(d_tampa + co, px);
	pousar(av, ac, TAMPA_VALOR, 1, dentro_tampa);
	float escura_t = dentro_tampa * (1.0 - cobre(sd_tampa(m - lm * MASSA_SOMBRA) + co, px));
	float clara_t = dentro_tampa * (1.0 - cobre(sd_tampa(m + lm * MASSA_LUZ) + co, px));
	pousar(av, ac, TAMPA_VALOR - MASSA_ESCURA, 1, escura_t);
	pousar(av, ac, TAMPA_VALOR + MASSA_CLARA, 1, clara_t);
	// A junta de duas tábuas da tampa, ao comprido.
	desenhar_linha(av, ac, abs(m.x), JUNTA_MEIA, V_FUNDO, dentro_tampa, 1, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

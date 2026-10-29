// BALDE DE ÁGUA desenhado que pega cor (onda 4, lote 16; CONTRATO.md seção 10).
//
// O mesmo balde aprovado dentro do poço e da pia (texturas/movel-poco, movel-pia), sozinho
// e maior: o aro de aduelas, a água da poça com a meia-lua de sombra e a alça em arco raso.
// Da família: contorno na cor do material, formas grandes, a luz de cima à esquerda em
// poucas massas. Visto de cima, de fora para dentro:
// - O ARO DE FERRO (lugar 2, os aros do app: ferro ou latão), na boca, por fora das
//   aduelas: um anel estreito de borda firme, com o brilho em faixa em cima à esquerda e o
//   escuro embaixo à direita, como o aro do barril.
// - A BORDA das aduelas (lugar 1, a madeira): o anel de madeira do balde do poço, que acende
//   em cima à esquerda, com poucas juntas largas e fracas (as do barril).
// - A PAREDE de dentro, um fio fundo entre a borda e a água.
// - A ÁGUA (cor própria, "corFixa"): o tom da poça aprovada (texturas/poca, AGUA), mais
//   clara que a do poço (o balde está cheio, a luz chega), a sombra da borda em meia-lua do
//   lado da luz e um lençol de céu largo e chato, sem brilho pontilhado nem onda.
// - A ALÇA (lugar 2): em pé e um nada caída para o lado de perto, vista de cima como um
//   arco raso de uma orelha à outra, acesa na beira de dentro; ela faz uma sombra curta na
//   água. As ORELHAS são duas massas pequenas e calmas no aro.
// Uma virada: redondo, e a alça caída para baixo serve nos 4 giros (de lado, ela cai para a
// direita; o poço fez o mesmo). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// A água da poça aprovada (texturas/poca/textura.gdshader, AGUA e AGUA_MT).
const vec3 AGUA = vec3(0.262, 0.408, 0.386);
const vec3 AGUA_MT = vec3(0.251, 0.439, 0.494); // #40707e água

// ---- As medidas, em casas, a partir do meio ----
const float R = 0.24;               // o raio do balde
const float ARO_DENTRO = 0.206;     // o aro de ferro vai de R até aqui
const float CONTORNO_DE_FORA = 0.017;
const float LINHA_DO_ARO = 0.008;   // a junta firme entre o aro e a borda
const float BORDA_DENTRO = 0.152;   // a borda das aduelas vai do aro até aqui
const float PAREDE = 0.011;         // o fio fundo da parede de dentro
const int JUNTAS = 8;
const float MEIA_JUNTA = 0.006;

const float SOMBRA_DA_BORDA = 0.045; // o quanto a meia-lua de sombra entra na água
const vec2 CEU_C = vec2(0.05, -0.055);
const vec2 CEU_E = vec2(0.075, 0.026);
const float CEU_GIRO = 0.62;         // rad: o lençol deitado ao longo da beira

const float X_ORELHA = 0.172;
const vec2 ORELHA = vec2(0.024, 0.036);
const vec2 ALCA = vec2(0.172, 0.072); // os semieixos do arco da alça
const float MEIA_ALCA = 0.0125;
const float CONTORNO_DA_ALCA = 0.0075;
const vec2 SOMBRA_DA_ALCA = vec2(0.016, 0.026); // para onde a sombra da alça cai na água

// O arco da alça: a metade de baixo da elipse (y >= 0), de orelha a orelha.
float sd_alca(vec2 p) {
	float d = abs(sd_elipse(p, ALCA)) - MEIA_ALCA;
	return max(d, -p.y - 0.004);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	float r = length(q);
	float d = r - R;
	if (d > px) {
		return;
	}
	vec2 dir = q / max(r, 1e-5);
	float l = dot(dir, LUZ); // 1 = o lado de cima à esquerda
	// 1. O aro de ferro: o contorno de fora, o metal e a junta de dentro.
	pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
	float metal = mix(V_SOMBRA + 0.02, V_MEIO + 0.04, smoothstep(-0.7, -0.25, l));
	metal = mix(metal, V_REALCE + 0.04, smoothstep(0.3, 0.5, l));
	pousar(av, ac, metal, 2, cobre(d + CONTORNO_DE_FORA, px));
	// 2. A borda das aduelas: a junta com o aro, a madeira que acende e as juntas largas.
	float d_borda = r - ARO_DENTRO;
	pousar(av, ac, V_CONTORNO + 0.04, 1, cobre(d_borda, px));
	float na_borda = cobre(d_borda + LINHA_DO_ARO, px);
	float borda = mix(V_SOMBRA + 0.02, V_LUZ + 0.04, smoothstep(-0.5, 0.6, l));
	pousar(av, ac, borda, 1, na_borda);
	float ang = atan(q.y, q.x) - 3.14159265 / float(JUNTAS);
	float passo = 6.2831853 / float(JUNTAS);
	float dj = abs(ang - floor(ang / passo + 0.5) * passo) * r;
	desenhar_linha(av, ac, dj, MEIA_JUNTA, borda - 0.13, na_borda * cobre(BORDA_DENTRO - r, px) * 0.6, 1, px);
	// 3. A parede de dentro: um fio fundo, mais escuro do lado da luz (de costas para ela).
	float d_parede = r - BORDA_DENTRO;
	float parede = mix(V_SOMBRA - 0.02, V_FUNDO - 0.04, smoothstep(-0.4, 0.5, l));
	pousar(av, ac, parede, 1, cobre(d_parede, px));
	// 4. A água: o tom do balde cheio, a meia-lua da sombra da borda, o lençol de céu e a
	// sombra curta da alça.
	float ra = BORDA_DENTRO - PAREDE;
	float na_agua = cobre(r - ra, px);
	vec3 agua = AGUA * 0.88;
	vec2 pc = girar(q - CEU_C, -CEU_GIRO);
	float ceu = 1.0 - smoothstep(-0.012, 0.012, sd_elipse(pc, CEU_E));
	agua = mix(agua, realce_de(mix(AGUA, AGUA_MT, 0.25)), 0.38 * ceu);
	float sombra = cobre(ra - length(q + LUZ * SOMBRA_DA_BORDA), px);
	float sombra_alca = cobre(sd_alca(q - SOMBRA_DA_ALCA), px * 2.0);
	agua = mix(agua, AGUA * 0.60, max(sombra, 0.8 * sombra_alca));
	pousar_cor(av, ac, agua, na_agua);
	// 5. As orelhas da alça, no aro, e a alça por cima de tudo.
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		desenhar_caixa(av, ac, q, vec2(sx * X_ORELHA, 0.0), ORELHA, 0.012, V_MEIO, 0.01, 2, vir, px);
	}
	float da = sd_alca(q);
	if (da < px) {
		pousar(av, ac, V_CONTORNO, 2, cobre(da, px));
		// Acesa na beira de dentro do arco (a que olha para cima, para a luz).
		float lado = sd_elipse(q, ALCA);
		float alca = mix(V_LUZ + 0.06, V_MEIO - 0.06, smoothstep(-0.003, 0.003, lado));
		pousar(av, ac, alca, 2, cobre(da + CONTORNO_DA_ALCA, px));
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

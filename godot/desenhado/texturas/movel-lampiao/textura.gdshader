// LAMPIÃO desenhado que pega cor (onda 4, lote 13; CONTRATO.md seção 10).
//
// Visto de cima, como a família da onda 3: o contorno grosso na cor do metal e três
// massas grandes, a luz de cima à esquerda. De fora para dentro:
// - O VIDRO (cor própria, "corFixa"): o globo aceso, âmbar, com a luz da chama colada no
//   chapéu (a chama fica debaixo dele: de cima só se vê a luz que ela joga no vidro) e o
//   âmbar mais fundo embaixo à direita, onde o globo se curva para longe. O
//   contorno de fora é o do vidro, na própria cor (o âmbar a 55%), para ele ler aceso.
// - O CHAPÉU (lugar 1, ferro ou latão): o cone de metal no meio, aceso em cima à
//   esquerda e escuro embaixo à direita, as duas metades separadas pela quina do cone
//   na diagonal.
// - A ALÇA (lugar 1): o arame por cima do chapéu, de uma orelha do aro à outra; as
//   orelhas saem um pouco da silhueta (o lampião não lê como moeda).
// - Nada de rebite, risquinho nem chama em bolinha. O halo de luz no chão é do app (como
//   hoje, lampiao.ts), não da imagem. Simétrico de lado a lado e de cima a baixo: 1
//   virada (a transposta põe a alça em pé, como o lampião girado). A sombra é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// As cores próprias do vidro aceso: as do lampião do app (lampiao.ts, AMBAR #d9a85a e
// MIOLO #efd08a) e o miolo da paleta (#c98f3a) para o âmbar fundo.
const vec3 AMBAR = vec3(0.851, 0.659, 0.353);
const vec3 AMBAR_FUNDO = vec3(0.788, 0.561, 0.227);
const vec3 CHAMA = vec3(0.937, 0.816, 0.541);
const float CONTORNO_DO_VIDRO = 0.55; // a própria cor escurecida (ESTILO 4), não preto

const float R_VIDRO = 0.232;      // o raio do globo com o aro, casas (a pegada é 0,25)
const float R_CHAPEU = 0.110;     // o raio do chapéu
const float CONTORNO_CHAPEU = 0.026; // mais fino que o da família: o chapéu é pequeno
const float LUZ_DA_CHAMA = 0.060; // a largura da luz colada no chapéu
const float FUNDO_DO_VIDRO = 0.040; // o quanto o âmbar fundo entra embaixo à direita
const float ALCA_MEIA = 0.021;    // a meia largura da alça
const vec2 ORELHA = vec2(0.036, 0.050); // a meia medida da orelha do aro

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	float r = length(q);
	vec2 dir = q / max(r, 1e-5);
	float l = dot(dir, LUZ); // 1 = o lado de cima à esquerda
	// As orelhas do aro, por baixo do globo (saem um pouco da silhueta).
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		desenhar_caixa(av, ac, m, vec2(sx * (R_VIDRO - 0.012), 0.0), ORELHA, 0.018, V_MEIO, 0.016, 1, vir, px);
	}
	float d = r - R_VIDRO;
	if (d > px) {
		return;
	}
	// O contorno do vidro, na própria cor.
	pousar_cor(av, ac, AMBAR_FUNDO * CONTORNO_DO_VIDRO, cobre(d, px));
	// O vidro aceso.
	float dentro = cobre(d + CONTORNO_CASAS, px);
	float rv = R_VIDRO - CONTORNO_CASAS;
	vec3 vidro = AMBAR;
	// A massa escura: o que andado para longe da luz sai do vidro (embaixo à direita).
	float escura = 1.0 - cobre(length(q - LUZ * FUNDO_DO_VIDRO) - rv, px);
	vidro = mix(vidro, AMBAR_FUNDO, escura);
	// A luz da chama, colada no chapéu.
	float chama = cobre(r - (R_CHAPEU + LUZ_DA_CHAMA), px * 3.0);
	vidro = mix(vidro, CHAMA, chama);
	pousar_cor(av, ac, vidro, dentro);
	// O chapéu: o cone de metal, a luz pelo ângulo em volta do bico.
	float dc = r - R_CHAPEU;
	pousar(av, ac, V_CONTORNO, 1, cobre(dc, px));
	float cone = mix(V_SOMBRA - 0.02, V_LUZ + 0.06, cobre(-l * R_CHAPEU * 0.5, px));
	pousar(av, ac, cone, 1, cobre(dc + CONTORNO_CHAPEU, px));
	// A alça por cima, de orelha a orelha.
	desenhar_caixa(av, ac, m, vec2(0.0), vec2(R_VIDRO + 0.002, ALCA_MEIA), ALCA_MEIA, V_LUZ, 0.012, 1, vir, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

// BARRIL desenhado que pega cor (onda 4, lote 9, piloto; CONTRATO.md seção 10).
//
// Visto de cima, como a família da onda 3: o contorno grosso na própria cor e poucas
// massas grandes, a luz de cima à esquerda. De fora para dentro:
// - A BARRIGA (lugar 1): o bojo das aduelas que passa do aro, a madeira que se curva para
//   longe: funda embaixo à direita, no tom em cima à esquerda, com as juntas largas das
//   aduelas (poucas, fracas).
// - O ARO (lugar 2, ferro ou latão): um anel de metal estreito de borda firme, com o
//   brilho em faixa em cima à esquerda e o escuro embaixo à direita.
// - A BOCA (lugar 1): o topo das aduelas, o anel mais claro do barril (pega a luz de
//   chapa), com as mesmas juntas.
// - A TAMPA afundada (lugar 1): 3 tábuas largas um tom abaixo, e a sombra em meia-lua que
//   a boca joga nela, em cima à esquerda.
// - Nada de batoque nem prego em bolinha. Redondo e sem lado: 1 virada (a transposta deita
//   as tábuas da tampa, como o barril girado). A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const float ARO_FORA = 0.87;   // em frações do raio
const float ARO_DENTRO = 0.76;
const float BOCA_DENTRO = 0.58;
const float LINHA = 0.008;     // meia largura das linhas de dentro, em casas
const int JUNTAS = 10;
const float TABUAS = 3.0;
const float MEIA_LUA = 0.055;  // o quanto a boca avança sobre a tampa na sombra, casas

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	float R = min(movel_casas.x, movel_casas.y) * 0.5;
	float r = length(q);
	float d = r - R;
	if (d > px) {
		return;
	}
	vec2 dir = q / max(r, 1e-5);
	float l = dot(dir, LUZ); // 1 = o lado de cima à esquerda
	// O contorno da silhueta e a barriga.
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float barriga = mix(V_SOMBRA - 0.04, V_MEIO + 0.02, smoothstep(-0.55, 0.55, l));
	pousar(av, ac, barriga, 1, cobre(d + CONTORNO_CASAS, px));
	// As juntas das aduelas, na barriga e na boca (as mesmas, alinhadas).
	float ang = atan(q.y, q.x);
	float passo = 6.2831853 / float(JUNTAS);
	float kj = floor(ang / passo + 0.5);
	float dj = abs(ang - kj * passo) * r;
	desenhar_linha(av, ac, dj, LINHA * 0.8, V_FUNDO + 0.02, cobre(d + CONTORNO_CASAS, px) * cobre(R * ARO_FORA - r, px) * 0.7, 1, px);
	// O aro de metal: anel entre ARO_DENTRO e ARO_FORA, com o contorno dos dois lados.
	float d_aro = max(r - R * ARO_FORA, R * ARO_DENTRO - r);
	float metal = mix(V_FUNDO + 0.04, V_MEIO - 0.04, smoothstep(-0.6, -0.2, l));
	metal = mix(metal, V_REALCE + 0.06, smoothstep(0.35, 0.55, l));
	pousar(av, ac, V_CONTORNO + 0.02, 2, cobre(d_aro - LINHA * 1.6, px));
	pousar(av, ac, metal, 2, cobre(d_aro + LINHA * 0.6, px));
	// A boca: o topo das aduelas, o anel mais claro.
	float d_boca = max(r - R * ARO_DENTRO + LINHA * 1.6, R * BOCA_DENTRO - r);
	float boca = mix(V_MEIO + 0.02, V_REALCE - 0.02, smoothstep(-0.6, 0.6, l));
	pousar(av, ac, boca, 1, cobre(d_boca, px));
	desenhar_linha(av, ac, dj, LINHA * 0.8, V_SOMBRA, cobre(d_boca, px) * 0.6, 1, px);
	// A tampa afundada: a linha da beira, as tábuas e a meia-lua da sombra.
	float rt = R * BOCA_DENTRO;
	float d_tampa = r - rt;
	pousar(av, ac, V_FUNDO, 1, cobre(d_tampa - LINHA, px));
	float dentro = cobre(d_tampa + LINHA, px);
	float alto = 2.0 * rt / TABUAS;
	float ty = (q.y + rt) / alto;
	float j = clamp(floor(ty), 0.0, TABUAS - 1.0);
	float tom = j == 0.0 ? 0.03 : (j == 1.0 ? -0.01 : -0.05);
	pousar(av, ac, V_MEIO - 0.03 + tom, 1, dentro);
	float kt = floor(ty + 0.5);
	if (kt >= 1.0 && kt <= TABUAS - 1.0) {
		desenhar_linha(av, ac, abs(ty - kt) * alto, LINHA, V_FUNDO, dentro, 1, px);
	}
	// A meia-lua: o ponto da tampa que, andado para a luz, sai da tampa, está na sombra da boca.
	float sombra = cobre(rt - length(q + LUZ * MEIA_LUA), px);
	pousar(av, ac, V_SOMBRA - 0.08, 1, dentro * sombra);
}

#include "res://comum/rodape_movel.gdshaderinc"

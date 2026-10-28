// MODELO de CARIMBO da onda 3 (árvore, planta, pedra, poça e o vaso são deste tipo).
// Copie a pasta para texturas/<id>/, troque o "id" do config.json e o desenho; as linhas de
// include e a assinatura não mudam. Contrato: CONTRATO.md, seção 9.
// Depois da primeira folha, troque "sprite.ancoraPx" pela conta que a folha mostra
// (meio da imagem - centroDoAtual x unidadePx): o objeto não anda quando o mapa troca de estilo.
// SEM sombra no chão (é do app) e SEM luz que dependa do giro (a imagem nunca gira).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// q em unidades do tamanho, a partir do meio da imagem. Um domo só, com a luz de cima à
// esquerda, o contorno da folha e uma variação um pouco mais alongada.
vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qe = k == 1 ? q * vec2(0.9, 1.1) : q;
	float r = 0.36;
	float d = length(qe) - r;
	float l = luz_do_domo(qe, vec2(0.0), r);
	vec3 cor = mix(sombra_de(FOLHA), realce_de(FOLHA), smoothstep(-0.4, 0.8, l));
	float traco = 2.0 / unidade_mundo;
	vec4 acc = vec4(0.0);
	acc = sobre(acc, FOLHA_CONTORNO, cobre(d, px));
	acc = sobre(acc, cor, cobre(d + traco, px));
	return vec4(acc.a > 0.002 ? acc.rgb / acc.a : FOLHA_CONTORNO, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

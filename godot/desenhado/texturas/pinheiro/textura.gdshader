// PINHEIRO em pé, meio de lado (onda 3, lote 6; CONTRATO.md, seção 9). O desenho mora em
// pinheiro.gdshaderinc, nesta pasta, porque o pinheiro com neve (texturas/pinheiro-nevado/)
// usa as mesmas 4 silhuetas e só põe a neve por cima. "espelho": "nenhum" (em pé, transposto
// ele deitaria: 4 formas, uma por arquivo) e a sombra "em-pe" de hoje.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"
#include "res://texturas/pinheiro/pinheiro.gdshaderinc"

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	return pintar_pinheiro(q, px, sem, k);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

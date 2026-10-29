// POLTRONA desenhada que pega cor (onda 4, lote 13; CONTRATO.md seção 10). O sofá de um
// lugar só: o mesmo encosto, os mesmos braços e a mesma almofada, do mesmo desenho
// (texturas/movel-sofa/estofado.gdshaderinc), com uma almofada só entre os braços.
//
// A pegada 1 x 1, o encosto em cima (y do móvel = -0,5). 2 viradas: simétrica de lado a
// lado, não de frente para trás. Não estica. Lugares: 1 = o estofado (tecido), 2 = a madeira
// dos pés. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"
#include "res://texturas/movel-sofa/estofado.gdshaderinc"

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	desenhar_estofado(q, px, vir, 0, 0.0, av, ac);
}

#include "res://comum/rodape_movel.gdshaderinc"

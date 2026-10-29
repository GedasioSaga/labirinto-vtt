// SOFÁ desenhado que pega cor (onda 4, lote 13; CONTRATO.md seção 10). O estofado de taverna
// ou de casa rica: o encosto e os braços grossos e macios em volta do assento, uma almofada
// grande por casa de comprimento e os pés de madeira aparecendo pouco nas quinas. O desenho
// inteiro está em estofado.gdshaderinc (a poltrona usa o mesmo, com uma almofada só).
//
// A pegada 2 x 1, o encosto em cima (y do móvel = -0,5). 2 viradas: simétrico de lado a lado,
// não de frente para trás. ESTICA ao longo pelo meio que repete (CONTRATO 10.6): pontas de
// 0,5 casa (o braço e o começo da almofada da ponta) e P = 1 casa (meia almofada, a junta,
// meia almofada); a cada casa a mais, uma almofada nova. Lugares: 1 = o estofado (tecido),
// 2 = a madeira dos pés. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"
#include "res://texturas/movel-sofa/estofado.gdshaderinc"

// O meio que repete: os mesmos números do config.json (esticar.pontasCasas, periodoCasas).
const float PONTA = 0.5;
const float PERIODO = 1.0;

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = pegada_do_movel(vir) * 0.5;
	int juntas = int(max(1.0, round((2.0 * h.x - 2.0 * PONTA) / PERIODO)));
	desenhar_estofado(q, px, vir, juntas, PONTA, av, ac);
}

#include "res://comum/rodape_movel.gdshaderinc"

// Lajotas de pedra, forma Escura: piso interno com estrutura. Lote 3 da onda 1.
// A mesma geometria da forma Clara (o mesmo include, a mesma tabela de fiadas e o
// mesmo sorteio da forma), só o tom muda: grafite neutro, um nada quente, tirado do
// ferro da paleta com um pouco de lenha; junta da pedra escurecida, nunca preta.
// A pintura e as notas das rodadas moram em texturas/lajotas/lajotas.gdshaderinc.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#define LAJOTA_ESCURA

#include "res://comum/cabecalho.gdshaderinc"
#include "res://texturas/lajotas/lajotas.gdshaderinc"
#include "res://comum/rodape.gdshaderinc"

// MODELO de móvel desenhado que pega cor (CONTRATO.md seção 10). Copie a pasta para
// texturas/movel-<nome>/, troque o config.json e escreva pintar_movel.
//
// Regras da família (as do piloto mesa, cadeira, barril):
// - Contorno grosso na própria cor (desenhar_caixa, desenhar_elipse ou pousar_com_contorno)
//   e formas grandes; luz em poucas massas (as das funções de caixa e elipse); nada de veio
//   em risquinho, prego em bolinha ou nó.
// - Desenhe no referencial do MÓVEL (m = movel_de(q, vir)) e acenda no da TELA (LUZ).
// - Valor cinza: os níveis V_* de comum/movel.gdshaderinc; lugar 1..3 na ordem de
//   "lugares" do config.json; cor própria só com pousar_cor e "corFixa".
// - Se estica: tudo o que muda ao longo fica nas pontas; o meio é a mesma coluna.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 h = pegada_do_movel(vir) * 0.5;
	vec2 m = movel_de(q, vir);
	desenhar_caixa(av, ac, m, vec2(0.0), h - vec2(0.06), 0.05, V_MEIO, 0.05, 1, vir, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

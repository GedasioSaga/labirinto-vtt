shader_type canvas_item;
render_mode blend_disabled;

// PORTA DUPLA (lote 18, 29/10/2026; CONTRATO.md 11.16). Um trecho da cadeia da parede com as
// ombreiras da janela (texturas/parede/parede_comum.gdshaderinc) e 4 módulos de 1 casa, um por
// estado: o vão, a folha fechada, o batente (aberta) e a secreta. O desenho mora em
// texturas/porta/porta_comum.gdshaderinc; aqui só a forma.

#include "res://comum/traco.gdshaderinc"
#include "res://texturas/parede/parede_comum.gdshaderinc"
#include "res://texturas/porta/porta_comum.gdshaderinc"

const int FORMA = FORMA_DUPLA;

vec4 pintar_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	vec2 va = porta_no_ponto(q, H, L, alt, FORMA, k, px, rel);
	return vec4(vec3(va.x), va.y);
}

vec2 relevo_da_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel;
	porta_no_ponto(q, H, L, alt, FORMA, k, px, rel);
	return rel;
}

#define FACE
#include "res://comum/rodape_traco.gdshaderinc"

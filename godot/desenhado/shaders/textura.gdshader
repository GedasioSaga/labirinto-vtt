// Um material de chão do estilo Desenhado num retângulo.
// Exportação: coordenada = UV x período (a imagem repete sem emenda).
// Na cena: coordenada = posição no mundo (os pedaços se encaixam).
shader_type canvas_item;
render_mode unshaded;

uniform int material_id = 0; // 0 grama, 1 terra, 2 pedra, 3 madeira, 4 telha
uniform float periodo = 512.0;
uniform int semente = 7;
uniform bool no_mundo = false;
uniform vec3 tom_telha = vec3(0.710, 0.431, 0.314);

varying vec2 mundo;

void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

#include "res://shaders/base.gdshaderinc"

bool regiao_grama(vec2 p) {
	return true;
}

#include "res://shaders/materiais.gdshaderinc"

void fragment() {
	vec2 p = no_mundo ? mundo : UV * periodo;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	vec3 c;
	if (material_id == 0) {
		c = grama(p, periodo, px, semente, 0.0);
	} else if (material_id == 1) {
		c = terra(p, periodo, px, semente);
	} else if (material_id == 2) {
		c = pedra(p, periodo, px, semente);
	} else if (material_id == 3) {
		c = madeira(p, periodo, px, semente);
	} else {
		c = telha(p, periodo, px, semente, tom_telha);
	}
	COLOR = vec4(c, 1.0);
}

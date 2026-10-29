// =====================================================================
// comum/rodape_material.gdshaderinc: CONGELADO. Última linha do textura.gdshader de um
// material de móvel (CONTRATO.md, seção 10).
//
// O retângulo é a imagem inteira (P.x x P.y px, 128 px por casa); x ao longo, y
// atravessando, (0, 0) no canto de cima à esquerda. Grava R = G = B = valor.
// O shader declara render_mode unshaded, blend_disabled.
// =====================================================================

void fragment() {
	vec2 p = UV * material_periodo;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	float v = clamp(pintar_material(p, material_periodo, px, semente, variante), 0.0, 1.0);
	COLOR = vec4(v, v, v, 1.0);
}

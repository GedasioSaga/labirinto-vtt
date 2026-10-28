// =====================================================================
// comum/rodape_objeto.gdshaderinc: CONGELADO. Última linha do textura.gdshader de um
// objeto (a chaminé; CONTRATO.md, seção 8). O retângulo é a imagem inteira
// (objeto.ladoPx de lado, 2 px da imagem por px do mapa); q = px do mapa a partir
// da âncora (o centro do corpo). Cor reta e alfa. render_mode blend_disabled.
// =====================================================================

void fragment() {
	vec2 q = (UV * objeto_lado - objeto_ancora) / objeto_px_por_mapa;
	float px = max(length(fwidth(q)) * 0.7071, 0.05);
	vec4 o = pintar_objeto(q, px, semente);
	COLOR = vec4(clamp(o.rgb, 0.0, 1.0), clamp(o.a, 0.0, 1.0));
}

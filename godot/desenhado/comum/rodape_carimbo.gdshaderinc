// =====================================================================
// comum/rodape_carimbo.gdshaderinc: CONGELADO. Última linha do textura.gdshader de um
// carimbo ou de um trecho (CONTRATO.md, seção 9). render_mode blend_disabled.
//   carimbo: o retângulo é a imagem inteira (sprite_lado de lado); q = unidades a
//            partir do MEIO da imagem; modo 0, variante = k.
//   trecho:  modo 1 = a cor (trecho.png), modo 2 = o relevo (trecho-relevo.png,
//            R = 0,5 + 0,5 x lado ao longo, G = 0,5 + 0,5 x lado atravessando, A = 1).
// =====================================================================

void fragment() {
#ifdef TRECHO
	vec2 q = UV * trecho_imagem / 2.0 - vec2(trecho_ponta, trecho_meia);
	float px = max(length(fwidth(q)) * 0.7071, 0.05);
	if (modo == 2) {
		vec2 l = clamp(relevo_do_trecho(q, trecho_comprimento, trecho_meia, trecho_ponta, px, semente), -1.0, 1.0);
		COLOR = vec4(0.5 + 0.5 * l, 0.0, 1.0);
	} else {
		vec4 o = pintar_trecho(q, trecho_comprimento, trecho_meia, trecho_ponta, px, semente);
		COLOR = vec4(clamp(o.rgb, 0.0, 1.0), clamp(o.a, 0.0, 1.0));
	}
#else
	vec2 q = (UV - vec2(0.5)) * sprite_lado / sprite_unidade;
	float px = max(length(fwidth(q)) * 0.7071, 1e-4);
	vec4 o = pintar_carimbo(q, px, semente, variante);
	COLOR = vec4(clamp(o.rgb, 0.0, 1.0), clamp(o.a, 0.0, 1.0));
#endif
}

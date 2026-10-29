// =====================================================================
// comum/rodape_telhado.gdshaderinc: CONGELADO. Última linha do textura.gdshader de um
// telhado ou de uma faixa (CONTRATO.md, seção 8).
//
// modo 0: o retângulo é a base inteira (P x P px). A linha de baixo da imagem é a
//         ponta do beiral: v = (1 - UV.y) * P. Grava R = valor, G = 0,5 + 0,5 * lado, B = 0.
// modo 1: o retângulo é a faixa, a 2 px da imagem por px do mapa: x ao longo
//         (0..L), y atravessando (-meia em cima, +meia embaixo).
//         Grava R = valor, G = 0,5 + 0,5 * lado, B = 0, A = alfa.
// "#define TEM_FAIXA" (telhado com faixa própria) ou "#define SO_FAIXA" (tipo faixa)
// antes deste include. O shader declara render_mode blend_disabled.
// =====================================================================

void fragment() {
	if (modo == 0) {
#ifndef SO_FAIXA
		vec2 p = vec2(UV.x, 1.0 - UV.y) * periodo;
		float px = max(length(fwidth(p)) * 0.7071, 0.05);
		vec2 m = pintar_telhado(p, periodo, px, semente, variante);
		COLOR = vec4(clamp(m.x, 0.0, 1.0), clamp(0.5 + 0.5 * m.y, 0.0, 1.0), 0.0, 1.0);
#else
		COLOR = vec4(0.0);
#endif
	} else {
#if defined(TEM_FAIXA) || defined(SO_FAIXA)
		vec2 q = vec2(UV.x * faixa_comprimento, (UV.y * 2.0 - 1.0) * faixa_meia);
		float px = max(length(fwidth(q)) * 0.7071, 0.05);
		vec3 f = pintar_faixa(q, faixa_comprimento, faixa_meia, px, semente);
		COLOR = vec4(clamp(f.x, 0.0, 1.0), clamp(0.5 + 0.5 * f.y, 0.0, 1.0), 0.0, clamp(f.z, 0.0, 1.0));
#else
		COLOR = vec4(0.0);
#endif
	}
}

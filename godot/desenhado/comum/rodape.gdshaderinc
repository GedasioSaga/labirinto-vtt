// =====================================================================
// comum/rodape.gdshaderinc: CONGELADO. Os designers só incluem, nunca editam.
// Última linha do textura.gdshader, depois de pintar_base e pintar_detalhe.
//
// modo 0: o retângulo é o ladrilho inteiro; p = UV x período (repete sem emenda
//         porque a textura só usa ruído e sorteio periódicos em P).
// modo 1: o retângulo é o atlas; cada célula é um detalhe de 1 casa (ou 2, com celula_casas = 2).
// O shader tem de declarar render_mode blend_disabled: o alfa vai direto para
// a imagem, sem misturar com o fundo.
// =====================================================================

void fragment() {
	if (modo == 0) {
		vec2 p = UV * periodo;
		float px = max(length(fwidth(p)) * 0.7071, 0.05);
		COLOR = vec4(clamp(pintar_base(p, periodo, px, semente, variante), 0.0, 1.0), 1.0);
	} else {
		vec2 g = UV * vec2(float(atlas_colunas), float(atlas_linhas));
		vec2 cel = floor(g);
		int i = int(cel.y) * atlas_colunas + int(cel.x);
		vec2 q = (g - cel - 0.5) * 64.0 * celula_casas;
		float px = max(length(fwidth(q)) * 0.7071, 0.05);
		vec4 d = pintar_detalhe(i, q, px, semente);
		COLOR = vec4(clamp(d.rgb, 0.0, 1.0), clamp(d.a, 0.0, 1.0));
	}
}

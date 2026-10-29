// =====================================================================
// comum/rodape_traco.gdshaderinc: a última linha do textura.gdshader de um traço
// (CONTRATO.md, seção 11). render_mode blend_disabled.
//   face (#define FACE antes deste arquivo): modo 0 = a cor (face-<altura>.png),
//        modo 1 = o relevo (face-<altura>-relevo.png: R = 0,5 + 0,5 x ao longo,
//        G = 0,5 + 0,5 x para baixo, B = 0, A = 1). A imagem de um módulo tem
//        traco_folga px do mundo antes e depois: lá o ponto é o da ponta (a coluna
//        da costura repetida), para o filtro e o mipmap do app não verem o vizinho.
//   borda (sem FACE): modo 2 = a cor da linha traco_linha (borda.png).
// =====================================================================

void fragment() {
	vec2 pix = UV * traco_imagem;          // px desta imagem
#ifdef FACE
	vec2 q = vec2(pix.x / 2.0 - traco_folga, pix.y / 2.0 - traco_acima);
	q.x = clamp(q.x, 0.0, traco_l);
	float px = 0.5;
	if (modo == 1) {
		vec2 l = clamp(relevo_da_face(q, traco_h, traco_l, traco_modulo, traco_alt, px, semente), -1.0, 1.0);
		COLOR = vec4(0.5 + 0.5 * l, 0.0, 1.0);
	} else {
		vec4 o = pintar_face(q, traco_h, traco_l, traco_modulo, traco_alt, px, semente);
		COLOR = vec4(clamp(o.rgb, 0.0, 1.0), clamp(o.a, 0.0, 1.0));
	}
#else
	vec2 q = vec2(pix.x / 2.0, pix.y / 2.0 - traco_acima);
	float px = 0.5;
	vec4 o = pintar_borda(q, traco_l, traco_linha, px, semente);
	COLOR = vec4(clamp(o.rgb, 0.0, 1.0), clamp(o.a, 0.0, 1.0));
#endif
}

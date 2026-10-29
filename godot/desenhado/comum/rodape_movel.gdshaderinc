// =====================================================================
// comum/rodape_movel.gdshaderinc: CONGELADO. Última linha do textura.gdshader de um
// móvel desenhado (CONTRATO.md, seção 10). render_mode unshaded, blend_disabled.
//
// O retângulo é a imagem inteira (movel_imagem px, 128 px por casa); q = casas a partir
// do meio. Três passadas da MESMA função (o exportador escolhe pelo "modo"):
//   modo 0, o valor:  R = G = B = o valor (0,5 = o tom do material), A = a cobertura;
//   modo 1, as partes: R, G, B = o peso do lugar 1, 2 e 3 (somam até 1; o resto é a cor
//                     fixa), A = a cobertura;
//   modo 2, a cor fixa: RGB = a cor própria das partes de pousar_cor, A = a cobertura.
// Tudo de alfa reto (não multiplicado).
// =====================================================================

void fragment() {
	vec2 q = (UV - vec2(0.5)) * movel_imagem / MOVEL_CASA;
	float px = max(length(fwidth(q)) * 0.7071, 1e-5);
	vec4 av = vec4(0.0);
	vec4 ac = vec4(0.0);
	pintar_movel(q, px, movel_vista, variante, movel_virada, semente, av, ac);
	float a = clamp(av.w, 0.0, 1.0);
	float k = a > 1e-4 ? 1.0 / av.w : 0.0;
	if (modo == 1) {
		COLOR = vec4(clamp(av.y * k, 0.0, 1.0), clamp(av.z * k, 0.0, 1.0), clamp(ac.x * k, 0.0, 1.0), a);
	} else if (modo == 2) {
		float fixa = av.w - av.y - av.z - ac.x;
		vec3 cor = fixa > 1e-3 ? ac.yzw / fixa : vec3(0.0);
		COLOR = vec4(clamp(cor, 0.0, 1.0), a);
	} else {
		float v = clamp(av.x * k, 0.0, 1.0);
		COLOR = vec4(v, v, v, a);
	}
}

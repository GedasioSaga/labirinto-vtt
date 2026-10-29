// MODELO de OBJETO da onda 2 (a chaminé é deste tipo). Copie a pasta para texturas/<id>/,
// troque o "id" do config.json e o desenho; as linhas de include e a assinatura não mudam.
// Contrato: CONTRATO.md, seção 8. O objeto vem com a sombra pintada e NÃO é tingido.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/telhado.gdshaderinc"

const vec3 GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b (paleta.ts)
const vec3 BOCA = vec3(0.17, 0.15, 0.14);

// q = px do mapa a partir do centro do corpo. O corpo aqui tem 20 px do mapa de lado
// (config: corpoPx 40 a 2 px por px do mapa); o app escala para o lado que ele escolhe.
vec4 pintar_objeto(vec2 q, float px, int sem) {
	vec4 acc = vec4(0.0);
	float ds = sd_caixa(q - vec2(3.4, 4.2), vec2(10.0), 2.0);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-1.6, 1.6, ds)) * 0.3);
	float d = sd_caixa(q, vec2(10.0), 1.6);
	vec3 cor = mix(realce_de(GRANITO), sombra_de(GRANITO), smoothstep(-10.0, 10.0, q.x + q.y));
	acc = sobre(acc, contorno_de(GRANITO), cobre(d, px));
	acc = sobre(acc, cor, cobre(d + 1.0, px));
	float b = sd_caixa(q, vec2(4.6), 1.0);
	acc = sobre(acc, BOCA, cobre(b, px));
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape_objeto.gdshaderinc"

// MODELO de textura do Desenhado. Copie a pasta _modelo para texturas/<id>/ e
// troque o desenho; as linhas de include e a assinatura das funções não mudam.
// Regras: ESTILO.md. Contrato: CONTRATO.md. O exemplo completo é texturas/grama/.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// O chão calmo: manchas largas, poucas pinceladas, grão de papel. Sem detalhe
// pequeno aqui (ele mora no atlas). "qual" = 0, 1, 2: a mesma receita com outra
// semente e outra temperatura, para a mistura no mundo não deixar emenda.
vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	float n = rz(p, 256.0, P, s + 1) * 0.6 + fz(p, 128.0, P, s + 2, 2) * 0.4;
	vec3 c = mix(TERRA_SOMBRA, TERRA_AREIA, smoothstep(0.25, 0.75, n));
	c = mix(TERRA, c, 0.5);
	c *= 1.0 + 0.03 * pinceladas(p, P, px, s + 5, 32.0, -1.2, 0.6);
	c *= grao(p, P, s + 7);
	return c;
}

// O detalhe i do atlas, centrado em q = (0, 0), com cor reta e alfa. Aqui: uma
// pedrinha de contorno firme e sombra suave para baixo e para a direita.
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 1.0), sem);
	vec2 tam = vec2(5.0, 3.6) * (0.8 + 0.5 * rk(h, 0));
	vec2 r = girar(q, -(rk(h, 1) - 0.5) * 1.2);
	vec4 acc = vec4(0.0);
	float ds = sd_elipse(r - vec2(1.6, 1.4), tam * 1.05);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-1.5, 1.5, ds)) * 0.22);
	float d = sd_elipse(r, tam);
	vec3 cor = mix(sombra_de(SEIXO), realce_de(SEIXO), smoothstep(tam.y, -tam.y, r.x + r.y));
	acc = sobre(acc, contorno_de(SEIXO), cobre(d, px));
	acc = sobre(acc, cor, cobre(d + 1.0, px));
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

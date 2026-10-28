// Grade de casas (64 px), com linha de 1 px de tela em qualquer zoom.
shader_type canvas_item;
render_mode unshaded;

uniform float casa = 64.0;
uniform vec4 cor = vec4(0.16, 0.12, 0.08, 0.28);

varying vec2 mundo;

void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec2 g = abs(fract(mundo / casa + 0.5) - 0.5) * casa;
	vec2 w = max(fwidth(mundo), vec2(1e-4));
	float l = max(1.0 - smoothstep(0.0, w.x, g.x), 1.0 - smoothstep(0.0, w.y, g.y));
	COLOR = vec4(cor.rgb, cor.a * l);
}

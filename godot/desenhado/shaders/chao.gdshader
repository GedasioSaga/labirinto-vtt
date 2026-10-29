// O chão da cena: grama em volta, caminho de terra com contorno escuro e a praça
// de lajes. Mesmos materiais das texturas exportadas (mesmo período, mesma semente);
// a grama ganha, só aqui, uma variação larga por posição que não repete.
shader_type canvas_item;
render_mode unshaded;

uniform float periodo = 512.0;
uniform int semente = 7;

varying vec2 mundo;

void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

#include "res://shaders/base.gdshaderinc"

// Desenho do caminho e da praça, em casas (o mesmo do protótipo do Fogo), aqui em px.
float y_caminho(float x) {
	return (9.2 + 0.4 * sin(x / 64.0 * 0.33 + 0.6)) * 64.0;
}

float x_praca(float y) {
	return (16.7 + 0.22 * sin(y / 64.0 * 0.8 + 1.1)) * 64.0;
}

// Distância ao caminho (negativa dentro). Meia largura de 0,66 casa.
float d_caminho(vec2 p) {
	float incl = 0.4 * 0.33 * cos(p.x / 64.0 * 0.33 + 0.6);
	return abs(p.y - y_caminho(p.x)) / sqrt(1.0 + incl * incl) - 42.0;
}

float d_praca(vec2 p) {
	return x_praca(p.y) - p.x;
}

// Borda feita à mão: ondula alguns px.
float onda(vec2 p, int s) {
	return (rz(p, 32.0, 4096.0, s) - 0.5) * 2.0 + (rz(p, 8.0, 4096.0, s + 1) - 0.5) * 0.6;
}

bool regiao_grama(vec2 p) {
	return d_caminho(p) + onda(p, 501) * 3.2 > 3.5 && d_praca(p) + onda(p, 502) * 2.6 > 4.0;
}

#include "res://shaders/materiais.gdshaderinc"

void fragment() {
	vec2 p = mundo;
	float px = max(length(fwidth(p)) * 0.7071, 0.05);
	float dc = d_caminho(p) + onda(p, 501) * 3.2;
	float dq = d_praca(p) + onda(p, 502) * 2.6;
	bool no_caminho = dq > 0.0 && dc < 2.0;
	vec3 c = vec3(0.0);
	// grama (com a variação larga que não repete)
	if (dc > -2.0 && dq > -2.0) {
		float variacao = (rz(p, 640.0, 4096.0 * 10.0, semente + 900) - 0.5) * 2.0;
		c = grama(p, periodo, px, semente, variacao);
		// a grama escurece de leve rente ao caminho (sombra da borda)
		c *= 1.0 - 0.05 * (1.0 - smoothstep(0.0, 10.0, min(dc, dq)));
	}
	// caminho de terra: faixa mais escura na borda, linha de contorno e sombra da grama
	if (no_caminho) {
		vec3 t = terra(p, periodo, px, semente + 3);
		float faixa = smoothstep(-9.0, 0.0, dc);
		t = mix(t, TERRA_SOMBRA * 0.97, faixa * 0.7);
		float acima = step(p.y, y_caminho(p.x));
		t *= 1.0 - 0.13 * acima * smoothstep(-11.0, 0.0, dc);
		t *= 1.0 + 0.05 * (1.0 - acima) * smoothstep(-6.0, 0.0, dc);
		t = mix(t, TERRA * 0.56, cobre(abs(dc + 1.0) - 1.0, px) * 0.9);
		c = mix(c, t, cobre(dc, px));
	}
	// praça de lajes: contorno e sombra do gramado no lado esquerdo
	if (dq < 2.0) {
		vec3 s = pedra(p, periodo, px, semente + 5);
		s *= 1.0 - 0.14 * smoothstep(-12.0, 0.0, dq);
		s = mix(s, PRACA_JUNTA * 0.74, cobre(abs(dq + 1.2) - 1.2, px) * 0.9);
		c = mix(c, s, cobre(dq, px));
	}
	// tufos que nascem na grama e caem por cima da borda
	if ((dc > -16.0 && dc < 1.0 && dq > 0.0) || (dq > -16.0 && dq < 1.0)) {
		c = aplicar(c, tufos(p, periodo, px, semente + 40, 0.62));
	}
	COLOR = vec4(c, 1.0);
}

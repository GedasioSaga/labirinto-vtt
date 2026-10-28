// Bancada do Caminho (só a mesa de prova; o app não lê este arquivo).
// Põe a faixa do caminho por cima do chão, recortada pelo traço do jeito que o app
// recorta hoje (drawDrawings.ts: polilinha reta entre os pontos, ponta e junta
// redondas, borda suavizada em 1 px de tela). "chao" e "faixa" são as duas vistas já
// montadas pela mesa (comum/compor.gdshader), da mesma janela e no mesmo zoom.
//
// borda = 0: o recorte de hoje. borda = 1: PROPOSTA para a integração (fora do
// contrato v1): a borda anda ±3 px do mundo pelo ruído do mundo, e a trilha parece
// afundada: a grama do lado da luz faz uma sombra macia para dentro (na sombra da própria
// terra, como o aro da trilha do Meio-Termo, meio.js, pintarEstradas).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/mundo.gdshaderinc"

uniform sampler2D chao : filter_nearest;
uniform sampler2D faixa : filter_nearest;
uniform vec2 origem = vec2(0.0);    // px do mundo no canto de cima à esquerda
uniform float zoom = 1.0;           // px de tela por px do mundo
uniform vec2 tamanho = vec2(512.0); // px de tela
uniform vec2 pontos_a[8];
uniform int n_a = 0;
uniform float largura_a = 64.0;     // px do mundo
uniform vec2 pontos_b[8];
uniform int n_b = 0;
uniform float largura_b = 192.0;
uniform bool chapado = false;       // true: a cor chapada de hoje no lugar da textura
uniform vec3 cor_chapada = vec3(0.541, 0.416, 0.271); // #8a6a45
uniform int borda = 0;

// O ponto do segmento ab mais perto de w.
vec2 perto_no_segmento(vec2 w, vec2 a, vec2 b) {
	vec2 ba = b - a;
	float h = clamp(dot(w - a, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
	return a + ba * h;
}

void fragment() {
	vec2 w = origem + UV * tamanho / zoom;
	// Distância à borda (px do mundo, negativa dentro), a menor das duas faixas, e o
	// ponto do eixo mais perto (a normal da borda, para fora, sai dele).
	float d = 1e9;
	vec2 eixo = w;
	for (int k = 0; k < 7; k++) {
		if (k + 1 >= n_a) {
			break;
		}
		vec2 cp = perto_no_segmento(w, pontos_a[k], pontos_a[k + 1]);
		float dk = length(w - cp) - largura_a * 0.5;
		if (dk < d) {
			d = dk;
			eixo = cp;
		}
	}
	for (int k = 0; k < 7; k++) {
		if (k + 1 >= n_b) {
			break;
		}
		vec2 cp = perto_no_segmento(w, pontos_b[k], pontos_b[k + 1]);
		float dk = length(w - cp) - largura_b * 0.5;
		if (dk < d) {
			d = dk;
			eixo = cp;
		}
	}
	vec3 fundo = texture(chao, UV).rgb;
	vec3 trilha = chapado ? cor_chapada : texture(faixa, UV).rgb;
	vec3 c;
	if (borda == 0) {
		float cob = clamp(0.5 - d * zoom, 0.0, 1.0);
		c = mix(fundo, trilha, cob);
	} else {
		vec2 fora = (w - eixo) / max(length(w - eixo), 1e-4);
		float torta = d + 3.0 * ruido_do_mundo(w.x * 3.0, w.y * 3.0, 977);
		float px = 1.0 / zoom;
		float cob = clamp(0.5 - torta / px, 0.0, 1.0);
		// Trilha afundada: a grama do lado da luz (cima e esquerda) faz sombra macia de
		// 4 px para dentro; do outro lado só um aro de 1,5 px, bem leve.
		float lado_da_luz = smoothstep(0.0, 0.6, dot(fora, vec2(-0.7071, -0.7071)));
		float largura_sombra = mix(1.5, 4.0, lado_da_luz);
		float na_sombra = (1.0 - smoothstep(0.0, largura_sombra, -torta)) * mix(0.5, 1.0, lado_da_luz);
		trilha = mix(trilha, trilha * vec3(0.84, 0.82, 0.80), na_sombra);
		c = mix(fundo, trilha, cob);
	}
	COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}

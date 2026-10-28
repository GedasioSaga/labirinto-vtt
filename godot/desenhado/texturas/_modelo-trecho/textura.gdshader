// MODELO de TRECHO da onda 3 (a sebe e a jardineira são deste tipo). Copie a pasta para
// texturas/<id>/, troque o "id" do config.json e o desenho; as linhas de include, o
// #define TRECHO e as assinaturas não mudam. Contrato: CONTRATO.md, seção 9.5.
// A cor vem SEM luz de direção: o app acende pelo relevo depois de deitar o trecho na curva.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// A forma: uma faixa de meia largura "meia" com a ponta redonda no começo (s < 0) e uma
// barriga por período, para a emenda a cada L aparecer e ser conferida na folha.
float sd_faixa(vec2 q, float L, float meia) {
	float s = q.x < 0.0 ? q.x : 0.0;
	float barriga = 1.5 * sin(PI * fract(max(q.x, 0.0) / L));
	return length(vec2(s, max(abs(q.y) - (meia - 2.5 - barriga), 0.0))) - 2.5;
}

vec4 pintar_trecho(vec2 q, float L, float meia, float ponta, float px, int sem) {
	float d = sd_faixa(q, L, meia);
	vec3 cor = FOLHA * (1.0 + (grao(q * 2.0 + vec2(400.0), 1024.0, sem) - 1.0) * 0.5);
	vec4 acc = vec4(0.0);
	acc = sobre(acc, FOLHA_CONTORNO, cobre(d, px));
	acc = sobre(acc, cor, cobre(d + 2.0, px));
	return vec4(acc.a > 0.002 ? acc.rgb / acc.a : FOLHA_CONTORNO, acc.a);
}

// Um meio cilindro deitado: inclina para fora atravessando, e para a ponta no começo.
vec2 relevo_do_trecho(vec2 q, float L, float meia, float ponta, float px, int sem) {
	float c = clamp(q.y / meia, -1.0, 1.0);
	float s = q.x < 0.0 ? clamp(q.x / max(ponta, 1.0), -1.0, 0.0) : 0.0;
	return vec2(s, c) * 0.9;
}

#define TRECHO
#include "res://comum/rodape_carimbo.gdshaderinc"

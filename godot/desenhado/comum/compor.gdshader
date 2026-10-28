// =====================================================================
// comum/compor.gdshader: CONGELADO. A mesa de prova.
//
// Monta o chão do jeito que o APP vai montar, a partir dos arquivos já
// exportados (não do shader da textura): é a implementação de referência do
// contrato contra repetição (CONTRATO.md). Se o app fizer igual, o que a folha
// mostra é o que o mestre vai ver.
//
//   1. base: base-1..3 (ladrilhos de 8 x 8 casas) misturadas pelo ruído do
//      mundo numa escala longa (mistura_escala); sem período.
//   2. tom: o chão inteiro clareia e escurece devagar (outro ruído do mundo).
//   3. detalhes: o atlas espalhado numa grade de meia célula (32 px com células
//      de 1 casa), com hash() do app por célula; densidade puxada pelo ruído do mundo (moitas e clareiras).
//
// fonte: 0 = Desenhado completo; 1 = só base-1 (controle, mostra a repetição
// crua); 2 = base misturada + tom, sem detalhes; 3 = imagem do Atual (a textura
// de hoje do app, pintada fora daqui).
// =====================================================================
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/mundo.gdshaderinc"

uniform int fonte = 0;
uniform vec2 origem = vec2(0.0);       // px do mundo no canto de cima à esquerda
uniform float zoom = 1.0;              // px de tela por px do mundo (0,5 = 50%)
uniform vec2 tamanho = vec2(512.0);    // px de tela do retângulo

uniform sampler2D base_1 : repeat_enable, filter_linear_mipmap;
uniform sampler2D base_2 : repeat_enable, filter_linear_mipmap;
uniform sampler2D base_3 : repeat_enable, filter_linear_mipmap;
uniform int n_variantes = 3;
uniform float periodo = 512.0;         // px do mundo cobertos por um ladrilho de base

uniform int mistura_semente = 0;
uniform float mistura_escala = 3.0;
uniform float mistura_faixa = 0.12;
uniform float mistura_corte = 0.18;

uniform int tom_semente = 0;
uniform float tom_escala = 6.0;
uniform float tom_amplitude = 0.05;

uniform sampler2D atlas : repeat_disable, filter_linear_mipmap;
uniform bool tem_detalhes = false;
uniform int atlas_colunas = 4;
uniform int atlas_linhas = 4;
uniform int n_detalhes = 0;
uniform float pesos[16];
uniform float atlas_px_por_casa = 128.0;
uniform float celula_casas = 1.0;      // 1: células de 1 casa (atlas 4 x 4); 2: de 2 casas (atlas 2 x 2)
uniform int detalhes_semente = 0;
uniform float densidade = 1.0;
uniform float agrupamento = 0.6;
uniform float escala_min = 0.85;
uniform float escala_max = 1.1;
uniform float variacao_tom = 0.05;

uniform sampler2D imagem_atual : repeat_disable, filter_linear_mipmap;
uniform vec2 atual_origem = vec2(0.0);  // px do mundo do canto da imagem do Atual
uniform vec2 atual_mundo = vec2(2560.0); // px do mundo cobertos pela imagem do Atual

uniform sampler2D mascara : repeat_disable, filter_linear;
uniform bool usar_mascara = false;
uniform vec2 mascara_origem = vec2(0.0);
uniform vec2 mascara_mundo = vec2(2560.0);
uniform vec3 cor_fora = vec3(0.169);


int escolher_detalhe(float r) {
	float total = 0.0;
	for (int k = 0; k < 16; k++) {
		if (k < n_detalhes) {
			total += max(pesos[k], 0.0);
		}
	}
	float alvo = r * max(total, 1e-6);
	float soma = 0.0;
	for (int k = 0; k < 16; k++) {
		if (k >= n_detalhes) {
			break;
		}
		soma += max(pesos[k], 0.0);
		if (alvo < soma) {
			return k;
		}
	}
	return max(n_detalhes - 1, 0);
}

vec3 base_misturada(vec2 w) {
	vec2 uv = w / periodo;
	vec3 b1 = texture(base_1, uv).rgb;
	vec3 b2 = texture(base_2, uv).rgb;
	vec3 b3 = texture(base_3, uv).rgb;
	float n = ruido_do_mundo(w.x / mistura_escala, w.y / mistura_escala, mistura_semente);
	vec3 c;
	if (n_variantes <= 1) {
		c = b1;
	} else if (n_variantes == 2) {
		c = mix(b1, b2, smoothstep(-mistura_faixa, mistura_faixa, n));
	} else {
		float w1 = 1.0 - smoothstep(-mistura_corte - mistura_faixa, -mistura_corte + mistura_faixa, n);
		float w3 = smoothstep(mistura_corte - mistura_faixa, mistura_corte + mistura_faixa, n);
		c = b1 * w1 + b3 * w3 + b2 * max(1.0 - w1 - w3, 0.0);
	}
	float t = ruido_do_mundo(w.x / tom_escala, w.y / tom_escala, tom_semente);
	return c * (1.0 + tom_amplitude * t);
}

vec3 com_detalhes(vec2 w, vec3 c) {
	// Grade de espalhar: meia célula (32 px do mundo com células de 1 casa).
	float passo = 32.0 * celula_casas;
	float meia = 32.0 * celula_casas;
	float por_celula = densidade * 0.25 * celula_casas * celula_casas;
	ivec2 g0 = ivec2(floor(w / passo));
	float teto = clamp(por_celula * (1.0 + 2.0 * agrupamento), 0.0, 0.85);
	vec2 grade = vec2(float(atlas_colunas), float(atlas_linhas));
	// Texels do atlas por px de tela, para escolher o mip sem derivada dentro do laço.
	float texel_por_tela = (atlas_px_por_casa / 64.0) / max(zoom, 1e-4);
	for (int dy = -2; dy <= 2; dy++) {
		for (int dx = -2; dx <= 2; dx++) {
			ivec2 g = g0 + ivec2(dx, dy);
			float r0 = hash_app(g.x, g.y, detalhes_semente);
			if (r0 >= teto) {
				continue;
			}
			vec2 cc = (vec2(g) + 0.5) * passo;
			float aglomerado = ruido_do_mundo(cc.x, cc.y, detalhes_semente + 50);
			float p = clamp(por_celula * (1.0 + agrupamento * 2.0 * aglomerado), 0.0, 0.85);
			if (r0 >= p) {
				continue;
			}
			vec2 centro = (vec2(g) + vec2(hash_app(g.x, g.y, detalhes_semente + 1), hash_app(g.x, g.y, detalhes_semente + 2))) * passo;
			float esc = mix(escala_min, escala_max, hash_app(g.x, g.y, detalhes_semente + 4));
			vec2 q = (w - centro) / esc;
			if (abs(q.x) >= meia || abs(q.y) >= meia) {
				continue;
			}
			int i = escolher_detalhe(hash_app(g.x, g.y, detalhes_semente + 3));
			vec2 cel = vec2(float(i % atlas_colunas), float(i / atlas_colunas));
			vec2 uv = (cel + q / (2.0 * meia) + 0.5) / grade;
			float lod = max(log2(max(texel_por_tela / esc, 1e-4)), 0.0);
			vec4 d = textureLod(atlas, uv, lod);
			float tom = 1.0 + variacao_tom * (2.0 * hash_app(g.x, g.y, detalhes_semente + 5) - 1.0);
			c = mix(c, d.rgb * tom, d.a);
		}
	}
	return c;
}

void fragment() {
	vec2 w = origem + UV * tamanho / zoom;
	vec3 c;
	if (fonte == 3) {
		c = texture(imagem_atual, (w - atual_origem) / atual_mundo).rgb;
	} else if (fonte == 1) {
		c = texture(base_1, w / periodo).rgb;
	} else {
		c = base_misturada(w);
		if (fonte == 0 && tem_detalhes) {
			c = com_detalhes(w, c);
		}
	}
	if (usar_mascara) {
		float m = texture(mascara, (w - mascara_origem) / mascara_mundo).r;
		c = mix(cor_fora, c, m);
	}
	COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}

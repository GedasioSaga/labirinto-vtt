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
//      Opcional (detalhes.afastarCasas > 0, CONTRATO.md seção 4): os mesmos
//      detalhes, nas mesmas células, com 2 rodadas de afastamento entre
//      vizinhos, para dois não caírem quase um em cima do outro. Sem o
//      parâmetro, a conta é exatamente a de antes (com_detalhes).
//      Mais 3 opcionais (CONTRATO.md seção 4), para peça grande e solta (copa de
//      bosque): detalhes.passoCasas (a grade com passo maior que meia célula),
//      detalhes.grupos (grupos redondos sorteados numa grade grossa no lugar do
//      ruído do mundo) e detalhes.espelhar (metade das peças espelhada na
//      diagonal, que não mexe na luz de cima à esquerda). Sem eles, a conta é a
//      de antes, byte a byte.
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
uniform float afastar_px = 0.0;        // 0: espalhamento de sempre; > 0: distância que o afastamento busca (px do mundo)
uniform float passo_casas = 0.0;       // 0: grade de meia célula (32 px x celula_casas); > 0: passo da grade em casas
uniform bool grupos_ligados = false;   // false: aglomerado = ruído do mundo; true: grupos redondos
uniform float grupos_grade_px = 640.0; // lado da grade grossa dos grupos (px do mundo)
uniform float grupos_chance = 0.9;     // chance de uma célula grossa ter grupo
uniform float grupos_raio_min = 0.3;   // raio do grupo, em lados da grade grossa
uniform float grupos_raio_max = 0.42;
uniform bool espelhar = false;         // true: metade das peças espelhada na diagonal (x <-> y)

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

// O aglomerado da célula de centro cc (de -1 a 1): puxa a densidade para cima nas
// moitas e para baixo nas clareiras. Sem grupos, é o ruído do mundo de sempre. Com
// grupos: cada célula de uma grade grossa (grupos_grade_px) tem um grupo com chance
// grupos_chance, centro sorteado longe da borda (de 0,2 a 0,8 do lado) e raio
// sorteado entre grupos_raio_min e grupos_raio_max lados; o aglomerado é 1 no miolo
// do grupo (até 0,55 do raio), cai suave até -1 na borda e é -1 fora de todo grupo.
// Basta olhar as 3 x 3 células grossas em volta (o raio vai até 0,5 do lado).
float aglomerado_em(vec2 cc) {
	if (!grupos_ligados) {
		return ruido_do_mundo(cc.x, cc.y, detalhes_semente + 50);
	}
	ivec2 b0 = ivec2(floor(cc / grupos_grade_px));
	float m = 0.0;
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			ivec2 b = b0 + ivec2(i, j);
			if (hash_app(b.x, b.y, detalhes_semente + 60) >= grupos_chance) {
				continue;
			}
			vec2 centro = (vec2(b) + 0.2 + 0.6 * vec2(hash_app(b.x, b.y, detalhes_semente + 61), hash_app(b.x, b.y, detalhes_semente + 62))) * grupos_grade_px;
			float r = mix(grupos_raio_min, grupos_raio_max, hash_app(b.x, b.y, detalhes_semente + 63)) * grupos_grade_px;
			m = max(m, 1.0 - smoothstep(0.55 * r, r, length(cc - centro)));
		}
	}
	return 2.0 * m - 1.0;
}

// q do detalhe da célula g espelhado na diagonal, se a textura pede e o sorteio cai.
vec2 espelhado(vec2 q, ivec2 g) {
	if (espelhar && hash_app(g.x, g.y, detalhes_semente + 6) < 0.5) {
		return q.yx;
	}
	return q;
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
	if (passo_casas > 0.0) {
		// Grade de passo maior (detalhes.passoCasas): por célula, densidade x passo².
		passo = 64.0 * passo_casas;
		por_celula = densidade * passo_casas * passo_casas;
	}
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
			float aglomerado = aglomerado_em(cc);
			float p = clamp(por_celula * (1.0 + agrupamento * 2.0 * aglomerado), 0.0, 0.85);
			if (r0 >= p) {
				continue;
			}
			vec2 centro = (vec2(g) + vec2(hash_app(g.x, g.y, detalhes_semente + 1), hash_app(g.x, g.y, detalhes_semente + 2))) * passo;
			float esc = mix(escala_min, escala_max, hash_app(g.x, g.y, detalhes_semente + 4));
			vec2 q = espelhado((w - centro) / esc, g);
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

// Uma célula do espalhamento, com o mesmo sorteio de com_detalhes():
// xy = centro sorteado (px do mundo), z = 1 se a célula tem detalhe.
vec3 candidata(ivec2 g, float passo, float por_celula, float teto) {
	float r0 = hash_app(g.x, g.y, detalhes_semente);
	if (r0 >= teto) {
		return vec3(0.0);
	}
	vec2 cc = (vec2(g) + 0.5) * passo;
	float aglomerado = aglomerado_em(cc);
	float p = clamp(por_celula * (1.0 + agrupamento * 2.0 * aglomerado), 0.0, 0.85);
	if (r0 >= p) {
		return vec3(0.0);
	}
	vec2 centro = (vec2(g) + vec2(hash_app(g.x, g.y, detalhes_semente + 1), hash_app(g.x, g.y, detalhes_semente + 2))) * passo;
	return vec3(centro, 1.0);
}

// Metade do que falta para a e b ficarem a dmin (cada um anda a metade).
// Centros iguais: a direção é a das células (de b para a).
vec2 empurrao(vec2 a, vec2 b, ivec2 de_b_para_a) {
	vec2 v = a - b;
	float d = length(v);
	if (d >= afastar_px) {
		return vec2(0.0);
	}
	vec2 dir = d < 1e-3 ? normalize(vec2(de_b_para_a)) : v / d;
	return dir * (afastar_px - d) * 0.5;
}

vec2 limitar(vec2 v, float lim) {
	float m = length(v);
	return m > lim ? v * (lim / m) : v;
}

// com_detalhes() com afastamento: as mesmas células, o mesmo detalhe, escala e
// tom; só o centro anda. Rodada 1: c1 = c0 + soma dos empurrões das 8 vizinhas
// (em c0). Rodada 2: c2 = c1 + soma dos empurrões das 8 vizinhas (em c1). O
// deslocamento total (c2 - c0) fica limitado a afastar_px / 2, para o laço de
// 5 x 5 células continuar cobrindo o detalhe.
vec3 com_detalhes_afastados(vec2 w, vec3 c) {
	float passo = 32.0 * celula_casas;
	float meia = 32.0 * celula_casas;
	float por_celula = densidade * 0.25 * celula_casas * celula_casas;
	if (passo_casas > 0.0) {
		// Grade de passo maior (detalhes.passoCasas): por célula, densidade x passo².
		passo = 64.0 * passo_casas;
		por_celula = densidade * passo_casas * passo_casas;
	}
	ivec2 g0 = ivec2(floor(w / passo));
	float teto = clamp(por_celula * (1.0 + 2.0 * agrupamento), 0.0, 0.85);
	vec2 grade = vec2(float(atlas_colunas), float(atlas_linhas));
	float texel_por_tela = (atlas_px_por_casa / 64.0) / max(zoom, 1e-4);
	float lim = 0.5 * afastar_px;
	// c0: 9 x 9 células em volta (g0 - 4 .. g0 + 4).
	vec3 c0[81];
	for (int j = 0; j < 9; j++) {
		for (int i = 0; i < 9; i++) {
			c0[j * 9 + i] = candidata(g0 + ivec2(i - 4, j - 4), passo, por_celula, teto);
		}
	}
	// c1: rodada 1 nas 7 x 7 do meio (g0 - 3 .. g0 + 3).
	vec2 c1[49];
	for (int j = 0; j < 7; j++) {
		for (int i = 0; i < 7; i++) {
			int k0 = (j + 1) * 9 + (i + 1);
			vec3 a = c0[k0];
			vec2 desl = vec2(0.0);
			if (a.z > 0.5) {
				for (int oy = -1; oy <= 1; oy++) {
					for (int ox = -1; ox <= 1; ox++) {
						vec3 b = c0[k0 + oy * 9 + ox];
						if ((ox != 0 || oy != 0) && b.z > 0.5) {
							desl += empurrao(a.xy, b.xy, ivec2(-ox, -oy));
						}
					}
				}
			}
			c1[j * 7 + i] = a.xy + limitar(desl, lim);
		}
	}
	// Rodada 2 e desenho, nas 5 x 5 de sempre, na mesma ordem (gy e depois gx).
	for (int dy = -2; dy <= 2; dy++) {
		for (int dx = -2; dx <= 2; dx++) {
			ivec2 g = g0 + ivec2(dx, dy);
			vec3 a = c0[(dy + 4) * 9 + dx + 4];
			if (a.z < 0.5) {
				continue;
			}
			int k1 = (dy + 3) * 7 + dx + 3;
			vec2 p1 = c1[k1];
			vec2 desl = p1 - a.xy;
			for (int oy = -1; oy <= 1; oy++) {
				for (int ox = -1; ox <= 1; ox++) {
					vec3 b = c0[(dy + 4 + oy) * 9 + dx + 4 + ox];
					if ((ox != 0 || oy != 0) && b.z > 0.5) {
						desl += empurrao(p1, c1[k1 + oy * 7 + ox], ivec2(-ox, -oy));
					}
				}
			}
			vec2 centro = a.xy + limitar(desl, lim);
			float esc = mix(escala_min, escala_max, hash_app(g.x, g.y, detalhes_semente + 4));
			vec2 q = espelhado((w - centro) / esc, g);
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
			if (afastar_px > 0.0) {
				c = com_detalhes_afastados(w, c);
			} else {
				c = com_detalhes(w, c);
			}
		}
	}
	if (usar_mascara) {
		float m = texture(mascara, (w - mascara_origem) / mascara_mundo).r;
		c = mix(cor_fora, c, m);
	}
	COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}

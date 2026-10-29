// =====================================================================
// comum/cabecalho.gdshaderinc: CONGELADO. Os designers só incluem, nunca editam.
//
// Primeira linha útil do textura.gdshader de cada textura (depois de
// shader_type e render_mode). Traz os uniforms que o exportador preenche e a
// biblioteca de desenho (paleta, sorteio, ruído periódico, formas, pincelada).
//
// Depois do cabeçalho a textura escreve as DUAS funções do contrato e, por
// último, inclui comum/rodape.gdshaderinc:
//
//   vec3 pintar_base(vec2 p, float P, float px, int sem, int qual)
//       A cor do ladrilho de base no ponto p (px do mundo, 0..P; 64 px = 1 casa).
//       Tudo que usar ruído ou sorteio tem de repetir a cada P (use rz, fz,
//       hash_cel com mod e pinceladas da base: todos recebem P). "qual"
//       é 0, 1 ou 2 (base-1, base-2, base-3): mesma estrutura, superfície diferente.
//       Nenhum parâmetro pode ter o nome de um uniform daqui (modo, variante,
//       periodo, semente, atlas_colunas, atlas_linhas, celula_casas): o Godot recusa.
//
//   vec4 pintar_detalhe(int i, vec2 q, float px, int sem)
//       O detalhe número i do atlas (0 = o primeiro), em q = px do mundo a
//       partir do centro da célula; a célula tem 64 x 64 px do mundo (1 casa),
//       então q vai de -32 a 32 (com detalhes.celulaCasas = 2: 128 x 128, -64 a 64). Devolve a cor RETA (não multiplicada pelo
//       alfa) e o alfa. Deixe 4 px do mundo de borda transparente na célula.
// =====================================================================

uniform int modo = 0;          // 0 = ladrilho de base, 1 = atlas de detalhes
uniform int variante = 0;      // 0, 1, 2 = base-1, base-2, base-3
uniform float periodo = 512.0; // período do ladrilho de base, em px do mundo
uniform int semente = 7;       // a semente da textura (config.json)
uniform int atlas_colunas = 4;
uniform int atlas_linhas = 4;
uniform float celula_casas = 1.0; // 1 = células de 1 casa (atlas 4 x 4), 2 = de 2 casas (2 x 2)

#include "res://shaders/base.gdshaderinc"
#include "res://comum/mundo.gdshaderinc"

// Tons da receita do Meio-Termo (client/src/texturas/meioTermo/tons.ts), em RGB
// aproximado: realce = mais luz e um pouco para o amarelo; sombra = menos luz;
// contorno = 60% da cor, nunca preto.
vec3 realce_de(vec3 c) {
	return mix(c * 1.1, vec3(0.98, 0.93, 0.70), 0.08);
}

vec3 sombra_de(vec3 c) {
	return c * vec3(0.86, 0.84, 0.82);
}

vec3 contorno_de(vec3 c) {
	return max(c * 0.6, vec3(0.06));
}

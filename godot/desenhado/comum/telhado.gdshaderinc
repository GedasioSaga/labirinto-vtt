// =====================================================================
// comum/telhado.gdshaderinc: CONGELADO. Os designers da onda 2 só incluem, nunca editam.
//
// O cabeçalho do telhado, da faixa e do objeto (CONTRATO.md, seção 8). Primeira linha
// útil do textura.gdshader (depois de shader_type e render_mode). Traz tudo do
// cabeçalho do chão (paleta, sorteio, ruído periódico, formas, tons) e os uniforms
// que o exportador preenche para estes tipos. Depois dele a textura escreve as
// funções do seu tipo e, por último, inclui o rodapé:
//
// TELHADO ("tipo": "telhado" no config.json), rodapé comum/rodape_telhado.gdshaderinc
//
//   vec2 pintar_telhado(vec2 p, float P, float px, int sem, int qual)
//       O material de UMA água, no espaço do telhado, em px do mapa (64 px = 1 casa):
//         p.x = u, ao longo do beiral (0..P);
//         p.y = v, subindo da PONTA do beiral para a cumeeira (0..P; v = 0 é a ponta).
//       Repete a cada P nos dois sentidos (use rz, fz, hash_cel com mod). As fileiras
//       têm de fechar no período: P / altura da fileira inteiro, e v = 0 é a borda de
//       baixo de uma fileira (o beiral corta sempre numa fileira inteira).
//       Devolve vec2(valor, lado):
//         valor 0..1, em CINZA: 0,5 é exatamente a cor do mestre (a média da água
//               deve ficar perto de 0,5; o exportador avisa se passar de 0,03);
//         lado -1..1: para onde a superfície se inclina AO LONGO do beiral
//               (+1 = virada para +u). O app acende esse lado pela luz de cada água;
//               não pinte luz lateral no valor (ela ficaria errada nas águas giradas).
//       A luz da água inteira, a ponta escura do beiral, o rincão e a cor são do app.
//       "qual" = 0, 1, 2: a mesma geometria (fileiras, colunas) com outra superfície.
//
//   vec3 pintar_faixa(vec2 q, float L, float meia, float px, int sem)   (opcional)
//       Escreva "#define TEM_FAIXA" antes do rodapé. A faixa da cumeeira e do espigão
//       (peças de cumeeira), repetida ao longo da emenda:
//         q.x = ao longo da emenda (0..L, repete a cada L);
//         q.y = atravessando, de -meia a +meia (0 = a emenda).
//       Devolve vec3(valor, lado, alfa): valor e lado como acima, mas o lado é
//       ATRAVESSANDO (+1 = virada para +q.y); alfa reto (0 = deixa ver a água).
//
// FAIXA ("tipo": "faixa"), rodapé comum/rodape_telhado.gdshaderinc com "#define SO_FAIXA"
//       Só pintar_faixa (a cumeeira amarrada da palha é deste tipo).
//
// OBJETO ("tipo": "objeto"), rodapé comum/rodape_objeto.gdshaderinc
//
//   vec4 pintar_objeto(vec2 q, float px, int sem)
//       O objeto visto de cima, com a SOMBRA dele já pintada (a luz não gira: a
//       chaminé fica sempre de pé na tela). q em px do mapa a partir do centro do
//       CORPO (a âncora). Devolve a cor RETA (não multiplicada) e o alfa. Não é
//       tingido. Deixe 2 px do mapa de borda transparente.
//
// Nenhum parâmetro pode ter o nome de um uniform daqui nem do cabeçalho do chão.
// =====================================================================

#include "res://comum/cabecalho.gdshaderinc"

uniform float faixa_comprimento = 160.0; // L: px do mapa ao longo da emenda (um período)
uniform float faixa_meia = 6.0;          // meia largura da faixa, px do mapa
uniform float objeto_px_por_mapa = 2.0;  // px da imagem por px do mapa (128 px por casa)
uniform float objeto_lado = 64.0;        // lado da imagem do objeto, px da imagem
uniform vec2 objeto_ancora = vec2(32.0); // o centro do corpo, em px da imagem

// O valor de uma luz relativa (-0,5..0,5) em torno da cor do mestre.
float valor_de(float luz) {
	return clamp(0.5 + luz, 0.0, 1.0);
}

// Uma fileira de altura "a" (px) no ponto v: o índice da fileira e onde o ponto está
// nela (0 = a borda de baixo, a ponta da peça; 1 = embaixo da fileira de cima).
vec2 fileira_em(float v, float a) {
	float r = v / a;
	float i = floor(r);
	return vec2(i, r - i);
}

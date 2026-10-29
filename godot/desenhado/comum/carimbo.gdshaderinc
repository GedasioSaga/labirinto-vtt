// =====================================================================
// comum/carimbo.gdshaderinc: CONGELADO. Os designers da onda 3 só incluem, nunca editam.
//
// O cabeçalho do carimbo e do trecho (CONTRATO.md, seção 9). Primeira linha útil do
// textura.gdshader (depois de shader_type e render_mode). Traz tudo do cabeçalho do
// chão (paleta, sorteio, ruído periódico, formas, tons, LUZ) e os uniforms que o
// exportador preenche para estes tipos. Depois dele a textura escreve a função do
// seu tipo e, por último, inclui comum/rodape_carimbo.gdshaderinc.
//
// CARIMBO ("tipo": "carimbo" no config.json): árvore, planta, pedra, poça, e o vaso
//
//   vec4 pintar_carimbo(vec2 q, float px, int sem, int k)
//       O objeto VISTO DE CIMA, uma variação (k = 0 .. variacoes - 1).
//         q em UNIDADES do tamanho a partir do MEIO da imagem, y para baixo. No app,
//           uma unidade é o tamanho do carimbo no mundo (no mapa de referência, 200 x
//           200 casas, a árvore tem 154,6 px = 2,4 casas; "unidade_mundo" diz quanto é).
//           No destino "movel", uma unidade é 1 casa. Desenhe o objeto no meio; onde
//           fica o pé (Carimbo.x, y) é o "sprite.ancoraPx" do config.json: para o
//           objeto não andar quando o mapa troca de estilo, ancoraPx = meio da imagem
//           - centroDoAtual x unidadePx (a folha mede o centroDoAtual).
//         px = o tamanho de um pixel da imagem, em unidades (para cobre()).
//       Devolve a cor RETA (não multiplicada) e o alfa. SEM a sombra no chão: a sombra
//       é do app, pela silhueta (o alfa). A luz vem de cima à esquerda e NÃO gira: o
//       app nunca gira a imagem (o giro do mestre escolhe a variação e o espelho
//       diagonal, que não muda a luz porque LUZ está na diagonal). Deixe 2 px da imagem
//       de borda transparente.
//       Para escrever 2 px do mundo (o contorno do protótipo do Fogo):
//       2.0 / unidade_mundo. Para 1 px da imagem: px.
//
// TRECHO ("tipo": "trecho"): a sebe e a jardineira. Escreva "#define TRECHO" antes do
// rodapé.
//
//   vec4 pintar_trecho(vec2 q, float L, float meia, float ponta, float px, int sem)
//       A COR do trecho, SEM luz de direção (só a forma, o tom de cada peça, a sombra
//       de dentro e o contorno). q em px do mundo (64 px = 1 casa):
//         q.x = s, ao longo: de -ponta a 0 é a PONTA do começo (o app espelha para fazer
//               a do fim); de 0 em diante o trecho, que repete a cada L;
//         q.y = c, atravessando, de -meia a +meia (0 = o eixo; +c = para baixo quando o
//               trecho anda para a direita).
//       Devolve a cor reta e o alfa.
//
//   vec2 relevo_do_trecho(vec2 q, float L, float meia, float ponta, float px, int sem)
//       Para onde a superfície se inclina, no mesmo ponto: x = ao longo (+1 = virada
//       para +s), y = atravessando (+1 = virada para +c), de -1 a 1 (0 = plano). O app
//       acende pela LUZ depois de deitar o trecho na curva (CONTRATO.md 9.5): não pinte
//       luz de direção na cor, ela ficaria errada quando a sebe vira.
//
// Nenhum parâmetro pode ter o nome de um uniform daqui nem do cabeçalho do chão.
// =====================================================================

#include "res://comum/cabecalho.gdshaderinc"

uniform float sprite_lado = 256.0;          // lado da imagem do carimbo, px da imagem
uniform vec2 sprite_ancora = vec2(128.0);   // a âncora (o pé), px da imagem
uniform float sprite_unidade = 160.0;       // px da imagem numa unidade do tamanho
uniform float unidade_mundo = 154.6;        // px do mundo numa unidade, no mapa de referência
uniform float trecho_comprimento = 64.0;    // L: o período ao longo, px do mundo
uniform float trecho_meia = 16.0;           // meia largura, px do mundo
uniform float trecho_ponta = 16.0;          // quanto a ponta passa do começo, px do mundo
uniform vec2 trecho_imagem = vec2(160.0, 64.0); // tamanho da imagem do trecho, px da imagem

// A luz de um ponto da copa (ou de um domo): o quanto a normal de uma bola de centro c e
// raio r, no ponto q, olha para a LUZ. De -1 (de costas) a 1 (de frente); 0 na borda.
float luz_do_domo(vec2 q, vec2 c, float r) {
	vec2 v = (q - c) / max(r, 1e-4);
	float l2 = dot(v, v);
	float z = sqrt(max(1.0 - l2, 0.0));
	vec3 n = vec3(v, z);
	return dot(n, normalize(vec3(LUZ, 0.9)));
}

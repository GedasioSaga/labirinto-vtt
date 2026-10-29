// =====================================================================
// comum/material.gdshaderinc: CONGELADO. Os designers da onda 4 só incluem, nunca editam.
//
// O cabeçalho de um MATERIAL de móvel (CONTRATO.md, seção 10). Primeira linha útil do
// textura.gdshader (depois de shader_type e render_mode). Traz tudo do cabeçalho do
// chão (paleta, sorteio, ruído periódico, formas, tons) e o uniform do tamanho da
// imagem. Depois dele o material escreve UMA função e, por último, inclui
// comum/rodape_material.gdshaderinc:
//
//   float pintar_material(vec2 p, vec2 P, float px, int sem, int qual)
//       A superfície da classe, em px da IMAGEM (128 px = 1 casa; MATERIAL_CASA):
//         p.x = u, AO LONGO do veio, da trama ou do comprimento (0..P.x);
//         p.y = v, atravessando (0..P.y).
//       Repete a cada P nos dois sentidos: P.x e P.y podem ser diferentes, então use
//       ruido_p e fbm_p com per = P / cel (vec2), e hash_cel com mod(c, P / cel).
//       Devolve o VALOR 0..1 em cinza: 0,5 é exatamente o tom do material escolhido
//       (carvalho, nogueira...); a média da imagem tem de ficar em 0,5 +- 0,03. O app
//       troca o valor pela cor (a rampa OKLab do tom da peça): nada de matiz aqui.
//       O que é do app, não seu: o formato, o chanfro, o contorno, a luz, a sombra, o
//       brilho do metal e, na madeira, a tábua, a fresta e a emenda de topo.
//       "qual" = o índice da imagem em "imagens" do config.json (0 = "padrao", a da
//       classe; os outros são os subtipos: linho/la, granito/arenito/ardosia,
//       betula/fendida).
//
// Nenhum parâmetro pode ter o nome de um uniform daqui nem do cabeçalho do chão.
// =====================================================================

#include "res://comum/cabecalho.gdshaderinc"

uniform vec2 material_periodo = vec2(1024.0, 256.0); // px da imagem, ao longo e atravessando

const float MATERIAL_CASA = 128.0; // px da imagem por casa

// O valor de uma luz relativa (-0,5..0,5) em torno do tom do material.
float valor_de(float luz) {
	return clamp(0.5 + luz, 0.0, 1.0);
}

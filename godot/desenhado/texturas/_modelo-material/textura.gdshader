// Modelo de MATERIAL de móvel (onda 4, CONTRATO.md seção 10). Copie esta pasta para
// texturas/<id>/, troque "id", "classe" e "lote" no config.json e escreva a sua
// pintar_material. O piloto é texturas/madeira/.
//
// A imagem é a SUPERFÍCIE da classe, em cinza: 0,5 = o tom do material escolhido. O
// app tinge pelo tom de cada material (a rampa OKLab) e lê em (u, v) da peça: p.x ao
// longo (o veio, a trama, o comprimento), p.y atravessando, 128 px por casa. O motor
// do app continua dando o formato, o chanfro, o contorno, a luz e a sombra: não pinte
// luz de direção, borda nem sombra aqui.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/material.gdshaderinc"

float pintar_material(vec2 p, vec2 P, float px, int sem, int qual) {
	// Manchas largas e calmas (1 a 2 casas), nada de pontilhado.
	float larga = fbm_p(p / 128.0, P / 128.0, sem + qual * 1000, 2);
	return valor_de(0.06 * (larga - 0.5));
}

#include "res://comum/rodape_material.gdshaderinc"

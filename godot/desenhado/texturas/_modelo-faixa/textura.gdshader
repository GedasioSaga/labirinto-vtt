// MODELO de FAIXA da onda 2 (a cumeeira amarrada da palha é deste tipo). Copie a pasta
// para texturas/<id>/, troque o "id" do config.json e o desenho; as linhas de include, o
// "#define SO_FAIXA" e a assinatura não mudam. Contrato: CONTRATO.md, seção 8.
// A faixa é tingida pela cor do telhado (valor 0,5 = a cor do mestre).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/telhado.gdshaderinc"

#define SO_FAIXA
// q.x ao longo da emenda (0..L, repete), q.y atravessando (-meia..+meia). Aqui: um feixe
// de 3,2 px de cada lado com uma amarra escura a cada 9 px (L = 36: 4 amarras).
vec3 pintar_faixa(vec2 q, float L, float meia, float px, int sem) {
	float r = 3.2;
	float alfa = cobre(abs(q.y) - r, px);
	float luz = 0.03 - 0.12 * smoothstep(r - 1.0, r, abs(q.y));
	float x = mod(q.x, 9.0) - 4.5;
	luz -= 0.16 * cobre(abs(x) - 0.7, px) * cobre(abs(q.y) - 2.8, px);
	return vec3(valor_de(luz), clamp(q.y / r, -1.0, 1.0), alfa);
}

#include "res://comum/rodape_telhado.gdshaderinc"

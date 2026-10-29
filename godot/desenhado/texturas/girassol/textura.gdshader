// GIRASSOL em pé, meio de lado (onda 3, lote 8; CONTRATO.md, seção 9). Um pé só.
//
// O pé (caule, folhas e cabeça) vem de texturas/girassol/girassol.gdshaderinc, o mesmo dos
// Girassóis (texturas/girassois/): mexeu lá, reexporte os dois. Da família dos lotes 6 e 7
// aprovados: a mesma vista, a mesma luz de cima à esquerda, o mesmo contorno.
//
// - Um pé alto: o caule fino e quase reto, 2 ou 3 folhas largas e calmas e a flor no alto,
//   meio virada para a luz.
// - As 4 formas mudam a altura, a virada da cabeça, as folhas e o ouro:
//   1. média, a cabeça olhando para cima à esquerda, 3 folhas;
//   2. alta e reta, a cabeça olhando para o alto, 2 folhas, ouro mais limão;
//   3. baixa, a cabeça pesada pendendo para a esquerda, 3 folhas, ouro mais âmbar;
//   4. inclinada para a direita, a cabeça bem de lado (o verde do cálice aparece), 2 folhas.
// - "espelho": "nenhum" (em pé, transposto ele deitaria) e a sombra "em-pe" de hoje.
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qo = q - PE, y para baixo, 0 = o chão), que fica onde o pé de hoje fica (config:
// ancoraPx). Sem sombra no chão: ela é do app, pela silhueta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"
#include "res://texturas/girassol/girassol.gdshaderinc"

// O pé em unidades a partir do meio da imagem: (ancoraPx - ladoPx / 2) / unidadePx.
const vec2 PE = vec2(0.005, 0.632);

Pe forma(int k) {
	Pe p = pe_vazio();
	if (k == 1) {
		p.x0 = 0.01;
		p.cab = vec2(0.02, -1.03);
		p.raio = 0.22;
		p.virada = -1.896;
		p.achata = 0.68;
		p.curva = -0.015;
		p.fase = 0.37;
		p.petalas = 11;
		p.folhas = 2;
		p.f0 = vec4(0.34, -0.29, 0.34, 0.092);
		p.f1 = vec4(0.55, 0.26, 0.28, 0.082);
		p.atras = 2;
		p.ouro = -0.6;
	} else if (k == 2) {
		p.x0 = -0.01;
		p.cab = vec2(-0.10, -0.74);
		p.raio = 0.20;
		p.virada = 2.89;
		p.achata = 0.72;
		p.curva = -0.07;
		p.fase = 0.6;
		p.petalas = 10;
		p.folhas = 3;
		p.f0 = vec4(0.22, 0.26, 0.40, 0.085);
		p.f1 = vec4(0.42, -0.27, 0.36, 0.088);
		p.f2 = vec4(0.62, 0.21, 0.30, 0.070);
		p.atras = 1;
		p.ouro = 0.7;
	} else if (k == 3) {
		p.x0 = -0.02;
		p.cab = vec2(0.09, -0.94);
		p.raio = 0.20;
		p.virada = -2.94;
		p.achata = 0.66;
		p.curva = 0.05;
		p.fase = 0.85;
		p.petalas = 11;
		p.folhas = 2;
		p.f0 = vec4(0.30, 0.28, 0.32, 0.088);
		p.f1 = vec4(0.50, -0.25, 0.32, 0.084);
		p.atras = 0;
		p.ouro = 0.25;
	} else {
		p.x0 = 0.0;
		p.cab = vec2(-0.04, -0.90);
		p.raio = 0.21;
		p.virada = -2.214;
		p.achata = 0.80;
		p.curva = 0.025;
		p.fase = 0.1;
		p.petalas = 10;
		p.folhas = 3;
		p.f0 = vec4(0.28, 0.27, 0.36, 0.085);
		p.f1 = vec4(0.46, -0.28, 0.30, 0.090);
		p.f2 = vec4(0.64, 0.22, 0.26, 0.072);
		p.atras = 1;
		p.ouro = 0.0;
	}
	return p;
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qo = q - PE;
	float traco = 1.0 / unidade_mundo;
	vec4 acc = vec4(0.0);
	acc = pintar_pe(acc, qo, px, forma(k), sem + k * 131, traco);
	return fechar(acc, q, sem);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

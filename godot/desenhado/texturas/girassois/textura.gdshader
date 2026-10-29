// GIRASSÓIS em pé, meio de lado (onda 3, lote 8; CONTRATO.md, seção 9). Uma touceira.
//
// O pé (caule, folhas e cabeça) vem de texturas/girassol/girassol.gdshaderinc, o mesmo do
// Girassol sozinho: mexeu lá, reexporte os dois. Da família dos lotes 6 e 7 aprovados.
//
// - 3 a 5 pés de alturas diferentes saindo de um pé comum, as flores em alturas e viradas
//   diferentes, separadas: cada cabeça encosta no máximo na beira da vizinha, nunca empilha.
// - Os pés de trás no tom da sombra (caule, folhas e flor mais escuros e um pouco mais
//   frios); o da frente, o mais baixo, com as folhas de baixo que assentam a touceira.
// - As 4 formas mudam o número de pés, as alturas, as viradas e o ouro:
//   1. três pés: o alto atrás à esquerda, o do meio à direita, o baixo na frente;
//   2. quatro pés em escada, o mais alto atrás e o mais baixo na frente à esquerda;
//   3. cinco pés de flor menor, abertos em leque;
//   4. três pés: um alto que manda, um à direita com a cabeça pendendo, um baixo na frente.
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
const vec2 PE = vec2(0.0, 0.589);
const int MAX_PES = 5;

int quantos(int k) {
	return k == 1 ? 4 : (k == 2 ? 5 : 3);
}

// Um pé: o que muda de um para outro. x0, a cabeça (x, y), o raio, a virada, o achatamento,
// a curva do caule, o quanto fica no fundo, o giro das pétalas, as pétalas e o ouro.
Pe montar(float x0, vec2 cab, float raio, float virada, float achata, float curva, float fundo, float fase, int petalas, float ouro) {
	Pe p = pe_vazio();
	// Os pés um pouco afastados no chão: a touceira não sai de um ponto só (vira vassoura).
	p.x0 = x0 * 1.6;
	p.caule = 0.019;
	p.cab = cab;
	p.raio = raio;
	p.virada = virada;
	p.achata = achata;
	p.curva = curva;
	p.fundo = fundo;
	p.fase = fase;
	p.petalas = petalas;
	p.ouro = ouro;
	return p;
}

// O pé i da forma k, de trás (i = 0) para a frente.
Pe pe_da_touceira(int k, int i) {
	Pe p;
	if (k == 1) {
		if (i == 0) {
			p = montar(0.02, vec2(0.10, -1.06), 0.18, -1.95, 0.74, 0.03, 0.90, 0.10, 11, -0.4);
			p.folhas = 1;
			p.f0 = vec4(0.55, 0.22, 0.34, 0.066);
		} else if (i == 1) {
			p = montar(-0.04, vec2(-0.27, -0.86), 0.18, -2.50, 0.76, -0.05, 0.65, 0.40, 10, 0.4);
			p.folhas = 1;
			p.f0 = vec4(0.45, -0.22, 0.36, 0.068);
		} else if (i == 2) {
			p = montar(0.04, vec2(0.26, -0.66), 0.18, -2.90, 0.72, 0.07, 0.30, 0.70, 10, 0.1);
			p.folhas = 1;
			p.f0 = vec4(0.35, 0.22, 0.36, 0.068);
		} else {
			p = montar(-0.01, vec2(-0.08, -0.50), 0.18, -2.20, 0.84, -0.02, 0.0, 0.90, 10, 0.0);
			p.folhas = 2;
			p.f0 = vec4(0.30, -0.22, 0.34, 0.072);
			p.f1 = vec4(0.15, 0.20, 0.26, 0.066);
		}
	} else if (k == 2) {
		if (i == 0) {
			p = montar(0.0, vec2(-0.02, -1.02), 0.165, -2.00, 0.76, -0.02, 0.95, 0.30, 10, 0.5);
			p.folhas = 0;
		} else if (i == 1) {
			p = montar(0.05, vec2(0.30, -0.90), 0.165, -2.40, 0.74, 0.08, 0.75, 0.60, 10, -0.2);
			p.folhas = 1;
			p.f0 = vec4(0.55, 0.20, 0.36, 0.062);
		} else if (i == 2) {
			p = montar(-0.05, vec2(-0.32, -0.78), 0.165, -2.70, 0.74, -0.08, 0.50, 0.15, 10, 0.2);
			p.folhas = 1;
			p.f0 = vec4(0.45, -0.20, 0.36, 0.064);
		} else if (i == 3) {
			p = montar(0.03, vec2(0.18, -0.60), 0.165, -2.20, 0.82, 0.04, 0.20, 0.80, 10, 0.0);
			p.folhas = 1;
			p.f0 = vec4(0.35, 0.21, 0.34, 0.066);
		} else {
			p = montar(-0.02, vec2(-0.12, -0.44), 0.16, -2.50, 0.78, -0.03, 0.0, 0.45, 9, -0.3);
			p.folhas = 2;
			p.f0 = vec4(0.40, -0.20, 0.32, 0.066);
			p.f1 = vec4(0.12, 0.19, 0.24, 0.062);
		}
	} else if (k == 3) {
		if (i == 0) {
			p = montar(0.01, vec2(0.06, -1.08), 0.21, -2.214, 0.78, 0.02, 0.70, 0.25, 11, 0.2);
			p.folhas = 2;
			p.f0 = vec4(0.45, -0.24, 0.36, 0.070);
			p.f1 = vec4(0.62, 0.22, 0.32, 0.064);
			p.atras = 2;
		} else if (i == 1) {
			p = montar(0.05, vec2(0.30, -0.68), 0.18, 2.60, 0.74, 0.10, 0.40, 0.60, 10, 0.5);
			p.folhas = 1;
			p.f0 = vec4(0.40, 0.22, 0.36, 0.066);
		} else {
			p = montar(-0.03, vec2(-0.16, -0.46), 0.17, -2.40, 0.82, -0.04, 0.0, 0.90, 10, -0.3);
			p.folhas = 2;
			p.f0 = vec4(0.36, -0.21, 0.32, 0.066);
			p.f1 = vec4(0.12, 0.20, 0.24, 0.062);
		}
	} else {
		if (i == 0) {
			p = montar(-0.03, vec2(-0.21, -1.00), 0.20, -2.214, 0.80, -0.06, 0.85, 0.20, 10, 0.3);
			p.folhas = 1;
			p.f0 = vec4(0.50, -0.22, 0.36, 0.070);
		} else if (i == 1) {
			p = montar(0.03, vec2(0.25, -0.84), 0.19, -2.60, 0.74, 0.06, 0.45, 0.55, 10, -0.3);
			p.folhas = 1;
			p.f0 = vec4(0.45, 0.23, 0.36, 0.070);
		} else {
			p = montar(0.0, vec2(-0.05, -0.58), 0.19, -2.00, 0.82, 0.0, 0.0, 0.85, 10, 0.0);
			p.folhas = 2;
			p.f0 = vec4(0.30, -0.24, 0.36, 0.075);
			p.f1 = vec4(0.18, 0.22, 0.32, 0.070);
		}
	}
	return p;
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qo = q - PE;
	float traco = 1.0 / unidade_mundo;
	vec4 acc = vec4(0.0);
	int n = quantos(k);
	for (int i = 0; i < MAX_PES; i++) {
		if (i >= n) {
			break;
		}
		acc = pintar_pe(acc, qo, px, pe_da_touceira(k, i), sem + k * 131 + i * 17, traco);
	}
	return fechar(acc, q, sem);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

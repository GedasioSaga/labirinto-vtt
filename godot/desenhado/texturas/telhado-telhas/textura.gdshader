// Telhas (telhado-telhas): telha colonial em fileiras paralelas ao beiral, tingível.
// Onda 2, lote 5, o piloto dos telhados (CONTRATO.md, seção 8).
//
// Fileiras de 21,3 px (3 por casa) e telhas de 25,6 px (capa + canal, 2,5 por casa):
// 7,5 telhas por casa, um quarto do que o app pinta hoje (13 x 10 px, 32 por casa),
// para nada virar escama nem hachura a 25%. A capa é uma lombada larga e baixa, o
// canal fica um pouco mais fundo, e a ponta de cada capa avança de 0,8 a 2,4 px (sorteado por telha) sobre a fileira de
// baixo (borda levemente ondulada, não arco de escama). A sombra da fileira de cima
// é uma rampa larga e macia. Um empeno suave e contínuo (ruído de 2 casas) tira a
// régua das colunas e das fileiras, como telha assentada à mão.
//
// A geometria (fileiras, colunas, empeno) usa a semente da textura e é a MESMA nas
// duas variantes; a superfície (tom de cada telha, desbotado largo, grão) muda com
// "qual". A luz lateral da capa vai no canal "lado": o app acende o lado certo em
// cada água. Nada de luz lateral pintada no valor.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/telhado.gdshaderinc"

const float LARGURA_DA_TELHA = 25.6; // 512 / 20
const float ALTURA_DA_FILEIRA = 21.333333; // 512 / 24
const float TELHAS_NO_PERIODO = 20.0;
const float FILEIRAS_NO_PERIODO = 24.0;
const float AVANCO_DA_CAPA = 1.8; // px que a ponta da capa avança, em média, sobre a fileira de baixo

// A luz ao longo de uma fileira: t = 0 na ponta (borda de baixo), 1 embaixo da fileira de cima.
float luz_na_fileira(float t) {
	float sombra = -0.13 * smoothstep(0.5, 1.0, t) - 0.06 * smoothstep(0.86, 1.0, t);
	float ponta = 0.045 * (1.0 - smoothstep(0.0, 0.22, t));
	return sombra + ponta;
}

vec2 pintar_telhado(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// Empeno: o mesmo nas variantes (a geometria é uma só).
	vec2 emp = vec2(rz(p, 128.0, P, sem + 1), rz(p + vec2(37.0, 11.0), 128.0, P, sem + 2)) - 0.5;
	vec2 q = p + emp * vec2(1.6, 1.0);

	float f = q.x / LARGURA_DA_TELHA;
	float fr = f - floor(f);
	// 1 no alto da capa (fr = 0,25), 0 no fundo do canal (fr = 0,75).
	float crista = 0.5 + 0.5 * cos(TAU * (fr - 0.25));
	float col = floor(f + 0.25); // a troca de coluna cai no fundo do canal, onde nada muda de repente
	// Cada ponta avança um tanto (0,45 a 1,35 do avanço): com todas iguais a borda vira
	// "wwww" (reprovado no lote 1). O sorteio usa a fileira de baixo da borda, a mesma em
	// toda a faixa onde a ponta cai (q.y entre n·a - avanço e n·a), então não tem degrau.
	float sob = floor(q.y / ALTURA_DA_FILEIRA);
	float avanco = AVANCO_DA_CAPA * (0.45 + 0.9 * rnd(mod(vec2(col, sob), vec2(TELHAS_NO_PERIODO, FILEIRAS_NO_PERIODO)), sem + 4, 0));
	float rv = (q.y + avanco * crista * crista) / ALTURA_DA_FILEIRA;
	float fil = floor(rv);
	float t = rv - fil;

	// A fileira com antisserrilhado nas duas bordas (a ponta é um degrau de luz).
	float a = ALTURA_DA_FILEIRA;
	float luz = luz_na_fileira(t);
	luz = mix(luz, luz_na_fileira(0.999), clamp(0.5 - t * a / px, 0.0, 1.0));
	luz = mix(luz, luz_na_fileira(0.0), clamp(0.5 - (1.0 - t) * a / px, 0.0, 1.0));

	// O canal é mais fundo; a capa, uma lombada baixa.
	luz -= 0.045 * (1.0 - crista);
	// Cada telha um tom, contido (as duas variantes sorteiam outro).
	vec2 telha = mod(vec2(col, fil), vec2(TELHAS_NO_PERIODO, FILEIRAS_NO_PERIODO));
	luz += (rnd(telha, s + 3, 0) - 0.5) * 0.07;
	// Desbotado largo (2 a 4 casas) e grão de papel.
	luz += (rz(p, 256.0, P, s + 5) - 0.5) * 0.07 + (rz(p, 128.0, P, s + 6) - 0.5) * 0.03;
	luz += (grao(p, P, s + 7) - 1.0) * 0.5;
	// Devolve a média para 0,5 (a sombra da fileira e o canal escurecem em média).
	luz += 0.048;

	// O lado ao longo do beiral: a capa se inclina para +u entre o alto e o canal.
	float lado = 0.65 * sin(TAU * (fr - 0.25));
	return vec2(valor_de(luz), lado);
}

#define TEM_FAIXA
// A cumeeira e o espigão: telhas de cumeeira (meia-cana) em fila, 4 por período de 160 px,
// cada uma de 40 px, a ponta de uma por cima do começo da seguinte.
vec3 pintar_faixa(vec2 q, float L, float meia, float px, int sem) {
	float peca = floor(q.x / 40.0);
	float x = q.x - peca * 40.0; // 0 = o começo da peça (embaixo da ponta da anterior)
	float r = 4.6 + 0.55 * smoothstep(26.0, 40.0, x); // a ponta da peça abre um pouco
	float d = abs(q.y) - r;
	float alfa = cobre(d, px);
	float luz = 0.04;
	luz -= 0.08 * (1.0 - smoothstep(0.0, 3.0, x)); // a sombra da ponta da peça de antes
	luz += 0.02 * smoothstep(33.0, 39.0, x) * (1.0 - smoothstep(39.0, 40.0, x)); // a beira da ponta pega luz
	luz -= 0.11 * smoothstep(r - 1.8, r, abs(q.y)); // a beira encosta nas telhas
	luz += (rnd(vec2(mod(peca, 4.0), 7.0), sem + 9, 0) - 0.5) * 0.06;
	float lado = clamp(q.y / r, -1.0, 1.0);
	return vec3(valor_de(luz), lado, alfa);
}

#include "res://comum/rodape_telhado.gdshaderinc"

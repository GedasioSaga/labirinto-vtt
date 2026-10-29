// Cumeeira amarrada (cumeeira-amarrada): a faixa da cumeeira da palha, tingível.
// Onda 2, lote 5 (CONTRATO.md, seção 8). Só a faixa: o telhado é o telhado-palha.
//
// Um rolo de palha de uns 15 px do mapa sobre a cumeeira (o de hoje tem 6,8), feito
// de mechas largas dobradas por cima do cume (14 px cada, em média, a largura sorteada
// por um empeno macio). A beira do rolo é grossa e irregular: cada mecha acaba num
// ponto (+-1 px) e os fios soltos desfiam a borda (outros de cada lado). O rolo é
// redondo pelo canal "lado" (o app acende o lado da luz em cada telhado); no valor vão
// a lombada (simétrica, não é luz lateral), o contorno na própria cor, o tom de cada
// mecha, listras largas de fios com um pouco de viés e o grão.
//
// A amarra é rara e sorteada, nunca um carimbo: o período (512 px, 8 casas, o máximo
// do contrato) tem 6 vãos e cada vão tem 70% de chance de UMA amarra, num ponto
// sorteado do vão. Dá uma amarra a cada 1 a 2 casas em média, com vão de 0,7 a 3,3
// casas entre duas. Cada amarra sorteia a largura, a inclinação e se é de uma volta ou
// de duas; o rolo afina onde ela aperta e a palha escurece dos dois lados da corda.
//
// Fora do rolo, uma sombra de contato macia (alfa até 0,3) assenta o rolo na palha.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/telhado.gdshaderinc"

const float RAIO_DO_ROLO = 7.4; // meia largura média do rolo, px do mapa
const float VAOS = 6.0; // vãos por período; no máximo uma amarra por vão
const float CHANCE_DA_AMARRA = 0.7;
const float MECHAS = 36.0; // mechas no período (14 px cada, em média, com L = 512)
const float LISTRAS = 96.0; // listras de fios no período (5,3 px)
const float HALO = 2.4; // a sombra de contato do rolo sobre o telhado, px
const float ESCURO_DA_AMARRA = 0.17;

#define SO_FAIXA

// A amarra mais perto de x (já inclinada por y): vec4(dx, meia largura, dupla, existe).
vec4 amarra_perto(float x, float y, float L, int sem) {
	float S = L / VAOS;
	float j = floor(x / S);
	vec4 melhor = vec4(1e5, 1.0, 0.0, 0.0);
	for (int d = -1; d <= 1; d++) {
		float jj = j + float(d);
		vec2 k = vec2(mod(jj, VAOS), 3.0);
		if (rnd(k, sem + 11, 0) >= CHANCE_DA_AMARRA) {
			continue;
		}
		float c = (jj + 0.25 + 0.5 * rnd(k, sem + 11, 1)) * S;
		float inclina = (rnd(k, sem + 11, 2) - 0.5) * 0.5;
		float dx = x - c + inclina * y;
		if (abs(dx) < abs(melhor.x)) {
			float meia_l = 1.0 + 0.6 * rnd(k, sem + 11, 3);
			float dupla = rnd(k, sem + 11, 4) < 0.45 ? 1.0 : 0.0;
			melhor = vec4(dx, meia_l, dupla, 1.0);
		}
	}
	return melhor;
}

vec3 pintar_faixa(vec2 q, float L, float meia, float px, int sem) {
	float aa = max(px, 0.45);
	float ay = abs(q.y);

	// As mechas ao longo do cume: largura sorteada por um empeno macio do eixo.
	float xw = q.x + 7.0 * (rz(vec2(q.x, 11.7), 32.0, L, sem + 3) - 0.5);
	float n_mechas = MECHAS;
	float m = xw * (MECHAS / L);
	float i = floor(m);
	float f = m - i;
	float passa = smoothstep(0.62, 1.0, f);
	vec2 ka = vec2(mod(i, n_mechas), 5.0);
	vec2 kb = vec2(mod(i + 1.0, n_mechas), 5.0);
	float tom = mix(rnd(ka, sem + 4, 0), rnd(kb, sem + 4, 0), passa) - 0.5;
	float ponta = mix(rnd(ka, sem + 4, 1), rnd(kb, sem + 4, 1), passa) - 0.5;

	// A amarra e o aperto do rolo nela.
	vec4 am = amarra_perto(q.x, q.y, L, sem);
	float aperto = am.w * 0.9 * (1.0 - smoothstep(0.0, 5.0, abs(am.x)));
	// A beira: o comprimento de cada mecha e as pontas soltas dos fios (outras de cada lado).
	float fios = rz(vec2(q.x, q.y < 0.0 ? 7.1 : 29.3), 4.0, L, sem + 8) - 0.5;
	float r = RAIO_DO_ROLO + 2.0 * ponta + 0.5 * (rz(vec2(q.x, 3.3), 64.0, L, sem + 5) - 0.5) + 2.2 * fios - aperto;

	// O rolo: valor de cumeeira (um tico mais clara), lombada no meio, contorno na
	// própria cor na beira.
	float luz = 0.0;
	luz += 0.06 * (1.0 - (ay / r) * (ay / r));
	luz += tom * 0.08;
	luz -= 0.11 * smoothstep(r - 2.2, r, ay);
	// Fios de cada mecha dobrados por cima do cume: listras largas, um pouco de viés.
	luz += (ruido_p(vec2((xw - 0.15 * q.y) * (LISTRAS / L), q.y / 12.0), vec2(LISTRAS, 64.0), sem + 6) - 0.5) * 0.1;
	luz += (grao(vec2(q.x, q.y + 32.0), L, sem + 7) - 1.0) * 0.4;

	// A amarra: uma ou duas voltas de corda, escura, só em cima do rolo. A corda é
	// redonda: o meio de cada volta clareia um pouco.
	float corda = 0.0;
	float meio_da_corda = 0.0;
	if (am.w > 0.5) {
		float dx = abs(am.x);
		float dl = dx;
		float h = am.y;
		if (am.z > 0.5) {
			// Duas voltas: dois fios mais finos com um vão de palha entre eles.
			h = am.y * 0.55;
			dl = abs(dx - (h + 0.35));
		}
		corda = cobre(dl - h, aa) * cobre(ay - (r - 0.35), aa);
		meio_da_corda = 1.0 - clamp(dl / h, 0.0, 1.0);
		// A palha afunda e escurece um pouco dos dois lados da corda.
		luz -= 0.05 * (1.0 - smoothstep(am.y, am.y + 3.0, dx)) * cobre(ay - r, aa);
	}
	luz = mix(luz, luz - ESCURO_DA_AMARRA + 0.06 * meio_da_corda, corda);

	float alfa_rolo = cobre(ay - r, aa);
	float lado_rolo = clamp(q.y / max(r, 1.0), -1.0, 1.0) * 0.9;

	// A sombra de contato fora do rolo (some antes da borda da faixa).
	float alfa_halo = 0.3 * (1.0 - smoothstep(r, r + HALO, ay)) * (1.0 - smoothstep(meia - 0.6, meia, ay));
	float valor_halo = 0.2;

	float alfa = alfa_rolo + alfa_halo * (1.0 - alfa_rolo);
	float w = alfa_rolo / max(alfa, 1e-4);
	float valor = mix(valor_halo, valor_de(luz), w);
	float lado = lado_rolo * w;
	return vec3(valor, lado, alfa);
}

#include "res://comum/rodape_telhado.gdshaderinc"

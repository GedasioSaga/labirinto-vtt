// CHAMINÉ de pedra vista de cima (onda 2, lote 5; CONTRATO.md, seção 8). Objeto: cor reta
// e alfa, com a sombra pintada, NÃO tingido. Sai por cima do telhado, onde o app já a põe
// (posicaoDaChamine), escalada para o corpo ter de 11 a 20 px do mapa.
//
// O desenho, de baixo para cima: a sombra projetada no telhado, varrida do pé até a ponta
// (a sombra de um bloco alto, ligada ao corpo, sem dente nos cantos); a face do lado da
// sombra (o volume); a coroa com 4 pedras grandes em cata-vento em volta da boca; a boca
// escura e macia, com a parede de dentro acesa do lado da luz e um fio de fuligem na
// beira. Contorno = a cor da pedra a 60% (como o protótipo do Fogo), nunca preto.
//
// q = px do mapa a partir do centro do corpo, com 20 px de corpo (config: corpoPx 40, a 2
// px da imagem por px do mapa). As medidas abaixo são a 20 px; o app escala tudo junto
// (a 11 px tudo fica com 55%), então nada aqui é menor que ~0,8 px.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/telhado.gdshaderinc"

const vec3 GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b (paleta.ts, granito)

const float MEIO = 10.0;                    // meio lado do corpo (20 px)
const float CANTO = 2.2;                    // canto arredondado da coroa
const vec2 FACE = vec2(2.4, 3.1);           // a face do lado da sombra (o volume), como o Atual
const vec2 SOMBRA_DESLOC = vec2(4.8, 6.0);  // do pé até a ponta da sombra (a altura)
const float SOMBRA_BORRAO = 1.9;
const float SOMBRA_ALFA = 0.25;             // ESTILO.md 4: até 0,25
const float BOCA_MEIO = 4.0;                // a boca tem 8 px (40% do lado)
const float BOCA_CANTO = 1.5;
const float JUNTA = 0.8;                    // largura da junta entre as pedras
const float TRACO_FORA = 1.3;               // contorno da silhueta
const float TRACO_DENTRO = 0.85;            // a beira da coroa sobre a face
const float SUAVE = 0.75;                   // a menor borda, px do mapa (o app reduz até 3,6:1)
const float TREMOR = 0.2;                   // linhas à mão, não de régua

// Uma caixa varrida de 0 até v: a sombra de um bloco alto, ou o volume dele.
float caixa_varrida(vec2 q, vec2 b, float r, vec2 v) {
	float d = 1e9;
	for (int k = 0; k <= 6; k++) {
		d = min(d, sd_caixa(q - v * (float(k) / 6.0), b, r));
	}
	return d;
}

float cobre_s(float d, float px) {
	return cobre(d, max(px, SUAVE));
}

// As 4 juntas do cata-vento: cada pedra vai de uma beira da coroa até a boca e encosta a
// ponta no lado comprido da vizinha.
float d_juntas(vec2 q) {
	float m = BOCA_MEIO;
	float H = MEIO + 2.0;
	float d = sd_traco(q, vec2(m, -H), vec2(m, -m), 0.0, 0.0);
	d = min(d, sd_traco(q, vec2(m, m), vec2(H, m), 0.0, 0.0));
	d = min(d, sd_traco(q, vec2(-m, m), vec2(-m, H), 0.0, 0.0));
	d = min(d, sd_traco(q, vec2(-H, -m), vec2(-m, -m), 0.0, 0.0));
	return d;
}

// Qual pedra (0 de cima, 1 da direita, 2 de baixo, 3 da esquerda; 4 = a boca).
float qual_pedra(vec2 q) {
	float m = BOCA_MEIO;
	if (q.y < -m && q.x < m) { return 0.0; }
	if (q.x >= m && q.y < m) { return 1.0; }
	if (q.y >= m && q.x > -m) { return 2.0; }
	if (q.x <= -m && q.y >= -m) { return 3.0; }
	return 4.0;
}

// A pedra como distância: dentro da coroa, fora da boca, longe das juntas.
float d_pedra(vec2 q) {
	float dc = sd_caixa(q, vec2(MEIO), CANTO);
	float db = sd_caixa(q, vec2(BOCA_MEIO), BOCA_CANTO);
	return max(max(dc, JUNTA * 0.5 - d_juntas(q)), -db);
}

vec2 normal_da_pedra(vec2 q) {
	float e = 0.4;
	vec2 g = vec2(d_pedra(q + vec2(e, 0.0)) - d_pedra(q - vec2(e, 0.0)),
			d_pedra(q + vec2(0.0, e)) - d_pedra(q - vec2(0.0, e)));
	return g / max(length(g), 1e-5);
}

vec4 pintar_objeto(vec2 q0, float px, int sem) {
	vec4 acc = vec4(0.0);
	vec2 B = vec2(MEIO);
	vec3 contorno = contorno_de(PEDRA);
	vec3 cor_face = mix(PEDRA, contorno, 0.3);
	uint h = hash_cel(vec2(3.0, 7.0), sem);

	// 1. Sombra no telhado: o corpo varrido do pé até a ponta, borda esfumada.
	float ds = caixa_varrida(q0, B, CANTO, SOMBRA_DESLOC + FACE * 0.5);
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-SOMBRA_BORRAO, SOMBRA_BORRAO, ds)) * SOMBRA_ALFA);

	// Daqui para cima, o traço treme um pouco (linha de mão).
	vec2 q = q0 + TREMOR * vec2(sin(q0.y * 0.43 + TAU * rk(h, 0)), sin(q0.x * 0.47 + TAU * rk(h, 1)));

	// 2. A face do lado da sombra: o corpo varrido até FACE. A da direita um tom abaixo
	//    da de baixo (as duas de costas para a luz; a de baixo pega mais céu).
	float d_coroa = sd_caixa(q, B, CANTO);
	float d_vol = caixa_varrida(q, B, CANTO, FACE);
	float da_direita = smoothstep(-0.8, 0.8, (q.x - MEIO) * FACE.y - (q.y - MEIO) * FACE.x);
	vec3 face = mix(cor_face, cor_face * 0.9, da_direita);
	acc = sobre(acc, face, cobre_s(d_vol, px));

	// 3. A coroa: o fundo é a cor da junta; por cima, as 4 pedras, cada uma no seu tom,
	//    com a luz na beira de cima à esquerda e a sombra na de baixo à direita (a peça do
	//    protótipo do Fogo).
	vec3 junta = mix(contorno, PEDRA, 0.4);
	acc = sobre(acc, junta, cobre_s(d_coroa, px));
	float qual_p = qual_pedra(q);
	uint hp = hash_cel(vec2(qual_p, 11.0), sem);
	vec3 tom = mix(PEDRA, GRANITO, 0.05 + 0.42 * rk(hp, 0)) * (0.975 + 0.05 * rk(hp, 1));
	// Um degradê largo e calmo dentro de cada pedra (sem detalhe miúdo).
	tom *= 1.0 + 0.04 * (rz(q + vec2(37.0 * qual_p, 0.0), 8.0, 256.0, sem + 5) - 0.5);
	float dp = d_pedra(q);
	vec2 n = normal_da_pedra(q);
	float beira = 1.0 - smoothstep(0.2, 1.4, -dp);
	float pra_luz = dot(n, LUZ);
	tom = mix(tom, realce_de(tom), beira * smoothstep(0.1, 0.7, pra_luz) * 0.85);
	tom = mix(tom, sombra_de(tom), beira * smoothstep(0.1, 0.7, -pra_luz) * 0.75);
	acc = sobre(acc, tom, cobre_s(dp, px));

	// 4. O fio de fuligem: um véu escuro e fino em volta da boca, desigual ao longo dela.
	float db = sd_caixa(q, vec2(BOCA_MEIO), BOCA_CANTO);
	vec3 borda_boca = mix(SOMBRA, FERRO, 0.3) * 0.85;
	float ang = atan(q.y, q.x);
	float onda = 0.55 + 0.28 * sin(ang * 2.0 + TAU * rk(h, 2)) + 0.17 * sin(ang * 3.0 + TAU * rk(h, 3));
	float fio = (1.0 - smoothstep(0.0, 0.7 + 1.4 * onda, db)) * 0.36 * cobre_s(d_coroa + 1.0, px);
	acc = sobre(acc, borda_boca, fio);

	// 5. A boca: escura e macia. A parede de dentro do lado de baixo à direita aparece
	//    acesa (a luz vem de cima à esquerda); a de cima à esquerda fica na sombra da beira.
	vec3 fundo_boca = borda_boca * 0.7;
	vec2 nb = normal_caixa(q, vec2(BOCA_MEIO), BOCA_CANTO);
	float perto_da_beira = 1.0 - smoothstep(0.3, 2.6, -db);
	float parede = perto_da_beira * clamp(-dot(nb, LUZ) * 1.4, 0.0, 1.0);
	vec3 boca = mix(fundo_boca, borda_boca, (1.0 - smoothstep(0.0, BOCA_MEIO * 0.9, -db)) * 0.6);
	boca = mix(boca, mix(borda_boca, cor_face, 0.5), parede * 0.8);
	acc = sobre(acc, boca, cobre(db, max(px, 1.3)));

	// 6. Contornos: a beira da coroa sobre a face e a silhueta inteira.
	acc = sobre(acc, contorno, cobre_s(abs(d_coroa) - TRACO_DENTRO * 0.5, px));
	float d_sil = min(d_coroa, d_vol);
	acc = sobre(acc, contorno, cobre_s(abs(d_sil) - TRACO_FORA * 0.5, px));

	// Cor reta. Onde o alfa é 0, a cor do vizinho (o contorno em cima à esquerda, a sombra
	// embaixo à direita): o app lê a imagem em bilinear e não pode puxar preto da borda.
	vec3 vizinho = (q0.x + q0.y > 0.0) ? SOMBRA : contorno;
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : vizinho;
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_objeto.gdshaderinc"

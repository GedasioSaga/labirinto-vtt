// FOGO desenhado (onda 4, lote 15; CONTRATO.md seção 10): o objeto Fogo do app
// (lib/mobilia/fogo.ts), o chão queimando. Sem material (lugares vazio): tudo é cor própria
// (corFixa), como no Atual ("Cor" e "Cor da linha" não mudam o fogo).
//
// A IMAGEM é só o que fica parado: a mancha de chão chamuscado, a lenha carbonizada (a partir
// do Fogaréu) e as brasas. As LÍNGUAS, o brilho, as fagulhas e a fumaça são do app
// (pixi/fogosDoMapa.ts) e nascem de linguasDoFogo(casasW, casasH): aqui cada brasa fica no pé
// de uma língua, nas posições que o app calcula (copiadas abaixo, em casas a partir do meio).
//
// As 3 formas do painel são 3 variantes (quando.forma; o app tem de passar o tamanho do
// painel, tamanhoDoFogo, como a forma):
//   chama    1 x 1, 3 línguas (a padrão: a primeira do painel);
//   fogareu  2 x 2, 5 línguas, 2 toras carbonizadas;
//   incendio 4 x 3, 11 línguas, 4 toras. Desenhado a 0,75 (3 x 2,25 casas) para caber no teto
//            de memória da vista (com o 4 x 3 inteiro, só ele já passava dos 3 MiB): o app o
//            ESCALA 4/3 na pegada do painel, sem esticar, e tudo cai no lugar; as medidas do
//            desenho são as do 4 x 3 vezes 0,75 (o contorno também).
// Nenhuma forma tem meio liso: o fogo esticado à mão (área) ESCALA a forma mais perto. Medido
// na mesa em 29/10: com o meio liso nos dois eixos, a chama a 5 x 1 virava uma barra escura de
// borda reta com as brasas só nas pontas (as línguas do app andam pela barra inteira); escalada,
// a mancha continua uma mancha, como no Atual, e as brasas se espalham com as línguas.
//
// O desenho, de baixo para cima, na família aprovada (formas grandes, poucas massas):
// - o CHAMUSCADO: a mancha de fora, marrom, de borda em poucos lobos largos, um pouco
//   transparente (pega o tom do chão de baixo, a grama ou o assoalho);
// - a FULIGEM e o FUNDO queimado: duas massas mais escuras dentro, de lobos próprios;
// - a CINZA: 1 a 3 manchas largas e calmas de cinza clara (nada de pontinho);
// - as TORAS carbonizadas, com o contorno e as 2 massas de luz da família;
// - as BRASAS: no pé de cada língua, a borda vermelha apagada e o miolo laranja para a luz.
// Uma virada (a transposta). A sombra no chão: nenhuma (o fogo é rente ao chão).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// As cores do fogo do app (meioTermo/moveis/fogo.ts e fogueira.ts), contidas.
const vec3 BRASA_VIVA = vec3(0.588, 0.322, 0.243);   // (150, 82, 62)
const vec3 BRASA_QUENTE = vec3(0.769, 0.510, 0.322); // (196, 130, 82)
const vec3 CHAMUSCADO = vec3(0.447, 0.361, 0.239); // o capim e a terra chamuscados, ocre
const vec3 FULIGEM = vec3(0.302, 0.231, 0.184);      // #4d3b2f, a fuligem clara do app
const vec3 FUNDO_QUEIMADO = vec3(0.165, 0.125, 0.106); // #2a201b, a fuligem escura do app
const vec3 CINZA_CLARA = vec3(0.561, 0.533, 0.502);  // #9c948b um tom abaixo
const vec3 BRASA_BORDA = vec3(0.392, 0.192, 0.141);  // a beira escura do carvão em brasa
const vec3 CARVAO = vec3(0.227, 0.180, 0.153);       // #3a2e27, a tora carbonizada do app
const vec3 CARVAO_LUZ = vec3(0.427, 0.357, 0.306);
const vec3 CARVAO_CONTORNO = vec3(0.125, 0.098, 0.082);

const int FOGAREU = 0;
const int INCENDIO = 1;
const float ESCALA_DO_INCENDIO = 0.75;

// As línguas do app (linguasDoFogo), x, y em casas a partir do meio, z = a altura.
const vec3 LINGUAS_CHAMA[3] = vec3[3](vec3(0.209, -0.132, 0.569), vec3(-0.252, 0.110, 0.713), vec3(0.121, 0.149, 0.808));
const vec3 LINGUAS_FOGAREU[5] = vec3[5](vec3(-0.488, -0.238, 0.839), vec3(0.323, -0.168, 1.041), vec3(-0.390, 0.206, 1.166), vec3(0.188, 0.267, 1.244), vec3(0.033, 0.661, 1.103));
const vec3 LINGUAS_INCENDIO[11] = vec3[11](vec3(0.144, -0.498, 1.403), vec3(1.212, -0.207, 1.138), vec3(-0.658, -0.163, 1.698), vec3(0.436, -0.092, 1.600), vec3(-1.309, 0.067, 1.237), vec3(1.018, 0.261, 1.677), vec3(-0.526, 0.287, 1.580), vec3(0.253, 0.348, 1.990), vec3(-0.841, 0.690, 1.438), vec3(0.044, 0.747, 1.736), vec3(0.736, 0.884, 1.433));

// A mancha: uma elipse de meio c e raios R com a borda em lobos largos (cos de 2, 3 e 5
// voltas: poucos e grandes). Devolve a distância aproximada, em casas.
float sd_mancha(vec2 p, vec2 c, vec2 R, vec3 a, vec3 f) {
	vec2 e = (p - c) / R;
	float r = length(e);
	float t = atan(e.y, e.x);
	float lobo = 1.0 + a.x * cos(2.0 * t + f.x) + a.y * cos(3.0 * t + f.y) + a.z * cos(5.0 * t + f.z);
	return (r - lobo) * min(R.x, R.y);
}

void desenhar_cinza(inout vec4 av, inout vec4 ac, vec2 p, vec2 c, vec2 e, float ang, float dentro, float px) {
	float d = sd_elipse(girar(p - c, -ang), e);
	pousar_cor(av, ac, CINZA_CLARA, 0.5 * dentro * cobre(d, px * 1.5));
}

// A tora carbonizada: contorno, a massa clara do lado da luz e a escura do outro.
void desenhar_tora(inout vec4 av, inout vec4 ac, vec2 p, vec2 c, float ang, float meia, float raio, float px) {
	vec2 l = girar(p - c, -ang);
	vec2 b = vec2(meia + raio, raio);
	float d = sd_caixa(l, b, raio * 0.92);
	if (d > px) {
		return;
	}
	float co = contorno_para(b);
	pousar_cor(av, ac, CARVAO_CONTORNO, cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar_cor(av, ac, CARVAO, dentro);
	vec2 ll = girar(LUZ, -ang);
	float w = largura_da_massa(0.034, b, co);
	pousar_cor(av, ac, CARVAO * 0.72, dentro * (1.0 - cobre(sd_caixa(l - ll * w * 1.5, b, raio * 0.92) + co, px)));
	pousar_cor(av, ac, CARVAO_LUZ, dentro * (1.0 - cobre(sd_caixa(l + ll * w, b, raio * 0.92) + co, px)));
}

// A brasa no pé de uma língua de altura h (o tamanho cresce com ela, como no app).
void desenhar_brasa(inout vec4 av, inout vec4 ac, vec2 p, vec3 lingua, float ang, float px) {
	float r = 0.062 * clamp(lingua.z, 0.8, 1.5);
	vec2 e = vec2(r, r * 0.72);
	vec2 l = girar(p - lingua.xy, -ang);
	// Um pedaço de carvão: a massa e um lobo menor para o lado (nada de bolinha redonda).
	float d = min(sd_elipse(l, e), sd_elipse(l - vec2(0.62 * r, 0.22 * r), e * 0.62));
	if (d > px) {
		return;
	}
	pousar_cor(av, ac, BRASA_BORDA, cobre(d, px));
	pousar_cor(av, ac, BRASA_VIVA, cobre(d + 0.012, px));
	vec2 ll = girar(LUZ, -ang);
	pousar_cor(av, ac, BRASA_QUENTE, cobre(sd_elipse(l - ll * (0.22 * e.y), e * vec2(0.58, 0.52)), px));
}

// As 3 massas da mancha (pm: o ponto com a fresta colapsada). Devolve a cobertura da
// fuligem, onde a cinza pode ficar.
float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

// As 2 massas de fora da mancha (pm: o ponto): o chamuscado e a
// fuligem, cada uma com os seus lobos e o seu meio (nada de alvo). Devolve a cobertura da
// fuligem, onde a cinza pode ficar.
float desenhar_mancha(inout vec4 av, inout vec4 ac, vec2 pm, vec2 c, vec2 R, float px) {
	float dh = sd_mancha(pm, c, R, vec3(0.05, 0.07, 0.04), vec3(0.4, 0.9, 2.3));
	pousar_cor(av, ac, CHAMUSCADO, 0.72 * cobre(dh, px * 2.0));
	float df = sd_mancha(pm, c + vec2(0.03, -0.02) * R, R * vec2(0.80, 0.78), vec3(0.07, 0.09, 0.05), vec3(2.0, 2.1, 0.4));
	float f = cobre(df, px * 1.5);
	pousar_cor(av, ac, FULIGEM, 0.90 * f);
	return f;
}

// O fundo queimado: uma massa escura de lobos próprios, fora do meio da fuligem (nada de alvo).
void desenhar_fundo(inout vec4 av, inout vec4 ac, float d, float px) {
	pousar_cor(av, ac, FUNDO_QUEIMADO, 0.94 * cobre(d, px * 1.5));
}

void pintar_chama(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	vec2 pm = q;
	desenhar_mancha(av, ac, pm, vec2(0.0, 0.06), vec2(0.44, 0.37), px);
	float d = sd_mancha(pm, vec2(0.02, 0.09), vec2(0.27, 0.21), vec3(0.08, 0.13, 0.06), vec3(2.6, 0.2, 3.5));
	desenhar_fundo(av, ac, d, px);
	for (int i = 0; i < 3; i++) {
		desenhar_brasa(av, ac, q, LINGUAS_CHAMA[i], 0.2 * float(i) - 0.2, px);
	}
}

void pintar_fogareu(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	vec2 pm = q;
	float f = desenhar_mancha(av, ac, pm, vec2(0.0, 0.14), vec2(0.88, 0.76), px);
	float d = sd_mancha(pm, vec2(-0.03, 0.17), vec2(0.56, 0.44), vec3(0.08, 0.12, 0.06), vec3(2.6, 0.2, 3.5));
	desenhar_fundo(av, ac, d, px);
	desenhar_cinza(av, ac, pm, vec2(0.50, 0.66), vec2(0.15, 0.05), -0.45, f, px);
	desenhar_tora(av, ac, q, vec2(0.45, 0.43), -0.35, 0.20, 0.068, px);
	desenhar_tora(av, ac, q, vec2(-0.60, -0.24), 0.25, 0.20, 0.068, px);
	for (int i = 0; i < 5; i++) {
		desenhar_brasa(av, ac, q, LINGUAS_FOGAREU[i], 0.17 * float(i % 3) - 0.17, px);
	}
}

void pintar_incendio(inout vec4 av, inout vec4 ac, vec2 q, float px) {
	// Desenhado nas medidas do 4 x 3, a 0,75.
	vec2 p = q / ESCALA_DO_INCENDIO;
	float pd = px / ESCALA_DO_INCENDIO;
	float f = desenhar_mancha(av, ac, p, vec2(0.0, 0.20), vec2(1.76, 1.12), pd);
	float d = smin(sd_mancha(p, vec2(-0.12, 0.24), vec2(1.12, 0.66), vec3(0.08, 0.12, 0.06), vec3(2.6, 0.2, 3.5)), sd_elipse(girar(p - vec2(1.02, 0.12), 0.7), vec2(0.36, 0.28)), 0.3);
	desenhar_fundo(av, ac, d, pd);
	desenhar_cinza(av, ac, p, vec2(1.00, 0.78), vec2(0.24, 0.07), -0.3, f, pd);
	desenhar_cinza(av, ac, p, vec2(-1.22, 0.74), vec2(0.20, 0.06), 0.45, f, pd);
	desenhar_tora(av, ac, p, vec2(-1.10, 0.38), 1.05, 0.27, 0.085, pd);
	desenhar_tora(av, ac, p, vec2(0.20, 0.55), -0.25, 0.29, 0.085, pd);
	desenhar_tora(av, ac, p, vec2(1.15, 0.02), 1.2, 0.26, 0.08, pd);
	desenhar_tora(av, ac, p, vec2(-0.30, -0.33), -0.45, 0.27, 0.085, pd);
	for (int i = 0; i < 11; i++) {
		desenhar_brasa(av, ac, p, LINGUAS_INCENDIO[i], 0.17 * float(i % 3) - 0.17, pd);
	}
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (qual == FOGAREU) {
		pintar_fogareu(av, ac, q, px);
	} else if (qual == INCENDIO) {
		pintar_incendio(av, ac, q, px);
	} else {
		pintar_chama(av, ac, q, px);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

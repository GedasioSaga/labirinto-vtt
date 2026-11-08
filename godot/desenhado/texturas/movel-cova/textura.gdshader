// COVA desenhada (onda 4, lote 19, cemitério; CONTRATO.md seção 10). Toda de cor própria
// ("corFixa": true, sem lugar): a terra não tinge pelo material.
//
// Da família aprovada (piloto, lotes 10 a 15, a lápide): contorno na própria cor escurecida,
// formas grandes, a luz de cima à esquerda em poucas massas. Vista de cima, pegada 1 x 2
// casas, a cabeça em cima (o lado da lápide, que olha para +y). Um monte só, comprido e
// oval (não um retângulo), de beira um nada torta, com duas terras:
// - A TERRA ASSENTADA (a metade da cabeça): clara e lisa, assentou com a chuva; o mato
//   começa a voltar nela (2 tufos raros, um maior que o outro, um deles na beira do monte,
//   que é onde a grama entra).
// - A TERRA FRESCA (a metade do pé): escura e revolvida, um nada mais alta, separada da
//   assentada por uma beira ondulada devagar (uma onda e meia, nunca dente miúdo) com um fio
//   escuro e a sombra curta dela do lado de longe da luz. Nela, 2 TORRÕES graúdos, de quinas
//   bem gastas (nem tijolo nem bolinha): só relevo, a face clara do lado da luz e a escura do
//   outro.
// - As massas do monte: a clara larga do lado da luz e a escura estreita do outro (um domo
//   baixo), as mesmas nas duas terras, cada uma na cor dela.
// - 4 viradas (a terra fresca e o mato não são simétricos). Desenhada no referencial da cova
//   (movel_de) e acesa no da tela (LUZ). A sombra no chão é do app (o monte é baixo: 0,06).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// ---- As cores (cor própria) ----
const vec3 TERRA_ASSENTADA = vec3(0.640, 0.505, 0.365); // clara e um nada acinzentada
const vec3 TERRA_FRESCA = vec3(0.420, 0.296, 0.204);    // escura, revolvida

// ---- O monte (pegada 1 x 2; y para baixo, a cabeça em -y) ----
const vec2 MONTE_MEIA = vec2(0.41, 0.88);
const float MONTE_RAIO = 0.30;
const float MONTE_OVAL = 0.55;     // quanto da forma é elipse (o resto, caixa arredondada)
const float MONTE_TORTO = 0.012;   // a beira um nada torta, devagar
const float MONTE_LUZ = 0.15;      // a largura da massa clara
const float MONTE_ESCURA = 0.12;   // a da escura (mais estreita: o domo é baixo)

// ---- A beira entre as duas terras ----
const float BEIRA_Y = -0.10;       // onde ela cruza o meio
const float BEIRA_ONDA = 0.05;     // a altura da onda
const float BEIRA_ONDA_K = 7.0;    // a frequência dela (uma onda e meia na largura)
const float BEIRA_FIO = 0.016;     // o fio escuro da beira
const float BEIRA_SOMBRA = 0.05;   // o quanto a sombra da terra fresca anda na assentada

// ---- Os torrões ----
const float TORRAO_LUZ = 0.045;

float sd_monte(vec2 p) {
	float caixa = sd_caixa(p, MONTE_MEIA, MONTE_RAIO);
	float oval = sd_elipse(p, MONTE_MEIA + vec2(0.02, 0.03));
	float torto = MONTE_TORTO * sin(p.y * 5.0 + 1.3) * sin(p.x * 4.0 + 0.4);
	return mix(caixa, oval, MONTE_OVAL) + torto;
}

// A terra fresca: o lado do pé da beira ondulada (negativo dentro).
float sd_lado_fresco(vec2 p) {
	return (BEIRA_Y + BEIRA_ONDA * sin(p.x * BEIRA_ONDA_K + 0.8)) - p.y;
}

// Um torrão de quinas gastas: uma caixa girada, de quina bem redonda.
float sd_torrao(vec2 p, vec2 c, vec2 b, float giro) {
	return sd_caixa(girar(p - c, giro), b, 0.07);
}

void desenhar_torrao(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, vec2 c, vec2 b, float giro, float dentro, float px) {
	float d = sd_torrao(m, c, b, giro);
	if (d > px) {
		return;
	}
	float a = cobre(d, px) * dentro;
	vec3 t = mix(TERRA_FRESCA, TERRA_ASSENTADA, 0.12);
	// Só o relevo: a face escura de baixo à direita (com o fio escuro), a clara de cima à esquerda.
	float escura = a * (1.0 - cobre(sd_torrao(m - lm * TORRAO_LUZ * 1.4, c, b, giro), px));
	float fio = a * (1.0 - cobre(sd_torrao(m - lm * 0.014, c, b, giro), px));
	float clara = a * (1.0 - cobre(sd_torrao(m + lm * TORRAO_LUZ, c, b, giro), px));
	pousar_cor(av, ac, t, a);
	pousar_cor(av, ac, sombra_de(TERRA_FRESCA) * 0.88, escura);
	pousar_cor(av, ac, contorno_de(TERRA_FRESCA), fio);
	pousar_cor(av, ac, realce_de(t) * 1.05, clara);
}

void desenhar_monte(inout vec4 av, inout vec4 ac, vec2 m, vec2 lm, float px) {
	float d = sd_monte(m);
	if (d > px) {
		return;
	}
	float co = CONTORNO_CASAS;
	// Quanto do ponto é terra fresca (a beira com meio px de suavização).
	float fresca = cobre(sd_lado_fresco(m), px);
	vec3 c = mix(TERRA_ASSENTADA, TERRA_FRESCA, fresca);
	pousar_cor(av, ac, contorno_de(c), cobre(d, px));
	float dentro = cobre(d + co, px);
	pousar_cor(av, ac, c, dentro);
	// A sombra curta da terra fresca na assentada, do lado de longe da luz.
	float sf = cobre(sd_lado_fresco(m - lm * BEIRA_SOMBRA), px) * (1.0 - fresca);
	pousar_cor(av, ac, sombra_de(TERRA_ASSENTADA) * 0.9, dentro * sf);
	// As massas do domo, cada uma na cor da terra de baixo.
	float escura = dentro * (1.0 - cobre(sd_monte(m - lm * MONTE_ESCURA * 1.5) + co, px));
	float clara = dentro * (1.0 - cobre(sd_monte(m + lm * MONTE_LUZ) + co, px));
	pousar_cor(av, ac, sombra_de(c) * 0.92, escura);
	pousar_cor(av, ac, realce_de(c), clara);
	// O fio da beira: a terra fresca é um nada mais alta, a beira dela tem o contorno dela.
	float fio = cobre(abs(sd_lado_fresco(m) + 0.5 * BEIRA_FIO) - 0.5 * BEIRA_FIO, px);
	pousar_cor(av, ac, contorno_de(TERRA_FRESCA) * 1.1, dentro * fio);
	// Dois torrões graúdos na terra fresca (tamanhos e giros diferentes).
	float na_fresca = dentro * cobre(sd_lado_fresco(m) + BEIRA_FIO, px);
	desenhar_torrao(av, ac, m, lm, vec2(-0.11, 0.25), vec2(0.165, 0.11), 0.45, na_fresca, px);
	desenhar_torrao(av, ac, m, lm, vec2(0.13, 0.58), vec2(0.13, 0.095), -0.35, na_fresca, px);
}

// Um tufo de capim com o pé em pe: n folhas largas, como as da grama aprovada (o da lápide,
// mais graúdo).
void desenhar_tufo(inout vec4 av, inout vec4 ac, vec2 m, vec2 pe, float alto, int n, float inclina, float px) {
	for (int b = 0; b < 5; b++) {
		if (b >= n) {
			break;
		}
		float k = float(b) - float(n - 1) * 0.5;
		float lado = k / max(float(n - 1) * 0.5, 1.0);
		vec2 p0 = pe + vec2(k * 0.036, 0.0);
		float altura = alto * (1.0 - 0.3 * abs(lado)) * (b == 1 ? 1.08 : 0.94);
		vec2 ponta = p0 + vec2(lado * alto * 0.42 + inclina * alto, -altura);
		vec2 eixo = normalize(ponta - p0);
		vec2 meio = mix(p0, ponta, 0.5) + vec2(-eixo.y, eixo.x) * (lado * 0.02 + inclina * 0.025);
		float d = min(sd_traco(m, p0, meio, 0.030, 0.022), sd_traco(m, meio, ponta, 0.022, 0.006));
		float a = cobre(d, px);
		if (a <= 0.0) {
			continue;
		}
		float hh = clamp(dot(m - p0, ponta - p0) / dot(ponta - p0, ponta - p0), 0.0, 1.0);
		vec3 cor = mix(mix(TUFO, GRAMA_SOMBRA, 0.25), mix(GRAMA_SOMBRA, GRAMA_REALCE, 0.8), hh);
		pousar_cor(av, ac, contorno_de(TUFO), cobre(d, px) * (1.0 - cobre(d + 0.012, px)));
		pousar_cor(av, ac, cor, cobre(d + 0.012, px));
	}
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	desenhar_monte(av, ac, m, lm, px);
	// O mato: um tufo na beira de cima à esquerda (a grama entrando), um menor do outro lado.
	desenhar_tufo(av, ac, m, vec2(-0.27, -0.52), 0.17, 4, -0.06, px);
	desenhar_tufo(av, ac, m, vec2(0.22, -0.30), 0.11, 3, 0.10, px);
}

#include "res://comum/rodape_movel.gdshaderinc"

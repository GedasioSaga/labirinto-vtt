// Madeira (telhado-madeira): tábuas que descem da cumeeira ao beiral, tingível.
// Onda 2, lote 5 (CONTRATO.md, seção 8). O piloto telhado-telhas é a régua de escala.
//
// 16 tábuas por período de 512 px (2 por casa, 32 px em média), cada uma com a sua
// largura (de 21 a 45 px, sorteada): o app de hoje pinta 15 px (4,3 por casa) e vira
// listra fina a 25%. Cada tábua tem 2 ou 3 emendas de topo em 8 casas, desencontradas
// das vizinhas (as das tábuas ímpares fogem das das pares) e um pouco tortas, para não
// formar fileira. Nenhuma emenda cai a menos de 28 px do beiral (v = 0): a ponta de
// baixo de toda tábua é uma ponta inteira.
//
// A fresta entre tábuas é macia e de força sorteada por junta (algumas quase fechadas);
// a beira arredondada de cada tábua e um leve empeno dela vão no canal "lado", que o
// app acende pela luz de cada água. Nada de luz lateral pintada no valor.
//
// Geometria (larguras, juntas, emendas, veio) com a semente da textura: a mesma nas
// duas variantes. Superfície (tom de cada pedaço, desbotado largo, grão) com "qual".
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/telhado.gdshaderinc"

const int TABUAS = 16;
const float DESLOCAMENTO_DAS_JUNTAS = 9.0; // px: nenhuma junta cai em u = 0 (a borda da base)
const float BEIRAL_LIVRE = 28.0; // px acima do beiral (e abaixo de P) sem emenda de topo
const float FOLGA_DA_EMENDA = 26.0; // px que a emenda de uma tábua ímpar foge da das vizinhas

// Largura relativa da tábua k (0,68 a 1,42): o período fecha porque a soma é normalizada.
float largura_relativa(int k, int sem) {
	return 0.68 + 0.74 * rnd(vec2(float(k), 3.0), sem + 11, 0);
}

// A junta k anda um pouco ao longo de v (tábua assentada à mão), contínua e periódica.
float bamba(int k, float v, float P, int sem) {
	return 1.4 * (ruido_p(vec2(float(k) * 3.7 + 0.5, v / 128.0), vec2(4096.0, P / 128.0), sem + 21) - 0.5);
}

// Força da fresta da junta k (à esquerda da tábua k): umas quase fechadas, outras abertas.
float fresta_da_junta(int k, int sem) {
	return 0.07 + 0.11 * rnd(vec2(float(k), 9.0), sem + 13, 0);
}

// Quantas emendas a tábua k tem no período (2 ou 3) e onde cai a i-ésima, sem a folga.
int emendas_da_tabua(int k, int sem) {
	return rnd(vec2(float(k), 5.0), sem + 12, 0) < 0.55 ? 2 : 3;
}

float emenda_bruta(int k, int i, int n, float P, int sem) {
	float espaco = P / float(n);
	float fase = fract(float(k) * 0.618034 + 0.3 * rnd(vec2(float(k), 6.0), sem + 14, 0)) * espaco;
	return mod(fase + float(i) * espaco + (rnd(vec2(float(k), float(i)), sem + 15, 0) - 0.5) * 0.34 * espaco, P);
}

// A emenda i da tábua k, já com a folga: as tábuas pares ficam onde caíram; numa ímpar,
// a emenda que cai a menos de FOLGA de uma emenda das vizinhas (pares) sobe 2 folgas.
// Devolve -1 quando a emenda cairia perto do beiral (não existe).
float emenda(int k, int i, float P, int sem) {
	int n = emendas_da_tabua(k, sem);
	if (i >= n) {
		return -1.0;
	}
	float e = emenda_bruta(k, i, n, P, sem);
	if (k % 2 == 1) {
		for (int lado_v = -1; lado_v <= 1; lado_v += 2) {
			int kv = (k + lado_v + TABUAS) % TABUAS;
			int nv = emendas_da_tabua(kv, sem);
			for (int j = 0; j < 3; j++) {
				if (j < nv) {
					float ev = emenda_bruta(kv, j, nv, P, sem);
					float d = abs(e - ev);
					d = min(d, P - d);
					if (d < FOLGA_DA_EMENDA) {
						e = mod(ev + 2.0 * FOLGA_DA_EMENDA, P);
					}
				}
			}
		}
	}
	if (e < BEIRAL_LIVRE || e > P - BEIRAL_LIVRE) {
		return -1.0;
	}
	return e;
}

vec2 pintar_telhado(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	float u = p.x;
	float v = p.y;

	// As larguras, normalizadas para o período fechar.
	float soma = 0.0;
	float inicio_rel[17];
	for (int k = 0; k < TABUAS; k++) {
		inicio_rel[k] = soma;
		soma += largura_relativa(k, sem);
	}
	inicio_rel[TABUAS] = soma;
	float esc = P / soma;

	// A tábua do ponto: a última junta à esquerda de u (juntas de -1 a 16, com a bamba).
	int tabua = TABUAS - 1;
	float ini = -1.0;
	float fim = 0.0;
	float anterior = 0.0;
	for (int k = -1; k <= TABUAS; k++) {
		int km = (k + TABUAS) % TABUAS;
		float b = k < 0 ? inicio_rel[TABUAS - 1] * esc - P : inicio_rel[min(k, TABUAS)] * esc;
		float pos = b + DESLOCAMENTO_DAS_JUNTAS + bamba(km, v, P, sem);
		if (k > -1 && anterior <= u && u < pos) {
			tabua = (k - 1 + TABUAS) % TABUAS;
			ini = anterior;
			fim = pos;
		}
		anterior = pos;
	}
	float xl = u - ini;
	float xr = fim - u;
	float centro = 0.5 * (ini + fim);

	// O pedaço da tábua (entre emendas de topo) e a distância à emenda de baixo e à de cima.
	float abaixo = 1e5;
	float acima = 1e5;
	int pedaco = 0;
	int validas = 0;
	for (int i = 0; i < 3; i++) {
		float e = emenda(tabua, i, P, sem);
		if (e >= 0.0) {
			// A emenda é um corte levemente torto (até 1,9 px de um lado ao outro da tábua).
			float torto = (rnd(vec2(float(tabua), float(i) + 20.0), sem + 16, 0) - 0.5) * 0.12;
			float et = e + torto * (u - centro);
			validas += 1;
			if (et <= v) {
				pedaco += 1;
			}
			for (int w = -1; w <= 1; w++) {
				float d = v - (et + float(w) * P);
				if (d >= 0.0) {
					abaixo = min(abaixo, d);
				} else {
					acima = min(acima, -d);
				}
			}
		}
	}
	if (pedaco == validas) {
		pedaco = 0; // o pedaço que passa pelo beiral é o mesmo de cima do período
	}

	float luz = 0.0;
	float aa = max(px, 0.6);

	// Cada pedaço um tom (contido) e cada tábua um leve tom próprio.
	luz += (rnd(vec2(float(tabua), float(pedaco)), s + 3, 0) - 0.5) * 0.09;
	luz += (rnd(vec2(float(tabua), 77.0), s + 4, 0) - 0.5) * 0.03;

	// Veio: estrias compridas ao longo da tábua, de pouco contraste (o mesmo nas variantes).
	float off = 512.0 * rnd(vec2(float(tabua), 31.0), sem + 17, 0);
	float veio = 0.6 * ruido_p(vec2(xl / 5.0 + float(tabua) * 7.31, (v + off) / 128.0), vec2(4096.0, P / 128.0), sem + 30)
			+ 0.4 * ruido_p(vec2(xl / 3.2 + float(tabua) * 5.17, (v + off) / 64.0), vec2(4096.0, P / 64.0), sem + 31);
	luz += (veio - 0.5) * 0.068;

	// Desbotado largo (2 a 4 casas) e grão de papel.
	luz += (rz(p, 256.0, P, s + 5) - 0.5) * 0.07 + (rz(p, 128.0, P, s + 6) - 0.5) * 0.03;
	luz += (grao(p, P, s + 7) - 1.0) * 0.5;

	// A fresta entre as tábuas e a beira arredondada (um pouco mais escura).
	float fl = fresta_da_junta(tabua, sem);
	float fr = fresta_da_junta((tabua + 1) % TABUAS, sem);
	luz -= fl * (1.0 - smoothstep(0.15, 0.15 + 1.2 * aa, xl));
	luz -= fr * (1.0 - smoothstep(0.15, 0.15 + 1.2 * aa, xr));
	luz -= 0.025 * (1.0 - smoothstep(0.5, 3.0, min(xl, xr)));

	// A emenda de topo: o pedaço de cima apoia no de baixo; um risco escuro e uma sombra
	// curta embaixo dele (no pedaço de baixo), e a beira do pedaço de cima pega um pouco de luz.
	float risco = 1.0 - smoothstep(0.2, 0.2 + 1.1 * aa, min(abaixo, acima));
	luz -= 0.12 * risco;
	luz -= 0.05 * (1.0 - smoothstep(0.0, 3.5, acima)) * (1.0 - risco);
	luz += 0.025 * smoothstep(0.8, 1.4, abaixo) * (1.0 - smoothstep(1.4, 2.6, abaixo));

	// Devolve a média para 0,5 (fresta, beira e emenda escurecem em média).
	luz += 0.012;

	// O lado ao longo do beiral: a beira esquerda vira para -u, a direita para +u, e a
	// tábua inteira se inclina um pouco (empeno), cada uma para um lado.
	float lado = 0.75 * ((1.0 - smoothstep(0.4, 3.2, xr)) - (1.0 - smoothstep(0.4, 3.2, xl)));
	lado += (rnd(vec2(float(tabua), 51.0), sem + 18, 0) - 0.5) * 0.36;
	return vec2(valor_de(luz), clamp(lado, -1.0, 1.0));
}

#define TEM_FAIXA
// A cumeeira e o espigão: a tábua de capa (duas tábuas estreitas em V invertido sobre a
// emenda), em 3 pedaços de comprimento diferente por período de 384 px, com a sombra curta
// que ela deixa na água de cada lado.
vec3 pintar_faixa(vec2 q, float L, float meia, float px, int sem) {
	// As emendas da capa: 0, 118 e 262 px (pedaços de 118, 144 e 122).
	float x = q.x;
	float e0 = 0.0;
	float e1 = 118.0;
	float e2 = 262.0;
	float inicio = x < e1 ? e0 : (x < e2 ? e1 : e2);
	float final = x < e1 ? e1 : (x < e2 ? e2 : L);
	float peca = x < e1 ? 0.0 : (x < e2 ? 1.0 : 2.0);
	float noPedaco = x - inicio;
	float ateFim = final - x;

	float r = 4.3; // meia largura da capa
	float ay = abs(q.y);
	float d = ay - r;
	float capa = cobre(d, px);
	// A sombra da capa na água: 1,6 px além da beira, macia.
	float sombra = (1.0 - smoothstep(0.0, 1.6, d)) * (1.0 - capa);

	float luz = 0.03;
	luz += (rnd(vec2(peca, 7.0), sem + 9, 0) - 0.5) * 0.07;
	luz -= 0.06 * smoothstep(r - 1.4, r, ay); // a beira da capa
	luz -= 0.08 * (1.0 - smoothstep(0.0, 1.2, abs(q.y))) * 0.6; // o vinco do V
	// A emenda de topo da capa: risco escuro e sombra curta à frente.
	luz -= 0.12 * (1.0 - smoothstep(0.2, 1.3, min(noPedaco, ateFim)));
	luz -= 0.05 * (1.0 - smoothstep(0.0, 3.0, noPedaco));

	float valor = mix(0.5 - 0.16, valor_de(luz), capa);
	float alfa = max(capa, 0.45 * sombra);
	float lado = capa * clamp(q.y / 1.2, -1.0, 1.0) * 0.8;
	return vec3(valor, lado, alfa);
}

#include "res://comum/rodape_telhado.gdshaderinc"

// Pinheiros: o pinhal visto de cima. Lote 2 da onda 1.
// A base é o chão do pinhal entre as copas: o chão escuro da família (o
// chao-de-floresta), puxado para a cama de agulhas (mais marrom, na mesma luz), com
// manchas largas, poucas pinceladas e grão de papel. As copas moram no atlas, em
// células de 2 casas, e o app as espalha pelo mundo, afastadas umas das outras.
//
// Como o pinheiro se lê de cima (e se separa da Floresta no mapa):
// - a copa é uma forma em CAMADAS: três estrelas de pontas largas, uma por cima da
//   outra, cada uma menor e girada meia ponta (as pontas de cima caem nos vãos das de
//   baixo); a de cima joga uma sombra em crescente na de baixo, para baixo e para a
//   direita, e é isso que faz o degrau;
// - poucas pontas e largas (6 ou 7 na saia, base da ponta maior que a altura), cada
//   uma com altura e lugar próprios: nada de estrela de raio fino nem espinho em
//   fileira;
// - mais escura e mais fria que a copa redonda da Floresta (verde-azulado, um degrau
//   abaixo), copas um pouco menores e o chão aparecendo entre elas: a Floresta é um
//   dossel quase contínuo; o pinhal são árvores separadas.
//
// O que as rodadas de 28/10 ensinaram (folha a 25%, 50%, 100% e 300%):
// - copas de 1,5 casa com afastarCasas 0,9 ainda caíam uma por cima da outra; agora o
//   afastamento está no máximo (1 casa, meia célula) e a saia tem cerca de 1,4 casa: nos
//   bosques as copas só encostam pela ponta;
// - copa pequena (1,1 casa) num chão marrom claro virava sal e pimenta a 25%: o chão
//   ficou 14% mais escuro e o agrupamento foi a 1 (bosques fechados, clareiras abertas);
// - luz igual em toda a copa fazia estrela chapada de bala de goma: agora o cone inteiro
//   acende em cima à esquerda (+-11%) e cada camada de cima é 7% mais clara;
// - crescente de sombra estreito e duro virava um "sorriso" escuro em cada copa a 100%:
//   agora é largo e esfumado;
// - a conta polar perto do centro deixava um pontinho escuro no topo (corrigida).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta do Meio-Termo que não está na base (client/src/texturas/meioTermo/paleta.ts).
const vec3 LENHA = vec3(0.431, 0.341, 0.271);   // #6e5745 lenha
const vec3 ARDOSIA = vec3(0.373, 0.416, 0.400); // #5f6a66 ardósia

// O chão: o CHAO do chao-de-floresta (#375639) com um quarto de húmus, 14% mais escuro
// (a sombra do pinhal é mais fechada; mais claro, o chão marrom entre as copas virava
// sal e pimenta a 25%).
const vec3 CHAO_PIN = vec3(0.205, 0.275, 0.190);
// Úmido: o chão 5% mais escuro e um pouco mais frio.
const vec3 CHAO_PIN_UMIDO = vec3(0.190, 0.262, 0.186);
// Cama de agulhas: húmus com um terço de lenha, na mesma luz do chão (só o matiz esquenta).
const vec3 AGULHADA = vec3(0.290, 0.255, 0.190);

// Os tons da copa: a folha escura do Meio-Termo um degrau abaixo da copa da Floresta
// (COPA_MEIO #408d5d) e puxada para o azul (matiz 154 contra 143; com 160 a copa
// virava turquesa a 100%), com a saturação da FOLHA (0,5): mais escura e mais fria.
const vec3 PIN_LUZ = vec3(0.272, 0.505, 0.400);
const vec3 PIN_MEIO = vec3(0.192, 0.388, 0.300);
const vec3 PIN_SOMBRA = vec3(0.136, 0.284, 0.222);
// O contorno: o meio a 54% da luz (mais escuro que o chão, para a copa se destacar dele).
const vec3 PIN_CONTORNO = vec3(0.100, 0.205, 0.163);

// ---------- base: o chão do pinhal ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (4 casas), do úmido ao seco.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(CHAO_PIN_UMIDO, CHAO_PIN, t);
	// 2. Cama de agulhas: manchas de 3 a 4 casas, mais quentes, na mesma luz.
	//    Ruído de 128 px com um pouco do de 256 px (como no chao-de-floresta: o de 256 px
	//    sozinho deixa as manchas numa grade de 8 casas).
	float h = rz(p + vec2(70.0, 140.0), 128.0, P, s + 3) * 0.7 + rz(p, 256.0, P, s + 4) * 0.3;
	c = mix(c, AGULHADA, 0.55 * smoothstep(0.42, 0.76, h));
	// 3. Relevo macio de meia casa e de 1/4 de casa: o close a 300% não fica liso.
	c *= 1.0 + 0.04 * (fz(p, 32.0, P, s + 6, 2) - 0.5) + 0.02 * (rz(p, 16.0, P, s + 8) - 0.5);
	if (qual == 1) {
		c = mix(c, AGULHADA, 0.06);
	} else if (qual == 2) {
		c *= vec3(0.985, 0.995, 1.01);
	}
	// 4. Pinceladas largas, uma por meia casa, todas na mesma direção.
	c *= 1.0 + 0.035 * pinceladas(p, P, px, s + 5, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 7);
	return c;
}

// ---------- copas de pinheiro ----------

// O raio da saia (a camada de baixo) da copa i, em px do mundo; a célula vai de -64 a 64.
float raio_copa(int i) {
	return i == 0 ? 45.0 : (i == 1 ? 43.0 : (i == 2 ? 46.0 : 42.0));
}

// Quantas pontas a camada t (0 = saia, 1 = meio, 2 = topo) da copa i tem.
int pontas(int i, int t) {
	int saia = (i == 0 || i == 2) ? 8 : 7;
	return t == 0 ? saia : (t == 1 ? saia - 1 : 5);
}

// O tamanho da camada t, em raios da saia.
float tamanho_camada(int t) {
	return t == 0 ? 1.0 : (t == 1 ? 0.64 : 0.34);
}

// A profundidade das pontas da camada t, em raios dela.
float fundo_camada(int t) {
	return t == 0 ? 0.22 : (t == 1 ? 0.22 : 0.2);
}

// O centro da camada t: cada uma um pouco acima e à esquerda da de baixo (o lado da
// luz), para o degrau da sombra aparecer embaixo à direita.
vec2 centro_camada(int i, int t) {
	uint h = hash_cel(vec2(float(i), float(t) + 20.0), 1511);
	vec2 sacode = (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.04;
	return (LUZ * 0.035 * float(t) + sacode * float(min(t, 1))) * raio_copa(i);
}

// O raio da estrela no ângulo a. Cada ponta é um triângulo largo de pé redondo, com o
// bico em lugar e altura próprios: a estrela não fica regular (carimbo) nem fina.
float raio_estrela(float a, float R, float fundo, int n, float giro, int sem) {
	float u = fract((a - giro) / TAU) * float(n);
	float k = floor(u);
	float f = u - k;
	uint h = hash_cel(vec2(k, 0.0), sem);
	float bico = 0.32 + 0.36 * rk(h, 0);
	float alto = 0.7 + 0.45 * rk(h, 1);
	float w = f < bico ? f / bico : (1.0 - f) / (1.0 - bico);
	w = pow(w, 1.5);
	return R * (1.0 - fundo + fundo * alto * w);
}

// Distância (negativa dentro) à camada t da copa i, em px do mundo, em v = ponto menos o
// centro da camada. A conta polar é corrigida pela inclinação da borda, para o
// contorno e o antisserrilhado terem a mesma espessura na ponta e no vão.
float sd_camada(int i, int t, vec2 v) {
	float R = raio_copa(i) * tamanho_camada(t);
	float fundo = fundo_camada(t);
	int n = pontas(i, t);
	int sem = 1500 + i * 31 + t * 7;
	float giro = TAU * rk(hash_cel(vec2(float(i), float(t)), 1503), 0);
	// Meia ponta girada em relação à camada de baixo, com um pouco de folga.
	if (t > 0) {
		float giro_baixo = TAU * rk(hash_cel(vec2(float(i), float(t - 1)), 1503), 0);
		giro = giro_baixo + TAU * (0.5 + 0.2 * (rk(hash_cel(vec2(float(i), float(t)), 1505), 0) - 0.5)) / float(n);
	}
	float rho = length(v);
	float a = atan(v.y, v.x);
	float e = 0.015;
	float r = raio_estrela(a, R, fundo, n, giro, sem);
	float dr = (raio_estrela(a + e, R, fundo, n, giro, sem) - raio_estrela(a - e, R, fundo, n, giro, sem)) / (2.0 * e);
	// Perto do centro a inclinação explode (rho -> 0) e a distância encolhia para quase
	// zero: virava um pontinho escuro no topo. A correção só vale perto da borda.
	float incl = dr / max(rho, 0.6 * r);
	return (rho - r) / sqrt(1.0 + incl * incl);
}

// A faceta do galho no ângulo a: cada ponta é um galho com a quina no meio; o lado
// virado para a luz clareia e o outro escurece (-1..1), com a quina e o vão macios.
float faceta(int i, int t, float a) {
	int n = pontas(i, t);
	int sem = 1500 + i * 31 + t * 7;
	float giro = TAU * rk(hash_cel(vec2(float(i), float(t)), 1503), 0);
	if (t > 0) {
		float giro_baixo = TAU * rk(hash_cel(vec2(float(i), float(t - 1)), 1503), 0);
		giro = giro_baixo + TAU * (0.5 + 0.2 * (rk(hash_cel(vec2(float(i), float(t)), 1505), 0) - 0.5)) / float(n);
	}
	float u = fract((a - giro) / TAU) * float(n);
	float k = floor(u);
	float f = u - k;
	float bico = 0.32 + 0.36 * rk(hash_cel(vec2(k, 0.0), sem), 0);
	// A direção do galho e os dois flancos dele (para fora e para os lados).
	float eixo = giro + TAU * (k + bico) / float(n);
	vec2 fora = vec2(cos(eixo), sin(eixo));
	vec2 lado = vec2(-fora.y, fora.x);
	// Quina larga (+-0,2 da ponta): com +-0,1 a copa lia como papel dobrado a 300%.
	float s = smoothstep(-0.2, 0.2, f - bico) * 2.0 - 1.0;
	// No vão os dois flancos vizinhos se encontram: amacia para o vão não riscar.
	float vao = smoothstep(0.0, 0.12, f) * smoothstep(0.0, 0.12, 1.0 - f);
	return dot(normalize(fora * 0.55 + lado * s * 0.85), LUZ) * vao;
}

// Os três tons da copa i: luz, meio e sombra. Diferença pequena entre as quatro (o app
// sorteia a copa por célula; espécies muito diferentes viram sal e pimenta a 50%).
vec3 tom_copa(int i, int qual_tom) {
	vec3 luz = PIN_LUZ;
	vec3 meio = PIN_MEIO;
	vec3 sombra = PIN_SOMBRA;
	if (i == 1) {
		luz = mix(PIN_LUZ, PIN_MEIO, 0.25);
		meio = PIN_MEIO * 0.96;
		sombra = PIN_SOMBRA * 0.95;
	} else if (i == 2) {
		luz = mix(PIN_LUZ, ARDOSIA * 1.15, 0.12);
		meio = mix(PIN_MEIO, ARDOSIA * 0.95, 0.12);
		sombra = mix(PIN_SOMBRA, ARDOSIA * 0.72, 0.12);
	} else if (i == 3) {
		luz = mix(PIN_LUZ, FOLHA_ESCURA, 0.15);
		meio = mix(PIN_MEIO, FOLHA_ESCURA * 0.8, 0.12);
	}
	return qual_tom == 0 ? luz : (qual_tom == 1 ? meio : sombra);
}

// A cor de uma camada: o lado de cima à esquerda na luz, o de baixo à direita na
// sombra (pela direção a partir do centro dela, como num cone); cada camada de cima um
// pouco mais clara, porque está mais perto do sol.
vec3 cor_camada(int i, int t, vec2 v, float mancha) {
	float R = raio_copa(i) * tamanho_camada(t);
	float rho = length(v);
	vec2 dir = v / max(rho, 1e-3);
	float perto = smoothstep(0.0, 0.45 * R, rho);
	float g = dot(dir, LUZ) * perto + mancha;
	vec3 c = mix(tom_copa(i, 2), tom_copa(i, 1), smoothstep(-0.85, 0.05, g));
	c = mix(c, tom_copa(i, 0), 0.85 * smoothstep(0.05, 0.85, g));
	c *= 1.0 + 0.06 * faceta(i, t, atan(v.y, v.x)) * perto;
	return c * (1.0 + 0.07 * float(t));
}

vec4 copa(int i, vec2 q, float px) {
	int sl = 1600 + i * 37;
	vec2 q0 = q + vec2(64.0);
	// A borda de fora ondula +-0,6 px numa escala de 16 px: mão de pintura.
	float onda = (rz(q0, 16.0, 256.0, sl) - 0.5) * 1.2;
	vec2 c0 = centro_camada(i, 0);
	vec2 c1 = centro_camada(i, 1);
	vec2 c2 = centro_camada(i, 2);
	float d0 = sd_camada(i, 0, q - c0) + onda;
	vec4 acc = vec4(0.0);

	// 1. Sombra no chão, para baixo e para a direita (4 e 5 px: o pinheiro é alto),
	//    borda esfumada, alfa 0,26.
	float ds = sd_camada(i, 0, q - c0 - vec2(4.0, 5.0)) + onda;
	acc = sobre(acc, SOMBRA_VERDE, (1.0 - smoothstep(-3.0, 5.0, ds)) * 0.26);
	// Uma faixa do chão em volta da copa (até 4 px): em cima de outra copa, abre um vão.
	acc = sobre(acc, CHAO_PIN * 0.9, (1.0 - smoothstep(1.0, 4.0, d0)) * 0.5);

	// 2. Contorno da saia: mais fino do lado da luz (1,3 px), mais grosso do da sombra (2 px).
	vec2 dir = q / max(length(q), 1e-3);
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	float esp = mix(1.3, 2.0, lado_sombra);
	vec3 c_traco = mix(mix(PIN_CONTORNO, tom_copa(i, 1), 0.55), PIN_CONTORNO, smoothstep(0.3, 0.8, lado_sombra));
	acc = sobre(acc, c_traco, cobre(d0, px));

	// 3. As camadas, de baixo para cima. Antes de cada uma, a sombra dela na de baixo.
	float mancha = (rz(q0, 32.0, 256.0, sl + 3) - 0.5) * 0.3;
	vec3 c = cor_camada(i, 0, q - c0, mancha);
	float d1 = sd_camada(i, 1, q - c1);
	// O crescente de sombra sob a camada de cima: largo e esfumado, é o degrau que faz o
	// pinheiro ler em camadas a 100%. Com 2,5 px sumia; com 4 px e borda dura virava um
	// traço curvo escuro (um "sorriso" em cada copa): agora é sombra, de 0 a 9 px.
	float d1s = sd_camada(i, 1, q - c1 - vec2(4.5, 6.0));
	c = mix(c, tom_copa(i, 2) * 0.8, (1.0 - smoothstep(-6.0, 3.0, d1s)) * 0.6);
	c = mix(c, cor_camada(i, 1, q - c1, mancha), cobre(d1, max(px, 1.1)));
	float d2 = sd_camada(i, 2, q - c2);
	float d2s = sd_camada(i, 2, q - c2 - vec2(3.0, 4.0));
	c = mix(c, tom_copa(i, 2) * 0.84, (1.0 - smoothstep(-4.5, 2.5, d2s)) * 0.5);
	c = mix(c, cor_camada(i, 2, q - c2, mancha), cobre(d2, max(px, 1.1)));

	// 4. A luz da copa inteira: o cone acende em cima à esquerda e escurece embaixo à
	//    direita (+-11%), por cima das camadas. Sem isso cada pinheiro era uma estrela
	//    chapada, de luz igual em toda parte.
	float R0 = raio_copa(i);
	float lado = clamp(dot((q - c0) / R0, LUZ), -1.0, 1.0);
	c *= 1.0 + 0.11 * lado;
	// Um realce só, largo e esfumado, no lado da luz do topo (o bico do cone pega sol).
	float dh = length(q - c2 - LUZ * 0.22 * R0) - 0.16 * R0;
	c = mix(c, realce_de(tom_copa(i, 0)), (1.0 - smoothstep(-4.0, 7.0, dh)) * 0.22);

	// 5. A mão de pintura: pinceladas largas na mesma direção e um grão bem leve.
	c *= 1.0 + 0.03 * pinceladas(q0 + vec2(float(i) * 128.0, 0.0), 512.0, px, sl + 5, 32.0, -1.2, 0.5);
	c *= 1.0 + (grao(q0, 256.0, sl + 11) - 1.0) * 0.6;
	acc = sobre(acc, c, cobre(d0 + esp, px));

	// A célula termina transparente (4 px de folga), aconteça o que acontecer com a sombra.
	float borda = 1.0 - smoothstep(58.0, 61.0, max(abs(q.x), abs(q.y)));
	return acc * borda;
}

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	vec4 acc = copa(i, q, px);
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

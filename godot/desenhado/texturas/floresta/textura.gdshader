// Floresta: mata fechada vista de cima.
// A base é a sombra da mata entre as copas (manchas largas, poucas pinceladas, grão
// de papel). As copas moram no atlas, em células de 2 casas, e o app as espalha pelo
// mundo; elas se encostam e se cobrem (as de baixo por cima), e é isso que faz a mata.
//
// Regra do usuário (28/10, a crítica que criou o ESTILO.md): copa é forma grande e
// calma. Aqui cada copa é UMA massa redonda de borda ondulada e irregular (como a
// árvore do Meio-Termo), com a luz em três degraus largos que repetem a borda: o
// crescente de sombra embaixo à direita, o meio e o domo do topo, mais um realce
// esfumado só no topo e o contorno da própria folha escurecida. Nada de escama,
// bolinha ou pontilhado dentro da copa.
//
// O que as rodadas ensinaram (folha a 50%, 100% e 300%):
// - cada lobo pintado como esfera fez a copa ler como cacho de bolinhas;
// - 3 ou 4 lobos fundos na silhueta viraram trevo, e 5 ondas iguais viraram estrela
//   (carimbos que o olho acha); as ondas agora variam de tamanho, alcance e ângulo;
// - pedido do usuário (28/10, sobre a folha do lote 1): "tem muita árvore em cima de
//   outra árvore". As copas caíram de 2 a 2,6 para 1,3 a 1,8 casas, a densidade baixou
//   e cada copa leva uma faixa do chão da mata em volta, que abre um vão escuro quando
//   duas caem perto. O espalhamento do contrato (1 ponto livre por célula de 1 casa)
//   não garante distância mínima: ainda sai um par empilhado aqui e ali;
// - pincelada de 1/4 de casa dentro da copa virou pontilhado a 50% (saiu);
// - ruído miúdo na borda de uma faixa lisa deixava ilhotas de luz (bolinhas a 300%).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Musgo da paleta do Meio-Termo (client/src/texturas/meioTermo/paleta.ts: #6f7d4b).
const vec3 MUSGO_MT = vec3(0.435, 0.490, 0.294);
// A sombra da mata: o contorno da folha um pouco mais escuro (a luz mal chega aqui).
const vec3 CHAO_MATA = vec3(0.190, 0.400, 0.268);
// Os tons da copa: a folha do Meio-Termo um degrau mais funda, porque a mata é uma
// área grande e escura no mapa (o Atual é #177c5c), não uma árvore solta na vila.
const vec3 COPA_LUZ = vec3(0.304, 0.643, 0.422);    // entre FOLHA_ESCURA e FOLHA
const vec3 COPA_MEIO = vec3(0.251, 0.554, 0.365);   // FOLHA_ESCURA puxada 40% para FOLHA_SOMBRA
const vec3 COPA_SOMBRA = vec3(0.194, 0.432, 0.297); // FOLHA_SOMBRA a 90%

// ---------- base: a sombra da mata ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.6 + n_m * 0.4);
	// De -7% a +7% de luz em volta do chão da mata.
	vec3 c = mix(CHAO_MATA * 0.93, mix(CHAO_MATA, FOLHA_SOMBRA, 0.38), t);
	// Manchas de musgo, largas e raras, na mesma luz do chão (só o matiz esquenta).
	float m = smoothstep(0.58, 0.8, rz(p + vec2(90.0, 30.0), 128.0, P, s + 3));
	c = mix(c, MUSGO_MT * 0.78, 0.2 * m);
	if (qual == 1) {
		c = mix(c, MUSGO_MT * 0.76, 0.08);
	} else if (qual == 2) {
		c *= vec3(0.97, 0.99, 1.01);
	}
	// Pinceladas largas, uma por meia casa, todas na mesma direção: o chão não fica
	// liso a 300% e não vira listra.
	c *= 1.0 + 0.04 * pinceladas(p, P, px, s + 5, 32.0, -1.2, 0.5);
	c *= grao(p, P, s + 7);
	return c;
}

// ---------- copas ----------

// União suave: as bordas se juntam sem bico.
float uniao_suave(float a, float b, float k) {
	float h = max(k - abs(a - b), 0.0) / k;
	return min(a, b) - h * h * k * 0.25;
}

// O raio da copa i (px do mundo; a célula vai de -64 a 64).
float raio_copa(int i) {
	return i == 0 ? 49.0 : (i == 1 ? 46.0 : (i == 2 ? 48.0 : 45.0));
}

// Quantas ondas a borda da copa i tem (rasas: é o contorno da folhagem, não lobo).
int ondas_copa(int i) {
	return i == 0 ? 7 : (i == 1 ? 6 : (i == 2 ? 7 : 6));
}

// A silhueta da copa i (negativa dentro): um miolo redondo e ondas rasas na borda,
// de tamanho e lugar sorteados (borda irregular, sem simetria de trevo). "suave" é a
// união das ondas, em raios da copa: alto, a forma vira um contorno liso (para a
// faixa de luz do topo, que encolhida não pode se partir em bolinhas).
float sd_copa(int i, vec2 q, float suave) {
	float R = raio_copa(i);
	float d = length(q - vec2(-0.02, -0.02) * R) - 0.66 * R;
	int n = ondas_copa(i);
	float giro = TAU * rk(hash_cel(vec2(float(i), 3.0), 1311), 0);
	for (int k = 0; k < 8; k++) {
		if (k >= n) {
			break;
		}
		uint h = hash_cel(vec2(float(i), float(k) + 60.0), 1313);
		float a = giro + TAU * (float(k) + 0.8 * (rk(h, 0) - 0.5)) / float(n);
		float rb = R * (0.22 + 0.24 * rk(h, 1));
		float alcance = R * (0.82 + 0.16 * rk(h, 2));
		vec2 c = vec2(cos(a), sin(a) * 0.94) * (alcance - rb);
		d = uniao_suave(d, length(q - c) - rb, suave * R);
	}
	return d;
}

// O topo da copa i, onde mora o realce: centro em xy, raio em z, um pouco acima e à
// esquerda do meio (o lado da luz).
vec3 topo_copa(int i) {
	float R = raio_copa(i);
	uint h = hash_cel(vec2(float(i), 80.0), 1317);
	return vec3(vec2(-0.14, -0.16) * R + (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.1 * R, R * (0.5 + 0.05 * rk(h, 2)));
}

// Os três tons da copa i: luz, meio e sombra. A folha das copas 0 e 2, uma espécie um
// pouco mais fechada (1) e uma um pouco mais quente, puxada para o musgo (3). A
// diferença é pequena de propósito: o app sorteia a copa por célula, e espécies muito
// diferentes viravam sal e pimenta a 50%.
vec3 tom_copa(int i, int qual_tom) {
	vec3 luz = COPA_LUZ;
	vec3 meio = COPA_MEIO;
	vec3 sombra = COPA_SOMBRA;
	if (i == 1) {
		luz = mix(COPA_LUZ, COPA_MEIO, 0.3);
		meio = mix(COPA_MEIO, COPA_SOMBRA, 0.2);
		sombra = COPA_SOMBRA * 0.95;
	} else if (i == 3) {
		luz = mix(COPA_LUZ, GRAMA_QUENTE * 0.8, 0.18);
		meio = mix(COPA_MEIO, MUSGO_MT, 0.18);
		sombra = mix(COPA_SOMBRA, MUSGO_MT * 0.78, 0.18);
	}
	return qual_tom == 0 ? luz : (qual_tom == 1 ? meio : sombra);
}

vec4 copa(int i, vec2 q, float px) {
	float R = raio_copa(i);
	int sl = 1400 + i * 37;
	vec2 q0 = q + vec2(64.0);
	// A borda ondula +-0,8 px numa escala de 16 px: mão de pintura, sem recorte de folhinha.
	float onda = (rz(q0, 16.0, 256.0, sl) - 0.5) * 1.6 + (rz(q0, 8.0, 256.0, sl + 21) - 0.5) * 1.0;
	float onda_luz = (rz(q0, 16.0, 256.0, sl + 9) - 0.5) * 2.0;
	float d = sd_copa(i, q, 0.12) + onda;
	vec4 acc = vec4(0.0);

	// 1. Sombra no chão: para baixo e para a direita (3 a 4 px, não 1 a 2 como o
	//    ESTILO.md pede para seixo e tufo: a copa é alta, e com 1 a 2 px a sombra sumia
	//    no chão escuro), borda esfumada, alfa 0,24; e um halo leve em volta, que
	//    escurece a copa de trás junto desta (dá a profundidade da mata).
	float ds = sd_copa(i, q - vec2(3.0, 4.0), 0.12) + onda;
	float a_sombra = (1.0 - smoothstep(-3.0, 4.0, ds)) * 0.24;
	acc = sobre(acc, SOMBRA_VERDE, a_sombra);
	// Uma faixa do chão da mata em volta da copa (até 5 px). Em cima do chão ela quase
	// não aparece (é a cor dele); em cima da copa de trás, abre um vão escuro entre as
	// duas, e cada copa lê como uma árvore só, mesmo quando o app joga duas perto.
	float a_vao = (1.0 - smoothstep(1.0, 5.0, d)) * 0.55;
	acc = sobre(acc, CHAO_MATA * 0.9, a_vao);

	// 2. Contorno: a folha escurecida, mais fino do lado da luz (1,3 px) e mais
	//    grosso do lado da sombra (2 px).
	vec2 dir = q / max(length(q), 1e-3);
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	float esp = mix(1.3, 2.0, lado_sombra);
	// Do lado da luz o traço puxa para o tom do meio: a copa da frente não risca uma
	// linha escura em cima da de trás (era isso que fazia escama na mata).
	vec3 c_traco = mix(mix(FOLHA_CONTORNO, tom_copa(i, 1), 0.7), FOLHA_CONTORNO, smoothstep(0.3, 0.8, lado_sombra));
	acc = sobre(acc, c_traco, cobre(d, px));

	// 3. Corpo: o tom do meio, que cai para a sombra embaixo à direita da copa.
	float g = dot(q / R, LUZ);
	float mancha = (rz(q0, 32.0, 256.0, sl + 3) - 0.5) * 0.4;
	vec3 c_luz = tom_copa(i, 0);
	vec3 c_meio = tom_copa(i, 1);
	vec3 c_sombra = tom_copa(i, 2);
	vec3 c = mix(c_sombra, mix(c_sombra, c_meio, 0.7), smoothstep(-0.95, 0.15, g + mancha));

	// 4. Luz em duas faixas. A primeira é a própria silhueta puxada para a luz e
	//    encolhida: deixa o crescente de sombra embaixo à direita, com a borda que
	//    repete as ondas da copa. A segunda acende o topo.
	float dl = sd_copa(i, q - LUZ * 0.15 * R, 0.12) + 0.06 * R + onda_luz;
	float a_luz = 1.0 - smoothstep(-1.4, 1.4, dl);
	vec3 c_clara = mix(c_meio, c_luz, 0.15 + 0.25 * smoothstep(-0.6, 0.6, g + mancha * 0.6));
	c = mix(c, c_clara, a_luz);
	// O topo é um domo de borda ondulada pelo ângulo (sem ruído miúdo: o ruído na borda
	// de uma forma lisa deixava ilhotas de luz, bolinhas a 300%).
	vec2 qt = q - vec2(-0.02, -0.02) * R - LUZ * 0.3 * R;
	float ang_t = atan(qt.y, qt.x);
	float fase_t = TAU * rk(hash_cel(vec2(float(i), 9.0), 1321), 0);
	float raio_t = 0.6 * R * (1.0 + 0.07 * sin(3.0 * ang_t + fase_t) + 0.05 * sin(5.0 * ang_t - 1.7 * fase_t));
	float dt = length(qt) - raio_t;
	float a_topo = (1.0 - smoothstep(-2.0, 2.0, dt)) * a_luz;
	c = mix(c, mix(c_luz, realce_de(c_luz), 0.25 * smoothstep(0.0, 0.8, g + mancha)), a_topo);

	// 5. Realce: um só, largo e esfumado, no topo da copa, puxado para a luz.
	vec3 m0 = topo_copa(i);
	float dh = length(q - m0.xy - LUZ * 0.3 * m0.z) - m0.z * 0.5 + onda_luz;
	float a_realce = (1.0 - smoothstep(-6.0, 8.0, dh)) * 0.3 * a_topo;
	c = mix(c, realce_de(c_luz), a_realce);

	// 6. A mão de pintura: pinceladas largas na mesma direção e um grão bem leve.
	c *= 1.0 + 0.03 * pinceladas(q0 + vec2(float(i) * 128.0, 0.0), 512.0, px, sl + 5, 32.0, -1.2, 0.5);
	c *= 1.0 + (grao(q0, 256.0, sl + 11) - 1.0) * 0.6;
	acc = sobre(acc, c, cobre(d + esp, px));

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

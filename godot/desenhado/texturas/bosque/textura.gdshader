// Bosque: mata aberta vista de cima, a irmã clara da Floresta.
// A Floresta é copa clara em cima de chão escuro, quase fechada. O Bosque é o contrário:
// relva de sub-bosque clara (a grama aprovada a meia sombra) e copas soltas em grupos,
// mais escuras que o chão, cada uma com a sombra projetada na relva. O mestre escolhe
// um ou outro pela leitura a 25%: tapete de copas (Floresta) ou campo com árvores (Bosque).
//
// Regras do usuário que valem aqui: copa é forma grande e calma (nada de escama,
// bolinha ou pontilhado: ESTILO.md seção 1) e nenhuma copa em cima de outra (crítica à
// Floresta, 28/10). As copas moram no atlas (células de 2 casas); o config.json liga
// detalhes.afastarCasas no máximo (1 casa) e a densidade é baixa, então nos grupos as
// copas só se encostam na beira e entre os grupos a relva aparece.
//
// O que as rodadas ensinaram (folha a 25%, 50%, 100% e 300%):
// - 4 ou 5 lobos largos em volta de um miolo viraram pentágono de bala de goma;
// - massas lisas sem borda de folhagem viraram seixo ou célula de microscópio: a borda
//   agora é um festão de 7 a 9 arcos rasos e desiguais, e o crescente de sombra de
//   dentro repete o festão (lê folhagem sem pintar folha);
// - copa redonda de 2 massas lia como ervilha a 25%: agora são 3 massas, a copa sai
//   torta, cada uma do atlas para um lado;
// - copa de quase 2 casas com o afastamento no máximo (1 casa) ainda caía meio em cima
//   da vizinha (o espalhamento do contrato tem 1 ponto por casa): a copa ficou entre 1 e
//   1,45 casa. Na simulação do espalhamento (hash e ruído do app, semente 31), nenhuma
//   copa tem vizinha a menos de 0,6 da soma dos raios, e 1% a menos de 0,7; na Floresta
//   aprovada, 55% estão abaixo de 0,6. A cobertura é 0,24, contra 0,73 da Floresta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Musgo da paleta do Meio-Termo (client/src/texturas/meioTermo/paleta.ts: #6f7d4b).
const vec3 MUSGO_MT = vec3(0.435, 0.490, 0.294);
// Relva de sub-bosque: a GRAMA (#8cbf80) a meia sombra, 35% para GRAMA_SOMBRA e um
// pouco para GRAMA_FRIA. Casa com o Campo verde aprovado, um degrau mais fundo.
const vec3 RELVA = vec3(0.512, 0.718, 0.474);
const vec3 RELVA_LUZ = vec3(0.583, 0.769, 0.530);    // GRAMA 40% para GRAMA_REALCE
const vec3 RELVA_SOMBRA = vec3(0.449, 0.655, 0.414); // GRAMA_SOMBRA a 97%
// A sombra que a árvore joga na relva (px do mundo, para baixo e para a direita).
const vec2 SOMBRA_DESLOCA = vec2(7.0, 9.0);

// ---------- base: a relva entre as copas ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = fz(p, 128.0, P, s + 2, 2);
	float t = smoothstep(0.22, 0.78, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(RELVA, mix(RELVA_SOMBRA, RELVA_LUZ, t), 0.55);
	// Manchas de musgo e folha velha, largas e raras, quase na luz da relva.
	float m = smoothstep(0.6, 0.82, rz(p + vec2(70.0, 140.0), 128.0, P, s + 3));
	c = mix(c, mix(RELVA_SOMBRA, MUSGO_MT * 1.2, 0.4), 0.16 * m);
	if (qual == 1) {
		c = mix(c, GRAMA_QUENTE * 0.95, 0.12);
	} else if (qual == 2) {
		c = mix(c, GRAMA_FRIA, 0.1) * 0.99;
	}
	// Uma pincelada larga por casa, todas na mesma direção (como o Campo verde).
	c *= 1.0 + 0.022 * pinceladas(p, P, px, s + 5, 64.0, -1.2, 0.5);
	c *= grao(p, P, s + 7);
	return c;
}

// ---------- copas ----------

// União suave: as bordas se juntam sem bico.
float uniao_suave(float a, float b, float k) {
	float h = max(k - abs(a - b), 0.0) / k;
	return min(a, b) - h * h * k * 0.25;
}

// O tamanho da copa i (px do mundo antes da escala; a célula vai de -64 a 64; a borda
// fica em média a 0,8 R e no máximo a 0,95 R, e a sombra cabe nos 4 px de folga): duas
// árvores grandes, uma média e uma nova, para o bosque não ser um carimbo do mesmo
// tamanho. O config.json escala de 1,05 a 1,3 no mundo.
float raio_copa(int i) {
	return i == 0 ? 44.0 : (i == 1 ? 42.0 : (i == 2 ? 40.0 : 37.0));
}

// Quantos festões a folhagem da copa i tem na borda.
float festoes_copa(int i) {
	return i == 0 ? 9.0 : (i == 1 ? 9.0 : (i == 2 ? 8.0 : 7.0));
}

// As três massas do corpo da copa i: xy = centro, z = raio. A 0 é a grande, quase no
// meio; a 1 e a 2 são menores e saem para lados sorteados (de 120 a 170 graus uma da
// outra): a copa fica torta, como uma folhosa crescida no aberto, e não um círculo
// de compasso (a rodada 4 tinha 2 massas e lia como ervilha a 25%).
vec3 massa_copa(int i, int k) {
	float R = raio_copa(i);
	uint h = hash_cel(vec2(float(i), 40.0 + float(k)), 2333);
	if (k == 0) {
		return vec3((vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.1 * R, 0.68 * R);
	}
	float a = TAU * rk(hash_cel(vec2(float(i), 41.0), 2333), 0);
	if (k == 2) {
		a += 2.1 + 0.85 * rk(h, 0);
		return vec3(vec2(cos(a), sin(a)) * (0.4 + 0.06 * rk(h, 1)) * R, 0.4 * R);
	}
	return vec3(vec2(cos(a), sin(a)) * (0.33 + 0.05 * rk(h, 1)) * R, 0.5 * R);
}

// O festão da folhagem: a borda é uma fila de arcos rasos (de 3 a 5 px) com a ponta para
// dentro entre um e outro, de largura e altura desiguais (o ângulo é torcido e cada arco
// sorteia a altura), para não virar estrela nem flor de pétalas iguais.
float festao(int i, vec2 q) {
	float R = raio_copa(i);
	float n = festoes_copa(i);
	uint h = hash_cel(vec2(float(i), 5.0), 2341);
	float fase = TAU * rk(h, 0);
	float ang = atan(q.y, q.x);
	float a = ang + 0.24 * sin(2.0 * ang + fase) + 0.12 * sin(3.0 * ang - 1.3 * fase);
	float t = a / TAU * n + rk(h, 1);
	float k = floor(t);
	float f = t - k;
	float alto = 0.062 * R * (0.55 + 0.9 * rk(hash_cel(vec2(float(i), mod(k, n)), 2343), 0));
	return alto * sqrt(max(1.0 - (2.0 * f - 1.0) * (2.0 * f - 1.0), 0.0));
}

// A silhueta da copa i (negativa dentro): as três massas fundidas e o festão.
float sd_copa(int i, vec2 q) {
	float R = raio_copa(i);
	vec3 m0 = massa_copa(i, 0);
	vec3 m1 = massa_copa(i, 1);
	vec3 m2 = massa_copa(i, 2);
	float d = uniao_suave(length(q - m0.xy) - m0.z, length(q - m1.xy) - m1.z, 0.36 * R);
	d = uniao_suave(d, length(q - m2.xy) - m2.z, 0.36 * R);
	return d - festao(i, q);
}

// Os três tons da copa i: luz, meio e sombra. Folhosa de verão, mais quente e mais
// clara que a mata da Floresta: 0 e 2 a folha do Meio-Termo puxada para o amarelo,
// 1 um pouco mais fechada, 3 a árvore nova, a mais clara.
vec3 tom_copa(int i, int qual_tom) {
	vec3 luz = vec3(0.403, 0.700, 0.458);    // FOLHA 22% para GRAMA_QUENTE
	vec3 meio = vec3(0.317, 0.611, 0.390);   // FOLHA_ESCURA 15% para GRAMA_QUENTE a 85%
	vec3 sombra = vec3(0.231, 0.469, 0.318); // FOLHA_SOMBRA 12% para o musgo
	if (i == 1) {
		luz = vec3(0.360, 0.680, 0.447);
		meio = vec3(0.289, 0.592, 0.382);
		sombra = vec3(0.218, 0.463, 0.316);
	} else if (i == 3) {
		luz = vec3(0.444, 0.711, 0.460);
		meio = vec3(0.357, 0.639, 0.406);
		sombra = vec3(0.259, 0.482, 0.323);
	}
	return qual_tom == 0 ? luz : (qual_tom == 1 ? meio : sombra);
}

vec4 copa(int i, vec2 q, float px) {
	float R = raio_copa(i);
	int sl = 2400 + i * 37;
	vec2 q0 = q + vec2(64.0);
	// Além do festão, a borda ondula +-0,8 px numa escala de 16 px: mão de pintura.
	float onda = (rz(q0, 16.0, 256.0, sl) - 0.5) * 1.6 + (rz(q0, 8.0, 256.0, sl + 21) - 0.5) * 0.8;
	float onda_luz = (rz(q0, 16.0, 256.0, sl + 9) - 0.5) * 2.0;
	float d = sd_copa(i, q) + onda;
	vec4 acc = vec4(0.0);

	// 1. Sombra na relva, para baixo e para a direita (é ela que diz "árvore solta no
	//    campo"), borda esfumada; e um halo leve de contato em volta, que escurece a
	//    beira da copa vizinha quando duas se encostam. As duas juntas: alfa até 0,22.
	float ds = sd_copa(i, q - SOMBRA_DESLOCA) + onda;
	float a_sombra = (1.0 - smoothstep(-4.0, 4.0, ds)) * 0.22;
	float a_halo = (1.0 - smoothstep(0.0, 4.0, d)) * 0.12;
	acc = sobre(acc, SOMBRA_VERDE, max(a_sombra, a_halo));

	// 2. Contorno: a folha escurecida, mais fino do lado da luz e mais grosso do da sombra.
	vec2 dir = q / max(length(q), 1e-3);
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	float esp = mix(1.4, 2.0, lado_sombra);
	vec3 c_traco = mix(mix(FOLHA_CONTORNO, tom_copa(i, 1), 0.55), FOLHA_CONTORNO * 0.95, smoothstep(0.3, 0.8, lado_sombra));
	acc = sobre(acc, c_traco, cobre(d, px));

	// 3. Corpo: o tom do meio, que cai para a sombra embaixo à direita.
	float g = dot(q / R, LUZ);
	float mancha = (rz(q0, 32.0, 256.0, sl + 3) - 0.5) * 0.4;
	vec3 c_luz = tom_copa(i, 0);
	vec3 c_meio = tom_copa(i, 1);
	vec3 c_sombra = tom_copa(i, 2);
	vec3 c = mix(c_sombra, mix(c_sombra, c_meio, 0.75), smoothstep(-0.95, 0.15, g + mancha));

	// 4. Luz: a silhueta (com o festão) puxada para a luz e encolhida. Deixa embaixo à
	//    direita um crescente de sombra que repete os festões da borda: é ele que diz
	//    "folhagem" sem pintar folha nenhuma.
	float dl = sd_copa(i, q - LUZ * 0.16 * R) + 0.08 * R + onda_luz;
	float a_luz = 1.0 - smoothstep(-1.4, 1.4, dl);
	vec3 c_clara = mix(c_meio, c_luz, 0.2 + 0.3 * smoothstep(-0.6, 0.6, g + mancha * 0.6));
	c = mix(c, c_clara, a_luz);
	// O topo: um domo de borda ondulada pelo ângulo, mais acima e à esquerda.
	vec3 m0 = massa_copa(i, 0);
	vec2 qt = q - m0.xy - LUZ * 0.3 * R;
	float ang_t = atan(qt.y, qt.x);
	float fase_t = TAU * rk(hash_cel(vec2(float(i), 9.0), 2321), 0);
	float raio_t = 0.5 * R * (1.0 + 0.08 * sin(3.0 * ang_t + fase_t) + 0.05 * sin(5.0 * ang_t - 1.7 * fase_t));
	float a_topo = (1.0 - smoothstep(-2.0, 2.0, length(qt) - raio_t)) * a_luz;
	c = mix(c, mix(c_luz, realce_de(c_luz), 0.25 * smoothstep(0.0, 0.8, g + mancha)), a_topo);

	// 5. Realce: um só, largo e esfumado, no alto do domo.
	float dh = length(q - m0.xy - LUZ * 0.42 * R) - 0.2 * R + onda_luz;
	float a_realce = (1.0 - smoothstep(-6.0, 8.0, dh)) * 0.28 * a_topo;
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

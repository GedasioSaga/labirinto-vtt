// ÁRVORE vista de cima (onda 3, lote 6; CONTRATO.md, seção 9). O piloto dos carimbos.
//
// A crítica que criou o estilo nasceu numa copa: "tá muito detalhado, cheio de bolinhas".
// Então a copa é poucos lobos LARGOS (4 ou 5, um maior no meio) pintados como à mão, um
// por cima do outro: os de baixo à direita primeiro, os de cima à esquerda depois e o do
// meio por último. Cada lobo acende do lado da luz (cima à esquerda), escurece na beira de
// baixo à direita e faz uma sombra macia no lobo de baixo: é isso que separa as massas de
// folha, sem linha nenhuma por dentro. A borda tem festões rasos e largos (como o Bosque
// aprovado) e o contorno é a folha a 60% (o protótipo do Fogo), mais fino do lado da luz.
//
// q em unidades do tamanho, a partir do meio da imagem (= o meio da copa). A copa tem uns
// 0,9 unidade de diâmetro (a de hoje tem a área de um círculo de raio 0,41) e o pé fica
// 0,61 unidade abaixo do meio (config: ancoraPx), onde o desenho de hoje tem o tronco.
// Sem sombra no chão: ela é do app (pela silhueta).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

const float FESTAO_LARGO = 0.15; // largura de um festão ao longo da borda (unidades)
const float FESTAO_ALTO = 0.02;  // quanto ele sobe (unidades; 3 px do mundo)
const vec2 SOMBRA_DENTRO = vec2(0.03, 0.036); // a sombra de um lobo no de baixo
const float R_COPA = 0.46;

// Quantos lobos a variação k tem (o do meio incluído).
int lobos_de(int k) {
	return (k == 1 || k == 3) ? 4 : 5;
}

// O lobo i da variação k: xy = centro, z = raio (unidades). O 0 é o maior, quase no meio;
// os outros saem em volta, com ângulo, distância e tamanho sorteados: a copa fica torta,
// como uma folhosa crescida no aberto, e não uma flor de pétalas iguais.
vec3 lobo(int k, int i, int sem) {
	uint h = hash_cel(vec2(float(k), float(i) + 10.0), sem + 701);
	if (i == 0) {
		return vec3((vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.05 + LUZ * 0.05, 0.255 + 0.03 * rk(h, 2));
	}
	// Os de fora ficam perto do meio: a copa é UMA massa com bordas que incham, não um
	// trevo de pétalas soltas (no bosque fechado o trevo virava bolhas de sabão).
	int n = lobos_de(k) - 1;
	float a0 = TAU * rk(hash_cel(vec2(float(k), 3.0), sem + 703), 0);
	float a = a0 + TAU * float(i - 1) / float(n) + (rk(h, 0) - 0.5) * 0.8;
	float d = (n == 3 ? 0.165 : 0.155) + 0.035 * rk(h, 1);
	float r = (n == 3 ? 0.225 : 0.205) + 0.04 * rk(h, 2);
	vec2 c = vec2(cos(a), sin(a)) * d;
	if (k == 3) {
		c = girar(c * vec2(1.16, 0.88), 0.6); // uma árvore que cresceu para um lado
	}
	return vec3(c, r);
}

// O festão de um lobo: arcos rasos ao longo da borda, de altura desigual.
float festao(int k, int i, vec3 l, vec2 q, int sem) {
	vec2 v = q - l.xy;
	float ang = atan(v.y, v.x);
	float n = max(4.0, floor(TAU * l.z / FESTAO_LARGO + 0.5));
	uint h = hash_cel(vec2(float(k), float(i) + 30.0), sem + 709);
	float a = ang + 0.18 * sin(2.0 * ang + TAU * rk(h, 1));
	float t = (a / TAU + rk(h, 0)) * n;
	float f = fract(t);
	float j = mod(floor(t), n);
	float alto = FESTAO_ALTO * (0.5 + rk(hash_cel(vec2(float(k) * 16.0 + float(i), j), sem + 711), 0));
	return alto * sqrt(max(1.0 - (2.0 * f - 1.0) * (2.0 * f - 1.0), 0.0));
}

float sd_lobo(int k, int i, vec3 l, vec2 q, int sem) {
	return length(q - l.xy) - l.z - festao(k, i, l, q, sem);
}

// Os três tons de cada variação: luz, meio e sombra. A folha do Meio-Termo, um pouco mais
// fechada que a do Bosque (a árvore sozinha tem de saltar da grama); uma mais fria, uma
// mais quente e uma mais nova, para o bosque não ser um carimbo da mesma cor.
vec3 tom(int k, int qual) {
	vec3 luz = vec3(0.392, 0.660, 0.420);
	vec3 meio = vec3(0.232, 0.500, 0.340);
	vec3 sombra = vec3(0.150, 0.352, 0.272);
	if (k == 1) {
		luz = vec3(0.345, 0.640, 0.430);
		meio = vec3(0.200, 0.472, 0.340);
		sombra = vec3(0.130, 0.335, 0.272);
	} else if (k == 2) {
		luz = vec3(0.445, 0.660, 0.395);
		meio = vec3(0.280, 0.505, 0.310);
		sombra = vec3(0.180, 0.360, 0.250);
	} else if (k == 3) {
		luz = vec3(0.420, 0.690, 0.445);
		meio = vec3(0.255, 0.532, 0.355);
		sombra = vec3(0.165, 0.375, 0.282);
	}
	return qual == 0 ? luz : (qual == 1 ? meio : sombra);
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 pl = (q + vec2(2.0)) * 128.0; // px "locais" para o ruído (128 por unidade)
	float pxl = px * 128.0;
	float traco = 1.0 / unidade_mundo; // 1 px do mundo, em unidades
	// A borda ondula de leve numa escala larga: mão de pintura, não compasso.
	float onda = (rz(pl, 32.0, 1024.0, sem + 13 + k) - 0.5) * 0.01;
	vec2 qo = q + vec2(onda) + 0.03 * (vec2(rz(pl, 96.0, 1024.0, sem + 31 + k), rz(pl, 96.0, 1024.0, sem + 37 + k)) - 0.5);

	// A ordem de pintura: os lobos de fora, do que está mais de costas para a luz ao que
	// está mais de frente; o do meio por último (é o mais alto).
	int n = lobos_de(k);
	vec3 lob[5];
	for (int i = 0; i < 5; i++) {
		lob[i] = i < n ? lobo(k, i, sem) : vec3(0.0);
	}
	int ordem[5] = int[](1, 2, 3, 4, 0);
	for (int a = 0; a < 3; a++) {
		for (int b = 0; b < 3 - a; b++) {
			int i = ordem[b];
			int j = ordem[b + 1];
			if (j < n && i < n && dot(lob[i].xy, LUZ) > dot(lob[j].xy, LUZ)) {
				ordem[b] = j;
				ordem[b + 1] = i;
			}
		}
	}

	vec3 c_luz = tom(k, 0);
	vec3 c_meio = tom(k, 1);
	vec3 c_sombra = tom(k, 2);
	float g = dot(q / R_COPA, LUZ); // a copa inteira: mais clara em cima à esquerda
	float mancha = (rz(pl, 64.0, 1024.0, sem + 17 + k) - 0.5) * 0.14;

	vec3 c = c_sombra;
	float d = 1e9;
	float cobriu = 0.0;
	for (int m = 0; m < 5; m++) {
		int i = ordem[m];
		if (i >= n) {
			continue;
		}
		vec3 l = lob[i];
		float di = sd_lobo(k, i, l, qo, sem);
		float cov = 1.0 - smoothstep(-0.022, 0.006, di);
		// A sombra deste lobo no que já está pintado embaixo dele (macia, só fora dele).
		float ds = sd_lobo(k, i, l, qo - SOMBRA_DENTRO, sem);
		float a_s = (1.0 - smoothstep(-0.035, 0.035, ds)) * (1.0 - cov) * cobriu;
		c = mix(c, mix(c, c_sombra * 0.9, 0.7), a_s * 0.42);
		// O lobo: o tom do meio, que cai para a sombra embaixo à direita (dele e da copa), e a
		// beira de baixo à direita escura (o crescente que diz "massa de folha").
		vec2 v = (qo - l.xy) / l.z;
		float lado_l = dot(normalize(v + vec2(1e-4)), -LUZ);
		float t = dot(v, LUZ) * 0.35 + 0.45 * g + mancha;
		vec3 tl = mix(c_sombra, c_meio, smoothstep(-0.55, 0.1, t));
		float beira = (1.0 - smoothstep(0.0, 0.05, -di)) * smoothstep(0.2, 0.85, lado_l);
		tl = mix(tl, c_sombra * 0.92, beira * 0.45);
		c = mix(c, tl, cov);
		cobriu = max(cobriu, cov);
		d = min(d, di);
	}
	// A LUZ, uma só para a copa inteira (como o Bosque aprovado): a silhueta puxada para
	// cima à esquerda e encolhida. Ela só levanta o tom, então as sombras de um lobo no
	// outro continuam lá dentro; embaixo à direita sobra um crescente com os festões.
	float dl = 1e9;
	vec2 ql = qo - LUZ * 0.06;
	for (int i = 0; i < 5; i++) {
		if (i < n) {
			dl = min(dl, sd_lobo(k, i, lob[i], ql, sem));
		}
	}
	dl += 0.055 + mancha * 0.08;
	float a_luz = 1.0 - smoothstep(-0.02, 0.02, dl);
	c += (c_luz - c_meio) * a_luz * (0.85 + 0.3 * smoothstep(-0.3, 0.5, g));
	// O lado de costas para a luz desce mais um tom: a copa tem volume a qualquer zoom.
	c = mix(c, c_sombra * 0.86, (1.0 - a_luz) * smoothstep(0.05, 0.45, -g) * 0.45);
	// Um realce só, largo e esfumado, no lobo de cima.
	float dr = length(qo - lob[0].xy - LUZ * 0.42 * lob[0].z) - 0.42 * lob[0].z;
	c = mix(c, realce_de(c_luz), (1.0 - smoothstep(-0.06, 0.07, dr)) * 0.32 * a_luz);
	// A mão de pintura: pinceladas largas numa direção só e um grão leve.
	c *= 1.0 + 0.022 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 40.0, -0.785, 0.5);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.5;

	// Contorno: a folha a 60%, de 1,5 px do mundo (lado da luz) a 2,2 px (lado da sombra).
	vec2 dir = q / max(length(q), 1e-3);
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	vec3 c_traco = mix(mix(FOLHA_CONTORNO, c_meio, 0.2), contorno_de(c_sombra), smoothstep(0.3, 0.8, lado_sombra));
	float esp = mix(1.5, 2.2, smoothstep(0.2, 0.85, lado_sombra)) * traco;
	vec4 acc = vec4(0.0);
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + esp, px));
	// Onde não há nada, a cor do contorno (o app lê em bilinear e não pode puxar preto).
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : c_traco;
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

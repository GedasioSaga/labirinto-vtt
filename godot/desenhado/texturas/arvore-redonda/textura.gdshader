// ÁRVORE REDONDA em pé, meio de lado (onda 3, lote 6; CONTRATO.md, seção 9).
//
// Da mesma família da árvore aprovada em 28/10 (texturas/arvore/): a mesma vista, a mesma
// luz de cima à esquerda, o mesmo contorno e o mesmo tronco em dois tons com as raízes
// abrindo no chão. O que a separa da Árvore num relance, num bosque que mistura as duas:
//
// - A silhueta é UMA copa redonda e cheia. Os cachos de dentro são largos e se fundem num
//   contorno quase circular (o círculo corta os cachos), com um festão raso e largo na
//   borda; a copa não abre em braços como a da Árvore.
// - O tronco é mais curto e a copa desce mais perto do chão.
// - O verde puxa um pouco para o amarelo (a Árvore puxa para o azul), sempre contido.
//
// Cada cacho tem as três camadas da Árvore: a massa no tom da sombra; a mesma forma menor e
// andada para a luz, no tom do meio; e, só nos cachos de cima à esquerda, um boné de luz
// encostado na borda clara. Nada de disco de brilho no meio (a copa redonda viraria bola
// lisa ou alvo): a luz fica em poucas massas, contra a borda de cima à esquerda, e embaixo à
// direita de cada cacho sobra o crescente escuro que dá o volume.
//
// O desenho tem um "em pé" (o tronco embaixo): não espelha ("espelho": "nenhum", 4 formas,
// uma por arquivo) e a sombra é a "em-pe" do app. As 4 formas mudam o tamanho da copa, a
// inclinação, o tom e quantos cachos aparecem (5, 3, 6 e 4).
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qf = q - pé, y para baixo). O pé vem da âncora do config (sprite_ancora), que fica onde o
// pé de hoje fica. Sem sombra no chão: ela é do app, pela silhueta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

const vec2 SOMBRA_DENTRO = vec2(0.024, 0.032);
// A sombra que um cacho joga no de trás. A Árvore usa 0,85: lá os cachos se separam. Aqui
// eles se fundem: com o mesmo tom do meio, essa sombra desenhava uma linha fina onde a
// borda do cacho corre de lado para a luz; quem separa é só o crescente de cada cacho.
const float SOMBRA_DO_CACHO = 0.12;
// O crescente escuro da copa inteira: o disco claro anda isto (fração do raio) para a luz e
// tem este raio (fração do raio); a largura do crescente embaixo à direita é a soma menos 1.
// Em forma de lente: grosso embaixo à direita, some depressa para os lados. Com o disco
// claro menor e pouco andado (0,90 e 0,14), o crescente tinha quase a mesma largura em
// toda a volta e virava uma faixa, como um contorno por dentro.
const float CRESCENTE_ANDA = 0.25;
const float CRESCENTE_RAIO = 0.98;
// O mesmo para o crescente de cada cacho: x = escala do disco claro, y = quanto ele anda.
const vec2 CRESCENTE_DO_CACHO = vec2(0.97, 0.29);

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

// A copa da forma k: x = raio, y = largura, z = altura (fatores do raio), w = inclinação.
vec4 forma(int k) {
	if (k == 1) {
		return vec4(0.37, 0.97, 1.02, 0.085);
	}
	if (k == 2) {
		return vec4(0.47, 1.05, 0.94, -0.02);
	}
	if (k == 3) {
		return vec4(0.41, 1.0, 0.98, -0.095);
	}
	return vec4(0.43, 1.0, 0.97, 0.0);
}

// Quanto do tronco aparece entre o chão e a copa, em unidades.
float tronco_visivel(int k) {
	if (k == 1) {
		return 0.22;
	}
	if (k == 2) {
		return 0.16;
	}
	return 0.19;
}

// Quantos cachos a forma tem, contando o corpo (o cacho 0).
int quantos(int k) {
	if (k == 1) {
		return 2;
	}
	if (k == 2) {
		return 4;
	}
	if (k == 3) {
		return 3;
	}
	return 4;
}

// O cacho i da forma k, já na ordem de pintar, em frações do raio da copa: xy = centro,
// z = raio. O cacho 0 é o CORPO: enche o círculo inteiro, sem crescente próprio (o volume
// embaixo à direita é o crescente da copa). Por cima vêm os cachos da frente, os de cima,
// do de trás à direita para o da frente à esquerda; cada um mostra o seu crescente.
vec3 cacho_base(int k, int i) {
	if (i == 0) {
		return vec3(0.02, 0.04, 1.10);
	}
	if (k == 1) {
		return vec3(-0.24, -0.26, 0.74);
	}
	if (k == 2) {
		if (i == 1) {
			return vec3(0.45, -0.40, 0.54);
		}
		if (i == 2) {
			return vec3(-0.55, -0.16, 0.54);
		}
		return vec3(-0.15, -0.50, 0.56);
	}
	if (k == 3) {
		if (i == 1) {
			return vec3(0.38, -0.34, 0.56);
		}
		return vec3(-0.30, -0.28, 0.68);
	}
	if (i == 1) {
		return vec3(0.45, -0.22, 0.56);
	}
	if (i == 2) {
		return vec3(-0.56, 0.02, 0.52);
	}
	return vec3(-0.18, -0.44, 0.60);
}

// O cacho em unidades, a partir do centro da copa.
vec3 cacho(int k, int i, int sem) {
	vec4 F = forma(k);
	vec3 b = cacho_base(k, i);
	uint h = hash_cel(vec2(float(k), float(i) + 50.0), sem + 801);
	vec2 j = (vec2(rk(h, 0), rk(h, 1)) - 0.5) * 0.05;
	float r = b.z * (0.95 + 0.10 * rk(h, 2));
	return vec3((b.xy * F.yz + j) * F.x, r * F.x);
}

float borda(int k, int i, vec3 l, vec2 q, int sem) {
	vec2 v = q - l.xy;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 30.0), sem + 709);
	float m = 4.0 + floor(2.99 * rk(h, 2));
	float a = ang + 0.35 * sin(2.0 * ang + TAU * rk(h, 1));
	float t = (a / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float alto = 0.020 * (0.3 + 0.95 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j), sem + 711), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

// Folhas na beira da luz: cachinhos largos e desiguais ao longo da linha entre dois tons.
float beira_folhas(vec2 q, vec2 c, int k, int i, int sem, float alto) {
	vec2 v = q - c;
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), float(i) + 70.0), sem + 811);
	float m = 9.0 + floor(4.99 * rk(h, 2));
	float t = (ang / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float a = alto * (0.3 + 0.9 * rk(hash_cel(vec2(float(k) * 16.0 + float(i), j + 40.0), sem + 813), 0));
	float x = 2.0 * f - 1.0;
	return a * pow(max(1.0 - x * x, 0.0), 0.6);
}

float sd_cacho(int k, int i, vec3 l, vec2 q, int sem, float s, float o) {
	vec3 ls = vec3(l.xy + LUZ * o * l.z, l.z * s);
	return length(q - ls.xy) - ls.z - borda(k, i, l, q - LUZ * o * l.z, sem) * s;
}

// O festão da silhueta: muitos arcos rasos e largos (nada de serrilha), de altura desigual.
float festao(int k, vec2 v, float R, int sem) {
	float ang = atan(v.y, v.x);
	uint h = hash_cel(vec2(float(k), 90.0), sem + 901);
	float m = floor(R * 30.0) + floor(2.99 * rk(h, 2));
	float a = ang + 0.12 * sin(3.0 * ang + TAU * rk(h, 1));
	float t = (a / TAU + rk(h, 0)) * m;
	float f = fract(t);
	float j = mod(floor(t), m);
	float alto = R * 0.042 * (0.55 + 0.9 * rk(hash_cel(vec2(float(k) * 16.0, j), sem + 903), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

// A silhueta da copa: um círculo (um pouco achatado ou alongado por forma) com o festão.
float sd_silhueta(int k, vec2 qc, int sem) {
	vec4 F = forma(k);
	float d = (length(qc / F.yz) - F.x) * min(F.y, F.z);
	return d - festao(k, qc, F.x, sem);
}

// Os tons da forma k: 0 luz, 1 meio, 2 sombra, 3 fundo, 4 contorno. O meio é o verde da
// forma; os outros saem dele pelas mesmas proporções da Árvore (a luz puxa para o amarelo).
vec3 tom(int k, int qual) {
	vec3 m = vec3(0.250, 0.488, 0.292);
	if (k == 1) {
		m = vec3(0.205, 0.440, 0.290);
	} else if (k == 2) {
		m = vec3(0.256, 0.466, 0.274);
	} else if (k == 3) {
		m = vec3(0.282, 0.540, 0.318);
	}
	if (qual == 0) {
		return m * vec3(1.55, 1.31, 1.22);
	}
	if (qual == 2) {
		return m * vec3(0.74, 0.81, 0.85);
	}
	if (qual == 3) {
		return m * vec3(0.575, 0.653, 0.73);
	}
	if (qual == 4) {
		return m * vec3(0.48, 0.53, 0.58);
	}
	return m;
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 pe = (sprite_ancora - vec2(sprite_lado * 0.5)) / sprite_unidade;
	vec2 qf = q - pe;
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float pxl = px * 128.0;
	float traco = 1.0 / unidade_mundo;
	vec2 qo = qf + 0.02 * (vec2(rz(pl, 64.0, 1024.0, sem + 31 + k), rz(pl, 64.0, 1024.0, sem + 37 + k)) - 0.5);
	vec4 F = forma(k);
	float inc = F.w;
	vec2 C = vec2(inc * 1.15, -(tronco_visivel(k) + F.x * F.z));
	vec2 qc = qo - C;

	vec3 c_luz = tom(k, 0);
	vec3 c_meio = tom(k, 1);
	vec3 c_sombra = tom(k, 2);
	vec3 c_fundo = tom(k, 3);
	vec3 c_cont = tom(k, 4);
	float mancha = rz(pl, 40.0, 1024.0, sem + 17 + k) - 0.5;

	// A copa: o círculo com festão é a silhueta; os cachos de dentro, cortados por ele, cada
	// um nas três camadas. Os de baixo ficam na sombra da própria copa.
	float dS = sd_silhueta(k, qc, sem);
	vec3 c = c_fundo;
	float cobriu = 0.0;
	int n = quantos(k);
	for (int i = 0; i < 6; i++) {
		if (i >= n) {
			break;
		}
		vec3 l = cacho(k, i, sem);
		float dl = dot(normalize(l.xy + vec2(0.0, -1e-3)), LUZ);
		float embaixo = smoothstep(0.04, 0.22, l.y);
		float di = max(sd_cacho(k, i, l, qc, sem, 1.0, 0.0), dS);
		float cov = 1.0 - smoothstep(-0.008, 0.004, di);
		float ds = sd_cacho(k, i, l, qc - SOMBRA_DENTRO, sem, 1.0, 0.0);
		c = mix(c, c_fundo, (1.0 - smoothstep(-0.026, 0.026, ds)) * (1.0 - cov) * cobriu * SOMBRA_DO_CACHO);
		// O meio é o mesmo em todos os cachos (só os de baixo um pouco mais fechados): o volume
		// vem do crescente da copa inteira, e a copa lê como uma massa, não como pilha.
		vec3 c_m = mix(c_sombra, c_meio, 1.0 - 0.3 * embaixo);
		float m1 = 1.0 - smoothstep(-0.006, 0.006, sd_cacho(k, i, l, qc, sem, CRESCENTE_DO_CACHO.x, CRESCENTE_DO_CACHO.y) - beira_folhas(qc, l.xy + LUZ * CRESCENTE_DO_CACHO.y * l.z, k, i, sem, 0.012) + mancha * 0.035);
		bool corpo = i == 0;
		m1 = corpo ? 1.0 : m1;
		// O crescente de dentro um pouco mais aberto que o da Árvore: separa as massas sem
		// desenhar arcos fortes (com 4 ou mais, a copa redonda lia como repolho a 50%).
		vec3 tl = mix(mix(c_sombra, c_m, 0.22), c_m, m1);
		float w = corpo ? 0.0 : smoothstep(0.05, 0.55, dl) * (1.0 - embaixo);
		float m2 = 1.0 - smoothstep(-0.006, 0.006, sd_cacho(k, i, l, qc, sem, mix(0.46, 0.56, w), mix(0.62, 0.54, w)) - beira_folhas(qc, l.xy + LUZ * mix(0.62, 0.54, w) * l.z, k, i + 8, sem, 0.015) + mancha * 0.04);
		tl = mix(tl, c_luz, m2 * step(0.08, w));
		c = mix(c, tl, cov);
		cobriu = max(cobriu, cov);
	}
	// O crescente da copa inteira: embaixo à direita, fora do disco da copa andado para a luz,
	// com a beira em cachinhos. É ele que funde os cachos numa massa só (uma copa, não pilha).
	vec2 c_lit = LUZ * CRESCENTE_ANDA * F.x;
	float d_lit = (length((qc - c_lit) / F.yz) - CRESCENTE_RAIO * F.x) * min(F.y, F.z) + beira_folhas(qc, c_lit, k, 20, sem, 0.016) + mancha * 0.04;
	c = mix(c, c_sombra, smoothstep(-0.006, 0.006, d_lit) * 0.85);
	c *= 1.0 + 0.05 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 48.0, -0.785, 0.5);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;
	vec2 dir = normalize(qc + vec2(1e-4));
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	vec3 c_traco = mix(mix(c_cont, c_meio, 0.35), c_cont, smoothstep(0.3, 0.8, lado_sombra));
	float esp = mix(1.6, 2.6, smoothstep(0.2, 0.85, lado_sombra)) * traco;

	// O tronco, curto: metade na luz (a esquerda), metade na sombra, as raízes abrindo no chão.
	vec2 topo = vec2(inc, C.y + 0.35 * F.x);
	float dt = sd_traco(qf, vec2(0.0, -0.01), topo, 0.047, 0.034);
	dt = smin(dt, sd_traco(qf, vec2(-0.016, -0.03), vec2(-0.105, 0.012), 0.025, 0.007), 0.025);
	dt = smin(dt, sd_traco(qf, vec2(0.016, -0.03), vec2(0.12, 0.018), 0.027, 0.007), 0.025);
	float eixo = inc * clamp(-qf.y / max(-topo.y, 0.1), 0.0, 1.0);
	float lado = qf.x - eixo;
	vec3 t_luz = vec3(0.486, 0.361, 0.243);
	vec3 t_sombra = vec3(0.345, 0.251, 0.173);
	vec3 t_cont = vec3(0.243, 0.176, 0.122);
	vec3 ct = mix(t_luz, t_sombra, smoothstep(-0.012, 0.0, lado));
	float na_sombra = 1.0 - smoothstep(-0.02, 0.02, sd_silhueta(k, qf - vec2(0.02, 0.075) - C, sem));
	ct = mix(ct, t_sombra * 0.7, na_sombra * 0.85);
	ct *= 1.0 + (grao(pl, 1024.0, sem + 41) - 1.0) * 0.6;

	vec4 acc = vec4(0.0);
	acc = sobre(acc, t_cont, cobre(dt, px));
	acc = sobre(acc, ct, cobre(dt + 1.6 * traco, px));
	acc = sobre(acc, c_traco, cobre(dS, px));
	acc = sobre(acc, c, cobre(dS + esp, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : (dt < dS ? t_cont : c_traco);
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

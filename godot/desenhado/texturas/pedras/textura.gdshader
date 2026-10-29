// PEDRAS (onda 3, lote 8; CONTRATO.md, seção 9). Um carimbo do catálogo das plantas, da
// família aprovada nos lotes 6 e 7 (texturas/arvore/, texturas/arbusto/): a mesma vista meio
// de lado, a mesma luz de cima à esquerda, o mesmo contorno da própria cor escurecida.
//
// - Um grupo de 2 a 4 pedras baixas, encostadas, de tamanhos bem diferentes. Cada pedra é um
//   bloco lascado (um tronco de pirâmide de 5 ou 6 lados, o pé no chão visto meio de frente,
//   o topo menor, recuado para trás e um pouco inclinado): poucos planos grandes e chapados.
//   O topo é o plano claro; das faces da frente, a da esquerda pega meia luz e as de baixo à
//   direita ficam na sombra. A quina entre os planos é viva (só o degrau de tom, sem linha).
// - Nada de pontilhado, granulado, rachadura miúda ou musgo: só uma mancha larga e fraca,
//   as pinceladas da família e o grão de papel.
// - Os tons são os da Serra aprovada (texturas/pedra/: a laje é ROCHA_LUZ puxada para a
//   PEDRA, com um nada de LINHO), para combinar quando o mestre espalha pedras sobre ela.
// - As 4 formas mudam o número de pedras (3, 2, 4, 3), o arranjo e o tom (a laje da Serra,
//   arenito quente, granito frio, pedra velha mais funda).
// - "espelho": "nenhum" (o desenho tem um em pé: transposto, a face da frente iria para o
//   lado) e a sombra "em-pe" curta (comprimento 0,40, borrão 0,03): é a MESMA conta da sombra
//   "baixa" de hoje (matrizDaSombra('baixa') em client/src/carimbos/arte.ts: o cisalhamento
//   do em-pe com COMPRIMENTO.baixa = 0,4 e o borrão de 3%), como o arbusto e os juncos.
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qf = q - PE, y para baixo, 0 = o chão no pé), que fica onde o pé de hoje fica (config:
// ancoraPx). Sem sombra no chão: ela é do app, pela silhueta.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// Paleta do Meio-Termo que não está na base (client/src/texturas/meioTermo/paleta.ts).
const vec3 GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b
const vec3 ARDOSIA = vec3(0.373, 0.416, 0.400); // #5f6a66
// Da Serra aprovada (texturas/pedra/textura.gdshader): a rocha do lajedo.
const vec3 ROCHA_LUZ = vec3(0.721, 0.696, 0.630);
const vec3 ROCHA_SOMBRA = vec3(0.622, 0.602, 0.551);

// O pé em unidades a partir do meio da imagem: (ancoraPx - ladoPx / 2) / unidadePx.
const vec2 PE = vec2(0.0150, 0.0680);
// O chão visto meio de frente: um círculo no chão vira uma elipse com esta altura na tela
// (o mesmo das pedras de hoje).
const float ACHATA = 0.55;
// A luz em 3D (x à direita, y para a frente, z para cima): de cima à esquerda e do alto. Mais
// da esquerda que a das pedras de hoje (LUZ_3D em embutidos.ts, -0,5; -0,55; 0,67): com
// aquela, a face da frente ficava mais escura que a da direita e os planos da frente se
// confundiam; com esta, da esquerda para a direita: meia luz, sombra, fundo.
const vec3 LUZ3 = vec3(-0.701, -0.351, 0.621);
// Para onde a vista olha (y na tela = y·ACHATA - z): a direção que cai num ponto só.
const vec3 VISTA = vec3(0.0, 0.8762, 0.4819);
// O raio da quina da silhueta, em unidades (a quina fica viva, só sem a ponta de cristal).
const float RAIO_DA_QUINA = 0.022;

int quantas(int k) {
	return k == 1 ? 2 : (k == 2 ? 4 : 3);
}

vec4 pedra_a0(int k, int i) {
	if (k == 1) {
		// Uma laje comprida e baixa, deitada, com uma pedra pequena encostada na frente.
		return i == 0 ? vec4(-0.085, -0.032, 0.280, 0.125) : vec4(0.300, 0.064, 0.140, 0.100);
	}
	if (k == 2) {
		// Quatro: a maior atrás, alta; uma pequena atrás à direita; uma média na frente à
		// esquerda; a menor na frente, no meio.
		return i == 0 ? vec4(0.010, -0.075, 0.210, 0.170)
			: i == 1 ? vec4(0.270, -0.035, 0.125, 0.090)
			: i == 2 ? vec4(-0.230, 0.035, 0.150, 0.110)
			: vec4(0.060, 0.080, 0.120, 0.070);
	}
	if (k == 3) {
		// Em diagonal: uma média atrás à esquerda, a grande à direita, a pequena na frente.
		return i == 0 ? vec4(-0.225, -0.065, 0.140, 0.100)
			: i == 1 ? vec4(0.095, -0.040, 0.245, 0.205)
			: vec4(-0.135, 0.090, 0.120, 0.070);
	}
	// A de sempre (como a de hoje): a grande à esquerda, a média à direita, a pequena na frente.
	return i == 0 ? vec4(-0.105, -0.030, 0.260, 0.185)
		: i == 1 ? vec4(0.240, 0.038, 0.165, 0.120)
		: vec4(0.045, 0.135, 0.120, 0.075);
}

// O grupo inteiro um pouco maior que o desenho de baixo: baixas, as pedras têm menos área
// que as de hoje (mais altas); assim o raio de mesma área fica perto do Atual (0,29).
const float ESCALA = 1.08;

// A pedra i da forma k, de trás para a frente.
// a = (x, y do pé na tela a partir do pé do carimbo, raio do pé, altura do topo)
vec4 pedra_a(int k, int i) {
	return pedra_a0(k, i) * ESCALA;
}

// b = (lados, giro do pé, quanto o topo encolhe, alongamento do pé: x / y no chão)
vec4 pedra_b(int k, int i) {
	if (k == 1) {
		return i == 0 ? vec4(6.0, 0.25, 0.70, 1.45) : vec4(5.0, 1.30, 0.60, 1.0);
	}
	if (k == 2) {
		return i == 0 ? vec4(5.0, 0.90, 0.63, 1.0)
			: i == 1 ? vec4(5.0, 2.10, 0.60, 1.10)
			: i == 2 ? vec4(6.0, 0.40, 0.62, 1.15)
			: vec4(5.0, 1.70, 0.58, 1.10);
	}
	if (k == 3) {
		return i == 0 ? vec4(5.0, 0.20, 0.60, 1.10)
			: i == 1 ? vec4(6.0, 0.75, 0.60, 1.0)
			: vec4(5.0, 2.40, 0.58, 1.15);
	}
	return i == 0 ? vec4(6.0, 0.30, 0.62, 1.10)
		: i == 1 ? vec4(5.0, 1.10, 0.60, 1.05)
		: vec4(5.0, 2.00, 0.58, 1.10);
}

// c = (inclinação do topo em x, em y, tom da pedra, 0)
vec4 pedra_c(int k, int i) {
	if (k == 1) {
		return i == 0 ? vec4(0.10, 0.12, 1.00, 0.0) : vec4(-0.15, 0.05, 0.97, 0.0);
	}
	if (k == 2) {
		return i == 0 ? vec4(0.18, 0.10, 1.00, 0.0)
			: i == 1 ? vec4(-0.10, 0.10, 0.96, 0.0)
			: i == 2 ? vec4(0.12, -0.08, 1.02, 0.0)
			: vec4(0.0, 0.10, 0.98, 0.0);
	}
	if (k == 3) {
		return i == 0 ? vec4(0.10, 0.05, 1.02, 0.0)
			: i == 1 ? vec4(0.10, 0.10, 1.00, 0.0)
			: vec4(0.05, 0.10, 0.97, 0.0);
	}
	return i == 0 ? vec4(0.12, -0.10, 1.00, 0.0)
		: i == 1 ? vec4(-0.12, 0.10, 0.97, 0.0)
		: vec4(0.06, 0.08, 1.02, 0.0);
}

// O tom do topo (o plano claro) de cada forma, todos da rocha da Serra.
vec3 cor_da_forma(int k) {
	if (k == 1) {
		// Arenito: mais quente, puxado para o linho (a laje comprida da Serra).
		return mix(mix(ROCHA_LUZ, PEDRA, 0.40), LINHO, 0.28);
	}
	if (k == 2) {
		// Granito: mais frio e um degrau mais fundo.
		return mix(PEDRA, GRANITO, 0.38);
	}
	if (k == 3) {
		// Pedra velha: a sombra da rocha com um nada de ardósia, a mais funda das quatro (mais
		// funda que isto, a 50% ela virava mancha escura no meio das outras).
		return mix(mix(ROCHA_SOMBRA, GRANITO, 0.2), ARDOSIA, 0.05) * 1.07;
	}
	// A laje da Serra.
	return mix(mix(ROCHA_LUZ, PEDRA, 0.6), LINHO, 0.08);
}

// Um vértice do pé, no chão, a partir do centro do pé (x à direita, y para a frente).
vec2 pe_da_pedra(int k, int i, int j, int sem) {
	vec4 a = pedra_a(k, i);
	vec4 b = pedra_b(k, i);
	float n = b.x;
	uint h = hash_cel(vec2(float(k * 8 + i), float(j)), sem + 901);
	float ang = b.y + TAU * (float(j) + 0.36 * (rk(h, 0) - 0.5)) / n;
	float r = a.z * (0.94 + 0.12 * rk(h, 1));
	float al = sqrt(b.w);
	return vec2(cos(ang) * r * al, sin(ang) * r / al);
}

// O mesmo vértice no topo, em 3D: o pé encolhido, recuado para trás e para a esquerda (o
// lado da luz) e levantado, num plano um pouco inclinado.
vec3 topo_da_pedra(vec2 g, int k, int i) {
	vec4 a = pedra_a(k, i);
	vec4 b = pedra_b(k, i);
	vec4 c = pedra_c(k, i);
	vec2 recuo = vec2(-0.08, -0.10) * a.z;
	vec2 t = g * b.z + recuo;
	float z = a.w * (1.0 + c.x * g.x / a.z + c.y * g.y / a.z);
	return vec3(t, z);
}

vec2 na_tela(vec3 p, vec2 c) {
	return c + vec2(p.x, p.y * ACHATA - p.z);
}

// Máximo suave (a quina arredondada da silhueta, como a laje da Serra).
float smax_k(float a, float b, float k) {
	float h = max(k - abs(a - b), 0.0) / k;
	return max(a, b) + h * h * k * 0.25;
}

// Distância (negativa dentro) até a reta a-b, com o lado de fora oposto ao ponto m.
float semi(vec2 p, vec2 a, vec2 b, vec2 m) {
	vec2 e = b - a;
	vec2 nn = vec2(e.y, -e.x);
	float l = length(nn);
	if (l < 1e-6) {
		return -1e9;
	}
	nn /= l;
	if (dot(m - a, nn) > 0.0) {
		nn = -nn;
	}
	return dot(p - a, nn);
}

// A silhueta: o casco convexo do pé e do topo (embrulho de presente nos 2n pontos), em
// distância (negativa dentro; exata dentro, boa perto da borda por fora).
float casco(vec2 p, vec2 pts[12], int m, vec2 dentro) {
	int ini = 0;
	for (int j = 1; j < 12; j++) {
		if (j >= m) {
			break;
		}
		if (pts[j].x < pts[ini].x) {
			ini = j;
		}
	}
	float d = -1e9;
	int cur = ini;
	for (int passo = 0; passo < 12; passo++) {
		int nxt = (cur + 1) % m;
		for (int j = 0; j < 12; j++) {
			if (j >= m) {
				break;
			}
			vec2 a = pts[nxt] - pts[cur];
			vec2 b = pts[j] - pts[cur];
			if (a.x * b.y - a.y * b.x < -1e-7) {
				nxt = j;
			}
		}
		d = smax_k(d, semi(p, pts[cur], pts[nxt], dentro), RAIO_DA_QUINA);
		cur = nxt;
		if (cur == ini) {
			break;
		}
	}
	return d;
}

// A silhueta da pedra i (para a sombra que ela joga na vizinha).
float silhueta(vec2 q, int k, int i, int sem) {
	vec4 a = pedra_a(k, i);
	int n = int(pedra_b(k, i).x);
	vec2 pts[12];
	for (int j = 0; j < 6; j++) {
		if (j >= n) {
			break;
		}
		vec2 g = pe_da_pedra(k, i, j, sem);
		pts[j] = na_tela(vec3(g, 0.0), a.xy);
		pts[n + j] = na_tela(topo_da_pedra(g, k, i), a.xy);
	}
	return casco(q, pts, 2 * n, a.xy + vec2(0.0, -a.w * 0.5));
}

// O tom de uma face pelo quanto ela olha para a luz: as faces nunca chegam ao claro do
// topo; de frente para a luz, meia luz; de lado, a sombra; de costas, o fundo.
vec3 tom_da_face(float b, vec3 c_meio, vec3 c_sombra, vec3 c_fundo) {
	vec3 t = mix(c_sombra, c_meio, smoothstep(-0.15, 0.55, b));
	return mix(t, c_fundo, smoothstep(-0.2, -0.6, b));
}

// Pinta a pedra i da forma k por cima de acc.
vec4 pedra_em(vec4 acc, vec2 q, vec2 pl, float px, float pxl, int sem, int k, int i) {
	vec4 a = pedra_a(k, i);
	vec4 cc = pedra_c(k, i);
	int n = int(pedra_b(k, i).x);
	vec2 c = a.xy;
	vec3 P[6];
	vec3 Q[6];
	vec2 F[6];
	vec2 T[6];
	vec2 pts[12];
	for (int j = 0; j < 6; j++) {
		if (j >= n) {
			break;
		}
		vec2 g = pe_da_pedra(k, i, j, sem);
		P[j] = vec3(g, 0.0);
		Q[j] = topo_da_pedra(g, k, i);
		F[j] = na_tela(P[j], c);
		T[j] = na_tela(Q[j], c);
		pts[j] = F[j];
		pts[n + j] = T[j];
	}
	vec2 dentro = c + vec2(0.0, -a.w * 0.5);
	float d = casco(q, pts, 2 * n, dentro);
	if (d > 4.0 * px) {
		return acc;
	}

	vec3 c_luz = cor_da_forma(k) * cc.z;
	vec3 c_meio = c_luz * vec3(0.85, 0.835, 0.82);
	vec3 c_sombra = c_luz * vec3(0.69, 0.67, 0.66);
	vec3 c_fundo = c_luz * vec3(0.56, 0.545, 0.535);
	vec3 c_cont = c_luz * vec3(0.46, 0.445, 0.44);
	float e = px;

	// As faces de lado que a vista vê, cada uma chapada no tom da luz que ela pega; embaixo,
	// perto do chão, um pouco mais escuras (a pedra assenta).
	vec3 m3 = vec3(0.0, 0.0, a.w * 0.5);
	vec3 col = c_sombra;
	for (int j = 0; j < 6; j++) {
		if (j >= n) {
			break;
		}
		int j2 = (j + 1) % n;
		vec3 nn = normalize(cross(P[j2] - P[j], Q[j] - P[j]));
		vec3 meio_f = (P[j] + P[j2] + Q[j] + Q[j2]) * 0.25;
		if (dot(nn, meio_f - m3) < 0.0) {
			nn = -nn;
		}
		if (dot(nn, VISTA) <= 0.0) {
			continue;
		}
		vec2 mf = (F[j] + F[j2] + T[j] + T[j2]) * 0.25;
		float df = max(max(semi(q, F[j], F[j2], mf), semi(q, F[j2], T[j2], mf)), max(semi(q, T[j2], T[j], mf), semi(q, T[j], F[j], mf)));
		vec3 cf = tom_da_face(dot(nn, LUZ3), c_meio, c_sombra, c_fundo);
		float alto_f = max(-semi((T[j] + T[j2]) * 0.5, F[j], F[j2], mf), 1e-3);
		float s = -semi(q, F[j], F[j2], mf) / alto_f;
		cf *= 1.0 - 0.13 * (1.0 - smoothstep(0.0, 0.5, s));
		col = mix(col, cf, 1.0 - smoothstep(-e, e, df));
	}

	// O topo, o plano claro: um nada mais claro do lado da luz.
	vec2 mt = vec2(0.0);
	for (int j = 0; j < 6; j++) {
		if (j >= n) {
			break;
		}
		mt += T[j];
	}
	mt /= float(n);
	float dt = -1e9;
	for (int j = 0; j < 6; j++) {
		if (j >= n) {
			break;
		}
		dt = max(dt, semi(q, T[j], T[(j + 1) % n], mt));
	}
	vec3 nt = normalize(cross(Q[1] - Q[0], Q[2] - Q[0]));
	if (nt.z < 0.0) {
		nt = -nt;
	}
	vec3 ct = c_luz * (1.0 + 0.30 * (dot(nt, LUZ3) - 0.62));
	vec2 rt = (q - mt) / max(a.z, 1e-3);
	ct *= 1.0 + 0.025 * smoothstep(-0.6, 0.6, dot(rt, LUZ));
	col = mix(col, ct, 1.0 - smoothstep(-e, e, dt));

	// A sombra que a vizinha de cima à esquerda joga nesta: a silhueta dela andada para
	// baixo e para a direita, só onde ela não cobre.
	for (int o = 0; o < 4; o++) {
		if (o >= quantas(k)) {
			break;
		}
		if (o == i) {
			continue;
		}
		vec4 ao = pedra_a(k, o);
		if (dot(c - ao.xy, vec2(0.84, 0.54)) <= 0.0) {
			continue;
		}
		// Borda larga e fraca: com a borda de 2 px a sombra cortava a face da vizinha no meio
		// e lia como uma listra (ou uma rachadura) na pedra pequena.
		vec2 desl = vec2(0.537, 0.844) * ao.w * 0.42;
		float som = 1.0 - smoothstep(-0.035, 0.02, silhueta(q - desl, k, o, sem));
		col = mix(col, col * 0.82, som * 0.7);
	}

	// A mão de pintura da família: mancha larga e fraca, pinceladas na mesma direção, grão.
	float mancha = rz(pl, 40.0, 1024.0, sem + 17 + k * 7 + i) - 0.5;
	col *= 1.0 + 0.035 * mancha;
	col *= 1.0 + 0.035 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 36.0, -0.785, 0.5);
	col *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;

	// O contorno: a própria cor escurecida, mais fino e mais claro do lado da luz, mais grosso
	// do lado da sombra e no pé.
	vec2 dir = normalize(q - dentro + vec2(1e-4));
	float lado_sombra = dot(dir, -LUZ) * 0.5 + 0.5;
	lado_sombra = max(lado_sombra, smoothstep(c.y - 0.02, c.y + a.z * ACHATA * 0.7, q.y));
	vec3 c_traco = mix(mix(c_cont, c_meio, 0.30), c_cont, smoothstep(0.3, 0.8, lado_sombra));
	float traco = 1.0 / unidade_mundo;
	// A pedra pequena tem o traço um pouco mais fino (senão vira um seixo de contorno grosso).
	float esp = mix(1.5, 2.4, smoothstep(0.2, 0.85, lado_sombra)) * traco * mix(0.8, 1.0, smoothstep(0.12, 0.24, a.z));
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, col, cobre(d + esp, px));
	return acc;
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	vec2 qf = q - PE;
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float pxl = px * 128.0;
	// A mão do traço: as bordas e as quinas andam um tico, sem virar serrilha.
	vec2 qo = qf + 0.008 * (vec2(rz(pl, 40.0, 1024.0, sem + 31 + k), rz(pl, 40.0, 1024.0, sem + 37 + k)) - 0.5);
	vec4 acc = vec4(0.0);
	for (int i = 0; i < 4; i++) {
		if (i >= quantas(k)) {
			break;
		}
		acc = pedra_em(acc, qo, pl, px, pxl, sem, k, i);
	}
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : cor_da_forma(k) * 0.46;
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

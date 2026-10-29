// =====================================================================
// texturas/girassol/girassol.gdshaderinc: o PÉ DE GIRASSOL dos carimbos "girassol" (um só)
// e "girassois" (a touceira). Os dois incluem este arquivo: mexeu aqui, reexporte os dois.
//
// Da família dos lotes 6 e 7 aprovados (árvore, arbusto, palmeira, juncos): em pé, meio de
// lado, luz de cima à esquerda, contorno da própria cor escurecida (fino na luz, mais grosso
// na sombra), poucas massas largas em 2 ou 3 tons e a sombra de dentro (cada peça da frente
// escurece o que está atrás dela, embaixo à direita). Nenhuma bolinha, ponto ou fio.
//
// - O caule: fino, quase reto (curva de 2º grau), metade na luz e metade na sombra.
// - As folhas: 2 ou 3 por pé, LARGAS e calmas, em coração com a ponta, num cabinho curto;
//   sobem um pouco e pendem. A metade de cima no tom da luz, a de baixo no da sombra (a beira
//   entre as duas é a nervura); boné de luz só nas que apontam para a luz. Sem serrilha.
// - A cabeça meio virada para a luz: um disco visto de lado (a elipse), com DUAS coroas de
//   pétalas largas (a de trás mais escura, aparecendo entre as da frente). Cada coroa é UMA
//   forma, a beira em pontas largas, nunca pétala por pétala. A da frente em 3 camadas, como
//   os cachos da árvore: a massa no tom da sombra, a mesma forma andada para a luz no tom do
//   meio (sobra uma beira escura embaixo à direita de cada pétala) e um boné de luz só nas
//   pontas de cima à esquerda.
// - O miolo: uma massa marrom calma, com a luz num crescente largo encostado na beira de cima
//   à esquerda e a sombra num crescente embaixo à direita. Nada de semente em ponto.
// - Cabeça muito virada mostra, atrás das pétalas do lado de longe, o verde do cálice.
//
// Unidades: as do carimbo (CONTRATO.md 9), a partir do PÉ (qo, y para baixo, 0 = o chão).
// =====================================================================

const vec2 SOMBRA_DENTRO = vec2(0.020, 0.028);
// O miolo, em frações do raio das pétalas.
const float RAIO_DO_MIOLO = 0.36;
// As duas coroas: onde a pétala nasce e onde a ponta chega, em frações do raio. A da frente
// com o vão raso (pétala larga); a de trás só põe a ponta para fora nos vãos.
const float COROA_FRENTE_DENTRO = 0.69;
const float COROA_FRENTE_PONTA = 1.0;
const float COROA_TRAS_DENTRO = 0.74;
const float COROA_TRAS_PONTA = 0.91;
// O chão corta tudo um tico abaixo do pé: a base cobre o ponto onde a sombra nasce.
const float CHAO_ABAIXO_DO_PE = 0.012;

// As pétalas: um ouro quente e contido, que conversa com a grama-amarela (palha #d6b56a) e
// com o amarelo da paleta (#f0d266), sem passar da saturação dele nem de 245 num canal.
const vec3 PETALA_LUZ = vec3(0.930, 0.820, 0.480);
const vec3 PETALA_MEIO = vec3(0.890, 0.735, 0.385);
const vec3 PETALA_SOMBRA = vec3(0.800, 0.615, 0.305);
const vec3 PETALA_TRAS = vec3(0.740, 0.570, 0.270);
const vec3 PETALA_CONTORNO = vec3(0.560, 0.435, 0.215);
// O miolo: marrom escuro (nogueira #775739 escurecida), luz e sombra em dois crescentes.
const vec3 MIOLO_LUZ = vec3(0.470, 0.335, 0.205);
const vec3 MIOLO_MEIO = vec3(0.345, 0.235, 0.145);
const vec3 MIOLO_SOMBRA = vec3(0.250, 0.168, 0.105);
const vec3 MIOLO_CONTORNO = vec3(0.215, 0.145, 0.088);
// O verde do caule e das folhas: oliva quente (perto do juncos "oliva" aprovado), para não
// brigar com o ouro.
const vec3 VERDE_LUZ = vec3(0.520, 0.675, 0.385);
const vec3 VERDE_MEIO = vec3(0.405, 0.575, 0.318);
const vec3 VERDE_SOMBRA = vec3(0.292, 0.458, 0.258);
const vec3 VERDE_FUNDO = vec3(0.215, 0.358, 0.210);
const vec3 VERDE_CONTORNO = vec3(0.138, 0.255, 0.148);

// Um pé: o caule, até 3 folhas e a cabeça.
struct Pe {
	float x0;       // onde o caule sai do chão
	vec2 cab;       // o meio da cabeça (da face)
	float raio;     // o raio das pétalas
	float virada;   // para onde a face olha, na tela (radianos; 0 = direita, -pi/2 = cima)
	float achata;   // 1 = de frente, 0,5 = bem de lado
	float curva;    // quanto o caule curva (x do controle)
	float fundo;    // 0 = da frente, 1 = de trás (mais escuro)
	float fase;     // o giro das pétalas no disco
	int petalas;    // pétalas por coroa
	int folhas;     // 0 a 3
	vec4 f0;        // cada folha: x = onde sai no caule (0 = pé, 1 = cabeça), y = o comprimento
	vec4 f1;        //   com o lado (- = esquerda), z = o quanto a ponta pende (em comprimentos),
	vec4 f2;        //   w = a meia largura
	int atras;      // bits: as folhas que ficam atrás do caule
	float ouro;     // -1 = mais limão, 1 = mais âmbar
	float caule;    // a meia largura do caule no pé (no alto, 70% disso)
};

float smin_g(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float smax_g(float a, float b, float k) {
	return -smin_g(-a, -b, k);
}

float dot2_g(vec2 v) {
	return dot(v, v);
}

// O ponto mais perto numa curva de 2º grau (A, B controle, C): devolve (distância, t).
vec2 bezier_perto_g(vec2 pos, vec2 A, vec2 B, vec2 C) {
	vec2 a = B - A;
	vec2 b = A - 2.0 * B + C;
	vec2 c = a * 2.0;
	vec2 d = A - pos;
	float kk = 1.0 / max(dot(b, b), 1e-8);
	float kx = kk * dot(a, b);
	float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
	float kz = kk * dot(d, a);
	float p = ky - kx * kx;
	float p3 = p * p * p;
	float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
	float h = q * q + 4.0 * p3;
	float res;
	float t;
	if (h >= 0.0) {
		h = sqrt(h);
		vec2 x = (vec2(h, -h) - q) / 2.0;
		vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
		t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
		res = dot2_g(d + (c + b * t) * t);
	} else {
		float z = sqrt(-p);
		float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
		float m = cos(v);
		float n = sin(v) * 1.732050808;
		vec2 t2 = clamp(vec2(m + m, -n - m) * z - kx, 0.0, 1.0);
		float d1 = dot2_g(d + (c + b * t2.x) * t2.x);
		float d2 = dot2_g(d + (c + b * t2.y) * t2.y);
		if (d1 < d2) {
			res = d1;
			t = t2.x;
		} else {
			res = d2;
			t = t2.y;
		}
	}
	return vec2(sqrt(res), t);
}

vec2 na_curva(vec2 A, vec2 B, vec2 C, float t) {
	return mix(mix(A, B, t), mix(B, C, t), t);
}

// ---------- a cabeça ----------

vec2 face_dir(Pe p) {
	return vec2(cos(p.virada), sin(p.virada));
}

// Quanto a nuca (o cálice, onde o caule entra) fica atrás da face, na tela.
vec2 nuca(Pe p) {
	return p.cab - face_dir(p) * (1.0 - p.achata) * 0.50 * p.raio;
}

// O ponto q no disco da cabeça de centro c: (raio, ângulo, quanto 1 do disco vale na tela).
vec3 no_disco(vec2 q, vec2 c, Pe p) {
	vec2 v = q - c;
	vec2 e = face_dir(p);
	float a = dot(v, e) / p.achata;
	float b = e.x * v.y - e.y * v.x;
	float al = atan(b, a + 1e-6);
	float jac = length(vec2(p.achata * cos(al), sin(al)));
	return vec3(length(vec2(a, b)), al, jac);
}

// Uma coroa de pétalas: UMA forma, a beira em pontas largas. dentro e ponta em frações do
// raio; meia = 0 na coroa da frente e 0,5 na de trás (as pontas dela caem nos vãos). Devolve
// a distância na tela (negativa dentro) e, em u, onde o ponto está na pétala (-0,5 a 0,5).
float coroa(vec2 q, Pe p, float dentro, float ponta, float meia, int sem, out float u) {
	vec3 dk = no_disco(q, p.cab, p);
	float n = float(p.petalas);
	float x = dk.y / TAU * n + p.fase + meia;
	float j = floor(x + 0.5);
	u = x - j;
	uint h = hash_cel(vec2(mod(j, n), meia * 8.0 + 3.0), sem);
	float comp = ponta * (0.88 + 0.17 * rk(h, 0));
	// A ponta é uma ogiva larga: arredondada, sem espinho.
	float z = min(abs(2.0 * u), 1.0);
	float g = max(1.0 - pow(z, 1.3), 1e-3);
	float forma = pow(g, 0.88);
	float r = p.raio * (dentro + (comp - dentro) * forma);
	// A beira que corre quase na direção do raio (perto do vão) está mais perto do que
	// rho - r diz: corrige pela inclinação, para o contorno sair com a mesma espessura.
	float dfdz = 0.88 * pow(g, -0.12) * 1.3 * pow(max(z, 1e-4), 0.3);
	float incl = p.raio * (comp - dentro) * dfdz * 2.0 * n / TAU / max(dk.x, 1e-3);
	return (dk.x - r) / sqrt(1.0 + min(incl * incl, 400.0)) * dk.z;
}

float miolo_d(vec2 q, Pe p, float escala) {
	vec3 dk = no_disco(q, p.cab, p);
	return (dk.x - p.raio * RAIO_DO_MIOLO * escala) * dk.z;
}

float calice_d(vec2 q, Pe p) {
	vec3 dk = no_disco(q, nuca(p), p);
	return (dk.x - p.raio * 0.66) * dk.z;
}

// ---------- o caule e as folhas ----------

void caule(Pe p, out vec2 A, out vec2 B, out vec2 C) {
	A = vec2(p.x0, 0.0);
	C = nuca(p);
	// Sobe quase no prumo e só abre no alto (o pé da touceira fica apertado, sem leque de vara).
	B = vec2(mix(p.x0, C.x, 0.10) + p.curva, C.y * 0.68);
}

vec4 folha_n(Pe p, int j) {
	return j == 0 ? p.f0 : (j == 1 ? p.f1 : p.f2);
}

// A folha j: A = onde sai do caule, B = o controle, T = a ponta, W = a meia largura.
void folha_geo(Pe p, int j, out vec2 A, out vec2 B, out vec2 T, out float W) {
	vec2 c0;
	vec2 c1;
	vec2 c2;
	caule(p, c0, c1, c2);
	vec4 f = folha_n(p, j);
	A = na_curva(c0, c1, c2, f.x);
	float L = abs(f.y);
	B = A + vec2(f.y * 0.50, -0.22 * L);
	T = A + vec2(f.y * 0.90, f.z * L);
	W = f.w;
}

// Mede a folha: x = a distância à beira, y = o lado (> 0 na metade da luz), z = t ao longo,
// w = a meia largura ali.
vec4 medir_folha_g(vec2 q, vec2 A, vec2 B, vec2 T, float W) {
	vec2 r = bezier_perto_g(q, A, B, T);
	float t = r.y;
	vec2 tg = 2.0 * (1.0 - t) * (B - A) + 2.0 * t * (T - B);
	vec2 P = na_curva(A, B, T, t);
	vec2 v = q - P;
	float cr = tg.x * v.y - tg.y * v.x;
	// A metade de cima (a que olha para o céu) é a da luz, nos dois lados do caule.
	vec2 dir = normalize(T - A + vec2(1e-5));
	float lado_luz = dot(vec2(dir.y, -dir.x), vec2(-0.35, -0.94)) >= 0.0 ? 1.0 : -1.0;
	float s = (cr < 0.0 ? 1.0 : -1.0) * lado_luz;
	// O cabinho curto e fino; depois a lâmina em coração: larga logo depois da base e
	// afinando numa ponta larga, sem espinho.
	const float CABO = 0.14;
	float tb = clamp((t - CABO) / (1.0 - CABO), 0.0, 1.0);
	// t^0,5 (1 - t)^1,1: a base redonda e larga (o coração), o máximo a um terço e a ponta
	// fina; 2,70 leva o máximo a 1.
	float lam = 2.70 * pow(tb, 0.5) * pow(max(1.0 - tb, 0.0), 1.1);
	float w = max(W * lam, 0.0085 * (1.0 - smoothstep(CABO, CABO + 0.12, t)));
	return vec4(r.x - w, r.x * s, t, max(w, 1e-3));
}

// ---------- a pintura ----------

// Uma peça por cima do que já está pintado (alfa pré-multiplicado): primeiro a sombra que ela
// joga embaixo à direita, depois o contorno e o miolo. O contorno é grosso por fora (esp_fora)
// e fino por cima de outra peça (esp_dentro).
vec4 por_peca(vec4 acc, float d, float d_s, vec3 cor, vec3 cont, float esp_fora, float esp_dentro, float px) {
	float cov = cobre(d, px);
	float sh = (1.0 - smoothstep(-0.014, 0.014, d_s)) * (1.0 - cov);
	acc.rgb *= 1.0 - 0.30 * sh;
	float esp = mix(esp_fora, esp_dentro, acc.a);
	acc = sobre(acc, cont, cov);
	acc = sobre(acc, cor, cobre(d + esp, px));
	return acc;
}

// Os tons de um pé de trás: mais escuros e um pouco mais frios.
vec3 ao_fundo(vec3 c, float fundo) {
	return mix(c, c * vec3(0.80, 0.83, 0.86), fundo);
}

vec3 tom_do_ouro(vec3 c, float ouro) {
	// Limão: um tico mais de verde; âmbar: um tico menos (contido, ±4%).
	return c * vec3(1.0, 1.0 - 0.045 * ouro, 1.0 - 0.10 * ouro);
}

vec4 pintar_folha(vec4 acc, vec2 qo, float px, Pe p, int j, bool de_tras, float traco) {
	vec2 A;
	vec2 B;
	vec2 T;
	float W;
	folha_geo(p, j, A, B, T, W);
	vec4 mf = medir_folha_g(qo, A, B, T, W);
	vec4 ms = medir_folha_g(qo - SOMBRA_DENTRO, A, B, T, W);
	float d = smax_g(mf.x, qo.y - CHAO_ABAIXO_DO_PE, 0.01);
	float d_s = ms.x;
	vec3 c_luz = de_tras ? VERDE_SOMBRA : VERDE_MEIO;
	vec3 c_sombra = de_tras ? VERDE_FUNDO : VERDE_SOMBRA;
	// A nervura: a beira entre as duas metades, um tico para o lado da sombra e ondulando
	// largo (duas ondas por folha), para não ser uma régua.
	float onda = sin(mf.z * 6.0 + float(j) * 1.7) * 0.10;
	float m1 = smoothstep(-0.003, 0.003, mf.y + mf.w * (0.06 + onda));
	vec3 c = mix(c_sombra, c_luz, m1);
	// O boné de luz: só nas folhas que apontam para a luz (para a esquerda), na beira de cima.
	vec2 dir = normalize(T - A + vec2(1e-5));
	float olha = smoothstep(-0.2, 0.5, dot(dir, vec2(-0.94, -0.34)));
	float limiar = mf.w * mix(0.55, 0.95, smoothstep(0.25, 0.75, mf.z));
	float m2 = smoothstep(-0.003, 0.003, mf.y - limiar) * smoothstep(0.22, 0.34, mf.z);
	c = mix(c, de_tras ? VERDE_MEIO : VERDE_LUZ, m2 * step(0.5, olha));
	c = ao_fundo(c, p.fundo);
	vec3 cont = ao_fundo(VERDE_CONTORNO, p.fundo * 0.5);
	float lado_sombra = 0.5 - 0.5 * clamp(mf.y / mf.w, -1.0, 1.0);
	float esp = mix(1.4, 2.2, smoothstep(0.2, 0.85, lado_sombra)) * traco;
	return por_peca(acc, d, d_s, c, cont, esp, 0.9 * traco, px);
}

vec4 pintar_caule(vec4 acc, vec2 qo, float px, Pe p, float traco) {
	vec2 A;
	vec2 B;
	vec2 C;
	caule(p, A, B, C);
	vec2 r = bezier_perto_g(qo, A, B, C);
	vec2 rs = bezier_perto_g(qo - SOMBRA_DENTRO, A, B, C);
	float w0 = p.caule;
	float w1 = p.caule * 0.70;
	float d = r.x - mix(w0, w1, r.y);
	float d_s = rs.x - mix(w0, w1, rs.y);
	d = max(d, qo.y - CHAO_ABAIXO_DO_PE);
	// O lado da luz: a metade da esquerda.
	vec2 tg = 2.0 * (1.0 - r.y) * (B - A) + 2.0 * r.y * (C - B);
	vec2 v = qo - na_curva(A, B, C, r.y);
	float cr = tg.x * v.y - tg.y * v.x;
	float esquerda = smoothstep(-0.002, 0.002, cr);
	float de_tras = p.fundo;
	vec3 c = mix(VERDE_SOMBRA, VERDE_MEIO, esquerda);
	// Perto do pé o caule escurece: assenta no chão.
	c *= mix(1.0, 0.78, smoothstep(-0.14, 0.0, qo.y));
	c = ao_fundo(c, de_tras);
	vec3 cont = ao_fundo(mix(VERDE_CONTORNO, VERDE_FUNDO, 0.55), de_tras * 0.5);
	float esp = mix(0.85, 1.15, 1.0 - esquerda) * traco;
	return por_peca(acc, d, d_s, c, cont, esp, 0.9 * traco, px);
}

vec4 pintar_cabeca(vec4 acc, vec2 qo, float px, Pe p, int sem, float traco) {
	float R = p.raio;
	vec2 v = qo - p.cab;
	float lf = dot(normalize(v + vec2(1e-5)), LUZ);
	float lado_sombra = 0.5 - 0.5 * lf;
	float esp_fora = mix(1.2, 1.9, smoothstep(0.2, 0.85, lado_sombra)) * traco;
	float esp_dentro = 0.9 * traco;
	float u;

	// O cálice, verde, atrás das pétalas: só aparece quando a cabeça vira muito.
	if (p.achata < 0.78) {
		float dc = calice_d(qo, p);
		float dcs = calice_d(qo - SOMBRA_DENTRO, p);
		vec3 cc = ao_fundo(mix(VERDE_SOMBRA, VERDE_MEIO, smoothstep(-0.3, 0.5, lf)), p.fundo);
		acc = por_peca(acc, dc, dcs, cc, ao_fundo(VERDE_CONTORNO, p.fundo * 0.5), esp_fora, esp_dentro, px);
	}

	// A coroa de trás: só as pontas, nos vãos da da frente, num tom só. A linha entre ela e a
	// da frente é fina e quase no tom dela: não vira serrilha.
	float dt = coroa(qo, p, COROA_TRAS_DENTRO, COROA_TRAS_PONTA, 0.5, sem + 7, u);
	float dts = coroa(qo - SOMBRA_DENTRO, p, COROA_TRAS_DENTRO, COROA_TRAS_PONTA, 0.5, sem + 7, u);
	vec3 ct = mix(PETALA_TRAS, PETALA_SOMBRA, 0.45 * smoothstep(-0.1, 0.6, lf));
	ct = ao_fundo(tom_do_ouro(ct, p.ouro), p.fundo * 0.55);
	vec3 cont = ao_fundo(tom_do_ouro(PETALA_CONTORNO, p.ouro), p.fundo * 0.6);
	acc = por_peca(acc, dt, dts, ct, cont, esp_fora, esp_dentro, px);

	// A coroa da frente em 3 zonas LARGAS, como uma copa: o meio em quase toda ela; a sombra
	// só no lado de baixo à direita (uma faixa, não pétala por pétala); e o boné de luz nas
	// pontas de cima à esquerda, encostado na beira clara.
	float df = coroa(qo, p, COROA_FRENTE_DENTRO, COROA_FRENTE_PONTA, 0.0, sem + 11, u);
	float dfs = coroa(qo - SOMBRA_DENTRO * 0.8, p, COROA_FRENTE_DENTRO, COROA_FRENTE_PONTA, 0.0, sem + 11, u);
	vec3 dk = no_disco(qo, p.cab, p);
	float ondula = 0.10 * sin(dk.y * 3.0 + p.fase * 6.0);
	vec3 cf = mix(PETALA_SOMBRA, PETALA_MEIO, smoothstep(-0.62, -0.48, lf + ondula));
	float uu;
	float dl = coroa(qo - LUZ * 0.08 * R, p, COROA_FRENTE_DENTRO, COROA_FRENTE_PONTA, 0.0, sem + 11, uu);
	float pontas = smoothstep(0.66, 0.74, dk.x / R);
	float luz_cima = smoothstep(0.30, 0.46, lf - ondula);
	cf = mix(cf, PETALA_LUZ, pontas * luz_cima * cobre(dl + 0.004, px * 1.5));
	cf = ao_fundo(tom_do_ouro(cf, p.ouro), p.fundo * 0.55);
	vec3 linha = mix(cont, ct, 0.45);
	float esp_linha = 0.7 * traco;
	float cov_f = cobre(df, px);
	float sh_f = (1.0 - smoothstep(-0.014, 0.014, dfs)) * (1.0 - cov_f);
	acc.rgb *= 1.0 - 0.22 * sh_f;
	float por_cima = acc.a;
	acc = sobre(acc, mix(cont, linha, por_cima), cov_f);
	acc = sobre(acc, cf, cobre(df + mix(esp_fora, esp_linha, por_cima), px));

	// O miolo: massa calma; a luz num crescente largo encostado na beira de cima à esquerda,
	// a sombra num crescente embaixo à direita.
	float dmi = miolo_d(qo, p, 1.0);
	float dmis = miolo_d(qo - SOMBRA_DENTRO * 0.9, p, 1.0);
	float d_luz = miolo_d(qo + LUZ * 0.30 * R * RAIO_DO_MIOLO, p, 1.0);
	float d_som = miolo_d(qo - LUZ * 0.26 * R * RAIO_DO_MIOLO, p, 1.0);
	vec3 cm = MIOLO_MEIO;
	cm = mix(cm, MIOLO_LUZ, smoothstep(-0.006, 0.006, d_luz) * 0.9);
	cm = mix(cm, MIOLO_SOMBRA, smoothstep(-0.006, 0.006, d_som));
	cm = ao_fundo(cm, p.fundo * 0.55);
	float esp_m = mix(1.2, 1.8, smoothstep(0.2, 0.85, lado_sombra)) * traco;
	acc = por_peca(acc, dmi, dmis, cm, ao_fundo(MIOLO_CONTORNO, p.fundo * 0.5), esp_m, esp_m, px);
	return acc;
}

// Um pé inteiro por cima de acc: as folhas de trás, o caule, as da frente e a cabeça.
vec4 pintar_pe(vec4 acc, vec2 qo, float px, Pe p, int sem, float traco) {
	for (int j = 0; j < 3; j++) {
		if (j < p.folhas && ((p.atras >> j) & 1) == 1) {
			acc = pintar_folha(acc, qo, px, p, j, true, traco);
		}
	}
	acc = pintar_caule(acc, qo, px, p, traco);
	for (int j = 0; j < 3; j++) {
		if (j < p.folhas && ((p.atras >> j) & 1) == 0) {
			acc = pintar_folha(acc, qo, px, p, j, false, traco);
		}
	}
	acc = pintar_cabeca(acc, qo, px, p, sem, traco);
	return acc;
}

Pe pe_vazio() {
	Pe p;
	p.x0 = 0.0;
	p.cab = vec2(0.0, -0.9);
	p.raio = 0.2;
	p.virada = -2.2;
	p.achata = 0.8;
	p.curva = 0.0;
	p.fundo = 0.0;
	p.fase = 0.0;
	p.petalas = 12;
	p.folhas = 0;
	p.f0 = vec4(0.0);
	p.f1 = vec4(0.0);
	p.f2 = vec4(0.0);
	p.atras = 0;
	p.ouro = 0.0;
	p.caule = 0.023;
	return p;
}

// O fim: a cor reta e o alfa, com o grão de papel leve.
vec4 fechar(vec4 acc, vec2 q, int sem) {
	vec2 pl = (q + vec2(2.0)) * 128.0;
	acc.rgb *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : VERDE_CONTORNO;
	return vec4(reta, acc.a);
}

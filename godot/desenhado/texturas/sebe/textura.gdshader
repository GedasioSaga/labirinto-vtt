// SEBE vista de cima (onda 3, lote 7; CONTRATO.md, seções 9.2 e 9.5). Parente do arbusto
// aprovado em 28/10 (texturas/arbusto/): os mesmos tons, o mesmo contorno e o mesmo cacho
// largo, só que visto de cima e correndo ao longo de uma linha.
//
// - Uma fileira de cachos LARGOS e compridos que se emendam: 8 por período de 4 casas, de
//   tamanhos desiguais e um pouco desencontrados de um lado para o outro. A emenda entre dois
//   cachos é um vale raso na beira; por cima, um festão miúdo de comprimentos desiguais,
//   outro em cada lado. Nunca um tubo liso nem uma serrilha regular.
// - Cada cacho tem uma altura. Entre dois vizinhos, o mais alto fica na frente: a divisa é um
//   arco de vale a vale que embarriga para o lado do mais baixo, e nele cai um crescente
//   escuro (a sombra de dentro do arbusto; aqui ela não depende da luz). Vizinhos de altura
//   parecida quase não marcam a divisa: os cachos se emendam, e como a altura sobe e desce
//   sem ordem, os crescentes não marcam um ritmo.
// - A COR vai sem luz de direção (o app acende pelo relevo depois de deitar a sebe na reta
//   ou no arco): o tom de cada cacho, um ombro claro em volta da beira, os crescentes e o
//   contorno, a própria cor escurecida.
// - O RELEVO arredonda o alto: no ombro, a superfície inclina para fora da beira de uma forma
//   lisa (a união larga dos cachos, sem o festão, para a luz não pegar bico de vale); no
//   alto, quase plana. O app acende o ombro do lado da luz e escurece o do outro, em qualquer
//   giro e em cada ponto da curva: a luz sai como o boné do arbusto, encostada na borda clara.
// - A ponta é um cacho baixo atrás do corpo, arredondado, com três lóbulos; o app espelha a
//   do fim. O corpo entra nela por um arco, com o crescente por trás: onde a sebe termina no
//   meio de qualquer cacho, a ponta entra como mais um cacho, não como um corte.
//
// q em px do mundo (64 px = 1 casa): q.x = s ao longo (de -ponta a 0 é a ponta do começo;
// depois repete a cada L); q.y = c atravessando (+ para baixo quando a sebe anda para a
// direita).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"

// Os tons do arbusto aprovado (texturas/arbusto/, a forma de sempre).
const vec3 T_LUZ = vec3(0.400, 0.643, 0.384);
const vec3 T_MEIO = vec3(0.251, 0.490, 0.302);
const vec3 T_SOMBRA = vec3(0.184, 0.396, 0.259);
const vec3 T_FUNDO = vec3(0.141, 0.318, 0.212);
const vec3 T_CONTORNO = vec3(0.110, 0.255, 0.173);

const int CACHOS = 8;
// O período em que a tabela dos cachos foi desenhada (o config pede L = 256).
const float PERIODO_DA_TABELA = 256.0;
// O contorno, em px do mundo (o traço do protótipo do Fogo, como no arbusto).
const float TRACO = 1.8;
// A união dos cachos: rasa na silhueta (o vale fica redondo, sem bico) e larga na forma
// lisa que dá a normal da luz.
const float UNIAO = 1.5;
const float UNIAO_LISA = 7.0;
// O quanto a divisa entre dois cachos embarriga para o lado do mais baixo (px).
const float BOJO = 5.0;
// O crescente junto da divisa: largura (px), força, e quanto sobra dele no meio da sebe
// (perto da beira é inteiro).
const float CRESCENTE = 3.6;
const float FORCA_DO_CRESCENTE = 0.8;
const float CRESCENTE_NO_MEIO = 0.0;
const float CRESCENTE_NO_MEIO_DA_PONTA = 0.4;
// O ombro: largura (px para dentro da beira) e o quanto a altura, o meio do cacho e as
// folhas mexem nela. Largo no meio de cada cacho e estreito na divisa: a luz do app sai
// como um boné por cacho, encostado na borda clara.
const float OMBRO = 2.6;
const float OMBRO_DA_ALTURA = 0.8;
const float OMBRO_DO_CACHO = 6.0;
const float OMBRO_DAS_FOLHAS = 1.8;
// O claro do ombro (entre o meio e a luz do arbusto); o app acende ainda mais o do lado da
// luz e escurece o do outro lado para perto do tom do alto.
const float CLARO_DO_OMBRO = 0.75;
// O alto, um tico acima do tom do meio do arbusto (a sebe é fina: o contorno pesa mais nela).
const float CLARO_DO_ALTO = 0.12;
// A ponta: a folga para os lóbulos, a meia largura, o quanto o arco do corpo entra nela e
// o jeito do cacho da ponta (baixo: o crescente cai nele).
const float FOLGA_DA_PONTA = 2.2;
const float B_DA_PONTA = 12.6;
const float RECUO_DO_ARCO = 5.0;
const vec2 JEITO_DA_PONTA = vec2(0.25, -0.4);

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

// O cacho i: x = centro ao longo (px, na tabela de 256), y = meio comprimento, z = meia
// largura, w = desvio atravessando (+ para baixo). Os vãos vão de 20 a 54 px (o maior quase
// três vezes o menor), numa ordem sem ritmo: curto, comprido, curto, o mais comprido... O
// meio comprimento é 0,9 do vão, então dois vizinhos se cruzam a ~0,55 da soma e o vale da
// emenda fica entre 1,5 e 3 px, um festão raso. O período começa (s = 0) no flanco do cacho
// 0, onde o ombro tem a largura média do período (pi/4 do boné inteiro): a ponta copia esse
// ombro, então o começo emenda sem degrau e o fim, que para numa fase qualquer, erra pouco.
vec4 cacho(int i) {
	return i == 0 ? vec4(14.3, 41.4, 13.4, 0.0)
		: i == 1 ? vec4(49.3, 21.6, 12.4, 1.1)
		: i == 2 ? vec4(81.3, 36.0, 13.5, -0.7)
		: i == 3 ? vec4(111.3, 18.0, 12.1, 1.0)
		: i == 4 ? vec4(148.3, 48.6, 13.6, -0.5)
		: i == 5 ? vec4(190.3, 27.0, 12.9, 0.9)
		: i == 6 ? vec4(216.3, 19.8, 12.2, -1.0)
		: vec4(237.3, 18.0, 12.6, 0.6);
}

// x = altura (0 = baixo, 1 = alto), y = tom (-1 a 1). i < 0 = o cacho da ponta. O cacho 0
// é o que a ponta imita no arco (o corpo de qualquer fase casa com ele: tom 0).
vec2 jeito(int i) {
	return i < 0 ? JEITO_DA_PONTA
		: i == 0 ? vec2(0.55, 0.0)
		: i == 1 ? vec2(0.85, 0.5)
		: i == 2 ? vec2(0.4, -0.6)
		: i == 3 ? vec2(0.9, 0.8)
		: i == 4 ? vec2(0.3, -0.3)
		: i == 5 ? vec2(0.7, 0.4)
		: i == 6 ? vec2(0.2, -0.7)
		: vec2(0.65, 0.2);
}

vec2 centro(int i, int k, float L) {
	vec4 b = cacho(i);
	return vec2(b.x * L / PERIODO_DA_TABELA + float(k) * L, b.w);
}

// Um festão de m lóbulos por período, de comprimentos desiguais (o seno entorta a conta
// sem mudar o total), com um vale em s = 0. Devolve quanto a beira sai, em px.
float festao(float s, float L, float m, float n, float A, float fase, float fundo, int sem) {
	float u = m * s / L + A / TAU * (sin(TAU * n * s / L + fase) - sin(fase));
	float j = mod(floor(u), m);
	float f = fract(u);
	float alto = fundo * (0.45 + 0.75 * rk(hash_cel(vec2(j, m), sem), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

// Os lóbulos da ponta, pelo ângulo em volta do meio da ponta, com vale nas duas beiras
// (onde a ponta encosta no corpo) e entre eles.
float lobos_da_ponta(float th, float quantos, float fundo, int sem) {
	float u = (th / PI + 0.5) * quantos;
	float j = clamp(floor(u), 0.0, quantos - 1.0);
	float f = fract(u);
	float alto = fundo * (0.6 + 0.6 * rk(hash_cel(vec2(j, quantos + 40.0), sem), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.65);
}

float sd_ponta(vec2 q, float ponta) {
	return sd_elipse(q, vec2(max(ponta - FOLGA_DA_PONTA, 4.0), B_DA_PONTA));
}

// A união dos cachos (k = a suavidade), sem o festão.
float uniao(vec2 q, float L, float k) {
	float d = 1e9;
	for (int c = -1; c <= 1; c++) {
		for (int i = 0; i < CACHOS; i++) {
			vec4 b = cacho(i);
			d = smin(d, sd_elipse(q - centro(i, c, L), vec2(b.y * L / PERIODO_DA_TABELA, b.z)), k);
		}
	}
	return d;
}

// A silhueta que se vê (negativa dentro): a união rasa dos cachos e o festão miúdo, um em
// cada lado, com contas diferentes (nunca o espelho do outro).
float silhueta(vec2 q, float L, float ponta, int sem) {
	if (q.x < 0.0) {
		return sd_ponta(q, ponta) - lobos_da_ponta(atan(q.y, -q.x), 3.0, 1.25, sem + 301);
	}
	float cima = festao(q.x, L, 15.0, 2.0, 3.0, 0.0, 1.3, sem + 101);
	float baixo = festao(q.x, L, 14.0, 3.0, 2.2, 1.3, 1.3, sem + 131);
	return uniao(q, L, UNIAO) - mix(cima, baixo, smoothstep(-3.0, 3.0, q.y));
}

// A forma lisa que dá a normal da luz. "na_ponta" escolhe a função pelo ponto do meio, para
// a diferença finita perto de q.x = 0 não misturar a ponta com o corpo (as duas distâncias
// não são iguais ali, e a mistura inventava uma inclinação ao longo na emenda).
float forma_lisa(vec2 q, float L, float ponta, bool na_ponta) {
	return na_ponta ? sd_ponta(q, ponta) : uniao(q, L, UNIAO_LISA);
}

// A divisa entre o cacho m e o seguinte, ao longo: onde as duas elipses se cruzam (os
// vales de cima e de baixo ficam nela).
float divisa(int m, float L) {
	int n = (m + 1) % CACHOS;
	float esc = L / PERIODO_DA_TABELA;
	vec4 a = cacho(m);
	vec4 b = cacho(n);
	float xa = a.x * esc;
	float xb = b.x * esc + (n == 0 ? L : 0.0);
	return xa + (xb - xa) * a.y / (a.y + b.y);
}

// O crescente de uma divisa: "lado" = px a partir do arco, > 0 do lado do cacho mais baixo.
float crescente(float lado, float dh, float na_beira) {
	float e = 0.6;
	float forca = smoothstep(0.05, 0.4, abs(dh)) * FORCA_DO_CRESCENTE;
	return (1.0 - smoothstep(0.0, CRESCENTE, lado)) * smoothstep(-e, e, lado) * forca * na_beira;
}

// Quem aparece no ponto e o crescente que cai nele: x = tom (multiplicador da cor),
// y = quanto o ombro cresce ali (px), z = o crescente (0 a 1). A divisa entre dois cachos é um arco que sai do
// vale de cima, vai ao vale de baixo e embarriga BOJO px para o lado do mais baixo (o mais
// alto fica na frente); o crescente fica do lado do mais baixo, junto do arco, mais forte
// quanto maior a diferença de altura. "dentro" = px até a beira.
vec3 cachos(vec2 q, float L, float ponta, float dentro, int sem) {
	float beira = 1.0 - smoothstep(2.0, 7.0, dentro);
	float na_beira = mix(CRESCENTE_NO_MEIO, 1.0, beira);
	float e = 0.6;
	if (q.x < 0.0) {
		// A ponta: um cacho baixo, atrás do corpo. Entre a emenda (q.x = 0) e o arco, uma faixa
		// no tom do meio do corpo; depois do arco, o crescente em lente (fundo no meio, nada nas
		// beiras) e o cacho da ponta. No fim da sebe o corpo para numa fase qualquer de L: a
		// emenda cai na faixa (no alto, onde só o tom muda, e pouco) e, perto da beira, já
		// dentro do crescente, onde o arco encosta nela.
		float r = clamp(q.y / B_DA_PONTA, -1.0, 1.0);
		float arco = RECUO_DO_ARCO * (1.0 - r * r);
		float atras = -q.x - arco;
		float corpo = 1.0 - smoothstep(-e, e, atras);
		float forca = FORCA_DO_CRESCENTE * mix(CRESCENTE_NO_MEIO_DA_PONTA, 1.0, beira);
		float sombra = smoothstep(-e, e, atras) * (1.0 - smoothstep(0.0, CRESCENTE, atras)) * forca;
		float u = clamp(2.0 * (-q.x) / max(ponta - FOLGA_DA_PONTA, 4.0) - 1.0, -1.0, 1.0);
		float extra_ponta = OMBRO_DA_ALTURA * JEITO_DA_PONTA.x + 0.7 * OMBRO_DO_CACHO * sqrt(max(1.0 - u * u, 0.0));
		// A faixa repete o ombro do cacho 0 em s = 0 (o flanco dele, a largura média).
		float extra = mix(extra_ponta, OMBRO_DA_ALTURA * jeito(0).x + 0.785 * OMBRO_DO_CACHO, corpo);
		return vec3(mix(1.0 + 0.03 * JEITO_DA_PONTA.y, 1.0, corpo), extra, sombra);
	}
	float melhor = 1e9;
	int jm = 0;
	// Até a divisa da esquerda e até a da direita (px, pelo arco): o boné do ombro é um arco
	// entre as duas, fundo no meio do cacho e nada na divisa.
	float esq = 1e9;
	float dir = 1e9;
	for (int k = -1; k <= 1; k++) {
		for (int m = 0; m < CACHOS; m++) {
			int n = (m + 1) % CACHOS;
			float dh = jeito(m).x - jeito(n).x;
			float meio = 0.5 * (cacho(m).w + cacho(n).w);
			float r = clamp((q.y - meio) / B_DA_PONTA, -1.0, 1.0);
			float arco = divisa(m, L) + float(k) * L + BOJO * clamp(dh * 3.0, -1.0, 1.0) * (1.0 - r * r);
			float off = q.x - arco;
			if (off >= 0.0) {
				esq = min(esq, off);
			} else {
				dir = min(dir, -off);
			}
			if (abs(off) < abs(melhor)) {
				melhor = off;
				jm = m;
			}
		}
	}
	int a = jm;
	int b = (jm + 1) % CACHOS;
	float dh = jeito(a).x - jeito(b).x;
	float t = smoothstep(-e, e, melhor);
	float tom = mix(1.0 + 0.03 * jeito(a).y, 1.0 + 0.03 * jeito(b).y, t);
	float altura = mix(jeito(a).x, jeito(b).x, t);
	float u = 2.0 * esq / max(esq + dir, 1.0) - 1.0;
	float largo = smoothstep(10.0, 30.0, esq + dir);
	float extra = OMBRO_DA_ALTURA * altura + OMBRO_DO_CACHO * largo * sqrt(max(1.0 - u * u, 0.0));
	// A cunha de cada divisa é forte num lado só (sorteado): os vales de cima e de baixo não
	// caem juntos como gomos.
	float lado_forte = rk(hash_cel(vec2(float(jm), 7.0), sem + 503), 0) < 0.5 ? -1.0 : 1.0;
	float deste_lado = mix(0.35, 1.0, smoothstep(-2.0, 2.0, q.y * lado_forte));
	float sombra = crescente(dh > 0.0 ? melhor : -melhor, dh, na_beira) * deste_lado;
	return vec3(tom, extra, sombra);
}

// A largura do ombro (px para dentro da beira): mais larga onde a sebe é alta, com a beira
// das folhas em cachinhos (a luz do app sai recortada, não como uma faixa lisa).
float ombro(vec2 q, float L, float extra, int sem) {
	float folhas;
	if (q.x < 0.0) {
		folhas = lobos_da_ponta(atan(q.y, -q.x), 4.0, 1.0, sem + 401);
	} else {
		folhas = mix(festao(q.x, L, 23.0, 2.0, 5.0, 0.4, 1.0, sem + 151), festao(q.x, L, 21.0, 3.0, 4.0, 2.1, 1.0, sem + 171), smoothstep(-3.0, 3.0, q.y));
	}
	return OMBRO + extra + OMBRO_DAS_FOLHAS * folhas;
}

vec4 pintar_trecho(vec2 q, float L, float meia, float ponta, float px, int sem) {
	float d = silhueta(q, L, ponta, sem);
	float dentro = -d;
	vec3 ca = cachos(q, L, ponta, dentro, sem);

	// O alto no tom do meio; o ombro em volta da beira mais claro.
	float alto = smoothstep(ombro(q, L, ca.y, sem) - 0.7, ombro(q, L, ca.y, sem) + 0.7, dentro);
	vec3 c = mix(mix(T_MEIO, T_LUZ, CLARO_DO_OMBRO), mix(T_MEIO, T_LUZ, CLARO_DO_ALTO), alto) * ca.x;
	// O crescente, no tom da sombra (mais fundo perto da beira).
	c = mix(c, mix(T_SOMBRA, T_FUNDO, 0.3 * (1.0 - alto)) * ca.x, ca.z);

	// A mão de pintura: manchas largas, poucas pinceladas ao longo e o grão do papel. Tudo
	// repete a cada L (P = 2L em px da imagem).
	vec2 pl = vec2(q.x, q.y + 64.0) * 2.0;
	float P = 2.0 * L;
	c *= 1.0 + 0.05 * (rz(pl, 64.0, P, sem + 17) - 0.5);
	c *= 1.0 + 0.035 * pinceladas(pl, P, px * 2.0, sem + 23, 32.0, 0.0, 0.9);
	c *= 1.0 + (grao(pl, P, sem + 29) - 1.0) * 0.6;

	// O contorno: a própria cor escurecida, do mesmo traço do arbusto.
	vec3 c_traco = mix(T_CONTORNO, T_FUNDO, 0.25);
	vec4 acc = vec4(0.0);
	acc = sobre(acc, c_traco, cobre(d, px));
	acc = sobre(acc, c, cobre(d + TRACO, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : c_traco;
	return vec4(reta, acc.a);
}

// No ombro, a superfície inclina para fora da forma lisa; no alto, quase plana, com um resto
// do meio cilindro para o alto não ficar chapado.
vec2 relevo_do_trecho(vec2 q, float L, float meia, float ponta, float px, int sem) {
	float d = silhueta(q, L, ponta, sem);
	vec3 ca = cachos(q, L, ponta, -d, sem);
	float h = 0.5;
	bool na_ponta = q.x < 0.0;
	vec2 g = vec2(forma_lisa(q + vec2(h, 0.0), L, ponta, na_ponta) - forma_lisa(q - vec2(h, 0.0), L, ponta, na_ponta),
			forma_lisa(q + vec2(0.0, h), L, ponta, na_ponta) - forma_lisa(q - vec2(0.0, h), L, ponta, na_ponta));
	vec2 n = g / max(length(g), 1e-4);
	float bw = ombro(q, L, ca.y, sem);
	float alto = smoothstep(bw - 0.7, bw + 0.7, -d);
	vec2 cilindro = vec2(0.0, clamp(q.y / meia, -1.0, 1.0)) * 0.22;
	return mix(n, cilindro, alto);
}

#define TRECHO
#include "res://comum/rodape_carimbo.gdshaderinc"

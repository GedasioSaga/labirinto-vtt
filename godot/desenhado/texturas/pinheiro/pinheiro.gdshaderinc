// O desenho do PINHEIRO em pé, meio de lado (onda 3, lote 6; CONTRATO.md, seção 9).
// Incluído por texturas/pinheiro/textura.gdshader e por texturas/pinheiro-nevado/textura.gdshader
// (o com neve usa as MESMAS 4 silhuetas: a mesma geometria, a mesma semente no config).
// Precisa de comum/carimbo.gdshaderinc incluído antes.
//
// Da família da árvore aprovada em 28/10 (texturas/arvore/): a mesma vista, a mesma luz de
// cima à esquerda, o mesmo contorno (a própria cor escurecida, fino na luz e mais grosso na
// sombra) e o mesmo tronco, só mais curto.
//
// - 3 ou 4 SAIAS em camadas largas e a ponta fina em cima. Cada saia é um cone de lado
//   levemente côncavo (o galho abre embaixo) e a beira de baixo é um festão raso e largo
//   (3 a 5 ondas desiguais), as pontas da saia caindo um pouco. Nada de agulha nem serrilha.
// - Cada saia em três camadas, como os cachos da árvore: a massa inteira no tom da sombra;
//   por cima a mesma saia menor e andada para a luz, no tom do meio (sobra embaixo uma beira
//   escura, a barriga do galho, e a direita na sombra); e só nas saias de cima, encostado na
//   borda da esquerda, um boné de luz. A saia de cima faz sombra na de baixo, logo abaixo do
//   festão (uma massa embaixo à direita da outra): é ela que separa as camadas, sem linha
//   nenhuma por dentro. As saias de baixo ficam mais escuras (a de cima tampa a luz).
// - O verde é o do chão "pinheiros" aprovado: mais frio e mais escuro que o da árvore.
// - 4 formas bem diferentes: a 1 de 3 saias, reta; a 2 alta e fina, de 4 saias, inclinada
//   para a direita e mais azulada; a 3 baixa e larga, de 3 saias, inclinada para a esquerda
//   e mais quente; a 4 de 4 saias desencontradas (uma mais cheia de cada lado), a mais escura.
//
// q em unidades do tamanho, a partir do meio da imagem; o desenho é feito a partir do PÉ
// (qf = q - PE, y para baixo), que fica onde o pé de hoje fica (config: ancoraPx). Sem sombra
// no chão: ela é do app, pela silhueta.

// O pé em unidades a partir do meio da imagem: (ancoraPx - ladoPx / 2) / unidadePx. O mesmo
// nos dois configs (pinheiro e pinheiro-nevado).
const vec2 PE = vec2(0.003, 0.395);
const vec2 SOMBRA_DENTRO = vec2(0.022, 0.036);

float pin_smin(float a, float b, float r) {
	float h = clamp(0.5 + 0.5 * (b - a) / r, 0.0, 1.0);
	return mix(b, a, h) - r * h * (1.0 - h);
}

float pin_smax(float a, float b, float r) {
	return -pin_smin(-a, -b, r);
}

int pin_saias(int k) {
	return (k == 1 || k == 3) ? 4 : 3;
}

float pin_altura(int k) {
	if (k == 1) {
		return 1.04;
	}
	if (k == 2) {
		return 0.86;
	}
	if (k == 3) {
		return 0.97;
	}
	return 1.0;
}

// Quanto o eixo anda em x por unidade de altura (+ = o alto para a direita).
float pin_inclina(int k) {
	if (k == 1) {
		return 0.05;
	}
	if (k == 2) {
		return -0.035;
	}
	if (k == 3) {
		return 0.025;
	}
	return 0.0;
}

// A saia i (0 = a de baixo) da forma k: x = a base (y do festão), y = a ponta, z = a meia
// largura na base, w = o desencontro (+ = mais cheia à direita).
vec4 pin_saia_base(int k, int i) {
	if (k == 1) {
		if (i == 0) { return vec4(-0.11, -0.55, 0.28, 0.0); }
		if (i == 1) { return vec4(-0.34, -0.72, 0.235, 0.0); }
		if (i == 2) { return vec4(-0.55, -0.88, 0.185, 0.0); }
		return vec4(-0.74, -1.04, 0.135, 0.0);
	}
	if (k == 2) {
		if (i == 0) { return vec4(-0.085, -0.55, 0.39, 0.0); }
		if (i == 1) { return vec4(-0.35, -0.73, 0.30, 0.0); }
		return vec4(-0.56, -0.86, 0.20, 0.0);
	}
	if (k == 3) {
		if (i == 0) { return vec4(-0.10, -0.52, 0.33, 0.10); }
		if (i == 1) { return vec4(-0.33, -0.70, 0.26, -0.09); }
		if (i == 2) { return vec4(-0.53, -0.84, 0.21, 0.07); }
		return vec4(-0.71, -0.97, 0.14, 0.0);
	}
	if (i == 0) { return vec4(-0.10, -0.62, 0.34, 0.0); }
	if (i == 1) { return vec4(-0.40, -0.84, 0.27, 0.0); }
	return vec4(-0.64, -1.0, 0.19, 0.0);
}

vec4 pin_saia(int k, int i, int sem) {
	vec4 s = pin_saia_base(k, i);
	uint h = hash_cel(vec2(float(k), float(i) + 10.0), sem + 501);
	s.z *= 0.96 + 0.08 * rk(h, 0);
	s.x += (rk(h, 1) - 0.5) * 0.012;
	return s;
}

// O eixo de cada saia anda um pouco para os lados na forma 4 (as saias desencontradas).
float pin_desvio(int k, int i) {
	if (k == 3) {
		return i == 1 ? -0.016 : (i == 2 ? 0.012 : 0.0);
	}
	return 0.0;
}

// O festão da beira de baixo: m ondas rasas e largas, desiguais, de canto a canto.
// u = 0 no canto da esquerda, 1 no da direita. Devolve o quanto a beira desce ali.
float pin_festao(int k, int i, float w, float u, int sem) {
	uint h = hash_cel(vec2(float(k), float(i) + 20.0), sem + 601);
	float m = floor(2.6 + w * 8.0);
	float uu = u + (rk(h, 1) - 0.5) * 0.09 * sin(TAU * u);
	float t = uu * m;
	float f = fract(t);
	float j = floor(t);
	float alto = 0.021 * (0.65 + 0.7 * rk(hash_cel(vec2(float(k) * 8.0 + float(i), j), sem + 603), 0));
	float x = 2.0 * f - 1.0;
	return alto * pow(max(1.0 - x * x, 0.0), 0.6);
}

// A distância (com sinal, em unidades) até a saia i, encolhida por esc em volta do miolo dela
// e andada por desl (para as camadas do meio e da luz).
// fest = 1: a beira de baixo é o festão; fest = 0: um arco calmo (as camadas de dentro).
// onda: duas ondas largas na beira das camadas de dentro (a luz não é régua).
float sd_saia_f(int k, int i, vec2 p, int sem, float esc, vec2 desl, float fest, float onda) {
	vec4 s = pin_saia(k, i, sem);
	float b = s.x;
	float t = s.y;
	float w = s.z;
	float a = s.w;
	float h = b - t;
	vec2 piv = vec2(0.0, b - 0.4 * h);
	vec2 l = p;
	l.x -= pin_inclina(k) * (-l.y) + pin_desvio(k, i);
	l = (l - piv - desl) / esc + piv;
	float curva = (i == pin_saias(k) - 1) ? 1.4 : 1.12;
	float sy = clamp((l.y - t) / h, 0.0, 1.3);
	float lado = l.x >= 0.0 ? 1.0 + a : 1.0 - a;
	float hw = w * lado * pow(sy, curva);
	float incl = w * lado * curva / h;
	uint ho = hash_cel(vec2(float(k), float(i) + 90.0), sem + 907);
	float d_lado = (abs(l.x) - hw) / sqrt(1.0 + incl * incl) + onda * 0.7 * sin(TAU * (sy * 2.2 + rk(ho, 0)));
	float ux = clamp(l.x / (w * lado), -1.0, 1.0);
	float u = clamp((l.x + w * (1.0 - a)) / (2.0 * w), 0.0, 1.0);
	float yb = b + fest * pin_festao(k, i, w, u, sem) + (1.0 - fest) * 0.010 * sin(PI * u) + onda * sin(TAU * (u * 2.0 + rk(ho, 1))) + 0.028 * pow(abs(ux), 3.0);
	float d = pin_smax(d_lado, l.y - yb, 0.016);
	d = max(d, t - l.y);
	return d * esc;
}

float sd_saia(int k, int i, vec2 p, int sem, float esc, vec2 desl) {
	return sd_saia_f(k, i, p, sem, esc, desl, 1.0, 0.0);
}

float sd_pinheiro(int k, vec2 p, int sem) {
	float d = 1e9;
	for (int i = 0; i < 4; i++) {
		if (i >= pin_saias(k)) {
			break;
		}
		d = min(d, sd_saia(k, i, p, sem, 1.0, vec2(0.0)));
	}
	return d;
}

// Os tons: 0 = luz, 1 = meio, 2 = sombra, 3 = fundo (a sombra de dentro), 4 = contorno.
// A forma 1 tem os do chão "pinheiros" aprovado (PIN_LUZ, PIN_MEIO, PIN_SOMBRA, PIN_CONTORNO).
vec3 pin_tom(int k, int qual) {
	vec3 t0 = vec3(0.272, 0.505, 0.400);
	vec3 t1 = vec3(0.192, 0.388, 0.300);
	vec3 t2 = vec3(0.136, 0.284, 0.222);
	vec3 t3 = vec3(0.112, 0.236, 0.188);
	vec3 t4 = vec3(0.100, 0.205, 0.163);
	if (k == 1) {
		t0 = vec3(0.240, 0.478, 0.420);
		t1 = vec3(0.160, 0.358, 0.310);
		t2 = vec3(0.110, 0.256, 0.228);
		t3 = vec3(0.092, 0.214, 0.192);
		t4 = vec3(0.084, 0.184, 0.166);
	} else if (k == 2) {
		t0 = vec3(0.318, 0.548, 0.388);
		t1 = vec3(0.232, 0.428, 0.296);
		t2 = vec3(0.168, 0.320, 0.222);
		t3 = vec3(0.138, 0.268, 0.188);
		t4 = vec3(0.120, 0.232, 0.165);
	} else if (k == 3) {
		t0 = vec3(0.226, 0.440, 0.362);
		t1 = vec3(0.152, 0.326, 0.266);
		t2 = vec3(0.102, 0.230, 0.190);
		t3 = vec3(0.086, 0.192, 0.162);
		t4 = vec3(0.078, 0.168, 0.142);
	}
	return qual == 0 ? t0 : (qual == 1 ? t1 : (qual == 2 ? t2 : (qual == 3 ? t3 : t4)));
}

// O ponto do desenho, a partir do pé, com o tremido da mão (o mesmo nas duas peças).
vec2 pin_ponto(vec2 q, int sem, int k) {
	vec2 qf = q - PE;
	vec2 pl = (q + vec2(2.0)) * 128.0;
	return qf + 0.012 * (vec2(rz(pl, 64.0, 1024.0, sem + 31 + k), rz(pl, 64.0, 1024.0, sem + 37 + k)) - 0.5);
}

// A camada do meio e o boné de luz da saia i: a mesma saia, menor e andada para a luz.
float sd_saia_meio(int k, int i, vec2 qo, int sem) {
	float w = pin_saia(k, i, sem).z;
	return sd_saia_f(k, i, qo, sem, 0.88, vec2(-0.26 * w, -0.012), 0.0, 0.005);
}

float pin_luz_da_saia(int k, int i) {
	int n = pin_saias(k);
	return i == n - 1 ? 1.0 : (i == n - 2 ? 0.6 : 0.0);
}

float sd_saia_luz(int k, int i, vec2 qo, int sem) {
	float w = pin_saia(k, i, sem).z;
	float lz = pin_luz_da_saia(k, i);
	return sd_saia_f(k, i, qo, sem, mix(0.5, 0.64, lz), vec2(-0.42 * w, -0.03), 0.0, 0.009);
}

// A cor da copa (sem o contorno) e a distância até a silhueta dela.
vec4 pin_copa(vec2 q, float px, int sem, int k) {
	vec2 qo = pin_ponto(q, sem, k);
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float pxl = px * 128.0;
	int n = pin_saias(k);
	vec3 c_luz = pin_tom(k, 0);
	vec3 c_meio = pin_tom(k, 1);
	vec3 c_sombra = pin_tom(k, 2);
	vec3 c_fundo = pin_tom(k, 3);
	float mancha = rz(pl, 40.0, 1024.0, sem + 17 + k) - 0.5;
	vec3 c = c_fundo;
	float d = 1e9;
	float cobriu = 0.0;
	for (int i = 0; i < 4; i++) {
		if (i >= n) {
			break;
		}
		float alto = float(i) / float(n - 1);
		float di = sd_saia(k, i, qo, sem, 1.0, vec2(0.0));
		float cov = 1.0 - smoothstep(-0.006, 0.004, di);
		float ds = sd_saia(k, i, qo - SOMBRA_DENTRO, sem, 1.0, vec2(0.0));
		c = mix(c, c_fundo, (1.0 - smoothstep(-0.022, 0.022, ds)) * (1.0 - cov) * cobriu * 0.85);
		float baixo = 1.0 - alto;
		vec3 c_m = mix(c_meio, c_sombra, 0.22 * baixo * baixo);
		float m1 = 1.0 - smoothstep(-0.005, 0.005, sd_saia_meio(k, i, qo, sem) + mancha * 0.03);
		vec3 tl = mix(c_sombra, c_m, m1);
		float lz = pin_luz_da_saia(k, i);
		float m2 = 1.0 - smoothstep(-0.005, 0.005, sd_saia_luz(k, i, qo, sem) + mancha * 0.035);
		tl = mix(tl, c_luz, m2 * step(0.1, lz));
		c = mix(c, tl, cov);
		cobriu = max(cobriu, cov);
		d = min(d, di);
	}
	c *= 1.0 + 0.05 * pinceladas(pl, 1024.0, pxl, sem + 23 + k, 48.0, -0.785, 0.5);
	c *= 1.0 + (grao(pl, 1024.0, sem + 29) - 1.0) * 0.6;
	return vec4(c, d);
}

// O lado da sombra de um ponto da silhueta: 0 virado para a luz, 1 de costas.
float pin_lado_sombra(vec2 q, int k) {
	vec2 qf = q - PE;
	vec2 dir = normalize((qf - vec2(0.0, -0.5 * pin_altura(k))) * vec2(1.0, 0.6) + vec2(1e-4));
	return dot(dir, -LUZ) * 0.5 + 0.5;
}

// O tronco: um pedaço curto embaixo da saia de baixo, metade na luz, metade na sombra, a
// sombra da copa no alto dele e as raízes abrindo no chão. xyz = a cor, w = a distância.
vec4 pin_tronco(vec2 q, int sem, int k) {
	vec2 qf = q - PE;
	vec2 pl = (q + vec2(2.0)) * 128.0;
	float inc = pin_inclina(k);
	float b0 = pin_saia(k, 0, sem).x;
	vec2 topo = vec2(inc * (0.12 - b0), b0 - 0.12);
	float dt = sd_traco(qf, vec2(0.0, -0.008), topo, 0.030, 0.022);
	dt = pin_smin(dt, sd_traco(qf, vec2(-0.010, -0.018), vec2(-0.056, 0.006), 0.016, 0.006), 0.018);
	dt = pin_smin(dt, sd_traco(qf, vec2(0.010, -0.018), vec2(0.062, 0.009), 0.017, 0.006), 0.018);
	float eixo = inc * clamp(-qf.y, 0.0, 1.0);
	float lado = qf.x - eixo;
	vec3 t_luz = vec3(0.486, 0.361, 0.243);
	vec3 t_sombra = vec3(0.345, 0.251, 0.173);
	vec3 ct = mix(t_luz, t_sombra, smoothstep(-0.010, 0.0, lado));
	float na_sombra = 1.0 - smoothstep(-0.02, 0.02, sd_pinheiro(k, qf - vec2(0.02, 0.06), sem));
	ct = mix(ct, t_sombra * 0.7, na_sombra * 0.85);
	ct *= 1.0 + (grao(pl, 1024.0, sem + 41) - 1.0) * 0.6;
	return vec4(ct, dt);
}

const vec3 PIN_TRONCO_CONTORNO = vec3(0.243, 0.176, 0.122);

// O traço do contorno da copa: a cor e a espessura, mais fino na luz e mais grosso na sombra.
vec4 pin_traco(vec2 q, int k) {
	float traco = 1.0 / unidade_mundo;
	float ls = pin_lado_sombra(q, k);
	vec3 c_cont = pin_tom(k, 4);
	vec3 c_t = mix(mix(c_cont, pin_tom(k, 1), 0.35), c_cont, smoothstep(0.3, 0.8, ls));
	return vec4(c_t, mix(1.6, 2.6, smoothstep(0.2, 0.85, ls)) * traco);
}

vec4 pintar_pinheiro(vec2 q, float px, int sem, int k) {
	float traco = 1.0 / unidade_mundo;
	vec4 copa = pin_copa(q, px, sem, k);
	vec4 tr = pin_tronco(q, sem, k);
	vec4 ct = pin_traco(q, k);
	vec4 acc = vec4(0.0);
	acc = sobre(acc, PIN_TRONCO_CONTORNO, cobre(tr.w, px));
	acc = sobre(acc, tr.rgb, cobre(tr.w + 1.6 * traco, px));
	acc = sobre(acc, ct.rgb, cobre(copa.w, px));
	acc = sobre(acc, copa.rgb, cobre(copa.w + ct.w, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : (tr.w < copa.w ? PIN_TRONCO_CONTORNO : ct.rgb);
	return vec4(reta, acc.a);
}

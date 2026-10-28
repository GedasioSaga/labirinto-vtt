// =====================================================================
// base.gdshaderinc: a base do estilo Desenhado.
// Paleta (tokens da vila Meio-Termo e do protótipo do Fogo), sorteio
// determinístico, ruído periódico e formas com borda suave.
//
// Unidade: pixel do mundo (64 px = 1 casa, a grade do app).
// "P" é o período em px. Tudo que é calculado com o mesmo P repete sem
// emenda a cada P px. P precisa ser múltiplo de 256 (as células usadas
// são de 2, 4, 8, 16, 32, 64, 128 e 256 px).
// =====================================================================

// ---------- paleta ----------
const vec3 GRAMA = vec3(0.549, 0.749, 0.502);         // #8cbf80
const vec3 GRAMA_REALCE = vec3(0.635, 0.800, 0.573);  // #a2cc92
const vec3 GRAMA_SOMBRA = vec3(0.463, 0.675, 0.427);  // #76ac6d
const vec3 GRAMA_QUENTE = vec3(0.650, 0.765, 0.470);
const vec3 GRAMA_FRIA = vec3(0.420, 0.660, 0.480);
const vec3 TUFO = vec3(0.408, 0.612, 0.373);           // #689c5f
const vec3 TERRA = vec3(0.867, 0.647, 0.424);          // #dda56c
const vec3 TERRA_SOMBRA = vec3(0.780, 0.553, 0.345);   // #c78d58
const vec3 TERRA_AREIA = vec3(0.910, 0.745, 0.550);
const vec3 SEIXO = vec3(0.769, 0.569, 0.373);          // #c4915f
const vec3 SEIXO_CINZA = vec3(0.745, 0.700, 0.625);
const vec3 PRACA = vec3(0.863, 0.816, 0.714);          // #dcd0b6
const vec3 PRACA_REALCE = vec3(0.922, 0.886, 0.804);   // #ebe2cd
const vec3 PRACA_SOMBRA = vec3(0.737, 0.682, 0.580);   // #bcae94
const vec3 PRACA_JUNTA = vec3(0.702, 0.643, 0.529);    // #b3a487
const vec3 MUSGO = vec3(0.520, 0.610, 0.380);
const vec3 LIQUEN = vec3(0.720, 0.690, 0.430);
const vec3 CARVALHO = vec3(0.627, 0.482, 0.318);       // #a07b51
const vec3 NOGUEIRA = vec3(0.467, 0.341, 0.224);       // #775739
const vec3 PINHO = vec3(0.725, 0.600, 0.373);          // #b9995f
const vec3 LINHO = vec3(0.831, 0.780, 0.647);          // #d4c7a5
const vec3 VINHO = vec3(0.561, 0.290, 0.286);          // #8f4a49
const vec3 OCRE = vec3(0.698, 0.565, 0.310);           // #b2904f
const vec3 FERRO = vec3(0.365, 0.380, 0.392);          // #5d6164
const vec3 LATAO = vec3(0.722, 0.584, 0.322);          // #b89552
const vec3 REBOCO = vec3(0.937, 0.906, 0.812);         // #efe7cf
const vec3 PEDRA = vec3(0.765, 0.753, 0.698);          // #c3c0b2
const vec3 FOLHA = vec3(0.333, 0.682, 0.455);          // #55ae74
const vec3 FOLHA_ESCURA = vec3(0.275, 0.604, 0.388);   // #469a63
const vec3 FOLHA_CONTORNO = vec3(0.208, 0.435, 0.286); // #356f49
const vec3 FOLHA_SOMBRA = vec3(0.215, 0.480, 0.330);
const vec3 FOLHA_LUZ = vec3(0.560, 0.800, 0.590);
const vec3 ROSA = vec3(0.910, 0.635, 0.769);           // #e8a2c4
const vec3 AMARELO = vec3(0.941, 0.824, 0.400);        // #f0d266
const vec3 BRANCO = vec3(0.953, 0.937, 0.886);         // #f3efe2
const vec3 VIOLETA = vec3(0.659, 0.498, 0.796);        // #a87fcb
const vec3 MIOLO = vec3(0.788, 0.561, 0.227);          // #c98f3a
const vec3 TELHA = vec3(0.710, 0.431, 0.314);          // #b56e50
const vec3 SOMBRA = vec3(0.204, 0.141, 0.094);         // rgba(52,36,24)
const vec3 SOMBRA_VERDE = vec3(0.149, 0.227, 0.133);   // rgba(38,58,34)
// Para onde fica a luz: cima e esquerda (as sombras caem para baixo e para a direita).
const vec2 LUZ = vec2(-0.7071, -0.7071);

// ---------- sorteio: mesma semente, mesma imagem ----------
uint hash_u(uint v) {
	uint s = v * 747796405u + 2891336453u;
	uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
	return (w >> 22u) ^ w;
}

// Célula inteira (já com o "mod" do período aplicado por quem chama).
uint hash_cel(vec2 c, int sem) {
	uint x = uint(int(c.x) + 65536);
	uint y = uint(int(c.y) + 65536);
	return hash_u(x + hash_u(y + hash_u(uint(sem) + 374761393u)));
}

float u01(uint v) {
	return float(v >> 8u) * (1.0 / 16777216.0);
}

// O k-ésimo número sorteado de uma célula (h = hash_cel da célula).
float rk(uint h, int k) {
	return u01(hash_u(h + uint(k) * 2654435769u));
}

float rnd(vec2 c, int sem, int k) {
	return rk(hash_cel(c, sem), k);
}

// ---------- ruído de gradiente periódico (per = período em células) ----------
float ruido_p(vec2 p, vec2 per, int sem) {
	vec2 i = floor(p);
	vec2 f = p - i;
	vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	float a0 = TAU * u01(hash_cel(mod(i, per), sem));
	float a1 = TAU * u01(hash_cel(mod(i + vec2(1.0, 0.0), per), sem));
	float a2 = TAU * u01(hash_cel(mod(i + vec2(0.0, 1.0), per), sem));
	float a3 = TAU * u01(hash_cel(mod(i + vec2(1.0, 1.0), per), sem));
	float n0 = dot(vec2(cos(a0), sin(a0)), f);
	float n1 = dot(vec2(cos(a1), sin(a1)), f - vec2(1.0, 0.0));
	float n2 = dot(vec2(cos(a2), sin(a2)), f - vec2(0.0, 1.0));
	float n3 = dot(vec2(cos(a3), sin(a3)), f - vec2(1.0, 1.0));
	return clamp(0.5 + 0.72 * mix(mix(n0, n1, u.x), mix(n2, n3, u.x), u.y), 0.0, 1.0);
}

// Ruído em px: "cel" px por célula. P precisa ser múltiplo de cel.
float rz(vec2 p, float cel, float P, int sem) {
	return ruido_p(p / cel, vec2(P / cel), sem);
}

float fbm_p(vec2 p, vec2 per, int sem, int oitavas) {
	float t = 0.0;
	float a = 0.5;
	float s = 0.0;
	for (int k = 0; k < 4; k++) {
		if (k >= oitavas) {
			break;
		}
		t += a * ruido_p(p, per, sem + k * 17);
		s += a;
		p *= 2.0;
		per *= 2.0;
		a *= 0.5;
	}
	return t / s;
}

float fz(vec2 p, float cel, float P, int sem, int oitavas) {
	return fbm_p(p / cel, vec2(P / cel), sem, oitavas);
}

// ---------- formas com borda suave ----------
// Cobertura de uma forma de distância d (negativa dentro), com 1 px de suavização.
float cobre(float d, float px) {
	return clamp(0.5 - d / px, 0.0, 1.0);
}

float sd_caixa(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + vec2(r);
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// Normal da caixa arredondada (diferença central), para chanfro e luz.
vec2 normal_caixa(vec2 p, vec2 b, float r) {
	vec2 g = vec2(sd_caixa(p + vec2(0.6, 0.0), b, r) - sd_caixa(p - vec2(0.6, 0.0), b, r),
			sd_caixa(p + vec2(0.0, 0.6), b, r) - sd_caixa(p - vec2(0.0, 0.6), b, r));
	return g / max(length(g), 1e-5);
}

// Traço que afina de ra até rb (risco de capim, rachadura, veio).
float sd_traco(vec2 p, vec2 a, vec2 b, float ra, float rb) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
	return length(pa - ba * hh) - mix(ra, rb, hh);
}

// Elipse (aproximação de primeira ordem; boa perto da borda).
float sd_elipse(vec2 p, vec2 ab) {
	p += vec2(1e-4, 1.3e-4);
	float k0 = length(p / ab);
	float k1 = length(p / (ab * ab));
	return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

vec2 girar(vec2 p, float a) {
	float c = cos(a);
	float s = sin(a);
	return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Camadas com alfa pré-multiplicado.
vec4 sobre(vec4 acc, vec3 c, float a) {
	return vec4(c * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a));
}

vec3 aplicar(vec3 fundo, vec4 camada) {
	return fundo * (1.0 - camada.a) + camada.rgb;
}

// Grão de papel: tira o chapado do digital (cerca de 3%).
float grao(vec2 p, float P, int sem) {
	return 1.0 + 0.05 * (rz(p, 4.0, P, sem) - 0.5) + 0.035 * (rz(p, 2.0, P, sem + 1) - 0.5);
}

// Pinceladas curtas, uma por célula: dão à cor a mão de pintura. Devolve -1..1.
float pinceladas(vec2 p, float P, float px, int sem, float cel, float ang0, float abertura) {
	vec2 c0 = floor(p / cel);
	vec2 per = vec2(P / cel);
	float valor_p = 0.0;
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 c = c0 + vec2(float(i), float(j));
			uint h = hash_cel(mod(c, per), sem);
			vec2 o = (c + vec2(rk(h, 0), rk(h, 1))) * cel;
			float ang = ang0 + (rk(h, 2) - 0.5) * abertura;
			vec2 dir = vec2(cos(ang), sin(ang)) * cel * (0.32 + 0.3 * rk(h, 3));
			float d = sd_traco(p, o - dir, o + dir, cel * 0.17, cel * 0.07);
			float a = clamp(0.5 - d / max(px, cel * 0.12), 0.0, 1.0);
			valor_p = mix(valor_p, rk(h, 4) * 2.0 - 1.0, a);
		}
	}
	return valor_p;
}

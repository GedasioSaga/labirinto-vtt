// Duna: areia de deserto. Lote 3 da onda 1.
// Base: o campo da areia aprovada (texturas/areia), mais seco (sem areia úmida) e sem a
// ondulação de praia; só um inchaço largo e baixo entre as dunas, lido pela luz, e o
// relevo fino da areia para o close.
// O atlas leva as dunas: barcanas e cristas de 2 a 3,5 casas, cada uma com a sua largura,
// a sua curva e o seu vento, o lado do vento claro e a face de sotavento em sombra. São
// peças soltas, espalhadas sem período e afastadas (passoCasas e afastarCasas): nunca uma
// faixa paralela à outra, nunca uma em cima da outra, com areia lisa entre elas.
// O tamanho é o teto do contrato: célula de 2 casas na escala 2 = 4 casas de lado, e a
// duna, com o lado claro e a sombra, ocupa a célula toda.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// Paleta da areia (texturas/areia/textura.gdshader, lote 2): os mesmos valores. A úmida
// (#bcaa86) fica de fora: no deserto não há areia molhada.
const vec3 AREIA = vec3(0.859, 0.778, 0.583);        // #dbc695
const vec3 AREIA_REALCE = vec3(0.948, 0.862, 0.646); // #f2dca5
const vec3 AREIA_SOMBRA = vec3(0.739, 0.654, 0.478); // #bca77a
const vec3 AREIA_SECA = vec3(0.886, 0.823, 0.663);   // #e2d2a9

// ---------- base ----------

// Um inchaço largo da areia (4 casas): uma altura de ruído que só a luz lê. Esticado
// na diagonal do vento (rodada 9), a 25% o chão virava pano amassado e a repetição caía
// para 0,74: a base não aguenta forma grande, que fica no atlas.
float inchaco(vec2 p, float P, int s) {
	return rz(p, 256.0, P, s + 30);
}

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// 1. O campo largo (4 casas), entre a sombra e o realce da areia, a um quinto.
	float n_g = rz(p, 256.0, P, s + 1);
	float n_m = rz(p, 128.0, P, s + 2);
	float t = smoothstep(0.2, 0.8, n_g * 0.6 + n_m * 0.4);
	vec3 c = mix(AREIA, mix(AREIA_SOMBRA, AREIA_REALCE, t), 0.16);
	// 2. Seca, em manchas de 2 a 3 casas torcidas e de borda macia; no deserto não há
	//    úmida, só um fundo um pouco mais quente onde a seca falta.
	vec2 w = vec2(rz(p, 128.0, P, s + 4), rz(p, 128.0, P, s + 14)) - 0.5;
	float n_b = rz(p + 32.0 * w, 128.0, P, s + 3) * 0.9 + rz(p + 32.0 * w, 64.0, P, s + 13) * 0.1;
	c = mix(c, AREIA_SECA, smoothstep(0.5, 0.8, n_b) * 0.2);
	c = mix(c, AREIA_SOMBRA, smoothstep(0.42, 0.15, n_b) * 0.05);
	// 3. O inchaço, só pela luz de cima à esquerda.
	float hA = inchaco(p - LUZ * 16.0, P, s);
	float hB = inchaco(p + LUZ * 16.0, P, s);
	c *= 1.0 + 0.16 * clamp(hA - hB, -0.2, 0.2);
	// 4. Relevo fino de areia (1/4 e 1/8 de casa) com luz, o da areia: no close a 300% o
	//    chão tem grão; a 50% a média é zero e ele some na cor.
	float gA = smoothstep(0.3, 0.7, rz(p - LUZ, 16.0, P, s + 9));
	float gB = smoothstep(0.3, 0.7, rz(p + LUZ, 16.0, P, s + 9));
	float fA = smoothstep(0.25, 0.75, rz(p - LUZ * 0.9, 8.0, P, s + 19));
	float fB = smoothstep(0.25, 0.75, rz(p + LUZ * 0.9, 8.0, P, s + 19));
	c *= 1.0 + 0.025 * (gA - gB) + 0.045 * (fA - fB);
	c *= grao(p, P, s + 16);
	return c;
}

// ---------- atlas ----------

// A face de sotavento, na sombra: a sombra da areia, um pouco mais funda.
const vec3 FACE = vec3(0.700, 0.612, 0.444); // AREIA_SOMBRA 75% + sombra_de(AREIA_SOMBRA) 25%

// O perfil do lado do vento: sobe macio do pé (inclinação 0) e fica cada vez mais
// íngreme até a crista. A luz cresce devagar do pé até a crista, sem contorno do lado do
// vento (com a subida em S da rodada 3 o lado claro virava uma lente, e a duna, folha).
float barlavento(float t) {
	return t * t;
}

// Uma duna em q (px do mundo na escala 1 da célula). Devolve (altura, face, beira):
// a face de sotavento como máscara (aresta da crista nítida, pé macio, pontas apagando)
// e a beira, uma faixa estreita do lado do vento colada na crista.
// o = centro; ang = para onde o vento sopra; tam = tamanho (a altura acompanha, então a
// inclinação é a mesma em toda duna); f = (meia largura, barlavento, sotavento, chifre:
// quanto as pontas avançam a favor do vento); torto = uma ponta mais comprida que a outra
// (ou a crista em S); ex = quão cedo a altura cai para as pontas.
vec3 duna(vec2 q, vec2 o, float ang, float tam, vec4 f, float torto, float ex, float px) {
	vec2 l = girar(q - o, -ang) / tam;
	float x = l.y / f.x;
	if (abs(x) >= 1.0) {
		return vec3(0.0);
	}
	float m = 1.0 - x * x;
	// A altura cai para as pontas sem quina: com pow(m, ex) puro (ex < 1) a borda das
	// pontas virava uma aresta clara do lado da luz (rodada 16).
	float hv = pow(m, ex) * smoothstep(0.0, 0.3, m);
	float u0 = 0.5 * (f.y - max(f.z, f.w));
	float crista = u0 + f.w * x * x + torto * x * x * x;
	float du = l.x - crista;
	float lw = f.y * (0.7 + 0.3 * m);
	float ls = f.z * (0.35 + 0.65 * hv);
	float sv = du / ls;
	float h = 0.0;
	if (du <= 0.0) {
		float t = 1.0 + du / lw;
		h = t > 0.0 ? barlavento(t) : 0.0;
	} else {
		h = sv < 1.0 ? (1.0 - sv) * (1.0 - sv) : 0.0;
	}
	float ponta = smoothstep(0.0, 0.22, hv);
	// A face lisa até a metade, o pé macio e, depois do pé, a sombra que a duna joga na
	// areia plana, mais clara e esfumada.
	float face = cobre(-du * tam, px) * ponta
			* max(1.0 - smoothstep(0.45, 1.0, sv), 0.4 * (1.0 - smoothstep(0.7, 1.7, sv)));
	float beira = cobre(du * tam, px) * (1.0 - smoothstep(0.0, 3.5, -du * tam)) * ponta;
	return vec3(h * hv * tam, face, beira);
}

// A duna pintada pela luz de cima à esquerda: o lado do vento, que encara a luz, clareia
// (mais na beira da crista); o lado contrário escurece de leve; a face de sotavento fica
// numa sombra lisa. A régua da inclinação é o barlavento: s = 1 é o lado do vento no meio.
vec4 duna_em(vec4 acc, vec2 q, vec2 o, float ang, float tam, vec4 f, float torto, float ex, float px) {
	const float D = 1.0;
	float hA = duna(q - LUZ * D, o, ang, tam, f, torto, ex, px).x;
	float hB = duna(q + LUZ * D, o, ang, tam, f, torto, ex, px).x;
	vec3 c = duna(q, o, ang, tam, f, torto, ex, px);
	float s = (hA - hB) / (2.0 * D) * f.y;
	float luz = 0.85 * smoothstep(0.0, 1.4, s);
	acc = sobre(acc, AREIA_REALCE, luz + 0.3 * c.z * (1.0 - luz));
	float meia = 0.16 * smoothstep(0.0, 1.2, -s) * (1.0 - c.y);
	return sobre(acc, FACE, max(meia, 0.6 * c.y));
}

// O atlas (4 células de 2 casas; o espelho na diagonal dobra para 8 formas). Cada duna
// tem o seu vento, entre 15 e 75 graus (de cima e da esquerda; o espelho troca o ângulo
// por 90 menos ele): o lado do vento sempre encara a luz, a face fica sempre do lado da
// sombra e as cristas não correm paralelas. O centro (o) e o tamanho (tam) de cada uma
// foram medidos para o alfa caber a 52 px do centro da célula, sem tocar a borda.
// O que não deu certo: face fina e lado claro fraco (rodadas 2 e 4) viravam vírgulas
// soltas a 25%; lado claro forte com a face curta (rodada 8), feijões.
//   0 barcana, quase em pé   1 crista comprida em S, na diagonal   2 barcana larga
//   3 barcana torta, com uma ponta mais comprida (um lombo baixo e redondo, sem face, na
//     rodada 14, virava bolinha a 25%)
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	const float GRAU = 0.017453;
	vec4 acc = vec4(0.0);
	if (i == 0) {
		acc = duna_em(acc, q, vec2(-12.5, -4.5), 15.0 * GRAU, 1.0, vec4(48.0, 50.0, 32.0, 14.0), 3.0, 0.8, px);
	} else if (i == 1) {
		acc = duna_em(acc, q, vec2(-7.8, -7.2), 40.0 * GRAU, 0.822, vec4(62.0, 46.0, 30.0, 6.0), 10.0, 0.7, px);
	} else if (i == 2) {
		acc = duna_em(acc, q, vec2(-13.2, -13.5), 52.0 * GRAU, 0.899, vec4(56.0, 50.0, 32.0, 18.0), -5.0, 0.8, px);
	} else {
		acc = duna_em(acc, q, vec2(-14.8, -7.2), 28.0 * GRAU, 1.0, vec4(52.0, 48.0, 30.0, 10.0), -12.0, 0.8, px);
	}
	// Garantia: nada encosta na borda da célula (4 px do mundo).
	acc *= 1.0 - smoothstep(54.0, 59.0, max(abs(q.x), abs(q.y)));
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

// Chão de sala (piso): textura TINGÍVEL. Lote 4 da onda 1.
// Decisão do usuário (28/10): "textura que pega a sua cor". O mestre continua
// escolhendo a cor da sala (FloorPiece.fillColor, Region.fillColor); o chão só
// deixa de ser chapado. Por isso esta textura não tem cor: é um mapa de VALOR em
// cinza (R = G = B), e o app tinge com a cor do mestre (config.json, "tingir").
//
// Codificação: cinza g = NEUTRO + FAIXA · v, com v (o relevo) entre -1 e 1.
// g = NEUTRO (0,5) é exatamente a cor do mestre; o app desloca a luz (L do
// OKLab) dela em AMPLITUDE_L · v. Por isso a imagem crua parece mais forte do
// que o chão tingido: a faixa de cinza está esticada para não perder degrau.
//
// Sem material: a sala pode ser madeira, pedra, tapete ou terra, e quem diz qual
// é a cor do mestre (para madeira e lajota de verdade há o Convés e as Lajotas).
// É a cor pintada a guache sobre papel: manchas largas e macias, tinta um pouco
// desigual, uma pincelada larga por casa, todas na mesma direção, e o grão.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

const float NEUTRO = 0.5;
const float FAIXA = 0.25;

// Ruído de valor em 1D, de -1 a 1 (as cerdas de uma pincelada).
float ruido_1d(float x, uint h) {
	float i = floor(x);
	float f = x - i;
	float u = f * f * (3.0 - 2.0 * f);
	float a = u01(hash_u(h + uint(int(i) + 4096) * 2246822519u));
	float b = u01(hash_u(h + uint(int(i) + 4097) * 2246822519u));
	return mix(a, b, u) * 2.0 - 1.0;
}

// Pincelada seca: no máximo uma por célula de "cel" px, de borda firme (1,5 px), com
// as cerdas correndo ao longo dela e a ponta que se desfaz onde a tinta acaba. Todas na
// mesma direção geral (ang0, com folga "abertura"). Devolve -1..1 (clara ou escura),
// 0 fora. A pinceladas() da base tem borda de cel·0,12 px: a 300% virava névoa.
float pinceladas_secas(vec2 p, float P, float px, int sem, float cel, float ang0, float abertura, float chance) {
	vec2 c0 = floor(p / cel);
	vec2 per = vec2(P / cel);
	float valor_p = 0.0;
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 c = c0 + vec2(float(i), float(j));
			uint h = hash_cel(mod(c, per), sem);
			vec2 o = (c + vec2(rk(h, 0), rk(h, 1))) * cel;
			// Em grupos: onde o ruído largo sobe há mais pinceladas, onde desce quase nenhuma.
			float quer = chance * smoothstep(0.25, 0.65, rz(o, 256.0, P, sem + 9));
			if (rk(h, 7) > quer) {
				continue;
			}
			float ang = ang0 + (rk(h, 2) - 0.5) * abertura;
			vec2 dir = vec2(cos(ang), sin(ang));
			vec2 nor = vec2(-dir.y, dir.x);
			float meio = cel * (0.38 + 0.22 * rk(h, 3));
			float larg = cel * (0.07 + 0.04 * rk(h, 5));
			vec2 q = p - o;
			float x = dot(q, dir);
			float u = x / meio;
			// Um arco leve, para a pincelada não sair régua.
			float y = dot(q, nor) - (rk(h, 6) - 0.5) * 1.2 * larg * u * u;
			float t = y / larg;
			// Cápsula: pontas redondas (a rodada 5 tinha ponta cortada em reta, que a
			// 100% lia como retângulo). Mais larga no começo, onde o pincel encosta.
			float xc = clamp(x, -meio, meio);
			float raio = larg * (1.0 - 0.4 * smoothstep(-0.3, 1.0, xc / meio));
			float d = length(vec2(x - xc, y)) - raio;
			float a = clamp(0.5 - d / max(px, 1.5), 0.0, 1.0);
			if (a <= 0.0) {
				continue;
			}
			float cerda = ruido_1d(t * 3.2 + 7.0 * rk(h, 8), h);
			// O pincel pousa macio e a tinta acaba antes nas cerdas de fora: o fim se desfaz em fios.
			a *= smoothstep(-1.05, -0.7, u);
			a *= 1.0 - smoothstep(0.35, 0.95, u + 0.35 * cerda + 0.25 * abs(t));
			// Clara ou escura, nunca forte: a pincelada é a mesma tinta passada de novo.
			// A escura mais fraca: a 50% ela lia como risco, a clara como luz.
			float tinta = (rk(h, 4) < 0.5 ? -0.7 : 1.0) * (0.35 + 0.65 * rk(h, 9));
			valor_p = mix(valor_p, tinta * (0.65 + 0.35 * cerda), a);
		}
	}
	return valor_p;
}

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// A mancha larga (2 a 7 casas) NÃO mora aqui: vem do tom do mundo (config.json,
	// tom), que não tem período. Na rodada 1 ela morava na base, num ruído de 4 casas
	// com 2 células por ladrilho, e a 25% virava uma camuflagem de bolhas iguais.
	// 1. A tinta um pouco desigual (1 a 2 casas), fraca e torcida para não sair redonda.
	vec2 w = vec2(rz(p, 128.0, P, s + 4), rz(p, 128.0, P, s + 14)) - 0.5;
	float v = (fz(p + 48.0 * w, 128.0, P, s + 2, 2) - 0.5) * 0.30;
	// 2. Uma passada larga e macia a cada 2 x 2 casas e, por cima, pinceladas secas
	//    de borda firme, poucas e grandes (até uma a cada 2 x 2 casas, em grupos); todas
	//    na mesma direção geral, nunca cruzadas. Com uma por casa (rodada 3), a 50% o
	//    chão virava chuva de tracinhos.
	v += 0.10 * pinceladas(p, P, px, s + 5, 128.0, -0.35, 0.35);
	v += 0.18 * pinceladas_secas(p, P, px, s + 6, 128.0, -0.35, 0.4, 0.9);
	// 3. O grão de papel.
	v += (grao(p, P, s + 7) - 1.0) * 2.6;
	// As variantes diferem um pouco na luz, para a 8 casas o chão já não ser o mesmo.
	if (qual == 1) {
		v += 0.02;
	} else if (qual == 2) {
		v -= 0.02;
	}
	return vec3(NEUTRO + FAIXA * v);
}

// Sem atlas (detalhes.quantos = 0): nenhum marco que o olho ache de novo.
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	return vec4(vec3(NEUTRO), 0.0);
}

#include "res://comum/rodape.gdshaderinc"

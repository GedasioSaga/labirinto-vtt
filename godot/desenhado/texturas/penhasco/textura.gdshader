shader_type canvas_item;
render_mode blend_disabled;

// PENHASCO, a face (onda 5, lote 17; CONTRATO.md seção 11). Parte do barranco "Desenhado"
// aprovado no protótipo (docs/design/barranco/): a terra em três faixas chapadas (a beira
// clara, o meio, o pé escuro), o pé em zigue-zague largo e baixo com o contorno da própria
// terra, e por cima poucos PEDRÕES largos saindo da terra, de contorno grosso, com o topo
// e o lado em lua (a receita das pedras da onda 3: a massa, a lua clara de cima e a lua
// escura do lado), que o app ainda acende pelo relevo.
//
// - Nada de pedrinha, estria ou granulado: todo pedrão assenta no pé, no máximo 2 por
//   módulo, e há módulo só de terra para o olho descansar. No Baixo só a terra (a faixa é
//   fina demais: pedra ali vira pedrinha); no Médio um pedrão em 3 dos 5 módulos; no Alto 4
//   pedrões em 5 módulos.
// - 5 módulos de comprimentos diferentes, sorteados e espelhados pelo app ao longo da beira:
//   no paredão comprido a mesma pedra não volta num ritmo que o olho ache.
// - Tudo que não é pedra é medido em FRAÇÃO da altura (as faixas, o dente do pé, o contorno
//   do pé): o app troca a imagem do módulo pela espessura vista (seção 11.4) e assim a troca
//   não deixa degrau.
// - A costura: os 4 px de cada ponta do módulo são só a terra lisa (sem mancha), o pé num
//   dente, o relevo ao longo 0. Qualquer módulo emenda em qualquer outro, direito ou espelhado.

#include "res://comum/traco.gdshaderinc"

// Tons da paleta do Meio-Termo (client/src/texturas/meioTermo/paleta.ts):
const vec3 BARRANCO = vec3(0.667, 0.455, 0.361);        // #aa745c, barranco
const vec3 BARRANCO_REALCE = vec3(0.761, 0.545, 0.443); // #c28b71
const vec3 BARRANCO_SOMBRA = vec3(0.569, 0.373, 0.290); // #915f4a
const vec3 GRANITO = vec3(0.604, 0.588, 0.545);         // #9a968b, granito

// O contorno do pé e o dente, em fração da altura (2,4 px e 2,4 px no Médio).
const float PE_CONTORNO = 0.075;
const float PE_DENTE = 0.075;

// A pedra do penhasco em três massas de valor: a frente no meio-tom (o granito puxado para
// o quente da terra), a lua de cima clara (a pedra clara) e a lua do lado escura.
vec3 pedra_do_penhasco() {
	return mix(GRANITO, BARRANCO, 0.30);
}

vec3 pedra_de_cima() {
	return mix(PEDRA, BARRANCO_REALCE, 0.18) * 1.04;
}

// O quanto a ponta do módulo é lisa: 0 na costura, 1 no miolo.
float miolo(float x, float L) {
	float d = min(x, L - x);
	return smoothstep(COSTURA_PX, COSTURA_PX + 10.0, d);
}

// O pé: a linha de baixo da face, em zigue-zague largo e baixo (dentes de 40 a 68 px do
// mundo), plano na costura. Fecha no módulo: n dentes inteiros. Igual em toda altura.
float pe_em(float x, float H, float L, int k) {
	float n = max(1.0, floor(L / 54.0 + 0.5));
	float t = n * (x / L + 0.035 * sin(TAU * 2.0 * x / L + float(k) * 1.7));
	float tri = abs(fract(t) - 0.5) * 2.0;          // 1 no dente, 0 no vão
	float z = PE_DENTE * (2.0 * tri - 1.0);
	return H * (1.0 + mix(PE_DENTE, z, miolo(x, L))); // a costura cai num dente (t inteiro)
}

// A terra no ponto: as três faixas do protótipo (r até 0,27, b até 0,72, s até o pé).
vec3 terra_em(float y, float H) {
	float f = y / H;
	vec3 c = mix(BARRANCO_REALCE, BARRANCO, smoothstep(0.255, 0.30, f));
	return mix(c, BARRANCO_SOMBRA, smoothstep(0.70, 0.745, f));
}

// Um pedrão do módulo: o centro x (fração de L), a largura pela altura, a altura e o topo em
// frações de H, a inclinação do topo e o quanto alarga na base.
struct Pedrao {
	float xf;
	float largura;
	float hf;
	float topo;
	float incl;
	float base;
};

Pedrao pedrao_do_modulo(int k, int i, int alt) {
	Pedrao nada = Pedrao(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
	if (alt == 0) return nada;
	if (alt == 1 && i > 0) return nada;
	if (alt == 1 && k == 1) return nada;
	if (k == 0) {
		// Um pedrão grande assentado no pé.
		if (i == 0) return Pedrao(0.46, 1.70, 0.70, 0.36, -0.06, 0.16);
	} else if (k == 1) {
		// Dois: um alto à esquerda, um baixo e comprido à direita, os dois no pé.
		if (i == 0) return Pedrao(0.30, 1.15, 0.78, 0.28, 0.05, 0.12);
		if (i == 1) return Pedrao(0.70, 2.30, 0.42, 0.64, -0.05, 0.10);
	} else if (k == 3) {
		// Um pedrão largo e baixo, fora do meio.
		if (i == 0) return Pedrao(0.62, 1.80, 0.60, 0.46, 0.05, 0.14);
	} else if (k == 4) {
		// Respiro: só terra no Alto; no Médio, um pedrão mais baixo.
		if (alt == 1 && i == 0) return Pedrao(0.50, 1.90, 0.56, 0.48, -0.04, 0.14);
	}
	return nada;
}

// O pedrão no referencial dele: p a partir do meio, b a meia medida. Devolve a distância.
float sd_pedrao(vec2 q, Pedrao r, float H, float L, int k, out vec2 p, out vec2 b) {
	float h = r.hf * H;
	float w = min(r.largura * h, L - 2.0 * (COSTURA_PX + 8.0) - 0.3 * h);
	b = vec2(w * 0.5, h * 0.5);
	vec2 c = vec2(clamp(r.xf * L, COSTURA_PX + 8.0 + b.x * 1.15, L - COSTURA_PX - 8.0 - b.x * 1.15), r.topo * H + b.y);
	p = q - c;
	p.y -= r.incl * p.x;
	// Mais largo embaixo (assenta), e o alto em duas corcovas largas (nada de serrilha).
	p.x *= 1.0 - r.base * (p.y / max(b.y, 1.0));
	float corcova = 0.10 * b.y * sin(p.x / max(b.x, 1.0) * 2.4 + float(k) * 1.3);
	p.y += corcova * smoothstep(0.0, -b.y, p.y);
	float raio = min(b.y, b.x) * 0.72;
	return sd_caixa(p, b, raio);
}

// A lua de cima e a lua do lado: a parte do pedrão que a cópia dele deslocada não cobre.
float lua_de_cima(vec2 q, Pedrao r, float H, float L, int k, vec2 b) {
	vec2 p2;
	vec2 b2;
	float f = max(3.0, b.y * 0.80);
	return sd_pedrao(q - vec2(0.12 * f, f), r, H, L, k, p2, b2);  // > 0 na lua
}

float lua_do_lado(vec2 q, Pedrao r, float H, float L, int k, vec2 b) {
	vec2 p2;
	vec2 b2;
	float f = max(2.6, b.x * 0.26);
	return sd_pedrao(q + vec2(f, -0.2 * f), r, H, L, k, p2, b2);  // > 0 na lua
}

vec4 pintar_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	float pe = pe_em(q.x, H, L, k);
	float dentro = cobre(-q.y, px) * cobre(q.y - pe, px);
	float m = miolo(q.x, L);
	// A terra: as faixas e uma mancha bem larga (some na costura). Sem grão nem pontinho.
	vec3 c = terra_em(clamp(q.y, 0.0, H), H);
	float mancha = rz(q + vec2(float(k) * 97.0, 0.0), 46.0, 4096.0, sem + 3) - 0.5;
	c *= 1.0 + m * (0.045 * mancha);
	// O contorno do pé, na própria terra escurecida (o traço do protótipo).
	float faixa_pe = smoothstep(pe - PE_CONTORNO * H - px, pe - PE_CONTORNO * H + px, q.y);
	c = mix(c, contorno_de(BARRANCO_SOMBRA), faixa_pe);
	vec4 acc = vec4(c * dentro, dentro);
	// A sombra de dentro: a terra escurece logo abaixo de cada pedrão (o peso dele).
	for (int i = 0; i < 2; i++) {
		Pedrao r = pedrao_do_modulo(k, i, alt);
		if (r.hf <= 0.0) continue;
		vec2 p;
		vec2 b;
		float d = sd_pedrao(q - vec2(0.0, 2.6), r, H, L, k, p, b);
		float a = (1.0 - smoothstep(-1.0, 2.0, d)) * dentro;
		acc.rgb = mix(acc.rgb, acc.rgb * 0.82, a);
	}
	// Os pedrões, por cima (podem passar do pé), com o contorno grosso e as duas luas.
	vec3 frente = pedra_do_penhasco();
	for (int i = 0; i < 2; i++) {
		Pedrao r = pedrao_do_modulo(k, i, alt);
		if (r.hf <= 0.0) continue;
		vec2 p;
		vec2 b;
		float d = sd_pedrao(q, r, H, L, k, p, b);
		if (d > 3.0) continue;
		float tom = 1.0 + 0.04 * (float((k * 2 + i) % 3) - 1.0);
		vec3 base = frente * tom;
		vec3 cor = base;
		cor = mix(cor, pedra_de_cima() * tom, cobre(-lua_de_cima(q, r, H, L, k, b), px));
		cor = mix(cor, sombra_de(base) * 0.90, cobre(-lua_do_lado(q, r, H, L, k, b), px));
		acc = massa_com_contorno(acc, d, cor, CONTORNO_TRACO, px);
	}
	return vec4(acc.a > 0.001 ? acc.rgb / acc.a : c, acc.a);
}

vec2 relevo_da_face(vec2 q, float H, float L, int k, int alt, float px, int sem) {
	vec2 rel = vec2(0.0);
	// A beira de cima arredonda um pouco para o céu (lê como o lábio do barranco).
	rel.y = -0.45 * (1.0 - smoothstep(0.0, 0.22 * H, q.y));
	for (int i = 0; i < 2; i++) {
		Pedrao r = pedrao_do_modulo(k, i, alt);
		if (r.hf <= 0.0) continue;
		vec2 p;
		vec2 b;
		float d = sd_pedrao(q, r, H, L, k, p, b);
		float a = cobre(d + CONTORNO_TRACO * 0.5, px);
		if (a <= 0.0) continue;
		// A frente do pedrão é redonda: vira um pouco para cada lado e para fora.
		vec2 face = vec2(0.35 * clamp(p.x / max(b.x, 1.0), -1.0, 1.0), 0.15);
		face = mix(face, vec2(-0.10, -0.90), cobre(-lua_de_cima(q, r, H, L, k, b), px));
		face = mix(face, vec2(0.85, 0.10), cobre(-lua_do_lado(q, r, H, L, k, b), px));
		rel = mix(rel, face, a);
	}
	return rel;
}

#define FACE
#include "res://comum/rodape_traco.gdshaderinc"

// Campo (morto, cemitério): o Campo forma Morto do app, no estilo Desenhado.
// Autor: operario (Claude), 07/11/2026, a pedido do usuário: mais escuro que o
// Atual (base #a3a08f) e sem repetição visível (no Atual as falhas repetem em grade).
//
// Plataforma: Godot 4.7.2, canvas_item, unshaded, 2D; só roda no exportador
// (scripts/exportar_uma.gd), que pinta os ladrilhos e o atlas uma vez. Custo de
// fragmento não importa no jogo: o app lê os PNGs exportados.
//
// Onde mora cada coisa (ESTILO.md seção 2):
//   base (3 variantes de 8 x 8 casas): o cinza do capim morto, manchas largas e
//     calmas que puxam um pouco para o marrom, uma pincelada por casa e o grão.
//   atlas (2 x 2 células de 2 casas, espelhado na diagonal): as manchas marrons e
//     escuras que repetiam no Atual. Falha de terra nua, falha funda, mato escuro e
//     touceira seca. O app espalha pelo mundo sem período, então nada fica em grade.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// ---------- cores do Morto ----------
// O cinza é o do Atual escurecido (pedido de 07/11): o Atual tem base #a3a08f,
// mancha #ada792 e moita #8d8a7b; a nova base fica abaixo da moita antiga.
const vec3 MORTO_BASE = vec3(0.490, 0.475, 0.424);         // #7d796c
const vec3 MORTO_REALCE = vec3(0.533, 0.510, 0.451);       // #888273
const vec3 MORTO_SOMBRA = vec3(0.431, 0.416, 0.373);       // #6e6a5f
const vec3 MORTO_QUENTE = vec3(0.510, 0.475, 0.416);       // #82796a (variante 2)
const vec3 MORTO_FRIO = vec3(0.451, 0.455, 0.427);         // #73746d (variante 3)
// Terra nua das falhas: as do Atual (#918775, #837968) mais escuras e mais marrons.
const vec3 TERRA_MORTA = vec3(0.420, 0.373, 0.310);        // #6b5f4f
const vec3 TERRA_MORTA_FUNDA = vec3(0.341, 0.298, 0.251);  // #574c40
const vec3 MATO_ESCURO = vec3(0.353, 0.329, 0.282);        // #5a5448
const vec3 PALHA_SECA = vec3(0.573, 0.541, 0.459);         // #928a75 (ponta da touceira)
const vec3 PALHA_PE = vec3(0.424, 0.400, 0.345);           // #6c6658 (pé da touceira)

// ---------- base ----------
const int SEMENTE_POR_VARIANTE = 1000;
const float CEL_MANCHA_GRANDE = 256.0;  // 4 casas
const float CEL_MANCHA_MEDIA = 128.0;   // 2 casas
const float PESO_MANCHA_GRANDE = 0.6;
const float MANCHA_DE = 0.22;
const float MANCHA_ATE = 0.78;
const float FORCA_DA_MANCHA = 0.55;     // quanto a mancha se afasta da cor base (±5% de luz)
const float PUXA_MARROM_DE = 0.58;
const float PUXA_MARROM_ATE = 0.88;
const float PUXA_MARROM_MAX = 0.16;     // a mancha marrom larga da base, bem contida
const float TINTA_QUENTE = 0.30;
const float TINTA_FRIA = 0.28;
const float ESCURECE_FRIA = 0.985;
const float FORCA_PINCELADA = 0.02;
const float PINCELADA_CEL = 64.0;       // uma por casa
const float PINCELADA_ANG = -1.2;
const float PINCELADA_ABERTURA = 0.5;

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	// Mesma receita nas 3 variantes; muda a semente das manchas e a temperatura.
	int s = sem + qual * SEMENTE_POR_VARIANTE;
	float n_g = rz(p, CEL_MANCHA_GRANDE, P, s + 1);
	float n_m = fz(p, CEL_MANCHA_MEDIA, P, s + 2, 2);
	float t = smoothstep(MANCHA_DE, MANCHA_ATE, n_g * PESO_MANCHA_GRANDE + n_m * (1.0 - PESO_MANCHA_GRANDE));
	vec3 c = mix(MORTO_BASE, mix(MORTO_SOMBRA, MORTO_REALCE, t), FORCA_DA_MANCHA);
	// Onde o campo secou mais o cinza puxa para a terra, devagar (sem borda: não é marco).
	float n_b = rz(p, CEL_MANCHA_GRANDE, P, s + 3);
	c = mix(c, TERRA_MORTA, smoothstep(PUXA_MARROM_DE, PUXA_MARROM_ATE, n_b) * PUXA_MARROM_MAX);
	if (qual == 1) {
		c = mix(c, MORTO_QUENTE, TINTA_QUENTE);
	} else if (qual == 2) {
		c = mix(c, MORTO_FRIO, TINTA_FRIA) * ESCURECE_FRIA;
	}
	c *= 1.0 + FORCA_PINCELADA * pinceladas(p, P, px, s + 5, PINCELADA_CEL, PINCELADA_ANG, PINCELADA_ABERTURA);
	c *= grao(p, P, s + 7);
	return c;
}

// ---------- atlas ----------
// q vai de -32 a 32 (célula de 1 casa). A borda de 4 px fica transparente.
const float MEIA_CELULA = 32.0;
const float BORDA_LIVRE = 4.0;
const float FADE_DA_BORDA = 6.0;
const float P_ATLAS = 1024.0;           // período do ruído no atlas (a célula não emenda)
const int SEMENTE_ATLAS = 977;
const int LOBOS_MAX = 4;
const int FALHAS = 8;                   // peças 0 a 7: falha de terra
const int MATOS = 5;                    // peças 8 a 12: mato escuro; 13 a 15: touceira seca
const float RAIO_MIN = 17.0;            // raio da mancha em px do mundo (o lobo maior chega a ~1,25 raio)
const float RAIO_MAX = 21.0;
const float LOBO_AFASTA = 0.30;         // centro de cada lobo, em raios da mancha
const float LOBO_RAIO_MIN = 0.60;
const float LOBO_RAIO_MAX = 0.85;
const float CEL_CONTORNO = 14.0;        // ondulação larga do contorno da mancha
const float CEL_ROIDO = 8.0;            // a borda roída (8 px do mundo; fraca, para não virar pontilhado a 50%)
const float CEL_TERRA = 12.0;           // manchas dentro da terra
const float DEFORMA_CONTORNO = 0.60;
const float DEFORMA_ROIDO = 0.15;
const float BORDA_DENTRO = -0.50;       // em raios do lobo: a borda esfumada vai daqui ...
const float BORDA_FORA = 0.04;          // ... até aqui
const float HALO = 0.22;                // o capim ralo em volta da falha, em raios
const float ALFA_HALO = 0.28;
const float FUNDO_NO_MEIO = 0.6;        // o miolo da falha é mais escuro (terra mais funda)
const float ALFA_SOMBRA_TUFO = 0.12;
const vec2 SOMBRA_TUFO_DESLOCA = vec2(1.8, 0.7);

// Distância normalizada de uma mancha em lobos (3 ou 4 elipses que se fundem, raio R
// em px): negativa dentro, 0 na borda, em raios de lobo. Contorno ondulado e roído.
float mancha_em_lobos(vec2 q, float R, int n, int s, uint h) {
	float d = 1e9;
	float giro = TAU * rk(h, 40);
	for (int k = 0; k < LOBOS_MAX; k++) {
		if (k >= n) {
			break;
		}
		float ang = giro + float(k) * TAU / float(n) + (rk(h, 41 + k) - 0.5) * 1.2;
		vec2 c = (k == 0) ? vec2(0.0) : vec2(cos(ang), sin(ang)) * R * LOBO_AFASTA * (0.7 + 0.6 * rk(h, 45 + k));
		float r = R * mix(LOBO_RAIO_MIN, LOBO_RAIO_MAX, rk(h, 50 + k));
		vec2 ab = vec2(r, r * (0.6 + 0.4 * rk(h, 55 + k)));
		d = min(d, length(girar(q - c, ang) / ab) - 1.0);
	}
	float ond = fz(q, CEL_CONTORNO, P_ATLAS, s, 2) - 0.5;
	float roido = rz(q, CEL_ROIDO, P_ATLAS, s + 3) - 0.5;
	return d + ond * DEFORMA_CONTORNO + roido * DEFORMA_ROIDO;
}

// Falha de terra nua: a mancha em lobos com um halo de capim ralo em volta (a terra
// aparece entre o capim) e o miolo mais fundo. "funda" de 0 a 1; "alfa" da terra.
vec4 falha(vec4 acc, vec2 q, float R, int n, float funda, float alfa, int s, uint h) {
	float d = mancha_em_lobos(q, R, n, s, h);
	float a_halo = (1.0 - smoothstep(BORDA_DENTRO, BORDA_FORA, d - HALO)) * ALFA_HALO;
	acc = sobre(acc, mix(MORTO_SOMBRA, TERRA_MORTA, 0.5), a_halo);
	float a = (1.0 - smoothstep(BORDA_DENTRO, BORDA_FORA, d)) * alfa;
	float mancha = rz(q, CEL_TERRA, P_ATLAS, s + 5);
	float miolo = 1.0 - smoothstep(-0.9, -0.25, d);
	vec3 cor = mix(TERRA_MORTA, TERRA_MORTA_FUNDA, clamp(mancha * 0.45 + miolo * FUNDO_NO_MEIO * funda, 0.0, 1.0));
	return sobre(acc, cor, a);
}

// Mato escuro: a mesma mancha em lobos, cinza-escura e mais transparente, sem tufo
// (os risquinhos escuros por cima liam como letras a 100%).
vec4 mato(vec4 acc, vec2 q, float R, int n, float alfa, int s, uint h) {
	float d = mancha_em_lobos(q, R, n, s, h);
	float a = (1.0 - smoothstep(BORDA_DENTRO, BORDA_FORA, d)) * alfa;
	float mancha = rz(q, CEL_TERRA, P_ATLAS, s + 5);
	return sobre(acc, mix(MATO_ESCURO, mix(MORTO_SOMBRA, TERRA_MORTA_FUNDA, 0.5), mancha * 0.7), a);
}

// Tufo de capim seco com o pé em pe0: 2 a 4 risquinhos tortos, pé escuro e ponta de
// palha apagada. Sem contorno (ESTILO 4).
vec4 tufo_seco(vec4 acc, vec2 q, vec2 pe0, float alto, float px, uint h) {
	float inclina = (rk(h, 4) - 0.5) * 0.8;
	float ds = length((q - pe0 - SOMBRA_TUFO_DESLOCA) / vec2(alto * 0.42, 2.4)) - 1.0;
	acc = sobre(acc, SOMBRA, (1.0 - smoothstep(-0.7, 0.6, ds)) * ALFA_SOMBRA_TUFO);
	int n = 2 + int(rk(h, 5) * 2.99);
	for (int b = 0; b < 4; b++) {
		if (b >= n) {
			break;
		}
		float k = float(b) - float(n - 1) * 0.5;
		float lado = k / max(float(n - 1) * 0.5, 1.0);
		vec2 pe = pe0 + vec2(k * 2.2, 0.0);
		// capim morto: um ou outro risco tomba mais que os vizinhos
		float tomba = (rk(h, 20 + b) > 0.7) ? 0.5 : 0.0;
		float altura = alto * (1.0 - 0.3 * abs(lado)) * (0.8 + 0.35 * rk(h, 10 + b)) * (1.0 - 0.35 * tomba);
		vec2 ponta = pe + vec2((lado * 0.4 + inclina + tomba * sign(lado + 0.01)) * alto, -altura);
		vec2 eixo = normalize(ponta - pe);
		vec2 meio = mix(pe, ponta, 0.5) + vec2(-eixo.y, eixo.x) * (lado * 1.4 + inclina * 1.6);
		float d = min(sd_traco(q, pe, meio, 1.6, 1.1), sd_traco(q, meio, ponta, 1.1, 0.5));
		float a = cobre(d, px);
		if (a <= 0.0) {
			continue;
		}
		float hh = clamp(dot(q - pe, ponta - pe) / dot(ponta - pe, ponta - pe), 0.0, 1.0);
		acc = sobre(acc, mix(PALHA_PE, PALHA_SECA, hh), a);
	}
	return acc;
}

// Touceira seca: um tufo grande e 1 ou 2 menores para os lados (nunca par
// simétrico), sobre um pouco de terra que aparece no pé.
vec4 touceira(vec4 acc, vec2 q, float px, int s, uint h) {
	acc = falha(acc, q - vec2(0.0, 5.0), 11.0, 3, 0.0, 0.6, s + 40, h);
	int n = 2 + int(rk(h, 6) * 1.99);
	float giro = TAU * rk(h, 1);
	for (int t = 0; t < 3; t++) {
		if (t >= n) {
			break;
		}
		uint ht = hash_cel(vec2(float(t), 9.0), s + 13);
		float alto = (t == 0) ? 14.0 + 4.0 * rk(ht, 3) : 8.0 + 3.0 * rk(ht, 3);
		float raio = (t == 0) ? 2.0 : 8.0 + 3.0 * rk(ht, 7);
		float ang = giro + float(t) * 2.4;
		vec2 pe = vec2(cos(ang) * raio, sin(ang) * raio * 0.45) + vec2(0.0, alto * 0.4);
		acc = tufo_seco(acc, q, pe, alto, px, ht);
	}
	return acc;
}

vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	int s = sem * SEMENTE_ATLAS + i * 31;
	uint h = hash_cel(vec2(float(i), 3.0), s);
	vec4 acc = vec4(0.0);
	// Cada peça sorteia o raio, os lobos e o fundo: 16 formas (32 com o espelho), para
	// nenhuma silhueta virar carimbo. As manchas se juntam no mundo em falhas maiores.
	int lobos = 3 + int(rk(h, 7) * 1.99);
	float raio = mix(RAIO_MIN, RAIO_MAX, rk(h, 8));
	if (i < FALHAS) {
		acc = falha(acc, q, raio, lobos, mix(0.4, 1.0, rk(h, 9)), mix(0.75, 0.9, rk(h, 10)), s, h);
	} else if (i < FALHAS + MATOS) {
		acc = mato(acc, q, raio * 1.08, lobos, mix(0.5, 0.65, rk(h, 10)), s, h);
	} else {
		acc = touceira(acc, q, px, s, h);
	}
	// A borda de 4 px da célula fica transparente (o filtro não puxa a vizinha).
	float dentro = MEIA_CELULA - BORDA_LIVRE - max(abs(q.x), abs(q.y));
	acc *= smoothstep(0.0, FADE_DA_BORDA, dentro);
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

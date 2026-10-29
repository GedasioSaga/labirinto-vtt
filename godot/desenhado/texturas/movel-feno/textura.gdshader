// FENO desenhado (onda 4, lote 16; CONTRATO.md seção 10). Novo no app em 29/10
// (lib/mobilia/pilhas.ts): um objeto com DUAS FORMAS no painel, cada uma com a pegada dela
// (variante com "vistas" próprias, como o tapete redondo e os troncos). Sem material: a palha
// e a corda são cor própria ("corFixa", lugares vazio, como os pratos), nas cores do app
// (client meioTermo/moveis/feno.ts).
// - FARDOS (1,5 x 1, a forma de partida): três fardos de pé, de comprido da frente para trás,
//   e um deitado de través por cima do do meio e do da direita, atrás, um pouco torto (posto
//   à mão). Cada fardo é uma caixa FIRME (canto vivo, pouco arredondado: o fardo prensado não
//   é almofada), com as duas massas da família (a clara na borda de cima à esquerda, a funda
//   na de baixo à direita), as LASCAS da prensa em poucas faixas largas de través, cada uma
//   num tom e com uma mecha clara no sentido da palha, e as duas cordas ao comprido, com a
//   palha apertada do lado delas. O de cima, mais claro, faz sombra nos de baixo.
// - MONTE (1 x 1, "quando forma = monte"): a palha solta num monte, desenhado na TELA (é
//   redondo): a saia rasgada em tufos, a cúpula em três massas (a da sombra, a do meio e o
//   topo aceso, puxado para a luz: o cume fica atrás à esquerda) e, por cima, a palha que
//   desce do cume em gomos largos, cada um num tom (o telhado de palha de uma choça redonda).
// A palha é a do telhado de palha e do assento da cadeira: poucas massas largas no sentido
// da palha, nunca fio por fio. Contorno grosso na própria cor escurecida, nunca preto. A
// sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

const int MONTE = 0;

// As cores do app (feno.ts): o tom do feno, o fio seco (a luz) e a amarra.
const vec3 FENO = vec3(0.769, 0.655, 0.412);         // #c4a769
const vec3 FENO_LUZ = vec3(0.835, 0.745, 0.530);     // o fio seco #d2bb84, um pouco acima
const vec3 FENO_SOMBRA = vec3(0.640, 0.540, 0.322);
const vec3 FENO_FUNDO = vec3(0.505, 0.412, 0.240);
const vec3 TINTA = vec3(0.400, 0.318, 0.180);        // o contorno: o feno escurecido, quente
const vec3 CORDA = vec3(0.470, 0.370, 0.235);        // a amarra #8a704a, um tom abaixo (lê no feno)

// ---- FARDOS ----
const float CANTO = 0.026;          // o raio do canto do fardo: firme
const float CO_FARDO = 0.032;       // o contorno do fardo
const float LARGURA_DA_LUZ = 0.048; // a largura da massa clara (a funda é 1,6 x)
const int LASCAS = 4;               // as lascas da prensa por fardo
// Os três fardos de pé (meio, a fresta entre eles é fina) e o deitado por cima.
const vec4 FARDOS[3] = vec4[](
	vec4(-0.484, 0.014, 0.0, 0.016),
	vec4(0.000, -0.010, 0.0, -0.012),
	vec4(0.486, 0.012, 0.0, 0.020)
);
const vec2 FARDO_DE_PE = vec2(0.234, 0.428);
const vec4 FARDO_DE_CIMA = vec4(0.226, -0.176, 0.432, 0.230);
const float GIRO_DE_CIMA = -0.055;
const float SOMBRA_DE_CIMA = 0.075; // o quanto o de cima sombreia os de baixo (casas)

// ---- MONTE ----
const vec2 MEIO_DO_MONTE = vec2(0.0, 0.012);
const float R_MONTE = 0.398;
const float GOMOS = 22.0;           // os gomos de palha que descem do cume

// Um fardo: meio c, meias medidas b, inclinação a, tom t; l = a luz no referencial do móvel.
void fardo(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float a, float t, vec2 l, uint h, float px) {
	vec2 p = girar(m - c, -a);
	float d = sd_caixa(p, b, CANTO);
	if (d > px) {
		return;
	}
	vec2 ll = girar(l, -a);
	vec3 base = FENO * t;
	pousar_cor(av, ac, TINTA * t, cobre(d, px));
	float dentro = cobre(d + CO_FARDO, px);
	// O comprido e o de través do fardo.
	bool em_y = b.y > b.x;
	float ao_longo = em_y ? p.y : p.x;
	float atraves = em_y ? p.x : p.y;
	float meia_atraves = em_y ? b.x : b.y;
	float comprido = em_y ? b.y : b.x;
	// As lascas: faixas largas de través, a borda um pouco curva (a prensa empurra o meio),
	// cada uma num tom; a troca é seca, sem risco.
	float u = atraves / meia_atraves;
	float passo = 2.0 * comprido / float(LASCAS);
	float k = (ao_longo + comprido) / passo + 0.16 * u * u + 0.10 * (rk(h, 0) - 0.5);
	float i = floor(k);
	float aa = px / passo;
	float troca = smoothstep(1.0 - aa, 1.0, fract(k));
	float t0 = 0.075 * (rk(h, 10 + int(i)) - 0.5);
	float t1 = 0.075 * (rk(h, 11 + int(i)) - 0.5);
	vec3 cor = base * (1.0 + mix(t0, t1, troca));
	// A mecha de cada lasca: uma massa clara comprida no sentido da palha (de través).
	float meio_da_lasca = (i + 0.5 - 0.16 * u * u) * passo - comprido;
	float sorte = rk(h, 20 + int(i));
	vec2 pm = vec2(atraves - (sorte - 0.5) * meia_atraves * 0.5, ao_longo - meio_da_lasca - (sorte - 0.5) * passo * 0.4);
	float dm = sd_elipse(pm, vec2(meia_atraves * (0.42 + 0.2 * sorte), passo * 0.16));
	cor = mix(cor, mix(cor, FENO_LUZ * t, 0.55), cobre(dm, px));
	// As duas massas: a funda (o que, andado para longe da luz, sai do fardo) e a clara.
	float ds = sd_caixa(p - ll * LARGURA_DA_LUZ * 1.6, b, CANTO);
	float dl = sd_caixa(p + ll * LARGURA_DA_LUZ, b, CANTO);
	vec3 v = mix(cor, FENO_SOMBRA * t, 1.0 - cobre(ds + CO_FARDO, px));
	v = mix(v, FENO_LUZ * t, 1.0 - cobre(dl + CO_FARDO, px));
	pousar_cor(av, ac, v, dentro);
	// As duas cordas ao comprido, por cima da borda também (a amarra dá a volta): a palha
	// apertada dos dois lados, um tom abaixo, e a corda com a beira da luz acesa.
	float sl = sign(dot(em_y ? vec2(-1.0, 0.0) : vec2(0.0, -1.0), ll));
	for (int j = 0; j < 2; j++) {
		float vc = (j == 0 ? -0.47 : 0.47) * meia_atraves;
		float e = atraves - vc;
		float aperto = 1.0 - smoothstep(0.030 - px, 0.030 + px, abs(e));
		pousar_cor(av, ac, FENO_SOMBRA * t * 0.94, dentro * aperto * 0.85);
		float corda = cobre(abs(e) - 0.014, px) * cobre(d, px);
		vec3 cc = mix(CORDA * t, CORDA * t * 1.25, step(0.0, -e * sl));
		pousar_cor(av, ac, cc, corda);
	}
}

void fardos(vec2 q, float px, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 l = movel_de(LUZ, vir);
	// O fundo escuro entre os fardos de pé (as frestas): por dentro deles, não aparece fora.
	pousar_cor(av, ac, TINTA * 0.85, cobre(sd_caixa(m - vec2(0.0, 0.005), vec2(0.70, 0.40), 0.04), px));
	for (int i = 0; i < 3; i++) {
		vec4 f = FARDOS[i];
		uint h = hash_cel(vec2(float(i), 1.0), sem + 31);
		fardo(av, ac, m, f.xy, FARDO_DE_PE, f.w, 0.93 + 0.03 * (rk(h, 30) - 0.5), l, h, px);
	}
	// A sombra do de cima nos de baixo (só onde já tem fardo).
	vec2 off = movel_de(-LUZ * SOMBRA_DE_CIMA, vir);
	float ds = sd_caixa(girar(m - off - FARDO_DE_CIMA.xy, -GIRO_DE_CIMA), FARDO_DE_CIMA.zw, CANTO);
	pousar_cor(av, ac, FENO_FUNDO * 0.92, av.a * (1.0 - smoothstep(-0.012, 0.012, ds)) * 0.55);
	uint h = hash_cel(vec2(7.0, 1.0), sem + 31);
	fardo(av, ac, m, FARDO_DE_CIMA.xy, FARDO_DE_CIMA.zw, GIRO_DE_CIMA, 1.04, l, h, px);
}

// ---------- MONTE ----------

// Os tufos da borda: n bicos de altura sorteada, quase todos baixos e uns poucos altos (o
// vale redondo, o bico fino), sobre um bojo de lóbulos (o monte não é um círculo nem uma
// estrela).
float tufos(float th, float n, float alto, int sem) {
	float k = th / 6.2831853 * n + 0.37;
	float i = floor(k);
	float tri = 1.0 - abs(2.0 * fract(k) - 1.0);
	float r = rk(hash_cel(vec2(mod(i, n), 2.0), sem + 47), 0);
	float h = 0.15 + 1.35 * r * r;
	return pow(tri, 1.5) * alto * h + 0.022 * sin(th * 3.0 + 0.9) + 0.012 * sin(th * 5.0 + 2.1);
}

// A distância a uma massa redonda e rasgada de meio c e raio r (na tela).
float sd_massa(vec2 q, vec2 c, float r, float alto, float n, int sem) {
	vec2 p = (q - c) / vec2(1.0, 0.93);
	float th = atan(p.y, p.x);
	return (length(p) - r - tufos(th, n, alto, sem)) * 0.93;
}

// Os gomos: a palha que desce do cume (pc = o ponto a partir do cume), torcida de leve; o tom
// de cada gomo entre -1 e 1, a troca seca.
float gomo(vec2 pc, float px, int sem) {
	float rho = max(length(pc), 1e-3);
	float th = atan(pc.y, pc.x) + 0.25 * sin(rho * 6.0 + 0.4) * smoothstep(0.08, 0.30, rho);
	float k = th / 6.2831853 * GOMOS + 0.5;
	float i = floor(k);
	float aa = px * GOMOS / (6.2831853 * rho);
	float t0 = rk(hash_cel(vec2(mod(i, GOMOS), 4.0), sem + 61), 0);
	float t1 = rk(hash_cel(vec2(mod(i + 1.0, GOMOS), 4.0), sem + 61), 0);
	return mix(t0, t1, smoothstep(1.0 - aa, 1.0, fract(k))) * 2.0 - 1.0;
}

void monte(vec2 q, float px, int sem, inout vec4 av, inout vec4 ac) {
	vec2 c = MEIO_DO_MONTE;
	float d = sd_massa(q, c, R_MONTE, 0.034, 26.0, sem);
	if (d > px) {
		return;
	}
	vec2 cume = c + LUZ * 0.11;
	float g = gomo(q - cume, px, sem);
	// O contorno e a saia, a palha mais funda (a borda baixa do monte), já nos gomos.
	pousar_cor(av, ac, TINTA, cobre(d, px));
	float co = CONTORNO_CASAS * 0.9;
	float dentro = cobre(d + co, px);
	pousar_cor(av, ac, FENO_SOMBRA * (1.0 + 0.05 * g), dentro);
	// A funda: a saia de baixo à direita, o lado de costas para a luz.
	float ds = sd_massa(q - LUZ * 0.080, c, R_MONTE, 0.034, 26.0, sem);
	pousar_cor(av, ac, FENO_FUNDO * (1.0 + 0.05 * g), dentro * (1.0 - cobre(ds + co, px)));
	// A massa do meio, puxada para a luz, rasgada: os gomos um tom acima ou abaixo.
	float dm = sd_massa(q, c + LUZ * 0.035, 0.300, 0.040, 14.0, sem + 5);
	pousar_cor(av, ac, FENO * (1.0 + 0.065 * g), cobre(dm, px));
	// O topo aceso, atrás à esquerda: o cume do monte, liso (esconde onde os gomos se juntam).
	float dt = sd_massa(q, cume, 0.158, 0.036, 9.0, sem + 9);
	pousar_cor(av, ac, FENO_LUZ, cobre(dt, px));
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	if (qual == MONTE) {
		monte(q, px, sem, av, ac);
	} else {
		fardos(q, px, vir, sem, av, ac);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

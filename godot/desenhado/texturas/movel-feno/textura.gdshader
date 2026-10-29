// FENO desenhado (onda 4, lote 16; CONTRATO.md seção 10). Novo no app em 29/10
// (lib/mobilia/pilhas.ts): um objeto com DUAS FORMAS no painel, cada uma com a pegada dela
// (variante com "vistas" próprias, como o tapete redondo e os troncos). Sem material: a palha
// e a corda são cor própria ("corFixa", lugares vazio, como os pratos), nas cores do app
// (client meioTermo/moveis/feno.ts).
// - FARDOS (1,5 x 1, a forma de partida): três fardos de pé, de comprido da frente para trás,
//   e um deitado de través por cima do do meio e do da direita, atrás, um pouco torto (posto
//   à mão). Cada fardo é firme, de canto um pouco redondo e lados estufados (nem tábua, nem
//   almofada), com a massa de luz larga no topo do lado da luz e a funda do outro; a palha
//   do topo em mechas largas e onduladas ao comprido, como a do telhado de palha; a ponta
//   cortada (a da frente; no deitado, as duas) mais clara, em tufos curtos de través; e as
//   duas cordas ao comprido, que afundam a palha e apertam as pontas. O contorno é mais
//   quente e menos escuro que o do monte, para não virar moldura de caixote. O de cima, mais claro, faz sombra nos de baixo.
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
// O contorno do fardo: mais quente e menos escuro que o do monte (escuro e reto, o fardo
// virava moldura de caixote).
const vec3 TINTA_DO_FARDO = vec3(0.545, 0.420, 0.215);
const float CANTO = 0.055;          // o raio do canto: firme, mas não quina de tábua
const float ESTUFA = 0.016;         // o quanto cada lado estufa no meio (o fardo é prensado)
const float APERTO = 0.007;         // o quanto a corda afunda a ponta do fardo
const float CO_FARDO = 0.030;       // o contorno do fardo
const float LARGURA_DA_LUZ = 0.095; // a massa de luz do topo (a funda é 0,07)
const float FILEIRAS = 6.5;         // as fileiras de mechas de través de um fardo
const float MECHA = 0.21;           // o comprimento médio de uma mecha (casas)
const float PONTA = 0.090;          // a ponta cortada, a palha de frente (casas)
// Os três fardos de pé (meio, a fresta entre eles é fina) e o deitado por cima.
const vec4 FARDOS[3] = vec4[](
	vec4(-0.484, 0.014, 0.0, 0.016),
	vec4(0.000, -0.010, 0.0, -0.012),
	vec4(0.486, 0.012, 0.0, 0.020)
);
const vec2 FARDO_DE_PE = vec2(0.222, 0.418);
const vec4 FARDO_DE_CIMA = vec4(0.226, -0.176, 0.420, 0.220);
const float GIRO_DE_CIMA = -0.055;
const float SOMBRA_DE_CIMA = 0.075; // o quanto o de cima sombreia os de baixo (casas)

// ---- MONTE ----
const vec2 MEIO_DO_MONTE = vec2(0.0, 0.012);
const float R_MONTE = 0.398;
const float GOMOS = 22.0;           // os gomos de palha que descem do cume

// A silhueta de um fardo no referencial dele (o comprido em y): a caixa de canto redondo, os
// lados estufados no meio e as duas pontas afundadas onde a corda passa (em x = ±cx).
float sd_fardo(vec2 p, vec2 b, float cx) {
	float u = clamp(p.x / b.x, -1.0, 1.0);
	float w = clamp(p.y / b.y, -1.0, 1.0);
	float aperto = APERTO * (exp(-pow((p.x - cx) / 0.032, 2.0)) + exp(-pow((p.x + cx) / 0.032, 2.0)));
	vec2 be = vec2(b.x + ESTUFA * (1.0 - w * w), b.y + ESTUFA * 0.7 * (1.0 - u * u) - aperto);
	return sd_caixa(p, be, CANTO);
}

// Um fardo: meio c, meias medidas b (o comprido no maior), inclinação a, tom t; l = a luz no
// referencial do móvel; pontas = quantas pontas cortadas aparecem (1: só a da frente, +y;
// 2: as duas). Tudo é desenhado com o comprido em y (o deitado gira um quarto de volta).
void fardo(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, float a, float t, vec2 l, int pontas, uint h, float px) {
	bool em_y = b.y > b.x;
	float giro = em_y ? a : a + 1.5707963;
	vec2 bb = em_y ? b : b.yx;
	vec2 p = girar(m - c, -giro);
	float cx = 0.42 * bb.x;
	float d = sd_fardo(p, bb, cx);
	if (d > px) {
		return;
	}
	vec2 ll = girar(l, -giro);
	pousar_cor(av, ac, TINTA_DO_FARDO * t, cobre(d, px));
	float dentro = cobre(d + CO_FARDO, px);
	// A palha do topo, como a do telhado de palha: fileiras ao comprido do fardo, de borda
	// ondulada, cada uma partida em mechas de comprimento sorteado e desencontradas de uma
	// fileira para a outra; cada mecha um tom, a troca seca e fraca.
	float wf = 2.0 * bb.x / FILEIRAS;
	float onda = 0.011 * sin(p.y * 10.0 + p.x * 4.0 + rk(h, 1) * 6.0);
	float kf = (p.x + bb.x + onda) / wf;
	float n = floor(kf);
	float aa_f = px / wf;
	float lm = MECHA * (0.75 + 0.5 * rk(hash_cel(vec2(n, 3.0), int(h % 977u)), 0));
	float km = (p.y + bb.y + lm * rk(hash_cel(vec2(n, 5.0), int(h % 977u)), 0)) / lm;
	float mm = floor(km);
	float aa_m = px / lm;
	float tm = rk(hash_cel(vec2(n, mm), int(h % 977u) + 7), 0);
	float tm1 = rk(hash_cel(vec2(n, mm + 1.0), int(h % 977u) + 7), 0);
	float tn = rk(hash_cel(vec2(n + 1.0, floor((p.y + bb.y + lm * 0.5) / lm)), int(h % 977u) + 7), 0);
	float tom = mix(tm, tm1, smoothstep(1.0 - aa_m, 1.0, fract(km)));
	tom = mix(tom, tn, 0.5 * smoothstep(1.0 - aa_f, 1.0, fract(kf)));
	vec3 cor = FENO * t * (1.0 + 0.16 * (tom - 0.5));
	// As duas massas: a de luz, larga, no topo do lado da luz; a funda do outro lado.
	float ds = sd_fardo(p - ll * 0.070, bb, cx);
	float dl = sd_fardo(p + ll * LARGURA_DA_LUZ, bb, cx);
	vec3 v = mix(cor, FENO_SOMBRA * t * (1.0 + 0.06 * (tom - 0.5)), 1.0 - cobre(ds + CO_FARDO, px));
	v = mix(v, mix(v, FENO_LUZ * t * (1.0 + 0.05 * (tom - 0.5)), 0.70), 1.0 - cobre(dl + CO_FARDO, px));
	pousar_cor(av, ac, v, dentro);
	// A ponta cortada: a palha de frente, mais clara e em tufos curtos de través (a lateral
	// corre ao comprido), a divisa com o topo desfiada em ondas largas.
	for (int k = 0; k < 2; k++) {
		if (k == 1 && pontas < 2) {
			break;
		}
		float lado = k == 0 ? 1.0 : -1.0;
		float y = p.y * lado;
		float borda = bb.y - PONTA + 0.012 * sin(p.x * 26.0 + rk(h, 40 + k) * 6.0);
		float na_ponta = smoothstep(borda - px, borda + px, y) * dentro;
		float wt = 0.058;
		float kt = (p.x + bb.x + 0.5 * wt * floor((y - borda) / (PONTA * 0.5))) / wt;
		float tt = rk(hash_cel(vec2(floor(kt), floor((y - borda) / (PONTA * 0.5)) + 9.0 * float(k)), int(h % 977u) + 13), 0);
		vec3 cp = FENO_LUZ * t * (1.03 + 0.12 * (tt - 0.5));
		// A ponta também pega a luz da tela: a de costas fica um tom abaixo.
		float de_frente = dot(vec2(0.0, lado), ll);
		cp *= de_frente > 0.0 ? 1.03 : 0.95;
		pousar_cor(av, ac, cp, na_ponta);
	}
	// As duas cordas ao comprido, por cima das pontas também (a amarra dá a volta): a palha
	// afunda numa faixa estreita um tom abaixo, e a corda.
	float sl = sign(dot(vec2(-1.0, 0.0), ll));
	for (int j = 0; j < 2; j++) {
		float vc = j == 0 ? -cx : cx;
		float e = p.x - vc;
		float faixa_funda = 1.0 - smoothstep(0.024 - px, 0.024 + px, abs(e));
		pousar_cor(av, ac, FENO_SOMBRA * t, dentro * faixa_funda * 0.55);
		float corda = cobre(abs(e) - 0.0125, px) * cobre(d, px);
		vec3 cc = mix(CORDA * t, CORDA * t * 1.25, step(0.0, -e * sl));
		pousar_cor(av, ac, cc, corda);
	}
}

void fardos(vec2 q, float px, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 l = movel_de(LUZ, vir);
	// O fundo escuro entre os fardos de pé (as frestas): por dentro deles, não aparece fora.
	pousar_cor(av, ac, TINTA_DO_FARDO * 0.80, cobre(sd_caixa(m - vec2(0.0, 0.005), vec2(0.68, 0.38), 0.05), px));
	for (int i = 0; i < 3; i++) {
		vec4 f = FARDOS[i];
		uint h = hash_cel(vec2(float(i), 1.0), sem + 31);
		fardo(av, ac, m, f.xy, FARDO_DE_PE, f.w, 0.93 + 0.03 * (rk(h, 30) - 0.5), l, 1, h, px);
	}
	// A sombra do de cima nos de baixo (só onde já tem fardo).
	vec2 off = movel_de(-LUZ * SOMBRA_DE_CIMA, vir);
	float ds = sd_fardo(girar(m - off - FARDO_DE_CIMA.xy, -(GIRO_DE_CIMA + 1.5707963)), FARDO_DE_CIMA.wz, 0.42 * FARDO_DE_CIMA.w);
	pousar_cor(av, ac, FENO_FUNDO * 0.92, av.a * (1.0 - smoothstep(-0.012, 0.012, ds)) * 0.55);
	uint h = hash_cel(vec2(7.0, 1.0), sem + 31);
	fardo(av, ac, m, FARDO_DE_CIMA.xy, FARDO_DE_CIMA.zw, GIRO_DE_CIMA, 1.04, l, 2, h, px);
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

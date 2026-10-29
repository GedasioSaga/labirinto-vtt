// FOGÃO de ferro a lenha desenhado que pega cor (onda 4, lote 14; CONTRATO.md seção 10).
//
// Visto de cima, como a família da onda 3 e o metal do barril e da carroça: o contorno
// grosso na cor do metal, massas largas e um realce calmo, a luz de cima à esquerda em
// toda virada. A frente é o lado de baixo (como no armário e no fogão do app). De baixo
// para cima:
// - O CORPO (lugar 1, ferro ou latão): o bloco de ferro da pegada inteira, um tom abaixo
//   do material, com a quina redonda.
// - A CHAPA (lugar 1): a placa de cima, um tom acima, separada do corpo por uma fresta
//   firme, com a massa clara em cima à esquerda e a escura embaixo à direita.
// - As DUAS BOCAS no fundo da chapa: a tampa redonda e o sulco escuro em volta (o
//   contorno da família); a da esquerda, em cima da fornalha, é maior.
// - O CANO da chaminé (lugar 1) no canto de trás à direita: a boca do tubo vista de cima,
//   o anel de ferro aceso pela luz e o escuro de dentro, com a parede do fundo acesa; ele
//   joga uma sombra curta na chapa (o cano sobe; a sombra de dentro é valor).
// - A BARRA (lugar 2, os puxadores do app: latão ou ferro) na beira da frente da chapa,
//   onde se pendura o pano: uma vara deitada, acesa em cima e escura embaixo.
// - A PORTINHA DA LENHA na frente, com a FRESTA DA BRASA (cor própria, "corFixa"): o
//   laranja do fogo do Meio-Termo, mais claro no meio, com a sombra do lábio de cima.
//   Contida na fresta: a brasa não brilha para fora.
// Nada de rebite, prego, pegador em bolinha, grelha nem risquinho. Não é simétrico (o cano
// à direita, a porta na frente): 4 viradas. A sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// A brasa: o laranja do fogo do Meio-Termo (#e39446, o BRASA de fogao.ts) e o miolo
// claro da fresta do app (#f0c078). O lábio é a própria brasa escurecida (ESTILO 4).
const vec3 BRASA = vec3(0.890, 0.580, 0.275);
const vec3 MIOLO_DA_BRASA = vec3(0.941, 0.753, 0.471);
const float LABIO_DA_BRASA = 0.72;

// ---- As medidas, em casas, no referencial do fogão (y para baixo, a frente embaixo) ----
const float CORPO_MEIO = 0.47;
const float QUINA_CORPO = 0.07;
const vec2 CHAPA_C = vec2(0.0, -0.115);
const vec2 CHAPA_B = vec2(0.385, 0.28);
const float QUINA_CHAPA = 0.04;
const float FRESTA_DA_CHAPA = 0.018; // a borda escura entre a chapa e o corpo
const float LUZ_DA_CHAPA = 0.06;     // a largura da massa clara da chapa (a escura é 1,5 x)

const vec2 BOCA_E = vec2(-0.185, -0.13);
const float R_BOCA_E = 0.155;
const vec2 BOCA_D = vec2(0.175, -0.13);
const float R_BOCA_D = 0.13;
const float LUZ_DA_TAMPA = 0.045; // a largura do brilho da tampa (o escuro é 0,6 x)

const vec2 CANO = vec2(0.315, -0.36);
const float R_CANO = 0.10;
const float R_BOCA_DO_CANO = 0.042;
const float CONTORNO_DO_CANO = 0.026;   // mais fino que o da família: o tubo é pequeno
const float PAREDE_ACESA = 0.018;       // o quanto a parede do fundo do tubo aparece acesa
const float SOMBRA_DO_CANO = 0.14;      // o quanto a sombra do cano anda na chapa
const vec2 DIR_DA_SOMBRA = vec2(0.5369, 0.8437); // (7, 11) normalizado: a direção da do app

const vec2 BARRA_C = vec2(0.0, 0.207);
const vec2 BARRA_B = vec2(0.415, 0.032);
const float CONTORNO_DA_BARRA = 0.012;
const vec2 SOMBRA_DA_BARRA = vec2(0.012, 0.02); // para onde a sombra da barra cai, na tela
const float SUPORTE_X = 0.405;                  // os suportes da barra, nas pontas
const vec2 SUPORTE_B = vec2(0.03, 0.05);

const vec2 PORTA_C = vec2(0.0, 0.345);
const vec2 PORTA_B = vec2(0.255, 0.072);
const float QUINA_PORTA = 0.03;
const vec2 FRESTA_B = vec2(0.17, 0.032);
const float BEIRA_DA_FRESTA = 0.011;
const float LABIO = 0.016; // a largura da sombra do lábio de cima da fresta

// Uma vara de metal deitada (a barra): contorno fino, e a luz pela seção (cilindro),
// igual ao longo: acesa na borda que olha para a luz, escura na outra.
void vara(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, int lugar, int v, float px) {
	vec2 p = m - c;
	float r = min(b.x, b.y);
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, lugar, cobre(d, px));
	float dentro = cobre(d + CONTORNO_DA_BARRA, px);
	float meia = max(r - CONTORNO_DA_BARRA, 1e-3);
	vec2 n = b.x >= b.y ? vec2(0.0, clamp(p.y / meia, -1.0, 1.0)) : vec2(clamp(p.x / meia, -1.0, 1.0), 0.0);
	float l = dot(tela_de(n, v), LUZ) / 0.7071;
	float valor = mix(V_SOMBRA - 0.02, V_MEIO + 0.02, smoothstep(-0.8, -0.1, l));
	valor = mix(valor, V_REALCE + 0.04, smoothstep(0.25, 0.6, l));
	pousar(av, ac, valor, lugar, dentro);
}

// Um suporte da barra (lugar 2): um toco de metal de quina redonda, contorno fino e três
// tons pela luz da tela, como o puxador do armário.
void suporte(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, vec2 b, int v, float px) {
	vec2 p = m - c;
	float r = min(b.x, b.y) * 0.6;
	float d = sd_caixa(p, b, r);
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 2, cobre(d, px));
	float dentro = cobre(d + CONTORNO_DA_BARRA, px);
	vec2 s = tela_de(p, v);
	vec2 bs = v % 2 == 1 ? b.yx : b;
	float l = dot(s / bs, LUZ);
	float valor = mix(V_SOMBRA - 0.02, V_MEIO + 0.02, smoothstep(-0.7, -0.1, l));
	valor = mix(valor, V_LUZ + 0.06, smoothstep(0.2, 0.5, l));
	pousar(av, ac, valor, 2, dentro);
}

// Uma boca: o sulco em volta (o contorno da família) e a tampa de ferro, funda e um
// pouco abaulada: o brilho largo em meia-lua em cima à esquerda e o escuro do outro lado
// (as massas de desenhar_elipse ficam estreitas demais numa peça deste tamanho).
void boca(inout vec4 av, inout vec4 ac, vec2 m, vec2 c, float r, vec2 lm, float px) {
	vec2 p = m - c;
	float d = length(p) - r;
	if (d > px) {
		return;
	}
	pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
	float ri = r - CONTORNO_CASAS;
	float dentro = cobre(d + CONTORNO_CASAS, px);
	pousar(av, ac, V_SOMBRA - 0.04, 1, dentro);
	float escura = 1.0 - cobre(length(p - lm * LUZ_DA_TAMPA * 0.6) - ri, px);
	pousar(av, ac, V_FUNDO + 0.02, 1, dentro * escura);
	float clara = 1.0 - cobre(length(p + lm * LUZ_DA_TAMPA) - ri, px);
	pousar(av, ac, V_SOMBRA + 0.13, 1, dentro * clara);
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir);
	if (sd_caixa(m, vec2(CORPO_MEIO), QUINA_CORPO) > px) {
		return;
	}
	// 1. O corpo de ferro.
	desenhar_caixa(av, ac, m, vec2(0.0), vec2(CORPO_MEIO), QUINA_CORPO, V_MEIO - 0.06, 0.035, 1, vir, px);
	// 2. A chapa: a fresta, o recheio e as duas massas.
	vec2 pc = m - CHAPA_C;
	float dc = sd_caixa(pc, CHAPA_B, QUINA_CHAPA);
	pousar(av, ac, V_FUNDO, 1, cobre(dc, px));
	float na_chapa = cobre(dc + FRESTA_DA_CHAPA, px);
	float tom = V_MEIO + 0.08;
	pousar(av, ac, tom, 1, na_chapa);
	float ds = sd_caixa(pc - lm * LUZ_DA_CHAPA * 1.5, CHAPA_B, QUINA_CHAPA) + FRESTA_DA_CHAPA;
	float dl = sd_caixa(pc + lm * LUZ_DA_CHAPA, CHAPA_B, QUINA_CHAPA) + FRESTA_DA_CHAPA;
	pousar(av, ac, tom - MASSA_ESCURA, 1, na_chapa * (1.0 - cobre(ds, px)));
	pousar(av, ac, tom + MASSA_CLARA, 1, na_chapa * (1.0 - cobre(dl, px)));
	// 3. A sombra curta do cano na chapa, na tela (anda para baixo à direita em toda virada).
	vec2 cs = tela_de(CANO, vir);
	float dsc = sd_traco(q, cs, cs + DIR_DA_SOMBRA * SOMBRA_DO_CANO, R_CANO * 0.92, R_CANO * 0.75);
	pousar(av, ac, tom - MASSA_ESCURA - 0.04, 1, na_chapa * cobre(dsc, px * 3.0) * 0.85);
	// 4. As duas bocas: a tampa e o sulco em volta.
	boca(av, ac, m, BOCA_E, R_BOCA_E, lm, px);
	boca(av, ac, m, BOCA_D, R_BOCA_D, lm, px);
	// 5. A barra de pendurar o pano (lugar 2), na beira da frente da chapa: a sombra curta
	// que ela joga no ferro (ela fica de pé, afastada da frente), a vara e os 2 suportes.
	vec2 ms = movel_de(q - SOMBRA_DA_BARRA, vir);
	float d_sb = sd_caixa(ms - BARRA_C, BARRA_B, BARRA_B.y);
	float no_corpo = cobre(sd_caixa(m, vec2(CORPO_MEIO), QUINA_CORPO) + CONTORNO_CASAS, px);
	pousar(av, ac, V_FUNDO + 0.04, 1, cobre(d_sb, px) * no_corpo * 0.75);
	vara(av, ac, m, BARRA_C, BARRA_B, 2, vir, px);
	for (int i = 0; i < 2; i++) {
		float sx = i == 0 ? -1.0 : 1.0;
		suporte(av, ac, m, vec2(sx * SUPORTE_X, BARRA_C.y), SUPORTE_B, vir, px);
	}
	// 6. A portinha da lenha e a fresta da brasa.
	desenhar_caixa(av, ac, m, PORTA_C, PORTA_B, QUINA_PORTA, V_MEIO - 0.02, 0.02, 1, vir, px);
	vec2 pf = m - PORTA_C;
	float df = sd_caixa(pf, FRESTA_B, FRESTA_B.y);
	pousar(av, ac, V_FUNDO - 0.08, 1, cobre(df, px));
	float na_fresta = cobre(df + BEIRA_DA_FRESTA, px);
	float t = pow(max(0.0, 1.0 - abs(pf.x) / FRESTA_B.x), 1.5);
	vec3 brasa = mix(BRASA, MIOLO_DA_BRASA, t);
	pousar_cor(av, ac, brasa, na_fresta);
	float fora = 1.0 - cobre(sd_caixa(pf + lm * LABIO, FRESTA_B, FRESTA_B.y) + BEIRA_DA_FRESTA, px);
	pousar_cor(av, ac, BRASA * LABIO_DA_BRASA, na_fresta * fora);
	// 7. O cano: o anel do tubo, a boca escura e a parede do fundo acesa.
	vec2 pk = m - CANO;
	float rk = length(pk);
	float dk = rk - R_CANO;
	if (dk < px) {
		vec2 sk = tela_de(pk, vir);
		float l = dot(sk / max(rk, 1e-5), LUZ);
		pousar(av, ac, V_CONTORNO, 1, cobre(dk, px));
		float tubo = mix(V_SOMBRA - 0.02, V_MEIO + 0.04, smoothstep(-0.6, 0.0, l));
		tubo = mix(tubo, V_REALCE, smoothstep(0.35, 0.7, l));
		pousar(av, ac, tubo, 1, cobre(dk + CONTORNO_DO_CANO, px));
		float db = rk - R_BOCA_DO_CANO;
		float no_oco = cobre(db, px);
		pousar(av, ac, V_CONTORNO - 0.02, 1, no_oco);
		float acesa = 1.0 - cobre(length(sk - LUZ * PAREDE_ACESA) - R_BOCA_DO_CANO, px);
		pousar(av, ac, V_SOMBRA - 0.06, 1, no_oco * acesa);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

// PINHEIRO COM NEVE em pé, meio de lado (onda 3, lote 6; CONTRATO.md, seção 9).
//
// As MESMAS 4 silhuetas do pinheiro: a geometria, o verde, o tronco e o contorno vêm de
// texturas/pinheiro/pinheiro.gdshaderinc (a mesma semente no config). Aqui só a neve:
//
// - Um boné de neve em cima de cada saia, logo abaixo do festão da de cima (na de cima, a
//   ponta): grande e calmo, mais cheio do lado da luz (desce 2/3 da saia à esquerda e 1/3 à
//   direita), a beira de baixo em 2 ou 3 lobos largos. Nada de floco nem pontinho.
// - O verde aparece por baixo de cada boné, com o festão da saia inteiro.
// - A neve tem os três tons da neve aprovada (texturas/neve/): a massa no azulado da sombra,
//   por cima o branco onde o verde está na luz (a mesma linha de luz das saias) e o branco
//   mais claro só nas saias de cima à esquerda; a beira de baixo de cada boné fica no azulado
//   (a barriga da neve) e a saia de cima faz sombra azul na neve logo abaixo do festão.
// - Onde a neve chega na silhueta o contorno é o azulado da neve escurecido, não o verde.
// - O verde fica um pouco mais frio que o do pinheiro, como o de hoje.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/carimbo.gdshaderinc"
#include "res://texturas/pinheiro/pinheiro.gdshaderinc"

// Os tons da neve aprovada (texturas/neve/textura.gdshader), todos da paleta do Meio-Termo.
const vec3 NEVE_LUZ = vec3(0.910, 0.895, 0.846);    // #e8e4d8 branco a 95,5%
const vec3 NEVE = vec3(0.872, 0.857, 0.811);        // #dedbcf branco a 91,5%
const vec3 NEVE_SOMBRA = vec3(0.761, 0.799, 0.847); // #c2ccd8 branco 64% + telhaAzul 36%
const vec3 SOMBRA_NEVE = vec3(0.307, 0.399, 0.522); // telhaAzul 60% + ardósia 40%
// O verde do pinheiro, um pouco mais frio (o de hoje também esfria o da neve).
const vec3 FRIO = vec3(0.95, 0.98, 1.03);

// A beira de baixo do boné: 2 ou 3 lobos largos, desiguais. u = 0 no canto da esquerda da
// saia, 1 no da direita.
float lobos_da_neve(int k, int i, float u, int sem) {
	uint h = hash_cel(vec2(float(k), float(i) + 60.0), sem + 951);
	float m = 2.0 + step(0.5, rk(h, 0));
	float t = u * m + (rk(h, 1) - 0.5) * 0.3;
	float f = fract(t);
	float j = floor(t);
	float a = 0.7 + 0.6 * rk(hash_cel(vec2(float(k) * 8.0 + float(i), j + 70.0), sem + 953), 0);
	float x = 2.0 * f - 1.0;
	return a * sqrt(max(1.0 - x * x, 0.0));
}

// A distância (negativa dentro) até o boné da saia i, sem o recorte da saia: o boné é tudo
// que fica acima da beira de baixo dele. sobe > 0 levanta a beira (a barriga da neve).
float sd_bone(int k, int i, vec2 qo, int sem, float sobe) {
	int n = pin_saias(k);
	vec4 s = pin_saia(k, i, sem);
	float b = s.x;
	float w = s.z;
	float a = s.w;
	float topo = i == n - 1 ? s.y : pin_saia(k, i + 1, sem).x;
	float faixa = b - topo;
	vec2 l = qo;
	l.x -= pin_inclina(k) * (-l.y) + pin_desvio(k, i);
	float u = clamp((l.x + w * (1.0 - a)) / (2.0 * w), 0.0, 1.0);
	uint h = hash_cel(vec2(float(k), float(i) + 80.0), sem + 957);
	float esq = i == n - 1 ? 0.60 : 0.60 + 0.10 * rk(h, 0);
	float dir = i == n - 1 ? 0.36 : 0.22 + 0.10 * rk(h, 1);
	float cheio = mix(esq, dir, smoothstep(0.1, 0.9, u));
	float yc = topo + faixa * (cheio + 0.13 * lobos_da_neve(k, i, u, sem)) - sobe;
	return l.y - yc;
}

vec4 pintar_carimbo(vec2 q, float px, int sem, int k) {
	float traco = 1.0 / unidade_mundo;
	vec4 copa = pin_copa(q, px, sem, k);
	vec4 tr = pin_tronco(q, sem, k);
	vec4 ct = pin_traco(q, k);
	vec2 qo = pin_ponto(q, sem, k);
	vec2 pl = (q + vec2(2.0)) * 128.0;
	int n = pin_saias(k);

	// A neve, saia por saia, de baixo para cima (a de cima tampa a de baixo, como o verde).
	vec3 cn = NEVE_SOMBRA;
	float an = 0.0;
	float cobriu = 0.0;
	for (int i = 0; i < 4; i++) {
		if (i >= n) {
			break;
		}
		float di = sd_saia(k, i, qo, sem, 1.0, vec2(0.0));
		float cov = 1.0 - smoothstep(-0.006, 0.004, di);
		float ds = sd_saia(k, i, qo - SOMBRA_DENTRO, sem, 1.0, vec2(0.0));
		cn = mix(cn, mix(NEVE_SOMBRA, SOMBRA_NEVE, 0.16), (1.0 - smoothstep(-0.022, 0.022, ds)) * (1.0 - cov) * cobriu);
		float bone = 1.0 - smoothstep(-0.005, 0.005, sd_bone(k, i, qo, sem, 0.0));
		float alto = 1.0 - smoothstep(-0.005, 0.005, sd_bone(k, i, qo, sem, 0.022));
		float m1 = 1.0 - smoothstep(-0.005, 0.005, sd_saia_meio(k, i, qo, sem));
		float m2 = (1.0 - smoothstep(-0.005, 0.005, sd_saia_luz(k, i, qo, sem))) * step(0.1, pin_luz_da_saia(k, i));
		vec3 ci = mix(NEVE_SOMBRA, NEVE, alto * m1);
		ci = mix(ci, NEVE_LUZ, alto * m2);
		cn = mix(cn, ci, cov);
		an = mix(an, bone, cov);
		cobriu = max(cobriu, cov);
	}
	cn *= 1.0 + (grao(pl, 1024.0, sem + 47) - 1.0) * 0.4;
	vec3 c = mix(copa.rgb * FRIO, cn, an);

	float ls = pin_lado_sombra(q, k);
	vec3 cont_neve = mix(NEVE_SOMBRA * 0.70, NEVE_SOMBRA * 0.58, smoothstep(0.3, 0.8, ls));
	vec3 c_traco = mix(ct.rgb * FRIO, cont_neve, an);

	vec4 acc = vec4(0.0);
	acc = sobre(acc, PIN_TRONCO_CONTORNO, cobre(tr.w, px));
	acc = sobre(acc, tr.rgb, cobre(tr.w + 1.6 * traco, px));
	acc = sobre(acc, c_traco, cobre(copa.w, px));
	acc = sobre(acc, c, cobre(copa.w + ct.w, px));
	vec3 reta = acc.a > 0.002 ? acc.rgb / acc.a : (tr.w < copa.w ? PIN_TRONCO_CONTORNO : c_traco);
	return vec4(reta, acc.a);
}

#include "res://comum/rodape_carimbo.gdshaderinc"

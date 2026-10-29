// Palha (telhado-palha): palha em mechas grossas, em fileiras largas paralelas ao
// beiral, tingível. Onda 2, lote 5 (CONTRATO.md, seção 8). A cumeeira é a faixa da
// cumeeira-amarrada ("faixa": { "de": ... } no config.json).
//
// Fileiras de 34 px (1,9 por casa) e mechas de 21 px em média (3 por casa, a largura
// sorteada de 7 a 35 px): uns 5,6 feixes por casa, contra a espinha de peixe miúda de
// hoje (fileiras de 7 px, um V a cada 12 px e fios a cada 2 px). Cada fileira começa
// num ponto sorteado, então as divisas das mechas não se alinham de uma fileira para a
// outra. A ponta de cada mecha desce de 0,3 a 6 px sobre a fileira de baixo (sorteado
// por mecha, com passagem suave na divisa, curva rasa e fios soltos de 8 a 16 px): a
// borda da fileira fica desfiada sem virar escama. A ponta pega um pouco de luz e a
// fileira de cima faz sombra larga e fraca, para a luz das águas ler primeiro. Dentro
// da mecha, só listras largas e fracas ao longo da água (os fios em bando), nunca
// risco fino repetido. A beira do beiral (grossa e irregular) é do app: o escuro e a
// franja vêm do "beiral" do config.json.
//
// A geometria (fileiras, mechas, pontas, empeno e o relevo dos fios no canal "lado")
// usa a semente da textura e é a MESMA nas duas variantes; o tom de cada mecha, as
// listras do valor, o desbotado e o grão mudam com "qual". Nada de luz lateral no
// valor: o relevo vai no "lado" e o app acende o lado certo em cada água.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/telhado.gdshaderinc"

// 512 / 15: fora da régua de meia casa, para a cumeeira não cair sempre na mesma
// altura da fileira (com 32 px ela caía sempre na ponta, em casa de lado inteiro).
const float ALTURA_DA_FILEIRA = 34.133333;
const float FILEIRAS_NO_PERIODO = 15.0;
const float LARGURA_DA_MECHA = 21.333333; // 512 / 24
const float MECHAS_NO_PERIODO = 24.0;
const float SACUDIR_DIVISA = 0.32; // quanto cada divisa de mecha anda, em larguras

// A divisa k da fileira nn (px, antes do desencontro da fileira).
float divisa(float k, float nn, int sem) {
	float j = rnd(vec2(mod(k, MECHAS_NO_PERIODO), nn), sem + 21, 0);
	return (k + SACUDIR_DIVISA * (2.0 * j - 1.0)) * LARGURA_DA_MECHA;
}

// A mecha da fileira n no ponto u: vec4(s = onde está na mecha, 0..1; índice; ponta =
// px que a mecha desce abaixo da borda nominal da fileira; distância à divisa, px).
vec4 mecha_em(float n, float u, float P, int sem) {
	float nn = mod(n, FILEIRAS_NO_PERIODO);
	float uu = u + LARGURA_DA_MECHA * rnd(vec2(nn, 0.0), sem + 20, 0);
	float c = floor(uu / LARGURA_DA_MECHA);
	float k = c;
	if (uu < divisa(c, nn, sem)) {
		k = c - 1.0;
	} else if (uu >= divisa(c + 1.0, nn, sem)) {
		k = c + 1.0;
	}
	float esq = divisa(k, nn, sem);
	float dir = divisa(k + 1.0, nn, sem);
	float s = (uu - esq) / (dir - esq);
	float pk = rnd(vec2(mod(k, MECHAS_NO_PERIODO), nn), sem + 22, 0);
	float o = pk;
	if (s < 0.5) {
		float pe = rnd(vec2(mod(k - 1.0, MECHAS_NO_PERIODO), nn), sem + 22, 0);
		o = mix(0.5 * (pe + pk), pk, smoothstep(0.0, 0.3, s));
	} else {
		float pd = rnd(vec2(mod(k + 1.0, MECHAS_NO_PERIODO), nn), sem + 22, 0);
		o = mix(pk, 0.5 * (pk + pd), smoothstep(0.7, 1.0, s));
	}
	// A ponta: o comprimento da mecha, uma curva rasa e os fios que sobram (ruídos de
	// 16 e 8 px, outros em cada fileira): borda desfiada, não arco de escama.
	float fios = (rz(vec2(u, nn * 13.0 + 5.0), 16.0, P, sem + 25) - 0.5) + 0.35 * (rz(vec2(u, nn * 13.0 + 9.0), 8.0, P, sem + 27) - 0.5);
	float ponta = 1.4 + 3.0 * o + 0.5 * sin(PI * s) + 1.8 * fios;
	return vec4(s, k, ponta, min(uu - esq, dir - uu));
}

// O tom de uma mecha (-0,5..0,5), com passagem macia na divisa (sem degrau de cor).
float tom_da_mecha(float nn, float k, float s, int sv) {
	float tk = rnd(vec2(mod(k, MECHAS_NO_PERIODO), nn), sv, 0);
	float tv = s < 0.5 ? rnd(vec2(mod(k - 1.0, MECHAS_NO_PERIODO), nn), sv, 0) : rnd(vec2(mod(k + 1.0, MECHAS_NO_PERIODO), nn), sv, 0);
	float perto = 1.0 - smoothstep(0.0, 0.3, min(s, 1.0 - s));
	return mix(tk, 0.5 * (tk + tv), perto) - 0.5;
}

// A luz numa fileira: db = px acima da própria ponta, dc = px abaixo da ponta da
// fileira de cima, t = 0 (ponta) a 1 (embaixo da fileira de cima).
float luz_na_fileira(float db, float dc, float t) {
	float l = 0.03 * (1.0 - smoothstep(0.0, 6.0, db));
	l -= 0.07 * smoothstep(0.4, 1.0, t);
	l -= 0.035 * (1.0 - smoothstep(0.0, 5.0, dc));
	return l;
}

// Os bandos largos de fios (16 px de través, 128 ao longo da água), -0,5..0,5.
float largo(vec2 f, float P, int sv) {
	return ruido_p(vec2(f.x / 16.0, f.y / 128.0), vec2(P / 16.0, P / 128.0), sv) - 0.5;
}

// Os fios em bando no ponto (listras largas ao longo da água), -0,5..0,5.
float bando(vec2 f, float P, int sv) {
	return 0.2 * (ruido_p(vec2(f.x / 8.0, f.y / 64.0), vec2(P / 8.0, P / 64.0), sv) - 0.5) + largo(f, P, sv + 1);
}

vec2 pintar_telhado(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	// Empeno: o mesmo nas variantes (a geometria é uma só).
	vec2 emp = vec2(rz(p, 128.0, P, sem + 1), rz(p + vec2(37.0, 11.0), 128.0, P, sem + 2)) - 0.5;
	vec2 q = p + emp * vec2(2.0, 1.4);

	float a = ALTURA_DA_FILEIRA;
	float k0 = floor(q.y / a);
	vec4 cima = mecha_em(k0 + 1.0, q.x, P, sem);
	float y_cima = (k0 + 1.0) * a - cima.z;
	float n = k0;
	vec4 m;
	float y0;
	float y1;
	if (q.y >= y_cima) {
		// Na ponta da fileira de cima, que desce sobre esta.
		n = k0 + 1.0;
		m = cima;
		y0 = y_cima;
		y1 = (k0 + 2.0) * a - mecha_em(k0 + 2.0, q.x, P, sem).z;
	} else {
		m = mecha_em(k0, q.x, P, sem);
		y0 = k0 * a - m.z;
		y1 = y_cima;
	}
	float db = q.y - y0;
	float dc = y1 - q.y;
	float t = db / (y1 - y0);

	// A fileira com antisserrilhado nas duas bordas (a ponta é um degrau de luz).
	float luz = luz_na_fileira(db, dc, t);
	luz = mix(luz, luz_na_fileira(99.0, 0.0, 1.0), clamp(0.5 - db / (1.3 * px), 0.0, 1.0));
	luz = mix(luz, luz_na_fileira(0.0, 99.0, 0.0), clamp(0.5 - dc / (1.3 * px), 0.0, 1.0));

	float nn = mod(n, FILEIRAS_NO_PERIODO);
	// Perto da ponta a divisa entre duas mechas abre um vão raso (as mechas se juntam
	// mais para cima: não são tijolos).
	float na_ponta = 1.0 - smoothstep(0.0, 10.0, db);
	luz -= 0.04 * (1.0 - smoothstep(0.0, 3.0, m.w)) * na_ponta;
	// Cada mecha um tom, contido (as duas variantes sorteiam outro).
	luz += tom_da_mecha(nn, m.y, m.x, s + 24) * 0.04;
	// Os fios em bando: listras largas e fracas ao longo da água, que mudam de fase em
	// cada fileira (a borda da fileira esconde a troca).
	vec2 f = vec2(q.x + 48.0 * rnd(vec2(nn, 1.0), sem + 23, 0), q.y);
	luz += bando(f, P, s + 8) * 0.05;
	// As pontas cortadas dos fios, só na beira da mecha.
	luz += (rz(vec2(q.x, nn * 7.0), 4.0, P, s + 9) - 0.5) * 0.025 * na_ponta;
	// Desbotado largo (2 a 4 casas) e grão de papel.
	luz += (rz(p, 256.0, P, s + 5) - 0.5) * 0.07 + (rz(p, 128.0, P, s + 6) - 0.5) * 0.03;
	luz += (grao(p, P, s + 7) - 1.0) * 0.5;
	// Devolve a média para 0,5 (a sombra da fileira escurece em média).
	luz += 0.031;

	// O relevo dos fios vai no lado: cada bando acende a encosta virada para a luz da
	// água (a mesma geometria nas variantes).
	float rel = largo(f + vec2(4.0, 0.0), P, sem + 26) - largo(f - vec2(4.0, 0.0), P, sem + 26);
	float lado = clamp(-rel * 1.4, -0.35, 0.35);
	return vec2(valor_de(luz), lado);
}

#include "res://comum/rodape_telhado.gdshaderinc"

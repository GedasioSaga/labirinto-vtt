// Calçamento: rua de pedra da vila, chão com estrutura. Lote 4 da onda 1.
// Pedra de granito miúda e arredondada, assentada em fiada torta, com junta de areia
// e terra (quente, macia, nunca preta). Fica de propósito longe das lajotas: a laje tem
// quase 1 casa de altura, canto quase reto e fiada reta, em pedra clara; aqui a pedra tem
// um terço da área dela (0,6 casa de altura e 0,55 a 0,95 de largura), canto bem
// redondo, face abaulada, fiadas que serpenteiam e o tom do granito (entre a Clara e a
// Escura das lajotas).
//
// Piso com estrutura (CONTRATO.md seção 1): a geometria é a mesma nas 2 variantes; a
// variante só troca a superfície (o tom de cada pedra, a mancha larga, a sujeira da junta).
//
// Por que fiada e não leque: o leque, de longe, é um campo de escamas (ESTILO.md seção 1
// proíbe escama), e o arco dele repetiria a cada 8 casas como motivo reconhecível.
//
// O que as rodadas de 28/10 mudaram (na folha):
// - Rodadas 1 e 2 (14 fiadas de 11 pedras, junta a 73% da pedra): a 25% a área era uma
//   malha fina e agitada. Agora 12 fiadas de 10, a junta a ~82% da pedra e o brilho do
//   ombro mais baixo.
// - A junta mais clara na beira (como nas lajotas) dava um contorno claro em cada pedra
//   a 300%; a junta escura na beira toda, um contorno escuro. Agora é areia lisa, com
//   sombra só do lado de baixo à direita da pedra.
// - A torção de 4 casas fazia 2 ou 3 curvas grandes por ladrilho, que voltavam a cada 8
//   casas; agora é de 2 casas e de 1 casa (a fiada entorta de pedra em pedra).
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/cabecalho.gdshaderinc"

// ---------- tabela das fiadas ----------
// Saiu de um gerador com sorteio fixo (semente 23, depois um recozimento junta por junta),
// escrita aqui por extenso: 12 fiadas de 10 pedras num ladrilho de 8 x 8 casas. Altura de
// fiada quase igual (40,9 a 44,3 px: fiada de altura bem diferente vira listra a cada 8
// casas). Largura de 39 a 66 px. Junta de topo a >= 13 px da fiada vizinha (nada de cruz)
// e >= 8 px da de duas fiadas adiante (nada de coluna).
const float CL_Y[13] = { 0.00, 43.64, 87.14, 129.94, 170.84, 214.50, 255.85, 299.10, 342.70, 383.95, 427.10, 468.64, 512.00 };
const float CL_O[12] = { 9.13, 36.81, 0.41, 23.47, 37.18, 8.66, 56.57, 36.30, 16.65, 1.69, 39.27, 24.20 };
const float CL_X[132] = {
	0.00, 53.57, 108.13, 152.72, 199.72, 249.13, 310.17, 355.81, 407.09, 446.67, 512.00,
	0.00, 54.77, 111.23, 156.98, 203.88, 257.39, 304.15, 350.91, 405.03, 458.04, 512.00,
	0.00, 51.56, 107.89, 170.76, 216.94, 265.83, 309.07, 355.95, 407.15, 468.66, 512.00,
	0.00, 56.30, 115.17, 161.63, 207.39, 255.76, 299.85, 349.87, 410.00, 460.91, 512.00,
	0.00, 55.62, 114.99, 163.12, 216.62, 263.67, 308.63, 361.31, 416.95, 461.55, 512.00,
	0.00, 62.31, 117.28, 165.56, 231.06, 278.79, 322.98, 375.87, 414.47, 467.69, 512.00,
	0.00, 50.49, 104.57, 164.21, 209.76, 260.25, 308.12, 353.25, 406.18, 450.70, 512.00,
	0.00, 47.81, 104.77, 163.12, 213.14, 263.24, 310.66, 358.75, 413.18, 456.12, 512.00,
	0.00, 51.43, 107.65, 165.53, 215.87, 267.94, 316.66, 363.30, 410.86, 462.64, 512.00,
	0.00, 51.94, 108.30, 163.32, 207.85, 257.82, 317.08, 361.63, 412.01, 460.93, 512.00,
	0.00, 53.25, 104.33, 151.82, 204.64, 265.55, 309.53, 360.71, 405.16, 455.67, 512.00,
	0.00, 55.04, 106.11, 153.85, 201.49, 247.03, 308.76, 354.58, 405.01, 455.51, 512.00
};
const int CL_FIADAS = 12;
const int CL_PEDRAS = 10;
const int CL_PASSO = 11; // números por fiada na tabela CL_X (as juntas e o 512 do fim)
// Onde começa a primeira fiada e a primeira pedra. Escolhidos para a borda do ladrilho
// cruzar junta tanto quanto uma linha de casa comum (a emenda mede isso).
const float CL_Y0 = -36.0;
const float CL_X0 = -2.0;
// A junta entre dois lados retos; no canto ela abre, porque a pedra é redonda.
const float CL_JUNTA = 4.2;
const float CL_CHANFRO = 8.0;
// Quanto a fiada serpenteia (px do mundo): para cima e para baixo, e um nada de lado.
const float CL_TORTO_Y = 16.0;
const float CL_TORTO_X = 6.0;
// O sorteio da forma (borda, canto, giro) é fixo: igual nas variantes.
const int CL_SEM_FORMA = 4421;

// Paleta (client/src/texturas/meioTermo/paleta.ts). PEDRA, PRACA_SOMBRA, TERRA_SOMBRA,
// REBOCO e SOMBRA vêm da base.
const vec3 CL_GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b
const vec3 CL_ARDOSIA = vec3(0.373, 0.416, 0.400); // #5f6a66
const vec3 CL_LENHA = vec3(0.431, 0.341, 0.271);   // #6e5745
const vec3 CL_MUSGO = vec3(0.435, 0.490, 0.294);   // #6f7d4b

// ---------- geometria ----------

// A torção das fiadas: ruído periódico de 2 casas e de 1 casa, o mesmo em todas as
// variantes. Com a onda de 4 casas (rodadas 2 a 6), cada ladrilho tinha 2 ou 3 curvas
// grandes de fiada, e a 25% elas viravam um motivo que voltava a cada 8 casas.
vec2 cl_torcer(vec2 p, float P) {
	float ty = 0.6 * rz(p, 128.0, P, CL_SEM_FORMA + 1) + 0.4 * rz(p, 64.0, P, CL_SEM_FORMA + 2);
	float tx = rz(p, 128.0, P, CL_SEM_FORMA + 3);
	return vec2(CL_TORTO_X * (tx * 2.0 - 1.0), CL_TORTO_Y * (ty * 2.0 - 1.0));
}

int cl_fiada(float t) {
	int r = 0;
	for (int i = 1; i < CL_FIADAS; i++) {
		if (t >= CL_Y[i]) {
			r = i;
		}
	}
	return r;
}

int cl_pedra(int r, float xs) {
	int k = 0;
	for (int i = 1; i < CL_PEDRAS; i++) {
		if (xs >= CL_X[r * CL_PASSO + i]) {
			k = i;
		}
	}
	return k;
}

// A pedra mais perto do ponto (a que o contém, ou a da beira da junta onde ele está),
// no espaço torcido. Devolve a distância (negativa dentro) e, por out: o número da
// pedra, a posição do ponto no quadro dela (já girado), o meio lado, o raio do canto e
// o giro.
float cl_achar(vec2 p, float P, out int id, out vec2 q_out, out vec2 b_out, out float raio_out, out float ang_out) {
	vec2 w = p + cl_torcer(p, P);
	float t = mod(w.y - CL_Y0, P);
	int r = cl_fiada(t);
	float melhor = 1e9;
	id = 0;
	q_out = vec2(0.0);
	b_out = vec2(1.0);
	raio_out = 1.0;
	ang_out = 0.0;
	for (int dr = -1; dr <= 1; dr++) {
		int rr = r + dr;
		float ty = 0.0;
		if (rr < 0) {
			rr += CL_FIADAS;
			ty = -P;
		} else if (rr >= CL_FIADAS) {
			rr -= CL_FIADAS;
			ty = P;
		}
		float y0 = CL_Y[rr] + ty;
		float y1 = CL_Y[rr + 1] + ty;
		float xs = mod(w.x - CL_O[rr] - CL_X0, P);
		int k = cl_pedra(rr, xs);
		for (int dk = -1; dk <= 1; dk++) {
			int kk = k + dk;
			float x0;
			float x1;
			if (kk < 0) {
				kk = CL_PEDRAS - 1;
				x0 = CL_X[rr * CL_PASSO + kk] - P;
				x1 = 0.0;
			} else if (kk >= CL_PEDRAS) {
				kk = 0;
				x0 = P;
				x1 = P + CL_X[rr * CL_PASSO + 1];
			} else {
				x0 = CL_X[rr * CL_PASSO + kk];
				x1 = CL_X[rr * CL_PASSO + kk + 1];
			}
			int n = rr * CL_PEDRAS + kk;
			uint h = hash_cel(vec2(float(n), 3.0), CL_SEM_FORMA);
			// Cada pedra é assentada à mão: um nada mais alta ou mais baixa que a
			// vizinha (até 1,2 px), um lado mais folgado que o outro e um giro de até 2,9 graus.
			float sobe = 1.2 * (rk(h, 5) * 2.0 - 1.0);
			float bx0 = x0 + CL_JUNTA * 0.5 + 1.2 * rk(h, 0);
			float bx1 = x1 - CL_JUNTA * 0.5 - 1.2 * rk(h, 1);
			float by0 = y0 + CL_JUNTA * 0.5 + sobe + 1.4 * rk(h, 2);
			float by1 = y1 - CL_JUNTA * 0.5 + sobe - 1.4 * rk(h, 3);
			vec2 c = vec2(bx0 + bx1, by0 + by1) * 0.5;
			vec2 b = vec2(bx1 - bx0, by1 - by0) * 0.5;
			// Canto bem redondo: 42 a 62% do meio lado menor (a laje tem 2 a 4,5 px). Mais
			// que isso, o vão do canto vira um ponto escuro a 25%.
			float raio = min(b.x, b.y) * (0.42 + 0.2 * rk(h, 4));
			float ang = (rk(h, 6) - 0.5) * 0.1;
			vec2 q = girar(vec2(xs, t) - c, -ang);
			float d = sd_caixa(q, b, raio);
			if (d < melhor) {
				melhor = d;
				id = n;
				q_out = q;
				b_out = b;
				raio_out = raio;
				ang_out = ang;
			}
		}
	}
	// A borda anda (pedra lascada à mão): ruído periódico de 1/4 e de 1/2 casa.
	melhor += 0.8 * (rz(p, 16.0, P, CL_SEM_FORMA + 5) * 2.0 - 1.0);
	melhor += 1.2 * (rz(p, 32.0, P, CL_SEM_FORMA + 6) * 2.0 - 1.0);
	return melhor;
}

// ---------- tons ----------

// Granito da paleta com um terço da pedra clara: entre as duas lajotas (a Clara fica em
// #c4bfaf, a Escura em #524f4c).
vec3 cl_pedra_base() {
	return mix(CL_GRANITO, PEDRA, 0.3);
}

vec3 cl_cor_da_pedra(int n, int qual, int sem) {
	uint h = hash_cel(vec2(float(n), float(qual) + 11.0), sem);
	vec3 c = cl_pedra_base();
	// Umas puxam para o quente (a praça), poucas para o frio (a ardósia); pouco, para não
	// virar xadrez.
	c = mix(c, mix(c, PRACA_SOMBRA, 0.6), 0.35 * rk(h, 0));
	c = mix(c, sombra_de(mix(CL_ARDOSIA, CL_GRANITO, 0.5)), 0.16 * smoothstep(0.75, 1.0, rk(h, 2)));
	c *= 1.0 + 0.04 * (rk(h, 1) * 2.0 - 1.0);
	return c;
}

// A junta: areia e terra entre as pedras, a pedra escurecida puxada para a terra.
vec3 cl_junta_base() {
	return mix(cl_pedra_base() * 0.9, TERRA_SOMBRA * 0.8, 0.25);
}

// O brilho do ombro fica baixo: alto, cada pedra ganha um risco claro em cima, e a 25%
// os riscos viram pontilhado.
const float CL_LUZ_CHANFRO = 0.04;
const float CL_SOMBRA_CHANFRO = 0.07;
const float CL_ABAULADO = 0.035;

// ---------- base ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	int n;
	vec2 q;
	vec2 b;
	float raio;
	float ang;
	float d = cl_achar(p, P, n, q, b, raio, ang);
	vec2 nrm = girar(normal_caixa(q, b, raio), ang);
	float luz = dot(nrm, LUZ);

	// 1. A pedra: o tom dela (muda com a variante) e uma mancha larga e calma, de 1 a 2
	//    casas, que também muda com a variante.
	vec3 pedra = cl_cor_da_pedra(n, qual, sem);
	float lav = fz(p, 64.0, P, s + 3, 2);
	pedra *= 1.0 + 0.03 * (lav - 0.5);
	float larga = fz(p, 128.0, P, s + 4, 2);
	pedra *= 1.0 + 0.03 * (smoothstep(0.3, 0.7, larga) - 0.5);
	// A face abaulada: um nada mais clara em cima à esquerda, sem brilho no meio.
	vec2 u = q / b;
	vec2 ug = girar(u, ang);
	pedra *= 1.0 + CL_ABAULADO * clamp(dot(ug, LUZ), -1.0, 1.0);
	// Relevo bem leve da face (1/2 casa), com a luz de cima à esquerda.
	float rA = fz(p - 2.0 * LUZ, 32.0, P, s + 10, 2);
	float rB = fz(p + 2.0 * LUZ, 32.0, P, s + 10, 2);
	pedra *= 1.0 + clamp(0.3 * (rA - rB), -0.015, 0.015);

	// 2. O ombro redondo: a borda de cima à esquerda pega a luz, a de baixo à direita cai.
	float e = max(-d, 0.0);
	float bev = 1.0 - smoothstep(0.0, CL_CHANFRO, e);
	bev *= bev;
	pedra *= 1.0 + bev * luz * (luz > 0.0 ? CL_LUZ_CHANFRO : CL_SOMBRA_CHANFRO);

	// 3. A junta: areia rasa e lisa entre pedras redondas. Só o lado de baixo à direita de
	//    cada pedra joga sombra na areia. Rodadas de 28/10: com a beira da junta mais clara
	//    que o meio (como nas lajotas, onde a junta é funda), cada pedra ganhava um contorno
	//    claro a 300%; com a beira escura em volta toda, um contorno escuro (a base nunca
	//    tem contorno). Por cima, sujeira larga e um verde de musgo muito fraco em manchas
	//    de 2 casas (mudam com a variante).
	vec3 junta = cl_junta_base();
	junta *= 1.0 + 0.07 * (fz(p, 32.0, P, s + 6, 2) - 0.5);
	junta = mix(junta, sombra_de(CL_MUSGO), 0.14 * smoothstep(0.5, 0.75, fz(p, 128.0, P, s + 12, 2)));
	float fundo = smoothstep(0.0, CL_JUNTA * 0.5 + 1.5, d);
	junta *= mix(0.985, 1.0, fundo);
	junta *= 1.0 - 0.06 * max(-luz, 0.0) * (1.0 - fundo);
	float na_junta = smoothstep(-0.7, 1.4, d);
	vec3 c = mix(pedra, junta, na_junta);

	// 4. Mão de pintura: poucas pinceladas na direção das fiadas e o grão do papel.
	c *= 1.0 + 0.018 * pinceladas(p, P, px, s + 8, 32.0, -0.18, 0.35);
	c *= grao(p, P, s + 9);
	return c;
}

// ---------- atlas: manchas largas, sem contorno ----------

// Distância a uma forma torta (círculo achatado e girado, 3 harmônicos baixos na borda).
float cl_torta(vec2 q, vec2 c, float r, float achata, float ang, float torto, uint h) {
	vec2 lq = girar(q - c, -ang);
	lq.y *= achata;
	float th = atan(lq.y, lq.x);
	float f = 1.0 + torto * (0.12 * cos(th + TAU * rk(h, 0)) + 0.08 * cos(2.0 * th + TAU * rk(h, 1))
			+ 0.05 * cos(3.0 * th + TAU * rk(h, 2)));
	return (length(lq) - r * f) / sqrt(achata);
}

// Mancha bem esfumada: a borda some em 80% do raio, sem linha nenhuma.
vec4 cl_mancha(vec4 acc, vec2 q, vec2 c, float r, float achata, float ang, vec3 cor, float alfa, uint h) {
	float d = cl_torta(q, c, r, achata, ang, 1.3, h);
	float a = 1.0 - smoothstep(-r * 0.8, 0.0, d);
	return sobre(acc, cor, a * a * (3.0 - 2.0 * a) * alfa);
}

// Marca de água seca: miolo fraco e a beira um nada mais escura, toda esfumada.
vec4 cl_marca_seca(vec4 acc, vec2 q, vec2 c, float r, float ang, vec3 cor, float alfa, uint h) {
	float d = cl_torta(q, c, r, 1.2, ang, 1.3, h);
	float dentro = 1.0 - smoothstep(-r * 0.6, 0.0, d);
	float beira = (1.0 - smoothstep(0.0, r * 0.25, abs(d + r * 0.14))) * dentro;
	acc = sobre(acc, cor, dentro * alfa * 0.5);
	return sobre(acc, cor, beira * alfa * 0.5);
}

// Poeira de terra que o pé e a roda trazem da estrada: quente, da terra da paleta.
vec3 cl_poeira() {
	return mix(TERRA_SOMBRA, cl_pedra_base(), 0.45);
}

vec3 cl_sujo() {
	return mix(PRACA_SOMBRA, CL_LENHA, 0.35) * 0.85;
}

vec3 cl_gasto() {
	return mix(REBOCO, PEDRA, 0.5);
}

// O atlas (4 células de 2 casas). Tudo mancha larga e macia, sem contorno: de longe é a
// rua variando sem período; de perto, a rua usada, sem marca que se ache.
//   0 poeira de terra   1 rastro comprido de poeira   2 gasto de passo (mais claro)
//   3 água seca
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 5.0), 7307);
	vec4 acc = vec4(0.0);
	float ang = (rk(h, 20) - 0.5) * 2.6;
	if (i == 0) {
		acc = cl_mancha(acc, q, vec2(0.0), 40.0, 1.3, ang, cl_poeira(), 0.16, h);
	} else if (i == 1) {
		acc = cl_mancha(acc, q, vec2(0.0), 44.0, 2.4, 0.15, cl_poeira(), 0.12, h);
	} else if (i == 2) {
		acc = cl_mancha(acc, q, vec2(0.0), 40.0, 1.4, ang, cl_gasto(), 0.12, h);
	} else {
		acc = cl_marca_seca(acc, q, vec2(0.0), 34.0, ang, cl_sujo(), 0.12, h);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

#include "res://comum/rodape.gdshaderinc"

// Lajotas de pedra: a geometria e a pintura das duas formas (Clara e Escura).
// As duas texturas incluem este arquivo; a Escura define LAJOTA_ESCURA antes. Assim
// a geometria é a mesma por construção: só o tom muda.
//
// Piso interno com estrutura (CONTRATO.md seção 1): as juntas são iguais nas
// variantes e nas duas formas; a variante só troca a superfície (o tom de cada
// pedra, a mancha larga dentro dela, a sujeira da junta).
//
// Geometria: pedra assentada à mão, em 8 fiadas de 6 pedras num ladrilho de
// 8 x 8 casas: laje de quase 1 casa de altura (0,95 a 1,04) e 1,1 a 1,65 casa de
// comprimento, mais quadrada que tijolo. A fiada tem altura quase igual: fiadas de
// altura bem diferente fariam um ritmo de listras a cada 8 casas, que a 25% se acha.
// A pedra tem canto pouco arredondado, borda que anda um pouco e assenta um nada
// mais alta ou mais baixa que a vizinha; a junta de topo nunca fica a menos de 20 px
// da junta da fiada vizinha (nada de cruz de azulejo) nem alinhada com a de duas
// fiadas adiante. A tabela saiu de um gerador com sorteio fixo (semente 31) e está
// escrita aqui por extenso.
// A junta é larga (6 px, de 3 a 9 conforme as pedras) e macia, da cor da pedra
// escurecida, nunca preta.
//
// O que as rodadas de 28/10 mudaram (na folha):
// - Rodada 1 (12 fiadas de 7, pedra de 0,67 casa de altura, canto de até 7,5 px,
//   chanfro de 5 px): a 100% lia como tijolinho arredondado, cada pedra uma almofada.
//   O canto agora vai de 2 a 4,5 px e o chanfro é mais estreito.
// - Rodadas 2 e 3 (10 fiadas de 0,8 casa): já era laje, mas a área de 40 x 40 ainda
//   lia como parede de tijolo (proporção de 1,66 para 1, junta de assento em régua).
//   Agora a laje tem quase 1 casa de altura e cada pedra assenta um nada fora do nível.
// - As manchas de 1 casa viravam pintas escuras a 100%: agora são de 2 casas, raras e
//   bem esfumadas (o chão varia de longe, sem marca de perto).
// - O tom de cada pedra variava demais entre a pedra e a praça (pedras amarelas
//   saltavam a 50%): agora é metade da diferença.

const float LJ_Y[9] = { 0.00, 65.04, 131.13, 196.66, 257.72, 321.13, 384.08, 445.30, 512.00 };
const float LJ_O[8] = { 242.58, 291.20, 258.94, 73.33, 368.17, 82.18, 184.72, 475.91 };
const float LJ_X[56] = {
	0.00, 86.61, 187.75, 276.33, 353.34, 439.46, 512.00,
	0.00, 100.02, 198.42, 277.99, 352.75, 423.13, 512.00,
	0.00, 100.41, 189.83, 271.20, 348.76, 435.31, 512.00,
	0.00, 78.10, 161.46, 257.27, 350.77, 436.23, 512.00,
	0.00, 89.07, 189.18, 270.11, 342.28, 420.90, 512.00,
	0.00, 80.93, 162.13, 236.76, 330.88, 436.43, 512.00,
	0.00, 79.92, 165.38, 253.97, 354.41, 440.47, 512.00,
	0.00, 83.74, 180.51, 255.06, 337.38, 436.85, 512.00
};
const int LJ_FIADAS = 8;
const int LJ_PEDRAS = 6;
const int LJ_PASSO = 7; // números por fiada na tabela LJ_X (as juntas e o 512 do fim)
// Onde começa a primeira fiada. Escolhido para nenhuma junta de assento cair a menos
// de 29 px da borda do ladrilho nem das linhas de casa onde o exportador mede a
// emenda: a borda e as linhas caem todas no meio de uma pedra, e a medida compara
// igual com igual. Com a fiada de quase 1 casa, isto põe a junta perto do meio da casa.
const float LJ_Y0 = 349.5;
// O mesmo na horizontal: a tabela inteira anda 353 px para a borda vertical do
// ladrilho ficar tão perto de junta de topo quanto uma linha de casa comum.
const float LJ_X0 = 353.0;
const float LJ_JUNTA = 6.0;
const float LJ_CHANFRO = 3.8;
// O sorteio da forma (borda, canto) é fixo: igual nas variantes e nas duas formas.
const int LJ_SEM_FORMA = 9127;

// Paleta (client/src/texturas/meioTermo/paleta.ts). PEDRA, PRACA, PRACA_JUNTA,
// PRACA_SOMBRA, PRACA_REALCE, REBOCO, FERRO e SOMBRA vêm da base.
const vec3 LJ_GRANITO = vec3(0.604, 0.588, 0.545); // #9a968b
const vec3 LJ_ARDOSIA = vec3(0.373, 0.416, 0.400); // #5f6a66
const vec3 LJ_LENHA = vec3(0.431, 0.341, 0.271);   // #6e5745
const vec3 LJ_METAL = vec3(0.463, 0.478, 0.467);   // #767a77

// ---------- geometria ----------

int lj_fiada(float t) {
	int r = 0;
	for (int i = 1; i < LJ_FIADAS; i++) {
		if (t >= LJ_Y[i]) {
			r = i;
		}
	}
	return r;
}

int lj_pedra(int r, float xs) {
	int k = 0;
	for (int i = 1; i < LJ_PEDRAS; i++) {
		if (xs >= LJ_X[r * LJ_PASSO + i]) {
			k = i;
		}
	}
	return k;
}

// A pedra mais perto do ponto (a que o contém, ou a da beira da junta onde ele está).
// Devolve a distância (negativa dentro), e por out: o número da pedra, a posição do
// ponto em relação ao centro dela, o meio lado e o raio do canto.
float lj_achar(vec2 p, float P, out int id, out vec2 q_out, out vec2 b_out, out float raio_out) {
	float t = mod(p.y - LJ_Y0, P);
	int r = lj_fiada(t);
	float melhor = 1e9;
	id = 0;
	q_out = vec2(0.0);
	b_out = vec2(1.0);
	raio_out = 1.0;
	for (int dr = -1; dr <= 1; dr++) {
		int rr = r + dr;
		float ty = 0.0;
		if (rr < 0) {
			rr += LJ_FIADAS;
			ty = -P;
		} else if (rr >= LJ_FIADAS) {
			rr -= LJ_FIADAS;
			ty = P;
		}
		float y0 = LJ_Y[rr] + ty;
		float y1 = LJ_Y[rr + 1] + ty;
		float xs = mod(p.x - LJ_O[rr] - LJ_X0, P);
		int k = lj_pedra(rr, xs);
		for (int dk = -1; dk <= 1; dk++) {
			int kk = k + dk;
			float x0;
			float x1;
			if (kk < 0) {
				kk = LJ_PEDRAS - 1;
				x0 = LJ_X[rr * LJ_PASSO + kk] - P;
				x1 = 0.0;
			} else if (kk >= LJ_PEDRAS) {
				kk = 0;
				x0 = P;
				x1 = P + LJ_X[rr * LJ_PASSO + 1];
			} else {
				x0 = LJ_X[rr * LJ_PASSO + kk];
				x1 = LJ_X[rr * LJ_PASSO + kk + 1];
			}
			int n = rr * LJ_PEDRAS + kk;
			uint h = hash_cel(vec2(float(n), 3.0), LJ_SEM_FORMA);
			// Cada pedra assenta um pouco mais alta ou mais baixa que a vizinha (até
			// 1,2 px): a junta de assento ganha um degrau em cada junta de topo, em vez
			// de ser uma régua contínua. A borda de cada lado ainda anda até 0,6 px.
			float j = 0.6;
			float sobe = 1.2 * (rk(h, 5) * 2.0 - 1.0);
			float bx0 = x0 + LJ_JUNTA * 0.5 + j * (rk(h, 0) * 2.0 - 1.0);
			float bx1 = x1 - LJ_JUNTA * 0.5 + j * (rk(h, 1) * 2.0 - 1.0);
			float by0 = y0 + LJ_JUNTA * 0.5 + sobe + j * (rk(h, 2) * 2.0 - 1.0);
			float by1 = y1 - LJ_JUNTA * 0.5 + sobe + j * (rk(h, 3) * 2.0 - 1.0);
			vec2 c = vec2(bx0 + bx1, by0 + by1) * 0.5;
			vec2 b = vec2(bx1 - bx0, by1 - by0) * 0.5;
			float raio = 2.0 + 2.5 * rk(h, 4);
			vec2 q = vec2(xs, t) - c;
			float d = sd_caixa(q, b, raio);
			if (d < melhor) {
				melhor = d;
				id = n;
				q_out = q;
				b_out = b;
				raio_out = raio;
			}
		}
	}
	// A borda anda um pouco (pedra cortada à mão): ruído periódico de 1/4 de casa.
	melhor += 0.8 * (rz(p, 16.0, P, LJ_SEM_FORMA + 5) * 2.0 - 1.0);
	return melhor;
}

// ---------- tons ----------

#ifdef LAJOTA_ESCURA
// Grafite neutro, um nada quente (o pedido de 10/10: "a escura, cinza escuro"),
// tirado do ferro com um pouco de lenha; algumas pedras puxam para a ardósia.
vec3 lj_pedra_base() {
	return sombra_de(mix(FERRO, LJ_LENHA, 0.2));
}

vec3 lj_cor_da_pedra(int n, int qual, int sem) {
	uint h = hash_cel(vec2(float(n), float(qual) + 11.0), sem);
	vec3 c = lj_pedra_base();
	c = mix(c, sombra_de(LJ_ARDOSIA), 0.3 * rk(h, 0));
	c = mix(c, sombra_de(LJ_METAL), 0.2 * smoothstep(0.8, 1.0, rk(h, 2)));
	c *= 1.0 + 0.04 * (rk(h, 1) * 2.0 - 1.0);
	return c;
}

vec3 lj_junta_base() {
	return lj_pedra_base() * 0.7;
}

const float LJ_LUZ_CHANFRO = 0.08;
const float LJ_SOMBRA_CHANFRO = 0.08;
#else
// Pedra clara entre a pedra e a praça da paleta, mais para a pedra (a Clara de hoje
// fica em #cdc8bc); a junta é a junta da praça puxada para o granito.
vec3 lj_pedra_base() {
	return mix(PEDRA, PRACA, 0.2);
}

vec3 lj_cor_da_pedra(int n, int qual, int sem) {
	uint h = hash_cel(vec2(float(n), float(qual) + 11.0), sem);
	vec3 c = mix(PEDRA, PRACA, 0.3 * rk(h, 0));
	c = mix(c, LJ_GRANITO, 0.1 * smoothstep(0.8, 1.0, rk(h, 2)));
	c *= 1.0 + 0.03 * (rk(h, 1) * 2.0 - 1.0);
	return c;
}

vec3 lj_junta_base() {
	return mix(mix(PRACA_JUNTA, LJ_GRANITO, 0.5), lj_pedra_base(), 0.2);
}

const float LJ_LUZ_CHANFRO = 0.05;
const float LJ_SOMBRA_CHANFRO = 0.07;
#endif

// ---------- base ----------

vec3 pintar_base(vec2 p, float P, float px, int sem, int qual) {
	int s = sem + qual * 1000;
	int n;
	vec2 q;
	vec2 b;
	float raio;
	float d = lj_achar(p, P, n, q, b, raio);
	vec2 nrm = normal_caixa(q, b, raio);
	float luz = dot(nrm, LUZ);

	// 1. A pedra: o tom dela (muda com a variante) e uma mancha larga e calma por
	//    dentro, de 1 a 2 casas, que também muda com a variante.
	vec3 pedra = lj_cor_da_pedra(n, qual, sem);
	float lav = fz(p, 64.0, P, s + 3, 2);
	pedra *= 1.0 + 0.035 * (lav - 0.5);
	float larga = fz(p, 128.0, P, s + 4, 2);
	pedra *= 1.0 + 0.03 * (smoothstep(0.3, 0.7, larga) - 0.5);
	// A face cortada à mão: relevo bem leve (1/2 casa), com a luz de cima à esquerda.
	// Some a 50%; a 300% tira o liso da pedra sem virar grão.
	float rA = fz(p - 2.0 * LUZ, 32.0, P, s + 10, 2);
	float rB = fz(p + 2.0 * LUZ, 32.0, P, s + 10, 2);
	// Com 0,6 (rodada 6) a face ficava nublada, quase mármore, a 300%.
	pedra *= 1.0 + clamp(0.32 * (rA - rB), -0.016, 0.016);

	// 2. O chanfro macio: a borda de cima à esquerda pega a luz, a de baixo à direita cai.
	float e = max(-d, 0.0);
	float bev = 1.0 - smoothstep(0.0, LJ_CHANFRO, e);
	bev *= bev;
	pedra *= 1.0 + bev * luz * (luz > 0.0 ? LJ_LUZ_CHANFRO : LJ_SOMBRA_CHANFRO);

	// 3. A junta: mais funda no meio, a beira de baixo à direita de cada pedra na
	//    sombra dela, e um pouco de sujeira larga (muda com a variante).
	vec3 junta = lj_junta_base();
	junta *= 1.0 + 0.06 * (fz(p, 32.0, P, s + 6, 2) - 0.5);
	float fundo = smoothstep(0.0, LJ_JUNTA * 0.5, d);
	junta *= mix(1.05, 0.95, fundo);
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
float lj_torta(vec2 q, vec2 c, float r, float achata, float ang, float torto, uint h) {
	vec2 lq = girar(q - c, -ang);
	lq.y *= achata;
	float th = atan(lq.y, lq.x);
	float f = 1.0 + torto * (0.12 * cos(th + TAU * rk(h, 0)) + 0.08 * cos(2.0 * th + TAU * rk(h, 1))
			+ 0.05 * cos(3.0 * th + TAU * rk(h, 2)));
	return (length(lq) - r * f) / sqrt(achata);
}

// Mancha bem esfumada: a borda some em 80% do raio, sem linha nenhuma.
vec4 lj_mancha(vec4 acc, vec2 q, vec2 c, float r, float achata, float ang, vec3 cor, float alfa, uint h) {
	float d = lj_torta(q, c, r, achata, ang, 1.3, h);
	float a = 1.0 - smoothstep(-r * 0.8, 0.0, d);
	return sobre(acc, cor, a * a * (3.0 - 2.0 * a) * alfa);
}

// Mancha de umidade seca: miolo fraco e a beira um nada mais escura, toda esfumada.
vec4 lj_marca_seca(vec4 acc, vec2 q, vec2 c, float r, float ang, vec3 cor, float alfa, uint h) {
	float d = lj_torta(q, c, r, 1.2, ang, 1.3, h);
	float dentro = 1.0 - smoothstep(-r * 0.6, 0.0, d);
	float beira = (1.0 - smoothstep(0.0, r * 0.25, abs(d + r * 0.14))) * dentro;
	acc = sobre(acc, cor, dentro * alfa * 0.5);
	return sobre(acc, cor, beira * alfa * 0.5);
}

#ifdef LAJOTA_ESCURA
vec3 lj_sujo() {
	return lj_pedra_base() * 0.72;
}
vec3 lj_gasto() {
	return mix(LJ_GRANITO, LJ_METAL, 0.4);
}
const float LJ_ALFA_SUJO = 0.16;
const float LJ_ALFA_GASTO = 0.07;
#else
// Sujeira quente (a sombra da praça com um pouco de lenha): puxada para o granito
// (rodada 2) ela saía cinza-esverdeada e lia como mofo a 50%.
vec3 lj_sujo() {
	return mix(PRACA_SOMBRA, LJ_LENHA, 0.15) * 0.92;
}
vec3 lj_gasto() {
	return mix(REBOCO, PRACA_REALCE, 0.5);
}
const float LJ_ALFA_SUJO = 0.09;
const float LJ_ALFA_GASTO = 0.18;
#endif

// O atlas (4 células de 2 casas). Tudo mancha larga e macia, sem contorno: de longe
// é o chão variando sem período; de perto, o piso usado, sem marca que se ache.
//   0 sujeira larga   1 arrastado (comprida)   2 gasto de passo (mais claro)
//   3 umidade seca
vec4 pintar_detalhe(int i, vec2 q, float px, int sem) {
	uint h = hash_cel(vec2(float(i), 5.0), 6211);
	vec4 acc = vec4(0.0);
	float ang = (rk(h, 20) - 0.5) * 2.6;
	if (i == 0) {
		acc = lj_mancha(acc, q, vec2(0.0), 40.0, 1.3, ang, lj_sujo(), LJ_ALFA_SUJO, h);
	} else if (i == 1) {
		acc = lj_mancha(acc, q, vec2(0.0), 42.0, 2.4, 0.15, lj_sujo(), LJ_ALFA_SUJO * 0.8, h);
	} else if (i == 2) {
		acc = lj_mancha(acc, q, vec2(0.0), 42.0, 1.4, ang, lj_gasto(), LJ_ALFA_GASTO, h);
	} else {
		acc = lj_marca_seca(acc, q, vec2(0.0), 34.0, ang, lj_sujo(), LJ_ALFA_SUJO, h);
	}
	// sobre() acumula cor multiplicada pelo alfa; o atlas guarda cor reta.
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}

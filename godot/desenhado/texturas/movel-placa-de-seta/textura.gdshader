// PLACA DE SETA desenhada que pega cor (onda 4, lote 11; CONTRATO.md seção 10).
//
// Vista de cima, da família do piloto (mesa, cadeira, barril) e do lote 10: contorno
// grosso na própria cor, formas grandes, luz em poucas massas. Duas peças, as duas de
// madeira (lugar 1):
// - A TÁBUA em forma de seta, uma peça só: o corpo largo com a cauda reta e a cabeça larga
//   até a ponta, as quinas redondas. Ela está no alto do poste, então fica um tom acima
//   do material (como a do Atual, "longe do chão"). A massa clara na borda de cima à
//   esquerda, a escura na de baixo à direita. Nada de letra, risco, veio nem prego.
// - O POSTE, que passa da tábua para cima: o topo redondo, o ponto mais alto e o mais
//   claro, de contorno macio (o fundo, não o contorno da tábua: senão ele lê como um "o"
//   furado), com a massa clara em cima à esquerda e a escura embaixo à direita, e a sombra
//   que ele joga na tábua embaixo à direita (a sombra de dentro é valor).
// A seta aponta para +x do móvel; a virada k a leva para onde o mestre girou (tela_de: a 1
// aponta para baixo, a 2 para a esquerda, a 3 para cima). Ela não é simétrica de lado a
// lado, então as 4 viradas são desenhadas (a luz fica em cima à esquerda em todas). A
// sombra no chão é do app.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "res://comum/movel.gdshaderinc"

// A tábua, no referencial do móvel (casas a partir do meio da pegada de 0,5 x 0,5). Os
// vértices são os do polígono de dentro; a silhueta é ele inchado de RAIO (as quinas
// redondas): a cauda em -0,242, a ponta em 0,248, o corpo com 0,1 e a cabeça com 0,202 de
// meia altura.
const float CAUDA = -0.226;    // a cauda reta
const float CORPO = 0.084;     // a meia altura do corpo
const float BASE = 0.060;      // onde a cabeça começa
const float ABA = 0.186;       // a meia altura da cabeça
const float PONTA = 0.232;     // a ponta
const float RAIO = 0.016;      // o arredondado das quinas
const float CONTORNO_TABUA = 0.036;
const float LUZ_TABUA = 0.026; // a largura da massa clara (a escura é 1,25 x)
const float TOM_TABUA = 0.11;  // acima do material: a tábua está no alto

// O poste: o topo redondo, por cima da tábua, no terço de trás (quase da altura do corpo).
const vec2 POSTE = vec2(-0.092, 0.0);
const float RAIO_POSTE = 0.082;
const float CONTORNO_POSTE = 0.018;
const float LUZ_POSTE = 0.026;      // a largura da massa clara do topo
const float ESCURO_POSTE = 0.030;   // a da escura
const float SOMBRA_DO_POSTE = 0.034; // o quanto a sombra do poste anda na tábua

// Distância a um polígono simples (Inigo Quilez), exata dentro e fora.
float sd_tabua(vec2 p) {
	vec2 v[7];
	v[0] = vec2(CAUDA, -CORPO);
	v[1] = vec2(BASE, -CORPO);
	v[2] = vec2(BASE, -ABA);
	v[3] = vec2(PONTA, 0.0);
	v[4] = vec2(BASE, ABA);
	v[5] = vec2(BASE, CORPO);
	v[6] = vec2(CAUDA, CORPO);
	float d = dot(p - v[0], p - v[0]);
	float s = 1.0;
	for (int i = 0; i < 7; i++) {
		int j = (i + 6) % 7;
		vec2 e = v[j] - v[i];
		vec2 w = p - v[i];
		vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
		d = min(d, dot(b, b));
		bool c1 = p.y >= v[i].y;
		bool c2 = p.y < v[j].y;
		bool c3 = e.x * w.y > e.y * w.x;
		if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) {
			s = -s;
		}
	}
	return s * sqrt(d) - RAIO;
}

float sd_poste(vec2 p) {
	return length(p - POSTE) - RAIO_POSTE;
}

void pintar_movel(vec2 q, float px, int vis, int qual, int vir, int sem, inout vec4 av, inout vec4 ac) {
	vec2 m = movel_de(q, vir);
	vec2 lm = movel_de(LUZ, vir); // a luz da tela, no referencial do móvel
	// A tábua: o contorno, o tom e as duas massas.
	float d = sd_tabua(m);
	if (d <= px) {
		float v = V_MEIO + TOM_TABUA;
		pousar(av, ac, V_CONTORNO, 1, cobre(d, px));
		float dentro = cobre(d + CONTORNO_TABUA, px);
		pousar(av, ac, v, 1, dentro);
		float escura = 1.0 - cobre(sd_tabua(m - lm * LUZ_TABUA * 1.25) + CONTORNO_TABUA, px);
		pousar(av, ac, v - MASSA_ESCURA, 1, dentro * escura);
		float clara = 1.0 - cobre(sd_tabua(m + lm * LUZ_TABUA) + CONTORNO_TABUA, px);
		pousar(av, ac, v + MASSA_CLARA, 1, dentro * clara);
		// A sombra do poste na tábua: o ponto que, andado para a luz, cai no poste.
		float ds = sd_poste(m + lm * SOMBRA_DO_POSTE);
		pousar(av, ac, V_SOMBRA - 0.02, 1, dentro * cobre(ds, px) * 0.9);
	}
	// O poste por cima: o contorno macio e o topo claro com as duas massas.
	float dp = sd_poste(m);
	if (dp <= px) {
		pousar(av, ac, V_FUNDO, 1, cobre(dp, px));
		float dentro = cobre(dp + CONTORNO_POSTE, px);
		pousar(av, ac, V_LUZ + 0.04, 1, dentro);
		float escura = 1.0 - cobre(sd_poste(m - lm * ESCURO_POSTE) + CONTORNO_POSTE, px);
		pousar(av, ac, V_MEIO + 0.01, 1, dentro * escura);
		float clara = 1.0 - cobre(sd_poste(m + lm * LUZ_POSTE) + CONTORNO_POSTE, px);
		pousar(av, ac, V_REALCE + 0.01, 1, dentro * clara);
	}
}

#include "res://comum/rodape_movel.gdshaderinc"

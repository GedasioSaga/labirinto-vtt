// =====================================================================
// comum/mundo.gdshaderinc: CONGELADO. Os designers só incluem, nunca editam.
//
// As duas contas do app que o contrato do Desenhado usa, portadas número a
// número para o Godot, para a mesa de prova mostrar o que o app vai mostrar:
//
//   hash_app(ix, iy, semente)      = hash()        de client/src/texturas/ruido.ts
//   ruido_do_mundo(x, y, semente)  = ruidoDoMundo() de client/src/texturas/meioTermo/ruidoDoMundo.ts
//
// O app conta em double e aqui é float de 32 bits: os dois concordam até
// ~1e-6, sem efeito visível. Qualquer mudança aqui tem de ser feita também
// no app (e vice-versa); por isso a pasta é congelada.
// =====================================================================

// Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(semente | 0, 1442695041),
// depois h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; (h >>> 0) / 2^32.
// A multiplicação de uint do GLSL é a mesma do Math.imul (os 32 bits de baixo).
// O resultado sai em [0, 1): os 24 bits de cima, para não arredondar para 1,0.
float hash_app(int ix, int iy, int sem) {
	uint h = (uint(ix) * 374761393u) ^ (uint(iy) * 668265263u) ^ (uint(sem) * 1442695041u);
	h = (h ^ (h >> 13u)) * 1274126177u;
	h ^= h >> 16u;
	return float(h >> 8u) * (1.0 / 16777216.0);
}

// ruidoDeValor: ruído de valor suave (smoothstep 3 - 2f) na grade inteira, em [-1, 1].
float ruido_de_valor(float x, float y, int sem) {
	float i = floor(x);
	float j = floor(y);
	float fx = x - i;
	float fy = y - j;
	float u = fx * fx * (3.0 - 2.0 * fx);
	float v = fy * fy * (3.0 - 2.0 * fy);
	int ii = int(i);
	int jj = int(j);
	float a = hash_app(ii, jj, sem);
	float b = hash_app(ii + 1, jj, sem);
	float c = hash_app(ii, jj + 1, sem);
	float d = hash_app(ii + 1, jj + 1, sem);
	return ((a * (1.0 - u) + b * u) * (1.0 - v) + (c * (1.0 - u) + d * u) * v) * 2.0 - 1.0;
}

// ruidoDoMundo: 3 escalas (230, 80 e 27 px do mundo; pesos 0,5 / 0,32 / 0,18),
// sementes semente, semente + 1, semente + 2. Sem período: não repete nunca.
float ruido_do_mundo(float x, float y, int sem) {
	return ruido_de_valor(x / 230.0, y / 230.0, sem) * 0.5
		+ ruido_de_valor(x / 80.0, y / 80.0, sem + 1) * 0.32
		+ ruido_de_valor(x / 27.0, y / 27.0, sem + 2) * 0.18;
}

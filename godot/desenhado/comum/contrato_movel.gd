extends RefCounted
## CONGELADO. O contrato de um MÓVEL DESENHADO que pega cor (onda 4, CONTRATO.md seção 10,
## decisão do usuário de 29/10/2026: "Desenho à mão que pega cor"): o config.json de
## "tipo": "movel", os tetos e o textura.json que o app lê.
## Cada móvel é desenhado inteiro, como as árvores da onda 3, em CINZA (o valor) com as
## PARTES MARCADAS (o peso de cada lugar de material); o app pinta cada parte com o
## material que o mestre escolheu (LUGARES_DE_MATERIAL de client/src/texturas/meioTermo/
## materiais.ts). A sombra no chão é do app.

const Contrato := preload("res://comum/contrato.gd")

const TIPO := "movel"
const PX_POR_CASA := 128 ## px da imagem por casa
const VISTAS := ["frente", "lado"] ## frente = a vista de cima de sempre; lado = a Frente/Lado do mestre
const VIRADAS_VALIDAS := [1, 2, 4]
const LUGARES_MAX := 3
const VARIANTES_MAX := 4
## A variação que o app sorteia pelo id do objeto (opcional, CONTRATO 10.2, lote 15): a chave
## "variacao" de "quando" bate com ela, e não com um lugar. Só os tipos daqui a têm: a função
## do app que a integração chama e quantos desenhos ela sorteia.
const CHAVE_DA_VARIACAO := "variacao"
const VARIACAO_DO_APP := {
	"lapide": {"funcao": "varianteDaLapide(prop.id) de client/src/lib/mobilia/pecasNovas.ts (0 = arco, 1 = reta, 2 = cruz)", "quantas": 3},
}
const CASAS_MIN := 0.25
const CASAS_MAX := 8.0
const MARGEM_MAX := 0.25
## Tetos (CONTRATO.md 10.1 item 6). Memória comum = as imagens decodificadas em RGBA com
## mipmap, só dos tipos que o mapa usa. O teto de memória é POR VISTA (decisão do
## orquestrador, lote 12): o app carrega só a vista que o móvel usa (a Frente/Lado do mestre).
## No textura.json ele continua em "tetoMemoriaBytes"; "memoriaBytes" é a soma de todas as formas.
const TETO_MEMORIA_POR_VISTA := 3 * 1024 * 1024
const TETO_DISCO_POR_MOVEL := 512 * 1024
const TETO_MEMORIA_DOS_31 := 24 * 1024 * 1024
## A sombra do app (a mesma cor e alfa dos carimbos, CONTRATO 9.1 item 3).
const SOMBRA_DIRECAO := [7, 11]
const SOMBRA_COR := "#0a1c28"
const SOMBRA_ALFA := 0.25
## A rampa da família (CONTRATO 10.5): os nós (valor -> fator da luz OKLab no escuro, e
## fração do caminho até o branco no claro), iguais em ferramentas/movel.ts.
const RAMPA := {
	"conta": "valor-oklab",
	"escuro": [[0.0, 0.42], [0.10, 0.50], [0.24, 0.64], [0.36, 0.78], [0.50, 1.0]],
	"claro": [[0.50, 0.0], [0.62, 0.12], [0.76, 0.26], [1.0, 0.45]],
	"cromaNaSombra": 0.25,
	"amareloNaLuz": 0.12,
	"cromaNaLuz": 0.2,
	"escuroAte": 0.10,
	"claroDesde": 0.94,
}
## Tolerância da faixa do meio de quem estica: a coluna do meio tem de ser a mesma em todo x.
## No meio que repete, a mesma folga vale para a costura (a faixa em volta de cada emenda
## de módulo igual à da primeira).
const MEIO_LISO_FOLGA := 2.0 / 255.0
## O meio que repete: o menor período, e a meia largura (px) da faixa da costura que tem de
## ser lisa e igual em toda emenda (o app lê a fonte bilinear e com mipmap nela).
const PERIODO_MIN := 0.25
const COSTURA_PX := 4
## A cerca por peças (opcional, CONTRATO 10.12): a faixa em que a luz da ligação troca de borda.
const VIRADA_DA_LUZ_MIN := 0.05
const VIRADA_DA_LUZ_MAX := 1.0
## O centro fixo (opcional, CONTRATO 10.6): o menor meio liso, px, de cada lado do centro.
const CENTRO_LISO_MIN_PX := 2


static func eh_movel(id: String) -> bool:
	var caminho := "res://texturas/%s/config.json" % id
	if not FileAccess.file_exists(caminho):
		return false
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho))
	return typeof(bruto) == TYPE_DICTIONARY and str(bruto.get("tipo", "")) == TIPO


## As viradas que o designer DESENHA (as outras saem pela diagonal, CONTRATO 10.4).
static func viradas_desenhadas(n: int) -> Array:
	if n == 4:
		return [0, 1, 2, 3]
	if n == 2:
		return [0, 2]
	return [0]


static func nome_da_forma(vista: String, variante: String, virada: int) -> String:
	return "%s-%s-%d" % [vista, variante, virada]


static func _par(v, padrao: Array) -> Array:
	if typeof(v) != TYPE_ARRAY or v.size() != 2:
		return padrao
	return [float(v[0]), float(v[1])]


## Devolve {"ok", "erros", "config"} com os padrões preenchidos.
static func ler_config(id: String) -> Dictionary:
	var erros: Array[String] = []
	var caminho := "res://texturas/%s/config.json" % id
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho)) if FileAccess.file_exists(caminho) else null
	if typeof(bruto) != TYPE_DICTIONARY:
		return {"ok": false, "erros": ["não li %s (JSON de objeto)" % caminho] as Array[String], "config": {}}
	var c: Dictionary = bruto
	var cfg := {}
	cfg["id"] = str(c.get("id", ""))
	if cfg["id"] != id:
		erros.append("\"id\" tem de ser \"%s\" (é \"%s\")" % [id, cfg["id"]])
	cfg["nome"] = str(c.get("nome", id))
	cfg["tipo"] = TIPO
	cfg["idDoApp"] = str(c.get("idDoApp", ""))
	if cfg["idDoApp"] == "":
		erros.append("\"idDoApp\" = o tipo do móvel no app (lib/mobilia/tipos.ts), ex.: \"mesa\"")
	cfg["onda"] = int(c.get("onda", 4))
	cfg["lote"] = int(c.get("lote", 0))
	cfg["semente"] = int(c.get("semente", 7))
	cfg["margemCasas"] = float(c.get("margemCasas", 0.0625))
	if cfg["margemCasas"] < 0.0 or cfg["margemCasas"] > MARGEM_MAX:
		erros.append("\"margemCasas\" de 0 a %.2f" % MARGEM_MAX)
	var lugares = c.get("lugares", [])
	if typeof(lugares) != TYPE_ARRAY or lugares.size() > LUGARES_MAX:
		erros.append("\"lugares\": até %d ids, na ordem de LUGARES_DE_MATERIAL do app" % LUGARES_MAX)
		lugares = []
	cfg["lugares"] = []
	for l in lugares:
		cfg["lugares"].append(str(l))
	cfg["corFixa"] = bool(c.get("corFixa", false))
	# As variantes: a opção de um lugar que muda o DESENHO (não só a cor).
	var variantes = c.get("variantes", [{"nome": "padrao"}])
	if typeof(variantes) != TYPE_ARRAY or variantes.is_empty() or variantes.size() > VARIANTES_MAX:
		erros.append("\"variantes\": de 1 a %d, cada uma {\"nome\", \"quando\": {lugar: opção}}; a última vale quando nenhuma bate" % VARIANTES_MAX)
		variantes = [{"nome": "padrao"}]
	cfg["variantes"] = []
	# As vistas próprias de uma variante (opcional, CONTRATO 10.6, lote 13: o tapete redondo),
	# lidas depois das vistas do móvel; sem "vistas" na variante, ela sai igual.
	var vistas_das_variantes := {}
	for v in variantes:
		if typeof(v) != TYPE_DICTIONARY or str(v.get("nome", "")) == "":
			erros.append("cada variante precisa de \"nome\"")
			continue
		var quando = v.get("quando", {})
		# A variação do app (10.2, lote 15): o texto do número que o app sorteia pelo id.
		if typeof(quando) == TYPE_DICTIONARY and quando.has(CHAVE_DA_VARIACAO):
			var erro_v := _erro_da_variacao(cfg["idDoApp"], quando[CHAVE_DA_VARIACAO])
			if erro_v != "":
				erros.append("variante \"%s\": %s" % [str(v["nome"]), erro_v])
			cfg["variacao"] = VARIACAO_DO_APP.get(cfg["idDoApp"], {})
		if v.has("vistas"):
			vistas_das_variantes[cfg["variantes"].size()] = v["vistas"]
		cfg["variantes"].append({"nome": str(v["nome"]), "quando": quando if typeof(quando) == TYPE_DICTIONARY else {}})
	# As vistas.
	var vistas = c.get("vistas", {})
	if typeof(vistas) != TYPE_DICTIONARY or not vistas.has("frente"):
		erros.append("\"vistas\" precisa de \"frente\": {\"casas\": [w, h], \"viradas\": 1 | 2 | 4}")
		vistas = {"frente": {}}
	cfg["vistas"] = {}
	for nome in VISTAS:
		if not vistas.has(nome):
			continue
		var vb = vistas[nome]
		if typeof(vb) != TYPE_DICTIONARY:
			erros.append("vista \"%s\" tem de ser um objeto" % nome)
			continue
		cfg["vistas"][nome] = _ler_vista(nome, vb, cfg["margemCasas"], 0, erros)
	# A vista própria de uma variante troca a pegada e o esticar só nas formas dela; as viradas
	# são as da vista do móvel (o número de formas não muda).
	for iv in vistas_das_variantes:
		var bruto_v = vistas_das_variantes[iv]
		var nome_v: String = cfg["variantes"][iv]["nome"]
		if typeof(bruto_v) != TYPE_DICTIONARY:
			erros.append("variante \"%s\": \"vistas\" tem de ser um objeto {\"frente\": {\"casas\", \"esticar\"}, ...}" % nome_v)
			continue
		var proprias := {}
		for nome in bruto_v:
			if not cfg["vistas"].has(nome) or typeof(bruto_v[nome]) != TYPE_DICTIONARY:
				erros.append("variante \"%s\": a vista \"%s\" tem de existir no móvel e ser um objeto" % [nome_v, nome])
				continue
			proprias[nome] = _ler_vista("%s da variante %s" % [nome, nome_v], bruto_v[nome], cfg["margemCasas"], int(cfg["vistas"][nome]["viradas"]), erros)
		cfg["variantes"][iv]["vistas"] = proprias
	var sb = c.get("sombra", {})
	if typeof(sb) != TYPE_DICTIONARY:
		sb = {}
	cfg["sombra"] = {
		"jeito": str(sb.get("jeito", "deslocada")),
		"deslocamentoCasas": float(sb.get("deslocamentoCasas", 0.08)),
		"borraoCasas": float(sb.get("borraoCasas", 0.04)),
	}
	if not ["deslocada", "nenhuma"].has(cfg["sombra"]["jeito"]):
		erros.append("\"sombra.jeito\": \"deslocada\" ou \"nenhuma\" (o tapete)")
	if cfg["sombra"]["deslocamentoCasas"] < 0.0 or cfg["sombra"]["deslocamentoCasas"] > 0.4 or cfg["sombra"]["borraoCasas"] < 0.0 or cfg["sombra"]["borraoCasas"] > 0.2:
		erros.append("\"sombra\": deslocamentoCasas de 0 a 0,4 e borraoCasas de 0 a 0,2")
	# A cerca por peças (opcional, CONTRATO 10.12): só quem pede "pecas"; sem o campo, o
	# textura.json sai igual.
	if c.has("pecas"):
		var pe := _ler_pecas(c["pecas"], cfg)
		erros.append_array(pe["erros"])
		if pe["erros"].is_empty():
			cfg["pecas"] = pe["pecas"]
	return {"ok": erros.is_empty(), "erros": erros, "config": cfg}


## O erro de um "quando.variacao" (vazio = ok): só num tipo de VARIACAO_DO_APP, e o valor é o
## texto do número que o app sorteia ("0" até quantas - 1), como as opções dos lugares.
static func _erro_da_variacao(tipo: String, valor) -> String:
	if not VARIACAO_DO_APP.has(tipo):
		return "\"quando.%s\" só nos tipos em que o app sorteia o desenho pelo id do objeto (%s)" % [CHAVE_DA_VARIACAO, ", ".join(PackedStringArray(VARIACAO_DO_APP.keys()))]
	var quantas: int = VARIACAO_DO_APP[tipo]["quantas"]
	if typeof(valor) != TYPE_STRING or not str(valor).is_valid_int() or str(valor).to_int() < 0 or str(valor).to_int() >= quantas:
		return "\"quando.%s\" é o texto do número que o app sorteia, de \"0\" a \"%d\"" % [CHAVE_DA_VARIACAO, quantas - 1]
	return ""


## Uma vista: a pegada, as viradas (viradas_fixas > 0: as da vista do móvel, numa vista própria
## de variante) e o esticar, com o meio que repete e o centro fixo (no x e, no "xy", no y).
static func _ler_vista(nome: String, vb: Dictionary, margem: float, viradas_fixas: int, erros: Array[String]) -> Dictionary:
	var casas := _par(vb.get("casas"), [1.0, 1.0])
	if casas[0] < CASAS_MIN or casas[1] < CASAS_MIN or casas[0] > CASAS_MAX or casas[1] > CASAS_MAX:
		erros.append("vista \"%s\": \"casas\" de %.2f a %.0f" % [nome, CASAS_MIN, CASAS_MAX])
	var viradas := viradas_fixas if viradas_fixas > 0 else int(vb.get("viradas", 1))
	if not VIRADAS_VALIDAS.has(viradas):
		erros.append("vista \"%s\": \"viradas\" 1 (igual girada meia volta), 2 (simétrica de lado a lado) ou 4" % nome)
		viradas = 1
	var vc := {"casas": casas, "viradas": viradas}
	var es = vb.get("esticar", null)
	if typeof(es) == TYPE_DICTIONARY:
		var eixo := str(es.get("eixo", "x"))
		if eixo != "x" and eixo != "xy":
			erros.append("vista \"%s\": \"esticar.eixo\" é \"x\" (ao longo) ou \"xy\"" % nome)
		var pontas := _par(es.get("pontasCasas"), [0.5, 0.5])
		var pontas_y := _par(es.get("pontasCasasY"), pontas)
		if pontas[0] + pontas[1] >= casas[0] + 2.0 * margem:
			erros.append("vista \"%s\": as pontas (%.2f + %.2f) não deixam meio no desenho de %.2f casas" % [nome, pontas[0], pontas[1], casas[0]])
		# ladoMaior: o móvel estica pelo lado maior da pegada (a mesa de 1 x 2 sem giro é a
		# de 2 x 1 deitada: o app troca w e h e soma um quarto de volta).
		vc["esticar"] = {"eixo": eixo, "pontasCasas": pontas, "pontasCasasY": pontas_y if eixo == "xy" else null, "ladoMaior": bool(es.get("ladoMaior", false))}
		# O meio que repete (opcional, CONTRATO 10.6): só quem pede periodoCasas; sem ele
		# o meio continua liso e o textura.json sai igual.
		if es.has("periodoCasas"):
			var rep := _ler_periodo(nome, eixo, casas[0], pontas, es["periodoCasas"], margem)
			erros.append_array(rep["erros"])
			if rep["erros"].is_empty():
				vc["esticar"]["periodoCasas"] = rep["periodo"]
				vc["esticar"]["modulos"] = rep["modulos"]
		# O centro fixo (opcional, CONTRATO 10.6, lote 12): a peça do meio que não estica e
		# fica centrada; sem centroCasas o textura.json sai igual.
		if es.has("centroCasas"):
			var ce := _ler_centro(nome, eixo, casas[0], pontas, es["centroCasas"], margem, es.has("periodoCasas"), false)
			erros.append_array(ce["erros"])
			if ce["erros"].is_empty():
				vc["esticar"]["centroCasas"] = ce["centro"]
		# O centro fixo atravessado (opcional, lote 13, o tapete): no "xy", o mesmo centro no y.
		if es.has("centroCasasY"):
			var cy := _ler_centro(nome + " (y)", eixo, casas[1], pontas_y, es["centroCasasY"], margem, false, true)
			erros.append_array(cy["erros"])
			if cy["erros"].is_empty():
				vc["esticar"]["centroCasasY"] = cy["centro"]
	return vc


## A vista de uma forma: a própria da variante, se ela tem (CONTRATO 10.6), ou a do móvel.
static func vista_da_variante(cfg: Dictionary, vista: String, iv: int) -> Dictionary:
	var proprias: Dictionary = cfg["variantes"][iv].get("vistas", {})
	return proprias[vista] if proprias.has(vista) else cfg["vistas"][vista]


## As peças da cerca: o meio de um mourão e o raio do recorte, a coluna da ligação (na forma 0
## da vista frente, casas a partir do canto da pegada) e a faixa da virada da luz.
static func _ler_pecas(bruto, cfg: Dictionary) -> Dictionary:
	var erros: Array[String] = []
	if typeof(bruto) != TYPE_DICTIONARY or not cfg["vistas"].has("frente"):
		return {"erros": ["\"pecas\": {\"mouraoCasas\": [x, y], \"raioCasas\", \"colunaCasas\", \"viradaDaLuz\"}, com a vista frente"] as Array[String], "pecas": {}}
	var casas: Array = cfg["vistas"]["frente"]["casas"]
	var mourao := _par(bruto.get("mouraoCasas"), [-1.0, -1.0])
	var raio := float(bruto.get("raioCasas", -1.0))
	var coluna := float(bruto.get("colunaCasas", -1.0))
	var virada := float(bruto.get("viradaDaLuz", 0.35))
	if mourao[0] < 0.0 or mourao[1] < 0.0 or mourao[0] > casas[0] or mourao[1] > casas[1]:
		erros.append("\"pecas.mouraoCasas\": o meio de um mourão dentro da pegada da frente (%.2f x %.2f)" % [casas[0], casas[1]])
	if raio <= 0.0 or raio > 0.5 * casas[1] + cfg["margemCasas"]:
		erros.append("\"pecas.raioCasas\": de 0 até a meia altura da pegada mais a margem")
	if coluna <= 0.0 or coluna >= casas[0]:
		erros.append("\"pecas.colunaCasas\": a coluna da ligação dentro da pegada (0 a %.2f)" % casas[0])
	elif absf(coluna - mourao[0]) < raio:
		erros.append("\"pecas.colunaCasas\": a coluna da ligação não pode passar pelo mourão do recorte")
	if virada < VIRADA_DA_LUZ_MIN or virada > VIRADA_DA_LUZ_MAX:
		erros.append("\"pecas.viradaDaLuz\" de %.2f a %.2f" % [VIRADA_DA_LUZ_MIN, VIRADA_DA_LUZ_MAX])
	return {"erros": erros, "pecas": {"mouraoCasas": mourao, "raioCasas": raio, "colunaCasas": coluna, "viradaDaLuz": virada}}


## O meio que repete: o desenho leva entre as pontas um número inteiro de módulos de
## periodoCasas, e as pontas, o período e a margem caem em px inteiros (a costura que o
## exportador mede é coluna contra coluna). Só ao longo (eixo "x").
static func _ler_periodo(vista: String, eixo: String, comprimento: float, pontas: Array, bruto, margem: float) -> Dictionary:
	var erros: Array[String] = []
	var periodo := float(bruto) if typeof(bruto) == TYPE_FLOAT or typeof(bruto) == TYPE_INT else -1.0
	var meio: float = comprimento - pontas[0] - pontas[1]
	var modulos := int(round(meio / periodo)) if periodo > 0.0 else 0
	if eixo != "x":
		erros.append("vista \"%s\": \"esticar.periodoCasas\" (o meio que repete) só com \"eixo\": \"x\"" % vista)
	elif periodo < PERIODO_MIN or periodo > meio + 1e-4:
		erros.append("vista \"%s\": \"esticar.periodoCasas\" de %.2f até o meio do desenho (%.3f casas)" % [vista, PERIODO_MIN, meio])
	elif absf(meio / periodo - modulos) > 1e-3:
		erros.append("vista \"%s\": o meio do desenho (%.3f casas, entre as pontas) tem de ser um número inteiro de módulos de %.3f" % [vista, meio, periodo])
	else:
		for v in [periodo, pontas[0], pontas[1], margem]:
			if absf(v * PX_POR_CASA - round(v * PX_POR_CASA)) > 1e-3:
				erros.append("vista \"%s\": com periodoCasas, as pontas, o período e a margem têm de dar px inteiros (x %d): %.4f não dá" % [vista, PX_POR_CASA, v])
				break
	return {"erros": erros, "periodo": periodo, "modulos": modulos}


## O centro fixo: a peça do meio de centroCasas casas fica inteira e centrada, e o meio liso
## dos dois lados dela estica (a placa do arco do portão). Só ao longo (eixo "x"), nunca com
## periodoCasas; entre as pontas e o centro sobra meio liso dos dois lados (ao menos 2 px), e o
## centro, as pontas e a margem caem em px inteiros (o exportador mede o liso coluna contra
## coluna, fora do centro). No "xy" (lote 13, o tapete) o centro vale também atravessado:
## centroCasasY no y (no_y), com as pontasCasasY, a mesma conta.
static func _ler_centro(vista: String, eixo: String, comprimento: float, pontas: Array, bruto, margem: float, com_periodo: bool, no_y: bool) -> Dictionary:
	var erros: Array[String] = []
	var centro := float(bruto) if typeof(bruto) == TYPE_FLOAT or typeof(bruto) == TYPE_INT else -1.0
	var liso: float = (comprimento - pontas[0] - pontas[1] - centro) / 2.0
	if no_y and eixo != "xy":
		erros.append("vista \"%s\": \"esticar.centroCasasY\" (o centro fixo atravessado) só com \"eixo\": \"xy\"" % vista)
	elif not no_y and eixo != "x" and eixo != "xy":
		erros.append("vista \"%s\": \"esticar.centroCasas\" (o centro fixo) só com \"eixo\": \"x\" ou \"xy\"" % vista)
	elif com_periodo:
		erros.append("vista \"%s\": \"esticar.centroCasas\" e \"periodoCasas\" não andam juntos (o centro fixo é para o meio liso)" % vista)
	elif centro <= 0.0 or liso < CENTRO_LISO_MIN_PX / float(PX_POR_CASA) - 1e-4:
		erros.append("vista \"%s\": \"esticar.centroCasas\" de 0 até deixar %d px de meio liso de cada lado entre as pontas (o meio do desenho tem %.3f casas)" % [vista, CENTRO_LISO_MIN_PX, comprimento - pontas[0] - pontas[1]])
	else:
		for v in [centro, pontas[0], pontas[1], margem]:
			if absf(v * PX_POR_CASA - round(v * PX_POR_CASA)) > 1e-3:
				erros.append("vista \"%s\": com centroCasas, o centro, as pontas e a margem têm de dar px inteiros (x %d): %.4f não dá" % [vista, PX_POR_CASA, v])
				break
	return {"erros": erros, "centro": centro}


## A memória decodificada de cada vista (o teto é por vista): {vista: bytes}, pelo nome dos
## arquivos ("<vista>-<variante>-<virada>[-partes|-cor].png").
static func memoria_por_vista(imagens: Dictionary) -> Dictionary:
	var r := {}
	for arquivo in imagens:
		var vista: String = str(arquivo).get_slice("-", 0)
		var img: Image = imagens[arquivo]
		r[vista] = int(r.get(vista, 0)) + bytes_memoria(img.get_width(), img.get_height())
	return r


## O tamanho da imagem (px) de uma forma: a pegada (deitada na virada 1 e 3) mais a margem.
static func tamanho_da_imagem(casas: Array, virada: int, margem: float) -> Vector2i:
	var w: float = casas[1] if virada % 2 == 1 else casas[0]
	var h: float = casas[0] if virada % 2 == 1 else casas[1]
	return Vector2i(int(round((w + 2.0 * margem) * PX_POR_CASA)), int(round((h + 2.0 * margem) * PX_POR_CASA)))


## Todas as formas que o exportador pinta: [{nome, vista, iVista, variante, iVariante, virada, casas}].
static func formas(cfg: Dictionary) -> Array:
	var r := []
	for vista in VISTAS:
		if not cfg["vistas"].has(vista):
			continue
		var vc: Dictionary = cfg["vistas"][vista]
		for iv in cfg["variantes"].size():
			var variante: String = cfg["variantes"][iv]["nome"]
			var vv := vista_da_variante(cfg, vista, iv)
			for virada in viradas_desenhadas(vc["viradas"]):
				var casas: Array = vv["casas"]
				var deitada: Array = [casas[1], casas[0]] if virada % 2 == 1 else casas
				r.append({"nome": nome_da_forma(vista, variante, virada), "vista": vista, "iVista": VISTAS.find(vista), "variante": variante, "iVariante": iv, "virada": virada, "casas": deitada, "tamanho": tamanho_da_imagem(casas, virada, cfg["margemCasas"])})
	return r


## Bytes na memória comum de uma imagem decodificada (RGBA, mais 1/3 de mipmap).
static func bytes_memoria(w: int, h: int) -> int:
	return int(w * h * 4 * 4 / 3)


## Uma vista no textura.json: a pegada, as viradas (e as desenhadas) e o esticar com o texto
## da conta do meio.
static func _vista_para_json(vc: Dictionary) -> Dictionary:
	var v := {"casas": vc["casas"], "viradas": vc["viradas"], "desenhadas": viradas_desenhadas(vc["viradas"])}
	if vc.has("esticar"):
		v["esticar"] = vc["esticar"].duplicate()
		if vc["esticar"].has("periodoCasas"):
			v["esticar"]["meio"] = "repete: entre as pontas o desenho tem 'modulos' módulos de periodoCasas, e a emenda de dois módulos (e a de módulo com ponta) é a mesma coluna lisa. Para um meio de M casas, o app põe n = round(M / periodoCasas) módulos, cada um com M / n casas (a sobra se reparte pelos módulos); com n = 0, o meio é a coluna da emenda. Cada módulo lê o primeiro módulo da imagem."
		elif vc["esticar"].has("centroCasasY"):
			v["esticar"]["meio"] = "centro fixo nos dois eixos: ao longo (x) a peça de centroCasas casas e atravessado (y) a de centroCasasY, no meio da imagem, ficam inteiras e no meio do móvel; em cada eixo, o meio liso dos dois lados do centro (entre a ponta e o centro, a mesma coluna em todo x e a mesma linha em todo y) estica com a metade do que sobra. Num eixo sem centro, o meio liso estica inteiro. Mais curto que pontas + centro, o centro continua inteiro e cada ponta perde por dentro a metade do que falta."
		elif vc["esticar"].has("centroCasas"):
			v["esticar"]["meio"] = "centro fixo: a peça de centroCasas casas no meio da imagem fica inteira e no meio do móvel; o meio liso dos dois lados dela (entre a ponta e o centro, a mesma coluna em todo x) estica, cada lado com a metade do que sobra. Mais curto que pontas + centro, o centro continua inteiro e cada ponta perde por dentro a metade do que falta."
		else:
			v["esticar"]["meio"] = "liso: a faixa entre as pontas é a mesma em todo x (e em todo y no xy); o app estica o meio, o que nele é igual a repetir"
	return v


## O textura.json: tudo explícito, o app não deriva nada.
static func parametros(cfg: Dictionary, r: Dictionary, memoria: int, disco: int) -> Dictionary:
	var lista := []
	for f in formas(cfg):
		var nome: String = f["nome"]
		var m: Dictionary = r["medidas"].get(nome, {})
		var item := {
			"nome": nome, "vista": f["vista"], "variante": f["variante"], "virada": f["virada"],
			"casas": f["casas"], "larguraPx": f["tamanho"].x, "alturaPx": f["tamanho"].y,
			"valor": nome + ".png", "partes": nome + "-partes.png",
			"valorMedioPorLugar": m.get("valorMedioPorLugar", []), "cobertura": m.get("cobertura", 0.0),
		}
		if cfg["corFixa"]:
			item["cor"] = nome + "-cor.png"
		if m.has("meioLiso"):
			item["variacaoDoMeio"] = m["meioLiso"]
		if m.has("costura"):
			item["costuraDoModulo"] = m["costura"]
		if m.has("meioLisoY"):
			item["variacaoDoMeioY"] = m["meioLisoY"]
		lista.append(item)
	var vistas := {}
	for vista in cfg["vistas"]:
		vistas[vista] = _vista_para_json(cfg["vistas"][vista])
	# A variante com vistas próprias (o tapete redondo) leva a pegada e o esticar delas; as
	# outras saem como sempre ({nome, quando}).
	var variantes := []
	for v in cfg["variantes"]:
		if not v.has("vistas"):
			variantes.append(v)
			continue
		var proprias := {}
		for vista in v["vistas"]:
			proprias[vista] = _vista_para_json(v["vistas"][vista])
		variantes.append({"nome": v["nome"], "quando": v["quando"], "vistas": proprias})
	var json := {
		"contrato": Contrato.VERSAO,
		"tipo": TIPO,
		"id": cfg["id"],
		"nome": cfg["nome"],
		"idDoApp": cfg["idDoApp"],
		"onda": cfg["onda"],
		"lote": cfg["lote"],
		"semente": cfg["semente"],
		"pxPorCasa": PX_POR_CASA,
		"margemCasas": cfg["margemCasas"],
		"lugares": cfg["lugares"],
		"canais": {
			"valor": "R = G = B: o valor 0..1 (0,5 = o tom do material do lugar); A = a cobertura; alfa reto",
			"partes": "R, G, B = o peso do lugar 1, 2 e 3 (a ordem de \"lugares\"); 1 - R - G - B = a cor fixa (imagem -cor) ou, sem ela, o lugar 1; A = a cobertura",
			"cor": "só com corFixa: RGB = a cor própria (louça, comida, água, vidro, chama), já pintada; A = a cobertura",
		},
		"variantes": variantes,
		"vistas": vistas,
		"viradas": "k = round(giro / 90) mod 4. viradas 1 (o desenho é simétrico de lado a lado e de cima a baixo): k par = a forma 0, k ímpar = a 0 transposta. viradas 2 (simétrico de lado a lado): k 0 = a 0, k 2 = a 2, k 1 = a 2 transposta, k 3 = a 0 transposta. viradas 4: a forma k, nunca transposta. A tela gira só o resto (giro - 90 k, de -45 a 45 graus). Transposta = (x, y) -> (y, x) nos px da imagem: a LUZ está na diagonal e não muda.",
		"formas": lista,
		"sombra": {
			"jeito": cfg["sombra"]["jeito"], "direcao": SOMBRA_DIRECAO,
			"deslocamentoCasas": cfg["sombra"]["deslocamentoCasas"], "borraoCasas": cfg["sombra"]["borraoCasas"],
			"alfa": SOMBRA_ALFA, "cor": SOMBRA_COR,
			"conta": "a silhueta (o alfa do móvel já virado e esticado) andada deslocamentoCasas na direção (7, 11) normalizada, desfocada borraoCasas (desvio), pintada com a cor e o alfa, por baixo do móvel",
		},
		"tingir": RAMPA,
		"memoria": {
			"memoriaBytes": memoria,
			"discoBytes": disco,
			"tetoMemoriaBytes": TETO_MEMORIA_POR_VISTA,
			"tetoDiscoBytes": TETO_DISCO_POR_MOVEL,
			"tetoMemoriaDos31Bytes": TETO_MEMORIA_DOS_31,
		},
	}
	# Só a cerca por peças (10.12): sem "pecas" no config, a chave não existe e o resto sai igual.
	if cfg.has("pecas"):
		var pe: Dictionary = cfg["pecas"].duplicate()
		pe["conta"] = "a cerca por peças, reta ou curva, na geometria do app (geometriaDaCerca de lib/mobilia.ts, girada pelo giro do objeto): a ligação = a coluna colunaCasas da forma frente-<variante>-0 tingida, deitada ao longo do eixo (o segmento do primeiro ao último mourão, ou o arco), na altura c (atravessando, + do lado n = (-t.y, t.x)), misturada com a mesma coluna na altura -c por w = smoothstep(-viradaDaLuz, viradaDaLuz, -dot(n, LUZ) / 0,7071); por cima, em pé (sem girar), o recorte de raio raioCasas em volta de mouraoCasas no meio de cada mourão; a sombra pela silhueta, como as outras; a tela não gira mais nada"
		json["pecas"] = pe
	# Só quem escolhe o desenho pela variação do app (10.2, lote 15: a lápide): sem
	# "quando.variacao" em nenhuma variante, a chave não existe e o resto sai igual.
	if cfg.has("variacao") and not cfg["variacao"].is_empty():
		json["variacao"] = {
			"chave": CHAVE_DA_VARIACAO,
			"doApp": cfg["variacao"]["funcao"],
			"quantas": cfg["variacao"]["quantas"],
			"conta": "a variante é a primeira cujo \"quando\" inteiro bate; a chave \"variacao\" bate quando o seu texto é o número que o app sorteia pelo id do objeto (doApp; sem id, 0), as outras chaves como sempre; nenhuma bate = a última",
		}
	return json

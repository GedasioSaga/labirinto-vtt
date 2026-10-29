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
const CASAS_MIN := 0.25
const CASAS_MAX := 8.0
const MARGEM_MAX := 0.25
## Tetos (CONTRATO.md 10.8). Memória comum = as imagens decodificadas em RGBA com mipmap,
## só dos tipos que o mapa usa.
const TETO_MEMORIA_POR_MOVEL := 3 * 1024 * 1024
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
	for v in variantes:
		if typeof(v) != TYPE_DICTIONARY or str(v.get("nome", "")) == "":
			erros.append("cada variante precisa de \"nome\"")
			continue
		var quando = v.get("quando", {})
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
		var casas := _par(vb.get("casas"), [1.0, 1.0])
		if casas[0] < CASAS_MIN or casas[1] < CASAS_MIN or casas[0] > CASAS_MAX or casas[1] > CASAS_MAX:
			erros.append("vista \"%s\": \"casas\" de %.2f a %.0f" % [nome, CASAS_MIN, CASAS_MAX])
		var viradas := int(vb.get("viradas", 1))
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
			if pontas[0] + pontas[1] >= casas[0] + 2.0 * cfg["margemCasas"]:
				erros.append("vista \"%s\": as pontas (%.2f + %.2f) não deixam meio no desenho de %.2f casas" % [nome, pontas[0], pontas[1], casas[0]])
			# ladoMaior: o móvel estica pelo lado maior da pegada (a mesa de 1 x 2 sem giro é a
			# de 2 x 1 deitada: o app troca w e h e soma um quarto de volta).
			vc["esticar"] = {"eixo": eixo, "pontasCasas": pontas, "pontasCasasY": pontas_y if eixo == "xy" else null, "ladoMaior": bool(es.get("ladoMaior", false))}
			# O meio que repete (opcional, CONTRATO 10.6): só quem pede periodoCasas; sem ele
			# o meio continua liso e o textura.json sai igual.
			if es.has("periodoCasas"):
				var rep := _ler_periodo(nome, eixo, casas[0], pontas, es["periodoCasas"], cfg["margemCasas"])
				erros.append_array(rep["erros"])
				if rep["erros"].is_empty():
					vc["esticar"]["periodoCasas"] = rep["periodo"]
					vc["esticar"]["modulos"] = rep["modulos"]
		cfg["vistas"][nome] = vc
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
			for virada in viradas_desenhadas(vc["viradas"]):
				var casas: Array = vc["casas"]
				var deitada: Array = [casas[1], casas[0]] if virada % 2 == 1 else casas
				r.append({"nome": nome_da_forma(vista, variante, virada), "vista": vista, "iVista": VISTAS.find(vista), "variante": variante, "iVariante": iv, "virada": virada, "casas": deitada, "tamanho": tamanho_da_imagem(casas, virada, cfg["margemCasas"])})
	return r


## Bytes na memória comum de uma imagem decodificada (RGBA, mais 1/3 de mipmap).
static func bytes_memoria(w: int, h: int) -> int:
	return int(w * h * 4 * 4 / 3)


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
		lista.append(item)
	var vistas := {}
	for vista in cfg["vistas"]:
		var vc: Dictionary = cfg["vistas"][vista]
		var v := {"casas": vc["casas"], "viradas": vc["viradas"], "desenhadas": viradas_desenhadas(vc["viradas"])}
		if vc.has("esticar"):
			v["esticar"] = vc["esticar"].duplicate()
			if vc["esticar"].has("periodoCasas"):
				v["esticar"]["meio"] = "repete: entre as pontas o desenho tem 'modulos' módulos de periodoCasas, e a emenda de dois módulos (e a de módulo com ponta) é a mesma coluna lisa. Para um meio de M casas, o app põe n = round(M / periodoCasas) módulos, cada um com M / n casas (a sobra se reparte pelos módulos); com n = 0, o meio é a coluna da emenda. Cada módulo lê o primeiro módulo da imagem."
			else:
				v["esticar"]["meio"] = "liso: a faixa entre as pontas é a mesma em todo x (e em todo y no xy); o app estica o meio, o que nele é igual a repetir"
		vistas[vista] = v
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
		"variantes": cfg["variantes"],
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
			"tetoMemoriaBytes": TETO_MEMORIA_POR_MOVEL,
			"tetoDiscoBytes": TETO_DISCO_POR_MOVEL,
			"tetoMemoriaDos31Bytes": TETO_MEMORIA_DOS_31,
		},
	}
	# Só a cerca por peças (10.12): sem "pecas" no config, a chave não existe e o resto sai igual.
	if cfg.has("pecas"):
		var pe: Dictionary = cfg["pecas"].duplicate()
		pe["conta"] = "a cerca por peças, reta ou curva, na geometria do app (geometriaDaCerca de lib/mobilia.ts, girada pelo giro do objeto): a ligação = a coluna colunaCasas da forma frente-<variante>-0 tingida, deitada ao longo do eixo (o segmento do primeiro ao último mourão, ou o arco), na altura c (atravessando, + do lado n = (-t.y, t.x)), misturada com a mesma coluna na altura -c por w = smoothstep(-viradaDaLuz, viradaDaLuz, -dot(n, LUZ) / 0,7071); por cima, em pé (sem girar), o recorte de raio raioCasas em volta de mouraoCasas no meio de cada mourão; a sombra pela silhueta, como as outras; a tela não gira mais nada"
		json["pecas"] = pe
	return json

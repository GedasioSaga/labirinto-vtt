extends RefCounted
## CONGELADO. O contrato do pacote Desenhado em números (CONTRATO.md explica o porquê).
## Lê e confere o config.json de uma textura e calcula a memória do que foi exportado.

const VERSAO := 1
const CASA_PX := 64 ## px de imagem por casa nos ladrilhos de base (o grid padrão do app)
const PERIODOS_CASAS := [8, 16] ## 8 casas = 512 px (padrão); 16 só com 1 variante
const ATLAS_PX_POR_CASA := 128 ## o atlas tem o dobro da resolução: os detalhes levam o contorno
const ATLAS_COLUNAS := 4
const ATLAS_LINHAS := 4
const ATLAS_LADO := 512
const DETALHES_MAX := 16
const TETO_GPU_POR_TEXTURA := 6 * 1024 * 1024 ## RGBA8 + mipmaps, somando base e atlas
const TETO_DISCO_POR_TEXTURA := 1536 * 1024 ## PNGs da pasta exportado/<id>/
const TETO_GPU_POR_MAPA := 48 * 1024 * 1024 ## soma das texturas Desenhado de um mapa
const ARQUIVOS_DE_BASE := ["base-1.png", "base-2.png", "base-3.png"]
const ARQUIVO_DO_ATLAS := "detalhes.png"
const ARQUIVO_DE_PARAMETROS := "textura.json"


static func ler_args() -> Dictionary:
	var args := {}
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--") and a.contains("="):
			var i := a.find("=")
			args[a.substr(2, i - 2)] = a.substr(i + 1)
		elif a.begins_with("--"):
			args[a.substr(2)] = "1"
	return args


static func raiz_do_repo() -> String:
	return ProjectSettings.globalize_path("res://").path_join("../..").simplify_path()


## Lê texturas/<id>/config.json, completa com os padrões e confere tudo.
## Devolve {"ok": bool, "erros": Array[String], "config": Dictionary}.
static func ler_config(id: String) -> Dictionary:
	var erros: Array[String] = []
	var re := RegEx.create_from_string("^[a-z0-9-]{1,40}$")
	if re.search(id) == null:
		erros.append("id inválido '%s' (use a-z, 0-9 e hífen, até 40)" % id)
		return {"ok": false, "erros": erros, "config": {}}
	var caminho := "res://texturas/%s/config.json" % id
	if not FileAccess.file_exists(caminho):
		erros.append("não achei %s" % caminho)
		return {"ok": false, "erros": erros, "config": {}}
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho))
	if typeof(bruto) != TYPE_DICTIONARY:
		erros.append("%s não é um objeto JSON válido" % caminho)
		return {"ok": false, "erros": erros, "config": {}}
	var c: Dictionary = bruto
	var mistura: Dictionary = c.get("mistura", {})
	var tom: Dictionary = c.get("tom", {})
	var det: Dictionary = c.get("detalhes", {})
	var semente := int(c.get("semente", 7))
	var quantos := int(det.get("quantos", 0))
	var pesos: Array = det.get("pesos", [])
	if pesos.is_empty():
		for k in quantos:
			pesos.append(1.0)
	var cfg := {
		"id": id,
		"nome": str(c.get("nome", "")),
		"idDoApp": c.get("idDoApp", null),
		"onda": int(c.get("onda", 0)),
		"lote": int(c.get("lote", 0)),
		"semente": semente,
		"variantes": int(c.get("variantes", 3)),
		"periodoCasas": int(c.get("periodoCasas", 8)),
		"mistura": {
			"semente": semente * 101 + 11,
			"escala": float(mistura.get("escala", 3.0)),
			"faixa": float(mistura.get("faixa", 0.12)),
			"corte": float(mistura.get("corte", 0.18)),
		},
		"tom": {
			"semente": semente * 101 + 37,
			"escala": float(tom.get("escala", 6.0)),
			"amplitude": float(tom.get("amplitude", 0.05)),
		},
		"detalhes": {
			"semente": semente * 101 + 73,
			"celulaCasas": int(det.get("celulaCasas", 1)),
			"quantos": quantos,
			"pesos": pesos,
			"densidade": float(det.get("densidade", 1.0)),
			"agrupamento": float(det.get("agrupamento", 0.6)),
			"escalaMin": float(det.get("escalaMin", 0.85)),
			"escalaMax": float(det.get("escalaMax", 1.1)),
			"variacaoDeTom": float(det.get("variacaoDeTom", 0.05)),
		},
	}
	# Opcional: sem ele o espalhamento é o de sempre e o textura.json não muda.
	if det.has("afastarCasas"):
		cfg["detalhes"]["afastarCasas"] = float(det["afastarCasas"])
	# Opcionais da peça grande e solta (CONTRATO.md seção 4), nos mesmos termos.
	if det.has("passoCasas"):
		cfg["detalhes"]["passoCasas"] = float(det["passoCasas"])
	if det.has("grupos"):
		var gr: Dictionary = det["grupos"] if typeof(det["grupos"]) == TYPE_DICTIONARY else {}
		cfg["detalhes"]["grupos"] = {
			"gradeCasas": float(gr.get("gradeCasas", 0.0)),
			"chance": float(gr.get("chance", -1.0)),
			"raioMin": float(gr.get("raioMin", 0.0)),
			"raioMax": float(gr.get("raioMax", 0.0)),
		}
	if det.has("espelhar"):
		cfg["detalhes"]["espelhar"] = bool(det["espelhar"])
	# Opcional: a textura que pega a cor da sala (PROPOSTA-TINGIR.md). Sem ele, nada muda.
	if c.has("tingir"):
		var tg = c["tingir"]
		var janela = tg.get("janela", null) if typeof(tg) == TYPE_DICTIONARY else null
		if typeof(janela) != TYPE_DICTIONARY:
			erros.append("tingir precisa de conta, neutro, ganhoL e janela { escuroAte, claroDesde }")
		else:
			cfg["tingir"] = {
				"conta": str(tg.get("conta", "luz-oklab")),
				"neutro": float(tg.get("neutro", 0.5)),
				"ganhoL": float(tg.get("ganhoL", 0.48)),
				"janela": {"escuroAte": float(janela.get("escuroAte", 0.10)), "claroDesde": float(janela.get("claroDesde", 0.94))},
			}
	if c.get("id", id) != id:
		erros.append("config.json diz id '%s', mas a pasta é '%s'" % [c.get("id"), id])
	if cfg["nome"].strip_edges() == "":
		erros.append("falta 'nome' (o nome que o mestre vê)")
	if cfg["idDoApp"] != null and typeof(cfg["idDoApp"]) != TYPE_STRING:
		erros.append("'idDoApp' tem de ser texto ou null")
	if semente < 0 or semente > 100000:
		erros.append("'semente' de 0 a 100000")
	if cfg["variantes"] < 1 or cfg["variantes"] > 3:
		erros.append("'variantes' de 1 a 3 (o padrão é 3; 2 em material com estrutura)")
	if not PERIODOS_CASAS.has(cfg["periodoCasas"]):
		erros.append("'periodoCasas' é 8 ou 16")
	if cfg["periodoCasas"] == 16 and cfg["variantes"] > 1:
		erros.append("período de 16 casas só com 1 variante (teto de memória)")
	var m: Dictionary = cfg["mistura"]
	if m["escala"] < 1.0 or m["escala"] > 12.0:
		erros.append("'mistura.escala' de 1 a 12")
	if m["faixa"] <= 0.0 or m["faixa"] > 0.5:
		erros.append("'mistura.faixa' entre 0 e 0,5")
	if cfg["variantes"] == 3 and m["corte"] < m["faixa"]:
		erros.append("com 3 variantes, 'mistura.corte' tem de ser >= 'mistura.faixa'")
	var t: Dictionary = cfg["tom"]
	if t["amplitude"] < 0.0 or t["amplitude"] > 0.12:
		erros.append("'tom.amplitude' de 0 a 0,12 (cor contida)")
	if t["escala"] < 1.0 or t["escala"] > 20.0:
		erros.append("'tom.escala' de 1 a 20")
	var d: Dictionary = cfg["detalhes"]
	var celula: int = d["celulaCasas"]
	if celula != 1 and celula != 2:
		erros.append("'detalhes.celulaCasas' é 1 (atlas 4 x 4, detalhe até 1 casa) ou 2 (atlas 2 x 2, até 2 casas)")
		celula = 1
	var cabem: int = (ATLAS_COLUNAS / celula) * (ATLAS_LINHAS / celula)
	if quantos < 0 or quantos > cabem:
		erros.append("'detalhes.quantos' de 0 a %d" % cabem)
	if pesos.size() != quantos:
		erros.append("'detalhes.pesos' precisa de %d números" % quantos)
	if d["densidade"] < 0.0 or d["densidade"] * celula * celula > 3.4:
		erros.append("'detalhes.densidade' (detalhes por casa) de 0 a %.2f" % (3.4 / float(celula * celula)))
	if d["agrupamento"] < 0.0 or d["agrupamento"] > 1.0:
		erros.append("'detalhes.agrupamento' de 0 a 1")
	# O passo da grade (em casas): meia célula, ou detalhes.passoCasas.
	var passo: float = celula * 0.5
	var escala_teto := 1.5
	if d.has("passoCasas"):
		var pedido: float = d["passoCasas"]
		if pedido <= celula * 0.5 or pedido > 4.0:
			erros.append("'detalhes.passoCasas' maior que %.1f (meia célula) e até 4" % (celula * 0.5))
		else:
			passo = pedido
			# O laço de 5 x 5 células cobre uma peça de meio lado até 1,5 passo; o teto de 2
			# é o da nitidez do atlas (a 2, uma casa do mundo tem 64 px do atlas).
			escala_teto = minf(2.0, 3.0 * passo / float(celula))
			if d["densidade"] * passo * passo > 0.85:
				erros.append("'detalhes.densidade' com passoCasas %.2f: de 0 a %.3f (0,85 por célula)" % [passo, 0.85 / (passo * passo)])
	if d["escalaMin"] < 0.5 or d["escalaMax"] > escala_teto or d["escalaMin"] > d["escalaMax"]:
		erros.append("'detalhes.escalaMin/escalaMax' entre 0,5 e %.2f, mínimo <= máximo" % escala_teto)
	if d["variacaoDeTom"] < 0.0 or d["variacaoDeTom"] > 0.12:
		erros.append("'detalhes.variacaoDeTom' de 0 a 0,12")
	if d.has("afastarCasas"):
		# Até um passo da grade: as vizinhas são só as 8 em volta, e o detalhe deslocado
		# (no máximo afastar / 2) ainda cabe no laço de 5 x 5 células.
		var afastar: float = d["afastarCasas"]
		if afastar <= 0.0 or afastar > passo:
			erros.append("'detalhes.afastarCasas' maior que 0 e até %.2f (um passo da grade)" % passo)
	if d.has("grupos"):
		var gr: Dictionary = d["grupos"]
		if gr["gradeCasas"] < 4.0 or gr["gradeCasas"] > 32.0:
			erros.append("'detalhes.grupos.gradeCasas' de 4 a 32")
		if gr["chance"] < 0.0 or gr["chance"] > 1.0:
			erros.append("'detalhes.grupos.chance' de 0 a 1")
		if gr["raioMin"] < 0.1 or gr["raioMax"] > 0.5 or gr["raioMin"] > gr["raioMax"]:
			erros.append("'detalhes.grupos.raioMin/raioMax' entre 0,1 e 0,5 do lado da grade, mínimo <= máximo")
	return {"ok": erros.is_empty(), "erros": erros, "config": cfg}


## Bytes na placa de vídeo de uma imagem RGBA8 com a cadeia de mipmaps (+1/3).
static func bytes_gpu(largura: int, altura: int) -> int:
	return int(round(largura * altura * 4 * 4.0 / 3.0))


static func cor_media(img: Image) -> Color:
	var direto := img.duplicate() as Image
	direto.resize(16, 16, Image.INTERPOLATE_BILINEAR)
	var soma := Color(0, 0, 0)
	for y in 16:
		for x in 16:
			soma += direto.get_pixel(x, y)
	return Color(soma.r / 256.0, soma.g / 256.0, soma.b / 256.0)


## O textura.json que o app vai ler: tudo explícito, nenhum padrão escondido.
static func parametros(cfg: Dictionary, base_lado: int, tem_atlas: bool, media: Color, gpu: int, disco: int, emendas: Dictionary) -> Dictionary:
	var det: Dictionary = cfg["detalhes"]
	var arquivos: Array = []
	for v in cfg["variantes"]:
		arquivos.append(ARQUIVOS_DE_BASE[v])
	var detalhes := {
		"arquivo": ARQUIVO_DO_ATLAS if tem_atlas else null,
		"ladoPx": ATLAS_LADO,
		"colunas": ATLAS_COLUNAS / int(det["celulaCasas"]),
		"linhas": ATLAS_LINHAS / int(det["celulaCasas"]),
		"pxPorCasa": ATLAS_PX_POR_CASA,
		"celulaCasas": det["celulaCasas"],
		"gradeDoMundoPx": CASA_PX / 2 * int(det["celulaCasas"]),
		"semente": det["semente"],
		"quantos": det["quantos"],
		"pesos": det["pesos"],
		"densidade": det["densidade"],
		"agrupamento": det["agrupamento"],
		"escalaMin": det["escalaMin"],
		"escalaMax": det["escalaMax"],
		"variacaoDeTom": det["variacaoDeTom"],
	}
	if det.has("afastarCasas"):
		detalhes["afastarCasas"] = det["afastarCasas"]
	if det.has("passoCasas"):
		detalhes["passoCasas"] = det["passoCasas"]
		detalhes["gradeDoMundoPx"] = det["passoCasas"] * CASA_PX
	if det.has("grupos"):
		detalhes["grupos"] = det["grupos"]
	if det.has("espelhar"):
		detalhes["espelhar"] = det["espelhar"]
	var saida := {
		"contrato": VERSAO,
		"id": cfg["id"],
		"nome": cfg["nome"],
		"idDoApp": cfg["idDoApp"],
		"onda": cfg["onda"],
		"lote": cfg["lote"],
		"casaPx": CASA_PX,
		"base": {
			"arquivos": arquivos,
			"ladoPx": base_lado,
			"periodoCasas": cfg["periodoCasas"],
		},
		"mistura": cfg["mistura"],
		"tom": cfg["tom"],
		"detalhes": detalhes,
		"corMedia": "#" + media.to_html(false),
		"memoria": {
			"gpuBytes": gpu,
			"discoBytes": disco,
			"tetoGpuBytes": TETO_GPU_POR_TEXTURA,
			"tetoDiscoBytes": TETO_DISCO_POR_TEXTURA,
		},
		"emendas": emendas,
	}
	# A textura que pega a cor da sala (PROPOSTA-TINGIR.md, o piso): o app lê a conta
	# daqui, no mesmo formato do telhado (contrato_telhado.gd, TINGIR). Sem o bloco no
	# config.json, o textura.json sai byte a byte como antes.
	if cfg.has("tingir"):
		saida["tingir"] = _tingir_do_config(cfg["tingir"])
	return saida


## Só os números da conta de tingir (o config.json do designer traz também o texto da proposta).
static func _tingir_do_config(t: Dictionary) -> Dictionary:
	var janela: Dictionary = t["janela"]
	return {
		"conta": t["conta"],
		"neutro": t["neutro"],
		"ganhoL": t["ganhoL"],
		"escuroAte": janela["escuroAte"],
		"claroDesde": janela["claroDesde"],
	}

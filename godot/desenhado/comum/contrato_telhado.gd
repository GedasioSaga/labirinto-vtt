extends RefCounted
## CONGELADO. O contrato da onda 2 em números (CONTRATO.md, seção 8): telhado, faixa e
## objeto. Lê e confere o config.json desses tipos e monta o textura.json que o app lê.
## O chão (sem "tipo", ou "tipo": "chao") continua em comum/contrato.gd, sem mudança.

const Contrato := preload("res://comum/contrato.gd")

const TIPOS := ["telhado", "faixa", "objeto"]
const MODELOS := ["telhas", "madeira", "palha"] ## client/src/lib/telhado/paletas.ts
const ONDES := ["cumeeira", "espigao"]
const PERIODOS_CASAS := [4, 8] ## a base do telhado: 256 ou 512 px de lado
const PX_POR_CASA_FINO := 128 ## faixa e objeto: 2 px da imagem por px do mapa
const ARQUIVO_DA_FAIXA := "faixa.png"
const ARQUIVO_DO_OBJETO := "objeto.png"
## A conta de tingir da PROPOSTA-TINGIR.md (aprovada para o chão de sala), igual aqui.
const TINGIR := {"conta": "luz-oklab", "neutro": 0.5, "ganhoL": 0.48, "escuroAte": 0.10, "claroDesde": 0.94}


## "chao", "telhado", "faixa" ou "objeto", lido do config.json (sem o campo: "chao").
static func tipo_de(id: String) -> String:
	var caminho := "res://texturas/%s/config.json" % id
	if not FileAccess.file_exists(caminho):
		return "chao"
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho))
	if typeof(bruto) != TYPE_DICTIONARY:
		return "chao"
	return str(bruto.get("tipo", "chao"))


static func _f(d: Dictionary, k: String, padrao: float) -> float:
	return float(d.get(k, padrao))


static func _faixa(f: Dictionary, erros: Array[String], onde_padrao: Array) -> Dictionary:
	if f.has("de"):
		return {"de": str(f["de"])}
	var r := {
		"comprimentoPx": int(f.get("comprimentoPx", 160)),
		"meiaLarguraPx": _f(f, "meiaLarguraPx", 6.0),
		"onde": f.get("onde", onde_padrao),
	}
	if r["comprimentoPx"] < 16 or r["comprimentoPx"] > 512:
		erros.append("'faixa.comprimentoPx' (o período ao longo da emenda, px do mapa) de 16 a 512")
	if r["meiaLarguraPx"] < 2.0 or r["meiaLarguraPx"] > 12.0:
		erros.append("'faixa.meiaLarguraPx' de 2 a 12 (px do mapa de cada lado da emenda)")
	if typeof(r["onde"]) != TYPE_ARRAY or r["onde"].is_empty():
		erros.append("'faixa.onde' é uma lista com 'cumeeira' e/ou 'espigao'")
	else:
		for o in r["onde"]:
			if not ONDES.has(o):
				erros.append("'faixa.onde': '%s' não existe (use 'cumeeira' e 'espigao'; o rincão é do app)" % o)
	return r


## Lê texturas/<id>/config.json de um telhado, faixa ou objeto, completa e confere.
## Devolve {"ok", "erros", "config"}.
static func ler_config(id: String) -> Dictionary:
	var erros: Array[String] = []
	var caminho := "res://texturas/%s/config.json" % id
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho)) if FileAccess.file_exists(caminho) else null
	if typeof(bruto) != TYPE_DICTIONARY:
		erros.append("%s não existe ou não é um objeto JSON" % caminho)
		return {"ok": false, "erros": erros, "config": {}}
	var c: Dictionary = bruto
	var tipo := str(c.get("tipo", ""))
	var semente := int(c.get("semente", 7))
	var cfg := {
		"id": id,
		"tipo": tipo,
		"nome": str(c.get("nome", "")),
		"idDoApp": c.get("idDoApp", null),
		"onda": int(c.get("onda", 2)),
		"lote": int(c.get("lote", 5)),
		"semente": semente,
	}
	if not TIPOS.has(tipo):
		erros.append("'tipo' é 'telhado', 'faixa' ou 'objeto' (o chão não leva o campo)")
	if c.get("id", id) != id:
		erros.append("config.json diz id '%s', mas a pasta é '%s'" % [c.get("id"), id])
	if cfg["nome"].strip_edges() == "":
		erros.append("falta 'nome' (o nome que o mestre vê)")
	if semente < 0 or semente > 100000:
		erros.append("'semente' de 0 a 100000")
	if c.has("cores"):
		cfg["cores"] = c["cores"]
		var re := RegEx.create_from_string("^#[0-9a-f]{6}$")
		if typeof(c["cores"]) != TYPE_ARRAY or c["cores"].size() != 3:
			erros.append("'cores' (opcional) são 3 cores da paleta do app, '#rrggbb' minúsculo")
		else:
			for h in c["cores"]:
				if re.search(str(h)) == null:
					erros.append("'cores': '%s' não é '#rrggbb' minúsculo" % h)
	if c.has("sob"):
		cfg["sob"] = str(c["sob"])
	if tipo == "telhado":
		var mistura: Dictionary = c.get("mistura", {})
		var tom: Dictionary = c.get("tom", {})
		var luz: Dictionary = c.get("luz", {})
		var beiral: Dictionary = c.get("beiral", {})
		var rincao: Dictionary = c.get("rincao", {})
		cfg["variantes"] = int(c.get("variantes", 2))
		cfg["periodoCasas"] = int(c.get("periodoCasas", 8))
		cfg["mistura"] = {"semente": semente * 101 + 11, "escala": _f(mistura, "escala", 3.0), "faixa": _f(mistura, "faixa", 0.12), "corte": _f(mistura, "corte", 0.18)}
		cfg["tom"] = {"semente": semente * 101 + 37, "escala": _f(tom, "escala", 6.0), "amplitude": _f(tom, "amplitude", 0.03)}
		cfg["luz"] = {"agua": _f(luz, "agua", 0.18), "lado": _f(luz, "lado", 0.12)}
		cfg["beiral"] = {"escuro": _f(beiral, "escuro", 0.22), "alturaPx": _f(beiral, "alturaPx", 2.2), "franjaPx": _f(beiral, "franjaPx", 0.0), "franjaPassoPx": _f(beiral, "franjaPassoPx", 4.6)}
		cfg["rincao"] = {"escuro": _f(rincao, "escuro", 0.10), "larguraPx": _f(rincao, "larguraPx", 1.7)}
		cfg["faixa"] = _faixa(c["faixa"], erros, ["cumeeira", "espigao"]) if typeof(c.get("faixa")) == TYPE_DICTIONARY else null
		if not MODELOS.has(cfg["idDoApp"]):
			erros.append("'idDoApp' de um telhado é o modelo do app: 'telhas', 'madeira' ou 'palha'")
		if cfg["variantes"] < 1 or cfg["variantes"] > 3:
			erros.append("'variantes' de 1 a 3 (a mesma geometria, outra superfície)")
		if not PERIODOS_CASAS.has(cfg["periodoCasas"]):
			erros.append("'periodoCasas' é 4 ou 8")
		var m: Dictionary = cfg["mistura"]
		if m["escala"] < 1.0 or m["escala"] > 12.0 or m["faixa"] <= 0.0 or m["faixa"] > 0.5:
			erros.append("'mistura.escala' de 1 a 12 e 'mistura.faixa' entre 0 e 0,5")
		if cfg["variantes"] == 3 and m["corte"] < m["faixa"]:
			erros.append("com 3 variantes, 'mistura.corte' tem de ser >= 'mistura.faixa'")
		if cfg["tom"]["amplitude"] < 0.0 or cfg["tom"]["amplitude"] > 0.06 or cfg["tom"]["escala"] < 1.0 or cfg["tom"]["escala"] > 20.0:
			erros.append("'tom.amplitude' de 0 a 0,06 e 'tom.escala' de 1 a 20")
		if cfg["luz"]["agua"] < 0.0 or cfg["luz"]["agua"] > 0.3 or cfg["luz"]["lado"] < 0.0 or cfg["luz"]["lado"] > 0.3:
			erros.append("'luz.agua' de 0 a 0,3 e 'luz.lado' de 0 a 0,3 (em valor: 0,1 de valor = 0,048 de luz OKLab)")
		var b: Dictionary = cfg["beiral"]
		if b["escuro"] < 0.0 or b["escuro"] > 0.4 or b["alturaPx"] < 0.0 or b["alturaPx"] > 6.0 or b["franjaPx"] < 0.0 or b["franjaPx"] > 4.0 or b["franjaPassoPx"] < 2.0 or b["franjaPassoPx"] > 20.0:
			erros.append("'beiral': escuro 0..0,4, alturaPx 0..6, franjaPx 0..4, franjaPassoPx 2..20")
		if cfg["rincao"]["escuro"] < 0.0 or cfg["rincao"]["escuro"] > 0.3 or cfg["rincao"]["larguraPx"] < 0.5 or cfg["rincao"]["larguraPx"] > 4.0:
			erros.append("'rincao': escuro 0..0,3, larguraPx 0,5..4")
	elif tipo == "faixa":
		cfg["modelo"] = str(c.get("modelo", "palha"))
		cfg["luz"] = {"lado": _f(c.get("luz", {}), "lado", 0.12)}
		cfg["faixa"] = _faixa(c.get("faixa", {}), erros, ["cumeeira"])
		if cfg["faixa"].has("de"):
			erros.append("uma textura do tipo faixa pinta a própria faixa (sem 'de')")
		if not MODELOS.has(cfg["modelo"]):
			erros.append("'modelo' (o telhado em que a faixa vai) é 'telhas', 'madeira' ou 'palha'")
	elif tipo == "objeto":
		var o: Dictionary = c.get("objeto", {})
		var lado := int(o.get("ladoPx", 64))
		var anc = o.get("ancoraPx", [lado / 2.0, lado / 2.0])
		cfg["objeto"] = {"ladoPx": lado, "corpoPx": _f(o, "corpoPx", 40.0), "ancoraPx": [float(anc[0]), float(anc[1])] if typeof(anc) == TYPE_ARRAY and anc.size() == 2 else [lado / 2.0, lado / 2.0]}
		if lado < 16 or lado > 256:
			erros.append("'objeto.ladoPx' (lado da imagem, px a 128 por casa) de 16 a 256")
		if cfg["objeto"]["corpoPx"] < 8.0 or cfg["objeto"]["corpoPx"] > lado:
			erros.append("'objeto.corpoPx' (lado do corpo na imagem) de 8 a objeto.ladoPx")
	return {"ok": erros.is_empty(), "erros": erros, "config": cfg}


static func _faixa_json(f, arquivo_existe: bool, w: int, h: int) -> Variant:
	if f == null:
		return null
	if f.has("de"):
		return {"de": f["de"]}
	return {
		"arquivo": ARQUIVO_DA_FAIXA if arquivo_existe else null,
		"pxPorCasa": PX_POR_CASA_FINO,
		"larguraImagemPx": w,
		"alturaImagemPx": h,
		"comprimentoPx": f["comprimentoPx"],
		"meiaLarguraPx": f["meiaLarguraPx"],
		"onde": f["onde"],
		"canais": {"r": "valor (0,5 = a cor do mestre)", "g": "lado atravessando: 0,5 + 0,5 * lado", "a": "alfa reto"},
		"orientacao": "x = ao longo da emenda (repete a cada comprimentoPx); y = atravessando, de -meia (linha 0) a +meia; +y = o lado da água de índice menor",
	}


## O textura.json que o app lê (CONTRATO.md, seção 8): tudo explícito.
static func parametros(cfg: Dictionary, r: Dictionary, gpu: int, disco: int) -> Dictionary:
	var p := {
		"contrato": Contrato.VERSAO,
		"tipo": cfg["tipo"],
		"id": cfg["id"],
		"nome": cfg["nome"],
		"idDoApp": cfg["idDoApp"],
		"onda": cfg["onda"],
		"lote": cfg["lote"],
		"casaPx": Contrato.CASA_PX,
	}
	var tam: Vector2i = r.get("faixaTamanho", Vector2i.ZERO)
	if cfg["tipo"] == "telhado":
		var arquivos: Array = []
		for v in cfg["variantes"]:
			arquivos.append(Contrato.ARQUIVOS_DE_BASE[v])
		p["base"] = {
			"arquivos": arquivos,
			"ladoPx": cfg["periodoCasas"] * Contrato.CASA_PX,
			"periodoCasas": cfg["periodoCasas"],
			"canais": {"r": "valor (0,5 = a cor do mestre)", "g": "lado ao longo do beiral: 0,5 + 0,5 * lado", "b": "0"},
			"orientacao": "x = u, ao longo do beiral; a linha de baixo da imagem encosta na ponta do beiral (v = 0) e y sobe para a cumeeira",
		}
		p["mistura"] = cfg["mistura"]
		p["tom"] = cfg["tom"]
		p["tingir"] = TINGIR
		p["luz"] = cfg["luz"]
		p["beiral"] = cfg["beiral"]
		p["rincao"] = cfg["rincao"]
		p["faixa"] = _faixa_json(cfg["faixa"], r.get("temFaixa", false), tam.x, tam.y)
		p["valorMedio"] = r.get("valorMedio", 0.5)
	elif cfg["tipo"] == "faixa":
		p["modelo"] = cfg["modelo"]
		p["faixa"] = _faixa_json(cfg["faixa"], true, tam.x, tam.y)
		p["tingir"] = TINGIR
		p["luz"] = cfg["luz"]
	else:
		var o: Dictionary = cfg["objeto"]
		p["objeto"] = {
			"arquivo": ARQUIVO_DO_OBJETO,
			"pxPorCasa": PX_POR_CASA_FINO,
			"ladoPx": o["ladoPx"],
			"corpoPx": o["corpoPx"],
			"ancoraPx": o["ancoraPx"],
			"onde": "o centro do corpo vai no ponto de posicaoDaChamine(geo) (client/src/texturas/meioTermo/chamine.ts), escalado para o corpo ter o lado que ela dá",
		}
		p["tingir"] = null
	p["memoria"] = {"gpuBytes": gpu, "discoBytes": disco, "tetoGpuBytes": Contrato.TETO_GPU_POR_TEXTURA, "tetoDiscoBytes": Contrato.TETO_DISCO_POR_TEXTURA}
	if r.has("emendas") and not r["emendas"].is_empty():
		p["emendas"] = r["emendas"]
	return p

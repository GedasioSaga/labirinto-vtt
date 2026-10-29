extends RefCounted
## CONGELADO. O contrato da onda 3 em números (CONTRATO.md, seção 9): carimbo e trecho.
## Lê e confere o config.json desses tipos e monta o textura.json que o app lê.
## O chão segue em comum/contrato.gd e o telhado em comum/contrato_telhado.gd, sem mudança.

const Contrato := preload("res://comum/contrato.gd")

const TIPOS := ["carimbo", "trecho"]
const DESTINOS := ["carimbo", "movel"]
const JEITOS_DA_SOMBRA := ["deslocada", "nenhuma"]
## O carimbo também pode ter a sombra "em-pe" (28/10, a árvore): a silhueta deitada no chão a
## partir do pé, como a sombra "em-pe" de hoje (client/src/carimbos/arte.ts, matrizDaSombra),
## para um desenho que fica de pé na tela (o tronco embaixo). O trecho continua com as duas.
const JEITOS_DA_SOMBRA_DO_CARIMBO := ["deslocada", "nenhuma", "em-pe"]
const COMPRIMENTO_EM_PE := 0.78 ## o de hoje (arte.ts, COMPRIMENTO["em-pe"])
## O espelho das formas: "diagonal" (o padrão; a peça vista de cima) ou "nenhum" (um desenho
## com um "em pé", que deitaria de lado se fosse transposto: cada arquivo é uma forma).
const ESPELHOS := ["diagonal", "nenhum"]
const VARIACOES_MAX := 4
const ARQUIVOS_DO_CARIMBO := ["carimbo-1.png", "carimbo-2.png", "carimbo-3.png", "carimbo-4.png"]
const ARQUIVO_DO_TRECHO := "trecho.png"
const ARQUIVO_DO_RELEVO := "trecho-relevo.png"
const PX_POR_MUNDO_TRECHO := 2 ## o trecho tem 128 px por casa: 2 px da imagem por px do mundo

## O mapa de referência: o mapa real do usuário, 200 x 200 casas de 64 px. O tamanho de um
## carimbo no app depende do mapa (client/src/lib/carimbos.ts, tamanhoNatural, e
## lib/relevo.ts, unidadeDoRelevo = max(largura, altura) x grid / 1242).
const MAPA_REF_CASAS := 200
const LADO_DO_PROTOTIPO_DO_RELEVO := 1242.0
const TAMANHO_MINIMO_EM_CASAS := 0.8

## Na placa, cada carimbo Desenhado pesa no máximo o que o Atual pesa hoje: 8 variantes de
## 256 x 256 texels RGBA com mipmaps (client/src/pixi/drawCarimbos.ts, LADO_DA_ARTE).
const TETO_GPU_POR_CARIMBO := 8 * 256 * 256 * 4 * 4 / 3
const TETO_DISCO_POR_CARIMBO := 1536 * 1024

## A sombra dos carimbos (client/src/carimbos/arte.ts e lib/relevo.ts): a direção do relevo,
## a cor de hoje e uma camada só para todos os objetos (duas sombras que se cruzam não
## escurecem duas vezes). O alfa é o do ESTILO.md (até 0,25), um pouco abaixo do de hoje (0,28).
const SOMBRA_DIRECAO := [7, 11]
const SOMBRA_COR := "#0a1c28"
const SOMBRA_ALFA := 0.25

## A luz do trecho, aplicada pelo app depois de deitar o trecho na curva (seção 9.5).
const LUZ := [-0.7071, -0.7071]


static func _f(d: Dictionary, k: String, padrao: float) -> float:
	return float(d.get(k, padrao))


## A unidade de um carimbo do app no mapa de referência, em px do mundo.
static func unidade_no_mapa_ref(tamanho_no_prototipo: float) -> float:
	var unidade := MAPA_REF_CASAS * Contrato.CASA_PX / LADO_DO_PROTOTIPO_DO_RELEVO
	return maxf(tamanho_no_prototipo * unidade, TAMANHO_MINIMO_EM_CASAS * Contrato.CASA_PX)


static func _sombra(s: Dictionary, erros: Array[String], carimbo := false) -> Dictionary:
	var r := {"jeito": str(s.get("jeito", "deslocada")), "deslocamento": _f(s, "deslocamento", 0.12), "borrao": _f(s, "borrao", 0.04)}
	var jeitos: Array = JEITOS_DA_SOMBRA_DO_CARIMBO if carimbo else JEITOS_DA_SOMBRA
	if not jeitos.has(r["jeito"]):
		erros.append("'sombra.jeito' é 'deslocada', 'em-pe' ou 'nenhuma'" if carimbo else "'sombra.jeito' é 'deslocada' ou 'nenhuma'")
	if r["jeito"] == "em-pe":
		r["comprimento"] = _f(s, "comprimento", COMPRIMENTO_EM_PE)
		if r["comprimento"] < 0.2 or r["comprimento"] > 1.2:
			erros.append("'sombra.comprimento' (a sombra em pé: quanto ela anda por unidade de altura acima do pé) de 0,2 a 1,2")
	if r["deslocamento"] < 0.0 or r["deslocamento"] > 0.5:
		erros.append("'sombra.deslocamento' de 0 a 0,5 (em unidades do tamanho)")
	if r["borrao"] < 0.0 or r["borrao"] > 0.2:
		erros.append("'sombra.borrao' de 0 a 0,2 (em unidades do tamanho)")
	return r


## Lê texturas/<id>/config.json de um carimbo ou trecho, completa e confere.
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
		"onda": int(c.get("onda", 3)),
		"lote": int(c.get("lote", 6)),
		"semente": semente,
	}
	if not TIPOS.has(tipo):
		erros.append("'tipo' é 'carimbo' ou 'trecho'")
	if c.get("id", id) != id:
		erros.append("config.json diz id '%s', mas a pasta é '%s'" % [c.get("id"), id])
	if cfg["nome"].strip_edges() == "":
		erros.append("falta 'nome' (o nome que o mestre vê)")
	if cfg["idDoApp"] == null or str(cfg["idDoApp"]).strip_edges() == "":
		erros.append("falta 'idDoApp' (o tipo do carimbo ou do móvel no app)")
	if semente < 0 or semente > 100000:
		erros.append("'semente' de 0 a 100000")
	if tipo == "carimbo":
		var sp: Dictionary = c.get("sprite", {})
		var lado := int(sp.get("ladoPx", 256))
		var anc = sp.get("ancoraPx", [lado / 2.0, lado / 2.0])
		cfg["destino"] = str(c.get("destino", "carimbo"))
		cfg["variacoes"] = int(c.get("variacoes", 4))
		cfg["sprite"] = {
			"ladoPx": lado,
			"unidadePx": _f(sp, "unidadePx", 160.0),
			"ancoraPx": [float(anc[0]), float(anc[1])] if typeof(anc) == TYPE_ARRAY and anc.size() == 2 else [lado / 2.0, lado / 2.0],
		}
		cfg["sombra"] = _sombra(c.get("sombra", {}), erros, true)
		cfg["espelho"] = str(c.get("espelho", "diagonal"))
		if not ESPELHOS.has(cfg["espelho"]):
			erros.append("'espelho' é 'diagonal' (o padrão: a peça vista de cima) ou 'nenhum' (um desenho em pé, com o tronco embaixo)")
		# O tamanho do app no protótipo do relevo (embutidos.ts ou o .json do pacote); o
		# móvel usa 1 casa por unidade. Só a mesa usa: o app sabe o tamanho de cada objeto.
		cfg["tamanhoDoApp"] = _f(c, "tamanhoDoApp", 0.0)
		if not DESTINOS.has(cfg["destino"]):
			erros.append("'destino' é 'carimbo' (ferramenta Carimbos) ou 'movel' (ferramenta Objetos)")
		if cfg["variacoes"] < 1 or cfg["variacoes"] > VARIACOES_MAX:
			erros.append("'variacoes' de 1 a %d (com o espelho, até 8 formas)" % VARIACOES_MAX)
		if lado < 32 or lado > 512:
			erros.append("'sprite.ladoPx' de 32 a 512")
		if cfg["sprite"]["unidadePx"] < 16.0 or cfg["sprite"]["unidadePx"] > 512.0:
			erros.append("'sprite.unidadePx' (px da imagem numa unidade do tamanho) de 16 a 512")
		if cfg["destino"] == "carimbo" and cfg["tamanhoDoApp"] <= 0.0:
			erros.append("'tamanhoDoApp' (o tamanho do carimbo no app: embutidos.ts ou o .json do pacote) é obrigatório no destino carimbo")
	elif tipo == "trecho":
		var t: Dictionary = c.get("trecho", {})
		cfg["curva"] = bool(c.get("curva", false))
		cfg["trecho"] = {
			"comprimentoPx": int(t.get("comprimentoPx", 64)),
			"meiaLarguraPx": _f(t, "meiaLarguraPx", 16.0),
			"pontaPx": int(t.get("pontaPx", 16)),
		}
		cfg["luz"] = {"forca": _f(c.get("luz", {}), "forca", 0.8)}
		cfg["sombra"] = _sombra(c.get("sombra", {}), erros)
		cfg["casas"] = c.get("casas", [2.0, 0.5])
		var tr: Dictionary = cfg["trecho"]
		if tr["comprimentoPx"] < 16 or tr["comprimentoPx"] > 256:
			erros.append("'trecho.comprimentoPx' (o período ao longo, px do mundo) de 16 a 256")
		if tr["meiaLarguraPx"] < 4.0 or tr["meiaLarguraPx"] > 48.0:
			erros.append("'trecho.meiaLarguraPx' de 4 a 48 (px do mundo de cada lado do eixo)")
		if tr["pontaPx"] < 0 or tr["pontaPx"] > 64:
			erros.append("'trecho.pontaPx' (quanto a ponta passa do fim, px do mundo) de 0 a 64")
		if cfg["luz"]["forca"] < 0.0 or cfg["luz"]["forca"] > 1.0:
			erros.append("'luz.forca' de 0 a 1")
	return {"ok": erros.is_empty(), "erros": erros, "config": cfg}


## O textura.json que o app lê (CONTRATO.md, seção 9): tudo explícito.
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
	var sombra: Dictionary = cfg["sombra"]
	p["sombra"] = {
		"jeito": sombra["jeito"],
		"direcao": SOMBRA_DIRECAO,
		"deslocamento": sombra["deslocamento"],
		"borrao": sombra["borrao"],
		"alfa": SOMBRA_ALFA,
		"cor": SOMBRA_COR,
		"conta": "a silhueta (o alfa do desenho, já no lugar) andada deslocamento x tamanho na direção, desfocada borrao x tamanho, numa camada só para todos os objetos, pintada com a cor e o alfa uma vez",
	}
	if sombra["jeito"] == "em-pe":
		p["sombra"].erase("deslocamento")
		p["sombra"]["comprimento"] = sombra["comprimento"]
		p["sombra"]["conta"] = "a silhueta (o alfa do desenho, já no lugar) deitada no chão a partir do pé, como a sombra 'em-pe' de hoje (client/src/carimbos/arte.ts, matrizDaSombra): com (dx, dy) a direção normalizada e (x, y) o ponto a partir do pé (a âncora), y = -h a altura h acima dele, o ponto cai em (x - comprimento x dx x y, -comprimento x dy x y), ou seja, h x comprimento na direção: o pé fica e o alto se deita para baixo e para a direita; desfocada borrao x tamanho, numa camada só para todos os objetos, pintada com a cor e o alfa uma vez (CONTRATO.md 9.4)"
	if cfg["tipo"] == "carimbo":
		var arquivos: Array = []
		for v in cfg["variacoes"]:
			arquivos.append(ARQUIVOS_DO_CARIMBO[v])
		var sp: Dictionary = cfg["sprite"]
		p["destino"] = cfg["destino"]
		p["sprite"] = {
			"arquivos": arquivos,
			"ladoPx": sp["ladoPx"],
			"unidadePx": sp["unidadePx"],
			"ancoraPx": sp["ancoraPx"],
			"unidade": "o tamanho do carimbo no mundo (Carimbo.tamanho, px)" if cfg["destino"] == "carimbo" else "1 casa (o lado do móvel)",
			"canais": "RGBA, cor reta, alfa reto, sem sombra",
		}
		p["formas"] = {
			"variacoes": cfg["variacoes"],
			"espelho": "diagonal",
			"conta": "k = varianteDoGiro(giro) (0..7); arquivo = k mod variacoes; espelho na diagonal quando floor(k / variacoes) é ímpar: a imagem transposta, (u, v) -> (v, u), com a mesma translação (o meio da imagem não anda; ver CONTRATO.md 9.4); a imagem nunca gira",
		}
		if cfg["espelho"] == "nenhum":
			p["formas"]["espelho"] = "nenhum"
			p["formas"]["conta"] = "k = varianteDoGiro(giro) (0..7); arquivo = k mod variacoes; nunca espelha (o desenho fica de pé na tela, com o tronco embaixo; transposto, ele deitaria); a imagem nunca gira"
		if cfg["destino"] == "carimbo":
			p["tamanhoDoApp"] = cfg["tamanhoDoApp"]
		p["corMedia"] = r.get("corMedia", "")
		p["memoria"] = {"gpuBytes": gpu, "discoBytes": disco, "tetoGpuBytes": TETO_GPU_POR_CARIMBO, "tetoDiscoBytes": TETO_DISCO_POR_CARIMBO}
	else:
		var t: Dictionary = cfg["trecho"]
		var tam: Vector2i = r.get("trechoTamanho", Vector2i.ZERO)
		p["curva"] = cfg["curva"]
		p["casas"] = cfg["casas"]
		p["trecho"] = {
			"arquivos": {"cor": ARQUIVO_DO_TRECHO, "relevo": ARQUIVO_DO_RELEVO},
			"pxPorCasa": Contrato.CASA_PX * PX_POR_MUNDO_TRECHO,
			"larguraImagemPx": tam.x,
			"alturaImagemPx": tam.y,
			"comprimentoPx": t["comprimentoPx"],
			"meiaLarguraPx": t["meiaLarguraPx"],
			"pontaPx": t["pontaPx"],
			"canais": {"cor": "RGBA, cor reta sem luz de direção, alfa reto", "relevo": "R = 0,5 + 0,5 x lado ao longo; G = 0,5 + 0,5 x lado atravessando; B = 0"},
			"orientacao": "x da imagem / 2 - pontaPx = s, ao longo (s < 0 é a ponta do começo; de 0 em diante o trecho repete a cada comprimentoPx); y da imagem / 2 - meiaLarguraPx = c, atravessando (com t a direção do trecho na tela, +c fica em n = (-t.y, t.x): para baixo quando o trecho anda para a direita, ou seja, a imagem aparece como está)",
		}
		p["luz"] = {"forca": cfg["luz"]["forca"], "direcao": LUZ, "conta": "ver CONTRATO.md 9.5"}
		p["memoria"] = {"gpuBytes": gpu, "discoBytes": disco, "tetoGpuBytes": TETO_GPU_POR_CARIMBO, "tetoDiscoBytes": TETO_DISCO_POR_CARIMBO}
	return p

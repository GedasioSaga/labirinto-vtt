extends RefCounted
## O contrato da onda 5 em números (CONTRATO.md, seção 11): o traço (penhasco, borda do
## penhasco, parede, janela, grade). Lê e confere o config.json do tipo "traco" e monta o
## textura.json que o app lê. As ondas 1 a 4 seguem nos contratos delas, sem mudança.

const Contrato := preload("res://comum/contrato.gd")

const TIPO := "traco"
const PARTES := ["face", "borda"]
const PX_POR_MUNDO := 2 ## 128 px da imagem por casa: 2 px da imagem por px do mundo
const PX_POR_CASA := 128
## As alturas do app: a espessura da parede a 64 px por casa, virada para o sul
## (client/src/lib/barranco.ts, ESPESSURA_DO_PROTOTIPO 10, 16 e 24 num quadrado de 32).
const ALTURAS := ["baixo", "medio", "alto"]
const H_PX := {"baixo": 20.0, "medio": 32.0, "alto": 48.0}
const COSTURA_PX := 4.0 ## px do mundo lisos em cada ponta do módulo (comum/traco.gdshaderinc)
const FOLGA_PX := 4.0 ## px do mundo de folga na imagem antes e depois de cada módulo
const COSTURA_MAX := 2.0 / 255.0
const MODULOS_MAX := 6
## A imagem de cada módulo sai da espessura VISTA no meio dele, em px do mundo: abaixo de
## 26 a do Baixo, abaixo de 40 a do Médio, senão a do Alto; nunca acima da altura da beira.
const LIMITES_DA_ESCOLHA := [26.0, 40.0]
const ANCORAS := ["beira", "pe"]
## "deslocada" (a parede, a janela e a grade, 11.15): a faixa inteira andada na direção da
## sombra da família, desfocada; não depende do lado em que o traço foi riscado.
const JEITOS_DA_SOMBRA := ["pe", "nenhuma", "deslocada"]
const SOMBRA_DIRECAO := [7, 11]
## A sombra da família (os carimbos e os móveis, seções 9 e 10): a mesma cor e o mesmo alfa.
const SOMBRA_COR := "#0a1c28"
const SOMBRA_ALFA := 0.25
const LUZ := [-0.7071, -0.7071]
const TINGIR := {"conta": "luz-oklab", "neutro": 0.5, "ganhoL": 0.48, "escuroAte": 0.10, "claroDesde": 0.94}
## "tingir": "familia-pedra" (a parede, a janela e a grade, 11.15): a rampa da família dos
## móveis (comum/contrato_movel.gd RAMPA, CONTRATO 10.5) com o croma da pedra no escuro
## (-0,6, o poço do lote 12): o contorno, a junta e a grade ficam escuros sem virar ocre.
const TINGIR_FAMILIA_PEDRA := {
	"conta": "valor-oklab",
	"escuro": [[0.0, 0.42], [0.10, 0.50], [0.24, 0.64], [0.36, 0.78], [0.50, 1.0]],
	"claro": [[0.50, 0.0], [0.62, 0.12], [0.76, 0.26], [1.0, 0.45]],
	"cromaNaSombra": -0.6,
	"amareloNaLuz": 0.12,
	"cromaNaLuz": 0.2,
	"escuroAte": 0.10,
	"claroDesde": 0.94,
}
## As mesas de prova: "barranco" (comum/mesa_traco.gd) ou "sala" (comum/mesa_parede.gd).
const MESAS := ["barranco", "sala"]
## Na placa e no disco, por item (as alturas e as linhas somadas, RGBA com mipmaps).
const TETO_MEMORIA := 6 * 1024 * 1024
const TETO_DISCO := 1536 * 1024


static func eh_traco(id: String) -> bool:
	var caminho := "res://texturas/%s/config.json" % id
	if not FileAccess.file_exists(caminho):
		return false
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho))
	return typeof(bruto) == TYPE_DICTIONARY and str(bruto.get("tipo", "")) == TIPO


static func _f(d: Dictionary, k: String, padrao: float) -> float:
	return float(d.get(k, padrao))


## Devolve {"ok", "erros", "config"} com os padrões preenchidos.
static func ler_config(id: String) -> Dictionary:
	var erros: Array[String] = []
	var caminho := "res://texturas/%s/config.json" % id
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho)) if FileAccess.file_exists(caminho) else null
	if typeof(bruto) != TYPE_DICTIONARY:
		return {"ok": false, "erros": ["não li %s" % caminho] as Array[String], "config": {}}
	var c: Dictionary = bruto
	var cfg := {
		"id": str(c.get("id", "")), "nome": str(c.get("nome", id)), "idDoApp": c.get("idDoApp", null),
		"tipo": TIPO, "parte": str(c.get("parte", "")), "onda": int(c.get("onda", 5)), "lote": int(c.get("lote", 17)),
		"semente": int(c.get("semente", 7)), "tingir": false,
	}
	var tg = c.get("tingir", false)
	if typeof(tg) == TYPE_STRING:
		if tg != "familia-pedra":
			erros.append("tingir: true, false ou \"familia-pedra\"")
		cfg["tingir"] = true
		cfg["rampa"] = str(tg)
	else:
		cfg["tingir"] = bool(tg)
	cfg["mesa"] = str(c.get("mesa", "barranco"))
	if not MESAS.has(cfg["mesa"]):
		erros.append("mesa: %s" % str(MESAS))
	if cfg["id"] != id:
		erros.append("\"id\" tem de ser \"%s\"" % id)
	if not PARTES.has(cfg["parte"]):
		erros.append("\"parte\" tem de ser %s" % str(PARTES))
	if cfg["parte"] == "face":
		var f: Dictionary = c.get("face", {})
		var mods: Array = f.get("modulosCasas", [])
		if mods.is_empty() or mods.size() > MODULOS_MAX:
			erros.append("face.modulosCasas: de 1 a %d módulos" % MODULOS_MAX)
		var limpos: Array[float] = []
		for m in mods:
			var casas := float(m)
			# Inteiro de px da imagem: a emenda cai sempre num px.
			if casas < 1.0 or casas > 6.0 or absf(casas * PX_POR_CASA - roundf(casas * PX_POR_CASA)) > 1e-6:
				erros.append("face.modulosCasas: %s não serve (de 1 a 6 casas, em px inteiros a 128 por casa)" % str(m))
			limpos.append(casas)
		cfg["face"] = {"modulosCasas": limpos, "acimaPx": _f(f, "acimaPx", 4.0), "abaixoPx": _f(f, "abaixoPx", 8.0)}
		for k in ["acimaPx", "abaixoPx"]:
			var v: float = cfg["face"][k]
			if v < 0.0 or v > 24.0 or absf(v * PX_POR_MUNDO - roundf(v * PX_POR_MUNDO)) > 1e-6:
				erros.append("face.%s: de 0 a 24 px do mundo, em meios px" % k)
		var l: Dictionary = c.get("luz", {})
		cfg["luz"] = {"face": _f(l, "face", 0.45), "relevo": _f(l, "relevo", 0.6)}
		for k in ["face", "relevo"]:
			if cfg["luz"][k] < 0.0 or cfg["luz"][k] > 1.0:
				erros.append("luz.%s: de 0 a 1" % k)
		var s: Dictionary = c.get("sombra", {})
		cfg["sombra"] = {"jeito": str(s.get("jeito", "pe")), "comprimentoPx": _f(s, "comprimentoPx", 6.0), "borraoPx": _f(s, "borraoPx", 8.0)}
		if cfg["sombra"]["jeito"] == "deslocada":
			cfg["sombra"]["deslocamentoPx"] = _f(s, "deslocamentoPx", 4.0)
		if not JEITOS_DA_SOMBRA.has(cfg["sombra"]["jeito"]):
			erros.append("sombra.jeito: %s" % str(JEITOS_DA_SOMBRA))
		cfg["borda"] = c.get("borda", null)
		# A parede, a janela e a grade (11.15): o que o app precisa além da face (o contorno que
		# ele pinta, o papel do item na parede). Passa reto para o textura.json.
		if typeof(c.get("parede", null)) == TYPE_DICTIONARY:
			cfg["parede"] = c["parede"]
	elif cfg["parte"] == "borda":
		var b: Dictionary = c.get("borda", {})
		var linhas: Array = b.get("linhas", [])
		var ls: Array = []
		for li in linhas:
			if typeof(li) != TYPE_DICTIONARY or not ANCORAS.has(str(li.get("ancora", ""))):
				erros.append("borda.linhas: cada linha é { nome, ancora: %s, chao: [...] }" % str(ANCORAS))
				continue
			ls.append({"nome": str(li.get("nome", "")), "ancora": str(li["ancora"]), "chao": li.get("chao", [])})
		if ls.is_empty():
			erros.append("borda.linhas: ao menos uma")
		cfg["borda"] = {"comprimentoCasas": _f(b, "comprimentoCasas", 16.0), "acimaPx": _f(b, "acimaPx", 8.0), "abaixoPx": _f(b, "abaixoPx", 12.0), "linhas": ls}
		var L: float = cfg["borda"]["comprimentoCasas"]
		if L < 2.0 or L > 16.0 or absf(L - roundf(L)) > 1e-6:
			erros.append("borda.comprimentoCasas: inteiro de 2 a 16")
	return {"ok": erros.is_empty(), "erros": erros, "config": cfg}


## O tamanho de uma imagem de módulo (px), com a folga dos dois lados.
static func tamanho_do_modulo(casas: float, altura: String, cfg: Dictionary) -> Vector2i:
	var w := int(roundf((casas * Contrato.CASA_PX + 2.0 * FOLGA_PX) * PX_POR_MUNDO))
	var h := int(roundf((cfg["face"]["acimaPx"] + H_PX[altura] + cfg["face"]["abaixoPx"]) * PX_POR_MUNDO))
	return Vector2i(w, h)


static func bytes_memoria(w: int, h: int) -> int:
	return int(w * h * 4 * 4 / 3.0)


## O textura.json do traço: tudo explícito (o app não deriva nada).
static func parametros(cfg: Dictionary, r: Dictionary, memoria: int, disco: int) -> Dictionary:
	var p := {
		"contrato": Contrato.VERSAO, "tipo": TIPO, "parte": cfg["parte"], "id": cfg["id"], "nome": cfg["nome"],
		"idDoApp": cfg["idDoApp"], "pxPorCasa": PX_POR_CASA, "casaPx": Contrato.CASA_PX,
	}
	if cfg["parte"] == "face":
		var alturas := {}
		for a in ALTURAS:
			alturas[a] = {"hPx": H_PX[a], "hCasas": H_PX[a] / Contrato.CASA_PX, "arquivos": {"cor": "face-%s.png" % a, "relevo": "face-%s-relevo.png" % a}, "imagem": r["tamanhos"][a]}
		p["alturas"] = alturas
		p["face"] = {
			"modulos": r["modulos"], "folgaPx": FOLGA_PX, "acimaPx": cfg["face"]["acimaPx"], "abaixoPx": cfg["face"]["abaixoPx"],
			"costuraPx": COSTURA_PX, "costura": r["costura"],
			"canais": "cor: RGBA, cor reta, alfa reto%s; relevo: R = 0,5 + 0,5 x ao longo, G = 0,5 + 0,5 x para baixo" % (" (R = valor, 0,5 = a cor do mestre)" if cfg["tingir"] else ""),
			"conta": "x da imagem = modulo.xPx + 2 * (u espelhado ou não); y da imagem = 2 * (acimaPx + (d / t) * hPx), d = px do mundo da beira para o pé, t = a espessura do app no ponto",
			"escolha": {"limitesPx": LIMITES_DA_ESCOLHA, "conta": "por módulo: tv = a espessura do app no meio do módulo, em px do mundo; tv < 26: baixo; tv < 40: medio; senão alto; nunca acima da altura da beira (a face do norte de um Alto, 36%, usa a do Baixo)"},
		}
		p["sequencia"] = {
			"semente": cfg["semente"] * 101 + 89,
			"conta": "j = 0, 1, 2...: m(j) = floor(hash(j, 0, semente + h) * N), trocado pelo seguinte se igual ao de antes; espelho(j) = hash(j, 1, semente + h) < 0,5; h = o hash do id do traço; no laço fechado os comprimentos escalam para somar o comprimento da beira",
		}
		p["luz"] = {"face": cfg["luz"]["face"], "relevo": cfg["luz"]["relevo"], "direcao": LUZ, "conta": "l = face * dot(baixo, LUZ) + relevo * dot(rx * aoLongo + ry * baixo, LUZ); l >= 0: mix(cor, realce_de(cor), l); l < 0: cor * (1 - 0,3 * (-l))"}
		if cfg["sombra"]["jeito"] == "deslocada":
			p["sombra"] = {"jeito": "deslocada", "deslocamentoPx": cfg["sombra"]["deslocamentoPx"], "borraoPx": cfg["sombra"]["borraoPx"], "direcao": SOMBRA_DIRECAO, "cor": SOMBRA_COR, "alfa": SOMBRA_ALFA, "conta": "a faixa inteira de todas as paredes (a espessura toda, o contorno incluído) numa camada só, andada deslocamentoPx na direção (7, 11) normalizada, desfocada borraoPx, por baixo das paredes e por cima do chão"}
		else:
			p["sombra"] = {"jeito": cfg["sombra"]["jeito"], "comprimentoPx": cfg["sombra"]["comprimentoPx"], "borraoPx": cfg["sombra"]["borraoPx"], "cor": SOMBRA_COR, "alfa": SOMBRA_ALFA, "conta": "o polígono de d = t / 2 a d = t + comprimentoPx + 1,05 * t * deCostas (t da beira) (deCostas = max(0, -dot(normal, LUZ))), desfocado borraoPx, numa camada só, por baixo da face"}
		p["tingir"] = (TINGIR_FAMILIA_PEDRA if cfg.get("rampa", "") == "familia-pedra" else TINGIR) if cfg["tingir"] else null
		p["borda"] = cfg["borda"]
		if cfg.has("parede"):
			p["parede"] = cfg["parede"]
		p["corMedia"] = r["corMedia"]
	else:
		var b: Dictionary = cfg["borda"]
		var linhas: Array = []
		for i in b["linhas"].size():
			var li: Dictionary = b["linhas"][i]
			linhas.append({"nome": li["nome"], "ancora": li["ancora"], "chao": li["chao"], "yPx": i * r["linhaPx"]})
		p["borda"] = {"arquivo": "borda.png", "comprimentoPx": b["comprimentoCasas"] * Contrato.CASA_PX, "acimaPx": b["acimaPx"], "abaixoPx": b["abaixoPx"], "linhaPx": r["linhaPx"], "linhas": linhas, "imagem": r["tamanhos"]["borda"],
			"conta": "x da imagem = 2 * ((s + desvio) mod comprimentoPx), desvio = hash(0, 2, h) * comprimentoPx; y = linha.yPx + 2 * (acimaPx + d - ancora), ancora = 0 na beira ou t no pé; alfa x suave(0; 0,25; t / hPx da altura)"}
	p["memoria"] = {"memoriaBytes": memoria, "discoBytes": disco, "tetoMemoriaBytes": TETO_MEMORIA, "tetoDiscoBytes": TETO_DISCO}
	return p

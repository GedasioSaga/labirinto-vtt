extends RefCounted
## CONGELADO. O contrato de um MATERIAL de móvel (onda 4, CONTRATO.md seção 10): o
## config.json de "tipo": "material", os tetos e o textura.json que o app lê.
## O material é a SUPERFÍCIE de uma classe do motor dos móveis do app
## (client/src/texturas/meioTermo/moveis/motor.ts, a tabela TEXTURA): uma imagem de valor
## em cinza (0,5 = o tom do material), repetível, que o app tinge pelo tom de cada um dos
## 24 materiais e lê em (u, v) da peça. O formato do móvel continua o do app.

const Contrato := preload("res://comum/contrato.gd")

const TIPO := "material"
const CLASSES := ["madeira", "metal", "tecido", "pedra", "palha", "corda", "casca", "folha"]
## Os subtipos que o motor distingue dentro da classe (MaterialDaPeca.fio, .pedra, .casca):
## uma imagem própria para cada um é opcional; sem ela, vale a da classe ("padrao").
const SUBTIPOS := {"tecido": ["linho", "la"], "pedra": ["granito", "arenito", "ardosia"], "casca": ["betula", "fendida"]}
const PX_POR_CASA := 128 ## px da imagem por casa
const PX_DO_PROTOTIPO_POR_CASA := 56 ## o G do motor (contexto.ts)
const CASAS_VALIDAS := [1, 2, 4, 8] ## lados da imagem, em casas (potência de 2: mipmap exato)
const IMAGENS_MAX := 4
## Tetos (CONTRATO.md 10.6). Memória comum = as imagens decodificadas em RGBA com mipmap.
const TETO_MEMORIA_POR_MATERIAL := 1536 * 1024
const TETO_DISCO_POR_MATERIAL := 512 * 1024
const TETO_MEMORIA_DOS_8 := 12 * 1024 * 1024
const TINGIR_PADRAO := {"conta": "luz-oklab", "neutro": 0.5, "ganhoL": 0.48, "escuroAte": 0.10, "claroDesde": 0.94}
const VALOR_MEDIO_FOLGA := 0.03


static func eh_material(id: String) -> bool:
	var caminho := "res://texturas/%s/config.json" % id
	if not FileAccess.file_exists(caminho):
		return false
	var bruto = JSON.parse_string(FileAccess.get_file_as_string(caminho))
	return typeof(bruto) == TYPE_DICTIONARY and str(bruto.get("tipo", "")) == TIPO


static func arquivo_da_imagem(nome: String) -> String:
	return "%s.png" % nome


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
	cfg["classe"] = str(c.get("classe", ""))
	if not CLASSES.has(cfg["classe"]):
		erros.append("\"classe\" tem de ser uma de %s" % [", ".join(PackedStringArray(CLASSES))])
	cfg["onda"] = int(c.get("onda", 4))
	cfg["lote"] = int(c.get("lote", 0))
	cfg["semente"] = int(c.get("semente", 7))
	var casas = c.get("casas", [8, 2])
	if typeof(casas) != TYPE_ARRAY or casas.size() != 2 or not CASAS_VALIDAS.has(int(casas[0])) or not CASAS_VALIDAS.has(int(casas[1])):
		erros.append("\"casas\" = [ao longo, atravessando], cada um em %s" % [str(CASAS_VALIDAS)])
		casas = [8, 2]
	cfg["casas"] = [int(casas[0]), int(casas[1])]
	var imagens = c.get("imagens", ["padrao"])
	var subtipos: Array = SUBTIPOS.get(cfg["classe"], [])
	if typeof(imagens) != TYPE_ARRAY or imagens.is_empty() or imagens.size() > IMAGENS_MAX or str(imagens[0]) != "padrao":
		erros.append("\"imagens\": de 1 a %d nomes, o primeiro \"padrao\" (a da classe)" % IMAGENS_MAX)
		imagens = ["padrao"]
	var vistos := []
	for nome in imagens:
		var n := str(nome)
		if vistos.has(n):
			erros.append("\"imagens\": \"%s\" repetida" % n)
		elif n != "padrao" and not subtipos.has(n):
			erros.append("\"imagens\": \"%s\" não é subtipo da classe %s (%s)" % [n, cfg["classe"], ", ".join(PackedStringArray(subtipos)) if not subtipos.is_empty() else "nenhum"])
		vistos.append(n)
	cfg["imagens"] = vistos
	var tingir := TINGIR_PADRAO.duplicate()
	var t = c.get("tingir", {})
	if typeof(t) == TYPE_DICTIONARY:
		for k in ["ganhoL", "escuroAte", "claroDesde"]:
			if t.has(k):
				tingir[k] = float(t[k])
	if tingir["ganhoL"] < 0.2 or tingir["ganhoL"] > 0.7:
		erros.append("\"tingir.ganhoL\" entre 0,2 e 0,7 (o padrão, o do chão de sala, é 0,48)")
	cfg["tingir"] = tingir
	return {"ok": erros.is_empty(), "erros": erros, "config": cfg}


## Bytes na memória comum de uma imagem decodificada (RGBA, mais 1/3 de mipmap).
static func bytes_memoria(w: int, h: int) -> int:
	return int(w * h * 4 * 4 / 3)


## O textura.json: tudo explícito, o app não deriva nada.
static func parametros(cfg: Dictionary, r: Dictionary, memoria: int, disco: int) -> Dictionary:
	var w: int = cfg["casas"][0] * PX_POR_CASA
	var h: int = cfg["casas"][1] * PX_POR_CASA
	var imagens := []
	for nome in cfg["imagens"]:
		imagens.append({
			"nome": nome,
			"arquivo": arquivo_da_imagem(nome),
			"vale": "a classe inteira (peça sem subtipo, ou subtipo sem imagem própria)" if nome == "padrao" else "a peça de subtipo %s" % nome,
			"valorMedio": r["medidas"][nome]["valorMedio"],
			"emendas": {"u": r["medidas"][nome]["emendaU"], "v": r["medidas"][nome]["emendaV"]},
		})
	var estrutura := "nenhuma: só a superfície"
	if cfg["classe"] == "madeira":
		estrutura = "a do motor (texMadeira sem o veio): tábua de p.tabua px, fresta, emenda de topo e o tom de cada tábua; cada tábua e cada trecho entre emendas lê uma janela sorteada da imagem (ferramentas/material.ts)"
	return {
		"contrato": Contrato.VERSAO,
		"tipo": TIPO,
		"id": cfg["id"],
		"nome": cfg["nome"],
		"classe": cfg["classe"],
		"idDoApp": cfg["classe"],
		"onda": cfg["onda"],
		"lote": cfg["lote"],
		"semente": cfg["semente"],
		"material": {
			"pxPorCasa": PX_POR_CASA,
			"pxDoPrototipoPorCasa": PX_DO_PROTOTIPO_POR_CASA,
			"texelPorPxDoPrototipo": float(PX_POR_CASA) / float(PX_DO_PROTOTIPO_POR_CASA),
			"casas": cfg["casas"],
			"larguraPx": w,
			"alturaPx": h,
			"orientacao": "x = u da peça (ao longo do veio, da trama ou do comprimento), y = v (atravessando); repete nos dois sentidos",
			"canais": "cinza (R = G = B): valor 0..1, 0,5 = o tom do material",
			"leitura": "bilinear, repetindo; mipmap trilinear com lod = log2(texelPorPxDoPrototipo / escala da pintura)",
		},
		"imagens": imagens,
		"tingir": cfg["tingir"],
		"estrutura": estrutura,
		"memoria": {
			"memoriaBytes": memoria,
			"discoBytes": disco,
			"tetoMemoriaBytes": TETO_MEMORIA_POR_MATERIAL,
			"tetoDiscoBytes": TETO_DISCO_POR_MATERIAL,
			"tetoMemoriaDos8Bytes": TETO_MEMORIA_DOS_8,
			"placaAMaisQueOAtualBytes": 0,
		},
	}

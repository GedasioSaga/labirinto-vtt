extends Node
## CONGELADO. A mesa de prova de UMA textura: lê os arquivos já exportados
## (exportado/<id>/) e monta o chão do jeito que o app vai montar
## (comum/compor.gdshader), ao lado da textura de hoje do app (o Atual), e mede a
## repetição. Grava as peças e a folha de aprovação na pasta de prova.

const Contrato := preload("res://comum/contrato.gd")
const SH_COMPOR := preload("res://comum/compor.gdshader")

const CASAS := 40 ## lado da área grande, em casas
const PERTO_CASAS := 4 ## lado do close a 300%, em casas
const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")
const COR_MARCA := Color("f0c98a")
const COR_FORA := Color("2b2b2b") ## o fundo do editor do app, onde a textura não está

var _texturas := {}


## `atual`: {"ok": bool, "motivo": String, "pasta": String} (a pasta tem atual-100.png,
## janela.json e, com mapa, mascara.png). Devolve {"ok", "erros", "arquivos", "resumo"}.
func montar(cfg: Dictionary, pasta_exportada: String, pasta_prova: String, atual: Dictionary) -> Dictionary:
	var erros: Array[String] = []
	var arquivos: Array[String] = []
	DirAccess.make_dir_recursive_absolute(pasta_prova)
	if not _carregar(cfg, pasta_exportada, erros):
		return {"ok": false, "erros": erros, "arquivos": arquivos, "resumo": {}}
	var casa := float(Contrato.CASA_PX)
	var origem := Vector2.ZERO
	var janela := {}
	var tem_atual: bool = atual.get("ok", false)
	if tem_atual:
		var bruto = JSON.parse_string(FileAccess.get_file_as_string(atual["pasta"].path_join("janela.json")))
		var img_atual := Image.load_from_file(atual["pasta"].path_join("atual-100.png"))
		if typeof(bruto) != TYPE_DICTIONARY or img_atual == null or img_atual.is_empty():
			tem_atual = false
			atual["motivo"] = "o Atual não gravou atual-100.png e janela.json"
		else:
			janela = bruto
			origem = Vector2(janela["janela"]["x0"], janela["janela"]["y0"]) * casa
			img_atual.generate_mipmaps()
			_texturas["atual"] = ImageTexture.create_from_image(img_atual)
	var cobertura = janela.get("coberturaNaJanela", null)
	var usar_mascara := false
	if tem_atual and cobertura != null and float(cobertura) < 0.999:
		var img_m := Image.load_from_file(atual["pasta"].path_join("mascara.png"))
		if img_m != null and not img_m.is_empty():
			_texturas["mascara"] = ImageTexture.create_from_image(img_m)
			usar_mascara = true
	var lado := CASAS * casa
	var centro := origem + Vector2(lado, lado) * 0.5
	var perto := centro - Vector2(PERTO_CASAS, PERTO_CASAS) * casa * 0.5
	var vistas := {
		"area50": _vista(cfg, 0, origem, 0.5, lado * 0.5, usar_mascara, origem),
		"area100": _vista(cfg, 0, origem, 1.0, lado, usar_mascara, origem),
		"perto300": _vista(cfg, 0, perto, 3.0, PERTO_CASAS * casa * 3.0, usar_mascara, origem),
		"controle-base1": _vista(cfg, 1, origem, 1.0, lado, false, origem),
		"controle-misturada": _vista(cfg, 2, origem, 1.0, lado, false, origem),
	}
	if tem_atual:
		vistas["atual-area50"] = _vista(cfg, 3, origem, 0.5, lado * 0.5, usar_mascara, origem)
		vistas["atual-area100"] = _vista(cfg, 3, origem, 1.0, lado, usar_mascara, origem)
		vistas["atual-perto300"] = _vista(cfg, 3, perto, 3.0, PERTO_CASAS * casa * 3.0, usar_mascara, origem)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var imgs := {}
	for nome in vistas:
		var vp: SubViewport = vistas[nome]
		var img := vp.get_texture().get_image()
		vp.queue_free()
		if img == null or img.is_empty():
			erros.append("%s: a placa de vídeo não devolveu a imagem" % nome)
			continue
		img.convert(Image.FORMAT_RGB8)
		imgs[nome] = img
	if not erros.is_empty():
		return {"ok": false, "erros": erros, "arquivos": arquivos, "resumo": {}}
	var periodo: int = cfg["periodoCasas"] * Contrato.CASA_PX
	var resumo := {
		"id": cfg["id"],
		"nome": cfg["nome"],
		"onda": cfg["onda"],
		"lote": cfg["lote"],
		"repeticao": {
			"soBase1": repeticao(imgs["controle-base1"], periodo),
			"baseMisturada": repeticao(imgs["controle-misturada"], periodo),
			"completo": repeticao(imgs["area100"], periodo),
		},
		"atual": {"ok": tem_atual, "motivo": atual.get("motivo", ""), "janela": janela},
		"mascara": usar_mascara,
	}
	var params = JSON.parse_string(FileAccess.get_file_as_string(pasta_exportada.path_join(Contrato.ARQUIVO_DE_PARAMETROS)))
	if typeof(params) == TYPE_DICTIONARY:
		resumo["memoria"] = params.get("memoria", {})
		resumo["corMedia"] = params.get("corMedia", "")
	for nome in ["area50", "area100", "perto300", "atual-area50", "atual-perto300"]:
		if imgs.has(nome):
			var destino := pasta_prova.path_join(nome + ".png")
			if imgs[nome].save_png(destino) == OK:
				arquivos.append(destino)
	var f := FileAccess.open(pasta_prova.path_join("resumo.json"), FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(resumo, "  "))
		f.close()
		arquivos.append(pasta_prova.path_join("resumo.json"))
	var folha: Image = await _folha(cfg, imgs, resumo, pasta_exportada, tem_atual, atual.get("motivo", ""))
	var caminho_folha := pasta_prova.path_join("folha.png")
	if folha.save_png(caminho_folha) == OK:
		arquivos.append(caminho_folha)
	else:
		erros.append("não consegui salvar %s" % caminho_folha)
	return {"ok": erros.is_empty(), "erros": erros, "arquivos": arquivos, "resumo": resumo}


func _carregar(cfg: Dictionary, pasta: String, erros: Array[String]) -> bool:
	for v in 3:
		var arquivo: String = Contrato.ARQUIVOS_DE_BASE[mini(v, cfg["variantes"] - 1)]
		var img := Image.load_from_file(pasta.path_join(arquivo))
		if img == null or img.is_empty():
			erros.append("não achei %s em %s" % [arquivo, pasta])
			return false
		img.generate_mipmaps()
		_texturas["base_%d" % (v + 1)] = ImageTexture.create_from_image(img)
	if cfg["detalhes"]["quantos"] > 0:
		var atlas := Image.load_from_file(pasta.path_join(Contrato.ARQUIVO_DO_ATLAS))
		if atlas == null or atlas.is_empty():
			erros.append("não achei %s em %s" % [Contrato.ARQUIVO_DO_ATLAS, pasta])
			return false
		atlas.generate_mipmaps()
		_texturas["atlas"] = ImageTexture.create_from_image(atlas)
	return true


func _vista(cfg: Dictionary, fonte: int, origem: Vector2, zoom: float, lado_tela: float, usar_mascara: bool, origem_area: Vector2) -> SubViewport:
	var tamanho := Vector2(lado_tela, lado_tela)
	var vp := SubViewport.new()
	vp.size = Vector2i(tamanho)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var quadro := ColorRect.new()
	quadro.size = tamanho
	var m := ShaderMaterial.new()
	m.shader = SH_COMPOR
	var det: Dictionary = cfg["detalhes"]
	var pesos := PackedFloat32Array()
	pesos.resize(16)
	for k in det["pesos"].size():
		pesos[k] = float(det["pesos"][k])
	var valores := {
		"fonte": fonte,
		"origem": origem,
		"zoom": zoom,
		"tamanho": tamanho,
		"base_1": _texturas["base_1"],
		"base_2": _texturas["base_2"],
		"base_3": _texturas["base_3"],
		"n_variantes": cfg["variantes"],
		"periodo": float(cfg["periodoCasas"] * Contrato.CASA_PX),
		"mistura_semente": cfg["mistura"]["semente"],
		"mistura_escala": cfg["mistura"]["escala"],
		"mistura_faixa": cfg["mistura"]["faixa"],
		"mistura_corte": cfg["mistura"]["corte"],
		"tom_semente": cfg["tom"]["semente"],
		"tom_escala": cfg["tom"]["escala"],
		"tom_amplitude": cfg["tom"]["amplitude"],
		"tem_detalhes": _texturas.has("atlas"),
		"atlas_colunas": Contrato.ATLAS_COLUNAS / int(det["celulaCasas"]),
		"atlas_linhas": Contrato.ATLAS_LINHAS / int(det["celulaCasas"]),
		"celula_casas": float(det["celulaCasas"]),
		"n_detalhes": det["quantos"],
		"pesos": pesos,
		"atlas_px_por_casa": float(Contrato.ATLAS_PX_POR_CASA),
		"detalhes_semente": det["semente"],
		"densidade": det["densidade"],
		"agrupamento": det["agrupamento"],
		"escala_min": det["escalaMin"],
		"escala_max": det["escalaMax"],
		"variacao_tom": det["variacaoDeTom"],
		"usar_mascara": usar_mascara,
		"mascara_origem": origem_area,
		"mascara_mundo": Vector2(CASAS, CASAS) * Contrato.CASA_PX,
		"atual_origem": origem_area,
		"atual_mundo": Vector2(CASAS, CASAS) * Contrato.CASA_PX,
		"cor_fora": Vector3(COR_FORA.r, COR_FORA.g, COR_FORA.b),
	}
	if _texturas.has("atlas"):
		valores["atlas"] = _texturas["atlas"]
	if _texturas.has("atual"):
		valores["imagem_atual"] = _texturas["atual"]
	if _texturas.has("mascara"):
		valores["mascara"] = _texturas["mascara"]
	for k in valores:
		m.set_shader_parameter(k, valores[k])
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


## Repetição: diferença média de luminância entre a imagem e ela mesma deslocada de
## um período (8 casas), dividida pela mesma diferença a 7 e a 9 casas. Cópia exata a
## cada período dá 0; chão que não se repete dá perto de 1.
static func repeticao(img: Image, periodo: int, passo := 4) -> float:
	var w := img.get_width()
	var h := img.get_height()
	var gw := w / passo
	var gh := h / passo
	var dados := img.get_data()
	var bpp := 3 if img.get_format() == Image.FORMAT_RGB8 else 4
	var lum := PackedFloat32Array()
	lum.resize(gw * gh)
	for gy in gh:
		for gx in gw:
			var o := ((gy * passo) * w + gx * passo) * bpp
			lum[gy * gw + gx] = 0.25 * dados[o] + 0.6 * dados[o + 1] + 0.15 * dados[o + 2]
	var mads: Array[float] = []
	for lag_px in [periodo, periodo - Contrato.CASA_PX, periodo + Contrato.CASA_PX]:
		var lag: int = lag_px / passo
		var soma := 0.0
		var n := 0
		for gy in gh:
			var linha := gy * gw
			for gx in gw - lag:
				soma += absf(lum[linha + gx] - lum[linha + gx + lag])
				n += 1
		for gy in gh - lag:
			var linha := gy * gw
			for gx in gw:
				soma += absf(lum[linha + gx] - lum[linha + lag * gw + gx])
				n += 1
		mads.append(soma / float(maxi(n, 1)))
	return snappedf(mads[0] / maxf((mads[1] + mads[2]) * 0.5, 1e-6), 0.01)


func _folha(cfg: Dictionary, imgs: Dictionary, resumo: Dictionary, pasta_exportada: String, tem_atual: bool, motivo: String) -> Image:
	var mg := 28
	var col := 1280
	var largura := mg + col + mg + col + mg
	var y1 := 184
	var y2 := y1 + col + 52
	var y3 := y2 + col + 52
	var perto := PERTO_CASAS * Contrato.CASA_PX * 3
	var altura := y3 + perto + 60
	var vp := SubViewport.new()
	vp.size = Vector2i(largura, altura)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(largura, altura)
	vp.add_child(fundo)
	var rep: Dictionary = resumo["repeticao"]
	var mem: Dictionary = resumo.get("memoria", {})
	_rotulo(vp, "%s  ·  %s  ·  Desenhado, onda %d, lote %d" % [cfg["nome"], cfg["id"], cfg["onda"], cfg["lote"]], Vector2(mg, 16), 28, COR_TINTA)
	_rotulo(vp, "Contrato v%d  ·  base: %d variante(s) de %d x %d casas  ·  detalhes: %d no atlas, %.2f por casa  ·  memória: %.1f de %.1f MiB na GPU, %.2f de %.2f MiB em disco" % [
		Contrato.VERSAO, cfg["variantes"], cfg["periodoCasas"], cfg["periodoCasas"], cfg["detalhes"]["quantos"], cfg["detalhes"]["densidade"],
		mem.get("gpuBytes", 0) / 1048576.0, Contrato.TETO_GPU_POR_TEXTURA / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, Contrato.TETO_DISCO_POR_TEXTURA / 1048576.0], Vector2(mg, 58), 17, COR_TINTA_2)
	_rotulo(vp, "Repetição a 100%% (diferença a 8 casas dividida pela diferença a 7 e a 9; 0 = cópia exata, 1 = não repete):  só a base-1 %.2f  ·  base misturada %.2f  ·  Desenhado completo %.2f" % [rep["soBase1"], rep["baseMisturada"], rep["completo"]], Vector2(mg, 84), 17, COR_TINTA_2)
	var onde := "área livre, sem mapa"
	var j: Dictionary = resumo["atual"].get("janela", {})
	if j.get("mapa", {}).get("real", false):
		onde = "chão de um mapa real: janela %d,%d de %d x %d casas, %d%% das casas com esta textura%s" % [j["janela"]["x0"], j["janela"]["y0"], CASAS, CASAS, int(round(float(j["coberturaNaJanela"]) * 100.0)), " (o resto em cinza)" if resumo["mascara"] else ""]
	_rotulo(vp, "Onde: %s.  À direita, o Atual: a textura de hoje do app na mesma área (Meio-Termo, sem manchas do chão)." % onde, Vector2(mg, 110), 17, COR_TINTA_3)
	var xd := mg
	var xa := mg + col + mg
	var xa3 := xd + perto + mg
	_rotulo(vp, "Desenhado  ·  %d x %d casas a 50%%" % [CASAS, CASAS], Vector2(xd, y1 - 30), 19, COR_TINTA)
	_imagem(vp, imgs["area50"], Vector2(xd, y1))
	var miolo := Rect2i(col / 2, col / 2, col, col)
	_rotulo(vp, "Desenhado  ·  a 100%%, o miolo da mesma área (%d x %d casas)" % [CASAS / 2, CASAS / 2], Vector2(xd, y2 - 30), 19, COR_TINTA)
	_imagem(vp, imgs["area100"].get_region(miolo), Vector2(xd, y2))
	_rotulo(vp, "Desenhado  ·  perto, a 300%% (%d x %d casas)" % [PERTO_CASAS, PERTO_CASAS], Vector2(xd, y3 - 30), 19, COR_TINTA)
	_imagem(vp, imgs["perto300"], Vector2(xd, y3))
	if tem_atual:
		_rotulo(vp, "Atual  ·  a mesma área a 50%", Vector2(xa, y1 - 30), 19, COR_TINTA_2)
		_imagem(vp, imgs["atual-area50"], Vector2(xa, y1))
		_rotulo(vp, "Atual  ·  o mesmo miolo a 100%", Vector2(xa, y2 - 30), 19, COR_TINTA_2)
		_imagem(vp, imgs["atual-area100"].get_region(miolo), Vector2(xa, y2))
		_rotulo(vp, "Atual  ·  a 300%", Vector2(xa3, y3 - 30), 19, COR_TINTA_2)
		_imagem(vp, imgs["atual-perto300"], Vector2(xa3, y3))
	else:
		_rotulo(vp, "Sem Atual: %s" % motivo, Vector2(xa, y1), 19, COR_TINTA_3)
	# Os arquivos exportados, a 50%: as variantes da base e o atlas sobre a cor média.
	var xl := xa3 + perto + mg
	_rotulo(vp, "Arquivos (50%)", Vector2(xl, y3 - 30), 19, COR_TINTA)
	for v in cfg["variantes"]:
		var b := Image.load_from_file(pasta_exportada.path_join(Contrato.ARQUIVOS_DE_BASE[v]))
		b.resize(b.get_width() / 2, b.get_height() / 2, Image.INTERPOLATE_LANCZOS)
		_imagem(vp, b, Vector2(xl, y3 + v * (256 + 8)))
		_rotulo(vp, "base-%d" % (v + 1), Vector2(xl + 262, y3 + v * (256 + 8) + 4), 14, COR_TINTA_3)
	if _texturas.has("atlas"):
		var xatl := xl + 256 + 70
		var chao := ColorRect.new()
		chao.color = Color(resumo.get("corMedia", "#808080"))
		chao.position = Vector2(xatl, y3)
		chao.size = Vector2(256, 256)
		vp.add_child(chao)
		var a := Image.load_from_file(pasta_exportada.path_join(Contrato.ARQUIVO_DO_ATLAS))
		a.resize(256, 256, Image.INTERPOLATE_LANCZOS)
		_imagem(vp, a, Vector2(xatl, y3))
		_rotulo(vp, "detalhes (atlas)", Vector2(xatl, y3 + 262), 14, COR_TINTA_3)
	add_child(vp)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var folha := vp.get_texture().get_image()
	vp.queue_free()
	folha.convert(Image.FORMAT_RGB8)
	return folha


func _rotulo(pai: Node, texto: String, pos: Vector2, tamanho: int, cor: Color) -> void:
	var l := Label.new()
	l.text = texto
	l.position = pos
	l.add_theme_font_size_override("font_size", tamanho)
	l.add_theme_color_override("font_color", cor)
	pai.add_child(l)


func _imagem(pai: Node, img: Image, pos: Vector2) -> void:
	var tr := TextureRect.new()
	tr.texture = ImageTexture.create_from_image(img)
	tr.position = pos
	pai.add_child(tr)

extends Node
## CONGELADO. A mesa de prova de um carimbo ou de um trecho (onda 3; CONTRATO.md 9.8).
## 1. Pinta os chãos com a grama APROVADA (exportado/grama, pela montagem do contrato do
##    chão, comum/compor.gdshader via comum/mesa.gd) e a grama de hoje do app (atual.ts).
## 2. ferramentas/carimbo.ts abre o Chromium do Playwright e monta os painéis no Canvas 2D:
##    o Desenhado pela conta do contrato e o Atual com o código do app, nos mesmos objetos
##    soltos pelo spray do app.
## 3. Esta mesa arruma a folha: o objeto sozinho a 25, 50, 100 e 300%; as formas (uma por
##    passo de 45 graus de giro); o bosque a 50%, 25% e um recorte a 100%; o Atual ao lado.

const Contrato := preload("res://comum/contrato.gd")
const ContratoCarimbo := preload("res://comum/contrato_carimbo.gd")
const Mesa := preload("res://comum/mesa.gd")

const MG := 28
const CASAS := 24 ## a cena do bosque, em casas (a 100%: 1536 px)
const SOZ_X0 := 2 ## onde fica o quadrado do objeto sozinho, em casas
const SOZ_Y0 := 2
const RECORTE_CASAS := 8 ## o recorte a 100% do bosque
const BANDA := 2048 ## a folha é desenhada em faixas desta altura
const LEITURAS := 4
const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")


## Devolve {"ok", "erros", "resumo"}.
func montar(cfg: Dictionary, pasta_exportada: String, prova: String, sem_atual: bool) -> Dictionary:
	var erros: Array[String] = []
	var paineis := prova.path_join("paineis")
	DirAccess.make_dir_recursive_absolute(paineis)
	var soz := _casas_do_sozinho(cfg)
	# 1. Os chãos.
	var lido_g := Contrato.ler_config("grama")
	if not lido_g["ok"]:
		erros.append("a grama aprovada (texturas/grama/config.json) não leu")
		return {"ok": false, "erros": erros, "resumo": {}}
	var cfg_g: Dictionary = lido_g["config"]
	var mesa_g := Mesa.new()
	add_child(mesa_g)
	if not mesa_g._carregar(cfg_g, ProjectSettings.globalize_path("res://exportado/grama"), erros):
		return {"ok": false, "erros": erros, "resumo": {}}
	var casa := float(Contrato.CASA_PX)
	var o_soz := Vector2(SOZ_X0, SOZ_Y0) * casa
	var vistas := {
		"chao-bosque-100": mesa_g._vista(cfg_g, 0, Vector2.ZERO, 1.0, CASAS * casa, false, Vector2.ZERO),
		"chao-soz-100": mesa_g._vista(cfg_g, 0, o_soz, 1.0, soz * casa, false, Vector2.ZERO),
		"chao-soz-300": mesa_g._vista(cfg_g, 0, o_soz, 3.0, soz * casa * 3.0, false, Vector2.ZERO),
	}
	await _quadros(2)
	for nome in vistas:
		var img: Image = await _ler_viewport(vistas[nome])
		vistas[nome].queue_free()
		if img == null:
			erros.append("%s: a placa de vídeo devolveu a imagem vazia ou preta %d vezes" % [nome, LEITURAS])
			continue
		img.convert(Image.FORMAT_RGB8)
		img.save_png(paineis.path_join(nome + ".png"))
	mesa_g.queue_free()
	if not erros.is_empty():
		return {"ok": false, "erros": erros, "resumo": {}}
	var raiz := Contrato.raiz_do_repo()
	var esbuild := raiz.path_join("node_modules/esbuild/bin/esbuild")
	var build := ProjectSettings.globalize_path("res://ferramentas/.build")
	if not sem_atual:
		var mjs := build.path_join("atual.mjs")
		var saida_cmd := []
		var c := OS.execute("node", [esbuild, ProjectSettings.globalize_path("res://ferramentas/atual.ts"), "--bundle", "--platform=node", "--format=esm", "--log-level=warning", "--outfile=" + mjs], saida_cmd, true)
		if c == 0:
			saida_cmd = []
			c = OS.execute("node", [mjs, "--id=grama", "--saida=" + paineis.path_join("atual-chao"), "--casas=%d" % CASAS], saida_cmd, true)
		if c != 0:
			print("  Atual: a grama de hoje não saiu (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
	var f := FileAccess.open(paineis.path_join("cena.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify({"casas": CASAS, "soz": {"x0": SOZ_X0, "y0": SOZ_Y0, "casas": soz}}))
	f.close()
	# 2. Os painéis, no navegador.
	var pagina := build.path_join("carimbo_pagina.js")
	var driver := build.path_join("carimbo.mjs")
	var cmds := [
		[esbuild, ProjectSettings.globalize_path("res://ferramentas/carimbo_pagina.ts"), "--bundle", "--platform=browser", "--format=iife", "--log-level=warning", "--outfile=" + pagina],
		[esbuild, ProjectSettings.globalize_path("res://ferramentas/carimbo.ts"), "--bundle", "--platform=node", "--format=esm", "--packages=external", "--log-level=warning", "--outfile=" + driver],
	]
	for argv in cmds:
		var saida_b := []
		if OS.execute("node", argv, saida_b, true) != 0:
			erros.append("o esbuild falhou: %s" % "".join(saida_b).strip_edges())
			return {"ok": false, "erros": erros, "resumo": {}}
	var argv_d := [driver, "--textura=" + pasta_exportada, "--paineis=" + paineis, "--pagina=" + pagina]
	if sem_atual:
		argv_d.append("--sem-atual")
	var saida_d := []
	var cd := OS.execute("node", argv_d, saida_d, true)
	var texto := "".join(saida_d).strip_edges()
	if cd != 0:
		erros.append("ferramentas/carimbo.ts falhou (%d): %s" % [cd, texto])
		return {"ok": false, "erros": erros, "resumo": {}}
	print("  ", texto)
	var p = JSON.parse_string(FileAccess.get_file_as_string(paineis.path_join("paineis.json")))
	if typeof(p) != TYPE_DICTIONARY:
		erros.append("paineis.json não saiu")
		return {"ok": false, "erros": erros, "resumo": {}}
	var params = JSON.parse_string(FileAccess.get_file_as_string(pasta_exportada.path_join(Contrato.ARQUIVO_DE_PARAMETROS)))
	var resumo := {
		"id": cfg["id"], "nome": cfg["nome"], "tipo": cfg["tipo"], "onda": cfg["onda"], "lote": cfg["lote"], "idDoApp": cfg["idDoApp"],
		"paineis": p,
		"memoria": params.get("memoria", {}) if typeof(params) == TYPE_DICTIONARY else {},
		"sombra": params.get("sombra", {}) if typeof(params) == TYPE_DICTIONARY else {},
		"atual": {"ok": p.get("atual", false), "motivo": p.get("motivoAtual", "")},
	}
	# 3. As peças da folha do lote e a folha.
	var b_des := _ler(paineis, "bosque-desenhado-100.png")
	_escala(b_des, 0.5).save_png(prova.path_join("area50.png"))
	_escala(b_des, 0.25).save_png(prova.path_join("area25.png"))
	_ler(paineis, "soz-desenhado-300.png").save_png(prova.path_join("perto300.png"))
	if p.get("atual", false):
		var b_at := _ler(paineis, "bosque-atual-100.png")
		_escala(b_at, 0.5).save_png(prova.path_join("atual-area50.png"))
		_escala(b_at, 0.25).save_png(prova.path_join("atual-area25.png"))
		_ler(paineis, "soz-atual-300.png").save_png(prova.path_join("atual-perto300.png"))
	var fr := FileAccess.open(prova.path_join("resumo.json"), FileAccess.WRITE)
	fr.store_string(JSON.stringify(resumo, "  "))
	fr.close()
	var folha: Image = await _folha(cfg, p, resumo, paineis, soz)
	if folha == null:
		erros.append("a folha saiu preta %d vezes (a placa de vídeo não desenhou)" % LEITURAS)
	elif folha.save_png(prova.path_join("folha.png")) != OK:
		erros.append("não consegui salvar %s" % prova.path_join("folha.png"))
	return {"ok": erros.is_empty(), "erros": erros, "resumo": resumo}


## O lado do quadrado do objeto sozinho, em casas: cabe a imagem inteira, com folga.
static func _casas_do_sozinho(cfg: Dictionary) -> int:
	if cfg["tipo"] != "carimbo":
		return 6
	var sp: Dictionary = cfg["sprite"]
	var unidade: float = ContratoCarimbo.unidade_no_mapa_ref(cfg["tamanhoDoApp"]) if cfg["destino"] == "carimbo" else float(Contrato.CASA_PX)
	var casas := float(sp["ladoPx"]) / float(sp["unidadePx"]) * unidade / Contrato.CASA_PX
	return clampi(ceili(casas + 0.4), 2, 6)


## Lê o viewport; se a placa devolver vazio, de uma cor só ou preto, espera e lê de novo.
func _ler_viewport(vp: SubViewport) -> Image:
	for tentativa in LEITURAS:
		var img := vp.get_texture().get_image()
		if img != null and not img.is_empty() and not _sem_desenho(img):
			return img
		await _quadros(2)
	return null


## Uma cor só (a placa não desenhou, ou desenhou só o fundo).
static func _sem_desenho(img: Image) -> bool:
	var a := img.get_pixel(0, 0)
	for y in range(0, img.get_height(), 7):
		for x in range(0, img.get_width(), 7):
			var b := img.get_pixel(x, y)
			if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) > 0.004:
				return false
	return true


static func _preta(img: Image) -> bool:
	for y in range(0, img.get_height(), 11):
		for x in range(0, img.get_width(), 11):
			var b := img.get_pixel(x, y)
			if b.r + b.g + b.b > 0.01:
				return false
	return true


static func _ler(pasta: String, nome: String) -> Image:
	var img := Image.load_from_file(pasta.path_join(nome))
	if img == null or img.is_empty():
		img = Image.create(8, 8, false, Image.FORMAT_RGB8)
	img.convert(Image.FORMAT_RGB8)
	return img


## Reduz como a placa de vídeo com mipmap faria (Lanczos é o mais perto numa imagem só).
static func _escala(img: Image, k: float) -> Image:
	var r := img.duplicate() as Image
	r.resize(maxi(1, int(round(img.get_width() * k))), maxi(1, int(round(img.get_height() * k))), Image.INTERPOLATE_LANCZOS)
	return r


func _folha(cfg: Dictionary, p: Dictionary, resumo: Dictionary, paineis: String, soz: int) -> Image:
	var tem_atual: bool = p.get("atual", false)
	var lado := soz * Contrato.CASA_PX
	var n_formas := int(p.get("formas", 2))
	var x_300 := MG + lado / 4 + MG + lado / 2 + MG + lado + MG
	var larg_soz := x_300 + lado * 3 + MG
	var larg_formas := MG + maxi(n_formas, 8) * (lado + MG)
	var area := CASAS * Contrato.CASA_PX
	var larg_bosque := MG + area / 2 + MG + area / 2 + MG
	var largura := maxi(maxi(larg_soz, larg_formas), larg_bosque)
	var topo := 136
	var linha_soz := 34 + lado * 3 + 40
	var y_formas := topo + 40 + linha_soz * (2 if tem_atual else 1)
	var linha_formas := 30 + lado + 36
	var y_bosque := y_formas + 40 + linha_formas * (2 if tem_atual else 1)
	var y_bosque2 := y_bosque + 40 + 30 + area / 2 + 30
	var recorte := RECORTE_CASAS * Contrato.CASA_PX
	var altura := y_bosque2 + 30 + maxi(area / 4, recorte) + MG
	var vp := SubViewport.new()
	vp.size = Vector2i(largura, mini(altura, BANDA))
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(largura, altura)
	vp.add_child(fundo)
	var mem: Dictionary = resumo["memoria"]
	var som: Dictionary = resumo["sombra"]
	_rotulo(vp, "%s  ·  %s  ·  Desenhado, onda %d, lote %d  ·  tipo %s, no app: %s" % [cfg["nome"], cfg["id"], cfg["onda"], cfg["lote"], cfg["tipo"], cfg["idDoApp"]], Vector2(MG, 16), 28, COR_TINTA)
	var info := "Contrato v%d, seção 9  ·  memória: %.2f de %.2f MiB na placa (o Atual de hoje), %.2f de %.2f MiB em disco  ·  %s formas  ·  sombra %s (desloca %.2f, borrão %.3f do tamanho, alfa %.2f)" % [Contrato.VERSAO, mem.get("gpuBytes", 0) / 1048576.0, ContratoCarimbo.TETO_GPU_POR_CARIMBO / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, ContratoCarimbo.TETO_DISCO_POR_CARIMBO / 1048576.0, str(n_formas), som.get("jeito", "?"), float(som.get("deslocamento", 0)), float(som.get("borrao", 0)), float(som.get("alfa", 0))]
	if som.get("jeito", "") == "em-pe":
		info = "Contrato v%d, seção 9  ·  memória: %.2f de %.2f MiB na placa (o Atual de hoje), %.2f de %.2f MiB em disco  ·  %s formas  ·  sombra em pé (deitada %.2f da altura, borrão %.3f do tamanho, alfa %.2f)" % [Contrato.VERSAO, mem.get("gpuBytes", 0) / 1048576.0, ContratoCarimbo.TETO_GPU_POR_CARIMBO / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, ContratoCarimbo.TETO_DISCO_POR_CARIMBO / 1048576.0, str(n_formas), float(som.get("comprimento", 0)), float(som.get("borrao", 0)), float(som.get("alfa", 0))]
	_rotulo(vp, info, Vector2(MG, 58), 17, COR_TINTA_2)
	var c_at = p.get("centroDoAtual", null)
	var sob := "Mapa de referência 200 x 200 casas: o tamanho 100%% dá %.1f px do mundo (%.2f casas).\nMontado no Canvas 2D (o motor dos carimbos de hoje): o Desenhado pela conta do contrato, o Atual com o assarDesenho do app; os mesmos %d objetos, soltos pelo spray do app." % [float(p.get("tamanhoNoMapaRefPx", 0)), float(p.get("tamanhoNoMapaRefPx", 0)) / Contrato.CASA_PX, int(p.get("objetos", 0))]
	if typeof(c_at) == TYPE_DICTIONARY:
		sob += "  Centro do Atual: %+.2f, %+.2f unidades do pé (raio %.2f)." % [float(c_at["x"]), float(c_at["y"]), float(c_at["raio"])]
	if not tem_atual:
		sob += "  Atual: " + str(p.get("motivoAtual", "não pintado"))
	_rotulo(vp, sob, Vector2(MG, 80), 15, COR_TINTA_3)
	# O objeto sozinho.
	_rotulo(vp, "Sozinho (a forma 1) a 25%, 50%, 100% e 300%", Vector2(MG, topo), 22, COR_TINTA)
	var linhas_soz := [["Desenhado", "soz-desenhado"]]
	if tem_atual:
		linhas_soz.append(["Atual", "soz-atual"])
	for i in linhas_soz.size():
		var y: int = topo + 40 + i * linha_soz
		var base := _ler(paineis, linhas_soz[i][1] + "-100.png")
		_rotulo(vp, linhas_soz[i][0], Vector2(MG, y), 17, COR_TINTA_2)
		var x := MG
		for k in [0.25, 0.5, 1.0]:
			_imagem(vp, _escala(base, k) if k < 1.0 else base, Vector2(x, y + 30))
			x += int(lado * k) + MG
		_imagem(vp, _ler(paineis, linhas_soz[i][1] + "-300.png"), Vector2(x, y + 30))
	# As formas.
	_rotulo(vp, str(p.get("tituloFormas", "As formas: o giro do mestre de 45 em 45 graus (o Desenhado: o arquivo e o espelho diagonal; a imagem não gira), a 100%")), Vector2(MG, y_formas), 22, COR_TINTA)
	for i in (2 if tem_atual else 1):
		var y: int = y_formas + 40 + i * linha_formas
		var prefixo := "forma-" if i == 0 else "atual-forma-"
		var quantas := n_formas if i == 0 else 8
		_rotulo(vp, "Desenhado" if i == 0 else "Atual (8 desenhos assados, um a cada 45 graus)", Vector2(MG, y), 17, COR_TINTA_2)
		for k in quantas:
			_imagem(vp, _ler(paineis, "%s%d.png" % [prefixo, k]), Vector2(MG + k * (lado + MG), y + 30))
	# O bosque.
	_rotulo(vp, str(p.get("tituloBosque", "Espalhado pelo spray do app (densidade 0,5, 1 e 0,35; tamanhos de 60 a 160%) sobre a grama: procure a mesma árvore repetida e bolinha")), Vector2(MG, y_bosque), 22, COR_TINTA)
	var b_des := _ler(paineis, "bosque-desenhado-100.png")
	var b_at: Image = _ler(paineis, "bosque-atual-100.png") if tem_atual else null
	_rotulo(vp, "Desenhado a 50% (24 x 24 casas)", Vector2(MG, y_bosque + 40), 17, COR_TINTA_2)
	_imagem(vp, _escala(b_des, 0.5), Vector2(MG, y_bosque + 70))
	if b_at != null:
		_rotulo(vp, "Atual a 50% (a grama de hoje)", Vector2(MG + area / 2 + MG, y_bosque + 40), 17, COR_TINTA_2)
		_imagem(vp, _escala(b_at, 0.5), Vector2(MG + area / 2 + MG, y_bosque + 70))
	var x2 := MG
	var pecas := [["Desenhado a 25%", _escala(b_des, 0.25)], ["Desenhado a 100% (recorte de 8 x 8 casas, a mata fechada)", b_des.get_region(Rect2i(14 * 64, 13 * 64, recorte, recorte))]]
	if b_at != null:
		pecas.insert(1, ["Atual a 25%", _escala(b_at, 0.25)])
		pecas.append(["Atual a 100%", b_at.get_region(Rect2i(14 * 64, 13 * 64, recorte, recorte))])
	for peca in pecas:
		var img: Image = peca[1]
		_rotulo(vp, peca[0], Vector2(x2, y_bosque2), 17, COR_TINTA_2)
		_imagem(vp, img, Vector2(x2, y_bosque2 + 30))
		x2 += img.get_width() + MG
	add_child(vp)
	var folha := Image.create(largura, altura, false, Image.FORMAT_RGB8)
	var y0 := 0
	while y0 < altura:
		vp.canvas_transform = Transform2D(0.0, Vector2(0.0, -float(y0)))
		var faixa: Image = null
		for tentativa in LEITURAS:
			await _quadros(2)
			faixa = vp.get_texture().get_image()
			if faixa != null and not faixa.is_empty() and not _preta(faixa):
				break
			faixa = null
		if faixa == null:
			vp.queue_free()
			return null
		faixa.convert(Image.FORMAT_RGB8)
		var h := mini(BANDA, altura - y0)
		folha.blit_rect(faixa, Rect2i(0, 0, largura, h), Vector2i(0, y0))
		y0 += BANDA
	vp.queue_free()
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


## Espera n quadros desenhados. Se a placa não desenhar em 3 s (já aconteceu: a fila ficou
## presa até o limite de 180 s), força um quadro em vez de esperar para sempre.
func _quadros(n: int) -> void:
	for i in n:
		var feito := [false]
		var marcar := func() -> void: feito[0] = true
		RenderingServer.frame_post_draw.connect(marcar, CONNECT_ONE_SHOT)
		var t0 := Time.get_ticks_msec()
		while not feito[0]:
			await get_tree().process_frame
			if not feito[0] and Time.get_ticks_msec() - t0 > 3000:
				printerr("  aviso: a placa não desenhou em 3 s; forçando um quadro")
				RenderingServer.force_draw(true, 0.0)
				t0 = Time.get_ticks_msec()

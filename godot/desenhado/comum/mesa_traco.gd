extends Node
## A mesa de prova de um traço (onda 5, CONTRATO.md seção 11.9). A montagem é a de
## ferramentas/traco.ts, com a geometria do próprio app (geosDoBarranco); ela grava os
## painéis a 100% e os recortes a 300% (ferramentas/mesa_traco.ts), e esta mesa pinta antes
## o chão (a grama aprovada, pela mesa do chão) e depois arruma a folha, a 25%, 50%, 100% e
## 300%, com o Atual (o barranco liso do Meio-Termo, pixi/drawBarranco.ts) ao lado.

const Contrato := preload("res://comum/contrato.gd")
const Mesa := preload("res://comum/mesa.gd")

const MG := 28
const LARGURA := 2 * 1024 + 3 * MG
const BANDA := 2048
const LEITURAS := 4
const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")

var _itens: Array = []
var _y := 0


func montar(cfg: Dictionary, pasta_exportada: String, prova: String, args: Dictionary) -> Dictionary:
	var erros: Array[String] = []
	var paineis := prova.path_join("paineis")
	DirAccess.make_dir_recursive_absolute(paineis)
	# 1. O pacote da mesa (o client da main, só leitura) e o plano dos chões.
	var construir := ProjectSettings.globalize_path("res://ferramentas/construir.mjs")
	var entrada := ProjectSettings.globalize_path("res://ferramentas/mesa_traco.ts")
	var mjs := ProjectSettings.globalize_path("res://ferramentas/.build/mesa_traco.mjs")
	var saida_cmd := []
	var c := OS.execute("node", [construir, entrada, mjs], saida_cmd, true)
	if c != 0:
		erros.append("ferramentas/construir.mjs falhou (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
		return {"ok": false, "erros": erros}
	saida_cmd = []
	c = OS.execute("node", [mjs, "--plano=" + paineis.path_join("plano.json")], saida_cmd, true)
	var plano = JSON.parse_string(FileAccess.get_file_as_string(paineis.path_join("plano.json")))
	if c != 0 or typeof(plano) != TYPE_DICTIONARY:
		erros.append("o plano dos chões não saiu (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
		return {"ok": false, "erros": erros}
	# 2. Os chões: a grama aprovada, montada como o app monta (comum/compor.gdshader).
	var lido := Contrato.ler_config("grama")
	if not lido["ok"]:
		erros.append("a grama aprovada (texturas/grama/config.json) não leu")
		return {"ok": false, "erros": erros}
	var mesa_c := Mesa.new()
	add_child(mesa_c)
	if not mesa_c._carregar(lido["config"], ProjectSettings.globalize_path("res://exportado/grama"), erros):
		return {"ok": false, "erros": erros}
	var vistas := {}
	for ch in plano["chaos"]:
		vistas[ch["nome"]] = mesa_c._vista(lido["config"], 0, Vector2(ch["origem"][0], ch["origem"][1]), float(ch["zoom"]), float(ch["lado"]), false, Vector2.ZERO)
	await _quadros(2)
	for nome in vistas:
		var img: Image = await _ler_viewport(vistas[nome])
		vistas[nome].queue_free()
		if img == null:
			erros.append("%s: a placa de vídeo devolveu a imagem vazia" % nome)
			continue
		img.convert(Image.FORMAT_RGBA8)
		img.save_png(paineis.path_join(nome + ".png"))
	mesa_c.queue_free()
	if not erros.is_empty():
		return {"ok": false, "erros": erros}
	# 3. Os painéis.
	var argv := [mjs, "--textura=" + pasta_exportada, "--exportado=" + ProjectSettings.globalize_path("res://exportado"), "--saida=" + paineis]
	if args.has("sem-atual"):
		argv.append("--sem-atual")
	saida_cmd = []
	c = OS.execute("node", argv, saida_cmd, true)
	var texto := "".join(saida_cmd).strip_edges()
	if c != 0:
		erros.append("ferramentas/mesa_traco.ts falhou (%d): %s" % [c, texto])
		return {"ok": false, "erros": erros}
	print("  ", texto)
	var p = JSON.parse_string(FileAccess.get_file_as_string(paineis.path_join("paineis.json")))
	var params = JSON.parse_string(FileAccess.get_file_as_string(pasta_exportada.path_join(Contrato.ARQUIVO_DE_PARAMETROS)))
	if typeof(p) != TYPE_DICTIONARY or typeof(params) != TYPE_DICTIONARY:
		erros.append("paineis.json ou textura.json não leu")
		return {"ok": false, "erros": erros}
	var tem_atual: bool = p["atual"]
	# As peças da folha do lote.
	var formas := _ler(paineis, "formas-desenhado-100.png")
	_escala(formas, 0.5).save_png(prova.path_join("area50.png"))
	_ler(paineis, "perto-quina-desenhado-300.png").save_png(prova.path_join("perto300.png"))
	_escala(_ler(paineis, "familia-desenhado-100.png"), 0.5).save_png(prova.path_join("familia50.png"))
	if tem_atual:
		_escala(_ler(paineis, "formas-atual-100.png"), 0.5).save_png(prova.path_join("atual-area50.png"))
		_ler(paineis, "perto-quina-atual-300.png").save_png(prova.path_join("atual-perto300.png"))
	var resumo := {"id": cfg["id"], "nome": cfg["nome"], "tipo": "traco", "parte": cfg["parte"], "onda": cfg["onda"], "lote": cfg["lote"], "memoria": params.get("memoria", {}), "atual": {"ok": tem_atual}, "avisos": p["avisos"], "face": p["face"], "borda": p["borda"], "modulosCasas": p["modulosCasas"]}
	var f := FileAccess.open(prova.path_join("resumo.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(resumo, "  "))
	f.close()
	var folha: Image = await _folha(cfg, p, params, paineis, pasta_exportada, tem_atual)
	if folha.save_png(prova.path_join("folha.png")) != OK:
		erros.append("não consegui salvar a folha")
	return {"ok": erros.is_empty(), "erros": erros, "resumo": resumo}


func _texto(t: String, tamanho: int, cor: Color = COR_TINTA, x := MG, avancar := -1) -> void:
	_itens.append({"t": t, "x": x, "y": _y, "tam": tamanho, "cor": cor})
	_y += (tamanho + 14) if avancar < 0 else avancar


func _img(img: Image, x: int, y: int) -> void:
	_itens.append({"img": img, "x": x, "y": y})


## Uma fileira de imagens com rótulo em cima de cada uma; devolve a altura usada.
func _fila(imgs: Array, rotulos: Array) -> void:
	var x := MG
	var h := 0
	for i in imgs.size():
		var img: Image = imgs[i]
		_itens.append({"t": rotulos[i], "x": x, "y": _y, "tam": 15, "cor": COR_TINTA_2})
		_img(img, x, _y + 24)
		x += img.get_width() + MG
		h = maxi(h, img.get_height())
	_y += 24 + h + 26


func _folha(cfg: Dictionary, p: Dictionary, params: Dictionary, paineis: String, exportado: String, tem_atual: bool) -> Image:
	_itens.clear()
	_y = 16
	var mem: Dictionary = params.get("memoria", {})
	_texto("%s  ·  %s  ·  Desenhado, onda %d, lote %d  ·  traço, parte %s" % [cfg["nome"], cfg["id"], cfg["onda"], cfg["lote"], cfg["parte"]], 28)
	var info := "Contrato v%d, seção 11  ·  memória %.2f de %.1f MiB, %.2f de %.2f MiB em disco  ·  face %s, borda %s%s" % [Contrato.VERSAO, mem.get("memoriaBytes", 0) / 1048576.0, mem.get("tetoMemoriaBytes", 0) / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, mem.get("tetoDiscoBytes", 0) / 1048576.0, p["face"], p["borda"], "" if p["bordaExportada"] else " (ainda não exportada)"]
	if params.has("face"):
		info += "  ·  módulos %s casas, costura %s/255" % [str(p["modulosCasas"]), str(params["face"]["costura"]["maior"])]
	_texto(info, 17, COR_TINTA_2)
	_texto("Geometria do app (geosDoBarranco, client da main): a beira, a normal para o lado baixo e a espessura (Baixo 20, Médio 32, Alto 48 px virado para o sul; 36% de lado e de costas). Grama aprovada por baixo. Atual: o barranco liso do Meio-Termo (pixi/drawBarranco.ts) na mesma geometria.", 15, COR_TINTA_3)
	if not p["avisos"].is_empty():
		_texto("Avisos: " + "; ".join(PackedStringArray(p["avisos"])), 15, COR_TINTA_2)
	_y += 10
	var fd := _ler(paineis, "formas-desenhado-100.png")
	var fa: Image = _ler(paineis, "formas-atual-100.png") if tem_atual else null
	_texto("As formas a 100%: a reta, a curva suave, a quina de 90 graus e o S, nas 3 alturas (Baixo, Médio, Alto, de cima para baixo)", 22)
	_fila([fd], ["Desenhado"])
	if fa != null:
		_fila([fa], ["Atual"])
	_texto("A 50% e a 25%", 22)
	var l50: Array = [_escala(fd, 0.5)]
	var r50: Array = ["Desenhado a 50%"]
	if fa != null:
		l50.append(_escala(fa, 0.5))
		r50.append("Atual a 50%")
	_fila(l50, r50)
	var l25: Array = [_escala(fd, 0.25)]
	var r25: Array = ["Desenhado a 25%"]
	if fa != null:
		l25.append(_escala(fa, 0.25))
		r25.append("Atual a 25%")
	_fila(l25, r25)
	_texto("O paredão: 38 casas de Alto e de Baixo a 50% (procure a repetição dos módulos)", 22)
	_fila([_escala(_ler(paineis, "paredao-desenhado-100.png"), 0.5)], ["Desenhado"])
	if tem_atual:
		_fila([_escala(_ler(paineis, "paredao-atual-100.png"), 0.5)], ["Atual"])
	_texto("A 300%", 22)
	for perto in p["pertos"]:
		var imgs: Array = [_ler(paineis, "perto-%s-desenhado-300.png" % perto["nome"])]
		var rot: Array = ["Desenhado, %s" % perto["titulo"]]
		if tem_atual:
			imgs.append(_ler(paineis, "perto-%s-atual-300.png" % perto["nome"]))
			rot.append("Atual")
		_fila(imgs, rot)
	_texto("A família: o morro (platô Médio com o alto em Alto, e um barranco Baixo) na grama aprovada, com as árvores, as pedras e o tronco da onda 3 e a cerca e o poço da onda 4", 22)
	var famd := _ler(paineis, "familia-desenhado-100.png")
	var famimgs: Array = [famd]
	var famrot: Array = ["Desenhado a 100%"]
	if tem_atual:
		famimgs.append(_ler(paineis, "familia-atual-100.png"))
		famrot.append("Atual (o barranco de hoje; os objetos Desenhados)")
	_fila(famimgs, famrot)
	var fam50: Array = [_escala(famd, 0.5)]
	var fam50r: Array = ["Desenhado a 50%"]
	if tem_atual:
		fam50.append(_escala(famimgs[1], 0.5))
		fam50r.append("Atual a 50%")
	_fila(fam50, fam50r)
	_texto("Arquivos (sobre xadrez; o relevo em cor: vermelho = ao longo, verde = para baixo)", 22)
	if params.has("alturas"):
		for alt in ["baixo", "medio", "alto"]:
			var a: Dictionary = params["alturas"][alt]["arquivos"]
			var cor := _sobre_xadrez(_ler(exportado, a["cor"]))
			var rel := _ler(exportado, a["relevo"])
			if cor.get_width() > LARGURA - 2 * MG:
				cor = _escala(cor, float(LARGURA - 2 * MG) / cor.get_width())
				rel = _escala(rel, float(LARGURA - 2 * MG) / rel.get_width())
			_fila([cor], [a["cor"]])
			_fila([rel], [a["relevo"]])
	if params.has("borda") and typeof(params["borda"]) == TYPE_DICTIONARY:
		var b := _sobre_xadrez(_ler(exportado, params["borda"]["arquivo"]))
		_fila([b], ["%s (as linhas: %s)" % [params["borda"]["arquivo"], ", ".join(PackedStringArray(params["borda"]["linhas"].map(func(l): return l["nome"])))]])
	var altura := _y + 20
	var vp := SubViewport.new()
	vp.size = Vector2i(LARGURA, mini(altura, BANDA))
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(LARGURA, altura)
	vp.add_child(fundo)
	for it in _itens:
		if it.has("img"):
			var tr := TextureRect.new()
			tr.texture = ImageTexture.create_from_image(it["img"])
			tr.position = Vector2(it["x"], it["y"])
			vp.add_child(tr)
		else:
			var l := Label.new()
			l.text = it["t"]
			l.position = Vector2(it["x"], it["y"])
			l.add_theme_font_size_override("font_size", it["tam"])
			l.add_theme_color_override("font_color", it["cor"])
			vp.add_child(l)
	add_child(vp)
	var folha := Image.create(LARGURA, altura, false, Image.FORMAT_RGB8)
	var y0 := 0
	while y0 < altura:
		vp.canvas_transform = Transform2D(0.0, Vector2(0.0, -float(y0)))
		await _quadros(2)
		var faixa := vp.get_texture().get_image()
		faixa.convert(Image.FORMAT_RGB8)
		folha.blit_rect(faixa, Rect2i(0, 0, LARGURA, mini(BANDA, altura - y0)), Vector2i(0, y0))
		y0 += BANDA
	vp.queue_free()
	return folha


static func _sobre_xadrez(img: Image) -> Image:
	var r := Image.create(img.get_width(), img.get_height(), false, Image.FORMAT_RGBA8)
	for y in img.get_height():
		for x in img.get_width():
			var claro := ((x >> 3) + (y >> 3)) % 2 == 0
			r.set_pixel(x, y, Color(0.36, 0.36, 0.36) if claro else Color(0.28, 0.28, 0.28))
	r.blend_rect(img, Rect2i(0, 0, img.get_width(), img.get_height()), Vector2i.ZERO)
	return r


static func _ler(pasta: String, nome: String) -> Image:
	var img := Image.load_from_file(pasta.path_join(nome))
	if img == null or img.is_empty():
		img = Image.create(8, 8, false, Image.FORMAT_RGB8)
	return img


static func _escala(img: Image, k: float) -> Image:
	var r := img.duplicate() as Image
	r.resize(maxi(1, int(round(img.get_width() * k))), maxi(1, int(round(img.get_height() * k))), Image.INTERPOLATE_LANCZOS)
	return r


func _ler_viewport(vp: SubViewport) -> Image:
	for tentativa in LEITURAS:
		var img := vp.get_texture().get_image()
		if img != null and not img.is_empty():
			var a := img.get_pixel(0, 0)
			var b := img.get_pixel(img.get_width() / 2, img.get_height() / 2)
			if not (a.is_equal_approx(b) and a.r < 0.01):
				return img
		await _quadros(2)
	return null


func _quadros(n: int) -> void:
	for i in n:
		var feito := [false]
		var marcar := func() -> void: feito[0] = true
		RenderingServer.frame_post_draw.connect(marcar, CONNECT_ONE_SHOT)
		var t0 := Time.get_ticks_msec()
		while not feito[0]:
			await get_tree().process_frame
			if not feito[0] and Time.get_ticks_msec() - t0 > 3000:
				RenderingServer.force_draw(true, 0.0)
				t0 = Time.get_ticks_msec()

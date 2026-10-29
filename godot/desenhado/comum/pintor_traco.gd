extends Node
## Pinta os arquivos de um traço com o textura.gdshader dele (CONTRATO.md, seção 11):
##   face:  face-<altura>.png (a cor, RGBA) e face-<altura>-relevo.png, os módulos lado a
##          lado, cada um com a folga de FOLGA_PX px do mundo antes e depois;
##   borda: borda.png, as linhas uma embaixo da outra, cada uma repetindo a cada L.

const Contrato := preload("res://comum/contrato.gd")
const ContratoTraco := preload("res://comum/contrato_traco.gd")

const LEITURAS := 4


## Devolve {"ok", "erros", "arquivos", "imagens", "modulos", "tamanhos", "costura", "corMedia", "linhaPx"}.
func pintar(cfg: Dictionary, pasta: String) -> Dictionary:
	var r := {"ok": false, "erros": [] as Array[String], "arquivos": [] as Array[String], "imagens": {}, "modulos": [], "tamanhos": {}, "costura": {}, "corMedia": "", "linhaPx": 0}
	var caminho_shader := "res://texturas/%s/textura.gdshader" % cfg["id"]
	if not ResourceLoader.exists(caminho_shader):
		r["erros"].append("não achei %s" % caminho_shader)
		return r
	var shader := load(caminho_shader) as Shader
	DirAccess.make_dir_recursive_absolute(pasta)
	if cfg["parte"] == "face":
		await _pintar_face(cfg, shader, pasta, r)
	else:
		await _pintar_borda(cfg, shader, pasta, r)
	r["ok"] = r["erros"].is_empty()
	return r


func _pintar_face(cfg: Dictionary, shader: Shader, pasta: String, r: Dictionary) -> void:
	var mods: Array = cfg["face"]["modulosCasas"]
	var pedidos := []
	for ia in ContratoTraco.ALTURAS.size():
		var alt: String = ContratoTraco.ALTURAS[ia]
		for k in mods.size():
			var tam := ContratoTraco.tamanho_do_modulo(mods[k], alt, cfg)
			for modo in [0, 1]:
				var u := {"traco_alt": ia, "traco_h": ContratoTraco.H_PX[alt], "traco_modulo": k, "traco_l": float(mods[k]) * Contrato.CASA_PX,
					"traco_acima": cfg["face"]["acimaPx"], "traco_abaixo": cfg["face"]["abaixoPx"], "traco_folga": ContratoTraco.FOLGA_PX}
				pedidos.append({"alt": alt, "k": k, "modo": modo, "vp": _viewport(shader, cfg, modo, tam, u)})
	await _quadros(2)
	var pecas := {}
	for p in pedidos:
		var img := await _ler(p["vp"], p["modo"] == 1)
		p["vp"].queue_free()
		if img == null:
			r["erros"].append("face %s, módulo %d, modo %d: a placa não devolveu a imagem ou ela saiu de uma cor só (o shader compilou?)" % [p["alt"], p["k"], p["modo"]])
			continue
		pecas["%s-%d-%d" % [p["alt"], p["k"], p["modo"]]] = img
	if not r["erros"].is_empty():
		return
	# Os módulos lado a lado; o x de onde começa o conteúdo de cada um.
	var folga := int(ContratoTraco.FOLGA_PX * ContratoTraco.PX_POR_MUNDO)
	var x := 0
	for k in mods.size():
		var w := ContratoTraco.tamanho_do_modulo(mods[k], "baixo", cfg).x
		r["modulos"].append({"casas": mods[k], "comprimentoPx": float(mods[k]) * Contrato.CASA_PX, "xPx": x + folga, "larguraPx": w - 2 * folga})
		x += w
	var pior := 0.0
	var pior_relevo := 0.0
	for alt in ContratoTraco.ALTURAS:
		var h := ContratoTraco.tamanho_do_modulo(mods[0], alt, cfg).y
		r["tamanhos"][alt] = [x, h]
		for modo in [0, 1]:
			var img := Image.create(x, h, false, Image.FORMAT_RGBA8)
			var x0 := 0
			for k in mods.size():
				var peca: Image = pecas["%s-%d-%d" % [alt, k, modo]]
				img.blit_rect(peca, Rect2i(0, 0, peca.get_width(), h), Vector2i(x0, 0))
				x0 += peca.get_width()
			var nome := "face-%s.png" % alt if modo == 0 else "face-%s-relevo.png" % alt
			if modo == 0:
				img.fix_alpha_edges()
			var destino := pasta.path_join(nome)
			if img.save_png(destino) != OK:
				r["erros"].append("%s: erro ao salvar" % destino)
				continue
			r["arquivos"].append(destino)
			r["imagens"][nome] = img
			# A costura: a primeira e a última coluna de cada módulo contra a primeira do módulo 0.
			var ref_x: int = r["modulos"][0]["xPx"]
			for m in r["modulos"]:
				for cx in [int(m["xPx"]), int(m["xPx"]) + int(m["larguraPx"]) - 1]:
					for y in h:
						var a := img.get_pixel(ref_x, y)
						var b := img.get_pixel(cx, y)
						var d := maxf(maxf(absf(a.r - b.r), absf(a.g - b.g)), maxf(absf(a.b - b.b), absf(a.a - b.a)))
						if modo == 0:
							pior = maxf(pior, d)
						else:
							pior = maxf(pior, d)
							pior_relevo = maxf(pior_relevo, absf(b.r - 128.0 / 255.0))
	r["costura"] = {"maior": snappedf(pior * 255.0, 0.01), "relevoX": snappedf(pior_relevo * 255.0, 0.01), "tetoEm255": 2}
	if pior > ContratoTraco.COSTURA_MAX + 1e-6:
		r["erros"].append("a costura dos módulos passou de 2/255 (deu %.1f/255): as pontas de todo módulo têm de ser a mesma coluna" % (pior * 255.0))
	if pior_relevo > ContratoTraco.COSTURA_MAX + 1e-6:
		r["erros"].append("o relevo ao longo na costura tem de ser 0 (deu %.1f/255): senão o espelho do módulo emenda torto" % (pior_relevo * 255.0))
	if r["imagens"].has("face-medio.png"):
		r["corMedia"] = "#" + _cor_media(r["imagens"]["face-medio.png"]).to_html(false)


func _pintar_borda(cfg: Dictionary, shader: Shader, pasta: String, r: Dictionary) -> void:
	var b: Dictionary = cfg["borda"]
	var L: float = b["comprimentoCasas"] * Contrato.CASA_PX
	var w := int(L * ContratoTraco.PX_POR_MUNDO)
	var h := int(roundf((b["acimaPx"] + b["abaixoPx"]) * ContratoTraco.PX_POR_MUNDO))
	r["linhaPx"] = h
	var pedidos := []
	for i in b["linhas"].size():
		var u := {"traco_l": L, "traco_acima": b["acimaPx"], "traco_abaixo": b["abaixoPx"], "traco_linha": i}
		pedidos.append(_viewport(shader, cfg, 2, Vector2i(w, h), u))
	await _quadros(2)
	var img := Image.create(w, h * pedidos.size(), false, Image.FORMAT_RGBA8)
	for i in pedidos.size():
		var peca := await _ler(pedidos[i], false)
		pedidos[i].queue_free()
		if peca == null:
			r["erros"].append("borda, linha %d: a placa não devolveu a imagem ou ela saiu de uma cor só" % i)
			continue
		img.blit_rect(peca, Rect2i(0, 0, w, h), Vector2i(0, i * h))
	if not r["erros"].is_empty():
		return
	img.fix_alpha_edges()
	r["tamanhos"]["borda"] = [w, h * pedidos.size()]
	var destino := pasta.path_join("borda.png")
	if img.save_png(destino) != OK:
		r["erros"].append("%s: erro ao salvar" % destino)
		return
	r["arquivos"].append(destino)
	r["imagens"]["borda.png"] = img
	# A emenda da borda (repete a cada L): o passo da última coluna para a primeira
	# contra o maior passo vizinho de dentro (a onda inclina, e isso não é emenda).
	var pior := 0.0
	for y in img.get_height():
		var passo := _passo(img.get_pixel(w - 1, y), img.get_pixel(0, y))
		var vizinho := maxf(_passo(img.get_pixel(0, y), img.get_pixel(1, y)), _passo(img.get_pixel(w - 2, y), img.get_pixel(w - 1, y)))
		pior = maxf(pior, passo - vizinho)
	r["costura"] = {"emendaDaBorda": snappedf(pior * 255.0, 0.01)}
	if pior > 3.0 / 255.0:
		r["erros"].append("a borda não emenda a cada %d casas (passo %.1f/255 acima do vizinho): as ondas têm de dar voltas inteiras em L" % [int(b["comprimentoCasas"]), pior * 255.0])


static func _passo(a: Color, c: Color) -> float:
	return absf(a.a - c.a) + (absf(a.r - c.r) + absf(a.g - c.g) + absf(a.b - c.b)) / 3.0 * maxf(a.a, c.a)


func _viewport(shader: Shader, cfg: Dictionary, modo: int, lado: Vector2i, u: Dictionary) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = lado
	vp.disable_3d = true
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var quadro := ColorRect.new()
	quadro.size = Vector2(lado)
	quadro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = shader
	m.set_shader_parameter("modo", modo)
	m.set_shader_parameter("semente", cfg["semente"])
	m.set_shader_parameter("traco_imagem", Vector2(lado))
	for k in u:
		m.set_shader_parameter(k, u[k])
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


func _ler(vp: SubViewport, relevo: bool) -> Image:
	var img: Image = null
	for tentativa in LEITURAS:
		img = vp.get_texture().get_image()
		if img != null and not img.is_empty() and (relevo or not _chapada(img)):
			break
		await _quadros(2)
	if img == null or img.is_empty() or (not relevo and _chapada(img)):
		return null
	img.convert(Image.FORMAT_RGBA8)
	return img


static func _cor_media(img: Image) -> Color:
	var soma := Vector3.ZERO
	var peso := 0.0
	for y in range(0, img.get_height(), 2):
		for x in range(0, img.get_width(), 2):
			var c := img.get_pixel(x, y)
			soma += Vector3(c.r, c.g, c.b) * c.a
			peso += c.a
	if peso <= 0.0:
		return Color(0, 0, 0)
	soma /= peso
	return Color(soma.x, soma.y, soma.z)


static func _chapada(img: Image) -> bool:
	var a := img.get_pixel(0, 0)
	for y in range(0, img.get_height(), 3):
		for x in range(0, img.get_width(), 3):
			var b := img.get_pixel(x, y)
			if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) + absf(a.a - b.a) > 0.004:
				return false
	return true


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

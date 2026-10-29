extends Node
## Exporta as texturas do estilo Desenhado em PNG.
##
## Cada textura é pintada pelo shader res://shaders/textura.gdshader num SubViewport
## do tamanho exato da imagem, com a coordenada = UV x período. Como todo ruído e todo
## sorteio do shader repetem a cada período, a imagem repete sem emenda.
## Também mede a emenda (diferença na borda contra a diferença no miolo) e monta uma
## folha de contato com cada textura repetida 2 x 2.

const SH_TEXTURA := preload("res://shaders/textura.gdshader")

const TEXTURAS := [
	{"arquivo": "grama", "material": 0, "nome": "Grama com tufos e flores"},
	{"arquivo": "terra", "material": 1, "nome": "Terra do caminho"},
	{"arquivo": "pedra", "material": 2, "nome": "Pedra da praça"},
	{"arquivo": "madeira", "material": 3, "nome": "Assoalho de tábuas"},
	{"arquivo": "telha", "material": 4, "nome": "Telha em escama"},
]

const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")
const COR_MARCA := Color("f0c98a")


## Pinta e salva as 5 texturas em `pasta`. `periodo` em px do mundo (múltiplo de 512),
## `escala` 1 = 64 px por casa, 2 = 128 px por casa. Devolve um resumo.
func exportar(pasta: String, periodo := 512, escala := 1, semente := 7) -> Dictionary:
	var inicio := Time.get_ticks_msec()
	var economia := OS.low_processor_usage_mode
	OS.low_processor_usage_mode = false
	var erros: Array[String] = []
	var arquivos: Array[String] = []
	var emendas := {}
	var imagens := {}
	var e_pasta := DirAccess.make_dir_recursive_absolute(pasta)
	if e_pasta != OK:
		erros.append("não consegui criar a pasta %s (erro %d)" % [pasta, e_pasta])
	else:
		var lado := periodo * escala
		var viewports := []
		for t in TEXTURAS:
			viewports.append(_viewport_da_textura(t["material"], periodo, lado, semente))
		# Dois quadros: o primeiro compila o shader e pinta, o segundo garante a leitura.
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		for i in TEXTURAS.size():
			var t: Dictionary = TEXTURAS[i]
			var vp: SubViewport = viewports[i]
			var img := vp.get_texture().get_image()
			vp.queue_free()
			if img == null or img.is_empty():
				erros.append("%s: a placa de vídeo não devolveu a imagem" % t["arquivo"])
				continue
			img.convert(Image.FORMAT_RGB8)
			var caminho := pasta.path_join("%s.png" % t["arquivo"])
			var e := img.save_png(caminho)
			if e != OK:
				erros.append("%s: erro %d ao salvar" % [caminho, e])
				continue
			arquivos.append(caminho)
			imagens[t["arquivo"]] = img
			emendas[t["arquivo"]] = medir_emenda(img)
	var folha: Image = null
	if imagens.size() == TEXTURAS.size():
		folha = await montar_folha(imagens, emendas)
		var caminho_folha := pasta.path_join("folha-de-contato.png")
		if folha.save_png(caminho_folha) == OK:
			arquivos.append(caminho_folha)
		else:
			erros.append("não consegui salvar a folha de contato")
	OS.low_processor_usage_mode = economia
	return {
		"ok": erros.is_empty(),
		"pasta": pasta,
		"arquivos": arquivos,
		"erros": erros,
		"emendas": emendas,
		"folha": folha,
		"ms": Time.get_ticks_msec() - inicio,
	}


func _viewport_da_textura(material_id: int, periodo: int, lado: int, semente: int) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = Vector2i(lado, lado)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var quadro := ColorRect.new()
	quadro.size = Vector2(lado, lado)
	quadro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = SH_TEXTURA
	m.set_shader_parameter("material_id", material_id)
	m.set_shader_parameter("periodo", float(periodo))
	m.set_shader_parameter("semente", semente)
	m.set_shader_parameter("no_mundo", false)
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


## Emenda: diferença média entre a última e a primeira coluna (e linha), dividida pela
## diferença média entre colunas vizinhas no miolo. Perto de 1 = sem emenda visível.
static func medir_emenda(img: Image) -> Dictionary:
	var w := img.get_width()
	var h := img.get_height()
	var borda := 0.0
	var miolo := 0.0
	var n_borda := 0
	var n_miolo := 0
	for y in range(0, h, 2):
		borda += _diferenca(img.get_pixel(w - 1, y), img.get_pixel(0, y))
		n_borda += 1
		for k: int in [1, 2, 3, 5, 6, 7]:
			var x: int = w * k / 8
			miolo += _diferenca(img.get_pixel(x - 1, y), img.get_pixel(x, y))
			n_miolo += 1
	for x in range(0, w, 2):
		borda += _diferenca(img.get_pixel(x, h - 1), img.get_pixel(x, 0))
		n_borda += 1
		for k: int in [1, 2, 3, 5, 6, 7]:
			var y: int = h * k / 8
			miolo += _diferenca(img.get_pixel(x, y - 1), img.get_pixel(x, y))
			n_miolo += 1
	var media_borda: float = borda / float(maxi(n_borda, 1))
	var media_miolo: float = miolo / float(maxi(n_miolo, 1))
	return {"borda": media_borda, "miolo": media_miolo, "razao": media_borda / maxf(media_miolo, 0.000001)}


static func _diferenca(a: Color, b: Color) -> float:
	return (absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b)) / 3.0 * 255.0


## Folha de contato: cada textura repetida 2 x 2 (a 50%) e, embaixo, um recorte a 100%
## bem no encontro das quatro cópias, onde uma emenda apareceria.
func montar_folha(imagens: Dictionary, emendas: Dictionary) -> Image:
	var cel := 512
	var corte := 256
	var margem := 28
	var topo := 84
	var largura := margem + TEXTURAS.size() * (cel + margem)
	var altura := topo + cel + 56 + corte + 70
	var vp := SubViewport.new()
	vp.size = Vector2i(largura, altura)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(largura, altura)
	vp.add_child(fundo)
	_rotulo(vp, "Estilo Desenhado: as 5 texturas que o Godot exportou", Vector2(margem, 18), 26, COR_TINTA)
	_rotulo(vp, "Em cima, cada uma repetida 2 x 2 (a 50%). Embaixo, a 100%, o encontro das quatro cópias: é ali que uma emenda apareceria.", Vector2(margem, 52), 15, COR_TINTA_3)
	for i in TEXTURAS.size():
		var t: Dictionary = TEXTURAS[i]
		var img: Image = imagens[t["arquivo"]]
		var lado := img.get_width()
		var dois := Image.create_empty(lado * 2, lado * 2, false, Image.FORMAT_RGB8)
		for o in [Vector2i(0, 0), Vector2i(lado, 0), Vector2i(0, lado), Vector2i(lado, lado)]:
			dois.blit_rect(img, Rect2i(0, 0, lado, lado), o)
		var x := margem + i * (cel + margem)
		var reduzida := dois.duplicate() as Image
		reduzida.resize(cel, cel, Image.INTERPOLATE_LANCZOS)
		_imagem(vp, reduzida, Vector2(x, topo))
		_rotulo(vp, t["nome"], Vector2(x, topo + cel + 10), 18, COR_TINTA)
		var em: Dictionary = emendas[t["arquivo"]]
		_rotulo(vp, "%s.png, %d x %d px · emenda %.2f (1 = igual ao miolo)" % [t["arquivo"], lado, lado, em["razao"]], Vector2(x, topo + cel + 34), 13, COR_TINTA_3)
		var recorte := dois.get_region(Rect2i(lado - corte / 2, lado - corte / 2, corte, corte))
		var xc := x + (cel - corte) / 2
		var yc := topo + cel + 64
		_imagem(vp, recorte, Vector2(xc, yc))
		# Marcas fora do recorte apontando a linha da emenda (sem cobrir a imagem).
		for marca in [Rect2(xc + corte / 2 - 1, yc - 9, 2, 6), Rect2(xc + corte / 2 - 1, yc + corte + 3, 2, 6), Rect2(xc - 9, yc + corte / 2 - 1, 6, 2), Rect2(xc + corte + 3, yc + corte / 2 - 1, 6, 2)]:
			var r := ColorRect.new()
			r.color = COR_MARCA
			r.position = marca.position
			r.size = marca.size
			vp.add_child(r)
		_rotulo(vp, "encontro das 4 cópias, 100%", Vector2(xc, yc + corte + 12), 13, COR_TINTA_3)
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

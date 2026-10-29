extends Node
## CONGELADO. Pinta as imagens de um material de móvel com o textura.gdshader dele
## (CONTRATO.md, seção 10): <nome>.png para cada nome de "imagens" (o primeiro é
## padrao.png), (casas.x x 128) x (casas.y x 128) px, em cinza de 8 bits.

const ContratoMaterial := preload("res://comum/contrato_material.gd")

## A placa às vezes devolve o quadro antes de desenhar (a imagem sai toda de uma cor ou
## preta, com o shader certo): espera mais quadros e lê de novo, até este tanto de vezes.
const LEITURAS := 4


## Devolve {"ok", "erros", "arquivos", "imagens", "medidas"}.
func pintar(cfg: Dictionary, pasta: String) -> Dictionary:
	var r := {"ok": false, "erros": [] as Array[String], "arquivos": [] as Array[String], "imagens": {}, "medidas": {}}
	var caminho_shader := "res://texturas/%s/textura.gdshader" % cfg["id"]
	if not ResourceLoader.exists(caminho_shader):
		r["erros"].append("não achei %s" % caminho_shader)
		return r
	var shader := load(caminho_shader) as Shader
	DirAccess.make_dir_recursive_absolute(pasta)
	var tam := Vector2i(cfg["casas"][0] * ContratoMaterial.PX_POR_CASA, cfg["casas"][1] * ContratoMaterial.PX_POR_CASA)
	var pedidos := []
	for k in cfg["imagens"].size():
		pedidos.append({"nome": cfg["imagens"][k], "vp": _viewport(shader, cfg, k, tam)})
	await _quadros(2)
	for p in pedidos:
		var vp: SubViewport = p["vp"]
		var nome: String = p["nome"]
		var img: Image = null
		for tentativa in LEITURAS:
			img = vp.get_texture().get_image()
			if img != null and not img.is_empty() and not _chapada(img):
				break
			await _quadros(2)
		vp.queue_free()
		if img == null or img.is_empty():
			r["erros"].append("%s: a placa de vídeo não devolveu a imagem" % nome)
			continue
		if _chapada(img):
			r["erros"].append("%s saiu de uma cor só: o shader não compilou (veja o erro do Godot acima) ou a função devolve sempre o mesmo" % nome)
			continue
		img.convert(Image.FORMAT_L8)
		var destino := pasta.path_join(ContratoMaterial.arquivo_da_imagem(nome))
		if img.save_png(destino) != OK:
			r["erros"].append("%s: erro ao salvar" % destino)
			continue
		r["arquivos"].append(destino)
		r["imagens"][nome] = img
		r["medidas"][nome] = medir(img)
	r["ok"] = r["erros"].is_empty()
	return r


## Valor médio e emendas (a diferença entre a última e a primeira coluna, ou linha,
## dividida pela diferença média entre vizinhas do miolo: 1 = a borda igual ao miolo).
static func medir(img: Image) -> Dictionary:
	var w := img.get_width()
	var h := img.get_height()
	var dados := img.get_data()
	var soma := 0.0
	for i in dados.size():
		soma += dados[i]
	var borda_u := 0.0
	var miolo_u := 0.0
	var borda_v := 0.0
	var miolo_v := 0.0
	for y in h:
		borda_u += absf(dados[y * w + w - 1] - dados[y * w])
		for x in range(1, w - 1):
			miolo_u += absf(dados[y * w + x + 1] - dados[y * w + x])
	for x in w:
		borda_v += absf(dados[(h - 1) * w + x] - dados[x])
		for y in range(1, h - 1):
			miolo_v += absf(dados[(y + 1) * w + x] - dados[y * w + x])
	miolo_u /= float(h * (w - 2))
	miolo_v /= float(w * (h - 2))
	return {
		"valorMedio": snappedf(soma / float(dados.size()) / 255.0, 0.0001),
		"emendaU": snappedf(borda_u / float(h) / maxf(miolo_u, 1e-6), 0.001),
		"emendaV": snappedf(borda_v / float(w) / maxf(miolo_v, 1e-6), 0.001),
	}


func _viewport(shader: Shader, cfg: Dictionary, qual: int, lado: Vector2i) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = lado
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var quadro := ColorRect.new()
	quadro.size = Vector2(lado)
	quadro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = shader
	m.set_shader_parameter("variante", qual)
	m.set_shader_parameter("semente", cfg["semente"])
	m.set_shader_parameter("material_periodo", Vector2(lado))
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


static func _chapada(img: Image) -> bool:
	var a := img.get_pixel(0, 0)
	for y in range(0, img.get_height(), 3):
		for x in range(0, img.get_width(), 3):
			var b := img.get_pixel(x, y)
			if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) > 0.004:
				return false
	return true


## Espera n quadros desenhados. Se a placa não desenhar em 3 s, força um quadro.
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

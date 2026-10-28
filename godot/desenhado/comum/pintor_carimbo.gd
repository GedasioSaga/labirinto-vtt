extends Node
## CONGELADO. Pinta os arquivos de um carimbo ou de um trecho com o textura.gdshader dele
## (CONTRATO.md, seção 9):
##   carimbo: carimbo-1..N.png (ladoPx x ladoPx, RGBA, cor reta, alfa reto, sem sombra);
##   trecho:  trecho.png (a cor, RGBA) e trecho-relevo.png (R, G = o lado ao longo e
##            atravessando, B = 0, A = 1), (pontaPx + comprimentoPx) x 2 por 4 x meiaLarguraPx.

const Contrato := preload("res://comum/contrato.gd")
const ContratoCarimbo := preload("res://comum/contrato_carimbo.gd")

## A placa às vezes devolve o quadro antes de desenhar (a imagem sai toda transparente ou
## preta, com o shader certo): espera mais quadros e lê de novo, até este tanto de vezes.
const LEITURAS := 4


## Devolve {"ok", "erros", "arquivos", "imagens", "corMedia", "trechoTamanho"}.
func pintar(cfg: Dictionary, pasta: String) -> Dictionary:
	var r := {"ok": false, "erros": [] as Array[String], "arquivos": [] as Array[String], "imagens": {}, "corMedia": "", "trechoTamanho": Vector2i.ZERO}
	var id: String = cfg["id"]
	var caminho_shader := "res://texturas/%s/textura.gdshader" % id
	if not ResourceLoader.exists(caminho_shader):
		r["erros"].append("não achei %s" % caminho_shader)
		return r
	var shader := load(caminho_shader) as Shader
	DirAccess.make_dir_recursive_absolute(pasta)
	var pedidos := []
	if cfg["tipo"] == "carimbo":
		var lado: int = cfg["sprite"]["ladoPx"]
		for k in cfg["variacoes"]:
			pedidos.append({"arquivo": ContratoCarimbo.ARQUIVOS_DO_CARIMBO[k], "vp": _viewport(shader, cfg, 0, k, Vector2i(lado, lado))})
	else:
		var t: Dictionary = cfg["trecho"]
		var esc := ContratoCarimbo.PX_POR_MUNDO_TRECHO
		var tam := Vector2i((int(t["pontaPx"]) + int(t["comprimentoPx"])) * esc, int(round(float(t["meiaLarguraPx"]) * 2.0 * esc)))
		r["trechoTamanho"] = tam
		pedidos.append({"arquivo": ContratoCarimbo.ARQUIVO_DO_TRECHO, "vp": _viewport(shader, cfg, 1, 0, tam)})
		pedidos.append({"arquivo": ContratoCarimbo.ARQUIVO_DO_RELEVO, "vp": _viewport(shader, cfg, 2, 0, tam)})
	await _quadros(2)
	for p in pedidos:
		var vp: SubViewport = p["vp"]
		var arquivo: String = p["arquivo"]
		var img: Image = null
		for tentativa in LEITURAS:
			img = vp.get_texture().get_image()
			if img != null and not img.is_empty() and not _chapada(img):
				break
			await _quadros(2)
		vp.queue_free()
		if img == null or img.is_empty():
			r["erros"].append("%s: a placa de vídeo não devolveu a imagem" % arquivo)
			continue
		if _chapada(img):
			r["erros"].append("%s saiu de uma cor só: o shader não compilou (veja o erro do Godot acima) ou a função devolve sempre o mesmo" % arquivo)
			continue
		img.convert(Image.FORMAT_RGBA8)
		if arquivo != ContratoCarimbo.ARQUIVO_DO_RELEVO:
			img.fix_alpha_edges()
		var destino := pasta.path_join(arquivo)
		if img.save_png(destino) != OK:
			r["erros"].append("%s: erro ao salvar" % destino)
			continue
		r["arquivos"].append(destino)
		r["imagens"][arquivo] = img
	var primeira: String = ContratoCarimbo.ARQUIVOS_DO_CARIMBO[0] if cfg["tipo"] == "carimbo" else ContratoCarimbo.ARQUIVO_DO_TRECHO
	if r["imagens"].has(primeira):
		r["corMedia"] = "#" + cor_media_com_alfa(r["imagens"][primeira]).to_html(false)
	r["ok"] = r["erros"].is_empty()
	return r


func _viewport(shader: Shader, cfg: Dictionary, modo: int, variacao: int, lado: Vector2i) -> SubViewport:
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
	m.set_shader_parameter("variante", variacao)
	m.set_shader_parameter("semente", cfg["semente"])
	if cfg["tipo"] == "carimbo":
		var sp: Dictionary = cfg["sprite"]
		m.set_shader_parameter("sprite_lado", float(sp["ladoPx"]))
		m.set_shader_parameter("sprite_ancora", Vector2(sp["ancoraPx"][0], sp["ancoraPx"][1]))
		m.set_shader_parameter("sprite_unidade", float(sp["unidadePx"]))
		var mundo: float = ContratoCarimbo.unidade_no_mapa_ref(cfg["tamanhoDoApp"]) if cfg["destino"] == "carimbo" else float(Contrato.CASA_PX)
		m.set_shader_parameter("unidade_mundo", mundo)
	else:
		var t: Dictionary = cfg["trecho"]
		m.set_shader_parameter("trecho_comprimento", float(t["comprimentoPx"]))
		m.set_shader_parameter("trecho_meia", float(t["meiaLarguraPx"]))
		m.set_shader_parameter("trecho_ponta", float(t["pontaPx"]))
		m.set_shader_parameter("trecho_imagem", Vector2(lado))
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


## A cor média do que aparece (pesada pelo alfa): a miniatura e o zoom muito pequeno.
static func cor_media_com_alfa(img: Image) -> Color:
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

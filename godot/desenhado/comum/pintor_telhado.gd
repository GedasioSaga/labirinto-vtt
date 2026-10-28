extends Node
## CONGELADO. Pinta os arquivos de um telhado, de uma faixa ou de um objeto com o
## textura.gdshader dele (CONTRATO.md, seção 8):
##   telhado: base-1..N.png (P x P px, RGB: R = valor, G = lado, B = 0; repete sem emenda)
##            e, com faixa própria, faixa.png;
##   faixa:   faixa.png (RGBA: R = valor, G = lado atravessando, A = alfa reto);
##   objeto:  objeto.png (RGBA, cor reta, com a sombra).

const Contrato := preload("res://comum/contrato.gd")
const ContratoTelhado := preload("res://comum/contrato_telhado.gd")
const Exportador := preload("res://scripts/exportador.gd")


## Devolve {"ok", "erros", "arquivos", "imagens", "emendas", "valorMedio", "temFaixa", "faixaTamanho"}.
func pintar(cfg: Dictionary, pasta: String) -> Dictionary:
	var r := {"ok": false, "erros": [] as Array[String], "arquivos": [] as Array[String], "imagens": {}, "emendas": {}, "valorMedio": 0.5, "temFaixa": false, "faixaTamanho": Vector2i.ZERO}
	var id: String = cfg["id"]
	var caminho_shader := "res://texturas/%s/textura.gdshader" % id
	if not ResourceLoader.exists(caminho_shader):
		r["erros"].append("não achei %s" % caminho_shader)
		return r
	var shader := load(caminho_shader) as Shader
	DirAccess.make_dir_recursive_absolute(pasta)
	var tipo: String = cfg["tipo"]
	var pedidos := []
	var faixa = cfg.get("faixa", null)
	if tipo == "telhado":
		var P: int = cfg["periodoCasas"] * Contrato.CASA_PX
		for v in cfg["variantes"]:
			pedidos.append({"arquivo": Contrato.ARQUIVOS_DE_BASE[v], "vp": _viewport(shader, cfg, 0, v, Vector2i(P, P), false)})
	if (tipo == "telhado" or tipo == "faixa") and faixa != null and not faixa.has("de"):
		var esc := ContratoTelhado.PX_POR_CASA_FINO / Contrato.CASA_PX
		var tam := Vector2i(int(faixa["comprimentoPx"]) * esc, int(round(faixa["meiaLarguraPx"] * 2.0 * esc)))
		r["faixaTamanho"] = tam
		r["temFaixa"] = true
		pedidos.append({"arquivo": ContratoTelhado.ARQUIVO_DA_FAIXA, "vp": _viewport(shader, cfg, 1, 0, tam, true)})
	if tipo == "objeto":
		var lado: int = cfg["objeto"]["ladoPx"]
		pedidos.append({"arquivo": ContratoTelhado.ARQUIVO_DO_OBJETO, "vp": _viewport(shader, cfg, 2, 0, Vector2i(lado, lado), true)})
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	for p in pedidos:
		var vp: SubViewport = p["vp"]
		var img := vp.get_texture().get_image()
		vp.queue_free()
		var arquivo: String = p["arquivo"]
		if img == null or img.is_empty():
			r["erros"].append("%s: a placa de vídeo não devolveu a imagem" % arquivo)
			continue
		if _chapada(img):
			r["erros"].append("%s saiu de uma cor só: o shader não compilou (veja o erro do Godot acima) ou a função devolve sempre o mesmo" % arquivo)
			continue
		if arquivo.begins_with("base-"):
			img.convert(Image.FORMAT_RGB8)
			var cinza := _canal_r(img)
			r["emendas"][arquivo] = Exportador.medir_emenda(cinza)
			if arquivo == Contrato.ARQUIVOS_DE_BASE[0]:
				r["valorMedio"] = snappedf(_media_r(img), 0.001)
		else:
			img.convert(Image.FORMAT_RGBA8)
			img.fix_alpha_edges()
		var destino := pasta.path_join(arquivo)
		var e := img.save_png(destino)
		if e != OK:
			r["erros"].append("%s: erro %d ao salvar" % [destino, e])
			continue
		r["arquivos"].append(destino)
		r["imagens"][arquivo] = img
	r["ok"] = r["erros"].is_empty()
	return r


func _viewport(shader: Shader, cfg: Dictionary, modo: int, variante: int, lado: Vector2i, transparente: bool) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = lado
	vp.disable_3d = true
	vp.transparent_bg = transparente
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var quadro := ColorRect.new()
	quadro.size = Vector2(lado)
	quadro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = shader
	m.set_shader_parameter("modo", modo)
	m.set_shader_parameter("variante", variante)
	m.set_shader_parameter("semente", cfg["semente"])
	if cfg["tipo"] == "telhado":
		m.set_shader_parameter("periodo", float(cfg["periodoCasas"] * Contrato.CASA_PX))
	var faixa = cfg.get("faixa", null)
	if faixa != null and not faixa.has("de"):
		m.set_shader_parameter("faixa_comprimento", float(faixa["comprimentoPx"]))
		m.set_shader_parameter("faixa_meia", float(faixa["meiaLarguraPx"]))
	if cfg["tipo"] == "objeto":
		var o: Dictionary = cfg["objeto"]
		m.set_shader_parameter("objeto_lado", float(o["ladoPx"]))
		m.set_shader_parameter("objeto_ancora", Vector2(o["ancoraPx"][0], o["ancoraPx"][1]))
		m.set_shader_parameter("objeto_px_por_mapa", float(ContratoTelhado.PX_POR_CASA_FINO) / Contrato.CASA_PX)
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


## O canal R (o valor) como imagem cinza, para medir a emenda sem o canal do lado.
static func _canal_r(img: Image) -> Image:
	var src := img.get_data()
	var dst := PackedByteArray()
	dst.resize(src.size())
	for i in range(0, src.size(), 3):
		var v := src[i]
		dst[i] = v
		dst[i + 1] = v
		dst[i + 2] = v
	return Image.create_from_data(img.get_width(), img.get_height(), false, Image.FORMAT_RGB8, dst)


static func _media_r(img: Image) -> float:
	var src := img.get_data()
	var soma := 0
	for i in range(0, src.size(), 3):
		soma += src[i]
	return float(soma) / float(src.size() / 3) / 255.0


static func _chapada(img: Image) -> bool:
	var a := img.get_pixel(0, 0)
	for y in range(0, img.get_height(), 3):
		for x in range(0, img.get_width(), 3):
			var b := img.get_pixel(x, y)
			if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) + absf(a.a - b.a) > 0.004:
				return false
	return true

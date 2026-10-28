extends Node
## CONGELADO. Pinta os arquivos de uma textura com o textura.gdshader dela:
## base-1..3.png (ladrilho de 8 x 8 casas, RGB, repete sem emenda) e detalhes.png
## (atlas 4 x 4 de células de 1 casa a 128 px por casa, RGBA com alfa reto).

const Contrato := preload("res://comum/contrato.gd")
const Exportador := preload("res://scripts/exportador.gd")


## Pinta e grava em `pasta`. Devolve {"ok", "erros", "arquivos", "imagens", "emendas"}.
func pintar(cfg: Dictionary, pasta: String) -> Dictionary:
	var erros: Array[String] = []
	var arquivos: Array[String] = []
	var imagens := {}
	var emendas := {}
	var id: String = cfg["id"]
	var caminho_shader := "res://texturas/%s/textura.gdshader" % id
	if not ResourceLoader.exists(caminho_shader):
		erros.append("não achei %s" % caminho_shader)
		return {"ok": false, "erros": erros, "arquivos": arquivos, "imagens": imagens, "emendas": emendas}
	var shader := load(caminho_shader) as Shader
	var e_pasta := DirAccess.make_dir_recursive_absolute(pasta)
	if e_pasta != OK:
		erros.append("não consegui criar %s (erro %d)" % [pasta, e_pasta])
		return {"ok": false, "erros": erros, "arquivos": arquivos, "imagens": imagens, "emendas": emendas}
	var periodo: int = cfg["periodoCasas"] * Contrato.CASA_PX
	var pedidos := []
	for v in cfg["variantes"]:
		pedidos.append({"arquivo": Contrato.ARQUIVOS_DE_BASE[v], "vp": _viewport(shader, 0, v, periodo, cfg["semente"], Vector2i(periodo, periodo), false, cfg["detalhes"]["celulaCasas"])})
	var quantos: int = cfg["detalhes"]["quantos"]
	if quantos > 0:
		pedidos.append({"arquivo": Contrato.ARQUIVO_DO_ATLAS, "vp": _viewport(shader, 1, 0, periodo, cfg["semente"], Vector2i(Contrato.ATLAS_LADO, Contrato.ATLAS_LADO), true, cfg["detalhes"]["celulaCasas"])})
	# Dois quadros: o primeiro compila e pinta, o segundo garante a leitura.
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	for p in pedidos:
		var vp: SubViewport = p["vp"]
		var img := vp.get_texture().get_image()
		vp.queue_free()
		var arquivo: String = p["arquivo"]
		if img == null or img.is_empty():
			erros.append("%s: a placa de vídeo não devolveu a imagem" % arquivo)
			continue
		if _chapada(img):
			erros.append("%s saiu de uma cor só: o shader não compilou (veja o erro do Godot acima) ou a função devolve sempre o mesmo" % arquivo)
			continue
		if arquivo == Contrato.ARQUIVO_DO_ATLAS:
			img.convert(Image.FORMAT_RGBA8)
			# A cor dos pixels transparentes vira a do vizinho: sem franja escura no filtro e no mipmap.
			img.fix_alpha_edges()
		else:
			img.convert(Image.FORMAT_RGB8)
			emendas[arquivo] = Exportador.medir_emenda(img)
		var destino := pasta.path_join(arquivo)
		var e := img.save_png(destino)
		if e != OK:
			erros.append("%s: erro %d ao salvar" % [destino, e])
			continue
		arquivos.append(destino)
		imagens[arquivo] = img
	return {"ok": erros.is_empty(), "erros": erros, "arquivos": arquivos, "imagens": imagens, "emendas": emendas}


func _viewport(shader: Shader, modo: int, variante: int, periodo: int, semente: int, lado: Vector2i, transparente: bool, celula: int) -> SubViewport:
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
	m.set_shader_parameter("periodo", float(periodo))
	m.set_shader_parameter("semente", semente)
	m.set_shader_parameter("atlas_colunas", Contrato.ATLAS_COLUNAS / celula)
	m.set_shader_parameter("atlas_linhas", Contrato.ATLAS_LINHAS / celula)
	m.set_shader_parameter("celula_casas", float(celula))
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


static func _chapada(img: Image) -> bool:
	var a := img.get_pixel(0, 0)
	var w := img.get_width()
	var h := img.get_height()
	for y in range(0, h, 7):
		for x in range(0, w, 7):
			var b := img.get_pixel(x, y)
			if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) + absf(a.a - b.a) > 0.004:
				return false
	return true

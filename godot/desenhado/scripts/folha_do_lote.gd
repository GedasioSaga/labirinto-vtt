extends SceneTree
## Junta as folhas de até 5 texturas numa folha só do lote, para a aprovação do usuário.
## Não pinta nada de novo: lê as peças que exportar_uma.gd --folha gravou em <prova>/<id>/.
## Sempre pela fila do Godot (README). Uso, depois do "--":
##   --texturas=a,b,c,d,e   obrigatório: os ids, na ordem do lote (1 a 5)
##   --prova=<pasta>        a raiz das provas, com uma pasta por id (padrão: prova/ do projeto)
##   --saida=<arquivo.png>  onde gravar (padrão: <prova>/lote.png)
##   --titulo=<texto>       título da folha (padrão: "Lote")
## Sai com 0 (ok), 1 (faltou a folha de alguma textura) ou 2 (uso errado).

const Contrato := preload("res://comum/contrato.gd")

const LIMITE_S := 120.0
const MG := 28
const TEXTO := 300
const AREA := 640
const PERTO := 512
const LINHA := AREA + 44
const TOPO := 96
const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")


func _initialize() -> void:
	create_timer(LIMITE_S).timeout.connect(func() -> void:
		printerr("  ERRO: passou de %d s sem terminar" % int(LIMITE_S))
		quit(3))
	_rodar.call_deferred()


func _rodar() -> void:
	OS.low_processor_usage_mode = false
	var args := Contrato.ler_args()
	if not args.has("texturas"):
		printerr("uso: --texturas=a,b,c,d,e [--prova=<pasta>] [--saida=<arquivo.png>] [--titulo=<texto>]")
		quit(2)
		return
	var ids: PackedStringArray = args["texturas"].split(",", false)
	if ids.size() < 1 or ids.size() > 5:
		printerr("  ERRO: de 1 a 5 texturas por lote")
		quit(2)
		return
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova"))
	var saida: String = args.get("saida", prova.path_join("lote.png"))
	var titulo: String = args.get("titulo", "Lote")
	var largura := MG + TEXTO + MG + AREA + MG + AREA + MG + PERTO + MG
	var altura := TOPO + ids.size() * LINHA + MG
	var vp := SubViewport.new()
	vp.size = Vector2i(largura, altura)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(largura, altura)
	vp.add_child(fundo)
	_rotulo(vp, "%s  ·  Desenhado  ·  %d textura(s)" % [titulo, ids.size()], Vector2(MG, 16), 28, COR_TINTA, 0)
	_rotulo(vp, "Por linha: o Desenhado em 40 x 40 casas (25%), o Atual na mesma área (25%) e o Desenhado de perto (4 x 4 casas, 200%). Repetição: 0 = cópia exata a cada 8 casas, 1 = não repete.", Vector2(MG, 56), 16, COR_TINTA_3, 0)
	var faltou: Array[String] = []
	for k in ids.size():
		var id := ids[k].strip_edges()
		var y := TOPO + k * LINHA
		var pasta := prova.path_join(id)
		var area := Image.load_from_file(pasta.path_join("area50.png")) if FileAccess.file_exists(pasta.path_join("area50.png")) else null
		var bruto = JSON.parse_string(FileAccess.get_file_as_string(pasta.path_join("resumo.json"))) if FileAccess.file_exists(pasta.path_join("resumo.json")) else null
		if area == null or typeof(bruto) != TYPE_DICTIONARY:
			faltou.append(id)
			_rotulo(vp, "%s: falta a folha. Rode exportar_uma.gd --textura=%s --folha --prova=%s" % [id, id, pasta], Vector2(MG, y + 20), 18, COR_TINTA_2, 0)
			continue
		var r: Dictionary = bruto
		var rep: Dictionary = r.get("repeticao", {})
		var mem: Dictionary = r.get("memoria", {})
		var texto := "%d. %s\n%s\nonda %d, lote %d\n\nrepetição\n  só base-1 %.2f\n  base misturada %.2f\n  completo %.2f\n\nmemória %.1f MiB na GPU\n%.2f MiB em disco\n\nAtual ao lado: %s" % [
			k + 1, r.get("nome", id), id, int(r.get("onda", 0)), int(r.get("lote", 0)),
			float(rep.get("soBase1", 0)), float(rep.get("baseMisturada", 0)), float(rep.get("completo", 0)),
			float(mem.get("gpuBytes", 0)) / 1048576.0, float(mem.get("discoBytes", 0)) / 1048576.0,
			"sim" if r.get("atual", {}).get("ok", false) else "não"]
		_rotulo(vp, texto, Vector2(MG, y + 4), 17, COR_TINTA, TEXTO)
		var x := MG + TEXTO + MG
		area.resize(AREA, AREA, Image.INTERPOLATE_LANCZOS)
		_imagem(vp, area, Vector2(x, y))
		x += AREA + MG
		if FileAccess.file_exists(pasta.path_join("atual-area50.png")):
			var atual := Image.load_from_file(pasta.path_join("atual-area50.png"))
			atual.resize(AREA, AREA, Image.INTERPOLATE_LANCZOS)
			_imagem(vp, atual, Vector2(x, y))
		else:
			_rotulo(vp, "sem Atual", Vector2(x, y + 4), 17, COR_TINTA_3, 0)
		x += AREA + MG
		if FileAccess.file_exists(pasta.path_join("perto300.png")):
			var perto := Image.load_from_file(pasta.path_join("perto300.png"))
			perto.resize(PERTO, PERTO, Image.INTERPOLATE_LANCZOS)
			_imagem(vp, perto, Vector2(x, y))
	root.add_child(vp)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var folha := vp.get_texture().get_image()
	folha.convert(Image.FORMAT_RGB8)
	DirAccess.make_dir_recursive_absolute(saida.get_base_dir())
	var e := folha.save_png(saida)
	if e != OK:
		printerr("  ERRO: não consegui salvar %s (erro %d)" % [saida, e])
		quit(1)
		return
	print("  folha do lote: ", saida)
	for id in faltou:
		printerr("  ERRO: faltou a folha de ", id)
	quit(0 if faltou.is_empty() else 1)


func _rotulo(pai: Node, texto: String, pos: Vector2, tamanho: int, cor: Color, largura: int) -> void:
	var l := Label.new()
	l.text = texto
	l.position = pos
	if largura > 0:
		l.size = Vector2(largura, 0)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_size_override("font_size", tamanho)
	l.add_theme_color_override("font_color", cor)
	pai.add_child(l)


func _imagem(pai: Node, img: Image, pos: Vector2) -> void:
	var tr := TextureRect.new()
	tr.texture = ImageTexture.create_from_image(img)
	tr.position = pos
	pai.add_child(tr)

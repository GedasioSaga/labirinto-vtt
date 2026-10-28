extends SceneTree
## Junta as folhas de até 5 itens da onda 2 (telhado, faixa, objeto) numa folha só do lote.
## Não pinta nada de novo: lê as peças que exportar_uma.gd --folha gravou em <prova>/<id>/
## (area50.png, atual-area50.png, perto300.png, atual-perto300.png e resumo.json).
## Sempre pela fila do Godot (README). Uso, depois do "--":
##   --texturas=a,b,c,d,e   obrigatório: os ids, na ordem do lote (1 a 5)
##   --prova=<pasta>        a raiz das provas, com uma pasta por id (padrão: prova/ do projeto)
##   --saida=<arquivo.png>  onde gravar (padrão: <prova>/lote.png)
##   --titulo=<texto>       título da folha (padrão: "Lote 5, telhados")
## Sai com 0 (ok), 1 (faltou a folha de algum item) ou 2 (uso errado).

const Contrato := preload("res://comum/contrato.gd")

const LIMITE_S := 120.0
const MG := 28
const TEXTO := 300
const AREA := Vector2i(576, 320) ## a cena A (18 x 10 casas) a 50%
const PERTO := 400 ## o close a 300%, reduzido para caber
const LINHA := PERTO + 44
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
		printerr("  ERRO: de 1 a 5 itens por lote")
		quit(2)
		return
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova"))
	var saida: String = args.get("saida", prova.path_join("lote.png"))
	var titulo: String = args.get("titulo", "Lote 5, telhados")
	var largura := MG + TEXTO + MG + AREA.x + MG + AREA.x + MG + PERTO + MG + PERTO + MG
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
	_rotulo(vp, "%s  ·  Desenhado  ·  %d item(ns)" % [titulo, ids.size()], Vector2(MG, 16), 28, COR_TINTA, 0)
	_rotulo(vp, "Por linha: o Desenhado na cor padrão do modelo (a casa retangular e a casa em L, 50%), o Atual nas mesmas casas (50%) e os dois de perto (o rincão do L, 300%, reduzido). ΔL = média do telhado menos a cor escolhida, em luz OKLab.", Vector2(MG, 56), 16, COR_TINTA_3, 0)
	var faltou: Array[String] = []
	for k in ids.size():
		var id := ids[k].strip_edges()
		var y: int = TOPO + k * LINHA
		var pasta := prova.path_join(id)
		var tem := FileAccess.file_exists(pasta.path_join("area50.png")) and FileAccess.file_exists(pasta.path_join("resumo.json"))
		var bruto = JSON.parse_string(FileAccess.get_file_as_string(pasta.path_join("resumo.json"))) if tem else null
		if typeof(bruto) != TYPE_DICTIONARY:
			faltou.append(id)
			_rotulo(vp, "%s: falta a folha. Rode exportar_uma.gd --textura=%s --folha --prova=%s" % [id, id, pasta], Vector2(MG, y + 20), 18, COR_TINTA_2, 0)
			continue
		var r: Dictionary = bruto
		var mem: Dictionary = r.get("memoria", {})
		var medidas: Array = r.get("medidas", [])
		var linhas := ""
		for m in medidas:
			linhas += "  %s  ΔL %+.3f%s\n" % [m.get("nome", "?"), float(m.get("deltaLDesenhado", 0)), (" (Atual %+.3f)" % float(m["deltaLAtual"])) if m.has("deltaLAtual") else ""]
		var texto := "%d. %s\n%s\ntipo %s, modelo %s\n\n%s\nmemória %.2f MiB\n%.2f MiB em disco\n\n%s" % [
			k + 1, r.get("nome", id), id, r.get("tipo", "?"), r.get("modelo", "?"), linhas,
			float(mem.get("gpuBytes", 0)) / 1048576.0, float(mem.get("discoBytes", 0)) / 1048576.0,
			"; ".join(PackedStringArray(r.get("avisos", [])))]
		_rotulo(vp, texto, Vector2(MG, y + 4), 16, COR_TINTA, TEXTO)
		var x := MG + TEXTO + MG
		_imagem(vp, Image.load_from_file(pasta.path_join("area50.png")), Vector2(x, y))
		x += AREA.x + MG
		if FileAccess.file_exists(pasta.path_join("atual-area50.png")):
			_imagem(vp, Image.load_from_file(pasta.path_join("atual-area50.png")), Vector2(x, y))
		else:
			_rotulo(vp, "sem Atual", Vector2(x, y + 4), 17, COR_TINTA_3, 0)
		x += AREA.x + MG
		for nome in ["perto300.png", "atual-perto300.png"]:
			if FileAccess.file_exists(pasta.path_join(nome)):
				var perto := Image.load_from_file(pasta.path_join(nome))
				perto.resize(PERTO, PERTO, Image.INTERPOLATE_LANCZOS)
				_imagem(vp, perto, Vector2(x, y))
			x += PERTO + MG
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

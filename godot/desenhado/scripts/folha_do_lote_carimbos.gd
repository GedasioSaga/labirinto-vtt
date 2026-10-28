extends SceneTree
## Junta as folhas de até 5 itens da onda 3 (carimbo, trecho) numa folha só do lote.
## Não pinta nada de novo: lê as peças que exportar_uma.gd --folha gravou em <prova>/<id>/
## (area25.png, atual-area25.png, perto300.png, atual-perto300.png e resumo.json).
## Sempre pela fila do Godot (README). Uso, depois do "--":
##   --texturas=a,b,c,d,e   obrigatório: os ids, na ordem do lote (1 a 5)
##   --prova=<pasta>        a raiz das provas, com uma pasta por id (padrão: prova/ do projeto)
##   --saida=<arquivo.png>  onde gravar (padrão: <prova>/lote.png)
##   --titulo=<texto>       título da folha (padrão: "Lote 6, árvores")
## Sai com 0 (ok), 1 (faltou a folha de algum item ou a placa não desenhou) ou 2 (uso errado).

const Contrato := preload("res://comum/contrato.gd")

const LIMITE_S := 120.0
const LEITURAS := 4
const MG := 28
const TEXTO := 300
const AREA := 384 ## o bosque de 24 x 24 casas a 25%
const PERTO := 384 ## o sozinho a 300%, reduzido para caber
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
		printerr("  ERRO: de 1 a 5 itens por lote")
		quit(2)
		return
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova"))
	var saida: String = args.get("saida", prova.path_join("lote.png"))
	var titulo: String = args.get("titulo", "Lote 6, árvores")
	var largura := MG + TEXTO + MG + (AREA + MG) * 2 + (PERTO + MG) * 2
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
	_rotulo(vp, "Por linha: o Desenhado espalhado sobre a grama aprovada (24 x 24 casas, 25%), o Atual com os mesmos objetos (25%) e os dois sozinhos de perto (300%, reduzido). Mapa de referência de 200 x 200 casas.", Vector2(MG, 56), 16, COR_TINTA_3, 0)
	var faltou: Array[String] = []
	for k in ids.size():
		var id := ids[k].strip_edges()
		var y: int = TOPO + k * LINHA
		var pasta := prova.path_join(id)
		var tem := FileAccess.file_exists(pasta.path_join("area25.png")) and FileAccess.file_exists(pasta.path_join("resumo.json"))
		var bruto = JSON.parse_string(FileAccess.get_file_as_string(pasta.path_join("resumo.json"))) if tem else null
		if typeof(bruto) != TYPE_DICTIONARY:
			faltou.append(id)
			_rotulo(vp, "%s: falta a folha. Rode exportar_uma.gd --textura=%s --folha --prova=%s" % [id, id, pasta], Vector2(MG, y + 20), 18, COR_TINTA_2, 0)
			continue
		var r: Dictionary = bruto
		var mem: Dictionary = r.get("memoria", {})
		var som: Dictionary = r.get("sombra", {})
		var p: Dictionary = r.get("paineis", {})
		var centro := ""
		var c = p.get("centroDoAtual", null)
		if typeof(c) == TYPE_DICTIONARY:
			centro = "centro do Atual %+.2f, %+.2f\n(raio %.2f)\n" % [float(c["x"]), float(c["y"]), float(c["raio"])]
		var atual: Dictionary = r.get("atual", {})
		var texto := "%d. %s\n%s\ntipo %s, no app: %s\n\n%s%s formas, %s objetos\nsombra %s (%.2f, %.3f)\nmemória %.2f MiB\n%.2f MiB em disco\n\n%s" % [
			k + 1, r.get("nome", id), id, r.get("tipo", "?"), r.get("idDoApp", "?"), centro,
			str(int(p.get("formas", 0))), str(int(p.get("objetos", 0))),
			som.get("jeito", "?"), float(som.get("deslocamento", 0)), float(som.get("borrao", 0)),
			float(mem.get("gpuBytes", 0)) / 1048576.0, float(mem.get("discoBytes", 0)) / 1048576.0,
			"" if atual.get("ok", false) else "Atual: " + str(atual.get("motivo", "não pintado"))]
		_rotulo(vp, texto, Vector2(MG, y + 4), 16, COR_TINTA, TEXTO)
		var x := MG + TEXTO + MG
		for nome in ["area25.png", "atual-area25.png", "perto300.png", "atual-perto300.png"]:
			if FileAccess.file_exists(pasta.path_join(nome)):
				var img := Image.load_from_file(pasta.path_join(nome))
				if img.get_width() != AREA:
					img.resize(AREA, AREA, Image.INTERPOLATE_LANCZOS)
				_imagem(vp, img, Vector2(x, y))
			else:
				_rotulo(vp, "sem Atual", Vector2(x, y + 4), 17, COR_TINTA_3, 0)
			x += AREA + MG
	root.add_child(vp)
	# A placa às vezes devolve o quadro todo preto (exit 0): espera e lê de novo.
	var folha: Image = null
	for tentativa in LEITURAS:
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		folha = vp.get_texture().get_image()
		if folha != null and not folha.is_empty() and not _preta(folha):
			break
		folha = null
	if folha == null:
		printerr("  ERRO: a folha saiu preta %d vezes (a placa de vídeo não desenhou)" % LEITURAS)
		quit(1)
		return
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


## O fundo da folha não é preto (#1c1b19): uma folha toda preta é a placa que não desenhou.
static func _preta(img: Image) -> bool:
	for y in range(0, img.get_height(), 13):
		for x in range(0, img.get_width(), 13):
			var b := img.get_pixel(x, y)
			if b.r + b.g + b.b > 0.01:
				return false
	return true


func _rotulo(pai: Node, texto: String, pos: Vector2, tamanho: int, cor: Color, largura: int) -> void:
	var l := Label.new()
	l.text = texto
	l.position = pos
	if largura > 0:
		l.custom_minimum_size = Vector2(largura, 0)
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

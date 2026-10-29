extends SceneTree
## Junta as folhas de até 5 MÓVEIS DESENHADOS da onda 4 (CONTRATO.md seção 10) numa folha
## só do lote. Não pinta nada de novo: lê as peças que exportar_uma.gd --folha gravou em
## <prova>/<id>/ (area50.png, atual-area50.png, perto300.png, atual-perto300.png,
## familia100.png, atual-familia100.png, familia50.png, atual-familia50.png, resumo.json).
## Sempre pela fila do Godot (README). Uso, depois do "--":
##   --texturas=a,b,c,d,e   obrigatório: os ids, na ordem do lote (1 a 5)
##   --prova=<pasta>        a raiz das provas, com uma pasta por id (padrão: prova/ do projeto)
##   --saida=<arquivo.png>  onde gravar (padrão: <prova>/lote.png)
##   --titulo=<texto>       título da folha (padrão: "Lote 9, móveis")
##   --familia=<id>         de qual pasta vem a cena de família (padrão: a do último id,
##                          a que foi exportada por último e já vê os outros)
## Sai com 0 (ok), 1 (faltou a folha de algum item) ou 2 (uso errado).

const Contrato := preload("res://comum/contrato.gd")

const LIMITE_S := 120.0
const MG := 28
const TEXTO := 300
const ALTO := 300 ## a altura de cada linha de imagens
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


static func _ler(caminho: String) -> Image:
	if not FileAccess.file_exists(caminho):
		return null
	var img := Image.load_from_file(caminho)
	return img if img != null and not img.is_empty() else null


## Cabe na altura (reduz em Lanczos; nunca aumenta).
static func _caber(img: Image, alto: int) -> Image:
	if img == null or img.get_height() <= alto:
		return img
	var r := img.duplicate() as Image
	var k := float(alto) / float(img.get_height())
	r.resize(int(round(img.get_width() * k)), alto, Image.INTERPOLATE_LANCZOS)
	return r


func _rodar() -> void:
	OS.low_processor_usage_mode = false
	var args := Contrato.ler_args()
	if not args.has("texturas"):
		printerr("uso: --texturas=a,b,c,d,e [--prova=<pasta>] [--saida=<arquivo.png>] [--titulo=<texto>] [--familia=<id>]")
		quit(2)
		return
	var ids: PackedStringArray = args["texturas"].split(",", false)
	if ids.size() < 1 or ids.size() > 5:
		printerr("  ERRO: de 1 a 5 itens por lote")
		quit(2)
		return
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova"))
	var saida: String = args.get("saida", prova.path_join("lote.png"))
	var titulo: String = args.get("titulo", "Lote 9, móveis")
	var fam_id: String = args.get("familia", ids[ids.size() - 1])
	var faltou := false
	var linhas := []
	for id in ids:
		var pasta := prova.path_join(id)
		var r = JSON.parse_string(FileAccess.get_file_as_string(pasta.path_join("resumo.json"))) if FileAccess.file_exists(pasta.path_join("resumo.json")) else null
		if typeof(r) != TYPE_DICTIONARY:
			printerr("  ERRO: falta %s (rode exportar_uma.gd --textura=%s --folha --prova=%s antes)" % [pasta.path_join("resumo.json"), id, pasta])
			faltou = true
			continue
		linhas.append({"id": id, "r": r, "imgs": [_ler(pasta.path_join("area50.png")), _ler(pasta.path_join("atual-area50.png")), _caber(_ler(pasta.path_join("perto300.png")), ALTO), _caber(_ler(pasta.path_join("atual-perto300.png")), ALTO)]})
	# Qual cena de família é (a clareira, a praça ou a sala): o resumo.json de quem a pintou.
	var fam_titulo := "a cena de família"
	var fam_resumo_arq := prova.path_join(fam_id).path_join("resumo.json")
	if FileAccess.file_exists(fam_resumo_arq):
		var fr = JSON.parse_string(FileAccess.get_file_as_string(fam_resumo_arq))
		if typeof(fr) == TYPE_DICTIONARY and typeof(fr.get("familia")) == TYPE_DICTIONARY:
			fam_titulo = str(fr["familia"].get("titulo", fr["familia"].get("cena", fam_titulo)))
	var fd := _ler(prova.path_join(fam_id).path_join("familia100.png"))
	var fa := _ler(prova.path_join(fam_id).path_join("atual-familia100.png"))
	var f50 := _ler(prova.path_join(fam_id).path_join("familia50.png"))
	var a50 := _ler(prova.path_join(fam_id).path_join("atual-familia50.png"))
	var largura := MG + 2 * (768 + MG)
	for l in linhas:
		var w := MG + TEXTO + MG
		for im in l["imgs"]:
			if im != null:
				w += im.get_width() + MG
		largura = maxi(largura, w)
	var altura := TOPO + linhas.size() * (ALTO + 50) + (84 + 768 + 50 + 384 + 40 if fd != null else 0) + MG
	var vp := SubViewport.new()
	vp.size = Vector2i(largura, altura)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(largura, altura)
	vp.add_child(fundo)
	_rotulo(vp, "%s  ·  Desenhado  ·  %d móvel(is) desenhado(s) que pegam cor" % [titulo, linhas.size()], Vector2(MG, 16), 28, COR_TINTA)
	_rotulo(vp, "Por linha: as 3 combinações de material a 50%, Desenhado e Atual (o motor de hoje), e o primeiro sozinho a 300%, Desenhado e Atual (reduzido para caber). Embaixo, a cena de família.", Vector2(MG, 58), 17, COR_TINTA_2)
	var y := TOPO
	for i in linhas.size():
		var l: Dictionary = linhas[i]
		var r: Dictionary = l["r"]
		var mem: Dictionary = r.get("memoria", {})
		var texto := "%d. %s\n%s\nno app: %s\n\n%d formas\nmemória %.2f MiB\n%.2f MiB em disco\n\n%s" % [i + 1, r["nome"], r["id"], r["idDoApp"], int(r.get("formas", 0)), float(mem.get("memoriaBytes", 0)) / 1048576.0, float(mem.get("discoBytes", 0)) / 1048576.0, "\n".join(PackedStringArray(r.get("combos", [])))]
		_rotulo(vp, texto, Vector2(MG, y), 15, COR_TINTA_2)
		var x := MG + TEXTO + MG
		for im in l["imgs"]:
			if im == null:
				continue
			_imagem(vp, im, Vector2(x, y))
			x += im.get_width() + MG
		y += ALTO + 50
	if fd != null:
		_rotulo(vp, "A família: %s" % fam_titulo, Vector2(MG, y), 22, COR_TINTA)
		_rotulo(vp, "De %s: os móveis Desenhados à esquerda, os Atuais na mesma cena à direita, a 100%% e a 50%%" % fam_id, Vector2(MG, y + 32), 16, COR_TINTA_2)
		y += 64
		_imagem(vp, fd, Vector2(MG, y))
		if fa != null:
			_imagem(vp, fa, Vector2(MG + 768 + MG, y))
		y += 768 + 30
		if f50 != null:
			_imagem(vp, f50, Vector2(MG, y))
		if a50 != null:
			_imagem(vp, a50, Vector2(MG + 768 + MG, y))
	root.add_child(vp)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	img.convert(Image.FORMAT_RGB8)
	if img.save_png(saida) != OK:
		printerr("  ERRO: não salvei %s" % saida)
		quit(1)
		return
	print("  lote: ", saida)
	quit(1 if faltou else 0)


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

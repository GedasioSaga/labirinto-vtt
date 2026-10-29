extends Node
## CONGELADO. A mesa de prova de um MÓVEL DESENHADO (onda 4, CONTRATO.md seção 10).
## 1. Pinta a grama aprovada (exportado/grama, pela montagem do chão, comum/mesa.gd) para a
##    cena de família.
## 2. Roda ferramentas/mesa_movel.ts (empacotado com o motor dos móveis do client da main
##    por ferramentas/construir.mjs, só leitura): o Desenhado pela conta de referência
##    (ferramentas/movel.ts) e o Atual pelo motor, nos mesmos móveis.
## 3. Arruma a folha, reduz para 50% e 25% (Lanczos) e grava as peças da folha do lote.

const Contrato := preload("res://comum/contrato.gd")
const ContratoMovel := preload("res://comum/contrato_movel.gd")
const Mesa := preload("res://comum/mesa.gd")

const MG := 28
const FAMILIA_CASAS := 12
const PERTO := {"x0": 4.0, "y0": 4.3, "casas": 4}
const LARGURA := MG + 2 * (768 + MG)
const BANDA := 2048
const LEITURAS := 4
const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")

var _ops: Array = []
var _y := 0


## Devolve {"ok", "erros", "resumo"}.
func montar(cfg: Dictionary, pasta_exportada: String, prova: String, args: Dictionary) -> Dictionary:
	var erros: Array[String] = []
	var paineis := prova.path_join("paineis")
	DirAccess.make_dir_recursive_absolute(paineis)
	# 1. A grama da cena de família.
	var lido_g := Contrato.ler_config("grama")
	if not lido_g["ok"]:
		erros.append("a grama aprovada (texturas/grama/config.json) não leu")
		return {"ok": false, "erros": erros, "resumo": {}}
	var cfg_g: Dictionary = lido_g["config"]
	var mesa_g := Mesa.new()
	add_child(mesa_g)
	if not mesa_g._carregar(cfg_g, ProjectSettings.globalize_path("res://exportado/grama"), erros):
		return {"ok": false, "erros": erros, "resumo": {}}
	var casa := float(Contrato.CASA_PX)
	var vistas := {
		"chao-familia-100": mesa_g._vista(cfg_g, 0, Vector2.ZERO, 1.0, FAMILIA_CASAS * casa, false, Vector2.ZERO),
		"chao-familia-300": mesa_g._vista(cfg_g, 0, Vector2(PERTO["x0"], PERTO["y0"]) * casa, 3.0, PERTO["casas"] * casa * 3.0, false, Vector2.ZERO),
	}
	await _quadros(2)
	for nome in vistas:
		var img: Image = await _ler_viewport(vistas[nome])
		vistas[nome].queue_free()
		if img == null:
			erros.append("%s: a placa de vídeo devolveu a imagem vazia %d vezes" % [nome, LEITURAS])
			continue
		img.convert(Image.FORMAT_RGBA8)
		img.save_png(paineis.path_join(nome + ".png"))
	mesa_g.queue_free()
	if not erros.is_empty():
		return {"ok": false, "erros": erros, "resumo": {}}
	# 2. Os painéis.
	var construir := ProjectSettings.globalize_path("res://ferramentas/construir.mjs")
	var entrada := ProjectSettings.globalize_path("res://ferramentas/mesa_movel.ts")
	var mjs := ProjectSettings.globalize_path("res://ferramentas/.build/mesa_movel.mjs")
	var saida_cmd := []
	var c := OS.execute("node", [construir, entrada, mjs], saida_cmd, true)
	if c != 0:
		erros.append("ferramentas/construir.mjs falhou (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
		return {"ok": false, "erros": erros, "resumo": {}}
	print("  ", "".join(saida_cmd).strip_edges())
	var argv := [mjs, "--textura=" + pasta_exportada, "--exportado=" + ProjectSettings.globalize_path("res://exportado"), "--saida=" + paineis]
	if args.has("sem-atual"):
		argv.append("--sem-atual")
	saida_cmd = []
	c = OS.execute("node", argv, saida_cmd, true)
	var texto := "".join(saida_cmd).strip_edges()
	if c != 0:
		erros.append("ferramentas/mesa_movel.ts falhou (%d): %s" % [c, texto])
		return {"ok": false, "erros": erros, "resumo": {}}
	print("  ", texto)
	var p = JSON.parse_string(FileAccess.get_file_as_string(paineis.path_join("paineis.json")))
	if typeof(p) != TYPE_DICTIONARY:
		erros.append("paineis.json não saiu")
		return {"ok": false, "erros": erros, "resumo": {}}
	var params = JSON.parse_string(FileAccess.get_file_as_string(pasta_exportada.path_join(Contrato.ARQUIVO_DE_PARAMETROS)))
	if typeof(params) != TYPE_DICTIONARY:
		params = {}
	var resumo := {
		"id": cfg["id"], "nome": cfg["nome"], "tipo": cfg["tipo"], "idDoApp": cfg["idDoApp"], "onda": cfg["onda"], "lote": cfg["lote"],
		"combos": p["combos"], "medidas": p["medidas"], "familia": p["familia"], "atual": {"ok": p["atual"]},
		"memoria": params.get("memoria", {}), "formas": params.get("formas", []).size(),
	}
	# 3. As peças da folha do lote e a folha.
	var tem_atual: bool = p["atual"]
	_escala(_ler(paineis, "combos-desenhado-100.png"), 0.5).save_png(prova.path_join("area50.png"))
	_ler(paineis, "sozinho-desenhado-300.png").save_png(prova.path_join("perto300.png"))
	if tem_atual:
		_escala(_ler(paineis, "combos-atual-100.png"), 0.5).save_png(prova.path_join("atual-area50.png"))
		_ler(paineis, "sozinho-atual-300.png").save_png(prova.path_join("atual-perto300.png"))
	if FileAccess.file_exists(paineis.path_join("familia-desenhado-100.png")):
		_ler(paineis, "familia-desenhado-100.png").save_png(prova.path_join("familia100.png"))
		_escala(_ler(paineis, "familia-desenhado-100.png"), 0.5).save_png(prova.path_join("familia50.png"))
		_ler(paineis, "familia-desenhado-300.png").save_png(prova.path_join("familia300.png"))
		if tem_atual:
			_ler(paineis, "familia-atual-100.png").save_png(prova.path_join("atual-familia100.png"))
			_escala(_ler(paineis, "familia-atual-100.png"), 0.5).save_png(prova.path_join("atual-familia50.png"))
			_ler(paineis, "familia-atual-300.png").save_png(prova.path_join("atual-familia300.png"))
	var f := FileAccess.open(prova.path_join("resumo.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(resumo, "  "))
	f.close()
	var folha: Image = await _folha(cfg, p, resumo, paineis, pasta_exportada)
	if folha == null or folha.save_png(prova.path_join("folha.png")) != OK:
		erros.append("não consegui salvar %s" % prova.path_join("folha.png"))
	return {"ok": erros.is_empty(), "erros": erros, "resumo": resumo}


# ---------- a folha: primeiro a lista do que vai onde, depois as faixas ----------

func _texto(t: String, x: int, tamanho: int, cor: Color = COR_TINTA, avancar := -1) -> void:
	_ops.append({"t": t, "p": Vector2(x, _y), "s": tamanho, "c": cor})
	_y += tamanho + 12 if avancar < 0 else avancar


func _img(img: Image, x: int, y: int) -> void:
	_ops.append({"i": img, "p": Vector2(x, y)})


## Uma linha de imagens lado a lado com o rótulo em cima de cada uma.
func _linha(imgs: Array, rotulos: Array) -> void:
	var x := MG
	var alto := 0
	for k in imgs.size():
		var im: Image = imgs[k]
		if im == null:
			continue
		if x + im.get_width() > LARGURA - MG and x > MG:
			_y += alto + 40
			x = MG
			alto = 0
		_ops.append({"t": rotulos[k], "p": Vector2(x, _y), "s": 15, "c": COR_TINTA_2})
		_img(im, x, _y + 24)
		x += im.get_width() + MG
		alto = maxi(alto, im.get_height())
	_y += alto + 24 + 30


func _folha(cfg: Dictionary, p: Dictionary, resumo: Dictionary, paineis: String, exportado: String) -> Image:
	_ops = []
	_y = 16
	var tem_atual: bool = p["atual"]
	var mem: Dictionary = resumo["memoria"]
	_texto("%s  ·  %s  ·  Desenhado, onda %d, lote %d  ·  móvel desenhado que pega cor (no app: %s)" % [cfg["nome"], cfg["id"], cfg["onda"], cfg["lote"], cfg["idDoApp"]], MG, 28)
	_texto("Contrato v%d, seção 10  ·  %d formas  ·  memória %.2f de %.2f MiB, %.2f de %.2f MiB em disco  ·  lugares: %s  ·  a sombra é do app (deslocada %.2f casa, borrão %.2f)" % [Contrato.VERSAO, resumo["formas"], mem.get("memoriaBytes", 0) / 1048576.0, ContratoMovel.TETO_MEMORIA_POR_MOVEL / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, ContratoMovel.TETO_DISCO_POR_MOVEL / 1048576.0, ", ".join(PackedStringArray(cfg["lugares"])), cfg["sombra"]["deslocamentoCasas"], cfg["sombra"]["borraoCasas"]], MG, 16, COR_TINTA_2)
	_texto("Desenhado: as imagens cinza com as partes marcadas, tingidas pela conta de ferramentas/movel.ts. Atual: o motor dos móveis do client da main (só leitura), nos mesmos móveis e materiais. 100%% = 64 px por casa; 300%% = 192; 50%% e 25%% reduzidos em Lanczos. Chão chapado %s." % p["chao"], MG, 15, COR_TINTA_3)
	_y += 10
	# Sozinho e as 3 combinações.
	_texto("Sozinho e em 3 combinações de material: %s" % "  |  ".join(PackedStringArray(p["combos"])), MG, 22, COR_TINTA)
	var cd := _ler(paineis, "combos-desenhado-100.png")
	var ca: Image = _ler(paineis, "combos-atual-100.png") if tem_atual else null
	_linha([cd, ca], ["Desenhado a 100%", "Atual a 100%"])
	_linha([_escala(cd, 0.5), _escala(ca, 0.5) if ca != null else null, _escala(cd, 0.25), _escala(ca, 0.25) if ca != null else null], ["Desenhado a 50%", "Atual a 50%", "Desenhado a 25%", "Atual a 25%"])
	_linha([_ler(paineis, "sozinho-desenhado-300.png"), _ler(paineis, "sozinho-atual-300.png") if tem_atual else null], ["Desenhado a 300% (a combinação 1)", "Atual a 300%"])
	# Os tons.
	if not p["tons"].is_empty():
		var nomes := PackedStringArray()
		for t in p["tons"]:
			nomes.append(t["nome"])
		_texto("Os 5 tons de madeira (%s), a 100%%: têm de continuar distinguíveis" % ", ".join(nomes), MG, 22, COR_TINTA)
		_linha([_ler(paineis, "tons-desenhado.png"), _ler(paineis, "tons-atual.png") if tem_atual else null], ["Desenhado", "Atual"])
		var md: Dictionary = p["medidas"]["menorDistancia"]
		var linha := "Média OKLab de %s. Menor distância entre dois tons: Desenhado %.3f (%s)" % [p["medidas"]["onde"], float(md["desenhado"]["valor"]), md["desenhado"]["par"]]
		if md["atual"] != null:
			linha += ", Atual %.3f (%s)" % [float(md["atual"]["valor"]), md["atual"]["par"]]
		_texto(linha, MG, 16, COR_TINTA_2)
		for t in p["medidas"]["porTom"]:
			_texto("%s:  Desenhado %s  ·  Atual %s" % [t["nome"], _medida(t.get("desenhado")), _medida(t.get("atual"))], MG, 15, COR_TINTA_3, 22)
		_y += 20
	# As viradas.
	_texto("As 4 viradas (giro 0, 90, 180 e 270 graus)%s: o Desenhado pinta o quarto de volta com a luz de cima à esquerda; o Atual gira a imagem com a luz junto" % (" e a vista de lado, embaixo" if p["lado"] else ""), MG, 22, COR_TINTA)
	_linha([_ler(paineis, "viradas-desenhado.png"), _ler(paineis, "viradas-atual.png") if tem_atual else null], ["Desenhado a 100%", "Atual a 100%"])
	# Esticada.
	if p["esticar"]:
		_texto("Esticada: 1,4, 2, 3 e 5 casas, e a de 1 x 2 sem giro (estica pelo lado maior). Ponta + meio liso + ponta: o meio estica sem emenda", MG, 22, COR_TINTA)
		var ed := _ler(paineis, "esticada-desenhado.png")
		_linha([ed], ["Desenhado a 100%"])
		if tem_atual:
			_linha([_ler(paineis, "esticada-atual.png")], ["Atual a 100%"])
	# A família.
	if FileAccess.file_exists(paineis.path_join("familia-desenhado-100.png")):
		var fam: Dictionary = p["familia"]
		_texto("A família: numa clareira da grama aprovada, com árvores, arbustos, pedras e o tronco caído da onda 3 (%d de %d móveis já desenhados; o resto, Atual)" % [int(fam["desenhados"]), int(fam["total"])], MG, 22, COR_TINTA)
		var fd := _ler(paineis, "familia-desenhado-100.png")
		var fa: Image = _ler(paineis, "familia-atual-100.png") if tem_atual else null
		_linha([fd, fa], ["Os móveis Desenhados a 100%", "Os móveis Atuais na mesma cena a 100%"])
		_linha([_escala(fd, 0.5), _escala(fa, 0.5) if fa != null else null], ["Desenhados a 50%", "Atuais a 50%"])
		_linha([_ler(paineis, "familia-desenhado-300.png"), _ler(paineis, "familia-atual-300.png") if tem_atual else null], ["Desenhados a 300%", "Atuais a 300%"])
	# Os arquivos.
	_texto("Os arquivos (128 px por casa): o valor em cinza (0,5 = o tom) e as partes (vermelho = lugar 1, verde = lugar 2, azul = lugar 3)", MG, 22, COR_TINTA)
	var imgs := []
	var rot := []
	for fo in p["formas"]:
		imgs.append(_sobre_xadrez(_ler(exportado, fo["valor"])))
		rot.append(fo["nome"])
		imgs.append(_sobre_xadrez(_ler(exportado, fo["partes"])))
		rot.append("partes")
	_linha(imgs, rot)
	var altura := _y + 20
	var vp := SubViewport.new()
	vp.size = Vector2i(LARGURA, mini(altura, BANDA))
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(LARGURA, altura)
	vp.add_child(fundo)
	for op in _ops:
		if op.has("i"):
			var tr := TextureRect.new()
			tr.texture = ImageTexture.create_from_image(op["i"])
			tr.position = op["p"]
			vp.add_child(tr)
		else:
			var l := Label.new()
			l.text = op["t"]
			l.position = op["p"]
			l.add_theme_font_size_override("font_size", op["s"])
			l.add_theme_color_override("font_color", op["c"])
			vp.add_child(l)
	add_child(vp)
	var folha := Image.create(LARGURA, altura, false, Image.FORMAT_RGB8)
	var y0 := 0
	while y0 < altura:
		vp.canvas_transform = Transform2D(0.0, Vector2(0.0, -float(y0)))
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var faixa := vp.get_texture().get_image()
		faixa.convert(Image.FORMAT_RGB8)
		folha.blit_rect(faixa, Rect2i(0, 0, LARGURA, mini(BANDA, altura - y0)), Vector2i(0, y0))
		y0 += BANDA
	vp.queue_free()
	return folha


## A imagem de alfa sobre um xadrez escuro (o transparente aparece).
static func _sobre_xadrez(img: Image) -> Image:
	var r := Image.create(img.get_width(), img.get_height(), false, Image.FORMAT_RGBA8)
	for y in img.get_height():
		for x in img.get_width():
			var q := Color("3a3835") if ((x / 8) + (y / 8)) % 2 == 0 else Color("2c2a28")
			var c := img.get_pixel(x, y)
			r.set_pixel(x, y, q.lerp(Color(c.r, c.g, c.b), c.a))
	return r


static func _medida(m) -> String:
	if typeof(m) != TYPE_DICTIONARY:
		return "-"
	return "L %.3f, a %+.3f, b %+.3f, desvio de L %.3f" % [float(m["L"]), float(m["a"]), float(m["b"]), float(m["dpL"])]


static func _ler(pasta: String, nome: String) -> Image:
	var img := Image.load_from_file(pasta.path_join(nome))
	if img == null or img.is_empty():
		img = Image.create(8, 8, false, Image.FORMAT_RGB8)
	return img


static func _escala(img: Image, k: float) -> Image:
	if img == null:
		return null
	var r := img.duplicate() as Image
	r.resize(maxi(1, int(round(img.get_width() * k))), maxi(1, int(round(img.get_height() * k))), Image.INTERPOLATE_LANCZOS)
	return r


func _ler_viewport(vp: SubViewport) -> Image:
	for tentativa in LEITURAS:
		var img := vp.get_texture().get_image()
		if img != null and not img.is_empty() and not _sem_desenho(img):
			return img
		await _quadros(2)
	return null


static func _sem_desenho(img: Image) -> bool:
	var a := img.get_pixel(0, 0)
	for y in range(0, img.get_height(), 7):
		for x in range(0, img.get_width(), 7):
			var b := img.get_pixel(x, y)
			if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) > 0.004:
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

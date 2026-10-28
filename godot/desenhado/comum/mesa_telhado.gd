extends Node
## CONGELADO. A mesa de prova de um telhado, de uma faixa ou de um objeto (onda 2).
## A montagem é a de ferramentas/telhado.ts (as águas do próprio app,
## client/src/lib/telhado/aguas.ts, e a conta de tingir): ela grava os painéis a
## 100% e esta mesa só os arruma na folha, a 25%, 50%, 100% e 300%, em 3 cores, com
## o Atual (o pintarTelhado de hoje) ao lado.

const Contrato := preload("res://comum/contrato.gd")

const MG := 28
const CENA_A := Vector2i(1152, 640) ## 18 x 10 casas
const CENA_B := Vector2i(1920, 640) ## 30 x 10 casas
const PERTO := 576 ## 3 x 3 casas a 300%
const LARGURA := MG + 4 * (PERTO + MG)
const BANDA := 2048 ## a folha é desenhada em faixas desta altura
const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")

## Quem vai por baixo de uma faixa ou de um objeto, quando o config não diz ("sob").
const SOB_PADRAO := {"faixa": "telhado-palha", "objeto": "telhado-telhas"}


## Devolve {"ok", "erros", "resumo"}.
func montar(cfg: Dictionary, pasta_exportada: String, prova: String, sem_atual: bool) -> Dictionary:
	var erros: Array[String] = []
	var paineis := prova.path_join("paineis")
	DirAccess.make_dir_recursive_absolute(paineis)
	var raiz := Contrato.raiz_do_repo()
	var entrada := ProjectSettings.globalize_path("res://ferramentas/telhado.ts")
	var mjs := ProjectSettings.globalize_path("res://ferramentas/.build/telhado.mjs")
	var saida_cmd := []
	var c := OS.execute("node", [raiz.path_join("node_modules/esbuild/bin/esbuild"), entrada, "--bundle", "--platform=node", "--format=esm", "--log-level=warning", "--outfile=" + mjs], saida_cmd, true)
	if c != 0:
		erros.append("o esbuild falhou (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
		return {"ok": false, "erros": erros, "resumo": {}}
	var argv := [mjs, "--textura=" + pasta_exportada, "--saida=" + paineis]
	var exportado := ProjectSettings.globalize_path("res://exportado")
	if cfg["tipo"] != "telhado":
		argv.append("--sob=" + exportado.path_join(cfg.get("sob", SOB_PADRAO[cfg["tipo"]])))
	elif cfg["faixa"] != null and cfg["faixa"].has("de"):
		argv.append("--faixa=" + exportado.path_join(cfg["faixa"]["de"]))
	if sem_atual:
		argv.append("--sem-atual")
	saida_cmd = []
	c = OS.execute("node", argv, saida_cmd, true)
	var texto := "".join(saida_cmd).strip_edges()
	if c != 0:
		erros.append("ferramentas/telhado.ts falhou (%d): %s" % [c, texto])
		return {"ok": false, "erros": erros, "resumo": {}}
	print("  ", texto)
	var p = JSON.parse_string(FileAccess.get_file_as_string(paineis.path_join("paineis.json")))
	if typeof(p) != TYPE_DICTIONARY:
		erros.append("paineis.json não saiu")
		return {"ok": false, "erros": erros, "resumo": {}}
	var params = JSON.parse_string(FileAccess.get_file_as_string(pasta_exportada.path_join(Contrato.ARQUIVO_DE_PARAMETROS)))
	var resumo := {
		"id": cfg["id"], "nome": cfg["nome"], "tipo": cfg["tipo"], "onda": cfg["onda"], "lote": cfg["lote"],
		"modelo": p["modelo"], "cores": p["cores"], "medidas": p["medidas"], "avisos": p["avisos"],
		"atual": {"ok": p["atual"]},
		"memoria": params.get("memoria", {}) if typeof(params) == TYPE_DICTIONARY else {},
		"valorMedio": params.get("valorMedio", null) if typeof(params) == TYPE_DICTIONARY else null,
	}
	var perto: Dictionary = p["cenaA"]["perto"]
	var recorte := Rect2i(int(perto["x"]), int(perto["y"]), int(perto["lado"]), int(perto["lado"]))
	# As peças da folha do lote: a cena A na cor padrão a 50% e o close a 300%.
	var d0 := _ler(paineis, "cenaA-0-desenhado.png")
	_escala(d0, 0.5).save_png(prova.path_join("area50.png"))
	_perto(d0, recorte).save_png(prova.path_join("perto300.png"))
	if p["atual"]:
		var a0 := _ler(paineis, "cenaA-0-atual.png")
		_escala(a0, 0.5).save_png(prova.path_join("atual-area50.png"))
		_perto(a0, recorte).save_png(prova.path_join("atual-perto300.png"))
	var f := FileAccess.open(prova.path_join("resumo.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(resumo, "  "))
	f.close()
	var folha: Image = await _folha(cfg, p, resumo, paineis, recorte)
	if folha.save_png(prova.path_join("folha.png")) != OK:
		erros.append("não consegui salvar %s" % prova.path_join("folha.png"))
	return {"ok": erros.is_empty(), "erros": erros, "resumo": resumo}


static func _ler(pasta: String, nome: String) -> Image:
	var img := Image.load_from_file(pasta.path_join(nome))
	if img == null or img.is_empty():
		img = Image.create(8, 8, false, Image.FORMAT_RGB8)
	return img


## Reduz como a placa de vídeo com mipmap faria (Lanczos é o mais perto numa imagem só).
static func _escala(img: Image, k: float) -> Image:
	var r := img.duplicate() as Image
	r.resize(int(round(img.get_width() * k)), int(round(img.get_height() * k)), Image.INTERPOLATE_LANCZOS)
	return r


## O close a 300%: o recorte a 1 px por px do mapa, ampliado 3 vezes em bilinear (o que a placa faz).
static func _perto(img: Image, recorte: Rect2i) -> Image:
	var r := img.get_region(recorte)
	r.resize(recorte.size.x * 3, recorte.size.y * 3, Image.INTERPOLATE_BILINEAR)
	return r


func _folha(cfg: Dictionary, p: Dictionary, resumo: Dictionary, paineis: String, recorte: Rect2i) -> Image:
	var tem_atual: bool = p["atual"]
	var topo := 150
	var bloco := 56 + CENA_A.y + 38 + PERTO + 44
	var y_grande := topo + 3 * bloco
	var y_arquivos := y_grande + 40 + CENA_B.y / 2 + 44
	var altura := y_arquivos + 40 + 520
	# A folha passa de 5000 px de altura: um SubViewport desse tamanho volta preto nesta
	# placa (conferido em 28/10). Ela é desenhada em faixas de BANDA px, rolando o canvas.
	var vp := SubViewport.new()
	vp.size = Vector2i(LARGURA, mini(altura, BANDA))
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = COR_FUNDO
	fundo.size = Vector2(LARGURA, altura)
	vp.add_child(fundo)
	var mem: Dictionary = resumo["memoria"]
	_rotulo(vp, "%s  ·  %s  ·  Desenhado, onda %d, lote %d  ·  tipo %s, modelo do app %s" % [cfg["nome"], cfg["id"], cfg["onda"], cfg["lote"], cfg["tipo"], p["modelo"]], Vector2(MG, 16), 28, COR_TINTA)
	var info := "Contrato v%d, seção 8  ·  memória: %.2f de %.1f MiB, %.2f de %.2f MiB em disco" % [Contrato.VERSAO, mem.get("gpuBytes", 0) / 1048576.0, Contrato.TETO_GPU_POR_TEXTURA / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, Contrato.TETO_DISCO_POR_TEXTURA / 1048576.0]
	if resumo["valorMedio"] != null:
		info += "  ·  valor médio da base-1 %.3f (0,5 = a cor do mestre)" % float(resumo["valorMedio"])
	info += "  ·  faixa: %s  ·  objeto: %s  ·  telhado Desenhado por baixo: %s" % ["sim" if p["faixa"] else "não", "sim" if p["objeto"] else "não", "sim" if p["telhadoPorBaixo"] else "não (liso)"]
	_rotulo(vp, info, Vector2(MG, 58), 17, COR_TINTA_2)
	_rotulo(vp, "Montado com as águas do app (aguas.ts) e a conta de tingir (PROPOSTA-TINGIR.md), 1 px por px do mapa; 50%% e 25%% reduzidos em Lanczos, 300%% ampliado em bilinear. Chão chapado (grama #8cbf80) e a sombra do app (6, 8 px, 25%%). Atual: pintarTelhado de hoje.", Vector2(MG, 84), 16, COR_TINTA_3)
	if not p["avisos"].is_empty():
		_rotulo(vp, "Avisos: " + "; ".join(PackedStringArray(p["avisos"])), Vector2(MG, 108), 16, COR_TINTA_2)
	for k in p["cores"].size():
		var y: int = topo + k * bloco
		var m: Dictionary = p["medidas"][k]
		var titulo := "Cor %d: %s (%s)  ·  média do telhado - cor escolhida, em luz OKLab: Desenhado %+.3f" % [k + 1, m["nome"], m["cor"], float(m["deltaLDesenhado"])]
		if m.has("deltaLAtual"):
			titulo += ", Atual %+.3f" % float(m["deltaLAtual"])
		_rotulo(vp, titulo, Vector2(MG, y), 22, COR_TINTA)
		var d := _ler(paineis, "cenaA-%d-desenhado.png" % k)
		var a: Image = _ler(paineis, "cenaA-%d-atual.png" % k) if tem_atual else null
		_rotulo(vp, "Desenhado  ·  a casa retangular e a casa em L a 100% (18 x 10 casas)", Vector2(MG, y + 30), 16, COR_TINTA_2)
		_imagem(vp, d, Vector2(MG, y + 56))
		if a != null:
			_rotulo(vp, "Atual  ·  as mesmas casas a 100%", Vector2(MG + CENA_A.x + MG, y + 30), 16, COR_TINTA_2)
			_imagem(vp, a, Vector2(MG + CENA_A.x + MG, y + 56))
		var y2: int = y + 56 + CENA_A.y + 38
		var x := MG
		_rotulo(vp, "Desenhado a 50% e a 25%", Vector2(x, y2 - 26), 16, COR_TINTA_2)
		_imagem(vp, _escala(d, 0.5), Vector2(x, y2))
		_imagem(vp, _escala(d, 0.25), Vector2(x, y2 + CENA_A.y / 2 + 16))
		x += PERTO + MG
		if a != null:
			_rotulo(vp, "Atual a 50% e a 25%", Vector2(x, y2 - 26), 16, COR_TINTA_2)
			_imagem(vp, _escala(a, 0.5), Vector2(x, y2))
			_imagem(vp, _escala(a, 0.25), Vector2(x, y2 + CENA_A.y / 2 + 16))
		x += PERTO + MG
		_rotulo(vp, "Desenhado a 300% (o rincão e as cumeeiras do L)", Vector2(x, y2 - 26), 16, COR_TINTA_2)
		_imagem(vp, _perto(d, recorte), Vector2(x, y2))
		x += PERTO + MG
		if a != null:
			_rotulo(vp, "Atual a 300%", Vector2(x, y2 - 26), 16, COR_TINTA_2)
			_imagem(vp, _perto(a, recorte), Vector2(x, y2))
	_rotulo(vp, "Telhado grande (28 x 8 casas) a 50%%, %s: procure repetição" % p["cores"][0]["nome"], Vector2(MG, y_grande), 22, COR_TINTA)
	_imagem(vp, _escala(_ler(paineis, "cenaB-0-desenhado.png"), 0.5), Vector2(MG, y_grande + 40))
	if tem_atual:
		_imagem(vp, _escala(_ler(paineis, "cenaB-0-atual.png"), 0.5), Vector2(MG + CENA_B.x / 2 + MG, y_grande + 40))
	_rotulo(vp, "Arquivos: valor e lado em cinza (0,5 = a cor do mestre / plano); a faixa ampliada 2x; o objeto a 2x sobre a cor padrão", Vector2(MG, y_arquivos), 22, COR_TINTA)
	var xa := MG
	var ya := y_arquivos + 40
	for nome in p["arquivos"]:
		var img := _ler(paineis, nome)
		if nome.begins_with("arquivo-base"):
			img = _escala(img, 0.5)
		else:
			img.resize(img.get_width() * 2, img.get_height() * 2, Image.INTERPOLATE_NEAREST)
		if xa + img.get_width() > LARGURA - MG:
			xa = MG
			ya += 300
		_imagem(vp, img, Vector2(xa, ya))
		_rotulo(vp, nome.trim_prefix("arquivo-").trim_suffix(".png"), Vector2(xa, ya + img.get_height() + 4), 14, COR_TINTA_3)
		xa += img.get_width() + MG
	add_child(vp)
	var folha := Image.create(LARGURA, altura, false, Image.FORMAT_RGB8)
	var y0 := 0
	while y0 < altura:
		vp.canvas_transform = Transform2D(0.0, Vector2(0.0, -float(y0)))
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var faixa := vp.get_texture().get_image()
		faixa.convert(Image.FORMAT_RGB8)
		var h := mini(BANDA, altura - y0)
		folha.blit_rect(faixa, Rect2i(0, 0, LARGURA, h), Vector2i(0, y0))
		y0 += BANDA
	vp.queue_free()
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

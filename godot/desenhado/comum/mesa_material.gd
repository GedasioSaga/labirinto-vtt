extends Node
## CONGELADO. A mesa de prova de um material de móvel (onda 4, CONTRATO.md seção 10).
## A montagem é a de ferramentas/moveis.ts: móveis REAIS, montados pelo motor dos móveis
## do client da main (só leitura, empacotado por ferramentas/construir.mjs), com a
## superfície da classe trocada pela do Desenhado (ferramentas/material.ts); o Atual é o
## mesmo motor sem a troca. Ela grava os painéis a 100% e 300%; esta mesa só os arruma na
## folha, reduz para 50% e 25% (Lanczos) e grava as peças da folha do lote.

const Contrato := preload("res://comum/contrato.gd")
const ContratoMaterial := preload("res://comum/contrato_material.gd")

const MG := 28
const CENA := Vector2i(1024, 640) ## 16 x 10 casas a 100%
const TONS := Vector2i(1024, 205) ## 16 x 3,2 casas
const TRESQ := Vector2i(1024, 230) ## 16 x 3,6 casas
const PERTO := 576 ## 3 x 3 casas a 300%
const LARGURA := MG + 4 * (PERTO + MG)
const BANDA := 2048 ## a folha é desenhada em faixas desta altura
const COR_FUNDO := Color("1c1b19")
const COR_TINTA := Color("ece6da")
const COR_TINTA_2 := Color("b9b1a3")
const COR_TINTA_3 := Color("8d8579")


## Devolve {"ok", "erros", "resumo"}.
func montar(cfg: Dictionary, pasta_exportada: String, prova: String, sem_atual: bool) -> Dictionary:
	var erros: Array[String] = []
	var paineis := prova.path_join("paineis")
	DirAccess.make_dir_recursive_absolute(paineis)
	var construir := ProjectSettings.globalize_path("res://ferramentas/construir.mjs")
	var entrada := ProjectSettings.globalize_path("res://ferramentas/moveis.ts")
	var mjs := ProjectSettings.globalize_path("res://ferramentas/.build/moveis.mjs")
	var saida_cmd := []
	var c := OS.execute("node", [construir, entrada, mjs], saida_cmd, true)
	if c != 0:
		erros.append("ferramentas/construir.mjs falhou (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
		return {"ok": false, "erros": erros, "resumo": {}}
	print("  ", "".join(saida_cmd).strip_edges())
	var argv := [mjs, "--textura=" + pasta_exportada, "--saida=" + paineis]
	if sem_atual:
		argv.append("--sem-atual")
	saida_cmd = []
	c = OS.execute("node", argv, saida_cmd, true)
	var texto := "".join(saida_cmd).strip_edges()
	if c != 0:
		erros.append("ferramentas/moveis.ts falhou (%d): %s" % [c, texto])
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
		"id": cfg["id"], "nome": cfg["nome"], "tipo": cfg["tipo"], "classe": cfg["classe"], "onda": cfg["onda"], "lote": cfg["lote"],
		"tons": p["tresTons"], "medidas": p["medidas"], "atual": {"ok": p["atual"]},
		"memoria": params.get("memoria", {}), "imagens": params.get("imagens", []), "tingir": params.get("tingir", {}),
	}
	# As peças da folha do lote: a cena no primeiro tom a 50% e o close a 300%.
	_escala(_ler(paineis, "cena-0-desenhado.png"), 0.5).save_png(prova.path_join("area50.png"))
	_ler(paineis, "perto-0-desenhado.png").save_png(prova.path_join("perto300.png"))
	if p["atual"]:
		_escala(_ler(paineis, "cena-0-atual.png"), 0.5).save_png(prova.path_join("atual-area50.png"))
		_ler(paineis, "perto-0-atual.png").save_png(prova.path_join("atual-perto300.png"))
	var f := FileAccess.open(prova.path_join("resumo.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(resumo, "  "))
	f.close()
	var folha: Image = await _folha(cfg, p, resumo, paineis)
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


static func _medida(m) -> String:
	if typeof(m) != TYPE_DICTIONARY:
		return "-"
	return "L %.3f, a %+.3f, b %+.3f, desvio de L %.3f" % [float(m["L"]), float(m["a"]), float(m["b"]), float(m["dpL"])]


func _folha(cfg: Dictionary, p: Dictionary, resumo: Dictionary, paineis: String) -> Image:
	var tem_atual: bool = p["atual"]
	var topo := 150
	var bloco := 56 + CENA.y + 38 + PERTO + 44
	var y_tons := topo + 3 * bloco
	var n_tons: int = p["tons"].size()
	var y_tresq := y_tons + 40 + TONS.y + 30 + TONS.y / 2 + 30 + 24 * (n_tons + 1) + 30
	var y_arquivos := y_tresq + 40 + TRESQ.y + 44
	var linhas_de_arquivos := int(ceil(p["arquivos"].size() / 2.0))
	var altura := y_arquivos + 40 + linhas_de_arquivos * (256 + 40) + 20
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
	_rotulo(vp, "%s  ·  %s  ·  Desenhado, onda %d, lote %d  ·  material da classe %s" % [cfg["nome"], cfg["id"], cfg["onda"], cfg["lote"], cfg["classe"]], Vector2(MG, 16), 28, COR_TINTA)
	var info := "Contrato v%d, seção 10  ·  memória: %.2f de %.2f MiB, %.2f de %.2f MiB em disco, 0 a mais na placa  ·  tingir: luz OKLab, ganhoL %.2f" % [Contrato.VERSAO, mem.get("memoriaBytes", 0) / 1048576.0, ContratoMaterial.TETO_MEMORIA_POR_MATERIAL / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, ContratoMaterial.TETO_DISCO_POR_MATERIAL / 1048576.0, float(resumo["tingir"].get("ganhoL", 0.0))]
	for im in resumo["imagens"]:
		info += "  ·  %s: valor médio %.3f, emendas %.2f / %.2f" % [im["nome"], float(im["valorMedio"]), float(im["emendas"]["u"]), float(im["emendas"]["v"])]
	_rotulo(vp, info, Vector2(MG, 58), 17, COR_TINTA_2)
	_rotulo(vp, "Móveis REAIS do motor do app (client da main, só leitura): só a superfície da classe %s trocada; o formato, o chanfro, a luz e a sombra são os de hoje. 100%% = a imagem do nível 1 (50 px por casa) a 64 px por casa; 300%% = o nível 3 a 192 px por casa; 50%% e 25%% reduzidos em Lanczos. Chão chapado %s." % [cfg["classe"], p["chao"]], Vector2(MG, 84), 16, COR_TINTA_3)
	_rotulo(vp, "Os outros materiais (aros, assento, cobertor) ficam como hoje. Atual: o mesmo motor sem a troca.", Vector2(MG, 108), 16, COR_TINTA_3)
	for k in p["tresTons"].size():
		var y: int = topo + k * bloco
		var tom: Dictionary = p["tresTons"][k]
		_rotulo(vp, "Tom %d: %s (%s, pintado %s)" % [k + 1, tom["nome"], tom["hex"], tom["tom"]], Vector2(MG, y), 22, COR_TINTA)
		var d := _ler(paineis, "cena-%d-desenhado.png" % k)
		var a: Image = _ler(paineis, "cena-%d-atual.png" % k) if tem_atual else null
		_rotulo(vp, "Desenhado  ·  a cena a 100% (16 x 10 casas)", Vector2(MG, y + 30), 16, COR_TINTA_2)
		_imagem(vp, d, Vector2(MG, y + 56))
		if a != null:
			_rotulo(vp, "Atual  ·  os mesmos móveis a 100%", Vector2(MG + CENA.x + MG, y + 30), 16, COR_TINTA_2)
			_imagem(vp, a, Vector2(MG + CENA.x + MG, y + 56))
		var y2: int = y + 56 + CENA.y + 38
		var x := MG
		_rotulo(vp, "Desenhado a 50% e a 25%", Vector2(x, y2 - 26), 16, COR_TINTA_2)
		_imagem(vp, _escala(d, 0.5), Vector2(x, y2))
		_imagem(vp, _escala(d, 0.25), Vector2(x, y2 + CENA.y / 2 + 16))
		x += CENA.x / 2 + MG
		if a != null:
			_rotulo(vp, "Atual a 50% e a 25%", Vector2(x, y2 - 26), 16, COR_TINTA_2)
			_imagem(vp, _escala(a, 0.5), Vector2(x, y2))
			_imagem(vp, _escala(a, 0.25), Vector2(x, y2 + CENA.y / 2 + 16))
		x += CENA.x / 2 + MG
		_rotulo(vp, "Desenhado a 300%", Vector2(x, y2 - 26), 16, COR_TINTA_2)
		_imagem(vp, _ler(paineis, "perto-%d-desenhado.png" % k), Vector2(x, y2))
		x += PERTO + MG
		if tem_atual:
			_rotulo(vp, "Atual a 300%", Vector2(x, y2 - 26), 16, COR_TINTA_2)
			_imagem(vp, _ler(paineis, "perto-%d-atual.png" % k), Vector2(x, y2))
	var nomes := PackedStringArray()
	for t in p["tons"]:
		nomes.append(t["nome"])
	_rotulo(vp, "Os %d tons da classe (%s), a 100%% e a 50%%: têm de continuar distinguíveis" % [n_tons, ", ".join(nomes)], Vector2(MG, y_tons), 22, COR_TINTA)
	var td := _ler(paineis, "tons-desenhado.png")
	_imagem(vp, td, Vector2(MG, y_tons + 40))
	_imagem(vp, _escala(td, 0.5), Vector2(MG, y_tons + 40 + TONS.y + 30))
	if tem_atual:
		var ta := _ler(paineis, "tons-atual.png")
		_imagem(vp, ta, Vector2(MG + TONS.x + MG, y_tons + 40))
		_imagem(vp, _escala(ta, 0.5), Vector2(MG + TONS.x + MG, y_tons + 40 + TONS.y + 30))
	var ym := y_tons + 40 + TONS.y + 30 + TONS.y / 2 + 30
	var md: Dictionary = p["medidas"]["menorDistancia"]
	var onde: String = str(p["medidas"].get("onde", "o miolo do tampo da mesa sozinha"))
	var linha := "Média OKLab de %s, e o desvio da luz (quanto a superfície varia). Menor distância entre dois tons: Desenhado %.3f (%s)" % [onde, float(md["desenhado"]["valor"]), md["desenhado"]["par"]]
	if md["atual"] != null:
		linha += ", Atual %.3f (%s)" % [float(md["atual"]["valor"]), md["atual"]["par"]]
	_rotulo(vp, linha, Vector2(MG, ym), 17, COR_TINTA_2)
	for i in p["medidas"]["porTom"].size():
		var t: Dictionary = p["medidas"]["porTom"][i]
		_rotulo(vp, "%s:  Desenhado %s  ·  Atual %s" % [t["nome"], _medida(t.get("desenhado")), _medida(t.get("atual"))], Vector2(MG, ym + 24 * (i + 1)), 16, COR_TINTA_3)
	_rotulo(vp, "Vista 3/4 do mapa, %s, a 100%%" % p["tresTons"][0]["nome"], Vector2(MG, y_tresq), 22, COR_TINTA)
	_imagem(vp, _ler(paineis, "tresq-desenhado.png"), Vector2(MG, y_tresq + 40))
	if tem_atual:
		_imagem(vp, _ler(paineis, "tresq-atual.png"), Vector2(MG + TRESQ.x + MG, y_tresq + 40))
	_rotulo(vp, "Arquivos: o valor em cinza (0,5 = o tom do material) a 128 px por casa, e repetido 2 x 2 reduzido à metade (a emenda no meio)", Vector2(MG, y_arquivos), 22, COR_TINTA)
	var n_arq := 0
	for nome in p["arquivos"]:
		var xa := MG + (n_arq % 2) * (1024 + MG)
		var ya := y_arquivos + 40 + (n_arq / 2) * (256 + 40)
		_imagem(vp, _ler(paineis, nome), Vector2(xa, ya))
		_rotulo(vp, nome.trim_prefix("arquivo-").trim_suffix(".png"), Vector2(xa, ya + 260), 14, COR_TINTA_3)
		n_arq += 1
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

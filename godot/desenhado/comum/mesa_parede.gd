extends "res://comum/mesa_traco.gd"
## A mesa da SALA (onda 5, CONTRATO.md seção 11.15): a parede, a janela e a grade de prisão.
## A montagem é a de ferramentas/parede.ts (os dois passes: o contorno do app e o miolo pela
## imagem), chamada por ferramentas/mesa_parede.ts, que grava os painéis; esta mesa pinta
## antes os dois chões (a grama e o chão de sala aprovados, em cinza; o node tinge o de sala)
## e depois arruma a folha, a 25%, 50%, 100% e 300%, com o Atual (as linhas de
## pixi/drawWalls.ts e a grade de pixi/gradeDePrisao.ts) ao lado. Os auxiliares (ler, escalar,
## esperar quadros, o xadrez) são os da mesa dos traços, herdados.

const CHAOS := ["grama", "piso"]


func montar(cfg: Dictionary, pasta_exportada: String, prova: String, args: Dictionary) -> Dictionary:
	var erros: Array[String] = []
	var paineis := prova.path_join("paineis")
	DirAccess.make_dir_recursive_absolute(paineis)
	# 1. O pacote da mesa (o client da main, só leitura) e o plano dos chões.
	var construir := ProjectSettings.globalize_path("res://ferramentas/construir.mjs")
	var entrada := ProjectSettings.globalize_path("res://ferramentas/mesa_parede.ts")
	var mjs := ProjectSettings.globalize_path("res://ferramentas/.build/mesa_parede.mjs")
	var saida_cmd := []
	var c := OS.execute("node", [construir, entrada, mjs], saida_cmd, true)
	if c != 0:
		erros.append("ferramentas/construir.mjs falhou (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
		return {"ok": false, "erros": erros}
	saida_cmd = []
	c = OS.execute("node", [mjs, "--plano=" + paineis.path_join("plano.json")], saida_cmd, true)
	var plano = JSON.parse_string(FileAccess.get_file_as_string(paineis.path_join("plano.json")))
	if c != 0 or typeof(plano) != TYPE_DICTIONARY:
		erros.append("o plano dos chões não saiu (%d): %s" % [c, "".join(saida_cmd).strip_edges()])
		return {"ok": false, "erros": erros}
	# 2. Os chões, montados como o app monta (comum/compor.gdshader), um de cada vez.
	for tex in CHAOS:
		var lido := Contrato.ler_config(tex)
		if not lido["ok"]:
			erros.append("o chão aprovado texturas/%s/config.json não leu" % tex)
			return {"ok": false, "erros": erros}
		var mesa_c := Mesa.new()
		add_child(mesa_c)
		if not mesa_c._carregar(lido["config"], ProjectSettings.globalize_path("res://exportado/%s" % tex), erros):
			return {"ok": false, "erros": erros}
		var vistas := {}
		for ch in plano["chaos"]:
			if ch["textura"] != tex:
				continue
			vistas[ch["nome"]] = mesa_c._vista(lido["config"], 0, Vector2(ch["origem"][0], ch["origem"][1]), float(ch["zoom"]), float(ch["lado"]), false, Vector2.ZERO)
		await _quadros(2)
		for nome in vistas:
			var img: Image = await _ler_viewport(vistas[nome])
			vistas[nome].queue_free()
			if img == null:
				erros.append("%s: a placa de vídeo devolveu a imagem vazia" % nome)
				continue
			img.convert(Image.FORMAT_RGBA8)
			img.save_png(paineis.path_join(nome + ".png"))
		mesa_c.queue_free()
		if not erros.is_empty():
			return {"ok": false, "erros": erros}
	# 3. Os painéis.
	var argv := [mjs, "--textura=" + pasta_exportada, "--exportado=" + ProjectSettings.globalize_path("res://exportado"), "--saida=" + paineis]
	saida_cmd = []
	c = OS.execute("node", argv, saida_cmd, true)
	var texto := "".join(saida_cmd).strip_edges()
	if c != 0:
		erros.append("ferramentas/mesa_parede.ts falhou (%d): %s" % [c, texto])
		return {"ok": false, "erros": erros}
	print("  ", texto)
	var p = JSON.parse_string(FileAccess.get_file_as_string(paineis.path_join("paineis.json")))
	var params = JSON.parse_string(FileAccess.get_file_as_string(pasta_exportada.path_join(Contrato.ARQUIVO_DE_PARAMETROS)))
	if typeof(p) != TYPE_DICTIONARY or typeof(params) != TYPE_DICTIONARY:
		erros.append("paineis.json ou textura.json não leu")
		return {"ok": false, "erros": erros}
	# As peças da folha do lote (scripts/folha_do_lote_tracos.gd).
	var primeiro: String = p["pertos"][0]["nome"]
	_escala(_ler(paineis, "formas-desenhado-100.png"), 0.5).save_png(prova.path_join("area50.png"))
	_escala(_ler(paineis, "formas-atual50-100.png"), 0.5).save_png(prova.path_join("atual-area50.png"))
	_ler(paineis, "perto-%s-desenhado-300.png" % primeiro).save_png(prova.path_join("perto300.png"))
	_ler(paineis, "perto-%s-atual-300.png" % primeiro).save_png(prova.path_join("atual-perto300.png"))
	_escala(_ler(paineis, p.get("familia", "casa-desenhado-0-100.png")), 0.5).save_png(prova.path_join("familia50.png"))
	var resumo := {"id": cfg["id"], "nome": cfg["nome"], "idDoApp": cfg.get("idDoApp"), "tipo": "traco", "parte": cfg["parte"], "onda": cfg["onda"], "lote": cfg["lote"], "mesa": "sala", "memoria": params.get("memoria", {}), "atual": {"ok": true}, "avisos": p["avisos"], "face": p["face"], "borda": null, "modulosCasas": p["modulosCasas"], "costuraEntreItens": p["costuraEntreItens"]}
	var f := FileAccess.open(prova.path_join("resumo.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(resumo, "  "))
	f.close()
	var folha: Image = await _folha_da_sala(cfg, p, params, paineis, pasta_exportada)
	if folha.save_png(prova.path_join("folha.png")) != OK:
		erros.append("não consegui salvar a folha")
	return {"ok": erros.is_empty(), "erros": erros, "resumo": resumo}


func _folha_da_sala(cfg: Dictionary, p: Dictionary, params: Dictionary, paineis: String, exportado: String) -> Image:
	_itens.clear()
	_y = 16
	var mem: Dictionary = params.get("memoria", {})
	var ci: Dictionary = p["costuraEntreItens"]
	_texto("%s  ·  %s  ·  Desenhado, onda %d, lote %d  ·  traço, parte %s, mesa da sala" % [cfg["nome"], cfg["id"], cfg["onda"], cfg["lote"], cfg["parte"]], 28)
	var info := "Contrato v%d, seção 11.15  ·  memória %.2f de %.1f MiB, %.2f de %.2f MiB em disco  ·  módulos %s casas, costura no item %s/255, entre a parede e os vãos %s/255 na cor e %s/255 no relevo" % [Contrato.VERSAO, mem.get("memoriaBytes", 0) / 1048576.0, mem.get("tetoMemoriaBytes", 0) / 1048576.0, mem.get("discoBytes", 0) / 1048576.0, mem.get("tetoDiscoBytes", 0) / 1048576.0, str(p["modulosCasas"]), str(params["face"]["costura"]["maior"]) if params.has("face") else "?", str(ci["cor"]), str(ci["relevo"])]
	_texto(info, 17, COR_TINTA_2)
	_texto("Os dois passes do app: o contorno de todas as paredes na cor escura da rampa e depois o miolo pela imagem, a parede que encosta (o T) primeiro, para as paredes se fundirem. Espessura do mundo nas 3 linhas: 20 (fina, Baixo), 32 (média, Médio), 48 px (grossa, Alto). Cor do mestre #d8d2c4 (a de hoje).", 15, COR_TINTA_3)
	_texto("Atual: as linhas de pixi/drawWalls.ts (2 px de TELA, ponta redonda; a janela, dois fios de 1 px a 4 px) e a grade do Meio-Termo (pixi/gradeDePrisao.ts), refeitas por pixel para o zoom de cada painel.", 15, COR_TINTA_3)
	if not p["avisos"].is_empty():
		_texto("Avisos: " + "; ".join(PackedStringArray(p["avisos"])), 15, COR_TINTA_2)
	_y += 10
	var fd := _ler(paineis, "formas-desenhado-100.png")
	# As portas (lote 18) mandam os próprios títulos; sem eles, os da parede.
	var titulos: Dictionary = p.get("titulos", {})
	_texto(titulos.get("formas", "As formas a 100%: duas retas com o vão de uma porta, a quina, o T e a sala fechada, nas 3 espessuras (de cima para baixo)"), 22)
	_fila([fd], ["Desenhado"])
	_fila([_ler(paineis, "formas-atual-100.png")], ["Atual"])
	_texto("A 50% e a 25%", 22)
	_fila([_escala(fd, 0.5), _escala(_ler(paineis, "formas-atual50-100.png"), 0.5)], ["Desenhado a 50%", "Atual a 50%"])
	_fila([_escala(fd, 0.25), _escala(_ler(paineis, "formas-atual25-100.png"), 0.25)], ["Desenhado a 25%", "Atual a 25%"])
	_texto(titulos.get("paredao", "O paredão: 38 casas nas 3 espessuras, a 50% (procure a repetição dos módulos)"), 22)
	_fila([_escala(_ler(paineis, "paredao-desenhado-100.png"), 0.5)], ["Desenhado"])
	_fila([_escala(_ler(paineis, "paredao-atual50-100.png"), 0.5)], ["Atual"])
	_texto("A 300%", 22)
	for perto in p["pertos"]:
		_fila([_ler(paineis, "perto-%s-desenhado-300.png" % perto["nome"]), _ler(paineis, "perto-%s-atual-300.png" % perto["nome"])], ["Desenhado, %s" % perto["titulo"], "Atual"])
	var cores: Array = p["cores"]
	_texto(titulos.get("casa", "A família: a casa (salão, quarto e cela; portas, janelas e as grades) no chão de sala aprovado, tingido, com os móveis da onda 4; a grama aprovada fora"), 22)
	if titulos.has("casas"):
		for linha in titulos["casas"]:
			_fila([_ler(paineis, linha[0]), _ler(paineis, linha[2])], [linha[1], linha[3]])
	else:
		_fila([_ler(paineis, "casa-desenhado-0-100.png"), _ler(paineis, "casa-atual-100.png")], ["Desenhado, parede %s, a 100%%" % cores[0], "Atual (as paredes de hoje; os móveis Desenhados)"])
		_fila([_ler(paineis, "casa-desenhado-1-100.png"), _ler(paineis, "casa-desenhado-2-100.png")], ["Desenhado, parede %s" % cores[1], "Desenhado, parede %s" % cores[2]])
	_fila([_escala(_ler(paineis, "casa-desenhado-0-100.png"), 0.5), _escala(_ler(paineis, "casa-desenhado-1-100.png"), 0.5), _escala(_ler(paineis, "casa-atual50-100.png"), 0.5)], ["Desenhado a 50%", "Desenhado a 50%%, %s" % cores[1], "Atual a 50%"])
	_texto("Arquivos (sobre xadrez; o relevo em cor: vermelho = ao longo, verde = atravessando)", 22)
	if params.has("alturas"):
		for alt in ["baixo", "medio", "alto"]:
			var a: Dictionary = params["alturas"][alt]["arquivos"]
			var cor := _sobre_xadrez(_ler(exportado, a["cor"]))
			var rel := _ler(exportado, a["relevo"])
			if cor.get_width() > LARGURA - 2 * MG:
				cor = _escala(cor, float(LARGURA - 2 * MG) / cor.get_width())
				rel = _escala(rel, float(LARGURA - 2 * MG) / rel.get_width())
			_fila([cor], [a["cor"]])
			_fila([rel], [a["relevo"]])
	return await _pintar_folha()


## Desenha os itens guardados numa imagem só, em faixas de BANDA px (a mesma conta da mesa dos traços).
func _pintar_folha() -> Image:
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
	for it in _itens:
		if it.has("img"):
			var tr := TextureRect.new()
			tr.texture = ImageTexture.create_from_image(it["img"])
			tr.position = Vector2(it["x"], it["y"])
			vp.add_child(tr)
		else:
			var l := Label.new()
			l.text = it["t"]
			l.position = Vector2(it["x"], it["y"])
			l.add_theme_font_size_override("font_size", it["tam"])
			l.add_theme_color_override("font_color", it["cor"])
			vp.add_child(l)
	add_child(vp)
	var folha := Image.create(LARGURA, altura, false, Image.FORMAT_RGB8)
	var y0 := 0
	while y0 < altura:
		vp.canvas_transform = Transform2D(0.0, Vector2(0.0, -float(y0)))
		await _quadros(2)
		var faixa := vp.get_texture().get_image()
		faixa.convert(Image.FORMAT_RGB8)
		folha.blit_rect(faixa, Rect2i(0, 0, LARGURA, mini(BANDA, altura - y0)), Vector2i(0, y0))
		y0 += BANDA
	vp.queue_free()
	return folha

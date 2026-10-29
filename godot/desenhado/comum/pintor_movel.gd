extends Node
## CONGELADO. Pinta as formas de um MÓVEL DESENHADO (onda 4, CONTRATO.md seção 10) com o
## textura.gdshader dele, em três passadas da mesma função (comum/rodape_movel.gdshaderinc):
##   <vista>-<variante>-<virada>.png        o valor (R = G = B) e a cobertura (A)
##   <vista>-<variante>-<virada>-partes.png o peso dos lugares 1..3 (R, G, B) e a cobertura
##   <vista>-<variante>-<virada>-cor.png    só com "corFixa": a cor própria
## Tudo RGBA de alfa reto, 128 px por casa, a pegada (deitada nas viradas 1 e 3) mais a
## margem.

const ContratoMovel := preload("res://comum/contrato_movel.gd")

## A placa às vezes devolve o quadro antes de desenhar: espera e lê de novo.
const LEITURAS := 4


## Devolve {"ok", "erros", "arquivos", "imagens": {arquivo: Image}, "medidas": {forma: {...}}}.
func pintar(cfg: Dictionary, pasta: String) -> Dictionary:
	var r := {"ok": false, "erros": [] as Array[String], "arquivos": [] as Array[String], "imagens": {}, "medidas": {}}
	var caminho_shader := "res://texturas/%s/textura.gdshader" % cfg["id"]
	if not ResourceLoader.exists(caminho_shader):
		r["erros"].append("não achei %s" % caminho_shader)
		return r
	var shader := load(caminho_shader) as Shader
	DirAccess.make_dir_recursive_absolute(pasta)
	var modos := [0, 1, 2] if cfg["corFixa"] else [0, 1]
	var sufixo := {0: "", 1: "-partes", 2: "-cor"}
	var pedidos := []
	for f in ContratoMovel.formas(cfg):
		for modo in modos:
			pedidos.append({"forma": f, "modo": modo, "arquivo": "%s%s.png" % [f["nome"], sufixo[modo]], "vp": _viewport(shader, cfg, f, modo)})
	await _quadros(2)
	for p in pedidos:
		var vp: SubViewport = p["vp"]
		var arquivo: String = p["arquivo"]
		var img: Image = null
		for tentativa in LEITURAS:
			img = vp.get_texture().get_image()
			if img != null and not img.is_empty() and not _vazia(img):
				break
			await _quadros(2)
		vp.queue_free()
		if img == null or img.is_empty() or _vazia(img):
			r["erros"].append("%s saiu vazia: o shader não compilou (veja o erro do Godot acima) ou não pousou nada" % arquivo)
			continue
		img.convert(Image.FORMAT_RGBA8)
		img.fix_alpha_edges()
		var destino := pasta.path_join(arquivo)
		if img.save_png(destino) != OK:
			r["erros"].append("%s: erro ao salvar" % destino)
			continue
		r["arquivos"].append(destino)
		r["imagens"][arquivo] = img
	for f in ContratoMovel.formas(cfg):
		var nome: String = f["nome"]
		if not r["imagens"].has(nome + ".png") or not r["imagens"].has(nome + "-partes.png"):
			continue
		r["medidas"][nome] = _medir(cfg, f, r["imagens"][nome + ".png"], r["imagens"][nome + "-partes.png"])
	r["ok"] = r["erros"].is_empty()
	return r


func _viewport(shader: Shader, cfg: Dictionary, f: Dictionary, modo: int) -> SubViewport:
	var lado: Vector2i = f["tamanho"]
	var vp := SubViewport.new()
	vp.size = lado
	vp.disable_3d = true
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var quadro := ColorRect.new()
	quadro.size = Vector2(lado)
	quadro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = shader
	m.set_shader_parameter("modo", modo)
	m.set_shader_parameter("variante", f["iVariante"])
	m.set_shader_parameter("semente", cfg["semente"])
	m.set_shader_parameter("movel_vista", f["iVista"])
	m.set_shader_parameter("movel_virada", f["virada"])
	m.set_shader_parameter("movel_casas", Vector2(f["casas"][0], f["casas"][1]))
	m.set_shader_parameter("movel_margem", float(cfg["margemCasas"]))
	m.set_shader_parameter("movel_imagem", Vector2(lado))
	quadro.material = m
	vp.add_child(quadro)
	add_child(vp)
	return vp


## Cobertura, o valor médio de cada lugar (pesado pela cobertura e pelo peso) e, em quem
## estica, o quanto o meio muda ao longo (tem de ser ~0: o app estica o meio).
static func _medir(cfg: Dictionary, f: Dictionary, valor: Image, partes: Image) -> Dictionary:
	var w := valor.get_width()
	var h := valor.get_height()
	var n_lug: int = maxi(1, cfg["lugares"].size())
	var soma := [0.0, 0.0, 0.0]
	var peso := [0.0, 0.0, 0.0]
	var cobre := 0.0
	for y in h:
		for x in w:
			var v := valor.get_pixel(x, y)
			var p := partes.get_pixel(x, y)
			cobre += v.a
			var ws := [p.r, p.g, p.b]
			for k in 3:
				soma[k] += v.r * v.a * ws[k]
				peso[k] += v.a * ws[k]
	var medias := []
	for k in n_lug:
		medias.append(snappedf(soma[k] / peso[k], 0.001) if peso[k] > 0.5 else null)
	var m := {"cobertura": snappedf(cobre / float(w * h), 0.001), "valorMedioPorLugar": medias}
	var vc: Dictionary = cfg["vistas"][f["vista"]]
	if vc.has("esticar") and f["virada"] % 2 == 0:
		m["meioLiso"] = snappedf(_variacao_do_meio(valor, partes, vc["esticar"]["pontasCasas"], float(cfg["margemCasas"])), 0.0001)
	return m


static func _variacao_do_meio(valor: Image, partes: Image, pontas: Array, margem: float) -> float:
	var casa := float(ContratoMovel.PX_POR_CASA)
	var x0 := int(ceil(pontas[0] * casa)) + 1
	var x1 := valor.get_width() - int(ceil(pontas[1] * casa)) - 1
	if x1 <= x0:
		return 0.0
	var xc := (x0 + x1) / 2
	var pior := 0.0
	for x in range(x0, x1 + 1):
		var s := 0.0
		for y in valor.get_height():
			var a := valor.get_pixel(x, y)
			var b := valor.get_pixel(xc, y)
			var pa := partes.get_pixel(x, y)
			var pb := partes.get_pixel(xc, y)
			s += absf(a.r * a.a - b.r * b.a) + absf(a.a - b.a) + absf(pa.r - pb.r) + absf(pa.g - pb.g)
		pior = maxf(pior, s / float(valor.get_height()))
	return pior


## Vazia (nada pousado) ou de uma cor só (o shader não compilou: o Godot pinta o retângulo
## de branco chapado).
static func _vazia(img: Image) -> bool:
	var a := img.get_pixel(0, 0)
	for y in range(0, img.get_height(), 3):
		for x in range(0, img.get_width(), 3):
			var b := img.get_pixel(x, y)
			if b.a > 0.01 and absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) + absf(a.a - b.a) > 0.004:
				return false
	return true


## Espera n quadros desenhados; se a placa não desenhar em 3 s, força um quadro.
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

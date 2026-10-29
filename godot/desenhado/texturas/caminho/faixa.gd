extends SceneTree
## Bancada do Caminho: a faixa de 1 e de 3 casas por cima da grama aprovada
## (exportado/grama/, só leitura), recortada pelo traço como o app recorta hoje, a 35%,
## 50%, 100% e 300%; ao lado, o Atual (a cor chapada de hoje, #8a6a45) na mesma grama,
## a proposta de borda para a integração (faixa.gdshader, borda = 1) e a faixa por cima
## da terra (exportado/terra/, só leitura).
## Usa as vistas da mesa (comum/mesa.gd), então o chão é montado como na folha.
## Uso, pela fila: ... --script res://texturas/caminho/faixa.gd -- --prova=<pasta fora do repo>
## Sai com 0 (ok), 1 (faltou arquivo ou a placa não devolveu a imagem) ou 2 (uso errado).

const Contrato := preload("res://comum/contrato.gd")
const Mesa := preload("res://comum/mesa.gd")
const SH_FAIXA := preload("res://texturas/caminho/faixa.gdshader")
const CASA := 64.0
const LIMITE_S := 120.0
const LADO := 768 ## px de tela de cada quadro
const MG := 28

## Os dois caminhos, em casas: os pontos clicados um a um (o traço é reto entre eles).
const FINO := [Vector2(-1, 5.0), Vector2(5, 6.5), Vector2(10, 5.2), Vector2(15, 7.8), Vector2(22, 6.4), Vector2(37, 8.5)]
const LARGO := [Vector2(-1, 18), Vector2(6, 14.5), Vector2(11, 12.0), Vector2(16, 13.5), Vector2(23, 10.5), Vector2(37, 13)]
const LARGURA_FINO := 1.0 ## casas
const LARGURA_LARGO := 3.0

## Quadros: [nome, origem em casas, zoom, lado em casas, borda, chapado, título, chão]
const QUADROS := [
	["a50", Vector2(0, 0), 0.5, 24.0, 0, false, "Desenhado  ·  24 x 24 casas a 50%  ·  faixas de 1 e de 3 casas", "grama"],
	["a100", Vector2(5, 3), 1.0, 12.0, 0, false, "Desenhado  ·  a 100% (12 x 12 casas)", "grama"],
	["p300-fino", Vector2(9.5, 4.0), 3.0, 4.0, 0, false, "Desenhado  ·  300%, a faixa de 1 casa (com junta)", "grama"],
	["p300-largo", Vector2(8.5, 10.5), 3.0, 4.0, 0, false, "Desenhado  ·  300%, a faixa de 3 casas (com junta)", "grama"],
	["a35", Vector2(0, 0), 0.35, 34.0, 0, false, "Desenhado  ·  34 x 34 casas a 35%", "grama"],
	["atual100", Vector2(5, 3), 1.0, 12.0, 0, true, "Atual  ·  a cor chapada #8a6a45 na mesma grama, a 100%", "grama"],
	["b100", Vector2(5, 3), 1.0, 12.0, 1, false, "Proposta (fora do contrato)  ·  borda torta e sombra do lado da luz, 100%", "grama"],
	["b300-fino", Vector2(9.5, 4.0), 3.0, 4.0, 1, false, "Proposta  ·  300%, a faixa de 1 casa", "grama"],
	["terra100", Vector2(5, 3), 1.0, 12.0, 0, false, "Desenhado  ·  por cima da terra (exportado/terra/), 100%", "terra"],
]


func _initialize() -> void:
	create_timer(LIMITE_S).timeout.connect(func() -> void:
		printerr("  ERRO: passou de %d s" % int(LIMITE_S))
		quit(3))
	_rodar.call_deferred()


func _rodar() -> void:
	OS.low_processor_usage_mode = false
	var args := Contrato.ler_args()
	if not args.has("prova"):
		printerr("uso: --prova=<pasta fora do repo>")
		quit(2)
		return
	var prova: String = args["prova"]
	DirAccess.make_dir_recursive_absolute(prova)
	var mesas := {}
	var cfgs := {}
	for id in ["grama", "caminho", "terra"]:
		var lido := Contrato.ler_config(id)
		if not lido["ok"]:
			printerr("  ERRO config %s: %s" % [id, lido["erros"]])
			quit(2)
			return
		cfgs[id] = lido["config"]
		var m := Mesa.new()
		root.add_child(m)
		var erros: Array[String] = []
		if not m._carregar(cfgs[id], ProjectSettings.globalize_path("res://exportado/%s" % id), erros):
			printerr("  ERRO: ", erros)
			quit(1)
			return
		mesas[id] = m
	# 1. As duas vistas de cada quadro (grama e caminho), pela mesa.
	var vistas := []
	for q in QUADROS:
		var origem: Vector2 = q[1] * CASA
		var lado_tela: float = q[3] * CASA * q[2]
		vistas.append([mesas[q[7]]._vista(cfgs[q[7]], 0, origem, q[2], lado_tela, false, origem),
				mesas["caminho"]._vista(cfgs["caminho"], 0, origem, q[2], lado_tela, false, origem)])
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	# 2. O recorte pelo traço.
	var recortes := []
	for k in QUADROS.size():
		var q: Array = QUADROS[k]
		var chao := _ler(vistas[k][0])
		var faixa := _ler(vistas[k][1])
		if chao == null or faixa == null:
			printerr("  ERRO: a placa de vídeo não devolveu a vista %s" % q[0])
			quit(1)
			return
		recortes.append(_recorte(q, chao, faixa))
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var imgs := {}
	for k in QUADROS.size():
		var img := _ler(recortes[k])
		if img == null:
			printerr("  ERRO: a placa de vídeo não devolveu o recorte %s" % QUADROS[k][0])
			quit(1)
			return
		imgs[QUADROS[k][0]] = img
		img.save_png(prova.path_join("faixa-%s.png" % QUADROS[k][0]))
	# 3. A folha da faixa.
	var folha := await _folha(mesas["caminho"], imgs)
	var destino := prova.path_join("faixa.png")
	if folha.save_png(destino) != OK:
		printerr("  ERRO: não gravei ", destino)
		quit(1)
		return
	print("  faixa: ", destino)
	quit(0)


func _ler(vp: SubViewport) -> Image:
	var img := vp.get_texture().get_image()
	vp.queue_free()
	if img == null or img.is_empty():
		return null
	img.convert(Image.FORMAT_RGB8)
	return img


func _recorte(q: Array, chao: Image, faixa: Image) -> SubViewport:
	var lado_tela: float = q[3] * CASA * q[2]
	var tamanho := Vector2(lado_tela, lado_tela)
	var vp := SubViewport.new()
	vp.size = Vector2i(tamanho)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var quadro := ColorRect.new()
	quadro.size = tamanho
	var m := ShaderMaterial.new()
	m.shader = SH_FAIXA
	m.set_shader_parameter("chao", ImageTexture.create_from_image(chao))
	m.set_shader_parameter("faixa", ImageTexture.create_from_image(faixa))
	m.set_shader_parameter("origem", q[1] * CASA)
	m.set_shader_parameter("zoom", q[2])
	m.set_shader_parameter("tamanho", tamanho)
	m.set_shader_parameter("pontos_a", _em_px(FINO))
	m.set_shader_parameter("n_a", FINO.size())
	m.set_shader_parameter("largura_a", LARGURA_FINO * CASA)
	m.set_shader_parameter("pontos_b", _em_px(LARGO))
	m.set_shader_parameter("n_b", LARGO.size())
	m.set_shader_parameter("largura_b", LARGURA_LARGO * CASA)
	m.set_shader_parameter("borda", q[4])
	m.set_shader_parameter("chapado", q[5])
	quadro.material = m
	vp.add_child(quadro)
	root.add_child(vp)
	return vp


static func _em_px(pontos: Array) -> PackedVector2Array:
	var r := PackedVector2Array()
	r.resize(8)
	for k in pontos.size():
		r[k] = pontos[k] * CASA
	return r


func _folha(mesa: Node, imgs: Dictionary) -> Image:
	var largura := MG + LADO + MG + LADO + MG
	var y0 := 120
	var passo := LADO + 52
	var linhas := (QUADROS.size() + 1) / 2
	var altura := y0 + linhas * passo + 20
	var vp := SubViewport.new()
	vp.size = Vector2i(largura, altura)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var fundo := ColorRect.new()
	fundo.color = Mesa.COR_FUNDO
	fundo.size = Vector2(largura, altura)
	vp.add_child(fundo)
	mesa._rotulo(vp, "Caminho  ·  caminho  ·  a faixa sobre a grama aprovada", Vector2(MG, 16), 28, Mesa.COR_TINTA)
	mesa._rotulo(vp, "Traço reto entre os pontos, ponta e junta redondas, borda suavizada em 1 px de tela (drawDrawings.ts).  Faixas de 1 e de 3 casas.", Vector2(MG, 58), 17, Mesa.COR_TINTA_2)
	mesa._rotulo(vp, "O chão é a grama (exportado/grama/) e a faixa é o caminho (exportado/caminho/), os dois montados pela mesa como na folha.", Vector2(MG, 84), 17, Mesa.COR_TINTA_3)
	for k in QUADROS.size():
		var q: Array = QUADROS[k]
		var x := MG + (k % 2) * (LADO + MG)
		var y := y0 + (k / 2) * passo + 30
		mesa._rotulo(vp, q[6], Vector2(x, y - 30), 19, Mesa.COR_TINTA if q[4] == 0 and not q[5] else Mesa.COR_TINTA_2)
		mesa._imagem(vp, imgs[q[0]], Vector2(x, y))
	root.add_child(vp)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	vp.queue_free()
	img.convert(Image.FORMAT_RGB8)
	return img

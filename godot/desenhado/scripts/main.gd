extends Node2D
## Cena principal do protótipo Desenhado: um pedaço de mapa visto de cima, na composição
## do protótipo do Fogo (docs/design/objeto-fogo/prototipo.html): casa aberta com assoalho
## e móveis, casa com telhado de telha, grama com tufos e flores, caminho de terra, praça
## de pedra com barraca, árvores. Medidas em casas (1 casa = 64 px, a grade do app).
## Tudo é pintado por shader com semente fixa: abrir duas vezes dá a mesma imagem.
##
## Para tirar um print pela linha de comando (depois do "--"):
##   --print=<arquivo.png> [--zoom=0.8] [--centro=12.4,7.45] [--grade] [--sem-painel]
##   [--clicar-exportar]  antes do print, clica de verdade (evento de mouse) no botão
##                        "Exportar texturas" e espera o resultado aparecer no painel

const CASA := 64.0
const PERIODO := 512.0 # o chão repete a cada 8 casas, igual às texturas exportadas
const SEMENTE := 7

const CameraMapa := preload("res://scripts/camera_mapa.gd")
const Painel := preload("res://scripts/painel.gd")
const Exportador := preload("res://scripts/exportador.gd")
const Cli := preload("res://scripts/exportar.gd")

const SH_CHAO := preload("res://shaders/chao.gdshader")
const SH_TEXTURA := preload("res://shaders/textura.gdshader")
const SH_PECA := preload("res://shaders/peca.gdshader")
const SH_ARVORE := preload("res://shaders/arvore.gdshader")
const SH_BARRIL := preload("res://shaders/barril.gdshader")
const SH_BARRACA := preload("res://shaders/barraca.gdshader")
const SH_TELHADO := preload("res://shaders/telhado.gdshader")
const SH_GRADE := preload("res://shaders/grade.gdshader")

# Camadas, de baixo para cima.
const Z_CHAO := 0
const Z_PISO := 1
const Z_TAPETE := 2
const Z_MOVEL := 3
const Z_SOBRE_MOVEL := 4
const Z_RUA := 5
const Z_PAREDE := 6
const Z_CANTO := 7
const Z_TELHADO := 8
const Z_ARVORE := 10
const Z_GRADE := 30

# Paleta (os mesmos tokens de shaders/base.gdshaderinc).
const CARVALHO := Color("a07b51")
const NOGUEIRA := Color("775739")
const PINHO := Color("b9995f")
const LINHO := Color("d4c7a5")
const VINHO := Color("8f4a49")
const OCRE := Color("b2904f")
const REBOCO := Color("efe7cf")
const PEDRA := Color("c3c0b2")
const BRANCO := Color("f3efe2")
const TELHA := Color("b56e50")
const LATAO := Color("b89552")
const TRAVESSEIRO := Color("e3d9bf")
const PAO := Color("c9954f")

# A composição do protótipo do Fogo, em casas.
const CASA_ABERTA := Rect2(1.8, 1.0, 9.4, 6.6)
const PORTA := Vector2(6.2, 7.0) # começo e fim, em x, na parede de baixo
const PAREDE := 0.18
const TELHADO := Rect2(2.4, 10.5, 6.2, 3.2)
const ARVORES := [Vector3(13.0, 3.6, 1.05), Vector3(14.3, 11.9, 1.1), Vector3(11.2, 13.9, 0.85), Vector3(0.6, 4.2, 0.95)]
const ARBUSTOS := [Vector3(1.55, 13.95, 0.45), Vector3(9.35, 10.85, 0.4), Vector3(15.6, 7.3, 0.38)]
const BARRACA := Rect2(19.0, 2.2, 3.2, 2.0)
const CAIXOTES := [Vector2(22.7, 4.5), Vector2(23.5, 4.9)]
const MAPA := Rect2(-4.0, -4.0, 34.0, 24.0)
const CENTRO_INICIAL := Vector2(12.4, 7.45)
const ZOOM_INICIAL := 0.8


class Quadro extends Node2D:
	var retangulo := Rect2()

	func _draw() -> void:
		draw_rect(retangulo, Color.WHITE)


var _mapa: Node2D
var _grade: Quadro
var _camera: CameraMapa
var _camada_ui: CanvasLayer
var _painel: Painel
var _exportador: Exportador
var _pasta_exportado := ""
var _ultima_exportacao := {}


func _ready() -> void:
	_mapa = Node2D.new()
	_mapa.name = "Mapa"
	add_child(_mapa)
	_montar_chao()
	_montar_casa_aberta()
	_montar_casa_com_telhado()
	_montar_praca()
	_montar_arvores()
	_montar_grade()
	_montar_camera()
	_montar_painel()
	_exportador = Exportador.new()
	add_child(_exportador)
	_pasta_exportado = ProjectSettings.globalize_path("res://exportado")
	var args := Cli.ler_args()
	if args.has("print"):
		_tirar_print(args)


func _unhandled_input(evento: InputEvent) -> void:
	if evento is InputEventKey and evento.pressed and not evento.echo and (evento as InputEventKey).keycode == KEY_G:
		_alternar_grade(not _grade.visible)
		_painel.definir_grade(_grade.visible)
		get_viewport().set_input_as_handled()


# ---------------------------------------------------------------- peças
func _quadro(pai: Node, pos: Vector2, ret: Rect2, shader: Shader, params: Dictionary, z: int) -> Quadro:
	var q := Quadro.new()
	q.position = pos
	q.retangulo = ret
	q.z_index = z
	var m := ShaderMaterial.new()
	m.shader = shader
	for k: String in params:
		m.set_shader_parameter(k, params[k])
	q.material = m
	pai.add_child(q)
	return q


static func _v3(c: Color) -> Vector3:
	return Vector3(c.r, c.g, c.b)


## Peça retangular: x, y, largura e altura em casas; altura da sombra e raio em px.
func _peca(x: float, y: float, w: float, h: float, cor: Color, padrao: int, sombra: float, raio: float, z: int, extra := {}) -> void:
	var tam := Vector2(w, h) * CASA
	var margem := sombra * 2.0 + 8.0
	var params := {"tamanho": tam, "cor": _v3(cor), "padrao": padrao, "altura": sombra, "raio": raio, "semente": int(x * 131.0 + y * 17.0) % 997}
	params.merge(extra, true)
	_quadro(_mapa, Vector2(x, y) * CASA, Rect2(-Vector2(margem, margem), tam + Vector2(margem, margem) * 2.0), SH_PECA, params, z)


## Peça redonda: centro e raio em casas.
func _redondo(cx: float, cy: float, r: float, cor: Color, padrao: int, sombra: float, z: int, extra := {}) -> void:
	_peca(cx - r, cy - r, r * 2.0, r * 2.0, cor, padrao, sombra, r * CASA, z, extra)


func _arvore(cx: float, cy: float, r: float, sem: int, frutas: bool, tom: float, z := Z_ARVORE) -> void:
	var raio := r * CASA
	_quadro(_mapa, Vector2(cx, cy) * CASA, Rect2(Vector2(-1.2, -1.2) * raio, Vector2(2.9, 2.9) * raio), SH_ARVORE, {"raio": raio, "semente": sem, "frutas": frutas, "tom": tom}, z)


func _barril(cx: float, cy: float, r: float, sem: int, z: int) -> void:
	var raio := r * CASA
	_quadro(_mapa, Vector2(cx, cy) * CASA, Rect2(Vector2(-1.15, -1.15) * raio, Vector2(2.75, 2.75) * raio), SH_BARRIL, {"raio": raio, "semente": sem}, z)


# ---------------------------------------------------------------- o mapa
func _montar_chao() -> void:
	_quadro(_mapa, Vector2.ZERO, Rect2(MAPA.position * CASA, MAPA.size * CASA), SH_CHAO, {"periodo": PERIODO, "semente": SEMENTE}, Z_CHAO)


func _montar_casa_aberta() -> void:
	var x0 := CASA_ABERTA.position.x
	var y0 := CASA_ABERTA.position.y
	var x1 := CASA_ABERTA.end.x
	var y1 := CASA_ABERTA.end.y
	var e := PAREDE
	# assoalho: o mesmo material "madeira" da textura exportada, no mundo
	_quadro(_mapa, Vector2.ZERO, Rect2(Vector2(x0, y0) * CASA, Vector2(x1 - x0, y1 - y0) * CASA), SH_TEXTURA,
			{"material_id": 3, "periodo": PERIODO, "semente": SEMENTE, "no_mundo": true}, Z_PISO)
	_peca(4.6, 5.3, 2.6, 1.4, OCRE, 4, 0.8, 2.0, Z_TAPETE, {"cor2": _v3(LINHO)})
	# cama: estrado, lençol, travesseiro e colcha
	_peca(2.25, 1.35, 1.15, 2.0, NOGUEIRA, 2, 6.0, 3.0, Z_MOVEL)
	_peca(2.33, 1.43, 0.99, 1.84, LINHO, 3, 1.5, 3.0, Z_MOVEL)
	_peca(2.4, 1.5, 0.85, 0.4, TRAVESSEIRO, 8, 2.5, 9.0, Z_SOBRE_MOVEL)
	_peca(2.33, 2.1, 0.99, 1.17, VINHO, 6, 1.5, 3.0, Z_SOBRE_MOVEL, {"cor2": _v3(LINHO)})
	# cômoda encostada na parede de cima
	_peca(5.0, 1.12, 2.1, 0.55, CARVALHO, 1, 7.0, 3.0, Z_MOVEL, {"puxadores": 2})
	# mesa com duas cadeiras, dois pratos, pão e caneca
	_peca(7.0, 3.62, 0.42, 0.7, PINHO, 2, 4.0, 3.0, Z_MOVEL)
	_peca(9.58, 3.62, 0.42, 0.7, PINHO, 2, 4.0, 3.0, Z_MOVEL)
	_peca(7.5, 3.4, 2.0, 1.15, CARVALHO, 1, 8.0, 3.0, Z_MOVEL)
	_redondo(7.98, 3.84, 0.17, BRANCO, 10, 1.6, Z_SOBRE_MOVEL)
	_redondo(8.98, 3.94, 0.17, BRANCO, 10, 1.6, Z_SOBRE_MOVEL)
	_peca(7.86, 3.77, 0.24, 0.15, PAO, 12, 1.4, 4.0, Z_SOBRE_MOVEL + 1)
	_redondo(8.48, 3.62, 0.085, PEDRA, 11, 1.6, Z_SOBRE_MOVEL, {"cor2": Vector3(0.36, 0.22, 0.14)})
	# barril no canto e um vaso com planta
	_barril(10.45, 1.75, 0.36, 3, Z_MOVEL)
	_redondo(10.7, 6.95, 0.22, TELHA, 10, 3.0, Z_MOVEL)
	_arvore(10.69, 6.93, 0.19, 77, false, 0.95, Z_SOBRE_MOVEL)
	# paredes de reboco (a de baixo tem o vão da porta)
	_peca(x0 - e / 2.0, y0 - e / 2.0, x1 - x0 + e, e, REBOCO, 7, 7.0, 1.5, Z_PAREDE)
	_peca(x0 - e / 2.0, y0 - e / 2.0, e, y1 - y0 + e, REBOCO, 7, 7.0, 1.5, Z_PAREDE)
	_peca(x1 - e / 2.0, y0 - e / 2.0, e, y1 - y0 + e, REBOCO, 7, 7.0, 1.5, Z_PAREDE)
	_peca(x0 - e / 2.0, y1 - e / 2.0, PORTA.x - (x0 - e / 2.0), e, REBOCO, 7, 7.0, 1.5, Z_PAREDE)
	_peca(PORTA.y, y1 - e / 2.0, x1 + e / 2.0 - PORTA.y, e, REBOCO, 7, 7.0, 1.5, Z_PAREDE)
	# pedras de canto
	var k := 0.3
	for canto: Vector2 in [Vector2(x0, y0), Vector2(x1, y0), Vector2(x0, y1), Vector2(x1, y1)]:
		_peca(canto.x - k / 2.0, canto.y - k / 2.0, k, k, PEDRA, 9, 7.0, 2.0, Z_CANTO)
	# porta de tábua com batentes, maçaneta de latão e soleira de pedra
	_peca(PORTA.x - 0.05, y1 - e / 2.0 - 0.02, 0.09, e + 0.04, NOGUEIRA, 0, 3.0, 1.0, Z_CANTO)
	_peca(PORTA.y - 0.04, y1 - e / 2.0 - 0.02, 0.09, e + 0.04, NOGUEIRA, 0, 3.0, 1.0, Z_CANTO)
	_peca(PORTA.x + 0.04, y1 - e / 2.0 + 0.015, PORTA.y - PORTA.x - 0.08, e - 0.03, PINHO, 1, 2.0, 1.5, Z_PAREDE)
	_redondo(PORTA.y - 0.16, y1, 0.035, LATAO, 0, 1.0, Z_CANTO)
	_peca(PORTA.x - 0.04, y1 + e / 2.0 + 0.02, PORTA.y - PORTA.x + 0.08, 0.17, PEDRA, 9, 1.2, 2.0, Z_RUA)


func _montar_casa_com_telhado() -> void:
	var tam := TELHADO.size * CASA
	var m := 36.0
	_quadro(_mapa, TELHADO.position * CASA, Rect2(Vector2(-m, -m), tam + Vector2(m, m) * 2.0), SH_TELHADO, {
		"tamanho": tam,
		"tom": _v3(TELHA),
		"semente": 3,
		"chamine": Vector2(TELHADO.size.x - 1.3, 0.35) * CASA,
		"chamine_lado": 0.5 * CASA,
	}, Z_TELHADO)


func _montar_praca() -> void:
	var tam := BARRACA.size * CASA
	var m := 40.0
	_quadro(_mapa, BARRACA.position * CASA, Rect2(Vector2(-m, -m), tam + Vector2(m, m) * 2.0), SH_BARRACA,
			{"tamanho": tam, "faixa": 0.4 * CASA, "cor_a": _v3(VINHO), "cor_b": _v3(LINHO)}, Z_RUA)
	# balcão na frente do toldo (fica embaixo dele: a sombra do toldo cai em cima)
	_peca(19.15, 4.44, 2.9, 0.42, CARVALHO, 1, 5.0, 3.0, Z_SOBRE_MOVEL)
	var frutas := [Vector3(0.80, 0.30, 0.25), Vector3(0.93, 0.60, 0.25), Vector3(0.62, 0.72, 0.32)]
	for i in frutas.size():
		_redondo(19.62 + i * 0.95, 4.65, 0.17, PINHO, 13, 2.0, Z_SOBRE_MOVEL, {"cor2": frutas[i]})
	for c: Vector2 in CAIXOTES:
		_peca(c.x, c.y, 0.62, 0.62, PINHO, 5, 5.0, 2.0, Z_RUA)
	_barril(18.2, 5.6, 0.34, 9, Z_RUA)


func _montar_arvores() -> void:
	var i := 0
	for a: Vector3 in ARVORES:
		_arvore(a.x, a.y, a.z, 11 + i * 7, i == 1, 1.0)
		i += 1
	for a: Vector3 in ARBUSTOS:
		_arvore(a.x, a.y, a.z, 51 + i * 5, false, 0.9)
		i += 1


func _montar_grade() -> void:
	_grade = _quadro(_mapa, Vector2.ZERO, Rect2(MAPA.position * CASA, MAPA.size * CASA), SH_GRADE, {}, Z_GRADE)
	_grade.visible = false


func _montar_camera() -> void:
	_camera = CameraMapa.new()
	_camera.inicio_centro = CENTRO_INICIAL * CASA
	_camera.inicio_zoom = ZOOM_INICIAL
	_camera.limites = Rect2(Vector2(-1.0, -1.0) * CASA, Vector2(27.0, 18.0) * CASA)
	_camera.position = CENTRO_INICIAL * CASA
	_camera.zoom = Vector2(ZOOM_INICIAL, ZOOM_INICIAL)
	add_child(_camera)
	_camera.make_current()


func _montar_painel() -> void:
	_camada_ui = CanvasLayer.new()
	_camada_ui.layer = 10
	add_child(_camada_ui)
	_painel = Painel.new()
	_camada_ui.add_child(_painel)
	_painel.grade_alternada.connect(_alternar_grade)
	_painel.exportar_pedido.connect(_exportar)
	_painel.abrir_pasta_pedido.connect(func() -> void: OS.shell_show_in_file_manager(_pasta_exportado, true))
	_camera.zoom_mudou.connect(_painel.mostrar_zoom)
	_painel.mostrar_zoom(ZOOM_INICIAL)


# ---------------------------------------------------------------- ações
func _alternar_grade(ligada: bool) -> void:
	_grade.visible = ligada


func _exportar() -> void:
	_painel.exportando()
	var r: Dictionary = await _exportador.exportar(_pasta_exportado, int(PERIODO), 1, SEMENTE)
	_painel.exportou(r)
	_ultima_exportacao = r


# Verificação do caminho inteiro do botão: aperta e solta o botão esquerdo do mouse em
# cima de "Exportar texturas" (o mesmo evento que um clique gera) e espera o painel
# receber o resultado. Devolve true se exportou.
func _clicar_exportar() -> bool:
	_ultima_exportacao = {}
	await get_tree().process_frame
	var alvo := _painel.centro_do_botao_exportar()
	for apertado: bool in [true, false]:
		var ev := InputEventMouseButton.new()
		ev.button_index = MOUSE_BUTTON_LEFT
		ev.pressed = apertado
		ev.position = alvo
		ev.global_position = alvo
		Input.parse_input_event(ev)
		await get_tree().process_frame
	var limite := Time.get_ticks_msec() + 15000
	while _ultima_exportacao.is_empty() and Time.get_ticks_msec() < limite:
		await get_tree().process_frame
	if _ultima_exportacao.is_empty():
		print("clique em Exportar texturas: nada aconteceu em 15 s")
		return false
	var ok: bool = _ultima_exportacao["ok"]
	print("clique em Exportar texturas: ", "ok, %d arquivos" % (_ultima_exportacao["arquivos"] as Array).size() if ok else "falhou: " + str(_ultima_exportacao["erros"]))
	return ok


func _tirar_print(args: Dictionary) -> void:
	if args.has("centro"):
		var v := String(args["centro"]).split(",")
		_camera.position = Vector2(v[0].to_float(), v[1].to_float()) * CASA
	if args.has("zoom"):
		_camera.definir_zoom(String(args["zoom"]).to_float())
	if args.has("grade"):
		_alternar_grade(true)
		_painel.definir_grade(true)
	if args.has("sem-painel"):
		_camada_ui.visible = false
	OS.low_processor_usage_mode = false
	var clique_ok := true
	if args.has("clicar-exportar"):
		clique_ok = await _clicar_exportar()
		OS.low_processor_usage_mode = false
	for i in 6:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var caminho: String = args["print"]
	DirAccess.make_dir_recursive_absolute(caminho.get_base_dir())
	var e := img.save_png(caminho)
	print("print: %s (%d x %d) %s" % [caminho, img.get_width(), img.get_height(), "ok" if e == OK else "erro %d" % e])
	get_tree().quit(0 if e == OK and clique_ok else 1)

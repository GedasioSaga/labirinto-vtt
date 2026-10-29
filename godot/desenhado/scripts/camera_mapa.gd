extends Camera2D
## Câmera do mapa. Arrastar com o botão esquerdo ou o do meio move o mapa (o cursor vira
## mão fechada); a roda dá zoom no ponto do mouse; + e - dão zoom no meio da tela;
## 0 ou Home voltam ao enquadramento inicial. O zoom assenta em cerca de 150 ms.

signal zoom_mudou(valor: float)

const ZOOM_MIN := 0.35
const ZOOM_MAX := 3.0
const PASSO := 1.15
const RAPIDEZ := 20.0 # assentamento do zoom (por segundo)

var limites := Rect2() # onde o centro da câmera pode ir, em px do mundo
var inicio_centro := Vector2.ZERO
var inicio_zoom := 1.0

var _arrastando := false
var _alvo := 1.0
var _ancora_tela := Vector2.ZERO
var _ancora_mundo := Vector2.ZERO


func _ready() -> void:
	_alvo = zoom.x


func voltar_ao_inicio() -> void:
	position = inicio_centro
	definir_zoom(inicio_zoom)


func definir_zoom(z: float) -> void:
	_alvo = clampf(z, ZOOM_MIN, ZOOM_MAX)
	zoom = Vector2(_alvo, _alvo)
	_prender()
	zoom_mudou.emit(_alvo)


# Soltar o botão e mexer o mouse durante o arrasto valem mesmo em cima do painel
# (a câmera "segura" o ponteiro enquanto arrasta).
func _input(evento: InputEvent) -> void:
	if not _arrastando:
		return
	if evento is InputEventMouseMotion:
		position -= (evento as InputEventMouseMotion).relative / zoom.x
		_prender()
		get_viewport().set_input_as_handled()
	elif evento is InputEventMouseButton and not evento.pressed:
		var b := evento as InputEventMouseButton
		if b.button_index == MOUSE_BUTTON_LEFT or b.button_index == MOUSE_BUTTON_MIDDLE:
			_parar_arrasto()
			get_viewport().set_input_as_handled()


func _unhandled_input(evento: InputEvent) -> void:
	if evento is InputEventMouseButton:
		var b := evento as InputEventMouseButton
		if (b.button_index == MOUSE_BUTTON_LEFT or b.button_index == MOUSE_BUTTON_MIDDLE) and b.pressed:
			_arrastando = true
			Input.set_default_cursor_shape(Input.CURSOR_DRAG)
			get_viewport().set_input_as_handled()
		elif b.pressed and b.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom_em(_alvo * PASSO, b.position)
			get_viewport().set_input_as_handled()
		elif b.pressed and b.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom_em(_alvo / PASSO, b.position)
			get_viewport().set_input_as_handled()
	elif evento is InputEventPanGesture:
		position += (evento as InputEventPanGesture).delta * 16.0 / zoom.x
		_prender()
	elif evento is InputEventMagnifyGesture:
		var g := evento as InputEventMagnifyGesture
		_zoom_em(_alvo * g.factor, g.position)
	elif evento is InputEventKey and evento.pressed and not evento.echo:
		var meio := get_viewport_rect().size * 0.5
		match (evento as InputEventKey).keycode:
			KEY_EQUAL, KEY_PLUS, KEY_KP_ADD:
				_zoom_em(_alvo * PASSO, meio)
			KEY_MINUS, KEY_KP_SUBTRACT:
				_zoom_em(_alvo / PASSO, meio)
			KEY_0, KEY_KP_0, KEY_HOME:
				voltar_ao_inicio()
			_:
				return
		get_viewport().set_input_as_handled()


func _notification(o_que: int) -> void:
	if o_que == NOTIFICATION_WM_WINDOW_FOCUS_OUT and _arrastando:
		_parar_arrasto()


func _process(delta: float) -> void:
	if is_equal_approx(zoom.x, _alvo):
		return
	var z := lerpf(zoom.x, _alvo, 1.0 - exp(-delta * RAPIDEZ))
	if absf(z - _alvo) < 0.0005:
		z = _alvo
	zoom = Vector2(z, z)
	# o ponto embaixo do mouse fica parado na tela
	position += _ancora_mundo - _tela_para_mundo(_ancora_tela)
	_prender()
	zoom_mudou.emit(z)


func _zoom_em(z: float, tela: Vector2) -> void:
	_alvo = clampf(z, ZOOM_MIN, ZOOM_MAX)
	_ancora_tela = tela
	_ancora_mundo = _tela_para_mundo(tela)


func _tela_para_mundo(tela: Vector2) -> Vector2:
	return position + (tela - get_viewport_rect().size * 0.5) / zoom.x


func _parar_arrasto() -> void:
	_arrastando = false
	Input.set_default_cursor_shape(Input.CURSOR_ARROW)


func _prender() -> void:
	if limites.has_area():
		position = position.clamp(limites.position, limites.end)

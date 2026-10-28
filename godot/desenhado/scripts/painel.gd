extends PanelContainer
## Painel pequeno do protótipo: grade, exportar as texturas e o resultado da exportação.
## Cores da bancada escura dos outros protótipos do Labirinto.

signal grade_alternada(ligada: bool)
signal exportar_pedido
signal abrir_pasta_pedido

const FUNDO := Color(0.149, 0.141, 0.133, 0.94)
const BANCADA := Color("2b2b2b")
const REGRA := Color("3b3833")
const BORDA := Color("4a4640")
const TINTA := Color("ece6da")
const TINTA_2 := Color("b9b1a3")
const TINTA_3 := Color("8d8579")
const MIOLO := Color("f0c98a")
const ALERTA := Color("e39446")

var _grade: CheckButton
var _exportar: Button
var _abrir: Button
var _status: Label
var _zoom: Label


func _ready() -> void:
	theme = _tema()
	custom_minimum_size = Vector2(272, 0)
	# Fica no canto de baixo à direita, em cima das lajes da praça (onde não há objeto),
	# e cresce para cima quando aparece o resultado da exportação.
	grow_horizontal = Control.GROW_DIRECTION_BEGIN
	grow_vertical = Control.GROW_DIRECTION_BEGIN
	var caixa := VBoxContainer.new()
	caixa.add_theme_constant_override("separation", 8)
	add_child(caixa)
	caixa.add_child(_rotulo("Estilo Desenhado", 19, TINTA))
	caixa.add_child(_rotulo("Protótipo no Godot 4.7 · 64 px por casa", 13, TINTA_3))
	caixa.add_child(_regra())
	_grade = CheckButton.new()
	_grade.text = "Grade"
	_grade.tooltip_text = "Mostra a grade de casas (atalho G)"
	_grade.toggled.connect(func(ligada: bool) -> void: grade_alternada.emit(ligada))
	caixa.add_child(_grade)
	_exportar = Button.new()
	_exportar.text = "Exportar texturas"
	_exportar.tooltip_text = "Grava grama, terra, pedra, madeira e telha em PNG (sem emenda) e a folha de contato na pasta exportado/"
	_exportar.pressed.connect(func() -> void: exportar_pedido.emit())
	caixa.add_child(_exportar)
	_status = _rotulo("", 13, TINTA_2)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.custom_minimum_size = Vector2(244, 0)
	_status.visible = false
	caixa.add_child(_status)
	_abrir = Button.new()
	_abrir.text = "Abrir a pasta"
	_abrir.tooltip_text = "Abre a pasta exportado/ no Explorador"
	_abrir.visible = false
	_abrir.pressed.connect(func() -> void: abrir_pasta_pedido.emit())
	caixa.add_child(_abrir)
	caixa.add_child(_regra())
	_zoom = _rotulo("Zoom 100%", 13, TINTA_2)
	caixa.add_child(_zoom)
	caixa.add_child(_rotulo("Arraste para mover, roda para zoom.\nG grade · + e - zoom · 0 volta ao início", 12, TINTA_3))
	for b: BaseButton in [_grade, _exportar, _abrir]:
		_dar_retorno_ao_toque(b)
	set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT, Control.PRESET_MODE_MINSIZE, 16)


func definir_grade(ligada: bool) -> void:
	_grade.set_pressed_no_signal(ligada)


## Centro do botão "Exportar texturas" na tela (usado pela verificação --clicar-exportar).
func centro_do_botao_exportar() -> Vector2:
	return _exportar.get_global_rect().get_center()


func mostrar_zoom(z: float) -> void:
	_zoom.text = "Zoom %d%%" % roundi(z * 100.0)


func exportando() -> void:
	_exportar.disabled = true
	_exportar.text = "Exportando…"
	_abrir.visible = false
	_status.visible = true
	_status.text = "Pintando as 5 texturas na placa de vídeo…"
	_status.add_theme_color_override("font_color", TINTA_2)


func exportou(r: Dictionary) -> void:
	_exportar.disabled = false
	_exportar.text = "Exportar texturas"
	_status.visible = true
	if r["ok"]:
		var s := ("%.1f" % (float(r["ms"]) / 1000.0)).replace(".", ",")
		_status.text = "Pronto: 5 texturas e a folha de contato em exportado/ (%s s)." % s
		_status.add_theme_color_override("font_color", TINTA)
		_abrir.visible = true
	else:
		_status.text = "Não deu certo: " + "; ".join(PackedStringArray(r["erros"]))
		_status.add_theme_color_override("font_color", ALERTA)


func _rotulo(texto: String, tamanho: int, cor: Color) -> Label:
	var l := Label.new()
	l.text = texto
	l.add_theme_font_size_override("font_size", tamanho)
	l.add_theme_color_override("font_color", cor)
	return l


func _regra() -> ColorRect:
	var r := ColorRect.new()
	r.color = REGRA
	r.custom_minimum_size = Vector2(0, 1)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


# Aperto: o botão encolhe para 97% e volta, para a pessoa sentir que foi ouvida.
func _dar_retorno_ao_toque(b: BaseButton) -> void:
	b.resized.connect(func() -> void: b.pivot_offset = b.size * 0.5)
	b.button_down.connect(func() -> void: _escalar(b, 0.97))
	b.button_up.connect(func() -> void: _escalar(b, 1.0))


func _escalar(b: Control, s: float) -> void:
	var t := b.create_tween()
	t.tween_property(b, "scale", Vector2(s, s), 0.14).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)


func _caixa(fundo: Color, borda: Color, raio: int, margem_x: int, margem_y: int) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fundo
	s.border_color = borda
	s.set_border_width_all(1)
	s.set_corner_radius_all(raio)
	s.content_margin_left = margem_x
	s.content_margin_right = margem_x
	s.content_margin_top = margem_y
	s.content_margin_bottom = margem_y
	s.anti_aliasing = true
	return s


func _tema() -> Theme:
	var t := Theme.new()
	t.set_stylebox("panel", "PanelContainer", _caixa(FUNDO, Color("45413b"), 8, 14, 12))
	for tipo in ["Button", "CheckButton"]:
		t.set_stylebox("normal", tipo, _caixa(BANCADA, BORDA, 6, 12, 9))
		t.set_stylebox("hover", tipo, _caixa(Color("34322f"), Color("5a554e"), 6, 12, 9))
		t.set_stylebox("pressed", tipo, _caixa(Color("45403a"), MIOLO, 6, 12, 9))
		t.set_stylebox("hover_pressed", tipo, _caixa(Color("45403a"), MIOLO, 6, 12, 9))
		t.set_stylebox("disabled", tipo, _caixa(Color("262422"), REGRA, 6, 12, 9))
		var foco := _caixa(Color(0, 0, 0, 0), MIOLO, 7, 12, 9)
		foco.draw_center = false
		foco.set_border_width_all(2)
		foco.set_expand_margin_all(2)
		t.set_stylebox("focus", tipo, foco)
		for estado in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
			t.set_color(estado, tipo, TINTA)
		t.set_color("font_disabled_color", tipo, TINTA_3)
		t.set_font_size("font_size", tipo, 14)
	return t

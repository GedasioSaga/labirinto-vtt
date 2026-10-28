extends SceneTree
## Exporta UMA textura do pacote Desenhado e, com --folha, monta a folha de aprovação.
## Sempre pela fila do Godot (README, "Fila do Godot"). Uso, depois do "--":
##   --textura=<id>        obrigatório: a pasta texturas/<id>/ (textura.gdshader + config.json)
##   --saida=<pasta>       onde gravar os arquivos (padrão: exportado/<id>/ do projeto)
##   --folha               depois de exportar, monta a folha (mesa de prova)
##   --prova=<pasta>       onde gravar a folha e as peças (padrão: prova/<id>/ do projeto, fora do git)
##   --mapa=<map.json>     usa o chão de um mapa real (só leitura); exige --prova FORA do repositório
##   --sem-atual           não pinta a textura de hoje do app ao lado
## Sai com 0 (ok), 1 (a textura falhou: shader, teto de memória, folha) ou 2 (uso errado).

const Contrato := preload("res://comum/contrato.gd")
const Pintor := preload("res://comum/pintor.gd")
const Mesa := preload("res://comum/mesa.gd")
const ContratoTelhado := preload("res://comum/contrato_telhado.gd")
const PintorTelhado := preload("res://comum/pintor_telhado.gd")
const MesaTelhado := preload("res://comum/mesa_telhado.gd")
const ContratoCarimbo := preload("res://comum/contrato_carimbo.gd")
const PintorCarimbo := preload("res://comum/pintor_carimbo.gd")
const MesaCarimbo := preload("res://comum/mesa_carimbo.gd")


## Se algo travar (erro de script no meio de uma espera), a fila não fica presa.
const LIMITE_S := 180.0


func _initialize() -> void:
	create_timer(LIMITE_S).timeout.connect(_estourou)
	_rodar.call_deferred()


func _estourou() -> void:
	printerr("  ERRO: passou de %d s sem terminar; veja o primeiro erro acima" % int(LIMITE_S))
	quit(3)


func _rodar() -> void:
	# O projeto liga o modo econômico (run/low_processor_mode): sem isto o Godot não
	# desenha quadro novo e a espera pelos SubViewports nunca acaba.
	OS.low_processor_usage_mode = false
	var inicio := Time.get_ticks_msec()
	var args := Contrato.ler_args()
	if not args.has("textura"):
		printerr("uso: --textura=<id> [--saida=<pasta>] [--folha] [--prova=<pasta>] [--mapa=<map.json>] [--sem-atual]")
		quit(2)
		return
	var id: String = args["textura"]
	# Onda 3 (carimbo, trecho): outro contrato e outra mesa (CONTRATO.md, seção 9).
	if ContratoCarimbo.TIPOS.has(ContratoTelhado.tipo_de(id)):
		await _rodar_carimbo(args, id, inicio)
		return
	# Onda 2 (telhado, faixa, objeto): outro contrato e outra mesa (CONTRATO.md, seção 8).
	# O chão não tem "tipo" e segue exatamente o caminho de antes.
	if ContratoTelhado.tipo_de(id) != "chao":
		await _rodar_telhado(args, id, inicio)
		return
	var lido := Contrato.ler_config(id)
	if not lido["ok"]:
		for e in lido["erros"]:
			printerr("  ERRO config: ", e)
		quit(2)
		return
	var cfg: Dictionary = lido["config"]
	var saida: String = args.get("saida", ProjectSettings.globalize_path("res://exportado/%s" % id))
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova/%s" % id))
	if args.has("mapa") and _dentro_do_repo(prova):
		printerr("  ERRO: com --mapa a prova tem de ficar fora do repositório (o repo é público): %s" % prova)
		quit(2)
		return
	_esconder_do_editor(ProjectSettings.globalize_path("res://exportado"))
	if not args.has("prova"):
		_esconder_do_editor(ProjectSettings.globalize_path("res://prova"))
	print("Desenhado: exportando '%s' (%s) para %s" % [id, cfg["nome"], saida])

	var pintor := Pintor.new()
	root.add_child(pintor)
	var r: Dictionary = await pintor.pintar(cfg, saida)
	for e in r["erros"]:
		printerr("  ERRO: ", e)
	if not r["ok"]:
		quit(1)
		return
	_apagar_sobras(saida, cfg)

	var gpu := 0
	var disco := 0
	for arquivo in r["imagens"]:
		var img: Image = r["imagens"][arquivo]
		gpu += Contrato.bytes_gpu(img.get_width(), img.get_height())
		disco += _tamanho(saida.path_join(arquivo))
	var media := Contrato.cor_media(r["imagens"][Contrato.ARQUIVOS_DE_BASE[0]])
	var params := Contrato.parametros(cfg, cfg["periodoCasas"] * Contrato.CASA_PX, cfg["detalhes"]["quantos"] > 0, media, gpu, disco, r["emendas"])
	var f := FileAccess.open(saida.path_join(Contrato.ARQUIVO_DE_PARAMETROS), FileAccess.WRITE)
	f.store_string(JSON.stringify(params, "  ") + "\n")
	f.close()
	for arquivo in r["arquivos"]:
		print("  gravado: ", arquivo)
	print("  gravado: ", saida.path_join(Contrato.ARQUIVO_DE_PARAMETROS))
	for arquivo in r["emendas"]:
		var em: Dictionary = r["emendas"][arquivo]
		print("  emenda %-11s %.2f (1 = igual ao miolo)" % [arquivo, em["razao"]])
	print("  memória: %.2f MiB na GPU (teto %.1f), %.2f MiB em disco (teto %.2f)" % [gpu / 1048576.0, Contrato.TETO_GPU_POR_TEXTURA / 1048576.0, disco / 1048576.0, Contrato.TETO_DISCO_POR_TEXTURA / 1048576.0])
	var ok := true
	if gpu > Contrato.TETO_GPU_POR_TEXTURA:
		printerr("  ERRO: passou do teto de memória na GPU")
		ok = false
	if disco > Contrato.TETO_DISCO_POR_TEXTURA:
		printerr("  ERRO: passou do teto em disco (calme a textura: menos ruído fino pesa menos)")
		ok = false

	if args.has("folha"):
		var atual := {"ok": false, "motivo": "", "pasta": prova.path_join("atual")}
		if args.has("sem-atual"):
			atual["motivo"] = "pedido --sem-atual"
		elif cfg["idDoApp"] == null:
			atual["motivo"] = "esta textura não tem equivalente no app (idDoApp null)"
		else:
			atual = _pintar_atual(cfg["idDoApp"], atual["pasta"], args.get("mapa", ""))
		if not atual["ok"]:
			print("  Atual: ", atual["motivo"])
		var mesa := Mesa.new()
		root.add_child(mesa)
		var m: Dictionary = await mesa.montar(cfg, saida, prova, atual)
		for e in m["erros"]:
			printerr("  ERRO folha: ", e)
		if m["ok"]:
			var rep: Dictionary = m["resumo"]["repeticao"]
			print("  repetição (0 = cópia, 1 = não repete): só base-1 %.2f, base misturada %.2f, completo %.2f" % [rep["soBase1"], rep["baseMisturada"], rep["completo"]])
			print("  folha: ", prova.path_join("folha.png"))
		else:
			ok = false
	print("Pronto em %d ms" % (Time.get_ticks_msec() - inicio))
	quit(0 if ok else 1)


## Telhado, faixa ou objeto: pinta, grava o textura.json e, com --folha, monta a mesa dos telhados.
func _rodar_telhado(args: Dictionary, id: String, inicio: int) -> void:
	var lido := ContratoTelhado.ler_config(id)
	if not lido["ok"]:
		for e in lido["erros"]:
			printerr("  ERRO config: ", e)
		quit(2)
		return
	var cfg: Dictionary = lido["config"]
	var saida: String = args.get("saida", ProjectSettings.globalize_path("res://exportado/%s" % id))
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova/%s" % id))
	if args.has("mapa"):
		print("  --mapa não vale para telhado (a mesa monta as casas dela); ignorado")
	_esconder_do_editor(ProjectSettings.globalize_path("res://exportado"))
	if not args.has("prova"):
		_esconder_do_editor(ProjectSettings.globalize_path("res://prova"))
	print("Desenhado: exportando '%s' (%s, tipo %s) para %s" % [id, cfg["nome"], cfg["tipo"], saida])
	var pintor := PintorTelhado.new()
	root.add_child(pintor)
	var r: Dictionary = await pintor.pintar(cfg, saida)
	for e in r["erros"]:
		printerr("  ERRO: ", e)
	if not r["ok"]:
		quit(1)
		return
	# Sobras de uma exportação anterior (menos variantes, faixa que saiu) saem da pasta.
	for v in range(cfg.get("variantes", 0), 3):
		if FileAccess.file_exists(saida.path_join(Contrato.ARQUIVOS_DE_BASE[v])):
			DirAccess.remove_absolute(saida.path_join(Contrato.ARQUIVOS_DE_BASE[v]))
	if not r["temFaixa"] and FileAccess.file_exists(saida.path_join(ContratoTelhado.ARQUIVO_DA_FAIXA)):
		DirAccess.remove_absolute(saida.path_join(ContratoTelhado.ARQUIVO_DA_FAIXA))
	var gpu := 0
	var disco := 0
	for arquivo in r["imagens"]:
		var img: Image = r["imagens"][arquivo]
		gpu += Contrato.bytes_gpu(img.get_width(), img.get_height())
		disco += _tamanho(saida.path_join(arquivo))
	var params := ContratoTelhado.parametros(cfg, r, gpu, disco)
	var f := FileAccess.open(saida.path_join(Contrato.ARQUIVO_DE_PARAMETROS), FileAccess.WRITE)
	f.store_string(JSON.stringify(params, "  ") + "\n")
	f.close()
	for arquivo in r["arquivos"]:
		print("  gravado: ", arquivo)
	print("  gravado: ", saida.path_join(Contrato.ARQUIVO_DE_PARAMETROS))
	for arquivo in r["emendas"]:
		print("  emenda %-11s %.2f (1 = igual ao miolo; a junta da fileira na borda sobe o número)" % [arquivo, r["emendas"][arquivo]["razao"]])
	var ok := true
	if cfg["tipo"] == "telhado":
		print("  valor médio da base-1: %.3f (0,5 = a cor do mestre)" % r["valorMedio"])
		if absf(r["valorMedio"] - 0.5) > 0.03:
			printerr("  AVISO: o valor médio passou de 0,5 ± 0,03; o telhado vai sair mais claro ou mais escuro que a cor escolhida")
	print("  memória: %.2f MiB (teto %.1f), %.2f MiB em disco (teto %.2f)" % [gpu / 1048576.0, Contrato.TETO_GPU_POR_TEXTURA / 1048576.0, disco / 1048576.0, Contrato.TETO_DISCO_POR_TEXTURA / 1048576.0])
	if gpu > Contrato.TETO_GPU_POR_TEXTURA or disco > Contrato.TETO_DISCO_POR_TEXTURA:
		printerr("  ERRO: passou do teto de memória")
		ok = false
	if args.has("folha"):
		var mesa := MesaTelhado.new()
		root.add_child(mesa)
		var m: Dictionary = await mesa.montar(cfg, saida, prova, args.has("sem-atual"))
		for e in m["erros"]:
			printerr("  ERRO folha: ", e)
		if m["ok"]:
			print("  folha: ", prova.path_join("folha.png"))
		else:
			ok = false
	print("Pronto em %d ms" % (Time.get_ticks_msec() - inicio))
	quit(0 if ok else 1)


## Carimbo ou trecho: pinta, grava o textura.json e, com --folha, monta a mesa dos carimbos.
func _rodar_carimbo(args: Dictionary, id: String, inicio: int) -> void:
	var lido := ContratoCarimbo.ler_config(id)
	if not lido["ok"]:
		for e in lido["erros"]:
			printerr("  ERRO config: ", e)
		quit(2)
		return
	var cfg: Dictionary = lido["config"]
	var saida: String = args.get("saida", ProjectSettings.globalize_path("res://exportado/%s" % id))
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova/%s" % id))
	if args.has("mapa"):
		print("  --mapa não vale para carimbo (a mesa espalha numa grama dela); ignorado")
	_esconder_do_editor(ProjectSettings.globalize_path("res://exportado"))
	if not args.has("prova"):
		_esconder_do_editor(ProjectSettings.globalize_path("res://prova"))
	print("Desenhado: exportando '%s' (%s, tipo %s) para %s" % [id, cfg["nome"], cfg["tipo"], saida])
	var pintor := PintorCarimbo.new()
	root.add_child(pintor)
	var r: Dictionary = await pintor.pintar(cfg, saida)
	for e in r["erros"]:
		printerr("  ERRO: ", e)
	if not r["ok"]:
		quit(1)
		return
	# Sobras de uma exportação anterior (menos variações, outro tipo) saem da pasta.
	var manter: Array = r["imagens"].keys()
	for velho in ContratoCarimbo.ARQUIVOS_DO_CARIMBO + [ContratoCarimbo.ARQUIVO_DO_TRECHO, ContratoCarimbo.ARQUIVO_DO_RELEVO]:
		if not manter.has(velho) and FileAccess.file_exists(saida.path_join(velho)):
			DirAccess.remove_absolute(saida.path_join(velho))
	var gpu := 0
	var disco := 0
	for arquivo in r["imagens"]:
		var img: Image = r["imagens"][arquivo]
		gpu += Contrato.bytes_gpu(img.get_width(), img.get_height())
		disco += _tamanho(saida.path_join(arquivo))
	var params := ContratoCarimbo.parametros(cfg, r, gpu, disco)
	var f := FileAccess.open(saida.path_join(Contrato.ARQUIVO_DE_PARAMETROS), FileAccess.WRITE)
	f.store_string(JSON.stringify(params, "  ") + "\n")
	f.close()
	for arquivo in r["arquivos"]:
		print("  gravado: ", arquivo)
	print("  gravado: ", saida.path_join(Contrato.ARQUIVO_DE_PARAMETROS))
	print("  memória: %.2f MiB na placa (teto %.2f, o Atual de hoje), %.2f MiB em disco (teto %.2f)" % [gpu / 1048576.0, ContratoCarimbo.TETO_GPU_POR_CARIMBO / 1048576.0, disco / 1048576.0, ContratoCarimbo.TETO_DISCO_POR_CARIMBO / 1048576.0])
	var ok := true
	if gpu > ContratoCarimbo.TETO_GPU_POR_CARIMBO or disco > ContratoCarimbo.TETO_DISCO_POR_CARIMBO:
		printerr("  ERRO: passou do teto de memória (menos variações ou uma imagem menor)")
		ok = false
	if args.has("folha"):
		var mesa := MesaCarimbo.new()
		root.add_child(mesa)
		var m: Dictionary = await mesa.montar(cfg, saida, prova, args.has("sem-atual"))
		for e in m["erros"]:
			printerr("  ERRO folha: ", e)
		if m["ok"]:
			print("  folha: ", prova.path_join("folha.png"))
		else:
			ok = false
	print("Pronto em %d ms" % (Time.get_ticks_msec() - inicio))
	quit(0 if ok else 1)


## Roda ferramentas/atual.ts (empacotado pelo esbuild) para pintar a textura de hoje do app.
func _pintar_atual(id_do_app: String, pasta: String, mapa: String) -> Dictionary:
	var raiz := Contrato.raiz_do_repo()
	var entrada := ProjectSettings.globalize_path("res://ferramentas/atual.ts")
	var mjs := ProjectSettings.globalize_path("res://ferramentas/.build/atual.mjs")
	var esbuild := raiz.path_join("node_modules/esbuild/bin/esbuild")
	var saida_cmd := []
	var c := OS.execute("node", [esbuild, entrada, "--bundle", "--platform=node", "--format=esm", "--log-level=warning", "--outfile=" + mjs], saida_cmd, true)
	if c != 0:
		return {"ok": false, "motivo": "o esbuild falhou (%d): %s" % [c, "".join(saida_cmd).strip_edges()], "pasta": pasta}
	var argv := [mjs, "--id=" + id_do_app, "--saida=" + pasta, "--casas=%d" % Mesa.CASAS]
	if mapa != "":
		argv.append("--mapa=" + mapa)
	saida_cmd = []
	c = OS.execute("node", argv, saida_cmd, true)
	var texto := "".join(saida_cmd).strip_edges()
	if c != 0:
		return {"ok": false, "motivo": "ferramentas/atual.ts falhou (%d): %s" % [c, texto], "pasta": pasta}
	print("  ", texto)
	return {"ok": true, "motivo": "", "pasta": pasta}


func _dentro_do_repo(caminho: String) -> bool:
	var a := caminho.replace("\\", "/").simplify_path().to_lower()
	var b := Contrato.raiz_do_repo().replace("\\", "/").to_lower()
	return a.begins_with(b)


## O editor do Godot (o que o MCP usa) não importa o que a fila gera: sem .import ao
## lado dos PNGs (que iriam para o commit) e sem reimportar enquanto a fila regrava.
static func _esconder_do_editor(pasta: String) -> void:
	DirAccess.make_dir_recursive_absolute(pasta)
	var marca := pasta.path_join(".gdignore")
	if not FileAccess.file_exists(marca):
		var f := FileAccess.open(marca, FileAccess.WRITE)
		if f != null:
			f.close()


## Variantes que sobraram de uma exportação anterior (ex.: de 3 para 2) saem da pasta.
func _apagar_sobras(pasta: String, cfg: Dictionary) -> void:
	for v in range(cfg["variantes"], 3):
		var velho := pasta.path_join(Contrato.ARQUIVOS_DE_BASE[v])
		if FileAccess.file_exists(velho):
			DirAccess.remove_absolute(velho)
	if cfg["detalhes"]["quantos"] == 0 and FileAccess.file_exists(pasta.path_join(Contrato.ARQUIVO_DO_ATLAS)):
		DirAccess.remove_absolute(pasta.path_join(Contrato.ARQUIVO_DO_ATLAS))


static func _tamanho(caminho: String) -> int:
	var f := FileAccess.open(caminho, FileAccess.READ)
	if f == null:
		return 0
	var n := f.get_length()
	f.close()
	return n

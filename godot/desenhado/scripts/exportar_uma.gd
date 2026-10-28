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

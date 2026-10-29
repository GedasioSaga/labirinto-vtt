extends Node
## O caminho do traço (onda 5, CONTRATO.md seção 11) dentro de scripts/exportar_uma.gd:
## exporta o item e, com --folha, monta a mesa dos traços (comum/mesa_traco.gd).
## O exportar_uma.gd carrega este arquivo com load() só quando o tipo é "traco": um erro
## aqui não derruba a exportação das ondas 1 a 4.

const Contrato := preload("res://comum/contrato.gd")
const ContratoTraco := preload("res://comum/contrato_traco.gd")
const PintorTraco := preload("res://comum/pintor_traco.gd")
const MesaTraco := preload("res://comum/mesa_traco.gd")


## Devolve o código de saída (0 ok, 1 falhou, 2 uso errado).
func rodar(args: Dictionary, id: String, inicio: int) -> int:
	var lido := ContratoTraco.ler_config(id)
	if not lido["ok"]:
		for e in lido["erros"]:
			printerr("  ERRO config: ", e)
		return 2
	var cfg: Dictionary = lido["config"]
	var saida: String = args.get("saida", ProjectSettings.globalize_path("res://exportado/%s" % id))
	var prova: String = args.get("prova", ProjectSettings.globalize_path("res://prova/%s" % id))
	_esconder(ProjectSettings.globalize_path("res://exportado"))
	if not args.has("prova"):
		_esconder(ProjectSettings.globalize_path("res://prova"))
	print("Desenhado: exportando o traço '%s' (%s, %s) para %s" % [id, cfg["nome"], cfg["parte"], saida])
	var pintor := PintorTraco.new()
	add_child(pintor)
	var r: Dictionary = await pintor.pintar(cfg, saida)
	for e in r["erros"]:
		printerr("  ERRO: ", e)
	if not r["ok"]:
		return 1
	var memoria := 0
	var disco := 0
	for nome in r["imagens"]:
		var img: Image = r["imagens"][nome]
		memoria += ContratoTraco.bytes_memoria(img.get_width(), img.get_height())
		disco += FileAccess.get_file_as_bytes(saida.path_join(nome)).size()
	var params := ContratoTraco.parametros(cfg, r, memoria, disco)
	var f := FileAccess.open(saida.path_join(Contrato.ARQUIVO_DE_PARAMETROS), FileAccess.WRITE)
	f.store_string(JSON.stringify(params, "  ") + "\n")
	f.close()
	for a in r["arquivos"]:
		print("  gravado: ", a)
	print("  costura: ", JSON.stringify(r["costura"]))
	print("  memória: %.2f MiB (teto %.1f), %.2f MiB em disco (teto %.2f)" % [memoria / 1048576.0, ContratoTraco.TETO_MEMORIA / 1048576.0, disco / 1048576.0, ContratoTraco.TETO_DISCO / 1048576.0])
	var ok := true
	if memoria > ContratoTraco.TETO_MEMORIA:
		printerr("  ERRO: passou do teto de memória")
		ok = false
	if disco > ContratoTraco.TETO_DISCO:
		printerr("  ERRO: passou do teto em disco")
		ok = false
	if args.has("folha"):
		var mesa := MesaTraco.new()
		add_child(mesa)
		var m: Dictionary = await mesa.montar(cfg, saida, prova, args)
		for e in m["erros"]:
			printerr("  ERRO folha: ", e)
		if m["ok"]:
			print("  folha: ", prova.path_join("folha.png"))
		else:
			ok = false
	print("  pronto em %.1f s" % ((Time.get_ticks_msec() - inicio) / 1000.0))
	return 0 if ok else 1


static func _esconder(pasta: String) -> void:
	DirAccess.make_dir_recursive_absolute(pasta)
	var g := pasta.path_join(".gdignore")
	if not FileAccess.file_exists(g):
		var f := FileAccess.open(g, FileAccess.WRITE)
		f.store_string("")
		f.close()

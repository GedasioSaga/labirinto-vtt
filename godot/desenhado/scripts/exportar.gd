extends Node
## Exportador de linha de comando. Uso (do README):
##   Godot_v4.7.2-stable_win64_console.exe --path <projeto> res://cenas/exportar.tscn -- [opções]
## Opções (todas opcionais):
##   --saida=<pasta>      onde gravar os PNGs (padrão: a pasta exportado/ do projeto)
##   --folha=<arquivo>    grava também uma cópia da folha de contato neste caminho
##   --periodo=512        período em px do mundo (múltiplo de 512; 512 = 8 casas)
##   --escala=1           1 = 64 px por casa; 2 = 128 px por casa (imagem 2x maior)
##   --semente=7          outra semente, outro desenho (sempre o mesmo para a mesma semente)

const Exportador := preload("res://scripts/exportador.gd")


func _ready() -> void:
	var args := ler_args()
	var pasta: String = args.get("saida", ProjectSettings.globalize_path("res://exportado"))
	var periodo := int(args.get("periodo", "512"))
	var escala := int(args.get("escala", "1"))
	var semente := int(args.get("semente", "7"))
	if periodo < 512 or periodo % 512 != 0 or escala < 1 or escala > 4:
		printerr("periodo precisa ser múltiplo de 512 (pedra e telha fecham a cada 8 casas) e escala de 1 a 4")
		get_tree().quit(2)
		return
	var exportador := Exportador.new()
	add_child(exportador)
	print("Exportando %d texturas de %d px (escala %d, semente %d) para %s" % [Exportador.TEXTURAS.size(), periodo * escala, escala, semente, pasta])
	var r: Dictionary = await exportador.exportar(pasta, periodo, escala, semente)
	for caminho in r["arquivos"]:
		print("  gravado: ", caminho)
	for nome in r["emendas"]:
		var em: Dictionary = r["emendas"][nome]
		print("  emenda %-8s borda %.2f / miolo %.2f = %.2f" % [nome, em["borda"], em["miolo"], em["razao"]])
	if args.has("folha") and r["folha"] != null:
		var destino: String = args["folha"]
		DirAccess.make_dir_recursive_absolute(destino.get_base_dir())
		var e: int = (r["folha"] as Image).save_png(destino)
		print("  folha de contato: ", destino, "" if e == OK else " (erro %d)" % e)
	for erro in r["erros"]:
		printerr("  ERRO: ", erro)
	print("Pronto em %d ms" % r["ms"])
	get_tree().quit(0 if r["ok"] else 1)


static func ler_args() -> Dictionary:
	var args := {}
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--") and a.contains("="):
			var i := a.find("=")
			args[a.substr(2, i - 2)] = a.substr(i + 1)
		elif a.begins_with("--"):
			args[a.substr(2)] = "1"
	return args

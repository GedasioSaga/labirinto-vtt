# Modelo de prompt: um designer, uma textura

Para o orquestrador: copie o bloco abaixo, troque `<id>`, `<nome>`, `<lote>` e
`<PROVA>` (uma pasta do scratchpad da sessão, por exemplo
`.../scratchpad/desenhado/lote-1/<id>`) e mande um designer por textura. Os 5 podem rodar
ao mesmo tempo no mesmo worktree: cada um escreve só na pasta dele, e o Godot passa por
uma fila.

---

Você vai fazer UMA textura do pacote Desenhado do Labirinto: **`<id>` (<nome>)**, lote
<lote>. Worktree `C:/dev/labirinto-desenhado`, branch `feat/desenhado`, projeto Godot em
`godot/desenhado/`. Outros 4 designers estão trabalhando ao mesmo tempo, no mesmo
worktree, cada um na sua textura.

**Leia antes de desenhar, nesta ordem:**

1. `godot/desenhado/ESTILO.md` inteiro (a crítica do usuário vira regra: nada de bolinha,
   escama ou pontilhado; formas calmas; ambiente grande não pode parecer repetido).
2. `godot/desenhado/CONTRATO.md` inteiro (o que entregar e como o app monta o chão).
3. A sua linha em `godot/desenhado/INVENTARIO.md`.
4. O exemplo: `godot/desenhado/texturas/grama/` (piloto, não é final) e o modelo
   `godot/desenhado/texturas/_modelo/`.
5. A biblioteca que você só inclui: `comum/cabecalho.gdshaderinc` (as duas funções que
   você escreve e os ajudantes de tom) e `shaders/base.gdshaderinc` (paleta, `rz`, `fz`,
   `hash_cel`, `rk`, `pinceladas`, `grao`, `cobre`, `sd_traco`, `sd_elipse`, `sd_caixa`,
   `girar`, `sobre`).
6. As referências: `docs/design/objeto-fogo/prototipo.html` (`pintarGrama`,
   `pintarTufos`) e `docs/design/vila-meio-termo/README.md`.
7. Para comparar com o que o app mostra hoje, a primeira folha já põe o Atual ao lado.

**Onde você pode escrever: só aqui.**

- `godot/desenhado/texturas/<id>/` (crie copiando `texturas/_modelo/`): `textura.gdshader`
  e `config.json`. Ponha `"id": "<id>"` e o `idDoApp` da sua linha do inventário.
- `godot/desenhado/exportado/<id>/` é gerada pelo exportador; não edite à mão.
- A folha vai para `<PROVA>` (fora do repo).

**Não edite nada fora da sua pasta.** Em especial: `comum/`, `shaders/`, `scripts/`,
`cenas/`, `ferramentas/`, `project.godot`, os `.md`, `client/` e as pastas de outra
textura. Se a biblioteca não tiver algo que você precisa, escreva a função **no seu**
`textura.gdshader`. Se achar um defeito na biblioteca, pare e reporte; não conserte.

**Comandos** (Git Bash; sempre pela fila, nunca o Godot direto):

```
GODOT="C:/Users/gedasio.filho/AppData/Local/Microsoft/WinGet/Packages/GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe/Godot_v4.7.2-stable_win64_console.exe"
export SUITE_LOCK_DIR=C:/Users/gedasio.filho/.claude/state/godot-lock

# exportar e montar a folha (cerca de 10 s; uma janela do Godot pisca e fecha)
node C:/Users/gedasio.filho/.claude/scripts/suite-lock.cjs --nome <id> -- "$GODOT" --path C:/dev/labirinto-desenhado/godot/desenhado --script res://scripts/exportar_uma.gd -- --textura=<id> --folha --prova=<PROVA>

# a mesma folha no chão do mapa real do usuário (só leitura; a prova TEM de estar fora do repo)
... -- --textura=<id> --folha --prova=<PROVA> --mapa="C:/Users/gedasio.filho/AppData/Roaming/com.labirinto.app/maps/map_1acb843c-0d7a-4e0c-8d61-0b2d891093b5/map.json"
```

Sai com 0 (ok), 1 (a textura falhou: shader, teto de memória) ou 2 (config errado). O erro
de shader do Godot aparece no terminal com a linha. Se o comando esperar na fila, é outro
designer exportando: espere, não rode por fora.

**MCP do Godot (opcional): é UM editor, o mesmo para os 5.** As ferramentas `mcp__godot__*`
falam com um editor só (porta 6505), que o orquestrador abre neste projeto antes de mandar
vocês. A exportação e a folha que valem são sempre as do comando acima, pela fila; o MCP é
para olhar e experimentar.

1. Comece com `get_godot_status`. Se `connected` for false, ou o `project_path` não for
   `C:/dev/labirinto-desenhado/godot/desenhado/`, não use o MCP e **não abra outro editor**
   (o segundo briga pela porta e pelo cache `.godot/`): siga só com a linha de comando.
2. **Livre a qualquer hora** (só lê): `get_godot_status`, `get_errors`, `get_console_log`,
   `read_file`, `list_dir`, `search_project`, `validate_script`, `classdb_query`,
   `get_guide`. O console e a lista de erros são de todos: procure o seu caminho neles.
3. **Escrever pelo MCP** (`write_file`, `edit_script`, `create_scene`, `create_folder`,
   `save_resource_to_file`): só dentro de `res://texturas/<id>/`, como qualquer escrita. Uma
   cena de bancada sua, se quiser: `res://texturas/<id>/bancada.tscn`.
4. **Mexer no estado do editor** (abrir cena, `add_node`, `set_node_properties`,
   `instance_scene`, `run_scene`, `take_screenshot`, `stop_scene`, `send_input`,
   `set_editor_selection`, `close_editor_tabs`): só na **vez do editor**, uma fila própria,
   separada da de exportar. Pegue a vez em segundo plano (`run_in_background`; dura até 3 min):

   ```
   SUITE_LOCK_DIR=C:/Users/gedasio.filho/.claude/state/godot-editor-lock node C:/Users/gedasio.filho/.claude/scripts/suite-lock.cjs --nome <id> -- node -e "setTimeout(()=>{},180000)"
   ```

   Confira com `SUITE_LOCK_DIR=.../godot-editor-lock node .../suite-lock.cjs --status` que
   está "rodando: <id>", faça o que precisa, deixe o editor como achou (pare a cena, feche a
   aba que você abriu) e solte a vez parando aquela tarefa (`TaskStop`). Sem a vez, a sua
   cena derruba a de outro designer, e o print sai com a cena dele.
5. **Nunca:** `map_project`; `mcp_undo` e `mcp_redo` (o histórico é de todos: você desfaria
   o trabalho de outro); `update_project_settings`, `setup_autoload`, `configure_input_map`;
   `delete_file` ou `delete_folder` fora da sua pasta; exportar ou montar a folha pelo editor.

**Como trabalhar:** comece pela base calma e só depois o atlas. A cada rodada, abra
`<PROVA>/folha.png` e olhe as três coisas: a área de 40 x 40 a 50% (repete? vira
pontilhado?), o miolo a 100% e o close a 300%. Olhe também o número de repetição no topo da
folha. Mexa nos números do `config.json` (densidade, agrupamento, mistura) antes de
redesenhar.

**Detalhe grande que empilha** (copa, arbusto, pedra grande): se a folha mostra dois caindo
quase um em cima do outro, ligue o afastamento em `detalhes` do `config.json`:
`"afastarCasas": 0.875`. É a distância, em casas, que ele tenta deixar entre dois centros
vizinhos; o máximo é meia célula (0,5 com `celulaCasas: 1`, 1 com `celulaCasas: 2`).
Comece perto do diâmetro visível do detalhe menos um terço (a floresta, com copas de ~1,4
casa, usa 0,875). Ele não tira nem põe detalhe: as moitas e clareiras ficam iguais, só os
vizinhos próximos se afastam. Não use em detalhe miúdo (tufo, flor, pedrinha): ali o
empilhado não aparece e a conta fica mais cara. Sem o campo, o espalhamento é o de sempre.
O app tem de fazer a mesma conta quando integrar (CONTRATO.md, seção 4).

**Detalhe grande e solto, em grupos redondos** (árvore de 2 casas ou mais, como no
Bosque): a grade normal tem um ponto por meia célula, e com ela a peça grande cai em cima
da vizinha. Ponha em `detalhes` `"passoCasas": 1.8` (a distância da grade, em casas: mais
que meia célula e até 4; use `afastarCasas` igual a ele e `densidade · passoCasas²` até
0,85), e a escala pode ir até 2. Para bosquetes redondos com clareira entre eles, no lugar
das manchas do ruído, use `"grupos": { "gradeCasas": 12, "chance": 0.85, "raioMin": 0.38,
"raioMax": 0.5 }` (um grupo por quadrado de 12 casas, raio em lados do quadrado) e
`agrupamento` perto de 1, para a borda do grupo ficar nítida. `"espelhar": true` vira a peça
na diagonal em metade das células (4 peças viram 8 formas; a luz continua certa). Sem os
campos, nada muda. O app tem de fazer a mesma conta (CONTRATO.md, seção 4).

**Pronto quando** (CONTRATO.md, seção 6): o comando sai com 0; emenda de cada base entre
0,8 e 1,25 (ou a junta explicada); repetição "completo" >= 0,80; e você olhou a folha nos
três zooms sem achar repetição, pontilhado ou serrilhado.

**Testes:** nenhum teste automático (regra do usuário). A prova são as rodadas do Godot e
a folha.

**Commit:** só dos seus caminhos, sem push:

```
git -C C:/dev/labirinto-desenhado add godot/desenhado/texturas/<id> godot/desenhado/exportado/<id>
git -C C:/dev/labirinto-desenhado commit -m "feat(desenhado): <id> texture" -- godot/desenhado/texturas/<id> godot/desenhado/exportado/<id>
```

Última linha da mensagem: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
Nunca commite a folha nem imagem do mapa do usuário (o repo é público).

**Entregue (até 20 linhas):** o caminho da folha; os números da folha (repetição, emendas,
memória); o que você acha que ainda está fraco, dito com honestidade; e o hash do commit.

---

## Onda 2: o que muda para quem faz telhado, objeto e faixa (28/10/2026)

Acrescente este bloco ao prompt de cada designer da onda 2 (lote 5). O resto do prompt
acima continua valendo (onde escrever, a fila, a vez do editor, o commit, sem testes).

**Leia, além do ESTILO.md:** CONTRATO.md seção 8 inteira; `comum/telhado.gdshaderinc` (as
funções que você escreve); o piloto `texturas/telhado-telhas/` (telhado com faixa própria);
e o modelo do seu tipo: `texturas/_modelo-objeto/` (chaminé) ou `texturas/_modelo-faixa/`
(cumeeira amarrada). No app, só para ler: `client/src/texturas/telhado.ts` (o desenho de
hoje), `client/src/texturas/meioTermo/chamine.ts` e `cumeeiraAmarrada.ts`.

**Por tipo:**

| Item | `tipo` | Você escreve | Rodapé | Notas |
|---|---|---|---|---|
| `telhado-madeira`, `telhado-palha` | `telhado` | `vec2 pintar_telhado(p, P, px, sem, qual)` devolvendo (valor, lado) | `rodape_telhado` | `idDoApp` = `madeira` ou `palha`; a palha põe `"faixa": { "de": "cumeeira-amarrada" }` e, se quiser a franja, `"beiral": { "franjaPx": 1.6 }` |
| `cumeeira-amarrada` | `faixa` | `vec3 pintar_faixa(q, L, meia, px, sem)` devolvendo (valor, lado, alfa), com `#define SO_FAIXA` | `rodape_telhado` | `"modelo": "palha"`, `"faixa": { "comprimentoPx": 36, "meiaLarguraPx": 4, "onde": ["cumeeira"] }` (a de hoje: 3,4 px de cada lado, amarra a cada 9 px) |
| `chamine` | `objeto` | `vec4 pintar_objeto(q, px, sem)`, cor reta e alfa, COM a sombra | `rodape_objeto` | `"objeto": { "ladoPx": 64, "corpoPx": 40, "ancoraPx": [29, 29] }`: q = px do mapa a partir do centro do corpo; o app escala o corpo para 11 a 20 px do mapa |

**O que é diferente do chão:**

1. **Valor, não cor** (telhado e faixa). Você pinta em cinza: 0,5 é exatamente a cor que o
   mestre escolher, das 6 do modelo ou livre. Mexa a luz com `valor_de(luz)` (luz de
   -0,5 a 0,5). A média da água tem de ficar em 0,5 ± 0,03 (o exportador mede a base-1 e
   avisa). Nada de matiz: a cor é do mestre.
2. **O espaço é a água.** p.x = u ao longo do beiral; p.y = v subindo da PONTA do beiral.
   As fileiras fecham no período (P / altura da fileira inteiro, e v = 0 é a borda de baixo
   de uma fileira). `fileira_em(v, a)` devolve o índice e onde o ponto está na fileira.
3. **O lado, não a luz lateral.** O que acende de um lado (a capa da telha, a beira da
   tábua, o feixe da palha) vai no segundo número, `lado` (-1..1, +1 = virada para +u). O
   app acende pela luz de cada água. Se você pintar a luz lateral no valor, ela fica certa
   numa água e errada na do outro lado.
4. **O que é do app, não seu:** a luz de cada água, a ponta escura do beiral, a sombra do
   rincão, a sombra no chão, a cor. Só mude os números (`luz`, `beiral`, `rincao` no
   `config.json`) se a folha pedir.
5. **Mesma geometria nas variantes.** Fileiras, colunas e empeno usam `sem`; tom de cada
   peça, desbotado e grão usam `sem + qual * 1000`. 2 variantes bastam no telhado.
6. **Escala calma.** O app de hoje pinta 32 telhas por casa (13 x 10 px); o piloto usa 7,5
   (25,6 x 21,3 px) para nada virar escama a 25%. Pense na tábua e na palha do mesmo jeito:
   menos e maior. Peça repetida igual em fila vira "wwww": sorteie um pouco cada peça (o
   piloto sorteia o quanto cada ponta de capa avança).
7. **Objeto: a luz não gira.** A chaminé fica sempre de pé na tela: pinte a sombra para
   baixo e para a direita, como no chão. Não é tingida: use a paleta.

**Comandos:** os mesmos (`exportar_uma.gd --textura=<id> --folha --prova=<PROVA>`). O
exportador vê o `tipo` e monta a mesa dos telhados: a casa retangular e a casa em L em 3
cores, a 100%, 50%, 25% e 300%, o telhado grande e o Atual ao lado. `--mapa` não vale aqui.
A faixa e o objeto saem por cima do telhado do Desenhado (`"sob"` no config; padrão
`telhado-palha` e `telhado-telhas`); se ele ainda não existe, por cima de um telhado liso
na cor (a folha avisa). A palha mostra a faixa da `cumeeira-amarrada` assim que ela for
exportada; antes disso, a folha avisa e sai sem faixa.

**Olhe na folha:** as águas se leem (cada uma num tom, como o Atual); o telhado grande a
50% sem repetição reconhecível; nada de escama, bolinha ou "wwww" a 25% e 50%; as 3 cores
sem estourar (a escura, preto ou nogueira ou musgo, ainda mostra a forma); a cumeeira e o
rincão do L a 300% sem serrilha nem degrau. A média de cada cor está no título de cada
bloco: até ±0,01 de luz OKLab.

**Pronto quando** (CONTRATO.md 8.9): sai com 0; valor médio 0,5 ± 0,03; emenda entre 0,8 e
1,25 (ou explicada); e o olho na folha acima. A repetição "completo" do chão não vale aqui.

---

## Notas para o orquestrador

- **Onda 2:** a folha do lote dos telhados é outro comando (lê `area50.png`,
  `atual-area50.png`, `perto300.png`, `atual-perto300.png` e `resumo.json` de cada pasta):
  `... --script res://scripts/folha_do_lote_telhados.gd -- --texturas=telhado-telhas,telhado-madeira,telhado-palha,chamine,cumeeira-amarrada --prova=<raiz das PROVAS> --saida=<raiz>/lote.png`.
  A palha e a `cumeeira-amarrada` se usam uma à outra (a faixa da palha vem da cumeeira; a
  folha da cumeeira sai por cima da palha) e a `chamine` sai por cima da `telhado-telhas`:
  depois que os 5 terminarem, rode `--folha` de novo nesses três antes da folha do lote,
  para cada um pegar a versão final do outro.
- A folha do lote, depois que os 5 terminarem:
  `... --script res://scripts/folha_do_lote.gd -- --texturas=a,b,c,d,e --prova=<raiz das PROVAS> --saida=<raiz>/lote.png --titulo="Lote N"`
  (lê `<raiz>/<id>/area50.png`, `atual-area50.png`, `perto300.png` e `resumo.json`).
- **O editor do MCP é seu de abrir e fechar**, um só, antes de mandar os designers (em
  segundo plano), e fechado quando o lote acaba:
  `"C:/Users/gedasio.filho/AppData/Local/Microsoft/WinGet/Packages/GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe/Godot_v4.7.2-stable_win64.exe" --path C:/dev/labirinto-desenhado/godot/desenhado -e`.
  Confira com `get_godot_status` (uns 10 s depois). Conferido em 28/10: com o editor aberto,
  a exportação pela fila saiu igual (exit 0, os mesmos números); o editor não importa
  `exportado/` nem `prova/` (`.gdignore`, gravado pelo exportador), os `.uid` que ele cria
  estão no `.gitignore` e o `project.godot` já está no formato que ele grava, então abrir o
  editor não suja o git. Nunca `map_project`.
- A vez do editor (passo 4 do prompt) conferida em 28/10: com a vez presa, o segundo
  esperou ("fila 2 de 2"); parada a tarefa que a prendia, o seguinte entrou na hora.
- Cada exportação leva uns 10 s na fila; 5 designers em rodadas de 2 a 3 minutos quase
  não esperam.

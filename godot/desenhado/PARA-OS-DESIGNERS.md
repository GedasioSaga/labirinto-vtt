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

## Onda 3: o que muda para quem faz carimbo, sebe e móvel (28/10/2026)

Acrescente este bloco ao prompt de cada designer da onda 3 (lotes 6 a 8). O resto do prompt
acima continua valendo (onde escrever, a fila, a vez do editor, o commit, sem testes).

**A regra da onda, literal do usuário:** "tá muito detalhado, cheio de bolinhas, fica
estranho, faz algo mais bonito". Forma grande e calma, poucas massas largas, luz em cima à
esquerda, sombra suave, contorno como o protótipo do Fogo
(`docs/design/objeto-fogo/prototipo.html`, `pintarArvore`). Nenhuma escama, bolinha nem
pontilhado.

**Leia, além do ESTILO.md:** CONTRATO.md seção 9 inteira; `comum/carimbo.gdshaderinc` (as
assinaturas e as unidades de q); a árvore `texturas/arvore/` (refeita em 28/10: em pé, meio
de lado, com tronco; copa de 6 cachos largos em 3 tons, a luz só nos de cima à esquerda) e o
modelo do seu tipo: `texturas/_modelo-carimbo/` ou
`texturas/_modelo-trecho/`. No app, só para ler: o desenho de hoje do seu item em
`client/src/carimbos/embutidos.ts` (ou `animacoes/carimbo/` para o girassol) e, para a
sebe e a jardineira, `client/src/texturas/meioTermo/moveis/`.

**Por tipo:**

| Item | `tipo` | Você escreve | Notas |
|---|---|---|---|
| árvores, pinheiros, arbusto, palmeira, juncos, pedras, poça, girassol(óis) | `carimbo`, `destino: "carimbo"` | `vec4 pintar_carimbo(q, px, sem, k)`, cor reta e alfa, SEM sombra | `tamanhoDoApp` = o `tamanho` do embutido (árvore 15, árvore redonda 14, pinheiros 14, palmeira 13, poça 12, pedras 10, arbusto 6, juncos 6) ou do `.json` do pacote (girassol); desenho em pé, com o tronco ou o pé embaixo (como a árvore de 28/10) = `"espelho": "nenhum"` e `"sombra": {"jeito": "em-pe"}` (a sombra de hoje, `comprimento` 0,78); visto de cima: "em pé" de hoje = `deslocada` ~0,16; "baixa" = `deslocada` ~0,06 a 0,08; a poça = `nenhuma` |
| `vaso` | `carimbo`, `destino: "movel"` | o mesmo | 1 unidade = 1 casa (o vaso tem 0,5); sem `tamanhoDoApp` |
| `sebe` | `trecho`, `curva: true`, `casas: [2, 0.5]` | `vec4 pintar_trecho(...)` (a cor SEM luz de direção) e `vec2 relevo_do_trecho(...)`, com `#define TRECHO` antes do rodapé | q.x = s ao longo (de -ponta a 0 é a ponta do começo; depois repete a cada L); q.y = c atravessando |
| `jardineira` | `trecho`, `curva: false`, `casas: [1, 0.5]` | o mesmo | o móvel esticado repete o período; não estica a imagem |

**O que é diferente do chão e do telhado:**

1. **A imagem nunca gira.** O giro do mestre escolhe a forma: até 4 arquivos e o espelho na
   diagonal dão 8 formas. Desenhe o objeto CENTRADO no meio da imagem (o espelho é a
   imagem transposta: o meio não anda) e com a luz de cima à esquerda nas 4 variações. Cada
   variação tem de ser outra forma (lobos, tamanho, tom), não a mesma com ruído. Desenho em
   pé (`"espelho": "nenhum"`): transposto ele deitaria, então não espelha e são só 4 formas
   (o giro k e o k + 4 dão o mesmo); as 4 têm de ser bem diferentes (cachos, tom, inclinação).
2. **A sombra no chão é do app**, pela silhueta: não pinte sombra fora do objeto. Pinte só a
   sombra de DENTRO (uma massa no lado de baixo à direita da outra; na árvore em pé, a copa
   também escurece o alto do tronco). Em pé: `em-pe`, deitada a partir do pé como a de hoje.
3. **A âncora vem da folha.** Rode uma vez com a âncora do modelo, leia o "Centro do Atual"
   no topo da folha e ponha `ancoraPx = [meio - cx x unidadePx, meio - cy x unidadePx]`
   (meio = ladoPx / 2). Assim o objeto fica onde o de hoje fica.
4. **O tamanho é o de hoje.** `unidade_mundo` diz quantos px do mundo tem uma unidade no
   mapa de referência (a árvore: 154,6 px); 2 px do mundo = `2.0 / unidade_mundo`. Escolha
   `ladoPx` e `unidadePx` para a imagem ter uns 2 px da imagem por px do mundo e caber no
   teto (4 x 352² = 2,52 MiB de 2,67).
5. **Trecho: luz do app.** A cor vai sem luz de direção; o relevo diz para onde cada ponto
   inclina (x ao longo, y atravessando, -1 a 1). O app acende depois de deitar o trecho na
   curva (CONTRATO.md 9.5). Se pintar luz na cor, a sebe que vira para cima fica errada.
6. **Escala calma, de novo.** A copa da árvore tem 6 cachos, cada um em 3 camadas: a massa
   inteira no tom da sombra, por cima a mesma forma menor e andada para a luz no tom do meio,
   e um boné de luz só nos cachos de cima à esquerda, encostado na borda clara. Disco de
   brilho no meio do cacho vira alvo ou bolha; luz em todo cacho vira bolhas a 25%; vista de
   cima sem tronco, a copa lê como moita ou nuvem. Festão raso e largo, não serrilha.

**Comandos:** os mesmos (`exportar_uma.gd --textura=<id> --folha --prova=<PROVA>`, uns 10 s;
`--saida=<pasta>` para exportar fora do repositório). O exportador vê o `tipo` e monta a mesa
dos carimbos no Chromium do Playwright (Canvas 2D, o motor dos carimbos de hoje). `--mapa`
não vale aqui.

**Olhe na folha:** o sozinho a 300% (a forma calma, o contorno, a luz) e a 25% (nada de
bolinha); as formas (todas diferentes, a luz sempre de cima à esquerda, nenhuma cortada
pela borda); o bosque a 50% e 25% (ninguém acha a mesma árvore; o Atual ao lado com os
mesmos objetos) e o recorte da mata fechada a 100% (as massas se separam). No trecho: as 8
formas e os 9 trechos (emenda a cada L, a ponta do fim, a luz nas curvas).

**Pronto quando** (CONTRATO.md 9.9): sai com 0, a memória cabe, a âncora pela conta acima e
o olho na folha.

---

## Onda 4: o que muda para quem desenha um móvel (29/10/2026)

Leia a seção 10 do `CONTRATO.md`. Decisão do usuário de 29/10 ("Desenho à mão que pega
cor"): cada móvel é **redesenhado à mão**, como as árvores da onda 3, em cinza com as
partes marcadas, e o app tinge cada parte com o material do mestre. O caminho de antes
(só a superfície dos 8 materiais, com o motor de hoje desenhando a forma) foi **reprovado**
no mesmo dia: *"Não parece que teve muita mudança ainda parece o mesmo atual e não
desenhado"*. A forma é o Desenhado. Um designer, um lote de até 5 móveis
(`INVENTARIO.md`, lotes 10 a 15): `texturas/movel-<nome>/`, copiado de `_modelo-movel/` ou
do piloto que mais se parece (`movel-mesa` para tampo e pernas, `movel-cadeira` para vista
de lado e variante, `movel-barril` para o redondo e o metal).

**O desenho (o que o usuário aprova):**

1. **Contorno grosso na própria cor e formas grandes.** As funções `desenhar_caixa`,
   `desenhar_elipse` e `pousar_com_contorno` já põem o contorno da família (0,042 casa, mais
   fino na peça estreita).
2. **Luz em poucas massas.** As mesmas funções põem a massa clara em cima à esquerda e a
   escura embaixo à direita, largas o bastante para ler a 50%. Num tampo ou num assento,
   2 ou 3 tábuas ou panos com tons separados e uma junta firme; nada mais.
3. **A crítica de 28/10** (*"tá muito detalhado, cheio de bolinhas, fica estranho, faz algo
   mais bonito"*): **nada** de veio em risquinho, prego em bolinha, nó ou granulado. Se uma
   coisa só aparece a 300%, ela sobra.
4. **A 50%, ao lado do Atual, tem de se ver que é outro desenho.** É o teste do usuário.

**O que é diferente dos outros tipos:**

1. **Cinza e partes.** `pintar_movel` pinta valor (0,5 = o tom do material; os níveis
   `V_*` do cabeçalho) e o lugar de cada camada (1, 2, 3 na ordem de `lugares`, que tem de
   ser a de `LUGARES_DE_MATERIAL` do app: a mesa de prova confere). Cor própria (louça,
   água, chama, lençol) só com `pousar_cor` e `"corFixa": true`.
2. **A luz não gira com o móvel.** Desenhe no referencial do móvel (`m = movel_de(q, vir)`)
   e acenda no da tela (`LUZ`, `para_a_luz`; as funções de caixa e elipse já fazem). Diga
   em `viradas` quantas desenhar: 1 se é simétrico de lado a lado e de cima a baixo, 2 se
   só de lado a lado, 4 se não (CONTRATO 10.4). A folha mostra as 4.
3. **Esticar:** tudo o que muda ao longo (quinas, pernas, a massa da ponta) fica dentro de
   `pontasCasas`; o meio é a mesma coluna em todo x. O exportador mede e avisa se o meio
   não é liso.
4. **Vista de lado** (os 8 de `TIPOS_COM_VISTA`): `vistas.lado` com a pegada de lado do app;
   `vis == 1` no shader. Tem de ler como o mesmo móvel.
5. **Variantes** só quando uma opção muda o desenho (o assento de palha ou de madeira, as
   varas ou a corda da cerca). `mesma` (o assento da mesma madeira) é tingido com o tom do
   lugar 1.
6. **Sombra no chão é do app**: escolha só `deslocamentoCasas` (a altura do móvel: mesa
   0,22, barril 0,14, cadeira 0,11) e um `borraoCasas` curto (0,02 a 0,03).
7. **O teto:** 3 MiB por móvel com todas as formas (a cadeira, com 12 formas, gasta 0,99).

**Comandos:** exporte todos os do lote, depois as folhas (a cena de família lê o que está
em `exportado/`): `exportar_uma.gd --textura=movel-<nome>` e
`exportar_uma.gd --textura=movel-<nome> --folha --prova=<PROVA>/movel-<nome>` (uns 7 s).
O `node` pinta o Desenhado pela conta de `ferramentas/movel.ts` e o Atual pelo motor dos
móveis da main (só leitura).

**Olhe na folha:** sozinho e nas 3 combinações a 100, 50 e 25%, Desenhado ao lado do Atual;
300%; os 5 tons de madeira (separados; a medida embaixo); as 4 viradas e a de lado; a
esticada em 1,4, 2, 3 e 5 casas; a família na grama aprovada, com as árvores, as pedras e o
tronco caído; e os arquivos sobre xadrez (o vermelho, o verde e o azul das partes).

**Pronto quando** (CONTRATO.md 10.10): sai com 0, a memória cabe, o meio é liso, os lugares
batem com o app, e o olho na folha: calmo, sem bolinha, outro desenho a 50%, a luz no lugar
nas 4 viradas, e da família das folhas dos lotes 6 a 8.

---

## Notas para o orquestrador

- **Onda 4:** a folha do lote dos móveis é outro comando (lê `area50.png`,
  `atual-area50.png`, `perto300.png`, `atual-perto300.png` e `resumo.json` de cada pasta, e
  a família de `--familia`):
  `... --script res://scripts/folha_do_lote_moveis.gd -- --texturas=movel-a,movel-b,movel-c,movel-d,movel-e --prova=<raiz das PROVAS> --saida=<raiz>/lote.png --titulo="Lote 10, móveis" --familia=movel-a`.
  Exporte **todos** os móveis do lote antes das folhas: a cena de família pinta Desenhado o
  que já está em `exportado/movel-*` e Atual o resto (a mesa, as 5 cadeiras e os 3 barris
  do piloto; um lote novo que queira aparecer nela acrescenta os seus objetos a
  `familiaObjs` de `ferramentas/mesa_movel.ts`). Lote 9 = o piloto mesa, cadeira, barril, para
  o usuário aprovar a direção antes dos lotes 10 a 15; se ele mudar a direção, os outros
  copiam. A mesa empacota o client da **main** (`git --git-common-dir`), porque os 8 móveis
  de casa de 28/10 ainda não estão na `feat/desenhado`. O caminho reprovado
  (`material-madeira`, `folha_do_lote_materiais.gd`) segue no repo, sem uso.
- **Onda 3:** a folha do lote dos carimbos é outro comando (lê `area25.png`,
  `atual-area25.png`, `perto300.png`, `atual-perto300.png` e `resumo.json` de cada pasta):
  `... --script res://scripts/folha_do_lote_carimbos.gd -- --texturas=a,b,c,d,e --prova=<raiz das PROVAS> --saida=<raiz>/lote.png --titulo="Lote 6, árvores"`.
  A mesa dos carimbos precisa do Chromium do Playwright: se o da versão do pacote não
  estiver baixado, o `ferramentas/carimbo.ts` usa o `chromium_headless_shell-*` mais novo de
  `%LOCALAPPDATA%/ms-playwright` (nada é instalado). O Atual da sebe, da jardineira e do
  vaso (móveis do Meio-Termo) ainda não é pintado na mesa: a folha diz.
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

# Biblioteca organizada (Habilidades e Itens): notas do protótipo

Protótipo: `docs/design/biblioteca/prototipo.html` (arquivo único, abre direto no navegador).
Pedido do dono em 23/11/2026, literal: "cara é para dar para fazer isso melhor, ta muito mal organizado, faça um prototipo organiziado". Prints de hoje: `tmp/biblioteca/dono-habilidades-hoje.png` e `dono-itens-hoje.png`.

## O que está errado hoje

- Cinco botões de manutenção (Juntar das fichas da pasta, Ligar ao Acervo pelo nome, Juntar as armas, Dar alcance aos antigos, Dar requisitos aos antigos) dividem o topo com a ação principal, todos com o mesmo peso.
- Os cartões são paredes de texto: a descrição cortada no meio da frase, campos crus ("Efeito - Custo -35 de SP Tempo 1 Dano -"), e "Do catálogo" repetido em todos.
- Testar, editar e apagar são só ícones, sem nome.
- A "Ficha que recebe" despeja a ficha inteira (perícias, vantagens...) em vez de ajudar a dar.
- Os filtros misturam dois eixos: "Do livro 121" (de onde veio) ao lado de "Ataque 39" (o que é).
- 171 habilidades em cartões de 3 a 6 linhas: dá para ver 6 por tela.

## As 3 arrumações que pensei

### A. Lista agrupada + cartão de papel ao lado (a escolhida)

```
+------------+------------------------------------+---------------------+
| Fichas     | [Buscar /]  Todas Ataque Apoio ... | (papel rasgado)     |
| Todas  171 |                         [Ordem v]  | A Virtude Traz      |
| Em fichas  | Ataque  33                         | Benção              |
| Só no livro|  * Nome         [Completa][35 SP]  | Apoio Completo: um  |
| ---------- |    frase de uma linha   [mapa] (A) | aliado a até 3 ...  |
| Aira     3 |  * Nome ...                        |---------------------|
| Alexei   4 | Apoio  11                          | [Dar a...] [Testar] |
| ...        |  ...                               | [Editar]            |
| (soltar    | Reação 5 / Passiva 4 / Perícias... | Quem tem: Aira      |
|  aqui dá)  |                                    | Apagar do livro     |
+------------+------------------------------------+---------------------+
```

- A favor: uma linha por coisa (cabem 12 a 14 por tela, contra 6 hoje); a frase gerada em uma linha diz o que faz; os números que mudam de uma para outra (ação, SP, espera, alcance) ficam em fichas alinhadas à direita, fáceis de comparar descendo o olho. O cartão de papel do editor aparece inteiro só para a escolhida. A coluna das fichas é ao mesmo tempo o filtro "quem tem" e o alvo do arrasto, então dar uma coisa vira "arraste para o nome".
- Contra: três colunas pedem tela larga; abaixo de 1280 px a coluna das fichas vira uma lista suspensa e o arrasto some (o "Dar a..." continua).

### B. Tabela agrupada com a frase

```
| Nome                  | O que faz (frase)            | Ação     | SP | Espera | Alcance | Quem tem |
| Ataque (33)                                                                                     |
| CAÇA AS BRUXAS!       | 1 inimigo a até 10 casas...  | Completa | 35 | 4      | [mapa]  | S        |
```

- A favor: ordenar por coluna (clicar em "SP" ordena), comparação perfeita.
- Contra: a frase precisa de espaço e briga com 6 colunas; com o painel de detalhe ao lado não cabe em 1440 px. Perícias, vantagens e itens não têm as mesmas colunas (uma perícia não tem SP), então cada grupo vira uma tabela diferente. Parece planilha, não o livro do mestre.

### C. Quadro por personagem

```
| Só no livro | Aira        | Alexei      | Siegfried   | ...
| [Esquiva]   | [Benção]    | [Armadilhar]| [Caça...]   |
| [Grito]     | [Nuvens]    | [Lobo]      | [Balmung]   |
```

- A favor: dar = arrastar de uma coluna para outra; mostra o kit de cada um.
- Contra: 11 fichas não cabem na largura; uma habilidade em 2 fichas (Resiliente: Siegfried e Vagn) aparece 2 vezes e editar uma parece mudar só uma. Não responde à pergunta mais comum ("onde está a Chuva?"). Perícias e vantagens (121) afogam o quadro.

Ganhou a A. Ela responde as três perguntas do mestre na ordem em que ele as faz: o que existe (lista agrupada), o que isso faz (o papel) e quem tem (a coluna das fichas e o "Quem tem" do papel). E reaproveita o cartão de papel, os desenhos de alcance, os ícones do tipo do golpe e as fichas de custo do editor aprovado, então o mestre vê a mesma coisa no editor e na biblioteca.

## O que mudou, ponto a ponto

| Hoje | No protótipo |
|---|---|
| 5 botões de manutenção no topo | 1 botão "Ferramentas" com o que falta em cada uma ("Dar alcance aos antigos: 19 pendentes"). Ferramenta em dia fica apagada no lugar de sempre. Cada uma abre a lista de propostas na coluna da direita; nada se grava antes do Confirmar, e o aviso tem Desfazer, como hoje |
| Cartão com descrição cortada e campos crus | Linha com a frase gerada em uma linha, ícone do golpe, desenho do alcance e fichas de ação, SP e espera. A descrição do mestre fica inteira no papel, em itálico |
| "Do catálogo" em todos | Some. Só a exceção leva marca: "Do Acervo" (item que mora no Acervo do app) |
| Testar, editar, apagar só ícone | "Dar a...", "Testar" e "Editar" com nome no papel; "Apagar do livro" separado, embaixo, com confirmação que começa no Cancelar |
| "Ficha que recebe" com a ficha inteira | Coluna "Fichas": filtra por quem tem, mostra quantas cada um tem desta página, e recebe o arrasto (durante a pausa diz "Soltar: dar a Aira" ou "Aira já tem") |
| Filtros "Do livro 121" e "Ataque 39" juntos | Um eixo só nos chips, o que a coisa é: Ataque, Apoio, Reação, Passiva, e depois Perícias, Vantagens, Desvantagens (as 121 "Do livro" viraram os três grupos delas). De onde está (em fichas ou só no livro) mora na coluna Fichas |
| 171 em cartões | Grupos com cabeçalho fixo e contagem, que se fecham; ordem por "Como no livro", "Nome", "Mais fichas primeiro" ou "Custo de SP" |

Itens usa o mesmo molde: grupos Armas, Consumíveis, Munição, Outros; a linha mostra dano, ação e alcance da arma; o que vai para a mochila diz "na mochila" em vez de "na ficha".

## Teclado e gestos

- `/` vai para a busca; `Esc` na busca limpa; setas sobem e descem na lista; `Home` e `End` vão às pontas.
- Com uma linha escolhida: `D` abre "Dar a...", `T` testa, `E` edita. No "Dar a..." a última ficha usada já vem marcada, então dar várias coisas à mesma pessoa é `D` e `Enter`.
- Arrastar uma linha até um nome da coluna Fichas dá a coisa; durante a pausa o nome acende e diz o que vai acontecer.
- `Ctrl+Z` desfaz o último dar, tirar, apagar ou Confirmar; o aviso também tem Desfazer. `F8` leva o foco ao aviso.
- Menu Ferramentas e "Dar a...": setas, `Enter`, `Esc` devolve o foco ao botão. Janela de editar: `Esc` fecha, `Tab` não sai dela.

## Movimento

Pouco, de propósito: trocar de linha e filtrar são ações de dezenas de vezes por sessão, então não animam. Animam só os menus (150 ms, ease-out, a partir do botão), as janelas (200 ms), o aviso (entra de baixo em 200 ms, sai em 140 ms) e o destaque de latão de 1,6 s na linha recém-criada ou na ficha que acabou de receber. Com "reduzir movimento", só opacidade.

## O que é de mentira no protótipo

- Nada é salvo; recarregar a página volta tudo.
- Os números de pendentes saem dos dados do protótipo (não do livro real), por isso não batem com os 132 do exemplo do pedido.
- O "Testar" é um teste mínimo (d20 do boneco, reação 10/15/20, Escudo antes do HP), não o Painel de Ensaio do app; na tela real o Testar abre o Painel de Ensaio de hoje.
- "Editar" e "Nova habilidade" abrem o protótipo do editor (`docs/design/habilidades/editor/prototipo.html`); no app abrem o editor novo. Editar item, perícia, vantagem ou desvantagem abre uma janela pequena de mentira (nome e texto) no lugar da janela do item de hoje.
- O livro tem 55 técnicas e 64 entradas de regra aqui (119; o real tem 171) e 27 itens (o real tem 40); as fichas, os nomes, custos e frases vêm das auditorias de 07/11 (`docs/auditoria-fichas/`) e dos prints. Frases de habilidades antigas sem peças foram escritas à mão a partir do texto da ficha.
- Abaixo de 1366 px a coluna Fichas vira a lista "Quem tem" na barra e o arrasto some; entre 1366 e 1500 px a ficha "espera N" sai da linha (continua no papel).

## Onde o dado aparece

- O que se dá aqui aparece na ficha (aba Habilidades, Perícias, Vantagens, Desvantagens, Armas, ou a mochila), na contagem da coluna Fichas e nas bolinhas da linha. No app, também no menu de golpes da batalha, como hoje.
- O alcance e os requisitos dados pelas Ferramentas aparecem na linha (o desenho troca o "?" pelo da forma), no papel e no editor.
- Ainda não aparece: nada da biblioteca na página "Comparar e balancear" (ela tem as próprias contas) e o "Testar" não abre a Arena de testes.

## Decisões para o dono

1. As 121 "Do livro" viraram três grupos no fim da mesma lista (Perícias, Vantagens, Desvantagens), separados por um fio. Ficam na página Habilidades ou ganham página própria ("Regras do livro")?
2. "Dar a..." fica na coluna da direita, para a escolhida. Quer também um "+ Aira" rápido em cada linha quando uma ficha está escolhida na coluna Fichas (para montar o kit de uma pessoa de uma vez)?
3. Ferramenta em dia fica apagada no menu ("em dia"). Ou prefere que ela suma?
4. A ordem padrão é "Como no livro". Prefere "Nome, de A a Z"?

## Prova

`tmp/biblioteca/prova.cjs` abre no Chromium de verdade (1600 x 960 e 1440 x 900), clica, digita e arrasta, e confere 43 coisas: os grupos, a frase do papel, um botão Ferramentas só, nenhum "Do catálogo", `/` e `Esc` na busca, sem resultado, chips, filtro por ficha, Testar no boneco, `D` + `Enter` dando à última ficha, Ctrl+Z, arrastar até Vagn, menu com pendentes e `Esc` devolvendo o foco, Confirmar com Desfazer e pendentes caindo, apagar com foco no Cancelar, página Itens, item só de texto sem Testar, os estados Lendo, Livro vazio e Erro, nada vazando em 1440 px. Resultado: 43/43, maior tarefa longa 94 ms (nenhuma >= 200 ms), nenhum erro no console. Prints: `tmp/biblioteca/1-habilidades.png`, `2-itens.png`, `3-detalhe.png`, `4-ferramentas.png` (e `5-1440.png`).

A primeira versão passava de 200 ms ao abrir (291 ms): o caro era achar as fontes do app no Windows (Sitka, Segoe UI Variable, Bahnschrift) na primeira arrumação da página. A moldura fixa usa as três famílias na 1ª tarefa, o resto entra na 2ª e o fim da lista na 3ª; o desenho do alcance virou uma `path` por cor em vez de 49 quadradinhos.

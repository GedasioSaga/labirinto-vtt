# Conteúdo do baú — redesign com miniaturas

Pedido do mestre (21/11/2026): "meu deus faz um redesign disso ta horrivel coloca uma miniatura."

Protótipo: [conteudo-do-bau.html](conteudo-do-bau.html). Abra direto no navegador. O painel da direita só existe no protótipo: troca a largura da página (240, 262, 320, 400 ou arrastando a borda), o objeto (baú, caixa, barril), o cenário (com coisas, vazio, acervo vazio, já aberto, pior caso) e as imagens (com PNG ou só as iniciais). Tudo à esquerda funciona como funcionaria no app, Ctrl+Z incluído.

Os desenhos dos itens fazem as vezes das PNGs do acervo: o repositório não tem PNG de item (as imagens moram na mídia do mestre, `<appData>/midia`). No app, a vaga mostra a imagem do item pelo `ImagemOuIniciais`, e as iniciais quando o item não tem imagem.

## Decisões (todas do Claude, para o mestre confirmar)

1. **A vaga em toda linha.** Toda linha começa pela mesma moldura afundada de 40 px, a da grade do Acervo e da mochila. Item: a PNG do acervo, ou as iniciais no tom do nome quando não há imagem. Documento: o papel dele (o `IconeDoPapel` que o app já desenha). Moedas, minigame e armadilha ganham desenho próprio: pilha de moedas; cadeado, pé de cabra ou marreta, conforme o objeto; cobra ou aranha.
2. **A quantidade numa pílula − número +.** O número é digitável. Seta para cima ou para baixo muda de 1 em 1, PageUp e PageDown de 10 em 10, e Shift multiplica por 10. Em 1, o − vira a lixeira. Digitar 0 também tira. Tirar mostra a torrada "Bala de Prata saiu do baú." com Desfazer (5 s, pausa com o ponteiro em cima) e também é um passo do Ctrl+Z. O × separado some. Um clique na lixeira até 450 ms depois de ela aparecer é ignorado, porque é o mesmo gesto de diminuir.
3. **A escolha do acervo vira uma grade de miniaturas**, as mesmas peças da grade do Acervo, com 3 colunas de 240 a 262 px e 4 em 320 px. Tem busca sem acento por nome e categoria ("pessego" acha Pêssego) e uma faixa de categorias que rola de lado: "Todos" primeiro e depois só as categorias que têm item. Embaixo fica a prévia da peça marcada, com o nome inteiro, a categoria e quantos já estão dentro. A ordem é a do acervo, a mesma que o mestre vê na aba Acervo.
4. **O teclado da grade é o do seletor de emoji.** O foco fica na busca: ← e → andam uma peça, ↑ e ↓ uma linha, PageUp e PageDown três linhas. Enter põe a peça marcada, que é a primeira por padrão. Esc fecha e devolve o foco ao botão. A troca: ← e → não movem mais o cursor dentro do texto da busca, mas Home, End e o mouse continuam movendo.
5. **A escolha fica aberta depois de pôr.** Hoje ela fecha. A peça ganha o selo ×N com quantos já estão dentro. Enter de novo soma mais um, e o texto da busca fica selecionado, então digitar troca o termo. "Pronto" ou Esc fecha. Com a escolha aberta, o botão "+ Item do acervo" volta para a busca em vez de fechar. A grade não anda na tela quando a linha nova entra acima dela, porque a rolagem é compensada.
6. **Documentos e moedas na mesma lista "Dentro do baú"**, na ordem itens, documentos, moedas. As moedas vêm sempre por último e estão sempre à vista, com "Nenhuma" quando é 0. O documento tem o papel em miniatura e a frase "Documento, chega como novo". A escolha de documentos usa a mesma moldura: lista com o papel e busca. Os que já estão no baú aparecem com o visto, em vez de sumir da lista. Depois de pôr, a marca anda para o próximo documento livre.
7. **Minigame e armadilha descem para a seção "Ao abrir"** ("Ao quebrar" na caixa e no barril), embaixo do conteúdo. Hoje o minigame é a primeira coisa da ficha. O minigame tem a vaga com a ferramenta do objeto, apagada quando está desligado, e o interruptor "Minigame para o jogador" na mesma linha. Os textos da armadilha não mudam (a jornada confere "Padrão da cobra: …").
8. **O vazio é um convite.** Uma linha com a vaga tracejada do objeto: "O baú abre vazio / Ponha itens do acervo ou documentos." Quando só há moedas: "Só moedas / Nenhum item nem documento." O acervo vazio e a biblioteca vazia são explicados dentro da escolha. A busca sem resultado repete o termo e oferece "Limpar a busca", ou "Procurar em todas as categorias" quando o item existe em outra categoria.
9. **Duas arrumações pela largura** (container query no conteúdo). Até ~250 px de miolo, o nome fica sozinho na linha de cima, com a largura toda, e a categoria e a quantidade vão embaixo. Acima disso, tudo cabe numa faixa só. O nome comprido quebra em sílaba com hífen (`hyphens: auto`), nunca no meio da palavra sem hífen, que era o defeito "Consumív el" da auditoria de 16/11.
10. **Movimento só onde responde a uma ação:**
    - a linha que recebeu o item acende em latão e apaga (opacidade de uma camada, 700 ms);
    - o selo ×N dá um passo de escala (140 ms);
    - a linha que sai vai para a direita (120 ms), e as de baixo sobem por FLIP (`transform`, 180 ms);
    - a torrada entra em 200 ms e sai em 140 ms.

    A escolha abre e fecha na hora, porque é de teclado e usada muitas vezes. Com movimento reduzido, fica só a cor.
11. **Limites com o porquê na tela.** Com 40 tipos de item, as peças novas ficam apagadas e a prévia diz "Já tem 40 tipos de item, o máximo. Dá para somar nos que já estão." A partir de 35 tipos, a contagem vira "N de 40 tipos". Com 10 documentos, "+ Documento" fica desabilitado, com a frase logo embaixo.

## O que foi medido (Chromium sem janela 1243, pelo Playwright do repo; não foi no WebView2 do app)

| Prova | Resultado |
| --- | --- |
| Jornada do baú (passo 1 de `e2e/task-jornada-bau.spec.ts`, com os mesmos seletores): "+ Item do acervo", busca focada no diálogo "Itens do acervo", Enter põe, mais um item, Cobra | passa: 2 itens, 1 linha cada, busca focada nas duas vezes, Cobra marcada e o texto do padrão à vista |
| Travada filtrando, trocando categoria, setas, 12 Enter, 6 cliques, 4 "+" (acervo de 18) | quadro p95 16,7 ms, pior 16,8 ms, nenhuma tarefa longa |
| Mesma coisa no acervo de 150 itens (pior caso) | quadro p95 16,8 ms, pior 33,4 ms (um quadro), nenhuma tarefa longa (nem de 50 ms) |
| A escolha anda quando um item novo entra acima? (240 px, 3 Enter) | 0, 0 e 0 px |
| Algo passa da borda em 240, 262 e 320 px, nos cenários com coisas, pior caso, vazio e já aberto, com a escolha aberta e fechada | nada (miolo de 189, 211 e 269 px) |
| Tirar com 0 e Desfazer | a linha sai e volta com 12 |
| Erros no console | nenhum |

As 4 fotos de layout (240 com a escolha, 320 já aberto com busca, 240 no pior caso, 262 vazio com documentos) ficaram no scratchpad da sessão, fora do repositório.

## Plano de implementação

Peça única, um escritor. A interface é do `designer-opus`.

1. `client/src/components/livro/ConteudoDoObjetoFicha.tsx` — reorganizar em `SecaoDentro` (lista, botões e escolha), `LinhaDoItem` (`ImagemOuIniciais` na vaga), `PassoDaQuantidade` (lixeira em 1, 0 tira), `LinhaDoDocumento` (`IconeDoPapel`), `LinhaDasMoedas` e `SecaoAoAbrir` (o `Toggle` e a armadilha de hoje). O arquivo passa de 360 linhas, então a escolha sai para arquivos próprios:
   - `client/src/components/livro/conteudo/EscolhaDoAcervo.tsx` — grade, categorias, prévia e teclado;
   - `client/src/components/livro/conteudo/EscolhaDeDocumentoDoBau.tsx` — a lista com o papel.
2. `client/src/components/livro/conteudoDoObjeto.css` — trocar pelo CSS do protótipo, renomeando `cb-` para `lb-conteudo__`. Ele já usa só `--lb-*` de `theme.ts`.
3. `client/src/lib/` — duas funções puras, testáveis:
   - `moverNaGrade(indice, passo, total, colunas)`;
   - a busca sem acento. Antes de escrever, procurar se já existe uma no app (a do Acervo).
4. Desenhos novos (moedas, cadeado, pé de cabra, marreta, cobra, aranha, baú, caixa, barril) — `client/src/components/livro/conteudo/DesenhosDoConteudo.tsx`, SVG como o `IconeDoPapel`. Antes de desenhar, ver se a arte da armadilha ou das moedas já existe no Pixi ou na mochila, para reaproveitar.
5. Reaproveitar sem mudar:
   - `ImagemOuIniciais` (`components/FichaPecas.tsx`);
   - `IconeDoPapel` (`components/documentos/IconeDoPapel.tsx`);
   - `Toggle`;
   - `useToastStore` (a torrada já aceita `actions`, para o Desfazer);
   - `useBibliotecaDeDocumentos`;
   - `itemParaDar` e as regras de `lib/conteudoDoObjeto.ts` (os dados não mudam).
6. A jornada `e2e/task-jornada-bau.spec.ts` não pode ser editada e precisa continuar passando. Para isso, ficam como estão:
   - o texto "+ Item do acervo";
   - o diálogo "Itens do acervo";
   - a busca "Procurar no acervo", focada ao abrir;
   - `.lb-conteudo__achado` na peça e `.lb-conteudo__item` na linha;
   - o Enter que põe a primeira peça;
   - o radiogroup "Armadilha" com o rádio "Cobra";
   - o texto do padrão da cobra.

   A escolha ficar aberta só passa porque o botão volta para a busca com o texto selecionado; isso foi conferido no protótipo com os mesmos seletores.
7. Pronto = `rtk proxy npx tsc --noEmit` sem erro e a jornada do baú passando, mais a olhada no app (WebView2) em 262 e 320 px.

## Dado entre telas (fora deste pedido)

- O cartão "Abriu!" do jogador (`client/src/minigames/abrir/tela/JogoDeAbrirOverlay.tsx`) lista "Nome×N" sem imagem.
- A página Jogos, "Baús, caixas e barris" (`client/src/components/livro/ObjetosQueAbrem.tsx`), também mostra os itens sem imagem.

As duas telas poderiam ganhar a mesma vaga com miniatura, mas isso fica para o mestre decidir se quer.
- A escolha de documento dos puzzles (`EscolhaDeDocumento`, um `select` nativo) continua como está; só o baú passa para a lista com o papel. Se o mestre quiser as duas iguais, é outra peça.

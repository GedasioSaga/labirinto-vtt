# Protótipo de Itens e Habilidades: notas para aprovar

Arquivo: `docs/design/habilidades/prototipo.html` (abre direto no navegador, sem servidor). A barra pontilhada no
topo é só do protótipo: troca entre as 5 telas e tem "Recomeçar". Os números são de exemplo e nada é salvo.

Base: `SISTEMA.md` (decisões M1 a M4 do mestre e C1 a C24 do Claude). As decisões abaixo são de interface, tomadas
pelo Claude em 21/11/2026 para o mestre aprovar ou trocar. Nenhuma muda uma decisão do SISTEMA, exceto a D4, que
está marcada.

## As 5 telas

1. **Biblioteca**: o livro de regras com os marcadores "Itens" e "Habilidades" separados.
2. **Ficha: habilidade**: a ficha de Aira com o cartão "Corte que sangra" sendo montado no editor novo.
3. **Item do Acervo**: a janela do item (Granada) com "O que ele faz", a prévia na mochila e o Testar.
4. **Reação na batalha**: a caixa REAÇÃO de quem leva o golpe, com as técnicas de reação no lugar do d20.
5. **Livro de 262 px**: o Acervo na página estreita do livro do mestre, com o Testar abrindo por cima.

## Decisões de interface (do Claude)

1. **Dois marcadores no lugar de um.** "Itens e habilidades 192" vira "Itens 118" e "Habilidades 74". A divisão
   118 + 74 é inventada para o protótipo; no app sai da contagem real. Os outros marcadores aparecem apagados com o
   motivo "Fica como hoje".
2. **Uma frase de objetivo no topo de cada página**, a da seção 7 do SISTEMA, palavra por palavra (C11).
3. **O cartão da biblioteca mostra o que faz em até 3 frases coloridas** (vermelho dano, verde cura, roxo condição,
   azul custo), com Testar, Editar e "Pôr em [ficha]". Item sem efeito mostra "Dar um efeito"; o Kit Médico mostra
   "Sugerir efeito" e abre já no modelo Bandagem.
4. **Reação vem logo depois de Ataque**, nos filtros da biblioteca e nos modelos do editor. A seção 7 lista Reação
   em quarto. Troquei porque o mestre disse que não via a técnica de reação para fazer. *Esta é a única que muda
   algo do SISTEMA.*
5. **O Testar abre no lugar da coluna de contexto, nunca por cima do editor.** Na ficha, ocupa a coluna do
   personagem; no item, a coluna da prévia; na biblioteca, a coluna "Ficha que recebe"; na página de 262 px, desliza
   por cima da página e o Voltar devolve a lista. Fechar (ou Esc) devolve a coluna. Assim dá para mexer no número e
   ver o resultado lado a lado.
6. **Um botão só para testar.** O boneco se arruma sozinho para mostrar o efeito: começa caído para Reviver, ferido
   para Cura, com Envenenado e Sangrando para Antídoto e Purificar, e vira 3 bonecos para área. Uma linha dourada diz
   o que foi arrumado. O resto fica dobrado em "Ajustar o boneco e a cópia".
7. **O teste acompanha o editor ao vivo e com o mesmo dado.** Mexeu num número, o passo a passo refaz na hora com o
   mesmo d20. Só "Testar de novo" rola outro dado. Assim a diferença vista é a do número mexido, não a da sorte.
8. **O passo a passo é numerado e cada passo diz a conta**: custo (SP 120 → 90), alvo, fórmula com os números da
   ficha, a reação do boneco com o d20, o dano no Escudo e no HP, a condição, e "Depois" (recarga, turnos). Passo que
   recusa (sem SP, alvo de pé para Reviver, pilha vazia, técnica que não vale contra Overload) vem em vermelho com um
   botão que conserta ("Encher o SP da cópia", "Deixar o boneco caído", "Pôr 3 na pilha").
9. **O boneco aparece em cima dos passos, com a barra indo do antes ao depois** e o texto "HP 500 → 422". O
   resultado se lê sem rolar; os passos explicam.
10. **Técnica de reação no teste**: o boneco bate (dano e tipo de golpe ajustáveis) e a ficha reage com a técnica.
    Técnica que serve na vez e na reação ganha "Testar: Na vez | Na reação".
11. **"Passar 1 vez do alvo"** mostra o que acontece no turno seguinte (Sangrando tira 10, a condição conta para
    baixo), sem mexer no resultado.
12. **O editor tem 3 degraus (C14).** Primeiro os modelos em grupos; depois "Os números" em frases com os campos
    dentro ("Dá [fórmula] de dano em [1 inimigo]"); o resto fica em "Avançado", um bloco por peça, dobrado. O resumo
    "Como fica" fica em cima com o botão Testar.
13. **O modelo aproveita o cartão (C15)** e diz isso na tela: "O modelo aproveita o que o cartão já diz: Dano ... e
    Custo ...". O texto antigo do cartão fica dobrado em "Texto antigo (só descrição)" (C16).
14. **"+ Efeito" é um menu com 10 tipos.** O que não cabe fica apagado com o motivo escrito ("já tem dano", "teto de
    8 efeitos", "precisa de dano"). Tirar um efeito mostra o aviso com Desfazer (C23).
15. **Erro em frase de conserto, colado no campo**: fórmula que o app não conhece, número fora do teto, nome vazio ao
    salvar. A ficha só salva com nome.
16. **O item usa o mesmo editor, com "Gasta" e "Onde usa"** no lugar de custo, e os 25 modelos agrupados como em FF e
    RE (Cura, Reviver, Condição, Arremesso, Reforço, Fora da batalha) mais "Sem efeito". Cargas aparecem como dica
    "fase 9" e não como campo (C20).
17. **A prévia do item mostra as duas caras**: o cartão da página Itens e a vaga na mochila do jogador, com a frase
    que o jogador recebe (C8), e quem já tem o item.
18. **A caixa REAÇÃO ganhou uma segunda metade**: "Ou, antes do dado, use uma técnica no lugar da reação", com as
    técnicas da ficha em cartões (custo, o que faz com o dano deste golpe). Técnica que não pode aparece apagada com o
    motivo: Atordoada, já rolou o d20, uma por golpe, em recarga, não vale contra Overload ou Surpresa, SP
    insuficiente (C5).
19. **O resultado da reação aparece na própria caixa**, com a linha que vai para o registro da batalha e Desfazer.
20. **Área pega aliado também (C21)** e o teste diz isso no passo do alvo.
21. **Movimento**: só onde explica uma mudança. O teste entra deslizando 8 px (220 ms) só ao abrir; os passos aparecem
    em cascata de 30 ms (até o 8º); a barra de vida anda 260 ms; o d20 gira 240 ms só ao rolar. Pelo teclado e ao
    redesenhar por causa de um número, nada anima. Com "reduzir movimento" no sistema, sobra só o esmaecer.
22. **Teclado**: Esc fecha a camada de cima (menu, teste, janela), "/" vai para a busca, setas trocam de marcador e
    andam no menu "+ Efeito", e o Tab dá a volta dentro da janela.

## Tela e fase do SISTEMA

| Tela do protótipo | Fase |
|---|---|
| Biblioteca em duas páginas, frases do topo, filtros, "Pôr em" com a mecânica | Fase 1 |
| (sem tela) peças versão 2 que o editor e o teste usam | Fase 2 |
| Testar: boneco, miniaba, passo a passo, ajustes, "Passar 1 vez" | Fase 3 |
| "Quando usa" no editor, modelos H18 a H21, a caixa REAÇÃO com técnicas, o teste da reação | Fase 4 |
| Editor em 3 degraus, modelos H01 a H17 e H22, "+ Efeito" (cura de SP e de Escudo, tirar condição, vários selos) | Fase 5 |
| Área num ponto e em volta, alcance, Reviver, dreno | Fase 6 |
| Janela do item com "O que ele faz", 25 modelos, prévia da mochila | Fase 7 |
| "Usar item" na batalha: só citado na prévia do item, sem tela | Fase 8 |
| Cargas: só a dica "fase 9" na linha do item | Fase 9 |
| Consertos da Fase 0 | fora do protótipo |

## O que ficou de fora

- "Usar item" na batalha (Fase 8): não desenhado, conforme M3 ("quando tudo tiver pronto").
- "Juntar das fichas da pasta" e "Ligar ao Acervo pelo nome" aparecem apagados com o motivo "Fica como hoje".
- As abas da ficha além de Técnicas e os outros marcadores do livro ficam apagados.
- Os números do teste saem de um motor de mentira no protótipo; no app saem do motor da batalha (C12).

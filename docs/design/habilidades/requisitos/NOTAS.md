# Protótipo: Requisitos

Arquivo: `prototipo.html` (um arquivo só; abre no navegador, sem internet). Feito em 23/11/2026 para o dono aprovar antes de construir no app. Nada é salvo: "Recomeçar esta tela" volta ao começo.

Os números são os das fichas (auditorias de `docs/auditoria-fichas/`). O visual é o do menu de batalha do app (tiras rasgadas, papel de leitura, registro).

## As 7 telas (botões no topo)

1. **Editor.** Dentro da técnica, na ficha. "Valem para": Usar ou Evoluir (e "vira SUPER… até usar uma vez"). Grupos "Todos estes" / "Um destes", ligados por "e também". "+ Requisito" abre a busca com os 49 tipos (A–J), com pulo por letra, setas e Esc; busca sem achado oferece "Pôr como personalizado". Cada tipo tem os seus campos (N, %, técnica, selo, forma, item, aliado, atributo + CD), "e gasta" e "não ter" onde cabem, e o selo de quem confere (Auto, Pergunta, Rola d20, Cumpriu?). Embaixo, a frase em palavras e o "Falta: …" que o menu mostraria com a ficha de agora. Mudar o editor muda as telas de batalha.
2. **Sieg: evolução.** CAÇA AS BRUXAS! com a tira "↳ SUPER CAÇA AS BRUXAS!" cinza ("Falta: Melodia… ligada; Caminho do Dano ligado"). Ligue a Melodia e o Caminho na mesa; evolua gastando 50 SP ou pedindo ajuda ao Vagn (fogo). A SUPER entra no lugar com um brilho; usar perde metade dos status e a CAÇA comum volta, sem poder evoluir de novo. Os 4 momentos têm botão de pulo.
3. **Vagn: Polaridade.** Chuva cinza com "Falta: polaridade 2 (tem 1); campo de contenção 1 (tem 0)" e o medidor Polaridade 1/3. Carregar Polaridade gasta a reação; a Chuva gasta 2 de Polaridade.
4. **Ryoko: Partes.** Indicador da Forma Híbrida (Parte 1/2/3) e o custo de manter; Fúria do Dragão sobe uma Parte e fica cinza na Parte 3.
5. **Pedido ao aliado.** Duas telas lado a lado: o Vagn pede 30 SP; na tela do aliado chega "VAGN PEDE 30 SP" com Aceitar/Recusar. Mostra esperando, recusado (pede a outro) e o NPC, em que a caixa vai para a tela do mestre.
6. **Cumpriu?** A caixa "Cumpri: o alvo carrega metal…", o Usar só libera marcada, o registro mostra "(declarou: …)" e o mestre pode Desfazer (o SP volta).
7. **Teste do Vincent.** Desenhar o Alvo: um destes, Percepção CD 15 (não perde a ação) ou gastar 30 SP. O d20 é uma sequência fixa (9, 17, 4…): a primeira rolagem falha e oferece os 30 SP.

"Ver como: Mestre" mostra o "Usar mesmo assim" nas técnicas cinza; o registro anota "O mestre liberou sem os requisitos".

## Decisões de interface (do Claude)

- A tira cinza continua clicável: abre a leitura com a lista do que cumpre (✓), do que falta (✗) e do que só se sabe na hora (relógio).
- A evolução aparece como uma tira menor logo abaixo da técnica comum ("↳ SUPER…", botão Evoluir), e não como um botão escondido na leitura.
- "Um destes" com mais de um caminho possível vira escolha na hora de usar; o padrão é o primeiro que dá.
- No pedido de SP, os 30 SP **passam** do aliado para quem pede (o aliado fica com 110 de 140). Ver as perguntas abaixo.
- Recusou: quem pede vê a mensagem e pode pedir a outro aliado ou escolher o outro caminho do "um destes".
- Requisito com "e gasta" soma no custo mostrado antes de usar (Desenhar o Alvo pelo caminho do SP: "Gasta 60 SP", 30 do custo e 30 do requisito).
- Subir a forma (Fúria) é efeito, não custo: aparece numa frase à parte.
- Movimento: só onde ajuda a entender. A linha nova entra (180 ms), a busca abre do botão (150 ms), a caixa do pedido e a do Cumpriu? entram (200 ms), o medidor enche (220 ms). O único movimento longo é o brilho da evolução (cerca de 450 ms), porque acontece uma vez por batalha. Com "reduzir movimento" ligado, tudo vira só aparecer.

## O que é de mentira

- A mesa do protótipo (os interruptores, os botões −/+ e "Ir para o momento") não existe no app.
- O "Marujo do bando" (NPC aliado) foi inventado para mostrar o caso do NPC.
- Armadura Humana com "pedir 30 SP" é só exemplo: a ficha não pede isso.
- O d20 é fixo; o app rola de verdade.
- O protótipo confere de verdade só A1, A4, A7, B1, B3, I1, G1, G2, H1 e J1. Os outros tipos entram no editor e na frase, e na batalha contam como cumpridos ("o protótipo não confere este tipo").
- A mira, o mapa e a rede ficaram de fora.

## Perguntas para o dono

1. No pedido de SP ao aliado: o SP **passa** para quem pede (como está aqui) ou o aliado só **paga** a técnica no lugar dele?
2. A lista tem **49** tipos (A1–J2); o commit e o plano falam em 46. Vale a lista do arquivo?

## Prova

Aberto no Chromium (Playwright, 1440x900): 40 conferências passaram, nenhuma tarefa longa de 200 ms ou mais (a maior teve ~75 ms), nenhum erro no console, nenhum pedido de rede. Os prints ficam em `tmp/requisitos-prototipo/` (fora do git).

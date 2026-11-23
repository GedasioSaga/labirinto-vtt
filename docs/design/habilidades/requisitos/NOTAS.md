# Protótipo: Requisitos

Arquivo: `prototipo.html` (um arquivo só; abre no navegador, sem internet). Feito em 23/11/2026 para o dono aprovar antes de construir no app. Nada é salvo: "Recomeçar esta tela" volta ao começo.

Os números são os das fichas (auditorias de `docs/auditoria-fichas/`). O visual é o do menu de batalha do app (tiras rasgadas, papel de leitura, registro).

## As 8 telas (botões no topo)

1. **Editor.** Dentro da técnica, na ficha. "Valem para": Usar ou Evoluir (e "vira SUPER… até usar uma vez"). Grupos "Todos estes" / "Um destes", ligados por "e também". "+ Requisito" abre a busca com os 49 tipos (A–J), com pulo por letra, setas e Esc; busca sem achado oferece "Pôr como personalizado". Cada tipo tem os seus campos (N, %, técnica, selo, forma, item, aliado, atributo + CD), "e gasta" e "não ter" onde cabem, e o selo de quem confere (Auto, Pergunta, Rola d20, Cumpriu?). Embaixo, a frase em palavras e o "Falta: …" que o menu mostraria com a ficha de agora. Mudar o editor muda as telas de batalha.
2. **Sieg: evolução.** CAÇA AS BRUXAS! com a tira "↳ SUPER CAÇA AS BRUXAS!" cinza ("Falta: Melodia… ligada; Caminho do Dano ligado"). Ligue a Melodia e o Caminho na mesa; evolua gastando 50 SP ou pedindo ajuda ao Vagn (fogo). A SUPER entra no lugar com um brilho; usar perde metade dos status e a CAÇA comum volta, sem poder evoluir de novo. Os 4 momentos têm botão de pulo.
3. **Vagn: Polaridade.** Agora a Polaridade é um acumulador feito na tela 8, não uma regra só do Vagn. O topo do menu mostra "POLARIDADE 1/3"; a tira "Carregar Polaridade" nasce sozinha da regra "sobe ao gastar a reação" e mostra "+1 Polaridade"; cada nível soma +10 de dano nos golpes (Atacar 50 + 10 = 60). A Chuva fica cinza com "Falta: polaridade 2 (tem 1); campo de contenção 1 (tem 0)" e gasta 2 de Polaridade.
4. **Ryoko: Partes.** Indicador da Forma Híbrida (Parte 1/2/3) e o custo de manter; Fúria do Dragão sobe uma Parte e fica cinza na Parte 3. Também mostra o segundo acumulador, a Fúria (ver tela 8): "FÚRIA 0/5" no topo, "+1 Fúria" no Golpe de Chifres, e cada nível soma +5 de Força no dano.
5. **Pedido ao aliado.** Duas telas lado a lado: o Vagn pede que um aliado pague os 25 SP da Armadura Humana; na tela do aliado chega "VAGN PEDE 25 SP" com "Você paga a Armadura Humana do Vagn… O SP não vai para o Vagn, só paga a técnica." e Aceitar/Recusar. Mostra esperando, recusado (pede a outro) e o NPC, em que a caixa vai para a tela do mestre.
6. **Cumpriu?** A caixa "Cumpri: o alvo carrega metal…", o Usar só libera marcada, o registro mostra "(declarou: …)" e o mestre pode Desfazer (o SP volta).
7. **Teste do Vincent.** Desenhar o Alvo: um destes, Percepção CD 15 (não perde a ação) ou gastar 30 SP. O d20 é uma sequência fixa (9, 17, 4…): a primeira rolagem falha e oferece os 30 SP.
8. **Acumulador.** O medidor que qualquer ficha cria (Polaridade, Fúria, Cargas, Almas…). À esquerda, a lista dos acumuladores de todas as fichas e "+ Acumulador" para criar um novo na ficha escolhida. No meio, a configuração:
   - **o medidor:** nome, até que nível vai, com quanto começa a batalha;
   - **como sobe:** quantas regras quiser, cada uma com quanto soma (gastar a reação, acertar um golpe, levar um golpe, usar a técnica X, começar a vez, derrubar alguém, esquivar, a cada N SP gastos);
   - **como desce:** as técnicas com "e gasta" tiram o que gastam (sempre), zera no fim da batalha, cai N por rodada sem subir, cai N ao levar um golpe;
   - **o que cada nível dá:** +N de dano por nível, +N num atributo por nível, ou nada (só libera);
   - **técnicas que usam:** quais somam, quais pedem (A4) e quais gastam, com link para abrir no editor.

   À direita, um teste em tinta que imita a batalha: botões dos eventos, o medidor e o registro ("Levou um golpe: Fúria 0 → 1."). Vêm prontos dois: a **Polaridade** do Vagn, refeita no editor genérico, e a **Fúria** da Ryoko, que sobe ao levar golpe e ao usar Golpe de Chifres e cai 1 por rodada sem subir. Trocar o nome ou o bônus aqui muda na hora o A4 da Chuva, o topo do menu e o dano da tela 3. A ficha que ganha um acumulador novo ganha também os botões dele na mesa da sua tela.

"Ver como: Mestre" mostra o "Usar mesmo assim" nas técnicas cinza; o registro anota "O mestre liberou sem os requisitos".

## Decisões

Do dono:
- O acumulador é genérico: qualquer ficha cria o seu; nada de regra só do Vagn (23/11).

Do Claude, seguindo a recomendação dele, passadas pelo coordenador em 23/11:
- **No pedido ao aliado, o aliado só paga o custo da técnica.** O SP sai dele e cobre a técnica; nada entra na conta de quem pede. O Vagn fica com os mesmos 120 SP e o Marujo vai de 80 para 55. Por isso o tipo G1 virou "Um aliado paga SP, HP ou Escudo" e o exemplo da Armadura pede 25 SP (o custo dela), não mais 30.
- A Fúria da Ryoko é um exemplo inventado (não está na ficha; o nome veio do pedido do coordenador), só para provar que o acumulador serve para qualquer um.

Do Claude, de interface:
- A Polaridade **zera no fim da batalha** (a ficha não diz; dá para desligar na tela 8).
- A regra "sobe ao gastar a reação" cria sozinha a ação "Carregar <nome>" no menu; as outras regras sobem pelos eventos da batalha.
- Os acumuladores entram no A4 com o nome; trocar o nome na tela 8 atualiza os requisitos que apontam para ele.
- A tira cinza continua clicável: abre a leitura com a lista do que cumpre (✓), do que falta (✗) e do que só se sabe na hora (relógio).
- A evolução aparece como uma tira menor logo abaixo da técnica comum ("↳ SUPER…", botão Evoluir), e não como um botão escondido na leitura.
- "Um destes" com mais de um caminho possível vira escolha na hora de usar; o padrão é o primeiro que dá.
- Recusou: quem pede vê a mensagem e pode pedir a outro aliado ou escolher o outro caminho do "um destes".
- Requisito com "e gasta" soma no custo mostrado antes de usar (Desenhar o Alvo pelo caminho do SP: "Gasta 60 SP", 30 do custo e 30 do requisito).
- Subir a forma (Fúria do Dragão) e somar num acumulador ("+1 Polaridade") são efeitos, não custo: aparecem numa frase à parte e num selo dourado na tira.
- Movimento: só onde ajuda a entender. A linha nova entra (180 ms), a busca abre do botão (150 ms), a caixa do pedido e a do Cumpriu? entram (200 ms), o medidor enche (220 ms). O único movimento longo é o brilho da evolução (cerca de 450 ms), porque acontece uma vez por batalha. Com "reduzir movimento" ligado, tudo vira só aparecer.

## O que é de mentira

- A mesa do protótipo (os interruptores, os botões −/+, os eventos "Levou um golpe", "Nova rodada" etc. e "Ir para o momento") não existe no app; lá esses eventos vêm da batalha de verdade.
- O teste em tinta da tela 8 também é só do protótipo.
- O "Marujo do bando" (NPC aliado) foi inventado para mostrar o caso do NPC.
- Armadura Humana com "um aliado paga 25 SP" é só exemplo: a ficha não pede isso.
- A Fúria da Ryoko foi inventada (ver Decisões).
- O d20 é fixo; o app rola de verdade.
- O protótipo confere de verdade só A1, A4, A7, B1, B3, I1, G1, G2, H1 e J1. Os outros tipos entram no editor e na frase, e na batalha contam como cumpridos ("o protótipo não confere este tipo").
- A mira, o mapa e a rede ficaram de fora.

## Perguntas para o dono

1. A lista tem **49** tipos (A1–J2); o commit e o plano falam em 46. Vale a lista do arquivo?
2. A Polaridade zera no fim da batalha (escolha do Claude)? Ou fica de uma batalha para a outra?

## Prova

Aberto no Chromium (Playwright, 1440x900): 58 conferências passaram, nenhum erro no console, nenhum pedido de rede. Entre elas: a Polaridade refeita no editor sobe até 3/3 e zera no fim da batalha; trocar o nome para "Carga Elétrica" muda o topo do menu, a tira Carregar e o A4 da Chuva; a Fúria sobe ao levar golpe, não cai na rodada em que subiu e cai 1 na seguinte; um "Almas" criado do zero na ficha do Vincent aparece no topo, na mesa e na lista do A4; no pedido, o Vagn fica com 120 SP e o Marujo vai de 80 para 55. Nenhuma tarefa longa de 200 ms ou mais: nas últimas rodadas a maior foi de 73 a 178 ms, sempre ao abrir a página; cada tela redesenha em menos de 1 ms. Os prints ficam em `tmp/requisitos-prototipo/` (fora do git).

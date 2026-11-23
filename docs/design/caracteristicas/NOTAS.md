# Características especiais (Companion e Cegueira): notas do protótipo

Protótipo: `docs/design/caracteristicas/prototipo.html` (arquivo único, abre direto no navegador; teclas 1 a 5 trocam de estado, "Recomeçar" volta tudo).
Pedido do dono em 23/11/2026, 19h19 a 19h32 (PEDIDOS.md, "características especiais na ficha"). Print da ficha real: `tmp/biblioteca/dono-ficha-aira.png`.

## O que já estava decidido pelo dono (implementado como veio)

- Bloco "Características especiais" na coluna da esquerda, abaixo dos atributos, com chips; "+ Característica" só para o mestre.
- Companion genérico: qualquer NPC ou invocação do livro. Vez própria na ordem, do lado do dono; quem joga é o jogador dono; ao começar a batalha o dono escolhe quem entra, até o limite (Aira: 3). Cada companion tem ficha, vida e nível próprios, e luta no campo ou dá efeito.
- Cegueira: o raio de visão cai pela metade. Entre a metade e o raio normal, só uma onda no chão, sem rosto e sem nome. A parede não para a onda. Visual próprio (a referência de jogo é só a ideia de sentir pelo tremor).

## Os 5 estados

1. **Bloco na ficha.** A ficha da Aira como no app (tags, retrato, HP/SP/Escudo, atributos). Embaixo dos atributos, "Características especiais" com os chips `Companion · Lovecats (3)` e `Cegueira`, e o chip tracejado "+ Característica" (só o mestre; em "Ver como: Jogador" ele some). O "+" abre um menu com Companion e Cegueira; a Cegueira aparece travada com o motivo ("A Aira já tem Cegueira."). Clicar num chip abre a página dele no lugar das abas; `Esc` volta.
2. **Ligar companions.** A página do Companion: nome do grupo, "Leva para a batalha até" (− 3 +), e a lista das fichas ligadas. Começa vazia, com o convite. "Ligar ficha" abre a busca no livro (NPCs e Invocações, com "Marcar todas" de estado misto); cada linha ligada mostra nível com "Evoluir", "Luta no campo / Dá efeito" e o X para tirar. A invocação de outro tipo entra por um segundo Companion ("+ Característica" › Companion › "Raposa de Nuvem", até 1), já marcada "Dá efeito" com o texto do efeito.
3. **Escolha ao começar a batalha** (tela de quem joga a Aira). "Quem vai com a Aira?", um bloco por grupo com "N de 3". Chegou ao limite, as outras travam com "Já são 3. Desmarque um para trocar."; quem está com HP 0 trava com "Desmaiada: cure antes de levar". "Entrar com 4" (`Enter`) ou "Entrar sozinha". O padrão é a última escolha; na primeira vez, as primeiras do grupo que estão de pé.
4. **Vez do companion.** A mesa da batalha aprovada (mapa + ordem à direita). Os companions entram colados na Aira, com um "A" de latão no token e na ordem ("Companion de Aira · você joga"). "Passar a vez" leva a vez à Mimi: o cartão VEZ mostra os golpes dela (Arranhão, Ronronar), o alvo e "Lançar Arranhão em Urso Pardo 1" (`Enter`); o mapa diz "Vez de Mimi, companion da Aira. Você joga por ela." Na vez da Raposa de Nuvem (dá efeito), o botão é "Usar Névoa da Raposa" e os aliados ganham o selo "+10% ESP". Vez de inimigo: "O mestre está jogando esta vez" (com "Simular a vez do mestre", só no protótipo).
5. **Cegueira no mapa.** Um mapa com paredes. **Mestre:** vê tudo; círculo cheio de latão = até onde a Aira vê (3 casas, recortado pelas paredes), tracejado = até onde sente (6); névoa leve fora da visão; a lista ao lado diz de cada ficha "vê", "sente" ou "fora", com a distância e "atrás da parede". O interruptor "Cegueira" desliga para comparar com a visão normal. **Jogador (Aira cega):** só o chão aceso até onde vê, a Mimi com nome, e três ondas sem nome (uma delas atrás da parede, outra a 2 casas mas atrás da parede). Arrastar qualquer ficha (mestre) ou a Aira (jogador) mostra na pausa antes de soltar o que vai acontecer ("Solta aqui: a Aira sente (onda), mesmo atrás da parede").

## A onda

Três anéis de cor de pergaminho (`--onda`, não é latão: latão já é "vez" e "escolhido") nascem no chão onde a ficha está e se abrem até 2,6 casas; um miolo fraco e parado marca o lugar. Cada anel vive 2,1 s, sai um a cada 700 ms, e cada ficha tem a sua fase, para as ondas não pulsarem em coro. Abre em linha reta: a primeira versão usava ease-out e o gráfico (`provas/onda-amostras.csv`) mostrou o anel parado na borda, meio aceso, por quase 1 s, que lia como um círculo desenhado e não como uma onda. Só `transform` e `opacity`, em CSS (roda no compositor). Quando alguém passa a ser sentido, a onda entra em 150 ms; quando deixa de ser, some na hora. Movimento reduzido: três anéis parados (0,4 / 0,7 / 1).

## Teclado e gestos

- `1` a `5` trocam de estado; setas na barra de estados também. `Ctrl+Z` desfaz o último ligar, tirar, evoluir, criar ou tirar característica; o aviso tem "Desfazer" e some arrastado para o lado; `F8` leva o foco aos avisos.
- Página da característica: `Esc` volta às abas, com o foco no chip. Menu "+ Característica": setas, `Home`/`End`, `Enter`, `Esc` devolve o foco ao botão.
- Diálogo "Ligar fichas": foco na busca, `Tab` não sai dele, `Esc` fecha e devolve o foco, `Enter` na busca ou numa caixa liga as marcadas. "Tirar característica" abre a confirmação com o foco em Cancelar e o fundo não fecha.
- Rádios ("Luta no campo / Dá efeito", golpe, alvo): setas trocam.
- Estado 3: `Espaço` marca, `Enter` entra. Estado 4: `Enter` lança ou usa o efeito.
- Estado 5: arrastar ficha; com uma ficha em foco, setas andam uma casa; `Esc` no meio do arrasto devolve a ficha ao lugar.
- Menu, diálogo e troca de vez abertos pelo teclado não animam.

## Onde o dado aparece

- O que se liga no estado 2 aparece no chip da ficha, na escolha do estado 3, na ordem e no mapa do estado 4. O nível e a vida andam juntos: a Mimi evoluída para o nível 3 entra com 140 de HP, e o dano que um companion leva na batalha fica na ficha dele.
- Ainda não aparece (é para o plano): a ficha do NPC ligado não diz "Companion de Aira"; o site do Lobby e a Arena de testes não sabem de companion; o "Comparar e balancear" não puxa os companions como aliados; a lista "Iniciar batalha" do mestre não mostra o "Aira escolhendo…".

## Decisões que tomei sozinho (precisam do dono)

1. **Grupos.** Cada Companion é um grupo com nome e limite próprios, e a ficha pode ter mais de um (Lovecats até 3, Raposa de Nuvem até 1). A outra saída é um Companion só, com um limite para tudo junto. Recomendo grupos: o "até 3" do pedido de 07/11 é de Lovecats, e quem quiser um limite só põe tudo num grupo.
2. **O "(3)" do chip é quanto leva para a batalha**, não quantas fichas estão ligadas (essas aparecem na página e no leitor de tela). Recomendo manter.
3. **Quem "dá efeito" também tem vez própria** e usa o efeito nela; o efeito dura até a próxima vez dele. A outra saída é efeito passivo, sem vez. Recomendo vez própria, que segue a resposta "Vez própria na ordem".
4. **Cegueira e parede perto.** Quem está dentro da metade do raio mas atrás de parede também vira onda (o Soldado a 2 casas, no estado 5), e não só a faixa entre a metade e o raio normal. Recomendo assim: a parede não para a onda.
5. **O jogador cego vê o tracejado** de até onde sente. Recomendo manter: sem ele, a onda que some na borda parece defeito.
6. **Quem escolhe é só o jogador dono**; o mestre espera "Aira escolhendo…". Recomendo o mestre ter "Escolher por ela" se o jogador demorar (não está no protótipo).
7. **Evoluir é do mestre**, e no protótipo +1 nível = +20 de HP. A regra de verdade da evolução precisa do dono.
8. Companion com HP 0 não entra na escolha; derrubado na batalha, sai da ordem até ser curado.

## FORA DO ARTEFATO

- O Companion de invocação encosta na **invocação temporária** que já existe (`client/src/components/batalha/InvocacoesDoMestre.tsx`, `MiraDaInvocacao.tsx`, `dadosDaInvocacao.ts`: invocação chamada por habilidade, que some no fim). No protótipo as duas ficam separadas: Companion é permanente e ligado à ficha; a invocação de habilidade continua como hoje. Pergunta ao dono: uma invocação ligada como Companion pode também ser chamada por uma habilidade, ou são coisas separadas?
- A escolha do estado 3 vira um passo novo no "Iniciar batalha" de hoje (`client/src/components/batalha/fichasDeQuemEntra.ts`, a lista de quem entra do mestre). O plano precisa dizer como as duas listas conversam.

## O que é de mentira no protótipo

- Nada é salvo; recarregar volta tudo. Entrar no estado 3, 4 ou 5 sem ter ligado nada liga um exemplo (5 Lovecats e a Raposa) e avisa.
- O retrato da Aira é só a inicial (a arte dela não entra no protótipo). As abas da ficha além de Habilidades dizem "fica como hoje".
- Fichas, golpes, níveis e o efeito da Raposa são inventados; as Habilidades da Aira vêm resumidas do print.
- "Simular a vez do mestre" existe só para o protótipo andar. Os golpes da própria Aira ficam fora.
- O raio normal da Aira (6 casas) é fixo aqui; no app ele vem da visão do token no mapa.

## Prova

`node docs/design/caracteristicas/provas/prova.cjs` abre no Chromium de verdade (1600 x 960, 1440 x 900 e com movimento reduzido), clica, digita, arrasta e confere 57 coisas: o bloco abaixo dos atributos, os chips, "+" só para o mestre, menu com o motivo, `Esc` em menu, página e diálogo devolvendo o foco, ligar com busca, "Marcar todas" e `Enter`, busca vazia, `Ctrl+Z`, aviso arrastado para o lado, religar só pelo teclado, Evoluir, limite, grupo novo com nome que troca no chip, a Raposa "Dá efeito", a escolha com limite e desmaiada, a vez passando à Mimi com golpe e dano, o efeito da Raposa, as situações vê/sente/fora (com e sem cegueira, atrás da parede), a dica do arrasto na pausa, `Esc` cancelando o arrasto, o jogador cego vendo só a Aira e a Mimi e nenhum nome de quem só é sentido, as setas, a onda amostrada a cada 50 ms (cada anel abre de < 0,35 a 1 e some no fim; sempre um anel visível), anéis parados no movimento reduzido, nada vazando em 1440 x 900 e a coluna da ficha que não pula ao mexer num atributo. Resultado em `provas/resultado.txt`: 57/57, nenhuma tarefa longa (nenhuma acima de 50 ms; o limite era 200 ms), nenhum erro no console.

Prints: `provas/1-bloco-na-ficha.png`, `2-ligar-companions.png`, `3-escolha-da-batalha.png`, `4-vez-do-companion.png`, `5-cegueira-jogador.png`. Folha de contato da onda: `provas/folha-de-contato-onda.png` (12 quadros de um ciclo, a cada 175 ms, com o tempo embaixo). Movimento reduzido: `provas/movimento-reduzido.png` (vista do mestre, anéis parados). Gráfico da onda: `provas/onda-amostras.csv`.

Medir não é ver mexer: a folha e o gráfico mostram o desenho e o ritmo, mas se a onda "parece sentir" e não "parece radar" só o dono diz olhando o estado 5 rodando.

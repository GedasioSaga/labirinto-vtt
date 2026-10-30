# Batalha no estilo Persona, com as regras do One Piece (protótipo)

Pedido de 29/10/2026 (literal em `PEDIDOS.md`): ver de quem é a vez e, na vez do jogador, abrir as habilidades e as transformações dele "que nem Persona", com animação forte, tudo pelo livro de One Piece que já está no app. As duas imagens de referência (um menu de habilidades em faixas vermelhas e pretas, uma barra "Ordem dos turnos") foram usadas só como direção e **não entram no repositório**. Nada de logotipo, fonte ou arte do Persona: as faixas, os retratos e as cores são próprios e saem dos tokens do app.

**Estado: protótipo para o usuário aprovar.** Nada em `client/` mudou.

## Abrir

`prototipo.html` é um arquivo só, sem nada de fora, e abre direto no navegador (Chrome ou Edge, PC).

A barra de cima é do protótipo e não é tela do app:

- **Vista:** Mestre, Jogador ou Lado a lado (abre em Lado a lado). As duas telas desenham o mesmo estado, como se fossem duas máquinas na mesma mesa.
- **Jogador:** Lia, Bruno ou Duda (qual tela de jogador aparece).
- **Movimento reduzido** (já vem ligado se o sistema pede) e **Câmera lenta** (1/4), para conferir o ritmo.
- **Recomeçar** e **Para decidir** (as 4 perguntas abaixo).

Endereços prontos (depois do `#`): `vista=jogador&jogador=lia`, `vista=jogador&jogador=bruno&cena=vez-do-bruno` (vai direto à transformação), `vista=lado&cena=vez-da-marinha` (vez da Capitã Vera e a reação da Lia), `dados=7,12` (fixa as próximas rolagens de d20), `semente=` e `reduzido=1`.

## Roteiro de uma rodada

A equipe: **Lia Maré** (Skypean, Navegadora, Hane Hane no Mi), **Bruno Ferrolho** (Ogro, Ferreiro, Haki do Armamento) e **Duda Sal** (Tritão, Médica, sem transformação), contra a **Capitã Vera Doca** (Logia, Nebu Nebu no Mi), o **Sargento Otávio Prumo** e os recrutas **Ilo** e **Teo**. Nomes e frutas inventados; nenhum personagem do anime.

1. **A ordem.** A batalha abre com a ordem feita pela Agilidade: Lia 95, Vera 88, Bruno 60, Otávio 55, Duda 50 e os dois recrutas empatados em 30. O empate sai num d20, que o mestre vê na carta ("d20 7"). A carta da vez sobe e ganha a fita VEZ; a próxima ganha "A SEGUIR"; ao lado ficam a rodada, o turno ("Turno 1/7") e quem vem depois. O jogador vê "Você joga em N turnos".
2. **A vez da Lia.** Na tela dela, uma faixa preta corta o palco com "SUA VEZ". O menu entra em seguida, tira por tira (Atacar, Habilidades, Transformação, Concentrar, Encerrar vez), com as ações que ainda restam (Simples, Bônus, Mov 4) no alto. As setas escolhem, Enter confirma, → abre, Esc volta; a tira escolhida vira papel claro.
3. **Habilidades.** O palco escurece, o retrato da Lia entra pela direita e as habilidades da ficha aparecem como tiras: nome, descrição, custo à direita ("45 SP") e o que a ficha diz (Ação simples, Dano 260, Tempo 1, Alcance 6 blocos). Habilidade que não dá agora fica apagada com o motivo escrito ("SP insuficiente: custa 120, você tem 80", "A ação simples deste turno já foi usada", "Overload: já usada hoje").
4. **Alvo.** Escolhida a Rajada de Penas, a mira pousa no Recruta Ilo (← → trocam, ou clique na ficha) e mostra o que pode acontecer pela reação dele: 1 = ×1,5 (390); 2 a 9 = 260; 10 a 14 = metade; 15 a 19 = nada; 20 = contra-ataque.
5. **O golpe.** Um corte vermelho atravessa a tela com o retrato e "RAJADA DE PENAS"; um risco branco passa pelo alvo; o d20 da reação gira ao lado dele e cai em 7 ("SEM REAÇÃO"); o número 260 bate em cima da ficha, o palco treme e a ficha recua. As barras caem em duas camadas (a clara some depois, para se ver o pedaço perdido). O menu volta com a ação simples riscada e o foco no que ainda dá para fazer (aqui, Habilidades, por causa da Corrente Ascendente, que é ação bônus).
6. **A vez da Vera (mestre).** O mestre vê as técnicas da Vera e os alvos, com a sugestão já marcada (a técnica mais forte que ela pode pagar; o alvo com menos vida), e aperta **Executar**. Quer menos ainda? Liga "Inimigos jogam sozinhos".
7. **A reação da Lia.** Na tela da Lia aparece REAÇÃO: quem ataca, com o quê e quanto; o botão Rolar 1d20; e, depois do dado, só as opções que ele liberou (Defender com 10, Esquivar com 15, Contra-atacar com 20), mais "Ponto Saga: rolar de novo (2)". O mestre vê "Esperando a reação de Lia" e pode rolar por ela.
8. **A vez do Bruno: transformação.** Em Transformação aparece "Haki do Armamento: Punho Negro", com os modificadores da ficha (FOR +60, RES +100 · R3→R4), as técnicas da forma e o requisito. Ativar gasta a ação completa: o palco fica roxo, dois anéis estouram, o retrato surge, o nome da forma bate no centro e os números sobem (FOR 160 → 220, RES 150 → 250, HP máx 1.200 → 1.800). Depois, a carta dele na ordem ganha o contorno roxo e o nome da forma, e o Punho de Ferro Negro entra nas Habilidades.
9. **Fim da rodada.** Depois do último vivo, a rodada sobe; cada um recupera a reação no começo da própria vez. Quando um lado inteiro cai: VITÓRIA ou DERROTA.

Na vista só do jogador não há mestre na tela, então ele é simulado: os inimigos e os colegas sem tela jogam sozinhos, e o colega atacado rola a própria reação.

## As regras do livro usadas

| Regra | Onde está |
|---|---|
| HP e SP com atual e máximo; Escudo de um número só | `client/src/lib/sistemaOnePiece.ts:44-49` |
| Os oito atributos e as tabelas de rank | `client/src/lib/sistemaOnePiece.ts:50-69`; a conta é a de `rankDoValor`, `client/src/lib/sistemaDeRpg.ts:192` |
| Campos da habilidade (Descrição, Ação, Efeito, Custo, Tempo, Dano e extras) | `client/src/lib/sistemaOnePiece.ts:71-85` |
| Transformação com modificadores e "Técnicas da forma"; vazio "Nenhuma transformação." | `client/src/lib/sistemaOnePiece.ts:114-123` |
| Formato real dos valores ("-45 de SP", dano "200", `{ atributo, delta }`) | `client/src/lib/importarDoProjetoRpg.test.ts:67` e `:78` |
| Pontos Saga (no máximo 2, repetem um teste); modificador +1 a cada 2 ranks; Overload uma vez no dia, e usar uma trava as outras | `client/src/lib/livroOnePiece.ts:24` (Mecânicas) |
| Agilidade rank N = N blocos de deslocamento; Resistência dá HP (300, +300, +300...); Espírito dá SP (20, +40, +60...); Determinação rank 4+ reduz o dano depois de perder metade da vida (10% a 50%) | `client/src/lib/livroOnePiece.ts:30` (Status) |
| Ação completa, simples, bônus e livre; reação 1d20 sem modificador (10 defende pela metade, 15 esquiva, 20 contra-ataca); concentração (×1,5, ×2, ×3,5; no máximo 3; carga máxima vira ação completa); crítico ×1,5; ordem dos turnos pela velocidade | `client/src/lib/livroOnePiece.ts:36` (Ações de combate) |
| Barra de Logia: intangível a um ataque, volta depois da batalha | `client/src/lib/livroOnePiece.ts:66` (Akuma no Mi) |
| Dano para no 0, cura para no máximo, o Escudo é vida extra, cartões ligados somam, o máximo que cai puxa o atual | `client/src/lib/ajusteDaFicha.ts:14-23` |
| Transformação = ligar o cartão da ficha | `client/src/lib/ajusteDaFicha.ts:67-86` |
| Quem vê a vida: o mestre vê tudo; o jogador vê só a proporção dos colegas e nada dos NPCs | `client/src/lib/vidaDaFicha.ts:20-22` |

### Onde o livro não diz, e o que eu fiz (cada item é uma leitura minha)

- O livro não tem rolagem de ataque: o golpe chega e quem rola é o alvo (reação). Ficou assim, e é a pergunta 1.
- "Falha crítica" (crítico ×1,5) virou o 1 natural na reação.
- A reação volta no começo da vez de cada um. O contra-ataque usa o golpe sem custo da ficha de quem reage, e ninguém reage a um contra-ataque.
- Empate de Agilidade: 1d20 (pergunta 2).
- HP e SP somam rank a rank. Pela conta literal, Resistência R10 dá 50.450 HP, e o texto do livro diz 50.150: uma diferença de 300 que não resolvi.
- Transformar gasta a ação completa (o livro dá a transformação como exemplo de ação completa, "pode variar"). Desfazer é ação livre. O HP atual não sobe junto com o máximo, porque é a regra da ficha hoje (pergunta 3).
- Atacar usa a primeira habilidade sem custo e com dano da ficha. Concentrar usa a ação simples ou, se ela já foi, a bônus.
- O jogador vê o número do dano que causou (sai da técnica dele), mas não vê a vida do inimigo.

## O que cada um vê

- **Mestre:** todas as cartas com os números, as marcas (Logia, Saga, sem reação, o d20 do desempate), o painel da vez (o que o jogador está escolhendo, ao vivo; "Agir por ela"; as técnicas e os alvos do inimigo; "Rolar por ela" na reação), "Ordenar pela Agilidade", o arrasto das cartas (Alt+← → com a carta em foco; Esc cancela) e o registro com cada d20.
- **Jogador:** a própria carta inteira; as dos colegas só com as barras; as dos inimigos com "Vida oculta". O menu só na vez dele. Fora dela, a faixa "Vez de Capitã Vera Doca · Marinha". Quando é atacado, a caixa REAÇÃO.

## Movimento

Tudo pode ser pulado com um clique, Enter, Espaço ou Esc. Câmera lenta multiplica tudo por 4.

| O quê | Tempo | Movimento reduzido |
|---|---|---|
| Faixa da vez | entra em 240 ms, segura 420 ms, sai em 180 ms enquanto o menu já entra | só aparece e some |
| Menu da vez | cada tira em 300 ms, 40 ms entre elas | só aparece |
| Lista de habilidades | tiras em 240 ms (35 ms entre elas), retrato em 320 ms | só aparece |
| Escolher com as setas | 80 ms (a tira desliza 14 px e vira papel) | só a cor |
| Corte da técnica | abre em 150 ms, segura 330 ms, sai em 150 ms | só aparece |
| d20 da reação | 160 ms para entrar, 8 números em 380 ms, pousa em 200 ms | o número já pousado |
| Número do dano | bate em 260 ms (cresce até 116% e volta), fica 520 ms, sobe e some em 240 ms; tremor de 220 ms | sem tremor nem recuo |
| Transformação | cerca de 2,2 s: anéis, retrato, clarão de 300 ms, nome, números contando em 420 ms | só aparece e some, os números já no fim |

Curvas: a saída forte do app (`cubic-bezier(0.23, 1, 0.32, 1)`) em tudo que entra e sai, e o `cubic-bezier(0.77, 0, 0.175, 1)` quando as cartas trocam de lugar. Só `transform`, `opacity`, `clip-path` e um `filter: brightness` curto no golpe. Nenhum `blur` animado (tirado depois de medir).

## Provas (sem teste automático, pela regra do usuário)

O script fica fora do repositório, junto das imagens: `provas.cjs` na pasta de rascunho da sessão (`.../scratchpad/batalha-persona/`). Ele usa o Chromium headless do Playwright em 1440x900.

- **Folha de contato:** `folha-de-contato.png`, com 16 quadros (a vez da Lia, do "SUA VEZ" ao menu de volta; a transformação do Bruno), com o tempo embaixo de cada um. Os quadros em tamanho real ficam em `quadros/`.
- **Desempenho**, nas mesmas sequências sem nenhum print no meio (`desempenho.json`), com zero tarefa longa nas três cenas:

  | Cena | p95 do quadro | Pior quadro |
  |---|---|---|
  | Golpe da Lia | 16,7 ms | 17 ms |
  | Transformação do Bruno | 16,8 ms | 33 ms (um quadro perdido) |
  | Lado a lado, com a vez da Vera e a reação | 16,8 ms | 17 ms |

  A única tarefa longa é a da abertura da página (73 a 110 ms), abaixo dos 200 ms.
- **Movimento reduzido:** as três cenas de novo com `reduzido=1`. Nenhum erro, nenhuma tarefa longa, e a transformação termina com a carta e o menu já trocados.
- **Telas:** lado a lado; o mestre na vez do inimigo; a REAÇÃO antes e depois do dado; e o mestre arrastando a Duda para o 2º lugar, com os vizinhos abrindo espaço. A ordem final conferida foi Lia, Duda, Vera...
- **O que não foi feito:** ninguém jogou com mouse e teclado de verdade, e o leitor de tela não foi testado. Não há som.

## O que entraria no app depois

1. **Regras puras** em `client/src/lib/batalha/combate.ts`, ao lado de `blocos.ts` e `medicao.ts`: a ordem pela Agilidade, a economia de ações, custo e disponibilidade, a reação, o dano (Escudo, Determinação, Logia, crítico, concentração) e a transformação. Lendo a ficha pelo que já existe: `valorDoRank`, `maximoComposto`, `cartoesQueLigam`.
2. **No host** (`batalhaStore`): a ordem, a vez, a rodada, as ações gastas e a reação pendente, por cena. Mudar HP, SP e Escudo passa por `aplicarAjuste`, e transformar é ligar o cartão: os dois já existem, com histórico.
3. **No protocolo:** o pedido do jogador (técnica e alvo), a reação dele (rolar, escolher, Ponto Saga) e o recorte por jogador, que segue a regra da vida de `vidaDaFicha.ts`.
4. **Telas:** a faixa da ordem no topo para os dois; o menu de tiras no player (sobre o mapa de verdade; aqui o palco é só um fundo com as fichas); o painel da vez no livro do mestre. A abertura de batalha que já existe (Caveira, Marinha, Espadas...) toca antes da primeira vez.
5. **Retratos:** usar a imagem da ficha ou do token no lugar das silhuetas daqui.

## Para decidir

1. **Acerto.** O livro não tem rolagem de ataque: o golpe chega e o alvo rola a reação (1d20). Fica assim, ou entra um teste de acerto (1d20 + o modificador do rank) antes?
2. **Iniciativa.** O livro ordena pela Agilidade. No empate, aqui rola 1d20 (regra minha). Serve?
3. **Transformação.** Aqui ela gasta a ação completa, e o HP atual não sobe junto com o máximo (é a regra da ficha hoje). Fica assim, ou ativar enche os pontos ganhos?
4. **Onde mora.** A ordem dos turnos volta ao app, mas o plano da batalha (`docs/planos/modo-batalha-2026-10-24.md`, fatias B3 e B4) manda tirar a Iniciativa e o Confronto antigos (`lib/initiative.ts`, `InitiativeSection.tsx`, `PlayerTurnBanner.tsx`, `lib/confronto.ts`, `ConfrontoControls.tsx`). Isto substitui os dois, ou começa do zero ao lado deles?

## O que ficou de fora, e o que ficou fraco

- **Fraco:** os retratos são silhuetas (cabeça, ombros e um enfeite). No grande da lista e no corte, parecem recorte de papel e não o personagem. O chão do palco é um marrom liso com grade. E a transformação perde um quadro no headless.
- **De fora:** andar no mapa (o Mov é só o número); Aprimoramento de Ação (gastar SP a mais para subir o golpe, que o livro não traduz em número); efeitos que duram (o campo Tempo aparece, mas não conta rodadas); habilidades de reação; área com raio (aqui, área é "todos os inimigos"); itens (a ficha do One Piece não tem inventário, então não há botão Item); som; rede (as duas telas são a mesma página).

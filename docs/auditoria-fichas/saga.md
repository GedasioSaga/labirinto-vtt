Não gravei o arquivo porque este agente só lê. O texto entre as cercas abaixo é o conteúdo pronto de `C:/dev/labirinto/docs/auditoria-fichas/saga.md` (cerca de 80 linhas).

````markdown
# Auditoria da ficha: Saga (pasta One Piece)

Só leitura, 07/11/2026. Não rodei nada: "leitura" quer dizer que segui o código passo a passo, sem executar. Nada mudou no app nem no appData. Caminhos a partir de `client/src/`. Base: `00-bugs-do-sistema.md` (o `00-sistema.md` pedido não existe).
Lido: `%APPDATA%/com.labirinto.app/pastas/<One Piece>/rpg.json` e `rpg.json.anterior`, a cópia do Lobby (`nuvem/<campanha>/base.json` rev 24 e o diário), os mapas da pasta, o chat e o banco antigo do projeto-rpg-v2.

## 1. Resumo
- A Saga (tipo Jogador) está VAZIA em todas as cópias: HP 0, SP 0, Escudo 0, sem máximo gravado, os 8 atributos em 0, Raça e Ofício vazios, nenhuma técnica, forma, perícia, vantagem ou desvantagem, e sem a aba Armas. O `rpg.json`, o `.anterior` (01/11) e a cópia do Lobby (rev 24) são iguais. No diário do Lobby só existe a publicação da ficha vazia (rev 10, 07/11).
- Ela não veio do projeto-rpg-v2: o banco de lá tem os outros 10 jogadores, sem a Saga. Foi criada no Labirinto em 09/10 como teste do mestre ("criando um personagem e vinculando ele a um token", `PEDIDOS.md:1457`). A dona é a conta local "Saga", e a única fala dela no chat é "Oi mestre".
- Não há habilidade para automatizar. O que pesa é o que o app faz com uma ficha vazia: na batalha e no treino ela vira uma carta "imortal" que dá dano 0, e quem testa como Saga vê "bugs" que vêm da ficha vazia. No caminho achei um bug do "Ajustar..." que vale para todas as fichas (B2).

## 2. Partes da ficha e como o app executa hoje
| Parte | Na ficha | Hoje no app | Situação | Onde |
|---|---|---|---|---|
| Técnicas, formas, perícias, vantagens, desvantagens | nenhuma | as abas mostram "Nenhuma..."; o menu da vez não tem técnica, sobram o Atacar e as ações gerais | nada a executar | `lib/sistemaOnePiece.ts:76-144` |
| Armas | aba ausente | o Atacar sem arma usa a Força | automática | `lib/batalha/formula.ts:87`, `:207-208` |
| HP | 0, sem máximo | máximo = atual = 0; a vida fica "ilegível": sem barra no token nem na carta, e a ficha nunca conta como caída | quebrada (B1, B3) | `lib/ajusteDaFicha.ts:121-123`; `lib/vidaDaFicha.ts:61-63`; `components/batalha/dadosDaFaixa.ts:177-178`; `lib/batalha/turnos.ts:165-166` |
| SP | 0, sem máximo | sem barra; não paga custo nenhum (nem há técnica) | a mão (B5) | idem |
| Escudo | 0 | o dano vai todo ao HP, que já está em 0 | automática | `lib/batalha/reacao.ts:104-121` |
| Força | 0 (R1) | o Atacar dá 0 e mesmo assim pede reação | quebrada (B4) | `lib/batalha/formula.ts:351`, `:536`; `lib/batalha/golpe.ts:295-296` |
| Agilidade | 0 (R1) | joga por último (no empate vale a ordem do mapa); movimento de R1 | automática | `lib/batalha/turnos.ts:269-272`; `lib/batalha/acoes.ts:112-118` |
| Percepção, Intuição, Carisma, Determinação | 0 (R1) | só mostram o rank | automática | `lib/sistemaDeRpg.ts:216-224` |
| Resistência, Espírito | 0 (R0) | a tabela começa em R0 | automática | `lib/sistemaOnePiece.ts:60`, `:66` |
| Raça, Ofício | vazios | só aparecem na ficha; a batalha não lê | não usado | `lib/batalha/leituraDaFicha.ts:321` (lê só "Armas por batalha") |
| Armas por batalha | vazio | sem limite | automática | idem |
| Retrato | mídia `19cc58….webp` | o arquivo existe na pasta e no appData | ok | `pastas/<One Piece>/midia/` |
| Token | 1 ligado à ficha no Sky Lagoon (visível, peça marcada NPC); 6 "Saga" sem ficha em Pescaria, Labirinto, Âncora Prateada, Caverna (andar de cima), Floresta de Pinhais (cópia) e Mapa de Teste | o token ligado já vem marcado em toda batalha do Sky Lagoon (jogador sempre entra); peça NPC com ficha de Jogador vai ao dono (exceção correta) | parcial (B1) | `lib/livros/combate.ts:45-47`; `lib/batalha/turnos.ts:255-273`; `net/hostSession.ts:7649` |

## 3. Bugs (do mais grave ao menos grave)
**B1. MÉDIA (ALTA para quem testa como Saga), leitura. Ficha sem HP vira carta "imortal".**
- Onde: jogador sempre entra na batalha (`lib/livros/combate.ts:45-47`), e a caixa "Quem entra na batalha?" já traz a Saga marcada com "Jogador · HP 0" (`components/livro/QuemEntraNaBatalha.tsx:58-69`). Com máximo abaixo de 1, a vida vira `null` (`lib/vidaDaFicha.ts:63`) e a ficha nunca conta como caída (`lib/batalha/turnos.ts:165-166`): o "Passar a vez" não pula a carta e ela continua podendo ser alvo. O dano no HP é `max(0, 0 − dano)` (`lib/batalha/reacao.ts:120`), cortado entre 0 e 0 (`lib/ajusteDaFicha.ts:216`). O registro diz "recebeu N" (`lib/batalha/golpe.ts:537-538`) e a animação de dano toca (`stores/batalhaFabrica.ts:854-856`), mas a ficha não muda e a linha não guarda nada para desfazer (`stores/batalhaFabrica.ts:805-806`).
- Caso: Iniciar batalha no Sky Lagoon → confirmar a caixa → um NPC ataca a Saga com 50 → o registro diz "recebeu 50" e a ficha fica 0/0 → na rodada seguinte a carta dela joga de novo. Sem a conta Saga na sala, o mestre tem de passar a vez dela toda rodada.
- Alcance: hoje, das 11 fichas, só a Saga tem HP máximo abaixo de 1.

**B2. MÉDIA e GERAL (vale para toda ficha; não está no `00-bugs-do-sistema.md`), leitura. Quando o "Ajustar..." recebe Atual e Máximo juntos, o Atual é cortado no máximo antigo, e o registro conta o que foi pedido, não o que aconteceu.**
- Onde: a janela manda o Atual antes do Máximo (`components/batalha/AjustarDialog.tsx:101`). A store aplica nessa ordem (`stores/batalhaFabrica.ts:1327-1331` → `lib/ajusteDaFicha.ts:334-343`), o Atual para no máximo de antes (`lib/ajusteDaFicha.ts:216`) e o texto do registro sai dos números pedidos (`stores/batalhaFabrica.ts:1352`). Não achei teste que cubra o Ajustar com os dois juntos.
- Caso: Guilherme 900/1100 → Ajustar: Atual 1300, Máximo 1300 → fica 1100/1300, e o registro diz "HP 1300 · HP máximo 1300". Na Saga: 0/0 → Atual 700 e Máximo 700 → fica 0/700.
- Variante: na Saga, só "Atual 700" → nada muda, a store devolve `false` (`stores/batalhaFabrica.ts:1354`) e a janela diz "Não saiu: a ficha saiu da batalha, ou sem conexão com o mestre" (`components/batalha/AjustarDialog.tsx:128`). O motivo mostrado está errado.

**B3. MÉDIA (Lobby), leitura. Treino com a Saga, ou com o Judge "Cópia de Saga", só termina por tempo.**
- Onde: ficha sem vida legível conta como "de pé" (`lib/treino/fimDaLuta.ts:80-81`, `lib/treino/robo.ts:92-96`, `lobby-site/telas/treino/quemJoga.ts:16-20`). O Atacar dela manda 0 (`lib/treino/robo.ts:164-168`). "Vida cheia" põe o HP no máximo, que é 0 (`lobby-site/telas/treino/lutaDeTreino.ts:57-63`). O teto é de 30 rodadas (`lib/treino/lutaAutomatica.ts:41`).
- Caso: mestre no Lobby → Treino → Saga contra qualquer inimigo → 30 rodadas → "empate por tempo"; nas 100 lutas, 100 empates. O mestre vê a Saga em "minhas" (o mestre escreve em toda ficha, `lib/nuvem/permissao.ts:48`; ficha publicada nasce como "mesa", `lib/nuvem/lote.ts:84`; filtro em `lobby-site/telas/treino/TelaTreino.tsx:61`) e também em "Quem o Judge é" (`TelaTreino.tsx:83-89`).
- Judge "Cópia de Saga": o HP vem da base, 0 (`lib/treino/juiz.ts:80-83`, `:94`). O campo "HP máxima" abre em 0 com mínimo 1, já vermelho (`lobby-site/telas/treino/juiz/AjustesDoJuiz.tsx:84`, `:130`; `juiz/CamposDoTreino.tsx:46-48`). Se ninguém mexer, o Judge luta com 0/0 e não cai (`lib/treino/juiz.ts:193-195`).

**B4. BAIXA, leitura. Atacar de 0 pede reação e ocupa a fila de golpes.**
- Só dano `null` dispensa a reação (`lib/batalha/golpe.ts:295-296`, `lib/batalha/tiposDaHabilidade.ts:97-100`). O 0 do Atacar sem Força não é `null`, então conta no teto de 20 golpes esperando (`lib/batalha/golpe.ts:170-171`, bug 2 do sistema). Caso: vez da Saga → Atacar no Harvey → abre a caixa REAÇÃO para o Harvey por um golpe de 0.

**B5. BAIXA, leitura. Sem máximo, o Atual de HP e SP não sobe pelo atalho, e a ordem dos campos importa.**
- Painel rápido da ficha: o Atual fica preso no máximo 0 até alguém digitar o Máximo (`components/FichaNumeros.tsx:180-190`, `lib/ajusteDaFicha.ts:216`). No Editar, digitar o Atual primeiro grava uma ficha "de um número só" (`lib/ajusteDaFicha.ts:237-250`) e cai no bug 4 do sistema.

**B6. BAIXA, leitura.** No Balancear encontro, a Saga soma 0 de vida e 0 de dano ao grupo e não aparece em "sem golpe", porque o Atacar de 0 conta como golpe (`lib/livros/encontro.ts:161-163`, `:217`, `:300`).

## 4. Automações propostas
- A1. Uma checagem única de "ficha incompleta", em código puro, ao lado de `vidaDoPersonagem`: HP máximo abaixo de 1 (e, só como aviso, SP máximo 0 ou todos os atributos em 0). Usar no Livro (Personagens), na caixa "Quem entra na batalha?" (com aviso e desmarcada), no Treino e na lista do Judge. Resolve B1, B3 e B6 juntos, conforme as respostas de P3 e P6.
- A2. Ajustar: a store aplica o Máximo antes do Atual, sem depender da ordem da janela, e escreve a linha com o que mudou de verdade (`partesDoAjuste`). Se nada mudou, a mensagem é "Nada mudou na ficha", e não "sem conexão". Teste da store: ficha em 900/1100 → pedir 1300/1300 → tem de ficar 1300/1300. (P4)
- A3. Golpe de dano 0 sai como "sem dano", sem reação, ou a mira avisa "Força 0: o Atacar dá 0". (P5)
- A4. Treino: `problemaDaMontagem` (`lobby-site/telas/treino/lutaDeTreino.ts:79-84`) recusa ficha sem vida ("Saga está sem HP"), e o Judge que copia uma ficha com HP 0 usa o HP do boneco. (P6)
- A5. Se a Saga for de teste (P1): transformá-la numa ficha-gabarito, com um exemplo de cada coisa que o motor lê (custo em SP, Tempo 3, dano por fórmula com Força, selo, Buff, Debuff, forma com "HP +100" e Usos por batalha, arma com bala, passiva de marca). Ela vira o roteiro do teste manual e a base do teste da store, e o mestre passa a testar como jogador com números de verdade.

## 5. Perguntas para o mestre (da mais importante para a menos)
- P1. Quem é a Saga? (a) é a sua ficha de teste (você entrando como jogador): fica, e vira a ficha-gabarito de A5 (recomendo); (b) é personagem de um jogador: mande a ficha; (c) apagar e tirar dos Jogadores principais.
- P2. Se ficar, com que números? (a) você manda HP e SP máximos, Escudo, os 8 atributos, Raça, Ofício, armas e técnicas; (b) eu proponho uma build média da mesa (HP 700, SP 60, atributos na faixa R2) e você corrige (recomendo, se for de teste); (c) fica vazia.
- P3. Ficha sem HP (máximo 0) ao Iniciar batalha: (a) não vem marcada e a caixa avisa "sem HP" (recomendo); (b) entra como caída (é pulada e não pode ser alvo); (c) como hoje (joga e nunca cai).
- P4. No Ajustar, com Atual e Máximo digitados juntos: (a) vale o que foi digitado nos dois (recomendo); (b) o Atual nunca passa do máximo antigo (como hoje, sem aviso).
- P5. Atacar que dá 0 (Força 0, sem arma): (a) vira golpe "sem dano", sem reação (recomendo); (b) a mira avisa e não deixa mandar; (c) como hoje (pede reação).
- P6. Treino, Arena e Judge com ficha sem HP: (a) ficam de fora, com o aviso "ficha sem HP" (recomendo); (b) entram com um HP padrão (o do boneco); (c) como hoje (só empatam por tempo).
- P7. O "Saga" do Sky Lagoon (ligado à ficha, visível) e os 6 "Saga" sem ficha nas outras cenas da pasta são a mesma pessoa? (a) enquanto a ficha estiver vazia, esconder o do Sky Lagoon (recomendo); (b) ligar todos à ficha, depois de P2; (c) deixar como está.

## Conferi e está certo
- Ficha sem máximo não causa divisão por zero: a barra, a proporção e a regra de "caído" tratam máximo abaixo de 1 (`lib/vidaDaFicha.ts:61-66`, `components/FichaNumeros.tsx:59-61`, `lobby-site/telas/TelaCampanha.tsx:163-164`, `lib/batalha/golpe.ts:446-451`).
- As abas que faltam na Saga (Armas, Balas, Itens) não quebram nada: não há leitura de aba sem `?? []` em `client/src` (fora o Dragon Ball).
- Peça marcada NPC ligada a ficha de Jogador vai ao dono (`net/hostSession.ts:7649`), e o host aceita a ação dela (`net/batalhaNoHost.ts:356-363`). Por isso a Saga não cai no bug 8 do sistema, desde que o token seja da conta dela.
````

## Como se conecta
- Uma regra só causa B1, B3 e B6: `vidaDoPersonagem` (`C:/dev/labirinto/client/src/lib/vidaDaFicha.ts:61-63`) devolve `null` quando o máximo está abaixo de 1. A batalha (`turnos.ts`), o fim da luta do treino (`fimDaLuta.ts`), o robô (`robo.ts`) e o `quemJoga.ts` leem esse `null` como "de pé".
- O dano chega por `reacao.ts:120` e é cortado em `ajusteDaFicha.ts:216`. Já o texto do registro (`golpe.ts:537`) e o efeito de dano (`batalhaFabrica.ts:856`) não olham se a ficha mudou.
- O B2 não tem a ver com a Saga: é a ordem Atual-antes-do-Máximo em `AjustarDialog.tsx:101`, que a store respeita, somada ao texto montado a partir do pedido (`batalhaFabrica.ts:1352`).

## Pontas soltas
- Não rodei nada, então tudo está marcado como "leitura". O B2 precisa virar teste da store antes do conserto (900/1100 → 1300/1300).
- O B2 é bug do sistema inteiro: vale levar para `C:/dev/labirinto/docs/auditoria-fichas/00-bugs-do-sistema.md`.
- Do Lobby só vi a cópia local: `base.json` rev 24, igual ao `estado.json` com `revRecebida` 24. Se alguém editou a Saga no site depois da rev 24, não aparece aqui. Também não confirmei se os jogadores (não o mestre) veem a Saga como "colega": isso depende de o servidor achar um nome para a conta dona (`nomeDoDono`).
- Li o banco do projeto-rpg-v2 (`%APPDATA%/com.gedasio.rpgv2/rpg.db`) só em modo leitura; não abri os arquivos de segredo de lá.
- Fora do escopo, de passagem: na Aira, a cópia do Lobby difere do `rpg.json` local só no `historico`.
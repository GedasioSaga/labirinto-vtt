ARQUIVO NÃO GRAVADO: sou agente só-leitura. O texto abaixo é para `C:/dev/labirinto/docs/auditoria-fichas/vincent-g.md`.

# Vincent G.: auditoria da ficha (pasta One Piece, 07/11/2026)

Só leitura. A ficha veio do `rpg.json` da pasta One Piece no appData e nada foi gravado. O `00-sistema.md` pedido não existe, então usei o `00-bugs-do-sistema.md`; "sistema #N" e "P#" abaixo apontam para ele. **Provado** = visto no disco, ou regex do app aplicada ao texto da ficha. **Leitura** = seguido no código sem rodar o app (não rodei nada). **Suspeita** = virou pergunta.

## 1. Resumo
- Atirador humano, ofício Artista. HP 600/600, SP 60/60, Escudo 20. Percepção 35 (rank 2, teste +1), Agilidade 35, Carisma 35. Uma arma só: Rosa Fúnebre (De fogo, dano 20, soma Percepção).
- O jogo dele é a MARCA de tinta (regra do usuário de 01/11): o próximo golpe de qualquer um que ACERTAR o marcado dá o dobro, e a marca some. Ele marca de três jeitos: Olhar artístico (depois de um tiro, paga 40 SP ou faz teste de Percepção CD 15), Desenhar o alvo (marca sozinho ao acertar) e Passo de Valsa (esquiva e marca quem atacou).
- Com 60 SP ele paga UMA dessas três por batalha (30, 35 ou 40 SP), e o app nunca devolve SP sozinho.

## 2. O que a ficha tem e como o app executa
| Item | Ficha diz | App hoje (arquivo:linha) | Estado |
|---|---|---|---|
| Atacar (Rosa Fúnebre) | 20 de dano; "Capacidade de 10 Balas" só na Descrição | "35 Percepção + 20 Rosa Fúnebre = 55" (`client/src/lib/batalha/formula.ts:207-212`, `:547-550`); a arma De fogo liga o lembrete da marca (`lib/batalha/golpe.ts:363`); campo Capacidade vazio e o app não conta tiros (`lib/batalha/leituraDaFicha.ts:243`, `:286-291`) | automática, sem munição |
| Olhar artístico (Passiva) | ao acertar tiro: teste PER CD 15 ou 40 SP marca; 1 marca por alvo | lembrete "Marcar? Pagar 40 SP · Teste · Agora não" só na tela do jogador (`lib/batalha/marca.ts:192-205`, `components/batalha/LembretesDaMarca.tsx:70-143`); o host rola d20+1 contra 15 (`stores/batalhaFabrica.ts:1267-1274`); o acerto seguinte dobra e tira a marca (`marca.ts:178-183`) | automática, com B2-B5 |
| Extra "Efeito da Marca" | "dura 3 turnos"; "desvantagem na esquiva ou bônus de dano" | marca sem turnos, só o dobro (`marca.ts:141-145`), como o usuário decidiu em 01/11 (`PEDIDOS.md:2020`) | texto da ficha desatualizado |
| Desenhar o alvo (Simples, Debuff, 30 SP, Tempo 3) | atinge 1 inimigo, marca, Dano Perfurante; "Dano da Bala + Dano da Arma + Percepção" | 30 SP e recarga 3 lidos (`leituraDaFicha.ts:56`, `:106-118`); dano 0 sem bala + 20 + 35 = 55 (`formula.ts:391-397`); Perfurante ligado (`leituraDaFicha.ts:134-147`); marca ao acertar, sem selo duplo (`golpe.ts:355-358`, `components/batalha/dadosDoMenu.ts:455`); Debuff sempre pede reação (`lib/batalha/tiposDaHabilidade.ts:97-100`) | automática, com B6 |
| Passo de Valsa (Reação, 35 SP, Tempo 3) | contra ataque CORPO A CORPO: esquiva e marca o atacante | botão na caixa REAÇÃO, Esquiva sem d20 (`lib/batalha/reacaoComTecnica.ts:130-148`, `tiposDaHabilidade.ts:139-170`); cobra 35, recarga 3, marca o atacante (`batalhaFabrica.ts:1499-1514`) | automática, com B7-B8 |
| Mochila: Bala de Prata ×50, Pão ×4, Pastel, Boomerang | prata: dano = metade da "precisão"; quem é ferido recebe metade da cura | sumiu da ficha hoje (B1). Mesmo de volta, bala da mochila não entra na mira (só os "Tipos de bala" da arma entram: `leituraDaFicha.ts:291`, `dadosDoMenu.ts:345`); cura reduzida não existe no app; Boomerang não está na aba Armas | quebrada / não suportada |
| Perícias (Acrobacia 2×, Prestidigitação, Atuação), Vantagens (Sensitivo, Beleza Natural), Desvantagem (Audição Ruim) | testes com vantagem ou desvantagem | só texto: nada em `lib/batalha`, `components/batalha`, na store ou no host lê perícia ou vantagem; o One Piece não rola 2 d20 | à mão |
| HP 600, SP 60, Escudo 20 | — | HP e SP batem com o livro (Resistência R1 = 300+300; Espírito R1 = 20+40), mas são números digitados; o Escudo gasta antes do HP e não volta (`lib/batalha/reacao.ts:104-122`) | ok / à mão |
| Raça Humano, Ofício Artista | — | só uma escolha, sem efeito na batalha (`lib/sistemaOnePiece.ts:41-46`) | à mão |

## 3. Bugs
**B1. ALTA, provado no disco: a mochila do Vincent sumiu hoje às 21:35.**
- O que se vê: o relatório `migracao-da-mochila.json` (21:35:21) diz que a ficha recebeu Pastel, Bala de Prata ×50, Pão ×4 e Boomerang (vindos de Tasmaturi Village > Casa de Frog). Mas o `rpg.json` (21:35:22,7) só difere do `rpg.json.antes-da-mochila` pela linha `"mochilaMigrada": 1`, e nenhuma das 11 fichas tem `mochila`. Aira (1 item), Alexei (4) e May (1) perderam do mesmo jeito. A base do Lobby (`nuvem/camp_…/base.json`, rev 24) também não tem mochila.
- Causa provável (leitura + horários): a migração grava direto no disco, sem avisar o Lobby (`client/src/net/nuvem/migracaoDaMochila.ts:355`). Ao abrir o mapa, o acerto com o Lobby (`net/nuvem/sincronizador.ts:288-311`, `:550`) compara a ficha com a nuvem, que não tem mochila, e apaga item por item (`net/nuvem/acertoDasFichas.ts:147-174`, `lib/nuvem/diferencas.ts:104`, `:174`). Cerca de 1 s depois, o gravador leve regrava o `rpg.json` sem fazer `.anterior` (`net/nuvem/gravadorLeve.ts:17-25`, `sincronizador.ts:138`). O `.anterior` ainda é de 31/10, então não foi o Salvar da pasta (`lib/pastasDeMapas.ts:540`).
- Efeito: o marcador impede a migração de rodar de novo (`migracaoDaMochila.ts:370`). Os itens ainda existem no relatório e no `map.json` da cena Casa de Frog (salva em 29/10). Suspeita: abrir e salvar essa cena esvazia o boneco, porque o boneco passa a mostrar a ficha vazia (`lib/mochila/espelho.ts:25-31`).

**B2. MÉDIA, leitura: Olhar artístico também aparece na tira Passivas, com um "Ativar" que não marca ninguém.** O app trata a passiva como uma passiva comum de "requisito" (`lib/batalha/passivas.ts:163-165`, `:480-509`), e o botão fica ligado (`components/batalha/PassivasDaBatalha.tsx:363`, `:501-508`).
- Caso: menu da vez → Passivas → Olhar artístico → digita 40 no custo → Ativar.
- Resultado: SP 60 → 20 e uma pílula dourada "Olhar artístico" no próprio Vincent; nenhum alvo fica "Marcado".

**B3. MÉDIA, leitura: o lembrete da marca não vence e não some.** O app não confere a rodada (`stores/batalhaFabrica.ts:1241-1262`, `net/batalhaNoHost.ts:563-572`). Quando o alvo já está marcado, recusa SEM tirar o lembrete (`batalhaFabrica.ts:1258`). Só "Agora não" ou o teto de 16 lembretes tiram (`marca.ts:47`, `:203`).
- Caso: na rodada 1 ele atira no X e ignora o lembrete (L1). Na rodada 2 atira de novo e marca pelo novo lembrete (L2). Um aliado acerta X (dobro, a marca some). Na rodada 4 ele responde o L1 e marca X de novo sem ter atirado.
- Enquanto X está marcado, clicar no L1 não faz nada na tela do jogador (sistema #1).

**B4. MÉDIA, leitura: o mestre não consegue responder o lembrete do Vincent.** O painel do mestre só lista lembretes de NPC (`components/batalha/BatalhaDoMestre.tsx:250-252`). Se o jogador estiver desconectado, a passiva fica sem uso.

**B5. BAIXA, leitura:** o lembrete sai também quando o tiro pega um aliado (`marca.ts:192` não olha a equipe); a ficha diz "inimigos".

**B6. MÉDIA, leitura: Desenhar o alvo marca até 12 alvos.** O app não lê "Atinge 1 inimigo": a mira deixa escolher 12 (`components/batalha/MiraDoGolpe.tsx:265`, `lib/batalha/combate.ts:619`) e a regra aceita (`golpe.ts:161-171`).
- Caso: 3 alvos que não esquivam = 3 marcas por 30 SP.

**B7. MÉDIA, leitura: Passo de Valsa vale até contra tiro.** O app não confere "ataque corpo a corpo": a caixa só olha se o golpe deixa reagir (`reacaoComTecnica.ts:144-148`). O golpe até sabe se a arma atira (`golpe.ts:363`), mas a reação não usa isso.
- Caso: um NPC atira de pistola no Vincent → aparece "Usar Passo de Valsa" → ele esquiva e marca.

**B8. BAIXA, leitura:** a marca do Passo de Valsa vai mesmo se a saída for trocada para Metade, Cheio ou Contra (`batalhaFabrica.ts:1502-1514` não olha a saída; as saídas trocáveis estão em `combate.ts:31`). Com Contra, ele toma zero de dano e ganha um contra-ataque no atacante já marcado: até 110 de dano. Virou a pergunta 6.

**B9. ALTA, já provado no sistema #3 com o Vincent:** desfazer a "Vez" deixa Desenhar travado mesmo depois de desfeito, e devolve a recarga do Passo de Valsa sem devolver os 35 SP.

**B10. BAIXA, dado (provado):** há duas "Acrobacia" com ids diferentes em Perícias. Já estava na cópia de 31/10, então não foi o app.

## 4. Automações propostas
- A1 (B1): numa pasta publicada, a migração manda os itens ao Lobby (ou o acerto deixa de apagar o que a nuvem nunca teve). Depois, devolver os itens pelo relatório. Até lá: não abrir nem salvar Tasmaturi Village, e guardar uma cópia do relatório e da cena.
- A2 (B2): passiva que o app lê como marca sai da tira Passivas, ou o "Ativar" vira "Marcar alvo" (escolher alvo + 40 SP ou teste).
- A3 (B3): o lembrete vence no prazo da pergunta 3 e some quando o alvo ganha marca; a recusa volta com o motivo para o jogador.
- A4 (B4): o mestre vê e responde os lembretes de jogador, como já faz com as reações pendentes.
- A5 (B6): ler "1 inimigo" ou "1 alvo" no Efeito e travar a mira em 1.
- A6 (B7): ler "corpo a corpo" e só oferecer a reação contra golpe sem arma que atira (técnica à distância precisaria de uma marca própria no cartão).
- A7: cadastrar a Bala de Prata como "Tipo de bala" da Rosa Fúnebre, com Dano "+Percepção / 2" (a fórmula da bala já aceita atributo: `formula.ts:400-406`) e o Efeito em texto. Atacar e Desenhar vão a 72. É só dado, sem código.
- A8: pôr "10" no campo Capacidade da arma (hoje só está na Descrição).
- A9: SP que volta. O livro diz "Para a recuperação do SP, é necessário não utilizar habilidades" (`lib/livroOnePiece.ts:36`). Proposta: lembrete "+X SP" no começo da vez de quem não gastou SP na vez anterior (pergunta 2).
- A10: atualizar o extra "Efeito da Marca" para a regra de 01/11 (sem "3 turnos").
- A11: conferir HP e SP máximos pelo rank (Resistência e Espírito, tabela do livro) e avisar quando a ficha difere. Com Espírito 35 ele iria a 120 SP.

## 5. Perguntas para o mestre (da mais importante para a menos)
1. Mochila (B1): devolvo o que o relatório lista? a) sim: Pastel, Bala de Prata ×50, Pão ×4, Boomerang (recomendo); b) as quantidades mudaram na mesa, você me diz; c) começa vazia.
2. SP volta durante a luta? a) +X SP no começo da vez de quem não usou SP na vez anterior, com X definido por você (recomendo); b) só fora da luta; c) fica à mão.
3. Até quando vale o lembrete da marca? a) até o fim da vez do Vincent (recomendo); b) até o fim da rodada; c) sem prazo (como hoje).
4. O mestre pode responder a marca pelo Vincent quando o jogador não está? a) sim (recomendo); b) só o jogador.
5. Passo de Valsa vale contra tiro ou técnica à distância? a) não, só corpo a corpo, como a ficha diz (recomendo); b) contra qualquer ataque (como hoje).
6. Passo de Valsa pode sair como Contra ou Metade? a) só Esquiva, e a marca só com Esquiva (recomendo); b) pode trocar, como hoje.
7. Desenhar o alvo: a) 1 alvo só (recomendo, a ficha diz); b) vários (como hoje).
8. O "Dano Perfurante" do Desenhar ignora o Escudo inteiro? a) sim, como hoje, seguindo a regra Q4 da casa (recomendo); b) não, é só o tipo de dano da bala; c) perfura uma parte (diga a %).
9. Bala de Prata, "metade da precisão": a) metade da Percepção, somada à arma: 35+20+17 = 72 (recomendo); b) troca o dano da arma: 35+17 = 52; c) outro número.
10. "Cura recebida pela metade" da prata: a) selo "Ferido por prata" que lembra o mestre (recomendo); b) o app corta a cura sozinho (recurso novo); c) fica na mesa.
11. O tiro que gasta a marca já pode marcar de novo? Hoje o Desenhar remarca sozinho e o Atacar abre lembrete. a) sim (recomendo, é o que a ficha diz); b) só no golpe seguinte.
12. Escudo 20: a) volta cheio a cada batalha (recomendo; precisa de um máximo gravado); b) só volta quando o mestre der; c) vem de item ou arma (qual?).
13. Tempo 3 do Passo de Valsa (ligado à P1): hoje conta nas vezes dele, então, se ele reage antes da própria vez na rodada, fica livre uma rodada antes. a) contar rodadas cheias, igual para todos (recomendo); b) deixar como hoje.
14. O texto "desvantagem na esquiva ou bônus de dano" do Olhar artístico: a) sai, vale só o dobro (recomendo); b) vira uma escolha de quem acerta.
15. Contar as 10 balas: a) só mostrar na Capacidade (recomendo por ora); b) o app desconta por tiro e pede recarga.
16. As duas Acrobacia: a) apagar uma (recomendo); b) é de propósito (diga o efeito).
17. Vantagem e desvantagem (Sensitivo, Beleza Natural, Audição Ruim) no app: a) ficam na mesa (recomendo por ora); b) o app rola 2 d20 no teste daquele atributo.
18. Boomerang: a) vira arma de Arremesso na aba Armas; b) é só item (recomendo até ele usar).

## Não coberto
- Não rodei o app nem as funções; só li o código e apliquei as regexes do app ao texto da ficha. Por isso B2 a B8 são leitura.
- Ficaram de fora: o treino do Lobby (`client/src/lib/treino/*` está em obra no git), o Desfazer de cada caminho da marca, a carta extra (P2) e a batalha que some ao fechar o app (P8).
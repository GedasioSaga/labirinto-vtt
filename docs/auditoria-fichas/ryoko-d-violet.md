# Ficha: Ryoko D. Violet (One Piece), auditoria de 07/11/2026

Só leitura. Li a ficha em `%APPDATA%/com.labirinto.app/pastas/<pasta One Piece>/rpg.json` e não gravei nada. Os caminhos de código partem de `C:/dev/labirinto/client/src/`. "Leitura" quer dizer que conferi no código, sem rodar o app nem teste. As leituras de custo, tempo, perfurante, modo da reação e custo por turno eu conferi copiando as regex do código no node. O que não deu para provar virou pergunta. Os bugs gerais estão em `00-bugs-do-sistema.md`.

## 1. Resumo
- Jogadora Ogro, ofício Navegador. HP 700, SP 240, Escudo 12, sem `maximos` gravados. FOR 60, AGI 33, PER 11, RES 6, INT 20, ESP 35, CAR 30, DET 30. Não tem armas, itens nem mochila.
- Tem 4 técnicas e 3 Formas Híbridas no mesmo Grupo. Cada forma traz Sopro do Dragão, Fúria do Dragão e Grande Fissura (Overload).
- O dano e a perfuração saem certos sozinhos. O que quebra: a troca de Parte (pela ficha as 3 se somam; na batalha a recarga zera), a Fúria do Dragão e o custo por turno. As regras da raça (−30% de dano, +20 corpo a corpo) o app não lê.

## 2. Habilidades
| Item | A ficha diz | O app hoje | Onde |
|---|---|---|---|
| Raça: Superioridade do Ogro | dano recebido −30%, menos o verdadeiro | não suportada: só forma ligada com "Dano recebido" reduz; raça e descrição não são lidas | `lib/batalha/transformacao.ts:82-103`, `stores/batalhaFabrica.ts:874-879` |
| Raça: Força Aumentada | +20 de dano corpo a corpo; vantagem corpo a corpo | não suportada: o Atacar sem arma é só a Força (60); a batalha não tem vantagem (só o alvo rola) | `lib/batalha/formula.ts:87`, `:207-212`; `lib/batalha/reacao.ts:26-32` |
| Chute do Dragão | Simples, 10 SP, Tempo 2, Força + 20 + 25 de Queimadura | automática: 105 (Parte 1: 120, Parte 2: 125, Parte 3: 145); os 25 entram no mesmo golpe, sem selo de queimadura | `formula.ts:425-428`, `lib/batalha/selos.ts:92-99` |
| Chamas Negras Mortais | Completa, 25 SP, Tempo 4, Espírito + 30, perfura 50% | automática: 65, Perfurante 50% | `lib/batalha/leituraDaFicha.ts:150-167` |
| Golpe de Chifres | Ação Completa, "35 de Sp", Tempo 3, Força + 50, perfura | automática: 110 (125/130/150), Perfurante 100% | `leituraDaFicha.ts:56`, `:134-147` |
| Recuperação de forças | Tipo Reação, 0 SP, 2 vezes por combate; anula o dano e 20% vira vida; só contra fogo | parcial: botão na caixa REAÇÃO com Esquiva marcada, conta os 2 usos; a cura e o "só fogo" ficam a mão (B5) | `lib/batalha/tiposDaHabilidade.ts:74-82`, `:140-161` |
| Forma Híbrida Partes 1, 2 e 3 | Grupo "Forma Híbrida"; P1 FOR+15 RES+10, P2 FOR+20 RES+20, P3 FOR+40 RES+40, todas AGI+5 PER+5; P1 grátis, P2 10 SP/turno, P3 20 SP/turno | parcial: Ativar gasta Completa (a tela deixa trocar a ação); a troca dentro do Grupo só existe no menu da batalha (B1); o custo por turno só aparece na tela | `transformacao.ts:143-144`, `:193-196`, `:278-299`; `components/batalha/ListaDeFormas.tsx:27`, `:91` |
| Atributos que as formas dão | — | FOR entra no dano; AGI só na ordem e nos blocos (38/43/48 continuam rank 2); RES e PER não entram em nenhuma conta da batalha | `lib/batalha/acoes.ts:75`, `:112-115` |
| Sopro do Dragão (nas 3 Partes) | Completa, 30 SP, Tempo 4, Espírito + 45, perfura 50%, vários alvos | automática: 80, Perfurante 50%, até 12 alvos; a recarga some ao trocar de Parte (B2) | `lib/batalha/golpe.ts:274` |
| Fúria do Dragão (nas 3) | Completa, 0 SP, Tempo 1, Dano 0, "consegue evoluir seus poderes" | quebrada: vira golpe de 0 que pede reação e não muda nada (B4) | `golpe.ts:295-296` |
| Grande Fissura (nas 3) | OVERLOAD, 65 SP, (Força + Espírito) + 100, 1 vez por batalha, perde metade dos Status | parcial: 210/215/235, o alvo não reage, trava os Overload dela; a "metade dos Status" é a mão (Ajustar...); nas Partes 2 e 3 falta a Ação (B3) | `lib/batalha/combate.ts:49-50`, `acoes.ts:236` |
| Corpo Vigoroso | +100 de HP | a mão: o 700 bate com o livro (RES 6 = rank 1 = 600, mais 100); não há `maximos` (bug 4 do sistema) | `lib/ajusteDaFicha.ts:120-123` |
| Vantagens (Acrobata, Faro Aguçado, Coragem, Beleza Natural), perícias (Noção de Batalha, Pesca, Navegação, Geografia) e a desvantagem em Carisma da raça | vantagem ou desvantagem em teste | a mão: o app não rola teste de atributo | — |
| Desvantagens (Ignorante, Linhagem Demoníaca, Sinceridade Excessiva, Orgulho Cego, Impulsivo) | interpretação | nada a automatizar | — |

## 3. Bugs
**B1. ALTA (leitura). Ligar a forma pela FICHA soma as 3 Partes.**
- Onde: o Grupo só troca no Ativar da batalha (`lib/batalha/transformacao.ts:287`). O botão "Ativar" do cartão na ficha (`components/FichaAbas.tsx:99`, `:174`) chama `aplicarAjuste` → `ligarCartao` (`lib/ajusteDaFicha.ts:188-197`, `:232-233`), que não olha o Grupo. O jogador (`net/hostSession.ts:7946`) e o Lobby (`lobby-site/telas/TelaFicha.tsx:321`) usam o mesmo caminho.
- Caso: na ficha, Ativar a Parte 1, depois a 2 e a 3. As 3 ficam "Ativa": Força 135, Resistência 76. O menu da batalha mostra 3 Sopros, 3 Fúrias e 3 Grandes Fissuras (`leituraDaFicha.ts:176-186`), cada um com a sua recarga. A Grande Fissura dá 270 (o certo é 235). Isso vai contra a regra do mestre de 01/11 (PEDIDOS.md:2020, item 6): "se ela passar de parte um para parte dois ele ganha os buffs só da parte 2".
- Conserto: a ficha usar a mesma troca da batalha (`formasQueTroca`).

**B2. MÉDIA (leitura). Trocar de Parte zera a recarga do Sopro e da Fúria.**
- Onde: cada Parte tem a sua cópia da técnica, e a recarga é guardada pelo id do cartão (`lib/batalha/combate.ts:46`, `acoes.ts:237-238`, marcada em `golpe.ts:274`).
- Caso: rodada 2, Sopro da Parte 1 (Tempo 4). Rodada 3, Ativar a Parte 2. Rodada 4, o Sopro da Parte 2 sai livre. Pela regra de hoje (P1 do sistema), só voltaria na rodada 6. O Overload não tem esse furo: ele trava por personagem (`combate.ts:49-50`).
- Conserto: técnica de mesmo nome dentro do mesmo Grupo divide a recarga. O texto e os números são iguais nas 3 Partes.

**B3. MÉDIA (leitura; erro de dado). Grande Fissura das Partes 2 e 3 sem Ação e sem o extra OVERLOAD.**
- Onde: só a Parte 1 tem Ação "OVERLOAD", que vira Completa (`leituraDaFicha.ts:100`). Nas Partes 2 e 3 o Overload vem só do Tempo. A Ação fica vazia e a mira pergunta qual gastar, com "Livre" na lista (`components/batalha/MiraDoGolpe.tsx:165`; `golpe.ts:205`, `:261`). O aviso "perde metade dos Status" também não aparece nelas.
- Caso: na Parte 3, Golpe de Chifres (Completa, 150) e Grande Fissura como "Livre" (235) na mesma vez. O host aceita.
- Conserto de dado (com o app fechado e backup): copiar a Ação e o extra da Parte 1.

**B4. MÉDIA (leitura; erro de dado). A Fúria do Dragão vira golpe de 0 que espera reação.**
- Onde: só "-" conta como "sem dano" (`formula.ts:526`, `components/batalha/dadosDoMenu.ts:319-324`). "0" é número: a mira exige alvo e já marca o primeiro inimigo (`MiraDoGolpe.tsx:190-195`, `:270-281`), e alvo com dano 0 reage (`golpe.ts:295-296`). O efeito não tem número, então nada sobe.
- Caso: a Ryoko usa a Fúria do Dragão → Lançar. O NPC marcado fica com uma reação de 0 esperando. Sem resposta, ela conta no teto de 20 golpes (bug 2 do sistema).
- Na hora: trocar o Dano para "-" nas 3 Fúrias. Depois, seguir a resposta da P1.

**B5. BAIXA (leitura). Recuperação de forças vale contra qualquer golpe e não cura.**
- Onde: a caixa REAÇÃO lista toda técnica de reação sem olhar o golpe (`lib/batalha/reacaoComTecnica.ts:130-148`), e a leitura do texto só dá "esquiva" (`tiposDaHabilidade.ts:140-145`; esta técnica é o exemplo em `:161`).
- Caso: a Pazada (golpe de pá) do Harvey → aparece "Usar Recuperação de forças" com Esquiva marcada → 0 de dano e 1 dos 2 usos gasto. Os 20% de vida não entram. Ela também não pode usar a técnica na própria vez como Ação Simples: o Tipo "Reação" apaga no menu (`acoes.ts:231`).

**Bugs do sistema que pegam a Ryoko:** 4 (sem `maximos`, editar o atual baixa o máximo junto), 10 (os 10 e 20 SP por turno estão só no Requisito e nunca são cobrados), 9 se a Parte 3 passar a dar HP (P12), P8 (os 2 usos da Recuperação e o Overload voltam se o app fechar).

## 4. Automações propostas
- **Superioridade do Ogro, já, sem código:** criar um cartão de Transformação "Superioridade do Ogro" sem Grupo, Ação "Livre", Dano recebido "-30%", e deixar sempre ligado. O app usa a maior redução das formas ligadas (`transformacao.ts:86-90`), no golpe e no dano livre do mestre. Com código: "Dano recebido" na raça e um botão "dano verdadeiro" na mira que pula a redução.
- **+20 corpo a corpo, já, sem código:** criar uma arma "Força de Ogro" (Categoria Natural, Dano 20). O Atacar passa a ser Força + 20 (`formula.ts:207-212`). Com código: bônus da raça mais uma marca "corpo a corpo" nas técnicas.
- **Custo por turno das Partes 2 e 3:** ler o Requisito com a mesma leitura das passivas (`lib/batalha/passivas.ts:301-312`, que já entende "Gasta 10 SP por turno"). No começo da vez dela, mostrar o aviso "Pagar 10 SP / Desfazer a forma", como já se faz com as passivas (`comLembretesDaVez`, `passivas.ts:658-673`). Sem SP, só sobra Desfazer.
- **Troca de Parte:** a ficha e a batalha seguirem a mesma regra do Grupo (B1); a recarga dividida entre as cópias (B2); a Fúria do Dragão vira a "subida de Parte" ou um Buff com número (P1).
- **Recuperação de forças:** uma saída nova "Absorver" (0 de dano e cura de 20% do que chegava, até o máximo). E uma marca "fogo" no golpe, lida de chama, fogo, explosão ou queima: o botão só aparece contra fogo, ou pelo menos avisa.
- **Overload:** depois da Grande Fissura, pôr um selo "Overload" com metade de cada atributo até o fim da batalha. Hoje o selo não aceita porcentagem (`lib/batalha/selos.ts:419-420`).
- **Dados da ficha (com o app fechado e backup):**
  - Ação e extra OVERLOAD nas Partes 2 e 3.
  - Dano "-" nas 3 Fúrias.
  - Tirar os 6 modificadores com 0 da Parte 3 (CAR, DET, ESP, HP, INT, SP). Eles não mudam número, mas os de HP e SP fazem a Parte 3 gravar o máximo na hora de ligar (`ajusteDaFicha.ts:184-194`).
  - Gravar o HP e o SP máximos (P12).

## 5. Perguntas para o mestre (da mais importante para a menos)
- **P1. A Fúria do Dragão faz o quê?** (a) é o passo que sobe de Parte: usar a Fúria leva para a Parte seguinte (recomendo); (b) é um buff com número (quanto e por quantos turnos?); (c) é só texto e sai do menu.
- **P2. As Partes têm ordem?** Hoje ela pode ligar a Parte 3 direto no 1º turno, e cada Ativar gasta uma Completa. (a) 1 → 2 → 3, uma por vez (recomendo); (b) qualquer uma, a qualquer hora; (c) a Parte 3 só com a vida baixa (abaixo de quanto?).
- **P3. Custo por turno (10 e 20 SP):** (a) cobra no começo da vez dela, com "Pagar / Desfazer" (recomendo); (b) cobra no fim da vez; (c) fica a mão. E sem SP? (a) a forma cai (recomendo); (b) ela desce para a Parte anterior.
- **P4. A Superioridade do Ogro (−30%) vale contra o quê?** (a) tudo, menos o golpe que a ficha chama de "dano verdadeiro" (recomendo); (b) o Perfurante também passa inteiro; (c) só golpe físico. Quais técnicas da mesa são "dano verdadeiro"?
- **P5. Overload, "perde metade dos Status":** (a) metade de cada atributo até o fim da batalha (recomendo); (b) metade do HP e do SP atuais; (c) só até o fim da próxima vez dela. A metade é do total com a forma ou da ficha sem forma?
- **P6. Recuperação de forças:** vale só contra golpe de fogo ou explosão, com o mestre confirmando? Os 20% são do dano antes ou depois do −30% de Ogro (recomendo antes)? Vale contra Overload e Surpresa (hoje não dá, porque o alvo nem reage)? Ela pode comer fogo do cenário na vez dela, como Ação Simples? Fora da batalha, "recupera tudo ou grande parte" quer dizer HP e SP cheios?
- **P7. Golpe de Chifres:** o livro diz "ação bônus" numa cópia do texto e "ação simples" na outra (`lib/livroOnePiece.ts:96`); a ficha diz Ação Completa com 35 SP. Vale (a) a ficha (recomendo), (b) Bônus ou (c) Simples? E "ignorando sua defesa" é (a) pular só o Escudo, como hoje (recomendo), ou (b) o alvo nem reage?
- **P8. O +20 de dano de Ogro entra onde?** (a) só no Atacar e nas técnicas corpo a corpo que ainda não escrevem o +20; o "+20" do Chute já é ele (recomendo); (b) em toda técnica de Força, somando também no Chute; (c) em tudo. O "vai ganhando dano base" sobe quando?
- **P9. "Vantagem em combate corpo a corpo"** (aqui só o alvo rola o dado): (a) quem leva golpe corpo a corpo dela rola a reação 2 vezes e fica com a pior (recomendo); (b) ela reage com vantagem contra golpes corpo a corpo; (c) vale só nos testes, fora da batalha.
- **P10. Orgulho dos ogros.** O livro diz que eles são "incapazes de desviar, podendo somente defender", mas a ficha não lista essa desvantagem. (a) a Ryoko esquiva e contra-ataca normal, porque a ficha tirou isso (recomendo confirmar); (b) a caixa dela só oferece Defender (metade).
- **P11. "25 de Queimadura" do Chute:** (a) 25 a mais no mesmo golpe, como hoje (recomendo); (b) queimadura que tira vida por turno (quanto e por quantos turnos?). Hoje o selo do app não dá dano por turno.
- **P12. HP e SP máximos:** 700 e 240 são o máximo cheio (P7 do sistema)? Não achei no livro a conta que dá 240 de SP. A Parte 3 leva a Resistência a 46 (rank 2), o que pelo livro dá +300 de HP, mas a ficha tem a linha HP 0. (a) a forma não dá HP, fica 0 (recomendo; isso também evita o bug 9); (b) dá +300. E o Escudo 12 sobe com a Resistência da forma?
- **P13. Ao encerrar a batalha, a Forma Híbrida desliga?** Hoje ela continua ligada (decisão Q3), e a luta seguinte começa transformada e sem pagar. (a) desligar as formas que têm custo por turno (recomendo); (b) continuar ligada.

<!-- Não gravei este arquivo: sou um agente só de leitura e não tenho como escrever. O orquestrador grava este texto em C:/dev/labirinto/docs/auditoria-fichas/ryoko-d-violet.md. Ficha conferida: id pers_7479adc1 na pasta pasta_2289218d (One Piece). -->
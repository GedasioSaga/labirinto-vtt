AVISO AO ORQUESTRADOR: este agente só lê (não tem ferramenta de escrita), então o arquivo C:/dev/labirinto/docs/auditoria-fichas/guilherme.md NÃO foi gravado. O conteúdo dele é tudo o que vem abaixo da linha "---".
---
# Auditoria da ficha: Guilherme (pasta One Piece, 07/11/2026)

Só leitura: li a ficha no `rpg.json` local da pasta One Piece. Não rodei nada e não gravei nada no app. O arquivo `00-sistema.md` não existe; usei o `00-bugs-do-sistema.md` ("sistema #N" = bug N de lá, "sistema PN" = pergunta N de lá). "Leitura" = conferido no código, sem rodar.

## 1. Resumo
- Humano lanceiro e cozinheiro, 22 anos, com a Nikyu Nikyu no Mi (a pata). HP 900/1100, SP 65/200, Escudo 80. Força 90 (R3, mod +1), Espírito 100 (R3, +1), Resistência 40 (R2, +1); o resto está em 5 (R1, +0).
- Luta de lança (Giro da Lança, 10.000 Km/h) e de pata (Revigorar cura a si mesmo, Explosão drena o alvo). As 4 técnicas são Ação Completa.
- Conferi com o livro e bate: HP 1100 = 900 da Resistência R2 + 200 do Corpo Vigoroso (Evoluído); SP 200 = Espírito R3 (20+40+60+80). O máximo está gravado na ficha, então o sistema #4 não pega nele.

## 2. Habilidades
| Item | O que a ficha diz | Como o app faz hoje | Estado | Onde |
|---|---|---|---|---|
| Atacar (lança) | "Lança: +20 de Dano" (só na descrição) | Força + Dano da arma = 90 + 0, porque a "Arma do Guilherme" está com Dano "0" | automática (dado errado, bug 4) | formula.ts:86, :363-383 |
| Giro da Lança, ataque | Completa, 30 SP, Tempo 3, "Força + Dano da Arma + 20", todos a 1 quadrado | Custo, ação, recarga 3 e dano 110 saem sozinhos. Os alvos o jogador marca à mão, e o app não confere a distância. O Tempo 3 trava 2 vezes dele (sistema P1) | parcial | leituraDaFicha.ts:56, :82-104, :106; golpe.ts:161-172; turnos.ts:471-483 |
| Giro da Lança, reação | 1d20 + mod de FOR/AGI (o maior); sucesso anula; o giro continua enquanto houver SP; só contra projétil e arma | Botão na caixa REAÇÃO, com "Rolar 1d20" já marcado pelo texto; cobra 30 SP e põe recarga 3. O +1 não vem sozinho; depois do dado vale a tabela comum (10 metade, 15 esquiva, 20 contra). O giro contínuo e o "só contra projétil/arma" não existem | parcial | tiposDaHabilidade.ts:140-171; reacaoComTecnica.ts:238; CaixaDeReacao.tsx:61-64; reacao.ts:26-32 |
| 10.000 Km/h | OVERLOAD, 100 SP, "(Força + Percepção + Espirito + 100) + Dano da Arma", perfura, atordoa por 2 turnos; depois fica com "metade dos Status" | Overload (Completa, 1 por batalha, alvo sem reação), Perfurante já ligado, dano 295, selo "Atordoado 2" já marcado. O Atordoado é só um contador: o alvo continua jogando e reagindo. A metade dos Status não existe. Com SP 65 a técnica aparece apagada ("SP insuficiente"), e isso é regra, não bug | parcial | acoes.ts:236, :248-254; golpe.ts:296; leituraDaFicha.ts:134-147; selos.ts:69-99; turnos.ts:376-416 |
| Revigorar | Completa, "-50" (custa 50 SP, como nas outras fichas), 2 vezes por combate; remove debuff e cura o valor do Espírito (100); concentração X3 = Espírito x3 | Custo, ação e os 2 usos saem sozinhos. Cura e limpeza são à mão: golpe sem dano sai "sem reação" e nada muda. A carga de Concentrar é zerada sem efeito. A mira abre num inimigo (bug 3) | parcial | leituraDaFicha.ts:107; golpe.ts:293-302, :371 |
| Explosão | Completa, 40 SP, 2 vezes por combate, toca o alvo, dano de 10% da vida atual dele; o alvo faz teste de Resistência CD 10 + mod de ESP (= 11); dobra os debuffs | Custo, ação e usos saem sozinhos. O dano é sempre digitado à mão (bug 1); o alvo rola a reação comum, e não o teste (bug 5); dobrar debuffs não existe; o alcance não é conferido | parcial | formula.ts:433-445; dadosDoMenu.ts:327-328; reacao.ts:26-32 |
| Perícias (7) | Noção de Batalha, Anatomia, História Perdida, Botânica (INT); Arrombamento, Pesca, Culinária (AGI) | Só texto: o app não rola teste de perícia | não suportada | — |
| Vantagens (5) | Coragem, Homem dos Mares, Recuperação Espantosa, Corpo Vigoroso (Evoluído), Comandante Inato | Nenhum código da batalha lê a aba Vantagens (a busca só acha o editor, o livro e a IA). O +200 de HP do Corpo Vigoroso já está no máximo | à mão | livroDeRegras.ts:15-16; sistemaOnePiece.ts:104 |
| Desvantagens (5) | Trauma/Fobia, Falta de Sorte, Mal-encarado, Audição Ruim, Paranoico | Ficam com os testes e a narração do mestre | à mão | — |
| Raça (descrição) | Vantagem em Determinação; mais propenso a ataque mental; teto maior em DET/INT/CAR | Só texto | à mão | — |

Parece que travou, mas é regra: Ação Completa gasta a Simples e o Movimento (acoes.ts:130, :144). Com AGI 5 (R1) e 1 bloco por rank, ele anda 1 bloco por Movimento (acoes.ts:75-78; regrasDoCampo.ts:33). Na vez em que usa técnica, o "Mov" dele fica em 0 (o app conta, mas não trava: acoes.ts:31-32).
Caminho de uma técnica no código: campos da ficha → `leituraDaFicha.ts` (custo, ação, tempo, Overload, Perfurante) e `formula.ts` (dano) → `acoes.ts:219-256` (apagada ou não) → menu (`dadosDoMenu.ts:408-472`) → mira (`MiraDoGolpe.tsx`: dano base e alvos) → `golpe.ts:312-387` (custo, recarga, usos, Overload, quem reage) → a store aplica dano e selo (`batalhaFabrica.ts:927`). A reação com técnica passa por `CaixaDeReacao.tsx` → `TecnicasDaReacao.tsx` → `reacaoComTecnica.ts:210-239`.

## 3. Bugs
1. MÉDIA (leitura). A Explosão nunca calcula os 10% da vida, nem para o mestre. Todo chamador de `lerDano` passa `vidaDoAlvo: null` (acoes.ts:290; dadosDoMenu.ts:352, :392, :523; golpe.ts:502), e a mira só copia o número do menu (MiraDoGolpe.tsx:202). Por isso o cálculo de formula.ts:433-445 nunca recebe uma vida. O comentário de acoes.ts:261 diz "a mira relê com ele", mas ela não relê.
   Caso: o mestre usa a Explosão do Guilherme num NPC com 2.000/2.000 → a mira diz "Depende da vida do alvo: digite o dano"; o esperado era 200. O jogador não vê a vida do NPC e precisa chutar.
2. MÉDIA (leitura). O Giro usado como reação perde o modificador. O campo do Giro copia o da caixa só quando abre (TecnicasDaReacao.tsx:55) e depois manda o próprio valor (:79). O "Rolar de novo" manda o campo da caixa (CaixaDeReacao.tsx:174, :255), e o host usa o que chega (batalhaFabrica.ts:2118-2122).
   Caso A: o jogador digita +1 no Modificador da caixa → clica "Usar Giro da Lança" → rola d20 + 0. Caso B: digita +1 no campo do Giro, tira 9 (total 10), gasta um Ponto Saga em "Rolar de novo" → o dado novo sai sem o +1.
3. BAIXA (leitura). O Revigorar abre a mira com um INIMIGO marcado. Tipo vazio conta como Ativa (tiposDaHabilidade.ts:74-82); só o Buff começa marcando quem usa (:103-105); o resto marca o inimigo mais perto (MiraDoGolpe.tsx:170-173, :190-195; MenuDaVez.tsx:285-295 não passa alvo).
   Caso: Revigorar → Lançar → o registro diz "Guilherme usa Revigorar em <inimigo>: sem reação", gasta 50 SP e conta 1/2 usos; o HP dele não muda e o mestre fica sem saber em quem curar.
4. BAIXA (ficha). A lança não está cadastrada como arma: a "Arma do Guilherme" tem Dano "0", mas a descrição diz "Lança: +20 de Dano". Hoje: Atacar 90, Giro 110, 10.000 Km/h 295. Com Dano 20 ficaria 110, 130 e 315 (P6).
5. BAIXA (regra, leitura). A Explosão usa a tabela da reação no lugar do teste de Resistência (reacao.ts:26-32). Se o teste for d20 + mod contra CD 11 (P1): o alvo tira 12 → o app dá metade do dano, mas pela ficha ele passou e nada acontece; o alvo tira 10 → o app dá metade, mas pela ficha ele falhou e leva o efeito inteiro.
6. Bugs do sistema que pegam nele. #3: desfazer a "Vez" apaga a recarga do Giro usado como reação e deixa os 30 SP gastos (mesmo caminho do Passo de Valsa; não reproduzi com o Giro). P8: fechar o app do mestre zera os 2 usos de Revigorar e Explosão e libera o Overload de novo. #10: o "giro contínuo enquanto durar o SP" seria um custo por turno, que o app não cobra.

## 4. Automações propostas (da mais útil para a menos útil)
1. Dano "% da vida do alvo" (Explosão): a mira do mestre relê `lerDano` com a vida de cada alvo marcado; para o jogador, o host calcula quando recebe o golpe, sem mostrar a vida (P2).
2. Teste de Resistência do alvo (Explosão): um modo de golpe "teste", em que o alvo rola d20 + mod do atributo (rank/2, marca.ts:134-139) contra a CD lida do extra ("Cd10 + Modificador de Espirito" = 10 + mod ESP de quem usa = 11). Passou = nada acontece; falhou = efeito inteiro. O teste com CD da Marca (marca.ts:70-78) já faz metade disso (P1).
3. Cura e limpeza (Revigorar): ler "Recupera Vida igual ao <atributo>" como cura em quem usa (até o máximo) e "Remove Debuff" como tirar os selos negativos; a mira começar marcando quem usa; a carga de Concentrar multiplicar a cura (P11).
4. Reação do Giro: ler "+Modificador de Força/Agilidade (o maior)" no extra e já preencher +1; usar um campo só de modificador para a técnica e para o "Rolar de novo" (resolve o bug 2); se a resposta da P7 for (a), trocar a tabela.
5. Atordoado com efeito (vale para todas as fichas): a vez do atordoado passa sozinha, com linha no registro, e ele não ganha caixa REAÇÃO (turnos.ts:398; golpe.ts:296) (P4).
6. Cansaço do Overload: ao usar 10.000 Km/h, o app põe sozinho o selo "Cansado" com metade de cada atributo. São 8 atributos, então 2 selos de 4 mods cada (combate.ts:655), ou o "Ajustar..." (P5).
7. "Dobra os Debuffs": dobrar os turnos (ou os números) dos selos negativos do alvo pelo `seloEditado` (selos.ts:293-301), com linha no registro e Desfazer (P3).
8. Área "raio de 1 à sua volta" (Giro): a mira marca sozinha quem está a 1 bloco (medicao.ts:94) (P9).
9. Recuperação Espantosa: lembrete ao mestre quando o HP dele chega a 0, "1 vez por batalha", no molde dos lembretes das passivas (passivas.ts:29-44) (P12).
10. Na ficha (dado, não código): arma "Lança", Dano 20, categoria Branca (P6).

## 5. Perguntas para o mestre (da mais importante para a menos)
P1. Explosão: como é o "teste de Resistência" do alvo? (a) d20 + mod de Resistência do alvo contra CD 11; se passar, nada acontece; (b) a reação comum de hoje (10 metade, 15 esquiva); (c) o mestre decide na hora. Recomendo (a). Se o alvo passa, a Explosão gasta mesmo assim os 40 SP e 1 dos 2 usos? Recomendo que gaste.
P2. Explosão, 10% da vida atual: (a) a mesa calcula e o jogador vê só o dano; (b) o mestre digita sempre; (c) o jogador vê a vida do alvo. Recomendo (a). Esse dano passa pelo Escudo (hoje passa) ou vai direto no HP? Recomendo direto no HP, já que ela "remove a vitalidade".
P3. "Dobra os Debuffs que ele possui na hora": (a) dobra os turnos que faltam (Atordoado 2 vira 4); (b) dobra os números (FOR −20 vira −40); (c) duplica o selo. Vale também para condição posta à mão (Queimando) ou só para selo de técnica Debuff? Recomendo (a), para todo selo negativo.
P4. Atordoado (o "Stunna 2 turnos" do 10.000 Km/h): (a) perde a vez inteira e não reage; (b) perde a vez, mas ainda reage; (c) o mestre narra, como hoje. Recomendo (a). A resposta vale para todas as fichas.
P5. Overload, "fica cansado e com a metade dos seus Status": (a) metade dos 8 atributos até o fim da batalha; (b) também metade do HP e do SP atuais; (c) dura até o próximo descanso, fora da batalha. O Revigorar ("Remove Debuff") tira esse cansaço? Recomendo (a), e que o Revigorar não tire.
P6. A lança: (a) a arma vira "Lança" com Dano 20 (Atacar 110, Giro 130, 10.000 Km/h 315); (b) o +20 da lança é o "+ 20" que já está no Giro, e a arma fica em 0; (c) outro número. Recomendo (a), conferindo se o Giro somar o +20 de novo é de propósito.
P7. Giro como reação, "Sucesso anula o dano": (a) total 10 ou mais já anula tudo; (b) a tabela comum (10 metade, 15 esquiva, 20 contra-ataca), como hoje; (c) 15 ou mais anula e abaixo disso toma o dano inteiro. Recomendo (a). O +1 (o maior entre FOR R3 e AGI R1) deve entrar sozinho? Recomendo que sim.
P8. "Manter o giro como uma ação contínua enquanto durar o SP": (a) o giro fica ligado, cobra 30 SP no começo de cada vez dele (como lembrete, no molde da Fortaleza), e a recarga 3 só começa quando ele para; (b) vale só até o fim da rodada; (c) ignorar, porque o Tempo 3 já trava. Recomendo (a).
P9. Giro, "todos os alvos a 1 quadrado": (a) só inimigos, marcados sozinhos; (b) todo mundo a 1 quadrado, aliados também; (c) o jogador escolhe, como hoje. Recomendo (a).
P10. Giro como defesa "de projéteis ou de ataques com armas": (a) o app só oferece o Giro quando o golpe usa arma ou bala; (b) oferece sempre e o mestre veta, como hoje. Recomendo (b): o app não sabe se a técnica do NPC usa arma.
P11. Revigorar: (a) só em si mesmo; (b) em si ou num aliado que ele toque. "Restaura um pouco da resistência" devolve Escudo ou SP, ou é só texto? Com 1 e 2 concentrações a cura fica ×1,5 e ×2 (como o dano) e com 3 fica ×3? Recomendo (a), que seja só texto, e que sim.
P12. Recuperação Espantosa: (a) o app só lembra quando ele cai ("1 vez por batalha") e o mestre digita os turnos e o HP; (b) um número fixo (quantos turnos caído e quanto HP). Recomendo (a).
P13. Comandante Inato, "escolher a ordem dos companheiros": (a) o mestre arruma a ordem como o jogador pedir, como hoje; (b) o jogador arruma a ordem dos aliados e o mestre aprova. Recomendo (a).
P14. Homem dos Mares (no mar: vantagem em teste de Resistência, acerto e dano): aqui quem rola é o alvo, então o que vira a "vantagem no acerto"? (a) o alvo reage com desvantagem; (b) fica só no texto e o mestre aplica. Recomendo (b) por enquanto.

## Pontas soltas
- Não rodei nada: tudo vem da leitura do código e do `rpg.json` local. Não conferi a cópia publicada no Lobby nem o Treino do Lobby (`lib/treino/`), que lê técnicas por outro caminho (tecnicaDeTreino.ts:125).
- Não segui o pedido de reação do jogador no host (`net/batalhaNoHost.ts`). O bug 2 é da tela e vale igual no mestre e no jogador.
- O histórico da ficha mostra a Agilidade indo de 5 até 25 e voltando a 5, e o SP descendo à mão (−42, −58, −26, −9, que não batem com nenhum custo). Não dá para saber o que o jogador estava tentando.
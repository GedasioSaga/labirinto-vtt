Arquivo NÃO gravado: este agente é só leitura e não tem ferramenta de escrita. O texto abaixo é o aira.md pronto para salvar em C:/dev/labirinto/docs/auditoria-fichas/aira.md.

# Aira (One Piece): auditoria da ficha (07/11/2026)

Só leitura. A ficha foi lida de `%APPDATA%/com.labirinto.app/pastas/<pasta One Piece>/rpg.json`; nada foi gravado. Prova = LEITURA: segui o código passo a passo com o texto real da ficha. Não rodei o app nem testes. "Suspeita" = não deu para provar, virou pergunta. Os caminhos partem de `client/src/`.

## 1. Resumo
- Mink (raposa), artista, de suporte. HP 900 (sem máximo gravado), SP 140/140, Escudo 100. Espírito 40 (rank 2), Carisma 55 (rank 3), Agilidade 34 (rank 2), Força 1. Não tem arma nem transformação.
- Como ela joga: dá a "Bênção de uma Raposa" a um aliado, atordoa com a dança juntando Concentração e fecha com A Luz do Sol (dano mais a bênção em todos os aliados).
- O app lê custo, ação, tempo e dano das 3 técnicas (a Saúde dá 100% lido, `lib/livros/saude.ts:118-207`), mas quase nenhum efeito: a dança zera a Concentração, a bênção vira um selo vazio e o selo da Luz do Sol cai no inimigo.

## 2. Habilidades: o que a ficha diz e o que o app faz hoje
| Item | A ficha diz | Hoje no app | Onde |
|---|---|---|---|
| A Virtude Traz Benção: uso | 35 SP, Completa, Tempo 1, Tipo Buff | AUTOMÁTICA: cobra, gasta Simples + Mov, sem reação, pode repetir toda vez | `lib/batalha/leituraDaFicha.ts:56-125`, `tiposDaHabilidade.ts:97-100`, `turnos.ts:471-483` |
| Bênção: em quem e até quando | "o Aliado", "enquanto o buff estiver ativo" | PARCIAL: a mira abre marcada na própria Aira; selo "A Virtude Traz Benção" sem número, até o mestre tirar | `components/batalha/MiraDoGolpe.tsx:183-196`, `lib/batalha/selos.ts:445-451` |
| Bênção: Status Físicos +1,2x Espírito (48) | "único" | À MÃO: a mira tem linhas atributo/delta, mas a leitura não entende "1,2x do Espírito" | `components/batalha/dadosDoMenu.ts:468-470`, `selos.ts:412-437` |
| Bênção: aliado cura 10% do dano que causa | | NÃO SUPORTADA (o app não tem roubo de vida) | |
| Bênção: ataque básico vira 3 golpes de 0,3x Espírito (12), alcance 1 + rank de Espírito (3), queimadura +10 | | NÃO SUPORTADA: o Atacar sugere Força = 1; mesmo alvo 2 vezes é recusado; o app não confere alcance nem dá dano por turno | `lib/batalha/formula.ts:84-87,207-212`, `golpe.ts:164` |
| Em Meio às Alegres Nuvens: uso | 15 SP, Completa, Tempo 1, Debuff | AUTOMÁTICA: pede reação mesmo sem dano | `tiposDaHabilidade.ts:97-100`, `golpe.ts:293-301` |
| Nuvens: falhou = "Distraído" (Atordoado) | não diz a duração | QUEBRADA: "Atordoado" até alguém tirar; não tira a vez nem a reação do alvo | `selos.ts:73,445-451`, `stores/batalhaFabrica.ts:1573` |
| Nuvens: Teste de Espírito do alvo, CD 12 + modificador de Carisma | | NÃO SUPORTADA: vira a reação de sempre (10 = metade, 15 = esquiva, 20 = contra) | `lib/batalha/reacao.ts:20-32` |
| Nuvens: dá +1 Concentração; com 3, atordoa sem teste | extra "Concentração:" | QUEBRADA: a técnica ZERA a carga; só o botão Concentrar soma carga | `golpe.ts:319-328,370-371` |
| Nuvens: "golpe de oportunidade" | | NÃO SUPORTADA | |
| A Luz do Sol: uso e dano | 25 SP, Completa, Tempo 2, sem Tipo, "40 de dano base + Espirito" | AUTOMÁTICA: 40 + 40 = 80; com carga x1,5 / x2 / x3,5 | `formula.ts:348-355,409-430`, `reacao.ts:61-65` |
| Luz do Sol: aliados com a Bênção por 1 turno (+1 turno por Concentração) | | QUEBRADA: o selo "A Luz do Sol Brilha Sobr 1" vai no INIMIGO | `selos.ts:69,92-119`, `MiraDoGolpe.tsx:216-217` |
| Luz do Sol: extra Imbuir Eletricidade (+20 de dano, 10 SP) | | À MÃO: o extra aparece só como texto; a mira não deixa somar os 10 SP | `dadosDoMenu.ts:219-224`, `MiraDoGolpe.tsx:550-554` |
| Raça Mink (descrição): Electro +20, furtividade, rastrear, teto maior de Agilidade; forma Sulong no livro | | NÃO SUPORTADA: o app não lê a descrição; a ficha não tem a forma Sulong | `lib/livroOnePiece.ts:102` |
| Fraqueza da raça: moeda, Teste de Espírito CD 15 | | À MÃO (fora da batalha) | |
| Perícias (4), Vantagens (4), Desvantagens (4) | vantagem ou desvantagem em testes | SÓ TEXTO: a batalha não lê essas abas (`rg` sem uso em `lib/batalha/`, `stores/`, `components/batalha/`) | |
| HP 900 sem máximo gravado | | QUEBRADA: bug 4 do sistema | `docs/auditoria-fichas/00-bugs-do-sistema.md` |

Conferi e está certo: custo, ação, recarga e o dano 80 são lidos certo; o Buff não pede reação; a raça "Mink (Raposa)", que não está na lista, não se perde ao editar (`components/FichaDePersonagem.tsx:128`).

## 3. Bugs
**B1. ALTA (vale para o sistema todo). A Concentração some e nunca nasce da dança.**
- Onde: `lib/batalha/golpe.ts:370-371` zera a carga em todo Atacar ou Técnica, com dano ou sem. Só o Concentrar soma carga (`golpe.ts:319-328`). A carga só multiplica dano (`reacao.ts:61-65`, `combate.ts:630-632`) e nunca tira a reação do alvo (`golpe.ts:293-301`).
- Caso 1: com carga 0, a Aira dança. A carga continua 0; pela ficha seria 1.
- Caso 2: Concentrar nas rodadas 1 e 2; na rodada 3, Concentrar de novo (a 3ª é de graça, `acoes.ts:307-309`) e dançar. A carga vai a 0 e o alvo ainda rola reação. Pela ficha, ele seria atordoado sem teste.
- À mão só com volta: a dança (Completa) gasta a Simples (`acoes.ts:143-144`), e o Concentrar precisa de Simples ou Bônus (`acoes.ts:316-321`). Bônus só existe se o mestre der em Ações extras (`acoes.ts:88`).
- O livro diz que cada concentração tem efeito próprio, conforme o que se concentra: no exemplo 1, 3 concentrações = acerto garantido (`lib/livroOnePiece.ts:36`). O app só faz o exemplo 2 (dano 1,5 / 2 / 3,5).

**B2. MÉDIA. A Luz do Sol põe o selo da bênção no inimigo.**
- Onde: o cartão não tem Tipo, então o app deduz "Ativa" (`tiposDaHabilidade.ts:78`). Ele lê "Durante 1 turno" na Descrição (`selos.ts:69,92-99,113-119`) e dá ao selo o nome da técnica cortado em 24 letras (`selos.ts:108`, `combate.ts:647`). A mira já abre com esse selo marcado (`MiraDoGolpe.tsx:216-217`), e a store o põe em cada alvo atingido (`stores/batalhaFabrica.ts:926-930,1614-1618,2154-2158`). O robô da Arena faz igual (`lib/treino/robo.ts:194-198,221`).
- Caso: a Aira usa a Luz do Sol no inimigo X e X tira 12 (metade). Visto: X toma 40 e ganha a pílula "A Luz do Sol Brilha Sobr 1"; nenhum aliado ganha nada. Esperado: a bênção vai para os aliados.

**B3. MÉDIA. O Atordoado da dança nunca acaba e não faz nada.**
- Onde: um Debuff sem "por N turnos" vira selo "até tirar" (`selos.ts:445-451`; o nome "Atordoado" sai do Efeito, `selos.ts:73`). Só o mestre tira selo (`components/batalha/BatalhaDoMestre.tsx:563-564`). Nenhum código lê o nome do selo; o único "não reage" é para invocado ou reação já gasta (`stores/batalhaFabrica.ts:1573`).
- Caso: a Aira dança em X e X tira 12. "Atordoado" fica até o fim da luta, e X joga e reage normal. Dançar de novo empilha outro "Atordoado".

**B4. MÉDIA (vale para todo Debuff). A defesa contra a dança é a esquiva, não o Teste de Espírito.**
- Onde: o Debuff sempre pede reação (`tiposDaHabilidade.ts:97-100`). A caixa rola d20 + o modificador digitado da última vez (`components/batalha/CaixaDeReacao.tsx:61-63`) contra 10/15/20 fixos (`reacao.ts:20-32`). O selo pega com "metade" (`selos.ts:182-184`), e 20 ou mais dá contra-ataque ao alvo (`stores/batalhaFabrica.ts:2159-2163`).
- Caso: a CD pela ficha é 12 + Carisma; com a regra de teste do app (+1 a cada 2 ranks, `lib/batalha/marca.ts:125-139`) dá 13. Alvo com total 14: pela ficha resiste; no app fica Atordoado. Total 20: pela ficha resiste; no app resiste e ainda ganha uma ação contra uma dança que não dá dano. Cada dança também fica esperando resposta e conta no teto de 20 do bug 2 do sistema.

**B5. MÉDIA (sistema). A bênção não acaba, empilha no mesmo aliado e, com 8 selos, falha calada.**
- Onde: Buff sem duração fica até alguém tirar (`selos.ts:445-451`), e o Tempo 1 deixa repetir toda vez (`turnos.ts:471-483`). `comSeloNovo` não confere se a mesma técnica já marcou a ficha (`selos.ts:147-151`), e o bônus soma todos os selos (`selos.ts:214-227`). Com 8 selos na ficha (`combate.ts:651`) ele devolve `null`: o golpe segue sem selo e sem aviso, com o SP já cobrado (`stores/batalhaFabrica.ts:1590-1593,1614-1618`). A linha do registro não fala de selo (`golpe.ts:612-626`).
- Caso: a Aira abençoa o Alexei 3 rodadas seguidas, digitando "FOR +48" cada vez: ele fica com FOR +144. Na 9ª vez (já com 8 selos nele) saem 35 SP, não entra selo nenhum e nada avisa.

**B6. BAIXA. O Atacar sugere 1 e não deixa "3 golpes no mesmo".** Sem arma, o Atacar usa só a Força (`formula.ts:84-87,207-212`), que é 1. O mesmo alvo duas vezes dá "Alvo repetido" (`golpe.ts:164`). Com a bênção, só dá digitando 36 num alvo, com uma reação só. Na Arena, o robô usa só a Luz do Sol e o Atacar de 1: ele pula Buff e técnica sem dano (`robo.ts:143-154`).

**B7. BAIXA.** A mira da Bênção abre marcada na própria Aira (`MiraDoGolpe.tsx:183-196`), mas a ficha diz "o Aliado". Quem lança direto dá a bênção a ela mesma.

**B8. Suspeita (texto da ficha).** Na Luz do Sol, a Descrição diz "100% do espírito" (40) e o campo Dano diz "40 de dano base + Espirito" (80). O app usa o campo (P6).

**B9.** HP sem máximo gravado (bug 4 do sistema). Pelo livro, Resistência 50 = rank 2 = 300 + 300 + 300 = 900 HP (`lib/livroOnePiece.ts:30`), igual ao HP atual (P12).

## 4. Automações propostas
- A1 (B1, P1). Extra novo "Concentração" com 3 jeitos: "ganha 1" (soma 1 e não zera); "com 3, sem teste" (o alvo não reage e o selo pega; depois zera); "duração +1 por carga" (o selo ganha turnos e o dano não multiplica). No motor, mexe em `golpe.ts:370-371` (zerar só quando a técnica usa a carga), `golpe.ts:293-301` e `selos.ts`. Sem o extra, fica como hoje.
- A2 (B4, P3). Extra "Teste: Espírito CD 12 + Carisma". A caixa do alvo vira Teste de Espírito com o modificador pelo rank (já existe para a marca do Vincent: `marca.ts:70-78,134-139`). Passou = sem selo e sem contra-ataque.
- A3 (B3, P2). "Atordoado" deixa o alvo sem reação enquanto durar (o gancho já existe em `stores/batalhaFabrica.ts:1573`) e, conforme a P2, ele perde a vez ou o selo sai ao tomar dano. Debuff sem duração escrita passa a abrir com 1 turno, editável.
- A4 (B5, P4, P5). Ensinar `lerMods` a ler "1,2x do Espírito" com a ficha de quem usa; a conta de dano já lê "0,3 x Espírito" (`formula.ts:280-295`), mas falha no "do". Daria FOR/AGI/PER/RES +48, que cabe no teto de 4 linhas (`combate.ts:655`). Usar de novo troca o selo da mesma técnica em vez de empilhar, e selo que não cabe avisa na linha.
- A5 (B2). Extra "Selo nos aliados: Bênção de uma Raposa": o selo vai para toda a equipe da Aira, com 1 turno + a carga (A1), e não para o alvo. Na ficha, pôr Tipo "Ativa" na Luz do Sol.
- A6 (B6, P8). No cartão da Bênção, extra "Ataque básico com a Bênção: 3 x (0,3 x Espírito)". O Atacar da Aira usa isso enquanto algum aliado tiver o selo; pode repetir o alvo, e cada acerto tem reação própria e queimadura (P9).
- A7 (P7). Sem código, já hoje: criar um cartão Passiva "Electro (Mink)" com Efeito "+20 de dano". Ativar põe "+20 (Electro)" em todo dano dela, inclusive o Atacar (`passivas.ts:264-270`, `formula.ts:510-515`, `dadosDoMenu.ts:523`). Se custar 10 SP por golpe, precisa de um botão "Imbuir (+20, -10 SP)" na mira.
- A8 (P4, P9). Selos novos: "vida por dano 10%" (cura quem bateu, com Desfazer) e "dano por turno 10" (lembrete com Aplicar no começo da vez do alvo, como a Fortaleza: `passivas.ts:301-312`). A cura depende do máximo gravado (bug 4).

## 5. Perguntas para o mestre (da mais importante para a menos)
- P1. A "Concentração" da Aira é a mesma carga do botão Concentrar (0 a 3)? (a) Sim. A dança soma 1 sem gastar ação e não zera; com 3, a dança atordoa sem teste e zera; na Luz do Sol cada carga vale +1 turno de bênção e não multiplica o dano. **Recomendo**, porque o livro diz que cada concentração tem efeito próprio. (b) Sim, e na Luz do Sol vale os dois: turno a mais e dano x1,5 / x2 / x3,5. (c) Não, é um contador só dela, à parte.
- P2. O "Distraído" (Atordoado) da dança dura quanto e faz o quê? (a) 1d4 turnos ou até tomar dano, como o Distraído do Mink no livro; o 1º golpe nele vem sem reação (o "golpe de oportunidade") e acaba o selo. **Recomendo**, é a mesma palavra do livro. (b) 1 turno do alvo, que perde a vez e não reage. (c) Só um aviso na carta; o mestre decide.
- P3. Como o alvo se defende da dança? (a) Teste de Espírito contra CD 12 + modificador de Carisma da Aira (+1 a cada 2 ranks: hoje CD 13); se passar, nada acontece e não há contra-ataque. **Recomendo**. (b) CD 12 + rank de Carisma (hoje 15). (c) A reação de sempre, como hoje.
- P4. A Bênção: (a) um aliado por vez; usar de novo passa a bênção para o novo; dura até o fim da batalha ou até a Aira cair. **Recomendo** ("o Aliado"). (b) Vários aliados ao mesmo tempo. (c) Dura N turnos (quantos?). E a Aira pode abençoar a si mesma?
- P5. "Status Físicos único 1,2x Espírito": (a) +48 em Força, Agilidade, Percepção e Resistência (os físicos do livro), sem somar ao repetir. **Recomendo**. (b) +48 num físico que o aliado escolhe. (c) +48 só na Força.
- P6. Dano da Luz do Sol: (a) 80, o campo Dano, e corrigir a Descrição. **Recomendo**, é o campo que a batalha lê. (b) 40, como na Descrição. E a bênção nos aliados vale mesmo se o inimigo esquivar? Recomendo que sim.
- P7. Electro e Imbuir Eletricidade: (a) em qualquer golpe, quando ela quiser: +20 de dano e -10 SP. **Recomendo** (a raça diz "pode", a técnica diz "gasta 10 SP"). (b) Sempre ligado e de graça. (c) Só na Luz do Sol.
- P8. Ataque básico com a Bênção: (a) 3 golpes de 12, cada um com sua reação, podendo repetir o alvo. **Recomendo**. (b) Um golpe de 36 por alvo, com uma reação. E o alcance "1 + rank de Espírito" (hoje 3) é em casas?
- P9. "Causarão queimadura + 10": (a) selo Queimando que tira 10 no começo da vez do alvo, por 1 turno, renovado a cada acerto. **Recomendo**, é o menor que bate com o texto. (b) +10 de dano na hora, sem selo. (c) Queimando 10 por turno até o mestre tirar.
- P10. Tempo 1 (Bênção e dança): (a) pode repetir toda vez, como hoje. (b) Uma vez sim, uma não. Decidir junto com a P1 do sistema: com (a) aqui e a P1(a) acima, a dança atordoa sem teste da 4ª vez em diante.
- P11. Sulong (lua cheia, no livro): (a) ela ainda não tem, fica de fora. **Recomendo** até haver números. (b) Tem: quanto de Força, Agilidade e dano elétrico?
- P12. HP máximo: (a) 900, Resistência rank 2 no livro. **Recomendo**. (b) Outro número.
- P13. A moeda: (a) a regra do livro: Teste de Espírito CD 15; se falhar, Distraído por 1d4 turnos ou até tomar dano. **Recomendo**. (b) Só o texto da ficha, e o mestre narra.

## 6. O que não cobri
- Nada foi rodado: os casos são o código seguido com a ficha real, não números vistos na tela.
- Não conferi a tela do jogador (`player/`, `lib/batalha/vistaDoJogador.ts`), o protocolo (`net/`), o Lobby nem a Arena multijogador. Imagino que usem o mesmo motor, mas não confirmei.
- O "Tempo 1 = toda vez" vem do teste da P1 do sistema; não testei de novo para a Aira.
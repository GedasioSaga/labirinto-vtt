<!-- Este é o texto para gravar em C:/dev/labirinto/docs/auditoria-fichas/siegfried.md. Eu sou só leitura e não gravei o arquivo: o orquestrador grava e commita. -->
# Siegfried: auditoria da ficha (07/11/2026)

**De onde veio:** a ficha real da pasta One Piece (`%APPDATA%/com.labirinto.app/pastas/<One Piece>/rpg.json`). Li sem gravar nada no app nem no appData.

**Sobre o 00-sistema.md:** esse arquivo não existe. No lugar dele usei o `00-bugs-do-sistema.md`.

**Como provei:** tudo foi por **leitura** do código. Não rodei o app nem as funções. Quando o texto da ficha deixa dúvida, marquei como "suspeita" e virou pergunta.

**Caminhos:** são relativos a `C:/dev/labirinto/client/src/`.

**Números da ficha hoje:** FOR 46, AGI 33, ESP 35, PER 0, HP 900, SP 140, Escudo 80, nenhuma forma ligada.

## 1. Resumo
Lunariano (sem asas), Gatuno e cego. Luta com 5 armas brancas, e cada técnica tem o nome de uma delas, mais fogo.
O jeito dele lutar: Melodia (passiva da rodada 3), CAÇA AS BRUXAS! que evolui para a SUPER (Overload), o combo Orquídea → Florescer e as formas Ignição/Resiliente.
Das 11 habilidades: 2 saem certas sozinhas (CAÇA e SUPER, sem os extras), 5 saem com número ou selo errado e 4 dependem do mestre. Vantagens e desvantagens não entram na batalha.

## 2. Habilidades: o que a ficha diz e o que o app faz hoje
Legenda: AUTO = o app faz sozinho; PARCIAL = faz uma parte; MÃO = só o mestre faz; ERRADA = o app faz diferente da ficha; NÃO = não existe no app.

| Item | A ficha diz | O app hoje | Onde |
|---|---|---|---|
| Melodia (Passiva) | rodada 3; escolhe 1 oponente: +20 de precisão contra ele OU (opção) +1 no dado de reação; 15 SP; 1 vez | PARCIAL: lembra na virada para a rodada 3, cobra 15 SP, conta 1 uso, mostra as 2 opções e põe um selo dourado no oponente. +20 de precisão: NÃO (o app não tem precisão, só o d20 de quem reage). +1: ERRADA (bug 5) | `lib/batalha/passivas.ts:74-79`, `:231-237`, `:430`; `lib/batalha/escolhaEEvolucao.ts:44`, `:146`; `lib/batalha/reacao.ts:26-32` |
| CAÇA AS BRUXAS! | ESP + 15 + 20 de fogo; 35 SP; Tempo 4; Completa; até 10 quadrados; Embuir Fogo; evolui (Melodia ativa + "caminho do dano"; 50 SP ou ajuda de fogo) | AUTO: "35 Espírito + 15 + 20 fogo = 70", cobra 35 SP, recarga 4. Evoluir: botão com custo digitado, mas a condição NÃO é conferida. Alcance e +10 de fogo: NÃO | `lib/batalha/formula.ts:409-430`; `lib/batalha/escolhaEEvolucao.ts:21-26`, `:382` |
| SUPER CAÇA AS BRUXAS! | (FOR + ESP) + 100 + 30 de fogo; Overload; perfurante; 1 vez; perde metade dos status | AUTO: 211, sem reação, Perfurante ligado, 1 vez por batalha, apagada até Evoluir. Metade dos status e fadiga: NÃO | `lib/batalha/golpe.ts:296`; `lib/batalha/acoes.ts:236`; `lib/batalha/leituraDaFicha.ts:134-147` |
| Imperador das Armas (Passiva) | 3 armas por sessão; trocar de arma custa Ação Completa; 1 técnica por arma | MÃO: a ficha não tem "Armas por batalha", então não há limite; não existe "arma em mão" nem troca; a tira mostra "Ao segurar uma arma…" e o Ativar só põe um selo sem efeito | `lib/batalha/leituraDaFicha.ts:320-327`; `lib/batalha/passivas.ts:91`, `:163-165` |
| Balmung: Lua Incandescente | (FOR + 20) + arma; 30 SP; Tempo 3; Simples; até 3 alvos em linha; dano dividido | ERRADA: 71 cheio em CADA alvo, e aceita até 12 alvos (bug 1) | `components/batalha/MiraDoGolpe.tsx:256-260`, `:274-282`; `lib/batalha/combate.ts:619` |
| Gram: Alvorada | (FOR + 10) + arma; 20 SP; Tempo 2; Simples; joga para cima; queimadura | ERRADA: usa a Balmung (61, o certo é 64); não sugere selo de queimadura | `components/batalha/BatalhaDoJogador.tsx:189`; `lib/batalha/selos.ts:113-119` |
| Gilgamesh: Entardecer (Debuff) | (FOR + 25) + arma; 35 SP; Tempo 4; Completa; atordoa 1 turno (CD 12) | ERRADA: 76 com a Balmung (o certo é 79); selo "Atordoado" sem turnos; o teste CD 12 não existe | `lib/batalha/selos.ts:69`, `:102-110` |
| Yamato: Julgamento: Crepúsculo (Debuff) | (FOR + ESP + 15) + arma; 60 SP; Tempo 5; Completa; sangra 10 por 2 turnos do alvo | PARCIAL: 101 (sai certo porque a Balmung também tem 5); selo "Sangrando" sem turnos; os 10 por turno: NÃO | `lib/batalha/selos.ts:69`, `:246-259` |
| Apunhaladora: Orquídea (Debuff) | redoma: Cego + Imobilizado; 30 de fogo SE o alvo tentar atacar ou sair; 45 SP; Tempo 3; Completa | ERRADA (suspeita): dá 30 de dano na hora; só põe o selo "Cego", sem turnos, e o "Imobilizado" se perde | `lib/batalha/formula.ts:536`; `lib/batalha/golpe.ts:295`, `:358-359` |
| Orquídea: Florescer | 3 × (FOR + AGI + arma) + 50; 30 SP; Tempo 4; Bônus; perfurante crítico; só em alvo dentro da redoma; consome a redoma | MÃO: como é Bônus, fica apagada "só quando o mestre dá" (bug 2); 302 com Perfurante ligado; o requisito e o "consome" NÃO são feitos | `lib/batalha/acoes.ts:88`, `:185` |
| Chamas Celenas (Debuff) | custa 10% do HP; 1 vez; Completa; alvo −15 SP/turno e Sieg +10 SP/turno; alvo sem SP = desvantagem na reação; 3% do HP/turno | PARCIAL: o custo vira pergunta (sugere 10% do HP ATUAL) e conta 1 uso; não tem dano, mas o alvo reage mesmo assim; dreno, ganho, desvantagem e os 3%: NÃO | `lib/batalha/leituraDaFicha.ts:58`, `:69-75`; `lib/batalha/tiposDaHabilidade.ts:97-100` |
| Ignição (forma, Livre, grupo Lunariano) | +2 quadrados; +1 ataque por rodada ao Atacar; 2 vezes por batalha; até 1,2x de velocidade; sem Controle do Fogo | AUTO: liga sem gastar ação, +2 casas por Movimento, +1 ataque por rodada, troca com o Resiliente. O "2 vezes" conta quantas vezes LIGA (bug 8). 1,2x: NÃO. Controle do Fogo continua liberado (decidido) | `lib/batalha/transformacao.ts:49-66`, `:131-142`, `:159-168`; `lib/batalha/acoes.ts:75-104` |
| Resiliente (forma, Livre) | −20% de dano; no máximo 6 quadrados; lâmina e bala não perfuram; só dura enquanto tiver resistência | AUTO: −20% (também no "Dar dano" do mestre) e máximo de 6 na vez. "Não perfura" e "resistência": só texto | `lib/batalha/transformacao.ts:100-124`, `:143-156`; `stores/batalhaFabrica.ts:874-879`, `:2195-2198` |
| Armas (5, Branca) | Balmung 5, Gram 8, Gilgamesh 8, Yamato 5, Apunhaladora 5 (3x em ataque furtivo) | AUTO no Atacar: FOR + arma (51/54/54/51/51). O 3x furtivo: NÃO (a Surpresa dá ×1,5) | `lib/batalha/formula.ts:547-550`; `lib/batalha/reacao.ts:61-65` |
| Raça Lunariano | imbuir fogo dá +10 de dano (5 técnicas têm "Embuir Fogo: Sim") | NÃO: nada em `lib/batalha` lê "embuir" ou "imbuir" | — |
| Vantagens | Preparação para a Batalha (+N no status principal por 2 turnos), Recuperação Espantosa (levanta 1 vez), Comandante Inato, Audição e Faro | MÃO: a batalha só lê a aba Habilidades e as técnicas da forma ligada | `lib/batalha/leituraDaFicha.ts:176-186` |
| Desvantagens | Doença das Trevas (−3% do HP total no fim da vez em que andou ou atacou), Cego, Coração Mole, Rosto Debochado, Amnésia, Má Fama… | MÃO, pelo mesmo motivo | idem |
| Perícias | Arrombamento diz "Força e/ou Percepção", mas só a Percepção está marcada | dado da ficha: Percepção 0 (ele é Cego), então o teste sai com 0 | ficha |

## 3. Bugs (do mais grave para o menos grave)
1. **ALTA · A Lua Incandescente não divide o dano.**
   - Onde: a mira dá a mesma base a cada alvo marcado (`components/batalha/MiraDoGolpe.tsx:256-260`, `:274-282`) e aceita até 12 alvos (`lib/batalha/combate.ts:619`).
   - Caso que falha: marcar 3 inimigos → 71 em cada, 213 no total. A ficha diz no máximo 3 e dano dividido (23 em cada). Prova: leitura.
2. **ALTA (regra) · A Florescer não sai sem o mestre.**
   - Onde: Ação "Bonus" só cabe quando o mestre dá a Bônus (`lib/batalha/acoes.ts:88`, `:185`; decisão 8 da F2).
   - Caso que falha: na vez do Sieg, a Orquídea acerta → a Florescer fica apagada com "Ação bônus: só quando o mestre dá". Para o jogador, parece que "a habilidade não funciona". Prova: leitura. Vira a P3.
3. **MÉDIA · Toda técnica usa a 1ª arma levada.**
   - Onde: `components/batalha/BatalhaDoJogador.tsx:189` e `components/batalha/BatalhaDoMestre.tsx:426` passam `armasNaBatalha(...)[0]` para todas as técnicas (`components/batalha/dadosDoMenu.ts:431` → `MiraDoGolpe.tsx:102`).
   - Caso que falha: a Gram: Alvorada mostra "(46 Força + 10) + 5 Balmung = 61" (o certo é 64); a Entardecer dá 76 (o certo é 79). Se ele levar Gram, Gilgamesh e Yamato, a Lua sai 74 e a Florescer 311, as duas com a Gram. Prova: leitura. Vira a P1.
4. **MÉDIA (suspeita) · A Orquídea dá 30 de dano na hora.**
   - Onde: o campo Dano "30" vira dano do golpe (`lib/batalha/formula.ts:536`, `lib/batalha/golpe.ts:295`).
   - Por que é suspeita: o Efeito diz que os 30 só vêm se o alvo tentar atacar ou sair da redoma. Vira a P4.
5. **MÉDIA · A opção "Dado de reação" da Melodia dá +1 ao inimigo.**
   - Onde: o alvo "oponente" sai só do Efeito principal (`lib/batalha/passivas.ts:234-237`). Trocar a opção não muda o alvo (`components/batalha/PassivasDaBatalha.tsx:291-301`), e a tela pede o oponente (`:315-316`). O selo "Reação +1" vai para ele (`stores/batalhaFabrica.ts:1166-1170`), e o bônus é de quem tem o selo (`BatalhaDoMestre.tsx:300-302`, `BatalhaDoJogador.tsx:104-107`).
   - Caso que falha: Ativar → escolhe "Dado de reação" → escolhe o inimigo, como a tela pede → a reação do inimigo começa com +1 e a do Sieg não muda. Prova: leitura.
6. **MÉDIA · Selos sem duração, e pela metade.**
   - Onde: `lib/batalha/selos.ts:69` só entende "por N turnos" ou "durante N turnos".
   - Casos que falham:
     - Entardecer ("de 1 turno") → "Atordoado" que só sai quando alguém tira.
     - Crepúsculo ("pelos próximos 2 turnos") → "Sangrando" que só sai quando alguém tira.
     - Orquídea → "Cego" que só sai quando alguém tira. O "Imobilizado" some, porque o app lê 1 nome (`selos.ts:102-110`) e põe 1 selo por golpe (`golpe.ts:358-359`).
   - Além disso, selo não tira a vez de ninguém nem faz dano por turno. Ele só soma em atributo, dano ou reação (`selos.ts:246-259`). Prova: leitura.
7. **MÉDIA · O furtivo conta duas vezes.**
   - Onde: a Surpresa junta "sem reação" e ×1,5 no mesmo botão (`lib/batalha/reacao.ts:61-65`; `MiraDoGolpe.tsx:248-249`).
   - Caso que falha: Florescer furtiva (sem reação) = 302 → 453, com o ×1,5 por cima do 3× da fórmula. Atacar furtivo com a Apunhaladora = (46 + 5) × 1,5 = 76, e não 3×. Prova: leitura. Vira a P8.
8. **BAIXA (suspeita) · O "2 vezes" da Ignição está no lugar errado.**
   - Onde: o app conta quantas vezes a forma liga (`lib/batalha/transformacao.ts:54-66`, `stores/batalhaFabrica.ts:1033-1039`). O ataque adicional só tem limite por rodada (`lib/batalha/acoes.ts:91-104`).
   - Por que é suspeita: no livro (`lib/livroOnePiece.ts:90`), a frase "pode ser usada 2 vezes por batalha" fecha o item do ataque adicional, e o "Corpo Forjado" diz que trocar de modo é ação livre.
   - Caso que falha: ligada por 5 rodadas = 5 ataques adicionais; ligar pela 3ª vez = recusado. Vira a P7.
9. **BAIXA (é de propósito) · Depois de Evoluir, a CAÇA some pelo resto da luta.**
   - Onde: `lib/batalha/escolhaEEvolucao.ts:332-334` é conferido antes do Overload (`acoes.ts:234-236`).
   - Caso: Evoluir → usa a SUPER → o resto da luta sem a CAÇA e sem a SUPER. Vira a P13.
10. **BAIXA · O "10% do HP" sugere 10% do HP atual.**
    - Onde: `lib/batalha/leituraDaFicha.ts:74-75`.
    - Caso: com 300/900 de HP, sugere 30 e não 90. Vira a P16.
11. **Dados da ficha:**
    - Sem HP e SP máximos gravados (bug 4 do sistema: editar o HP atual baixa o máximo junto).
    - Sem "Armas por batalha", embora o Imperador diga 3.
    - Arrombamento só com a Percepção, que é 0.

**Bugs do sistema que também pegam o Sieg:**
- Bug 3: o Desfazer da Vez mexe nas recargas das técnicas dele.
- P8: fechar o app zera os 2 usos da Ignição, o Overload, a Melodia, a Chamas Celenas e a evolução.
- Bug 2: a Chamas Celenas não tem dano, mas também fica esperando reação.
- P5: o "Dar dano" com o Resiliente ligado.

## 4. Automações propostas (o que o app precisaria entender)
1. **Arma da técnica pelo nome:** "Gram: Alvorada" usa a Gram. O app casa o começo do nome com a aba Armas, sem acento, e o menu passa uma arma por técnica, não uma só para todas. Se a P1 for (b): guardar a "arma em mão" no combate e ter um "Trocar de arma" que gasta Ação Completa.
2. **Área com dano dividido:** um extra "Alvos: até 3, dividido" faz a mira dividir a base pelos alvos marcados (arredondando para baixo) e parar em 3.
3. **Duração:** entender também "de N turno(s)" e "pelos/nos próximos N turnos" (`selos.ts:69`), e permitir mais de um selo por técnica (Cego + Preso).
4. **Selo com dano por turno:** por exemplo "10 de HP no fim da vez de quem tem o selo", no mesmo ponto em que o selo já desconta turno (`selos.ts:159-174`), com linha no registro e Desfazer. Serve para o Sangrando, a redoma, a Chamas Celenas (SP do alvo e do Sieg) e a Doença das Trevas.
5. **Melodia:**
   - A opção que diz "você ganha" vai no próprio Sieg.
   - O "+20 de precisão" vira um modificador que vale só contra quem pôs o selo. Hoje o modificador de reação vale contra todo mundo.
6. **Combo Orquídea → Florescer:** a Florescer confere se o alvo tem o selo da Orquídea (pelo cartão), tira a redoma quando acerta e sai sem precisar da Bônus dada pelo mestre (P3).
7. **Furtivo:** separar "sem reação" do ×1,5; ler o 3× do Efeito da Apunhaladora.
8. **Imbuir fogo:** um botão liga/desliga "+10 fogo" na mira das técnicas com "Embuir Fogo: Sim".
9. **Overload:** depois da SUPER, sugerir o selo "Fadiga" no Sieg, tirando metade de cada atributo (calculado na hora), até o fim da luta.
10. **Evolução:** conferir se a Melodia está ligada antes do Evoluir e já sugerir 50 SP.
11. **Só mexendo nos dados da ficha, sem código** (com o app fechado e backup):
    - Pôr "Armas por batalha: 3 armas".
    - Gravar o HP e o SP máximos.
    - Transformar a Preparação para a Batalha numa técnica Buff ("+N de Força por 2 turnos").
    - Transformar a Recuperação Espantosa numa Passiva "abaixo de 1% de HP", que lembra quando ele cai.
    - Transformar a Doença das Trevas numa Passiva "perde 27 de HP a cada turno", que lembra no começo da vez. Lembrar no fim da vez e só "se agiu" precisa de código.
    - Dar AGI +N na Ignição para o 1,2x.
    - Ligar o Arrombamento à Força.

## 5. Perguntas para o mestre (da mais importante para a menos)
- **P1. Qual arma cada técnica usa?** (bug 3)
  - (a) Cada técnica usa a arma do próprio nome, sem gastar ação.
  - (b) O mesmo de (a), mais "arma em mão": técnica de outra arma só depois de "Trocar de arma" (Ação Completa, como diz o Imperador).
  - (c) Fica como hoje e o jogador corrige o número na mão.
  - **Recomendo (a).** (b) só vale se a mesa usa a troca de arma de verdade.
- **P2. Lua Incandescente em vários alvos** (bug 1):
  - (a) Divide a base igual entre os marcados, arredondando para baixo (71 → 23 em cada), no máximo 3 alvos.
  - (b) Dano cheio em cada um, só trava em 3 alvos.
  - (c) O jogador digita o dano de cada alvo.
  - **Recomendo (a)**, porque é o que o texto diz.
- **P3. A Florescer é Bônus** (bug 2):
  - (a) Com o alvo dentro da redoma, ela sai sem precisar da Bônus dada pelo mestre.
  - (b) Trocar a Ação dela para Livre na ficha.
  - (c) Fica como hoje: o mestre dá a Bônus.
  - **Recomendo (a)**: o combo funciona e a decisão 8 continua valendo para o resto.
- **P4. Os 30 da Orquídea** (bug 4):
  - (a) Usar a Orquídea não dá dano. Os 30 de fogo só entram quando o alvo tenta atacar ou sair (o app lembra o mestre).
  - (b) 30 na hora e mais 30 se ele tentar sair.
  - (c) 30 na hora, como hoje.
  - **Recomendo (a).**
- **P5. HP e SP máximos** (bug 4 do sistema):
  - (a) Gravar 900 de HP e 140 de SP, que são os de hoje.
  - (b) Outros números (quais?).
  - **Recomendo (a)**, se ele está com tudo cheio hoje.
- **P6. O que é o "+20 de precisão" da Melodia?** O app não tem precisão, só o d20 de quem reage (10 = metade, 15 = esquiva, 20 = contra-ataque).
  - (a) O oponente analisado reage com −N contra os golpes do Sieg (você diz o N).
  - (b) +20 no dano do Sieg contra ele.
  - (c) Fica só como texto.
  - **Recomendo (a).**
  - Também preciso saber: o "+1 no dado de reação" vale contra todo mundo ou só contra o analisado?
- **P7. O "2 vezes por batalha" da Ignição** (bug 8):
  - (a) O limite é do ataque adicional: 2 na luta, 1 por rodada, e a forma liga e desliga à vontade.
  - (b) O limite é de ligar a forma, como hoje.
  - (c) Os dois.
  - **Recomendo (a)**, porque é como o livro escreve.
- **P8. Ataque furtivo** (bug 7):
  - (a) O 3× (Florescer e Apunhaladora) substitui o ×1,5 da Surpresa: Florescer sem reação = 302; Atacar furtivo com a Apunhaladora = 153.
  - (b) Os dois se somam (Florescer = 453).
  - (c) O mestre digita o dano.
  - **Recomendo (a).**
- **P9. O atordoamento da Entardecer (CD 12):**
  - (a) O alvo faz um teste d20 + modificador (de qual atributo?) contra 12; se falhar, fica Atordoado 1.
  - (b) Acertou = Atordoado 1, sem teste.
  - (c) O mestre decide na hora.
  - **Recomendo (a)**, porque o app já faz teste contra CD no Desenhar o Alvo.
  - Também preciso saber: quem está Atordoado perde a vez?
- **P10. O Sangrando da Yamato** (10 de dano nos 2 turnos do alvo):
  - (a) O app tira 10 do HP no fim de cada vez do alvo, 2 vezes, com Desfazer.
  - (b) Só um lembrete "Aplicar" para o mestre.
  - (c) Na mão.
  - **Recomendo (a).**
  - Também preciso saber: os 10 gastam o Escudo primeiro ou vão direto no HP?
- **P11. Quanto dura a redoma (Cego + Imobilizado)?**
  - (a) Até a Florescer consumir ou o mestre tirar.
  - (b) 1 vez do alvo.
  - (c) N turnos (quantos?).
  - **Recomendo (a).**
- **P12. O Overload: "perde metade dos status" e "muita fadiga":**
  - (a) Depois da SUPER, selo "Fadiga" no Sieg com metade de cada atributo até o fim da luta.
  - (b) Metade só da Força e do Espírito.
  - (c) Metade do HP e do SP atuais, na hora.
  - **Recomendo (a).**
  - Também preciso saber: é 1 vez por batalha (o que a ficha diz) ou 1 vez por dia (o que o livro diz, `lib/livroOnePiece.ts:24`)?
- **P13. A CAÇA AS BRUXAS! depois da SUPER** (bug 9):
  - (a) Usou a SUPER, a CAÇA volta.
  - (b) Como hoje: some pelo resto da luta.
  - (c) As duas ficam disponíveis depois de evoluir.
  - **Recomendo (a).**
- **P14. O que é "o caminho do dano deve estar ativo"?** (condição para evoluir)
  - (a) É a Melodia ligada na opção do +20, e não na do dado de reação. O app passaria a conferir isso.
  - (b) É outra coisa (qual?).
  - (c) Não conferir.
  - **Recomendo (a)**, mas é palpite meu: confirme.
- **P15. O +10 de imbuir fogo (da raça):**
  - (a) Um botão "+10 fogo" na mira das 5 técnicas com "Embuir Fogo: Sim", que já começa ligado.
  - (b) Soma sozinho, sem botão.
  - (c) Vale em qualquer golpe, inclusive no Atacar.
  - **Recomendo (a).**
  - Também preciso saber: na CAÇA, o +10 soma com os 20 de fogo dela?
- **P16. A Chamas Celenas:**
  - (a) Custa 10% do HP máximo (90) e dura até o fim da luta. No fim de cada vez do alvo: alvo −15 SP, Sieg +10 SP, e o Sieg perde 3% do HP (somando com a Doença).
  - (b) Custa 10% do HP atual, dura até o alvo zerar o SP, e os 3% são do alvo.
  - (c) Na mão.
  - **Recomendo (a)**, mas confirme quem perde os 3%.
- **P17. A Doença das Trevas:**
  - (a) O app tira 3% do HP máximo (27) no fim da vez em que ele andou ou atacou, com Desfazer.
  - (b) Um lembrete "Aplicar" no começo da vez (dá para fazer hoje só mexendo nos dados).
  - (c) Na mão.
  - **Recomendo (a).**
- **P18. O Resiliente: "só dura enquanto tiver resistência" e "lâmina ou bala não perfura":**
  - (a) Resistência = Escudo: com o Escudo em 0, a forma desliga, e contra ele o Perfurante começa desligado.
  - (b) Resistência = SP.
  - (c) Fica só como texto.
  - **Recomendo (a)**, mas é palpite.
- **P19. "Armas Destruídas"** (título da lista na descrição) e "3 armas por sessão":
  - (a) É só um título; gravar "Armas por batalha: 3 armas".
  - (b) As armas estão quebradas e saem da aba.
  - (c) Sem limite.
  - **Recomendo (a)**: o dano da lista bate com a aba Armas. Atenção: o app conta por batalha, não por sessão.
- **P20. O "até 1,2x de velocidade" da Ignição:**
  - (a) AGI +6 enquanto ela está ligada (33 → 39, o que mexe na ordem da vez).
  - (b) Só narração.
  - (c) ×1,2 no deslocamento.
  - **Recomendo (a)**, porque é só mexer nos dados.
- **P21. Sobras:**
  - Preparação para a Batalha: quantos pontos, e em qual atributo?
  - Recuperação Espantosa: quanto HP volta, e depois de quantos turnos?
  - Arrombamento: passa a usar a Força?
  - Amnésia: a "Inteligência" do texto é a Intuição?

## Já decidido (não perguntar de novo)
- A Ignição não bloqueia o Controle do Fogo ("Deixar como está", 01/11).
- O Sieg fica com os dois modos, mesmo a ficha dizendo "Sieg só usa ignição" (01/11).
- A Melodia: o jogador escolhe 1 das 2 opções; a versão evoluída com as duas fica para depois (31/10).
- A CAÇA evolui para a SUPER, que é Overload (31/10).
- Fonte: `C:/dev/labirinto/PEDIDOS.md:2017`, `:2023`, `:2025`.

## Não coberto
- Não rodei o app nem as funções. Todos os números acima são contas feitas lendo o código, e vale confirmar os bugs 1, 3 e 5 rodando.
- Não olhei: a névoa/visão de um personagem Cego, a Arena, o treino e o lado do jogador na rede (`net/`).
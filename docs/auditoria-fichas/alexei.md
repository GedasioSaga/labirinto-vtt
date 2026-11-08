<!-- Não gravei o arquivo: este agente só lê. O texto abaixo é o conteúdo de C:/dev/labirinto/docs/auditoria-fichas/alexei.md, para o orquestrador gravar e commitar. -->
# Alexei (pasta One Piece): auditoria da ficha, 07/11/2026

Só leitura. A ficha veio do `rpg.json` da pasta One Piece no appData, sem gravar nada. Prova aqui é leitura do código, com arquivo:linha; não rodei nada (sem build, sem teste). O que não deu para provar virou pergunta. O `00-sistema.md` não existe; usei o `docs/auditoria-fichas/00-bugs-do-sistema.md`.

## 1. Resumo
- Humano, 21 anos, Gatuno, atirador. O forte é a Percepção 80; a Força é 1. HP 365/600, SP 120/120, Escudo 12, 1 arma por batalha.
- Luta como caçador com bichos: lobos (Chamado do Lobo), armadilhas de planta (Armadilhar) e um Overload em que cada tiro vira lobo (A Caçada Começa).
- Hoje só o Atacar (90 de dano) e o Chamado do Lobo funcionam sozinhos. Armadilhar e A Caçada Começa estão quebradas, e vantagens e perícias são à mão.

## 2. Habilidades e itens
| Item | O que diz | Hoje no app | Onde |
|---|---|---|---|
| Armadilhar | Ação Simples, custo 20, Tempo 1: põe 1 de 4 armadilhas no alcance (Emaranhalga, Batata-mina, Planta Carnívora, Imã-gumelo) | NÃO SUPORTADA. O único caminho, o menu, trata como golpe: pede alvo e dano digitado, e nada aparece no mapa | `components/batalha/dadosDoMenu.ts:330`, `components/batalha/MiraDoGolpe.tsx:270-279` |
| Chamado do Lobo | Simples, 5 SP, Tempo 1. Lobo com 40 HP, anda 3 casas, 30 de dano, no máximo 3. Ultra Lobo: pede concentração 3x, só 1, mais forte que os 3 juntos | AUTOMÁTICA na mesa com mapa: Invocar, o mestre coloca, o bando age logo depois do Alexei. NÃO VALE na Arena nem no Treino | `lib/batalha/invocacao.ts:226-282`, `:423-444`; `components/batalha/MenuDaVez.tsx:132` |
| A Caçada Começa | Overload de 200 SP: por 5 turnos ataca 2x, cada tiro vira lobo (1ª mordida = Percepção, depois 20); no fim, metade de todos os status | QUEBRADA: aparece apagada e não tem saída (B1) | `lib/batalha/acoes.ts:233`, `:252` |
| Arma (Atacar) | Nome "Arma", De fogo, Dano 10, soma a Percepção, Ação Simples | AUTOMÁTICA: 80 + 10 = 90. A descrição fala em "Rifle: 20 de dano" | `lib/batalha/formula.ts:207-212` |
| 1 arma por batalha | Escolha do sistema | Automática; na mesa abre a janela para escolher a única arma | `components/batalha/BatalhaDoJogador.tsx:334` |
| HP, SP, Escudo | 365/600, 120/120, 12 | Automático. O máximo está gravado, então ele fica fora do bug 4 do sistema | — |
| Concentrar (para o Ultra) | Regra do livro | Automática: carga 1 a 3, a 3ª não gasta ação. Perder a concentração é à mão (botão Zerar) | `lib/batalha/acoes.ts:316-331` |
| Aparência Inofensiva | Vantagem para acertar quem não desconfia; engana cada pessoa 1 vez só | PARCIAL, à mão: o botão Surpresa da mira (×1,5, sem reação) | `lib/batalha/reacao.ts:61-65` |
| Preparação Para a Batalha | Ação Simples ou Bônus: +? no status principal por 2 turnos | À MÃO: o mestre usa "Pôr selo…" com Percepção +N por 2 turnos, e o Atacar já soma o selo | `components/batalha/BatalhaDoMestre.tsx:81`, `lib/batalha/formula.ts:351-355` |
| Audição Aguçada, Faro Aguçado, Olhos de Águia, Sensitivo, Coragem, Invisibilidade | Vantagem em testes | À MÃO: a batalha não lê a aba Vantagens e não tem teste nem vantagem; só existe o dado solto | `components/DiceDock.tsx` |
| 7 perícias | Caça, Acrobacia, Botânica, Primeiros Socorros, Disfarce, Falsificação, Furtividade | À MÃO: o app guarda o atributo de cada uma, mas não rola nada | — |
| 5 desvantagens | Analfabeto, Cleptomaníaco, Curioso, Sinceridade Excessiva, Vício (Doces) | Interpretação de mesa: nada a automatizar | — |

## 3. Bugs
**B1. ALTA (leitura). A Caçada Começa nunca pode ser usada, nem pelo mestre.**
- O que acontece no código:
  - A Ação "OVERLOAD | TRANSFORMAÇÃO" marca a técnica como transformação (`lib/batalha/leituraDaFicha.ts:87-90`).
  - Por isso ela sai apagada com o aviso "É transformação: use a tira Transformação" (`lib/batalha/acoes.ts:233`).
  - Só que essa tira só mostra cartões da aba Transformações (`lib/batalha/transformacao.ts:199-201`, `lib/ajusteDaFicha.ts:87-89`, `lib/sistemaOnePiece.ts:142`). Essa aba está vazia no Alexei, então a tira aparece apagada com "Nenhuma transformação na ficha" (`components/batalha/MenuDaVez.tsx:117`, `:350`).
  - O host recusa do mesmo jeito (`lib/batalha/golpe.ts:264`).
- Passo a passo: vez do Alexei → Habilidades → A Caçada Começa apagada → tira Transformação apagada. Não tem saída. Das 11 fichas, ele é o único com esse caso.
- Segundo bloqueio: "200 Sp" é lido como 200 SP (`lib/batalha/leituraDaFicha.ts:56`), e o SP máximo dele é 120. O app diria "SP insuficiente: custa 200, você tem 120" (`lib/batalha/acoes.ts:252`).
- O app também não lê nada do resto da técnica: os 5 turnos, o ataque duplo (o "Ataques extras" só existe em forma, `lib/batalha/transformacao.ts:116-119`), o lobo por tiro e a metade dos status no fim.

**B2. ALTA (leitura). Armadilhar vira um ataque num alvo.**
- O que acontece no código:
  - A técnica não tem campo Dano, e o Tipo vazio vira "ativa" (`lib/batalha/tiposDaHabilidade.ts:78`).
  - O menu mostra "A ficha não diz: digite o dano" (`components/batalha/dadosDoMenu.ts:330`).
  - A mira exige um alvo e um número (`components/batalha/MiraDoGolpe.tsx:270-279`).
- Passo a passo:
  1. Alexei quer pôr a Batata-mina.
  2. Precisa marcar um inimigo e digitar um dano; ele digita 0.
  3. O inimigo recebe a caixa REAÇÃO, porque dano 0 não conta como "sem dano" (`lib/batalha/golpe.ts:296`).
  4. O golpe fica esperando resposta e conta no teto de 20 do bug 2 do sistema.
  5. Nada aparece no mapa.
- Efeito colateral: todo golpe zera a concentração (`lib/batalha/golpe.ts:370-371`) e multiplica o número digitado pela carga (×1,5, ×2, ×3,5; `lib/batalha/reacao.ts:61-65`). Quem estava juntando carga para o Ultra Lobo perde tudo ao armar uma armadilha. Já invocar um lobo comum não zera a carga (`lib/batalha/invocacao.ts:483`).
- O Tipo "Armadilha" foi pedido e respondido em 02/11 (`PEDIDOS.md:2028-2029`) e está "planejado, não começado" (`PEDIDOS.md:2035`). A lista de Tipos ainda não tem Armadilha (`lib/batalha/tiposDaHabilidade.ts:30-40`).

**B3. MÉDIA (leitura). Fora da mesa com mapa, as 3 técnicas param.**
- Na Arena de testes e no Treino do Lobby, o Chamado do Lobo aparece como "Invocação: não vale nesta mesa" (`components/batalha/MenuDaVez.tsx:54`, `:132`; `stores/batalhaFabrica.ts:1981-1982`; `lib/treino/mesaEmMemoria.ts:24`).
- Somando com B1 e B2, o jogador do Alexei treina só com o Atacar. Isso é de propósito, mas para o jogador parece "habilidade que não funciona".

**B4. BAIXA (dado da ficha). O Rifle dá 20 ou 10?** A descrição diz "Rifle: 20 de dano"; o cartão da arma se chama "Arma" e diz Dano 10. O Atacar sugere 90; com 20 seria 100 (`lib/batalha/formula.ts:207-212`).

**B5. BAIXA (leitura). O Mundo do Livro mede o Alexei pela metade.** O peso do encontro usa só o maior golpe que a ficha consegue pagar, que é o Atacar 90 (`lib/livros/encontro.ts:213-227`). Os lobos (até 3 × 30 por rodada) e as armadilhas ficam de fora da conta.

**B6. Bugs do sistema que pegam o Alexei** (`00-bugs-do-sistema.md`):
- O bug 5 (o −/+ apaga dano) foi provado justamente com ele.
- Pelo bug 3, desfazer o Chamado do Lobo e depois desfazer a Vez deixa a técnica em recarga.
- P8: o Overload volta a ficar livre quando o app fecha. O livro diz "uma vez no dia" (`lib/livroOnePiece.ts:24`), e o app conta "uma vez por batalha" (`lib/batalha/acoes.ts:236`).

**Conferi e está certo:**
- O Chamado do Lobo lê 40 HP, 3 casas, 30 de dano e máximo 3. O Ultra pede carga 3, máximo 1, sugere 121 HP e 91 de dano e tira os lobos comuns de campo (`lib/batalha/invocacao.ts:197-204`, `:317-321`). Isso bate com o texto e com o grilling de 31/10.
- Tempo 1 quer dizer "uma vez por turno" (`lib/batalha/turnos.ts:471-483`; `docs/planos/batalha-one-piece-f2-plano.md:223`).
- O lobo temporário não sobe para o Lobby (`net/nuvem/emissor.ts:167-169`) e é limpo quando a batalha é religada (`stores/batalhaFabrica.ts:1672-1675`).

## 4. Automações propostas
1. **Acabar com o beco sem saída** (rápido, vale para qualquer ficha): técnica com TRANSFORMAÇÃO na Ação e sem forma na ficha passa a abrir como Overload de Ação Completa, ou avisa "mova para a aba Transformações" (`lib/batalha/acoes.ts:233`).
2. **A Caçada Começa** (depois das perguntas 1 a 5): virar forma com Ação Completa, Usos 1 e Ataques extras 1. O ataque duplo já existe na Ignição. O motor precisa aprender quatro coisas:
   - cobrar o custo ao Ativar;
   - um campo "Duração: 5 turnos" que desliga a forma sozinha, com aviso;
   - um "Ao acabar" que põe um selo de debuff com metade dos atributos;
   - cada Atacar na forma abre 1 pedido de lobo (o mestre coloca, como hoje), e o lobo tem 2 danos: a 1ª mordida e as outras.
3. **Armadilhar como Tipo "Armadilha"**, do jeito decidido em 02/11:
   - As 4 "Opção …" viram as opções, como na invocação.
   - O jogador clica na casa; cobra 20 SP e a Ação Simples, sem alvo e sem mexer na carga.
   - Todos veem a armadilha; quando alguém pisa, o mestre recebe um aviso com Disparar ou Cancelar.
   - O motor precisa de quatro peças novas:
     - um objeto no mapa ligado à batalha. O gatilho de área de hoje não serve: só avisa quando um JOGADOR entra (`lib/areaTriggers.ts:5-10`).
     - áreas 3x3 e 5x5 que virem lista de alvos.
     - selo com dano por turno, para o Sangrando 10 × 3. Hoje "por turno" só existe na passiva do próprio dono (`lib/batalha/passivas.ts:296-301`).
     - a Planta Carnívora como invocado parado, agindo no bando.
4. **Preparação Para a Batalha**: copiar para a aba Habilidades como Tipo Buff, Ação Simples, efeito "+N de Percepção por 2 turnos". O leitor de Buff já cria o selo e o Atacar já soma (`lib/batalha/tiposDaHabilidade.ts:119-123`, `lib/batalha/formula.ts:351-355`). Só falta o mestre dizer o N (pergunta 11).
5. **Aparência Inofensiva**: a mira já abre com Surpresa marcada contra quem nunca viu o Alexei lutar, e guarda uma lista de quem já foi enganado.
6. **Arma**: renomear para "Rifle" e acertar o dano (pergunta 6), com o app fechado e backup antes. Quando a ficha tem 1 arma e limite 1, pular a janela de escolha.
7. **Teste na ficha** (baixa prioridade): perícia → atributo → d20, e 2d20 quando uma vantagem cita aquele teste.

## 5. Perguntas para o mestre (da mais importante para a menos)
Já foi respondido, então não pergunto de novo: Chamado do Lobo (31/10) e o desenho do Armadilhar (02/11; `PEDIDOS.md:2018`, `:2029`).
1. A Caçada Começa custa 200 SP, e o máximo do Alexei é 120.
   (a) o número está errado; qual é o certo? (b) Overload pode passar do SP: zera o SP e usa mesmo assim (c) Overload não cobra SP.
   Recomendo (a).
2. Ela é forma ou técnica?
   (a) forma na aba Transformações: troca a imagem, e o ataque duplo já existe (b) técnica Overload, tirando a palavra TRANSFORMAÇÃO da Ação (c) o app aprende a aceitar técnica que transforma sem ter forma.
   Recomendo (a).
3. "Reduz todos seus status pela metade" no fim:
   (a) só os 8 atributos, até o fim da batalha (b) os atributos e também o HP e o SP de agora (c) dura até o próximo descanso.
   Recomendo (a).
4. Os lobos da Caçada:
   (a) cada Atacar durante os 5 turnos põe 1 lobo (1ª mordida = Percepção, 80; depois 20), sem limite de quantos, e todos somem no fim (b) contam também os tiros dados antes na luta, como diz "para cada projétil atirado durante este combate" (c) seguem o limite de 3 do Chamado do Lobo.
   Recomendo (a). E quanto de HP tem esse lobo: 40?
5. "Por 5 turnos" conta como?
   (a) 5 vezes do Alexei depois da vez em que ativou, como os selos contam hoje (b) 5 rodadas (c) conta a vez em que ativou.
   Recomendo (a).
6. O Rifle:
   (a) dano 20: corrijo o cartão e o nome, e o Atacar vai a 100 (b) dano 10: tiro o "20" da descrição, e o Atacar fica 90 (c) 10 da arma + 10 de bala.
   Recomendo (a), porque a descrição veio da ficha antiga.
7. Enraizado (Emaranhalga):
   (a) não anda até gastar um turno para tirar as raízes (b) só tem desvantagem em movimento, como diz o extra "Enraizamento" (c) não anda e ainda reage com desvantagem.
   Recomendo (a): o texto da Opção é o mais específico.
8. Quando a Planta Carnívora bate?
   (a) na vez do bando do Alexei, em 1 alvo ao lado dela (b) na hora em que alguém entra no alcance (c) as duas.
   Recomendo (a): aproveita o bando que os lobos já usam.
9. Sangramento da planta (10 por 3 turnos):
   (a) no começo da vez da vítima, com aviso e botão Aplicar (b) automático, sem perguntar (c) à mão, como hoje.
   Recomendo (a). O sangramento gasta o Escudo antes do HP? (sim / não)
10. Batata-mina e Imã-gumelo:
    - A Batata-mina (3x3) pega (a) todo mundo na área, incluindo aliados e o próprio Alexei, ou (b) só inimigos? Recomendo (a).
    - O "teste CD 12" do Imã-gumelo é (a) d20 puro ≥ 12, igual à reação, (b) d20 + modificador de Força, ou (c) d20 + modificador de Agilidade? Recomendo (a).
11. Preparação Para a Batalha:
    (a) Percepção +20 por 2 turnos (b) outro número ou outro status (c) continua à mão.
    Recomendo (a) só como ponto de partida; o número é decisão sua.
12. Aparência Inofensiva na luta:
    (a) vale como Surpresa (×1,5, sem reação) no 1º golpe em quem nunca o viu lutar (b) o alvo reage com desvantagem (c) continua à mão.
    Recomendo (a).
13. Treino do Lobby e Arena de testes:
    (a) liberar o Chamado do Lobo lá, com o lobo nascendo na grade (b) deixar só na mesa com mapa, e o menu dizer "só na mesa do mestre".
    Recomendo (a), depois das perguntas 1 a 5.
14. Overload "uma vez no dia" (livro) ou "uma vez por batalha" (app):
    (a) por batalha, como hoje (b) por sessão, lembrado mesmo se o app fechar.
    Recomendo (b) se a mesa segue o livro ao pé da letra.
15. Olhos de Águia diz que ele "lê as menores letras", e Analfabeto diz que é "incapaz de ler":
    (a) ele enxerga a letra, mas não entende (b) uma das duas sai da ficha.
    Recomendo (a).

## 6. O que não cobri
- Não rodei o app nem as funções, porque este agente só lê: tudo acima é leitura do código com arquivo:linha. B1 e B2 merecem virar teste da store.
- Não vi as telas no navegador nem o Lobby ao vivo, não conferi animação nem som do lobo, e não auditei o sistema Dragon Ball.
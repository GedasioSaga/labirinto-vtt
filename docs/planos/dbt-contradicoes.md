# Dragon Ball Tales: onde o livro se contradiz e o que o app escolheu

**Resumo.** Quando o livro diz uma coisa no texto e outra no exemplo, o app segue o EXEMPLO (pedido do mestre). Quando não há exemplo, o app escolheu a leitura mais simples e marcou o item com **Verificar**: são esses que valem uma olhada sua.
São **85 itens** em 7 áreas: Ficha 7 · Técnicas 11 · Transformações 3 · Combate 28 · NPC 13 · Suplementos 15 · Erros mantidos 8. Destes, **42 estão marcados Verificar**.
Conferido no código em 02/11/2026 (o que está escrito aqui é o que o app faz hoje, não só o que o plano dizia). Fontes: dossiês em `docs/fontes/dragon-ball-tales/dossie/`, decisões em `docs/planos/dbt-batalha.md` (seção 21) e os comentários do código em `client/src/lib/dbt/`.

Como ler cada item: **o que o livro diz (página)**, o conflito, o que o app faz agora e onde mudar se você preferir a outra leitura. "Livro" = Livro do Jogador V0.5, salvo quando diz "Narrador". Os arquivos de `client/src/lib/dbt/dados/` são gerados: para mudar um número deles, muda-se `scripts/dbt/gerar-dados.cjs` (ou o texto em `docs/fontes/`), nunca o arquivo direto. Em quase tudo o mestre já pode corrigir à mão na ficha ou no cartão da batalha sem mexer em código.

---

## 1. Ficha e atributos (7)

1. **Modificador do atributo (p. 6).** O texto diz "+1 a cada número acima de 10"; os exemplos da mesma página usam +1 a cada 2 pontos.
   App: segue o exemplo (8 = −1, 10 = 0, 12 = +1, 14 = +2). Mudar: `client/src/lib/dbt/regras/atributos.ts` (`modificador`).
2. **Vida no PDL 0 (3.0.2 x 3.0.3, p. 12-13).** 3.0.2 diz que abaixo de 10.000 PDL a vida é só a da Constituição; 3.0.3 e o exemplo já somam a vida da raça.
   App: segue o exemplo (CON 12 + raça 12 = 72). Mudar: `client/src/lib/dbt/regras/ficha.ts` (`pvMaximo`).
3. **Slots de Técnica, fórmula x exemplo (2.2.5 e 8.6 x p. 109).** A fórmula, impressa duas vezes (2.2.5 e 8.6), é 20 + (1 + mod SAB) × 5. O único exemplo (p. 109) usa outra conta, 12 + mod × 5 = 22, e a lista de técnicas dele soma "4 + 2 + 2 + 8 + 6 = 20" (a soma real é 22; as três técnicas citadas dão 12).
   App: segue o EXEMPLO, ST = 12 + mod SAB × 5 (SAB 10 = 12, SAB 14 = 22; Humano Marcial × 10; nunca abaixo de 0). Voltar para a fórmula (SAB 14 = 35) é trocar `ST_BASE` para 20 e a conta para (1 + mod) × 5 em `client/src/lib/dbt/regras/ficha.ts` (`slotsDeTecnica`).
4. **Slots de Técnica, ganho por PDL (3.0.11 x p. 109).** 3.0.11 dá +2 a cada 10.000 PDL; a p. 109 diz +1 a cada 5.000 (mesma taxa, degrau diferente).
   App: +2 a cada 10.000. **Verificar.** Mudar: `client/src/lib/dbt/regras/ficha.ts` (`ST_POR_MARCO_DE_VIDA`).
5. **Raça Freeza: "gastam metade dos Slots de Técnica" (cap. 4).** O livro não diz se arredonda para cima ou para baixo.
   App: não faz a conta; o texto aparece na raça e o mestre corrige o ST à mão na ficha. **Verificar.** Mudar: `client/src/lib/dbt/regras/ficha.ts` (`slotsDeTecnica`).
6. **Itens com carga em dobro (8.2 x 8.3, p. 101).** Radar das Esferas ocupa 2 no exemplo de carga e 1 na tabela; "Armadura de batalha completa" ocupa 3 no exemplo, mas a tabela de armaduras usa 2/4/6.
   App: lista os dois itens como impressos; o jogador escolhe qual pegar. **Verificar.** Mudar: `scripts/dbt/gerar-dados.cjs` (itens).
7. **Armadura "−X Ki por turno" (8.3, p. 103).** Não diz se baixa o Ki máximo ou se é um gasto por turno.
   App: tira X da recarga no início de cada turno (o máximo da ficha não muda). **Verificar.** Mudar: `client/src/lib/dbt/batalha/contas.ts` (`kiDaRecarga`).

## 2. Técnicas e rótulos (11)

1. **Teto do rank (6.0.2, p. 58-59).** O teto de Ki e de dano do rank só é dito com todas as letras para "Aumentar Dano por Ki"; não diz se os outros rótulos que somam Ki também param no teto.
   App: corta o Ki total e o dano no teto do rank e avisa na técnica. **Verificar.** Mudar: `client/src/lib/dbt/regras/tecnicas.ts` (conta do Ki e do dano).
2. **Limite de rótulos negativos (p. 60 x exemplo p. 86).** O texto fala em "número de rótulos"; o exemplo do Kamehameha conta em pontos.
   App: segue o exemplo (negativos até o total de pontos base do rank). Mudar: `client/src/lib/dbt/regras/tecnicas.ts` (orçamento).
3. **Engolfante +3 ou +4 de Ki (p. 62 x exemplo 6.7, p. 86).** O rótulo diz +3; o passo 4 do exemplo usa +4 (Ki 12), mas a ficha final do mesmo exemplo imprime Ki 11.
   App: +3, o que dá Ki 11, igual à ficha final do exemplo; a nota "o exemplo 6.7 usa +4" aparece no rótulo. Mudar: `scripts/dbt/gerar-dados.cjs` (Engolfante); numa técnica só, o Ki pode ser digitado à mão.
4. **Dano mínimo do Kamehameha (exemplo 6.7, p. 85-86).** O passo 5 diz mínimo 11; a ficha final imprime 12.
   App: 11 / 22 / 44 (o completo dividido por 4, como no passo 5). O exemplo discorda de si mesmo; o app fica com o lado que bate com a regra (¼ do base), como fez com o Ki 11 da ficha final (item 3). Mudar: o dano pode ser digitado à mão na técnica; a conta fica em `client/src/lib/dbt/regras/tecnicas.ts`.
5. **Dano máximo do Rank E (p. 59 x tabela p. 58).** O texto diz "no máximo 20 de dano"; a tabela dá 24.
   App: segue a tabela (24). **Verificar.** Mudar: `scripts/dbt/gerar-dados.cjs` (tabela de ranks).
6. **Dano Espiritual (p. 68).** O texto é cópia do da Drenagem ("tipo Drenagem"); o efeito próprio parece ser Ki extra.
   App: mostra o texto como impresso; o efeito do tipo de dano fica com o mestre (fora do v1 da batalha). Mudar: `docs/fontes/dragon-ball-tales/` + gerador.
7. **Alcance Meia-Lua (p. 62).** Diz +4 de Ki por ponto extra, mas não dá o Ki inicial.
   App: Ki inicial 0, só +4 por ponto extra. **Verificar.** Mudar: `scripts/dbt/gerar-dados.cjs` (Meia-Lua).
8. **Técnica Híbrida (6.0.1, p. 61).** Custa 2 pontos de rótulo e o texto fala em "custo mais alto de Ki", sem número.
   App: 2 pontos, nenhum Ki a mais; acerta com FOR, INT ou PRE. **Verificar.** Mudar: `scripts/dbt/gerar-dados.cjs` (Técnica Híbrida).
9. **Adicionar Cura e Adicionar CA (6.3, p. 73).** Estão entre os rótulos de Ki, mas a cura pediria Técnica Mágica.
   App: deixa como rótulo de Ki e não exige Técnica Mágica. **Verificar.** Mudar: `client/src/lib/dbt/regras/tecnicas.ts` (avisos de tipo).
10. **Rótulos "(?)" no Rank E (6.3).** "(?)" consome todos os pontos base do rank; no Rank E isso é só 1 ponto, o que fica barato. Nenhuma regra proíbe.
    App: permite (custa 1 no Rank E). **Verificar.** Mudar: `client/src/lib/dbt/regras/tecnicas.ts` (`pontosDoRotulo`).
11. **Número entre parênteses nas condições (9.7, p. 120-123).** Atordoado (5), etc.: o capítulo não diz o que é.
    App: usa como o custo da condição no rótulo Efeito Negativo (o texto do Efeito Negativo, p. 76, fala em "valor da condição"). Mudar: `scripts/dbt/gerar-dados.cjs` (condições).

## 3. Transformações (3)

1. **Regra geral x Super Saiyajin (7.0-7.1, p. 92-93).** A regra diz estágio N = EP +N e Ki 3 × N; o exemplo do Super Saiyajin dá EP +2/+3/+4 e Ki 6/9/12.
   App: segue o número impresso de cada forma; a regra geral só vale para forma criada com o mestre sem número. A ficha mostra a diferença em texto. Mudar: `client/src/lib/dbt/regras/transformacoes.ts`.
2. **Que EP conta (2.3 e 8.1.2).** O livro soma a EP da forma "em todas as rolagens", mas a CA e a CD usam a EP base.
   App: EP total (base + forma) no acerto, na iniciativa e na comparação de escala; EP base na CA, na CD e nas perícias. **Verificar.** Mudar: `client/src/lib/dbt/batalha/contas.ts` e `client/src/lib/dbt/regras/ficha.ts`.
3. **Exaustão pela forma máxima (8.5.1.2-8.5.1.3, p. 104-108).** Diz "toda vez" que usa, sem dizer quando a perda entra.
   App: conta por uso; no 2º uso da forma máxima o Ki fica bloqueado na hora e entra na exaustão do fim (até o Descanso Longo). A exaustão é regra opcional, ligada por padrão; o mestre confirma no fim. **Verificar.** Mudar: `client/src/lib/dbt/batalha/fim.ts`.

## 4. Combate (28)

1. **Reação gasta "ST" ou Ki (9.3, p. 114).** O texto diz ST; 8.5 e 9.5.6 cobram Ki.
   App: cobra Ki. Mudar: `client/src/lib/dbt/batalha/ataque.ts` (custo da reação).
2. **Vantagem e desvantagem (cap. 8-9).** O livro usa os termos e nunca os define.
   App: rola 2d20 e fica com o maior (ou o menor); uma de cada se anulam; não acumulam. **Verificar.** Mudar: `client/src/lib/dbt/batalha/contas.ts`.
3. **Acerto igual à CA (2.3 x 8.4, p. 10 e 103).** A margem 0 não tem estágio na tabela.
   App: erra, como no exemplo de CA 18 de 8.4 ("igual ou inferior"). Mudar: `client/src/lib/dbt/regras/dano.ts`.
4. **Tabela de escala 2.3.3 (p. 10).** A partir de 5 níveis o padrão quebra, a linha 1 não segue a base, e a tabela para em 10.
   App: copia a tabela como impressa; acima de 10 níveis tira 1 por nível. **Verificar** (só a parte acima de 10). Mudar: `client/src/lib/dbt/regras/dano.ts`.
5. **Bônus e penalidade de escala juntos (2.3.1 + 2.3.2, p. 10).** +EP em todas as rolagens e −1 por nível ao atacar alguém mais forte: o livro não dá exemplo com os dois.
   App: soma os dois. **Verificar.** Mudar: `client/src/lib/dbt/regras/dano.ts`.
6. **Arredondamento (¼, ½, metade do Choque, Instável, exaustão).** O livro quase nunca diz.
   App: sempre para baixo, como no exemplo da p. 84 (¼ de 50 = 12); na exaustão soma as % e arredonda o total, como no exemplo da p. 107 (6 usos, 30 PK = 9). Mudar: `client/src/lib/dbt/batalha/fim.ts`, `ataque.ts`, `choque.ts`.
7. **Crítico "dobra o dano final" (9.4, p. 115).** Não diz se dobra antes ou depois da defesa do alvo.
   App: dobra depois dos bônus do atacante e ANTES da mitigação da reação. **Verificar.** Mudar: `client/src/lib/dbt/batalha/ataque.ts` (`calcularDanoPrevisto`).
8. **Quebra de Guarda "ignora a CA" (9.5).** Acerto automático ou dano total?
   App: o próximo ataque contra ele usa CA 0 (na prática, dano completo); 1 natural ainda erra; vale uma vez. **Verificar.** Mudar: `client/src/lib/dbt/batalha/ataque.ts`.
9. **Sangrando quando já é dano completo (9.7).** Não há estágio acima do completo.
   App: o estágio a mais vira + dano mínimo, a mesma regra da Acumulação e da Devastadora (p. 76-77). **Verificar.** Mudar: `client/src/lib/dbt/batalha/contas.ts`.
10. **"Ataque Básico" e repetição de técnica (9.2).** O livro fala em Ataque Básico, mas o rótulo se chama Técnica Básica; a técnica não básica não pode ser usada "duas vezes seguidas".
    App: Ataque Básico = rótulo Técnica Básica; técnica não básica só 1 vez por Turno de Ação (mais rígido que "duas seguidas"). **Verificar.** Mudar: `client/src/lib/dbt/batalha/acoes.ts`.
11. **Mais de 3 ataques básicos condensados (9.2).** Não diz como vira dano.
    App: uma rolagem e uma faixa para todos; dano = n × dano da faixa; Ki = soma; uma janela de reação. **Verificar.** Mudar: `client/src/lib/dbt/batalha/ataque.ts` e `contas.ts`.
12. **Salvaguarda contra a morte (9.5.10, p. 119-120).** O parágrafo fala em 3 sucessos ou 3 falhas; os marcadores parecem uma rolagem só.
    App: d20 ≥ 10 é sucesso; 3 sucessos = inconsciente, 3 falhas = morto; a 1ª rolagem na hora e depois uma por turno dele. **Verificar.** Mudar: `client/src/lib/dbt/batalha/morte.ts`.
13. **Voo (9.5.7, p. 117).** O texto cobra 2 Ki por nível; o exemplo diz que do solo direto ao voo alto custa 2 Ki. O nível 3 não tem nome e sobra um vão entre 20 e 21 m.
    App: segue o exemplo para a troca de nível (2 Ki por mudança, qualquer número de níveis). Os 4 Ki de iniciar o voo vêm de outra frase do mesmo parágrafo, que o exemplo não contradiz, então também entram: do chão ao nível 2 = 4 + 2 = 6 Ki. Nível 3 = "voo altíssimo". Se o exemplo valer como total, do chão ao nível 2 seriam 2. Mudar: `client/src/lib/dbt/batalha/contas.ts` (`kiDeVoo`).
14. **Queda do voo (9.5.7).** Não diz o que acontece com quem estabiliza.
    App: quem estabiliza fica no nível sem dano; senão vai ao chão com 1d20 por nível. Desequilibrado não pode estabilizar. **Verificar.** Mudar: `client/src/lib/dbt/batalha/pendencias.ts`.
15. **Empates (agarrão, soltar-se, CD, Choque).** O livro não diz.
    App: no teste resistido fica como está (o agarrão falha, quem está preso continua preso); contra CD, igualar passa; no Choque, empate não pontua e rola de novo. **Verificar.** Mudar: `client/src/lib/dbt/batalha/pendencias.ts` e `choque.ts`.
16. **Atordoado (9.7).** "Perde o próximo turno" e "reações x2" sem dizer até quando.
    App: perde o próximo Turno de Ação quando ele vier; reações custam o dobro até o fim da rodada em que foi atingido; acaba a transformação. **Verificar.** Mudar: `client/src/lib/dbt/batalha/condicoes.ts`.
17. **"Até o fim do próximo turno" (9.7).** De quem é o próximo turno?
    App: o próximo Turno de Ação do afetado que começar depois da aplicação. **Verificar.** Mudar: `client/src/lib/dbt/batalha/condicoes.ts`.
18. **Teste para sair da condição (9.7 e 8.1.2).** Algumas condições não dizem o atributo do teste.
    App: d20 + modificador + EP total contra CD (CD com EP base); igualar passa; "X ou Y" usa o maior modificador; onde o livro não diz, uma tabela do app escolhe o atributo (o mestre troca no modo manual). **Verificar.** Mudar: `client/src/lib/dbt/batalha/condicoes.ts`.
19. **Teste do tipo de dano "não afetado pela escala" (6.2).** Não diz se é só na CD ou também no teste do alvo.
    App: o alvo testa sem somar EP; o efeito do rótulo de tipo de dano é aplicado pelo mestre no v1. Mudar: `client/src/lib/dbt/batalha/ataque.ts`.
20. **Testes sem hora marcada (Enraizado, Envenenado, Instável, Sangrando, 9.7).** O livro não diz quando rolar.
    App: no início do turno do afetado, um teste por condição. **Verificar.** Mudar: `client/src/lib/dbt/batalha/condicoes.ts`.
21. **Imunidade do 20 natural "no primeiro turno" (9.1).** Primeiro turno dele ou primeira rodada?
    App: a rodada 1 inteira (o próprio livro usa "primeiro turno" para a 1ª rodada no 1 natural da iniciativa). Mudar: `client/src/lib/dbt/batalha/condicoes.ts`.
22. **Vitória automática (2.3.4, p. 11).** EP o dobro da outra vence (exemplos 10 x 5 e 3 x 1); pela letra, EP 1 venceria qualquer EP 0.
    App: só avisa o mestre, e só quando a EP menor é 1 ou mais. **Verificar** (a parte do EP 0). Mudar: `client/src/lib/dbt/regras/dano.ts`.
23. **Choque de Poder com técnica Reativa (9.5.6, p. 116-117).** "Reação ofensiva não sofre disto" e "mesma EP" não são explicados.
    App: a Reativa no Choque paga o Ki uma vez e não gera débito; "mesma EP" = EP total. **Verificar.** Mudar: `client/src/lib/dbt/batalha/choque.ts`.
24. **Movimento "uma única vez por turno" (9.5.3).** Dá para andar, atacar e andar de novo?
    App: conta o total de casas no turno; dividir em partes é permitido. **Verificar.** Mudar: `client/src/lib/dbt/batalha/contas.ts`.
25. **Barreira usada como reação (6.2).** Se não mudasse o ataque que já veio, a reação seria inútil.
    App: recalcula o ataque com a nova CA (crítico e 1 natural ficam); vale até o início do próximo turno de quem reagiu. **Verificar.** Mudar: `client/src/lib/dbt/batalha/ataque.ts` (barreira).
26. **Reação defensiva e escala (2.3.1 x 2.3.2).** É rolagem, mas não é ataque.
    App: soma a EP total e não sofre o −1 por nível do mais fraco. **Verificar.** Mudar: `client/src/lib/dbt/batalha/contas.ts`.
27. **Adicionar Salvaguarda, "a escala se aplica igual" (6.3).** Não diz como.
    App: a faixa desloca a favor do mais forte e a CD cai pela diferença quando o atacante é o mais fraco. **Verificar.** Mudar: `client/src/lib/dbt/batalha/ataque.ts`.
28. **Efeito Negativo em técnica de dano (p. 64).** "Se o alvo receber dano": antes ou depois da defesa?
    App: só testa se o dano final, depois da mitigação, for maior que 0. Mudar: `client/src/lib/dbt/batalha/ataque.ts`.

## 5. NPC e narrador (13)

1. **ND em branco e PV "---" nas fichas prontas (Narrador 4.0.2, p. 17-18).** De propósito: o mestre escolhe.
   App: o NPC entra sem ND; o mestre escolhe, com sugestão ND 3 (o exemplo de 3 golpes da p. 18). Mudar: `client/src/components/dbt/mundo/contasDoMundo.ts` (`ND_SUGERIDO`).
2. **"Rank" no cabeçalho do NPC (Narrador).** Parece ser o rank da tabela de vida por golpe, mas o livro não diz com todas as letras.
   App: usa esse rank na vida (ND × vida por golpe) e nas técnicas sem rank. **Verificar.** Mudar: `client/src/lib/dbt/regras/npc.ts`.
3. **Modificador impresso fora da conta.** Erik POD 16 (+4), Rakthar CON 20 (+4); nas sagas Gohan SAB 10 (+2) e PRE 13 (+2), Raditz CON 14 (+1), Cell Max INT 18 (+5), Vegetto FOR 24 (+6).
   App: guarda o valor do atributo e recalcula o modificador pela conta; o modificador impresso não é usado. **Verificar.** Mudar: `client/src/lib/dbt/regras/npc.ts` (`npcProntoParaFicha`).
4. **PK e CA impressos fora da fórmula.** Vegetto PK 345 (a conta daria 52), Zamasu Futuro PK 30, CA de Goku (Namek), Yamcha, Rikum e Gurdo 1 abaixo.
   App: o número impresso vence, gravado como ajuste à mão (a ficha mostra a conta ao lado). Mudar: `client/src/lib/dbt/regras/npc.ts` (`ajustesDoImpresso`).
5. **Danos fora do padrão do rank.** 14-22-44 (Contra-Impacto Saiyajin, Dragon's Reversal, Soco Reativo), 12-22-44 (Masenko), 20-40-80, 32-65-130.
   App: Ki e dano entram exatamente como impressos, digitados à mão na técnica. Mudar: `client/src/lib/dbt/regras/npc.ts` (`tecnicaDaPronta`).
6. **Atributos acima da "boa prática" (Narrador 4.0.4, p. 18).** As fichas do próprio livro passam dos tetos (Yama POD 22 e FOR 20, Rakthar 22-22-20-20-18).
   App: só avisa, nunca bloqueia. Mudar: `client/src/lib/dbt/regras/npc.ts`.
7. **"Rótulos Positivos (N)" que não fecham com a lista (sagas).** O número parece ser o teto do rank.
   App: guarda o número e a lista como impressos, sem recalcular. Mudar: `scripts/dbt/gerar-dados.cjs`.
8. **"Ki" e "PK" (Narrador e fichas).** O livro usa os dois como a mesma coisa ("[Ki: 08]", "gastar os PK's").
   App: é uma reserva só (os Pontos de Ki). **Verificar.** Sem arquivo único: é o modelo inteiro.
9. **VEL das fichas prontas.** Não tem definição no livro.
   App: lê como deslocamento em metros; diferente de 9 m vira ajuste à mão. **Verificar.** Mudar: `client/src/lib/dbt/regras/npc.ts` (`ajustesDoImpresso`).
10. **Esfera de Cura da Amai (Enma Daioh).** Está listada entre as técnicas ofensivas, com [Cura: 17-34-68].
    App: trata como cura (a faixa cura em vez de causar dano). **Verificar.** Mudar: `scripts/dbt/gerar-dados.cjs`.
11. **Reação em Desvantagem (Narrador cap. V).** Não diz como liga nem o que custa.
    App: interruptor por combatente; a reação defensiva não gasta Ki, mas ele precisa ter o Ki; o app sugere ligar quando um lado tem 1 de pé contra 2 ou mais. **Verificar.** Mudar: `client/src/lib/dbt/batalha/ataque.ts` e `motor.ts`.
12. **Lacuna Mental, "o Mestre sorteia" (9.7).**
    App: o app sorteia entre as técnicas ativas e as transformações (se cair a forma ligada, ela acaba); o mestre pode trocar. **Verificar.** Mudar: `client/src/lib/dbt/batalha/condicoes.ts` (`sortearLacuna`).
13. **Controle Mental (9.7).** Não diz quem comanda o controlado.
    App: no v1 só o mestre comanda. **Verificar.** Mudar: `client/src/lib/dbt/batalha/condicoes.ts`.

## 6. Suplementos e sagas (15)

Aqui o app não decide nada: o texto aparece como está na raça ou no NPC e o mestre resolve na mesa. Para trocar o texto, muda-se a fonte em `docs/fontes/dragon-ball-tales/` e roda-se o gerador.

1. **Brench, "Afinidade com Ki Expansivo".** Diz "gratuitamente" e logo cobra PK igual ao custo do rótulo. App: só texto.
2. **Garota Mágica.** Diz PK "de forma permanente" e "não sendo permanente" na mesma frase. App: só texto.
3. **Demônio.** Magias cobram PK, mas a regra diz "jamais Pontos de Ki comuns"; "Presença Definitiva" compara com a EP "do alvo" (provável "do usuário"). App: só texto.
4. **Androide.** "Dreno de Ki" da Super Absorção é o "Drenar Energia" do livro básico com outro nome. App: só texto.
5. **Hit Clan.** Time Realese e Tide of Times acumulam "Tempo Perdido": não diz se o estoque é um só. App: só texto.
6. **Freeza Armadurado.** "Super Soco Reativo - A" com orçamento de Rank B; socos Z com alcance "Pessoal"; Soco Preciso B mais fraco que o C. App: só texto.
7. **Namek e Androide.** Listas de rótulos negativos que não fecham ("(3)" com 4 itens; "(6)" com 3). App: só texto.
8. **Majin.** "Feixe de Transfiguração" com faixas de diferença de EP mal definidas; "Palmar Crítico" é queima-roupa com alcance 9 m. App: só texto.
9. **Purrlians.** Sem a vida por 10.000 PDL; Estágio 5 confuso sobre quem paga o Ki; "Acesso ao Ki Divino" não definido.
   App: vida extra por PDL = 0 (o livro não diz); o resto é texto. **Verificar.** Mudar: `client/src/lib/dbt/regras/ficha.ts` (`vidaDaRaca`) ou a vida da raça na ficha.
10. **Namekuseijin Mutante.** O texto diz "entre o Grande e o Imenso", a tabela vai até "Final" (~60 m) e cita uma "Gigantificação comum" que não está no livro básico. App: só texto.
11. **Tribo Glass, Refração de Luz.** "PK equivalente ao inimigo mais poderoso" sem dizer a medida (provável EP). App: só texto.
12. **Hera-seijin.** A proporção 1:3 está incompleta (subentende +3 de dano por PK). App: só texto.
13. **Saibamans.** O custo do ácido não é dito. App: só texto.
14. **Lupinos.** Não diz se a cor é escolha única; o Lupino Vermelho dura "Escala de Poder Base" rodadas. App: só texto.
15. **Saiyajin do Potencial, Ōzaru.** "Perdendo parte do controle ... caso seja uma criança": não diz o que vale para o adulto. App: só texto.

## 7. Erros de digitação e dados do original mantidos (8)

Mantidos como no livro para a busca e as páginas baterem com o PDF. Para corrigir: `docs/fontes/dragon-ball-tales/` + gerador.

1. **Numeração do Livro do Jogador.** Namek tem dois "4.4.1"; Saiyajin tem 4.5.1.1/4.5.1.2 depois de 4.5.2; não existe a seção 9.6; há dois "8.1.2"; o registro de mudanças cita páginas de versões antigas.
2. **Livro do Narrador.** "Imponto Limites", "ROTERIZE", "ATRBITOS", dois "4.0.6"; o sumário omite 3.3 e chama 2.2 de "Definindo EP e PDL".
3. **Potara.** Fala em "Slots de Poder" (provável "Slots de Técnica").
4. **Tabela do Cientista.** A linha de 7.500 PDL está sem "Invenção" (a célula parece mesclada).
5. **Enma Daioh.** Gorudan tem duas especiais com o mesmo nome (a segunda é a "Mão do Julgamento"); a seção de especiais do Erik diz "– Gorudan".
6. **Grafias das sagas.** "Saiayjin", "Contudente", "otpar", "esquivalente".
7. **Textos cortados ou copiados nos suplementos.** "Furioso" (Purrlians) termina no meio; Moroans tem uma sobra da absorção Majin; Zahha "podem se na área de raio"; Saibamans usa o título "A Génese de Yardrat"; "Ultimate Kamehameha" repete o texto do Super Kamehameha.
8. **Nomes e números trocados.** Artista Marcial tem duas técnicas Rank E chamadas "Soco de Impacto"; Metal Freeza escreve "Estrela Gete" e "Estrela Gate"; Hit Clan escreve "30,000" com vírgula.

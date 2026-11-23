# Comparar e balancear: protótipo que testa e recomenda

Pedido do dono (23/11/2026, literal): "melhore isso aqui, eu quero um prototipo que faça teste, recomendações e afins, as vezes eu quero colocar algo assim: 3 aliados sendo 2 npc e jogador vs 1 inimigos quanto o inimigo tem que ter para a batalha durar 10 turnos."

Abrir: `docs/design/balanceamento/prototipo.html` direto no navegador (um arquivo só, sem servidor). Ele abre já com o exemplo do dono montado: Aira (jogadora), Hector e Tree (NPCs) contra o Urso, com a meta de 10 turnos marcada.

Tela de hoje, para comparar: `client/src/components/livros/PaginaComparar.tsx` e a foto `tmp/balanceamento/dono-comparar-hoje.png`.

## Três jeitos de montar a tela

**A. Bancada (montagem à esquerda, resultado à direita, sempre visíveis).**
Prós: mexe e vê o efeito sem rolar a página; bom para quem testa várias vezes seguidas.
Contras: duas colunas densas brigam por espaço em 1.280 px; o histograma e a tabela ficha por ficha ficam estreitos demais; a meta (o que o dono mais quer) vira um campo pequeno num canto.

**B. Assistente em passos (1 Montar, 2 Testar, 3 Ajustar).**
Prós: guia quem nunca usou; cada passo tem uma pergunta só.
Contras: o mestre balanceia em ciclos (mexe, testa, mexe de novo), e o assistente obriga a voltar passos; esconde a montagem justo quando o resultado pede uma troca; parece formulário, não mesa de jogo.

**C. Mesa frente a frente (escolhido).**
Os dois lados se encaram com um placar de latão no meio ("3 × 1"); embaixo, a meta escrita como frase com lacunas, nas palavras do dono: "Quero que a luta dure [10] turnos e que os aliados vençam [70]% das lutas. Ajustar [Urso] mexendo em (HP) (Escudo) (Dano) (Atributos)". O resultado vem embaixo, como relatório lido de cima para baixo: quem vence, o que mudar, quanto dura, quem carrega.
Prós: a tela fala a frase do pedido; montar e meta ficam juntos, num só lugar; o resultado tem a largura toda para os gráficos; "Comparar fichas" segue como aba.
Contras: com resultado longo, a montagem rola para fora da tela. Mitigado: o veredito e as recomendações vêm primeiro, e cada recomendação tem o botão da ação ("Achar os números") ali mesmo.

Por que C: o dono pensa a luta como "X contra Y, quanto precisa para durar N". A mesa e a frase são essa ideia desenhada; A e B são telas genéricas de configurar e rodar.

## O que o protótipo faz

1. **Montar os lados.** Acervo à esquerda (Jogadores, NPCs, Variações). Arrastar uma ficha para um lado; ao parar em cima, o lado acende e mostra "Soltar aqui: Lobo entra nos Inimigos". Sem arrasto: o lado marcado ("O clique põe aqui") recebe o clique na ficha. Repetir o clique ou usar o + faz "3 Lobos". O botão ⇄ troca de lado e o × tira da luta. Arrastar de volta para o acervo também tira. Limite de 6 vagas por lado, contando as cópias (o mesmo `VAGAS_POR_LADO_MAX` do treino). Embaixo de cada lado aparecem a vida somada, o dano por turno e se o lado tem cura.
2. **Testar.** Botão "Testar 200 lutas" (100, 200 ou 500; atalho Ctrl+Enter). As lutas rodam num Web Worker, com barra de progresso e Cancelar (Esc). Resultado:
   - **Veredito:** frase, peso da luta (Fácil, Justo, Duro, Mortal, em 4 marcas), placar em barra (Aliados, Empate, Inimigos) e quatro números: duração mediana, metade das lutas entre X e Y, aliados de pé no fim, inimigos de pé no fim.
   - **O que mudar:** as recomendações em palavras (abaixo).
   - **Quanto dura:** colunas por turno, separadas por quem venceu, com a linha da mediana, a da meta e a faixa da metade das lutas. Passar o mouse ou usar as setas mostra a dica de cada turno; há também "Ver como tabela".
   - **Técnicas mais usadas:** vezes por luta, com o contra-ataque contado à parte.
   - **Ficha por ficha:** dano causado, dano sofrido, parte do dano do lado, cai primeiro, caiu (e em que turno), SP gasto e "sem SP em X%", técnica mais usada.
   - **Luta típica:** a luta do meio, turno a turno, com cada d20.
   - **Rodapé:** semente (mesma semente, mesmas lutas) e "Rodar com outra semente".
3. **Achar os números (o resolvedor).** Ver a seção seguinte. O resultado mostra a tabela "Hoje e Proposta", a conferência em 300 lutas novas com faixa de certeza, a confiança (alta, média ou baixa, com o motivo), o gráfico "Como achei" (cada tentativa) e uma "outra saída" (o mesmo total de vida em Escudo). **Aplicar** cria uma variação ("Urso (10 turnos)"), põe a variação na luta no lugar do original e testa de novo sozinho. O aviso traz "Desfazer" e "Comparar com o original". A ficha original nunca muda.
4. **Recomendações em palavras.** Cada uma vem com ícone e, quando dá, com o botão da ação. Exemplos que o protótipo gera de verdade:
   - "O Urso cai em ~2,7 turnos; para a luta durar 10, suba o HP para ~1.850 ou dê Escudo ~1.250."
   - "O Hector carrega X% do dano dos aliados."
   - "A Aira é a primeira a cair em X% das lutas, por volta do turno N."
   - "Os aliados não têm cura: numa luta longa, o dano dos inimigos só acumula."
   - "O Hector fica sem SP para as técnicas em X% das lutas…"
   - "X% das lutas bateram no teto de 30 turnos…"
   - "A duração varia muito…"
   - "Os aliados vencem quase sempre…"
   - "Os aliados perdem X%…"
   - "A luta acaba cedo porque os aliados caem antes…"
5. **Comparar fichas (a tela de hoje, melhorada).** De 2 a 4 fichas lado a lado. Cada linha usa uma escala própria, e o maior valor da linha fica em latão. A coluna "Base" (troca com "Usar como base") e as outras mostram a diferença para ela: "+920", "igual". O interruptor "Só as linhas que mudam" esconde o resto. Linhas novas: golpe mais forte, dano por turno, cura por uso, lista de golpes com SP e ação. Se a ficha estava no último teste, aparecem também o dano por luta, o "cai primeiro" e o SP gasto. Depois de Aplicar, a aba abre com o Urso e o "Urso (10 turnos)" lado a lado.

## O resolvedor: como acha os números

- **Meta:** duração (mediana de turnos), vitória dos aliados (%), ou as duas.
- **Botões:** HP primeiro; Escudo, Dano e Atributos são opcionais. O alvo é um inimigo (todas as cópias dele) ou "todos os inimigos".
- **Busca por botão:** começa medindo a luta de hoje (80 lutas). Para HP e duração, o primeiro chute é proporcional (HP × meta ÷ turnos de agora). Depois disso, usa falsa posição dentro do intervalo cercado, e fora dele extrapola com passo limitado. No máximo 7 ou 8 tentativas de 80 lutas cada, sempre com as mesmas sementes: o que muda entre uma tentativa e outra é o número, não o dado.
- **Duas metas:** o HP (ou Escudo) acerta a duração, e o Dano (ou Atributos) acerta a vitória. Alterna 2 ou 3 ciclos.
- **Conferência:** arredonda (HP de 10 em 10, dano de 0,05 em 0,05) e roda 300 lutas com sementes novas, para não "decorar" as da busca. Mostra a mediana, a metade das lutas e a vitória com a faixa de 95% de certeza (intervalo de Wilson).
- **Mediana suavizada:** o resolvedor persegue a mediana interpolada dentro do turno (40% das lutas em 2 e 45% em 3 dá 2,7). Com a média, a meta de 10 saía com mediana 9.
- **Quando não dá, ele diz:** "Nem com o HP no limite a luta chega a 12 turnos: os inimigos derrubam os aliados antes. Ligue 'Dano'…". Nesse caso a confiança fica baixa, e o Aplicar fica desligado com o motivo quando nada mudou.
- **Resultados no motor de exemplo:**

| Caso | Proposta | Conferência |
|---|---|---|
| Aira, Hector e Tree contra o Urso, 10 turnos, só HP | HP 600 → 1.660 | mediana 9,7 (metade das lutas entre 8 e 11); 700 lutas |
| 10 turnos e 70%, HP e Dano | HP 1.540, dano ×1,7 | 10,2 turnos e 69% (faixa de 63% a 74%) |
| 3 Lobos contra Alexei e Siegfried, 8 turnos | HP 180 → 360 | mediana 7,5 |
| Draco contra a May sozinha, 12 turnos, só HP | nenhuma (meta impossível) | aviso de meta impossível |

## O que é de mentira e o que o motor de verdade dá

| Parte | No protótipo | No app hoje | O que falta construir |
|---|---|---|---|
| A luta | Motor simplificado: dano = base + atributo × mult. A reação no d20: 1 é crítico ×1,5; 2 a 9, cheio; 10 a 14, metade; 15 a 19, esquiva; 20, esquiva e contra-ataque. Escudo antes do HP, SP paga técnica, 2 simples ou 1 completa. O robô cura abaixo de 60% e bate no inimigo de pé mais ferido. | `lutaAutomatica.ts` com o robô (`robo.ts`) sobre a batalha One Piece de verdade: formas, buffs, debuffs, passivas, concentrar, selos, Ação Livre e Bônus. | Nada no motor: ele já joga. |
| Contra-ataque | Sai no 20, como a regra da mesa. | O robô **nunca** contra-ataca: no 20 ele escolhe a esquiva (`robo.ts`, "esquiva > metade > cheio, nunca o contra-ataque"). | Decidir se o robô passa a contra-atacar. Sem isso, a linha "Contra-ataque" das técnicas não aparece no app. |
| Quantas lutas | 100, 200 ou 500. | `LUTAS_DA_SERIE = 100`, fixo (`cemLutas.ts`). | Pôr o N no pedido da série. |
| O que volta da série | Vitórias, empates, turnos de cada luta, e por ficha: dano causado e sofrido, cura, SP gasto, se caiu e quando, quem caiu primeiro, quando o SP acabou, usos de cada técnica e contra-ataques. | `ResultadoDaSerie` traz só as vitórias, os empates (`todosCaidos` e `tempo`) e, por luta, `{ semente, fim, rodada }`. Cada `ResumoDaLuta` tem a vida final de cada vaga e o registro em texto, mas a série joga isso fora. | Um contador por vaga dentro de `lutaAutomatica` (a cada passo `agir` ou `reagir`, somar dano, SP e técnica) e a soma na série. É a maior peça nova. |
| Luta típica | Refeita pela semente, com cada d20. | Já existe: a semente de cada luta vai no resultado, e o "repetir esta luta" refaz turno a turno. | Só ligar a semente da luta mediana. |
| Velocidade | 200 lutas em ~5 a 10 ms; o resolvedor faz 600 a 2.300 lutas em menos de 0,1 s. | O teste de desempenho aceita **até 5 s (alvo) e 15 s (teto) para 100 lutas** (`cemLutas.desempenho.test.ts`). | O resolvedor no app pode levar de 30 s a vários minutos. Saídas: menos lutas por tentativa (40), começar pela conta rápida, um worker por núcleo (`navigator.hardwareConcurrency`), progresso por tentativa (o protótipo já mostra "Tentativa 3: HP ×2,45 dá 9,6 turnos") e Cancelar sempre à mão. |
| Ajustar sem estragar a ficha | O ajuste vai numa cópia; Aplicar cria uma variação. | A mesa em memória (`mesaEmMemoria.ts`) já luta com cópias. A variação já existe (`combate.modeloId`, `ehVariacao`, `variacoesDe`). | Gravar a variação na pasta da campanha, como as variações de hoje. |
| Conta rápida | Uma linha: vida ÷ (dano por turno × 0,6). | É o "peso do encontro" de hoje (`lib/livros/encontro.ts`, `FATOR_DA_REACAO`). | Nada; o protótipo reusa a conta. |
| Fichas | 20 fichas de exemplo com os nomes da tela; números no estilo da foto. Retrato = inicial colorida, sem arte do dono. | As fichas da pasta, com a força aplicada. | Nada. |

## Decisões que ficam com o dono

1. **FORA DO ARTEFATO: duas telas fazem o mesmo trabalho.** Hoje a aba Comparar tem o "peso do encontro" (conta sem dado, `PaginaComparar.tsx`, componente `Veredito`), com os botões "Deixar Fácil, Justo, Duro", que mexem na **força** dos inimigos. O protótipo cobre isso com Testar e "Achar os números", que criam **variações**. As opções são:
   - substituir o peso pelo teste;
   - manter o peso como "conta rápida" de uma linha, que é o que o protótipo faz;
   - manter os dois.
   
   Falta também decidir se o ajuste vira variação (o protótipo) ou mexe na força (hoje).
2. **"Turno" ou "rodada".** O dono escreve "turnos"; o app e o motor dizem "rodada" (o teto é de 30 rodadas). O protótipo usa "turno = uma rodada inteira".
3. **Nome do peso.** O app usa Fácil, Justo, Duro e Mortal (`NOME_DO_PESO`); o pedido falava em Fácil, Justa, Difícil e Mortal. O protótipo seguiu o app.
4. **O robô contra-ataca no 20?** Ver a tabela acima.

## Onde o dado criado aparece

A variação aparece:
- no acervo (grupo "Variações", com um brilho rápido ao nascer);
- no lado dos Inimigos, no lugar do original;
- no seletor "Ajustar";
- na aba Comparar (escolhida sozinha, ao lado do modelo, com "variação de Urso");
- nas linhas "Na última simulação".

Ainda não aparece, porque o protótipo não tem essas telas: no Bestiário e na lista de NPCs do livro, nos tokens do mapa e na ficha. No app, ela entraria onde as variações já entram.

## Convenções de interação atendidas

- **Abas:** setas, Home e End trocam de aba, e o Tab entra no painel. A marca desliza com o clique e não anima pelo teclado.
- **Arrasto:** o destino acende e mostra onde a ficha vai cair durante a pausa; soltar fora não faz nada; há caminho sem arrasto (lado marcado + clique, ⇄, −/+, ×).
- **Botões:** cada controle tem efeito visível. O que não pode agir fica desligado com o motivo escrito perto: "Ponha alguém nos dois lados para testar.", "Para mudar quanto a luta dura, deixe o app mexer no HP ou no Escudo.", "Nada a aplicar: os números ficaram iguais aos de hoje.".
- **Campos da meta:** validam ao sair do campo ou ao enviar (de 1 a 30 turnos, de 5% a 95%), com o erro escrito em palavras. Enter roda o resolvedor.
- **Avisos:** "Desfazer" dentro do aviso; o aviso não some com o ponteiro em cima; a saída é mais rápida que a entrada.
- **Resultado velho:** quando a montagem muda depois do teste, o resultado fica apagado com "Testar de novo", e a proposta antiga trava o Aplicar.
- **Gráficos** (skill `dataviz`):
  - cores dos lados validadas pelo `validate_palette` no modo escuro, contra o cartão `#211c15`: azul `#4f95d6` e vermelho `#e2645a` passam em todas as checagens;
  - legenda sempre presente; texto em tinta neutra, nunca na cor da série;
  - barras de até 24 px com cantos de 4 px e 2 px de folga entre as partes;
  - dica no mouse e no teclado, e tabela como alternativa.
- **Movimento** (revisado com `review-animations`; o destaque da variação nova saiu do `box-shadow` para um `::after` de opacidade, para o anel de foco do teclado não animar):
  - revelação do resultado só na primeira vez: 260 ms com ease-out e 45 ms entre as partes;
  - encolhimento de 0,97 ao apertar;
  - `prefers-reduced-motion` respeitado.
- **Tokens:** os mesmos `--lb-*` e `--lb-gr-*` de `docs/design/livros-de-regras/prototipo.css`, que copia `client/src/theme.ts`. O app tem um tema só (escuro).

## Prova (23/11/2026)

- Chromium 1243 (Playwright, sem janela, 1.440 × 900), abrindo o arquivo com `file://`. Script em scratchpad, fora do repo.
- Fluxo rodado: testar; dica do histograma; achar só com HP; achar com as duas metas (HP + Dano); aplicar; aba Comparar; arrastar o Lobo para os Inimigos; meta impossível (Draco contra a May).
- **Erros de console: 0. Tarefas longas: nenhuma** na última rodada (numa anterior, uma de 50 ms na abertura). Teto pedido: nenhuma ≥ 200 ms.
- Fotos em `tmp/balanceamento/` (fora do git):
  - `01-inicio.png`
  - `02-resultado.png`, `02b-histograma-dica.png`, `02c-fichas.png`
  - `03-proposta.png`, `03b-procurando.png`, `03c-proposta-duas-metas.png`
  - `04-aplicado.png`
  - `05-comparar.png`
  - `06-arrastando.png`
  - `07-meta-impossivel.png`
- **Casos de borda do resolvedor** rodados no Node com o mesmo motor: os quatro da tabela da seção do resolvedor, mais "todos os inimigos" com duas metas (6,05 turnos e 57% para 60%), "só vitória 50%" (56%) e "só Escudo" (Escudo 0 → 1.060, mediana 9,7). Com 6 contra 6, 500 lutas levam 40 ms.

## Fora deste protótipo

- Guardar entre visitas: recarregar a página volta ao exemplo.
- Apagar uma variação depois do aviso: só o "Desfazer" do aviso faz isso.
- Arrastar com o dedo: foco no PC; o arrasto usa o do HTML5.
- Mais de 2 lados (a arena aceita até 12).
- O "Fica parado" do Judge.
- Formas, buffs e passivas no motor de exemplo.

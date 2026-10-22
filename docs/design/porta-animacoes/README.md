# Animações de porta: cinco novas, cor e cadeado

Protótipo para aprovação. Pedido do usuário em 21/10/2026: "sobre a porta eu quero boas animações e poder mudar a cor dela". **Nada disto está no app.** O código desta pasta só entra em `client/` depois que você aprovar.

- **Vitrine:** `prototipo/index.html`, um arquivo só com o código real empacotado: o Pixi do app, `drawWalls`, `animacoesDePorta.ts` e o animador. O arquivo segue o formato das vitrines anteriores, sem doctype, para ser publicado como página. Para abrir no navegador sem publicar, use a cópia com doctype que o gerador de provas grava em `%TEMP%\porta-animacoes-pagina-de-teste.html`.
- **Animações**, no formato do pacote: `modulos/porta/<id>.ts` e `<id>.json`. Vão para `client/src/animacoes/porta/` sem reescrever.
- **Provas:** `provas/`. As metas estão em `metas.json`, escritas antes do código. O resultado está em `testes.json`, e há folhas de contato, gráficos, os `.wav` e 4 prints.
- **Mudanças que o app precisa:** `proposta/`, com cópias do código do app já alteradas. O diff de cada uma sai com `git diff --no-index client/src/pixi/drawDoors.ts docs/design/porta-animacoes/proposta/drawDoors.ts`.

Para refazer:

```
node docs/design/porta-animacoes/prototipo/montar.cjs        # gera prototipo/index.html (esbuild)
node docs/design/porta-animacoes/provas/gerar-provas.cjs     # monta, roda o Chromium e grava provas/
rtk proxy npx tsc --noEmit -p docs/design/porta-animacoes/tsconfig.json
```

## As cinco

O desenho da porta parada não muda: barra chapada em 60% do vão, 5 px de espessura na tela. Fechada é cheia e aberta é só o contorno. Cada animação começa e termina exatamente nesse desenho (prova M1).

| Animação | Abre | Fecha | O que acontece |
|---|---|---|---|
| Dupla | 320 ms | 280 ms | Duas meias-folhas, cada uma presa numa ponta, giram 90° juntas e recolhem para o batente. |
| Grade que sobe | 600 ms | 420 ms | A barra vira grade: abre vãos e as barras passam um pouco para os dois lados da parede. Depois vem um tranco de corrente e a grade sobe, primeiro o centro. Ao fechar, ela desce e bate no chão. |
| Arrombada | 560 ms | 320 ms | Golpe e tremor. Depois a porta cede de vez, gira e solta 5 estilhaços da fechadura. Fecha sem drama. |
| Sanfona | 440 ms | 380 ms | Dobra em 4 gomos, em zigue-zague, e recolhe para uma ponta. |
| Cortina de contas (minha escolha) | 480 ms | 420 ms | A barra vira uma fileira de contas que se abre pelo meio, balançando, e se amontoa nas pontas. |

Girar e Deslizar aparecem na vitrine como são hoje no app, só para comparar. Elas estão sendo refinadas em outro trabalho.

## Decisões e porquês

1. **O desenho depende só do progresso, igual nos dois sentidos.** Inverter no meio continua do ponto em que a porta estava, sem salto: o desenho num ponto do caminho é sempre o mesmo, abrindo ou fechando. O ritmo de cada sentido vem de uma curva de tempo própria, e não de um desenho diferente.
2. **Uma curva por sentido, no json** (`curvaAbrir` e `curvaFechar`, cubic-bezier com os 4 números entre 0 e 1). Com os 4 números nessa faixa a curva nunca volta nem passa do alvo (sem quique), e a prova M3 confere isso. As curvas foram tiradas de easings.net (`easeOutSine`, `easeInOutSine`, `easeOutCubic`), nenhuma inventada.
   - A Grade usa entrada e saída suaves porque é pesada. As barras se formam logo no primeiro quinto do caminho, e isso dá a resposta imediata ao clique.
   - A Arrombada usa ritmo linear porque o próprio desenho já tem as fases (golpe, tremor e queda).
   - A primeira rodada de provas mostrou que curvas fortes de saída deixavam de 150 a 250 ms finais sem nada mudando na tela. Troquei as curvas e conferi de novo nas folhas de contato.
3. **Abrir mais demorado que fechar.** Arrombar e erguer uma grade é o momento da cena; fechar é resposta e é rápido.
4. **Tudo opaco**, como pede o estilo Meio-Termo: sem transparência no caminho, sem hachura e sem brilho. As cores são as da porta.
5. **Tamanhos medidos em pixel de tela, e não do mundo.** Barra da grade a cada 6 px, conta a cada 5 px, tremor de 0,9 px. Assim a grade se lê em qualquer zoom.
6. **Movimento reduzido troca na hora**, sem nenhum quadro intermediário (M8). Também deixa o som mudo.
7. **Cor:** paleta de 6 tons contidos, tirados do Meio-Termo (laranja de hoje, carvalho, musgo, ardósia, ameixa e ferro), mais uma cor livre. O cartão mostra o contraste da cor com o chão e avisa quando fica abaixo de 3:1.
8. **Trancada:**
   - sem cor própria, continua como hoje: vermelha cheia;
   - com cor própria, mantém a cor e ganha um cadeado;
   - o cadeado é sempre opaco, creme com contorno vermelho, 6 por 5 px fixos na tela e sem crescer com o zoom;
   - porta secreta não mostra cadeado.
9. **Som só para as cinco novas**, sintetizado na hora (WebAudio, sem arquivo). O volume final ficou em torno de -32 LUFS, baixo de propósito, porque porta é coisa frequente. O som acompanha a curva: o baque da grade cai no quadro em que ela bate no chão. Em velocidade lenta o som não toca, e a página diz isso.

## Provas (Chromium 1243 headless, metas em `provas/metas.json`)

Todas as 14 metas passaram na última execução (`provas/testes.json`, cerca de 16 s).

| Meta | Resultado |
|---|---|
| M1 extremos, porta parada contra animação a 0% e a 100% | 91 combinações (7 animações, horizontal e vertical, zoom 1, 2 e 4, resolução 1 e 2, mais o telhado): **0 pixels diferentes** |
| M2 opacidade | 201 pontos por sentido em cada nova: **0** preenchimentos com transparência |
| M3 curva | todas sobem ou descem sempre no mesmo sentido, 0 de excesso, chegam no alvo |
| M4 cobertura do vão | 1 até 0 em todas, **0** de subida fora dos trechos de tremor |
| M5 continuidade | maior passo do centro da folha a cada 0,5% de progresso: 0,28 a 0,84 px (meta: até 1,5) |
| M6 tempo medido no animador, a 60 quadros por segundo | Dupla 333/283, Grade 600/433, Arrombada 567/333, Sanfona 450/383, Cortina 483/433 ms (declarado mais até 1 quadro) |
| M7 inverter a 25, 50 e 75% | maior salto contra o maior passo normal: Dupla 2,5/4,7, Grade 0/1,25, Arrombada 3,3/4,7, Sanfona 1,8/2,9, Cortina 0,26/0,5 px |
| M8 movimento reduzido | **0** quadros animados em todas |
| M9 50 portas por 4 s | intervalo entre quadros p95 de 8,4 ms (meta: até 20), desenho p95 de 0,8 ms, **0** tarefas longas (observador ativo) |
| M10 console | 0 erros e 0 avisos (desktop e celular) |
| M11 390 px | largura rolável de 390, nada vazando |
| M12 som | todos entre -32,9 e -32,0 LUFS; pico de -12,3 a -16,0 dBTP (meta: até -12); 0 cliques; 0 cortes; DC até 0,07%; fim em silêncio; termina até 57 ms depois da animação |
| M13 prints | 4 |
| M14 folhas de contato | 5 folhas, 16 quadros cada (8 abrindo e 8 fechando), com o tempo embaixo |

Os gráficos de `provas/graficos/` mostram o progresso e a cobertura do vão amostrados a cada 50 ms, com o volume do som embaixo, na mesma linha do tempo.

## O que NÃO foi conferido

- **Medir não é ouvir.** Os números de volume, pico e cliques dizem que o som não estoura nem estala. Se ele é agradável, ou se cansa na décima porta, só você decide: os `.wav` estão em `provas/som/`.
- **"Ficou bonito e gostoso" é julgamento seu.** As provas dizem que o movimento é contínuo, opaco, no tempo e sem salto, mas não dizem se é bom.
- **Celular de verdade e outra máquina:** não testados. O 390 px foi simulado no Chromium.
- **Placa de vídeo de verdade:** não testada. O WebGL das provas roda por SwiftShader, que é GPU por software. Numa GPU real deve ser mais rápido, mas não medi.
- **WebView2 do app instalado:** não testado. É Chromium também, mas não é o mesmo binário.
- **O app em si:** nada foi ligado em `client/`. A porta da vitrine é desenhada pela cópia de `proposta/drawDoors.ts`, não pelo arquivo do app.

## O que o app precisa para receber isto (fica para depois da aprovação)

1. `scripts/pacote-animacoes.cjs` (linha ~124) e `client/src/lib/pacoteDeAnimacoes.ts`: aceitar `duracaoFecharMs`, `curvaAbrir` e `curvaFechar` no json da porta. Hoje só passam `nome` e `duracaoMs`.
2. `client/src/pixi/animadorDePortas.ts`: usar a curva do sentido no lugar do `easeOutCubic` fixo. Sem curva no json, continua igual a hoje. Ver `proposta/animadorDePortas.ts`, `proposta/curvaBezier.ts` e `proposta/registroProposto.ts`.
3. `client/src/pixi/drawDoors.ts`: cor própria (`cor?: number` na porta) e o cadeado. Ver `proposta/drawDoors.ts`. O campo é opcional: porta sem cor fica como hoje, sem migração.
4. **O dado entre telas.** A cor nasce na ficha da porta, no editor, que já tem a escolha de animação. Ela precisa:
   - ser salva no mapa;
   - viajar até a janela do jogador (`PlayerView`);
   - valer também para a cópia da porta sobre o telhado, que tem um segundo animador.

   Nada disso existe ainda. Hoje a cor só vive na vitrine.
5. **Som das novas no app.** O som de hoje das portas está sendo feito em outro trabalho. Daria para levar a síntese (`prototipo/som.ts`) ou os `.wav` prontos. Essa escolha é sua junto com aquele trabalho.

## Perguntas para você

1. Quais das cinco entram no pacote? A Cortina de contas foi escolha minha: fica ou sai?
2. Grade (600 ms) e Arrombada (560 ms) são mais longas que o resto da interface, de propósito, porque são cena do mapa. Ficam assim ou encurto as duas para perto de 450 ms?
3. O som está baixo, cerca de 13 dB abaixo das transições (-18,6 LUFS). Quer mais alto, mais baixo, ou algum som que já cansou ao ouvir?
4. Cor e trancada: a paleta de 6 mais a cor livre serve? E a regra "sem cor fica vermelha, com cor ganha cadeado" está boa?
5. O cadeado de 6 por 5 px se lê bem no seu monitor, nos três zooms?
6. A curva por sentido pede uma mudança pequena no animador e no pacote. Posso fazer, ou prefere as novas com a curva única de hoje? Sem ela, a Grade e a Arrombada perdem parte do ritmo.

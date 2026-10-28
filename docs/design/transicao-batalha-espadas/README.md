# Abertura de batalha: Espadas cruzadas

Pedido de 27/10/2026: "quando iniciar [a batalha] eu possa escolher uma animação de transição [...], eu quero ter algumas opções que nem as animações de local, a primeira animação que eu quero é duas espadas se cruzando e nome royals aparecendo", e em seguida "faça o protótipo da animação". A ideia emprestada é só o conceito de abertura de batalha curta e marcante; o desenho é próprio.

Ajuste do mestre no mesmo dia, depois de ver a primeira versão: "eles param por um instante antes de se bater, coloca elas se batendo direto, coloca um impacto mais forte, royals são vilões então bota um pouco mais ameaçador." A versão atual é essa, de vilão. A primeira (ouro quente, com pausa e recuo antes do golpe) está no commit `82952801`.

**Estado: protótipo para o mestre aprovar.** Nada no app, nada em `client/src/animacoes/aprovadas.json`, nada enviado ao GitHub.

## Abrir

`prototipo.html` abre direto no navegador (precisa de internet para baixar o three.js da CDN). Tem o seletor de abertura (por enquanto só "Espadas cruzadas"), o campo do nome (padrão "Royals", até 24 letras), Repetir, Som, Câmera lenta (1/4 da velocidade), Tela cheia e Movimento reduzido. Digitar no nome mostra o quadro parado com o nome novo; ao parar de digitar, a animação toca de novo, e Enter toca na hora.

## O que acontece (2,8 s)

| Tempo | O quê |
|---|---|
| 0 a 0,4 s | As duas espadas avançam pelos lados já em velocidade, girando para a frente, e aceleram até o choque, sem parar antes; a câmera vem junto. Névoa vermelha rolando no fundo e um drone grave por baixo |
| 0,4 a 0,47 s | Contato: o quadro congela num clarão compacto, branco no miolo e carmesim em volta |
| 0,47 s | Estouro: o clarão abre, duas ondas de choque (uma rápida e fina, outra lenta e larga), 120 faíscas, soco de câmera e tremor forte e curto; som de estalo, lâmina raspando, tinido pesado das duas lâminas e batida grave funda com grão |
| 0,53 a 0,7 s | O nome aparece grande e cai pesado até bater no lugar: segundo tranco e o som de uma chapa de ferro no chão de pedra |
| 0,7 a 1,25 s | O nome esfria de rubro para ferro escuro; as rachaduras ficam em brasa vermelha, respirando; brasas sobem ao fundo |
| 1,35 a 1,95 s | Um reflexo frio corre pelas lâminas e depois pelo nome ("tiin" baixinho) |
| 2,1 a 2,5 s | Dois cortes em X riscam a tela e quatro cunhas pretas fecham sobre o cruzamento (batida grave) |
| 2,5 a 2,8 s | Preto, para a troca de tela; o drone some junto |

Com movimento reduzido: as espadas surgem já cruzadas, sem voo, tremor, faíscas, ondas, rastro, queda do nome nem cunhas; a névoa fica parada; o clarão é só de luz, o nome acende no lugar e o fim é um escurecer. O drone e o som do choque ficam.

Estilo de vilão, contido: fundo quase preto com um poço de vinho no centro e névoa vermelha mais densa embaixo; aço escurecido em duas facetas com fio claro só do lado da luz e quatro dentes de serra junto à guarda; guarda de ferro com pontas afiadas e um filete vermelho; escudete em forma de presa com granada; punho de couro preto com cordão carmesim; pomo em ponta de diamante. O nome é ferro escuro com rachaduras cavadas que a brasa acende. Contornos quase pretos e frios (nunca preto puro) e a fonte de título do app (Sitka Banner, com Constantia e Georgia de reserva).

## Código

- A cena é um módulo pronto para o pacote: `client/src/animacoes/batalha/espadas-cruzadas.ts` + `espadas-cruzadas.json` (nome, `duracaoNaturalS` 2,8, `quadroDaMiniaturaS` 1,6). Mesmo contrato `CriarCena` das transições de local (`src/transicoes/tipos.ts`): tempo vindo de fora, `ajustarTela`, `descartar` e som sintetizado em `criarSom`. A única diferença é um campo opcional a mais nas opções, `nome`.
- Tudo é desenhado com `ShaderMaterial` sem conversão de cor na saída, então o que foi pintado no canvas é o que aparece. Sem luz na cena e sem imagem externa; espada e nome são pintados em canvas na hora (o nome é refeito a cada montagem). A névoa é ruído fractal no shader.
- `prototipo.html` é gerado por `montar.cjs` a partir de `fonte.html`: `node docs/design/transicao-batalha-espadas/montar.cjs`, da raiz. Usa o mesmo código do módulo, empacotado pelo esbuild num IIFE (`AberturasDeBatalha`), e `three@0.186.1` da CDN (a versão do app).

## Para entrar no app (só depois do sim)

1. O tipo `batalha` ainda não existe: `scripts/pacote-animacoes.cjs` só lê os tipos que conhece (`EMBUTIDAS`), então hoje esta pasta é ignorada pelo pacote. Falta acrescentar o tipo lá e no carregador do app.
2. O motor (`src/transicoes/motor.ts`) passa só `{ reduzirMovimento }` para a cena; para o nome chegar, `OpcoesDaCena` ganha `nome?` (a cena já aceita).
3. A escolha da abertura e a reprodução no mestre, no jogador e na TV entram na fatia B5 da linha da batalha; pelo PEDIDOS.md, a B4 prevê levar no protocolo o id da abertura e o texto (no código da linha da batalha isso ainda não aparecia em 27/10).
4. Aprovar = acrescentar `"batalha/espadas-cruzadas"` em `aprovadas.json` e publicar o pacote.

## O que NÃO foi verificado

Por ordem do usuário (pressa, só protótipo), nenhum teste rodou: sem vitest, sem robô, sem folha de contato, sem gráfico do movimento, sem medição de som (LUFS, pico, cliques) e sem medição de quadro. Medir não é ouvir, e aqui nem medido foi: o drone, o choque e a chapa só existem no código.

O que rodou na versão de vilão: `rtk proxy npx tsc --noEmit` (zero erro) e uma abertura num Chrome headless com GPU, que tocou sem erro no console e rendeu 2 prints (o estouro e o quadro de 1,6 s). Depois desses prints vieram ajustes que não foram vistos de novo: o nome caindo em carmesim mais escuro em vez de rosado, rachaduras mais retas e finas, ferro do nome um pouco mais escuro, clarão de tela mais branco, menos névoa no estouro e o nome entrando 0,06 s mais tarde. Também não conferido: tela estreita, tema escuro da página, outro navegador, Safari/WebKit (o desenho usa `roundRect` do canvas), custo da névoa em GPU fraca (a TV) e a miniatura do app a 320 × 180.

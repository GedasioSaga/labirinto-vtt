# Abertura de batalha: Espadas cruzadas

Pedido de 27/10/2026: "quando iniciar [a batalha] eu possa escolher uma animação de transição [...], eu quero ter algumas opções que nem as animações de local, a primeira animação que eu quero é duas espadas se cruzando e nome royals aparecendo", e em seguida "faça o protótipo da animação". A ideia emprestada é só o conceito de abertura de batalha curta e marcante; o desenho é próprio.

**Estado: protótipo para o mestre aprovar.** Nada no app, nada em `client/src/animacoes/aprovadas.json`, nada enviado ao GitHub.

## Abrir

`prototipo.html` abre direto no navegador (precisa de internet para baixar o three.js da CDN). Tem o seletor de abertura (por enquanto só "Espadas cruzadas"), o campo do nome (padrão "Royals", até 24 letras), Repetir, Som, Câmera lenta (1/4 da velocidade), Tela cheia e Movimento reduzido. Digitar no nome mostra o quadro parado com o nome novo; ao parar de digitar, a animação toca de novo, e Enter toca na hora.

## O que acontece (2,8 s)

| Tempo | O quê |
|---|---|
| 0 a 0,38 s | As duas espadas entram pelos lados, girando para a frente, e freiam até parar armadas |
| 0,38 a 0,48 s | Recuo curto (antecipação) |
| 0,48 a 0,6 s | O golpe acelera até o encontro |
| 0,6 s | Choque: o quadro segura um instante, clarão, estrela de quatro raios, onda, 64 faíscas, tremor e soco de câmera; som de estalo, "shiiing" da lâmina raspando, tinido das duas lâminas e batida grave |
| 0,66 a 1,45 s | O nome nasce do clarão em brasa, do centro para as pontas, e esfria em ouro envelhecido; brasas sobem devagar ao fundo |
| 1,3 a 1,95 s | Um reflexo corre pelas lâminas e depois pelo nome ("tiin" baixinho) |
| 2,1 a 2,52 s | Dois cortes em X riscam a tela e quatro cunhas pretas fecham sobre o cruzamento (batida grave) |
| 2,52 a 2,8 s | Preto, para a troca de tela |

Com movimento reduzido: as espadas surgem já cruzadas, sem voo, tremor, faíscas, rastro nem cunhas; o clarão é só de luz, o nome acende no lugar e o fim é um escurecer. O som do choque fica.

Estilo: fundo escuro e quente, aço de duas facetas com fio claro do lado da luz, guarda de latão com granada, punho de couro trançado, contornos marrom-escuros (nunca preto puro) e a fonte de título do app (Sitka Banner, com Constantia e Georgia de reserva).

## Código

- A cena é um módulo pronto para o pacote: `client/src/animacoes/batalha/espadas-cruzadas.ts` + `espadas-cruzadas.json` (nome, `duracaoNaturalS` 2,8, `quadroDaMiniaturaS` 1,6). Mesmo contrato `CriarCena` das transições de local (`src/transicoes/tipos.ts`): tempo vindo de fora, `ajustarTela`, `descartar` e som sintetizado em `criarSom`. A única diferença é um campo opcional a mais nas opções, `nome`.
- Tudo é desenhado com `ShaderMaterial` sem conversão de cor na saída, então o que foi pintado no canvas é o que aparece. Sem luz na cena e sem imagem externa; espada e nome são pintados em canvas na hora (o nome é refeito a cada montagem).
- `prototipo.html` é gerado por `montar.cjs` a partir de `fonte.html`: `node docs/design/transicao-batalha-espadas/montar.cjs`, da raiz. Usa o mesmo código do módulo, empacotado pelo esbuild num IIFE (`AberturasDeBatalha`), e `three@0.186.1` da CDN (a versão do app).

## Para entrar no app (só depois do sim)

1. O tipo `batalha` ainda não existe: `scripts/pacote-animacoes.cjs` só lê os tipos que conhece (`EMBUTIDAS`), então hoje esta pasta é ignorada pelo pacote. Falta acrescentar o tipo lá e no carregador do app.
2. O motor (`src/transicoes/motor.ts`) passa só `{ reduzirMovimento }` para a cena; para o nome chegar, `OpcoesDaCena` ganha `nome?` (a cena já aceita).
3. A escolha da abertura e a reprodução no mestre, no jogador e na TV entram na fatia B5 da linha da batalha; pelo PEDIDOS.md, a B4 prevê levar no protocolo o id da abertura e o texto (no código da linha da batalha isso ainda não aparecia em 27/10).
4. Aprovar = acrescentar `"batalha/espadas-cruzadas"` em `aprovadas.json` e publicar o pacote.

## O que NÃO foi verificado

Por ordem do usuário (pressa, só protótipo), nenhum teste rodou: sem vitest, sem robô, sem folha de contato, sem gráfico do movimento, sem medição de som (LUFS, pico, cliques) e sem medição de quadro. Medir não é ouvir, e aqui nem medido foi: o som só existe no código.

O que rodou: `rtk proxy npx tsc --noEmit` (zero erro) e uma abertura num Chrome headless com GPU, que tocou sem erro no console e rendeu 2 prints (o choque e o quadro de 1,6 s com um nome longo). O enquadramento foi aproximado depois desses prints (a câmera chegou mais perto) e não foi visto de novo. Não conferido: celular e tela estreita, tema escuro da página, outro navegador, Safari/WebKit (o desenho usa `roundRect` do canvas) e o quadro da miniatura do app a 320 × 180.

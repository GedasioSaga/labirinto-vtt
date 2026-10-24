# Luz e Dia/Tarde/Noite (5.1): plano de 24/10/2026

Origem: `docs/planos/roteiro-pos-redesign-2026-10-22.md` seção 5.1. Plano de leitura do `arquiteto-solucoes` sobre a main `37b48d22`. As decisões D1 a D6 seguem as recomendações dele ("faça o recomendado", usuário, 23/10/2026). A ordem do roteiro põe a 5.1 depois da otimização (Fase 4); só L0 e L4a adiantam com segurança.

## O que já existe
`Light` (`types/map.ts:318`) com `attachedTokenId`, `vistaDeLonge`, `apagada`, `porEstado`; `pixi/drawLights.ts` barra a luz na parede com `computeVisibility` e cache; o jogador desenha luz (`PlayerView.tsx:2287`; jornada `e2e/task-jornada-luz-que-para-na-parede.spec.ts`); cena e sala escuras por `lib/darkness.ts` (`darkVision`, MAX_SEEDS=4) e `fogFilter.ts:2654-2732`; visão por cena `lib/sceneVision.ts`; relógio atual em `stores/clockStore.ts` e `lib/campaignClock.ts` (`DayPeriod='manha'|'tarde'|'noite'`, `externa`, `NIGHT_VISION_FACTOR=0.5`). Não há camada de tinta ambiente nem som por período.

## Modelo de dados (tudo opcional; mapa sem o campo abre idêntico)
- `type Periodo = 'dia' | 'tarde' | 'noite'` em `types/map.ts` (ler `'manha'` antigo como `'dia'`). Sessão: `Adventure.periodo?` (ausente = dia), persistido na aventura. Cena: reusar `externa?: true` (segue a sessão) e `periodoFixo?: Periodo`; sem nenhum dos dois, a cena é interior e ignora a troca. Provedor puro `lib/periodo.ts: periodoDaCena(map, sessao)` (é o gancho do Caminhos).
- `visaoPorPeriodo?: {tarde?: number; noite?: number}` em casas (sem o campo, noite = `visionCells*0.5`, como hoje). Luz: `acesaEm?: Periodo[]` (ausente = sempre acesa; `apagada`/`porEstado` vencem; nunca vai ao jogador). `corAmbiente?` e `somAmbiente?` por período (id de som do 5.4).

## Render e vazamento
Mapa de luz único `pixi/mapaDeLuz.ts` (RenderTexture a meia resolução com a cor do período, luzes recortadas pela parede em blend aditivo, um sprite em multiply), refeito só quando muda luz, parede, período ou viewport; no jogador trocar o `JSON.stringify` de `PlayerView.tsx:2295` por chave de revisão; no editor a tinta atenuada (50%) com "Ver como jogador"; luz em camada só entra se a camada é visível ao destinatário. Vazamento: NPC no escuro a 8 casas não chega; sob lampião com linha de visão livre chega; luz atrás de parede não revela; `acesaEm`, `periodoFixo` e período de outra cena ausentes do pacote. Já existente: o vulto de `shadowOfOtherPlayer` (`fogFilter.ts:1462`) usa o raio da luz sem parede.

## Fatias (teste vermelho primeiro; * = arquivo quente)
- **L0** Periodo e provedor (`types/map.ts`*, `lib/periodo.ts`, `lib/mapFile.ts`): tabela de 6 casos e round-trip de mapa antigo byte-igual. Vai primeiro e sozinho; o Caminhos faz `git merge main`.
- **L1** Sessão sem relógio: botão Dia/Tarde/Noite persistido; 0 campos de hora no snapshot; a troca chega em 1 mensagem; cena interior não muda (`clockStore.ts` sai, `campaignClock.ts`, `CampaignClockSection.tsx`, `PlayerClockBadge.tsx`, `protocol.ts`, `hostSession.ts`*, `fogFilter.ts`*, `App.tsx`*, `lib/adventure.ts`*).
- **L2** Visão por período + testes de vazamento: filtro do host p95 <= 10 ms por jogador na vila com 20 luzes e 30 NPCs; troca com 7 jogadores sem tarefa >= 200 ms.
- **L3** Luz que acende sozinha (`acesaEm`), presets Tocha/Lampião/Fogueira.
- **L4a** Protótipo HTML das 3 cores e do gradiente quente aprovado pelo usuário (`designer-opus`, só `docs/design/luz/`). **L4b** `mapaDeLuz.ts` + mount (CPU 4x, vila com 20 luzes, pan/zoom p95 <= 20 ms, refazer <= 8 ms, 0 tarefas >= 200 ms). **L5** transição de 1,5 s. **L6** som por período (depois do 5.4). **L7** = F7 do Caminhos.
- Paralelo seguro: L0 já; L4a a qualquer hora; núcleo de L4b em arquivo novo. L1 a L3 com 1 dono em sequência, fora da janela de Caminhos F2-F4 (mesmos arquivos quentes).

## Decisões (recomendadas, aplicadas)
D1 cena sem marca é interior e ignora a troca; D2 fichas escurecem à noite (só a do próprio jogador ganha contorno legível); D3 sem campo "interior" por sala na 1ª entrega (`room.dark` cobre); D4 colocar lampião/fogueira/tocha cria uma `Light` normal com `acesaEm` pronto, sem vínculo com o móvel; D5 tinta no editor a 50% com "Ver como jogador"; D6 persistir o período na aventura.

## Riscos
`darkVision` no mapa inteiro ao ar livre à noite pode custar caro (medir em L2 antes do render); multiply sobre pergaminho pode ficar barrento (por isso L4a); renomear `manha` para `dia` quebra testes (`hostSession.retomarExploracao.test.ts`); tocha de NPC vista de longe denuncia o movimento dele. Não confirmado: custo real no webview e no celular; se o lampião do Meio-Termo já cria Light; modelo de id de som do 5.4.

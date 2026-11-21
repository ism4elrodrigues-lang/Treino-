# Meu Treino

Web app de celular para registrar treinos e saber **quando subir a carga**, seguindo o método do livro
*Malhar, Secar, Definir* (Michael Matthews): treino pesado na faixa de **4–6 repetições** com **progressão dupla**.

## Como o app decide a carga

| Resultado da série | O que o app manda fazer |
|---|---|
| Bateu 6 reps (topo da faixa) | **Subir** já na próxima série: +5 kg na barra, +2 kg nos halteres |
| 4–5 reps | **Manter** a carga e buscar 6 |
| Menos de 4 reps logo após subir | **Voltar** para a carga anterior |
| Menos de 4 reps sem ter subido | Manter e tentar de novo |
| 3 treinos seguidos sem subir | Aviso de estagnação (deload ou trocar a variação) |

A carga com que você termina um exercício vira a carga sugerida no próximo treino desse exercício.

## Funcionalidades

- Divisão de 5 dias do livro (Peito, Costas, Ombros, Pernas, Braços), editável na aba **Plano**
- **Tela inicial**: saudação, semanas seguidas treinando, cartão do treino de hoje (exercícios com a carga do dia e ▲ onde subiu, séries e tempo estimado, desenho do exercício principal), sequência dos dias (toque para trocar o treino), a semana de seg a dom, peso com o ritmo, último treino (cargas que subiram, recordes) e quanto falta para o deload
- **Força em bichos**: ao finalizar o treino, um resumo mostra o volume levantado comparado a um animal ou objeto (ex.: 6.450 kg ≈ um elefante-africano 🐘), a série mais pesada e o total desde o início. A comparação também aparece no Histórico e na tela inicial
- **Conquistas**: 12 medalhas (levantou um panda/leão/elefante/ônibus, primeiro recorde, 4 semanas seguidas, 50 treinos, baleia-azul, proteína em dia…), com galeria no Histórico e aviso no resumo quando uma é desbloqueada
- Treino com **um exercício aberto por vez**: feitos em verde (com séries e carga da próxima vez), o atual aberto em amarelo, os que faltam em cinza e os começados pela metade em amarelo fraco. Ao terminar um, o próximo abre sozinho (primeiro os que ficaram pela metade); tocar em qualquer linha abre aquele exercício. O topo mostra "Exercícios feitos X de Y"
- **Plano** organizado: dias fechados mostrando os exercícios; abrir um dia lista os exercícios em linhas curtas e só um abre para edição por vez
- **Como fazer**: desenho animado de cada exercício (posição inicial → final), músculos trabalhados e 3 dicas de execução. Exercícios novos podem usar qualquer desenho, escolhido no Plano
- Timer de descanso (3 min por padrão) que começa sozinho, com vibração e bipe
- **Aquecimento** como item próprio do treino, antes do primeiro exercício do dia: 12 reps a 50%, 10 a 50%, 4 a 70% e 1 a 90% da carga de trabalho. Cada série tem ✓ que inicia o descanso (1 min, e 3 min antes da série pesada); na 4ª, o aquecimento fica verde e o exercício abre. Dá para digitar a carga ali mesmo ou pular o aquecimento
- **Anilhas por lado**: para exercícios com barra, mostra quais anilhas colocar (barra e anilhas configuráveis em Ajustes)
- **Anotações por série** (ex.: "dor no ombro"), mostradas de novo no próximo treino do exercício
- **Semana de deload**: ao iniciar, as cargas aparecem a ~60% e os treinos não mexem na progressão
- **Dieta → Meta e peso**: escolha a fase (**Crescer**, **Secar** ou **Manter**) e o app mostra a meta de calorias e macros do dia. Com o peso registrado, ele diz se você deve comer mais, menos ou continuar igual, e aplica o ajuste na meta com um toque. Também avisa quando trocar de fase pelo % de gordura (~17% para secar, ~10% para voltar a crescer)
- **Dieta → Cardápio**: monte as refeições uma vez com alimentos da Tabela TACO (ou cadastrados pelo rótulo). Barras mostram o total contra a meta e o app sugere ajustes realistas (proteína primeiro, depois calorias pelo carboidrato) que você aplica com um toque. O botão **Montar cardápio de exemplo** monta 4 refeições com alimentos comuns já nas quantidades da sua meta, como ponto de partida
- **Dieta → Hoje**: marque "Comi" em cada refeição, registre trocas ("Comi diferente") e extras, e veja se o dia ficou dentro da meta
- Histórico com gráfico da carga e do 1RM estimado por exercício
- Aviso de deload a cada 8 semanas (configurável)
- Backup: exportar e importar um arquivo `.json`
- Funciona offline e pode ser instalado na tela inicial (PWA). Os dados ficam só no aparelho.

## Como colocar no celular

O app é só HTML, CSS e JavaScript, sem build. Basta hospedar os arquivos em qualquer endereço HTTPS.
O jeito mais simples é o **GitHub Pages**:

1. No GitHub, abra o repositório e vá em **Settings → Pages**.
2. Em *Source*, escolha **Deploy from a branch**, selecione a branch e a pasta `/ (root)` e salve.
3. Abra no celular o endereço que aparecer (`https://<usuario>.github.io/<repositorio>/`).
4. Adicione à tela inicial: **Android/Chrome**: menu ⋮ → *Instalar app*. **iPhone/Safari**: Compartilhar → *Adicionar à Tela de Início*.

> Ao publicar uma nova versão, aumente `CACHE` em `sw.js` (por exemplo, `treino-v2`) para o celular baixar os arquivos novos.

## Dados de alimentos

`foods.js` traz 92 alimentos comuns da **Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed. revisada e ampliada (NEPA/UNICAMP, 2011)**, por 100 g, a partir da versão em CSV de [isaquetdiniz/taco-api](https://github.com/isaquetdiniz/taco-api) (MIT). Valores "Tr" e "NA" entram como 0. Leite integral e desnatado não têm valores nesse arquivo e ficaram de fora (cadastre pelo rótulo).

## Rodar localmente

```bash
python3 -m http.server 8000
```

Abra http://localhost:8000.

## Testes

As regras de progressão ficam em `logic.js` (funções puras) e são testadas com o runner do Node:

```bash
node --test
```

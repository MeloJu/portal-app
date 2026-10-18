# Roteiro de teste manual: front ↔ back

Dez passos para conferir no navegador que o front fala com a API de verdade. Leva uns 10 minutos.
Rode antes de abrir o PR de uma mudança que mexa em sessão, portais, Travessia ou Proteção.

## Pré-requisitos

1. Na raiz do repositório, copie o `.env.example` para `.env` (se ainda não existir). Os scripts do
   backend geram o `JWT_SECRET` sozinhos. Confira que o `.env` tem:

   ```env
   PUBLIC_BASE_URL=http://localhost:5173
   SESSION_COOKIE_SECURE=false
   ```

2. Suba o banco e o backend, num terminal:

   ```bash
   ./scripts/dev-backend.sh          # Java 21 local
   ./scripts/dev-backend-docker.sh   # ou sem Java, pelo Docker
   ```

3. Suba o front, em outro terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Confira o proxy: `curl -i http://localhost:5173/api/me` responde `401`. Se responder `404` ou
   `502`, o backend não está de pé na porta 8080.

Use um e-mail novo a cada rodada (ex.: `roteiro-<data>@example.com`). O rate limit é de 60
requisições por minuto por IP em login, cadastro e Travessia; se aparecer "muitas tentativas",
espere um minuto.

## Passos

| # | Faça | Resultado esperado |
| --- | --- | --- |
| 1 | Abra `http://localhost:5173`, clique em **Criar conta**, preencha nome, e-mail e uma senha de 8+ caracteres e envie. | Vai para `/dashboard`. O título diz "Olá, {primeiro nome}" e o perfil, no rodapé da barra lateral, mostra o nome e as iniciais. |
| 2 | Clique em **Sair** e entre de novo com o mesmo e-mail e senha. | Sair leva ao `/login`. O login volta ao `/dashboard` com o mesmo nome. Uma senha errada mostra o erro de credenciais, sem sair da tela. |
| 3 | Na Visão geral, cole `https://example.com/roteiro` e um nome personalizado (ex.: `roteiro-1`) e crie o portal. | O prefixo do campo é `localhost:5173/`. Aparece o link curto `localhost:5173/roteiro-1`, e o portal entra em "Portais recentes". |
| 4 | Copie o link curto e abra numa aba anônima. | A Travessia mostra o destino `example.com` e pergunta "Deseja mesmo prosseguir?". O botão "Sim, prosseguir" aponta para `https://example.com/roteiro`. |
| 5 | Volte ao dashboard (aba normal) e espere alguns segundos. | O card "Viagens realizadas" sobe 1, sem recarregar a página. Em **Meus portais**, o card do `roteiro-1` mostra 1 viagem. |
| 6 | Em **Meus portais**, abra o menu do `roteiro-1` e clique em **Pausar portal**. Recarregue a aba anônima. | O card mostra o status "Pausado". A Travessia mostra "Este portal está pausado." e não oferece o botão de prosseguir. |
| 7 | Abra **Proteção**. | O histórico tem "Viagem em portal pausado" com o código `roteiro-1`, e o contador de ameaças bloqueadas subiu. |
| 8 | Volte a **Meus portais**, clique em **Retomar portal**, depois em **Fechar portal** e confirme com **Sim**. Recarregue a aba anônima. | Depois de retomar, a Travessia volta a mostrar o destino. Depois de fechar, mostra "Este portal foi fechado.", e o card aparece no filtro "Fechados". |
| 9 | Tente criar um portal com o nome personalizado `api` (qualquer destino). | O formulário mostra o erro de nome reservado da API e nenhum portal é criado. Na Proteção aparece "Nome reservado recusado". |
| 10 | Numa aba anônima, abra `http://localhost:5173/dashboard`. | Vai direto para `/login`, sem mostrar o dashboard. |

## Se algo falhar

- **Passo 4 abre em `:8080` e dá 404:** o `PUBLIC_BASE_URL` do `.env` não aponta para o Vite.
  Corrija e reinicie o backend.
- **Criar portal com destino `localhost` dá erro de loop:** é esperado. O backend recusa destino no
  próprio host (`SELF_LOOP`); use um domínio externo.
- **Passo 5 conta 2 viagens:** a Travessia chamou a API fora do loader. Veja a decisão 5 do plano
  de integração e o E2E `uma visita à Travessia conta uma viagem só`.
- **A tela diz que a estação está fora do ar:** o backend caiu ou não subiu. Veja o terminal dele.

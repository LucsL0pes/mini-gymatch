# mini-gymatch

Aplicação composta por um backend em Node.js/Express e um app mobile em React Native (Expo) para gerenciamento do Gymatch.

## Estrutura do projeto

- `backend/` — API REST que integra com Supabase e valida comprovantes de matrícula usando IA.
- `mobile/` — aplicativo Expo que consome a API.

## Pré-requisitos

- Node.js 18 ou superior e npm instalados.
- Conta e projeto configurados no Supabase (com as tabelas esperadas pela API).
- Chave de API da OpenAI caso deseje ativar a validação automática de comprovantes.
- Expo CLI (via `npm install -g expo-cli`) ou uso dos comandos com `npx`.

## Backend

1. Instale as dependências:

   ```bash
   cd backend
   npm install
   ```

2. Crie um arquivo `.env` na pasta `backend` com as variáveis necessárias:

   ```bash
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=chave_service_role
   PORT=3000
   OPENAI_API_KEY=sua_chave_openai # opcional, obrigatório apenas se quiser validação automática
   GYM_PROOF_KEYWORDS=academia,mensalidade,matrícula # opcional, lista separada por vírgula
   PROOF_VALIDATION_MODEL=gpt-4.1-mini # opcional
   OPENAI_PROOF_ENDPOINT=https://api.openai.com/v1/responses # opcional
   ```

   > Se `OPENAI_API_KEY` não for configurada, a API receberá o comprovante e manterá o status como `manual_review` para revisão manual.

3. Execute o servidor em modo desenvolvimento:

   ```bash
   npm run dev
   ```

   A API ficará disponível em `http://localhost:3000`, com os endpoints expostos sob `/api/...` (ex.: `http://localhost:3000/api/proofs`).

## Mobile (Expo)

1. Instale as dependências do app:

   ```bash
   cd mobile
   npm install
   ```

2. Configure a URL da API criando um arquivo `.env` na pasta `mobile` (ou exportando a variável no ambiente) com a variável `EXPO_PUBLIC_API_URL` apontando para o backend. Exemplos:

   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:3000/api           # iOS simulador
   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api            # Android emulador
   EXPO_PUBLIC_API_URL=http://192.168.0.10:3000/api        # Dispositivo físico
   ```

   > Em emuladores Android, pode ser necessário rodar `adb reverse tcp:3000 tcp:3000` para que o app acesse o backend local.

3. Inicie o projeto Expo:

   ```bash
   npm run start
   ```

   Escolha a plataforma (Android, iOS ou web) no menu interativo do Expo.

## Dicas adicionais

- Mantenha o backend rodando antes de abrir o app mobile para evitar erros de conexão.
- O endpoint `GET /health` confirma se o servidor está ativo e `GET /health/db` testa a comunicação com o Supabase.
- Ajuste os caminhos padrão no arquivo `mobile/src/api/client.ts` caso prefira definir a URL diretamente no código em vez de usar variável de ambiente.

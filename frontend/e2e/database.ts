import { Client } from "pg";

function connect(): Client {
  return new Client({
    host: process.env.E2E_DB_HOST ?? "localhost",
    port: Number(process.env.E2E_DB_PORT ?? 5432),
    database: process.env.E2E_DB_NAME ?? "lumi",
    user: process.env.E2E_DB_USER ?? "lumi",
    password: process.env.E2E_DB_PASSWORD ?? "lumi",
  });
}

export async function verifyUserEmail(email: string): Promise<void> {
  const client = connect();
  await client.connect();
  try {
    const result = await client.query("update users set email_verified_at = now() where email = $1", [email]);
    if (result.rowCount !== 1) {
      throw new Error(`Usuário ${email} não encontrado para verificar o e-mail`);
    }
  } finally {
    await client.end();
  }
}

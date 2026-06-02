import 'dotenv/config';
import { Pool } from 'pg';

// Verifica se as variáveis de ambiente para configuração de banco de dados estão presentes, permitindo o uso de uma URL de conexão única ou configurações discretas, e garantindo que a configuração seja flexível e adaptável a diferentes ambientes de implantação
const hasDiscreteDbConfig = [
    process.env.DB_HOST,
    process.env.DB_PORT,
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
].some((value) => typeof value === 'string' && value.trim().length > 0);

// Determina se deve usar a variável de ambiente DATABASE_URL para a configuração de conexão, verificando se as configurações discretas não estão presentes e se a URL está definida e não é vazia, garantindo que a aplicação possa se conectar ao banco de dados de forma flexível, seja por meio de uma URL ou de configurações individuais
const shouldUseDatabaseUrl =
    !hasDiscreteDbConfig &&
    typeof process.env.DATABASE_URL === 'string' &&
    process.env.DATABASE_URL.trim().length > 0;

// Configura a conexão com o banco de dados, utilizando a URL de conexão se estiver disponível, ou as configurações discretas caso contrário, e incluindo a configuração de SSL com base na variável de ambiente DB_SSL para garantir uma conexão segura quando necessário
const connectionConfig = shouldUseDatabaseUrl
    ? {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }, // obrigatório no Neon
      }
    : {
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT || 5432),
          database: process.env.DB_NAME || 'postgres',
          user: process.env.DB_USER || 'postgres',
          password: String(process.env.DB_PASSWORD ?? ''),
          ssl:
              process.env.DB_SSL === 'true'
                  ? { rejectUnauthorized: false }
                  : false,
      };

export const db = new Pool(connectionConfig);

db.on('connect', async (client) => {
    await client.query('SET search_path TO public');
});

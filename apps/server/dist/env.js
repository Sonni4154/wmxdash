import 'dotenv/config';
const required = (key, allowEmpty = false) => {
    const v = process.env[key];
    if (!allowEmpty && (!v || v.trim() === ''))
        throw new Error(`Missing env: ${key}`);
    return v;
};
export const env = {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: Number(process.env.PORT ?? 3000),
    DATABASE_URL: required('DATABASE_URL'),
    INTEGRATION_PROVIDER: process.env.INTEGRATION_PROVIDER ?? 'quickbooks',
    QBO_CLIENT_ID: process.env.QBO_CLIENT_ID ?? '',
    QBO_CLIENT_SECRET: process.env.QBO_CLIENT_SECRET ?? '',
    QBO_REALM_ID: process.env.QBO_REALM_ID ?? '',
    QBO_REFRESH_TOKEN_INIT: process.env.QBO_REFRESH_TOKEN_INIT ?? '',
    ADMIN_API_KEY: process.env.ADMIN_API_KEY ?? '',
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
};

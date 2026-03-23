import dotenv from 'dotenv';
import path from 'path';

dotenv.config({path: path.resolve("./", '.env')});

function getEnvVar(key, defaultValue = undefined) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export default {port: parseInt(getEnvVar('PORT', '3000'), 10),
    db: {
        host: getEnvVar('DB_HOST'),
        user: getEnvVar('DB_USER'),
        pass: getEnvVar('DB_PASS'),
        port: getEnvVar('DB_PORT'),
        db: getEnvVar('DB')
    }
};

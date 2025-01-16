import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
const result = dotenv.config();

if (result.error) {
    console.error('Error loading .env file:', result.error);
    throw new Error('Failed to load environment variables');
}

// Define configuration schema
const ConfigSchema = z.object({
    openAiApiKey: z.string().min(1, 'OpenAI API key is required'),
    modelName: z.string().default('gpt-3.5-turbo'),
    temperature: z.number().min(0).max(2).default(0),
    maxTokens: z.number().positive().default(2000),
});

// Parse and validate configuration
let config;
try {
    config = ConfigSchema.parse({
        openAiApiKey: process.env.OPENAI_API_KEY,
        modelName: process.env.MODEL_NAME,
        temperature: parseFloat(process.env.TEMPERATURE ?? '0'),
        maxTokens: parseInt(process.env.MAX_TOKENS ?? '2000'),
    });

    console.log('Configuration loaded successfully');
} catch (error) {
    console.error('Configuration validation failed:', error);
    throw new Error('Invalid configuration');
}

export default config;
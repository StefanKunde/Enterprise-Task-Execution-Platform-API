export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongoUri: process.env.MONGO_URI,
  executorApiToken: process.env.EXECUTOR_API_TOKEN,
});

export default () => {
  const dbUrl = `${process.env.DB_URL}_${process.env.NODE_ENV}`;
  const nodeEnv = process.env.NODE_ENV;

  return {
    port: parseInt(process.env[`PORT_${nodeEnv}`], 10) || 7485,
    dbUrl: process.env[`DB_URL_${nodeEnv}`],
    baseUrl: process.env[`BASE_URL_${nodeEnv}`],
    httpsUrl: process.env.HTTPS_BASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpTime: process.env.JWT_ACCESS_EXPIRATION_HOURS,
    runWayMlSecret: process.env.RUNWAYML_API_SECRET,
    staticFilesUrl: `${process.env[`BASE_URL_${nodeEnv}`]}/public/arts`,
  };
};

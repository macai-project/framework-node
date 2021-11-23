import { captureMySQL } from "aws-xray-sdk";

export type Connection = captureMySQL.PatchedPoolConnection;
export type Pool = captureMySQL.PatchedPool;

export const createPool = (client: captureMySQL.PatchedMySQL): Pool => {
  return client.createPool({
    connectionLimit: 2,
    host: process.env.AURORA_HOSTNAME as string,
    user: process.env.AURORA_USERNAME as string,
    password: process.env.AURORA_PASSWORD as string,
    database: process.env.AURORA_DATABASE as string,
  });
};

export const getConnection = (pool: Pool): Promise<Connection> =>
  new Promise((resolve, reject) => {
    pool.getConnection((error, poolConnection) => {
      if (error) reject(error);
      poolConnection.ping((pingError) => {
        if (pingError) reject(pingError);
        resolve(poolConnection);
      });
    });
  });

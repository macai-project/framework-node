import { captureMySQL } from "aws-xray-sdk";

export type Connection = captureMySQL.PatchedConnection;

export const createConnection = (
  client: captureMySQL.PatchedMySQL
): Connection => {
  const connection = client.createConnection({
    host: process.env.AURORA_HOSTNAME as string,
    user: process.env.AURORA_USERNAME as string,
    password: process.env.AURORA_PASSWORD as string,
    database: process.env.AURORA_DATABASE as string,
  });
  connection.connect((error) => {
    if (error) {
      console.error("Unable to connect to the database:", error);
    }
    console.info("Database connection established successfully.");
  });
  return connection;
};

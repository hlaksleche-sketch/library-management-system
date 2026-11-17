import 'dotenv/config';
import mysql from 'mysql2/promise';

export const database = process.env.DB_NAME || 'biwa_library';
if (!/^[A-Za-z0-9_]{1,64}$/.test(database)) throw new Error('Invalid DB_NAME.');

export const connectionOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  timezone: 'Z'
};

export const db = mysql.createPool({ ...connectionOptions, database });

export async function atomic(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

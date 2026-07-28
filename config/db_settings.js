const mysql = require('mysql2');
const { dbHost, dbUser, dbPass, dbName } = require('./dotenvConfig');

class Database {
  constructor() {
    this.pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPass,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    this.pool.getConnection((err, connection) => {
      if (err) {
        console.error('Database Connectivity Error:', err.message);
        return;
      }
      console.log('Connected to database pool successfully!');
      connection.release();
    });
  }

  _query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, params, (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results);
      });
    });
  }

  select(tbl_name, column = '*', where = '', params = [], print = false) {
    let wr = '';
    if (where !== '') {
      wr = `WHERE ${where}`;
    }
    const sql = `SELECT ${column} FROM ${tbl_name} ${wr} LIMIT 1`;
    if (print) {
      console.log('SQL:', sql, 'Params:', params);
    }
    return this._query(sql, params).then((results) => results[0]);
  }

  selectAll(tbl_name, column = '*', where = '', params = [], orderby = '', print = false) {
    // Back-compat: callers sometimes pass `true` as where (meant print)
    if (typeof where === 'boolean') {
      print = where;
      where = '';
    }
    if (typeof params === 'boolean') {
      print = params;
      params = [];
    }
    if (typeof orderby === 'boolean') {
      print = orderby;
      orderby = '';
    }

    let wr = '';
    if (where !== '') {
      wr = `WHERE ${where}`;
    }
    const sql = `SELECT ${column} FROM ${tbl_name} ${wr} ${orderby}`;
    if (print) {
      console.log('SQL:', sql, 'Params:', params);
    }
    return this._query(sql, params);
  }

  insert(tbl_name, data, print = false) {
    const fields = Object.keys(data).map((key) => `\`${key}\``).join(',');
    const placeholders = Object.keys(data).map(() => '?').join(',');
    const values = Object.values(data);

    const sql = `INSERT INTO ${tbl_name} (${fields}) VALUES (${placeholders})`;
    if (print) {
      console.log('SQL:', sql, 'Params:', values);
    }
    return this._query(sql, values).then((result) => ({
      status: true,
      insertId: result.insertId,
      affected_rows: result.affectedRows,
      info: result.info,
    }));
  }

  update(table_name, form_data, where = '', params = [], print = false) {
    let whereSQL = '';
    if (where !== '') {
      whereSQL = ` WHERE ${where}`;
    }

    const sets = Object.entries(form_data).map(([column]) => `\`${column}\` = ?`);
    const values = Object.values(form_data);
    const queryParams = [...values, ...params];

    const sql = `UPDATE ${table_name} SET ${sets.join(', ')}${whereSQL}`;
    if (print) {
      console.log('SQL:', sql, 'Params:', queryParams);
    }
    return this._query(sql, queryParams).then((result) => ({
      status: true,
      affected_rows: result.affectedRows,
      info: result.info,
    }));
  }

  delete(tbl_name, where = '', params = [], print = false) {
    let whereSQL = '';
    if (where !== '') {
      whereSQL = ` WHERE ${where}`;
    }

    const sql = `DELETE FROM ${tbl_name}${whereSQL}`;
    if (print) {
      console.log('SQL:', sql, 'Params:', params);
    }
    return this._query(sql, params).then((result) => ({
      status: true,
      affected_rows: result.affectedRows,
      info: result.info,
    }));
  }

  /** Returns first row (legacy). Prefer queryOne / queryAll for clarity. */
  query(sql, params = [], print = false) {
    if (print) {
      console.log('SQL:', sql, 'Params:', params);
    }
    return this._query(sql, params).then((results) =>
      Array.isArray(results) ? results[0] : results
    );
  }

  queryOne(sql, params = [], print = false) {
    if (print) {
      console.log('SQL:', sql, 'Params:', params);
    }
    return this._query(sql, params).then((results) =>
      Array.isArray(results) ? results[0] : results
    );
  }

  queryAll(sql, params = [], print = false) {
    if (print) {
      console.log('SQL:', sql, 'Params:', params);
    }
    return this._query(sql, params);
  }

  insertAll(sql, params = [], print = false) {
    if (print) {
      console.log('SQL:', sql, 'Params:', params);
    }
    return this._query(sql, params).then(() => ({ status: true }));
  }

  async end() {
    return new Promise((resolve, reject) => {
      this.pool.end((err) => (err ? reject(err) : resolve()));
    });
  }
}

const db = new Database();

module.exports = db;

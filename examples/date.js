/* Copyright (c) 2015, 2022, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * This software is dual-licensed to you under the Universal Permissive License
 * (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
 * 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
 * either license.
 *
 * If you elect to accept the software under the Apache License, Version 2.0,
 * the following applies:
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   date.js
 *
 * DESCRIPTION
 *   Insert and query DATE and TIMESTAMP columns.
 *
 *   When bound in an INSERT, JavaScript Dates are inserted using
 *   TIMESTAMP WITH LOCAL TIMEZONE.  Similarly for queries, TIMESTAMP
 *   and DATE columns are fetched as TIMESTAMP WITH LOCAL TIMEZONE.
 *
 *   This example uses Node 8's async/await syntax.
 *
 *****************************************************************************///

// Using a fixed Oracle time zone helps avoid machine and deployment differences
process.env.ORA_SDTZ = 'UTC';

const fs = require('fs');
const oracledb = require('oracledb');
const dbConfig = require('./dbconfig.js');

// On Windows and macOS, you can specify the directory containing the Oracle
// Client Libraries at runtime, or before Node.js starts.  On other platforms
// the system library search path must always be set before Node.js is started.
// See the node-oracledb installation documentation.
// If the search path is not correct, you will get a DPI-1047 error.
let libPath;
if (process.platform === 'win32') {           // Windows
  libPath = 'C:\\oracle\\instantclient_19_12';
} else if (process.platform === 'darwin') {   // macOS
  libPath = process.env.HOME + '/Downloads/instantclient_19_8';
}
if (libPath && fs.existsSync(libPath)) {
  oracledb.initOracleClient({ libDir: libPath });
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function run() {

  let connection;

  try {
    let result, date;

    connection = await oracledb.getConnection(dbConfig);

    console.log('Creating table');

    const stmts = [
      `DROP TABLE no_datetab`,

      `CREATE TABLE no_datetab(
         id NUMBER,
         timestampcol TIMESTAMP,
         timestamptz  TIMESTAMP WITH TIME ZONE,
         timestampltz TIMESTAMP WITH LOCAL TIME ZONE,
         datecol DATE)`
    ];

    for (const s of stmts) {
      try {
        await connection.execute(s);
      } catch (e) {
        if (e.errorNum != 942)
          console.error(e);
      }
    }

    // When bound, JavaScript Dates are inserted using TIMESTAMP WITH LOCAL TIMEZONE
    date = new Date();
    console.log('Inserting JavaScript date: ' + date);
    result = await connection.execute(
      `INSERT INTO no_datetab (id, timestampcol, timestamptz, timestampltz, datecol)
       VALUES (1, :ts, :tstz, :tsltz, :td)`,
      { ts: date, tstz: date, tsltz: date, td: date });
    console.log('Rows inserted: ' + result.rowsAffected);

    console.log('Query Results:');
    result = await connection.execute(
      `SELECT id, timestampcol, timestamptz, timestampltz, datecol,
              TO_CHAR(CURRENT_DATE, 'DD-Mon-YYYY HH24:MI') AS CD
       FROM no_datetab
       ORDER BY id`);
    console.log(result.rows);

    console.log('Altering session time zone');
    await connection.execute(`ALTER SESSION SET TIME_ZONE='+5:00'`);  // resets ORA_SDTZ value

    date = new Date();
    console.log('Inserting JavaScript date: ' + date);
    result = await connection.execute(
      `INSERT INTO no_datetab (id, timestampcol, timestamptz, timestampltz, datecol)
       VALUES (2, :ts, :tstz, :tsltz, :td)`,
      { ts: date, tstz: date, tsltz: date, td: date });
    console.log('Rows inserted: ' + result.rowsAffected);

    console.log('Query Results:');
    result = await connection.execute(
      `SELECT id, timestampcol, timestamptz, timestampltz, datecol,
              TO_CHAR(CURRENT_DATE, 'DD-Mon-YYYY HH24:MI') AS CD
       FROM no_datetab
       ORDER BY id`);
    console.log(result.rows);

    // Show the queried dates are of type Date
    let ts = result.rows[0]['TIMESTAMPCOL'];
    ts.setDate(ts.getDate() + 5);
    console.log('TIMESTAMP manipulation in JavaScript:', ts);

  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

run();

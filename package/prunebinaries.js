/* Copyright (c) 2019, 2022, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * This software is dual-licensed to you under the Universal Permissive License
 * (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
 * 2.0 as shown at https://www.apache.org/licenses/LICENSE-2.0. You may choose
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
 *   prunebinaries.js
 *
 * DESCRIPTION
 *   Removes pre-built binaries for all other architectures.
 *   This can be used to reduce the footprint of a node-oracledb install.
 *
 * USAGE
 *   Invoke this from the top level directory.
 *   After an 'npm install oracledb' installs pre-built binaries, this file
 *   can be run with 'npm run prune'.
 *
 *****************************************************************************/

'use strict';

const fs = require('fs');
const nodbUtil = require('../lib/util.js');

const dir = nodbUtil.RELEASE_DIR;

let re = new RegExp(nodbUtil.BINARY_FILE);

try {
  let f = fs.readdirSync(dir);
  for (let i = 0; i < f.length; i++) {
    if (!f[i].match(re) && (f[i].match(/oracledb.*\.node(-buildinfo.txt)*/))) {
      fs.unlinkSync(dir + '/' + f[i]);
    }
  }
} catch (err) {
  console.error(err.message);
}

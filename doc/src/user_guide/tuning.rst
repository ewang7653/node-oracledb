.. _tuning:

********************
Node-oracledb Tuning
********************

Some general tuning tips are:

-  Tune your application architecture.

   A general application goal is to reduce the number of
   :ref:`round-trips <roundtrips>` between node-oracledb and the database.

   For multi-user applications, make use of connection pooling. Create
   the pool once during application initialization. Do not oversize the
   pool, see :ref:`Connection Pool Sizing <conpoolsizing>`. Use a session
   callback function to set session state, see :ref:`Connection Tagging and
   Session State <connpooltagging>`.

   Make use of efficient node-oracledb functions. For example, to insert
   multiple rows use :meth:`connection.executeMany()`
   instead of :meth:`connection.execute()`.

-  Tune your SQL statements. See the `SQL Tuning
   Guide <https://www.oracle.com/pls/topic/lookup?ctx=dblatest&id=TGSQL>`__.

   Use :ref:`bind variables <bind>` to avoid statement reparsing.

   Tune ``fetchArraySize`` and ``prefetchRows`` for each query, see
   :ref:`Tuning Fetch Performance <rowfetching>`.

   Do simple optimizations like :ref:`limiting the number of
   rows <pagingdata>` and avoiding selecting columns not used in the
   application.

   It may be faster to work with simple scalar relational values than to
   use Oracle named objects or collections.

   Make good use of PL/SQL to avoid executing many individual statements
   from node-oracledb.

   Tune the :ref:`Statement Cache <stmtcache>`.

   Enable :ref:`Client Result Caching <clientresultcache>` for small
   lookup tables.

-  Tune your database. See the `Database Performance Tuning
   Guide <https://www.oracle.com/pls/topic/lookup?ctx=dblatest&id=TGDBA>`__.

-  Tune your network. For example, when inserting or retrieving a large
   number of rows (or for large data), or when using a slow network,
   then tune the Oracle Network Session Data Unit (SDU) and socket
   buffer sizes, see `Oracle Net Services: Best Practices for Database
   Performance and High Availability <https://static.rainfocus.com/oracle/
   oow19/sess/1553616880266001WLIh/PF/OOW19_Net_CON4641_
   1569022126580001esUl.pdf>`__.

-  Do not commit or rollback unnecessarily. Use
   :ref:`autoCommit <propexecautocommit>` on the last of a sequence of
   DML statements.

.. _rowfetching:

Tuning Fetch Performance
========================

To tune queries you can adjust node-oracledb’s internal buffer sizes to
improve the speed of fetching rows across the network from the database,
and to optimize memory usage. Regardless of which node-oracledb function
is used to get query results, internally all rows are fetched in batches
from the database and buffered before being returned to the application.
The internal buffer sizes can have a significant performance impact. The
sizes do not affect how, or when, rows are returned to your application.
They do not affect the minimum or maximum number of rows returned by a
query.

For best performance, tune “array fetching” with
:ref:`fetchArraySize <propexecfetcharraysize>` and “row prefetching”
with :ref:`prefetchRows <propexecprefetchrows>` in each
:meth:`connection.execute()` or :meth:`connection.queryStream()` call.
Note when using :meth:`getRows(numRows) <resultset.getrows()>`, where
``numRows`` is greater than 0, then tuning of “array fetching” is based on
the ``numRows`` value instead of ``fetchArraySize``. Also note that queries
that return LOBs and similar types will never prefetch rows, so the
``prefetchRows`` value is ignored in those cases.

The common query tuning scenario is for SELECT statements that return a
large number of rows over a slow network. Increasing ``fetchArraySize``
can improve performance by reducing the number of
:ref:`round-trips <roundtrips>` to the database. However increasing this
value increases the amount of memory required. Adjusting
``prefetchRows`` will also affect performance and memory usage.

Row prefetching and array fetching are both internal buffering
techniques to reduce :ref:`round-trips <roundtrips>` to the database. The
difference is the code layer that is doing the buffering, and when the
buffering occurs. The Oracle Client libraries used by node-oracledb have
separate “execute SQL statement” and “fetch data” calls. Prefetching
allows query results to be returned to the application when the
successful statement execution acknowledgement is returned from the
database. This means that a subsequent internal “fetch data” operation
does not always need to make a round-trip to the database because rows
are already buffered in the Oracle Client libraries. Reducing
round-trips helps performance and scalability. An overhead of
prefetching is the need for an additional data copy from Oracle Client’s
prefetch buffers.

Choosing values for ``fetchArraySize`` and ``prefetchRows``
-----------------------------------------------------------

The best ``fetchArraySize`` and ``prefetchRows`` values can be found by
experimenting with your application under the expected load of normal
application use. This is because the cost of the extra memory copy from
the prefetch buffers when fetching a large quantity of rows or very
“wide” rows may outweigh the cost of a round-trip for a single
node-oracledb user on a fast network. However under production
application load, the reduction of round-trips may help performance and
overall system scalability. The documentation in :ref:`Database
Round-trips <roundtrips>` shows how to measure round-trips.

Here are some suggestions for the starting point to begin your tuning:

-  To tune queries that return an unknown number of rows, estimate the
   number of rows returned and choose an appropriate value for
   ``fetchArraySize``. Then set ``prefetchRows`` to the same value. For
   example:

   .. code-block:: javascript

    const sql = `SELECT *
                 FROM very_big_table`;

    const binds = [];

    const options = { prefetchRows: 1000, fetchArraySize: 1000, resultSet: true };

    const result = await connection.execute(sql, binds, options);

   The default ``fetchArraySize`` is 100 and the default
   ``prefetchRows`` is 2. Adjust the values as needed for performance,
   memory and round-trip usage. The sizes used will affect memory
   allocation of buffers, so do not make the sizes unnecessarily large.
   For example, if your query always returns under 500 rows, then avoid
   setting ``fetchArraySize`` to 10000.

   In this scenario, aim to keep ``fetchArraySize`` equal to
   ``prefetchRows``. However, for a large quantity of rows or very
   “wide” rows on fast networks you may prefer to leave ``prefetchRows``
   at its default value.

-  If you are fetching a fixed number of rows, start your tuning by
   setting ``fetchArraySize`` to the number of expected rows, and set
   ``prefetchRows`` to one greater than this value. Adding one removes
   the need for a round-trip to check for end-of-fetch.

   For example, if you are querying 20 rows, perhaps to :ref:`display a
   page <pagingdata>` of data, then set ``prefetchRows`` to 21 and
   ``fetchArraySize`` to 20:

   .. code-block:: javascript

    const myoffset = 0;       // do not skip any rows (start at row 1)
    const mymaxnumrows = 20;  // get 20 rows

    const sql = `SELECT last_name
                 FROM employees
                 ORDER BY last_name
                 OFFSET :offset ROWS FETCH NEXT :maxnumrows ROWS ONLY`;

    const binds = { offset: myoffset, maxnumrows: mymaxnumrows };

    const options = { prefetchRows: mymaxnumrows + 1, fetchArraySize: mymaxnumrows };

    const result = await connection.execute(sql, binds, options);

   This will return all rows for the query in one round-trip.

-  If you know that a query returns just one row then set
   ``fetchArraySize`` to 1 to minimize memory usage. The default
   prefetch value of 2 allows minimal round-trips for single-row
   queries:

   .. code-block:: javascript

    const sql = `SELECT last_name
                 FROM employees
                 WHERE employee_id = :bv`;

    const binds = [100];

    const options = { fetchArraySize: 1 };

    const result = await connection.execute(sql, binds, options);

There are two cases that will benefit from disabling row prefetching by
setting ``prefetchRows`` to 0:

-  When a query returns a ResultSet which is then passed into PL/SQL.
   Set ``prefetchRows`` to 0 during the initial query so the first rows
   from the cursor are not prematurely (and silently) fetched by
   node-oracledb. This lets all rows be available to the later,
   receiving PL/SQL code. See :ref:`REF CURSOR Bind
   Parameters <refcursors>`.

-  When querying a PL/SQL function that uses PIPE ROW to emit rows at
   intermittent intervals. By default, several rows needs to be emitted
   by the function before node-oracledb can return them to the
   application. Setting ``prefetchRows`` to 0 helps give a consistent
   flow of data to the application.

Prefetching can also be enabled in an external
:ref:`oraaccess.xml <oraaccess>` file, which may be useful for tuning
an application when modifying its code is not feasible. Setting the size
in ``oraaccess.xml`` or with the global ``oracledb.prefetchRow``
attribute will affect the whole application, so it should not be the
first tuning choice.

.. _roundtrips:

Database Round-trips
====================

A round-trip is defined as the trip from the Oracle Client libraries
(used by node-oracledb) to the database and back. Calling each
node-oracledb function, or accessing each attribute, will require zero
or more round-trips. Along with tuning an application’s architecture and
`tuning its SQL statements <https://www.oracle.com/pls/topic/lookup?
ctx=dblatest&id=TGSQL>`__, a general performance and scalability goal is
to minimize `round-trips <https://www.oracle.com/pls/topic/lookup?ctx=
dblatest&id=GUID-9B2F05F9-D841-4493-A42D-A7D89694A2D1>`__.

Some general tips for reducing round-trips are:

-  Tune :ref:`fetchArraySize <propexecfetcharraysize>` and
   :ref:`prefetchRows <propexecprefetchrows>` for each query.
-  Use :meth:`~connection.executeMany()` for optimal DML execution.
-  Only commit when necessary. Use :ref:`autoCommit <propexecautocommit>`
   on the last statement of a transaction.
-  For connection pools, use a callback to set connection state, see
   :ref:`Connection Tagging and Session State <connpooltagging>`.
-  Make use of PL/SQL procedures which execute multiple SQL statements
   instead of executing them individually from node-oracledb.
-  Use scalar types instead of :ref:`Oracle Database object
   types <objects>`.
-  Avoid overuse of :meth:`connection.ping()`, and avoid setting
   :attr:`~pool.poolPingInterval` too low.
-  When using SODA, use pooled connections and enable the :ref:`SODA metadata
   cache <sodamdcache>`.

Finding the Number of Round-Trips
---------------------------------

Oracle’s `Automatic Workload Repository <https://www.oracle.com/pls/topic/
lookup?ctx=dblatest&id=GUID-56AEF38E-9400-427B-A818-EDEC145F7ACD>`__
(AWR) reports show ’SQL*Net roundtrips to/from client’ and are useful
for finding the overall behavior of a system.

Sometimes you may wish to find the number of round-trips used for a
specific application. Snapshots of the ``V$SESSTAT`` view taken before
and after doing some work can be used for this:

.. code-block:: sql

  SELECT ss.value, sn.display_name
  FROM v$sesstat ss, v$statname sn
  WHERE ss.sid = SYS_CONTEXT('USERENV','SID')
  AND ss.statistic# = sn.statistic#
  AND sn.name LIKE '%roundtrip%client%';

Example of finding the number of round-trips
++++++++++++++++++++++++++++++++++++++++++++

First, find the session id of the current connection:

.. code-block:: javascript

  const r = await connection.execute(`SELECT sys_context('userenv','sid') FROM dual`);
  const sid = r.rows[0][0];  // session id

This can be used with ``V$SESSTAT`` to find the current number of
round-trips. A second connection is used to avoid affecting the count.
If your user does not have access to the V$ views, then use a SYSTEM
connection:

.. code-block:: javascript

  async function getRT(sid) {
    let systemconnection;
    try {
      systemconnection = await oracledb.getConnection(
         'system', process.env.SYSTEMPASSWORD, 'localhost/orclpdb1');
      const result = await systemconnection.execute(
        `SELECT ss.value
        FROM v$sesstat ss, v$statname sn
        WHERE ss.sid = :sid
        AND ss.statistic# = sn.statistic#
        AND sn.name LIKE '%roundtrip%client%'`,
        [sid]
      );
      return (result.rows[0]);
    } catch (err) {
      console.error(err);
    } finally {
      if (systemconnection) {
        try {
          await systemconnection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

The main part of the application performs the “work” and calls
``getRT()`` to calculate the number of round-trips the work takes:

.. code-block:: javascript

  let before, after;

  //
  // Multiple execute() calls with explicit commit()
  //

  before = await getRT(sid);

  const bindArray = [
    [1, 'Victory'],
    [2, 'Beagle'],
  ];
  for (const binds of bindArray) {
    await connection.execute(
      `INSERT INTO ships (id, name) values (:i, :n)`,
      binds
    );
  }
  connection.commit();

  after = await getRT(sid);
  console.log('Round-trips required: ' + (after - before));   // 3 round-trips

  //
  // executeMany() with autoCommit
  //

  before = await getRT(sid);

  const options = {
    autoCommit: true,
    bindDefs: [
      { type: oracledb.NUMBER },
      { type: oracledb.STRING, maxSize: 20 }
    ]
  };

  connection.executeMany(
    `INSERT INTO ships (id, name) values (:1, :2)`,
    [
      [1, 'Victory'],
      [2, 'Beagle'],
    ],
    options
  );

  after = await getRT(sid);
  console.log('Round-trips required: ' + (after - before));   // 1 round-trip

.. _stmtcache:

Statement Caching
=================

Node-oracledb’s :meth:`~connection.execute()`,
:meth:`~connection.executeMany()`, :meth:`~connection.getStatementInfo()`,
and :meth:`~connection.queryStream()` methods use the `Oracle Call
Interface statement cache <https://www.oracle.com/pls/topic/lookup?
ctx=dblatest&id=GUID-4947CAE8-1F00-4897-BB2B-7F921E495175>`__
to make re-execution of statements efficient. Statement caching lets
cursors be used without re-parsing the statement. Each cached statement
will retain its cursor. Statement caching also reduces meta data
transfer costs between node-oracledb and the database. Performance and
scalability are improved.

Each non-pooled connection and each session in the connection pool has
its own cache of statements with a default size of 30. The cache key is
the statement string. This means a single cache entry can be reused when
a statement is re-executed with different bind variable values.

The statement cache removes the need for the separate ‘prepare’ or
‘parse’ methods which are sometimes seen in other Oracle APIs: there is
no separate method in node-oracledb.

Setting the Statement Cache
---------------------------

The statement cache size can be set globally with :attr:`oracledb.stmtCacheSize`:

.. code-block:: javascript

  oracledb.stmtCacheSize = 40;

The value can be overridden in an ``oracledb.getConnection()`` call, or
when creating a pool with :meth:`oracledb.createPool()`.
For example:

.. code-block:: javascript

  await oracledb.createPool({
    user              : "hr",
    password          : mypw,               // mypw contains the hr schema password
    connectString     : "localhost/XEPDB1",
    stmtCacheSize     : 50
  });

When using Oracle Client 21 (or later), changing the cache size with
:meth:`pool.reconfigure()` does not immediately affect connections
previously acquired and currently in use. When those connections are
subsequently released to the pool and re-acquired, they will then use
the new value. When using Oracle Client prior to version
21, changing the pool’s statement cache size has no effect on
connections that already exist in the pool but will affect new
connections that are subsequently created, for example when the pool
grows.

Tuning the Statement Cache
--------------------------

In general, set the statement cache to the size of the working set of
statements being executed by the application. :ref:`SODA <sodaoverview>`
internally makes SQL calls, so tuning the cache is also beneficial for
SODA applications.

With Oracle Client Libraries 12c, or later, the statement cache size can
be automatically tuned with the :ref:`Oracle Client
Configuration <oraaccess>` ``oraaccess.xml`` file.

For manual tuning use views like ``V$SYSSTAT``:

.. code-block:: sql

  SELECT value FROM V$SYSSTAT WHERE name = 'parse count (total)'

Find the value before and after running application load to give the
number of statement parses during the load test. Alter the statement
cache size and repeat the test until you find a minimal number of
parses.

If you have `Automatic Workload Repository <https://www.oracle.com/pls/topic/
lookup?ctx=dblatest&id=GUID-56AEF38E-9400-427B-A818-EDEC145F7ACD>`__
(AWR) reports you can monitor general application load and the “bytes
sent via SQL*Net to client” values. The latter statistic should benefit
from not shipping statement metadata to node-oracledb. Adjust the
statement cache size and re-run the test to find the best cache size.

Disabling the Statement Cache
-----------------------------

Individual statements can be excluded from the statement cache by
setting the attribute :ref:`keepInStmtCache <propexeckeepinstmtcache>`
to *false*. This will prevent a rarely executed statement from flushing
a potential more frequently executed one from a full cache. For example,
if a statement will only ever be executed once:

.. code-block:: javascript

  result = await connection.execute(
    `SELECT v FROM t WHERE k = 123`,
    [],
    { keepInStmtCache: false }
  );

Statement caching can be disabled completely by setting the cache size
to 0:

.. code-block:: javascript

  oracledb.stmtCacheSize = 0;

Disabling the cache may be beneficial when the quantity or order of
statements causes cache entries to be flushed before they get a chance
to be reused. For example, if there are more distinct statements than
cache slots and the order of statement execution causes older statements
to be flushed from the cache before they are re-executed.

Disabling the statement cache may also be helpful in test and
development environments. The statement cache can become invalid if
connections remain open and database schema objects are recreated. This
can also happen when a connection uses identical query text with
different ``fetchAsString`` or ``fetchInfo`` data types. Applications
can receive errors such as *ORA-3106*. After a statement execution error
is returned once to the application, node-oracledb automatically drops
that statement from the cache. This lets subsequent re-executions of the
statement on that connection to succeed.

.. _clientresultcache:

Client Result Caching (CRC)
===========================

Node-oracledb applications can use Oracle Database’s `Client Result
Cache <https://www.oracle.com/pls/topic/lookup?ctx=dblatest&id=GUID-35CB2592
-7588-4C2D-9075-6F639F25425E>`__ (CRC). This enables client-side caching of
SQL query (SELECT statement) results in client memory for immediate use when
the same query is re-executed. This is useful for reducing the cost of queries
for small, mostly static, lookup tables, such as for postal codes. CRC reduces
network :ref:`round-trips <roundtrips>` and also reduces database server
CPU usage.

The cache is at the application process level. Access and invalidation
is managed by the Oracle Client libraries. This removes the need for
extra application logic, or external utilities, to implement a cache.
Pooled connections can use CRC. Repeated statement execution on a
standalone connection will also use it, but sequences of calls using
standalone connections like
``oracledb.getConnection({user: ...})``/ ``execute()``/ ``connection.close()``
will not. CRC requires :ref:`statement caching <stmtcache>` to be enabled,
which is true by default.

Configuring CRC
---------------

Client Result Caching can be enabled by setting the `database
parameters <https://www.oracle.com/pls/topic/lookup?ctx=dblatest&id=
GUID-A9D4A5F5-B939-48FF-80AE-0228E7314C7D>`__ ``CLIENT_RESULT_CACHE_SIZE``
and ``CLIENT_RESULT_CACHE_LAG``, for example:

.. code-block:: sql

  SQL> ALTER SYSTEM SET CLIENT_RESULT_CACHE_LAG = 3000 SCOPE=SPFILE;
  SQL> ALTER SYSTEM SET CLIENT_RESULT_CACHE_SIZE = 64K SCOPE=SPFILE;

Then restart the database::


  SQL> STARTUP FORCE

or restart the :ref:`pluggable database <startupshutdownpdb>`, for
example::

  SQL> ALTER PLUGGABLE DATABASE CLOSE;
  SQL> ALTER PLUGGABLE DATABASE OPEN;

Once CRC has been enabled in the database, the values used by the cache
can optionally be tuned in an :ref:`oraaccess.xml <oraaccess>` file,
see `Client Configuration Parameters <https://www.oracle.com/pls/topic/lookup?
ctx=dblatest&id=GUID-E63D75A1-FCAA-4A54-A3D2-B068442CE766>`__.
Also see `Tuning the Result Cache <https://www.oracle.com/pls/topic/lookup?
ctx=dblatest&id=GUID-39C521D4-5C6E-44B1-B7C7-DEADD7D9CAF0>`__,
which discusses CRC and also the Server Result Cache.

Using CRC
---------

Tables can be created, or altered, so queries use CRC. This allows
applications to use CRC without needing modification. For example:

.. code-block:: sql

  SQL> CREATE TABLE cities (id NUMBER, name VARCHAR2(40)) RESULT_CACHE (MODE FORCE);
  SQL> ALTER TABLE locations RESULT_CACHE (MODE FORCE);

Alternatively, hints can be used in SQL statements. For example:

.. code-block:: sql

  SELECT /*+ result_cache */ postal_code FROM locations

Verifying CRC
-------------

To verify that CRC is working, you can check the number of executions of
your query in ``V$SQLAREA``. When CRC is enabled in the database, the
number of statement executions is reduced because the statement is not
sent to the database unnecessarily.

.. code-block:: javascript

  // Run some load
  const q = `SELECT postal_code FROM locations`;
  const qc = `SELECT /*+ RESULT_CACHE */ postal_code FROM locations`;

  for (let i = 0; i < 100; i++) {
    connection = await oracledb.getConnection();
    result = await connection.execute(q);
    await connection.close();
  }

  for (let i = 0; i < 100; i++) {
    connection = await oracledb.getConnection();
    result = await connection.execute(qc);
    await connection.close();
  }

  // Compare behaviors (using a connection as SYSTEM)
  const m = `SELECT executions FROM v$sqlarea WHERE sql_text = :q1`;

  result = await systemconn.execute(m, [q]);
  console.log('No hint:', result.rows[0][0], 'executions');

  result = await systemconn.execute(m, [qc]);
  console.log('CRC hint:', result.rows[0][0], 'executions');

When CRC is enabled, output will be like::

  No hint: 100 executions
  CRC hint: 1 executions

If CRC is not enabled, output will be like::

  No hint: 100 executions
  CRC hint: 100 executions

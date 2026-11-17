// The features listed on the home page: the names run together as one line
// of type, and picking one shows its text in the card beside them.
// text may hold simple HTML (<code>).
export default [
  {
    name: "Strict SQL conformance",
    text: "Standard SQL is treated as one language, from SQL-86 through SQL:2023, and built clause by clause from the standards’ own text.",
  },
  {
    name: "Highly extensible",
    text: "Nearly every part is a plug-in point: storage engines, index methods, data types, functions, optimizer rules, encodings, authentication and wire protocols. Each has a built-in version you can replace or add to.",
  },
  {
    name: "Row and column storage",
    text: "You choose per table. Transactions use multi-version concurrency control, a write-ahead log and crash recovery, at any level up to <code>SERIALIZABLE</code>.",
  },
  {
    name: "An index for each kind of data",
    text: "B-link trees, hash tables, R-trees, full-text indexes, HNSW and DiskANN are built in. A cost-based planner picks among them.",
  },
  {
    name: "Vectors",
    text: "HNSW and DiskANN indexes and five distance metrics. Hybrid search combines vector similarity, full-text ranking and SQL filters in one query.",
  },
  {
    name: "Graphs",
    text: "GQL and SQL/PGQ property graphs, over the same tables and transactions as the rest of your data.",
  },
  {
    name: "JSON",
    text: "The SQL/JSON path language, <code>JSON_VALUE</code>, <code>JSON_QUERY</code> and <code>JSON_EXISTS</code>, and the JSON constructors and aggregates.",
  },
  {
    name: "Spatial and full-text search",
    text: "Geometries in WKT and WKB, spatial joins and nearest-neighbour queries. SQL/MM Full-Text, with stemming, thesauri and BM25 ranking.",
  },
  {
    name: "Time-aware data",
    text: "Application-time periods, system-versioned tables and bitemporal queries with <code>FOR SYSTEM_TIME AS OF</code>.",
  },
  {
    name: "Analytics",
    text: "Window functions, grouping sets, recursive queries and <code>MATCH_RECOGNIZE</code>. Sorts and joins spill to disk under one memory budget.",
  },
  {
    name: "Logic in the database",
    text: "Stored procedures in SQL/PSM, triggers, user-defined and structured types, and polymorphic table functions.",
  },
  {
    name: "Secure and replicated",
    text: "Encryption at rest with AES-256-GCM or ChaCha20-Poly1305, LZ4 compression and TLS. Viewstamped Replication fails over automatically within seconds.",
  },
  {
    name: "Embedded or as a server",
    text: "Run it inside your Rust app as a library, or as the <code>turboreld</code> server over TCP, Unix sockets or Windows named pipes.",
  },
];

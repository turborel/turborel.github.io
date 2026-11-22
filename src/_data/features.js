// The features listed on the home page: the names run together as one line
// of type, and picking one shows its text in the card beside them.
// text may hold simple HTML (<code>).
export default [
  {
    name: "Strict SQL conformance",
    text: "Standard SQL is treated as one language, from SQL-86 through SQL:2023, and built clause by clause from the standards’ own text. <a target='_blank' href='https://github.com/turborel/turborel/blob/main/CONFORMANCE.md'>CONFORMANCE.md</a> lists the features it claims.",
  },
  {
    name: "Highly extensible",
    text: "Nearly every part is a plug-in point: storage engines, index methods, data types, functions, optimizer rules, encodings, authentication, wire protocols and more. Each has a built-in version you can replace or add to, and a plug-in can also run as a program of its own, installed from a signed package.",
  },
  {
    name: "Row and columnar engines",
    text: "Each table picks its storage engine: row-oriented for transactional work, or columnar for analytics, under the same SQL. Transactions use multi-version concurrency control, a write-ahead log and crash recovery, at any level up to <code>SERIALIZABLE</code>.",
  },
  {
    name: "An index for each kind of data",
    text: "B-link trees, hash tables, R-trees, inverted indexes for full text and JSON, and HNSW, DiskANN and IVF for vectors are built in. A cost-based planner picks among them.",
  },
  {
    name: "Vectors",
    text: "Dense and sparse embeddings, with HNSW, DiskANN and IVF indexes. Hybrid search combines vector similarity, full-text ranking and SQL filters in one query.",
  },
  {
    name: "Graphs",
    text: "GQL and SQL/PGQ property graphs, or native node and edge tables, over the same transactions as the rest of your data. Algorithms such as PageRank run in parallel.",
  },
  {
    name: "JSON",
    text: "The SQL/JSON path language, <code>JSON_VALUE</code>, <code>JSON_QUERY</code> and <code>JSON_EXISTS</code>, and the JSON constructors and aggregates.",
  },
  {
    name: "XML",
    text: "An XML type queried in XQuery 1.0 by <code>XMLQUERY</code> and <code>XMLTABLE</code>, validated against registered XML Schemas, and published from SQL with <code>XMLELEMENT</code> and <code>XMLAGG</code>.",
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
    text: "Encryption at rest with AES-256-GCM or ChaCha20-Poly1305, LZ4 compression and TLS. Viewstamped Replication fails over automatically within seconds, and online backups restore to a point in time.",
  },
  {
    name: "Embedded or as a server",
    text: "Run it inside your Rust app as a library, or as the <code>turboreld</code> server over TCP, Unix sockets or Windows named pipes.",
  },
];

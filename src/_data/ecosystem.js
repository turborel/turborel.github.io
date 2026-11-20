// Ways to connect to Turborel, for the home page's patch bay and /ecosystem/.
//
//   builtin    the Rust library, which ships with the server and the CLI
//   official   drivers maintained by the Turborel project, one repo each,
//              released together with the server: a driver's version is the
//              server version it was built for
//   tools      other official programs that connect to it
//
//   docs       where a repo's doc/ folder is published under /docs/, fetched
//              at the same tag as the server's (they are released together):
//              docs: "drivers/python" -> /docs/drivers/python/
//   label      what that documentation set is called in the docs' sidebar
//              and contents page; a driver's is "<language> driver" by default
//   kubernetes official ways to run it on Kubernetes
//   performance  Turborel's forks of standard benchmark tools
//   community  drivers and tools written by others. Wrote one? Add it here
//              and open a pull request:
//                { language: "Elixir", name: "turborel_ex",
//                  url: "https://github.com/someone/turborel_ex",
//                  description: "An Elixir driver.", by: "someone" }
const gh = (repo) => `https://github.com/turborel/${repo}`;

export default {
  builtin: { language: "Rust", repo: "turborel/turborel", url: gh("turborel") },

  official: [
    { language: "JavaScript", repo: "turborel/turborel-js", url: gh("turborel-js"), docs: "drivers/javascript" },
    { language: "Python", repo: "turborel/turborel-py", url: gh("turborel-py"), docs: "drivers/python" },
    { language: "Go", repo: "turborel/turborel-go", url: gh("turborel-go"), docs: "drivers/go" },
    { language: "Java", repo: "turborel/turborel-java", url: gh("turborel-java"), docs: "drivers/java" },
    { language: "C#", repo: "turborel/turborel-cs", url: gh("turborel-cs"), docs: "drivers/csharp" },
    { language: "C++", repo: "turborel/turborel-cpp", url: gh("turborel-cpp"), docs: "drivers/cpp" },
    { language: "C", repo: "turborel/turborel-c", url: gh("turborel-c"), docs: "drivers/c" },
    { language: "PHP", repo: "turborel/turborel-php", url: gh("turborel-php"), docs: "drivers/php" },
    { language: "Ruby", repo: "turborel/turborel-ruby", url: gh("turborel-ruby"), docs: "drivers/ruby" },
  ],

  tools: [
    { name: "CLI", repo: "turborel/turborel", url: gh("turborel"), description: "The command-line client, turborel. It comes with the server." },
    { name: "Studio", repo: "turborel/studio", url: gh("studio"), docs: "studio", description: "Your databases, visualized through a GUI." },
  ],

  kubernetes: [
    { name: "Helm charts", repo: "turborel/charts", url: "https://charts.turborel.com/", description: "Runs turboreld as a StatefulSet, its database on a volume of its own.", install: "helm repo add turborel https://charts.turborel.com" },
    { name: "Operator", label: "Kubernetes operator", repo: "turborel/turborel-operator", url: gh("turborel-operator"), docs: "kubernetes/operator", description: "A Kubernetes operator for running Turborel." },
  ],

  performance: [
    { name: "sysbench", repo: "turborel/sysbench", url: gh("sysbench"), description: "Scriptable database and system benchmarks, with OLTP read and write workloads, run against Turborel." },
    { name: "HammerDB", repo: "turborel/HammerDB", url: gh("HammerDB"), description: "The industry-standard TPROC-C and TPROC-H workloads, derived from TPC-C and TPC-H, run against Turborel." },
  ],

  community: [],
};

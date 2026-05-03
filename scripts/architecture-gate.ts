import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

type Layer = "presentation" | "application" | "domain" | "infrastructure";
type LayerPair = `${Layer}->${Layer}`;

interface AcceptedDisposition {
  id: string;
  fromFile: string;
  toLayer: Layer;
  rationale: string;
  owner: string;
  dueDate: string;
}

interface EdgeRecord {
  fromFile: string;
  toFile: string;
  importPath: string;
  fromLayer: Layer;
  toLayer: Layer;
}

interface ViolationRecord extends EdgeRecord {
  rule: string;
}

interface AnalysisResult {
  generatedAt: string;
  engine: "offline-fallback";
  configurationFile: string;
  policyDocument: string;
  scannedFiles: number;
  dependenciesAnalyzed: number;
  skippedImports: number;
  allowedEdges: EdgeRecord[];
  acceptedEdges: Array<EdgeRecord & { dispositionId: string }>;
  violations: ViolationRecord[];
  acceptedDispositions: AcceptedDisposition[];
  edgeCounts: Record<LayerPair, number>;
}

const scopedLayers: Record<Layer, string> = {
  presentation: "src/presentation",
  application: "src/application",
  domain: "src/domain",
  infrastructure: "src/infrastructure",
};

const taskDirectory = path.join(process.cwd(), "tasks", "prd-clean-architecture-quality-closure");
const validationOutputFile = path.join(taskDirectory, "dependency-validation.json");
const graphOutputFile = path.join(taskDirectory, "dependency-graph.svg");

const forbiddenTargets: Record<Layer, Set<Layer>> = {
  presentation: new Set<Layer>(["domain", "infrastructure"]),
  application: new Set<Layer>(["presentation", "infrastructure"]),
  domain: new Set<Layer>(["presentation", "application", "infrastructure"]),
  infrastructure: new Set<Layer>(["presentation", "application"]),
};

const taskOwner = "quality-closure-task-2.0";
const dispositionDueDate = "2026-03-31";
const presentationDomainRationale =
  "Presentation still maps domain exceptions directly; task 3.0 will move this behind focused HTTP helpers.";
const workOrderPresentationDomainRationale =
  "Work-order presentation now centralizes domain exception mapping in a focused HTTP helper while the accepted disposition remains tracked.";

const acceptedDispositions: AcceptedDisposition[] = [
  {
    id: "ARCH-DISP-001",
    fromFile: "src/presentation/stock-items.ts",
    toLayer: "domain",
    rationale: presentationDomainRationale,
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-002",
    fromFile: "src/presentation/vehicles.ts",
    toLayer: "domain",
    rationale: presentationDomainRationale,
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-003",
    fromFile: "src/presentation/person.ts",
    toLayer: "domain",
    rationale: presentationDomainRationale,
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-004",
    fromFile: "src/presentation/work-orders/error-mapping.ts",
    toLayer: "domain",
    rationale: workOrderPresentationDomainRationale,
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-005",
    fromFile: "src/presentation/services.ts",
    toLayer: "domain",
    rationale: presentationDomainRationale,
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-006",
    fromFile: "src/presentation/service-tasks.ts",
    toLayer: "domain",
    rationale: presentationDomainRationale,
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-007",
    fromFile: "src/presentation/webhooks/work-order-events.ts",
    toLayer: "domain",
    rationale:
      "Webhook route still maps domain exceptions and one status value directly; task 3.0 will move this behind focused HTTP helpers.",
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-008",
    fromFile: "src/presentation/auth.ts",
    toLayer: "infrastructure",
    rationale:
      "Token signing is still invoked directly from the auth route; task 3.0 will isolate transport concerns from the adapter.",
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-009",
    fromFile: "src/presentation/middleware/auth.ts",
    toLayer: "infrastructure",
    rationale:
      "JWT verification is still invoked directly from middleware; task 3.0 will isolate transport concerns from the adapter.",
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-010",
    fromFile: "src/infrastructure/notification/beeceptor-notification.ts",
    toLayer: "application",
    rationale:
      "The adapter still implements an application-layer notification contract; task 4.0 will relocate the stable port contract.",
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-012",
    fromFile: "src/infrastructure/notification/noop-notification.ts",
    toLayer: "application",
    rationale:
      "The no-op adapter implements the same application-layer notification contract as the Beeceptor adapter.",
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
  {
    id: "ARCH-DISP-011",
    fromFile:
      "src/infrastructure/work-order/create-work-order-with-full-payload-unit-of-work-postgres.ts",
    toLayer: "application",
    rationale:
      "The transaction adapter still imports the application unit-of-work contract; task 4.0 will relocate the stable port contract.",
    owner: taskOwner,
    dueDate: dispositionDueDate,
  },
];

const mode = process.argv[2];

if (mode !== "check" && mode !== "graph") {
  console.error("Usage: bun run scripts/architecture-gate.ts <check|graph>");
  process.exit(1);
}

mkdirSync(taskDirectory, { recursive: true });

const analysis = analyzeRepository();

if (mode === "check") {
  writeValidationReport(analysis);
  console.log(
    `Architecture check (${analysis.engine}): ${analysis.violations.length} violation(s), ${analysis.acceptedEdges.length} accepted edge(s).`,
  );
  process.exit(analysis.violations.length === 0 ? 0 : 1);
}

writeLayerGraph(analysis);
console.log(
  `Architecture graph (${analysis.engine}) written to ${toProjectPath(graphOutputFile)}.`,
);

function analyzeRepository(): AnalysisResult {
  const files = Object.values(scopedLayers).flatMap((directory) =>
    collectSourceFiles(path.join(process.cwd(), directory)),
  );
  const sortedFiles = files
    .map((filePath) => toProjectPath(filePath))
    .sort((left, right) => left.localeCompare(right));

  const allowedEdges: EdgeRecord[] = [];
  const acceptedEdges: Array<EdgeRecord & { dispositionId: string }> = [];
  const violations: ViolationRecord[] = [];
  const edgeCounts = createEmptyEdgeCounts();

  let dependenciesAnalyzed = 0;
  let skippedImports = 0;

  for (const relativeFilePath of sortedFiles) {
    const absoluteFilePath = path.join(process.cwd(), relativeFilePath);
    const fromLayer = getLayerForPath(relativeFilePath);

    if (!fromLayer) {
      continue;
    }

    const source = readFileSync(absoluteFilePath, "utf8");

    for (const importPath of extractImportPaths(source)) {
      const resolved = resolveImportTarget(absoluteFilePath, importPath);

      if (!resolved) {
        skippedImports += 1;
        continue;
      }

      const relativeTargetPath = toProjectPath(resolved);
      const toLayer = getLayerForPath(relativeTargetPath);

      if (!toLayer) {
        skippedImports += 1;
        continue;
      }

      const edge: EdgeRecord = {
        fromFile: relativeFilePath,
        toFile: relativeTargetPath,
        importPath,
        fromLayer,
        toLayer,
      };

      dependenciesAnalyzed += 1;
      edgeCounts[`${fromLayer}->${toLayer}`] += 1;

      if (!isForbiddenEdge(fromLayer, toLayer)) {
        allowedEdges.push(edge);
        continue;
      }

      const acceptedDisposition = acceptedDispositions.find(
        (candidate) => candidate.fromFile === relativeFilePath && candidate.toLayer === toLayer,
      );

      if (acceptedDisposition) {
        acceptedEdges.push({ ...edge, dispositionId: acceptedDisposition.id });
        continue;
      }

      violations.push({
        ...edge,
        rule: `${fromLayer}->${toLayer}`,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    engine: "offline-fallback",
    configurationFile: ".dependency-cruiser.cjs",
    policyDocument: "docs/architecture/clean-architecture-layered.md",
    scannedFiles: sortedFiles.length,
    dependenciesAnalyzed,
    skippedImports,
    allowedEdges,
    acceptedEdges,
    violations,
    acceptedDispositions,
    edgeCounts,
  };
}

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory)
    .map((name) => path.join(directory, name))
    .sort((left, right) => left.localeCompare(right));

  const files: string[] = [];

  for (const entry of entries) {
    const stats = statSync(entry);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(entry));
      continue;
    }

    if (!/\.[jt]sx?$/.test(entry) || /\.(test|spec)\.[jt]sx?$/.test(entry)) {
      continue;
    }

    files.push(entry);
  }

  return files;
}

function extractImportPaths(source: string): string[] {
  const importPaths = new Set<string>();
  const fromPattern = /\b(?:import|export)\b[\s\S]*?\bfrom\s+["']([^"']+)["']/g;
  const sideEffectPattern = /\bimport\s+["']([^"']+)["']/g;

  let match: RegExpExecArray | null = null;

  while ((match = fromPattern.exec(source)) !== null) {
    importPaths.add(match[1]);
  }

  while ((match = sideEffectPattern.exec(source)) !== null) {
    importPaths.add(match[1]);
  }

  return [...importPaths].sort((left, right) => left.localeCompare(right));
}

function resolveImportTarget(sourceFilePath: string, importPath: string): string | null {
  if (!importPath.startsWith(".")) {
    return null;
  }

  const basePath = path.resolve(path.dirname(sourceFilePath), importPath);
  const candidatePaths = new Set<string>();

  if (path.extname(basePath)) {
    candidatePaths.add(basePath);
  } else {
    candidatePaths.add(`${basePath}.ts`);
    candidatePaths.add(`${basePath}.tsx`);
    candidatePaths.add(`${basePath}.js`);
    candidatePaths.add(`${basePath}.jsx`);
    candidatePaths.add(path.join(basePath, "index.ts"));
    candidatePaths.add(path.join(basePath, "index.tsx"));
    candidatePaths.add(path.join(basePath, "index.js"));
    candidatePaths.add(path.join(basePath, "index.jsx"));
  }

  for (const candidate of candidatePaths) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function getLayerForPath(filePath: string): Layer | null {
  const normalized = filePath.replaceAll(path.sep, "/");

  for (const [layer, prefix] of Object.entries(scopedLayers) as Array<[Layer, string]>) {
    if (normalized.startsWith(`${prefix}/`) || normalized === prefix) {
      return layer;
    }
  }

  return null;
}

function isForbiddenEdge(fromLayer: Layer, toLayer: Layer): boolean {
  return forbiddenTargets[fromLayer].has(toLayer);
}

function createEmptyEdgeCounts(): Record<LayerPair, number> {
  const counts = {} as Record<LayerPair, number>;

  for (const fromLayer of Object.keys(scopedLayers) as Layer[]) {
    for (const toLayer of Object.keys(scopedLayers) as Layer[]) {
      counts[`${fromLayer}->${toLayer}`] = 0;
    }
  }

  return counts;
}

function writeValidationReport(result: AnalysisResult): void {
  const report = {
    generatedAt: result.generatedAt,
    engine: result.engine,
    preferredEngine: "dependency-cruiser",
    configurationFile: result.configurationFile,
    policyDocument: result.policyDocument,
    scope: Object.values(scopedLayers),
    summary: {
      scannedFiles: result.scannedFiles,
      dependenciesAnalyzed: result.dependenciesAnalyzed,
      skippedImports: result.skippedImports,
      allowedEdgeCount: result.allowedEdges.length,
      acceptedEdgeCount: result.acceptedEdges.length,
      violationCount: result.violations.length,
    },
    edgeCounts: result.edgeCounts,
    acceptedDispositions: result.acceptedDispositions,
    acceptedEdges: result.acceptedEdges,
    violations: result.violations,
  };

  writeFileSync(validationOutputFile, `${JSON.stringify(report, null, 2)}\n`);
}

function writeLayerGraph(result: AnalysisResult): void {
  const allowedCounts = {
    "presentation->application": result.edgeCounts["presentation->application"],
    "application->domain": result.edgeCounts["application->domain"],
    "infrastructure->domain": result.edgeCounts["infrastructure->domain"],
  } as const;
  const acceptedCounts = {
    "presentation->domain": result.acceptedEdges.filter(
      (edge) => edge.fromLayer === "presentation" && edge.toLayer === "domain",
    ).length,
    "presentation->infrastructure": result.acceptedEdges.filter(
      (edge) => edge.fromLayer === "presentation" && edge.toLayer === "infrastructure",
    ).length,
    "infrastructure->application": result.acceptedEdges.filter(
      (edge) => edge.fromLayer === "infrastructure" && edge.toLayer === "application",
    ).length,
  } as const;
  const violationCounts = summarizeViolationCounts(result.violations);
  const allowedEdgeColor = "#18794e";
  const acceptedEdgeColor = "#9a6700";
  const allowedEdgeMarker = "arrow-green";
  const acceptedEdgeMarker = "arrow-amber";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-labelledby="title desc">
  <title id="title">Layered architecture dependency graph</title>
  <desc id="desc">Allowed, accepted-disposition, and violating edges between presentation, application, domain, and infrastructure.</desc>
  <defs>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#18794e" />
    </marker>
    <marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#9a6700" />
    </marker>
    <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#d1242f" />
    </marker>
  </defs>

  <rect x="0" y="0" width="960" height="540" fill="#f8f7f4" />
  <text x="40" y="48" font-family="monospace" font-size="24" fill="#1f2328">Layered Dependency Direction</text>
  <text x="40" y="76" font-family="monospace" font-size="14" fill="#57606a">Generated ${escapeXml(result.generatedAt)} with ${escapeXml(result.engine)}. Preferred engine: dependency-cruiser.</text>

  ${renderNode("Presentation", 80, 120)}
  ${renderNode("Application", 320, 120)}
  ${renderNode("Domain", 560, 120)}
  ${renderNode("Infrastructure", 320, 320)}

  ${renderEdge(230, 175, 320, 175, allowedEdgeColor, allowedEdgeMarker, `allowed ${allowedCounts["presentation->application"]}`)}
  ${renderEdge(470, 175, 560, 175, allowedEdgeColor, allowedEdgeMarker, `allowed ${allowedCounts["application->domain"]}`)}
  ${renderEdge(470, 365, 610, 220, allowedEdgeColor, allowedEdgeMarker, `allowed ${allowedCounts["infrastructure->domain"]}`)}

  ${renderEdge(230, 210, 560, 210, acceptedEdgeColor, acceptedEdgeMarker, `accepted ${acceptedCounts["presentation->domain"]}`, "8 6")}
  ${renderEdge(200, 240, 360, 335, acceptedEdgeColor, acceptedEdgeMarker, `accepted ${acceptedCounts["presentation->infrastructure"]}`, "8 6")}
  ${renderEdge(410, 320, 410, 230, acceptedEdgeColor, acceptedEdgeMarker, `accepted ${acceptedCounts["infrastructure->application"]}`, "8 6")}

  ${renderViolationEdges(violationCounts)}

  <rect x="40" y="430" width="360" height="76" rx="10" fill="#ffffff" stroke="#d0d7de" />
  <circle cx="66" cy="455" r="6" fill="#18794e" />
  <text x="84" y="460" font-family="monospace" font-size="13" fill="#1f2328">Allowed edge</text>
  <circle cx="66" cy="480" r="6" fill="#9a6700" />
  <text x="84" y="485" font-family="monospace" font-size="13" fill="#1f2328">Accepted disposition edge</text>
  <circle cx="228" cy="455" r="6" fill="#d1242f" />
  <text x="246" y="460" font-family="monospace" font-size="13" fill="#1f2328">Violation</text>
  <text x="228" y="485" font-family="monospace" font-size="13" fill="#1f2328">Current violations: ${result.violations.length}</text>
</svg>
`;

  writeFileSync(graphOutputFile, svg);
}

function summarizeViolationCounts(
  violations: ViolationRecord[],
): Partial<Record<LayerPair, number>> {
  const counts: Partial<Record<LayerPair, number>> = {};

  for (const violation of violations) {
    const key: LayerPair = `${violation.fromLayer}->${violation.toLayer}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function renderNode(label: string, x: number, y: number): string {
  return `<rect x="${x}" y="${y}" width="160" height="72" rx="14" fill="#ffffff" stroke="#1f2328" stroke-width="2" />
  <text x="${x + 80}" y="${y + 42}" text-anchor="middle" font-family="monospace" font-size="16" fill="#1f2328">${escapeXml(label)}</text>`;
}

function renderEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  markerId: string,
  label: string,
  dashArray?: string,
): string {
  const dashAttribute = dashArray ? ` stroke-dasharray="${dashArray}"` : "";
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 - 8;

  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3"${dashAttribute} marker-end="url(#${markerId})" />
  <text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="monospace" font-size="12" fill="${color}">${escapeXml(label)}</text>`;
}

function renderViolationEdges(counts: Partial<Record<LayerPair, number>>): string {
  const fragments: string[] = [];

  if ((counts["domain->application"] ?? 0) > 0) {
    fragments.push(
      renderEdge(
        640,
        110,
        480,
        85,
        "#d1242f",
        "arrow-red",
        `violation ${counts["domain->application"]}`,
      ),
    );
  }

  if ((counts["application->infrastructure"] ?? 0) > 0) {
    fragments.push(
      renderEdge(
        400,
        195,
        400,
        310,
        "#d1242f",
        "arrow-red",
        `violation ${counts["application->infrastructure"]}`,
      ),
    );
  }

  if ((counts["presentation->domain"] ?? 0) > 0) {
    fragments.push(
      renderEdge(
        230,
        145,
        560,
        145,
        "#d1242f",
        "arrow-red",
        `violation ${counts["presentation->domain"]}`,
      ),
    );
  }

  if ((counts["presentation->infrastructure"] ?? 0) > 0) {
    fragments.push(
      renderEdge(
        180,
        230,
        360,
        310,
        "#d1242f",
        "arrow-red",
        `violation ${counts["presentation->infrastructure"]}`,
      ),
    );
  }

  if ((counts["infrastructure->application"] ?? 0) > 0) {
    fragments.push(
      renderEdge(
        440,
        320,
        440,
        230,
        "#d1242f",
        "arrow-red",
        `violation ${counts["infrastructure->application"]}`,
      ),
    );
  }

  if ((counts["infrastructure->presentation"] ?? 0) > 0) {
    fragments.push(
      renderEdge(
        320,
        340,
        210,
        210,
        "#d1242f",
        "arrow-red",
        `violation ${counts["infrastructure->presentation"]}`,
      ),
    );
  }

  return fragments.join("\n  ");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toProjectPath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
}

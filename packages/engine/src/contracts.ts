// Contratos de dados: diff, detecção de quebra, versão semântica e YAML (ODCS).
import type { ContractField, ContractVersion, DataContract, EnvId, WorkspaceData } from '@cortex/schemas';

export interface FieldChange {
  before: ContractField;
  after: ContractField;
  changes: string[];
}

export interface ContractDiff {
  added: ContractField[];
  removed: ContractField[];
  changed: FieldChange[];
}

export type BumpKind = 'major' | 'minor' | 'patch';

const CLASS_LABEL: Record<string, string> = { pii: 'PII', sensivel: 'sensível', interno: 'interno', publico: 'público' };

export function diffContractFields(a: ContractField[], b: ContractField[]): ContractDiff {
  const before = new Map(a.map((f) => [f.name, f]));
  const after = new Map(b.map((f) => [f.name, f]));
  const added = b.filter((f) => !before.has(f.name));
  const removed = a.filter((f) => !after.has(f.name));
  const changed: FieldChange[] = [];
  for (const f of b) {
    const old = before.get(f.name);
    if (!old) continue;
    const changes: string[] = [];
    if (old.type !== f.type) changes.push(`tipo: ${old.type} → ${f.type}`);
    if (old.required !== f.required) changes.push(f.required ? 'passou a ser obrigatório' : 'deixou de ser obrigatório');
    if (old.classification !== f.classification)
      changes.push(`classificação: ${CLASS_LABEL[old.classification]} → ${CLASS_LABEL[f.classification]}`);
    if ((old.ref ?? '') !== (f.ref ?? '')) changes.push(`referência: ${old.ref ?? '—'} → ${f.ref ?? '—'}`);
    if (old.description !== f.description) changes.push('descrição alterada');
    if (changes.length) changed.push({ before: old, after: f, changes });
  }
  return { added, removed, changed };
}

function parseSemver(v: string): [number, number, number] {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

export function compareVersions(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export function bumpVersion(v: string, kind: BumpKind): string {
  const [ma, mi, pa] = parseSemver(v);
  if (kind === 'major') return `${ma + 1}.0.0`;
  if (kind === 'minor') return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}

export function suggestBump(diff: ContractDiff): BumpKind {
  if (diff.removed.length || diff.changed.some((c) => c.before.type !== c.after.type)) return 'major';
  if (diff.added.length) return 'minor';
  return 'patch';
}

/** Versão mais recente do contrato (maior versão semântica). */
export function latestContractVersion(contract: DataContract): ContractVersion | undefined {
  return contract.versions.slice().sort((x, y) => compareVersions(y.version, x.version))[0];
}

export interface BreakingConsumer {
  journeyId: string;
  journeyName: string;
  env: EnvId;
  field: string;
  reason: string;
}

/** Jornadas em Prd que quebram se o contrato passar a ter `newFields`. */
export function findBreakingConsumers(contract: DataContract, newFields: ContractField[], data: WorkspaceData): BreakingConsumer[] {
  const current = latestContractVersion(contract)?.fields ?? [];
  const diff = diffContractFields(current, newFields);
  const breaking = new Map<string, string>();
  for (const f of diff.removed) breaking.set(f.name, 'Campo removido');
  for (const c of diff.changed) {
    if (c.before.type !== c.after.type) breaking.set(c.after.name, `Tipo alterado de ${c.before.type} para ${c.after.type}`);
  }
  if (!breaking.size) return [];
  const result: BreakingConsumer[] = [];
  const seen = new Set<string>();
  for (const j of data.journeys) {
    const prdVersion = j.envVersions.prd;
    if (!prdVersion) continue;
    const ver = j.versions.find((v) => v.version === prdVersion);
    if (!ver) continue;
    for (const node of ver.graph.nodes) {
      if (node.contractId !== contract.id) continue;
      const listed = node.config?.fields
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const [field, reason] of breaking) {
        if (listed && listed.length && !listed.includes(field)) continue;
        const key = `${j.id}:${field}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ journeyId: j.id, journeyName: j.name, env: 'prd', field, reason });
      }
    }
  }
  return result;
}

// ---------- YAML ----------
type Yaml = string | number | boolean | null | undefined | Yaml[] | { [k: string]: Yaml };

function yamlScalar(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === '') return "''";
  const needsQuote =
    /^[\s]|[\s]$/.test(v) ||
    /[:#\[\]{},&*!|>'"%@`]/.test(v) ||
    /^[-?]/.test(v) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(v) ||
    /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v) ||
    /\n/.test(v);
  return needsQuote ? JSON.stringify(v) : v;
}

function isPlainObject(v: Yaml): v is { [k: string]: Yaml } {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function emit(value: Yaml, indent: number): string[] {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return [`${pad}[]`];
    const lines: string[] = [];
    for (const item of value) {
      if (isPlainObject(item) || Array.isArray(item)) {
        const inner = emit(item, indent + 1);
        if (!inner.length) {
          lines.push(`${pad}- {}`);
          continue;
        }
        // Primeiro item do bloco fica na linha do hífen.
        lines.push(`${pad}- ${inner[0].trimStart()}`, ...inner.slice(1));
      } else {
        lines.push(`${pad}- ${yamlScalar(item)}`);
      }
    }
    return lines;
  }
  if (isPlainObject(value)) {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) lines.push(`${pad}${k}: []`);
      else if (isPlainObject(v) && Object.keys(v).length === 0) lines.push(`${pad}${k}: {}`);
      else if (Array.isArray(v) || isPlainObject(v)) lines.push(`${pad}${k}:`, ...emit(v, indent + 1));
      else lines.push(`${pad}${k}: ${yamlScalar(v)}`);
    }
    return lines;
  }
  return [`${pad}${yamlScalar(value)}`];
}

/** Serializa um valor simples (objetos, listas, escalares) em YAML. */
export function toYaml(value: Yaml): string {
  return emit(value, 0).join('\n') + '\n';
}

const STATUS_ODCS: Record<DataContract['status'], string> = { publicado: 'active', rascunho: 'draft', depreciado: 'deprecated' };

/** YAML do contrato no padrão Open Data Contract Standard (v3). */
export function contractToYaml(contract: DataContract, version?: ContractVersion | string): string {
  const ver =
    typeof version === 'object'
      ? version
      : (version ? contract.versions.find((v) => v.version === version) : undefined) ?? latestContractVersion(contract);
  const fields = ver?.fields ?? [];
  const doc: Yaml = {
    apiVersion: 'v3.0.0',
    kind: 'DataContract',
    id: contract.id,
    name: contract.name,
    version: ver?.version ?? '0.0.0',
    domain: contract.domainId,
    status: STATUS_ODCS[contract.status],
    description: ver?.note ? { purpose: ver.note } : undefined,
    team: [{ username: contract.owner, role: 'owner' }],
    schema: [
      {
        name: contract.entity,
        logicalType: 'object',
        properties: fields.map((f) => ({
          name: f.name,
          logicalType: f.type,
          required: f.required,
          classification: f.classification,
          description: f.description || undefined,
          relationships: f.ref ? [{ type: 'foreignKey', to: f.ref }] : undefined,
        })),
        quality: (ver?.quality ?? []).map((q) => ({
          id: q.id,
          type: 'custom',
          dimension: q.kind,
          ...(q.field ? { property: q.field } : {}),
          rule: q.expression,
        })),
      },
    ],
    slaProperties: [
      { property: 'freshness', value: ver?.freshness ?? '' },
      ...(ver?.expectedVolume ? [{ property: 'volume', value: ver.expectedVolume }] : []),
    ],
    contractCreatedTs: ver?.publishedAt,
  };
  return toYaml(doc);
}

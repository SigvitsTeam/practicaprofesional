import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const violations = [];
const binaryExtensions = new Set([
  ".ico",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".pptx",
  ".gz",
]);

for (const path of trackedFiles) {
  const normalized = path.replaceAll("\\", "/");
  const fileName = normalized.split("/").at(-1) ?? normalized;
  if (
    (fileName === ".env" || fileName.endsWith(".env")) &&
    !fileName.endsWith(".env.example") &&
    fileName !== ".env.example"
  ) {
    violations.push(`${path}: archivo de entorno versionado`);
  }
  if (/\.(?:pem|p12|pfx|key)$/i.test(fileName)) {
    violations.push(`${path}: material criptografico privado versionado`);
  }
  if (normalized === "tools/security/verify-repository.mjs") continue;
  if (binaryExtensions.has(extname(fileName).toLowerCase())) continue;

  const buffer = readFileSync(path);
  if (buffer.length > 2_000_000 || buffer.includes(0)) continue;
  const text = buffer.toString("utf8");
  const checks = [
    [
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      "clave privada embebida",
    ],
    [
      /\bservice_role\b\s*[:=]\s*["']?eyJ[A-Za-z0-9_-]{20,}/i,
      "token service_role embebido",
    ],
    [
      /^[ \t]*(?:AUTH_ADMIN_SECRET|SUPABASE_SERVICE_ROLE_KEY)[ \t]*=[ \t]*(?!(?:$|#|replace|change-me|<))[^\r\n#]{20,}/im,
      "secreto administrativo embebido",
    ],
    [
      /postgres(?:ql)?:\/\/[^:\s/]+:(?!(?:change-me|ci-only(?:-[A-Za-z0-9_-]+)?|replace|unconfigured)@)[^@\s/]+@/i,
      "credencial PostgreSQL embebida",
    ],
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(text)) violations.push(`${path}: ${message}`);
  }
}

for (const dockerfile of [
  "deploy/docker/backend.Dockerfile",
  "deploy/docker/frontend.Dockerfile",
]) {
  const content = readFileSync(dockerfile, "utf8");
  if (!/^USER\s+(?:node|101)\s*$/m.test(content)) {
    violations.push(
      `${dockerfile}: la imagen final no declara usuario sin privilegios`,
    );
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Politica de repositorio incumplida:\n- ${violations.join("\n- ")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Politica de repositorio verificada en ${trackedFiles.length} archivos.\n`,
  );
}

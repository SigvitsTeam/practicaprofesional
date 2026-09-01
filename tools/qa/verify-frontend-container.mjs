import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    image: { type: "string", default: "sigvits-frontend:ci" },
    evidence: {
      type: "string",
      default: "evidence/container-security/frontend-smoke.json",
    },
  },
});
const instance = randomUUID();
const name = `sigvits-qa-frontend-${instance}`;
const owner = "frontend-container-smoke";
const evidence = {
  startedAt: new Date().toISOString(),
  image: values.image,
  containerName: name,
  checks: [],
  passed: false,
  cleanup: "not-created",
};

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(
      `docker ${args[0]} failed: ${result.error?.message ?? result.stderr.trim()}`,
    );
  }
  return result;
}

async function request(url) {
  return fetch(url, { signal: AbortSignal.timeout(5_000), redirect: "error" });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await request(`${baseUrl}/healthz`);
      if (response.status === 200 && (await response.text()).trim() === "ok")
        return;
    } catch {
      // Startup can precede Nginx listening; retry only inside this bounded deadline.
    }
    const state = JSON.parse(
      docker(["inspect", name, "--format", "{{json .State}}"]).stdout,
    );
    assert.equal(
      state.Running,
      true,
      "Frontend exited before HTTP became ready",
    );
    await delay(250);
  }
  throw new Error("Frontend did not become ready within 30 seconds");
}

function checkSecurityHeaders(response, path) {
  const policy = response.headers.get("content-security-policy") ?? "";
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "connect-src 'self' https://api.qa.invalid https://auth.qa.invalid",
  ]) {
    assert.ok(policy.includes(directive), `${path}: missing CSP ${directive}`);
  }
  assert.equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
    `${path}: nosniff`,
  );
  assert.equal(
    response.headers.get("x-frame-options"),
    "DENY",
    `${path}: framing protection`,
  );
  evidence.checks.push({
    path,
    status: response.status,
    csp: policy,
    nosniff: true,
    frame: "DENY",
    cacheControl: response.headers.get("cache-control"),
  });
}

try {
  const image = JSON.parse(
    docker(["image", "inspect", values.image]).stdout,
  )[0];
  assert.equal(
    image.Config.User,
    "101",
    "Frontend image must default to its non-root user",
  );
  evidence.imageId = image.Id;
  docker([
    "run",
    "--detach",
    "--name",
    name,
    "--label",
    `sigvits.qa.owner=${owner}`,
    "--label",
    `sigvits.qa.instance=${instance}`,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--publish",
    "127.0.0.1::8080",
    "--tmpfs",
    "/tmp:size=16m,mode=1777",
    "--tmpfs",
    "/var/cache/nginx:size=32m,mode=0755,uid=101,gid=101",
    "--tmpfs",
    "/var/run:size=1m,mode=0755,uid=101,gid=101",
    "--tmpfs",
    "/etc/nginx/conf.d:size=1m,mode=0750,uid=101,gid=101",
    "--tmpfs",
    "/usr/share/nginx/html/config:size=1m,mode=0750,uid=101,gid=101",
    "--env",
    "SIGVITS_API_URL=https://api.qa.invalid/api/v1",
    "--env",
    "SIGVITS_API_ORIGIN=https://api.qa.invalid",
    "--env",
    "SUPABASE_URL=https://auth.qa.invalid",
    "--env",
    "SUPABASE_PUBLISHABLE_KEY=qa-public-placeholder",
    values.image,
  ]);
  evidence.cleanup = "pending";
  const binding = docker(["port", name, "8080/tcp"]).stdout.trim();
  assert.match(binding, /^127\.0\.0\.1:\d+$/, "QA must bind only loopback");
  const baseUrl = `http://${binding}`;
  evidence.baseUrl = baseUrl;
  await waitForHealth(baseUrl);
  evidence.checks.push({ path: "/healthz", status: 200, body: "ok" });
  assert.equal(docker(["exec", name, "id", "-u"]).stdout.trim(), "101");
  evidence.userId = 101;
  docker(["exec", name, "nginx", "-t"]);
  evidence.nginxConfiguration = "valid";
  evidence.nginxVersion = docker(["exec", name, "nginx", "-v"]).stderr.trim();
  assert.match(evidence.nginxVersion, /nginx\/\d+\.\d+\.\d+/);

  const index = await request(`${baseUrl}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(index.headers.get("cache-control"), "no-cache");
  checkSecurityHeaders(index, "/");
  const html = await index.text();
  const assets = [
    ...new Set(
      [...html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css))"/g)]
        .map((match) => match[1])
        .filter((path) => /[-.][a-z0-9_-]{8,}\.(?:js|css)$/i.test(path)),
    ),
  ];
  assert.ok(
    assets.some((path) => path.endsWith(".js")),
    "Hashed JavaScript missing",
  );
  assert.ok(
    assets.some((path) => path.endsWith(".css")),
    "Hashed CSS missing",
  );
  for (const path of assets) {
    const url = new URL(path, baseUrl);
    assert.equal(url.origin, baseUrl, "Smoke must not fetch external assets");
    const asset = await request(url);
    assert.equal(asset.status, 200, path);
    assert.equal(
      asset.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
      path,
    );
    assert.match(
      asset.headers.get("content-type") ?? "",
      /javascript|text\/css/,
      path,
    );
    checkSecurityHeaders(asset, path);
    await asset.arrayBuffer();
  }

  const runtime = await request(`${baseUrl}/config/runtime-config.json`);
  assert.equal(runtime.status, 200);
  assert.equal(runtime.headers.get("cache-control"), "no-store, max-age=0");
  checkSecurityHeaders(runtime, "/config/runtime-config.json");
  const config = await runtime.json();
  assert.equal(config.apiUrl, "https://api.qa.invalid/api/v1");
  assert.equal(config.auth.supabaseUrl, "https://auth.qa.invalid");
  assert.equal(config.auth.demoEnabled, false);
  assert.equal(config.auth.demoPassword, "");
  assert.equal(
    config.maps.tileUrl,
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  );
  assert.equal(config.maps.smallCountThreshold, 5);
  evidence.runtimeConfig = config;
  evidence.passed = true;
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  const logs = docker(["logs", name], { allowFailure: true });
  evidence.logs = `${logs.stdout ?? ""}${logs.stderr ?? ""}`.slice(-12_000);
  process.exitCode = 1;
} finally {
  const inspection = docker(
    ["inspect", name, "--format", "{{json .Config.Labels}}"],
    { allowFailure: true },
  );
  if (inspection.status === 0) {
    try {
      const labels = JSON.parse(inspection.stdout);
      assert.equal(
        labels["sigvits.qa.owner"],
        owner,
        "Refusing cleanup of a foreign container",
      );
      assert.equal(
        labels["sigvits.qa.instance"],
        instance,
        "Refusing cleanup of another QA instance",
      );
      docker(["rm", "--force", name]);
      evidence.cleanup = "removed-own-container";
    } catch (error) {
      evidence.cleanup = error instanceof Error ? error.message : String(error);
      evidence.passed = false;
      process.exitCode = 1;
    }
  } else if (evidence.cleanup === "pending") {
    evidence.cleanup = "could-not-verify-removal";
    evidence.passed = false;
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  const target = resolve(values.evidence);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

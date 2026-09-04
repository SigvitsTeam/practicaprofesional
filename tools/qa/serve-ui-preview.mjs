// Local-only visual QA. All API responses are synthetic; mutations never leave this server.
// Start Angular on 4200 first, then: node tools/qa/serve-ui-preview.mjs
import { createServer } from "node:http";

const origin = "http://localhost:4300";
const stamp = "2026-09-03T00:00:00.000Z";
const region = {
  id: "qa-region",
  code: "QA",
  name: "Región de prueba visual",
  type: "SANITARIA",
  operationalStatus: "ACTIVA",
  active: true,
  updatedAt: stamp,
};
const municipality = {
  id: "qa-municipality",
  regionId: region.id,
  regionName: region.name,
  officialCode: "QA-01",
  name: "Municipio de prueba visual",
  operationalStatus: "ACTIVO",
  mapValidated: false,
  active: true,
  facilityCount: 1,
  updatedAt: stamp,
};
const facility = {
  id: "qa-facility",
  municipalityId: municipality.id,
  municipalityName: municipality.name,
  code: "QA-02",
  name: "Establecimiento sintético para revisión de diseño",
  type: "CIS",
  operationalStatus: "ACTIVO",
  active: true,
  coordinatesValidated: false,
  updatedAt: stamp,
};
const user = {
  id: "qa-user",
  fullName: "Usuario sintético con nombre institucional largo",
  email: "qa-invitaciones@example.invalid",
  active: false,
  hasExternalIdentity: false,
  role: {
    code: "COORDINADOR_MUNICIPAL",
    name: "Coordinador Municipal",
    startDate: "2026-09-01",
  },
  assignment: {
    scopeType: "MUNICIPIO",
    municipalityId: municipality.id,
    label: municipality.name,
    startDate: "2026-09-01",
  },
  updatedAt: stamp,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", origin);
  const json = (value, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  if (!["GET", "HEAD"].includes(req.method ?? "")) {
    json(
      {
        message:
          "QA: envío simulado rechazado. Revise AUTH_ADMIN_SECRET y la configuración SMTP. Ningún correo fue enviado.",
      },
      503,
    );
    return;
  }
  if (url.pathname === "/config/runtime-config.json") {
    json({
      apiUrl: `${origin}/api`,
      auth: { supabaseUrl: "", supabaseAnonKey: "", demoEnabled: true },
    });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/v1/regions") json([region]);
    else if (url.pathname === "/api/v1/territories/catalog")
      json({ municipalities: [municipality], facilities: [facility] });
    else if (url.pathname === "/api/v1/admin/users") json([user]);
    else if (url.pathname === "/api/v1/territories/networks")
      json([{
        id: "qa-network", regionId: region.id, regionName: region.name,
        code: "QA-RED", name: "Red sintética para revisión de alcance municipal",
        operationalStatus: "EN_PILOTAJE", active: true, startDate: "2026-01-01",
        updatedAt: stamp, scopeLimited: true,
        membershipAsOf: url.searchParams.get("asOf") ?? "2026-09-04",
        municipalities: [{ id: municipality.id, code: municipality.officialCode, name: municipality.name, startDate: "2026-01-01" }],
      }]);
    else if (url.pathname === "/api/v1/analytics/territorial")
      json({ level: "MUNICIPIO", year: 2026, month: 7, rows: [{
        id: municipality.id, code: municipality.officialCode, name: municipality.name,
        status: "BORRADOR", attentions: 14, newCases: 9, controls: 5, alerts: 0, reportId: "qa-report",
      }] });
    else if (url.pathname === "/api/v1/territories/audit-events")
      json({ items: [] });
    else json([]);
    return;
  }
  try {
    // Only copy the path to a fixed local upstream; do not proxy arbitrary hosts or credentials.
    const upstream = new URL("http://localhost:4200");
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    const response = await fetch(upstream, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    res.writeHead(response.status, {
      "Content-Type":
        response.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    json(
      {
        message:
          "Inicie Angular en localhost:4200 antes de usar esta vista de QA.",
      },
      502,
    );
  }
});
server.listen(4300, "127.0.0.1", () =>
  console.log(`QA visual aislado: ${origin}. No usar para producción.`),
);

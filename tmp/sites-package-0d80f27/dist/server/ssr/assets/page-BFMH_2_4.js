import { a as require_react, o as __toESM, t as require_jsx_runtime } from "../index.js";
//#region app/page.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var reports = [
	{
		name: "CIS Cornelio Moncada Córdova",
		code: "CIS-001",
		status: "Aprobado",
		total: 31,
		newCases: 24,
		controls: 7,
		outside: 5,
		alerts: 0,
		sent: "25 jul, 09:42"
	},
	{
		name: "CIS Medina",
		code: "CIS-002",
		status: "En revisión",
		total: 28,
		newCases: 21,
		controls: 7,
		outside: 3,
		alerts: 2,
		sent: "26 jul, 14:18"
	},
	{
		name: "UAPS Cieneguita",
		code: "UAPS-004",
		status: "Devuelto",
		total: 17,
		newCases: 13,
		controls: 4,
		outside: 2,
		alerts: 3,
		sent: "24 jul, 11:05"
	},
	{
		name: "UAPS Baracoa",
		code: "UAPS-006",
		status: "Pendiente",
		total: 0,
		newCases: 0,
		controls: 0,
		outside: 0,
		alerts: 0,
		sent: "Sin envío"
	},
	{
		name: "UAPS Río Mar",
		code: "UAPS-008",
		status: "Aprobado",
		total: 22,
		newCases: 17,
		controls: 5,
		outside: 7,
		alerts: 0,
		sent: "23 jul, 16:30"
	},
	{
		name: "UAPS Travesía",
		code: "UAPS-010",
		status: "En revisión",
		total: 19,
		newCases: 14,
		controls: 5,
		outside: 4,
		alerts: 1,
		sent: "27 jul, 08:16"
	}
];
var menu = [
	["▦", "Inicio"],
	["▤", "Captura ITS 1"],
	["▥", "Reporte ITS 2"],
	["✓", "Bandeja de revisión"],
	["▧", "Consolidados"],
	["⌖", "Mapas"],
	["↗", "Reportes y exportaciones"],
	["⚙", "Administración"]
];
var trend = [
	112,
	126,
	118,
	147,
	156,
	171,
	184
];
var maxTrend = Math.max(...trend);
var screenMeta = {
	"Inicio": [
		"COORDINACIÓN MUNICIPAL · PUERTO CORTÉS",
		"Resumen epidemiológico",
		"Seguimiento del período, cobertura y calidad de los reportes ITS."
	],
	"Captura ITS 1": [
		"ESTABLECIMIENTO · CIS MEDINA",
		"Captura de atención ITS 1",
		"Registro individual protegido para el establecimiento de salud."
	],
	"Reporte ITS 2": [
		"ESTABLECIMIENTO · CIS MEDINA",
		"Reporte mensual ITS 2",
		"Consolidado generado desde las atenciones ITS 1 del establecimiento."
	],
	"Bandeja de revisión": [
		"COORDINACIÓN MUNICIPAL · PUERTO CORTÉS",
		"Bandeja de revisión",
		"Revisión de reportes ITS 2 agregados por establecimiento."
	],
	"Consolidados": [
		"COORDINACIÓN MUNICIPAL · PUERTO CORTÉS",
		"Consolidado municipal",
		"Seguimiento del flujo de aprobación y consolidación institucional."
	],
	"Mapas": [
		"ANÁLISIS TERRITORIAL · PUERTO CORTÉS",
		"Mapa operativo ITS",
		"Producción y procedencias registradas por establecimiento."
	],
	"Reportes y exportaciones": [
		"GESTIÓN DOCUMENTAL · PUERTO CORTÉS",
		"Reportes y exportaciones",
		"Generación y descarga auditada de informes oficiales."
	],
	"Administración": [
		"CONFIGURACIÓN · TERRITORIO",
		"Administración territorial",
		"Estructura sanitaria, cobertura y preparación operativa del piloto."
	]
};
function Home() {
	const [active, setActive] = (0, import_react.useState)("Inicio");
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)("");
	const [search, setSearch] = (0, import_react.useState)("");
	const filtered = (0, import_react.useMemo)(() => reports.filter((report) => report.name.toLowerCase().includes(search.toLowerCase())), [search]);
	function act(message) {
		setNotice(message);
		window.setTimeout(() => setNotice(""), 3200);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "app-shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "sidebar",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "brand",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "brand-mark",
							children: "S+"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "SIGVITS" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Vigilancia en salud" })] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						"aria-label": "Navegación principal",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "nav-label",
								children: "OPERACIÓN"
							}),
							menu.slice(0, 6).map(([icon, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: active === label ? "nav-item active" : "nav-item",
								onClick: () => setActive(label),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "nav-icon",
										children: icon
									}),
									label,
									label === "Bandeja de revisión" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "nav-count",
										children: "5"
									})
								]
							}, label)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "nav-label nav-second",
								children: "GESTIÓN"
							}),
							menu.slice(6).map(([icon, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: active === label ? "nav-item active" : "nav-item",
								onClick: () => setActive(label),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "nav-icon",
									children: icon
								}), label]
							}, label))
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "privacy-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "lock",
							children: "●"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Vista consolidada" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Sin acceso a datos individuales ITS 1." })] })]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "workspace",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "topbar",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "breadcrumb",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Honduras" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "›" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Cortés" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "›" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Puerto Cortés" })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "top-actions",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "icon-button",
							"aria-label": "Notificaciones",
							children: ["●", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ping" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "user",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "avatar",
									children: "AM"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: active === "Captura ITS 1" || active === "Reporte ITS 2" ? "Lic. María López" : "Dra. Ana Martínez" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: active === "Captura ITS 1" || active === "Reporte ITS 2" ? "Responsable de establecimiento" : "Coordinadora Municipal" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "⌄" })
							]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "content",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "page-heading",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "eyebrow",
										children: screenMeta[active][0]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: screenMeta[active][1] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: screenMeta[active][2] })
								] }),
								active === "Inicio" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									className: "primary-button",
									onClick: () => act("Preparando consolidado municipal de julio 2026…"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "＋" }), " Generar consolidado"]
								}),
								active === "Captura ITS 1" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									className: "primary-button",
									onClick: () => act("Atención guardada correctamente."),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "＋" }), " Guardar atención"]
								}),
								active === "Reporte ITS 2" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "primary-button",
									onClick: () => act("Reporte enviado a coordinación municipal."),
									children: "Enviar a coordinación →"
								}),
								active === "Consolidados" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									className: "primary-button",
									onClick: () => act("Consolidado municipal generado como versión 1."),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "＋" }), " Generar consolidado"]
								}),
								active === "Reportes y exportaciones" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									className: "primary-button",
									onClick: () => act("Nueva exportación agregada a la cola."),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "＋" }), " Generar reporte"]
								}),
								active === "Administración" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									className: "primary-button",
									onClick: () => act("Formulario de nuevo establecimiento abierto."),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "＋" }), " Nuevo establecimiento"]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "filters",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Período" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									defaultValue: "Julio 2026",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Julio 2026" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Junio 2026" })]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Semana epidemiológica" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									defaultValue: "Todas",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Todas" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "SE 29" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "SE 28" })
									]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Municipio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									defaultValue: "Puerto Cortés",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Puerto Cortés" })
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sync",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), " Actualizado hoy, 10:42"]
								})
							]
						}),
						active === "Inicio" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardView, {
							setActive,
							setSelected,
							act
						}),
						active === "Captura ITS 1" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CaptureView, { act }),
						active === "Reporte ITS 2" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Its2View, { act }),
						active === "Bandeja de revisión" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewView, {
							reports: filtered,
							search,
							setSearch,
							setSelected,
							act
						}),
						active === "Consolidados" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConsolidatedView, { act }),
						active === "Mapas" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapView, { act }),
						active === "Reportes y exportaciones" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportsView, { act }),
						active === "Administración" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerritoryView, { act })
					]
				})]
			}),
			selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "drawer-backdrop",
				onClick: () => setSelected(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "drawer",
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "drawer-head",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "eyebrow",
									children: "REPORTE ITS 2 · JULIO 2026"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: selected.name }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [selected.code, " · Versión 1"] })
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "close",
								onClick: () => setSelected(null),
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `status status-${selected.status.toLowerCase().replace(" ", "-").replace("ó", "o")}`,
							children: selected.status
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "drawer-metrics",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total ITS" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: selected.total })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Casos nuevos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: selected.newCases })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Controles" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: selected.controls })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Comunidades reportadas" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: selected.outside })] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "quality",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Validaciones de calidad" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "quality-row ok",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Totales por sexo conciliados" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Correcto" })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "quality-row warning",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "!" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Procedencias no reconocidas" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: selected.alerts })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "quality-row ok",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Denominador de atenciones" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Completo" })
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "timeline",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Historial" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Reporte enviado a coordinación" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [selected.sent, " · Responsable del establecimiento"] })] })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "ITS 2 recalculado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "22 jul, 15:20 · Sistema" })] })] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "observations",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Observación de revisión" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { placeholder: "Escriba una indicación para el establecimiento…" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "drawer-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "secondary-button",
								onClick: () => act("Reporte devuelto con observación."),
								children: "Devolver"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "primary-button",
								onClick: () => act("Reporte aprobado y registrado en auditoría."),
								children: "Aprobar reporte"
							})]
						})
					]
				})
			}),
			notice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "toast",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }), notice]
			})
		]
	});
}
function DashboardView({ setActive, setSelected, act }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "kpi-grid",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi featured",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Casos ITS del período" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "↗" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "184" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "+7.6%" }), " respecto a junio"] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "spark",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Casos nuevos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "blue",
								children: "＋"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "139" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "75.5% del total" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Controles" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "purple",
								children: "↻"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "45" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "24.5% del total" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tasa ITS / 1,000" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "teal",
								children: "%"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "4.8" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "38,294 atenciones válidas" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi reports-kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reportes recibidos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "green",
								children: "✓"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["9 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "/ 12" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "progress",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "75% de cumplimiento" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi warning-kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pendientes de envío" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "amber",
								children: "!"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "3" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Requieren seguimiento" })
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "dashboard-grid",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "panel trend-panel",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "panel-heading",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Tendencia mensual de casos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Enero — julio 2026" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "legend",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), " Total ITS"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "chart",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "y-axis",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "200" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "150" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "100" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "50" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "0" })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bars",
						children: trend.map((value, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bar-slot",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: index === trend.length - 1 ? "bar current" : "bar",
								style: { height: `${value / maxTrend * 90}%` },
								"data-value": value
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: [
								"Ene",
								"Feb",
								"Mar",
								"Abr",
								"May",
								"Jun",
								"Jul"
							][index] })]
						}, value))
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "panel alerts-panel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "panel-heading",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Atención requerida" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Alertas del período" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setActive("Bandeja de revisión"),
							children: "Ver todas"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "alert-row",
						onClick: () => act("Filtro aplicado: reportes pendientes."),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "alert-icon amber",
								children: "!"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "3 reportes sin enviar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "El plazo vence en 4 días" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "›" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "alert-row",
						onClick: () => setSelected(reports[2]),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "alert-icon red",
								children: "↩"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "1 reporte devuelto" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "UAPS Cieneguita · 3 observaciones" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "›" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "alert-row",
						onClick: () => act("Abriendo registros con procedencia incompleta."),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "alert-icon blue",
								children: "⌖"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "4 procedencias por completar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Requieren comunidad o dirección" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "›" })
						]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportTable, {
			reports: reports.slice(0, 5),
			setSelected,
			footerAction: () => setActive("Bandeja de revisión")
		})
	] });
}
function ReviewView({ reports, search, setSearch, setSelected, act }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "review-summary",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "En revisión" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "2" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "dot blue-dot" })
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Aprobados" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "6" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "dot green-dot" })
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Devueltos" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "1" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "dot red-dot" })
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pendientes" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "dot amber-dot" })
			] })
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "panel review-panel",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "table-toolbar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "search",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "⌕" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: search,
					onChange: (event) => setSearch(event.target.value),
					placeholder: "Buscar establecimiento…"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				"aria-label": "Filtrar por estado",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Todos los estados" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "En revisión" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Aprobado" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Devuelto" })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "secondary-button",
				onClick: () => act("Tabla exportada para revisión."),
				children: "↓ Exportar"
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportTable, {
			reports,
			setSelected
		})]
	})] });
}
function SectionHeader({ title, description, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "section-header",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: title }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: description })] }), action]
	});
}
function CaptureView({ act }) {
	const [sex, setSex] = (0, import_react.useState)("Mujer");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "capture-layout",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "form-stack",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel form-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
						title: "Datos de la atención",
						description: "La semana epidemiológica se calcula automáticamente."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Fecha de atención *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "date",
								defaultValue: "2026-07-27"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Semana epidemiológica" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: "SE 31 · 26 jul — 1 ago",
								readOnly: true
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "N.º de expediente *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: "Ej. PC-024891" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipo de caso *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								defaultValue: "Nuevo",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Nuevo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Control" })]
							})] })
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel form-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
							title: "Procedencia",
							description: "Ingrese manualmente la comunidad o dirección indicada por el paciente."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "form-grid",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Comunidad o dirección de procedencia *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									defaultValue: "Barrio El Centro, Puerto Cortés",
									placeholder: "Escriba la comunidad o dirección completa"
								})]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "inline-alert info-inline",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "i" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "La procedencia se guardará tal como fue digitada y no requiere seleccionar opciones de un catálogo." })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel form-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
							title: "Datos del paciente",
							description: "Información sensible disponible únicamente en este establecimiento."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "form-grid form-grid-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sexo *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: sex,
									onChange: (event) => setSex(event.target.value),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Mujer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Hombre" })]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Edad *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									defaultValue: "26"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Población" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "General" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Trabajador(a) sexual" })] })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Contacto" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "No" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Sí" })] })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Embarazada" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									disabled: sex === "Hombre",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "No" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Sí" })]
								})] })
							]
						}),
						sex === "Hombre" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "inline-alert info-inline",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "i" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "El campo embarazo fue deshabilitado por la selección de sexo." })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel form-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
							title: "Diagnóstico",
							description: "Una atención puede incluir uno o varios diagnósticos.",
							action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "text-action",
								onClick: () => act("Se agregó una nueva fila de diagnóstico."),
								children: "＋ Agregar diagnóstico"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "diagnosis-row",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Clasificación *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									defaultValue: "Sindrómico",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Sindrómico" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Clínico" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "C/E" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Etiológico" })
									]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Enfermedad *" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									defaultValue: "Vaginitis",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Vaginitis" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Úlcera genital" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Condiloma acuminado" })
									]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipo de caso" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Nuevo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Control" })] })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "delete-row",
									"aria-label": "Eliminar diagnóstico",
									children: "×"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "notes-field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Observaciones" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { placeholder: "Observaciones clínicas o de digitación…" })]
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "capture-aside",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel context-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Contexto automático" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Establecimiento" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "CIS Medina" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Código" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "CIS-002" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Municipio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "Puerto Cortés" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Período" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "Julio 2026" })] })
					] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel quality-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Validación en tiempo real" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "validation ok",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Fecha dentro del período abierto" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "validation ok",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Procedencia ingresada" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "validation pending",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "•" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Ingrese expediente para validar duplicados" })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel recent-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Registros recientes" }),
						[
							"PC-024885 · Vaginitis",
							"PC-024883 · Úlcera genital",
							"PC-024879 · Condiloma"
						].map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
							27 - index,
							" jul · ",
							10 + index,
							":2",
							index
						] })] }, row)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => act("Abriendo registros del mes."),
							children: "Ver 42 registros del mes →"
						})
					]
				})
			]
		})]
	});
}
function Its2View({ act }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "report-hero panel",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "status status-pendiente",
					children: "Borrador · Versión 1"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Reporte ITS 2 · CIS Medina" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Generado desde 76 atenciones ITS 1 registradas al 27 de julio." })
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "report-actions",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "secondary-button",
					onClick: () => act("ITS 2 recalculado con los últimos registros."),
					children: "↻ Recalcular"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "secondary-button",
					onClick: () => act("Borrador guardado."),
					children: "Guardar borrador"
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "kpi-grid its2-kpis",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total ITS" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "green",
								children: "∑"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "88" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "76 atenciones registradas" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Casos nuevos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "blue",
								children: "＋"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "66" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "75% del total" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Controles" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "purple",
								children: "↻"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "22" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "25% del total" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "kpi",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "kpi-top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Procedencias registradas" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "amber",
								children: "⌖"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "76" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "100% de las atenciones" })
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "its2-layout",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "panel",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
					title: "Consolidado por enfermedad",
					description: "Nuevos y controles generados automáticamente.",
					action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "export-mini",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => act("Vista previa de Excel generada."),
							children: "XLSX"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => act("Vista previa de PDF generada."),
							children: "PDF"
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "table-wrap",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Enfermedad" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Nuevos" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Controles" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Total" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "%" })
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: [
						[
							"Síndrome de secreción uretral",
							18,
							6,
							24
						],
						[
							"Vaginitis",
							15,
							5,
							20
						],
						[
							"Condiloma acuminado",
							11,
							4,
							15
						],
						[
							"Úlcera genital",
							8,
							3,
							11
						],
						[
							"Otros diagnósticos",
							14,
							4,
							18
						]
					].map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: row[0] }) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row[1] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row[2] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: row[3] }) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [Math.round(Number(row[3]) / 88 * 100), "%"] })
					] }, row[0])) })] })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "panel preflight",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
						title: "Listo para enviar",
						description: "5 de 7 controles aprobados"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "preflight-progress",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "validation ok",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Totales por sexo conciliados" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "validation ok",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Atenciones < 15: completo" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "validation warning",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "!" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "4 procedencias no reconocidas" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "validation warning",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "!" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "2 posibles duplicados" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "validation ok",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "✓" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Denominadores de tasa cargados" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "primary-button full-button",
						onClick: () => act("Reporte enviado y congelado como versión 1."),
						children: "Enviar a coordinación municipal"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "audit-note",
						children: "El envío quedará congelado y registrado en auditoría."
					})
				]
			})]
		})
	] });
}
function ConsolidatedView({ act }) {
	const steps = [
		[
			"Establecimientos",
			"9 de 12 recibidos",
			"En curso"
		],
		[
			"Coordinación municipal",
			"Pendiente de consolidar",
			"Actual"
		],
		[
			"Región Sanitaria Cortés",
			"Aún no enviado",
			"Pendiente"
		],
		[
			"Nivel central",
			"Aún no disponible",
			"Pendiente"
		]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "flow-strip",
			children: steps.map((step, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: index === 1 ? "flow-step active-step" : "flow-step",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: index + 1 }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: step[0] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: step[1] })] }),
					index < steps.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "→" })
				]
			}, step[0]))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "consolidated-grid",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "panel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
						title: "Preparación del consolidado municipal",
						description: "Estado de los 12 establecimientos del piloto.",
						action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "text-action",
							onClick: () => act("Validaciones actualizadas."),
							children: "↻ Actualizar"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "completion-ring-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "completion-ring",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "75%" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "completo" })] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "completion-stats",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "green-dot" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Aprobados" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "6" })
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "blue-dot" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "En revisión" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "2" })
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "red-dot" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Devueltos" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "1" })
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "amber-dot" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sin enviar" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "3" })
								] })
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "blocking",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "!" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "4 elementos impiden el envío a región" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "1 reporte devuelto y 3 establecimientos sin envío." })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => act("Bandeja filtrada por bloqueos."),
								children: "Revisar bloqueos"
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "panel consolidated-summary",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
						title: "Resumen preliminar",
						description: "Datos agregados de reportes aprobados."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "summary-number",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Total ITS" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "184" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "139 nuevos · 45 controles" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mini-bars",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Procedencia completa" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { width: "98%" } }) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "180" })
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Por completar" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { width: "2%" } }) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "4" })
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Mujeres" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { width: "62%" } }) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "114" })
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hombres" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { width: "38%" } }) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "70" })
							] })
						]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "panel audit-timeline",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
				title: "Actividad del consolidado",
				description: "Historial institucional auditable."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "timeline-horizontal",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
							className: "done",
							children: "✓"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Período abierto" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1 jul · Sistema" })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
							className: "done",
							children: "✓"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Primer reporte aprobado" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "18 jul · Ana Martínez" })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
							className: "current",
							children: "•"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Recepción en curso" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "9 de 12 reportes" })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "4" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Consolidar municipio" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pendiente" })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "5" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Enviar a región" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pendiente" })
					] })
				]
			})]
		})
	] });
}
function MapView({ act }) {
	const [mode, setMode] = (0, import_react.useState)("Producción total");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "map-kpis",
		children: [
			[
				"Producción total",
				"184",
				"green"
			],
			[
				"Comunidades reportadas",
				"23",
				"blue"
			],
			[
				"Direcciones registradas",
				"180",
				"amber"
			],
			[
				"Procedencia pendiente",
				"4",
				"red"
			]
		].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: `${item[2]}-dot` }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item[0] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: item[1] })
		] }, item[0]))
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "map-layout",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "panel map-filters",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
						title: "Vista y capas",
						description: "Ajuste el análisis territorial."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mode-switch",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: mode === "Producción total" ? "selected" : "",
							onClick: () => setMode("Producción total"),
							children: "Producción total"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: mode === "Por procedencia" ? "selected" : "",
							onClick: () => setMode("Por procedencia"),
							children: "Por procedencia"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { children: "CAPAS VISIBLES" }),
					[
						"Límite municipal",
						"Establecimientos de salud",
						"Comunidades y barrios",
						"Procedencias registradas"
					].map((layer, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "layer-row",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								defaultChecked: index < 3
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: layer }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
						]
					}, layer)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { children: "FILTROS" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "filter-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Enfermedad" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Todas las enfermedades" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Vaginitis" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Úlcera genital" })
						] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "filter-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sexo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Todos" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Mujer" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Hombre" })
						] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "filter-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipo de caso" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Nuevos y controles" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Nuevos" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Controles" })
						] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "secondary-button full-button",
						onClick: () => act("Filtros restablecidos."),
						children: "Restablecer filtros"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "map-canvas panel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "map-toolbar",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: mode }), " · Julio 2026"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { children: "＋" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { children: "−" })] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "water",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Mar Caribe" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "land-shape" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "road road-a" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "road road-b" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "road road-c" }),
					[
						[
							"31",
							"CIS Cornelio",
							"42%",
							"53%",
							"marker-a"
						],
						[
							"28",
							"CIS Medina",
							"58%",
							"47%",
							"marker-b"
						],
						[
							"17",
							"UAPS Cieneguita",
							"28%",
							"35%",
							"marker-c"
						],
						[
							"22",
							"UAPS Río Mar",
							"69%",
							"61%",
							"marker-d"
						],
						[
							"19",
							"UAPS Travesía",
							"77%",
							"40%",
							"marker-e"
						],
						[
							"14",
							"UAPS Baracoa",
							"37%",
							"70%",
							"marker-f"
						]
					].map((marker) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: `map-marker ${marker[4]}`,
						style: {
							left: marker[2],
							top: marker[3]
						},
						onClick: () => act(`${marker[1]}: ${marker[0]} casos en el período.`),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: mode === "Producción total" ? marker[0] : Math.max(8, Number(marker[0]) - 4) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: marker[1] })]
					}, marker[1])),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "map-legend",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "low" }), "1–15"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "mid" }), "16–25"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "high" }), "26+"] })
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "panel ranking",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
					title: "Establecimientos",
					description: "Ranking del período."
				}), reports.slice(0, 5).map((report, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => act(`${report.name}: ${report.total} casos y ${report.outside} comunidades reportadas.`),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: index + 1 }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: report.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [report.outside, " comunidades reportadas"] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: report.total })
					]
				}, report.code))]
			})
		]
	})] });
}
function ExportsView({ act }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "export-catalog",
			children: [
				[
					"▦",
					"ITS 2 municipal",
					"Consolidado oficial del municipio"
				],
				[
					"▤",
					"Evaluación anual",
					"Indicadores y tasas del período"
				],
				[
					"↕",
					"Comparativo anual",
					"Variación interanual de resultados"
				],
				[
					"⌖",
					"Resumen territorial",
					"Comunidades y direcciones registradas"
				]
			].map((card) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				className: "panel",
				onClick: () => act(`Configurando reporte: ${card[1]}.`),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: card[0] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: card[1] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: card[2] })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" })
				]
			}, card[1]))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "panel exports-table",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "table-toolbar",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Archivos generados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Historial de generación y descarga auditada." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Todos los formatos" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Excel" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "PDF" })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "secondary-button",
					children: "Filtrar"
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "table-wrap",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Reporte" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Período" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Plantilla" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Formato" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Estado" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Fecha" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: [
					[
						"Consolidado municipal ITS 2",
						"Julio 2026",
						"v2.1",
						"XLSX",
						"Generado",
						"27 jul, 10:18"
					],
					[
						"Reporte ITS 2 · Puerto Cortés",
						"Julio 2026",
						"v2.1",
						"PDF",
						"Generado",
						"27 jul, 09:44"
					],
					[
						"Evaluación anual ITS",
						"Ene–Dic 2025",
						"v1.4",
						"XLSX",
						"Generando",
						"27 jul, 09:36"
					],
					[
						"Comparativo anual 2024–2025",
						"Anual",
						"v1.2",
						"PDF",
						"Generado",
						"26 jul, 16:12"
					],
					[
						"Consolidado regional Cortés",
						"Junio 2026",
						"v2.1",
						"XLSX",
						"Error",
						"26 jul, 14:07"
					]
				].map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: row[0] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Generado por Ana Martínez" })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row[1] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row[2] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `file-badge ${String(row[3]).toLowerCase()}`,
						children: row[3]
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: `job-status job-${String(row[4]).toLowerCase()}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), row[4]]
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row[5] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "download-button",
						onClick: () => act(row[4] === "Generado" ? `Descargando ${row[0]}.` : "Este archivo aún no está disponible."),
						children: row[4] === "Generado" ? "↓" : "•••"
					}) })
				] }, row[0] + row[3])) })] })
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "export-footnote",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "●" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Cada generación y descarga queda registrada con usuario, fecha, alcance y parámetros utilizados." })]
		})
	] });
}
function TerritoryView({ act }) {
	const [territory, setTerritory] = (0, import_react.useState)("Puerto Cortés");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "territory-layout",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "panel territory-tree",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "tree-search",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "⌕" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { placeholder: "Buscar territorio…" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tree-node root-node",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setTerritory("Honduras"),
							children: [
								"⌄ ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "🇭🇳" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Honduras" })
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tree-node level-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setTerritory("Cortés"),
							children: [
								"⌄ ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "▱" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Cortés" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1" })
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tree-node level-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: territory === "Puerto Cortés" ? "selected" : "",
							onClick: () => setTerritory("Puerto Cortés"),
							children: [
								"⌄ ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "◇" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Puerto Cortés" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "12" })
							]
						})
					}),
					[
						"CIS Cornelio Moncada Córdova",
						"CIS Medina",
						"UAPS Cieneguita",
						"UAPS Baracoa",
						"UAPS Río Mar",
						"UAPS Travesía"
					].map((name, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tree-node level-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setTerritory(name),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: index === 3 ? "warning-node" : "",
								children: "＋"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: name })]
						})
					}, name))
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "territory-main",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel territory-detail",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "territory-title",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "eyebrow",
									children: territory.includes("CIS") || territory.includes("UAPS") ? "ESTABLECIMIENTO DE SALUD" : "COORDINACIÓN MUNICIPAL"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: territory }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Código sanitario: HN-CR-PCM-001" })
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "status status-en-revision",
								children: "En pilotaje"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "detail-tabs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "selected",
									children: "Información general"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { children: "Cobertura" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { children: "Responsables" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { children: "Historial" })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "territory-form",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Nombre oficial" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: territory,
									readOnly: true
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Código" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { defaultValue: "PCM-001" })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Región sanitaria" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Región Sanitaria Departamental de Cortés" }) })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Responsable asignado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Dra. Ana Martínez" }) })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Estado operativo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "En pilotaje" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Activo" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Inactivo" })
								] })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Establecimientos activos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: "12 de 12",
									readOnly: true
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "coordinate-panel",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mini-map",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Puerto Cortés" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "＋" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Validación geográfica" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "La geometría municipal está vinculada al catálogo oficial y fue validada visualmente." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "validation-chip",
									children: "✓ Geometría validada"
								})
							] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "save-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "secondary-button",
								children: "Cancelar"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "primary-button",
								onClick: () => act("Cambios territoriales guardados en auditoría."),
								children: "Guardar cambios"
							})]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "territory-alerts",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel readiness",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
							title: "Preparación del piloto",
							description: "Configuración territorial"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "readiness-value",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "83%" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "completado" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "progress",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: "83%" } })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "10 de 12 establecimientos listos" })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
						title: "Alertas territoriales",
						description: "Requieren atención"
					}), [
						["!", "2 establecimientos sin coordenadas"],
						["!", "1 comunidad sin cobertura"],
						["i", "3 responsables por confirmar"]
					].map((alert, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "territory-alert",
						onClick: () => act(alert[1]),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: index < 2 ? "warning" : "info",
								children: alert[0]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: alert[1] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "›" })
						]
					}, alert[1]))]
				})]
			})
		]
	});
}
function ReportTable({ reports, setSelected, footerAction }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: footerAction ? "panel table-panel" : "table-embedded",
		children: [footerAction && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "panel-heading table-title",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Estado de reportes por establecimiento" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Consolidado ITS 2 · Julio 2026" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: footerAction,
				children: "Ver bandeja completa →"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "table-wrap",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Establecimiento" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Estado" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Total ITS" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Nuevos" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Controles" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Comunidades reportadas" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Alertas" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
			] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: reports.map((report) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				onClick: () => setSelected(report),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: report.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: report.code })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `status status-${report.status.toLowerCase().replace(" ", "-").replace("ó", "o")}`,
						children: report.status
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: report.total || "—" }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.newCases || "—" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.controls || "—" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.outside || "—" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.alerts ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "alert-count",
						children: ["! ", report.alerts]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "check",
						children: "✓"
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "row-action",
						"aria-label": `Revisar ${report.name}`,
						children: "›"
					}) })
				]
			}, report.code)) })] })
		})]
	});
}
//#endregion
export { Home as default };

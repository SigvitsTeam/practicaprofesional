# Fuentes geográficas del piloto

## Criterio de calidad

SIGVITS diferencia una coordenada puntual confirmada del establecimiento y una referencia
comunitaria. Una referencia comunitaria permite dibujar el mapa con geografía real, pero mantiene
`coordenadas_validadas = false` hasta que la Secretaría de Salud o la Coordinación de Puerto
Cortés confirme el punto mediante levantamiento GPS.

## Coordenadas puntuales confirmadas

| Código | Establecimiento | Latitud | Longitud | Fuente |
|---|---|---:|---:|---|
| `2739` | CIS Bajamar | 15.885749 | -87.85609268 | Términos de referencia OPS/OMS para rehabilitación del CIS Bajamar |
| `2747` | CIS Baracoa | 15.773253 | -87.852831 | OPS/OMS, evaluación rápida de impacto Eta/Iota, ficha Baracoa |

## Referencias comunitarias

Los puntos de La Pita, Travesía, Saraguayna, Fraternidad, Calán, Puente Alto, La Caoba y
Kele Kele provienen de la capa pública **Asentamientos humanos** del servicio RMGIR
`Honduras_Datos_Básicos_WGS84`, filtrada por el código municipal `0506`. La capa publica el
código censal, aldea, caserío y geometría WGS84. Estas coordenadas representan el asentamiento,
no necesariamente la puerta del establecimiento.

## Límite municipal 0506

El límite de Puerto Cortés se considera validado para navegación y visualización territorial. La
identidad oficial `0506 Puerto Cortés` está publicada en el módulo municipal del **Sistema
Nacional de Información Territorial de Honduras (SINIT)**. SINIT identifica su cartografía básica
como fuente oficial de departamentos, municipios, aldeas y caseríos, y publica sus geoservicios en
WGS 84. Como verificación técnica independiente, el servicio público **RMGIR** expone las capas
poligonales `Límite municipal` y `Municipios` en WGS 84; esta última incluye el campo
`GEOCODIGO` que permite seleccionar `0506`.

Esta validación corresponde a la geometría municipal. No convierte automáticamente en puntos GPS
validados las referencias comunitarias de los establecimientos.

El Policlínico Cornelio Moncada utiliza como referencia el barrio El Copen en OpenStreetMap y la
dirección publicada por la Municipalidad de Puerto Cortés: 9 calle, 2 avenida. CIS Linda Coello
utiliza como referencia el barrio Medina, debido a que las fuentes públicas consultadas no
publican todavía un punto inequívoco del edificio.

## Fuentes consultadas

- OPS/OMS: `https://www.paho.org/sites/default/files/2021-02/Ficha%20tecnica_Baracoa.pdf`
- OPS/OMS: `https://www.paho.org/sites/default/files/2021-01/eval-afectaciones-12-centros-salud-iInforme.pdf`
- Municipalidad de Puerto Cortés: `https://ampcwp.ampuertocortes.hn/2022/07/12/avances-de-la-construccion-del-centro-integral-de-salud/`
- UNICEF Honduras / Alcaldía de Puerto Cortés: `https://www.unicef.org/honduras/media/2936/file/SITAN%20Puerto%20Cort%C3%A9s.pdf`
- RMGIR, capa Asentamientos humanos: `https://rmgir.proyectomesoamerica.org/server/rest/services/RMGIR/Honduras_Datos_B%C3%A1sicos_WGS84/MapServer/1`
- RMGIR, capa Límite municipal WGS84: `https://rmgir.proyectomesoamerica.org/server/rest/services/RMGIR/Honduras_Datos_B%C3%A1sicos_WGS84/MapServer/27`
- RMGIR, capa Municipios WGS84 (`GEOCODIGO`): `https://rmgir.proyectomesoamerica.org/server/rest/services/RMGIR/Honduras_Datos_B%C3%A1sicos_WGS84/MapServer/28`
- SINIT, módulo municipal oficial 0506 Puerto Cortés: `https://sinit.hn/2024/09/27/0506-puerto-cortes/`
- SINIT, geoservicios y referencia cartográfica oficial: `https://sinit.hn/geoservicios/`
- OpenStreetMap/Nominatim: referencia pública de El Copen.

## Pendiente institucional

El límite municipal ya está validado con las fuentes oficiales anteriores. Sigue pendiente levantar
o confirmar el punto GPS de los diez establecimientos marcados como referencia comunitaria y
registrar fecha, responsable y fuente de validación en la bitácora territorial. Los doce registros
ya tienen latitud y longitud, por lo que esta pendiente no debe mostrarse como ausencia de
coordenadas.

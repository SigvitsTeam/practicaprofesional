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
- OpenStreetMap/Nominatim: referencia pública de El Copen.

## Pendiente institucional

Antes de declarar el mapa oficialmente validado se debe levantar o confirmar el punto GPS de los
diez establecimientos marcados como referencia comunitaria y registrar fecha, responsable y
fuente de validación en la bitácora territorial.

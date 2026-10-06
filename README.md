# Tablero de Satisfacción con los Servicios Públicos Municipales

**Gobierno de Río Cuarto**  
*Secretaría de Gestión y Participación Ciudadana — Dirección General de Estadística, Control de Calidad y Procesos*  
*En conjunto con Gabinete Social + LMetB*

---

## 📌 Descripción

Tablero interactivo para el monitoreo y visualización de la percepción ciudadana sobre los principales servicios públicos urbanos en barrios y áreas de la ciudad de Río Cuarto:

1. **Alumbrado público**
2. **Recolección de residuos**
3. **Limpieza de baldíos / desmalezado**
4. **Estado de calles / bacheo**
5. **Riego y desagües**

El monitor integra mediciones puerta a puerta a nivel de cuadra en **14 áreas relevadas** entre enero y octubre de 2026, combinando consultas vecinales sobre infraestructura (cordón cuneta y obras) y la base unificada de relevamientos sociales.

---

## 🚀 Estructura del Proyecto

```text
.
├── index.html                                    # Tablero principal de indicadores y consulta vecinal
├── mapa.html                                     # Mapa geográfico interactivo de sectores (Leaflet)
├── assets/                                       # Recursos gráficos y logos institucionales
├── bbdd_satisfaccion_completa.csv                # Base de datos detallada de las 14 áreas e indicadores
├── bbdd_satisfaccion_14_areas.csv                # Copia de la base detallada de 14 áreas
├── resumen_satisfaccion_14_areas.csv             # Matriz resumen por área y servicio público
├── bbdd_unificada_google_sheet.csv               # Respaldo de microdatos de relevamiento social
├── nuevas_filas_areas_12_13_14.csv               # Segmento de actualización (Áreas 12, 13 y 14)
└── README.md
```

---

## 📊 Áreas Relevadas

- **Área 1:** Bo. San Martín — Sector 1 *(Enero 2026)*
- **Área 2:** Bo. San Martín — Sector 2 *(Enero 2026)*
- **Área 3:** Fray Quirico Porreca (Banda Norte / La Agustina) *(Enero 2026)*
- **Área 4:** Bo. Castelli 1 *(Febrero 2026)*
- **Área 5:** Bo. San Martín — Sector 3 *(Febrero 2026)*
- **Área 6:** Nueva Argentina *(Abril 2026)*
- **Área 7:** Jardín (Oeste) *(Mayo 2026)*
- **Área 8:** Pueblo Alberdi (Mi Lugar, Mi Sueño 2 y 3) *(Junio 2026)*
- **Área 9:** Goretti *(Junio 2026)*
- **Área 10:** San Pantaleón *(Julio 2026)*
- **Área 11:** Quintitas Golf *(Julio 2026)*
- **Área 12:** Bo. Alem *(Agosto 2026)*
- **Área 13:** Bo. Jardín Norte *(Septiembre 2026)*
- **Área 14:** Bo. Industrial *(Octubre 2026)*

---

## 💻 Visualización Local

Para ejecutar el tablero localmente:
```bash
# Con Node.js y live-server
npx live-server --port=5500
```
O simplemente abrir `index.html` en cualquier navegador web moderno.

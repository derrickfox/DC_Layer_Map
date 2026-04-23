const url = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Elevation_WebMercator/MapServer/export?bbox=-8578986,4708721,-8571342,4702988&size=800,600&format=png32&transparent=true&bboxSR=3857&imageSR=3857&f=json";
fetch(url).then(r=>r.json()).then(console.log).catch(console.error);

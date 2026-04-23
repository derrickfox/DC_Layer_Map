const fs = require('fs');
const https = require('https');
const url = "https://elevation.nationalmap.gov/arcgis/rest/directories/elevation_output/3DEPElevation_ImageServer/_ags_0746e8ef_37d6_4467_9327_33f65a4fbfc9.jpg";

https.get(url, (res) => {
  const chunks = [];
  res.on('data', d => chunks.push(d));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    console.log("File downloaded, size:", buffer.length);
  });
});

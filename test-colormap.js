const colorMapArray = [];
for (let i = 0; i <= 255; i++) {
  let r, g, b;
  if (i < 128) {
    r = 0; g = i * 2; b = 255 - (i * 2);
  } else {
    r = (i - 128) * 2; g = 255 - ((i - 128) * 2); b = 0;
  }
  colorMapArray.push([i, r, g, b]);
}

const rule = {
  "rasterFunction": "Colormap",
  "rasterFunctionArguments": {
    "Colormap": colorMapArray,
    "Raster": {
      "rasterFunction": "Stretch",
      "rasterFunctionArguments": {
        "StretchType": 5,
        "MinValues": [0],
        "MaxValues": [130],
        "Raster": "$$"
      }
    }
  }
};

const url = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox=-8578986,4708721,-8571342,4702988&size=800,600&format=jpgpng&transparent=true&bboxSR=3857&imageSR=3857&f=json&renderingRule=" + encodeURIComponent(JSON.stringify(rule));

fetch(url).then(res => res.json()).then(console.log).catch(console.error);

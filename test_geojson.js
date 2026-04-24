fetch('https://raw.githubusercontent.com/alulsh/dc-micromobility-by-neighborhood/main/dc-neighborhoods.geojson')
  .then(res => res.json())
  .then(data => {
    let springValleyFound = false;
    let allNames = new Set();
    data.features.forEach(feature => {
      let rawNames = feature.properties?.NBH_NAMES || '';
      if (rawNames.includes('Spring Valley, Palisades')) {
        rawNames += ', Kent, Berkley, Dalecarlia';
        feature.properties.NBH_NAMES = rawNames;
        springValleyFound = true;
      }
      const names = rawNames.split(',').map(n => n.trim()).filter(n => n);
      names.forEach(n => allNames.add(n));
    });
    console.log("Spring Valley modified?", springValleyFound);
    console.log("Kent in names?", allNames.has('Kent'));
    console.log("Berkley in names?", allNames.has('Berkley'));
    console.log("Dalecarlia in names?", allNames.has('Dalecarlia'));
    console.log("American University Park in names?", allNames.has('American University Park'));
  });

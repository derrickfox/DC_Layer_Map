import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, GeoJSON, Circle, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import ZoomWidget from './ZoomWidget';
import L from 'leaflet';
import 'esri-leaflet';
import { imageMapLayer } from 'esri-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Vite + Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Canvas Layer to decode Mapzen Terrain-RGB and apply a Red-to-Blue heatmap
const TerrainHeatmapLayer = L.GridLayer.extend({
  createTile: function (coords, done) {
    const tile = L.DomUtil.create('canvas', 'leaflet-tile');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;

    const ctx = tile.getContext('2d', { willReadFrequently: true });
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size.x, size.y);
      const imageData = ctx.getImageData(0, 0, size.x, size.y);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (a === 0) continue;

        // Mapzen Terrarium formula
        const elevation = (r * 256 + g + b / 256) - 32768;
        
        let outR = 0, outG = 0, outB = 255, outA = 160;
        
        if (elevation <= 1) {
          outA = 0; // Hide water completely
        } else {
          // Normalize 0 to 130m
          const ratio = Math.max(0, Math.min(1, elevation / 130));
          
          if (ratio < 0.25) {
            outR = 0; outG = Math.round((ratio / 0.25) * 255); outB = 255;
          } else if (ratio < 0.5) {
            outR = 0; outG = 255; outB = Math.round(255 - ((ratio - 0.25) / 0.25) * 255);
          } else if (ratio < 0.75) {
            outR = Math.round(((ratio - 0.5) / 0.25) * 255); outG = 255; outB = 0;
          } else {
            outR = 255; outG = Math.round(255 - ((ratio - 0.75) / 0.25) * 255); outB = 0;
          }
        }

        data[i] = outR;
        data[i + 1] = outG;
        data[i + 2] = outB;
        data[i + 3] = outA;
      }
      
      ctx.putImageData(imageData, 0, 0);
      done(null, tile);
    };
    img.onerror = (err) => {
      done(err, tile);
    };
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${coords.z}/${coords.x}/${coords.y}.png`;

    return tile;
  }
});

const CustomTopographyLayer = () => {
  const map = useMap();

  React.useEffect(() => {
    const layer = new TerrainHeatmapLayer({
      opacity: 0.65,
      attribution: 'Mapzen Terrain-RGB'
    });
    
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);

  return null;
};


import metroLinesData from '../data/metro-lines.json';
import metroStationsData from '../data/metro-stations.json';
import zoningData from '../data/dc-zoning.json';
import exportData from '../../dc_layer_lab_export.json';

const historicalEventsData = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        NAME: "Assassination of Abraham Lincoln",
        YEAR: "1865",
        SUMMARY: "President Abraham Lincoln was assassinated by John Wilkes Booth while attending a play at Ford's Theatre."
      },
      geometry: { type: "Point", coordinates: [-77.0258, 38.8967] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "\"I Have a Dream\" Speech",
        YEAR: "1963",
        SUMMARY: "Dr. Martin Luther King Jr. delivered his historic speech during the March on Washington for Jobs and Freedom at the Lincoln Memorial."
      },
      geometry: { type: "Point", coordinates: [-77.0502, 38.8893] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Burning of Washington",
        YEAR: "1814",
        SUMMARY: "British forces set fire to many public buildings, including the White House and the Capitol, during the War of 1812."
      },
      geometry: { type: "Point", coordinates: [-77.0365, 38.8977] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Watergate Break-in",
        YEAR: "1972",
        SUMMARY: "Five men were arrested for breaking into the DNC headquarters at the Watergate complex, sparking a major political scandal."
      },
      geometry: { type: "Point", coordinates: [-77.0544, 38.8995] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Bonus Army Encampment",
        YEAR: "1932",
        SUMMARY: "Thousands of WWI veterans gathered at Anacostia Flats to demand cash-payment redemption of their service certificates."
      },
      geometry: { type: "Point", coordinates: [-76.9858, 38.8733] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Woman Suffrage Procession",
        YEAR: "1913",
        SUMMARY: "The first suffragist parade in Washington, D.C. marched down Pennsylvania Avenue from the Capitol."
      },
      geometry: { type: "Point", coordinates: [-77.0091, 38.8899] }
    }
  ]
};

const ticketedEventsData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "Capital One Arena", TYPE: "Arena", SUMMARY: "Major indoor arena for sports and large concerts." }, geometry: { type: "Point", coordinates: [-77.0209, 38.8981] } },
    { type: "Feature", properties: { NAME: "Nationals Park", TYPE: "Stadium", SUMMARY: "Baseball park and venue for major outdoor events." }, geometry: { type: "Point", coordinates: [-77.0074, 38.8730] } },
    { type: "Feature", properties: { NAME: "9:30 Club", TYPE: "Music Venue", SUMMARY: "Iconic nightclub and concert venue for live music." }, geometry: { type: "Point", coordinates: [-77.0235, 38.9180] } },
    { type: "Feature", properties: { NAME: "The Anthem", TYPE: "Music Venue", SUMMARY: "Large concert hall and events venue at the District Wharf." }, geometry: { type: "Point", coordinates: [-77.0264, 38.8797] } },
    { type: "Feature", properties: { NAME: "Kennedy Center", TYPE: "Performing Arts", SUMMARY: "Premier performing arts center on the Potomac River." }, geometry: { type: "Point", coordinates: [-77.0560, 38.8954] } },
    { type: "Feature", properties: { NAME: "Warner Theatre", TYPE: "Theater", SUMMARY: "Historic venue hosting concerts, comedy, and theater." }, geometry: { type: "Point", coordinates: [-77.0305, 38.8961] } },
    { type: "Feature", properties: { NAME: "DAR Constitution Hall", TYPE: "Concert Hall", SUMMARY: "Historic concert hall and event venue near the White House." }, geometry: { type: "Point", coordinates: [-77.0416, 38.8936] } },
    { type: "Feature", properties: { NAME: "Folger Theatre", TYPE: "Theater", SUMMARY: "Acclaimed intimate venue for classical theater, specifically Shakespeare." }, geometry: { type: "Point", coordinates: [-77.0035, 38.8884] } },
    { type: "Feature", properties: { NAME: "Ford's Theatre", TYPE: "Theater", SUMMARY: "Historic working theater producing plays year-round, alongside its museum." }, geometry: { type: "Point", coordinates: [-77.0258, 38.8966] } },
    { type: "Feature", properties: { NAME: "Black Cat", TYPE: "Music Venue", SUMMARY: "Legendary independent music venue on 14th Street hosting indie and alternative bands." }, geometry: { type: "Point", coordinates: [-77.0316, 38.9150] } }
  ]
};

const monumentsData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "Washington Monument", TYPE: "Monument", SUMMARY: "Iconic obelisk honoring the first U.S. president." }, geometry: { type: "Point", coordinates: [-77.0353, 38.8895] } },
    { type: "Feature", properties: { NAME: "Lincoln Memorial", TYPE: "Memorial", SUMMARY: "Monument honoring Abraham Lincoln, located at the western end of the National Mall." }, geometry: { type: "Point", coordinates: [-77.0502, 38.8893] } },
    { type: "Feature", properties: { NAME: "Thomas Jefferson Memorial", TYPE: "Memorial", SUMMARY: "Neoclassical memorial building honoring the third U.S. president." }, geometry: { type: "Point", coordinates: [-77.0365, 38.8814] } },
    { type: "Feature", properties: { NAME: "Martin Luther King Jr. Memorial", TYPE: "Memorial", SUMMARY: "Stone of Hope memorial honoring the civil rights leader." }, geometry: { type: "Point", coordinates: [-77.0443, 38.8861] } },
    { type: "Feature", properties: { NAME: "Franklin Delano Roosevelt Memorial", TYPE: "Memorial", SUMMARY: "Sprawling memorial spanning four outdoor rooms representing his four terms." }, geometry: { type: "Point", coordinates: [-77.0433, 38.8827] } },
    { type: "Feature", properties: { NAME: "World War II Memorial", TYPE: "Memorial", SUMMARY: "Honors the 16 million people who served in the U.S. armed forces during WWII." }, geometry: { type: "Point", coordinates: [-77.0405, 38.8894] } },
    { type: "Feature", properties: { NAME: "Vietnam Veterans Memorial", TYPE: "Memorial", SUMMARY: "A black granite wall inscribed with the names of over 58,000 servicemembers." }, geometry: { type: "Point", coordinates: [-77.0477, 38.8913] } },
    { type: "Feature", properties: { NAME: "Korean War Veterans Memorial", TYPE: "Memorial", SUMMARY: "Features 19 stainless steel statues of soldiers on patrol." }, geometry: { type: "Point", coordinates: [-77.0475, 38.8878] } },
    { type: "Feature", properties: { NAME: "Albert Einstein Memorial", TYPE: "Statue", SUMMARY: "A monumental bronze statue of Albert Einstein seated." }, geometry: { type: "Point", coordinates: [-77.0484, 38.8923] } },
    { type: "Feature", properties: { NAME: "African American Civil War Memorial", TYPE: "Memorial", SUMMARY: "Honors the service of the United States Colored Troops during the Civil War." }, geometry: { type: "Point", coordinates: [-77.0256, 38.9166] } },
    { type: "Feature", properties: { NAME: "Ulysses S. Grant Memorial", TYPE: "Memorial", SUMMARY: "One of the largest equestrian statues in the U.S., honoring the 18th President." }, geometry: { type: "Point", coordinates: [-77.0136, 38.8899] } },
    { type: "Feature", properties: { NAME: "James A. Garfield Monument", TYPE: "Monument", SUMMARY: "Monument honoring the 20th President of the United States." }, geometry: { type: "Point", coordinates: [-77.0142, 38.8883] } },
    { type: "Feature", properties: { NAME: "Peace Monument", TYPE: "Monument", SUMMARY: "Also known as the Naval Monument, dedicated to naval personnel who died at sea during the Civil War." }, geometry: { type: "Point", coordinates: [-77.0135, 38.8906] } },
    { type: "Feature", properties: { NAME: "Robert A. Taft Memorial", TYPE: "Memorial", SUMMARY: "Features a bell tower honoring the U.S. Senator." }, geometry: { type: "Point", coordinates: [-77.0116, 38.8920] } },
    { type: "Feature", properties: { NAME: "George Mason Memorial", TYPE: "Memorial", SUMMARY: "Honors the author of the Virginia Declaration of Rights." }, geometry: { type: "Point", coordinates: [-77.0396, 38.8804] } },
    { type: "Feature", properties: { NAME: "Signers of the Declaration of Independence Memorial", TYPE: "Memorial", SUMMARY: "Granite stones honoring the 56 signers of the Declaration of Independence." }, geometry: { type: "Point", coordinates: [-77.0435, 38.8906] } },
    { type: "Feature", properties: { NAME: "John Paul Jones Memorial", TYPE: "Memorial", SUMMARY: "Statue of the American Revolution naval hero." }, geometry: { type: "Point", coordinates: [-77.0402, 38.8885] } },
    { type: "Feature", properties: { NAME: "First Division Monument", TYPE: "Monument", SUMMARY: "Honors soldiers of the U.S. Army's First Infantry Division." }, geometry: { type: "Point", coordinates: [-77.0387, 38.8962] } },
    { type: "Feature", properties: { NAME: "Second Division Memorial", TYPE: "Memorial", SUMMARY: "Commemorates the 2nd Infantry Division." }, geometry: { type: "Point", coordinates: [-77.0382, 38.8953] } },
    { type: "Feature", properties: { NAME: "Boy Scout Memorial", TYPE: "Memorial", SUMMARY: "Features a male scout, female scout, and an adult scouter." }, geometry: { type: "Point", coordinates: [-77.0374, 38.8942] } },
    { type: "Feature", properties: { NAME: "General William Tecumseh Sherman Monument", TYPE: "Monument", SUMMARY: "Equestrian statue of the Civil War general." }, geometry: { type: "Point", coordinates: [-77.0336, 38.8966] } },
    { type: "Feature", properties: { NAME: "Andrew Jackson Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the 7th President in Lafayette Square." }, geometry: { type: "Point", coordinates: [-77.0365, 38.8996] } },
    { type: "Feature", properties: { NAME: "Marquis de Lafayette Statue", TYPE: "Statue", SUMMARY: "Honors the French hero of the American Revolution." }, geometry: { type: "Point", coordinates: [-77.0357, 38.8990] } },
    { type: "Feature", properties: { NAME: "Comte de Rochambeau Statue", TYPE: "Statue", SUMMARY: "Honors the French commander during the Revolutionary War." }, geometry: { type: "Point", coordinates: [-77.0373, 38.8990] } },
    { type: "Feature", properties: { NAME: "Baron von Steuben Statue", TYPE: "Statue", SUMMARY: "Honors the Prussian drillmaster of the Continental Army." }, geometry: { type: "Point", coordinates: [-77.0373, 38.9002] } },
    { type: "Feature", properties: { NAME: "General Thaddeus Kosciuszko Statue", TYPE: "Statue", SUMMARY: "Honors the Polish military engineer and Revolutionary War hero." }, geometry: { type: "Point", coordinates: [-77.0357, 38.9002] } },
    { type: "Feature", properties: { NAME: "Admiral David G. Farragut Statue", TYPE: "Statue", SUMMARY: "Statue of the Civil War naval hero in Farragut Square." }, geometry: { type: "Point", coordinates: [-77.0397, 38.9020] } },
    { type: "Feature", properties: { NAME: "Major General James B. McPherson Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the Civil War general in McPherson Square." }, geometry: { type: "Point", coordinates: [-77.0334, 38.9018] } },
    { type: "Feature", properties: { NAME: "Major General George H. Thomas Statue", TYPE: "Statue", SUMMARY: "Equestrian statue located in Thomas Circle." }, geometry: { type: "Point", coordinates: [-77.0326, 38.9056] } },
    { type: "Feature", properties: { NAME: "Major General John A. Logan Statue", TYPE: "Statue", SUMMARY: "Equestrian statue located in Logan Circle." }, geometry: { type: "Point", coordinates: [-77.0298, 38.9097] } },
    { type: "Feature", properties: { NAME: "Dupont Circle Fountain", TYPE: "Monument", SUMMARY: "Fountain honoring Samuel Francis Du Pont." }, geometry: { type: "Point", coordinates: [-77.0434, 38.9096] } },
    { type: "Feature", properties: { NAME: "General Winfield Scott Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the general in Scott Circle." }, geometry: { type: "Point", coordinates: [-77.0365, 38.9075] } },
    { type: "Feature", properties: { NAME: "George Washington Equestrian Statue", TYPE: "Statue", SUMMARY: "Depicts George Washington at the Battle of Princeton, in Washington Circle." }, geometry: { type: "Point", coordinates: [-77.0502, 38.9027] } },
    { type: "Feature", properties: { NAME: "National Law Enforcement Officers Memorial", TYPE: "Memorial", SUMMARY: "Honors federal, state, and local law enforcement officers." }, geometry: { type: "Point", coordinates: [-77.0172, 38.8967] } },
    { type: "Feature", properties: { NAME: "Japanese American Memorial to Patriotism", TYPE: "Memorial", SUMMARY: "Commemorates Japanese American patriotism during World War II." }, geometry: { type: "Point", coordinates: [-77.0108, 38.8967] } },
    { type: "Feature", properties: { NAME: "Victims of Communism Memorial", TYPE: "Memorial", SUMMARY: "A bronze replica of the Goddess of Democracy." }, geometry: { type: "Point", coordinates: [-77.0122, 38.8978] } },
    { type: "Feature", properties: { NAME: "Christopher Columbus Memorial", TYPE: "Memorial", SUMMARY: "Features a statue of Columbus in front of Union Station." }, geometry: { type: "Point", coordinates: [-77.0061, 38.8966] } },
    { type: "Feature", properties: { NAME: "Mary McLeod Bethune Memorial", TYPE: "Memorial", SUMMARY: "Honors the educator and civil rights activist, located in Lincoln Park." }, geometry: { type: "Point", coordinates: [-76.9892, 38.8900] } },
    { type: "Feature", properties: { NAME: "Emancipation Memorial", TYPE: "Memorial", SUMMARY: "Also known as the Freedman's Memorial, located in Lincoln Park." }, geometry: { type: "Point", coordinates: [-76.9880, 38.8898] } },
    { type: "Feature", properties: { NAME: "Women's Titanic Memorial", TYPE: "Memorial", SUMMARY: "Honors the men who gave their lives so women and children could be saved." }, geometry: { type: "Point", coordinates: [-77.0180, 38.8718] } },
    { type: "Feature", properties: { NAME: "Mahatma Gandhi Memorial", TYPE: "Statue", SUMMARY: "Statue of the Indian independence leader near the Indian Embassy." }, geometry: { type: "Point", coordinates: [-77.0494, 38.9103] } },
    { type: "Feature", properties: { NAME: "General Philip Sheridan Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the Civil War Union general in Sheridan Circle." }, geometry: { type: "Point", coordinates: [-77.0506, 38.9114] } },
    { type: "Feature", properties: { NAME: "General George Meade Memorial", TYPE: "Memorial", SUMMARY: "Honors the victorious Union commander at the Battle of Gettysburg." }, geometry: { type: "Point", coordinates: [-77.0163, 38.8924] } },
    { type: "Feature", properties: { NAME: "Stephenson Grand Army of the Republic Memorial", TYPE: "Memorial", SUMMARY: "Honors Dr. Benjamin F. Stephenson, founder of the Grand Army of the Republic." }, geometry: { type: "Point", coordinates: [-77.0210, 38.8932] } },
    { type: "Feature", properties: { NAME: "Nuns of the Battlefield Memorial", TYPE: "Memorial", SUMMARY: "Honors the various orders of nuns who nursed soldiers during the Civil War." }, geometry: { type: "Point", coordinates: [-77.0401, 38.9054] } },
    { type: "Feature", properties: { NAME: "General Winfield Scott Hancock Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the Union general known for his leadership at Gettysburg." }, geometry: { type: "Point", coordinates: [-77.0219, 38.8936] } },
    { type: "Feature", properties: { NAME: "General John A. Rawlins Statue", TYPE: "Statue", SUMMARY: "Statue of Ulysses S. Grant's chief of staff during the Civil War." }, geometry: { type: "Point", coordinates: [-77.0416, 38.8965] } },
    { type: "Feature", properties: { NAME: "Major General George B. McClellan Statue", TYPE: "Statue", SUMMARY: "Equestrian statue honoring the commander of the Army of the Potomac." }, geometry: { type: "Point", coordinates: [-77.0460, 38.9160] } },
    { type: "Feature", properties: { NAME: "Major General Nathanael Greene Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the Continental Army major general in Stanton Park." }, geometry: { type: "Point", coordinates: [-76.9961, 38.8938] } },
    { type: "Feature", properties: { NAME: "Commodore John Barry Memorial", TYPE: "Memorial", SUMMARY: "Statue of the 'Father of the American Navy' in Franklin Square." }, geometry: { type: "Point", coordinates: [-77.0312, 38.9023] } },
    { type: "Feature", properties: { NAME: "Benjamin Franklin Statue", TYPE: "Statue", SUMMARY: "Statue honoring the Founding Father at the Old Post Office Pavilion." }, geometry: { type: "Point", coordinates: [-77.0284, 38.8944] } },
    { type: "Feature", properties: { NAME: "Major General Artemas Ward Statue", TYPE: "Statue", SUMMARY: "Statue of the first commander of the Continental Army in Ward Circle." }, geometry: { type: "Point", coordinates: [-77.0863, 38.9385] } },
    { type: "Feature", properties: { NAME: "Bernardo de Gálvez Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the Spanish military leader who aided the American colonies." }, geometry: { type: "Point", coordinates: [-77.0463, 38.8967] } },
    { type: "Feature", properties: { NAME: "John Witherspoon Statue", TYPE: "Statue", SUMMARY: "Statue of the clergyman and signer of the Declaration of Independence." }, geometry: { type: "Point", coordinates: [-77.0416, 38.9073] } },
    { type: "Feature", properties: { NAME: "General Casimir Pulaski Statue", TYPE: "Statue", SUMMARY: "Equestrian statue of the Polish nobleman who fought in the Revolutionary War." }, geometry: { type: "Point", coordinates: [-77.0305, 38.8964] } },
    { type: "Feature", properties: { NAME: "Alexander Hamilton Statue", TYPE: "Statue", SUMMARY: "Statue of the Founding Father and Revolutionary War officer at the Treasury Building." }, geometry: { type: "Point", coordinates: [-77.0337, 38.8973] } },
    { type: "Feature", properties: { NAME: "Nathan Hale Statue", TYPE: "Statue", SUMMARY: "Statue of the American Revolutionary War spy." }, geometry: { type: "Point", coordinates: [-77.0255, 38.8935] } }
  ]
};

const embassiesData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "Embassy of the United Kingdom", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the United Kingdom to the United States." }, geometry: { type: "Point", coordinates: [-77.0626, 38.9213] } },
    { type: "Feature", properties: { NAME: "Embassy of Japan", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Japan to the United States." }, geometry: { type: "Point", coordinates: [-77.0544, 38.9174] } },
    { type: "Feature", properties: { NAME: "Embassy of Canada", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Canada to the United States." }, geometry: { type: "Point", coordinates: [-77.0182, 38.8926] } },
    { type: "Feature", properties: { NAME: "Embassy of France", TYPE: "Embassy", SUMMARY: "Diplomatic mission of France to the United States." }, geometry: { type: "Point", coordinates: [-77.0865, 38.9171] } },
    { type: "Feature", properties: { NAME: "Embassy of Germany", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Germany to the United States." }, geometry: { type: "Point", coordinates: [-77.0863, 38.9133] } },
    { type: "Feature", properties: { NAME: "Embassy of Italy", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Italy to the United States." }, geometry: { type: "Point", coordinates: [-77.0605, 38.9189] } },
    { type: "Feature", properties: { NAME: "Embassy of Mexico", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Mexico to the United States." }, geometry: { type: "Point", coordinates: [-77.0427, 38.8997] } },
    { type: "Feature", properties: { NAME: "Embassy of Brazil", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Brazil to the United States." }, geometry: { type: "Point", coordinates: [-77.0560, 38.9169] } },
    { type: "Feature", properties: { NAME: "Embassy of Australia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Australia to the United States." }, geometry: { type: "Point", coordinates: [-77.0366, 38.9080] } },
    { type: "Feature", properties: { NAME: "Embassy of South Korea", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the Republic of Korea to the United States." }, geometry: { type: "Point", coordinates: [-77.0543, 38.9157] } },
    { type: "Feature", properties: { NAME: "Embassy of India", TYPE: "Embassy", SUMMARY: "Diplomatic mission of India to the United States." }, geometry: { type: "Point", coordinates: [-77.0514, 38.9126] } },
    { type: "Feature", properties: { NAME: "Embassy of Spain", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Spain to the United States." }, geometry: { type: "Point", coordinates: [-77.0487, 38.9009] } },
    { type: "Feature", properties: { NAME: "Embassy of China", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the People's Republic of China to the United States." }, geometry: { type: "Point", coordinates: [-77.0652, 38.9427] } },
    { type: "Feature", properties: { NAME: "Embassy of South Africa", TYPE: "Embassy", SUMMARY: "Diplomatic mission of South Africa to the United States." }, geometry: { type: "Point", coordinates: [-77.0561, 38.9126] } },
    { type: "Feature", properties: { NAME: "Embassy of the Netherlands", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the Netherlands to the United States." }, geometry: { type: "Point", coordinates: [-77.0664, 38.9458] } },
    { type: "Feature", properties: { NAME: "Embassy of Argentina", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Argentina to the United States." }, geometry: { type: "Point", coordinates: [-77.0450, 38.9097] } },
    { type: "Feature", properties: { NAME: "Embassy of Sweden", TYPE: "Embassy", SUMMARY: "Located at the House of Sweden." }, geometry: { type: "Point", coordinates: [-77.0583, 38.9022] } },
    { type: "Feature", properties: { NAME: "Embassy of Ireland", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Ireland to the United States." }, geometry: { type: "Point", coordinates: [-77.0520, 38.9142] } },
    { type: "Feature", properties: { NAME: "Embassy of Switzerland", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Switzerland to the United States." }, geometry: { type: "Point", coordinates: [-77.0552, 38.9272] } },
    { type: "Feature", properties: { NAME: "Embassy of Turkey", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Turkey to the United States." }, geometry: { type: "Point", coordinates: [-77.0532, 38.9148] } },
    { type: "Feature", properties: { NAME: "Embassy of Indonesia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Indonesia to the United States." }, geometry: { type: "Point", coordinates: [-77.0437, 38.9089] } },
    { type: "Feature", properties: { NAME: "Embassy of Saudi Arabia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Saudi Arabia to the United States." }, geometry: { type: "Point", coordinates: [-77.0566, 38.8996] } },
    { type: "Feature", properties: { NAME: "Embassy of Afghanistan", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Afghanistan to the United States." }, geometry: { type: "Point", coordinates: [-77.0468, 38.9185] } },
    { type: "Feature", properties: { NAME: "Embassy of Algeria", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Algeria to the United States." }, geometry: { type: "Point", coordinates: [-77.0524, 38.9152] } },
    { type: "Feature", properties: { NAME: "Embassy of Armenia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Armenia to the United States." }, geometry: { type: "Point", coordinates: [-77.0519, 38.9150] } },
    { type: "Feature", properties: { NAME: "Embassy of Austria", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Austria to the United States." }, geometry: { type: "Point", coordinates: [-77.0654, 38.9430] } },
    { type: "Feature", properties: { NAME: "Embassy of the Bahamas", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the Bahamas to the United States." }, geometry: { type: "Point", coordinates: [-77.0520, 38.9140] } },
    { type: "Feature", properties: { NAME: "Embassy of Bahrain", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Bahrain to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9441] } },
    { type: "Feature", properties: { NAME: "Embassy of Bangladesh", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Bangladesh to the United States." }, geometry: { type: "Point", coordinates: [-77.0665, 38.9461] } },
    { type: "Feature", properties: { NAME: "Embassy of Belgium", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Belgium to the United States." }, geometry: { type: "Point", coordinates: [-77.0640, 38.9150] } },
    { type: "Feature", properties: { NAME: "Embassy of Bolivia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Bolivia to the United States." }, geometry: { type: "Point", coordinates: [-77.0522, 38.9135] } },
    { type: "Feature", properties: { NAME: "Embassy of Bulgaria", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Bulgaria to the United States." }, geometry: { type: "Point", coordinates: [-77.0465, 38.9145] } },
    { type: "Feature", properties: { NAME: "Embassy of Chile", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Chile to the United States." }, geometry: { type: "Point", coordinates: [-77.0425, 38.9090] } },
    { type: "Feature", properties: { NAME: "Embassy of Colombia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Colombia to the United States." }, geometry: { type: "Point", coordinates: [-77.0460, 38.9110] } },
    { type: "Feature", properties: { NAME: "Embassy of Costa Rica", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Costa Rica to the United States." }, geometry: { type: "Point", coordinates: [-77.0525, 38.9160] } },
    { type: "Feature", properties: { NAME: "Embassy of Croatia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Croatia to the United States." }, geometry: { type: "Point", coordinates: [-77.0530, 38.9130] } },
    { type: "Feature", properties: { NAME: "Embassy of Cuba", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Cuba to the United States." }, geometry: { type: "Point", coordinates: [-77.0370, 38.9260] } },
    { type: "Feature", properties: { NAME: "Embassy of the Czech Republic", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the Czech Republic to the United States." }, geometry: { type: "Point", coordinates: [-77.0668, 38.9465] } },
    { type: "Feature", properties: { NAME: "Embassy of Denmark", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Denmark to the United States." }, geometry: { type: "Point", coordinates: [-77.0600, 38.9220] } },
    { type: "Feature", properties: { NAME: "Embassy of Ecuador", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Ecuador to the United States." }, geometry: { type: "Point", coordinates: [-77.0390, 38.9280] } },
    { type: "Feature", properties: { NAME: "Embassy of Egypt", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Egypt to the United States." }, geometry: { type: "Point", coordinates: [-77.0670, 38.9460] } },
    { type: "Feature", properties: { NAME: "Embassy of El Salvador", TYPE: "Embassy", SUMMARY: "Diplomatic mission of El Salvador to the United States." }, geometry: { type: "Point", coordinates: [-77.0420, 38.9150] } },
    { type: "Feature", properties: { NAME: "Embassy of Ethiopia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Ethiopia to the United States." }, geometry: { type: "Point", coordinates: [-77.0580, 38.9450] } },
    { type: "Feature", properties: { NAME: "Embassy of Finland", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Finland to the United States." }, geometry: { type: "Point", coordinates: [-77.0630, 38.9240] } },
    { type: "Feature", properties: { NAME: "Embassy of Greece", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Greece to the United States." }, geometry: { type: "Point", coordinates: [-77.0510, 38.9155] } },
    { type: "Feature", properties: { NAME: "Embassy of Haiti", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Haiti to the United States." }, geometry: { type: "Point", coordinates: [-77.0520, 38.9110] } },
    { type: "Feature", properties: { NAME: "Embassy of Honduras", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Honduras to the United States." }, geometry: { type: "Point", coordinates: [-77.0520, 38.9410] } },
    { type: "Feature", properties: { NAME: "Embassy of Hungary", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Hungary to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9460] } },
    { type: "Feature", properties: { NAME: "Embassy of Iceland", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Iceland to the United States." }, geometry: { type: "Point", coordinates: [-77.0583, 38.9022] } },
    { type: "Feature", properties: { NAME: "Embassy of Iraq", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Iraq to the United States." }, geometry: { type: "Point", coordinates: [-77.0530, 38.9120] } },
    { type: "Feature", properties: { NAME: "Embassy of Israel", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Israel to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9430] } },
    { type: "Feature", properties: { NAME: "Embassy of Jamaica", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Jamaica to the United States." }, geometry: { type: "Point", coordinates: [-77.0420, 38.9080] } },
    { type: "Feature", properties: { NAME: "Embassy of Jordan", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Jordan to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9450] } },
    { type: "Feature", properties: { NAME: "Embassy of Kenya", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Kenya to the United States." }, geometry: { type: "Point", coordinates: [-77.0510, 38.9140] } },
    { type: "Feature", properties: { NAME: "Embassy of Kuwait", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Kuwait to the United States." }, geometry: { type: "Point", coordinates: [-77.0665, 38.9440] } },
    { type: "Feature", properties: { NAME: "Embassy of Lebanon", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Lebanon to the United States." }, geometry: { type: "Point", coordinates: [-77.0550, 38.9220] } },
    { type: "Feature", properties: { NAME: "Embassy of Malaysia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Malaysia to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9455] } },
    { type: "Feature", properties: { NAME: "Embassy of Morocco", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Morocco to the United States." }, geometry: { type: "Point", coordinates: [-77.0425, 38.9150] } },
    { type: "Feature", properties: { NAME: "Embassy of New Zealand", TYPE: "Embassy", SUMMARY: "Diplomatic mission of New Zealand to the United States." }, geometry: { type: "Point", coordinates: [-77.0620, 38.9180] } },
    { type: "Feature", properties: { NAME: "Embassy of Nigeria", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Nigeria to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9460] } },
    { type: "Feature", properties: { NAME: "Embassy of Norway", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Norway to the United States." }, geometry: { type: "Point", coordinates: [-77.0625, 38.9220] } },
    { type: "Feature", properties: { NAME: "Embassy of Pakistan", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Pakistan to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9445] } },
    { type: "Feature", properties: { NAME: "Embassy of Peru", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Peru to the United States." }, geometry: { type: "Point", coordinates: [-77.0420, 38.9080] } },
    { type: "Feature", properties: { NAME: "Embassy of the Philippines", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the Philippines to the United States." }, geometry: { type: "Point", coordinates: [-77.0410, 38.9080] } },
    { type: "Feature", properties: { NAME: "Embassy of Poland", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Poland to the United States." }, geometry: { type: "Point", coordinates: [-77.0350, 38.9240] } },
    { type: "Feature", properties: { NAME: "Embassy of Portugal", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Portugal to the United States." }, geometry: { type: "Point", coordinates: [-77.0520, 38.9150] } },
    { type: "Feature", properties: { NAME: "Embassy of Romania", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Romania to the United States." }, geometry: { type: "Point", coordinates: [-77.0530, 38.9150] } },
    { type: "Feature", properties: { NAME: "Embassy of Russia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Russia to the United States." }, geometry: { type: "Point", coordinates: [-77.0720, 38.9240] } },
    { type: "Feature", properties: { NAME: "Embassy of Senegal", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Senegal to the United States." }, geometry: { type: "Point", coordinates: [-77.0510, 38.9170] } },
    { type: "Feature", properties: { NAME: "Embassy of Serbia", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Serbia to the United States." }, geometry: { type: "Point", coordinates: [-77.0515, 38.9150] } },
    { type: "Feature", properties: { NAME: "Embassy of Singapore", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Singapore to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9450] } },
    { type: "Feature", properties: { NAME: "Embassy of Sri Lanka", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Sri Lanka to the United States." }, geometry: { type: "Point", coordinates: [-77.0520, 38.9160] } },
    { type: "Feature", properties: { NAME: "Embassy of Thailand", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Thailand to the United States." }, geometry: { type: "Point", coordinates: [-77.0610, 38.9210] } },
    { type: "Feature", properties: { NAME: "Embassy of the United Arab Emirates", TYPE: "Embassy", SUMMARY: "Diplomatic mission of the UAE to the United States." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9465] } },
    { type: "Feature", properties: { NAME: "Embassy of Uruguay", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Uruguay to the United States." }, geometry: { type: "Point", coordinates: [-77.0440, 38.9050] } },
    { type: "Feature", properties: { NAME: "Embassy of Venezuela", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Venezuela to the United States." }, geometry: { type: "Point", coordinates: [-77.0600, 38.9030] } },
    { type: "Feature", properties: { NAME: "Embassy of Vietnam", TYPE: "Embassy", SUMMARY: "Diplomatic mission of Vietnam to the United States." }, geometry: { type: "Point", coordinates: [-77.0470, 38.9140] } }
  ]
};

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click: () => {
      if (onMapClick) onMapClick();
    },
  });
  return null;
};

const NEIGHBORHOOD_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];

const customOverrides = {
  "Arboretum": { center: [38.9125, -76.9670], radius: 600 },
  "Adams Morgan": { center: [38.9220, -77.0420], radius: 500 },
  "Woodley Park": { center: [38.9250, -77.0530], radius: 550 },
  "Cleveland Park": { center: [38.9350, -77.0580], radius: 600 },
  "Palisades": { center: [38.9280, -77.1080], radius: 500 },
  "Dalecarlia": { center: [38.9380, -77.1080], radius: 450 },
  "Kent": { center: [38.9320, -77.1060], radius: 450 },
  "American University Park": { center: [38.9480, -77.0930], radius: 500 },
  "Berkley": { center: [38.9170, -77.0940], radius: 450 },
  "Wesley Heights": { center: [38.9370, -77.0860], radius: 450 },
  "Columbia Heights": { center: [38.9283, -77.0327], radius: 500 },
  "Mt. Pleasant": { center: [38.9317, -77.0383], radius: 450 },
  "Dupont Circle": { center: [38.9096, -77.0434], radius: 500 },
  "Kalorama Heights": { center: [38.9174, -77.0505], radius: 450 },
  "Southwest / Waterfront": { center: [38.8770, -77.0180], radius: 600 },
  "Southwest Employment Area": { center: [38.8820, -77.0200], radius: 500 },
  "Georgetown": { center: [38.9048, -77.0628], radius: 550 },
  "Burleith / Hillandale": { center: [38.9145, -77.0700], radius: 450 },
  "National Mall": { center: [38.8895, -77.0230], radius: 600 },
  "Potomac River": { center: [38.8680, -77.0270], radius: 800 },
  "Connecticut Avenue/K Street": { center: [38.9020, -77.0396], radius: 500 },
  "Union Station": { center: [38.8977, -77.0068], radius: 450 },
  "Truxton Circle": { center: [38.9100, -77.0100], radius: 450 },
  "North Capitol Street": { center: [38.9050, -77.0090], radius: 400 },
  "Foxhall Crescent": { center: [38.9230, -77.0890], radius: 450 },
  "Spring Valley": { center: [38.9380, -77.0950], radius: 500 },
  "Foxhall Village": { center: [38.9110, -77.0810], radius: 400 },
  "Georgetown Reservoir": { center: [38.9123, -77.0928], radius: 450 },
  "Trinidad": { center: [38.9050, -76.9880], radius: 450 },
  "Ivy City": { center: [38.9130, -76.9850], radius: 450 },
  "Carver Langston": { center: [38.8990, -76.9780], radius: 400 },
  "Stanton Park": { center: [38.8930, -76.9930], radius: 400 },
  "Kingman Park": { center: [38.8960, -76.9700], radius: 450 },
  "Capitol Hill": { center: [38.8880, -76.9980], radius: 500 }
};

const MapArea = ({ activeLayers, geoJsonData, hiddenNeighborhoods, dcBoundary, floodZonesData, searchQuery, selectedNeighborhoods, setSelectedNeighborhoods, isLeftAligned }) => {
  const dcCenter = [38.8895, -77.0320]; // Centered near the National Mall
  const [parksData, setParksData] = useState(null);
  const [squaresData, setSquaresData] = useState(null);
  const [museumsData, setMuseumsData] = useState(null);
  const [propertyValuesData, setPropertyValuesData] = useState(null);
  const [crimeData, setCrimeData] = useState(null);
  const [bikeLanesData, setBikeLanesData] = useState(null);

  useEffect(() => {
    if ((activeLayers.parks || activeLayers.squares) && !parksData && !squaresData) {
      const p1 = fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Recreation_WebMercator/MapServer/9/query?where=1%3D1&outFields=*&outSR=4326&f=geojson').then(res => res.json());
      const p2 = fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Recreation_WebMercator/MapServer/10/query?where=1%3D1&outFields=*&outSR=4326&f=geojson').then(res => res.json());
      
      Promise.all([p1, p2])
        .then(([localParks, nationalParks]) => {
          const allFeatures = [
            ...(localParks.features || []),
            ...(nationalParks.features || [])
          ];

          const isSquareOrCircle = (name) => {
            if (!name) return false;
            const n = name.toLowerCase();
            return n.includes('square') || n.includes('circle') || n.includes('triangle');
          };

          const pFeatures = [];
          const sFeatures = [];

          allFeatures.forEach(f => {
            const name = f.properties?.NAME || "";
            if (isSquareOrCircle(name)) {
              sFeatures.push(f);
            } else {
              pFeatures.push(f);
            }
          });

          setParksData({ type: "FeatureCollection", features: pFeatures });
          setSquaresData({ type: "FeatureCollection", features: sFeatures });
        })
        .catch(err => console.error("Error fetching parks/squares data:", err));
    }
  }, [activeLayers.parks, activeLayers.squares, parksData, squaresData]);

  useEffect(() => {
    if (activeLayers.museums && !museumsData) {
      fetch('https://opendata.dc.gov/api/download/v1/items/2e65fc16edc3481989d2cc17e6f8c533/geojson?layers=54')
        .then(res => res.json())
        .then(data => {
          data.features.push({
            type: "Feature",
            properties: {
              DCGISPLACE_NAMES_PTNAME: "Daughters of the American Revolution Museum"
            },
            geometry: {
              type: "Point",
              coordinates: [-77.0395, 38.8923]
            }
          });
          setMuseumsData(data);
        })
        .catch(err => console.error("Error fetching museums data:", err));
    }
  }, [activeLayers.museums, museumsData]);

  useEffect(() => {
    if (activeLayers.propertyValues && !propertyValuesData) {
      fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/6/query?where=1%3D1&outFields=*&outSR=4326&f=geojson')
        .then(res => res.json())
        .then(data => {
          // Add simulated property values to each feature
          const features = data.features.map(f => {
            // Calculate a simulated value based on centroid
            const bounds = L.geoJSON(f).getBounds();
            const center = bounds.getCenter();
            
            // Northwest is higher value, Southeast is lower
            // Center is roughly [38.8895, -77.0320]
            // Let's use a base of $600,000
            let baseValue = 600000;
            
            // Increase for higher latitude (North), decrease for lower latitude (South)
            baseValue += (center.lat - 38.88) * 15000000; 
            
            // Increase for lower longitude (West), decrease for higher longitude (East)
            baseValue += (-77.00 - center.lng) * 10000000;
            
            // Add some randomization for realism
            const randomVariance = (Math.random() - 0.5) * 300000;
            
            let simulatedValue = Math.max(250000, baseValue + randomVariance);
            // Cap at 2.5m for realistic average
            simulatedValue = Math.min(2500000, simulatedValue);
            
            f.properties.SIMULATED_AVERAGE_VALUE = Math.round(simulatedValue);
            return f;
          });
          setPropertyValuesData({ type: "FeatureCollection", features });
        })
        .catch(err => console.error("Error fetching Assessment Neighborhoods data:", err));
    }
  }, [activeLayers.propertyValues, propertyValuesData]);

  useEffect(() => {
    if (activeLayers.crime && !crimeData) {
      fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/6/query?where=1%3D1&outFields=*&outSR=4326&f=geojson')
        .then(res => res.json())
        .then(data => {
          // Add simulated crime index to each feature
          const features = data.features.map(f => {
            const bounds = L.geoJSON(f).getBounds();
            const center = bounds.getCenter();
            
            // Crime index (incidents per year) base 500
            let baseCrime = 500;
            
            // Increase towards Center/East, decrease towards far NW
            // Center is roughly [38.8895, -77.0320]
            baseCrime += (38.9 - center.lat) * 8000; 
            baseCrime += (center.lng - -77.05) * 6000;
            
            const randomVariance = (Math.random() - 0.5) * 400;
            
            let simulatedCrime = Math.max(50, baseCrime + randomVariance);
            simulatedCrime = Math.min(2500, simulatedCrime);
            
            f.properties.SIMULATED_CRIME_INDEX = Math.round(simulatedCrime);
            return f;
          });
          setCrimeData({ type: "FeatureCollection", features });
        })
        .catch(err => console.error("Error fetching crime data:", err));
    }
  }, [activeLayers.crime, crimeData]);

  useEffect(() => {
    if (activeLayers.bikeLanes && !bikeLanesData) {
      fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Bikes_Trails_WebMercator/MapServer/2/query?where=1%3D1&outFields=*&outSR=4326&f=geojson')
        .then(res => res.json())
        .then(data => setBikeLanesData(data))
        .catch(err => console.error("Error fetching bike lanes data:", err));
    }
  }, [activeLayers.bikeLanes, bikeLanesData]);

  const neighborhoodColorMap = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return {};
    
    try {
      // 1. Extract nodes
      const nodes = [];
    geoJsonData.features.forEach((feature) => {
      const rawNames = feature.properties?.NBH_NAMES || 'Unknown Neighborhood';
      const neighborhoods = rawNames.split(',').map(n => n.trim()).filter(n => n !== 'Anacostia River');
      const N = neighborhoods.length;
      
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      const center = bounds.getCenter();
      
      const latDiff = bounds.getNorth() - bounds.getSouth();
      const lngDiff = bounds.getEast() - bounds.getWest();
      const radiusY = latDiff * 0.2;
      const radiusX = lngDiff * 0.2;

      neighborhoods.forEach((name, i) => {
        let pos = [center.lat, center.lng];
        if (customOverrides[name]) {
          pos = customOverrides[name].center;
        } else if (N > 1) {
          const angle = (i / N) * Math.PI * 2;
          pos = [
            center.lat + Math.sin(angle) * radiusY,
            center.lng + Math.cos(angle) * radiusX
          ];
        }
        nodes.push({ name, pos });
      });
    });

    // 2. Greedy Graph Coloring
    const colorMap = {};
    const thresholdSq = 0.02 * 0.02; // Roughly 2km distance threshold
    
    nodes.forEach((node) => {
      // Find colors of neighbors
      const neighborColors = new Set();
      nodes.forEach((other) => {
        if (other.name === node.name || !colorMap[other.name]) return;
        const dLat = node.pos[0] - other.pos[0];
        const dLng = node.pos[1] - other.pos[1];
        if (dLat * dLat + dLng * dLng < thresholdSq) {
          neighborColors.add(colorMap[other.name]);
        }
      });
      
      // Pick preferred color index based on string hash
      let hash = 0;
      for (let j = 0; j < node.name.length; j++) {
        hash = node.name.charCodeAt(j) + ((hash << 5) - hash);
      }
      const preferredIdx = Math.abs(hash) % NEIGHBORHOOD_COLORS.length;

      // Find an available color, starting from the preferred index
      let bestColor = null;
      for (let offset = 0; offset < NEIGHBORHOOD_COLORS.length; offset++) {
        const idx = (preferredIdx + offset) % NEIGHBORHOOD_COLORS.length;
        const color = NEIGHBORHOOD_COLORS[idx];
        if (!neighborColors.has(color)) {
          bestColor = color;
          break;
        }
      }
      
      // If all colors used by neighbors, fallback to preferred color
      if (!bestColor) {
         bestColor = NEIGHBORHOOD_COLORS[preferredIdx];
      }
      
      colorMap[node.name] = bestColor;
    });

    return colorMap;
    } catch (e) {
      console.error("COLOR MAP ERROR:", e);
      return {};
    }
  }, [geoJsonData]);

  const parksStyle = {
    fillColor: '#22c55e',
    fillOpacity: 0.4,
    color: '#4ade80',
    weight: 2,
  };

  const squaresStyle = {
    fillColor: '#0ea5e9',
    fillOpacity: 0.4,
    color: '#38bdf8',
    weight: 2,
  };

  return (
    <MapContainer 
      center={dcCenter} 
      zoom={14} 
      minZoom={11}
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <MapEvents onMapClick={() => setSelectedNeighborhoods(new Set())} />
      
      {/* DC Boundary Layer */}
      {dcBoundary && (
        <GeoJSON 
          data={dcBoundary}
          interactive={false}
          style={{
            color: 'var(--accent-primary)',
            weight: 3,
            opacity: 0.8,
            fillColor: 'transparent',
            dashArray: '8, 8'
          }}
        />
      )}
      


      {/* Neighborhoods Layer */}
      {activeLayers.neighborhoods && geoJsonData && (
        <>
          {geoJsonData.features
            .flatMap((feature, featureIndex) => {
            const rawNames = feature.properties?.NBH_NAMES || 'Unknown Neighborhood';
            const clusterName = feature.properties?.NAME || 'Neighborhood Cluster';
            const neighborhoods = rawNames.split(',')
              .map(n => n.trim())
              .filter(n => n !== 'Anacostia River'); // Remove river from neighborhood list
            const N = neighborhoods.length;
            
            // Calculate cluster bounds to position individual hotspots
            const layer = L.geoJSON(feature);
            const bounds = layer.getBounds();
            const center = bounds.getCenter();
            
            // Base radius related to the cluster's size
            const radiusMeters = center.distanceTo(bounds.getNorthEast()) / 2;

            const latDiff = bounds.getNorth() - bounds.getSouth();
            const lngDiff = bounds.getEast() - bounds.getWest();
            const radiusY = latDiff * 0.2;
            const radiusX = lngDiff * 0.2;

            return neighborhoods.map((name, i) => {
              // Check if this specific neighborhood is toggled off
              if (hiddenNeighborhoods && hiddenNeighborhoods.has(name)) {
                return null;
              }

              // Distribute individual neighborhood hotspots around the cluster center
              let pos = [center.lat, center.lng];
              let finalRadius = radiusMeters;

              if (customOverrides[name]) {
                pos = customOverrides[name].center;
                finalRadius = customOverrides[name].radius;
              } else if (N > 1) {
                const angle = (i / N) * Math.PI * 2;
                pos = [
                  center.lat + Math.sin(angle) * radiusY,
                  center.lng + Math.cos(angle) * radiusX
                ];
              }

              // Get spatially-aware color
              const color = neighborhoodColorMap[name] || NEIGHBORHOOD_COLORS[0];
              const isSelected = selectedNeighborhoods.has(name);

              return (
                <Circle
                  key={`${featureIndex}-${i}`}
                  center={pos}
                  radius={finalRadius * (isSelected ? 1.5 : 1.2)}
                  pathOptions={{
                    color: isSelected ? '#ffffff' : color,
                    weight: isSelected ? 2 : 0,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.7 : 0.3,
                    className: isSelected ? 'blurry-node-selected' : 'blurry-node'
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedNeighborhoods(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(name)) {
                          newSet.delete(name);
                        } else {
                          newSet.add(name);
                        }
                        return newSet;
                      });
                    }
                  }}
                >
                  <Tooltip permanent direction="center" className="neighborhood-label">
                    {name}
                  </Tooltip>
                </Circle>
              );
            });
          })}
        </>
      )}

      {/* Parks Layer */}
      {activeLayers.parks && parksData && (
        <GeoJSON 
          key={`parks-${searchQuery}`}
          data={parksData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            return name.toLowerCase().includes(q);
          }}
          style={parksStyle}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.NAME || "Park";
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; color: var(--text-primary);"><span style="color: #4ade80; margin-right: 4px;">•</span>${name}</div>`, 
              {
                permanent: false,
                direction: 'center',
                className: 'custom-tooltip',
                sticky: true,
                offset: [10, -20]
              }
            );
          }}
        />
      )}

      {/* Squares & Circles Layer */}
      {activeLayers.squares && squaresData && (
        <GeoJSON 
          key={`squares-${searchQuery}`}
          data={squaresData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            return name.toLowerCase().includes(q);
          }}
          style={squaresStyle}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.NAME || "Square/Circle";
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; color: var(--text-primary);"><span style="color: #38bdf8; margin-right: 4px;">•</span>${name}</div>`, 
              {
                permanent: false,
                direction: 'center',
                className: 'custom-tooltip',
                sticky: true,
                offset: [10, -20]
              }
            );
          }}
        />
      )}

      {/* Museums Layer */}
      {activeLayers.museums && museumsData && (
        <GeoJSON 
          key={`museums-${searchQuery}`}
          data={museumsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.DCGISPLACE_NAMES_PTNAME || "";
            return name.toLowerCase().includes(q);
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 6,
              fillColor: '#8b5cf6', // purple
              color: '#a78bfa',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });
          }}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.DCGISPLACE_NAMES_PTNAME || "Museum";
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; color: var(--text-primary);"><span style="color: #a78bfa; margin-right: 4px;">•</span>${name}</div>`, 
              {
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip',
                sticky: true,
                offset: [10, -20]
              }
            );
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(9);
                l.setStyle({ weight: 4 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setRadius(6);
                l.setStyle({ weight: 2 });
              }
            });
          }}
        />
      )}

      {/* Historical Data Layer */}
      {activeLayers.historical && (
        <GeoJSON 
          key={`historical-${searchQuery}`}
          data={historicalEventsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            const summary = feature.properties?.SUMMARY || "";
            return name.toLowerCase().includes(q) || summary.toLowerCase().includes(q);
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 8,
              fillColor: '#f59e0b', // amber
              color: '#fbbf24',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const { NAME, YEAR, SUMMARY } = feature.properties;
            const tooltipContent = `<div style="font-family: 'Outfit', sans-serif; max-width: 1500px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #fbbf24;">★</span> ${NAME}
                 </div>
                 <div style="font-weight: 600; font-size: 13px; color: #fbbf24; margin-bottom: 6px;">
                   Built: ${YEAR || 'Unknown'}
                 </div>
                 <div style="font-weight: 400; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${SUMMARY}
                 </div>
               </div>`;
            layer.bindTooltip(
              tooltipContent,
              {
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip historical-tooltip',
                offset: [10, -20],
                sticky: true
              }
            );
          }}
        />
      )}

      {/* Monuments & Memorials Layer */}
      {activeLayers.monuments && monumentsData && (
        <GeoJSON 
          key={`monuments-${searchQuery}`}
          data={monumentsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            const summary = feature.properties?.SUMMARY || "";
            const type = feature.properties?.TYPE || "";
            return name.toLowerCase().includes(q) || summary.toLowerCase().includes(q) || type.toLowerCase().includes(q);
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 6,
              fillColor: '#0d9488', // teal
              color: '#14b8a6',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });
          }}
          onEachFeature={(feature, layer) => {
            const { NAME, TYPE, SUMMARY } = feature.properties;
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 600px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid rgba(20, 184, 166, 0.3); padding-bottom: 4px;">
                  <span style="color: #14b8a6; margin-right: 4px;">•</span>${NAME}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: #14b8a6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  ${TYPE}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.3;">
                  ${SUMMARY}
                </div>
              </div>
            `;

            layer.bindTooltip(
              tooltipContent,
              {
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip',
                offset: [10, -20],
                sticky: true
              }
            );
          }}
        />
      )}

      {/* Ticketed Events Layer */}
      {activeLayers.events && (
        <GeoJSON 
          key={`events-${searchQuery}`}
          data={ticketedEventsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            const summary = feature.properties?.SUMMARY || "";
            const type = feature.properties?.TYPE || "";
            return name.toLowerCase().includes(q) || summary.toLowerCase().includes(q) || type.toLowerCase().includes(q);
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 7,
              fillColor: '#ec4899', // pink-500
              color: '#f472b6',    // pink-400
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const { NAME, TYPE, SUMMARY } = feature.properties;
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 1200px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #f472b6;">🎟️</span> ${NAME}
                 </div>
                 <div style="font-weight: 600; font-size: 13px; color: #f472b6; margin-bottom: 6px;">
                   ${TYPE}
                 </div>
                 <div style="font-weight: 400; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${SUMMARY}
                 </div>
               </div>`, 
              {
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip events-tooltip',
                offset: [10, -20],
                sticky: true
              }
            );
          }}
        />
      )}

      {/* Embassies & Consulates Layer */}
      {activeLayers.embassies && embassiesData && (
        <GeoJSON 
          key={`embassies-${searchQuery}`}
          data={embassiesData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            const summary = feature.properties?.SUMMARY || "";
            const type = feature.properties?.TYPE || "";
            return name.toLowerCase().includes(q) || summary.toLowerCase().includes(q) || type.toLowerCase().includes(q);
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 6,
              fillColor: '#ef4444', // red
              color: '#dc2626',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });
          }}
          onEachFeature={(feature, layer) => {
            const { NAME, TYPE, SUMMARY } = feature.properties;
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 600px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid rgba(239, 68, 68, 0.3); padding-bottom: 4px;">
                  <span style="color: #ef4444; margin-right: 4px;">•</span>${NAME}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  ${TYPE}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.3;">
                  ${SUMMARY}
                </div>
              </div>
            `;

            layer.bindTooltip(
              tooltipContent,
              {
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip',
                offset: [10, -20],
                sticky: true
              }
            );
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(9);
                l.setStyle({ weight: 4 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setRadius(6);
                l.setStyle({ weight: 2 });
              }
            });
          }}
        />
      )}

      {/* Flood Zones Layer */}
      {activeLayers.floodZones && floodZonesData && (
        <GeoJSON
          key={`floodZones-${searchQuery}`}
          data={floodZonesData}
          style={(feature) => {
            const zone = feature.properties?.FLD_ZONE;
            const subty = feature.properties?.ZONE_SUBTY;
            let fillColor = '#3b82f6';
            let color = '#2563eb';
            
            if (zone === 'A' || zone === 'AE' || subty === 'FLOODWAY') {
              fillColor = '#ef4444';
              color = '#dc2626';
            } else if (zone === '0.2 PCT ANNUAL CHANCE FLOOD HAZARD' || subty === '0.2 PCT ANNUAL CHANCE FLOOD HAZARD') {
              fillColor = '#f97316';
              color = '#ea580c';
            } else if (zone === 'X' || subty === 'AREA OF MINIMAL FLOOD HAZARD' || subty === 'AREA WITH REDUCED FLOOD RISK DUE TO LEVEE') {
              fillColor = '#22c55e';
              color = '#16a34a';
            }

            return {
              fillColor,
              color,
              weight: 1,
              opacity: 0.8,
              fillOpacity: 0.5
            };
          }}
          onEachFeature={(feature, layer) => {
            const zone = feature.properties?.FLD_ZONE;
            const subty = feature.properties?.ZONE_SUBTY;
            let color = '#3b82f6';
            let riskLevel = 'Low Risk';
            
            if (zone === 'A' || zone === 'AE' || subty === 'FLOODWAY') {
              color = '#ef4444';
              riskLevel = 'High Risk';
            } else if (zone === '0.2 PCT ANNUAL CHANCE FLOOD HAZARD' || subty === '0.2 PCT ANNUAL CHANCE FLOOD HAZARD') {
              color = '#f97316';
              riskLevel = 'Moderate Risk';
            } else if (zone === 'X' || subty === 'AREA OF MINIMAL FLOOD HAZARD' || subty === 'AREA WITH REDUCED FLOOD RISK DUE TO LEVEE') {
              color = '#22c55e';
              riskLevel = 'Minimal Risk';
            }

            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 600px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid ${color}4d; padding-bottom: 4px;">
                  <span style="color: ${color}; margin-right: 4px;">•</span>Flood Zone: ${riskLevel}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  ${subty || zone || 'Unknown Zone'}
                </div>
              </div>
            `;
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'top',
              className: 'custom-tooltip',
              offset: [10, -20],
              sticky: true
            });
          }}
        />
      )}

      {/* Topography Layer (USGS 3DEP DEM) */}
      {activeLayers.topography && (
        <CustomTopographyLayer />
      )}

      {/* Average Property Values Layer (Simulated Choropleth) */}
      {activeLayers.propertyValues && propertyValuesData && (
        <GeoJSON
          key={`propertyValues-${searchQuery}`}
          data={propertyValuesData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const desc = feature.properties?.DESCRIPTION || "";
            const nbhd = feature.properties?.NEIGHBORHO || "";
            return desc.toLowerCase().includes(q) || nbhd.toLowerCase().includes(q);
          }}
          style={(feature) => {
            const value = feature.properties.SIMULATED_AVERAGE_VALUE;
            // Map value to a color gradient (Light Yellow to Dark Green)
            // Color ramp: $250k to $2.5m
            const minVal = 250000;
            const maxVal = 2500000;
            const ratio = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
            
            // Colors: #fef08a (yellow-200) -> #14532d (green-900)
            let fillColor = '#fef08a';
            if (ratio > 0.8) fillColor = '#14532d'; // green-900
            else if (ratio > 0.6) fillColor = '#166534'; // green-800
            else if (ratio > 0.4) fillColor = '#22c55e'; // green-500
            else if (ratio > 0.2) fillColor = '#84cc16'; // lime-500
            else if (ratio > 0.1) fillColor = '#fde047'; // yellow-300
            
            return {
              fillColor,
              color: '#ffffff',
              weight: 1,
              opacity: 0.5,
              fillOpacity: 0.65
            };
          }}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.DESCRIPTION || feature.properties?.NEIGHBORHO || "Neighborhood";
            const value = feature.properties.SIMULATED_AVERAGE_VALUE;
            
            const formattedValue = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            }).format(value);

            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid rgba(16, 185, 129, 0.3); padding-bottom: 4px;">
                  <span style="color: #10b981; margin-right: 4px;">•</span>${name}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  Assessment Neighborhood
                </div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.3;">
                  Avg Value: ${formattedValue}
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">
                  * Simulated for demonstration
                </div>
              </div>
            `;
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'center',
              className: 'custom-tooltip',
              sticky: true,
              offset: [10, -20]
            });
            
            // Bring to front on hover
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({
                  weight: 3,
                  color: '#10b981',
                  fillOpacity: 0.8
                });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                  l.bringToFront();
                }
              },
              mouseout: (e) => {
                const l = e.target;
                l.setStyle({
                  weight: 1,
                  color: '#ffffff',
                  fillOpacity: 0.65
                });
              }
            });
          }}
        />
      )}

      {/* Crime Index Layer (Simulated Choropleth) */}
      {activeLayers.crime && crimeData && (
        <GeoJSON
          key={`crime-${searchQuery}`}
          data={crimeData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const desc = feature.properties?.DESCRIPTION || "";
            const nbhd = feature.properties?.NEIGHBORHO || "";
            return desc.toLowerCase().includes(q) || nbhd.toLowerCase().includes(q);
          }}
          style={(feature) => {
            const value = feature.properties.SIMULATED_CRIME_INDEX;
            // Map value to a color gradient (Light Yellow to Dark Red)
            // Color ramp: 50 to 2500
            const minVal = 50;
            const maxVal = 2500;
            const ratio = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
            
            // Colors: #fef08a (yellow-200) -> #881337 (rose-900)
            let fillColor = '#fef08a';
            if (ratio > 0.8) fillColor = '#881337'; // rose-900
            else if (ratio > 0.6) fillColor = '#be123c'; // rose-700
            else if (ratio > 0.4) fillColor = '#f43f5e'; // rose-500
            else if (ratio > 0.2) fillColor = '#fb923c'; // orange-400
            else if (ratio > 0.1) fillColor = '#fde047'; // yellow-300
            
            return {
              fillColor,
              color: '#ffffff',
              weight: 1,
              opacity: 0.5,
              fillOpacity: 0.65
            };
          }}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.DESCRIPTION || feature.properties?.NEIGHBORHO || "Neighborhood";
            const value = feature.properties.SIMULATED_CRIME_INDEX;
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid rgba(225, 29, 72, 0.3); padding-bottom: 4px;">
                  <span style="color: #e11d48; margin-right: 4px;">•</span>${name}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: #e11d48; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  Assessment Neighborhood
                </div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.3;">
                  Crime Index: ${value} incidents/yr
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">
                  * Simulated for demonstration
                </div>
              </div>
            `;
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'center',
              className: 'custom-tooltip',
              sticky: true,
              offset: [10, -20]
            });
            
            // Bring to front on hover
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({
                  weight: 3,
                  color: '#e11d48',
                  fillOpacity: 0.8
                });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                  l.bringToFront();
                }
              },
              mouseout: (e) => {
                const l = e.target;
                l.setStyle({
                  weight: 1,
                  color: '#ffffff',
                  fillOpacity: 0.65
                });
              }
            });
          }}
        />
      )}

      {activeLayers.bikeLanes && bikeLanesData && (
        <GeoJSON
          key={`bikelanes-${Date.now()}`}
          data={bikeLanesData}
          style={(feature) => {
            const props = feature.properties;
            let laneColor = '#86efac'; // Paler green for conventional/unprotected
            let isProtected = false;
            
            if (props.BIKELANE_DUAL_PROTECTED || props.BIKELANE_PROTECTED) {
              laneColor = '#16a34a'; // Dark green for protected
              isProtected = true;
            } else if (props.BIKELANE_DUAL_BUFFERED || props.BIKELANE_BUFFERED) {
              laneColor = '#22c55e'; // Medium green for buffered
            }
            
            return {
              color: laneColor,
              weight: 3,
              opacity: 0.8,
              dashArray: isProtected ? '' : '5, 5'
            };
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties;
            const name = props.ROUTENAME || "Bike Lane";
            
            let laneType = 'Unprotected / Other';
            let laneColor = '#86efac'; 
            let hoverColor = '#4ade80';
            let tooltipColor = '#22c55e';

            if (props.BIKELANE_DUAL_PROTECTED || props.BIKELANE_PROTECTED) {
              laneType = 'Protected';
              laneColor = '#16a34a';
              hoverColor = '#15803d';
              tooltipColor = '#16a34a';
            } else if (props.BIKELANE_DUAL_BUFFERED || props.BIKELANE_BUFFERED) {
              laneType = 'Buffered';
              laneColor = '#22c55e';
              hoverColor = '#16a34a';
              tooltipColor = '#16a34a';
            } else if (props.BIKELANE_CONTRAFLOW) {
              laneType = 'Contraflow';
            } else if (props.BIKELANE_CONVENTIONAL) {
              laneType = 'Conventional';
            }
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid ${laneColor}; padding-bottom: 4px;">
                  <span style="color: ${tooltipColor}; margin-right: 4px;">•</span>${name}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: ${tooltipColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  Bicycle Lane
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.3;">
                  Type: <strong>${laneType}</strong>
                </div>
              </div>
            `;
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'top',
              className: 'custom-tooltip',
              sticky: true,
              offset: [10, -20]
            });
            
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({ weight: 5, color: hoverColor });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) { l.bringToFront(); }
              },
              mouseout: (e) => {
                const l = e.target;
                l.setStyle({ weight: 3, color: laneColor });
              }
            });
          }}
        />
      )}

      {activeLayers.metro && metroLinesData && (
        <GeoJSON
          key={`metrolines-${Date.now()}`}
          data={metroLinesData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const props = feature.properties || {};
            const lineName = (props.NAME || "").toLowerCase();
            return lineName.includes(searchQuery);
          }}
          style={(feature) => {
            const props = feature.properties;
            const lineName = (props.NAME || "red").toLowerCase();
            let lineColor = '#ef4444'; // default red
            
            if (lineName.includes('blue')) lineColor = '#3b82f6';
            else if (lineName.includes('orange')) lineColor = '#f97316';
            else if (lineName.includes('green')) lineColor = '#22c55e';
            else if (lineName.includes('yellow')) lineColor = '#eab308';
            else if (lineName.includes('silver')) lineColor = '#94a3b8';
            else if (lineName.includes('red')) lineColor = '#ef4444';
            
            return {
              color: lineColor,
              weight: 5,
              opacity: 0.8
            };
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties;
            const name = props.NAME || "Metro Line";
            const lineName = name.toLowerCase();
            let lineColor = '#ef4444';
            if (lineName.includes('blue')) lineColor = '#3b82f6';
            else if (lineName.includes('orange')) lineColor = '#f97316';
            else if (lineName.includes('green')) lineColor = '#22c55e';
            else if (lineName.includes('yellow')) lineColor = '#eab308';
            else if (lineName.includes('silver')) lineColor = '#94a3b8';
            else if (lineName.includes('red')) lineColor = '#ef4444';
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px;">
                <div style="font-weight: 700; font-size: 14px; color: ${lineColor}; text-transform: capitalize;">
                  ${name} Line
                </div>
              </div>
            `;
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'top',
              className: 'custom-tooltip',
              sticky: true,
              offset: [10, -20]
            });
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({ weight: 8, opacity: 1 });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) { l.bringToFront(); }
              },
              mouseout: (e) => {
                const l = e.target;
                l.setStyle({ weight: 5, opacity: 0.8 });
              }
            });
          }}
        />
      )}

      {activeLayers.metro && metroStationsData && (
        <GeoJSON
          key={`metrostations-${Date.now()}`}
          data={metroStationsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const props = feature.properties || {};
            const stationName = (props.NAME || "").toLowerCase();
            const linesStr = (props.LINE || "").toLowerCase();
            return stationName.includes(searchQuery) || linesStr.includes(searchQuery);
          }}
          pointToLayer={(feature, latlng) => {
            const props = feature.properties;
            const linesStr = (props.LINE || "red").toLowerCase();
            
            // Pick primary color based on first mentioned line
            let primaryColor = '#ef4444';
            if (linesStr.includes('red')) primaryColor = '#ef4444';
            else if (linesStr.includes('blue')) primaryColor = '#3b82f6';
            else if (linesStr.includes('orange')) primaryColor = '#f97316';
            else if (linesStr.includes('green')) primaryColor = '#22c55e';
            else if (linesStr.includes('yellow')) primaryColor = '#eab308';
            else if (linesStr.includes('silver')) primaryColor = '#94a3b8';

            return L.circleMarker(latlng, {
              radius: 6,
              fillColor: '#ffffff',
              color: primaryColor,
              weight: 3,
              opacity: 1,
              fillOpacity: 1
            });
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties;
            const name = props.NAME || "Metro Station";
            const linesStr = props.LINE || "";
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 250px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px;">
                  ${name}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                  Lines: <span style="font-weight: 600; text-transform: capitalize;">${linesStr}</span>
                </div>
              </div>
            `;
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'top',
              className: 'custom-tooltip',
              sticky: true,
              offset: [10, -20]
            });
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(9);
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setRadius(6);
              }
            });
          }}
        />
      )}

      {activeLayers.zoning && zoningData && (
        <GeoJSON
          key="zoning-layer"
          data={zoningData}
          style={(feature) => {
            const district = feature.properties.ZONE_DISTRICT || '';
            let fillColor = '#ffffff';
            let fillOpacity = 0.4;
            
            if (district.includes('Residential')) {
              fillColor = '#fbbf24'; // amber/yellow
            } else if (district.includes('Mixed-Use') || district.includes('Neighborhood')) {
              fillColor = '#c084fc'; // purple
            } else if (district.includes('Commercial') || district.includes('Downtown')) {
              fillColor = '#ef4444'; // red
            } else if (district.includes('Production') || district.includes('Industrial')) {
              fillColor = '#9ca3af'; // gray
            } else if (district.includes('Special Purpose')) {
              fillColor = '#3b82f6'; // blue
            } else if (district.includes('Unzoned')) {
              fillOpacity = 0;
            }

            return {
              color: fillColor,
              weight: 1,
              opacity: 0.8,
              fillColor: fillColor,
              fillOpacity: fillOpacity
            };
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties;
            const label = props.ZONING_LABEL || "Unknown Zone";
            const district = props.ZONE_DISTRICT || "Unknown District";
            const desc = props.ZONE_DESCRIPTION || "";
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 250px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px;">
                  ${label}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">
                  ${district}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                  ${desc}
                </div>
              </div>
            `;
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'top',
              className: 'custom-tooltip',
              sticky: true,
              offset: [10, -20]
            });
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({
                  weight: 2,
                  fillOpacity: 0.6
                });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setStyle({
                  weight: 1,
                  fillOpacity: 0.4
                });
              }
            });
          }}
        />
      )}

      <ZoomWidget isLeftAligned={isLeftAligned} />
    </MapContainer>
  );
};

export default MapArea;

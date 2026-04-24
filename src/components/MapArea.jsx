import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, GeoJSON, Circle, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import ZoomWidget from './ZoomWidget';
import L from 'leaflet';
import 'esri-leaflet';
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
const historicalPlaces = [
  ["Assassination of Abraham Lincoln", "1865", "President Abraham Lincoln was shot by John Wilkes Booth while attending a play at Ford's Theatre.", [-77.0258, 38.8967]],
  ["Petersen House", "1865", "Lincoln was carried across 10th Street after the assassination and died here the next morning.", [-77.0257, 38.8966]],
  ["Burning of Washington", "1814", "British forces burned public buildings including the White House during the War of 1812.", [-77.0365, 38.8977]],
  ["U.S. Capitol Burning", "1814", "British troops set fire to the Capitol during the Burning of Washington.", [-77.0091, 38.8899]],
  ["Treaty of Washington Signing", "1871", "The treaty resolving major post-Civil War claims between the United States and Great Britain was signed at the State Department.", [-77.0398, 38.8951]],
  ["Woman Suffrage Procession", "1913", "Thousands of suffragists marched down Pennsylvania Avenue on the eve of Woodrow Wilson's inauguration.", [-77.0280, 38.8949]],
  ["National Woman's Party Headquarters", "1929", "The Sewall-Belmont House became a home base for the National Woman's Party and the campaign for equal rights.", [-77.0036, 38.8922]],
  ["Mary McLeod Bethune Council House", "1943", "Mary McLeod Bethune and the National Council of Negro Women organized nationally from this Logan Circle house.", [-77.0319, 38.9098]],
  ["Carter G. Woodson Home", "1922", "Historian Carter G. Woodson worked here while building the movement that became Black History Month.", [-77.0238, 38.9109]],
  ["Frederick Douglass Cedar Hill", "1877", "Frederick Douglass lived at Cedar Hill in Anacostia during his later years as a statesman and reformer.", [-76.9859, 38.8629]],
  ["Howard University Founders Library", "1939", "Founders Library anchors Howard University, a central institution in Black scholarship, law, medicine, and civil rights.", [-77.0195, 38.9227]],
  ["Howard Theatre", "1910", "The Howard Theatre helped make U Street a national center for Black music and performance.", [-77.0210, 38.9153]],
  ["Ben's Chili Bowl", "1958", "A U Street landmark that remained open through the 1968 unrest and became a symbol of Black Washington.", [-77.0310, 38.9170]],
  ["Thurgood Marshall Center", "1912", "The former Twelfth Street YMCA was a landmark social and civic center for Black Washington.", [-77.0285, 38.9136]],
  ["Duke Ellington Birthplace", "1899", "Jazz composer Duke Ellington was born in Washington and grew up in the city's Black cultural world.", [-77.0209, 38.9086]],
  ["Lincoln Memorial Dedication", "1922", "The Lincoln Memorial opened as a national monument to Abraham Lincoln.", [-77.0502, 38.8893]],
  ["Marian Anderson Concert", "1939", "After being denied Constitution Hall, Marian Anderson sang before a huge interracial crowd from the Lincoln Memorial steps.", [-77.0502, 38.8893]],
  ["March on Washington", "1963", "Dr. Martin Luther King Jr. delivered the 'I Have a Dream' speech during the March on Washington for Jobs and Freedom.", [-77.0502, 38.8893]],
  ["Vietnam Veterans Memorial Dedication", "1982", "The memorial's dedication reshaped how the nation publicly mourned the Vietnam War.", [-77.0477, 38.8913]],
  ["AIDS Quilt on the National Mall", "1987", "The NAMES Project AIDS Memorial Quilt was first displayed on the National Mall.", [-77.0365, 38.8895]],
  ["Poor People's Campaign Resurrection City", "1968", "Activists built Resurrection City on the Mall to demand economic justice after Martin Luther King Jr.'s death.", [-77.0365, 38.8895]],
  ["Bonus Army Encampment", "1932", "World War I veterans camped at Anacostia Flats while demanding early payment of service bonuses.", [-76.9858, 38.8733]],
  ["Watergate Break-in", "1972", "The break-in at Democratic National Committee headquarters triggered the Watergate scandal.", [-77.0544, 38.8995]],
  ["Washington Post Watergate Reporting", "1972", "The Washington Post newsroom pursued reporting that helped uncover the Watergate scandal.", [-77.0317, 38.9048]],
  ["Pentagon Papers Supreme Court Case", "1971", "The Supreme Court upheld the press's ability to publish the Pentagon Papers.", [-77.0044, 38.8906]],
  ["Supreme Court Desegregation Decisions", "1954", "The Supreme Court handed down Brown v. Board of Education and companion school desegregation decisions.", [-77.0044, 38.8906]],
  ["United States v. Nixon", "1974", "The Supreme Court ordered President Nixon to release Oval Office recordings, accelerating the end of his presidency.", [-77.0044, 38.8906]],
  ["First Presidential Inauguration in DC", "1801", "Thomas Jefferson became the first president inaugurated in Washington, D.C.", [-77.0091, 38.8899]],
  ["Franklin D. Roosevelt First Inauguration", "1933", "Roosevelt told the nation that 'the only thing we have to fear is fear itself' at the Capitol.", [-77.0091, 38.8899]],
  ["Kennedy Inauguration", "1961", "John F. Kennedy urged Americans to 'ask what you can do for your country' at the Capitol.", [-77.0091, 38.8899]],
  ["January 6 Attack on the Capitol", "2021", "A mob attacked the U.S. Capitol while Congress met to certify the presidential election results.", [-77.0091, 38.8899]],
  ["White House Cornerstone", "1792", "The cornerstone of the President's House was laid as the new federal city took shape.", [-77.0365, 38.8977]],
  ["White House Civil Rights Meeting", "1963", "Civil rights leaders met with President Kennedy after the March on Washington.", [-77.0365, 38.8977]],
  ["Lafayette Square Civil War Encampments", "1861", "The square and nearby buildings became part of wartime Washington's military and political landscape.", [-77.0366, 38.8996]],
  ["Decatur House Slave Quarters", "1820s", "One of the few surviving examples of slave quarters within sight of the White House.", [-77.0391, 38.8998]],
  ["Dolly Madison Saves Washington Portrait", "1814", "Dolley Madison helped preserve the Gilbert Stuart portrait of George Washington before British troops arrived.", [-77.0365, 38.8977]],
  ["Old Patent Office Civil War Hospital", "1861", "The Patent Office served as a Civil War hospital where Walt Whitman visited wounded soldiers.", [-77.0230, 38.8979]],
  ["Clara Barton Missing Soldiers Office", "1865", "Clara Barton used this office to help families locate missing Civil War soldiers.", [-77.0229, 38.8972]],
  ["African American Civil War Memorial", "1998", "The memorial honors the United States Colored Troops and Black sailors who fought for the Union.", [-77.0260, 38.9165]],
  ["Fort Stevens", "1864", "Confederate forces attacked Fort Stevens, where Abraham Lincoln came under enemy fire.", [-77.0290, 38.9639]],
  ["Fort Reno", "1861", "Fort Reno was the highest point in the Civil War defenses of Washington.", [-77.0763, 38.9513]],
  ["Fort Totten", "1861", "Fort Totten was part of the ring of Civil War forts protecting Washington.", [-77.0082, 38.9517]],
  ["Washington Navy Yard", "1799", "The Navy Yard became one of the capital's oldest federal industrial sites and a major wartime facility.", [-76.9958, 38.8733]],
  ["Washington Arsenal Explosion", "1864", "A deadly explosion at the Washington Arsenal killed women workers producing ammunition during the Civil War.", [-77.0161, 38.8675]],
  ["Titanic Memorial Dedication", "1931", "The Women's Titanic Memorial was dedicated on the Southwest waterfront.", [-77.0180, 38.8718]],
  ["Pearl Harbor Speech to Congress", "1941", "President Roosevelt asked Congress for a declaration of war after the attack on Pearl Harbor.", [-77.0091, 38.8899]],
  ["Army-McCarthy Hearings", "1954", "Televised Senate hearings at the Capitol helped turn public opinion against Senator Joseph McCarthy.", [-77.0091, 38.8899]],
  ["Senate Watergate Hearings", "1973", "The Senate Watergate Committee hearings unfolded in the Russell Senate Office Building.", [-77.0070, 38.8926]],
  ["National Archives Opens", "1935", "The National Archives became the home of the Declaration of Independence, Constitution, and Bill of Rights.", [-77.0230, 38.8928]],
  ["Library of Congress Jefferson Building Opens", "1897", "The Library's grand Jefferson Building opened as a national temple of knowledge.", [-77.0047, 38.8887]],
  ["Smithsonian Castle Opens", "1855", "The Smithsonian Institution Building opened as the original home of the Smithsonian.", [-77.0260, 38.8888]],
  ["National Museum of African American History and Culture Opens", "2016", "The museum opened on the National Mall after decades of advocacy.", [-77.0320, 38.8911]],
  ["National Gallery of Art Opens", "1941", "The National Gallery opened to the public with a founding gift from Andrew Mellon.", [-77.0199, 38.8913]],
  ["Union Station Opens", "1907", "Union Station opened as a monumental rail gateway to the capital.", [-77.0064, 38.8970]],
  ["Old Post Office Opens", "1899", "The Old Post Office became a landmark federal building on Pennsylvania Avenue.", [-77.0274, 38.8947]],
  ["First Nationals Park Game", "2008", "Nationals Park opened, marking a new era for baseball and development along the Anacostia waterfront.", [-77.0074, 38.8730]],
  ["RFK Stadium Opens", "1961", "D.C. Stadium, later RFK Stadium, opened as a multipurpose venue for football, baseball, soccer, and concerts.", [-76.9717, 38.8898]],
  ["Martin Luther King Jr. Memorial Dedication", "2011", "The memorial to Martin Luther King Jr. was dedicated beside the Tidal Basin.", [-77.0443, 38.8861]],
  ["Japanese American Memorial Dedication", "2000", "The memorial honors Japanese American patriotism and the injustice of incarceration during World War II.", [-77.0108, 38.8967]],
  ["Emancipation Memorial Dedication", "1876", "The Emancipation Memorial was dedicated in Lincoln Park with Frederick Douglass as the keynote speaker.", [-76.9880, 38.8898]],
  ["Mary McLeod Bethune Memorial Dedication", "1974", "This Lincoln Park memorial was the first public monument in D.C. honoring an African American woman.", [-76.9892, 38.8900]],
  ["Hay-Adams and St. John's Civil Rights Era", "1960s", "Lafayette Square hotels, churches, and offices were staging grounds for national politics and protest.", [-77.0367, 38.9004]],
  ["Mayday Antiwar Protests", "1971", "Large-scale antiwar demonstrations attempted to shut down parts of the federal city.", [-77.0365, 38.8895]],
  ["First Earth Day Teach-In", "1970", "Washington hosted major Earth Day demonstrations and teach-ins around the Mall and federal core.", [-77.0365, 38.8895]],
  ["Million Man March", "1995", "Hundreds of thousands gathered on the National Mall for a major demonstration of Black unity and civic responsibility.", [-77.0365, 38.8895]],
  ["Women's March", "2017", "A mass demonstration for women's rights filled the Mall and downtown Washington after the presidential inauguration.", [-77.0365, 38.8895]],
  ["March for Our Lives", "2018", "Student-led demonstrations against gun violence brought large crowds to Pennsylvania Avenue.", [-77.0280, 38.8949]],
  ["Black Lives Matter Plaza", "2020", "The city renamed a stretch near the White House during nationwide protests for racial justice.", [-77.0366, 38.9009]],
  ["Oberlin Rescuers Trial Site", "1859", "Abolitionist defendants were tried in Washington amid national conflict over slavery and fugitive slave laws.", [-77.0163, 38.8951]],
  ["Pearl Incident Wharf", "1848", "Seventy-seven enslaved people attempted to escape from Washington aboard the schooner Pearl.", [-77.0214, 38.8769]],
  ["Franklin and Armfield Slave Pen", "1830s", "One of the largest domestic slave-trading firms operated from this area near the National Mall.", [-77.0277, 38.8847]],
  ["Old Stone House", "1765", "The Old Stone House is among the oldest surviving buildings in Washington.", [-77.0600, 38.9058]],
  ["Tudor Place", "1816", "Tudor Place preserves generations of Georgetown and Washington family history.", [-77.0629, 38.9106]],
  ["Dumbarton House", "1799", "Dumbarton House tells the story of early federal-period life in Georgetown.", [-77.0588, 38.9099]],
  ["Heurich House", "1894", "The mansion of brewer Christian Heurich reflects the immigrant industrial history of late 19th-century Washington.", [-77.0476, 38.9062]],
  ["Woodrow Wilson House", "1921", "President Woodrow Wilson lived here after leaving the White House.", [-77.0520, 38.9110]],
  ["President Lincoln's Cottage", "1862", "Lincoln lived seasonally at the Soldiers' Home, where he developed ideas behind the Emancipation Proclamation.", [-77.0110, 38.9415]],
  ["Congressional Cemetery", "1807", "The cemetery became the resting place of many early national and District figures.", [-76.9785, 38.8806]],
  ["Gallaudet University Founding", "1864", "President Lincoln signed the charter for what became Gallaudet University, a landmark in Deaf education.", [-76.9936, 38.9074]],
  ["Anacostia Community Museum Opens", "1967", "The Smithsonian opened a neighborhood museum in Anacostia to connect national collections with local communities.", [-76.9765, 38.8564]],
  ["Eastern Market Opens", "1873", "Eastern Market became a neighborhood food market and civic landmark on Capitol Hill.", [-76.9951, 38.8841]],
  ["Carnegie Library Opens", "1903", "The central public library opened in Mount Vernon Square with Andrew Carnegie's support.", [-77.0232, 38.9025]],
  ["Walter Reed Army Medical Center Opens", "1909", "Walter Reed became a major military medical center in Northwest Washington.", [-77.0327, 38.9769]],
  ["National Zoo Opens", "1889", "The Smithsonian's National Zoo opened as a public scientific and conservation institution.", [-77.0498, 38.9296]]
];

const historicalEventsData = {
  type: "FeatureCollection",
  features: historicalPlaces.map(([NAME, YEAR, SUMMARY, coordinates]) => ({
    type: "Feature",
    properties: { NAME, YEAR, SUMMARY },
    geometry: { type: "Point", coordinates }
  }))
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

const HISTORIC_DISTRICT_COLORS = [
  '#8ca173',
  '#6f9aa5',
  '#7392a2',
  '#a491aa',
  '#d47c68',
  '#e2ad4d',
  '#c9783f',
  '#b8664f',
  '#c7a169',
  '#7c9a86',
  '#d09977',
  '#9e8061'
];

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
  "Cardozo/Shaw": { center: [38.9170, -77.0320], radius: 450 },
  "Dupont Circle": { center: [38.9096, -77.0434], radius: 500 },
  "Kalorama Heights": { center: [38.9174, -77.0505], radius: 450 },
  "Southwest / Waterfront": { center: [38.8770, -77.0180], radius: 600 },
  "Southwest Employment Area": { center: [38.8820, -77.0200], radius: 500 },
  "Georgetown": { center: [38.9048, -77.0628], radius: 550 },
  "Burleith/Hillandale": { center: [38.9145, -77.0700], radius: 450 },
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

const NEIGHBORHOOD_DISPLAY_NAMES = {
  'Kalorama Heights': 'Kalorama',
  'Mt. Pleasant': 'Mount Pleasant',
  'Burleith/Hillandale': 'Burleith / Hillandale',
  'Historic Anacostia': 'Anacostia',
  'Southwest/Waterfront': 'Southwest Waterfront / The Wharf'
};

const syntheticNeighborhoods = [
  { name: 'U Street Corridor', center: [38.9170, -77.0270], radius: 450 },
  { name: 'H Street Corridor', center: [38.9007, -76.9955], radius: 450 },
  { name: 'Barracks Row', center: [38.8817, -76.9952], radius: 350 },
  { name: 'Hill East', center: [38.8845, -76.9785], radius: 500 }
];

const getNeighborhoodDisplayName = (name) => NEIGHBORHOOD_DISPLAY_NAMES[name] || name;

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const isExactTriangleName = (name) => name.trim().toLowerCase() === 'triangle';

const isGenericSquareCircleName = (name) => {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'circle' ||
    /^triangle park res\b/i.test(name) ||
    /^triangle park\s+\d/i.test(name) ||
    /^square\s+[a-z]?\.\s*\d/i.test(name) ||
    /^square\s+\d/i.test(name)
  );
};

const formatSquareCircleLabel = (name) => {
  const trimmed = name.trim();
  const keywordMatch = trimmed.match(/\b(Circle|Square|Triangle)\b/i);
  if (!keywordMatch) return escapeHtml(trimmed);

  const keyword = keywordMatch[1];
  const before = trimmed.slice(0, keywordMatch.index).trim();
  const after = trimmed.slice(keywordMatch.index + keyword.length).trim();
  const firstLine = [before, after].filter(Boolean).join(' ');

  if (!firstLine) return escapeHtml(keyword);
  return `${escapeHtml(firstLine)}<br><span class="square-circle-label-keyword">${escapeHtml(keyword)}</span>`;
};

const getFeatureCenter = (feature) => {
  try {
    const bounds = L.geoJSON(feature).getBounds();
    if (!bounds.isValid()) return null;
    const center = bounds.getCenter();
    return [center.lng, center.lat];
  } catch {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.getUTCFullYear().toString();
};

const formatNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number);
};

const formatFederalTenure = (value) => {
  if (value === 'F') return 'Federally Owned';
  if (value === 'L') return 'Leased';
  return value || 'Federal Asset';
};

const formatFederalArea = (value) => {
  const squareFeet = Number(value);
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) return '';
  const acres = squareFeet / 43560;
  if (acres >= 10) return `${formatNumber(acres)} acres`;
  return `${acres.toFixed(1)} acres`;
};

const getFederalAssetColor = (props = {}) => {
  if (props.BUILDING_STATUS === 'Excess') return '#e11d48';
  if (props.REAL_PROPERTY_ASSET_TYPE === 'LAND') return '#16a34a';
  if (props.REAL_PROPERTY_ASSET_TYPE === 'STRUCTURE') return '#f97316';
  if (props.OWNED_OR_LEASED === 'L') return '#0891b2';
  return '#1d4ed8';
};

const getFederalMarkerRadius = (props = {}) => {
  const squareFeet = Number(props.BUILDING_RENTABLE_SQUARE_FEET);
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) return 5;
  if (squareFeet >= 1000000) return 10;
  if (squareFeet >= 500000) return 8;
  if (squareFeet >= 150000) return 7;
  return 5;
};

const getFederalMarkerStyle = (props = {}) => {
  const color = getFederalAssetColor(props);
  return {
    pane: 'markerPane',
    radius: getFederalMarkerRadius(props),
    fillColor: color,
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: props.BUILDING_STATUS === 'Excess' ? 0.65 : 0.9
  };
};

const federalFeatureMatchesSearch = (feature, query) => {
  if (!query) return true;
  const props = feature.properties || {};
  return [
    props.REAL_PROPERTY_ASSET_NAME,
    props.INSTALLATION_NAME,
    props.STREET_ADDRESS,
    props.CITY,
    props.ZIP_CODE,
    props.OWNED_OR_LEASED,
    props.BUILDING_STATUS,
    props.REAL_PROPERTY_ASSET_TYPE,
    props.LOCATION_CODE,
    props.GIS_ID,
    props.GLOBALID,
    props.OBJECTID
  ].some(value => String(value || '').toLowerCase().includes(query));
};

const getStablePaletteColor = (value, palette) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const getDcpsPointStyle = (props = {}) => {
  const facuse = String(props.FACUSE || '').toLowerCase();
  let fillColor = '#6366f1';
  let stroke = '#a5b4fc';
  if (facuse.includes('high')) {
    fillColor = '#4f46e5';
    stroke = '#c7d2fe';
  } else if (facuse.includes('middle')) {
    fillColor = '#7c3aed';
    stroke = '#ddd6fe';
  } else if (facuse.includes('elementary')) {
    fillColor = '#818cf8';
    stroke = '#e0e7ff';
  } else if (facuse.includes('education campus')) {
    fillColor = '#4338ca';
    stroke = '#a5b4fc';
  }
  const inactive = String(props.STATUS || '').toLowerCase() !== 'active';
  return {
    pane: 'markerPane',
    radius: 6,
    fillColor,
    color: stroke,
    weight: 2,
    opacity: 1,
    fillOpacity: inactive ? 0.45 : 0.85
  };
};

const dcpsFeatureMatchesSearch = (feature, query) => {
  if (!query) return true;
  const props = feature.properties || {};
  return [
    props.NAME,
    props.SCHOOL_NAM,
    props.ADDRESS,
    props.FACUSE,
    props.GRADES,
    props.ZIPCODE,
    props.PHONE,
    props.SCHOOL_ID,
    props.GIS_ID,
    props.WEB_URL,
    props.LEA_NAME
  ].some(value => String(value || '').toLowerCase().includes(query));
};

const WARD_POLYGON_STYLES = {
  1: { fill: '#fecdd3', stroke: '#be123c' },
  2: { fill: '#ffedd5', stroke: '#c2410c' },
  3: { fill: '#fef9c3', stroke: '#a16207' },
  4: { fill: '#dcfce7', stroke: '#15803d' },
  5: { fill: '#cffafe', stroke: '#0e7490' },
  6: { fill: '#dbeafe', stroke: '#1d4ed8' },
  7: { fill: '#ede9fe', stroke: '#6d28d9' },
  8: { fill: '#fce7f3', stroke: '#be185d' }
};

const getWardPolygonStyle = (props = {}) => {
  const n = Number(props.WARD ?? props.WARD_ID);
  const s = WARD_POLYGON_STYLES[n] || { fill: '#e2e8f0', stroke: '#64748b' };
  return {
    color: s.stroke,
    weight: 2,
    opacity: 0.95,
    fillColor: s.fill,
    fillOpacity: 0.38
  };
};

const wardFeatureMatchesSearch = (feature, query) => {
  if (!query) return true;
  const props = feature.properties || {};
  return [
    props.NAME,
    props.LABEL,
    props.WARD,
    props.WARD_ID,
    props.REP_NAME,
    props.REP_EMAIL,
    props.REP_PHONE,
    props.REP_OFFICE,
    props.GEOID,
    props.GEOCODE
  ].some(value => String(value || '').toLowerCase().includes(query));
};

const MapArea = ({ activeLayers, geoJsonData, hiddenNeighborhoods, dcBoundary, floodZonesData, searchQuery, selectedNeighborhoods, setSelectedNeighborhoods, isLeftAligned, showNeighborhoodBackgrounds }) => {
  const dcCenter = [38.8895, -77.0320]; // Centered near the National Mall
  const [parksData, setParksData] = useState(null);
  const [squaresData, setSquaresData] = useState(null);
  const [museumsData, setMuseumsData] = useState(null);
  const [dcpsSchoolsData, setDcpsSchoolsData] = useState(null);
  const [muralsPublicArtData, setMuralsPublicArtData] = useState(null);
  const [historicLandmarksData, setHistoricLandmarksData] = useState(null);
  const [propertyValuesData, setPropertyValuesData] = useState(null);
  const [crimeData, setCrimeData] = useState(null);
  const [bikeLanesData, setBikeLanesData] = useState(null);
  const [metroLinesData, setMetroLinesData] = useState(null);
  const [metroStationsData, setMetroStationsData] = useState(null);
  const [federalPropertyData, setFederalPropertyData] = useState(null);
  const [federalBuildingsData, setFederalBuildingsData] = useState(null);
  const [zoningData, setZoningData] = useState(null);
  const [wardsData, setWardsData] = useState(null);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const toggleNeighborhoodSelection = (name) => {
    setSelectedNeighborhoods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

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
            if (isSquareOrCircle(name) && !isExactTriangleName(name)) {
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
    if (activeLayers.dcps && !dcpsSchoolsData) {
      fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Education_WebMercator/MapServer/5/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=500')
        .then(res => res.json())
        .then(data => setDcpsSchoolsData(data))
        .catch(err => console.error("Error fetching DCPS schools data:", err));
    }
  }, [activeLayers.dcps, dcpsSchoolsData]);

  useEffect(() => {
    if (activeLayers.muralsPublicArt && !muralsPublicArtData) {
      import('../data/murals-public-art.json')
        .then(module => setMuralsPublicArtData(module.default))
        .catch(err => console.error("Error loading murals and public art data:", err));
    }
  }, [activeLayers.muralsPublicArt, muralsPublicArtData]);

  useEffect(() => {
    if (activeLayers.historicLandmarks && !historicLandmarksData) {
      const landmarksUrl = 'https://opendata.dc.gov/api/download/v1/items/288a8c4db1b641b28748dbad958b5272/geojson?layers=23';
      const districtsUrl = 'https://opendata.dc.gov/api/download/v1/items/a443bfb6d078439e9e1941773879c7f6/geojson?layers=6';

      Promise.all([
        fetch(landmarksUrl).then(res => res.json()),
        fetch(districtsUrl).then(res => res.json())
      ])
        .then(([landmarks, districts]) => {
          const landmarkPoints = (landmarks.features || [])
            .map(feature => {
              const center = getFeatureCenter(feature);
              if (!center) return null;

              return {
                type: 'Feature',
                properties: {
                  ...feature.properties,
                  FEATURE_KIND: 'Historic Landmark'
                },
                geometry: {
                  type: 'Point',
                  coordinates: center
                }
              };
            })
            .filter(Boolean);

          const districtFeatures = (districts.features || []).map(feature => ({
            ...feature,
            properties: {
              ...feature.properties,
              FEATURE_KIND: 'Historic District'
            }
          }));

          setHistoricLandmarksData({
            landmarks: { type: 'FeatureCollection', features: landmarkPoints },
            districts: { type: 'FeatureCollection', features: districtFeatures }
          });
        })
        .catch(err => console.error("Error fetching historic landmarks data:", err));
    }
  }, [activeLayers.historicLandmarks, historicLandmarksData]);

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

  useEffect(() => {
    if (activeLayers.metro && !metroLinesData) {
      import('../data/metro-lines.json')
        .then(module => setMetroLinesData(module.default))
        .catch(err => console.error("Error loading metro lines data:", err));
    }
  }, [activeLayers.metro, metroLinesData]);

  useEffect(() => {
    if (activeLayers.metro && !metroStationsData) {
      import('../data/metro-stations.json')
        .then(module => setMetroStationsData(module.default))
        .catch(err => console.error("Error loading metro stations data:", err));
    }
  }, [activeLayers.metro, metroStationsData]);

  useEffect(() => {
    if (activeLayers.federal && !federalPropertyData) {
      import('../data/federal-property.json')
        .then(module => setFederalPropertyData(module.default))
        .catch(err => console.error("Error loading federal property data:", err));
    }
  }, [activeLayers.federal, federalPropertyData]);

  useEffect(() => {
    if (activeLayers.federal && !federalBuildingsData) {
      import('../data/federal-buildings.json')
        .then(module => setFederalBuildingsData(module.default))
        .catch(err => console.error("Error loading federal buildings data:", err));
    }
  }, [activeLayers.federal, federalBuildingsData]);

  useEffect(() => {
    if (activeLayers.zoning && !zoningData) {
      import('../data/dc-zoning.json')
        .then(module => setZoningData(module.default))
        .catch(err => console.error("Error loading zoning data:", err));
    }
  }, [activeLayers.zoning, zoningData]);

  useEffect(() => {
    if (activeLayers.wards && !wardsData) {
      fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Administrative_Other_Boundaries_WebMercator/MapServer/53/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=20')
        .then(res => res.json())
        .then(data => setWardsData(data))
        .catch(err => console.error("Error fetching ward boundaries:", err));
    }
  }, [activeLayers.wards, wardsData]);

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

  const getHistoricDistrictStyle = (feature, highlight = false) => {
    const props = feature?.properties || {};
    const color = getStablePaletteColor(props.UNIQUEID || props.LABEL || props.NAME, HISTORIC_DISTRICT_COLORS);
    return {
      fillColor: color,
      fillOpacity: highlight ? 0.38 : 0.24,
      color,
      weight: highlight ? 3 : 2,
      opacity: highlight ? 0.92 : 0.78,
      dashArray: '4, 4'
    };
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
              const displayName = getNeighborhoodDisplayName(name);
              const isSearchMatch = normalizedSearchQuery && (
                name.toLowerCase().includes(normalizedSearchQuery) ||
                displayName.toLowerCase().includes(normalizedSearchQuery)
              );
              if (normalizedSearchQuery && !isSearchMatch) {
                return null;
              }
              if (!normalizedSearchQuery && hiddenNeighborhoods && hiddenNeighborhoods.has(name)) {
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
                  radius={showNeighborhoodBackgrounds ? finalRadius * (isSelected ? 1.5 : 1.2) : 1}
                  pathOptions={{
                    color: showNeighborhoodBackgrounds ? (isSelected ? '#ffffff' : color) : 'transparent',
                    weight: showNeighborhoodBackgrounds ? (isSelected ? 2 : 0) : 0,
                    fillColor: color,
                    fillOpacity: showNeighborhoodBackgrounds ? (isSelected ? 0.7 : 0.3) : 0,
                    className: showNeighborhoodBackgrounds ? (isSelected ? 'blurry-node-selected' : 'blurry-node') : ''
                  }}
                  eventHandlers={{
                    click: () => {
                      toggleNeighborhoodSelection(name);
                    }
                  }}
                >
                  <Tooltip
                    permanent
                    direction="center"
                    interactive={!!isSearchMatch}
                    className={`neighborhood-label ${isSearchMatch ? 'neighborhood-label-search-result' : ''}`}
                  >
                    <button
                      type="button"
                      className="neighborhood-label-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        L.DomEvent.stopPropagation(event.nativeEvent);
                        toggleNeighborhoodSelection(name);
                      }}
                    >
                      {displayName}
                    </button>
                  </Tooltip>
                </Circle>
              );
            });
          })}
          {syntheticNeighborhoods.map((neighborhood, index) => {
            const { name, center, radius } = neighborhood;
            const isSearchMatch = normalizedSearchQuery && name.toLowerCase().includes(normalizedSearchQuery);
            if (normalizedSearchQuery && !isSearchMatch) {
              return null;
            }
            if (!normalizedSearchQuery && hiddenNeighborhoods && hiddenNeighborhoods.has(name)) {
              return null;
            }

            const color = NEIGHBORHOOD_COLORS[(index + 3) % NEIGHBORHOOD_COLORS.length];
            const isSelected = selectedNeighborhoods.has(name);

            return (
              <Circle
                key={`synthetic-${name}`}
                center={center}
                radius={showNeighborhoodBackgrounds ? radius * (isSelected ? 1.5 : 1.2) : 1}
                pathOptions={{
                  color: showNeighborhoodBackgrounds ? (isSelected ? '#ffffff' : color) : 'transparent',
                  weight: showNeighborhoodBackgrounds ? (isSelected ? 2 : 0) : 0,
                  fillColor: color,
                  fillOpacity: showNeighborhoodBackgrounds ? (isSelected ? 0.7 : 0.3) : 0,
                  className: showNeighborhoodBackgrounds ? (isSelected ? 'blurry-node-selected' : 'blurry-node') : ''
                }}
                eventHandlers={{
                  click: () => {
                    toggleNeighborhoodSelection(name);
                  }
                }}
              >
                <Tooltip
                  permanent
                  direction="center"
                  interactive={!!isSearchMatch}
                  className={`neighborhood-label ${isSearchMatch ? 'neighborhood-label-search-result' : ''}`}
                >
                  <button
                    type="button"
                    className="neighborhood-label-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      L.DomEvent.stopPropagation(event.nativeEvent);
                      toggleNeighborhoodSelection(name);
                    }}
                  >
                    {name}
                  </button>
                </Tooltip>
              </Circle>
            );
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
            const showPermanentLabel = !isGenericSquareCircleName(name);
            layer.bindTooltip(
              `<div class="${showPermanentLabel ? 'square-circle-label-text' : ''}">${showPermanentLabel ? formatSquareCircleLabel(name) : escapeHtml(name)}</div>`, 
              {
                permanent: showPermanentLabel,
                direction: 'center',
                className: showPermanentLabel ? 'square-circle-label' : 'custom-tooltip',
                sticky: !showPermanentLabel,
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

      {/* DC Public Schools (DCPS) */}
      {activeLayers.dcps && dcpsSchoolsData && (
        <GeoJSON
          key={`dcps-schools-${searchQuery}`}
          data={dcpsSchoolsData}
          filter={(feature) => dcpsFeatureMatchesSearch(feature, normalizedSearchQuery)}
          pointToLayer={(feature, latlng) => L.circleMarker(latlng, getDcpsPointStyle(feature.properties))}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const name = escapeHtml(props.NAME || props.SCHOOL_NAM || 'School');
            const facuse = escapeHtml(props.FACUSE || '');
            const grades = escapeHtml(props.GRADES || '');
            const address = escapeHtml(props.ADDRESS || '');
            const zip = escapeHtml(props.ZIPCODE != null ? String(props.ZIPCODE) : '');
            const phone = escapeHtml(props.PHONE || '');
            const students = formatNumber(props.TOTAL_STUD);
            const status = escapeHtml(props.STATUS || '');
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; color: var(--text-primary);"><span style="color: #6366f1; margin-right: 4px;">•</span>${name}</div>`
            ];
            if (facuse) lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${facuse}</div>`);
            if (grades) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">Grades: ${grades}</div>`);
            if (address) {
              const addrLine = zip ? `${address}, DC ${zip}` : address;
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${addrLine}</div>`);
            }
            if (phone) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${phone}</div>`);
            if (students) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">Enrollment: ${students}</div>`);
            if (status && status.toLowerCase() !== 'active') {
              lines.push(`<div style="font-size: 11px; color: #f97316; margin-top: 4px;">Status: ${status}</div>`);
            }
            layer.bindTooltip(lines.join(''), {
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
                l.setStyle({ weight: 4 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const s = getDcpsPointStyle(feature.properties);
                l.setRadius(s.radius);
                l.setStyle({ weight: s.weight });
              }
            });
          }}
        />
      )}

      {/* Murals & Public Art Layer */}
      {activeLayers.muralsPublicArt && muralsPublicArtData && (
        <GeoJSON
          key={`murals-public-art-${searchQuery}`}
          data={muralsPublicArtData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const props = feature.properties || {};
            return [
              props.title,
              props.artist,
              props.artType,
              props.medium,
              props.address,
              props.neighborhood,
              props.source
            ].some(value => String(value || '').toLowerCase().includes(q));
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 6,
              fillColor: '#ca8a04',
              color: '#facc15',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.85
            });
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const title = escapeHtml(props.title || 'Untitled Public Art');
            const artist = escapeHtml(props.artist);
            const artType = escapeHtml(props.artType || 'Public Art');
            const medium = escapeHtml(props.medium);
            const year = escapeHtml(props.year);
            const address = escapeHtml(props.address);
            const neighborhood = escapeHtml(props.neighborhood);
            const source = escapeHtml(props.source);

            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 320px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid rgba(202, 138, 4, 0.35); padding-bottom: 4px;">
                  <span style="color: #ca8a04; margin-right: 4px;">•</span>${title}
                </div>
                <div style="font-size: 11px; font-weight: 700; color: #ca8a04; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  ${artType}${year ? ` · ${year}` : ''}
                </div>
                ${artist ? `<div style="font-size: 12px; color: var(--text-primary); line-height: 1.35;"><strong>Artist:</strong> ${artist}</div>` : ''}
                ${medium ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Medium:</strong> ${medium}</div>` : ''}
                ${address ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Address:</strong> ${address}</div>` : ''}
                ${neighborhood ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Neighborhood:</strong> ${neighborhood}</div>` : ''}
                ${source ? `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 5px; opacity: 0.85;">${source}</div>` : ''}
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

      {/* Historic Landmarks & Districts Layer */}
      {activeLayers.historicLandmarks && historicLandmarksData && (
        <>
          <GeoJSON
            key={`historic-districts-${searchQuery}`}
            data={historicLandmarksData.districts}
            filter={(feature) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              const props = feature.properties || {};
              return [
                props.NAME,
                props.LABEL,
                props.ADDRESS,
                props.STATUS,
                props.DESIGNATION,
                props.HITYPE,
                props.FEATURE_KIND
              ].some(value => String(value || '').toLowerCase().includes(q));
            }}
            style={(feature) => getHistoricDistrictStyle(feature)}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const districtColor = getStablePaletteColor(props.UNIQUEID || props.LABEL || props.NAME, HISTORIC_DISTRICT_COLORS);
              const name = escapeHtml(props.LABEL || props.NAME || 'Historic District');
              const address = escapeHtml(props.ADDRESS);
              const status = escapeHtml(props.STATUS);
              const designation = escapeHtml(props.DESIGNATION);
              const year = escapeHtml(formatDate(props.DESIGNATION_DATE));

              const tooltipContent = `
                <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 320px;">
                  <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid rgba(184, 138, 55, 0.4); padding-bottom: 4px;">
                    <span style="color: ${districtColor}; margin-right: 4px;">◆</span>${name}
                  </div>
                  <div style="font-size: 11px; font-weight: 700; color: #18432f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Historic District${year ? ` · ${year}` : ''}
                  </div>
                  ${address ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Address:</strong> ${address}</div>` : ''}
                  ${designation ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Designation:</strong> ${designation}</div>` : ''}
                  ${status ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Status:</strong> ${status}</div>` : ''}
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
                  e.target.setStyle(getHistoricDistrictStyle(feature, true));
                  e.target.bringToFront();
                },
                mouseout: (e) => {
                  e.target.setStyle(getHistoricDistrictStyle(feature));
                }
              });
            }}
          />
          <GeoJSON
            key={`historic-landmarks-${searchQuery}`}
            data={historicLandmarksData.landmarks}
            filter={(feature) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              const props = feature.properties || {};
              return [
                props.NAME,
                props.LABEL,
                props.SHORTLABEL,
                props.STATUS,
                props.FEATURE_KIND
              ].some(value => String(value || '').toLowerCase().includes(q));
            }}
            pointToLayer={(feature, latlng) => {
              return L.circleMarker(latlng, {
                pane: 'markerPane',
                radius: 4.5,
                fillColor: '#18432f',
                color: '#e6c879',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85
              });
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const name = escapeHtml(props.LABEL || props.SHORTLABEL || props.NAME || 'Historic Landmark');
              const status = escapeHtml(props.STATUS);
              const year = escapeHtml(formatDate(props.DESIGNATION_DATE));
              const uniqueId = escapeHtml(props.UNIQUEID);

              const tooltipContent = `
                <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">
                  <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; border-bottom: 1px solid rgba(184, 138, 55, 0.4); padding-bottom: 4px;">
                    <span style="color: #18432f; margin-right: 4px;">•</span>${name}
                  </div>
                  <div style="font-size: 11px; font-weight: 700; color: #18432f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Historic Landmark${year ? ` · ${year}` : ''}
                  </div>
                  ${status ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Status:</strong> ${status}</div>` : ''}
                  ${uniqueId ? `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 5px; opacity: 0.85;">${uniqueId}</div>` : ''}
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
                  l.setRadius(7);
                  l.setStyle({ weight: 3 });
                  l.bringToFront();
                },
                mouseout: (e) => {
                  const l = e.target;
                  l.setRadius(4.5);
                  l.setStyle({ weight: 1.5 });
                }
              });
            }}
          />
        </>
      )}

      {/* Places in History Layer */}
      {activeLayers.historical && (
        <GeoJSON 
          key={`historical-${searchQuery}`}
          data={historicalEventsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            const year = feature.properties?.YEAR || "";
            const summary = feature.properties?.SUMMARY || "";
            return [name, year, summary].some(value => value.toLowerCase().includes(q));
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 6,
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
                   Year: ${YEAR || 'Unknown'}
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(9);
                l.setStyle({ weight: 3, fillOpacity: 1 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setRadius(6);
                l.setStyle({ weight: 2, fillOpacity: 0.9 });
              }
            });
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
          key="bikelanes"
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
          key={`metrolines-${searchQuery}`}
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
          key={`metrostations-${searchQuery}`}
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

      {activeLayers.federal && federalPropertyData && (
        <GeoJSON
          key={`federal-footprints-${searchQuery}`}
          data={federalPropertyData}
          filter={(feature) => {
            if (!normalizedSearchQuery) return true;
            const props = feature.properties || {};
            return [
              'Federal footprint',
              'Federal property',
              props.OBJECTID,
              props.GLOBALID
            ].some(value => String(value || '').toLowerCase().includes(normalizedSearchQuery));
          }}
          style={() => ({
            fillColor: '#1d4ed8',
            color: '#1e40af',
            weight: 2,
            opacity: 0.75,
            fillOpacity: 0.18,
            dashArray: '6 4'
          })}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const objectId = escapeHtml(props.OBJECTID);
            const area = escapeHtml(formatFederalArea(props.DCGIS_REDACTIONAREAPLY_AREA || props.SHAPEAREA));
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 280px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px; border-bottom: 1px solid rgba(29, 78, 216, 0.35); padding-bottom: 4px;">
                  <span style="color: #1d4ed8; margin-right: 4px;">•</span>Federal Footprint
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;">
                  ${area ? `Approx. area: <strong>${area}</strong><br>` : ''}
                  ${objectId ? `Feature ID: <strong>${objectId}</strong>` : 'Restricted federal property area'}
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
                  weight: 3,
                  fillOpacity: 0.32,
                  dashArray: null
                });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setStyle({
                  weight: 2,
                  fillOpacity: 0.18,
                  dashArray: '6 4'
                });
              }
            });
          }}
        />
      )}

      {activeLayers.federal && federalBuildingsData && (
        <GeoJSON
          key={`federal-buildings-${searchQuery}`}
          data={federalBuildingsData}
          filter={(feature) => federalFeatureMatchesSearch(feature, normalizedSearchQuery)}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, getFederalMarkerStyle(feature.properties));
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const name = escapeHtml(props.REAL_PROPERTY_ASSET_NAME || props.INSTALLATION_NAME || 'Federal Asset');
            const installation = escapeHtml(props.INSTALLATION_NAME && props.INSTALLATION_NAME !== 'NA' ? props.INSTALLATION_NAME : '');
            const address = escapeHtml([props.STREET_ADDRESS, props.CITY, props.STATE, props.ZIP_CODE].filter(Boolean).join(', '));
            const tenure = escapeHtml(formatFederalTenure(props.OWNED_OR_LEASED));
            const assetType = escapeHtml(props.REAL_PROPERTY_ASSET_TYPE || 'Asset');
            const status = escapeHtml(props.BUILDING_STATUS || 'Unknown status');
            const squareFeet = escapeHtml(formatNumber(props.BUILDING_RENTABLE_SQUARE_FEET));
            const constructionDate = escapeHtml(props.CONSTRUCTION_DATE);
            const color = getFederalAssetColor(props);
            
            const tooltipContent = `
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 310px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 3px; border-bottom: 1px solid ${color}; padding-bottom: 4px;">
                  <span style="color: ${color}; margin-right: 4px;">•</span>${name}
                </div>
                ${installation ? `
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">
                  ${installation}
                </div>` : ''}
                <div style="font-size: 11px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                  ${tenure} &middot; ${assetType} &middot; ${status}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                  ${address ? `${address}<br>` : ''}
                  ${squareFeet ? `Rentable SF: <strong>${squareFeet}</strong><br>` : ''}
                  ${constructionDate ? `Built: <strong>${constructionDate}</strong>` : ''}
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
                l.setRadius(getFederalMarkerRadius(props) + 3);
                l.setStyle({ weight: 3, fillOpacity: 1 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setRadius(getFederalMarkerRadius(props));
                l.setStyle(getFederalMarkerStyle(props));
              }
            });
          }}
        />
      )}

      {activeLayers.wards && wardsData && (
        <GeoJSON
          key={`wards-${searchQuery}`}
          data={wardsData}
          filter={(feature) => wardFeatureMatchesSearch(feature, normalizedSearchQuery)}
          style={(feature) => getWardPolygonStyle(feature.properties)}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const title = escapeHtml(props.LABEL || props.NAME || 'Ward');
            const rep = escapeHtml(props.REP_NAME || '');
            const phone = escapeHtml(props.REP_PHONE || '');
            const email = escapeHtml(props.REP_EMAIL || '');
            const office = escapeHtml(props.REP_OFFICE || '');
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 280px;">`,
              `<div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px;">`,
              `<span style="color: #0891b2; margin-right: 6px;">●</span>${title}`,
              `</div>`
            ];
            if (rep) {
              lines.push(`<div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">Councilmember: ${rep}</div>`);
            }
            if (phone) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${phone}</div>`);
            if (email) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${email}</div>`);
            if (office) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; line-height: 1.35;">${office}</div>`);
            lines.push(`</div>`);
            layer.bindTooltip(lines.join(''), {
              permanent: false,
              direction: 'top',
              className: 'custom-tooltip',
              sticky: true,
              offset: [10, -20]
            });
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                const base = getWardPolygonStyle(feature.properties);
                l.setStyle({ ...base, weight: 3, fillOpacity: 0.52 });
                l.bringToFront();
              },
              mouseout: (e) => {
                e.target.setStyle(getWardPolygonStyle(feature.properties));
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

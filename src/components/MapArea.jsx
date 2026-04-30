import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
    { type: "Feature", properties: { NAME: "Audi Field", TYPE: "Stadium", SUMMARY: "Soccer-specific stadium hosting DC United, Washington Spirit, and major ticketed events." }, geometry: { type: "Point", coordinates: [-77.0129, 38.8683] } },
    { type: "Feature", properties: { NAME: "9:30 Club", TYPE: "Music Venue", SUMMARY: "Iconic nightclub and concert venue for live music." }, geometry: { type: "Point", coordinates: [-77.0235, 38.9180] } },
    { type: "Feature", properties: { NAME: "The Anthem", TYPE: "Music Venue", SUMMARY: "Large concert hall and events venue at the District Wharf." }, geometry: { type: "Point", coordinates: [-77.0264, 38.8797] } },
    { type: "Feature", properties: { NAME: "Echostage", TYPE: "Music Venue", SUMMARY: "Large indoor performance space known for major electronic and touring acts." }, geometry: { type: "Point", coordinates: [-76.9953, 38.9172] } },
    { type: "Feature", properties: { NAME: "The Atlantis", TYPE: "Music Venue", SUMMARY: "Intimate sister venue to 9:30 Club focused on emerging and mid-size touring artists." }, geometry: { type: "Point", coordinates: [-77.0232, 38.9178] } },
    { type: "Feature", properties: { NAME: "Lincoln Theatre", TYPE: "Theater", SUMMARY: "Historic U Street theater hosting concerts, comedy, and special performances." }, geometry: { type: "Point", coordinates: [-77.0240, 38.9175] } },
    { type: "Feature", properties: { NAME: "Howard Theatre", TYPE: "Music Venue", SUMMARY: "Renovated historic venue presenting concerts, comedy, and nightlife events." }, geometry: { type: "Point", coordinates: [-77.0246, 38.9169] } },
    { type: "Feature", properties: { NAME: "Kennedy Center", TYPE: "Performing Arts", SUMMARY: "Premier performing arts center on the Potomac River." }, geometry: { type: "Point", coordinates: [-77.0560, 38.8954] } },
    { type: "Feature", properties: { NAME: "Arena Stage", TYPE: "Performing Arts", SUMMARY: "Major regional theater campus staging ticketed productions year-round." }, geometry: { type: "Point", coordinates: [-77.0208, 38.8740] } },
    { type: "Feature", properties: { NAME: "National Theatre", TYPE: "Theater", SUMMARY: "Historic downtown theater hosting touring Broadway and live performances." }, geometry: { type: "Point", coordinates: [-77.0303, 38.8971] } },
    { type: "Feature", properties: { NAME: "Warner Theatre", TYPE: "Theater", SUMMARY: "Historic venue hosting concerts, comedy, and theater." }, geometry: { type: "Point", coordinates: [-77.0305, 38.8961] } },
    { type: "Feature", properties: { NAME: "DAR Constitution Hall", TYPE: "Concert Hall", SUMMARY: "Historic concert hall and event venue near the White House." }, geometry: { type: "Point", coordinates: [-77.0416, 38.8936] } },
    { type: "Feature", properties: { NAME: "Folger Theatre", TYPE: "Theater", SUMMARY: "Acclaimed intimate venue for classical theater, specifically Shakespeare." }, geometry: { type: "Point", coordinates: [-77.0035, 38.8884] } },
    { type: "Feature", properties: { NAME: "Ford's Theatre", TYPE: "Theater", SUMMARY: "Historic working theater producing plays year-round, alongside its museum." }, geometry: { type: "Point", coordinates: [-77.0258, 38.8966] } },
    { type: "Feature", properties: { NAME: "Black Cat", TYPE: "Music Venue", SUMMARY: "Legendary independent music venue on 14th Street hosting indie and alternative bands." }, geometry: { type: "Point", coordinates: [-77.0316, 38.9150] } },
    { type: "Feature", properties: { NAME: "The Hamilton Live", TYPE: "Music Venue", SUMMARY: "Downtown live music venue with ticketed nightly performances." }, geometry: { type: "Point", coordinates: [-77.0318, 38.8975] } },
    { type: "Feature", properties: { NAME: "Union Stage", TYPE: "Music Venue", SUMMARY: "Intimate Wharf venue for concerts, podcasts, and live events." }, geometry: { type: "Point", coordinates: [-77.0269, 38.8790] } },
    { type: "Feature", properties: { NAME: "Pearl Street Warehouse", TYPE: "Music Venue", SUMMARY: "Ticketed live music hall at The Wharf featuring Americana and touring acts." }, geometry: { type: "Point", coordinates: [-77.0270, 38.8787] } },
    { type: "Feature", properties: { NAME: "Songbyrd Music House", TYPE: "Music Venue", SUMMARY: "Adams Morgan venue hosting ticketed concerts and DJ sets." }, geometry: { type: "Point", coordinates: [-77.0441, 38.9217] } },
    { type: "Feature", properties: { NAME: "Capital Turnaround", TYPE: "Performance Venue", SUMMARY: "Multi-use event hall in Navy Yard for concerts, comedy, and special productions." }, geometry: { type: "Point", coordinates: [-77.0023, 38.8769] } }
  ]
};

const liveMusicData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "Blues Alley", TYPE: "Jazz Supper Club", SUMMARY: "Georgetown's landmark jazz supper club with seated table service and intimate nightly shows.", NEIGHBORHOOD: "Georgetown" }, geometry: { type: "Point", coordinates: [-77.0635, 38.9049] } },
    { type: "Feature", properties: { NAME: "JoJo Restaurant & Bar", TYPE: "Jazz & Blues Restaurant", SUMMARY: "U Street restaurant with dinner service and live jazz, blues, and soul in a close-up dining-room setting.", NEIGHBORHOOD: "U Street" }, geometry: { type: "Point", coordinates: [-77.0344, 38.9169] } },
    { type: "Feature", properties: { NAME: "Takoma Station Tavern", TYPE: "Jazz / Soul Tavern", SUMMARY: "Takoma tavern known for seated live jazz, soul, blues, and neighborhood music nights.", NEIGHBORHOOD: "Takoma" }, geometry: { type: "Point", coordinates: [-77.0181, 38.9748] } },
    { type: "Feature", properties: { NAME: "Green Island Cafe", TYPE: "Jazz Cafe", SUMMARY: "Adams Morgan cafe and bar carrying forward Columbia Station-style jazz jams in a small, low-key room.", NEIGHBORHOOD: "Adams Morgan" }, geometry: { type: "Point", coordinates: [-77.0422, 38.9213] } },
    { type: "Feature", properties: { NAME: "Georgia Brown's", TYPE: "Jazz Brunch Restaurant", SUMMARY: "Downtown Southern restaurant with a long-running Sunday jazz brunch tradition.", NEIGHBORHOOD: "Downtown" }, geometry: { type: "Point", coordinates: [-77.0338, 38.9023] } },
    { type: "Feature", properties: { NAME: "Bonne Vie Cafe & Bistro", TYPE: "Jazz Brunch / Bistro", SUMMARY: "U Street / Dupont bistro with gypsy-jazz weekend brunch programming and seated dining.", NEIGHBORHOOD: "U Street" }, geometry: { type: "Point", coordinates: [-77.0374, 38.9169] } },
    { type: "Feature", properties: { NAME: "Mr. Henry's", TYPE: "Jazz Pub", SUMMARY: "Capitol Hill pub with a historic upstairs music room and recurring jazz performances.", NEIGHBORHOOD: "Capitol Hill" }, geometry: { type: "Point", coordinates: [-76.9958, 38.8846] } },
    { type: "Feature", properties: { NAME: "St. Vincent Wine", TYPE: "Wine Garden / Jazz Brunch", SUMMARY: "Park View wine garden and cocktail bar with Sunday jazz brunch and seated live music programming.", NEIGHBORHOOD: "Park View" }, geometry: { type: "Point", coordinates: [-77.0237, 38.9309] } },
    { type: "Feature", properties: { NAME: "Bar Angie", TYPE: "Restaurant Lounge", SUMMARY: "West End restaurant lounge with dinner and brunch service plus recurring live jazz and lounge music.", NEIGHBORHOOD: "West End" }, geometry: { type: "Point", coordinates: [-77.0502, 38.9074] } },
    { type: "Feature", properties: { NAME: "CUT Above at Rosewood Washington DC", TYPE: "Jazz Brunch / Hotel Lounge", SUMMARY: "Georgetown hotel lounge and restaurant space associated with Sunday jazz brunch programming.", NEIGHBORHOOD: "Georgetown" }, geometry: { type: "Point", coordinates: [-77.0598, 38.9048] } },
    { type: "Feature", properties: { NAME: "The Hamilton Live", TYPE: "Supper Club / Listening Room", SUMMARY: "Downtown seated live room with dinner service and a calendar spanning jazz, roots, soul, and singer-songwriters.", NEIGHBORHOOD: "Downtown" }, geometry: { type: "Point", coordinates: [-77.0318, 38.8975] } },
    { type: "Feature", properties: { NAME: "Pearl Street Warehouse", TYPE: "Listening Room", SUMMARY: "Wharf music room with seated dinner-show style options for Americana, blues, roots, and singer-songwriter sets.", NEIGHBORHOOD: "The Wharf" }, geometry: { type: "Point", coordinates: [-77.0270, 38.8787] } },
    { type: "Feature", properties: { NAME: "Tabard Inn", TYPE: "Hotel Restaurant / Jazz Brunch", SUMMARY: "Dupont hotel restaurant with an intimate dining-room feel and periodic jazz brunch or live music programming.", NEIGHBORHOOD: "Dupont Circle" }, geometry: { type: "Point", coordinates: [-77.0390, 38.9077] } },
    { type: "Feature", properties: { NAME: "Marx Cafe", TYPE: "Cafe / Jazz Jam", SUMMARY: "Mount Pleasant cafe and bar associated with neighborhood jazz jams and intimate live music nights.", NEIGHBORHOOD: "Mount Pleasant" }, geometry: { type: "Point", coordinates: [-77.0388, 38.9317] } }
  ]
};

const comedyVenuesData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "DC Improv Comedy Club", TYPE: "Comedy Club", SUMMARY: "DC's flagship dedicated comedy club on Connecticut Avenue, booking national touring comics, showcases, classes, and open mics.", NEIGHBORHOOD: "Downtown" }, geometry: { type: "Point", coordinates: [-77.0412, 38.9043] } },
    { type: "Feature", properties: { NAME: "The DC Comedy Loft", TYPE: "Comedy Club", SUMMARY: "Dedicated comedy room above Bier Baron with frequent local and touring stand-up shows.", NEIGHBORHOOD: "Dupont Circle" }, geometry: { type: "Point", coordinates: [-77.0419, 38.9139] } },
    { type: "Feature", properties: { NAME: "Room 808 (DC Comedy Clubhouse)", TYPE: "Comedy Venue", SUMMARY: "Independent venue for stand-up showcases, indie productions, and open mics.", NEIGHBORHOOD: "Petworth" }, geometry: { type: "Point", coordinates: [-77.0238, 38.9334] } },
    { type: "Feature", properties: { NAME: "Hotbed Comedy Club", TYPE: "Comedy Club", SUMMARY: "Adams Morgan comedy club and home base for Underground Comedy, with frequent local showcases and late-night stand-up.", NEIGHBORHOOD: "Adams Morgan" }, geometry: { type: "Point", coordinates: [-77.0428, 38.9228] } },
    { type: "Feature", properties: { NAME: "Comedy Club DC at Ethio Vegan", TYPE: "Comedy Night Venue", SUMMARY: "Recurring DC Comedy Showcase room upstairs at Ethio Vegan on H Street NE.", NEIGHBORHOOD: "H Street NE" }, geometry: { type: "Point", coordinates: [-76.9857, 38.9001] } },
    { type: "Feature", properties: { NAME: "Capital Laughs", TYPE: "Comedy Venue", SUMMARY: "Small-format comedy room hosting local lineups and monthly showcases.", NEIGHBORHOOD: "Downtown" }, geometry: { type: "Point", coordinates: [-77.0288, 38.9059] } },
    { type: "Feature", properties: { NAME: "Wonderland Ballroom", TYPE: "Comedy Night Venue", SUMMARY: "Columbia Heights bar with recurring Underground Comedy and open-mic stand-up nights.", NEIGHBORHOOD: "Columbia Heights" }, geometry: { type: "Point", coordinates: [-77.0277, 38.9297] } },
    { type: "Feature", properties: { NAME: "Reliable Tavern", TYPE: "Comedy Night Venue", SUMMARY: "Petworth / Park View bar used by Underground Comedy for independent stand-up shows.", NEIGHBORHOOD: "Park View" }, geometry: { type: "Point", coordinates: [-77.0252, 38.9356] } },
    { type: "Feature", properties: { NAME: "Wild Days at Eaton DC", TYPE: "Comedy Night Venue", SUMMARY: "Rooftop bar and event space that has hosted Underground Comedy and pop-up stand-up shows.", NEIGHBORHOOD: "Downtown" }, geometry: { type: "Point", coordinates: [-77.0287, 38.9026] } },
    { type: "Feature", properties: { NAME: "Arlington Drafthouse (near DC)", TYPE: "Comedy Club", SUMMARY: "Regional comedy destination frequently booking touring comics for DMV audiences.", NEIGHBORHOOD: "Arlington" }, geometry: { type: "Point", coordinates: [-77.1040, 38.8793] } },
    { type: "Feature", properties: { NAME: "Kennedy Center (Comedy Programming)", TYPE: "Performance Venue", SUMMARY: "Hosts ticketed stand-up and comedic performances as part of broader programming.", NEIGHBORHOOD: "Foggy Bottom" }, geometry: { type: "Point", coordinates: [-77.0560, 38.8954] } },
    { type: "Feature", properties: { NAME: "Warner Theatre (Comedy Tours)", TYPE: "Theater", SUMMARY: "Large theater that regularly books major stand-up comedy tours.", NEIGHBORHOOD: "Penn Quarter" }, geometry: { type: "Point", coordinates: [-77.0305, 38.8961] } },
    { type: "Feature", properties: { NAME: "Lincoln Theatre (Comedy Shows)", TYPE: "Theater", SUMMARY: "Historic venue on U Street with recurring stand-up and comedy special events.", NEIGHBORHOOD: "U Street" }, geometry: { type: "Point", coordinates: [-77.0240, 38.9175] } },
    { type: "Feature", properties: { NAME: "Capital Turnaround (Comedy Nights)", TYPE: "Performance Venue", SUMMARY: "Navy Yard venue that occasionally hosts stand-up showcases and comedy podcasts.", NEIGHBORHOOD: "Navy Yard" }, geometry: { type: "Point", coordinates: [-77.0023, 38.8769] } },
    { type: "Feature", properties: { NAME: "Union Stage", TYPE: "Music & Comedy Venue", SUMMARY: "Wharf venue with a range of comedy, podcasts, open mics, drag, and live entertainment alongside concerts.", NEIGHBORHOOD: "The Wharf" }, geometry: { type: "Point", coordinates: [-77.0269, 38.8790] } },
    { type: "Feature", properties: { NAME: "Miracle Theatre", TYPE: "Theater", SUMMARY: "Capitol Hill theater and live events room that hosts touring comics and spoken-word comedy programming.", NEIGHBORHOOD: "Capitol Hill" }, geometry: { type: "Point", coordinates: [-76.9958, 38.8823] } },
    { type: "Feature", properties: { NAME: "Howard Theatre", TYPE: "Music & Comedy Venue", SUMMARY: "Historic Shaw theater that books national comedy acts in addition to concerts and cultural programming.", NEIGHBORHOOD: "Shaw" }, geometry: { type: "Point", coordinates: [-77.0219, 38.9164] } },
    { type: "Feature", properties: { NAME: "Black Cat", TYPE: "Music & Comedy Venue", SUMMARY: "14th Street venue best known for music but also hosts stand-up comedy and comedy-adjacent performances.", NEIGHBORHOOD: "14th Street" }, geometry: { type: "Point", coordinates: [-77.0316, 38.9150] } },
    { type: "Feature", properties: { NAME: "The Hamilton Live (Comedy Sets)", TYPE: "Music & Comedy Venue", SUMMARY: "Downtown live venue featuring periodic comedy nights and touring acts.", NEIGHBORHOOD: "Downtown" }, geometry: { type: "Point", coordinates: [-77.0318, 38.8975] } },
    { type: "Feature", properties: { NAME: "Aura Bar & Lounge", TYPE: "Comedy Night Venue", SUMMARY: "U Street lounge with recurring free stand-up comedy nights and local showcases.", NEIGHBORHOOD: "U Street" }, geometry: { type: "Point", coordinates: [-77.0274, 38.9172] } },
    { type: "Feature", properties: { NAME: "City-State Public House", TYPE: "Comedy Night Venue", SUMMARY: "Edgewood beer hall / public house listed for recurring comedy open mic programming.", NEIGHBORHOOD: "Edgewood" }, geometry: { type: "Point", coordinates: [-77.0115, 38.9238] } },
    { type: "Feature", properties: { NAME: "Haydee's Restaurant", TYPE: "Comedy Night Venue", SUMMARY: "Mount Pleasant neighborhood bar and restaurant with recurring stand-up open mic listings.", NEIGHBORHOOD: "Mount Pleasant" }, geometry: { type: "Point", coordinates: [-77.0386, 38.9312] } },
    { type: "Feature", properties: { NAME: "Madam's Organ", TYPE: "Comedy Night Venue", SUMMARY: "Adams Morgan bar and music venue that appears in DC stand-up open mic listings.", NEIGHBORHOOD: "Adams Morgan" }, geometry: { type: "Point", coordinates: [-77.0420, 38.9216] } },
    { type: "Feature", properties: { NAME: "BloomBars", TYPE: "Comedy Night Venue", SUMMARY: "Columbia Heights arts space with comedy and open-mic programming among community performances.", NEIGHBORHOOD: "Columbia Heights" }, geometry: { type: "Point", coordinates: [-77.0283, 38.9294] } },
    { type: "Feature", properties: { NAME: "Cafe Saint-Ex", TYPE: "Comedy Night Venue", SUMMARY: "14th Street bar and cafe with recurring stand-up open mic listings.", NEIGHBORHOOD: "14th Street" }, geometry: { type: "Point", coordinates: [-77.0317, 38.9143] } },
    { type: "Feature", properties: { NAME: "Fat Pete's BBQ", TYPE: "Comedy Night Venue", SUMMARY: "Cleveland Park barbecue restaurant and bar with recurring Sunday comedy open mic listings.", NEIGHBORHOOD: "Cleveland Park" }, geometry: { type: "Point", coordinates: [-77.0621, 38.9345] } },
    { type: "Feature", properties: { NAME: "Tonic at Quigley's", TYPE: "Comedy Night Venue", SUMMARY: "Foggy Bottom tavern with stage space and recurring comedy/open mic history.", NEIGHBORHOOD: "Foggy Bottom" }, geometry: { type: "Point", coordinates: [-77.0489, 38.8996] } },
    { type: "Feature", properties: { NAME: "Sudhouse DC", TYPE: "Comedy Night Venue", SUMMARY: "U Street sports bar included in current DC stand-up open mic listings.", NEIGHBORHOOD: "U Street" }, geometry: { type: "Point", coordinates: [-77.0285, 38.9173] } },
    { type: "Feature", properties: { NAME: "The Artemis", TYPE: "Comedy Night Venue", SUMMARY: "Columbia Heights sports bar with recurring open mic comedy programming.", NEIGHBORHOOD: "Columbia Heights" }, geometry: { type: "Point", coordinates: [-77.0323, 38.9362] } }
  ]
};

const festivalsParadesData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "National Cherry Blossom Festival", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Citywide spring celebration of the cherry blossoms with cultural programs, performances, and signature events." }, geometry: { type: "Point", coordinates: [-77.0365, 38.8848] } },
    { type: "Feature", properties: { NAME: "National Cherry Blossom Festival Parade", TYPE: "Parade", SEASON: "Spring", SUMMARY: "Signature Constitution Avenue parade route and festivities tied to the Cherry Blossom Festival." }, geometry: { type: "Point", coordinates: [-77.0283, 38.8921] } },
    { type: "Feature", properties: { NAME: "Blossom Kite Festival", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Annual kite festival on the National Mall during cherry blossom season." }, geometry: { type: "Point", coordinates: [-77.0353, 38.8895] } },
    { type: "Feature", properties: { NAME: "National Cherry Blossom Festival Petalpalooza", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Riverfront cherry blossom celebration with live music, art, family activities, and fireworks at The Yards." }, geometry: { type: "Point", coordinates: [-77.0007, 38.8732] } },
    { type: "Feature", properties: { NAME: "Sakura Matsuri - Japanese Street Festival", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Large Japanese cultural street festival held downtown during cherry blossom season." }, geometry: { type: "Point", coordinates: [-77.0194, 38.8928] } },
    { type: "Feature", properties: { NAME: "Anacostia River Festival", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Riverfront arts and recreation festival focused on ecology, water access, and community." }, geometry: { type: "Point", coordinates: [-76.9652, 38.8722] } },
    { type: "Feature", properties: { NAME: "Georgetown French Market", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Annual open-air French-inspired market with neighborhood shops, food, music, and sidewalk activations." }, geometry: { type: "Point", coordinates: [-77.0660, 38.9121] } },
    { type: "Feature", properties: { NAME: "Petworth PorchFest", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Neighborhood music festival with local bands performing from porches, yards, and community stages." }, geometry: { type: "Point", coordinates: [-77.0258, 38.9416] } },
    { type: "Feature", properties: { NAME: "Flower Mart at Washington National Cathedral", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Long-running spring festival and fundraiser with flowers, crafts, food, music, and family activities." }, geometry: { type: "Point", coordinates: [-77.0703, 38.9306] } },
    { type: "Feature", properties: { NAME: "Passport DC", TYPE: "Festival", SEASON: "May", SUMMARY: "Month-long international culture festival anchored by embassy open houses, performances, and cultural showcases." }, geometry: { type: "Point", coordinates: [-77.0469, 38.9072] } },
    { type: "Feature", properties: { NAME: "Around the World Embassy Tour", TYPE: "Festival", SEASON: "May", SUMMARY: "Passport DC open house day when embassies across the city welcome visitors with cultural programming." }, geometry: { type: "Point", coordinates: [-77.0501, 38.9120] } },
    { type: "Feature", properties: { NAME: "EU Open House", TYPE: "Festival", SEASON: "May", SUMMARY: "European Union embassy open house day with cultural exhibits, food, performances, and family activities." }, geometry: { type: "Point", coordinates: [-77.0465, 38.9141] } },
    { type: "Feature", properties: { NAME: "Fiesta Asia / National Asian Heritage Festival", TYPE: "Festival", SEASON: "May", SUMMARY: "Pan-Asian heritage street festival with cultural parade elements, performances, food, and marketplace vendors." }, geometry: { type: "Point", coordinates: [-77.0185, 38.8927] } },
    { type: "Feature", properties: { NAME: "DC JazzFest (The Wharf)", TYPE: "Festival", SEASON: "Late Summer", SUMMARY: "Multi-day citywide jazz festival with major performances around The Wharf and nearby venues." }, geometry: { type: "Point", coordinates: [-77.0262, 38.8797] } },
    { type: "Feature", properties: { NAME: "Smithsonian Folklife Festival", TYPE: "Festival", SEASON: "Summer", SUMMARY: "Annual National Mall festival celebrating cultural traditions from communities around the world." }, geometry: { type: "Point", coordinates: [-77.0255, 38.8887] } },
    { type: "Feature", properties: { NAME: "Giant National Capital BBQ Battle", TYPE: "Festival", SEASON: "June", SUMMARY: "Large food and music festival on Pennsylvania Avenue with barbecue competitions, samples, and entertainment." }, geometry: { type: "Point", coordinates: [-77.0186, 38.8926] } },
    { type: "Feature", properties: { NAME: "Capital Pride Festival & Concert", TYPE: "Festival", SEASON: "June", SUMMARY: "Flagship Pride celebration with performances and community organizations in the downtown core." }, geometry: { type: "Point", coordinates: [-77.0283, 38.9014] } },
    { type: "Feature", properties: { NAME: "Capital Pride Parade", TYPE: "Parade", SEASON: "June", SUMMARY: "Annual Pride parade route through central DC, drawing large crowds and community groups." }, geometry: { type: "Point", coordinates: [-77.0419, 38.9096] } },
    { type: "Feature", properties: { NAME: "DC Black Pride", TYPE: "Festival", SEASON: "May", SUMMARY: "Annual Black LGBTQ+ Pride weekend with cultural, wellness, nightlife, and community events around DC." }, geometry: { type: "Point", coordinates: [-77.0238, 38.9016] } },
    { type: "Feature", properties: { NAME: "DC Diaspora Caribbean Carnival Parade & Festival", TYPE: "Parade & Festival", SEASON: "June", SUMMARY: "Caribbean culture parade and festival with music, costumes, vendors, and performances downtown." }, geometry: { type: "Point", coordinates: [-77.0264, 38.8925] } },
    { type: "Feature", properties: { NAME: "Broccoli City Festival", TYPE: "Festival", SEASON: "Spring", SUMMARY: "Music and culture festival focused on sustainability, community programming, and contemporary Black culture." }, geometry: { type: "Point", coordinates: [-77.0125, 38.8683] } },
    { type: "Feature", properties: { NAME: "A Taste of the DMV", TYPE: "Festival", SEASON: "June", SUMMARY: "Food, music, and community festival highlighting restaurants and makers from across the DMV." }, geometry: { type: "Point", coordinates: [-77.0186, 38.8926] } },
    { type: "Feature", properties: { NAME: "Taste of DC", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Culinary and cultural festival showcasing local restaurants, drinks, music, and food experiences." }, geometry: { type: "Point", coordinates: [-76.9718, 38.8898] } },
    { type: "Feature", properties: { NAME: "Juneteenth for the City", TYPE: "Festival", SEASON: "June", SUMMARY: "Community Juneteenth celebration in Anacostia with music, food, services, and neighborhood programming." }, geometry: { type: "Point", coordinates: [-76.9797, 38.8667] } },
    { type: "Feature", properties: { NAME: "National Memorial Day Parade", TYPE: "Parade", SEASON: "May", SUMMARY: "Major national parade on Constitution Avenue honoring military service members and veterans." }, geometry: { type: "Point", coordinates: [-77.0288, 38.8922] } },
    { type: "Feature", properties: { NAME: "National Independence Day Parade", TYPE: "Parade", SEASON: "July", SUMMARY: "Annual July 4th parade along Constitution Avenue with bands, floats, military units, and patriotic displays." }, geometry: { type: "Point", coordinates: [-77.0288, 38.8922] } },
    { type: "Feature", properties: { NAME: "National Mall Fourth of July Celebration", TYPE: "Festival", SEASON: "July", SUMMARY: "Independence Day gathering on the National Mall with concerts, public celebrations, and fireworks." }, geometry: { type: "Point", coordinates: [-77.0365, 38.8895] } },
    { type: "Feature", properties: { NAME: "National Archives July 4th Celebration", TYPE: "Festival", SEASON: "July", SUMMARY: "Annual Independence Day celebration and Declaration of Independence reading outside the National Archives." }, geometry: { type: "Point", coordinates: [-77.0230, 38.8929] } },
    { type: "Feature", properties: { NAME: "National Book Festival", TYPE: "Festival", SEASON: "Late Summer", SUMMARY: "Library of Congress book festival with authors, talks, signings, and family programming." }, geometry: { type: "Point", coordinates: [-77.0231, 38.9049] } },
    { type: "Feature", properties: { NAME: "African American Heritage Festival", TYPE: "Festival", SEASON: "August", SUMMARY: "Downtown cultural festival celebrating African American heritage with music, vendors, food, and community programming." }, geometry: { type: "Point", coordinates: [-77.0186, 38.8926] } },
    { type: "Feature", properties: { NAME: "DC AfroLatino Festival", TYPE: "Festival", SEASON: "August", SUMMARY: "Cultural festival celebrating Afro-Latino music, food, art, and community in Adams Morgan." }, geometry: { type: "Point", coordinates: [-77.0437, 38.9227] } },
    { type: "Feature", properties: { NAME: "Washington Chinese Culture Festival", TYPE: "Festival", SEASON: "August", SUMMARY: "Annual Chinese cultural festival with performances, exhibits, food, and community organizations downtown." }, geometry: { type: "Point", coordinates: [-77.0166, 38.8930] } },
    { type: "Feature", properties: { NAME: "Panda Fest DC", TYPE: "Festival", SEASON: "August", SUMMARY: "Asian food and culture festival with performances, vendors, and family-friendly programming downtown." }, geometry: { type: "Point", coordinates: [-77.0186, 38.8926] } },
    { type: "Feature", properties: { NAME: "Adams Morgan Day", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Historic neighborhood festival featuring live music, restaurants, art, and local vendors." }, geometry: { type: "Point", coordinates: [-77.0436, 38.9226] } },
    { type: "Feature", properties: { NAME: "Adams Morgan PorchFest", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Neighborhood music festival with bands performing across porch and storefront stages in Adams Morgan." }, geometry: { type: "Point", coordinates: [-77.0436, 38.9226] } },
    { type: "Feature", properties: { NAME: "H Street Festival", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Large neighborhood street festival along the H Street NE corridor with music, food, art, vendors, and performances." }, geometry: { type: "Point", coordinates: [-76.9958, 38.9002] } },
    { type: "Feature", properties: { NAME: "Fiesta DC Festival & Parade", TYPE: "Parade & Festival", SEASON: "Fall", SUMMARY: "Long-running Latino heritage festival and Parade of Nations celebrating cultures from across the Americas." }, geometry: { type: "Point", coordinates: [-77.0264, 38.8925] } },
    { type: "Feature", properties: { NAME: "Turkish Festival", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Annual Pennsylvania Avenue cultural festival with Turkish food, music, dance, art, and community vendors." }, geometry: { type: "Point", coordinates: [-77.0185, 38.8927] } },
    { type: "Feature", properties: { NAME: "Sawasdee DC Thai Festival", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Thai cultural festival on the National Mall with food, music, dance, demonstrations, and interactive workshops." }, geometry: { type: "Point", coordinates: [-77.0214, 38.8890] } },
    { type: "Feature", properties: { NAME: "Around The World Cultural Food Festival", TYPE: "Festival", SEASON: "Summer", SUMMARY: "Outdoor cultural food festival featuring international cuisines, crafts, and performances." }, geometry: { type: "Point", coordinates: [-77.0308, 38.8959] } },
    { type: "Feature", properties: { NAME: "Barracks Row Fall Festival", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Neighborhood street festival on Capitol Hill with local businesses, food, and family activities." }, geometry: { type: "Point", coordinates: [-76.9954, 38.8803] } },
    { type: "Feature", properties: { NAME: "20th Street Festival", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Dupont Circle neighborhood street festival with local businesses, vendors, entertainment, and community groups." }, geometry: { type: "Point", coordinates: [-77.0447, 38.9111] } },
    { type: "Feature", properties: { NAME: "Funk Parade", TYPE: "Parade", SEASON: "Spring", SUMMARY: "Community parade and music festival centered around U Street and historic Black music culture." }, geometry: { type: "Point", coordinates: [-77.0338, 38.9161] } },
    { type: "Feature", properties: { NAME: "Martin Luther King Jr. Holiday Peace Walk and Parade", TYPE: "Parade", SEASON: "January", SUMMARY: "Annual Ward 8 peace walk and parade honoring Dr. King's legacy along the MLK Avenue corridor." }, geometry: { type: "Point", coordinates: [-76.9955, 38.8624] } },
    { type: "Feature", properties: { NAME: "Chinese New Year Parade", TYPE: "Parade", SEASON: "Winter", SUMMARY: "Chinatown Lunar New Year parade and street celebration with lion dances, firecrackers, and community groups." }, geometry: { type: "Point", coordinates: [-77.0211, 38.8995] } },
    { type: "Feature", properties: { NAME: "DC x Krewe of Pyros Mardi Gras Second Line Parade", TYPE: "Parade", SEASON: "Winter", SUMMARY: "Mardi Gras second line parade through the Penn Quarter and Chinatown area." }, geometry: { type: "Point", coordinates: [-77.0217, 38.9009] } },
    { type: "Feature", properties: { NAME: "DowntownDC Holiday Market", TYPE: "Festival", SEASON: "Winter", SUMMARY: "Seasonal open-air market with crafts, food, and performances in the Penn Quarter area." }, geometry: { type: "Point", coordinates: [-77.0265, 38.9009] } },
    { type: "Feature", properties: { NAME: "National Christmas Tree Lighting", TYPE: "Festival", SEASON: "Winter", SUMMARY: "Annual holiday lighting ceremony and seasonal display at President's Park near the White House." }, geometry: { type: "Point", coordinates: [-77.0365, 38.8959] } },
    { type: "Feature", properties: { NAME: "DC Art All Night", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Citywide overnight arts festival with activations across DC Main Streets and neighborhood corridors." }, geometry: { type: "Point", coordinates: [-77.0219, 38.9061] } },
    { type: "Feature", properties: { NAME: "DC State Fair", TYPE: "Festival", SEASON: "Fall", SUMMARY: "Annual community fair celebrating DC makers, growers, food, crafts, contests, and local culture." }, geometry: { type: "Point", coordinates: [-77.0310, 38.9019] } }
  ]
};

const festivalParadeEventDates = {
  "National Cherry Blossom Festival": { start: "03-20", end: "04-12", label: "Mar 20 - Apr 12" },
  "National Cherry Blossom Festival Parade": { start: "04-11", end: "04-11", label: "Apr 11" },
  "Blossom Kite Festival": { start: "03-28", end: "03-28", label: "Late March" },
  "National Cherry Blossom Festival Petalpalooza": { start: "04-04", end: "04-04", label: "Apr 4" },
  "Sakura Matsuri - Japanese Street Festival": { start: "04-11", end: "04-12", label: "Apr 11 - 12" },
  "Anacostia River Festival": { start: "04-19", end: "04-19", label: "April" },
  "Georgetown French Market": { start: "04-24", end: "04-26", label: "Late April" },
  "Petworth PorchFest": { start: "04-25", end: "04-25", label: "Late April" },
  "Flower Mart at Washington National Cathedral": { start: "05-01", end: "05-02", label: "Early May" },
  "Passport DC": { start: "05-01", end: "05-31", label: "May" },
  "Around the World Embassy Tour": { start: "05-02", end: "05-02", label: "Early May" },
  "EU Open House": { start: "05-09", end: "05-09", label: "May" },
  "Fiesta Asia / National Asian Heritage Festival": { start: "05-16", end: "05-16", label: "May" },
  "DC JazzFest (The Wharf)": { start: "08-26", end: "08-30", label: "Late August" },
  "Smithsonian Folklife Festival": { start: "06-24", end: "06-29", label: "Late June" },
  "Giant National Capital BBQ Battle": { start: "06-27", end: "06-28", label: "Late June" },
  "Capital Pride Festival & Concert": { start: "06-20", end: "06-21", label: "June" },
  "Capital Pride Parade": { start: "06-20", end: "06-20", label: "June" },
  "DC Black Pride": { start: "05-22", end: "05-25", label: "Memorial Day weekend" },
  "DC Diaspora Caribbean Carnival Parade & Festival": { start: "06-01", end: "06-01", label: "June" },
  "Broccoli City Festival": { start: "08-08", end: "08-09", label: "Summer" },
  "A Taste of the DMV": { start: "06-15", end: "06-15", label: "June" },
  "Taste of DC": { start: "10-10", end: "10-11", label: "Fall" },
  "Juneteenth for the City": { start: "06-19", end: "06-19", label: "Jun 19" },
  "National Memorial Day Parade": { start: "05-25", end: "05-25", label: "Memorial Day" },
  "National Independence Day Parade": { start: "07-04", end: "07-04", label: "Jul 4" },
  "National Mall Fourth of July Celebration": { start: "07-04", end: "07-04", label: "Jul 4" },
  "National Archives July 4th Celebration": { start: "07-04", end: "07-04", label: "Jul 4" },
  "National Book Festival": { start: "09-05", end: "09-05", label: "Late summer" },
  "African American Heritage Festival": { start: "08-15", end: "08-15", label: "August" },
  "DC AfroLatino Festival": { start: "08-23", end: "08-23", label: "August" },
  "Washington Chinese Culture Festival": { start: "08-30", end: "08-30", label: "August" },
  "Panda Fest DC": { start: "08-15", end: "08-16", label: "August" },
  "Adams Morgan Day": { start: "09-13", end: "09-13", label: "September" },
  "Adams Morgan PorchFest": { start: "10-25", end: "10-25", label: "Fall" },
  "H Street Festival": { start: "09-20", end: "09-20", label: "September" },
  "Fiesta DC Festival & Parade": { start: "09-26", end: "09-27", label: "Late September" },
  "Turkish Festival": { start: "10-19", end: "10-19", label: "October" },
  "Sawasdee DC Thai Festival": { start: "09-13", end: "09-13", label: "September" },
  "Around The World Cultural Food Festival": { start: "08-23", end: "08-23", label: "Summer" },
  "Barracks Row Fall Festival": { start: "09-27", end: "09-27", label: "Fall" },
  "20th Street Festival": { start: "11-08", end: "11-08", label: "November" },
  "Funk Parade": { start: "05-10", end: "05-10", label: "Spring" },
  "Martin Luther King Jr. Holiday Peace Walk and Parade": { start: "01-19", end: "01-19", label: "MLK Day" },
  "Chinese New Year Parade": { start: "02-22", end: "02-22", label: "Lunar New Year" },
  "DC x Krewe of Pyros Mardi Gras Second Line Parade": { start: "01-31", end: "01-31", label: "Mardi Gras season" },
  "DowntownDC Holiday Market": { start: "11-20", end: "12-23", label: "Holiday season" },
  "National Christmas Tree Lighting": { start: "12-03", end: "12-03", label: "Early December" },
  "DC Art All Night": { start: "09-12", end: "09-13", label: "September" },
  "DC State Fair": { start: "09-06", end: "09-06", label: "September" }
};

const getAnnualEventDate = (monthDay, year) => {
  if (!monthDay) return null;
  const [month, day] = monthDay.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getFestivalParadeTiming = (feature, now = new Date()) => {
  const event = festivalParadeEventDates[feature.properties?.NAME];
  if (!event) {
    return {
      fillColor: '#f97316',
      strokeColor: '#fcd34d',
      label: feature.properties?.SEASON || '',
      status: 'Date varies by year'
    };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = getAnnualEventDate(event.start, today.getFullYear());
  const endDate = getAnnualEventDate(event.end || event.start, today.getFullYear());
  const dayMs = 24 * 60 * 60 * 1000;
  const daysUntilStart = Math.ceil((startDate - today) / dayMs);
  const daysSinceEnd = Math.floor((today - endDate) / dayMs);

  if (daysSinceEnd > 0) {
    return {
      fillColor: '#2563eb',
      strokeColor: '#93c5fd',
      label: event.label,
      status: `Passed ${daysSinceEnd === 1 ? 'yesterday' : `${daysSinceEnd} days ago`}`
    };
  }

  if (daysUntilStart <= 0) {
    return {
      fillColor: '#dc2626',
      strokeColor: '#fecaca',
      label: event.label,
      status: 'Happening now'
    };
  }

  const closeness = Math.max(0, Math.min(1, 1 - (daysUntilStart / 90)));
  const start = { r: 245, g: 158, b: 11 };
  const end = { r: 220, g: 38, b: 38 };
  const channel = (from, to) => Math.round(from + ((to - from) * closeness));
  const fillColor = `rgb(${channel(start.r, end.r)}, ${channel(start.g, end.g)}, ${channel(start.b, end.b)})`;

  return {
    fillColor,
    strokeColor: closeness > 0.7 ? '#fecaca' : '#fcd34d',
    label: event.label,
    status: daysUntilStart === 1 ? 'Tomorrow' : `${daysUntilStart} days away`
  };
};

const breweriesDistilleriesData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "DC Brau Brewing Company", TYPE: "Brewery", SUMMARY: "One of DC's flagship production breweries with taproom and frequent public events.", NEIGHBORHOOD: "Ivy City" }, geometry: { type: "Point", coordinates: [-76.9834, 38.9138] } },
    { type: "Feature", properties: { NAME: "Atlas Brew Works (Ivy City)", TYPE: "Brewery", SUMMARY: "Local brewery known for district-focused beers and a central taproom in Ivy City.", NEIGHBORHOOD: "Ivy City" }, geometry: { type: "Point", coordinates: [-76.9857, 38.9150] } },
    { type: "Feature", properties: { NAME: "Right Proper Brewing (Brookland Production House)", TYPE: "Brewery", SUMMARY: "Production brewery and taproom serving rotating small-batch beers.", NEIGHBORHOOD: "Brookland" }, geometry: { type: "Point", coordinates: [-76.9851, 38.9195] } },
    { type: "Feature", properties: { NAME: "Bluejacket", TYPE: "Brewery", SUMMARY: "Navy Yard brewery and restaurant with a broad house beer program.", NEIGHBORHOOD: "Navy Yard" }, geometry: { type: "Point", coordinates: [-77.0074, 38.8785] } },
    { type: "Feature", properties: { NAME: "Solace Outpost", TYPE: "Brewery", SUMMARY: "DC outpost of Solace Brewing at Bryant Street with on-site beers and food.", NEIGHBORHOOD: "Edgewood" }, geometry: { type: "Point", coordinates: [-77.0008, 38.9274] } },
    { type: "Feature", properties: { NAME: "Red Bear Brewing Co.", TYPE: "Brewery", SUMMARY: "LGBTQ-owned brewery and pub in NoMa near Union Market.", NEIGHBORHOOD: "NoMa" }, geometry: { type: "Point", coordinates: [-77.0032, 38.9037] } },
    { type: "Feature", properties: { NAME: "City-State Brewing", TYPE: "Brewery", SUMMARY: "Craft brewery and beer hall with local events and outdoor seating.", NEIGHBORHOOD: "Edgewood" }, geometry: { type: "Point", coordinates: [-77.0115, 38.9238] } },
    { type: "Feature", properties: { NAME: "Other Half Brewing (DC)", TYPE: "Brewery", SUMMARY: "Large brewery and taproom near the waterfront serving rotating IPA-focused drafts.", NEIGHBORHOOD: "Navy Yard" }, geometry: { type: "Point", coordinates: [-77.0000, 38.8718] } },
    { type: "Feature", properties: { NAME: "Cotton & Reed", TYPE: "Distillery", SUMMARY: "Rum-focused distillery known for tastings, cocktails, and private bottlings.", NEIGHBORHOOD: "Union Market" }, geometry: { type: "Point", coordinates: [-76.9906, 38.9084] } },
    { type: "Feature", properties: { NAME: "Republic Restoratives Distillery", TYPE: "Distillery", SUMMARY: "Woman-owned distillery producing vodka, gin, and bourbon in Ivy City.", NEIGHBORHOOD: "Ivy City" }, geometry: { type: "Point", coordinates: [-76.9863, 38.9158] } },
    { type: "Feature", properties: { NAME: "District Made Spirits", TYPE: "Distillery", SUMMARY: "Small-batch spirits distillery and tasting room near Union Market.", NEIGHBORHOOD: "Union Market" }, geometry: { type: "Point", coordinates: [-76.9900, 38.9068] } },
    { type: "Feature", properties: { NAME: "Don Ciccio & Figli", TYPE: "Distillery", SUMMARY: "Italian liqueur distillery with guided tastings and production tours.", NEIGHBORHOOD: "Ivy City" }, geometry: { type: "Point", coordinates: [-76.9859, 38.9138] } }
  ]
};

const rentControlBuildingsData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "The Cairo", TYPE: "Apartment Building", YEAR_BUILT: 1894, SUMMARY: "Historic Columbia Heights apartment building commonly cited among older multifamily stock likely covered by DC rent stabilization.", NEIGHBORHOOD: "Columbia Heights" }, geometry: { type: "Point", coordinates: [-77.0333, 38.9232] } },
    { type: "Feature", properties: { NAME: "The Chastleton", TYPE: "Apartment Building", YEAR_BUILT: 1920, SUMMARY: "Large pre-1975 multifamily building in Dupont/Logan area; representative of rent-stabilized-era housing.", NEIGHBORHOOD: "Dupont Circle" }, geometry: { type: "Point", coordinates: [-77.0398, 38.9151] } },
    { type: "Feature", properties: { NAME: "The Woodner", TYPE: "Apartment Building", YEAR_BUILT: 1952, SUMMARY: "High-rise multifamily property near Rock Creek Park, representative of rent-control-era inventory.", NEIGHBORHOOD: "Woodley Park" }, geometry: { type: "Point", coordinates: [-77.0510, 38.9231] } },
    { type: "Feature", properties: { NAME: "Ontario 17", TYPE: "Apartment Building", YEAR_BUILT: 1905, SUMMARY: "Historic Adams Morgan apartment building representative of older rental stock potentially subject to rent stabilization.", NEIGHBORHOOD: "Adams Morgan" }, geometry: { type: "Point", coordinates: [-77.0417, 38.9222] } },
    { type: "Feature", properties: { NAME: "The Westchester", TYPE: "Apartment Cooperative", YEAR_BUILT: 1931, SUMMARY: "Large prewar complex in upper Northwest; included as representative long-standing multifamily housing.", NEIGHBORHOOD: "Cathedral Heights" }, geometry: { type: "Point", coordinates: [-77.0785, 38.9257] } },
    { type: "Feature", properties: { NAME: "The Kennedy-Warren", TYPE: "Apartment Building", YEAR_BUILT: 1931, SUMMARY: "Art deco apartment building near Cleveland Park that exemplifies older multifamily stock.", NEIGHBORHOOD: "Cleveland Park" }, geometry: { type: "Point", coordinates: [-77.0537, 38.9344] } },
    { type: "Feature", properties: { NAME: "Park Pleasant", TYPE: "Apartment Building", YEAR_BUILT: 1959, SUMMARY: "Mid-century large apartment complex in Ward 1; representative of rent-stabilized-era housing forms.", NEIGHBORHOOD: "Pleasant Plains" }, geometry: { type: "Point", coordinates: [-77.0264, 38.9351] } },
    { type: "Feature", properties: { NAME: "Park Van Ness", TYPE: "Apartment Building", YEAR_BUILT: 1964, SUMMARY: "High-rise apartment building in Van Ness, representative of pre-1976 rental inventory.", NEIGHBORHOOD: "Van Ness" }, geometry: { type: "Point", coordinates: [-77.0755, 38.9448] } },
    { type: "Feature", properties: { NAME: "The Argonne", TYPE: "Apartment Building", YEAR_BUILT: 1936, SUMMARY: "Historic rental property in upper Connecticut Avenue corridor.", NEIGHBORHOOD: "Cleveland Park" }, geometry: { type: "Point", coordinates: [-77.0541, 38.9367] } },
    { type: "Feature", properties: { NAME: "The Altamont", TYPE: "Apartment Building", YEAR_BUILT: 1916, SUMMARY: "Early 20th-century apartment building near Kalorama/Adams Morgan.", NEIGHBORHOOD: "Kalorama" }, geometry: { type: "Point", coordinates: [-77.0450, 38.9197] } }
  ]
};

const publicHousingData = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { NAME: "Benning Terrace", TYPE: "Public Housing Community", SUMMARY: "Large DCHA public-housing community in Ward 7.", WARD: "Ward 7" }, geometry: { type: "Point", coordinates: [-76.9425, 38.8948] } },
    { type: "Feature", properties: { NAME: "Barry Farm", TYPE: "Public Housing Community", SUMMARY: "Historic public-housing site undergoing long-term redevelopment planning.", WARD: "Ward 8" }, geometry: { type: "Point", coordinates: [-76.9986, 38.8618] } },
    { type: "Feature", properties: { NAME: "Greenleaf Gardens", TYPE: "Public Housing Community", SUMMARY: "Southwest public-housing community and New Communities redevelopment focus area.", WARD: "Ward 6" }, geometry: { type: "Point", coordinates: [-77.0188, 38.8726] } },
    { type: "Feature", properties: { NAME: "Kenilworth Courts", TYPE: "Public Housing Community", SUMMARY: "Public-housing complex in Northeast near the Anacostia River corridor.", WARD: "Ward 7" }, geometry: { type: "Point", coordinates: [-76.9409, 38.9107] } },
    { type: "Feature", properties: { NAME: "Park Morton", TYPE: "Public Housing Community", SUMMARY: "Ward 1 public-housing site included in mixed-income redevelopment efforts.", WARD: "Ward 1" }, geometry: { type: "Point", coordinates: [-77.0247, 38.9300] } },
    { type: "Feature", properties: { NAME: "Lincoln Heights", TYPE: "Public Housing Community", SUMMARY: "Public-housing neighborhood in Ward 7 often discussed with nearby Richardson Dwellings.", WARD: "Ward 7" }, geometry: { type: "Point", coordinates: [-76.9385, 38.8938] } },
    { type: "Feature", properties: { NAME: "Richardson Dwellings", TYPE: "Public Housing Community", SUMMARY: "Adjacent to Lincoln Heights; part of longstanding affordable/public housing inventory.", WARD: "Ward 7" }, geometry: { type: "Point", coordinates: [-76.9362, 38.8937] } },
    { type: "Feature", properties: { NAME: "Highland Dwellings", TYPE: "Public Housing Community", SUMMARY: "Historic public-housing community in Ward 8.", WARD: "Ward 8" }, geometry: { type: "Point", coordinates: [-77.0125, 38.8396] } },
    { type: "Feature", properties: { NAME: "Fort Dupont Dwellings", TYPE: "Public Housing Community", SUMMARY: "Public-housing community in Southeast near Fort Dupont Park.", WARD: "Ward 7" }, geometry: { type: "Point", coordinates: [-76.9582, 38.8828] } },
    { type: "Feature", properties: { NAME: "James Creek", TYPE: "Public Housing Community", SUMMARY: "Public-housing site in Southwest / Buzzard Point area under phased redevelopment.", WARD: "Ward 6" }, geometry: { type: "Point", coordinates: [-77.0229, 38.8685] } }
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

const RELIGIOUS_CATEGORY_COLORS = {
  'Roman Catholic': '#dc2626',
  Baptist: '#2563eb',
  Methodist: '#16a34a',
  Episcopal: '#7c3aed',
  Presbyterian: '#0f766e',
  Lutheran: '#d97706',
  Orthodox: '#9333ea',
  Pentecostal: '#ea580c',
  Adventist: '#0891b2',
  "Jehovah's Witness": '#64748b',
  'Latter-day Saint': '#4f46e5',
  'Non-denominational Christian': '#db2777',
  'Other Christian': '#f59e0b',
  Jewish: '#0ea5e9',
  Muslim: '#15803d',
  Buddhist: '#eab308',
  Hindu: '#f97316',
  Sikh: '#c2410c',
  Unitarian: '#14b8a6',
  Quaker: '#84cc16',
  Other: '#6b7280'
};

const formatOsmTag = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const getReligiousCategory = (tags = {}) => {
  const religion = String(tags.religion || '').toLowerCase();
  const denomination = String(tags.denomination || tags['religion:denomination'] || '').toLowerCase();
  const name = String(tags.name || '').toLowerCase();
  const haystack = `${religion} ${denomination} ${name}`;

  if (religion === 'jewish' || haystack.includes('synagogue')) return 'Jewish';
  if (religion === 'muslim' || religion === 'islam' || haystack.includes('mosque') || haystack.includes('masjid')) return 'Muslim';
  if (religion === 'buddhist') return 'Buddhist';
  if (religion === 'hindu') return 'Hindu';
  if (religion === 'sikh') return 'Sikh';
  if (denomination.includes('unitarian')) return 'Unitarian';
  if (denomination.includes('quaker') || haystack.includes('friends meeting')) return 'Quaker';
  if (denomination.includes('roman_catholic') || denomination.includes('catholic') || haystack.includes('catholic')) return 'Roman Catholic';
  if (denomination.includes('baptist') || haystack.includes('baptist')) return 'Baptist';
  if (denomination.includes('methodist') || haystack.includes('methodist') || haystack.includes('ame ')) return 'Methodist';
  if (denomination.includes('episcopal') || haystack.includes('episcopal')) return 'Episcopal';
  if (denomination.includes('presbyterian') || haystack.includes('presbyterian')) return 'Presbyterian';
  if (denomination.includes('lutheran') || haystack.includes('lutheran')) return 'Lutheran';
  if (denomination.includes('orthodox') || haystack.includes('orthodox')) return 'Orthodox';
  if (denomination.includes('pentecostal') || haystack.includes('pentecostal')) return 'Pentecostal';
  if (denomination.includes('adventist') || haystack.includes('adventist')) return 'Adventist';
  if (denomination.includes('jehovah') || haystack.includes("jehovah's witness")) return "Jehovah's Witness";
  if (denomination.includes('mormon') || denomination.includes('latter_day_saints') || haystack.includes('latter-day')) return 'Latter-day Saint';
  if (denomination.includes('nondenominational') || denomination.includes('non_denominational') || denomination.includes('independent')) return 'Non-denominational Christian';
  if (religion === 'christian' || haystack.includes('church')) return 'Other Christian';
  return 'Other';
};

const getReligiousInstitutionStyle = (tags = {}) => {
  const category = getReligiousCategory(tags);
  const fillColor = RELIGIOUS_CATEGORY_COLORS[category] || RELIGIOUS_CATEGORY_COLORS.Other;
  return {
    category,
    fillColor,
    color: '#f5f3ff'
  };
};

const getOsmElementCoordinates = (element) => {
  if (Number.isFinite(element.lon) && Number.isFinite(element.lat)) return [element.lon, element.lat];
  if (element.center && Number.isFinite(element.center.lon) && Number.isFinite(element.center.lat)) {
    return [element.center.lon, element.center.lat];
  }
  return null;
};

const osmPlacesOfWorshipToGeoJson = (elements = []) => ({
  type: 'FeatureCollection',
  features: elements
    .map((element) => {
      const coordinates = getOsmElementCoordinates(element);
      if (!coordinates) return null;
      const tags = element.tags || {};
      return {
        type: 'Feature',
        properties: {
          OSM_ID: `${element.type}/${element.id}`,
          NAME: tags.name || tags['official_name'] || 'Place of Worship',
          RELIGION: tags.religion || '',
          DENOMINATION: tags.denomination || tags['religion:denomination'] || '',
          WORSHIP_TYPE: tags.place_of_worship || tags.building || '',
          ADDRESS: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
          WEBSITE: tags.website || tags['contact:website'] || '',
          PHONE: tags.phone || tags['contact:phone'] || '',
          CATEGORY: getReligiousCategory(tags),
          OSM_TAGS: tags
        },
        geometry: { type: 'Point', coordinates }
      };
    })
    .filter(Boolean)
});

const UNIVERSITY_PROFILES = [
  { name: 'Georgetown University', color: '#2563eb', center: [-77.0730, 38.9076], radiusMeters: 1800, patterns: ['georgetown university', 'georgetown law'] },
  { name: 'George Washington University', color: '#f59e0b', center: [-77.0486, 38.8997], radiusMeters: 1500, patterns: ['george washington university', 'gwu', 'gw university'] },
  { name: 'Howard University', color: '#dc2626', center: [-77.0209, 38.9227], radiusMeters: 1700, patterns: ['howard university'] },
  { name: 'American University', color: '#0f766e', center: [-77.0889, 38.9370], radiusMeters: 1600, patterns: ['american university'] },
  { name: 'Catholic University of America', color: '#7c3aed', center: [-76.9991, 38.9369], radiusMeters: 1800, patterns: ['catholic university', 'cua'] },
  { name: 'Gallaudet University', color: '#14b8a6', center: [-76.9936, 38.9067], radiusMeters: 1200, patterns: ['gallaudet university'] },
  { name: 'University of the District of Columbia', color: '#16a34a', center: [-77.0656, 38.9438], radiusMeters: 1000, patterns: ['university of the district of columbia', 'udc'] },
  { name: 'Trinity Washington University', color: '#db2777', center: [-77.0048, 38.9276], radiusMeters: 1000, patterns: ['trinity washington university', 'trinity college'] },
  { name: 'Johns Hopkins University', color: '#0ea5e9', center: [-77.0402, 38.9087], radiusMeters: 700, patterns: ['johns hopkins', 'sais'] },
  { name: 'National Defense University', color: '#64748b', center: [-77.0176, 38.8664], radiusMeters: 900, patterns: ['national defense university'] },
  { name: 'University of Southern California', color: '#b91c1c', center: [-77.0188, 38.8934], radiusMeters: 500, patterns: ['university of southern california', 'usc'] },
  { name: 'Arizona State University', color: '#8b5cf6', center: [-77.0400, 38.9020], radiusMeters: 500, patterns: ['arizona state university', 'asu'] },
  { name: 'Princeton University', color: '#f97316', center: [-77.0395, 38.9085], radiusMeters: 500, patterns: ['princeton university'] },
  { name: 'Strayer University', color: '#4f46e5', center: [-77.0314, 38.9046], radiusMeters: 500, patterns: ['strayer university'] },
  { name: 'University of the Potomac', color: '#0891b2', center: [-77.0432, 38.9040], radiusMeters: 500, patterns: ['university of the potomac'] }
];

const UNIVERSITY_FALLBACK_COLORS = ['#2563eb', '#f59e0b', '#dc2626', '#0f766e', '#7c3aed', '#14b8a6', '#16a34a', '#db2777', '#0ea5e9', '#f97316', '#4f46e5', '#be185d'];

const getDistanceMeters = ([lng1, lat1], [lng2, lat2]) => {
  const toRad = (value) => value * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getStableColorFromText = (value, palette) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const getUniversityProfile = (tags = {}, coordinates = null) => {
  const haystack = [
    tags.name,
    tags.operator,
    tags.brand,
    tags.owner,
    tags['official_name'],
    tags['alt_name'],
    tags['short_name']
  ].map((value) => String(value || '').toLowerCase()).join(' ');

  const matchedByName = UNIVERSITY_PROFILES.find((profile) =>
    profile.patterns.some((pattern) => haystack.includes(pattern))
  );
  if (matchedByName) return matchedByName;

  if (coordinates) {
    const nearbyProfile = UNIVERSITY_PROFILES
      .map((profile) => ({
        ...profile,
        distance: getDistanceMeters(coordinates, profile.center)
      }))
      .filter((profile) => profile.distance <= profile.radiusMeters)
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearbyProfile) return nearbyProfile;
  }

  const fallbackName = tags.operator || tags.name || 'Other University / College';
  return {
    name: fallbackName,
    color: getStableColorFromText(fallbackName, UNIVERSITY_FALLBACK_COLORS),
    center: coordinates || [-77.0365, 38.9072],
    radiusMeters: 0,
    patterns: []
  };
};

const getOsmElementCenter = (element) => {
  if (Number.isFinite(element.lon) && Number.isFinite(element.lat)) return [element.lon, element.lat];
  if (element.center && Number.isFinite(element.center.lon) && Number.isFinite(element.center.lat)) {
    return [element.center.lon, element.center.lat];
  }
  if (Array.isArray(element.geometry) && element.geometry.length) {
    const points = element.geometry.filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat));
    if (!points.length) return null;
    const sums = points.reduce((acc, point) => {
      acc.lng += point.lon;
      acc.lat += point.lat;
      return acc;
    }, { lng: 0, lat: 0 });
    return [sums.lng / points.length, sums.lat / points.length];
  }
  return null;
};

const getOsmPolygonGeometry = (element) => {
  if (!Array.isArray(element.geometry) || element.geometry.length < 4) return null;
  const coordinates = element.geometry
    .filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat))
    .map((point) => [point.lon, point.lat]);
  if (coordinates.length < 4) return null;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push(first);
  return { type: 'Polygon', coordinates: [coordinates] };
};

const getUniversityFeatureKind = (tags = {}, geometryType = 'Point') => {
  if (tags.building) return 'University Building';
  if (geometryType !== 'Point' && (tags.amenity === 'university' || tags.amenity === 'college')) return 'Campus Area';
  if (tags.amenity === 'college') return 'College Campus';
  return 'University Campus';
};

const osmUniversitiesToGeoJson = (elements = []) => ({
  type: 'FeatureCollection',
  features: elements
    .map((element) => {
      const center = getOsmElementCenter(element);
      if (!center) return null;
      const tags = element.tags || {};
      const polygon = getOsmPolygonGeometry(element);
      const profile = getUniversityProfile(tags, center);
      const geometry = polygon || { type: 'Point', coordinates: center };
      const name = tags.name || tags['official_name'] || profile.name || 'University / College';
      return {
        type: 'Feature',
        properties: {
          OSM_ID: `${element.type}/${element.id}`,
          NAME: name,
          UNIVERSITY: profile.name,
          COLOR: profile.color,
          FEATURE_KIND: getUniversityFeatureKind(tags, geometry.type),
          AMENITY: tags.amenity || '',
          BUILDING: tags.building || '',
          ADDRESS: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
          OSM_TAGS: tags
        },
        geometry
      };
    })
    .filter(Boolean)
});

const fetchOverpassJson = async (query) => {
  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({ data: query })
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${endpoint} failed: ${res.status} ${text.slice(0, 120)}`);
      return JSON.parse(text);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Overpass endpoints failed');
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

const getDcplDprPointStyle = (props = {}) => {
  const kind = props.AMENITY_KIND;
  if (kind === 'library') {
    return { pane: 'markerPane', radius: 6, fillColor: '#0284c7', color: '#7dd3fc', weight: 2, opacity: 1, fillOpacity: 0.88 };
  }
  if (kind === 'recCenter') {
    return { pane: 'markerPane', radius: 6, fillColor: '#ea580c', color: '#fdba74', weight: 2, opacity: 1, fillOpacity: 0.88 };
  }
  return { pane: 'markerPane', radius: 5, fillColor: '#64748b', color: '#94a3b8', weight: 2, opacity: 1, fillOpacity: 0.8 };
};

const dcplDprAmenityMatchesSearch = (feature, query) => {
  if (!query) return true;
  const props = feature.properties || {};
  const kind = String(props.AMENITY_KIND || '');
  return [
    props.NAME,
    props.ADDRESS,
    props.TYPE,
    props.USE_TYPE,
    props.PHONE,
    props.POOL,
    props.POOL_NAME,
    props.WARD,
    props.WARD_ID,
    props.STATUS,
    props.FITNESS_CENTER,
    props.WEB_URL,
    props.GIS_ID,
    kind,
    props.AMENITY_SOURCE,
    kind === 'library' ? 'library dcpl book' : '',
    kind === 'recCenter' ? 'recreation center dpr gym pool swim aquatic' : ''
  ].some(value => String(value || '').toLowerCase().includes(query));
};

const getFoodDesertPolygonStyle = (props = {}) => {
  const p = Number(props.PERCENTUND185);
  const t = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
  let fill = '#fef9c3';
  if (t >= 0.15) fill = '#fde047';
  if (t >= 0.3) fill = '#fb923c';
  if (t >= 0.45) fill = '#f97316';
  if (t >= 0.6) fill = '#ef4444';
  if (t >= 0.75) fill = '#b91c1c';
  return {
    color: '#78350f',
    weight: 1.25,
    opacity: 0.88,
    fillColor: fill,
    fillOpacity: 0.42 + 0.3 * t
  };
};

const foodDesertMatchesSearch = (feature, query) => {
  if (!query) return true;
  const props = feature.properties || {};
  return [
    props.NAME,
    props.WARD,
    props.GIS_ID,
    props.PARTPOP2,
    props.PRTUND185,
    props.PRTOVR185,
    props.PERCENTUND185
  ].some((value) => String(value ?? '').toLowerCase().includes(query));
};

const BUS_ROUTE_COLOR_PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#0d9488', '#ca8a04', '#4f46e5', '#be185d', '#0369a1'];

const getBusRouteLineStyle = (feature) => {
  const props = feature.properties || {};
  const key = props.ROUTE || props.RT_D || props.SHAPE_ID || props.DESCRIPTION || '';
  return {
    color: getStablePaletteColor(key, BUS_ROUTE_COLOR_PALETTE),
    weight: 2,
    opacity: 0.82
  };
};

const busRouteFeatureMatchesSearch = (feature, query) => {
  if (!query) return true;
  const p = feature.properties || {};
  return [
    p.ROUTE,
    p.RT_D,
    p.DESCRIPTION,
    p.ORIGIN,
    p.DESTINATION,
    p.DIRECTION,
    p.SHAPE_ID,
    p.GIS_ID,
    p.STATE,
    'metrobus wmata better bus'
  ].some((v) => String(v || '').toLowerCase().includes(query));
};

const farmersMarketMatchesSearch = (feature, query) => {
  if (!query) return true;
  const p = feature.properties || {};
  return [
    p.NAME,
    p.ADDRESS,
    p.CITY,
    p.STATE,
    p.ZIPCODE,
    p.WARD,
    p.ANC,
    p.DAYS,
    p.TIMES,
    p.WEBSITE,
    p.BENEFITS,
    p.SOCIAL,
    p.STARTDATE,
    p.ENDDATE,
    p.METRO,
    p.BUS,
    p.PARKING,
    p.MD_COUNTY,
    p.MAR_MATCHADDRESS
  ].some((v) => String(v || '').toLowerCase().includes(query));
};

const treeCanopyMatchesSearch = (feature, query) => {
  if (!query) return true;
  const p = feature.properties || {};
  return [
    p.NAME,
    p.NAME20,
    p.LABEL,
    p.WARD,
    p.WARD_ID,
    p.GEOID,
    p.GEOID20,
    p.TRACTCE20,
    p.BLOCKCE20,
    p.TCAN_PCT,
    p.UTC_PCT,
    'tree canopy urban heat island utc forest shade census block'
  ].some((v) => String(v ?? '').toLowerCase().includes(query));
};

/** 0–1 normalized canopy cover → RGB; wide yellow→amber→green ramp for legibility */
const TREE_CANOPY_RGB_STOPS = [
  [0, [255, 250, 205]],
  [0.14, [255, 220, 110]],
  [0.3, [214, 145, 45]],
  [0.48, [140, 195, 85]],
  [0.66, [55, 150, 75]],
  [0.82, [25, 105, 55]],
  [1, [12, 55, 35]]
];

const interpolateRgbStops = (t, stops) => {
  const x = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i += 1;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const span = t1 - t0 || 1e-6;
  const u = (x - t0) / span;
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * u),
    Math.round(c0[1] + (c1[1] - c0[1]) * u),
    Math.round(c0[2] + (c1[2] - c0[2]) * u)
  ];
};

const combinedSewerMatchesSearch = (feature, query) => {
  if (!query) return true;
  const p = feature.properties || {};
  return [
    p.NAME,
    p.LABEL,
    p.WARD,
    p.GIS_ID,
    p.SEWERSYSTEM,
    'combined sewer css csdo storm overflow flood hazard basement'
  ].some((v) => String(v ?? '').toLowerCase().includes(query));
};

const wetlandMatchesSearch = (feature, query) => {
  if (!query) return true;
  const p = feature.properties || {};
  return [
    p.NAME,
    p.LABEL,
    p.WARD,
    p.WETLAND_TYPE,
    p.WETLAND_ID,
    p.DESC_,
    'wetland nwi freshwater emergent palustrine riparian'
  ].some((v) => String(v ?? '').toLowerCase().includes(query));
};

const getTreeCanopyStyle = (feature) => {
  const pct = Number(feature.properties.TCAN_PCT ?? feature.properties.UTC_PCT);
  const t = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct / 100)) : 0.35;
  const [fr, fg, fb] = interpolateRgbStops(t, TREE_CANOPY_RGB_STOPS);
  const fill = `rgb(${fr},${fg},${fb})`;
  const [br, bg, bb] = interpolateRgbStops(t * 0.92 + 0.04, TREE_CANOPY_RGB_STOPS);
  const border = `rgb(${Math.max(0, br - 35)},${Math.max(0, bg - 28)},${Math.max(0, bb - 22)})`;
  return {
    color: border,
    weight: 0.65,
    opacity: 1,
    fillColor: fill,
    fillOpacity: 0.42 + 0.38 * t
  };
};

const getCombinedSewerStyle = () => ({
  color: '#86198f',
  weight: 1.25,
  opacity: 0.85,
  dashArray: '5 4',
  fillColor: '#e879f9',
  fillOpacity: 0.22
});

const getWetlandStyle = () => ({
  color: '#155e75',
  weight: 1,
  opacity: 0.9,
  fillColor: '#22d3ee',
  fillOpacity: 0.4
});

const emergencyMedicalMatchesSearch = (feature, query) => {
  if (!query) return true;
  const p = feature.properties || {};
  return [
    p.NAME,
    p.ADDRESS,
    p.TYPE,
    p.FACILITY_TYPE,
    p.PHONE,
    p.WARD,
    p.ZIPCODE,
    p.BATTALION,
    p.NEAREST_METRO,
    p.QUADRANT,
    p.ANC,
    p.GIS_ID,
    'fire engine ems hospital urgent clinic walk-in medstar emergency'
  ].some((v) => String(v ?? '').toLowerCase().includes(query));
};

const getEmergencyMedicalPointStyle = (props = {}) => {
  const kind = props.MED_KIND;
  if (kind === 'hospital') {
    return {
      pane: 'markerPane',
      radius: 7,
      fillColor: '#1d4ed8',
      color: '#93c5fd',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    };
  }
  if (kind === 'urgentCare') {
    return {
      pane: 'markerPane',
      radius: 6,
      fillColor: '#0d9488',
      color: '#99f6e4',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    };
  }
  return {
    pane: 'markerPane',
    radius: 6,
    fillColor: '#dc2626',
    color: '#fecaca',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.88
  };
};

const hospitalCapabilityLine = (label, raw) => {
  const v = String(raw ?? '').trim();
  if (!v || v === '<Null>' || v.toLowerCase() === 'null') return null;
  const yes = v.toLowerCase() === 'y' || v.toLowerCase() === 'yes';
  if (yes) return `${label}: Yes`;
  if (v.toLowerCase() === 'n' || v.toLowerCase() === 'no') return `${label}: No`;
  return `${label}: ${v}`;
};

const MapArea = ({ activeLayers, geoJsonData, hiddenNeighborhoods, dcBoundary, floodZonesData, searchQuery, selectedNeighborhoods, setSelectedNeighborhoods, isLeftAligned, showNeighborhoodBackgrounds }) => {
  const dcCenter = [38.9076, -77.0058]; // Eckington, NE DC
  const [parksData, setParksData] = useState(null);
  const [squaresData, setSquaresData] = useState(null);
  const [museumsData, setMuseumsData] = useState(null);
  const [dcpsSchoolsData, setDcpsSchoolsData] = useState(null);
  const [librariesRecPoolsData, setLibrariesRecPoolsData] = useState(null);
  const [muralsPublicArtData, setMuralsPublicArtData] = useState(null);
  const [historicLandmarksData, setHistoricLandmarksData] = useState(null);
  const [propertyValuesData, setPropertyValuesData] = useState(null);
  const [crimeData, setCrimeData] = useState(null);
  const [bikeLanesData, setBikeLanesData] = useState(null);
  const [metroLinesData, setMetroLinesData] = useState(null);
  const [metroStationsData, setMetroStationsData] = useState(null);
  const [busRoutesData, setBusRoutesData] = useState(null);
  const [federalPropertyData, setFederalPropertyData] = useState(null);
  const [federalBuildingsData, setFederalBuildingsData] = useState(null);
  const [zoningData, setZoningData] = useState(null);
  const [wardsData, setWardsData] = useState(null);
  const [foodDesertsData, setFoodDesertsData] = useState(null);
  const [farmersMarketsData, setFarmersMarketsData] = useState(null);
  const [treeCanopyData, setTreeCanopyData] = useState(null);
  const [combinedSewerData, setCombinedSewerData] = useState(null);
  const [wetlandData, setWetlandData] = useState(null);
  const [emergencyMedicalData, setEmergencyMedicalData] = useState(null);
  const [religiousInstitutionsData, setReligiousInstitutionsData] = useState(null);
  const [universitiesData, setUniversitiesData] = useState(null);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const treeCanopyLayerRef = useRef(null);
  const combinedSewerLayerRef = useRef(null);
  const wetlandLayerRef = useRef(null);
  const emergencyMedicalLayerRef = useRef(null);
  const treeCanopyStyleFn = useCallback((feature) => getTreeCanopyStyle(feature), []);
  const treeCanopyFilterFn = useCallback(
    (feature) => treeCanopyMatchesSearch(feature, normalizedSearchQuery),
    [normalizedSearchQuery]
  );
  const combinedSewerStyleFn = useCallback(() => getCombinedSewerStyle(), []);
  const combinedSewerFilterFn = useCallback(
    (feature) => combinedSewerMatchesSearch(feature, normalizedSearchQuery),
    [normalizedSearchQuery]
  );
  const wetlandStyleFn = useCallback(() => getWetlandStyle(), []);
  const wetlandFilterFn = useCallback(
    (feature) => wetlandMatchesSearch(feature, normalizedSearchQuery),
    [normalizedSearchQuery]
  );
  const emergencyMedicalFilterFn = useCallback(
    (feature) => emergencyMedicalMatchesSearch(feature, normalizedSearchQuery),
    [normalizedSearchQuery]
  );

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
    if (activeLayers.librariesRecPools && !librariesRecPoolsData) {
      // DC GIS "Swimming Pools" (MapServer/11) includes public *and* private residential pools
      // with no attribute to filter—so we only use DCPL libraries + DPR rec center points.
      // Public aquatics appear on rec centers via POOL / POOL_NAME.
      const librariesUrl = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Cultural_and_Society_WebMercator/MapServer/4/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';
      const recreationUrl = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Recreation_WebMercator/MapServer/4/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';

      Promise.all([
        fetch(`${librariesUrl}&resultRecordCount=100`).then((res) => res.json()),
        fetch(`${recreationUrl}&resultRecordCount=200`).then((res) => res.json())
      ])
        .then(([libraries, recreation]) => {
          const libFeatures = (libraries.features || []).map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              AMENITY_KIND: 'library',
              AMENITY_SOURCE: 'DCPL'
            }
          }));
          const recFeatures = (recreation.features || []).map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              AMENITY_KIND: 'recCenter',
              AMENITY_SOURCE: 'DPR'
            }
          }));
          setLibrariesRecPoolsData({
            type: 'FeatureCollection',
            features: [...libFeatures, ...recFeatures]
          });
        })
        .catch((err) => console.error('Error fetching libraries / recreation centers:', err));
    }
  }, [activeLayers.librariesRecPools, librariesRecPoolsData]);

  useEffect(() => {
    if (activeLayers.muralsPublicArt && !muralsPublicArtData) {
      import('../data/murals-public-art.json')
        .then(module => setMuralsPublicArtData(module.default))
        .catch(err => console.error("Error loading murals and public art data:", err));
    }
  }, [activeLayers.muralsPublicArt, muralsPublicArtData]);

  useEffect(() => {
    if (activeLayers.historicLandmarks && !historicLandmarksData) {
      const fetchGeoJson = async (url, label) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${label} request failed: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(`${label} API error: ${data.error.message || 'Unknown error'}`);
        return data;
      };
      const landmarksUrl = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planning_Landuse_and_Zoning_WebMercator/MapServer/23/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=2000';
      const districtsUrl = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Historic/MapServer/6/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=2000';

      Promise.all([
        fetchGeoJson(landmarksUrl, 'Historic landmarks'),
        fetchGeoJson(districtsUrl, 'Historic districts')
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
    if (activeLayers.religiousInstitutions && !religiousInstitutionsData) {
      const overpassQuery = `[out:json][timeout:25];
area["name"="District of Columbia"]["boundary"="administrative"]["admin_level"="4"]->.dc;
(
  node["amenity"="place_of_worship"](area.dc);
  way["amenity"="place_of_worship"](area.dc);
  relation["amenity"="place_of_worship"](area.dc);
);
out center tags;`;

      fetchOverpassJson(overpassQuery)
        .then((data) => {
          setReligiousInstitutionsData(osmPlacesOfWorshipToGeoJson(data.elements || []));
        })
        .catch((err) => console.error('Error fetching religious institutions data:', err));
    }
  }, [activeLayers.religiousInstitutions, religiousInstitutionsData]);

  useEffect(() => {
    if (activeLayers.universities && !universitiesData) {
      const overpassQuery = `[out:json][timeout:60];
area["name"="District of Columbia"]["boundary"="administrative"]["admin_level"="4"]->.dc;
(
  node["amenity"~"^(university|college)$"](area.dc);
  way["amenity"~"^(university|college)$"](area.dc);
  relation["amenity"~"^(university|college)$"](area.dc);
  way["building"~"^(university|college)$"](area.dc);
);
out center geom tags;`;

      fetchOverpassJson(overpassQuery)
        .then((data) => {
          setUniversitiesData(osmUniversitiesToGeoJson(data.elements || []));
        })
        .catch((err) => console.error('Error fetching universities data:', err));
    }
  }, [activeLayers.universities, universitiesData]);

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
    if (activeLayers.bus && !busRoutesData) {
      const metroBusUrl =
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Rail_Bus_WebMercator/MapServer/59/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=2000';

      fetch(metroBusUrl)
        .then((r) => r.json())
        .then((metroBus) =>
          setBusRoutesData({
            type: 'FeatureCollection',
            features: metroBus.features || []
          })
        )
        .catch((err) => console.error('Error fetching Metrobus routes:', err));
    }
  }, [activeLayers.bus, busRoutesData]);

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

  useEffect(() => {
    if (activeLayers.foodDeserts && !foodDesertsData) {
      fetch(
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Public_Service_WebMercator/MapServer/61/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=500'
      )
        .then((res) => res.json())
        .then((data) => setFoodDesertsData(data))
        .catch((err) => console.error('Error fetching low food access areas:', err));
    }
  }, [activeLayers.foodDeserts, foodDesertsData]);

  useEffect(() => {
    if (activeLayers.farmersMarkets && !farmersMarketsData) {
      fetch(
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Business_Goods_and_Service_WebMercator/MapServer/2/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=200'
      )
        .then((res) => res.json())
        .then((data) => setFarmersMarketsData(data))
        .catch((err) => console.error('Error fetching farmers market locations:', err));
    }
  }, [activeLayers.farmersMarkets, farmersMarketsData]);

  useEffect(() => {
    if (!activeLayers.treeCanopy || treeCanopyData) return;

    let cancelled = false;
    const pageUrl =
      'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Urban_Tree_Canopy/MapServer/1/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=2000';

    (async () => {
      try {
        const allFeatures = [];
        let offset = 0;
        for (;;) {
          const res = await fetch(`${pageUrl}&resultOffset=${offset}`);
          const data = await res.json();
          const feats = data.features || [];
          if (feats.length === 0) break;
          allFeatures.push(...feats);
          if (!data.exceededTransferLimit) break;
          offset += feats.length;
        }
        if (!cancelled) {
          setTreeCanopyData({ type: 'FeatureCollection', features: allFeatures });
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching urban tree canopy (census block) data:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeLayers.treeCanopy, treeCanopyData]);

  useEffect(() => {
    if (activeLayers.combinedSewer && !combinedSewerData) {
      fetch(
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Environment_Stormwater_Management_WebMercator/MapServer/19/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=500'
      )
        .then((res) => res.json())
        .then((data) => setCombinedSewerData(data))
        .catch((err) => console.error('Error fetching combined sewer sewershed data:', err));
    }
  }, [activeLayers.combinedSewer, combinedSewerData]);

  useEffect(() => {
    if (activeLayers.wetland && !wetlandData) {
      fetch(
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Environment_Water_WebMercator/MapServer/28/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=500'
      )
        .then((res) => res.json())
        .then((data) => setWetlandData(data))
        .catch((err) => console.error('Error fetching wetland data:', err));
    }
  }, [activeLayers.wetland, wetlandData]);

  useEffect(() => {
    if (!activeLayers.emergencyMedical || emergencyMedicalData) return;

    let cancelled = false;
    const fireUrl =
      'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Public_Safety_WebMercator/MapServer/6/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson';
    const hospitalUrl =
      'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Health_WebMercator/MapServer/4/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson';
    const primaryUrl =
      'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Health_WebMercator/MapServer/7/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson';
    const WALK = 'DCGIS.PrimaryCarePt.WALKIN_UNSCHEDULED';

    Promise.all([fetch(fireUrl).then((r) => r.json()), fetch(hospitalUrl).then((r) => r.json()), fetch(primaryUrl).then((r) => r.json())])
      .then(([fire, hospitals, primary]) => {
        if (cancelled) return;

        const fireFeatures = (fire.features || []).map((f) => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            MED_KIND: 'fireEms',
            NAME: f.properties?.NAME,
            ADDRESS: f.properties?.ADDRESS,
            ZIPCODE: f.properties?.ZIP,
            PHONE: f.properties?.PHONE,
            TYPE: f.properties?.TYPE,
            BATTALION: f.properties?.BATTALION,
            WARD: f.properties?.WARD,
            NEAREST_METRO: f.properties?.NEAREST_METRO,
            NEAREST_BUS_STOP: f.properties?.NEAREST_BUS_STOP,
            GIS_ID: f.properties?.GIS_ID
          }
        }));

        const hospitalFeatures = (hospitals.features || []).map((f) => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            MED_KIND: 'hospital',
            NAME: f.properties?.NAME,
            ADDRESS: f.properties?.ADDRESS,
            WARD: f.properties?.WARD,
            TYPE: f.properties?.TYPE,
            BED_COUNT: f.properties?.BED_COUNT,
            WEB_URL: f.properties?.WEB_URL,
            GIS_ID: f.properties?.GIS_ID,
            ADULT_MEDICAL: f.properties?.ADULT_MEDICAL,
            ADULT_MAJOR_TRAUMA: f.properties?.ADULT_MAJOR_TRAUMA,
            ADULT_MINOR_TRAUMA: f.properties?.ADULT_MINOR_TRAUMA,
            PEDIATRIC_MEDICAL: f.properties?.PEDIATRIC_MEDICAL,
            PEDIATRIC_MAJOR_TRAUMA: f.properties?.PEDIATRIC_MAJOR_TRAUMA,
            OBSTETRICS: f.properties?.OBSTETRICS
          }
        }));

        const urgentFeatures = (primary.features || [])
          .filter((f) => {
            const w = f.properties?.[WALK];
            return String(w || '').trim().toLowerCase() === 'yes';
          })
          .map((f) => {
            const pr = f.properties || {};
            return {
              type: 'Feature',
              geometry: f.geometry,
              properties: {
                MED_KIND: 'urgentCare',
                NAME: pr['DCGIS.PrimaryCarePt.NAME'],
                ADDRESS: pr['DCGIS.PrimaryCarePt.ADDRESS'],
                CITY: pr['DCGIS.PrimaryCarePt.CITY'] || 'Washington',
                STATE: pr['DCGIS.PrimaryCarePt.STATE'] || 'DC',
                ZIPCODE: pr['DCGIS.PrimaryCarePt.ZIPCODE'] ?? pr['DCGIS.PrimaryCarePt.ZIP_1'],
                PHONE: pr['DCGIS.PrimaryCarePt.PHONE'],
                WEB_URL: pr['DCGIS.PrimaryCarePt.WEB_URL'],
                WARD: pr['DCGIS.PrimaryCarePt.WARD'],
                FACILITY_TYPE: pr['DCGIS.PrimaryCarePt.FACILITY_TYPE'],
                WALKIN_UNSCHEDULED: pr[WALK],
                ANC: pr['DCGIS.PRIMARY_CARE_INFO.ANC'],
                QUADRANT: pr['DCGIS.PRIMARY_CARE_INFO.QUADRANT'],
                GIS_ID: pr['DCGIS.PrimaryCarePt.GIS_ID']
              }
            };
          });

        setEmergencyMedicalData({
          type: 'FeatureCollection',
          features: [...fireFeatures, ...hospitalFeatures, ...urgentFeatures]
        });
      })
      .catch((err) => {
        if (!cancelled) console.error('Error fetching fire / hospital / urgent care data:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayers.emergencyMedical, emergencyMedicalData]);

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
      zoom={13} 
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

      {/* DCPL libraries + DPR recreation centers (public pool info on center attributes, not residential pool GIS) */}
      {activeLayers.librariesRecPools && librariesRecPoolsData && (
        <GeoJSON
          key={`libraries-rec-pools-${searchQuery}`}
          data={librariesRecPoolsData}
          filter={(feature) => dcplDprAmenityMatchesSearch(feature, normalizedSearchQuery)}
          pointToLayer={(feature, latlng) =>
            L.circleMarker(latlng, getDcplDprPointStyle(feature.properties))
          }
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const kind = props.AMENITY_KIND;

            const name = escapeHtml(props.NAME || 'Facility');
            const badge =
              kind === 'library'
                ? '<span style="color:#0284c7;font-weight:600;font-size:11px;">DCPL Library</span>'
                : '<span style="color:#ea580c;font-weight:600;font-size:11px;">DPR Recreation Center</span>';
            const typeOrUse = escapeHtml(props.TYPE || props.USE_TYPE || '');
            const address = escapeHtml(props.ADDRESS || '');
            const phone = escapeHtml(props.PHONE || '');
            const ward = escapeHtml(props.WARD || (props.WARD_ID != null ? `Ward ${props.WARD_ID}` : ''));
            const poolName = escapeHtml(props.POOL_NAME || '');
            const poolHas = poolName && String(poolName).toLowerCase() !== 'none';
            const poolTypeRaw = String(props.POOL || '').trim();
            const poolType =
              poolTypeRaw && poolTypeRaw.toLowerCase() !== 'none'
                ? escapeHtml(poolTypeRaw.replace(/_/g, ' '))
                : '';
            const fitness = escapeHtml(props.FITNESS_CENTER || '');
            const status = escapeHtml(props.STATUS || '');
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 280px;">`,
              `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">${name}</div>`,
              `<div style="margin-bottom: 6px;">${badge}</div>`
            ];
            if (typeOrUse) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${typeOrUse}</div>`);
            if (address) lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${address}</div>`);
            if (ward) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${ward}</div>`);
            if (phone) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${phone}</div>`);
            if (kind === 'recCenter' && poolType) {
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Aquatics: ${poolType}</div>`);
            }
            if (kind === 'recCenter' && poolHas) {
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">Pool: ${poolName}</div>`);
            }
            if (kind === 'recCenter' && fitness && String(fitness).toLowerCase() !== 'no') {
              lines.push(`<div style="font-size: 11px; color: var(--text-secondary);">${fitness}</div>`);
            }
            if (status && status.toLowerCase() !== 'open') {
              lines.push(`<div style="font-size: 11px; color: #f97316; margin-top: 4px;">Status: ${status}</div>`);
            }
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
                l.setRadius(9);
                l.setStyle({ weight: 4 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const s = getDcplDprPointStyle(feature.properties);
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

      {/* Live Music Layer */}
      {activeLayers.liveMusic && (
        <GeoJSON
          key={`live-music-${searchQuery}`}
          data={liveMusicData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const p = feature.properties || {};
            return [p.NAME, p.TYPE, p.SUMMARY, p.NEIGHBORHOOD]
              .some((v) => String(v || "").toLowerCase().includes(q));
          }}
          pointToLayer={(feature, latlng) => {
            const type = String(feature.properties?.TYPE || "").toLowerCase();
            const supperClub = type.includes("supper") || type.includes("restaurant") || type.includes("brunch");
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: supperClub ? 8 : 7,
              fillColor: supperClub ? '#0f766e' : '#14b8a6',
              color: '#99f6e4',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const name = escapeHtml(p.NAME || 'Live music venue');
            const type = escapeHtml(p.TYPE || 'Live Music');
            const summary = escapeHtml(p.SUMMARY || '');
            const nbh = escapeHtml(p.NEIGHBORHOOD || '');
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 430px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #0f766e;">🎷</span> ${name}
                 </div>
                 <div style="font-weight: 600; font-size: 12px; color: #0f766e; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${type}${nbh ? ` · ${nbh}` : ''}
                 </div>
                 <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${summary}
                 </div>
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Focused on seated, intimate, restaurant, lounge, brunch, and listening-room music experiences.
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(10);
                l.setStyle({ weight: 3 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const type = String(feature.properties?.TYPE || "").toLowerCase();
                const supperClub = type.includes("supper") || type.includes("restaurant") || type.includes("brunch");
                l.setRadius(supperClub ? 8 : 7);
                l.setStyle({ weight: 2 });
              }
            });
          }}
        />
      )}

      {/* Comedy Venues Layer */}
      {activeLayers.comedyVenues && (
        <GeoJSON
          key={`comedy-venues-${searchQuery}`}
          data={comedyVenuesData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const p = feature.properties || {};
            return [p.NAME, p.TYPE, p.SUMMARY, p.NEIGHBORHOOD]
              .some((v) => String(v || "").toLowerCase().includes(q));
          }}
          pointToLayer={(feature, latlng) => {
            const primaryClub = String(feature.properties?.TYPE || "").toLowerCase().includes("comedy club");
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: primaryClub ? 8 : 7,
              fillColor: primaryClub ? '#db2777' : '#ec4899',
              color: '#f9a8d4',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const name = escapeHtml(p.NAME || 'Comedy venue');
            const type = escapeHtml(p.TYPE || 'Comedy');
            const summary = escapeHtml(p.SUMMARY || '');
            const nbh = escapeHtml(p.NEIGHBORHOOD || '');
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 430px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #ec4899;">🎤</span> ${name}
                 </div>
                 <div style="font-weight: 600; font-size: 12px; color: #db2777; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${type}${nbh ? ` · ${nbh}` : ''}
                 </div>
                 <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${summary}
                 </div>
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Many venues run mixed programming; check current calendar for comedy nights.
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(10);
                l.setStyle({ weight: 3 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const primaryClub = String(feature.properties?.TYPE || "").toLowerCase().includes("comedy club");
                l.setRadius(primaryClub ? 8 : 7);
                l.setStyle({ weight: 2 });
              }
            });
          }}
        />
      )}

      {/* Festivals & Parades Layer */}
      {activeLayers.festivalsParades && (
        <GeoJSON
          key={`festivals-parades-${searchQuery}`}
          data={festivalsParadesData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            const summary = feature.properties?.SUMMARY || "";
            const type = feature.properties?.TYPE || "";
            const season = feature.properties?.SEASON || "";
            return (
              name.toLowerCase().includes(q) ||
              summary.toLowerCase().includes(q) ||
              type.toLowerCase().includes(q) ||
              season.toLowerCase().includes(q)
            );
          }}
          pointToLayer={(feature, latlng) => {
            const isParade = String(feature.properties?.TYPE || "").toLowerCase().includes("parade");
            const timing = getFestivalParadeTiming(feature);
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: isParade ? 8 : 7,
              fillColor: timing.fillColor,
              color: timing.strokeColor,
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const { NAME, TYPE, SUMMARY, SEASON } = feature.properties;
            const timing = getFestivalParadeTiming(feature);
            const typeSafe = escapeHtml(TYPE || 'Festival');
            const seasonSafe = escapeHtml(SEASON || '');
            const nameSafe = escapeHtml(NAME || 'Festival / Parade');
            const summarySafe = escapeHtml(SUMMARY || '');
            const timingLabelSafe = escapeHtml(timing.label || '');
            const timingStatusSafe = escapeHtml(timing.status || '');
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 420px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: ${timing.fillColor};">🎉</span> ${nameSafe}
                 </div>
                 <div style="font-weight: 600; font-size: 12px; color: ${timing.fillColor}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${typeSafe}${seasonSafe ? ` · ${seasonSafe}` : ''}
                 </div>
                 <div style="font-weight: 600; font-size: 12px; color: var(--text-primary); margin-bottom: 6px;">
                   ${timingLabelSafe ? `${timingLabelSafe} · ` : ''}${timingStatusSafe}
                 </div>
                 <div style="font-weight: 400; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${summarySafe}
                 </div>
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Color key: upcoming events shift amber to red as they get closer; passed events turn blue. Representative locations/routes can vary by year.
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(10);
                l.setStyle({ weight: 3 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const isParade = String(feature.properties?.TYPE || "").toLowerCase().includes("parade");
                l.setRadius(isParade ? 8 : 7);
                l.setStyle({ weight: 2, fillColor: timing.fillColor, color: timing.strokeColor });
              }
            });
          }}
        />
      )}

      {/* Breweries & Distilleries Layer */}
      {activeLayers.breweriesDistilleries && (
        <GeoJSON
          key={`breweries-distilleries-${searchQuery}`}
          data={breweriesDistilleriesData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const name = feature.properties?.NAME || "";
            const summary = feature.properties?.SUMMARY || "";
            const type = feature.properties?.TYPE || "";
            const neighborhood = feature.properties?.NEIGHBORHOOD || "";
            return (
              name.toLowerCase().includes(q) ||
              summary.toLowerCase().includes(q) ||
              type.toLowerCase().includes(q) ||
              neighborhood.toLowerCase().includes(q)
            );
          }}
          pointToLayer={(feature, latlng) => {
            const isDistillery = String(feature.properties?.TYPE || "").toLowerCase().includes("distillery");
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: isDistillery ? 8 : 7,
              fillColor: isDistillery ? '#7c2d12' : '#b45309',
              color: '#fbbf24',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const { NAME, TYPE, SUMMARY, NEIGHBORHOOD } = feature.properties;
            const nameSafe = escapeHtml(NAME || 'Beverage Producer');
            const typeSafe = escapeHtml(TYPE || 'Brewery');
            const summarySafe = escapeHtml(SUMMARY || '');
            const nbhSafe = escapeHtml(NEIGHBORHOOD || '');
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 420px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #f59e0b;">🍺</span> ${nameSafe}
                 </div>
                 <div style="font-weight: 600; font-size: 12px; color: #b45309; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${typeSafe}${nbhSafe ? ` · ${nbhSafe}` : ''}
                 </div>
                 <div style="font-weight: 400; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${summarySafe}
                 </div>
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Curated anchor list; verify current hours and operations before visiting.
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(10);
                l.setStyle({ weight: 3 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const isDistillery = String(feature.properties?.TYPE || "").toLowerCase().includes("distillery");
                l.setRadius(isDistillery ? 8 : 7);
                l.setStyle({ weight: 2 });
              }
            });
          }}
        />
      )}

      {/* Rent Control Buildings Layer */}
      {activeLayers.rentControlBuildings && (
        <GeoJSON
          key={`rent-control-buildings-${searchQuery}`}
          data={rentControlBuildingsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const p = feature.properties || {};
            return [p.NAME, p.TYPE, p.SUMMARY, p.NEIGHBORHOOD, p.YEAR_BUILT]
              .some((v) => String(v || "").toLowerCase().includes(q));
          }}
          pointToLayer={(feature, latlng) => {
            const year = Number(feature.properties?.YEAR_BUILT);
            const older = Number.isFinite(year) && year <= 1930;
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: older ? 8 : 7,
              fillColor: older ? '#6d28d9' : '#8b5cf6',
              color: '#ddd6fe',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const name = escapeHtml(p.NAME || 'Rent-controlled building');
            const type = escapeHtml(p.TYPE || 'Multifamily');
            const nbh = escapeHtml(p.NEIGHBORHOOD || '');
            const year = Number(p.YEAR_BUILT);
            const summary = escapeHtml(p.SUMMARY || '');
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 430px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #8b5cf6;">🏢</span> ${name}
                 </div>
                 <div style="font-weight: 600; font-size: 12px; color: #7c3aed; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${type}${nbh ? ` · ${nbh}` : ''}${Number.isFinite(year) ? ` · Built ${year}` : ''}
                 </div>
                 <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${summary}
                 </div>
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Curated representative list, not an official citywide registry. Verify current rent-control status through DHCD/RAD resources.
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(10);
                l.setStyle({ weight: 3 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const yearOut = Number(feature.properties?.YEAR_BUILT);
                const olderOut = Number.isFinite(yearOut) && yearOut <= 1930;
                l.setRadius(olderOut ? 8 : 7);
                l.setStyle({ weight: 2 });
              }
            });
          }}
        />
      )}

      {/* Public Housing Layer */}
      {activeLayers.publicHousing && (
        <GeoJSON
          key={`public-housing-${searchQuery}`}
          data={publicHousingData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const p = feature.properties || {};
            return [p.NAME, p.TYPE, p.SUMMARY, p.WARD]
              .some((v) => String(v || "").toLowerCase().includes(q));
          }}
          pointToLayer={(feature, latlng) =>
            L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 8,
              fillColor: '#1d4ed8',
              color: '#93c5fd',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            })
          }
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const name = escapeHtml(p.NAME || 'Public housing community');
            const type = escapeHtml(p.TYPE || 'Public housing');
            const ward = escapeHtml(p.WARD || '');
            const summary = escapeHtml(p.SUMMARY || '');
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 430px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #2563eb;">🏘️</span> ${name}
                 </div>
                 <div style="font-weight: 600; font-size: 12px; color: #1d4ed8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${type}${ward ? ` · ${ward}` : ''}
                 </div>
                 <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${summary}
                 </div>
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Curated community anchors, not parcel-level boundaries. Verify current inventory and redevelopment status with DCHA.
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(10);
                l.setStyle({ weight: 3 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setRadius(8);
                l.setStyle({ weight: 2 });
              }
            });
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

      {/* Religious Institutions Layer */}
      {activeLayers.religiousInstitutions && religiousInstitutionsData && (
        <GeoJSON
          key={`religious-institutions-${searchQuery}`}
          data={religiousInstitutionsData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const p = feature.properties || {};
            return [
              p.NAME,
              p.CATEGORY,
              p.RELIGION,
              p.DENOMINATION,
              p.WORSHIP_TYPE,
              p.ADDRESS
            ].some((v) => String(v || '').toLowerCase().includes(q));
          }}
          pointToLayer={(feature, latlng) => {
            const style = getReligiousInstitutionStyle(feature.properties?.OSM_TAGS || {});
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 5.5,
              fillColor: style.fillColor,
              color: style.color,
              weight: 1.8,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const style = getReligiousInstitutionStyle(p.OSM_TAGS || {});
            const name = escapeHtml(p.NAME || 'Place of Worship');
            const category = escapeHtml(p.CATEGORY || style.category || 'Other');
            const religion = escapeHtml(formatOsmTag(p.RELIGION));
            const denomination = escapeHtml(formatOsmTag(p.DENOMINATION));
            const worshipType = escapeHtml(formatOsmTag(p.WORSHIP_TYPE));
            const address = escapeHtml(p.ADDRESS || '');
            const osmId = escapeHtml(p.OSM_ID || '');
            const details = [religion, denomination, worshipType].filter(Boolean).join(' · ');

            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 430px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: ${style.fillColor};">✦</span> ${name}
                 </div>
                 <div style="font-weight: 700; font-size: 12px; color: ${style.fillColor}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${category}
                 </div>
                 ${details ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35; margin-bottom: 3px;">${details}</div>` : ''}
                 ${address ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Address:</strong> ${address}</div>` : ''}
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Color is based on OSM religion / denomination tags.${osmId ? ` Source: ${osmId}` : ''}
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setRadius(8);
                l.setStyle({ weight: 3 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                l.setRadius(5.5);
                l.setStyle({ weight: 1.8, fillColor: style.fillColor, color: style.color });
              }
            });
          }}
        />
      )}

      {/* Universities Layer */}
      {activeLayers.universities && universitiesData && (
        <GeoJSON
          key={`universities-${searchQuery}`}
          data={universitiesData}
          filter={(feature) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const p = feature.properties || {};
            return [
              p.NAME,
              p.UNIVERSITY,
              p.FEATURE_KIND,
              p.AMENITY,
              p.BUILDING,
              p.ADDRESS
            ].some((v) => String(v || '').toLowerCase().includes(q));
          }}
          style={(feature) => {
            const p = feature.properties || {};
            const isBuilding = String(p.FEATURE_KIND || '').toLowerCase().includes('building');
            return {
              fillColor: p.COLOR || '#2563eb',
              color: p.COLOR || '#2563eb',
              weight: isBuilding ? 1.5 : 2.5,
              opacity: isBuilding ? 0.72 : 0.9,
              fillOpacity: isBuilding ? 0.32 : 0.18,
              dashArray: isBuilding ? null : '5, 4'
            };
          }}
          pointToLayer={(feature, latlng) => {
            const p = feature.properties || {};
            const isBuilding = String(p.FEATURE_KIND || '').toLowerCase().includes('building');
            return L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: isBuilding ? 5 : 7,
              fillColor: p.COLOR || '#2563eb',
              color: '#dbeafe',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const color = p.COLOR || '#2563eb';
            const name = escapeHtml(p.NAME || 'University / College');
            const university = escapeHtml(p.UNIVERSITY || 'University / College');
            const kind = escapeHtml(p.FEATURE_KIND || 'Campus Feature');
            const address = escapeHtml(p.ADDRESS || '');
            const osmId = escapeHtml(p.OSM_ID || '');
            const isPolygon = feature.geometry?.type !== 'Point';

            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 430px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: ${color};">🎓</span> ${name}
                 </div>
                 <div style="font-weight: 700; font-size: 12px; color: ${color}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">
                   ${university}
                 </div>
                 <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;">
                   <strong>Feature:</strong> ${kind}${isPolygon ? ' footprint' : ''}
                 </div>
                 ${address ? `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;"><strong>Address:</strong> ${address}</div>` : ''}
                 <div style="font-size: 10px; color: var(--text-secondary); margin-top: 7px; font-style: italic;">
                   Campus areas and buildings from OpenStreetMap.${osmId ? ` Source: ${osmId}` : ''}
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
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                if (l.setRadius) l.setRadius(9);
                l.setStyle({ weight: 3, fillOpacity: isPolygon ? 0.42 : 0.95 });
                l.bringToFront();
              },
              mouseout: (e) => {
                const l = e.target;
                const isBuilding = String(p.FEATURE_KIND || '').toLowerCase().includes('building');
                if (l.setRadius) l.setRadius(isBuilding ? 5 : 7);
                l.setStyle({
                  weight: isBuilding ? 1.5 : 2.5,
                  fillOpacity: isPolygon ? (isBuilding ? 0.32 : 0.18) : 0.9
                });
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

      {/* DC Office of Planning: Low Food Access Areas (often called food deserts) */}
      {activeLayers.foodDeserts && foodDesertsData && (
        <GeoJSON
          key={`food-deserts-${searchQuery}`}
          data={foodDesertsData}
          filter={(feature) => foodDesertMatchesSearch(feature, normalizedSearchQuery)}
          style={(feature) => getFoodDesertPolygonStyle(feature.properties)}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const title = escapeHtml(props.NAME || 'Low food access area');
            const ward = props.WARD != null ? escapeHtml(String(props.WARD)) : '';
            const pop = formatNumber(props.PARTPOP2);
            const under = formatNumber(props.PRTUND185);
            const over = formatNumber(props.PRTOVR185);
            const pctRaw = Number(props.PERCENTUND185);
            const pct =
              Number.isFinite(pctRaw) ? `${(pctRaw * 100).toFixed(1).replace(/\.0$/, '')}%` : '';
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">`,
              `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
              `<span style="color: #d97706; margin-right: 6px;">●</span>${title}`,
              `</div>`,
              `<div style="font-size: 11px; font-weight: 600; color: #b45309; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px;">`,
              `Low food access (DC Office of Planning)`,
              `</div>`,
              `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.45;">`,
              `More than an estimated 10-minute walk to the nearest full-service grocery, `,
              `with Census-based estimates of population below 185% of the federal poverty line.`,
              `</div>`
            ];
            if (ward) {
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Ward: ${ward}</div>`);
            }
            if (pop) {
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Estimated population in zone: <strong>${pop}</strong></div>`);
            }
            if (under || over) {
              lines.push(
                `<div style="font-size: 12px; color: var(--text-secondary);">Below 185% FPL: <strong>${under || '—'}</strong> · Above: <strong>${over || '—'}</strong></div>`
              );
            }
            if (pct) {
              lines.push(
                `<div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 6px;">Estimated food-insecure share of zone: ${pct}</div>`
              );
            }
            lines.push(
              `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">`,
              `Source: DC GIS Low Food Access Areas. Methodology updated through 2017; see Open Data DC for current metadata.`,
              `</div></div>`
            );
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
                const base = getFoodDesertPolygonStyle(feature.properties);
                l.setStyle({ ...base, weight: 2.5, fillOpacity: Math.min(0.92, base.fillOpacity + 0.12) });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
              },
              mouseout: (e) => {
                e.target.setStyle(getFoodDesertPolygonStyle(feature.properties));
              }
            });
          }}
        />
      )}

      {activeLayers.farmersMarkets && farmersMarketsData && (
        <GeoJSON
          key={`farmers-markets-${searchQuery}`}
          data={farmersMarketsData}
          filter={(feature) => farmersMarketMatchesSearch(feature, normalizedSearchQuery)}
          pointToLayer={(feature, latlng) =>
            L.circleMarker(latlng, {
              pane: 'markerPane',
              radius: 6,
              fillColor: '#22c55e',
              color: '#15803d',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            })
          }
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const name = escapeHtml(p.NAME || 'Farmers market');
            const addr = escapeHtml(p.ADDRESS || '');
            const city = escapeHtml(p.CITY || '');
            const st = escapeHtml(p.STATE || '');
            const zip = escapeHtml(p.ZIPCODE || '');
            const ward = escapeHtml(p.WARD || '');
            const anc = escapeHtml(p.ANC || '');
            const days = escapeHtml(p.DAYS || '');
            const times = escapeHtml(p.TIMES || '');
            const season =
              p.STARTDATE || p.ENDDATE
                ? escapeHtml([p.STARTDATE, p.ENDDATE].filter(Boolean).join(' – '))
                : '';
            const benefits = escapeHtml(p.BENEFITS || '');
            const metro = escapeHtml(p.METRO || '');
            const bus = escapeHtml(p.BUS || '');
            const parking = escapeHtml(p.PARKING || '');
            const web = p.WEBSITE ? escapeHtml(p.WEBSITE) : '';
            const county = escapeHtml(p.MD_COUNTY || '');
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">`,
              `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
              `<span style="color: #15803d; margin-right: 6px;">●</span>${name}`,
              `</div>`,
              `<div style="font-size: 11px; font-weight: 600; color: #15803d; text-transform: uppercase; letter-spacing: 0.35px; margin-bottom: 6px;">`,
              `Farmers market (DC Health)`,
              `</div>`
            ];
            if (addr) {
              const loc = [addr, [city, st].filter(Boolean).join(', '), zip].filter(Boolean).join(' · ');
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35;">${loc}</div>`);
            }
            if (county) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${county}</div>`);
            if (ward) lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">${ward}${anc ? ` · ${anc}` : ''}</div>`);
            if (days || times) {
              lines.push(
                `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;"><strong>Hours:</strong> ${[days, times].filter(Boolean).join(' · ')}</div>`
              );
            }
            if (season) lines.push(`<div style="font-size: 11px; color: var(--text-secondary);">Season: ${season}</div>`);
            if (benefits) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${benefits}</div>`);
            if (metro) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;"><strong>Metro:</strong> ${metro}</div>`);
            if (bus) lines.push(`<div style="font-size: 11px; color: var(--text-secondary);"><strong>Bus:</strong> ${bus}</div>`);
            if (parking) lines.push(`<div style="font-size: 11px; color: var(--text-secondary);">${parking}</div>`);
            if (web) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; word-break: break-all;">${web}</div>`);
            lines.push(
              `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">`,
              `Listings include DC and nearby MD markets with at least one DC Produce Incentive Program–authorized vendor. Verify hours on the market website.`,
              `</div></div>`
            );
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
                l.setStyle({ weight: 3 });
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

      {activeLayers.treeCanopy && treeCanopyData && (
        <GeoJSON
          ref={treeCanopyLayerRef}
          key={`tree-canopy-${searchQuery}`}
          data={treeCanopyData}
          filter={treeCanopyFilterFn}
          style={treeCanopyStyleFn}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const title = escapeHtml(
              p.NAME20 || p.LABEL || p.NAME || (p.GEOID20 ? `Block ${p.GEOID20}` : 'Tree canopy')
            );
            const geoid = escapeHtml(p.GEOID20 || p.GEOID || '');
            const tcan = Number(p.TCAN_PCT);
            const utc = Number(p.UTC_PCT);
            const uhi = Number(p.UHI);
            const pctStr = (n) => (Number.isFinite(n) ? `${n.toFixed(1)}%` : '');
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">`,
              `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
              `<span style="color: #15803d; margin-right: 6px;">●</span>${title}`,
              `</div>`,
              `<div style="font-size: 11px; font-weight: 600; color: #0f766e; text-transform: uppercase; margin-bottom: 6px;">Urban tree canopy — 2020 census block</div>`
            ];
            if (geoid) {
              lines.push(`<div style="font-size: 11px; color: var(--text-secondary); font-family: ui-monospace, monospace;">${geoid}</div>`);
            }
            if (pctStr(tcan)) {
              lines.push(`<div style="font-size: 13px; color: var(--text-primary); margin-top: 4px;">Tree canopy: <strong>${pctStr(tcan)}</strong> of land area</div>`);
            }
            if (pctStr(utc) && Math.abs(utc - tcan) > 0.05) {
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">Urban tree canopy (alt. field): ${pctStr(utc)}</div>`);
            }
            if (Number.isFinite(uhi)) {
              lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Urban heat index (layer score): ${uhi.toFixed(1)}</div>`);
            }
            lines.push(
              `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">DC GIS Urban Tree Canopy (2020 census block).</div></div>`
            );
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
                const base = getTreeCanopyStyle(feature);
                l.setStyle({
                  ...base,
                  weight: (base.weight || 1) + 1.5,
                  fillOpacity: Math.min(0.85, (base.fillOpacity || 0.3) + 0.12)
                });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
              },
              mouseout: (e) => {
                treeCanopyLayerRef.current?.resetStyle(e.target);
              }
            });
          }}
        />
      )}

      {activeLayers.combinedSewer && combinedSewerData && (
        <GeoJSON
          ref={combinedSewerLayerRef}
          key={`combined-sewer-${searchQuery}`}
          data={combinedSewerData}
          filter={combinedSewerFilterFn}
          style={combinedSewerStyleFn}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const title = escapeHtml(p.NAME || 'Combined sewer area');
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">`,
              `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
              `<span style="color: #a21caf; margin-right: 6px;">●</span>${title}`,
              `</div>`,
              `<div style="font-size: 11px; font-weight: 600; color: #86198f; text-transform: uppercase; margin-bottom: 6px;">Combined sewer (CSS) sewershed</div>`,
              `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.45;">`,
              `Areas where stormwater and sewage share pipes. Heavy rain can stress the system and increase basement or street flooding risk compared with separated storm sewers.`,
              `</div>`,
              `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">DC GIS Stormwater — Combined Sewer sewersheds.</div></div>`
            ];
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
                const base = getCombinedSewerStyle();
                l.setStyle({
                  ...base,
                  weight: (base.weight || 1) + 1.5,
                  fillOpacity: Math.min(0.75, (base.fillOpacity || 0.3) + 0.12)
                });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
              },
              mouseout: (e) => {
                combinedSewerLayerRef.current?.resetStyle(e.target);
              }
            });
          }}
        />
      )}

      {activeLayers.wetland && wetlandData && (
        <GeoJSON
          ref={wetlandLayerRef}
          key={`wetland-${searchQuery}`}
          data={wetlandData}
          filter={wetlandFilterFn}
          style={wetlandStyleFn}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const wtype = escapeHtml(p.WETLAND_TYPE || 'Wetland');
            const wname = escapeHtml(p.NAME || p.DESC_ || '');
            const acres = Number(p.ACRES);
            const lines = [
              `<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">`,
              `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
              `<span style="color: #0891b2; margin-right: 6px;">●</span>${wtype}`,
              `</div>`,
              `<div style="font-size: 11px; font-weight: 600; color: #0e7490; text-transform: uppercase; margin-bottom: 6px;">Wetland (NWI-based)</div>`
            ];
            if (wname && wname !== wtype) {
              lines.push(`<div style="font-size: 11px; color: var(--text-secondary); line-height: 1.35;">${wname}</div>`);
            }
            if (Number.isFinite(acres) && acres > 0) {
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Approx. ${acres.toFixed(2)} acres</div>`);
            }
            lines.push(
              `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">DC GIS Environment — Wetland Types (General).</div></div>`
            );
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
                const base = getWetlandStyle();
                l.setStyle({
                  ...base,
                  weight: (base.weight || 1) + 1.5,
                  fillOpacity: Math.min(0.75, (base.fillOpacity || 0.3) + 0.12)
                });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
              },
              mouseout: (e) => {
                wetlandLayerRef.current?.resetStyle(e.target);
              }
            });
          }}
        />
      )}

      {activeLayers.emergencyMedical && emergencyMedicalData && (
        <GeoJSON
          ref={emergencyMedicalLayerRef}
          key={`emergency-medical-${searchQuery}`}
          data={emergencyMedicalData}
          filter={emergencyMedicalFilterFn}
          pointToLayer={(feature, latlng) =>
            L.circleMarker(latlng, getEmergencyMedicalPointStyle(feature.properties))
          }
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const kind = p.MED_KIND;
            const name = escapeHtml(p.NAME || 'Facility');
            const addr = escapeHtml(p.ADDRESS || '');
            const zip = p.ZIPCODE != null ? escapeHtml(String(p.ZIPCODE)) : '';
            const phone = escapeHtml(p.PHONE || '');
            const ward = p.WARD != null ? escapeHtml(`Ward ${p.WARD}`) : '';
            const web = p.WEB_URL ? escapeHtml(String(p.WEB_URL)) : '';

            const lines = [`<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 300px;">`];

            if (kind === 'fireEms') {
              const typ = escapeHtml(p.TYPE || 'Fire / EMS facility');
              const batt = p.BATTALION != null ? escapeHtml(`Battalion ${p.BATTALION}`) : '';
              const metro = escapeHtml(p.NEAREST_METRO || '');
              const bus = escapeHtml(p.NEAREST_BUS_STOP || '');
              lines.push(
                `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
                `<span style="color: #dc2626; margin-right: 6px;">●</span>${name}`,
                `</div>`,
                `<div style="font-size: 11px; font-weight: 600; color: #b91c1c; text-transform: uppercase; margin-bottom: 6px;">DC Fire & EMS station</div>`,
                `<div style="font-size: 12px; color: var(--text-secondary);">${typ}</div>`
              );
              if (addr) {
                lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${addr}${zip ? `, DC ${zip}` : ''}</div>`);
              }
              if (phone) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${phone}</div>`);
              if (ward) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${ward}</div>`);
              if (batt) lines.push(`<div style="font-size: 11px; color: var(--text-secondary);">${batt}</div>`);
              if (metro) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;"><strong>Metro:</strong> ${metro}</div>`);
              if (bus) lines.push(`<div style="font-size: 11px; color: var(--text-secondary);"><strong>Bus:</strong> ${bus}</div>`);
              lines.push(
                `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">DC GIS — Public Safety (Fire Stations).</div></div>`
              );
            } else if (kind === 'hospital') {
              const typ = escapeHtml(p.TYPE || 'Hospital');
              const beds = Number(p.BED_COUNT);
              lines.push(
                `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
                `<span style="color: #2563eb; margin-right: 6px;">●</span>${name}`,
                `</div>`,
                `<div style="font-size: 11px; font-weight: 600; color: #1d4ed8; text-transform: uppercase; margin-bottom: 6px;">Hospital (DC Health)</div>`,
                `<div style="font-size: 12px; color: var(--text-secondary);">${typ}</div>`
              );
              if (addr) lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${addr}</div>`);
              if (ward) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${ward}</div>`);
              if (Number.isFinite(beds) && beds > 0) {
                lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Reported beds: <strong>${beds}</strong></div>`);
              }
              const caps = [
                hospitalCapabilityLine('Adult medical / surgical', p.ADULT_MEDICAL),
                hospitalCapabilityLine('Adult major trauma', p.ADULT_MAJOR_TRAUMA),
                hospitalCapabilityLine('Adult minor trauma', p.ADULT_MINOR_TRAUMA),
                hospitalCapabilityLine('Pediatric medical', p.PEDIATRIC_MEDICAL),
                hospitalCapabilityLine('Pediatric major trauma', p.PEDIATRIC_MAJOR_TRAUMA),
                hospitalCapabilityLine('Obstetrics', p.OBSTETRICS)
              ].filter(Boolean);
              if (caps.length) {
                lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; line-height: 1.35;">${caps.map((c) => escapeHtml(c)).join('<br/>')}</div>`);
              }
              if (web) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; word-break: break-all;">${web}</div>`);
              lines.push(
                `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">DC GIS — Health (Hospitals). Not for emergencies—call 911.</div></div>`
              );
            } else {
              const ftype = escapeHtml(p.FACILITY_TYPE || 'Primary care');
              const anc = escapeHtml(p.ANC || '');
              const quad = escapeHtml(p.QUADRANT || '');
              const city = escapeHtml(p.CITY || '');
              const st = escapeHtml(p.STATE || '');
              lines.push(
                `<div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">`,
                `<span style="color: #0d9488; margin-right: 6px;">●</span>${name}`,
                `</div>`,
                `<div style="font-size: 11px; font-weight: 600; color: #0f766e; text-transform: uppercase; margin-bottom: 6px;">Urgent / walk-in care (DC Health)</div>`,
                `<div style="font-size: 12px; color: var(--text-secondary);">${ftype} · accepts walk-in / unscheduled visits (per DC dataset)</div>`
              );
              if (addr) {
                const loc = [addr, [city, st].filter(Boolean).join(', '), zip].filter(Boolean).join(' · ');
                lines.push(`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${loc}</div>`);
              }
              if (phone) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${phone}</div>`);
              if (ward) lines.push(`<div style="font-size: 12px; color: var(--text-secondary);">${ward}</div>`);
              if (quad || anc) {
                lines.push(`<div style="font-size: 11px; color: var(--text-secondary);">${[quad, anc ? `ANC ${anc}` : ''].filter(Boolean).join(' · ')}</div>`);
              }
              if (web) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; word-break: break-all;">${web}</div>`);
              lines.push(
                `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">DC GIS — Health (Primary Care, walk-in subset). Verify hours and services before visiting.</div></div>`
              );
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
                const base = getEmergencyMedicalPointStyle(feature.properties);
                l.setRadius((base.radius || 6) + 3);
                l.setStyle({ ...base, weight: (base.weight || 2) + 1 });
                l.bringToFront();
              },
              mouseout: (e) => {
                emergencyMedicalLayerRef.current?.resetStyle(e.target);
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

      {activeLayers.bus && busRoutesData && (
        <GeoJSON
          key={`bus-routes-${searchQuery}`}
          data={busRoutesData}
          filter={(feature) => busRouteFeatureMatchesSearch(feature, normalizedSearchQuery)}
          style={(feature) => getBusRouteLineStyle(feature)}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const lineStyle = getBusRouteLineStyle(feature);
            const color = lineStyle.color;
            const route = escapeHtml(props.ROUTE || '');
            const desc = escapeHtml(props.DESCRIPTION || '');
            const dir = escapeHtml(props.DIRECTION || '');
            const origin = escapeHtml(props.ORIGIN || '');
            const dest = escapeHtml(props.DESTINATION || '');
            const state = escapeHtml(props.STATE || '');
            const geomSrc = escapeHtml(props.GEOMETRYSOURCE || '');
            const lines = [`<div style="font-family: 'Outfit', sans-serif; padding: 4px; max-width: 320px;">`];
            lines.push(
              `<div style="font-weight: 700; font-size: 15px; color: ${color}; margin-bottom: 4px;">Route ${route || '—'}</div>`
            );
            if (desc) {
              lines.push(`<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.35; margin-bottom: 6px;">${desc}</div>`);
            }
            if (dir) lines.push(`<div style="font-size: 11px; color: var(--text-secondary);">Direction: <strong>${dir}</strong></div>`);
            if (origin || dest) {
              lines.push(
                `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; line-height: 1.35;"><strong>From:</strong> ${origin || '—'}<br><strong>To:</strong> ${dest || '—'}</div>`
              );
            }
            if (state) lines.push(`<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Jurisdiction: ${state}</div>`);
            if (geomSrc) {
              lines.push(`<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">Source: WMATA GTFS via DC GIS — ${geomSrc}</div>`);
            }
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
                const base = getBusRouteLineStyle(feature);
                l.setStyle({ ...base, weight: base.weight + 3, opacity: 1 });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
              },
              mouseout: (e) => {
                e.target.setStyle(getBusRouteLineStyle(feature));
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

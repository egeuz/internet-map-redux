(async () => {
  /* INIT */
  const mapData = await requestMapData(); // get map data
  mapboxgl.accessToken = await requestMapboxToken(); // get map token
  const map = new mapboxgl.Map({ // init mapbox
    container: 'map',
    // style: 'mapbox://styles/ege-uz/ck3tp15x42hz61cpazcqcoo9g', //old b&w
    style: 'mapbox://styles/mapbox/satellite-streets-v12', //satellite + globe
    center: [-40, 20],
    zoom: 3,
    minZoom: 2.5,
  });

  /* LOAD MAP MARKERS */
  const geojson = { // init marker collection
    type: 'FeatureCollection',
    features: []
  };
  initializeMapDatapoints(mapData);
  geojson.features.forEach(datapoint => {
    renderMapDatapoint(datapoint); // render markers
  });

  /* USER INTERACTION */
  // search
  const searchBtn = document.querySelector("#search button");
  searchBtn.addEventListener("click", handleSearch);
  // flags
  toggleMarkerFlags();
  map.on('zoom', toggleMarkerFlags);

  /* HELPERS */
  // init
  async function requestMapboxToken() {
    const res = await axios.get('/mapbox-token');
    const { token } = await res.data;
    return token;
  }

  async function requestMapData() {
    const res = await axios.get('/map-data');
    const data = res.data;
    return data;
  }

  // map markers
  function initializeMapDatapoints() {
    const datapoints = [];
    mapData.forEach(({ host, locations }) => {
      locations.forEach(location => {
        // see if location overlaps w/ any prior datapoint
        if (datapointLocOverlaps(location)) {
          location.longitude = offsetCoordinate(location.longitude);
          location.latitude = offsetCoordinate(location.latitude);
          console.log(location);
        }
        geojson.features.push(generateMapDatapoint(host, location));
      });
    });
    return datapoints;
  }

  function generateMapDatapoint(host, location) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: { lng: location.longitude, lat: location.latitude }
      },
      properties: {
        name: host,
        ...location
      }
    };
  }

  function renderMapDatapoint({ geometry, properties }) {
    const { coordinates } = geometry;
    const { name, country_flag, country } = properties;
    const marker = document.createElement("div");
    marker.className = "marker";
    marker.innerHTML = `
      <div class="marker-wrapper">
      <img src=${country_flag} alt=${country} />
      <p>${name}</p>
      <div class="marker-arrow" />
      </div>
    `;
    new mapboxgl
      .Marker(marker)
      .setLngLat(coordinates)
      .addTo(map);
  }

  function datapointLocOverlaps({ longitude: lng, latitude: lat }) {
    return geojson.features.find(f =>
      f.geometry.coordinates.lng === lng && f.geometry.coordinates.lat === lat
    );
  }

  function offsetCoordinate(coord) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    return parseFloat(coord) + 0.001 * dir;
  }

  // user interaction
  async function handleSearch() {
    let input = document.querySelector("#search input").value;
    if ((!input || input === "https://"));
    if (input.slice(0, 8) !== "https://") {
      input = `https://${input}`;
    }
    const res = await axios.post("/website-query", { input });
    const { error_message, host, locations } = res.data;
    console.log(res.data);
    if (error_message) {
      alert(error_message);
    }

    const resultOnMap = geojson.features.find(f => f.properties.name === host);

    if (resultOnMap) {
      renderMapDatapoint(resultOnMap);
    } else {
      const mapDatapoint = generateMapDatapoint(host, locations[0]);
      geojson.features.push(mapDatapoint);
      renderMapDatapoint(mapDatapoint);
    }

    map.flyTo({
      center: { lng: locations[0].longitude, lat: locations[0].latitude },
      zoom: 14
    });
  }

  function toggleMarkerFlags() {
    const showFlags = map.getZoom() < 7;
    const markers = document.querySelectorAll(".marker");
    markers.forEach(marker => {
      if (showFlags) {
        marker.classList.add("show-flag");
      } else {
        marker.classList.remove("show-flag");
      }
    });
  }



})();
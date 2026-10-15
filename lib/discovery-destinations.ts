export type DiscoveryDestination = {
  id: string; name: string; country: string; countryCode: string; latitude: number; longitude: number;
  geonamesId: number; description: string; highlights: readonly string[]; guideUrl: string;
  photo: { url: string; creator: string; sourceUrl: string; license: string; licenseUrl: string };
};

// Coordinates reuse the project's GeoNames destination dataset. El Nido anchors Palawan.
// Static inspiration, not live availability. Commons photo identities and licences are verified.
export const DISCOVERY_DESTINATIONS: readonly DiscoveryDestination[] = [
  {
    "id": "el-nido",
    "name": "El Nido, Palawan",
    "country": "Philippines",
    "countryCode": "PH",
    "latitude": 11.18583,
    "longitude": 119.39556,
    "geonamesId": 1713917,
    "description": "Discover the limestone coastline and island lagoons around El Nido in northern Palawan.",
    "highlights": [
      "Big Lagoon",
      "Nacpan Beach"
    ],
    "guideUrl": "https://www.philippines.travel/destinations/palawan-el-nido/index",
    "photo": {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/El_Nido_Palawan_2.jpg/960px-El_Nido_Palawan_2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      "creator": "Philippine Fly Boy",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:El_Nido_Palawan_2.jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
    }
  },
  {
    "id": "tokyo",
    "name": "Tokyo",
    "country": "Japan",
    "countryCode": "JP",
    "latitude": 35.6895,
    "longitude": 139.69171,
    "geonamesId": 1850147,
    "description": "Explore historic Asakusa, neighbourhood streets and the skyline of Japan’s capital.",
    "highlights": [
      "Sensō-ji",
      "Tokyo Skytree"
    ],
    "guideUrl": "https://www.gotokyo.org/en/see-and-do/attractions/",
    "photo": {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Skyscrapers_of_Shinjuku_2009_January_%28revised%29.jpg/960px-Skyscrapers_of_Shinjuku_2009_January_%28revised%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      "creator": "Morio",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Skyscrapers_of_Shinjuku_2009_January_(revised).jpg",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
    }
  },
  {
    "id": "singapore",
    "name": "Singapore",
    "country": "Singapore",
    "countryCode": "SG",
    "latitude": 1.28967,
    "longitude": 103.85007,
    "geonamesId": 1880252,
    "description": "Explore the city’s waterfront, gardens and distinctive neighbourhoods around Marina Bay.",
    "highlights": [
      "Merlion Park",
      "Gardens by the Bay"
    ],
    "guideUrl": "https://www.visitsingapore.com/neighbourhood/featured-neighbourhood/marina-bay/",
    "photo": {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/1_singapore_city_skyline_dusk_panorama_2011.jpg/960px-1_singapore_city_skyline_dusk_panorama_2011.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      "creator": "chenisyuan",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:1_singapore_city_skyline_dusk_panorama_2011.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    }
  },
  {
    "id": "bangkok",
    "name": "Bangkok",
    "country": "Thailand",
    "countryCode": "TH",
    "latitude": 13.75398,
    "longitude": 100.50144,
    "geonamesId": 1609350,
    "description": "Discover Bangkok’s temples and riverside neighbourhoods along the Chao Phraya.",
    "highlights": [
      "Wat Phra Kaew",
      "Wat Arun"
    ],
    "guideUrl": "https://www.tourismthailand.org/Destinations/Provinces/Bangkok/219",
    "photo": {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Temple_of_the_Emerald_of_buddha_or_Wat_Phra_Kaew_%28cropped%29.jpg/960px-Temple_of_the_Emerald_of_buddha_or_Wat_Phra_Kaew_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
      "creator": "Preecha.MJ",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Temple_of_the_Emerald_of_buddha_or_Wat_Phra_Kaew_(cropped).jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    }
  },
  {
    "id": "paris",
    "name": "Paris",
    "country": "France",
    "countryCode": "FR",
    "latitude": 48.85341,
    "longitude": 2.3488,
    "geonamesId": 2988507,
    "description": "Explore the Eiffel Tower and the streets and gardens beside the Seine.",
    "highlights": [
      "Eiffel Tower",
      "Seine waterfront"
    ],
    "guideUrl": "https://www.toureiffel.paris/en",
    "photo": {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Paris%2C_Eiffel_Tower%2C_October_2014.jpg/960px-Paris%2C_Eiffel_Tower%2C_October_2014.jpg",
      "creator": "Mauro Parra-Miranda",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Paris,_Eiffel_Tower,_October_2014.jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0/"
    }
  },
  {
    "id": "sydney",
    "name": "Sydney",
    "country": "Australia",
    "countryCode": "AU",
    "latitude": -33.86785,
    "longitude": 151.20732,
    "geonamesId": 2147714,
    "description": "Discover Sydney’s sail-shaped performing arts landmark and its harbour waterfront.",
    "highlights": [
      "Sydney Opera House",
      "Sydney Harbour"
    ],
    "guideUrl": "https://www.sydneyoperahouse.com/visit",
    "photo": {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Sydney_Opera_House_-_Dec_2008.jpg/960px-Sydney_Opera_House_-_Dec_2008.jpg",
      "creator": "Diliff",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_-_Dec_2008.jpg",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
    }
  }
];

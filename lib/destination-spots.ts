export type DestinationSpot = {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  category: string;
  description: string;
  planningNote?: string;
  guideUrl: string;
  photo: { url: string; creator: string; sourceUrl: string; license: string; licenseUrl?: string };
};

// Curated inspiration, with official visitor guides and attributed Commons photos.
// Destination coordinates and identities are resolved by the location service when selected.
export const DESTINATION_SPOTS: readonly DestinationSpot[] = [
  {
    id: 'eiffel-tower', name: 'Eiffel Tower', city: 'Paris', country: 'France', countryCode: 'FR', category: 'City icon',
    description: 'See Paris from its landmark iron tower, then explore the streets and gardens beside the Seine.',
    guideUrl: 'https://www.toureiffel.paris/en',
    photo: { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Paris%2C_Eiffel_Tower%2C_October_2014.jpg/960px-Paris%2C_Eiffel_Tower%2C_October_2014.jpg', creator: 'Mauro Parra-Miranda', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Paris,_Eiffel_Tower,_October_2014.jpg', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    id: 'fushimi-inari', name: 'Fushimi Inari Taisha', city: 'Kyoto', country: 'Japan', countryCode: 'JP', category: 'Culture & heritage',
    description: 'Follow the vermilion torii paths at this shrine in southern Kyoto, a starting point for exploring the city’s heritage.',
    guideUrl: 'https://www.kyoto.travel/en/areas/fushimi/',
    photo: { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg/960px-Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg', creator: 'Basile Morin', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine,_Kyoto,_Japan.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
  {
    id: 'colosseum', name: 'Colosseum', city: 'Rome', country: 'Italy', countryCode: 'IT', category: 'Ancient history',
    description: 'Explore Rome’s ancient amphitheatre and the surrounding archaeological park, with the modern city just beyond.',
    guideUrl: 'https://colosseo.it/en/',
    photo: { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Colosseum_in_Rome-April_2007-1-_copie_2B.jpg/960px-Colosseum_in_Rome-April_2007-1-_copie_2B.jpg', creator: 'Diliff', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Colosseum_in_Rome-April_2007-1-_copie_2B.jpg', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5/' },
  },
  {
    id: 'sydney-opera-house', name: 'Sydney Opera House', city: 'Sydney', country: 'Australia', countryCode: 'AU', category: 'Architecture & waterfront',
    description: 'Discover the sail-shaped performing arts landmark on Sydney Harbour and explore its waterfront surroundings.',
    guideUrl: 'https://www.sydneyoperahouse.com/visit',
    photo: { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Sydney_Opera_House_-_Dec_2008.jpg/960px-Sydney_Opera_House_-_Dec_2008.jpg', creator: 'Diliff', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_-_Dec_2008.jpg', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  },
  {
    id: 'taj-mahal', name: 'Taj Mahal', city: 'Agra', country: 'India', countryCode: 'IN', category: 'Culture & architecture',
    description: 'Visit the white marble Mughal monument on the bank of the Yamuna River in Agra.',
    guideUrl: 'https://www.tajmahal.gov.in/',
    photo: { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Taj_Mahal%2C_Agra%2C_India_edit2.jpg/960px-Taj_Mahal%2C_Agra%2C_India_edit2.jpg', creator: 'Yann, edited by King of Hearts', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Taj_Mahal,_Agra,_India_edit2.jpg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
  {
    id: 'machu-picchu', name: 'Machu Picchu', city: 'Cusco', country: 'Peru', countryCode: 'PE', category: 'Mountains & heritage',
    description: 'Discover Inca stone terraces and mountain views in Peru’s Andes.',
    planningNote: 'Plan from Cusco and include Machu Picchu in your preferred activities. The site is outside the city; check the official guide for access and tickets.',
    guideUrl: 'https://machupicchu.gob.pe/',
    photo: { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/80_-_Machu_Picchu_-_Juin_2009_-_edit.jpg/960px-80_-_Machu_Picchu_-_Juin_2009_-_edit.jpg', creator: 'Martin St-Amant (S23678)', sourceUrl: 'https://commons.wikimedia.org/wiki/File:80_-_Machu_Picchu_-_Juin_2009_-_edit.jpg', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  },
];

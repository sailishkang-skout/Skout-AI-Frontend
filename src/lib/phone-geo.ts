/** Local-number geography for the Telnyx marketplace search. Keys match COUNTRIES ISO-2. */

export type PhoneAreaCode = { code: string; label: string };
export type PhoneCity = { name: string; areaCodes: string[] };

export type PhoneCountryGeo = {
  areaCodes: PhoneAreaCode[];
  cities: PhoneCity[];
};

function ac(code: string, place: string): PhoneAreaCode {
  return { code, label: `${code} — ${place}` };
}

function city(name: string, ...areaCodes: string[]): PhoneCity {
  return { name, areaCodes };
}

const US: PhoneCountryGeo = {
  areaCodes: [
    ac("201", "Northern NJ"),
    ac("202", "Washington, DC"),
    ac("206", "Seattle, WA"),
    ac("212", "New York, NY"),
    ac("213", "Los Angeles, CA"),
    ac("214", "Dallas, TX"),
    ac("215", "Philadelphia, PA"),
    ac("216", "Cleveland, OH"),
    ac("303", "Denver, CO"),
    ac("305", "Miami, FL"),
    ac("310", "Los Angeles, CA"),
    ac("312", "Chicago, IL"),
    ac("314", "St. Louis, MO"),
    ac("404", "Atlanta, GA"),
    ac("408", "San Jose, CA"),
    ac("412", "Pittsburgh, PA"),
    ac("415", "San Francisco, CA"),
    ac("469", "Dallas, TX"),
    ac("503", "Portland, OR"),
    ac("504", "New Orleans, LA"),
    ac("510", "Oakland, CA"),
    ac("512", "Austin, TX"),
    ac("602", "Phoenix, AZ"),
    ac("612", "Minneapolis, MN"),
    ac("615", "Nashville, TN"),
    ac("617", "Boston, MA"),
    ac("619", "San Diego, CA"),
    ac("646", "New York, NY"),
    ac("650", "Peninsula, CA"),
    ac("702", "Las Vegas, NV"),
    ac("703", "Northern VA"),
    ac("704", "Charlotte, NC"),
    ac("713", "Houston, TX"),
    ac("714", "Orange County, CA"),
    ac("718", "New York, NY"),
    ac("773", "Chicago, IL"),
    ac("786", "Miami, FL"),
    ac("801", "Salt Lake City, UT"),
    ac("813", "Tampa, FL"),
    ac("818", "Los Angeles, CA"),
    ac("832", "Houston, TX"),
    ac("858", "San Diego, CA"),
    ac("916", "Sacramento, CA"),
    ac("917", "New York, NY"),
    ac("919", "Raleigh, NC"),
    ac("925", "East Bay, CA"),
    ac("949", "Orange County, CA"),
    ac("972", "Dallas, TX"),
  ],
  cities: [
    city("New York", "212", "646", "917", "718"),
    city("Los Angeles", "213", "310", "818"),
    city("Chicago", "312", "773"),
    city("Houston", "713", "832"),
    city("Dallas", "214", "469", "972"),
    city("San Francisco", "415"),
    city("San Jose", "408"),
    city("Oakland", "510"),
    city("Sacramento", "916"),
    city("San Diego", "619", "858"),
    city("Orange County", "714", "949"),
    city("Austin", "512"),
    city("Miami", "305", "786"),
    city("Tampa", "813"),
    city("Atlanta", "404"),
    city("Boston", "617"),
    city("Seattle", "206"),
    city("Denver", "303"),
    city("Phoenix", "602"),
    city("Portland", "503"),
    city("Las Vegas", "702"),
    city("Washington", "202"),
    city("Philadelphia", "215"),
    city("Cleveland", "216"),
    city("St. Louis", "314"),
    city("Pittsburgh", "412"),
    city("Nashville", "615"),
    city("New Orleans", "504"),
    city("Charlotte", "704"),
    city("Raleigh", "919"),
    city("Minneapolis", "612"),
    city("Salt Lake City", "801"),
  ],
};

const CA: PhoneCountryGeo = {
  areaCodes: [
    ac("204", "Winnipeg, MB"),
    ac("403", "Calgary, AB"),
    ac("416", "Toronto, ON"),
    ac("418", "Quebec City, QC"),
    ac("438", "Montreal, QC"),
    ac("514", "Montreal, QC"),
    ac("604", "Vancouver, BC"),
    ac("613", "Ottawa, ON"),
    ac("647", "Toronto, ON"),
    ac("778", "Vancouver, BC"),
    ac("780", "Edmonton, AB"),
    ac("825", "Calgary, AB"),
    ac("905", "Greater Toronto, ON"),
  ],
  cities: [
    city("Toronto", "416", "647", "905"),
    city("Montreal", "514", "438"),
    city("Vancouver", "604", "778"),
    city("Calgary", "403", "825"),
    city("Edmonton", "780"),
    city("Ottawa", "613"),
    city("Quebec City", "418"),
    city("Winnipeg", "204"),
  ],
};

const GB: PhoneCountryGeo = {
  areaCodes: [
    ac("20", "London"),
    ac("113", "Leeds"),
    ac("114", "Sheffield"),
    ac("115", "Nottingham"),
    ac("116", "Leicester"),
    ac("117", "Bristol"),
    ac("121", "Birmingham"),
    ac("131", "Edinburgh"),
    ac("141", "Glasgow"),
    ac("151", "Liverpool"),
    ac("161", "Manchester"),
    ac("191", "Newcastle"),
  ],
  cities: [
    city("London", "20"),
    city("Manchester", "161"),
    city("Birmingham", "121"),
    city("Glasgow", "141"),
    city("Edinburgh", "131"),
    city("Leeds", "113"),
    city("Liverpool", "151"),
    city("Bristol", "117"),
    city("Sheffield", "114"),
    city("Newcastle", "191"),
    city("Nottingham", "115"),
    city("Leicester", "116"),
  ],
};

const DE: PhoneCountryGeo = {
  areaCodes: [
    ac("30", "Berlin"),
    ac("40", "Hamburg"),
    ac("69", "Frankfurt"),
    ac("89", "Munich"),
    ac("221", "Cologne"),
    ac("211", "Düsseldorf"),
    ac("711", "Stuttgart"),
  ],
  cities: [
    city("Berlin", "30"),
    city("Hamburg", "40"),
    city("Munich", "89"),
    city("Frankfurt", "69"),
    city("Cologne", "221"),
    city("Düsseldorf", "211"),
    city("Stuttgart", "711"),
  ],
};

const FR: PhoneCountryGeo = {
  areaCodes: [
    ac("1", "Paris"),
    ac("2", "Northwest"),
    ac("3", "Northeast"),
    ac("4", "Southeast"),
    ac("5", "Southwest"),
  ],
  cities: [
    city("Paris", "1"),
    city("Lyon", "4"),
    city("Marseille", "4"),
    city("Toulouse", "5"),
    city("Bordeaux", "5"),
    city("Lille", "3"),
    city("Nantes", "2"),
  ],
};

const AU: PhoneCountryGeo = {
  areaCodes: [
    ac("2", "Sydney / NSW"),
    ac("3", "Melbourne / VIC"),
    ac("7", "Brisbane / QLD"),
    ac("8", "Perth / Adelaide"),
  ],
  cities: [
    city("Sydney", "2"),
    city("Melbourne", "3"),
    city("Brisbane", "7"),
    city("Perth", "8"),
    city("Adelaide", "8"),
  ],
};

const IN: PhoneCountryGeo = {
  areaCodes: [
    ac("11", "Delhi"),
    ac("20", "Pune"),
    ac("22", "Mumbai"),
    ac("33", "Kolkata"),
    ac("40", "Hyderabad"),
    ac("44", "Chennai"),
    ac("79", "Ahmedabad"),
    ac("80", "Bengaluru"),
  ],
  cities: [
    city("Delhi", "11"),
    city("Mumbai", "22"),
    city("Bengaluru", "80"),
    city("Hyderabad", "40"),
    city("Chennai", "44"),
    city("Kolkata", "33"),
    city("Pune", "20"),
    city("Ahmedabad", "79"),
  ],
};

const NL: PhoneCountryGeo = {
  areaCodes: [ac("10", "Rotterdam"), ac("20", "Amsterdam"), ac("30", "Utrecht"), ac("70", "The Hague")],
  cities: [city("Amsterdam", "20"), city("Rotterdam", "10"), city("The Hague", "70"), city("Utrecht", "30")],
};

const SG: PhoneCountryGeo = {
  areaCodes: [],
  cities: [city("Singapore")],
};

const AE: PhoneCountryGeo = {
  areaCodes: [ac("2", "Abu Dhabi"), ac("4", "Dubai"), ac("6", "Sharjah")],
  cities: [city("Dubai", "4"), city("Abu Dhabi", "2"), city("Sharjah", "6")],
};

export const PHONE_GEO_BY_COUNTRY: Record<string, PhoneCountryGeo> = {
  US,
  CA,
  GB,
  DE,
  FR,
  AU,
  IN,
  NL,
  SG,
  AE,
};

const TOLL_FREE: Record<string, PhoneAreaCode[]> = {
  US: ["800", "833", "844", "855", "866", "877", "888"].map((code) => ac(code, "Toll-free")),
  CA: ["800", "833", "844", "855", "866", "877", "888"].map((code) => ac(code, "Toll-free")),
  GB: [ac("800", "Toll-free"), ac("808", "Toll-free")],
  AU: [ac("1800", "Toll-free")],
  DE: [ac("800", "Toll-free")],
  FR: [ac("800", "Toll-free")],
  IN: [ac("1800", "Toll-free")],
  NL: [ac("800", "Toll-free")],
  SG: [ac("1800", "Toll-free")],
  AE: [ac("800", "Toll-free")],
};

export function usesLocalGeo(numberType: string): boolean {
  return numberType === "local";
}

export function phoneAreaCodesFor(country: string, numberType: string): PhoneAreaCode[] {
  if (numberType === "toll_free") return TOLL_FREE[country] ?? [];
  if (!usesLocalGeo(numberType)) return [];
  return PHONE_GEO_BY_COUNTRY[country]?.areaCodes ?? [];
}

export function phoneCitiesFor(country: string, areaCode: string, numberType: string): PhoneCity[] {
  if (!usesLocalGeo(numberType)) return [];
  const cities = PHONE_GEO_BY_COUNTRY[country]?.cities ?? [];
  if (!areaCode) return cities;
  return cities.filter((c) => c.areaCodes.length === 0 || c.areaCodes.includes(areaCode));
}

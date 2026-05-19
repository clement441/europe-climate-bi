/* Country → ISO 3166-1 alpha-2 code (for flagcdn.com) */
export const COUNTRY_ISO = {
  "Albania": "al", "Andorra": "ad", "Austria": "at", "Belarus": "by",
  "Belgium": "be", "Bosnia and Herzegovina": "ba", "Bulgaria": "bg",
  "Croatia": "hr", "Cyprus": "cy", "Czech Republic": "cz", "Czechia": "cz",
  "Denmark": "dk", "Estonia": "ee", "Finland": "fi", "France": "fr",
  "Germany": "de", "Greece": "gr", "Hungary": "hu", "Iceland": "is",
  "Ireland": "ie", "Italy": "it", "Kosovo": "xk", "Latvia": "lv",
  "Liechtenstein": "li", "Lithuania": "lt", "Luxembourg": "lu",
  "Malta": "mt", "Moldova": "md", "Monaco": "mc", "Montenegro": "me",
  "Netherlands": "nl", "North Macedonia": "mk", "Macedonia": "mk",
  "Norway": "no", "Poland": "pl", "Portugal": "pt", "Romania": "ro",
  "Russia": "ru", "San Marino": "sm", "Serbia": "rs", "Slovakia": "sk",
  "Slovenia": "si", "Spain": "es", "Sweden": "se", "Switzerland": "ch",
  "Turkey": "tr", "Türkiye": "tr", "Ukraine": "ua",
  "United Kingdom": "gb", "UK": "gb",
};

export function countryToISO(name) {
  if (!name) return null;
  return COUNTRY_ISO[name.trim()] || null;
}

export const COUNTRY_CODES = [
  { country: "United States", code: "+1", flag: "🇺🇸" },
  { country: "Canada", code: "+1", flag: "🇨🇦" },
  { country: "Spain", code: "+34", flag: "🇪🇸" },
  { country: "Mexico", code: "+52", flag: "🇲🇽" },
  { country: "Argentina", code: "+54", flag: "🇦🇷" },
  { country: "Brazil", code: "+55", flag: "🇧🇷" },
  { country: "Chile", code: "+56", flag: "🇨🇱" },
  { country: "Colombia", code: "+57", flag: "🇨🇴" },
  { country: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { country: "Germany", code: "+49", flag: "🇩🇪" },
  { country: "France", code: "+33", flag: "🇫🇷" },
  { country: "Italy", code: "+39", flag: "🇮🇹" },
  { country: "Netherlands", code: "+31", flag: "🇳🇱" },
  { country: "Belgium", code: "+32", flag: "🇧🇪" },
  { country: "Switzerland", code: "+41", flag: "🇨🇭" },
  { country: "Austria", code: "+43", flag: "🇦🇹" },
  { country: "Poland", code: "+48", flag: "🇵🇱" },
  { country: "Sweden", code: "+46", flag: "🇸🇪" },
  { country: "Norway", code: "+47", flag: "🇳🇴" },
  { country: "Denmark", code: "+45", flag: "🇩🇰" },
  { country: "Portugal", code: "+351", flag: "🇵🇹" },
  { country: "Russia", code: "+7", flag: "🇷🇺" },
  { country: "India", code: "+91", flag: "🇮🇳" },
  { country: "Japan", code: "+81", flag: "🇯🇵" },
  { country: "South Korea", code: "+82", flag: "🇰🇷" },
  { country: "Singapore", code: "+65", flag: "🇸🇬" },
  { country: "Australia", code: "+61", flag: "🇦🇺" },
  { country: "New Zealand", code: "+64", flag: "🇳🇿" },
]

export function getCountryCode(country: string): string {
  const found = COUNTRY_CODES.find((c) => c.country === country)
  return found?.code || "+1"
}

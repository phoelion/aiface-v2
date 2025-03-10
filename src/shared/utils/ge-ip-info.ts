import axios from 'axios';

export async function getCountryFromRequest(ip: string | string[]) {
  try {
    const apiUrl = `https://ipinfo.io/${ip}/json`;

    const response = await axios.get(apiUrl);
    const country = response.data.country;
    return country;
  } catch (error) {
    return 'Unknown';
  }
}

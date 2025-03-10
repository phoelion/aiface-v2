import axios from 'axios';

export async function checkPikaStatus() {
  try {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: process.env.PIKA_INFO_URL,
      headers: {
        ApiKey: process.env.PIKA_API_KEY,
        Authorization: `Bearer ${process.env.PIKA_TOKEN}`,
      },
    };

    const { data } = await axios.request(config);
    return data;
  } catch (error) {
    console.log(error);
    return false;
  }
}
